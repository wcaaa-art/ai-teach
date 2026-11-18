import test from 'node:test'
import assert from 'node:assert/strict'
import { buildAdvice, buildWrongDistribution, extractFocusPoint } from './reportInsight.js'

const EXPLANATION = [
  'A. 错误：-3 是点本身的位置坐标，距离不能为负。',
  'B. 正确：距离等于绝对值 |-3| = 3，所以答案是 3。',
  'C. 错误：0 表示原点本身。'
].join('\n')

test('考点取「正确」那一行，不取错误项批驳', () => {
  assert.equal(extractFocusPoint({ explanation: EXPLANATION, correctIndex: 1, stem: '数轴上 -3 到原点的距离是？' }), '距离等于绝对值 |-3| = 3')
})

test('逐项解析按 correctIndex 匹配对应选项', () => {
  const text = 'A. 错误：概念混淆。\nB. 正确：先移项再合并同类项。'
  assert.equal(extractFocusPoint({ explanation: text, correctIndex: 1 }), '先移项再合并同类项')
})

test('正确答案前缀的解析取说明句，不退回题干', () => {
  assert.equal(extractFocusPoint({ explanation: '正确答案：7。相反数只改变符号：-7 的相反数是 7。', stem: '-7 的相反数是（ ）' }), '相反数只改变符号：-7 的相反数是 7')
})

test('没有任何解题说明时给出知识点级考法，不冒充具体步骤', () => {
  assert.equal(extractFocusPoint({ explanation: '正确答案：B。', stem: '下列正确的是（ ）', knowledgeTags: ['去括号'] }), '这一类题的典型考法：去括号')
})

test('没有逐项格式时退回题干', () => {
  assert.equal(extractFocusPoint({ explanation: '这道题考查等式的基本性质。', stem: '下列变形正确的是（　　）' }), '下列变形正确的是（　　）')
  assert.equal(extractFocusPoint({ stem: '下列分式中最简的是（　　）' }), '下列分式中最简的是（　　）')
})

test('考点过长时截断到 30 字以内', () => {
  const long = 'B. 正确：先去分母再移项最后把系数化成一整个过程都要注意符号和括号不能漏'
  const result = extractFocusPoint({ explanation: long, correctIndex: 1 })
  assert.ok(result.length <= 31)
  assert.ok(result.endsWith('…'))
})

test('错题分布按章节聚合、题号从 1 开始、第一组标记最多', () => {
  const review = [
    { id: 'q1', chapterId: 'c1', chapterName: '一元一次方程', knowledgeTags: ['去括号'], chosenIndex: 0, isCorrect: true, explanation: EXPLANATION, correctIndex: 1 },
    { id: 'q2', chapterId: 'c1', chapterName: '一元一次方程', knowledgeTags: ['去括号'], chosenIndex: 0, isCorrect: false, explanation: EXPLANATION, correctIndex: 1 },
    { id: 'q3', chapterId: 'c1', chapterName: '一元一次方程', knowledgeTags: ['去括号'], chosenIndex: 0, isCorrect: false, explanation: EXPLANATION, correctIndex: 1 },
    { id: 'q4', chapterId: 'c2', chapterName: '数据收集与整理', knowledgeTags: [], chosenIndex: 0, isCorrect: false, explanation: 'A. 错误：只看数量。\nB. 正确：有破坏性的只能抽样。', correctIndex: 1 },
    { id: 'q5', chapterId: 'c3', chapterName: '几何图形初步', selfAssessment: true, chosenIndex: 1, isCorrect: null }
  ]
  const result = buildWrongDistribution({ review, grade: '初一', subject: '数学' })
  assert.equal(result.total, 3)
  assert.equal(result.items.length, 2)
  assert.equal(result.items[0].count, 2)
  assert.equal(result.items[0].questionText, '第 2 题、第 3 题')
  assert.equal(result.items[0].isTop, true)
  assert.equal(result.items[0].focusPoint, '距离等于绝对值 |-3| = 3')
  assert.equal(result.items[1].label, '数据收集与整理')
})

test('错题分布用错题记录里的错次挑考点', () => {
  const review = [
    { id: 'q1', chapterId: 'c1', chapterName: '整式加减', chosenIndex: 0, isCorrect: false, explanation: 'B. 正确：第一题的考点。', correctIndex: 1 },
    { id: 'q2', chapterId: 'c1', chapterName: '整式加减', chosenIndex: 0, isCorrect: false, explanation: 'B. 正确：反复错的考点。', correctIndex: 1 }
  ]
  const mistakes = [
    { grade: '初一', subject: '数学', questionId: 'q1', wrongCount: 1, redoHistory: [] },
    { grade: '初一', subject: '数学', questionId: 'q2', wrongCount: 3, redoHistory: [] }
  ]
  const result = buildWrongDistribution({ review, mistakes, grade: '初一', subject: '数学' })
  assert.equal(result.items[0].maxWrongCount, 3)
  assert.equal(result.items[0].focusPoint, '反复错的考点')
})

test('全对或全是自评题时返回空分布', () => {
  assert.deepEqual(buildWrongDistribution({ review: [] }), { total: 0, items: [] })
  const review = [{ id: 'q1', selfAssessment: true, chosenIndex: 1, isCorrect: null }]
  assert.deepEqual(buildWrongDistribution({ review }), { total: 0, items: [] })
})

test('补强建议第一条指向错得最多的专题，最后一条收住已达标专题', () => {
  const rows = [
    { id: 'c1', name: '一元一次方程', mastery: 1 },
    { id: 'c2', name: '整式加减', mastery: 0 },
    { id: 'c3', name: '有理数与数轴', mastery: 3 }
  ]
  const wrongDist = {
    total: 3,
    items: [{ key: 'c1|去括号', chapterId: 'c1', chapterName: '一元一次方程', tag: '去括号', count: 2, questionText: '第 2、3 题', focusPoint: '去括号要乘每一项', maxWrongCount: 2, isTop: true }]
  }
  const plans = [{ chapterId: 'c1', stage: 'concept', estimatedMinutes: 25 }]
  const advice = buildAdvice({ rows, wrongDist, plans })
  assert.ok(advice.length <= 4)
  assert.match(advice[0].title, /一元一次方程/)
  assert.match(advice[0].body, /25 分钟/)
  assert.match(advice[0].body, /去括号要乘每一项/)
  assert.equal(advice[advice.length - 1].tone, 'calm')
  assert.match(advice[advice.length - 1].title, /已经稳住/)
})

test('全部达标时先给「都达到掌握标准」，没有错题也能出建议', () => {
  const rows = [{ id: 'c1', name: '有理数与数轴', mastery: 2 }, { id: 'c2', name: '整式加减', mastery: 3 }]
  const advice = buildAdvice({ rows, wrongDist: { total: 0, items: [] }, plans: [] })
  assert.equal(advice[0].tone, 'primary')
  assert.match(advice[0].title, /达到掌握标准/)
  assert.equal(advice.length, 2)
})

test('没有任何已测专题时不出建议', () => {
  assert.deepEqual(buildAdvice({ rows: [], wrongDist: { total: 0, items: [] }, plans: [] }), [])
})
