import assert from 'node:assert/strict'
import test from 'node:test'
import { buildReciteMistake, hashText, reciteMistakeId } from './reciteMistakes.js'

const now = 1731700000000

test('hashText 对同一文本稳定、对不同文本区分', () => {
  assert.equal(hashText('静以修身'), hashText('静以修身'))
  assert.notEqual(hashText('静以修身'), hashText('俭以养德'))
  assert.equal(hashText(''), hashText(null))
})

test('reciteMistakeId 带计划 id 前缀，避免跨计划撞 id', () => {
  assert.equal(reciteMistakeId('plan-1', 'abc'), `recite-plan-1-${hashText('abc')}`)
  assert.notEqual(reciteMistakeId('plan-1', 'abc'), reciteMistakeId('plan-2', 'abc'))
})

test('首次卡壳：按错题本口径落一条自评型错题', () => {
  const record = buildReciteMistake({
    prior: null,
    id: reciteMistakeId('plan-1', '静以修身'),
    subject: '语文',
    grade: '初二',
    chapterName: '诫子书',
    knowledgeTags: ['诫子书背诵'],
    record: { key: '静以修身', stem: '背诵卡壳：静以修身', userAnswer: '静以修身', correctAnswer: '静以修身' },
    now
  })
  assert.equal(record.id, `recite-plan-1-${hashText('静以修身')}`)
  assert.equal(record.source, 'recite')
  assert.equal(record.type, 'recite')
  assert.deepEqual(record.options, [])
  assert.equal(record.wrongCount, 1)
  assert.equal(record.lastWrongAt, now)
  assert.equal(record.createdAt, now)
  assert.equal(record.fixedAt, null)
  assert.deepEqual(record.redoHistory, [])
  assert.deepEqual(record.knowledgeTags, ['诫子书背诵'])
})

test('再次卡壳同一处：累加错次、清消灭标记、保留复习进度', () => {
  const prior = {
    id: 'recite-plan-1-x',
    grade: '初二',
    subject: '语文',
    edition: '人教版',
    wrongCount: 2,
    redoCount: 1,
    lastRedoAt: now - 5000,
    redoHistory: [{ at: now - 5000, correct: true }],
    knowledgeTags: ['旧标签'],
    createdAt: now - 9999
  }
  const record = buildReciteMistake({
    prior,
    id: prior.id,
    subject: '语文',
    grade: '',
    chapterName: '诫子书',
    knowledgeTags: [],
    record: { key: '静以修身', stem: '背诵卡壳：静以修身', userAnswer: '静', correctAnswer: '静以修身' },
    now
  })
  assert.equal(record.wrongCount, 3)
  assert.equal(record.createdAt, now - 9999)
  assert.equal(record.fixedAt, null)
  assert.equal(record.redoCount, 1)
  assert.deepEqual(record.redoHistory, [{ at: now - 5000, correct: true }])
  // 新知识点为空时保留旧标签，不覆盖成空数组。
  assert.deepEqual(record.knowledgeTags, ['旧标签'])
  // grade 为空时回落到旧记录的年级。
  assert.equal(record.grade, '初二')
})
