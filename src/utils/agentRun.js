// Agent 运行记录：把"模型这一轮调了什么工具、花了多久、成不成功"沉淀下来。
// 只在前端（IndexedDB）存，服务端保持无状态——本地优先的承诺不能因为加了观测就破掉。

/**
 * 新建一条运行记录。
 * @param {{ kind?: string, title?: string, startedAt?: number, id?: string }} [options]
 */
export function createAgentRun({ kind = 'tutor', title = '', startedAt = Date.now(), id } = {}) {
  return {
    id: id || `run_${startedAt}_${Math.random().toString(36).slice(2, 7)}`,
    kind,
    title: String(title || '').slice(0, 40),
    startedAt,
    endedAt: 0,
    durationMs: 0,
    status: 'running',
    source: '',
    tools: [],
    citationCount: 0
  }
}

/**
 * 记录一次工具调用（start 与 done 合并到同一条，保留耗时与重试次数）。
 * @param {ReturnType<typeof createAgentRun>} run
 * @param {{ name?: string, label?: string, status?: string, summary?: string, citations?: any[], meta?: { attempts?:number, durationMs?:number, ok?:boolean } }} tool
 */
export function recordRunTool(run, tool = {}) {
  if (!run || !tool.name) return run
  if (tool.status === 'start') {
    run.tools.push({ name: tool.name, label: tool.label || tool.name, summary: '', attempts: 0, durationMs: 0, ok: true })
    return run
  }
  const target = [...run.tools].reverse().find(item => item.name === tool.name && !item.summary)
  const entry = target || { name: tool.name, label: tool.label || tool.name, summary: '', attempts: 0, durationMs: 0, ok: true }
  entry.summary = String(tool.summary || '').slice(0, 120)
  entry.attempts = Number(tool.meta?.attempts) || 1
  entry.durationMs = Number(tool.meta?.durationMs) || 0
  entry.ok = tool.meta ? Boolean(tool.meta.ok) : true
  if (!target) run.tools.push(entry)
  return run
}

/**
 * 结束一条运行记录。
 * @param {ReturnType<typeof createAgentRun>} run
 * @param {{ status?: 'done'|'error'|'interrupted', source?: string, now?: number, citationCount?: number }} [options]
 */
export function finishAgentRun(run, { status = 'done', source = '', now = Date.now(), citationCount } = {}) {
  const endedAt = Math.max(now, run.startedAt)
  return {
    ...run,
    status,
    source: source || run.source,
    endedAt,
    durationMs: endedAt - run.startedAt,
    citationCount: typeof citationCount === 'number' ? citationCount : run.citationCount,
    tools: run.tools.map(tool => ({ ...tool }))
  }
}

/** 运行摘要：给列表页用的一句话。 */
export function summarizeRun(run = {}) {
  const tools = Array.isArray(run.tools) ? run.tools : []
  const failed = tools.filter(tool => tool.ok === false).length
  const seconds = ((Number(run.durationMs) || 0) / 1000).toFixed(1)
  if (!tools.length) return `${seconds}s · 未调用工具`
  const chain = tools.map(tool => tool.label || tool.name).join(' → ')
  return `${seconds}s · ${chain}${failed ? `（${failed} 步失败）` : ''}`
}
