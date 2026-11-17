import assert from 'node:assert/strict'
import test from 'node:test'
import { clearLiveFocus, formatClock, liveRemaining, readLiveFocus, writeLiveFocus } from './liveFocus.js'

function fakeStorage() {
  const map = new Map()
  return {
    getItem: key => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, String(value)),
    removeItem: key => map.delete(key)
  }
}

test('快照可写入、读取并清除', () => {
  const storage = fakeStorage()
  writeLiveFocus({ title: '数学复盘', baseRemaining: 1200, running: false }, storage)
  assert.equal(readLiveFocus(storage).title, '数学复盘')
  clearLiveFocus(storage)
  assert.equal(readLiveFocus(storage), null)
})

test('损坏数据与非法字段的安全回落', () => {
  const storage = fakeStorage()
  storage.setItem('ai-teach-focus-live', '{bad json')
  assert.equal(readLiveFocus(storage), null)
  storage.setItem('ai-teach-focus-live', JSON.stringify({ title: 'x' }))
  assert.equal(readLiveFocus(storage), null)
})

test('暂停时剩余不变，运行中按时间递减且不出现负数', () => {
  const paused = { running: false, baseRemaining: 300 }
  assert.equal(liveRemaining(paused, 999999), 300)
  const running = { running: true, baseRemaining: 300, startedAt: 1000, updatedAt: 1000 }
  assert.equal(liveRemaining(running, 61000), 240)
  assert.equal(liveRemaining(running, 999999), 0)
})

test('时钟格式补零并夹取非法输入', () => {
  assert.equal(formatClock(1500), '25:00')
  assert.equal(formatClock(65), '01:05')
  assert.equal(formatClock(-3), '00:00')
  assert.equal(formatClock('bad'), '00:00')
})
