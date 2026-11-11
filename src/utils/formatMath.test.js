import test from 'node:test'
import assert from 'node:assert/strict'
import { formatMathText } from './formatMath.js'

test('数学文本显示层只把明确上下标排成教学样式', () => {
  const output = formatMathText('看 x^2+5x+6 和 \\frac{a}{b}，不改变计算含义')
  assert.match(output, /x<sup>2<\/sup>\+5x\+6/)
  assert.match(output, /class="math-frac"/)
  assert.doesNotMatch(output, /<sup>2\+5x/)
})

test('数列记号渲染成真正的下标', () => {
  const output = formatMathText('数列 {a_n}：a_n=2n+1，a_1=2，a_{n+1}=a_n+3，a1=2，S_n=n^2，x_n')
  assert.match(output, /a<sub>n<\/sub>=2n\+1/)
  assert.match(output, /a<sub>1<\/sub>=2/)
  assert.match(output, /a<sub>n\+1<\/sub>=a<sub>n<\/sub>\+3/)
  assert.match(output, /S<sub>n<\/sub>=n<sup>2<\/sup>/)
  assert.match(output, /x<sub>n<\/sub>/)
  assert.doesNotMatch(output, /a<sub>n\+S/)
})

test('竖排 an 只在数列语境转下标，英文单词不受影响', () => {
  assert.equal(formatMathText('and than sand'), 'and than sand')
  const output = formatMathText('数列 {an} 中，and 与 than 保持原样')
  assert.match(output, /\{a<sub>n<\/sub>\}/)
  assert.match(output, /and 与 than 保持原样/)
  assert.doesNotMatch(output, /<sub>n<\/sub>d/)
  // 由 Sn 求 an 这类计划名没有“数列”字样，但 S n 记号足以判定为数列语境；aₙ 与 Sₙ 都要下标
  assert.match(formatMathText('由 Sn 求 an'), /由 S<sub>n<\/sub> 求 a<sub>n<\/sub>/)
  assert.match(formatMathText('数列综合 · 等比中项 · 由Sn求an'), /由S<sub>n<\/sub>求a<sub>n<\/sub>/)
})

test('向量记号排成带上箭头的符号，模与数量不混淆', () => {
  const output = formatMathText('已知 \\vec{a} = (1, 2)，|\\vec{a}| = √5，\\overrightarrow{AB} 与 \\vec{a}·\\vec{b}')
  assert.match(output, /<span class="vec">a<\/span>/)
  assert.match(output, /\|<span class="vec">a<\/span>\|/)
  assert.match(output, /<span class="vec">AB<\/span>/)
  assert.doesNotMatch(output, /\\vec/)
})

test('换行、根号与纯文本兜底保持可用', () => {
  const output = formatMathText('第一行\n\\sqrt{2}\n第二行')
  assert.match(output, /第一行<br>√\(2\)<br>第二行/)
  assert.equal(formatMathText('普通中文与 english'), '普通中文与 english')
})
