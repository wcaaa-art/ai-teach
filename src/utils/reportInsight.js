// 报告页的错题分布与补强建议：全部由本次作答 + 错题记录派生，不落库。
// 归因只到知识点级：现有数据回答「这道题考什么」，回答不了「你错在哪一步」。
import { wrongTimesOf } from './mistakeSignals.js'
import { stripBookPrefix } from './chapterNames.js'

// 从逐项解析里取「正确项」的说明，作为这道题在考什么。
// 解析格式：每行以「A. 错误：xxx」「B. 正确：xxx」开头；没有逐项格式时退回题干。
export function extractFocusPoint(question = {}) {
  const lines = String(question.explanation || '')
    .split(/\n+/).map(line => line.trim()).filter(Boolean)
  const correctIndex = Number(question.correctIndex)

  for (const line of lines) {
    const match = line.match(/^([A-H])[.．、:：)]\s*(正确|错误)\s*[：:]\s*(.+)$/)
    if (!match) continue
    const index = 'ABCDEFGH'.indexOf(match[1])
    if (match[2] === '正确' || index === correctIndex) return compactSentence(match[3])
  }
  // 题库里 3/4 的题是「正确答案：X。随后一句说明」格式，取说明本身。
  const answerLine = String(question.explanation || '').match(/正确答案[：:]\s*([^。.．]+)[。.．]\s*([\s\S]+)/)
  if (answerLine) {
    const point = compactSentence(answerLine[2])
    if (point) return point
  }
  // 连解题说明都没有时，说明这一类题在考哪个知识点，不假装知道具体考法。
  const tag = (Array.isArray(question.knowledgeTags) && question.knowledgeTags[0]) || question.chapterName
  if (tag) return `这一类题的典型考法：${tag}`
  return compactSentence(question.stem)
}

// 取第一个分句并限长，保证表格一列放得下。
function compactSentence(text = '', max = 30) {
  const first = String(text).split(/[。，；、]/).map(part => part.trim()).filter(Boolean)[0] || ''
  if (!first) return ''
  return first.length > max ? `${first.slice(0, max)}…` : first
}

// 错题分布：按「章节 + 知识点」聚合，按错题数降序；题号是本次作答的真实序号。
export function buildWrongDistribution({ review = [], mistakes = [], grade = '', subject = '' } = {}) {
  const isWrong = item => item && !item.selfAssessment && item.chosenIndex !== null && item.isCorrect === false
  const wrongRows = review.filter(isWrong)
  if (!wrongRows.length) return { total: 0, items: [] }

  const byQuestion = new Map()
  for (const record of mistakes) {
    if (!record?.questionId) continue
    byQuestion.set(`${record.grade}|${record.subject}|${record.questionId}`, record)
  }

  const groups = new Map()
  // 题号按整份卷子的原始顺序取，不是按错题过滤后的顺序。
  review.forEach((row, index) => {
    if (!isWrong(row)) return
    // 知识标签优先取第一个（最具体的），没有就退回章节名；旧数据里的「八上：」前缀一并裁掉。
    const chapterName = stripBookPrefix(row.chapterName || '')
    const tag = stripBookPrefix((Array.isArray(row.knowledgeTags) && row.knowledgeTags[0]) || chapterName || '未标注')
    const key = `${row.chapterId || ''}|${tag}`
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        chapterId: row.chapterId || '',
        chapterName,
        tag,
        label: chapterName && chapterName !== tag ? `${chapterName} · ${tag}` : tag,
        count: 0,
        questionNumbers: [],
        maxWrongCount: 0,
        focusPoint: '',
        bestWrongCount: -1
      })
    }
    const group = groups.get(key)
    const wrongCount = wrongTimesOf(byQuestion.get(`${grade}|${subject}|${row.id}`))
    group.count += 1
    group.questionNumbers.push(index + 1)
    group.maxWrongCount = Math.max(group.maxWrongCount, wrongCount)
    // 同组多题时取错次最多那道题的考点，避免拿一道题代表整组。
    if (wrongCount >= group.bestWrongCount) {
      group.bestWrongCount = wrongCount
      group.focusPoint = extractFocusPoint(row)
    }
  })

  const items = [...groups.values()]
    .sort((a, b) => b.count - a.count || b.maxWrongCount - a.maxWrongCount)
    .map(group => ({
      key: group.key,
      chapterId: group.chapterId,
      chapterName: group.chapterName,
      tag: group.tag,
      label: group.label,
      count: group.count,
      questionNumbers: group.questionNumbers,
      questionText: group.questionNumbers.map(number => `第 ${number} 题`).join('、'),
      maxWrongCount: group.maxWrongCount,
      focusPoint: group.focusPoint,
      isTop: false
    }))
  if (items.length) items[0].isTop = true
  return { total: wrongRows.length, items }
}

// 补强建议：错得最多 → 其余薄弱专题 → 已经稳住的别重复花时间，最多 4 条。
// 每条都带判断依据、具体动作和完成标准，不写「多加练习」这类空话。
export function buildAdvice({ rows = [], wrongDist = { total: 0, items: [] }, plans = [] } = {}) {
  const advice = []
  const weak = [...rows].filter(row => row.mastery < 2).sort((a, b) => a.mastery - b.mastery)
  const strong = rows.filter(row => row.mastery >= 2)
  const topGroup = wrongDist?.items?.[0]

  if (topGroup) {
    const hit = weak.find(row => row.id === topGroup.chapterId) || weak[0] || rows[0]
    const videoMinutes = pickStageMinutes(plans, hit?.id, 'concept')
    advice.push({
      tone: 'primary',
      title: `先补「${hit?.name || topGroup.chapterName}」，这是丢分最集中的地方`,
      body: `本次 ${wrongDist.total} 道错题里有 ${topGroup.count} 道出在${topGroup.tag}，题号 ${topGroup.questionText}`
        + `这几题主要在考：${topGroup.focusPoint}`
        + `建议先看 ${videoMinutes} 分钟的概念课，再连做 ${Math.max(5, topGroup.count * 5)} 道同类题；连续两轮全对，再往下走`,
      target: hit?.id || ''
    })
  }

  weak.filter(row => row.id !== advice[0]?.target).slice(0, 2).forEach(row => {
    const group = wrongDist?.items?.find(item => item.chapterId === row.id)
    advice.push({
      tone: 'normal',
      title: `「${row.name}」还差${2 - row.mastery}档到掌握标准`,
      body: group
        ? `错在${group.tag}（${group.questionText}），建议先把这一节的知识卡看一遍，再专项练 10 道同类题，做完单独检查一遍易错点`
        : '本次没有留下这个专题的错题，说明不是「不会」，更像「没写完」，建议做一次 5 题的章节测试，把掌握度补到 2/3',
      target: row.id
    })
  })

  if (!weak.length && strong.length) {
    advice.unshift({
      tone: 'primary',
      title: '所有已测专题都达到掌握标准',
      body: `本次 ${strong.length} 个专题都在 2/3 及以上，下一步不用赶进度，按补强路线做一次迁移练习就能稳住`,
      target: ''
    })
  }

  if (strong.length) {
    const names = strong.map(row => `「${row.name}」`).slice(0, 3).join('、')
    advice.push({
      tone: 'calm',
      title: '已经稳住的不要重复花时间',
      body: `${names}已经是 ${strong.map(row => `${row.mastery}/3`).join('、')}，这几块保持每周一次小测就行，复习时间优先给上面几条`,
      target: ''
    })
  }
  return advice.slice(0, 4)
}

function pickStageMinutes(plans, chapterId, stage) {
  const hit = plans.find(plan => plan.chapterId === chapterId && plan.stage === stage)
  return hit?.estimatedMinutes || 20
}
