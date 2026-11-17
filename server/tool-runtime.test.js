// 工具护栏的单元测试：重试、熔断、半开恢复与统计。全部用注入的执行器，不依赖真实工具。
import test from 'node:test'
import assert from 'node:assert/strict'
import { getToolRuntimeStats, isCircuitOpen, resetToolRuntime, runToolGuarded } from './tool-runtime.js'

test.beforeEach(() => resetToolRuntime())

test('正常执行只调用一次，并记录耗时', async () => {
  let calls = 0
  const result = await runToolGuarded('demo', () => { calls += 1; return { value: 1 } })
  assert.equal(result.ok, true)
  assert.equal(result.result.value, 1)
  assert.equal(calls, 1)
  assert.equal(result.meta.attempts, 1)
  assert.ok(result.meta.durationMs >= 0)
})

test('失败后重试一次，第二次成功即视为成功', async () => {
  let calls = 0
  const result = await runToolGuarded('flaky', () => {
    calls += 1
    if (calls === 1) throw new Error('boom')
    return { value: 'ok' }
  })
  assert.equal(result.ok, true)
  assert.equal(calls, 2)
  assert.equal(result.meta.attempts, 2)
  assert.equal(getToolRuntimeStats().tools.flaky.consecutiveFailures, 0)
})

test('连续失败达到阈值后熔断，后续调用直接拒绝', async () => {
  const alwaysFail = () => { throw new Error('down') }
  for (let index = 0; index < 3; index += 1) {
    const result = await runToolGuarded('broken', alwaysFail)
    assert.equal(result.ok, false)
  }
  assert.equal(isCircuitOpen('broken'), true)
  let calls = 0
  const blocked = await runToolGuarded('broken', () => { calls += 1; return {} })
  assert.equal(blocked.ok, false)
  assert.equal(blocked.result.error, 'circuit-open')
  assert.equal(calls, 0, '熔断期间不应真的调用工具')
})

test('熔断窗口结束后进入半开，成功一次即恢复', async () => {
  const alwaysFail = () => { throw new Error('down') }
  for (let index = 0; index < 3; index += 1) await runToolGuarded('recover', alwaysFail)
  assert.equal(isCircuitOpen('recover'), true)
  // 把开闸时间往前推，模拟 30 秒已过。
  const stats = getToolRuntimeStats().tools.recover
  assert.equal(stats.circuit, 'open')
  const originalNow = Date.now
  Date.now = () => originalNow() + 31000
  try {
    assert.equal(isCircuitOpen('recover'), false)
    const result = await runToolGuarded('recover', () => ({ value: 'back' }))
    assert.equal(result.ok, true)
    assert.equal(getToolRuntimeStats().tools.recover.circuit, 'closed')
  } finally {
    Date.now = originalNow
  }
})

test('工具卡住会被超时中断并计入失败', async () => {
  const result = await runToolGuarded('slow', () => new Promise(() => {}), {}, {}, { timeoutMs: 30 })
  assert.equal(result.ok, false)
  assert.match(result.meta.error, /timeout/)
  assert.equal(getToolRuntimeStats().tools.slow.failures, 2, '重试一次后共两次失败')
})

test('参数错误这类业务异常也走同一条重试与统计路径', async () => {
  const result = await runToolGuarded('bad-args', () => ({ error: 'invalid_arguments' }))
  assert.equal(result.ok, true, '返回 error 字段不算抛错，交给模型处理')
  assert.deepEqual(result.result, { error: 'invalid_arguments' })
})
