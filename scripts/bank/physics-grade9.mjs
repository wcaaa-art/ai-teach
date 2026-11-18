// 初三物理题库生成器：每章 4 类模板 × 10 道变体，答案全部由公式现算或教材结论给出。
import { makeQuestion } from './helpers.mjs'

// 浮力与压强综合：F浮 = ρ液gV排、p = ρgh、p = F/S、浮沉条件
function buoyancyAndPressure() {
  const items = []
  const buoyancyCases = [[1000, 0.002], [1000, 0.005], [1000, 0.01], [800, 0.002], [800, 0.005], [1030, 0.001], [1000, 0.0005], [800, 0.01], [1030, 0.002], [1000, 0.003]]
  buoyancyCases.forEach(([rho, V], index) => {
    const F = Number((rho * 10 * V).toFixed(6))
    items.push(makeQuestion({
      stem: `体积为 ${V} m³ 的物体浸没在密度为 ${rho} kg/m³ 的液体中，受到的浮力是（g 取 10 N/kg）（ ）`,
      correct: `${F} N`,
      wrongs: [`${Number((F * 2).toFixed(6))} N`, `${Number((F / 2).toFixed(6))} N`, `${Number((F * 1.5).toFixed(6))} N`],
      hint: `F浮 = ρ液gV排 = ${rho} × 10 × ${V} = ${F} N。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const liquidCases = [[1000, 0.2], [1000, 0.5], [1000, 1], [1000, 1.5], [800, 0.5], [800, 1], [1030, 0.5], [1000, 2], [800, 2], [1030, 1]]
  liquidCases.forEach(([rho, h], index) => {
    const p = Number((rho * 10 * h).toFixed(6))
    items.push(makeQuestion({
      stem: `密度为 ${rho} kg/m³ 的液体中，深度 ${h} m 处的压强是（g 取 10 N/kg）（ ）`,
      correct: `${p} Pa`,
      wrongs: [`${p * 2} Pa`, `${p / 2} Pa`, `${p + 1000} Pa`],
      hint: `p = ρgh = ${rho} × 10 × ${h} = ${p} Pa。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const solidCases = [[20, 0.02], [40, 0.05], [60, 0.03], [10, 0.01], [30, 0.06], [50, 0.02], [80, 0.04], [5, 0.005], [12, 0.04], [90, 0.09]]
  solidCases.forEach(([m, S], index) => {
    const G = m * 10
    const p = Number((G / S).toFixed(6))
    items.push(makeQuestion({
      stem: `质量为 ${m} kg 的物体放在面积为 ${S} m² 的水平桌面上，它对桌面的压强是（g 取 10 N/kg）（ ）`,
      correct: `${p} Pa`,
      wrongs: [`${Number((m / S).toFixed(6))} Pa`, `${p * 2} Pa`, `${p / 2} Pa`],
      hint: `压力等于重力 F = mg = ${G} N，p = F/S = ${G} ÷ ${S} = ${p} Pa。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  const floatCases = [[10, 20, '上浮'], [20, 10, '下沉'], [15, 15, '悬浮'], [8, 20, '上浮'], [30, 12, '下沉'], [25, 25, '悬浮'], [5, 15, '上浮'], [40, 10, '下沉'], [12, 18, '上浮'], [50, 50, '悬浮']]
  const floatPool = ['上浮', '下沉', '悬浮', '无法判断']
  floatCases.forEach(([G, F, answer], index) => {
    const rule = F > G ? `F浮 = ${F} N > G = ${G} N，物体上浮`
      : F < G ? `F浮 = ${F} N < G = ${G} N，物体下沉`
        : `F浮 = ${F} N = G = ${G} N，物体悬浮`
    items.push(makeQuestion({
      stem: `一个物体重 ${G} N，完全浸没在水中时受到的浮力为 ${F} N，松手后该物体将（ ）`,
      correct: answer,
      wrongs: floatPool.filter(option => option !== answer).slice(0, 3),
      hint: `比较浮力与重力：${rule}。`,
      difficulty: 2,
      dimension: 'transfer',
      seed: index + 30
    }))
  })
  return items
}

// 功与机械能：W = Fs、P = W/t、机械能转化、做功的必要因素
function workAndEnergy() {
  const items = []
  const workCases = [[50, 10], [100, 5], [200, 2], [20, 20], [150, 4], [300, 3], [80, 10], [60, 15], [400, 5], [25, 8]]
  workCases.forEach(([F, s], index) => {
    const W = F * s
    items.push(makeQuestion({
      stem: `用 ${F} N 的水平推力使物体沿力的方向移动 ${s} m，推力做的功是（ ）`,
      correct: `${W} J`,
      wrongs: [`${W * 2} J`, `${W / 2} J`, `${W + 100} J`],
      hint: `W = Fs = ${F} N × ${s} m = ${W} J。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const powerCases = [[600, 5], [1000, 4], [1500, 6], [2400, 8], [3200, 10], [450, 3], [750, 5], [900, 4], [1200, 6], [1800, 8]]
  powerCases.forEach(([W, t], index) => {
    const P = W / t
    items.push(makeQuestion({
      stem: `某机器在 ${t} s 内做功 ${W} J，它的功率是（ ）`,
      correct: `${P} W`,
      wrongs: [`${P * 2} W`, `${P / 2} W`, `${P + 50} W`],
      hint: `P = W/t = ${W} J ÷ ${t} s = ${P} W。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const conversions = [
    { stem: '滚摆下降过程中，它的重力势能（ ）', correct: '转化为动能', pool: ['转化为动能', '转化为重力势能', '保持不变', '转化为弹性势能'], hint: '高度降低、速度增大，重力势能转化为动能。' },
    { stem: '滚摆上升过程中，它的动能（ ）', correct: '转化为重力势能', pool: ['转化为重力势能', '转化为动能', '保持不变', '转化为内能'], hint: '速度减小、高度增大，动能转化为重力势能。' },
    { stem: '单摆由最高点向最低点摆动时，速度逐渐变大，这一过程是（ ）', correct: '重力势能转化为动能', pool: ['重力势能转化为动能', '动能转化为重力势能', '机械能总量增大', '弹性势能转化为动能'], hint: '高度降低、速度增大，重力势能转化为动能。' },
    { stem: '卫星从远地点向近地点运动时，它的（ ）', correct: '重力势能减小、动能增大', pool: ['重力势能减小、动能增大', '重力势能增大、动能减小', '重力势能和动能都增大', '重力势能和动能都减小'], hint: '远地点到近地点高度降低、速度增大。' },
    { stem: '物体自由下落过程中（不计空气阻力），它的机械能（ ）', correct: '保持不变', pool: ['保持不变', '不断增大', '不断减小', '先增大后减小'], hint: '只有重力做功，动能与势能相互转化，机械能守恒。' },
    { stem: '跳伞运动员匀速下降过程中，他的机械能（ ）', correct: '减小', pool: ['减小', '增大', '不变', '先减小后增大'], hint: '速度不变动能不变，高度降低重力势能减小，机械能减小。' },
    { stem: '汽车加速升坡过程中，它的机械能（ ）', correct: '增大', pool: ['增大', '减小', '不变', '无法判断'], hint: '速度和高度都增大，动能和重力势能都增大。' },
    { stem: '弯曲的弓把箭射出去时，弓的弹性势能主要转化为箭的（ ）', correct: '动能', pool: ['动能', '重力势能', '内能', '化学能'], hint: '弓恢复形变对箭做功，弹性势能转化为箭的动能。' },
    { stem: '小球从斜面顶端滚下并压缩弹簧，弹簧被压缩的过程中（ ）', correct: '动能转化为弹性势能', pool: ['动能转化为弹性势能', '弹性势能转化为动能', '重力势能转化为动能', '机械能总量增大'], hint: '弹簧形变增大，小球动能转化为弹簧的弹性势能。' },
    { stem: '在只有动能和势能相互转化时，物体的机械能总量（ ）', correct: '保持不变', pool: ['保持不变', '不断变化', '一定增大', '一定减小'], hint: '没有其他形式能量参与转化时，机械能守恒。' }
  ]
  conversions.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 2,
      dimension: index >= 5 ? 'transfer' : 'concept',
      seed: index + 20
    }))
  })
  const workJudgments = [
    { stem: '小明提着水桶在水平路面上匀速前进，他对水桶做的功是（ ）', correct: '零', pool: ['零', '正功', '负功', '无法判断'], hint: '提力竖直向上，水桶水平移动，力与位移垂直，不做功。' },
    { stem: '用力推讲台但没有推动，推力对讲台做的功是（ ）', correct: '零', pool: ['零', '正功', '负功', '无限大'], hint: '没有位移，力不做功。' },
    { stem: '举重运动员举着杠铃静止不动，运动员对杠铃做的功是（ ）', correct: '零', pool: ['零', '正功', '负功', '无法确定'], hint: '杠铃没有移动距离，不做功。' },
    { stem: '足球离开脚后靠惯性在草地上滚动，脚对足球做的功是（ ）', correct: '零', pool: ['零', '正功', '负功', '先正后负'], hint: '足球离开脚后，脚不再对球施加作用力，不做功。' },
    { stem: '起重机将货物竖直吊起一定高度，起重机拉力对货物做的功是（ ）', correct: '正功', pool: ['正功', '负功', '零', '无法判断'], hint: '拉力方向与货物位移方向相同，做正功。' },
    { stem: '人沿着楼梯从一楼走到三楼，人的重力对人做的功是（ ）', correct: '负功', pool: ['负功', '正功', '零', '无法判断'], hint: '重力竖直向下，人向上移动，重力做负功。' },
    { stem: '物体在水平面上滑动时，滑动摩擦力对物体做的功是（ ）', correct: '负功', pool: ['负功', '正功', '零', '无法判断'], hint: '摩擦力方向与位移方向相反，做负功。' },
    { stem: '做功的两个必要因素是（ ）', correct: '作用在物体上的力和物体在力的方向上通过的距离', pool: ['作用在物体上的力和物体在力的方向上通过的距离', '作用在物体上的力和物体的重力', '物体的质量和运动的时间', '物体的速度和运动的时间'], hint: '力与沿力方向的位移同时具备才做功。' },
    { stem: '下列过程中，人对物体做了功的是（ ）', correct: '人用力将箱子沿水平地面推动', pool: ['人用力将箱子沿水平地面推动', '人用力推墙但墙未动', '人提着重物在水平方向上匀速行走', '运动员举着杠铃静止不动'], hint: '只有推力方向上有位移时，人才对物体做功。' },
    { stem: '关于功的单位，下列正确的是（ ）', correct: '焦耳', pool: ['焦耳', '牛顿', '瓦特', '帕斯卡'], hint: '功的单位是焦耳（J），1 J = 1 N·m。' }
  ]
  workJudgments.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 2,
      dimension: index >= 7 ? 'error-analysis' : 'concept',
      seed: index + 30
    }))
  })
  return items
}

// 内能与热机：Q = cmΔt、Q = mq、热机效率、内能与热机概念
function heatAndEngines() {
  const items = []
  const heatCases = [[0.5, 80], [2, 30], [1, 40], [3, 20], [4, 10], [5, 10], [1.5, 20], [2.5, 40], [0.2, 50], [10, 5]]
  heatCases.forEach(([m, delta], index) => {
    const Q = 4200 * m * delta
    items.push(makeQuestion({
      stem: `质量为 ${m} kg 的水温度升高 ${delta} ℃，水吸收的热量是（c水 = 4.2×10^3 J/(kg·℃)）（ ）`,
      correct: `${Q} J`,
      wrongs: [`${Q * 2} J`, `${Q / 2} J`, `${Q + 21000} J`],
      hint: `Q吸 = cmΔt = 4200 × ${m} × ${delta} = ${Q} J。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const fuelCases = [1, 2, 3, 0.5, 1.5, 2.5, 0.2, 0.4, 0.6, 0.8]
  fuelCases.forEach((m, index) => {
    const c = m * 3
    items.push(makeQuestion({
      stem: `完全燃烧 ${m} kg 某种燃料，该燃料的热值为 3×10^7 J/kg，放出的热量是（ ）`,
      correct: `${c}×10^7 J`,
      wrongs: [`${c * 2}×10^7 J`, `${c / 2}×10^7 J`, `${c + 1}×10^7 J`],
      hint: `Q放 = mq = ${m} kg × 3×10^7 J/kg = ${c}×10^7 J。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const efficiencyCases = [[3, 10], [4, 8], [6, 10], [2.5, 10], [4.5, 9], [7, 10], [1.2, 6], [2, 5], [5.6, 8], [3.6, 9]]
  efficiencyCases.forEach(([work, total], index) => {
    const rate = (work / total) * 100
    items.push(makeQuestion({
      stem: `某热机消耗燃料放出的热量为 ${total}×10^6 J，用来做有用功的能量为 ${work}×10^6 J，该热机的效率是（ ）`,
      correct: `${rate}%`,
      wrongs: [`${rate + 10}%`, `${rate + 20}%`, `${100 - rate + 5}%`],
      hint: `η = W有用/Q放 × 100% = ${work}/${total} × 100% = ${rate}%。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  const concepts = [
    { stem: '走进花园能闻到花香，这一现象说明（ ）', correct: '分子在不停地做无规则运动', pool: ['分子在不停地做无规则运动', '分子间存在引力', '分子间存在斥力', '分子是静止的'], hint: '花香扩散到空气中，说明分子在不停地做无规则运动。' },
    { stem: '两种液体混合后总体积小于两者体积之和，说明（ ）', correct: '分子间存在空隙', pool: ['分子间存在空隙', '分子间存在引力', '分子间存在斥力', '分子停止了运动'], hint: '分子进入彼此的空隙中，总体积减小。' },
    { stem: '改变物体内能的两种方式是（ ）', correct: '做功和热传递', pool: ['做功和热传递', '摩擦和加热', '压缩和膨胀', '蒸发和凝固'], hint: '做功和热传递都能改变物体的内能。' },
    { stem: '四冲程汽油机的压缩冲程中，能量转化是（ ）', correct: '机械能转化为内能', pool: ['机械能转化为内能', '内能转化为机械能', '化学能转化为内能', '内能转化为化学能'], hint: '活塞压缩气体，机械能转化为气体内能。' },
    { stem: '四冲程汽油机的做功冲程中，能量转化是（ ）', correct: '内能转化为机械能', pool: ['内能转化为机械能', '机械能转化为内能', '化学能转化为机械能', '电能转化为内能'], hint: '高温高压燃气推动活塞做功，内能转化为机械能。' },
    { stem: '四冲程内燃机的一个工作循环包括（ ）', correct: '四个冲程，活塞往复两次', pool: ['四个冲程，活塞往复两次', '四个冲程，活塞往复一次', '两个冲程，活塞往复一次', '四个冲程，曲轴转一周'], hint: '一个工作循环有吸气、压缩、做功、排气四个冲程，活塞往复两次、曲轴转两周。' },
    { stem: '关于燃料的热值，下列说法正确的是（ ）', correct: '热值是燃料的一种特性，与燃料的质量无关', pool: ['热值是燃料的一种特性，与燃料的质量无关', '燃料质量越大，热值越大', '燃料燃烧越充分，热值越大', '热值就是燃料燃烧放出的热量'], hint: '热值只与燃料种类有关，与质量和是否完全燃烧无关。' },
    { stem: '汽车发动机常用水作冷却剂，主要是因为水的（ ）', correct: '比热容较大', pool: ['比热容较大', '密度较大', '热值较大', '沸点较低'], hint: '水的比热容大，相同质量升高相同温度吸热多，冷却效果好。' },
    { stem: '能量既不会凭空消灭，也不会凭空创生，这一规律称为（ ）', correct: '能量守恒定律', pool: ['能量守恒定律', '牛顿第一定律', '欧姆定律', '焦耳定律'], hint: '能量在转化和转移中总量保持不变，这是能量守恒定律。' },
    { stem: '四冲程内燃机中，对外做功的冲程是（ ）', correct: '做功冲程', pool: ['做功冲程', '压缩冲程', '吸气冲程', '排气冲程'], hint: '只有做功冲程中燃气推动活塞对外做功。' }
  ]
  concepts.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: index >= 6 ? 'transfer' : 'concept',
      seed: index + 30
    }))
  })
  return items
}

// 电流与电路：串联电流、并联电压、串联电阻、电路基础
function currentAndCircuits() {
  const items = []
  const currents = [0.2, 0.3, 0.4, 0.5, 0.6, 0.25, 0.15, 0.8, 1.2, 0.45]
  currents.forEach((i, index) => {
    items.push(makeQuestion({
      stem: `串联电路中通过灯泡 L1 的电流为 ${i} A，则通过灯泡 L2 的电流为（ ）`,
      correct: `${i} A`,
      wrongs: [`${i * 2} A`, `${i / 2} A`, `${i + 0.1} A`],
      hint: `串联电路中电流处处相等，所以通过 L2 的电流也是 ${i} A。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const voltages = [3, 4.5, 6, 9, 12, 2, 5, 7.5, 1.5, 10]
  voltages.forEach((U, index) => {
    items.push(makeQuestion({
      stem: `并联电路两端的电源电压为 ${U} V，则每个支路两端的电压为（ ）`,
      correct: `${U} V`,
      wrongs: [`${U * 2} V`, `${U / 2} V`, `${U + 1} V`],
      hint: `并联电路中各支路两端电压相等，且等于电源电压 ${U} V。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 10
    }))
  })
  const resistances = [[5, 10], [10, 20], [4, 6], [8, 12], [15, 25], [3, 7], [20, 30], [6, 14], [12, 18], [25, 5]]
  resistances.forEach(([r1, r2], index) => {
    const R = r1 + r2
    items.push(makeQuestion({
      stem: `两个电阻 R1 = ${r1} Ω、R2 = ${r2} Ω 串联接入电路，总电阻是（ ）`,
      correct: `${R} Ω`,
      wrongs: [`${R * 2} Ω`, `${R / 2} Ω`, `${R + 5} Ω`],
      hint: `串联电路总电阻等于各分电阻之和：R = ${r1} + ${r2} = ${R} Ω。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 20
    }))
  })
  const concepts = [
    { stem: '物理学规定电流的方向是（ ）', correct: '正电荷定向移动的方向', pool: ['正电荷定向移动的方向', '负电荷定向移动的方向', '自由电子移动的方向', '电压升高的方向'], hint: '规定正电荷定向移动的方向为电流方向。' },
    { stem: '金属导体中形成电流的自由电荷是（ ）', correct: '自由电子', pool: ['自由电子', '正离子', '负离子', '质子'], hint: '金属靠自由电子的定向移动导电。' },
    { stem: '下列物品中，属于绝缘体的是（ ）', correct: '橡皮', pool: ['橡皮', '铜丝', '盐水', '人体'], hint: '橡皮不容易导电，是绝缘体。' },
    { stem: '电源短路时，电路中（ ）', correct: '电流过大，可能烧坏电源', pool: ['电流过大，可能烧坏电源', '电流为零', '电压为零', '用电器正常工作'], hint: '短路时导线电阻很小，电流很大，会损坏电源。' },
    { stem: '串联电路中开关的作用是（ ）', correct: '控制整个电路', pool: ['控制整个电路', '只控制其中一个用电器', '控制两个用电器中的一个', '不起作用'], hint: '串联电路只有一个通路，开关控制整个电路。' },
    { stem: '并联电路中各支路的用电器（ ）', correct: '可以独立工作、互不影响', pool: ['可以独立工作、互不影响', '必须同时工作', '一个断路则全部断路', '总电阻等于各支路电阻之和'], hint: '并联各支路互不影响，可以独立工作。' },
    { stem: '使用电流表测量电流时，电流表应该（ ）', correct: '串联在被测电路中', pool: ['串联在被测电路中', '并联在被测电路中', '并联在电源两端', '与电压表串联'], hint: '电流表必须串联使用，否则会短路。' },
    { stem: '使用电压表测量电压时，电压表应该（ ）', correct: '并联在被测电路两端', pool: ['并联在被测电路两端', '串联在被测电路中', '串联在电源两端', '与电流表串联'], hint: '电压表必须并联使用。' },
    { stem: '电源在电路中的作用是（ ）', correct: '提供电能，使电路形成持续电流', pool: ['提供电能，使电路形成持续电流', '消耗电能', '测量电流大小', '保护用电器'], hint: '电源提供电压，使电路中形成持续电流。' },
    { stem: '用丝绸摩擦过的玻璃棒带正电，这是因为玻璃棒（ ）', correct: '失去了电子', pool: ['失去了电子', '得到了电子', '失去了质子', '得到了质子'], hint: '摩擦起电的实质是电子的转移，失去电子带正电。' }
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

// 欧姆定律：I = U/R 及其变形
function ohmsLaw() {
  const items = []
  const currentCases = [[6, 3], [12, 4], [10, 5], [9, 3], [8, 4], [15, 5], [20, 10], [24, 8], [18, 6], [16, 8]]
  currentCases.forEach(([U, R], index) => {
    const I = U / R
    items.push(makeQuestion({
      stem: `导体两端电压为 ${U} V，导体的电阻为 ${R} Ω，通过导体的电流是（ ）`,
      correct: `${I} A`,
      wrongs: [`${I * 2} A`, `${I / 2} A`, `${I + 1} A`],
      hint: `由欧姆定律 I = U/R = ${U} V ÷ ${R} Ω = ${I} A。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const voltageCases = [[2, 5], [3, 4], [0.5, 20], [1.5, 4], [2.5, 8], [0.2, 50], [4, 3], [0.3, 30], [1.2, 10], [0.6, 15]]
  voltageCases.forEach(([I, R], index) => {
    const U = I * R
    items.push(makeQuestion({
      stem: `通过导体的电流为 ${I} A，导体的电阻为 ${R} Ω，导体两端的电压是（ ）`,
      correct: `${U} V`,
      wrongs: [`${U * 2} V`, `${U / 2} V`, `${U + 1} V`],
      hint: `由 I = U/R 得 U = IR = ${I} A × ${R} Ω = ${U} V。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const resistanceCases = [[12, 2], [9, 3], [20, 4], [15, 5], [6, 0.5], [18, 0.6], [10, 0.2], [24, 0.8], [36, 0.4], [8, 0.4]]
  resistanceCases.forEach(([U, I], index) => {
    const R = U / I
    items.push(makeQuestion({
      stem: `导体两端电压为 ${U} V，通过导体的电流为 ${I} A，导体的电阻是（ ）`,
      correct: `${R} Ω`,
      wrongs: [`${R * 2} Ω`, `${R / 2} Ω`, `${R + 10} Ω`],
      hint: `由 I = U/R 得 R = U/I = ${U} V ÷ ${I} A = ${R} Ω。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  const concepts = [
    { stem: '导体的电阻是导体本身的一种性质，它的大小与下列哪组因素无关（ ）', correct: '导体两端的电压和通过的电流', pool: ['导体两端的电压和通过的电流', '导体的材料和长度', '导体的横截面积', '导体的温度'], hint: '电阻由材料、长度、横截面积和温度决定，与电压、电流无关。' },
    { stem: '滑动变阻器在电路中的主要作用是（ ）', correct: '改变接入电路的电阻，从而改变电流', pool: ['改变接入电路的电阻，从而改变电流', '测量电路中的电流', '测量电路两端的电压', '提供电能'], hint: '滑动变阻器通过改变接入电阻丝的长度来改变电阻。' },
    { stem: '用伏安法测电阻，需要测量的物理量是（ ）', correct: '电压和电流', pool: ['电压和电流', '电压和电阻', '电流和电阻', '电功率和时间'], hint: '伏安法测电阻利用 R = U/I，需测电压和电流。' },
    { stem: '两个电阻并联后，总电阻（ ）', correct: '小于其中任意一个电阻', pool: ['小于其中任意一个电阻', '大于其中任意一个电阻', '等于两个电阻之和', '等于两个电阻之积'], hint: '并联相当于增大了导体的横截面积，总电阻变小。' },
    { stem: '两个电阻串联后，总电阻（ ）', correct: '等于两个电阻之和', pool: ['等于两个电阻之和', '小于其中任意一个电阻', '等于两个电阻之积', '等于两个电阻的平均值'], hint: '串联电路总电阻等于各分电阻之和。' },
    { stem: '超导现象是指某些物质在温度降到某一值时，电阻（ ）', correct: '变为零', pool: ['变为零', '变为无穷大', '保持不变', '先变大后变小'], hint: '超导体的电阻为零，可减少输电损耗。' },
    { stem: '半导体材料的导电能力（ ）', correct: '介于导体和绝缘体之间', pool: ['介于导体和绝缘体之间', '比导体强', '比绝缘体弱', '始终为零'], hint: '半导体的导电性能介于导体和绝缘体之间。' },
    { stem: '在串联电路中，电阻越大的导体两端的电压（ ）', correct: '越大', pool: ['越大', '越小', '不变', '为零'], hint: '串联电路电流相等，由 U = IR 可知电阻越大分得的电压越大。' },
    { stem: '欧姆定律的表达式是（ ）', correct: 'I = U/R', pool: ['I = U/R', 'I = UR', 'U = I/R', 'R = UI'], hint: '导体中电流与电压成正比，与电阻成反比，I = U/R。' },
    { stem: '电阻的国际单位是（ ）', correct: '欧姆', pool: ['欧姆', '伏特', '安培', '瓦特'], hint: '电阻的单位是欧姆（Ω）。' }
  ]
  concepts.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: index >= 6 ? 'transfer' : 'concept',
      seed: index + 30
    }))
  })
  return items
}

// 电功率与家庭电路：P = UI、W = Pt、家庭电路电流、安全用电
function electricPower() {
  const items = []
  const powerCases = [[220, 0.5], [220, 1], [220, 2], [220, 5], [6, 0.5], [12, 2], [36, 0.5], [220, 0.2], [110, 2], [24, 1.5]]
  powerCases.forEach(([U, I], index) => {
    const P = U * I
    items.push(makeQuestion({
      stem: `某用电器两端电压为 ${U} V，通过的电流为 ${I} A，它的电功率是（ ）`,
      correct: `${P} W`,
      wrongs: [`${P * 2} W`, `${P / 2} W`, `${P + 10} W`],
      hint: `P = UI = ${U} V × ${I} A = ${P} W。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index
    }))
  })
  const energyCases = [[1, 2], [0.5, 4], [2, 0.5], [1.5, 2], [0.1, 10], [2.5, 2], [3, 4], [0.8, 5], [1.2, 3], [0.05, 20]]
  energyCases.forEach(([P, t], index) => {
    const W = P * t
    items.push(makeQuestion({
      stem: `某用电器功率为 ${P} kW，正常工作 ${t} h，消耗的电能是（ ）`,
      correct: `${W} kW·h`,
      wrongs: [`${W * 2} kW·h`, `${W / 2} kW·h`, `${W + 0.5} kW·h`],
      hint: `W = Pt = ${P} kW × ${t} h = ${W} kW·h。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const homeCases = [220, 440, 660, 880, 1100, 1320, 1540, 1760, 1980, 2200]
  homeCases.forEach((P, index) => {
    const I = P / 220
    items.push(makeQuestion({
      stem: `家庭电路电压为 220 V，某用电器功率为 ${P} W，正常工作时通过它的电流是（ ）`,
      correct: `${I} A`,
      wrongs: [`${I * 2} A`, `${I / 2} A`, `${I + 0.5} A`],
      hint: `由 P = UI 得 I = P/U = ${P} W ÷ 220 V = ${I} A。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  const concepts = [
    { stem: '家庭电路中的两根输电线分别是（ ）', correct: '火线和零线', pool: ['火线和零线', '火线和地线', '零线和地线', '相线和中性线'], hint: '家庭电路由火线和零线供电，三孔插座另接地线。' },
    { stem: '控制电灯的开关应接在（ ）', correct: '火线与电灯之间', pool: ['火线与电灯之间', '零线与电灯之间', '地线与电灯之间', '两根火线之间'], hint: '开关接在火线上，断开开关后电灯不带电，更安全。' },
    { stem: '三孔插座中较长的那个孔应连接（ ）', correct: '地线', pool: ['地线', '火线', '零线', '火线或零线'], hint: '三孔插座的上孔接地线，防止外壳漏电触电。' },
    { stem: '家庭电路中保险丝的作用是（ ）', correct: '电流过大时自动切断电路', pool: ['电流过大时自动切断电路', '增大电路电流', '提高电路电压', '节约电能'], hint: '保险丝利用电流热效应，电流过大时熔断保护电路。' },
    { stem: '家庭电路中总功率过大时，会导致（ ）', correct: '干路电流过大，保险丝熔断', pool: ['干路电流过大，保险丝熔断', '干路电流过小', '各用电器电压升高', '电路总电阻变大'], hint: '电压一定时总功率越大，干路电流越大。' },
    { stem: '发现有人触电时，首先应该（ ）', correct: '切断电源或用绝缘物挑开电线', pool: ['切断电源或用绝缘物挑开电线', '直接用手拉开触电者', '用水冲洗触电者', '立即离开现场'], hint: '必须先断电或用绝缘物使人脱离电源，再施救。' },
    { stem: '不能用湿手触摸用电器的原因是（ ）', correct: '水是导体，容易使人触电', pool: ['水是导体，容易使人触电', '湿手会损坏用电器', '湿手会改变电压', '湿手会增大电阻'], hint: '湿手导电能力增强，接触带电体易发生触电事故。' },
    { stem: '使用测电笔辨别火线时，手应接触（ ）', correct: '笔尾金属体', pool: ['笔尾金属体', '笔尖金属体', '笔杆绝缘部分', '电线外皮'], hint: '手接触笔尾金属体，笔尖接触导线，氖管发光的是火线。' },
    { stem: '我国家庭电路的电压和安全电压分别是（ ）', correct: '220 V 和不高于 36 V', pool: ['220 V 和不高于 36 V', '380 V 和不高于 36 V', '220 V 和不高于 220 V', '110 V 和不高于 36 V'], hint: '我国家庭电路电压为 220 V，安全电压不高于 36 V。' },
    { stem: '家庭电路中各用电器之间的连接方式是（ ）', correct: '并联', pool: ['并联', '串联', '混联', '依次串联'], hint: '各用电器并联，才能独立工作、互不影响。' }
  ]
  concepts.forEach((item, index) => {
    items.push(makeQuestion({
      stem: item.stem,
      correct: item.correct,
      wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
      hint: item.hint,
      difficulty: 1,
      dimension: index >= 5 ? 'error-analysis' : 'concept',
      seed: index + 30
    }))
  })
  return items
}

// 电磁现象：磁现象、电生磁、电动机与发电机、电磁感应与信息传递
function electromagnetism() {
  const items = []
  const magnetism = [
    { stem: '磁体周围存在（ ）', correct: '磁场', pool: ['磁场', '电场', '电流', '磁感线'], hint: '磁体周围存在磁场，看不见摸不着，能对磁体产生力的作用。' },
    { stem: '在磁体外部，磁感线的方向是（ ）', correct: '从 N 极出发回到 S 极', pool: ['从 N 极出发回到 S 极', '从 S 极出发回到 N 极', '从两极同时出发', '与磁体无关'], hint: '磁体外部磁感线从 N 极到 S 极，内部从 S 极到 N 极。' },
    { stem: '两个磁体的同名磁极靠近时，它们会（ ）', correct: '相互排斥', pool: ['相互排斥', '相互吸引', '没有作用', '先吸引后排斥'], hint: '同名磁极相互排斥，异名磁极相互吸引。' },
    { stem: '两个磁体的异名磁极靠近时，它们会（ ）', correct: '相互吸引', pool: ['相互吸引', '相互排斥', '没有作用', '先排斥后吸引'], hint: '异名磁极相互吸引。' },
    { stem: '指南针能指示南北方向，是因为（ ）', correct: '地球周围存在地磁场', pool: ['地球周围存在地磁场', '地球是导体', '指南针带正电', '空气有浮力'], hint: '小磁针在地磁场中受力，静止时指向南北。' },
    { stem: '关于磁感线，下列说法正确的是（ ）', correct: '磁感线是为了描述磁场而假想的曲线', pool: ['磁感线是为了描述磁场而假想的曲线', '磁感线是真实存在的曲线', '磁感线可以相交', '磁感线只存在于磁体内部'], hint: '磁感线是假想模型，实际并不存在。' },
    { stem: '磁场中某点的磁场方向规定为（ ）', correct: '小磁针静止时 N 极所指的方向', pool: ['小磁针静止时 N 极所指的方向', '小磁针静止时 S 极所指的方向', '磁感线由 S 极到 N 极的方向', '电流的方向'], hint: '磁场方向规定为小磁针静止时 N 极所指的方向。' },
    { stem: '磁体上磁性最强的部分叫做（ ）', correct: '磁极', pool: ['磁极', '磁场', '磁感线', '磁化'], hint: '磁体两端磁性最强，称为磁极。' },
    { stem: '地磁的北极位于地理（ ）附近', correct: '南极', pool: ['南极', '北极', '赤道', '东经 0°'], hint: '地磁北极在地理南极附近，所以小磁针 N 极指北。' },
    { stem: '使原来没有磁性的物体获得磁性的过程叫做（ ）', correct: '磁化', pool: ['磁化', '磁感', '电磁感应', '磁屏蔽'], hint: '物体在磁体或电流作用下获得磁性的过程叫磁化。' }
  ]
  const electromagnets = [
    { stem: '奥斯特实验说明（ ）', correct: '通电导线周围存在磁场', pool: ['通电导线周围存在磁场', '磁体周围存在磁场', '电流周围存在电场', '磁场能产生电流'], hint: '奥斯特发现通电导线下方小磁针偏转，说明电流周围存在磁场。' },
    { stem: '通电螺线管外部的磁场形状与下列哪种磁体相似（ ）', correct: '条形磁体', pool: ['条形磁体', '蹄形磁体', '环形磁体', '磁针'], hint: '通电螺线管外部磁场与条形磁体的磁场相似。' },
    { stem: '在匝数一定时，增大通过电磁铁的电流，电磁铁的磁性将（ ）', correct: '增强', pool: ['增强', '减弱', '不变', '先减弱后增强'], hint: '电流越大，电磁铁磁性越强。' },
    { stem: '在电流一定时，增加电磁铁线圈的匝数，电磁铁的磁性将（ ）', correct: '增强', pool: ['增强', '减弱', '不变', '变为零'], hint: '匝数越多，电磁铁磁性越强。' },
    { stem: '在通电螺线管中插入铁芯后，它的磁性将（ ）', correct: '增强', pool: ['增强', '减弱', '不变', '消失'], hint: '铁芯被磁化后增强磁场，磁性明显增强。' },
    { stem: '与永磁体相比，电磁铁的主要优点是（ ）', correct: '磁性的有无和强弱可以控制', pool: ['磁性的有无和强弱可以控制', '磁性永远存在', '不需要通电', '磁极方向不能改变'], hint: '电磁铁通过通断电和控制电流来调节磁性。' },
    { stem: '通电导线周围磁场的方向与下列哪个因素有关（ ）', correct: '电流的方向', pool: ['电流的方向', '导线的长度', '导线是否弯曲', '导线的温度'], hint: '改变电流方向，磁场方向随之改变。' },
    { stem: '判断通电螺线管的磁极，应该使用（ ）', correct: '右手螺旋定则', pool: ['右手螺旋定则', '左手定则', '右手定则', '欧姆定律'], hint: '用右手螺旋定则（安培定则）判断通电螺线管的 N、S 极。' },
    { stem: '电磁继电器的主要作用是（ ）', correct: '利用低电压、弱电流控制高电压、强电流', pool: ['利用低电压、弱电流控制高电压、强电流', '增大电路中的电流', '提高电路中的电压', '储存电能'], hint: '电磁继电器用电磁铁控制触点，实现低压控制高压。' },
    { stem: '电磁起重机能够吸起和放下钢铁，主要利用（ ）', correct: '电磁铁', pool: ['电磁铁', '永磁体', '电动机', '发电机'], hint: '电磁起重机利用电磁铁通电有磁性、断电无磁性来工作。' }
  ]
  const motors = [
    { stem: '电动机的工作原理是（ ）', correct: '通电导体在磁场中受力运动', pool: ['通电导体在磁场中受力运动', '电磁感应现象', '电流的热效应', '电流的磁效应'], hint: '电动机利用通电线圈在磁场中受力而转动。' },
    { stem: '电动机工作时，能量转化是（ ）', correct: '电能转化为机械能', pool: ['电能转化为机械能', '机械能转化为电能', '内能转化为机械能', '化学能转化为电能'], hint: '电动机消耗电能，获得机械能。' },
    { stem: '发电机的工作原理是（ ）', correct: '电磁感应现象', pool: ['电磁感应现象', '通电导体在磁场中受力', '电流的热效应', '磁化现象'], hint: '发电机利用闭合电路的一部分导体切割磁感线产生感应电流。' },
    { stem: '发电机工作时，能量转化是（ ）', correct: '机械能转化为电能', pool: ['机械能转化为电能', '电能转化为机械能', '电能转化为内能', '内能转化为电能'], hint: '发电机将机械能转化为电能。' },
    { stem: '直流电动机中换向器的作用是（ ）', correct: '线圈转过平衡位置时改变线圈中的电流方向', pool: ['线圈转过平衡位置时改变线圈中的电流方向', '增大线圈中的电流', '减小线圈中的电流', '改变磁体的磁极'], hint: '换向器使线圈持续向同一方向转动。' },
    { stem: '感应电流的方向与下列哪两个因素有关（ ）', correct: '导体运动方向和磁场方向', pool: ['导体运动方向和磁场方向', '导体长度和横截面积', '导体电阻和电流大小', '磁场强弱和导体温度'], hint: '改变导体运动方向或磁场方向，感应电流方向都会改变。' },
    { stem: '产生感应电流的条件是（ ）', correct: '闭合电路的一部分导体做切割磁感线运动', pool: ['闭合电路的一部分导体做切割磁感线运动', '导体在磁场中静止', '导体沿磁感线方向运动', '电路断开且导体运动'], hint: '必须是闭合电路，且导体做切割磁感线运动。' },
    { stem: '直流电动机能持续转动，主要依靠（ ）', correct: '换向器', pool: ['换向器', '滑动变阻器', '电磁继电器', '保险丝'], hint: '换向器在线圈转过平衡位置时改变电流方向。' },
    { stem: '动圈式话筒的工作原理是（ ）', correct: '电磁感应', pool: ['电磁感应', '通电导体在磁场中受力', '电流的热效应', '磁化现象'], hint: '声波使膜片带动线圈振动，切割磁感线产生感应电流。' },
    { stem: '扬声器的工作原理是（ ）', correct: '通电导体在磁场中受力', pool: ['通电导体在磁场中受力', '电磁感应', '电流的热效应', '电流的化学效应'], hint: '变化的电流使线圈在磁场中受力振动，带动纸盆发声。' }
  ]
  const induction = [
    { stem: '电磁感应现象是由哪位科学家发现的（ ）', correct: '法拉第', pool: ['法拉第', '奥斯特', '牛顿', '欧姆'], hint: '英国物理学家法拉第发现了电磁感应现象。' },
    { stem: '导体在磁场中静止不动时，电路中（ ）', correct: '不会产生感应电流', pool: ['不会产生感应电流', '会产生稳定感应电流', '会产生变化的感应电流', '一定会产生感应电流'], hint: '没有切割磁感线运动，不产生感应电流。' },
    { stem: '电磁波的传播（ ）', correct: '不需要介质', pool: ['不需要介质', '必须依靠空气', '必须依靠水', '必须依靠导线'], hint: '电磁波可以在真空中传播，不需要介质。' },
    { stem: '电磁波在真空中的传播速度是（ ）', correct: '3×10^8 m/s', pool: ['3×10^8 m/s', '340 m/s', '3×10^5 m/s', '3×10^6 m/s'], hint: '电磁波在真空中传播速度与光速相同，为 3×10^8 m/s。' },
    { stem: '手机之间传递信息主要利用（ ）', correct: '电磁波', pool: ['电磁波', '超声波', '次声波', '电流'], hint: '手机通过发射和接收电磁波传递信息。' },
    { stem: '光纤通信中，激光在光导纤维中传播时主要发生（ ）', correct: '光的反射', pool: ['光的反射', '光的折射', '光的色散', '光的直线传播'], hint: '激光在光纤内壁上不断反射向前传播。' },
    { stem: '微波炉加热食物主要利用（ ）', correct: '电磁波', pool: ['电磁波', '超声波', '红外线', '紫外线'], hint: '微波炉利用微波使食物内部分子运动加剧而升温。' },
    { stem: '在真空中，电磁波的频率越高，它的波长（ ）', correct: '越短', pool: ['越短', '越长', '不变', '无法确定'], hint: '波速一定时，波长与频率成反比。' },
    { stem: '卫星通信主要依靠（ ）', correct: '电磁波', pool: ['电磁波', '声波', '超声波', '次声波'], hint: '卫星与地面之间通过电磁波传递信息。' },
    { stem: '下列属于电磁波的是（ ）', correct: '无线电波', pool: ['无线电波', '超声波', '次声波', '水波'], hint: '无线电波、微波、红外线、可见光、紫外线都属于电磁波。' }
  ]
  const groups = [magnetism, electromagnets, motors, induction]
  groups.forEach((group, groupIndex) => {
    group.forEach((item, index) => {
      items.push(makeQuestion({
        stem: item.stem,
        correct: item.correct,
        wrongs: item.pool.filter(option => option !== item.correct).slice(0, 3),
        hint: item.hint,
        difficulty: groupIndex === 3 ? 2 : 1,
        dimension: groupIndex === 2 ? 'transfer' : 'concept',
        seed: groupIndex * 10 + index
      }))
    })
  })
  return items
}

export const grade9PhysicsGenerators = {
  '浮力与压强综合': buoyancyAndPressure,
  '功与机械能': workAndEnergy,
  '内能与热机': heatAndEngines,
  '电流与电路': currentAndCircuits,
  '欧姆定律': ohmsLaw,
  '电功率与家庭电路': electricPower,
  '电磁现象': electromagnetism
}

export const bankGroup = {
  grade: '初三',
  subject: '物理',
  edition: '人教版',
  generators: grade9PhysicsGenerators
}
