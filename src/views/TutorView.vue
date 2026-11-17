<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { askTutorWithImage, streamTutor } from '../services/api.js'
import AgentTrace from '../components/AgentTrace.vue'
import AnswerCitations from '../components/AnswerCitations.vue'
import SourceBadge from '../components/SourceBadge.vue'
import { pauseSpeech, resumeSpeech, speakWithFriendlyChineseVoice, stopSpeech } from '../services/speech.js'
import { loadConversations, loadMistakes, loadPlans, makeId, saveAgentRun, saveConversation, deleteConversation } from '../db/index.js'
import { useAppStore } from '../stores/app.js'
import { formatMathText } from '../utils/formatMath.js'
import { buildTutorHistory, clipImageContext } from '../utils/tutorHistory.js'
import { createAgentRun, finishAgentRun, recordRunTool } from '../utils/agentRun.js'

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

// 会话列表按「今天 / 昨天 / 最近 7 天 / 更早」分组：长列表一屏扫完，不用逐条读时间戳。
function groupLabel(value) {
  const stamp = new Date(Number(value) || 0).getTime()
  if (Number.isNaN(stamp)) return '更早'
  const dayStart = offset => {
    const date = new Date()
    date.setHours(0, 0, 0, 0)
    date.setDate(date.getDate() - offset)
    return date.getTime()
  }
  if (stamp >= dayStart(0)) return '今天'
  if (stamp >= dayStart(1)) return '昨天'
  if (stamp >= dayStart(7)) return '最近 7 天'
  return '更早'
}

const groupedConversations = computed(() => {
  const order = ['今天', '昨天', '最近 7 天', '更早']
  const buckets = new Map(order.map(label => [label, []]))
  for (const item of conversations.value) {
    buckets.get(groupLabel(item.updatedAt || item.createdAt)).push(item)
  }
  return order.map(label => ({ label, items: buckets.get(label) })).filter(group => group.items.length)
})

// 空状态的能力入口：四个入口对应答疑页真实具备的四种问法，点一下把话术填进输入框，不自动发送。
const capabilities = [
  {
    key: 'photo',
    title: '拍照讲题',
    desc: '上传题目截图，先带你拆条件',
    action: 'upload',
    icon: 'M4 8.6h3.2l1.6-2.3h6.4l1.6 2.3H20v11H4z M12 10.5a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2'
  },
  {
    key: 'steps',
    title: '完整讲一遍',
    desc: '考点 → 步骤 → 结论 → 易错点',
    prompt: '帮我把这道题完整讲一遍：先说考点，再分步骤，最后给结论和易错点。',
    icon: 'M7 6.5h12M7 12h12M7 17.5h12M3.6 6.5h.01M3.6 12h.01M3.6 17.5h.01'
  },
  {
    key: 'guide',
    title: '带我想，不给答案',
    desc: '一步一步把答案留给学生',
    prompt: '这道题我没思路，先带我找已知条件和要用的知识点，先别直接给答案。',
    icon: 'M9.4 18.2h5.2M10.2 21h3.6M12 3a6 6 0 0 1 3.6 10.8c-.5.4-.6.9-.6 1.4H9c0-.5-.1-1-.6-1.4A6 6 0 0 1 12 3z'
  },
  {
    key: 'rag',
    title: '查真题怎么考',
    desc: '同一考点的中考真题出处',
    prompt: '这个考点在近几年的中考真题里是怎么考的？请给具体题目和出处。',
    icon: 'M10.8 4a6.8 6.8 0 1 0 0 13.6 6.8 6.8 0 0 0 0-13.6 M15.9 15.9 20.5 20.5'
  }
]

function useCapability(card) {
  if (loading.value || streaming.value) return
  if (card.action === 'upload') { selectImage(); return }
  input.value = card.prompt || ''
  composerEl.value?.focus?.()
}

// 窄屏把会话栏收进抽屉，桌面端常驻左侧。
const showHistory = ref(false)
const composerEl = ref(null)

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

// 轻量 Markdown 渲染：标题、有序/无序列表、引用、分隔线、段落；不额外引入依赖。
function renderAnswer(content = '') {
  const blocks = []
  let list = null
  let quote = null
  const flushList = () => {
    if (!list) return
    blocks.push(`<${list.type}>${list.items.map(item => `<li>${renderInline(item)}</li>`).join('')}</${list.type}>`)
    list = null
  }
  // 引用块（模型常拿来写口诀、结论）：连续 > 行合并成同一个 blockquote。
  const flushQuote = () => {
    if (!quote) return
    blocks.push(`<blockquote>${quote.map(item => `<p>${renderInline(item)}</p>`).join('')}</blockquote>`)
    quote = null
  }
  for (const raw of String(content).split('\n')) {
    const line = raw.trim()
    if (!line) { flushQuote(); flushList(); continue }
    const quoted = line.match(/^>\s?(.+)$/)
    if (quoted) { flushList(); (quote ??= []).push(quoted[1]); continue }
    // 走到这里说明不是引用行，先把上方的引用块收口，避免内容串到块里。
    flushQuote()
    const heading = line.match(/^(#{1,4})\s+(.+)$/)
    if (heading) {
      flushList()
      const level = heading[1].length <= 2 ? 3 : 4
      blocks.push(`<h${level}>${renderInline(heading[2])}</h${level}>`)
      continue
    }
    if (/^(-{3,}|\*{3,})$/.test(line)) { flushList(); blocks.push('<hr>'); continue }
    // 模型习惯用「整行加粗」代替小标题（步骤1：…），这里升级成 h4，步骤层级才看得出来。
    const boldLine = line.match(/^\*\*([^*\n]+)\*\*$/)
    if (boldLine) { flushList(); blocks.push(`<h4>${renderInline(boldLine[1])}</h4>`); continue }
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
  // 结尾收口两个都要清：回答以引用或列表结束时不补这一步，最后一块内容会直接丢掉。
  flushQuote()
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
// 选图和拖拽共用同一套校验，避免两条入口的格式/体积限制不一致。
function acceptImageFile(file) {
  if (!file) return
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { ElMessage.warning('请选择 JPG、PNG、WebP 或 GIF 图片。'); return }
  if (file.size > 5 * 1024 * 1024) { ElMessage.warning('图片请压缩到 5 MB 以内。'); return }
  const reader = new FileReader()
  reader.onload = () => { imageData.value = String(reader.result); imagePreview.value = String(reader.result) }
  reader.onerror = () => ElMessage.info('图片读取失败，请重试。')
  reader.readAsDataURL(file)
}
function handleImage(event) { acceptImageFile(event.target.files?.[0]) }

// 直接把截图拖进输入框：比「点加号 → 找文件」少两步，讲题时最常用。
const isDragging = ref(false)
function onDragOver() { if (!loading.value && !streaming.value) isDragging.value = true }
function onDrop(event) {
  isDragging.value = false
  if (loading.value || streaming.value) return
  acceptImageFile(event.dataTransfer?.files?.[0])
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
  // 运行记录：只落库真正调过工具的轮次，避免把每次闲聊都写进本地库。
  const run = createAgentRun({ kind: 'tutor', title: text })
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
        recordRunTool(run, tool)
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
  if (run.tools.length) {
    const finished = finishAgentRun(run, {
      status: result?.error ? 'error' : (assistant.guard ? 'interrupted' : 'done'),
      source: assistant.source,
      citationCount: assistant.citations.length
    })
    try { await saveAgentRun(finished) } catch (error) { console.warn('运行记录写入失败。', error) }
  }
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
  const history = buildTutorHistory(messages.value)
  if (imageData.value) {
    // 图片本身仍走一次性请求：体积大、流式收益低且兼容性更脆；
    // 但答复要点会作为文本上下文留在会话里，支持后续多轮追问。
    const result = await askTutorWithImage({ question: apiQuestion, image: imageData.value, history, sessionId: session.id, mode: tutorMode.value })
    const answer = result.data?.answer || (result.error?.includes('401') ? 'DeepSeek API key 没有通过验证。请检查项目根目录 .env 中的 DEEPSEEK_API_KEY，并重启 npm run dev。' : (isExplain.value ? '这道题可以按「考点 → 步骤 → 结论」来拆。你把原题文字发我，我按步骤完整讲一遍。' : '我先帮你拆出题目中的已知条件，再一起判断要用哪个知识点。'))
    // 图片链路走一次性请求，后端同样会回传 source（模型 / 安全过滤 / 本地兜底），一并标注。
    messages.value.push({ role: 'assistant', content: answer, source: result.source || (result.success ? 'deepseek' : 'mock'), mode: tutorMode.value, createdAt: Date.now() })
    // 只保留要点文本，不保留 base64：IndexedDB 里不留图片，也不让上下文无限膨胀。
    const userMessage = messages.value[messages.value.length - 2]
    if (userMessage?.role === 'user' && result.success) userMessage.imageContext = clipImageContext(answer)
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
  <div class="page tutor-page">
    <div class="tutor-workspace">
      <!-- 左：会话栏（桌面端常驻，窄屏收进抽屉） -->
      <aside class="session-rail" aria-label="答疑记录">
        <div class="rail-head">
          <span class="rail-title">答疑记录</span>
          <button type="button" class="rail-new" @click="newConversation">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5.5v13M5.5 12h13" /></svg>
            新对话
          </button>
        </div>
        <div class="rail-list">
          <div v-for="group in groupedConversations" :key="group.label" class="rail-group">
            <p class="rail-group-label">{{ group.label }}</p>
            <div v-for="item in group.items" :key="item.id" :class="['rail-item', { active: item.id === session.id }]">
              <button type="button" class="rail-item-main" @click="openConversation(item)">
                <span class="rail-item-title">{{ item.title || '新的答疑会话' }}</span>
                <span class="rail-item-time">{{ formatTime(item.updatedAt) }}</span>
              </button>
              <button type="button" class="rail-item-del" title="删除这个话题" aria-label="删除这个话题" @click.stop="removeConversation(item.id)">
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
              </button>
            </div>
          </div>
          <p v-if="!conversations.length" class="rail-empty">还没有答疑记录。<br />问第一个问题就会出现在这里。</p>
        </div>
        <p class="rail-foot"><i class="rail-foot-dot" aria-hidden="true"></i>记录只保存在本机浏览器</p>
      </aside>

      <!-- 右：对话主区 -->
      <section class="tutor-main">
        <header class="session-bar">
          <div class="session-heading">
            <h2 class="session-title">{{ session.title }}</h2>
            <p class="session-sub">{{ isExplain ? '讲解模式 · 完整步骤、结论与易错点' : '引导模式 · 只给下一步，答案由你自己写' }}</p>
          </div>
          <div class="session-tools">
            <div class="mode-switch" role="group" aria-label="回答模式">
              <button type="button" :class="{ active: tutorMode === 'guide' }" :disabled="loading || streaming" title="只给下一步，答案自己写" @click="setTutorMode('guide')">引导</button>
              <button type="button" :class="{ active: tutorMode === 'explain' }" :disabled="loading || streaming" title="完整步骤、结论与易错点" @click="setTutorMode('explain')">讲解</button>
            </div>
            <button type="button" class="tool-ghost" aria-label="查看答疑记录" @click="showHistory = true">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 7v5l3.5 2M12 3.5a8.5 8.5 0 1 0 0 17 8.5 8.5 0 0 0 0-17" /></svg>
              记录
            </button>
          </div>
        </header>

        <div ref="messagesEl" class="conversation">
          <!-- 空状态：能力入口 + 快捷问法，把首屏填满，也告诉用户这个页面能做什么 -->
          <div v-if="!messages.length" class="welcome">
            <div class="welcome-head">
              <span class="welcome-orb" aria-hidden="true">✦</span>
              <div>
                <h3>{{ welcomeTitle }}</h3>
                <p>{{ welcomeNote }}</p>
              </div>
            </div>
            <div class="cap-grid">
              <button v-for="card in capabilities" :key="card.key" type="button" class="cap-card" :disabled="loading || streaming" @click="useCapability(card)">
                <span class="cap-icon"><svg viewBox="0 0 24 24" aria-hidden="true"><path :d="card.icon" /></svg></span>
                <strong>{{ card.title }}</strong>
                <small>{{ card.desc }}</small>
              </button>
            </div>
            <div class="prompt-row">
              <span class="prompt-label">或者直接问</span>
              <button v-for="prompt in welcomePrompts" :key="prompt" type="button" class="prompt-chip" @click="input = prompt">{{ prompt }}</button>
            </div>
          </div>

          <div v-for="(message,index) in messages" :key="index" :class="['message', message.role]">
            <template v-if="message.role === 'user'">
              <div class="user-col">
                <div class="user-bubble">
                  <img v-if="message.image" :src="message.image" class="message-image" alt="用户上传的学习图片" />
                  <span class="bubble-text">{{ message.content }}</span>
                </div>
                <div class="msg-meta">
                  <span>{{ formatTime(message.createdAt) }}</span>
                  <button type="button" class="meta-btn" @click="copyMessage(message.content)">复制</button>
                </div>
              </div>
            </template>
            <template v-else>
              <article class="ai-card">
                <div class="ai-card-head">
                  <span class="ai-avatar" aria-hidden="true">✦</span>
                  <span class="ai-name">AI 学伴</span>
                  <span class="ai-tag">{{ message.mode === 'explain' ? '讲解' : '引导' }}</span>
                  <span class="ai-time">{{ formatTime(message.createdAt) }}</span>
                </div>
                <AgentTrace :thinking="message.thinking || ''" :tools="message.tools || []" :streaming="Boolean(message.streaming)" />
                <div v-if="message.content" class="rich-text" v-html="renderAnswer(message.content)"></div>
                <span v-if="message.streaming && message.content" class="stream-cursor" aria-hidden="true"></span>
                <AnswerCitations v-if="!message.streaming && message.citations?.length" :citations="message.citations" />
                <div v-if="message.content" class="assistant-actions">
                  <SourceBadge v-if="message.source || message.guard" :source="message.guard || message.source" />
                  <span class="action-sep" aria-hidden="true"></span>
                  <button type="button" class="meta-btn with-icon" @click="copyMessage(message.content)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 9V6.5h9.5V16H16M5.5 9.5H15V20H5.5z" /></svg>复制
                  </button>
                  <button type="button" class="meta-btn with-icon" @click="toggleSpeak(message.content, index)">
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13L7.5 14.5H4zM16 9a4 4 0 0 1 0 6" /></svg>
                    {{ speakingIndex === index ? (speechPaused ? '继续' : '暂停') : '朗读' }}
                  </button>
                  <button v-if="speakingIndex === index" type="button" class="meta-btn stop-speech" @click="stopSpeaking">停止</button>
                </div>
              </article>
            </template>
          </div>

          <div v-if="loading && !streaming" class="message assistant">
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
          <div class="composer" :class="{ 'is-dragging': isDragging }" @dragover.prevent="onDragOver" @dragleave.prevent="isDragging = false" @drop.prevent="onDrop">
            <div v-if="imagePreview" class="image-draft">
              <img :src="imagePreview" alt="待发送图片" />
              <div><strong>图片已添加</strong><small>{{ imageNote }} · 图片只在本次请求中发送，答复要点会留在会话里</small></div>
              <button type="button" class="meta-btn" @click="clearImage">移除</button>
            </div>
            <el-input ref="composerEl" v-model="input" class="composer-input" type="textarea" :autosize="{ minRows: 1, maxRows: 6 }" resize="none" :placeholder="composerPlaceholder" @keydown="onComposerKeydown" />
            <div class="composer-bar">
              <div class="bar-left">
                <button type="button" class="tool-btn" title="上传题目图片" aria-label="上传题目图片" @click="selectImage">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.6h3.2l1.6-2.3h6.4l1.6 2.3H20v11H4z M12 10.5a3.1 3.1 0 1 0 0 6.2 3.1 3.1 0 0 0 0-6.2" /></svg>
                </button>
                <input ref="fileInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden @change="handleImage" />
                <button type="button" class="tool-btn" :class="{ listening: isListening }" title="语音输入" aria-label="语音输入" @click="toggleVoice">
                  <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="3.5" width="6" height="10.5" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21" /></svg>
                </button>
                <span class="bar-divider" aria-hidden="true"></span>
                <span class="bar-hint">Enter 发送 · Shift + Enter 换行</span>
              </div>
              <div class="bar-right">
                <button v-if="streaming" type="button" class="send-btn stop" @click="stopStreaming">停止生成</button>
                <button v-else type="button" class="send-btn" :disabled="loading || (!input.trim() && !imagePreview)" @click="send()">
                  发送
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h13M12.5 5.5 19 12l-6.5 6.5" /></svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>

    <el-drawer v-model="showHistory" title="答疑记录" size="300px" class="history-drawer">
      <button type="button" class="rail-new drawer-new" @click="newConversation(); showHistory = false">新对话</button>
      <div v-for="group in groupedConversations" :key="group.label" class="rail-group">
        <p class="rail-group-label">{{ group.label }}</p>
        <div v-for="item in group.items" :key="item.id" :class="['rail-item', { active: item.id === session.id }]">
          <button type="button" class="rail-item-main" @click="openConversation(item); showHistory = false">
            <span class="rail-item-title">{{ item.title || '新的答疑会话' }}</span>
            <span class="rail-item-time">{{ formatTime(item.updatedAt) }}</span>
          </button>
          <button type="button" class="rail-item-del" aria-label="删除这个话题" @click.stop="removeConversation(item.id)">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13M10 11v6M14 11v6" /></svg>
          </button>
        </div>
      </div>
      <p v-if="!conversations.length" class="rail-empty">还没有答疑记录。</p>
    </el-drawer>
  </div>
</template>

<style scoped>
/* 工作台骨架：左侧会话栏常驻，右侧对话区独立滚动，输入框永远贴在对话区底部。
   页面高度锁死在一屏内，避免像普通表单页那样被内容顶长。 */
.tutor-page{max-width:1520px;margin:0 auto;padding:16px 24px 18px;height:calc(100vh - 92px);min-height:600px;display:flex;overflow:hidden}
.tutor-workspace{flex:1;min-width:0;display:flex;gap:16px}

/* 会话栏 */
.session-rail{width:264px;flex:none;display:flex;flex-direction:column;padding:16px 10px 10px;border:1px solid var(--border);border-radius:20px;background:var(--surface);box-shadow:var(--shadow-soft)}
.rail-head{display:flex;align-items:center;justify-content:space-between;gap:8px;padding:0 6px 12px}
.rail-title{color:var(--muted);font-size:calc(12px*var(--fs-scale));font-weight:600;letter-spacing:.12em}
.rail-new{display:inline-flex;align-items:center;justify-content:center;gap:5px;height:30px;padding:0 12px;border:1px solid color-mix(in srgb,var(--primary) 28%,var(--border));border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:calc(12px*var(--fs-scale));font-weight:600;cursor:pointer;transition:background .18s,color .18s,border-color .18s}
.rail-new:hover{background:var(--primary);border-color:var(--primary);color:#fff}
.rail-new svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round}
.rail-list{flex:1;min-height:0;overflow-y:auto;display:grid;gap:16px;align-content:start;padding:0 2px}
.rail-list::-webkit-scrollbar{width:5px}
.rail-list::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--muted) 22%,transparent);border-radius:999px}
.rail-group-label{margin:0 0 5px;padding:0 8px;color:var(--muted);font-size:calc(10.5px*var(--fs-scale));font-weight:600;letter-spacing:.1em;opacity:.85}
.rail-item{position:relative;display:flex;align-items:center;border-radius:11px;transition:background .16s}
.rail-item:hover{background:var(--surface-soft)}
.rail-item.active{background:var(--primary-soft)}
.rail-item.active::before{content:'';position:absolute;left:0;top:10px;bottom:10px;width:3px;border-radius:0 3px 3px 0;background:var(--primary)}
.rail-item-main{flex:1;min-width:0;display:grid;gap:1px;padding:9px 6px 9px 12px;border:0;background:transparent;text-align:left;cursor:pointer}
.rail-item-title{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:calc(12.5px*var(--fs-scale));line-height:1.5}
.rail-item.active .rail-item-title{color:var(--primary);font-weight:600}
.rail-item-time{color:var(--muted);font-size:calc(10px*var(--fs-scale))}
.rail-item-del{width:26px;height:26px;flex:none;margin-right:4px;display:grid;place-items:center;border:0;border-radius:7px;background:transparent;color:var(--muted);opacity:0;cursor:pointer;transition:opacity .16s,background .16s,color .16s}
.rail-item:hover .rail-item-del,.rail-item.active .rail-item-del{opacity:.65}
.rail-item-del:hover{background:color-mix(in srgb,#c2554a 12%,transparent);color:#c2554a;opacity:1}
.rail-item-del svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.rail-empty{margin:6px 8px;color:var(--muted);font-size:calc(11.5px*var(--fs-scale));line-height:1.8}
.rail-foot{flex:none;display:flex;align-items:center;gap:6px;margin:8px 0 0;padding:10px 8px 2px;border-top:1px solid var(--border);color:var(--muted);font-size:calc(10.5px*var(--fs-scale))}
.rail-foot-dot{width:6px;height:6px;flex:none;border-radius:50%;background:#74b48e}

/* 对话主区 */
.tutor-main{flex:1;min-width:0;display:flex;flex-direction:column;gap:10px}
/* 会话头、对话流、输入框统一收在同一条 860px 的阅读列里，三者左右边缘严格对齐。 */
.session-bar{flex:none;width:100%;max-width:860px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:16px;padding:0 0 10px;border-bottom:1px solid color-mix(in srgb,var(--border) 70%,transparent)}
.session-heading{min-width:0}
.session-title{margin:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--text);font-size:calc(16px*var(--fs-scale));font-weight:600;line-height:1.45}
.session-sub{margin:2px 0 0;color:var(--muted);font-size:calc(11.5px*var(--fs-scale))}
.session-tools{display:flex;align-items:center;gap:10px;flex:none}
.mode-switch{display:flex;gap:2px;padding:3px;border:1px solid var(--border);border-radius:999px;background:var(--surface)}
.mode-switch button{height:27px;padding:0 15px;border:0;border-radius:999px;background:transparent;color:var(--muted);font-size:calc(12px*var(--fs-scale));font-weight:600;cursor:pointer;transition:background .18s,color .18s}
.mode-switch button:hover{color:var(--primary)}
.mode-switch button.active{background:var(--primary);color:#fff}
.mode-switch button:disabled{opacity:.6;cursor:not-allowed}
.tool-ghost{display:none;align-items:center;gap:6px;height:32px;padding:0 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--muted);font-size:calc(12px*var(--fs-scale));cursor:pointer}
.tool-ghost:hover{color:var(--primary);border-color:color-mix(in srgb,var(--primary) 40%,var(--border))}
.tool-ghost svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}

/* 滚动容器比消息列宽 84px：滚动条因此落在内容右侧的空白里，不再压住卡片边缘。
   上下各留一段纯透明再渐入，滚到中间时被裁掉的那半行能彻底溶掉；内边距比渐隐区更大，
   保证滚到顶/底时首尾两条消息不会被自己吃掉。 */
.conversation{flex:1;min-height:0;width:100%;max-width:944px;margin:0 auto;overflow-y:auto;display:flex;flex-direction:column;padding:30px 0 26px;-webkit-mask-image:linear-gradient(180deg,transparent 0,transparent 5px,#000 27px,#000 calc(100% - 21px),transparent 100%);mask-image:linear-gradient(180deg,transparent 0,transparent 5px,#000 27px,#000 calc(100% - 21px),transparent 100%)}
.conversation::-webkit-scrollbar{width:6px}
.conversation::-webkit-scrollbar-thumb{background:color-mix(in srgb,var(--muted) 22%,transparent);border-radius:999px}

/* 消息：用户右对齐浅色气泡，AI 整块白卡（学习场景像一页讲义，比裸文本更好读） */
/* 消息列永远比容器窄 44px：容器够宽时靠 860 上限居中，容器变窄时靠 calc 留出滚动条的位置，
   两种情况下滚动条都不会落在卡片边缘上。 */
.message{width:100%;max-width:min(860px,calc(100% - 44px));margin:0 auto 16px;display:flex;flex:none}
.message.user{justify-content:flex-end}
.user-col{display:flex;flex-direction:column;align-items:flex-end;gap:5px;max-width:min(74%,640px)}
.user-bubble{display:grid;gap:8px;padding:11px 16px;border:1px solid color-mix(in srgb,var(--primary) 22%,transparent);border-radius:16px 16px 5px 16px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary) 15%,var(--surface)),color-mix(in srgb,var(--primary) 7%,var(--surface)));color:var(--text);font-size:calc(14.5px*var(--fs-scale));line-height:1.75;box-shadow:0 6px 18px rgba(53,91,102,.06)}
.bubble-text{white-space:pre-wrap;overflow-wrap:anywhere}
.message-image{display:block;max-width:240px;max-height:200px;border-radius:10px;border:1px solid var(--border)}
.msg-meta{display:flex;align-items:center;gap:10px;color:var(--muted);font-size:calc(11px*var(--fs-scale))}

.ai-card{width:100%;overflow:hidden;border:1px solid var(--border);border-radius:16px;background:var(--surface);box-shadow:0 10px 28px rgba(47,82,74,.05)}
.ai-card-head{display:flex;align-items:center;gap:7px;padding:9px 16px;border-bottom:1px solid color-mix(in srgb,var(--border) 66%,transparent);background:color-mix(in srgb,var(--surface-soft) 74%,transparent)}
.ai-avatar{width:20px;height:20px;flex:none;display:grid;place-items:center;border-radius:6px;background:var(--brand-gradient);color:#fff;font-size:11px;line-height:1}
.ai-name{color:var(--text);font-size:calc(12.5px*var(--fs-scale));font-weight:600}
.ai-tag{padding:0 7px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:calc(10.5px*var(--fs-scale));line-height:1.75}
.ai-time{margin-left:auto;color:var(--muted);font-size:calc(10.5px*var(--fs-scale))}
.ai-card :deep(.agent-trace){margin:12px 16px 0;border:1px solid var(--border);border-left-width:1px;border-radius:10px;background:color-mix(in srgb,var(--surface-soft) 88%,transparent)}
.ai-card :deep(.agent-trace .trace-head){padding:7px 12px}
.ai-card :deep(.trace-waiting){margin:12px 16px 0}

.rich-text{padding:14px 18px 0;color:var(--text);font-size:calc(14.5px*var(--fs-scale));line-height:1.9;overflow-wrap:anywhere}
.rich-text :deep(p){margin:0 0 11px}
.rich-text :deep(p:last-child){margin-bottom:0}
.rich-text :deep(h3){position:relative;margin:20px 0 9px;padding-left:11px;font-size:calc(16px*var(--fs-scale));font-weight:600;letter-spacing:.01em}
.rich-text :deep(h3)::before{content:'';position:absolute;left:0;top:.32em;bottom:.32em;width:3px;border-radius:2px;background:var(--primary);opacity:.85}
.rich-text :deep(h4){margin:15px 0 6px;color:var(--text);font-size:calc(14.5px*var(--fs-scale));font-weight:650;letter-spacing:.01em}
.rich-text :deep(h4)::before{content:'';display:inline-block;width:5px;height:5px;margin-right:7px;border-radius:50%;background:var(--primary);vertical-align:middle;opacity:.8}
.rich-text :deep(ol),.rich-text :deep(ul){margin:6px 0 12px;padding-left:22px}
.rich-text :deep(li){margin:6px 0;padding-left:3px}
.rich-text :deep(li::marker){color:var(--primary);font-weight:700}
.rich-text :deep(strong){font-weight:700;color:color-mix(in srgb,var(--text) 88%,var(--primary))}
.rich-text :deep(hr){margin:16px 0;border:0;border-top:1px dashed var(--border)}
/* 引用块：模型写口诀（「拆两头，凑中间」）时用的 > 语法，渲染成浅底强调块。 */
.rich-text :deep(blockquote){margin:10px 0 13px;padding:11px 15px;border-left:3px solid color-mix(in srgb,var(--primary) 52%,transparent);border-radius:0 10px 10px 0;background:color-mix(in srgb,var(--primary-soft) 74%,transparent);color:color-mix(in srgb,var(--text) 86%,var(--primary));font-size:calc(14px*var(--fs-scale));line-height:1.8}
.rich-text :deep(blockquote p){margin:0}
.rich-text :deep(blockquote p+p){margin-top:5px}

.answer-citations{margin:4px 16px 0}
.assistant-actions{display:flex;align-items:center;gap:10px;margin-top:14px;padding:9px 16px 10px;border-top:1px solid color-mix(in srgb,var(--border) 60%,transparent);background:color-mix(in srgb,var(--surface-soft) 62%,transparent)}
.action-sep{width:1px;height:12px;flex:none;background:var(--border)}
.meta-btn{display:inline-flex;align-items:center;gap:4px;padding:2px 0;border:0;background:transparent;color:var(--muted);font-size:calc(11.5px*var(--fs-scale));cursor:pointer;transition:color .16s}
.meta-btn:hover{color:var(--primary)}
.meta-btn svg{width:13px;height:13px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.stop-speech{color:#b86f61}
.stream-cursor{display:inline-block;width:3px;height:14px;margin:0 0 0 3px;border-radius:999px;background:var(--primary);vertical-align:-2px;animation:stream-blink 1s steps(2,start) infinite}
@keyframes stream-blink{0%,100%{opacity:1}50%{opacity:0}}

/* 等待态 */
.typing-row{display:flex;align-items:center;gap:6px;padding:10px 16px;border:1px solid var(--border);border-radius:14px;background:var(--surface);color:var(--muted);font-size:calc(12.5px*var(--fs-scale));box-shadow:0 8px 22px rgba(47,82,74,.05)}
.typing-row em{font-style:normal}
.typing-dot{width:6px;height:6px;border-radius:50%;background:var(--primary);opacity:.35;animation:typing-breathe 1.2s ease-in-out infinite}
.typing-dot:nth-child(2){animation-delay:.16s}
.typing-dot:nth-child(3){animation-delay:.32s}
@keyframes typing-breathe{0%,100%{opacity:.28;transform:translateY(0)}50%{opacity:1;transform:translateY(-2px)}}

/* 空状态：能力入口 + 快捷问法，把首屏填满并说明「这个页面能干什么」 */
.welcome{margin:auto;width:100%;max-width:min(860px,calc(100% - 44px));padding:10px 0 18px}
.welcome-head{display:flex;align-items:flex-start;gap:14px;margin-bottom:20px}
.welcome-orb{width:46px;height:46px;flex:none;display:grid;place-items:center;border-radius:14px;background:var(--brand-gradient);color:#fff;font-size:calc(19px*var(--fs-scale));line-height:1;box-shadow:0 10px 24px rgba(64,125,124,.24)}
.welcome-head h3{margin:2px 0 6px;color:var(--text);font-size:calc(20px*var(--fs-scale));font-weight:600;line-height:1.4}
.welcome-head p{margin:0;max-width:64ch;color:var(--muted);font-size:calc(13px*var(--fs-scale));line-height:1.75}
.cap-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.cap-card{display:grid;justify-items:start;gap:5px;padding:15px 14px 14px;border:1px solid var(--border);border-radius:14px;background:var(--surface);text-align:left;cursor:pointer;transition:border-color .18s,transform .18s,box-shadow .18s,background .18s}
.cap-card:hover{border-color:color-mix(in srgb,var(--primary) 46%,var(--border));background:var(--surface);transform:translateY(-2px);box-shadow:0 14px 28px rgba(47,82,74,.09)}
.cap-card:disabled{opacity:.6;cursor:not-allowed;transform:none;box-shadow:none}
.cap-icon{width:32px;height:32px;display:grid;place-items:center;margin-bottom:3px;border-radius:10px;background:var(--primary-soft);color:var(--primary)}
.cap-icon svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.cap-card strong{color:var(--text);font-size:calc(13.5px*var(--fs-scale));font-weight:600;line-height:1.5}
.cap-card small{color:var(--muted);font-size:calc(11.5px*var(--fs-scale));line-height:1.6}
.prompt-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:18px}
.prompt-label{color:var(--muted);font-size:calc(11.5px*var(--fs-scale));letter-spacing:.04em}
.prompt-chip{padding:7px 13px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--text);font-size:calc(12px*var(--fs-scale));cursor:pointer;transition:border-color .18s,color .18s,background .18s}
.prompt-chip:hover{border-color:var(--primary);background:var(--primary-soft);color:var(--primary)}

/* 输入区 */
.composer-dock{flex:none;width:100%;max-width:860px;margin:0 auto;padding:4px 0 0}
.composer{width:100%;padding:12px 14px 10px;border:1px solid color-mix(in srgb,var(--primary) 26%,var(--border));border-radius:18px;background:var(--surface);box-shadow:0 16px 38px rgba(47,82,74,.1);transition:border-color .2s,box-shadow .2s}
.composer:focus-within{border-color:var(--primary);box-shadow:0 18px 42px rgba(47,82,74,.15)}
.composer.is-dragging{border-color:var(--primary);border-style:dashed;background:color-mix(in srgb,var(--primary-soft) 55%,var(--surface))}
.composer-input :deep(.el-textarea__inner){min-height:46px;padding:4px 2px;border:0;background:transparent;box-shadow:none;color:var(--text);font-size:calc(14px*var(--fs-scale));line-height:1.8}
.composer-input :deep(.el-textarea__inner::placeholder){color:var(--muted)}
.composer-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:6px;padding-top:8px;border-top:1px solid color-mix(in srgb,var(--border) 62%,transparent)}
.bar-left,.bar-right{display:flex;align-items:center;gap:6px;min-width:0}
.tool-btn{width:30px;height:30px;flex:none;display:grid;place-items:center;border:0;border-radius:9px;background:transparent;color:var(--muted);cursor:pointer;transition:background .18s,color .18s}
.tool-btn:hover{background:var(--primary-soft);color:var(--primary)}
.tool-btn svg{width:17px;height:17px;fill:none;stroke:currentColor;stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.tool-btn.listening{background:color-mix(in srgb,#c2554a 12%,transparent);color:#c2554a}
.bar-divider{width:1px;height:15px;flex:none;margin:0 3px;background:var(--border)}
.bar-hint{color:var(--muted);font-size:calc(10.5px*var(--fs-scale));white-space:nowrap;opacity:.85}
.send-btn{display:inline-flex;align-items:center;gap:4px;height:32px;flex:none;padding:0 14px 0 16px;border:0;border-radius:999px;background:var(--primary);color:#fff;font-size:calc(12.5px*var(--fs-scale));font-weight:600;cursor:pointer;transition:filter .18s,background .18s}
.send-btn svg{width:14px;height:14px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round}
.send-btn:hover{filter:brightness(1.06)}
.send-btn:disabled{background:color-mix(in srgb,var(--primary) 24%,var(--surface));color:var(--muted);cursor:not-allowed}
.send-btn.stop{background:#b86f61}
.image-draft{display:flex;align-items:center;gap:10px;margin-bottom:8px;padding:6px 8px;border-radius:11px;background:color-mix(in srgb,var(--primary-soft) 60%,transparent)}
.image-draft img{width:38px;height:38px;object-fit:cover;border-radius:7px}
.image-draft div{display:grid;gap:1px;flex:1;min-width:0}
.image-draft strong{font-size:calc(12px*var(--fs-scale))}
.image-draft small{color:var(--muted);font-size:calc(10.5px*var(--fs-scale));line-height:1.5}
/* 错题/计划上下文提示：发送前可见、可一键移除。 */
.context-draft{display:flex;align-items:center;gap:10px;margin:0 0 8px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--primary) 20%,var(--border));border-radius:12px;background:color-mix(in srgb,var(--primary-soft) 55%,transparent)}
.context-mark{width:26px;height:26px;flex:none;display:grid;place-items:center;border-radius:8px;background:var(--primary);color:#fff;font-size:calc(10px*var(--fs-scale));font-weight:700}
.context-draft div{display:grid;gap:1px;flex:1;min-width:0}
.context-draft strong{font-size:calc(12px*var(--fs-scale))}
.context-draft small{color:var(--muted);font-size:calc(10.5px*var(--fs-scale));line-height:1.5}

/* 抽屉里的会话列表复用 rail-item 样式，这里只补顶部间距。 */
.drawer-new{width:100%;height:36px;margin-bottom:14px}

/* 数学排版 */
.rich-text :deep(sup){font-size:.72em;line-height:0;vertical-align:super}
.rich-text :deep(sub){font-size:.72em;line-height:0;vertical-align:sub}
.rich-text :deep(.math-frac){display:inline-flex;flex-direction:column;vertical-align:middle;text-align:center;line-height:1.05;margin:0 3px}
.rich-text :deep(.math-frac span:first-child){border-bottom:1px solid currentColor;padding:0 3px}
.rich-text :deep(.math-frac span:last-child){padding:1px 3px 0}

@media (max-width:1280px){
  .cap-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
}
@media (max-width:1240px){
  /* 窄屏收起会话栏，历史记录改为抽屉，对话区拿到全部宽度。 */
  .session-rail{display:none}
  .tool-ghost{display:inline-flex}
}
@media (max-width:800px){
  .tutor-page{height:calc(100dvh - 156px);min-height:480px;padding:12px 13px 10px}
  .session-title{font-size:calc(14.5px*var(--fs-scale))}
  .session-sub{display:none}
  .mode-switch button{height:25px;padding:0 11px;font-size:calc(11.5px*var(--fs-scale))}
  .conversation{padding:4px 0 0}
  .user-col{max-width:88%}
  .rich-text{padding:12px 14px 0;font-size:calc(14px*var(--fs-scale))}
  .ai-card-head{padding:8px 14px}
  .cap-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:9px}
  .welcome-orb{width:40px;height:40px}
  .welcome-head h3{font-size:calc(17px*var(--fs-scale))}
  .bar-hint{display:none}
}
@media (prefers-reduced-motion:reduce){
  .cap-card,.send-btn,.stream-cursor{transition:none;animation:none}
}
</style>

