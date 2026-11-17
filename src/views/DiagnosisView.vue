<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import ChartPanel from '../components/ChartPanel.vue'
import VideoSuggestion from '../components/VideoSuggestion.vue'
import { analyzeExamPaper, extractQuestion, getCurriculumChapters, getCurriculumSubjects, generateDiagnosticQuestions, generateLearningPlan, generatePlanSkeleton, prefetchDiagnosticQuestions } from '../services/api.js'
import { deletePlan, loadAssessments, loadExamScores, loadMistakes, loadPlans, loadProfile, loadQuizResults, makeId, saveAssessment, saveMistake, savePlan, saveProfile } from '../db/index.js'
import { buildAssessmentMistakes } from '../utils/assessmentMistakes.js'
import { mergeChapterMastery } from '../utils/mastery.js'
import { useAppStore } from '../stores/app.js'
import { formatMathText } from '../utils/formatMath.js'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const page = ref('select')
const loading = ref(false)
const catalogLoading = ref(false)
const assessmentLoading = ref(false)
const prefetchState = ref('')
let prefetchTimer = null
let prefetchToken = 0
const errorMessage = ref('')
const gradeOptions = ref([])
const subjectOptions = ref([])
const chapters = ref([])
const questions = ref([])
const answers = reactive({})
const questionCount = ref(10)
const assessmentReview = ref([])
const assessmentAnsweredCount = ref(0)
const assessmentCorrectCount = ref(0)
const assessmentObjectiveCount = ref(0)
const generatedPlans = ref([])
const explanation = ref('')

// 解析按行拆开：以选项字母开头的行标注正确/错误，和章节测试保持一致。
function reviewExplanationRows(question) {
  const text = String(question.explanation || '').trim() || '这道题暂未提供解析。'
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^([A-H])[.、:：)]\s*(.*)$/)
    if (!match) return { label: '', text: line, verdict: '' }
    const index = 'ABCDEFGH'.indexOf(match[1])
    return { label: match[1], text: match[2], verdict: index === Number(question.correctIndex) ? 'right' : 'wrong' }
  })
}
const masteryByChapter = ref({})
const assessmentSource = ref('')
const assessmentHistory = ref([])
const profile = reactive({ stage: '初中', grade: '', subject: '', edition: '', dailyMinutes: 60, targets: {} })
// 各科满分不同（语数英多为 120，理化史政多为 100），目标分必须按科目分开存。
const DEFAULT_FULL = { 语文: 120, 数学: 120, 英语: 120, 物理: 100, 化学: 100, 历史: 100, 道德与法治: 100, 生物: 100, 地理: 100 }
const defaultFull = subject => DEFAULT_FULL[subject] || 100
const targetScore = computed({
  get: () => profile.targets[profile.subject]?.score ?? Math.round(defaultFull(profile.subject) * 0.9),
  set: value => { profile.targets[profile.subject] = { ...(profile.targets[profile.subject] || {}), score: value, full: targetFullScore.value } }
})
const targetFullScore = computed({
  get: () => profile.targets[profile.subject]?.full ?? defaultFull(profile.subject),
  set: value => { profile.targets[profile.subject] = { ...(profile.targets[profile.subject] || {}), full: value, score: targetScore.value } }
})
function ensureTarget(subject = profile.subject) {
  if (!subject || profile.targets[subject]) return
  const full = defaultFull(subject)
  profile.targets[subject] = { score: Math.round(full * 0.9), full }
}
// 教材版本按科目提供：语文、历史、道法全国统一为统编版，数学、英语、物理、化学有多个版本。
const editionsBySubject = ref({})
const editionOptions = computed(() => editionsBySubject.value[profile.subject] || [])
const editionNote = ref('')
// 学校考试成绩用于计算与目标分的差距，计划据此调整概念、迁移与复盘的时长配比。
const examScores = ref([])
const subjectExams = computed(() => examScores.value
  .filter(item => item.subject === profile.subject && item.grade === profile.grade)
  .sort((left, right) => right.createdAt - left.createdAt))
const latestExam = computed(() => subjectExams.value[0] || null)
// 学校考试成绩仍作为计划基线：只读取历史记录，录入入口已改为上传试卷分析。
async function loadExamScoresForSubject() {
  examScores.value = await loadExamScores()
}

const hasDiagnostic = computed(() => questions.value.length > 0)
const answeredCount = computed(() => questions.value.filter(question => answers[question.id] !== undefined).length)
const allAnswered = computed(() => hasDiagnostic.value && answeredCount.value === questions.value.length)
const selectedChapterIds = computed(() => chapters.value.filter(chapter => chapter.selected).map(chapter => chapter.id))
const matchingAssessments = computed(() => {
  const selected = new Set(selectedChapterIds.value)
  return assessmentHistory.value.filter(item => Array.isArray(item.questions) && item.questions.length && item.grade === profile.grade && item.subject === profile.subject && (item.chapterIds || []).some(id => selected.has(id)))
})
const assessmentAttemptCount = computed(() => matchingAssessments.value.length)
const canStartAssessment = computed(() => Boolean(profile.grade && profile.subject && selectedChapterIds.value.length && !assessmentLoading.value))
// 三个入口都走弹窗：摸底在弹窗里选范围和专题，测试在弹窗里选模式，试卷分析在弹窗里上传照片。
const assessmentDialogVisible = ref(false)
const quizDialogVisible = ref(false)
// 章节测试需要范围就绪；范围缺失时在弹窗里一键转去摸底弹窗选专题。
function openAssessmentDialog() { assessmentDialogVisible.value = true }
function switchQuizToAssessment() {
  quizDialogVisible.value = false
  assessmentDialogVisible.value = true
}
const readyToStart = computed(() => canStartAssessment.value && !loading.value)
// 就绪状态文案跟着选择实时变化，用户不用点开按钮猜还差什么。
const startHint = computed(() => {
  if (!profile.grade) return '先选择年级'
  if (!profile.subject) return '再选择主要科目'
  if (!selectedChapterIds.value.length) return '至少勾选一个学习专题'
  if (assessmentLoading.value) return '正在按所选专题生成题目，约 15–25 秒…'
  if (loading.value) return '正在生成学习计划…'
  if (prefetchState.value === 'ready') return `题库已就绪，共 ${questionCount.value} 题，点击即可开始`
  if (prefetchState.value === 'preparing') return `正在预生成题目，共 ${questionCount.value} 题`
  return `共 ${questionCount.value} 题，提交后立即生成掌握度与学习计划`
})
function startAssessmentFromDialog() {
  assessmentDialogVisible.value = false
  startAssessment()
}
function zeroBaselineFromDialog() {
  assessmentDialogVisible.value = false
  zeroBaseline()
}
function skipFromDialog() {
  assessmentDialogVisible.value = false
  skipAssessment()
}
function chooseQuiz(mode) {
  quizDialogVisible.value = false
  openQuiz(mode)
}

// 试卷分析：照片只在本机 OCR，只有识别出的文字发给 AI；结果直接展示，不写入成绩表。
const paperDialogVisible = ref(false)
const paperInput = ref(null)
const paperForm = reactive({ grade: '', subject: '' })
const paperSubjectOptions = ref([])
const paperPhotos = ref([])
const paperStage = ref('idle')
const paperProgress = ref('')
const paperText = ref('')
const paperResult = ref(null)
const paperError = ref('')
const paperSaved = ref(false)

async function loadPaperSubjects() {
  if (!paperForm.grade) { paperSubjectOptions.value = []; return }
  const response = await getCurriculumSubjects(profile.stage, paperForm.grade)
  paperSubjectOptions.value = response.success ? (response.data?.subjects || []) : []
  if (!paperSubjectOptions.value.includes(paperForm.subject)) paperForm.subject = paperSubjectOptions.value[0] || ''
}
function openPaperDialog() {
  paperForm.grade = profile.grade || gradeOptions.value[0] || ''
  paperForm.subject = profile.subject
  paperDialogVisible.value = true
  loadPaperSubjects()
}
function triggerPaperUpload() {
  paperInput.value?.click()
}
function onPaperFiles(event) {
  const files = [...(event.target.files || [])].filter(file => file.type.startsWith('image/'))
  const room = 3 - paperPhotos.value.length
  for (const file of files.slice(0, Math.max(room, 0))) {
    paperPhotos.value.push({ id: makeId('paperphoto'), file, url: URL.createObjectURL(file) })
  }
  if (!files.length) ElMessage.warning('请选择图片文件。')
  else if (files.length > room) ElMessage.warning('最多上传 3 张试卷照片。')
  event.target.value = ''
  paperStage.value = 'idle'
  paperResult.value = null
  paperError.value = ''
}
function removePaperPhoto(index) {
  const [photo] = paperPhotos.value.splice(index, 1)
  if (photo) URL.revokeObjectURL(photo.url)
  paperResult.value = null
  paperError.value = ''
}
function resetPaperRun() {
  paperStage.value = 'idle'
  paperProgress.value = ''
  paperText.value = ''
  paperResult.value = null
  paperError.value = ''
  paperSaved.value = false
}
function resetPaperDialog() {
  for (const photo of paperPhotos.value) URL.revokeObjectURL(photo.url)
  paperPhotos.value = []
  resetPaperRun()
}
async function startPaperAnalysis() {
  if (!paperPhotos.value.length) return ElMessage.warning('先上传至少一张试卷照片。')
  if (!paperForm.subject) return ElMessage.warning('先选择科目。')
  resetPaperRun()
  paperStage.value = 'ocr'
  const chunks = []
  for (const [index, photo] of paperPhotos.value.entries()) {
    paperProgress.value = `正在本机识别第 ${index + 1}/${paperPhotos.value.length} 张…`
    const response = await extractQuestion(photo.file)
    if (!response.success) {
      paperStage.value = 'idle'
      paperError.value = `第 ${index + 1} 张识别失败：${response.error || '请换清晰照片重试。'}`
      return
    }
    chunks.push(response.data?.text || '')
  }
  const text = chunks.filter(Boolean).join('\n\n').trim()
  paperText.value = text
  if (text.length < 20) {
    paperStage.value = 'idle'
    paperError.value = '没有识别到足够的试卷文字，请换清晰、完整、正对镜头的照片重试。'
    return
  }
  paperStage.value = 'analyzing'
  paperProgress.value = 'AI 正在按题号、知识点和错因分析…'
  const response = await analyzeExamPaper({
    text, grade: paperForm.grade, subject: paperForm.subject,
    edition: paperForm.grade === profile.grade && paperForm.subject === profile.subject ? profile.edition : ''
  })
  if (!response.success) {
    paperStage.value = 'idle'
    paperError.value = response.error || '分析失败，请稍后重试。'
    return
  }
  paperResult.value = response.data
  paperStage.value = 'done'
  paperProgress.value = ''
  if (response.source === 'local-fallback') paperError.value = 'AI 分析暂不可用，下面是本地兜底结果。'
}
function goPaperScan() {
  paperDialogVisible.value = false
  router.push('/paper-scan')
}
// 试卷结果落库：薄弱点尽量对齐课程章节，匹配不到就按原始名称保存，报告里仍能回看。
function normalizePointName(value) {
  return String(value || '').replace(/[\s·、，,。：:；;（）()【】\[\]“”"'’—\-]/g, '')
}
function matchPaperChapter(name, list) {
  const key = normalizePointName(name)
  if (!key) return null
  const exact = list.find(chapter => normalizePointName(chapter.name) === key)
  if (exact) return exact
  return list.find(chapter => {
    const target = normalizePointName(chapter.name)
    const shorter = target.length <= key.length ? target : key
    return shorter.length >= 3 && (target.includes(key) || key.includes(target))
  }) || null
}
async function savePaperRecord() {
  if (!paperResult.value || paperSaved.value) return
  const result = paperResult.value
  let catalog = []
  try {
    const sameRange = paperForm.grade === profile.grade && paperForm.subject === profile.subject
    const response = await getCurriculumChapters(paperForm.grade, paperForm.subject, sameRange ? profile.edition : '')
    catalog = response.success ? (response.data?.chapters || []) : []
  } catch { catalog = [] }
  const chaptersById = new Map()
  const masteryByChapter = {}
  const addPoint = (name, mastery, mode = 'max') => {
    const key = normalizePointName(name)
    if (!key) return
    const matched = matchPaperChapter(name, catalog)
    const id = matched?.id || `paper-${key.slice(0, 12)}`
    if (chaptersById.has(id)) { masteryByChapter[id] = mode === 'min' ? Math.min(masteryByChapter[id], mastery) : Math.max(masteryByChapter[id], mastery); return }
    chaptersById.set(id, { id, name: matched?.name || String(name).trim(), order: matched?.order ?? chaptersById.size + 1, unitLabel: matched?.unitLabel || '' })
    masteryByChapter[id] = mastery
  }
  // 报告的判定线是 2/3：薄弱点必须落在 1 以内，否则会被显示成「掌握较好」。
  for (const point of result.weakPoints || []) addPoint(point.name, Math.min(1, Math.max(0, Number(point.mastery) || 1)), 'min')
  // 优势知识点按掌握 3 处理；同时被列为薄弱的按薄弱分算，避免自相矛盾。
  const weakKeys = new Set((result.weakPoints || []).map(point => normalizePointName(point.name)))
  for (const name of result.strengths || []) if (!weakKeys.has(normalizePointName(name))) addPoint(name, 3)
  const chapters = [...chaptersById.values()]
  if (!chapters.length) { ElMessage.warning('这份结果没有可保存的知识点，换一张更完整的试卷再试。'); return }
  const scoreText = result.score ? `本次试卷 ${result.score.score}/${result.score.fullScore} 分。` : ''
  const suggestionText = (result.suggestions || []).slice(0, 3).map((item, index) => `建议${index + 1}：${item}`).join(' ')
  const record = {
    id: makeId('assessment'), grade: paperForm.grade, subject: paperForm.subject,
    edition: paperForm.grade === profile.grade && paperForm.subject === profile.subject ? profile.edition : '',
    chapterIds: chapters.map(item => item.id), chapters, masteryByChapter, source: 'paper',
    questionCount: 0, answeredCount: 0, answers: {}, questions: [], plans: [],
    explanation: [scoreText, result.summary, suggestionText].filter(Boolean).join(' '), createdAt: Date.now()
  }
  try {
    await saveAssessment(record)
    assessmentHistory.value = [record, ...assessmentHistory.value]
    paperSaved.value = true
    if (record.grade === profile.grade && record.subject === profile.subject) {
      const [quizResults, mistakeRecords] = await Promise.all([loadQuizResults(), loadMistakes()])
      mergedMastery.value = mergeChapterMastery({ assessments: assessmentHistory.value, quizResults, mistakes: mistakeRecords, grade: profile.grade, subject: profile.subject, edition: profile.edition })
    }
    ElMessage.success('已保存为学情记录，可在右上角「查看上次报告」回看。')
  } catch { ElMessage.error('保存失败，请稍后重试。') }
}
// 合并掌握度：摸底 + 章节测试 + 错题按时间衰减加权，学校成绩只进计划配比。
const mergedMastery = ref(null)
const effectiveMastery = computed(() => {
  if (mergedMastery.value) return mergedMastery.value
  return Object.fromEntries(Object.entries(masteryByChapter.value).map(([id, score]) => [id, { score, sourceLabels: ['摸底'], confidence: '低' }]))
})
const masteryRows = computed(() => chapters.value.filter(chapter => effectiveMastery.value[chapter.id] !== undefined)
  .map(chapter => ({ ...chapter, ...effectiveMastery.value[chapter.id], mastery: effectiveMastery.value[chapter.id].score })))
// 生成计划时用合并后的分数，避免“摸底说掌握、测试说没掌握”两套结论。
const planMastery = computed(() => mergedMastery.value
  ? Object.fromEntries(Object.entries(mergedMastery.value).map(([id, item]) => [id, item.score]))
  : masteryByChapter.value)
// 掌握度 3 档制：2 档及以上算掌握较好，其余进入补强清单。
const strongChapters = computed(() => masteryRows.value.filter(row => row.mastery >= 2))
const weakChapters = computed(() => masteryRows.value.filter(row => row.mastery < 2).sort((left, right) => left.mastery - right.mastery))
const strengthSummary = computed(() => {
  if (!masteryRows.value.length) return ''
  const weakNames = weakChapters.value.slice(0, 2).map(row => row.name).join('、')
  if (!weakChapters.value.length) return `本次 ${masteryRows.value.length} 个专题都已达到掌握标准，可以进入迁移练习或下一章。`
  return `本次 ${masteryRows.value.length} 个专题中，${strongChapters.value.length} 个掌握较好，${weakChapters.value.length} 个需要补强。建议先补${weakNames}。`
})
// 视频补强：同一时间只展开一个章节，面板内自己管换一换计数。
const activeVideoChapter = ref('')
function toggleVideoPanel(chapter) {
  activeVideoChapter.value = activeVideoChapter.value === chapter.id ? '' : chapter.id
}
// 摸底报告二次查看：结果只在提交当次可见，这里从 IndexedDB 记录还原一份只读报告。
const reportSourceLabels = { agent: 'DeepSeek 出题', deepseek: 'DeepSeek 出题', 'deepseek-with-local-fill': 'DeepSeek 出题 + 本地补题', 'local-fallback': '本地题库', 'local-self-check': '本地自评', 'zero-baseline': '从零基础规划', 'assessment-skipped': '跳过摸底', paper: '试卷分析' }
// 摸底报告入口移到页头右上角：下拉面板按时间倒序列出历史记录，行内展示年级 / 学科 / 知识点。
const reportPopoverVisible = ref(false)
const reportHistory = computed(() => [...assessmentHistory.value]
  .sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))
  .map(item => {
    const names = []
    for (const chapter of Array.isArray(item.chapters) ? item.chapters : []) if (chapter?.name && !names.includes(chapter.name)) names.push(chapter.name)
    for (const question of item.questions || []) if (question?.chapterName && !names.includes(question.chapterName)) names.push(question.chapterName)
    return {
      ...item,
      dateText: new Date(item.createdAt).toLocaleDateString('zh-CN'),
      sourceLabel: reportSourceLabels[item.source] || '摸底',
      topicText: names.length ? `${names.slice(0, 2).join('、')}${names.length > 2 ? ` 等 ${names.length} 个专题` : ''}` : `${(item.chapterIds || []).length} 个专题`
    }
  }))
function openReportFromHistory(item) {
  reportPopoverVisible.value = false
  openReport(item)
}
const reportData = ref(null)
const reportAverage = computed(() => {
  const rows = reportData.value?.rows || []
  return rows.length ? Math.round(rows.reduce((sum, row) => sum + row.mastery / 3 * 100, 0) / rows.length) : 0
})
const reportRadarOption = computed(() => {
  const rows = (reportData.value?.rows || []).slice(0, 8)
  return {
    tooltip: { formatter: item => `${item.name}：${item.value}%` },
    radar: { indicator: rows.map(row => ({ name: row.name, max: 100 })), radius: '69%' },
    series: [{ type: 'radar', data: [{ value: rows.map(row => Math.round(row.mastery / 3 * 100)), name: '掌握程度', areaStyle: { color: 'rgba(78,139,137,.22)' }, lineStyle: { color: '#4e8b89' } }] }]
  }
})
function openReport(assessment) {
  if (!assessment) return
  const nameById = new Map((assessment.chapters || []).map(item => [item.id, item.name]))
  for (const question of assessment.questions || []) if (!nameById.has(question.chapterId)) nameById.set(question.chapterId, question.chapterName)
  const answersMap = assessment.answers || {}
  const review = (assessment.questions || []).map(question => {
    const chosenIndex = answersMap[question.id] === undefined ? null : Number(answersMap[question.id])
    return { ...question, chosenIndex, isCorrect: question.selfAssessment || chosenIndex === null ? null : chosenIndex === Number(question.correctIndex) }
  })
  const rows = Object.entries(assessment.masteryByChapter || {}).map(([id, score]) => ({ id, name: nameById.get(id) || id, mastery: Number(score) || 0 }))
  reportData.value = {
    grade: assessment.grade, subject: assessment.subject, edition: assessment.edition || '',
    dateText: new Date(assessment.createdAt).toLocaleDateString('zh-CN'),
    sourceLabel: reportSourceLabels[assessment.source] || '摸底',
    rows,
    strong: rows.filter(row => row.mastery >= 2),
    weak: rows.filter(row => row.mastery < 2).sort((left, right) => left.mastery - right.mastery),
    review,
    plans: Array.isArray(assessment.plans) ? assessment.plans : [],
    explanation: assessment.explanation || '',
    // 修复前生成的记录每题 id 都是 q1，作答无法准确还原，回看时要明确提示。
    legacy: (assessment.questions || []).length > 0 && new Set((assessment.questions || []).map(question => question.id)).size !== (assessment.questions || []).length
  }
  page.value = 'report'
}
// 专题全选：只在当前教材版本的目录里生效。
const allChaptersSelected = computed(() => chapters.value.length > 0 && chapters.value.every(chapter => chapter.selected))
const someChaptersSelected = computed(() => { const count = chapters.value.filter(chapter => chapter.selected).length; return count > 0 && count < chapters.value.length })
function toggleAllChapters(checked) { chapters.value.forEach(chapter => { chapter.selected = checked }) }
const radarValues = computed(() => chapters.value.slice(0, 8).map(chapter => Math.round((effectiveMastery.value[chapter.id]?.score || 0) / 3 * 100)))
const radarOption = computed(() => ({
  tooltip: { formatter: item => `${item.name}：${item.value}%` },
  radar: { indicator: chapters.value.slice(0, 8).map(chapter => ({ name: chapter.name, max: 100 })), radius: '69%' },
  // 雷达只在数据更新时走过渡，入场交给 ChartPanel 的零值首帧，这里把展开时长拉长一点。
  series: [{ type: 'radar', animationDurationUpdate: 900, animationEasingUpdate: 'cubicOut', data: [{ value: radarValues.value, name: '掌握程度', areaStyle: { color: 'rgba(78,139,137,.22)' }, lineStyle: { color: '#4e8b89' } }] }]
}))
// 雷达旁边的平均掌握度：跟着多边形一起从 0 滚到目标值。
const radarAverage = computed(() => radarValues.value.length ? Math.round(radarValues.value.reduce((sum, value) => sum + value, 0) / radarValues.value.length) : 0)
const radarAverageShown = ref(0)
let countFrame = 0
function countRadarAverage() {
  cancelAnimationFrame(countFrame)
  const target = radarAverage.value
  const start = performance.now()
  const step = now => {
    const progress = Math.min(1, (now - start) / 900)
    radarAverageShown.value = Math.round(target * (1 - Math.pow(1 - progress, 3)))
    if (progress < 1) countFrame = requestAnimationFrame(step)
  }
  countFrame = requestAnimationFrame(step)
}
watch(page, value => { if (value === 'result') { countRadarAverage() } })

async function loadGrades() {
  const response = await getCurriculumSubjects(profile.stage, profile.grade)
  if (!response.success) throw new Error(response.error || '课程目录暂时无法加载')
  const data = response.data || {}
  gradeOptions.value = data.grades || []
  if (!gradeOptions.value.includes(profile.grade)) profile.grade = data.grade || gradeOptions.value[0] || ''
  subjectOptions.value = data.subjects || []
  editionsBySubject.value = data.editions || {}
}

// 切换科目或年级后，版本可能不在新科目的可选项里，回落到该科目默认版本。
function ensureEdition() {
  const options = editionsBySubject.value[profile.subject] || []
  if (!options.some(item => item.edition === profile.edition)) profile.edition = options[0]?.edition || ''
}

let chapterRequestId = 0
// 回到本页时待恢复的专题勾选，章节加载完成后一次性应用。
let pendingChapterIds = null
async function loadChapters() {
  if (!profile.grade || !profile.subject) { chapters.value = []; return }
  const requestId = ++chapterRequestId
  catalogLoading.value = true
  errorMessage.value = ''
  const response = await getCurriculumChapters(profile.grade, profile.subject, profile.edition)
  // 快速切换科目时丢弃过期响应，避免旧列表覆盖当前选择。
  if (requestId !== chapterRequestId) return
  if (response.success) {
    chapters.value = response.data?.chapters || []
    editionNote.value = response.data?.editionNote || ''
  } else {
    errorMessage.value = '课程专题暂时无法加载，请检查后端服务。'
    chapters.value = []
  }
  // 首次进入时把上次诊断的专题勾选还原，保证「从零基础规划」等按钮立即可用。
  if (pendingChapterIds) {
    for (const chapter of chapters.value) chapter.selected = pendingChapterIds.includes(chapter.id)
    pendingChapterIds = null
  }
  catalogLoading.value = false
}

watch(() => profile.stage, async () => {
  profile.grade = ''
  profile.subject = ''
  profile.edition = ''
  chapters.value = []
  await loadGrades()
})
watch(() => profile.grade, async grade => {
  profile.subject = ''
  profile.edition = ''
  chapters.value = []
  // 年级变化后科目列表要跟着变（初二才有物理、初三才有化学）。
  const response = await getCurriculumSubjects(profile.stage, profile.grade)
  subjectOptions.value = response.data?.subjects || []
  editionsBySubject.value = response.data?.editions || {}
  await rememberGrade(grade)
})
watch(() => profile.subject, () => {
  ensureEdition()
  // 每个科目首次使用目标分时给一份默认值，换科目不会带走上一科的目标。
  ensureTarget()
  loadChapters()
  loadExamScoresForSubject()
})
// 换版本要重新取该版本目录，已选专题会随 id 变化自动清空。
watch(() => profile.edition, loadChapters)

// 鼠标悬停学段控件展开初中三个年级；选择后立即生效。
function selectGrade(grade) {
  if (grade && grade !== profile.grade) profile.grade = grade
}

// 记住上一次选择的年级：只更新学段与年级，保留档案里的其他字段。
async function rememberGrade(grade) {
  if (!grade) return
  const saved = await loadProfile()
  await saveProfile({ ...(saved || {}), stage: '初中', grade })
}

// 科目按年级开设，找到最早开设该科目的年级，供主页科目卡直接跳转使用。
async function findGradeForSubject(subject) {
  for (const grade of gradeOptions.value) {
    const response = await getCurriculumSubjects(profile.stage, grade)
    if (response.success && (response.data?.subjects || []).includes(subject)) return grade
  }
  return ''
}

function chapterSelected(id) { return chapters.value.find(chapter => chapter.id === id)?.selected === true }
function toggleChapter(chapter) { chapter.selected = !chapter.selected }

// 进入章节测试页时带上当前学段/年级/科目和已选专题，减少重复选择。
function openQuiz(mode) {
  router.push({
    path: '/quiz',
    query: {
      mode,
      stage: profile.stage,
      grade: profile.grade,
      subject: profile.subject,
      edition: profile.edition,
      chapters: selectedChapterIds.value.join(',')
    }
  })
}

// 预生成和正式开始共用同一份请求参数，服务端才能命中同一份题库缓存。
function assessmentPayload() {
  const selected = chapters.value.filter(chapter => chapter.selected)
  const selectedIds = new Set(selected.map(chapter => chapter.id))
  const previousQuestions = matchingAssessments.value.flatMap(item => (item.questions || []).filter(question => selectedIds.has(question.chapterId)))
  return {
    grade: profile.grade, subject: profile.subject, edition: profile.edition,
    chapters: selected, questionCount: questionCount.value, attempt: assessmentAttemptCount.value + 1,
    excludeQuestions: previousQuestions.map(question => ({ id: question.id, stem: question.stem, chapterId: question.chapterId, dimension: question.dimension }))
  }
}

// 选择范围变化后延迟预生成，避免连续勾选章节时反复请求。
function schedulePrefetch() {
  clearTimeout(prefetchTimer)
  const token = ++prefetchToken
  prefetchState.value = ''
  if (page.value !== 'select' || !profile.grade || !profile.subject || !selectedChapterIds.value.length) return
  prefetchTimer = setTimeout(async () => {
    prefetchState.value = 'preparing'
    const response = await prefetchDiagnosticQuestions(assessmentPayload())
    if (token !== prefetchToken) return
    prefetchState.value = response.success && response.data?.ready ? 'ready' : ''
  }, 900)
}

watch(
  () => [page.value, profile.grade, profile.subject, profile.edition, questionCount.value, assessmentAttemptCount.value, selectedChapterIds.value.join(',')],
  schedulePrefetch,
  { immediate: true }
)

async function startAssessment() {
  if (!profile.grade || !profile.subject) { ElMessage.info('请先选择当前年级和主要科目。'); return }
  if (!selectedChapterIds.value.length) { ElMessage.info('请至少选择一个学习专题。'); return }
  assessmentLoading.value = true
  let response
  try {
    // 选范围时可能已经预生成好，这里按同一参数请求即可直接命中缓存。
    response = await generateDiagnosticQuestions(assessmentPayload())
  } catch (error) {
    // 网络或超时异常时必须解除 loading，否则「开始摸底」按钮会永久禁用。
    console.warn('摸底题生成请求失败。', error)
    ElMessage.warning('摸底题暂时无法生成，仍可选择从零基础规划。')
    return
  } finally {
    assessmentLoading.value = false
  }
  if (!response.success) { ElMessage.warning('摸底题暂时无法生成，仍可选择从零基础规划。'); return }
  questions.value = response.data?.questions || []
  if (!questions.value.length) { ElMessage.warning('暂时没有生成摸底题，请稍后重试或从零基础规划。'); return }
  assessmentSource.value = response.source || 'agent'
  assessmentReview.value = []
  Object.keys(answers).forEach(key => delete answers[key])
  page.value = 'assessment'
}

function calculateMastery() {
  const grouped = new Map()
  for (const question of questions.value) {
    const chosen = answers[question.id]
    if (chosen === undefined) continue
    const chapterId = question.chapterId
    const result = grouped.get(chapterId) || { earnedWeight: 0, totalWeight: 0, self: [], dimensions: new Set() }
    result.dimensions.add(question.dimension || 'concept')
    if (question.selfAssessment) {
      result.self.push(Number(question.masteryByOption?.[chosen] ?? chosen))
    } else {
      const weight = Math.max(1, Number(question.difficulty) || 1)
      result.totalWeight += weight
      if (Number(chosen) === Number(question.correctIndex)) result.earnedWeight += weight
    }
    grouped.set(chapterId, result)
  }
  const scores = {}
  for (const [chapterId, result] of grouped) {
    if (result.totalWeight > 0) {
      const percent = result.earnedWeight / result.totalWeight
      const coverage = Math.min(1, result.dimensions.size / 3)
      const adjusted = percent * (.75 + coverage * .25)
      scores[chapterId] = adjusted >= .85 ? 3 : adjusted >= .6 ? 2 : adjusted >= .3 ? 1 : 0
    } else if (result.self.length) {
      scores[chapterId] = Math.round(result.self.reduce((sum, item) => sum + item, 0) / result.self.length)
    }
  }
  return scores
}

// 摸底错题也要进错题库：和章节测试按「同一道题」合并，避免同一题出现两条记录。
async function syncAssessmentMistakes(assessment, { assessments = [], quizResults = [] } = {}) {
  const records = buildAssessmentMistakes({
    review: assessmentReview.value,
    grade: profile.grade,
    subject: profile.subject,
    edition: profile.edition,
    existing: await loadMistakes(),
    assessments,
    quizResults,
    excludeAssessmentId: assessment.id
  })
  for (const record of records) await saveMistake(record)
}

async function submitAssessment({ allowIncomplete = false } = {}) {
  if (!allowIncomplete && !allAnswered.value) { ElMessage.info('请完成全部摸底题，或提前交卷查看已答题答案。'); return }
  // 先保留逐题作答快照，计划生成完成后向学生展示答案和解析。
  assessmentReview.value = questions.value.map(question => {
    const chosenIndex = answers[question.id] === undefined ? null : Number(answers[question.id])
    return { ...question, chosenIndex, isCorrect: question.selfAssessment || chosenIndex === null ? null : chosenIndex === Number(question.correctIndex) }
  })
  assessmentAnsweredCount.value = answeredCount.value
  assessmentObjectiveCount.value = assessmentReview.value.filter(item => !item.selfAssessment && item.chosenIndex !== null).length
  assessmentCorrectCount.value = assessmentReview.value.filter(item => item.isCorrect === true).length
  masteryByChapter.value = calculateMastery()
  const assessment = { id: makeId('assessment'), grade: profile.grade, subject: profile.subject, edition: profile.edition, chapterIds: chapters.value.filter(chapter => chapter.selected).map(chapter => chapter.id), masteryByChapter: masteryByChapter.value, source: assessmentSource.value, attempt: assessmentAttemptCount.value + 1, questionCount: questions.value.length, answeredCount: answeredCount.value, answers: { ...answers }, questions: questions.value, createdAt: Date.now() }
  await saveAssessment(assessment)
  const [allAssessments, quizResults] = await Promise.all([loadAssessments(), loadQuizResults()])
  await syncAssessmentMistakes(assessment, { assessments: allAssessments, quizResults })
  const mistakeRecords = await loadMistakes()
  assessmentHistory.value = allAssessments
  mergedMastery.value = mergeChapterMastery({
    assessments: allAssessments, quizResults, mistakes: mistakeRecords,
    grade: profile.grade, subject: profile.subject, edition: profile.edition
  })
  await createPlan(assessment)
}

async function zeroBaseline() {
  const selected = chapters.value.filter(chapter => chapter.selected)
  if (!selected.length) { ElMessage.info('先选择至少一个学习专题。'); return }
  masteryByChapter.value = Object.fromEntries(selected.map(chapter => [chapter.id, 0]))
  mergedMastery.value = null
  const assessment = { id: makeId('assessment'), grade: profile.grade, subject: profile.subject, edition: profile.edition, chapterIds: selected.map(chapter => chapter.id), masteryByChapter: masteryByChapter.value, source: 'zero-baseline', createdAt: Date.now() }
  await saveAssessment(assessment)
  await createPlan(assessment)
}

async function skipAssessment() {
  const selected = chapters.value.filter(chapter => chapter.selected)
  if (!selected.length) { ElMessage.info('先选择至少一个学习专题。'); return }
  ElMessage.info('这次跳过摸底。为避免低估或高估，我们按“尚未摸底”安排基础衔接任务；也可以选择明确的“从零基础规划”。')
  masteryByChapter.value = Object.fromEntries(selected.map(chapter => [chapter.id, 0]))
  mergedMastery.value = null
  await createPlan({ id: makeId('assessment'), grade: profile.grade, subject: profile.subject, edition: profile.edition, chapterIds: selected.map(chapter => chapter.id), masteryByChapter: masteryByChapter.value, source: 'assessment-skipped', createdAt: Date.now() })
}

// 本地兜底也按四阶段拆任务：每个章节概念→例题→迁移→复盘各一条，离线时四阶段与章节测试联动依然成立。
const STAGE_TASKS = [
  { stage: 'concept', suffix: '概念梳理', minutes: 20, tag: '概念理解' },
  { stage: 'example', suffix: '例题模仿', minutes: 20, tag: '例题精练' },
  { stage: 'transfer', suffix: '迁移应用', minutes: 20, tag: '变式迁移' },
  { stage: 'review', suffix: '复盘纠错', minutes: 10, tag: '错题复盘' }
]

// 计划结构与四阶段由本地课程规则算，毫秒级就能落到计划页，不必等模型润色文案。
async function persistPlans(sourcePlans, explanationText, assessment, selectedChapters, { markPending = false } = {}) {
  const normalizedPlans = sourcePlans.map((plan, index) => ({
    ...plan,
    grade: profile.grade,
    subject: profile.subject,
    edition: profile.edition,
    sequenceOrder: plan.sequenceOrder || index + 1,
    status: plan.status || 'active',
    ...(markPending ? { aiPending: true } : {})
  }))
  // 重新诊断只替换未锁定的任务：用户锁定的任务继续保留，避免重复堆积或覆盖。
  const existingPlans = await loadPlans()
  for (const old of existingPlans.filter(item => item.subject === profile.subject && !item.locked)) await deletePlan(old.id)
  for (const plan of normalizedPlans) await savePlan(plan)
  const savedProfile = { ...profile, subjects: [profile.subject], chapterIds: assessment.chapterIds, weakPoints: selectedChapters.map(chapter => chapter.name).join('、'), masteryByChapter: masteryByChapter.value }
  await saveProfile(savedProfile)
  store.setProfile(savedProfile)
  store.setPlans(await loadPlans())
  generatedPlans.value = normalizedPlans
  explanation.value = explanationText || '先巩固高优先级专题，再沿知识依赖顺序推进。'
  // 结果页离开后就看不到了，把当时的专题、计划与解释写回摸底记录，供之后二次查看。
  const snapshot = { ...assessment, chapters: selectedChapters.map(chapter => ({ id: chapter.id, name: chapter.name })), plans: normalizedPlans, explanation: explanation.value }
  await saveAssessment(snapshot)
  assessmentHistory.value = assessmentHistory.value.map(item => item.id === assessment.id ? snapshot : item)
  return normalizedPlans
}

// 合并 AI 文案时按「章节 + 阶段」对应，AI 可能重排任务顺序，不能按数组下标匹配。
function planMergeKey(plan) {
  if (plan.isBridge) return `bridge::${(plan.chapterIds || []).join(',')}`
  return `${plan.chapterId || (plan.chapterIds || [])[0] || ''}::${plan.stage || ''}`
}

async function createPlan(assessment) {
  errorMessage.value = ''
  const selectedChapters = chapters.value.filter(chapter => assessment.chapterIds.includes(chapter.id))
  const payload = {
    stage: profile.stage, grade: profile.grade, subject: profile.subject, edition: profile.edition, chapters: selectedChapters,
    masteryByChapter: planMastery.value, assessment, dailyMinutes: profile.dailyMinutes,
    targetScore: targetScore.value, targetFullScore: targetFullScore.value,
    baselineScore: latestExam.value ? latestExam.value.score : undefined
  }

  // 第一步：先拿本地骨架，几十毫秒返回，计划页立即可用。
  loading.value = true
  let skeletonPlans = []
  try {
    const skeleton = await generatePlanSkeleton(payload)
    if (skeleton.success && Array.isArray(skeleton.data?.plans) && skeleton.data.plans.length) {
      skeletonPlans = await persistPlans(skeleton.data.plans, skeleton.data.explanation, assessment, selectedChapters, { markPending: true })
      page.value = 'result'
      ElMessage.success('计划已生成，AI 正在优化任务文案。')
    }
  } catch (error) {
    console.warn('计划骨架生成失败，继续等待 AI 计划。', error)
  } finally {
    loading.value = false
  }

  // 第二步：AI 文案回来后按章节与阶段合并，保留骨架的 id、顺序与进行状态。
  const response = await generateLearningPlan(payload)
  const data = response.data || {}
  if (response.success && Array.isArray(data.plans) && data.plans.length && skeletonPlans.length) {
    const current = await loadPlans()
    const pending = current.filter(item => item.subject === profile.subject && item.aiPending)
    const generatedByKey = new Map(data.plans.map(plan => [planMergeKey(plan), plan]))
    const matched = pending.filter(plan => generatedByKey.has(planMergeKey(plan))).length
    // 匹配率过低说明结构变了，保留骨架不动，避免打断学生正在做的任务。
    if (pending.length && matched >= Math.ceil(pending.length * .8)) {
      for (const target of pending) {
        const generated = generatedByKey.get(planMergeKey(target))
        if (!generated) continue
        await savePlan({
          ...target,
          name: generated.name || target.name,
          reason: generated.reason || target.reason,
          estimatedMinutes: generated.estimatedMinutes || target.estimatedMinutes,
          priority: generated.priority || target.priority,
          knowledgeTags: Array.isArray(generated.knowledgeTags) && generated.knowledgeTags.length ? generated.knowledgeTags : target.knowledgeTags,
          aiPending: false
        })
      }
      store.setPlans(await loadPlans())
      generatedPlans.value = (await loadPlans()).filter(item => item.subject === profile.subject && item.status !== 'archived')
      explanation.value = data.explanation || explanation.value
      ElMessage.success('AI 已优化任务文案。')
    }
    return
  }
  if (skeletonPlans.length) return

  loading.value = false
  if (!response.success || !Array.isArray(data.plans) || !data.plans.length) {
    errorMessage.value = 'Agent 暂时不可用，仍会为你生成本地知识顺序计划。'
    const localPlans = selectedChapters.flatMap((chapter, index) => {
      const mastery = masteryByChapter.value[chapter.id] || 0
      const plans = []
      if (index > 0 && chapter.order - selectedChapters[index - 1].order > 1) {
        plans.push({ id: makeId('bridge'), name: `基础衔接复习：${chapter.name}`, subject: profile.subject, estimatedMinutes: 10, priority: '中', reviewTime: Date.now(), knowledgeTags: ['前置知识复习'], chapterIds: [selectedChapters[index - 1].id, chapter.id], isBridge: true, sequenceOrder: index * 5, reason: '跨越专题前先检查必要的前置知识。', status: 'active', createdAt: Date.now() })
      }
      STAGE_TASKS.forEach((task, order) => {
        // 掌握度 0 的章节把概念任务拉长；掌握度 2 以上缩短概念与例题，把时间留给迁移与复盘。
        const estimatedMinutes = task.stage === 'concept' ? (mastery === 0 ? 25 : mastery === 1 ? 20 : 15)
          : task.stage === 'example' ? (mastery <= 1 ? 20 : 15) : task.minutes
        plans.push({
          id: makeId('topic'),
          name: `${chapter.name} · ${task.suffix}`,
          subject: profile.subject,
          stage: task.stage,
          chapterId: chapter.id,
          chapterIds: [chapter.id],
          estimatedMinutes,
          priority: chapter.importance >= 5 || mastery <= 1 ? '高' : '中',
          reviewTime: Date.now() + (task.stage === 'review' ? 7 : mastery <= 1 ? 1 : 3) * 86400000,
          knowledgeTags: [chapter.name, task.tag],
          isBridge: false,
          sequenceOrder: index * 5 + order + 1,
          reason: `按${task.suffix}阶段推进，当前掌握度 ${mastery}/3。`,
          status: 'active',
          createdAt: Date.now() + order
        })
      })
      return plans
    })
    data.plans = localPlans
    data.explanation = '已按官方课程标准覆盖范围整理的本地专题索引和前置关系生成基础计划。'
  }
  await persistPlans(data.plans, data.explanation, assessment, selectedChapters)
  page.value = 'result'
  ElMessage.success(response.success ? '专题摸底和个性化计划已准备好。' : '本地自适应计划已准备好。')
}

function restartDiagnosis() { page.value = 'select'; masteryByChapter.value = {}; mergedMastery.value = null; generatedPlans.value = []; assessmentReview.value = [] }

onMounted(async () => {
  const old = await loadProfile()
  // 只做初中：旧档案里的学段一律回到初中，首次进入年级默认初一。
  if (old) Object.assign(profile, { ...old, stage: '初中' })
  if (!['初一', '初二', '初三'].includes(profile.grade)) profile.grade = '初一'
  // 旧档案没有 targets 字段时补成空对象，保证按科目读写目标分不报错。
  if (!profile.targets || typeof profile.targets !== 'object') profile.targets = {}
  // 旧版档案把目标分存在顶层，迁移成按科目保存；迁移后各科目标互不覆盖。
  if (Number(old?.targetScore) > 0 && old?.subject) {
    profile.targets = { ...(profile.targets || {}), [old.subject]: { score: Number(old.targetScore), full: Number(old.targetFullScore) || defaultFull(old.subject) } }
  }
  delete profile.targetScore
  delete profile.targetFullScore
  try {
    await loadGrades()
    ensureEdition()
    await loadChapters()
    await loadExamScoresForSubject()
    // 等年级 watcher 先清完科目，再把主页带来的 subject 写入，否则会被清空。
    await nextTick()
    const requestedSubject = typeof route.query.subject === 'string' ? route.query.subject.trim() : ''
    if (requestedSubject && requestedSubject !== profile.subject) {
      if (subjectOptions.value.includes(requestedSubject)) {
        profile.subject = requestedSubject
      } else {
        // 物理从初二、化学从初三开始：自动切到最早开设该科目的年级，并如实告知。
        const targetGrade = await findGradeForSubject(requestedSubject)
        if (targetGrade) {
          profile.grade = targetGrade
          await nextTick()
          profile.subject = requestedSubject
          ElMessage.info(`已切换到${targetGrade}：${requestedSubject}从${targetGrade}开始开设。`)
        } else {
          ElMessage.info(`当前课程目录里没有${requestedSubject}。`)
        }
      }
    }
    // 年级 watcher 会在恢复资料时清空科目，这里补回上次的科目与专题勾选，否则回到本页按钮会全部禁用。
    if (!requestedSubject && old?.subject && subjectOptions.value.includes(old.subject)) {
      pendingChapterIds = old.chapterIds || []
      if (!profile.subject) profile.subject = old.subject
      await loadChapters()
    }
    assessmentHistory.value = await loadAssessments()
  } catch (error) { errorMessage.value = '课程目录暂时无法加载，请确认 API 服务已经启动。' }
  store.setPlans(await loadPlans())
})
onBeforeUnmount(() => cancelAnimationFrame(countFrame))
</script>

<template>
  <div class="page diagnosis-page">
    <div class="page-header">
      <div><span class="eyebrow">学情诊断</span><h2 class="page-title">测一次，就知道下一步该学什么</h2><p class="page-subtitle">三种入口共用同一份学情：做一组摸底题、按专题做章节测试，或上传学校试卷让 AI 拆解知识点与错因。</p></div>
      <div class="header-actions">
        <el-popover v-model:visible="reportPopoverVisible" trigger="click" placement="bottom-end" :width="340">
          <template #reference><el-button plain round>查看上次报告</el-button></template>
          <div class="report-panel">
            <div class="report-panel-head"><strong>摸底报告</strong><span class="muted">{{ reportHistory.length }} 次</span></div>
            <div v-if="reportHistory.length" class="report-panel-list">
              <button v-for="item in reportHistory" :key="item.id" type="button" class="report-panel-row" @click="openReportFromHistory(item)">
                <span class="report-panel-title">{{ item.grade }} · {{ item.subject }}</span>
                <span class="report-panel-topics">{{ item.topicText }}</span>
                <span class="report-panel-meta">{{ item.dateText }} · {{ item.sourceLabel }}</span>
              </button>
            </div>
            <p v-else class="report-panel-empty">还没有摸底记录，先选好专题做一次。</p>
          </div>
        </el-popover>
        <el-tag type="success" effect="plain">本地保存 · 可跳过摸底</el-tag>      </div>
    </div>

    <el-alert v-if="errorMessage" :title="errorMessage" type="warning" :closable="false" show-icon class="notice" />

    <section v-if="page === 'select'" class="hub">
      <!-- 首屏只留三个入口，卡片垂直居中撑满主视口，避免下方大片空白。 -->
      <div class="hub-cards">
        <button type="button" class="hub-card" @click="openAssessmentDialog">
          <span class="hub-card-badge">建议先做</span>
          <span class="hub-card-kicker"><em>01</em>知识摸底</span>
          <strong class="hub-card-title">用一组题测出掌握度，生成下一步学习计划</strong>
          <span class="hub-card-desc">AI 按所选专题出题，提交后给出掌握度、长短板和计划编排顺序。</span>
          <span class="hub-card-meta">{{ selectedChapterIds.length ? `${profile.grade} · ${profile.subject || '未选科目'} · ${selectedChapterIds.length} 个专题` : '进入后选择年级、科目和专题' }}</span>
          <span class="hub-card-cta">开始第 {{ assessmentAttemptCount + 1 }} 次摸底<i aria-hidden="true">→</i></span>
        </button>
        <button type="button" class="hub-card" @click="quizDialogVisible = true">
          <span class="hub-card-kicker"><em>02</em>章节测试</span>
          <strong class="hub-card-title">日常、周测或整卷，按专题即时出题</strong>
          <span class="hub-card-desc">做完立刻判分，结果按章节并入掌握度，和摸底一起决定计划优先级。</span>
          <span class="hub-card-meta">{{ profile.grade }} · {{ profile.subject || '未选科目' }} · {{ selectedChapterIds.length ? `${selectedChapterIds.length} 个专题` : '未选专题' }}</span>
          <span class="hub-card-cta">选择测试类型<i aria-hidden="true">→</i></span>
        </button>
        <button type="button" class="hub-card" @click="openPaperDialog">
          <span class="hub-card-kicker"><em>03</em>试卷分析</span>
          <strong class="hub-card-title">上传学校试卷，让 AI 拆知识点与错因</strong>
          <span class="hub-card-desc">拍 1–3 张试卷照片，识别题目、作答和批改痕迹，输出薄弱点与补强建议。</span>
          <span class="hub-card-meta">照片只在本机 OCR · 只把识别出的文字发给 AI</span>
          <span class="hub-card-cta">上传试卷分析<i aria-hidden="true">→</i></span>
        </button>
      </div>

      <p class="hub-foot">三种入口共用同一份掌握度 · 学习数据只保存在本机浏览器 · 摸底可随时重做</p>
      <p class="source-note">课程依据：教育部义务教育课程标准（2022年版）。章节顺序跟随所选教材版本；语文、历史、道德与法治使用全国统编教材。专题由平台整理，不是出版社逐字目录或官方题库。</p>
    </section>

    <section v-else-if="page === 'assessment'" class="assessment-layout">
      <div class="surface surface-pad assessment-header"><span class="eyebrow">知识摸底</span><h2>{{ profile.grade }} · {{ profile.subject }}</h2><p class="muted">回答不会被计作考试成绩，只用于调整计划起点。已完成 {{ answeredCount }} / {{ questions.length }} 题；你可以全部完成，也可以提前结束。</p><el-progress :percentage="Math.round(answeredCount / Math.max(questions.length,1) * 100)" :show-text="false" /></div>
      <article v-for="(question,index) in questions" :key="question.id" class="surface surface-pad question-card">
        <div class="question-meta"><el-tag effect="plain">{{ question.chapterName }}</el-tag><span class="muted">第 {{ index + 1 }} 题 / {{ questions.length }}</span><el-tag v-if="question.selfAssessment" type="info">学习状态自评</el-tag><el-tag v-else-if="assessmentSource==='local-question-bank'" type="warning">本地示例题</el-tag><el-tag v-else-if="assessmentSource==='deepseek' || assessmentSource==='deepseek-with-local-fill'" type="success">DeepSeek 生成</el-tag></div>
        <h3 v-html="formatMathText(question.stem)"></h3>
        <el-radio-group v-model="answers[question.id]" class="answer-options"><el-radio v-for="(option,optionIndex) in question.options" :key="optionIndex" :value="optionIndex" border><span v-html="formatMathText(option)"></span></el-radio></el-radio-group>
      </article>
      <div class="actions assessment-submit"><el-button @click="page='select'">返回修改专题</el-button><el-button type="primary" size="large" :disabled="!allAnswered" :loading="loading" @click="submitAssessment">提交摸底并生成计划</el-button><el-button plain :disabled="loading" @click="submitAssessment({ allowIncomplete: true })">提前结束并查看答案</el-button><el-button text @click="zeroBaseline">改为从零基础规划</el-button></div>
    </section>

    <section v-else-if="page === 'result'" class="result-layout">
      <div class="surface surface-pad result-header"><span class="eyebrow">你的学习计划</span><h2>{{ profile.grade }} · {{ profile.subject }}学习路线已准备好</h2><p v-if="assessmentReview.length" class="assessment-score">本次已答 {{ assessmentAnsweredCount }} / {{ questions.length }} 题<span v-if="assessmentObjectiveCount">，客观题答对 {{ assessmentCorrectCount }} / {{ assessmentObjectiveCount }} 题</span><span v-else>，本次题目为学习状态自评，不计客观对错</span>。下面可以核对正确答案和解析。</p><p class="muted">{{ explanation }}</p><div class="actions"><el-button type="primary" @click="$router.push('/plans')">按科目查看学习计划</el-button><el-button plain @click="$router.push('/dashboard')">查看掌握度立体图</el-button><el-button text @click="restartDiagnosis">继续添加其他专题</el-button></div></div>
      <div class="result-grid"><section class="surface surface-pad mastery-card"><div class="mastery-head"><h3 class="section-title">摸底掌握度</h3><span v-if="masteryRows.length" class="mastery-average">平均 <strong>{{ radarAverageShown }}</strong>%</span></div><ChartPanel v-if="masteryRows.length" :option="radarOption" :height="330" animate-in/><div v-else class="empty">暂无可量化的诊断分数；完成学习反馈后，掌握图会逐步建立。</div></section><section class="surface surface-pad"><h3 class="section-title">Agent 编排顺序</h3><ol class="sequence-list"><li v-for="plan in generatedPlans.slice(0,7)" :key="plan.id" :class="{bridge:plan.isBridge}"><span class="sequence-dot">{{ plan.isBridge ? '↳' : plan.sequenceOrder }}</span><div><strong>{{ plan.name }}</strong><p class="muted">{{ plan.reason || `${plan.estimatedMinutes} 分钟 · ${plan.priority}优先` }}</p></div></li></ol></section></div>
      <section v-if="assessmentReview.length" class="surface surface-pad answer-review"><h3 class="section-title">摸底答案与解析</h3><article v-for="(question,index) in assessmentReview" :key="`review-${question.id}`" class="review-card" :class="question.isCorrect === true ? 'correct' : question.isCorrect === false ? 'wrong' : 'self-check'"><div class="question-meta"><el-tag effect="plain">第 {{ index + 1 }} 题 · {{ question.chapterName }}</el-tag><el-tag v-if="question.isCorrect === true" type="success">回答正确</el-tag><el-tag v-else-if="question.isCorrect === false" type="danger">回答错误</el-tag><el-tag v-else type="info">自评题 / 未作答</el-tag></div><h4 v-html="formatMathText(question.stem)"></h4><p class="review-line"><strong>你的选择：</strong><span v-if="question.chosenIndex === null">未作答</span><span v-else v-html="formatMathText(question.options[question.chosenIndex])"></span></p><p v-if="!question.selfAssessment" class="review-line"><strong>正确答案：</strong><span v-html="formatMathText(question.options[question.correctIndex])"></span></p><p class="review-explanation"><strong>解析：</strong></p><ul class="explanation-list"><li v-for="(row,rowIndex) in reviewExplanationRows(question)" :key="`row-${rowIndex}`" :class="row.verdict"><span v-if="row.label" class="option-badge">{{ row.label }}</span><span v-html="formatMathText(row.text)"></span><em v-if="row.verdict" class="verdict">{{ row.verdict === 'right' ? '正确项 · 成立依据' : '错误项 · 反例' }}</em></li></ul></article></section>
      <section v-if="masteryRows.length" class="surface surface-pad strength-card">
        <div class="strength-head"><h3 class="section-title">长短板与视频补强</h3><el-tag effect="plain">{{ profile.edition }}</el-tag></div>
        <p class="strength-summary">{{ strengthSummary }}</p>
        <div class="strength-grid" :class="{single: !strongChapters.length || !weakChapters.length}">
          <div v-if="strongChapters.length" class="strength-column">
            <h4>掌握较好<span>{{ strongChapters.length }}</span></h4>
            <ul><li v-for="row in strongChapters" :key="row.id"><strong>{{ row.name }}</strong><em>掌握度 {{ row.mastery }}/3 · {{ (row.sourceLabels || ['摸底']).join(' / ') }} · 置信度{{ row.confidence || '低' }}</em></li></ul>
          </div>
          <div v-if="weakChapters.length" class="strength-column weak">
            <h4>需要补强<span>{{ weakChapters.length }}</span></h4>
            <ul>
              <li v-for="row in weakChapters" :key="row.id" :class="{ 'video-open': activeVideoChapter === row.id }">
                <div><strong>{{ row.name }}</strong><em>掌握度 {{ row.mastery }}/3 · {{ (row.sourceLabels || ['摸底']).join(' / ') }} · 置信度{{ row.confidence || '低' }}</em></div>
                <button type="button" class="video-link" @click="toggleVideoPanel(row)">{{ activeVideoChapter === row.id ? '收起视频' : '看视频补强' }}</button>
                <VideoSuggestion v-if="activeVideoChapter === row.id" class="video-inline" :chapter-name="row.name" :grade="profile.grade" :subject="profile.subject" :edition="profile.edition" @close="activeVideoChapter = ''" />
              </li>
            </ul>
          </div>
        </div>
        <p class="source-note">视频列表按 B 站播放量排序，可按原因换一换；课程内容由 UP 主提供，平台只做检索推荐。</p>
      </section>
    </section>

    <section v-else-if="page === 'report' && reportData" class="result-layout">
      <div class="surface surface-pad result-header">
        <span class="eyebrow">{{ reportData.sourceLabel === '试卷分析' ? '试卷分析报告' : '摸底报告' }}</span>
        <h2>{{ reportData.grade }} · {{ reportData.subject }} · {{ reportData.dateText }}</h2>
        <p v-if="reportData.legacy" class="report-warning">这份记录生成于题目编号修复前，作答可能不准确，建议重新摸一次。</p>
        <p class="muted">{{ reportData.explanation || '这份记录没有保存计划说明，可以到学习计划页查看当前安排。' }}</p>
        <div class="actions"><el-button type="primary" @click="$router.push('/plans')">去学习计划</el-button><el-button plain @click="page = 'select'">返回</el-button><el-tag effect="plain">{{ reportData.sourceLabel }}</el-tag></div>
      </div>
      <div class="result-grid">
        <section class="surface surface-pad mastery-card">
          <div class="mastery-head"><h3 class="section-title">{{ reportData.sourceLabel === '试卷分析' ? '试卷掌握度' : '摸底掌握度' }}</h3><span v-if="reportData.rows.length" class="mastery-average">平均 <strong>{{ reportAverage }}</strong>%</span></div>
          <ChartPanel v-if="reportData.rows.length" :option="reportRadarOption" :height="330" />
          <div v-else class="empty">这份记录没有可量化的掌握度。</div>
        </section>
        <section class="surface surface-pad">
          <h3 class="section-title">计划编排</h3>
          <ol v-if="reportData.plans.length" class="sequence-list"><li v-for="plan in reportData.plans.slice(0,7)" :key="plan.id" :class="{bridge:plan.isBridge}"><span class="sequence-dot">{{ plan.isBridge ? '↳' : plan.sequenceOrder }}</span><div><strong>{{ plan.name }}</strong><p class="muted">{{ plan.reason || `${plan.estimatedMinutes} 分钟` }}</p></div></li></ol>
          <div v-else class="empty">{{ reportData.sourceLabel === '试卷分析' ? '试卷分析记录不含计划快照，去学习计划页查看当前安排。' : '这份记录没有保存计划快照。' }}</div>
        </section>
      </div>
      <section v-if="reportData.review.length" class="surface surface-pad">
        <h3 class="section-title">答案与解析</h3>
        <p class="muted">答错的题已自动收进错题库，可在「错题库」里复习巩固。</p>
        <el-collapse>
          <el-collapse-item v-for="(question,index) in reportData.review" :key="`report-${index}`" :name="String(index)">
            <template #title><span>第 {{ index + 1 }} 题 · {{ question.chapterName }}</span><el-tag v-if="question.isCorrect === true" type="success" class="review-flag">正确</el-tag><el-tag v-else-if="question.isCorrect === false" type="danger" class="review-flag">错误</el-tag><el-tag v-else type="info" class="review-flag">未判分</el-tag></template>
            <h4 v-html="formatMathText(question.stem)"></h4>
            <p class="review-line"><strong>你的选择：</strong><span v-if="question.chosenIndex === null">未作答</span><span v-else v-html="formatMathText(question.options[question.chosenIndex])"></span></p>
            <p v-if="!question.selfAssessment" class="review-line"><strong>正确答案：</strong><span v-html="formatMathText(question.options[question.correctIndex])"></span></p>
            <ul class="explanation-list"><li v-for="(row,rowIndex) in reviewExplanationRows(question)" :key="`report-row-${rowIndex}`" :class="row.verdict"><span v-if="row.label" class="option-badge">{{ row.label }}</span><span v-html="formatMathText(row.text)"></span></li></ul>
          </el-collapse-item>
        </el-collapse>
      </section>
      <section v-if="reportData.rows.length" class="surface surface-pad strength-card">
        <div class="strength-head"><h3 class="section-title">长短板与视频补强</h3><el-tag effect="plain">{{ reportData.edition }}</el-tag></div>
        <div class="strength-grid" :class="{single: !reportData.strong.length || !reportData.weak.length}">
          <div v-if="reportData.strong.length" class="strength-column">
            <h4>掌握较好<span>{{ reportData.strong.length }}</span></h4>
            <ul><li v-for="row in reportData.strong" :key="row.id"><strong>{{ row.name }}</strong><em>掌握度 {{ row.mastery }}/3</em></li></ul>
          </div>
          <div v-if="reportData.weak.length" class="strength-column weak">
            <h4>需要补强<span>{{ reportData.weak.length }}</span></h4>
            <ul><li v-for="row in reportData.weak" :key="row.id" :class="{ 'video-open': activeVideoChapter === row.id }"><div><strong>{{ row.name }}</strong><em>掌握度 {{ row.mastery }}/3</em></div><button type="button" class="video-link" @click="toggleVideoPanel(row)">{{ activeVideoChapter === row.id ? '收起视频' : '看视频补强' }}</button><VideoSuggestion v-if="activeVideoChapter === row.id" class="video-inline" :chapter-name="row.name" :grade="reportData.grade" :subject="reportData.subject" :edition="reportData.edition" @close="activeVideoChapter = ''" /></li></ul>
          </div>
        </div>
      </section>
    </section>

    <el-dialog v-model="assessmentDialogVisible" title="知识摸底" width="min(920px,94vw)">
      <p class="dialog-lead">选好年级、科目和专题，AI 按专题出一组题；提交后给出掌握度、长短板和学习计划。</p>
      <div class="dialog-form">
        <label class="dialog-field">
          <span>年级</span>
          <el-dropdown trigger="hover" placement="bottom-start" :disabled="catalogLoading" @command="selectGrade">
            <button type="button" class="stage-trigger"><span>初中 · {{ profile.grade || '初一' }}</span><span class="stage-trigger-arrow" aria-hidden="true">▾</span></button>
            <template #dropdown>
              <el-dropdown-menu><el-dropdown-item v-for="grade in gradeOptions" :key="grade" :command="grade">{{ grade }}</el-dropdown-item></el-dropdown-menu>
            </template>
          </el-dropdown>
        </label>
        <label class="dialog-field"><span>科目</span><el-select v-model="profile.subject" placeholder="先选年级"><el-option v-for="subject in subjectOptions" :key="subject" :label="subject" :value="subject" /></el-select></label>
        <label class="dialog-field"><span>教材版本</span><el-select v-model="profile.edition" placeholder="选择版本" :disabled="!profile.subject"><el-option v-for="item in editionOptions" :key="item.edition" :label="item.edition" :value="item.edition" /></el-select></label>
      </div>

      <div class="dialog-chapter-head">
        <strong>学习专题<span class="dialog-chapter-count">{{ selectedChapterIds.length }} / {{ chapters.length }}</span></strong>
        <div class="dialog-chapter-tools"><el-checkbox :model-value="allChaptersSelected" :indeterminate="someChaptersSelected" :disabled="!chapters.length" @change="toggleAllChapters">全选</el-checkbox></div>
      </div>
      <p v-if="editionNote" class="dialog-note">{{ editionNote }}</p>
      <div v-if="catalogLoading" class="empty">正在读取课程专题…</div>
      <div v-else-if="chapters.length" class="dialog-chapters">
        <button v-for="chapter in chapters" :key="chapter.id" type="button" class="chapter-chip" :class="{ selected: chapter.selected }" @click="toggleChapter(chapter)">
          <span class="chapter-order">{{ String(chapter.order).padStart(2, '0') }}</span>
          <span class="chapter-name"><span v-if="chapter.unitLabel" class="chapter-unit">{{ chapter.unitLabel }}</span>{{ chapter.name }}</span>
          <span class="chapter-check">{{ chapter.selected ? '✓' : '+' }}</span>
        </button>
      </div>
      <div v-else class="empty">没有找到这个组合的专题目录。</div>

      <p class="dialog-hint">{{ startHint }}</p>
      <p v-if="assessmentAttemptCount" class="dialog-tip">当前范围已完成 {{ assessmentAttemptCount }} 次摸底，下一次会自动避开历史题目。</p>
      <template #footer>
        <div class="dialog-footer">
          <label class="dialog-count">题数<el-input-number v-model="questionCount" :min="1" :max="30" size="small" controls-position="right" /></label>
          <div class="dialog-footer-actions">
            <el-button type="primary" :loading="assessmentLoading" :disabled="!readyToStart" @click="startAssessmentFromDialog">开始第 {{ assessmentAttemptCount + 1 }} 次摸底</el-button>
            <el-button plain :disabled="!readyToStart" @click="zeroBaselineFromDialog">从零基础规划</el-button>
            <el-button text :disabled="!readyToStart" @click="skipFromDialog">暂时跳过</el-button>
          </div>
        </div>
      </template>
    </el-dialog>

    <el-dialog v-model="quizDialogVisible" title="章节测试" width="min(760px,94vw)">
      <p class="dialog-lead">按当前学习范围即时出题，做完立刻判分，结果按章节并入掌握度。</p>
      <div class="dialog-range">
        <span>{{ profile.grade || '未选年级' }} · {{ profile.subject || '未选科目' }}</span>
        <em>{{ selectedChapterIds.length ? `已选 ${selectedChapterIds.length} 个专题` : '未选专题' }}</em>
      </div>
      <ul v-if="profile.grade && profile.subject && selectedChapterIds.length" class="quiz-options">
        <li><button type="button" @click="chooseQuiz('daily')"><span class="quiz-option-icon">日</span><span class="quiz-option-main"><strong>日常练习</strong><span>5–8 题 · 随时可做，适合同步巩固</span></span><i aria-hidden="true">→</i></button></li>
        <li><button type="button" @click="chooseQuiz('weekly')"><span class="quiz-option-icon">周</span><span class="quiz-option-main"><strong>周测</strong><span>10–15 题 · 每周一次，覆盖一周所学</span></span><i aria-hidden="true">→</i></button></li>
        <li><button type="button" @click="chooseQuiz('paper')"><span class="quiz-option-icon">卷</span><span class="quiz-option-main"><strong>综合整卷</strong><span>25 题 · 约 90 分钟，按试卷结构出题</span></span><i aria-hidden="true">→</i></button></li>
      </ul>
      <div v-else class="dialog-empty">
        <p>章节测试需要先有年级、科目和至少一个学习专题。</p>
        <el-button type="primary" plain @click="switchQuizToAssessment">去选学习专题</el-button>
      </div>
      <p class="dialog-tip">近 7 天出过的题干会自动避开；整卷数学 / 英语 120 分，其他科目 100 分。</p>
    </el-dialog>

    <el-dialog v-model="paperDialogVisible" title="上传试卷 · AI 学情分析" width="min(920px,94vw)" :close-on-click-modal="false" @closed="resetPaperDialog">
      <p class="dialog-lead">上传 1–3 张学校试卷照片，AI 按题号、作答和批改痕迹判断薄弱知识点、错因和下一步安排。</p>
      <div class="paper-form">
        <label class="dialog-field"><span>年级</span><el-select v-model="paperForm.grade" placeholder="选择年级" @change="loadPaperSubjects"><el-option v-for="item in gradeOptions" :key="item" :label="item" :value="item" /></el-select></label>
        <label class="dialog-field"><span>科目</span><el-select v-model="paperForm.subject" placeholder="先选年级" :disabled="!paperForm.grade"><el-option v-for="item in paperSubjectOptions" :key="item" :label="item" :value="item" /></el-select></label>
      </div>
      <input ref="paperInput" type="file" accept="image/*" multiple class="paper-file" @change="onPaperFiles" />
      <div class="paper-layout">
        <div class="paper-main">
          <button v-if="!paperPhotos.length" type="button" class="paper-upload" @click="triggerPaperUpload">
            <span class="paper-upload-icon" aria-hidden="true">＋</span>
            <strong>点击上传试卷照片</strong>
            <span>正面拍清晰、别裁掉题号，最多 3 张（正面 / 背面 / 答题卡）</span>
            <span>支持 JPG、PNG；照片只在本机识别，不会上传</span>
          </button>
          <div v-else class="paper-thumbs">
            <figure v-for="(photo, index) in paperPhotos" :key="photo.id" class="paper-thumb">
              <img :src="photo.url" alt="试卷照片预览" />
              <button type="button" aria-label="移除这张照片" @click="removePaperPhoto(index)">×</button>
            </figure>
            <button v-if="paperPhotos.length < 3" type="button" class="paper-add" @click="triggerPaperUpload"><span aria-hidden="true">＋</span>再加一张</button>
          </div>
          <div class="paper-actions">
            <el-button type="primary" :loading="paperStage === 'ocr' || paperStage === 'analyzing'" :disabled="!paperPhotos.length || paperStage === 'ocr' || paperStage === 'analyzing'" @click="startPaperAnalysis">{{ paperStage === 'done' ? '重新分析' : '开始分析' }}</el-button>
            <span class="muted">{{ paperProgress || (paperStage === 'done' ? '分析完成，结果见下方。' : '只把识别出的文字发给 AI，不传照片。') }}</span>
          </div>
          <p v-if="paperError" class="paper-error">{{ paperError }}</p>
        </div>
        <aside class="paper-guide">
          <h5>这样拍识别更准</h5>
          <ol>
            <li><strong>整页入镜</strong><span>题号、题干、作答和红笔批改都要拍进去。</span></li>
            <li><strong>只发文字</strong><span>照片在浏览器本机 OCR，不上传；只把识别出的文字发给 AI。</span></li>
            <li><strong>产出什么</strong><span>薄弱知识点、主要错因和下一步建议，最多分析 3 张。</span></li>
          </ol>
          <p class="paper-guide-note">手写潦草或公式图形较多时可能识别失真，结果仅供参考，不替代老师批改。</p>
        </aside>
      </div>
      <div v-if="paperResult" class="paper-result">
        <div class="paper-result-head">
          <h4>{{ paperResult.title }}</h4>
          <span v-if="paperResult.score" class="paper-score">{{ paperResult.score.score }} / {{ paperResult.score.fullScore }}</span>
        </div>
        <p class="paper-summary">{{ paperResult.summary }}</p>
        <div v-if="paperResult.weakPoints.length" class="paper-block">
          <h5>薄弱知识点</h5>
          <ul class="weak-list">
            <li v-for="point in paperResult.weakPoints" :key="point.name">
              <div class="weak-head"><strong>{{ point.name }}</strong><span class="weak-meter" :aria-label="`掌握度 ${point.mastery}/3`"><i v-for="n in 3" :key="n" :class="{ on: n <= point.mastery }"></i></span></div>
              <p>{{ point.reason }}</p>
            </li>
          </ul>
        </div>
        <div v-if="paperResult.strengths.length" class="paper-block">
          <h5>掌握较好</h5>
          <div class="paper-tags"><el-tag v-for="item in paperResult.strengths" :key="item" effect="plain" type="success">{{ item }}</el-tag></div>
        </div>
        <div v-if="paperResult.errorCauses.length" class="paper-block">
          <h5>主要错因</h5>
          <ul class="cause-list"><li v-for="(cause, index) in paperResult.errorCauses" :key="index"><strong>{{ cause.type }}</strong>{{ cause.detail }}</li></ul>
        </div>
        <div v-if="paperResult.suggestions.length" class="paper-block">
          <h5>下一步建议</h5>
          <ol class="suggestion-list"><li v-for="(item, index) in paperResult.suggestions" :key="index">{{ item }}</li></ol>
        </div>
        <p class="paper-disclaimer">识别来自照片 OCR，公式、图形和手写批注可能失真；结果仅供参考，不替代老师批改。</p>
        <div class="paper-result-actions">
          <el-button type="primary" size="small" :disabled="paperSaved" @click="savePaperRecord">{{ paperSaved ? '已保存为学情记录' : '保存为学情记录' }}</el-button>
          <span class="paper-disclaimer">保存后可在右上角「查看上次报告」回看；与课程专题同名的知识点会并入掌握度。</span>
        </div>
      </div>
      <template #footer>
        <div class="paper-footer">
          <span class="paper-footer-note">需要把试卷拆成可练习的题目？<el-button link type="primary" @click="goPaperScan">去试卷识别</el-button></span>
          <el-button @click="paperDialogVisible = false">关闭</el-button>
        </div>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.diagnosis-page{max-width:1520px}.header-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}.notice{margin:0 0 16px}
/* 右上角摸底报告弹层：和 AI 答疑的会话选择一样，点开直接挑一条历史报告。 */
.report-panel{display:grid;gap:10px}
.report-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;padding-bottom:8px;border-bottom:1px solid var(--border)}
.report-panel-head strong{font-size:calc(14px*var(--fs-scale))}
.report-panel-head .muted{font-size:calc(11px*var(--fs-scale))}
.report-panel-list{display:grid;gap:4px;max-height:320px;overflow:auto}
.report-panel-row{display:grid;gap:2px;width:100%;padding:9px 10px;text-align:left;font-family:inherit;color:var(--text);background:transparent;border:0;border-radius:10px;cursor:pointer;transition:background .16s}
.report-panel-row:hover{background:var(--primary-soft)}
.report-panel-title{font-size:calc(13px*var(--fs-scale));font-weight:700}
.report-panel-topics{font-size:calc(12px*var(--fs-scale));line-height:1.5}
.report-panel-meta{font-size:calc(11px*var(--fs-scale));color:var(--muted)}
.report-panel-empty{margin:4px 0;font-size:calc(12px*var(--fs-scale));color:var(--muted);line-height:1.6}
/* 首屏行动中心：三张入口卡垂直居中，撑满主视口，避免卡片下方留空。 */
.hub{display:flex;flex-direction:column;justify-content:flex-start;gap:18px;padding:22px 0 12px}
.hub-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
/* 三张卡统一浅绿：同一底色、同一描边，靠编号区分入口。 */
.hub-card{position:relative;display:flex;flex-direction:column;gap:10px;min-height:290px;padding:24px 22px;overflow:hidden;text-align:left;font-family:inherit;color:var(--text);border:1px solid var(--border);border-radius:18px;background:linear-gradient(158deg,#fafdfb 0%,#edf5f1 100%);box-shadow:var(--shadow-soft);cursor:pointer;transition:transform .2s,border-color .2s,box-shadow .2s}
.hub-card::after{content:'';position:absolute;right:-40px;bottom:-52px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle at 35% 35%,rgba(77,129,122,.09),rgba(77,129,122,.02));transition:transform .28s;pointer-events:none}
.hub-card>*{position:relative;z-index:1}
/* 三卡同色后，用右上角小角标标出建议先做的入口，不再靠底色区分。 */
.hub-card-badge{position:absolute;top:14px;right:14px;z-index:2;padding:3px 9px;border-radius:999px;background:var(--primary);color:#fff;font-size:calc(10px*var(--fs-scale));font-weight:700;letter-spacing:.06em}
.hub-card:hover{transform:translateY(-3px);border-color:var(--primary);box-shadow:0 24px 48px rgba(53,91,102,.15)}
.hub-card:hover::after{transform:scale(1.14)}
.hub-card-kicker{display:flex;align-items:center;gap:8px;font-size:calc(12px*var(--fs-scale));font-weight:700;letter-spacing:.08em;color:var(--primary)}
.hub-card-kicker em{font-style:normal;padding:3px 8px;border-radius:999px;background:rgba(77,141,142,.14);font-size:calc(11px*var(--fs-scale));letter-spacing:.1em}
.hub-card-title{font-size:calc(18px*var(--fs-scale));line-height:1.5;font-weight:600}
.hub-card-desc{font-size:calc(13px*var(--fs-scale));line-height:1.75;color:var(--muted)}
.hub-card-meta{margin-top:auto;padding-top:14px;border-top:1px dashed rgba(77,141,142,.28);font-size:calc(12px*var(--fs-scale));line-height:1.6;color:#5d7774}
.hub-card-cta{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:calc(13px*var(--fs-scale));font-weight:700;color:var(--primary)}
.hub-card-cta i{font-style:normal;transition:transform .2s}
.hub-card:hover .hub-card-cta i{transform:translateX(4px)}
.hub-foot{margin:0;text-align:center;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.hub .source-note{margin:0;text-align:center}
/* 弹窗共用：范围三列、专题双列滚动。 */
.dialog-lead{margin:0 0 16px;font-size:calc(13px*var(--fs-scale));line-height:1.7;color:var(--muted)}
.dialog-form{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:18px}
.dialog-field{display:grid;gap:6px;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.dialog-field :deep(.el-select),.dialog-field :deep(.el-dropdown){display:block;width:100%}
.dialog-chapter-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:10px;font-size:calc(13px*var(--fs-scale))}
.dialog-chapter-count{margin-left:8px;font-size:calc(12px*var(--fs-scale));font-weight:600;color:var(--muted)}
.dialog-chapters{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;max-height:330px;overflow:auto;padding:2px 4px 2px 2px}
.dialog-chapters .chapter-chip{min-height:52px;padding:10px 12px}
.dialog-note{font-size:calc(11px*var(--fs-scale));line-height:1.6;color:var(--primary);margin:0 0 8px}
.dialog-hint{margin:14px 0 0;font-size:calc(12px*var(--fs-scale));line-height:1.6;color:var(--primary)}
.dialog-tip{margin:12px 0 0;font-size:calc(11px*var(--fs-scale));line-height:1.6;color:var(--muted)}
.dialog-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.dialog-footer-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.dialog-count{display:flex;align-items:center;gap:8px;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.dialog-count :deep(.el-input-number){width:100px}
.dialog-range{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:10px 14px;border-radius:12px;background:var(--primary-soft);font-size:calc(12px*var(--fs-scale));font-weight:600;color:var(--primary)}
.dialog-range em{font-style:normal;margin-left:auto;color:var(--text)}
.dialog-empty{padding:22px;text-align:center;border:1px dashed var(--border);border-radius:14px;background:var(--surface-soft)}
.dialog-empty p{margin:0 0 12px;font-size:calc(13px*var(--fs-scale));color:var(--muted)}
/* 章节测试：三种模式做成整行按钮，点选即跳转。 */
.quiz-options{list-style:none;margin:14px 0 0;padding:0;display:grid;gap:10px}
.quiz-options button{display:flex;align-items:center;gap:14px;width:100%;padding:13px 16px;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft);color:var(--text);font-family:inherit;text-align:left;cursor:pointer;transition:border-color .16s,background .16s,transform .16s}
.quiz-options button:hover{border-color:var(--primary);background:var(--primary-soft);transform:translateX(2px)}
.quiz-option-icon{display:grid;place-items:center;flex:none;width:38px;height:38px;border-radius:12px;background:var(--primary-soft);color:var(--primary);font-size:calc(13px*var(--fs-scale));font-weight:800}
.quiz-option-main{display:grid;gap:3px;flex:1}
.quiz-option-main strong{font-size:calc(14px*var(--fs-scale))}
.quiz-option-main span{font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.quiz-options button i{font-style:normal;font-weight:700;color:var(--primary)}
/* 试卷分析：上传区、缩略图与结果卡片。 */
.paper-file{display:none}
.paper-form{display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px}
/* 左上传右说明：宽弹窗里不再让上传区横着摊平。 */
.paper-layout{display:grid;grid-template-columns:minmax(0,1.4fr) minmax(0,.6fr);gap:16px;align-items:stretch}
.paper-main{display:grid;align-content:start}
.paper-guide{display:grid;align-content:start;gap:10px;padding:16px 18px;border:1px solid var(--border);border-radius:16px;background:var(--surface-soft)}
.paper-guide h5{margin:0;font-size:calc(12px*var(--fs-scale));letter-spacing:.04em;color:var(--primary)}
.paper-guide ol{margin:0;padding-left:16px;display:grid;gap:10px;font-size:calc(12px*var(--fs-scale));line-height:1.6;color:var(--muted)}
.paper-guide strong{display:block;margin-bottom:2px;font-size:calc(13px*var(--fs-scale));color:var(--text)}
.paper-guide-note{margin:0;padding-top:10px;border-top:1px dashed var(--border);font-size:calc(11px*var(--fs-scale));line-height:1.6;color:var(--muted)}
.paper-upload{display:grid;place-items:center;align-content:center;gap:5px;width:100%;min-height:190px;padding:26px 20px;border:1.5px dashed var(--border);border-radius:16px;background:var(--surface-soft);color:var(--muted);font-family:inherit;text-align:center;cursor:pointer;transition:border-color .18s,background .18s}
.paper-upload:hover{border-color:var(--primary);background:var(--primary-soft)}
.paper-upload strong{font-size:calc(14px*var(--fs-scale));color:var(--text)}
.paper-upload span{font-size:calc(12px*var(--fs-scale));line-height:1.6}
.paper-upload-icon{font-size:calc(22px*var(--fs-scale));font-weight:700;color:var(--primary)}
.paper-thumbs{display:flex;gap:10px;flex-wrap:wrap}
.paper-thumb{position:relative;width:104px;height:132px;margin:0;border:1px solid var(--border);border-radius:12px;overflow:hidden;background:var(--surface-soft)}
.paper-thumb img{width:100%;height:100%;object-fit:cover}
.paper-thumb button{position:absolute;top:4px;right:4px;display:grid;place-items:center;width:22px;height:22px;border:0;border-radius:50%;background:rgba(36,55,70,.66);color:#fff;font-size:calc(13px*var(--fs-scale));line-height:1;cursor:pointer}
.paper-thumb button:hover{background:rgba(36,55,70,.86)}
.paper-add{display:grid;place-items:center;gap:4px;width:104px;height:132px;border:1.5px dashed var(--border);border-radius:12px;background:var(--surface-soft);color:var(--muted);font-family:inherit;font-size:calc(12px*var(--fs-scale));cursor:pointer;transition:border-color .18s,color .18s}
.paper-add:hover{border-color:var(--primary);color:var(--primary)}
.paper-add span{font-size:calc(18px*var(--fs-scale));font-weight:700}
.paper-actions{display:flex;align-items:center;gap:12px;flex-wrap:wrap;margin-top:14px}
.paper-actions .muted{font-size:calc(12px*var(--fs-scale));line-height:1.6}
.paper-error{margin:12px 0 0;padding:9px 12px;border-radius:10px;background:rgba(245,108,108,.1);color:#c45656;font-size:calc(12px*var(--fs-scale));line-height:1.6}
.paper-result{display:grid;gap:14px;margin-top:16px;padding:16px;border:1px solid var(--border);border-radius:16px;background:var(--surface-soft);max-height:480px;overflow:auto}
.paper-result-head{display:flex;align-items:flex-start;justify-content:space-between;gap:12px}
.paper-result-head h4{margin:0;font-size:calc(15px*var(--fs-scale))}
.paper-score{flex:none;padding:3px 10px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:calc(12px*var(--fs-scale));font-weight:700;font-variant-numeric:tabular-nums}
.paper-summary{margin:0;font-size:calc(13px*var(--fs-scale));line-height:1.75}
.paper-block{display:grid;gap:8px}
.paper-block h5{margin:0;font-size:calc(12px*var(--fs-scale));letter-spacing:.04em;color:var(--primary)}
.paper-tags{display:flex;gap:6px;flex-wrap:wrap}
.weak-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.weak-list li{padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.weak-head{display:flex;align-items:center;justify-content:space-between;gap:10px}
.weak-head strong{font-size:calc(13px*var(--fs-scale))}
.weak-meter{display:inline-flex;gap:3px}
.weak-meter i{width:16px;height:5px;border-radius:999px;background:var(--border)}
.weak-meter i.on{background:var(--primary)}
.weak-list p{margin:5px 0 0;font-size:calc(12px*var(--fs-scale));line-height:1.6;color:var(--muted)}
.cause-list{list-style:none;margin:0;padding:0;display:grid;gap:6px;font-size:calc(12px*var(--fs-scale));line-height:1.6}
.cause-list strong{display:inline-block;margin-right:6px;padding:1px 8px;border-radius:999px;background:var(--accent-soft);color:#96703f;font-size:calc(11px*var(--fs-scale))}
.suggestion-list{margin:0;padding-left:18px;display:grid;gap:5px;font-size:calc(12px*var(--fs-scale));line-height:1.7}
.paper-disclaimer{margin:0;font-size:calc(11px*var(--fs-scale));line-height:1.6;color:var(--muted)}
.paper-result-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap;padding-top:12px;border-top:1px dashed var(--border)}
.paper-footer{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
.paper-footer-note{font-size:calc(12px*var(--fs-scale));color:var(--muted)}
/* 专题 chip：弹窗内双列，选中态和桌面端一致。 */
.chapter-chip{display:flex;align-items:center;gap:12px;min-height:62px;padding:12px;text-align:left;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft);color:var(--text);font-family:inherit;cursor:pointer;transition:background .18s,border-color .18s,transform .18s}
.chapter-chip:hover{border-color:var(--primary);transform:translateY(-1px)}
.chapter-chip.selected{border-color:var(--primary);background:var(--primary-soft)}
.chapter-order{color:var(--muted);font:700 11px ui-monospace,monospace}
.chapter-chip>span:nth-child(2){flex:1;font-size:calc(13px*var(--fs-scale))}
.chapter-check{font-size:calc(17px*var(--fs-scale));color:var(--primary)}
.chapter-name{display:grid;gap:2px;min-width:0}
.chapter-unit{font-size:calc(10px*var(--fs-scale));font-weight:600;letter-spacing:.02em;color:var(--primary)}
.source-note{font-size:calc(11px*var(--fs-scale));color:var(--muted);margin:14px 0 0}
.assessment-layout{max-width:900px;margin:auto}
.assessment-header h2,.result-header h2{margin:8px 0}
.assessment-header p,.result-header p{line-height:1.65}
.question-card{margin-top:14px}
.question-meta{display:flex;align-items:center;gap:10px}
.question-meta .muted{margin-left:auto}
.question-card h3{line-height:1.7;font-size:calc(17px*var(--fs-scale));margin:20px 0}
.answer-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.answer-options :deep(.el-radio){height:auto;min-height:48px;margin:0;padding:13px;white-space:normal;align-items:flex-start}
.answer-options :deep(.el-radio__label){white-space:normal;line-height:1.5}
.assessment-submit{justify-content:flex-end;margin-top:18px}
.result-layout{display:grid;gap:18px}
.result-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}
.sequence-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}
.sequence-list li{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:12px;background:var(--surface-soft)}
.sequence-list li.bridge{background:#eceff0;color:#777d82}
.sequence-list p{font-size:calc(12px*var(--fs-scale));margin:5px 0 0}
.sequence-dot{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:var(--primary-soft);color:var(--primary);font-weight:700;flex:none}
.bridge .sequence-dot{background:#d7dadd;color:#72777c}
.result-header{background:linear-gradient(125deg,var(--surface),var(--primary-soft))}
.result-header .actions{margin-top:16px}
@media(max-width:960px){.hub{min-height:0}.hub-cards{grid-template-columns:1fr;gap:12px}.hub-card{min-height:0}}
@media(max-width:900px){.dialog-chapters{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:800px){.paper-layout{grid-template-columns:1fr}.paper-upload{min-height:0}}
@media(max-width:850px){.result-grid{grid-template-columns:1fr 1fr}}
@media(max-width:560px){.diagnosis-page .page-header{flex-direction:column;align-items:stretch}.header-actions{justify-content:flex-start}.result-grid,.answer-options{grid-template-columns:1fr}.hub-card{padding:20px 18px}.dialog-form,.paper-form,.dialog-chapters{grid-template-columns:1fr}.dialog-footer{align-items:stretch;flex-direction:column}.dialog-footer-actions,.dialog-footer-actions .el-button{width:100%}.assessment-submit{flex-direction:column}.assessment-submit .el-button{width:100%}}
.assessment-score{font-weight:700;color:var(--primary)}.answer-review{display:grid;gap:12px}.review-card{padding:16px;border:1px solid var(--border);border-left:4px solid var(--border);border-radius:12px;background:var(--surface-soft)}.review-card.correct{border-left-color:var(--success,#67c23a)}.review-card.wrong{border-left-color:var(--danger,#f56c6c)}.review-card.self-check{border-left-color:var(--info,#909399)}.review-card h4{margin:12px 0 8px;line-height:1.6}.review-line,.review-explanation{margin:6px 0;font-size:calc(13px*var(--fs-scale));line-height:1.6}.review-explanation{color:var(--text)}.explanation-list{display:grid;gap:5px;margin:4px 0 0;padding:0;list-style:none}.explanation-list li{display:flex;gap:8px;align-items:flex-start;line-height:1.7;border-radius:10px;padding:4px 7px}.explanation-list li.right{background:rgba(103,194,58,.09)}.explanation-list li.wrong{background:rgba(245,108,108,.09)}.option-badge{display:grid;place-items:center;width:20px;height:20px;flex:none;border-radius:8px;background:#fff;border:1px solid var(--border);font:700 11px ui-monospace,monospace;margin-top:3px}.explanation-list li.right .option-badge{color:var(--success,#67c23a);border-color:var(--success,#67c23a)}.explanation-list li.wrong .option-badge{color:var(--danger,#f56c6c);border-color:var(--danger,#f56c6c)}.explanation-list .verdict{flex:none;margin-left:auto;align-self:center;font-size:calc(11px*var(--fs-scale));font-style:normal;color:var(--muted);white-space:nowrap}.explanation-list li.right .verdict{color:var(--success,#67c23a)}.explanation-list li.wrong .verdict{color:var(--danger,#f56c6c)}
/* 结果页入场：雷达卡片先淡入上浮，雷达图整体从 .94 放大，多边形由 ChartPanel 从中心展开。 */
.mastery-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.mastery-head .section-title{margin:0}
.mastery-average{font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.mastery-average strong{font-size:calc(16px*var(--fs-scale));color:var(--primary);font-variant-numeric:tabular-nums}
.mastery-card :deep(.chart){animation:chartReveal .5s cubic-bezier(.2,.7,.3,1) both}
.result-grid>section{animation:cardReveal .45s cubic-bezier(.2,.7,.3,1) both}
.result-grid>section:nth-child(2){animation-delay:.08s}
.strength-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.strength-summary{margin:10px 0 16px;font-size:calc(13px*var(--fs-scale));line-height:1.7}
.strength-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.strength-column{padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft)}
.strength-column h4{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:calc(14px*var(--fs-scale))}
.strength-column h4 span{display:grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:calc(11px*var(--fs-scale))}
.strength-column.weak h4 span{background:var(--accent-soft);color:#96703f}
.strength-column ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.strength-column li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:10px;background:var(--surface)}
.strength-column li div{display:grid;gap:3px}
.strength-column strong{font-size:calc(13px*var(--fs-scale))}
.strength-column em{font-size:calc(11px*var(--fs-scale));font-style:normal;color:var(--muted)}
.strength-column a,.strength-column .video-link{flex:none;font-size:calc(12px*var(--fs-scale));font-weight:600;color:var(--primary);text-decoration:none;padding:4px 10px;border:1px solid var(--primary);border-radius:999px;background:transparent;cursor:pointer}
.strength-column a:hover,.strength-column .video-link:hover{background:var(--primary-soft)}
.strength-column li.video-open{flex-wrap:wrap;align-items:flex-start}
.strength-column li .video-inline{flex:1 1 100%}
.strength-column li .video-panel{display:grid;gap:8px}
.strength-empty{font-size:calc(12px*var(--fs-scale));color:var(--muted);margin:0}
@media(max-width:850px){.strength-grid{grid-template-columns:1fr}}
.report-warning{margin:8px 0 0;padding:8px 12px;border-radius:8px;background:var(--primary-soft);color:var(--text);font-size:calc(12px*var(--fs-scale))}
.review-flag{margin-left:8px}
.strength-grid.single{grid-template-columns:1fr}
@keyframes chartReveal{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes cardReveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.mastery-card :deep(.chart),.result-grid>section{animation:none}}
/* 学段控件：只保留初中，悬停展开初一/初二/初三。 */
.stage-trigger{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;height:32px;padding:0 12px;border:1px solid var(--border);border-radius:8px;background:var(--surface);color:var(--text);font-size:calc(13px*var(--fs-scale));cursor:pointer;transition:border-color .18s,background .18s}
.stage-trigger:hover,.stage-trigger:focus-visible{border-color:var(--primary);background:var(--primary-soft);outline:none}
.stage-trigger-arrow{font-size:calc(11px*var(--fs-scale));color:var(--muted)}

/* 深色模式：页面本地色板跟随全局 token，避免浅纸卡在深底上发白。 */
:global(:root[data-theme='dark'] .hub-card){border-color:var(--border);background:linear-gradient(158deg,#1d312d,#182a26);box-shadow:0 14px 34px rgba(0,0,0,.3)}
:global(:root[data-theme='dark'] .hub-card::after){background:radial-gradient(circle at 35% 35%,rgba(127,181,171,.10),transparent 70%)}
:global(:root[data-theme='dark'] .hub-card:hover){border-color:var(--primary);box-shadow:0 20px 44px rgba(0,0,0,.36)}
</style>
