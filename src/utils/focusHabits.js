// 专注习惯的纯聚合函数：不依赖 Vue 与 IndexedDB，方便直接单测。
function startOfDay(timestamp) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

function dayKey(timestamp) {
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

// 按开始小时聚合专注分钟，用于找出个人高效时段。
export function hourBuckets(sessions, now = Date.now(), days = 30) {
  const start = startOfDay(now) - (days - 1) * 86400000
  const buckets = Array.from({ length: 24 }, () => 0)
  for (const session of sessions) {
    const timestamp = Number(session.startedAt || session.createdAt) || 0
    if (timestamp < start) continue
    buckets[new Date(timestamp).getHours()] += Number(session.actualSeconds) || 0
  }
  return buckets.map(seconds => Math.round(seconds / 60))
}

// 连续学习天数：今天还没有记录时从昨天开始数，避免白天打开看板就断签。
export function focusStreak(sessions, now = Date.now()) {
  const days = new Set(sessions.map(session => dayKey(Number(session.createdAt || session.endedAt || session.startedAt) || 0)))
  let cursor = startOfDay(now)
  if (!days.has(dayKey(cursor))) cursor -= 86400000
  let streak = 0
  while (days.has(dayKey(cursor))) {
    streak += 1
    cursor -= 86400000
  }
  return streak
}

// 本周（含今天）对比上周；演示离岗不计入真实分心。
export function weekComparison(sessions, distractions, now = Date.now()) {
  const thisStart = startOfDay(now) - 6 * 86400000
  const lastStart = thisStart - 7 * 86400000
  const realDistractions = distractions.filter(item => item.type !== 'demo-away')
  const thisSessions = sessions.filter(item => (Number(item.createdAt) || 0) >= thisStart)
  const lastSessions = sessions.filter(item => {
    const timestamp = Number(item.createdAt) || 0
    return timestamp >= lastStart && timestamp < thisStart
  })
  const minutesOf = list => Math.round(list.reduce((sum, item) => sum + (Number(item.actualSeconds) || 0), 0) / 60)
  const thisMinutes = minutesOf(thisSessions)
  const lastMinutes = minutesOf(lastSessions)
  const thisDistractions = realDistractions.filter(item => (Number(item.createdAt) || 0) >= thisStart).length
  const lastDistractions = realDistractions.filter(item => {
    const timestamp = Number(item.createdAt) || 0
    return timestamp >= lastStart && timestamp < thisStart
  }).length
  return {
    thisMinutes,
    lastMinutes,
    minutesDeltaPercent: lastMinutes ? Math.round((thisMinutes - lastMinutes) / lastMinutes * 100) : null,
    thisDistractions,
    lastDistractions,
    distractionDelta: thisDistractions - lastDistractions,
    thisSessions: thisSessions.length,
    lastSessions: lastSessions.length
  }
}

// 分心与视觉提醒合并统计；演示数据、误判和重复的离岗记录不参与。
export function distractionBreakdown(distractions, visualLogs) {
  const realLogs = visualLogs.filter(item => item.source !== 'demo' && item.status !== 'false-positive')
  const categories = [
    { key: 'tab-hidden', label: '页面切走' },
    { key: 'visual-away', label: '视觉离岗' },
    { key: 'drowsy', label: '犯困' },
    { key: 'distracted', label: '扭头分心' },
    { key: 'multiple', label: '多人入镜' },
    { key: 'head-down', label: '低头' }
  ]
  return categories
    .map(category => ({
      ...category,
      count: category.key === 'tab-hidden' || category.key === 'visual-away'
        ? distractions.filter(item => item.type === category.key).length
        : realLogs.filter(item => item.status === category.key).length
    }))
    .sort((left, right) => right.count - left.count)
}

// 找连续两小时里专注分钟最高的窗口，作为高效时段建议；周报也复用它。
export function peakWindow(hours) {
  let start = 0
  let best = -1
  for (let hour = 0; hour < 23; hour += 1) {
    const minutes = hours[hour] + hours[hour + 1]
    if (minutes > best) {
      best = minutes
      start = hour
    }
  }
  return { start, end: start + 2, minutes: best }
}

const distractionTips = {
  '页面切走': '开始专注前先关掉无关标签页和消息提醒',
  '视觉离岗': '把水杯和资料提前备好，减少中途离开',
  '犯困': '把最难的任务安排在精神最好的时段，必要时先休息 10 分钟',
  '扭头分心': '把手机放到视线外，桌面只留当前任务',
  '多人入镜': '尽量在安静、独立的空间专注',
  '低头': '把屏幕垫高到视线平齐，减少低头和趴桌'
}

// 习惯建议最多三条：高效时段 → 主要分心来源 → 周趋势或连续天数。
export function habitAdvice({ sessions, distractions, visualLogs, hours, streak, week }) {
  if (!sessions.length) return ['还没有专注记录，先完成一次 25 分钟专注，习惯数据会从第一次开始积累']
  const list = []
  const peak = peakWindow(hours)
  if (peak.minutes >= 20) {
    list.push(`你在 ${peak.start}:00–${peak.end}:00 的专注时长最高，把最重要的任务放在这个时段`)
  }
  const topDistraction = distractionBreakdown(distractions, visualLogs).find(item => item.count > 0)
  if (topDistraction && topDistraction.count >= 2) {
    list.push(`分心主要来自「${topDistraction.label}」（${topDistraction.count} 次），${distractionTips[topDistraction.label] || '先减少这类干扰再延长专注'}`)
  }
  if (week?.minutesDeltaPercent !== null && week?.minutesDeltaPercent <= -20) {
    list.push(`本周专注比上周少 ${Math.abs(week.minutesDeltaPercent)}%，今天先补一个 25 分钟的小任务`)
  } else if (week?.minutesDeltaPercent !== null && week?.minutesDeltaPercent >= 30) {
    list.push(`本周专注比上周多 ${week.minutesDeltaPercent}%，节奏在变好，注意别透支`)
  } else if (streak >= 3) {
    list.push(`已经连续 ${streak} 天有专注记录，保持每天至少一次短专注`)
  }
  if (!list.length) list.push('专注节奏比较平稳，继续保持每天固定时段学习')
  return list.slice(0, 3)
}
