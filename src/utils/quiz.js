// 章节测试的纯函数：题干归一化指纹、客观题判分、专注时长建议、周测时间窗口。
// 同时被前端视图与 server/quiz.js 引用，因此不能依赖浏览器 API。

export const QUIZ_MODE_LIMITS = {
  daily: { min: 5, max: 8, default: 6, label: '日常测试' },
  weekly: { min: 10, max: 15, default: 12, label: '周测' },
  // 综合整卷题量固定，按中考常见卷型配 25 题；建议用时 90 分钟。
  paper: { min: 25, max: 25, default: 25, label: '综合整卷' },
  // 扫描试卷练习由识别结果决定题量，不走上限校验。
  scan: { min: 1, max: 60, default: 25, label: '扫描试卷' }
}

// 综合整卷规格：数学、英语按 120 分，其余科目 100 分；25 题、建议 90 分钟。
// 题型数量与分值由服务端按此规格拆分，前端只负责展示，避免两边口径不一致。
export const PAPER_SPEC = {
  durationMinutes: 90,
  questionCount: 25,
  fullScoreFor: subject => ['数学', '英语'].includes(subject) ? 120 : 100,
  sectionCounts: { single: 10, fill: 6, short: 9 }
}

// 全角字符转半角，便于同一道题在不同输入法下得到相同指纹。
function toHalfWidth(text = '') {
  return String(text).replace(/[\uFF01-\uFF5E]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xFEE0)).replace(/\u3000/g, ' ')
}

// 题干归一化：去掉空白与标点、统一小写，仅保留文字与数字。
export function normalizeStem(value = '') {
  return toHalfWidth(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、；：？！""''（）【】《》,.;:?!"'()\[\]<>]/g, '')
}

// FNV-1a 32 位哈希，附加长度降低碰撞概率；不需要加密强度。
export function stemHash(value = '') {
  const text = normalizeStem(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return `q${hash.toString(36)}${text.length}`
}

// 填空题答案归一化：保留小数点、负号、斜杠等数学符号，其余标点与空白去掉。
export function normalizeAnswer(value = '') {
  return toHalfWidth(value)
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[，。、；：？！""''（）【】《》,;:?!"'()\[\]<>]/g, '')
}

function roundScore(value) {
  return Math.round((Number(value) || 0) * 10) / 10
}

function toIndexList(value) {
  if (!Array.isArray(value)) return []
  return [...new Set(value.map(item => Number(item)).filter(item => Number.isInteger(item) && item >= 0))]
}

// 判定单道客观题；主观题（short/解答题）返回 needsSelfGrade，由学生自评。
export function gradeQuestion(question = {}, answer) {
  const maxScore = Number(question.score) || 0
  if (question.type === 'single') {
    const chosen = Number(answer)
    const correct = Number.isInteger(chosen) && chosen === Number(question.correctIndex)
    return { correct, earned: correct ? maxScore : 0, maxScore, needsSelfGrade: false }
  }
  if (question.type === 'multiple') {
    const selected = toIndexList(answer)
    const correctSet = toIndexList(question.correctIndexes)
    if (!selected.length || !correctSet.length) return { correct: false, earned: 0, maxScore, needsSelfGrade: false }
    // 错选一个即 0 分；少选按选对项比例给部分分。
    if (selected.some(index => !correctSet.includes(index))) return { correct: false, earned: 0, maxScore, needsSelfGrade: false }
    if (selected.length === correctSet.length) return { correct: true, earned: maxScore, maxScore, needsSelfGrade: false }
    return { correct: false, earned: roundScore(maxScore * selected.length / correctSet.length), maxScore, needsSelfGrade: false, partial: true }
  }
  if (question.type === 'fill') {
    const expected = [question.answer, ...(Array.isArray(question.acceptableAnswers) ? question.acceptableAnswers : [])].filter(Boolean)
    const given = normalizeAnswer(answer)
    const givenCompact = normalizeStem(answer)
    if (!given || !givenCompact || !expected.length) return { correct: false, earned: 0, maxScore, needsSelfGrade: false }
    const matched = expected.some(item => {
      const target = normalizeAnswer(item)
      const targetCompact = normalizeStem(item)
      if (given === target || givenCompact === targetCompact) return true
      const givenNumber = Number(given)
      const targetNumber = Number(target)
      // 数值答案容忍 5.0 与 5 之类的写法差异。
      return Number.isFinite(givenNumber) && Number.isFinite(targetNumber) && Math.abs(givenNumber - targetNumber) <= 1e-6 * Math.max(1, Math.abs(targetNumber))
    })
    return { correct: matched, earned: matched ? maxScore : 0, maxScore, needsSelfGrade: false }
  }
  return { correct: null, earned: 0, maxScore, needsSelfGrade: true }
}

// 汇总整卷：客观题自动判分，主观题按学生自评比例计入。selfGrades 值为 0 / 0.5 / 1。
export function computeQuizSummary({ questions = [], answers = {}, selfGrades = {} } = {}) {
  const perQuestion = questions.map(question => {
    const graded = gradeQuestion(question, answers[question.id])
    if (graded.needsSelfGrade) {
      const ratio = Number(selfGrades[question.id])
      const rated = Number.isFinite(ratio) && ratio >= 0
      const earned = rated ? roundScore(graded.maxScore * Math.min(1, ratio)) : 0
      return { questionId: question.id, ...graded, earned, selfGrade: rated ? Math.min(1, ratio) : null, graded: rated }
    }
    return { questionId: question.id, ...graded, graded: true }
  })
  const gradedRows = perQuestion.filter(row => !row.needsSelfGrade || row.selfGrade !== null)
  // 只统计已判分的题目：主观题未自评前不计入分母，避免正确率被凭空拉低。
  const totalMax = gradedRows.reduce((sum, row) => sum + row.maxScore, 0)
  const earned = roundScore(gradedRows.reduce((sum, row) => sum + row.earned, 0))
  const accuracy = totalMax > 0 ? earned / totalMax : 0
  const objectiveRows = perQuestion.filter(row => !row.needsSelfGrade)
  return {
    perQuestion,
    earned,
    totalMax,
    accuracy,
    objectiveCount: objectiveRows.length,
    objectiveCorrect: objectiveRows.filter(row => row.correct === true).length,
    subjectiveCount: perQuestion.length - objectiveRows.length,
    subjectiveGraded: perQuestion.filter(row => row.needsSelfGrade && row.selfGrade !== null).length,
    graded: gradedRows.length,
    complete: gradedRows.length === perQuestion.length
  }
}

// 依据正确率、平均每题用时和错题覆盖的专题数给出下一次专注时长（25 / 40 / 45）。
export function recommendFocusMinutes({ accuracy = 0, averageSecondsPerQuestion = 0, wrongChapterCount = 0, questionCount = 0 } = {}) {
  let recommendedMinutes = accuracy >= 0.85 ? 25 : accuracy >= 0.6 ? 40 : 45
  const slow = averageSecondsPerQuestion >= 90
  const fast = averageSecondsPerQuestion > 0 && averageSecondsPerQuestion <= 45
  if (slow && recommendedMinutes < 45) recommendedMinutes = recommendedMinutes === 25 ? 40 : 45
  if (!slow && fast && accuracy >= 0.85) recommendedMinutes = 25
  if (wrongChapterCount >= 3 && recommendedMinutes < 45) recommendedMinutes = 45
  if (questionCount >= 10 && recommendedMinutes === 25) recommendedMinutes = 40
  const accuracyText = `正确率 ${Math.round(accuracy * 100)}%`
  const speedText = averageSecondsPerQuestion ? `平均每题 ${Math.round(averageSecondsPerQuestion)} 秒` : '本次用时较短'
  const reason = recommendedMinutes === 45
    ? `${accuracyText}，${speedText}，且错题涉及多个专题，建议用 45 分钟先补概念与错因，再做变式`
    : recommendedMinutes === 40
      ? `${accuracyText}，${speedText}，建议用 40 分钟完成一轮专项练习并留出复盘时间`
      : `${accuracyText}，${speedText}，掌握较稳，用 25 分钟做短时巩固即可`
  return { recommendedMinutes, reason }
}

// 周测时间窗口：以本地周一 00:00 为起点。
export function getWeeklyWindowStart(timestamp = Date.now()) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  const day = date.getDay() || 7
  date.setDate(date.getDate() - (day - 1))
  return date.getTime()
}

// 返回本周已完成的周测记录；没有则 null。
export function findWeeklyQuizResult(results = [], timestamp = Date.now()) {
  const start = getWeeklyWindowStart(timestamp)
  return results.find(item => item?.mode === 'weekly' && Number(item.submittedAt || item.createdAt || 0) >= start) || null
}

export function formatDuration(seconds = 0) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0))
  const minutes = Math.floor(safe / 60)
  const rest = safe % 60
  return `${String(minutes).padStart(2, '0')}:${String(rest).padStart(2, '0')}`
}
