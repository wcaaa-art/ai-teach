import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { TOOL_LABELS, buildPlanPrompt, callDeepSeek, extractJson, fallbackPlan, guardTutorAnswer, normalizeIterationOutput, normalizePlanOutput, normalizeReplacedPlan, safeFilter, streamAgent } from './agent.js'
import { createAuthRouter, createAuthService } from './auth.js'
import { executeTool, toolSchemas } from './tools.js'
import { mcpPrompts, mcpResources, mcpTools } from './mcp-capabilities.js'
import { RAG_EVAL_CASES, RAG_NEGATIVE_CASES } from './rag/rag-eval-cases.js'
import { LEARNING_SYSTEM_PROMPT, PLAN_REPLACE_PROMPT, PLAN_SEQUENCE_PROMPT, TOOL_AGENT_PROMPT, WEEKLY_REPORT_PROMPT, tutorSystemPrompt } from './prompts.js'
import { buildAdaptivePlan, buildDiagnosticBlueprint, buildFallbackDiagnosticQuestions, listCurriculumChapters, listCurriculumSubjects, orderCurriculumPlans, searchCurriculum, stampDiagnosticQuestionIds } from './curriculum.js'
import { PAPER_SPECS, buildFallbackQuizQuestions, buildQuizBlueprint, generateQuiz, mapWithLimit } from './quiz.js'
import { PAPER_PARSE_SYSTEM_PROMPT, fallbackPaperQuestions, normalizePaperQuestions } from './paper-scan.js'
import { PAPER_DIAGNOSIS_PROMPT, fallbackPaperDiagnosis, normalizePaperDiagnosis } from './paper-diagnosis.js'
import { MISTAKE_ANALYSIS_PROMPT, fallbackMistakeAnalysis, normalizeMistakeAnalysis } from './mistake-analysis.js'
import { resolveTextbookEdition } from './textbooks.js'
import { buildVideoKeyword, buildVideoSearchUrl, fetchVideoPool, pickVideoBatch } from './videos.js'
import { buildFallbackWeeklyReport, normalizeWeeklyReport, verifyWeeklyReportNumbers } from './weekly-report.js'
import { RECITE_CONTENT_PROMPT, fallbackReciteContent, normalizeReciteContent } from './recite.js'
import { buildPrefetchKey, cachedGenerate } from './prefetch-cache.js'
import { loadQuestionBank, pickBankQuestions } from './question-bank.js'
import { looksGarbled, parseExamQuestions, reflowText } from './exam-text.js'
import { getLocalLesson } from './lessons/index.js'
import { generatePractice } from './practice.js'
import { formatCitation, isRagReady, searchPassages } from './rag/index.js'

const app = express()
const allowedOrigins = (process.env.CLIENT_ORIGINS || process.env.CLIENT_ORIGIN || 'http://localhost:5173,http://localhost:4173')
  .split(',').map(origin => origin.trim()).filter(Boolean)
// 浏览器发 POST 时即使同源也会带 Origin，经 Vite 代理转发后 Origin 仍是页面地址。
// 开发期 Vite 端口可能被占用（5174 等），所以回环地址一律放行，避免请求被 CORS 拒绝后拿到 HTML 错误页。
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
app.use(cors({ origin: (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin) || (process.env.NODE_ENV !== 'production' && LOCAL_ORIGIN.test(origin))) callback(null, true)
  else callback(new Error('Origin is not allowed by the local API.'))
}, credentials: true }))
app.use(express.json({ limit: '8mb' }))

// 账号服务把用户数据保存在本机 server/data，会话通过 HttpOnly Cookie 维持。
const authService = await createAuthService({ secret: process.env.AUTH_SESSION_SECRET })
app.use('/api/auth', createAuthRouter(authService))
let latestVisualStatus = { is_present: true, continuous_away_seconds: 0, updatedAt: Date.now() }
const tutorRate = new Map()

const ok = (res, data, extra = {}) => res.json({ success: true, data, ...extra })

app.get('/api/health', (req, res) => ok(res, { status: 'ok', model: process.env.LLM_MODEL_NAME || 'deepseek-flash' }))

app.get('/api/curriculum/subjects', (req, res) => {
  return ok(res, listCurriculumSubjects(req.query.grade))
})

app.get('/api/curriculum/chapters', (req, res) => {
  if (!req.query.grade || !req.query.subject) return ok(res, { chapters: [], error: 'missing-grade-or-subject' }, { source: 'validation' })
  return ok(res, listCurriculumChapters(String(req.query.grade), String(req.query.subject), req.query.edition ? String(req.query.edition) : ''))
})

// 资料库按章节聚合：本地题库给典型例题，RAG 给真题片段，课程目录给前置/相关知识点。
function findBankRecord({ grade, subject, edition, chapterId, chapterName }) {
  const bank = loadQuestionBank()
  const direct = bank.get([grade, subject, edition || '', chapterId].join('|'))
  if (direct) return direct
  // 非人教版或章节 id 不一致时，回落到同年级同科目同章节名的题库文件。
  for (const record of bank.values()) {
    if (record.grade === grade && record.subject === subject && record.chapter?.name === chapterName) return record
  }
  return null
}

function materialPassages({ query, subject, grade }) {
  if (!isRagReady()) return { passages: [], note: '' }
  try {
    const hits = searchPassages({ query, subject, grade, topK: 3, minScore: 6, maxChars: 1800, subjectStrict: true })
    const passages = hits.map(item => {
      // 600 字会把题目切一半；放宽到 1800 后按题拆开，前端才能把题干、选项、解析分开排版。
      const text = String(item.text || '').slice(0, 1800)
      const parsed = parseExamQuestions(text)
      // 切不出题的片段也要把逐行碎片重排成段落；重排后仍是公式乱码，
      // 或者整段只是上一题的答案解析（含【详解】/故选），都不直接上屏。
      const readableRaw = reflowText(text, { maxParagraphs: 12 }).slice(0, 1000)
      const readable = looksGarbled(readableRaw) || /【(?:答\s*案|解\s*析|详\s*解|分\s*析|点\s*睛)】|故选/.test(readableRaw) ? '' : readableRaw
      if (!parsed.questions.length && !readable) return null
      return {
        readable,
        // 被截断在公式中间的导语同样不展示，避免一句话缺半截。
        lead: looksGarbled(parsed.lead) ? '' : parsed.lead,
        citation: item.citation || formatCitation(),
        questions: parsed.questions
      }
    }).filter(Boolean)
    return {
      passages,
      // 命中过真题但全部被筛掉，说明这一章在源文件里就是公式/图片排版，给一句说明而不是铺乱码。
      note: !passages.length && hits.length ? '这一章的真题在原卷里用公式或图片排版，文本版没法完整还原，建议直接查看原卷。' : ''
    }
  } catch {
    return { passages: [], note: '' }
  }
}

app.get('/api/materials/chapter', (req, res) => {
  const grade = String(req.query.grade || '').trim()
  const subject = String(req.query.subject || '').trim()
  const edition = String(req.query.edition || '').trim()
  const chapterId = String(req.query.chapterId || '').trim()
  if (!grade || !subject || !chapterId) return ok(res, { chapter: null, examples: [], passages: [], related: [] }, { source: 'validation' })
  const catalog = listCurriculumChapters(grade, subject, edition)
  const chapter = catalog.chapters.find(item => item.id === chapterId)
  if (!chapter) return ok(res, { chapter: null, examples: [], passages: [], related: [] }, { source: 'not-found' })

  const bankRecord = findBankRecord({ grade, subject, edition: catalog.edition, chapterId, chapterName: chapter.name })
  const examples = (bankRecord?.questions || []).slice(0, 3).map(item => ({
    id: item.id,
    type: item.type,
    stem: item.stem,
    options: Array.isArray(item.options) ? item.options : [],
    correctIndex: Number.isInteger(item.correctIndex) ? item.correctIndex : -1,
    answer: item.answer || '',
    explanation: item.explanation || '',
    difficulty: item.difficulty || '',
    dimension: item.dimension || ''
  }))
  const chapterNames = new Map(catalog.chapters.map(item => [item.id, item.name]))
  const related = [...new Set([
    ...chapter.prerequisiteIds.map(id => chapterNames.get(id)).filter(Boolean),
    ...searchCurriculum({ subject, grade: catalog.grade, keyword: chapter.name }).matches
      .map(item => item.name)
      .filter(name => name !== chapter.name)
  ])].slice(0, 5)
  const material = materialPassages({ query: `${subject} ${chapter.name}`, subject, grade: catalog.grade })
  // 讲解直接读本地知识包，和例题同一次返回，点开章节就能看见，不经过模型。
  const lesson = getLocalLesson({
    grade, subject, chapterName: chapter.name, unitLabel: chapter.unitLabel || ''
  })
  return ok(res, {
    chapter: {
      id: chapter.id, name: chapter.name, order: chapter.order,
      importance: chapter.importance, unitLabel: chapter.unitLabel || ''
    },
    edition: catalog.edition,
    editionNote: catalog.editionNote,
    lesson,
    examples,
    passages: material.passages,
    passagesNote: material.note,
    related
  }, { source: 'local' })
})

app.get('/api/materials/search', (req, res) => {
  const keyword = safeFilter(String(req.query.q || '')).trim().slice(0, 60)
  const grade = String(req.query.grade || '').trim()
  const subject = String(req.query.subject || '').trim()
  if (!keyword) return ok(res, { topics: [], passages: [] }, { source: 'validation' })
  const topics = searchCurriculum({ subject, grade, keyword }).matches
    .map(item => ({ name: item.name, grade: item.grade, subject: item.subject }))
  const material = materialPassages({ query: keyword, subject, grade })
  return ok(res, {
    topics,
    passages: material.passages,
    passagesNote: material.note
  }, { source: 'local' })
})

// 「AI 能力」页：把 Agent 工具、MCP 清单与 RAG 状态集中返回，避免前端写死能力清单。
app.get('/api/ai/capabilities', (_req, res) => {
  const apiKey = process.env.DEEPSEEK_API_KEY || ''
  return ok(res, {
    llm: {
      model: process.env.LLM_MODEL_NAME || 'deepseek-flash',
      configured: Boolean(apiKey && !apiKey.includes('TODO')),
      streaming: true,
      toolCalling: true,
      jsonMode: true
    },
    agent: toolSchemas.map(tool => ({
      name: tool.function.name,
      label: TOOL_LABELS[tool.function.name] || tool.function.name,
      description: tool.function.description,
      parameters: Object.keys(tool.function.parameters.properties || {})
    })),
    mcp: {
      command: 'npm run mcp',
      tools: mcpTools.map(({ name, description }) => ({ name, description })),
      resources: mcpResources.map(({ uri, name, description }) => ({ uri, name, description })),
      prompts: mcpPrompts.map(({ name, title, description }) => ({ name, title, description }))
    },
    rag: {
      ready: isRagReady(),
      engine: process.env.RAG_HYBRID === '1' ? 'BM25 + 稠密向量 RRF 融合' : 'BM25 稀疏检索',
      evalCases: RAG_EVAL_CASES.length,
      negativeCases: RAG_NEGATIVE_CASES.length
    }
  }, { source: 'local' })
})

// 演示页的检索精度优先：BM25 偶尔会把同卷的无关题带进来，
// 这里只用题干预览做一次 2 字窗口复核，避免现场把「农业题」展示成「二次函数」的命中。
function ragPreviewMatchesKeyword(text = '', keyword = '') {
  const haystack = String(text).replace(/\s+/g, '').toLowerCase()
  const query = String(keyword).replace(/\s+/g, '')
  if (!haystack || query.length < 2) return true
  const latin = query.match(/[A-Za-z]{2,}/g) || []
  if (latin.some(word => haystack.includes(word.toLowerCase()))) return true
  const cjk = query.replace(/[^一-龥]/g, '')
  for (let index = 0; index + 2 <= cjk.length; index += 1) {
    if (haystack.includes(cjk.slice(index, index + 2))) return true
  }
  return false
}

// RAG 实时演示：只做检索、不调模型，现场输入关键词就能看到命中知识点与真题出处。
app.get('/api/ai/rag-search', (req, res) => {
  const startedAt = Date.now()
  const keyword = safeFilter(String(req.query.q || '')).trim().slice(0, 60)
  const grade = String(req.query.grade || '').trim().slice(0, 12)
  const subject = String(req.query.subject || '').trim().slice(0, 12)
  if (!keyword) return ok(res, { topics: [], passages: [], tookMs: 0 }, { source: 'validation' })
  const topics = searchCurriculum({ subject, grade, keyword }).matches
    .slice(0, 6)
    .map(item => ({ name: item.name, grade: item.grade, subject: item.subject }))
  let passages = []
  if (isRagReady()) {
    try {
      const mapped = searchPassages({ query: keyword, subject, grade, topK: 6, minScore: 6 })
        .map(item => {
          // 真题 PDF 抽出来的文本会带私用区字符，先清掉再截到「答案」之前，
          // 只给评委看题干命中预览；公式符号缺失时用 garbled 标记说明，不直接留白。
          let preview = String(item.text || '')
            .replace(/[\uE000-\uF8FF\uFFFD]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
          const answerAt = preview.search(/【答\s*案】/)
          if (answerAt > 60) preview = preview.slice(0, answerAt)
          preview = preview.replace(/^\d{1,2}[.、．]\s*/, '').slice(0, 220)
          return {
            citation: item.citation || formatCitation(),
            subject: item.subject,
            year: item.year,
            exam: item.exam,
            score: Math.round(Number(item.score) || 0),
            snippet: preview.length >= 20 ? preview : '',
            garbled: looksGarbled(preview)
          }
        })
        .filter(item => item.citation)
      const relevant = mapped.filter(item => !item.snippet || ragPreviewMatchesKeyword(item.snippet, keyword))
      passages = (relevant.length ? relevant : mapped).slice(0, 3)
    } catch {
      passages = []
    }
  }
  return ok(res, {
    keyword,
    topics,
    passages,
    tookMs: Date.now() - startedAt
  }, { source: isRagReady() ? 'rag' : 'unavailable' })
})

// 学习视频推荐：代理 B 站搜索，按播放量排序；exclude / authors / reason 支撑「换一换」。
app.get('/api/videos/recommend', async (req, res) => {
  const chapter = String(req.query.chapter || '').trim()
  const grade = String(req.query.grade || '').trim()
  const subject = String(req.query.subject || '').trim()
  const edition = String(req.query.edition || '').trim()
  const keyword = buildVideoKeyword({ grade, subject, edition, chapter })
  const fallbackUrl = buildVideoSearchUrl(keyword)
  if (!chapter) return ok(res, { items: [], fallbackUrl, keyword }, { source: 'validation' })
  const excludeBvids = String(req.query.exclude || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 30)
  const excludeAuthors = String(req.query.authors || '').split(',').map(item => item.trim()).filter(Boolean).slice(0, 10)
  const allowedReasons = ['old', 'fast', 'edition', 'author']
  const reason = allowedReasons.includes(String(req.query.reason || '')) ? String(req.query.reason) : ''
  const limit = Math.min(6, Math.max(1, Number(req.query.limit) || 3))
  try {
    const pool = await fetchVideoPool(keyword)
    const items = pickVideoBatch(pool, { excludeBvids, excludeAuthors, reason, edition, chapter, limit })
    return ok(res, { items, fallbackUrl, keyword, poolSize: pool.length }, { source: 'bilibili' })
  } catch {
    // 上游风控或断网时不报错，交给前端展示「去 B 站搜」兜底入口。
    return ok(res, { items: [], fallbackUrl, keyword }, { source: 'fallback', message: '视频检索暂时不可用，可直接去 B 站搜索。' })
  }
})

// 摸底与题库脚本共用同一套直连模型出题实现，避免提示词和校验口径分叉。
import { requestDiagnosticQuestion } from './direct-generation.js'

// 摸底请求参数先归一化：预生成和正式开始必须用同一套参数，才能命中同一份题库缓存。
function normalizeAssessmentRequest(body = {}) {
  const chapters = Array.isArray(body.chapters) ? body.chapters.slice(0, 8) : []
  if (!body.grade || !body.subject || !chapters.length) return null
  const requestedQuestionCount = Number(body.questionCount)
  const questionCount = Number.isFinite(requestedQuestionCount) ? Math.max(1, Math.min(30, Math.round(requestedQuestionCount))) : undefined
  const attempt = Math.max(1, Math.min(6, Math.round(Number(body.attempt) || 1)))
  // 教材版本决定章节范围与命题口径；无法识别的版本回落到该科目默认版本。
  const edition = resolveTextbookEdition(String(body.subject || ''), String(body.edition || '')).edition
  const excludeQuestions = Array.isArray(body.excludeQuestions) ? body.excludeQuestions.slice(-180).map(question => ({ id: String(question?.id || ''), stem: String(question?.stem || '').slice(0, 1200), chapterId: String(question?.chapterId || ''), dimension: String(question?.dimension || '') })) : []
  // 离线脚本强制重建题库时必须绕开已有题库，否则会拿旧题覆盖旧题。
  const bypassBank = body.bypassBank === true
  return { grade: String(body.grade), subject: String(body.subject), chapters, questionCount, attempt, edition, excludeQuestions, bypassBank }
}

async function buildAssessmentResult({ grade, subject, chapters, questionCount, attempt, edition, excludeQuestions, bypassBank = false }) {
  const blueprint = buildDiagnosticBlueprint(chapters, questionCount)
  const fallback = buildFallbackDiagnosticQuestions({ grade, subject, chapters, questionCount, attempt, excludeQuestions })

  // 逐题并发：十道题串行要 40–60 秒，按题位并发后墙钟接近最慢的一道。
  // 摸底题量固定（10 题左右），放宽到 10 路并发，让一整轮一次发完。
  // 题量大于维度数时维度循环复用，保证题位数量与蓝图一致。
  const slots = blueprint.blueprint.flatMap(item => Array.from({ length: item.count }, (_, index) => ({
    chapterId: item.chapterId,
    chapterName: item.chapterName,
    dimension: item.dimensions?.[index % (item.dimensions.length || 1)] || 'concept'
  })))
  // 先抽离线题库：命中的题位不再请求模型，题库没覆盖到的位置才走模型。
  const bankQuestions = bypassBank ? slots.map(() => null) : pickBankQuestions({
    grade, subject, edition, slots,
    excludeStems: excludeQuestions.map(question => question.stem)
  })
  const missingSlots = []
  const missingIndexes = []
  slots.forEach((slot, index) => {
    if (!bankQuestions[index]) {
      missingSlots.push(slot)
      missingIndexes.push(index)
    }
  })
  const answers = missingSlots.length
    ? await mapWithLimit(missingSlots, Math.min(missingSlots.length, 10), slot => requestDiagnosticQuestion(slot, {
      grade, subject, edition, attempt, excludeQuestions
    }))
    : []
  const modelAnswers = new Map(missingIndexes.map((slotIndex, answerIndex) => [slotIndex, answers[answerIndex]]))

  const stemKey = stem => String(stem || '').replace(/\s+/g, '').trim()
  const excludedStems = new Set(excludeQuestions.map(question => stemKey(question.stem)).filter(Boolean))
  const questions = []
  let modelCount = 0
  let bankCount = 0
  slots.forEach((slot, index) => {
    if (bankQuestions[index]) {
      const bankStem = stemKey(bankQuestions[index].stem)
      if (bankStem && !excludedStems.has(bankStem)) {
        excludedStems.add(bankStem)
        questions.push(bankQuestions[index])
        bankCount += 1
      }
      return
    }
    const candidate = modelAnswers.get(index)
    const candidateKey = stemKey(candidate?.stem)
    if (candidate && candidateKey && !excludedStems.has(candidateKey)) {
      excludedStems.add(candidateKey)
      questions.push(candidate)
      modelCount += 1
      return
    }
    // 该题位没有可用模型题时用本地题库补一题，保持专题顺序与配额。
    const chapter = chapters.find(item => item.id === slot.chapterId) || { id: slot.chapterId, name: slot.chapterName }
    const local = buildFallbackDiagnosticQuestions({
      grade, subject, chapters: [chapter], questionCount: 1, attempt,
      excludeQuestions: [...excludeQuestions, ...questions]
    }).questions[0]
    const localKey = stemKey(local?.stem)
    if (!local || !localKey || excludedStems.has(localKey)) return
    excludedStems.add(localKey)
    // 逐题兜底会复用同一批模板 id，补上题位序号避免冲突。
    questions.push({ ...local, id: `${local.id}-${index}` })
  })

  if (!questions.length) return { data: fallback, source: fallback.source, reason: 'no-usable-model-question' }
  // 模型逐题返回的 id 都是 q1，必须按题位重发唯一 id，否则十道题共享一个答案键。
  const stampedQuestions = stampDiagnosticQuestionIds(questions)
  const source = !missingSlots.length ? 'question-bank'
    : !modelCount ? 'local-fallback'
      : modelCount >= missingSlots.length ? 'deepseek' : 'deepseek-with-local-fill'
  return { data: { questions: stampedQuestions, blueprint, edition }, source }
}

app.post('/api/agent/assessment/generate', async (req, res) => {
  const params = normalizeAssessmentRequest(req.body || {})
  if (!params) return ok(res, { needMoreInfo: true, message: '请先选择年级、科目和至少一个知识专题。' }, { source: 'validation' })
  const key = buildPrefetchKey({ kind: 'assessment', ...params })
  const result = await cachedGenerate(key, () => buildAssessmentResult(params))
  const extra = { source: result.source, cached: result.cached }
  if (result.reason) extra.reason = result.reason
  return ok(res, result.data, extra)
})

// 预生成：学生选好范围就先把题库生成好，正式开始时直接命中缓存。
app.post('/api/agent/assessment/prefetch', async (req, res) => {
  const params = normalizeAssessmentRequest(req.body || {})
  if (!params) return ok(res, { ready: false, message: '请先选择年级、科目和至少一个知识专题。' }, { source: 'validation' })
  const key = buildPrefetchKey({ kind: 'assessment', ...params })
  const result = await cachedGenerate(key, () => buildAssessmentResult(params))
  return ok(res, { ready: true, count: result.data.questions?.length || 0 }, { source: result.source, cached: result.cached })
})

function normalizeQuizRequest(body = {}) {
  const mode = ['daily', 'weekly', 'paper'].includes(body.mode) ? body.mode : 'daily'
  // 综合整卷要覆盖整本教材，章节上限放宽到 16；日常/周测仍限制在 8 个专题内。
  const chapters = Array.isArray(body.chapters) ? body.chapters.filter(item => item && item.id).slice(0, mode === 'paper' ? 16 : 8) : []
  if (!body.grade || !body.subject || !chapters.length) return null
  // 章节测试同样按学生所选教材版本命题，保证与摸底、计划的章节口径一致。
  const edition = resolveTextbookEdition(String(body.subject || ''), String(body.edition || '')).edition
  // 近 7 天的题干摘要由前端从 IndexedDB 读出后带上，服务端只做比对与重生成，不落盘。
  const recentStems = Array.isArray(body.recentStems)
    ? body.recentStems.slice(-120).map(item => ({ stem: String(item?.stem || '').slice(0, 300), hash: String(item?.hash || '') }))
    : []
  return {
    mode, stage: '初中',
    grade: String(body.grade), subject: String(body.subject), chapters,
    questionCount: mode === 'paper' ? 25 : body.questionCount, recentStems, attempt: body.attempt, edition
  }
}

function buildQuizFallback(params) {
  const blueprint = buildQuizBlueprint({
    mode: params.mode, stage: params.stage, grade: params.grade, subject: params.subject,
    chapters: params.chapters, questionCount: params.questionCount
  })
  const questions = buildFallbackQuizQuestions({ blueprint, seed: Date.now() % 11 })
  return { questions, blueprint, paperSpec: PAPER_SPECS[params.stage], source: 'local-fallback', requested: blueprint.total }
}

async function buildQuizResult(params) {
  const result = await generateQuiz(params)
  return { data: { ...result, edition: params.edition }, source: result.source }
}

app.post('/api/quiz/generate', async (req, res) => {
  const params = normalizeQuizRequest(req.body || {})
  if (!params) return ok(res, { needMoreInfo: true, message: '请先选择年级、科目和至少一个章节。' }, { source: 'validation' })
  const key = buildPrefetchKey({ kind: 'quiz', ...params })
  try {
    const result = await cachedGenerate(key, () => buildQuizResult(params))
    return ok(res, result.data, { source: result.source, cached: result.cached })
  } catch (error) {
    // 生成失败直接走本地卷，不写缓存，下一次重试还有机会拿到模型题。
    return ok(res, buildQuizFallback(params), { source: 'local-fallback', error: error.message })
  }
})

app.post('/api/quiz/prefetch', async (req, res) => {
  const params = normalizeQuizRequest(req.body || {})
  if (!params) return ok(res, { ready: false, message: '请先选择年级、科目和至少一个章节。' }, { source: 'validation' })
  const key = buildPrefetchKey({ kind: 'quiz', ...params })
  try {
    const result = await cachedGenerate(key, () => buildQuizResult(params))
    return ok(res, { ready: true, count: result.data.questions?.length || 0 }, { source: result.source, cached: result.cached })
  } catch (error) {
    return ok(res, { ready: false, message: error.message }, { source: 'fallback' })
  }
})

// 学习计划「练习/做题」类任务：纯本地题库出题，秒出、不调模型。
app.post('/api/practice/generate', (req, res) => {
  const body = req.body || {}
  const grade = String(body.grade || '').slice(0, 12)
  const subject = String(body.subject || '').slice(0, 12)
  const name = String(body.name || '').slice(0, 60)
  if (!grade || !subject || !name) return ok(res, { questions: [], message: '缺少计划信息' }, { source: 'validation' })
  const recentStems = Array.isArray(body.recentStems) ? body.recentStems.slice(-120) : []
  const result = generatePractice({ grade, subject, name, questionCount: body.questionCount, recentStems })
  return ok(res, result, { source: result.source })
})

app.post('/api/agent/paper/parse', async (req, res) => {
  const text = String(req.body?.text || '').replace(/\r/g, '').trim().slice(0, 16000)
  const grade = String(req.body?.grade || '').slice(0, 12)
  const subject = String(req.body?.subject || '').slice(0, 12)
  const edition = String(req.body?.edition || '').slice(0, 30)
  if (text.length < 20) return ok(res, { title: '', questions: [], message: '没有识别到足够的试卷文字，请重新拍摄清晰一些。' }, { source: 'validation' })
  try {
    const result = await callDeepSeek({
      messages: [{ role: 'user', content: JSON.stringify({ grade, subject, edition, text }) }],
      systemPrompt: PAPER_PARSE_SYSTEM_PROMPT,
      useTools: false, jsonMode: true, maxRounds: 1, timeoutMs: 100000
    })
    const parsed = result.success ? extractJson(result.content) : null
    const normalized = normalizePaperQuestions(parsed?.questions, { grade, subject })
    if (normalized.questions.length) {
      normalized.title = String(parsed?.title || '').trim().slice(0, 60) || `${grade}${subject}试卷`
      return ok(res, normalized, { source: result.source })
    }
    const fallback = fallbackPaperQuestions(text, { grade, subject })
    return ok(res, { ...fallback, notice: '模型拆分不可用，已按题号在本地拆分，请逐题核对。' }, { source: 'local-fallback', error: result.error || 'empty-model-result' })
  } catch (error) {
    return ok(res, { ...fallbackPaperQuestions(text, { grade, subject }), notice: '模型拆分失败，已按题号在本地拆分，请逐题核对。' }, { source: 'local-fallback', error: error.message })
  }
})

// 试卷学情分析：按整卷 OCR 文字判断薄弱点、错因与补强建议，不返回题目。
app.post('/api/agent/paper/diagnose', async (req, res) => {
  const text = String(req.body?.text || '').replace(/\r/g, '').trim().slice(0, 16000)
  const grade = String(req.body?.grade || '').slice(0, 12)
  const subject = String(req.body?.subject || '').slice(0, 12)
  const edition = String(req.body?.edition || '').slice(0, 30)
  if (text.length < 20) {
    return ok(res, {
      ...fallbackPaperDiagnosis({ grade, subject, text }),
      summary: '没有识别到足够的试卷文字，请换清晰、完整、正对镜头的照片重试。'
    }, { source: 'validation' })
  }
  try {
    const result = await callDeepSeek({
      messages: [{ role: 'user', content: JSON.stringify({ grade, subject, edition, text }) }],
      systemPrompt: PAPER_DIAGNOSIS_PROMPT,
      useTools: false, jsonMode: true, maxRounds: 1, timeoutMs: 100000
    })
    const parsed = result.success ? extractJson(result.content) : null
    if (!parsed) return ok(res, fallbackPaperDiagnosis({ grade, subject, text }), { source: 'local-fallback', error: result.error || 'empty-model-result' })
    return ok(res, normalizePaperDiagnosis(parsed, { grade, subject }), { source: result.source })
  } catch (error) {
    return ok(res, fallbackPaperDiagnosis({ grade, subject, text }), { source: 'local-fallback', error: error.message })
  }
})

// 错题 AI 分析：上传错题保存前生成知识点标签、错因推测与补强建议；无模型时本地兜底。
app.post('/api/agent/mistake/analyze', async (req, res) => {
  const text = String(req.body?.text || '').replace(/\r/g, '').trim().slice(0, 800)
  const grade = String(req.body?.grade || '').slice(0, 12)
  const subject = String(req.body?.subject || '').slice(0, 12)
  const chapterName = String(req.body?.chapterName || '').slice(0, 40)
  if (text.length < 4) return ok(res, fallbackMistakeAnalysis({ chapterName, text }), { source: 'validation' })
  try {
    const result = await callDeepSeek({
      messages: [{ role: 'user', content: JSON.stringify({ grade, subject, chapterName, text }) }],
      systemPrompt: MISTAKE_ANALYSIS_PROMPT,
      useTools: false, jsonMode: true, maxRounds: 1, timeoutMs: 30000
    })
    const parsed = result.success ? extractJson(result.content) : null
    if (!parsed) return ok(res, fallbackMistakeAnalysis({ chapterName, text }), { source: 'local-fallback', error: result.error || 'empty-model-result' })
    return ok(res, normalizeMistakeAnalysis(parsed, { chapterName, text }), { source: result.source })
  } catch (error) {
    return ok(res, fallbackMistakeAnalysis({ chapterName, text }), { source: 'local-fallback', error: error.message })
  }
})

app.post('/api/agent/plan-sequence', async (req, res) => {
  const plans = Array.isArray(req.body?.plans) ? req.body.plans : []
  const sequence = [...plans].sort((a, b) => (a.sequenceOrder || 0) - (b.sequenceOrder || 0))
  if (sequence.length < 2) return ok(res, { plans: sequence, explanation: '依照课程专题的前置关系排序。' }, { source: 'curriculum-graph' })
  try {
    const result = await callDeepSeek({ messages: [{ role: 'user', content: JSON.stringify({ plans: sequence }) }], systemPrompt: PLAN_SEQUENCE_PROMPT, useTools: false, jsonMode: true, maxRounds: 1 })
    const parsed = result.success ? extractJson(result.content) : null
    if (!Array.isArray(parsed?.order)) return ok(res, { plans: sequence, explanation: '依照课程专题的前置关系排序。' }, { source: 'curriculum-graph' })
    const positions = new Map(parsed.order.map((id, index) => [id, index]))
    const ranked = orderCurriculumPlans(sequence, [...positions.entries()].sort((a, b) => a[1] - b[1]).map(([id]) => id))
    return ok(res, { plans: ranked, explanation: safeFilter(String(parsed.explanation || 'Agent 已结合知识顺序整理专题。')) }, { source: result.source })
  } catch {
    return ok(res, { plans: sequence, explanation: '依照课程专题的前置关系排序。' }, { source: 'curriculum-graph' })
  }
})

// 单条任务替换：只改一个任务的呈现形式，模型不可用时用本地变体兜底。
app.post('/api/agent/plan/replace', async (req, res) => {
  const plan = req.body?.plan || {}
  const profile = req.body?.profile || {}
  if (!plan.name) return ok(res, { needMoreInfo: true, message: '缺少原任务信息。' }, { source: 'validation' })
  const localFallback = () => ok(res, { plan: normalizeReplacedPlan(plan, {}) }, { source: 'local-rules' })
  try {
    const result = await callDeepSeek({
      messages: [{ role: 'user', content: JSON.stringify({ plan, profile }) }],
      systemPrompt: PLAN_REPLACE_PROMPT, useTools: false, jsonMode: true, maxRounds: 1
    })
    const parsed = result.success ? extractJson(result.content) : null
    if (!parsed?.name) return localFallback()
    const replaced = normalizeReplacedPlan(plan, {
      ...parsed,
      name: safeFilter(String(parsed.name)),
      knowledgeTags: Array.isArray(parsed.knowledgeTags) ? parsed.knowledgeTags.map(tag => safeFilter(String(tag))) : undefined,
      reason: parsed.reason ? safeFilter(String(parsed.reason)) : undefined
    })
    return ok(res, { plan: replaced }, { source: result.source })
  } catch {
    return localFallback()
  }
})

// 背诵内容：只负责把原文/词表排成可逐条比对的结构，模型不可用时用本机内置篇目兜底。
// 结果由前端按「学科 + 计划名」缓存，同一篇不会反复请求。
app.post('/api/agent/recite/content', async (req, res) => {
  const subject = String(req.body?.subject || '').slice(0, 12)
  const name = String(req.body?.name || '').slice(0, 60)
  const grade = String(req.body?.grade || '').slice(0, 12)
  const knowledgeTags = Array.isArray(req.body?.knowledgeTags)
    ? req.body.knowledgeTags.slice(0, 6).map(tag => String(tag).slice(0, 20))
    : []
  const kind = req.body?.kind === 'words' ? 'words' : (req.body?.kind === 'text' ? 'text' : (subject === '英语' ? 'words' : 'text'))
  const input = { subject, name, grade, knowledgeTags, kind }
  if (!name) return ok(res, fallbackReciteContent(input), { source: 'validation' })
  try {
    const result = await callDeepSeek({
      messages: [{ role: 'user', content: JSON.stringify(input) }],
      systemPrompt: RECITE_CONTENT_PROMPT,
      useTools: false, jsonMode: true, maxRounds: 1, timeoutMs: 45000
    })
    const parsed = result.success ? extractJson(result.content) : null
    if (!parsed) return ok(res, fallbackReciteContent(input), { source: 'local-fallback', error: result.error || 'empty-model-result' })
    return ok(res, normalizeReciteContent(parsed, input), { source: result.source })
  } catch (error) {
    return ok(res, fallbackReciteContent(input), { source: 'local-fallback', error: error.message })
  }
})

app.post('/api/agent/visual-status', (req, res) => {
  latestVisualStatus = {
    is_present: req.body?.is_present === true,
    continuous_away_seconds: Math.max(0, Number(req.body?.continuous_away_seconds) || 0),
    updatedAt: Date.now()
  }
  return ok(res, { received: true })
})

// 计划骨架：任务结构由本地课程规则直接生成，毫秒级返回，AI 只负责后续润色文案。
app.post('/api/agent/plan/skeleton', (req, res) => {
  const payload = req.body || {}
  if (!payload.grade || !payload.subject || !Array.isArray(payload.chapters) || !payload.chapters.length) {
    return ok(res, { plans: [], explanation: '请先选择年级、科目和至少一个知识专题。' }, { source: 'validation' })
  }
  const adaptive = buildAdaptivePlan({
    grade: payload.grade, subject: payload.subject, edition: payload.edition || '',
    chapters: payload.chapters, masteryByChapter: payload.masteryByChapter || {}, dailyMinutes: payload.dailyMinutes,
    targetScore: payload.targetScore, targetFullScore: payload.targetFullScore, baselineScore: payload.baselineScore
  })
  return ok(res, adaptive, { source: 'local-rules' })
})

// AI 周报：前端聚合近 7 天专注、测试、错题与考试成绩，模型只负责复盘文案。
// 无密钥、超时或模型返回残缺时，一律回落到本地确定性周报，保证按钮永远有结果。
app.post('/api/agent/weekly-report', async (req, res) => {
  const payload = req.body && typeof req.body === 'object' && !Array.isArray(req.body) ? req.body : {}
  const fallback = buildFallbackWeeklyReport(payload)
  // 数字一致性校验：模型写出来的数字必须能在真实数据里找到，否则标出来。
  const withCheck = report => ({ ...report, verification: verifyWeeklyReportNumbers(report, payload) })
  try {
    const result = await callDeepSeek({
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      systemPrompt: WEEKLY_REPORT_PROMPT,
      jsonMode: true, useTools: false, thinking: false, maxRounds: 1, timeoutMs: 45000
    })
    if (!result.success) return ok(res, withCheck(fallback), { source: 'mock', reason: result.reason || 'model-unavailable' })
    return ok(res, withCheck(normalizeWeeklyReport(extractJson(result.content), fallback)), { source: result.source })
  } catch (error) {
    return ok(res, withCheck(fallback), { source: 'mock', error: error.message })
  }
})

app.post('/api/agent/diagnose', async (req, res) => {
  try {
    const payload = req.body || {}
    if (payload.subject && payload.grade && Array.isArray(payload.chapters) && payload.chapters.length) {
      const adaptive = buildAdaptivePlan({
        grade: payload.grade, subject: payload.subject, edition: payload.edition || '',
        chapters: payload.chapters, masteryByChapter: payload.masteryByChapter || {}, dailyMinutes: payload.dailyMinutes,
        targetScore: payload.targetScore, targetFullScore: payload.targetFullScore, baselineScore: payload.baselineScore
      })
      const basePlans = adaptive.plans
      const planPrompt = `你是初中学习规划 Agent。请根据学生信息与基础任务列表优化每项的任务名称、任务说明 reason、建议用时和复习时间 reviewTime；不得改变 plan id、chapterId、chapterIds、subject、sequenceOrder、isBridge，不得删除桥接任务。任务必须循序渐进且符合青少年阅读习惯。返回的 order 只能包含提供的任务 id，按建议学习顺序排列。只返回合法 JSON：{"order":["任务ID"],"plans":[{"id":"原ID","name":"任务名称","subject":"科目","chapterId":"原章节ID或空","estimatedMinutes":25,"priority":"高","reviewTime":毫秒时间戳,"knowledgeTags":["标签"],"status":"active","createdAt":毫秒时间戳,"reason":"安排理由"}],"explanation":"解释专题顺序和复习安排"}`
      const result = await callDeepSeek({
        messages: [{ role: 'user', content: JSON.stringify({ profile: payload, chapters: payload.chapters, assessment: payload.assessment, focusContext: payload.recentFocus, basePlans }) }],
        systemPrompt: planPrompt, context: { recentFocus: payload.recentFocus, visualStatus: latestVisualStatus }, jsonMode: true, timeoutMs: 70000
      })
      const parsed = result.success ? extractJson(result.content) : null
      const generatedById = new Map((Array.isArray(parsed?.plans) ? parsed.plans : []).map(plan => [plan.id, plan]))
      const plans = basePlans.map(base => {
        const generated = generatedById.get(base.id) || {}
        return {
          ...base,
          name: safeFilter(String(generated.name || base.name)),
          estimatedMinutes: Math.max(8, Math.min(40, Number(generated.estimatedMinutes) || base.estimatedMinutes)),
          priority: ['高', '中', '低'].includes(generated.priority) ? generated.priority : base.priority,
          reviewTime: Number(generated.reviewTime) || base.reviewTime,
          reason: safeFilter(String(generated.reason || base.reason))
        }
      })
      const sortedPlans = orderCurriculumPlans(plans, Array.isArray(parsed?.order) ? parsed.order : [])
      return ok(res, {
        plans: sortedPlans,
        explanation: safeFilter(String(parsed?.explanation || adaptive.explanation)),
        radar: Object.entries(payload.masteryByChapter || {}).map(([id, value]) => ({ name: payload.chapters.find(chapter => chapter.id === id)?.name || id, value: Math.round(Number(value) / 3 * 100) })),
        sources: adaptive.sources
      }, { source: result.success ? result.source : 'mock' })
    }
    const required = ['grade', 'subjects', 'weakPoints', 'dailyMinutes', 'targetScore', 'learningStyle']
    const missing = required.filter(key => payload[key] === undefined || payload[key] === null || (typeof payload[key] === 'string' && !payload[key].trim()) || (Array.isArray(payload[key]) && !payload[key].length))
    if (!Array.isArray(payload.subjects) || payload.subjects.some(item => typeof item !== 'string')) missing.push('subjects')
    if (!Number.isFinite(Number(payload.dailyMinutes)) || Number(payload.dailyMinutes) < 15) missing.push('dailyMinutes')
    if (!Number.isFinite(Number(payload.targetScore)) || Number(payload.targetScore) <= 0) missing.push('targetScore')
    if (missing.length) return ok(res, { needMoreInfo: true, missing, question: `为了生成完整计划，还需要补充：${missing.join('、')}` }, { source: 'validation' })
    const rag = executeTool('rag_knowledge_query', { subject: payload.subjects[0], grade: payload.grade, keyword: payload.weakPoints }, { recentFocus: payload.recentFocus })
    const augmented = { ...payload, ragKnowledge: rag }
    const result = await callDeepSeek({ messages: buildPlanPrompt(augmented), systemPrompt: LEARNING_SYSTEM_PROMPT, context: { recentFocus: payload.recentFocus, visualStatus: latestVisualStatus }, jsonMode: true })
    if (!result.success) return ok(res, fallbackPlan(payload), { source: 'mock' })
    return ok(res, normalizePlanOutput(extractJson(result.content), payload), { source: result.source })
  } catch (error) {
    return ok(res, fallbackPlan(req.body), { source: 'mock', error: error.message })
  }
})

app.post('/api/agent/iterate', async (req, res) => {
  const body = req.body || {}
  const localFallback = () => {
    const plan = {
      ...(body.plan || {}), id: body.plan?.id || `plan_${Date.now()}`,
      estimatedMinutes: Math.min(body.plan?.estimatedMinutes || 25, Math.max(15, body.profile?.dailyMinutes || 60)),
      priority: body.feedback?.mastery <= 1 ? '高' : '中',
      reviewTime: Date.now() + (body.feedback?.mastery <= 1 ? 86400000 : 3 * 86400000), status: 'active', createdAt: Date.now()
    }
    return { plans: [plan], explanation: '已根据本次反馈调整任务优先级与复习间隔。' }
  }
  try {
    const result = await callDeepSeek({ messages: [{ role: 'user', content: JSON.stringify({ ...body, visualStatus: latestVisualStatus }) }], systemPrompt: TOOL_AGENT_PROMPT, context: { recentFocus: body.context, visualStatus: body.visualStatus || latestVisualStatus }, jsonMode: true })
    if (!result.success) return ok(res, localFallback(), { source: 'mock' })
    return ok(res, normalizeIterationOutput(extractJson(result.content), body), { source: result.source })
  } catch (error) {
    return ok(res, { ...localFallback(), explanation: '模型暂时不可用，已保存反馈并采用本地自适应规则。' }, { source: 'mock', error: error.message })
  }
})

// 模型不可用时的双模式兜底话术，保证体验与当前模式一致。
const TUTOR_FALLBACK_ANSWER = '先找出题目给出的条件，再把它们和你记得的公式或知识点对应起来。你可以告诉我你卡在第几步。'
const TUTOR_EXPLAIN_FALLBACK = '这道题可以按「考点 → 步骤 → 结论」来拆：先写出已知条件和要求的量，再选对应公式逐步代入，最后检查单位和符号。你把原题发我，我按步骤完整讲一遍。'

app.post('/api/agent/tutor', async (req, res) => {
  try {
    const body = req.body || {}
    // 引导模式只给思路，讲解模式给完整步骤；未知值统一按引导处理。
    const tutorMode = body.mode === 'explain' ? 'explain' : 'guide'
    const rateKey = String(req.ip || 'local')
    const previous = tutorRate.get(rateKey) || 0
    if (Date.now() - previous < 10000) return ok(res, { answer: '我们每隔一会儿再问一个问题，先把刚才的思路消化一下吧。' }, { source: 'rate-limit' })
    tutorRate.set(rateKey, Date.now())
    if (tutorRate.size > 1000) {
      for (const [key, timestamp] of tutorRate) if (Date.now() - timestamp > 60000) tutorRate.delete(key)
    }
    const question = safeFilter(body.question || '')
    if (question !== body.question) return ok(res, { answer: question }, { source: 'safety-filter' })
    const history = Array.isArray(body.history) ? body.history
      .filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string')
      .slice(-12).map(message => ({ role: message.role, content: message.content.slice(0, 4000) })) : []
    let userContent = body.question || ''
    if (body.image) {
      if (typeof body.image !== 'string' || !/^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(body.image) || body.image.length > 6_500_000) {
        return ok(res, { answer: '图片格式或大小暂不支持，请选择 JPG、PNG 或 WebP 图片（压缩后不超过约 4.5 MB）。' }, { source: 'validation' })
      }
      userContent = [
        { type: 'text', text: `${body.question || '请分析图片中的学习内容，并用提示式语言帮助我理解。'}\n\n青少年${tutorMode === 'explain' ? '讲解要求：给出完整步骤和结论，并标注易错点。' : '答疑要求：只引导思路，不给完整题目答案。'}` },
        { type: 'image_url', image_url: { url: body.image, detail: 'high' } }
      ]
    }
    const result = await callDeepSeek({ messages: [...history, { role: 'user', content: userContent }], systemPrompt: tutorSystemPrompt(tutorMode), context: body.context || {}, useTools: false })
    if (!result.success) return ok(res, { answer: tutorMode === 'explain' ? TUTOR_EXPLAIN_FALLBACK : TUTOR_FALLBACK_ANSWER }, { source: 'mock' })
    return ok(res, { answer: guardTutorAnswer(result.content, { mode: tutorMode }) }, { source: result.source })
  } catch (error) {
    const invalidKey = /LLM 401/.test(error.message || '')
    return ok(res, { answer: invalidKey ? 'DeepSeek API key 没有通过验证。请在项目根目录 .env 中填写有效的 DEEPSEEK_API_KEY，保存后重启 npm run dev。' : '模型暂时需要休息一下。你可以先写出已知条件和想用的知识点，稍后我再陪你检查。' }, { source: invalidKey ? 'config-error' : 'mock', error: error.message })
  }
})

// 流式答疑：SSE 逐 token 下发正文，同时把推理与工具调用作为可视化事件推送。
// 无密钥、限流、安全改写等分支统一走据流式降级，保证前端始终收到同一种帧格式。
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

app.post('/api/agent/tutor/stream', async (req, res) => {
  const body = req.body || {}
  const tutorMode = body.mode === 'explain' ? 'explain' : 'guide'
  const rateKey = String(req.ip || 'local')
  const previous = tutorRate.get(rateKey) || 0

  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')
  if (typeof res.flushHeaders === 'function') res.flushHeaders()

  const writeEvent = (event, data) => { if (!res.writableEnded) res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`) }
  const controller = new AbortController()
  res.on('close', () => { if (!res.writableEnded) controller.abort() })

  // 模型不可用时保持同样的逐字体验，避免演示中途变成"整段突然出现"。
  const streamFallback = async (text, source = 'mock') => {
    writeEvent('replace', { content: '' })
    writeEvent('meta', { source, model: 'local-fallback' })
    for (let index = 0; index < text.length; index += 6) {
      if (controller.signal.aborted) return
      writeEvent('token', { delta: text.slice(index, index + 6) })
      await delay(30)
    }
    writeEvent('done', { content: text, source })
  }

  const question = safeFilter(String(body.question || ''))
  if (!question.trim()) { await streamFallback('先告诉我你卡在哪一步，我好陪你一起拆。', 'validation'); return res.end() }
  if (question !== body.question) { await streamFallback(question, 'safety-filter'); return res.end() }
  if (Date.now() - previous < 10000) { await streamFallback('我们每隔一会儿再问一个问题，先把刚才的思路消化一下吧。', 'rate-limit'); return res.end() }
  tutorRate.set(rateKey, Date.now())
  if (tutorRate.size > 1000) {
    for (const [key, timestamp] of tutorRate) if (Date.now() - timestamp > 60000) tutorRate.delete(key)
  }

  const history = Array.isArray(body.history) ? body.history
    .filter(message => ['user', 'assistant'].includes(message?.role) && typeof message.content === 'string')
    .slice(-12).map(message => ({ role: message.role, content: message.content.slice(0, 4000) })) : []

  try {
    writeEvent('meta', { source: 'deepseek', model: process.env.LLM_MODEL_NAME || 'deepseek-flash' })
    let answer = ''
    let trace = []
    for await (const event of streamAgent({
      messages: [...history, { role: 'user', content: body.question }],
      systemPrompt: tutorSystemPrompt(tutorMode),
      context: { recentFocus: body.context?.recentFocus, visualStatus: latestVisualStatus },
      signal: controller.signal
    })) {
      if (event.type === 'fallback') { await streamFallback(tutorMode === 'explain' ? TUTOR_EXPLAIN_FALLBACK : TUTOR_FALLBACK_ANSWER, 'mock'); return res.end() }
      if (event.type === 'thinking') writeEvent('thinking', { delta: event.delta })
      else if (event.type === 'token') { answer += event.delta; writeEvent('token', { delta: event.delta }) }
      else if (event.type === 'tool') writeEvent('tool', { name: event.name, label: event.label, status: event.status, summary: event.summary, citations: event.citations || [] })
      else if (event.type === 'done') { answer = event.content || answer; trace = event.tools || [] }
    }
    const guarded = guardTutorAnswer(answer, { mode: tutorMode })
    // 流式内容已经到达页面，若触发安全改写就下发 replace 覆盖，前端替换而不追加。
    if (guarded !== answer) writeEvent('replace', { content: guarded, reason: 'safety-guard' })
    writeEvent('done', { content: guarded, source: 'deepseek', tools: trace })
    return res.end()
  } catch (error) {
    if (controller.signal.aborted) return res.end()
    console.warn('[tutor-stream]', error?.message || error, error?.cause?.code || error?.cause?.message || '', error?.cause?.cause?.code || '')
    const invalidKey = /LLM 401/.test(error?.message || '')
    await streamFallback(invalidKey ? 'DeepSeek API key 没有通过验证。请在项目根目录 .env 中填写有效的 DEEPSEEK_API_KEY，保存后重启 npm run dev。' : (tutorMode === 'explain' ? TUTOR_EXPLAIN_FALLBACK : TUTOR_FALLBACK_ANSWER), invalidKey ? 'config-error' : 'mock')
    return res.end()
  }
})

// 兜底错误处理：未捕获异常也返回 JSON，避免前端拿到 Express 默认的 HTML 错误页。
app.use((error, _req, res, next) => {
  if (res.headersSent) return next(error)
  console.error('[api-error]', error?.message || error)
  return res.status(500).json({ success: false, message: '本机服务暂时不可用，请稍后重试。' })
})

const port = Number(process.env.PORT || 3001)
app.listen(port, () => console.log(`AI Teach API listening on http://localhost:${port}`))
