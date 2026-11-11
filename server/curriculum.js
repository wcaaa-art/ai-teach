// 课程目录按教育部课程标准的学段、学科范围整理为可搜索的本地知识点索引。
// 单元名称是跨教材版本的知识专题，不冒充某一家出版社的目录；题目由模型按专题生成。
import { listTextbookEditionMap, resolveTextbookEdition, textbookEditionChapters } from './textbooks.js'

export const CURRICULUM_SOURCES = [
  { name: '教育部义务教育课程方案和课程标准（2022年版）', url: 'https://hudong.moe.gov.cn/srcsite/A26/s8001/202204/t20220420_619921.html' },
  { name: '教育部普通高中课程方案和各学科课程标准（2017年版2020年修订）', url: 'https://hudong.moe.gov.cn/jyb_xxgk/xxgk/neirong/fenlei/kcjc/kcjc_js/jcjs_kcbz/' }
]

const catalog = {
  '初一': {
    '语文': ['七上：散文与生活体验', '七上：叙事与人物描写', '七上：古诗文入门', '七下：精读与略读', '七下：说明文初步', '七下：文言文基础'],
    '数学': ['有理数与数轴', '整式加减', '一元一次方程', '几何图形初步', '相交线与平行线', '实数与平方根', '平面直角坐标系', '二元一次方程组', '不等式与不等式组', '数据收集与整理'],
    '英语': ['日常交际与自我介绍', '一般现在时', '名词与代词', 'There be 句型', '一般过去时入门', '阅读策略与语篇理解'],
    '历史': ['中华文明起源与早期国家', '夏商周与春秋战国', '秦汉统一多民族国家', '三国两晋南北朝', '隋唐时期'],
    '地理': ['地球与地图', '陆地与海洋', '天气与气候', '居民与聚落', '亚洲与地区地理'],
    '生物': ['生物与环境', '生物体的结构层次', '绿色植物', '人体的营养与呼吸', '人体生命活动调节'],
    '道德与法治': ['成长中的我', '友谊与交往', '师长情谊', '生命安全与健康', '法律与规则入门']
  },
  '初二': {
    '语文': ['八上：新闻与传记阅读', '八上：说明文阅读', '八上：古诗文积累', '八下：散文阅读', '八下：议论文入门', '八下：文言文理解'],
    '数学': ['三角形与全等', '轴对称与等腰三角形', '整式乘法与因式分解', '分式', '二次根式', '勾股定理', '平行四边形', '一次函数', '数据分析'],
    '英语': ['一般过去时与过去进行时', '现在完成时入门', '情态动词与被动语态', '宾语从句入门', '阅读理解策略', '书面表达组织'],
    '物理': ['机械运动', '声现象', '光现象', '透镜及其应用', '质量与密度', '力与运动', '压强与浮力'],
    '历史': ['辽宋夏金元时期', '明清时期', '中国近代化的起步', '新民主主义革命', '中国现代史概览'],
    '地理': ['中国疆域与行政区划', '中国人口与民族', '中国地形与气候', '中国自然资源', '中国区域地理'],
    '生物': ['生物圈中的绿色植物', '人体生命活动', '动物的运动与行为', '生物多样性', '生物的生殖与遗传'],
    '道德与法治': ['青春成长与自我认识', '情绪情感与调节', '社会生活与规则', '权利与义务', '国家利益与国家安全']
  },
  '初三': {
    '语文': ['九上：议论文阅读与论证', '九上：小说与人物', '九上：古诗文专题', '九下：文学作品鉴赏', '九下：文言文比较阅读', '中考阅读与写作整合'],
    '数学': ['一元二次方程', '二次函数', '旋转与圆', '圆的性质与证明', '相似三角形', '锐角三角函数', '概率与统计综合'],
    '英语': ['宾语从句与定语从句', '被动语态综合', '情态动词与时态复习', '完形填空策略', '阅读理解与推断', '中考写作结构'],
    '物理': ['浮力与压强综合', '功与机械能', '内能与热机', '电流与电路', '欧姆定律', '电功率与家庭电路', '电磁现象'],
    '化学': ['物质构成与化学用语', '化学方程式', '空气与氧气', '水与溶液', '金属与酸碱盐', '化学实验与探究', '化学计算综合'],
    '历史': ['中国近代史', '中华民族抗争与探索', '中华人民共和国成立与发展', '世界近代史', '世界现代史', '历史材料分析'],
    '地理': ['中国区域地理综合', '世界区域地理综合', '人口资源环境', '地图判读与地理实践', '地理图表分析'],
    '生物': ['生物圈中的人', '生物的遗传与变异', '生物的进化', '生态系统与环境保护', '实验探究与图表分析'],
    '道德与法治': ['宪法与公民权利', '法治国家与法治生活', '国情与基本制度', '社会责任与担当', '时政材料分析']
  },
  '高一': {
    '语文': ['必修上：现代诗歌与文学阅读', '必修上：古代诗歌与文言文', '必修上：实用性阅读与交流', '必修下：小说与戏剧', '必修下：古代议论性散文', '必修下：表达与交流'],
    '数学': ['集合与常用逻辑用语', '一元二次函数与方程', '函数的概念与性质', '指数函数与对数函数', '三角函数', '平面向量', '复数与数学建模初步'],
    '英语': ['必修：主题语篇与阅读', '词汇构词与语境', '时态语态综合', '定语从句', '听说策略', '应用文写作'],
    '物理': ['运动的描述', '匀变速直线运动', '相互作用与牛顿运动定律', '抛体运动与圆周运动', '功和能', '动量与碰撞'],
    '化学': ['物质及其变化', '离子反应与氧化还原', '钠与氯及其化合物', '铁与金属材料', '原子结构与元素周期律', '化学键与物质结构'],
    '生物': ['细胞的分子组成', '细胞结构与功能', '细胞代谢', '细胞增殖与分化', '遗传信息的传递', '生物学实验设计'],
    '历史': ['中华文明起源与早期国家', '诸侯纷争与变法运动', '秦汉统一国家', '三国两晋南北朝', '隋唐至明清的国家治理'],
    '地理': ['地球运动与地图', '大气与水的运动', '地貌与土壤', '植被与自然环境', '人口与城镇', '区域发展与地理实践'],
    '政治': ['中国特色社会主义', '经济发展与社会进步', '政治制度与国家治理', '哲学与文化']
  },
  '高二': {
    '语文': ['选择性必修：思辨性阅读与表达', '古代诗文专题', '中国现当代文学', '外国文学与比较阅读', '学术论著与研讨', '写作论证与表达'],
    '数学': ['数列', '导数及其应用', '空间向量与立体几何', '直线与圆', '圆锥曲线', '计数原理', '概率与统计'],
    '英语': ['选择性必修主题阅读', '非谓语动词与复杂句', '语篇逻辑与推断', '概要写作', '议论文表达', '跨文化理解'],
    '物理': ['静电场', '电路与电能', '磁场与电磁感应', '交变电流与传感器', '机械振动与机械波', '光学与波粒二象性'],
    '化学': ['化学反应与热能', '化学反应速率与平衡', '水溶液中的离子平衡', '氧化还原与电化学', '有机化合物结构与性质', '化学实验探究'],
    '生物': ['稳态与调节', '生物的遗传规律', '基因与染色体', '生物进化', '生态系统', '生物技术与工程'],
    '历史': ['晚清至民国的国家转型', '中华人民共和国发展', '世界殖民体系与亚非拉', '两次世界大战与国际秩序', '现代化与全球联系'],
    '地理': ['自然环境整体性与差异性', '人口与区域发展', '产业区位与交通', '环境与国家安全', '区域发展案例研究'],
    '政治': ['经济与社会', '政治与法治', '哲学与文化', '当代国际政治与经济']
  },
  '高三': {
    '语文': ['现代文阅读综合', '古诗文阅读综合', '语言文字运用', '作文审题与论证', '跨文本比较阅读'],
    '数学': ['函数与导数综合', '三角函数与平面向量综合', '数列综合', '立体几何综合', '解析几何综合', '概率统计综合', '数学建模与综合应用'],
    '英语': ['阅读理解与七选五', '完形填空与语篇', '语法填空', '应用文写作', '读后续写', '听力与口语整合'],
    '物理': ['力学综合与实验', '电磁学综合', '热学与近代物理', '物理图像与模型', '实验设计与数据分析'],
    '化学': ['化学反应原理综合', '物质结构与元素周期律', '有机化学综合', '实验方案评价', '工艺流程与定量计算'],
    '生物': ['遗传规律与系谱分析', '稳态调节综合', '生态与环境', '实验探究与数据分析', '生物技术综合'],
    '历史': ['时空观念与阶段特征', '史料实证与历史解释', '中外历史比较', '历史论述题写作'],
    '地理': ['自然地理综合判读', '人文地理区位分析', '区域比较与发展', '地理过程与图表综合'],
    '政治': ['经济制度与高质量发展', '政治制度与法治', '哲学原理应用', '国际关系与时政分析']
  }
}

const importanceWeights = {
  '函数的概念与性质': 5, '二次函数': 5, '导数及其应用': 5, '函数与导数综合': 5,
  '一元二次方程': 4, '指数函数与对数函数': 4, '三角函数': 4, '数列': 4,
  '欧姆定律': 5, '电功率与家庭电路': 5, '化学方程式': 5, '化学反应与平衡': 5
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
  return String(grade).startsWith('高') ? '高中' : String(grade).startsWith('初') ? '初中' : ''
}

export function listCurriculumSubjects(stage, grade) {
  const normalizedStage = stage || stageOf(grade)
  const grades = Object.keys(catalog).filter(item => !normalizedStage || stageOf(item) === normalizedStage)
  const selectedGrade = grades.includes(grade) ? grade : grades[0]
  const subjects = Object.keys(catalog[selectedGrade] || {})
  return { stage: normalizedStage, grade: selectedGrade, grades, subjects, editions: listTextbookEditionMap(subjects), sources: CURRICULUM_SOURCES }
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
      unitLabel: resolved.slug === 'rjb' ? (renjiaoUnitLabels[subject]?.[normalizedGrade]?.[name] || '') : ''
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
  '概率与统计综合': ['随机事件', '频率'],
  '一元二次函数与方程': ['二次函数', '判别式', '顶点'],
  '导数及其应用': ['求导', '单调性', '极值']
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
  const normalized = catalog[requested] ? requested : (requested.startsWith('高') ? '高一' : '初三')
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

const mathItems = {
  '有理数与数轴': { stem: '数轴上表示 −3 的点到原点的距离是多少？', options: ['−3', '3', '0', '无法确定'], correctIndex: 1, explanation: '点到原点的距离是绝对值，因此为 |−3|。' },
  '一元一次方程': { stem: '若 2x + 3 = 11，先从等式两边同时减去 3，得到什么？', options: ['2x = 8', '2x = 14', 'x = 8', '2x = 11'], correctIndex: 0, explanation: '等式两边同时减去 3，得到 2x = 8。' },
  '二次函数': { stem: '抛物线 y = (x − 2)² + 1 的顶点坐标是什么？', options: ['(2, 1)', '(−2, 1)', '(2, −1)', '(1, 2)'], correctIndex: 0, explanation: '顶点式 y = (x − h)² + k 的顶点为 (h, k)。' },
  '勾股定理': { stem: '直角三角形两条直角边为 3 和 4，斜边长度是多少？', options: ['5', '6', '7', '12'], correctIndex: 0, explanation: '由勾股定理，斜边平方为 3² + 4² = 25。' },
  '函数的概念与性质': { stem: '函数 y = 2x + 1 中，当 x 增加 1 时，y 的变化量是多少？', options: ['增加 1', '增加 2', '减少 1', '不变'], correctIndex: 1, explanation: '一次函数的斜率为 2，x 增加 1 时 y 增加 2。' }
}

const scienceItems = {
  '欧姆定律': { stem: '在电阻保持不变时，电压增大，电流会怎样变化？', options: ['随电压增大而增大', '随电压增大而减小', '保持不变', '一定变为零'], correctIndex: 0, explanation: '根据欧姆定律 I = U / R，电阻不变时电流与电压成正比。' },
  '化学方程式': { stem: '配平化学方程式时，通常可以改变哪些量？', options: ['化学式前的系数', '物质的化学式下标', '元素种类', '生成物种类'], correctIndex: 0, explanation: '配平只调整化学式前的化学计量数，不改变物质组成。' },
  '细胞结构与功能': { stem: '植物细胞中，通常含有而动物细胞通常没有的结构组合是？', options: ['细胞壁、叶绿体、大液泡', '细胞膜、细胞质、细胞核', '线粒体、细胞膜、细胞核', '细胞质、核糖体、细胞膜'], correctIndex: 0, explanation: '植物细胞常见结构包括细胞壁、叶绿体和较大的液泡。' }
}

const physicsTopics = ['力学综合与实验', '电磁学综合', '热学与近代物理', '物理图像与模型', '实验设计与数据分析']

const selfAssessmentLabels = {
  concept: ['核心概念辨析', '定义与条件判断', '概念关系判断', '关键性质理解', '概念边界判断', '知识结构判断'],
  'basic-application': ['基础情境应用', '公式与方法选择', '步骤顺序判断', '简单数据应用', '条件代入应用', '基础方法迁移'],
  transfer: ['综合情境迁移', '跨知识点判断', '信息变化分析', '解决策略选择', '模型迁移应用', '综合结论判断'],
  'error-analysis': ['常见错误辨析', '易混概念判断', '解题陷阱识别', '结果合理性检查', '条件遗漏检查', '方法纠错判断']
}

function questionTextKey(value) {
  return String(value || '').replace(/\s+/g, '').trim()
}

// 离线题库为常见专题准备六个不同参数/情境的客观题版本，保证阶段复测不重复原题。
function buildLocalObjectiveVariant(chapterName, bank, attempt) {
  const variant = (Math.max(1, attempt) - 1) % 6
  if (chapterName.includes('有理数与数轴')) {
    const values = [-3, -5, -8, -7, -6, -9]
    const value = values[variant]
    const answer = Math.abs(value)
    return { ...bank, stem: `数轴上表示 ${value} 的点到原点的距离是多少？`, options: [String(value), String(answer), '0', String(answer + 1)], correctIndex: 1, explanation: `点到原点的距离是绝对值，因此为 |${value}| = ${answer}。` }
  }
  if (chapterName.includes('一元一次方程')) {
    const values = [[2, 3, 4], [3, 2, 5], [4, 5, 3], [5, 1, 2], [6, 4, 3], [7, 6, 2]]
    const [a, b, x] = values[variant]
    const result = a * x
    return { ...bank, stem: `解方程 ${a}x + ${b} = ${result + b} 时，先从等式两边同时减去 ${b}，得到什么？`, options: [`${a}x = ${result}`, `${a}x = ${result + b}`, `x = ${result}`, `${a}x = ${result - b}`], correctIndex: 0, explanation: `等式两边同时减去 ${b}，得到 ${a}x = ${result}。` }
  }
  if (chapterName.includes('二次函数')) {
    const values = [[2, 1], [-3, 2], [4, -1], [1, 3], [-2, 0], [5, -4]]
    const [h, k] = values[variant]
    const hText = h < 0 ? `x + ${Math.abs(h)}` : `x − ${h}`
    return { ...bank, stem: `抛物线 y = (${hText})² ${k < 0 ? '− ' + Math.abs(k) : '+ ' + k} 的顶点坐标是什么？`, options: [`(${h}, ${k})`, `(${-h}, ${k})`, `(${h}, ${-k})`, `(${k}, ${h})`], correctIndex: 0, explanation: `顶点式 y = (x − h)² + k 的顶点为 (${h}, ${k})。` }
  }
  if (chapterName.includes('勾股定理')) {
    const values = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 12, 15], [6, 8, 10]]
    const [a, b, c] = values[variant]
    return { ...bank, stem: `直角三角形两条直角边为 ${a} 和 ${b}，斜边长度是多少？`, options: [String(c), String(c + 1), String(c - 1), String(a + b)], correctIndex: 0, explanation: `由勾股定理，斜边平方为 ${a}² + ${b}² = ${c}²，因此斜边长为 ${c}。` }
  }
  if (chapterName.includes('函数的概念与性质')) {
    const slopes = [2, -3, 4, -1, 5, -2]
    const slope = slopes[variant]
    return { ...bank, stem: `一次函数 y = ${slope}x + 2 中，当 x 增加 1 时，y 的变化量是多少？`, options: [String(slope + 1), String(slope), String(slope - 1), '0'], correctIndex: 1, explanation: `一次函数的斜率为 ${slope}，x 增加 1 时 y 的变化量为 ${slope}。` }
  }
  if (chapterName.includes('欧姆定律')) {
    const values = [[6, 2], [12, 3], [15, 5], [8, 4], [18, 6], [20, 4]]
    const [voltage, resistance] = values[variant]
    const current = voltage / resistance
    return { ...bank, stem: `某电路电阻保持 ${resistance} Ω，电压为 ${voltage} V，电流是多少？`, options: [`${current} A`, `${current + 1} A`, `${current * 2} A`, `${resistance} A`], correctIndex: 0, explanation: `根据欧姆定律 I = U / R = ${voltage} / ${resistance} = ${current} A。` }
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
    return { ...bank, stem: `配平 ${equation}，按方程式中物质出现的顺序，系数应为哪一组？`, options, correctIndex, explanation: `依据反应前后各元素原子数守恒，${equation} 的最简整数系数为 ${options[correctIndex]}。` }
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
    return { ...bank, ...variants[variant] }
  }
  return bank
}

// 高中物理离线题采用新课标高考常见的情境、实验和计算能力结构编写原创变式。
// 用 attempt 和 questionIndex 改变数据与设问，保证阶段性复测前六轮不复用题面。
function buildPhysicsQuestion(chapterName, attempt, questionIndex) {
  const seed = (Math.max(1, Number(attempt) || 1) - 1) * 10 + Math.max(0, Number(questionIndex) || 0)
  const variant = Math.floor(seed / 10) % 6
  const type = seed % 10
  const number = 2 + variant
  const base = { type: 'single', difficulty: type >= 7 ? 3 : type >= 4 ? 2 : 1 }
  if (chapterName.includes('力学') || chapterName.includes('运动') || chapterName.includes('功与机械能') || chapterName.includes('动量') || chapterName.includes('实验')) {
    if (type === 0) {
      const distance = (number + 2) * 10
      const time = number + 2
      const speed = distance / time
      return { ...base, dimension: 'basic-application', stem: `一物体做匀速直线运动，${time} s 内通过 ${distance} m，则其速度大小为？`, options: [`${speed} m/s`, `${speed + 2} m/s`, `${distance + time} m/s`, `${time / distance} m/s`], correctIndex: 0, explanation: `匀速运动速度 v = s/t = ${distance}/${time} = ${speed} m/s。` }
    }
    if (type === 1) {
      const acceleration = number + 1
      const time = 2 + (variant % 3)
      const finalSpeed = acceleration * time
      return { ...base, dimension: 'concept', stem: `物体由静止开始做匀加速直线运动，加速度为 ${acceleration} m/s²，经过 ${time} s 时速度为？`, options: [`${finalSpeed} m/s`, `${acceleration + time} m/s`, `${finalSpeed / 2} m/s`, `${acceleration * time * 2} m/s`], correctIndex: 0, explanation: `由 v = v₀ + at，v₀ = 0，所以 v = ${acceleration}×${time} = ${finalSpeed} m/s。` }
    }
    if (type === 2) {
      const mass = number + 1
      const acceleration = 2 + (variant % 3)
      const force = mass * acceleration
      return { ...base, dimension: 'basic-application', stem: `质量为 ${mass} kg 的物体受到合力作用，产生 ${acceleration} m/s² 的加速度，合力大小为？`, options: [`${force} N`, `${mass + acceleration} N`, `${force / 2} N`, `${mass / acceleration} N`], correctIndex: 0, explanation: `根据牛顿第二定律 F = ma = ${mass}×${acceleration} = ${force} N。` }
    }
    if (type === 3) {
      const mass = number + 1
      const velocity = 3 + variant
      const energy = 0.5 * mass * velocity * velocity
      return { ...base, dimension: 'transfer', stem: `质量为 ${mass} kg 的物体以 ${velocity} m/s 的速度运动，其动能为？`, options: [`${energy} J`, `${mass * velocity} J`, `${mass * velocity * velocity} J`, `${energy * 2} J`], correctIndex: 0, explanation: `动能 Eₖ = ½mv² = ½×${mass}×${velocity}² = ${energy} J。` }
    }
    if (type === 4) {
      const mass = number + 1
      const height = 2 + variant
      const energy = mass * 10 * height
      return { ...base, dimension: 'transfer', stem: `取 g = 10 m/s²，质量为 ${mass} kg 的物体升高 ${height} m，重力势能增加多少？`, options: [`${energy} J`, `${mass * height} J`, `${energy / 2} J`, `${mass * 10} J`], correctIndex: 0, explanation: `重力势能增加量 ΔEₚ = mgΔh = ${mass}×10×${height} = ${energy} J。` }
    }
    if (type === 5) {
      const mass = number + 1
      const velocity = 4 + variant
      const momentum = mass * velocity
      return { ...base, dimension: 'transfer', stem: `质量为 ${mass} kg 的小球以 ${velocity} m/s 的速度沿直线运动，其动量大小为？`, options: [`${momentum} kg·m/s`, `${mass + velocity} kg·m/s`, `${velocity / mass} kg·m/s`, `${momentum * 2} kg·m/s`], correctIndex: 0, explanation: `动量 p = mv = ${mass}×${velocity} = ${momentum} kg·m/s。` }
    }
    if (type === 6) {
      const force = 10 + variant * 2
      const distance = 2 + variant
      const work = force * distance
      return { ...base, dimension: 'basic-application', stem: `物体在恒定水平力 ${force} N 作用下沿力方向移动 ${distance} m，力对物体做功为？`, options: [`${work} J`, `${force + distance} J`, `${work / 2} J`, `${force / distance} J`], correctIndex: 0, explanation: `力与位移同向，W = Fs = ${force}×${distance} = ${work} J。` }
    }
    if (type === 7) {
      const deltaV = 6 + variant
      const deltaT = 2 + (variant % 2)
      const acceleration = deltaV / deltaT
      return { ...base, dimension: 'error-analysis', stem: `实验中测得物体在 ${deltaT} s 内速度变化 ${deltaV} m/s，则由 a = Δv/Δt 求得加速度为？`, options: [`${acceleration} m/s²`, `${deltaV * deltaT} m/s²`, `${deltaV + deltaT} m/s²`, `${deltaT / deltaV} m/s²`], correctIndex: 0, explanation: `加速度 a = Δv/Δt = ${deltaV}/${deltaT} = ${acceleration} m/s²。` }
    }
    if (type === 8) {
      const mass = number + 1
      const force = mass * (variant + 2)
      return { ...base, dimension: 'error-analysis', stem: `用控制变量法探究加速度与合力的关系时，若质量保持 ${mass} kg 不变，合力增大，正确结论是？`, options: ['加速度随合力增大而增大', '加速度随合力增大而减小', '加速度保持不变', '无法判断任何关系'], correctIndex: 0, explanation: `质量一定时由 F = ma 可知 a = F/m，加速度与合力成正比；本组实验中的合力可取 ${force} N 进行比较。` }
    }
    const mass = number + 1
    const force = 2 * mass
    const initialAcceleration = force / mass
    return { ...base, dimension: 'error-analysis', stem: `“探究加速度与力的关系”实验中，小车质量保持 ${mass} kg，合力由 ${force} N 增大为 ${force * 2} N。若其他条件不变，加速度应如何变化？`, options: ['由 2 m/s² 增大为 4 m/s²', '由 2 m/s² 减小为 1 m/s²', '始终为 2 m/s²', '仅凭质量无法判断'], correctIndex: 0, explanation: `质量不变时 a = F/m。初始加速度为 ${force}/${mass} = ${initialAcceleration} m/s²；合力加倍后加速度也加倍。` }
  }
  if (chapterName.includes('图像') || chapterName.includes('模型')) {
    if (type % 2 === 0) {
      const time = variant + 2
      const velocity = variant + 3
      const displacement = time * velocity
      return { ...base, dimension: 'concept', stem: `某物体的位移—时间图像是一条直线，${time} s 内位移由 0 增至 ${displacement} m。图线斜率表示的速度大小为？`, options: [`${velocity} m/s`, `${displacement} m/s`, `${time} m/s`, `${displacement + time} m/s`], correctIndex: 0, explanation: `位移—时间图像的斜率表示速度，v = Δx/Δt = ${displacement}/${time} = ${velocity} m/s。` }
    }
    const time = variant + 2
    const acceleration = variant + 1
    const deltaV = time * acceleration
    return { ...base, dimension: 'transfer', stem: `速度—时间图像显示物体在 ${time} s 内速度均匀增加 ${deltaV} m/s，图线斜率表示的加速度为？`, options: [`${acceleration} m/s²`, `${deltaV} m/s²`, `${time} m/s²`, `${deltaV + time} m/s²`], correctIndex: 0, explanation: `速度—时间图像的斜率表示加速度，a = Δv/Δt = ${deltaV}/${time} = ${acceleration} m/s²。` }
  }
  if (chapterName.includes('电流') || chapterName.includes('欧姆') || chapterName.includes('电功率') || chapterName.includes('电路')) {
    const voltage = 6 + variant * 2
    const resistance = 2 + (variant % 4)
    const current = voltage / resistance
    if (type % 3 === 0) return { ...base, dimension: 'basic-application', stem: `定值电阻为 ${resistance} Ω，两端电压为 ${voltage} V，通过电阻的电流为？`, options: [`${current} A`, `${voltage + resistance} A`, `${resistance / voltage} A`, `${current * 2} A`], correctIndex: 0, explanation: `根据欧姆定律 I = U/R = ${voltage}/${resistance} = ${current} A。` }
    if (type % 3 === 1) { const power = voltage * current; return { ...base, dimension: 'transfer', stem: `上述电阻消耗的电功率为？`, options: [`${power} W`, `${voltage + current} W`, `${power / 2} W`, `${resistance * current} W`], correctIndex: 0, explanation: `电功率 P = UI = ${voltage}×${current} = ${power} W。` }
    }
    const changedVoltage = voltage + 2
    return { ...base, dimension: 'error-analysis', stem: `测量导体电阻时，电流保持 ${current} A，电压由 ${voltage} V 增大到 ${changedVoltage} V。根据 R = U/I，电阻如何变化？`, options: [`由 ${resistance} Ω 增大到 ${changedVoltage / current} Ω`, '保持不变', `由 ${resistance} Ω 减小到 ${changedVoltage / current} Ω`, '无法根据电压和电流判断'], correctIndex: 0, explanation: `由 R = U/I，电流不变时电压增大，计算得到的电阻由 ${resistance} Ω 增大到 ${changedVoltage / current} Ω。` }
  }
  if (chapterName.includes('电磁') || chapterName.includes('磁场')) {
    const turns = 20 + variant * 5
    const current = 1 + variant
    if (type % 3 === 0) return { ...base, dimension: 'concept', stem: `在研究通电螺线管磁性强弱时，其他条件相同，将线圈匝数由 ${turns} 匝增加到 ${turns + 10} 匝，磁性通常如何变化？`, options: ['增强', '减弱', '不变', '一定消失'], correctIndex: 0, explanation: `在电流约为 ${current} A 且其他条件相同时，增加匝数通常会增强通电螺线管的磁性。` }
    if (type % 3 === 1) { const speed = 2 + variant; const force = current * (variant + 1); return { ...base, dimension: 'basic-application', stem: `一根通电导线在磁场中受到安培力。若电流增大为原来的 ${speed} 倍，其他条件不变，安培力大小如何变化？`, options: [`增大为原来的 ${speed} 倍`, `减小为原来的 1/${speed}`, '保持不变', '先增大后减小'], correctIndex: 0, explanation: `安培力在其他因素不变时与电流成正比，因此增大为原来的 ${speed} 倍；示例力值可取 ${force} N。` } }
    const flux = 0.02 + variant * 0.01
    const time = 0.1 + (variant % 3) * 0.1
    const emf = flux / time
    return { ...base, dimension: 'transfer', stem: `闭合线圈中的磁通量在 ${time} s 内由 ${flux} Wb 均匀减小到 0，感应电动势大小为？`, options: [`${emf} V`, `${flux * time} V`, `${time / flux} V`, `${flux + time} V`], correctIndex: 0, explanation: `法拉第电磁感应定律给出 E = |ΔΦ|/Δt = ${flux}/${time} = ${emf} V。` }
  }
  if (chapterName.includes('内能') || chapterName.includes('热')) {
    const mass = 1 + variant
    const deltaT = 5 + variant
    const specificHeat = 4200
    const heat = mass * specificHeat * deltaT
    if (type % 3 === 0) return { ...base, dimension: 'basic-application', stem: `质量为 ${mass} kg 的水温度升高 ${deltaT} ℃，取水的比热容 c = 4.2×10³ J/(kg·℃)，吸收热量约为？`, options: [`${heat} J`, `${mass * deltaT} J`, `${specificHeat * deltaT} J`, `${heat / 2} J`], correctIndex: 0, explanation: `吸收热量 Q = cmΔt = 4.2×10³×${mass}×${deltaT} = ${heat} J。` }
    if (type % 3 === 1) { const work = (mass + 1) * 10; return { ...base, dimension: 'concept', stem: `关于改变物体内能的方式，下列说法正确的是？本题以对物体做功 ${work} J 的情境为例。`, options: ['做功和热传递都能改变物体内能', '只有做功能改变内能', '只有热传递能改变内能', '温度不变时内能一定不变'], correctIndex: 0, explanation: '做功和热传递是改变物体内能的两种方式；温度不变时内能也可能因状态变化而改变。' } }
    const pressure = 1 + variant
    return { ...base, dimension: 'transfer', stem: `一定质量理想气体温度保持不变，体积压缩为原来的 1/${pressure + 1}，气体内能如何变化？`, options: ['理想气体内能不变', '内能一定增加', '内能一定减少', '无法由等温条件判断'], correctIndex: 0, explanation: `理想气体内能只由温度决定；等温过程温度不变，因此内能不变，压缩过程中的功由热交换平衡。` }
  }
  if (chapterName.includes('光') || chapterName.includes('透镜')) {
    const objectDistance = 20 + variant * 5
    if (type % 3 === 0) return { ...base, dimension: 'basic-application', stem: `凸透镜焦距为 10 cm，物距为 ${objectDistance} cm 时，物体位于？`, options: ['二倍焦距以外', '焦点以内', '焦点处', '一倍焦距与二倍焦距之间'], correctIndex: objectDistance > 20 ? 0 : 3, explanation: `焦距为 10 cm，二倍焦距为 20 cm；物距 ${objectDistance} cm 与 20 cm 的关系决定物体所在区域。` }
    if (type % 3 === 1) return { ...base, dimension: 'concept', stem: `在探究凸透镜成像规律时，物距为 ${objectDistance} cm、焦距为 10 cm 且物距大于二倍焦距，成像特点通常是？`, options: ['倒立、缩小的实像', '正立、放大的虚像', '倒立、放大的实像', '正立、缩小的虚像'], correctIndex: 0, explanation: '物距大于二倍焦距时，像在一倍与二倍焦距之间，是倒立、缩小的实像。' }
    return { ...base, dimension: 'error-analysis', stem: `近视眼看远处物体时，像落在视网膜前。应选用哪类透镜矫正？（本题镜片焦距为 ${10 + variant} cm）`, options: ['凹透镜', '凸透镜', '平面镜', '柱面镜'], correctIndex: 0, explanation: '近视眼成像在视网膜前，需要凹透镜发散光线，使像后移到视网膜。' }
  }
  return null
}

export function buildFallbackDiagnosticQuestions({ grade, subject, chapters = [], questionCount, attempt = 1, excludeQuestions = [] } = {}) {
  const banks = subject === '数学' ? mathItems : ['物理', '化学', '生物'].includes(subject) ? scienceItems : {}
  const { blueprint } = buildDiagnosticBlueprint(chapters, questionCount)
  const excludedStems = new Set(excludeQuestions.map(question => questionTextKey(question?.stem)).filter(Boolean))
  const attemptNumber = Math.max(1, Number(attempt) || 1)
  const questions = blueprint.flatMap(item => Array.from({ length: item.count }, (_, index) => {
    const chapter = chapters.find(candidate => candidate.id === item.chapterId)
    const bank = Object.entries(banks).find(([key]) => chapter.name.includes(key) || key.includes(chapter.name.slice(0, 4)))?.[1]
    const dimension = item.dimensions[index] || 'transfer'
    const localObjective = subject === '物理' && String(grade).startsWith('高')
      ? buildPhysicsQuestion(chapter.name, attemptNumber, index)
      : bank ? buildLocalObjectiveVariant(chapter.name, bank, attemptNumber) : null
    if (localObjective && !excludedStems.has(questionTextKey(localObjective.stem))) {
      const bankQuestion = { id: `local-${chapter.id}-${attemptNumber}-${index + 1}`, chapterId: chapter.id, chapterName: chapter.name, type: 'single', dimension, difficulty: 1, ...localObjective }
      excludedStems.add(questionTextKey(bankQuestion.stem))
      return bankQuestion
    }
    if (subject === '物理' && String(grade).startsWith('高') && localObjective) {
      // 同一专题需要多题时，使用不同的新课标高考风格能力题，不能退化成学习状态自评。
      const physicsQuestion = { ...localObjective, id: `local-${chapter.id}-${attemptNumber}-${index + 1}`, chapterId: chapter.id, chapterName: chapter.name, dimension, stem: `${localObjective.stem}（变式 ${index + 1}）` }
      excludedStems.add(questionTextKey(physicsQuestion.stem))
      return physicsQuestion
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
  return { questions, source: questions.some(item => item.selfAssessment) ? 'local-self-check' : subject === '物理' && String(grade).startsWith('高') ? 'local-gaokao-style-physics' : 'local-question-bank', grade, subject }
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
