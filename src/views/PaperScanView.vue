<script setup>
// 试卷拍照识别：本地 OCR 读取整页文字，AI 拆成题目，核对后可保存并开始练习。
import { computed, onMounted, ref, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { extractQuestion, getCurriculumSubjects, parsePaperText } from '../services/api.js'
import { deleteScannedPaper, loadScannedPapers, makeId, saveScannedPaper } from '../db/index.js'
import { formatMathText } from '../utils/formatMath.js'

const router = useRouter()
const MAX_PHOTOS = 6
const gradeOptions = ref([])
const subjectOptions = ref([])
const grade = ref('')
const subject = ref('')
const photos = ref([])
const photoInput = ref(null)
const ocrRunning = ref(false)
const ocrProgress = ref('')
const ocrText = ref('')
const parsing = ref(false)
const questions = ref([])
const paperTitle = ref('')
const parseSource = ref('')
const paperId = ref('')
const paperCreatedAt = ref(0)
const recent = ref([])
const saving = ref(false)

const typeLabels = { single: '单选', fill: '填空', short: '解答' }
const canOcr = computed(() => photos.value.length > 0 && !ocrRunning.value && !parsing.value)
const canParse = computed(() => ocrText.value.trim().length >= 20 && !parsing.value && !ocrRunning.value)

async function loadCatalog() {
  const response = await getCurriculumSubjects('初中')
  gradeOptions.value = response.data?.grades || []
  grade.value = gradeOptions.value[0] || '初二'
  await refreshSubjects()
}

async function refreshSubjects() {
  const response = await getCurriculumSubjects('初中', grade.value)
  subjectOptions.value = response.data?.subjects || []
  if (!subjectOptions.value.includes(subject.value)) subject.value = subjectOptions.value[0] || ''
}

watch(grade, refreshSubjects)

async function loadRecent() {
  const list = await loadScannedPapers()
  recent.value = list.sort((left, right) => (right.updatedAt || 0) - (left.updatedAt || 0)).slice(0, 8)
}

onMounted(async () => {
  await loadCatalog()
  await loadRecent()
})

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result || ''))
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.readAsDataURL(file)
  })
}

// 预览只留压缩图，OCR 仍然用原图，避免压缩后小字识别率下降。
async function compressImage(file) {
  const raw = await readFileAsDataUrl(file)
  try {
    const image = await new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = raw
    })
    const scale = Math.min(1, 1600 / Math.max(image.width, image.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.width * scale)
    canvas.height = Math.round(image.height * scale)
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  } catch { return raw }
}

async function onPhotoChange(event) {
  const files = [...(event.target.files || [])]
  event.target.value = ''
  for (const file of files) {
    if (photos.value.length >= MAX_PHOTOS) { ElMessage.info(`最多识别 ${MAX_PHOTOS} 页，先删掉不需要的页。`); break }
    if (!file.type.startsWith('image/')) continue
    photos.value.push({
      id: makeId('page'),
      file,
      name: file.name,
      dataUrl: await compressImage(file),
      status: 'ready',
      text: '',
      error: ''
    })
  }
}

function removePhoto(photo) {
  photos.value = photos.value.filter(item => item.id !== photo.id)
  ocrText.value = photos.value.map((item, index) => item.text ? `【第 ${index + 1} 页】\n${item.text}` : '').filter(Boolean).join('\n\n')
}

async function runOcr() {
  if (!photos.value.length || ocrRunning.value) return
  ocrRunning.value = true
  try {
    for (const [index, photo] of photos.value.entries()) {
      if (photo.text) { photo.status = 'done'; continue }
      photo.status = 'ocr'
      photo.error = ''
      ocrProgress.value = `正在识别第 ${index + 1} / ${photos.value.length} 页…`
      // 整页文字比单题照片多，给识别留更长时间。
      const response = await extractQuestion(photo.file, { timeoutMs: 120000 })
      const text = String(response.data?.text || '').trim()
      if (response.success && text) {
        photo.text = text
        photo.status = 'done'
      } else {
        photo.status = 'error'
        photo.error = response.error || '没有识别到文字'
      }
    }
    ocrText.value = photos.value.map((photo, index) => photo.text ? `【第 ${index + 1} 页】\n${photo.text}` : '').filter(Boolean).join('\n\n')
    if (!ocrText.value) ElMessage.error('没有识别到文字，请换清晰照片或手动输入。')
    else ElMessage.success('文字识别完成，先改掉错字再拆题。')
  } finally {
    ocrRunning.value = false
    ocrProgress.value = ''
  }
}

async function parseQuestions() {
  if (!canParse.value) return
  parsing.value = true
  const response = await parsePaperText({ text: ocrText.value, grade: grade.value, subject: subject.value })
  parsing.value = false
  if (!response.success) { ElMessage.error(response.error || '拆题失败，请稍后重试。'); return }
  const list = Array.isArray(response.data?.questions) ? response.data.questions : []
  if (!list.length) { ElMessage.warning('没有拆出题目，可能是文字太乱；请先修正识别文字。'); return }
  questions.value = list.map(question => ({
    ...question,
    options: Array.isArray(question.options) ? question.options : [],
    answer: question.answer || ''
  }))
  paperTitle.value = response.data?.title || `${grade.value}${subject.value}试卷`
  parseSource.value = response.data?.notice || (response.source === 'local-fallback' ? '本地按题号拆分，答案需重点核对' : 'AI 拆分')
  paperId.value = ''
  paperCreatedAt.value = 0
  ElMessage.success(`已拆出 ${list.length} 道题，请逐题核对题干、选项和答案。`)
}

function typeLabel(type) { return typeLabels[type] || '解答' }
function letter(index) { return String.fromCharCode(65 + Number(index)) }
function syncAnswer(question) { if (question.correctIndex >= 0) question.answer = letter(question.correctIndex) }
function hasAnswer(question) { return question.type === 'single' ? question.correctIndex >= 0 : Boolean(String(question.answer || '').trim()) }
function removeQuestion(index) { questions.value.splice(index, 1) }

async function savePaper(showMessage = true) {
  const list = questions.value.filter(question => String(question.stem || '').trim().length >= 4)
  if (!list.length) { ElMessage.info('还没有可保存的题目。'); return '' }
  saving.value = true
  try {
    const id = paperId.value || makeId('scan')
    const now = Date.now()
    await saveScannedPaper({
      id,
      title: paperTitle.value.trim() || `${grade.value}${subject.value}试卷`,
      grade: grade.value,
      subject: subject.value,
      questions: JSON.parse(JSON.stringify(list)),
      createdAt: paperCreatedAt.value || now,
      updatedAt: now
    })
    paperId.value = id
    paperCreatedAt.value = paperCreatedAt.value || now
    await loadRecent()
    if (showMessage) ElMessage.success('已保存到试卷库，下次可以直接接着练。')
    return id
  } finally {
    saving.value = false
  }
}

async function startPractice() {
  const id = await savePaper(false)
  if (!id) return
  router.push(`/quiz?scan=${id}`)
}

function openRecent(paper) { router.push(`/quiz?scan=${paper.id}`) }

async function removeRecent(paper) {
  try {
    await ElMessageBox.confirm(`删除「${paper.title}」？识别结果和练习记录会一起移除。`, '删除试卷', {
      confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'
    })
  } catch { return }
  await deleteScannedPaper(paper.id)
  if (paperId.value === paper.id) paperId.value = ''
  await loadRecent()
  ElMessage.success('已删除。')
}

async function resetScan() {
  if (photos.value.length || questions.value.length) {
    try {
      await ElMessageBox.confirm('清空当前照片和识别结果？已保存到试卷库的记录不会受影响。', '清空重来', {
        confirmButtonText: '清空', cancelButtonText: '取消', type: 'warning'
      })
    } catch { return }
  }
  photos.value = []
  ocrText.value = ''
  questions.value = []
  paperTitle.value = ''
  parseSource.value = ''
  paperId.value = ''
  paperCreatedAt.value = 0
}

function formatDate(value) {
  if (!value) return ''
  return new Date(value).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
}
</script>

<template>
  <div class="page paper-scan-page">
    <div class="page-header">
      <div>
        <span class="eyebrow">试卷拍照识别</span>
        <h2 class="page-title">试卷拍照识别</h2>
        <p class="page-subtitle">拍下整张试卷，OCR 读出题干，AI 拆成可练习的题目。识别结果会先给你核对，再开始练习。</p>
      </div>
      <el-button plain @click="resetScan">清空重来</el-button>
    </div>

    <section class="surface surface-pad scan-setup">
      <label class="scan-field"><span>年级</span><el-select v-model="grade" placeholder="选择年级"><el-option v-for="item in gradeOptions" :key="item" :label="item" :value="item" /></el-select></label>
      <label class="scan-field"><span>科目</span><el-select v-model="subject" placeholder="选择科目"><el-option v-for="item in subjectOptions" :key="item" :label="item" :value="item" /></el-select></label>
      <div class="scan-upload">
        <input ref="photoInput" type="file" accept="image/*" multiple capture="environment" hidden @change="onPhotoChange">
        <el-button type="primary" plain :disabled="photos.length >= MAX_PHOTOS" @click="photoInput?.click()">拍照 / 上传</el-button>
        <span class="muted">最多 {{ MAX_PHOTOS }} 页，尽量正对试卷、光线均匀。</span>
      </div>
    </section>

    <section v-if="photos.length" class="surface surface-pad">
      <div class="scan-section-head">
        <div><h3>已选 {{ photos.length }} 页</h3><p class="muted">先识别文字，再交给 AI 拆题；识别慢时可以先改文字。</p></div>
        <el-button type="primary" :loading="ocrRunning" :disabled="!canOcr" @click="runOcr">开始识别文字</el-button>
      </div>
      <p v-if="ocrProgress" class="muted">{{ ocrProgress }}</p>
      <div class="photo-grid">
        <div v-for="photo in photos" :key="photo.id" class="photo-card">
          <img :src="photo.dataUrl" :alt="photo.name">
          <el-button class="photo-remove" size="small" circle @click="removePhoto(photo)">×</el-button>
          <div class="photo-meta">
            <span class="photo-name">{{ photo.name || '试卷照片' }}</span>
            <span class="photo-status" :class="photo.status">{{ photo.status === 'ocr' ? '识别中…' : photo.status === 'done' ? '已识别' : photo.status === 'error' ? `失败：${photo.error}` : '待识别' }}</span>
          </div>
        </div>
      </div>
    </section>

    <section v-if="ocrText" class="surface surface-pad">
      <div class="scan-section-head">
        <div><h3>识别文字</h3><p class="muted">OCR 可能有错字或公式丢失，先修正再拆题，成功率更高。</p></div>
        <el-button type="primary" :loading="parsing" :disabled="!canParse" @click="parseQuestions">AI 拆成题目</el-button>
      </div>
      <el-input v-model="ocrText" type="textarea" :rows="8" placeholder="识别出的试卷文字" />
    </section>

    <section v-if="questions.length" class="surface surface-pad">
      <div class="scan-section-head">
        <div>
          <h3>{{ paperTitle }}</h3>
          <p class="muted">共 {{ questions.length }} 题 · {{ parseSource }}</p>
        </div>
        <div class="scan-actions">
          <el-button :loading="saving" @click="savePaper()">保存到试卷库</el-button>
          <el-button type="primary" :loading="saving" @click="startPractice">开始练习</el-button>
        </div>
      </div>
      <el-alert type="warning" :closable="false" show-icon title="AI 识别和答案仅供参考，请先核对题干、选项与答案；答案不确定的题会改成自评题。" />
      <el-collapse class="scan-questions">
        <el-collapse-item v-for="(question, index) in questions" :key="question.id" :name="question.id">
          <template #title>
            <div class="scan-question-title">
              <el-tag size="small" effect="plain">{{ typeLabel(question.type) }}</el-tag>
              <span class="scan-stem" v-html="formatMathText(question.stem)"></span>
              <el-tag v-if="!hasAnswer(question)" size="small" type="warning" effect="plain">答案待核对</el-tag>
            </div>
          </template>
          <div class="scan-edit">
            <el-input v-model="question.stem" type="textarea" :rows="3" placeholder="题干" />
            <div v-if="question.type === 'single' && question.options.length" class="scan-options">
              <label v-for="(option, optionIndex) in question.options" :key="optionIndex">
                <input v-model="question.correctIndex" type="radio" :value="optionIndex" @change="syncAnswer(question)">
                <span>{{ letter(optionIndex) }}. {{ option }}</span>
              </label>
            </div>
            <div class="scan-edit-row">
              <el-input v-model="question.answer" placeholder="参考答案" />
              <el-input v-model="question.explanation" placeholder="解析（可选）" />
            </div>
            <div class="scan-edit-row">
              <span class="muted">第 {{ index + 1 }} 题 · {{ question.score }} 分</span>
              <el-button text type="danger" @click="removeQuestion(index)">删除此题</el-button>
            </div>
          </div>
        </el-collapse-item>
      </el-collapse>
    </section>

    <section v-if="recent.length" class="surface surface-pad">
      <div class="scan-section-head"><div><h3>最近识别的试卷</h3><p class="muted">保存在本机，点开可直接练习。</p></div></div>
      <article v-for="paper in recent" :key="paper.id" class="scan-recent">
        <div>
          <strong>{{ paper.title }}</strong>
          <p class="muted">{{ paper.grade }} {{ paper.subject }} · {{ paper.questions?.length || 0 }} 题 · {{ formatDate(paper.updatedAt) }}</p>
        </div>
        <div class="scan-actions">
          <el-button text type="primary" @click="openRecent(paper)">继续练习</el-button>
          <el-button text type="danger" @click="removeRecent(paper)">删除</el-button>
        </div>
      </article>
    </section>
  </div>
</template>

<style scoped>
.paper-scan-page { display: grid; gap: 16px; }
.scan-setup { display: flex; flex-wrap: wrap; align-items: end; gap: 16px; }
.scan-field { display: grid; gap: 6px; font-size:calc(12px*var(--fs-scale)); color: var(--muted); }
.scan-field :deep(.el-select) { width: 150px; }
.scan-upload { display: flex; align-items: center; gap: 10px; margin-left: auto; }
.scan-section-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 12px; }
.scan-section-head h3 { margin: 0 0 4px; }
.scan-actions { display: flex; gap: 8px; flex-wrap: wrap; }
.photo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; }
.photo-card { position: relative; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: var(--surface-soft); }
.photo-card img { display: block; width: 100%; height: 110px; object-fit: cover; }
.photo-remove { position: absolute; top: 6px; right: 6px; }
.photo-meta { display: grid; gap: 3px; padding: 8px; font-size:calc(12px*var(--fs-scale)); }
.photo-name { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.photo-status { color: var(--muted); }
.photo-status.done { color: var(--success); }
.photo-status.error { color: var(--danger); }
.scan-questions { margin-top: 12px; }
.scan-question-title { display: flex; align-items: center; gap: 8px; min-width: 0; padding-right: 8px; }
.scan-stem { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.scan-edit { display: grid; gap: 10px; padding: 4px 2px 10px; }
.scan-edit-row { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; }
.scan-options { display: grid; gap: 6px; padding: 8px 10px; border: 1px dashed var(--border); border-radius: 10px; }
.scan-options label { display: flex; align-items: center; gap: 8px; font-size:calc(13px*var(--fs-scale)); }
.scan-recent { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 10px 0; border-bottom: 1px solid var(--border); }
.scan-recent:last-child { border-bottom: 0; }
.scan-recent p { margin: 3px 0 0; }
@media (max-width: 700px) {
  .scan-upload { width: 100%; margin-left: 0; }
  .scan-field :deep(.el-select) { width: 120px; }
  .scan-recent { align-items: flex-start; flex-direction: column; }
}
</style>
