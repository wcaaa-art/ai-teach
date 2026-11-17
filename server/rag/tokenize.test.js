// 建库分词口径的测试：增量入库与 Python 建库脚本必须用同一套 tokenize，
// 否则新片段与既有索引的词元对不上，检索时会出现"明明有这条却搜不到"。
import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeText, tokenizeForIndex, searchPassages } from './index.js'

test('中文按 2 字与 3 字滑窗切分，标点被丢弃后仍连续', () => {
  const tokens = tokenizeForIndex('二次函数，顶点式')
  assert.ok(tokens.includes('二次'))
  assert.ok(tokens.includes('函数'))
  assert.ok(tokens.includes('二次函'))
  // 逗号不影响滑窗：函数与顶点式之间会出现跨标点的组合
  assert.ok(tokens.includes('数顶'))
})

test('英文与数字整段保留，单字符不参与', () => {
  // 归一化会先剥掉等号与加号，所以 y=ax+b 变成连续的 yaxb —— 与 Python 建库脚本口径一致。
  const tokens = tokenizeForIndex('y=ax+b 与 2024 年')
  assert.ok(tokens.includes('yaxb'))
  assert.ok(tokens.includes('2024'))
  assert.ok(!tokens.includes('y'), '单字符不进入词元表')
})

test('分词与归一化共享同一套全角处理', () => {
  assert.equal(normalizeText('ＡＢＣ１２３'), 'abc123')
  assert.ok(tokenizeForIndex('ＡＢＣ').includes('abc'))
})

test('入库分词能命中真实索引内容', () => {
  // 用索引里确定存在的真题文本反查：分词若与建库不一致，这里会直接空。
  const passages = searchPassages({ query: '辛亥革命', subject: '历史', topK: 2 })
  assert.ok(passages.length > 0)
  assert.ok(passages[0].text.includes('革命') || passages[0].text.includes('辛亥'))
})
