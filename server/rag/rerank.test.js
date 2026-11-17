// 重排的单元测试：只验证排序口径与副作用，不依赖真实语料的得分。
import test from 'node:test'
import assert from 'node:assert/strict'
import { isRerankEnabled, queryTrigrams, rerankPassages, rerankScore } from './rerank.js'

const passage = (overrides = {}) => ({
  id: 1, text: '二次函数顶点式求最值，先配方再判断开口方向。', score: 10, subject: '数学', quality: 0.9, lowQuality: false, ...overrides
})

test('三字片段覆盖越多，重排分越高', () => {
  const query = '二次函数顶点式'
  const trigrams = queryTrigrams(query)
  const covered = rerankScore(passage({ text: '二次函数顶点式怎么写，先配方。' }), { trigrams, subject: '数学' })
  const uncovered = rerankScore(passage({ text: '这道题考查图形的稳定性与三角形关系。' }), { trigrams, subject: '数学' })
  assert.ok(covered > uncovered)
})

test('可读性差的片段被降权，能读的片段排到前面', () => {
  const query = '二次函数顶点式'
  const broken = passage({ id: 1, score: 12, quality: 0.25, lowQuality: true, text: '若点 0, , 1, , 2, y y y 都在二次函数 y x = 的图象上' })
  const readable = passage({ id: 2, score: 11, quality: 1, text: '二次函数顶点式求最值：先配方成 y=a(x-h)²+k，再判断开口方向。' })
  const ranked = rerankPassages([broken, readable], { query, subject: '数学' })
  assert.equal(ranked[0].id, 2)
})

test('学科一致与带解析结构的片段获得加分', () => {
  const base = rerankScore(passage(), { trigrams: [], subject: '数学' })
  const otherSubject = rerankScore(passage({ subject: '物理' }), { trigrams: [], subject: '数学' })
  const withAnswer = rerankScore(passage({ text: '【答案】先配方。【解析】顶点为 (h,k)。' }), { trigrams: [], subject: '数学' })
  assert.ok(base > otherSubject)
  assert.ok(withAnswer > base)
})

test('过短片段被降权', () => {
  const long = '二次函数顶点式求最值：先把一般式配方成 y=a(x-h)²+k 的形式，再根据 a 的正负判断开口方向，最后代入顶点坐标求最值。常见错误是漏掉 a 的符号。'
  const short = rerankScore(passage({ text: '二次函数' }), { trigrams: [], subject: '数学' })
  const normal = rerankScore(passage({ text: long }), { trigrams: [], subject: '数学' })
  assert.ok(normal > short)
})

test('重排不修改入参数组，并保留原始 BM25 分', () => {
  const input = [passage({ id: 1, score: 8 }), passage({ id: 2, score: 9 })]
  const snapshot = JSON.parse(JSON.stringify(input))
  const output = rerankPassages(input, { query: '二次函数顶点式' })
  assert.deepEqual(input, snapshot)
  assert.ok(output[0].bm25Score > 0)
})

test('topK 截断生效，0 分片段排在最后', () => {
  const ranked = rerankPassages([passage({ id: 1, score: 0 }), passage({ id: 2, score: 10 })], { query: '二次函数', topK: 1 })
  assert.equal(ranked.length, 1)
  assert.equal(ranked[0].id, 2)
})

test('RAG_RERANK=0 可以关掉重排', () => {
  const original = process.env.RAG_RERANK
  process.env.RAG_RERANK = '0'
  assert.equal(isRerankEnabled(), false)
  delete process.env.RAG_RERANK
  assert.equal(isRerankEnabled(), true)
  if (original === undefined) delete process.env.RAG_RERANK
  else process.env.RAG_RERANK = original
})
