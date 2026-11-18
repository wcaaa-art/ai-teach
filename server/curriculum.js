// 课程目录按教育部课程标准的学段、学科范围整理为可搜索的本地知识点索引。
// 单元名称是跨教材版本的知识专题，不冒充某一家出版社的目录；题目由模型按专题生成。
import { listTextbookEditionMap, resolveTextbookEdition, textbookEditionChapters } from './textbooks.js'

export const CURRICULUM_SOURCES = [
  { name: '教育部义务教育课程方案和课程标准（2022年版）', url: 'https://hudong.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html' }
]

const catalog = {
  '初一': {
    '语文': ['散文与生活体验', '叙事与人物描写', '古诗文入门', '精读与略读', '说明文初步', '文言文基础'],
    '数学': ['有理数与数轴', '整式加减', '一元一次方程', '几何图形初步', '相交线与平行线', '实数与平方根', '平面直角坐标系', '二元一次方程组', '不等式与不等式组', '数据收集与整理'],
    '英语': ['日常交际与自我介绍', '一般现在时', '名词与代词', 'There be 句型', '一般过去时入门', '阅读策略与语篇理解'],
    '历史': ['中华文明起源与早期国家', '夏商周与春秋战国', '秦汉统一多民族国家', '三国两晋南北朝', '隋唐时期'],
    '地理': ['地球与地图', '陆地与海洋', '天气与气候', '居民与聚落', '亚洲与地区地理'],
    '生物': ['生物与环境', '生物体的结构层次', '绿色植物', '人体的营养与呼吸', '人体生命活动调节'],
    '道德与法治': ['成长中的我', '友谊与交往', '师长情谊', '生命安全与健康', '法律与规则入门']
  },
  '初二': {
    '语文': ['新闻与传记阅读', '说明文阅读', '古诗文积累', '散文阅读', '议论文入门', '文言文理解'],
    '数学': ['三角形与全等', '轴对称与等腰三角形', '整式乘法与因式分解', '分式', '二次根式', '勾股定理', '平行四边形', '一次函数', '数据分析'],
    '英语': ['一般过去时与过去进行时', '现在完成时入门', '情态动词与被动语态', '宾语从句入门', '阅读理解策略', '书面表达组织'],
    '物理': ['机械运动', '声现象', '光现象', '透镜及其应用', '质量与密度', '力与运动', '压强与浮力'],
    '历史': ['辽宋夏金元时期', '明清时期', '中国近代化的起步', '新民主主义革命', '中国现代史概览'],
    '地理': ['中国疆域与行政区划', '中国人口与民族', '中国地形与气候', '中国自然资源', '中国区域地理'],
    '生物': ['生物圈中的绿色植物', '人体生命活动', '动物的运动与行为', '生物多样性', '生物的生殖与遗传'],
    '道德与法治': ['青春成长与自我认识', '情绪情感与调节', '社会生活与规则', '权利与义务', '国家利益与国家安全']
  },
  '初三': {
    '语文': ['议论文阅读与论证', '小说与人物', '古诗文专题', '文学作品鉴赏', '文言文比较阅读', '中考阅读与写作整合'],
    '数学': ['一元二次方程', '二次函数', '旋转与圆', '圆的性质与证明', '相似三角形', '锐角三角函数', '概率与统计综合'],
    '英语': ['宾语从句与定语从句', '被动语态综合', '情态动词与时态复习', '完形填空策略', '阅读理解与推断', '中考写作结构'],
    '物理': ['浮力与压强综合', '功与机械能', '内能与热机', '电流与电路', '欧姆定律', '电功率与家庭电路', '电磁现象'],
    '化学': ['物质构成与化学用语', '化学方程式', '空气与氧气', '水与溶液', '金属与酸碱盐', '化学实验与探究', '化学计算综合'],
    '历史': ['中国近代史', '中华民族抗争与探索', '中华人民共和国成立与发展', '世界近代史', '世界现代史', '历史材料分析'],
    '地理': ['中国区域地理综合', '世界区域地理综合', '人口资源环境', '地图判读与地理实践', '地理图表分析'],
    '生物': ['生物圈中的人', '生物的遗传与变异', '生物的进化', '生态系统与环境保护', '实验探究与图表分析'],
    '道德与法治': ['宪法与公民权利', '法治国家与法治生活', '国情与基本制度', '社会责任与担当', '时政材料分析']
  }
}

const importanceWeights = {
  '二次函数': 5, '一元二次方程': 4,
  '欧姆定律': 5, '电功率与家庭电路': 5, '化学方程式': 5
}

// 人教版初中数学/英语的教材单元对照：只做展示标注，不改章节 id，避免已保存的掌握度与计划断裂。
// 数学按七上～九下的章号；英语按 Go for it! 各册单元，语法专题跨单元时标范围。
const renjiaoUnitLabels = {
  '数学': {
    '初一': {
      '有理数与数轴': '七上 第1章', '整式加减': '七上 第2章', '一元一次方程': '七上 第3章', '几何图形初步': '七上 第4章',
      '相交线与平行线': '七下 第5章', '实数与平方根': '七下 第6章', '平面直角坐标系': '七下 第7章', '二元一次方程组': '七下 第8章',
      '不等式与不等式组': '七下 第9章', '数据收集与整理': '七下 第10章'
    },
    '初二': {
      '三角形与全等': '八上 第11–12章', '轴对称与等腰三角形': '八上 第13章', '整式乘法与因式分解': '八上 第14章', '分式': '八上 第15章',
      '二次根式': '八下 第16章', '勾股定理': '八下 第17章', '平行四边形': '八下 第18章', '一次函数': '八下 第19章', '数据分析': '八下 第20章'
    },
    '初三': {
      '一元二次方程': '九上 第21章', '二次函数': '九上 第22章', '旋转与圆': '九上 第23–24章', '圆的性质与证明': '九上 第24章',
      '概率与统计综合': '九上 第25章', '相似三角形': '九下 第27章', '锐角三角函数': '九下 第28章'
    }
  },
  '英语': {
    '初一': {
      '日常交际与自我介绍': '七上 Starter 1–3 · Unit 1', '一般现在时': '七上 Unit 5–9', '名词与代词': '七上 Unit 2–4',
      'There be 句型': '七下 Unit 8', '一般过去时入门': '七下 Unit 11–12', '阅读策略与语篇理解': '七下 Unit 1–12'
    },
    '初二': {
      '一般过去时与过去进行时': '八上 Unit 1 · 八下 Unit 5', '现在完成时入门': '八下 Unit 8–10', '情态动词与被动语态': '八上 Unit 9 · 九全 Unit 6–7',
      '宾语从句入门': '九全 Unit 2–3', '阅读理解策略': '八上–八下', '书面表达组织': '八上–八下'
    },
    '初三': {
      '宾语从句与定语从句': '九全 Unit 2–3 · Unit 9', '被动语态综合': '九全 Unit 6–7', '情态动词与时态复习': '九全 Unit 1–14',
      '完形填空策略': '九全 综合', '阅读理解与推断': '九全 综合', '中考写作结构': '九全 综合'
    }
  }
}

function stageOf(grade = '') {
  return String(grade).startsWith('初') ? '初中' : ''
}

export function listCurriculumSubjects(grade) {
  const grades = Object.keys(catalog)
  const selectedGrade = grades.includes(grade) ? grade : grades[0]
  const subjects = Object.keys(catalog[selectedGrade] || {})
  return { stage: '初中', grade: selectedGrade, grades, subjects, editions: listTextbookEditionMap(subjects), sources: CURRICULUM_SOURCES }
}

export function orderCurriculumPlans(plans = [], preferredOrder = []) {
  const orderIndex = new Map(preferredOrder.map((id, index) => [id, index]))
  return [...plans].sort((left, right) => {
    const leftIndex = orderIndex.get(left.id) ?? left.sequenceOrder ?? Number.MAX_SAFE_INTEGER
    const rightIndex = orderIndex.get(right.id) ?? right.sequenceOrder ?? Number.MAX_SAFE_INTEGER
    return leftIndex - rightIndex
  }).map((plan, index) => ({ ...plan, sequenceOrder: index + 1 }))
}

// 摸底是按题位逐题请求的，模型每次都从 q1 开始编号；统一重发唯一 id，
// 避免前端 v-model 把十道题绑到同一个答案键，导致选一道题全变。
export function stampDiagnosticQuestionIds(questions = []) {
  const stamp = Date.now().toString(36)
  return questions.map((question, index) => ({ ...question, id: `diag-${index + 1}-${stamp}` }))
}

// 教材单元标签只保留章/单元信息：学期已由年级选择限定，不再重复显示「七上」。
function shortUnitLabel(label = '') {
  return String(label)
    .replace(/[七八九][上下]|[七八九]全\s*/g, '')
    .replace(/\s*·\s*(?=·|$)/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^[–\-—]+$/, '')
}

export function listCurriculumChapters(grade, subject, edition) {
  const normalizedGrade = catalog[grade] ? grade : '初三'
  const resolved = resolveTextbookEdition(subject, edition)
  const editionUnits = textbookEditionChapters(normalizedGrade, subject, resolved.edition)
  const topics = editionUnits?.units || catalog[normalizedGrade]?.[subject] || []
  // 人教版与统编版沿用旧 id，保证已保存的掌握度与计划不失效；其他版本带版本标识，避免不同版本同名专题互相覆盖。
  const idPrefix = editionUnits ? `${normalizedGrade}-${subject}-${editionUnits.slug}` : `${normalizedGrade}-${subject}`
  return {
    stage: stageOf(normalizedGrade), grade: normalizedGrade, subject,
    edition: resolved.edition,
    editionNote: resolved.note,
    curriculumNote: editionUnits
      ? `已切换到${resolved.edition}：章节按该版本单元顺序整理，出题与学习计划会跟随所选版本。`
      : '该科目使用全国统一版本，专题目录按课程标准整理。',
    sources: CURRICULUM_SOURCES,
    chapters: topics.map((name, index) => ({
      id: `${idPrefix}-${index + 1}`,
      name,
      order: index + 1,
      importance: importanceWeights[name] || (index < 3 ? 4 : 3),
      prerequisiteIds: index === 0 ? [] : [`${idPrefix}-${index}`],
      // 只有人教版数学/英语有教材单元对照，其他版本留空，前端自动不显示。
      unitLabel: resolved.slug === 'rjb' ? shortUnitLabel(renjiaoUnitLabels[subject]?.[normalizedGrade]?.[name] || '') : ''
    }))
  }
}

// 检索前统一归一化：全角转半角、去掉标点与空白，降低口语化提问对匹配的干扰。
function normalizeQuery(text = '') {
  return String(text).toLocaleLowerCase()
    .replace(/[\uff01-\uff5e]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[？?，,。.；;：:、\s]/g, '')
}

const QUERY_STOP_FRAGMENTS = new Set(['怎么', '如何', '什么', '为什么', '一个', '这个', '可以', '需要', '哪些', '一般', '题目', '老师'])

// 中文没有天然词边界，用 2~4 字滑窗生成候选片段，长片段在打分时权重更高。
function queryFragments(text) {
  const tokens = new Set()
  for (const size of [4, 3, 2]) {
    for (let index = 0; index + size <= text.length; index += 1) {
      const fragment = text.slice(index, index + size)
      if (!QUERY_STOP_FRAGMENTS.has(fragment)) tokens.add(fragment)
    }
  }
  return [...tokens]
}

// 只维护高频专题的别名词，避免堆一份过重的同义词库。
const TOPIC_ALIASES = {
  '二次函数': ['顶点式', '配方法', '抛物线', '对称轴', '最大值', '最小值', '一般式', '交点式'],
  '一元二次方程': ['求根公式', '判别式', '根与系数', '因式分解'],
  '一次函数': ['斜率', '截距', '正比例'],
  '二次根式': ['根号', '化简'],
  '勾股定理': ['直角三角形', '斜边'],
  '三角形与全等': ['全等', '对应边', '对应角'],
  '相似三角形': ['相似比', '位似'],
  '圆的性质与证明': ['圆周角', '切线', '垂径定理'],
  '锐角三角函数': ['正弦', '余弦', '正切'],
  '概率与统计综合': ['随机事件', '频率']
}

function scoreTopic(item, fragments, query, preferredGrade) {
  const name = normalizeQuery(item.name)
  let score = 0
  // 整词命中权重最高：模型或学生通常直接给出知识点全名。
  if (query && (name.includes(query) || (name.length >= 2 && query.includes(name)))) score += 12
  for (const fragment of fragments) {
    if (name.includes(fragment)) score += fragment.length >= 3 ? 4 : 2
  }
  for (const alias of TOPIC_ALIASES[item.name] || []) {
    if (query.includes(alias)) score += 6
  }
  // 只有文本真正命中时才考虑年级偏好，否则无关提问会把整册目录都带出来。
  if (score > 0 && item.grade === preferredGrade) score += 5
  return score
}

export function searchCurriculum({ subject = '', grade = '', keyword = '' } = {}) {
  const requested = String(grade || '')
  const normalized = catalog[requested] ? requested : '初三'
  const query = normalizeQuery(keyword)
  const fragments = queryFragments(query)
  const candidates = Object.keys(catalog).flatMap(gradeKey => {
    const subjectNames = subject ? [subject] : Object.keys(catalog[gradeKey] || {})
    return subjectNames.flatMap(subjectName => (catalog[gradeKey]?.[subjectName] || []).map((name, index) => ({
      id: `${gradeKey}-${subjectName}-${index + 1}`, subject: subjectName, grade: gradeKey, name, order: index + 1,
      importance: importanceWeights[name] || (index < 3 ? 4 : 3)
    })))
  })
  const matches = candidates
    .map(item => ({ ...item, score: scoreTopic(item, fragments, query, normalized) }))
    .filter(item => !query || item.score > 0)
    .sort((left, right) => right.score - left.score || left.order - right.order)
    .slice(0, 8)
    .map(({ score, ...item }) => item)
  return { grade: normalized, subject, keyword, matches, sources: CURRICULUM_SOURCES }
}

const diagnosticDimensions = ['concept', 'basic-application', 'transfer', 'error-analysis']

export function buildDiagnosticBlueprint(chapters = [], questionCount) {
  const selected = chapters.filter(Boolean)
  const defaultCounts = selected.map(chapter => {
    const importance = Number(chapter.importance) || 3
    return importance >= 5 ? 4 : importance >= 4 ? 3 : 2
  })
  const requestedCount = Number(questionCount)
  const hasCustomCount = Number.isFinite(requestedCount)
  const targetCount = hasCustomCount ? Math.max(1, Math.min(30, Math.round(requestedCount))) : null
  const counts = targetCount === null ? defaultCounts : selected.map(() => 0)

  // 自选题量时先尽量覆盖不同专题，再把剩余题目分配给重要性更高的专题。
  if (targetCount !== null && selected.length) {
    const ranked = selected.map((chapter, index) => ({ chapter, index, importance: Number(chapter.importance) || 3 }))
      .sort((left, right) => right.importance - left.importance || left.chapter.order - right.chapter.order)
    const firstRound = Math.min(targetCount, ranked.length)
    ranked.slice(0, firstRound).forEach(item => { counts[item.index] = 1 })
    let remaining = targetCount - firstRound
    while (remaining > 0) {
      const target = ranked
        .sort((left, right) => counts[left.index] - counts[right.index] || right.importance - left.importance || left.chapter.order - right.chapter.order)[0]
      if (!target) break
      counts[target.index] += 1
      remaining -= 1
    }
  }

  const blueprint = selected.map((chapter, index) => {
    const importance = Number(chapter.importance) || 3
    const count = counts[index]
    return {
      chapterId: chapter.id, chapterName: chapter.name, importance,
      count, dimensions: diagnosticDimensions.slice(0, count)
    }
  })
  const total = blueprint.reduce((sum, item) => sum + item.count, 0)
  return { blueprint, total, dimensions: diagnosticDimensions, requestedCount: targetCount }
}

// 初中数学离线客观题库：每个专题至少 3 道原创单选题，difficulty 1/2/3 对应容易/中等/困难。
// attempt 与题目序号共同决定轮换到哪一道，避免同一张试卷里重复题面。
const mathItems = {
  '有理数与数轴': [
    { difficulty: 1, stem: '数轴上表示 −3 的点到原点的距离是多少？', options: ['−3', '3', '0', '无法确定'], correctIndex: 1, explanation: '点到原点的距离是绝对值，因此为 |−3|。' }
  ],
  '一元一次方程': [
    { difficulty: 1, stem: '若 2x + 3 = 11，先从等式两边同时减去 3，得到什么？', options: ['2x = 8', '2x = 14', 'x = 8', '2x = 11'], correctIndex: 0, explanation: '等式两边同时减去 3，得到 2x = 8。' }
  ],
  '二次函数': [
    { difficulty: 1, stem: '抛物线 y = (x − 2)² + 1 的顶点坐标是什么？', options: ['(2, 1)', '(−2, 1)', '(2, −1)', '(1, 2)'], correctIndex: 0, explanation: '顶点式 y = (x − h)² + k 的顶点为 (h, k)。' }
  ],
  '勾股定理': [
    { difficulty: 1, stem: '直角三角形两条直角边为 3 和 4，斜边长度是多少？', options: ['5', '6', '7', '12'], correctIndex: 0, explanation: '由勾股定理，斜边平方为 3² + 4² = 25。' }
  ],
  '函数的概念与性质': [
    { difficulty: 1, stem: '函数 y = 2x + 1 中，当 x 增加 1 时，y 的变化量是多少？', options: ['增加 1', '增加 2', '减少 1', '不变'], correctIndex: 1, explanation: '一次函数的斜率为 2，x 增加 1 时 y 增加 2。' }
  ],
  '整式加减': [
    { difficulty: 1, stem: '计算 3a + 2a − a 的结果是？', options: ['4a', '4a²', '5a', '5a²'], correctIndex: 0, explanation: '同类项系数相加减：3 + 2 − 1 = 4，因此结果为 4a。' },
    { difficulty: 2, stem: '当 x = −2 时，代数式 2x² − 3x + 1 的值是？', options: ['3', '9', '15', '19'], correctIndex: 2, explanation: '代入得 2×4 − 3×(−2) + 1 = 8 + 6 + 1 = 15。' },
    { difficulty: 3, stem: '若多项式 A 与 2x² − 3x + 1 的和为 5x² + x − 4，则 A 是？', options: ['3x² − 4x − 5', '3x² + 4x − 5', '7x² − 2x − 3', '3x² + 4x + 5'], correctIndex: 1, explanation: 'A = (5x² + x − 4) − (2x² − 3x + 1) = 3x² + 4x − 5。' }
  ],
  '几何图形初步': [
    { difficulty: 1, stem: '下列几何体中，由三个面围成的是？', options: ['圆柱', '圆锥', '球', '三棱柱'], correctIndex: 0, explanation: '圆柱由两个底面和一个侧面共三个面围成。' },
    { difficulty: 2, stem: '一个角的补角比它的余角大多少度？', options: ['45°', '60°', '90°', '180°'], correctIndex: 2, explanation: '设这个角为 x，则 (180° − x) − (90° − x) = 90°。' },
    { difficulty: 3, stem: '点 C 在线段 AB 上，AB = 10 cm，M、N 分别是 AC、BC 的中点，则 MN 的长为？', options: ['4 cm', '5 cm', '6 cm', '10 cm'], correctIndex: 1, explanation: 'MN = MC + CN = AC/2 + BC/2 = AB/2 = 5 cm。' }
  ],
  '相交线与平行线': [
    { difficulty: 1, stem: '两条直线相交，若其中一个角为 40°，则它的对顶角为？', options: ['40°', '50°', '140°', '160°'], correctIndex: 0, explanation: '对顶角相等，因此对顶角也是 40°。' },
    { difficulty: 2, stem: '直线 a ∥ b，一条截线与它们相交。若其中一个同旁内角为 65°，则另一个同旁内角为？', options: ['65°', '115°', '125°', '25°'], correctIndex: 1, explanation: '两直线平行时同旁内角互补，180° − 65° = 115°。' },
    { difficulty: 3, stem: '一个角的两边分别平行于另一个角的两边，且第一个角为 70°，则第二个角为？', options: ['70°', '110°', '70° 或 110°', '无法确定'], correctIndex: 2, explanation: '两边分别平行的两个角相等或互补，因此第二个角为 70° 或 110°。' }
  ],
  '实数与平方根': [
    { difficulty: 1, stem: '16 的算术平方根是？', options: ['4', '±4', '8', '16'], correctIndex: 0, explanation: '算术平方根取非负值，4² = 16，所以结果是 4。' },
    { difficulty: 2, stem: '若 x² = 9，且 x < 0，则 x + √16 的值是？', options: ['−1', '1', '7', '−7'], correctIndex: 1, explanation: 'x < 0 时 x = −3，√16 = 4，因此 x + √16 = 1。' },
    { difficulty: 3, stem: '√81 的算术平方根是？', options: ['±3', '±9', '3', '9'], correctIndex: 2, explanation: '先算 √81 = 9，再求 9 的算术平方根，结果为 3。' }
  ],
  '平面直角坐标系': [
    { difficulty: 1, stem: '点 P(−2, 3) 在平面直角坐标系的哪个象限？', options: ['第一象限', '第二象限', '第三象限', '第四象限'], correctIndex: 1, explanation: '横坐标为负、纵坐标为正的点位于第二象限。' },
    { difficulty: 2, stem: '点 A(1, −2) 关于 x 轴对称的点的坐标是？', options: ['(−1, −2)', '(−1, 2)', '(1, 2)', '(2, 1)'], correctIndex: 2, explanation: '关于 x 轴对称时横坐标不变、纵坐标取相反数，得到 (1, 2)。' },
    { difficulty: 3, stem: '点 P 在第二象限，到 x 轴的距离为 3，到 y 轴的距离为 4，则 P 的坐标是？', options: ['(4, 3)', '(−3, 4)', '(4, −3)', '(−4, 3)'], correctIndex: 3, explanation: '第二象限横坐标为负、纵坐标为正；到 x 轴距离 3 得纵坐标 3，到 y 轴距离 4 得横坐标 −4。' }
  ],
  '二元一次方程组': [
    { difficulty: 1, stem: '下列各组数中，是方程 x + y = 5 的解的是？', options: ['x = 1，y = 4', 'x = 2，y = 2', 'x = 3，y = 1', 'x = 0，y = 4'], correctIndex: 0, explanation: '把各组数代入，只有 1 + 4 = 5 成立。' },
    { difficulty: 2, stem: '解方程组 x + y = 7，x − y = 1，则 x 的值是？', options: ['3', '4', '5', '6'], correctIndex: 1, explanation: '两式相加得 2x = 8，所以 x = 4。' },
    { difficulty: 3, stem: '若 x = 2，y = 1 是方程 ax + by = 7 与 ax − by = 1 的公共解，则 a、b 的值是？', options: ['a = 3，b = 2', 'a = 1，b = 5', 'a = 2，b = 3', 'a = 2，b = 1'], correctIndex: 2, explanation: '代入得 2a + b = 7，2a − b = 1；两式相加得 4a = 8，a = 2，再得 b = 3。' }
  ],
  '不等式与不等式组': [
    { difficulty: 1, stem: '若 a > b，则下列不等式一定成立的是？', options: ['a − 3 > b − 3', 'a + 3 < b + 3', '−a > −b', '3a < 3b'], correctIndex: 0, explanation: '不等式两边同时减去同一个数，不等号方向不变。' },
    { difficulty: 2, stem: '不等式 2x − 3 < 5 的解集是？', options: ['x < 1', 'x < 4', 'x > 4', 'x > 1'], correctIndex: 1, explanation: '移项得 2x < 8，两边除以 2 得 x < 4。' },
    { difficulty: 3, stem: '不等式组 x − 1 > 0，3 − x ≥ 0 的整数解共有几个？', options: ['1 个', '3 个', '4 个', '2 个'], correctIndex: 3, explanation: '解集为 1 < x ≤ 3，整数解是 2 和 3，共 2 个。' }
  ],
  '数据收集与整理': [
    { difficulty: 1, stem: '为了解全班同学的身高情况，最适合采用的调查方式是？', options: ['全面调查', '抽样调查', '查阅资料', '对照实验'], correctIndex: 0, explanation: '班级人数有限且需要准确结果，适合对全班逐一测量。' },
    { difficulty: 2, stem: '一组数据 2，3，3，5，7 的中位数是？', options: ['2', '3', '4', '5'], correctIndex: 1, explanation: '数据已按从小到大排列，共 5 个数，中位数是第 3 个数 3。' },
    { difficulty: 3, stem: '某班 40 名学生中，参加社团的学生占 60%。在扇形统计图中，参加社团部分对应的圆心角度数是？', options: ['144°', '180°', '216°', '240°'], correctIndex: 2, explanation: '圆心角 = 360° × 60% = 216°。' }
  ],
  '三角形与全等': [
    { difficulty: 1, stem: '判定两个三角形全等时，下列条件中不能单独使用的是？', options: ['SSS', 'SAS', 'ASA', 'SSA'], correctIndex: 3, explanation: 'SSA 不能保证三角形唯一确定，因此不能作为单独的全等判定条件。' },
    { difficulty: 2, stem: '已知 △ABC ≌ △DEF，∠A = 50°，∠B = 60°，则 ∠F 的度数是？', options: ['50°', '60°', '70°', '80°'], correctIndex: 2, explanation: '∠C = 180° − 50° − 60° = 70°，全等三角形对应角相等，所以 ∠F = ∠C = 70°。' },
    { difficulty: 3, stem: '一个三角形的两边长分别为 3 和 7，第三边长为整数，则第三边最长为？', options: ['8', '9', '10', '11'], correctIndex: 1, explanation: '第三边应满足 7 − 3 < c < 7 + 3，即 4 < c < 10，整数最大为 9。' }
  ],
  '轴对称与等腰三角形': [
    { difficulty: 1, stem: '等边三角形共有几条对称轴？', options: ['1 条', '2 条', '3 条', '6 条'], correctIndex: 2, explanation: '等边三角形每条边的垂直平分线都是对称轴，共 3 条。' },
    { difficulty: 2, stem: '等腰三角形的一个底角为 70°，则它的顶角为？', options: ['40°', '55°', '70°', '110°'], correctIndex: 0, explanation: '两个底角相等，顶角 = 180° − 70° × 2 = 40°。' },
    { difficulty: 3, stem: '等腰三角形的一边长为 4，另一边长为 9，则它的周长为？', options: ['17', '22', '17 或 22', '26'], correctIndex: 1, explanation: '若腰为 4，则 4 + 4 < 9 不能构成三角形；腰只能为 9，周长为 9 + 9 + 4 = 22。' }
  ],
  '整式乘法与因式分解': [
    { difficulty: 1, stem: '计算 (x + 2)(x − 3)，结果是？', options: ['x² − x − 6', 'x² + x − 6', 'x² − 5x − 6', 'x² − x + 6'], correctIndex: 0, explanation: '展开得 x² − 3x + 2x − 6 = x² − x − 6。' },
    { difficulty: 2, stem: '分解因式 x² − 4x + 4，结果是？', options: ['(x − 2)(x + 2)', '(x − 2)²', '(x + 2)²', 'x(x − 4) + 4'], correctIndex: 1, explanation: 'x² − 4x + 4 是完全平方式，等于 (x − 2)²。' },
    { difficulty: 3, stem: '若 x + y = 5，xy = 6，则 x² + y² 的值是？', options: ['11', '19', '25', '13'], correctIndex: 3, explanation: 'x² + y² = (x + y)² − 2xy = 25 − 12 = 13。' }
  ],
  '分式': [
    { difficulty: 1, stem: '分式 (x − 1)/(x + 2) 有意义的条件是？', options: ['x ≠ 1', 'x ≠ −2', 'x ≠ 2', 'x ≠ −1'], correctIndex: 1, explanation: '分母不能为零，由 x + 2 ≠ 0 得 x ≠ −2。' },
    { difficulty: 2, stem: '化简 (x² − 1)/(x + 1)（x ≠ −1），结果是？', options: ['x + 1', 'x', '1', 'x − 1'], correctIndex: 3, explanation: '分子分解为 (x + 1)(x − 1)，约去 x + 1 后得 x − 1。' },
    { difficulty: 3, stem: '分式方程 1/(x − 2) = 3/x 的解是？', options: ['x = 1', 'x = 2', 'x = 3', '无解'], correctIndex: 2, explanation: '交叉相乘得 x = 3(x − 2)，解得 x = 3；代入分母均不为零，成立。' }
  ],
  '二次根式': [
    { difficulty: 1, stem: '下列二次根式中，属于最简二次根式的是？', options: ['√8', '√12', '√15', '√18'], correctIndex: 2, explanation: '15 不含大于 1 的平方因数，√15 不能再化简。' },
    { difficulty: 2, stem: '计算 √2 × √8 的结果是？', options: ['2', '4', '8', '16'], correctIndex: 1, explanation: '√2 × √8 = √16 = 4。' },
    { difficulty: 3, stem: '若 √(x − 3) + |y + 2| = 0，则 x + y 的值是？', options: ['1', '5', '−1', '无法确定'], correctIndex: 0, explanation: '两个非负数之和为零，则各自为零：x = 3，y = −2，所以 x + y = 1。' }
  ],
  '平行四边形': [
    { difficulty: 1, stem: '平行四边形的两条对角线一定？', options: ['相等', '互相垂直', '互相平分', '平分内角'], correctIndex: 2, explanation: '平行四边形对角线互相平分；相等或垂直只在特殊平行四边形中成立。' },
    { difficulty: 2, stem: '在平行四边形 ABCD 中，∠A = 70°，则 ∠C 的度数是？', options: ['70°', '110°', '140°', '20°'], correctIndex: 0, explanation: '平行四边形对角相等，因此 ∠C = ∠A = 70°。' },
    { difficulty: 3, stem: '平行四边形 ABCD 的周长为 24，AB = 5，则 BC 的长为？', options: ['5', '7', '6', '12'], correctIndex: 1, explanation: '邻边之和为周长的一半：AB + BC = 12，所以 BC = 7。' }
  ],
  '一次函数': [
    { difficulty: 1, stem: '一次函数 y = −2x + 3 的图像经过哪几个象限？', options: ['第一、二、三象限', '第一、二、四象限', '第一、三、四象限', '第二、三、四象限'], correctIndex: 1, explanation: 'k < 0 时图像从左上到右下，b > 0 时与 y 轴正半轴相交，经过第一、二、四象限。' },
    { difficulty: 2, stem: '一次函数 y = 3x − 6 的图像与 x 轴的交点坐标是？', options: ['(0, −6)', '(−2, 0)', '(2, 0)', '(0, 2)'], correctIndex: 2, explanation: '令 y = 0，得 3x − 6 = 0，x = 2，交点为 (2, 0)。' },
    { difficulty: 3, stem: '一次函数 y = kx + b 的图像经过点 (1, 3) 和 (−1, 5)，则 k、b 的值是？', options: ['k = −1，b = 4', 'k = 1，b = 2', 'k = −2，b = 5', 'k = 2，b = 1'], correctIndex: 0, explanation: '代入两点得 k + b = 3，−k + b = 5；两式相加得 b = 4，再得 k = −1。' }
  ],
  '数据分析': [
    { difficulty: 1, stem: '一组数据 3，5，5，7，10 的众数是？', options: ['5', '3', '6', '7'], correctIndex: 0, explanation: '出现次数最多的数据是 5，因此众数为 5。' },
    { difficulty: 2, stem: '数据 4，6，8，10 的平均数是？', options: ['6', '8', '9', '7'], correctIndex: 3, explanation: '平均数 = (4 + 6 + 8 + 10) ÷ 4 = 7。' },
    { difficulty: 3, stem: '数据 1，3，5，7，9 的方差是？', options: ['4', '8', '10', '40'], correctIndex: 1, explanation: '平均数为 5，方差 = (16 + 4 + 0 + 4 + 16) ÷ 5 = 8。' }
  ],
  '一元二次方程': [
    { difficulty: 1, stem: '方程 x² − 5x + 6 = 0 的解是？', options: ['x₁ = 2，x₂ = 3', 'x₁ = −2，x₂ = −3', 'x₁ = 1，x₂ = 6', 'x₁ = −1，x₂ = −6'], correctIndex: 0, explanation: '因式分解得 (x − 2)(x − 3) = 0，所以 x₁ = 2，x₂ = 3。' },
    { difficulty: 2, stem: '若关于 x 的方程 x² − 4x + c = 0 有两个相等的实数根，则 c 的值是？', options: ['2', '4', '8', '16'], correctIndex: 1, explanation: '判别式 Δ = 16 − 4c = 0，解得 c = 4。' },
    { difficulty: 3, stem: '某商品原价 200 元，连续两次降价且每次降价的百分率相同，现价为 128 元，则每次降价的百分率是？', options: ['10%', '15%', '20%', '36%'], correctIndex: 2, explanation: '设每次降价率为 x，则 200(1 − x)² = 128，(1 − x)² = 0.64，取正值得 x = 0.2，即 20%。' }
  ],
  '旋转与圆': [
    { difficulty: 1, stem: '一个图形绕某点旋转 180° 后能与原图形重合，这个图形一定是？', options: ['轴对称图形', '中心对称图形', '等边三角形', '无法确定'], correctIndex: 1, explanation: '绕某点旋转 180° 后与自身重合，是中心对称图形的定义。' },
    { difficulty: 2, stem: '钟表的分针从 12 点位置走到 3 点位置，转过的角度是？', options: ['30°', '60°', '90°', '180°'], correctIndex: 2, explanation: '表盘每相邻两个大格之间为 30°，从 12 到 3 共 3 格，转过的角度为 90°。' },
    { difficulty: 3, stem: '在半径为 5 的圆中，一条弦的长为 8，则圆心到这条弦的距离是？', options: ['2', '4', '5', '3'], correctIndex: 3, explanation: '弦的一半为 4，由垂径定理和勾股定理得距离 = √(5² − 4²) = 3。' }
  ],
  '圆的性质与证明': [
    { difficulty: 1, stem: '同圆中，同弧所对的圆周角与圆心角的关系是？', options: ['圆周角是圆心角的一半', '相等', '圆周角是圆心角的两倍', '互补'], correctIndex: 0, explanation: '同弧所对的圆周角等于圆心角的一半。' },
    { difficulty: 2, stem: '若圆的半径为 6，则直径所对的圆周角的度数是？', options: ['30°', '60°', '90°', '180°'], correctIndex: 2, explanation: '直径所对的圆周角是直角，为 90°。' },
    { difficulty: 3, stem: '圆内接四边形 ABCD 中，∠A = 80°，则 ∠C 的度数是？', options: ['80°', '90°', '160°', '100°'], correctIndex: 3, explanation: '圆内接四边形对角互补，∠C = 180° − 80° = 100°。' }
  ],
  '相似三角形': [
    { difficulty: 1, stem: '若两个三角形的对应角相等、对应边成比例，则这两个三角形？', options: ['相似', '全等', '面积相等', '周长相等'], correctIndex: 0, explanation: '对应角相等且对应边成比例是相似三角形的定义。' },
    { difficulty: 2, stem: '若 △ABC ∽ △DEF，相似比为 1 : 2，则它们的面积比为？', options: ['1 : 2', '2 : 1', '1 : 4', '1 : 1'], correctIndex: 2, explanation: '相似三角形面积比等于相似比的平方，即 1² : 2² = 1 : 4。' },
    { difficulty: 3, stem: '身高 1.6 m 的小明在阳光下的影长为 2 m，同一时刻某旗杆的影长为 10 m，则旗杆的高度为？', options: ['6 m', '8 m', '10 m', '12.5 m'], correctIndex: 1, explanation: '同一时刻物高与影长成比例：1.6 : 2 = h : 10，解得 h = 8 m。' }
  ],
  '锐角三角函数': [
    { difficulty: 1, stem: '在 Rt△ABC 中，∠C = 90°，则 sin A 等于？', options: ['BC/AB', 'AC/AB', 'BC/AC', 'AC/BC'], correctIndex: 0, explanation: '∠A 的对边是 BC，斜边是 AB，所以 sin A = BC/AB。' },
    { difficulty: 2, stem: 'sin 30° + cos 60° 的值是？', options: ['0.5', '1', '√2', '√3'], correctIndex: 1, explanation: 'sin 30° = 0.5，cos 60° = 0.5，相加得 1。' },
    { difficulty: 3, stem: '在 Rt△ABC 中，∠C = 90°，AC = 3，BC = 4，则 tan A 的值是？', options: ['3/4', '3/5', '4/3', '4/5'], correctIndex: 2, explanation: 'tan A = ∠A 的对边/邻边 = BC/AC = 4/3。' }
  ],
  '概率与统计综合': [
    { difficulty: 1, stem: '掷一枚质地均匀的骰子，出现点数为 3 的概率是？', options: ['1/2', '1/3', '1/6', '1/12'], correctIndex: 2, explanation: '骰子有 6 个等可能结果，点数为 3 只有 1 种，概率为 1/6。' },
    { difficulty: 2, stem: '一个不透明的袋中有 2 个红球和 3 个白球，除颜色外都相同，随机摸出一个球是红球的概率是？', options: ['2/5', '1/5', '3/5', '2/3'], correctIndex: 0, explanation: '共有 5 个球，其中红球 2 个，概率为 2/5。' },
    { difficulty: 3, stem: '甲、乙两人各掷一次质地均匀的骰子，点数之和为 7 的概率是？', options: ['1/12', '1/9', '1/6', '1/3'], correctIndex: 2, explanation: '共有 36 种等可能结果，和为 7 的有 6 种，概率为 6/36 = 1/6。' }
  ]
}

const scienceItems = {
  '欧姆定律': { stem: '在电阻保持不变时，电压增大，电流会怎样变化？', options: ['随电压增大而增大', '随电压增大而减小', '保持不变', '一定变为零'], correctIndex: 0, explanation: '根据欧姆定律 I = U / R，电阻不变时电流与电压成正比。' },
  '化学方程式': { stem: '配平化学方程式时，通常可以改变哪些量？', options: ['化学式前的系数', '物质的化学式下标', '元素种类', '生成物种类'], correctIndex: 0, explanation: '配平只调整化学式前的化学计量数，不改变物质组成。' },
  '细胞结构与功能': { stem: '植物细胞中，通常含有而动物细胞通常没有的结构组合是？', options: ['细胞壁、叶绿体、大液泡', '细胞膜、细胞质、细胞核', '线粒体、细胞膜、细胞核', '细胞质、核糖体、细胞膜'], correctIndex: 0, explanation: '植物细胞常见结构包括细胞壁、叶绿体和较大的液泡。' }
}

const selfAssessmentLabels = {
  concept: ['核心概念辨析', '定义与条件判断', '概念关系判断', '关键性质理解', '概念边界判断', '知识结构判断'],
  'basic-application': ['基础情境应用', '公式与方法选择', '步骤顺序判断', '简单数据应用', '条件代入应用', '基础方法迁移'],
  transfer: ['综合情境迁移', '跨知识点判断', '信息变化分析', '解决策略选择', '模型迁移应用', '综合结论判断'],
  'error-analysis': ['常见错误辨析', '易混概念判断', '解题陷阱识别', '结果合理性检查', '条件遗漏检查', '方法纠错判断']
}

function questionTextKey(value) {
  return String(value || '').replace(/\s+/g, '').trim()
}

// 离线题库按 attempt 与题序轮换原创客观题，保证阶段复测和同卷多题不重复题面。
function buildLocalObjectiveVariant(chapterName, bank, attempt, index = 0) {
  const items = Array.isArray(bank) ? bank : [bank]
  const step = (Math.max(1, attempt) - 1) + Math.max(0, index)
  const variant = step % 6
  const base = items[step % items.length] || items[0]
  if (chapterName.includes('有理数与数轴')) {
    const values = [-3, -5, -8, -7, -6, -9]
    const value = values[variant]
    const answer = Math.abs(value)
    return { ...base, stem: `数轴上表示 ${value} 的点到原点的距离是多少？`, options: [String(value), String(answer), '0', String(answer + 1)], correctIndex: 1, explanation: `点到原点的距离是绝对值，因此为 |${value}| = ${answer}。` }
  }
  if (chapterName.includes('一元一次方程')) {
    const values = [[2, 3, 4], [3, 2, 5], [4, 5, 3], [5, 1, 2], [6, 4, 3], [7, 6, 2]]
    const [a, b, x] = values[variant]
    const result = a * x
    return { ...base, stem: `解方程 ${a}x + ${b} = ${result + b} 时，先从等式两边同时减去 ${b}，得到什么？`, options: [`${a}x = ${result}`, `${a}x = ${result + b}`, `x = ${result}`, `${a}x = ${result - b}`], correctIndex: 0, explanation: `等式两边同时减去 ${b}，得到 ${a}x = ${result}。` }
  }
  if (chapterName.includes('二次函数')) {
    const values = [[2, 1], [-3, 2], [4, -1], [1, 3], [-2, 0], [5, -4]]
    const [h, k] = values[variant]
    const hText = h < 0 ? `x + ${Math.abs(h)}` : `x − ${h}`
    return { ...base, stem: `抛物线 y = (${hText})² ${k < 0 ? '− ' + Math.abs(k) : '+ ' + k} 的顶点坐标是什么？`, options: [`(${h}, ${k})`, `(${-h}, ${k})`, `(${h}, ${-k})`, `(${k}, ${h})`], correctIndex: 0, explanation: `顶点式 y = (x − h)² + k 的顶点为 (${h}, ${k})。` }
  }
  if (chapterName.includes('勾股定理')) {
    const values = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 12, 15], [6, 8, 10]]
    const [a, b, c] = values[variant]
    return { ...base, stem: `直角三角形两条直角边为 ${a} 和 ${b}，斜边长度是多少？`, options: [String(c), String(c + 1), String(c - 1), String(a + b)], correctIndex: 0, explanation: `由勾股定理，斜边平方为 ${a}² + ${b}² = ${c}²，因此斜边长为 ${c}。` }
  }
  if (chapterName.includes('函数的概念与性质')) {
    const slopes = [2, -3, 4, -1, 5, -2]
    const slope = slopes[variant]
    return { ...base, stem: `一次函数 y = ${slope}x + 2 中，当 x 增加 1 时，y 的变化量是多少？`, options: [String(slope + 1), String(slope), String(slope - 1), '0'], correctIndex: 1, explanation: `一次函数的斜率为 ${slope}，x 增加 1 时 y 的变化量为 ${slope}。` }
  }
  if (chapterName.includes('欧姆定律')) {
    const values = [[6, 2], [12, 3], [15, 5], [8, 4], [18, 6], [20, 4]]
    const [voltage, resistance] = values[variant]
    const current = voltage / resistance
    return { ...base, stem: `某电路电阻保持 ${resistance} Ω，电压为 ${voltage} V，电流是多少？`, options: [`${current} A`, `${current + 1} A`, `${current * 2} A`, `${resistance} A`], correctIndex: 0, explanation: `根据欧姆定律 I = U / R = ${voltage} / ${resistance} = ${current} A。` }
  }
  if (chapterName.includes('化学方程式')) {
    const equations = [
      ['H₂ + O₂ → H₂O', ['2, 1, 2', '1, 1, 1', '2, 2, 2', '1, 2, 1'], 0],
      ['N₂ + H₂ → NH₃', ['1, 3, 2', '1, 1, 1', '2, 3, 2', '1, 2, 3'], 0],
      ['Fe + O₂ → Fe₂O₃', ['4, 3, 2', '2, 1, 1', '2, 3, 2', '3, 2, 1'], 0],
      ['Al + O₂ → Al₂O₃', ['4, 3, 2', '2, 3, 1', '1, 1, 1', '4, 2, 3'], 0],
      ['Mg + O₂ → MgO', ['2, 1, 2', '1, 1, 1', '2, 2, 2', '1, 2, 1'], 0],
      ['HCl + NaOH → NaCl + H₂O', ['1, 1, 1, 1', '2, 1, 1, 1', '1, 2, 1, 2', '2, 2, 1, 1'], 0]
    ]
    const [equation, options, correctIndex] = equations[variant]
    return { ...base, stem: `配平 ${equation}，按方程式中物质出现的顺序，系数应为哪一组？`, options, correctIndex, explanation: `依据反应前后各元素原子数守恒，${equation} 的最简整数系数为 ${options[correctIndex]}。` }
  }
  if (chapterName.includes('细胞结构与功能')) {
    const variants = [
      { stem: '植物细胞中，通常含有而动物细胞通常没有的结构组合是？', options: ['细胞壁、叶绿体、大液泡', '细胞膜、细胞质、细胞核', '线粒体、细胞膜、细胞核', '细胞质、核糖体、细胞膜'], correctIndex: 0, explanation: '植物细胞通常具有细胞壁，绿色部分细胞含叶绿体，并常有较大的液泡。' },
      { stem: '植物细胞进行光合作用的主要场所是？', options: ['叶绿体', '线粒体', '细胞核', '液泡'], correctIndex: 0, explanation: '叶绿体含有叶绿素，是植物细胞进行光合作用的主要场所。' },
      { stem: '植物细胞壁最主要的作用是什么？', options: ['支持和保护细胞', '控制遗传信息', '合成蛋白质', '储存遗传物质'], correctIndex: 0, explanation: '细胞壁位于细胞膜外侧，主要起支持和保护作用。' },
      { stem: '植物细胞中，储存细胞液并与细胞吸水、失水有关的结构是？', options: ['液泡', '叶绿体', '细胞核', '核糖体'], correctIndex: 0, explanation: '液泡内含细胞液，参与细胞水分和部分物质的储存。' },
      { stem: '下列哪种结构通常存在于植物细胞而动物细胞没有？', options: ['细胞壁', '细胞膜', '细胞质', '线粒体'], correctIndex: 0, explanation: '植物细胞有细胞壁；细胞膜、细胞质和线粒体也可见于动物细胞。' },
      { stem: '观察植物细胞时，能帮助维持细胞形态并位于细胞膜外侧的是？', options: ['细胞壁', '细胞核', '液泡', '叶绿体'], correctIndex: 0, explanation: '细胞壁位于细胞膜外侧，具有支持和保护作用。' }
    ]
    return { ...base, ...variants[variant] }
  }
  return base
}

export function buildFallbackDiagnosticQuestions({ grade, subject, chapters = [], questionCount, attempt = 1, excludeQuestions = [] } = {}) {
  const banks = subject === '数学' ? mathItems : ['物理', '化学', '生物'].includes(subject) ? scienceItems : {}
  const { blueprint } = buildDiagnosticBlueprint(chapters, questionCount)
  const excludedStems = new Set(excludeQuestions.map(question => questionTextKey(question?.stem)).filter(Boolean))
  const attemptNumber = Math.max(1, Number(attempt) || 1)
  const questions = blueprint.flatMap(item => Array.from({ length: item.count }, (_, index) => {
    const chapter = chapters.find(candidate => candidate.id === item.chapterId)
    const bank = Object.entries(banks).find(([key]) => chapter.name.includes(key))?.[1]
    const dimension = item.dimensions[index] || 'transfer'
    const localObjective = bank ? buildLocalObjectiveVariant(chapter.name, bank, attemptNumber, index) : null
    if (localObjective && !excludedStems.has(questionTextKey(localObjective.stem))) {
      const bankQuestion = { id: `local-${chapter.id}-${attemptNumber}-${index + 1}`, chapterId: chapter.id, chapterName: chapter.name, type: 'single', dimension, difficulty: 1, ...localObjective }
      excludedStems.add(questionTextKey(bankQuestion.stem))
      return bankQuestion
    }
    const labels = selfAssessmentLabels[dimension] || selfAssessmentLabels.transfer
    let label = labels[(attemptNumber - 1 + index) % labels.length]
    let stem = `关于“${chapter.name}”的${label}，下面哪项最符合你现在的学习状态？`
    for (let offset = 0; excludedStems.has(questionTextKey(stem)) && offset < labels.length; offset += 1) {
      label = labels[(attemptNumber - 1 + index + offset + 1) % labels.length]
      stem = `关于“${chapter.name}”的${label}，下面哪项最符合你现在的学习状态？`
    }
    if (excludedStems.has(questionTextKey(stem))) stem = `${stem.slice(0, -1)}（第${attemptNumber}轮）？`
    excludedStems.add(questionTextKey(stem))
    return {
      id: `self-${chapter.id}-${attemptNumber}-${index + 1}`, chapterId: chapter.id, chapterName: chapter.name, type: 'self-check', dimension,
      stem,
      options: ['我还没学过，希望从基础开始', '我听过这个知识点，但还不太会用', '我能完成基础题，综合题还需要练习', '我能独立解释并解决综合问题'],
      correctIndex: null, explanation: '这是无 AI 服务时的自评题，会按不同能力维度估算起点，不会当作客观题正确率。',
      masteryByOption: [0, 1, 2, 3], selfAssessment: true
    }
  }))
  return { questions, source: questions.some(item => item.selfAssessment) ? 'local-self-check' : 'local-question-bank', grade, subject }
}

export function buildAdaptivePlan({ grade, subject, edition = '', chapters = [], masteryByChapter = {}, dailyMinutes = 60, targetScore, targetFullScore, baselineScore } = {}) {
  const directory = listCurriculumChapters(grade, subject, edition).chapters
  const selected = chapters.map(chapter => typeof chapter === 'string'
    ? directory.find(item => item.id === chapter) || directory.find(item => item.name === chapter)
    : directory.find(item => item.id === chapter.id) || chapter).filter(Boolean).sort((a, b) => a.order - b.order)
  if (!selected.length) return { plans: [], explanation: '请至少选择一个学习专题。' }

  const now = Date.now()
  // 目标分与最近一次成绩构成差距：差距越大越偏向概念与复盘，差距越小越把时间让给迁移。
  // 用连续系数而不是三档开关，成绩从 85 改到 40 时任务时长才会真的变化。
  // 没有成绩基线时不调整，避免只凭一个目标数字改变计划结构。
  const fullScore = Number(targetFullScore) || 0
  const latestScore = Number(baselineScore)
  const gapRate = fullScore > 0 && Number.isFinite(latestScore) && latestScore >= 0
    ? Math.max(0, Math.min(1, (Number(targetScore) - latestScore) / fullScore))
    : null
  const clampBias = (value, min, max) => Math.max(min, Math.min(max, value))
  const stageBias = gapRate === null ? null : {
    concept: clampBias(0.85 + gapRate * 1.2, 0.85, 1.35),
    example: 1,
    transfer: clampBias(1.2 - gapRate * 1.2, 0.9, 1.3),
    review: clampBias(1 + gapRate * 1.2, 1, 1.35)
  }
  const tasks = []
  for (let index = 0; index < selected.length; index += 1) {
    const chapter = selected[index]
    const previous = selected[index - 1]
    const mastery = Math.max(0, Math.min(3, Number(masteryByChapter[chapter.id]) || 0))
    if (previous && chapter.order - previous.order > 1) {
      const gap = directory.filter(item => item.order > previous.order && item.order < chapter.order)
      tasks.push({
        id: `bridge-${now}-${index}`, name: `基础衔接复习：${gap[0]?.name || '前置知识'}`,
        subject, estimatedMinutes: Math.min(15, Math.max(8, Math.round((dailyMinutes || 60) * .15))),
        priority: '中', reviewTime: now, knowledgeTags: gap.map(item => item.name), chapterIds: gap.map(item => item.id),
        isBridge: true, status: 'active', createdAt: now + index,
        sequenceOrder: tasks.length + 1, reason: `补齐 ${previous.name} 到 ${chapter.name} 之间的前置知识。`
      })
    }
    // 每个专题固定四阶段：概念→例题→迁移→复盘，时长按每日可用时长分配，四个阶段跨天完成。
    const budget = Math.max(10, Number(dailyMinutes) || 60)
    const stageTasks = [
      { stage: 'concept', suffix: '概念梳理', weight: mastery === 0 ? .32 : .25, days: 1, tag: '概念理解', reason: '先把定义、性质与适用条件梳理清楚，再看典型例题。' },
      { stage: 'example', suffix: '例题模仿', weight: .25, days: 2, tag: '例题精练', reason: '跟着例题走一遍步骤，模仿解题过程后独立重做。' },
      { stage: 'transfer', suffix: '迁移应用', weight: .28, days: 3, tag: '变式迁移', reason: '换情境、换条件做变式，检验能不能把方法用出去。' },
      { stage: 'review', suffix: '复盘纠错', weight: .15, days: 7, tag: '错题复盘', reason: '回看错题和卡住的地方，整理成可复用的解题清单。' }
    ]
    stageTasks.forEach((task, order) => {
      tasks.push({
        id: `chapter-${chapter.id}-${now}-${task.stage}`,
        name: `${chapter.name} · ${task.suffix}`,
        subject,
        stage: task.stage,
        estimatedMinutes: Math.max(8, Math.min(40, Math.round(budget * task.weight * (stageBias?.[task.stage] || 1)))),
        priority: task.stage === 'concept' || task.stage === 'example'
          ? (mastery <= 1 || chapter.importance >= 5 ? '高' : '中')
          : task.stage === 'transfer' ? '中' : '低',
        reviewTime: now + task.days * 86400000,
        knowledgeTags: [chapter.name, task.tag],
        chapterId: chapter.id, chapterIds: [chapter.id], masteryBefore: mastery, isBridge: false,
        status: 'active', createdAt: now + index * 4 + order, sequenceOrder: tasks.length + 1,
        reason: task.reason
      })
    })
  }
  return {
    plans: tasks.filter(task => task.estimatedMinutes > 0),
    explanation: `按 ${grade} ${subject} 的专题先后关系整理。优先处理掌握度较低、课程依赖更强的内容；跨越专题时插入灰色衔接复习任务。${gapRate === null ? '' : `最近一次成绩 ${latestScore}/${fullScore}，与目标 ${targetScore} 分相差 ${Math.max(0, Math.round(Number(targetScore) - latestScore))} 分，任务配比已按差距调整。`}`,
    sources: CURRICULUM_SOURCES
  }
}
