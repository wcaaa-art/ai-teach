// 试卷学情分析：把 OCR 得到的整卷文字交给模型，产出薄弱点、错因和补强建议。
export const PAPER_DIAGNOSIS_PROMPT = `你是初中教研老师，要根据 OCR 识别出的学校试卷文字判断学生本次考试的学情。请结合题号、题干、学生作答、批改痕迹和分数（如果文字里能看出）分析，不要编造文字中不存在的题号、分数或知识点。

只返回合法 JSON，不要 Markdown，不要解释：
{"title":"试卷名称","score":{"score":96,"fullScore":120},"summary":"2-3 句话结论","weakPoints":[{"name":"知识点","mastery":1,"reason":"判断依据"}],"strengths":["掌握较好的知识点"],"errorCauses":[{"type":"概念不清|计算失误|审题失误|步骤缺失|时间不足|其他","detail":"判断依据"}],"suggestions":["可执行的下一步建议"]}

要求：
1. weakPoints 最多 6 条，mastery 取 1-3（1 最弱、3 接近掌握），reason 必须引用题号或作答线索。
2. strengths 最多 5 条；errorCauses 最多 5 条；suggestions 3-5 条，要具体到复习什么、做什么题。
3. 看不出分数时 score 为 null；看不出批改或作答时只做保守判断，不要假设学生答错。
4. summary 用家长和学生都能看懂的中文，不超过 120 字。`

const asText = (value, max) => String(value || '').replace(/\s+/g, ' ').trim().slice(0, max)
const asList = value => (Array.isArray(value) ? value : [])

function normalizeScore(raw) {
  const scoreValue = Number(raw?.score)
  const fullValue = Number(raw?.fullScore)
  if (!Number.isFinite(scoreValue) || !Number.isFinite(fullValue) || fullValue <= 0) return null
  if (scoreValue < 0 || scoreValue > fullValue) return null
  return { score: Math.round(scoreValue), fullScore: Math.round(fullValue) }
}

// 模型输出不可控，逐字段裁剪成前端能直接渲染的结构，避免脏数据把弹窗撑坏。
export function normalizePaperDiagnosis(parsed, { grade = '', subject = '' } = {}) {
  const weakPoints = asList(parsed?.weakPoints).map(item => ({
    name: asText(item?.name, 30),
    mastery: Math.max(1, Math.min(3, Math.round(Number(item?.mastery) || 1))),
    reason: asText(item?.reason, 120)
  })).filter(item => item.name).slice(0, 6)
  const strengths = asList(parsed?.strengths).map(item => asText(item, 30)).filter(Boolean).slice(0, 5)
  const errorCauses = asList(parsed?.errorCauses).map(item => ({
    type: asText(item?.type, 12) || '待确认',
    detail: asText(item?.detail, 120)
  })).filter(item => item.detail).slice(0, 5)
  const suggestions = asList(parsed?.suggestions).map(item => asText(item, 160)).filter(Boolean).slice(0, 5)
  return {
    title: asText(parsed?.title, 60) || `${grade}${subject}试卷`,
    score: normalizeScore(parsed?.score),
    summary: asText(parsed?.summary, 400) || '已完成试卷文字识别，暂未形成明确结论。',
    weakPoints,
    strengths,
    errorCauses,
    suggestions
  }
}

// 无模型时的本地兜底：不伪造诊断结论，只把能确认的信息和下一步说清楚。
export function fallbackPaperDiagnosis({ grade = '', subject = '', text = '' } = {}) {
  const match = /(?:得分|总分|成绩)[：:\s]*(\d{1,3})\s*[/／]\s*(\d{2,3})/.exec(String(text || ''))
  const score = match ? normalizeScore({ score: Number(match[1]), fullScore: Number(match[2]) }) : null
  return {
    title: `${grade}${subject}试卷`,
    score,
    summary: '已在本机识别出试卷文字，但 AI 分析暂不可用，这次还没有形成学情结论。可以稍后重试，或先把错题录进错题库。',
    weakPoints: [],
    strengths: [],
    errorCauses: [{ type: '待确认', detail: '本次未能调用 AI 分析，无法判断具体失分原因。' }],
    suggestions: ['检查模型密钥与网络后重新分析。', '也可以把错题拍照上传到错题库，先积累知识点标签。']
  }
}
