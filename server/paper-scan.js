// 试卷拍照识别的文本结构化：把 OCR 出来的整页文字拆成可练习的题目。
// OCR 由前端本地完成，这里只负责用模型拆分题型、补选项与答案；模型不可用时退回本地按题号拆。
import { stemHash } from '../src/utils/quiz.js'

export const PAPER_PARSE_SYSTEM_PROMPT = `你是初中试卷结构化助手。输入是试卷照片 OCR 得到的文字，可能有错字、串行、公式符号丢失。
请严格按以下规则处理：
1. 按原题号拆题，跨行内容合并成一道题；不要把两道题合成一题，也不要丢掉小题。
2. 题型只能是 single（单选）、fill（填空）、short（解答/计算/简答）。
3. 单选必须给出 options 字符串数组和 correctIndex（0 开始的下标）；能确定答案时再给 answer 字母。
4. 填空和解答给出 answer 参考答案；没有把握就留空，不要编造答案或解析。
5. 去掉页眉、页脚、班级姓名、考试时间、分值说明等非题目内容。
6. 保留题干里的数学符号与空格，不要改写题意。
只返回合法 JSON，不要 Markdown 代码块：
{"title":"试卷标题","questions":[{"type":"single","stem":"题干","options":["选项A内容","选项B内容","选项C内容","选项D内容"],"correctIndex":0,"answer":"A","explanation":"解析","score":3},{"type":"fill","stem":"题干","answer":"参考答案","explanation":"解析","score":3},{"type":"short","stem":"题干","answer":"参考步骤","explanation":"解析","score":6}]}`

const TYPE_ALIASES = {
  single: 'single', choice: 'single', radio: 'single',
  单选: 'single', 选择题: 'single', 单项选择: 'single',
  fill: 'fill', blank: 'fill', 填空: 'fill', 填空题: 'fill',
  short: 'short', answer: 'short', essay: 'short', 解答: 'short', 解答题: 'short', 简答: 'short', 计算: 'short'
}

function normalizeType(value) {
  return TYPE_ALIASES[String(value || '').trim().toLowerCase()] || 'short'
}

function clampScore(value, fallback) {
  const score = Number(value)
  if (!Number.isFinite(score) || score <= 0) return fallback
  return Math.round(Math.min(30, score) * 10) / 10
}

function normalizeOptions(value) {
  if (!Array.isArray(value)) return []
  return value
    .map(item => String(item ?? '').replace(/^\s*[A-D][.、．]\s*/i, '').trim())
    .filter(Boolean)
    .slice(0, 6)
}

// 模型可能把 correctIndex 写成字母、数字字符串或从 1 开始的下标，这里统一成 0 基。
function resolveCorrectIndex(raw, options, answer) {
  const direct = Number(raw)
  if (Number.isInteger(direct) && direct >= 0 && direct < options.length) return direct
  if (Number.isInteger(direct) && direct >= 1 && direct <= options.length) return direct - 1
  const letter = String(raw ?? answer ?? '').trim().match(/^[A-D]/i)
  if (letter) {
    const index = letter[0].toUpperCase().charCodeAt(0) - 65
    return index >= 0 && index < options.length ? index : -1
  }
  return -1
}

function cleanStem(value) {
  return String(value ?? '')
    .replace(/^\s*(?:\d{1,2}\s*[.、．]|[（(]\d{1,2}[）)])\s*/, '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function optionsAsText(options) {
  return options.map((option, index) => `${String.fromCharCode(65 + index)}. ${option}`).join('\n')
}

// 把模型返回的题目清洗成前端可直接判分的结构；答案不确定的题改成自评题，避免误判。
export function normalizePaperQuestions(rawQuestions = [], { grade = '', subject = '' } = {}) {
  const questions = []
  const seen = new Set()
  for (const raw of Array.isArray(rawQuestions) ? rawQuestions : []) {
    if (!raw || typeof raw !== 'object') continue
    let stem = cleanStem(raw.stem ?? raw.question ?? raw.text)
    if (stem.length < 4) continue
    let type = normalizeType(raw.type)
    let options = normalizeOptions(raw.options)
    let answer = String(raw.answer ?? raw.correctAnswer ?? '').trim()
    const explanation = String(raw.explanation ?? raw.analysis ?? '').trim()
    let correctIndex = -1
    if (type === 'single') {
      correctIndex = resolveCorrectIndex(raw.correctIndex ?? raw.correct_index, options, answer)
      // 单选缺选项或缺答案时转成自评题，保留选项文本，避免练习时永远判错。
      if (options.length < 2 || correctIndex < 0) {
        if (options.length >= 2) stem = `${stem}\n${optionsAsText(options)}`
        type = 'short'
        options = []
      }
    }
    if (type === 'fill' && !answer && !Array.isArray(raw.acceptableAnswers)) type = 'short'
    const fingerprint = stemHash(stem)
    if (seen.has(fingerprint)) continue
    seen.add(fingerprint)
    questions.push({
      id: `scan-${fingerprint}`,
      type,
      stem,
      options,
      correctIndex,
      correctIndexes: type === 'single' ? [correctIndex] : [],
      answer: type === 'single' && answer ? answer : (answer || ''),
      acceptableAnswers: Array.isArray(raw.acceptableAnswers)
        ? raw.acceptableAnswers.map(item => String(item)).filter(Boolean).slice(0, 6)
        : [],
      explanation,
      score: clampScore(raw.score, type === 'single' ? 3 : type === 'fill' ? 3 : 6),
      chapterId: 'scan',
      chapterName: '试卷识别',
      answerMissing: !answer && correctIndex < 0,
      grade,
      subject
    })
    if (questions.length >= 60) break
  }
  return { title: `${grade || ''}${subject || ''}试卷`, questions }
}

function splitInlineOptions(block) {
  const found = [...block.matchAll(/(?:^|\s)([A-D])[.、．]\s*/g)]
  if (found.length < 3) return { stem: block, options: [] }
  const first = found[0]
  const stem = block.slice(0, first.index).trim()
  const options = found.map((match, index) => {
    const start = match.index + match[0].length
    const end = index + 1 < found.length ? found[index + 1].index : block.length
    return block.slice(start, end).trim()
  }).filter(Boolean)
  return { stem, options }
}

// 模型不可用时的兜底：按常见题号切块，能认出答案就出客观题，否则出可自评的解答题。
export function fallbackPaperQuestions(text = '', { grade = '', subject = '' } = {}) {
  const cleaned = String(text || '').replace(/\r/g, '').replace(/\n{3,}/g, '\n\n').trim()
  if (cleaned.length < 20) return { title: `${grade}${subject}试卷`, questions: [] }
  let blocks = cleaned.split(/\n(?=\s*(?:\d{1,2}\s*[.、．]|[（(]\d{1,2}[）)]|[一二三四五六七八九十]{1,2}\s*[、.．]))/)
    .map(item => item.trim())
    .filter(item => item.length >= 6)
  if (blocks.length < 2) blocks = cleaned.split(/\n{2,}/).map(item => item.trim()).filter(item => item.length >= 6)
  const rawQuestions = blocks.map(block => {
    const answerMatch = block.match(/答案[：:]\s*([^\n]{1,80})/)
    const analysisMatch = block.match(/解析[：:]\s*([\s\S]{1,500})/)
    const answer = answerMatch ? answerMatch[1].trim() : ''
    const explanation = analysisMatch ? analysisMatch[1].trim() : ''
    const body = block
      .replace(/答案[：:][^\n]*/g, '')
      .replace(/解析[：:][\s\S]*$/g, '')
      .trim()
    const { stem, options } = splitInlineOptions(body)
    const hasBlank = /_{3,}|（\s*）|\(\s*\)/.test(stem)
    let type = 'short'
    if (options.length >= 2 && /^[A-D]$/i.test(answer)) type = 'single'
    else if (hasBlank && answer) type = 'fill'
    const finalStem = type === 'short' && options.length >= 2 ? `${stem}\n${optionsAsText(options)}` : stem
    return {
      type,
      stem: finalStem,
      options: type === 'single' ? options : [],
      correctIndex: type === 'single' ? resolveCorrectIndex('', options, answer) : -1,
      answer,
      explanation,
      score: type === 'single' ? 3 : type === 'fill' ? 3 : 6
    }
  })
  const normalized = normalizePaperQuestions(rawQuestions, { grade, subject })
  if (!normalized.questions.length && cleaned.length >= 20) {
    normalized.questions = normalizePaperQuestions([{ type: 'short', stem: cleaned.slice(0, 1200), answer: '', score: 6 }], { grade, subject }).questions
  }
  normalized.title = `${grade || ''}${subject || ''}试卷（本地拆分）`
  return normalized
}
