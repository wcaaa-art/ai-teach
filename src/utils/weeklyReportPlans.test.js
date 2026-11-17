import assert from 'node:assert/strict'
import test from 'node:test'
import { buildWeeklyPlanTasks, carriedWeeksOf, MAX_CARRY_WEEKS, nextMondayAt, shiftWeeklyTasks, shouldPromptWeeklyReport, staleWeeklyTasks, weekKeyOf } from './weeklyReportPlans.js'

test('周报行动转成下周计划任务，id 与顺序稳定', () => {
  const now = new Date(2026, 10, 13, 10, 0, 0).getTime()
  const report = { actions: ['先补数学：挑一个错题最多的章节做 10 道基础题。', '安排一次 25 分钟错题复盘。', '做一次同章测试。'] }
  const tasks = buildWeeklyPlanTasks({ report, subject: '数学', weekKey: '2026-11-9', sequenceStart: 8, now })
  assert.equal(tasks.length, 3)
  assert.equal(tasks[0].id, 'weekly-2026-11-9-1')
  assert.equal(tasks[2].id, 'weekly-2026-11-9-3')
  assert.deepEqual(tasks.map(task => task.sequenceOrder), [8, 9, 10])
  assert.ok(tasks.every(task => task.stage === 'review' && task.status === 'active'))
  assert.ok(tasks.every(task => task.subject === '数学' && task.estimatedMinutes === 25))
  assert.deepEqual(tasks.map(task => task.priority), ['高', '中', '中'])
  assert.ok(tasks.every(task => task.source === 'weekly-report'))
})

test('同一周重复生成 id 不变，换周才换 id', () => {
  const now = new Date(2026, 10, 13, 10, 0, 0).getTime()
  const report = { actions: ['行动一', '行动二'] }
  const first = buildWeeklyPlanTasks({ report, weekKey: '2026-11-9', now })
  const second = buildWeeklyPlanTasks({ report, weekKey: '2026-11-9', now })
  const nextWeek = buildWeeklyPlanTasks({ report, weekKey: '2026-11-16', now })
  assert.deepEqual(first.map(task => task.id), second.map(task => task.id))
  assert.notDeepEqual(first.map(task => task.id), nextWeek.map(task => task.id))
})

test('空行动、非字符串和超长内容都被处理', () => {
  assert.deepEqual(buildWeeklyPlanTasks({ report: { actions: [] } }), [])
  assert.deepEqual(buildWeeklyPlanTasks({ report: null }), [])
  const tasks = buildWeeklyPlanTasks({
    report: { actions: ['', 42, '  长'.repeat(30), '行动二', '行动三', '行动四'] },
    subject: '', weekKey: 'w1', limit: 3
  })
  assert.equal(tasks.length, 3)
  assert.equal(tasks[0].subject, '综合')
  assert.equal(tasks[0].name.length, 30)
})

test('计划时间落在下周一 20:00', () => {
  const friday = new Date(2026, 10, 13, 10, 0, 0)
  const monday = new Date(nextMondayAt(friday.getTime()))
  assert.equal(monday.getDay(), 1)
  assert.equal(monday.getDate(), 16)
  assert.equal(monday.getHours(), 20)
  assert.equal(monday.getMinutes(), 0)
})

test('自然周 key 按周一切换', () => {
  const friday = new Date(2026, 10, 13, 10, 0, 0).getTime()
  const sunday = new Date(2026, 10, 15, 23, 0, 0).getTime()
  const nextMonday = new Date(2026, 10, 16, 8, 0, 0).getTime()
  assert.equal(weekKeyOf(friday), '2026-11-9')
  assert.equal(weekKeyOf(sunday), '2026-11-9')
  assert.equal(weekKeyOf(nextMonday), '2026-11-16')
})

test('过期周报任务只含上周未完成项，已归档与本周任务保留', () => {
  const friday = new Date(2026, 10, 13, 10, 0, 0).getTime()
  const plans = [
    { id: 'weekly-2026-11-2-1', source: 'weekly-report', status: 'active' },
    { id: 'weekly-2026-11-2-2', source: 'weekly-report', status: 'archived' },
    { id: 'weekly-2026-11-9-1', source: 'weekly-report', status: 'active' },
    { id: 'plan-123', source: 'diagnosis', status: 'active' },
    { id: 'weekly-bad-id', source: 'weekly-report', status: 'active' }
  ]
  const stale = staleWeeklyTasks(plans, friday)
  assert.deepEqual(stale.map(plan => plan.id), ['weekly-2026-11-2-1'])
})

test('顺延把过期任务改到本周并避开已有 id', () => {
  const monday = new Date(2026, 10, 16, 9, 0, 0).getTime()
  const stale = [
    { id: 'weekly-2026-11-2-1', name: 'A', createdAt: 1 },
    { id: 'weekly-2026-11-2-2', name: 'B', createdAt: 2 }
  ]
  const shifted = shiftWeeklyTasks(stale, [{ id: 'weekly-2026-11-16-1' }], monday)
  assert.deepEqual(shifted.map(item => item.id), ['weekly-2026-11-16-2', 'weekly-2026-11-16-3'])
  assert.equal(shifted[0].createdAt, monday)
  assert.equal(shifted[0].name, 'A')
  assert.equal(shifted[0].carriedWeeks, 1)
  const review = new Date(shifted[0].reviewTime)
  assert.equal(review.getDay(), 1)
  assert.equal(review.getHours(), 20)
})

test('顺延次数达到上限后不再顺延，剩余任务留给用户拆小或清空', () => {
  const monday = new Date(2026, 10, 16, 9, 0, 0).getTime()
  const stale = [
    { id: 'weekly-2026-11-2-1', carriedWeeks: 0 },
    { id: 'weekly-2026-11-2-2', carriedWeeks: 1 },
    { id: 'weekly-2026-11-2-3', carriedWeeks: 2 }
  ]
  const shifted = shiftWeeklyTasks(stale, [], monday)
  assert.equal(shifted.length, 2)
  assert.deepEqual(shifted.map(item => item.carriedWeeks), [1, 2])
  assert.equal(carriedWeeksOf({ carriedWeeks: 3 }), 3)
  assert.equal(carriedWeeksOf({}), 0)
  assert.equal(MAX_CARRY_WEEKS, 2)
})

test('周一且本周没有周报、未被关掉时才提示生成', () => {
  const monday = new Date(2026, 10, 16, 9, 0, 0).getTime()
  const friday = new Date(2026, 10, 13, 9, 0, 0).getTime()
  assert.equal(shouldPromptWeeklyReport({ now: monday }), true)
  assert.equal(shouldPromptWeeklyReport({ now: monday, hasReport: true }), false)
  assert.equal(shouldPromptWeeklyReport({ now: monday, dismissed: true }), false)
  assert.equal(shouldPromptWeeklyReport({ now: friday }), false)
})
