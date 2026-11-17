// 题库预生成缓存：摸底与章节测试共用。
// 学生选定范围后前端先触发预生成，真正点「开始」时按同样的请求参数命中缓存，秒出题。
// 同一份请求并发时只生成一次，避免反复点按钮把模型打爆。
const TTL = 6 * 60 * 60 * 1000
const MAX_ENTRIES = 80
const cache = new Map()
const inflight = new Map()

// 对象键顺序不同不应产生不同缓存键，否则预生成和正式请求会各生成一遍。
export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(item => stableStringify(item)).join(',')}]`
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`
  }
  return JSON.stringify(value)
}

export function buildPrefetchKey(params = {}) {
  return stableStringify(params)
}

export async function cachedGenerate(key, factory, { now = Date.now() } = {}) {
  const hit = cache.get(key)
  if (hit && now - hit.at < TTL) {
    // 命中后挪到末尾，超限时优先淘汰最久未用的题库。
    cache.delete(key)
    cache.set(key, hit)
    return { ...hit.value, cached: true }
  }
  if (inflight.has(key)) return inflight.get(key)
  const task = factory()
    .then(value => {
      const result = { ...value, cached: false }
      cache.set(key, { at: Date.now(), value: result })
      if (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value)
      return result
    })
    .finally(() => inflight.delete(key))
  inflight.set(key, task)
  return task
}

export function clearPrefetchCache() {
  cache.clear()
  inflight.clear()
}

export function prefetchCacheSize() {
  return cache.size
}
