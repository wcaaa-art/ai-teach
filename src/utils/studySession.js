// @ts-check
// 学习会话：从学习计划进入做题/背诵/错题时自动开始计时，离开学习窗口时记录专注时长。
// 只存最小字段（startedAt + 任务信息），已学时长按 startedAt 实时推算，避免每秒写 localStorage。
const KEY = 'ai-teach-study-session'

function emitChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ai-teach:study-updated'))
}

/** 开始一段学习会话（点学习计划开始学习时调用）。 */
export function startStudy(plan, storage = globalThis.localStorage) {
  const session = {
    planId: plan?.id || null,
    taskName: (plan?.name || '学习').trim(),
    subject: (plan?.subject || '').trim(),
    mode: 'plan',
    startedAt: Date.now()
  }
  try { storage.setItem(KEY, JSON.stringify(session)) } catch (error) { console.warn('学习会话写入失败。', error) }
  emitChange()
  return session
}

export function readStudy(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || !Number.isFinite(Number(data.startedAt))) return null
    return data
  } catch { return null }
}

export function clearStudy(storage = globalThis.localStorage) {
  try { storage.removeItem(KEY); emitChange() } catch { /* 忽略 */ }
}

/** 已学秒数。 */
export function studyElapsedSeconds(session, now = Date.now()) {
  if (!session) return 0
  return Math.max(0, Math.floor((now - Number(session.startedAt || now)) / 1000))
}

/**
 * 结束会话，返回可直接写入 focusSessions 的记录（并清除会话）。
 * 没有画面/走神数据时，专注时长 = 实际时长，sampled=false。
 */
export function finishStudy(now = Date.now()) {
  const session = readStudy()
  if (!session) return null
  const startedAt = Number(session.startedAt)
  const actualSeconds = Math.round((now - startedAt) / 1000)
  // 太短（不足 30 秒）不算一次有效学习，清除但不记录，避免点错即退产生的噪音。
  if (actualSeconds < 30) {
    clearStudy()
    return null
  }
  clearStudy()
  return {
    id: `focus_${startedAt}_${Math.random().toString(36).slice(2, 8)}`,
    planId: session.planId,
    taskName: session.taskName || '学习',
    subject: session.subject || '',
    mode: session.mode || 'plan',
    startedAt,
    endedAt: now,
    actualSeconds,
    completed: true,
    focusSeconds: actualSeconds,
    distractedSeconds: 0,
    awaySeconds: 0,
    sampled: false,
    timeline: [{ type: 'focus', seconds: actualSeconds }],
    createdAt: now
  }
}
