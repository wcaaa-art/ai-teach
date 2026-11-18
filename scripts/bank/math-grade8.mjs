// 初二数学题库生成器：每章 3 类模板 × 10 道变体，答案全部由算式或几何公式直接推出。
import { makeQuestion } from './helpers.mjs'

// 三角形与全等
function triangles() {
  const items = []
  const angles = [[50, 60], [45, 75], [30, 80], [65, 55], [70, 40], [35, 95], [80, 60], [25, 105], [90, 30], [55, 65]]
  angles.forEach(([a, b], index) => {
    const answer = 180 - a - b
    items.push(makeQuestion({
      stem: `在 △ABC 中，∠A = ${a}°，∠B = ${b}°，则 ∠C 的度数是（ ）`,
      correct: `${answer}°`,
      wrongs: [`${answer + 10}°`, `${answer - 10}°`, `${a + b}°`],
      hint: `三角形内角和为 180°，∠C = 180° - ${a}° - ${b}° = ${answer}°。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const sides = [[5, 7, 6], [8, 6, 10], [9, 12, 15], [4, 5, 3], [12, 5, 13], [7, 24, 25], [10, 8, 6], [15, 9, 12], [20, 16, 12], [6, 8, 10]]
  sides.forEach(([ab, bc, ac], index) => {
    const asks = [
      { name: 'DE', value: ab, pair: 'AB 与 DE' },
      { name: 'EF', value: bc, pair: 'BC 与 EF' },
      { name: 'DF', value: ac, pair: 'AC 与 DF' }
    ]
    const ask = asks[index % 3]
    items.push(makeQuestion({
      stem: `△ABC ≌ △DEF，AB = ${ab}，BC = ${bc}，AC = ${ac}，则 ${ask.name} 的长是（ ）`,
      correct: ask.value,
      wrongs: [ask.value + 1, ask.value - 1, ask.value + 2],
      hint: `全等三角形对应边相等（${ask.pair} 是对应边），所以 ${ask.name} = ${ask.value}。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const pairs = [[5, 3], [7, 4], [9, 2], [10, 6], [12, 5], [8, 3], [15, 7], [11, 4], [13, 6], [20, 9]]
  pairs.forEach(([a, b], index) => {
    const low = a - b
    const high = a + b
    items.push(makeQuestion({
      stem: `一个三角形的两边长分别为 ${a} 和 ${b}，第三边长 x 的取值范围是（ ）`,
      correct: `${low} < x < ${high}`,
      wrongs: [`${low} ≤ x ≤ ${high}`, `${low} < x < ${high - 1}`, `${low + 1} < x < ${high}`],
      hint: `三角形任意两边之差小于第三边、任意两边之和大于第三边：${low} < x < ${high}。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 轴对称与等腰三角形
function axialSymmetry() {
  const items = []
  const apexAngles = [30, 50, 70, 90, 110, 120, 140, 44, 36, 24]
  apexAngles.forEach((apex, index) => {
    const answer = (180 - apex) / 2
    items.push(makeQuestion({
      stem: `等腰三角形的顶角为 ${apex}°，则它的一个底角是（ ）`,
      correct: `${answer}°`,
      wrongs: [`${180 - apex}°`, `${answer + 10}°`, `${answer - 10}°`],
      hint: `等腰三角形两底角相等：(180° - ${apex}°) ÷ 2 = ${answer}°。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const baseAngles = [30, 40, 50, 55, 60, 65, 70, 75, 80, 35]
  baseAngles.forEach((base, index) => {
    const answer = 180 - 2 * base
    items.push(makeQuestion({
      stem: `等腰三角形的一个底角为 ${base}°，则它的顶角是（ ）`,
      correct: `${answer}°`,
      wrongs: [`${2 * base}°`, `${answer + 10}°`, `${answer - 10}°`],
      hint: `两底角相等，顶角 = 180° - 2 × ${base}° = ${answer}°。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const points = [[3, 5], [-4, 2], [6, -3], [-2, -7], [5, 4], [-6, 8], [7, -1], [-3, -5], [8, 2], [-5, 6]]
  points.forEach(([x, y], index) => {
    items.push(makeQuestion({
      stem: `点 P(${x}, ${y}) 关于 y 轴对称的点的坐标是（ ）`,
      correct: `(${-x}, ${y})`,
      wrongs: [`(${x}, ${-y})`, `(${-x}, ${-y})`, `(${y}, ${x})`],
      hint: `关于 y 轴对称，纵坐标不变、横坐标互为相反数，所以是 (${-x}, ${y})。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 20
    }))
  })
  return items
}

// 整式乘法与因式分解
function multiplicationAndFactorization() {
  const items = []
  const pairs = [[3, 4], [5, 2], [-3, 6], [-2, -5], [7, -4], [8, 1], [-6, -1], [9, -2], [-7, 3], [4, -8]]
  pairs.forEach(([a, b], index) => {
    items.push(makeQuestion({
      stem: `计算 (x + ${a})(x + ${b})，展开后一次项（x 项）的系数是（ ）`,
      correct: a + b,
      wrongs: [a * b, a - b, -(a + b)],
      hint: `(x + a)(x + b) = x² + (a + b)x + ab，一次项系数为 ${a} + ${b} = ${a + b}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const powers = [[2, 3], [3, 4], [2, 5], [4, 5], [3, 6], [5, 6], [2, 7], [4, 7], [6, 7], [3, 8]]
  powers.forEach(([m, n], index) => {
    items.push(makeQuestion({
      stem: `计算 x^${m} · x^${n} 的结果是（ ）`,
      correct: `x^${m + n}`,
      wrongs: [`x^${m * n}`, `x^${Math.abs(m - n)}`, `${m + n}x`],
      hint: `同底数幂相乘，底数不变、指数相加：x^${m} · x^${n} = x^${m + n}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 10
    }))
  })
  const factorables = [[2, 3], [1, 4], [5, 2], [3, 6], [4, 7], [8, 1], [2, 9], [6, 5], [7, 3], [10, 2]]
  factorables.forEach(([a, b], index) => {
    items.push(makeQuestion({
      stem: `把 x² + ${a + b}x + ${a * b} 因式分解，结果是（ ）`,
      correct: `(x + ${a})(x + ${b})`,
      wrongs: [`(x - ${a})(x - ${b})`, `(x + ${a})(x - ${b})`, `(x - ${a})(x + ${b})`],
      hint: `寻找两数 ${a}、${b}，它们的和为 ${a + b}、积为 ${a * b}，所以原式 = (x + ${a})(x + ${b})。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 分式
function fractions() {
  const items = []
  const denominators = [3, -2, 5, 10, 7, -4, 9, 2, -6, 8]
  denominators.forEach((a, index) => {
    items.push(makeQuestion({
      stem: `分式 1/(x ${a >= 0 ? '-' : '+'} ${Math.abs(a)}) 有意义的条件是（ ）`,
      correct: `x ≠ ${a}`,
      wrongs: [`x = ${a}`, `x > ${a}`, `x ≠ ${-a}`],
      hint: `分母不能为 0：x ${a >= 0 ? '-' : '+'} ${Math.abs(a)} ≠ 0，所以 x ≠ ${a}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const simplifiable = [2, 3, 4, 5, 6, 7, 8, 9, 10, 11]
  simplifiable.forEach((a, index) => {
    items.push(makeQuestion({
      stem: `化简 (x² - ${a * a})/(x - ${a})（x ≠ ${a}），结果是（ ）`,
      correct: `x + ${a}`,
      wrongs: [`x - ${a}`, `${a} - x`, `x² + ${a}`],
      hint: `分子用平方差公式：x² - ${a * a} = (x - ${a})(x + ${a})，约去 x - ${a} 得 x + ${a}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const sums = [[2, 3], [3, 4], [2, 5], [4, 5], [3, 7], [5, 6], [2, 9], [4, 7], [6, 7], [3, 8]]
  sums.forEach(([a, b], index) => {
    items.push(makeQuestion({
      stem: `计算 1/${a} + 1/${b} 的结果是（ ）`,
      correct: `(${a + b})/${a * b}`,
      wrongs: [`2/(${a + b})`, `${a * b}/${a + b}`, `1/${a + b}`],
      hint: `通分得 ${b}/${a * b} + ${a}/${a * b} = (${a + b})/${a * b}。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 二次根式
function radicals() {
  const items = []
  const extractions = [[2, 3], [3, 5], [4, 2], [5, 6], [6, 2], [7, 3], [3, 7], [2, 5], [4, 3], [5, 2]]
  extractions.forEach(([a, b], index) => {
    items.push(makeQuestion({
      stem: `化简 √(${a * a * b}) 的结果是（ ）`,
      correct: `${a}√${b}`,
      wrongs: [`${a * a}√${b}`, `${b}√${a}`, `${a * b}`],
      hint: `√(${a}² × ${b}) = ${a}√${b}：平方因子 ${a}² 可以开方移到根号外。`,
      difficulty: 2,
      dimension: 'concept',
      seed: index
    }))
  })
  const products = [[2, 8], [3, 12], [5, 20], [2, 18], [3, 27], [4, 9], [5, 45], [6, 24], [2, 32], [3, 48]]
  products.forEach(([a, b], index) => {
    const answer = Math.sqrt(a * b)
    items.push(makeQuestion({
      stem: `计算 √${a} · √${b} 的结果是（ ）`,
      correct: answer,
      wrongs: [a * b, a + b, Math.abs(a - b)],
      hint: `√a · √b = √(ab)：√${a} · √${b} = √${a * b} = ${answer}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const rationalize = [2, 3, 5, 6, 7, 8, 10, 11, 12, 13]
  rationalize.forEach((a, index) => {
    items.push(makeQuestion({
      stem: `化简 1/√${a} 的结果是（ ）`,
      correct: `√${a}/${a}`,
      wrongs: [`√${a}`, `${a}`, `1/${a}`],
      hint: `分子分母同乘 √${a}：1/√${a} = √${a}/(√${a} × √${a}) = √${a}/${a}。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 勾股定理
function pythagorean() {
  const items = []
  const triples = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25], [9, 12, 15], [12, 16, 20], [20, 21, 29], [9, 40, 41], [15, 20, 25]]
  triples.forEach(([a, b, c], index) => {
    items.push(makeQuestion({
      stem: `直角三角形两条直角边长分别为 ${a} 和 ${b}，斜边长是（ ）`,
      correct: c,
      wrongs: [a + b, c - 1, c + 1],
      hint: `由勾股定理，斜边 = √(${a}² + ${b}²) = √${a * a + b * b} = ${c}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  triples.forEach(([a, b, c], index) => {
    items.push(makeQuestion({
      stem: `直角三角形的斜边长为 ${c}，一条直角边长为 ${a}，另一条直角边长是（ ）`,
      correct: b,
      wrongs: [c - a, a + b, b + 1],
      hint: `由勾股定理，另一边 = √(${c}² - ${a}²) = √${c * c - a * a} = ${b}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const judgeSets = [[3, 4, 5], [5, 12, 13], [6, 8, 10], [8, 15, 17], [7, 24, 25], [3, 4, 6], [5, 12, 14], [6, 8, 9], [8, 15, 16], [7, 24, 26]]
  judgeSets.forEach(([a, b, c], index) => {
    const isRight = a * a + b * b === c * c
    items.push(makeQuestion({
      stem: `长度分别为 ${a}、${b}、${c} 的三条线段，下列判断正确的是（ ）`,
      correct: isRight ? '能组成直角三角形' : '不能组成直角三角形',
      wrongs: [isRight ? '不能组成直角三角形' : '能组成直角三角形', '一定能组成等腰三角形', '一定能组成等边三角形'],
      hint: isRight
        ? `${a}² + ${b}² = ${a * a + b * b} = ${c}²，满足勾股定理的逆定理，能组成直角三角形。`
        : `${a}² + ${b}² = ${a * a + b * b} ≠ ${c * c} = ${c}²，不满足勾股定理的逆定理，不能组成直角三角形。`,
      difficulty: 2,
      dimension: 'error-analysis',
      seed: index + 20
    }))
  })
  return items
}

// 平行四边形
function parallelograms() {
  const items = []
  const angles = [50, 65, 72, 110, 135, 45, 80, 95, 120, 58]
  angles.forEach((angle, index) => {
    items.push(makeQuestion({
      stem: `在平行四边形 ABCD 中，∠A = ${angle}°，则与它相邻的 ∠B 的度数是（ ）`,
      correct: `${180 - angle}°`,
      wrongs: [`${angle}°`, `${360 - angle}°`, '90°'],
      hint: `平行四边形相邻两角互补：∠B = 180° - ${angle}° = ${180 - angle}°。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const sides = [[6, 10], [8, 12], [5, 13], [9, 15], [7, 11], [10, 14], [4, 16], [12, 18], [3, 7], [11, 19]]
  sides.forEach(([a, b], index) => {
    const perimeter = 2 * (a + b)
    items.push(makeQuestion({
      stem: `平行四边形的一条边长为 ${a}，周长为 ${perimeter}，则与它相邻的另一条边长是（ ）`,
      correct: b,
      wrongs: [perimeter / 2 - a + 1, perimeter / 2 - a - 1, perimeter - a],
      hint: `平行四边形周长 = 2 × (相邻两边之和)，所以另一边 = ${perimeter} ÷ 2 - ${a} = ${b}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const ratios = [[1, 2], [1, 5], [2, 3], [1, 3], [2, 7], [4, 5], [1, 8], [5, 7], [3, 7], [7, 11]]
  ratios.forEach(([m, n], index) => {
    const total = m + n
    const answer = (180 * m) / total
    items.push(makeQuestion({
      stem: `在平行四边形 ABCD 中，∠A : ∠B = ${m} : ${n}，则 ∠A 的度数是（ ）`,
      correct: `${answer}°`,
      wrongs: [`${answer + 10}°`, `${(180 * n) / total}°`, `${(90 * m) / total}°`],
      hint: `相邻两角互补，共 ${total} 份对应 180°，∠A = 180° × ${m}/${total} = ${answer}°。`,
      difficulty: 3,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

// 一次函数
function linearFunctions() {
  const items = []
  const values = [[2, 3, 4], [-1, 5, 6], [3, -2, 2], [4, 1, -3], [-2, 7, 5], [5, -3, 2], [1, -4, 8], [-3, 2, -2], [6, 5, 0], [2, -6, 5]]
  values.forEach(([k, b, x], index) => {
    const answer = k * x + b
    items.push(makeQuestion({
      stem: `一次函数 y = ${k}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}，当 x = ${x} 时，y 的值是（ ）`,
      correct: answer,
      wrongs: [k * x - b, -k * x + b, k * (x + b)],
      hint: `代入 x = ${x}：y = ${k} × ${x} ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = ${answer}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const points = [[1, 3], [2, 7], [0, 4], [-1, 5], [3, 2], [4, 6], [-2, 8], [5, 1], [6, 3], [-3, 9]]
  points.forEach(([x1, k], index) => {
    const b = 4
    const x2 = x1 + 2
    const y1 = k * x1 + b
    const y2 = k * x2 + b
    items.push(makeQuestion({
      stem: `一次函数图象经过点 (${x1}, ${y1}) 和 (${x2}, ${y2})，它的斜率 k 是（ ）`,
      correct: k,
      wrongs: [-k, k + 1, k - 1],
      hint: `k = (y₂ - y₁)/(x₂ - x₁) = (${y2} - ${y1})/(${x2} - ${x1}) = ${k}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const intercepts = [[2, 6], [3, 9], [-2, 8], [4, -12], [5, 10], [-3, 15], [2, -8], [6, 18], [-4, 20], [3, -21]]
  intercepts.forEach(([k, b], index) => {
    const answer = -b / k
    items.push(makeQuestion({
      stem: `一次函数 y = ${k}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} 的图象与 x 轴交点的坐标是（ ）`,
      correct: `(${answer}, 0)`,
      wrongs: [`(${b / k}, 0)`, `(0, ${b})`, `(${-b}, 0)`],
      hint: `令 y = 0，解 ${k}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = 0，得 x = ${answer}。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 数据分析
function dataAnalysis() {
  const items = []
  const sets = [[2, 4, 6, 8], [1, 3, 5, 7], [3, 5, 7, 9], [5, 7, 9, 11], [10, 12, 14, 16], [1, 3, 5, 7, 9], [2, 4, 6, 8, 10], [0, 2, 4, 6, 8], [4, 6, 8, 10, 12], [1, 2, 3, 4, 5]]
  sets.forEach((set, index) => {
    const mean = set.reduce((sum, value) => sum + value, 0) / set.length
    const variance = set.reduce((sum, value) => sum + (value - mean) ** 2, 0) / set.length
    items.push(makeQuestion({
      stem: `数据 ${set.join('、')} 的方差是（ ）`,
      correct: variance,
      wrongs: [variance + 1, variance - 1, variance * 2],
      hint: `平均数为 ${mean}，方差 = 各数与平均数差的平方的平均值 = ${variance}。`,
      difficulty: 3,
      dimension: 'method',
      seed: index
    }))
  })
  const modeSets = [[1, 2, 2, 3], [4, 5, 5, 5, 6], [2, 3, 3, 4, 5], [7, 8, 8, 9], [1, 1, 2, 3, 4], [6, 7, 7, 8, 9], [3, 4, 4, 4, 5], [8, 9, 9, 10], [2, 2, 3, 4, 4, 4], [5, 6, 6, 7, 8]]
  modeSets.forEach((set, index) => {
    const counts = new Map()
    set.forEach(value => counts.set(value, (counts.get(value) || 0) + 1))
    let answer = set[0]
    for (const [value, count] of counts) if (count > counts.get(answer)) answer = value
    items.push(makeQuestion({
      stem: `数据 ${set.join('、')} 的众数是（ ）`,
      correct: answer,
      wrongs: [answer + 1, answer - 1, set[0]],
      hint: `众数是出现次数最多的数据，${answer} 在这组数据中出现次数最多。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 10
    }))
  })
  const ranges = [[12, 3], [18, 5], [25, 7], [30, 4], [16, 9], [22, 6], [35, 11], [14, 2], [28, 13], [40, 8]]
  ranges.forEach(([max, min], index) => {
    const answer = max - min
    items.push(makeQuestion({
      stem: `一组数据中最大值为 ${max}，最小值为 ${min}，这组数据的极差是（ ）`,
      correct: answer,
      wrongs: [max + min, answer + 1, answer - 1],
      hint: `极差 = 最大值 - 最小值 = ${max} - ${min} = ${answer}。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 20
    }))
  })
  return items
}

export const grade8MathGenerators = {
  '三角形与全等': triangles,
  '轴对称与等腰三角形': axialSymmetry,
  '整式乘法与因式分解': multiplicationAndFactorization,
  '分式': fractions,
  '二次根式': radicals,
  '勾股定理': pythagorean,
  '平行四边形': parallelograms,
  '一次函数': linearFunctions,
  '数据分析': dataAnalysis
}

export const bankGroup = {
  grade: '初二',
  subject: '数学',
  edition: '人教版',
  generators: grade8MathGenerators
}
