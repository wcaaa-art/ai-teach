<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app.js'
import { logoutAccount } from '../services/api.js'
const props = defineProps({ title: { type: String, default: 'Ai学习小伙伴' } })
const router = useRouter(); const route = useRoute(); const store = useAppStore()
const loggingOut = ref(false)

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  const result = await logoutAccount()
  loggingOut.value = false
  if (!result.success) { ElMessage.error(result.error || '退出登录失败，请检查本机服务后重试。'); return }
  await store.clearUser()
  ElMessage.success('已退出登录。')
  router.push('/home')
}
const nav = [
  { path: '/home', label: '学习主页', color: '#2f6fed', icon: ['M3.5 10.5 12 4l8.5 6.5', 'M5.5 9.5V20h13V9.5', 'M9.5 20v-5h5v5'] },
  { path: '/diagnosis', label: '学情诊断', color: '#f08c3a', icon: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15.5 8.5l-2 5-5 2 2-5 5-2z'] },
  { path: '/plans', label: '学习计划', color: '#34a853', icon: ['M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z', 'M4 18.5A2.5 2.5 0 0 1 6.5 16H20', 'M8 7h8'] },
  { path: '/focus', label: '专注空间', color: '#19a9a9', icon: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7.5V12l3 2'] },
  { path: '/tutor', label: 'AI 答疑', color: '#8b5cf6', icon: ['M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z', 'M8 9.5h8', 'M8 12.5h5'] },
  { path: '/dashboard', label: '学习看板', color: '#2f6fed', icon: ['M3 20h18', 'M4 20V10', 'M9 20V6', 'M14 20V12', 'M19 20V4'] },
  { path: '/settings', label: '设置', color: '#8a94a6', icon: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'] }
]
const isFocus = computed(() => route.name === 'focus')
</script>
<template>
  <div class="app-shell" :class="{ 'focus-shell': isFocus }">
    <aside class="side-nav">
      <div class="brand" @click="router.push('/home')"><span class="brand-mark brand-grid" role="img" aria-label="Ai学习"><span class="mark-latin">A</span><span class="mark-latin">i</span><span class="mark-cjk">学</span><span class="mark-cjk">习</span></span><div><strong>Ai学习小伙伴</strong><small>专注每一步成长</small></div></div>
      <nav><button v-for="item in nav" :key="item.path" :title="item.label" :class="{active: route.path === item.path, 'nav-divider': item.path === '/settings'}" @click="router.push(item.path)"><svg class="nav-icon" viewBox="0 0 24 24" :style="{ color: route.path === item.path ? 'var(--primary)' : item.color }" aria-hidden="true"><path v-for="(d, index) in item.icon" :key="index" :d="d" /></svg><span class="nav-label">{{ item.label }}</span></button></nav>
      <div class="nav-actions" :class="{ 'is-authed': Boolean(store.user) }"><el-tag type="success" effect="plain">{{ store.user ? '已登录' : '本地模式' }}</el-tag><el-button v-if="store.user" plain round class="login-link" @click="router.push('/account')">{{ store.user.displayName || store.user.email }}</el-button><el-button v-if="store.user" plain round :loading="loggingOut" @click="logout">退出登录</el-button><el-button v-else plain round class="login-link" @click="router.push('/auth')">登录 / 注册</el-button></div>
      <div class="nav-footer"><span class="status-dot"></span> 数据仅存本机<br><small>{{ store.user ? '隐私优先 · 账号已连接' : '隐私优先 · 无需登录' }}</small></div>
    </aside>
    <main class="main-content">
      <header v-if="!isFocus" class="topbar"><div><span class="eyebrow">AI 自适应学习工作台</span><h1>{{ props.title }}</h1></div><div class="top-actions"><el-tag class="mode-tag" type="success" effect="plain">{{ store.user ? '已登录' : '本地模式' }}</el-tag><el-button v-if="store.user" plain round class="login-link account-link" @click="router.push('/account')">{{ store.user.displayName || store.user.email }}</el-button><el-button v-if="store.user" plain round :loading="loggingOut" @click="logout">退出登录</el-button><el-button v-else plain round class="login-link" @click="router.push('/auth')">登录 / 注册</el-button></div></header>
      <slot />
    </main>
  </div>
</template>
<style scoped>
.app-shell { --nav-h:82px; min-height:100vh; display:flex; }.side-nav { width:246px; flex:none; padding:24px 16px; display:flex; flex-direction:column; background:var(--surface); border-right:1px solid var(--border); }.brand { display:flex; gap:11px; align-items:center; cursor:pointer; padding:8px 9px 25px; }.brand-mark { width:34px;height:34px;flex:none;border-radius:10px;background:var(--brand-gradient);color:#fff;font-size:34px; }.brand strong { display:block;font-size:15px; }.brand small { color:var(--muted);font-size:11px; }.side-nav nav { display:grid; gap:6px; }.side-nav nav button { border:0;background:transparent;color:var(--muted);text-align:left;border-radius:12px;padding:12px 13px;cursor:pointer;display:flex;gap:10px;align-items:center;transition:background-color .2s,color .2s; }.side-nav nav button:hover,.side-nav nav button.active { background:var(--primary-soft); color:var(--primary); }.nav-footer { margin-top:auto;color:var(--muted);font-size:12px;line-height:1.8;padding:14px 10px; }.status-dot { display:inline-block;width:8px;height:8px;border-radius:50%;background:#74b48e;margin-right:5px; }.main-content { flex:1;min-width:0; }.topbar { height:var(--nav-h);padding:17px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);background:color-mix(in srgb, var(--bg) 84%, transparent); }.topbar h1 { margin:3px 0 0;font-size:20px; }.eyebrow { color:var(--primary);font-size:12px; }.top-actions { display:flex;gap:12px;align-items:center; }.login-link{color:var(--primary);border-color:var(--border)}.nav-actions { display:none; }.focus-shell .side-nav { display:none; }.focus-shell .main-content { width:100%; }
/* 桌面端：侧边栏改为顶部横向导航；801px 以下沿用原侧边布局。 */
.nav-icon{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
@media(min-width:801px){
/* 桌面端：白色胶囊导航浮在页面底色上，彩色线性图标 + 选中态浅色胶囊。 */
.app-shell{--nav-h:80px;flex-direction:column}.side-nav{width:auto;min-height:64px;margin:16px 24px 0;flex-direction:row;align-items:center;gap:16px;padding:10px 18px;border-right:0;border-bottom:0;border-radius:18px;background:var(--surface);box-shadow:0 14px 34px rgba(35,74,83,.08);position:sticky;top:16px;z-index:20}.brand{flex:none;padding:0 16px 0 0;gap:10px;border-right:1px solid #e6ebf2;border-radius:0}.brand small{font-size:10px}.side-nav nav{display:flex;flex:1;min-width:0;gap:2px;align-items:center;justify-content:flex-start;overflow-x:auto}.side-nav nav button{position:relative;padding:9px 13px;font-size:13.5px;font-weight:600;gap:8px;white-space:nowrap;border-radius:10px}.side-nav nav button.active{background:var(--primary-soft);color:var(--primary)}.side-nav nav button.active:after{content:'';position:absolute;left:12px;right:12px;bottom:0;height:2px;border-radius:2px;background:var(--primary)}.side-nav nav button.nav-divider{margin-left:auto}.side-nav nav button.nav-divider:before{content:'';position:absolute;left:-9px;top:50%;transform:translateY(-50%);width:1px;height:18px;background:#e6ebf2}.nav-footer{display:none}.topbar{display:none}.main-content{width:100%}.nav-actions{display:flex;align-items:center;gap:10px;flex:none;padding-left:16px;border-left:1px solid #e6ebf2}.nav-actions .login-link{max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nav-actions .login-link :deep(span){display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
/* 801–1120px 导航空间有限：只留图标（悬停 title 可读），避免右侧操作区挤爆导航。 */
@media(min-width:801px) and (max-width:1120px){.brand div{display:none}.side-nav nav button{padding:9px 10px}.side-nav nav button .nav-label{display:none}}
/* 1121–1280px 导航空间有限：收紧左右留白与导航项间距；登录后隐藏与账号按钮重复的「已登录」徽标，保证文字、长称呼与右侧操作区不溢出。 */
@media(min-width:1121px) and (max-width:1280px){.side-nav{margin:16px 20px 0;padding:10px 14px;gap:10px}.brand{padding:0 10px 0 0}.brand small{display:none}.side-nav nav{gap:0}.side-nav nav button{padding:9px 9px;gap:6px;font-size:12.5px}.nav-actions.is-authed :deep(.el-tag){display:none}}
@media(max-width:800px){.side-nav{width:67px;padding:20px 8px}.brand div,.side-nav nav button:not(.active)::after,.nav-footer{display:none}.brand{padding:8px 10px 28px}.brand-mark{width:30px;height:30px;font-size:30px}.side-nav nav button{justify-content:center;padding:12px}.side-nav nav button .nav-label{display:none}.topbar{padding:14px 18px}.topbar .eyebrow,.topbar .mode-tag,.topbar .account-link{display:none}.topbar h1{margin:0}}
</style>
