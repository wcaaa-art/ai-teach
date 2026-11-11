import assert from 'node:assert/strict'
import test from 'node:test'
import {
  computeQuizSummary, findWeeklyQuizResult, getWeeklyWindowStart,
  gradeQuestion, normalizeStem, recommendFocusMinutes, stemHash
} from './quiz.js'

test('题干归一化忽略空白、标点、大小写与全角差异', () => {
  const first = '  计算：3 + 5 =？ '
  const second = '计算3+5=?'
  assert.equal(normalizeStem(first), normalizeStem(second))
  assert.equal(stemHash(first), stemHash(second))
  assert.notEqual(stemHash('计算 3 + 5'), stemHash('计算 3 + 6'))
})

test('单选题按正确选项判分', () => {
  const question = { type: 'single', options: ['A', 'B'], correctIndex: 1, score: 3 }
  assert.equal(gradeQuestion(question, 1).earned, 3)
  assert.equal(gradeQuestion(question, 0).earned, 0)
  assert.equal(gradeQuestion(question, undefined).correct, false)
})

test('多选题少选得部分分，错选得 0 分', () => {
  const question = { type: 'multiple', options: ['A', 'B', 'C', 'D'], correctIndexes: [0, 2], score: 6 }
  assert.equal(gradeQuestion(question, [0, 2]).earned, 6)
  assert.equal(gradeQuestion(question, [0]).earned, 3)
  assert.equal(gradeQuestion(question, [0, 1]).earned, 0)
  assert.equal(gradeQuestion(question, []).earned, 0)
})

test('填空题接受等价写法与数值误差', () => {
  const question = { type: 'fill', answer: '5', acceptableAnswers: ['五'], score: 3 }
  assert.equal(gradeQuestion(question, '5').earned, 3)
  assert.equal(gradeQuestion(question, '5.0').earned, 3)
  assert.equal(gradeQuestion(question, '五').earned, 3)
  assert.equal(gradeQuestion(question, '4').earned, 0)
})

test('主观题未自评前不计入正确率分母，自评后按比例计分', () => {
  const questions = [
    { id: 'q1', type: 'single', options: ['A', 'B'], correctIndex: 0, score: 3 },
    { id: 'q2', type: 'short', score: 10, referenceAnswer: '参考' }
  ]
  const before = computeQuizSummary({ questions, answers: { q1: 0 } })
  assert.equal(before.accuracy, 1)
  assert.equal(before.complete, false)
  const after = computeQuizSummary({ questions, answers: { q1: 0 }, selfGrades: { q2: 0.5 } })
  assert.equal(after.earned, 8)
  assert.equal(after.totalMax, 13)
  assert.equal(after.complete, true)
})

test('专注时长建议按正确率与用时落在 25 / 40 / 45', () => {
  assert.equal(recommendFocusMinutes({ accuracy: 0.95, averageSecondsPerQuestion: 40 }).recommendedMinutes, 25)
  assert.equal(recommendFocusMinutes({ accuracy: 0.7, averageSecondsPerQuestion: 60 }).recommendedMinutes, 40)
  assert.equal(recommendFocusMinutes({ accuracy: 0.4, averageSecondsPerQuestion: 60 }).recommendedMinutes, 45)
  assert.equal(recommendFocusMinutes({ accuracy: 0.9, averageSecondsPerQuestion: 120 }).recommendedMinutes, 40)
  assert.equal(recommendFocusMinutes({ accuracy: 0.9, wrongChapterCount: 3 }).recommendedMinutes, 45)
})

test('周测窗口从本周一开始，只识别本周记录', () => {
  const now = new Date(2026, 10, 7, 15, 0, 0).getTime() // 2026-11-07 周六
  const start = getWeeklyWindowStart(now)
  assert.equal(new Date(start).getDay(), 1)
  const old = { mode: 'weekly', submittedAt: start - 86400000 }
  const current = { mode: 'weekly', submittedAt: start + 3600000 }
  assert.equal(findWeeklyQuizResult([old, current], now)?.submittedAt, start + 3600000)
  assert.equal(findWeeklyQuizResult([old], now), null)
  assert.equal(findWeeklyQuizResult([{ mode: 'daily', submittedAt: now }], now), null)
})
