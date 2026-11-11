<script setup>
import { computed, onMounted, ref } from 'vue'
import ChartPanel from '../components/ChartPanel.vue'
import { loadDistractions, loadFeedbacks, loadFocusSessions, loadPlans, loadVisualLogs } from '../db/index.js'

const range = ref(7)
const sessions = ref([])
const feedbacks = ref([])
const distractions = ref([])
const visualLogs = ref([])
const plans = ref([])
const rangeStart = computed(() => Date.now() - range.value * 86400000)

// 统一按选择的时间窗口筛选本地记录，让顶部指标和图表口径保持一致。
const filteredSessions = computed(() => sessions.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const filteredDistractions = computed(() => distractions.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const filteredVisualLogs = computed(() => visualLogs.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const filteredFeedbacks = computed(() => feedbacks.value.filter(item => (item.createdAt || 0) >= rangeStart.value))
const latestFeedbacks = computed(() => [...filteredFeedbacks.value].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)))
const totalMinutes = computed(() => Math.round(filteredSessions.value.reduce((sum, item) => sum + (item.actualSeconds || 0), 0) / 60))
const completionRate = computed(() => filteredSessions.value.length
  ? Math.round(filteredSessions.value.filter(item => item.completed).length / filteredSessions.value.length * 100) : 0)

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
  xAxis: { type: 'category', data: dayLabels.value }, yAxis: { type: 'value', name: '分钟' },
  series: [{ type: 'line', smooth: true, data: dayLabels.value.map(label => filteredSessions.value
    .filter(item => sameDay(item.createdAt, label))
    .reduce((sum, item) => sum + Math.round((item.actualSeconds || 0) / 60), 0)),
  areaStyle: { color: 'rgba(77,141,142,.15)' }, lineStyle: { color: '#4d8d8e' }, itemStyle: { color: '#4d8d8e' } }]
}))

const completionOption = computed(() => ({
  tooltip: { trigger: 'axis' }, grid: { left: 45, right: 20, top: 25, bottom: 25 },
  xAxis: { type: 'category', data: dayLabels.value }, yAxis: { type: 'value', max: 100, axisLabel: { formatter: '{value}%' } },
  series: [{ type: 'bar', barWidth: 22, data: dayLabels.value.map(label => { const daySessions = filteredSessions.value.filter(item => sameDay(item.createdAt, label)); return daySessions.length ? Math.round(daySessions.filter(item => item.completed).length / daySessions.length * 100) : 0 }), itemStyle: { color: '#86b7ae' }, label: { show: true, position: 'top', formatter: '{c}%' } }]
}))

const distractionOption = computed(() => ({
  tooltip: { trigger: 'item' }, series: [{ type: 'pie', radius: ['50%', '72%'], data: [
    { name: '页面切走', value: filteredDistractions.value.filter(item => item.type === 'tab-hidden').length },
    { name: '视觉离岗', value: filteredDistractions.value.filter(item => item.type === 'visual-away').length },
    { name: '演示模拟', value: filteredDistractions.value.filter(item => item.type === 'demo-away').length }
  ], label: { formatter: '{b}\n{c}' } }]
}))

const visualOption = computed(() => ({
  tooltip: { trigger: 'axis' }, grid: { left: 42, right: 20, top: 25, bottom: 25 },
  xAxis: { type: 'category', data: dayLabels.value }, yAxis: { type: 'value', name: '次', minInterval: 1 },
  series: [{ type: 'bar', barWidth: 22, data: dayLabels.value.map(label => filteredVisualLogs.value
    .filter(item => item.status === 'away' && item.source !== 'demo' && sameDay(item.createdAt, label)).length),
  itemStyle: { color: '#eea77b' } }]
}))

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
    visualMap: { show: false, dimension: 2, min: 0, max: 3, inRange: { color: ['#d4dfe0', '#9bc6b9', '#579895', '#e6a16d'] } },
    // 关闭 grid3D 自带的 axisPointer：它会在悬停/拖拽时额外冒出一个数值标签，和自绘 tooltip 抢位置。
    grid3D: { left: '6%', top: '4%', width: '88%', height: '84%', axisPointer: { show: false }, viewControl: { projection: 'perspective', autoRotate: false, distance: 235, alpha: 16, beta: 24 }, boxWidth: 200, boxDepth: 82, boxHeight: 106, light: { main: { intensity: 1.1 }, ambient: { intensity: 0.55 } } },
    // 三维轴名在窄容器里会被画布裁掉，统一收到图下方的说明文字里，画面内只保留刻度。
    xAxis3D: { type: 'category', name: '', data: points.map(point => point.code), axisLabel: { interval: tickStep - 1, fontSize: 11, margin: 12, rotate: 0 } },
    yAxis3D: { type: 'value', name: '', min: 0, max: sequenceMax, interval: sequenceInterval, axisLabel: { fontSize: 11, margin: 6 } },
    // 竖轴 0 刻度与 x 轴首个 K 编号挤在同一个角上，隐藏它（0 是底面，图下说明已写明 0–3）。
    zAxis3D: { type: 'value', name: '', min: 0, max: 3, interval: 1, axisLabel: { fontSize: 11, margin: 8, formatter: value => (value === 0 ? '' : value) } },
    series: [{ type: 'scatter3D', data: points.map(point => [point.code, point.order, point.mastery, point.name]), symbolSize: 18, itemStyle: { opacity: 1 }, emphasis: { itemStyle: { borderWidth: 2, borderColor: '#fff' } } }]
  }
})

onMounted(async () => {
  // 看板仅读取 IndexedDB；切换范围时由 computed 重新计算，不发起外部数据请求。
  [sessions.value, feedbacks.value, distractions.value, visualLogs.value, plans.value] = await Promise.all([
    loadFocusSessions(), loadFeedbacks(), loadDistractions(), loadVisualLogs(), loadPlans()
  ])
})
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h2 class="page-title">学习数据看板</h2><p class="page-subtitle">看见自己的节奏，比追求一次满分更重要。</p></div>
      <el-select v-model="range" style="width:130px"><el-option :value="7" label="近 7 天"/><el-option :value="14" label="近 14 天"/><el-option :value="30" label="近 30 天"/></el-select>
    </div>
    <div class="grid-3">
      <div class="stat-card"><div class="stat-label">累计专注</div><div class="stat-value">{{ totalMinutes }} <small>分钟</small></div></div>
      <div class="stat-card"><div class="stat-label">任务完成率</div><div class="stat-value">{{ completionRate }}<small>%</small></div></div>
      <div class="stat-card"><div class="stat-label">记录的分心</div><div class="stat-value">{{ filteredDistractions.length }} <small>次</small></div></div>
    </div>
    <div class="grid-2" style="margin-top:20px">
      <section class="surface surface-pad"><h3 class="section-title">每日专注时长趋势</h3><ChartPanel :option="focusOption"/></section>
      <section class="surface surface-pad"><h3 class="section-title">任务完成情况</h3><ChartPanel :option="completionOption"/></section>
      <section class="surface surface-pad"><h3 class="section-title">分心统计</h3><ChartPanel :option="distractionOption"/></section>
      <section class="surface surface-pad"><h3 class="section-title">视觉监督离岗记录</h3><ChartPanel :option="visualOption"/></section>
      <section class="surface surface-pad"><div class="section-head"><h3 class="section-title">知识点掌握进度 · 3D</h3><div v-if="plans.length" class="mastery-legend"><span>弱</span><i class="mastery-bar"></i><span>强</span></div></div><div v-if="plans.length"><ChartPanel :option="knowledgeOption" :height="390"/><p class="muted">K1…Kn 为知识点编号，悬停圆点查看全名；竖轴为掌握等级（0–3），深度轴为学习顺序；可拖动旋转查看。</p></div><div v-else class="empty">完成专题摸底或专注任务后，这里会显示你的掌握度立体图。</div></section>
    </div>
  </div>
</template>
