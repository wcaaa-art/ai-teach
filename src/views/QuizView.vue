// 章节测试：按所选章节出题（日常 / 周测），客观题自动判分，主观题自评，并给出专注时长建议。
<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute } from 'vue-router'
import { extractQuestion, getCurriculumChapters, getCurriculumSubjects, generateQuizQuestions } from '../services/api.js'
import {
  loadPlans, loadQuizFingerprints, loadQuizResults, makeId, savePlan,
  pruneQuizFingerprints, saveFocusSuggestion, saveQuizFingerprints, saveQuizResult
} from '../db/index.js'
import { applyQuizStageResult } from '../utils/stages.js'
import {
  QUIZ_MODE_LIMITS, computeQuizSummary, findWeeklyQuizResult, formatDuration,
  getWeeklyWindowStart, recommendFocusMinutes, stemHash
} from '../utils/quiz.js'
import { formatMathText } from '../utils/formatMath.js'

const route = useRoute()
const page = ref('select')
const mode = ref(route.query.mode === 'weekly' ? 'weekly' : 'daily')
const stage = ref(route.query.stage === '高中' ? '高中' : '初中')
const grade = ref('')
const subject = ref('')
// 教材版本决定章节 id 与命题口径，必须和摸底、计划保持一致。
const edition = ref(String(route.query.edition || ''))
const gradeOptions = ref([])
const subjectOptions = ref([])
const chapters = ref([])
const selectedIds = ref([])
const questionCount = ref(QUIZ_MODE_LIMITS[mode.value].default)
const catalogLoading = ref(false)
const generating = ref(false)
const submitting = ref(false)
const errorMessage = ref('')
const questions = ref([])
const answers = reactive({})
const selfGrades = reactive({})
const quizSource = ref('')
const startedAt = ref(0)
const submittedAt = ref(0)
const elapsedSeconds = ref(0)
const resultSummary = ref(null)
const suggestion = ref(null)
const results = ref([])
const recentCount = ref(0)
const ready = ref(false)
let resultId = ''

// 结果页数字滚动：首次进结果页从 0 滚到目标，主观题自评变化后从当前值滚到新值。
const displayEarned = ref(0)
const displayAccuracy = ref(0)
const displayObjective = ref(0)
let statFrame = 0
function rollStats() {
  cancelAnimationFrame(statFrame)
  const target = {
    earned: Number(resultSummary.value?.earned) || 0,
    accuracy: Math.round((resultSummary.value?.accuracy || 0) * 100),
    objective: Number(resultSummary.value?.objectiveCorrect) || 0
  }
  const from = { earned: displayEarned.value, accuracy: displayAccuracy.value, objective: displayObjective.value }
  const start = performance.now()
  const step = now => {
    const progress = Math.min(1, (now - start) / 900)
    const eased = 1 - Math.pow(1 - progress, 3)
    displayEarned.value = Math.round(from.earned + (target.earned - from.earned) * eased)
    displayAccuracy.value = Math.round(from.accuracy + (target.accuracy - from.accuracy) * eased)
    displayObjective.value = Math.round(from.objective + (target.objective - from.objective) * eased)
    if (progress < 1) statFrame = requestAnimationFrame(step)
  }
  statFrame = requestAnimationFrame(step)
}
watch(page, value => {
  if (value !== 'result') return
  displayEarned.value = 0
  displayAccuracy.value = 0
  displayObjective.value = 0
  rollStats()
})
watch(resultSummary, () => { if (page.value === 'result') rollStats() }, { deep: true })

// 填空/解答的符号面板：根号、求和等键盘不好输入的符号，点一下插到光标处。
const symbolGroups = [
  { label: '数学', items: ['√', '∑', 'π', '°', '±', '×', '÷', '≤', '≥', '≠', '≈', '∞'] },
  { label: '上下标', items: ['²', '³', 'ⁿ', '⁻¹', '₁', '₂', '₃', 'ᵢ', 'ₙ', 'ₖ', '₌', 'ⁱ', 'ᵏ'] },
  { label: '几何集合', items: ['∠', '△', '⊥', '∥', '≌', '∽', '∈', '∩', '∪', '∅'] },
  { label: '理化', items: ['Δ', '↑', '↓', '⇌', '→', 'μ', 'Ω', '∵', '∴'] }
]
const answerInputs = new Map()

function registerAnswerInput(id, el) {
  if (el) answerInputs.set(id, el)
  else answerInputs.delete(id)
}

function insertSymbol(question, symbol) {
  const id = question.id
  const text = String(answers[id] ?? '')
  const input = answerInputs.get(id)?.$el?.querySelector('input, textarea')
  if (!input) { answers[id] = text + symbol; return }
  // 点面板时输入框可能已经失焦，失焦就追加到末尾，聚焦状态按光标位置插入。
  const focused = document.activeElement === input
  const start = focused ? (input.selectionStart ?? text.length) : text.length
  const end = focused ? (input.selectionEnd ?? start) : text.length
  answers[id] = text.slice(0, start) + symbol + text.slice(end)
  nextTick(() => {
    input.focus()
    const caret = start + symbol.length
    input.setSelectionRange(caret, caret)
  })
}
let timer = null

// 手写作答：拍照/上传后只在本机保存，OCR 识别是可选的辅助手段，识别结果可手动改。
const answerImages = reactive({})
const ocrLoading = reactive({})
const photoFiles = new Map()
const photoTarget = ref('')
const photoInput = ref(null)

function pickPhoto(question) {
  photoTarget.value = question.id
  photoInput.value?.click()
}

function removePhoto(question) {
  delete answerImages[question.id]
  photoFiles.delete(question.id)
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

// 长边压到 1280 再存，避免整张原图把 IndexedDB 撑爆。
async function compressImage(file) {
  const raw = await readFileAsDataUrl(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = raw
    })
    const scale = Math.min(1, 1280 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.72)
  } catch { return raw }
}

async function onPhotoChange(event) {
  const file = event.target.files?.[0]
  event.target.value = ''
  const id = photoTarget.value
  if (!file || !id) return
  if (!file.type.startsWith('image/')) { ElMessage.info('请选择图片文件。'); return }
  photoFiles.set(id, file)
  answerImages[id] = { dataUrl: await compressImage(file), name: file.name }
  ElMessage.success('已添加手写稿，可点「识别成文字」自动填入，也可以只保留照片。')
}

async function recognizePhoto(question) {
  if (ocrLoading[question.id]) return
  const file = photoFiles.get(question.id)
  if (!file) { ElMessage.info('没有可识别的照片。'); return }
  ocrLoading[question.id] = true
  try {
    const response = await extractQuestion(file)
    if (!response.success) {
      ElMessage.warning(`识别失败：${response.error || '未知原因'}，可以手动输入或只保留照片。`)
      return
    }
    const text = String(response.data?.text || '').trim()
    if (!text) { ElMessage.info('没有识别到文字，可以手动输入或只保留照片。'); return }
    const current = String(answers[question.id] ?? '').trim()
    answers[question.id] = current ? `${current}\n${text}` : text
    ElMessage.success('已识别并填入，手写内容可能有误，请核对后再交卷。')
  } finally {
    ocrLoading[question.id] = false
  }
}

const modeLimits = computed(() => QUIZ_MODE_LIMITS[mode.value])
const selectedChapters = computed(() => chapters.value.filter(chapter => selectedIds.value.includes(chapter.id)))
const chapterNames = computed(() => selectedChapters.value.map(chapter => chapter.name).join(' · '))
const answeredCount = computed(() => questions.value.filter(question => isAnswered(question)).length)
const progress = computed(() => questions.value.length ? Math.round(answeredCount.value / questions.value.length * 100) : 0)
const weeklyRecord = computed(() => findWeeklyQuizResult(results.value))
const weeklyNextDate = computed(() => {
  const next = new Date(getWeeklyWindowStart() + 7 * 86400000)
  return `${next.getMonth() + 1} 月 ${next.getDate()} 日`
})
const attemptCount = computed(() => results.value.filter(item => item.mode === mode.value && item.grade === grade.value && item.subject === subject.value).length)
const paperSpecLabel = computed(() => stage.value === '高中'
  ? '新高考卷型：单选 5 分 / 多选 6 分（少选得部分分、错选 0 分）/ 填空 5 分 / 解答 10–17 分'
  : '全国中考常见卷型：单选 3 分 / 填空 3 分 / 解答 6–12 分')
const canStart = computed(() => Boolean(
  grade.value && subject.value &&
  selectedIds.value.length >= (mode.value === 'weekly' ? 2 : 1) &&
  (mode.value !== 'weekly' || !weeklyRecord.value) &&
  !generating.value && !catalogLoading.value
))

async function loadGrades(preferredGrade) {
  const response = await getCurriculumSubjects(stage.value, preferredGrade || grade.value)
  if (!response.success) throw new Error(response.error || '课程目录暂时无法加载')
  const data = response.data || {}
  gradeOptions.value = data.grades || []
  grade.value = preferredGrade && gradeOptions.value.includes(preferredGrade) ? preferredGrade : (gradeOptions.value[0] || data.grade || '')
  subjectOptions.value = data.subjects || []
}

async function refreshSubjects() {
  // 科目按年级开设，必须带上年级，否则初二/初三会拿到初一的科目列表。
  const response = await getCurriculumSubjects(stage.value, grade.value)
  subjectOptions.value = response.data?.subjects || []
}

async function loadChapters() {
  if (!grade.value || !subject.value) { chapters.value = []; return }
  catalogLoading.value = true
  const response = await getCurriculumChapters(grade.value, subject.value, edition.value)
  chapters.value = response.success ? (response.data?.chapters || []) : []
  if (!response.success) errorMessage.value = '课程专题暂时无法加载，请确认后端服务已启动。'
  catalogLoading.value = false
}

watch(() => stage.value, async () => {
  if (!ready.value) return
  grade.value = ''
  subject.value = ''
  selectedIds.value = []
  chapters.value = []
  await loadGrades()
})

watch(() => grade.value, async () => {
  if (!ready.value) return
  subject.value = ''
  selectedIds.value = []
  chapters.value = []
  await refreshSubjects()
})

watch(() => subject.value, async () => {
  if (!ready.value) return
  selectedIds.value = []
  await loadChapters()
  await refreshRecentCount()
})

watch(() => mode.value, () => {
  selectedIds.value = selectedIds.value.slice(0, mode.value === 'weekly' ? 6 : 1)
  questionCount.value = QUIZ_MODE_LIMITS[mode.value].default
  errorMessage.value = ''
})

function toggleChapter(chapter) {
  if (mode.value === 'daily') {
    selectedIds.value = selectedIds.value.includes(chapter.id) ? [] : [chapter.id]
    return
  }
  if (selectedIds.value.includes(chapter.id)) {
    selectedIds.value = selectedIds.value.filter(id => id !== chapter.id)
  } else if (selectedIds.value.length >= 6) {
    ElMessage.info('周测最多选 6 个专题，已选满。')
  } else {
    selectedIds.value = [...selectedIds.value, chapter.id]
  }
}

function isAnswered(question) {
  const value = answers[question.id]
  if (question.type === 'single') {
    return value !== undefined && value !== null && value !== '' && Number.isInteger(Number(value))
  }
  if (question.type === 'multiple') return Array.isArray(value) && value.length > 0
  return String(value ?? '').trim().length > 0
}

async function refreshRecentCount() {
  const all = await loadQuizFingerprints()
  const cutoff = Date.now() - 7 * 86400000
  recentCount.value = all.filter(item => Number(item.createdAt || 0) >= cutoff && item.subject === subject.value && item.stage === stage.value).length
}

function startTimer() {
  stopTimer()
  timer = setInterval(() => { elapsedSeconds.value = Math.floor((Date.now() - startedAt.value) / 1000) }, 1000)
}

function stopTimer() {
  if (timer) clearInterval(timer)
  timer = null
}

async function startQuiz() {
  if (!canStart.value) {
    if (mode.value === 'weekly' && weeklyRecord.value) ElMessage.info(`本周周测已完成，下周一（${weeklyNextDate.value}）可以再做。`)
    else ElMessage.info(mode.value === 'weekly' ? '周测请选择至少两个专题。' : '请选择一个章节。')
    return
  }
  generating.value = true
  errorMessage.value = ''
  try {
    // 去重只看近 7 天、同学段同科目的题干；指纹存在 IndexedDB，刷新/重启后仍有效。
    await pruneQuizFingerprints()
    const recent = await loadQuizFingerprints()
    const cutoff = Date.now() - 7 * 86400000
    const recentStems = recent
      .filter(item => Number(item.createdAt || 0) >= cutoff && item.subject === subject.value && item.stage === stage.value)
      .slice(-120)
      .map(item => ({ stem: String(item.stem || '').slice(0, 300), hash: item.id, chapterId: item.chapterId }))
    const response = await generateQuizQuestions({
      mode: mode.value, stage: stage.value, grade: grade.value, subject: subject.value, edition: edition.value,
      chapters: selectedChapters.value.map(chapter => ({ id: chapter.id, name: chapter.name, order: chapter.order, importance: chapter.importance })),
      questionCount: questionCount.value, recentStems, attempt: attemptCount.value + 1
    })
    const list = response.data?.questions || []
    if (!response.success || !list.length) {
      errorMessage.value = response.error || '题目生成失败，请稍后再试。'
      return
    }
    questions.value = list
    quizSource.value = response.source || 'agent'
    resultId = makeId(`quiz-${mode.value}`)
    const now = Date.now()
    await saveQuizFingerprints(list.map(question => ({
      id: stemHash(question.stem),
      stem: String(question.stem || '').slice(0, 300),
      chapterId: question.chapterId,
      chapterName: question.chapterName,
      grade: grade.value,
      subject: subject.value,
      stage: stage.value,
      mode: mode.value,
      quizId: resultId,
      createdAt: now
    })))
    Object.keys(answers).forEach(key => delete answers[key])
    Object.keys(selfGrades).forEach(key => delete selfGrades[key])
    Object.keys(answerImages).forEach(key => delete answerImages[key])
    photoFiles.clear()
    list.forEach(question => {
      if (question.type === 'multiple') answers[question.id] = []
    })
    resultSummary.value = null
    suggestion.value = null
    submittedAt.value = 0
    startedAt.value = Date.now()
    elapsedSeconds.value = 0
    startTimer()
    page.value = 'quiz'
    await refreshRecentCount()
    ElMessage.success(response.source === 'local-fallback' ? '已使用本地兜底题库出题（AI 暂不可用）。' : '题目已生成，开始答题吧。')
  } finally {
    generating.value = false
  }
}

function optionLabel(index) {
  return String.fromCharCode(65 + Number(index))
}

function typeLabel(type) {
  return { single: '单项选择', multiple: '多项选择', fill: '填空', short: '解答' }[type] || '客观题'
}

function answerText(question, value) {
  if (question.type === 'single') {
    const index = Number(value)
    return Number.isInteger(index) && question.options?.[index] ? `${optionLabel(index)}. ${question.options[index]}` : '未作答'
  }
  if (question.type === 'multiple') {
    const list = Array.isArray(value) ? value : []
    return list.length ? list.map(index => `${optionLabel(index)}. ${question.options[index]}`).join('；') : '未作答'
  }
  return String(value ?? '').trim() || '未作答'
}

function isOptionCorrect(question, index) {
  return question.type === 'multiple'
    ? (question.correctIndexes || []).includes(index)
    : Number(question.correctIndex) === index
}

// 解析按行拆开：以选项字母开头的行标注正确/错误，让「为什么对、为什么错」一目了然。
function explanationRows(question) {
  const text = String(question.explanation || '').trim() || '这道题暂未提供解析。'
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^([A-H])[.、:：)]\s*(.*)$/)
    if (!match) return { label: '', text: line, verdict: '' }
    const index = 'ABCDEFGH'.indexOf(match[1])
    return { label: match[1], text: match[2], verdict: isOptionCorrect(question, index) ? 'right' : 'wrong' }
  })
}

function correctText(question) {
  if (question.type === 'single') {
    const index = Number(question.correctIndex)
    return question.options?.[index] ? `${optionLabel(index)}. ${question.options[index]}` : '未提供'
  }
  if (question.type === 'multiple') {
    return (question.correctIndexes || []).map(index => `${optionLabel(index)}. ${question.options[index]}`).join('；') || '未提供'
  }
  if (question.type === 'fill') {
    const extra = (question.acceptableAnswers || []).filter(item => item !== question.answer)
    return `${question.answer}${extra.length ? `（也可写：${extra.join(' / ')}）` : ''}`
  }
  return question.referenceAnswer || '未提供参考答案'
}

function reviewClass(row) {
  if (row.needsSelfGrade) return row.selfGrade === null ? 'self-check' : row.selfGrade >= 1 ? 'correct' : row.selfGrade >= 0.5 ? 'partial' : 'wrong'
  return row.correct === true ? 'correct' : 'wrong'
}

function reviewTag(row) {
  if (row.needsSelfGrade) {
    if (row.selfGrade === null) return { type: 'info', text: '待自评' }
    if (row.selfGrade >= 1) return { type: 'success', text: '自评：正确' }
    if (row.selfGrade >= 0.5) return { type: 'warning', text: '自评：部分正确' }
    return { type: 'danger', text: '自评：未掌握' }
  }
  return row.correct === true ? { type: 'success', text: '回答正确' } : { type: 'danger', text: '回答错误' }
}

async function submitQuiz(force = false) {
  const unanswered = questions.value.filter(question => !isAnswered(question)).length
  if (unanswered && !force) {
    try {
      await ElMessageBox.confirm(`还有 ${unanswered} 题未作答，确定交卷吗？`, '交卷确认', {
        confirmButtonText: '交卷', cancelButtonText: '继续作答', type: 'warning'
      })
    } catch { return }
  }
  submitting.value = true
  try {
    stopTimer()
    submittedAt.value = Date.now()
    elapsedSeconds.value = Math.max(1, Math.floor((submittedAt.value - startedAt.value) / 1000))
    await refreshResult()
    page.value = 'result'
  } finally {
    submitting.value = false
  }
}

// 重新计算整卷（交卷时和主观题自评后都会走这里），同时更新结果记录与专注建议。
async function refreshResult() {
  const summary = computeQuizSummary({ questions: questions.value, answers, selfGrades })
  resultSummary.value = summary
  const seconds = Math.max(1, Math.floor(((submittedAt.value || Date.now()) - startedAt.value) / 1000))
  const byId = new Map(questions.value.map(question => [question.id, question]))
  const wrongChapterIds = new Set()
  for (const row of summary.perQuestion) {
    const wrong = row.needsSelfGrade ? (row.selfGrade !== null && row.selfGrade < 1) : row.correct === false
    if (wrong) {
      const question = byId.get(row.questionId)
      if (question) wrongChapterIds.add(question.chapterId)
    }
  }
  const recommendation = recommendFocusMinutes({
    accuracy: summary.accuracy,
    averageSecondsPerQuestion: seconds / Math.max(1, questions.value.length),
    wrongChapterCount: wrongChapterIds.size,
    questionCount: questions.value.length
  })
  suggestion.value = {
    ...recommendation,
    accuracy: summary.accuracy,
    averageSecondsPerQuestion: Math.round(seconds / Math.max(1, questions.value.length)),
    wrongChapterCount: wrongChapterIds.size
  }
  const record = {
    id: resultId,
    mode: mode.value, stage: stage.value, grade: grade.value, subject: subject.value, edition: edition.value,
    chapterIds: questions.value.map(question => question.chapterId).filter((id, index, list) => list.indexOf(id) === index),
    chapterNames: questions.value.map(question => question.chapterName).filter((name, index, list) => list.indexOf(name) === index),
    questions: questions.value,
    answers: { ...answers },
    answerImages: { ...answerImages },
    selfGrades: { ...selfGrades },
    perQuestion: summary.perQuestion,
    score: summary.earned,
    maxScore: summary.totalMax,
    accuracy: summary.accuracy,
    objectiveCorrect: summary.objectiveCorrect,
    objectiveCount: summary.objectiveCount,
    subjectiveCount: summary.subjectiveCount,
    subjectiveGraded: summary.subjectiveGraded,
    durationSeconds: seconds,
    questionCount: questions.value.length,
    source: quizSource.value,
    suggestion: suggestion.value,
    startedAt: startedAt.value,
    submittedAt: submittedAt.value || Date.now(),
    createdAt: submittedAt.value || Date.now(),
    updatedAt: Date.now()
  }
  // questions/answers/selfGrades 是 Vue 响应式代理，IndexedDB 结构化克隆会报 DataCloneError；
  // 先转成纯 JSON 对象再落库，保证刷新后周测限制与历史记录可读。
  await saveQuizResult(JSON.parse(JSON.stringify(record)))
  // 专注建议固定写 current，专注页可用 loadFocusSuggestion() 读取 recommendedMinutes。
  await saveFocusSuggestion({
    ...suggestion.value, source: `${mode.value}-quiz`, quizId: resultId, createdAt: Date.now()
  })
  // 章节正确率直接驱动四阶段：≥80% 归档概念与例题推进到迁移，<60% 重新打开例题重练。
  // 结果按题量加权，主观题自评变化后重新计算时会再走一次，函数本身幂等。
  const plans = await loadPlans()
  const transition = applyQuizStageResult({ plans, result: record })
  for (const plan of transition.changed) await savePlan(plan)
  if (transition.changed.length) ElMessage.info(transition.message)
  results.value = await loadQuizResults()
}

async function onSelfGradeChange(questionId) {
  const record = results.value.find(item => item.id === resultId)
  if (record) submittedAt.value = record.submittedAt
  await refreshResult()
}

function nextQuiz() {
  if (mode.value === 'weekly') {
    mode.value = 'daily'
    ElMessage.info('本周周测已完成，已切换到日常测试；下周可再做周测。')
  }
  page.value = 'select'
  questions.value = []
  resultSummary.value = null
  suggestion.value = null
  Object.keys(answers).forEach(key => delete answers[key])
  Object.keys(selfGrades).forEach(key => delete selfGrades[key])
  Object.keys(answerImages).forEach(key => delete answerImages[key])
  photoFiles.clear()
}

onMounted(async () => {
  try {
    const preferredGrade = String(route.query.grade || '')
    await loadGrades(preferredGrade)
    await refreshSubjects()
    const preferredSubject = String(route.query.subject || '')
    // 没有显式指定科目时，优先跟随当前学习计划：学生刚生成数学计划，不应默认去测语文。
    const plans = await loadPlans()
    const planSubject = plans.map(plan => plan.subject).find(item => subjectOptions.value.includes(item))
    subject.value = subjectOptions.value.includes(preferredSubject) ? preferredSubject : (planSubject || subjectOptions.value[0] || '')
    // 地址没带版本时跟随该科目的计划版本，保证章节 id 能对上，成绩才能回流到计划。
    if (!edition.value) edition.value = plans.find(plan => plan.subject === subject.value && plan.edition)?.edition || ''
    await loadChapters()
    const requested = String(route.query.chapters || '').split(',').filter(Boolean)
    selectedIds.value = (mode.value === 'weekly'
      ? requested.filter(id => chapters.value.some(chapter => chapter.id === id)).slice(0, 6)
      : requested.filter(id => chapters.value.some(chapter => chapter.id === id)).slice(0, 1))
    results.value = await loadQuizResults()
    await refreshRecentCount()
  } catch (error) {
    errorMessage.value = '课程目录暂时无法加载，请确认 API 服务已经启动。'
  } finally {
    ready.value = true
  }
})

onBeforeUnmount(() => { stopTimer(); cancelAnimationFrame(statFrame) })
</script>

<template>
  <div class="page quiz-page">
    <input ref="photoInput" type="file" accept="image/*" class="photo-input" @change="onPhotoChange" />
    <div class="page-header">
      <div>
        <span class="eyebrow">CHAPTER QUIZ · 章节测试</span>
        <h2 class="page-title">{{ mode === 'weekly' ? '周测：跨章节综合检验' : '日常测试：学什么就考什么' }}</h2>
        <p class="page-subtitle">按所选章节出题，题型对齐 {{ stage === '高中' ? '新高考' : '全国中考常见' }}卷型；近 7 天出过的题干会自动避开。</p>
      </div>
      <el-tag v-if="edition" type="info" effect="plain">{{ subject }} · {{ edition }}</el-tag>
    </div>

    <el-alert v-if="errorMessage" :title="errorMessage" type="warning" :closable="false" show-icon class="notice" />

    <section v-if="page === 'select'" class="surface surface-pad">
      <div class="quiz-mode-row">
        <el-segmented v-model="mode" :options="[{ label: '日常测试', value: 'daily' }, { label: '周测', value: 'weekly' }]" />
        <span class="muted">{{ mode === 'weekly' ? '每周一次 · 覆盖多个章节 · 10–15 题' : '随时可做 · 针对单个章节 · 5–8 题' }}</span>
      </div>

      <el-alert
        v-if="mode === 'weekly' && weeklyRecord"
        :title="`本周周测已完成（${weeklyRecord.score}/${weeklyRecord.maxScore} 分），下周一（${weeklyNextDate}）可以再做。`"
        type="info" :closable="false" show-icon class="weekly-alert" />

      <div class="step-heading"><span class="step-number">01</span><div><h3>选择出题范围</h3><p class="muted">学段、年级、科目与诊断页一致；只出所选章节的内容</p></div></div>
      <div class="selection-grid">
        <el-form-item label="当前学段"><el-segmented v-model="stage" :options="['初中', '高中']" /></el-form-item>
        <el-form-item label="当前年级"><el-select v-model="grade" placeholder="请选择年级" :loading="catalogLoading"><el-option v-for="item in gradeOptions" :key="item" :label="item" :value="item" /></el-select></el-form-item>
        <el-form-item label="主要科目"><el-select v-model="subject" placeholder="选择年级后选择科目" :loading="catalogLoading"><el-option v-for="item in subjectOptions" :key="item" :label="item" :value="item" /></el-select></el-form-item>
      </div>

      <div class="step-heading chapter-heading"><span class="step-number">02</span><div><h3>选择章节</h3><p class="muted">{{ mode === 'weekly' ? '周测至少选 2 个章节，最多 6 个' : '日常测试选择一个章节' }}</p></div><el-tag effect="plain">{{ selectedIds.length }} 个已选</el-tag></div>
      <div v-if="catalogLoading" class="empty">正在读取课程章节…</div>
      <div v-else-if="chapters.length" class="chapter-grid">
        <button v-for="chapter in chapters" :key="chapter.id" class="chapter-chip" :class="{ selected: selectedIds.includes(chapter.id) }" @click="toggleChapter(chapter)">
          <span class="chapter-order">{{ String(chapter.order ?? '').padStart(2, '0') }}</span>
          <span class="chapter-name">{{ chapter.name }}</span>
          <span class="chapter-check">{{ selectedIds.includes(chapter.id) ? '✓' : '+' }}</span>
        </button>
      </div>
      <div v-else class="empty">没有找到这个组合的章节目录。</div>

      <div class="step-heading chapter-heading"><span class="step-number">03</span><div><h3>题量与卷型</h3><p class="muted">{{ paperSpecLabel }}</p></div></div>
      <div class="quiz-setting-row">
        <el-form-item :label="`题目数量（${modeLimits.min}–${modeLimits.max} 题）`">
          <el-input-number v-model="questionCount" :min="modeLimits.min" :max="modeLimits.max" />
        </el-form-item>
        <p class="muted recent-tip">近 7 天同科目已出过 {{ recentCount }} 道题，本次生成会自动避开这些题干。</p>
      </div>

      <div class="actions quiz-start-actions">
        <el-button type="primary" size="large" :loading="generating" :disabled="!canStart" @click="startQuiz">
          {{ mode === 'weekly' ? '生成本周周测' : '生成日常测试' }}
        </el-button>
        <span v-if="!canStart && !generating" class="muted hint">{{ !grade ? '请选择年级' : !subject ? '请选择科目' : mode === 'weekly' && selectedIds.length < 2 ? '周测至少选 2 个章节' : mode === 'weekly' && weeklyRecord ? '本周周测已完成' : '' }}</span>
      </div>
    </section>

    <section v-else-if="page === 'quiz'" class="quiz-layout">
      <div class="surface surface-pad quiz-header">
        <div class="quiz-meta-top">
          <el-tag>{{ mode === 'weekly' ? '本周周测' : '日常测试' }}</el-tag>
          <el-tag effect="plain">{{ grade }} · {{ subject }}</el-tag>
          <span class="muted chapter-summary">{{ chapterNames }}</span>
          <span class="quiz-timer">已用 {{ formatDuration(elapsedSeconds) }}</span>
        </div>
        <p class="muted quiz-progress-text">已完成 {{ answeredCount }} / {{ questions.length }} 题 · 客观题自动判分，解答题交卷后对照参考答案自评</p>
        <el-progress :percentage="progress" :show-text="false" />
      </div>

      <article v-for="(question, index) in questions" :key="question.id" class="surface surface-pad question-card">
        <div class="question-meta">
          <el-tag effect="plain">{{ index + 1 }} / {{ questions.length }}</el-tag>
          <el-tag size="small" type="info" effect="plain">{{ typeLabel(question.type) }}</el-tag>
          <el-tag size="small" effect="plain">{{ question.chapterName }}</el-tag>
          <span class="score-hint">{{ question.score }} 分</span>
        </div>
        <h3 v-html="formatMathText(question.stem)"></h3>
        <el-radio-group v-if="question.type === 'single'" v-model="answers[question.id]" class="answer-options">
          <el-radio v-for="(option, optionIndex) in question.options" :key="optionIndex" :value="optionIndex" border><span v-html="optionLabel(optionIndex) + '. ' + formatMathText(option)"></span></el-radio>
        </el-radio-group>
        <el-checkbox-group v-else-if="question.type === 'multiple'" v-model="answers[question.id]" class="answer-options">
          <el-checkbox v-for="(option, optionIndex) in question.options" :key="optionIndex" :value="optionIndex" border><span v-html="optionLabel(optionIndex) + '. ' + formatMathText(option)"></span></el-checkbox>
        </el-checkbox-group>
        <div v-else class="answer-entry">
          <el-input v-if="question.type === 'fill'" :ref="el => registerAnswerInput(question.id, el)" v-model="answers[question.id]" placeholder="填写答案（数值或短语）" />
          <el-input v-else :ref="el => registerAnswerInput(question.id, el)" v-model="answers[question.id]" type="textarea" :rows="5" placeholder="写出解答过程或关键步骤" />
          <div class="symbol-pad" role="group" aria-label="符号快捷输入">
            <div v-for="group in symbolGroups" :key="group.label" class="symbol-group">
              <span class="symbol-label">{{ group.label }}</span>
              <button v-for="symbol in group.items" :key="symbol" type="button" class="symbol-key" @mousedown.prevent="insertSymbol(question, symbol)">{{ symbol }}</button>
            </div>
            <p class="symbol-hint">求和这样写：∑ᵢ₌₁ⁿ aᵢ（先点 ∑，再用上下标拼）；根号写 √，分式写 1/2。</p>
          </div>
          <div class="photo-row">
            <el-button size="small" @click="pickPhoto(question)">{{ answerImages[question.id] ? '重新上传手写稿' : '拍照 / 上传手写稿' }}</el-button>
            <el-button v-if="answerImages[question.id]" size="small" :loading="ocrLoading[question.id]" title="首次识别需加载本地识别模型，可能要等十几秒" @click="recognizePhoto(question)">识别成文字</el-button>
            <el-button v-if="answerImages[question.id]" size="small" text type="danger" @click="removePhoto(question)">删除照片</el-button>
            <span class="photo-note">照片只保存在本机，不会上传服务器</span>
          </div>
          <div v-if="answerImages[question.id]" class="photo-preview">
            <img :src="answerImages[question.id].dataUrl" :alt="`第 ${question.id} 题手写稿`" />
          </div>
        </div>
      </article>

      <div class="actions quiz-actions">
        <el-button @click="page = 'select'">返回重选</el-button>
        <el-button type="primary" size="large" :loading="submitting" @click="submitQuiz(false)">交卷并查看批改</el-button>
      </div>
    </section>

    <section v-else class="result-layout">
      <div class="surface surface-pad result-header">
        <span class="eyebrow">QUIZ RESULT · 测试结果</span>
        <h2>{{ mode === 'weekly' ? '本周周测' : '日常测试' }} · {{ grade }} {{ subject }}</h2>
        <p class="muted">{{ chapterNames }}</p>
        <div class="result-stats">
          <div class="stat-card"><div class="stat-label">得分</div><div class="stat-value">{{ displayEarned }} <small>/ {{ resultSummary?.totalMax }}</small></div></div>
          <div class="stat-card"><div class="stat-label">正确率</div><div class="stat-value">{{ displayAccuracy }}%</div></div>
          <div class="stat-card"><div class="stat-label">用时</div><div class="stat-value">{{ formatDuration(elapsedSeconds) }}</div></div>
          <div class="stat-card"><div class="stat-label">客观题</div><div class="stat-value">{{ displayObjective }} <small>/ {{ resultSummary?.objectiveCount }}</small></div></div>
        </div>
        <p v-if="resultSummary && !resultSummary.complete" class="muted">还有 {{ resultSummary.subjectiveCount - resultSummary.subjectiveGraded }} 道解答题未自评，完成后得分和正确率会自动更新。</p>
        <p v-else class="muted">整卷已判分完毕。</p>
      </div>

      <div v-if="suggestion" class="surface surface-pad suggestion-card">
        <div>
          <span class="eyebrow">FOCUS SUGGESTION · 专注建议</span>
          <h3>建议下次专注 {{ suggestion.recommendedMinutes }} 分钟</h3>
          <p class="muted">{{ suggestion.reason }}</p>
          <p class="suggestion-note">建议已写入本地 IndexedDB（focusSuggestions.current），专注页读取 recommendedMinutes 即可展示，不会强行修改你的计划。</p>
        </div>
        <el-button type="primary" @click="$router.push('/focus')">去专注空间</el-button>
      </div>

      <section class="surface surface-pad answer-review">
        <h3 class="section-title">逐题批改与答案</h3>
        <article v-for="(question, index) in questions" :key="`review-${question.id}`" class="review-card" :class="reviewClass(resultSummary?.perQuestion?.find(row => row.questionId === question.id) || {})" :style="{ animationDelay: `${Math.min(index, 8) * 60}ms` }">
          <div class="question-meta">
            <el-tag effect="plain">第 {{ index + 1 }} 题 · {{ question.chapterName }}</el-tag>
            <el-tag size="small" type="info" effect="plain">{{ typeLabel(question.type) }}</el-tag>
            <el-tag size="small" class="verdict-tag" :type="reviewTag(resultSummary?.perQuestion?.find(row => row.questionId === question.id) || {}).type" :style="{ animationDelay: `${Math.min(index, 8) * 60 + 260}ms` }">
              {{ reviewTag(resultSummary?.perQuestion?.find(row => row.questionId === question.id) || {}).text }}
            </el-tag>
            <span class="score-hint">{{ resultSummary?.perQuestion?.find(row => row.questionId === question.id)?.earned || 0 }} / {{ question.score }} 分</span>
          </div>
          <h4 v-html="formatMathText(question.stem)"></h4>
          <p class="review-line"><strong>你的作答：</strong><span v-html="formatMathText(answerText(question, answers[question.id]))"></span></p>
          <img v-if="answerImages[question.id]" class="answer-photo" :src="answerImages[question.id].dataUrl" alt="手写作答照片" />
          <p class="review-line"><strong>参考答案：</strong><span v-html="formatMathText(correctText(question))"></span></p>
          <div class="review-explanation"><strong>解析：</strong>
            <ul class="explanation-list">
              <li v-for="(row, rowIndex) in explanationRows(question)" :key="rowIndex" :class="row.verdict">
                <span v-if="row.label" class="option-badge">{{ row.label }}</span>
                <span v-html="formatMathText(row.text)"></span>
                <em v-if="row.verdict" class="verdict">{{ row.verdict === 'right' ? '正确项 · 成立依据' : '错误项 · 反例' }}</em>
              </li>
            </ul>
          </div>
          <div v-if="question.type === 'short'" class="self-grade-row">
            <span class="muted">对照参考答案自评：</span>
            <el-radio-group v-model="selfGrades[question.id]" @change="onSelfGradeChange(question.id)">
              <el-radio-button :value="1">正确</el-radio-button>
              <el-radio-button :value="0.5">部分正确</el-radio-button>
              <el-radio-button :value="0">未掌握</el-radio-button>
            </el-radio-group>
          </div>
        </article>
      </section>

      <div class="actions quiz-actions">
        <el-button type="primary" @click="nextQuiz">再测一次（自动避开近 7 天题目）</el-button>
        <el-button @click="$router.push('/diagnosis')">回到学情诊断</el-button>
      </div>
    </section>
  </div>
</template>

<style scoped>
/* 结果页入场：统计数字滚动，逐题卡片浮入，正确/错误标签在卡片到位后弹一下。 */
.result-layout .review-card{animation:quizCardIn .4s cubic-bezier(.2,.7,.3,1) both}
.verdict-tag{animation:verdictPop .4s cubic-bezier(.2,.7,.3,1) both}
.result-stats .stat-value{font-variant-numeric:tabular-nums}
@keyframes quizCardIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes verdictPop{0%{opacity:0;transform:scale(.86)}62%{transform:scale(1.05)}100%{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.result-layout .review-card,.verdict-tag{animation:none}}
.quiz-page{max-width:1180px}.notice{margin:0 0 16px}.quiz-mode-row{display:flex;align-items:center;gap:16px;flex-wrap:wrap;padding-bottom:18px;border-bottom:1px solid var(--border);margin-bottom:20px}.weekly-alert{margin-bottom:16px}.step-heading{display:flex;gap:14px;align-items:center;margin-bottom:16px}.step-heading h3{margin:0 0 4px;font-size:17px}.step-heading p{margin:0;font-size:13px}.step-number{display:grid;place-items:center;width:36px;height:36px;border-radius:12px;background:var(--primary-soft);color:var(--primary);font-weight:800;flex:none}.chapter-heading{margin-top:24px;padding-top:20px;border-top:1px solid var(--border)}.selection-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.selection-grid :deep(.el-form-item){display:flex;flex-direction:column;margin-bottom:8px}.selection-grid :deep(.el-select){width:100%}.chapter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.chapter-chip{min-height:58px;display:flex;align-items:center;gap:12px;text-align:left;padding:12px;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft);color:var(--text);cursor:pointer;transition:background .18s,border-color .18s,transform .18s}.chapter-chip:hover{border-color:var(--primary);transform:translateY(-1px)}.chapter-chip.selected{border-color:var(--primary);background:var(--primary-soft)}.chapter-order{color:var(--muted);font:700 11px ui-monospace,monospace}.chapter-chip .chapter-name{flex:1;font-size:13px;line-height:1.45}.chapter-check{font-size:16px;color:var(--primary)}.quiz-setting-row{display:flex;align-items:center;gap:22px;flex-wrap:wrap}.quiz-setting-row :deep(.el-form-item){margin:0}.recent-tip{font-size:12px;line-height:1.6}.quiz-start-actions{margin-top:18px}.quiz-start-actions .hint{font-size:12px}.quiz-layout{max-width:900px;margin:auto;display:grid;gap:14px}.quiz-header h2{margin:8px 0}.quiz-meta-top{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.quiz-timer{margin-left:auto;font:700 14px ui-monospace,monospace;color:var(--primary)}.chapter-summary{font-size:13px}.quiz-progress-text{margin:12px 0 8px;font-size:13px}.question-card h3{line-height:1.7;font-size:17px;margin:18px 0}.question-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap}.score-hint{margin-left:auto;font-size:12px;color:var(--muted)}.answer-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.answer-options :deep(.el-radio),.answer-options :deep(.el-checkbox){height:auto;min-height:48px;margin:0;padding:12px;white-space:normal;align-items:flex-start}.answer-options :deep(.el-radio__label),.answer-options :deep(.el-checkbox__label){white-space:normal;line-height:1.5}.quiz-actions{justify-content:flex-end;margin-top:18px}.result-layout{display:grid;gap:18px}.result-header{background:linear-gradient(125deg,var(--surface),var(--primary-soft))}.result-stats{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin-top:16px}.result-stats .stat-value{font-size:24px}.result-stats small{font-size:13px;color:var(--muted)}.suggestion-card{display:flex;justify-content:space-between;align-items:center;gap:22px;border-color:var(--primary)}.suggestion-card h3{margin:6px 0;font-size:20px}.suggestion-card p{margin:0;line-height:1.7}.suggestion-note{font-size:12px;margin-top:6px!important;color:var(--muted)}.answer-review{display:grid;gap:12px}.review-card{padding:16px;border:1px solid var(--border);border-left:4px solid var(--border);border-radius:12px;background:var(--surface-soft)}.review-card.correct{border-left-color:var(--success,#67c23a)}.review-card.wrong{border-left-color:var(--danger,#f56c6c)}.review-card.partial{border-left-color:var(--warning,#e6a23c)}.review-card.self-check{border-left-color:var(--info,#909399)}.review-card h4{margin:12px 0 8px;line-height:1.6}.review-line,.review-explanation{margin:6px 0;font-size:13px;line-height:1.65}.review-explanation strong{display:block;margin-bottom:4px}.explanation-list{display:grid;gap:5px;margin:0;padding:0;list-style:none}.explanation-list li{display:flex;gap:8px;align-items:flex-start;line-height:1.7}.explanation-list li.right,.explanation-list li.wrong{border-radius:7px;padding:4px 7px}.explanation-list li.right{background:rgba(103,194,58,.09)}.explanation-list li.wrong{background:rgba(245,108,108,.09)}.option-badge{display:grid;place-items:center;width:20px;height:20px;flex:none;border-radius:6px;background:#fff;border:1px solid var(--border);font:700 11px ui-monospace,monospace;margin-top:3px}.explanation-list li.right .option-badge{color:var(--success,#67c23a);border-color:var(--success,#67c23a)}.explanation-list li.wrong .option-badge{color:var(--danger,#f56c6c);border-color:var(--danger,#f56c6c)}.explanation-list .verdict{flex:none;margin-left:auto;align-self:center;font-size:11px;font-style:normal;color:var(--muted);white-space:nowrap}.explanation-list li.right .verdict{color:var(--success,#67c23a)}.explanation-list li.wrong .verdict{color:var(--danger,#f56c6c)}.self-grade-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:12px;padding-top:12px;border-top:1px dashed var(--border)}@media(max-width:850px){.selection-grid,.chapter-grid{grid-template-columns:1fr 1fr}.result-stats{grid-template-columns:1fr 1fr}.suggestion-card{align-items:flex-start;flex-direction:column}}@media(max-width:560px){.selection-grid,.chapter-grid,.answer-options,.result-stats{grid-template-columns:1fr}.quiz-actions{flex-direction:column}.quiz-actions .el-button{width:100%}.quiz-progress-text{font-size:12px}}
.answer-entry{display:grid;gap:10px}.symbol-pad{display:flex;flex-wrap:wrap;gap:6px 14px;padding:10px 12px;border:1px dashed var(--border);border-radius:12px;background:var(--surface-soft)}.symbol-group{display:flex;align-items:center;gap:5px;flex-wrap:wrap}.symbol-label{font-size:11px;color:var(--muted);margin-right:2px}.symbol-key{min-width:28px;height:28px;padding:0 6px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:14px;line-height:1;cursor:pointer;transition:background .15s,border-color .15s,color .15s}.symbol-key:hover{border-color:var(--primary);background:var(--primary-soft);color:var(--primary)}
.symbol-hint{flex-basis:100%;margin:2px 0 0;font-size:11px;line-height:1.6;color:var(--muted)}.photo-input{display:none}.photo-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}.photo-note{font-size:11px;color:var(--muted)}.photo-preview img,.answer-photo{max-width:260px;max-height:220px;border:1px solid var(--border);border-radius:10px;background:#fff}.answer-photo{display:block;margin:6px 0}
</style>
