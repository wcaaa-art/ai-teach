import assert from 'node:assert/strict'
import test from 'node:test'
import { planMistakeSignalsMigration } from './migrateMistakeSignals.js'

function assessment(overrides = {}) {
  return {
    id: 'a1', grade: '初一', subject: '数学', edition: '人教版', createdAt: 1000,
    questions: [{
      id: 'q1', type: 'single', stem: '函数 y=x² 的顶点是？', options: ['(0,0)', '(1,1)', '(0,1)'],
      correctIndex: 0, chapterId: 'c1', chapterName: '二次函数', knowledgeTags: ['二次函数'], explanation: '顶点式'
    }],
    answers: { q1: 1 },
    ...overrides
  }
}

function quizResult(overrides = {}) {
  return {
    id: 'r1', grade: '初一', subject: '数学', createdAt: 500,
    questions: [{ id: 'q1', type: 'single', correctIndex: 0 }],
    answers: { q1: 0 },
    perQuestion: [{ questionId: 'q1', correct: true, needsSelfGrade: false }],
    ...overrides
  }
}

test('历史摸底答错的客观题补建成错题，时间沿用摸底时间', () => {
  const { creates, summary } = planMistakeSignalsMigration({
    assessments: [assessment()], now: 5000
  })
  assert.equal(creates.length, 1)
  assert.equal(summary.created, 1)
  const [record] = creates
  assert.equal(record.id, 'mistake-assessment-初一-数学-q1')
  assert.equal(record.source, 'assessment')
  assert.equal(record.wrongCount, 1)
  assert.equal(record.slip, '')
  assert.equal(record.createdAt, 1000)
  assert.equal(record.lastWrongAt, 1000)
  assert.equal(record.userAnswer, 'B. (1,1)')
  assert.equal(record.correctAnswer, 'A. (0,0)')
})

test('之前做对过、这次第一次错且选项相邻，补标疑似点错', () => {
  const { creates, summary } = planMistakeSignalsMigration({
    assessments: [assessment()],
    quizResults: [quizResult()],
    now: 5000
  })
  assert.equal(creates[0].slip, 'misclick')
  assert.equal(creates[0].slipAt, 1000)
  assert.equal(summary.misclick, 1)
})

test('同一道题两次摸底都错只建一条，错次累加且不再标粗心', () => {
  const { creates, summary } = planMistakeSignalsMigration({
    assessments: [
      assessment(),
      assessment({ id: 'a2', createdAt: 2000 })
    ],
    quizResults: [quizResult()],
    now: 5000
  })
  assert.equal(creates.length, 1)
  assert.equal(creates[0].wrongCount, 2)
  assert.equal(creates[0].slip, '')
  assert.equal(creates[0].lastWrongAt, 2000)
  assert.equal(summary.created, 1)
  assert.equal(summary.careless, 0)
  assert.equal(summary.misclick, 0)
})

test('已有错题只补信号，不改内容和已消灭状态', () => {
  const existing = {
    id: 'mistake-quiz-初一-数学-q1', grade: '初一', subject: '数学', questionId: 'q1',
    source: 'quiz', stem: '旧题干', wrongCount: 1, slip: '', lastWrongAt: 0,
    redoHistory: [], fixedAt: 3000, createdAt: 100
  }
  const { creates, updates } = planMistakeSignalsMigration({
    mistakes: [existing],
    assessments: [assessment()],
    now: 5000
  })
  assert.equal(creates.length, 0)
  assert.equal(updates.length, 1)
  assert.equal(updates[0].id, existing.id)
  assert.equal(updates[0].stem, '旧题干')
  assert.equal(updates[0].wrongCount, 1)
  assert.equal(updates[0].fixedAt, 3000)
})

test('消灭之后又答错的历史记录重新打开', () => {
  const existing = {
    id: 'mistake-quiz-初一-数学-q1', grade: '初一', subject: '数学', questionId: 'q1',
    source: 'quiz', wrongCount: 1, slip: 'careless', slipAt: 800,
    redoHistory: [], fixedAt: 800, createdAt: 100
  }
  const { updates } = planMistakeSignalsMigration({
    mistakes: [existing],
    assessments: [assessment()],
    now: 5000
  })
  assert.equal(updates[0].fixedAt, null)
  // 只错过这一次，且错选与正确项相邻，仍按首次错误判为疑似点错。
  assert.equal(updates[0].slip, 'misclick')
})

test('错题本里重做答错计入错次，章节测试未作答不计', () => {
  const existing = {
    id: 'mistake-assessment-初一-数学-q1', grade: '初一', subject: '数学', questionId: 'q1',
    wrongCount: 1, redoHistory: [{ at: 1500, correct: false }], fixedAt: null, createdAt: 100
  }
  const unattempted = quizResult({ answers: {}, perQuestion: [{ questionId: 'q1', correct: false, needsSelfGrade: false }] })
  const { updates } = planMistakeSignalsMigration({
    mistakes: [existing],
    assessments: [assessment()],
    quizResults: [unattempted],
    now: 5000
  })
  assert.equal(updates[0].wrongCount, 2)
  assert.equal(updates[0].slip, '')
})

test('迁移重复执行是幂等的', () => {
  const first = planMistakeSignalsMigration({ assessments: [assessment()], now: 5000 })
  const second = planMistakeSignalsMigration({
    mistakes: first.creates,
    assessments: [assessment()],
    now: 6000
  })
  assert.equal(second.creates.length, 0)
  assert.equal(second.updates.length, 0)
})
