// 把周报「下周行动」转成计划任务：同一周使用固定 id，重复点击只更新、不重复创建。
const DAY_MS = 86400000

// 自然周 key（周一日期）：看板周报缓存与计划页过期判断共用同一口径。
export function weekKeyOf(now = Date.now()) {
  const monday = new Date(now)
  monday.setHours(0, 0, 0, 0)
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7))
  return `${monday.getFullYear()}-${monday.getMonth() + 1}-${monday.getDate()}`
}

// 上周及更早生成、仍未完成的周报任务，周一一到就算过期，供计划页一键清理。
export function staleWeeklyTasks(plans = [], now = Date.now()) {
  const current = weekKeyOf(now)
  return plans.filter(plan => {
    if (plan?.source !== 'weekly-report' || plan.status === 'archived') return false
    const match = String(plan.id || '').match(/^weekly-(.+)-(\d+)$/)
    return Boolean(match) && match[1] !== current
  })
}

// 周报任务最多顺延 2 次，再往后建议拆小或放弃，避免同一批任务无限滚动。
export const MAX_CARRY_WEEKS = 2

export function carriedWeeksOf(task = {}) {
  return Math.max(0, Math.floor(Number(task.carriedWeeks) || 0))
}

// 把过期周报任务顺延到当前自然周：重写 id 防止下周再次被判过期，并避开本周已有 id。
// 达到顺延上限的任务原样留在过期列表，由调用方提示拆小或清空。
export function shiftWeeklyTasks(stale = [], existing = [], now = Date.now()) {
  const current = weekKeyOf(now)
  const used = new Set(existing.map(item => item.id))
  let index = 0
  const shifted = []
  for (const task of stale) {
    const carried = carriedWeeksOf(task)
    if (carried >= MAX_CARRY_WEEKS) continue
    let id = ''
    do {
      index += 1
      id = `weekly-${current}-${index}`
    } while (used.has(id))
    used.add(id)
    shifted.push({ ...task, id, carriedWeeks: carried + 1, reviewTime: nextMondayAt(now), createdAt: now })
  }
  return shifted
}

// 周一第一次打开看板、且本周还没有周报时给轻提示；用户关掉后按周记住。
export function shouldPromptWeeklyReport({ now = Date.now(), hasReport = false, dismissed = false } = {}) {
  return new Date(now).getDay() === 1 && !hasReport && !dismissed
}

// 下周一 20:00，作为周报复盘任务的计划时间。
export function nextMondayAt(now = Date.now()) {
  const date = new Date(now)
  date.setHours(20, 0, 0, 0)
  const offset = (8 - date.getDay()) % 7 || 7
  return date.getTime() + offset * DAY_MS
}

export function buildWeeklyPlanTasks({ report, subject = '', weekKey = '', sequenceStart = 1, now = Date.now(), limit = 3 } = {}) {
  const actions = Array.isArray(report?.actions)
    ? report.actions.filter(item => typeof item === 'string' && item.trim()).slice(0, Math.max(1, limit))
    : []
  const reviewTime = nextMondayAt(now)
  return actions.map((action, index) => ({
    id: `weekly-${weekKey}-${index + 1}`,
    name: action.trim().slice(0, 30),
    subject: subject || '综合',
    stage: 'review',
    estimatedMinutes: 25,
    priority: index === 0 ? '高' : '中',
    reviewTime,
    knowledgeTags: ['周报行动'],
    sequenceOrder: sequenceStart + index,
    reason: '来自本周 AI 周报的行动建议',
    source: 'weekly-report',
    status: 'active',
    createdAt: now + index
  }))
}
