// 答疑历史的构造规则：去掉最新一条、限制长度、把图片题要点带回下一轮。
import test from 'node:test'
import assert from 'node:assert/strict'
import { buildTutorHistory, clipImageContext } from './tutorHistory.js'

test('历史不包含刚发出的最新一条消息', () => {
  const messages = [
    { role: 'user', content: '第一问' },
    { role: 'assistant', content: '先看条件' },
    { role: 'user', content: '第二问' }
  ]
  const history = buildTutorHistory(messages)
  assert.equal(history.length, 2)
  assert.equal(history[0].content, '第一问')
  assert.equal(history.at(-1).content, '先看条件')
})

test('带图片要点的历史会附加摘要，普通消息保持不变', () => {
  const history = buildTutorHistory([
    { role: 'user', content: '这道题怎么做', imageContext: '已知抛物线开口向下，与 x 轴交于 A、B' },
    { role: 'assistant', content: '先判断对称轴' },
    { role: 'user', content: '那第二步呢' }
  ])
  assert.match(history[0].content, /上一轮图片题的要点：已知抛物线开口向下/)
  assert.equal(history[1].content, '先判断对称轴')
})

test('历史条数按上限截断，保留最近的对话', () => {
  const messages = Array.from({ length: 20 }, (_, index) => ({ role: index % 2 ? 'assistant' : 'user', content: `第${index}条` }))
  const history = buildTutorHistory(messages, 5)
  assert.equal(history.length, 4)
  assert.equal(history.at(-1).content, '第18条')
})

test('图片要点压缩空白并截断，空答复不产生上下文', () => {
  assert.equal(clipImageContext('  已知  条件\n\n 如下  '), '已知 条件 如下')
  assert.equal(clipImageContext(''), '')
  const long = clipImageContext('a'.repeat(400))
  assert.equal(long.length, 241)
  assert.ok(long.endsWith('…'))
})
