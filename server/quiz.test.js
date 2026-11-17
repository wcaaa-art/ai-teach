import assert from 'node:assert/strict'
import test from 'node:test'
import { buildFallbackQuizQuestions, buildQuizBlueprint, planQuizBankPicks, sanitizeModelQuestion } from './quiz.js'
import { createQuestionBankIndex, createQuizBankIndex } from './question-bank.js'
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

test('综合整卷按 25 题组卷，满分按科目为 120 或 100', () => {
  const paperChapters = Array.from({ length: 10 }, (_, index) => ({ id: `chapter-${index + 1}`, name: `专题${index + 1}` }))
  for (const [subject, fullScore] of [['数学', 120], ['物理', 100]]) {
    const blueprint = buildQuizBlueprint({ mode: 'paper', grade: '初三', subject, chapters: paperChapters })
    assert.equal(blueprint.total, 25)
    const types = blueprint.items.flatMap(item => item.types)
    assert.equal(types.filter(type => type === 'single').length, 10)
    assert.equal(types.filter(type => type === 'fill').length, 6)
    assert.equal(types.filter(type => type === 'short').length, 9)
    const totalScore = blueprint.items.reduce((sum, item) => sum + item.scores.reduce((inner, score) => inner + score, 0), 0)
    assert.equal(totalScore, fullScore)
    const questions = buildFallbackQuizQuestions({ blueprint, seed: 2 })
    assert.equal(questions.length, 25)
    assert.equal(questions.reduce((sum, question) => sum + question.score, 0), fullScore)
    assert.equal(new Set(questions.map(question => question.id)).size, questions.length)
  }
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
  // 初中卷型不支持多选：模型只给 correctIndexes 而没有 correctIndex 时，降级单选后应被拒绝。
  assert.equal(sanitizeModelQuestion({ ...multiple, correctIndex: undefined }, { chapters }), null)
})

test('章节测试单选位优先命中离线题库，填空解答不抽题库', () => {
  const bankIndex = createQuestionBankIndex([{
    grade: '初二', subject: '数学', edition: '人教版',
    chapter: { id: 'math-pythagorean', name: '勾股定理' },
    questions: ['concept', 'basic-application', 'transfer', 'concept'].map((dimension, index) => ({
      id: `bq-${index + 1}`, dimension, stem: `题库题干${index + 1}`,
      options: ['A', 'B', 'C', 'D'], correctIndex: 0, explanation: '解析'
    }))
  }])
  const slots = [
    { chapterId: 'math-pythagorean', type: 'single' },
    { chapterId: 'math-pythagorean', type: 'fill' },
    { chapterId: 'math-pythagorean', type: 'single' },
    { chapterId: 'math-pythagorean', type: 'single' }
  ]
  const picks = planQuizBankPicks({ grade: '初二', subject: '数学', edition: '人教版', slots, index: bankIndex, quizIndex: new Map() })
  // 只接管单选位，维度按 concept → basic-application → transfer 轮转。
  assert.deepEqual([...picks.keys()], [0, 2, 3])
  assert.deepEqual([picks.get(0).id, picks.get(2).id, picks.get(3).id], [
    'math-pythagorean-bq-1', 'math-pythagorean-bq-2', 'math-pythagorean-bq-3'
  ])
  // 版本或年级不匹配都不命中，题位留给模型与本地兜底。
  assert.equal(planQuizBankPicks({ grade: '初二', subject: '数学', slots, index: bankIndex, quizIndex: new Map() }).size, 0)
  assert.equal(planQuizBankPicks({ grade: '初三', subject: '数学', edition: '人教版', slots, index: bankIndex, quizIndex: new Map() }).size, 0)
  // 题库没有主观题时不命中填空/解答位。
  assert.equal(planQuizBankPicks({ grade: '初二', subject: '数学', edition: '人教版', slots: [{ chapterId: 'math-pythagorean', type: 'short' }], quizIndex: new Map() }).size, 0)
})

test('章节测试填空/解答位只匹配同题型主观题库', () => {
  const quizIndex = createQuizBankIndex([{
    grade: '初二', subject: '数学', edition: '人教版',
    chapter: { id: 'math-pythagorean', name: '勾股定理' },
    questions: [
      { id: 'f1', type: 'fill', stem: '填空一', answer: '5', explanation: '解析', acceptableAnswers: ['5'] },
      { id: 'f2', type: 'fill', stem: '填空二', answer: '12', explanation: '解析' },
      { id: 's1', type: 'short', stem: '解答一', referenceAnswer: '步骤略', explanation: '解析' },
      // 缺解析的主观题不入池。
      { id: 's2', type: 'short', stem: '解答二', referenceAnswer: '步骤略', explanation: '' }
    ]
  }])
  const slots = [
    { chapterId: 'math-pythagorean', type: 'fill' },
    { chapterId: 'math-pythagorean', type: 'short' },
    { chapterId: 'math-pythagorean', type: 'fill' }
  ]
  const picks = planQuizBankPicks({ grade: '初二', subject: '数学', edition: '人教版', slots, quizIndex, index: new Map() })
  assert.deepEqual([...picks.keys()], [0, 1, 2])
  assert.deepEqual([picks.get(0).id, picks.get(1).id, picks.get(2).id], [
    'math-pythagorean-f1', 'math-pythagorean-s1', 'math-pythagorean-f2'
  ])
  assert.equal(picks.get(1).referenceAnswer, '步骤略')
})
