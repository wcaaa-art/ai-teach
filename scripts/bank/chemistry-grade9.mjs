// 初三化学题库生成器：每章 4 类模板 × 10 道变体，答案由化学式、方程式或教材结论确定。
import { makeQuestion } from './helpers.mjs'

function gcd(a, b) {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}

function ratioText(values) {
  const divisor = values.reduce((acc, value) => gcd(acc, value))
  return values.map(value => value / divisor).join(':')
}

// 物质构成与化学用语：相对分子质量、元素质量比、化学式、原子构成
function chemicalLanguage() {
  const items = []
  const molarMasses = [
    ['H₂O', 'H-1、O-16', 2 * 1 + 16],
    ['CO₂', 'C-12、O-16', 12 + 2 * 16],
    ['NaCl', 'Na-23、Cl-35.5', 23 + 35.5],
    ['CaCO₃', 'Ca-40、C-12、O-16', 40 + 12 + 3 * 16],
    ['H₂SO₄', 'H-1、S-32、O-16', 2 * 1 + 32 + 4 * 16],
    ['NaOH', 'Na-23、O-16、H-1', 23 + 16 + 1],
    ['NH₄NO₃', 'N-14、H-1、O-16', 2 * 14 + 4 * 1 + 3 * 16],
    ['Ca(OH)₂', 'Ca-40、O-16、H-1', 40 + 2 * (16 + 1)],
    ['KMnO₄', 'K-39、Mn-55、O-16', 39 + 55 + 4 * 16],
    ['CH₄', 'C-12、H-1', 12 + 4 * 1]
  ]
  molarMasses.forEach(([formula, ar, answer], index) => {
    items.push(makeQuestion({
      stem: `已知相对原子质量 ${ar}，${formula} 的相对分子质量是（ ）`,
      correct: answer,
      wrongs: [answer + 2, answer - 2, answer * 2],
      hint: `把化学式中各原子的相对原子质量相加，${formula} 的相对分子质量为 ${answer}。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const ratios = [
    ['H₂O', 'H-1、O-16', 'H、O', [2, 16], '1:8', ['2:1', '1:16', '8:1']],
    ['CO₂', 'C-12、O-16', 'C、O', [12, 32], '3:8', ['1:2', '12:16', '8:3']],
    ['CaCO₃', 'Ca-40、C-12、O-16', 'Ca、C、O', [40, 12, 48], '10:3:12', ['1:1:3', '10:12:3', '3:10:12']],
    ['H₂SO₄', 'H-1、S-32、O-16', 'H、S、O', [2, 32, 64], '1:16:32', ['1:32:16', '2:1:4', '32:16:1']],
    ['NH₄NO₃', 'N-14、H-1、O-16', 'N、H、O', [28, 4, 48], '7:1:12', ['7:12:1', '1:4:3', '14:4:16']],
    ['CH₄', 'C-12、H-1', 'C、H', [12, 4], '3:1', ['1:4', '1:3', '4:12']],
    ['NaOH', 'Na-23、O-16、H-1', 'Na、O、H', [23, 16, 1], '23:16:1', ['1:16:23', '23:1:16', '40:16:1']],
    ['Ca(OH)₂', 'Ca-40、O-16、H-1', 'Ca、O、H', [40, 32, 2], '20:16:1', ['20:1:16', '40:16:2', '2:16:1']],
    ['Al₂O₃', 'Al-27、O-16', 'Al、O', [54, 48], '9:8', ['27:16', '2:3', '8:9']],
    ['Fe₂O₃', 'Fe-56、O-16', 'Fe、O', [112, 48], '7:3', ['56:16', '2:3', '3:7']]
  ]
  ratios.forEach(([formula, ar, elements, values, answer, wrongs], index) => {
    items.push(makeQuestion({
      stem: `已知相对原子质量 ${ar}，${formula} 中 ${elements} 元素的质量比是（ ）`,
      correct: answer,
      wrongs,
      hint: `各元素质量等于相对原子质量乘原子个数，化简后为 ${ratioText(values)}，即 ${answer}。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 10
    }))
  })
  const formulas = [
    ['氯化钠', '钠', 1, '氯', 1, 'NaCl', ['NaCl₂', 'Na₂Cl', 'NaCl₃']],
    ['氯化钙', '钙', 2, '氯', 1, 'CaCl₂', ['CaCl', 'Ca₂Cl', 'CaCl₃']],
    ['氧化铝', '铝', 3, '氧', 2, 'Al₂O₃', ['AlO', 'Al₂O', 'AlO₃']],
    ['氯化铁', '铁', 3, '氯', 1, 'FeCl₃', ['FeCl', 'FeCl₂', 'Fe₂Cl₃']],
    ['氧化亚铁', '铁', 2, '氧', 2, 'FeO', ['Fe₂O', 'FeO₂', 'Fe₂O₃']],
    ['氧化铁', '铁', 3, '氧', 2, 'Fe₂O₃', ['FeO', 'Fe₃O₂', 'Fe₂O']],
    ['氧化铜', '铜', 2, '氧', 2, 'CuO', ['Cu₂O', 'CuO₂', 'Cu₂O₃']],
    ['氧化镁', '镁', 2, '氧', 2, 'MgO', ['Mg₂O', 'MgO₂', 'Mg₂O₃']],
    ['二氧化硫', '硫', 4, '氧', 2, 'SO₂', ['SO', 'SO₃', 'S₂O']],
    ['氧化锌', '锌', 2, '氧', 2, 'ZnO', ['Zn₂O', 'ZnO₂', 'Zn₂O₃']]
  ]
  formulas.forEach(([name, first, firstValue, second, secondValue, answer, wrongs], index) => {
    items.push(makeQuestion({
      stem: `已知 ${first}元素的化合价为 +${firstValue}，${second}元素的化合价为 -${secondValue}，则${name}的化学式是（ ）`,
      correct: answer,
      wrongs,
      hint: `根据化合物中各元素正负化合价代数和为零，${name}的化学式为 ${answer}。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  const atoms = [[6, 6], [8, 8], [11, 12], [17, 18], [20, 20], [26, 30], [29, 35], [12, 12], [19, 20], [1, 0]]
  atoms.forEach(([protons, neutrons], index) => {
    const answer = protons + neutrons
    items.push(makeQuestion({
      stem: `某原子的质子数为 ${protons}，中子数为 ${neutrons}，该原子的相对原子质量约为（ ）`,
      correct: answer,
      wrongs: [answer + 1, answer + 2, answer - 1],
      hint: `相对原子质量约等于质子数加中子数：${protons} + ${neutrons} = ${answer}。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 30
    }))
  })
  return items
}

// 化学方程式：配平、质量守恒、质量比、质量守恒的微观解释
function chemicalEquations() {
  const items = []
  const equations = [
    ['____H₂ + ____O₂ →(点燃) ____H₂O', '2、1、2', ['1、1、1', '2、2、2', '1、2、1'], '左边 H 4 个、O 2 个，右边需 2 个 H₂O，系数为 2、1、2。'],
    ['____C + ____O₂ →(点燃) ____CO₂', '1、1、1', ['2、1、2', '1、2、1', '2、2、1'], '碳、氧原子个数已相等，系数为 1、1、1。'],
    ['____P + ____O₂ →(点燃) ____P₂O₅', '4、5、2', ['2、3、1', '4、3、2', '2、5、4'], '生成 2 个 P₂O₅ 需 4 个 P、10 个 O，系数为 4、5、2。'],
    ['____Fe + ____O₂ →(点燃) ____Fe₃O₄', '3、2、1', ['2、3、1', '3、4、1', '1、2、1'], 'Fe₃O₄ 中有 3 个 Fe、4 个 O，系数为 3、2、1。'],
    ['____CH₄ + ____O₂ →(点燃) ____CO₂ + ____H₂O', '1、2、1、2', ['1、1、1、1', '2、2、2、2', '1、2、2、1'], '1 个 CH₄ 含 C 1、H 4，需 O₂ 2 个，生成 CO₂ 1 个、H₂O 2 个。'],
    ['____H₂O₂ →(MnO₂) ____H₂O + ____O₂', '2、2、1', ['1、1、1', '2、1、2', '1、2、1'], '2 个 H₂O₂ 分解生成 2 个 H₂O 和 1 个 O₂。'],
    ['____KClO₃ →(MnO₂、加热) ____KCl + ____O₂', '2、2、3', ['1、1、2', '2、2、1', '2、3、2'], '2 个 KClO₃ 生成 2 个 KCl 和 3 个 O₂。'],
    ['____Al + ____O₂ →(点燃) ____Al₂O₃', '4、3、2', ['2、3、1', '4、2、2', '3、4、2'], '2 个 Al₂O₃ 需 4 个 Al、6 个 O，系数为 4、3、2。'],
    ['____CO + ____O₂ →(点燃) ____CO₂', '2、1、2', ['1、1、1', '1、2、1', '2、2、1'], '2 个 CO 与 1 个 O₂ 生成 2 个 CO₂。'],
    ['____Mg + ____O₂ →(点燃) ____MgO', '2、1、2', ['1、1、1', '2、2、1', '1、2、1'], '2 个 Mg 与 1 个 O₂ 生成 2 个 MgO。']
  ]
  equations.forEach(([stem, answer, wrongs, hint], index) => {
    items.push(makeQuestion({
      stem: `配平化学方程式：${stem}，各物质前的化学计量数依次是（ ）`,
      correct: answer,
      wrongs,
      hint,
      difficulty: 2,
      dimension: 'method',
      seed: index
    }))
  })
  const conservation = [[5, 10, 3], [8, 12, 5], [20, 30, 10], [6, 9, 4], [12, 8, 5], [15, 25, 7], [4, 16, 6], [18, 2, 8], [7, 13, 9], [25, 5, 10]]
  conservation.forEach(([a, b, d], index) => {
    const c = a + b - d
    items.push(makeQuestion({
      stem: `甲、乙在一定条件下恰好完全反应生成丙和丁。已知参加反应的甲为 ${a} g、乙为 ${b} g，生成丁 ${d} g，则生成丙的质量是（ ）`,
      correct: `${c} g`,
      wrongs: [`${c + 2} g`, `${c - 2} g`, `${a + b + d} g`],
      hint: `由质量守恒定律，反应物总质量等于生成物总质量：丙的质量 = ${a} + ${b} - ${d} = ${c} g。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const concepts = [
    { stem: '化学反应前后，一定不变的是（ ）', correct: '原子的种类和数目', pool: ['原子的种类和数目', '分子的种类', '分子的数目', '物质的种类'], hint: '化学反应中原子重新组合，原子的种类和数目不变。' },
    { stem: '化学反应前后，一定发生改变的是（ ）', correct: '分子的种类', pool: ['分子的种类', '原子的种类', '原子的数目', '元素种类'], hint: '旧分子分裂、新分子生成，分子种类一定改变。' },
    { stem: '化学反应前后，可能发生改变的是（ ）', correct: '分子的数目', pool: ['分子的数目', '原子的种类', '原子的数目', '元素的质量'], hint: '分子数目可能改变，也可能不变。' },
    { stem: '化学反应的实质是（ ）', correct: '分子分成原子，原子重新组合成新分子', pool: ['分子分成原子，原子重新组合成新分子', '分子直接合并成新分子', '原子分成更小的粒子', '元素种类发生改变'], hint: '化学变化中分子可分、原子不可分。' },
    { stem: '镁条在空气中燃烧后，生成物的质量比原来镁条大，原因是（ ）', correct: '镁与空气中的氧气发生了反应', pool: ['镁与空气中的氧气发生了反应', '镁条吸收了热量', '镁条体积变大', '生成了新的镁原子'], hint: '生成物中增加了氧元素的质量。' },
    { stem: '蜡烛燃烧后质量减小，原因是（ ）', correct: '生成的二氧化碳和水蒸气逸散到空气中', pool: ['生成的二氧化碳和水蒸气逸散到空气中', '蜡烛燃烧不遵守质量守恒定律', '蜡烛中的碳原子消失了', '蜡烛吸收了空气中的氧气'], hint: '反应生成的二氧化碳和水蒸气进入空气，未称量到。' },
    { stem: '质量守恒定律适用于（ ）', correct: '所有的化学变化', pool: ['所有的化学变化', '所有的物理变化', '只有燃烧反应', '只有化合反应'], hint: '质量守恒定律是化学反应的基本规律。' },
    { stem: '配平化学方程式的主要依据是（ ）', correct: '质量守恒定律', pool: ['质量守恒定律', '反应条件', '物质的颜色', '物质的溶解性'], hint: '配平使反应前后各种原子的数目相等，依据是质量守恒定律。' },
    { stem: '化学反应前后，元素的种类（ ）', correct: '不变', pool: ['不变', '增多', '减少', '无法确定'], hint: '原子种类不变，所以元素种类也不变。' },
    { stem: '化学反应前后，物质的质量总和不变，这是因为（ ）', correct: '原子的种类、数目和质量都不变', pool: ['原子的种类、数目和质量都不变', '分子的种类和数目都不变', '物质的体积不变', '反应前后温度不变'], hint: '原子三不变是质量守恒的微观原因。' }
  ]
  concepts.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: index >= 4 ? 'transfer' : 'concept',
      seed: index + 20
    }))
  })
  const massRatios = [
    ['2H₂ + O₂ →(点燃) 2H₂O', 'H-1、O-16', [4, 32], '1:8', ['8:1', '2:1', '1:16']],
    ['C + O₂ →(点燃) CO₂', 'C-12、O-16', [12, 32], '3:8', ['8:3', '1:2', '3:4']],
    ['4P + 5O₂ →(点燃) 2P₂O₅', 'P-31、O-16', [124, 160], '31:40', ['40:31', '31:80', '62:40']],
    ['3Fe + 2O₂ →(点燃) Fe₃O₄', 'Fe-56、O-16', [168, 64], '21:8', ['8:21', '21:16', '3:2']],
    ['CH₄ + 2O₂ →(点燃) CO₂ + 2H₂O', 'C-12、H-1、O-16', [16, 64], '1:4', ['4:1', '1:2', '16:32']],
    ['2H₂O₂ →(MnO₂) 2H₂O + O₂', 'H-1、O-16', [68, 36], '17:9', ['9:17', '17:18', '34:9']],
    ['2KClO₃ →(MnO₂、加热) 2KCl + 3O₂', 'K-39、Cl-35.5、O-16', [245, 96], '245:96', ['96:245', '245:192', '2:3']],
    ['4Al + 3O₂ →(点燃) 2Al₂O₃', 'Al-27、O-16', [108, 96], '9:8', ['8:9', '9:16', '27:32']],
    ['2CO + O₂ →(点燃) 2CO₂', 'C-12、O-16', [56, 32], '7:4', ['4:7', '7:8', '2:1']],
    ['2Mg + O₂ →(点燃) 2MgO', 'Mg-24、O-16', [48, 32], '3:2', ['2:3', '3:4', '1:2']]
  ]
  massRatios.forEach(([equation, ar, values, answer, wrongs], index) => {
    items.push(makeQuestion({
      stem: `已知相对原子质量 ${ar}，在反应 ${equation} 中，两种反应物的质量比是（ ）`,
      correct: answer,
      wrongs,
      hint: `按化学计量数计算质量：${values[0]} : ${values[1]}，化简得 ${ratioText(values)}，即 ${answer}。`,
      difficulty: 3,
      dimension: 'transfer',
      seed: index + 30
    }))
  })
  return items
}

// 空气与氧气：空气成分、燃烧现象、实验室制氧气
function airAndOxygen() {
  const items = []
  const oxygenVolumes = [100, 200, 500, 1000, 50, 250, 400, 150, 300, 800]
  oxygenVolumes.forEach((V, index) => {
    const answer = Number((V * 0.21).toFixed(3))
    items.push(makeQuestion({
      stem: `空气中氧气约占总体积的 21%。${V} L 空气中约含氧气（ ）`,
      correct: `${answer} L`,
      wrongs: [`${Number((V * 0.78).toFixed(3))} L`, `${Number((V * 0.42).toFixed(3))} L`, `${Number((V * 0.105).toFixed(3))} L`],
      hint: `氧气体积 = ${V} L × 21% = ${answer} L。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const nitrogenVolumes = [100, 200, 50, 500, 1000, 250, 400, 150, 300, 800]
  nitrogenVolumes.forEach((V, index) => {
    const answer = Number((V * 0.78).toFixed(3))
    items.push(makeQuestion({
      stem: `空气中氮气约占总体积的 78%。${V} L 空气中约含氮气（ ）`,
      correct: `${answer} L`,
      wrongs: [`${Number((V * 0.21).toFixed(3))} L`, `${Number((V * 1.56).toFixed(3))} L`, `${Number((V * 0.39).toFixed(3))} L`],
      hint: `氮气体积 = ${V} L × 78% = ${answer} L。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const combustion = [
    { stem: '硫在氧气中燃烧的现象是（ ）', correct: '发出蓝紫色火焰，生成有刺激性气味的气体', pool: ['发出蓝紫色火焰，生成有刺激性气味的气体', '发出淡蓝色火焰，生成无色气体', '火星四射，生成黑色固体', '产生大量白烟，生成白色固体'], hint: '硫在氧气中燃烧发出蓝紫色火焰，生成二氧化硫。' },
    { stem: '硫在空气中燃烧的现象是（ ）', correct: '发出淡蓝色火焰', pool: ['发出淡蓝色火焰', '发出蓝紫色火焰', '火星四射', '产生大量白烟'], hint: '空气中氧气浓度较低，硫燃烧呈淡蓝色火焰。' },
    { stem: '红磷在空气中燃烧的现象是（ ）', correct: '产生大量白烟，放出热量', pool: ['产生大量白烟，放出热量', '发出蓝紫色火焰', '火星四射，生成黑色固体', '发出白光，生成无色气体'], hint: '红磷燃烧生成五氧化二磷白色固体小颗粒，形成白烟。' },
    { stem: '铁丝在氧气中燃烧的现象是（ ）', correct: '剧烈燃烧，火星四射，生成黑色固体', pool: ['剧烈燃烧，火星四射，生成黑色固体', '发出蓝紫色火焰，生成刺激性气体', '产生大量白烟', '发出白光，生成无色气体'], hint: '铁在氧气中燃烧生成四氧化三铁黑色固体。' },
    { stem: '木炭在氧气中燃烧的现象是（ ）', correct: '发出白光，放出热量', pool: ['发出白光，放出热量', '发出蓝紫色火焰', '产生大量白烟', '火星四射'], hint: '木炭在氧气中充分燃烧发出白光，生成二氧化碳。' },
    { stem: '镁条在空气中燃烧的现象是（ ）', correct: '发出耀眼的白光，生成白色固体', pool: ['发出耀眼的白光，生成白色固体', '发出淡蓝色火焰', '产生大量白烟，无白光', '火星四射，生成黑色固体'], hint: '镁燃烧发出耀眼白光，生成氧化镁白色固体。' },
    { stem: '氧气能支持燃烧，这说明氧气具有（ ）', correct: '助燃性', pool: ['助燃性', '可燃性', '还原性', '腐蚀性'], hint: '氧气本身不能燃烧，但能支持其他物质燃烧。' },
    { stem: '检验一瓶气体是否为氧气，应该用（ ）', correct: '带火星的木条', pool: ['带火星的木条', '燃着的木条', '澄清石灰水', '紫色石蕊溶液'], hint: '带火星的木条在氧气中复燃，可用于检验氧气。' },
    { stem: '下列氧气的用途中，利用其支持燃烧性质的是（ ）', correct: '用于炼钢和焊接金属', pool: ['用于炼钢和焊接金属', '用于医疗急救', '用于潜水供氧', '用于高空飞行供氧'], hint: '炼钢、焊接利用氧气支持燃烧的性质。' },
    { stem: '关于氧气的物理性质，下列说法正确的是（ ）', correct: '无色无味的气体，不易溶于水', pool: ['无色无味的气体，不易溶于水', '有刺激性气味的气体，易溶于水', '淡蓝色气体，易溶于水', '无色气体，易溶于水'], hint: '氧气是无色无味、不易溶于水的气体。' }
  ]
  combustion.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 20
    }))
  })
  const preparation = [
    { stem: '用过氧化氢溶液制取氧气时，二氧化锰的作用是（ ）', correct: '催化剂', pool: ['催化剂', '反应物', '生成物', '溶剂'], hint: '二氧化锰改变反应速率，本身质量和化学性质不变，是催化剂。' },
    { stem: '实验室用高锰酸钾制取氧气时，需要（ ）', correct: '加热', pool: ['加热', '通电', '加入二氧化锰', '通入二氧化碳'], hint: '高锰酸钾制氧气需要加热分解。' },
    { stem: '收集氧气可以采用向上排空气法，依据是氧气（ ）', correct: '密度比空气略大', pool: ['密度比空气略大', '密度比空气小', '易溶于水', '能与空气反应'], hint: '密度比空气大的气体可用向上排空气法收集。' },
    { stem: '收集氧气可以采用排水法，依据是氧气（ ）', correct: '不易溶于水', pool: ['不易溶于水', '易溶于水', '密度比水大', '能与水反应'], hint: '不易溶于水且不与水反应的气体可用排水法收集。' },
    { stem: '用高锰酸钾制氧气时，试管口要略向下倾斜，目的是（ ）', correct: '防止冷凝水回流使试管炸裂', pool: ['防止冷凝水回流使试管炸裂', '便于观察反应', '加快反应速率', '防止氧气逸出'], hint: '试管口向下倾斜可避免冷凝水倒流炸裂试管。' },
    { stem: '催化剂在化学反应前后的变化是（ ）', correct: '质量和化学性质都不变', pool: ['质量和化学性质都不变', '质量和化学性质都改变', '质量改变、化学性质不变', '质量不变、化学性质改变'], hint: '催化剂的特点是一变两不变：改变速率，质量和化学性质不变。' },
    { stem: '实验室用过氧化氢溶液制取氧气，应选择的发生装置是（ ）', correct: '固体与液体常温反应装置', pool: ['固体与液体常温反应装置', '固体加热反应装置', '电解装置', '过滤装置'], hint: '过氧化氢与二氧化锰在常温下反应，不需要加热。' },
    { stem: '用向上排空气法收集氧气时，验满的方法是（ ）', correct: '把带火星的木条放在集气瓶口', pool: ['把带火星的木条放在集气瓶口', '把带火星的木条伸入瓶底', '把燃着的木条伸入瓶中', '向瓶中倒入澄清石灰水'], hint: '木条放在瓶口复燃说明氧气已收集满。' },
    { stem: '实验室制取气体时，装药品前应先（ ）', correct: '检查装置的气密性', pool: ['检查装置的气密性', '给试管加热', '收集气体', '连接导管'], hint: '先检查气密性，防止装置漏气。' },
    { stem: '排水法收集氧气结束时，应先（ ）', correct: '把导管移出水面，再熄灭酒精灯', pool: ['把导管移出水面，再熄灭酒精灯', '熄灭酒精灯，再把导管移出水面', '先拆下集气瓶，再熄灭酒精灯', '先关闭分液漏斗，再熄灭酒精灯'], hint: '先撤导管后熄灯，防止水倒吸入试管。' }
  ]
  preparation.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 30
    }))
  })
  return items
}

// 水与溶液：电解水、溶质质量分数、溶液稀释、溶液概念
function waterAndSolutions() {
  const items = []
  const hydrogenVolumes = [10, 20, 30, 40, 50, 60, 100, 200, 8, 12]
  hydrogenVolumes.forEach((V, index) => {
    items.push(makeQuestion({
      stem: `电解水时，若生成氢气的体积为 ${V} mL，则生成氧气的体积约为（ ）`,
      correct: `${V / 2} mL`,
      wrongs: [`${V * 2} mL`, `${V / 4} mL`, `${V + 5} mL`],
      hint: `电解水生成氢气与氧气的体积比约为 2:1，氧气体积 = ${V} ÷ 2 = ${V / 2} mL。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const solutions = [[10, 90], [20, 80], [15, 85], [5, 95], [25, 75], [30, 120], [50, 150], [8, 32], [12, 108], [40, 160]]
  solutions.forEach(([solute, solvent], index) => {
    const total = solute + solvent
    const answer = (solute / total) * 100
    items.push(makeQuestion({
      stem: `把 ${solute} g 食盐完全溶解在 ${solvent} g 水中，所得溶液的溶质质量分数是（ ）`,
      correct: `${answer}%`,
      wrongs: [`${answer + 5}%`, `${answer + 10}%`, `${100 - answer}%`],
      hint: `溶质质量分数 = 溶质质量 ÷ 溶液质量 × 100% = ${solute} ÷ (${solute} + ${solvent}) × 100% = ${answer}%。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const dilutions = [[100, 20, 10], [200, 10, 5], [100, 30, 10], [50, 20, 5], [200, 20, 10], [100, 10, 2], [150, 20, 10], [80, 25, 10], [60, 30, 15], [300, 10, 5]]
  dilutions.forEach(([m, w1, w2], index) => {
    const answer = (m * w1) / w2 - m
    items.push(makeQuestion({
      stem: `将 ${m} g 质量分数为 ${w1}% 的溶液稀释成质量分数为 ${w2}% 的溶液，需要加入水的质量是（ ）`,
      correct: `${answer} g`,
      wrongs: [`${answer * 2} g`, `${answer / 2} g`, `${answer + 50} g`],
      hint: `稀释前后溶质质量不变：${m} × ${w1}% = (${m} + x) × ${w2}%，解得 x = ${answer} g。`,
      difficulty: 3,
      dimension: 'method',
      seed: index + 20
    }))
  })
  const concepts = [
    { stem: '溶液的基本特征是（ ）', correct: '均一、稳定的混合物', pool: ['均一、稳定的混合物', '均一、稳定的化合物', '不均一、不稳定的混合物', '纯净物'], hint: '溶液是溶质分散在溶剂中形成的均一、稳定的混合物。' },
    { stem: '在一定温度下，不能再溶解某种溶质的溶液叫做该溶质的（ ）', correct: '饱和溶液', pool: ['饱和溶液', '不饱和溶液', '浓溶液', '稀溶液'], hint: '一定温度下不能再溶解该溶质，说明已达到饱和。' },
    { stem: '固体物质的溶解度通常是指在一定温度下，100 g（ ）中最多溶解的溶质质量', correct: '溶剂', pool: ['溶剂', '溶液', '水', '混合物'], hint: '溶解度以 100 g 溶剂为标准，通常溶剂是水。' },
    { stem: '汽油能洗去衣服上的油污，是因为（ ）', correct: '油污能溶解在汽油中', pool: ['油污能溶解在汽油中', '汽油与水发生反应', '汽油具有乳化作用', '汽油能挥发'], hint: '汽油是有机溶剂，油污可溶解在其中。' },
    { stem: '洗涤剂能除去餐具上的油污，主要是利用洗涤剂的（ ）', correct: '乳化作用', pool: ['乳化作用', '溶解作用', '吸附作用', '催化作用'], hint: '洗涤剂使油污分散成细小液滴，随水冲走。' },
    { stem: '硝酸铵固体溶于水时，溶液温度（ ）', correct: '降低', pool: ['降低', '升高', '不变', '先升高后降低'], hint: '硝酸铵溶解吸收热量，溶液温度降低。' },
    { stem: '氢氧化钠固体溶于水时，溶液温度（ ）', correct: '升高', pool: ['升高', '降低', '不变', '先降低后升高'], hint: '氢氧化钠溶解放出热量，溶液温度升高。' },
    { stem: '氯化钠溶于水时，溶液温度（ ）', correct: '基本不变', pool: ['基本不变', '明显升高', '明显降低', '先升高后降低'], hint: '氯化钠溶解时吸放热不明显，温度基本不变。' },
    { stem: '从溶液中获得晶体的常用方法是（ ）', correct: '蒸发溶剂或降低温度', pool: ['蒸发溶剂或降低温度', '升高温度或增加溶剂', '过滤或静置', '加水或加热'], hint: '蒸发溶剂、降温都能使溶质结晶析出。' },
    { stem: '过滤操作主要用于分离（ ）', correct: '不溶性固体和液体', pool: ['不溶性固体和液体', '两种互溶的液体', '可溶性固体和液体', '气体和液体'], hint: '过滤只能分离不溶性固体与液体。' }
  ]
  concepts.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 30
    }))
  })
  return items
}

// 金属与酸碱盐：金属与酸反应、金属活动性、酸碱与 pH、盐的性质
function metalsAcidsBasesSalts() {
  const items = []
  const zincMasses = [6.5, 13, 19.5, 26, 32.5, 3.25, 65, 9.75, 16.25, 39]
  zincMasses.forEach((m, index) => {
    const answer = Number(((m * 2) / 65).toFixed(4))
    items.push(makeQuestion({
      stem: `已知相对原子质量 Zn-65、H-1，${m} g 锌与足量稀盐酸完全反应，生成氢气的质量是（ ）`,
      correct: `${answer} g`,
      wrongs: [`${Number((answer * 2).toFixed(4))} g`, `${Number((answer / 2).toFixed(4))} g`, `${Number((answer + 0.05).toFixed(4))} g`],
      hint: `Zn + 2HCl → ZnCl₂ + H₂↑，65 份锌生成 2 份氢气，所以氢气质量 = ${m} × 2/65 = ${answer} g。`,
      difficulty: 3,
      dimension: 'method',
      seed: index
    }))
  })
  const activity = [
    { stem: '金属活动性顺序中，排在氢前面的金属能（ ）', correct: '与稀盐酸反应放出氢气', pool: ['与稀盐酸反应放出氢气', '与稀硫酸反应放出氧气', '与水反应生成氢气', '与所有盐溶液反应'], hint: '氢前金属能与稀酸反应生成氢气。' },
    { stem: '下列金属活动性由强到弱的顺序正确的是（ ）', correct: '镁 > 锌 > 铁 > 铜', pool: ['镁 > 锌 > 铁 > 铜', '铜 > 铁 > 锌 > 镁', '铁 > 镁 > 铜 > 锌', '锌 > 镁 > 铜 > 铁'], hint: '金属活动性顺序为 K Ca Na Mg Al Zn Fe Sn Pb (H) Cu Hg Ag Pt Au。' },
    { stem: '把铁钉放入硫酸铜溶液中，铁钉表面（ ）', correct: '附着一层红色物质', pool: ['附着一层红色物质', '附着一层黑色物质', '无明显变化', '产生大量气泡'], hint: '铁置换出铜，铜附着在铁钉表面呈红色。' },
    { stem: '铜不能与稀盐酸反应，是因为铜（ ）', correct: '排在氢的后面', pool: ['排在氢的后面', '排在氢的前面', '不是金属', '表面有氧化膜'], hint: '氢后金属不能置换出酸中的氢。' },
    { stem: '湿法冶金中，用铁从硫酸铜溶液中置换铜，说明（ ）', correct: '铁的活动性比铜强', pool: ['铁的活动性比铜强', '铜的活动性比铁强', '铁比铜活泼性弱', '铁和铜活动性相同'], hint: '活动性强的金属能把活动性弱的金属从其盐溶液中置换出来。' },
    { stem: '铝制品在空气中具有良好的抗腐蚀性，是因为（ ）', correct: '铝表面生成致密的氧化铝薄膜', pool: ['铝表面生成致密的氧化铝薄膜', '铝不与氧气反应', '铝的密度小', '铝是银白色金属'], hint: '氧化铝薄膜阻止内部铝继续被氧化。' },
    { stem: '一般情况下，合金的硬度比组成它的纯金属（ ）', correct: '大', pool: ['大', '小', '相同', '无法比较'], hint: '合金的硬度一般大于成分金属，熔点一般低于成分金属。' },
    { stem: '生铁和钢都是铁的合金，它们的区别主要在于（ ）', correct: '含碳量不同', pool: ['含碳量不同', '含铁量不同', '颜色不同', '密度不同'], hint: '生铁含碳量 2%~4.3%，钢含碳量 0.03%~2%。' },
    { stem: '铁生锈的条件是铁同时与（ ）接触', correct: '氧气和水', pool: ['氧气和水', '氧气和二氧化碳', '水和二氧化碳', '氮气和水'], hint: '铁在潮湿的空气中与氧气和水共同作用而锈蚀。' },
    { stem: '下列做法中，能防止铁制品生锈的是（ ）', correct: '在铁制品表面涂油漆', pool: ['在铁制品表面涂油漆', '把铁制品浸在水中', '把铁制品放在潮湿处', '用刀刮去铁制品表面'], hint: '涂油漆隔绝氧气和水，可防止铁生锈。' }
  ]
  activity.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: index >= 4 ? 'transfer' : 'concept',
      seed: index + 10
    }))
  })
  const acidBase = [
    { stem: '当溶液的 pH 小于 7 时，该溶液呈（ ）', correct: '酸性', pool: ['酸性', '碱性', '中性', '无法判断'], hint: 'pH < 7 呈酸性，pH = 7 呈中性，pH > 7 呈碱性。' },
    { stem: '当溶液的 pH 等于 7 时，该溶液呈（ ）', correct: '中性', pool: ['中性', '酸性', '碱性', '强酸性'], hint: 'pH = 7 时溶液呈中性。' },
    { stem: '当溶液的 pH 大于 7 时，该溶液呈（ ）', correct: '碱性', pool: ['碱性', '酸性', '中性', '弱酸性'], hint: 'pH > 7 时溶液呈碱性。' },
    { stem: '紫色石蕊溶液遇到酸性溶液会（ ）', correct: '变红', pool: ['变红', '变蓝', '不变色', '褪色'], hint: '紫色石蕊遇酸变红，遇碱变蓝。' },
    { stem: '无色酚酞溶液遇到碱性溶液会（ ）', correct: '变红', pool: ['变红', '变蓝', '不变色', '变黄'], hint: '无色酚酞遇碱变红，遇酸和中性溶液不变色。' },
    { stem: '人体胃液中含有的酸主要是（ ）', correct: '盐酸', pool: ['盐酸', '硫酸', '硝酸', '醋酸'], hint: '胃酸的主要成分是盐酸。' },
    { stem: '氢氧化钠的俗称是（ ）', correct: '烧碱、火碱、苛性钠', pool: ['烧碱、火碱、苛性钠', '熟石灰、消石灰', '纯碱、苏打', '小苏打'], hint: '氢氧化钠俗称烧碱、火碱、苛性钠。' },
    { stem: '氢氧化钙的俗称是（ ）', correct: '熟石灰、消石灰', pool: ['熟石灰、消石灰', '烧碱、火碱', '纯碱、苏打', '小苏打'], hint: '氢氧化钙俗称熟石灰、消石灰。' },
    { stem: '酸与碱作用生成盐和水的反应叫做（ ）', correct: '中和反应', pool: ['中和反应', '化合反应', '分解反应', '置换反应'], hint: '酸与碱生成盐和水的反应属于中和反应。' },
    { stem: '用 pH 试纸测定溶液 pH 时，正确的操作是（ ）', correct: '用玻璃棒蘸取待测液滴在试纸上，再与标准比色卡比较', pool: ['用玻璃棒蘸取待测液滴在试纸上，再与标准比色卡比较', '先把试纸用水润湿，再蘸取待测液', '把试纸直接浸入待测液中充分反应', '把待测液倒入试纸上加热'], hint: 'pH 试纸不能润湿，也不能浸入待测液，以免污染或稀释。' }
  ]
  acidBase.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: index >= 8 ? 'error-analysis' : 'concept',
      seed: index + 20
    }))
  })
  const salts = [
    { stem: '复分解反应能够发生的条件是生成物中有（ ）', correct: '沉淀、气体或水', pool: ['沉淀、气体或水', '沉淀或气体', '气体或水', '单质或氧化物'], hint: '生成沉淀、气体或水，复分解反应才能发生。' },
    { stem: '碳酸钠与稀盐酸反应时的现象是（ ）', correct: '产生大量气泡', pool: ['产生大量气泡', '生成蓝色沉淀', '生成白色沉淀', '溶液变红'], hint: '碳酸钠与盐酸反应放出二氧化碳气体。' },
    { stem: '硫酸铜溶液与氢氧化钠溶液反应时的现象是（ ）', correct: '生成蓝色沉淀', pool: ['生成蓝色沉淀', '生成白色沉淀', '产生大量气泡', '无明显现象'], hint: '生成氢氧化铜蓝色沉淀。' },
    { stem: '氯化钡溶液与硫酸钠溶液反应时的现象是（ ）', correct: '生成白色沉淀', pool: ['生成白色沉淀', '生成蓝色沉淀', '产生大量气泡', '溶液变黄'], hint: '生成硫酸钡白色沉淀。' },
    { stem: '石灰石的主要成分是（ ）', correct: '碳酸钙', pool: ['碳酸钙', '氧化钙', '氢氧化钙', '碳酸钠'], hint: '石灰石、大理石的主要成分是碳酸钙。' },
    { stem: '食盐的主要成分是（ ）', correct: '氯化钠', pool: ['氯化钠', '碳酸钠', '碳酸氢钠', '氢氧化钠'], hint: '食盐的主要成分是氯化钠。' },
    { stem: '碳酸钠的俗称是（ ）', correct: '纯碱、苏打', pool: ['纯碱、苏打', '烧碱、火碱', '小苏打', '熟石灰'], hint: '碳酸钠俗称纯碱、苏打。' },
    { stem: '碳酸氢钠的俗称是（ ）', correct: '小苏打', pool: ['小苏打', '纯碱', '烧碱', '熟石灰'], hint: '碳酸氢钠俗称小苏打。' },
    { stem: '在复分解反应中，各元素化合价（ ）', correct: '保持不变', pool: ['保持不变', '一定升高', '一定降低', '有升有降'], hint: '复分解反应是两种化合物互相交换成分，化合价不变。' },
    { stem: '盐是由（ ）构成的化合物', correct: '金属离子或铵根离子和酸根离子', pool: ['金属离子或铵根离子和酸根离子', '金属离子和氢氧根离子', '氢离子和酸根离子', '金属离子和氧离子'], hint: '盐由金属离子（或铵根离子）与酸根离子构成。' }
  ]
  salts.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 2,
      dimension: 'concept',
      seed: index + 30
    }))
  })
  return items
}

// 化学实验与探究：仪器操作、过滤蒸发、气体制取、现象与误差
function experiments() {
  const items = []
  const operations = [
    { stem: '给试管中的液体加热时，液体体积不应超过试管容积的（ ）', correct: '1/3', pool: ['1/3', '1/2', '2/3', '3/4'], hint: '加热时液体过多容易沸腾溅出，体积不超过试管容积的 1/3。' },
    { stem: '使用酒精灯加热时，应使用火焰的（ ）', correct: '外焰', pool: ['外焰', '内焰', '焰心', '任意部位'], hint: '外焰温度最高，应使用外焰加热。' },
    { stem: '熄灭酒精灯的正确方法是（ ）', correct: '用灯帽盖灭', pool: ['用灯帽盖灭', '用嘴吹灭', '用水浇灭', '用湿抹布擦灭'], hint: '用嘴吹可能导致火焰进入灯内，应用灯帽盖灭。' },
    { stem: '用量筒量取液体时，读数视线应与（ ）相平', correct: '凹液面的最低处', pool: ['凹液面的最低处', '凹液面的最高处', '量筒口', '液面任意位置'], hint: '视线与凹液面最低处相平，读数才准确。' },
    { stem: '取用粉末状固体药品时，应使用（ ）', correct: '药匙或纸槽', pool: ['药匙或纸槽', '镊子', '胶头滴管', '玻璃棒'], hint: '粉末状固体用药匙或纸槽送入试管。' },
    { stem: '使用胶头滴管滴加液体时，滴管应（ ）', correct: '垂直悬空在试管口上方', pool: ['垂直悬空在试管口上方', '伸入试管内壁', '接触试管内液体', '平放在桌面上'], hint: '滴管不能伸入试管或接触内壁，防止污染。' },
    { stem: '向试管中倾倒液体时，试剂瓶的标签应（ ）', correct: '朝向手心', pool: ['朝向手心', '朝向自己', '朝向外侧', '随意朝向'], hint: '标签朝向手心，防止残液流下腐蚀标签。' },
    { stem: '用托盘天平称量药品时，应遵循（ ）', correct: '左物右码', pool: ['左物右码', '左码右物', '左右随意', '药品直接放在托盘上'], hint: '左盘放物品，右盘放砝码。' },
    { stem: '给试管加热时，试管夹应（ ）', correct: '从试管底部往上套', pool: ['从试管底部往上套', '从试管口往下套', '夹在试管中部', '夹住试管口'], hint: '试管夹从底部往上套，夹在试管中上部。' },
    { stem: '给试管加热时，试管口应（ ）', correct: '不对着人', pool: ['不对着人', '对着自己', '对着同桌', '朝下'], hint: '防止液体沸腾溅出伤人。' }
  ]
  operations.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const filtration = [
    { stem: '过滤操作中，玻璃棒的作用是（ ）', correct: '引流', pool: ['引流', '搅拌加快溶解', '防止液体飞溅', '增大过滤速度'], hint: '过滤时玻璃棒用于引流，防止液体溅出。' },
    { stem: '过滤操作要做到“一贴、二低、三靠”，其中“一贴”是指（ ）', correct: '滤纸紧贴漏斗内壁', pool: ['滤纸紧贴漏斗内壁', '漏斗紧贴烧杯内壁', '玻璃棒紧贴滤纸', '液面紧贴滤纸边缘'], hint: '滤纸紧贴漏斗内壁，防止气泡影响过滤速度。' },
    { stem: '过滤时，漏斗下端管口应（ ）', correct: '紧靠烧杯内壁', pool: ['紧靠烧杯内壁', '悬在烧杯中央', '伸入滤液中', '对准玻璃棒'], hint: '漏斗下端紧靠烧杯内壁，防止滤液飞溅。' },
    { stem: '蒸发食盐水时，玻璃棒的作用是（ ）', correct: '搅拌，防止局部过热造成液滴飞溅', pool: ['搅拌，防止局部过热造成液滴飞溅', '引流', '加快水分蒸发', '过滤杂质'], hint: '蒸发时用玻璃棒不断搅拌，使液体受热均匀。' },
    { stem: '蒸发操作中，当出现较多固体时，应（ ）', correct: '停止加热，利用余热蒸干', pool: ['停止加热，利用余热蒸干', '继续加热至完全干燥', '立即加入冷水', '用玻璃棒刮出固体'], hint: '出现较多固体时停止加热，防止固体飞溅。' },
    { stem: '过滤操作不能分离的是（ ）', correct: '可溶性固体和液体', pool: ['可溶性固体和液体', '不溶性固体和液体', '泥沙和水', '沉淀和溶液'], hint: '过滤只能分离不溶性固体与液体。' },
    { stem: '过滤时，液面应（ ）', correct: '低于滤纸边缘', pool: ['低于滤纸边缘', '高于滤纸边缘', '与滤纸边缘相平', '高于漏斗口'], hint: '液面低于滤纸边缘，防止液体从滤纸与漏斗间流下。' },
    { stem: '降低水的硬度，家庭中常用的方法是（ ）', correct: '煮沸', pool: ['煮沸', '过滤', '静置', '加入食盐'], hint: '煮沸能使可溶性钙镁化合物转化为沉淀，降低硬度。' },
    { stem: '下列净化水的方法中，净化程度最高的是（ ）', correct: '蒸馏', pool: ['蒸馏', '过滤', '吸附', '沉淀'], hint: '蒸馏可得到几乎纯净的水，净化程度最高。' },
    { stem: '蒸馏水属于（ ）', correct: '纯净物', pool: ['纯净物', '混合物', '悬浊液', '乳浊液'], hint: '蒸馏水只含水一种物质，属于纯净物。' }
  ]
  filtration.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: index >= 4 ? 'basic-application' : 'concept',
      seed: index + 10
    }))
  })
  const gasPreparation = [
    { stem: '实验室用高锰酸钾制取氧气，应选择的发生装置是（ ）', correct: '固体加热型装置', pool: ['固体加热型装置', '固体与液体常温型装置', '电解装置', '过滤装置'], hint: '高锰酸钾制氧气需要加热固体，选用固体加热型装置。' },
    { stem: '实验室用过氧化氢溶液制取氧气，应选择的发生装置是（ ）', correct: '固体与液体常温型装置', pool: ['固体与液体常温型装置', '固体加热型装置', '电解装置', '蒸馏装置'], hint: '过氧化氢与二氧化锰常温反应，选用固液常温型装置。' },
    { stem: '实验室制取二氧化碳的反应物是（ ）', correct: '大理石和稀盐酸', pool: ['大理石和稀盐酸', '大理石和稀硫酸', '碳酸钠和稀盐酸', '石灰石和浓硫酸'], hint: '实验室用大理石（或石灰石）与稀盐酸反应制取二氧化碳。' },
    { stem: '收集二氧化碳应使用（ ）', correct: '向上排空气法', pool: ['向上排空气法', '向下排空气法', '排水法', '向下排空气法或排水法'], hint: '二氧化碳密度比空气大且能溶于水，用向上排空气法收集。' },
    { stem: '实验室制取二氧化碳时，不能用稀硫酸代替稀盐酸，因为（ ）', correct: '生成的硫酸钙微溶，覆盖在石灰石表面阻止反应', pool: ['生成的硫酸钙微溶，覆盖在石灰石表面阻止反应', '稀硫酸不与碳酸钙反应', '稀硫酸会生成有害气体', '稀硫酸浓度太低'], hint: '硫酸钙微溶，附着在石灰石表面使反应难以继续。' },
    { stem: '用长颈漏斗组装气体发生装置时，长颈漏斗下端应（ ）', correct: '伸入液面以下', pool: ['伸入液面以下', '悬在液面上方', '插入集气瓶', '与导管相平'], hint: '下端伸入液面以下形成液封，防止气体从漏斗逸出。' },
    { stem: '实验室制取气体前，首先应（ ）', correct: '检查装置的气密性', pool: ['检查装置的气密性', '装入药品', '加热试管', '收集气体'], hint: '先检查气密性，防止装置漏气影响收集。' },
    { stem: '收集氢气可以采用向下排空气法，依据是氢气（ ）', correct: '密度比空气小', pool: ['密度比空气小', '密度比空气大', '易溶于水', '能与空气反应'], hint: '密度比空气小的气体用向下排空气法收集。' },
    { stem: '用排水法收集氧气完毕后，应先（ ）', correct: '把导管移出水面', pool: ['把导管移出水面', '熄灭酒精灯', '拆下集气瓶', '关闭弹簧夹'], hint: '先撤导管后熄灭酒精灯，防止水倒吸。' },
    { stem: '检验二氧化碳是否收集满的方法是（ ）', correct: '把燃着的木条放在集气瓶口', pool: ['把燃着的木条放在集气瓶口', '把燃着的木条伸入瓶底', '向瓶中倒入澄清石灰水', '闻气体的气味'], hint: '木条在瓶口熄灭说明二氧化碳已收集满。' }
  ]
  gasPreparation.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 20
    }))
  })
  const safety = [
    { stem: '点燃氢气前必须先（ ）', correct: '检验氢气的纯度', pool: ['检验氢气的纯度', '加热试管', '加入氧气', '收集满一瓶'], hint: '氢气与空气混合点燃可能爆炸，必须先验纯。' },
    { stem: '稀释浓硫酸时，正确的操作是（ ）', correct: '把浓硫酸沿器壁缓缓倒入水中并不断搅拌', pool: ['把浓硫酸沿器壁缓缓倒入水中并不断搅拌', '把水倒入浓硫酸中并搅拌', '把浓硫酸和水同时倒入烧杯', '把浓硫酸倒入沸水中'], hint: '稀释浓硫酸时只能酸入水，并不断搅拌散热。' },
    { stem: '浓硫酸不慎沾到皮肤上，应立即（ ）', correct: '用大量水冲洗，再涂上碳酸氢钠溶液', pool: ['用大量水冲洗，再涂上碳酸氢钠溶液', '用氢氧化钠溶液冲洗', '用酒精擦拭', '用干布擦干即可'], hint: '先大量水冲洗，再涂弱碱性碳酸氢钠溶液。' },
    { stem: '一氧化碳还原氧化铁的实验需要处理尾气，原因是（ ）', correct: '一氧化碳有毒，会污染空气', pool: ['一氧化碳有毒，会污染空气', '一氧化碳易燃易爆', '尾气中含有氧气', '尾气温度过高'], hint: '一氧化碳有毒，必须点燃或收集处理尾气。' },
    { stem: '用量筒量取液体时，俯视读数会导致实际量取的液体体积（ ）', correct: '偏小', pool: ['偏小', '偏大', '不变', '无法判断'], hint: '俯视时读数偏大，实际量取的液体偏少。' },
    { stem: '测定空气中氧气含量的实验中，若红磷不足，测得氧气的体积分数会（ ）', correct: '偏小', pool: ['偏小', '偏大', '不变', '先偏大后偏小'], hint: '红磷不足不能耗尽氧气，结果偏小。' },
    { stem: '电解水时向水中加入少量硫酸钠，目的是（ ）', correct: '增强水的导电性', pool: ['增强水的导电性', '增加水的质量', '加快气体生成速率', '改变气体体积比'], hint: '纯水导电性弱，加入硫酸钠增强导电性。' },
    { stem: '用排水法收集氧气时，若导管口刚有气泡冒出就立即收集，会导致（ ）', correct: '收集到的气体不纯', pool: ['收集到的气体不纯', '收集不到气体', '氧气被消耗', '装置炸裂'], hint: '开始冒出的是装置内空气，应待气泡连续均匀后再收集。' },
    { stem: '用托盘天平称量时，若物品和砝码放反且使用了游码，则称得的质量（ ）', correct: '偏大', pool: ['偏大', '偏小', '不变', '无法确定'], hint: '物码放反时，实际质量 = 砝码质量 - 游码示数，称量结果偏大。' },
    { stem: '实验室剩余的药品应该（ ）', correct: '放入指定容器，不能放回原试剂瓶', pool: ['放入指定容器，不能放回原试剂瓶', '放回原试剂瓶', '直接倒入下水道', '带回家继续使用'], hint: '剩余药品不能放回原瓶，应放入指定容器统一处理。' }
  ]
  safety.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 2,
      dimension: index >= 4 ? 'error-analysis' : 'concept',
      seed: index + 30
    }))
  })
  return items
}

// 化学计算综合：方程式计算、含杂质计算、元素质量、元素质量分数
function chemicalCalculations() {
  const items = []
  const carbonateMasses = [10, 20, 50, 100, 25, 5, 15, 40, 80, 200]
  carbonateMasses.forEach((m, index) => {
    const answer = Number((m * 0.44).toFixed(4))
    items.push(makeQuestion({
      stem: `已知相对原子质量 Ca-40、C-12、O-16。${m} g 碳酸钙高温分解，生成二氧化碳的质量是（ ）`,
      correct: `${answer} g`,
      wrongs: [`${Number((answer * 2).toFixed(4))} g`, `${Number((answer / 2).toFixed(4))} g`, `${Number((answer + 1).toFixed(4))} g`],
      hint: `CaCO₃ →(高温) CaO + CO₂↑，100 份 CaCO₃ 生成 44 份 CO₂，所以 CO₂ 质量 = ${m} × 44/100 = ${answer} g。`,
      difficulty: 3,
      dimension: 'method',
      seed: index
    }))
  })
  const impurityCases = [[100, 80], [200, 75], [50, 90], [400, 80], [25, 80], [160, 75], [300, 90], [80, 50], [120, 85], [250, 92]]
  impurityCases.forEach(([m, percent], index) => {
    const answer = (m * percent) / 100
    items.push(makeQuestion({
      stem: `某石灰石样品 ${m} g，其中碳酸钙的质量分数为 ${percent}%，样品中碳酸钙的质量是（ ）`,
      correct: `${answer} g`,
      wrongs: [`${answer * 2} g`, `${answer + 10} g`, `${Math.max(1, answer - 10)} g`],
      hint: `碳酸钙质量 = 样品质量 × 质量分数 = ${m} × ${percent}% = ${answer} g。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const calciumMasses = [100, 50, 200, 250, 20, 500, 40, 150, 80, 300]
  calciumMasses.forEach((m, index) => {
    const answer = m * 0.4
    items.push(makeQuestion({
      stem: `已知 CaCO₃ 中钙元素的质量分数为 40%，${m} g 碳酸钙中含钙元素的质量是（ ）`,
      correct: `${answer} g`,
      wrongs: [`${m * 0.6} g`, `${m * 0.8} g`, `${m * 0.2} g`],
      hint: `钙元素质量 = 碳酸钙质量 × 钙元素质量分数 = ${m} × 40% = ${answer} g。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 20
    }))
  })
  const fractions = [
    ['NH₄NO₃', 'N', 'N-14、H-1、O-16', 35],
    ['CaCO₃', 'Ca', 'Ca-40、C-12、O-16', 40],
    ['Fe₂O₃', 'Fe', 'Fe-56、O-16', 70],
    ['NaOH', 'Na', 'Na-23、O-16、H-1', 57.5],
    ['MgO', 'Mg', 'Mg-24、O-16', 60],
    ['CuO', 'Cu', 'Cu-64、O-16', 80],
    ['SO₂', 'S', 'S-32、O-16', 50],
    ['SO₃', 'S', 'S-32、O-16', 40],
    ['CH₄', 'C', 'C-12、H-1', 75],
    ['CaCO₃', 'O', 'Ca-40、C-12、O-16', 48]
  ]
  fractions.forEach(([formula, element, ar, answer], index) => {
    items.push(makeQuestion({
      stem: `已知相对原子质量 ${ar}，${formula} 中 ${element} 元素的质量分数是（ ）`,
      correct: `${answer}%`,
      wrongs: [`${answer + 10}%`, `${answer + 20}%`, `${100 - answer + 5}%`],
      hint: `先由化学式求出相对分子质量，再用 ${element} 元素的相对原子质量总和除以相对分子质量，得 ${answer}%。`,
      difficulty: 3,
      dimension: 'transfer',
      seed: index + 30
    }))
  })
  return items
}

export const grade9ChemistryGenerators = {
  '物质构成与化学用语': chemicalLanguage,
  '化学方程式': chemicalEquations,
  '空气与氧气': airAndOxygen,
  '水与溶液': waterAndSolutions,
  '金属与酸碱盐': metalsAcidsBasesSalts,
  '化学实验与探究': experiments,
  '化学计算综合': chemicalCalculations
}

export const bankGroup = {
  grade: '初三',
  subject: '化学',
  edition: '人教版',
  generators: grade9ChemistryGenerators
}
