<script setup>
import { ref, computed, onMounted, onBeforeUnmount } from 'vue'
import { readStudy, studyElapsedSeconds } from '../utils/studySession.js'

// 学习窗口顶部的专注计时胶囊：只显示，不提供手动操作——离开窗口时自动记录。
const session = ref(readStudy())
const now = ref(Date.now())
let timer = 0

const elapsedText = computed(() => {
  const s = studyElapsedSeconds(session.value, now.value)
  const m = String(Math.floor(s / 60)).padStart(2, '0')
  const sec = String(s % 60).padStart(2, '0')
  return `${m}:${sec}`
})

function refresh() {
  now.value = Date.now()
  session.value = readStudy()
}
function onStudyUpdated() { session.value = readStudy() }

onMounted(() => {
  timer = window.setInterval(refresh, 1000)
  window.addEventListener('ai-teach:study-updated', onStudyUpdated)
})
onBeforeUnmount(() => {
  clearInterval(timer)
  window.removeEventListener('ai-teach:study-updated', onStudyUpdated)
})
</script>

<template>
  <div v-if="session" class="study-timer" title="本次学习的专注时长，离开窗口时自动记录">
    <span class="study-timer-dot" aria-hidden="true"></span>
    <span class="study-timer-label">专注中</span>
    <strong class="study-timer-clock">{{ elapsedText }}</strong>
  </div>
</template>

<style scoped>
.study-timer{display:inline-flex;align-items:center;gap:7px;padding:6px 14px;border-radius:999px;background:var(--primary-soft);border:1px solid var(--border);font-family:inherit}
.study-timer-dot{width:8px;height:8px;border-radius:50%;background:var(--primary);animation:study-pulse 1.8s ease-in-out infinite}
.study-timer-label{font-size:12px;color:var(--muted)}
.study-timer-clock{font-size:15px;font-weight:600;color:var(--primary);font-variant-numeric:tabular-nums;letter-spacing:.02em}
@keyframes study-pulse{0%,100%{opacity:1}50%{opacity:.35}}
</style>
