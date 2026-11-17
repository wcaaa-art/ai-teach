// 仅开发环境使用的演示数据：错题库没有真实错题时，用来预览知识点分布（全部学科 / 单科两种形态）。
// 只在 URL 带 ?demo=mistakes 时由 MistakesView 动态引入，生产构建不会打进产物。
import { deleteMistake, saveMistake } from '../db/index.js'

const DAY = 86400000

// 27 道，构成和设计稿一致：一元二次方程 5、一般现在时 3、化学方程式 3、文言实词 2、完形填空 2，其余 12 道散在 8 个知识点。
const PLAN = [
  { subject: '数学', grade: '初二', point: '一元二次方程', count: 5, stem: '若 x²-5x+6=0，则 x 的值是（ ）' },
  { subject: '数学', grade: '初二', point: '因式分解', count: 2, stem: '把 2a²-4a 分解因式，结果是（ ）' },
  { subject: '数学', grade: '初二', point: '二次函数', count: 1, stem: '抛物线 y=x²-2x+3 的顶点坐标是（ ）' },
  { subject: '数学', grade: '初二', point: '勾股定理', count: 1, stem: '直角三角形两直角边为 3、4，斜边长为（ ）' },
  { subject: '英语', grade: '初二', point: '一般现在时', count: 3, stem: 'She ___ to school by bike every day.' },
  { subject: '英语', grade: '初二', point: '完形填空', count: 2, stem: '完形填空：The boy ___ his homework before dinner.' },
  { subject: '英语', grade: '初二', point: '阅读理解', count: 1, stem: '阅读：第二段的主旨是（ ）' },
  { subject: '化学', grade: '初三', point: '化学方程式', count: 3, stem: '配平：__Fe + __O₂ → __Fe₃O₄' },
  { subject: '语文', grade: '初二', point: '文言实词', count: 2, stem: '「静以修身」中「以」的意思是（ ）' },
  { subject: '语文', grade: '初二', point: '古诗词默写', count: 2, stem: '默写：___，思而不学则殆。' },
  { subject: '语文', grade: '初二', point: '病句修改', count: 1, stem: '下列句子没有语病的一项是（ ）' },
  { subject: '物理', grade: '初二', point: '欧姆定律', count: 2, stem: 'R=10Ω，U=5V，电流 I 为（ ）' },
  { subject: '物理', grade: '初二', point: '浮力', count: 2, stem: '物体浸没在水中受到的浮力方向是（ ）' }
]

export function buildDemoMistakes() {
  const now = Date.now()
  const list = []
  let index = 0
  for (const item of PLAN) {
    for (let i = 0; i < item.count; i += 1) {
      index += 1
      const at = now - (index % 9) * DAY
      list.push({
        id: `demo-mistake-${index}`,
        grade: item.grade,
        subject: item.subject,
        edition: '人教版',
        chapterId: `demo-chapter-${item.point}`,
        chapterName: item.point,
        text: item.stem,
        stem: item.stem,
        type: 'choice',
        options: ['A', 'B', 'C', 'D'],
        correctIndex: 0,
        userAnswer: 'B',
        correctAnswer: 'A',
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
