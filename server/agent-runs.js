// Agent 运行记录：规划层每次执行的计划、步骤状态与耗时落盘，便于复盘与评审核验。
// 只记录结构化字段与截断后的问题，不存模型回答全文。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const FILE = process.env.AGENT_RUNS_FILE || join(process.cwd(), 'server', 'data', 'agent-runs.json')
const MAX_RUNS = 100

function readAll() {
  try {
    if (!existsSync(FILE)) return []
    const parsed = JSON.parse(readFileSync(FILE, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveAgentRun(run = {}) {
  const record = {
    id: run.id || `run-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    at: Date.now(),
    mode: run.mode === 'explain' ? 'explain' : 'guide',
    question: String(run.question || '').slice(0, 120),
    goal: String(run.goal || '').slice(0, 100),
    status: ['completed', 'fallback', 'failed', 'planned'].includes(run.status) ? run.status : 'completed',
    source: String(run.source || '').slice(0, 24),
    durationMs: Math.max(0, Number(run.durationMs) || 0),
    steps: (Array.isArray(run.steps) ? run.steps : []).slice(0, 3).map(step => ({
      tool: String(step.tool || '').slice(0, 40),
      status: step.status === 'done' ? 'done' : 'failed',
      ms: Math.max(0, Number(step.ms) || 0)
    }))
  }
  const runs = readAll()
  runs.unshift(record)
  mkdirSync(dirname(FILE), { recursive: true })
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(runs.slice(0, MAX_RUNS), null, 2), 'utf8')
  renameSync(tmp, FILE)
  return record
}

export function listAgentRuns(limit = 20) {
  const size = Math.max(1, Math.min(MAX_RUNS, Number(limit) || 20))
  const runs = readAll()
  return { total: runs.length, items: runs.slice(0, size) }
}
