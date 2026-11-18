<script setup>
// 掌握度刻度：一条直线 + 两个内部刻度点（1/3、2/3），填充比例 = mastery/3。
import { computed } from 'vue'

const props = defineProps({
  value: { type: Number, default: 0 },
  untested: { type: Boolean, default: false }
})

const percent = computed(() => props.untested ? 0 : Math.max(0, Math.min(3, props.value)) / 3 * 100)
const tone = computed(() => {
  if (props.untested) return 'untested'
  return ['zero', 'weak', 'mid', 'good'][Math.max(0, Math.min(3, Math.round(props.value)))]
})
</script>

<template>
  <span class="scale" :data-tone="tone" :aria-label="untested ? '未测' : `掌握度 ${value} / 3`">
    <span class="track"><i class="fill" :style="{ width: percent + '%' }"></i></span>
  </span>
</template>

<style scoped>
.scale{display:inline-block;width:108px;vertical-align:middle}
.track{position:relative;display:block;height:6px;border-radius:3px;background:#e4eeea}
.scale[data-tone="untested"] .track{background:transparent;border:1px dashed #d3e0db}
.scale[data-tone="untested"] .fill{display:none}
.track::before,.track::after{content:'';position:absolute;top:-2px;width:1.5px;height:10px;background:var(--bg,#fff);z-index:1}
.track::before{left:33.33%}
.track::after{left:66.66%}
.fill{display:block;height:100%;border-radius:3px;transition:width .3s ease}
.scale[data-tone="zero"] .fill{background:#c3d3cd}
.scale[data-tone="weak"] .fill{background:#c08a63}
.scale[data-tone="mid"] .fill{background:#86ab9f}
.scale[data-tone="good"] .fill{background:#4d817a}
</style>
