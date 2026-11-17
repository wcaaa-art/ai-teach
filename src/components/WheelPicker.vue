<script setup>
import { reactive, watch, onBeforeUnmount } from 'vue'

// iOS 风格滚轮选择器：多列、中间项放大加粗、上下渐隐，滚轮/拖拽平滑滚动 + 缓动吸附。
const props = defineProps({
  modelValue: { type: Array, default: () => [] },
  columns: { type: Array, required: true }, // 二维数组，每列是 label 数组
  suffixes: { type: Array, default: () => [] }, // 每列单位，如 ['时', '分']
  itemHeight: { type: Number, default: 40 },
  visibleCount: { type: Number, default: 5 },
  fontSize: { type: Number, default: 22 }
})
const emit = defineEmits(['update:modelValue'])

const ITEM_H = props.itemHeight
const VISIBLE = props.visibleCount
const PAD = (VISIBLE - 1) / 2 // 中间项上/下方各 PAD 项
const VIEW_H = ITEM_H * VISIBLE

function clampIndex(i, len) { return Math.max(0, Math.min(len - 1, i)) }

const state = props.columns.map((col, c) => reactive({
  index: clampIndex(Number(props.modelValue[c]) || 0, col.length),
  offset: 0, // 相对当前 index 的偏移（px），越界就进位
  targetOffset: 0, // 待滚动的剩余位移（px），rAF 逐帧平滑消耗
  dragging: false
}))

watch(() => props.modelValue, (value) => {
  ;(value || []).forEach((idx, c) => {
    if (c >= state.length) return
    const next = clampIndex(Number(idx) || 0, props.columns[c].length)
    if (next !== state[c].index) state[c].index = next
  })
})

function emitChange() { emit('update:modelValue', state.map(s => s.index)) }

// 越界就进位；到顶/底则撞墙停下（清剩余位移、回正）。
function settleOverflow(s, c) {
  let moved = false
  while (s.offset > ITEM_H / 2) {
    if (s.index < props.columns[c].length - 1) { s.index += 1; s.offset -= ITEM_H; moved = true }
    else { s.offset = 0; s.targetOffset = 0; break }
  }
  while (s.offset < -ITEM_H / 2) {
    if (s.index > 0) { s.index -= 1; s.offset += ITEM_H; moved = true }
    else { s.offset = 0; s.targetOffset = 0; break }
  }
  return moved
}

// rAF 驱动：把「待滚位移」逐帧平滑消耗掉（ease-out），滚完再缓动吸附到整数档。
let rafId = 0
function startLoop() { if (!rafId) rafId = requestAnimationFrame(tick) }
function tick() {
  let active = false
  state.forEach((s, c) => {
    if (s.dragging) { active = true; return }
    const remain = s.targetOffset
    if (Math.abs(remain) > 0.4) {
      const step = remain * 0.32
      s.offset += step
      s.targetOffset -= step
      if (settleOverflow(s, c)) emitChange()
      active = true
    } else {
      s.targetOffset = 0
      if (Math.abs(s.offset) > 0.4) {
        s.offset *= 0.85
        active = true
      } else if (s.offset !== 0) {
        s.offset = 0
      }
    }
  })
  if (active) rafId = requestAnimationFrame(tick)
  else rafId = 0
}
onBeforeUnmount(() => { if (rafId) cancelAnimationFrame(rafId) })

function listTransform(c) {
  const s = state[c]
  return `translate3d(0, ${PAD * ITEM_H - s.index * ITEM_H - s.offset}px, 0)`
}
function itemStyle(c, i) {
  const s = state[c]
  const pos = s.index + s.offset / ITEM_H
  const dist = i - pos // 0 = 居中，越远越大
  const ad = Math.min(Math.abs(dist), 2)
  const opacity = Math.max(0.06, 1 - ad * 0.5)
  const scale = 1 - ad * 0.17
  const weight = ad < 0.6 ? 600 : 400
  return { opacity, transform: `scale(${scale})`, fontWeight: weight }
}

// 鼠标滚轮：向下滚 = 数字下滑（显示更大的数字）。
function onWheel(c, e) {
  const s = state[c]
  let d = e.deltaY
  if (e.deltaMode === 1) d *= 16
  else if (e.deltaMode === 2) d *= 120
  s.targetOffset += d * 0.7
  s.dragging = false
  startLoop()
}

// 拖拽：跟随手指；松手时把甩动速度折算成惯性位移。
let activeCol = -1
let lastY = 0
let lastTime = 0
let dragVelocity = 0
function onPointerDown(c, e) {
  activeCol = c
  const s = state[c]
  s.dragging = true
  s.targetOffset = 0
  dragVelocity = 0
  lastY = e.clientY
  lastTime = performance.now()
  e.currentTarget.setPointerCapture?.(e.pointerId)
}
function onPointerMove(c, e) {
  if (activeCol !== c) return
  const s = state[c]
  const now = performance.now()
  const dy = e.clientY - lastY
  const dt = now - lastTime
  // 手指向下拖 = 数字下滑（显示更大的数字）。
  s.offset += dy
  // dt 过小（如合成事件连发）就不估算速度，避免速度爆炸。
  let v = dt > 5 ? (dy / dt) * 16 : 0
  const maxV = ITEM_H * 6
  if (v > maxV) v = maxV
  if (v < -maxV) v = -maxV
  dragVelocity = v
  lastY = e.clientY
  lastTime = now
  if (settleOverflow(s, c)) emitChange()
}
function onPointerUp(c) {
  if (activeCol !== c) return
  activeCol = -1
  const s = state[c]
  s.dragging = false
  s.targetOffset = dragVelocity * 10
  startLoop()
}
</script>

<template>
  <div class="wheel-picker" role="group" aria-label="时长选择">
    <div v-for="(col, c) in columns" :key="c" class="wheel-col">
      <div
        class="wheel-viewport"
        :style="{ height: VIEW_H + 'px' }"
        @wheel.prevent="onWheel(c, $event)"
        @pointerdown="onPointerDown(c, $event)"
        @pointermove="onPointerMove(c, $event)"
        @pointerup="onPointerUp(c, $event)"
        @pointercancel="onPointerUp(c, $event)"
      >
        <div class="wheel-list" :style="{ transform: listTransform(c) }">
          <div v-for="(label, i) in col" :key="i" class="wheel-item" :style="{ ...itemStyle(c, i), height: ITEM_H + 'px', fontSize: fontSize + 'px' }">{{ label }}</div>
        </div>
        <div class="wheel-mask wheel-mask--top"></div>
        <div class="wheel-mask wheel-mask--bottom"></div>
      </div>
      <span v-if="suffixes[c]" class="wheel-suffix">{{ suffixes[c] }}</span>
    </div>
  </div>
</template>

<style scoped>
.wheel-picker{display:flex;align-items:center;justify-content:center;gap:22px}
.wheel-col{display:flex;align-items:center;gap:5px}
.wheel-viewport{position:relative;width:74px;overflow:hidden;cursor:grab;touch-action:none;user-select:none;-webkit-user-select:none}
.wheel-viewport:active{cursor:grabbing}
.wheel-list{position:absolute;left:0;right:0;top:0;will-change:transform;z-index:1}
.wheel-item{display:flex;align-items:center;justify-content:center;line-height:1;font-variant-numeric:tabular-nums;color:#17251F;transform-origin:center;will-change:transform,opacity}
/* 上下渐隐：用白色渐变把边缘项"淡出去"，配合每项的 opacity 形成连续过渡。 */
.wheel-mask{position:absolute;left:0;right:0;pointer-events:none;z-index:2}
.wheel-mask--top{top:0;height:40%;background:linear-gradient(to bottom,#FFFDFA 30%,rgba(255,253,250,0))}
.wheel-mask--bottom{bottom:0;height:40%;background:linear-gradient(to top,#FFFDFA 30%,rgba(255,253,250,0))}
.wheel-suffix{font-size:15px;color:#66766D;line-height:1}
</style>
