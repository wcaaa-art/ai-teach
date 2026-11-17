// @ts-check
import { computed, ref } from 'vue'
import { defineStore } from 'pinia'
import { getSettings, saveSettings, setDataOwner } from '../db/index.js'
import { fetchCurrentUser } from '../services/api.js'

export const useAppStore = defineStore('app', () => {
  const plans = ref([])
  const profile = ref(null)
  const settings = ref({
    cameraDefault: false,
    soundEnabled: true,
    ttsEnabled: true,
    darkMode: false,
    // 护眼模式：在现有配色上叠一层暖色滤镜。enabled 控制开关，strength 是 0~100 的强度百分比。
    // 强度单独存，用户关掉再打开时仍保留上次调好的档位。
    eyeCareEnabled: false,
    eyeCareStrength: 40,
    lowPerformance: false,
    // 主页「从一个好奇开始」展示的科目，用户可自由增减，只保存在本机设置；默认只放语数英
    favoriteSubjects: ['语文', '数学', '英语'],
    // 上一次在专注页选择的时长（分钟）；null 表示用户从未选过，由计划值兜底
    focusMinutes: null,
    // 上一次专注页的任务选择：plan 走计划任务，free 是计划外自定义专注
    lastFocusMode: 'plan',
    lastFocusPlanId: null,
    lastFreeTaskName: ''
  })
  const hydrated = ref(false)
  const user = ref(null)
  const authChecked = ref(false)
  let authRequest = null
  const isDark = computed(() => settings.value.darkMode)

// 视觉设置镜像：IndexedDB 是异步的，首屏拿到设置前会闪一下浅色（或没有护眼滤镜）。
// 把主题和护眼档位同步写一份到 localStorage，index.html 的内联脚本就能在首帧前把两者都定下来。
// 所有写入口（hydrate / updateSettings / App.vue）都走这里，避免出现三种状态各写各的。
function applyVisualSettings() {
  const root = document.documentElement
  const dark = Boolean(settings.value.darkMode)
  const eyeOn = Boolean(settings.value.eyeCareEnabled)
  const strength = Math.max(0, Math.min(100, Number(settings.value.eyeCareStrength) || 0))
  root.dataset.theme = dark ? 'dark' : 'light'
  root.dataset.eye = eyeOn ? 'on' : 'off'
  // 滤镜层用这个变量控制暖色浓度；0~100 映射到 0~1，具体衰减写在 styles.css 里。
  root.style.setProperty('--eye-strength', String(strength / 100))
  try {
    localStorage.setItem('ai-teach-theme', dark ? 'dark' : 'light')
    localStorage.setItem('ai-teach-eyecare', JSON.stringify({ enabled: eyeOn, strength }))
  } catch (error) { /* 隐私模式下写不进去，忽略 */ }
}

  async function hydrate() {
    if (hydrated.value) return
    try {
      const persisted = await getSettings()
      if (persisted) settings.value = { ...settings.value, ...persisted }
      applyVisualSettings()
    } catch (error) {
      console.warn('本机设置读取失败，将使用默认设置。', error)
    } finally {
      hydrated.value = true
    }
  }

  async function updateSettings(patch) {
    settings.value = { ...settings.value, ...patch }
    // 展开成普通对象再写库：Vue 响应式 Proxy 无法被 IndexedDB 结构化克隆
    try { await saveSettings({ ...settings.value }) } catch (error) { console.warn('本机设置暂时无法持久化。', error) }
    applyVisualSettings()
  }

  // 登录态通过 HttpOnly Cookie 在服务端维持，这里只缓存当前用户并去重并发查询。
  async function ensureAuth() {
    if (authChecked.value) return user.value
    if (!authRequest) {
      authRequest = fetchCurrentUser().then(async result => {
        user.value = result.success && result.data?.user ? result.data.user : null
        // 学习数据按账号隔离：恢复登录态后切到该账号的数据空间。
        await setDataOwner(user.value?.id || 'local')
        return user.value
      }).catch(async () => {
        user.value = null
        await setDataOwner('local')
        return null
      }).finally(() => {
        authChecked.value = true
        authRequest = null
      })
    }
    return authRequest
  }

  function setUser(value) {
    user.value = value || null
    authChecked.value = true
  }

  // 退出登录：清空当前用户并回到本地模式的数据空间。
  async function clearUser() {
    user.value = null
    authChecked.value = true
    await setDataOwner('local')
  }

  function setPlans(value) { plans.value = value }
  function setProfile(value) { profile.value = value }

  return { plans, profile, settings, isDark, hydrated, user, authChecked, hydrate, ensureAuth, setUser, clearUser, updateSettings, applyVisualSettings, setPlans, setProfile }
})
