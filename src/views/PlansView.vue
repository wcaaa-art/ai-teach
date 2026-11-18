<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { deletePlan, getDataOwner, loadAssessments, loadFocusSessions, loadPlans, makeId, savePlan } from '../db/index.js'
import { clearTaskReminder, scheduleTaskReminder } from '../services/reminders.js'
import { replacePlanTask } from '../services/api.js'
import { formatMathText } from '../utils/formatMath.js'
import { stripBookPrefix } from '../utils/chapterNames.js'
import { detectPlanTask, planTaskBadge } from '../utils/planRoute.js'
import { startStudy } from '../utils/studySession.js'
import { carriedWeeksOf, MAX_CARRY_WEEKS, shiftWeeklyTasks, staleWeeklyTasks, weekKeyOf } from '../utils/weeklyReportPlans.js'
import { useAppStore } from '../stores/app.js'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const plans = ref([])
const editVisible = ref(false)
const editing = ref(null)
const createVisible = ref(false)
const draftPlan = ref(null)
const SUBJECT_OPTIONS = ['语文', '数学', '英语', '物理', '化学', '生物', '历史', '地理', '道德与法治']

// 上周及更早生成、仍未完成的周报任务：周一一到就算过期，可一键清理。
const staleWeeklyPlans = computed(() => staleWeeklyTasks(plans.value))

// === 本周概览：周一到周日，完成数只统计本周归档的任务 ===
const DAY_MS = 86400000
const WEEKDAY_LABELS = ['一', '二', '三', '四', '五', '六', '日']
const now = ref(Date.now())
let nowTimer = null
let railObserver = null
// 「现在」分隔条上显示的是此刻的时间，每分钟跟着 now 走。

function startOfDay(timestamp = Date.now()) {
  const date = new Date(timestamp)
  date.setHours(0, 0, 0, 0)
  return date.getTime()
}

const weekStart = computed(() => startOfDay(now.value - ((new Date(now.value).getDay() + 6) % 7) * DAY_MS))
const weekDays = computed(() => {
  const completed = new Map()
  for (const plan of plans.value) {
    if (plan.isBridge || plan.status !== 'archived' || !plan.completedAt) continue
    const key = startOfDay(plan.completedAt)
    completed.set(key, (completed.get(key) || 0) + 1)
  }
  const max = Math.max(1, ...completed.values())
  const today = startOfDay(now.value)
  return WEEKDAY_LABELS.map((label, index) => {
    const stamp = weekStart.value + index * DAY_MS
    const count = completed.get(stamp) || 0
    return {
      key: stamp,
      label,
      date: new Date(stamp).getDate(),
      count,
      width: count ? Math.max(14, Math.round(count / max * 100)) : 0,
      isToday: stamp === today,
      isFuture: stamp > today
    }
  })
})
const weekCompleted = computed(() => weekDays.value.reduce((sum, day) => sum + day.count, 0))
const daysLeft = computed(() => 7 - ((new Date(now.value).getDay() + 6) % 7))

// === 今天的时间线：过期/顺延任务优先，已完成的任务单独展示 ===
const activePlans = computed(() => plans.value.filter(plan => !plan.isBridge && plan.status === 'active'))
// 排序口径：过期/今天到期优先 → 优先级 → 学习路线顺序，保证列表里第一项就是最该做的。
const PRIORITY_WEIGHT = { 高: 0, 中: 1, 低: 2 }
const queueAll = computed(() => {
  const tomorrow = startOfDay(now.value) + DAY_MS
  // 手动计划选了未来日期就先存着，不占用今天的时间线；到当天再自动排进来。
  return activePlans.value
    .filter(plan => !plan.startAt || Number(plan.startAt) < tomorrow)
    .sort((left, right) => {
    const leftDue = Number(left.reviewTime) && Number(left.reviewTime) < tomorrow ? 0 : 1
    const rightDue = Number(right.reviewTime) && Number(right.reviewTime) < tomorrow ? 0 : 1
    return leftDue - rightDue
      || (PRIORITY_WEIGHT[left.priority] ?? 1) - (PRIORITY_WEIGHT[right.priority] ?? 1)
      || (left.sequenceOrder || 999) - (right.sequenceOrder || 999)
  })
})
const queue = queueAll
const doneToday = computed(() => plans.value
  .filter(plan => !plan.isBridge && plan.status === 'archived' && Number(plan.completedAt || 0) >= startOfDay(now.value))
  .sort((left, right) => Number(right.completedAt) - Number(left.completedAt)))

// === 计划轮盘：中线是「现在」，永远不动；上下滑过中线的是计划 ===
const subjectFilter = ref('all')
const matchSubject = plan => subjectFilter.value === 'all' || plan.subject === subjectFilter.value
const todayPlans = computed(() => [...queue.value, ...doneToday.value])
// 未来才开始的任务不占今天队列，但仍留在轮盘里，行内用日期小标签区分。
const futurePlans = computed(() => plans.value
  .filter(plan => !plan.isBridge && plan.status === 'active'
    && Number(plan.startAt) >= startOfDay(now.value) + DAY_MS)
  .sort((left, right) => Number(left.startAt) - Number(right.startAt)
    || (left.sequenceOrder || 999) - (right.sequenceOrder || 999)))
const listDonePlans = computed(() => doneToday.value.filter(matchSubject).slice().reverse())
const listPendingPlans = computed(() => [...queue.value, ...futurePlans.value].filter(matchSubject))
const subjectFilters = computed(() => {
  // 轮盘里所有计划一起统计：切换科目只过滤轮盘，各科目的数量不跟着变。
  const counts = new Map()
  for (const plan of [...doneToday.value, ...queue.value, ...futurePlans.value]) {
    counts.set(plan.subject, (counts.get(plan.subject) || 0) + 1)
  }
  // 当前筛的科目暂时没任务时也保留入口（计数 0），避免选中的筛选项凭空消失。
  if (subjectFilter.value !== 'all' && !counts.has(subjectFilter.value)) counts.set(subjectFilter.value, 0)
  return [
    { key: 'all', label: '全部', count: [...counts.values()].reduce((sum, count) => sum + count, 0) },
    ...[...counts.entries()]
      .sort((left, right) => {
        // 数量多的排前面；数量相同按全站科目顺序，避免每次渲染顺序跳动。
        if (right[1] !== left[1]) return right[1] - left[1]
        const leftIndex = SUBJECT_OPTIONS.indexOf(left[0])
        const rightIndex = SUBJECT_OPTIONS.indexOf(right[0])
        return (leftIndex < 0 ? 99 : leftIndex) - (rightIndex < 0 ? 99 : rightIndex)
      })
      .map(([subject, count]) => ({ key: subject, label: subject, count }))
  ]
})
const carriedToday = computed(() => queue.value.filter(isCarriedFromYesterday))
const heroTitle = computed(() => {
  if (!plans.value.length) return '还没有学习计划'
  if (!todayPlans.value.length) return '今天没有排计划，可以休息一下'
  const total = todayPlans.value.length
  const carried = carriedToday.value.length
  return carried
    ? `今天 ${total} 个计划，${carried} 个是昨天没做完的`
    : `今天 ${total} 个计划，做完就收工`
})
const weekActive = computed(() => activePlans.value.filter(plan => !plan.startAt || Number(plan.startAt) < weekStart.value + 7 * DAY_MS))
const weekTotal = computed(() => weekCompleted.value + weekActive.value.length)
const weekRemaining = computed(() => Math.max(0, weekTotal.value - weekCompleted.value))
const weekPercent = computed(() => (weekTotal.value ? Math.round(weekCompleted.value / weekTotal.value * 100) : 0))
const weekNote = computed(() => {
  if (!weekTotal.value) return '这周还没有任务，先排一项'
  if (!weekRemaining.value) return '这周的计划都完成了，不用加码'
  return `还差 ${weekRemaining.value} 项，每天 ${Math.ceil(weekRemaining.value / Math.max(1, daysLeft.value))} 项刚好`
})
// === 今日计划列表：已完成在上，待做在下，中间是当前时间 ===
// 已完成全部展开，顶部统计和日期分组共用同一份数据，数字不会再对不上。
const listItems = computed(() => {
  const done = listDonePlans.value.map(plan => ({ key: plan.id, plan, done: true }))
  const pending = listPendingPlans.value.map(plan => ({
    key: plan.id,
    plan,
    done: false,
    // 未来才开始的计划虽然可能是昨天建的，但不算「昨天未完成」。
    carried: isCarriedFromYesterday(plan) && !(Number(plan.startAt) >= startOfDay(now.value) + DAY_MS)
  }))
  return [...done, ...pending]
})
const listDoneCount = computed(() => listItems.value.filter(item => item.done).length)
// 角标统计真实总数。
const listTotalCount = computed(() => listDonePlans.value.length + listPendingPlans.value.length)
const listDoneTotal = computed(() => listDonePlans.value.length)
// 「现在」插在第一条待做之前；全部完成时不在列表里出现。
const nowIndex = computed(() => listDoneCount.value)

// === 按天分组：今天（含昨天顺延）在最上面，之后按自然日一天一组 ===
// 归组口径和队列一致：没开始时间的、昨天及更早的，都算今天；未来的按 startAt 的日期切。
function planDayKey(plan) {
  const stamp = Number(plan.startAt) || 0
  const today = startOfDay(now.value)
  return stamp >= today + DAY_MS ? startOfDay(stamp) : today
}
const dayGroups = computed(() => {
  const map = new Map()
  for (const item of listItems.value) {
    const key = planDayKey(item.plan)
    if (!map.has(key)) map.set(key, { key, items: [], done: 0 })
    const group = map.get(key)
    group.items.push(item)
    if (item.done) group.done += 1
  }
  const today = startOfDay(now.value)
  for (const group of map.values()) {
    const date = new Date(group.key)
    const offset = Math.round((group.key - today) / DAY_MS)
    group.offset = offset
    group.label = offset === 0 ? '今天'
      : offset === 1 ? '明天'
        : offset === 2 ? '后天'
          : offset < 7 ? `周${WEEKDAY_LABELS[(date.getDay() + 6) % 7]}`
            : `${date.getMonth() + 1}/${date.getDate()}`
    // 今天这组顺带报一下完成度，未来的只报个数。
    group.meta = offset === 0 ? `已完成 ${group.done} / ${group.items.length}` : `${group.items.length} 个`
  }
  return map
})
// 每组的第一条计划：它上面要插一行日期标题，其余计划行不插。
const dayHeadKeys = computed(() => {
  const keys = new Set()
  let last = null
  for (const item of listItems.value) {
    const key = planDayKey(item.plan)
    if (key !== last) keys.add(item.key)
    last = key
  }
  return keys
})
function groupHead(item) {
  return dayHeadKeys.value.has(item.key) ? dayGroups.value.get(planDayKey(item.plan)) : null
}
// === 顶部日期轴：整月排一条，窗口只露 7 格，滚轮左右推动 ===
// 默认落在「前天 / 昨天 / 今天 / 明天 / 后天 / 周X / 周X」，今天稳在第 3 格。
const AXIS_SIZE = 7
const AXIS_STEP = 38 // 34px 格子 + 4px 间距，改这里要同步 .plan-axis-cell 的宽和 gap
const AXIS_BASE_OFFSET = 2 // 窗口从今天往前数几格
const monthlyDays = computed(() => {
  const today = startOfDay(now.value)
  const cursor = new Date(today)
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getTime()
  const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime()
  const total = Math.round((nextMonth - first) / DAY_MS)
  return Array.from({ length: total }, (_, index) => {
    const stamp = first + index * DAY_MS
    const date = new Date(stamp)
    const group = dayGroups.value.get(stamp)
    const count = group ? group.items.length : 0
    const isPast = stamp < today
    return {
      key: stamp,
      date: date.getDate(),
      weekday: WEEKDAY_LABELS[(date.getDay() + 6) % 7],
      count,
      isToday: stamp === today,
      isPast,
      label: isPast ? `${date.getDate()} 日已经过去`
        : count ? `跳到 ${date.getDate()} 日，${count} 个计划`
          : `${date.getDate()} 日还没有计划，点一下在这天新建`
    }
  })
})
// 窗口能滑的范围：本月一号 → 本月最后一天，两头都不越月。
const axisBounds = computed(() => {
  const today = startOfDay(now.value)
  const cursor = new Date(today)
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1).getTime()
  const nextMonth = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1).getTime()
  const lastStart = nextMonth - DAY_MS - (AXIS_SIZE - 1) * DAY_MS
  return {
    first,
    lastStart: Math.max(first, lastStart),
    base: today - AXIS_BASE_OFFSET * DAY_MS
  }
})
// 用「相对默认位置的格数」记状态，跨天时窗口会跟着今天自动走。
const axisShift = ref(0)
const axisStart = computed(() => {
  const bounds = axisBounds.value
  const raw = bounds.base + axisShift.value * DAY_MS
  return Math.min(Math.max(raw, bounds.first), bounds.lastStart)
})
const axisIndex = computed(() => Math.round((axisStart.value - axisBounds.value.first) / DAY_MS))
const axisTrackStyle = computed(() => ({ transform: `translateX(${-axisIndex.value * AXIS_STEP}px)` }))
const axisWindow = computed(() => {
  const byKey = new Map(monthlyDays.value.map(day => [day.key, day]))
  return Array.from({ length: AXIS_SIZE }, (_, index) => byKey.get(axisStart.value + index * DAY_MS)).filter(Boolean)
})
const todayInWindow = computed(() => axisWindow.value.some(day => day.isToday))
// 滚轮一格走一天：鼠标滚轮滚一格约 100，触控板是连续小值，靠累积凑够一格。
// 高分屏（DPR=2）下同一次滚轮拿到的 delta 只有一半，所以阈值取 50 而不是 100。
let axisWheelAcc = 0
function onAxisWheel(event) {
  event.preventDefault()
  // deltaMode 为 1 时单位是「行」，按一行约 33px 折算。
  const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaY
  axisWheelAcc += delta
  if (Math.abs(axisWheelAcc) < 50) return
  const dir = axisWheelAcc > 0 ? 1 : -1
  const steps = Math.abs(axisWheelAcc) >= 200 ? 2 : 1
  axisWheelAcc = 0
  shiftAxis(dir * steps)
}
function shiftAxis(steps) {
  const bounds = axisBounds.value
  const next = Math.min(Math.max(axisStart.value + steps * DAY_MS, bounds.first), bounds.lastStart)
  if (next === axisStart.value) return
  axisShift.value = Math.round((next - bounds.base) / DAY_MS)
}
function resetAxis() {
  axisShift.value = 0
}
// 点日期轴滚到那一组标题：用 rect 差值算，避开 offsetParent 是哪一层的问题。
function scrollToDay(dayKey) {
  const el = planList.value
  const head = el?.querySelector(`[data-day="${dayKey}"]`)
  if (!el || !head) return
  const top = el.scrollTop + head.getBoundingClientRect().top - el.getBoundingClientRect().top
  el.scrollTo({ top: Math.max(0, top - 6), behavior: 'smooth' })
}

// 点日期轴：那天有安排就滚过去，空着且还没过去就直接在那天新建一条。
function onAxisClick(day) {
  if (day.isPast) return
  if (day.count) scrollToDay(day.key)
  else openCreatePlan(day.key)
}

// === 拖拽改期：把一行计划拖到日期轴上某天，就改到那天 18:00；拖回今天等于清掉开始时间 ===
const DAY_START_HOUR = 18
const draggingId = ref('')
const dragOverDay = ref(0)
function onRowDragStart(item, event) {
  // 已完成的先不给拖：拖完完成态和日期容易对不上，想改期先取消完成。
  if (item.done) {
    event.preventDefault()
    return
  }
  draggingId.value = item.plan.id
  event.dataTransfer.effectAllowed = 'move'
  event.dataTransfer.setData('text/plain', item.plan.id)
}
function onRowDragEnd() {
  draggingId.value = ''
  dragOverDay.value = 0
}
function onDayDragOver(day, event) {
  // 已经过去的日子不给落：改到过去没有意义。
  if (!draggingId.value || day.isPast) return
  event.preventDefault()
  event.dataTransfer.dropEffect = 'move'
  dragOverDay.value = day.key
}
function onDayDragLeave(day) {
  if (dragOverDay.value === day.key) dragOverDay.value = 0
}
async function onDayDrop(day, event) {
  event.preventDefault()
  const id = draggingId.value || event.dataTransfer.getData('text/plain')
  draggingId.value = ''
  dragOverDay.value = 0
  const plan = plans.value.find(item => item.id === id)
  if (!plan) return
  const today = startOfDay(now.value)
  // 拖回今天就不写开始时间，让它立刻回到今天的队列里。
  const startAt = day.key === today ? null : day.key + DAY_START_HOUR * 60 * 60 * 1000
  const currentDay = plan.startAt ? startOfDay(Number(plan.startAt)) : today
  if (currentDay === day.key) return
  // 逾期标记看的是 reviewTime，拖到今天时要一并清掉，否则「昨天未完成」的标签赖着不走。
  await savePlan({ ...plan, startAt, reviewTime: startAt })
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  await nextTick()
  syncRail()
  const offset = Math.round((day.key - today) / DAY_MS)
  const label = offset === 0 ? '今天'
    : offset === 1 ? '明天'
      : offset === 2 ? '后天'
        : `周${WEEKDAY_LABELS[(new Date(day.key).getDay() + 6) % 7]}`
  ElMessage.success(offset === 0 ? '已挪回今天，随时可以开始' : `已改到${label}，那天 ${DAY_START_HOUR}:00 开始`)
}

const planList = ref(null)
// 右侧刻度滚动条：一条刻度 = 一个计划，加深那条 = 当前滚到的那一行。
// 原生滚动条隐藏但保留滚动能力，刻度只负责「看得见位置」和「点一下跳过去」。
const railH = ref(0)
const railIndex = ref(0)
// 紧凑排法：刻度之间固定 12px；计划多了压缩间距，但整条刻度最多占列表高度的 62%（上限 360px），避免铺满整列。
const RAIL_PITCH = 12
const RAIL_MAX_HEIGHT = 360
const railTrackH = computed(() => Math.min(RAIL_MAX_HEIGHT, Math.max(120, railH.value * 0.62)))
const railPitch = computed(() => {
  const total = listItems.value.length
  if (total <= 1) return RAIL_PITCH
  const available = Math.max(24, railTrackH.value - 4)
  return Math.min(RAIL_PITCH, available / (total - 1))
})
// 整列在列表可视高度里垂直居中：上下留白对称，不贴着顶上排。
const railSpan = computed(() => Math.max(0, (listItems.value.length - 1) * railPitch.value))
const railOffset = computed(() => Math.max(0, (railH.value - railSpan.value) / 2))
const railTop = (index) => Math.round(railOffset.value + index * railPitch.value)
function syncRail() {
  const el = planList.value
  if (!el) return
  railH.value = el.clientHeight
  const total = listItems.value.length
  const max = el.scrollHeight - el.clientHeight
  // 按滚动比例映射到第几条刻度：滚到底一定是最后一条，不会停在半路。
  railIndex.value = max > 0 ? Math.round((el.scrollTop / max) * (total - 1)) : 0
}
// 打开页面时停在第一条未完成上：上方是今天做完的，往上滑能回看，往下才是待办。
function anchorToFirstPending() {
  const el = planList.value
  const row = el?.querySelectorAll('[data-plan-id]')?.[nowIndex.value]
  if (!el || !row) return
  // 第一条待办所在分组的日期标题要一起露出来，否则打开页面看不到「今天」这一组从哪开始。
  // 今天做完的太多（超过大半屏）时不回头找标题，优先让人看见待办。
  const head = el.querySelector('.plan-day-head')
  const keepHead = head && row.offsetTop - head.offsetTop < el.clientHeight * 0.6
  const top = keepHead ? head.offsetTop : row.offsetTop - 6
  el.scrollTop = Math.max(0, top - 4)
}
// 点刻度滚到对应位置；和 syncRail 用同一套映射，点完高亮正好落在这一条上。
function jumpToRow(index) {
  const el = planList.value
  const total = listItems.value.length
  const max = el ? el.scrollHeight - el.clientHeight : 0
  if (!el || max <= 0 || total <= 1) return
  el.scrollTo({ top: (index / (total - 1)) * max, behavior: 'smooth' })
}
// 悬浮刻度条展开计划清单：清单本身也在同一个悬浮区里，鼠标从刻度挪到清单上不会收起。
// 收起留 160ms 缓冲，避免从刻度挪向清单的途中穿过缝隙时闪一下。
const railOpen = ref(false)
const railPanelList = ref(null)
let railCloseTimer = 0
function openRail() {
  window.clearTimeout(railCloseTimer)
  railOpen.value = true
}
function closeRail() {
  window.clearTimeout(railCloseTimer)
  railCloseTimer = window.setTimeout(() => { railOpen.value = false }, 160)
}
// 计划多到清单要滚动时，展开先把当前那条摆到清单中间，一眼看到自己读到哪了。
function revealRailActive() {
  const box = railPanelList.value
  const row = box?.querySelector('.rail-panel-row.active')
  if (!box || !row || box.scrollHeight <= box.clientHeight) return
  box.scrollTop = Math.max(0, row.offsetTop - (box.clientHeight - row.offsetHeight) / 2)
}
watch(railOpen, (open) => { if (open) nextTick(revealRailActive) })
// 从清单里点一条：先跳过去再收起，鼠标不挪开也不会自己弹回来。
function jumpFromRail(index) {
  jumpToRow(index)
  railOpen.value = false
}
watch(listItems, () => nextTick(syncRail))
function rowMeta(item) {
  // 日期已经由分组标题交代过了，行内只留时长和状态，不再重复标「明天」「11/20」。
  return planMeta(item.plan)
}
// 从通知/新建跳过来时，把目标计划滚到列表可见范围内并高亮 2.8 秒；只滚卡片内部，不带动整页。
async function focusPlanRow(id) {
  highlightId.value = ''
  await nextTick()
  const row = planList.value?.querySelector(`[data-plan-id="${id}"]`)
  const scroller = planList.value
  if (!row || !scroller) return
  const box = row.getBoundingClientRect()
  const view = scroller.getBoundingClientRect()
  scroller.scrollTo({ top: scroller.scrollTop + box.top - view.top - (view.height - box.height) / 2, behavior: 'smooth' })
  highlightId.value = id
  window.setTimeout(() => { if (highlightId.value === id) highlightId.value = '' }, 2800)
}
// 勾选圈：完成即归档，再点一次恢复为进行中。
async function completePlan(plan) {
  if (!plan) return
  await toggleArchive(plan)
}
// === 本周进度与专注分布：都用本地真实记录，不编造进度 ===
const focusSessions = ref([])
const FOCUS_COLORS = ['#2f5c57', '#6b9c92', '#a7c8bf', '#c09a70', '#cbd9d3']
const weekFocus = computed(() => {
  const cutoff = startOfDay(now.value) - 6 * DAY_MS
  const map = new Map()
  for (const session of focusSessions.value) {
    if (Number(session.createdAt || 0) < cutoff) continue
    const name = session.subject || '其他'
    map.set(name, (map.get(name) || 0) + (Number(session.actualSeconds) || 0))
  }
  const seconds = [...map.values()].reduce((sum, value) => sum + value, 0)
  const rows = [...map.entries()]
    .map(([name, value]) => ({ name, minutes: Math.round(value / 60), percent: seconds ? value / seconds * 100 : 0 }))
    .filter(row => row.minutes > 0)
    .sort((left, right) => right.minutes - left.minutes)
    .slice(0, 5)
  return { rows, total: Math.round(seconds / 60) }
})
const assessmentSubjects = ref([])
const missingSubjects = computed(() => assessmentSubjects.value
  .filter(subject => !activePlans.value.some(plan => plan.subject === subject))
  .slice(0, 2))
const insight = computed(() => {
  const past = weekDays.value.filter(day => !day.isFuture)
  if (!weekCompleted.value) return '这周还没开始也没关系，挑一件最小的做 15 分钟——动起来比排计划更有用'
  const low = past.reduce((min, day) => (day.count < min.count ? day : min), past[0])
  const high = Math.max(...past.map(day => day.count))
  if (low.count < high && low.count <= 1) {
    const label = low.isToday ? '今天' : `周${low.label}`
    return low.count === 0
      ? `${label}还没有记录，不用补，今天先挑最重要的一项做完，就算赢`
      : `${label}完成了 1 项，已经开头了，今天不用补，把最重要的一项做完就好`
  }
  return `这周已完成 ${weekCompleted.value} 项，这个节奏刚刚好，保持住就赢了`
})

// 昨天没做完的任务：今天早上新建的不算，之前建的或已到期的都算。
function isCarriedFromYesterday(plan) {
  const created = Number(plan.createdAt || 0)
  if (created && created < startOfDay(now.value)) return true
  const due = Number(plan.reviewTime || plan.startAt || 0)
  return Boolean(due) && due < startOfDay(now.value)
}

function planTitle(plan) {
  const name = stripBookPrefix(plan.name || '')
  return name.startsWith(`${plan.subject} ·`) ? name : `${plan.subject} · ${name}`
}

function planMeta(plan) {
  const parts = [`${Number(plan.estimatedMinutes) || 25} 分钟`]
  const detail = stripBookPrefix(plan.chapterName || plan.knowledgeTags?.[0] || '')
  if (detail) parts.push(detail)
  if (plan.reason && plan.reason !== detail) parts.push(stripBookPrefix(plan.reason))
  return parts.join(' · ')
}

const highlightId = ref('')

function localDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDate(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '待安排'
}

// 计划点击统一分流：练习→做题、背诵→背诵窗口、错题→错题复习。
// 所有计划都不再进专注空间。做题 / 错题复习走「学习会话」自动计时，离开窗口时记录专注。
function openPlanTask(plan) {
  const task = detectPlanTask(plan)
  store.setPlans(plans.value)
  if (task.kind === 'recite') {
    // 背诵窗口自己计时并在完成时记录专注，这里不启动学习会话，避免重复记录。
    router.push({ name: 'recite', query: { planId: plan.id, mode: task.mode } })
    return
  }
  // 做题 / 错题复习：启动学习会话，进窗口自动计时。
  startStudy(plan)
  if (task.kind === 'mistakes') {
    router.push({ name: 'mistakes', query: { subject: plan.subject, filter: 'open' } })
    return
  }
  // 练习/做题（含默认）
  router.push({ name: 'practice', query: { planId: plan.id } })
}
// 整行都能点；勾选圈、「⋯」菜单、链接各有自己的事，点它们不算。
// 已完成的行不响应，避免回看历史时误跳。
function onRowClick(item, event) {
  if (item.done) return
  if (event.target instanceof Element && event.target.closest('button, a, input, .el-dropdown')) return
  openPlanTask(item.plan)
}

// 专注记录与诊断科目只读一次，供本周专注分布和「还没排的科目」提示使用。
async function loadFocusData() {
  focusSessions.value = await loadFocusSessions()
}

async function loadAssessmentSubjects() {
  const assessments = await loadAssessments()
  assessmentSubjects.value = [...new Set(
    assessments
      .filter(item => item?.subject)
      .sort((left, right) => Number(right.createdAt || 0) - Number(left.createdAt || 0))
      .map(item => item.subject)
  )]
}

function openEdit(plan) {
  editing.value = {
    ...plan,
    reviewAt: localDateTime(plan.reviewTime),
    startAt: localDateTime(plan.startAt),
    knowledgeTagsText: (plan.knowledgeTags || []).join('')
  }
  editVisible.value = true
}

async function submitEdit() {
  if (!editing.value?.name?.trim() || !editing.value?.subject) {
    ElMessage.info('请先填写任务名称和科目')
    return
  }
  const updatedPlan = {
    ...editing.value,
    name: editing.value.name.trim(),
    estimatedMinutes: Number(editing.value.estimatedMinutes),
    reviewTime: editing.value.reviewAt ? new Date(editing.value.reviewAt).getTime() : null,
    startAt: editing.value.startAt ? new Date(editing.value.startAt).getTime() : null,
    knowledgeTags: editing.value.knowledgeTagsText.split(/[、,，]/).map(tag => tag.trim()).filter(Boolean)
  }
  delete updatedPlan.reviewAt
  delete updatedPlan.knowledgeTagsText
  await savePlan(updatedPlan)
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  editVisible.value = false
  ElMessage.success('计划已更新')
}

// === 手动新建计划：自己定内容、时长和开始时间，不依赖诊断重新生成 ===
function nextStartTime() {
  const stamp = Math.ceil((Date.now() + 10 * 60000) / 300000) * 300000
  return localDateTime(stamp)
}

// dayKey 传了日期就是「在那天新建」：日期轴点空白格走这条路，默认排到当天 18:00。
function openCreatePlan(dayKey) {
  const profile = store.profile || {}
  const fallback = plans.value.find(plan => plan.subject) || {}
  const onDay = typeof dayKey === 'number' && dayKey > 0
  draftPlan.value = {
    name: '',
    subject: profile.subject || fallback.subject || '数学',
    grade: profile.grade || fallback.grade || '',
    edition: profile.edition || fallback.edition || '',
    estimatedMinutes: 25,
    priority: '中',
    startAt: onDay ? localDateTime(dayKey + 18 * 60 * 60 * 1000) : nextStartTime()
  }
  createVisible.value = true
}

async function submitCreatePlan() {
  const draft = draftPlan.value
  if (!draft?.name?.trim() || !draft.subject) {
    ElMessage.info('请先填写计划名称和科目')
    return
  }
  const startAt = draft.startAt ? new Date(draft.startAt).getTime() : Date.now()
  if (!Number.isFinite(startAt)) {
    ElMessage.info('开始时间格式不对，请重新选择')
    return
  }
  const sameSubject = plans.value.filter(plan => plan.subject === draft.subject)
  const plan = {
    id: makeId('manual'),
    name: draft.name.trim(),
    subject: draft.subject,
    grade: draft.grade,
    edition: draft.edition,
    estimatedMinutes: Number(draft.estimatedMinutes) || 25,
    priority: draft.priority || '中',
    startAt,
    knowledgeTags: [],
    stage: 'concept',
    isBridge: false,
    sequenceOrder: Math.max(0, ...sameSubject.map(item => Number(item.sequenceOrder) || 0)) + 1,
    reason: '手动创建的计划',
    status: 'active',
    createdAt: Date.now()
  }
  await savePlan(plan)
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  createVisible.value = false
  // 建完后切回全部科目，滚动到这一条并高亮 2.8 秒；未来任务只提示日期。
  const dayGap = Math.round((startOfDay(startAt) - startOfDay(now.value)) / DAY_MS)
  subjectFilter.value = 'all'
  await focusPlanRow(plan.id)
  ElMessage.success(dayGap > 0 ? `计划已创建，${formatDate(startAt)}开始` : '计划已创建，已排进今天的计划')
}

// 行内「⋯」菜单：所有管理动作都从这一条任务上直接触发。
function onPlanCommand(command, plan) {
  if (command === 'remind') setReminder(plan)
  else if (command === 'edit') openEdit(plan)
  else if (command === 'replace') replaceTask(plan)
  else if (command === 'ask') router.push({ path: '/tutor', query: { planId: plan.id } })
  else if (command === 'lock') toggleLock(plan)
  else if (command === 'up') movePlan(plan, -1)
  else if (command === 'down') movePlan(plan, 1)
  else if (command === 'archive') {
    if (plan.status === 'archived') toggleArchive(plan)
    else completePlan(plan)
  }
  else if (command === 'remove') removePlan(plan)
}

// 上移/下移只在同科目进行中的任务里换位，对应原来的拖拽排序。
function subjectQueue(plan) {
  return plans.value
    .filter(item => !item.isBridge && item.status === 'active' && item.subject === plan.subject)
    .sort((left, right) => (left.sequenceOrder || 999) - (right.sequenceOrder || 999))
}

function canMove(plan, step) {
  const list = subjectQueue(plan)
  const index = list.findIndex(item => item.id === plan.id)
  return index >= 0 && index + step >= 0 && index + step < list.length
}

async function movePlan(plan, step) {
  const list = subjectQueue(plan)
  const index = list.findIndex(item => item.id === plan.id)
  const target = index + step
  if (index < 0 || target < 0 || target >= list.length) return
  list.splice(target, 0, list.splice(index, 1)[0])
  // 重排后写回 sequenceOrder，重新诊断时沿用用户确认的顺序。
  for (const [order, item] of list.entries()) await savePlan({ ...item, sequenceOrder: order + 1 })
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  ElMessage.success(step < 0 ? '已往前挪一位' : '已往后挪一位')
}

async function setReminder(plan) {
  if (!('Notification' in window)) {
    ElMessage.info('当前浏览器不支持通知提醒')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('输入提醒时间（本地时间，24 小时制）', '为任务设置提醒', {
      inputValue: localDateTime(Date.now() + 3600000),
      inputPattern: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/,
      inputErrorMessage: '请选择有效的日期和时间'
    })
    const reminderAt = new Date(value).getTime()
    if (!Number.isFinite(reminderAt) || reminderAt <= Date.now()) {
      ElMessage.info('提醒时间需要晚于现在')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      ElMessage.info('浏览器通知权限未开启')
      return
    }
    const updatedPlan = { ...plan, remindAt: reminderAt }
    await savePlan(updatedPlan)
    plans.value = await loadPlans()
    store.setPlans(plans.value)
    scheduleTaskReminder(updatedPlan)
    ElMessage.success('提醒已保存；请保持浏览器运行以便按时提醒')
  } catch {
    // 用户取消提醒时间输入时不修改原计划。
  }
}

async function toggleArchive(plan) {
  const archived = plan.status !== 'archived'
  // 记录完成时间，周报才能按「本周完成」统计计划完成率；取消归档时清空。
  const updatedPlan = { ...plan, status: archived ? 'archived' : 'active', completedAt: archived ? Date.now() : null }
  await savePlan(updatedPlan)
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  scheduleTaskReminder(updatedPlan)
}

async function removePlan(plan) {
  try {
    await ElMessageBox.confirm('删除后无法从本机恢复，确定继续吗？', '删除计划', { type: 'warning' })
    clearTaskReminder(plan.id)
    await deletePlan(plan.id)
    plans.value = await loadPlans()
    store.setPlans(plans.value)
    ElMessage.success('计划已删除')
  } catch {
    // 用户取消确认时保留计划与提醒。
  }
}

// 过期周报任务可能混在多个科目里，统一按日期清理；已归档任务保留用于统计。
async function removeTasks(list) {
  for (const plan of list) {
    clearTaskReminder(plan.id)
    await deletePlan(plan.id)
  }
  plans.value = await loadPlans()
  store.setPlans(plans.value)
}

// 自动提示：有过期周报任务时，进入计划页直接问「顺延 / 清空」，关闭则本周不再弹。
const staleTipKey = () => `ai-teach-weekly-cleanup:${getDataOwner()}:${weekKeyOf()}`
let stalePrompted = false

function markStalePromptHandled() {
  try { localStorage.setItem(staleTipKey(), '1') } catch (error) { console.warn('周报清理提示状态写入失败。', error) }
}

async function promptStaleWeeklyTasks() {
  if (stalePrompted || !staleWeeklyPlans.value.length) return
  let handled = false
  try { handled = Boolean(localStorage.getItem(staleTipKey())) } catch (error) { console.warn('周报清理提示状态读取失败。', error) }
  if (handled) return
  stalePrompted = true
  const stale = [...staleWeeklyPlans.value]
  const shiftable = stale.filter(task => carriedWeeksOf(task) < MAX_CARRY_WEEKS)
  const overLimit = stale.length - shiftable.length
  let action = shiftable.length ? 'shift' : 'clear'
  try {
    await ElMessageBox.confirm(
      shiftable.length
        ? `上周还有 ${stale.length} 条周报任务没有完成，${overLimit ? `其中 ${overLimit} 条已顺延 ${MAX_CARRY_WEEKS} 次，建议拆小或放弃，不会继续顺延` : ''}要把 ${shiftable.length} 条顺延到本周，还是全部清空？`
        : `上周还有 ${stale.length} 条周报任务没有完成，且都已顺延 ${MAX_CARRY_WEEKS} 次，建议拆小或放弃，不再继续顺延，要直接清空吗？`,
      '上周周报任务',
      shiftable.length
        ? { confirmButtonText: `顺延 ${shiftable.length} 条`, cancelButtonText: '全部清空', distinguishCancelAndClose: true, type: 'info' }
        : { confirmButtonText: '清空这些任务', cancelButtonText: '稍后处理', distinguishCancelAndClose: true, type: 'warning' }
    )
  } catch (value) {
    action = value === 'cancel' && shiftable.length ? 'clear' : 'later'
  }
  if (action === 'later') {
    // 关闭弹窗视为稍后处理，本周不再自动弹；手动清理按钮仍然可用。
    markStalePromptHandled()
    return
  }
  if (action === 'shift') {
    // 先写新 id 再删旧记录，中途失败也不会丢任务；达到上限的任务留在过期列表。
    for (const task of shiftWeeklyTasks(shiftable, plans.value)) await savePlan(task)
    await removeTasks(shiftable)
    markStalePromptHandled()
    ElMessage.success(overLimit
      ? `已顺延 ${shiftable.length} 条；${overLimit} 条达到上限，建议拆小或清空`
      : `已把 ${shiftable.length} 条周报任务顺延到本周`)
    return
  }
  await removeTasks(stale)
  markStalePromptHandled()
  ElMessage.success(`已清空 ${stale.length} 条过期周报任务`)
}

const replacing = ref('')

async function toggleLock(plan) {
  const next = { ...plan, locked: !plan.locked }
  await savePlan(next)
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  ElMessage.success(next.locked ? '已锁定，重新分析时保留这个任务' : '已解锁，下次重新分析可被新计划替换')
}

// 点击立即生效的本地变体，AI 文案回来后再覆盖，避免为了换个任务名等半分钟。
const LOCAL_VARIANTS = ['变式练习', '错题重做', '知识梳理']
function localVariant(plan) {
  const tag = String(plan.knowledgeTags?.[0] || plan.name || '知识点').slice(0, 12)
  const pool = LOCAL_VARIANTS.filter(item => !String(plan.name || '').includes(item))
  const variant = (pool.length ? pool : LOCAL_VARIANTS)[0]
  return { ...plan, name: `${tag} · ${variant}`, reason: '换个任务形式，保持练习的新鲜感', aiPending: true }
}

async function replaceTask(plan) {
  if (replacing.value) return
  replacing.value = plan.id
  // 先落本地变体，点击即生效。
  await savePlan(localVariant(plan))
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  try {
    const response = await replacePlanTask({ plan, profile: store.profile })
    if (response.success && response.data?.plan?.name) {
      await savePlan({ ...response.data.plan, id: plan.id, sequenceOrder: plan.sequenceOrder, locked: plan.locked, aiPending: false })
      plans.value = await loadPlans()
      store.setPlans(plans.value)
      ElMessage.success('已换成新的任务形式，知识点保持不变')
    }
  } finally {
    replacing.value = ''
  }
}

// 开发期演示数据：计划页的刻度滚动条要十几条计划才看得出效果，这里给个开关，生产构建不引入。
async function applyDemoParam() {
  const mode = String(route.query.demo || '')
  if (mode !== 'plans' && mode !== 'clear') return
  const demo = await import('../utils/demoPlanList.js')
  const count = mode === 'clear' ? await demo.clearDemoPlanList() : await demo.seedDemoPlanList()
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  await nextTick()
  syncRail()
  ElMessage.success(mode === 'clear' ? `已清除 ${count} 条演示计划` : `已加入 ${count} 条演示计划`)
}

onMounted(async () => {
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  // 开发期预览刻度滚动条用：?demo=plans 灌一批计划，?demo=clear 清掉。
  if (import.meta.env.DEV) await applyDemoParam()
  if ('Notification' in window && Notification.permission === 'granted') {
    plans.value.forEach(scheduleTaskReminder)
  }
  await promptStaleWeeklyTasks()
  await Promise.all([loadFocusData(), loadAssessmentSubjects()])
  await nextTick()
  await focusTaskFromQuery()
  // 列表高度会随窗口和计划数变化，刻度要跟着重算，否则最后一条会落到框外。
  syncRail()
  // 从通知/新建跳进来的目标是某一项，那时不要抢它的滚动位置。
  if (!route.query.focusTask) anchorToFirstPending()
  if ('ResizeObserver' in window && planList.value) {
    railObserver = new ResizeObserver(() => syncRail())
    railObserver.observe(planList.value)
  }
  nowTimer = window.setInterval(() => { now.value = Date.now() }, 60000)
})
onBeforeUnmount(() => {
  window.clearInterval(nowTimer)
  railObserver?.disconnect()
})

// 从通知中心「去计划」进入时，滚到目标任务并高亮。
async function focusTaskFromQuery() {
  const id = String(route.query.focusTask || '')
  if (!id) return
  subjectFilter.value = 'all'
  await nextTick()
  await focusPlanRow(id)
}
watch(() => route.query.focusTask, value => { if (value) focusTaskFromQuery() })

</script>

<template>
  <div class="page plan-page">
    <header class="plan-hero">
      <div class="hero-copy">
        <span class="eyebrow">学习计划</span>
        <h2 class="hero-title">{{ heroTitle }}</h2>
      </div>
      <div class="hero-actions">
        <button type="button" class="hero-ghost" @click="openCreatePlan()">新建计划</button>
      </div>
    </header>

    <div v-if="plans.length" class="filter-bar">
      <div class="subject-pills" role="group" aria-label="按科目筛选计划">
        <button v-for="item in subjectFilters" :key="item.key" type="button" class="subject-pill" :class="{ active: subjectFilter === item.key }" :aria-pressed="subjectFilter === item.key" @click="subjectFilter = item.key">
          {{ item.label }}<span>{{ item.count }}</span>
        </button>
      </div>
    </div>

    <div class="plan-columns">
      <section class="plan-wheel" :class="{ 'is-empty': !listItems.length }" aria-label="今日学习计划">
        <div class="plan-list-head">
          <span v-if="listItems.length" class="plan-count">已完成 <b>{{ listDoneTotal }}</b> / {{ listTotalCount }}</span>
          <!-- 日期轴：整月排一条，窗口露 7 格。滚轮前进后退，今天不在窗口里时右侧给个「回今天」。 -->
          <div v-if="listItems.length" class="plan-axis-wrap">
            <div
              class="plan-axis-window"
              role="group"
              aria-label="按日期跳到计划，滚轮可以前后翻日子"
              @wheel.prevent="onAxisWheel"
            >
              <div class="plan-axis-track" :style="axisTrackStyle">
                <button
                  v-for="day in monthlyDays"
                  :key="'axis-' + day.key"
                  type="button"
                  class="plan-axis-cell"
                  :class="{ 'is-today': day.isToday, 'is-past': day.isPast, 'is-empty': !day.count, 'is-drop': dragOverDay === day.key }"
                  :aria-label="day.label"
                  @click="onAxisClick(day)"
                  @dragover="onDayDragOver(day, $event)"
                  @dragleave="onDayDragLeave(day)"
                  @drop="onDayDrop(day, $event)"
                >
                  <span class="plan-axis-week">{{ day.isToday ? '今' : day.weekday }}</span>
                  <span class="plan-axis-date">{{ day.date }}</span>
                  <i v-if="day.count" class="plan-axis-dot"></i>
                </button>
              </div>
            </div>
            <button v-if="!todayInWindow" type="button" class="plan-axis-back" @click="resetAxis">回今天</button>
          </div>
        </div>

        <div v-if="listItems.length" class="plan-scrollbox">
          <ol ref="planList" class="plan-list" tabindex="0" aria-label="今日计划列表，可滚动" @scroll.passive="syncRail">
            <template v-for="(item, index) in listItems" :key="item.key">
              <!-- 每个分组的第一条计划上面插一行日期标题，不占刻度条。 -->
              <li v-if="groupHead(item)" class="plan-day-head" :data-day="groupHead(item).key">
                <span class="plan-day-label">{{ groupHead(item).label }}</span>
                <span class="plan-day-meta">{{ groupHead(item).meta }}</span>
              </li>
              <li
                class="plan-row"
                :class="{ 'is-done': item.done, 'is-clickable': !item.done, 'is-highlighted': highlightId === item.plan.id, 'is-dragging': draggingId === item.plan.id }"
                :data-plan-id="item.plan.id"
                :draggable="!item.done"
                @dragstart="onRowDragStart(item, $event)"
                @dragend="onRowDragEnd"
                @click="onRowClick(item, $event)"
              >
                <button type="button" class="plan-tick" role="checkbox" :aria-checked="item.done ? 'true' : 'false'" :aria-label="(item.done ? '取消完成：' : '标记完成：') + planTitle(item.plan)" @click="completePlan(item.plan)">
                  <svg viewBox="0 0 18 18" aria-hidden="true"><path d="M4.6 9.4 L7.7 12.4 L13.5 5.7" /></svg>
                </button>
                <div class="plan-main">
                  <p class="plan-title">
                    <strong :title="planTitle(item.plan)" v-html="formatMathText(planTitle(item.plan))"></strong>
                    <span v-if="item.plan.priority === '高'" class="plan-chip">最费脑</span>
                    <span v-if="!item.done && planTaskBadge(item.plan)" class="plan-chip recite">{{ planTaskBadge(item.plan) }}</span>
                    <span v-if="!item.done && item.carried" class="plan-chip move">昨天未完成</span>
                  </p>
                  <p class="plan-sub">{{ rowMeta(item) }}</p>
                </div>
                <div class="plan-actions">
                  <span v-if="!item.done" class="plan-enter" aria-hidden="true"></span>
                  <el-dropdown trigger="click" @command="command => onPlanCommand(command, item.plan)">
                    <button type="button" class="plan-more" aria-label="更多操作">⋯</button>
                    <template #dropdown>
                      <el-dropdown-menu>
                        <template v-if="item.done">
                          <el-dropdown-item command="archive">恢复为进行中</el-dropdown-item>
                          <el-dropdown-item command="edit">编辑</el-dropdown-item>
                          <el-dropdown-item divided command="remove">删除</el-dropdown-item>
                        </template>
                        <template v-else>
                          <el-dropdown-item command="remind">{{ item.plan.remindAt ? '改提醒' : '设提醒' }}</el-dropdown-item>
                          <el-dropdown-item command="edit">编辑</el-dropdown-item>
                          <el-dropdown-item command="replace" :disabled="replacing === item.plan.id">AI 换一个</el-dropdown-item>
                          <el-dropdown-item command="ask">问 AI 讲这个任务</el-dropdown-item>
                          <el-dropdown-item command="lock">{{ item.plan.locked ? '解锁' : '锁定' }}</el-dropdown-item>
                          <el-dropdown-item command="up" :disabled="!canMove(item.plan, -1)">上移</el-dropdown-item>
                          <el-dropdown-item command="down" :disabled="!canMove(item.plan, 1)">下移</el-dropdown-item>
                          <el-dropdown-item divided command="archive">完成并归档</el-dropdown-item>
                          <el-dropdown-item command="remove">删除</el-dropdown-item>
                        </template>
                      </el-dropdown-menu>
                    </template>
                  </el-dropdown>
                </div>
              </li>
            </template>
          </ol>
          <!-- 刻度滚动条：一条刻度对一个计划；鼠标移上去向左展开计划清单，点名字直接跳到那一行。 -->
          <div class="plan-rail-zone" @mouseenter="openRail" @mouseleave="closeRail">
            <div class="plan-rail" aria-hidden="true">
              <button
                v-for="(item, index) in listItems"
                :key="'rail-' + item.key"
                type="button"
                class="plan-rail-mark"
                :class="{ active: index === railIndex }"
                :style="{ top: railTop(index) + 'px' }"
                tabindex="-1"
                :title="planTitle(item.plan)"
                @click="jumpToRow(index)"
              ></button>
            </div>
            <transition name="rail-pop">
              <div v-if="railOpen" class="rail-panel">
                <div ref="railPanelList" class="rail-panel-list">
                  <button
                    v-for="(item, index) in listItems"
                    :key="'rail-row-' + item.key"
                    type="button"
                    class="rail-panel-row"
                    :class="{ active: index === railIndex, done: item.done }"
                    :title="planTitle(item.plan)"
                    @click="jumpFromRail(index)"
                  >
                    <span class="rail-row-text">{{ planTitle(item.plan) }}</span>
                    <i class="rail-row-mark"></i>
                  </button>
                </div>
              </div>
            </transition>
          </div>
        </div>

        <div v-else class="plan-empty">
          <p>{{ plans.length ? '还没有排进今天的计划' : '今天还没有计划' }}</p>
          <button type="button" class="plan-empty-cta" @click="openCreatePlan()">新建计划</button>
        </div>
      </section>

      <aside class="plan-side">
        <section class="side-card">
          <div class="side-head"><h3>本周</h3><span>还剩 {{ daysLeft }} 天</span></div>
          <div class="week-big"><strong>{{ weekCompleted }}</strong><span>/{{ weekTotal }}</span><small>项</small></div>
          <span class="week-bar"><i :style="{ width: Math.max(weekPercent, 2) + '%' }"></i></span>
          <p class="week-note">{{ weekNote }}</p>
        </section>

        <section class="side-card">
          <div class="side-head"><h3>时间花在哪</h3><span v-if="weekFocus.total">近 7 天 {{ (weekFocus.total / 60).toFixed(1) }} 小时</span></div>
          <template v-if="weekFocus.total">
            <div class="split-bar"><i v-for="(row, index) in weekFocus.rows" :key="row.name" :style="{ width: row.percent + '%', background: FOCUS_COLORS[index % FOCUS_COLORS.length] }"></i></div>
            <div class="split-rows">
              <div v-for="row in weekFocus.rows" :key="row.name" class="split-row"><span>{{ row.name }}</span><b>{{ (row.minutes / 60).toFixed(1) }}h</b></div>
            </div>
          </template>
          <p v-else class="side-empty">还没有专注记录，开始第一项后这里会显示时间分布</p>
          <p v-if="missingSubjects.length" class="side-warn">{{ missingSubjects.join('、') }}这周还没排</p>
        </section>
        <section class="truth-card">
          <h3>这周的你</h3>
          <p>{{ insight }}</p>
        </section>
      </aside>
    </div>

    <el-dialog v-model="editVisible" title="编辑学习任务" width="500px">
      <el-form v-if="editing" label-position="top">
        <el-form-item label="任务名称"><el-input v-model="editing.name" maxlength="80" show-word-limit /></el-form-item>
        <el-form-item label="科目"><el-select v-model="editing.subject" style="width:100%"><el-option v-for="subject in SUBJECT_OPTIONS" :key="subject" :value="subject" :label="subject" /></el-select></el-form-item>
        <div class="grid-2">
          <el-form-item label="预计时长（分钟）"><el-input-number v-model="editing.estimatedMinutes" :min="5" :max="180" /></el-form-item>
          <el-form-item label="优先级"><el-select v-model="editing.priority"><el-option v-for="priority in ['高','中','低']" :key="priority" :value="priority" :label="priority" /></el-select></el-form-item>
        </div>
        <el-form-item label="开始时间"><el-date-picker v-model="editing.startAt" type="datetime" value-format="YYYY-MM-DDTHH:mm" placeholder="留空表示立即可做" style="width:100%" /></el-form-item>
        <el-form-item label="下次复习时间"><el-date-picker v-model="editing.reviewAt" type="datetime" value-format="YYYY-MM-DDTHH:mm" placeholder="选择日期和时间" style="width:100%" /></el-form-item>
        <el-form-item label="知识点标签"><el-input v-model="editing.knowledgeTagsText" placeholder="多个标签用逗号分隔" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="editVisible = false">取消</el-button><el-button type="primary" @click="submitEdit">保存</el-button></template>
    </el-dialog>

    <el-dialog v-model="createVisible" title="新建学习计划" width="500px">
      <el-form v-if="draftPlan" label-position="top">
        <el-form-item label="计划名称"><el-input v-model="draftPlan.name" maxlength="80" show-word-limit placeholder="例如：二次函数专项练习" /></el-form-item>
        <el-form-item label="科目"><el-select v-model="draftPlan.subject" style="width:100%"><el-option v-for="subject in SUBJECT_OPTIONS" :key="subject" :value="subject" :label="subject" /></el-select></el-form-item>
        <div class="grid-2">
          <el-form-item label="预计时长（分钟）"><el-input-number v-model="draftPlan.estimatedMinutes" :min="5" :max="180" /></el-form-item>
          <el-form-item label="优先级"><el-select v-model="draftPlan.priority"><el-option v-for="priority in ['高','中','低']" :key="priority" :value="priority" :label="priority" /></el-select></el-form-item>
        </div>
        <el-form-item label="什么时候开始"><el-date-picker v-model="draftPlan.startAt" type="datetime" value-format="YYYY-MM-DDTHH:mm" placeholder="选择开始日期和时间" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="createVisible = false">取消</el-button><el-button type="primary" @click="submitCreatePlan">创建计划</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 学习计划页：按设计稿的青绿纸感重排，颜色只在本页覆盖，不污染全局主题。 */
.plan-page{padding-bottom:32px;--plan-deep:#2f5c57;--plan-deep-2:#254842;--plan-cta-text:#fff;--plan-mint:#e8f1ed;--plan-mint-strong:#cbded9;--plan-ink:#22322f;--plan-muted:#5f736e;--plan-faint:#9baca5;--plan-done:#cfdcd6;--plan-line:#e5ede9;--plan-soft:#f6faf8;--plan-card:#fff;--plan-cream:#f2f0e8;--plan-warn:#a8744a;color:var(--plan-ink)}
:global(:root[data-theme='dark'] .plan-page){--plan-deep:#7fb5ab;--plan-deep-2:#9cc8bf;--plan-cta-text:#10231f;--plan-mint:#24423c;--plan-mint-strong:#35605c;--plan-ink:#e6f0ec;--plan-muted:#a3b8b2;--plan-faint:#7f938e;--plan-done:#3f5f57;--plan-line:#2f4741;--plan-soft:#172724;--plan-card:#1b2d29;--plan-cream:#2f2b22;--plan-warn:#d3ab7f}
.plan-hero{display:flex;align-items:flex-start;justify-content:space-between;gap:24px;margin:0 0 22px}
.hero-title{margin:10px 0 0;font-size:clamp(25px,3vw,33px);line-height:1.3;font-weight:600;letter-spacing:-.02em;color:var(--plan-ink)}
.hero-actions{display:flex;align-items:center;gap:10px;flex:none;padding-top:4px}
.hero-ghost{min-height:44px;padding:0 20px;border:1px solid var(--plan-line);border-radius:999px;background:var(--plan-card);color:var(--plan-deep);font-family:inherit;font-size:calc(14px*var(--fs-scale));font-weight:700;cursor:pointer;transition:background .18s ease,border-color .18s ease,transform .18s ease}
.hero-ghost:hover{border-color:var(--plan-deep);background:var(--plan-soft);transform:translateY(-1px)}
.hero-ghost:focus-visible{outline:3px solid rgba(47,93,80,.32);outline-offset:2px}
/* 科目胶囊：选中是深绿实底，其余白底细边框，计数比科目淡一档。 */
.filter-bar{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:18px;flex-wrap:wrap}
.subject-pills{display:flex;gap:8px;flex-wrap:wrap}
.subject-pill{display:inline-flex;align-items:center;gap:7px;min-height:36px;padding:0 17px;border:1px solid var(--plan-line);border-radius:999px;background:var(--plan-card);color:var(--plan-ink);font-family:inherit;font-size:calc(12.5px*var(--fs-scale));font-weight:650;cursor:pointer;transition:background .18s ease,border-color .18s ease,color .18s ease}
.subject-pill span{color:var(--plan-muted);font-weight:600}
.subject-pill:hover{border-color:var(--plan-mint-strong);background:var(--plan-soft)}
.subject-pill.active{border-color:var(--plan-deep);background:var(--plan-deep);color:var(--plan-cta-text)}
.subject-pill.active span{color:rgba(255,255,255,.72)}
.subject-pill:focus-visible{outline:3px solid rgba(47,93,80,.25);outline-offset:2px}
/* === 今日计划：已完成在上、待做在下，打开时停在第一条待做 === */
.plan-wheel{position:relative;padding:18px 22px 24px;border:1px solid var(--plan-line);border-radius:22px;background:var(--plan-card)}
.plan-list-head{display:flex;align-items:center;justify-content:space-between;gap:14px;min-height:16px;margin-bottom:6px}
.plan-count{font-size:calc(11px*var(--fs-scale));font-weight:600;line-height:16px;color:var(--plan-muted);font-variant-numeric:tabular-nums}
.plan-count b{font-weight:700;color:var(--plan-ink)}
/* 日期轴：整月一条横轨，窗口只露 7 格，滚轮把它左右推。 */
/* 右侧预留 58px 给「回今天」，用绝对定位压在预留位里，按钮出现/消失都不会把日期轴推走。 */
.plan-axis-wrap{position:relative;display:flex;align-items:center;flex:none;padding-right:62px}
/* 7 格窗口：7×34 + 6×4 = 262，改格子宽度要同步 JS 里的 AXIS_STEP 和这里。 */
.plan-axis-window{width:262px;flex:none;overflow:hidden}
.plan-axis-track{display:flex;gap:4px;transition:transform .24s cubic-bezier(.4,0,.2,1);will-change:transform}
.plan-axis-cell{position:relative;display:grid;place-items:center;gap:2px;flex:none;width:34px;height:42px;padding:4px 0 7px;border:1px solid transparent;border-radius:9px;background:transparent;color:var(--plan-muted);font-family:inherit;cursor:pointer;transition:background .16s ease,border-color .16s ease,color .16s ease}
.plan-axis-cell:hover:not(.is-past){border-color:var(--plan-mint-strong);background:var(--plan-soft);color:var(--plan-ink)}
.plan-axis-cell:focus-visible{outline:2px solid rgba(47,93,80,.32);outline-offset:-2px}
.plan-axis-cell.is-today{border-color:var(--plan-deep);background:var(--plan-deep);color:var(--plan-cta-text)}
/* 空白的那天可以点开新建，所以只是淡；已经过去的日子不能点，压得再暗一档。 */
.plan-axis-cell.is-empty{opacity:.5}
.plan-axis-cell.is-empty:hover:not(.is-past){opacity:.95}
.plan-axis-cell.is-past{opacity:.45;cursor:default}
.plan-axis-cell.is-drop{border-color:var(--plan-deep);background:var(--plan-mint);color:var(--plan-deep);opacity:1}
.plan-axis-week{font-size:calc(10px*var(--fs-scale));line-height:1;letter-spacing:.02em}
.plan-axis-date{font-size:calc(13px*var(--fs-scale));font-weight:650;line-height:1;font-variant-numeric:tabular-nums}
.plan-axis-dot{position:absolute;bottom:4px;width:3px;height:3px;border-radius:50%;background:currentColor;opacity:.55}
.plan-axis-cell.is-today .plan-axis-dot{opacity:.9}
/* 滚远了、今天不在窗口里时，右侧给一个回今天的入口。 */
.plan-axis-back{position:absolute;right:0;top:50%;transform:translateY(-50%);padding:3px 8px;border:1px solid var(--plan-line);border-radius:999px;background:var(--plan-card);color:var(--plan-muted);font-family:inherit;font-size:calc(10.5px*var(--fs-scale));font-weight:600;cursor:pointer;transition:border-color .16s ease,color .16s ease,opacity .16s ease}
.plan-axis-back:hover{border-color:var(--plan-mint-strong);color:var(--plan-deep)}
/* 分组标题：只在每天的第一条计划上面出现一行，不参与勾选和刻度计数。 */
.plan-day-head{display:flex;align-items:baseline;gap:8px;padding:16px 0 5px;margin:0;list-style:none}
.plan-day-head:first-child{padding-top:2px}
.plan-day-label{font-size:calc(12px*var(--fs-scale));font-weight:700;letter-spacing:.01em;color:var(--plan-deep)}
.plan-day-meta{font-size:calc(10.5px*var(--fs-scale));font-weight:600;color:var(--plan-faint);font-variant-numeric:tabular-nums}
/* 列表自己滚；原生滚动条隐藏，右侧刻度列负责显示位置。 */
.plan-scrollbox{position:relative}
.plan-list{margin:0 -6px 0 0;padding:0 18px 4px 0;list-style:none;max-height:clamp(240px,calc(100vh - 414px),720px);overflow-y:auto;overscroll-behavior:contain;touch-action:pan-y;-webkit-overflow-scrolling:touch;contain:paint;will-change:scroll-position;scrollbar-width:none}
/* 原生滚动条整条隐藏，位置交给右侧刻度列；滚轮、触控板、拖拽、键盘都还在。 */
.plan-list::-webkit-scrollbar{width:0;height:0}
.plan-list:focus-visible{outline:3px solid rgba(47,93,80,.25);outline-offset:4px;border-radius:10px}
/* 右侧刻度：一条刻度 = 一个计划，等距排列并整列居中；加深那条 = 当前滚到的那一行。 */
/* 悬浮热区：刻度本体只有 14px 宽，鼠标不好命中；列表右边缘那段留白整段都算命中区。 */
.plan-rail-zone{position:absolute;right:-5px;top:0;bottom:0;width:18px;z-index:3}
.plan-rail{position:absolute;right:0;top:0;bottom:0;width:14px;pointer-events:none}
.plan-rail-mark{position:absolute;right:0;width:7px;height:2px;padding:0;border:0;border-radius:1px;background:rgba(47,93,80,.4);background:color-mix(in srgb,var(--plan-deep) 40%,transparent);cursor:pointer;pointer-events:auto;transition:width .16s ease,height .16s ease,background .16s ease}
.plan-rail-zone:hover .plan-rail-mark{background:rgba(47,93,80,.55);background:color-mix(in srgb,var(--plan-deep) 55%,transparent)}
.plan-rail-mark:hover{width:9px;background:var(--plan-deep)}
.plan-rail-mark.active{width:12px;height:3px;background:var(--plan-deep)}
/* 展开的计划清单：贴刻度列左侧，宽度够放一行标题，右侧那截短线就是这条刻度。 */
.rail-panel{position:absolute;right:16px;top:50%;transform:translateY(-50%);display:flex;flex-direction:column;width:288px;max-height:calc(100% - 16px);padding:7px 6px;border:1px solid var(--plan-line);border-radius:14px;background:var(--plan-card);box-shadow:0 20px 46px -20px rgba(20,52,44,.3),0 2px 8px rgba(20,52,44,.05)}
/* min-height:0 让清单在 max-height 到顶时能真正收缩并自己滚，而不是把浮层撑出边界。 */
.rail-panel-list{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain}
.rail-panel-list::-webkit-scrollbar{width:4px}
.rail-panel-list::-webkit-scrollbar-thumb{border-radius:2px;background:color-mix(in srgb,var(--plan-deep) 22%,transparent)}
.rail-panel-row{display:flex;align-items:center;gap:10px;width:100%;height:30px;padding:0 9px 0 11px;border:0;border-radius:8px;background:none;color:color-mix(in srgb,var(--plan-ink) 52%,transparent);font-family:inherit;font-size:calc(13px*var(--fs-scale));text-align:right;cursor:pointer;transition:background .14s ease,color .14s ease}
.rail-row-text{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;text-align:right}
.rail-row-mark{flex:0 0 auto;width:7px;height:2px;border-radius:1px;background:currentColor;opacity:.7;transition:width .14s ease,opacity .14s ease}
.rail-panel-row.done .rail-row-text{opacity:.6}
.rail-panel-row:hover{background:color-mix(in srgb,var(--plan-mint) 46%,transparent);color:var(--plan-ink)}
.rail-panel-row:hover .rail-row-mark{width:10px;opacity:.85}
.rail-panel-row.active{color:var(--plan-ink);font-weight:650}
.rail-panel-row.active .rail-row-mark{width:17px;height:2.5px;opacity:1}
.rail-pop-enter-active,.rail-pop-leave-active{transition:opacity .16s ease,transform .16s ease}
.rail-pop-enter-from,.rail-pop-leave-to{opacity:0;transform:translate(7px,-50%)}
:global(:root[data-theme='dark'] .plan-list::-webkit-scrollbar-thumb){background:rgba(163,205,196,.42);background-clip:content-box}
.plan-list:focus-visible{outline:3px solid rgba(47,93,80,.25);outline-offset:4px;border-radius:10px}
.plan-row{display:grid;grid-template-columns:40px 18px minmax(0,1fr) auto;align-items:start;padding:14px 0 17px}
/* 拖到日期轴上的那行虚一下，明确「正在被搬走」。 */
.plan-row.is-dragging{opacity:.4}
.plan-row + .plan-row{border-top:1px solid var(--plan-line)}
.plan-tick{position:relative;grid-column:2;display:grid;place-items:center;width:18px;height:18px;margin-top:1.5px;padding:0;border:1.5px solid var(--plan-mint-strong);border-radius:50%;background:transparent;cursor:pointer;transition:background .18s ease,border-color .18s ease}
.plan-tick::after{content:'';position:absolute;inset:-10px;border-radius:50%}
.plan-tick:hover{border-color:var(--plan-deep)}
.plan-tick:focus-visible{outline:3px solid rgba(47,93,80,.3);outline-offset:2px}
.plan-tick svg{display:block;width:15px;height:15px;opacity:0;transform:scale(.6);transition:opacity .18s ease,transform .18s ease}
.plan-tick path{fill:none;stroke:#fff;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.plan-row.is-done .plan-tick{background:var(--plan-done);border-color:var(--plan-done)}
.plan-row.is-done .plan-tick svg{opacity:1;transform:scale(1)}
.plan-main{grid-column:3;min-width:0;padding-left:13px}
.plan-title{display:flex;align-items:center;gap:8px;min-width:0;margin:0}
.plan-title strong{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(15px*var(--fs-scale));font-weight:800;line-height:21px;letter-spacing:-.005em;color:var(--plan-ink);-webkit-text-stroke:.28px currentColor}
.plan-row.is-done .plan-title strong{color:var(--plan-faint);font-weight:500}
.plan-chip{flex:none;padding:1px 6px;border-radius:6px;background:var(--plan-mint);color:var(--plan-deep);font-size:calc(10.5px*var(--fs-scale));font-weight:700;line-height:16px;white-space:nowrap}
.plan-chip.move{background:var(--plan-cream);color:var(--plan-warn)}
/* 背诵类任务的标记：不填色，避免和优先级、顺延标签抢注意力。 */
.plan-chip.recite{border:1px solid var(--plan-mint-strong);background:transparent;color:var(--plan-deep);font-weight:600}
.plan-sub{margin:4px 0 0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(12.5px*var(--fs-scale));line-height:18px;color:var(--plan-muted);font-variant-numeric:tabular-nums}
.plan-row.is-done .plan-sub{color:var(--plan-faint)}
.plan-actions{grid-column:4;display:flex;align-items:center;gap:6px;padding-left:10px}
/* 整行都能点进专注：悬停时从左往右铺一层极淡的青绿，提示这一条可以直接进去做。 */
.plan-row.is-clickable{cursor:pointer}
.plan-row.is-clickable:hover{background:linear-gradient(90deg,color-mix(in srgb,var(--plan-mint) 62%,transparent),transparent 68%)}
.plan-row.is-clickable:hover .plan-title strong{color:var(--plan-deep);font-weight:900;-webkit-text-stroke:.45px currentColor}
/* 一个指甲盖大的右箭头：悬停才浮出来，说明这行能直接点进去。 */
.plan-enter{flex:none;width:7px;height:7px;margin-right:2px;border-right:1.6px solid var(--plan-deep);border-bottom:1.6px solid var(--plan-deep);transform:rotate(-45deg);opacity:0;transition:opacity .16s ease}
.plan-row.is-clickable:hover .plan-enter{opacity:.55}
.plan-more{display:grid;place-items:center;width:26px;height:26px;border:0;border-radius:8px;background:none;color:var(--plan-muted);font-family:inherit;font-size:calc(16px*var(--fs-scale));line-height:1;cursor:pointer;opacity:0;transition:background .18s ease,color .18s ease}
.plan-row:hover .plan-more,.plan-row:focus-within .plan-more{opacity:1}
@media (hover:none){.plan-more{opacity:1}}
.plan-more:hover{background:var(--plan-soft);color:var(--plan-deep)}
.plan-more:focus-visible{opacity:1;outline:2px solid rgba(47,93,80,.4);outline-offset:1px}
.plan-list::after{content:'';display:block;height:1px;margin-top:15px;background:var(--plan-line)}
.plan-empty{display:grid;justify-items:center;gap:14px;padding:46px 0 34px}
.plan-empty p{margin:0;font-size:calc(13px*var(--fs-scale));color:var(--plan-muted)}
.plan-empty-cta{min-height:38px;padding:0 18px;border:1px solid var(--plan-line);border-radius:999px;background:var(--plan-card);color:var(--plan-deep);font-family:inherit;font-size:calc(12.5px*var(--fs-scale));font-weight:700;cursor:pointer;transition:background .18s ease,border-color .18s ease}
.plan-empty-cta:hover{border-color:var(--plan-deep);background:var(--plan-soft)}
.plan-empty-cta:focus-visible{outline:3px solid rgba(47,93,80,.3);outline-offset:2px}
.plan-columns{display:grid;grid-template-columns:minmax(0,1.55fr) minmax(290px,1fr);gap:18px;align-items:start;margin-bottom:18px}
.plan-side{display:grid;gap:16px;align-content:start}
.side-card{padding:20px 22px;border:1px solid var(--plan-line);border-radius:22px;background:var(--plan-card)}
.side-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px}
.side-head h3{margin:0;font-size:calc(14.5px*var(--fs-scale));font-weight:750;color:var(--plan-ink)}
.side-head span{font-size:calc(11.5px*var(--fs-scale));color:var(--plan-muted);white-space:nowrap}
.week-big{display:flex;align-items:baseline;gap:0;margin:18px 0 12px}
.week-big strong{font-size:calc(30px*var(--fs-scale));line-height:1;font-weight:800;letter-spacing:-.02em;color:var(--plan-ink)}
.week-big span{margin-left:-1px;font-size:calc(17px*var(--fs-scale));font-weight:700;color:var(--plan-muted)}
.week-big small{margin-left:2px;font-size:calc(11.5px*var(--fs-scale));color:var(--plan-muted)}
.week-bar{display:block;height:6px;border-radius:999px;background:var(--plan-line);overflow:hidden}
.week-bar i{display:block;height:100%;border-radius:inherit;background:var(--plan-deep);transition:width .4s ease}
.week-note{margin:14px 0 0;font-size:calc(11.5px*var(--fs-scale));line-height:1.6;color:var(--plan-muted)}
.split-bar{display:flex;height:7px;border-radius:999px;overflow:hidden;background:var(--plan-line);margin-top:16px}
.split-bar i{display:block;min-width:2px;height:100%}
.split-rows{display:grid;gap:10px;margin-top:16px}
.split-row{display:flex;align-items:baseline;justify-content:space-between;gap:10px;font-size:calc(12.5px*var(--fs-scale));color:var(--plan-ink)}
.split-row b{font-weight:650;color:var(--plan-muted);font-variant-numeric:tabular-nums}
.side-empty{margin:10px 0 0;font-size:calc(11.5px*var(--fs-scale));line-height:1.65;color:var(--plan-muted)}
.side-warn{margin:14px 0 0;color:var(--plan-warn);font-size:calc(12px*var(--fs-scale));line-height:1.6}
.truth-card{padding:20px 22px;border:1px solid var(--plan-mint-strong);border-radius:18px;background:var(--plan-mint)}
.truth-card h3{margin:0;font-size:calc(11.5px*var(--fs-scale));font-weight:600;color:var(--plan-deep);letter-spacing:.12em}
.truth-card p{margin:10px 0 0;font-size:calc(13px*var(--fs-scale));line-height:1.8;color:var(--plan-ink)}
@media(max-width:1100px){.plan-columns{grid-template-columns:minmax(0,1fr) 300px}}
@media(max-width:980px){.plan-columns{grid-template-columns:1fr}.plan-side{grid-template-columns:1fr 1fr}.truth-card{grid-column:1/-1}}
@media(max-width:760px){.plan-hero{flex-direction:column;align-items:flex-start;gap:14px}.hero-actions{width:100%}.hero-ghost{width:100%}.filter-bar{margin-bottom:14px}.subject-pills{flex-wrap:nowrap;overflow-x:auto;width:100%;padding-bottom:4px;scrollbar-width:none}.subject-pills::-webkit-scrollbar{display:none}.subject-pill{flex:none}.plan-wheel{padding:14px 14px 18px;border-radius:18px}.plan-list{max-height:clamp(220px,calc(100vh - 460px),520px)}.plan-row{grid-template-columns:32px 18px minmax(0,1fr) auto;padding:13px 0 15px}.plan-title{flex-wrap:wrap;align-items:flex-start}.plan-title strong{display:-webkit-box;-webkit-box-orient:vertical;-webkit-line-clamp:2;white-space:normal;overflow:hidden;font-size:calc(14px*var(--fs-scale));line-height:19px}.plan-sub{font-size:calc(11.5px*var(--fs-scale))}.plan-more{opacity:1}.plan-side{grid-template-columns:1fr}.truth-card{grid-column:auto}}
@media (prefers-reduced-motion: reduce){.hero-ghost{transition:none}.week-bar i{transition:none}.plan-tick,.plan-tick svg,.plan-more{transition:none}}
:deep(sub){font-size:.7em;line-height:0;vertical-align:sub}
/* 从通知点进来、或刚新建完时给目标任务一圈高亮，2.8 秒后自动淡出。 */
.plan-row.is-highlighted{box-shadow:inset 0 0 0 2px var(--plan-deep);animation:planGlow 1.4s ease-in-out 2}
/* 选中态要一眼看出来：比未完成再深一档、字重更重。 */
.plan-row.is-highlighted .plan-title strong{color:var(--plan-deep);font-weight:900;-webkit-text-stroke:.45px currentColor}
@keyframes planGlow{50%{box-shadow:inset 0 0 0 2px var(--plan-deep),0 0 0 6px rgba(47,93,80,.16)}}
@media (prefers-reduced-motion: reduce){.plan-row.is-highlighted{animation:none}}
</style>
