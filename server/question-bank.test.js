import test from 'node:test'
import assert from 'node:assert/strict'
import { createQuestionBankIndex, isValidBankQuestion, pickBankQuestions } from './question-bank.js'

const question = (id, dimension, stem = `题干-${id}`) => ({
  id, dimension, stem,
  options: ['A 项', 'B 项', 'C 项', 'D 项'],
  correctIndex: 1,
  explanation: `解析-${id}`
})

const record = (overrides = {}) => ({
  grade: '初二', subject: '数学', edition: '人教版', chapter: { id: 'ch-1', name: '三角形与全等' },
  questions: [question('q1', 'concept'), question('q2', 'basic-application'), question('q3', 'concept')],
  ...overrides
})

test('无效题不进题库：缺解析、选项不足、答案越界都会被过滤', () => {
  assert.equal(isValidBankQuestion(question('ok', 'concept')), true)
  assert.equal(isValidBankQuestion({ ...question('no-exp', 'concept'), explanation: '' }), false)
  assert.equal(isValidBankQuestion({ ...question('one-option', 'concept'), options: ['只有一项'] }), false)
  assert.equal(isValidBankQuestion({ ...question('bad-index', 'concept'), correctIndex: 4 }), false)
  const index = createQuestionBankIndex([record()])
  assert.equal(index.get('初二|数学|人教版|ch-1').questions.length, 3)
  assert.equal(createQuestionBankIndex([record({ chapter: null })]).size, 0)
  assert.equal(createQuestionBankIndex([record({ questions: [question('bad', 'concept', '')] })]).size, 0)
})

test('抽题优先同维度，其次同章节任意维度', () => {
  const index = createQuestionBankIndex([record()])
  const picked = pickBankQuestions({
    grade: '初二', subject: '数学', edition: '人教版', index,
    slots: [
      { chapterId: 'ch-1', dimension: 'basic-application' },
      { chapterId: 'ch-1', dimension: 'concept' },
      { chapterId: 'ch-1', dimension: 'transfer' }
    ]
  })
  assert.equal(picked[0].id, 'ch-1-q2')
  // transfer 没有同维度题，回落到任意未用过的题。
  assert.deepEqual(picked.map(item => item && item.id), ['ch-1-q2', 'ch-1-q1', 'ch-1-q3'])
})

test('同一套卷不重复用题，排除题干不再出现', () => {
  const index = createQuestionBankIndex([record()])
  const picked = pickBankQuestions({
    grade: '初二', subject: '数学', edition: '人教版', index,
    excludeStems: ['题干-q1'],
    slots: [
      { chapterId: 'ch-1', dimension: 'concept' },
      { chapterId: 'ch-1', dimension: 'concept' },
      { chapterId: 'ch-1', dimension: 'concept' }
    ]
  })
  assert.deepEqual(picked.map(item => item && item.id), ['ch-1-q3', 'ch-1-q2', null])
})

test('版本不一致时回落到不区分版本的题库', () => {
  const index = createQuestionBankIndex([record({ edition: '' })])
  const picked = pickBankQuestions({
    grade: '初二', subject: '数学', edition: '北师大版', index,
    slots: [{ chapterId: 'ch-1', dimension: 'concept' }]
  })
  assert.equal(picked[0].id, 'ch-1-q1')
})
