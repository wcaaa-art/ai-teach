import test from 'node:test'
import assert from 'node:assert/strict'
import { STAGES, applyQuizStageResult, stageLabel, stageOf, stageStatesOf } from './stages.js'

test('四阶段顺序固定为概念、例题、迁移、复盘', () => {
  assert.deepEqual(STAGES.map(stage => stage.label), ['概念', '例题', '迁移', '复盘'])
})

test('stageOf 优先读取任务阶段，中文标签与缺失字段都能归位', () => {
  assert.equal(stageOf({ stage: 'transfer' }), 'transfer')
  assert.equal(stageOf({ stage: '复盘' }), 'review')
  // 老计划没有 stage 时按 sequenceOrder 回退，序号 0/1 分别落到概念与例题。
  assert.equal(stageOf({ sequenceOrder: 0 }), 'concept')
  assert.equal(stageOf({ sequenceOrder: 1 }), 'example')
  assert.equal(stageOf({ sequenceOrder: 5 }), 'example')
  // 非法阶段与空对象都回落到第一个阶段，不返回空值。
  assert.equal(stageOf({ stage: 'unknown', sequenceOrder: 2 }), 'transfer')
  assert.equal(stageOf(), 'concept')
  assert.equal(stageLabel('review'), '复盘')
  assert.equal(stageLabel('unknown'), '')
})

test('stageStatesOf 按归档与当前任务推导 done、current、pending', () => {
  const plans = [
    { id: 'a', stage: 'concept', status: 'archived', sequenceOrder: 1 },
    { id: 'b', stage: 'concept', status: 'archived', sequenceOrder: 2 },
    { id: 'c', stage: 'example', status: 'active', sequenceOrder: 3 },
    { id: 'd', stage: 'review', status: 'active', sequenceOrder: 4 }
  ]
  assert.deepEqual(stageStatesOf(plans), ['done', 'current', 'pending', 'pending'])
  // 桥接复习不计入阶段进度。
  assert.deepEqual(stageStatesOf([{ id: 'x', stage: 'concept', status: 'active', isBridge: true }]), ['pending', 'pending', 'pending', 'pending'])
  // 没有计划时全部待开始，不凭空点亮。
  assert.deepEqual(stageStatesOf([]), ['pending', 'pending', 'pending', 'pending'])
  // 全部归档时只有对应阶段点亮。
  assert.deepEqual(stageStatesOf([{ id: 'y', stage: 'transfer', status: 'archived' }]), ['pending', 'pending', 'done', 'pending'])
})

// 一次测试覆盖「概念→例题→迁移→复盘」四任务，章节 id 与科目用于匹配。
const chapterPlans = () => [
  { id: 'p1', subject: '数学', chapterId: 'c1', chapterIds: ['c1'], stage: 'concept', status: 'active', sequenceOrder: 1 },
  { id: 'p2', subject: '数学', chapterId: 'c1', chapterIds: ['c1'], stage: 'example', status: 'active', sequenceOrder: 2 },
  { id: 'p3', subject: '数学', chapterId: 'c1', chapterIds: ['c1'], stage: 'transfer', status: 'active', sequenceOrder: 3 },
  { id: 'p4', subject: '数学', chapterId: 'c1', chapterIds: ['c1'], stage: 'review', status: 'active', sequenceOrder: 4 },
  { id: 'p5', subject: '数学', chapterId: 'c2', chapterIds: ['c2'], stage: 'concept', status: 'active', sequenceOrder: 5 }
]
const quizResult = accuracy => ({ accuracy, subject: '数学', chapterIds: ['c1'], chapterNames: ['二次函数'] })

test('正确率 ≥80% 时章节的概念与例题自动归档，当前阶段推进到迁移', () => {
  const { plans, changed, message } = applyQuizStageResult({ plans: chapterPlans(), result: quizResult(0.85) })
  assert.deepEqual(changed.map(plan => plan.id), ['p1', 'p2'])
  assert.ok(plans.filter(plan => plan.id === 'p1' || plan.id === 'p2').every(plan => plan.status === 'archived'))
  // 迁移与复盘仍是进行中，其他章节完全不受影响。
  assert.equal(plans.find(plan => plan.id === 'p3').status, 'active')
  assert.equal(plans.find(plan => plan.id === 'p5').status, 'active')
  assert.match(message, /直接进入「迁移」/)
  // 首页节点：概念、例题点亮，迁移成为当前阶段。
  assert.deepEqual(stageStatesOf(plans.filter(plan => plan.chapterId === 'c1')), ['done', 'done', 'current', 'pending'])
})

test('正确率 <60% 时重新打开归档的例题，迁移保持等待', () => {
  const planList = chapterPlans().map(plan => plan.id === 'p1' || plan.id === 'p2' ? { ...plan, status: 'archived' } : plan)
  const { plans, changed, message } = applyQuizStageResult({ plans: planList, result: quizResult(0.4) })
  assert.deepEqual(changed.map(plan => plan.id), ['p2'])
  assert.equal(plans.find(plan => plan.id === 'p2').status, 'active')
  assert.match(message, /「例题」/)
  // 例题序号在迁移之前，重新成为当前阶段。
  assert.deepEqual(stageStatesOf(plans.filter(plan => plan.chapterId === 'c1')), ['done', 'current', 'pending', 'pending'])
})

test('没有例题可回退时回到概念，中间分数不改动计划', () => {
  // 只归档了概念就直接跳到迁移：低分应把概念重新打开。
  const onlyConcept = chapterPlans().map(plan => plan.id === 'p1' ? { ...plan, status: 'archived' } : plan)
  const fallback = applyQuizStageResult({ plans: onlyConcept, result: quizResult(0.3) })
  assert.deepEqual(fallback.changed.map(plan => plan.id), ['p1'])
  assert.match(fallback.message, /「概念」/)
  // 60%~80% 之间既不归档也不回退，避免频繁抖动。
  const middle = applyQuizStageResult({ plans: onlyConcept, result: quizResult(0.7) })
  assert.equal(middle.changed.length, 0)
  assert.equal(middle.message, '')
  // 边界值：恰好 80% 算通过，恰好 60% 不触发回退。
  assert.equal(applyQuizStageResult({ plans: chapterPlans(), result: quizResult(0.8) }).changed.length, 2)
  assert.equal(applyQuizStageResult({ plans: onlyConcept, result: quizResult(0.6) }).changed.length, 0)
})

test('测试结果只影响同科目同章节，桥接任务与无关章节保持原状', () => {
  const other = [
    { id: 'm1', subject: '物理', chapterId: 'c1', stage: 'concept', status: 'active', sequenceOrder: 1 },
    { id: 'm2', subject: '数学', chapterId: 'c1', stage: 'concept', status: 'active', sequenceOrder: 1, isBridge: true }
  ]
  const result = applyQuizStageResult({ plans: other, result: quizResult(0.9) })
  assert.equal(result.changed.length, 0)
  // 没有章节信息时不猜测，直接放弃回写。
  assert.equal(applyQuizStageResult({ plans: chapterPlans(), result: { accuracy: 0.9, subject: '数学' } }).changed.length, 0)
})
