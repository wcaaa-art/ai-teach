// 网络层重试的单元测试：用 stub 替换全局 fetch，不发真实请求、不消耗模型额度。
import test from 'node:test'
import assert from 'node:assert/strict'
import { fetchWithRetry, isRetryableError, resetLlmRequestStats, getLlmRequestStats } from './agent.js'

const realFetch = globalThis.fetch
const noDelay = [0, 0, 0]

function stubFetch(handler) {
  let calls = 0
  globalThis.fetch = async (...args) => {
    calls += 1
    return handler(calls, ...args)
  }
  return () => calls
}

test.afterEach(() => { globalThis.fetch = realFetch; resetLlmRequestStats() })

const okResponse = () => new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } })
const statusResponse = status => new Response('{}', { status, headers: { 'Content-Type': 'application/json' } })

test('429 后重试成功，并记录一次重试', async () => {
  const calls = stubFetch(count => (count < 3 ? statusResponse(429) : okResponse()))
  const response = await fetchWithRetry('https://example.test/chat', undefined, { retries: 2, makeInit: () => ({}), delays: noDelay })
  assert.equal(response.status, 200)
  assert.equal(calls(), 3)
  assert.equal(getLlmRequestStats().retries, 2)
})

test('4xx 不重试，直接带状态码抛出', async () => {
  const calls = stubFetch(() => statusResponse(401))
  await assert.rejects(
    () => fetchWithRetry('https://example.test/chat', undefined, { retries: 2, makeInit: () => ({}), delays: noDelay }),
    error => error.status === 401
  )
  assert.equal(calls(), 1)
  assert.equal(getLlmRequestStats().failures, 1)
})

test('网络错误（TypeError）会重试，重试次数用尽后抛出', async () => {
  const calls = stubFetch(() => { throw new TypeError('fetch failed') })
  await assert.rejects(
    () => fetchWithRetry('https://example.test/chat', undefined, { retries: 2, makeInit: () => ({}), delays: noDelay }),
    /fetch failed/
  )
  assert.equal(calls(), 3)
})

test('超时不重试，避免前端多等一个超时周期', async () => {
  const timeoutError = new Error('The operation was aborted due to timeout')
  timeoutError.name = 'TimeoutError'
  const calls = stubFetch(() => { throw timeoutError })
  await assert.rejects(
    () => fetchWithRetry('https://example.test/chat', undefined, { retries: 2, makeInit: () => ({}), delays: noDelay }),
    /timeout/
  )
  assert.equal(calls(), 1)
})

test('外部中断后不再重试', async () => {
  const controller = new AbortController()
  controller.abort()
  const calls = stubFetch(() => { throw new TypeError('fetch failed') })
  await assert.rejects(
    () => fetchWithRetry('https://example.test/chat', undefined, { retries: 2, signal: controller.signal, makeInit: () => ({}), delays: noDelay })
  )
  assert.equal(calls(), 1)
})

test('可重试状态码的判定口径', () => {
  assert.equal(isRetryableError({ status: 429 }), true)
  assert.equal(isRetryableError({ status: 503 }), true)
  assert.equal(isRetryableError({ status: 400 }), false)
  assert.equal(isRetryableError({ name: 'TimeoutError' }), false)
  assert.equal(isRetryableError({ code: 'ECONNRESET' }), true)
  assert.equal(isRetryableError({ code: 'ERR_INVALID_ARG_TYPE' }), false)
})
