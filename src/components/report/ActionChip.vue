<script setup>
// 动作 chip：图标即类型，点击向上抛 { type, step } 给父组件分发；类型来自数据，不做文案匹配。
const ICONS = {
  quiz: ['M2.5 13.5 3 10.8 10.8 3l2.2 2.2-7.8 7.8z'],
  video: ['M5 3.2 12.4 8 5 12.8z'],
  doc: ['M3.5 2.5h6L12.5 5.5v8h-9z', 'M9.5 2.5v3h3'],
  review: ['M9 9l3 3M4 4h8v8H4z'],
  retest: ['M3 8a5 5 0 1 1 2 4', 'M3 4v4h4'],
  progress: ['M3 12V7M8 12V4M13 12V9']
}
defineProps({ step: { type: Object, required: true } })
// 自定义事件不能叫 click，会和原生同名事件重复派发。
const emit = defineEmits(['pick'])
</script>

<template>
  <button class="chip" type="button" :data-action="step.actionType" @click="emit('pick', { type: step.actionType, step })">
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
      <path v-for="(path, index) in (ICONS[step.actionType] || ICONS.progress)" :key="index" :d="path" />
    </svg>
    <span>{{ step.outcome }}</span>
    <i aria-hidden="true">→</i>
  </button>
</template>

<style scoped>
.chip{display:flex;align-items:center;gap:6px;width:100%;margin-top:auto;padding:6px 8px;border-radius:8px;border:1px solid #dfeae6;background:var(--surface,#fff);font-size:11.5px;color:#3d6b63;text-align:left;font-family:inherit;cursor:pointer;transition:border-color .16s,background .16s,transform .16s}
.chip:hover{border-color:#a9c8bf;background:#fbfdfc}
.chip svg{width:12px;height:12px;flex:none;opacity:.8}
.chip span{flex:1 1 auto;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.chip i{font-style:normal;flex:none;opacity:.5;transition:transform .16s,opacity .16s}
.chip:hover i{transform:translateX(2px);opacity:1}
</style>
