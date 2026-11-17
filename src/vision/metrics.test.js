import test from 'node:test'
import assert from 'node:assert/strict'
import {
  EAR_CLOSED,
  EAR_OPEN,
  computeEar,
  computeEyeOpen,
  eyeOpenFromEar,
  faceBoxOf,
  headPoseFromMatrix,
  pickPrimaryFace,
  LEFT_EYE,
  RIGHT_EYE
} from './metrics.js'

// 构造一只“上下眼睑间距 0.1、左右眼角间距 1”的眼睛，EAR 应为 0.1。
function makeEyeLandmarks() {
  const landmarks = new Array(478).fill(null).map(() => ({ x: 0.5, y: 0.5 }))
  landmarks[33] = { x: 0, y: 0 }
  landmarks[160] = { x: 0.25, y: 0.05 }
  landmarks[158] = { x: 0.75, y: 0.05 }
  landmarks[133] = { x: 1, y: 0 }
  landmarks[153] = { x: 0.75, y: -0.05 }
  landmarks[144] = { x: 0.25, y: -0.05 }
  return landmarks
}

test('computeEar 按六点公式计算眼睛纵横比', () => {
  assert.ok(Math.abs(computeEar(makeEyeLandmarks(), LEFT_EYE, 1) - 0.1) < 1e-9)
})

test('eyeOpenFromEar 把 EAR 映射到 0~1 并夹取边界', () => {
  assert.equal(eyeOpenFromEar(EAR_CLOSED), 0)
  assert.equal(eyeOpenFromEar(EAR_OPEN), 1)
  assert.equal(eyeOpenFromEar(0), 0)
  assert.equal(eyeOpenFromEar(1), 1)
  assert.ok(Math.abs(eyeOpenFromEar((EAR_CLOSED + EAR_OPEN) / 2) - 0.5) < 1e-9)
})

test('computeEyeOpen 优先使用眨眼 blendshape，闭眼系数取两眼最大值', () => {
  const blendshapes = {
    categories: [
      { categoryName: 'eyeBlinkLeft', score: 0.8 },
      { categoryName: 'eyeBlinkRight', score: 0.2 }
    ]
  }
  assert.ok(Math.abs(computeEyeOpen({ blendshapes }) - 0.2) < 1e-9)
})

test('computeEyeOpen 缺失 blendshape 时回落到几何 EAR', () => {
  const landmarks = new Array(478).fill(null).map(() => ({ x: 0.5, y: 0.5 }))
  for (const indices of [LEFT_EYE, RIGHT_EYE]) {
    const [p1, p2, p3, p4, p5, p6] = indices
    landmarks[p1] = { x: 0, y: 0 }
    landmarks[p2] = { x: 0.25, y: 0.07 }
    landmarks[p3] = { x: 0.75, y: 0.07 }
    landmarks[p4] = { x: 1, y: 0 }
    landmarks[p5] = { x: 0.75, y: -0.07 }
    landmarks[p6] = { x: 0.25, y: -0.07 }
  }
  const eyeOpen = computeEyeOpen({ landmarks, aspect: 1 })
  assert.ok(eyeOpen > 0 && eyeOpen < 0.2)
})

test('headPoseFromMatrix 从列主序矩阵解出 yaw/pitch/roll', () => {
  const identity = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]
  assert.deepEqual(headPoseFromMatrix(identity), { yaw: 0, pitch: 0, roll: 0 })

  const angle = 30 * Math.PI / 180
  // 约定：预览是镜像的，yaw > 0 为向右转头，yaw < 0 为向左转头。
  const turnRightMatrix = [
    Math.cos(angle), 0, Math.sin(angle), 0,
    0, 1, 0, 0,
    -Math.sin(angle), 0, Math.cos(angle), 0,
    0, 0, 0, 1
  ]
  assert.ok(Math.abs(headPoseFromMatrix(turnRightMatrix).yaw - 30) < 1e-6)

  const turnLeftMatrix = [
    Math.cos(angle), 0, -Math.sin(angle), 0,
    0, 1, 0, 0,
    Math.sin(angle), 0, Math.cos(angle), 0,
    0, 0, 0, 1
  ]
  assert.ok(Math.abs(headPoseFromMatrix(turnLeftMatrix).yaw + 30) < 1e-6)

  // 约定：pitch > 0 为低头，pitch < 0 为仰头。
  const headDownMatrix = [
    1, 0, 0, 0,
    0, Math.cos(angle), -Math.sin(angle), 0,
    0, Math.sin(angle), Math.cos(angle), 0,
    0, 0, 0, 1
  ]
  assert.ok(Math.abs(headPoseFromMatrix(headDownMatrix).pitch - 30) < 1e-6)

  const headUpMatrix = [
    1, 0, 0, 0,
    0, Math.cos(angle), Math.sin(angle), 0,
    0, -Math.sin(angle), Math.cos(angle), 0,
    0, 0, 0, 1
  ]
  assert.ok(Math.abs(headPoseFromMatrix(headUpMatrix).pitch + 30) < 1e-6)
  assert.deepEqual(headPoseFromMatrix(), { yaw: 0, pitch: 0, roll: 0 })
})

test('faceBoxOf 与 pickPrimaryFace 选出画面里最大的一张脸', () => {
  const small = [{ x: 0.1, y: 0.1 }, { x: 0.2, y: 0.2 }]
  const large = [{ x: 0.2, y: 0.2 }, { x: 0.7, y: 0.8 }]
  const smallBox = faceBoxOf(small)
  const largeBox = faceBoxOf(large)
  assert.ok(Math.abs(smallBox.ratio - 0.1) < 1e-9)
  assert.ok(Math.abs(largeBox.ratio - 0.6) < 1e-9)
  assert.equal(pickPrimaryFace([smallBox, largeBox]), 1)
  assert.equal(pickPrimaryFace([]), -1)
  assert.equal(faceBoxOf([]), null)
})
