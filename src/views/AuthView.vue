<script setup>
import { computed, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useAppStore } from '../stores/app.js'
import { loginAccount, registerAccount } from '../services/api.js'
import { getDataOwner, getLocalDataSummary, setDataOwner, syncLocalDataToOwner, clearLocalLearningData } from '../db/index.js'

const router = useRouter()
const route = useRoute()
const store = useAppStore()
const mode = ref('login')
// 登录标识：用户名或邮箱都能登，所以只用一个输入框。
const account = ref('')
const username = ref('')
// 邮箱改为选填，只有注册时出现，用来以后找回账号。
const email = ref('')
const password = ref('')
const agreed = ref(false)
// 只控制会话 Cookie 是否保留 7 天；不把密码写进本地存储。
const remember = ref(true)
const submitting = ref(false)
const errorMessage = ref('')
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 与 server/auth.js 的 USERNAME_PATTERN 保持一致。
const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{2,20}$/u

// 从受限页面被守卫送过来时，把目标页标题显式告诉用户，登录后会自动回到那里。
const redirectTarget = computed(() => {
  const target = route.query.redirect
  if (typeof target !== 'string' || !target.startsWith('/')) return ''
  return router.resolve(target).meta?.title || ''
})

// 改密码后所有会话都失效，账号中心会把用户送回来，这里说明为什么被登出。
const noticeText = computed(() => (
  route.query.notice === 'password-changed' ? '密码已修改，请用新密码重新登录。' : ''
))

function switchMode(value) {
  mode.value = value
  errorMessage.value = ''
}

function validate() {
  if (mode.value === 'login') {
    if (!account.value.trim()) return '请输入用户名或邮箱。'
  } else {
    if (!USERNAME_PATTERN.test(username.value.trim())) return '用户名需要 2 到 20 个字符，可用中文、字母、数字、下划线和连字符。'
    const mail = email.value.trim()
    if (mail && !EMAIL_PATTERN.test(mail)) return '邮箱格式不正确；不需要邮箱可以留空。'
  }
  if (password.value.length < 8 || password.value.length > 128) return '密码长度需要为 8 到 128 个字符。'
  if (mode.value === 'register' && !agreed.value) return '请先同意学习数据使用说明。'
  return ''
}

// 本地模式用过的数据：登录/注册时询问是否同步到当前账号，不同步则账号从空白开始。
async function applyLocalData(account, previousOwner) {
  if (previousOwner === 'local') {
    const summary = await getLocalDataSummary()
    if (summary.total > 0) {
      const parts = []
      if (summary.plans) parts.push(`${summary.plans} 个学习计划`)
      if (summary.assessments) parts.push(`${summary.assessments} 次摸底记录`)
      if (summary.focusSessions) parts.push(`${summary.focusSessions} 次专注记录`)
      const detail = parts.length ? parts.join('、') : `${summary.total} 条学习记录`
      let confirmed = false
      try {
        await ElMessageBox.confirm(
          `本机还有本地模式留下的 ${detail}。同步会把这些记录迁移到当前账号，并清空本地模式的学习数据（主题等设置保留）。不同步的话账号从空白开始，本地数据仍保留在本地模式。`,
          '同步本地学习数据',
          { confirmButtonText: '同步并清空本地', cancelButtonText: '不同步', type: 'info', distinguishCancelAndClose: true }
        )
        confirmed = true
      } catch (action) {
        // 选择不同步或关闭弹窗：本地记录原地保留。
      }
      if (confirmed) {
        const result = await syncLocalDataToOwner(account.id)
        await clearLocalLearningData()
        ElMessage.success(`已迁移 ${result.copied} 条记录到当前账号，本地模式已清空。`)
      } else {
        ElMessage.info('已跳过同步，本地学习数据仍保留在本地模式。')
      }
    }
  }
  // 切换到账号自己的数据空间；之后新产生的数据只属于该账号。
  await setDataOwner(account.id)
}

async function submit() {
  if (submitting.value) return
  errorMessage.value = validate()
  if (errorMessage.value) return
  submitting.value = true
  const previousOwner = getDataOwner()
  try {
    const payload = mode.value === 'login'
      ? { account: account.value.trim(), password: password.value, remember: remember.value }
      : { username: username.value.trim(), email: email.value.trim(), password: password.value, remember: remember.value }
    const result = mode.value === 'login' ? await loginAccount(payload) : await registerAccount(payload)
    if (!result.success) {
      errorMessage.value = result.error || '账号服务暂时不可用，请稍后再试。'
      return
    }
    store.setUser(result.data.user)
    await applyLocalData(result.data.user, previousOwner)
    ElMessage.success(mode.value === 'login' ? '登录成功，欢迎回来。' : '账号创建成功，开始今天的学习吧。')
    const redirect = typeof route.query.redirect === 'string' && route.query.redirect.startsWith('/') ? route.query.redirect : '/home'
    router.push(redirect)
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="auth-page page">
    <div class="auth-back"><el-button text @click="router.push('/home')">← 返回学习主页</el-button></div>
    <section class="auth-layout">
      <div class="auth-story"><div class="story-mark brand-grid" role="img" aria-label="Ai学习"><span class="mark-latin">A</span><span class="mark-latin">i</span><span class="mark-cjk">学</span><span class="mark-cjk">习</span></div><span class="eyebrow">你的学习空间</span><h2>把每一次<br><em>“我不会”</em><br>变成下一步。</h2><p>登录后同步你的学习计划、专注记录和成长轨迹。未登录时可以先浏览主页与专注空间。</p><div class="story-foot"><span class="story-line"></span><small>学习数据由你掌握</small></div></div>
      <div class="auth-card surface"><div class="auth-tabs"><button :class="{active:mode==='login'}" @click="switchMode('login')">登录</button><button :class="{active:mode==='register'}" @click="switchMode('register')">注册</button></div><div class="auth-heading"><h3>{{ mode === 'login' ? '欢迎回来' : '创建你的学习空间' }}</h3><p>{{ mode === 'login' ? '继续今天的学习路线' : '先起一个用户名，学习从这里开始' }}</p></div><p v-if="noticeText" class="auth-gate-hint">{{ noticeText }}</p><p v-else-if="redirectTarget" class="auth-gate-hint">登录后自动回到「{{ redirectTarget }}」</p><el-form @submit.prevent="submit"><el-form-item v-if="mode==='login'" label="用户名或邮箱"><el-input v-model="account" autocomplete="username" placeholder="用户名，或注册时填的邮箱" size="large" maxlength="64" @keyup.enter="submit" /></el-form-item><template v-else><el-form-item label="用户名"><el-input v-model="username" autocomplete="username" placeholder="2-20 个字符，登录时用它" size="large" maxlength="20" /></el-form-item><el-form-item label="邮箱（选填）"><el-input v-model="email" type="email" autocomplete="email" placeholder="不填也能用，之后可以补" size="large" maxlength="254" /></el-form-item></template><el-form-item label="密码"><el-input v-model="password" type="password" show-password :autocomplete="mode === 'register' ? 'new-password' : 'current-password'" placeholder="至少 8 位字符" size="large" @keyup.enter="submit" /></el-form-item><div class="auth-options"><el-checkbox v-model="remember">7 天内自动登录</el-checkbox><span>公共电脑请取消勾选</span></div><el-checkbox v-if="mode==='register'" v-model="agreed">我同意学习数据使用说明</el-checkbox><el-alert v-if="errorMessage" :title="errorMessage" type="error" :closable="false" show-icon style="margin-top:16px" /><el-button type="primary" size="large" class="auth-submit" :loading="submitting" @click="submit">{{ mode === 'login' ? '登录学习空间' : '创建账号' }} <span>→</span></el-button></el-form><div class="auth-divider"><span>或</span></div><el-button plain size="large" class="local-button" @click="router.push('/home')">先回主页看看</el-button><p class="auth-privacy">隐私优先 · 学习数据由你掌握，可随时导出或删除</p></div>
    </section>
  </div>
</template>

<style scoped>
.auth-page{max-width:1050px;min-height:calc(100vh - var(--nav-h, 82px));padding-top:25px}.auth-back{margin-bottom:20px}.auth-layout{display:grid;grid-template-columns:.95fr 1.05fr;gap:70px;align-items:center;max-width:900px;margin:0 auto}.auth-story{padding:20px 0}.story-mark{width:44px;height:44px;border-radius:14px;background:var(--brand-gradient);color:#fff;font-size:calc(44px*var(--fs-scale));margin-bottom:30px}.auth-story h2{font-size:calc(40px*var(--fs-scale));line-height:1.24;letter-spacing:-.025em;font-weight:600;margin:17px 0;color:var(--text)}.auth-story h2 em{font-style:normal;color:var(--primary)}.auth-story p{max-width:335px;color:var(--muted);line-height:1.8;font-size:calc(14px*var(--fs-scale))}.story-foot{display:flex;align-items:center;gap:10px;margin-top:42px;color:var(--muted)}.story-line{width:32px;height:1px;background:var(--accent)}.auth-card{padding:31px 34px;border-radius:23px}.auth-tabs{display:flex;gap:23px;border-bottom:1px solid var(--border);margin-bottom:26px}.auth-tabs button{padding:0 0 13px;border:0;background:transparent;color:var(--muted);font-size:calc(15px*var(--fs-scale));cursor:pointer;position:relative}.auth-tabs button.active{color:var(--primary);font-weight:700}.auth-tabs button.active:after{content:'';position:absolute;height:2px;background:var(--primary);left:0;right:0;bottom:-1px}.auth-heading h3{font-size:calc(24px*var(--fs-scale));margin:0 0 7px}.auth-heading p{font-size:calc(13px*var(--fs-scale));color:var(--muted);margin:0 0 23px}.auth-card :deep(.el-form-item){margin-bottom:17px}.auth-card :deep(.el-form-item__label){color:var(--text);font-size:calc(12px*var(--fs-scale))}.auth-submit{width:100%;margin-top:21px}.auth-submit span{margin-left:auto;font-size:calc(18px*var(--fs-scale))}.auth-divider{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:calc(12px*var(--fs-scale));margin:22px 0}.auth-divider:before,.auth-divider:after{content:'';height:1px;background:var(--border);flex:1}.local-button{width:100%}.auth-privacy,.auth-notice{text-align:center;color:var(--muted);font-size:calc(11px*var(--fs-scale));line-height:1.6;margin:17px 0 0}.auth-gate-hint{margin:-11px 0 18px;padding:9px 12px;border-radius:10px;background:var(--primary-soft);color:var(--primary);font-size:calc(12px*var(--fs-scale));line-height:1.5}.auth-notice{padding:10px;border-radius:10px;background:var(--primary-soft);color:var(--primary)}.auth-options{display:flex;align-items:center;justify-content:space-between;gap:10px;margin:-4px 0 4px}.auth-options span{color:var(--muted);font-size:calc(11px*var(--fs-scale))}
@media(max-width:760px){.auth-page{padding:16px 13px}.auth-layout{grid-template-columns:1fr;gap:22px;max-width:500px}.auth-story{padding:10px 7px}.auth-story h2{font-size:calc(31px*var(--fs-scale))}.story-foot{margin-top:20px}.auth-card{padding:25px 22px}}
</style>
