<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app.js'
import { logoutAccount } from '../services/api.js'

const router = useRouter()
const store = useAppStore()
const loggingOut = ref(false)
const createdAt = computed(() => {
  const time = store.user?.createdAt
  return time ? new Date(time).toLocaleDateString('zh-CN') : '—'
})

async function logout() {
  if (loggingOut.value) return
  loggingOut.value = true
  const result = await logoutAccount()
  loggingOut.value = false
  if (!result.success) {
    ElMessage.error(result.error || '退出登录失败，请检查本机服务后重试。')
    return
  }
  await store.clearUser()
  ElMessage.success('已退出登录。')
  router.push('/home')
}
</script>

<template>
  <div class="page">
    <div class="page-header"><div><h2 class="page-title">账号中心</h2><p class="page-subtitle">登录状态由本机账号服务维持，刷新页面后仍然有效。</p></div></div>
    <div class="grid-2">
      <section class="surface surface-pad">
        <h3 class="section-title">账号信息</h3>
        <div class="account-row"><span>称呼</span><strong>{{ store.user?.displayName || '—' }}</strong></div>
        <div class="account-row"><span>邮箱</span><strong>{{ store.user?.email || '—' }}</strong></div>
        <div class="account-row"><span>注册日期</span><strong>{{ createdAt }}</strong></div>
        <el-button plain size="large" style="margin-top:20px" :loading="loggingOut" @click="logout">退出登录</el-button>
      </section>
      <section class="surface surface-pad">
        <h3 class="section-title">数据说明</h3>
        <p class="muted">学习数据不上云，按账号隔离保存在本浏览器 IndexedDB：退出登录后回到本地模式的数据，不同账号之间互不可见。换设备、清理浏览器缓存或重装系统前，请到「系统设置 → 数据备份」导出 JSON。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.account-row{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)}.account-row:last-of-type{border-bottom:0}.account-row span{font-size:13px;color:var(--muted)}.account-row strong{font-size:14px;word-break:break-all}.muted{font-size:13px;line-height:1.8}
</style>
