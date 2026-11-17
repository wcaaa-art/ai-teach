<script setup>
import { computed, reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app.js'
import { logoutAccount, updateAccountProfile, changeAccountPassword } from '../services/api.js'

const router = useRouter()
const store = useAppStore()
const loggingOut = ref(false)
const username = computed(() => store.user?.username || '')
const createdAt = computed(() => {
  const time = store.user?.createdAt
  return time ? new Date(time).toLocaleDateString('zh-CN') : '—'
})

// 称呼、用户名、邮箱共用一个小弹窗：都是单个文本字段，只是校验和提示不同。
const editor = reactive({ open: false, field: 'displayName', value: '', saving: false })
const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{2,20}$/u
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const editorTitle = computed(() => {
  if (editor.field === 'username') return '设置用户名'
  if (editor.field === 'email') return store.user?.email ? '修改邮箱' : '绑定邮箱'
  return '修改称呼'
})
const editorHint = computed(() => {
  if (editor.field === 'username') return '用户名用于登录，设置后不能再改，想清楚了再保存。'
  if (editor.field === 'email') return '邮箱只用于以后找回账号，随时可以改；留空保存表示解绑。'
  return '称呼只影响页面上显示的名字，随时可以再改。'
})
const editorMaxlength = computed(() => (editor.field === 'username' ? 20 : editor.field === 'email' ? 254 : 40))

function openEditor(field) {
  const current = { username: username.value, email: store.user?.email || '', displayName: store.user?.displayName || '' }
  editor.field = field
  editor.value = current[field] ?? ''
  editor.open = true
}

async function saveEditor() {
  if (editor.saving) return
  const value = editor.value.trim()
  const field = editor.field
  if (field === 'email') {
    // 邮箱允许留空（解绑）；填了才校验格式。
    if (value && !EMAIL_PATTERN.test(value)) {
      ElMessage.warning('邮箱格式不正确，或直接留空保存来解绑。')
      return
    }
  } else if (!value) {
    ElMessage.warning(field === 'username' ? '请输入用户名。' : '称呼不能为空。')
    return
  }
  if (field === 'username' && !USERNAME_PATTERN.test(value)) {
    ElMessage.warning('用户名需要 2 到 20 个字符，可用中文、字母、数字、下划线和连字符。')
    return
  }
  editor.saving = true
  const result = await updateAccountProfile({ [field]: value })
  editor.saving = false
  if (!result.success) {
    ElMessage.error(result.error || '保存失败，请稍后重试。')
    return
  }
  store.setUser(result.data.user)
  editor.open = false
  if (field === 'email') {
    ElMessage.success(result.data.user.email ? '邮箱已保存。' : '邮箱已解绑。')
    return
  }
  ElMessage.success(field === 'username' ? '用户名已设置，之后可以用它登录。' : '称呼已更新。')
}

// 改密码：旧密码由服务端校验，这里只挡明显不合规的输入。
const password = reactive({ open: false, current: '', next: '', confirm: '', saving: false })

async function savePassword() {
  if (password.saving) return
  if (password.next.length < 8 || password.next.length > 128) {
    ElMessage.warning('新密码长度需要为 8 到 128 个字符。')
    return
  }
  if (password.next !== password.confirm) {
    ElMessage.warning('两次输入的新密码不一致。')
    return
  }
  password.saving = true
  const result = await changeAccountPassword({ currentPassword: password.current, newPassword: password.next })
  password.saving = false
  if (!result.success) {
    ElMessage.error(result.error || '修改失败，请稍后重试。')
    return
  }
  password.open = false
  password.current = ''
  password.next = ''
  password.confirm = ''
  // 服务端已把会话版本 +1 并清了 Cookie，这里同步清掉本地登录态，
  // 再回到登录页——改密码的账号必须用新密码重新登录，这台设备也不例外。
  if (result.data?.reauthRequired) {
    await store.clearUser()
    router.push({ path: '/auth', query: { notice: 'password-changed', redirect: '/account' } })
    return
  }
  ElMessage.success('密码已更新，下次登录请用新密码。')
}

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
    <div class="page-header"><div><h2 class="page-title">账号中心</h2></div></div>
    <div class="grid-2">
      <section class="surface surface-pad">
        <h3 class="section-title">账号信息</h3>
        <div class="account-row">
          <span class="account-label">用户名</span>
          <span class="account-value">
            <strong>{{ username || '未设置' }}</strong>
            <el-button v-if="!username" link type="primary" @click="openEditor('username')">设置用户名</el-button>
          </span>
        </div>
        <div class="account-row">
          <span class="account-label">称呼</span>
          <span class="account-value">
            <strong>{{ store.user?.displayName || '—' }}</strong>
            <el-button link type="primary" @click="openEditor('displayName')">修改</el-button>
          </span>
        </div>
        <div class="account-row">
          <span class="account-label">邮箱</span>
          <span class="account-value">
            <strong>{{ store.user?.email || '未绑定' }}</strong>
            <el-button link type="primary" @click="openEditor('email')">{{ store.user?.email ? '修改' : '绑定' }}</el-button>
          </span>
        </div>
        <div class="account-row"><span class="account-label">注册日期</span><strong>{{ createdAt }}</strong></div>
        <div class="account-actions">
          <el-button plain size="large" @click="password.open = true">修改密码</el-button>
          <el-button plain size="large" :loading="loggingOut" @click="logout">退出登录</el-button>
        </div>
      </section>
      <section class="surface surface-pad">
        <h3 class="section-title">数据说明</h3>
        <p class="muted">学习数据不上云，按账号隔离保存在本浏览器 IndexedDB：退出登录后回到本地模式的数据，不同账号之间互不可见。换设备、清理浏览器缓存或重装系统前，请到「系统设置 → 数据备份」导出 JSON。</p>
      </section>
    </div>

    <el-dialog v-model="editor.open" :title="editorTitle" width="420px">
      <p class="dialog-hint">{{ editorHint }}</p>
      <el-input v-model="editor.value" size="large" :maxlength="editorMaxlength" show-word-limit :placeholder="editor.field === 'email' ? '留空保存即解绑' : ''" @keyup.enter="saveEditor" />
      <template #footer>
        <el-button @click="editor.open = false">取消</el-button>
        <el-button type="primary" :loading="editor.saving" @click="saveEditor">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="password.open" title="修改密码" width="440px">
      <p class="dialog-hint">需要先验证当前密码。改完后所有设备（包括这一台）都会退出登录，请用新密码重新登录。</p>
      <el-input v-model="password.current" type="password" show-password size="large" placeholder="当前密码" autocomplete="current-password" style="margin-bottom:12px" />
      <el-input v-model="password.next" type="password" show-password size="large" placeholder="新密码（8-128 位）" autocomplete="new-password" style="margin-bottom:12px" />
      <el-input v-model="password.confirm" type="password" show-password size="large" placeholder="再输一次新密码" autocomplete="new-password" @keyup.enter="savePassword" />
      <template #footer>
        <el-button @click="password.open = false">取消</el-button>
        <el-button type="primary" :loading="password.saving" @click="savePassword">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.account-row{display:flex;justify-content:space-between;gap:15px;align-items:center;padding:14px 0;border-bottom:1px solid var(--border)}.account-row:last-of-type{border-bottom:0}.account-label{font-size:calc(13px*var(--fs-scale));color:var(--muted);flex:none}.account-row strong{font-size:calc(14px*var(--fs-scale));word-break:break-all}.account-value{display:flex;align-items:center;gap:8px;min-width:0;justify-content:flex-end}.account-actions{display:flex;flex-wrap:wrap;gap:12px;margin-top:20px}.dialog-hint{font-size:calc(12px*var(--fs-scale));line-height:1.7;color:var(--muted);margin:0 0 14px}.muted{font-size:calc(13px*var(--fs-scale));line-height:1.8}
</style>
