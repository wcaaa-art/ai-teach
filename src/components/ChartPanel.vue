<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
// 按需注册：只引入实际用到的折线、柱状、饼图、雷达与坐标/提示组件，避免整包 echarts 进入首屏包。
import * as echarts from 'echarts/core'
import { BarChart, LineChart, PieChart, RadarChart } from 'echarts/charts'
import { GridComponent, RadarComponent, TooltipComponent, VisualMapComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
echarts.use([LineChart, BarChart, PieChart, RadarChart, GridComponent, RadarComponent, TooltipComponent, VisualMapComponent, CanvasRenderer])

const props = defineProps({ option: { type: Object, required: true }, height: { type: Number, default: 300 }, animateIn: Boolean })
const el = ref(null); let chart
let revealed = false
let renderToken = 0
let glPromise = null

// 三维看板才需要 echarts-gl；单独动态加载 grid3D + scatter3D，globe/map3D 等用不到的模块不打进包里。
function needsGl(option) {
  if (option.grid3D) return true
  return (option.series || []).some(series => /3D$|GL$/.test(String(series.type || '')))
}

function loadGl() {
  if (!glPromise) {
    glPromise = import('echarts-gl/lib/component/grid3D')
      .then(() => import('echarts-gl/lib/chart/scatter3D'))
  }
  return glPromise
}

// ECharts 5 的雷达系列只在 update 分支做过渡，首次渲染是直接落点。
// 想要入场展开，就先渲染一份零值数据，下一帧再合并真实值，让多边形从中心撑开。
function zeroed(option) {
  return {
    ...option,
    series: (option.series || []).map(series => ({
      ...series,
      data: (series.data || []).map(item => item && item.value !== undefined
        ? { ...item, value: Array.isArray(item.value) ? item.value.map(() => 0) : 0 }
        : item)
    }))
  }
}

// ECharts 默认的坐标轴/图例文字是深灰色，在深色底上几乎看不见；
// 这里按当前主题补一层默认颜色，浅色模式保持原样，不动系列本身的配色。
function isDarkTheme() {
  return document.documentElement.dataset.theme === 'dark'
}

function darkAxis(axis) {
  if (!axis) return axis
  const paint = single => {
    if (!single || typeof single !== 'object') return single
    return {
      ...single,
      axisLabel: { color: '#a6babd', ...(single.axisLabel || {}) },
      axisLine: { ...(single.axisLine || {}), lineStyle: { color: '#37535b', ...(single.axisLine?.lineStyle || {}) } },
      splitLine: { ...(single.splitLine || {}), lineStyle: { color: 'rgba(255,255,255,.08)', ...(single.splitLine?.lineStyle || {}) } }
    }
  }
  return Array.isArray(axis) ? axis.map(paint) : paint(axis)
}

function themedOption(option) {
  if (!isDarkTheme()) return option
  return {
    ...option,
    textStyle: { color: '#a6babd', ...(option.textStyle || {}) },
    xAxis: darkAxis(option.xAxis),
    yAxis: darkAxis(option.yAxis),
    ...(option.legend ? { legend: { ...option.legend, textStyle: { color: '#c2d2d4', ...(option.legend.textStyle || {}) } } } : {})
  }
}

async function render() {
  const token = ++renderToken
  const option = themedOption(props.option)
  if (!chart && needsGl(props.option)) {
    await loadGl()
    // 等待 gl 模块期间可能已经卸载或有了更新，旧任务直接放弃，避免覆盖新数据。
    if (token !== renderToken) return
  }
  if (!chart) {
    if (!el.value) return
    chart = echarts.init(el.value)
  }
  if (props.animateIn && !revealed) {
    revealed = true
    chart.setOption(zeroed(option), true)
    window.requestAnimationFrame(() => { if (chart && !chart.isDisposed()) chart.setOption(option) })
    return
  }
  chart.setOption(option, true)
}
// 主题切换时要重画一次，否则轴文字还停留在上一套配色上。
const themeObserver = new MutationObserver(() => render())
onMounted(() => {
  render()
  window.addEventListener('resize', render)
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
})
watch(() => props.option, render, { deep: true })
onBeforeUnmount(() => {
  themeObserver.disconnect()
  window.removeEventListener('resize', render)
  chart?.dispose()
})
</script>
<template><div ref="el" class="chart" :style="{height: `${height}px`}"></div></template>
