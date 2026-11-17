<script setup>
import { computed } from 'vue'

// 答疑回答的检索依据：把 RAG 命中的真题出处从 AgentTrace 里单独拎出来展示，
// 让「AI 查过真题再回答」在页面上可见、可追溯，而不是只在工具步骤里一闪而过。
const props = defineProps({
  citations: { type: Array, default: () => [] },
  max: { type: Number, default: 4 }
})

function normalize(item) {
  if (typeof item === 'string') {
    const matched = item.match(/^《(.+?)》\s*[：:]\s*(.+)$/)
    return { text: item, title: matched ? matched[1] : item, detail: matched ? matched[2] : item }
  }
  return {
    text: String(item?.text || ''),
    title: String(item?.title || item?.text || ''),
    detail: String(item?.detail || item?.title || item?.text || '')
  }
}

const items = computed(() => {
  const seen = new Set()
  return (Array.isArray(props.citations) ? props.citations : [])
    .map(normalize)
    .filter(item => {
      const key = item.detail || item.text
      if (!key || seen.has(key)) return false
      seen.add(key)
      return true
    })
    .slice(0, Math.max(1, props.max))
})
</script>

<template>
  <div v-if="items.length" class="answer-citations" aria-label="检索依据">
    <span class="citation-label"><i class="citation-dot" aria-hidden="true"></i>检索依据</span>
    <span
      v-for="(item, index) in items"
      :key="`${item.detail}-${index}`"
      class="citation-chip"
      :title="item.title ? `${item.title}：${item.detail}` : item.text"
    >{{ item.detail || item.title }}</span>
  </div>
</template>

<style scoped>
.answer-citations{display:flex;align-items:center;flex-wrap:wrap;gap:6px;margin:2px 0 8px}
.citation-label{display:inline-flex;align-items:center;gap:5px;color:var(--muted);font-size:calc(11px*var(--fs-scale));white-space:nowrap}
.citation-dot{width:5px;height:5px;border-radius:50%;background:var(--primary);flex:none}
.citation-chip{max-width:260px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;padding:2px 8px;border:1px solid color-mix(in srgb,var(--primary) 24%,transparent);border-radius:999px;background:var(--primary-soft);color:#3f6b65;font-size:calc(10.5px*var(--fs-scale));line-height:1.7}
@media(max-width:600px){.citation-chip{max-width:100%}}
</style>
