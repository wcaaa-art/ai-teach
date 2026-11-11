<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import ChartPanel from '../components/ChartPanel.vue'
import MistakeAttribution from '../components/MistakeAttribution.vue'
import { getCurriculumChapters, getCurriculumSubjects, generateDiagnosticQuestions, generateLearningPlan, generatePlanSkeleton } from '../services/api.js'
import { deleteExamScore, deletePlan, loadAssessments, loadExamScores, loadMistakes, loadPlans, loadProfile, loadQuizResults, makeId, saveAssessment, saveExamScore, savePlan, saveProfile } from '../db/index.js'
import { mergeChapterMastery } from '../utils/mastery.js'
import { useAppStore } from '../stores/app.js'
import { formatMathText } from '../utils/formatMath.js'
import { bilibiliSearchUrl } from '../utils/videos.js'

const store = useAppStore()
const route = useRoute()
const router = useRouter()
const page = ref('select')
const loading = ref(false)
const catalogLoading = ref(false)
const assessmentLoading = ref(false)
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
const scoreGapText = computed(() => {
  const latest = latestExam.value
  if (!latest || !targetScore.value) return ''
  const diff = Number(targetScore.value) - Number(latest.score)
  return diff > 0 ? `距目标还差 ${Math.round(diff)} 分` : `已达到目标（高 ${Math.abs(Math.round(diff))} 分）`
})
// 一场考试的分科成绩共享 examId，列表按场次聚合并算总分。
const examSessions = computed(() => {
  const sessions = new Map()
  for (const item of examScores.value.filter(item => item.grade === profile.grade)) {
    const key = item.examId || `${item.name}-${item.createdAt}`
    const session = sessions.get(key) || { key, name: item.name, date: item.date || item.createdAt, rows: [] }
    session.rows.push(item)
    sessions.set(key, session)
  }
  return [...sessions.values()]
    .map(session => ({
      ...session,
      rows: session.rows.sort((left, right) => left.createdAt - right.createdAt),
      score: session.rows.reduce((sum, row) => sum + Number(row.score || 0), 0),
      full: session.rows.reduce((sum, row) => sum + Number(row.fullScore || 0), 0),
      dateText: new Date(session.date).toLocaleDateString('zh-CN')
    }))
    .sort((left, right) => right.date - left.date)
})

// 多科录入：勾选参加的科目填分数，未勾选或留空的按缺考处理，不写 0。
const examDialogVisible = ref(false)
const examForm = reactive({ name: '', date: new Date(), rows: [] })
const examTotal = computed(() => {
  const rows = examForm.rows.filter(row => row.enabled && row.score !== null && row.score !== '')
  return { count: rows.length, score: rows.reduce((sum, row) => sum + Number(row.score || 0), 0), full: rows.reduce((sum, row) => sum + Number(row.fullScore || 0), 0) }
})
function openExamDialog() {
  if (!profile.grade || !profile.subject) return ElMessage.warning('先选择年级和科目，再录入成绩。')
  examForm.name = ''
  examForm.date = new Date()
  examForm.rows = (subjectOptions.value.length ? subjectOptions.value : [profile.subject]).map(subject => ({
    subject,
    enabled: subject === profile.subject,
    score: null,
    fullScore: profile.targets[subject]?.full || defaultFull(subject)
  }))
  examDialogVisible.value = true
}
async function loadExamScoresForSubject() {
  examScores.value = await loadExamScores()
}
async function saveExam() {
  if (!profile.grade) return ElMessage.warning('先选择年级，再录入成绩。')
  const rows = examForm.rows.filter(row => row.enabled && row.score !== null && row.score !== '')
  if (!rows.length) return ElMessage.warning('至少填写一科成绩；没考的科目不要勾选。')
  for (const row of rows) {
    const score = Number(row.score)
    const fullScore = Number(row.fullScore)
    if (!Number.isFinite(score) || !Number.isFinite(fullScore) || fullScore <= 0 || score < 0 || score > fullScore) {
      return ElMessage.warning(`${row.subject}的得分与满分不合法，得分不能超过满分。`)
    }
  }
  const examId = makeId('examset')
  const createdAt = Date.now()
  const date = examForm.date instanceof Date ? examForm.date.getTime() : Number(new Date(examForm.date)) || createdAt
  const name = examForm.name.trim() || '学校考试'
  for (const [index, row] of rows.entries()) {
    await saveExamScore({
      id: makeId('exam'), examId, grade: profile.grade, subject: row.subject,
      edition: row.subject === profile.subject ? profile.edition : '',
      name, date, score: Number(row.score), fullScore: Number(row.fullScore), createdAt: createdAt + index
    })
  }
  await loadExamScoresForSubject()
  examDialogVisible.value = false
  ElMessage.success(`已记录 ${rows.length} 科成绩，总分 ${examTotal.value.score}/${examTotal.value.full}。`)
}
async function removeExamSession(session) {
  for (const row of session.rows) await deleteExamScore(row.id)
  await loadExamScoresForSubject()
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
function chapterVideoUrl(chapter) {
  return bilibiliSearchUrl({ edition: profile.edition, grade: profile.grade, subject: profile.subject, chapter: chapter.name })
}
// 摸底报告二次查看：结果只在提交当次可见，这里从 IndexedDB 记录还原一份只读报告。
const reportSourceLabels = { agent: 'DeepSeek 出题', deepseek: 'DeepSeek 出题', 'deepseek-with-local-fill': 'DeepSeek 出题 + 本地补题', 'local-fallback': '本地题库', 'local-self-check': '本地自评', 'zero-baseline': '从零基础规划', 'assessment-skipped': '跳过摸底' }
const latestAssessment = computed(() => [...assessmentHistory.value].sort((left, right) => (right.createdAt || 0) - (left.createdAt || 0))[0] || null)
const latestAssessmentInfo = computed(() => {
  const item = latestAssessment.value
  if (!item) return null
  return { ...item, dateText: new Date(item.createdAt).toLocaleDateString('zh-CN'), sourceLabel: reportSourceLabels[item.source] || '摸底' }
})
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
function reportVideoUrl(chapter) {
  return bilibiliSearchUrl({ edition: reportData.value?.edition, grade: reportData.value?.grade, subject: reportData.value?.subject, chapter: chapter.name })
}
// 专题全选：只在当前教材版本的目录里生效。
const allChaptersSelected = computed(() => chapters.value.length > 0 && chapters.value.every(chapter => chapter.selected))
const someChaptersSelected = computed(() => { const count = chapters.value.filter(chapter => chapter.selected).length; return count > 0 && count < chapters.value.length })
function toggleAllChapters(checked) { chapters.value.forEach(chapter => { chapter.selected = checked }) }
// 成绩录入全选：只改勾选状态，不动已经填过的分数。
const allExamRowsEnabled = computed(() => examForm.rows.length > 0 && examForm.rows.every(row => row.enabled))
const someExamRowsEnabled = computed(() => { const count = examForm.rows.filter(row => row.enabled).length; return count > 0 && count < examForm.rows.length })
function toggleAllExamRows(checked) { examForm.rows.forEach(row => { row.enabled = checked }) }
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
watch(() => profile.grade, async () => {
  profile.subject = ''
  profile.edition = ''
  chapters.value = []
  // 年级变化后科目列表要跟着变（初二才有物理、初三才有化学）。
  const response = await getCurriculumSubjects(profile.stage, profile.grade)
  subjectOptions.value = response.data?.subjects || []
  editionsBySubject.value = response.data?.editions || {}
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

async function startAssessment() {
  const selected = chapters.value.filter(chapter => chapter.selected)
  if (!profile.grade || !profile.subject) { ElMessage.info('请先选择当前年级和主要科目。'); return }
  if (!selected.length) { ElMessage.info('请至少选择一个学习专题。'); return }
  assessmentLoading.value = true
  const selectedIds = new Set(selected.map(chapter => chapter.id))
  const previousQuestions = matchingAssessments.value.flatMap(item => (item.questions || []).filter(question => selectedIds.has(question.chapterId)))
  let response
  try {
    response = await generateDiagnosticQuestions({ grade: profile.grade, subject: profile.subject, edition: profile.edition, chapters: selected, questionCount: questionCount.value, attempt: assessmentAttemptCount.value + 1, excludeQuestions: previousQuestions.map(question => ({ id: question.id, stem: question.stem, chapterId: question.chapterId, dimension: question.dimension })) })
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
  const [allAssessments, quizResults, mistakeRecords] = await Promise.all([loadAssessments(), loadQuizResults(), loadMistakes()])
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
  if (old?.stage) Object.assign(profile, old)
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
      <div><span class="eyebrow">LEARNING PROFILE · 学情诊断</span><h2 class="page-title">先选学习范围，再决定从哪里开始</h2><p class="page-subtitle">按学段、年级、科目、教材版本和知识专题建立学习路径。初中面向全国，章节跟随所选教材版本。</p></div>
      <el-tag type="success" effect="plain">本地保存 · 可跳过摸底</el-tag>
    </div>

    <el-alert v-if="errorMessage" :title="errorMessage" type="warning" :closable="false" show-icon class="notice" />

    <section v-if="page === 'select'" class="surface surface-pad selection-layout">
      <div class="step-heading"><span class="step-number">01</span><div><h3>你的学习阶段</h3><p class="muted">先选学段，再选当前年级与科目</p></div></div>
      <div class="selection-grid">
        <el-form-item label="当前学段"><el-segmented v-model="profile.stage" :options="['初中','高中']" /></el-form-item>
        <el-form-item label="当前年级"><el-select v-model="profile.grade" placeholder="请选择年级" :loading="catalogLoading"><el-option v-for="grade in gradeOptions" :key="grade" :label="grade" :value="grade" /></el-select></el-form-item>
        <el-form-item label="主要科目"><el-select v-model="profile.subject" placeholder="选择年级后选择科目"><el-option v-for="subject in subjectOptions" :key="subject" :label="subject" :value="subject" /></el-select></el-form-item>
        <el-form-item label="教材版本"><el-select v-model="profile.edition" placeholder="选择教材版本" :disabled="!profile.subject"><el-option v-for="item in editionOptions" :key="item.edition" :label="item.edition" :value="item.edition" /></el-select></el-form-item>
      </div>
      <p class="stage-note">科目按年级开设：物理从初二开始、化学从初三开始；初一为语文 / 数学 / 英语 / 历史 / 地理 / 生物 / 道德与法治。初中面向全国，出题与计划跟随所选教材版本；语文、历史、道德与法治全国使用统编教材。</p>

      <div v-if="latestAssessmentInfo" class="last-report">
        <div>
          <span class="eyebrow">LAST CHECK · 上次摸底</span>
          <strong>{{ latestAssessmentInfo.grade }} · {{ latestAssessmentInfo.subject }} · {{ latestAssessmentInfo.dateText }}</strong>
          <p class="muted">{{ latestAssessmentInfo.sourceLabel }} · 掌握度、长短板和答案解析都能直接回看，不用重新做题。</p>
        </div>
        <el-button type="primary" plain @click="openReport(latestAssessmentInfo)">查看上次报告</el-button>
      </div>

      <div v-if="profile.subject" class="chapter-section">
        <div class="step-heading"><span class="step-number">02</span><div><h3>选择学习专题</h3><p class="muted">可以多选；Agent 会依知识衔接和重要程度编排顺序</p><p v-if="editionNote" class="edition-note">{{ editionNote }}</p></div><div class="chapter-tools"><el-checkbox :model-value="allChaptersSelected" :indeterminate="someChaptersSelected" @change="toggleAllChapters">全选</el-checkbox><el-tag effect="plain">{{ chapters.filter(item => item.selected).length }} 个已选</el-tag></div></div>
        <div v-if="catalogLoading" class="empty">正在读取课程专题…</div>
        <div v-else-if="chapters.length" class="chapter-grid">
          <button v-for="chapter in chapters" :key="chapter.id" class="chapter-chip" :class="{selected: chapter.selected}" @click="toggleChapter(chapter)">
            <span class="chapter-order">{{ String(chapter.order).padStart(2,'0') }}</span><span class="chapter-name"><span v-if="chapter.unitLabel" class="chapter-unit">{{ chapter.unitLabel }}</span>{{ chapter.name }}</span><span class="chapter-check">{{ chapter.selected ? '✓' : '+' }}</span>
          </button>
        </div>
        <div v-else class="empty">没有找到这个组合的专题目录。</div>
      </div>

      <div class="study-preferences">
        <div class="step-heading"><span class="step-number">03</span><div><h3>安排节奏</h3><p class="muted">给计划留出适合自己的时间</p></div></div>
        <div class="selection-grid preferences-grid">
          <el-form-item label="每天可用于这门科目的时间（分钟）"><el-input-number v-model="profile.dailyMinutes" :min="15" :max="600" /></el-form-item>
          <el-form-item :label="profile.subject ? `目标分数（${profile.subject}）` : '目标分数'"><el-input-number v-model="targetScore" :min="1" :max="targetFullScore" /></el-form-item>
          <el-form-item label="本科满分"><el-input-number v-model="targetFullScore" :min="10" :max="750" /></el-form-item>
        </div>
      </div>

      <div class="assessment-choice">
        <div><span class="eyebrow">可选 · 按专题动态出题</span><h3>做一组多维知识摸底？</h3><p class="muted">你可以自选题数，系统会尽量覆盖已选专题并按重要性分配题目。提交后会展示每题正确答案和解析，也可以提前结束。</p><p v-if="assessmentAttemptCount" class="assessment-history-tip">当前学习范围已完成 {{ assessmentAttemptCount }} 次摸底，下一次会避开历史题目；最多支持连续 6 次代表性测评。</p></div>
        <div class="actions assessment-actions">
          <el-form-item label="摸底题数"><el-input-number v-model="questionCount" :min="1" :max="30" /></el-form-item>
          <el-button type="primary" size="large" :loading="assessmentLoading" :disabled="assessmentLoading" @click="startAssessment">开始第 {{ assessmentAttemptCount + 1 }} 次摸底</el-button>
          <el-button size="large" :disabled="!profile.grade||!profile.subject||!chapters.some(item=>item.selected)||loading" @click="zeroBaseline">从零基础规划</el-button>
          <el-button text :disabled="!profile.grade||!profile.subject||!chapters.some(item=>item.selected)||loading" @click="skipAssessment">暂时跳过</el-button>
        </div>
        <p v-if="assessmentLoading" class="assessment-hint">正在按所选专题逐题生成，约 15–25 秒，请稍候。</p>
        <p v-else-if="!canStartAssessment" class="assessment-hint">{{ !profile.grade ? '请先选择当前年级。' : !profile.subject ? '请先选择主要科目。' : !selectedChapterIds.length ? '请至少选择一个学习专题。' : '' }}</p>
      </div>
      <div class="quiz-entry">
        <div>
          <span class="eyebrow">CHAPTER QUIZ · 章节测试</span>
          <h3>按所选专题出题：日常测试或每周综合周测</h3>
          <p class="muted">日常测试约 5–8 题，随时可做；周测覆盖多个专题、约 10–15 题，每周一次。近 7 天出过的题干会自动避开，做完全卷会给出下次专注时长建议。</p>
        </div>
        <div class="actions">
          <el-button @click="openQuiz('daily')">日常题目测试</el-button>
          <el-button plain @click="openQuiz('weekly')">周测</el-button>
        </div>
      </div>
      <div class="score-entry">
        <div class="score-entry-head">
          <div><strong>录入学校考试成绩</strong><p class="muted">按场次一次录入多科成绩；和目标分一起决定计划配比：差距大先补概念与复盘，差距小就多做迁移题。</p></div>
          <div class="score-entry-meta">
            <el-tag v-if="profile.subject" effect="plain">当前科目：{{ profile.subject }}</el-tag>
            <el-button type="primary" plain size="small" @click="openExamDialog">录入考试成绩</el-button>
          </div>
        </div>
        <p v-if="latestExam" class="score-gap">最近一次 {{ latestExam.name }}（{{ profile.subject }}）{{ latestExam.score }}/{{ latestExam.fullScore }}<em v-if="scoreGapText"> · {{ scoreGapText }}</em></p>
        <p v-else class="score-gap muted">该科目还没有成绩记录</p>
        <ul v-if="examSessions.length" class="score-session-list">
          <li v-for="session in examSessions" :key="session.key" class="score-session">
            <div class="session-main"><strong>{{ session.name }}</strong><span class="muted">{{ session.dateText }} · {{ session.rows.length }} 科 · 总分 {{ session.score }}/{{ session.full }}</span></div>
            <div class="session-subjects"><span v-for="row in session.rows" :key="row.id" :class="{ current: row.subject === profile.subject }">{{ row.subject }} {{ row.score }}/{{ row.fullScore }}</span></div>
            <el-button link type="danger" @click="removeExamSession(session)">删除整场</el-button>
          </li>
        </ul>
      </div>
      <MistakeAttribution :grade="profile.grade" :subject="profile.subject" :edition="profile.edition" :chapters="chapters" />
      <p class="source-note">课程依据：教育部义务教育课程标准（2022年版）。章节顺序跟随所选教材版本；语文、历史、道德与法治使用全国统编教材。专题由平台整理，不是出版社逐字目录或官方题库。</p>
    </section>

    <section v-else-if="page === 'assessment'" class="assessment-layout">
      <div class="surface surface-pad assessment-header"><span class="eyebrow">KNOWLEDGE CHECK · 知识摸底</span><h2>{{ profile.grade }} · {{ profile.subject }}</h2><p class="muted">回答不会被计作考试成绩，只用于调整计划起点。已完成 {{ answeredCount }} / {{ questions.length }} 题；你可以全部完成，也可以提前结束。</p><el-progress :percentage="Math.round(answeredCount / Math.max(questions.length,1) * 100)" :show-text="false" /></div>
      <article v-for="(question,index) in questions" :key="question.id" class="surface surface-pad question-card">
        <div class="question-meta"><el-tag effect="plain">{{ question.chapterName }}</el-tag><span class="muted">第 {{ index + 1 }} 题 / {{ questions.length }}</span><el-tag v-if="question.selfAssessment" type="info">学习状态自评</el-tag><el-tag v-else-if="assessmentSource==='local-question-bank'" type="warning">本地示例题</el-tag><el-tag v-else-if="assessmentSource==='local-gaokao-style-physics'" type="warning">新高考风格原创题</el-tag><el-tag v-else-if="assessmentSource==='deepseek' || assessmentSource==='deepseek-with-local-fill'" type="success">DeepSeek 生成</el-tag></div>
        <h3 v-html="formatMathText(question.stem)"></h3>
        <el-radio-group v-model="answers[question.id]" class="answer-options"><el-radio v-for="(option,optionIndex) in question.options" :key="optionIndex" :value="optionIndex" border><span v-html="formatMathText(option)"></span></el-radio></el-radio-group>
      </article>
      <div class="actions assessment-submit"><el-button @click="page='select'">返回修改专题</el-button><el-button type="primary" size="large" :disabled="!allAnswered" :loading="loading" @click="submitAssessment">提交摸底并生成计划</el-button><el-button plain :disabled="loading" @click="submitAssessment({ allowIncomplete: true })">提前结束并查看答案</el-button><el-button text @click="zeroBaseline">改为从零基础规划</el-button></div>
    </section>

    <section v-else-if="page === 'result'" class="result-layout">
      <div class="surface surface-pad result-header"><span class="eyebrow">YOUR ADAPTIVE PLAN · 你的学习计划</span><h2>{{ profile.grade }} · {{ profile.subject }}学习路线已准备好</h2><p v-if="assessmentReview.length" class="assessment-score">本次已答 {{ assessmentAnsweredCount }} / {{ questions.length }} 题<span v-if="assessmentObjectiveCount">，客观题答对 {{ assessmentCorrectCount }} / {{ assessmentObjectiveCount }} 题</span><span v-else>，本次题目为学习状态自评，不计客观对错</span>。下面可以核对正确答案和解析。</p><p class="muted">{{ explanation }}</p><div class="actions"><el-button type="primary" @click="$router.push('/plans')">按科目查看学习计划</el-button><el-button plain @click="$router.push('/dashboard')">查看掌握度立体图</el-button><el-button text @click="restartDiagnosis">继续添加其他专题</el-button></div></div>
      <section v-if="assessmentReview.length" class="surface surface-pad answer-review"><h3 class="section-title">摸底答案与解析</h3><article v-for="(question,index) in assessmentReview" :key="`review-${question.id}`" class="review-card" :class="question.isCorrect === true ? 'correct' : question.isCorrect === false ? 'wrong' : 'self-check'"><div class="question-meta"><el-tag effect="plain">第 {{ index + 1 }} 题 · {{ question.chapterName }}</el-tag><el-tag v-if="question.isCorrect === true" type="success">回答正确</el-tag><el-tag v-else-if="question.isCorrect === false" type="danger">回答错误</el-tag><el-tag v-else type="info">自评题 / 未作答</el-tag></div><h4 v-html="formatMathText(question.stem)"></h4><p class="review-line"><strong>你的选择：</strong><span v-if="question.chosenIndex === null">未作答</span><span v-else v-html="formatMathText(question.options[question.chosenIndex])"></span></p><p v-if="!question.selfAssessment" class="review-line"><strong>正确答案：</strong><span v-html="formatMathText(question.options[question.correctIndex])"></span></p><p class="review-explanation"><strong>解析：</strong></p><ul class="explanation-list"><li v-for="(row,rowIndex) in reviewExplanationRows(question)" :key="`row-${rowIndex}`" :class="row.verdict"><span v-if="row.label" class="option-badge">{{ row.label }}</span><span v-html="formatMathText(row.text)"></span><em v-if="row.verdict" class="verdict">{{ row.verdict === 'right' ? '正确项 · 成立依据' : '错误项 · 反例' }}</em></li></ul></article></section>
      <div class="result-grid"><section class="surface surface-pad mastery-card"><div class="mastery-head"><h3 class="section-title">摸底掌握度</h3><span v-if="masteryRows.length" class="mastery-average">平均 <strong>{{ radarAverageShown }}</strong>%</span></div><ChartPanel v-if="masteryRows.length" :option="radarOption" :height="330" animate-in/><div v-else class="empty">暂无可量化的诊断分数；完成学习反馈后，掌握图会逐步建立。</div></section><section class="surface surface-pad"><h3 class="section-title">Agent 编排顺序</h3><ol class="sequence-list"><li v-for="plan in generatedPlans.slice(0,7)" :key="plan.id" :class="{bridge:plan.isBridge}"><span class="sequence-dot">{{ plan.isBridge ? '↳' : plan.sequenceOrder }}</span><div><strong>{{ plan.name }}</strong><p class="muted">{{ plan.reason || `${plan.estimatedMinutes} 分钟 · ${plan.priority}优先` }}</p></div></li></ol></section></div>
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
              <li v-for="row in weakChapters" :key="row.id">
                <div><strong>{{ row.name }}</strong><em>掌握度 {{ row.mastery }}/3 · {{ (row.sourceLabels || ['摸底']).join(' / ') }} · 置信度{{ row.confidence || '低' }}</em></div>
                <a :href="chapterVideoUrl(row)" target="_blank" rel="noopener noreferrer">看视频补强</a>
              </li>
            </ul>
          </div>
        </div>
        <p class="source-note">视频按钮按「版本 + 年级 + 科目 + 章节」跳转 B 站搜索结果，课程内容由 UP 主提供，平台只做检索推荐。</p>
      </section>
    </section>

    <section v-else-if="page === 'report' && reportData" class="result-layout">
      <div class="surface surface-pad result-header">
        <span class="eyebrow">ASSESSMENT REPORT · 摸底报告</span>
        <h2>{{ reportData.grade }} · {{ reportData.subject }} · {{ reportData.dateText }}</h2>
        <p v-if="reportData.legacy" class="report-warning">这份记录生成于题目编号修复前，作答可能不准确，建议重新摸一次。</p>
        <p class="muted">{{ reportData.explanation || '这份记录没有保存计划说明，可以到学习计划页查看当前安排。' }}</p>
        <div class="actions"><el-button type="primary" @click="$router.push('/plans')">去学习计划</el-button><el-button plain @click="page = 'select'">返回</el-button><el-tag effect="plain">{{ reportData.sourceLabel }}</el-tag></div>
      </div>
      <div class="result-grid">
        <section class="surface surface-pad mastery-card">
          <div class="mastery-head"><h3 class="section-title">摸底掌握度</h3><span v-if="reportData.rows.length" class="mastery-average">平均 <strong>{{ reportAverage }}</strong>%</span></div>
          <ChartPanel v-if="reportData.rows.length" :option="reportRadarOption" :height="330" />
          <div v-else class="empty">这份记录没有可量化的掌握度。</div>
        </section>
        <section class="surface surface-pad">
          <h3 class="section-title">计划编排</h3>
          <ol v-if="reportData.plans.length" class="sequence-list"><li v-for="plan in reportData.plans.slice(0,7)" :key="plan.id" :class="{bridge:plan.isBridge}"><span class="sequence-dot">{{ plan.isBridge ? '↳' : plan.sequenceOrder }}</span><div><strong>{{ plan.name }}</strong><p class="muted">{{ plan.reason || `${plan.estimatedMinutes} 分钟` }}</p></div></li></ol>
          <div v-else class="empty">这份记录没有保存计划快照。</div>
        </section>
      </div>
      <section v-if="reportData.rows.length" class="surface surface-pad strength-card">
        <div class="strength-head"><h3 class="section-title">长短板与视频补强</h3><el-tag effect="plain">{{ reportData.edition }}</el-tag></div>
        <div class="strength-grid" :class="{single: !reportData.strong.length || !reportData.weak.length}">
          <div v-if="reportData.strong.length" class="strength-column">
            <h4>掌握较好<span>{{ reportData.strong.length }}</span></h4>
            <ul><li v-for="row in reportData.strong" :key="row.id"><strong>{{ row.name }}</strong><em>掌握度 {{ row.mastery }}/3</em></li></ul>
          </div>
          <div v-if="reportData.weak.length" class="strength-column weak">
            <h4>需要补强<span>{{ reportData.weak.length }}</span></h4>
            <ul><li v-for="row in reportData.weak" :key="row.id"><div><strong>{{ row.name }}</strong><em>掌握度 {{ row.mastery }}/3</em></div><a :href="reportVideoUrl(row)" target="_blank" rel="noopener noreferrer">看视频补强</a></li></ul>
          </div>
        </div>
      </section>
      <section v-if="reportData.review.length" class="surface surface-pad">
        <h3 class="section-title">答案与解析</h3>
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
    </section>

    <el-dialog v-model="examDialogVisible" title="录入考试成绩" width="560px">
      <div class="exam-dialog-form">
        <el-form-item label="考试名称"><el-input v-model="examForm.name" placeholder="如期中考试" maxlength="20" /></el-form-item>
        <el-form-item label="考试日期"><el-date-picker v-model="examForm.date" type="date" placeholder="选择日期" /></el-form-item>
      </div>
      <p class="exam-dialog-tip">勾选本次考了的科目并填写得分；没考的科目不要勾选，不会记为 0 分。</p>
      <div class="exam-tools"><el-checkbox :model-value="allExamRowsEnabled" :indeterminate="someExamRowsEnabled" @change="toggleAllExamRows">全选科目</el-checkbox><span class="muted">已勾 {{ examForm.rows.filter(row => row.enabled).length }} / {{ examForm.rows.length }} 科</span></div>
      <ul class="exam-rows">
        <li v-for="row in examForm.rows" :key="row.subject" class="exam-row" :class="{ disabled: !row.enabled }">
          <el-checkbox v-model="row.enabled">{{ row.subject }}</el-checkbox>
          <div class="exam-score-input">
            <el-input-number v-model="row.score" :min="0" :max="row.fullScore" :disabled="!row.enabled" controls-position="right" placeholder="得分" />
            <span class="score-slash">/</span>
            <el-input-number v-model="row.fullScore" :min="10" :max="750" :disabled="!row.enabled" controls-position="right" />
          </div>
        </li>
      </ul>
      <p class="exam-total">已填 {{ examTotal.count }} 科，合计 {{ examTotal.score }}/{{ examTotal.full }}</p>
      <template #footer>
        <el-button @click="examDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveExam">保存成绩</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
.diagnosis-page{max-width:1180px}.notice{margin:0 0 16px}.selection-layout{padding:30px}.step-heading{display:flex;gap:14px;align-items:center;margin-bottom:17px}.step-heading h3{margin:0 0 4px;font-size:18px}.step-heading p{margin:0;font-size:13px}.step-number{display:grid;place-items:center;width:38px;height:38px;border-radius:13px;background:var(--primary-soft);color:var(--primary);font-weight:800}.selection-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.selection-grid :deep(.el-form-item){display:flex;flex-direction:column;margin-bottom:10px}.selection-grid :deep(.el-select),.selection-grid :deep(.el-input-number){width:100%}.chapter-section{margin-top:22px;padding-top:23px;border-top:1px solid var(--border)}.chapter-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.chapter-chip{min-height:62px;display:flex;align-items:center;gap:12px;text-align:left;padding:12px;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft);color:var(--text);cursor:pointer;transition:background .18s,border-color .18s,transform .18s}.chapter-chip:hover{border-color:var(--primary);transform:translateY(-1px)}.chapter-chip.selected{border-color:var(--primary);background:var(--primary-soft)}.chapter-order{color:var(--muted);font:700 11px ui-monospace,monospace}.chapter-chip>span:nth-child(2){flex:1;font-size:13px}.chapter-check{font-size:17px;color:var(--primary)}.study-preferences{border-top:1px solid var(--border);margin-top:26px;padding-top:22px}.assessment-choice{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:22px;margin-top:16px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(125deg,var(--surface-soft),var(--primary-soft))}.assessment-choice h3{margin:6px 0}.assessment-choice p{max-width:600px;margin:0;font-size:13px;line-height:1.6}.assessment-actions{justify-content:flex-end;flex-wrap:wrap}.source-note{font-size:11px;color:var(--muted);margin:14px 0 0}.assessment-layout{max-width:900px;margin:auto}.assessment-header h2,.result-header h2{margin:8px 0}.assessment-header p,.result-header p{line-height:1.65}.question-card{margin-top:14px}.question-meta{display:flex;align-items:center;gap:10px}.question-meta .muted{margin-left:auto}.question-card h3{line-height:1.7;font-size:17px;margin:20px 0}.answer-options{display:grid;grid-template-columns:1fr 1fr;gap:10px}.answer-options :deep(.el-radio){height:auto;min-height:48px;margin:0;padding:13px;white-space:normal;align-items:flex-start}.answer-options :deep(.el-radio__label){white-space:normal;line-height:1.5}.assessment-submit{justify-content:flex-end;margin-top:18px}.result-layout{display:grid;gap:18px}.result-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px}.sequence-list{list-style:none;margin:0;padding:0;display:grid;gap:12px}.sequence-list li{display:flex;gap:12px;align-items:flex-start;padding:12px;border-radius:12px;background:var(--surface-soft)}.sequence-list li.bridge{background:#eceff0;color:#777d82}.sequence-list p{font-size:12px;margin:5px 0 0}.sequence-dot{display:grid;place-items:center;width:25px;height:25px;border-radius:50%;background:var(--primary-soft);color:var(--primary);font-weight:700;flex:none}.bridge .sequence-dot{background:#d7dadd;color:#72777c}.result-header{background:linear-gradient(125deg,var(--surface),var(--primary-soft))}.result-header .actions{margin-top:16px}@media(max-width:850px){.selection-layout{padding:19px}.selection-grid,.chapter-grid,.result-grid{grid-template-columns:1fr 1fr}.assessment-choice{align-items:flex-start;flex-direction:column}.assessment-actions{justify-content:flex-start}}@media(max-width:560px){.selection-grid,.chapter-grid,.result-grid,.answer-options{grid-template-columns:1fr}.step-heading{align-items:flex-start}.assessment-submit{flex-direction:column}.assessment-submit .el-button{width:100%}}
.stage-note{font-size:12px;line-height:1.7;color:var(--muted);margin:2px 0 0}.assessment-actions :deep(.el-form-item){margin:0;display:flex;align-items:center;gap:8px}.assessment-actions :deep(.el-form-item__label){margin:0}.assessment-score{font-weight:700;color:var(--primary)}.assessment-history-tip,.assessment-hint{font-size:12px;line-height:1.6;margin:8px 0 0;color:var(--primary)}.assessment-hint{color:var(--muted);text-align:right}.answer-review{display:grid;gap:12px}.review-card{padding:16px;border:1px solid var(--border);border-left:4px solid var(--border);border-radius:12px;background:var(--surface-soft)}.review-card.correct{border-left-color:var(--success,#67c23a)}.review-card.wrong{border-left-color:var(--danger,#f56c6c)}.review-card.self-check{border-left-color:var(--info,#909399)}.review-card h4{margin:12px 0 8px;line-height:1.6}.review-line,.review-explanation{margin:6px 0;font-size:13px;line-height:1.6}.review-explanation{color:var(--text)}.explanation-list{display:grid;gap:5px;margin:4px 0 0;padding:0;list-style:none}.explanation-list li{display:flex;gap:8px;align-items:flex-start;line-height:1.7;border-radius:7px;padding:4px 7px}.explanation-list li.right{background:rgba(103,194,58,.09)}.explanation-list li.wrong{background:rgba(245,108,108,.09)}.option-badge{display:grid;place-items:center;width:20px;height:20px;flex:none;border-radius:6px;background:#fff;border:1px solid var(--border);font:700 11px ui-monospace,monospace;margin-top:3px}.explanation-list li.right .option-badge{color:var(--success,#67c23a);border-color:var(--success,#67c23a)}.explanation-list li.wrong .option-badge{color:var(--danger,#f56c6c);border-color:var(--danger,#f56c6c)}.explanation-list .verdict{flex:none;margin-left:auto;align-self:center;font-size:11px;font-style:normal;color:var(--muted);white-space:nowrap}.explanation-list li.right .verdict{color:var(--success,#67c23a)}.explanation-list li.wrong .verdict{color:var(--danger,#f56c6c)}
.quiz-entry{display:flex;justify-content:space-between;align-items:center;gap:24px;padding:22px;margin-top:16px;border:1px dashed var(--border);border-radius:18px;background:var(--surface-soft)}.quiz-entry h3{margin:6px 0}.quiz-entry p{max-width:620px;margin:0;font-size:13px;line-height:1.6}.quiz-entry .actions{flex:none}@media(max-width:850px){.quiz-entry{align-items:flex-start;flex-direction:column}.quiz-entry .actions{flex-wrap:wrap}}
/* 结果页入场：雷达卡片先淡入上浮，雷达图整体从 .94 放大，多边形由 ChartPanel 从中心展开。 */
.mastery-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.mastery-head .section-title{margin:0}
.mastery-average{font-size:12px;color:var(--muted)}
.mastery-average strong{font-size:16px;color:var(--primary);font-variant-numeric:tabular-nums}
.mastery-card :deep(.chart){animation:chartReveal .5s cubic-bezier(.2,.7,.3,1) both}
.result-grid>section{animation:cardReveal .45s cubic-bezier(.2,.7,.3,1) both}
.result-grid>section:nth-child(2){animation-delay:.08s}
.edition-note{font-size:12px;color:var(--primary);margin:4px 0 0}
.strength-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.strength-summary{margin:10px 0 16px;font-size:13px;line-height:1.7}
.strength-grid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
.strength-column{padding:16px;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft)}
.strength-column h4{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:14px}
.strength-column h4 span{display:grid;place-items:center;min-width:20px;height:20px;padding:0 6px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:11px}
.strength-column.weak h4 span{background:rgba(238,167,123,.22);color:#a8622a}
.strength-column ul{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.strength-column li{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:9px 11px;border-radius:10px;background:var(--surface)}
.strength-column li div{display:grid;gap:3px}
.strength-column strong{font-size:13px}
.strength-column em{font-size:11px;font-style:normal;color:var(--muted)}
.strength-column a{flex:none;font-size:12px;font-weight:600;color:var(--primary);text-decoration:none;padding:4px 10px;border:1px solid var(--primary);border-radius:999px}
.strength-column a:hover{background:var(--primary-soft)}
.strength-empty{font-size:12px;color:var(--muted);margin:0}
@media(max-width:850px){.strength-grid{grid-template-columns:1fr}}
.score-entry{margin-top:18px;padding:16px 18px;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft)}
.score-entry-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
.score-entry-head strong{font-size:14px}
.score-entry-head p{margin:4px 0 0;font-size:12px;line-height:1.6}
.score-entry-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.score-gap{font-size:12px;color:var(--text);background:var(--surface);border:1px solid var(--border);padding:5px 10px;border-radius:999px;display:inline-block;margin:12px 0 0}
.score-gap em{font-style:normal;color:var(--primary)}
.score-session-list{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:8px}
.score-session{display:flex;align-items:center;gap:12px;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.session-main{display:grid;gap:2px;min-width:130px}
.session-main strong{font-size:13px}
.session-main .muted{font-size:11px}
.session-subjects{display:flex;flex-wrap:wrap;gap:6px;flex:1}
.session-subjects span{font-size:11px;padding:2px 8px;border-radius:999px;background:var(--surface-soft);color:var(--muted);border:1px solid var(--border)}
.session-subjects span.current{color:var(--primary);border-color:var(--primary);background:var(--primary-soft)}
.exam-dialog-form{display:flex;gap:12px;flex-wrap:wrap}
.exam-dialog-form :deep(.el-form-item){margin-bottom:10px;flex:1;min-width:170px}
.exam-dialog-form :deep(.el-input),.exam-dialog-form :deep(.el-date-editor){width:100%}
.exam-dialog-tip{font-size:12px;color:var(--muted);margin:0 0 10px}
.exam-rows{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.exam-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 10px;border:1px solid var(--border);border-radius:10px;background:var(--surface-soft)}
.exam-row.disabled{opacity:.55}
.exam-score-input{display:flex;align-items:center;gap:6px}
.exam-score-input :deep(.el-input-number){width:96px}
.score-slash{color:var(--muted)}
.exam-total{margin:12px 0 0;font-size:12px;color:var(--primary);font-weight:600}
@media(max-width:850px){.score-session{align-items:flex-start;flex-direction:column}}
.chapter-tools{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.chapter-name{display:grid;gap:2px}
.chapter-unit{font-size:10px;font-weight:600;color:var(--primary);letter-spacing:.02em}
.last-report{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:16px;padding:14px 16px;border:1px solid var(--border);border-radius:12px;background:var(--surface)}
.last-report strong{display:block;margin-top:2px;font-size:14px}
.last-report p{margin:4px 0 0;font-size:12px}
.last-report .el-button{flex:none}
.report-warning{margin:8px 0 0;padding:8px 12px;border-radius:8px;background:var(--primary-soft);color:var(--text);font-size:12px}
.review-flag{margin-left:8px}
.exam-tools{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0 0 8px;font-size:12px}
@media(max-width:850px){.last-report{align-items:flex-start;flex-direction:column}}
.strength-grid.single{grid-template-columns:1fr}
@keyframes chartReveal{from{opacity:0;transform:scale(.94)}to{opacity:1;transform:none}}
@keyframes cardReveal{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion: reduce){.mastery-card :deep(.chart),.result-grid>section{animation:none}}
</style>
