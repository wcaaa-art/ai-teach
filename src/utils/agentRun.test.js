// Agent 运行记录的纯函数测试：合并工具调用、计算耗时、生成摘要。
import test from 'node:test'
import assert from 'node:assert/strict'
import { createAgentRun, finishAgentRun, recordRunTool, summarizeRun } from './agentRun.js'

test('新建记录带默认字段，标题截断到 40 字', () => {
  const run = createAgentRun({ kind: 'tutor', title: 'x'.repeat(60), startedAt: 1000 })
  assert.equal(run.kind, 'tutor')
  assert.equal(run.status, 'running')
  assert.equal(run.title.length, 40)
  assert.equal(run.startedAt, 1000)
  assert.deepEqual(run.tools, [])
})

test('同一次工具调用的 start 与 done 合并成一条，并带上耗时与重试次数', () => {
  const run = createAgentRun({ startedAt: 1 })
  recordRunTool(run, { name: 'rag_knowledge_query', label: '检索课标知识库', status: 'start' })
  recordRunTool(run, { name: 'rag_knowledge_query', label: '检索课标知识库', status: 'done', summary: '命中 2 个知识点', meta: { attempts: 2, durationMs: 35, ok: true } })
  assert.equal(run.tools.length, 1)
  assert.equal(run.tools[0].summary, '命中 2 个知识点')
  assert.equal(run.tools[0].attempts, 2)
  assert.equal(run.tools[0].durationMs, 35)
  assert.equal(run.tools[0].ok, true)
})

test('未收到 start 直接 done 时也能记下来', () => {
  const run = createAgentRun({ startedAt: 1 })
  recordRunTool(run, { name: 'calc_review_interval', label: '计算复习间隔', status: 'done', summary: '建议 2 天后复习' })
  assert.equal(run.tools.length, 1)
  assert.equal(run.tools[0].name, 'calc_review_interval')
})

test('结束记录时计算总耗时，且不修改原对象', () => {
  const run = createAgentRun({ startedAt: 1000 })
  const finished = finishAgentRun(run, { status: 'done', source: 'deepseek', now: 3500, citationCount: 2 })
  assert.equal(run.status, 'running', '原对象应保持不变')
  assert.equal(finished.status, 'done')
  assert.equal(finished.durationMs, 2500)
  assert.equal(finished.citationCount, 2)
  assert.equal(finished.source, 'deepseek')
})

test('结束时间早于开始时间时不会出现负耗时', () => {
  const run = createAgentRun({ startedAt: 5000 })
  const finished = finishAgentRun(run, { now: 1000 })
  assert.equal(finished.durationMs, 0)
})

test('摘要展示工具链与失败步数', () => {
  const run = createAgentRun({ startedAt: 0 })
  recordRunTool(run, { name: 'a', label: '检索课标知识库', status: 'done', meta: { attempts: 1, ok: true } })
  recordRunTool(run, { name: 'b', label: '计算复习间隔', status: 'done', meta: { attempts: 1, ok: false } })
  const summary = summarizeRun(finishAgentRun(run, { now: 2000 }))
  assert.match(summary, /2\.0s/)
  assert.match(summary, /检索课标知识库 → 计算复习间隔/)
  assert.match(summary, /1 步失败/)
})

test('没有工具调用时摘要直接说明未调用', () => {
  const run = finishAgentRun(createAgentRun({ startedAt: 0 }), { now: 1500 })
  assert.match(summarizeRun(run), /未调用工具/)
})
