import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeChapterMastery } from './mastery.js'

const NOW = Date.UTC(2026, 4, 10)
const DAY = 24 * 60 * 60 * 1000
const base = { grade: '初一', subject: '数学', edition: '人教版' }

test('只有摸底时是低置信度', () => {
  const result = mergeChapterMastery({
    ...base, now: NOW,
    assessments: [{ ...base, createdAt: NOW, masteryByChapter: { c1: 2 } }]
  })
  assert.equal(result.c1.score, 2)
  assert.deepEqual(result.c1.sourceLabels, ['摸底'])
  assert.equal(result.c1.confidence, '低')
})

test('章节测试权重高于摸底，低正确率拉低掌握度', () => {
  const result = mergeChapterMastery({
    ...base, now: NOW,
    assessments: [{ ...base, createdAt: NOW, masteryByChapter: { c1: 3 } }],
    quizResults: [{
      ...base, createdAt: NOW,
      questions: [{ id: 'q1', chapterId: 'c1' }],
      perQuestion: [{ questionId: 'q1', earned: 0, maxScore: 5 }]
    }]
  })
  // (3×1 + 0×1.2) / 2.2 ≈ 1.36
  assert.equal(result.c1.score, 1.4)
  assert.deepEqual(result.c1.sourceLabels, ['摸底', '章节测试'])
  assert.equal(result.c1.confidence, '中')
})

test('错题按负向证据扣分且有上限', () => {
  const result = mergeChapterMastery({
    ...base, now: NOW,
    assessments: [{ ...base, createdAt: NOW, masteryByChapter: { c1: 3 } }],
    mistakes: [
      { ...base, chapterId: 'c1', createdAt: NOW },
      { ...base, chapterId: 'c1', createdAt: NOW }
    ]
  })
  // 3 - 2×0.4×0.8 = 2.36
  assert.equal(result.c1.score, 2.4)
  assert.ok(result.c1.sourceLabels.includes('错题'))
})

test('时间衰减让旧摸底让位于新测试', () => {
  const result = mergeChapterMastery({
    ...base, now: NOW,
    assessments: [{ ...base, createdAt: NOW - 60 * DAY, masteryByChapter: { c1: 3 } }],
    quizResults: [{
      ...base, createdAt: NOW,
      questions: [{ id: 'q1', chapterId: 'c1' }],
      perQuestion: [{ questionId: 'q1', earned: 0, maxScore: 5 }]
    }]
  })
  assert.ok(result.c1.score < 0.5, `旧摸底不应主导，实际 ${result.c1.score}`)
})

test('主观题未自评不计入章节分，且其他科目不串数据', () => {
  const result = mergeChapterMastery({
    ...base, now: NOW,
    quizResults: [{
      ...base, createdAt: NOW,
      questions: [{ id: 'q1', chapterId: 'c1' }],
      perQuestion: [{ questionId: 'q1', earned: 0, maxScore: 5, needsSelfGrade: true, selfGrade: null }]
    }],
    mistakes: [{ grade: '初一', subject: '英语', chapterId: 'c1', createdAt: NOW }]
  })
  assert.equal(result.c1, undefined)
})
