// @ts-check
// 把摸底、章节测试、错题三类记录合并成章节掌握度（0–3）。
// 学校成绩只有学科总分，硬拆到章节就是编数据，因此只参与计划配比，不进入章节分。
const HALF_LIFE_DAYS = 21
const SOURCE_WEIGHT = { assessment: 1, quiz: 1.2, mistake: 0.8 }
const SOURCE_LABEL = { assessment: '摸底', quiz: '章节测试', mistake: '错题' }
const DAY_MS = 24 * 60 * 60 * 1000

const clamp = value => Math.max(0, Math.min(3, value))
const round = value => Math.round(value * 10) / 10

// 21 天半衰期：两周前的摸底不该和昨天的测试等权。
function decay(createdAt, now) {
  const days = Math.max(0, (now - (Number(createdAt) || 0)) / DAY_MS)
  return Math.pow(0.5, days / HALF_LIFE_DAYS)
}

/**
 * @param {{ assessments?: any[], quizResults?: any[], mistakes?: any[], grade?: string, subject?: string, edition?: string, now?: number }} input
 * @returns {Record<string, { score: number, sources: string[], sourceLabels: string[], confidence: '低'|'中'|'高' }>}
 */
export function mergeChapterMastery({ assessments = [], quizResults = [], mistakes = [], grade = '', subject = '', edition = '', now = Date.now() } = {}) {
  const match = item => item && item.grade === grade && item.subject === subject && (!edition || !item.edition || item.edition === edition)
  const buckets = new Map()
  const bucketOf = chapterId => {
    if (!chapterId) return null
    if (!buckets.has(chapterId)) buckets.set(chapterId, { weighted: 0, weight: 0, penalty: 0, sources: new Set() })
    return buckets.get(chapterId)
  }

  for (const item of assessments.filter(match)) {
    const weight = SOURCE_WEIGHT.assessment * decay(item.createdAt, now)
    for (const [chapterId, score] of Object.entries(item.masteryByChapter || {})) {
      const bucket = bucketOf(chapterId)
      if (!bucket) continue
      bucket.weighted += clamp(Number(score) || 0) * weight
      bucket.weight += weight
      bucket.sources.add('assessment')
    }
  }

  for (const record of quizResults.filter(match)) {
    const chapterQuestions = (record.questions || []).reduce((map, question) => {
      if (question?.chapterId) map.set(question.id, question.chapterId)
      return map
    }, new Map())
    const byChapter = new Map()
    for (const row of record.perQuestion || []) {
      // 主观题未自评前没有有效证据，不能按 0 分算进章节掌握度。
      if (row.needsSelfGrade && row.selfGrade === null) continue
      const chapterId = chapterQuestions.get(row.questionId)
      if (!chapterId) continue
      const current = byChapter.get(chapterId) || { earned: 0, max: 0 }
      current.earned += Number(row.earned) || 0
      current.max += Number(row.maxScore) || 0
      byChapter.set(chapterId, current)
    }
    const weight = SOURCE_WEIGHT.quiz * decay(record.createdAt || record.submittedAt, now)
    for (const [chapterId, value] of byChapter) {
      const bucket = bucketOf(chapterId)
      if (!bucket || value.max <= 0) continue
      bucket.weighted += clamp(value.earned / value.max * 3) * weight
      bucket.weight += weight
      bucket.sources.add('quiz')
    }
  }

  const mistakeCounts = new Map()
  for (const item of mistakes.filter(match)) {
    // 已消灭的错题是正向证据，不再按负向扣分。
    if (item.fixedAt) continue
    if (!item.chapterId) continue
    mistakeCounts.set(item.chapterId, (mistakeCounts.get(item.chapterId) || 0) + 1)
  }
  for (const [chapterId, count] of mistakeCounts) {
    const bucket = bucketOf(chapterId)
    if (!bucket) continue
    // 错题只有负向证据：按每题 0.4 扣分，最多扣 1.2，避免一个章节被反复上传刷穿。
    bucket.penalty = Math.min(1.2, count * 0.4 * SOURCE_WEIGHT.mistake)
    bucket.sources.add('mistake')
  }

  const result = {}
  for (const [chapterId, bucket] of buckets) {
    const base = bucket.weight > 0 ? bucket.weighted / bucket.weight : 3
    const sources = [...bucket.sources]
    result[chapterId] = {
      score: round(clamp(base - bucket.penalty)),
      sources,
      sourceLabels: sources.map(key => SOURCE_LABEL[key]),
      confidence: sources.length >= 3 ? '高' : sources.length === 2 ? '中' : '低'
    }
  }
  return result
}
