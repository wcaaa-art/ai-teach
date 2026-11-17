// 走神实时干预的判定测试：阈值分级、渐进提示、只触发一次、状态恢复后重置。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createInterventionTracker, interventionMessage, attentionSegmentType, INTERVENTION_LEVEL, DISTRACTED_STATES } from './attentionIntervene.js'

// tracker 第一次见到某状态时以「此刻」为起点（无从得知它何时开始），所以持续时长要从第二次采样算。
// 真实链路里视觉状态每秒上报一次，误差不超过 1 秒。
const at = (state, seconds, base = 1000000) => ({ state, now: base + seconds * 1000 })

test('刚开始走神不打扰，进入阈值前才倒计时', () => {
  const tracker = createInterventionTracker()
  const threshold = DISTRACTED_STATES['looking-away'].threshold
  tracker.update('looking-away', 1000000)
  assert.equal(tracker.update('looking-away', 1000000 + 1000).level, INTERVENTION_LEVEL.NONE)
  const warn = tracker.update('looking-away', 1000000 + (threshold - 8) * 1000)
  assert.equal(warn.level, INTERVENTION_LEVEL.WARN)
  assert.ok(warn.remaining >= 1 && warn.remaining <= 8, `剩余秒数不对：${warn.remaining}`)
})

test('持续超过阈值才触发干预', () => {
  const tracker = createInterventionTracker()
  const threshold = DISTRACTED_STATES['looking-away'].threshold
  tracker.update('looking-away', 1000000)
  const hit = tracker.update('looking-away', 1000000 + (threshold + 1) * 1000)
  assert.equal(hit.level, INTERVENTION_LEVEL.INTERVENE)
  assert.equal(hit.label, '分心')
  assert.ok(hit.hint.length > 0)
})

test('低头阈值比分心宽（写题低头是常态）', () => {
  assert.ok(DISTRACTED_STATES['head-down'].threshold > DISTRACTED_STATES['looking-away'].threshold)
  assert.ok(DISTRACTED_STATES['looking-away'].threshold > DISTRACTED_STATES['drowsy'].threshold)
})

test('同一轮异常只干预一次，不会连续弹窗', () => {
  const tracker = createInterventionTracker()
  const threshold = DISTRACTED_STATES['drowsy'].threshold
  tracker.update('drowsy', 1000000)
  assert.equal(tracker.update('drowsy', 1000000 + (threshold + 1) * 1000).level, INTERVENTION_LEVEL.INTERVENE)
  // 持续不走神也不该再触发
  assert.equal(tracker.update('drowsy', 1000000 + (threshold + 30) * 1000).level, INTERVENTION_LEVEL.NONE)
})

test('状态恢复后重新开始计时', () => {
  const tracker = createInterventionTracker()
  const threshold = DISTRACTED_STATES['drowsy'].threshold
  tracker.update('drowsy', 1000000)
  tracker.update('drowsy', 1000000 + (threshold + 1) * 1000)
  // 回到专注，本轮清空
  assert.equal(tracker.update('focused', 1000000 + (threshold + 2) * 1000).level, INTERVENTION_LEVEL.NONE)
  // 再次走神要重新累计
  tracker.update('drowsy', 1000000 + (threshold + 3) * 1000)
  assert.equal(tracker.update('drowsy', 1000000 + (threshold + 4) * 1000).level, INTERVENTION_LEVEL.NONE)
})

test('切换异常类型时重新计时', () => {
  const tracker = createInterventionTracker()
  const threshold = DISTRACTED_STATES['looking-away'].threshold
  tracker.update('looking-away', 1000000)
  tracker.update('looking-away', 1000000 + (threshold - 1) * 1000)
  // 换成低头，计时从头开始
  const switched = tracker.update('head-down', 1000000 + threshold * 1000)
  assert.equal(switched.level, INTERVENTION_LEVEL.NONE)
  assert.equal(switched.state, 'head-down')
})

test('离岗与专注不计入干预判定', () => {
  const tracker = createInterventionTracker()
  assert.equal(tracker.update('away', 1000).level, INTERVENTION_LEVEL.NONE)
  assert.equal(tracker.update('multiple', 1000).level, INTERVENTION_LEVEL.NONE)
  assert.equal(tracker.update('focused', 1000).level, INTERVENTION_LEVEL.NONE)
})

test('注意力分段只映射成看板认的四种口径', () => {
  assert.equal(attentionSegmentType('focused'), 'focus')
  assert.equal(attentionSegmentType('away'), 'away')
  assert.equal(attentionSegmentType('looking-away'), 'distracted')
  assert.equal(attentionSegmentType('head-down'), 'distracted')
  assert.equal(attentionSegmentType('drowsy'), 'distracted')
  assert.equal(attentionSegmentType('multiple'), 'distracted')
  assert.equal(attentionSegmentType(''), 'unknown')
  // 明细类型绝不能漏进分段统计
  for (const state of ['looking-away', 'head-down', 'drowsy', 'multiple']) {
    assert.ok(['focus', 'distracted', 'away', 'unknown'].includes(attentionSegmentType(state)))
  }
})

test('提示文案区分倒计时与已暂停', () => {
  const warn = interventionMessage({ state: 'looking-away', remaining: 6 })
  assert.ok(warn.includes('6 秒'), warn)
  assert.ok(warn.includes('自动暂停'), warn)
  const paused = interventionMessage({ state: 'head-down' })
  assert.ok(paused.includes('低头'), paused)
  assert.ok(paused.includes('已暂停'), paused)
})
