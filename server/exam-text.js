// 中考试卷 PDF 转出来的文本是「整段流水」，题目、选项、答案解析混在一起，还夹着图片占位符。
// 这里把 RAG 片段切成结构化题目，并把碎片行重排成可读段落，供学习资料页按题卡渲染。
const QUESTION_START = /^(\d{1,3})\s*[.．、]\s+(\S.*)$/
const OPTION_START = /^([A-D])\s*[.．、]\s*(.*)$/
const ANSWER_LINE = /^【答\s*案】\s*(.*)$/
const ANALYSIS_LINE = /^【解\s*析】\s*(.*)$/
const DETAIL_LINE = /^【详\s*解】\s*(.*)$/
// 这些开头的行是新的语义块：小问、解答步骤、结论句、选项，不能被并进上一段。
const PARAGRAPH_START = /^(?:【[^】]{1,14}】|[（(]\d{1,2}[)）]|[①②③④⑤⑥⑦⑧⑨⑩]|(?:解|答|证明|分析|点评|点睛|故选|故答案|故填|如图|由题意|依题意)[：:，,]?|[A-D][.．、]|\d{1,3}[.．、]\s)/

// 试卷 PDF 用 Symbol 字体排公式，转文本后运算符号落进私用区（U+F02D 等），浏览器只能画成方块。
// 这里把常见符号映射回真实字符，其余私用区字符直接删掉，宁缺也不要在页面上留一堆 □。
const SYMBOL_FONT_MAP = {
  '\uF02B': '+',
  '\uF02D': '−',
  '\uF03D': '=',
  '\uF03C': '<',
  '\uF03E': '>',
  '\uF028': '(',
  '\uF029': ')',
  '\uF044': 'Δ',
  '\uF070': 'π',
  '\uF0B4': '×',
  '\uF0B8': '÷',
  '\uF0D7': '·'
}

function cleanSymbols(value = '') {
  return String(value)
    .replace(/[□▯]/g, '')
    .replace(/[\uE000-\uF8FF]/g, char => SYMBOL_FONT_MAP[char] ?? '')
    .replace(/\uFFFD/g, '')
    // PDF 的着重号会变成连续句点：`错误．．的是` → `错误的是`
    .replace(/([\u4e00-\u9fa5])[．.]{2,}([\u4e00-\u9fa5])/g, '$1$2')
    // PDF 常把中文句号排成全角点「．」：句末或后面紧跟中文时统一成「。」。
    // 后面是数字则按小数点保留（3．5）；「A．甲」这类选项标记也不动。
    .replace(/([\u4e00-\u9fa5])．(?=[\u4e00-\u9fa5]|$|\s)/g, '$1。')
    .replace(/．(?=$|\s)/g, '。')
    // 因为/所以符号直接粘着后文（∵5、∴这组）时补一个空格，读数才不挤。
    .replace(/([∵∴])[ \t]*(?=\S)/g, '$1 ')
}

// PDF 里的 □ / ▯ 是图片或无法映射的符号，保留只会让页面出现一堆方块；直接剔除。
function stripNoise(line = '') {
  return cleanSymbols(line)
    .replace(/[ \t]{2,}/g, ' ')
    .trim()
}

// 括号里的空白在 PDF 里常被拆成换行，统一成不换行空格，避免括号被拆到两行。
function cleanText(value = '') {
  return cleanSymbols(value)
    .replace(/\r/g, '')
    .replace(/[（(]\s*[\r\n]+\s*[）)]/g, '（\u00a0\u00a0）')
    .replace(/[（(][ \t]{1,6}[）)]/g, '（\u00a0\u00a0）')
    // PDF 按版面折行时，公式常被拆成「ρ海水 / =1.03」；行首是运算符就并回上一行。
    .replace(/\n(?=[=＋+－×÷·。，、；：）)])/g, '')
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

const CJK = /[\u4e00-\u9fa5]/

function joinLine(previous, line) {
  if (!previous) return line
  // 中文接英文/数字（质量为 + 3 10 kg）和英文接英文之间都要留空格，中英混排才不挤。
  const needSpace = (/[A-Za-z0-9]$/.test(previous) && /^[A-Za-z0-9]/.test(line))
    || (/[\u4e00-\u9fa5]$/.test(previous) && /^[A-Za-z0-9]/.test(line))
    || /^[∵∴]/.test(line)
  // 纯符号/英文碎片（∵、(4,3)、A, 这种）两侧留空格才读得开；中文和中文之间直接衔接。
  const isFragment = !CJK.test(previous) || !CJK.test(line)
  return `${previous}${(needSpace || isFragment) ? ' ' : ''}${line}`
}

/**
 * 把逐行碎片重排成段落：中文直接衔接，英文/数字之间补空格，∵/∴ 前留空格，
 * 小问标记、【详解】、解/答/故选等另起一段。
 */
export function reflowText(text = '', { maxParagraphs = 24 } = {}) {
  const lines = String(text || '')
    .replace(/\r/g, '')
    .split('\n')
    .map(stripNoise)
    // 纯标点行、以及只剩「A.」这种选项字母的空行（公式被 PDF 丢图）都没有信息量，直接剔除。
    // 「A．」在清洗时已变成「A。」，过滤要把两种句号都算上。
    .filter(line => line && !/^[，。；、,.;:：]+$/.test(line) && !/^[A-D][.．、。]$/.test(line))

  const paragraphs = []
  for (const line of lines) {
    // 【小问2 详解】这类标记单独成段，后面内容另起，避免标题和正文粘在一起。
    if (!paragraphs.length || PARAGRAPH_START.test(line) || /】$/.test(paragraphs[paragraphs.length - 1])) {
      paragraphs.push(line)
      continue
    }
    paragraphs[paragraphs.length - 1] = joinLine(paragraphs[paragraphs.length - 1], line)
  }
  return paragraphs.slice(0, maxParagraphs).join('\n\n')
    // 重排后括号可能只剩一个空格，统一成不换行空格，避免又出现「（ 」和「 ）」两行。
    .replace(/[（(][ \t\u00a0]*[）)]/g, '（\u00a0\u00a0）')
    // 着重号被 PDF 拆到下一行，重排后才和汉字相邻，这里再清一次。
    .replace(/([\u4e00-\u9fa5])[．.]{2,}([\u4e00-\u9fa5])/g, '$1$2')
}

// 数学卷 PDF 会把公式拆成一列单字符（y / x / ∵ / ∴）；这类题干必须重排。
// 历史卷的表格行也是短行，但不含单字符行，保持原样才不会把表格粘成「书名原著者编译者」。
function looksLikeTable(text = '') {
  const lines = String(text).split('\n').map(line => line.trim()).filter(Boolean)
  let run = 0
  for (const line of lines) {
    if (line.length <= 10 && !/[。！？；，、：:]$/.test(line)) {
      run += 1
      if (run >= 4) return true
    } else {
      run = 0
    }
  }
  return false
}

function needsReflow(text = '') {
  if (/[∵∴]|【小问/.test(text)) return true
  const lines = String(text).split('\n').filter(line => line.trim())
  if (lines.filter(line => line.trim().length <= 2).length >= 3) return true
  // 除表格外的题干都按段落重排，PDF 的版面折行不该出现在页面上。
  return !looksLikeTable(text)
}

/**
 * 判断文本是否属于「公式被拆散」的乱码：`y kx b =+`、`2023 3 8 | 5 | ( 1)+−+−` 这类。
 * 源 PDF 里公式按版面绘制，文本层拿不到顺序；这种内容无法可靠还原，宁可整题不展示。
 */
export function looksGarbled(text = '') {
  const compact = String(text).replace(/\s+/g, ' ').trim()
  if (!compact) return false
  // 连续运算符或隔一个空格的两个运算符：=+、× =、+ <，正常排版不会这样出现
  if (/[=＝＋+\-−×÷·<>]{2,}/.test(compact)) return true
  if (/[＋+\-−×÷·]\s+[＋+\-−×÷·<>]/.test(compact)) return true
  // 运算符悬空在句尾/标点前（`拐角 BCD =，`、`C = ．`、`FC =`），说明公式右半边丢了
  if (/[=＝＋+\-−×÷·<>]\s*(?:[，。；、)）．.]|$)/.test(compact)) return true
  // 小写字母被空格拆开后又跟运算符：y kx b =、kx b = +
  // （化学式 Fe、CuSO4 是大写开头；化学计算里反复出现的 x 去重后只剩一个，都不会命中）
  const splitFormula = compact.match(/(?:^|\s)([a-z]{1,3})\s+([a-z]{1,3})\s+(?:([a-z]{1,3})\s+)?[=＝＋+\-−×÷]/)
  if (splitFormula && new Set(splitFormula.slice(1).filter(Boolean)).size >= 2) return true
  // 运算符直接粘在第二个字母片段上：y x=、x b+、I R=
  if (/(?:^|\s)[A-Za-z]{1,3}\s+[A-Za-z]{1,3}[=＝＋+\-−×÷]/.test(compact)) return true
  // 两个单字母被空格隔开：`x x − > <`、`A B C =`
  if (/(?:^|\s)[A-Za-z]\s+[A-Za-z](?:\s|$)/.test(compact)) return true
  // 等号夹着一个孤立操作数：`2 2 = x =`，公式顺序已经错位
  if (/[=＝]\s*[A-Za-z0-9]{1,3}\s*[=＝]/.test(compact)) return true
  // 空括号后面紧跟数字/字母/运算符：`将点（ ）1,1`、`AB AD>`、`旋转角为（ ）<<`
  if (/[（(][\s\u00a0]*[）)]\s*[A-Za-z0-9=＋+\-−×÷<>]/.test(compact)) return true
  // 算术运算符直接粘着中文：`5+元`、`−元`（`Na+ 离子` 中间有空格，不受影响）
  if (/[＋+\-−×÷][\u4e00-\u9fa5]/.test(compact)) return true
  // `##` 这类占位符残留
  if (compact.includes('##')) return true
  // 独立的逗号碎片（0, , 1, , 2,）说明坐标对已被拆散
  if ((compact.match(/(?:^|\s)[,，](?=\s|$)/g) || []).length >= 2) return true
  // 运算符密度：短句里塞满 =、+、÷ 就是公式碎片；长段化学/物理解析会被中文稀释，不会命中
  const tokens = compact.split(' ')
  const operators = tokens.filter(token => /^[=＝＋+\-−×÷·<>]$/.test(token)).length
  const cjk = (compact.match(/[\u4e00-\u9fa5]/g) || []).length
  return operators >= 2 && operators / Math.max(4, cjk / 8) >= 0.6
}

// 选项必须从 A 开始连续且都有内容；缺项说明原题选项在 PDF 里是图片，只剩字母，不能当选择题展示。
function optionSetBroken(options = []) {
  if (!options.length) return false
  if (options.length === 1) return true
  if (options.some((option, index) => option.key !== 'ABCD'[index] || !option.text)) return true
  // 选项内容和选项字母完全相同（A.A B.B），说明真正的选项在表格里，选项区只剩字母。
  if (options.some(option => option.text === option.key)) return true
  // 四个选项全被 PDF 拆成同一个数字/字母（如 A.1 B.1 C.1），分数分子分母已经丢了
  if (options.length >= 2 && new Set(options.map(option => option.text)).size === 1) return true
  return options.some(option => looksGarbled(option.text))
}

function finishQuestion(question) {
  if (!question) return null
  const stemRaw = cleanText(question.stem.join('\n'))
  const stem = needsReflow(stemRaw) ? reflowText(stemRaw, { maxParagraphs: 60 }) : stemRaw
  const options = question.options
    .map(option => ({ key: option.key, text: cleanText(stripNoise(option.text.replace(/\s*\n\s*/g, ' '))) }))
    .filter(option => option.text)
  // 【解析】经常是空标题，真正内容在【详解】里；两者合并后重排成连贯段落，前端只展示一个「解析」。
  const analysisRaw = reflowText(question.analysis.map(cleanText).filter(Boolean).join('\n'))
  const analysis = looksGarbled(analysisRaw) ? '' : analysisRaw
  const answer = cleanText(question.answer.join(' '))
  if (!stem) return null
  // 只剩一个选项字母或数字的「题干」是上一题答案、页码被当成了新题（如 `5. B`），不是题。
  const bareStem = stem.replace(/\s+/g, '')
  if (/^(?:[A-D]|\d{1,3})(?:[.．、]?[A-D])?$/.test(bareStem)) return null
  // 英语阅读里被图片/表格吃掉的题干只剩 it、habit 这类残词，同样不展示。
  if (!CJK.test(stem) && bareStem.length <= 3) return null
  if (!CJK.test(stem) && /^[A-Za-z]+$/.test(bareStem) && bareStem.length <= 12) return null
  // 题干里除了括号什么都不剩，说明整道题在 PDF 里是图片，保留只会出现一个空括号。
  if (!stem.replace(/[（()）\s\u00a0]/g, '')) return null
  if (looksGarbled(stem) || looksGarbled(answer) || optionSetBroken(options)) return null
  // 答案是单个选项字母却没有任何选项，说明选项在 PDF 里是图片，题目残缺。
  if (/^[A-D]$/.test(answer) && !options.length) return null
  // 没有答案也没有解析的多半是片段截断留下的半题，直接丢弃，避免页面上出现只有半截选项的题。
  if (!answer && !analysis) return null
  // 截断处答案只剩「（1）」这种小问编号、解析又没跟上来，同样按半题丢弃。
  if (!analysis && /^[（(]\d{1,2}[)）]$/.test(answer)) return null
  return { number: question.number, stem, options, answer, analysis }
}

/**
 * 把一段试卷文本切成题目列表。
 * 片段可能从题中间开始，第一题之前的文字重排后作为 lead 返回，超过 160 字就截断。
 */
export function parseExamQuestions(text = '', { limit = 4 } = {}) {
  const lines = String(text || '').replace(/\r/g, '').split('\n')
  const rawQuestions = []
  const rawByNumber = new Map()
  const lead = []
  let current = null
  let mode = 'stem'
  // 解析区可能从更早的题开始（`【6 题详解】` 出现在第 8 题后面），必须按题号挂回去，不能全塞给当前题。
  let analysisTarget = null
  const ANALYSIS_BLOCK = /^【\s*(\d{1,3})\s*题(?:详解|分析)】\s*(.*)$/

  const targetOf = number => {
    if (current && Number(current.number) === number) return current
    return rawByNumber.get(number) || null
  }

  const flush = () => {
    if (current) {
      rawQuestions.push(current)
      if (!rawByNumber.has(Number(current.number))) rawByNumber.set(Number(current.number), current)
    }
    current = null
    mode = 'stem'
    analysisTarget = null
  }

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      if (current && mode === 'analysis' && analysisTarget) analysisTarget.analysis.push('')
      continue
    }

    const questionMatch = line.match(QUESTION_START)
    if (questionMatch) {
      // 答案区的「10. B」是答案行，不是新题的题干
      const answerKey = mode === 'answer' && current
        && line.match(/^(\d{1,3})\s*[.．、]\s*([A-D](?:\s*[、,，]?\s*[A-D])*)\s*$/)
      if (answerKey) {
        current.answer.push(line)
        continue
      }
      const nextNumber = Number(questionMatch[1])
      const sameStem = current && mode === 'stem' && !current.options.length && !current.answer.length && !current.analysis.length
      // 上一题已经进入选项/答案阶段，或题号正好接上时，才认为是新题；否则是题干里的编号行。
      const isNext = !current || !sameStem || nextNumber === Number(current.number) + 1
      if (isNext) {
        flush()
        current = { number: String(nextNumber), stem: [questionMatch[2]], options: [], answer: [], analysis: [] }
        mode = 'stem'
        continue
      }
    }

    if (!current) { lead.push(line); continue }

    const optionMatch = line.match(OPTION_START)
    if (optionMatch && mode !== 'answer' && mode !== 'analysis' && mode !== 'ignore') {
      current.options.push({ key: optionMatch[1], text: optionMatch[2] || '' })
      mode = 'options'
      continue
    }

    // 编号解析块：按题号归位；本片段没有这道题说明解析属于被截断的前文，整段丢弃。
    const blockMatch = line.match(ANALYSIS_BLOCK)
    if (blockMatch) {
      analysisTarget = targetOf(Number(blockMatch[1]))
      mode = analysisTarget ? 'analysis' : 'ignore'
      if (analysisTarget && blockMatch[2]) analysisTarget.analysis.push(blockMatch[2])
      continue
    }

    const answerMatch = line.match(ANSWER_LINE)
    if (answerMatch) {
      current.answer.push(answerMatch[1] || '')
      mode = 'answer'
      analysisTarget = null
      continue
    }

    const analysisMatch = line.match(ANALYSIS_LINE)
    if (analysisMatch) {
      analysisTarget = current
      if (analysisMatch[1]) current.analysis.push(analysisMatch[1])
      mode = 'analysis'
      continue
    }

    const detailMatch = line.match(DETAIL_LINE)
    if (detailMatch) {
      analysisTarget = current
      if (detailMatch[1]) current.analysis.push(detailMatch[1])
      mode = 'analysis'
      continue
    }

    // 材料导语（「据此完成下面小题。」）是新题的前置说明，不能被并进上一题的解析。
    if (mode === 'analysis' && /完成(?:下面|下列|以下)小题/.test(line)) {
      analysisTarget = null
      mode = 'lead'
      lead.push(line)
      continue
    }

    if (mode === 'lead') lead.push(line)
    else if (mode === 'answer') current.answer.push(line)
    else if (mode === 'ignore') continue
    else if (mode === 'analysis') (analysisTarget || current).analysis.push(line)
    else if (mode === 'options' && current.options.length) current.options[current.options.length - 1].text += `\n${line}`
    else current.stem.push(line)
  }
  flush()

  // 答案区常是「6. C」这种编号答案，甚至排在后一道题后面；按题号重新归位，
  // 编号对不上的答案直接从当前题摘掉，避免把上一题的答案显示给下一题。
  const answerKeys = new Map()
  for (const question of rawQuestions) {
    const raw = question.answer.join(' ')
    if (!raw) continue
    const numbered = [...raw.matchAll(/(\d{1,3})\s*[.．、]\s*([A-D])(?![A-Za-z])/g)]
    if (!numbered.length) continue
    for (const match of numbered) answerKeys.set(Number(match[1]), match[2])
    question.answer = []
  }
  for (const question of rawQuestions) {
    if (question.answer.length) continue
    const keyed = answerKeys.get(Number(question.number))
    if (keyed) question.answer = [keyed]
  }

  // 片段从解析中间开始时，题号识别不到新题，答案解析会整段落进导语；
  // 导语里一旦出现解析/答案标记或「故选」，说明它不是材料导语，整段不展示。
  const leadText = reflowText(lead.join('\n'))
  const safeLead = /【(?:答\s*案|解\s*析|详\s*解|分\s*析|点\s*睛)】|故选/.test(leadText) ? '' : leadText.slice(0, 160)

  return {
    lead: safeLead,
    questions: rawQuestions.map(finishQuestion).filter(Boolean).slice(0, limit)
  }
}
