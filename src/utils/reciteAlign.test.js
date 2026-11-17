import test from 'node:test'
import assert from 'node:assert/strict'
import { buildHint, judgeLine, judgeSpelling, normalizeSpeech } from './reciteAlign.js'

test('normalizeSpeech 去掉标点与空白，保留字词', () => {
  assert.equal(normalizeSpeech('夫君子之行，静以修身。'), '夫君子之行静以修身')
  assert.equal(normalizeSpeech('  Hello, World! '), 'helloworld')
  assert.equal(normalizeSpeech(''), '')
})

test('整句背对时覆盖率为 1', () => {
  const result = judgeLine('非淡泊无以明志，非宁静无以致远。', '非淡泊无以明志 非宁静无以致远')
  assert.equal(result.ok, true)
  assert.equal(result.rate, 1)
  assert.deepEqual(result.missed, [])
})

test('漏掉一两个字的短句仍然算过', () => {
  const result = judgeLine('非淡泊无以明志，非宁静无以致远。', '非淡泊无以明志 非宁静以致远')
  assert.equal(result.ok, true)
  assert.ok(result.rate > 0.85)
  assert.ok(result.missed.includes('无'))
})

test('漏掉半句判为不过，并指出漏在哪里', () => {
  const result = judgeLine('山不在高，有仙则名。水不在深，有龙则灵。', '山不在高有仙则名')
  assert.equal(result.ok, false)
  assert.ok(result.rate < 0.62)
  assert.ok(result.missed.some(part => part.includes('有龙则灵')))
})

test('同音错字不影响判定，因为比对的是覆盖率', () => {
  // 识别把「惟」听成「唯」，仍有极高的公共子序列。
  const result = judgeLine('斯是陋室，惟吾德馨。', '斯是陋室唯吾德馨')
  assert.equal(result.ok, true)
})

test('什么都没识别到时直接判不过', () => {
  const result = judgeLine('学而时习之', '')
  assert.equal(result.ok, false)
  assert.equal(result.rate, 0)
  assert.deepEqual(result.missed, ['学而时习之'])
})

test('提示按步长逐步加长，最多给出全部内容', () => {
  assert.equal(buildHint('夫君子之行，静以修身。', 0), '夫君子之')
  assert.equal(buildHint('夫君子之行，静以修身。', 1), '夫君子之行静以')
  assert.equal(buildHint('夫君子之行，静以修身。', 9), '夫君子之行静以修身')
  assert.equal(buildHint('', 0), '')
})

test('英语默写忽略大小写和空格差异', () => {
  assert.equal(judgeSpelling('achieve', 'Achieve ').ok, true)
  assert.equal(judgeSpelling('ice cream', 'icecream').ok, true)
  assert.equal(judgeSpelling('achieve', 'achive').ok, false)
  // 空答案不能算对，否则空着提交也会通过。
  assert.equal(judgeSpelling('', '').ok, false)
})
