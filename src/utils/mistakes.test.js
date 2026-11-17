import assert from 'node:assert/strict'
import test from 'node:test'
import { AUTO_FIX_STREAK, correctStreak } from './mistakes.js'

test('连续答对从 redoHistory 末尾往前数，答错即中断', () => {
  assert.equal(correctStreak([]), 0)
  assert.equal(correctStreak(undefined), 0)
  assert.equal(correctStreak([{ correct: true }]), 1)
  assert.equal(correctStreak([{ correct: false }, { correct: true }, { correct: true }]), 2)
  assert.equal(correctStreak([{ correct: true }, { correct: false }]), 0)
  assert.equal(correctStreak([{ correct: true }, { correct: true }, { correct: false }, { correct: true }]), 1)
})

test('自动消灭阈值固定为连续两次答对', () => {
  assert.equal(AUTO_FIX_STREAK, 2)
  assert.ok(correctStreak([{ correct: true }, { correct: true }]) >= AUTO_FIX_STREAK)
  assert.ok(correctStreak([{ correct: true }]) < AUTO_FIX_STREAK)
})
