// 学习计划「练习/做题」窗口：本地题库秒出题 → 作答 → 批改 → 逐题解析。
// 与章节测试不同：这里不选章节（计划已确定知识点）、不调模型（题库/本地兜底），
// 点到做完一气呵成；答错的题写进错题库复用复习机制。
<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRoute, useRouter } from 'vue-router'
import { generatePracticeQuestions, extractQuestion, prewarmOcr } from '../services/api.js'
import { loadPlans, loadProfile, loadMistakes, saveMistake } from '../db/index.js'
import { computeQuizSummary } from '../utils/quiz.js'
import { formatMathText } from '../utils/formatMath.js'
import StudyTimer from '../components/StudyTimer.vue'
import QuestionOptions from '../components/QuestionOptions.vue'

const route = useRoute()
const router = useRouter()

const plan = ref(null)
const loading = ref(true)
const errorMessage = ref('')
const questions = ref([])
const chapterName = ref('')
const source = ref('')

// 作答状态：单选/填空存值，解答题另存文本。
const answers = reactive({})
const selfGrades = reactive({})
const startedAt = ref(0)
const submitted = ref(false)
const resultSummary = ref(null)
const submitting = ref(false)

// 手写作答：拍照/上传后只在本机保存，OCR 识别是可选的辅助手段，识别结果可手动改。
const answerImages = reactive({})
const ocrLoading = reactive({})
const photoFiles = new Map()
const photoTarget = ref('')
const photoInput = ref(null)

function optionLabel(index) { return String.fromCharCode(65 + Number(index)) }
function typeLabel(type) { return { single: '单项选择', multiple: '多项选择', fill: '填空', short: '解答' }[type] || '客观题' }

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

function correctText(question) {
  if (question.type === 'single') {
    const index = Number(question.correctIndex)
    return question.options?.[index] ? `${optionLabel(index)}. ${question.options[index]}` : '未提供'
  }
  if (question.type === 'fill') {
    const extra = (question.acceptableAnswers || []).filter(item => item !== question.answer)
    return `${question.answer}${extra.length ? `（也可写：${extra.join(' / ')}）` : ''}`
  }
  return question.referenceAnswer || '未提供参考答案'
}

function isOptionCorrect(question, index) {
  return Number(question.correctIndex) === index
}

// 回顾页把选项铺开：正解标绿、错选标红，和错题库/测验回顾同一套展示。
function correctOptionIndexes(question) {
  if (Array.isArray(question.correctIndexes) && question.correctIndexes.length) return question.correctIndexes.map(Number)
  const index = Number(question.correctIndex)
  return Number.isInteger(index) && index >= 0 ? [index] : []
}
function chosenOptionIndexes(question) {
  const value = answers[question.id]
  if (question.type === 'multiple') return Array.isArray(value) ? value.map(Number) : []
  if (value === undefined || value === null || value === '') return []
  const index = Number(value)
  return Number.isInteger(index) ? [index] : []
}

function explanationRows(question) {
  const text = String(question.explanation || '').trim() || '这道题暂未提供解析。'
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^([A-H])[.、:：)]\s*(.*)$/)
    if (!match) return { label: '', text: line, verdict: '' }
    const index = 'ABCDEFGH'.indexOf(match[1])
    return { label: match[1], text: match[2], verdict: isOptionCorrect(question, index) ? 'right' : 'wrong' }
  })
}

const answeredCount = computed(() => questions.value.filter(question => {
  const value = answers[question.id]
  const hasPhoto = Boolean(answerImages[question.id]?.dataUrl)
  if (question.type === 'single') return Number.isInteger(Number(value))
  if (question.type === 'multiple') return Array.isArray(value) && value.length > 0
  return String(value ?? '').trim() || hasPhoto
}).length)
const progress = computed(() => questions.value.length ? Math.round(answeredCount.value / questions.value.length * 100) : 0)

async function load() {
  const planId = String(route.query.planId || '')
  const plans = await loadPlans()
  const found = plans.find(item => item.id === planId) || null
  if (!found) { errorMessage.value = '没找到这条计划'; loading.value = false; return }
  plan.value = found
  startedAt.value = Date.now()
  const profile = await loadProfile().catch(() => null)
  const grade = found.grade || profile?.grade || '初三'
  const result = await generatePracticeQuestions({
    grade,
    subject: found.subject,
    name: found.name,
    knowledgeTags: found.knowledgeTags || []
  })
  if (!result?.success || !result.data?.questions?.length) {
    errorMessage.value = result?.data?.message || '本地题库没找到这道练习的题目，换一个计划试试。'
    loading.value = false
    return
  }
  questions.value = result.data.questions
  chapterName.value = result.data.chapter?.name || found.name
  source.value = result.data.source || ''
  loading.value = false
}

function toggleSingle(question, index) {
  if (submitted.value) return
  answers[question.id] = index
}

function setSelfGrade(question, grade) {
  selfGrades[question.id] = grade
}

function pickPhoto(question) {
  if (submitted.value) return
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

// 长边压到 1280 再存，避免整张原图把内存撑爆。
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
  let file = photoFiles.get(question.id)
  if (!file && answerImages[question.id]?.dataUrl) {
    try {
      const blob = await (await fetch(answerImages[question.id].dataUrl)).blob()
      file = new File([blob], answerImages[question.id].name || 'answer.jpg', { type: blob.type || 'image/jpeg' })
      photoFiles.set(question.id, file)
    } catch { /* 转 File 失败时按没有原始照片处理 */ }
  }
  if (!file) { ElMessage.info('没有可识别的手写稿，请重新上传。'); return }
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
    ElMessage.success('已识别并填入，手写内容可能有误，请核对后再提交。')
  } finally {
    ocrLoading[question.id] = false
  }
}

async function submit() {
  if (submitted.value) return
  const unanswered = questions.value.filter(question => {
    const value = answers[question.id]
    const hasPhoto = Boolean(answerImages[question.id]?.dataUrl)
    if (question.type === 'single') return !Number.isInteger(Number(value))
    if (question.type === 'multiple') return !(Array.isArray(value) && value.length > 0)
    return !String(value ?? '').trim() && !hasPhoto
  })
  if (unanswered.length) {
    ElMessage.warning(`还有 ${unanswered.length} 题没做，做完再交。`)
    return
  }
  submitting.value = true
  const summary = computeQuizSummary({ questions: questions.value, answers, selfGrades })
  resultSummary.value = summary
  submitted.value = true
  await syncMistakes(summary)
  submitting.value = false
}

async function syncMistakes(summary) {
  if (!plan.value) return
  const stored = await loadMistakes()
  const existingById = new Map(stored.map(item => [item.id, item]))
  const now = Date.now()
  for (const row of summary.perQuestion) {
    const question = questions.value.find(q => q.id === row.questionId)
    if (!question) continue
    const wrong = row.needsSelfGrade ? (row.selfGrade !== null && row.selfGrade < 1) : row.correct === false
    if (!wrong) continue
    const mistakeId = `mistake-practice-${plan.value.subject}-${question.id}`
    const existing = existingById.get(mistakeId)
    await saveMistake({
      ...(existing || {}),
      id: mistakeId,
      grade: plan.value.grade || '初三',
      subject: plan.value.subject,
      chapterId: question.chapterId || '',
      chapterName: question.chapterName || chapterName.value,
      text: question.stem, stem: question.stem, type: question.type, options: question.options || [],
      correctIndex: Number.isInteger(Number(question.correctIndex)) ? Number(question.correctIndex) : -1,
      userAnswer: answerText(question, answers[question.id]),
      correctAnswer: correctText(question),
      explanation: question.explanation || '',
      source: existing?.source || 'practice',
      questionId: question.id,
      wrongCount: (existing?.wrongCount || 0) + 1,
      lastWrongAt: now,
      fixedAt: null,
      createdAt: existing?.createdAt || now
    })
  }
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

function backToPlans() {
  router.push({ name: 'plans' })
}

// 完成后把计划标记为完成，并回到计划页。
async function finishAndBack() {
  if (plan.value) {
    const { savePlan } = await import('../db/index.js')
    await savePlan({ ...plan.value, completedAt: Date.now() })
  }
  backToPlans()
}

onMounted(() => {
  load()
  // 空闲时预热本地识别模型，避免学生点了「识别成文字」才开始下载中文字库。
  const start = () => prewarmOcr().catch(() => {})
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 })
  else setTimeout(start, 1500)
})
</script>

<template>
  <div class="practice-page">
    <input ref="photoInput" type="file" accept="image/*" class="pq-photo-input" @change="onPhotoChange" />
    <header class="practice-top">
      <button type="button" class="practice-back" @click="backToPlans"><span aria-hidden="true">←</span> 学习计划</button>
      <div class="practice-title-wrap">
        <p class="practice-eyebrow">{{ plan?.subject || '' }} · 练习做题</p>
        <h1 class="practice-title">{{ plan?.name || '练习' }}</h1>
      </div>
      <StudyTimer />
    </header>

    <!-- 加载中 -->
    <div v-if="loading" class="practice-loading">
      <p>正在从本地题库出题…</p>
    </div>

    <!-- 出错 -->
    <div v-else-if="errorMessage" class="practice-empty">
      <p>{{ errorMessage }}</p>
      <button type="button" class="btn-primary" @click="backToPlans">回到计划</button>
    </div>

    <!-- 做题 -->
    <template v-else-if="!submitted">
      <div class="practice-bar">
        <span>{{ chapterName }}</span>
        <span>共 {{ questions.length }} 题</span>
        <span>已做 {{ answeredCount }}</span>
        <div class="practice-track"><i :style="{ width: progress + '%' }"></i></div>
      </div>

      <div class="practice-list">
        <article v-for="(question, index) in questions" :key="question.id" class="pq-card">
          <header class="pq-head">
            <span class="pq-no">{{ index + 1 }}</span>
            <span class="pq-type">{{ typeLabel(question.type) }}</span>
            <span v-if="question.score" class="pq-score">{{ question.score }} 分</span>
          </header>
          <p class="pq-stem" v-html="formatMathText(question.stem)"></p>

          <!-- 单选 -->
          <div v-if="question.type === 'single'" class="pq-options">
            <button
              v-for="(option, oi) in question.options"
              :key="oi"
              type="button"
              class="pq-option"
              :class="{ on: Number(answers[question.id]) === oi }"
              @click="toggleSingle(question, oi)"
            >
              <span class="pq-opt-label">{{ optionLabel(oi) }}</span>
              <span v-html="formatMathText(option)"></span>
            </button>
          </div>

          <!-- 填空 -->
          <div v-else-if="question.type === 'fill'" class="pq-fill">
            <input
              v-model="answers[question.id]"
              type="text"
              class="pq-input"
              :disabled="submitted"
              placeholder="把答案填在这里"
            />
            <div class="pq-photo-row">
              <button type="button" class="pq-photo-btn" @click="pickPhoto(question)">{{ answerImages[question.id] ? '重新上传手写稿' : '拍照 / 上传手写稿' }}</button>
              <button v-if="answerImages[question.id]" type="button" class="pq-photo-btn" :disabled="ocrLoading[question.id]" @click="recognizePhoto(question)">{{ ocrLoading[question.id] ? '识别中…' : '识别成文字' }}</button>
              <button v-if="answerImages[question.id]" type="button" class="pq-photo-remove" @click="removePhoto(question)">删除照片</button>
              <span class="pq-photo-note">照片只保存在本机，不会上传服务器</span>
            </div>
            <img v-if="answerImages[question.id]" class="pq-photo-preview" :src="answerImages[question.id].dataUrl" :alt="`第 ${index + 1} 题手写稿`" />
          </div>

          <!-- 解答 -->
          <div v-else class="pq-short">
            <textarea
              v-model="answers[question.id]"
              class="pq-textarea"
              rows="4"
              :disabled="submitted"
              placeholder="写下你的解题过程或答案"
            ></textarea>
            <div class="pq-photo-row">
              <button type="button" class="pq-photo-btn" @click="pickPhoto(question)">{{ answerImages[question.id] ? '重新上传手写稿' : '拍照 / 上传手写稿' }}</button>
              <button v-if="answerImages[question.id]" type="button" class="pq-photo-btn" :disabled="ocrLoading[question.id]" @click="recognizePhoto(question)">{{ ocrLoading[question.id] ? '识别中…' : '识别成文字' }}</button>
              <button v-if="answerImages[question.id]" type="button" class="pq-photo-remove" @click="removePhoto(question)">删除照片</button>
              <span class="pq-photo-note">照片只保存在本机，不会上传服务器</span>
            </div>
            <img v-if="answerImages[question.id]" class="pq-photo-preview" :src="answerImages[question.id].dataUrl" :alt="`第 ${index + 1} 题手写稿`" />
          </div>
        </article>
      </div>

      <div class="practice-footer">
        <button type="button" class="btn-primary" :disabled="submitting" @click="submit">
          {{ submitting ? '正在批改…' : '提交并批改' }}
        </button>
      </div>
    </template>

    <!-- 批改结果 -->
    <template v-else>
      <div class="practice-result-head">
        <div class="result-score">
          <strong>{{ resultSummary?.earned || 0 }}</strong>
          <span>/ {{ resultSummary?.totalMax || 0 }} 分</span>
        </div>
        <div class="result-meta">
          <p>正确率 {{ Math.round((resultSummary?.accuracy || 0) * 100) }}%</p>
          <p>客观题对 {{ resultSummary?.objectiveCorrect || 0 }} / {{ resultSummary?.objectiveCount || 0 }}</p>
        </div>
        <button type="button" class="btn-primary" @click="finishAndBack">完成并回到计划</button>
      </div>

      <div class="practice-list">
        <article
          v-for="(question, index) in questions"
          :key="question.id"
          class="review-card"
          :class="reviewClass(resultSummary?.perQuestion?.find(row => row.questionId === question.id) || {})"
        >
          <header class="pq-head">
            <span class="pq-no">{{ index + 1 }}</span>
            <span class="pq-type">{{ typeLabel(question.type) }}</span>
            <el-tag size="small" :type="reviewTag(resultSummary?.perQuestion?.find(row => row.questionId === question.id) || {}).type">
              {{ reviewTag(resultSummary?.perQuestion?.find(row => row.questionId === question.id) || {}).text }}
            </el-tag>
          </header>
          <p class="pq-stem" v-html="formatMathText(question.stem)"></p>

          <div class="review-answer">
            <QuestionOptions
              v-if="question.options?.length"
              :options="question.options"
              :correct="correctOptionIndexes(question)"
              :chosen="chosenOptionIndexes(question)"
            />
            <p><span class="ra-label">你的答案</span> {{ answerText(question, answers[question.id]) }}</p>
            <p class="ra-correct"><span class="ra-label">正确答案</span> {{ correctText(question) }}</p>
            <img v-if="answerImages[question.id]" class="pq-photo-preview" :src="answerImages[question.id].dataUrl" :alt="`第 ${index + 1} 题手写稿`" />
          </div>

          <!-- 解答题自评（提交后） -->
          <div v-if="question.type === 'short'" class="self-grade-row">
            <span>这道题你掌握得怎么样？</span>
            <button type="button" class="sg-btn" :class="{ on: selfGrades[question.id] === 1 }" @click="setSelfGrade(question, 1)">对</button>
            <button type="button" class="sg-btn" :class="{ on: selfGrades[question.id] === 0.5 }" @click="setSelfGrade(question, 0.5)">半对</button>
            <button type="button" class="sg-btn" :class="{ on: selfGrades[question.id] === 0 }" @click="setSelfGrade(question, 0)">错</button>
          </div>

          <div class="review-explain">
            <p class="rex-label">解析</p>
            <p v-for="(row, ri) in explanationRows(question)" :key="ri" class="rex-line" :class="row.verdict">
              <b v-if="row.label">{{ row.label }}</b><span v-html="formatMathText(row.text)"></span>
            </p>
          </div>
        </article>
      </div>

      <div class="practice-footer">
        <button type="button" class="btn-primary" @click="finishAndBack">完成并回到计划</button>
      </div>
    </template>
  </div>
</template>

<style scoped>
/* 局部色板接到全局 token，深色模式自动跟随，不再是独立的旧青绿纸张色。 */
.practice-page{--pq-deep:var(--primary-deep);--pq-mint:var(--primary-soft);--pq-line:var(--border);--pq-soft:var(--surface-soft);--pq-ink:var(--text);--pq-muted:var(--muted);padding:22px 32px 40px;max-width:760px;margin:0 auto;color:var(--pq-ink)}
.practice-top{display:flex;align-items:center;gap:16px;margin-bottom:18px}
.practice-back{display:inline-flex;align-items:center;gap:6px;padding:6px 12px;border:1px solid var(--pq-line);border-radius:999px;background:#fff;color:var(--pq-muted);font-size:12.5px;font-weight:600;cursor:pointer}
.practice-title-wrap{flex:1;min-width:0}
.practice-eyebrow{margin:0;font-size:11.5px;font-weight:600;letter-spacing:.06em;color:var(--pq-deep)}
.practice-title{margin:2px 0 0;font-size:20px;line-height:1.3}
.practice-loading,.practice-empty{display:grid;place-items:center;gap:12px;min-height:40vh;color:var(--pq-muted);text-align:center}
.practice-bar{display:flex;align-items:center;gap:16px;font-size:12px;color:var(--pq-muted);margin-bottom:16px;font-variant-numeric:tabular-nums}
.practice-track{flex:1;height:3px;border-radius:2px;background:var(--pq-line);overflow:hidden}
.practice-track i{display:block;height:100%;background:var(--pq-deep);border-radius:2px;transition:width .2s ease}
.practice-list{display:grid;gap:14px}
.pq-card,.review-card{padding:16px 18px;border:1px solid var(--pq-line);border-radius:16px;background:#fff}
.pq-head{display:flex;align-items:center;gap:10px;margin-bottom:10px}
.pq-no{display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;background:var(--pq-mint);color:var(--pq-deep);font-size:12px;font-weight:700}
.pq-type{font-size:11.5px;color:var(--pq-muted)}
.pq-score{margin-left:auto;font-size:11.5px;color:var(--pq-muted)}
.pq-stem{margin:0 0 12px;font-size:15px;line-height:1.7}
.pq-options{display:grid;gap:8px}
.pq-option{display:flex;align-items:flex-start;gap:10px;padding:10px 12px;border:1px solid var(--pq-line);border-radius:10px;background:#fff;text-align:left;cursor:pointer;transition:border-color .15s,background .15s;font-size:14px;line-height:1.6}
.pq-option:hover{border-color:var(--pq-deep)}
.pq-option.on{border-color:var(--pq-deep);background:var(--pq-soft)}
.pq-opt-label{flex:none;display:inline-grid;place-items:center;width:22px;height:22px;border-radius:50%;border:1px solid var(--pq-line);font-size:12px;font-weight:700}
.pq-option.on .pq-opt-label{background:var(--pq-deep);color:#fff;border-color:var(--pq-deep)}
.pq-input,.pq-textarea{width:100%;padding:10px 12px;border:1px solid var(--pq-line);border-radius:10px;background:var(--pq-soft);color:var(--pq-ink);font-size:14px;line-height:1.7;outline:none;resize:none}
.pq-input:focus,.pq-textarea:focus{border-color:var(--pq-deep);background:#fff}
.pq-photo-input{display:none}
.pq-photo-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-top:8px}
.pq-photo-btn{padding:5px 12px;border:1px solid var(--pq-line);border-radius:999px;background:#fff;color:var(--pq-deep);font-size:12px;font-weight:600;cursor:pointer;transition:border-color .15s,background .15s}
.pq-photo-btn:hover{border-color:var(--pq-deep);background:var(--pq-soft)}
.pq-photo-btn:disabled{opacity:.6;cursor:not-allowed}
.pq-photo-remove{padding:5px 10px;border:0;background:transparent;color:#a85f4f;font-size:12px;cursor:pointer}
.pq-photo-remove:hover{text-decoration:underline}
.pq-photo-note{font-size:11px;color:var(--pq-muted)}
.pq-photo-preview{display:block;max-width:260px;max-height:220px;margin-top:8px;border:1px solid var(--pq-line);border-radius:10px;background:#fff}
.practice-footer{position:sticky;bottom:12px;display:flex;justify-content:center;margin-top:18px}
.btn-primary{padding:11px 26px;border:0;border-radius:12px;background:var(--pq-deep);color:#fff;font-size:14.5px;font-weight:700;cursor:pointer;transition:background .15s}
.btn-primary:hover{background:#254842}
.btn-primary:disabled{opacity:.6;cursor:not-allowed}
.practice-result-head{display:flex;align-items:center;gap:20px;padding:16px 18px;border:1px solid var(--pq-line);border-radius:16px;background:#fff;margin-bottom:14px}
.result-score{display:flex;align-items:baseline;gap:6px}
.result-score strong{font-size:32px;color:var(--pq-deep)}
.result-score span{font-size:13px;color:var(--pq-muted)}
.result-meta{flex:1}
.result-meta p{margin:2px 0;font-size:12.5px;color:var(--pq-muted)}
.review-card.correct{border-left:4px solid #5f9179}
.review-card.wrong{border-left:4px solid #b96b63}
.review-card.partial{border-left:4px solid #d9a441}
.review-card.self-check{border-left:4px solid #9aa7b4}
.review-answer{margin:0 0 10px;padding:10px 12px;border-radius:10px;background:var(--pq-soft)}
.review-answer p{margin:3px 0;font-size:13.5px;line-height:1.6}
.review-answer .ra-correct{color:#3f6b52}
.ra-label{font-size:11.5px;color:var(--pq-muted);margin-right:4px}
.self-grade-row{display:flex;align-items:center;gap:8px;margin:0 0 10px;font-size:12.5px;color:var(--pq-muted)}
.sg-btn{padding:5px 12px;border:1px solid var(--pq-line);border-radius:999px;background:#fff;font-size:12.5px;font-weight:600;cursor:pointer}
.sg-btn.on{border-color:var(--pq-deep);background:var(--pq-deep);color:#fff}
.review-explain{padding-top:10px;border-top:1px dashed var(--pq-line)}
.rex-label{margin:0 0 6px;font-size:11.5px;font-weight:700;color:var(--pq-muted)}
.rex-line{margin:3px 0;font-size:13px;line-height:1.7;color:var(--pq-ink)}
.rex-line b{margin-right:6px;color:var(--pq-deep)}
.rex-line.right{color:#3f6b52}
.rex-line.wrong{color:#a85f4f}

/* 深色模式：页面本地色板跟随全局 token，避免浅纸卡在深底上发白。 */
:global(:root[data-theme='dark'] .practice-page){--pq-deep:#7fb5ab;--pq-mint:#24423c;--pq-line:#2f4741;--pq-soft:#172724;--pq-ink:#e6f0ec;--pq-muted:#a3b8b2}
</style>
