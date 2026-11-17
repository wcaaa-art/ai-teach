// @ts-check
// 跨页面的专注快照：专注页离开时写入，AppShell 的手机端常驻计时胶囊读取。
// 只存最小字段，剩余时间按 startedAt 推算，避免每秒钟都写 localStorage。
const KEY = 'ai-teach-focus-live'
const TTL = 6 * 3600 * 1000

export function readLiveFocus(storage = globalThis.localStorage) {
  try {
    const raw = storage.getItem(KEY)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data || !Number.isFinite(Number(data.baseRemaining))) return null
    if (Date.now() - Number(data.updatedAt || 0) > TTL) return null
    return data
  } catch (error) {
    return null
  }
}

function emitChange() {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('ai-teach:focus-live-updated'))
}

export function writeLiveFocus(snapshot, storage = globalThis.localStorage) {
  try {
    storage.setItem(KEY, JSON.stringify({ ...snapshot, updatedAt: Date.now() }))
    emitChange()
  } catch (error) {
    console.warn('专注快照写入失败。', error)
  }
}

export function clearLiveFocus(storage = globalThis.localStorage) {
  try {
    storage.removeItem(KEY)
    emitChange()
  } catch (error) {
    console.warn('专注快照清除失败。', error)
  }
}

// 暂停时返回剩余秒数；运行中按经过时间递减，归零后停在 0。
export function liveRemaining(snapshot, now = Date.now()) {
  if (!snapshot) return 0
  const base = Math.max(0, Math.round(Number(snapshot.baseRemaining) || 0))
  if (!snapshot.running) return base
  const elapsed = Math.max(0, Math.floor((now - Number(snapshot.startedAt || now)) / 1000))
  return Math.max(0, base - elapsed)
}

export function formatClock(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0))
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`
}
