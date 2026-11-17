// 从 MediaPipe Face Landmarker 的单帧结果里提取注意力指标。
// 全部是纯函数：不碰 DOM、不依赖模型，方便 node --test 直接验证。

// MediaPipe 478 点人脸模型里眼睛周围的关键点下标。
export const LEFT_EYE = [33, 160, 158, 133, 153, 144]
export const RIGHT_EYE = [362, 385, 387, 263, 373, 380]

// EAR 换算成 0~1 的睁眼程度：0.12 以下视为闭眼，0.30 以上视为睁眼。
export const EAR_CLOSED = 0.12
export const EAR_OPEN = 0.30

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

function pointDistance(a, b, aspect) {
  if (!a || !b) return 0
  const dx = a.x - b.x
  // 归一化坐标里 x 按画面宽度、y 按画面高度，换算到同一单位再算距离。
  const dy = (a.y - b.y) / aspect
  return Math.hypot(dx, dy)
}

// EAR = (|p2-p6| + |p3-p5|) / (2|p1-p4|)，六个点按上眼睑/下眼睑成对排列。
export function computeEar(landmarks, indices, aspect = 4 / 3) {
  if (!Array.isArray(landmarks)) return 0
  const [p1, p2, p3, p4, p5, p6] = indices.map(index => landmarks[index])
  const horizontal = pointDistance(p1, p4, aspect)
  if (!horizontal) return 0
  return (pointDistance(p2, p6, aspect) + pointDistance(p3, p5, aspect)) / (2 * horizontal)
}

export function eyeOpenFromEar(ear) {
  const value = Number(ear)
  if (!Number.isFinite(value)) return 1
  return clamp((value - EAR_CLOSED) / (EAR_OPEN - EAR_CLOSED), 0, 1)
}

function categoryScore(blendshapes, name) {
  const categories = Array.isArray(blendshapes) ? blendshapes : blendshapes?.categories
  if (!Array.isArray(categories)) return null
  const item = categories.find(category => category.categoryName === name)
  return item ? Number(item.score) : null
}

// 优先用 blendshape 的眨眼系数（1 为闭眼），缺失时回落到几何 EAR。
export function computeEyeOpen({ blendshapes, landmarks, aspect = 4 / 3 } = {}) {
  const blinkLeft = categoryScore(blendshapes, 'eyeBlinkLeft')
  const blinkRight = categoryScore(blendshapes, 'eyeBlinkRight')
  if (Number.isFinite(blinkLeft) && Number.isFinite(blinkRight)) {
    return clamp(1 - Math.max(blinkLeft, blinkRight), 0, 1)
  }
  if (Array.isArray(landmarks)) {
    const ear = (computeEar(landmarks, LEFT_EYE, aspect) + computeEar(landmarks, RIGHT_EYE, aspect)) / 2
    return eyeOpenFromEar(ear)
  }
  return 1
}

// MediaPipe 的面部变换矩阵是 4x4 列主序；forward 取旋转矩阵第三列。
// 按真机标定，低头时 fy 为正，所以 pitch 直接取 fy：pitch>0 为低头，<0 为仰头。
// 预览画面是镜像的（CSS scaleX(-1)），yaw 按屏幕视觉方向取反：yaw>0 为向右转头，<0 为向左。
export function headPoseFromMatrix(data) {
  if (!data || data.length < 16) return { yaw: 0, pitch: 0, roll: 0 }
  const fx = Number(data[8]) || 0
  const fy = Number(data[9]) || 0
  const fz = Number(data[10]) || 0
  const length = Math.hypot(fx, fy, fz) || 1
  const yaw = (-Math.atan2(fx / length, fz / length) * 180 / Math.PI) || 0
  const pitch = (Math.asin(clamp(fy / length, -1, 1)) * 180 / Math.PI) || 0
  const roll = (Math.atan2(Number(data[1]) || 0, Number(data[5]) || 0) * 180 / Math.PI) || 0
  return { yaw, pitch, roll }
}

// 用 478 个归一化关键点估算人脸外接框；ratio 取长边，作为“离屏幕多远”的近似。
export function faceBoxOf(landmarks) {
  if (!Array.isArray(landmarks) || landmarks.length === 0) return null
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  for (const point of landmarks) {
    if (!point) continue
    if (point.x < minX) minX = point.x
    if (point.x > maxX) maxX = point.x
    if (point.y < minY) minY = point.y
    if (point.y > maxY) maxY = point.y
  }
  if (!Number.isFinite(minX) || !Number.isFinite(maxX)) return null
  const width = maxX - minX
  const height = maxY - minY
  return {
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    width,
    height,
    ratio: Math.max(width, height)
  }
}

// 多人时只对画面里最大的一张脸算角度与眼睛状态，避免两张脸来回跳。
export function pickPrimaryFace(faceBoxes) {
  if (!Array.isArray(faceBoxes) || faceBoxes.length === 0) return -1
  let primary = -1
  let largest = 0
  faceBoxes.forEach((box, index) => {
    if (box && box.ratio > largest) {
      largest = box.ratio
      primary = index
    }
  })
  return primary
}
