import test from 'node:test'
import assert from 'node:assert/strict'
import { OneEuroFilter, resetAll } from './oneEuro.js'

test('OneEuroFilter 首帧直接返回输入值', () => {
  const filter = new OneEuroFilter()
  assert.equal(filter.filter(10, 1 / 30), 10)
})

test('OneEuroFilter 对恒定输入保持稳定，不产生漂移', () => {
  const filter = new OneEuroFilter()
  let value = filter.filter(5, 1 / 30)
  for (let index = 0; index < 120; index += 1) value = filter.filter(5, 1 / 30)
  assert.ok(Math.abs(value - 5) < 1e-9)
})

test('OneEuroFilter 跟随阶跃输入且不越过目标值', () => {
  const filter = new OneEuroFilter({ minCutoff: 2, beta: 0.01 })
  filter.filter(0, 1 / 30)
  let value = 0
  for (let index = 0; index < 60; index += 1) {
    value = filter.filter(10, 1 / 30)
    assert.ok(value <= 10 + 1e-9)
  }
  assert.ok(value > 9)
})

test('OneEuroFilter 对非法 dt 与非法输入有兜底', () => {
  const filter = new OneEuroFilter()
  filter.filter(1, 1 / 30)
  const value = filter.filter(2, 0)
  assert.ok(Number.isFinite(value))
  assert.equal(filter.filter(Number.NaN, 1 / 30), value)
})

test('resetAll 把一组滤波器恢复到首帧状态', () => {
  const yaw = new OneEuroFilter()
  const pitch = new OneEuroFilter()
  yaw.filter(30, 1 / 30)
  pitch.filter(-10, 1 / 30)
  resetAll([yaw, pitch, null])
  assert.equal(yaw.filter(0, 1 / 30), 0)
  assert.equal(pitch.filter(0, 1 / 30), 0)
})
