import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFallbackQuizQuestions, buildQuizBlueprint, sanitizeModelQuestion } from './quiz.js'
import { stemHash } from '../src/utils/quiz.js'

const chapters = [
  { id: 'math-pythagorean', name: '勾股定理' },
  { id: 'math-equation', name: '一元一次方程' }
]

test('蓝图按章节均分题量并按卷型分配题型', () => {
  const blueprint = buildQuizBlueprint({
    mode: 'daily', stage: '初中', grade: '初二', subject: '数学', chapters, questionCount: 6
  })
  assert.equal(blueprint.total, 6)
  assert.equal(blueprint.items.length, 2)
  assert.equal(blueprint.items[0].count, 3)
  assert.equal(blueprint.items[1].count, 3)
  const types = blueprint.items.flatMap(item => item.types)
  assert.ok(types.includes('single'))
  assert.ok(types.includes('fill'))
  assert.ok(types.includes('short'))
  // 初中卷型不出现多选题。
  assert.ok(!types.includes('multiple'))
})

test('高中理科蓝图包含多选题，文科不硬套多选', () => {
  const science = buildQuizBlueprint({
    mode: 'weekly', stage: '高中', grade: '高一', subject: '数学', chapters, questionCount: 12
  })
  assert.ok(science.items.flatMap(item => item.types).includes('multiple'))
  const liberal = buildQuizBlueprint({
    mode: 'weekly', stage: '高中', grade: '高一', subject: '语文', chapters, questionCount: 12
  })
  assert.ok(!liberal.items.flatMap(item => item.types).includes('multiple'))
})

test('本地兜底题数量、结构完整且同批不重复', () => {
  const blueprint = buildQuizBlueprint({
    mode: 'daily', stage: '初中', grade: '初二', subject: '数学', chapters, questionCount: 6
  })
  const questions = buildFallbackQuizQuestions({ blueprint, seed: 3 })
  assert.equal(questions.length, 6)
  const hashes = questions.map(question => stemHash(question.stem))
  assert.equal(new Set(hashes).size, hashes.length)
  for (const question of questions) {
    assert.ok(question.id && question.chapterId && question.chapterName && question.stem)
    assert.ok(Number(question.score) > 0)
    if (question.type === 'single') assert.ok(question.options[question.correctIndex])
    if (question.type === 'multiple') assert.ok(question.correctIndexes.length >= 2)
    if (question.type === 'fill') assert.ok(question.answer)
    if (question.type === 'short') assert.ok(question.referenceAnswer)
  }
})

test('兜底出题会避开已出过的题干', () => {
  const blueprint = buildQuizBlueprint({
    mode: 'daily', stage: '初中', grade: '初二', subject: '数学', chapters: [chapters[0]], questionCount: 5
  })
  const first = buildFallbackQuizQuestions({ blueprint, seed: 1 })
  const excluded = new Set(first.map(question => stemHash(question.stem)))
  const second = buildFallbackQuizQuestions({ blueprint, excluded, seed: 1 })
  assert.equal(second.length, 5)
  for (const question of second) assert.ok(!excluded.has(stemHash(question.stem)))
})

test('模型题校验拒绝越界章节与缺答案的题', () => {
  const base = { id: 'q1', chapterId: 'math-pythagorean', chapterName: '勾股定理', stem: '题干', type: 'single', options: ['A', 'B'], correctIndex: 0 }
  assert.ok(sanitizeModelQuestion(base, { chapters, stage: '初中', subject: '数学' }))
  assert.equal(sanitizeModelQuestion({ ...base, chapterId: 'not-selected', chapterName: '未选章节', stem: '另一道题' }, { chapters, stage: '初中', subject: '数学' }), null)
  assert.equal(sanitizeModelQuestion({ ...base, correctIndex: 5 }, { chapters, stage: '初中', subject: '数学' }), null)
  assert.equal(sanitizeModelQuestion({ ...base, type: 'fill', answer: '' }, { chapters, stage: '初中', subject: '数学' }), null)
  const multiple = { ...base, type: 'multiple', correctIndexes: [0, 1] }
  assert.ok(sanitizeModelQuestion(multiple, { chapters, stage: '高中', subject: '数学' }))
  // 初中卷型不接收多选题；若模型只给 correctIndexes 而没有 correctIndex，降级单选后仍应被拒绝。
  assert.equal(sanitizeModelQuestion({ ...multiple, correctIndex: undefined }, { chapters, stage: '初中', subject: '数学' }), null)
})
