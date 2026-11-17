<script setup>
import { computed, nextTick, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import ChartPanel from '../components/ChartPanel.vue'
import { examAverageRate as examAverageRateOf, examSessionRows, learningSuggestions, quizAccuracyOf, subjectAccuracyRows, wrongChapterRows as wrongChapterRowsOf } from '../utils/learningStats.js'
import { distractionBreakdown, focusStreak, habitAdvice, hourBuckets, peakWindow, weekComparison } from '../utils/focusHabits.js'
import { buildWeeklyPlanTasks, weekKeyOf } from '../utils/weeklyReportPlans.js'
import { getDataOwner, loadDistractions, loadExamScores, loadFeedbacks, loadFocusSessions, loadMistakes, loadPlans, loadQuizResults, loadVisualLogs, savePlan } from '../db/index.js'
import { generateWeeklyReport } from '../services/api.js'
import { useAppStore } from '../stores/app.js'

const router = useRouter()
const route = useRoute()
const store = useAppStore()

// 图表色统一到全局色板：ECharts 画在 canvas 上读不到 CSS 变量，这里和 styles.css 用同一组色值。
// 青绿=完成/专注，靛蓝=科目对比，琥珀=考试/峰值，珊瑚=风险——不再让所有系列共用一支旧青绿。
const CHART = {
  primary: '#0e7b6b',
  primaryLight: '#86c5b9',
  primaryFaint: '#cfe9e2',
  blue: '#3d6ed4',
  accent: '#d9853f',
  danger: '#d4554a',
  area: 'rgba(14,123,107,.15)'
}

const range = ref(30)
const sessions = ref([])
const feedbacks = ref([])
const distractions = ref([])
const visualLogs = ref([])
const plans = ref([])
const quizResults = ref([])
const mistakes = ref([])
const examScores = ref([])
const rangeStart = computed(() => Date.now() - range.value * 86400000)

// 统一按选择的时间窗口筛选本地记录，让顶部指标和图表口径保持一致。
const filteredSessions = computed(() => sessions.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const filteredDistractions = computed(() => distractions.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const filteredVisualLogs = computed(() => visualLogs.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const filteredFeedbacks = computed(() => feedbacks.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const filteredQuizResults = computed(() => quizResults.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const filteredMistakes = computed(() => mistakes.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
// 考试成绩同时有考试日期 date 和录入时间 createdAt，优先按考试日期过滤。
const filteredExamScores = computed(() => examScores.value.filter(item => (item.date || item.createdAt || 0) >= rangeStart.value))
const latestFeedbacks = computed(() => [...filteredFeedbacks.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
const totalMinutes = computed(() => Math.round(filteredSessions.value.reduce((sum, item) => sum + (item.actualSeconds || 0), 0) / 60))
const completionRate = computed(() => filteredSessions.value.length
  ? Math.round(filteredSessions.value.filter(item => item.completed).length / filteredSessions.value.length * 100) : 0)

// 今日青柠：按 25 分钟折算，和专注页同一口径；这里只看今天，不受时间窗筛选影响。
const todayLime = computed(() => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  const seconds = sessions.value
    .filter(item => (Number(item.createdAt) || 0) >= start.getTime())
    .reduce((sum, item) => sum + (Number(item.actualSeconds) || 0), 0)
  return { count: Math.floor(seconds / 60 / 25), minutes: Math.round(seconds / 60) }
})

function shortDate(value) {
  const date = new Date(Number(value) || 0)
  return `${date.getMonth() + 1}/${date.getDate()}`
}

// === 学习效果：测试正确率、错题章节、学校考试成绩 ===
const modeLabels = { daily: '日常测试', weekly: '周测', paper: '综合整卷', scan: '扫描练习' }

// 按题量加权，避免 3 题小测和 25 题整卷按同等权重拉平正确率。
const quizAccuracy = computed(() => quizAccuracyOf(filteredQuizResults.value))

const subjectRows = computed(() => subjectAccuracyRows(filteredQuizResults.value))

const wrongChapterRows = computed(() => wrongChapterRowsOf(filteredMistakes.value))

const examSessions = computed(() => examSessionRows(filteredExamScores.value))

const examAverageRate = computed(() => examAverageRateOf(examSessions.value))

const coveredChapters = computed(() => new Set([
  ...filteredQuizResults.value.flatMap(item => item.chapterIds || []),
  ...filteredMistakes.value.map(item => item.chapterId).filter(Boolean)
]).size)

// 规则化建议：只基于本地数据，不额外调用模型，保证看板随时可用。
const suggestions = computed(() => learningSuggestions({
  results: filteredQuizResults.value,
  mistakes: filteredMistakes.value,
  examSessions: examSessions.value,
  accuracy: quizAccuracy.value
}))

const quizTrendOption = computed(() => {
  const list = [...filteredQuizResults.value].sort((left, right) => (left.createdAt || 0) - (right.createdAt || 0))
  return {
    tooltip: { trigger: 'axis', formatter: params => {
      const item = list[params[0]?.dataIndex]
      if (!item) return ''
      return `<b>${item.subject || '测试'} · ${modeLabels[item.mode] || '章节测试'}</b><br/>${shortDate(item.createdAt)}<br/>正确率：${Math.round((Number(item.accuracy) || 0) * 100)}%<br/>得分：${item.score ?? 0} / ${item.maxScore ?? 0}`
    } },
    grid: { left: 42, right: 20, top: 25, bottom: 25 },
    xAxis: { type: 'category', data: list.map(item => shortDate(item.createdAt)) },
    yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
    series: [{
      type: 'line', smooth: true, showSymbol: true, symbolSize: 7,
      data: list.map(item => Math.round((Number(item.accuracy) || 0) * 100)),
      lineStyle: { color: CHART.primary, width: 2.5 }, itemStyle: { color: CHART.primary },
      areaStyle: { color: CHART.area }
    }]
  }
})

const subjectOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => {
    const row = subjectRows.value[params[0]?.dataIndex]
    return row ? `<b>${row.subject}</b><br/>加权正确率：${row.accuracy}%<br/>测试 ${row.tests} 次 · ${row.questions} 题` : ''
  } },
  grid: { left: 74, right: 34, top: 12, bottom: 24 },
  xAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
  yAxis: { type: 'category', data: subjectRows.value.map(row => row.subject) },
  series: [{
    type: 'bar', barWidth: 18, data: subjectRows.value.map(row => row.accuracy),
    itemStyle: { color: CHART.blue, borderRadius: [0, 8, 8, 0] },
    label: { show: true, position: 'right', formatter: '{c}%' }
  }]
}))

const wrongChapterOption = computed(() => ({
  tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => {
    const row = wrongChapterRows.value[params[0]?.dataIndex]
    return row ? `<b>${row.name}</b><br/>${row.subject} · ${row.count} 道错题` : ''
  } },
  grid: { left: 104, right: 34, top: 12, bottom: 24 },
  xAxis: { type: 'value', minInterval: 1 },
  yAxis: { type: 'category', inverse: true, data: wrongChapterRows.value.map(row => row.shortName), axisLabel: { fontSize: 12 } },
  series: [{
    type: 'bar', barWidth: 15, data: wrongChapterRows.value.map(row => row.count),
    itemStyle: { color: CHART.danger, borderRadius: [0, 8, 8, 0] },
    label: { show: true, position: 'right' }
  }]
}))

const examOption = computed(() => ({
  tooltip: { trigger: 'axis', formatter: params => {
    const row = examSessions.value[params[0]?.dataIndex]
    return row ? `<b>${row.name}</b><br/>${shortDate(row.date)}<br/>总分：${row.score} / ${row.full}<br/>得分率：${Math.round(row.score / row.full * 100)}%` : ''
  } },
  grid: { left: 42, right: 20, top: 25, bottom: 25 },
  xAxis: { type: 'category', data: examSessions.value.map(row => row.name.length > 6 ? `${row.name.slice(0, 6)}…` : row.name) },
  yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
  series: [{
    type: 'line', smooth: true, symbolSize: 8,
    data: examSessions.value.map(row => Math.round(row.score / row.full * 100)),
    lineStyle: { color: CHART.accent, width: 2.5 }, itemStyle: { color: CHART.accent }
  }]
}))

// === 专注与习惯：行为数据统一排除演示与误判记录 ===
const realDistractions = computed(() => filteredDistractions.value.filter(item => item.type !== 'demo-away'))
const realVisualLogs = computed(() => filteredVisualLogs.value.filter(item => item.source !== 'demo' && item.status !== 'false-positive'))
const focusStreakDays = computed(() => focusStreak(sessions.value))
const weekStats = computed(() => weekComparison(sessions.value, distractions.value))
const hours = computed(() => hourBuckets(filteredSessions.value, Date.now(), range.value))
const peakHour = computed(() => hours.value.indexOf(Math.max(...hours.value)))
const breakdownRows = computed(() => distractionBreakdown(realDistractions.value, realVisualLogs.value))
const distractionPerSession = computed(() => filteredSessions.value.length
  ? (realDistractions.value.length / filteredSessions.value.length).toFixed(1) : '0.0')
const habitSuggestions = computed(() => habitAdvice({
  sessions: filteredSessions.value,
  distractions: realDistractions.value,
  visualLogs: realVisualLogs.value,
  hours: hours.value,
  streak: focusStreakDays.value,
  week: weekStats.value
}))

// === AI 周报：固定看近 7 天，和顶部范围选择互不影响 ===
const weekWindowStart = computed(() => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return start.getTime() - 6 * 86400000
})
// 缓存按自然周（周一）区分：同一周内重复打开看板直接复用，不重复消耗模型调用。
const weekCacheKey = computed(() => weekKeyOf())
const weekLabel = computed(() => {
  const start = new Date(weekWindowStart.value)
  const end = new Date()
  return `${start.getMonth() + 1}/${start.getDate()} – ${end.getMonth() + 1}/${end.getDate()}`
})
const weekSessions = computed(() => sessions.value.filter(item => (Number(item.createdAt || item.startedAt) || 0) >= weekWindowStart.value))
const weekDistractions = computed(() => distractions.value.filter(item => item.type !== 'demo-away' && (Number(item.createdAt) || 0) >= weekWindowStart.value))
const weekVisualLogs = computed(() => visualLogs.value.filter(item => item.source !== 'demo' && item.status !== 'false-positive' && (Number(item.createdAt) || 0) >= weekWindowStart.value))
const weekQuizResults = computed(() => quizResults.value.filter(item => (Number(item.createdAt) || 0) >= weekWindowStart.value))
const previousWeekQuizResults = computed(() => quizResults.value.filter(item => {
  const timestamp = Number(item.createdAt) || 0
  return timestamp >= weekWindowStart.value - 7 * 86400000 && timestamp < weekWindowStart.value
}))
const weekMistakes = computed(() => mistakes.value.filter(item => (Number(item.createdAt) || 0) >= weekWindowStart.value))
const weekExamScores = computed(() => examScores.value.filter(item => (Number(item.date || item.createdAt) || 0) >= weekWindowStart.value))

// 错题重做：redos 只统计最近 7 天的重做事件，fixed 统计本周消灭的题。
const unresolvedMistakes = computed(() => mistakes.value.filter(item => !item.fixedAt))
const weekRedoEvents = computed(() => mistakes.value.flatMap(item =>
  (item.redoHistory || []).filter(event => Number(event.at) >= weekWindowStart.value)
))
const weekRedoCount = computed(() => weekRedoEvents.value.length)
const weekRedoCorrect = computed(() => weekRedoEvents.value.filter(event => event.correct).length)
const weekFixedMistakes = computed(() => mistakes.value.filter(item => Number(item.fixedAt) >= weekWindowStart.value).length)

// 计划完成率：本周完成的计划 ÷（本周完成 + 当前待完成），桥接复习不计入。
const realPlans = computed(() => plans.value.filter(item => !item.isBridge))
const weekCompletedPlans = computed(() => realPlans.value.filter(item => item.status === 'archived' && Number(item.completedAt) >= weekWindowStart.value))
const activePlans = computed(() => realPlans.value.filter(item => item.status !== 'archived'))
const weeklyPlanRate = computed(() => {
  const done = weekCompletedPlans.value.length
  const total = done + activePlans.value.length
  return total ? Math.round(done / total * 100) : 0
})

// 发给服务端的只有聚合结果，不上传原始记录。
const weeklyPayload = computed(() => {
  const list = weekSessions.value
  const weekHours = hourBuckets(list, Date.now(), 7)
  const peak = peakWindow(weekHours)
  const weekSubjectRows = subjectAccuracyRows(weekQuizResults.value)
  const weakest = weekSubjectRows[0] || null
  const wrongRows = wrongChapterRowsOf(weekMistakes.value, 3)
  const examRows = examSessionRows(weekExamScores.value)
  const latestExam = examRows[examRows.length - 1] || null
  const topDistraction = distractionBreakdown(weekDistractions.value, weekVisualLogs.value).find(row => row.count > 0) || null
  const totalMinutes = Math.round(list.reduce((sum, item) => sum + (Number(item.actualSeconds) || 0), 0) / 60)
  const completed = list.filter(item => item.completed).length
  return {
    weekLabel: weekLabel.value,
    focus: {
      minutes: totalMinutes,
      sessions: list.length,
      completedSessions: completed,
      completionRate: list.length ? Math.round(completed / list.length * 100) : 0,
      activeDays: new Set(list.map(item => new Date(Number(item.createdAt || item.startedAt) || 0).toDateString())).size,
      streakDays: focusStreakDays.value,
      avgMinutesPerSession: list.length ? Math.round(totalMinutes / list.length) : 0,
      deltaPercent: weekStats.value.thisMinutes ? weekStats.value.minutesDeltaPercent : null,
      distractions: weekDistractions.value.length,
      topDistraction: topDistraction ? { label: topDistraction.label, count: topDistraction.count } : null,
      peakWindow: peak.minutes > 0 ? { start: peak.start, end: peak.end } : null
    },
    quiz: {
      tests: weekQuizResults.value.length,
      questions: weekQuizResults.value.reduce((sum, item) => sum + (Number(item.questionCount) || 0), 0),
      accuracy: quizAccuracyOf(weekQuizResults.value),
      previousAccuracy: previousWeekQuizResults.value.length ? quizAccuracyOf(previousWeekQuizResults.value) : null,
      weakestSubject: weakest ? { subject: weakest.subject, accuracy: weakest.accuracy } : null
    },
    mistakes: {
      count: weekMistakes.value.length,
      unresolved: unresolvedMistakes.value.length,
      redos: weekRedoCount.value,
      redoCorrect: weekRedoCorrect.value,
      fixed: weekFixedMistakes.value,
      topChapters: wrongRows.map(row => ({ name: row.name, subject: row.subject, count: row.count }))
    },
    plans: {
      active: activePlans.value.length,
      completedThisWeek: weekCompletedPlans.value.length,
      completionRate: weeklyPlanRate.value
    },
    exams: {
      count: examRows.length,
      averageRate: examAverageRateOf(examRows),
      latest: latestExam ? { name: latestExam.name, rate: Math.round(latestExam.score / latestExam.full * 100) } : null
    }
  }
})

const weeklyReport = ref(null)
// 从通知中心「去生成」进入时，直接滚到周报卡片并短暂高亮。
const weeklySection = ref(null)
const weeklyFocused = ref(false)
function focusWeeklyReport() {
  if (route.query.focus !== 'weekly-report') return
  weeklyFocused.value = true
  nextTick(() => weeklySection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  setTimeout(() => { weeklyFocused.value = false }, 2800)
}
watch(() => route.query.focus, value => { if (value === 'weekly-report') focusWeeklyReport() })
const reportSource = ref('')
// 周报数字一致性校验结果：模型写的数字是否都能在学习数据里对上。
const reportCheck = computed(() => weeklyReport.value?.verification || null)
const reportCheckTitle = computed(() => {
  const check = reportCheck.value
  if (!check) return ''
  if (check.consistent) return `已核对 ${check.checked} 项数字，均与学习数据一致`
  return check.mismatches.map(item => `${item.label}：写成 ${item.reported}，实际 ${item.expected}`).join('\n')
})
const reportGeneratedAt = ref(0)
const reportLoading = ref(false)
const reportCacheKey = computed(() => `ai-teach-weekly-report:${getDataOwner()}:${weekCacheKey.value}`)
const generatedAtText = computed(() => {
  if (!reportGeneratedAt.value) return ''
  const date = new Date(reportGeneratedAt.value)
  return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
})

async function generateReport() {
  if (reportLoading.value) return
  reportLoading.value = true
  try {
    const response = await generateWeeklyReport(weeklyPayload.value)
    if (!response?.success || !response.data) {
      ElMessage.warning(response?.error || '周报生成失败，请稍后重试。')
      return
    }
    weeklyReport.value = response.data
    reportSource.value = response.source || 'deepseek'
    reportGeneratedAt.value = Date.now()
    // 缓存失败不影响展示：隐私模式下 localStorage 可能不可写。
    try {
      localStorage.setItem(reportCacheKey.value, JSON.stringify({
        report: response.data, source: reportSource.value, generatedAt: reportGeneratedAt.value
      }))
    } catch (error) { console.warn('周报缓存写入失败。', error) }
    // 通知 AppShell 收起「本周周报」提醒。
    window.dispatchEvent(new CustomEvent('ai-teach:weekly-report-updated'))
    if (response.source === 'mock') ElMessage.info('模型暂不可用，已按本地规则生成周报。')
  } finally {
    reportLoading.value = false
  }
}

// 一键转下周计划：同一周用固定 id 覆盖写入，重复点击只更新、不产生重复任务。
const convertingPlan = ref(false)
const hasWeeklyPlanTasks = computed(() => plans.value.some(item =>
  item.source === 'weekly-report' && String(item.id).startsWith(`weekly-${weekCacheKey.value}-`)
))

async function convertReportToPlan() {
  if (!weeklyReport.value || convertingPlan.value) return
  const tasks = buildWeeklyPlanTasks({
    report: weeklyReport.value,
    // 优先落到本周最薄弱科目，没有测试数据时用档案里的科目。
    subject: weeklyPayload.value.quiz.weakestSubject?.subject || store.profile?.subject || '',
    weekKey: weekCacheKey.value,
    sequenceStart: plans.value.reduce((max, item) => Math.max(max, Number(item.sequenceOrder) || 0), 0) + 1
  })
  if (!tasks.length) {
    ElMessage.warning('周报里没有可转换的行动建议。')
    return
  }
  convertingPlan.value = true
  try {
    for (const task of tasks) await savePlan(task)
    plans.value = await loadPlans()
    store.setPlans(plans.value)
    ElMessage.success(`已把 ${tasks.length} 条行动加入下周计划。`)
    router.push('/plans')
  } finally {
    convertingPlan.value = false
  }
}

const dayLabels = computed(() => Array.from({ length: range.value }, (_, index) => {
  const date = new Date(Date.now() - (range.value - 1 - index) * 86400000)
  return `${date.getMonth() + 1}/${date.getDate()}`
}))
function sameDay(timestamp, label) {
  const date = new Date(timestamp)
  return `${date.getMonth() + 1}/${date.getDate()}` === label
}

const focusOption = computed(() => ({
  tooltip: { trigger: 'axis' }, grid: { left: 40, right: 20, top: 25, bottom: 25 },
  xAxis: { type: 'category', data: dayLabels.value, axisLabel: { interval: range.value > 14 ? 'auto' : 0 } }, yAxis: { type: 'value', name: '分钟' },
  series: [{ type: 'line', smooth: true, data: dayLabels.value.map(label => filteredSessions.value
    .filter(item => sameDay(item.createdAt, label))
    .reduce((sum, item) => sum + Math.round((item.actualSeconds || 0) / 60), 0)),
  areaStyle: { color: CHART.area }, lineStyle: { color: CHART.primary }, itemStyle: { color: CHART.primary } }]
}))

const completionOption = computed(() => ({
  tooltip: { trigger: 'axis' }, grid: { left: 45, right: 20, top: 25, bottom: 25 },
  xAxis: { type: 'category', data: dayLabels.value, axisLabel: { interval: range.value > 14 ? 'auto' : 0 } }, yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
  series: [{ type: 'bar', barWidth: 22, data: dayLabels.value.map(label => { const daySessions = filteredSessions.value.filter(item => sameDay(item.createdAt, label)); return daySessions.length ? Math.round(daySessions.filter(item => item.completed).length / daySessions.length * 100) : 0 }), itemStyle: { color: CHART.primaryLight }, label: { show: range.value <= 14, position: 'top', formatter: '{c}%' } }]
}))

const hourOption = computed(() => ({
  tooltip: { trigger: 'axis', formatter: params => {
    const hour = Number(params[0]?.axisValue) || 0
    return `${hour}:00–${hour + 1}:00<br/>专注 ${params[0]?.value || 0} 分钟`
  } },
  grid: { left: 42, right: 20, top: 25, bottom: 28 },
  xAxis: { type: 'category', data: Array.from({ length: 24 }, (_, hour) => String(hour)), axisLabel: { interval: 2, formatter: '{value}时' } },
  yAxis: { type: 'value', name: '分钟' },
  series: [{
    type: 'bar', barWidth: '58%', data: hours.value,
    itemStyle: { color: params => (hours.value[params.dataIndex] > 0 && params.dataIndex === peakHour.value ? CHART.accent : CHART.primaryLight), borderRadius: [5, 5, 0, 0] }
  }]
}))

const breakdownOption = computed(() => {
  const rows = breakdownRows.value.filter(row => row.count > 0)
  return {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' }, formatter: params => {
      const row = rows[params[0]?.dataIndex]
      return row ? `<b>${row.label}</b><br/>${row.count} 次` : ''
    } },
    grid: { left: 82, right: 34, top: 12, bottom: 24 },
    xAxis: { type: 'value', minInterval: 1 },
    yAxis: { type: 'category', inverse: true, data: rows.map(row => row.label) },
    series: [{ type: 'bar', barWidth: 15, data: rows.map(row => row.count), itemStyle: { color: CHART.accent, borderRadius: [0, 8, 8, 0] }, label: { show: true, position: 'right' } }]
  }
})

const knowledgeOption = computed(() => {
  const orderedPlans = [...plans.value].filter(plan => plan.status !== 'archived')
    .sort((a, b) => (a.sequenceOrder || 999) - (b.sequenceOrder || 999)).slice(0, 30)
  const masteryByPlan = new Map()
  for (const feedback of latestFeedbacks.value) {
    if (!masteryByPlan.has(feedback.planId)) masteryByPlan.set(feedback.planId, feedback.mastery)
  }
  // 三维轴上的类别标签换成 K1…Kn 短编号，完整知识点名放进 tooltip，避免长中文串在投影线上互相压住。
  const points = orderedPlans.map((plan, index) => {
    const topic = plan.knowledgeTags?.[0] || plan.name || '未命名专题'
    const mastery = Math.max(0, Math.min(3, Number(masteryByPlan.get(plan.id) ?? plan.masteryBefore) || 0))
    return { code: `K${index + 1}`, order: Number(plan.sequenceOrder) || index + 1, mastery, name: `${plan.subject} · ${topic}` }
  })
  const tickStep = Math.max(1, Math.ceil(points.length / 6))
  // 深度轴上限取 interval 的整数倍，避免轴顶再补一个 max 刻度；只保留 0 / 中间值 / 上限 三个刻度，
  // 旋转到近似正对深度轴时标签也不会挤在一起。
  const rawMaxOrder = Math.max(4, ...points.map(point => point.order))
  const sequenceInterval = Math.max(1, Math.ceil(rawMaxOrder / 2))
  const sequenceMax = Math.ceil(rawMaxOrder / sequenceInterval) * sequenceInterval
  return {
    tooltip: { show: true, trigger: 'item', formatter: params => {
      const data = params.data || []
      return `<b>${data[3] || data[0]}</b><br/>掌握等级：${data[2]}/3<br/>学习顺序：第 ${data[1]} 项`
    } },
    // 掌握度从浅到深：淡灰绿 → 主色 → 深主色 → 琥珀，四档一眼可分，不再是同一支青绿渐变。
    visualMap: { show: false, dimension: 2, min: 0, max: 3, inRange: { color: [CHART.primaryFaint, '#86c5b9', CHART.primary, CHART.accent] } },
    // 关闭 grid3D 自带的 axisPointer：它会在悬停/拖拽时额外冒出一个数值标签，和自绘 tooltip 抢位置。
    grid3D: { left: '6%', top: '4%', width: '88%', height: '84%', axisPointer: { show: false }, viewControl: { projection: 'perspective', autoRotate: false, distance: 235, alpha: 16, beta: 24 }, boxWidth: 200, boxDepth: 82, boxHeight: 106, light: { main: { intensity: 1.1 }, ambient: { intensity: 0.55 } } },
    // 三维轴名在窄容器里会被画布裁掉，统一收到图下方的说明文字里，画面内只保留刻度。
    xAxis3D: { type: 'category', name: '', data: points.map(point => point.code), axisLabel: { interval: tickStep - 1, fontSize: 12, margin: 12, rotate: 0 } },
    yAxis3D: { type: 'value', name: '', min: 0, max: sequenceMax, interval: sequenceInterval, axisLabel: { fontSize: 12, margin: 6 } },
    // 竖轴 0 刻度与 x 轴首个 K 编号挤在同一个角上，隐藏它（0 是底面，图下说明已写明 0–3）。
    zAxis3D: { type: 'value', name: '', min: 0, max: 3, interval: 1, axisLabel: { fontSize: 12, margin: 8, formatter: value => (value === 0 ? '' : value) } },
    series: [{ type: 'scatter3D', data: points.map(point => [point.code, point.order, point.mastery, point.name]), symbolSize: 18, itemStyle: { opacity: 1 }, emphasis: { itemStyle: { borderWidth: 2, borderColor: '#fff' } } }]
  }
})

onMounted(async () => {
  // 看板仅读取 IndexedDB；切换范围时由 computed 重新计算，不发起外部数据请求。
  [sessions.value, feedbacks.value, distractions.value, visualLogs.value, plans.value, quizResults.value, mistakes.value, examScores.value] = await Promise.all([
    loadFocusSessions(), loadFeedbacks(), loadDistractions(), loadVisualLogs(), loadPlans(),
    loadQuizResults(), loadMistakes(), loadExamScores()
  ])
  // 周报读取同一自然周的缓存，打开看板不会自动消耗模型调用。
  try {
    const cached = JSON.parse(localStorage.getItem(reportCacheKey.value) || 'null')
    if (cached?.report) {
      weeklyReport.value = cached.report
      reportSource.value = cached.source || ''
      reportGeneratedAt.value = Number(cached.generatedAt) || 0
    }
  } catch (error) { console.warn('周报缓存读取失败。', error) }
  focusWeeklyReport()
})
</script>

<template>
  <div class="page dashboard-page">
    <div class="page-header">
      <div><span class="eyebrow">学习数据</span><h2 class="page-title">学习效果看板</h2><p class="page-subtitle">把测试、错题和专注习惯放在一起看，找到最该补的那一块。</p></div>
      <el-select v-model="range" style="width:130px"><el-option :value="7" label="近 7 天"/><el-option :value="14" label="近 14 天"/><el-option :value="30" label="近 30 天"/><el-option :value="90" label="近 90 天"/></el-select>
    </div>

    <section ref="weeklySection" class="surface surface-pad weekly-report" :class="{ 'is-focused': weeklyFocused }">
      <div class="section-head weekly-head">
        <div>
          <span class="eyebrow">每周复盘</span>
          <h3 class="section-title">本周学习周报</h3>
          <p class="weekly-sub">汇总 {{ weekLabel }} 的专注、测试、错题和考试成绩。</p>
        </div>
        <div class="weekly-actions">
          <span v-if="weeklyReport" class="report-source" :class="{ mock: reportSource === 'mock' }">{{ reportSource === 'mock' ? '本地规则' : 'AI 生成' }}</span>
          <span v-if="reportCheck" class="report-check" :class="{ warn: !reportCheck.consistent }" :title="reportCheckTitle">
            {{ reportCheck.consistent ? '数字已核对' : `${reportCheck.mismatches.length} 处数字与数据不符` }}
          </span>
          <el-button v-if="weeklyReport" type="success" plain :loading="convertingPlan" @click="convertReportToPlan">{{ hasWeeklyPlanTasks ? '更新下周计划' : '一键转下周计划' }}</el-button>
          <el-button type="primary" plain :loading="reportLoading" @click="generateReport">{{ weeklyReport ? '重新生成' : '生成本周周报' }}</el-button>
        </div>
      </div>
      <div v-if="weeklyReport" class="weekly-body">
        <h4 class="weekly-headline">{{ weeklyReport.headline }}</h4>
        <p class="weekly-summary">{{ weeklyReport.summary }}</p>
        <div class="weekly-columns">
          <div class="weekly-block good"><h5>做得好的</h5><ul><li v-for="item in weeklyReport.strengths" :key="item">{{ item }}</li></ul></div>
          <div class="weekly-block risk"><h5>要留意的</h5><ul><li v-for="item in weeklyReport.risks" :key="item">{{ item }}</li></ul></div>
          <div class="weekly-block action"><h5>下周行动</h5><ul><li v-for="item in weeklyReport.actions" :key="item">{{ item }}</li></ul></div>
        </div>
        <div class="weekly-foot">
          <span>{{ weeklyReport.closing }}</span>
          <span v-if="generatedAtText">生成于 {{ generatedAtText }} · 数据范围 {{ weekLabel }}</span>
        </div>
        <p v-if="reportCheck && !reportCheck.consistent" class="weekly-mismatch">
          以下数字在学习数据里没有找到对应，请以看板为准：
          <span v-for="item in reportCheck.mismatches" :key="item.metric">{{ item.label }}「{{ item.snippet }}」写成 {{ item.reported }}，实际 {{ item.expected }}；</span>
        </p>
      </div>
      <div v-else class="empty">点击「生成本周周报」，把近 7 天的专注、测试、错题和考试成绩汇总成一份复盘。</div>
    </section>

    <div class="outcome-kpis">
      <div class="stat-card"><div class="stat-label">测试平均正确率</div><div class="stat-value">{{ quizAccuracy }}<small>%</small></div><div class="stat-foot">{{ filteredQuizResults.length }} 次测试 · 按题量加权</div></div>
      <div class="stat-card"><div class="stat-label">新增错题</div><div class="stat-value">{{ filteredMistakes.length }}<small>道</small></div><div class="stat-foot">覆盖 {{ wrongChapterRows.length }} 个章节</div></div>
      <div class="stat-card"><div class="stat-label">考试平均得分率</div><div class="stat-value">{{ examAverageRate }}<small>%</small></div><div class="stat-foot">{{ examSessions.length }} 场学校考试</div></div>
      <div class="stat-card"><div class="stat-label">覆盖章节</div><div class="stat-value">{{ coveredChapters }}<small>个</small></div><div class="stat-foot">来自测试与错题</div></div>
    </div>

    <section class="insight-strip">
      <div class="insight-head"><span class="eyebrow">下一步</span><strong>这一阶段先做这几件事</strong></div>
      <ul><li v-for="item in suggestions" :key="item">{{ item }}</li></ul>
    </section>

    <div class="grid-2" style="margin-top:20px">
      <section class="surface surface-pad"><h3 class="section-title">测试正确率趋势</h3><div v-if="filteredQuizResults.length"><ChartPanel :option="quizTrendOption"/></div><div v-else class="empty">这个时间窗内还没有章节测试记录。</div></section>
      <section class="surface surface-pad"><h3 class="section-title">各科测试正确率</h3><div v-if="subjectRows.length"><ChartPanel :option="subjectOption"/></div><div v-else class="empty">完成章节测试后，这里会按科目对比正确率。</div></section>
      <section class="surface surface-pad"><h3 class="section-title">错题最多的章节</h3><div v-if="wrongChapterRows.length"><ChartPanel :option="wrongChapterOption"/></div><div v-else class="empty">这个时间窗内还没有错题记录。</div></section>
      <section class="surface surface-pad"><h3 class="section-title">学校考试成绩趋势</h3><div v-if="examSessions.length"><ChartPanel :option="examOption"/></div><div v-else class="empty">在学情诊断页录入考试成绩后，这里会显示得分率变化。</div></section>
    </div>

    <div class="section-divider">专注与习惯</div>

    <div class="focus-kpis">
      <div class="stat-card"><div class="stat-label">今日青柠</div><div class="stat-value">{{ todayLime.count }}<small>个</small></div><div class="stat-foot">今日专注 {{ todayLime.minutes }} 分钟 · 每 25 分钟折算 1 个</div></div>
      <div class="stat-card"><div class="stat-label">累计专注</div><div class="stat-value">{{ totalMinutes }} <small>分钟</small></div><div class="stat-foot">{{ filteredSessions.length }} 次专注记录</div></div>
      <div class="stat-card"><div class="stat-label">任务完成率</div><div class="stat-value">{{ completionRate }}<small>%</small></div><div class="stat-foot">按计时是否走完统计</div></div>
      <div class="stat-card"><div class="stat-label">真实分心</div><div class="stat-value">{{ realDistractions.length }} <small>次</small></div><div class="stat-foot">已排除演示模拟</div></div>
      <div class="stat-card"><div class="stat-label">连续学习</div><div class="stat-value">{{ focusStreakDays }}<small>天</small></div><div class="stat-foot">今天没记录时从昨天起算</div></div>
      <div class="stat-card"><div class="stat-label">平均每次专注分心</div><div class="stat-value">{{ distractionPerSession }}<small>次</small></div><div class="stat-foot">共 {{ realDistractions.length }} 次真实分心</div></div>
      <div class="stat-card"><div class="stat-label">本周较上周</div><div class="stat-value">{{ weekStats.minutesDeltaPercent === null ? '—' : `${weekStats.minutesDeltaPercent > 0 ? '+' : ''}${weekStats.minutesDeltaPercent}` }}<small v-if="weekStats.minutesDeltaPercent !== null">%</small></div><div class="stat-foot">本周 {{ weekStats.thisMinutes }} 分钟 · 上周 {{ weekStats.lastMinutes }} 分钟</div></div>
    </div>
    <section class="insight-strip">
      <div class="insight-head"><span class="eyebrow">习惯检查</span><strong>专注习惯洞察</strong></div>
      <ul><li v-for="item in habitSuggestions" :key="item">{{ item }}</li></ul>
    </section>
    <div class="grid-2" style="margin-top:20px">
      <section class="surface surface-pad"><h3 class="section-title">每日专注时长趋势</h3><ChartPanel :option="focusOption"/></section>
      <section class="surface surface-pad"><h3 class="section-title">任务完成情况</h3><ChartPanel :option="completionOption"/></section>
      <section class="surface surface-pad"><h3 class="section-title">专注时段分布</h3><div v-if="totalMinutes"><ChartPanel :option="hourOption"/></div><div v-else class="empty">这个时间窗内还没有专注记录。</div></section>
      <section class="surface surface-pad"><h3 class="section-title">分心与视觉提醒</h3><div v-if="breakdownRows.some(row => row.count > 0)"><ChartPanel :option="breakdownOption"/></div><div v-else class="empty">记录到真实分心或视觉提醒后，这里会按类型对比。</div></section>
      <section class="surface surface-pad"><div class="section-head"><h3 class="section-title">知识点掌握进度 · 3D</h3><div v-if="plans.length" class="mastery-legend"><span>弱</span><i class="mastery-bar"></i><span>强</span></div></div><div v-if="plans.length"><ChartPanel :option="knowledgeOption" :height="390"/><p class="muted">K1…Kn 为知识点编号，悬停圆点查看全名；竖轴为掌握等级（0–3），深度轴为学习顺序；可拖动旋转查看。</p></div><div v-else class="empty">完成专题摸底或专注任务后，这里会显示你的掌握度立体图。</div></section>
    </div>
  </div>
</template>

<style scoped>
.outcome-kpis,.focus-kpis{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:14px}
.focus-kpis{grid-template-columns:repeat(4,minmax(0,1fr))}
.stat-foot{margin-top:6px;color:var(--muted);font-size:calc(11px*var(--fs-scale))}
.insight-strip{margin-top:16px;padding:18px 20px;border:1px solid var(--border);border-radius:16px;background:linear-gradient(125deg,var(--primary-soft),var(--surface))}
.insight-head{display:flex;align-items:baseline;gap:10px;margin-bottom:10px}
.insight-head strong{font-size:calc(14px*var(--fs-scale))}
.insight-strip ul{margin:0;padding-left:18px;display:grid;gap:6px;font-size:calc(13px*var(--fs-scale));line-height:1.65}
.section-divider{display:flex;align-items:center;gap:12px;margin:30px 0 16px;color:var(--muted);font-size:calc(12px*var(--fs-scale));font-weight:700;letter-spacing:.08em}
.section-divider:after{content:'';flex:1;height:1px;background:var(--border)}
.weekly-report{margin-bottom:18px;background:linear-gradient(135deg,var(--surface),var(--primary-soft));scroll-margin-top:104px;transition:box-shadow .25s ease}
.weekly-report.is-focused{box-shadow:0 0 0 3px color-mix(in srgb,var(--primary) 32%,transparent),var(--shadow)}
.weekly-head{align-items:flex-start}
.weekly-sub{margin:5px 0 0;color:var(--muted);font-size:calc(12px*var(--fs-scale))}
.weekly-actions{display:flex;align-items:center;gap:10px;flex:none}
.report-source{padding:3px 9px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:calc(11px*var(--fs-scale));font-weight:700}
.report-source.mock{background:var(--accent-soft);color:var(--accent-deep)}
/* 数字一致性核对标记：通过是绿的，有出入转成警示色 */
.report-check{padding:3px 9px;border-radius:999px;border:1px solid color-mix(in srgb,var(--success) 30%,var(--border));background:color-mix(in srgb,var(--success) 12%,var(--surface));color:var(--success);font-size:calc(11px*var(--fs-scale));font-weight:600;white-space:nowrap}
.report-check.warn{border-color:color-mix(in srgb,var(--accent) 38%,var(--border));background:var(--accent-soft);color:var(--accent-deep)}
.weekly-mismatch{margin:10px 0 0;padding:9px 12px;border-radius:10px;border:1px solid color-mix(in srgb,var(--accent) 38%,var(--border));background:var(--accent-soft);color:var(--accent-deep);font-size:calc(12px*var(--fs-scale));line-height:1.7}
.weekly-headline{margin:0 0 8px;font-size:calc(18px*var(--fs-scale))}
.weekly-summary{margin:0;font-size:calc(13px*var(--fs-scale));line-height:1.75}
.weekly-columns{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-top:16px}
.weekly-block{padding:13px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}
.weekly-block h5{margin:0 0 8px;font-size:calc(12px*var(--fs-scale));letter-spacing:.04em;color:var(--muted)}
.weekly-block ul{margin:0;padding-left:16px;display:grid;gap:6px;font-size:calc(12.5px*var(--fs-scale));line-height:1.6}
.weekly-block.good{border-left:3px solid var(--primary)}
.weekly-block.risk{border-left:3px solid var(--danger)}
.weekly-block.action{border-left:3px solid var(--accent)}
.weekly-foot{display:flex;justify-content:space-between;gap:12px;margin-top:14px;color:var(--muted);font-size:calc(11px*var(--fs-scale));flex-wrap:wrap}
@media(max-width:800px){.outcome-kpis,.focus-kpis{grid-template-columns:1fr 1fr}.weekly-columns{grid-template-columns:1fr}.weekly-head{flex-direction:column;gap:10px}/* 专注 KPI 是奇数张，手机端最后一张铺满整行，避免右下留空。*/.focus-kpis .stat-card:last-child{grid-column:span 2}}
</style>
