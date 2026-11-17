<script setup>
// AI 决策来源徽章：把「这段结论是谁给的」明确标出来。
// 用户和评委都能一眼分清——哪句是模型推理的、哪句是本地规则兜底的、哪句来自真题检索。
// 这既是可解释性，也是安全兜底的透明化：模型不可用时系统会静默降级，
// 但降级这件事必须让用户看见，否则「看起来是 AI 在判断」就成了误导。
const props = defineProps({
  source: { type: String, default: '' },
  label: { type: String, default: '' }
})

// source → 展示信息。判定口径集中在这一处，界面各处复用同一套语义。
const SOURCE_MAP = {
  deepseek: { label: 'AI 生成', tone: 'model', hint: '由大模型根据题目信息生成，仅供参考' },
  'local-fallback': { label: '本地规则', tone: 'local', hint: '模型暂不可用，由本地关键词规则推测' },
  fallback: { label: '本地规则', tone: 'local', hint: '由本地规则推测' },
  validation: { label: '本地规则', tone: 'local', hint: '输入信息不足，由本地规则给的基础归因' },
  local: { label: '本地规则', tone: 'local', hint: '由本地关键词规则推测' },
  mock: { label: '本地兜底', tone: 'local', hint: '模型暂不可用，当前由本地话术兜底' },
  'safety-filter': { label: '安全过滤', tone: 'local', hint: '提问或回答触发内容安全规则，已替换为学习引导' },
  'safety-guard': { label: '安全改写', tone: 'local', hint: '回答触发安全规则，已改写为引导式提示' },
  'rate-limit': { label: '已限流', tone: 'local', hint: '提问过于频繁，本次先返回消化提示' },
  'config-error': { label: '未配置密钥', tone: 'local', hint: '未配置 DEEPSEEK_API_KEY，当前为本地演示' },
  'exam-rag': { label: '真题检索', tone: 'rag', hint: '来自课标知识点与中考真题检索结果' },
  'curriculum+exam-rag': { label: '真题检索', tone: 'rag', hint: '来自课标知识点与中考真题检索结果' },
  rag: { label: '真题检索', tone: 'rag', hint: '来自课标知识点与中考真题检索结果' }
}

const meta = () => {
  const key = String(props.source || '').trim()
  if (props.label) return { label: props.label, tone: 'model', hint: '由大模型生成，仅供参考' }
  return SOURCE_MAP[key] || { label: '本地规则', tone: 'local', hint: '由本地规则推测' }
}
</script>

<template>
  <span class="source-badge" :class="`is-${meta().tone}`" :title="meta().hint">
    <i class="dot" aria-hidden="true"></i>{{ meta().label }}
  </span>
</template>

<style scoped>
.source-badge{display:inline-flex;align-items:center;gap:4px;padding:1px 7px;border-radius:999px;border:1px solid transparent;font-size:calc(10.5px*var(--fs-scale));line-height:1.6;white-space:nowrap;vertical-align:middle}
.source-badge .dot{width:5px;height:5px;border-radius:50%;background:currentColor;flex:none}
/* 模型判断：品牌绿，表示这是推理结果 */
.source-badge.is-model{background:var(--primary-soft);color:var(--primary);border-color:color-mix(in srgb,var(--primary) 24%,transparent)}
/* 本地规则：中性灰，表示这是确定性规则兜底 */
.source-badge.is-local{background:var(--surface-soft);color:var(--muted);border-color:var(--border)}
/* 真题检索：蓝色，表示有原始语料可溯源 */
.source-badge.is-rag{background:var(--primary-soft);color:var(--primary);border-color:color-mix(in srgb,var(--primary) 24%,transparent)}
</style>
