// 片段可读性评估：既要挑出公式丢失的残句，也不能把带公式的正常题判成乱码。
import test from 'node:test'
import assert from 'node:assert/strict'
import { assessPassageQuality, searchPassages } from './rag/index.js'

test('公式整体丢失的残句会被判为低质', () => {
  const broken = '8. 若点   0,  , 1,  , 2,  y  y  y 都在二次函数 y x = 的图象上，则（ ）'
  const result = assessPassageQuality(broken)
  assert.equal(result.low, true)
  assert.equal(result.reason, 'garbled-math')
  assert.ok(result.score < 0.42)
})

test('正常中文题面不会被误判', () => {
  for (const text of [
    '11. 张之洞提到：“乙未（1895 年）以后，志士文人，创开报馆，广译洋报，参以博议．始于沪上，流衍于各省。”这一现象',
    '21. 羰基铁粉在国防军工领域有重要应用，我国是少数几个掌握其生产技术的国家之一。制备羰基铁粉的过程如下：',
    '14. 中华民国临时政府成立初，入同盟会者激增，“一日附者率数千”，趋炎附势之徒也竞相加入。'
  ]) {
    const result = assessPassageQuality(text)
    assert.equal(result.low, false, `不应判为低质：${text.slice(0, 20)}`)
    assert.ok(result.score >= 0.6)
  }
})

test('带【答案】结构的片段获得回补，不会被误杀', () => {
  const withAnswer = '20. 电解水制氢联合碳酸钙分解制备氧化钙，能减少碳排放。【答案】（1）减少二氧化碳排放；（2）反应条件不同。'
  assert.equal(assessPassageQuality(withAnswer).low, false)
})

test('空片段直接判为低质，避免空字符串进入依据', () => {
  assert.equal(assessPassageQuality('').low, true)
  assert.equal(assessPassageQuality('   ').low, true)
})

test('检索结果携带质量分，低质片段可被调用方过滤', () => {
  const passages = searchPassages({ query: '二次函数顶点式', grade: '初三', subject: '数学', topK: 4 })
  assert.ok(passages.length > 0)
  for (const item of passages) {
    assert.equal(typeof item.quality, 'number')
    assert.equal(typeof item.lowQuality, 'boolean')
  }
  const filtered = searchPassages({ query: '二次函数顶点式', grade: '初三', subject: '数学', topK: 4, minQuality: 0.42 })
  assert.ok(filtered.every(item => item.quality >= 0.42))
})
