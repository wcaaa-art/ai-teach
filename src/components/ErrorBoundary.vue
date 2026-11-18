<script setup>
import { ref, onErrorCaptured } from 'vue'

// 应用级错误边界：只接管「子组件渲染 / 生命周期」里抛出的同步错误，
// 展示一个不打断整体布局的兜底页，用户可重试或刷新。
// 返回 false 阻止错误继续向上冒泡，避免一个页面错误把整个应用带崩。
const error = ref(null)
const errorInfo = ref('')

onErrorCaptured((err, instance, info) => {
  error.value = err
  errorInfo.value = info || ''
  // 仍打一条日志，便于排查；但不往上抛给全局 errorHandler 重复记录。
  console.error('[ErrorBoundary] 页面渲染错误已接管：', err, info)
  return false
})

function retry() {
  error.value = null
  errorInfo.value = ''
}

function reload() {
  if (typeof location !== 'undefined') location.reload()
}
</script>

<template>
  <slot v-if="!error" />
  <div v-else class="error-boundary" role="alert">
    <div class="eb-icon" aria-hidden="true">⚠</div>
    <h2 class="eb-title">这个页面出了点问题</h2>
    <p class="eb-desc">当前页面渲染时遇到了意外错误，你的学习数据仍然安全，换个页面或刷新即可继续</p>
    <div class="eb-actions">
      <button class="eb-retry" type="button" @click="retry">重试</button>
      <button class="eb-refresh" type="button" @click="reload">刷新页面</button>
    </div>
    <p v-if="errorInfo" class="eb-detail">{{ errorInfo }}</p>
  </div>
</template>

<style scoped>
.error-boundary{min-height:60vh;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:10px;padding:40px 24px;text-align:center}
.eb-icon{width:56px;height:56px;display:grid;place-items:center;border-radius:50%;background:var(--brand-soft,#EDF5F0);color:var(--brand,#3E8E6E);font-size:26px}
.eb-title{margin:0;font-size:calc(18px*var(--fs-scale));font-weight:700;color:var(--ink)}
.eb-desc{margin:0;max-width:360px;font-size:calc(13px*var(--fs-scale));line-height:1.6;color:var(--muted)}
.eb-actions{display:flex;gap:12px;margin-top:6px}
.eb-retry,.eb-refresh{padding:9px 18px;border-radius:10px;font-family:inherit;font-size:calc(13px*var(--fs-scale));cursor:pointer}
.eb-retry{border:1px solid var(--brand);background:var(--brand);color:#fff}
.eb-refresh{border:1px solid var(--line);background:var(--paper);color:var(--ink-soft)}
.eb-refresh:hover{color:var(--brand);border-color:var(--brand-line)}
.eb-detail{margin:8px 0 0;max-width:520px;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);word-break:break-all}
</style>
