// 工具运行时的护栏：超时、单次重试、连续失败熔断。
//
// 现有 4 个工具都是本地纯函数，几乎不会失败；但 Agent 的工具位以后可能接网络检索、
// 文件解析甚至外部 MCP 服务，那时"一个工具卡死拖垮整轮对话"就是真实风险。
// 这里把护栏放在执行层，业务工具本身不用关心重试与熔断。

const DEFAULT_TIMEOUT_MS = 3000
const FAILURE_THRESHOLD = 3
const OPEN_MS = 30000
const RETRY_TIMES = 1

/** @type {Map<string, {consecutiveFailures:number, openedAt:number, calls:number, failures:number, lastError:string, lastMs:number}>} */
const registry = new Map()

function entryOf(name) {
  if (!registry.has(name)) {
    registry.set(name, { consecutiveFailures: 0, openedAt: 0, calls: 0, failures: 0, lastError: '', lastMs: 0 })
  }
  return registry.get(name)
}

export function isCircuitOpen(name, now = Date.now()) {
  const entry = entryOf(name)
  if (!entry.openedAt) return false
  if (now - entry.openedAt >= OPEN_MS) {
    // 半开：放行一次试探，失败会重新计时。
    entry.openedAt = 0
    entry.consecutiveFailures = 0
    return false
  }
  return true
}

export function getToolRuntimeStats() {
  const tools = {}
  for (const [name, entry] of registry) {
    tools[name] = {
      calls: entry.calls,
      failures: entry.failures,
      consecutiveFailures: entry.consecutiveFailures,
      circuit: entry.openedAt ? 'open' : 'closed',
      lastError: entry.lastError,
      lastMs: entry.lastMs
    }
  }
  return { timeoutMs: DEFAULT_TIMEOUT_MS, retryTimes: RETRY_TIMES, failureThreshold: FAILURE_THRESHOLD, openMs: OPEN_MS, tools }
}

export function resetToolRuntime() { registry.clear() }

/**
 * 给任意同步/异步调用套一个超时，供 MCP 侧直接复用。
 * @template T
 * @param {() => T|Promise<T>} fn
 * @param {number} ms
 * @param {string} [label]
 * @returns {Promise<T>}
 */
export async function withToolTimeout(fn, ms = DEFAULT_TIMEOUT_MS, label = 'tool') {
  return withTimeout(Promise.resolve().then(fn), ms, label)
}

function withTimeout(promise, ms, name) {
  let timer
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`tool timeout: ${name}`)), ms)
  })
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer))
}

/**
 * 执行一个工具，带超时、重试与熔断。
 * @param {string} name
 * @param {(name:string, args:any, context:any) => any} execute 实际执行器（注入便于测试）
 * @param {any} args
 * @param {any} context
 * @param {{ timeoutMs?: number }} [options]
 * @returns {Promise<{ ok: boolean, result: any, meta: { attempts: number, durationMs: number, error: string } }>}
 */
export async function runToolGuarded(name, execute, args = {}, context = {}, { timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const entry = entryOf(name)
  const startedAt = Date.now()
  if (isCircuitOpen(name)) {
    return { ok: false, result: { error: 'circuit-open' }, meta: { attempts: 0, durationMs: 0, error: `工具 ${name} 连续失败已熔断，稍后再试` } }
  }

  let lastError = ''
  for (let attempt = 1; attempt <= RETRY_TIMES + 1; attempt += 1) {
    entry.calls += 1
    try {
      const result = await withTimeout(Promise.resolve().then(() => execute(name, args, context)), timeoutMs, name)
      const durationMs = Date.now() - startedAt
      entry.consecutiveFailures = 0
      entry.lastMs = durationMs
      entry.lastError = ''
      return { ok: true, result, meta: { attempts: attempt, durationMs, error: '' } }
    } catch (error) {
      lastError = error?.message || String(error)
      entry.failures += 1
      entry.lastMs = Date.now() - startedAt
      entry.lastError = lastError
    }
  }

  entry.consecutiveFailures += 1
  if (entry.consecutiveFailures >= FAILURE_THRESHOLD) entry.openedAt = Date.now()
  return {
    ok: false,
    result: { error: 'tool-failed', message: lastError },
    meta: { attempts: RETRY_TIMES + 1, durationMs: Date.now() - startedAt, error: lastError }
  }
}
