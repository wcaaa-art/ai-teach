// 章节题库：离线脚本按「年级/科目/教材版本/章节」生成 JSON，随项目一起分发。
// 服务端优先从题库池抽题，池里没有的位置再走模型，其他电脑拿到题库文件也能直接做题。
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const BANK_DIR = fileURLToPath(new URL('./data/question-bank/', import.meta.url))
// 章节测试的填空/解答题单独一个池：单选题池来自摸底口径，这里只放模型出的主观题。
const QUIZ_BANK_DIR = fileURLToPath(new URL('./data/quiz-bank/', import.meta.url))

let cachedIndex = null
let cachedQuizIndex = null

function normalizeStem(stem) {
  return String(stem || '').replace(/\s+/g, '').trim()
}

// 只有题干、选项、答案都完整的客观题才能进池，避免把自评题或半截题发给学生。
export function isValidBankQuestion(question = {}) {
  return Boolean(
    String(question.stem || '').trim() &&
    Array.isArray(question.options) && question.options.length >= 2 &&
    Number.isInteger(Number(question.correctIndex)) &&
    Number(question.correctIndex) >= 0 && Number(question.correctIndex) < question.options.length &&
    String(question.explanation || '').trim()
  )
}

export function createQuestionBankIndex(records = []) {
  const index = new Map()
  for (const record of records) {
    const chapterId = String(record?.chapter?.id || '')
    if (!chapterId) continue
    const questions = (Array.isArray(record.questions) ? record.questions : []).filter(isValidBankQuestion)
    if (!questions.length) continue
    const key = [record.grade, record.subject, record.edition || '', chapterId].join('|')
    index.set(key, { ...record, questions })
  }
  return index
}

function walkJsonFiles(dir, visit) {
  if (!existsSync(dir)) return
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) walkJsonFiles(fullPath, visit)
    else if (entry.name.endsWith('.json')) visit(fullPath)
  }
}

export function loadQuestionBank({ force = false } = {}) {
  if (cachedIndex && !force) return cachedIndex
  const records = []
  walkJsonFiles(BANK_DIR, file => {
    try {
      records.push(JSON.parse(readFileSync(file, 'utf8')))
    } catch {
      // 单个题库文件损坏不影响其他章节，脚本重跑时会把该章节补齐。
    }
  })
  cachedIndex = createQuestionBankIndex(records)
  return cachedIndex
}

export function clearQuestionBankCache() {
  cachedIndex = null
}

export function bankStats() {
  const index = loadQuestionBank()
  const chapters = index.size
  const questions = [...index.values()].reduce((sum, record) => sum + record.questions.length, 0)
  const editions = new Set([...index.values()].map(record => `${record.subject}|${record.edition || ''}`))
  return { chapters, questions, subjectEditions: editions.size, dir: BANK_DIR }
}

// 按题位抽题：优先同维度，其次同章节任意维度；同一道题不会在一套卷里用两次。
export function pickBankQuestions({ grade, subject, edition = '', slots = [], excludeStems = [], index } = {}) {
  const bank = index || loadQuestionBank()
  const used = new Set()
  const excluded = new Set(excludeStems.map(normalizeStem).filter(Boolean))
  return slots.map(slot => {
    const record = bank.get([grade, subject, edition || '', slot.chapterId].join('|'))
      || bank.get([grade, subject, '', slot.chapterId].join('|'))
    if (!record) return null
    const available = record.questions.filter(question => {
      const key = `${question.id || ''}|${normalizeStem(question.stem)}`
      return !used.has(key) && !excluded.has(normalizeStem(question.stem))
    })
    const question = available.find(item => (item.dimension || 'concept') === slot.dimension) || available[0]
    if (!question) return null
    used.add(`${question.id || ''}|${normalizeStem(question.stem)}`)
    excluded.add(normalizeStem(question.stem))
    // 题库题的 id 只在单章节内唯一，这里带上章节前缀避免跨章节撞 id。
    return { ...question, id: `${slot.chapterId}-${question.id || normalizeStem(question.stem).slice(0, 12)}` }
  })
}

// 填空/解答题校验：题干、答案、解析齐全才进池，避免空答案题发给学生。
export function isValidQuizBankQuestion(question = {}) {
  const type = String(question.type || '')
  const answer = type === 'fill' ? question.answer : type === 'short' ? question.referenceAnswer : ''
  return Boolean(
    String(question.stem || '').trim() &&
    String(answer || '').trim() &&
    String(question.explanation || '').trim()
  )
}

export function createQuizBankIndex(records = []) {
  const index = new Map()
  for (const record of records) {
    const chapterId = String(record?.chapter?.id || '')
    if (!chapterId) continue
    const questions = (Array.isArray(record.questions) ? record.questions : [])
      .filter(question => ['fill', 'short'].includes(question?.type) && isValidQuizBankQuestion(question))
    if (!questions.length) continue
    const key = [record.grade, record.subject, record.edition || '', chapterId].join('|')
    index.set(key, { ...record, questions })
  }
  return index
}

export function loadQuizBank({ force = false } = {}) {
  if (cachedQuizIndex && !force) return cachedQuizIndex
  const records = []
  walkJsonFiles(QUIZ_BANK_DIR, file => {
    try {
      records.push(JSON.parse(readFileSync(file, 'utf8')))
    } catch {
      // 单个主观题文件损坏不影响其他章节，脚本重跑时会补齐。
    }
  })
  cachedQuizIndex = createQuizBankIndex(records)
  return cachedQuizIndex
}

export function clearQuizBankCache() {
  cachedQuizIndex = null
}

// 主观题按题型抽题：填空位只配填空、解答位只配解答，同一套卷不重复。
export function pickQuizBankQuestions({ grade, subject, edition = '', slots = [], excludeStems = [], index } = {}) {
  const bank = index || loadQuizBank()
  const used = new Set()
  const excluded = new Set(excludeStems.map(normalizeStem).filter(Boolean))
  return slots.map(slot => {
    const record = bank.get([grade, subject, edition || '', slot.chapterId].join('|'))
      || bank.get([grade, subject, '', slot.chapterId].join('|'))
    if (!record) return null
    const available = record.questions.filter(question => {
      const key = `${question.id || ''}|${normalizeStem(question.stem)}`
      return question.type === slot.type && !used.has(key) && !excluded.has(normalizeStem(question.stem))
    })
    const question = available[0]
    if (!question) return null
    used.add(`${question.id || ''}|${normalizeStem(question.stem)}`)
    excluded.add(normalizeStem(question.stem))
    return { ...question, id: `${slot.chapterId}-${question.id || normalizeStem(question.stem).slice(0, 12)}` }
  })
}
