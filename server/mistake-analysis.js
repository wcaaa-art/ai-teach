// 错题 AI 分析：只根据题干与章节打知识点标签、推测错因并给出补强建议。
// 模型不可用时退回本地关键词规则，保证上传错题仍能保存并带上基础归因。
import { safeFilter } from './agent.js'

export const MISTAKE_ANALYSIS_PROMPT = `你是初中错题归因助手。输入是一道错题的题干文字、年级、科目和所属章节，没有学生的作答过程。
请严格按以下规则处理：
1. knowledgeTags 给 2–4 个具体知识点标签，优先用教材里的名词（如「一元二次方程」「判别式」「全等三角形」），不要写「数学」「计算」这类空泛标签。
2. errorCause 推测学生可能出错的原因，只能基于题干考查点推测，用「可能」「常见原因是」这类措辞，不要断言学生实际错在哪一步，不要编造作答过程。
3. suggestion 给一条可执行的补强动作，包含看什么、做几道题、怎么验证。
4. 每段文字不超过 60 个字，中文，不要 Markdown。
只返回合法 JSON，不要代码块：
{"knowledgeTags":["知识点1","知识点2"],"errorCause":"可能的原因","suggestion":"补强建议"}`

// 本地兜底关键词：题干命中常见考点时补一个比章节更细的标签。
const KEYWORD_TAGS = [
  [/一元二次方程|判别式|求根公式|韦达定理/, '一元二次方程'],
  [/二次函数|抛物线|顶点式|对称轴/, '二次函数'],
  [/一次函数|正比例函数/, '一次函数'],
  [/反比例函数/, '反比例函数'],
  [/全等|对应边|对应角/, '全等三角形'],
  [/相似三角形|相似比/, '相似三角形'],
  [/勾股定理|直角三角形/, '勾股定理'],
  [/分式方程|增根/, '分式方程'],
  [/不等式|不等式组/, '不等式'],
  [/概率|随机事件/, '概率'],
  [/平均数|中位数|众数|方差|统计图/, '统计与数据分析'],
  [/电路|电流|电压|电阻|欧姆定律/, '电路分析'],
  [/化学方程式|质量守恒|配平/, '化学方程式'],
  [/时态|过去式|现在完成时|被动语态/, '英语时态'],
  [/文言文|实词|虚词|翻译句子/, '文言文阅读'],
  [/修辞|说明方法|记叙文|议论文/, '现代文阅读']
]

function clip(value, max = 160) {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

// 本地兜底只做保守归因：章节本身一定是可信标签，关键词命中再补细标签。
export function fallbackMistakeAnalysis({ chapterName = '', text = '' } = {}) {
  const tags = []
  if (chapterName) tags.push(clip(chapterName, 24))
  for (const [pattern, tag] of KEYWORD_TAGS) {
    if (pattern.test(text) && !tags.includes(tag)) tags.push(tag)
    if (tags.length >= 4) break
  }
  const chapter = chapterName ? `「${clip(chapterName, 24)}」` : '这道题'
  return {
    knowledgeTags: tags,
    errorCause: `本题属于${chapter}。仅凭题干无法确定具体出错环节，常见原因是概念混淆、条件漏读或计算失误。`,
    suggestion: `先回看${chapter}的定义与例题，再做 3 道同类变式，最后用章节测试验证。`
  }
}

export function normalizeMistakeAnalysis(raw, { chapterName = '', text = '' } = {}) {
  const fallback = fallbackMistakeAnalysis({ chapterName, text })
  const tags = Array.isArray(raw?.knowledgeTags)
    ? [...new Set(raw.knowledgeTags.map(tag => clip(tag, 24)).filter(Boolean))].slice(0, 4)
    : []
  return {
    knowledgeTags: tags.length ? tags : fallback.knowledgeTags,
    errorCause: clip(safeFilter(String(raw?.errorCause || raw?.cause || ''))) || fallback.errorCause,
    suggestion: clip(safeFilter(String(raw?.suggestion || raw?.advice || ''))) || fallback.suggestion
  }
}
