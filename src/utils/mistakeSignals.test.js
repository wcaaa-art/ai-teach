import assert from 'node:assert/strict'
import test from 'node:test'
import { correctBeforeFromRecord, hotKnowledgePoints, judgeWrongReason, priorCorrectTimes, wrongTimesOf } from './mistakeSignals.js'

test('错次优先用落库值，旧数据按重做答错次数兜底', () => {
  assert.equal(wrongTimesOf({ wrongCount: 3, redoHistory: [] }), 3)
  assert.equal(wrongTimesOf({ redoHistory: [{ correct: true }, { correct: false }] }), 2)
  assert.equal(wrongTimesOf({}), 1)
  assert.equal(wrongTimesOf(null), 0)
})

test('之前做对过的证据来自重做答对和已消灭记录', () => {
  assert.equal(correctBeforeFromRecord({ redoHistory: [{ correct: true }, { correct: false }] }), 1)
  assert.equal(correctBeforeFromRecord({ fixedAt: 1, redoHistory: [{ correct: true }] }), 2)
  assert.equal(correctBeforeFromRecord(null), 0)
})

test('历史测试和摸底里同一道题答对过几次都能数出来', () => {
  const count = priorCorrectTimes({
    questionId: 'q1',
    quizResults: [
      { id: 'r1', perQuestion: [{ questionId: 'q1', correct: true }] },
      { id: 'r2', perQuestion: [{ questionId: 'q1', correct: false }] },
      { id: 'r3', perQuestion: [{ questionId: 'q1', needsSelfGrade: true, selfGrade: 1 }] },
      { id: 'skip', perQuestion: [{ questionId: 'q1', correct: true }] }
    ],
    assessments: [
      { id: 'a1', questions: [{ id: 'q1', correctIndex: 2 }], answers: { q1: 2 } },
      { id: 'a2', questions: [{ id: 'q1', correctIndex: 2 }], answers: { q1: 0 } },
      { id: 'skip-a', questions: [{ id: 'q1', correctIndex: 2 }], answers: { q1: 2 } }
    ],
    excludeQuizId: 'skip',
    excludeAssessmentId: 'skip-a'
  })
  assert.equal(count, 3)
})

test('之前做对过且第一次错：相邻选项判点错，其余判粗心', () => {
  assert.equal(judgeWrongReason({ chosenIndex: 2, correctIndex: 1, priorCorrect: 2, nextWrongCount: 1 }), 'misclick')
  assert.equal(judgeWrongReason({ chosenIndex: 3, correctIndex: 0, priorCorrect: 2, nextWrongCount: 1 }), 'careless')
  assert.equal(judgeWrongReason({ type: 'fill', priorCorrect: 1, nextWrongCount: 1 }), 'careless')
  // 没有做对过、或已经错过一次、或主观题，都不判粗心。
  assert.equal(judgeWrongReason({ chosenIndex: 2, correctIndex: 1, priorCorrect: 0, nextWrongCount: 1 }), '')
  assert.equal(judgeWrongReason({ chosenIndex: 2, correctIndex: 1, priorCorrect: 3, nextWrongCount: 2 }), '')
  assert.equal(judgeWrongReason({ type: 'short', priorCorrect: 3, nextWrongCount: 1 }), '')
})

test('同一知识点下待消灭错题满 3 道才算易错知识点', () => {
  const rows = [
    { knowledgeTags: ['二次函数'], fixedAt: null },
    { knowledgeTags: ['二次函数'] },
    { chapterName: '二次函数' },
    { knowledgeTags: ['二次函数'], fixedAt: 1 },
    { knowledgeTags: ['一元二次方程'] },
    { knowledgeTags: ['一元二次方程'] },
    { knowledgeTags: ['一元二次方程'] }
  ]
  const hot = hotKnowledgePoints(rows)
  assert.ok(hot.has('二次函数'))
  assert.ok(hot.has('一元二次方程'))
  assert.equal(hot.size, 2)
})
