<script setup>
import { useId } from 'vue'

defineProps({ size: { type: Number, default: 24 } })

// 同一页会渲染多个青柠图标，渐变 id 必须唯一，否则后面的实例会引用到第一个节点的定义。
const gradId = `limeGrad-${useId()}`
</script>

<template>
  <span class="lime-icon" :style="{ width: `${size}px`, height: `${size}px` }" aria-hidden="true">
    <svg viewBox="0 0 64 64" role="presentation">
      <defs>
        <radialGradient :id="gradId" cx="34%" cy="26%" r="80%">
          <stop offset="0%" stop-color="#dcedb4" />
          <stop offset="46%" stop-color="#a2cc86" />
          <stop offset="100%" stop-color="#4f8f8a" />
        </radialGradient>
      </defs>
      <ellipse class="lime-shadow" cx="32" cy="58" rx="16" ry="3.2" />
      <path class="lime-leaf" d="M31.6 15.4c4.2-6.4 11.6-8.2 16.4-6.4-.9 5.9-5.6 10.6-14 10.2z" />
      <path class="lime-vein" d="M33 17.2c4.3-2.2 8.2-4.4 11.6-6.6" />
      <path class="lime-nub" d="M32 15.6c.4-1.7 1.4-2.6 2.6-2.9" />
      <circle class="lime-body" cx="32" cy="36" r="20.5" :fill="`url(#${gradId})`" />
      <ellipse class="lime-gloss" cx="23.4" cy="27.6" rx="7.4" ry="5" />
    </svg>
  </span>
</template>

<style scoped>
.lime-icon{display:inline-grid;place-items:center;flex:none;line-height:0}
.lime-icon svg{width:100%;height:100%;overflow:visible}
.lime-shadow{fill:rgba(77,141,142,.16)}
.lime-leaf{fill:#5e9f8f}
.lime-vein{fill:none;stroke:rgba(255,255,255,.5);stroke-width:1.4;stroke-linecap:round}
.lime-body{filter:drop-shadow(0 3px 6px rgba(50,122,142,.22))}
.lime-gloss{fill:rgba(255,255,255,.42)}
.lime-nub{fill:none;stroke:#4f8f8a;stroke-width:2.6;stroke-linecap:round}
</style>
