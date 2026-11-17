import test from 'node:test'
import assert from 'node:assert/strict'
import { isChemicalEquation, judgeChemicalEquation, describeMissedTokens, describeEquation, describeExperiment, spokenToEquation } from './chemEquation.js'

test('isChemicalEquation 识别符号方程式', () => {
  assert.equal(isChemicalEquation('C + O₂（点燃）→ CO₂'), true)
  assert.equal(isChemicalEquation('2H₂ + O₂ = 2H₂O'), true)
  assert.equal(isChemicalEquation('夫君子之行，静以修身。'), false)
  assert.equal(isChemicalEquation('床前明月光，疑是地上霜。'), false)
})

test('碳加氧气点燃生成二氧化碳 判定为对', () => {
  const r = judgeChemicalEquation('C + O₂（点燃）→ CO₂', '碳加氧气点燃生成二氧化碳')
  assert.equal(r.ok, true)
  assert.equal(r.rate, 1)
})

test('氧气加碳点燃生成二氧化碳（顺序颠倒）也算对', () => {
  const r = judgeChemicalEquation('C + O₂（点燃）→ CO₂', '氧气和碳在点燃的条件下生成二氧化碳')
  assert.equal(r.ok, true)
})

test('同义别名：石灰水（Ca(OH)₂）', () => {
  const r = judgeChemicalEquation('CO₂ + Ca(OH)₂ → CaCO₃↓ + H₂O', '二氧化碳和石灰水反应生成碳酸钙和水')
  assert.equal(r.ok, true)
})

test('双氧水 / 过氧化氢 别名', () => {
  const r = judgeChemicalEquation('2H₂O₂ → 2H₂O + O₂↑', '双氧水分解生成水和氧气')
  assert.equal(r.ok, true)
})

test('漏了生成物被判错，并指出缺什么', () => {
  const r = judgeChemicalEquation('C + O₂（点燃）→ CO₂', '碳和氧气点燃')
  assert.equal(r.ok, false)
  assert.deepEqual(r.missed, ['CO₂'])
  assert.deepEqual(describeMissedTokens(r.missed), ['二氧化碳'])
})

test('只念了一半也应指出缺失', () => {
  const r = judgeChemicalEquation('4P + 5O₂（点燃）→ 2P₂O₅', '磷和氧气点燃生成五氧化二磷')
  assert.equal(r.ok, true)
})

test('完全无关内容被判错', () => {
  const r = judgeChemicalEquation('C + O₂（点燃）→ CO₂', '今天天气很好')
  assert.equal(r.ok, false)
})

test('describeMissedTokens 翻译缺失词元', () => {
  assert.deepEqual(describeMissedTokens(['CO₂', 'H₂O']), ['二氧化碳', '水'])
  assert.deepEqual(describeMissedTokens(['点燃']), ['点燃'])
})

test('配平系数不干扰：2H₂ + O₂ = 2H₂O', () => {
  const r = judgeChemicalEquation('2H₂ + O₂ = 2H₂O', '氢气和氧气生成水')
  assert.equal(r.ok, true)
})

test('加热条件：高锰酸钾制氧', () => {
  const r = judgeChemicalEquation('2KMnO₄ →（加热） K₂MnO₄ + MnO₂ + O₂↑', '高锰酸钾加热生成锰酸钾二氧化锰和氧气')
  assert.equal(r.ok, true)
})

test('催化剂：双氧水加二氧化锰', () => {
  const r = judgeChemicalEquation('2H₂O₂ →（MnO₂） 2H₂O + O₂↑', '过氧化氢在二氧化锰催化下生成水和氧气')
  assert.equal(r.ok, true)
})

test('酸与金属：铁和稀盐酸', () => {
  const r = judgeChemicalEquation('Fe + 2HCl → FeCl₂ + H₂↑', '铁和盐酸反应生成氯化亚铁和氢气')
  assert.equal(r.ok, true)
})

test('中和反应：盐酸和氢氧化钠', () => {
  const r = judgeChemicalEquation('HCl + NaOH → NaCl + H₂O', '盐酸和氢氧化钠反应生成氯化钠和水')
  assert.equal(r.ok, true)
})

test('碳酸钙与盐酸（沉淀/气体）', () => {
  const r = judgeChemicalEquation('CaCO₃ + 2HCl → CaCl₂ + H₂O + CO₂↑', '碳酸钙和盐酸反应生成氯化钙水和二氧化碳')
  assert.equal(r.ok, true)
})

test('缺条件但物质全，仍可判对（阈值 0.8 容错）', () => {
  // 原文 4 词元：C、O₂、点燃、CO₂；漏了「点燃」= 3/4 = 0.75，边界下判错
  const miss = judgeChemicalEquation('C + O₂（点燃）→ CO₂', '碳和氧气生成二氧化碳')
  assert.equal(miss.ok, false)
  // 5 词元缺 1 个 = 0.8，判对
  const five = judgeChemicalEquation('S + O₂（点燃）→ SO₂', '硫和氧气点燃生成二氧化硫')
  assert.equal(five.ok, true)
})

test('真实知识点格式 →(点燃) 也能识别', () => {
  assert.equal(isChemicalEquation('C + O₂ →(点燃) CO₂'), true)
  const r = judgeChemicalEquation('C + O₂ →(点燃) CO₂', '碳和氧气点燃生成二氧化碳')
  assert.equal(r.ok, true)
})

test('实验室制氧：2KClO₃ →(MnO₂、Δ) 2KCl + 3O₂↑', () => {
  const r = judgeChemicalEquation('2KClO₃ →(MnO₂、Δ) 2KCl + 3O₂↑', '氯酸钾在二氧化锰催化下加热生成氯化钾和氧气')
  assert.equal(r.ok, true)
})

test('金属置换盐：Fe + CuSO₄ → FeSO₄ + Cu', () => {
  const r = judgeChemicalEquation('Fe + CuSO₄ → FeSO₄ + Cu', '铁和硫酸铜反应生成硫酸亚铁和铜')
  assert.equal(r.ok, true)
})

test('ASR 同音错字容错：养气、二养化碳', () => {
  assert.equal(judgeChemicalEquation('C + O₂（点燃）→ CO₂', '碳加养气点燃生成二氧化碳').ok, true)
  assert.equal(judgeChemicalEquation('C + O₂（点燃）→ CO₂', '碳加氧气点燃生成二养化碳').ok, true)
})

test('describeEquation 生成口语读法', () => {
  assert.equal(describeEquation('C + O₂（点燃）→ CO₂'), '碳和氧气，点燃，生成二氧化碳')
  assert.equal(describeEquation('HCl + NaOH → NaCl + H₂O'), '盐酸和氢氧化钠，生成氯化钠和水')
})

test('describeExperiment 返回实验名 + 现象', () => {
  assert.match(describeExperiment('C + O₂（点燃）→ CO₂'), /碳在氧气中燃烧/)
  assert.match(describeExperiment('S + O₂ →(点燃) SO₂'), /蓝紫色火焰/)
  assert.match(describeExperiment('2H₂O →(通电) 2H₂↑ + O₂↑'), /电解水/)
  assert.match(describeExperiment('Fe + CuSO₄ → FeSO₄ + Cu'), /铁与硫酸铜/)
})

test('describeExperiment 无匹配时退回口语读法', () => {
  // 甲烷燃烧不在实验表里，退回 describeEquation
  const r = describeExperiment('CH₄ + 2O₂ → CO₂ + 2H₂O')
  assert.match(r, /甲烷和氧气/)
})

test('describeExperiment 现象提示不含配平/系数/化学式细节', () => {
  // 镁燃烧：只讲耀眼白光，不讲「Mg 前配 2」
  const mg = describeExperiment('2Mg + O₂ →(点燃) 2MgO')
  assert.match(mg, /耀眼白光/)
  assert.doesNotMatch(mg, /配|系数|Mg/)

  // 红磷：只讲白烟，不讲「P 前写 4」
  const p = describeExperiment('4P + 5O₂ →(点燃) 2P₂O₅')
  assert.match(p, /白烟/)
  assert.doesNotMatch(p, /配平|系数|P\s*前/)

  // 铁丝：只讲火星四射+黑色固体，不讲 Fe₃O₄ 符号
  const fe = describeExperiment('3Fe + 2O₂ →(点燃) Fe₃O₄')
  assert.match(fe, /火星四射/)
  assert.doesNotMatch(fe, /Fe₃O₄|Fe₂O₃/)
})

test('describeExperiment 覆盖新实验：氢气燃烧、高锰酸钾制氧、高温分解', () => {
  assert.match(describeExperiment('2H₂ + O₂ →(点燃) 2H₂O'), /淡蓝色火焰/)
  assert.match(describeExperiment('2KMnO₄ →(加热) K₂MnO₄ + MnO₂ + O₂↑'), /棉花/)
  assert.match(describeExperiment('CaCO₃ →(高温) CaO + CO₂↑'), /高温煅烧/)
})


test('spokenToEquation 把口语翻译成化学式', () => {
  assert.match(spokenToEquation('碳加氧气点燃生成二氧化碳'), /C\s*\+\s*O₂/)
  assert.match(spokenToEquation('碳加氧气点燃生成二氧化碳'), /CO₂/)
  assert.match(spokenToEquation('铁和盐酸反应生成氯化亚铁和氢气'), /Fe/)
  assert.match(spokenToEquation('铁和盐酸反应生成氯化亚铁和氢气'), /FeCl₂/)
  assert.match(spokenToEquation('水通电生成氢气和氧气'), /H₂O/)
  assert.match(spokenToEquation('水通电生成氢气和氧气'), /通电/)
})

test('spokenToEquation 同音错字也能翻译', () => {
  assert.match(spokenToEquation('碳加养气点燃生成二氧化碳'), /O₂/)
})





