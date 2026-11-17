<script setup>
import { ref } from 'vue'
import FeedbackDialog from './FeedbackDialog.vue'

// 有跨页专注胶囊时反馈按钮要让位，没有计时任务时贴回标签栏上方，避免悬空。
const props = defineProps({ raised: { type: Boolean, default: false } })
const open = ref(false)
</script>
<template>
  <div class="feedback-entry" :class="{ 'is-raised': props.raised }">
    <button type="button" class="feedback-toggle" title="意见反馈" aria-label="意见反馈" @click="open = true">
      <svg class="feedback-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M4.5 5.5h15v10.6H9.6L4.5 19V5.5z" /></svg>
      <span class="feedback-label">意见反馈</span>
    </button>
    <FeedbackDialog v-model="open" />
  </div>
</template>
<style scoped>
.feedback-entry{position:fixed;left:24px;bottom:24px;z-index:21}
.feedback-toggle{display:inline-flex;align-items:center;gap:6px;padding:10px 16px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text);font-family:inherit;font-weight:700;font-size:calc(13px*var(--fs-scale));line-height:1;cursor:pointer;box-shadow:0 10px 26px rgba(0,0,0,.18);transition:transform .16s,box-shadow .16s}
.feedback-icon{display:none;width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.feedback-label{white-space:nowrap}
.feedback-toggle:hover{transform:translateY(-1px);box-shadow:0 14px 30px rgba(0,0,0,.22)}
/* 桌面端改成贴左边缘的竖排小签：正文从 36px 起，30px 宽的签子落在留白里，一行字都不遮。
   签子上已经竖着写了「意见反馈」，所以不做悬停展开——展开会改变自身尺寸，指针停在边缘时
   会反复进出触发抖动。 */
@media(min-width:801px){
  .feedback-entry{left:0;bottom:120px}
  .feedback-toggle{display:inline-flex;align-items:center;justify-content:center;width:30px;height:auto;padding:14px 0;border-left:0;border-radius:0 12px 12px 0;writing-mode:vertical-rl;letter-spacing:.14em;font-size:calc(12px*var(--fs-scale));box-shadow:0 8px 20px rgba(0,0,0,.12)}
  .feedback-icon{display:none}
  .feedback-label{display:inline}
}
/* 手机端原来贴在标签栏后面（bottom 14 会被导航盖住），现在默认落在标签栏上方，让出刘海横向安全区。 */
@media(max-width:800px){.feedback-entry{left:auto;right:calc(14px + env(safe-area-inset-right));bottom:calc(76px + env(safe-area-inset-bottom))}.feedback-entry.is-raised{bottom:calc(132px + env(safe-area-inset-bottom))}
  /* 手机端收成 42px 圆形图标并靠右，避免长条按钮压住卡片正文。 */
  .feedback-toggle{width:42px;height:42px;padding:0;justify-content:center;border-radius:50%;box-shadow:0 8px 22px rgba(0,0,0,.16)}
  .feedback-icon{display:block}
  .feedback-label{display:none}
}
</style>
