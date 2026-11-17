<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { askTutorWithImage, streamTutor } from '../services/api.js'
import AgentTrace from '../components/AgentTrace.vue'
import AnswerCitations from '../components/AnswerCitations.vue'
import SourceBadge from '../components/SourceBadge.vue'
import { pauseSpeech, resumeSpeech, speakWithFriendlyChineseVoice, stopSpeech } from '../services/speech.js'
import { loadConversations, loadMistakes, loadPlans, makeId, saveConversation, deleteConversation } from '../db/index.js'
import { useAppStore } from '../stores/app.js'
import { formatMathText } from '../utils/formatMath.js'

const store = useAppStore()
const route = useRoute()
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
// 从错题库/学习计划带入的上下文：发送时自动附在问题前面，界面上只显示一条可移除的提示。
const attachment = ref(null)
let scrollTimer = 0

// 上下文只保留与解题相关的字段，题干和解析做长度裁剪，避免把整页 OCR 文本塞进模型。
function clipContext(value, max = 900) {
  return String(value || '').trim().slice(0, max)
}

function mistakeContext(item) {
  const options = Array.isArray(item.options) && item.options.length
    ? `选项：${item.options.map((option, index) => `${'ABCD'[index]}. ${clipContext(option, 160)}`).join('；')}`
    : ''
  const lines = [
    `学段/科目：${[item.grade, item.subject].filter(Boolean).join(' · ') || '未标注'}`,
    item.chapterName ? `章节：${item.chapterName}` : '',
    item.knowledgeTags?.length ? `知识点：${item.knowledgeTags.join('、')}` : '',
    `题目：${clipContext(item.stem || item.text, 1200)}`,
    options,
    item.userAnswer ? `我的答案：${clipContext(item.userAnswer, 200)}` : '',
    item.correctAnswer ? `正确答案：${clipContext(item.correctAnswer, 200)}` : '',
    item.errorCause ? `我的错因：${clipContext(item.errorCause, 300)}` : '',
    item.explanation ? `参考解析：${clipContext(item.explanation, 900)}` : ''
  ].filter(Boolean)
  return `【错题上下文，来自错题库】\n${lines.join('\n')}`
}

function planContext(plan) {
  const lines = [
    `科目：${plan.subject || '综合'}`,
    `任务：${clipContext(plan.name, 200)}`,
    plan.chapterName ? `章节：${plan.chapterName}` : '',
    plan.knowledgeTags?.length ? `知识点：${plan.knowledgeTags.join('、')}` : '',
    plan.estimatedMinutes ? `预计时长：${plan.estimatedMinutes} 分钟` : '',
    plan.priority ? `优先级：${plan.priority}` : '',
    plan.reason ? `安排理由：${clipContext(plan.reason, 300)}` : ''
  ].filter(Boolean)
  return `【学习任务上下文，来自学习计划】\n${lines.join('\n')}`
}

// 从错题库或学习计划进入：开一个新话题，把题目/任务信息挂到这次提问上，并把问题预填到输入框。
async function attachStudyContext({ mistakeId = '', planId = '' } = {}) {
  try {
    if (mistakeId) {
      const item = (await loadMistakes()).find(entry => entry.id === mistakeId)
      if (item) {
        await newConversation()
        attachment.value = { label: `错题 · ${item.subject || '综合'}${item.chapterName ? ` · ${item.chapterName}` : ''}`, hint: '发送时会自动附上题目、作答与解析，不用重复粘贴。', block: mistakeContext(item) }
        input.value = isExplain.value
          ? '请完整讲解这道错题，指出我错在哪一步，再给我一道同类练习。'
          : '请带我把这道错题重新想一遍，先别直接给答案。'
        return
      }
    }
    if (planId) {
      const plan = (await loadPlans()).find(entry => entry.id === planId)
      if (plan) {
        await newConversation()
        attachment.value = { label: `学习任务 · ${plan.subject || '综合'} · ${clipContext(plan.name, 20)}`, hint: '发送时会自动附上任务、章节与知识点，不用重复描述。', block: planContext(plan) }
        input.value = isExplain.value
          ? `请完整讲解「${plan.name}」涉及的知识点和常见题型。`
          : `「${plan.name}」这个任务我没头绪，先带我想第一步。`
        return
      }
    }
  } catch (error) {
    console.warn('学习上下文读取失败，按普通答疑打开。', error)
  }
}

// 双模式：引导只给下一步思路，讲解给完整步骤与结论；选择会记住，下次进来沿用。
const tutorMode = ref(localStorage.getItem('ai-teach-tutor-mode') === 'explain' ? 'explain' : 'guide')
const isExplain = computed(() => tutorMode.value === 'explain')
const welcomeTitle = computed(() => (isExplain.value ? '哪道题想让我完整讲一遍？' : '今天想把哪个卡点变清楚？'))
const welcomeNote = computed(() => (isExplain.value
  ? '贴题目或拍照上传，我会按「考点 → 步骤 → 结论 → 易错点」讲透。'
  : '可以上传题目截图，我会先带你看条件、想知识点，把答案留给你自己写出来。'))
const composerPlaceholder = computed(() => (isExplain.value ? '贴出题目，我按步骤完整讲一遍…' : '描述你的卡点，我先带你一步步想…'))
const imageNote = computed(() => (isExplain.value ? '发送后按讲解模式给出完整步骤' : '发送后按引导模式先给下一步思路'))
const defaultImageQuestion = computed(() => (isExplain.value ? '请完整讲解图片中的这道题，给出步骤、结论和易错点。' : '请分析这张学习图片，并提示我下一步思路。'))

function setTutorMode(value) {
  if (loading.value || streaming.value) return
  tutorMode.value = value === 'explain' ? 'explain' : 'guide'
  localStorage.setItem('ai-teach-tutor-mode', tutorMode.value)
}

const welcomePrompts = computed(() => (isExplain.value
  ? ['帮我完整讲解二次函数顶点式这道题', '帮我完整讲解一道电学计算题']
  : ['我不理解二次函数顶点式', '帮我拆解这道物理题的已知条件']))

// 聊天时间：今天的消息只显示「今天 14:17」，旧消息带上日期。
function formatTime(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const clock = `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
  const today = new Date()
  return date.toDateString() === today.toDateString()
    ? `今天 ${clock}`
    : `${date.getMonth() + 1} 月 ${date.getDate()} 日 ${clock}`
}

async function copyMessage(text = '') {
  const value = String(text || '')
  if (!value) return
  try {
    await navigator.clipboard.writeText(value)
    ElMessage.success('已复制')
  } catch {
    ElMessage.info('复制失败，请手动选中文字复制。')
  }
}

// 行内富文本：**加粗** 先寄存成占位符，交给 formatMathText 处理公式与上下标后再还原。
function renderInline(text = '') {
  const bolds = []
  const guarded = String(text).replace(/\*\*([^*\n]+)\*\*/g, (_, inner) => {
    bolds.push(inner)
    return `\uE000${bolds.length - 1}\uE001`
  })
  return formatMathText(guarded).replace(/\uE000(\d+)\uE001/g, (_, index) => `<strong>${formatMathText(bolds[Number(index)])}</strong>`)
}

// 轻量 Markdown 渲染：标题、有序/无序列表、分隔线、段落；不额外引入依赖。
function renderAnswer(content = '') {
  const blocks = []
  let list = null
  const flushList = () => {
    if (!list) return
    blocks.push(`<${list.type}>${list.items.map(item => `<li>${renderInline(item)}</li>`).join('')}</${list.type}>`)
    list = null
  }
  for (const raw of String(content).split('\n')) {
    const line = raw.trim()
    if (!line) { flushList(); continue }
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushList()
      const level = heading[1].length <= 2 ? 3 : 4
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flushList(); blocks.push('<hr>'); continue }
    const ordered = line.match(/^\d+[.、)]\s*(.+)$/)
    if (ordered) {
      if (!list || list.type !== 'ol') { flushList(); list = { type: 'ol', items: [] } }
      list.items.push(ordered[1])
      continue
    }
    const bullet = line.match(/^[-*•·]\s+(.+)$/)
    if (bullet) {
      if (!list || list.type !== 'ul') { flushList(); list = { type: 'ul', items: [] } }
      list.items.push(bullet[1])
      continue
    }
    flushList()
    blocks.push(`<p>${renderInline(line)}</p>`)
  }
  flushList()
  return blocks.join('')
}

// Enter 直接发送，Shift+Enter 换行；中文输入法组词中的 Enter 不触发发送。
function onComposerKeydown(event) {
  if (event.key !== 'Enter' || event.shiftKey || event.isComposing) return
  event.preventDefault()
  send()
}

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
async function openConversation(conversation) { if (!conversation) return; if (streaming.value) stopStreaming(); attachment.value = null; session.id = conversation.id; session.createdAt = conversation.createdAt; session.title = conversation.title; messages.value = conversation.messages || []; scrollBottom() }
async function newConversation() { if (streaming.value) stopStreaming(); if (messages.value.length) await saveConversation({ ...session, messages: messages.value, updatedAt: Date.now() }); session.id = makeId('conversation'); session.createdAt = Date.now(); session.title = '新的答疑会话'; messages.value = []; input.value = ''; attachment.value = null; clearImage(); await refreshConversations(); scrollBottom() }
// 删除历史话题：确认后从本地库移除；删的是当前话题就顺手开一个新会话，
// 这里不能调 newConversation，否则会把内存里刚删掉的聊天记录又存回去。
async function removeConversation(id) {
  const target = conversations.value.find(item => item.id === id)
  if (!target) return
  try {
    await ElMessageBox.confirm('删除后这个话题的聊天记录无法恢复，确定删除吗？', '删除话题', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
    })
  } catch { return }
  if (session.id === id && streaming.value) stopStreaming()
  await deleteConversation(id)
  await refreshConversations()
  if (session.id === id) {
    session.id = makeId('conversation')
    session.createdAt = Date.now()
    session.title = '新的答疑会话'
    messages.value = []
    input.value = ''
    clearImage()
  }
  ElMessage.success('已删除话题')
}

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

// 同一条回答可能经历多轮工具调用，引用按出处去重后合并，最多保留 4 条。
function mergeCitations(current = [], incoming = []) {
  const list = Array.isArray(current) ? [...current] : []
  const seen = new Set(list.map(item => (typeof item === 'string' ? item : item?.text || item?.detail || '')))
  for (const item of Array.isArray(incoming) ? incoming : []) {
    const key = typeof item === 'string' ? item : item?.text || item?.detail || ''
    if (!key || seen.has(key)) continue
    seen.add(key)
    list.push(item)
  }
  return list.slice(0, 4)
}

// 流式应答：正文逐 token 追加，推理与工具调用同步写入当前消息，供 AgentTrace 展示。
async function streamAnswer(text, history) {
  const answerMode = tutorMode.value
  messages.value.push({ role: 'assistant', content: '', thinking: '', tools: [], citations: [], source: '', guard: '', streaming: true, mode: answerMode, createdAt: Date.now() })
  // 必须操作数组里的响应式代理：直接改 push 前的原始对象不会触发渲染，token 会攒到结束才一次性出现。
  const assistant = messages.value[messages.value.length - 1]
  streaming.value = true
  scrollBottom()
  const result = await streamTutor(
    { question: text, sessionId: session.id, mode: answerMode, history, context: { profile: store.profile, conversationId: session.id } },
    {
      onStart: controller => { streamController.value = controller },
      onMeta: meta => { if (meta.source) assistant.source = meta.source },
      onThinking: delta => { assistant.thinking += delta; scrollBottom() },
      onToken: delta => { assistant.content += delta; scrollBottom() },
      onTool: tool => {
        if (tool.status === 'start') assistant.tools.push({ name: tool.name, label: tool.label, status: 'start', summary: '' })
        else {
          const target = assistant.tools.find(item => item.name === tool.name && item.status === 'start')
          if (target) { target.status = 'done'; target.summary = tool.summary || '' }
          assistant.citations = mergeCitations(assistant.citations, tool.citations)
        }
        scrollBottom()
      },
      onReplace: (content, reason) => { assistant.content = content; if (reason) assistant.guard = reason },
      onDone: final => {
        if (final.content) assistant.content = final.content
        if (final.source) assistant.source = final.source
        for (const tool of final.tools || []) assistant.citations = mergeCitations(assistant.citations, tool.citations)
      }
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
    assistant.source = 'mock'
  } else if (!assistant.content) {
    assistant.content = '我暂时没有组织出回答，你可以把题目条件再补充一点。'
  }
  // 没有收到 meta 的网络异常，按本地兜底展示，避免无来源标注。
  assistant.source = assistant.source || (result.error ? 'mock' : 'deepseek')
}

async function send(text = input.value) {
  text = String(text || '').trim()
  if ((!text && !imageData.value) || loading.value) return
  const shownText = text || defaultImageQuestion.value
  // 界面气泡只显示用户自己写的问题，发给模型的内容自动带上错题/计划上下文。
  const apiQuestion = attachment.value ? `${attachment.value.block}\n\n我的问题：${shownText}` : shownText
  messages.value.push({ role: 'user', content: shownText, image: imagePreview.value, createdAt: Date.now() })
  if (messages.value.length === 1) session.title = text.slice(0, 28) || attachment.value?.label || '图片学习提问'
  input.value = ''; loading.value = true; scrollBottom()
  const history = messages.value.slice(-13, -1).map(message => ({ role: message.role, content: message.content }))
  if (imageData.value) {
    // 图文多模态仍走一次性请求：图片体积大，流式收益低且模型兼容性更脆。
    const result = await askTutorWithImage({ question: apiQuestion, image: imageData.value, history, sessionId: session.id, mode: tutorMode.value })
    const answer = result.data?.answer || (result.error?.includes('401') ? 'DeepSeek API key 没有通过验证。请检查项目根目录 .env 中的 DEEPSEEK_API_KEY，并重启 npm run dev。' : (isExplain.value ? '这道题可以按「考点 → 步骤 → 结论」来拆。你把原题文字发我，我按步骤完整讲一遍。' : '我先帮你拆出题目中的已知条件，再一起判断要用哪个知识点。'))
    // 图片链路走一次性请求，后端同样会回传 source（模型 / 安全过滤 / 本地兜底），一并标注。
    messages.value.push({ role: 'assistant', content: answer, source: result.source || (result.success ? 'deepseek' : 'mock'), mode: tutorMode.value, createdAt: Date.now() })
    clearImage()
  } else {
    await streamAnswer(apiQuestion, history)
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

onMounted(async () => {
  await refreshConversations()
  // 从错题库/学习计划带上下文进来：先挂上下文并预填问题，避免用户重复粘贴题目。
  const mistakeId = typeof route.query.mistakeId === 'string' ? route.query.mistakeId : ''
  const planId = typeof route.query.planId === 'string' ? route.query.planId : ''
  if (mistakeId || planId) {
    await attachStudyContext({ mistakeId, planId })
    return
  }
  // 从资料页知识点带问题进来：自动开一个新话题，避免混进上一次答疑。
  // 仍是只填入输入框、不自动发送，避免用户只是想先看看问题。
  const preset = typeof route.query.q === 'string' ? route.query.q.trim() : ''
  if (preset) {
    await newConversation()
    input.value = preset.slice(0, 200)
    return
  }
  if (conversations.value[0]) await openConversation(conversations.value[0])
})
onBeforeUnmount(stopSpeaking)
</script>

<template>
  <div class="page tutor-page-shell">
    <header class="tutor-hero">
      <div class="hero-copy">
        <span class="eyebrow">多模态答疑</span>
        <h2 class="page-title">学习问答</h2>
        <p class="page-subtitle">{{ isExplain ? '讲解模式：完整步骤、结论和易错点，适合对照订正。' : '引导模式：只给下一步思路，答案由你自己写出来。' }}</p>
      </div>
      <div class="hero-actions">
        <el-select v-if="conversations.length" :model-value="session.id" placeholder="历史会话" class="history-select" popper-class="history-popper" @change="id => openConversation(conversations.find(item => item.id === id))">
          <el-option v-for="item in conversations" :key="item.id" :label="item.title || '新的答疑会话'" :value="item.id">
            <span class="history-option">
              <span class="history-option-label">{{ item.title || '新的答疑会话' }}</span>
              <button type="button" class="history-delete" title="删除这个话题" aria-label="删除这个话题" @click.stop.prevent="removeConversation(item.id)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
              </button>
            </span>
          </el-option>
        </el-select>
        <el-button round plain class="new-chat" @click="newConversation">新建会话</el-button>
      </div>
    </header>

    <section class="tutor-stage">
      <div ref="messagesEl" class="conversation">
        <div v-if="!messages.length" class="welcome-chat">
          <div class="welcome-orb">✦</div>
          <h3>{{ welcomeTitle }}</h3>
          <p>{{ welcomeNote }}</p>
          <div class="suggestion-row">
            <button v-for="prompt in welcomePrompts" :key="prompt" type="button" class="suggestion-chip" @click="input = prompt">{{ prompt }}</button>
          </div>
        </div>

        <div v-for="(message,index) in messages" :key="index" :class="['chat-row', message.role]">
          <template v-if="message.role === 'user'">
            <div class="user-stack">
              <img v-if="message.image" :src="message.image" class="message-image" alt="用户上传的学习图片" />
              <div class="user-bubble">{{ message.content }}</div>
              <div class="msg-meta">
                <span>{{ formatTime(message.createdAt) }}</span>
                <button type="button" class="meta-btn" @click="copyMessage(message.content)">复制</button>
              </div>
            </div>
          </template>
          <template v-else>
            <div class="assistant-block">
              <AgentTrace :thinking="message.thinking || ''" :tools="message.tools || []" :streaming="Boolean(message.streaming)" />
              <div v-if="message.content" class="rich-text" v-html="renderAnswer(message.content)"></div>
              <span v-if="message.streaming && message.content" class="stream-cursor" aria-hidden="true"></span>
              <AnswerCitations v-if="!message.streaming && message.citations?.length" :citations="message.citations" />
              <div v-if="message.content" class="assistant-actions">
                <SourceBadge v-if="message.source || message.guard" :source="message.guard || message.source" />
                <span class="msg-time">{{ formatTime(message.createdAt) }}</span>
                <button type="button" class="meta-btn" @click="copyMessage(message.content)">复制</button>
                <button type="button" class="meta-btn" @click="toggleSpeak(message.content, index)">
                  {{ speakingIndex === index ? (speechPaused ? '继续朗读' : '暂停朗读') : '朗读' }}
                </button>
                <button v-if="speakingIndex === index" type="button" class="meta-btn stop-speech" @click="stopSpeaking">停止</button>
              </div>
            </div>
          </template>
        </div>

        <div v-if="loading && !streaming" class="chat-row assistant">
          <div class="typing-row"><span class="typing-dot"></span><span class="typing-dot"></span><span class="typing-dot"></span><em>正在读取学习内容并整理思路…</em></div>
        </div>
      </div>

      <div class="composer-dock">
        <div v-if="attachment" class="context-draft">
          <span class="context-mark" aria-hidden="true">AI</span>
          <div>
            <strong>已带入{{ attachment.label }}</strong>
            <small>{{ attachment.hint }}</small>
          </div>
          <button type="button" class="meta-btn" @click="attachment = null">移除</button>
        </div>
        <div class="composer">
          <div v-if="imagePreview" class="image-draft">
            <img :src="imagePreview" alt="待发送图片" />
            <div><strong>图片已添加</strong><small>{{ imageNote }} · 只在本次请求中发送，不写入本地历史</small></div>
            <button type="button" class="meta-btn" @click="clearImage">移除</button>
          </div>
          <el-input v-model="input" class="composer-input" type="textarea" :rows="2" resize="none" :placeholder="composerPlaceholder" @keydown="onComposerKeydown" />
          <div class="composer-bar">
            <div class="bar-left">
              <button type="button" class="icon-btn" title="上传图片（只在本次请求中发送，不写入本地历史）" aria-label="上传图片" @click="selectImage">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
              </button>
              <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="handleImage" />
              <span class="bar-divider" aria-hidden="true"></span>
              <button type="button" class="bar-chip" :class="{ active: tutorMode === 'explain' }" :disabled="loading || streaming" title="完整步骤、结论与易错点" @click="setTutorMode('explain')">讲解模式</button>
              <button type="button" class="bar-chip" :class="{ active: tutorMode === 'guide' }" :disabled="loading || streaming" title="只给下一步，答案自己写" @click="setTutorMode('guide')">引导模式</button>
            </div>
            <div class="bar-right">
              <button type="button" class="icon-btn" :class="{ listening: isListening }" title="语音输入" aria-label="语音输入" @click="toggleVoice">
                <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.5" width="6" height="10.5" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
              </button>
              <button v-if="streaming" type="button" class="send-btn stop" @click="stopStreaming">停止</button>
              <button v-else type="button" class="send-btn" :disabled="loading || (!input.trim() && !imagePreview)" @click="send()">发送</button>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.tutor-page-shell{max-width:1520px;height:calc(100vh - 84px);min-height:620px;padding-bottom:0;display:flex;flex-direction:column;gap:14px}
.tutor-hero{flex:none;display:flex;align-items:flex-end;justify-content:space-between;gap:20px;padding:20px 24px;border:1px solid color-mix(in srgb,var(--primary) 16%,var(--border));border-radius:20px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary-soft) 82%,var(--surface)),color-mix(in srgb,var(--surface) 92%,var(--primary-soft)));box-shadow:var(--shadow)}
.tutor-hero .eyebrow{font-size:calc(11.5px*var(--fs-scale))}
.tutor-hero .page-title{margin:5px 0 6px;font-size:calc(26px*var(--fs-scale))}
.tutor-hero .page-subtitle{font-size:calc(13.5px*var(--fs-scale));line-height:1.6}
.hero-actions{display:flex;align-items:center;gap:10px;flex:none}
.history-select{width:260px}
.history-select :deep(.el-select__wrapper){border-radius:999px;background:var(--surface);box-shadow:0 0 0 1px var(--border) inset}
.history-option{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;min-width:0}
.history-option-label{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.history-delete{width:24px;height:24px;flex:none;display:grid;place-items:center;border:0;border-radius:6px;background:transparent;color:var(--muted);cursor:pointer;opacity:.75}
.history-delete:hover{background:color-mix(in srgb,#c2554a 12%,transparent);color:#c2554a;opacity:1}
.history-delete svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.new-chat{border-radius:999px;background:var(--surface)}
.tutor-stage{flex:1;min-height:0;display:flex;flex-direction:column;gap:8px}
.conversation{flex:1;min-height:0;overflow-y:auto;padding:14px 8px 6px}
.conversation::-webkit-scrollbar{width:6px}
.conversation::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--primary) 22%,transparent);border-radius:999px}

/* 对话：用户右侧浅色气泡，助手整段铺开，和设计稿一致 */
.chat-row{width:100%;max-width:880px;margin:0 auto 22px;display:flex}
.chat-row.user{justify-content:flex-end}
.user-stack{display:flex;flex-direction:column;align-items:flex-end;gap:6px;max-width:min(72%,620px)}
.user-bubble{background:color-mix(in srgb,var(--surface) 72%,var(--primary-soft));border:1px solid color-mix(in srgb,var(--border) 72%,transparent);padding:10px 16px;border-radius:16px 16px 6px 16px;font-size:calc(14.5px*var(--fs-scale));line-height:1.75;box-shadow:0 6px 16px rgba(53,91,102,.05);white-space:pre-wrap;overflow-wrap:anywhere}
.message-image{display:block;max-width:240px;max-height:200px;border-radius:12px;border:1px solid var(--border)}
.msg-meta{display:flex;align-items:center;gap:10px;font-size:calc(11.5px*var(--fs-scale));color:var(--muted)}
.msg-time{font-size:calc(11.5px*var(--fs-scale));color:var(--muted)}
.meta-btn{border:0;background:transparent;color:var(--muted);font-size:calc(11.5px*var(--fs-scale));padding:2px 0;cursor:pointer}
.meta-btn:hover{color:var(--primary)}
.stop-speech{color:#b86f61}
.chat-row.assistant{justify-content:flex-start}
.assistant-block{width:100%;max-width:820px}
.rich-text{font-size:calc(15px*var(--fs-scale));line-height:1.95;color:var(--text);overflow-wrap:anywhere}
.rich-text :deep(p){margin:0 0 12px}
.rich-text :deep(h3){margin:24px 0 10px;font-size:calc(17.5px*var(--fs-scale));letter-spacing:.01em}
.rich-text :deep(h4){margin:20px 0 8px;font-size:calc(15px*var(--fs-scale))}
.rich-text :deep(ol),.rich-text :deep(ul){margin:4px 0 14px;padding-left:24px}
.rich-text :deep(li){margin:7px 0;padding-left:2px}
.rich-text :deep(li::marker){color:var(--primary);font-weight:600}
.rich-text :deep(strong){font-weight:700}
.rich-text :deep(hr){border:0;border-top:1px dashed var(--border);margin:18px 0}
.assistant-actions{display:flex;align-items:center;gap:12px;margin-top:2px}
.stream-cursor{display:inline-block;width:3px;height:14px;margin-left:2px;border-radius:999px;background:var(--primary);vertical-align:-2px;animation:stream-blink 1s steps(2,start) infinite}
@keyframes stream-blink{0%,100%{opacity:1}50%{opacity:0}}

/* 等待状态：三个呼吸点 */
.typing-row{display:flex;align-items:center;gap:6px;color:var(--muted);font-size:calc(13px*var(--fs-scale))}
.typing-row em{font-style:normal}
.typing-dot{width:6px;height:6px;border-radius:50%;background:var(--primary);opacity:.35;animation:typing-breathe 1.2s ease-in-out infinite}
.typing-dot:nth-child(2){animation-delay:.16s}
.typing-dot:nth-child(3){animation-delay:.32s}
@keyframes typing-breathe{0%,100%{opacity:.28;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}

/* 欢迎态 */
.welcome-chat{max-width:620px;margin:8vh auto 0;text-align:center;padding:0 16px}
.welcome-orb{width:54px;height:54px;margin:0 auto;display:grid;place-items:center;border-radius:17px;background:linear-gradient(145deg,var(--primary),#83bdb0);color:#fff;font-size:calc(26px*var(--fs-scale));box-shadow:0 12px 30px rgba(64,125,124,.25)}
.welcome-chat h3{margin:14px 0 7px;color:var(--text);font-size:calc(19px*var(--fs-scale))}
.welcome-chat p{margin:0 auto 18px;max-width:460px;color:var(--muted);font-size:calc(13.5px*var(--fs-scale));line-height:1.8}
.suggestion-row{display:flex;justify-content:center;gap:8px;flex-wrap:wrap}
.suggestion-chip{border:1px solid var(--border);background:var(--surface);color:var(--text);font-size:calc(12.5px*var(--fs-scale));padding:8px 14px;border-radius:999px;cursor:pointer;transition:border-color .18s,color .18s,background .18s}
.suggestion-chip:hover{border-color:var(--primary);color:var(--primary);background:var(--primary-soft)}

/* 输入区：始终贴在页面最底部，圆角大输入框 + 底部工具栏 */
.composer-dock{flex:none;position:sticky;bottom:0;padding:4px 0 8px;background:linear-gradient(180deg,transparent,var(--bg) 32%)}
.composer{max-width:880px;margin:0 auto;padding:10px 14px 8px;border:1px solid color-mix(in srgb,var(--primary) 26%,var(--border));border-radius:18px;background:color-mix(in srgb,var(--surface) 93%,var(--primary-soft));box-shadow:0 14px 36px rgba(53,91,102,.1);transition:border-color .2s,box-shadow .2s}
.composer:focus-within{border-color:var(--primary);box-shadow:0 16px 40px rgba(53,91,102,.14)}
.composer-input :deep(.el-textarea__inner){border:0;box-shadow:none;background:transparent;padding:4px 2px;min-height:48px;font-size:calc(14.5px*var(--fs-scale));line-height:1.8;color:var(--text)}
.composer-input :deep(.el-textarea__inner::placeholder){color:var(--muted)}
.composer-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding-top:8px;margin-top:2px;border-top:1px solid color-mix(in srgb,var(--border) 62%,transparent)}
.bar-left,.bar-right{display:flex;align-items:center;gap:8px;min-width:0}
.bar-left{overflow-x:auto;scrollbar-width:none}
.bar-left::-webkit-scrollbar{display:none}
.icon-btn{width:32px;height:32px;flex:none;display:grid;place-items:center;border:0;border-radius:10px;background:transparent;color:var(--muted);cursor:pointer;transition:background .18s,color .18s}
.icon-btn:hover{background:var(--primary-soft);color:var(--primary)}
.icon-btn svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.icon-btn.listening{color:#c2554a;background:color-mix(in srgb,#c2554a 12%,transparent)}
.bar-divider{width:1px;height:16px;flex:none;background:var(--border)}
.bar-chip{flex:none;border:0;background:transparent;color:var(--muted);font-size:calc(12.5px*var(--fs-scale));padding:6px 10px;border-radius:999px;cursor:pointer;white-space:nowrap}
.bar-chip:hover{color:var(--primary);background:color-mix(in srgb,var(--primary-soft) 60%,transparent)}
.bar-chip.active{color:var(--primary);background:var(--primary-soft);font-weight:600}
.bar-chip:disabled{opacity:.55;cursor:not-allowed}
.send-btn{height:32px;flex:none;padding:0 16px;border:0;border-radius:999px;background:var(--primary);color:#fff;font-size:calc(12.5px*var(--fs-scale));font-weight:600;cursor:pointer;transition:filter .18s,background .18s}
.send-btn:hover{filter:brightness(1.05)}
.send-btn:disabled{background:color-mix(in srgb,var(--primary) 28%,var(--surface));color:var(--muted);cursor:not-allowed}
.send-btn.stop{background:#b86f61}
.image-draft{display:flex;align-items:center;gap:10px;padding:6px 8px;margin-bottom:6px;border-radius:12px;background:color-mix(in srgb,var(--primary-soft) 55%,transparent)}
.image-draft img{width:40px;height:40px;object-fit:cover;border-radius:8px}
.image-draft div{display:grid;gap:2px;flex:1;min-width:0}
.image-draft strong{font-size:calc(12.5px*var(--fs-scale))}
.image-draft small{font-size:calc(11px*var(--fs-scale));color:var(--muted)}
/* 错题/计划上下文提示：和图片草稿同一块区域，发送前可见、可一键移除。 */
.context-draft{display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:6px;border-radius:12px;background:color-mix(in srgb,var(--primary-soft) 55%,transparent)}
.context-mark{width:26px;height:26px;flex:none;display:grid;place-items:center;border-radius:8px;background:var(--primary);color:#fff;font-size:calc(10px*var(--fs-scale));font-weight:700}
.context-draft div{display:grid;gap:2px;flex:1;min-width:0}
.context-draft strong{font-size:calc(12.5px*var(--fs-scale))}
.context-draft small{font-size:calc(11px*var(--fs-scale));color:var(--muted)}

/* 数学排版 */
.rich-text :deep(sup){font-size:.72em;line-height:0;vertical-align:super}
.rich-text :deep(sub){font-size:.72em;line-height:0;vertical-align:sub}
.rich-text :deep(.math-frac){display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;margin:0 3px}
.rich-text :deep(.math-frac span:first-child){border-bottom:1px solid currentColor;padding:0 3px}
.rich-text :deep(.math-frac span:last-child){padding:1px 3px 0}

@media(max-width:800px){
  .tutor-page-shell{height:calc(100dvh - 146px);min-height:520px;padding:14px 14px 0;gap:10px}
  .tutor-hero{flex-direction:column;align-items:flex-start;gap:12px;padding:16px 18px}
  .tutor-hero .page-title{font-size:calc(22px*var(--fs-scale))}
  .hero-actions{width:100%}
  .history-select{flex:1;width:auto}
  .conversation{padding:10px 2px 4px}
  .user-stack{max-width:86%}
  .composer{padding:8px 10px 6px}
  .bar-chip{padding:6px 8px}
}
</style>

