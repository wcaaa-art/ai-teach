<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import { useRouter } from 'vue-router'
import CountdownTimer from '../components/CountdownTimer.vue'
import CameraMonitor from '../components/CameraMonitor.vue'
import AiFloatingTutor from '../components/AiFloatingTutor.vue'
import WheelPicker from '../components/WheelPicker.vue'
import FocusHistoryDialog from '../components/FocusHistoryDialog.vue'
import { getRecentFocusContext, loadFocusSessions, loadPlans, loadFocusSuggestion, makeId, saveDistraction, saveFeedback, saveFocusSession, saveVisualLog, savePlan, loadProfile, deleteFocusSession } from '../db/index.js'
import { iteratePlan, pushVisualStatus } from '../services/api.js'
import { formatMathText } from '../utils/formatMath.js'
import { clearLiveFocus, formatClock, liveRemaining, readLiveFocus, writeLiveFocus } from '../utils/liveFocus.js'
import { createInterventionTracker, interventionMessage, attentionSegmentType, INTERVENTION_LEVEL } from '../utils/attentionIntervene.js'
import { useAppStore } from '../stores/app.js'

const store = useAppStore()
const router = useRouter()
const timer = ref(null)
const camera = ref(null)
// 三态：待机 / 专注中 / 结束回顾。休息降级为回顾页底部的一条倒计时小条。
const view = ref('idle')
const selectedPlan = ref(null)
const running = ref(false)
// 自由专注：用户做计划外的事，不关联计划、不参与计划迭代。
const freeMode = ref(false)
const freeTaskName = ref('')
const planChoices = ref([])
const remaining = ref(0)
const feedbackVisible = ref(false)
const visualStatus = ref({ isPresent: true, continuousAwaySeconds: 0 })
// 走神实时干预：分心/低头/犯困持续到阈值才暂停计时。
// 写题低头是常态，所以阈值按状态分级，不在检测到的瞬间就打断。
const intervention = createInterventionTracker()
const interveneHint = ref('')
const startedAt = ref(0)
const distractionCount = ref(0)
// 已结束但还没写反馈的专注记录；反馈只挂靠这条记录，避免重复落库。
const pendingSession = ref(null)
// 本次结束后的回顾对象；旧记录没有采样字段时会走降级展示。
const lastSession = ref(null)
// 全部专注记录（倒序），待机「上次专注」与连续天数都从这里算。
const sessions = ref([])
// 页面切走或视觉检测离岗时，专注环变暗。
const pageHidden = ref(false)
const resting = ref(false)
const REST_SECONDS = 600
const restRemaining = ref(REST_SECONDS)
let restTimer = 0
let nowTimer = 0
let lastLiveWrite = 0
const feedback = reactive({ completion: 80, mastery: 2, note: '' })
const presetMinutes = [15, 25, 45]
const durationMode = ref(25)
const customMinutes = ref(25)
// iOS 滚轮的两列：小时 0~3、分钟 00~59；滚轮选中的 [时, 分] 折算成 customMinutes。
const WHEEL_HOURS = Array.from({ length: 5 }, (_, i) => String(i)) // 0~4 小时
const WHEEL_MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'))
const customVisible = ref(false)
const customTimePreview = ref([0, 25])
let prevCustomMinutes = 25
let prevDurationMode = 25
// 滚动滚轮实时预览：只改当前值用于圆环显示，不落盘；确定才写设置。
function onCustomPreview([hour, minute]) {
  customMinutes.value = Math.min(240, Math.max(1, hour * 60 + minute))
  durationMode.value = 'custom'
}
function confirmCustom() {
  customVisible.value = false
  applyDuration()
}
function closeCustom() {
  // 取消：恢复到点「自定义」之前的值。
  durationMode.value = prevDurationMode
  customMinutes.value = prevCustomMinutes
  customVisible.value = false
}
// 点浮层外任意处 = 取消。
function onDocClick(e) {
  if (!customVisible.value) return
  const wrap = document.querySelector('.custom-wrap')
  if (wrap && !wrap.contains(e.target)) closeCustom()
}
const focusSuggestion = ref(null)
// 注意力时间轴：只在计时运行时累计，暂停区间不计入。
const attentionLog = ref([])
let attentionType = 'focus'
let attentionSince = 0

const clampMinutes = value => { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.min(240, Math.max(5, Math.round(number))) : null }
const totalMinutes = computed(() => { const value = durationMode.value === 'custom' ? clampMinutes(customMinutes.value) ?? 25 : Number(durationMode.value); return Math.min(240, Math.max(5, value)) })
const duration = () => totalMinutes.value * 60
const planTitle = computed(() => formatMathText(freeMode.value ? (freeTaskName.value.trim() || '自由专注') : (selectedPlan.value?.name || '准备开始')))
const suggestionMinutes = computed(() => clampMinutes(focusSuggestion.value?.recommendedMinutes))
const suggestionPercent = computed(() => { const accuracy = Number(focusSuggestion.value?.accuracy); return Number.isFinite(accuracy) ? Math.round(accuracy * 100) : null })
const suggestionSource = computed(() => {
  const source = String(focusSuggestion.value?.source || '')
  if (source === 'weekly-quiz') return '周测'
  if (source === 'daily-quiz') return '日常测试'
  if (source === 'paper-quiz') return '综合整卷'
  if (source === 'scan-quiz') return '扫描试卷'
  return '章节测试'
})
const suggestionText = computed(() => {
  const suggested = suggestionMinutes.value
  if (!suggested) return ''
  return `最近一次${suggestionSource.value}${suggestionPercent.value !== null ? `正确率 ${suggestionPercent.value}%` : ''}，建议 ${suggested} 分钟，倒计时已按建议准备。`
})
const planDefaultMinutes = computed(() => freeMode.value ? 25 : clampMinutes(selectedPlan.value?.estimatedMinutes) || 25)
// 圆环：r=80，周长固定，进度按已过时间占比。
const RING_RADIUS = 80
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const ringRatio = computed(() => {
  const total = duration()
  const left = Number(remaining.value)
  if (!total) return 1
  return Math.max(0, Math.min(1, (Number.isFinite(left) && left > 0 ? left : 0) / total))
})
const ringOffset = computed(() => RING_CIRCUMFERENCE * (1 - ringRatio.value))
const ringAway = computed(() => pageHidden.value || visualStatus.value.isPresent === false)
const cameraOn = computed(() => Boolean(visualStatus.value.supervisionEnabled))
const cursorIdle = ref(false)
let cursorTimer = 0

// === 计划与任务 ===
const idleFocusTarget = computed(() => {
  // 选了学科（自由专注下把科目名写进任务名）时标题跟着带学科，与设计稿「只做数学这一件事」一致。
  const subject = selectedPlan.value?.subject || (freeMode.value ? freeTaskName.value.trim() : '')
  return subject ? `${subject}这一件事` : '这一件事'
})
const runningTarget = computed(() => freeMode.value || !selectedPlan.value?.subject ? '这件事' : selectedPlan.value.subject)
const runningSubject = computed(() => freeMode.value ? '自由专注' : (selectedPlan.value?.subject || '这一件事'))

async function selectPlan() {
  const persistedPlans = await loadPlans()
  const requestedId = new URLSearchParams(location.search).get('planId')
  const bySequence = (left, right) => (left.sequenceOrder || 999) - (right.sequenceOrder || 999)
  const activePlans = persistedPlans.filter(plan => plan.status === 'active' && !plan.isBridge).sort(bySequence)
  const requested = persistedPlans.find(plan => plan.id === requestedId)
  if (requested) {
    freeMode.value = false
    selectedPlan.value = requested
  } else if (store.settings.lastFocusMode === 'free') {
    enterFree()
  } else {
    selectedPlan.value = activePlans.find(plan => plan.id === store.settings.lastFocusPlanId)
      || activePlans[0]
      || [...persistedPlans].sort(bySequence)[0]
      || null
    freeMode.value = !selectedPlan.value
    if (freeMode.value) enterFree()
  }
  const picker = [...activePlans]
  if (selectedPlan.value && !picker.some(plan => plan.id === selectedPlan.value.id)) picker.unshift(selectedPlan.value)
  planChoices.value = picker
  initDuration(); remaining.value = duration()
}
function enterFree() {
  freeMode.value = true
  selectedPlan.value = null
  freeTaskName.value = store.settings.lastFreeTaskName || ''
}
function switchTask(value) {
  if (view.value !== 'idle') return
  if (value === 'free') {
    enterFree()
    store.updateSettings({ lastFocusMode: 'free' })
  } else {
    const plan = planChoices.value.find(item => item.id === value)
    if (!plan) return
    freeMode.value = false
    selectedPlan.value = plan
    store.updateSettings({ lastFocusMode: 'plan', lastFocusPlanId: plan.id })
  }
  initDuration()
  // 切到具体计划时，时长跟这一项的预计时长走；否则会沿用上一项手动选的值（比如上次设了 25
  // 分钟，切到 15 分钟的计划还显示 25），下拉框就白选了。
  if (!freeMode.value && selectedPlan.value) applyPlanDuration(selectedPlan.value)
  remaining.value = duration(); timer.value?.reset(duration())
}
// 下拉项带上科目前缀和预计时长：合并后的单一下拉里，科目+名称+时长一起看最快能区分。
// 有些任务的 name 本身就带科目前缀（如 demo 数据「数学 · 一元二次方程」），这里去重避免出现「数学 · 数学」。
function taskOptionLabel(plan) {
  const minutes = Number(plan?.estimatedMinutes) || 0
  const name = (plan?.name || '未命名任务').trim()
  const subject = (plan?.subject || '').trim()
  const head = subject && !name.startsWith(subject) ? `${subject} · ${name}` : name
  return minutes ? `${head} · ${minutes} 分钟` : head
}
function saveFreeTaskName() { store.updateSettings({ lastFreeTaskName: freeTaskName.value.trim() }) }

// 优先恢复用户上次选择；没选过则按建议时长启动，没有建议才回落到计划时长。
function initDuration() {
  const stored = clampMinutes(store.settings.focusMinutes)
  const minutes = stored || suggestionMinutes.value || planDefaultMinutes.value
  if (presetMinutes.includes(minutes)) durationMode.value = minutes
  else { durationMode.value = 'custom'; customMinutes.value = minutes }
}
function applyDuration() {
  if (running.value) return
  const next = duration()
  timer.value?.reset(next)
  remaining.value = next
  if (startedAt.value) { startedAt.value = 0; clearLiveFocus(); ElMessage.info('已按新时长重置本次计时') }
  store.updateSettings({ focusMinutes: totalMinutes.value })
}
// 把某一项计划的预计时长套到计时器上，不写入 focusMinutes：那是「上次手动选的档位」，
// 换任务时应该让计划说了算，但别把它当成用户的新偏好存下来。
function applyPlanDuration(plan) {
  const minutes = clampMinutes(plan?.estimatedMinutes)
  if (!minutes || running.value) return
  if (presetMinutes.includes(minutes)) durationMode.value = minutes
  else { durationMode.value = 'custom'; customMinutes.value = minutes }
}
function choosePreset(minute) { if (running.value) return; durationMode.value = minute; applyDuration() }
// 自定义：点一下在旁边弹出小滚轮浮层，再点收起（等同取消）。
function chooseCustom() {
  if (running.value) return
  if (customVisible.value) { closeCustom(); return }
  prevDurationMode = durationMode.value
  prevCustomMinutes = customMinutes.value
  const minutes = clampMinutes(customMinutes.value) || 25
  customTimePreview.value = [Math.min(4, Math.floor(minutes / 60)), minutes % 60]
  customVisible.value = true
}

// === 今日与连续统计 ===
function dayKey(value) { const date = new Date(Number(value) || Date.now()); return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}` }
function dayLabel(value) {
  const time = Number(value) || 0
  if (!time) return ''
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(time); target.setHours(0, 0, 0, 0)
  const diff = Math.round((today.getTime() - target.getTime()) / 86400000)
  if (diff <= 0) return '今天'
  if (diff === 1) return '昨天'
  if (diff === 2) return '前天'
  const date = new Date(time)
  return `${date.getMonth() + 1}/${date.getDate()}`
}
function timeLabel(value) {
  const date = new Date(Number(value) || Date.now())
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}
function shortDuration(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0))
  if (safe < 30) return '0 分'
  if (safe < 60) return '不足 1 分'
  return `${Math.round(safe / 60)} 分`
}
function focusStreak(list, includeToday) {
  const days = new Set(list.map(item => dayKey(item.createdAt || item.startedAt)).filter(Boolean))
  if (includeToday) days.add(dayKey(Date.now()))
  let count = 0
  const cursor = new Date(); cursor.setHours(0, 0, 0, 0)
  if (!days.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  while (days.has(dayKey(cursor.getTime()))) { count += 1; cursor.setDate(cursor.getDate() - 1) }
  return count
}
const todaySessions = computed(() => sessions.value.filter(item => dayKey(item.createdAt || item.startedAt) === dayKey(Date.now())))
const todaySessionCount = computed(() => todaySessions.value.length)
const todaySeconds = computed(() => todaySessions.value.reduce((sum, item) => sum + (Number(item.actualSeconds) || 0), 0))
const todayMinutesLive = computed(() => {
  const base = todaySeconds.value / 60
  const live = view.value === 'focus' ? elapsedSeconds() / 60 : 0
  return Math.round(base + live)
})
const streakDays = computed(() => focusStreak(sessions.value, view.value === 'focus' && Boolean(startedAt.value)))
async function loadSessions() {
  const list = await loadFocusSessions()
  sessions.value = [...list].sort((a, b) => (Number(b.createdAt || b.startedAt) || 0) - (Number(a.createdAt || a.startedAt) || 0))
}

// === 注意力采样 ===
function sessionType() {
  const status = visualStatus.value
  if (!status.supervisionEnabled) return 'unknown'
  if (status.isPresent === false) return 'away'
  return status.attentionState && status.attentionState !== 'focused' ? 'distracted' : 'focus'
}
function closeAttentionSegment() {
  if (!attentionSince) return
  const seconds = Math.max(0, (Date.now() - attentionSince) / 1000)
  attentionLog.value.push({ type: attentionType, seconds })
  attentionSince = 0
}
function markAttention(type) {
  if (!attentionSince) { attentionType = type; attentionSince = Date.now(); return }
  if (type === attentionType) return
  closeAttentionSegment()
  attentionType = type
  attentionSince = Date.now()
}
function normalizeTimeline(log, actualSeconds) {
  const list = log.filter(item => item.seconds > 0.5)
  const total = list.reduce((sum, item) => sum + item.seconds, 0)
  if (!total) return []
  const factor = actualSeconds > 0 ? actualSeconds / total : 1
  return list.map(item => ({ type: item.type, seconds: Math.max(1, Math.round(item.seconds * factor)) }))
}
const liveStats = computed(() => {
  elapsedSeconds()
  const totals = { focus: 0, distracted: 0, away: 0, unknown: 0 }
  const list = [...attentionLog.value]
  if (attentionSince) list.push({ type: attentionType, seconds: Math.max(0, (Date.now() - attentionSince) / 1000) })
  for (const item of list) if (totals[item.type] !== undefined) totals[item.type] += item.seconds
  return totals
})
const liveBars = computed(() => {
  const totals = liveStats.value
  const sum = totals.focus + totals.distracted + totals.away + totals.unknown
  if (!sum) return []
  return ['focus', 'distracted', 'away', 'unknown']
    .map(type => ({ type, width: (totals[type] / sum) * 100 }))
    .filter(item => item.width > 0)
})
const attentionPill = computed(() => {
  if (!cameraOn.value) return { label: '未开启', tone: 'off' }
  const status = visualStatus.value
  if (status.isPresent === false) return { label: '离岗', tone: 'away' }
  if (status.attentionState && status.attentionState !== 'focused') return { label: status.attentionLabel || '走神', tone: 'warn' }
  return { label: '在学习', tone: 'on' }
})
const liveNote = computed(() => {
  if (!cameraOn.value) return '学习画面未开启，这一轮只记录总时长；打开后能看到走神和离开。'
  const status = visualStatus.value
  if (status.isPresent === false) return '暂时没检测到你在座位前，计时已暂停，回来的时间不算专注。'
  if (status.attentionState && status.attentionState !== 'focused') return `检测到${status.attentionLabel || '注意力波动'}，抬头看一眼计时，把注意力拉回来。`
  const totals = liveStats.value
  if (totals.away >= 30) return `中间离开 ${shortDuration(totals.away)} 自动暂停了，那段时间不算你的专注时间。`
  if (totals.distracted >= 60) return `已经记录 ${shortDuration(totals.distracted)} 走神，回来后能继续累计。`
  return '在学状态正常，专注时间会实时累计。'
})
const remainingText = computed(() => {
  const value = Math.max(0, Number(remaining.value) || 0)
  const minutes = Math.floor(value / 60)
  const seconds = value % 60
  return minutes > 0 ? `${minutes} 分 ${seconds} 秒` : `${seconds} 秒`
})
const nowTick = ref(Date.now())

// === 专注回顾（历史记录列表：可查看、可删除） ===
const historyVisible = ref(false)
const historyRecords = computed(() => sessions.value.map(session => {
  const actual = Math.max(0, Number(session.actualSeconds) || 0)
  const sampled = Boolean(session.sampled)
  const focus = sampled ? Math.max(0, Number(session.focusSeconds) || 0) : actual
  const distracted = sampled ? Math.max(0, Number(session.distractedSeconds) || 0) : 0
  const away = sampled ? Math.max(0, Number(session.awaySeconds) || 0) : 0
  const time = Number(session.createdAt || session.startedAt) || 0
  return {
    id: session.id,
    taskName: session.taskName || '自由专注',
    subject: session.subject || '',
    completed: Boolean(session.completed),
    sampled,
    actual,
    focus,
    distracted,
    away,
    dateLabel: dayLabel(time),
    dateText: time ? `${new Date(time).getFullYear()}/${String(new Date(time).getMonth() + 1).padStart(2, '0')}/${String(new Date(time).getDate()).padStart(2, '0')} ${timeLabel(time)}` : ''
  }
}))
function openHistory() { historyVisible.value = true }
async function removeHistoryRecord(record) {
  if (!record?.id) return
  await deleteFocusSession(record.id)
  await loadSessions()
  ElMessage.success('这条专注记录已删除。')
}
const clockLabel = computed(() => timeLabel(nowTick.value))

// === 结束回顾 ===
const previousSession = computed(() => {
  const current = lastSession.value
  if (!current) return null
  const currentTime = Number(current.createdAt || current.startedAt) || 0
  return sessions.value.find(item => item.id !== current.id && (Number(item.createdAt || item.startedAt) || 0) <= currentTime) || null
})
const summaryMeta = computed(() => {
  const session = lastSession.value
  if (!session) return null
  const actual = Math.max(0, Number(session.actualSeconds) || 0)
  const sampled = Boolean(session.sampled)
  const focus = sampled ? Math.max(0, Number(session.focusSeconds) || 0) : actual
  const distracted = sampled ? Math.max(0, Number(session.distractedSeconds) || 0) : 0
  const away = sampled ? Math.max(0, Number(session.awaySeconds) || 0) : 0
  const previous = previousSession.value
  const diff = previous?.sampled ? Math.round((focus - (Number(previous.focusSeconds) || 0)) / 60) : null
  return { actual, minutes: Math.max(1, Math.round(actual / 60)), sampled, focus, distracted, away, diff }
})
const timelineView = computed(() => {
  const session = lastSession.value
  if (!session || !session.sampled || !Array.isArray(session.timeline) || !session.timeline.length) return null
  const list = session.timeline.filter(item => Number(item.seconds) > 0)
  const total = list.reduce((sum, item) => sum + Number(item.seconds), 0)
  if (!total) return null
  let cursor = 0
  const segments = list.map(item => {
    const seconds = Number(item.seconds)
    const start = cursor
    cursor += seconds
    return { type: item.type, seconds, start, left: (start / total) * 100, width: (seconds / total) * 100 }
  })
  const annotations = segments
    .filter(item => item.type === 'distracted' && item.seconds >= 30)
    .slice(0, 3)
    .map(item => {
      const left = item.left + item.width / 2
      return { key: `${item.type}-${item.start}`, left, edge: left < 15 ? 'start' : left > 85 ? 'end' : '', text: `第 ${Math.max(1, Math.round(item.start / 60))} 分 · 走神 ${shortDuration(item.seconds)}` }
    })
  const totalMinutes = Math.max(1, Math.round(total / 60))
  const step = totalMinutes > 40 ? 10 : 5
  const axis = []
  for (let minute = 0; minute < totalMinutes; minute += step) axis.push(minute)
  axis.push(totalMinutes)
  return { segments, annotations, axis }
})
// 没有画面数据时也要给出等距刻度，否则时间轴只剩首尾两个数字，看着像坏了。
function buildAxis(totalMinutes) {
  const total = Math.max(1, Math.round(totalMinutes))
  const step = total > 40 ? 10 : 5
  const list = []
  for (let minute = 0; minute < total; minute += step) list.push(minute)
  list.push(total)
  return list
}
const axisLabels = computed(() => timelineView.value?.axis || buildAxis(summaryMeta.value?.minutes || totalMinutes.value))
const summaryFocusText = computed(() => summaryMeta.value ? formatClock(summaryMeta.value.sampled ? summaryMeta.value.focus : summaryMeta.value.actual) : '00:00')
const summaryCaption = computed(() => {
  const meta = summaryMeta.value
  if (!meta) return ''
  return meta.sampled ? `在学 · 共 ${meta.minutes} 分钟` : `共 ${meta.minutes} 分钟`
})
const summaryDiffText = computed(() => {
  const diff = summaryMeta.value?.diff
  if (diff === null || diff === undefined) return ''
  if (diff > 0) return `比上一次多 ${diff} 分钟`
  if (diff < 0) return `比上一次少 ${-diff} 分钟`
  return '和上一次持平'
})
const summaryTitle = computed(() => {
  const meta = summaryMeta.value
  if (!meta) return '这一轮已经结束'
  if (!meta.sampled) return `这 ${meta.minutes} 分钟，已经记下来了`
  const focusMinutes = Math.round(meta.focus / 60)
  if (focusMinutes >= 1) return `这 ${meta.minutes} 分钟，你有 ${focusMinutes} 分钟在学`
  return `这 ${meta.minutes} 分钟，先记下来了`
})
const summarySubhead = computed(() => summaryMeta.value?.sampled
  ? '摄像头已自动关闭。下面是这一节课发生了什么。'
  : '这次没有开启学习画面，只记录了总时长。')
const summaryTips = computed(() => {
  const meta = summaryMeta.value
  if (!meta) return []
  const tips = []
  const timeline = timelineView.value
  if (!meta.sampled || !timeline) {
    tips.push('这次没有开启学习画面，下一次打开就能看到走神和离开的具体时段。')
    tips.push(`这一轮完整记下了 ${meta.minutes} 分钟，先把节奏稳住，再考虑加时长。`)
    tips.push('觉得哪里不顺，可以写反馈告诉 AI，下一轮计划会跟着调整。')
    return tips
  }
  const firstMark = timeline.segments.find(item => item.type === 'distracted' && item.seconds >= 30)
  if (firstMark) tips.push(`第 ${Math.max(1, Math.round(firstMark.start / 60))} 分钟左右开始走神，下次到那个点先抬头看一眼计时。`)
  else tips.push('这一轮没有检测到走神，节奏保持得很好。')
  if (meta.away >= 30) tips.push(`中途离开 ${shortDuration(meta.away)}，那段时间没有计入专注；下次开始前先把要用的东西拿齐。`)
  else tips.push('没有离开记录，起身休息留到计时结束再做。')
  if (meta.diff === null) tips.push('这是你的第一次记录，下一次有对比就能看出变化。')
  else if (meta.diff > 0) tips.push(`在学时间比上一次多了 ${meta.diff} 分钟，这个增量比多做题更难得。`)
  else if (meta.diff < 0) tips.push(`在学时间比上一次少了 ${-meta.diff} 分钟，下一次先把最容易分心的东西收起来。`)
  else tips.push('在学时间和上一次持平，下一次试着把走神压到 1 分钟以内。')
  return tips
})
const quote = computed(() => {
  const meta = summaryMeta.value
  if (!meta) return ''
  if (!meta.sampled) return '先把每一次坐下来记清楚，改变会从这张记录里长出来。'
  if (meta.focus / Math.max(1, meta.actual) >= 0.9) return '这一轮几乎没有分神，完整地把时间交给了一件事。'
  if (meta.away >= 60) return '中途离开不算失败，回来接着做完才算。'
  if (meta.diff !== null && meta.diff > 0) return '进步不是靠每天多学一小时，是靠这种几分钟攒出来的。'
  return '专注不是一直不分神，是每次分神都能更快回来。'
})

// === 待机右栏：上次专注 ===
const lastSessionCard = computed(() => {
  const session = sessions.value[0]
  if (!session) return null
  const actual = Math.max(0, Number(session.actualSeconds) || 0)
  const sampled = Boolean(session.sampled)
  const focus = sampled ? Math.max(0, Number(session.focusSeconds) || 0) : actual
  const distracted = sampled ? Math.max(0, Number(session.distractedSeconds) || 0) : 0
  const away = sampled ? Math.max(0, Number(session.awaySeconds) || 0) : 0
  const denominator = Math.max(1, focus + distracted + away)
  return {
    id: session.id,
    label: `${dayLabel(session.createdAt || session.startedAt)} ${timeLabel(session.createdAt || session.startedAt)}${session.subject ? ` · ${session.subject}` : ''}`,
    time: formatClock(focus),
    caption: sampled ? `${Math.max(1, Math.round(actual / 60))} 分钟在学` : `共 ${Math.max(1, Math.round(actual / 60))} 分钟`,
    sampled,
    bars: sampled ? [
      { type: 'focus', width: (focus / denominator) * 100 },
      { type: 'distracted', width: (distracted / denominator) * 100 },
      { type: 'away', width: (away / denominator) * 100 }
    ] : [],
    legend: [
      { label: '专注', text: shortDuration(focus) },
      { label: '走神', text: shortDuration(distracted) },
      { label: '离开', text: shortDuration(away) }
    ]
  }
})
// 有画面数据时用「在学时间」，没开画面才退回总时长。总时长常常都是同一个值，
// 三条 25:00 并排看不出趋势，和在学时间比才对得上「一次比一次长」这句话。
function sessionSeconds(item) {
  const value = item?.sampled ? item.focusSeconds : item?.actualSeconds
  return Math.max(0, Number(value) || 0)
}
const recentSessions = computed(() => {
  const list = sessions.value.slice(0, 3).reverse()
  const max = Math.max(1, ...list.map(sessionSeconds))
  return list.map((item, index) => ({
    id: item.id,
    label: dayLabel(item.createdAt || item.startedAt),
    value: formatClock(sessionSeconds(item)),
    width: Math.max(6, (sessionSeconds(item) / max) * 100),
    latest: index === list.length - 1
  }))
})
const trendText = computed(() => {
  const list = sessions.value.slice(0, 3).map(sessionSeconds).reverse()
  if (list.length < 2) return '先记录一次'
  const rising = list.every((value, index) => index === 0 || value >= list[index - 1])
  const strictlyRising = list.some((value, index) => index > 0 && value > list[index - 1])
  if (rising && strictlyRising) return '一次比一次长'
  const latest = list[list.length - 1]
  const previous = list[list.length - 2]
  if (latest > previous) return '比上次更长'
  if (latest < previous) return '比上次短一点'
  return '和上次持平'
})
const idleObservation = computed(() => {
  const session = sessions.value[0]
  if (!session) return '还没有记录，第一轮专注结束后这里会出现你的节奏。'
  if (session.sampled && Array.isArray(session.timeline)) {
    let cursor = 0
    const marks = []
    for (const segment of session.timeline) {
      if (segment.type === 'distracted' && Number(segment.seconds) >= 60) marks.push(Math.max(1, Math.round(cursor / 60)))
      cursor += Number(segment.seconds) || 0
    }
    if (marks.length >= 2) return `两次走神在第 ${marks[0]} 分钟和第 ${marks[1]} 分钟，这次留意一下第 ${marks[0]} 分钟。`
    if (marks.length === 1) return `上一次在第 ${marks[0]} 分钟走神，这次留意一下那个点。`
    return '上一次没有明显走神，这一轮可以试试同样的节奏。'
  }
  return '这次没有画面数据，下一次打开学习画面就能看到走神时段。'
})

const headline = computed(() => {
  if (view.value === 'summary') return summaryTitle.value
  if (view.value === 'focus') return `这 ${totalMinutes.value} 分钟，正在做${runningTarget.value}`
  return `${totalMinutes.value} 分钟，只做${idleFocusTarget.value}`
})
const subhead = computed(() => {
  if (view.value === 'summary') return summarySubhead.value
  if (view.value === 'focus') return `第 ${todaySessionCount.value + 1} 次专注 · ${cameraOn.value ? '离开座位会自动暂停，不用手动记' : '学习画面未开启，只记录总时长'}`
  if (todaySeconds.value >= 60) return `今天已经专注 ${Math.round(todaySeconds.value / 60)} 分钟，再补一轮就更稳了。`
  if (todaySeconds.value > 0) return '今天专注还不到 1 分钟，先补满一轮。'
  return '今天还没开始，先做一轮看看。'
})

// === 跨页面专注快照 ===
function liveSnapshot(overrides = {}) {
  return {
    totalSeconds: duration(),
    planId: freeMode.value ? null : (selectedPlan.value?.id || null),
    title: freeMode.value ? (freeTaskName.value.trim() || '自由专注') : (selectedPlan.value?.name || '专注'),
    subject: freeMode.value ? '自由专注' : (selectedPlan.value?.subject || ''),
    freeMode: freeMode.value,
    freeTaskName: freeTaskName.value,
    sessionStartedAt: startedAt.value || 0,
    ...overrides
  }
}
function persistLive(overrides = {}) { writeLiveFocus(liveSnapshot(overrides)) }
function onTick(value) {
  remaining.value = value
  if (Date.now() - lastLiveWrite < 15000) return
  lastLiveWrite = Date.now()
  persistLive({ running: running.value, startedAt: running.value ? Date.now() : 0, baseRemaining: value })
}
function elapsedSeconds() { return startedAt.value ? Math.max(0, duration() - (timer.value?.remaining ?? remaining.value)) : 0 }

function start() {
  if (view.value === 'summary') { view.value = 'idle'; lastSession.value = null }
  if (freeMode.value) store.updateSettings({ lastFocusMode: 'free', lastFreeTaskName: freeTaskName.value.trim() })
  else if (selectedPlan.value?.id) store.updateSettings({ lastFocusMode: 'plan', lastFocusPlanId: selectedPlan.value.id })
  const resuming = Boolean(startedAt.value)
  if (!resuming) { pendingSession.value = null; startedAt.value = Date.now(); attentionLog.value = [] }
  // 重新开始或继续时重置走神计数：刚才被打断不等于现在还在走神，给一次重新适应的机会。
  intervention.reset()
  interveneHint.value = ''
  attentionType = sessionType()
  attentionSince = Date.now()
  if (store.settings.cameraDefault && !cameraOn.value) camera.value?.requestEnable?.()
  remaining.value = timer.value?.remaining ?? duration()
  running.value = true
  view.value = 'focus'
  resting.value = false
  lastLiveWrite = Date.now()
  persistLive({ running: true, startedAt: Date.now(), baseRemaining: remaining.value })
  if (!resuming) ElMessage.success('专注开始，先完成眼前这一小步。')
}
function pause(message = '') {
  if (!startedAt.value) return
  if (running.value) closeAttentionSegment()
  running.value = false
  if (message) ElMessage.info(message)
  persistLive({ running: false, startedAt: 0, baseRemaining: timer.value?.remaining ?? remaining.value })
}
function buildSession(completed) {
  closeAttentionSegment()
  const actualSeconds = Math.round(elapsedSeconds())
  const timeline = normalizeTimeline(attentionLog.value, actualSeconds)
  const totalOf = type => timeline.filter(item => item.type === type).reduce((sum, item) => sum + item.seconds, 0)
  const focusSeconds = totalOf('focus')
  const distractedSeconds = totalOf('distracted')
  const awaySeconds = totalOf('away')
  const known = focusSeconds + distractedSeconds + awaySeconds
  return {
    id: makeId('focus'),
    planId: freeMode.value ? null : selectedPlan.value?.id,
    taskName: freeMode.value ? (freeTaskName.value.trim() || '自由专注') : selectedPlan.value?.name,
    subject: freeMode.value ? '自由专注' : selectedPlan.value?.subject,
    mode: freeMode.value ? 'free' : 'plan',
    startedAt: startedAt.value || Date.now(),
    endedAt: Date.now(),
    actualSeconds,
    completed: Boolean(completed),
    distractionCount: distractionCount.value,
    focusSeconds,
    distractedSeconds,
    awaySeconds,
    sampled: actualSeconds > 0 && known >= actualSeconds * 0.9,
    timeline,
    createdAt: Date.now()
  }
}
function resetClock() {
  running.value = false
  timer.value?.reset(duration())
  remaining.value = duration()
  startedAt.value = 0
  distractionCount.value = 0
  lastLiveWrite = 0
  attentionLog.value = []
  attentionType = 'focus'
  attentionSince = 0
  clearLiveFocus()
}
async function finishSession(completed) {
  if (!startedAt.value) { ElMessage.info('本次专注还没有开始。'); return }
  const session = buildSession(completed)
  await saveFocusSession(session)
  pendingSession.value = session
  lastSession.value = session
  resetClock()
  camera.value?.disable?.()
  resting.value = false
  clearInterval(restTimer); restTimer = 0
  view.value = 'summary'
  await loadSessions()
}
async function endFocus() {
  if (!startedAt.value) { ElMessage.info('本次专注还没有开始。'); return }
  await finishSession(elapsedSeconds() >= duration() * 0.8)
}
async function onTimerComplete() {
  if (!startedAt.value) { running.value = false; return }
  await finishSession(true)
}

// === 轻量休息 ===
function startRest() {
  if (resting.value) return
  resting.value = true
  restRemaining.value = REST_SECONDS
  clearInterval(restTimer)
  restTimer = window.setInterval(() => {
    restRemaining.value = Math.max(0, restRemaining.value - 1)
    if (restRemaining.value <= 0) finishRest()
  }, 1000)
}
function finishRest() {
  clearInterval(restTimer); restTimer = 0
  resting.value = false
  restRemaining.value = REST_SECONDS
  lastSession.value = null
  pendingSession.value = null
  resetClock()
  view.value = 'idle'
  ElMessage.success('休息结束，准备好就开始下一轮。')
}
function skipRest() { finishRest() }
function startAgain() {
  clearInterval(restTimer); restTimer = 0
  resting.value = false
  restRemaining.value = REST_SECONDS
  lastSession.value = null
  pendingSession.value = null
  resetClock()
  view.value = 'idle'
  nextTick(() => start())
}
// 回到专注空间首页（待机态），不直接开新一轮，让用户自己决定下一步。
function backToIdle() {
  clearInterval(restTimer); restTimer = 0
  resting.value = false
  restRemaining.value = REST_SECONDS
  lastSession.value = null
  pendingSession.value = null
  resetClock()
  view.value = 'idle'
}
function exitFocus() { router.push('/plans') }

function openFeedback() { feedbackVisible.value = true }
async function submitFeedback() {
  if (freeMode.value) { feedbackVisible.value = false; ElMessage.info('自由专注只记录时长，不参与学习计划迭代。'); return }
  const session = pendingSession.value || (startedAt.value ? buildSession(elapsedSeconds() >= duration() * 0.8) : null)
  if (session) { await saveFocusSession(session); pendingSession.value = session }
  await saveFeedback({ id: makeId('feedback'), sessionId: session?.id || null, planId: selectedPlan.value?.id, completion: feedback.completion, mastery: feedback.mastery, note: feedback.note, createdAt: Date.now() })
  const context = await getRecentFocusContext(7)
  const result = await iteratePlan({ profile: store.profile, plan: selectedPlan.value, feedback: { ...feedback }, context, visualStatus: visualStatus.value })
  if (result.data?.plans) { for (const plan of result.data.plans) await savePlan(plan) }
  else {
    const lowMastery = feedback.mastery <= 1
    await savePlan({
      ...selectedPlan.value,
      priority: lowMastery ? '高' : '中',
      reviewTime: Date.now() + (lowMastery ? 86400000 : 3 * 86400000),
      estimatedMinutes: lowMastery ? Math.min(selectedPlan.value.estimatedMinutes || 25, 20) : selectedPlan.value.estimatedMinutes,
      status: 'active'
    })
  }
  store.setPlans(await loadPlans())
  feedbackVisible.value = false
  pendingSession.value = null
  if (view.value !== 'summary') resetClock()
  if (result.success) ElNotification({ title: '反馈已吸收，学习计划已更新', message: `${result.data?.explanation || '已根据本次反馈调整任务优先级与复习间隔。'} 新的优先级、时长和复习时间可在「学习计划」查看。`, type: 'success', duration: 6000 })
  else ElMessage.success('反馈已保存，已按本地规则更新下一轮计划（可在「学习计划」查看）。')
}

// === 摄像头与页面状态 ===
function toggleCamera(value) { if (value) camera.value?.requestEnable?.(); else camera.value?.disable?.() }
async function toggleFullscreen() { try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() } catch { ElMessage.info('浏览器未允许全屏，请继续使用当前页面') } }
function wakeCursor() {
  cursorIdle.value = false
  clearTimeout(cursorTimer)
  if (!document.fullscreenElement || !running.value) return
  cursorTimer = setTimeout(() => { cursorIdle.value = true }, 3000)
}
watch(() => running.value, wakeCursor)
async function onVisibility() {
  pageHidden.value = document.visibilityState === 'hidden'
  if (document.visibilityState === 'hidden' && startedAt.value && !feedbackVisible.value) {
    const wasRunning = running.value
    pause('检测到页面切走，计时已暂停。')
    distractionCount.value += 1
    await saveDistraction({ id: makeId('dist'), type: 'tab-hidden', createdAt: Date.now(), wasRunning, planId: selectedPlan.value?.id })
  }
}
let lastVisualPush = 0
function onVisualStatus(status) {
  visualStatus.value = status
  if (status.supervisionEnabled === false || Date.now() - lastVisualPush >= 5000) {
    lastVisualPush = Date.now()
    pushVisualStatus({ is_present: Boolean(status.isPresent), continuous_away_seconds: Number(status.continuousAwaySeconds) || 0 }).catch(() => {})
  }
  updateIntervention(status)
}
// 走神实时干预：把视觉状态推进成「提示 → 倒计时 → 暂停」三段式。
// 只在计时中生效；待机或已暂停时不累积，重新开始专注会给学生一次重新适应的机会。
function updateIntervention(status) {
  if (!running.value || view.value !== 'focus') { interveneHint.value = ''; return }
  const info = intervention.update(status?.attentionState || '')
  if (info.level === INTERVENTION_LEVEL.WARN) {
    interveneHint.value = interventionMessage(info)
    return
  }
  if (info.level === INTERVENTION_LEVEL.INTERVENE) {
    interveneHint.value = ''
    triggerIntervention(info)
    return
  }
  interveneHint.value = ''
}
// 持续走神后的干预：暂停计时 + 说明原因 + 留痕（与离岗同一套记录口径）。
async function triggerIntervention(info) {
  // 注意力分段只认 focus/distracted/away/unknown 四种口径，具体是低头还是分心
  // 记在 visual log 里，不能写进分段统计，否则看板上的走神时长会被算乱。
  markAttention(attentionSegmentType(info.state))
  pause()
  distractionCount.value += 1
  await Promise.all([
    saveDistraction({ id: makeId('dist'), type: `visual-${info.state}`, createdAt: Date.now(), planId: selectedPlan.value?.id }),
    saveVisualLog({ id: makeId('visual'), status: info.state, source: 'vision', message: info.hint, createdAt: Date.now(), planId: selectedPlan.value?.id })
  ])
  if (store.settings.soundEnabled) playGentleSound()
  try { await ElMessageBox.alert(interventionMessage(info), '温和提醒', { confirmButtonText: '我回来了' }) } catch {}
}
function playGentleSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (!AudioContextClass) return
    const audioContext = new AudioContextClass()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.frequency.value = 560
    gain.gain.value = .04
    oscillator.connect(gain)
    gain.connect(audioContext.destination)
    oscillator.start()
    oscillator.stop(audioContext.currentTime + .25)
    oscillator.onended = () => audioContext.close()
  } catch {}
}
async function onVisualAlert(event) {
  markAttention('away')
  pause()
  distractionCount.value += 1
  await Promise.all([
    saveDistraction({ id: makeId('dist'), type: 'visual-away', createdAt: Date.now(), planId: selectedPlan.value?.id }),
    saveVisualLog({ id: makeId('visual'), status: 'away', source: 'vision', continuousAwaySeconds: event?.continuousAwaySeconds || 10, createdAt: Date.now(), planId: selectedPlan.value?.id })
  ])
  if (store.settings.soundEnabled && !event?.soundPlayed) playGentleSound()
  try { await ElMessageBox.alert('我们暂时没有检测到你在屏幕前，计时已经暂停。回来后点击继续即可。', '温和提醒', { confirmButtonText: '我回来了' }) } catch {}
}
function falsePositive(log) {
  saveVisualLog({ id: makeId('visual'), ...log, status: 'false-positive', planId: selectedPlan.value?.id })
  ElMessage.success('已记录误判反馈，感谢帮助我们改进')
}
// 分心、犯困、多人、低头只做温和提示并留痕，不暂停计时；只有离岗才走 onVisualAlert。
function onAttentionNotice(notice) {
  if (!notice?.type) return
  saveVisualLog({ id: makeId('visual'), status: notice.type, source: 'vision', message: notice.message, createdAt: Date.now(), planId: selectedPlan.value?.id })
  ElMessage.warning(notice.message || '注意一下视线和坐姿，继续专注吧')
}
function onModelError(message) { ElMessage.warning(message || '视觉模型暂时不可用，计时不受影响。') }

// 回到专注页时恢复上次的计时上下文；离开期间已经走完的，补记一条完成记录并进入回顾。
async function restoreLiveSnapshot() {
  const snapshot = readLiveFocus()
  if (!snapshot) return
  const left = liveRemaining(snapshot)
  if (!snapshot.running && !left) { clearLiveFocus(); return }
  if (snapshot.planId) {
    const plan = planChoices.value.find(item => item.id === snapshot.planId)
    if (plan) { freeMode.value = false; selectedPlan.value = plan }
  } else if (snapshot.freeMode) {
    freeMode.value = true
    freeTaskName.value = snapshot.freeTaskName || ''
  }
  const total = clampMinutes(Number(snapshot.totalSeconds) / 60) || 25
  if (presetMinutes.includes(total)) durationMode.value = total
  else { durationMode.value = 'custom'; customMinutes.value = total }
  if (left <= 0) {
    const session = {
      id: makeId('focus'),
      planId: snapshot.planId || null,
      taskName: snapshot.title || '专注',
      subject: snapshot.subject || '',
      mode: snapshot.freeMode ? 'free' : 'plan',
      startedAt: Number(snapshot.sessionStartedAt) || Number(snapshot.updatedAt) || Date.now(),
      endedAt: Date.now(),
      actualSeconds: total * 60,
      completed: true,
      distractionCount: 0,
      focusSeconds: 0,
      distractedSeconds: 0,
      awaySeconds: 0,
      sampled: false,
      timeline: [],
      createdAt: Date.now()
    }
    await saveFocusSession(session)
    pendingSession.value = session
    lastSession.value = session
    clearLiveFocus()
    camera.value?.disable?.()
    view.value = 'summary'
    await loadSessions()
    ElMessage.success('离开期间这轮专注已经完成，记录已保存。')
    return
  }
  remaining.value = left
  startedAt.value = Number(snapshot.sessionStartedAt) || Date.now() - (total * 60 - left) * 1000
  view.value = 'focus'
  await nextTick()
  timer.value?.reset(left)
  attentionLog.value = []
  attentionType = sessionType()
  attentionSince = Date.now()
  if (snapshot.running) { running.value = true; lastLiveWrite = Date.now() }
  ElMessage.info(`已恢复上次专注，剩余 ${formatClock(left)}${snapshot.running ? '，计时继续' : '，点击继续'}`)
}

// 开发期预览：?demo=summary 直接进回顾态，?demo=seed 只灌三条记录，?demo=clear 清掉。
// 只在 dev 生效，生产构建里这段会被常量折叠掉，不会带上演示数据。
async function applyDemoParam() {
  const mode = new URLSearchParams(location.search).get('demo')
  if (!mode) return
  const demo = await import('../utils/demoFocus.js')
  if (mode === 'clear') {
    await demo.clearDemoPlans()
    await demo.clearDemoFocus()
    await selectPlan()
    await loadSessions()
    return
  }
  await demo.seedDemoPlans()
  await demo.seedDemoFocus()
  await selectPlan()
  await loadSessions()
  if (mode === 'summary') {
    lastSession.value = demo.buildDemoFocusSession()
    view.value = 'summary'
  }
}
onMounted(async () => {
  if (!store.profile) store.setProfile(await loadProfile())
  focusSuggestion.value = await loadFocusSuggestion()
  await selectPlan()
  await loadSessions()
  await restoreLiveSnapshot()
  if (import.meta.env.DEV) await applyDemoParam()
  nowTimer = window.setInterval(() => { nowTick.value = Date.now() }, 20000)
  document.addEventListener('visibilitychange', onVisibility)
  window.addEventListener('mousemove', wakeCursor)
  window.addEventListener('mousedown', wakeCursor)
  document.addEventListener('fullscreenchange', wakeCursor)
  document.addEventListener('click', onDocClick)
})
onBeforeUnmount(() => {
  if (startedAt.value && !feedbackVisible.value) persistLive({ running: running.value, startedAt: running.value ? Date.now() : 0, baseRemaining: timer.value?.remaining ?? remaining.value })
  document.removeEventListener('visibilitychange', onVisibility)
  window.removeEventListener('mousemove', wakeCursor)
  window.removeEventListener('mousedown', wakeCursor)
  document.removeEventListener('fullscreenchange', wakeCursor)
  document.removeEventListener('click', onDocClick)
  clearTimeout(cursorTimer)
  clearInterval(restTimer)
  clearInterval(nowTimer)
  camera.value?.stopMonitoring?.()
  if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
})
</script>
<template>
  <div class="page focus-page" :class="{ 'is-cursor-idle': cursorIdle }">
    <div class="focus-inner">
      <div class="focus-head">
        <div class="focus-head-main">
          <h1 class="focus-title">{{ headline }}</h1>
          <p class="focus-sub">{{ subhead }}</p>
        </div>
        <div class="focus-actions">
          <button v-if="view === 'idle'" class="focus-bar-btn history-entry" type="button" @click="openHistory">
            <svg class="bar-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6" /><path d="M8 4.5V8l2.4 1.6" /></svg>专注回顾
            <span v-if="streakDays > 0" class="history-badge">连续 {{ streakDays }} 天</span>
          </button>
          <button v-if="view === 'summary'" class="focus-bar-btn back-to-idle" type="button" @click="backToIdle">
            <svg class="bar-icon" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 4 3 8l3.5 4M3 8h10" /></svg>返回专注空间
          </button>
        </div>
      </div>

      <!-- 待机 / 专注中 -->
      <div v-if="view !== 'summary'" class="focus-layout" :class="{ 'is-running': view === 'focus' }">
        <!-- 待机 -->
        <section v-if="view === 'idle'" class="focus-card idle-card">
          <span class="focus-caption">这次做什么</span>
          <!-- 科目胶囊 + 选任务两行合成一个下拉：选项带科目前缀和预计时长，另加「自由专注」。 -->
          <div class="task-pick">
            <el-select :model-value="freeMode ? 'free' : selectedPlan?.id" size="large" placeholder="选择专注任务" @change="switchTask">
              <el-option v-for="plan in planChoices" :key="plan.id" :label="taskOptionLabel(plan)" :value="plan.id" />
              <el-option label="自由专注" value="free" />
            </el-select>
          </div>
          <div v-if="freeMode" class="free-line">
            <el-input v-model="freeTaskName" size="small" maxlength="24" placeholder="打算做什么？例如：整理生物错题" @change="saveFreeTaskName" />
          </div>

          <div class="dial dial-idle">
            <svg class="dial-svg" viewBox="0 0 200 200" aria-hidden="true">
              <circle class="dial-track" cx="100" cy="100" r="80" />
            </svg>
            <div class="dial-face">
              <strong class="dial-time">{{ formatClock(totalMinutes * 60) }}</strong>
              <small>还没开始</small>
            </div>
          </div>

          <div class="duration-row">
            <button v-for="minute in presetMinutes" :key="minute" type="button" class="duration-chip" :class="{ active: durationMode === minute }" @click="choosePreset(minute)">{{ minute }} 分钟</button>
            <!-- 自定义：默认显示「自定义」，选定后直接显示当前自定义分钟数。 -->
            <div class="custom-wrap">
              <button type="button" class="duration-chip" :class="{ active: durationMode === 'custom' }" @click="chooseCustom">{{ durationMode === 'custom' ? totalMinutes + ' 分钟' : '自定义' }}</button>
              <transition name="custom-pop-fade">
                <div v-if="customVisible" class="custom-pop" @click.stop>
                  <WheelPicker v-model="customTimePreview" :columns="[WHEEL_HOURS, WHEEL_MINUTES]" :suffixes="['时', '分']" :item-height="26" :visible-count="3" :font-size="17" @update:model-value="onCustomPreview" />
                  <div class="custom-pop-actions">
                    <button type="button" class="custom-pop-cancel" @click="closeCustom">取消</button>
                    <button type="button" class="custom-pop-done" @click="confirmCustom">确定</button>
                  </div>
                </div>
              </transition>
            </div>
          </div>
          <p v-if="suggestionText" class="focus-hint">{{ suggestionText }}</p>

          <button class="focus-primary" type="button" @click="start">开始专注<span class="primary-arrow" aria-hidden="true">→</span></button>
          <p class="focus-footnote">{{ cameraOn ? '学习画面已开启，走神和离开会自动记录。' : '摄像头未开启，只会计时。' }}</p>
        </section>

        <!-- 专注中 -->
        <section v-else class="focus-card running-card">
          <span class="focus-caption">专注中 · {{ runningSubject }}</span>
          <!-- 走神实时干预的倒计时提示：给学生一点时间自己把注意力拉回来，而不是直接打断。 -->
          <p v-if="interveneHint" class="intervene-hint" role="status">{{ interveneHint }}</p>
          <div class="dial dial-running" :class="{ 'is-away': ringAway }">
            <svg class="dial-svg" viewBox="0 0 200 200" aria-hidden="true">
              <circle class="dial-track" cx="100" cy="100" r="80" />
              <circle class="dial-progress" cx="100" cy="100" r="80" :style="{ strokeDasharray: RING_CIRCUMFERENCE, strokeDashoffset: ringOffset }" />
            </svg>
            <div class="dial-face">
              <CountdownTimer ref="timer" plain :seconds="duration()" :running="running" @tick="onTick" @complete="onTimerComplete" />
              <small>{{ running ? `还剩 ${remainingText}` : '已暂停' }}</small>
            </div>
          </div>
          <div class="run-actions">
            <button class="focus-primary focus-primary-inline" type="button" @click="running ? pause('已暂停，准备好再继续。') : start()">{{ running ? '暂停' : '继续' }}</button>
            <button class="focus-text" type="button" @click="endFocus">提前结束</button>
          </div>
          <div class="run-stats">
            <div class="run-stat"><strong>{{ todaySessionCount + 1 }}</strong><span>今天第几次</span></div>
            <i class="run-divider"></i>
            <div class="run-stat"><strong>{{ todayMinutesLive }}</strong><span>今日专注</span></div>
            <i class="run-divider"></i>
            <div class="run-stat"><strong>{{ streakDays }}</strong><span>连续专注</span></div>
          </div>
        </section>

        <aside class="focus-side">
          <template v-if="view === 'idle'">
            <div class="focus-card camera-card">
              <div class="camera-switch">
                <svg class="camera-glyph" viewBox="0 0 24 18" aria-hidden="true"><rect x="1.5" y="3.5" width="14" height="11" rx="2.5" /><path d="M15.5 8l6-3.5v9L15.5 10" /></svg>
                <div class="camera-switch-text">
                  <strong>学习画面</strong>
                  <small>{{ cameraOn ? '已开启 · 走神和离开会自动记录' : '未开启 · 打开后能识别走神和离开' }}</small>
                </div>
                <el-switch :model-value="cameraOn" @change="toggleCamera" />
              </div>
            </div>
            <div class="focus-card last-card">
              <template v-if="lastSessionCard">
                <div class="last-head"><strong>上次专注</strong><span>{{ lastSessionCard.label }}</span></div>
                <div class="last-time"><strong>{{ lastSessionCard.time }}</strong><small>/ {{ lastSessionCard.caption }}</small></div>
                <div class="mini-bar">
                  <span v-for="(bar, index) in lastSessionCard.bars" :key="index" :class="'seg-' + bar.type" :style="{ width: bar.width + '%' }"></span>
                  <span v-if="!lastSessionCard.sampled" class="seg-unknown" style="width:100%"></span>
                </div>
                <div v-if="lastSessionCard.sampled" class="mini-legend">
                  <span v-for="item in lastSessionCard.legend" :key="item.label">{{ item.label }} {{ item.text }}</span>
                </div>
                <p v-else class="last-empty-inline">这次没有学习画面数据，只记录了总时长。</p>
                <div class="recent-block">
                  <div class="recent-head"><span>最近 3 次</span><span>{{ trendText }}</span></div>
                  <div v-for="item in recentSessions" :key="item.id" class="recent-row">
                    <span class="recent-label">{{ item.label }}</span>
                    <span class="recent-track"><i :class="{ latest: item.latest }" :style="{ width: item.width + '%' }"></i></span>
                    <span class="recent-value">{{ item.value }}</span>
                  </div>
                </div>
                <p class="last-note">{{ idleObservation }}</p>
              </template>
              <template v-else>
                <div class="last-head"><strong>上次专注</strong></div>
                <p class="last-empty">还没有记录，第一轮专注结束后这里会出现你的节奏。</p>
              </template>
              <p class="idle-footnote">画面只在专注期间开启，结束自动关闭，不录制也不上传。</p>
            </div>
          </template>

          <div v-show="view === 'focus'" class="focus-card live-card">
            <div class="live-head">
              <strong>学习画面</strong>
              <span class="live-flag" :class="{ on: cameraOn }"><i></i>{{ cameraOn ? '实时' : '未开启' }}</span>
            </div>
            <div class="video-frame">
              <CameraMonitor
                ref="camera"
                bare
                :low-performance="Boolean(store.settings.lowPerformance)"
                :sound-enabled="Boolean(store.settings.soundEnabled)"
                @status="onVisualStatus"
                @alert="onVisualAlert"
                @attention="onAttentionNotice"
                @false-positive="falsePositive"
                @model-error="onModelError"
              />
              <span v-if="cameraOn" class="video-pill" :class="'is-' + attentionPill.tone"><i></i>{{ attentionPill.label }}</span>
              <span class="video-stamp">{{ clockLabel }}</span>
            </div>
            <div class="live-title">这 {{ totalMinutes }} 分钟的状态</div>
            <div class="mini-bar">
              <span v-for="bar in liveBars" :key="bar.type" :class="'seg-' + bar.type" :style="{ width: bar.width + '%' }"></span>
            </div>
            <div class="mini-legend live-legend">
              <span><i class="dot dot-focus"></i>专注 {{ shortDuration(liveStats.focus) }}</span>
              <span><i class="dot dot-distracted"></i>走神 {{ shortDuration(liveStats.distracted) }}</span>
              <span><i class="dot dot-away"></i>离开 {{ shortDuration(liveStats.away) }}</span>
            </div>
            <p class="live-note">{{ liveNote }}</p>
            <!-- 脚注放进卡里，右卡才能和左卡底边对齐；待机页的 idle-footnote 也是这么放的。 -->
            <p class="live-footnote">
              <svg class="footnote-cam" viewBox="0 0 24 18" aria-hidden="true"><rect x="1.5" y="3.5" width="14" height="11" rx="2.5" /><path d="M15.5 8l6-3.5v9L15.5 10" /></svg>
              画面只在本次专注内用来识别状态，不录制、不保存、不上传。
            </p>
          </div>
        </aside>
      </div>

      <!-- 结束回顾 -->
      <div v-else class="summary-wrap">
        <section class="focus-card summary-main">
          <div class="summary-top">
            <div class="summary-big">
              <strong>{{ summaryFocusText }}</strong>
              <small>{{ summaryCaption }}</small>
            </div>
            <div class="summary-side-text">
              <p v-if="summaryMeta?.sampled">走神 {{ shortDuration(summaryMeta.distracted) }} · 离开 {{ shortDuration(summaryMeta.away) }}</p>
              <p v-if="summaryDiffText" class="summary-diff">{{ summaryDiffText }}</p>
            </div>
          </div>
          <div class="timeline" :class="{ 'is-flat': !timelineView?.annotations?.length }">
            <template v-if="timelineView">
              <span v-for="mark in timelineView.annotations" :key="mark.key" class="timeline-mark" :class="mark.edge ? 'is-' + mark.edge : ''" :style="{ left: mark.left + '%' }">{{ mark.text }}</span>
            </template>
            <div class="timeline-track">
              <template v-if="timelineView">
                <span v-for="segment in timelineView.segments" :key="segment.start" :class="'seg-' + segment.type" :style="{ width: segment.width + '%' }"></span>
              </template>
              <span v-else class="seg-unknown" style="width:100%"></span>
            </div>
            <div class="timeline-axis">
              <span v-for="(minute, index) in axisLabels" :key="minute">{{ minute }}<template v-if="index === axisLabels.length - 1"> 分钟</template></span>
            </div>
            <p v-if="!summaryMeta?.sampled" class="timeline-empty">没开学习画面，这条轴只有总时长；下次打开会标出走神出现在第几分钟。</p>
          </div>
        </section>

        <div class="summary-bottom">
          <section class="focus-card tips-card">
            <span class="focus-caption">下次可以这样</span>
            <div class="tips-list">
              <p v-for="(tip, index) in summaryTips" :key="index" class="tip-row"><em>{{ String(index + 1).padStart(2, '0') }}</em><span>{{ tip }}</span></p>
            </div>
          </section>
          <aside class="summary-side">
            <div class="quote-card">
              <div class="quote-label">给你的一句话</div>
              <p class="quote-text">{{ quote }}</p>
            </div>
            <div class="summary-links">
              <button type="button" @click="openFeedback">写反馈</button>
              <button type="button" @click="startAgain">再来一次</button>
            </div>
            <button class="focus-primary rest-cta" type="button" @click="startRest">休息 10 分钟</button>
          </aside>
        </div>
      </div>
    </div>

    <transition name="rest-pop">
      <div v-if="resting" class="rest-bar">
        <span class="rest-dot"></span>
        <span>休息</span>
        <strong>{{ formatClock(restRemaining) }}</strong>
        <button type="button" @click="skipRest">跳过</button>
      </div>
    </transition>

    <AiFloatingTutor :context="{ task: selectedPlan, visualStatus, remaining }" />
    <el-dialog v-model="feedbackVisible" title="给这次学习一个小反馈" width="470px" :close-on-click-modal="false" :show-close="false">
      <el-form label-position="top">
        <el-form-item label="任务完成度"><el-slider v-model="feedback.completion" :min="0" :max="100" show-input /></el-form-item>
        <el-form-item label="知识点掌握等级"><el-rate v-model="feedback.mastery" :max="3" clearable :texts="['刚接触', '有点会了', '基本掌握']" show-text /></el-form-item>
        <el-form-item label="给下一轮 Agent 的备注"><el-input v-model="feedback.note" type="textarea" :rows="3" placeholder="哪里顺利？哪里还想再练？" /></el-form-item>
      </el-form>
      <p class="feedback-hint">提交后会更新学习计划里的优先级、预计时长和复习时间，可在「学习计划」页查看。</p>
      <template #footer><el-button @click="feedbackVisible = false">取消</el-button><el-button type="primary" @click="submitFeedback">提交并更新计划</el-button></template>
    </el-dialog>

    <!-- 专注回顾：历史记录列表，可查看每次专注的回顾数据，也可删除 -->
    <FocusHistoryDialog v-model="historyVisible" :records="historyRecords" @delete="removeHistoryRecord" />
  </div>
</template>
<style scoped>
.focus-page{
  --paper:#ffffff;
  --line:#e5ede9;
  --divider:#eef4f1;
  --ink:#22322f;
  --ink-soft:#5f736e;
  --ink-faint:#8fa19b;
  --ink-ghost:#b7c4bf;
  --brand:#4d817a;
  --brand-soft:#e7f1ed;
  --brand-mid:#6d9a90;
  --brand-line:#b7cdc6;
  --wander:#c09a70;
  --away:#D9DED8;
  --unknown:#E6EAE3;
  --beige:#f4f0e7;
  --beige-ink:#6B5A45;
  --el-color-primary:#4d817a;
  --el-color-primary-light-3:#80a7a1;
  --el-color-primary-light-5:#a6c1bd;
  --el-color-primary-light-7:#cbdcd8;
  --el-color-primary-light-8:#dbe8e4;
  --el-color-primary-light-9:#edf3f1;
  --el-switch-on-color:#4d817a;
  /* 顶部导航恢复显示后，专注页不再独占整屏：扣掉 sticky 导航的 80px，避免多出一条滚动。 */
  min-height:calc(100vh - 80px);max-width:none;width:100%;margin:0;
  padding:0;
  background:var(--bg);
  color:var(--ink);
}
.focus-inner{max-width:1120px;margin:0 auto;padding:6px 22px 0}
.focus-label{font-size:calc(11.5px*var(--fs-scale));font-weight:600;letter-spacing:.14em;color:var(--ink-faint);margin-right:2px}
.focus-bar-btn{display:inline-flex;align-items:center;gap:5px;padding:5px 10px;border:1px solid var(--border);border-radius:8px;background:var(--paper);color:var(--ink-soft);font-family:inherit;font-size:calc(11.5px*var(--fs-scale));line-height:1.4;cursor:pointer;transition:color .2s,border-color .2s,background .2s}
.focus-bar-btn .bar-icon{width:13px;height:13px;flex:none;opacity:.7;transition:opacity .2s}
.focus-bar-btn:hover{color:var(--brand);border-color:var(--brand-line);background:var(--surface-soft)}
.focus-bar-btn:hover .bar-icon{opacity:1}
.focus-head{display:flex;align-items:flex-start;gap:18px;margin:8px 0 18px}
.focus-head-main{flex:1;min-width:0}
.focus-actions{flex:none;margin-left:auto;display:flex;align-items:center;gap:8px;padding-top:2px}
/* 「专注回顾」带一个连续天数徽章，让右上角入口有信息量而不是孤零零三个字。 */
.focus-bar-btn.history-entry .history-badge{display:inline-flex;align-items:center;margin-left:4px;padding:1px 8px;border-radius:999px;background:var(--brand-soft);color:var(--brand);font-size:calc(10.5px*var(--fs-scale));font-weight:600;line-height:1.5}
.focus-title{margin:0;font-size:calc(23px*var(--fs-scale));font-weight:500;line-height:1.35;letter-spacing:-.01em}
.focus-sub{margin:8px 0 0;font-size:calc(12px*var(--fs-scale));color:var(--ink-soft);line-height:1.6}
.focus-layout{display:flex;gap:14px;align-items:flex-start}
.focus-layout.is-running{align-items:stretch}
.focus-card{background:var(--paper);border:1px solid var(--line);border-radius:16px;padding:16px 18px 15px;min-width:0}
.idle-card{flex:1;display:flex;flex-direction:column}
.running-card{flex:1;display:flex;flex-direction:column}
.focus-side{width:320px;flex:none;display:flex;flex-direction:column;gap:12px;min-width:0}
.focus-caption{display:block;font-size:calc(11.5px*var(--fs-scale));color:var(--ink-faint);letter-spacing:.02em}
/* 走神干预倒计时：橙色警示条 + 轻微呼吸感，提醒但不惊吓。 */
.intervene-hint{margin:10px 0 0;padding:9px 12px;border:1px solid #F0C9A8;border-radius:10px;background:#FDF1E6;color:#8d5a2b;font-size:calc(12px*var(--fs-scale));line-height:1.6;text-align:center;animation:intervene-breathe 1.9s ease-in-out infinite}
@keyframes intervene-breathe{0%,100%{opacity:1}50%{opacity:.7}}
/* 合并后的任务下拉：整行铺满，代替原来的科目胶囊 + 选任务两行。 */
.task-pick{margin-top:12px;max-width:100%}
.task-pick :deep(.el-select){width:100%}
.free-line{margin-top:12px;max-width:100%}
.dial{position:relative;display:grid;place-items:center;align-self:center}
.dial-idle{width:164px;height:164px;margin-top:14px}
.dial-running{width:196px;height:196px;margin-top:auto;margin-bottom:12px}
.dial-svg{position:absolute;inset:0;width:100%;height:100%}
.dial-track{fill:none;stroke:var(--divider);stroke-width:5}
.dial-progress{fill:none;stroke:var(--brand);stroke-width:5;stroke-linecap:round;transform:rotate(-90deg);transform-origin:100px 100px;transition:stroke-dashoffset .4s linear}
.dial.is-away .dial-progress{opacity:.4}
.dial-face{position:relative;display:flex;flex-direction:column;align-items:center;gap:8px}
.dial-face small{font-size:calc(11.5px*var(--fs-scale));color:var(--ink-faint);line-height:1.4}
.dial-time{font-family:Georgia,'Times New Roman',serif;font-size:calc(34px*var(--fs-scale));font-weight:400;line-height:1;color:#A9B5AC;letter-spacing:-.01em}
.dial-running .dial-face :deep(.plain-clock){font-family:Georgia,'Times New Roman',serif;font-size:calc(38px*var(--fs-scale));font-weight:400;line-height:1;color:var(--ink);letter-spacing:-.02em}
.duration-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px;margin-top:12px}
.duration-chip{padding:9px 6px;border:1px solid transparent;border-radius:10px;background:#F4F6F2;color:var(--ink-soft);font-family:inherit;font-size:calc(12px*var(--fs-scale));line-height:1.4;white-space:nowrap;cursor:pointer;transition:background .2s,color .2s,border-color .2s}
.duration-chip.active{background:var(--paper);border-color:var(--brand);color:var(--ink);font-weight:600}
/* 自定义：胶囊旁的小滚轮浮层 */
.custom-wrap{position:relative;display:flex}
.custom-wrap .duration-chip{flex:1;width:100%}
.custom-pop{position:absolute;top:calc(100% + 8px);right:0;z-index:40;background:var(--paper);border:1px solid var(--line);border-radius:12px;box-shadow:0 12px 32px rgba(23,37,31,.16);padding:6px 10px 8px}
.custom-pop-actions{display:flex;justify-content:flex-end;gap:10px;margin-top:2px;padding-top:4px;border-top:1px solid var(--divider)}
.custom-pop-cancel,.custom-pop-done{border:0;background:none;font-family:inherit;font-size:calc(12px*var(--fs-scale));cursor:pointer;padding:2px 6px}
.custom-pop-cancel{color:var(--ink-soft)}
.custom-pop-done{color:var(--brand);font-weight:600}
.custom-pop-fade-enter-active,.custom-pop-fade-leave-active{transition:opacity .16s,transform .16s}
.custom-pop-fade-enter-from,.custom-pop-fade-leave-to{opacity:0;transform:translateY(-4px)}
.focus-hint{margin:10px 0 0;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);line-height:1.6;text-align:center}
.focus-primary{display:block;width:100%;margin-top:14px;padding:11px 18px;border:0;border-radius:999px;background:var(--brand);color:#F7FAF7;font-family:inherit;font-size:calc(13px*var(--fs-scale));font-weight:500;line-height:1.4;cursor:pointer;transition:background .2s}
.focus-primary:hover{background:#25493C}
.primary-arrow{display:inline-block;margin-left:9px;transition:transform .2s}
.focus-primary:hover .primary-arrow{transform:translateX(3px)}
.focus-primary-inline{width:auto;margin-top:0;padding:10px 28px;font-size:calc(12.5px*var(--fs-scale))}
.focus-text{border:0;background:none;color:var(--ink-faint);font-family:inherit;font-size:calc(11.5px*var(--fs-scale));line-height:1.4;padding:6px;cursor:pointer}
.focus-text:hover{color:var(--ink-soft)}
.focus-footnote{margin:10px 0 0;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);text-align:center;line-height:1.5}
.live-footnote{display:flex;align-items:center;justify-content:center;gap:7px;margin:16px 0 0;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);line-height:1.5;text-align:center}
.footnote-cam{width:15px;height:12px;flex:none;fill:none;stroke:currentColor;stroke-width:1.6;stroke-linejoin:round}
.idle-footnote{margin:auto 0 0;padding-top:16px;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);line-height:1.5}
/* 主按钮 + 提前结束上下堆叠、整体居中，和上方圆环对齐在同一中轴线上。 */
.run-actions{display:flex;flex-direction:column;align-items:center;gap:5px}
.run-actions .focus-text{position:static;transform:none;padding:2px 6px}
.run-stats{display:flex;align-items:center;justify-content:space-between;width:100%;margin-top:auto;padding-top:14px;border-top:1px solid var(--divider)}
.run-stat{flex:1;text-align:center}
.run-stat strong{display:block;font-family:Georgia,'Times New Roman',serif;font-size:calc(15px*var(--fs-scale));font-weight:400;line-height:1.2;color:var(--ink)}
.run-stat span{display:block;margin-top:3px;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost)}
.run-divider{width:1px;height:22px;background:var(--divider)}
.camera-card{flex:none}
/* 摄像头开关单独成卡，和设计图一致；上次专注卡吃掉剩余高度，脚注仍然贴底。 */
.focus-side .camera-card{padding:18px 22px}
.last-card{display:flex;flex:1;flex-direction:column}
.camera-switch{display:flex;align-items:center;gap:10px}
.side-divider{height:1px;margin:14px 0;background:var(--divider)}
.camera-glyph{width:19px;height:15px;flex:none;fill:none;stroke:#A9B8AC;stroke-width:1.7;stroke-linejoin:round}
.camera-switch-text{flex:1;min-width:0}
.camera-switch-text strong{display:block;font-size:calc(12.5px*var(--fs-scale));font-weight:500}
.camera-switch-text small{display:block;margin-top:3px;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);line-height:1.5}
.last-head{display:flex;align-items:baseline;justify-content:space-between;gap:8px}
.last-head strong{font-size:calc(12px*var(--fs-scale));font-weight:500}
.last-head span{font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);text-align:right}
.last-time{display:flex;align-items:flex-end;gap:6px;margin-top:12px}
.last-time strong{font-family:Georgia,'Times New Roman',serif;font-size:calc(28px*var(--fs-scale));font-weight:400;line-height:1;letter-spacing:-.02em}
.last-time small{padding-bottom:4px;font-size:calc(11px*var(--fs-scale));color:var(--ink-faint)}
.mini-bar{display:flex;height:7px;margin-top:12px;border-radius:4px;overflow:hidden;background:var(--divider)}
.mini-bar span{display:block;height:100%}
.mini-legend{display:flex;justify-content:space-between;gap:6px;margin-top:8px;font-size:calc(11px*var(--fs-scale));color:var(--ink-faint)}
.last-empty{margin:12px 0 0;font-size:calc(11.5px*var(--fs-scale));color:var(--ink-ghost);line-height:1.7}
.last-empty-inline{margin:8px 0 0;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);line-height:1.5}
.recent-block{margin-top:14px;padding-top:12px;border-top:1px solid var(--divider)}
.recent-head{display:flex;justify-content:space-between;font-size:calc(10.5px*var(--fs-scale));color:var(--ink-ghost)}
.recent-head span:last-child{color:var(--brand-mid)}
.recent-row{display:flex;align-items:center;gap:8px;margin-top:8px}
.recent-label{width:34px;flex:none;font-size:calc(10.5px*var(--fs-scale));color:var(--ink-ghost)}
.recent-track{flex:1;height:5px;border-radius:3px;background:var(--divider);overflow:hidden}
.recent-track i{display:block;height:100%;border-radius:3px;background:#D9E6DD}
.recent-track i.latest{background:var(--brand-mid)}
.recent-value{width:36px;flex:none;text-align:right;font-family:Georgia,'Times New Roman',serif;font-size:calc(10.5px*var(--fs-scale));color:var(--ink-faint)}
.last-note{margin:14px 0 0;padding-top:11px;border-top:1px solid var(--divider);font-size:calc(11px*var(--fs-scale));color:var(--brand-mid);line-height:1.7}
.live-card{display:flex;flex-direction:column}
.live-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.live-head strong{font-size:calc(12px*var(--fs-scale));font-weight:500}
.live-flag{display:inline-flex;align-items:center;gap:5px;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost)}
.live-flag i{width:5px;height:5px;border-radius:50%;background:var(--ink-ghost)}
.live-flag.on{color:var(--brand-mid)}
.live-flag.on i{background:#4E9C6E;box-shadow:0 0 0 3px rgba(78,156,110,.14)}
.video-frame{position:relative;margin-top:10px;border-radius:10px;overflow:hidden;background:#2B352F;line-height:0}
.video-frame :deep(.camera-monitor){background:transparent;border:0;padding:0;box-shadow:none}
.video-pill{position:absolute;left:9px;top:9px;display:inline-flex;align-items:center;gap:5px;padding:4px 9px;border-radius:999px;background:#F2F8F3;color:var(--brand);font-size:calc(11px*var(--fs-scale));font-weight:500;line-height:1.2}
.video-pill i{width:5px;height:5px;border-radius:50%;background:var(--brand)}
.video-pill.is-warn{background:#FBF6EE;color:#B5763F}
.video-pill.is-warn i{background:#C99A63}
.video-pill.is-away{background:#FBEFE7;color:#B5763F}
.video-pill.is-away i{background:#C99A63}
.video-pill.is-off{background:#F1F4EF;color:var(--ink-faint)}
.video-pill.is-off i{background:var(--ink-ghost)}
.video-stamp{position:absolute;right:10px;bottom:8px;font-family:Georgia,'Times New Roman',serif;font-size:calc(11px*var(--fs-scale));color:#F2F8F3;opacity:.66;line-height:1}
.live-note{margin:auto 0 0;padding-top:12px;border-top:1px solid var(--divider);font-size:calc(11.5px*var(--fs-scale));color:var(--brand-mid);line-height:1.7}
.live-title{margin-top:14px;font-size:calc(11.5px*var(--fs-scale));color:var(--ink-faint);line-height:1.5}
.live-legend{justify-content:space-between;gap:8px;flex-wrap:wrap}
.live-legend span{display:inline-flex;align-items:center}
.dot{display:inline-block;width:7px;height:7px;margin-right:6px;border-radius:50%}
.dot-focus{background:var(--brand)}
.dot-distracted{background:var(--wander)}
.dot-away{background:#C6D0C8}
.seg-focus{background:var(--brand)}
.seg-distracted{background:var(--wander)}
.seg-away{background:var(--away)}
.seg-unknown{background:var(--unknown)}
.summary-main{padding:16px 18px 15px}
.summary-top{display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap}
.summary-big{display:flex;align-items:flex-end;gap:9px}
.summary-big strong{font-family:Georgia,'Times New Roman',serif;font-size:calc(32px*var(--fs-scale));font-weight:400;line-height:1;letter-spacing:-.02em}
.summary-big small{padding-bottom:5px;font-size:calc(11px*var(--fs-scale));color:var(--ink-faint)}
.summary-side-text{text-align:right;font-size:calc(11.5px*var(--fs-scale));color:var(--ink-soft);line-height:1.9}
.summary-side-text p{margin:0}
.summary-diff{color:var(--brand-mid)}
.timeline{position:relative;margin-top:58px}
.timeline.is-flat{margin-top:24px}
.timeline-track{display:flex;height:10px;border-radius:5px;overflow:hidden;background:var(--divider)}
.timeline-track span{display:block;height:100%}
.timeline-mark{position:absolute;bottom:100%;margin-bottom:7px;transform:translateX(-50%);padding:2px 7px;border-radius:4px;background:var(--beige);color:#B5763F;font-size:calc(10.5px*var(--fs-scale));line-height:1.5;white-space:nowrap}
.timeline-mark:nth-of-type(even){bottom:calc(100% + 25px)}
.timeline-mark.is-start{transform:none}
.timeline-mark.is-end{transform:translateX(-100%)}
.timeline-axis{display:flex;justify-content:space-between;margin-top:9px;font-size:calc(10.5px*var(--fs-scale));color:var(--ink-ghost)}
.timeline-empty{margin:10px 0 0;font-size:calc(11px*var(--fs-scale));color:var(--ink-ghost);line-height:1.6}
.summary-bottom{display:flex;align-items:stretch;gap:14px;margin-top:12px}
.tips-card{flex:1;min-width:0}
.tips-list{margin-top:12px}
.tip-row{display:flex;gap:10px;margin:0 0 9px;font-size:calc(11.5px*var(--fs-scale));color:var(--ink-soft);line-height:1.75}
.tip-row:last-child{margin-bottom:0}
.tip-row em{flex:none;color:var(--brand-line);font-style:normal;font-family:Georgia,'Times New Roman',serif}
.summary-side{width:320px;flex:none;display:flex;flex-direction:column;gap:9px}
.quote-card{padding:14px 15px;border-radius:16px;background:var(--beige);flex:1}
.quote-label{margin-bottom:7px;font-size:calc(11px*var(--fs-scale));color:#B09A7E}
.quote-text{margin:0;font-size:calc(11.5px*var(--fs-scale));color:var(--beige-ink);line-height:1.85}
/* 右栏用 flex 撑满整个 bottom 高度，休息按钮是最后一个元素，底边正好压在左卡底线上。 */
.summary-side .rest-cta{margin-top:auto}
.summary-links{display:flex;justify-content:center;gap:16px;margin:1px 0}
.summary-links button{border:0;background:none;padding:3px 0;color:var(--ink-faint);font-family:inherit;font-size:calc(11.5px*var(--fs-scale));cursor:pointer}
.summary-links button:hover{color:var(--brand)}
.rest-bar{position:fixed;left:50%;bottom:22px;transform:translateX(-50%);z-index:30;display:flex;align-items:center;gap:10px;padding:9px 14px;border:1px solid var(--line);border-radius:999px;background:var(--paper);box-shadow:0 16px 36px rgba(23,37,31,.14);font-size:calc(12px*var(--fs-scale));color:var(--ink-soft);white-space:nowrap}
.rest-dot{width:7px;height:7px;border-radius:50%;background:var(--wander)}
.rest-bar strong{font-family:Georgia,'Times New Roman',serif;font-size:calc(14px*var(--fs-scale));font-weight:400;color:var(--brand)}
.rest-bar button{border:0;background:none;padding:0 2px;color:var(--brand-mid);font-family:inherit;font-size:calc(11.5px*var(--fs-scale));cursor:pointer}
.rest-pop-enter-active,.rest-pop-leave-active{transition:opacity .2s,transform .2s}
.rest-pop-enter-from,.rest-pop-leave-to{opacity:0;transform:translate(-50%,8px)}
.feedback-hint{margin:0;font-size:calc(11.5px*var(--fs-scale));color:var(--ink-faint);line-height:1.6}
.is-cursor-idle{cursor:none}
/* 桌面端：两栏铺满，1440×900 下内容高度约 800px */
@media (min-width:1021px){
  .focus-inner{max-width:1440px;padding:2px 32px 0}
  .focus-label{font-size:calc(12px*var(--fs-scale))}
  .focus-bar-btn{padding:7px 14px;font-size:calc(12.5px*var(--fs-scale))}
  .focus-head{margin:8px 0 14px}
  .focus-actions{gap:10px}
  .focus-bar-btn.history-entry .history-badge{font-size:calc(11px*var(--fs-scale))}
  .focus-title{font-size:calc(30px*var(--fs-scale));font-weight:600}
  .focus-sub{margin-top:8px;font-size:calc(14px*var(--fs-scale))}
  .focus-layout{display:grid;grid-template-columns:minmax(0,46fr) minmax(0,54fr);gap:28px;align-items:stretch}
  .focus-card{padding:24px 30px 22px;border-radius:20px}
  .focus-side{width:auto;gap:16px}
  .focus-caption{font-size:calc(13.5px*var(--fs-scale))}
  .intervene-hint{margin-top:12px;padding:10px 12px;font-size:calc(13px*var(--fs-scale))}
  .task-pick{margin-top:16px}
  .free-line{max-width:100%;margin-top:14px}
  .dial-idle{width:300px;height:300px;margin-top:14px}
  .dial-running{width:300px;height:300px;margin-top:auto;margin-bottom:14px}
  .dial-face{gap:14px}
  .dial-face small{font-size:calc(13px*var(--fs-scale))}
  .dial-time{font-size:calc(62px*var(--fs-scale))}
  .dial-running .dial-face :deep(.plain-clock){font-size:calc(58px*var(--fs-scale))}
  .duration-row{grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin:20px 0 0}
  .duration-chip{padding:12px 6px;font-size:calc(14px*var(--fs-scale))}
  .focus-hint{margin-top:16px;font-size:calc(12px*var(--fs-scale))}
  .focus-primary{margin-top:24px;padding:17px 22px;font-size:calc(15.5px*var(--fs-scale))}
  .focus-primary-inline{padding:14px 46px;font-size:calc(14px*var(--fs-scale))}
  .focus-footnote{margin-top:16px;font-size:calc(12px*var(--fs-scale))}
  .run-actions{gap:8px}
  /* 「继续」和「提前结束」上下堆叠、同一垂直中线：
     上面 `.focus-primary{margin-top:24px}` 会漏到内联按钮上（同权重、后声明），
     结果是内联按钮在垂直堆叠里被往下推了半个 24px —— 必须先归零。 */
  .run-actions .focus-primary-inline{margin-top:0;font-size:calc(14px*var(--fs-scale))}
  .run-actions .focus-text{padding:3px 6px;font-size:calc(13px*var(--fs-scale));line-height:1.4}
  .run-stats{padding-top:22px}
  .run-stat strong{font-size:calc(24px*var(--fs-scale))}
  .run-stat span{font-size:calc(12px*var(--fs-scale))}
  .run-divider{height:34px}
  .camera-switch{gap:16px}
  .camera-glyph{width:26px;height:20px}
  .camera-switch-text strong{font-size:calc(15.5px*var(--fs-scale))}
  .camera-switch-text small{font-size:calc(12.5px*var(--fs-scale))}
  .last-head strong{font-size:calc(15.5px*var(--fs-scale))}
  .last-head span{font-size:calc(12.5px*var(--fs-scale))}
  .last-time{margin-top:18px}
  .last-time strong{font-size:calc(44px*var(--fs-scale))}
  .last-time small{font-size:calc(13.5px*var(--fs-scale))}
  .mini-bar{height:12px;border-radius:6px;margin-top:16px}
  .mini-legend{margin-top:10px;font-size:calc(12.5px*var(--fs-scale))}
  .last-empty-inline{font-size:calc(12.5px*var(--fs-scale))}
  .recent-block{margin-top:22px;padding-top:16px}
  .recent-head{font-size:calc(11.5px*var(--fs-scale))}
  .recent-row{margin-top:11px}
  .recent-label,.recent-value{width:42px;font-size:calc(11.5px*var(--fs-scale))}
  .recent-track{height:7px}
  .side-divider{margin:18px 0}
  .last-note{margin-top:18px;padding-top:16px;font-size:calc(12.5px*var(--fs-scale));line-height:1.8}
  .idle-footnote{font-size:calc(12px*var(--fs-scale))}
  .live-footnote{margin-top:16px;font-size:calc(12px*var(--fs-scale))}
  .footnote-cam{width:17px;height:13px}
  .live-card{flex:1;padding:26px 28px}
  .live-head strong{font-size:calc(15.5px*var(--fs-scale))}
  .live-flag{font-size:calc(12.5px*var(--fs-scale))}
  .video-frame{margin-top:14px;border-radius:14px}
  .video-pill{padding:5px 11px;font-size:calc(12px*var(--fs-scale))}
  .video-stamp{font-size:calc(12px*var(--fs-scale))}
  .live-title{margin-top:20px;font-size:calc(13px*var(--fs-scale))}
  .live-note{padding-top:16px;font-size:calc(12.5px*var(--fs-scale))}
  .summary-main{padding:32px 36px 30px}
  .summary-big strong{font-size:calc(54px*var(--fs-scale))}
  .summary-big small{padding-bottom:8px;font-size:calc(13.5px*var(--fs-scale))}
  .summary-side-text{font-size:calc(13.5px*var(--fs-scale))}
  .timeline{margin-top:82px}
  .timeline.is-flat{margin-top:28px}
  .timeline-track{height:15px;border-radius:8px}
  .timeline-mark{margin-bottom:10px;padding:3px 9px;font-size:calc(12px*var(--fs-scale))}
  .timeline-mark:nth-of-type(even){bottom:calc(100% + 30px)}
  .timeline-axis{margin-top:12px;font-size:calc(12px*var(--fs-scale))}
  .summary-bottom{gap:24px;margin-top:22px}
  .tips-card{padding:30px 34px 28px}
  .tips-list{margin-top:20px}
  .tip-row{gap:14px;margin-bottom:18px;font-size:calc(14px*var(--fs-scale));line-height:1.95}
  .summary-side{width:44%;gap:14px}
  .quote-card{padding:24px 26px;border-radius:18px}
  .quote-label{margin-bottom:10px;font-size:calc(13px*var(--fs-scale))}
  .quote-text{font-size:calc(13.5px*var(--fs-scale));line-height:1.9}
  .summary-links button{font-size:calc(13.5px*var(--fs-scale))}
  .rest-bar{padding:13px 20px;gap:12px;font-size:calc(13px*var(--fs-scale))}
  .rest-bar strong{font-size:calc(18px*var(--fs-scale))}
  .rest-bar button{font-size:calc(13px*var(--fs-scale))}
}
@media (max-width:1020px){
  .focus-layout{flex-direction:column}
  .focus-layout.is-running{align-items:stretch}
  .focus-side{width:100%}
  .summary-bottom{flex-direction:column}
  .summary-side{width:100%}
  .live-card{width:100%}
}
@media (max-width:800px){
  /* 手机端顶部没有导航条、底部是固定标签栏：整页仍按整屏算高，避免底色断层。 */
  .focus-page{min-height:100vh}
}
@media (max-width:640px){
  .focus-inner{padding:12px 13px 0}
  .focus-page{padding-bottom:96px}
  .focus-head{flex-wrap:wrap;gap:8px;margin-bottom:13px}
  .focus-title{font-size:calc(20px*var(--fs-scale))}
  .focus-card{padding:14px 14px 13px}
  .dial-idle{width:148px;height:148px}
  .dial-running{width:172px;height:172px}
  .dial-running .dial-face :deep(.plain-clock){font-size:calc(32px*var(--fs-scale))}
  .dial-time{font-size:calc(30px*var(--fs-scale))}
  .summary-main{padding:14px}
  .summary-big strong{font-size:calc(28px*var(--fs-scale))}
  .summary-side-text{text-align:left}
  .timeline{margin-top:72px}
  .rest-bar{bottom:16px}
}
@media (prefers-reduced-motion: reduce){
  .dial-progress,.focus-bar-btn,.duration-chip,.focus-primary,.rest-pop-enter-active,.rest-pop-leave-active{transition:none}
}

/* 深色模式：页面本地色板跟随全局 token，避免浅纸卡在深底上发白。 */
:global(:root[data-theme='dark'] .focus-page){--paper:#1b2d29;--line:#2f4741;--divider:#2a423c;--ink:#e6f0ec;--ink-soft:#a3b8b2;--ink-faint:#8fa39e;--ink-ghost:#6e827d;--brand:#7fb5ab;--brand-soft:#24423c;--brand-mid:#6d9a90;--brand-line:#3f615b;--wander:#d3ab7f;--away:#3a4c47;--unknown:#334742;--beige:#2c2a22;--beige-ink:#d9c8ae;--el-color-primary:#7fb5ab;--el-color-primary-light-3:#6c9d94;--el-color-primary-light-5:#58857d;--el-color-primary-light-7:#3f615b;--el-color-primary-light-8:#35534d;--el-color-primary-light-9:#2a443f;--el-switch-on-color:#7fb5ab}
:global(:root[data-theme='dark'] .focus-page .duration-chip){background:#213732;color:var(--ink-soft)}
:global(:root[data-theme='dark'] .focus-page .duration-chip.active){background:var(--paper);border-color:var(--brand);color:var(--ink)}
</style>
