// 初三数学题库生成器：一元二次方程、二次函数、圆、相似、三角函数、概率，
// 每题答案都由公式现算，选项只做同类型干扰，避免出现两解或歧义。
import { makeQuestion } from './helpers.mjs'

function gcd(a, b) {
  return b === 0 ? Math.abs(a) : gcd(b, a % b)
}

function frac(numerator, denominator) {
  const divisor = gcd(numerator, denominator) || 1
  return `${numerator / divisor}/${denominator / divisor}`
}

function signedTerm(value) {
  return `${value >= 0 ? '+' : '-'} ${Math.abs(value)}`
}

// 一元二次方程
function quadraticEquations() {
  const items = []
  const pairs = [[2, 3], [1, 5], [4, 6], [3, 7], [2, 9], [5, 8], [4, 10], [6, 7], [3, 11], [8, 9]]
  pairs.forEach(([p, q], index) => {
    const sum = p + q
    const product = p * q
    if (index % 2 === 0) {
      items.push(makeQuestion({
        stem: `方程 x² - ${sum}x + ${product} = 0 的两根之和是（ ）`,
        correct: sum,
        wrongs: [product, -sum, p - q],
        hint: `由根与系数的关系，x₁ + x₂ = -b/a = ${sum}，两根分别为 ${p} 和 ${q}。`,
        difficulty: 1,
        dimension: 'concept',
        seed: index
      }))
      return
    }
    items.push(makeQuestion({
      stem: `方程 x² - ${sum}x + ${product} = 0 的两根之积是（ ）`,
      correct: product,
      wrongs: [sum, -product, p + q + 1],
      hint: `由根与系数的关系，x₁x₂ = c/a = ${product}，两根分别为 ${p} 和 ${q}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const equations = [[1, -4, 3], [1, 2, 1], [1, 0, 4], [1, -6, 8], [1, 4, 4], [1, 2, 5], [2, -4, 2], [1, -2, -3], [3, 6, 3], [1, 0, 9]]
  equations.forEach(([a, b, c], index) => {
    const delta = b * b - 4 * a * c
    const answer = delta > 0 ? '两个不相等的实数根' : delta === 0 ? '两个相等的实数根' : '没有实数根'
    const equationText = `${a === 1 ? '' : `${a}`}x²${b === 0 ? '' : ` ${signedTerm(b)}x`} ${signedTerm(c)} = 0`
    items.push(makeQuestion({
      stem: `一元二次方程 ${equationText} 的根的情况是（ ）`,
      correct: answer,
      wrongs: ['两个不相等的实数根', '两个相等的实数根', '没有实数根', '只有一个实数根'].filter(item => item !== answer).slice(0, 3),
      hint: `判别式 Δ = b² - 4ac = (${b})² - 4 × ${a} × (${c}) = ${delta}${delta > 0 ? ' > 0，所以有两个不相等的实数根' : delta === 0 ? ' = 0，所以有两个相等的实数根' : ' < 0，所以没有实数根'}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  pairs.forEach(([p, q], index) => {
    const sum = p + q
    const product = p * q
    items.push(makeQuestion({
      stem: `已知方程 x² - ${sum}x + ${product} = 0 的一个根是 ${p}，则另一个根是（ ）`,
      correct: q,
      wrongs: [p, sum, product],
      hint: `两根之和为 ${sum}，另一个根 = ${sum} - ${p} = ${q}。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 二次函数
function quadraticFunctions() {
  const items = []
  const parabolas = [[1, 2, 3], [-1, 3, -2], [2, -1, 5], [-2, 4, 1], [1, -3, -4], [-1, -2, 6], [3, 1, -5], [-3, 2, 4], [2, 5, -1], [-2, -4, 3]]
  parabolas.forEach(([a, h, k], index) => {
    const formula = `y = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${signedTerm(-h)})² ${signedTerm(k)}`
    items.push(makeQuestion({
      stem: `抛物线 ${formula} 的顶点坐标是（ ）`,
      correct: `(${h}, ${k})`,
      wrongs: [`(${-h}, ${k})`, `(${h}, ${-k})`, `(${-h}, ${-k})`],
      hint: `顶点式 y = a(x - h)² + k 的顶点为 (h, k)，所以顶点是 (${h}, ${k})。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const axisData = [[1, -4], [2, -8], [-1, 2], [1, 6], [-2, 4], [2, 12], [1, -2], [-1, -6], [2, -4], [1, 10]]
  axisData.forEach(([a, b], index) => {
    const h = -b / (2 * a)
    const formula = `y = ${a === 1 ? '' : a === -1 ? '-' : a}x² ${signedTerm(b)}x + 1`
    items.push(makeQuestion({
      stem: `抛物线 ${formula} 的对称轴是（ ）`,
      correct: `x = ${h}`,
      wrongs: [`x = ${-h}`, `x = ${h + 1}`, `x = ${h - 1}`],
      hint: `对称轴 x = -b/(2a) = -(${b})/(2 × ${a}) = ${h}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  parabolas.forEach(([a, h, k], index) => {
    const formula = `y = ${a === 1 ? '' : a === -1 ? '-' : a}(x ${signedTerm(-h)})² ${signedTerm(k)}`
    const kind = a > 0 ? '最小值' : '最大值'
    const other = a > 0 ? '最大值' : '最小值'
    items.push(makeQuestion({
      stem: `二次函数 ${formula} 的最值是（ ）`,
      correct: `${kind} ${k}`,
      wrongs: [`${other} ${k}`, `${kind} ${k + 1}`, `${kind} ${k - 1}`],
      hint: `a ${a > 0 ? '>' : '<'} 0，抛物线开口向${a > 0 ? '上' : '下'}，在顶点处取得${kind} ${k}。`,
      difficulty: 2,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

// 旋转与圆
function rotationAndCircles() {
  const items = []
  const points = [[3, 2], [-4, 5], [6, -1], [-2, -7], [5, 4], [-6, 3], [7, -2], [-3, -5], [8, 1], [-5, 6]]
  points.forEach(([x, y], index) => {
    items.push(makeQuestion({
      stem: `把点 P(${x}, ${y}) 绕原点旋转 180° 后得到的点的坐标是（ ）`,
      correct: `(${-x}, ${-y})`,
      wrongs: [`(${x}, ${-y})`, `(${-x}, ${y})`, `(${y}, ${x})`],
      hint: `绕原点旋转 180°，横、纵坐标都变为原来的相反数，所以是 (${-x}, ${-y})。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const arcs = [[60, 6], [90, 6], [120, 6], [30, 12], [45, 8], [72, 5], [36, 10], [150, 6], [270, 4], [90, 8]]
  arcs.forEach(([angle, radius], index) => {
    const coefficient = (angle * radius) / 180
    items.push(makeQuestion({
      stem: `圆心角为 ${angle}°，半径为 ${radius} 的弧长是（ ）`,
      correct: `${coefficient}π`,
      wrongs: [`${coefficient + 1}π`, `${coefficient}π/2`, `${coefficient * 2}π`],
      hint: `弧长 l = nπr/180 = ${angle}π × ${radius} ÷ 180 = ${coefficient}π。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const sectors = [[90, 4], [120, 3], [60, 6], [45, 4], [30, 6], [72, 5], [90, 6], [120, 6], [180, 4], [36, 10]]
  sectors.forEach(([angle, radius], index) => {
    const coefficient = (angle * radius * radius) / 360
    items.push(makeQuestion({
      stem: `圆心角为 ${angle}°，半径为 ${radius} 的扇形面积是（ ）`,
      correct: `${coefficient}π`,
      wrongs: [`${coefficient + 1}π`, `${coefficient * 2}π`, `${coefficient / 2}π`],
      hint: `扇形面积 S = nπr²/360 = ${angle}π × ${radius * radius} ÷ 360 = ${coefficient}π。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 圆的性质与证明
function circleProperties() {
  const items = []
  const centralAngles = [80, 120, 60, 140, 100, 160, 72, 96, 64, 150]
  centralAngles.forEach((central, index) => {
    const answer = central / 2
    items.push(makeQuestion({
      stem: `一条弧所对的圆心角是 ${central}°，它所对的圆周角是（ ）`,
      correct: `${answer}°`,
      wrongs: [`${central}°`, `${central * 2}°`, `${answer + 10}°`],
      hint: `同弧所对的圆周角等于圆心角的一半：${central}° ÷ 2 = ${answer}°。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const chords = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25], [9, 12, 15], [12, 16, 20], [20, 21, 29], [9, 40, 41], [15, 20, 25]]
  chords.forEach(([half, distance, radius], index) => {
    const answer = 2 * half
    items.push(makeQuestion({
      stem: `⊙O 的半径为 ${radius}，圆心到弦 AB 的距离为 ${distance}，则弦 AB 的长是（ ）`,
      correct: answer,
      wrongs: [half, answer + 1, answer - 1],
      hint: `由垂径定理，半弦长 = √(${radius}² - ${distance}²) = ${half}，所以弦长 = 2 × ${half} = ${answer}。`,
      difficulty: 3,
      dimension: 'transfer',
      seed: index + 10
    }))
  })
  const cyclicAngles = [40, 75, 110, 125, 65, 95, 80, 105, 55, 140]
  cyclicAngles.forEach((angle, index) => {
    const answer = 180 - angle
    items.push(makeQuestion({
      stem: `四边形 ABCD 内接于 ⊙O，∠A = ${angle}°，则 ∠C 的度数是（ ）`,
      correct: `${answer}°`,
      wrongs: [`${angle}°`, `${360 - angle}°`, '90°'],
      hint: `圆内接四边形对角互补：∠C = 180° - ${angle}° = ${answer}°。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 20
    }))
  })
  return items
}

// 相似三角形
function similarTriangles() {
  const items = []
  const ratios = [[1, 2], [1, 3], [2, 3], [1, 4], [3, 4], [2, 5], [1, 5], [3, 5], [4, 5], [2, 7]]
  ratios.forEach(([m, n], index) => {
    items.push(makeQuestion({
      stem: `两个相似三角形的相似比是 ${m} : ${n}，它们的面积比是（ ）`,
      correct: `${m * m} : ${n * n}`,
      wrongs: [`${m} : ${n}`, `${n * n} : ${m * m}`, `${m * m + 1} : ${n * n + 1}`],
      hint: `相似三角形的面积比等于相似比的平方：${m}² : ${n}² = ${m * m} : ${n * n}。`,
      difficulty: 2,
      dimension: 'concept',
      seed: index
    }))
  })
  const parallelSegments = [[2, 3, 4], [3, 4, 6], [4, 5, 8], [2, 5, 6], [3, 5, 9], [5, 6, 10], [4, 7, 12], [6, 8, 9], [2, 7, 8], [5, 9, 15]]
  parallelSegments.forEach(([ab, bc, de], index) => {
    const answer = (bc * de) / ab
    items.push(makeQuestion({
      stem: `直线 l₁ ∥ l₂ ∥ l₃，三条截线分别交于点 A、B、C 和 D、E、F。已知 AB = ${ab}，BC = ${bc}，DE = ${de}，则 EF =（ ）`,
      correct: answer,
      wrongs: [answer + 1, answer - 1, de],
      hint: `由平行线分线段成比例，AB : BC = DE : EF，所以 EF = ${bc} × ${de} ÷ ${ab} = ${answer}。`,
      difficulty: 3,
      dimension: 'method',
      seed: index + 10
    }))
  })
  const similarSides = [[2, 3, 4], [3, 4, 6], [4, 5, 8], [5, 6, 10], [2, 5, 6], [3, 7, 9], [4, 9, 8], [6, 4, 9], [5, 8, 10], [7, 9, 14]]
  similarSides.forEach(([ab, bc, de], index) => {
    const answer = (bc * de) / ab
    items.push(makeQuestion({
      stem: `△ABC ∽ △DEF，AB = ${ab}，BC = ${bc}，DE = ${de}，则 EF =（ ）`,
      correct: answer,
      wrongs: [answer + 1, answer - 1, de],
      hint: `相似三角形对应边成比例：AB/DE = BC/EF，所以 EF = ${bc} × ${de} ÷ ${ab} = ${answer}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 20
    }))
  })
  return items
}

// 锐角三角函数
function trigonometry() {
  const items = []
  const triples = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [9, 40, 41], [6, 8, 10], [9, 12, 15], [12, 16, 20], [20, 21, 29], [15, 20, 25]]
  triples.forEach(([opposite, adjacent, hypotenuse], index) => {
    const functions = [
      { name: 'sin', value: frac(opposite, hypotenuse), wrongs: [frac(adjacent, hypotenuse), frac(opposite, adjacent), frac(hypotenuse, opposite)] },
      { name: 'cos', value: frac(adjacent, hypotenuse), wrongs: [frac(opposite, hypotenuse), frac(adjacent, opposite), frac(hypotenuse, adjacent)] },
      { name: 'tan', value: frac(opposite, adjacent), wrongs: [frac(adjacent, opposite), frac(opposite, hypotenuse), frac(adjacent, hypotenuse)] }
    ]
    const item = functions[index % 3]
    items.push(makeQuestion({
      stem: `在 Rt△ABC 中，∠C = 90°，BC = ${opposite}，AC = ${adjacent}，AB = ${hypotenuse}，则 ${item.name} A =（ ）`,
      correct: item.value,
      wrongs: item.wrongs,
      hint: `${item.name} A = ${item.name === 'sin' ? '对边/斜边' : item.name === 'cos' ? '邻边/斜边' : '对边/邻边'} = ${item.value}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const specials = [
    ['sin', 30, '1/2', ['√3/2', '1', '√2/2']],
    ['cos', 60, '1/2', ['√3/2', '√2/2', '1']],
    ['tan', 45, '1', ['√2/2', '√3/3', '1/2']],
    ['sin', 45, '√2/2', ['1/2', '√3/2', '1']],
    ['cos', 30, '√3/2', ['1/2', '√2/2', '√3']],
    ['tan', 60, '√3', ['√3/3', '1', '√2']],
    ['sin', 60, '√3/2', ['1/2', '√2/2', '√3/3']],
    ['cos', 45, '√2/2', ['1/2', '√3/2', '√2']],
    ['tan', 30, '√3/3', ['√3', '1/3', '1/2']],
    ['sin', 90, '1', ['1/2', '√2/2', '0']]
  ]
  specials.forEach(([name, degree, answer, wrongs], index) => {
    items.push(makeQuestion({
      stem: `${name} ${degree}° 的值是（ ）`,
      correct: answer,
      wrongs,
      hint: `特殊角的三角函数值：${name} ${degree}° = ${answer}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 10
    }))
  })
  triples.forEach(([opposite, adjacent, hypotenuse], index) => {
    items.push(makeQuestion({
      stem: `在 Rt△ABC 中，∠C = 90°，AB = ${hypotenuse}，sin A = ${frac(opposite, hypotenuse)}，则 cos A =（ ）`,
      correct: frac(adjacent, hypotenuse),
      wrongs: [frac(opposite, hypotenuse), frac(hypotenuse, adjacent), frac(adjacent, opposite)],
      hint: `sin A = 对边/斜边 = ${frac(opposite, hypotenuse)}，cos A = 邻边/斜边 = ${frac(adjacent, hypotenuse)}。`,
      difficulty: 2,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

// 概率与统计综合
function probability() {
  const items = []
  const bags = [[2, 3], [3, 5], [1, 4], [5, 10], [3, 7], [2, 7], [6, 9], [4, 12], [5, 15], [4, 6]]
  bags.forEach(([red, white], index) => {
    const total = red + white
    items.push(makeQuestion({
      stem: `一个不透明的袋子里有 ${red} 个红球和 ${white} 个白球，除颜色外都相同，随机摸出一个球是红球的概率是（ ）`,
      correct: `${red}/${total}`,
      wrongs: [`${white}/${total}`, `${red}/${white}`, `${total}/${red}`],
      hint: `概率 = 红球数 ÷ 球的总数 = ${red}/${total}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const trials = [[40, 10], [50, 15], [80, 20], [60, 9], [100, 35], [200, 50], [120, 30], [150, 45], [400, 100], [250, 75]]
  trials.forEach(([total, success], index) => {
    items.push(makeQuestion({
      stem: `某种子在相同条件下做发芽试验，共种下 ${total} 粒，有 ${success} 粒发芽，这次试验中发芽的频率是（ ）`,
      correct: `${success}/${total}`,
      wrongs: [`${total - success}/${total}`, `${success}/${total - success}`, `${total}/${success}`],
      hint: `频率 = 发芽数 ÷ 试验总数 = ${success}/${total}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const diceEvents = [['出现的点数是偶数', 3], ['出现的点数大于 4', 2], ['出现的点数小于 3', 2], ['出现的点数是 3 的倍数', 2], ['出现的点数是 6', 1], ['出现的点数是奇数', 3], ['出现的点数不大于 2', 2], ['出现的点数大于 1', 5], ['出现的点数是 1 或 2', 2], ['出现的点数不小于 5', 2]]
  diceEvents.forEach(([event, count], index) => {
    items.push(makeQuestion({
      stem: `掷一枚质地均匀的骰子，${event}的概率是（ ）`,
      correct: `${count}/6`,
      wrongs: [`${count + 1}/6`, `${count}/5`, `${count}/7`],
      hint: `骰子 6 个结果等可能，符合条件的有 ${count} 个，概率为 ${count}/6。`,
      difficulty: 2,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

export const grade9MathGenerators = {
  '一元二次方程': quadraticEquations,
  '二次函数': quadraticFunctions,
  '旋转与圆': rotationAndCircles,
  '圆的性质与证明': circleProperties,
  '相似三角形': similarTriangles,
  '锐角三角函数': trigonometry,
  '概率与统计综合': probability
}

export const bankGroup = {
  grade: '初三',
  subject: '数学',
  edition: '人教版',
  generators: grade9MathGenerators
}
