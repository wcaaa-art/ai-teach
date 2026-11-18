import test from 'node:test'
import assert from 'node:assert/strict'
import { buildRoadSteps } from './reportRoute.js'

const plan = (id, chapterId, stage, extra = {}) => ({
  id, chapterId, stage, name: `${chapterId} · ${stage}`, estimatedMinutes: 20,
  sequenceOrder: 1, status: 'active', isBridge: false, ...extra
})

test('路线按掌握度升序排，第 1 步是最弱专题', () => {
  const plans = [plan('a', 'c1', 'concept'), plan('b', 'c2', 'concept'), plan('c', 'c3', 'concept')]
  const rows = [{ id: 'c1', mastery: 2 }, { id: 'c2', mastery: 0 }, { id: 'c3', mastery: 1 }]
  const road = buildRoadSteps({ plans, rows, chapters: [] })
  assert.deepEqual(road.map(step => step.chapterId), ['c2', 'c3', 'c1'])
  assert.equal(road[0].step, 1)
  assert.equal(road[0].label, '补强第一步')
})

test('同一专题内按概念→例题→迁移→复盘排', () => {
  const plans = [
    plan('r', 'c1', 'review'), plan('t', 'c1', 'transfer'),
    plan('e', 'c1', 'example'), plan('c', 'c1', 'concept')
  ]
  const road = buildRoadSteps({ plans, rows: [{ id: 'c1', mastery: 1 }], chapters: [] })
  assert.deepEqual(road.map(step => step.stage), ['concept', 'example', 'transfer', 'review'])
})

test('动作类型由阶段决定，文案不影响跳转', () => {
  const plans = [
    plan('c', 'c1', 'concept'), plan('e', 'c1', 'example'),
    plan('t', 'c1', 'transfer'), plan('r', 'c1', 'review')
  ]
  const road = buildRoadSteps({ plans, rows: [{ id: 'c1', mastery: 1 }], chapters: [] })
  assert.deepEqual(road.map(step => step.actionType), ['video', 'doc', 'quiz', 'review'])
  assert.ok(road.every(step => step.outcome))
})

test('前置衔接条目只在第 1 步加时长，不单独占位', () => {
  const plans = [
    plan('a', 'c1', 'concept', { sequenceOrder: 1 }),
    plan('b', 'c2', 'concept', { sequenceOrder: 6 }),
    { id: 'bridge-1', isBridge: true, chapterIds: ['c1'], estimatedMinutes: 10, status: 'active' }
  ]
  const road = buildRoadSteps({ plans, rows: [{ id: 'c1', mastery: 0 }, { id: 'c2', mastery: 1 }], chapters: [] })
  assert.equal(road.length, 2)
  assert.equal(road[0].minutes, 30)
  assert.equal(road[0].bridge.id, 'bridge-1')
  assert.equal(road[1].minutes, 20)
  assert.equal(road[1].bridge, null)
})

test('没有计划时按教材顺序生成零基线四步，动作为重新测试', () => {
  const chapters = [
    { id: 'c1', name: '有理数与数轴' }, { id: 'c2', name: '整式加减' },
    { id: 'c3', name: '一元一次方程' }, { id: 'c4', name: '几何图形初步' }, { id: 'c5', name: '相交线与平行线' }
  ]
  const road = buildRoadSteps({ plans: [], rows: [], chapters })
  assert.equal(road.length, 4)
  assert.deepEqual(road.map(step => step.chapterId), ['c1', 'c2', 'c3', 'c4'])
  assert.equal(road[0].actionType, 'retest')
  assert.equal(road[0].stageLabel, '建立起点')
  assert.equal(road[0].minutes, 10)
})

test('归档任务不进入路线', () => {
  const plans = [plan('a', 'c1', 'concept', { status: 'archived' }), plan('b', 'c2', 'concept')]
  const road = buildRoadSteps({ plans, rows: [{ id: 'c1', mastery: 0 }, { id: 'c2', mastery: 1 }], chapters: [] })
  assert.equal(road.length, 1)
  assert.equal(road[0].chapterId, 'c2')
})
