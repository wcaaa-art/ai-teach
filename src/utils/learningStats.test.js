import assert from 'node:assert/strict'
import test from 'node:test'
import { examAverageRate, examSessionRows, learningSuggestions, quizAccuracyOf, subjectAccuracyRows, wrongChapterRows } from './learningStats.js'

test('测试正确率按题量加权，小测不会和大卷同权', () => {
  const results = [
    { accuracy: 0.5, questionCount: 10 },
    { accuracy: 1, questionCount: 2 }
  ]
  assert.equal(quizAccuracyOf(results), 58)
  assert.equal(quizAccuracyOf([]), 0)
})

test('科目正确率按科目聚合后从弱到强排序', () => {
  const rows = subjectAccuracyRows([
    { subject: '数学', accuracy: 0.5, questionCount: 10 },
    { subject: '数学', accuracy: 0.8, questionCount: 10 },
    { subject: '物理', accuracy: 1, questionCount: 5 }
  ])
  assert.deepEqual(rows.map(row => [row.subject, row.accuracy, row.tests]), [['数学', 65, 2], ['物理', 100, 1]])
})

test('错题按科目和章节聚合，取前 N 个并截断长章节名', () => {
  const rows = wrongChapterRows([
    { subject: '数学', chapterName: '二次函数与一元二次方程' },
    { subject: '数学', chapterName: '二次函数与一元二次方程' },
    { subject: '数学', chapterName: '二次函数与一元二次方程' },
    { subject: '数学', chapterName: '勾股定理' },
    { subject: '数学', chapterName: '勾股定理' },
    { subject: '物理', chapterName: '电学' }
  ], 2)
  assert.equal(rows.length, 2)
  assert.deepEqual(rows.map(row => [row.name, row.count]), [['二次函数与一元二次方程', 3], ['勾股定理', 2]])
  assert.equal(rows[0].shortName, '二次函数与一元二次…')
})

test('同一场考试合并多科成绩，缺失满分与空场次被排除', () => {
  const sessions = examSessionRows([
    { examId: 'e1', name: '期中', date: 200, score: 100, fullScore: 120 },
    { examId: 'e1', name: '期中', date: 200, score: 80, fullScore: 100 },
    { examId: 'e2', name: '月考', date: 300, score: 60, fullScore: 100 },
    { examId: 'e3', name: '无效', date: 400, score: 50, fullScore: 0 }
  ])
  assert.equal(sessions.length, 2)
  assert.deepEqual(sessions.map(row => [row.name, row.score, row.full]), [['期中', 180, 220], ['月考', 60, 100]])
  assert.equal(examAverageRate(sessions), 75)
})

test('学习建议优先指出薄弱科目、集中错题和考试退步，最多三条', () => {
  const suggestions = learningSuggestions({
    results: [{ subject: '数学', accuracy: 0.5, questionCount: 10 }],
    mistakes: [
      { subject: '数学', chapterName: '二次函数' },
      { subject: '数学', chapterName: '二次函数' }
    ],
    examSessions: [
      { name: '月考', score: 60, full: 100 },
      { name: '期中', score: 50, full: 100 }
    ],
    accuracy: 50
  })
  assert.equal(suggestions.length, 3)
  assert.match(suggestions[0], /数学.*50%/)
  assert.match(suggestions[1], /二次函数/)
  assert.match(suggestions[2], /期中.*低 10 个百分点/)
})

test('没有任何记录时给出一条可执行的空态建议', () => {
  const suggestions = learningSuggestions({ results: [], mistakes: [], examSessions: [], accuracy: 0 })
  assert.equal(suggestions.length, 1)
  assert.match(suggestions[0], /先完成一次章节测试/)
})
