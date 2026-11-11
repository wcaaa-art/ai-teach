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

async function render() {
  const token = ++renderToken
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
    chart.setOption(zeroed(props.option), true)
    window.requestAnimationFrame(() => { if (chart && !chart.isDisposed()) chart.setOption(props.option) })
    return
  }
  chart.setOption(props.option, true)
}
onMounted(() => { render(); window.addEventListener('resize', render) }); watch(() => props.option, render, {deep:true}); onBeforeUnmount(()=>{window.removeEventListener('resize',render);chart?.dispose()})
</script>
<template><div ref="el" class="chart" :style="{height: `${height}px`}"></div></template>
