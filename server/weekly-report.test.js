import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFallbackWeeklyReport, normalizeWeeklyReport } from './weekly-report.js'

const richPayload = {
  focus: {
    minutes: 320, sessions: 14, completionRate: 86, activeDays: 5, streakDays: 4,
    deltaPercent: 18, distractions: 7,
    topDistraction: { label: '页面切走', count: 4 },
    peakWindow: { start: 19, end: 21 }
  },
  quiz: { tests: 4, questions: 60, accuracy: 82, previousAccuracy: 74, weakestSubject: { subject: '数学', accuracy: 66 } },
  mistakes: { count: 9, unresolved: 5, fixed: 2, redos: 4, redoCorrect: 3, topChapters: [{ name: '勾股定理', subject: '数学', count: 4 }] },
  exams: { count: 1, averageRate: 88, latest: { name: '期中考试', rate: 88 } },
  plans: { active: 3, completedThisWeek: 5, completionRate: 63 }
}

test('有数据时兜底周报带出专注、测试、错题和考试结论', () => {
  const report = buildFallbackWeeklyReport(richPayload)
  assert.match(report.headline, /320 分钟/)
  assert.match(report.headline, /18%/)
  assert.match(report.summary, /82%/)
  assert.match(report.summary, /勾股定理/)
  assert.match(report.summary, /期中考试/)
  assert.match(report.summary, /完成率 63%/)
  assert.match(report.summary, /消灭 2 道/)
  assert.ok(report.strengths.some(item => item.includes('86%')))
  assert.ok(report.strengths.some(item => item.includes('消灭 2 道')))
  assert.ok(report.risks.some(item => item.includes('数学')))
  assert.ok(report.actions.length >= 3)
  assert.ok(report.actions.some(item => item.includes('勾股定理')))
  assert.ok(report.closing.length > 0)
})

test('计划完成率低、重做正确率低时给出对应风险和动作', () => {
  const report = buildFallbackWeeklyReport({
    plans: { active: 8, completedThisWeek: 2, completionRate: 20 },
    mistakes: { count: 4, unresolved: 7, fixed: 0, redos: 4, redoCorrect: 1, topChapters: [] }
  })
  assert.match(report.summary, /完成率 20%/)
  assert.ok(report.risks.some(item => item.includes('计划完成率 20%')))
  assert.ok(report.risks.some(item => item.includes('解析还没真正吃透')))
  assert.ok(report.actions.some(item => item.includes('拆成 25 分钟')))
  assert.ok(report.actions.some(item => item.includes('遮住答案')))
})

test('空数据时给出可执行的起步建议，不编造数字', () => {
  const report = buildFallbackWeeklyReport({})
  assert.equal(report.headline, '这一周还没有留下学习记录')
  assert.match(report.summary, /没有专注、测试、错题或考试记录/)
  assert.equal(report.strengths.length, 1)
  assert.equal(report.risks.length, 1)
  assert.equal(report.actions.length, 3)
  assert.ok(report.actions.every(item => !/\d{3,}/.test(item)))
})

test('模型只返回部分字段时，缺失部分回落到本地版本', () => {
  const fallback = buildFallbackWeeklyReport(richPayload)
  const report = normalizeWeeklyReport({ headline: '本周复盘', strengths: ['正确率稳定', '', 42] }, fallback)
  assert.equal(report.headline, '本周复盘')
  assert.deepEqual(report.strengths, ['正确率稳定'])
  assert.equal(report.summary, fallback.summary)
  assert.deepEqual(report.actions, fallback.actions)
  assert.equal(report.closing, fallback.closing)
})

test('非对象或空对象输入退回兜底周报', () => {
  const fallback = buildFallbackWeeklyReport(richPayload)
  assert.deepEqual(normalizeWeeklyReport(null, fallback), fallback)
  assert.deepEqual(normalizeWeeklyReport([], fallback), fallback)
  assert.deepEqual(normalizeWeeklyReport('bad', fallback), fallback)
})

test('超长字段与过多条目被裁剪', () => {
  const fallback = buildFallbackWeeklyReport({})
  const report = normalizeWeeklyReport({
    headline: '长'.repeat(120),
    summary: '概'.repeat(500),
    strengths: Array.from({ length: 8 }, (_, index) => `优点${index}`),
    risks: ['风'.repeat(100)],
    actions: ['动'.repeat(100)],
    closing: '结'.repeat(200)
  }, fallback)
  assert.equal(report.headline.length, 60)
  assert.equal(report.summary.length, 320)
  assert.equal(report.strengths.length, 4)
  assert.equal(report.risks[0].length, 60)
  assert.equal(report.actions[0].length, 60)
  assert.equal(report.closing.length, 120)
})
