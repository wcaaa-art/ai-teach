<script setup>
import { onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { askTutorWithImage, streamTutor } from '../services/api.js'
import AgentTrace from '../components/AgentTrace.vue'
import { pauseSpeech, resumeSpeech, speakWithFriendlyChineseVoice, stopSpeech } from '../services/speech.js'
import { loadConversations, makeId, saveConversation } from '../db/index.js'
import { useAppStore } from '../stores/app.js'
import { formatMathText } from '../utils/formatMath.js'

const store = useAppStore()
const loading = ref(false)
const input = ref('')
const messages = ref([])
const conversations = ref([])
const isListening = ref(false)
const imageData = ref('')
const imagePreview = ref('')
const fileInput = ref(null)
const messagesEl = ref(null)
const speakingIndex = ref(null)
const speechPaused = ref(false)
let recognition
const session = reactive({ id: makeId('conversation'), createdAt: Date.now(), title: '新的答疑会话' })
const streaming = ref(false)
const streamController = ref(null)
let scrollTimer = 0

// 每个 token 都触发滚动会拖慢渲染，合并到 60ms 一次。
function scrollBottom() {
  if (scrollTimer) return
  scrollTimer = setTimeout(() => {
    scrollTimer = 0
    if (messagesEl.value) messagesEl.value.scrollTop = messagesEl.value.scrollHeight
  }, 60)
}

function stopStreaming() { streamController.value?.abort() }
async function refreshConversations() { conversations.value = (await loadConversations()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)) }
async function openConversation(conversation) { if (!conversation) return; if (streaming.value) stopStreaming(); session.id = conversation.id; session.createdAt = conversation.createdAt; session.title = conversation.title; messages.value = conversation.messages || []; scrollBottom() }
async function newConversation() { if (streaming.value) stopStreaming(); if (messages.value.length) await saveConversation({ ...session, messages: messages.value, updatedAt: Date.now() }); session.id = makeId('conversation'); session.createdAt = Date.now(); session.title = '新的答疑会话'; messages.value = []; input.value = ''; clearImage(); await refreshConversations(); scrollBottom() }

function clearImage() { imageData.value = ''; imagePreview.value = ''; if (fileInput.value) fileInput.value.value = '' }

function selectImage() { fileInput.value?.click() }
function handleImage(event) {
  const file = event.target.files?.[0]
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { ElMessage.warning('请选择 JPG、PNG、WebP 或 GIF 图片。'); return }
  if (file.size > 5 * 1024 * 1024) { ElMessage.warning('图片请压缩到 5 MB 以内。'); return }
  const reader = new FileReader()
  reader.onload = () => { imageData.value = String(reader.result); imagePreview.value = String(reader.result) }
  reader.onerror = () => ElMessage.info('图片读取失败，请重试。')
  reader.readAsDataURL(file)
}

// 流式应答：正文逐 token 追加，推理与工具调用同步写入当前消息，供 AgentTrace 展示。
async function streamAnswer(text, history) {
  messages.value.push({ role: 'assistant', content: '', thinking: '', tools: [], streaming: true, createdAt: Date.now() })
  // 必须操作数组里的响应式代理：直接改 push 前的原始对象不会触发渲染，token 会攒到结束才一次性出现。
  const assistant = messages.value[messages.value.length - 1]
  streaming.value = true
  scrollBottom()
  const result = await streamTutor(
    { question: text, sessionId: session.id, history, context: { profile: store.profile, conversationId: session.id } },
    {
      onStart: controller => { streamController.value = controller },
      onThinking: delta => { assistant.thinking += delta; scrollBottom() },
      onToken: delta => { assistant.content += delta; scrollBottom() },
      onTool: tool => {
        if (tool.status === 'start') assistant.tools.push({ name: tool.name, label: tool.label, status: 'start', summary: '' })
        else {
          const target = assistant.tools.find(item => item.name === tool.name && item.status === 'start')
          if (target) { target.status = 'done'; target.summary = tool.summary || '' }
        }
        scrollBottom()
      },
      onReplace: content => { assistant.content = content },
      onDone: final => { if (final.content) assistant.content = final.content }
    }
  )
  assistant.streaming = false
  assistant.tools.forEach(tool => { if (tool.status === 'start') tool.status = 'done' })
  streamController.value = null
  streaming.value = false
  if (result.cancelled) {
    if (!assistant.content) assistant.content = '已停止生成。'
  } else if (result.error && !assistant.content) {
    assistant.content = result.error
  } else if (!assistant.content) {
    assistant.content = '我暂时没有组织出回答，你可以把题目条件再补充一点。'
  }
}

async function send(text = input.value) {
  text = String(text || '').trim()
  if ((!text && !imageData.value) || loading.value) return
  const shownText = text || '请分析这张学习图片，并提示我下一步思路。'
  messages.value.push({ role: 'user', content: shownText, image: imagePreview.value, createdAt: Date.now() })
  if (messages.value.length === 1) session.title = text.slice(0, 28) || '图片学习提问'
  input.value = ''; loading.value = true; scrollBottom()
  const history = messages.value.slice(-13, -1).map(message => ({ role: message.role, content: message.content }))
  if (imageData.value) {
    // 图文多模态仍走一次性请求：图片体积大，流式收益低且模型兼容性更脆。
    const result = await askTutorWithImage({ question: text, image: imageData.value, history, sessionId: session.id })
    const answer = result.data?.answer || (result.error?.includes('401') ? 'DeepSeek API key 没有通过验证。请检查项目根目录 .env 中的 DEEPSEEK_API_KEY，并重启 npm run dev。' : '我先帮你拆出题目中的已知条件，再一起判断要用哪个知识点。')
    messages.value.push({ role: 'assistant', content: answer, createdAt: Date.now() })
    clearImage()
  } else {
    await streamAnswer(text, history)
  }
  loading.value = false
  await saveConversation({ ...session, messages: messages.value.map(({ image, ...message }) => message), updatedAt: Date.now() })
  await refreshConversations(); scrollBottom()
}

function toggleVoice() {
  if (isListening.value) { recognition?.stop(); return }
  const Speech = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!Speech) { ElMessage.info('当前浏览器暂不支持语音输入。'); return }
  recognition = new Speech(); recognition.lang = 'zh-CN'; recognition.continuous = false
  recognition.onstart = () => { isListening.value = true }
  recognition.onend = () => { isListening.value = false }
  recognition.onerror = () => { isListening.value = false; ElMessage.info('语音输入暂不可用，可以直接打字。') }
  recognition.onresult = event => { input.value = event.results[0][0].transcript }
  try { recognition.start() } catch { isListening.value = false }
}

function resetSpeechState() { speakingIndex.value = null; speechPaused.value = false }
function toggleSpeak(text, index) {
  if (!store.settings.ttsEnabled || !('speechSynthesis' in window)) return
  if (speakingIndex.value === index) {
    if (speechPaused.value) { resumeSpeech(); speechPaused.value = false } else { pauseSpeech(); speechPaused.value = true }
    return
  }
  try {
    speakingIndex.value = index
    speechPaused.value = false
    if (!speakWithFriendlyChineseVoice(text, { onend: resetSpeechState, onerror: resetSpeechState })) resetSpeechState()
  } catch { resetSpeechState(); ElMessage.info('语音朗读暂不可用。') }
}
function stopSpeaking() {
  stopSpeech()
  resetSpeechState()
}

onMounted(async () => { await refreshConversations(); if (conversations.value[0]) await openConversation(conversations.value[0]) })
onBeforeUnmount(stopSpeaking)
</script>

<template>
  <div class="page tutor-page-shell">
    <div class="page-header">
      <div><span class="eyebrow">AI STUDY COPILOT · 多模态答疑</span><h2 class="page-title">学习问答</h2><p class="page-subtitle">像和学习教练聊天一样提问：文字、语音和图片都可以。回答会保留你的思考空间。</p></div>
      <div class="actions"><el-select v-if="conversations.length" :model-value="session.id" placeholder="历史会话" style="width:210px" @change="id => openConversation(conversations.find(item => item.id === id))"><el-option v-for="item in conversations" :key="item.id" :label="item.title || '新的答疑会话'" :value="item.id" /></el-select><el-button plain @click="newConversation">新建会话</el-button></div>
    </div>
    <section class="surface tutor-page">
      <div ref="messagesEl" class="conversation">
        <div v-if="!messages.length" class="empty welcome-chat"><div class="welcome-orb">✦</div><h3>今天想把哪个卡点变清楚？</h3><p>可以上传题目截图，我会先识别内容，再用提示式语言帮你拆解。</p><div class="suggestion-row"><el-button plain @click="input='我不理解二次函数顶点式'">二次函数顶点式</el-button><el-button plain @click="input='帮我拆解这道物理题的已知条件'">物理题拆解</el-button></div></div>
        <div v-for="(message,index) in messages" :key="index" :class="['conversation-row', message.role]"><div class="avatar">{{ message.role === 'user' ? '我' : '知' }}</div><div class="message-content"><AgentTrace v-if="message.role === 'assistant'" :thinking="message.thinking || ''" :tools="message.tools || []" :streaming="Boolean(message.streaming)" /><img v-if="message.image" :src="message.image" class="message-image" alt="用户上传的学习图片" /><div v-if="message.content" class="message-bubble math-content" v-html="formatMathText(message.content)"></div><span v-if="message.streaming && message.content" class="stream-cursor" aria-hidden="true"></span><div v-if="message.role === 'assistant' && message.content" class="speech-actions"><el-button text size="small" @click="toggleSpeak(message.content,index)">{{ speakingIndex === index ? (speechPaused ? '▶ 继续' : '⏸ 暂停') : '🔊 朗读' }}</el-button><el-button v-if="speakingIndex === index" text size="small" class="stop-speech" @click="stopSpeaking">■ 停止</el-button></div></div></div>
        <div v-if="loading && !streaming" class="conversation-row assistant"><div class="avatar">知</div><div class="message-bubble typing">正在读取学习内容并整理思路…</div></div>
      </div>
      <div class="composer">
        <div v-if="imagePreview" class="image-draft"><img :src="imagePreview" alt="待发送图片" /><div><strong>图片已添加</strong><small>发送后会由 DeepSeek 多模态模型分析</small></div><el-button text @click="clearImage">移除</el-button></div>
        <div class="composer-tools"><div class="tool-actions"><el-button circle plain class="tool-button" :type="isListening ? 'danger' : 'default'" aria-label="语音输入" title="语音输入" @click="toggleVoice">🎙</el-button><el-button circle plain class="tool-button" aria-label="上传图片" title="上传图片" @click="selectImage">📎</el-button><input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="handleImage" /></div><span class="privacy-hint muted">图片只在本次请求中发送，不写入本地会话历史</span></div>
        <div class="composer-row"><el-input v-model="input" type="textarea" :rows="3" resize="none" placeholder="描述你的卡点，或先上传题目截图…" @keyup.ctrl.enter="send()" /><el-button v-if="streaming" size="large" plain @click="stopStreaming">停止</el-button><el-button type="primary" size="large" :loading="loading && !streaming" :disabled="streaming" @click="send()">发送</el-button></div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tutor-page-shell{max-width:1120px}.tutor-page{max-width:920px;margin:0 auto;overflow:hidden}.conversation{height:calc(100vh - 330px);min-height:390px;overflow:auto;padding:28px}.welcome-chat h3{margin:12px 0 7px;color:var(--text)}.welcome-chat p{margin:0 auto 18px;max-width:420px}.welcome-orb{width:58px;height:58px;margin:auto;display:grid;place-items:center;border-radius:18px;background:linear-gradient(145deg,var(--primary),#83bdb0);color:#fff;font-size:28px;box-shadow:0 12px 30px rgba(64,125,124,.25)}.suggestion-row{display:flex;justify-content:center;gap:9px;flex-wrap:wrap}.conversation-row{display:flex;gap:10px;margin:17px 0;align-items:flex-start}.conversation-row.user{flex-direction:row-reverse}.avatar{width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:var(--primary-soft);color:var(--primary);font-size:12px;flex:none}.message-content{max-width:77%}.message-bubble{line-height:1.75;white-space:pre-wrap;background:var(--surface-soft);border:1px solid var(--border);padding:12px 15px;border-radius:5px 16px 16px 16px}.user .message-bubble{background:var(--primary);border-color:var(--primary);color:#fff;border-radius:16px 5px 16px 15px}.message-image{display:block;max-width:260px;max-height:210px;border-radius:12px;margin-bottom:8px;border:1px solid var(--border)}.composer{border-top:1px solid var(--border);padding:15px 20px}.composer-tools{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;column-gap:14px;width:100%;margin-bottom:9px;font-size:12px}.tool-actions{display:flex;align-items:center;gap:9px}.tool-button{width:40px;height:40px;margin:0}.privacy-hint{display:block;min-width:0;text-align:right;line-height:1.45;white-space:normal}.composer-row{display:flex;gap:10px;align-items:flex-end}.composer-row .el-input{flex:1}.image-draft{display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:10px;border:1px solid var(--border);border-radius:11px;background:var(--surface-soft)}.image-draft img{width:46px;height:46px;object-fit:cover;border-radius:7px}.image-draft div{display:grid;gap:3px;flex:1}.image-draft small{color:var(--muted)}@media(max-width:700px){.tutor-page-shell .page-header{flex-direction:column}.conversation{padding:18px}.message-content{max-width:86%}.composer-tools{grid-template-columns:auto 1fr;column-gap:10px}.privacy-hint{font-size:11px}.tool-button{width:38px;height:38px}}
.math-content :deep(sup){font-size:.72em;line-height:0;vertical-align:super}.math-content :deep(sub){font-size:.72em;line-height:0;vertical-align:sub}.math-content :deep(.math-frac){display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;margin:0 3px}.math-content :deep(.math-frac span:first-child){border-bottom:1px solid currentColor;padding:0 3px}.math-content :deep(.math-frac span:last-child){padding:1px 3px 0}
.speech-actions{display:flex;align-items:center;gap:2px;margin-top:3px}.stop-speech{color:#b86f61}
.stream-cursor{display:inline-block;width:3px;height:14px;margin-left:2px;border-radius:2px;background:var(--primary);vertical-align:-2px;animation:stream-blink 1s steps(2,start) infinite}
@keyframes stream-blink{0%,100%{opacity:1}50%{opacity:0}}
</style>

