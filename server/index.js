import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import { buildPlanPrompt, callDeepSeek, extractJson, fallbackPlan, guardTutorAnswer, normalizeIterationOutput, normalizePlanOutput, normalizeReplacedPlan, safeFilter, streamAgent } from './agent.js'
import { createAuthRouter, createAuthService } from './auth.js'
import { executeTool } from './tools.js'
import { ASSESSMENT_SYSTEM_PROMPT, LEARNING_SYSTEM_PROMPT, PLAN_REPLACE_PROMPT, PLAN_SEQUENCE_PROMPT, TOOL_AGENT_PROMPT, TUTOR_SYSTEM_PROMPT } from './prompts.js'
import { buildAdaptivePlan, buildDiagnosticBlueprint, buildFallbackDiagnosticQuestions, listCurriculumChapters, listCurriculumSubjects, orderCurriculumPlans, stampDiagnosticQuestionIds } from './curriculum.js'
import { PAPER_SPECS, buildFallbackQuizQuestions, buildQuizBlueprint, generateQuiz, mapWithLimit } from './quiz.js'
import { resolveTextbookEdition } from './textbooks.js'
import { buildVideoKeyword, buildVideoSearchUrl, fetchVideoPool, pickVideoBatch } from './videos.js'

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
  const stage = req.query.stage === '高中' ? '高中' : '初中'
  return ok(res, listCurriculumSubjects(stage, req.query.grade))
})

app.get('/api/curriculum/chapters', (req, res) => {
  if (!req.query.grade || !req.query.subject) return ok(res, { chapters: [], error: 'missing-grade-or-subject' }, { source: 'validation' })
  return ok(res, listCurriculumChapters(String(req.query.grade), String(req.query.subject), req.query.edition ? String(req.query.edition) : ''))
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
    const items = pickVideoBatch(pool, { excludeBvids, excludeAuthors, reason, edition, chapter, grade, limit })
    return ok(res, { items, fallbackUrl, keyword, poolSize: pool.length }, { source: 'bilibili' })
  } catch {
    // 上游风控或断网时不报错，交给前端展示「去 B 站搜」兜底入口。
    return ok(res, { items: [], fallbackUrl, keyword }, { source: 'fallback', message: '视频检索暂时不可用，可直接去 B 站搜索。' })
  }
})

// 摸底单题请求：一次只要一道题，便于和章节测试一样按题位并发。
async function requestDiagnosticQuestion(slot, { grade, subject, edition, attempt, excludeQuestions }) {
  try {
    const result = await callDeepSeek({
      messages: [{
        role: 'user',
        content: JSON.stringify({
          grade, subject,
          textbookEdition: edition || '',
          chapters: [{ id: slot.chapterId, name: slot.chapterName }],
          blueprint: [{ chapterId: slot.chapterId, chapterName: slot.chapterName, count: 1, dimensions: [slot.dimension] }],
          attempt,
          excludeQuestions
        })
      }],
      systemPrompt: ASSESSMENT_SYSTEM_PROMPT, useTools: false, jsonMode: true, maxRounds: 1, timeoutMs: 25000, thinking: false
    })
    if (!result.success) return null
    const parsed = extractJson(result.content)
    const raw = Array.isArray(parsed?.questions) ? parsed.questions.find(item => item && item.stem) : null
    if (!raw) return null
    const options = Array.isArray(raw.options) ? raw.options.slice(0, 4).map(value => String(value).slice(0, 300)) : []
    const correctIndex = Number(raw.correctIndex)
    if (options.length < 2 || !Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null
    const stem = safeFilter(String(raw.stem || '').slice(0, 1200))
    if (!stem) return null
    return {
      id: String(raw.id || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
      chapterId: slot.chapterId, chapterName: slot.chapterName,
      type: 'single', dimension: String(raw.dimension || slot.dimension || 'concept'),
      stem, options, correctIndex,
      explanation: safeFilter(String(raw.explanation || '').slice(0, 1000)),
      difficulty: Math.max(1, Math.min(3, Number(raw.difficulty) || 1))
    }
  } catch {
    return null
  }
}

app.post('/api/agent/assessment/generate', async (req, res) => {
  const body = req.body || {}
  const chapters = Array.isArray(body.chapters) ? body.chapters.slice(0, 8) : []
  if (!body.grade || !body.subject || !chapters.length) return ok(res, { needMoreInfo: true, message: '请先选择年级、科目和至少一个知识专题。' }, { source: 'validation' })
  const requestedQuestionCount = Number(body.questionCount)
  const questionCount = Number.isFinite(requestedQuestionCount) ? Math.max(1, Math.min(30, Math.round(requestedQuestionCount))) : undefined
  const attempt = Math.max(1, Math.min(6, Math.round(Number(body.attempt) || 1)))
  // 教材版本决定章节范围与命题口径；无法识别的版本回落到该科目默认版本。
  const edition = resolveTextbookEdition(String(body.subject || ''), String(body.edition || '')).edition
  const excludeQuestions = Array.isArray(body.excludeQuestions) ? body.excludeQuestions.slice(-180).map(question => ({ id: String(question?.id || ''), stem: String(question?.stem || '').slice(0, 1200), chapterId: String(question?.chapterId || ''), dimension: String(question?.dimension || '') })) : []
  const blueprint = buildDiagnosticBlueprint(chapters, questionCount)
  const fallback = buildFallbackDiagnosticQuestions({ grade: body.grade, subject: body.subject, chapters, questionCount, attempt, excludeQuestions })

  // 逐题并发：十道题串行要 40–60 秒，按题位并发后墙钟接近最慢的一道。
  // 摸底题量固定（10 题左右），放宽到 10 路并发，让一整轮一次发完。
  // 题量大于维度数时维度循环复用，保证题位数量与蓝图一致。
  const slots = blueprint.blueprint.flatMap(item => Array.from({ length: item.count }, (_, index) => ({
    chapterId: item.chapterId,
    chapterName: item.chapterName,
    dimension: item.dimensions?.[index % (item.dimensions.length || 1)] || 'concept'
  })))
  const answers = await mapWithLimit(slots, Math.min(slots.length, 10), slot => requestDiagnosticQuestion(slot, {
    grade: body.grade, subject: body.subject, edition, attempt, excludeQuestions
  }))

  const stemKey = stem => String(stem || '').replace(/\s+/g, '').trim()
  const excludedStems = new Set(excludeQuestions.map(question => stemKey(question.stem)).filter(Boolean))
  const questions = []
  let modelCount = 0
  slots.forEach((slot, index) => {
    const candidate = answers[index]
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
      grade: body.grade, subject: body.subject, chapters: [chapter], questionCount: 1, attempt,
      excludeQuestions: [...excludeQuestions, ...questions]
    }).questions[0]
    const localKey = stemKey(local?.stem)
    if (!local || !localKey || excludedStems.has(localKey)) return
    excludedStems.add(localKey)
    // 逐题兜底会复用同一批模板 id，补上题位序号避免冲突。
    questions.push({ ...local, id: `${local.id}-${index}` })
  })

  if (!questions.length) return ok(res, fallback, { source: fallback.source, reason: 'no-usable-model-question' })
  // 模型逐题返回的 id 都是 q1，必须按题位重发唯一 id，否则十道题共享一个答案键。
  const stampedQuestions = stampDiagnosticQuestionIds(questions)
  const source = !modelCount ? 'local-fallback' : modelCount >= slots.length ? 'deepseek' : 'deepseek-with-local-fill'
  return ok(res, { questions: stampedQuestions, blueprint, edition }, { source })
})

app.post('/api/quiz/generate', async (req, res) => {
  const body = req.body || {}
  const chapters = Array.isArray(body.chapters) ? body.chapters.filter(item => item && item.id).slice(0, 8) : []
  if (!body.grade || !body.subject || !chapters.length) {
    return ok(res, { needMoreInfo: true, message: '请先选择年级、科目和至少一个章节。' }, { source: 'validation' })
  }
  const mode = body.mode === 'weekly' ? 'weekly' : 'daily'
  const stage = body.stage === '高中' || String(body.grade).startsWith('高') ? '高中' : '初中'
  // 章节测试同样按学生所选教材版本命题，保证与摸底、计划的章节口径一致。
  const edition = resolveTextbookEdition(String(body.subject || ''), String(body.edition || '')).edition
  // 近 7 天的题干摘要由前端从 IndexedDB 读出后带上，服务端只做比对与重生成，不落盘。
  const recentStems = Array.isArray(body.recentStems)
    ? body.recentStems.slice(-120).map(item => ({ stem: String(item?.stem || '').slice(0, 300), hash: String(item?.hash || '') }))
    : []
  try {
    const result = await generateQuiz({
      mode, stage, grade: String(body.grade), subject: String(body.subject),
      chapters, questionCount: body.questionCount, recentStems, attempt: body.attempt, edition
    })
    return ok(res, { ...result, edition }, { source: result.source })
  } catch (error) {
    const blueprint = buildQuizBlueprint({
      mode, stage, grade: String(body.grade), subject: String(body.subject),
      chapters, questionCount: body.questionCount
    })
    const questions = buildFallbackQuizQuestions({ blueprint, seed: Date.now() % 11 })
    return ok(res, { questions, blueprint, paperSpec: PAPER_SPECS[stage], source: 'local-fallback', requested: blueprint.total }, { source: 'local-fallback', error: error.message })
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
      const planPrompt = `你是初高中学习规划 Agent。请根据学生信息与基础任务列表优化每项的任务名称、任务说明 reason、建议用时和复习时间 reviewTime；不得改变 plan id、chapterId、chapterIds、subject、sequenceOrder、isBridge，不得删除桥接任务。任务必须循序渐进且符合青少年阅读习惯。返回的 order 只能包含提供的任务 id，按建议学习顺序排列。只返回合法 JSON：{"order":["任务ID"],"plans":[{"id":"原ID","name":"任务名称","subject":"科目","chapterId":"原章节ID或空","estimatedMinutes":25,"priority":"高","reviewTime":毫秒时间戳,"knowledgeTags":["标签"],"status":"active","createdAt":毫秒时间戳,"reason":"安排理由"}],"explanation":"解释专题顺序和复习安排"}`
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

app.post('/api/agent/tutor', async (req, res) => {
  try {
    const body = req.body || {}
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
        { type: 'text', text: `${body.question || '请分析图片中的学习内容，并用提示式语言帮助我理解。'}\n\n青少年答疑要求：只引导思路，不给完整题目答案。` },
        { type: 'image_url', image_url: { url: body.image, detail: 'high' } }
      ]
    }
    const result = await callDeepSeek({ messages: [...history, { role: 'user', content: userContent }], systemPrompt: TUTOR_SYSTEM_PROMPT, context: body.context || {}, useTools: false })
    if (!result.success) return ok(res, { answer: '先找出题目给出的条件，再把它们和你记得的公式或知识点对应起来。你可以告诉我你卡在第几步。' }, { source: 'mock' })
    return ok(res, { answer: guardTutorAnswer(result.content) }, { source: result.source })
  } catch (error) {
    const invalidKey = /LLM 401/.test(error.message || '')
    return ok(res, { answer: invalidKey ? 'DeepSeek API key 没有通过验证。请在项目根目录 .env 中填写有效的 DEEPSEEK_API_KEY，保存后重启 npm run dev。' : '模型暂时需要休息一下。你可以先写出已知条件和想用的知识点，稍后我再陪你检查。' }, { source: invalidKey ? 'config-error' : 'mock', error: error.message })
  }
})

// 流式答疑：SSE 逐 token 下发正文，同时把推理与工具调用作为可视化事件推送。
// 无密钥、限流、安全改写等分支统一走据流式降级，保证前端始终收到同一种帧格式。
const TUTOR_FALLBACK_ANSWER = '先找出题目给出的条件，再把它们和你记得的公式或知识点对应起来。你可以告诉我你卡在第几步。'
const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

app.post('/api/agent/tutor/stream', async (req, res) => {
  const body = req.body || {}
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
      systemPrompt: TUTOR_SYSTEM_PROMPT,
      context: { recentFocus: body.context?.recentFocus, visualStatus: latestVisualStatus },
      signal: controller.signal
    })) {
      if (event.type === 'fallback') { await streamFallback(TUTOR_FALLBACK_ANSWER, 'mock'); return res.end() }
      if (event.type === 'thinking') writeEvent('thinking', { delta: event.delta })
      else if (event.type === 'token') { answer += event.delta; writeEvent('token', { delta: event.delta }) }
      else if (event.type === 'tool') writeEvent('tool', { name: event.name, label: event.label, status: event.status, summary: event.summary })
      else if (event.type === 'done') { answer = event.content || answer; trace = event.tools || [] }
    }
    const guarded = guardTutorAnswer(answer)
    // 流式内容已经到达页面，若触发安全改写就下发 replace 覆盖，前端替换而不追加。
    if (guarded !== answer) writeEvent('replace', { content: guarded, reason: 'safety-guard' })
    writeEvent('done', { content: guarded, source: 'deepseek', tools: trace })
    return res.end()
  } catch (error) {
    if (controller.signal.aborted) return res.end()
    console.warn('[tutor-stream]', error?.message || error, error?.cause?.code || error?.cause?.message || '', error?.cause?.cause?.code || '')
    const invalidKey = /LLM 401/.test(error?.message || '')
    await streamFallback(invalidKey ? 'DeepSeek API key 没有通过验证。请在项目根目录 .env 中填写有效的 DEEPSEEK_API_KEY，保存后重启 npm run dev。' : TUTOR_FALLBACK_ANSWER, invalidKey ? 'config-error' : 'mock')
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
