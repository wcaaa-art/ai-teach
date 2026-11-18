<script setup>
import ActionChip from './ActionChip.vue'

defineProps({
  steps: { type: Array, default: () => [] },
  plannedIds: { type: Array, default: () => [] }
})
const emit = defineEmits(['action'])
// 每步最多四列，超宽自动折成两列。
</script>

<template>
  <ol class="road">
    <li v-for="step in steps" :key="step.planId" class="step" :class="{ planned: plannedIds.includes(step.planId) }">
      <span v-if="plannedIds.includes(step.planId)" class="planned-flag">已在计划</span>
      <span class="step-k"><b>{{ step.step }}</b>{{ step.label }}</span>
      <span class="step-n">{{ step.action }}</span>
      <ActionChip :step="step" @pick="emit('action', $event)" />
    </li>
  </ol>
</template>

<style scoped>
.road{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;list-style:none;margin:0;padding:12px 16px 14px}
.step{position:relative;display:flex;flex-direction:column;padding:10px 11px 11px;background:var(--surface-soft);border:1px solid var(--border-soft);border-radius:11px}
.step-k{display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--text);margin-bottom:7px}
.step-k b{width:16px;height:16px;border-radius:50%;flex:none;display:grid;place-items:center;background:#fff;border:1px solid #cfdfd9;font-size:9.5px;font-weight:600;color:var(--faint,#7f938d)}
.step:first-child .step-k b{background:var(--primary);border-color:var(--primary);color:#fff}
.step-n{display:block;font-size:12px;color:var(--muted);margin-bottom:7px;line-height:1.5}
.planned-flag{display:none;align-items:center;gap:3px;position:absolute;top:8px;right:9px;font-size:10px;color:#3d726e}
.step.planned .planned-flag{display:flex}
@media(max-width:1040px){.road{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:720px){.road{grid-template-columns:minmax(0,1fr)}}
</style>
