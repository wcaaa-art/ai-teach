// 章节测试命题：卷型蓝图、模型题校验、7 天去重、无密钥本地兜底。
import { callDeepSeek, extractJson, safeFilter } from './agent.js'
import { QUIZ_SYSTEM_PROMPT } from './prompts.js'
import { PAPER_SPEC, QUIZ_MODE_LIMITS, stemHash } from '../src/utils/quiz.js'
import { pickBankQuestions, pickQuizBankQuestions } from './question-bank.js'

// 初中卷型结构规范会同时进入系统提示词和用户消息，模型与兜底题都按它出题。
export const PAPER_SPECS = {
  '初中': {
    label: '初中（全国中考常见结构）',
    totalScore: 120,
    difficultyRatio: '基础:中档:较难 ≈ 7:2:1',
    sections: [
      { type: 'single', name: '单项选择题', perQuestion: 3, note: '四个选项只有一项正确' },
      { type: 'fill', name: '填空题', perQuestion: 3, note: '答案唯一，写关键结论' },
      { type: 'short', name: '解答题', perQuestion: '6–12', note: '写出必要步骤，按步骤给分' }
    ]
  }
}

// 并发上限：实测 6 路各出 1 题的墙钟约 9 秒，再往上收益递减且容易触发网关限流。
export const QUIZ_CONCURRENCY = 6

function clampCount(mode, value) {
  const limits = QUIZ_MODE_LIMITS[mode] || QUIZ_MODE_LIMITS.daily
  const requested = Number(value)
  if (!Number.isFinite(requested)) return limits.default
  return Math.max(limits.min, Math.min(limits.max, Math.round(requested)))
}

function scoreFor(type) {
  return type === 'single' ? 3 : type === 'fill' ? 3 : 10
}

// 题型配比按科目调整：初中卷型只有单选、填空、解答三种题型。
function typePatternFor() {
  return ['single', 'single', 'fill', 'short', 'single', 'fill', 'single', 'short', 'single', 'fill', 'short', 'single']
}

// 综合整卷分值表：120 分与 100 分各一套，题量都是 25（选择 10 + 填空 6 + 解答 9）。
const PAPER_SCORE_PLANS = {
  120: { single: 3, fill: 3, short: [4, 4, 6, 6, 8, 8, 10, 12, 14] },
  100: { single: 3, fill: 2, short: [2, 2, 4, 6, 6, 8, 8, 10, 12] }
}

// 整卷按「题型段」排题：先选择、再填空、最后解答；章节按题位轮转，保证覆盖整本教材。
function buildPaperBlueprint({ stage = '初中', grade = '', subject = '', chapters = [] } = {}) {
  const selected = (Array.isArray(chapters) ? chapters : []).filter(chapter => chapter && chapter.id).slice(0, 16)
  if (!selected.length) return { mode: 'paper', stage, grade, subject, total: 0, requested: 0, items: [] }
  const fullScore = PAPER_SPEC.fullScoreFor(subject)
  const plan = PAPER_SCORE_PLANS[fullScore]
  const slots = []
  for (let index = 0; index < PAPER_SPEC.sectionCounts.single; index += 1) slots.push({ type: 'single', score: plan.single })
  for (let index = 0; index < PAPER_SPEC.sectionCounts.fill; index += 1) slots.push({ type: 'fill', score: plan.fill })
  plan.short.forEach(score => slots.push({ type: 'short', score }))
  const items = slots.map((slot, index) => {
    const chapter = selected[index % selected.length]
    return { chapterId: chapter.id, chapterName: chapter.name, count: 1, types: [slot.type], scores: [slot.score] }
  })
  return { mode: 'paper', stage, grade, subject, total: items.length, requested: items.length, fullScore, items }
}

// 按章节平均分配题量，再为每道题指定题型，避免模型把题目集中到少数章节。
export function buildQuizBlueprint({ mode = 'daily', stage = '初中', grade = '', subject = '', chapters = [], questionCount } = {}) {
  if (mode === 'paper') return buildPaperBlueprint({ stage, grade, subject, chapters })
  const selected = (Array.isArray(chapters) ? chapters : []).filter(chapter => chapter && chapter.id).slice(0, 8)
  const total = clampCount(mode, questionCount)
  const pattern = typePatternFor()
  const base = selected.length ? Math.floor(total / selected.length) : 0
  const remainder = selected.length ? total % selected.length : 0
  let cursor = 0
  const items = selected.map((chapter, index) => {
    const count = Math.min(total, base + (index < remainder ? 1 : 0))
    const types = Array.from({ length: count }, () => {
      const type = pattern[cursor % pattern.length]
      cursor += 1
      return type
    })
    return { chapterId: chapter.id, chapterName: chapter.name, count, types, scores: types.map(scoreFor) }
  }).filter(item => item.count > 0)
  return { mode, stage, grade, subject, total: items.reduce((sum, item) => sum + item.count, 0), requested: total, items }
}

function text(value, limit = 1200) {
  return safeFilter(String(value || '').slice(0, limit))
}

function optionList(raw) {
  if (!Array.isArray(raw)) return []
  return raw.slice(0, 4).map(item => String(item).slice(0, 300)).filter(item => item.trim())
}

// 模型题结构校验：章节必须属于所选范围，答案字段必须齐全，否则丢弃交给兜底补齐。
export function sanitizeModelQuestion(raw, { chapters = [] } = {}) {
  if (!raw || typeof raw !== 'object') return null
  const chapter = chapters.find(item => item.id === raw.chapterId) || chapters.find(item => item.name === raw.chapterName)
  if (!chapter) return null
  let type = ['single', 'fill', 'short'].includes(raw.type) ? raw.type : 'single'
  // 初中卷型没有多选题，模型误给时降级为单选，避免判分规则不一致。
  const stem = text(raw.stem)
  if (!stem) return null
  const common = {
    id: String(raw.id || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`),
    chapterId: chapter.id,
    chapterName: chapter.name,
    type,
    dimension: String(raw.dimension || 'concept'),
    stem,
    explanation: text(raw.explanation, 1000),
    difficulty: Math.max(1, Math.min(3, Number(raw.difficulty) || 1)),
    score: Math.max(1, Math.min(20, Number(raw.score) || scoreFor(type)))
  }
  if (type === 'single') {
    const options = optionList(raw.options)
    if (options.length < 2) return null
    if (type === 'single') {
      const correctIndex = Number(raw.correctIndex)
      if (!Number.isInteger(correctIndex) || correctIndex < 0 || correctIndex >= options.length) return null
      return { ...common, options, correctIndex }
    }
    const correctIndexes = Array.isArray(raw.correctIndexes)
      ? [...new Set(raw.correctIndexes.map(Number).filter(index => Number.isInteger(index) && index >= 0 && index < options.length))].sort((a, b) => a - b)
      : []
    if (correctIndexes.length < 2) return null
    return { ...common, options, correctIndexes }
  }
  if (type === 'fill') {
    const answer = String(raw.answer || '').trim().slice(0, 300)
    if (!answer) return null
    const acceptableAnswers = Array.isArray(raw.acceptableAnswers)
      ? raw.acceptableAnswers.slice(0, 6).map(item => String(item).slice(0, 300)).filter(Boolean)
      : []
    return { ...common, answer, acceptableAnswers, options: [] }
  }
  const referenceAnswer = text(raw.referenceAnswer, 1600)
  if (!referenceAnswer) return null
  return { ...common, referenceAnswer, options: [] }
}

// 本地兜底单选解析若只有一句话，补成逐项格式：正确项写依据，干扰项指出与正确结果的差异。
function expandSingleExplanation(question) {
  const text = String(question.explanation || '').trim()
  const options = Array.isArray(question.options) ? question.options : []
  const correctIndex = question.correctIndex
  if (!options.length || correctIndex === null || correctIndex === undefined) return text
  if (/^[A-H][.、:：)]/.test(text)) return text
  const labels = ['A', 'B', 'C', 'D', 'E', 'F']
  const correctValue = options[Number(correctIndex)]
  const readNumber = value => {
    const match = String(value).replace(/[，,]/g, '').match(/-?\d+(?:\.\d+)?/)
    return match ? Number(match[0]) : Number.NaN
  }
  const correctNumber = readNumber(correctValue)
  const rows = []
  options.forEach((option, index) => {
    if (index === Number(correctIndex)) {
      rows.push(`${labels[index]}. 正确：${text}`)
      return
    }
    const value = readNumber(option)
    const delta = Number.isFinite(value) && Number.isFinite(correctNumber) ? value - correctNumber : null
    const compare = delta === null
      ? '该说法与题干的已知条件冲突'
      : delta === 0
        ? `与正确结果 ${correctValue} 数值相同，需核对写法是否规范`
        : `${option} 与正确结果 ${correctValue} 相差 ${Number(Math.abs(delta).toFixed(3))}`
    rows.push(`${labels[index]}. 错误：${compare}，说明这一项不是按题干的定义或公式完整推导得到的结果。`)
  })
  return rows.join('\n')
}

function draftBase(extra) {
  const question = {
    options: [], correctIndex: null, correctIndexes: [], answer: '', acceptableAnswers: [],
    referenceAnswer: '', dimension: 'concept', difficulty: 1, ...extra
  }
  return { ...question, explanation: expandSingleExplanation(question) }
}

/* ---------- 以下为无 AI 时的本地兜底题库：覆盖常见专题，结构与大模型产出完全一致 ---------- */

function mathDraft(name, type, variant) {
  const difficulty = variant < 2 ? 1 : variant < 4 ? 2 : 3
  if (/有理数|数轴/.test(name)) {
    const value = -(2 + variant)
    const distance = Math.abs(value)
    if (type === 'single') return draftBase({ stem: `数轴上表示 ${value} 的点到原点的距离是？`, options: [String(value), String(distance), '0', String(distance + 1)], correctIndex: 1, explanation: `A. 错误：${value} 是点本身的位置坐标，距离不能为负，题目问的是到原点的距离。\nB. 正确：距离等于绝对值 |${value}| = ${distance}，所以答案是 ${distance}。\nC. 错误：0 表示原点本身，只有当点落在原点时距离才是 0，而 ${value} 并不在原点。\nD. 错误：${distance + 1} 在 ${distance} 的基础上多加了 1，|${value}| 已经是 ${distance}，不需要再补。`, difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: `${value} 的绝对值是 ______。`, answer: String(distance), acceptableAnswers: [String(distance)], explanation: `绝对值表示到原点的距离，|${value}| = ${distance}。`, difficulty })
    return draftBase({ stem: `计算 |${value}| + ${value + 5} 的值，并写出计算过程。`, referenceAnswer: `|${value}| = ${distance}，所以原式 = ${distance} + ${value + 5} = ${distance + value + 5}。`, explanation: '先求绝对值，再按有理数加法法则计算。', difficulty, dimension: 'basic-application' })
  }
  if (/一元二次方程/.test(name)) {
    const root1 = 1 + variant
    const root2 = 2 + variant
    const sum = root1 + root2
    const product = root1 * root2
    if (type === 'single') return draftBase({ stem: `方程 x² − ${sum}x + ${product} = 0 的两根之和是？`, options: [String(sum), String(product), String(-sum), String(root1)], correctIndex: 0, explanation: `A. 正确：由 x₁ + x₂ = −b/a，方程中 b = −${sum}、a = 1，所以两根之和为 ${sum}。\nB. 错误：${product} 是两根之积 c/a，把“积”当成“和”是常见的混淆。\nC. 错误：${-sum} 是把 −b/a 的负号丢掉的结果，符号算反了。\nD. 错误：${root1} 只是其中一个根，题问的是两根之和，还要加上另一个根 ${root2}。`, difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: `方程 x² − ${sum}x + ${product} = 0 的两根之积是 ______。`, answer: String(product), acceptableAnswers: [String(product)], explanation: `由根与系数的关系，两根之积等于 ${product}。`, difficulty })
    return draftBase({ stem: `解方程 x² − ${sum}x + ${product} = 0，并写出求解过程。`, referenceAnswer: `因为 ${root1} × ${root2} = ${product}，且 ${root1} + ${root2} = ${sum}，所以方程的两根为 x₁ = ${root1}，x₂ = ${root2}。`, explanation: '可用因式分解或求根公式求解。', difficulty, dimension: 'basic-application' })
  }
  if (/一元一次方程/.test(name)) {
    const x = 2 + variant
    const a = 2 + (variant % 3)
    const b = 1 + variant
    const result = a * x + b
    if (type === 'single') return draftBase({ stem: `若 ${a}x + ${b} = ${result}，则 x 的值是？`, options: [String(x), String(x + 1), String(-x), String(x - 1)], correctIndex: 0, explanation: `移项得 ${a}x = ${result - b}，所以 x = ${x}。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `若 ${a}x + ${b} = ${result}，则 x = ______。`, answer: String(x), acceptableAnswers: [String(x)], explanation: `移项得 ${a}x = ${result - b}，x = ${x}。`, difficulty })
    return draftBase({ stem: `解方程 ${a}x + ${b} = ${result}，写出每一步。`, referenceAnswer: `两边同时减去 ${b}，得 ${a}x = ${result - b}；两边同时除以 ${a}，得 x = ${x}。`, explanation: '按等式性质逐步变形。', difficulty, dimension: 'basic-application' })
  }
  if (/二元一次方程组|方程组/.test(name)) {
    const x = 2 + variant
    const y = 1 + variant
    const sum = x + y
    const diff = x - y
    if (type === 'single') return draftBase({ stem: `方程组 x + y = ${sum}，x − y = ${diff} 的解是？`, options: [`x=${x}，y=${y}`, `x=${y}，y=${x}`, `x=${sum}，y=${diff}`, `x=${x + 1}，y=${y - 1}`], correctIndex: 0, explanation: `A. 正确：两式相加消去 y，得 2x = ${x * 2}，所以 x = ${x}；代回 x + y = ${sum} 得 y = ${y}，两个方程都成立。\nB. 错误：把 x、y 互换后代入 x − y = ${diff} 得到 ${y} − ${x} = ${y - x}，不等于 ${diff}，不满足第二个方程。\nC. 错误：${sum} 与 ${diff} 是方程右端的常数，不是未知数的值，直接当答案代入原式不成立。\nD. 错误：x = ${x + 1}、y = ${y - 1} 代入第一个方程恰好成立，但代入 x − y = ${diff} 得到 ${(x + 1) - (y - 1)}，不等于 ${diff}，所以不是解。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `方程组 x + y = ${sum}，x − y = ${diff} 中，x = ______。`, answer: String(x), acceptableAnswers: [String(x)], explanation: `两式相加得 2x = ${x * 2}，x = ${x}。`, difficulty })
    return draftBase({ stem: `解方程组 x + y = ${sum}，x − y = ${diff}，并写出消元过程。`, referenceAnswer: `两式相加得 2x = ${x * 2}，x = ${x}；代回第一式得 y = ${y}。`, explanation: '使用加减消元法。', difficulty, dimension: 'basic-application' })
  }
  if (/二次函数/.test(name)) {
    const h = 1 + variant
    const k = variant - 2
    const sign = k < 0 ? `− ${Math.abs(k)}` : `+ ${k}`
    const vertex = `(${h}, ${k})`
    if (type === 'single') return draftBase({ stem: `抛物线 y = (x − ${h})² ${sign} 的顶点坐标是？`, options: [vertex, `(${-h}, ${k})`, `(${h}, ${k === 0 ? 1 : -k})`, `(${k}, ${h})`], correctIndex: 0, explanation: `A. 正确：顶点式 y = (x − h)² + k 的顶点是 (h, k)，本题 h = ${h}、k = ${k}，所以顶点为 ${vertex}。\nB. 错误：横坐标符号取反，把 x − ${h} 看成了 x + ${h}；代入 x = ${-h} 时括号内为 ${-2 * h}，取不到最小值 0。\nC. 错误：纵坐标取错，括号外的常数已经是 ${k}，顶点纵坐标就是 ${k}，不能写成 ${k === 0 ? 1 : -k}。\nD. 错误：横纵坐标顺序写反了，横坐标来自括号内的 h = ${h}，纵坐标来自括号外的 k = ${k}。`, difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: `抛物线 y = (x − ${h})² ${sign} 的对称轴是 x = ______。`, answer: String(h), acceptableAnswers: [String(h)], explanation: `顶点式给出对称轴 x = ${h}。`, difficulty })
    return draftBase({ stem: `求抛物线 y = (x − ${h})² ${sign} 的顶点坐标与最小值。`, referenceAnswer: `顶点坐标为 ${vertex}，当 x = ${h} 时取得最小值 ${k}。`, explanation: '由顶点式直接读出顶点与最值。', difficulty, dimension: 'basic-application' })
  }
  if (/勾股|直角三角形/.test(name)) {
    const triples = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25], [9, 12, 15]]
    const [a, b, c] = triples[variant % triples.length]
    if (type === 'single') return draftBase({ stem: `直角三角形两条直角边分别为 ${a} 和 ${b}，斜边长度是？`, options: [String(c), String(c + 1), String(c - 1), String(a + b)], correctIndex: 0, explanation: `由勾股定理，斜边平方为 ${a}² + ${b}² = ${c}²，斜边为 ${c}。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `直角三角形两条直角边分别为 ${a} 和 ${b}，斜边长为 ______。`, answer: String(c), acceptableAnswers: [String(c)], explanation: `斜边平方 = ${a}² + ${b}² = ${c}²。`, difficulty })
    return draftBase({ stem: `已知直角三角形两条直角边为 ${a} 和 ${b}，求斜边长并说明依据。`, referenceAnswer: `由勾股定理 c² = a² + b² = ${a}² + ${b}² = ${c}²，所以斜边 c = ${c}。`, explanation: '使用勾股定理。', difficulty, dimension: 'transfer' })
  }
  if (/相似/.test(name)) {
    const small = 2
    const large = 3 + variant
    const side = 6
    const target = side * large / small
    if (type === 'single') return draftBase({ stem: `两个相似三角形的相似比为 ${small}:${large}，小三角形中一条边长为 ${side}，大三角形中对应边长为？`, options: [String(target), String(target + 2), String(target - 2), String(side)], correctIndex: 0, explanation: `对应边之比等于相似比，${side} × ${large}/${small} = ${target}。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `相似比为 ${small}:${large}，小三角形对应边为 ${side}，大三角形对应边为 ______。`, answer: String(target), acceptableAnswers: [String(target)], explanation: `对应边成比例：${side}/x = ${small}/${large}，x = ${target}。`, difficulty })
    return draftBase({ stem: `两个相似三角形的相似比为 ${small}:${large}，说明它们的对应边与面积关系。`, referenceAnswer: `对应边之比等于 ${small}:${large}；面积之比等于相似比的平方，即 ${small * small}:${large * large}。`, explanation: '相似三角形对应边成比例，面积比为相似比的平方。', difficulty, dimension: 'transfer' })
  }
  if (/三角函数/.test(name)) {
    const values = [
      { stem: 'sin 30° 的值是？', answer: '1/2', options: ['1/2', '√2/2', '√3/2', '1'] },
      { stem: 'cos 60° 的值是？', answer: '1/2', options: ['1/2', '√2/2', '√3/2', '1'] },
      { stem: 'tan 45° 的值是？', answer: '1', options: ['1/2', '√2/2', '√3/2', '1'] },
      { stem: 'sin 45° 的值是？', answer: '√2/2', options: ['1/2', '√2/2', '√3/2', '1'] },
      { stem: 'cos 30° 的值是？', answer: '√3/2', options: ['1/2', '√2/2', '√3/2', '1'] },
      { stem: 'tan 30° 的值是？', answer: '√3/3', options: ['√3/3', '√2/2', '√3/2', '1'] }
    ][variant % 6]
    const trigOwner = { '1/2': 'sin 30° 或 cos 60°', '√2/2': 'sin 45° 或 cos 45°', '√3/2': 'sin 60° 或 cos 30°', '√3/3': 'tan 30°', '1': 'tan 45°' }
    if (type === 'single') return draftBase({ stem: values.stem, options: values.options, correctIndex: values.options.indexOf(values.answer), explanation: values.options.map((option, index) => option === values.answer ? `${'ABCD'[index]}. 正确：由 30°、45°、60° 的特殊角函数值表，本题的值就是 ${values.answer}。` : `${'ABCD'[index]}. 错误：${option} 是 ${trigOwner[option] || '另一个特殊角'} 的值，与本题的函数名和角度都不对应，套用会张冠李戴。`).join('\n'), difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: values.stem.replace('是？', '是 ______。'), answer: values.answer, acceptableAnswers: [values.answer], explanation: `特殊角三角函数值为 ${values.answer}。`, difficulty })
    return draftBase({ stem: '计算 sin 30° + cos 60° 的值，并写出过程。', referenceAnswer: 'sin 30° = 1/2，cos 60° = 1/2，所以原式 = 1/2 + 1/2 = 1。', explanation: '代入特殊角三角函数值。', difficulty, dimension: 'basic-application' })
  }
  if (/概率|统计/.test(name)) {
    const scenarios = [
      { stem: '掷一枚均匀骰子，出现偶数的概率是？', answer: '1/2', favorable: 3, total: 6, options: ['1/2', '1/3', '1/6', '2/3'] },
      { stem: '抛一枚均匀硬币，正面朝上的概率是？', answer: '1/2', favorable: 1, total: 2, options: ['1/2', '1/3', '1/4', '1'] },
      { stem: '从 1,2,3,4,5 中任取一个数，取到 3 的倍数的概率是？', answer: '1/5', favorable: 1, total: 5, options: ['1/5', '2/5', '1/3', '1/2'] },
      { stem: '掷一枚均匀骰子，出现 3 的倍数的概率是？', answer: '1/3', favorable: 2, total: 6, options: ['1/3', '1/2', '1/6', '2/3'] },
      { stem: '从 1,2,3,4 中任取一个数，取到偶数的概率是？', answer: '1/2', favorable: 2, total: 4, options: ['1/2', '1/4', '3/4', '2/3'] },
      { stem: '从 1,2,3,4,5,6,7,8 中任取一个数，取到奇数的概率是？', answer: '1/2', favorable: 4, total: 8, options: ['1/2', '3/8', '5/8', '1/4'] }
    ][variant % 6]
    if (type === 'single') return draftBase({ stem: scenarios.stem, options: scenarios.options, correctIndex: scenarios.options.indexOf(scenarios.answer), explanation: scenarios.options.map((option, index) => option === scenarios.answer ? `${'ABCD'[index]}. 正确：共有 ${scenarios.total} 个等可能结果，符合条件的有 ${scenarios.favorable} 个，概率 = ${scenarios.favorable}/${scenarios.total} = ${scenarios.answer}。` : `${'ABCD'[index]}. 错误：${option} 与按等可能结果计数得到的 ${scenarios.favorable}/${scenarios.total} 不符，是把总数或符合条件的个数数错了。`).join('\n'), difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: scenarios.stem.replace('？', '？请用最简分数表示 ______。'), answer: scenarios.answer, acceptableAnswers: [scenarios.answer], explanation: `概率为 ${scenarios.answer}。`, difficulty })
    return draftBase({ stem: '从 1,2,3,4 中任取一个数，求取到偶数的概率，并说明理由。', referenceAnswer: '共有 4 个等可能结果，其中偶数有 2 个，所以概率为 2/4 = 1/2。', explanation: '用等可能事件的概率公式。', difficulty, dimension: 'basic-application' })
  }
  if (/集合/.test(name)) {
    if (type === 'single') return draftBase({ stem: '已知集合 A = {1,2,3}，B = {2,3,4}，则 A ∩ B =？', options: ['{2,3}', '{1,2,3,4}', '{1,4}', '{1,2,3}'], correctIndex: 0, explanation: `A. 正确：A ∩ B 只保留同时属于 A 和 B 的元素，2、3 两个集合都有，所以 A ∩ B = {2,3}。\nB. 错误：{1,2,3,4} 是 A ∪ B（并集），把“同时属于”错当成了“属于其一”。\nC. 错误：{1,4} 恰好是只属于其中一个集合的元素，这些元素恰恰不在交集里。\nD. 错误：{1,2,3} 就是集合 A 本身，漏掉了筛选，1 不属于 B，应当去掉。`, difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: '已知 A = {1,2,3}，B = {2,3,4}，则 A ∩ B 中元素的个数是 ______。', answer: '2', acceptableAnswers: ['2'], explanation: '交集为 {2,3}，共 2 个元素。', difficulty })
    return draftBase({ stem: '已知 A = {1,2,3}，B = {2,3,4}，求 A ∪ B 并说明它的元素个数。', referenceAnswer: 'A ∪ B = {1,2,3,4}，共 4 个元素。', explanation: '并集包含所有属于 A 或 B 的元素。', difficulty, dimension: 'basic-application' })
  }
  if (/数列/.test(name)) {
    const first = 1 + variant
    const diff = 2 + variant
    const fifth = first + 4 * diff
    if (type === 'single') return draftBase({ stem: `等差数列首项为 ${first}、公差为 ${diff}，它的第 5 项是？`, options: [String(fifth), String(fifth + diff), String(fifth - diff), String(fifth + 2 * diff)], correctIndex: 0, explanation: `A. 正确：a₅ = a₁ + 4d = ${first} + 4×${diff} = ${fifth}。\nB. 错误：${fifth + diff} 相当于加了 5 个公差，把 a₅ 当成 a₆ 了，项数多算了一项。\nC. 错误：${fifth - diff} 相当于只加了 3 个公差，把 a₅ 当成 a₄ 了，项数少算了一项。\nD. 错误：${fifth + 2 * diff} 加了 6 个公差，与 a₅ = a₁ + 4d 不符。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `等差数列首项为 ${first}、公差为 ${diff}，第 5 项为 ______。`, answer: String(fifth), acceptableAnswers: [String(fifth)], explanation: `a₅ = ${first} + 4×${diff} = ${fifth}。`, difficulty })
    return draftBase({ stem: `等差数列首项为 ${first}、公差为 ${diff}，求前 5 项和 S₅。`, referenceAnswer: `a₅ = ${fifth}，S₅ = 5×(a₁ + a₅)/2 = 5×(${first} + ${fifth})/2 = ${5 * (first + fifth) / 2}。`, explanation: '使用等差数列前 n 项和公式。', difficulty, dimension: 'transfer' })
  }
  if (/导数/.test(name)) {
    const functions = [
      { text: 'y = x²', derivative: '2x', slope: 2 },
      { text: 'y = x³', derivative: '3x²', slope: 3 },
      { text: 'y = 3x² + 2x', derivative: '6x + 2', slope: 8 },
      { text: 'y = x² + x', derivative: '2x + 1', slope: 3 },
      { text: 'y = 2x³', derivative: '6x²', slope: 6 },
      { text: 'y = x³ + x', derivative: '3x² + 1', slope: 4 }
    ][variant % 6]
    const distractors = ['2x', '3x²', '6x', '2x + 1', '0'].filter(item => item !== functions.derivative).slice(0, 3)
    const derivativeOptions = [functions.derivative, ...distractors]
    if (type === 'single') return draftBase({ stem: `函数 ${functions.text} 的导数是？`, options: derivativeOptions, correctIndex: 0, explanation: derivativeOptions.map((option, index) => option === functions.derivative ? `${'ABCD'[index]}. 正确：按幂函数求导法则逐项求导，${functions.text} 的导数是 ${functions.derivative}。` : `${'ABCD'[index]}. 错误：${option} 不是对 ${functions.text} 逐项求导的结果，求导时把某一项的系数或指数算错了。`).join('\n'), difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: `函数 ${functions.text} 在 x = 1 处的导数值是 ______。`, answer: String(functions.slope), acceptableAnswers: [String(functions.slope)], explanation: `先求导，再代入 x = 1，得 ${functions.slope}。`, difficulty })
    return draftBase({ stem: `求函数 ${functions.text} 的导数，并求 x = 1 处切线的斜率。`, referenceAnswer: `导数为 ${functions.derivative}；x = 1 时斜率为 ${functions.slope}。`, explanation: '导数在某点的值等于该点切线斜率。', difficulty, dimension: 'transfer' })
  }
  if (/圆锥曲线|椭圆|双曲线/.test(name)) {
    const ellipses = [[5, 4], [5, 3], [13, 12], [10, 8], [13, 5], [17, 8]]
    const [a, b] = ellipses[variant % ellipses.length]
    const c = Math.sqrt(a * a - b * b)
    const focus = 2 * c
    if (type === 'single') return draftBase({ stem: `椭圆 x²/${a * a} + y²/${b * b} = 1 的半焦距 c 是？`, options: [String(c), String(a), String(b), String(c - 1)], correctIndex: 0, explanation: `A. 正确：由 c² = a² − b² = ${a * a} − ${b * b} = ${c * c}，得 c = ${c}。\nB. 错误：${a} 是长半轴 a，不是半焦距；c 要比 a 小。\nC. 错误：${b} 是短半轴 b，离心率公式里用的是 a 与 b 的平方差，不能直接取 b。\nD. 错误：${c - 1} 在正确结果 ${c} 的基础上少 1，c² = a² − b² 已经给出 ${c * c}，开方就是 ${c}。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `椭圆 x²/${a * a} + y²/${b * b} = 1 的焦距是 ______。`, answer: String(focus), acceptableAnswers: [String(focus)], explanation: `c = ${c}，焦距为 2c = ${focus}。`, difficulty })
    return draftBase({ stem: `已知椭圆 x²/${a * a} + y²/${b * b} = 1，求它的离心率。`, referenceAnswer: `c = ${c}，a = ${a}，离心率 e = c/a = ${c} / ${a} = ${c / a}。`, explanation: '椭圆离心率 e = c/a。', difficulty, dimension: 'transfer' })
  }
  if (/向量/.test(name)) {
    const pairs = [[[1, 2], [3, 4]], [[2, -1], [1, 3]], [[1, 1], [2, -1]], [[3, 1], [1, 2]], [[2, 3], [1, -1]], [[1, 2], [2, 4]]]
    const [u, v] = pairs[variant % pairs.length]
    const dot = u[0] * v[0] + u[1] * v[1]
    if (type === 'single') return draftBase({ stem: `向量 \\vec{a} = (${u[0]}, ${u[1]})，\\vec{b} = (${v[0]}, ${v[1]})，则 \\vec{a}·\\vec{b} =？`, options: [String(dot), String(dot + 1), String(u[0] + v[0]), String(u[1] + v[1])], correctIndex: 0, explanation: `A. 正确：\\vec{a}·\\vec{b} = ${u[0]}×${v[0]} + ${u[1]}×${v[1]} = ${dot}，数量积等于对应坐标乘积之和。\nB. 错误：${dot + 1} 比正确结果多 1，两个乘积相加后已是 ${dot}，不应再补 1。\nC. 错误：${u[0] + v[0]} 只是把两个向量的横坐标相加，数量积要求横、纵坐标分别相乘后再相加。\nD. 错误：${u[1] + v[1]} 只是把两个向量的纵坐标相加，同样不是数量积，数量积必须做乘法。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `\\vec{a} = (${u[0]}, ${u[1]})，\\vec{b} = (${v[0]}, ${v[1]})，则 \\vec{a}·\\vec{b} = ______。`, answer: String(dot), acceptableAnswers: [String(dot)], explanation: `按坐标计算：\\vec{a}·\\vec{b} = ${u[0]}×${v[0]} + ${u[1]}×${v[1]} = ${dot}。若写成 ${u[0] + v[0]}，那是坐标相加，不是数量积。`, difficulty })
    return draftBase({ stem: `判断向量 \\vec{a} = (${u[0]}, ${u[1]}) 与 \\vec{b} = (${v[0]}, ${v[1]}) 是否垂直，并说明依据。`, referenceAnswer: `\\vec{a}·\\vec{b} = ${u[0]}×${v[0]} + ${u[1]}×${v[1]} = ${dot}，${dot === 0 ? '数量积为 0，所以两向量垂直' : '数量积不为 0，所以两向量不垂直'}。`, explanation: `两向量垂直的充要条件是数量积为 0。本题 \\vec{a}·\\vec{b} = ${dot}，${dot === 0 ? '恰好为 0，因此垂直' : '不等于 0，因此不垂直'}；模长 |\\vec{a}| 与 |\\vec{b}| 只影响长度，不能用来判断垂直。`, difficulty, dimension: 'transfer' })
  }
  if (/立体几何|空间|正方体|棱柱/.test(name)) {
    const side = 2 + variant
    const volume = side ** 3
    if (type === 'single') return draftBase({ stem: `棱长为 ${side} 的正方体体积是？`, options: [String(volume), String(side * side), String(6 * side * side), String(volume + side)], correctIndex: 0, explanation: `正方体体积 = 棱长³ = ${side}³ = ${volume}。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `棱长为 ${side} 的正方体体积是 ______。`, answer: String(volume), acceptableAnswers: [String(volume)], explanation: `体积 = ${side}³ = ${volume}。`, difficulty })
    return draftBase({ stem: `棱长为 ${side} 的正方体，求它的表面积与体积。`, referenceAnswer: `表面积 = 6×${side}² = ${6 * side * side}；体积 = ${side}³ = ${volume}。`, explanation: '正方体六个面全等。', difficulty, dimension: 'basic-application' })
  }
  if (/全等|三角形与全等/.test(name)) {
    if (type === 'single') return draftBase({ stem: '下列条件中，不能判定两个三角形全等的是？', options: ['三边对应相等（SSS）', '两边及其夹角对应相等（SAS）', '三个角对应相等（AAA）', '两角及其夹边对应相等（ASA）'], correctIndex: 2, explanation: 'A. 错误：SSS 是三边对应相等，能判定全等，正是题目要找的反面。\nB. 错误：SAS 两边及其夹角对应相等，能判定全等。\nC. 正确：AAA 只能说明形状相似，边长可以任意放缩。反例：边长 1、1、1 和 2、2、2 的两个三角形三个角都相等，但大小不同，并不全等。\nD. 错误：ASA 两角及其夹边对应相等，能判定全等。', difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: '若 △ABC ≌ △DEF，AB = 5，则 DE = ______。', answer: '5', acceptableAnswers: ['5'], explanation: '全等三角形对应边相等，DE 与 AB 是对应边。', difficulty })
    return draftBase({ stem: '已知 AB = DE，BC = EF，AC = DF，判断 △ABC 与 △DEF 是否全等，并说明依据。', referenceAnswer: '△ABC ≌ △DEF，依据是 SSS（三边对应相等）。', explanation: '三边分别对应相等的两个三角形全等。', difficulty, dimension: 'basic-application' })
  }
  if (/轴对称|等腰/.test(name)) {
    if (type === 'single') return draftBase({ stem: '等腰三角形的顶角为 40°，它的一个底角是？', options: ['70°', '40°', '100°', '140°'], correctIndex: 0, explanation: '两个底角相等，每个底角为 (180° − 40°) ÷ 2 = 70°。', difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: '等腰三角形的顶角为 40°，它的底角是 ______°。', answer: '70', acceptableAnswers: ['70', '70°'], explanation: '(180 − 40) ÷ 2 = 70。', difficulty })
    return draftBase({ stem: '等腰三角形的顶角为 40°，求两个底角的度数并说明依据。', referenceAnswer: '两个底角相等，均为 (180° − 40°) ÷ 2 = 70°；依据是“等边对等角”和三角形内角和 180°。', explanation: '等腰三角形两底角相等。', difficulty, dimension: 'basic-application' })
  }
  if (/整式|因式分解/.test(name)) {
    const a = 2 + variant
    const b = 3
    if (type === 'single') return draftBase({ stem: `(x + ${a})(x + ${b}) 的展开式中，一次项系数是？`, options: [String(a + b), String(a * b), String(a), String(a === b ? b + 1 : b)], correctIndex: 0, explanation: `A. 正确：展开后一次项为 (${a} + ${b})x，系数是 ${a + b}。\nB. 错误：${a * b} 是常数项 a×b，不是一次项系数。\nC. 错误：${a} 只是其中一个因数，没有把另一个因数 ${b} 合并进来。\nD. 错误：${a === b ? `${b + 1} 是在正确系数 ${a + b} 上多加 1，展开式里并没有这一项` : `${b} 同样只是单个因数，展开后两项都要贡献一次项`}。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: '把 x² − 9 因式分解，结果是 ______。', answer: '(x+3)(x-3)', acceptableAnswers: ['(x+3)(x-3)', '(x-3)(x+3)'], explanation: '利用平方差公式 x² − 9 = (x + 3)(x − 3)。', difficulty })
    return draftBase({ stem: '把 x² − 9 因式分解，并写出所用公式。', referenceAnswer: 'x² − 9 = x² − 3² = (x + 3)(x − 3)，使用的是平方差公式。', explanation: '平方差公式 a² − b² = (a + b)(a − b)。', difficulty, dimension: 'basic-application' })
  }
  if (/不等式/.test(name)) {
    if (type === 'single') return draftBase({ stem: '不等式 2x + 1 > 5 的解集是？', options: ['x > 2', 'x < 2', 'x > 3', 'x < 3'], correctIndex: 0, explanation: 'A. 正确：移项得 2x > 4，两边同除以正数 2，不等号方向不变，所以解集为 x > 2。\nB. 错误：x < 2 把不等号方向弄反了，除以正数时方向不应改变。\nC. 错误：x > 3 相当于 2x > 6，是把左边的 1 漏掉、没有正确移项的结果。\nD. 错误：x < 3 同时犯了两个错：不等号方向反了，常数项也没有正确移项。', difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: '不等式 2x + 1 > 5 的解集是 x > ______。', answer: '2', acceptableAnswers: ['2'], explanation: '2x > 4，所以 x > 2。', difficulty })
    return draftBase({ stem: '解不等式 2x + 1 > 5，并写出每一步依据。', referenceAnswer: '移项得 2x > 4；两边同时除以正数 2，不等号方向不变，得 x > 2。', explanation: '解一元一次不等式时注意不等号方向。', difficulty, dimension: 'basic-application' })
  }
  if (/函数的概念与性质|函数/.test(name)) {
    if (type === 'single') return draftBase({ stem: '一次函数 y = 2x + 1，当 x = 3 时 y 的值是？', options: ['7', '6', '5', '8'], correctIndex: 0, explanation: '代入 x = 3，y = 2×3 + 1 = 7。', difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: '已知 f(x) = 2x + 1，则 f(3) = ______。', answer: '7', acceptableAnswers: ['7'], explanation: 'f(3) = 2×3 + 1 = 7。', difficulty })
    return draftBase({ stem: '已知 f(x) = 2x + 1，求 f(3) 的值，并说明该函数的单调性。', referenceAnswer: 'f(3) = 7；因为斜率 2 > 0，所以函数在 R 上单调递增。', explanation: '一次函数 y = kx + b 的单调性由 k 的符号决定。', difficulty, dimension: 'transfer' })
  }
  const a = 3 + variant
  const b = 2 + variant
  const c = 4
  const value = a + b * c
  if (type === 'single') return draftBase({ stem: `计算 ${a} + ${b} × ${c} 的值。`, options: [String(value), String((a + b) * c), String(a + b + c), String(value + 1)], correctIndex: 0, explanation: `先乘后加：${b} × ${c} = ${b * c}，再加 ${a} 得 ${value}。`, difficulty, dimension: 'concept' })
  if (type === 'fill') return draftBase({ stem: `计算 ${a} + ${b} × ${c} = ______。`, answer: String(value), acceptableAnswers: [String(value)], explanation: `先算乘法，再算加法，结果为 ${value}。`, difficulty })
  return draftBase({ stem: `计算 ${a} + ${b} × ${c}，并写出运算顺序。`, referenceAnswer: `先算乘法 ${b} × ${c} = ${b * c}，再算加法 ${a} + ${b * c} = ${value}。`, explanation: '混合运算先乘除后加减。', difficulty, dimension: 'basic-application' })
}

function physicsDraft(name, type, variant) {
  const difficulty = variant < 2 ? 1 : variant < 4 ? 2 : 3
  // 物理量做除法会出现长小数，兜底题里统一保留最多 3 位，避免选项出现 0.06666666666666667。
  const num = value => Number(Number(value).toFixed(3))
  if (/欧姆|电阻|电流|电路/.test(name)) {
    const voltage = 6 + 2 * variant
    const resistance = 2 + (variant % 4)
    const current = num(voltage / resistance)
    const reversed = num(resistance / voltage)
    if (type === 'single') return draftBase({ stem: `导体两端电压为 ${voltage} V，电阻为 ${resistance} Ω，通过导体的电流是？`, options: [`${current} A`, `${voltage + resistance} A`, `${reversed} A`, `${num(current * 2)} A`], correctIndex: 0, explanation: `A. 正确：由欧姆定律 I = U/R = ${voltage}/${resistance} = ${current} A。\nB. 错误：${voltage + resistance} A 是把电压和电阻直接相加，欧姆定律要求相除而不是相加。\nC. 错误：${reversed} A 是 R/U，公式倒置了，应该用 U/R。\nD. 错误：${num(current * 2)} A 是正确电流的两倍，题干没有任何依据。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `电压 ${voltage} V、电阻 ${resistance} Ω 时，电流 I = ______ A。`, answer: String(current), acceptableAnswers: [String(current)], explanation: `I = U/R = ${current} A。`, difficulty })
    return draftBase({ stem: `某导体电阻为 ${resistance} Ω，两端电压为 ${voltage} V，求通过它的电流，并写出所用公式。`, referenceAnswer: `I = U/R = ${voltage}/${resistance} = ${current} A。`, explanation: '欧姆定律 I = U/R。', difficulty, dimension: 'basic-application' })
  }
  if (/电功率|家庭电路|电能/.test(name)) {
    const voltage = 6 + 2 * variant
    const current = 1 + variant
    const power = voltage * current
    if (type === 'single') return draftBase({ stem: `用电器两端电压为 ${voltage} V，通过的电流为 ${current} A，它的电功率是？`, options: [`${power} W`, `${voltage + current} W`, `${num(power / 2)} W`, `${current} W`], correctIndex: 0, explanation: `A. 正确：P = UI = ${voltage} × ${current} = ${power} W。\nB. 错误：${voltage + current} W 是把电压和电流相加，电功率要求两者相乘。\nC. 错误：${num(power / 2)} W 是正确功率的一半，没有依据。\nD. 错误：${current} W 只取了电流的数值，漏乘了电压。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `电压 ${voltage} V、电流 ${current} A 时，电功率 P = ______ W。`, answer: String(power), acceptableAnswers: [String(power)], explanation: `P = UI = ${power} W。`, difficulty })
    return draftBase({ stem: `某用电器电压为 ${voltage} V、电流为 ${current} A，求它的电功率并说明公式。`, referenceAnswer: `P = UI = ${voltage} × ${current} = ${power} W。`, explanation: '电功率等于电压与电流的乘积。', difficulty, dimension: 'basic-application' })
  }
  if (/浮力|压强/.test(name)) {
    const depth = Number((0.1 * (variant + 1)).toFixed(1))
    const pressure = 1000 * 10 * depth
    if (type === 'single') return draftBase({ stem: `取水的密度 1×10³ kg/m³、g = 10 N/kg，水深 ${depth} m 处的压强是？`, options: [`${pressure} Pa`, `${depth * 10} Pa`, `${num(pressure / 2)} Pa`, `${1000 * depth} Pa`], correctIndex: 0, explanation: `A. 正确：p = ρgh = 1×10³ × 10 × ${depth} = ${pressure} Pa。\nB. 错误：${depth * 10} Pa 只算了 g×h，漏掉了水的密度 ρ。\nC. 错误：${num(pressure / 2)} Pa 是正确结果的一半，没有依据。\nD. 错误：${1000 * depth} Pa 只算了 ρh，漏掉了 g = 10 N/kg。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `水深 ${depth} m 处的液体压强为 ______ Pa（ρ = 1×10³ kg/m³，g = 10 N/kg）。`, answer: String(pressure), acceptableAnswers: [String(pressure)], explanation: `p = ρgh = ${pressure} Pa。`, difficulty })
    return draftBase({ stem: `水深 ${depth} m 处，求液体压强并写出计算过程（ρ = 1×10³ kg/m³，g = 10 N/kg）。`, referenceAnswer: `p = ρgh = 1×10³ × 10 × ${depth} = ${pressure} Pa。`, explanation: '液体压强公式 p = ρgh。', difficulty, dimension: 'basic-application' })
  }
  if (/牛顿|运动定律|力与运动|相互作用/.test(name)) {
    const mass = 1 + variant
    const acceleration = 2 + (variant % 3)
    const force = mass * acceleration
    if (type === 'single') return draftBase({ stem: `质量为 ${mass} kg 的物体产生 ${acceleration} m/s² 的加速度，所受合力是？`, options: [`${force} N`, `${mass + acceleration} N`, `${num(force / 2)} N`, `${num(mass / acceleration)} N`], correctIndex: 0, explanation: `A. 正确：由牛顿第二定律 F = ma = ${mass} × ${acceleration} = ${force} N。\nB. 错误：${mass + acceleration} N 是把质量和加速度相加，牛顿第二定律要求相乘。\nC. 错误：${num(force / 2)} N 是正确结果的一半，没有依据。\nD. 错误：${num(mass / acceleration)} N 是 m/a，公式倒置了，应该用 m×a。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `质量 ${mass} kg、加速度 ${acceleration} m/s² 时，合力 F = ______ N。`, answer: String(force), acceptableAnswers: [String(force)], explanation: `F = ma = ${force} N。`, difficulty })
    return draftBase({ stem: `质量为 ${mass} kg 的物体在合力作用下产生 ${acceleration} m/s² 的加速度，求合力并说明依据。`, referenceAnswer: `由牛顿第二定律 F = ma = ${mass} × ${acceleration} = ${force} N。`, explanation: '牛顿第二定律 F = ma。', difficulty, dimension: 'basic-application' })
  }
  if (/运动|速度|位移|加速度/.test(name)) {
    const distance = 10 * (variant + 2)
    const time = 2
    const speed = distance / time
    if (type === 'single') return draftBase({ stem: `物体做匀速直线运动，${time} s 内通过 ${distance} m，速度是？`, options: [`${speed} m/s`, `${speed + 2} m/s`, `${distance + time} m/s`, `${num(time / distance)} m/s`], correctIndex: 0, explanation: `A. 正确：v = s/t = ${distance}/${time} = ${speed} m/s。\nB. 错误：${speed + 2} m/s 是在正确速度上凭空加了 2，题干没有任何依据。\nC. 错误：${distance + time} m/s 是把路程和时间相加，速度要求相除。\nD. 错误：${num(time / distance)} m/s 是 t/s，公式倒置了，应该用 s/t。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `物体 ${time} s 内通过 ${distance} m，速度 v = ______ m/s。`, answer: String(speed), acceptableAnswers: [String(speed)], explanation: `v = s/t = ${speed} m/s。`, difficulty })
    return draftBase({ stem: `物体在 ${time} s 内通过 ${distance} m，求平均速度并写出公式。`, referenceAnswer: `v = s/t = ${distance}/${time} = ${speed} m/s。`, explanation: '匀速直线运动速度 v = s/t。', difficulty, dimension: 'basic-application' })
  }
  if (/功|机械能|动能|势能/.test(name)) {
    const force = 10 + 2 * variant
    const distance = 2 + variant
    const work = force * distance
    if (type === 'single') return draftBase({ stem: `物体在 ${force} N 的水平力作用下沿力方向移动 ${distance} m，该力做的功是？`, options: [`${work} J`, `${force + distance} J`, `${num(work / 2)} J`, `${num(force / distance)} J`], correctIndex: 0, explanation: `A. 正确：W = Fs = ${force} × ${distance} = ${work} J。\nB. 错误：${force + distance} J 是把力和位移相加，功要求两者相乘。\nC. 错误：${num(work / 2)} J 是正确结果的一半，没有依据。\nD. 错误：${num(force / distance)} J 是 F/s，公式用错了，应该用 F×s。`, difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `力 ${force} N、位移 ${distance} m，功 W = ______ J。`, answer: String(work), acceptableAnswers: [String(work)], explanation: `W = Fs = ${work} J。`, difficulty })
    return draftBase({ stem: `力 ${force} N 使物体沿力方向移动 ${distance} m，求该力做的功并说明公式。`, referenceAnswer: `W = Fs = ${force} × ${distance} = ${work} J。`, explanation: '功等于力与沿力方向位移的乘积。', difficulty, dimension: 'basic-application' })
  }
  if (/磁|电磁感应/.test(name)) {
    const flux = 0.02 + variant * 0.01
    const time = 0.1 + (variant % 3) * 0.1
    const emf = num(flux / time)
    if (type === 'single') return draftBase({ stem: `闭合线圈的磁通量在 ${time} s 内均匀减小 ${flux} Wb，感应电动势是？`, options: [`${emf} V`, `${num(flux * time)} V`, `${num(time / flux)} V`, `${num(flux + time)} V`], correctIndex: 0, explanation: `A. 正确：由法拉第电磁感应定律 E = |ΔΦ|/Δt = ${flux}/${time} = ${emf} V。\nB. 错误：${num(flux * time)} V 是把磁通量和时间相乘，该定律要求相除。\nC. 错误：${num(time / flux)} V 是 Δt/ΔΦ，公式倒置了，应该用 ΔΦ/Δt。\nD. 错误：${num(flux + time)} V 是把磁通量和时间相加，量纲和物理意义都不对。`, difficulty, dimension: 'transfer' })
    if (type === 'fill') return draftBase({ stem: `磁通量在 ${time} s 内变化 ${flux} Wb，感应电动势 E = ______ V。`, answer: String(emf), acceptableAnswers: [String(emf)], explanation: `E = |ΔΦ|/Δt = ${emf} V。`, difficulty })
    return draftBase({ stem: `线圈磁通量在 ${time} s 内均匀变化 ${flux} Wb，求感应电动势并写出依据。`, referenceAnswer: `由法拉第电磁感应定律 E = |ΔΦ|/Δt = ${flux}/${time} = ${emf} V。`, explanation: '法拉第电磁感应定律。', difficulty, dimension: 'transfer' })
  }
  const distance = 10 * (variant + 2)
  const time = 2
  const speed = distance / time
  if (type === 'single') return draftBase({ stem: `物体 ${time} s 内通过 ${distance} m，它的速度是？`, options: [`${speed} m/s`, `${distance} m/s`, `${time} m/s`, `${distance + time} m/s`], correctIndex: 0, explanation: `A. 正确：v = s/t = ${distance}/${time} = ${speed} m/s。\nB. 错误：${distance} m/s 直接把路程当成速度，漏掉了除以时间。\nC. 错误：${time} m/s 把时间当成速度，概念用错了。\nD. 错误：${distance + time} m/s 是把路程和时间相加，速度要求相除。`, difficulty, dimension: 'basic-application' })
  if (type === 'fill') return draftBase({ stem: `物体 ${time} s 内通过 ${distance} m，速度 v = ______ m/s。`, answer: String(speed), acceptableAnswers: [String(speed)], explanation: `v = s/t = ${speed} m/s。`, difficulty })
  return draftBase({ stem: `物体在 ${time} s 内通过 ${distance} m，求速度并写出计算过程。`, referenceAnswer: `v = s/t = ${distance}/${time} = ${speed} m/s。`, explanation: '速度等于路程除以时间。', difficulty, dimension: 'basic-application' })
}

function chemistryDraft(name, type, variant) {
  const difficulty = variant < 2 ? 1 : variant < 4 ? 2 : 3
  if (/化学方程式|配平/.test(name)) {
    const equations = [
      ['H₂ + O₂ → H₂O', ['2,1,2', '1,1,1', '2,2,2', '1,2,1']],
      ['N₂ + H₂ → NH₃', ['1,3,2', '1,1,1', '2,3,2', '1,2,3']],
      ['Fe + O₂ → Fe₂O₃', ['4,3,2', '2,1,1', '2,3,2', '3,2,1']],
      ['Al + O₂ → Al₂O₃', ['4,3,2', '2,3,1', '1,1,1', '4,2,3']],
      ['Mg + O₂ → MgO', ['2,1,2', '1,1,1', '2,2,2', '1,2,1']],
      ['HCl + NaOH → NaCl + H₂O', ['1,1,1,1', '2,1,1,1', '1,2,1,2', '2,2,1,1']]
    ]
    const [equation, options] = equations[variant % equations.length]
    if (type === 'single') return draftBase({ stem: `配平 ${equation}，按物质出现顺序，系数应为？`, options, correctIndex: 0, explanation: options.map((option, index) => option === options[0] ? `${'ABCD'[index]}. 正确：按原子守恒配平，${equation} 的最简整数系数依次为 ${options[0]}。` : `${'ABCD'[index]}. 错误：系数 ${option} 代入后至少有一种元素的原子个数在等号两边不相等，例如氧原子数对不上，说明没有配平。`).join('\n'), difficulty, dimension: 'basic-application' })
    if (type === 'fill') return draftBase({ stem: `配平 ${equation}，系数依次为 ______。`, answer: options[0], acceptableAnswers: [options[0], options[0].replaceAll(',', ' '), options[0].replaceAll(',', '：')], explanation: `依据原子守恒，系数为 ${options[0]}。`, difficulty })
    return draftBase({ stem: `配平 ${equation}，并说明依据。`, referenceAnswer: `配平后系数依次为 ${options[0]}；依据是反应前后各元素原子个数守恒。`, explanation: '配平只改化学计量数，不改下标。', difficulty, dimension: 'transfer' })
  }
  if (/物质构成|化学用语|元素|原子|分子/.test(name)) {
    if (type === 'single') return draftBase({ stem: '下列化学式书写正确的是？', options: ['H₂O', 'HO₂', 'H₂O₂₂', 'H₂O₃'], correctIndex: 0, explanation: 'A. 正确：水分子由 2 个氢原子和 1 个氧原子构成，化学式写作 H₂O。\nB. 错误：HO₂ 表示 1 个氢原子和 2 个氧原子，与水的组成不符。\nC. 错误：H₂O₂₂ 的下标重复堆叠、没有意义，氧原子数也不是 1。\nD. 错误：H₂O₃ 表示 3 个氧原子，水的组成不是这样。', difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: '水的化学式是 ______。', answer: 'H2O', acceptableAnswers: ['H2O', 'H₂O'], explanation: '水由 2 个氢原子和 1 个氧原子构成，化学式为 H₂O。', difficulty })
    return draftBase({ stem: '写出水的化学式，并说明其中数字的含义。', referenceAnswer: '水的化学式为 H₂O；下标 2 表示每个水分子含 2 个氢原子，O 表示 1 个氧原子。', explanation: '化学式中的下标表示原子个数。', difficulty, dimension: 'concept' })
  }
  if (/金属|酸碱盐|溶液|pH/.test(name)) {
    if (type === 'single') return draftBase({ stem: '某溶液的 pH = 3，该溶液呈？', options: ['酸性', '碱性', '中性', '无法判断'], correctIndex: 0, explanation: 'A. 正确：pH = 3 小于 7，按 pH 与酸碱性的对应关系，溶液呈酸性。\nB. 错误：碱性要求 pH 大于 7，pH = 3 远小于 7。\nC. 错误：中性要求 pH 等于 7，而题目给出的 pH = 3 不等于 7。\nD. 错误：pH 有明确数值就能判断酸碱性，pH < 7 为酸性，不存在“无法判断”。', difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: 'pH 小于 7 的溶液呈 ______ 性。', answer: '酸', acceptableAnswers: ['酸', '酸性'], explanation: 'pH < 7 为酸性，pH = 7 为中性，pH > 7 为碱性。', difficulty })
    return draftBase({ stem: '某溶液 pH = 3，判断它的酸碱性，并说明 pH 与酸碱性的关系。', referenceAnswer: 'pH = 3 < 7，所以溶液呈酸性；pH 越小酸性越强。', explanation: 'pH 用于表示溶液酸碱性强弱。', difficulty, dimension: 'concept' })
  }
  if (type === 'single') return draftBase({ stem: '下列变化属于化学变化的是？', options: ['铁生锈', '水结冰', '玻璃破碎', '酒精挥发'], correctIndex: 0, explanation: 'A. 正确：铁生锈生成了铁的氧化物等新物质，有新物质生成属于化学变化。\nB. 错误：水结冰只是状态改变，冰和水都是 H₂O，没有新物质。\nC. 错误：玻璃破碎只是形状改变，成分没有变化。\nD. 错误：酒精挥发是液态变气态，仍然是乙醇分子，没有新物质。', difficulty, dimension: 'concept' })
  if (type === 'fill') return draftBase({ stem: '铁生锈属于 ______ 变化（填“物理”或“化学”）。', answer: '化学', acceptableAnswers: ['化学', '化学变化'], explanation: '铁生锈有新物质生成，属于化学变化。', difficulty })
  return draftBase({ stem: '判断铁生锈属于物理变化还是化学变化，并说明理由。', referenceAnswer: '属于化学变化，因为铁生锈生成了新物质（铁的氧化物）。', explanation: '有无新物质生成是判断依据。', difficulty, dimension: 'concept' })
}

function biologyDraft(name, type, variant) {
  const difficulty = variant < 2 ? 1 : variant < 4 ? 2 : 3
  if (/细胞/.test(name)) {
    if (type === 'single') return draftBase({ stem: '植物细胞通常具有而动物细胞通常没有的结构是？', options: ['细胞壁', '细胞膜', '细胞质', '细胞核'], correctIndex: 0, explanation: 'A. 正确：细胞壁位于细胞膜外侧，是植物细胞通常具有而动物细胞没有的结构。\nB. 错误：细胞膜动植物细胞都有，用于控制物质进出。\nC. 错误：细胞质动植物细胞都有，是代谢的主要场所。\nD. 错误：真核细胞（动植物细胞）都具有细胞核。', difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: '植物细胞进行光合作用的主要场所是 ______。', answer: '叶绿体', acceptableAnswers: ['叶绿体'], explanation: '叶绿体含叶绿素，是光合作用的主要场所。', difficulty })
    return draftBase({ stem: '说明植物细胞与动物细胞在结构上的一个主要区别，并解释其作用。', referenceAnswer: '植物细胞通常有细胞壁，起支持和保护作用；动物细胞通常没有细胞壁。', explanation: '比较细胞结构时关注细胞壁、叶绿体和大液泡。', difficulty, dimension: 'transfer' })
  }
  if (/遗传|基因|变异/.test(name)) {
    if (type === 'single') return draftBase({ stem: '控制生物性状的基本遗传单位是？', options: ['基因', '细胞膜', '细胞质', '液泡'], correctIndex: 0, explanation: 'A. 正确：基因是有遗传效应的 DNA 片段，控制生物性状。\nB. 错误：细胞膜控制物质进出，与性状遗传无关。\nC. 错误：细胞质是代谢场所，不携带遗传信息。\nD. 错误：液泡主要与储存物质和渗透压有关，不控制性状。', difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: '控制生物性状的基本遗传单位是 ______。', answer: '基因', acceptableAnswers: ['基因'], explanation: '基因控制生物的性状。', difficulty })
    return draftBase({ stem: '简述基因、DNA 与染色体之间的关系。', referenceAnswer: 'DNA 是主要的遗传物质，基因是有遗传效应的 DNA 片段；DNA 与蛋白质共同组成染色体。', explanation: '按“染色体—DNA—基因”的层级回答。', difficulty, dimension: 'transfer' })
  }
  if (/生态|环境/.test(name)) {
    if (type === 'single') return draftBase({ stem: '一条食物链的起点通常是？', options: ['生产者', '消费者', '分解者', '非生物环境'], correctIndex: 0, explanation: 'A. 正确：食物链从生产者开始，生产者通过光合作用固定能量。\nB. 错误：消费者以生产者为食，不能作为食物链起点。\nC. 错误：分解者分解动植物遗体，不处于食物链的起点。\nD. 错误：非生物环境提供物质和条件，但不是食物链的起点。', difficulty, dimension: 'concept' })
    if (type === 'fill') return draftBase({ stem: '生态系统中的能量最终来源于 ______。', answer: '太阳能', acceptableAnswers: ['太阳能', '太阳', '光能'], explanation: '生产者通过光合作用固定太阳能，能量沿食物链流动。', difficulty })
    return draftBase({ stem: '说明生态系统中生产者、消费者和分解者的作用。', referenceAnswer: '生产者制造有机物；消费者直接或间接以生产者为食；分解者分解动植物遗体，促进物质循环。', explanation: '从物质循环和能量流动角度回答。', difficulty, dimension: 'transfer' })
  }
  if (type === 'single') return draftBase({ stem: '生物体结构和功能的基本单位是？', options: ['细胞', '组织', '器官', '系统'], correctIndex: 0, explanation: 'A. 正确：除病毒外，生物体都由细胞构成，细胞是结构和功能的基本单位。\nB. 错误：组织由许多形态相似的细胞构成，是比细胞更高一级的结构。\nC. 错误：器官由多种组织构成，层次高于细胞。\nD. 错误：系统由多个器官构成，植物体甚至没有系统这一层次。', difficulty, dimension: 'concept' })
  if (type === 'fill') return draftBase({ stem: '生物体结构和功能的基本单位是 ______。', answer: '细胞', acceptableAnswers: ['细胞'], explanation: '细胞是生物体结构和功能的基本单位。', difficulty })
  return draftBase({ stem: '简述“结构决定功能”在生物学习中的一个例子。', referenceAnswer: '例如小肠绒毛增大了吸收面积，有利于营养物质的吸收，体现结构与功能相适应。', explanation: '结合具体器官说明结构与功能的关系。', difficulty, dimension: 'transfer' })
}

function genericDraft(subject, name, type, variant) {
  const difficulty = variant < 2 ? 1 : variant < 4 ? 2 : 3
  const methods = {
    '语文': { stem: '阅读一篇记叙文时，梳理情节最有效的方法是？', options: ['按时间或因果顺序概括主要事件', '只摘抄文中的优美句子', '先背下所有生字词', '直接套用议论文结构'], correctIndex: 0, notes: ['按时间或因果顺序概括主要事件，能抓住情节发展的主干，这是梳理情节的核心方法。', '只摘抄优美句子得到的是语言素材，无法还原事件经过。', '生字词只是阅读障碍，背下来不等于理清了情节。', '议论文结构用于论证类文本，套到记叙文上会丢掉人物和事件。'] },
    '英语': { stem: '做英语阅读理解时，遇到生词首先应该？', options: ['立刻查字典并逐词翻译', '结合上下文和构词法推断词义', '跳过整段不读', '只看题目不看原文'], correctIndex: 1, notes: ['逐词查字典会把阅读拆成翻译，既慢又容易断章取义。', '结合上下文和构词法推断词义，能保持阅读连贯，是阅读理解的正确策略。', '跳过整段会丢掉关键信息，影响后续判断。', '只看题目不看原文就失去依据，等于凭感觉选答案。'] },
    '历史': { stem: '分析一则历史材料时，第一步应当？', options: ['判断材料的来源、时间和作者立场', '直接背诵材料全文', '只记住材料中的数字', '忽略材料出处直接下结论'], correctIndex: 0, notes: ['先判断来源、时间和作者立场，才能确定材料的史料价值和可信度。', '背诵全文只是记忆，不能替代对材料的分析。', '只记数字会丢掉材料的观点和背景，得不出完整结论。', '忽略出处直接下结论，容易把孤证或不实材料当成史实。'] },
    '地理': { stem: '判读一幅地图时，首先应关注？', options: ['图名、图例和比例尺', '纸张的颜色', '图框的粗细', '地图的折叠方式'], correctIndex: 0, notes: ['图名、图例和比例尺决定地图的主题、符号含义和空间尺度，是读图的起点。', '纸张颜色与地图信息无关。', '图框粗细只是制图样式，不承载地理信息。', '折叠方式属于装订形式，和判读内容无关。'] },
    '生物': { stem: '学习生物概念时，最能检验理解程度的方法是？', options: ['合上书本，用自己的话解释概念并举一个实例', '反复抄写概念原文', '只看老师板书', '只背选择题答案'], correctIndex: 0, notes: ['能用自己的话解释并举例，说明已经完成从记忆到迁移的转化。', '反复抄写只是机械记忆，不能证明理解了概念。', '只看板书是被动输入，缺少主动加工。', '只背答案会形成固定搭配，换个情境就不会用。'] },
    '化学': { stem: '学习化学用语时，最能检验掌握程度的方法是？', options: ['独立写出化学式并说明含义', '只背元素符号顺序', '只看实验视频', '只记结论不写过程'], correctIndex: 0, notes: ['能独立写出化学式并说明含义，说明理解了符号与微观组成之间的对应关系。', '只背元素符号顺序，遇到化合物就不会组合。', '只看实验视频缺少动笔书写，符号容易记混。', '只记结论不写过程，无法检查配平和守恒是否掌握。'] },
    '物理': { stem: '学习物理规律时，最能检验掌握程度的方法是？', options: ['独立完成一道变式题并说明所用规律', '只背公式字母', '只看例题答案', '跳过实验过程'], correctIndex: 0, notes: ['能独立做变式题并说明所用规律，说明完成了从公式记忆到情境应用的迁移。', '只背公式字母，遇到具体情境就不知道该用哪一个。', '只看例题答案是模仿结果，没有经历推理过程。', '跳过实验过程会失去规律建立的事实依据。'] },
    '数学': { stem: '复习数学专题时，最能检验掌握程度的方法是？', options: ['合上资料独立完成变式题并讲解思路', '只把例题答案抄一遍', '只看公式不练习', '只背结论不推导'], correctIndex: 0, notes: ['能独立完成变式题并讲清思路，说明掌握了方法而不是记住了答案。', '抄例题答案只是复制结果，题目一变就不会做。', '只看公式缺少运算训练，容易在步骤上出错。', '只背结论不推导，遇到需要变形的题目就无法应对。'] }
  }
  const method = methods[subject] || { stem: `复习“${name}”时，最能检验掌握程度的方法是？`, options: ['独立完成变式题并讲解思路', '只抄写教材原文', '只背答案', '跳过练习'], correctIndex: 0, notes: ['独立完成变式题并讲清思路，说明真正掌握了方法。', '抄写原文只是机械记忆，不能迁移。', '只背答案换个问法就失效。', '跳过练习缺少检验，无法发现问题。'] }
  if (type === 'single') return draftBase({ ...method, explanation: method.options.map((option, index) => `${'ABCD'[index]}. ${index === method.correctIndex ? '正确' : '错误'}：${method.notes[index]}`).join('\n'), difficulty, dimension: 'concept' })
  if (type === 'fill') return draftBase({ stem: `“${name}”这一专题所属的学科是 ______。`, answer: subject, acceptableAnswers: [subject], explanation: `本专题属于${subject}课程内容。`, difficulty })
  return draftBase({ stem: `请用两三句话概括“${name}”这一专题的核心内容，并写出一个你还不确定的点。`, referenceAnswer: `能说出该专题的核心概念、常见方法或典型应用即可；例如围绕“${name}”写出定义、关键步骤和一个待确认的问题。`, explanation: '主观题由学生对照参考答案自评。', difficulty, dimension: 'transfer' })
}

function buildFallbackDraft(subject, chapterName, type, variant) {
  if (subject === '数学') return mathDraft(chapterName, type, variant)
  if (subject === '物理') return physicsDraft(chapterName, type, variant)
  if (subject === '化学') return chemistryDraft(chapterName, type, variant)
  if (subject === '生物') return biologyDraft(chapterName, type, variant)
  return genericDraft(subject, chapterName, type, variant)
}

// 按蓝图生成兜底题；若所有变式都撞上近 7 天的题干，追加“变式”标记保证仍可出题。
export function buildFallbackQuizQuestions({ blueprint, excluded = new Set(), seed = 0 } = {}) {
  const questions = []
  // 复制一份去重集合，避免调用方传入的 Set 被本次出题结果污染。
  const seen = new Set(excluded)
  let serial = 0
  for (const item of blueprint?.items || []) {
    for (let index = 0; index < item.count; index += 1) {
      const type = item.types?.[index] || item.types?.[item.types.length - 1] || 'single'
      const score = Number(item.scores?.[index]) || scoreFor(type)
      let question = null
      for (let offset = 0; offset < 6 && !question; offset += 1) {
        const variant = (seed + index + offset) % 6
        const draft = buildFallbackDraft(blueprint.subject, item.chapterName, type, variant)
        if (!draft) continue
        const candidate = {
          ...draft,
          id: `local-${item.chapterId}-${type}-${variant}-${serial}`,
          chapterId: item.chapterId,
          chapterName: item.chapterName,
          type,
          score,
          options: draft.options || []
        }
        if (!seen.has(stemHash(candidate.stem))) question = candidate
      }
      if (!question) {
        const variant = (seed + index) % 6
        const draft = buildFallbackDraft(blueprint.subject, item.chapterName, type, variant)
        if (draft) {
          question = {
            ...draft,
            id: `local-${item.chapterId}-${type}-${variant}-${serial}`,
            chapterId: item.chapterId,
            chapterName: item.chapterName,
            type,
            score,
            options: draft.options || [],
            stem: `${draft.stem}（变式 ${serial + 1}）`
          }
        }
      }
      if (!question) continue
      seen.add(stemHash(question.stem))
      questions.push(question)
      serial += 1
    }
  }
  return questions
}

// 限流并发：保持结果顺序，避免一次把网关打满。
export async function mapWithLimit(list, limit, worker) {
  const results = new Array(list.length)
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, list.length) }, async () => {
    while (cursor < list.length) {
      const index = cursor
      cursor += 1
      results[index] = await worker(list[index], index)
    }
  })
  await Promise.all(runners)
  return results
}

// 单题位请求：一次只出一题。串行出 6 题要约 30 秒，按题并发能把墙钟压到最慢一题的水平。
// 单题请求同时供在线章节测试与离线题库脚本复用。
export async function requestSlotQuestion(slot, { mode, stage, grade, subject, edition, attempt, excludeStems, fullScore }) {
  try {
    const result = await callDeepSeek({
      messages: [{
        role: 'user',
        content: JSON.stringify({
          mode, stage, grade, subject, fullScore,
          textbookEdition: edition || '',
          // 整卷的满分随科目变化，覆盖通用卷型里的 120，避免模型按错误总分配分。
          paperSpec: mode === 'paper'
            ? { ...(PAPER_SPECS[stage] || PAPER_SPECS['初中']), totalScore: fullScore || 100, label: `初中综合整卷（${fullScore || 100} 分）` }
            : (PAPER_SPECS[stage] || PAPER_SPECS['初中']),
          chapters: [{ id: slot.chapterId, name: slot.chapterName }],
          blueprint: [{ chapterId: slot.chapterId, chapterName: slot.chapterName, count: 1, types: [slot.type], scores: [slot.score] }],
          requiredCount: 1,
          round: 1,
          attempt,
          excludeStems
        })
      }],
      // 单题超时掐在 20 秒：正常一题 4–9 秒，慢请求直接交给本地兜底，避免整卷被个别请求拖住。
      systemPrompt: QUIZ_SYSTEM_PROMPT, useTools: false, jsonMode: true, maxRounds: 1, thinking: false, timeoutMs: 20000
    })
    if (!result?.success) return null
    const parsed = extractJson(result.content)
    const raw = Array.isArray(parsed?.questions) ? parsed.questions.find(item => item && item.stem) : null
    if (!raw) return null
    // 请求只包含一个章节，模型漏填或写错章节字段时直接按本题位归位；分值以蓝图为准，防止模型改分。
    const normalized = sanitizeModelQuestion({ ...raw, chapterId: slot.chapterId, chapterName: slot.chapterName }, {
      chapters: [{ id: slot.chapterId, name: slot.chapterName }]
    })
    return normalized ? { ...normalized, score: Number(slot.score) || normalized.score } : null
  } catch {
    return null
  }
}

// 直连模型批量出填空/解答题：离线题库脚本使用，不经过本地 HTTP 接口。
// 只请求主观题位，单选由摸底题库覆盖，避免重复生成。
export async function generateQuizSubjectivesDirect({ grade, subject, edition = '', chapter, count = 15, attempt = 1 } = {}) {
  if (!grade || !subject || !chapter?.id) return []
  const blueprint = buildQuizBlueprint({
    mode: 'weekly', stage: '初中', grade, subject, edition,
    chapters: [{ id: chapter.id, name: chapter.name }], questionCount: count
  })
  const slots = blueprint.items.flatMap(item => (item.types || []).map((type, index) => ({
    chapterId: item.chapterId, chapterName: item.chapterName, type, score: item.scores?.[index]
  }))).filter(slot => slot.type === 'fill' || slot.type === 'short')
  const answers = await mapWithLimit(slots, QUIZ_CONCURRENCY, slot => requestSlotQuestion(slot, {
    mode: 'weekly', stage: '初中', grade, subject, edition, attempt, excludeStems: [], fullScore: blueprint.fullScore
  }))
  return answers.filter(Boolean)
}

// 题位优先从离线题库抽题，返回「题位序号 → 题库题」的映射：
// 单选走摸底题库，填空/解答走章节测试题库；没命中的题位再交给模型。
export function planQuizBankPicks({ grade, subject, edition = '', slots = [], excludeStems = [], index, quizIndex } = {}) {
  const bankByIndex = new Map()
  const dimensions = ['concept', 'basic-application', 'transfer']
  const singleIndexes = slots.map((slot, slotIndex) => (slot.type === 'single' ? slotIndex : -1)).filter(slotIndex => slotIndex >= 0)
  if (singleIndexes.length) {
    const picked = pickBankQuestions({
      grade, subject, edition, excludeStems, index,
      slots: singleIndexes.map((slotIndex, order) => ({
        chapterId: slots[slotIndex].chapterId,
        dimension: dimensions[order % dimensions.length]
      }))
    })
    picked.forEach((question, order) => {
      if (question) bankByIndex.set(singleIndexes[order], question)
    })
  }
  const subjectiveIndexes = slots
    .map((slot, slotIndex) => (slot.type === 'fill' || slot.type === 'short' ? slotIndex : -1))
    .filter(slotIndex => slotIndex >= 0)
  if (subjectiveIndexes.length) {
    const picked = pickQuizBankQuestions({
      grade, subject, edition, index: quizIndex,
      excludeStems: [...excludeStems, ...[...bankByIndex.values()].map(question => question.stem)],
      slots: subjectiveIndexes.map(slotIndex => ({ chapterId: slots[slotIndex].chapterId, type: slots[slotIndex].type }))
    })
    picked.forEach((question, order) => {
      if (question) bankByIndex.set(subjectiveIndexes[order], question)
    })
  }
  return bankByIndex
}

// 生成一卷：按题位并发请求模型，缺失或撞题的题位用本地兜底补齐，顺序保持章节与题型安排。
export async function generateQuiz({ mode = 'daily', stage = '初中', grade = '', subject = '', chapters = [], questionCount, recentStems = [], attempt = 1, edition = '' } = {}) {
  const blueprint = buildQuizBlueprint({ mode, stage, grade, subject, chapters, questionCount })
  const excluded = new Set(
    (Array.isArray(recentStems) ? recentStems : [])
      .slice(-120)
      .map(item => item?.hash || stemHash(item?.stem || ''))
      .filter(Boolean)
  )
  // 近 7 天题干只摘要一次，所有并发请求共用同一份排除列表。
  const excludeStems = (Array.isArray(recentStems) ? recentStems : [])
    .slice(-60).map(item => String(item?.stem || '').slice(0, 220)).filter(Boolean)

  const slots = blueprint.items.flatMap(item => (item.types || []).map((type, typeIndex) => ({
    chapterId: item.chapterId, chapterName: item.chapterName, type, score: item.scores?.[typeIndex]
  })))
  // 离线题库先行：命中的单选位不再请求模型，未命中的题位继续走模型。
  const bankByIndex = planQuizBankPicks({ grade, subject, edition, slots, excludeStems })
  const modelIndexes = []
  const modelSlots = []
  slots.forEach((slot, index) => {
    if (bankByIndex.has(index)) return
    modelIndexes.push(index)
    modelSlots.push(slot)
  })
  const answers = modelSlots.length
    ? await mapWithLimit(modelSlots, QUIZ_CONCURRENCY, slot => requestSlotQuestion(slot, {
      mode, stage, grade, subject, edition, attempt, excludeStems, fullScore: blueprint.fullScore
    }))
    : []
  const modelAnswers = new Map(modelIndexes.map((slotIndex, answerIndex) => [slotIndex, answers[answerIndex]]))

  const questions = []
  // 每题单独请求时模型会反复返回 q1，整卷必须按题位重发唯一 id，否则答案会串题。
  const stamp = Date.now().toString(36)
  let modelCount = 0
  let bankCount = 0
  slots.forEach((slot, index) => {
    const bankQuestion = bankByIndex.get(index)
    if (bankQuestion) {
      const bankHash = stemHash(bankQuestion.stem)
      if (excluded.has(bankHash)) return
      excluded.add(bankHash)
      questions.push({
        ...bankQuestion,
        chapterId: slot.chapterId,
        chapterName: slot.chapterName,
        type: bankQuestion.type || slot.type,
        id: `quiz-${stamp}-${index + 1}`,
        score: Number(slot.score) || bankQuestion.score || scoreFor('single'),
        origin: 'bank'
      })
      bankCount += 1
      return
    }
    const candidate = modelAnswers.get(index)
    if (candidate && !excluded.has(stemHash(candidate.stem))) {
      excluded.add(stemHash(candidate.stem))
      questions.push({ ...candidate, id: `quiz-${stamp}-${index + 1}`, score: Number(slot.score) || candidate.score, origin: 'model' })
      modelCount += 1
      return
    }
    // 该题位没有可用模型题时，用本地兜底补一题，保持题目顺序与原卷型一致。
    const fallback = buildFallbackQuizQuestions({
      blueprint: { ...blueprint, items: [{ chapterId: slot.chapterId, chapterName: slot.chapterName, count: 1, types: [slot.type], scores: [slot.score] }] },
      excluded,
      seed: Math.max(0, attempt * 3 + index * 7 + (Date.now() % 11))
    })[0]
    if (!fallback) return
    excluded.add(stemHash(fallback.stem))
    questions.push({ ...fallback, id: `quiz-${stamp}-${index + 1}`, score: Number(slot.score) || fallback.score, origin: 'local' })
  })

  const source = !modelCount && bankCount
    ? bankCount === questions.length ? 'question-bank' : 'question-bank-partial'
    : !modelCount ? 'local-fallback'
      : bankCount ? 'question-bank-with-model'
        : modelCount >= slots.length ? 'deepseek' : 'deepseek-with-local-fill'
  return {
    questions,
    blueprint,
    paperSpec: PAPER_SPECS[stage] || PAPER_SPECS['初中'],
    source,
    requested: blueprint.total
  }
}
