<script setup>
import { computed, ref } from 'vue'

const props = defineProps({
  thinking: { type: String, default: '' },
  tools: { type: Array, default: () => [] },
  streaming: { type: Boolean, default: false }
})

const expanded = ref(false)
// 用户手动点过之后，以用户操作为准，不再随流式状态自动展开。
const touched = ref(false)
const hasTrace = computed(() => Boolean(props.thinking || props.tools.length))
const doneTools = computed(() => props.tools.filter(tool => tool.status === 'done').length)

// 推理或工具首次到达时自动展开，用户手动收起后不再强制打开。
const showBody = computed(() => (touched.value ? expanded.value : props.streaming))
function toggleTrace() {
  const next = !showBody.value
  touched.value = true
  expanded.value = next
}
</script>

<template>
  <div v-if="streaming && !hasTrace" class="trace-waiting">
    <span class="waiting-dot" aria-hidden="true"></span>
    <span>模型正在深度思考，通常需要 10–20 秒…</span>
  </div>
  <div v-else-if="hasTrace" class="agent-trace" :class="{ 'is-streaming': streaming }">
    <button type="button" class="trace-head" @click="toggleTrace">
      <span class="trace-pulse" aria-hidden="true"></span>
      <span class="trace-title">{{ streaming ? '正在思考' : '思考过程' }}</span>
      <span class="trace-meta">
        <template v-if="tools.length">{{ doneTools }}/{{ tools.length }} 次工具调用</template>
        <template v-else>推理摘要</template>
      </span>
      <span class="trace-toggle">{{ showBody ? '收起' : '展开' }}</span>
    </button>
    <div v-show="showBody" class="trace-body">
      <p v-if="thinking" class="trace-thinking">{{ thinking }}</p>
      <ol v-if="tools.length" class="trace-steps">
        <li v-for="(tool, index) in tools" :key="`${tool.name}-${index}`" :class="tool.status">
          <span class="step-index">{{ index + 1 }}</span>
          <span class="step-label">{{ tool.label || tool.name }}</span>
          <span class="step-state">{{ tool.status === 'done' ? '完成' : '执行中' }}</span>
          <small v-if="tool.summary" class="step-summary">{{ tool.summary }}</small>
        </li>
      </ol>
      <p v-if="!thinking && !tools.length" class="trace-empty">模型正在组织语言…</p>
    </div>
  </div>
</template>

<style scoped>
.trace-waiting{display:flex;align-items:center;gap:8px;font-size:calc(12px*var(--fs-scale));color:var(--muted);padding:6px 2px}
.waiting-dot{width:7px;height:7px;border-radius:50%;background:var(--primary);animation:trace-pulse 1.2s ease-in-out infinite}
.agent-trace{margin:0 0 8px;border:1px solid var(--border);border-left:3px solid var(--primary);border-radius:10px;background:var(--surface-soft);overflow:hidden}
.trace-head{width:100%;display:flex;align-items:center;gap:8px;padding:8px 12px;border:0;background:transparent;color:var(--text);font-size:calc(12.5px*var(--fs-scale));cursor:pointer;text-align:left}
.trace-head:hover{background:var(--primary-soft)}
.trace-pulse{width:7px;height:7px;border-radius:50%;background:var(--muted);flex:none}
.agent-trace.is-streaming .trace-pulse{background:var(--primary);animation:trace-pulse 1.2s ease-in-out infinite}
.trace-title{font-weight:600}
.trace-meta{margin-left:auto;color:var(--muted);font-size:calc(11.5px*var(--fs-scale))}
.trace-toggle{color:var(--primary);font-size:calc(11.5px*var(--fs-scale))}
.trace-body{border-top:1px dashed var(--border);padding:10px 12px 12px}
.trace-thinking{max-height:160px;overflow:auto;margin:0 0 8px;font-size:calc(12px*var(--fs-scale));line-height:1.65;color:var(--muted);white-space:pre-wrap}
.trace-steps{list-style:none;margin:0;padding:0;display:grid;gap:6px}
.trace-steps li{display:grid;grid-template-columns:18px 1fr auto;align-items:center;gap:6px;font-size:calc(12px*var(--fs-scale))}
.step-index{width:18px;height:18px;display:grid;place-items:center;border-radius:50%;background:var(--primary-soft);color:var(--primary);font-size:calc(11px*var(--fs-scale));font-weight:700}
.step-label{color:var(--text);font-weight:600}
.step-state{color:var(--muted);font-size:calc(11px*var(--fs-scale))}
.trace-steps li[data-status='start'] .step-state,.trace-steps li.start .step-state{color:var(--primary)}
.step-summary{grid-column:2/4;color:var(--muted);font-size:calc(11.5px*var(--fs-scale));line-height:1.5}
.trace-empty{margin:0;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
@keyframes trace-pulse{0%,100%{opacity:.35;transform:scale(.9)}50%{opacity:1;transform:scale(1.15)}}
@media (prefers-reduced-motion: reduce){.waiting-dot,.agent-trace.is-streaming .trace-pulse{animation:none}}
</style>
