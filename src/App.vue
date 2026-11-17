<script setup>
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import { useAppStore } from './stores/app.js'

const store = useAppStore()
const route = useRoute()
const ready = ref(false)
// 登录态决定 IndexedDB 用哪个库：切库后用它做 key 重挂外壳，页面会重新从正确的库读数据。
const contentKey = computed(() => store.user?.id || 'local')

function applyTheme() {
  document.documentElement.dataset.theme = store.settings.darkMode ? 'dark' : 'light'
}

onMounted(async () => {
  applyTheme()
  // 看门狗：后端没起时 /auth/me 要等满 10 秒超时，不能让整页空白。
  // 超过 2 秒就先按本机模式渲染，登录态稍后回来会通过 contentKey 重挂，不会读错库。
  const watchdog = setTimeout(() => { ready.value = true }, 2000)
  try {
    await store.hydrate()
    await store.ensureAuth()
  } catch (error) {
    console.warn('启动自检未完成，先按本机模式渲染。', error)
  } finally {
    clearTimeout(watchdog)
    applyTheme()
    ready.value = true
  }
})
watch(() => store.settings.darkMode, applyTheme)
</script>

<template>
  <AppShell v-if="ready" :key="contentKey" :title="route.meta.title || 'Ai学习小伙伴'">
    <ErrorBoundary>
      <router-view v-slot="{ Component, route: current }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="current.path" />
        </transition>
      </router-view>
    </ErrorBoundary>
  </AppShell>

  <!-- 启动骨架：只在首次进入的 1~2 秒内出现，保持与页面一致的版式节奏，避免整屏空白 -->
  <div v-else class="app-boot" aria-busy="true" aria-live="polite">
    <div class="boot-bar">
      <span class="boot-logo">Ai学习小伙伴</span>
      <span class="boot-nav"><i></i><i></i><i></i><i></i></span>
    </div>
    <div class="boot-body">
      <span class="boot-eyebrow">正在准备本地学习空间</span>
      <span class="boot-title"></span>
      <span class="boot-title short"></span>
      <div class="boot-cards">
        <span v-for="index in 3" :key="index" class="boot-card"></span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-boot{min-height:100vh;background:var(--bg);display:flex;flex-direction:column}
.boot-bar{height:64px;display:flex;align-items:center;justify-content:space-between;padding:0 28px;border-bottom:1px solid var(--border);background:var(--surface)}
.boot-logo{font-size:calc(15px*var(--fs-scale));font-weight:600;color:var(--text);letter-spacing:.02em}
.boot-nav{display:flex;gap:18px}
.boot-nav i{width:46px;height:10px;border-radius:6px;background:var(--surface-soft);display:block}
.boot-body{flex:1;width:min(1180px,92vw);margin:0 auto;padding:56px 0 40px;display:flex;flex-direction:column;gap:14px}
.boot-eyebrow{font-size:calc(12px*var(--fs-scale));color:var(--muted);letter-spacing:.18em}
.boot-title{height:26px;width:min(520px,70%);border-radius:10px;background:var(--surface-soft);display:block}
.boot-title.short{width:min(320px,46%)}
.boot-cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;margin-top:22px}
.boot-card{height:150px;border-radius:18px;background:var(--surface);border:1px solid var(--border);box-shadow:var(--shadow);display:block}
.boot-title,.boot-card,.boot-nav i{animation:bootPulse 1.4s ease-in-out infinite}
@keyframes bootPulse{0%,100%{opacity:1}50%{opacity:.55}}
@media (prefers-reduced-motion: reduce){.boot-title,.boot-card,.boot-nav i{animation:none}}
@media (max-width:800px){
  .boot-bar{padding:0 16px}
  .boot-nav i:nth-child(n+3){display:none}
  .boot-body{padding:32px 0}
}
</style>
