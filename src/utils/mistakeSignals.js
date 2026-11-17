// 错题信号：统计答错次数、判断「粗心/点错」，供错题库标注和易错判定复用。
export const SLIP_LABELS = { careless: '疑似粗心', misclick: '疑似点错' }

// 错次 = 首次收录算 1 次，之后每次重做/再次测试答错再 +1。
export function wrongTimesOf(item) {
  if (!item) return 0
  const stored = Number(item.wrongCount) || 0
  const redoWrong = (item.redoHistory || []).filter(event => !event.correct).length
  return Math.max(stored, 1 + redoWrong)
}

// 错题本里「连续答对」和已消灭都算之前做对过的证据。
export function correctBeforeFromRecord(item) {
  const redoCorrect = (item?.redoHistory || []).filter(event => event.correct).length
  return redoCorrect + (item?.fixedAt ? 1 : 0)
}

// 扫历史章节测试和摸底：同一道题之前答对过几次。
export function priorCorrectTimes({ questionId, quizResults = [], assessments = [], excludeQuizId = '', excludeAssessmentId = '' } = {}) {
  if (!questionId) return 0
  let count = 0
  for (const record of quizResults) {
    if (!record || record.id === excludeQuizId) continue
    const row = (record.perQuestion || []).find(item => item?.questionId === questionId)
    if (!row) continue
    if (row.needsSelfGrade) {
      if (Number(row.selfGrade) >= 1) count += 1
    } else if (row.correct === true) {
      count += 1
    }
  }
  for (const assessment of assessments) {
    if (!assessment || assessment.id === excludeAssessmentId) continue
    const question = (assessment.questions || []).find(item => item?.id === questionId)
    if (!question || question.selfAssessment) continue
    const chosen = assessment.answers?.[questionId]
    if (chosen !== undefined && chosen !== null && Number(chosen) === Number(question.correctIndex)) count += 1
  }
  return count
}

// 之前做对过、这次第一次错：选项相邻判为点错，其余判为粗心；已经错过一次则不再判粗心，交给「易错」。
const OBJECTIVE_TYPES = ['single', 'multiple', 'fill']
export function judgeWrongReason({ type = 'single', chosenIndex, correctIndex, priorCorrect = 0, nextWrongCount = 1 } = {}) {
  if (nextWrongCount > 1 || priorCorrect <= 0) return ''
  if (!OBJECTIVE_TYPES.includes(type)) return ''
  if (type === 'single' &&
    Number.isInteger(chosenIndex) && Number.isInteger(correctIndex) &&
    chosenIndex >= 0 && correctIndex >= 0 &&
    Math.abs(chosenIndex - correctIndex) === 1) return 'misclick'
  return 'careless'
}

// 知识点维度易错：同一知识点下未消灭的错题达到阈值，就标为易错知识点。
export function hotKnowledgePoints(mistakes = [], threshold = 3) {
  const counter = new Map()
  for (const item of mistakes) {
    if (!item || item.fixedAt) continue
    const name = item.knowledgeTags?.[0] || item.chapterName
    if (!name) continue
    counter.set(name, (counter.get(name) || 0) + 1)
  }
  return new Set([...counter.entries()].filter(([, count]) => count >= threshold).map(([name]) => name))
}
