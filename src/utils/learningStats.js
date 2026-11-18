// 学习效果看板的纯聚合函数：不依赖 Vue 与 IndexedDB，方便直接单测。
export function quizAccuracyOf(results) {
  const totalQuestions = results.reduce((sum, item) => sum + (Number(item.questionCount) || 0), 0)
  if (!totalQuestions) return 0
  // 按题量加权，避免 3 题小测和 25 题整卷按同等权重拉平正确率。
  const weighted = results.reduce((sum, item) => sum + (Number(item.accuracy) || 0) * (Number(item.questionCount) || 0), 0)
  return Math.round(weighted / totalQuestions * 100)
}

export function subjectAccuracyRows(results) {
  const map = new Map()
  for (const item of results) {
    const key = item.subject || '未标注科目'
    const row = map.get(key) || { subject: key, weighted: 0, questions: 0, tests: 0 }
    row.weighted += (Number(item.accuracy) || 0) * (Number(item.questionCount) || 0)
    row.questions += Number(item.questionCount) || 0
    row.tests += 1
    map.set(key, row)
  }
  return [...map.values()]
    .map(row => ({ ...row, accuracy: row.questions ? Math.round(row.weighted / row.questions * 100) : 0 }))
    .sort((left, right) => left.accuracy - right.accuracy)
}

// 错题按「科目 + 章节」聚合，默认取最需要复盘的前 6 个章节。
export function wrongChapterRows(mistakes, limit = 6) {
  const map = new Map()
  for (const item of mistakes) {
    // 已消灭的错题不再计入薄弱章节，否则重做答对后章节还一直挂在短板里。
    if (item.fixedAt) continue
    const name = item.chapterName || '未归因章节'
    const key = `${item.subject || ''}|${name}`
    const row = map.get(key) || { key, name, subject: item.subject || '未标注科目', count: 0 }
    row.count += 1
    map.set(key, row)
  }
  return [...map.values()]
    .map(row => ({ ...row, shortName: row.name.length > 9 ? `${row.name.slice(0, 9)}…` : row.name }))
    .sort((left, right) => right.count - left.count)
    .slice(0, limit)
}

// 同一场考试按 examId 合并多科成绩，缺失 examId 时用考试名与日期兜底。
export function examSessionRows(examScores) {
  const map = new Map()
  for (const item of examScores) {
    const date = item.date || item.createdAt || 0
    const key = item.examId || `${item.name || '学校考试'}|${date}`
    const row = map.get(key) || { id: key, name: item.name || '学校考试', date, score: 0, full: 0, subjects: 0 }
    row.score += Number(item.score) || 0
    row.full += Number(item.fullScore) || 0
    row.subjects += 1
    map.set(key, row)
  }
  return [...map.values()].filter(row => row.full > 0).sort((left, right) => left.date - right.date)
}

export function examAverageRate(sessions) {
  const totalFull = sessions.reduce((sum, row) => sum + row.full, 0)
  if (!totalFull) return 0
  return Math.round(sessions.reduce((sum, row) => sum + row.score, 0) / totalFull * 100)
}

// 规则化建议：只基于本地数据，不额外调用模型，最多返回 3 条。
export function learningSuggestions({ results, mistakes, examSessions, accuracy }) {
  const list = []
  if (!results.length && !examSessions.length) {
    list.push('这个时间窗内还没有测试或考试记录，先完成一次章节测试，学习效果才有数据可看')
  }
  const weakest = subjectAccuracyRows(results)[0]
  if (weakest && weakest.questions >= 3 && weakest.accuracy < 75) {
    list.push(`${weakest.subject}章节测试平均正确率 ${weakest.accuracy}%，建议先回到概念和例题，再做一次同章测试`)
  }
  const topWrong = wrongChapterRows(mistakes, 1)[0]
  if (topWrong && topWrong.count >= 2) {
    list.push(`错题集中在「${topWrong.name}」（${topWrong.count} 道），优先安排一次 25 分钟错题复盘`)
  }
  if (examSessions.length >= 2) {
    const latest = examSessions[examSessions.length - 1]
    const previous = examSessions[examSessions.length - 2]
    const latestRate = Math.round(latest.score / latest.full * 100)
    const previousRate = Math.round(previous.score / previous.full * 100)
    if (latestRate - previousRate >= 5) list.push(`最近一次「${latest.name}」得分率 ${latestRate}%，比上次高 ${latestRate - previousRate} 个百分点，保持当前节奏`)
    else if (previousRate - latestRate >= 5) list.push(`最近一次「${latest.name}」得分率比上次低 ${previousRate - latestRate} 个百分点，建议对照错题定位失分章节`)
  }
  if (!list.length) {
    if (accuracy >= 80) list.push(`最近测试平均正确率 ${accuracy}%，基础较稳，可以把时间转向迁移题和错题复盘`)
    else list.push('继续积累测试与考试记录，看板会随数据给出更具体的下一步')
  }
  return list.slice(0, 3)
}
