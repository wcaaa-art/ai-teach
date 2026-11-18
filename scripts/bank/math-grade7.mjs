// 初一数学题库生成器：全部题目由可复算的算式生成，答案与解析来自同一份计算，
// 不依赖模型，也不会出现「解析对不上答案」的情况。每章 3 类题型 × 10 道变体。
import { makeQuestion } from './helpers.mjs'

// 有理数与数轴
function rationalNumbers() {
  const items = []
  const values = [-7, 5, -12, 9, -3, 8, -15, 6, -1, 11]
  values.forEach((value, index) => {
    const answer = -value
    items.push(makeQuestion({
      stem: `${value} 的相反数是（ ）`,
      correct: answer,
      wrongs: [value, Math.abs(value), value - 1],
      hint: `相反数只改变符号：${value} 的相反数是 ${answer}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const moves = [[-3, 5, 2], [4, 3, 6], [-6, 8, -2], [2, 7, -1], [-5, 4, 8], [7, 5, -4], [-8, 6, 3]]
  moves.forEach(([start, right, left], index) => {
    const answer = start + right - left
    items.push(makeQuestion({
      stem: `数轴上点 A 表示 ${start}，先向右移动 ${right} 个单位到点 B，再向左移动 ${left} 个单位到点 C，则点 C 表示的数是（ ）`,
      correct: answer,
      wrongs: [start - right + left, start + right + left, start - right - left],
      hint: `向右记作加、向左记作减：${start} + ${right} - ${left} = ${answer}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const absolute = [-9, 4, -17, 12, -6, 20, -25]
  absolute.forEach((value, index) => {
    items.push(makeQuestion({
      stem: `|${value}| =（ ）`,
      correct: Math.abs(value),
      wrongs: [value, -Math.abs(value) - 1, Math.abs(value) + 1],
      hint: `绝对值表示到原点的距离，恒为非负数，所以 |${value}| = ${Math.abs(value)}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 20
    }))
  })
  // 补足 30 道：正负数的加减混合运算
  const sums = [[-8, 5], [7, -12], [-6, -9], [13, -4], [-11, 3], [9, -15], [-2, 17], [15, -15], [-19, 6], [4, -21]]
  sums.forEach(([a, b], index) => {
    const answer = a + b
    items.push(makeQuestion({
      stem: `计算 ${a} + (${b}) 的结果是（ ）`,
      correct: answer,
      wrongs: [a - b, -a + b, -a - b],
      hint: `${a} + (${b}) = ${answer}：异号相加取绝对值较大的加数的符号，再用较大绝对值减去较小绝对值。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 30
    }))
  })
  return items
}

// 整式加减
function polynomialOperations() {
  const items = []
  const combines = [[3, 2, 1], [5, -3, 1], [-4, 7, 2], [6, -2, -1], [8, -5, 4], [-3, -6, 2], [9, 4, -5], [2, -8, 6], [-7, 9, -3], [11, -4, -3]]
  combines.forEach(([a, b, c], index) => {
    const coefficient = a + b - c
    items.push(makeQuestion({
      stem: `计算 ${a}a + ${b}a - ${c}a 的结果是（ ）`,
      correct: `${coefficient}a`,
      wrongs: [`${coefficient}a²`, `${a + b + c}a`, `${a - b + c}a`],
      hint: `同类项系数相加减：${a} + ${b} - ${c} = ${coefficient}，字母部分不变，得 ${coefficient}a。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const evaluations = [[-2, 2, -3, 1], [1, 3, -2, 4], [-1, 4, 5, -2], [2, 1, -6, 3], [-3, 2, 4, -1], [0, 5, -3, 2], [3, 2, -1, -5], [-2, 3, 2, 6], [1, 4, -5, 1], [-1, 2, 7, -3]]
  evaluations.forEach(([x, a, b, c], index) => {
    const answer = a * x * x + b * x + c
    items.push(makeQuestion({
      stem: `当 x = ${x} 时，代数式 ${a}x² ${b >= 0 ? '+' : '-'} ${Math.abs(b)}x ${c >= 0 ? '+' : '-'} ${Math.abs(c)} 的值是（ ）`,
      correct: answer,
      wrongs: [a * x + b * x + c, a * x * x - b * x + c, a * x * x + b * x - c],
      hint: `代入得 ${a}×(${x})² ${b >= 0 ? '+' : '-'} ${Math.abs(b)}×(${x}) ${c >= 0 ? '+' : '-'} ${Math.abs(c)} = ${answer}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const brackets = [[5, 3, -2], [7, -4, 6], [9, 2, 8], [6, -5, -3], [8, 4, -7], [12, -6, 5], [10, 3, 9], [4, -8, -2], [15, 7, -6], [11, -2, 4]]
  brackets.forEach(([a, b, c], index) => {
    const answer = `${a - b - c}`
    items.push(makeQuestion({
      stem: `化简 ${a} - (${b} + ${c}) 的结果是（ ）`,
      correct: answer,
      wrongs: [`${a - b + c}`, `${a + b + c}`, `${a + b - c}`],
      hint: `去括号时括号前是负号，括号内各项都变号：${a} - ${b} - ${c} = ${answer}。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 一元一次方程
function linearEquations() {
  const items = []
  const basics = [[3, 7, 22], [5, -4, 16], [2, 9, 25], [4, -3, 21], [6, 5, 35], [7, -8, 20], [8, 3, 43], [9, -6, 30], [5, 11, 46], [3, -12, 9]]
  basics.forEach(([a, b, c], index) => {
    const answer = (c - b) / a
    items.push(makeQuestion({
      stem: `解方程 ${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = ${c}，x =（ ）`,
      correct: answer,
      wrongs: [answer + 1, answer - 1, -answer],
      hint: `移项得 ${a}x = ${c} ${b >= 0 ? '-' : '+'} ${Math.abs(b)} = ${c - b}，两边同除以 ${a}，得 x = ${answer}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const grouped = [[2, 3, 14], [3, -2, 15], [4, 5, 36], [5, -1, 20], [6, 2, 48], [7, -3, 28], [8, 4, 72], [3, 6, 27], [9, -5, 36], [4, -7, 12]]
  grouped.forEach(([a, b, c], index) => {
    const answer = c / a - b
    items.push(makeQuestion({
      stem: `解方程 ${a}(x ${b >= 0 ? '+' : '-'} ${Math.abs(b)}) = ${c}，x =（ ）`,
      correct: answer,
      wrongs: [answer + 1, answer - 1, c / a + b],
      hint: `两边同除以 ${a} 得 x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} = ${c / a}，再移项得 x = ${answer}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  // 行程应用题：速度×时间，答案唯一
  const trips = [[60, 3, 90], [80, 2, 40], [45, 4, 60], [75, 3, 45], [100, 2, 80], [90, 4, 120], [50, 3, 60], [120, 2, 100], [70, 5, 50], [85, 2, 70]]
  trips.forEach(([meetSpeed, hours, earlySpeed], index) => {
    const distance = meetSpeed * hours
    const answer = distance / earlySpeed
    items.push(makeQuestion({
      stem: `甲、乙两地相距 ${distance} 千米。汽车以 ${meetSpeed} 千米/时的速度从甲地到乙地，返回时速度改为 ${earlySpeed} 千米/时，返回用时多少小时？`,
      correct: answer,
      wrongs: [distance / meetSpeed, distance * earlySpeed, distance / (meetSpeed + earlySpeed)],
      hint: `路程 ÷ 速度 = 时间：${distance} ÷ ${earlySpeed} = ${answer} 小时。`,
      difficulty: 2,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

// 几何图形初步
function geometryBasics() {
  const items = []
  const angles = [35, 48, 62, 71, 18, 56, 83, 27, 44, 69]
  angles.forEach((angle, index) => {
    items.push(makeQuestion({
      stem: `一个角为 ${angle}°，它的余角是（ ）`,
      correct: 90 - angle,
      wrongs: [180 - angle, angle, 90 + angle],
      hint: `两个角互余，和为 90°：90° - ${angle}° = ${90 - angle}°。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const supplements = [112, 95, 134, 78, 156, 103, 67, 141, 89, 124]
  supplements.forEach((angle, index) => {
    items.push(makeQuestion({
      stem: `一个角为 ${angle}°，它的补角是（ ）`,
      correct: 180 - angle,
      wrongs: [90 - angle, angle, 180 + angle],
      hint: `两个角互补，和为 180°：180° - ${angle}° = ${180 - angle}°。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  // 线段中点：M、N 分别是 AC、BC 中点，MN = AB/2
  const segments = [8, 10, 12, 14, 16, 18, 20, 22, 24, 26]
  segments.forEach((length, index) => {
    items.push(makeQuestion({
      stem: `点 C 在线段 AB 上，AB = ${length} cm，M、N 分别是 AC、BC 的中点，则 MN 的长为（ ）`,
      correct: length / 2,
      wrongs: [length, length / 4, length * 2],
      hint: `MN = AC/2 + BC/2 = (AC + BC)/2 = AB/2 = ${length} ÷ 2 = ${length / 2} cm。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 相交线与平行线
function linesAndAngles() {
  const items = []
  const baseAngles = [40, 55, 72, 28, 63, 35, 81, 49, 26, 74]
  baseAngles.forEach((angle, index) => {
    items.push(makeQuestion({
      stem: `两条直线相交，其中一个角为 ${angle}°，与它相邻的邻补角是（ ）`,
      correct: 180 - angle,
      wrongs: [angle, 90 - angle, 180 + angle],
      hint: `邻补角互补：180° - ${angle}° = ${180 - angle}°。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const parallelAngles = [65, 48, 112, 75, 37, 124, 58, 96, 143, 82]
  parallelAngles.forEach((angle, index) => {
    const answer = 180 - angle
    items.push(makeQuestion({
      stem: `直线 a ∥ b，一条截线与它们相交。若其中一个同旁内角为 ${angle}°，则另一个同旁内角为（ ）`,
      correct: answer,
      wrongs: [angle, answer + 10, answer - 10],
      hint: `两直线平行，同旁内角互补：180° - ${angle}° = ${answer}°。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const zigzags = [[70, 150], [110, 140], [85, 95], [125, 115], [60, 120], [100, 80], [135, 45], [45, 135], [150, 30], [75, 105]]
  zigzags.forEach(([left, right], index) => {
    // 两平行线间的折线：拐角 = 两个已知角之和
    const answer = left + right
    items.push(makeQuestion({
      stem: `两条平行线之间有一条折线，折线在两条平行线处的内角分别为 ${left}° 和 ${right}°，则折线的拐角是（ ）`,
      correct: answer,
      wrongs: [Math.abs(left - right), 180 - left, 360 - answer],
      hint: `过拐点作平行线，拐角被分成两个内错角，分别等于 ${left}° 和 ${right}°，所以拐角为 ${left}° + ${right}° = ${answer}°。`,
      difficulty: 3,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

// 实数与平方根
function realNumbers() {
  const items = []
  const squares = [9, 16, 25, 36, 49, 64, 81, 100, 121, 144]
  squares.forEach((square, index) => {
    const answer = Math.sqrt(square)
    items.push(makeQuestion({
      stem: `${square} 的算术平方根是（ ）`,
      correct: answer,
      wrongs: [-answer, square / 2, answer * 2],
      hint: `算术平方根取非负值：${answer}² = ${square}，所以算术平方根为 ${answer}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const cubes = [8, 27, 64, 125, 216, 343, 512, 729, 1000, 1728]
  cubes.forEach((cube, index) => {
    const answer = Math.cbrt(cube)
    items.push(makeQuestion({
      stem: `${cube} 的立方根是（ ）`,
      correct: answer,
      wrongs: [answer * 1.5, cube / 3, answer * answer],
      hint: `${answer}³ = ${cube}，所以立方根为 ${answer}。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  // 估算：n 介于两个连续整数之间
  const estimate = [[7, 2], [13, 3], [20, 4], [30, 5], [44, 6], [55, 7], [70, 8], [85, 9], [99, 9]]
  estimate.forEach(([value, lower], index) => {
    const answer = `在 ${lower} 和 ${lower + 1} 之间`
    items.push(makeQuestion({
      stem: `估算 √${value}，它的值（ ）`,
      correct: answer,
      wrongs: [`小于 ${lower}`, `大于 ${lower + 1}`, `等于 ${lower}`],
      hint: `${lower}² = ${lower * lower}，${lower + 1}² = ${(lower + 1) * (lower + 1)}，而 ${lower * lower} < ${value} < ${(lower + 1) * (lower + 1)}，所以 √${value} 在 ${lower} 和 ${lower + 1} 之间。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  // 补足 30 道
  const irrationals = ['√2', '√3', '√5', '√7', '√10', 'π', '√11', '√13']
  irrationals.forEach((value, index) => {
    items.push(makeQuestion({
      stem: `${value} 属于（ ）`,
      correct: '无理数',
      wrongs: ['整数', '分数', '有理数'],
      hint: `${value} 不能写成两个整数之比，是无限不循环小数，因此是无理数。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 30
    }))
  })
  const roots = [81, 121, 169, 196, 225, 256, 289]
  roots.forEach((square, index) => {
    const answer = Math.sqrt(square)
    items.push(makeQuestion({
      stem: `${square} 的平方根是（ ）`,
      correct: `±${answer}`,
      wrongs: [answer, -answer, square / 2],
      hint: `平方根有两个，互为相反数：${answer}² = ${square}，(-${answer})² = ${square}，所以平方根为 ±${answer}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 40
    }))
  })
  return items
}

// 平面直角坐标系
function coordinates() {
  const items = []
  const quadrants = [[3, 4], [-2, 5], [-4, -3], [6, -1], [5, 2], [-3, 7], [-6, -4], [8, -2], [1, 9], [-7, -5]]
  quadrants.forEach(([x, y], index) => {
    const quadrant = x > 0 && y > 0 ? '第一象限' : x < 0 && y > 0 ? '第二象限' : x < 0 && y < 0 ? '第三象限' : '第四象限'
    items.push(makeQuestion({
      stem: `点 P(${x}, ${y}) 位于平面直角坐标系的（ ）`,
      correct: quadrant,
      wrongs: ['第一象限', '第二象限', '第三象限', '第四象限'].filter(item => item !== quadrant).slice(0, 3),
      hint: `横坐标 ${x} ${x > 0 ? '>' : '<'} 0，纵坐标 ${y} ${y > 0 ? '>' : '<'} 0，所以点 P 在${quadrant}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const moves = [[2, 3, 4, -1], [-3, 5, 2, 2], [4, -2, -3, 1], [-5, -4, 6, -2], [1, 6, -2, -3], [6, 2, -4, 5], [-2, -7, 3, 4], [3, -1, 5, -6], [-4, 8, 1, -2], [5, 4, -1, 3]]
  moves.forEach(([x, y, dx, dy], index) => {
    const answer = `(${x + dx}, ${y + dy})`
    const horizontal = `向${dx > 0 ? '右' : '左'}平移 ${Math.abs(dx)} 个单位`
    const vertical = `向${dy > 0 ? '上' : '下'}平移 ${Math.abs(dy)} 个单位`
    items.push(makeQuestion({
      stem: `点 A(${x}, ${y}) 先${horizontal}，再${vertical}，得到点 A′，则点 A′ 的坐标是（ ）`,
      correct: answer,
      wrongs: [`(${x - dx}, ${y + dy})`, `(${x + dx}, ${y - dy})`, `(${x - dx}, ${y - dy})`],
      hint: `左右平移改变横坐标（右加左减），上下平移改变纵坐标（上加下减），所以 A′ 为 ${answer}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const symmetry = [[3, 5], [-4, 2], [6, -3], [-2, -7], [5, 4], [-6, 8], [7, -1], [-3, -5], [8, 2], [-5, 6]]
  symmetry.forEach(([x, y], index) => {
    items.push(makeQuestion({
      stem: `点 P(${x}, ${y}) 关于 x 轴对称的点的坐标是（ ）`,
      correct: `(${x}, ${-y})`,
      wrongs: [`(${-x}, ${y})`, `(${-x}, ${-y})`, `(${y}, ${x})`],
      hint: `关于 x 轴对称，横坐标不变、纵坐标互为相反数，所以是 (${x}, ${-y})。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 二元一次方程组
function systemsOfEquations() {
  const items = []
  // x + y = s, x - y = d → x=(s+d)/2, y=(s-d)/2
  const systems = [[9, 3], [12, 4], [15, 5], [8, 2], [14, 6], [11, 7], [20, 8], [18, 4], [25, 9], [16, 10]]
  systems.forEach(([sum, diff], index) => {
    const x = (sum + diff) / 2
    const y = (sum - diff) / 2
    items.push(makeQuestion({
      stem: `解方程组：x + y = ${sum}，x - y = ${diff}，则（ ）`,
      correct: `x = ${x}, y = ${y}`,
      wrongs: [`x = ${y}, y = ${x}`, `x = ${x + 1}, y = ${y - 1}`, `x = ${x - 1}, y = ${y + 1}`],
      hint: `两式相加得 2x = ${sum + diff}，x = ${x}；代回得 y = ${y}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  // 2x + y = a, x + y = b → x = a-b, y = 2b-a
  const pairs = [[11, 7], [13, 8], [17, 10], [9, 5], [21, 12], [15, 9], [19, 11], [23, 14], [25, 15], [27, 16]]
  pairs.forEach(([a, b], index) => {
    const x = a - b
    items.push(makeQuestion({
      stem: `已知 2x + y = ${a}，x + y = ${b}，则 x 的值是（ ）`,
      correct: x,
      wrongs: [b, a + b, a - 2 * b],
      hint: `两式相减消去 y：(2x + y) - (x + y) = ${a} - ${b}，得 x = ${x}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  // 应用题：总价减去笔记本部分，剩下的是笔的总价，再除以笔的数量
  const shops = [[3, 2, 24], [4, 3, 29], [5, 2, 26], [2, 6, 34], [7, 1, 17], [3, 5, 36], [6, 4, 48], [8, 3, 49], [4, 7, 33], [5, 6, 63]]
  shops.forEach(([pens, notebooks, total], index) => {
    const unitNotebook = 3
    const answer = (total - notebooks * unitNotebook) / pens
    items.push(makeQuestion({
      stem: `学校买 ${pens} 支笔和 ${notebooks} 本笔记本共 ${total} 元，已知每本笔记本 ${unitNotebook} 元，每支笔（ ）元`,
      correct: answer,
      wrongs: [answer + 1, answer - 1, total / pens],
      hint: `笔记本共 ${notebooks * unitNotebook} 元，笔共 ${total - notebooks * unitNotebook} 元，${total - notebooks * unitNotebook} ÷ ${pens} = ${answer} 元。`,
      difficulty: 2,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

// 不等式与不等式组
function inequalities() {
  const items = []
  const basics = [[2, 3, 11], [3, -4, 8], [4, 5, 21], [5, -2, 13], [6, 7, 37], [7, -3, 18], [8, 1, 33], [9, -5, 31], [3, 8, 29], [4, -6, 14]]
  basics.forEach(([a, b, c], index) => {
    const boundary = (c - b) / a
    const answer = `x > ${boundary}`
    items.push(makeQuestion({
      stem: `解不等式 ${a}x ${b >= 0 ? '+' : '-'} ${Math.abs(b)} > ${c}，解集是（ ）`,
      correct: answer,
      wrongs: [`x < ${boundary}`, `x > ${boundary + 1}`, `x < ${boundary + 1}`],
      hint: `移项得 ${a}x > ${c - b}，两边同除以正数 ${a}，不等号方向不变，得 ${answer}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  // 整数解个数：-n ≤ x ≤ n 之类
  const intergers = [[3, 1], [4, 2], [5, 3], [6, 1], [7, 4], [8, 2], [9, 5], [10, 3], [11, 6], [12, 4]]
  intergers.forEach(([max, min], index) => {
    const count = max - min + 1
    items.push(makeQuestion({
      stem: `满足不等式 ${min} ≤ x ≤ ${max} 的整数 x 共有（ ）个`,
      correct: count,
      wrongs: [count - 1, count + 1, max + min],
      hint: `从 ${min} 到 ${max} 逐个计数，共 ${max} - ${min} + 1 = ${count} 个整数。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  // 应用题：按包采购，向上取整
  const budgets = [[5, 3, 40], [6, 4, 50], [7, 5, 60], [8, 2, 45], [9, 6, 75], [10, 3, 55], [4, 7, 62], [12, 5, 85], [11, 8, 90], [15, 4, 70]]
  budgets.forEach(([perPack, owned, target], index) => {
    const gap = target - owned
    const need = Math.ceil(gap / perPack)
    items.push(makeQuestion({
      stem: `学校已有 ${owned} 本练习册，每包 ${perPack} 本，要凑够至少 ${target} 本，至少要再买几包？`,
      correct: need,
      wrongs: [need - 1, need + 1, Math.floor(gap / perPack)],
      hint: `还差 ${gap} 本，${gap} ÷ ${perPack} ≈ ${(gap / perPack).toFixed(2)}，向上取整得 ${need} 包。`,
      difficulty: 3,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

// 数据收集与整理
function dataLiteracy() {
  const items = []
  const averages = [[80, 90, 100], [70, 80, 90], [60, 75, 90], [85, 95, 100], [50, 70, 90], [88, 92, 96], [65, 75, 85], [72, 84, 96], [90, 90, 90], [55, 65, 75]]
  averages.forEach((set, index) => {
    const sum = set.reduce((left, right) => left + right, 0)
    const answer = sum / set.length
    items.push(makeQuestion({
      stem: `数据 ${set.join('、')} 的平均数是（ ）`,
      correct: answer,
      wrongs: [sum, answer + 5, answer - 5],
      hint: `平均数 = 总和 ÷ 个数 = ${sum} ÷ ${set.length} = ${answer}。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const medians = [[3, 5, 7, 9, 11], [2, 4, 6, 8], [1, 3, 5, 7, 9, 11], [10, 20, 30], [4, 8, 12, 16], [5, 10, 15, 20, 25], [6, 12, 18], [7, 14, 21, 28], [9, 18, 27, 36, 45], [8, 16, 24, 32]]
  medians.forEach((set, index) => {
    const middle = Math.floor(set.length / 2)
    const answer = set.length % 2 ? set[middle] : (set[middle - 1] + set[middle]) / 2
    items.push(makeQuestion({
      stem: `数据 ${set.join('、')} 的中位数是（ ）`,
      correct: answer,
      wrongs: [set[0], set[set.length - 1], Math.round((set[0] + set[set.length - 1]) / 2)],
      hint: `数据已按从小到大排列，共 ${set.length} 个，${set.length % 2 ? `中位数是第 ${middle + 1} 个数 ${answer}` : `中位数是中间两个数的平均数 (${set[middle - 1]} + ${set[middle]}) ÷ 2 = ${answer}`}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const counts = [[12, 40], [15, 50], [18, 60], [21, 70], [24, 80], [9, 45], [27, 90], [30, 75], [33, 110], [36, 120]]
  counts.forEach(([part, total], index) => {
    const answer = `${(part / total) * 100}%`
    items.push(makeQuestion({
      stem: `某班 ${total} 人中，喜欢篮球的有 ${part} 人，喜欢篮球的人数占全班人数的百分比是（ ）`,
      correct: answer,
      wrongs: [`${(total / part) * 100}%`, `${(part / total) * 10}%`, `${part}%`],
      hint: `百分比 = 部分 ÷ 总数 × 100% = ${part} ÷ ${total} × 100% = ${answer}。`,
      difficulty: 1,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

export const grade7MathGenerators = {
  '有理数与数轴': rationalNumbers,
  '整式加减': polynomialOperations,
  '一元一次方程': linearEquations,
  '几何图形初步': geometryBasics,
  '相交线与平行线': linesAndAngles,
  '实数与平方根': realNumbers,
  '平面直角坐标系': coordinates,
  '二元一次方程组': systemsOfEquations,
  '不等式与不等式组': inequalities,
  '数据收集与整理': dataLiteracy
}

export const bankGroup = {
  grade: '初一',
  subject: '数学',
  edition: '人教版',
  generators: grade7MathGenerators
}
