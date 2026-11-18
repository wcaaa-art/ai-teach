// 走神实时干预的判定逻辑：把视觉状态机的「瞬时状态」翻译成「持续多久才该打断」。
//
// 为什么不在检测到低头/分心的瞬间就暂停：写题时低头是常态、读资料时视线移动也很常见，
// 一次误判就中断专注，比不干预更伤。所以这里按状态分级设阈值，并且分三步走：
//   1. none      —— 刚出现不久，先让原有��和提示弹窗处理，不打扰
//   2. warn      —— 快到阈值了，页面显示倒计时，让学生自己回来
//   3. intervene —— 仍未回到专注，才暂停计时并弹窗说明
//
// 干预后同一轮异常不再重复触发，等状态恢复才允许下一次，避免连续弹窗。
// 纯函数实现，不依赖 DOM 与计时器，便于单测。

// 需要计入干预判定的状态及其阈值（秒）。阈值按「误判代价」定：
// 低头写题是常态，阈值最宽；犯困是最明确的问题，阈值最紧。
export const DISTRACTED_STATES = {
  'looking-away': { label: '分心', threshold: 30, hint: '视线离开屏幕太久了' },
  'head-down': { label: '低头', threshold: 60, hint: '低头时间有点长了' },
  'drowsy': { label: '犯困', threshold: 20, hint: '看起来有点困了' }
}

// 进入阈值前多少秒开始倒计时提示。
export const WARN_SECONDS = 8

export const INTERVENTION_LEVEL = { NONE: 'none', WARN: 'warn', INTERVENE: 'intervene' }

/**
 * 创建干预跟踪器。
 * @param {{ thresholds?: Record<string, number>, warnSeconds?: number }} [options]
 */
export function createInterventionTracker(options = {}) {
  const warnSeconds = Number.isFinite(options.warnSeconds) ? options.warnSeconds : WARN_SECONDS
  const thresholds = { ...Object.fromEntries(Object.entries(DISTRACTED_STATES).map(([key, value]) => [key, value.threshold])), ...(options.thresholds || {}) }

  let currentState = ''
  let since = 0
  let intervened = false

  function reset() {
    currentState = ''
    since = 0
    intervened = false
  }

  /**
   * 用最新的视觉状态推进判定。
   * @param {string} state 视觉状态机的状态名
   * @param {number} [now] 当前时间戳（便于单测）
   */
  function update(state, now = Date.now()) {
    const key = String(state || '')
    if (!DISTRACTED_STATES[key]) {
      // 回到专注（或转入离岗/多人）时清空本轮累积，下一次异常才重新计时。
      if (currentState) reset()
      return { level: INTERVENTION_LEVEL.NONE, state: '', elapsed: 0, remaining: 0 }
    }
    if (key !== currentState) {
      currentState = key
      since = now
      intervened = false
    }
    const threshold = thresholds[key] ?? DISTRACTED_STATES[key].threshold
    const elapsed = Math.max(0, (now - since) / 1000)
    if (intervened) {
      return { level: INTERVENTION_LEVEL.NONE, state: key, elapsed, remaining: 0 }
    }
    if (elapsed >= threshold) {
      intervened = true
      const meta = DISTRACTED_STATES[key]
      return { level: INTERVENTION_LEVEL.INTERVENE, state: key, label: meta.label, hint: meta.hint, elapsed, remaining: 0, threshold }
    }
    if (elapsed >= threshold - warnSeconds) {
      return { level: INTERVENTION_LEVEL.WARN, state: key, label: DISTRACTED_STATES[key].label, elapsed, remaining: Math.ceil(threshold - elapsed), threshold }
    }
    return { level: INTERVENTION_LEVEL.NONE, state: key, elapsed, remaining: 0, threshold }
  }

  return { update, reset, get state() { return currentState }, get intervened() { return intervened } }
}

/**
 * 注意力分段类型。看板上的「专注 / 走神 / 离开」只认这四种口径，
 * 具体是低头、分心还是犯困要记在视觉明细里，不能混进分段统计。
 */
export const ATTENTION_SEGMENT_TYPES = { focus: 'focus', distracted: 'distracted', away: 'away', unknown: 'unknown' }

/**
 * 把视觉状态机的状态名映射成看板用的分段类型。
 * @param {string} state
 * @returns {'focus' | 'distracted' | 'away' | 'unknown'}
 */
export function attentionSegmentType(state) {
  const key = String(state || '')
  if (key === 'away') return ATTENTION_SEGMENT_TYPES.away
  if (key === 'focused') return ATTENTION_SEGMENT_TYPES.focus
  if (DISTRACTED_STATES[key] || key === 'multiple') return ATTENTION_SEGMENT_TYPES.distracted
  return ATTENTION_SEGMENT_TYPES.unknown
}

/**
 * 给「分心/低头」类干预用的提示文案。与离岗区分开：离岗是「没在屏幕前」，
 * 分心是「人在但注意力飘了」，话术不一样，学生才知道该做什么。
 * @param {{ state: string, label?: string, hint?: string, remaining?: number }} info
 */
export function interventionMessage(info = {}) {
  const label = info.label || DISTRACTED_STATES[info.state]?.label || '走神'
  const hint = info.hint || DISTRACTED_STATES[info.state]?.hint || '注意力有点飘'
  if (info.remaining > 0) return `${label}中 · ${info.remaining} 秒后自动暂停计时，先把注意力拉回来`
  return `检测到${label}（${hint}），计时已暂停，回来后点继续，我们接着做`
}
