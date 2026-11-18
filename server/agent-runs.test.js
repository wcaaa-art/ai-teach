import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'agent-runs-'))
process.env.AGENT_RUNS_FILE = join(dir, 'runs.json')
const { listAgentRuns, saveAgentRun } = await import('./agent-runs.js')

test.after(() => rmSync(dir, { recursive: true, force: true }))

test('运行记录落盘并按时间倒序读取', () => {
  saveAgentRun({ mode: 'guide', question: '第一问', goal: '目标一', status: 'completed', steps: [{ tool: 'rag_knowledge_query', status: 'done', ms: 12 }] })
  saveAgentRun({ mode: 'explain', question: '第二问', goal: '目标二', status: 'failed', steps: [] })
  const listed = listAgentRuns(5)
  assert.equal(listed.total, 2)
  assert.equal(listed.items[0].question, '第二问')
  assert.equal(listed.items[1].steps[0].tool, 'rag_knowledge_query')
  assert.equal(listed.items[0].durationMs, 0)
})
