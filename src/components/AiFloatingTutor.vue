<script setup>
import { ref } from 'vue'
import { streamTutor } from '../services/api.js'
import AgentTrace from './AgentTrace.vue'
import AnswerCitations from './AnswerCitations.vue'
import SourceBadge from './SourceBadge.vue'
import { formatMathText } from '../utils/formatMath.js'
const props = defineProps({ context: { type: Object, default: () => ({}) } })
const open = ref(false); const question = ref(''); const loading = ref(false); const streaming = ref(false); const messages = ref([]); const lastAsked = ref(0)
async function ask(){
  const text = question.value.trim(); if (!text || loading.value) return
  if (Date.now() - lastAsked.value < 12000) { messages.value.push({ role: 'assistant', content: '我们每隔一会儿再问一个问题，先把刚才的思路消化一下吧' }); return }
  lastAsked.value = Date.now(); messages.value.push({ role: 'user', content: text }); question.value = ''; loading.value = true
  const history = messages.value.slice(-8, -1).map(message => ({ role: message.role, content: message.content }))
  // 悬浮球与主问答共用同一套流式协议，思考步骤也在小面板里可见。
  const assistant = { role: 'assistant', content: '', thinking: '', tools: [], citations: [], source: '', guard: '', streaming: true }
  messages.value.push(assistant); streaming.value = true
  const result = await streamTutor(
    { question: text, sessionId: 'focus-floating', context: props.context, history },
    {
      onMeta: meta => { if (meta.source) assistant.source = meta.source },
      onThinking: delta => { assistant.thinking += delta },
      onToken: delta => { assistant.content += delta },
      onTool: tool => {
        if (tool.status === 'start') assistant.tools.push({ name: tool.name, label: tool.label, status: 'start', summary: '' })
        else {
          const target = assistant.tools.find(item => item.name === tool.name && item.status === 'start')
          if (target) { target.status = 'done'; target.summary = tool.summary || '' }
          if (tool.citations?.length) assistant.citations = tool.citations
        }
      },
      onReplace: (content, reason) => { assistant.content = content; if (reason) assistant.guard = reason },
      onDone: final => {
        if (final.content) assistant.content = final.content
        if (final.source) assistant.source = final.source
        for (const tool of final.tools || []) if (tool.citations?.length) assistant.citations = tool.citations
      }
    }
  )
  assistant.streaming = false
  assistant.tools.forEach(tool => { if (tool.status === 'start') tool.status = 'done' })
  assistant.source = assistant.source || (result.error ? 'mock' : 'deepseek')
  streaming.value = false; loading.value = false
  if (result.error && !assistant.content) { assistant.content = '无法连接本机服务，请确认后端已启动后重试'; assistant.source = 'mock' }
  if (!assistant.content) assistant.content = '先从已知条件入手，写出你能确定的知识点，再尝试一步一步推导'
}
</script>
<template>
  <div class="floating-tutor"><el-button type="primary" class="tutor-button" @click="open=!open"><span class="tutor-icon">✦</span><span class="tutor-text">AI 学习助手</span></el-button>
    <div v-if="open" class="tutor-panel surface"><div class="tutor-title"><strong>专注小问答</strong><el-button text @click="open=false">×</el-button></div><div class="tutor-messages"><p v-if="!messages.length" class="muted">卡住时可以问我，我会拆解思路和知识点，不直接给完整答案</p><template v-for="(message,index) in messages" :key="index"><AgentTrace v-if="message.role === 'assistant'" :thinking="message.thinking || ''" :tools="message.tools || []" :streaming="Boolean(message.streaming)" /><div v-if="message.content" :class="['bubble',message.role]" v-html="formatMathText(message.content)"></div><AnswerCitations v-if="message.role === 'assistant' && !message.streaming && message.citations?.length" :citations="message.citations" :max="2" /><div v-if="message.role === 'assistant' && message.content && (message.source || message.guard)" class="float-answer-meta"><SourceBadge :source="message.guard || message.source" /></div></template></div><div class="tutor-input"><el-input v-model="question" size="small" placeholder="输入一个小问题…" @keyup.enter="ask"/><el-button size="small" type="primary" :loading="loading && !streaming" :disabled="streaming" @click="ask">问</el-button></div></div>
  </div>
</template>
<style scoped>
/* 助手按钮固定在右下角，面板向上展开；右上角留给导航的通知与设置。 */
.floating-tutor{position:fixed;right:25px;bottom:24px;top:auto;z-index:20}
.tutor-button{height:49px;padding:0 17px;border-radius:17px;box-shadow:0 10px 25px rgba(60,105,170,.3);font-weight:700;letter-spacing:.02em}
.tutor-icon{display:grid;place-items:center;width:24px;height:24px;margin-right:7px;border-radius:8px;background:rgba(255,255,255,.22);font-size:calc(18px*var(--fs-scale))}
.tutor-panel{position:absolute;right:0;bottom:62px;top:auto;width:340px;padding:15px}
.tutor-title{display:flex;justify-content:space-between;align-items:center}
.tutor-messages{height:220px;overflow:auto;padding:9px 0}
.bubble{padding:8px 10px;border-radius:10px;margin:6px 0;font-size:calc(13px*var(--fs-scale));line-height:1.55}
.bubble.user{background:var(--primary-soft);margin-left:36px}
.bubble.assistant{background:var(--surface-soft);margin-right:18px}
.float-answer-meta{display:flex;justify-content:flex-end;margin:-2px 18px 6px 0}
.answer-citations{margin:2px 18px 4px 0}
.bubble :deep(sup){font-size:.72em;line-height:0;vertical-align:super}
.bubble :deep(sub){font-size:.72em;line-height:0;vertical-align:sub}
.bubble :deep(.math-frac){display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;margin:0 2px}
.bubble :deep(.math-frac span:first-child){border-bottom:1px solid currentColor;padding:0 2px}
.bubble :deep(.math-frac span:last-child){padding-top:1px}
.tutor-input{display:flex;gap:6px}
/* 手机端缩成 46px 圆形图标：底部标签栏 64px，右侧还要给跨页专注胶囊留 92px。 */
@media(max-width:600px){
  .floating-tutor{right:14px;bottom:76px;top:auto}
  .tutor-button{width:46px;min-width:46px;height:46px;padding:0;border-radius:15px;display:flex;align-items:center;justify-content:center}
  .tutor-text{display:none}
  .tutor-icon{margin-right:0}
  .tutor-panel{right:0;bottom:58px;top:auto;width:min(340px,calc(100vw - 28px))}
}
</style>
