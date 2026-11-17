<script setup>
import { onMounted, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import AppShell from './components/AppShell.vue'
import ErrorBoundary from './components/ErrorBoundary.vue'
import { useAppStore } from './stores/app.js'

const store = useAppStore()
const route = useRoute()
const ready = ref(false)
onMounted(async () => {
  await store.hydrate()
  // 先确认登录态并切到对应账号的数据空间，避免登录用户先看到本地模式的数据。
  await store.ensureAuth()
  document.documentElement.dataset.theme = store.settings.darkMode ? 'dark' : 'light'
  ready.value = true
})
watch(() => store.settings.darkMode, value => { document.documentElement.dataset.theme = value ? 'dark' : 'light' })
</script>

<template>
  <div v-if="!ready" class="app-loading">正在准备本地学习空间…</div>
  <AppShell v-else :title="route.meta.title || 'Ai学习小伙伴'">
    <ErrorBoundary>
      <router-view v-slot="{ Component, route: current }">
        <transition name="page" mode="out-in">
          <component :is="Component" :key="current.path" />
        </transition>
      </router-view>
    </ErrorBoundary>
  </AppShell>
</template>
<style scoped>.app-loading{min-height:100vh;display:grid;place-items:center;color:var(--muted);font-size:calc(14px*var(--fs-scale))}</style>
