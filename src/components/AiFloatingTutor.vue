<script setup>
import { ref } from 'vue'
import { streamTutor } from '../services/api.js'
import AgentTrace from './AgentTrace.vue'
import { formatMathText } from '../utils/formatMath.js'
const props = defineProps({ context: { type: Object, default: () => ({}) } })
const open = ref(false); const question = ref(''); const loading = ref(false); const streaming = ref(false); const messages = ref([]); const lastAsked = ref(0)
async function ask(){
  const text = question.value.trim(); if (!text || loading.value) return
  if (Date.now() - lastAsked.value < 12000) { messages.value.push({ role: 'assistant', content: '我们每隔一会儿再问一个问题，先把刚才的思路消化一下吧。' }); return }
  lastAsked.value = Date.now(); messages.value.push({ role: 'user', content: text }); question.value = ''; loading.value = true
  const history = messages.value.slice(-8, -1).map(message => ({ role: message.role, content: message.content }))
  // 悬浮球与主问答共用同一套流式协议，思考步骤也在小面板里可见。
  const assistant = { role: 'assistant', content: '', thinking: '', tools: [], streaming: true }
  messages.value.push(assistant); streaming.value = true
  const result = await streamTutor(
    { question: text, sessionId: 'focus-floating', context: props.context, history },
    {
      onThinking: delta => { assistant.thinking += delta },
      onToken: delta => { assistant.content += delta },
      onTool: tool => {
        if (tool.status === 'start') assistant.tools.push({ name: tool.name, label: tool.label, status: 'start', summary: '' })
        else {
          const target = assistant.tools.find(item => item.name === tool.name && item.status === 'start')
          if (target) { target.status = 'done'; target.summary = tool.summary || '' }
        }
      },
      onReplace: content => { assistant.content = content },
      onDone: final => { if (final.content) assistant.content = final.content }
    }
  )
  assistant.streaming = false
  assistant.tools.forEach(tool => { if (tool.status === 'start') tool.status = 'done' })
  streaming.value = false; loading.value = false
  if (result.error && !assistant.content) assistant.content = '无法连接本机服务，请确认后端已启动后重试。'
  if (!assistant.content) assistant.content = '先从已知条件入手，写出你能确定的知识点，再尝试一步一步推导。'
}
</script>
<template>
  <div class="floating-tutor"><el-button type="primary" class="tutor-button" @click="open=!open"><span class="tutor-icon">✦</span><span>AI 学习助手</span></el-button>
    <div v-if="open" class="tutor-panel surface"><div class="tutor-title"><strong>专注小问答</strong><el-button text @click="open=false">×</el-button></div><div class="tutor-messages"><p v-if="!messages.length" class="muted">卡住时可以问我，我会拆解思路和知识点，不直接给完整答案。</p><template v-for="(message,index) in messages" :key="index"><AgentTrace v-if="message.role === 'assistant'" :thinking="message.thinking || ''" :tools="message.tools || []" :streaming="Boolean(message.streaming)" /><div v-if="message.content" :class="['bubble',message.role]" v-html="formatMathText(message.content)"></div></template></div><div class="tutor-input"><el-input v-model="question" size="small" placeholder="输入一个小问题…" @keyup.enter="ask"/><el-button size="small" type="primary" :loading="loading && !streaming" :disabled="streaming" @click="ask">问</el-button></div></div>
  </div>
</template>
<style scoped>.floating-tutor{position:fixed;right:25px;bottom:25px;z-index:20}.tutor-button{height:49px;padding:0 17px;border-radius:17px;box-shadow:0 10px 25px rgba(60,105,170,.3);font-weight:700;letter-spacing:.02em}.tutor-icon{display:grid;place-items:center;width:24px;height:24px;margin-right:7px;border-radius:8px;background:rgba(255,255,255,.22);font-size:18px}.tutor-panel{position:absolute;right:0;bottom:62px;width:340px;padding:15px}.tutor-title{display:flex;justify-content:space-between;align-items:center}.tutor-messages{height:220px;overflow:auto;padding:9px 0}.bubble{padding:8px 10px;border-radius:10px;margin:6px 0;font-size:13px;line-height:1.55}.bubble.user{background:var(--primary-soft);margin-left:36px}.bubble.assistant{background:var(--surface-soft);margin-right:18px}.bubble :deep(sup){font-size:.72em;line-height:0;vertical-align:super}.bubble :deep(sub){font-size:.72em;line-height:0;vertical-align:sub}.bubble :deep(.math-frac){display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;margin:0 2px}.bubble :deep(.math-frac span:first-child){border-bottom:1px solid currentColor;padding:0 2px}.bubble :deep(.math-frac span:last-child){padding-top:1px}.tutor-input{display:flex;gap:6px}@media(max-width:600px){.floating-tutor{right:14px;bottom:14px}.tutor-button{height:44px;padding:0 13px}.tutor-panel{right:-2px;width:min(340px,calc(100vw - 28px))}}</style>
