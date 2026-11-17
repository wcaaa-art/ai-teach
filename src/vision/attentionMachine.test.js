import test from 'node:test'
import assert from 'node:assert/strict'
import { ATTENTION_STATE, AttentionMachine } from './attentionMachine.js'

const face = (now, extra = {}) => ({ now, faceCount: 1, faceRatio: 0.3, eyeOpen: 1, yaw: 0, pitch: 0, ...extra })

test('离岗要持续 10 秒才进入，人脸回来立即恢复', () => {
  const machine = new AttentionMachine()
  assert.equal(machine.update(face(0)).state, ATTENTION_STATE.FOCUSED)
  assert.equal(machine.update(face(5000, { faceCount: 0, faceRatio: 0 })).state, ATTENTION_STATE.FOCUSED)
  const almost = machine.update(face(14999, { faceCount: 0, faceRatio: 0 }))
  assert.equal(almost.state, ATTENTION_STATE.FOCUSED)
  assert.equal(almost.awaySeconds, 9)

  const away = machine.update(face(15000, { faceCount: 0, faceRatio: 0 }))
  assert.equal(away.state, ATTENTION_STATE.AWAY)
  assert.equal(away.prompt?.type, ATTENTION_STATE.AWAY)

  // 同一次离岗只提醒一次，避免每帧弹窗。
  assert.equal(machine.update(face(20000, { faceCount: 0, faceRatio: 0 })).prompt, null)
  assert.equal(machine.update(face(21000)).state, ATTENTION_STATE.FOCUSED)
})

test('人脸占比低于 8% 按离岗处理', () => {
  const machine = new AttentionMachine()
  machine.update(face(0, { faceRatio: 0.05 }))
  assert.equal(machine.update(face(10000, { faceRatio: 0.05 })).state, ATTENTION_STATE.AWAY)
})

test('多人持续 2 秒才提示，恢复到 1 人后 1 秒退出', () => {
  const machine = new AttentionMachine()
  machine.update(face(0, { faceCount: 2 }))
  assert.equal(machine.update(face(1999, { faceCount: 2 })).state, ATTENTION_STATE.FOCUSED)
  const multiple = machine.update(face(2000, { faceCount: 2 }))
  assert.equal(multiple.state, ATTENTION_STATE.MULTIPLE)
  assert.equal(multiple.prompt?.type, ATTENTION_STATE.MULTIPLE)

  assert.equal(machine.update(face(4000)).state, ATTENTION_STATE.MULTIPLE)
  assert.equal(machine.update(face(4999)).state, ATTENTION_STATE.MULTIPLE)
  assert.equal(machine.update(face(5000)).state, ATTENTION_STATE.FOCUSED)
})

test('闭眼持续 1.5 秒进入犯困，睁眼 1 秒后退出', () => {
  const machine = new AttentionMachine()
  machine.update(face(0, { eyeOpen: 0.2 }))
  assert.equal(machine.update(face(1499, { eyeOpen: 0.2 })).state, ATTENTION_STATE.FOCUSED)
  const drowsy = machine.update(face(1500, { eyeOpen: 0.2 }))
  assert.equal(drowsy.state, ATTENTION_STATE.DROWSY)
  assert.equal(drowsy.prompt?.type, ATTENTION_STATE.DROWSY)

  machine.update(face(3000, { eyeOpen: 1 }))
  assert.equal(machine.update(face(3999, { eyeOpen: 1 })).state, ATTENTION_STATE.DROWSY)
  assert.equal(machine.update(face(4000, { eyeOpen: 1 })).state, ATTENTION_STATE.FOCUSED)
})

test('扭头 2 秒进入分心，但 60 秒内累计 10 秒才提示', () => {
  const machine = new AttentionMachine()
  let result
  for (let now = 0; now <= 2000; now += 500) result = machine.update(face(now, { yaw: 30 }))
  assert.equal(result.state, ATTENTION_STATE.LOOKING_AWAY)
  assert.equal(result.prompt, null)
  assert.ok(result.gazeCumulativeMs < 10000)

  for (let now = 2500; now <= 9500; now += 500) result = machine.update(face(now, { yaw: 30 }))
  assert.equal(result.prompt, null)
  result = machine.update(face(10000, { yaw: 30 }))
  assert.equal(result.prompt?.type, ATTENTION_STATE.LOOKING_AWAY)
})

test('低头持续 5 秒只给坐直提示，不判定玩手机', () => {
  const machine = new AttentionMachine()
  machine.update(face(0, { pitch: 30 }))
  assert.equal(machine.update(face(4999, { pitch: 30 })).state, ATTENTION_STATE.FOCUSED)
  const headDown = machine.update(face(5000, { pitch: 30 }))
  assert.equal(headDown.state, ATTENTION_STATE.HEAD_DOWN)
  assert.match(headDown.prompt?.message || '', /坐直/)
})

test('优先级为多人高于犯困，低头不会覆盖分心', () => {
  const machine = new AttentionMachine()
  machine.update(face(0, { faceCount: 2, eyeOpen: 0.2 }))
  assert.equal(machine.update(face(1500, { faceCount: 2, eyeOpen: 0.2 })).state, ATTENTION_STATE.DROWSY)
  assert.equal(machine.update(face(2000, { faceCount: 2, eyeOpen: 0.2 })).state, ATTENTION_STATE.MULTIPLE)

  const second = new AttentionMachine()
  second.update(face(0, { yaw: 30, pitch: 30 }))
  second.update(face(2000, { yaw: 30, pitch: 30 }))
  assert.equal(second.update(face(5000, { yaw: 30, pitch: 30 })).state, ATTENTION_STATE.LOOKING_AWAY)
})

test('同类提示有 60 秒冷却', () => {
  const machine = new AttentionMachine()
  machine.update(face(0, { pitch: 30 }))
  assert.ok(machine.update(face(5000, { pitch: 30 })).prompt)
  assert.equal(machine.update(face(64000, { pitch: 30 })).prompt, null)
  assert.ok(machine.update(face(65000, { pitch: 30 })).prompt)
})

test('reset 清空所有计时，重新开始从专注状态起步', () => {
  const machine = new AttentionMachine()
  machine.update(face(0))
  machine.update(face(5000, { faceCount: 0, faceRatio: 0 }))
  machine.update(face(15000, { faceCount: 0, faceRatio: 0 }))
  assert.equal(machine.state, ATTENTION_STATE.AWAY)
  machine.reset(0)
  assert.equal(machine.state, ATTENTION_STATE.FOCUSED)
  assert.equal(machine.update(face(0)).awaySeconds, 0)
})
