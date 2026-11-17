// 把摸底里答错的客观题转成错题本记录：与章节测试按题目合并，避免同一道题出现两条。
import { correctBeforeFromRecord, judgeWrongReason, priorCorrectTimes, wrongTimesOf } from './mistakeSignals.js'

const OPTION_LETTERS = 'ABCDEFGH'

function optionText(question, index) {
  const text = question?.options?.[index]
  return text === undefined ? '' : `${OPTION_LETTERS[index] || index + 1}. ${text}`
}

export function buildAssessmentMistakes({
  review = [], grade = '', subject = '', edition = '', existing = [],
  quizResults = [], assessments = [], excludeAssessmentId = '', now = Date.now()
} = {}) {
  const wrongRows = review.filter(item => item && !item.selfAssessment && item.chosenIndex !== null && item.isCorrect === false)
  if (!wrongRows.length) return []
  const byQuestion = new Map(existing
    .filter(item => item?.questionId)
    .map(item => [`${item.grade}|${item.subject}|${item.questionId}`, item]))
  return wrongRows.map((question, index) => {
    const questionId = question.id || `${question.chapterId || 'q'}-${index}`
    const previous = byQuestion.get(`${grade}|${subject}|${questionId}`) || null
    const correctIndex = Number(question.correctIndex)
    const nextWrongCount = wrongTimesOf(previous) + 1
    const priorCorrect = correctBeforeFromRecord(previous) + priorCorrectTimes({
      questionId, quizResults, assessments, excludeAssessmentId
    })
    const slip = judgeWrongReason({
      type: 'single',
      chosenIndex: Number(question.chosenIndex),
      correctIndex,
      priorCorrect,
      nextWrongCount
    })
    return {
      ...(previous || {}),
      id: previous?.id || `mistake-assessment-${grade}-${subject}-${questionId}`,
      grade,
      subject,
      edition,
      chapterId: question.chapterId,
      chapterName: question.chapterName,
      knowledgeTags: question.knowledgeTags || previous?.knowledgeTags || [],
      text: question.stem,
      stem: question.stem,
      type: question.type || 'single',
      options: question.options || [],
      correctIndex: Number.isInteger(correctIndex) ? correctIndex : -1,
      userAnswer: optionText(question, question.chosenIndex) || '未作答',
      correctAnswer: optionText(question, correctIndex) || '未提供',
      explanation: question.explanation || '',
      source: previous?.source || 'assessment',
      questionId,
      wrongCount: nextWrongCount,
      lastWrongAt: now,
      slip,
      slipAt: slip ? now : null,
      redoCount: previous?.redoCount || 0,
      lastRedoAt: previous?.lastRedoAt || null,
      redoHistory: previous?.redoHistory || [],
      // 摸底又答错：之前已消灭的错题重新打开，回到待消灭队列。
      fixedAt: null,
      createdAt: previous?.createdAt || now,
      updatedAt: now
    }
  })
}
