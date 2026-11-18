<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { deleteMistake, loadMistakes, loadProfile, saveMistake } from '../db/index.js'
import { getCurriculumChapters } from '../services/api.js'
import MistakeAttribution from '../components/MistakeAttribution.vue'
import QuestionOptions from '../components/QuestionOptions.vue'
import SourceBadge from '../components/SourceBadge.vue'
import StudyTimer from '../components/StudyTimer.vue'
import { formatMathText } from '../utils/formatMath.js'
import { stripBookPrefix } from '../utils/chapterNames.js'
import { AUTO_FIX_STREAK, correctStreak } from '../utils/mistakes.js'
import { hotKnowledgePoints, SLIP_LABELS, wrongTimesOf } from '../utils/mistakeSignals.js'
import { isStaleMistake } from '../utils/notices.js'

const route = useRoute()
const router = useRouter()
const mistakes = ref([])
const loading = ref(true)
const grade = ref('')
const subject = ref(String(route.query.subject || ''))
const source = ref('')
// 通知中心「去复习」带 filter=stale 进来，直接落到超 7 天未重做的错题上。
const statusFilter = ref(route.query.filter === 'stale' ? 'stale' : 'open')
const expanded = reactive({})
const explainOpen = reactive({})
// 知识点归纳面板：左侧学科栏点选科目，面板按该科待消灭错题聚合。
const activePoint = ref('')
async function load() {
  loading.value = true
  mistakes.value = (await loadMistakes()).sort((left, right) => right.createdAt - left.createdAt)
  loading.value = false
}
// 开发期预览：?demo=mistakes 灌 27 道演示错题，?demo=clear 清掉。
// 只在 dev 生效，生产构建里这段会被常量折叠掉。
async function applyDemoParam() {
  const mode = new URLSearchParams(location.search).get('demo')
  if (mode !== 'mistakes' && mode !== 'clear') {
    // 旧版演示数据把选项存成了 ['A','B','C','D']，库里不会自动更新；检测到就静默重播一次。
    if (hasStaleDemoOptions(mistakes.value)) {
      const demo = await import('../utils/demoMistakes.js')
      await demo.seedDemoMistakes()
      await load()
    }
    return
  }
  const demo = await import('../utils/demoMistakes.js')
  if (mode === 'clear') await demo.clearDemoMistakes()
  else await demo.seedDemoMistakes()
  await load()
}
onMounted(async () => {
  await load()
  if (import.meta.env.DEV) await applyDemoParam()
  await nextTick()
  syncLegendFade()
  // 捕获阶段先于全局导航快捷键处理，1/2/3 才能在本页做筛选而不是跳页。
  window.addEventListener('keydown', onMistakeKeydown, true)
  window.addEventListener('keydown', onRedoKeydown)
})
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onMistakeKeydown, true)
  window.removeEventListener('keydown', onRedoKeydown)
})

// === 上传错题照片：复用错题归因表单，识别后直接写进错题库 ===
const uploadVisible = ref(false)
const uploadLoading = ref(false)
const uploadProfile = reactive({ grade: '', subject: '', edition: '' })
const uploadChapters = ref([])

async function openUpload() {
  const profile = await loadProfile()
  uploadProfile.grade = profile?.grade || ''
  uploadProfile.subject = profile?.subject || ''
  uploadProfile.edition = profile?.edition || ''
  if (!uploadProfile.grade || !uploadProfile.subject) {
    ElMessage.warning('请先在「学情分析」里选好年级和科目，再来上传错题')
    return
  }
  uploadVisible.value = true
  uploadLoading.value = true
  const response = await getCurriculumChapters(uploadProfile.grade, uploadProfile.subject, uploadProfile.edition)
  uploadLoading.value = false
  uploadChapters.value = response.success ? response.data?.chapters || [] : []
  if (!uploadChapters.value.length) ElMessage.warning('章节列表暂时没加载出来，请稍后重试')
}
function onUploadSaved() {
  uploadVisible.value = false
  load()
}

const grades = computed(() => [...new Set(mistakes.value.map(item => item.grade).filter(Boolean))])
const subjects = computed(() => [...new Set(mistakes.value
  .filter(item => !grade.value || item.grade === grade.value)
  .map(item => item.subject)
  .filter(Boolean))])
// 年级一换，原来选的科目可能不存在了，直接清空避免空列表。
watch(grade, () => {
  activePoint.value = ''
  if (subject.value && !subjects.value.includes(subject.value)) subject.value = ''
})
// 切换学科时清掉知识点过滤，避免新学科下一直是空列表。
watch(subject, () => { activePoint.value = '' })
// 已经在错题页时再从通知点一次，也要切到「超 7 天未复习」。
watch(() => route.query.filter, value => { if (value === 'stale') statusFilter.value = 'stale' })

function statusMatches(item) {
  if (!statusFilter.value || statusFilter.value === 'all') return true
  if (statusFilter.value === 'open') return !item.fixedAt
  if (statusFilter.value === 'stale') return isStaleMistake(item)
  return Boolean(item.fixedAt)
}

// 来源筛选：摸底和章节测试分开，其他（手动录入/历史数据）统一归到「手动录入」。
const AUTO_SOURCES = ['quiz', 'assessment', 'recite']
function sourceMatches(item) {
  if (!source.value) return true
  if (source.value === 'manual') return !AUTO_SOURCES.includes(item.source)
  return item.source === source.value
}

const filtered = computed(() => mistakes.value.filter(item =>
  (!grade.value || item.grade === grade.value) &&
  (!subject.value || item.subject === subject.value) &&
  sourceMatches(item) &&
  (!activePoint.value || pointName(item) === activePoint.value) &&
  matchesKeyword(item) &&
  statusMatches(item)
))
// 新页面按「错次」从高到低排队，错得多的先重做；同错次按最近收录时间排。
const listRows = computed(() => [...filtered.value].sort((left, right) =>
  wrongCount(right) - wrongCount(left) || right.createdAt - left.createdAt
))
const redoQueueItems = computed(() => listRows.value.filter(item => !item.fixedAt))
// 题目可能没有 AI 知识点标签，退回章节名，保证每道题都能归到一个点。
function pointName(item) {
  return stripBookPrefix(item.knowledgeTags?.[0] || item.chapterName || '未归因知识点')
}
// 历史错题里可能存着带「八上：」前缀的章节名，展示时统一裁掉。
function chapterText(value) {
  return stripBookPrefix(value || '')
}
// 错次 = 首次收录算 1 次，之后每次重做/再次测试答错再 +1；重做答对不计入。
function wrongCount(item) {
  return wrongTimesOf(item)
}
// 同一知识点下待消灭错题达到 3 道，整组标为易错知识点。
const hotPointNames = computed(() => hotKnowledgePoints(mistakes.value))
function isHotPoint(item) {
  return hotPointNames.value.has(pointName(item))
}

// 搜索只匹配本地已有字段，题干、章节、知识点和答案都能命中。
const keyword = ref('')
const searchInput = ref(null)
function matchesKeyword(item) {
  const text = keyword.value.trim().toLowerCase()
  if (!text) return true
  return [item.stem, item.text, item.subject, item.chapterName, item.correctAnswer, ...(item.knowledgeTags || [])]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()
    .includes(text)
}
// === 电脑端键盘操作：↑↓ / J K 选择错题，M 标记已消灭，Enter 重做 ===
const focusedId = ref('')

function shortcutBlocked(event) {
  const target = event.target
  if (!(target instanceof HTMLElement)) return false
  // 行本身是按钮，选中后还要能用 J/K 继续移动，所以放行这一种按钮。
  if (target.closest('.row-main-button')) return false
  return Boolean(target.closest('input, textarea, select, [contenteditable="true"], button, a[href], [role="button"], .el-overlay, [role="dialog"], .el-select__wrapper'))
}

function moveFocused(step) {
  const list = listRows.value
  if (!list.length) return
  const index = list.findIndex(item => item.id === focusedId.value)
  const next = index < 0 ? (step > 0 ? 0 : list.length - 1) : Math.min(list.length - 1, Math.max(0, index + step))
  focusedId.value = list[next].id
  nextTick(() => document.querySelector(`[data-mistake-id="${focusedId.value}"]`)?.scrollIntoView({ block: 'nearest' }))
}

// 手动消灭：自动消灭要连续答对两次，学生自查确认时可以直接收掉。
async function markFixed(item) {
  if (!item || item.fixedAt) return
  await saveMistake({ ...item, fixedAt: Date.now() })
  await load()
  ElMessage.success('已标记为消灭，之后可以在「已消灭」里回看')
}

function onMistakeKeydown(event) {
  if (event.defaultPrevented || event.ctrlKey || event.metaKey || event.altKey) return
  // 重做 / 上传弹窗打开时，1/2/3 留给弹窗，别在背后偷偷换筛选。
  if (redoVisible.value || uploadVisible.value) return
  if (window.innerWidth < 801 || shortcutBlocked(event)) return
  const key = event.key
  // 这三组键本页先用掉，并阻止默认行为，避免上层导航再按数字跳页。
  if (key === '/') { event.preventDefault(); searchInput.value?.focus(); return }
  if (key === '1' || key === '2' || key === '3') {
    event.preventDefault()
    statusFilter.value = { 1: 'all', 2: 'open', 3: 'fixed' }[key]
    return
  }
  if (key === 'ArrowDown' || key === 'j' || key === 'J') { event.preventDefault(); moveFocused(1); return }
  if (key === 'ArrowUp' || key === 'k' || key === 'K') { event.preventDefault(); moveFocused(-1); return }
  if (key === 'Escape') { focusedId.value = ''; return }
  const item = listRows.value.find(row => row.id === focusedId.value)
  if (!item) return
  if (key === 'Enter') { event.preventDefault(); openRedo(item) } else if (key === 'm' || key === 'M') { event.preventDefault(); markFixed(item) }
}

const todayFixedCount = computed(() => {
  const start = new Date()
  start.setHours(0, 0, 0, 0)
  return mistakes.value.filter(item => item.fixedAt && item.fixedAt >= start.getTime()).length
})

// 左侧学科栏：数量跟随当前状态，点「已消灭」就能按学科回看旧题。
const subjectRows = computed(() => {
  const map = new Map()
  for (const item of mistakes.value) {
    if (!item.subject || !statusMatches(item)) continue
    if (grade.value && item.grade !== grade.value) continue
    if (source.value && !sourceMatches(item)) continue
    const row = map.get(item.subject) || { name: item.subject, count: 0 }
    row.count += 1
    map.set(item.subject, row)
  }
  return [...map.values()].sort((left, right) => right.count - left.count || left.name.localeCompare(right.name, 'zh'))
})
const scopedTotal = computed(() => subjectRows.value.reduce((sum, row) => sum + row.count, 0))
const maxSubjectCount = computed(() => Math.max(1, ...subjectRows.value.map(row => row.count)))

const statusTabs = [
  { value: 'open', label: '待消灭' },
  { value: 'stale', label: '超 7 天' },
  { value: 'fixed', label: '已消灭' },
  { value: 'all', label: '全部' }
]
const statusLabels = { open: '待消灭', stale: '超 7 天未复习', fixed: '已消灭', all: '错题' }
// 状态页签上的数量跟随年级/学科/来源/知识点/搜索，但不跟随状态本身，
// 这样切换页签前就能看清每个状态各有多少道。
const statusCounts = computed(() => {
  const scoped = mistakes.value.filter(item =>
    (!grade.value || item.grade === grade.value) &&
    (!subject.value || item.subject === subject.value) &&
    (!source.value || sourceMatches(item)) &&
    (!activePoint.value || pointName(item) === activePoint.value) &&
    matchesKeyword(item)
  )
  return {
    open: scoped.filter(item => !item.fixedAt).length,
    stale: scoped.filter(item => isStaleMistake(item)).length,
    fixed: scoped.filter(item => item.fixedAt).length,
    all: scoped.length
  }
})
const hasFilters = computed(() => Boolean(grade.value || subject.value || source.value || activePoint.value || keyword.value.trim()))
function clearFilters() {
  grade.value = ''
  subject.value = ''
  source.value = ''
  activePoint.value = ''
  keyword.value = ''
  statusFilter.value = 'open'
}
const heroTitle = computed(() => {
  if (statusFilter.value === 'fixed') return `已经消灭 ${scopedTotal.value} 道`
  if (statusFilter.value === 'stale') return `有 ${scopedTotal.value} 道超 7 天没复习`
  if (statusFilter.value === 'all') return `一共 ${scopedTotal.value} 道错题`
  return `还有 ${scopedTotal.value} 道没消灭`
})
const cardTitle = computed(() => `${subject.value || '全部学科'} · ${listRows.value.length} 道${statusLabels[statusFilter.value] || '错题'}`)

// 知识点分布跟随当前状态、学科、年级、来源，保证面板数量和列表一致；搜索不改变概览。
const pointScope = computed(() => mistakes.value.filter(item =>
  statusMatches(item) &&
  (!subject.value || item.subject === subject.value) &&
  (!grade.value || item.grade === grade.value) &&
  (!source.value || sourceMatches(item))
))
const pointRows = computed(() => {
  const map = new Map()
  for (const item of pointScope.value) {
    const name = pointName(item)
    const row = map.get(name) || { name, count: 0, wrongs: 0 }
    row.count += 1
    row.wrongs += wrongCount(item)
    map.set(name, row)
  }
  return [...map.values()].sort((left, right) => right.count - left.count || right.wrongs - left.wrongs)
})
const pointTotal = computed(() => pointRows.value.reduce((sum, row) => sum + row.count, 0))
// 饼图最多单列 5 个知识点，其余合并成「其他」，避免扇区碎成一片。
const POINT_COLORS = ['#2f6f5e', '#4d8d8e', '#82b4a8', '#b3cdc1', '#e0b271', '#c9c2b4']
const pointSlices = computed(() => {
  const total = pointTotal.value
  if (!total) return []
  const head = pointRows.value.slice(0, 5).map((row, index) => ({
    name: row.name,
    count: row.count,
    percent: row.count / total,
    color: POINT_COLORS[index],
    names: [row.name]
  }))
  const tail = pointRows.value.slice(5)
  if (tail.length) {
    const count = tail.reduce((sum, row) => sum + row.count, 0)
    head.push({ name: `其他 ${tail.length} 个知识点`, count, percent: count / total, color: POINT_COLORS[5], names: [] })
  }
  return head
})
// 图例列出全部知识点（不止前 5 个）：知识点一多时靠列表内滚动查看，避免左栏被拉成长条。
// 前 5 个用与扇区同色；进入「其他」的那些统一用灰色，和圆环里那条「其他」扇区对得上。
const pointLegend = computed(() => {
  const total = pointTotal.value
  if (!total) return []
  return pointRows.value.map((row, index) => ({
    name: row.name,
    count: row.count,
    percent: row.count / total,
    color: index < 5 ? POINT_COLORS[index] : POINT_COLORS[5],
    names: [row.name]
  }))
})
// 用圆环描边画饼：每段 dash 长度就是占比，多段时留 3 个单位缝隙。
const pointArcs = computed(() => {
  const circumference = 2 * Math.PI * 46
  const gap = pointSlices.value.length > 1 ? 3 : 0
  let offset = 0
  return pointSlices.value.map(slice => {
    const arc = { ...slice, circumference, length: Math.max(0, slice.percent * circumference - gap), offset }
    offset += slice.percent * circumference
    return arc
  })
})
const dominantPoint = computed(() => pointRows.value[0] || null)
const insightText = computed(() => {
  // 归纳只描述还要重做的题，已消灭 / 全部视图不显示，避免把旧题当成待办。
  if (statusFilter.value !== 'open' && statusFilter.value !== 'stale') return ''
  const top = dominantPoint.value
  const total = pointTotal.value
  if (!top || !total) return ''
  if (total === 1) return '只剩 1 道待消灭，复习一遍就能收掉——这一轮你几乎清完了'
  if (top.count * 2 >= total) return `这 ${total} 道里有 ${top.count} 道集中在「${top.name}」，说明短板只剩这一块，把它过一遍，提分最快`
  return `这 ${total} 道摊在 ${pointRows.value.length} 个知识点上，每清一道就少一个卡点，按错次从高到低过，会越来越顺`
})
const emptyText = computed(() => {
  if (!mistakes.value.length) return '错题库还是空的，点右上角「上传错题照片」，把第一道错题存进来'
  if (keyword.value || activePoint.value || grade.value || source.value) return '当前筛选下没有错题，换个条件或清除「只看」再试'
  if (statusFilter.value === 'fixed') return '还没有已消灭的错题，同一道题连续答对两次后会自动出现在这里'
  if (statusFilter.value === 'stale') return '没有超过 7 天没复习的错题，保持现在的节奏就好'
  if (statusFilter.value === 'all') return '错题库还是空的'
  return '当前范围下没有待消灭的错题，换个学科看看'
})

function filterPoint(name) {
  activePoint.value = activePoint.value === name ? '' : name
}
// 图例可滚动：只有真的超出一屏才显示底部渐隐，滚到底时撤掉，免得最后一行被蒙住。
const legendRef = ref(null)
const legendOverflow = ref(false)
const legendAtEnd = ref(true)
function syncLegendFade() {
  const el = legendRef.value
  if (!el) {
    legendOverflow.value = false
    legendAtEnd.value = true
    return
  }
  legendOverflow.value = el.scrollHeight - el.clientHeight > 2
  legendAtEnd.value = el.scrollTop + el.clientHeight >= el.scrollHeight - 2
}
watch([pointLegend, () => subject.value, () => statusFilter.value], () => nextTick(syncLegendFade), { flush: 'post' })
// 「看归纳」在页面底部，把左栏的知识点分布滚回视口。
function showInsight() {
  document.querySelector('.point-rail')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
}

function sourceLabel(item) { return { quiz: '章节测试', assessment: '摸底测试', recite: '背诵练习' }[item.source] || '手动录入' }
function dateText(value) { return value ? new Date(value).toLocaleDateString('zh-CN') : '' }
function toggle(id) { expanded[id] = !expanded[id] }
// 整行点击都进入展开/收起，避免只有标题那一小块能点。
function focusRow(item) {
  focusedId.value = item.id
  toggle(item.id)
}
function toggleExplain(id) { explainOpen[id] = !explainOpen[id] }

async function remove(item) {
  try {
    await ElMessageBox.confirm('从错题库彻底删除这道题？已消灭记录也会一起删除', '删除错题', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
    })
  } catch { return }
  await deleteMistake(item.id)
  await load()
  ElMessage.success('已删除')
}

// === 错题重做：选题即判分，填空/解答题自评；结果写入 redoHistory，周报按周汇总 ===
const redoVisible = ref(false)
const redoItem = ref(null)
const redoChoice = ref(null)
const redoResult = ref('')
// 本次重做是否刚好触发自动消灭；已消灭题再次重做时不能误报。
const redoFixedNow = ref(false)
// 「开始重做 N 道」按当前列表顺序排一个队列，答完一道可以接着下一道。
const redoQueue = ref([])
const redoQueueIndex = ref(0)
const redoHasNext = computed(() => redoQueue.value.length > 1 && redoQueueIndex.value < redoQueue.value.length - 1)
// 本组重做的答对次数，用于进度条和收尾统计；只记当前这轮，不落库。
const redoSessionResults = ref([])
const redoSessionCorrect = computed(() => redoSessionResults.value.filter(Boolean).length)
const redoProgress = computed(() => redoQueue.value.length
  ? Math.round((redoQueueIndex.value + 1) / redoQueue.value.length * 100)
  : 0)

// 错题记录里的选项：真实测验存的是 single，演示/旧数据可能是 choice，上传错题没有选项。
const LETTERS = 'ABCD'
const CHOICE_TYPES = new Set(['single', 'choice', 'multiple'])
// 选项是 ['A','B','C','D'] 这种字母占位说明是旧数据缺了选项文本，不能当真实选项渲染。
function isPlaceholderOptions(options) {
  const items = Array.isArray(options) ? options.map(option => String(option ?? '').trim()) : []
  return items.length >= 2 && items.every((text, index) => text.toUpperCase() === LETTERS[index])
}
function hasStaleDemoOptions(list) {
  return list.some(item => String(item?.id || '').startsWith('demo-mistake-') && isPlaceholderOptions(item.options))
}
function mistakeOptions(item) {
  const all = Array.isArray(item?.options) ? item.options.filter(option => String(option ?? '').trim()) : []
  return isPlaceholderOptions(all) ? [] : all
}
function isChoiceMistake(item) {
  return mistakeOptions(item).length >= 2 && (!item?.type || CHOICE_TYPES.has(item.type))
}
// 作答和答案可能是「B」「B. 内容」或「A. 内容；C. 内容」，统一反推选项下标。
function answerIndexes(answer, options) {
  const text = String(answer || '').trim()
  if (!text || text === '未作答') return []
  const indexes = []
  const pattern = /(^|[；;、,，])\s*([A-D])(?=[.、．\s]|$)/g
  let match
  while ((match = pattern.exec(text))) {
    const index = LETTERS.indexOf(match[2])
    if (index >= 0 && index < options.length && !indexes.includes(index)) indexes.push(index)
  }
  if (indexes.length) return indexes
  const exact = options.findIndex(option => String(option).trim() === text)
  return exact >= 0 ? [exact] : []
}
function correctIndexesOf(item) {
  const options = mistakeOptions(item)
  if (Array.isArray(item?.correctIndexes) && item.correctIndexes.length) {
    return item.correctIndexes.map(Number).filter(index => Number.isInteger(index) && options[index] !== undefined)
  }
  const saved = Number(item?.correctIndex)
  if (Number.isInteger(saved) && saved >= 0 && options[saved] !== undefined) return [saved]
  return answerIndexes(item?.correctAnswer, options)
}

const redoOptions = computed(() => mistakeOptions(redoItem.value))
// 老错题没存 correctIndex 时，从「A. 选项内容」格式的正确答案反推；多选题退回自评。
const redoCorrectIndex = computed(() => {
  const indexes = correctIndexesOf(redoItem.value)
  return indexes.length === 1 ? indexes[0] : -1
})
const redoIsChoice = computed(() => {
  const item = redoItem.value
  return isChoiceMistake(item) && item?.type !== 'multiple' && redoCorrectIndex.value >= 0
})
const redoStreak = computed(() => correctStreak(redoItem.value?.redoHistory))
const redoRemaining = computed(() => Math.max(1, AUTO_FIX_STREAK - redoStreak.value))

function openRedo(item) {
  redoQueue.value = []
  redoQueueIndex.value = 0
  redoSessionResults.value = []
  openRedoItem(item)
}

// 带着这道错题进入答疑：题干、作答、错因与解析会一起交给 AI，避免学生重复粘贴。
function askAi(item) {
  router.push({ path: '/tutor', query: { mistakeId: item.id } })
}

function openRedoItem(item) {
  redoItem.value = item
  redoChoice.value = null
  redoResult.value = ''
  redoFixedNow.value = false
  redoVisible.value = true
}

function startBatchRedo() {
  const queue = redoQueueItems.value.slice()
  if (!queue.length) return
  redoQueue.value = queue
  redoQueueIndex.value = 0
  redoSessionResults.value = []
  openRedoItem(queue[0])
}

// 答完进入下一道；没答出来也能「跳过这道」，本轮不计结果。
function advanceRedo() {
  if (!redoHasNext.value) return
  redoQueueIndex.value += 1
  openRedoItem(redoQueue.value[redoQueueIndex.value])
}

function closeRedo() {
  redoQueue.value = []
  redoQueueIndex.value = 0
  redoSessionResults.value = []
}

function redoOptionClass(index) {
  if (!redoResult.value) return ''
  if (index === redoCorrectIndex.value) return 'correct'
  if (index === redoChoice.value) return 'wrong'
  return ''
}

async function chooseRedo(index) {
  if (redoResult.value) return
  redoChoice.value = index
  redoResult.value = index === redoCorrectIndex.value ? 'correct' : 'wrong'
  await persistRedo(redoResult.value === 'correct')
}

async function judgeRedo(correct) {
  if (redoResult.value) return
  redoResult.value = correct ? 'correct' : 'wrong'
  await persistRedo(correct)
}

async function persistRedo(correct) {
  const item = redoItem.value
  if (!item) return
  const now = Date.now()
  const updated = {
    ...item,
    redoCount: (Number(item.redoCount) || 0) + 1,
    lastRedoAt: now,
    redoHistory: [...(item.redoHistory || []), { at: now, correct }].slice(-20)
  }
  // 连续答对两次才自动消灭；单次答对只记录进度，答错重新计数。已消灭的题保持原状态。
  const reachingFix = !item.fixedAt && correctStreak(updated.redoHistory) >= AUTO_FIX_STREAK
  updated.fixedAt = item.fixedAt || (reachingFix ? now : null)
  redoFixedNow.value = reachingFix
  await saveMistake(updated)
  redoSessionResults.value.push(correct)
  redoItem.value = updated
  await load()
}

// 判完分把焦点交给「下一道」，回车就能连着重做，不用再摸鼠标。
watch(redoResult, async value => {
  if (!value) return
  await nextTick()
  document.querySelector('.redo-dialog .redo-primary')?.focus()
})

// 重做弹窗内数字键 / A-D 直接选项，和键盘重做流保持一致。
function onRedoKeydown(event) {
  if (!redoVisible.value || redoResult.value || !redoIsChoice.value) return
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing) return
  const target = event.target
  if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return
  const key = event.key.toLowerCase()
  const digit = '1234'.indexOf(key)
  const index = digit >= 0 ? digit : 'abcd'.indexOf(key)
  if (index < 0 || index >= redoOptions.value.length) return
  event.preventDefault()
  chooseRedo(index)
}
</script>

<template>
  <div class="page mistakes-page">
    <div class="mistake-shell">
      <aside class="subject-rail">
        <span class="eyebrow">错题库</span>
        <p class="rail-heading">按学科</p>
        <nav class="rail-list" aria-label="按学科筛选">
          <button type="button" class="rail-item" :class="{ active: !subject }" @click="subject = ''">
            <span class="rail-name">全部</span>
            <span class="rail-count">{{ scopedTotal }}</span>
            <i class="rail-meter" style="width:100%"></i>
          </button>
          <button
            v-for="row in subjectRows"
            :key="row.name"
            type="button"
            class="rail-item"
            :class="{ active: subject === row.name }"
            @click="subject = row.name"
          >
            <span class="rail-name">{{ row.name }}</span>
            <span class="rail-count">{{ row.count }}</span>
            <i class="rail-meter" :style="{ width: `${Math.max(12, Math.round(row.count / maxSubjectCount * 100))}%` }"></i>
          </button>
        </nav>
        <!-- 知识点分布：选「全部」看全科聚合，选单科看这一科；数量、排序和右侧列表同源。 -->
        <section class="point-rail" aria-label="知识点分布">
          <div class="point-panel">
            <div class="point-panel-head"><strong>{{ subject || '全部学科' }} · 知识点</strong><span>{{ pointTotal }} 道</span></div>
            <div v-if="pointSlices.length" class="point-chart">
              <div class="point-pie">
                <svg viewBox="0 0 120 120" role="img" :aria-label="`知识点分布，共 ${pointTotal} 道`">
                  <circle cx="60" cy="60" r="46" fill="none" stroke="var(--border)" stroke-width="16" />
                  <g transform="rotate(-90 60 60)">
                    <circle
                      v-for="arc in pointArcs"
                      :key="arc.name"
                      class="point-arc"
                      cx="60"
                      cy="60"
                      r="46"
                      fill="none"
                      :stroke="arc.color"
                      stroke-width="16"
                      :stroke-dasharray="`${arc.length} ${arc.circumference}`"
                      :stroke-dashoffset="-arc.offset"
                    />
                  </g>
                </svg>
                <div class="point-pie-center"><strong>{{ pointTotal }}</strong><span>道</span></div>
              </div>
              <div
                ref="legendRef"
                class="point-legend"
                :class="{ 'is-scroll': legendOverflow, 'is-end': legendAtEnd }"
                :title="`共 ${pointLegend.length} 个知识点`"
                @scroll.passive="syncLegendFade"
              >
                <button
                  v-for="slice in pointLegend"
                  :key="slice.name"
                  type="button"
                  class="point-legend-item"
                  :class="{ active: slice.names.includes(activePoint) }"
                  :title="`只看「${slice.name}」这 ${slice.count} 道`"
                  @click="filterPoint(slice.name)"
                >
                  <i :style="{ background: slice.color }"></i>
                  <span class="point-legend-name">{{ slice.name }}</span>
                  <span class="point-legend-count">{{ slice.count }} · {{ Math.round(slice.percent * 100) }}%</span>
                </button>
              </div>
            </div>
            <p v-else class="point-empty">这个范围还没有错题</p>
          </div>
        </section>
      </aside>

      <main class="mistake-main">
        <div class="topline">
          <el-button type="primary" class="upload-button" @click="openUpload">上传错题照片</el-button>
          <StudyTimer />
        </div>

        <header class="mistake-hero">
          <div>
            <h1>{{ heroTitle }}</h1>
          </div>
          <div class="today-fixed">
            <span>今日已消灭</span>
            <strong>{{ todayFixedCount }} 道</strong>
          </div>
        </header>

        <div class="filter-bar">
          <div class="status-tabs" role="tablist" aria-label="错题状态">
            <button
              v-for="tab in statusTabs"
              :key="tab.value"
              type="button"
              role="tab"
              :aria-selected="statusFilter === tab.value"
              :class="{ active: statusFilter === tab.value }"
              @click="statusFilter = tab.value"
            >{{ tab.label }}<span class="tab-count">{{ statusCounts[tab.value] }}</span></button>
          </div>
          <div class="filter-controls">
            <el-input ref="searchInput" v-model="keyword" clearable placeholder="搜索题干 / 知识点" class="mistake-search" />
            <el-select v-model="grade" placeholder="全部年级" clearable>
              <el-option v-for="item in grades" :key="item" :label="item" :value="item" />
            </el-select>
            <el-select v-model="source" placeholder="全部来源" clearable>
              <el-option label="章节测试" value="quiz" />
              <el-option label="摸底测试" value="assessment" />
              <el-option label="背诵练习" value="recite" />
              <el-option label="手动录入" value="manual" />
            </el-select>
          </div>
        </div>
        <div v-if="activePoint" class="active-point">
          <span>只看：{{ activePoint }}</span>
          <button type="button" @click="activePoint = ''">清除</button>
        </div>

        <section v-loading="loading" class="subject-card surface">
          <div class="subject-card-head">
            <div class="subject-card-title">
              <h3>{{ cardTitle }}</h3>
            </div>
            <el-button v-if="redoQueueItems.length" type="primary" class="start-button" @click="startBatchRedo">开始复习</el-button>
            <el-button v-else-if="!loading" class="start-button" disabled>{{ statusFilter === 'fixed' ? '已消灭记录' : '暂无待复习' }}</el-button>
          </div>

          <div class="table-head">
            <span>题目</span><span>错次</span><span>操作</span>
          </div>

          <div v-if="listRows.length" class="mistake-list">
            <article
              v-for="item in listRows"
              :key="item.id"
              class="mistake-row"
              :class="{ fixed: item.fixedAt, focused: focusedId === item.id, expanded: Boolean(expanded[item.id]) }"
              :data-mistake-id="item.id"
            >
              <div class="row-grid" @click="focusRow(item)">
                <button type="button" class="row-main-button" :aria-expanded="Boolean(expanded[item.id])" @keydown.enter.prevent @keydown.space.prevent="focusRow(item)">
                  <span class="row-title" v-html="formatMathText(item.stem || item.text || pointName(item))"></span>
                  <span class="row-sub">{{ pointName(item) }}<template v-if="chapterText(item.chapterName) && chapterText(item.chapterName) !== pointName(item)"> · {{ chapterText(item.chapterName) }}</template> · {{ dateText(item.createdAt) }}</span>
                  <span v-if="!item.fixedAt && (item.slip || wrongCount(item) >= 2 || isHotPoint(item))" class="row-flags">
                    <em v-if="item.slip" class="row-flag slip">{{ SLIP_LABELS[item.slip] }}</em>
                    <em v-if="wrongCount(item) >= 2" class="row-flag hot">易错题</em>
                    <em v-if="isHotPoint(item)" class="row-flag hot">易错知识点</em>
                  </span>
                  <i class="row-caret" :class="{ open: expanded[item.id] }" aria-hidden="true"></i>
                </button>
                <span class="wrong-count" :class="{ hot: wrongCount(item) >= 3 }" title="答错次数，含复习答错">×{{ wrongCount(item) }}</span>
                <button type="button" class="redo-link" @click.stop="openRedo(item)">复习</button>
              </div>
              <div v-if="expanded[item.id]" class="row-detail">
                <div class="detail-meta">
                  <el-tag effect="plain">{{ item.grade }} · {{ item.subject }}</el-tag>
                  <el-tag size="small" type="info" effect="plain">{{ chapterText(item.chapterName) || '未归因章节' }}</el-tag>
                  <el-tag size="small" :type="item.source === 'quiz' ? 'warning' : item.source === 'assessment' ? 'success' : 'info'" effect="plain">{{ sourceLabel(item) }}</el-tag>
                  <el-tag v-if="item.fixedAt" size="small" type="success" effect="plain">已消灭 · {{ dateText(item.fixedAt) }}</el-tag>
                  <el-tag v-else-if="correctStreak(item.redoHistory)" size="small" type="success" effect="plain">连续答对 {{ correctStreak(item.redoHistory) }}/{{ AUTO_FIX_STREAK }}</el-tag>
                  <el-tag v-if="!item.fixedAt && item.slip" size="small" type="warning" effect="plain">{{ SLIP_LABELS[item.slip] }}</el-tag>
                  <el-tag v-if="!item.fixedAt && wrongCount(item) >= 2" size="small" type="danger" effect="plain">易错题</el-tag>
                  <el-tag v-if="!item.fixedAt && isHotPoint(item)" size="small" type="danger" effect="plain">易错知识点</el-tag>
                  <span class="muted">上次复习 {{ item.lastRedoAt ? dateText(item.lastRedoAt) : '还没复习' }}</span>
                </div>
                <div v-if="item.knowledgeTags && item.knowledgeTags.length" class="knowledge-tags">
                  <span class="summary-label">知识点</span>
                  <el-tag v-for="tag in item.knowledgeTags" :key="tag" size="small" effect="plain">{{ stripBookPrefix(tag) }}</el-tag>
                </div>
                <div v-if="item.errorCause" class="ai-analysis">
                  <p><strong>错因分析：</strong><SourceBadge :source="item.analysisSource" />{{ item.errorCause }}</p>
                  <p v-if="item.analysisSuggestion" class="muted">补强建议：{{ item.analysisSuggestion }}</p>
                </div>
                <div v-if="item.userAnswer || item.correctAnswer" class="answer-compare">
                  <QuestionOptions
                    v-if="isChoiceMistake(item)"
                    :options="mistakeOptions(item)"
                    :correct="correctIndexesOf(item)"
                    :chosen="answerIndexes(item.userAnswer, mistakeOptions(item))"
                  />
                  <p><strong>你的答案：</strong><span v-html="formatMathText(item.userAnswer || '未作答')"></span></p>
                  <p><strong>正确答案：</strong><span v-html="formatMathText(item.correctAnswer || '—')"></span></p>
                </div>
                <div v-if="item.explanation" class="record-explanation">
                  <button type="button" class="explanation-toggle" @click="toggleExplain(item.id)">{{ explainOpen[item.id] ? '收起解析' : '展开解析' }}</button>
                  <p v-show="explainOpen[item.id]" v-html="formatMathText(item.explanation)"></p>
                </div>
                <div class="detail-actions">
                  <el-button link type="primary" @click="askAi(item)">问 AI 讲这道题</el-button>
                  <el-button v-if="!item.fixedAt" link type="success" @click="markFixed(item)">标记已消灭</el-button>
                  <el-button link type="danger" @click="remove(item)">删除</el-button>
                </div>
              </div>
            </article>
          </div>

          <div v-else-if="!loading" class="mistake-empty">
            <p>{{ hasFilters ? '当前筛选条件下没有错题' : emptyText }}</p>
            <div class="empty-actions">
              <el-button v-if="hasFilters" type="primary" @click="clearFilters">清除筛选，看全部</el-button>
              <el-button :type="hasFilters ? 'default' : 'primary'" @click="openUpload">上传错题照片</el-button>
            </div>
          </div>
        </section>

        <aside v-if="insightText" class="insight-callout">
          <div>
            <strong>每道都算数</strong>
            <p>{{ insightText }}</p>
          </div>
          <button v-if="subject" type="button" class="insight-link" @click="showInsight">看归纳</button>
        </aside>
      </main>
    </div>

    <el-dialog v-model="redoVisible" title="错题复习" width="min(600px, 94vw)" class="redo-dialog" @closed="closeRedo">
      <template v-if="redoItem">
        <div v-if="redoQueue.length > 1" class="redo-progress">
          <div class="redo-progress-head">
            <span>第 {{ redoQueueIndex + 1 }} / {{ redoQueue.length }} 道</span>
            <span>本组已答对 {{ redoSessionCorrect }} 道</span>
          </div>
          <div class="redo-progress-bar"><i :style="{ width: `${redoProgress}%` }"></i></div>
        </div>
        <p class="redo-meta">
          {{ redoItem.grade }} · {{ redoItem.subject }} · {{ chapterText(redoItem.chapterName) || '未归因章节' }}
          <template v-if="redoQueue.length"> · 错次 ×{{ wrongCount(redoItem) }}</template>
          <span v-if="redoIsChoice && !redoResult" class="redo-keyhint"> · 按数字键快选</span>
        </p>
        <h4 class="redo-stem" v-html="formatMathText(redoItem.stem || redoItem.text || '（未保存题干）')"></h4>
        <div v-if="redoIsChoice" class="redo-options">
          <button
            v-for="(option, index) in redoOptions"
            :key="`${index}-${option}`"
            type="button"
            class="redo-option"
            :class="redoOptionClass(index)"
            :disabled="Boolean(redoResult)"
            @click="chooseRedo(index)"
          >
            <strong>{{ 'ABCD'[index] }}</strong><span v-html="formatMathText(option)"></span>
          </button>
        </div>
        <div v-else class="redo-self">
          <p>这道题不在这里自动判分，先在纸上做完，再如实自评</p>
          <div class="redo-self-actions">
            <el-button type="success" plain :disabled="Boolean(redoResult)" @click="judgeRedo(true)">我做对了</el-button>
            <el-button type="danger" plain :disabled="Boolean(redoResult)" @click="judgeRedo(false)">还是不会</el-button>
          </div>
        </div>
        <div v-if="redoResult" class="redo-feedback" :class="redoResult">
          <strong v-if="redoResult === 'correct' && redoFixedNow">连续 {{ AUTO_FIX_STREAK }} 次答对，这道题已自动消灭</strong>
          <strong v-else-if="redoResult === 'correct' && redoItem.fixedAt">答对了，这道题之前已经消灭过</strong>
          <strong v-else-if="redoResult === 'correct'">答对了，已连续答对 {{ redoStreak }} 次；再答对 {{ redoRemaining }} 次就会自动消灭</strong>
          <strong v-else>这次还没对，连续答对记录已重置，看完解析再安排一次复习</strong>
          <p v-if="redoItem.correctAnswer">正确答案：<span v-html="formatMathText(redoItem.correctAnswer)"></span></p>
          <p v-if="redoItem.explanation" v-html="formatMathText(redoItem.explanation)"></p>
          <p v-if="!redoHasNext && redoQueue.length" class="redo-session-done">
            这一组 {{ redoQueue.length }} 道都过完了，答对 {{ redoSessionCorrect }} 道
          </p>
        </div>
      </template>
      <template #footer>
        <el-button v-if="!redoResult && redoHasNext" link class="redo-skip" @click="advanceRedo">跳过这道</el-button>
        <el-button @click="redoVisible = false">关闭</el-button>
        <el-button v-if="redoResult && redoHasNext" type="primary" class="redo-primary" @click="advanceRedo">下一道</el-button>
        <el-button v-else-if="redoResult && redoQueue.length" type="success" plain class="redo-primary" @click="redoVisible = false">这一组过完了</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="uploadVisible" title="上传错题照片" width="min(680px, 94vw)" class="mistake-upload-dialog">
      <div v-loading="uploadLoading" class="upload-dialog-body">
        <MistakeAttribution
          v-if="uploadVisible"
          form-only
          :grade="uploadProfile.grade"
          :subject="uploadProfile.subject"
          :edition="uploadProfile.edition"
          :chapters="uploadChapters"
          @saved="onUploadSaved"
        />
      </div>
    </el-dialog>
  </div>
</template>

<style scoped>
.mistakes-page{--mistake-deep:#2f6f5e;--mistake-button:#2f6f5e;--mistake-button-hover:#275f50;--mistake-line:#e2eeeb;--mistake-soft:#f4faf8;--mistake-warm:#fbf6ea;--mistake-warm-line:#e5c583;--mistake-warm-text:#96712f}
:root[data-theme='dark'] .mistakes-page{--mistake-deep:#6fb6b3;--mistake-button:#3e7172;--mistake-button-hover:#356363;--mistake-line:#37535b;--mistake-soft:#1d3037;--mistake-warm:rgba(238,167,123,.10);--mistake-warm-line:rgba(238,167,123,.5);--mistake-warm-text:#e2b37f}
.mistake-shell{display:grid;grid-template-columns:190px minmax(0,1fr);gap:38px;align-items:start}
.subject-rail{position:sticky;top:12px}
.subject-rail .eyebrow{display:flex;margin-bottom:22px;font-size:calc(11.5px*var(--fs-scale));letter-spacing:.16em;color:var(--primary)}
.rail-heading{margin:0 0 8px;font-size:calc(12px*var(--fs-scale));color:var(--muted);letter-spacing:.08em}
.rail-list{display:grid;gap:2px}
.rail-item{position:relative;display:grid;grid-template-columns:minmax(0,1fr) auto;align-items:center;gap:8px;padding:10px 0 12px;border:0;background:none;color:var(--muted);text-align:left;cursor:pointer;font-size:calc(14px*var(--fs-scale))}
.rail-item::before{content:'';position:absolute;left:-16px;top:8px;bottom:8px;width:3px;border-radius:999px;background:transparent}
.rail-item:hover{color:var(--text)}
.rail-item.active{color:var(--text);font-weight:700}
.rail-item.active::before{background:var(--mistake-button)}
.rail-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.rail-count{font-size:calc(12px*var(--fs-scale));font-variant-numeric:tabular-nums;color:var(--muted)}
.rail-meter{grid-column:1/-1;height:1px;margin-top:-2px;border-radius:999px;background:var(--mistake-line)}
.rail-item.active .rail-meter{background:var(--mistake-button)}
.mistake-main{min-width:0}
.topline{display:flex;justify-content:space-between;align-items:center;margin-bottom:10px}
.upload-button.el-button{height:38px;padding:0 18px;border-radius:999px;border-color:var(--mistake-button);background:var(--mistake-button);font-weight:700}
.upload-button.el-button:hover,.upload-button.el-button:focus{border-color:var(--mistake-button-hover);background:var(--mistake-button-hover)}
.mistake-hero{display:flex;justify-content:space-between;align-items:flex-end;gap:24px;margin-bottom:22px}
.mistake-hero h1{margin:0 0 8px;font-size:calc(31px*var(--fs-scale));line-height:1.3;letter-spacing:-.012em;font-weight:600}
.today-fixed{flex:none;display:grid;gap:2px;text-align:right}
.today-fixed span{font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.today-fixed strong{font-size:calc(26px*var(--fs-scale));line-height:1.1;font-weight:700;color:var(--mistake-deep);font-variant-numeric:tabular-nums}
.filter-bar{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:10px 0 12px;border-top:1px solid var(--mistake-line);border-bottom:1px solid var(--mistake-line);margin-bottom:12px}
.status-tabs{display:flex;gap:16px}
.status-tabs button{display:inline-flex;align-items:center;gap:5px;position:relative;padding:4px 0;border:0;background:none;color:var(--muted);font-size:calc(13px*var(--fs-scale));cursor:pointer}
.status-tabs button.active{color:var(--text);font-weight:700}
.status-tabs button.active::after{content:'';position:absolute;left:0;right:0;bottom:-13px;height:2px;background:var(--mistake-button)}
.tab-count{min-width:18px;padding:0 5px;border-radius:999px;background:var(--surface-soft);font-size:calc(10px*var(--fs-scale));font-weight:600;line-height:16px;text-align:center;color:var(--muted);font-variant-numeric:tabular-nums}
.status-tabs button.active .tab-count{background:var(--mistake-soft);color:var(--mistake-button)}
.filter-controls{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto}
.filter-controls .el-select{width:118px}
.filter-controls .mistake-search{width:200px}
.active-point{display:flex;align-items:center;gap:10px;margin:0 0 10px;font-size:calc(12px*var(--fs-scale));color:var(--mistake-deep)}
.active-point button{padding:0;border:0;background:none;color:var(--mistake-deep);font-size:calc(12px*var(--fs-scale));text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.subject-card{padding:0 24px 6px;border-radius:22px;overflow:visible}
.subject-card-head{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:20px 0 14px}
.subject-card-title h3{margin:0 0 4px;font-size:calc(17px*var(--fs-scale))}
.start-button.el-button{height:40px;padding:0 20px;border-radius:999px;border-color:var(--mistake-button);background:var(--mistake-button);font-weight:700}
.start-button.el-button:hover,.start-button.el-button:focus{border-color:var(--mistake-button-hover);background:var(--mistake-button-hover)}
.start-button.el-button.is-disabled,.start-button.el-button.is-disabled:hover{border-color:var(--border);background:var(--surface-soft);color:var(--muted)}
.table-head{display:grid;grid-template-columns:minmax(0,1fr) 56px 56px;gap:14px;padding:10px 0;border-top:1px solid var(--mistake-line);border-bottom:1px solid var(--mistake-line);font-size:calc(11px*var(--fs-scale));letter-spacing:.06em;color:var(--muted)}
.table-head span:nth-child(2),.table-head span:nth-child(3){text-align:center}
.mistake-list{display:grid}
.mistake-row{padding:16px 0;border-bottom:1px solid var(--mistake-line);border-radius:12px;transition:background .16s}
.mistake-row:last-child{border-bottom:0}
.mistake-row:hover{background:var(--mistake-soft)}
.mistake-row.fixed{opacity:.72}
.mistake-row.focused{background:var(--mistake-soft);box-shadow:-12px 0 0 var(--mistake-soft),12px 0 0 var(--mistake-soft)}
.row-grid{display:grid;grid-template-columns:minmax(0,1fr) 56px 56px;gap:14px;align-items:center;cursor:pointer}
.row-main-button{position:relative;display:grid;gap:4px;min-width:0;padding:0 20px 0 0;border:0;background:none;color:var(--text);text-align:left;cursor:pointer}
.row-title{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;font-size:calc(15px*var(--fs-scale));line-height:1.65;font-weight:650}
/* 展开后解除题干行数限制，长题也能在列表里读完整，不用再进重做弹窗。 */
.mistake-row.expanded .row-title{display:block;overflow:visible;-webkit-line-clamp:unset}
.row-sub{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.row-flags{display:flex;flex-wrap:wrap;gap:5px;margin-top:5px}
.row-flag{display:inline-block;padding:0 6px;border-radius:5px;font-style:normal;font-size:calc(10.5px*var(--fs-scale));line-height:1.65}
.row-flag.slip{background:rgba(217,138,84,.14);color:#a9623c}
.row-flag.hot{background:rgba(196,86,80,.14);color:#b3453f}
.row-caret{position:absolute;right:4px;top:9px;width:6px;height:6px;border-right:1.5px solid var(--muted);border-bottom:1.5px solid var(--muted);transform:rotate(45deg);transition:transform .18s ease}
.row-caret.open{top:12px;transform:rotate(-135deg)}
.wrong-count{justify-self:center;min-width:36px;padding:3px 7px;border-radius:999px;background:var(--surface-soft);text-align:center;font-size:calc(12px*var(--fs-scale));font-weight:600;color:var(--muted);font-variant-numeric:tabular-nums}
.wrong-count.hot{background:var(--mistake-warm);color:var(--mistake-warm-text)}
.redo-link{justify-self:center;padding:0;border:0;background:none;color:var(--mistake-deep);font-size:calc(13px*var(--fs-scale));font-weight:600;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.row-detail{display:grid;gap:10px;margin-top:14px;padding:14px;border-radius:14px;background:var(--mistake-soft)}
.detail-meta{display:flex;align-items:center;gap:8px;flex-wrap:wrap;font-size:calc(12px*var(--fs-scale))}
.detail-actions{display:flex;justify-content:flex-end;gap:8px;padding-top:2px}
.knowledge-tags{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.summary-label{flex:none;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.ai-analysis{padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface)}
.ai-analysis p{margin:0;font-size:calc(13px*var(--fs-scale));line-height:1.7}
/* 归因徽章与正文之间留一点间距，别贴着文字 */
.ai-analysis p :deep(.source-badge){margin:0 6px}
.ai-analysis p + p{margin-top:4px}
.answer-compare{display:grid;gap:4px;padding:10px 12px;border-radius:10px;background:var(--surface)}
.answer-compare p{margin:0;font-size:calc(13px*var(--fs-scale));line-height:1.7}
.record-explanation p{margin:6px 0 0;font-size:calc(13px*var(--fs-scale));line-height:1.8;color:var(--text)}
.explanation-toggle{padding:0;border:0;background:none;color:var(--primary);font-size:calc(12px*var(--fs-scale));cursor:pointer}
.mistake-empty{display:grid;gap:14px;justify-items:start;padding:46px 4px 50px;color:var(--muted);font-size:calc(14px*var(--fs-scale))}
.mistake-empty p{margin:0;line-height:1.7}
.empty-actions{display:flex;gap:10px;flex-wrap:wrap}
.insight-callout{display:flex;align-items:center;justify-content:space-between;gap:24px;margin-top:20px;padding:18px 22px;border-radius:16px;background:var(--mistake-warm);border-left:3px solid var(--mistake-warm-line)}
.insight-callout strong{display:block;margin-bottom:5px;font-size:calc(12px*var(--fs-scale));letter-spacing:.08em;color:var(--mistake-warm-text)}
.insight-callout p{margin:0;font-size:calc(14px*var(--fs-scale));line-height:1.75;color:var(--text)}
.insight-link{flex:none;padding:0;border:0;background:none;color:var(--mistake-warm-text);font-size:calc(13px*var(--fs-scale));font-weight:700;text-decoration:underline;text-underline-offset:3px;cursor:pointer}
.upload-dialog-body{min-height:220px}
.redo-progress{display:grid;gap:7px;margin-bottom:12px}
.redo-progress-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:calc(11px*var(--fs-scale));color:var(--muted)}
.redo-progress-head span:first-child{color:var(--text);font-weight:600}
.redo-progress-bar{height:4px;border-radius:999px;background:var(--border);overflow:hidden}
.redo-progress-bar i{display:block;height:100%;border-radius:999px;background:var(--primary);transition:width .25s ease}
.redo-meta{margin:0;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.redo-keyhint{color:var(--muted)}
.redo-stem{margin:10px 0 14px;font-size:calc(15px*var(--fs-scale));line-height:1.75}
.redo-options{display:grid;gap:8px}
.redo-option{display:flex;gap:10px;align-items:flex-start;padding:10px 12px;border:1px solid var(--border);border-radius:10px;background:var(--surface);text-align:left;font-size:calc(13px*var(--fs-scale));line-height:1.6;cursor:pointer}
.redo-option:disabled{cursor:default}
.redo-option strong{flex:none;width:18px;color:var(--muted)}
.redo-option.correct{border-color:#67c23a;background:rgba(103,194,58,.08)}
.redo-option.wrong{border-color:#f56c6c;background:rgba(245,108,108,.08)}
.redo-self{display:grid;gap:10px;font-size:calc(13px*var(--fs-scale));color:var(--muted)}
.redo-self p{margin:0}
.redo-self-actions{display:flex;gap:10px;flex-wrap:wrap}
.redo-feedback{margin-top:14px;padding:12px 14px;border-radius:12px;background:var(--surface-soft);font-size:calc(13px*var(--fs-scale));line-height:1.7}
.redo-feedback strong{display:block;margin-bottom:6px}
.redo-feedback.correct strong{color:#529b2e}
.redo-feedback.wrong strong{color:#c45656}
.redo-feedback p{margin:4px 0 0}
.redo-session-done{margin-top:8px !important;padding-top:8px;border-top:1px solid var(--border);font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.redo-dialog :deep(.el-dialog__footer){display:flex;align-items:center;justify-content:flex-end;gap:10px}
.redo-skip{margin-right:auto}
.point-panel{display:grid;gap:12px}
/* 左栏知识点分布：窄栏里环形图居中、图例竖排；全部学科和单科都显示。 */
.point-rail{margin-top:22px;padding-top:16px;border-top:1px solid var(--mistake-line)}
.point-rail .point-panel-head{font-size:calc(12px*var(--fs-scale));letter-spacing:.08em;color:var(--muted)}
.point-rail .point-panel-head strong{font-weight:650}
.point-rail .point-panel-head span{font-size:calc(11px*var(--fs-scale))}
.point-rail .point-chart{grid-template-columns:1fr;justify-items:center;gap:10px}
.point-rail .point-pie{width:104px;height:104px}
.point-rail .point-pie-center strong{font-size:calc(21px*var(--fs-scale))}
.point-rail .point-legend{width:100%;max-height:134px}
.point-rail .point-legend-item{padding:5px 2px;gap:6px}
.point-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;font-size:calc(14px*var(--fs-scale))}
.point-panel-head span{font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.point-chart{display:grid;grid-template-columns:116px minmax(0,1fr);align-items:center;gap:14px}
.point-pie{position:relative;width:116px;height:116px}
.point-pie svg{display:block;width:100%;height:100%}
.point-pie-center{position:absolute;inset:0;display:grid;place-content:center;justify-items:center;pointer-events:none}
.point-pie-center strong{font-size:calc(24px*var(--fs-scale));line-height:1;font-variant-numeric:tabular-nums;color:var(--mistake-deep)}
.point-pie-center span{margin-top:3px;font-size:calc(10px*var(--fs-scale));letter-spacing:.08em;color:var(--muted)}
.point-legend{display:grid;gap:1px;min-width:0}
/* 知识点一多，图例在自身区域内滚动查看：左栏高度固定，页面不会被拉成长条。
   滚动才出现细滚动条和底部渐隐；滚到底撤掉渐隐，最后一行不会被蒙住，
   注意别加 scrollbar-width：Chrome 一旦读到它就会改用系统滚动条，把这里写的 4px 覆盖掉， */
.point-legend.is-scroll{overflow-y:auto}
.point-legend.is-scroll::-webkit-scrollbar{width:5px}
.point-legend.is-scroll::-webkit-scrollbar-thumb{background:#CDD8D1;border-radius:999px}
.point-legend.is-scroll::-webkit-scrollbar-thumb:hover{background:#B9C7BF}
.point-legend.is-scroll::-webkit-scrollbar-track{background:transparent}
.point-legend.is-scroll:not(.is-end){-webkit-mask-image:linear-gradient(to bottom,#000 calc(100% - 13px),transparent);mask-image:linear-gradient(to bottom,#000 calc(100% - 13px),transparent)}
.point-legend-item{display:grid;grid-template-columns:8px minmax(0,1fr) auto;align-items:center;gap:8px;padding:6px;border:0;border-radius:8px;background:none;color:var(--text);font-size:calc(12px*var(--fs-scale));text-align:left;cursor:pointer}
.point-legend-item:hover,.point-legend-item.active{background:var(--surface-soft)}
.point-legend-item.active .point-legend-name{font-weight:700;color:var(--mistake-deep)}
.point-legend-item:disabled{cursor:default;opacity:.7}
.point-legend-item i{width:8px;height:8px;border-radius:50%}
/* 知识点名字太长就换行展示，最多两行，不再用省略号截断；圆点、名称、数量三者垂直居中。 */
.point-legend-name{display:-webkit-box;overflow:hidden;-webkit-line-clamp:2;-webkit-box-orient:vertical;line-height:1.45;word-break:break-word}
.point-legend-count{font-size:calc(11px*var(--fs-scale));color:var(--muted);font-variant-numeric:tabular-nums}
.point-empty{margin:0;font-size:calc(12px*var(--fs-scale));color:var(--muted)}
@media(max-width:900px){
  .mistake-shell{grid-template-columns:1fr;gap:14px}
  .subject-rail{position:static;padding-top:0}
  .subject-rail .eyebrow{display:none}
  .rail-heading{margin-bottom:6px}
  .rail-list{display:flex;gap:8px;overflow-x:auto;padding:0 0 6px;scrollbar-width:none}
  .rail-list::-webkit-scrollbar{display:none}
  .rail-item{flex:none;grid-template-columns:auto auto;gap:6px;padding:7px 12px;border:1px solid var(--border);border-radius:999px;background:var(--surface);font-size:calc(13px*var(--fs-scale))}
  .rail-item::before,.rail-meter{display:none}
  .rail-item.active{border-color:var(--mistake-button);background:var(--mistake-soft);color:var(--mistake-button)}
  .topline{margin-bottom:10px}
  .upload-button.el-button{height:36px;padding:0 16px;font-size:calc(13px*var(--fs-scale))}
  .mistake-hero{align-items:flex-start;gap:14px;margin-bottom:18px}
  .mistake-hero h1{font-size:calc(26px*var(--fs-scale))}
  .today-fixed strong{font-size:calc(22px*var(--fs-scale))}
  .filter-bar{gap:10px;padding:8px 0 10px}
  .status-tabs{width:100%;gap:14px;overflow-x:auto}
  .status-tabs button.active::after{bottom:-9px}
  .filter-controls{width:100%;margin-left:0}
  .filter-controls .mistake-search{display:block;flex:1 0 100%;width:100%}
  .filter-controls .el-select{flex:1;width:auto;min-width:0}
  .subject-card{padding:0 14px 4px;border-radius:18px}
  .subject-card-head{flex-direction:column;align-items:stretch;gap:10px;padding:16px 0 12px}
  .start-button.el-button{width:100%;height:38px}
  .table-head,.row-grid{grid-template-columns:minmax(0,1fr) 42px 46px;gap:8px}
  .table-head{font-size:calc(10px*var(--fs-scale))}
  .row-title{font-size:calc(14px*var(--fs-scale));-webkit-line-clamp:3}
  .row-sub{white-space:normal;line-height:1.5}
  .wrong-count{font-size:calc(12px*var(--fs-scale))}
  .redo-link{font-size:calc(12px*var(--fs-scale))}
  .point-rail{margin-top:16px;padding-top:12px}
  .point-rail .point-chart{grid-template-columns:104px minmax(0,1fr);justify-items:stretch;gap:12px}
  .insight-callout{flex-direction:column;align-items:flex-start;gap:10px;margin-top:14px;padding:16px}
}
</style>
