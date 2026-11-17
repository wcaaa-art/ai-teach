// 脱敏与安全评测的回归测试：
// 一条是"别把学生隐私复述出去"，一条是"别把正常学习内容拦下来"。
import test from 'node:test'
import assert from 'node:assert/strict'
import { containsPii, maskPii } from './pii.js'
import { runSafetyEval } from './safety-eval.js'

test('手机号、身份证、邮箱、银行卡会被打码，且保留可核对的头尾', () => {
  const input = '我的手机 13812345678，邮箱 student_01@example.com，身份证 110101200801011234。'
  const { text, hits } = maskPii(input)
  assert.equal(hits.phone, 1)
  assert.equal(hits.email, 1)
  assert.equal(hits.idCard, 1)
  assert.ok(text.includes('138****5678'))
  assert.ok(text.includes('s***@example.com'))
  assert.ok(text.includes('110101********1234'))
  assert.ok(!text.includes('13812345678'))
})

test('16 位银行卡号被打码，普通年份与分数不受影响', () => {
  const { text, hits } = maskPii('卡号 6222021234567890，2026 年 3 月考试得 128 分。')
  assert.equal(hits.bankCard, 1)
  assert.ok(text.includes('****7890'))
  assert.ok(text.includes('2026 年'))
  assert.ok(text.includes('128 分'))
})

test('无敏感信息时原样返回，不误伤正常文本', () => {
  const input = '二次函数顶点式 y=a(x-h)²+k，练习册第 128 页第 3 题。'
  const { text, hits } = maskPii(input)
  assert.equal(text, input)
  assert.deepEqual(hits, {})
  assert.equal(containsPii(input), false)
})

test('安全评测达到既定门槛：对抗样本拦截率 100%，正常样本零误杀', () => {
  const result = runSafetyEval()
  assert.equal(result.adversarial.rate, 1, '存在漏拦样本：' + JSON.stringify(result.adversarial.missed))
  assert.equal(result.benign.falselyBlocked, 0, '存在误杀样本：' + JSON.stringify(result.benign.examples))
  // 分类覆盖也要完整，避免只靠关键词碰巧通过。
  assert.ok(Object.keys(result.byCategory).length >= 6)
})
