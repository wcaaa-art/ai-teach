// 周报数字一致性校验测试：确认「模型写了输入里没有的数字」能被查出来，
// 而正常周报不误报。这是「禁止编造」从提示词落到代码的证据。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildFallbackWeeklyReport, verifyWeeklyReportNumbers } from './weekly-report.js'

const PAYLOAD = {
  focus: { minutes: 320, sessions: 12, completionRate: 80, activeDays: 5, streakDays: 3, distractions: 6 },
  quiz: { tests: 4, questions: 60, accuracy: 78, previousAccuracy: 70 },
  mistakes: { count: 9, unresolved: 7, fixed: 6, redos: 8, redoCorrect: 5 },
  plans: { active: 4, completedThisWeek: 7 },
  exams: { count: 1, averageRate: 82 }
}

test('本地兜底周报的数字与真实数据一致', () => {
  const report = buildFallbackWeeklyReport(PAYLOAD)
  const result = verifyWeeklyReportNumbers(report, PAYLOAD)
  assert.equal(result.consistent, true, `本地周报不应有数字冲突：${JSON.stringify(result.mismatches)}`)
  assert.ok(result.checked > 0, '没有检出任何可核对指标')
})

test('模型编造的数字会被核对出来', () => {
  const report = {
    headline: '本周专注 1280 分钟，较上周多 12%',
    summary: '完成 9 次章节测试共 60 题，平均正确率 78%。本周消灭 6 道错题。',
    strengths: ['测试平均正确率 78%，基础掌握较稳。'],
    risks: ['错题集中在「一元二次方程」（9 道），同类错误在重复。'],
    actions: ['安排一次 25 分钟错题复盘。'],
    closing: '保持每周复盘一次。'
  }
  const result = verifyWeeklyReportNumbers(report, PAYLOAD)
  assert.equal(result.consistent, false, '编造的 1280 分钟没被查出来')
  const labels = result.mismatches.map(item => item.label)
  assert.ok(labels.includes('专注分钟'), `应报出专注分钟不一致，实际：${labels.join(',')}`)
  const minutes = result.mismatches.find(item => item.label === '专注分钟')
  assert.equal(minutes.reported, 1280)
  assert.equal(minutes.expected, 320)
  // 正确率 78% 是真实值，不该被误报
  assert.ok(!labels.includes('测试正确率'), '真实数字被误报了')
})

test('真实数字一致时校验通过', () => {
  const report = {
    headline: '本周专注 320 分钟',
    summary: '完成 4 次章节测试共 60 题，平均正确率 78%。本周消灭 6 道错题。',
    strengths: [], risks: [], actions: [], closing: ''
  }
  const result = verifyWeeklyReportNumbers(report, PAYLOAD)
  assert.equal(result.consistent, true, JSON.stringify(result.mismatches))
  assert.ok(result.checked >= 3, '检出的可核对指标太少')
})

test('输入里缺字段时不误报', () => {
  const report = { headline: '本周专注 320 分钟', summary: '完成 4 次章节测试共 60 题。', strengths: [], risks: [], actions: [], closing: '' }
  const result = verifyWeeklyReportNumbers(report, { focus: { minutes: 320 } })
  assert.equal(result.consistent, true, JSON.stringify(result.mismatches))
})

test('空报告与空输入都能安全处理', () => {
  assert.equal(verifyWeeklyReportNumbers({}, {}).consistent, true)
  assert.equal(verifyWeeklyReportNumbers().consistent, true)
})
