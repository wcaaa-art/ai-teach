import test from 'node:test'
import assert from 'node:assert/strict'
import { buildPrefetchKey, cachedGenerate, clearPrefetchCache, prefetchCacheSize, stableStringify } from './prefetch-cache.js'

test('缓存键与对象字段顺序无关', () => {
  assert.equal(stableStringify({ a: 1, b: [2, 3] }), stableStringify({ b: [2, 3], a: 1 }))
  assert.equal(buildPrefetchKey({ kind: 'assessment', grade: '初二', chapters: ['a', 'b'] }),
    buildPrefetchKey({ chapters: ['a', 'b'], grade: '初二', kind: 'assessment' }))
  assert.notEqual(buildPrefetchKey({ grade: '初二' }), buildPrefetchKey({ grade: '初三' }))
})

test('同一请求并发时只生成一次', async () => {
  clearPrefetchCache()
  let calls = 0
  const factory = async () => {
    calls += 1
    await new Promise(resolve => setTimeout(resolve, 10))
    return { data: { questions: [1, 2, 3] }, source: 'test' }
  }
  const [first, second] = await Promise.all([
    cachedGenerate('same-key', factory),
    cachedGenerate('same-key', factory)
  ])
  assert.equal(calls, 1)
  assert.deepEqual(first.data, second.data)
  assert.equal(prefetchCacheSize(), 1)
})

test('命中缓存不重复生成，过期后重新生成', async () => {
  clearPrefetchCache()
  let calls = 0
  const factory = async () => ({ data: { count: ++calls }, source: 'test' })
  const first = await cachedGenerate('key', factory)
  const second = await cachedGenerate('key', factory)
  assert.equal(calls, 1)
  assert.equal(first.cached, false)
  assert.equal(second.cached, true)
})

test('不同键互不影响', async () => {
  clearPrefetchCache()
  let calls = 0
  const factory = async () => ({ data: { count: ++calls }, source: 'test' })
  await cachedGenerate('a', factory)
  await cachedGenerate('b', factory)
  assert.equal(calls, 2)
  assert.equal(prefetchCacheSize(), 2)
})
