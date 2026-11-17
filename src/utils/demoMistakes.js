// 仅开发环境使用的演示数据：错题库没有真实错题时，用来预览知识点分布（全部学科 / 单科两种形态）。
// 只在 URL 带 ?demo=mistakes 时由 MistakesView 动态引入，生产构建不会打进产物。
import { deleteMistake, saveMistake } from '../db/index.js'

const DAY = 86400000
const LETTERS = 'ABCD'

// 27 道，构成和设计稿一致：一元二次方程 5、一般现在时 3、化学方程式 3、文言实词 2、完形填空 2，其余 12 道散在 8 个知识点。
// 选择题必须带真实选项，填空题只留答案；演示数据也要能看出「选项 → 作答 → 答案」的完整链路。
const PLAN = [
  { subject: '数学', grade: '初二', point: '一元二次方程', count: 5, stem: '若 x²-5x+6=0，则 x 的值是（ ）', options: ['2 或 3', '-2 或 -3', '1 或 6', '-1 或 -6'], correctIndex: 0 },
  { subject: '数学', grade: '初二', point: '因式分解', count: 2, stem: '把 2a²-4a 分解因式，结果是（ ）', options: ['2a(a-2)', '2a(a+2)', 'a(2a-4)', '2(a²-2a)'], correctIndex: 0 },
  { subject: '数学', grade: '初二', point: '二次函数', count: 1, stem: '抛物线 y=x²-2x+3 的顶点坐标是（ ）', options: ['(1, 2)', '(-1, 2)', '(1, 4)', '(-1, 4)'], correctIndex: 0 },
  { subject: '数学', grade: '初二', point: '勾股定理', count: 1, stem: '直角三角形两直角边为 3、4，斜边长为（ ）', options: ['5', '6', '7', '25'], correctIndex: 0 },
  { subject: '英语', grade: '初二', point: '一般现在时', count: 3, stem: 'She ___ to school by bike every day.', options: ['go', 'goes', 'going', 'went'], correctIndex: 1 },
  { subject: '英语', grade: '初二', point: '完形填空', count: 2, stem: 'The boy ___ his homework before dinner every day.', options: ['do', 'does', 'did', 'done'], correctIndex: 1 },
  { subject: '英语', grade: '初二', point: '阅读理解', count: 1, stem: '阅读：文章写「父亲每天提前半小时起床为我做早饭」，主要表现（ ）', options: ['父亲睡眠少', '父亲对我的关爱', '家里没有闹钟', '早饭很重要'], correctIndex: 1 },
  { subject: '化学', grade: '初三', point: '化学方程式', count: 3, stem: '配平：__Fe + __O₂ → __Fe₃O₄', options: ['3、2、1', '2、3、1', '3、2、2', '1、2、3'], correctIndex: 0 },
  { subject: '语文', grade: '初二', point: '文言实词', count: 2, stem: '「静以修身」中「以」的意思是（ ）', options: ['用来', '因为', '凭借', '并且'], correctIndex: 0 },
  { subject: '语文', grade: '初二', point: '古诗词默写', count: 2, type: 'fill', stem: '默写：___，思而不学则殆。', userAnswer: '学而不思则怠', correctAnswer: '学而不思则罔' },
  { subject: '语文', grade: '初二', point: '病句修改', count: 1, stem: '下列句子没有语病的一项是（ ）', options: ['通过这次活动，使我明白了团结的重要性。', '这次活动使我明白了团结的重要性。', '这次活动，让我使明白了团结的重要性。', '通过这次活动，让我明白了团结的重要性。'], correctIndex: 1 },
  { subject: '物理', grade: '初二', point: '欧姆定律', count: 2, stem: 'R=10Ω，U=5V，电流 I 为（ ）', options: ['0.5 A', '2 A', '50 A', '5 A'], correctIndex: 0 },
  { subject: '物理', grade: '初二', point: '浮力', count: 2, stem: '物体浸没在水中受到的浮力方向是（ ）', options: ['竖直向上', '竖直向下', '水平向前', '沿接触面向上'], correctIndex: 0 }
]

export function buildDemoMistakes() {
  const now = Date.now()
  const list = []
  let index = 0
  for (const item of PLAN) {
    const options = Array.isArray(item.options) ? item.options : []
    const type = item.type || 'single'
    const correctIndex = options.length >= 2 ? Number(item.correctIndex) || 0 : -1
    for (let i = 0; i < item.count; i += 1) {
      index += 1
      const at = now - (index % 9) * DAY
      // 选择题固定错一个与正确答案不同的选项，便于预览「红色错选 / 绿色正解」。
      const wrongIndex = correctIndex >= 0 ? (correctIndex + 1 + i % Math.max(1, options.length - 1)) % options.length : -1
      list.push({
        id: `demo-mistake-${index}`,
        grade: item.grade,
        subject: item.subject,
        edition: '人教版',
        chapterId: `demo-chapter-${item.point}`,
        chapterName: item.point,
        text: item.stem,
        stem: item.stem,
        type,
        options,
        correctIndex,
        userAnswer: correctIndex >= 0 ? `${LETTERS[wrongIndex]}. ${options[wrongIndex]}` : item.userAnswer || '',
        correctAnswer: correctIndex >= 0 ? `${LETTERS[correctIndex]}. ${options[correctIndex]}` : item.correctAnswer || '',
        explanation: '',
        source: 'quiz',
        quizId: 'demo-quiz',
        questionId: `demo-q-${index}`,
        knowledgeTags: [item.point],
        wrongCount: (index % 3) + 1,
        lastWrongAt: at,
        slip: false,
        slipAt: null,
        redoCount: 0,
        lastRedoAt: null,
        redoHistory: [],
        fixedAt: null,
        createdAt: at
      })
    }
  }
  return list
}

// 固定 id，重复执行只覆盖不叠加。
export async function seedDemoMistakes() {
  const list = buildDemoMistakes()
  for (const mistake of list) await saveMistake(mistake)
  return list
}

export async function clearDemoMistakes() {
  const list = buildDemoMistakes()
  for (const mistake of list) await deleteMistake(mistake.id)
}
