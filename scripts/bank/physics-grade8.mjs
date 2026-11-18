// 初二物理题库生成器：速度、声、光、透镜、密度、力、压强浮力，全部由公式现算。
import { makeQuestion } from './helpers.mjs'

// 机械运动
function mechanics() {
  const items = []
  const speeds = [[100, 20], [240, 3], [450, 5], [360, 4], [600, 8], [150, 3], [720, 9], [90, 2], [500, 10], [120, 4]]
  speeds.forEach(([distance, time], index) => {
    const answer = distance / time
    items.push(makeQuestion({
      stem: `物体做匀速直线运动，${time} s 内通过的路程是 ${distance} m，它的速度是（ ）m/s`,
      correct: answer,
      wrongs: [distance * time, answer + 1, answer - 1],
      hint: `v = s/t = ${distance} ÷ ${time} = ${answer} m/s。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const averages = [[300, 6], [480, 8], [150, 5], [720, 9], [240, 4], [600, 10], [180, 3], [360, 6], [540, 9], [450, 5]]
  averages.forEach(([distance, time], index) => {
    const answer = distance / time
    items.push(makeQuestion({
      stem: `小明跑步的总路程是 ${distance} m，总用时 ${time} s，他全程的平均速度是（ ）m/s`,
      correct: answer,
      wrongs: [answer + 2, answer - 2, distance / (time + 1)],
      hint: `平均速度 = 总路程 ÷ 总时间 = ${distance} ÷ ${time} = ${answer} m/s。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const conversions = [5, 10, 20, 15, 25, 30, 40, 50, 60, 80]
  conversions.forEach((value, index) => {
    const answer = value * 3.6
    items.push(makeQuestion({
      stem: `${value} m/s 合（ ）km/h`,
      correct: answer,
      wrongs: [value / 3.6, value * 10, value * 1.8],
      hint: `1 m/s = 3.6 km/h，所以 ${value} × 3.6 = ${answer} km/h。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 20
    }))
  })
  return items
}

// 声现象
function sound() {
  const items = []
  const times = [0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5]
  times.forEach((time, index) => {
    const answer = 340 * time
    items.push(makeQuestion({
      stem: `声音在 15℃ 的空气中传播 ${time} s，通过的路程是（ ）m`,
      correct: answer,
      wrongs: [answer / 2, answer * 2, answer + 340],
      hint: `声速约 340 m/s，s = vt = 340 × ${time} = ${answer} m。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const echoTimes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  echoTimes.forEach((time, index) => {
    const answer = (340 * time) / 2
    items.push(makeQuestion({
      stem: `对着山崖喊话，经过 ${time} s 听到回声，人距山崖约（ ）m`,
      correct: answer,
      wrongs: [340 * time, answer + 170, answer - 170],
      hint: `回声是声音往返一次，单程距离 = vt/2 = 340 × ${time} ÷ 2 = ${answer} m。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const thunder = [2, 3, 4, 5, 1, 6, 7, 8, 9, 10]
  thunder.forEach((time, index) => {
    const answer = 340 * time
    items.push(makeQuestion({
      stem: `看到闪电后经过 ${time} s 听到雷声，打雷处距人约（ ）m（光速极大，传播时间忽略不计）`,
      correct: answer,
      wrongs: [answer / 2, answer + 340, 340],
      hint: `声音传播时间就是 ${time} s，距离 = 340 × ${time} = ${answer} m。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 光现象
function light() {
  const items = []
  const seconds = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  seconds.forEach((time, index) => {
    const answer = `${3 * time}×10^8 m`
    items.push(makeQuestion({
      stem: `光在真空中传播 ${time} s，通过的路程是（ ）`,
      correct: answer,
      wrongs: [`${3 * time}×10^6 m`, `${3 * time}×10^7 m`, `${3 * time}×10^5 m`],
      hint: `光速 c = 3×10^8 m/s，s = ct = 3×10^8 × ${time} = ${3 * time}×10^8 m。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const mirrorAngles = [30, 40, 50, 60, 20, 70, 25, 65, 45, 15]
  mirrorAngles.forEach((angle, index) => {
    const answer = 90 - angle
    items.push(makeQuestion({
      stem: `一束光射到平面镜上，入射光线与镜面的夹角为 ${angle}°，则反射角是（ ）`,
      correct: `${answer}°`,
      wrongs: [`${answer + 10}°`, `${answer - 10}°`, `${180 - angle}°`],
      hint: `入射角 = 90° - ${angle}° = ${answer}°，反射角等于入射角，也是 ${answer}°。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const distances = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
  distances.forEach((distance, index) => {
    const answer = 2 * distance
    items.push(makeQuestion({
      stem: `某人站在平面镜前 ${distance} m 处，他与镜中像的距离是（ ）m`,
      correct: answer,
      wrongs: [distance, answer + 1, answer - 1],
      hint: `平面镜成像时像距等于物距，人像距离 = ${distance} + ${distance} = ${answer} m。`,
      difficulty: 1,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 透镜及其应用
function lenses() {
  const items = []
  const focusData = [[10, 15], [10, 20], [10, 30], [12, 24], [6, 8], [5, 10], [15, 20], [8, 12], [6, 9], [4, 6]]
  focusData.forEach(([focus, object], index) => {
    const answer = (focus * object) / (object - focus)
    items.push(makeQuestion({
      stem: `凸透镜的焦距为 ${focus} cm，物体位于距透镜 ${object} cm 处，像距是（ ）cm`,
      correct: answer,
      wrongs: [object - focus, object + focus, focus],
      hint: `由 1/f = 1/u + 1/v 得 v = fu/(u - f) = ${focus} × ${object} ÷ (${object} - ${focus}) = ${answer} cm。`,
      difficulty: 3,
      dimension: 'transfer',
      seed: index
    }))
  })
  const imageData = [[10, 25], [10, 15], [10, 5], [10, 20], [12, 30], [12, 18], [12, 6], [12, 24], [8, 20], [8, 12]]
  imageData.forEach(([focus, object], index) => {
    const answer = object > 2 * focus ? '倒立、缩小的实像'
      : object === 2 * focus ? '倒立、等大的实像'
        : object > focus ? '倒立、放大的实像' : '正立、放大的虚像'
    items.push(makeQuestion({
      stem: `凸透镜的焦距为 ${focus} cm，物体距透镜 ${object} cm，所成像的性质是（ ）`,
      correct: answer,
      wrongs: ['倒立、缩小的实像', '倒立、等大的实像', '倒立、放大的实像', '正立、放大的虚像'].filter(item => item !== answer).slice(0, 3),
      hint: `${object} cm 与 2f = ${2 * focus} cm、f = ${focus} cm 比较：${answer}。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const spotDistances = [8, 10, 12, 15, 20, 25, 30, 40, 5, 18]
  spotDistances.forEach((distance, index) => {
    items.push(makeQuestion({
      stem: `把凸透镜正对太阳光，在距透镜 ${distance} cm 的白纸上得到最小、最亮的光斑，该透镜的焦距是（ ）cm`,
      correct: distance,
      wrongs: [distance * 2, distance / 2, distance + 5],
      hint: `最小最亮的光斑就是焦点，焦点到光心的距离即焦距，为 ${distance} cm。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index + 20
    }))
  })
  return items
}

// 质量与密度
function density() {
  const items = []
  const densities = [[54, 20], [78, 10], [120, 15], [200, 25], [90, 30], [150, 50], [270, 30], [360, 40], [450, 50], [640, 80]]
  densities.forEach(([mass, volume], index) => {
    const answer = mass / volume
    items.push(makeQuestion({
      stem: `某物体的质量是 ${mass} g，体积是 ${volume} cm³，它的密度是（ ）g/cm³`,
      correct: answer,
      wrongs: [volume / mass, answer + 0.5, answer - 0.5],
      hint: `ρ = m/V = ${mass} ÷ ${volume} = ${answer} g/cm³。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const massData = [[7.8, 10], [8.9, 20], [2.7, 100], [1.0, 500], [11.3, 10], [7.8, 50], [8.9, 10], [2.7, 200], [1.0, 250], [11.3, 20]]
  massData.forEach(([rho, volume], index) => {
    const answer = rho * volume
    items.push(makeQuestion({
      stem: `某金属的密度是 ${rho} g/cm³，体积为 ${volume} cm³ 的该金属质量是（ ）g`,
      correct: answer,
      wrongs: [rho + volume, answer / 2, answer * 2],
      hint: `m = ρV = ${rho} × ${volume} = ${answer} g。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const volumeData = [[78, 7.8], [89, 8.9], [270, 2.7], [500, 1.0], [113, 11.3], [390, 7.8], [178, 8.9], [540, 2.7], [250, 1.0], [226, 11.3]]
  volumeData.forEach(([mass, rho], index) => {
    const answer = mass / rho
    items.push(makeQuestion({
      stem: `某液体的质量是 ${mass} g，密度是 ${rho} g/cm³，它的体积是（ ）cm³`,
      correct: answer,
      wrongs: [mass * rho, answer + 10, answer - 10],
      hint: `V = m/ρ = ${mass} ÷ ${rho} = ${answer} cm³。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 力与运动
function forceAndMotion() {
  const items = []
  const masses = [2, 5, 10, 20, 50, 100, 0.5, 1.5, 25, 40]
  masses.forEach((mass, index) => {
    const answer = 10 * mass
    items.push(makeQuestion({
      stem: `质量为 ${mass} kg 的物体受到的重力是（ ）N（g 取 10 N/kg）`,
      correct: answer,
      wrongs: [mass / 10, answer + 10, answer - 10],
      hint: `G = mg = ${mass} × 10 = ${answer} N。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const sameDirection = [[10, 15], [20, 30], [8, 12], [25, 35], [40, 60], [5, 45], [12, 18], [50, 70], [15, 25], [30, 90]]
  sameDirection.forEach(([first, second], index) => {
    const answer = first + second
    items.push(makeQuestion({
      stem: `物体在同一直线上受到两个方向相同的力，大小分别为 ${first} N 和 ${second} N，合力是（ ）N`,
      correct: answer,
      wrongs: [Math.abs(first - second), answer + 5, answer - 5],
      hint: `同一直线上同向二力的合力等于两力之和：${first} + ${second} = ${answer} N。`,
      difficulty: 1,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const oppositeDirection = [[50, 20], [80, 30], [100, 40], [60, 15], [45, 25], [70, 35], [90, 45], [120, 20], [55, 15], [75, 25]]
  oppositeDirection.forEach(([first, second], index) => {
    const answer = first - second
    items.push(makeQuestion({
      stem: `物体在同一直线上受到两个方向相反的力，大小分别为 ${first} N 和 ${second} N，合力是（ ）N`,
      correct: answer,
      wrongs: [first + second, second - first, answer + 5],
      hint: `同一直线上反向二力的合力等于两力之差，方向与较大的力相同：${first} - ${second} = ${answer} N。`,
      difficulty: 2,
      dimension: 'method',
      seed: index + 20
    }))
  })
  return items
}

// 压强与浮力
function pressureAndBuoyancy() {
  const items = []
  const pressures = [[100, 0.5], [200, 0.4], [300, 0.6], [400, 0.8], [50, 0.2], [600, 1.2], [150, 0.3], [90, 0.15], [250, 0.5], [800, 2.0]]
  pressures.forEach(([force, area], index) => {
    const answer = force / area
    items.push(makeQuestion({
      stem: `物体对水平地面的压力是 ${force} N，受力面积是 ${area} m²，地面受到的压强是（ ）Pa`,
      correct: answer,
      wrongs: [force * area, answer + 100, answer - 100],
      hint: `p = F/S = ${force} ÷ ${area} = ${answer} Pa。`,
      difficulty: 1,
      dimension: 'concept',
      seed: index
    }))
  })
  const depths = [0.1, 0.2, 0.5, 1, 1.5, 2, 2.5, 3, 4, 5]
  depths.forEach((depth, index) => {
    const answer = 1000 * 10 * depth
    items.push(makeQuestion({
      stem: `水深 ${depth} m 处的压强是（ ）Pa（ρ水 = 1.0×10³ kg/m³，g 取 10 N/kg）`,
      correct: answer,
      wrongs: [answer / 2, answer * 2, answer + 1000],
      hint: `p = ρgh = 1000 × 10 × ${depth} = ${answer} Pa。`,
      difficulty: 2,
      dimension: 'basic-application',
      seed: index + 10
    }))
  })
  const volumes = [0.001, 0.002, 0.005, 0.01, 0.0005, 0.003, 0.004, 0.008, 0.0015, 0.02]
  volumes.forEach((volume, index) => {
    const answer = 1000 * 10 * volume
    items.push(makeQuestion({
      stem: `物体浸没在水中，排开水的体积是 ${volume} m³，它受到的浮力是（ ）N（ρ水 = 1.0×10³ kg/m³，g 取 10 N/kg）`,
      correct: answer,
      wrongs: [answer / 2, answer * 2, answer + 10],
      hint: `F浮 = ρ水gV排 = 1000 × 10 × ${volume} = ${answer} N。`,
      difficulty: 2,
      dimension: 'transfer',
      seed: index + 20
    }))
  })
  return items
}

export const grade8PhysicsGenerators = {
  '机械运动': mechanics,
  '声现象': sound,
  '光现象': light,
  '透镜及其应用': lenses,
  '质量与密度': density,
  '力与运动': forceAndMotion,
  '压强与浮力': pressureAndBuoyancy
}

export const bankGroup = {
  grade: '初二',
  subject: '物理',
  edition: '人教版',
  generators: grade8PhysicsGenerators
}
