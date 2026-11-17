// 直连模型出题：不经过本地 HTTP 接口，供离线题库脚本直接调用并落盘。
// 与网页接口共用同一套提示词、超时与校验口径，保证题库题和在线出题一致。
import 'dotenv/config'
import { callDeepSeek, extractJson, safeFilter } from './agent.js'
import { ASSESSMENT_SYSTEM_PROMPT } from './prompts.js'
import { buildDiagnosticBlueprint } from './curriculum.js'
import { mapWithLimit } from './quiz.js'
import { formatCitation, isRagReady, searchPassages } from './rag/index.js'

// 教材与真题片段只用来校准考点、术语和难度，提示词里明确禁止照抄原题。
export function diagnosticReferences(slot, grade, subject) {
  if (!isRagReady()) return []
  try {
    return searchPassages({ query: `${subject} ${slot.chapterName} ${slot.dimension}`, subject, grade, topK: 2, minScore: 6 })
      .map(item => ({ source: item.citation || formatCitation(), excerpt: String(item.text || '').slice(0, 240) }))
  } catch {
    return []
  }
}

// 摸底单题请求：一次只要一道题，便于和章节测试一样按题位并发。
export async function requestDiagnosticQuestion(slot, { grade, subject, edition, attempt, excludeQuestions }) {
  try {
    const result = await callDeepSeek({
      messages: [{
        role: 'user',
        content: JSON.stringify({
          grade, subject,
          textbookEdition: edition || '',
          chapters: [{ id: slot.chapterId, name: slot.chapterName }],
          blueprint: [{ chapterId: slot.chapterId, chapterName: slot.chapterName, count: 1, dimensions: [slot.dimension] }],
          references: diagnosticReferences(slot, grade, subject),
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

// 摸底批量直连出题：按蓝图题位并发请求，一次补满一个章节。
export async function generateDiagnosticQuestionsDirect({ grade, subject, edition = '', chapter, count = 10, attempt = 1, excludeStems = [] } = {}) {
  if (!grade || !subject || !chapter?.id) return []
  const { blueprint } = buildDiagnosticBlueprint([{ id: chapter.id, name: chapter.name }], count)
  const slots = blueprint.flatMap(item => Array.from({ length: item.count }, (_, index) => ({
    chapterId: item.chapterId,
    chapterName: item.chapterName,
    dimension: item.dimensions?.[index % Math.max(1, item.dimensions?.length || 1)] || 'concept'
  })))
  const excludeQuestions = excludeStems.map(stem => ({ stem }))
  const questions = await mapWithLimit(slots, Math.min(slots.length, 10), slot => requestDiagnosticQuestion(slot, {
    grade, subject, edition, attempt, excludeQuestions
  }))
  return questions.filter(Boolean)
}
