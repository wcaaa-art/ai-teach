<script setup>
import { computed } from 'vue'
import { formatMathText } from '../utils/formatMath.js'

// 题目选项展示：错题详情、练习回顾、测验回顾共用一套样式。
// correct / chosen 传选项下标数组，单选传一个元素，多选传多个；flags 打开后显示「你的选择 / 正确答案」标记。
// selectable 用于试卷识别页核对答案：选项可点击，点击后抛出 select 下标。
const props = defineProps({
  options: { type: Array, default: () => [] },
  correct: { type: Array, default: () => [] },
  chosen: { type: Array, default: () => [] },
  flags: { type: Boolean, default: false },
  selectable: { type: Boolean, default: false }
})
const emit = defineEmits(['select'])

const LETTERS = 'ABCDEFGH'
const list = computed(() => {
  const correct = props.correct.map(Number)
  const chosen = props.chosen.map(Number)
  return (Array.isArray(props.options) ? props.options : []).map((text, index) => ({
    label: LETTERS[index] || String(index + 1),
    text: String(text ?? ''),
    right: correct.includes(index),
    picked: chosen.includes(index)
  }))
})

function stateOf(item) {
  if (item.right && item.picked) return 'both'
  if (item.right) return 'right'
  return item.picked ? 'wrong' : ''
}

function flagOf(item) {
  if (!props.flags) return ''
  if (item.right && item.picked) return '你的选择 · 正确'
  if (item.right) return '正确答案'
  return item.picked ? '你的选择 · 错误' : ''
}
</script>

<template>
  <ul v-if="list.length" class="question-options" :aria-label="selectable ? '选择正确答案' : '选项'">
    <li
      v-for="(item, index) in list"
      :key="index"
      :class="[stateOf(item), { selectable }]"
      :role="selectable ? 'button' : null"
      :tabindex="selectable ? 0 : null"
      @click="selectable && emit('select', index)"
      @keydown.enter.prevent="selectable && emit('select', index)"
      @keydown.space.prevent="selectable && emit('select', index)"
    >
      <span class="qo-key">{{ item.label }}</span>
      <span class="qo-text" v-html="formatMathText(item.text)"></span>
      <em v-if="flagOf(item)" class="qo-flag">{{ flagOf(item) }}</em>
    </li>
  </ul>
</template>

<style scoped>
.question-options{list-style:none;margin:10px 0;padding:0;display:grid;gap:6px}
.question-options li{display:flex;align-items:flex-start;gap:8px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--surface);font-size:calc(13px*var(--fs-scale));line-height:1.6}
.question-options li.right,.question-options li.both{border-color:var(--success,#67c23a);background:rgba(103,194,58,.1)}
.question-options li.wrong{border-color:var(--danger,#f56c6c);background:rgba(245,108,108,.1)}
.question-options li.selectable{cursor:pointer;transition:border-color .16s,background .16s}
.question-options li.selectable:not(.right):not(.both):not(.wrong):hover{border-color:var(--primary);background:var(--primary-soft)}
.question-options li.selectable:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.qo-key{display:grid;place-items:center;width:20px;height:20px;flex:none;border-radius:8px;border:1px solid var(--border);background:var(--surface-soft);font:700 11px ui-monospace,monospace}
.question-options li.right .qo-key,.question-options li.both .qo-key{color:var(--success,#67c23a);border-color:var(--success,#67c23a)}
.question-options li.wrong .qo-key{color:var(--danger,#f56c6c);border-color:var(--danger,#f56c6c)}
.qo-text{flex:1;min-width:0}
.qo-flag{flex:none;font-size:calc(11px*var(--fs-scale));font-style:normal;color:var(--muted);white-space:nowrap}
.question-options li.right .qo-flag,.question-options li.both .qo-flag{color:var(--success,#67c23a)}
.question-options li.wrong .qo-flag{color:var(--danger,#f56c6c)}
@media(max-width:560px){.qo-flag{display:none}}
</style>
