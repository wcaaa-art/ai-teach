// 混合检索回归测试：确认双路召回结构一致、降级可靠、不会影响现有调用方。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchPassages } from './rag/index.js'
import { hybridSearch, denseChannelStatus, loadDenseIndex } from './rag/hybrid.js'
import { executeTool } from './tools.js'

test('混合检索返回结构与稀疏路一致', () => {
  const options = { query: '二次函数顶点式怎么求最大值', subject: '数学', grade: '初三', topK: 3 }
  const sparse = searchPassages(options)
  const hybrid = hybridSearch(options)
  assert.ok(hybrid.length > 0, '混合检索没有返回结果')
  for (const item of hybrid) {
    assert.equal(typeof item.id, 'number')
    assert.equal(typeof item.text, 'string')
    assert.match(item.citation, /^《.+》$/)
    assert.ok(item.subject)
  }
  assert.ok(sparse.length > 0)
})

test('混合检索不会返回重复片段', () => {
  const passages = hybridSearch({ query: '一元二次方程', subject: '数学', grade: '初三', topK: 4 })
  const ids = passages.map(item => item.id)
  assert.equal(new Set(ids).size, ids.length, '出现重复片段')
})

test('稠密通道不可用时退回稀疏路，接口不报错', () => {
  // 索引文件缺失或损坏时，loadDenseIndex 返回 null 而不是抛错。
  const index = loadDenseIndex()
  const status = denseChannelStatus()
  assert.equal(typeof status.enabled, 'boolean')
  if (!index) {
    const passages = hybridSearch({ query: '欧姆定律', subject: '物理', grade: '初三', topK: 3 })
    assert.ok(Array.isArray(passages), '降级后没有返回数组')
  }
})

test('rag_knowledge_query 默认走稀疏路，行为与改造前一致', () => {
  const result = executeTool('rag_knowledge_query', { subject: '化学', grade: '初三', keyword: '化学方程式配平' })
  assert.ok(result.items.length >= 1)
  assert.ok(result.passages.length >= 1)
  assert.equal(result.source, 'curriculum+exam-rag')
  assert.ok(result.citations[0].text.includes('真题'))
})

test('开启 RAG_HYBRID 后工具仍能返回完整片段', () => {
  const previous = process.env.RAG_HYBRID
  process.env.RAG_HYBRID = '1'
  try {
    const result = executeTool('rag_knowledge_query', { subject: '化学', grade: '初三', keyword: '化学方程式配平' })
    assert.ok(result.passages.length >= 1, '混合模式下没有返回片段')
    for (const passage of result.passages) {
      assert.match(passage.citation, /^《.+》$/)
      assert.notEqual(passage.stage, '高中')
    }
  } finally {
    if (previous === undefined) delete process.env.RAG_HYBRID
    else process.env.RAG_HYBRID = previous
  }
})
