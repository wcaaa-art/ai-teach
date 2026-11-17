// 学习计划「练习/做题」类任务的纯本地出题：只走离线题库，不调模型。
// 点击计划要求秒出题，所以这里绝不调用 callDeepSeek——题库命中就抽题，
// 题库没命中就用本地兜底（buildFallbackQuizQuestions，也是本地生成），
// 保证「点了就有题做、且够快」。
import { searchCurriculum, listCurriculumChapters } from './curriculum.js'
import { pickBankQuestions, pickQuizBankQuestions } from './question-bank.js'
import { buildFallbackQuizQuestions } from './quiz.js'
import { resolveTextbookEdition } from './textbooks.js'

// 从计划名里读出题量：如「一元二次方程 · 8 道练习」「浮力练习 4 道」。
// 读不到就用默认值。数字太大/太小都夹到合理区间。
function parseQuestionCount(name) {
  const match = String(name || '').match(/(\d{1,2})\s*道/)
  if (!match) return 5
  return Math.max(3, Math.min(12, Number(match[1])))
}

// 从计划名里剥掉「N 道练习」「N 道」这类量词，留下干净的知识点关键词，
// 用来匹配课程章节。例如「一元二次方程 · 8 道练习」→「一元二次方程」。
function extractTopic(name) {
  return String(name || '')
    .replace(/\s*·?\s*\d{1,2}\s*道\s*(练习|复习|巩固|训练)?\s*$/, '')
    .replace(/[·、。，,]/g, ' ')
    .trim()
}

// 按计划名匹配章节：先用 searchCurriculum 按关键词打分，取最高分章节；
// 匹配不到再用「科目默认章节」兜底（拿该年级科目的第一章）。
function resolveChapter({ grade, subject, name }) {
  const topic = extractTopic(name)
  const searched = searchCurriculum({ subject, grade, keyword: topic })
  const hit = searched.matches?.[0]
  if (hit) return { id: hit.id, name: hit.name }
  // 兜底：取该年级科目的第一个章节，保证一定有题可出。
  const chapters = listCurriculumChapters(grade, subject, '').chapters || []
  return chapters[0] ? { id: chapters[0].id, name: chapters[0].name } : null
}

/**
 * 纯本地出题：按计划名匹配章节，从离线题库抽题，题库不够用本地兜底补齐。
 * @returns {{ questions: Array, chapter: {id,name}, source: string, requested: number }}
 */
export function generatePractice({ grade, subject, name, questionCount, recentStems = [] } = {}) {
  const count = Number(questionCount) > 0 ? Number(questionCount) : parseQuestionCount(name)
  const chapter = resolveChapter({ grade, subject, name })
  if (!chapter) return { questions: [], chapter: null, source: 'no-chapter', requested: count }

  const chapters = [chapter]
  const edition = resolveTextbookEdition(subject, '').edition
  // 练习计划要严格按计划名里的题量出题，不走章节测试的 5~8 题钳制。
  // 题型配比：单选为主，穿插少量填空/解答，模拟真实练习。
  const PATTERN = ['single', 'single', 'fill', 'single', 'single', 'short', 'single', 'fill', 'single', 'single', 'short']
  const types = Array.from({ length: count }, (_, i) => PATTERN[i % PATTERN.length])
  const scoreFor = type => (type === 'single' ? 3 : type === 'fill' ? 3 : 10)
  const blueprint = {
    mode: 'daily', stage: '初中', grade, subject,
    total: count, requested: count,
    items: [{ chapterId: chapter.id, chapterName: chapter.name, count, types, scores: types.map(scoreFor) }]
  }

  const excluded = new Set((Array.isArray(recentStems) ? recentStems : []).map(item => String(item?.hash || '').slice(0, 40)).filter(Boolean))
  const excludeStems = (Array.isArray(recentStems) ? recentStems : []).map(item => String(item?.stem || '').slice(0, 220)).filter(Boolean)

  // 拆题位：客观题位走 pickBankQuestions，主观题位走 pickQuizBankQuestions。
  const slots = blueprint.items.flatMap(item => (item.types || []).map((type, typeIndex) => ({
    chapterId: item.chapterId, chapterName: item.chapterName, type, score: item.scores?.[typeIndex]
  })))
  const objectiveSlots = slots.map((slot, index) => ({ ...slot, index })).filter(slot => slot.type === 'single')
  const subjectiveSlots = slots.map((slot, index) => ({ ...slot, index })).filter(slot => slot.type !== 'single')

  const objectivePicks = pickBankQuestions({ grade, subject, edition, slots: objectiveSlots, excludeStems, index: undefined })
  const subjectivePicks = pickQuizBankQuestions({ grade, subject, edition, slots: subjectiveSlots, excludeStems, index: undefined })

  // 合并：按原题位顺序还原。
  const pickedByIndex = new Map()
  objectiveSlots.forEach((slot, i) => { if (objectivePicks[i]) pickedByIndex.set(slot.index, { ...objectivePicks[i], type: 'single' }) })
  subjectiveSlots.forEach((slot, i) => { if (subjectivePicks[i]) pickedByIndex.set(slot.index, { ...subjectivePicks[i], type: slot.type }) })

  const stamp = Date.now().toString(36)
  const questions = []
  let bankCount = 0
  slots.forEach((slot, index) => {
    const bankQuestion = pickedByIndex.get(index)
    if (bankQuestion) {
      bankCount += 1
      questions.push({
        ...bankQuestion,
        chapterId: slot.chapterId,
        chapterName: slot.chapterName,
        id: `practice-${stamp}-${index + 1}`,
        score: Number(slot.score) || bankQuestion.score || (slot.type === 'single' ? 3 : 10),
        origin: 'bank'
      })
      return
    }
    // 该题位没命中题库：本地兜底补一题（不调模型）。
    const fallback = buildFallbackQuizQuestions({
      blueprint: { ...blueprint, items: [{ chapterId: slot.chapterId, chapterName: slot.chapterName, count: 1, types: [slot.type], scores: [slot.score] }] },
      excluded,
      seed: Math.max(0, (Date.now() % 11))
    })[0]
    if (!fallback) return
    excluded.add(String(fallback.id || ''))
    questions.push({ ...fallback, chapterId: slot.chapterId, chapterName: slot.chapterName, id: `practice-${stamp}-${index + 1}`, score: Number(slot.score) || fallback.score || (slot.type === 'single' ? 3 : 10), origin: 'local' })
  })

  const source = bankCount === questions.length ? 'question-bank'
    : bankCount ? 'question-bank-partial' : 'local-fallback'
  return { questions, chapter, source, requested: count }
}
