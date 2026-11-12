<script setup>
import { computed, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/app.js'
import { logoutAccount } from '../services/api.js'
import { exportLearningData, importLearningData } from '../db/index.js'
import { validateBackup } from '../utils/backup.js'

const router = useRouter()
const store = useAppStore()
const loggingOut = ref(false)
const exporting = ref(false)
const importing = ref(false)
const importedCount = ref(0)
const fileInput = ref(null)
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

// 学习数据只在本机浏览器，换设备前必须自己留一份 JSON 备份。
async function exportData() {
  if (exporting.value) return
  exporting.value = true
  try {
    const payload = await exportLearningData()
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')
    const link = document.createElement('a')
    link.href = url
    link.download = `ai-teach-backup-${stamp}.json`
    link.click()
    URL.revokeObjectURL(url)
    ElMessage.success('备份已导出，请保存到其他设备或网盘。')
  } finally {
    exporting.value = false
  }
}

function pickImportFile() {
  fileInput.value?.click()
}

async function importFile(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  if (!file || importing.value) return
  let payload = null
  try {
    payload = JSON.parse(await file.text())
  } catch {
    ElMessage.error('文件不是合法的 JSON，无法导入。')
    return
  }
  const preview = validateBackup(payload)
  if (!preview.ok) {
    ElMessage.error(preview.error)
    return
  }
  try {
    await ElMessageBox.confirm(`将导入 ${preview.total} 条学习记录，同一条记录会被备份里的版本覆盖，现有数据不会删除。`, '导入备份', {
      confirmButtonText: '导入', cancelButtonText: '取消', type: 'warning'
    })
  } catch {
    return
  }
  importing.value = true
  try {
    const result = await importLearningData(payload)
    if (!result.ok) {
      ElMessage.error(result.error || '导入失败。')
      return
    }
    importedCount.value = result.imported
    ElMessage.success(`已导入 ${result.imported} 条记录，正在刷新数据。`)
    setTimeout(() => window.location.reload(), 600)
  } finally {
    importing.value = false
  }
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
        <p class="muted">学习数据不上云，按账号隔离保存在本浏览器 IndexedDB：退出登录后回到本地模式的数据，不同账号之间互不可见。换设备、清理浏览器缓存或重装系统前，请先导出备份。</p>
      </section>
      <section class="surface surface-pad backup-card">
        <h3 class="section-title">数据备份</h3>
        <p class="muted">导出为 JSON 文件，包含计划、摸底、章节测试、专注记录、错题与对话。导入时按记录 id 覆盖，不删除现有数据。</p>
        <div class="backup-actions">
          <el-button plain size="large" :loading="exporting" @click="exportData">导出学习数据</el-button>
          <el-button plain size="large" :loading="importing" @click="pickImportFile">导入备份</el-button>
          <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importFile" />
        </div>
        <p v-if="importedCount" class="muted">本次导入 {{ importedCount }} 条记录。</p>
      </section>
    </div>
  </div>
</template>

<style scoped>
.account-row{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)}.account-row:last-of-type{border-bottom:0}.account-row span{font-size:13px;color:var(--muted)}.account-row strong{font-size:14px;word-break:break-all}.muted{font-size:13px;line-height:1.8}
.backup-card{grid-column:1/-1}.backup-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
</style>
