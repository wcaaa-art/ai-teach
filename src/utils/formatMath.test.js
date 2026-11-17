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
  assert.match(output, /第一行<br><span class="math-nowrap">√\(2\)<\/span><br>第二行/)
  assert.equal(formatMathText('普通中文与 english'), '普通中文与 english')
})

test('题干空括号不会被拆成两行', () => {
  const output = formatMathText('下列说法正确的是（\n）')
  assert.match(output, /（\u00a0\u00a0）/)
  assert.doesNotMatch(output, /（<br>/)
  assert.match(formatMathText('填一填（   ）。'), /（\u00a0\u00a0）。/)
})

test('全角点句号改成中文句号，因为所以符号后留空格', () => {
  const output = formatMathText('解：∵5 是出现次数最多的数，∴这组数据的众数为5．')
  assert.match(output, /∵ 5 是出现次数最多的数/)
  assert.match(output, /∴ 这组数据的众数为5。/)
  // 小数点保留原样，选项标记（后面紧跟内容）不被当成句末
  assert.match(formatMathText('3．5 米'), /3．5 米/)
  assert.equal(formatMathText('A．甲'), 'A．甲')
})

test('例题里的几何 LaTeX 记号排成教材符号', () => {
  const output = formatMathText('已知 \\triangle ABC \\cong \\triangle DEF，\\angle A=50^\\circ，AB\\parallel CD，AC\\perp BC')
  assert.match(output, /△ ABC ≌ △ DEF/)
  assert.match(output, /∠ A=50°/)
  assert.match(output, /AB∥ CD/)
  assert.match(output, /AC⊥ BC/)
  assert.doesNotMatch(output, /\\triangle|\\cong|\\angle|\\parallel|\\perp|\\circ/)
})

test('数学公式整条不拆行，分号隔开的多条公式各自成块', () => {
  const output = formatMathText('去括号：a+(b−c) = a+b−c；a−(b−c) = a−b+c')
  assert.match(output, /<span class="math-nowrap">a\+\(b−c\) = a\+b−c<\/span>/)
  assert.match(output, /<span class="math-nowrap">a−\(b−c\) = a−b\+c<\/span>/)
  assert.equal((output.match(/math-nowrap/g) || []).length, 2)
  // 英文句子没有数学运算符，保持普通折行
  assert.equal(formatMathText('He plays basketball every day.'), 'He plays basketball every day.')
})

test('带下划线的英语填空句不被整句禁止换行', () => {
  const output = formatMathText('He ______ to school by bike every day.')
  assert.equal(output, 'He ______ to school by bike every day.')
  assert.doesNotMatch(output, /math-nowrap/)
  // 短公式仍保持整块不拆行
  assert.match(formatMathText('若 2x+3=11'), /math-nowrap/)
})

test('物理化学常用记号与希腊字母不漏出反斜杠命令', () => {
  const output = formatMathText('2H₂ + O₂ \\xrightarrow{点燃} 2H₂O；ρ=\\frac{m}{V}，\\rho_{水}>\\rho_{冰}；\\sin A=\\frac{3}{5}；x\\ne0，a\\ge0，\\pi\\approx3.14，R=20\\,\\Omega，\\Delta t，O₂\\uparrow')
  assert.match(output, /—点燃/)
  assert.match(output, /→ 2H/)
  assert.match(output, /ρ/)
  assert.match(output, /ρ<sub>水<\/sub>&gt;ρ<sub>冰<\/sub>/)
  assert.match(output, /sin A=/)
  assert.match(output, /x≠0/)
  assert.match(output, /a≥0/)
  assert.match(output, /≈3\.14/)
  assert.match(output, /Ω/)
  assert.match(output, /Δ t/)
  assert.match(output, /↑/)
  assert.doesNotMatch(output, /\\[a-zA-Z]+/)
})

test('方程组、三次根号与百分号转成可读文本', () => {
  const output = formatMathText('\\begin{cases}2x+3y=19\\\\x+2y=11\\end{cases}，\\sqrt[3]{3}，占 50\\%')
  assert.match(output, /2x\+3y=19/)
  assert.match(output, /x\+2y=11/)
  assert.match(output, /∛\(3\)/)
  assert.match(output, /50%/)
  assert.doesNotMatch(output, /\\begin|\\end|\\sqrt|\\%/)
})
