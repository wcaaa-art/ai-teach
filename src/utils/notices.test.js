import assert from 'node:assert/strict'
import test from 'node:test'
import { duePlanCount, nextDuePlan, startedFocusToday, staleMistakeCount, streakOneMistakeCount } from './notices.js'

const now = new Date(2026, 10, 13, 15, 0, 0).getTime()
const day = 86400000

test('今日计划只数未归档、非桥接且今天到期或已过期的任务', () => {
  const plans = [
    { id: 'a', status: 'active', reviewTime: now - day },
    { id: 'b', status: 'active', reviewTime: now },
    { id: 'c', status: 'archived', reviewTime: now },
    { id: 'd', status: 'active', isBridge: true, reviewTime: now },
    { id: 'e', status: 'active', reviewTime: now + 2 * day },
    { id: 'f', status: 'active', createdAt: now }
  ]
  assert.equal(duePlanCount(plans, now), 3)
})

test('今日计划只点名最靠前的一条，提醒时间早的优先、没有提醒时间按创建时间', () => {
  const plans = [
    { id: 'late', status: 'active', reviewTime: now - 1000 },
    { id: 'early', status: 'active', reviewTime: now - 2 * day },
    { id: 'created', status: 'active', createdAt: now - 3 * day },
    { id: 'archived', status: 'archived', reviewTime: now - 9 * day },
    { id: 'future', status: 'active', reviewTime: now + day }
  ]
  assert.equal(nextDuePlan(plans, now)?.id, 'created')
  assert.equal(nextDuePlan([], now), null)
})

test('今天完成过专注就不再提醒今日计划', () => {
  const sessions = [
    { createdAt: now, completed: true },
    { createdAt: now - day, completed: true },
    { createdAt: now, completed: false }
  ]
  assert.equal(startedFocusToday(sessions, now), true)
  assert.equal(startedFocusToday([{ createdAt: now - day, completed: true }], now), false)
  assert.equal(startedFocusToday([], now), false)
})

test('只统计连续答对 1 次且未消灭的错题', () => {
  const mistakes = [
    { id: 'one', redoHistory: [{ correct: true }] },
    { id: 'zero', redoHistory: [{ correct: false }] },
    { id: 'two', redoHistory: [{ correct: true }, { correct: true }] },
    { id: 'fixed', fixedAt: now, redoHistory: [{ correct: true }] }
  ]
  assert.equal(streakOneMistakeCount(mistakes), 1)
  assert.equal(streakOneMistakeCount([]), 0)
})

test('超过 7 天未重做的错题才提醒复习，已消灭和刚重做过的跳过', () => {
  const mistakes = [
    // 8 天前记录且从未重做：该复习。
    { id: 'never', createdAt: now - 8 * day },
    // 最近一次重做在 9 天前且答错：该复习。
    { id: 'wrong', createdAt: now - 20 * day, redoHistory: [{ at: now - 9 * day, correct: false }] },
    // 3 天前重做过：还没到复习时间。
    { id: 'recent', createdAt: now - 20 * day, redoHistory: [{ at: now - 3 * day, correct: false }] },
    // 6 天前才记录：未满 7 天。
    { id: 'fresh', createdAt: now - 6 * day },
    // 已消灭：不再提醒。
    { id: 'fixed', fixedAt: now - day, createdAt: now - 30 * day },
    // 连续答对 1 次：交给「待巩固」通知，避免重复提醒。
    { id: 'streak', createdAt: now - 30 * day, redoHistory: [{ at: now - 10 * day, correct: true }] }
  ]
  assert.equal(staleMistakeCount(mistakes, now), 2)
  assert.equal(staleMistakeCount([], now), 0)
})
