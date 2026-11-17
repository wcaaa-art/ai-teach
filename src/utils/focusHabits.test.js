import assert from 'node:assert/strict'
import test from 'node:test'
import { distractionBreakdown, focusStreak, habitAdvice, hourBuckets, weekComparison } from './focusHabits.js'

const now = new Date(2026, 10, 13, 12, 0, 0).getTime()
const at = (month, day, hour, minute = 0) => new Date(2026, month, day, hour, minute).getTime()

test('专注分钟按开始小时聚合，超出时间窗的记录被忽略', () => {
  const buckets = hourBuckets([
    { startedAt: at(10, 13, 9, 10), actualSeconds: 1500 },
    { startedAt: at(10, 13, 9, 50), actualSeconds: 600 },
    { startedAt: at(10, 13, 20, 0), actualSeconds: 2400 },
    { startedAt: at(9, 1, 9, 0), actualSeconds: 1200 }
  ], now, 30)
  assert.equal(buckets[9], 35)
  assert.equal(buckets[20], 40)
  assert.equal(buckets.reduce((sum, value) => sum + value, 0), 75)
})

test('连续学习天数今天没记录时从昨天起算，遇到空档停止', () => {
  const sessions = [
    { createdAt: at(10, 13, 10) },
    { createdAt: at(10, 12, 10) },
    { createdAt: at(10, 11, 10) },
    { createdAt: at(10, 9, 10) },
    { createdAt: at(10, 8, 10) }
  ]
  assert.equal(focusStreak(sessions, now), 3)
  assert.equal(focusStreak(sessions.slice(1), now), 2)
})

test('本周与上周对比按真实分心统计并排除演示数据', () => {
  const sessions = [
    { createdAt: at(10, 10, 10), actualSeconds: 3600 },
    { createdAt: at(10, 12, 10), actualSeconds: 1800 },
    { createdAt: at(10, 2, 10), actualSeconds: 1800 }
  ]
  const distractions = [
    { createdAt: at(10, 11, 10), type: 'tab-hidden' },
    { createdAt: at(10, 3, 10), type: 'visual-away' },
    { createdAt: at(10, 12, 10), type: 'demo-away' }
  ]
  const result = weekComparison(sessions, distractions, now)
  assert.equal(result.thisMinutes, 90)
  assert.equal(result.lastMinutes, 30)
  assert.equal(result.minutesDeltaPercent, 200)
  assert.equal(result.thisDistractions, 1)
  assert.equal(result.lastDistractions, 1)
  assert.equal(result.distractionDelta, 0)
})

test('分心类型合并视觉提醒，排除演示与误判', () => {
  const rows = distractionBreakdown([
    { type: 'tab-hidden' }, { type: 'tab-hidden' }, { type: 'visual-away' }, { type: 'demo-away' }
  ], [
    { status: 'drowsy' }, { status: 'drowsy' }, { status: 'distracted' },
    { status: 'false-positive' }, { status: 'multiple', source: 'demo' }
  ])
  const count = label => rows.find(row => row.label === label).count
  assert.equal(count('页面切走'), 2)
  assert.equal(count('视觉离岗'), 1)
  assert.equal(count('犯困'), 2)
  assert.equal(count('扭头分心'), 1)
  assert.equal(count('多人入镜'), 0)
})

test('习惯建议优先给高效时段、主要分心来源和周趋势', () => {
  const hours = Array.from({ length: 24 }, () => 0)
  hours[19] = 30
  hours[20] = 25
  const suggestions = habitAdvice({
    sessions: [{ startedAt: at(10, 13, 19, 30), actualSeconds: 2400 }],
    distractions: [{ type: 'tab-hidden' }, { type: 'tab-hidden' }, { type: 'tab-hidden' }],
    visualLogs: [],
    hours,
    streak: 5,
    week: { minutesDeltaPercent: -30 }
  })
  assert.equal(suggestions.length, 3)
  assert.match(suggestions[0], /19:00–21:00/)
  assert.match(suggestions[1], /页面切走/)
  assert.match(suggestions[2], /少 30%/)
})

test('没有专注记录时返回一条起步建议', () => {
  const suggestions = habitAdvice({
    sessions: [], distractions: [], visualLogs: [],
    hours: Array.from({ length: 24 }, () => 0), streak: 0, week: { minutesDeltaPercent: null }
  })
  assert.equal(suggestions.length, 1)
  assert.match(suggestions[0], /25 分钟/)
})
