// AppShell 通知中心的纯计算：今日待办计划、待巩固错题、长期未重做错题，方便直接单测。
import { correctStreak } from './mistakes.js'

const DAY_MS = 86400000
// 超过 7 天没有重做的错题提醒复习，避免「记过一次就忘」。
export const STALE_MISTAKE_DAYS = 7

// 通知优先级：数字越小越靠前，今日计划最紧急，周报一周内处理即可。
export const NOTICE_PRIORITY = {
  plan: 10,
  staleMistake: 20,
  streak: 30,
  weekly: 40
}

function dayRange(now) {
  const start = new Date(now)
  start.setHours(0, 0, 0, 0)
  return { start: start.getTime(), end: start.getTime() + DAY_MS }
}

// 今天到期或已经过期的计划任务（不含桥接任务），按提醒时间从早到晚排。
function duePlans(plans = [], now = Date.now()) {
  const { end } = dayRange(now)
  return plans
    .filter(plan => {
      if (plan?.status === 'archived' || plan?.isBridge) return false
      const due = Number(plan?.reviewTime || plan?.createdAt) || 0
      return due < end
    })
    .sort((left, right) => (Number(left.reviewTime || left.createdAt) || 0) - (Number(right.reviewTime || right.createdAt) || 0))
}

// 首页今日行动卡要展示「还有 N 条」，直接复用通知的同一套口径，避免两个地方算法不一致。
export function todayDuePlans(plans = [], now = Date.now()) {
  return duePlans(plans, now)
}

// 今日计划数量用于通知标题与文案。
export function duePlanCount(plans = [], now = Date.now()) {
  return duePlans(plans, now).length
}

// 最靠前的一条待办：通知里只点名这一条，避免一次甩一串任务。
export function nextDuePlan(plans = [], now = Date.now()) {
  return duePlans(plans, now)[0] || null
}

// 今天是否已经完成过专注：完成过就不再催「今日计划」。
export function startedFocusToday(sessions = [], now = Date.now()) {
  const { start, end } = dayRange(now)
  return sessions.some(item => {
    const timestamp = Number(item?.createdAt) || 0
    return timestamp >= start && timestamp < end && Boolean(item?.completed)
  })
}

// 连续答对 1 次、再对一次就能消灭的错题数量。
export function streakOneMistakeCount(mistakes = []) {
  return mistakes.filter(item => !item?.fixedAt && correctStreak(item?.redoHistory) === 1).length
}

// 超过 STALE_MISTAKE_DAYS 天未重做（且从未开始重做）的错题。
// 已经连续答对 1 次的错题有单独的「待巩固」提醒，这里排除，避免同一道题被催两次。
export function isStaleMistake(item, now = Date.now(), days = STALE_MISTAKE_DAYS) {
  if (!item || item.fixedAt || correctStreak(item.redoHistory) >= 1) return false
  const history = Array.isArray(item.redoHistory) ? item.redoHistory : []
  const lastRedoAt = history.reduce((latest, event) => Math.max(latest, Number(event?.at) || 0), 0)
  const lastTouched = lastRedoAt || Number(item.createdAt) || 0
  return lastTouched > 0 && lastTouched < now - days * DAY_MS
}

export function staleMistakeCount(mistakes = [], now = Date.now(), days = STALE_MISTAKE_DAYS) {
  return mistakes.filter(item => isStaleMistake(item, now, days)).length
}
