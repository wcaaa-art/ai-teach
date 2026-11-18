<script setup>
import { formatClock } from '../utils/liveFocus.js'

// 专注回顾弹窗：从 FocusView 抽出，纯展示 + 事件，删除逻辑由父组件处理。
const props = defineProps({
  modelValue: { type: Boolean, default: false },
  records: { type: Array, default: () => [] }
})
const emit = defineEmits(['update:modelValue', 'delete'])

// 走神/离开/总时长用「分」作单位，几秒钟的碎片时间显示成「不足 1 分」更友好。
function shortDuration(seconds) {
  const safe = Math.max(0, Math.round(Number(seconds) || 0))
  if (safe < 30) return '0 分'
  if (safe < 60) return '不足 1 分'
  return `${Math.round(safe / 60)} 分`
}
</script>

<template>
  <el-dialog :model-value="modelValue" title="专注回顾" width="600px" :close-on-click-modal="true" @update:model-value="emit('update:modelValue', $event)">
    <div v-if="!records.length" class="history-empty">
      还没有专注记录，完成第一轮专注后这里会出现你的节奏
    </div>
    <div v-else class="history-list">
      <div v-for="record in records" :key="record.id" class="history-row">
        <div class="history-main">
          <div class="history-head">
            <strong class="history-task">{{ record.taskName }}</strong>
            <span v-if="record.subject" class="history-subject">{{ record.subject }}</span>
            <el-tag v-if="!record.completed" size="small" type="info" effect="plain">未完成</el-tag>
          </div>
          <p class="history-date">{{ record.dateText }}</p>
          <div class="history-stats">
            <span class="hstat"><b>{{ formatClock(record.focus) }}</b><i>专注</i></span>
            <span v-if="record.sampled" class="hstat"><b>{{ shortDuration(record.distracted) }}</b><i>走神</i></span>
            <span v-if="record.sampled" class="hstat"><b>{{ shortDuration(record.away) }}</b><i>离开</i></span>
            <span v-if="!record.sampled" class="hstat hstat-total"><b>{{ shortDuration(record.actual) }}</b><i>总时长</i></span>
          </div>
        </div>
        <button class="history-delete" type="button" @click="emit('delete', record)">删除</button>
      </div>
    </div>
  </el-dialog>
</template>

<style scoped>
.history-empty{padding:36px 0;text-align:center;color:var(--ink-faint);font-size:calc(12.5px*var(--fs-scale))}
.history-list{display:grid;gap:10px;max-height:52vh;overflow-y:auto}
.history-row{display:flex;align-items:flex-start;gap:12px;padding:12px 14px;border:1px solid var(--line);border-radius:12px;background:#FBFCFA}
.history-main{flex:1;min-width:0}
.history-head{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.history-task{margin:0;font-size:calc(13.5px*var(--fs-scale));color:var(--ink)}
.history-subject{font-size:calc(11px*var(--fs-scale));color:var(--brand-mid)}
.history-date{margin:4px 0 8px;font-size:calc(11px*var(--fs-scale));color:var(--ink-faint)}
.history-stats{display:flex;gap:16px;flex-wrap:wrap}
.hstat{display:flex;align-items:baseline;gap:5px}
.hstat b{font-family:Georgia,'Times New Roman',serif;font-size:calc(14px*var(--fs-scale));font-weight:600;color:var(--brand)}
.hstat i{font-style:normal;font-size:calc(10.5px*var(--fs-scale));color:var(--ink-faint)}
.hstat-total b{color:var(--ink-soft)}
.history-delete{flex:none;border:0;background:none;padding:5px 6px;color:var(--ink-faint);font-family:inherit;font-size:calc(11.5px*var(--fs-scale));cursor:pointer;transition:color .2s}
.history-delete:hover{color:#B0583A}
</style>
