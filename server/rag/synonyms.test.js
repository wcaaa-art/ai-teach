// 查询扩展的单元测试：只验证"该扩的扩、不该扩的不乱扩"。
import test from 'node:test'
import assert from 'node:assert/strict'
import { aliasGroups, expandQuery } from './synonyms.js'
import { searchPassages } from './index.js'

test('口语说法会补进课标别名', () => {
  const { expanded, added } = expandQuery('抛物线顶点怎么求')
  assert.ok(added.includes('二次函数'))
  assert.ok(expanded.includes('抛物线顶点怎么求'))
  assert.ok(expanded.includes('二次函数'))
})

test('没有命中别名表时原样返回', () => {
  const { expanded, added } = expandQuery('zzz 无意义的问题')
  assert.equal(expanded, 'zzz 无意义的问题')
  assert.deepEqual(added, [])
})

test('扩展词有上限，避免稀释 BM25 查询向量', () => {
  // 一句话同时命中多组别名时，追加词也不能超过 8 个。
  const { added } = expandQuery('二次函数和化学方程式和议论文和光合作用')
  assert.ok(added.length <= 8)
})

test('别名表规模可被观测（用于文档与答辩说明口径）', () => {
  assert.ok(aliasGroups() >= 10)
})

test('扩展能救回原本召不回的提问，关闭后复现退化', () => {
  const withExpand = searchPassages({ query: '反应式怎么配平', subject: '化学', grade: '初三', topK: 4 })
  const withoutExpand = searchPassages({ query: '反应式怎么配平', subject: '化学', grade: '初三', topK: 4, expand: false })
  const hit = list => list.some(item => item.text.includes('化学方程式'))
  assert.equal(hit(withExpand), true)
  assert.equal(hit(withoutExpand), false)
})
