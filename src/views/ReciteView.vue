<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { loadPlans, loadProfile, loadReciteContent, makeId, saveFocusSession, savePlan, saveReciteContent, saveReciteSession } from '../db/index.js'
import { generateReciteContent } from '../services/api.js'
import { detectReciteMode, RECITE_MODE_LABELS } from '../utils/reciteMode.js'
import { persistReciteMistakes } from '../utils/reciteMistakes.js'
import { buildHint, judgeLine, judgeSpelling } from '../utils/reciteAlign.js'
import { isChemicalEquation, judgeChemicalEquation, describeMissedTokens, describeExperiment, spokenToEquation } from '../utils/chemEquation.js'
import { createVoiceRecorder, loadSpeechModel, transcribeSegment } from '../services/localAsr.js'
import { speakEnglishWord, stopSpeech, warmUpEnglishVoice } from '../services/speech.js'
import { useAppStore } from '../stores/app.js'

const route = useRoute()
const router = useRouter()
const store = useAppStore()

const plan = ref(null)
const mode = ref('text')
// loading 取内容 / confirm 确认原文 / ready 正式背诵 / summary 复盘
const stage = ref('loading')
const content = ref(null)
const contentSource = ref('')
const needsManual = ref(false)

const startedAt = ref(0)
const elapsed = ref(0)
let tickTimer = 0

const modeLabel = computed(() => RECITE_MODE_LABELS[mode.value] || '背诵')
const elapsedText = computed(() => {
  const total = Math.max(0, Math.floor(elapsed.value))
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
})

// === 逐句背诵 ===
const passed = ref([])
const lineIndex = ref(0)
const lineResults = ref([])
// 背诵时默认藏起原文列表，避免照着念。两档：看当前一句 / 查看全部。
const showCurrentLine = ref(false)
const showReader = ref(false)
const listening = ref(false)
const recognizing = ref(false)
const modelState = ref('idle') // idle | loading | ready | failed
const modelProgress = ref(0)
const modelError = ref('')
const level = ref(0)
const lastHeard = ref('')
const hintStep = ref(0)
const hintVisible = ref(false)
const typingMode = ref(false)
const typedLine = ref('')
// 打字默写提交后的结果：对/错 + 三栏对比（用户中文 → 系统化学式 → 原式）。
const typedResult = ref(null)
let recorder = null
let stuckTimer = 0
let stuckSeconds = 0

const currentLine = computed(() => content.value?.lines?.[lineIndex.value] || null)
const doneCount = computed(() => passed.value.filter(Boolean).length)
const totalLines = computed(() => content.value?.lines?.length || 0)
const progressPercent = computed(() => totalLines.value ? Math.round((doneCount.value / totalLines.value) * 100) : 0)
const hintText = computed(() => {
  if (!currentLine.value) return ''
  // 化学方程式：只提示实验现象（颜色/火焰/沉淀/气体），不提示配平、系数、化学式。
  // 所以不用 AI 生成的 hint（那里面可能混入书写细节），统一走内置实验现象表。
  if (isChemicalEquation(currentLine.value.text)) {
    return describeExperiment(currentLine.value.text)
  }
  const head = buildHint(currentLine.value.text, hintStep.value)
  return hintStep.value > 0 ? `${head}…` : `${head}……`
})

// 当前句是不是化学方程式：决定要不要显示「这是什么实验」的常驻提示条。
const isChemicalLine = computed(() => Boolean(currentLine.value && isChemicalEquation(currentLine.value.text)))
const experimentText = computed(() => {
  if (!isChemicalLine.value) return ''
  // 只提示实验现象，不用 AI 的 hint（可能混入配平/系数/化学式等书写细节）。
  return describeExperiment(currentLine.value.text)
})
// 计数单位：化学方程式用「个」，普通背诵用「句」。
const lineUnit = computed(() => (isChemicalLine.value ? '个方程式' : '句'))
const lineProgressText = computed(() => `第 ${Math.min(lineIndex.value + 1, totalLines.value)} ${lineUnit.value} / 共 ${totalLines.value} ${lineUnit.value === '句' ? '句' : '个'}`)

function toggleCurrentLine() {
  showCurrentLine.value = !showCurrentLine.value
}
const listenLabel = computed(() => {
  if (typingMode.value) return '语音不可用，改为打字核对'
  if (modelState.value === 'loading') return `正在载入本地语音模型 ${Math.round(modelProgress.value)}%`
  if (modelState.value === 'failed') return '语音模型没能载入，可以直接打字核对'
  if (recognizing.value) return '正在识别刚才那句'
  if (listening.value) return '在听，背完一句停一下'
  return '点开始，把这一句念出来'
})

// === 背单词 ===
const wordQueue = ref([])
const wordPos = ref(0)
const wordRound = ref(1)
const flipped = ref(false)
const knownWords = ref([])
const unknownWords = ref([])
let nextRound = []
// 单词模式里两种练法：卡片速记 / 打字默写，顶部入口来回切。
const wordsView = ref('card')

const currentWord = computed(() => content.value?.words?.[wordQueue.value[wordPos.value]] || null)
// 词数以整份词表为准：第二轮队列会变短，用它算正确率才不会被第二轮带偏。
const wordTotal = computed(() => content.value?.words?.length || 0)

// === 打字默写 ===
const dictPos = ref(0)
const dictInput = ref('')
const dictWords = ref([])
const dictResults = ref([])
const dictCountdown = ref(0)
const dictAnswerShown = ref(false)
const secondsPerWord = ref(15)
const dictInputEl = ref(null)
let dictTimer = 0

const currentDictWord = computed(() => dictWords.value[dictPos.value] || null)
const dictCorrect = computed(() => dictResults.value.filter(item => item.ok).length)

function startClock() {
  if (tickTimer) return
  startedAt.value = Date.now()
  tickTimer = window.setInterval(() => { elapsed.value = (Date.now() - startedAt.value) / 1000 }, 500)
}

function stopClock() {
  if (tickTimer) { window.clearInterval(tickTimer); tickTimer = 0 }
}

onMounted(async () => {
  // 页面一打开就把 TTS 引擎拉起来（一句听不见的空格，零成本）。
  // 此时 mode 还没解析出来，所以不等判断；等用户真的点喇叭或换词时就不用等冷启动了。
  warmUpEnglishVoice()
  const plans = await loadPlans()
  const planId = String(route.query.planId || '')
  const found = plans.find(item => item.id === planId)
  if (!found) {
    ElMessage.warning('这条计划已经不在列表里了，回到学习计划看看。')
    router.replace({ name: 'plans' })
    return
  }
  plan.value = found
  const detected = detectReciteMode(found)
  mode.value = detected.mode || 'text'
  await loadContent()
})

onBeforeUnmount(() => {
  stopClock()
  stopDictTimer()
  closeRecorder()
  stopSpeech()
  window.clearTimeout(stuckTimer)
})

async function loadContent() {
  stage.value = 'loading'
  const cached = await loadReciteContent(plan.value.subject, plan.value.name)
  if (cached?.content) {
    content.value = cached.content
    contentSource.value = cached.source || 'cache'
    // 确认过（或用户手动改过）才直接开背；只拿过内容的仍让用户看一眼。
    if (cached.confirmed) { prepare(); return }
    needsManual.value = Boolean(cached.content.needsManual)
    stage.value = 'confirm'
    return
  }
  const profile = await loadProfile().catch(() => null)
  const result = await generateReciteContent({
    subject: plan.value.subject,
    name: plan.value.name,
    grade: plan.value.grade || profile?.grade || '',
    knowledgeTags: plan.value.knowledgeTags || [],
    kind: mode.value === 'text' ? 'text' : 'words'
  })
  if (!result?.success || !result.data) {
    content.value = { kind: 'text', title: plan.value.name, lines: [], needsManual: true, notice: '没能拿到内容，可以手动粘贴原文。' }
    needsManual.value = true
    contentSource.value = 'manual'
    stage.value = 'confirm'
    return
  }
  content.value = result.data
  needsManual.value = Boolean(result.data.needsManual)
  contentSource.value = result.source || ''
  stage.value = 'confirm'
  // 先落一份「未确认」的缓存：用户这次不背、下次再进来就不用再等模型了。
  await saveReciteContent({
    id: `${plan.value.subject || '综合'}::${plan.value.name || ''}`,
    subject: plan.value.subject || '',
    name: plan.value.name || '',
    kind: result.data.kind,
    content: result.data,
    source: contentSource.value,
    confirmed: false,
    updatedAt: Date.now()
  })
}

// 确认原文后进入正式背诵：这一步是防模型的幻觉内容直接进背诵流程。
async function confirmContent() {
  const record = {
    id: `${plan.value.subject || '综合'}::${plan.value.name || ''}`,
    subject: plan.value.subject || '',
    name: plan.value.name || '',
    kind: content.value.kind,
    content: content.value,
    source: contentSource.value,
    confirmed: true,
    updatedAt: Date.now()
  }
  await saveReciteContent(record)
  prepare()
}

function prepare() {
  stage.value = 'ready'
  startClock()
  if (mode.value === 'text') {
    passed.value = new Array(content.value.lines?.length || 0).fill(false)
    lineIndex.value = 0
    lineResults.value = []
    if (!content.value.lines?.length) {
      needsManual.value = true
      editing.value = true
      editText.value = ''
    }
  } else if (mode.value === 'words') {
    const words = (content.value.words || []).slice(0, 15)
    content.value = { ...content.value, words }
    dictWords.value = words
    wordQueue.value = words.map((_, index) => index)
    wordPos.value = 0
    wordRound.value = 1
    flipped.value = false
    knownWords.value = []
    unknownWords.value = []
    nextRound = []
    wordsView.value = 'card'
    nextTick(() => speakWordCard())
  } else {
    const words = (content.value.words || []).slice(0, 20)
    content.value = { ...content.value, words }
    dictWords.value = words
    dictPos.value = 0
    dictResults.value = []
    dictInput.value = ''
    dictAnswerShown.value = false
    nextTick(() => { playDictWord(); dictInputEl.value?.focus?.() })
  }
}

// === 内容确认页：批量编辑 ===
const editing = ref(false)
const editText = ref('')
const editHint = computed(() => mode.value === 'text' ? '一行一句，标点会保留。' : '一行一个词，格式：单词|音标|中文释义|例句（后两项可留空）。')

function openEditor() {
  if (mode.value === 'text') {
    editText.value = (content.value.lines || []).map(line => line.text).join('\n')
  } else {
    editText.value = (content.value.words || []).map(item => [item.word, item.phonetic, item.meaning, item.example].filter(Boolean).join('|')).join('\n')
  }
  editing.value = true
}

function applyEdit() {
  const rows = editText.value.split('\n').map(row => row.trim()).filter(Boolean)
  if (!rows.length) { ElMessage.warning('内容不能为空。'); return }
  if (mode.value === 'text') {
    content.value = {
      ...content.value,
      kind: 'text',
      lines: rows.map(text => ({ text, hint: '' })),
      needsManual: false
    }
  } else {
    content.value = {
      ...content.value,
      kind: 'words',
      words: rows.map(row => {
        const [word = '', phonetic = '', meaning = '', example = ''] = row.split('|').map(cell => cell.trim())
        return { word, phonetic, meaning: meaning || '（待补充释义）', example }
      }).filter(item => item.word)
    }
  }
  needsManual.value = false
  editing.value = false
  ElMessage.success('已保存到本机，下次进来直接用。')
}

async function regenerate() {
  try {
    await ElMessageBox.confirm('重新生成会覆盖当前的原文与缓存，继续吗？', '重新生成', { type: 'warning' })
  } catch { return }
  const profile = await loadProfile().catch(() => null)
  const result = await generateReciteContent({
    subject: plan.value.subject,
    name: plan.value.name,
    grade: plan.value.grade || profile?.grade || '',
    knowledgeTags: plan.value.knowledgeTags || [],
    kind: mode.value === 'text' ? 'text' : 'words'
  })
  if (result?.success && result.data) {
    content.value = result.data
    contentSource.value = result.source || ''
    needsManual.value = Boolean(result.data.needsManual)
  } else ElMessage.warning('这次没拿到新内容，保持原来的。')
}

// === 语音：模型 + 录音 ===
async function ensureModel() {
  if (modelState.value === 'ready') return true
  modelState.value = 'loading'
  modelProgress.value = 0
  try {
    await loadSpeechModel({ onProgress: info => { modelProgress.value = info.progress || 0 } })
    modelState.value = 'ready'
    return true
  } catch (error) {
    modelState.value = 'failed'
    modelError.value = String(error?.message || error).slice(0, 120)
    return false
  }
}

async function toggleMic() {
  if (listening.value) { closeRecorder(); return }
  if (!navigator.mediaDevices?.getUserMedia) {
    typingMode.value = true
    ElMessage.info('这个浏览器不支持麦克风，改成打字核对。')
    return
  }
  const ok = await ensureModel()
  if (!ok) {
    typingMode.value = true
    ElMessage.info('语音模型没加载成功，改成打字核对。')
    return
  }
  try {
    recorder = createVoiceRecorder({
      onSegment: audio => handleSegment(audio),
      onLevel: value => { level.value = value }
    })
    await recorder.start()
    listening.value = true
    tickStuck()
  } catch (error) {
    listening.value = false
    typingMode.value = true
    ElMessage.info('没拿到麦克风权限，改成打字核对。')
  }
}

function closeRecorder() {
  try { recorder?.stop?.() } catch { /* 已经停了就算了 */ }
  recorder = null
  listening.value = false
  recognizing.value = false
  level.value = 0
}

// 卡住计时：连续 8 秒没有推进就把提示浮出来，不打断用户自己回忆。
function tickStuck() {
  window.clearTimeout(stuckTimer)
  stuckTimer = window.setTimeout(() => {
    if (!listening.value || stage.value !== 'ready') return
    stuckSeconds += 1
    if (stuckSeconds >= 1 && !hintVisible.value) hintVisible.value = true
    tickStuck()
  }, 8000)
}

function resetStuck() {
  stuckSeconds = 0
  hintVisible.value = false
  hintStep.value = 0
  tickStuck()
}

async function handleSegment(audio) {
  if (!currentLine.value || recognizing.value) return
  recognizing.value = true
  try {
    // 只有整句都是 ASCII 才按英文识别：中文句子里夹个字母不能当成英语课文。
    const isEnglish = /^[\x00-\x7F\s]*$/.test(currentLine.value.text)
    const text = await transcribeSegment(audio, { language: isEnglish ? 'english' : 'chinese' })
    lastHeard.value = text
    if (!text) return
    applyLineJudge(text)
  } catch (error) {
    ElMessage.warning('这句没识别出来，再念一次试试。')
  } finally {
    recognizing.value = false
  }
}

function applyLineJudge(heard) {
  const line = currentLine.value
  if (!line) return
  // 化学方程式按「口头读法 → 符号」单独判定：学生念「碳加氧气点燃生成二氧化碳」
  // 和原文 "C + O₂（点燃）→ CO₂" 字符上不重叠，普通覆盖率会误判。
  let result
  if (isChemicalEquation(line.text)) {
    const chem = judgeChemicalEquation(line.text, heard)
    result = {
      ok: chem.ok,
      rate: chem.rate,
      missed: describeMissedTokens(chem.missed)
    }
  } else {
    result = judgeLine(line.text, heard)
  }
  lineResults.value[lineIndex.value] = { heard, ...result }
  if (result.ok) {
    passed.value[lineIndex.value] = true
    hintVisible.value = false
    hintStep.value = 0
    stuckSeconds = 0
    nextLine()
  } else {
    hintVisible.value = true
  }
}

function nextLine() {
  if (lineIndex.value >= totalLines.value - 1) { finishText(); return }
  lineIndex.value += 1
  showCurrentLine.value = false
  resetStuck()
}

function prevLine() {
  if (lineIndex.value <= 0) return
  lineIndex.value -= 1
  passed.value[lineIndex.value] = false
  resetStuck()
}

function finishText() {
  closeRecorder()
  finish()
}

function skipLine() {
  passed.value[lineIndex.value] = true
  lineResults.value[lineIndex.value] = { heard: '（跳过）', ok: false, rate: 0, missed: [] }
  nextLine()
}

function moreHint() {
  hintStep.value += 1
}

function submitTypedLine() {
  const value = typedLine.value.trim()
  if (!value) return
  const line = currentLine.value
  if (!line) return
  // 判定：化学方程式走化学判定，普通句子走覆盖率
  let verdict
  if (isChemicalEquation(line.text)) {
    const chem = judgeChemicalEquation(line.text, value)
    verdict = { ok: chem.ok, rate: chem.rate, missed: describeMissedTokens(chem.missed) }
  } else {
    verdict = judgeLine(line.text, value)
  }
  // 保存判定结果 + 展示三栏对比。化学方程式额外生成「系统翻译化学式」。
  typedResult.value = {
    ok: verdict.ok,
    typed: value,
    translated: isChemicalEquation(line.text) ? spokenToEquation(value) : '',
    target: line.text
  }
  lineResults.value[lineIndex.value] = { heard: value, ...verdict }
  typedLine.value = ''
  // 打字模式不自动跳句：让学生看清对错和三栏对比，再手动「下一个」。
}

function nextAfterTyped() {
  const line = currentLine.value
  if (!line) return
  if (typedResult.value?.ok) passed.value[lineIndex.value] = true
  const wasOk = Boolean(typedResult.value?.ok)
  typedResult.value = null
  hintVisible.value = false
  hintStep.value = 0
  stuckSeconds = 0
  // 答对进下一句；答错留在当前句，让用户重新打一遍。
  if (wasOk) nextLine()
}

// === 背单词 ===
// 卡片翻到新词时自动读一遍，和市面上的背单词 App 一致；关掉「AI 语音朗读」就不出声。
// 点喇叭重播是显式操作：不受开关限制、也不吃去抖，点了就播。
let lastSpokenWord = ''
let lastSpokenAt = 0
function speakWordCard(force = false) {
  const word = currentWord.value?.word
  if (!word) return
  if (!force && !store.settings.ttsEnabled) return
  const now = Date.now()
  if (!force && word === lastSpokenWord && now - lastSpokenAt < 400) return
  lastSpokenWord = word
  lastSpokenAt = now
  speakEnglishWord(word)
}

watch(
  () => currentWord.value?.word,
  word => {
    if (!word) return
    if (stage.value !== 'ready' || mode.value !== 'words' || wordsView.value !== 'card') return
    speakWordCard()
  }
)

function markWord(known) {
  if (!currentWord.value) return
  const index = wordQueue.value[wordPos.value]
  if (known) { if (!knownWords.value.includes(index)) knownWords.value.push(index) }
  else {
    if (!unknownWords.value.includes(index)) unknownWords.value.push(index)
    if (!nextRound.includes(index)) nextRound.push(index)
  }
  advanceWord()
}

function advanceWord() {
  flipped.value = false
  if (wordPos.value < wordQueue.value.length - 1) { wordPos.value += 1; return }
  // 一轮过完：还有没记住的进下一轮，最多三轮，避免无限循环。
  if (nextRound.length && wordRound.value < 3) {
    wordRound.value += 1
    wordQueue.value = [...nextRound]
    nextRound = []
    wordPos.value = 0
    return
  }
  finishWords()
}

function finishWords() {
  finish()
}

// 单词模式内切换练法：进默写时从整份词表重新起一遍；回卡片时清掉默写进度。
function startDictation() {
  dictWords.value = content.value?.words || []
  dictPos.value = 0
  dictResults.value = []
  dictInput.value = ''
  dictAnswerShown.value = false
  wordsView.value = 'dictation'
  nextTick(() => { playDictWord(); dictInputEl.value?.focus?.() })
}

function switchWordsView(view) {
  if (view === wordsView.value) return
  if (view === 'dictation') { startDictation(); return }
  // 回卡片：默写计时停掉，卡片从头开始
  stopDictTimer()
  wordQueue.value = (content.value?.words || []).map((_, index) => index)
  wordPos.value = 0
  wordRound.value = 1
  flipped.value = false
  knownWords.value = []
  unknownWords.value = []
  nextRound = []
  wordsView.value = 'card'
  nextTick(() => speakWordCard())
}

// 背完卡片直接从复盘页进默写：不重开一轮卡片，计时也重新起。
function dictateFromSummary() {
  stage.value = 'ready'
  elapsed.value = 0
  startClock()
  startDictation()
}

// === 打字默写 ===
// 独立听写计划按 10/15 秒自动跳题；单词计划里的默写不设倒计时，留给学生慢慢想。
const dictHasTimer = computed(() => mode.value === 'dictation')

function stopDictTimer() {
  if (dictTimer) { window.clearInterval(dictTimer); dictTimer = 0 }
}

function playDictWord() {
  stopDictTimer()
  const word = currentDictWord.value
  if (!word) return
  dictAnswerShown.value = false
  speakEnglishWord(word.word)
  if (!dictHasTimer.value) return
  dictCountdown.value = secondsPerWord.value
  dictTimer = window.setInterval(() => {
    dictCountdown.value -= 1
    // 倒计时到点就算这一题结束：已经打了一半的直接判，没打的按错处理。
    if (dictCountdown.value <= 0) { stopDictTimer(); submitDict(true) }
  }, 1000)
}

function submitDict(auto = false) {
  const word = currentDictWord.value
  if (!word) return
  const verdict = judgeSpelling(word.word, dictInput.value)
  dictResults.value[dictPos.value] = { answer: word.word, typed: dictInput.value, ok: verdict.ok }
  dictAnswerShown.value = true
  stopDictTimer()
  if (verdict.ok) {
    setTimeout(() => nextDictWord(), 900)
  } else if (auto) {
    setTimeout(() => nextDictWord(), 1600)
  }
}

function nextDictWord() {
  if (dictPos.value >= dictWords.value.length - 1) { finishDict(); return }
  dictPos.value += 1
  dictInput.value = ''
  nextTick(() => playDictWord())
}

function replayWord() { speakEnglishWord(currentDictWord.value?.word) }

function finishDict() {
  stopDictTimer()
  finish()
}

// === 收尾 ===
const summary = ref(null)

// 卡壳处结构化：key 用来生成稳定错题 id，label 供复盘列表展示。
// 当前是否正在做打字默写（独立听写计划，或单词计划里切到了默写）。
const inDictation = computed(() => mode.value === 'dictation' || (mode.value === 'words' && wordsView.value === 'dictation'))

function buildWrongRecords() {
  if (mode.value === 'text') {
    return (content.value.lines || [])
      .map((line, index) => ({ line, index, ok: Boolean(passed.value[index]) }))
      .filter(item => !item.ok)
      .map(({ line, index }) => ({
        key: line.text,
        label: line.text,
        stem: `背诵卡壳：${line.text}`,
        userAnswer: lineResults.value[index]?.heard || '（没背出来）',
        correctAnswer: line.text
      }))
  }
  if (!inDictation.value) {
    return unknownWords.value
      .map(index => content.value.words?.[index])
      .filter(Boolean)
      .map(word => ({
        key: word.word,
        label: word.word,
        stem: `单词没记住：${word.word}${word.meaning ? `（${word.meaning}）` : ''}`,
        userAnswer: '（没记住）',
        correctAnswer: `${word.word}${word.meaning ? ` ${word.meaning}` : ''}`
      }))
  }
  return dictResults.value
    .filter(item => item && !item.ok && item.answer)
    .map(item => ({
      key: item.answer,
      label: item.answer,
      stem: `听写出错：${item.answer}`,
      userAnswer: item.typed || '（没写出来）',
      correctAnswer: item.answer
    }))
}

async function finish() {
  stopClock()
  closeRecorder()
  stopDictTimer()
  const seconds = Math.max(1, Math.round((Date.now() - startedAt.value) / 1000))
  elapsed.value = seconds
  const wrongRecords = buildWrongRecords()
  const wrong = wrongRecords.map(item => item.label)
  const total = mode.value === 'text' ? totalLines.value : (inDictation.value ? dictWords.value.length : wordTotal.value)
  const correct = mode.value === 'text' ? doneCount.value : (inDictation.value ? dictCorrect.value : wordTotal.value - unknownWords.value.length)
  summary.value = { seconds, total, correct: Math.max(0, correct), wrong, wrongSaved: 0 }
  stage.value = 'summary'
  try {
    await saveReciteSession({
      id: makeId('recite'),
      planId: plan.value.id,
      subject: plan.value.subject,
      name: plan.value.name,
      mode: mode.value,
      total,
      correct: Math.max(0, correct),
      wrong,
      durationSeconds: seconds,
      startedAt: startedAt.value,
      endedAt: Date.now(),
      createdAt: Date.now()
    })
    // 背诵时长计入专注：跟计时器那条记录同一套字段，统计口径保持一致。
    await saveFocusSession({
      id: makeId('focus'),
      planId: plan.value.id,
      taskName: plan.value.name,
      subject: plan.value.subject,
      mode: 'recite',
      startedAt: startedAt.value,
      endedAt: Date.now(),
      actualSeconds: seconds,
      completed: true,
      distractionCount: 0,
      focusSeconds: seconds,
      distractedSeconds: 0,
      awaySeconds: 0,
      // 没有摄像头采样，标记为非采样记录，看板会走只读时长的降级展示。
      sampled: false,
      timeline: [],
      createdAt: Date.now()
    })
    // 卡壳处沉淀进错题库：复用已有的复习 / 消灭机制，同一处再卡壳只累加错次。
    const profile = await loadProfile().catch(() => null)
    summary.value.wrongSaved = await persistReciteMistakes({
      planId: plan.value.id,
      subject: plan.value.subject,
      grade: plan.value.grade || profile?.grade || '',
      chapterName: content.value?.title || plan.value.name,
      knowledgeTags: plan.value.knowledgeTags || [plan.value.name],
      records: wrongRecords
    })
  } catch (error) {
    console.warn('背诵记录没能保存。', error)
  }
}

async function completePlanAndBack() {
  if (plan.value) {
    const updated = { ...plan.value, status: 'archived', completedAt: Date.now() }
    await savePlan(updated)
    store.setPlans(await loadPlans())
  }
  router.push({ name: 'plans' })
}

function restart() {
  stopClock()
  elapsed.value = 0
  stage.value = 'ready'
  startClock()
  if (mode.value === 'text') {
    passed.value = new Array(totalLines.value).fill(false)
    lineIndex.value = 0
    lastHeard.value = ''
    dictInput.value = ''
  } else if (mode.value === 'words') {
    wordQueue.value = (content.value.words || []).map((_, index) => index)
    wordPos.value = 0
    wordRound.value = 1
    knownWords.value = []
    unknownWords.value = []
    nextRound = []
    wordsView.value = 'card'
    nextTick(() => speakWordCard())
  } else {
    dictPos.value = 0
    dictResults.value = []
    dictInput.value = ''
    nextTick(() => playDictWord())
  }
}

function backToPlans() {
  router.push({ name: 'plans' })
}
</script>

<template>
  <div class="recite-page">
    <header class="recite-top">
      <button type="button" class="recite-back" @click="backToPlans">
        <span aria-hidden="true">←</span> 学习计划
      </button>
      <div class="recite-title-wrap">
        <p class="recite-eyebrow">{{ plan?.subject || '学习' }} · {{ modeLabel }}</p>
        <h1 class="recite-title">{{ content?.title || plan?.name || '背诵' }}</h1>
      </div>
      <div class="recite-clock">
        <span class="recite-clock-label">用时</span>
        <b>{{ elapsedText }}</b>
      </div>
    </header>

    <!-- 内容确认：模型给的是初稿，先让学生自己看一眼，改完再背 -->
    <section v-if="stage === 'confirm'" class="recite-confirm">
      <div class="confirm-head">
        <div>
          <p class="confirm-eyebrow">开始之前先确认内容</p>
          <h2 class="confirm-title">{{ content?.title }}</h2>
          <p class="confirm-note">
            {{ content?.notice || '内容由 AI 整理，可能和你的课本版本有出入。改一次之后会保存在本机，下次直接用。' }}
          </p>
        </div>
        <div class="confirm-actions">
          <button type="button" class="btn-ghost" @click="openEditor">手动编辑</button>
          <button type="button" class="btn-ghost" @click="regenerate">重新生成</button>
          <button type="button" class="btn-primary" @click="confirmContent">就这样，开始</button>
        </div>
      </div>
      <div v-if="needsManual && !(content?.lines?.length || content?.words?.length)" class="confirm-empty">
        <p>这一篇本地没有收录。</p>
        <button type="button" class="btn-primary" @click="openEditor">粘贴课本原文</button>
      </div>
      <ol v-else-if="content?.kind === 'text'" class="confirm-lines">
        <li v-for="(line, index) in content.lines" :key="index">
          <span class="confirm-no">{{ index + 1 }}</span>
          <p>{{ line.text }}</p>
          <span v-if="line.hint" class="confirm-hint">{{ line.hint }}</span>
        </li>
      </ol>
      <div v-else class="confirm-words">
        <div v-for="word in content?.words" :key="word.word" class="confirm-word">
          <b>{{ word.word }}</b>
          <span class="confirm-phonetic">{{ word.phonetic }}</span>
          <span class="confirm-meaning">{{ word.meaning }}</span>
        </div>
      </div>
    </section>

    <!-- 逐句背诵 -->
    <section v-else-if="stage === 'ready' && mode === 'text'" class="recite-body" :class="{ 'reader-hidden': !showReader }">
      <div class="recite-reader">
        <div class="reader-bar">
          <span class="reader-progress">第 {{ Math.min(lineIndex + 1, totalLines) }} {{ lineUnit }} / 共 {{ totalLines }} {{ lineUnit === '句' ? '句' : '个' }}</span>
          <span class="reader-done">已过 {{ doneCount }}</span>
          <div class="reader-track"><i :style="{ width: progressPercent + '%' }"></i></div>
        </div>
        <ol class="line-list">
          <li
            v-for="(line, index) in content.lines"
            :key="index"
            class="recite-line"
            :class="{ 'is-done': passed[index], 'is-current': index === lineIndex, 'is-future': index > lineIndex }"
          >
            <span class="line-no">{{ index + 1 }}</span>
            <div class="line-main">
              <p class="line-text">{{ line.text }}</p>
              <p v-if="index === lineIndex && line.hint" class="line-hint">{{ line.hint }}</p>
            </div>
            <span v-if="passed[index]" class="line-ok" aria-label="已背过">✓</span>
          </li>
        </ol>
      </div>

      <aside class="recite-panel">
        <!-- 原文藏起后，学生需要一个只看句数、不看内容的锚点 -->
        <div class="panel-card progress-card">
          <p class="progress-label">正在背</p>
          <p class="progress-big">{{ lineProgressText }}</p>
          <div class="progress-actions">
            <button type="button" class="btn-ghost small" @click="toggleCurrentLine">
              {{ showCurrentLine ? '隐藏' : '看一眼这个' }}
            </button>
            <button type="button" class="btn-ghost small" @click="showReader = !showReader">
              {{ showReader ? '收起全部' : '查看全部' }}
            </button>
          </div>
        </div>

        <!-- 只看当前这一句/这一个方程式的原文，不给全部 -->
        <div v-if="showCurrentLine && !showReader" class="panel-card current-line-card">
          <p class="current-line-label">{{ isChemicalLine ? '这个方程式' : '这一句' }}</p>
          <p class="current-line-text">{{ currentLine?.text }}</p>
        </div>

        <!-- 化学方程式：常驻提示这是什么实验、产生什么物质，帮学生想起要背的内容 -->
        <div v-if="isChemicalLine" class="panel-card experiment-card">
          <p class="experiment-label">这个实验是：</p>
          <p class="experiment-text">{{ experimentText }}</p>
        </div>
        <div class="panel-card listen-card" :class="{ 'is-live': listening }">
          <div class="listen-head">
            <span class="listen-dot" :class="{ on: listening }"></span>
            <span class="listen-title">语音录入</span>
          </div>
          <p class="listen-state">{{ listenLabel }}</p>
          <div class="listen-wave" :class="{ on: listening && level > 0.01 }">
            <i v-for="n in 9" :key="n" :style="{ transform: `scaleY(${listening ? Math.min(1, 0.15 + level * 14 * (1 - Math.abs(n - 5) / 9)) : 0.12})` }"></i>
          </div>
          <p v-if="modelState === 'loading'" class="listen-bar"><i :style="{ width: modelProgress + '%' }"></i></p>
          <div class="listen-actions">
            <button v-if="!typingMode" type="button" class="btn-primary wide" @click="toggleMic">
              {{ listening ? '暂停' : '开始背' }}
            </button>
            <button v-else type="button" class="btn-ghost wide" @click="typingMode = false">再试一次语音</button>
            <button type="button" class="btn-ghost small" @click="typingMode = !typingMode">
              {{ typingMode ? '收起键盘' : '改成打字' }}
            </button>
          </div>
          <p v-if="modelError" class="listen-error">模型加载失败：{{ modelError }}</p>
        </div>

        <div v-if="hintVisible || hintStep > 0" class="panel-card hint-card">
          <p class="hint-label">卡在这里了？</p>
          <p class="hint-text">{{ hintText }}</p>
          <div class="hint-actions">
            <button type="button" class="btn-ghost small" @click="moreHint">再提示一点</button>
            <button type="button" class="btn-ghost small" @click="skipLine">下一个</button>
          </div>
        </div>

        <div v-if="typingMode" class="panel-card typing-card">
          <p class="typing-label">把这一句打出来</p>
          <textarea
            v-model="typedLine"
            class="typing-input"
            rows="3"
            placeholder="凭记忆默写，标点可以不写"
            @keydown.enter.exact.prevent="submitTypedLine"
          ></textarea>
          <button v-if="!typedResult" type="button" class="btn-primary wide" @click="submitTypedLine">核对这一句</button>

          <!-- 提交后的反馈：对/错 + 三栏对比 -->
          <div v-if="typedResult" class="typed-feedback">
            <p class="typed-verdict" :class="typedResult.ok ? 'ok' : 'wrong'">
              {{ typedResult.ok ? '✓ 对了' : '✗ 不对' }}
            </p>
            <div class="typed-compare">
              <div class="compare-col">
                <span class="compare-label">你打的</span>
                <p class="compare-text">{{ typedResult.typed }}</p>
              </div>
              <div v-if="typedResult.translated" class="compare-col">
                <span class="compare-label">翻译成化学式</span>
                <p class="compare-text mono">{{ typedResult.translated }}</p>
              </div>
              <div class="compare-col">
                <span class="compare-label">正确原式</span>
                <p class="compare-text mono">{{ typedResult.target }}</p>
              </div>
            </div>
            <button type="button" class="btn-primary wide" @click="nextAfterTyped">
              {{ typedResult.ok ? '下一个' : '再试一次' }}
            </button>
          </div>
        </div>

        <div class="panel-card heard-card">
          <p class="heard-label">刚听到</p>
          <p class="heard-text">{{ lastHeard || '还没有听到声音' }}</p>
          <div class="heard-actions">
            <button type="button" class="btn-ghost small" :disabled="lineIndex === 0" @click="prevLine">上一句</button>
            <button type="button" class="btn-ghost small" @click="skipLine">下一个</button>
          </div>
        </div>
      </aside>
    </section>

    <!-- 快速背单词 -->
    <section v-else-if="stage === 'ready' && mode === 'words'" class="recite-words">
      <div class="words-bar">
        <span>{{ wordsView === 'dictation' ? `第 ${dictPos + 1} / ${dictWords.length} 个` : `第 ${wordPos + 1} / ${wordQueue.length} 个` }}</span>
        <span v-if="wordsView === 'card'">第 {{ wordRound }} 轮</span>
        <span v-if="wordsView === 'card'">已记住 {{ knownWords.length }}</span>
        <span v-else>对 {{ dictCorrect }}</span>
      </div>

      <!-- 卡片速记 -->
      <template v-if="wordsView === 'card'">
        <div class="word-stage">
          <button type="button" class="word-card" :class="{ flipped }" @click="flipped = !flipped">
            <div class="word-face">
              <p class="word-text">{{ currentWord?.word }}</p>
              <div class="word-phon-row">
                <p v-if="currentWord?.phonetic" class="word-phonetic">{{ currentWord?.phonetic }}</p>
                <span
                  class="word-audio"
                  role="button"
                  aria-label="播放读音"
                  tabindex="0"
                  @click.stop="speakWordCard(true)"
                  @keydown.enter.stop.prevent="speakWordCard(true)"
                >
                  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M11 5 6 9H3v6h3l5 4V5z"/><path d="M15.5 8.5a5 5 0 0 1 0 7"/><path d="M18.2 6a8.5 8.5 0 0 1 0 12"/></svg>
                </span>
              </div>
              <p class="word-tip">点一下看意思</p>
            </div>
            <div class="word-back">
              <p class="word-meaning">{{ currentWord?.meaning }}</p>
              <p v-if="currentWord?.example" class="word-example">{{ currentWord?.example }}</p>
            </div>
          </button>
        </div>
        <div class="word-actions">
          <button type="button" class="word-btn unknown" @click="markWord(false)">还不认识</button>
          <button type="button" class="word-btn known" @click="markWord(true)">记住了</button>
        </div>
        <p class="word-footnote">不认识的会再考一轮，最多三轮，2 分钟能过一遍。</p>
      </template>

      <!-- 打字默写 -->
      <template v-else>
        <div class="dict-stage">
          <p class="dict-cn">{{ currentDictWord?.meaning }}</p>
          <button type="button" class="dict-play" @click="replayWord">再听一遍</button>
          <input
            ref="dictInputEl"
            v-model="dictInput"
            class="dict-input"
            :class="{ ok: dictAnswerShown && dictResults[dictPos]?.ok, wrong: dictAnswerShown && !dictResults[dictPos]?.ok }"
            type="text"
            autocomplete="off"
            autocorrect="off"
            autocapitalize="off"
            spellcheck="false"
            placeholder="把听到的单词打出来"
            @keydown.enter.prevent="dictAnswerShown ? nextDictWord() : submitDict(false)"
          />
          <p v-if="dictAnswerShown" class="dict-answer">
            {{ dictResults[dictPos]?.ok ? '对了' : '正确拼写是' }}
            <b>{{ currentDictWord?.word }}</b>
            <span v-if="currentDictWord?.example" class="dict-example">{{ currentDictWord.example }}</span>
          </p>
        </div>
        <!-- 按钮放在卡外，与卡片视图的操作行同位置同高，切换时界面不跳版 -->
        <div class="dict-actions">
          <button v-if="!dictAnswerShown" type="button" class="btn-ghost" @click="submitDict(false)">提交（回车）</button>
          <button v-else type="button" class="btn-ghost" @click="nextDictWord">下一题（回车）</button>
          <button v-if="!dictAnswerShown" type="button" class="btn-ghost" @click="nextDictWord">跳过</button>
        </div>
        <p class="word-footnote">听发音、看中文，把单词打出来 · 回车提交</p>
      </template>

      <div class="words-switch" role="tablist" aria-label="背诵方式">
        <button type="button" class="switch-tab" :class="{ on: wordsView === 'card' }" @click="switchWordsView('card')">卡片速记</button>
        <button type="button" class="switch-tab" :class="{ on: wordsView === 'dictation' }" @click="switchWordsView('dictation')">背诵默写</button>
      </div>
    </section>

    <!-- 打字默写 -->
    <section v-else-if="stage === 'ready' && mode === 'dictation'" class="recite-dict">
      <div class="dict-bar">
        <span>第 {{ dictPos + 1 }} / {{ dictWords.length }} 个</span>
        <div class="dict-interval">
          <span>每词留</span>
          <button v-for="sec in [10, 15]" :key="sec" type="button" :class="{ on: secondsPerWord === sec }" @click="secondsPerWord = sec; playDictWord()">{{ sec }} 秒</button>
        </div>
        <span>对 {{ dictCorrect }}</span>
      </div>
      <div class="dict-stage">
        <p class="dict-cn">{{ currentDictWord?.meaning }}</p>
        <button type="button" class="dict-play" @click="replayWord">再听一遍</button>
        <p class="dict-count">
          <template v-if="dictAnswerShown">下一题马上来</template>
          <template v-else><b>{{ dictCountdown }}</b> 秒后自动下一题</template>
        </p>
        <input
          ref="dictInputEl"
          v-model="dictInput"
          class="dict-input"
          :class="{ ok: dictAnswerShown && dictResults[dictPos]?.ok, wrong: dictAnswerShown && !dictResults[dictPos]?.ok }"
          type="text"
          autocomplete="off"
          autocorrect="off"
          autocapitalize="off"
          spellcheck="false"
          placeholder="把听到的单词打出来"
          @keydown.enter.prevent="submitDict(false)"
        />
        <p v-if="dictAnswerShown" class="dict-answer">
          {{ dictResults[dictPos]?.ok ? '对了' : '正确拼写是' }}
          <b>{{ currentDictWord?.word }}</b>
          <span v-if="currentDictWord?.example" class="dict-example">{{ currentDictWord.example }}</span>
        </p>
        <div class="dict-actions">
          <button type="button" class="btn-ghost" @click="submitDict(false)">提交（回车）</button>
          <button type="button" class="btn-ghost" @click="nextDictWord">跳过</button>
        </div>
      </div>
    </section>

    <!-- 复盘 -->
    <section v-else-if="stage === 'summary'" class="recite-summary">
      <p class="summary-eyebrow">{{ plan?.subject }} · {{ modeLabel }}</p>
      <h2 class="summary-title">这一轮完成了</h2>
      <div class="summary-grid">
        <div><span>用时</span><b>{{ Math.floor(summary.seconds / 60) }} 分 {{ summary.seconds % 60 }} 秒</b></div>
        <div><span>过掉</span><b>{{ summary.correct }} / {{ summary.total }}</b></div>
        <div><span>卡住</span><b>{{ summary.wrong.length }} 处</b></div>
      </div>
      <div v-if="summary.wrong.length" class="summary-wrong">
        <p class="summary-wrong-label">还要再看一眼</p>
        <ul>
          <li v-for="(item, index) in summary.wrong" :key="index">{{ item }}</li>
        </ul>
        <p class="summary-wrong-note">{{ summary.wrongSaved ? `这 ${summary.wrongSaved} 处已存进错题库，按「复习」就能重练。` : '这轮卡壳的地方稍后会汇总进错题库。' }}</p>
      </div>
      <p v-else class="summary-clean">全过了一遍，没有卡住的地方。</p>
      <button v-if="mode === 'words'" type="button" class="summary-dictate" @click="dictateFromSummary">
        <strong>{{ inDictation ? '再默一遍' : '默写这组单词' }}</strong>
        <span>{{ inDictation ? '重新听写，把刚才错过的词再打一遍' : `看中文、听发音，把 ${wordTotal} 个词逐个默一遍` }}</span>
      </button>
      <div class="summary-actions">
        <button type="button" class="btn-ghost" @click="restart">再练一遍</button>
        <button type="button" class="btn-ghost" @click="backToPlans">先不做了</button>
        <button type="button" class="btn-primary" @click="completePlanAndBack">完成并回到计划</button>
      </div>
      <p class="summary-note">本次 {{ Math.max(1, Math.round(summary.seconds / 60)) }} 分钟已计入今天的专注时长。</p>
    </section>

    <div v-else class="recite-loading">
      <div class="skeleton-card">
        <span class="skeleton-bar w40"></span>
        <span class="skeleton-bar w90"></span>
        <span class="skeleton-bar w75"></span>
        <span class="skeleton-bar w85"></span>
        <span class="skeleton-bar w60"></span>
      </div>
      <p class="loading-text">正在按课本整理这一篇，通常 10 秒左右</p>
      <p class="loading-sub">第一次会慢一点，之后的同一篇直接打开</p>
    </div>

    <el-dialog v-model="editing" title="编辑背诵内容" width="640px" append-to-body>
      <p class="edit-hint">{{ editHint }}</p>
      <el-input v-model="editText" type="textarea" :rows="14" resize="none" />
      <template #footer>
        <button type="button" class="btn-ghost" @click="editing = false">取消</button>
        <button type="button" class="btn-primary" @click="applyEdit">保存</button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 局部色板接到全局 token；深色 cover 仍在下方生效，这里只负责浅色。 */
.recite-page{--recite-deep:var(--primary-deep);--recite-mint:var(--primary-soft);--recite-line:var(--border);--recite-soft:var(--surface-soft);--recite-ink:var(--text);--recite-muted:var(--muted);padding:22px 32px 40px;max-width:1180px;margin:0 auto;color:var(--recite-ink)}
.recite-top{display:flex;align-items:flex-start;gap:16px;margin-bottom:18px}
.recite-back{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--recite-line);border-radius:999px;background:#fff;color:var(--recite-muted);font-size:12.5px;font-weight:600;cursor:pointer;transition:border-color .18s ease,color .18s ease}
.recite-back:hover{border-color:var(--recite-deep);color:var(--recite-deep)}
.recite-title-wrap{flex:1;min-width:0}
.recite-eyebrow{margin:0;font-size:11.5px;letter-spacing:.1em;color:var(--recite-muted);text-transform:uppercase}
.recite-title{margin:3px 0 0;font-size:24px;font-weight:700;letter-spacing:-.01em;line-height:1.25;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.recite-clock{display:flex;align-items:baseline;gap:6px;padding:6px 14px;border-radius:999px;background:#fff;border:1px solid var(--recite-line)}
.recite-clock-label{font-size:11px;color:var(--recite-muted)}
.recite-clock b{font-size:16px;font-variant-numeric:tabular-nums;letter-spacing:.02em}

.btn-primary{padding:9px 18px;border:0;border-radius:10px;background:var(--recite-deep);color:#fff;font-size:13px;font-weight:700;cursor:pointer;transition:transform .16s ease,background .16s ease}
.btn-primary:hover{background:#254842;transform:translateY(-1px)}
.btn-ghost{padding:9px 16px;border:1px solid var(--recite-line);border-radius:10px;background:#fff;color:var(--recite-ink);font-size:13px;font-weight:600;cursor:pointer;transition:border-color .16s ease,color .16s ease}
.btn-ghost:hover{border-color:var(--recite-deep);color:var(--recite-deep)}
.btn-ghost:disabled{opacity:.45;cursor:default}
.btn-ghost.small{padding:5px 11px;font-size:12px;border-radius:8px}
.wide{width:100%}
.listen-actions .btn-ghost.small{padding:2px 0;border-color:transparent;background:transparent;color:var(--recite-muted);font-weight:500;text-align:center}
.listen-actions .btn-ghost.small:hover{border-color:transparent;background:transparent;color:var(--recite-deep);text-decoration:underline}
.listen-actions .btn-ghost.small:disabled{color:var(--recite-muted)}

/* 确认页 */
.recite-confirm{display:grid;gap:16px}
.confirm-head{display:flex;align-items:flex-start;gap:20px;padding:18px 20px;border:1px solid var(--recite-line);border-radius:16px;background:#fff}
.confirm-eyebrow{margin:0;font-size:11.5px;font-weight:700;letter-spacing:.08em;color:var(--recite-deep)}
.confirm-title{margin:4px 0 6px;font-size:18px}
.confirm-note{margin:0;font-size:12.5px;line-height:1.7;color:var(--recite-muted);max-width:600px}
.confirm-actions{display:flex;gap:8px;flex:none;margin-left:auto}
.confirm-lines{display:grid;gap:2px;margin:0;padding:6px 4px 4px;list-style:none;border:1px solid var(--recite-line);border-radius:16px;background:#fff}
.confirm-lines li{display:grid;grid-template-columns:28px 1fr auto;gap:10px;align-items:baseline;padding:9px 14px;border-radius:10px}
.confirm-lines li:nth-child(odd){background:var(--recite-soft)}
.confirm-no{font-size:11.5px;color:var(--recite-muted);font-variant-numeric:tabular-nums}
.confirm-lines p{margin:0;font-size:14.5px;line-height:1.7}
.confirm-hint{font-size:11.5px;color:var(--recite-muted)}
.confirm-words{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:8px;padding:14px;border:1px solid var(--recite-line);border-radius:16px;background:#fff}
.confirm-word{display:flex;flex-wrap:wrap;align-items:baseline;gap:6px;padding:8px 10px;border-radius:10px;background:var(--recite-soft);font-size:13px}
.confirm-phonetic{color:var(--recite-muted);font-size:12px}
.confirm-meaning{flex-basis:100%;font-size:12.5px;color:var(--recite-muted)}
.confirm-empty{display:grid;gap:12px;place-items:start;padding:32px;border:1px dashed var(--recite-line);border-radius:16px;background:#fff;color:var(--recite-muted);font-size:13px}

/* 逐句背诵 */
.recite-body{display:grid;grid-template-columns:minmax(0,1fr) 296px;gap:18px;align-items:start}
/* 背诵时默认藏起原文列表：整栏让位，右侧面板独占并居中 */
.recite-body.reader-hidden{grid-template-columns:minmax(0,1fr)}
.recite-body.reader-hidden .recite-reader{display:none}
/* 隐藏原文后，面板独占、顶部留出呼吸空间。内容少时靠上边距营造居中感，
   内容超高（打字三栏对比展开）时能随 .main-content 正常滚动，按钮不会被裁掉。 */
.recite-body.reader-hidden .recite-panel{max-width:480px;justify-self:center;width:100%;align-self:start;margin-top:40px}
/* 阅读卡按视口高度撑开：句子少的时候不至于在页面下方留一大片空白。 */
.recite-reader{display:flex;flex-direction:column;min-height:calc(100vh - 220px);border:1px solid var(--recite-line);border-radius:18px;background:#fff;padding:14px 6px 10px 14px}
.reader-bar{display:flex;align-items:center;gap:12px;padding:0 10px 10px 4px;font-size:11.5px;color:var(--recite-muted)}
.reader-progress{font-weight:700;color:var(--recite-deep)}
.reader-track{flex:1;height:3px;border-radius:2px;background:var(--recite-line);overflow:hidden}
.reader-track i{display:block;height:100%;border-radius:2px;background:var(--recite-deep);transition:width .3s ease}
.line-list{flex:1;min-height:0;margin:0;padding:0 8px 4px 0;list-style:none;overflow-y:auto}
.line-list::-webkit-scrollbar{width:6px}
.line-list::-webkit-scrollbar-thumb{border-radius:3px;background:color-mix(in srgb,var(--recite-deep) 22%,transparent)}
.recite-line{display:grid;grid-template-columns:26px 1fr 20px;gap:10px;align-items:baseline;padding:10px 14px;border-radius:12px;transition:background .18s ease}
.line-no{font-size:11.5px;color:var(--recite-muted);font-variant-numeric:tabular-nums;text-align:right}
.line-text{margin:0;font-size:16.5px;line-height:1.95;letter-spacing:.01em;transition:color .2s ease}
.line-hint{margin:4px 0 0;font-size:12px;color:var(--recite-muted)}
.line-ok{font-size:13px;font-weight:700;color:var(--recite-deep)}
.recite-line.is-future .line-text{color:color-mix(in srgb,var(--recite-ink) 42%,transparent)}
.recite-line.is-done .line-text{color:color-mix(in srgb,var(--recite-ink) 46%,transparent);text-decoration:line-through;text-decoration-color:color-mix(in srgb,var(--recite-deep) 40%,transparent)}
.recite-line.is-current{background:var(--recite-soft);box-shadow:inset 3px 0 0 var(--recite-deep)}
.recite-line.is-current .line-text{font-weight:600;color:var(--recite-ink)}

.recite-panel{display:grid;gap:10px}
.progress-card{display:grid;gap:6px;text-align:center}
.progress-label{margin:0;font-size:11.5px;font-weight:600;letter-spacing:.06em;color:var(--recite-muted)}
.progress-big{margin:0;font-size:24px;font-weight:700;color:var(--recite-ink)}
.progress-big span{font-size:14px;font-weight:600;color:var(--recite-muted)}
.progress-actions{display:flex;gap:8px;justify-content:center}
/* 只看当前这一句/这一个方程式的原文，不给全部 */
.current-line-card{display:grid;gap:8px;background:#fff}
.current-line-label{margin:0;font-size:11.5px;font-weight:600;letter-spacing:.06em;color:var(--recite-muted)}
.current-line-text{margin:0;font-size:18px;font-weight:650;line-height:1.6;color:var(--recite-ink);text-align:center;word-break:break-all}
/* 化学方程式：常驻的「这是什么实验」提示条 */
.experiment-card{display:grid;gap:6px;background:var(--recite-soft);border-color:var(--recite-line)}
.experiment-label{margin:0;font-size:11.5px;font-weight:600;letter-spacing:.06em;color:var(--recite-deep)}
.experiment-text{margin:0;font-size:13px;line-height:1.7;color:var(--recite-ink)}
.panel-card{padding:14px;border:1px solid var(--recite-line);border-radius:14px;background:#fff}
.listen-card.is-live{border-color:color-mix(in srgb,var(--recite-deep) 34%,transparent);box-shadow:0 0 0 3px color-mix(in srgb,var(--recite-mint) 60%,transparent)}
.listen-head{display:flex;align-items:center;gap:7px}
.listen-dot{width:7px;height:7px;border-radius:50%;background:var(--recite-line);transition:background .2s ease}
.listen-dot.on{background:var(--recite-deep);box-shadow:0 0 0 3px color-mix(in srgb,var(--recite-mint) 70%,transparent)}
.listen-title{font-size:11.5px;font-weight:700;letter-spacing:.06em;color:var(--recite-muted)}
.listen-state{margin:8px 0 10px;font-size:12.5px;line-height:1.6;color:var(--recite-ink)}
.listen-wave{display:flex;align-items:center;justify-content:center;gap:4px;height:28px;margin-bottom:10px}
/* 定宽而不是均分：均分时每条会变成方块，看起来像一排色块而不是波形。 */
.listen-wave i{flex:none;width:4px;height:28px;border-radius:2px;background:color-mix(in srgb,var(--recite-deep) 34%,transparent);transform-origin:center;transition:transform .12s linear,background .2s ease;opacity:.5}
.listen-wave.on i{background:var(--recite-deep);opacity:1}
.listen-bar{height:3px;margin:0 0 10px;border-radius:2px;background:var(--recite-line);overflow:hidden}
.listen-bar i{display:block;height:100%;background:var(--recite-deep);transition:width .3s ease}
.listen-actions{display:grid;gap:6px}
.listen-error{margin:8px 0 0;font-size:11.5px;line-height:1.5;color:#a85f4f}
.hint-card{border-color:var(--border);background:var(--accent-soft)}
.hint-label{margin:0 0 6px;font-size:11.5px;font-weight:700;color:#8a6a3a}
.hint-text{margin:0 0 10px;font-size:15px;line-height:1.7;color:#5d4a2c;letter-spacing:.02em}
.hint-actions{display:flex;gap:6px}
.typing-card{display:grid;gap:8px}
.typing-label{margin:0;font-size:11.5px;font-weight:700;color:var(--recite-muted)}
.typing-input{width:100%;padding:9px 11px;border:1px solid var(--recite-line);border-radius:10px;background:var(--recite-soft);color:var(--recite-ink);font-size:14px;line-height:1.7;resize:none;outline:none}
.typing-input:focus{border-color:var(--recite-deep);background:#fff}
/* 打字提交后的对/错 + 三栏对比 */
.typed-feedback{display:grid;gap:10px;margin-top:2px}
.typed-verdict{margin:0;font-size:15px;font-weight:700}
.typed-verdict.ok{color:#5f9179}
.typed-verdict.wrong{color:#b96b63}
.typed-compare{display:grid;gap:8px}
.compare-col{display:grid;gap:3px;padding:9px 11px;border-radius:10px;background:var(--recite-soft)}
.compare-label{margin:0;font-size:11px;font-weight:600;color:var(--recite-muted)}
.compare-text{margin:0;font-size:13.5px;line-height:1.6;color:var(--recite-ink);word-break:break-all}
.compare-text.mono{font-family:'SF Mono',Consolas,Menlo,monospace;font-size:13px;letter-spacing:.01em}
.heard-label{margin:0 0 4px;font-size:11.5px;font-weight:700;color:var(--recite-muted)}
.heard-text{margin:0 0 10px;font-size:13px;line-height:1.65;color:var(--recite-ink);min-height:34px}
.heard-actions{display:flex;gap:6px}

/* 背单词 */
/* 列宽必须显式撑满，否则 place-content:center 会把整列压成内容宽度，词卡就窄了一半。 */
.recite-words{display:grid;grid-template-columns:minmax(0,1fr);gap:14px;justify-items:center;align-content:center;min-height:calc(100vh - 250px);padding:0}
.words-bar{display:flex;gap:18px;font-size:12px;color:var(--recite-muted);font-variant-numeric:tabular-nums}
.word-stage{perspective:1200px;width:min(100%,620px);height:400px}
.word-card{position:relative;width:100%;height:100%;border:0;border-radius:24px;background:transparent;cursor:pointer;transform-style:preserve-3d;transition:transform .42s cubic-bezier(.4,.2,.2,1)}
.word-card.flipped{transform:rotateY(180deg)}
/* 两个视图共用同一套纵向骨架：主行固定在卡片 122px 处，下方内容依次向下排。
   这样「卡片速记」与「背诵默写」切换时，主信息、按钮行、底部说明都停在同一位置。 */
.word-face,.word-back{position:absolute;inset:0;display:grid;justify-items:center;align-content:start;gap:10px;padding:122px 32px 32px;border:1px solid var(--recite-line);border-radius:24px;background:#fff;box-shadow:0 22px 48px -28px rgba(29,58,49,.4);backface-visibility:hidden}
.word-back{align-content:center;padding:32px;transform:rotateY(180deg);background:var(--recite-soft)}
.word-text{margin:0;font-size:56px;font-weight:700;letter-spacing:-.02em;text-align:center}
.word-phon-row{display:flex;align-items:center;justify-content:center;gap:8px;margin:0}
.word-phonetic{margin:0;font-size:16px;color:var(--recite-muted);text-align:center}
/* 音标旁的小喇叭：点一下重播当前词（卡片本身是按钮，这里用 span 承载点击，冒泡截掉不翻面） */
.word-audio{display:inline-grid;place-items:center;width:32px;height:32px;border:1px solid var(--recite-line);border-radius:50%;background:var(--recite-soft);color:var(--recite-deep);cursor:pointer;transition:background .16s ease,transform .16s ease,border-color .16s ease}
.word-audio svg{display:block}
.word-audio:hover{background:#fff;border-color:var(--recite-deep);transform:scale(1.08)}
.word-audio:active{transform:scale(.94)}
.word-tip{margin:10px 0 0;font-size:12px;color:var(--recite-muted);text-align:center}
.word-meaning{margin:0;font-size:28px;font-weight:650;text-align:center;line-height:1.5}
.word-example{margin:0;font-size:14px;line-height:1.7;color:var(--recite-muted);text-align:center}
.word-actions{display:flex;gap:12px;width:min(100%,620px)}
.word-btn{flex:1;padding:14px 0;border-radius:14px;border:1px solid var(--recite-line);background:#fff;font-size:15px;font-weight:700;cursor:pointer;transition:transform .16s ease,border-color .16s ease,background .16s ease}
.word-btn.known{background:var(--recite-deep);border-color:var(--recite-deep);color:#fff}
.word-btn.known:hover{transform:translateY(-1px);background:#254842}
.word-btn.unknown:hover{border-color:var(--recite-deep);color:var(--recite-deep)}
.word-footnote{margin:0;font-size:11.5px;color:var(--recite-muted)}
/* 卡片速记 / 背诵默写切换 */
.words-switch{display:flex;gap:4px;padding:4px;border:1px solid var(--recite-line);border-radius:999px;background:var(--recite-soft)}
.switch-tab{padding:8px 18px;border:0;border-radius:999px;background:transparent;color:var(--recite-muted);font-size:13.5px;font-weight:600;cursor:pointer;transition:background .16s ease,color .16s ease}
.switch-tab.on{background:var(--recite-deep);color:#fff}
/* 单词模式里嵌入的默写面板：和单词卡同宽同高、主行同一高度，切换时不跳版 */
.recite-words .dict-stage{width:min(100%,620px);height:400px;align-content:start;gap:14px;padding:122px 32px 32px}
/* 默写的操作行移到卡外后，与卡片视图的操作行对齐：同宽、同高、按钮等分 */
.recite-words .dict-actions{display:flex;gap:12px;width:min(100%,620px);height:50px}
.recite-words .dict-actions .btn-ghost{flex:1;height:100%;justify-content:center;border-radius:14px;font-size:15px;font-weight:700}

/* 打字默写 */
.recite-dict{display:grid;grid-template-columns:minmax(0,1fr);gap:12px;justify-items:center;align-content:center;min-height:calc(100vh - 250px)}
.dict-bar{display:flex;align-items:center;gap:18px;font-size:12px;color:var(--recite-muted);font-variant-numeric:tabular-nums}
.dict-interval{display:flex;align-items:center;gap:6px}
.dict-interval button{padding:3px 9px;border:1px solid var(--recite-line);border-radius:999px;background:#fff;color:var(--recite-muted);font-size:11.5px;font-weight:600;cursor:pointer}
.dict-interval button.on{border-color:var(--recite-deep);background:var(--recite-deep);color:#fff}
.dict-stage{display:grid;gap:12px;place-items:center;width:min(100%,520px);padding:26px 24px;border:1px solid var(--recite-line);border-radius:20px;background:#fff;box-shadow:0 18px 44px -30px rgba(29,58,49,.36)}
.dict-cn{margin:0;font-size:26px;font-weight:650;text-align:center;line-height:1.5}
.dict-play{padding:6px 14px;border:1px solid var(--recite-line);border-radius:999px;background:var(--recite-soft);color:var(--recite-deep);font-size:12px;font-weight:600;cursor:pointer}
.dict-count{margin:0;font-size:12px;color:var(--recite-muted);font-variant-numeric:tabular-nums}
.dict-count b{font-size:15px;color:var(--recite-deep)}
.dict-input{width:100%;padding:13px 16px;border:1.5px solid var(--recite-line);border-radius:12px;background:var(--recite-soft);color:var(--recite-ink);font-size:20px;font-weight:600;letter-spacing:.02em;text-align:center;outline:none;transition:border-color .18s ease,background .18s ease}
.dict-input:focus{border-color:var(--recite-deep);background:#fff}
.dict-input.ok{border-color:#5f9179;background:#f0faf5}
.dict-input.wrong{border-color:#b96b63;background:#fdf3ee}
.dict-answer{margin:0;font-size:13px;color:var(--recite-muted);text-align:center;line-height:1.7}
.dict-answer b{font-size:16px;color:var(--recite-ink);margin:0 4px}
.dict-example{display:block;margin-top:4px;font-size:12px;color:var(--recite-muted)}
.dict-actions{display:flex;gap:8px}

/* 复盘 */
.recite-summary{display:grid;gap:14px;max-width:620px;margin:max(18px,calc(50vh - 300px)) auto 0;padding:28px;border:1px solid var(--recite-line);border-radius:20px;background:#fff;box-shadow:0 20px 50px -34px rgba(29,58,49,.4)}
.summary-eyebrow{margin:0;font-size:11.5px;font-weight:700;letter-spacing:.08em;color:var(--recite-deep)}
.summary-title{margin:0;font-size:22px}
.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:10px}
.summary-grid div{display:grid;gap:4px;padding:12px;border-radius:12px;background:var(--recite-soft)}
.summary-grid span{font-size:11.5px;color:var(--recite-muted)}
.summary-grid b{font-size:16px;font-variant-numeric:tabular-nums}
.summary-wrong{padding:14px;border-radius:12px;background:#fbf6ea}
.summary-wrong-label{margin:0 0 6px;font-size:11.5px;font-weight:700;color:#8a6a3a}
.summary-wrong ul{margin:0;padding-left:18px;font-size:13px;line-height:1.9;color:#5d4a2c}
.summary-wrong-note{margin:8px 0 0;font-size:11.5px;color:#8a6a3a}
.summary-clean{margin:0;font-size:13px;color:var(--recite-muted)}
.summary-actions{display:flex;gap:8px;margin-top:4px}
/* 背完卡片后直接进默写：整行入口，比普通按钮更显眼 */
.summary-dictate{display:grid;gap:3px;width:100%;padding:13px 16px;border:1px solid color-mix(in srgb,var(--recite-deep) 26%,var(--recite-line));border-radius:12px;background:var(--recite-soft);text-align:left;cursor:pointer;transition:background .16s ease,border-color .16s ease}
.summary-dictate:hover{background:color-mix(in srgb,var(--recite-mint) 56%,#fff);border-color:var(--recite-deep)}
.summary-dictate strong{font-size:14px;color:var(--recite-deep)}
.summary-dictate span{font-size:11.5px;color:var(--recite-muted)}
.summary-note{margin:0;font-size:11.5px;color:var(--recite-muted)}
.recite-loading{display:grid;gap:10px;justify-items:center;place-content:center;min-height:calc(100vh - 260px);color:var(--recite-muted)}
.skeleton-card{display:grid;gap:12px;width:min(100%,620px);padding:26px;border:1px solid var(--recite-line);border-radius:18px;background:#fff}
.skeleton-bar{display:block;height:12px;border-radius:6px;background:linear-gradient(90deg,var(--recite-soft),color-mix(in srgb,var(--recite-mint) 55%,#fff),var(--recite-soft));background-size:200% 100%;animation:skeletonFlow 1.4s ease-in-out infinite}
.skeleton-bar.w40{width:40%}.skeleton-bar.w90{width:90%}.skeleton-bar.w75{width:75%}.skeleton-bar.w85{width:85%}.skeleton-bar.w60{width:60%}
@keyframes skeletonFlow{0%{background-position:120% 0}100%{background-position:-20% 0}}
.loading-text{margin:8px 0 0;font-size:13px;color:var(--recite-ink)}
.loading-sub{margin:0;font-size:11.5px;color:var(--recite-muted)}
@media (prefers-reduced-motion: reduce){.skeleton-bar{animation:none}}
.edit-hint{margin:0 0 8px;font-size:12px;color:var(--recite-muted)}

@media (max-width:1020px){
  .recite-page{padding:18px 20px 32px}
  .recite-body{grid-template-columns:1fr}
  /* 窄屏内容本身就要滚动，不再强制撑满一屏。 */
  .recite-reader,.recite-words,.recite-dict,.recite-loading{min-height:0}
  .recite-summary{margin-top:12px}
  /* 手机上两套视图一起收矮，切换时仍然同尺寸、主行同一高度。 */
  .word-stage{height:320px}
  .recite-words .dict-stage{height:320px;padding-top:84px}
  .word-face{padding-top:84px}
  .word-text{font-size:44px}
}

/* 深色模式：页面本地色板跟随全局 token，避免浅纸卡在深底上发白。 */
:global(:root[data-theme='dark'] .recite-page){--recite-deep:#7fb5ab;--recite-mint:#24423c;--recite-line:#2f4741;--recite-soft:#172724;--recite-ink:#e6f0ec;--recite-muted:#a3b8b2}
</style>
