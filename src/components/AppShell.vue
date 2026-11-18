<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { useAppStore } from '../stores/app.js'
import { getDataOwner, loadFocusSessions, loadMistakes, loadPlans, saveFocusSession } from '../db/index.js'
import { shouldPromptWeeklyReport, weekKeyOf } from '../utils/weeklyReportPlans.js'
import { duePlanCount, NOTICE_PRIORITY, nextDuePlan, staleMistakeCount, startedFocusToday, streakOneMistakeCount } from '../utils/notices.js'
import { formatClock, liveRemaining, readLiveFocus, writeLiveFocus } from '../utils/liveFocus.js'
import { finishStudy } from '../utils/studySession.js'
import FeedbackWidget from './FeedbackWidget.vue'
const props = defineProps({ title: { type: String, default: 'Ai学习小伙伴' } })
const router = useRouter(); const route = useRoute(); const store = useAppStore()
// AI 答疑页本身就是对话界面，隐藏悬浮助手和意见反馈，避免压住底部输入框。
const hideFloating = computed(() => route.path === '/tutor')

// === AppShell 通知中心：今日计划、长期未复习错题、待巩固错题、周报，统一在这里提醒 ===
const notices = ref([])
const noticeOpen = ref(false)
let noticeToken = 0
// 红点只统计当天事项：周报是一周内处理即可的提醒，不参与角标计数。
const dailyNoticeCount = computed(() => notices.value.filter(item => item.scope === 'day').length)
// 当天事项的固定 id：用于批量静音后判断是否需要给出「恢复今天的提醒」。
const dailyNoticeIds = ['today-plan', 'mistake-stale', 'mistake-streak']
const hasDismissedToday = ref(false)
function syncDismissedToday() {
  const owner = getDataOwner()
  hasDismissedToday.value = dailyNoticeIds.some(id => {
    try { return Boolean(localStorage.getItem(dailyNoticeKey(owner, id))) } catch (error) { return false }
  })
}
// 角标颜色跟着最靠前的一条当天事项走：计划红、待复习橙、待巩固黄。
const noticeBadgeTone = computed(() => {
  const top = notices.value.find(item => item.scope === 'day')
  if (!top) return ''
  if (top.id === 'today-plan') return 'is-plan'
  if (top.id === 'mistake-stale') return 'is-stale'
  return 'is-streak'
})

function todayKey(now = Date.now()) {
  const date = new Date(now)
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`
}

function dailyNoticeKey(owner, id) {
  return `ai-teach-notice-dismiss:${owner}:${id}:${todayKey()}`
}

function weeklyNotice() {
  const owner = getDataOwner()
  const weekKey = weekKeyOf()
  let hasReport = false
  let dismissed = false
  try { hasReport = Boolean(JSON.parse(localStorage.getItem(`ai-teach-weekly-report:${owner}:${weekKey}`) || 'null')?.report) } catch (error) { console.warn('周报缓存读取失败。', error) }
  try { dismissed = Boolean(localStorage.getItem(`ai-teach-weekly-report-tip:${owner}:${weekKey}`)) } catch (error) { console.warn('周报提示状态读取失败。', error) }
  if (!shouldPromptWeeklyReport({ hasReport, dismissed })) return null
  return {
    id: 'weekly-report',
    title: '本周学习周报',
    text: '新的一周开始了，生成周报看看上周哪些做法值得继续',
    action: '去生成',
    to: { path: '/dashboard', query: { focus: 'weekly-report' } },
    dismissText: '本周不再提示',
    dismissKey: `ai-teach-weekly-report-tip:${owner}:${weekKey}`,
    scope: 'week',
    priority: NOTICE_PRIORITY.weekly
  }
}

async function buildNotices() {
  const owner = getDataOwner()
  const list = []
  const weekly = weeklyNotice()
  if (weekly) list.push(weekly)
  try {
    const [plans, sessions, mistakes] = await Promise.all([loadPlans(), loadFocusSessions(), loadMistakes()])
    const due = duePlanCount(plans)
    if (due && !startedFocusToday(sessions)) {
      // 只点名最靠前的一条任务，减少「一打开就被任务清单压住」的感觉。
      const nextPlan = nextDuePlan(plans)
      list.push({
        id: 'today-plan',
        title: '今日计划',
        text: nextPlan
          ? `先做「${nextPlan.name}」，今天还有 ${due} 条计划任务待完成`
          : `今天还有 ${due} 条计划任务待完成，先挑一条 25 分钟的开工`,
        action: '去计划',
        to: { path: '/plans', query: { focusTask: nextPlan.id } },
        dismissText: '今天不再提示',
        dismissKey: dailyNoticeKey(owner, 'today-plan'),
        scope: 'day',
        priority: NOTICE_PRIORITY.plan
      })
    }
    const stale = staleMistakeCount(mistakes)
    if (stale) {
      list.push({
        id: 'mistake-stale',
        title: '错题该复习了',
        text: `${stale} 道错题超过 7 天没复习，今天挑几道过一遍，别让旧漏洞留到下周`,
        action: '去复习',
        to: { path: '/mistakes', query: { filter: 'stale' } },
        dismissText: '今天不再提示',
        dismissKey: dailyNoticeKey(owner, 'mistake-stale'),
        scope: 'day',
        priority: NOTICE_PRIORITY.staleMistake
      })
    }
    const streakOne = streakOneMistakeCount(mistakes)
    if (streakOne) {
      list.push({
        id: 'mistake-streak',
        title: '错题待巩固',
        text: `${streakOne} 道错题已经答对 1 次，再对一次就能自动消灭`,
        action: '去复习',
        to: '/mistakes',
        dismissText: '今天不再提示',
        dismissKey: dailyNoticeKey(owner, 'mistake-streak'),
        scope: 'day',
        priority: NOTICE_PRIORITY.streak
      })
    }
  } catch (error) { console.warn('通知数据读取失败。', error) }
  return list
    .filter(notice => {
      try { return !localStorage.getItem(notice.dismissKey) } catch (error) { return true }
    })
    .sort((left, right) => left.priority - right.priority)
}

async function refreshNotices() {
  const token = ++noticeToken
  try {
    const list = await buildNotices()
    if (token === noticeToken) { notices.value = list; syncDismissedToday() }
  } catch (error) {
    console.warn('通知刷新失败。', error)
    if (token === noticeToken) notices.value = []
  }
  refreshTabBadges()
}

// 手机端底部标签角标：计划看今天待办，错题看还没消灭的数量。
const tabBadges = ref({})
async function refreshTabBadges() {
  try {
    const [plans, mistakes] = await Promise.all([loadPlans(), loadMistakes()])
    tabBadges.value = {
      '/plans': duePlanCount(plans),
      '/mistakes': mistakes.filter(item => !item.fixedAt).length
    }
  } catch (error) {
    console.warn('标签角标统计失败。', error)
  }
}

// 跨页面专注胶囊：读取专注页写下的快照，每秒推算一次剩余时间。
const liveFocus = ref(null)
const liveLeft = ref(0)
const liveDismissed = ref(false)
// 长按拖动：位移存 localStorage，刷新、切页都停在原处。
const livePillEl = ref(null)
const liveDragX = ref(0)
const liveDragY = ref(0)
const liveDragging = ref(false)
const LIVE_PRESS_DELAY = 120
const LIVE_PRESS_SLOP = 12
const LIVE_DRAG_SLOP = 8
const LIVE_DRAG_GAP = 8
const LIVE_PILL_OFFSET_KEY = 'ai-teach-focus-pill-offset'
let liveTimer = 0
let livePressTimer = 0
let livePressStart = null
let livePressPoint = null
let liveDragStart = null
let liveDragMoved = false
let livePressTarget = null
let liveSuppressClick = false
let liveClampTimer = 0

// 手机上给标签栏留高度，胶囊不钻到导航底下。
function liveBottomGap() {
  return window.matchMedia('(max-width:800px)').matches ? 74 : LIVE_DRAG_GAP
}

function loadPillOffset() {
  try {
    const raw = JSON.parse(localStorage.getItem(LIVE_PILL_OFFSET_KEY) || 'null')
    liveDragX.value = Number(raw?.x) || 0
    liveDragY.value = Number(raw?.y) || 0
  } catch (error) {
    liveDragX.value = 0
    liveDragY.value = 0
  }
}
function savePillOffset() {
  try { localStorage.setItem(LIVE_PILL_OFFSET_KEY, JSON.stringify({ x: liveDragX.value, y: liveDragY.value })) }
  catch (error) { console.warn('专注胶囊位置写入失败。', error) }
}
// 换设备/转屏后把记住的位置收回可视区，别让胶囊停在屏幕外。
function clampLivePill() {
  const el = livePillEl.value
  if (!el || liveDragging.value) return
  const rect = el.getBoundingClientRect()
  let dx = 0
  let dy = 0
  if (rect.left < LIVE_DRAG_GAP) dx = LIVE_DRAG_GAP - rect.left
  else if (rect.right > window.innerWidth - LIVE_DRAG_GAP) dx = window.innerWidth - LIVE_DRAG_GAP - rect.right
  if (rect.top < LIVE_DRAG_GAP) dy = LIVE_DRAG_GAP - rect.top
  else if (rect.bottom > window.innerHeight - liveBottomGap()) dy = window.innerHeight - liveBottomGap() - rect.bottom
  if (!dx && !dy) return
  liveDragX.value += dx
  liveDragY.value += dy
  savePillOffset()
}

function liveDismissKey(stamp) {
  return `ai-teach-focus-pill-dismiss:${stamp || 'legacy'}`
}
// 关闭按「这一次专注」记：同一次会话切页、刷新都不再冒出来，新会话自动恢复。
function syncLiveDismissed() {
  if (!liveFocus.value) { liveDismissed.value = false; return }
  const stamp = Number(liveFocus.value.sessionStartedAt) || 0
  try { liveDismissed.value = Boolean(localStorage.getItem(liveDismissKey(stamp))) }
  catch (error) { liveDismissed.value = false }
}
function refreshLiveFocus() {
  liveFocus.value = readLiveFocus()
  liveLeft.value = liveFocus.value ? liveRemaining(liveFocus.value) : 0
  syncLiveDismissed()
}
// 只收起悬浮窗，不清快照：计时继续，回到专注页仍然接着走。
function dismissLivePill() {
  liveDismissed.value = true
  const stamp = Number(liveFocus.value?.sessionStartedAt) || 0
  try { localStorage.setItem(liveDismissKey(stamp), '1') } catch (error) { console.warn('专注胶囊关闭状态写入失败。', error) }
}

function clearLivePress() {
  if (!livePressTimer) return
  clearTimeout(livePressTimer)
  livePressTimer = 0
}
// 长按 200ms 就进入拖动；整条胶囊都能按，不用找边缘。
function onLivePillDown(event) {
  if (event.button > 0) return
  liveSuppressClick = false
  liveDragMoved = false
  livePressTarget = event.target instanceof Element ? event.target : null
  clearLivePress()
  livePressStart = { x: event.clientX, y: event.clientY, id: event.pointerId }
  livePressPoint = { x: event.clientX, y: event.clientY }
  livePressTimer = setTimeout(() => {
    livePressTimer = 0
    const el = livePillEl.value
    if (!el || !livePressPoint) return
    const rect = el.getBoundingClientRect()
    // 四周留 8px，避免拖出屏幕找不回来。
    liveDragStart = {
      x: livePressPoint.x,
      y: livePressPoint.y,
      offsetX: liveDragX.value,
      offsetY: liveDragY.value,
      minX: LIVE_DRAG_GAP - rect.left,
      maxX: window.innerWidth - LIVE_DRAG_GAP - rect.right,
      minY: LIVE_DRAG_GAP - rect.top,
      maxY: window.innerHeight - liveBottomGap() - rect.bottom
    }
    liveDragging.value = true
    // 锁住指针：长按后手指移出胶囊也能继续拖。没拖动时会在抬手补一次原按钮动作。
    try { el.setPointerCapture(livePressStart.id) } catch (error) { console.warn('拖动指针捕获失败。', error) }
  }, LIVE_PRESS_DELAY)
}

function clampDrag(value, min, max) {
  if (max < min) return 0
  return Math.min(Math.max(value, min), max)
}

function onLivePillMove(event) {
  if (!livePressStart) return
  livePressPoint = { x: event.clientX, y: event.clientY }
  // 长按还没生效就挪出容差，当成误触，放弃这一轮拖动。
  if (livePressTimer) {
    if (Math.hypot(event.clientX - livePressStart.x, event.clientY - livePressStart.y) > LIVE_PRESS_SLOP) clearLivePress()
    return
  }
  if (!liveDragging.value || !liveDragStart) return
  // 指针已抬起（比如在胶囊外松开）就不再跟着移动走。
  if (!event.buttons) return
  let rawX = event.clientX - liveDragStart.x
  let rawY = event.clientY - liveDragStart.y
  // 先留 8px 死区：轻点时胶囊不会抖一下；越过死区才算真的拖。
  if (!liveDragMoved) {
    if (Math.hypot(rawX, rawY) <= LIVE_DRAG_SLOP) return
    liveDragMoved = true
    liveDragStart.x = event.clientX
    liveDragStart.y = event.clientY
    rawX = 0
    rawY = 0
  }
  const dx = clampDrag(rawX, liveDragStart.minX, liveDragStart.maxX)
  const dy = clampDrag(rawY, liveDragStart.minY, liveDragStart.maxY)
  liveDragX.value = liveDragStart.offsetX + dx
  liveDragY.value = liveDragStart.offsetY + dy
}

// 还没真的拖起来就滑出胶囊：直接收摊，避免松手后残留拖动状态。
function onLivePillLeave() {
  if (liveDragging.value) return
  clearLivePress()
  livePressStart = null
  livePressPoint = null
  liveDragStart = null
}

function onLivePillUp(event) {
  clearLivePress()
  livePressStart = null
  livePressPoint = null
  if (!liveDragging.value) { livePressTarget = null; return }
  liveDragging.value = false
  liveDragStart = null
  try {
    if (livePillEl.value?.hasPointerCapture?.(event.pointerId)) livePillEl.value.releasePointerCapture(event.pointerId)
  } catch (error) { console.warn('拖动指针释放失败。', error) }
  const target = livePressTarget
  livePressTarget = null
  // 长按到点但没真的拖：指针捕获会把 click 改派到根节点，这里补回原按钮该做的事。
  if (!liveDragMoved) {
    liveSuppressClick = true
    if (target?.closest('.live-pill-close')) dismissLivePill()
    else if (target?.closest('.live-pill-toggle')) toggleLiveFocus()
    else router.push('/focus')
    return
  }
  liveDragMoved = false
  // 拖完浏览器会补一次 click，拦掉，避免误触跳转或暂停。
  liveSuppressClick = true
  savePillOffset()
}

function onLivePillClickCapture(event) {
  if (!liveSuppressClick) return
  liveSuppressClick = false
  event.stopPropagation()
  event.preventDefault()
}
// 胶囊上直接暂停/继续：只改快照，真正的计时在回到专注页后由倒计时组件接管。
function toggleLiveFocus() {
  if (!liveFocus.value || liveLeft.value <= 0) return
  const nextRunning = !liveFocus.value.running
  writeLiveFocus({ ...liveFocus.value, running: nextRunning, startedAt: Date.now(), baseRemaining: liveLeft.value })
  refreshLiveFocus()
  ElMessage.info(nextRunning ? '专注继续，保持节奏' : '已暂停，随时回来继续')
}

function openNotice(notice) {
  noticeOpen.value = false
  if (notice.to) router.push(notice.to)
}

// === 电脑端快捷键 ===
const shortcutOpen = ref(false)
// 快捷键面板按当前页面补一组上下文键位：1/2/3 在错题页是筛选，不是跳页。
const contextShortcuts = computed(() => {
  if (route.path === '/mistakes') return [
    { keys: '/', label: '搜索错题' },
    { keys: '1 / 2 / 3', label: '全部 / 待消灭 / 已消灭' },
    { keys: 'M', label: '标记已消灭' }
  ]
  if (route.path === '/plans') return [
    { keys: 'Enter', label: '开始专注' },
    { keys: 'E', label: '完成并归档' }
  ]
  return []
})
// 正在输入、下拉或弹窗里时不抢键盘，避免数字键变成跳页。
function shortcutBlocked(event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], .el-overlay, [role="dialog"], .el-select__wrapper'))
}
// 数字 1–7 直达主导航；专注页隐藏主导航，不参与跳页。
function onShortcutKey(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
  if (isFocus.value || shortcutBlocked(event)) return
  // Shift + / 随时唤出快捷键面板，和快捷键面板里的说明一致。
  if (event.key === '?' || (event.shiftKey && event.key === '/')) {
    event.preventDefault()
    shortcutOpen.value = !shortcutOpen.value
    return
  }
  const index = Number(event.key)
  if (!Number.isInteger(index) || index < 1 || index > nav.length) return
  event.preventDefault()
  router.push(nav[index - 1].path)
}

function dismissNotice(notice) {
  try { localStorage.setItem(notice.dismissKey, '1') } catch (error) { console.warn('通知关闭状态写入失败。', error) }
  notices.value = notices.value.filter(item => item.id !== notice.id)
  syncDismissedToday()
}

// 一次性静音所有当天事项，周报不受影响；明天会重新计算。
function dismissTodayNotices() {
  for (const notice of notices.value) {
    if (notice.scope !== 'day') continue
    try { localStorage.setItem(notice.dismissKey, '1') } catch (error) { console.warn('通知关闭状态写入失败。', error) }
  }
  notices.value = notices.value.filter(item => item.scope !== 'day')
  syncDismissedToday()
  ElMessage.success('今天的提醒已全部关闭')
}

// 误点「今天全部不再提示」后可以一键找回，只清当天三个固定键。
function restoreTodayNotices() {
  const owner = getDataOwner()
  for (const id of dailyNoticeIds) {
    try { localStorage.removeItem(dailyNoticeKey(owner, id)) } catch (error) { console.warn('通知静音状态清除失败。', error) }
  }
  syncDismissedToday()
  refreshNotices()
  ElMessage.success('今天的提醒已恢复')
}

let noticeTimer = null
let noticeStamp = ''
function noticeStampNow() { return `${weekKeyOf()}:${todayKey()}` }
function onVisibilityChange() { if (!document.hidden) refreshNotices() }

onMounted(() => {
  noticeStamp = noticeStampNow()
  refreshNotices()
  loadPillOffset()
  refreshLiveFocus()
  liveTimer = setInterval(refreshLiveFocus, 1000)
  window.addEventListener('ai-teach:focus-live-updated', refreshLiveFocus)
  window.addEventListener('ai-teach:weekly-report-updated', refreshNotices)
  window.addEventListener('storage', refreshNotices)
  window.addEventListener('keydown', onShortcutKey)
  window.addEventListener('resize', clampLivePill)
  document.addEventListener('visibilitychange', onVisibilityChange)
  // 跨周 / 跨天时即使页面一直开着，也在一分钟内刷新一次提醒。
  noticeTimer = setInterval(() => {
    const stamp = noticeStampNow()
    if (stamp === noticeStamp) return
    noticeStamp = stamp
    refreshNotices()
  }, 60000)
})
onBeforeUnmount(() => {
  window.removeEventListener('ai-teach:focus-live-updated', refreshLiveFocus)
  window.removeEventListener('ai-teach:weekly-report-updated', refreshNotices)
  window.removeEventListener('storage', refreshNotices)
  window.removeEventListener('keydown', onShortcutKey)
  window.removeEventListener('resize', clampLivePill)
  document.removeEventListener('visibilitychange', onVisibilityChange)
  clearInterval(noticeTimer)
  clearInterval(liveTimer)
  clearTimeout(liveClampTimer)
})
// 登录 / 退出后数据归属会变，通知状态跟着重算；路由切换也刷新一次。
watch(() => store.user, refreshNotices)
watch(() => route.path, refreshNotices)

// 第二期精简：主导航只保留 7 个日常入口；试卷识别进诊断页、学习看板进主页、设置进右上角账号区。
const nav = [
  { path: '/home', label: '主页', short: '主页', icon: ['M3.5 10.5 12 4l8.5 6.5', 'M5.5 9.5V20h13V9.5', 'M9.5 20v-5h5v5'] },
  { path: '/diagnosis', label: '学情分析', short: '分析', icon: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M15.5 8.5l-2 5-5 2 2-5 5-2z'] },
  { path: '/materials', label: '学习资料', short: '资料', icon: ['M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z', 'M13 4h5.5A1.5 1.5 0 0 1 20 5.5v13a1.5 1.5 0 0 1-1.5 1.5H13z', 'M9 8h2', 'M15 8h2'] },
  { path: '/mistakes', label: '错题库', short: '错题', icon: ['M6.5 3.5h11a1 1 0 0 1 1 1V21l-6.5-4.2L5.5 21V4.5a1 1 0 0 1 1-1z', 'M9 8h6'] },
  { path: '/plans', label: '学习计划', short: '计划', icon: ['M4 5.5A2.5 2.5 0 0 1 6.5 3H20v18H6.5A2.5 2.5 0 0 1 4 18.5z', 'M4 18.5A2.5 2.5 0 0 1 6.5 16H20', 'M8 7h8'] },
  { path: '/focus', label: '专注空间', short: '专注', icon: ['M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z', 'M12 7.5V12l3 2'] },
  { path: '/tutor', label: 'AI 答疑', short: '答疑', icon: ['M5 5.5h14a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H10l-4 3.5V16.5H5A1.5 1.5 0 0 1 3.5 15V7A1.5 1.5 0 0 1 5 5.5z', 'M8 9.5h8', 'M8 12.5h5'] }
]
// 手机端底部标签栏只放每天都会用的 6 个入口；学情诊断有主页大按钮承接；AI 能力页保留，从首页 hero 进入。
const mobileNav = nav.filter(item => item.path !== '/diagnosis')
const isFocus = computed(() => route.name === 'focus')
// 沉浸页：专注空间、背诵窗口、练习窗口都自己排标题，隐藏顶部大标题条和右下角浮标，把高度留给内容。
const isImmersive = computed(() => isFocus.value || route.name === 'recite' || route.name === 'practice')
// 学习会话：从做题 / 错题复习窗口离开时，把这段时间记入专注时长。
const STUDY_VIEWS = ['practice', 'mistakes']
async function flushStudySession() {
  const record = finishStudy()
  if (!record) return
  try { await saveFocusSession(record) } catch (error) { console.warn('专注记录写入失败。', error) }
}
watch(() => route.name, (to, from) => {
  if (STUDY_VIEWS.includes(from) && !STUDY_VIEWS.includes(to)) flushStudySession()
})
// 胶囊每次出现都把记住的位置收进可视区：换设备、转屏后不会停在屏幕外。
watch(() => !isFocus.value && Boolean(liveFocus.value) && !liveDismissed.value, visible => {
  if (!visible) return
  clearTimeout(liveClampTimer)
  // 等进场动画（200ms 上浮）结束再量；没记过位置就不用量，默认位置本来就在安全区内。
  liveClampTimer = setTimeout(() => {
    if (!liveDragX.value && !liveDragY.value) return
    clampLivePill()
  }, 350)
})
</script>
<template>
  <div class="app-shell" :class="{ 'focus-shell': isFocus }">
    <aside class="side-nav">
      <RouterLink to="/home" class="brand"><span class="brand-mark brand-grid" role="img" aria-label="Ai学习"><span class="mark-latin">A</span><span class="mark-latin">i</span><span class="mark-cjk">学</span><span class="mark-cjk">习</span></span><div><strong>Ai学习小伙伴</strong><small>专注每一步成长</small></div></RouterLink>
      <nav><button v-for="(item, index) in nav" :key="item.path" :title="`${item.label} · 快捷键 ${index + 1}`" :aria-label="item.label" :aria-current="route.path === item.path ? 'page' : undefined" :class="{active: route.path === item.path}" @click="router.push(item.path)"><svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="(d, i) in item.icon" :key="i" :d="d" /></svg><span class="nav-label">{{ item.label }}</span></button></nav>
      <div class="nav-actions" :class="{ 'is-authed': Boolean(store.user) }">
        <el-popover v-model:visible="shortcutOpen" placement="bottom-end" :width="252" trigger="click" :teleported="false" popper-class="shortcut-popover">
          <template #reference>
            <button class="notice-bell shortcut-btn" type="button" aria-label="键盘快捷键">
              <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6.5" width="18" height="11" rx="2.4"/><path d="M7 10h.01M10 10h.01M13 10h.01M16.5 10h.01M7 13.5h.01M13 13.5h4M16.5 13.5h.01M10 13.5h.01"/></svg>
            </button>
          </template>
          <div class="shortcut-panel">
            <strong>键盘快捷键</strong>
            <ul>
              <li><span class="keys"><kbd>1</kbd><i>–</i><kbd>7</kbd></span><span>切换主导航</span></li>
              <li><span class="keys"><kbd>Esc</kbd></span><span>退出全屏</span></li>
              <li><span class="keys"><kbd>Esc</kbd></span><span>退出全屏</span></li>
              <li><span class="keys"><kbd>Shift</kbd><i>+</i><kbd>/</kbd></span><span>打开这个面板</span></li>
              <li><span class="keys"><kbd>↑</kbd><kbd>↓</kbd></span><span>计划 / 错题 选择</span></li>
              <li><span class="keys"><kbd>Enter</kbd></span><span>开始专注 / 复习错题</span></li>
            </ul>
            <div v-if="contextShortcuts.length" class="shortcut-context">
              <strong>当前页面</strong>
              <ul>
                <li v-for="row in contextShortcuts" :key="row.label"><span class="keys"><kbd>{{ row.keys }}</kbd></span><span>{{ row.label }}</span></li>
              </ul>
            </div>
          </div>
        </el-popover>
        <el-popover v-model:visible="noticeOpen" placement="bottom-end" :width="320" trigger="click" :teleported="false" popper-class="notice-popover">
          <template #reference>
            <button class="notice-bell" type="button" :aria-label="notices.length ? `通知：${notices.length} 条待处理` : '通知'">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9" /><path d="M10.5 20a1.8 1.8 0 0 0 3 0" /></svg>
              <span v-if="dailyNoticeCount" class="notice-dot" :class="noticeBadgeTone">{{ dailyNoticeCount }}</span>
            </button>
          </template>
          <div class="notice-panel">
            <strong class="notice-heading">通知</strong>
            <p v-if="!notices.length" class="notice-empty">暂时没有新通知</p>
            <div v-for="notice in notices" :key="notice.id" class="notice-item">
              <strong>{{ notice.title }}</strong>
              <p>{{ notice.text }}</p>
              <div class="notice-actions"><el-button size="small" type="primary" plain @click="openNotice(notice)">{{ notice.action }}</el-button><el-button size="small" text @click="dismissNotice(notice)">{{ notice.dismissText }}</el-button></div>
            </div>
            <div v-if="dailyNoticeCount || hasDismissedToday" class="notice-footer"><el-button v-if="dailyNoticeCount" size="small" text class="notice-dismiss-all" @click="dismissTodayNotices">今天全部不再提示</el-button><el-button v-if="hasDismissedToday" size="small" text class="notice-restore" @click="restoreTodayNotices">恢复今天的提醒</el-button></div>
          </div>
        </el-popover>
        <el-tag v-if="!store.user" type="success" effect="plain">本地模式</el-tag><el-button v-if="store.user" plain round class="login-link" @click="router.push('/account')">{{ store.user.displayName || store.user.email }}</el-button><el-button v-else plain round class="login-link" @click="router.push('/auth')">登录 / 注册</el-button><button class="settings-gear" type="button" title="系统设置" aria-label="系统设置" @click="router.push('/settings')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></button>
      </div>
      <div class="nav-footer"><span class="status-dot"></span> 数据仅存本机<br><small>{{ store.user ? '隐私优先 · 账号已连接' : '隐私优先 · 无需登录' }}</small></div>
    </aside>
    <transition name="live-pill">
      <div
        v-if="!isImmersive && liveFocus && !liveDismissed"
        ref="livePillEl"
        class="live-focus-pill"
        :class="{ 'is-dragging': liveDragging }"
        :style="{ translate: `${liveDragX}px ${liveDragY}px` }"
        @pointerdown="onLivePillDown"
        @pointermove="onLivePillMove"
        @pointerup="onLivePillUp"
        @pointercancel="onLivePillUp"
        @pointerleave="onLivePillLeave"
        @contextmenu.prevent
        @click.capture="onLivePillClickCapture"
      >
        <button type="button" class="live-pill-main" @click="router.push('/focus')">
          <span class="live-pill-dot" :class="{ on: liveFocus.running && liveLeft > 0 }"></span>
          <span class="live-pill-text">{{ liveFocus.title }}</span>
          <strong>{{ liveLeft > 0 ? formatClock(liveLeft) : '已完成' }}</strong>
          <small>{{ liveLeft > 0 ? (liveFocus.running ? '专注中' : '已暂停') : '回去记录' }}</small>
        </button>
        <button v-if="liveLeft > 0" type="button" class="live-pill-toggle" :title="liveFocus.running ? '暂停专注' : '继续专注'" :aria-label="liveFocus.running ? '暂停专注' : '继续专注'" @click="toggleLiveFocus">{{ liveFocus.running ? '❚❚' : '▶' }}</button>
        <button type="button" class="live-pill-close" title="收起悬浮窗（计时继续）" aria-label="收起悬浮窗" @pointerdown.stop @click.stop="dismissLivePill">×</button>
      </div>
    </transition>
    <nav class="mobile-tabbar" aria-label="主导航">
      <button v-for="item in mobileNav" :key="item.path" type="button" :class="{ active: route.path === item.path }" :aria-current="route.path === item.path ? 'page' : undefined" @click="router.push(item.path)">
        <svg class="nav-icon" viewBox="0 0 24 24" aria-hidden="true"><path v-for="(d, index) in item.icon" :key="index" :d="d" /></svg>
        <span>{{ item.short }}</span>
        <em v-if="tabBadges[item.path]" class="tab-badge" aria-hidden="true">{{ tabBadges[item.path] > 99 ? '99+' : tabBadges[item.path] }}</em>
      </button>
    </nav>
    <main class="main-content">
      <header v-if="!isImmersive" class="topbar"><div><span class="eyebrow">AI 自适应学习工作台</span><h1>{{ props.title }}</h1></div><div class="top-actions"><el-popover v-model:visible="noticeOpen" placement="bottom-end" :width="320" trigger="click" :teleported="false" popper-class="notice-popover"><template #reference><button class="notice-bell" type="button" :aria-label="notices.length ? `通知：${notices.length} 条待处理` : '通知'"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 1 0-12 0c0 7-2 7-2 9h16c0-2-2-2-2-9" /><path d="M10.5 20a1.8 1.8 0 0 0 3 0" /></svg><span v-if="dailyNoticeCount" class="notice-dot" :class="noticeBadgeTone">{{ dailyNoticeCount }}</span></button></template><div class="notice-panel"><strong class="notice-heading">通知</strong><p v-if="!notices.length" class="notice-empty">暂时没有新通知</p><div v-for="notice in notices" :key="notice.id" class="notice-item"><strong>{{ notice.title }}</strong><p>{{ notice.text }}</p><div class="notice-actions"><el-button size="small" type="primary" plain @click="openNotice(notice)">{{ notice.action }}</el-button><el-button size="small" text @click="dismissNotice(notice)">{{ notice.dismissText }}</el-button></div></div><div v-if="dailyNoticeCount || hasDismissedToday" class="notice-footer"><el-button v-if="dailyNoticeCount" size="small" text class="notice-dismiss-all" @click="dismissTodayNotices">今天全部不再提示</el-button><el-button v-if="hasDismissedToday" size="small" text class="notice-restore" @click="restoreTodayNotices">恢复今天的提醒</el-button></div></div></el-popover><el-tag v-if="!store.user" class="mode-tag" type="success" effect="plain">本地模式</el-tag><el-button v-if="store.user" plain round class="login-link account-link" @click="router.push('/account')">{{ store.user.displayName || store.user.email }}</el-button><el-button v-else plain round class="login-link" @click="router.push('/auth')">登录 / 注册</el-button><button class="settings-gear" type="button" title="系统设置" aria-label="系统设置" @click="router.push('/settings')"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.2" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg></button></div></header>
      <slot />
    </main>
    <FeedbackWidget v-if="!isImmersive && !hideFloating" :raised="Boolean(liveFocus) && !liveDismissed" />
  </div>
</template>
<style scoped>
.app-shell { --nav-h:82px; min-height:100vh; display:flex; }.side-nav { width:246px; flex:none; padding:24px 16px; display:flex; flex-direction:column; background:var(--surface); border-right:1px solid var(--border); }.brand { display:flex; gap:11px; align-items:center; cursor:pointer; padding:8px 9px 25px; text-decoration:none; color:inherit; }.brand-mark { width:34px;height:34px;flex:none;border-radius:10px;background:var(--brand-gradient);color:#fff;font-size:calc(34px*var(--fs-scale)); }.brand strong { display:block;font-size:calc(15px*var(--fs-scale)); }.brand small { color:var(--muted);font-size:calc(11px*var(--fs-scale)); }.side-nav nav { display:grid; gap:6px; }.side-nav nav button { border:0;background:transparent;color:var(--muted);text-align:left;border-radius:12px;padding:12px 13px;cursor:pointer;display:flex;gap:10px;align-items:center;transition:background-color .2s,color .2s; }.side-nav nav button:hover,.side-nav nav button.active { background:var(--primary-soft); color:var(--primary); }.nav-footer { margin-top:auto;color:var(--muted);font-size:calc(12px*var(--fs-scale));line-height:1.8;padding:14px 10px; }.status-dot { display:inline-block;width:8px;height:8px;border-radius:50%;background:#74b48e;margin-right:5px; }.main-content { flex:1;min-width:0; }.topbar { height:var(--nav-h);padding:17px 30px;display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);background:color-mix(in srgb, var(--bg) 84%, transparent); }.topbar h1 { margin:3px 0 0;font-size:calc(20px*var(--fs-scale)); }.eyebrow { color:var(--primary);font-size:calc(12px*var(--fs-scale)); }.top-actions { display:flex;gap:12px;align-items:center; }.login-link{color:var(--primary);border-color:var(--border)}.nav-actions { display:none; }.mobile-tabbar { display:none; }.focus-shell .main-content { width:100%; }
/* 桌面端：侧边栏改为顶部横向导航；801px 以下沿用原侧边布局。 */
.nav-icon{width:20px;height:20px;flex:none;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
@media(min-width:801px){
/* 桌面端：白色胶囊导航浮在页面底色上，彩色线性图标 + 选中态浅色胶囊。 */
.app-shell{--nav-h:80px;flex-direction:column;height:100vh;overflow:hidden}.side-nav{width:auto;min-height:64px;margin:16px 24px 0;flex-direction:row;align-items:center;gap:16px;padding:10px 18px;border-right:0;border-bottom:0;border-radius:20px;background:var(--surface);box-shadow:var(--shadow);position:sticky;top:16px;z-index:20}.brand{flex:none;padding:0 16px 0 0;gap:10px;border-right:1px solid var(--border);border-radius:0}.brand small{font-size:calc(10px*var(--fs-scale))}.side-nav nav{display:flex;flex:1;min-width:0;gap:2px;align-items:center;justify-content:flex-start;overflow-x:auto}.side-nav nav button{position:relative;padding:10px 14px;font-size:calc(14.5px*var(--fs-scale));font-weight:600;gap:8px;white-space:nowrap;border-radius:11px}.side-nav nav button.active{background:var(--primary-soft);color:var(--primary)}.side-nav nav button.active:after{content:'';position:absolute;left:12px;right:12px;bottom:0;height:2px;border-radius:2px;background:var(--primary)}.nav-footer{display:none}.topbar{display:none}/* 桌面端把整页滚动收进内容区：导航固定，只有内容超出时内部才出现滚动条， */.main-content{width:100%;flex:1;min-height:0;overflow-y:auto;overscroll-behavior:contain}.main-content::-webkit-scrollbar{width:8px}.main-content::-webkit-scrollbar-track{background:transparent}.main-content::-webkit-scrollbar-thumb{border-radius:4px;background:color-mix(in srgb,var(--muted) 26%,transparent)}.main-content::-webkit-scrollbar-thumb:hover{background:color-mix(in srgb,var(--muted) 44%,transparent)}.nav-actions{display:flex;align-items:center;gap:10px;flex:none;padding-left:16px;border-left:1px solid var(--border)}.nav-actions .login-link{max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nav-actions .login-link :deep(span){display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}}
/* 801–1180px 导航空间有限：只留图标（aria-label 与悬停 title 可读），避免右侧操作区挤爆导航。 */
@media(min-width:801px) and (max-width:1180px){.brand div{display:none}.side-nav nav button{padding:9px 10px}.side-nav nav button .nav-label{display:none}}
/* 1121–1280px 导航空间有限：收紧左右留白与导航项间距；收起快捷键入口和「本地模式」标签，保证文字、长称呼与右侧操作区不溢出。 */
@media(min-width:1181px) and (max-width:1280px){.side-nav{margin:16px 20px 0;padding:10px 14px;gap:10px}.brand{padding:0 10px 0 0}.brand small{display:none}.side-nav nav{gap:0}.side-nav nav button{padding:9px 9px;gap:6px;font-size:calc(12.5px*var(--fs-scale))}.nav-actions .shortcut-btn,.nav-actions :deep(.el-tag){display:none}}
/* 1281–1500px：7 个文字导航 + 5 个操作仍放不下（1440 溢出 22px、1281 溢出 181px），压缩按钮并把次要入口收进快捷键面板。 */
@media(min-width:1281px) and (max-width:1500px){.side-nav{margin:16px 20px 0;padding:10px 14px;gap:10px}.brand{padding:0 10px 0 0}.side-nav nav button{padding:10px;gap:7px;font-size:calc(13.5px*var(--fs-scale))}.nav-actions{gap:8px;padding-left:12px}.nav-actions .shortcut-btn,.nav-actions :deep(.el-tag){display:none}}
/* 手机端：左侧 67px 图标栏换成底部标签栏，拇指可及；顶部栏只留标题和通知/账号操作。 */
@media(max-width:800px){.side-nav{display:none}.mobile-tabbar{position:fixed;left:0;right:0;bottom:0;z-index:30;display:flex;align-items:stretch;gap:2px;padding:6px calc(8px + env(safe-area-inset-right)) calc(6px + env(safe-area-inset-bottom)) calc(8px + env(safe-area-inset-left));background:color-mix(in srgb,var(--surface) 92%,transparent);border-top:1px solid var(--border);box-shadow:0 -8px 24px rgba(53,91,102,.08);backdrop-filter:blur(14px)}.mobile-tabbar button{flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px 2px;border:0;border-radius:12px;background:transparent;color:var(--muted);font-family:inherit;font-size:calc(11px*var(--fs-scale));font-weight:600;line-height:1.1;cursor:pointer;transition:background-color .16s,color .16s}.mobile-tabbar button:active{transform:scale(.96)}.mobile-tabbar button.active{color:var(--primary);background:var(--primary-soft)}.mobile-tabbar .nav-icon{width:21px;height:21px}.main-content{padding-bottom:calc(64px + env(safe-area-inset-bottom))}.topbar{padding:calc(14px + env(safe-area-inset-top)) calc(18px + env(safe-area-inset-right)) 14px calc(18px + env(safe-area-inset-left))}.topbar .eyebrow,.topbar .mode-tag,.topbar .account-link{display:none}.topbar h1{margin:0}}
/* 标签栏角标：计划看今日待办、错题看待消灭数量。 */
.mobile-tabbar button{position:relative}
.tab-badge{position:absolute;top:2px;right:calc(50% - 25px);min-width:16px;height:16px;padding:0 4px;border-radius:999px;background:#ef5b52;color:#fff;font-size:calc(10px*var(--fs-scale));font-style:normal;font-weight:700;line-height:16px;text-align:center;box-shadow:0 2px 6px rgba(239,91,82,.4)}
/* 跨页面专注胶囊：只在手机端出现，落在标签栏上方，点击回到专注页。 */
.live-focus-pill{display:none}
/* 长按可拖动：整条胶囊都是拖动区；关掉 iOS 长按菜单/选中，否则按到文字上会弹系统菜单、拖不动。 */
.live-focus-pill{cursor:grab;touch-action:none;-webkit-user-select:none;user-select:none;-webkit-touch-callout:none;-webkit-tap-highlight-color:transparent}
.live-focus-pill.is-dragging{cursor:grabbing;box-shadow:0 18px 40px rgba(53,91,102,.3)}
.live-pill-close{flex:none;width:26px;height:26px;padding:0;display:grid;place-items:center;border:0;border-radius:50%;background:transparent;color:var(--muted);font-family:inherit;font-size:calc(16px*var(--fs-scale));font-weight:600;line-height:1;cursor:pointer}
.live-pill-close:hover{background:var(--surface-soft);color:var(--text)}
.live-pill-enter-active,.live-pill-leave-active{transition:opacity .2s,transform .2s}
.live-pill-enter-from,.live-pill-leave-to{opacity:0;transform:translateY(8px)}
.live-pill-dot{flex:none;width:7px;height:7px;border-radius:50%;background:#f0a24f}
.live-pill-dot.on{background:#34a853;animation:livePillPulse 1.6s ease-in-out infinite}
.live-pill-text{overflow:hidden;white-space:nowrap;text-overflow:ellipsis;max-width:42%}
@keyframes livePillPulse{0%,100%{opacity:1}50%{opacity:.35}}
@media(max-width:800px){
  .live-focus-pill{position:fixed;left:calc(14px + env(safe-area-inset-left));right:calc(92px + env(safe-area-inset-right));bottom:calc(76px + env(safe-area-inset-bottom));z-index:29;display:flex;align-items:center;gap:4px;padding:4px;border:1px solid var(--border);border-radius:999px;background:var(--surface);box-shadow:0 10px 26px rgba(53,91,102,.16)}
  .live-pill-main{flex:1;display:flex;align-items:center;gap:8px;min-width:0;padding:5px 8px;border:0;border-radius:999px;background:transparent;font-family:inherit;font-size:calc(12px*var(--fs-scale));color:var(--text);text-align:left;cursor:pointer}
  .live-pill-main:hover{background:var(--surface-soft)}
  .live-pill-main strong{flex:none;color:var(--primary);font-size:calc(13px*var(--fs-scale));font-variant-numeric:tabular-nums}
  .live-pill-main small{flex:none;margin-left:auto;color:var(--muted);font-size:calc(11px*var(--fs-scale))}
  .live-pill-toggle{flex:none;width:30px;height:30px;padding:0;border:1px solid var(--border);border-radius:50%;background:var(--primary-soft);color:var(--primary);font-size:calc(10px*var(--fs-scale));line-height:1;cursor:pointer}
  .live-pill-toggle:hover{border-color:var(--primary)}
}
/* 电脑端：离开专注页后计时器停在底部正中，不挤顶部导航，也不压右下角的小精灵。 */
@media(min-width:801px){
  .live-focus-pill{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:29;display:flex;align-items:center;gap:2px;padding:5px;border:1px solid var(--border);border-radius:999px;background:var(--surface);box-shadow:0 16px 38px rgba(53,91,102,.18)}
  .live-pill-enter-from,.live-pill-leave-to{transform:translate(-50%,10px)}
  .live-pill-main{display:flex;align-items:center;gap:10px;padding:7px 12px 7px 10px;border:0;border-radius:999px;background:transparent;font-family:inherit;font-size:calc(12.5px*var(--fs-scale));color:var(--text);cursor:pointer}
  .live-pill-main:hover{background:var(--primary-soft)}
  .live-pill-main strong{color:var(--primary);font-size:calc(15px*var(--fs-scale));font-variant-numeric:tabular-nums}
  .live-pill-main small{color:var(--muted);font-size:calc(11.5px*var(--fs-scale))}
  .live-pill-text{max-width:170px}
  .live-pill-toggle{width:32px;height:32px;margin-right:3px;padding:0;border:1px solid var(--border);border-radius:50%;background:var(--primary-soft);color:var(--primary);font-size:calc(11px*var(--fs-scale));line-height:1;cursor:pointer}
  .live-pill-toggle:hover{border-color:var(--primary)}
  .live-pill-close{width:28px;height:28px;margin-right:2px}
}
/* 快捷键说明面板：只在桌面端导航右侧出现。 */
.shortcut-panel strong{display:block;margin-bottom:9px;font-size:calc(13px*var(--fs-scale))}
.shortcut-panel ul{margin:0;padding:0;list-style:none;display:grid;gap:7px}
.shortcut-panel li{display:flex;align-items:center;justify-content:space-between;gap:12px;font-size:calc(12.5px*var(--fs-scale));color:var(--muted)}
.shortcut-panel .keys{display:flex;align-items:center;gap:3px;flex:none}
.shortcut-panel .keys i{font-style:normal;color:var(--muted);font-size:calc(11px*var(--fs-scale))}
.shortcut-panel kbd{min-width:22px;padding:2px 6px;box-sizing:border-box;border:1px solid var(--border);border-bottom-width:2px;border-radius:8px;background:var(--surface-soft);color:var(--text);font-family:inherit;font-size:calc(11.5px*var(--fs-scale));font-weight:600;text-align:center}
/* 当前页面专属键位：和全局快捷键隔一条虚线，避免混读。 */
.shortcut-context{margin-top:10px;padding-top:9px;border-top:1px dashed var(--border)}
.shortcut-context>strong{display:block;margin-bottom:7px;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.shortcut-context ul{gap:6px}
.shortcut-context li{font-size:calc(12px*var(--fs-scale))}
/* 窄屏顶部栏收紧，给通知、设置、登录按钮留出空间。 */
@media(max-width:600px){.topbar h1{font-size:calc(17px*var(--fs-scale))}.top-actions{gap:6px}.top-actions :deep(.el-button){padding:8px 10px;font-size:calc(12px*var(--fs-scale))}}
/* 通知位：导航右侧铃铛 + 下拉面板，周一的学习周报提醒挂在 AppShell 上。 */
.notice-bell{position:relative;width:34px;height:34px;padding:0;display:grid;place-items:center;border:1px solid var(--border);border-radius:50%;background:var(--surface);color:var(--muted);cursor:pointer;flex:none}
.notice-bell:hover{color:var(--primary);border-color:var(--primary)}
.notice-bell svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
/* 系统设置入口：右侧最末位的齿轮图标，和铃铛同尺寸的圆形按钮。 */
.settings-gear{width:34px;height:34px;padding:0;display:grid;place-items:center;border:1px solid var(--border);border-radius:50%;background:var(--surface);color:var(--muted);cursor:pointer;flex:none}
.settings-gear:hover{color:var(--primary);border-color:var(--primary)}
.settings-gear svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.notice-dot{position:absolute;top:0;right:0;min-width:16px;height:16px;padding:0 4px;box-sizing:border-box;border-radius:999px;background:#e05a5a;color:#fff;font-size:calc(10px*var(--fs-scale));line-height:1;font-weight:600;display:grid;place-items:center;border:2px solid var(--surface)}
.notice-dot.is-plan{background:#e05a5a}
.notice-dot.is-stale{background:#f08c3a}
.notice-dot.is-streak{background:#d9a521}
.notice-dismiss-all{justify-self:start;padding-left:0;color:var(--muted)}
.notice-footer{display:flex;flex-wrap:wrap;align-items:center;gap:4px;border-top:1px solid var(--border);padding-top:8px}
.notice-footer :deep(.el-button){margin:0}
.notice-restore{color:var(--primary)}
.notice-panel{display:grid;gap:10px}
.notice-heading{font-size:calc(15px*var(--fs-scale));color:var(--text)}
.notice-empty{margin:0;font-size:calc(13px*var(--fs-scale));color:var(--muted)}
.notice-item{display:grid;gap:6px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-soft)}
.notice-item strong{font-size:calc(14px*var(--fs-scale))}
.notice-item p{margin:0;font-size:calc(13.5px*var(--fs-scale));line-height:1.65;color:var(--muted)}
.notice-actions{display:flex;align-items:center;gap:4px;margin-top:2px}
</style>
