// RAG 检索单测：验证索引可读、学科加权、出处格式与工具集成，避免动画之外的检索层悄悄退化为空结果。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { formatCitation, getRagStats, normalizeText, searchPassages, tokenizeQuery } from './rag/index.js'
import { executeTool } from './tools.js'
import { summarizeToolResult } from './agent.js'

test('索引能加载且规模合理', () => {
  const stats = getRagStats()
  assert.ok(stats.chunks >= 800, `chunks 太少：${stats.chunks}`)
  assert.ok(stats.terms >= 50000, `terms 太少：${stats.terms}`)
})

test('归一化与查询分词保持中文滑窗', () => {
  assert.equal(normalizeText('二次函数，顶点式！'), '二次函数顶点式')
  const tokens = tokenizeQuery('二次函数')
  assert.ok(tokens.includes('二次'))
  assert.ok(tokens.includes('二次函'))
  assert.ok(tokens.includes('函数'))
  assert.ok(!tokens.includes('顶点'))
})

test('数学提问优先命中数学真题并带出处', () => {
  const passages = searchPassages({ query: '二次函数顶点式怎么求最大值', subject: '数学', grade: '初三', topK: 3 })
  assert.ok(passages.length >= 1)
  assert.equal(passages[0].subject, '数学')
  assert.match(passages[0].citation, /^《.+》$/)
  assert.ok(passages[0].text.length > 0)
})

test('学科加权让物理提问回到物理片段', () => {
  const passages = searchPassages({ query: '欧姆定律 电流与电压的关系', subject: '物理', grade: '初三', topK: 3 })
  assert.ok(passages.length >= 1)
  const physics = passages.filter(item => item.subject === '物理')
  assert.ok(physics.length >= 1, '没有任何物理片段')
  assert.ok(passages[0].score > 0)
})

test('无关或过短的问题不返回结果', () => {
  assert.deepEqual(searchPassages({ query: '' }), [])
  assert.deepEqual(searchPassages({ query: '哈' }), [])
  assert.ok(searchPassages({ query: 'zzzzzzzz' }).length === 0)
})

test('rag_knowledge_query 工具同时返回知识点与真题片段', () => {
  const result = executeTool('rag_knowledge_query', { subject: '化学', grade: '初三', keyword: '化学方程式配平' })
  assert.ok(result.items.length >= 1, '知识点检索为空')
  assert.ok(result.passages.length >= 1, '真题片段检索为空')
  assert.ok(result.citations[0].includes('真题'))
  assert.equal(result.source, 'curriculum+exam-rag')
})

test('工具摘要同时显示知识点与真题条数，前端可见检索过程', () => {
  const summary = summarizeToolResult('rag_knowledge_query', { matches: ['二次函数', '抛物线'], passages: [{}, {}, {}] })
  assert.match(summary, /2 个知识点/)
  assert.match(summary, /3 条真题解析/)
})

test('出处格式只保留文件名，不拼造卷名', () => {
  assert.equal(formatCitation({ file: '中考/真题/2022/2022年广东省中考化学真题（解析版）.pdf' }), '《2022年广东省中考化学真题（解析版）》')
})
