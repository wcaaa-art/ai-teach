// 一次性迁移：把历史摸底/章节测试里答错的题回填进错题库，并补算错次与粗心标记。
// 只补信号，不改题目内容；已消灭的错题默认保持消灭，只有「消灭之后又答错」才重新打开。
import { judgeWrongReason } from './mistakeSignals.js'

const OPTION_LETTERS = 'ABCDEFGH'

function optionText(options = [], index) {
  const text = options?.[index]
  return text === undefined ? '' : `${OPTION_LETTERS[index] || index + 1}. ${text}`
}

function hasAnswer(value) {
  if (value === undefined || value === null) return false
  if (Array.isArray(value)) return value.length > 0
  return String(value).trim() !== ''
}

function toChosenIndex(value) {
  if (!hasAnswer(value) || Array.isArray(value)) return null
  const index = Number(value)
  return Number.isInteger(index) && index >= 0 ? index : null
}

// 摸底记录：只取答过且能判分的客观题；主观自评题没有选项，跳过。
function collectAssessmentAttempts(assessments = []) {
  const attempts = []
  for (const assessment of assessments) {
    if (!assessment || !Array.isArray(assessment.questions) || !assessment.questions.length) continue
    const grade = assessment.grade || ''
    const subject = assessment.subject || ''
    const edition = assessment.edition || ''
    const at = Number(assessment.createdAt) || 0
    for (const [index, question] of assessment.questions.entries()) {
      if (!question || question.selfAssessment) continue
      const questionId = question.id || `${question.chapterId || 'q'}-${index}`
      const chosenIndex = toChosenIndex(assessment.answers?.[questionId])
      const correctIndex = Number(question.correctIndex)
      if (chosenIndex === null || !Number.isInteger(correctIndex)) continue
      attempts.push({
        key: `${grade}|${subject}|${questionId}`,
        questionId, grade, subject, edition, at,
        type: question.type || 'single',
        chosenIndex, correctIndex,
        correct: chosenIndex === correctIndex,
        source: 'assessment',
        question
      })
    }
  }
  return attempts
}

// 章节测试记录：未作答不算错题；主观题只有自评后才计入。
function collectQuizAttempts(quizResults = []) {
  const attempts = []
  for (const record of quizResults) {
    if (!record) continue
    const grade = record.grade || ''
    const subject = record.subject || ''
    const edition = record.edition || ''
    const at = Number(record.createdAt) || Number(record.submittedAt) || 0
    const byId = new Map((record.questions || []).filter(item => item?.id).map(item => [item.id, item]))
    for (const row of record.perQuestion || []) {
      const questionId = row?.questionId
      if (!questionId) continue
      const question = byId.get(questionId)
      const key = `${grade}|${subject}|${questionId}`
      if (row.needsSelfGrade) {
        if (row.selfGrade === null || row.selfGrade === undefined) continue
        attempts.push({
          key, questionId, grade, subject, edition, at,
          type: question?.type || 'short',
          chosenIndex: null,
          correctIndex: question ? Number(question.correctIndex) : null,
          correct: Number(row.selfGrade) >= 1,
          source: 'quiz',
          question
        })
        continue
      }
      if (!hasAnswer(record.answers?.[questionId])) continue
      attempts.push({
        key, questionId, grade, subject, edition, at,
        type: question?.type || 'single',
        chosenIndex: toChosenIndex(record.answers?.[questionId]),
        correctIndex: question ? Number(question.correctIndex) : null,
        correct: row.correct === true,
        source: 'quiz',
        question
      })
    }
  }
  return attempts
}

function groupByQuestion(attempts) {
  const map = new Map()
  for (const attempt of attempts) {
    if (!map.has(attempt.key)) map.set(attempt.key, [])
    map.get(attempt.key).push(attempt)
  }
  for (const list of map.values()) list.sort((left, right) => left.at - right.at)
  return map
}

// 纯函数：只算「要新建什么、要更新什么」，方便单测和试运行。
export function planMistakeSignalsMigration({ mistakes = [], assessments = [], quizResults = [], now = Date.now() } = {}) {
  const attemptsByQuestion = groupByQuestion([
    ...collectAssessmentAttempts(assessments),
    ...collectQuizAttempts(quizResults)
  ])
  const existingByQuestion = new Map()
  for (const item of mistakes) {
    if (item?.questionId) existingByQuestion.set(`${item.grade}|${item.subject}|${item.questionId}`, item)
  }

  const creates = []
  const updates = []
  let careless = 0
  let misclick = 0

  for (const [key, attempts] of attemptsByQuestion) {
    const wrongs = attempts.filter(item => item.correct === false)
    if (!wrongs.length) continue
    const existing = existingByQuestion.get(key) || null
    const firstWrong = wrongs[0]
    const lastWrongAt = wrongs[wrongs.length - 1].at
    const redoHistory = existing?.redoHistory || []
    const redoWrong = redoHistory.filter(event => !event.correct).length
    // 历史答错次数优先；错题本里已有的错次和重做答错不能丢，取最大值避免重复计数。
    const wrongCount = Math.max(wrongs.length, Number(existing?.wrongCount) || 0, 1 + redoWrong, 1)
    const priorCorrect = attempts.filter(item => item.correct === true && item.at < firstWrong.at).length
      + redoHistory.filter(event => event.correct && Number(event.at) < firstWrong.at).length
      + (existing?.fixedAt && existing.fixedAt < firstWrong.at ? 1 : 0)
    const slip = wrongCount > 1 ? '' : judgeWrongReason({
      type: firstWrong.type,
      chosenIndex: firstWrong.chosenIndex,
      correctIndex: firstWrong.correctIndex,
      priorCorrect,
      nextWrongCount: wrongCount
    })
    if (slip === 'careless') careless += 1
    else if (slip === 'misclick') misclick += 1

    if (existing) {
      const next = {
        ...existing,
        wrongCount,
        lastWrongAt: Math.max(Number(existing.lastWrongAt) || 0, lastWrongAt),
        slip,
        slipAt: slip ? Number(existing.slipAt) || firstWrong.at : null,
        updatedAt: now
      }
      // 只有消灭之后又答错，才说明没真正掌握，重新打开；更早的历史答错不动已消灭状态。
      if (existing.fixedAt && lastWrongAt > existing.fixedAt) next.fixedAt = null
      const changed = ['wrongCount', 'lastWrongAt', 'slip', 'slipAt', 'fixedAt']
        .some(field => next[field] !== existing[field])
      if (changed) updates.push(next)
      continue
    }

    // 历史里从没进过错题本的题，只从摸底记录补建；章节测试漏录的题不在本次范围。
    const source = wrongs.find(item => item.source === 'assessment')
    if (!source) continue
    const question = source.question || {}
    creates.push({
      id: `mistake-assessment-${source.grade}-${source.subject}-${source.questionId}`,
      grade: source.grade,
      subject: source.subject,
      edition: source.edition,
      chapterId: question.chapterId,
      chapterName: question.chapterName,
      knowledgeTags: question.knowledgeTags || [],
      text: question.stem,
      stem: question.stem,
      type: question.type || 'single',
      options: question.options || [],
      correctIndex: source.correctIndex,
      userAnswer: optionText(question.options, source.chosenIndex) || '未作答',
      correctAnswer: optionText(question.options, source.correctIndex) || '未提供',
      explanation: question.explanation || '',
      source: 'assessment',
      questionId: source.questionId,
      wrongCount,
      lastWrongAt,
      slip,
      slipAt: slip ? lastWrongAt : null,
      redoCount: 0,
      lastRedoAt: null,
      redoHistory: [],
      fixedAt: null,
      createdAt: source.at || lastWrongAt || now,
      updatedAt: now
    })
  }

  return {
    creates,
    updates,
    summary: {
      assessments: assessments.filter(item => Array.isArray(item?.questions) && item.questions.length).length,
      quizResults: quizResults.length,
      mistakes: mistakes.length,
      created: creates.length,
      updated: updates.length,
      careless,
      misclick
    }
  }
}

// 在浏览器里跑：读取当前账号的 IndexedDB，算完写回。dryRun 只预览不落库。
export async function migrateMistakeSignals({ dryRun = false } = {}) {
  // 动态引入：纯规划函数要能在 Node 测试里跑，不能一加载就碰 IndexedDB。
  const { getDataOwner, loadAssessments, loadMistakes, loadQuizResults, saveMistake } = await import('../db/index.js')
  const [mistakes, assessments, quizResults] = await Promise.all([
    loadMistakes(), loadAssessments(), loadQuizResults()
  ])
  const plan = planMistakeSignalsMigration({ mistakes, assessments, quizResults })
  if (!dryRun) {
    for (const record of plan.creates) await saveMistake(record)
    for (const record of plan.updates) await saveMistake(record)
  }
  const result = { ...plan.summary, owner: getDataOwner(), dryRun }
  console.info('[错题信号迁移]', result)
  return result
}
