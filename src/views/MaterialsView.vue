<script setup>
// 学习资料库：左侧筛选 + 掌握度概览，右侧知识点气泡图；点击气泡打开整章资料大窗口。
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { getChapterMaterials, getCurriculumChapters, getCurriculumSubjects, searchMaterials } from '../services/api.js'
import { loadAssessments, loadMistakes, loadQuizResults } from '../db/index.js'
import { mergeChapterMastery } from '../utils/mastery.js'
import VideoSuggestion from '../components/VideoSuggestion.vue'
import { useAppStore } from '../stores/app.js'
import { formatMathText } from '../utils/formatMath.js'

const router = useRouter()
const store = useAppStore()
const gradeOptions = ref([])
const subjectOptions = ref([])
const editionsBySubject = ref({})
const grade = ref('')
const subject = ref('')
const edition = ref('')
const chapters = ref([])
const chapterNote = ref('')
const loading = ref(false)
const keyword = ref('')
// 搜索联想：输入关键词时在搜索框下方给出相关知识点，点一下直接打开对应章节。
const suggestions = ref([])
const suggestOpen = ref(false)
const suggesting = ref(false)
const searching = ref(false)
const openedAnswers = reactive({})
let chapterToken = 0
let suggestTimer = 0
let suggestSeq = 0

// 掌握度卡片：摸底、章节测试、错题三类记录合并成 0–3 分，和学情诊断同一套口径。
const learningRecords = ref({ assessments: [], quizResults: [], mistakes: [] })
const masteryMap = computed(() => mergeChapterMastery({
  assessments: learningRecords.value.assessments,
  quizResults: learningRecords.value.quizResults,
  mistakes: learningRecords.value.mistakes,
  grade: grade.value,
  subject: subject.value,
  edition: edition.value
}))
const masteryRows = computed(() => chapters.value
  .map(chapter => ({ id: chapter.id, name: chapter.name, score: masteryMap.value[chapter.id]?.score }))
  .filter(row => Number.isFinite(row.score)))
const masteryAverage = computed(() => masteryRows.value.length
  ? Math.round(masteryRows.value.reduce((sum, row) => sum + row.score, 0) / masteryRows.value.length / 3 * 100)
  : 0)
const weakPreview = computed(() => [...masteryRows.value].sort((left, right) => left.score - right.score).slice(0, 3))

const editionOptions = computed(() => editionsBySubject.value[subject.value] || [])

function ensureEdition() {
  const options = editionOptions.value
  if (!options.some(item => item.edition === edition.value)) edition.value = options[0]?.edition || ''
}

async function refreshSubjects() {
  const response = await getCurriculumSubjects('初中', grade.value)
  subjectOptions.value = response.data?.subjects || []
  editionsBySubject.value = response.data?.editions || {}
  if (!subjectOptions.value.includes(subject.value)) {
    subject.value = subjectOptions.value.includes('数学') ? '数学' : (subjectOptions.value[0] || '')
  }
  ensureEdition()
  await loadChapters()
}

async function loadChapters() {
  if (!grade.value || !subject.value) { chapters.value = []; return }
  const token = ++chapterToken
  const requestKey = `${grade.value}|${subject.value}|${edition.value}`
  loading.value = true
  const response = await getCurriculumChapters(grade.value, subject.value, edition.value)
  // 连点年级/科目时只采纳最后一次请求，避免旧目录覆盖新目录。
  if (token !== chapterToken || requestKey !== `${grade.value}|${subject.value}|${edition.value}`) return
  chapters.value = response.data?.chapters || []
  chapterNote.value = response.data?.curriculumNote || ''
  loading.value = false
  closeModal()
}

watch(grade, refreshSubjects)
watch(subject, async () => { ensureEdition(); await loadChapters() })
watch(edition, async () => { await loadChapters() })

onMounted(async () => {
  const response = await getCurriculumSubjects('初中')
  gradeOptions.value = response.data?.grades || []
  const preferredGrade = String(store.profile?.grade || '')
  grade.value = gradeOptions.value.includes(preferredGrade)
    ? preferredGrade
    : (gradeOptions.value.includes('初二') ? '初二' : gradeOptions.value[0] || '')
  subject.value = String(store.profile?.subject || '')
  await refreshSubjects()
  // 用户上次选的版本优先，不在当前科目里再回落到第一个版本。
  if (store.profile?.edition && editionOptions.value.some(item => item.edition === store.profile.edition)) {
    edition.value = store.profile.edition
  }
  const [assessments, quizResults, mistakes] = await Promise.all([loadAssessments(), loadQuizResults(), loadMistakes()])
  learningRecords.value = { assessments, quizResults, mistakes }
  window.addEventListener('keydown', onKeydown)
  // 页面级交互只用来判断「用户还在操作」，不改变球的位置。
  window.addEventListener('pointermove', markActive, { passive: true })
  window.addEventListener('pointerdown', markActive, { passive: true })
  window.addEventListener('wheel', markActive, { passive: true })
  window.addEventListener('scroll', markActive, { passive: true })
  if (bubbleField.value) {
    resizeObserver = new ResizeObserver(() => {
      const rect = bubbleField.value?.getBoundingClientRect()
      if (!rect) return
      if (Math.abs(rect.width - fieldBox.width) > 6 || Math.abs(rect.height - fieldBox.height) > 6) buildBubbles()
    })
    resizeObserver.observe(bubbleField.value)
  }
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  window.removeEventListener('pointermove', markActive)
  window.removeEventListener('pointerdown', markActive)
  window.removeEventListener('wheel', markActive)
  window.removeEventListener('scroll', markActive)
  document.body.style.overflow = ''
  stopFloat()
  resizeObserver?.disconnect()
  window.clearTimeout(pressTimer)
  window.clearTimeout(suggestTimer)
})

// ---------- 知识点气泡 ----------
const bubbleField = ref(null)
const bubbleItems = ref([])
const pressedId = ref('')
const draggingId = ref('')
const fieldBox = { width: 0, height: 0 }
const positions = new Map()
const bubbleEls = new Map()
// 拖拽状态：按下时记住球心与指针起点，移动超过 5px 就判定为拖拽，松手不再弹窗。
const drag = { id: '', pointerId: -1, startX: 0, startY: 0, originX: 0, originY: 0, lastX: 0, lastY: 0, lastTime: 0, vx: 0, vy: 0, moved: false }
let suppressClickUntil = 0
// 空闲回吸：鼠标停止操作一段时间后，偏离中心太远的球才会被很轻地拉回来；
// 中心这团球不再持续受力，避免被吸成一整块。
const IDLE_PULL_DELAY = 2000
const IDLE_COMFORT_RATIO = 0.62
let lastActiveAt = performance.now()
function markActive() { lastActiveAt = performance.now() }
let frameId = 0
let resizeObserver = null
let pressTimer = 0
const reduceMotion = typeof window !== 'undefined' && window.matchMedia
  ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
  : false

function masteryStatus(chapterId) {
  const score = masteryMap.value[chapterId]?.score
  if (!Number.isFinite(score)) return 'unknown'
  if (score < 1.5) return 'weak'
  if (score >= 2.4) return 'strong'
  return 'ok'
}

function setBubbleEl(el, id) {
  if (!el) { bubbleEls.delete(id); return }
  bubbleEls.set(id, el)
  const point = positions.get(id)
  if (point) el.style.transform = `translate3d(${point.x - point.r}px, ${point.y - point.r}px, 0)`
}

function applyPositions() {
  for (const item of bubbleItems.value) {
    const point = positions.get(item.id)
    const el = bubbleEls.get(item.id)
    if (!point || !el) continue
    el.style.transform = `translate3d(${point.x - point.r}px, ${point.y - point.r}px, 0)`
  }
}

// 初始布局：所有球从圆心附近出发，靠碰撞分离挤成一团「挨在一起」的气泡群；
// 重要度档差拉开（重点章节明显更大），尺寸再跟着容器宽度缩放。
function buildBubbles() {
  const rect = bubbleField.value?.getBoundingClientRect()
  if (!rect || rect.width < 80) return
  fieldBox.width = rect.width
  fieldBox.height = rect.height
  if (!chapters.value.length) { bubbleItems.value = []; positions.clear(); return }
  const scale = Math.max(0.6, Math.min(1, rect.width / 720))
  bubbleItems.value = chapters.value.map(chapter => {
    const importance = Number(chapter.importance) || 1
    const base = importance >= 5 ? 212 : importance === 4 ? 190 : importance === 3 ? 142 : importance === 2 ? 118 : 102
    return {
      id: chapter.id,
      name: chapter.name,
      unitLabel: chapter.unitLabel || `专题 ${chapter.order}`,
      size: Math.round(base * scale),
      chapter
    }
  })
  const cx = rect.width / 2
  const cy = rect.height / 2
  positions.clear()
  drag.id = ''
  draggingId.value = ''
  bubbleItems.value.forEach(item => {
    positions.set(item.id, {
      id: item.id,
      x: cx + (Math.random() - 0.5) * 24,
      y: cy + (Math.random() - 0.5) * 24,
      vx: (Math.random() - 0.5) * 0.24,
      vy: (Math.random() - 0.5) * 0.24,
      r: item.size / 2
    })
  })
  relaxBubbles(200)
  nextTick(applyPositions)
  startFloat()
}

function liveBubbles() {
  return bubbleItems.value.map(item => positions.get(item.id)).filter(Boolean)
}

// 目录拿到以后再排布气泡；字段尺寸变化时 ResizeObserver 也会重建。
watch(chapters, () => nextTick(buildBubbles))

function relaxBubbles(iterations) {
  const cx = fieldBox.width / 2
  const cy = fieldBox.height / 2
  const outer = fieldBox.width / 2 - 6
  const list = liveBubbles()
  for (let step = 0; step < iterations; step += 1) {
    for (let i = 0; i < list.length; i += 1) {
      for (let j = i + 1; j < list.length; j += 1) {
        const a = list[i]
        const b = list[j]
        const dx = b.x - a.x
        const dy = b.y - a.y
        const distance = Math.hypot(dx, dy) || 0.01
        const minDistance = a.r + b.r - 16
        if (distance >= minDistance) continue
        const push = (minDistance - distance) / 2
        const nx = dx / distance
        const ny = dy / distance
        a.x -= nx * push
        a.y -= ny * push
        b.x += nx * push
        b.y += ny * push
      }
    }
    for (const point of list) {
      const dx = point.x - cx
      const dy = point.y - cy
      const distance = Math.hypot(dx, dy) || 0.01
      const limit = outer - point.r
      if (distance > limit) {
        point.x = cx + (dx / distance) * limit
        point.y = cy + (dy / distance) * limit
      }
    }
  }
}

function startFloat() {
  if (frameId || reduceMotion) return
  frameId = requestAnimationFrame(tick)
}

function stopFloat() {
  if (frameId) cancelAnimationFrame(frameId)
  frameId = 0
}

// 极轻的布朗漂移 + 两两弹开，球在圆环里慢慢挪动；拖拽中的球位置由指针接管，
// 其余球被它顶开；松手后带着甩动速度继续滚。鼠标静止一会儿后，所有球慢慢回吸到圆心。
// 打开大窗口时暂停，省电也避免背景闪动。
function tick() {
  frameId = requestAnimationFrame(tick)
  if (modalOpen.value || !fieldBox.width) return
  const cx = fieldBox.width / 2
  const cy = fieldBox.height / 2
  const outer = fieldBox.width / 2 - 6
  const list = liveBubbles()
  const idle = !drag.id && performance.now() - lastActiveAt > IDLE_PULL_DELAY
  const comfortRadius = outer * IDLE_COMFORT_RATIO
  // 指针停住后不再产生 pointermove，这里按帧衰减上一次记录的拖拽速度，
  // 避免松手前或按住不动时一直按旧速度给别的球施加冲量。
  if (drag.id) {
    drag.vx *= 0.84
    drag.vy *= 0.84
  }
  for (const point of list) {
    if (point.id === drag.id) continue
    // 空闲时摩擦更大：还在飞的球会平滑减速，不会在空闲判定那一帧被硬性截停。
    const damping = idle ? 0.972 : 0.995
    point.vx = (point.vx + (Math.random() - 0.5) * 0.012) * damping
    point.vy = (point.vy + (Math.random() - 0.5) * 0.012) * damping
    // 只在球明显偏离中心时给一丝向心力，越靠外略强一点；
    // 力本身很小，终端速度约 15px/秒，是肉眼可见的缓慢飘回，不是吸附。
    if (idle) {
      const dx = cx - point.x
      const dy = cy - point.y
      const distance = Math.hypot(dx, dy)
      if (distance > comfortRadius) {
        const strength = 0.002 + (distance - comfortRadius) * 0.00012
        point.vx += (dx / distance) * strength
        point.vy += (dy / distance) * strength
      }
    }
    const speed = Math.hypot(point.vx, point.vy)
    if (speed > 4) {
      point.vx *= 4 / speed
      point.vy *= 4 / speed
    }
    point.x += point.vx
    point.y += point.vy
  }
  for (let i = 0; i < list.length; i += 1) {
    for (let j = i + 1; j < list.length; j += 1) {
      const a = list[i]
      const b = list[j]
      const dx = b.x - a.x
      const dy = b.y - a.y
      const distance = Math.hypot(dx, dy) || 0.01
      const minDistance = a.r + b.r - 16
      const nx = dx / distance
      const ny = dy / distance
      // 空闲时球与球之间加一点缓慢的斥力，让挤在一起的球慢慢摊开成
      // 「挨着但留缝」的松散状态；只加力不改位置，所以不会突然弹开。
      if (idle && distance < a.r + b.r) {
        const slack = Math.min(0.006, (a.r + b.r - distance) * 0.0005)
        a.vx -= nx * slack
        a.vy -= ny * slack
        b.vx += nx * slack
        b.vy += ny * slack
      }
      if (distance >= minDistance) continue
      const push = (minDistance - distance) / 2
      // 拖拽中的球位置由指针接管：位置只做少量分离，主要把拖拽速度沿撞击法线
      // 作为冲量传给对方，被撞球会顺着撞击方向弹出去，再靠普通碰撞继续传递。
      if (a.id === drag.id || b.id === drag.id) {
        const other = a.id === drag.id ? b : a
        const dirX = a.id === drag.id ? nx : -nx
        const dirY = a.id === drag.id ? ny : -ny
        other.x += dirX * push * 0.9
        other.y += dirY * push * 0.9
        const impact = drag.vx * dirX + drag.vy * dirY
        if (impact > 0.2) {
          const impulse = Math.min(4, impact * 1.6)
          other.vx = dirX * impulse + other.vx * 0.15
          other.vy = dirY * impulse + other.vy * 0.15
        }
        continue
      }
      a.x -= nx * push
      a.y -= ny * push
      b.x += nx * push
      b.y += ny * push
      const transfer = ((b.vx - a.vx) * nx + (b.vy - a.vy) * ny) * 0.45
      a.vx += nx * transfer
      a.vy += ny * transfer
      b.vx -= nx * transfer
      b.vy -= ny * transfer
    }
  }
  for (const point of list) {
    if (point.id === drag.id) continue
    const dx = point.x - cx
    const dy = point.y - cy
    const distance = Math.hypot(dx, dy) || 0.01
    const limit = outer - point.r
    if (distance <= limit) continue
    const nx = dx / distance
    const ny = dy / distance
    point.x = cx + nx * limit
    point.y = cy + ny * limit
    const normal = point.vx * nx + point.vy * ny
    if (normal > 0) {
      point.vx -= 2 * normal * nx
      point.vy -= 2 * normal * ny
    }
  }
  applyPositions()
}

// ---------- 拖拽 ----------
function clampPoint(point) {
  const cx = fieldBox.width / 2
  const cy = fieldBox.height / 2
  const limit = fieldBox.width / 2 - 6 - point.r
  const dx = point.x - cx
  const dy = point.y - cy
  const distance = Math.hypot(dx, dy)
  if (distance <= limit || !distance) return
  point.x = cx + (dx / distance) * limit
  point.y = cy + (dy / distance) * limit
}

function startDrag(item, event) {
  if (!event.isPrimary || (event.pointerType === 'mouse' && event.button !== 0)) return
  const point = positions.get(item.id)
  const el = bubbleEls.get(item.id)
  if (!point || !el) return
  window.clearTimeout(pressTimer)
  pressedId.value = ''
  drag.id = item.id
  drag.pointerId = event.pointerId
  drag.startX = event.clientX
  drag.startY = event.clientY
  drag.originX = point.x
  drag.originY = point.y
  drag.lastX = event.clientX
  drag.lastY = event.clientY
  drag.lastTime = performance.now()
  drag.vx = 0
  drag.vy = 0
  drag.moved = false
  draggingId.value = item.id
  point.vx = 0
  point.vy = 0
  el.setPointerCapture?.(event.pointerId)
}

function moveDrag(event) {
  if (!drag.id || event.pointerId !== drag.pointerId) return
  const point = positions.get(drag.id)
  if (!point) return
  const totalX = event.clientX - drag.startX
  const totalY = event.clientY - drag.startY
  if (!drag.moved && Math.hypot(totalX, totalY) > 5) drag.moved = true
  point.x = drag.originX + totalX
  point.y = drag.originY + totalY
  clampPoint(point)
  const now = performance.now()
  const elapsed = Math.max(8, now - drag.lastTime)
  drag.vx = ((event.clientX - drag.lastX) / elapsed) * 16
  drag.vy = ((event.clientY - drag.lastY) / elapsed) * 16
  drag.lastX = event.clientX
  drag.lastY = event.clientY
  drag.lastTime = now
  applyPositions()
}

function endDrag(event) {
  if (!drag.id || (event?.pointerId !== undefined && event.pointerId !== drag.pointerId)) return
  const point = positions.get(drag.id)
  if (point) {
    point.vx = Math.max(-4, Math.min(4, drag.vx))
    point.vy = Math.max(-4, Math.min(4, drag.vy))
  }
  if (drag.moved) suppressClickUntil = performance.now() + 350
  drag.id = ''
  drag.pointerId = -1
  draggingId.value = ''
}

function cancelDrag(event) {
  drag.moved = true
  endDrag(event)
}

function onBubbleClick(item) {
  // 拖拽结束后的这次 click 不当作点击，避免甩完球弹出大窗口。
  if (performance.now() < suppressClickUntil) return
  pickBubble(item)
}

function pickBubble(item) {
  pressedId.value = item.id
  window.clearTimeout(pressTimer)
  pressTimer = window.setTimeout(() => { pressedId.value = '' }, 200)
  // 先让球缩一下再弹窗，保留草图上「点击有反馈」的手感。
  window.setTimeout(() => openChapter(item.chapter), 130)
}

// ---------- 整章资料大窗口 ----------
const modalOpen = ref(false)
const activeChapterId = ref('')
// 打开章节时记录它所属的年级/科目/版本：搜索可能来自别的年级，不能沿用左侧当前筛选。
const activeContext = ref({ grade: '', subject: '', edition: '' })
const detail = ref(null)
const detailLoading = ref(false)
const detailBody = ref(null)
const activeChapter = computed(() => chapters.value.find(item => item.id === activeChapterId.value) || null)

watch(modalOpen, open => {
  document.body.style.overflow = open ? 'hidden' : ''
})

function onKeydown(event) {
  if (event.key === 'Escape' && modalOpen.value) closeModal()
}

async function openChapter(chapter, context = {}) {
  if (!chapter) return
  const ctx = {
    grade: context.grade || grade.value,
    subject: context.subject || subject.value,
    edition: context.edition ?? edition.value
  }
  activeContext.value = ctx
  modalOpen.value = true
  activeChapterId.value = chapter.id
  detail.value = null
  detailLoading.value = true
  const chapterId = chapter.id
  const response = await getChapterMaterials({ ...ctx, chapterId })
  // 加载期间切到别的章节或关掉弹窗就丢弃这次结果。
  if (activeChapterId.value !== chapterId || !modalOpen.value) return
  detailLoading.value = false
  if (!response.success) {
    ElMessage.warning(response.error || '资料加载失败，请稍后再试。')
    return
  }
  detail.value = response.data
  // 从相关知识点跳转时内容整块换掉，滚回顶部从讲解开始看。
  await nextTick()
  detailBody.value?.scrollTo({ top: 0 })
}

function closeModal() {
  modalOpen.value = false
  activeChapterId.value = ''
  detail.value = null
  detailLoading.value = false
}

// 按名字打开章节：检索索引里的 id 不带教材版本，直接拿去查资料会 404，
// 所以先取目标年级/科目/版本的目录，再按章节名定位，点搜索结果就能直接弹大窗口。
async function openTopic(topic, { keepKeyword = false } = {}) {
  window.clearTimeout(suggestTimer)
  suggestSeq += 1
  suggestOpen.value = false
  suggestions.value = []
  if (!keepKeyword) keyword.value = topic.name
  const sameContext = topic.grade === grade.value && topic.subject === subject.value
  searching.value = true
  let response = await getCurriculumChapters(topic.grade, topic.subject, sameContext ? edition.value : '')
  // 当前版本没有这一章时回落到默认版本再找一次（不同版本章节划分不同）。
  if (response.success && sameContext && !(response.data?.chapters || []).some(item => item.name === topic.name)) {
    response = await getCurriculumChapters(topic.grade, topic.subject, '')
  }
  searching.value = false
  if (!response.success) { ElMessage.warning(response.error || '目录加载失败，请稍后再试。'); return }
  const data = response.data || {}
  const chapter = (data.chapters || []).find(item => item.name === topic.name)
  if (!chapter) { ElMessage.info(`「${topic.name}」暂时没找到对应章节，换个关键词试试。`); return }
  await openChapter(chapter, { grade: topic.grade, subject: topic.subject, edition: data.edition || '' })
}

// 相关知识点只带名字：先走检索定位年级/科目，再按章节名打开，点一下就能继续跳转。
async function openRelated(name) {
  const query = String(name || '').trim()
  if (!query || detailLoading.value) return
  if (query === detail.value?.chapter?.name) return
  searching.value = true
  const response = await searchMaterials({ q: query })
  searching.value = false
  if (!response.success) { ElMessage.warning(response.error || '相关知识点加载失败，请稍后再试。'); return }
  const topics = response.data?.topics || []
  const topic = topics.find(item => item.name === query) || topics[0]
  if (!topic) { ElMessage.info(`「${query}」暂时没找到对应章节，换个关键词试试。`); return }
  await openTopic({ ...topic, name: query }, { keepKeyword: true })
}

async function runSearch() {
  const query = keyword.value.trim()
  if (!query) return
  window.clearTimeout(suggestTimer)
  suggestSeq += 1
  searching.value = true
  // 不限年级和学科：用户可能只记得知识点名字，不知道它属于哪一册、哪一科。
  const response = await searchMaterials({ q: query })
  searching.value = false
  if (!response.success) { ElMessage.warning(response.error || '搜索失败，请稍后再试。'); return }
  const topics = response.data?.topics || []
  if (!topics.length) { ElMessage.info(`没找到「${query}」相关的知识点，换个关键词试试。`); return }
  await openTopic(topics.find(item => item.name === query) || topics[0])
}

// 输入即联想：停顿 220ms 再查本地索引，过期的返回直接丢弃。
function onKeywordInput() {
  window.clearTimeout(suggestTimer)
  const query = keyword.value.trim()
  const seq = ++suggestSeq
  if (!query) { suggestions.value = []; suggestOpen.value = false; suggesting.value = false; return }
  suggestOpen.value = true
  suggestTimer = window.setTimeout(async () => {
    suggesting.value = true
    const response = await searchMaterials({ q: query })
    if (seq !== suggestSeq) return
    suggesting.value = false
    suggestions.value = response.success ? (response.data?.topics || []) : []
  }, 220)
}

function onKeywordFocus() {
  if (keyword.value.trim()) suggestOpen.value = true
}

function onKeywordBlur() {
  // 留一点时间给联想项的 mousedown，避免还没点下去面板就收起。
  window.setTimeout(() => { suggestOpen.value = false }, 120)
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[char]))
}

function highlightTopic(name) {
  const query = keyword.value.trim()
  const index = query ? name.indexOf(query) : -1
  if (index < 0) return escapeHtml(name)
  return `${escapeHtml(name.slice(0, index))}<em>${escapeHtml(name.slice(index, index + query.length))}</em>${escapeHtml(name.slice(index + query.length))}`
}

function clearSearch() {
  window.clearTimeout(suggestTimer)
  suggestSeq += 1
  keyword.value = ''
  suggestions.value = []
  suggestOpen.value = false
}

function answerText(item) {
  if (item.type === 'single' && item.correctIndex >= 0) {
    return `${'ABCD'[item.correctIndex]}. ${item.options[item.correctIndex] || ''}`
  }
  return item.answer || '暂无参考答案，可去问 AI 完整讲解'
}

// 公式卡片：分号隔开的多条公式各占一行；纯数学生式整行不拆，放不下就整条换行。
function formulaLines(expr = '') {
  return String(expr).split(/[；;]/).map(line => line.trim()).filter(Boolean)
}

function isAtomicFormula(line = '') {
  return !/[\u4e00-\u9fa5]/.test(line) && /[=+−×÷·≤≥≠±<>√≈^_∥⊥≌∽→²³⁴]/.test(line)
}

// 真题答案可能是「B」或「B。传播了…」，取开头连续的选项字母，后续用于高亮正确项。
function correctKeys(answer) {
  const match = String(answer || '').match(/^[A-D]+/)
  return match ? match[0].split('') : []
}

function askTutor(chapterName) {
  router.push({ path: '/tutor', query: { q: `帮我梳理「${chapterName}」的核心知识点和常见题型` } })
}
</script>

<template>
  <div class="page materials-page">
    <div class="page-header">
      <div>
        <span class="eyebrow">学习资料</span>
        <h2 class="page-title">学习资料库</h2>
        <p class="page-subtitle">左侧筛选年级与教材，右侧每个气泡是一个知识点；点开气泡看整章讲解、例题和真题。</p>
      </div>
      <el-button plain @click="askTutor('本年级本学科')">问 AI 梳理知识框架</el-button>
    </div>

    <section class="materials-stage">
      <aside class="materials-rail">
        <section class="surface rail-card filter-card">
          <h3 class="rail-title">筛选</h3>
          <div class="rail-filters">
            <el-select v-model="grade" placeholder="年级">
              <el-option v-for="item in gradeOptions" :key="item" :label="item" :value="item" />
            </el-select>
            <el-select v-model="subject" placeholder="科目">
              <el-option v-for="item in subjectOptions" :key="item" :label="item" :value="item" />
            </el-select>
            <el-select v-model="edition" placeholder="教材版本">
              <el-option v-for="item in editionOptions" :key="item.edition" :label="item.edition" :value="item.edition" />
            </el-select>
            <div class="search-row">
              <el-input
                v-model="keyword"
                placeholder="搜知识点，不限年级学科"
                clearable
                @input="onKeywordInput"
                @focus="onKeywordFocus"
                @blur="onKeywordBlur"
                @keyup.enter="runSearch"
                @clear="clearSearch"
              />
              <el-button type="primary" :loading="searching" @click="runSearch">搜索</el-button>
              <div v-if="suggestOpen && keyword.trim()" class="search-suggest" @mousedown.prevent>
                <p v-if="suggesting && !suggestions.length" class="suggest-state">正在匹配…</p>
                <template v-else-if="suggestions.length">
                  <p class="suggest-state">相关知识点（点一下直接打开）</p>
                  <button
                    v-for="topic in suggestions"
                    :key="`${topic.grade}-${topic.subject}-${topic.name}`"
                    type="button"
                    class="suggest-item"
                    @click="openTopic(topic)"
                  >
                    <span class="suggest-name" v-html="highlightTopic(topic.name)"></span>
                    <small>{{ topic.grade }} · {{ topic.subject }}</small>
                  </button>
                </template>
                <p v-else class="suggest-state">没有匹配的知识点，换个关键词试试</p>
              </div>
            </div>
          </div>
        </section>

        <section class="surface rail-card mastery-card">
          <h3 class="rail-title">掌握度概览 <span>{{ grade }} · {{ subject }}</span></h3>
          <template v-if="masteryRows.length">
            <div class="mastery-figure">
              <div class="mastery-ring" :style="{ '--value': masteryAverage }"><strong>{{ masteryAverage }}%</strong></div>
              <p>{{ masteryRows.length }} 个知识点有记录，{{ masteryRows.filter(row => row.score < 1.5).length }} 个待补强</p>
            </div>
            <ul class="mastery-weak">
              <li v-for="row in weakPreview" :key="row.id">
                <span class="weak-name">{{ row.name }}</span>
                <span class="weak-track"><i :style="{ width: `${Math.max(6, Math.round(row.score / 3 * 100))}%` }"></i></span>
              </li>
            </ul>
          </template>
          <template v-else>
            <p class="mastery-empty">还没有掌握度记录。先做一次摸底，这里就会告诉你哪些知识点是欠缺的。</p>
            <el-button size="small" plain @click="router.push('/diagnosis')">去摸底</el-button>
          </template>
        </section>
      </aside>

      <section class="bubble-stage">
        <div ref="bubbleField" v-loading="loading" class="bubble-field">
          <button
            v-for="item in bubbleItems"
            :key="item.id"
            :ref="el => setBubbleEl(el, item.id)"
            type="button"
            class="bubble"
            :class="[`is-${masteryStatus(item.id)}`, { pressed: pressedId === item.id, dragging: draggingId === item.id }]"
            :style="{ width: `${item.size}px`, height: `${item.size}px`, '--bubble-size': `${item.size}px` }"
            :aria-label="`查看${item.name}的整章资料`"
            @pointerdown="startDrag(item, $event)"
            @pointermove="moveDrag"
            @pointerup="endDrag"
            @pointercancel="cancelDrag"
            @click="onBubbleClick(item)"
          >
            <span class="bubble-face">
              <strong>{{ item.name }}</strong>
              <small>{{ item.unitLabel }}</small>
            </span>
          </button>
          <p v-if="!loading && !bubbleItems.length" class="bubble-empty">当前年级和科目还没有章节资料，换个科目试试。</p>
        </div>
        <div class="bubble-foot">
          <span class="bubble-hint">球可以拖着甩，点一下查看整章资料</span>
          <span class="bubble-legend">
            <em class="dot is-unknown"></em>未测
            <em class="dot is-weak"></em>待补强
            <em class="dot is-strong"></em>已掌握
          </span>
        </div>
      </section>
    </section>

    <p v-if="chapterNote" class="catalog-note muted">{{ chapterNote }}</p>

    <Teleport to="body">
      <Transition name="knowledge-modal">
        <div v-if="modalOpen" class="knowledge-overlay" @click.self="closeModal">
          <section class="knowledge-window" role="dialog" aria-modal="true" :aria-label="`${activeChapter?.name || '知识点'}的整章资料`">
            <header class="knowledge-head">
              <span class="knowledge-tab">知识点</span>
              <div class="knowledge-title">
                <strong>{{ detail?.chapter?.name || activeChapter?.name || '正在加载' }}</strong>
                <small>{{ detail?.chapter?.unitLabel || activeChapter?.unitLabel || `${activeContext.grade} · ${activeContext.subject}` }}<template v-if="(detail?.chapter?.importance || activeChapter?.importance) >= 4"> · 重点章节</template></small>
              </div>
              <button type="button" class="knowledge-close" aria-label="关闭" @click="closeModal">✕</button>
            </header>

            <div ref="detailBody" v-loading="detailLoading" class="knowledge-body">
              <template v-if="detail">
                <div class="detail-block lesson-block">
                  <div class="lesson-head">
                    <h4>知识点讲解</h4>
                    <span class="lesson-badge">{{ detail.lesson?.source === 'pack' ? 'AI 讲解' : '基础讲解' }}</span>
                  </div>
                  <template v-if="detail.lesson">
                    <p class="lesson-intro"><span v-html="formatMathText(detail.lesson.intro)"></span></p>
                    <ul v-if="detail.lesson.points?.length" class="lesson-points">
                      <li v-for="(point, index) in detail.lesson.points" :key="index"><span v-html="formatMathText(point)"></span></li>
                    </ul>
                    <div v-if="detail.lesson.formulas?.length" class="lesson-formulas">
                      <div v-for="(formula, index) in detail.lesson.formulas" :key="index" class="formula-card">
                        <span class="formula-name">{{ formula.name || '公式' }}</span>
                        <strong><span v-for="(line, lineIndex) in formulaLines(formula.expr)" :key="lineIndex" class="formula-line" :class="{ 'is-atomic': isAtomicFormula(line) }">{{ line }}</span></strong>
                        <small v-if="formula.note">{{ formula.note }}</small>
                      </div>
                    </div>
                  </template>
                  <p v-else class="lesson-empty">这一章的讲解正在整理，先看下面的例题和真题。</p>
                </div>

                <div v-if="detail.related?.length" class="detail-block">
                  <h4>相关知识点</h4>
                  <div class="chip-row">
                    <button
                      v-for="name in detail.related"
                      :key="name"
                      type="button"
                      class="chip chip-action"
                      :disabled="detailLoading"
                      @click="openRelated(name)"
                    >{{ name }}</button>
                  </div>
                </div>

                <div v-if="detail.examples?.length" class="detail-block">
                  <h4>典型例题</h4>
                  <div v-for="(item, index) in detail.examples" :key="item.id" class="example">
                    <p class="example-stem"><b>{{ index + 1 }}.</b> <span v-html="formatMathText(item.stem)"></span></p>
                    <ul v-if="item.options?.length" class="example-options">
                      <li v-for="(option, optionIndex) in item.options" :key="optionIndex" v-show="option" :class="{ right: openedAnswers[item.id] && optionIndex === item.correctIndex }">
                        {{ 'ABCD'[optionIndex] }}. <span v-html="formatMathText(option)"></span>
                      </li>
                    </ul>
                    <button type="button" class="answer-toggle" @click="openedAnswers[item.id] = !openedAnswers[item.id]">
                      {{ openedAnswers[item.id] ? '收起答案与解析' : '展开答案与解析' }}
                    </button>
                    <div v-show="openedAnswers[item.id]" class="example-answer">
                      <p><strong>答案：</strong><span v-html="formatMathText(answerText(item))"></span></p>
                      <p v-if="item.explanation"><strong>解析：</strong><span v-html="formatMathText(item.explanation)"></span></p>
                    </div>
                  </div>
                </div>
                <p v-else class="muted empty-text">本章暂无本地题库例题，可以先用视频过一遍，或去章节测试现场出题。</p>

                <div v-if="detail.passages?.length || detail.passagesNote" class="detail-block">
                  <h4>真题参考</h4>
                  <p v-if="detail.passagesNote" class="passage muted">{{ detail.passagesNote }}</p>
                  <div v-for="(item, index) in detail.passages" :key="index" class="passage-group">
                    <p v-if="item.lead" class="passage-lead"><span v-html="formatMathText(item.lead)"></span></p>
                    <article v-for="question in item.questions" :key="`${index}-${question.number}`" class="exam-card">
                      <p class="exam-stem"><b>{{ question.number }}.</b> <span v-html="formatMathText(question.stem)"></span></p>
                      <ul v-if="question.options?.length" class="exam-options">
                        <li v-for="option in question.options" :key="option.key" :class="{ right: correctKeys(question.answer).includes(option.key) }">
                          <em>{{ option.key }}.</em> <span v-html="formatMathText(option.text)"></span>
                        </li>
                      </ul>
                      <div v-if="question.answer || question.analysis" class="exam-analysis">
                        <p v-if="question.answer"><strong>答案</strong><span v-html="formatMathText(question.answer)"></span></p>
                        <p v-if="question.analysis"><strong>解析</strong><span v-html="formatMathText(question.analysis)"></span></p>
                      </div>
                    </article>
                    <p v-if="!item.questions?.length" class="passage"><span v-html="formatMathText(item.readable)"></span></p>
                    <small class="passage-citation">{{ item.citation }}</small>
                  </div>
                </div>

                <VideoSuggestion :chapter-name="detail.chapter.name" :grade="activeContext.grade || grade" :subject="activeContext.subject || subject" :edition="detail.edition" />

                <div class="detail-actions">
                  <el-button plain size="small" @click="askTutor(detail.chapter.name)">问 AI 讲这一章</el-button>
                  <el-button type="primary" plain size="small" @click="router.push('/quiz')">去章节测试</el-button>
                </div>
              </template>
              <p v-else-if="!detailLoading" class="empty-text">资料没加载出来，关掉窗口后重试，或先换个知识点看看。</p>
            </div>
          </section>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<style scoped>
.materials-stage{display:grid;grid-template-columns:300px minmax(0,1fr);gap:18px;align-items:start}
.materials-rail{display:grid;gap:14px}
.rail-card{padding:16px;border-radius:24px}
.rail-title{margin:0 0 12px;font-size:calc(13px*var(--fs-scale));color:var(--muted);font-weight:600;letter-spacing:.04em;display:flex;justify-content:space-between;gap:8px;align-items:baseline}
.rail-title span{font-size:calc(11px*var(--fs-scale));font-weight:400}
.rail-filters{display:grid;gap:9px}
.rail-filters .el-select{width:100%}
.search-row{position:relative;display:flex;gap:8px}
.search-row .el-input{flex:1;min-width:0}
/* 搜索联想：贴在搜索框下方的浮层，点条目直接打开知识点大窗口。 */
.search-suggest{position:absolute;left:0;right:0;top:calc(100% + 6px);z-index:6;max-height:280px;overflow:auto;padding:6px;border-radius:16px;background:rgba(255,255,255,.98);border:1px solid rgba(120,178,171,.22);box-shadow:0 18px 40px rgba(47,92,91,.18)}
.suggest-state{margin:4px 8px 6px;font-size:calc(11px*var(--fs-scale));color:var(--muted)}
.suggest-item{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;padding:8px 10px;border:0;border-radius:10px;background:transparent;color:#2f5c5b;font-family:inherit;font-size:calc(13px*var(--fs-scale));text-align:left;cursor:pointer}
.suggest-item:hover{background:rgba(120,178,171,.14)}
.suggest-item em{font-style:normal;color:#0f766e;background:rgba(120,200,190,.22);border-radius:4px;padding:0 2px}
.suggest-item small{flex:none;font-size:calc(11px*var(--fs-scale));color:var(--muted)}
/* 右侧气泡图：大圆环 + 漂浮知识点球，球的大小对应章节重要度。 */
.bubble-stage{display:grid;justify-items:center;gap:10px}
.bubble-field{position:relative;width:min(100%,max(320px,calc(100vh - 356px)),760px);aspect-ratio:1;border-radius:50%;border:0;background:radial-gradient(circle at 50% 40%,rgba(207,231,228,.3),rgba(255,255,255,0) 66%)}
/* 大圆不用实线描边：一圈模糊的细环 + 外发光，边缘自然虚化。 */
.bubble-field::before{content:'';position:absolute;inset:0;border-radius:50%;border:1.5px solid rgba(143,195,192,.5);filter:blur(3px);pointer-events:none}
.bubble-field::after{content:'';position:absolute;inset:-8px;border-radius:50%;background:radial-gradient(circle,rgba(143,195,192,0) 80%,rgba(143,195,192,.16) 93%,rgba(143,195,192,0) 100%);filter:blur(8px);pointer-events:none}
.bubble{position:absolute;left:0;top:0;z-index:1;display:grid;place-items:center;padding:10px;border-radius:50%;border:0;background:radial-gradient(circle at 34% 26%,#f8fdfc 0%,#e3f3f0 28%,rgba(199,228,224,.92) 55%,rgba(199,228,224,.46) 78%,rgba(199,228,224,0) 96%);color:#2f5c5b;text-align:center;cursor:grab;touch-action:none;font-family:inherit;will-change:transform;transition:box-shadow .22s ease;user-select:none;box-shadow:0 8px 26px rgba(77,141,142,.14)}
.bubble:hover{box-shadow:0 14px 34px rgba(77,141,142,.24);z-index:2}
.bubble.dragging{z-index:4;cursor:grabbing;box-shadow:0 22px 48px rgba(77,141,142,.32)}
.bubble.dragging .bubble-face{transform:scale(1.03)}
.bubble:active{cursor:grabbing}
.bubble:focus-visible{outline:2px solid var(--primary);outline-offset:3px}
.bubble-face{display:grid;gap:2px;transition:transform .18s cubic-bezier(.3,.9,.4,1.4)}
.bubble.pressed .bubble-face{transform:scale(.9)}
.bubble strong{font-size:clamp(11px,calc(var(--bubble-size,120px)*.088),15px);font-weight:600;line-height:1.35;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.bubble small{font-size:clamp(9.5px,calc(var(--bubble-size,120px)*.062),11.5px);color:var(--muted);line-height:1.3}
.bubble.is-weak{background:radial-gradient(circle at 34% 26%,#fffdf9 0%,#f9efe2 30%,rgba(239,220,198,.9) 55%,rgba(239,220,198,.45) 78%,rgba(239,220,198,0) 96%);color:#7a5326;box-shadow:0 8px 26px rgba(191,141,84,.16)}
.bubble.is-weak small{color:#a37a4c}
.bubble.is-strong{background:radial-gradient(circle at 34% 26%,#a9d0ce 0%,#7bb3b1 28%,rgba(77,141,142,.92) 54%,rgba(77,141,142,.5) 78%,rgba(77,141,142,0) 96%);color:#fff;box-shadow:0 8px 26px rgba(77,141,142,.26)}
.bubble.is-strong small{color:rgba(255,255,255,.82)}
.bubble-empty{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:70%;margin:0;font-size:calc(13px*var(--fs-scale));color:var(--muted);text-align:center}
.bubble-foot{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center;font-size:calc(11.5px*var(--fs-scale));color:var(--muted)}
.bubble-hint{opacity:.9}
.bubble-legend{display:inline-flex;gap:6px;align-items:center}
.bubble-legend .dot{width:8px;height:8px;border-radius:50%;display:inline-block;margin-left:6px;border:1px solid transparent}
.dot.is-unknown{background:#cfe7e4;border-color:#9fc9c6}
.dot.is-weak{background:#efdcc6;border-color:#d9b489}
.dot.is-strong{background:#4d8d8e;border-color:#4d8d8e}
/* 掌握度卡片：环 + 最薄弱的 3 个知识点。 */
.mastery-figure{display:flex;align-items:center;gap:12px}
.mastery-figure p{margin:0;font-size:calc(12px*var(--fs-scale));line-height:1.65;color:var(--muted)}
.mastery-ring{--value:0;width:96px;height:96px;flex:none;border-radius:50%;display:grid;place-items:center;position:relative;background:conic-gradient(var(--primary) calc(var(--value)*1%),rgba(77,141,142,.14) 0)}
.mastery-ring::after{content:'';position:absolute;inset:9px;border-radius:50%;background:var(--surface)}
.mastery-ring strong{position:relative;z-index:1;font-size:calc(19px*var(--fs-scale));color:var(--text)}
.mastery-weak{list-style:none;margin:13px 0 0;padding:0;display:grid;gap:9px}
.mastery-weak li{display:grid;gap:4px}
.weak-name{font-size:calc(12px*var(--fs-scale));color:var(--text);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.weak-track{height:5px;border-radius:999px;background:var(--surface-soft);overflow:hidden}
.weak-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#e0b184,var(--primary))}
.mastery-empty{margin:0 0 12px;font-size:calc(12.5px*var(--fs-scale));line-height:1.75;color:var(--muted)}
.catalog-note{margin:12px 0 0;font-size:calc(12px*var(--fs-scale))}
/* 大窗口：接近满屏的圆角浅青面板，左上角只留「知识点」小标签。 */
.knowledge-overlay{position:fixed;inset:0;z-index:2200;display:grid;place-items:center;padding:24px;background:rgba(19,44,43,.32);backdrop-filter:blur(3px)}
.knowledge-window{position:relative;width:min(1060px,94vw);height:min(86vh,920px);display:flex;flex-direction:column;border-radius:34px;border:1px solid rgba(143,195,192,.55);background:linear-gradient(155deg,#e9f7f5,#f7fcfb 46%,#eef8f7);box-shadow:0 30px 80px rgba(24,66,64,.24);overflow:hidden;transition:transform .24s cubic-bezier(.24,.9,.32,1.1)}
.knowledge-head{display:flex;align-items:center;gap:14px;padding:22px 28px 12px;flex:none}
.knowledge-tab{padding:7px 18px;border-radius:12px;border:1px solid rgba(77,141,142,.35);background:rgba(207,231,228,.75);color:#2f5c5b;font-size:calc(13px*var(--fs-scale));font-weight:600;letter-spacing:.04em}
.knowledge-title{display:grid;gap:2px;flex:1;min-width:0}
.knowledge-title strong{font-size:calc(18px*var(--fs-scale));white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.knowledge-title small{font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.knowledge-close{width:34px;height:34px;flex:none;border-radius:50%;border:1px solid rgba(77,141,142,.25);background:rgba(255,255,255,.72);color:#3d6b69;font-size:calc(15px*var(--fs-scale));line-height:1;cursor:pointer;transition:background .18s ease,transform .18s ease}
.knowledge-close:hover{background:#fff;transform:rotate(90deg)}
.knowledge-body{flex:1;overflow:auto;padding:8px max(34px,calc((100% - 940px)/2)) 34px;display:grid;gap:18px;align-content:start}
.knowledge-modal-enter-active,.knowledge-modal-leave-active{transition:opacity .2s ease}
.knowledge-modal-enter-from,.knowledge-modal-leave-to{opacity:0}
.knowledge-modal-enter-from .knowledge-window,.knowledge-modal-leave-to .knowledge-window{transform:scale(.95)}
.detail-block h4{margin:0 0 8px;font-size:calc(13px*var(--fs-scale));color:var(--muted);font-weight:600}
/* 知识点讲解置顶：浅青绿底 + 更醒目的标题，先看人话再做题。 */
.lesson-block{padding:16px 18px;border:1px solid var(--border);border-radius:18px;background:linear-gradient(150deg,var(--surface-soft),var(--surface))}
.lesson-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:10px}
.lesson-head h4{margin:0;font-size:calc(15px*var(--fs-scale));color:var(--text);font-weight:700}
.lesson-badge{padding:2px 9px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:calc(11px*var(--fs-scale))}
.lesson-intro{margin:0;font-size:calc(14.5px*var(--fs-scale));line-height:1.9;color:var(--text)}
.lesson-points{margin:10px 0 0;padding:0;list-style:none;display:grid;gap:6px}
.lesson-points li{position:relative;padding-left:16px;font-size:calc(13.5px*var(--fs-scale));line-height:1.75;color:var(--text)}
.lesson-points li::before{content:'';position:absolute;left:2px;top:.62em;width:6px;height:6px;border-radius:50%;background:var(--primary)}
.lesson-formulas{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:8px;margin-top:11px}
.formula-card{display:grid;gap:2px;padding:10px 13px;border-radius:12px;background:var(--surface);border:1px solid var(--border)}
.formula-name{font-size:calc(11px*var(--fs-scale));color:var(--muted)}
.formula-card strong{font-size:calc(16px*var(--fs-scale));color:var(--primary);letter-spacing:.01em}
.formula-line{display:block;line-height:1.4}
.formula-line.is-atomic{white-space:nowrap}
.formula-card small{font-size:calc(11.5px*var(--fs-scale));color:var(--muted);line-height:1.55}
.lesson-empty{margin:0;font-size:calc(13px*var(--fs-scale));color:var(--muted)}
.chip-row{display:flex;gap:7px;flex-wrap:wrap}
.chip{padding:4px 10px;border-radius:999px;background:var(--surface-soft);border:1px solid var(--border);font-size:calc(12px*var(--fs-scale))}
/* 相关知识点可点击：默认与普通标签一致，悬停时提示可跳转。 */
.chip-action{cursor:pointer;color:inherit;font-family:inherit;transition:background .16s ease,border-color .16s ease,transform .16s ease}
.chip-action:hover:not(:disabled){background:rgba(77,141,142,.14);border-color:rgba(77,141,142,.45);transform:translateY(-1px)}
.chip-action:disabled{cursor:progress;opacity:.6}
.example{padding:12px 0;border-bottom:1px dashed var(--border)}
.example:last-child{border-bottom:0}
.example-stem{margin:0;font-size:calc(14px*var(--fs-scale));line-height:1.8}
.example-options{margin:8px 0 0;padding-left:0;list-style:none;display:grid;gap:4px}
.example-options li{font-size:calc(13px*var(--fs-scale));line-height:1.7;color:var(--text);padding:2px 8px;border-radius:10px}
.example-options li.right{background:rgba(52,168,83,.12);color:#2f8f4b;font-weight:600}
.answer-toggle{margin-top:8px;padding:0;border:0;background:none;color:var(--primary);font-size:calc(12px*var(--fs-scale));cursor:pointer}
.example-answer{margin-top:6px;padding:9px 11px;border-radius:9px;background:var(--surface-soft);display:grid;gap:5px}
.example-answer p{margin:0;font-size:calc(13px*var(--fs-scale));line-height:1.8}
.passage{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:var(--surface-soft);font-size:calc(13px*var(--fs-scale));line-height:1.8}
.passage:last-child{margin-bottom:0}
.passage small{display:block;margin-top:5px;color:var(--muted);font-size:calc(11px*var(--fs-scale))}
/* 真题按题卡渲染：题干、选项、答案与解析分层，避免整段试卷文本堆在一起。 */
.passage-group{margin-bottom:14px}
.passage-group:last-child{margin-bottom:0}
.passage-lead{margin:0 0 8px;font-size:calc(12.5px*var(--fs-scale));line-height:1.75;color:var(--muted)}
.exam-card{padding:12px 13px;margin-bottom:9px;border:1px solid var(--border);border-radius:14px;background:var(--surface)}
.exam-stem{margin:0;font-size:calc(13.5px*var(--fs-scale));line-height:1.85}
.exam-stem b{color:var(--primary);margin-right:2px}
.exam-options{margin:8px 0 0;padding:0;list-style:none;display:grid;gap:4px}
.exam-options li{font-size:calc(13px*var(--fs-scale));line-height:1.7;padding:3px 8px;border-radius:9px}
.exam-options li em{font-style:normal;color:var(--muted);margin-right:2px}
.exam-options li.right{background:rgba(77,141,142,.12);color:var(--primary);font-weight:600}
.exam-analysis{margin-top:9px;padding:9px 11px;border-radius:10px;background:var(--surface-soft);display:grid;gap:5px}
.exam-analysis p{margin:0;font-size:calc(12.5px*var(--fs-scale));line-height:1.8;color:var(--text);display:grid;grid-template-columns:auto 1fr;gap:8px;align-items:start}
.exam-analysis strong{color:var(--primary);font-size:calc(11.5px*var(--fs-scale));background:var(--primary-soft);padding:1px 7px;border-radius:999px;line-height:1.6}
.passage-citation{display:block;margin-top:2px;color:var(--muted);font-size:calc(11px*var(--fs-scale))}
.detail-actions{display:flex;gap:8px;flex-wrap:wrap}
.empty-text,.empty-block p{margin:0;font-size:calc(13px*var(--fs-scale));color:var(--muted)}
@media(max-width:1000px){
  .materials-stage{grid-template-columns:1fr}
  .materials-rail{grid-template-columns:1fr 1fr;align-items:start}
  .bubble-field{width:min(100%,560px)}
}
@media(max-width:680px){
  .materials-rail{grid-template-columns:1fr}
  .knowledge-overlay{padding:10px}
  .knowledge-window{width:100%;height:92vh;border-radius:24px}
  .knowledge-head{padding:16px 16px 10px;gap:10px}
  .knowledge-title strong{font-size:calc(15px*var(--fs-scale))}
  .knowledge-body{padding:6px 16px 24px}
}
</style>
