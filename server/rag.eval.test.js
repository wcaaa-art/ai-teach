// RAG 评测集回归测试：把「检索质量」变成可回归的硬指标。
// 改了分词、权重或覆盖率策略后，只要检索质量掉下来，这里就会红。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { searchPassages, tokenizeQuery } from './rag/index.js'
import { RAG_EVAL_CASES, RAG_NEGATIVE_CASES, RAG_EVAL_TOP_K } from './rag/rag-eval-cases.js'

test('评测集整体通过率达标（学科命中率与关键词命中率）', () => {
  let passed = 0
  let subjectHits = 0
  const failures = []
  // 语料覆盖缺口用例（corpusGap）不计入质量门槛：它们断言的是语料有没有，不是检索准不准。
  const scored = RAG_EVAL_CASES.filter(item => !item.corpusGap)
  for (const item of scored) {
    const passages = searchPassages({ query: item.query, subject: item.subject, grade: item.grade, topK: RAG_EVAL_TOP_K })
    const subjectHit = passages.some(entry => entry.subject === item.subject)
    const keywordHit = passages.some(entry => item.expectKeywords.some(word => entry.text.includes(word)))
    if (subjectHit) subjectHits += 1
    if (passages.length > 0 && subjectHit && keywordHit) passed += 1
    else failures.push(`${item.id}｜${item.subject}｜${item.query}`)
  }
  const rate = passed / scored.length
  const subjectRate = subjectHits / scored.length
  assert.ok(rate >= 0.95, `用例通过率过低 ${(rate * 100).toFixed(1)}%，未通过：${failures.join('；')}`)
  assert.ok(subjectRate >= 0.95, `学科命中率过低 ${(subjectRate * 100).toFixed(1)}%`)
})

test('无意义查询不硬凑结果', () => {
  for (const item of RAG_NEGATIVE_CASES) {
    const passages = searchPassages({ query: item.query, topK: RAG_EVAL_TOP_K })
    assert.equal(passages.length, 0, `${item.id}（${item.query}）返回了 ${passages.length} 条结果`)
  }
})

test('评测集里的每条用例都能查到带出处的片段', () => {
  // 语料覆盖缺口用例（corpusGap）不计入质量门槛：它们断言的是语料有没有，不是检索准不准。
  const scored = RAG_EVAL_CASES.filter(item => !item.corpusGap)
  for (const item of scored) {
    const passages = searchPassages({ query: item.query, subject: item.subject, grade: item.grade, topK: RAG_EVAL_TOP_K })
    assert.ok(passages.length > 0, `${item.id} 没有检索到结果`)
    for (const passage of passages) {
      assert.match(passage.citation, /^《.+》$/, `${item.id} 的出处格式不对：${passage.citation}`)
      assert.notEqual(passage.stage, '高中', `${item.id} 混入了高中语料`)
    }
  }
})

test('分词不再产生单字符重复的噪音词元', () => {
  const tokens = tokenizeQuery('zzzzzzzzxxxx')
  assert.ok(tokens.every(token => !/^(.)\1+$/.test(token)), `仍有重复字符词元：${tokens.join(',')}`)
})
