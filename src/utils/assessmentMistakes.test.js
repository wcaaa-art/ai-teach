import assert from 'node:assert/strict'
import test from 'node:test'
import { buildAssessmentMistakes } from './assessmentMistakes.js'

const base = {
  grade: '初一',
  subject: '数学',
  edition: '人教版',
  now: 1000
}

test('只收答错的客观题，跳过自评题、未作答和答对的题', () => {
  const records = buildAssessmentMistakes({
    ...base,
    review: [
      { id: 'q1', chapterId: 'c1', stem: '题干1', options: ['A项', 'B项'], correctIndex: 1, chosenIndex: 0, isCorrect: false },
      { id: 'q2', chapterId: 'c1', stem: '题干2', options: ['A项', 'B项'], correctIndex: 1, chosenIndex: 1, isCorrect: true },
      { id: 'q3', chapterId: 'c1', stem: '自评', options: ['会', '不会'], selfAssessment: true, chosenIndex: 0, isCorrect: null },
      { id: 'q4', chapterId: 'c1', stem: '未答', options: ['A项', 'B项'], correctIndex: 0, chosenIndex: null, isCorrect: null }
    ]
  })
  assert.equal(records.length, 1)
  assert.equal(records[0].questionId, 'q1')
})

test('题目、选项和答案解析按错题本口径落库', () => {
  const [record] = buildAssessmentMistakes({
    ...base,
    review: [{
      id: 'q1', chapterId: 'c1', chapterName: '二次函数', stem: '函数 y=x² 的顶点是？',
      options: ['(0,0)', '(1,1)', '(0,1)', '(1,0)'], correctIndex: 0, chosenIndex: 2,
      isCorrect: false, explanation: '顶点式 y=a(x-h)²+k', knowledgeTags: ['二次函数']
    }]
  })
  assert.equal(record.id, 'mistake-assessment-初一-数学-q1')
  assert.equal(record.source, 'assessment')
  assert.equal(record.type, 'single')
  assert.equal(record.correctIndex, 0)
  assert.equal(record.userAnswer, 'C. (0,1)')
  assert.equal(record.correctAnswer, 'A. (0,0)')
  assert.equal(record.explanation, '顶点式 y=a(x-h)²+k')
  assert.deepEqual(record.knowledgeTags, ['二次函数'])
  assert.equal(record.fixedAt, null)
  assert.equal(record.createdAt, 1000)
})

test('与章节测试同题时合并到原记录，并重新打开已消灭的错题', () => {
  const existing = [{
    id: 'mistake-quiz-初一-数学-q1', grade: '初一', subject: '数学', questionId: 'q1',
    source: 'quiz', createdAt: 111, updatedAt: 222, fixedAt: 333,
    redoCount: 1, lastRedoAt: 444, redoHistory: [{ at: 444, correct: true }]
  }]
  const [record] = buildAssessmentMistakes({
    ...base,
    existing,
    review: [{ id: 'q1', chapterId: 'c1', stem: '题干', options: ['A项', 'B项'], correctIndex: 1, chosenIndex: 0, isCorrect: false }]
  })
  assert.equal(record.id, 'mistake-quiz-初一-数学-q1')
  assert.equal(record.source, 'quiz')
  assert.equal(record.createdAt, 111)
  assert.equal(record.fixedAt, null)
  assert.equal(record.redoCount, 1)
  assert.deepEqual(record.redoHistory, [{ at: 444, correct: true }])
  assert.equal(record.updatedAt, 1000)
  assert.equal(record.userAnswer, 'A. A项')
  assert.equal(record.correctAnswer, 'B. B项')
})

test('题目缺少 id 时用章节加序号兜底，保证记录可追踪', () => {
  const [record] = buildAssessmentMistakes({
    ...base,
    review: [{ chapterId: 'c9', stem: '题干', options: ['A项', 'B项'], correctIndex: 1, chosenIndex: 0, isCorrect: false }]
  })
  assert.equal(record.questionId, 'c9-0')
  assert.equal(record.id, 'mistake-assessment-初一-数学-c9-0')
})

test('之前做对过、这次选项相邻选错，标注疑似点错', () => {
  const [record] = buildAssessmentMistakes({
    ...base,
    quizResults: [{ id: 'r1', perQuestion: [{ questionId: 'q1', correct: true }] }],
    review: [{ id: 'q1', chapterId: 'c1', stem: '题干', options: ['A项', 'B项', 'C项'], correctIndex: 1, chosenIndex: 2, isCorrect: false }]
  })
  assert.equal(record.wrongCount, 1)
  assert.equal(record.slip, 'misclick')
  assert.equal(record.slipAt, 1000)
  assert.equal(record.lastWrongAt, 1000)
})

test('同一道题再次答错累加错次，并取消粗心标记', () => {
  const existing = [{
    id: 'mistake-assessment-初一-数学-q1', grade: '初一', subject: '数学', questionId: 'q1',
    wrongCount: 1, slip: 'careless', slipAt: 900
  }]
  const [record] = buildAssessmentMistakes({
    ...base,
    existing,
    review: [{ id: 'q1', chapterId: 'c1', stem: '题干', options: ['A项', 'B项'], correctIndex: 1, chosenIndex: 0, isCorrect: false }]
  })
  assert.equal(record.wrongCount, 2)
  assert.equal(record.slip, '')
  assert.equal(record.slipAt, null)
})
