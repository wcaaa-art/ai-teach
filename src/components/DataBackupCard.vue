<script setup>
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { exportLearningData, importLearningData } from '../db/index.js'
import { validateBackup } from '../utils/backup.js'

// 本地优先：学习数据只在本浏览器，换设备或清缓存前必须自己留一份 JSON 备份。
const exporting = ref(false)
const importing = ref(false)
const importedCount = ref(0)
const fileInput = ref(null)

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
  <section class="surface surface-pad backup-card">
    <h3 class="section-title">数据备份</h3>
    <p class="muted">学习数据只存在本浏览器。导出为 JSON（计划、摸底、章节测试、专注记录、错题与对话）；导入时按记录 id 覆盖，不删除现有数据。未登录的本地模式也能在这里备份。</p>
    <div class="backup-actions">
      <el-button plain size="large" :loading="exporting" @click="exportData">导出学习数据</el-button>
      <el-button plain size="large" :loading="importing" @click="pickImportFile">导入备份</el-button>
      <input ref="fileInput" type="file" accept="application/json,.json" hidden @change="importFile" />
    </div>
    <p v-if="importedCount" class="muted">本次导入 {{ importedCount }} 条记录。</p>
  </section>
</template>

<style scoped>
.backup-card{grid-column:1/-1}.muted{font-size:13px;line-height:1.8}.backup-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:16px}
</style>
