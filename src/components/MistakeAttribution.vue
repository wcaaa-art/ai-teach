<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { analyzeMistake, extractQuestion, prewarmOcr } from '../services/api.js'
import { deleteMistake, loadMistakes, makeId, saveMistake } from '../db/index.js'
import { bilibiliSearchUrl } from '../utils/videos.js'

const props = defineProps({
  grade: { type: String, default: '' },
  subject: { type: String, default: '' },
  edition: { type: String, default: '' },
  chapters: { type: Array, default: () => [] },
  // 嵌到错题库弹窗时只保留上传表单，避免和错题库自己的列表、统计重复。
  formOnly: { type: Boolean, default: false }
})
const emit = defineEmits(['saved'])

const file = ref(null)
const previewUrl = ref('')
const recognizedText = ref('')
const chapterId = ref('')
const ocrLoading = ref(false)
const ocrReady = ref(false)
const saving = ref(false)
const analyzing = ref(false)
const mistakes = ref([])

const subjectMistakes = computed(() => mistakes.value
  .filter(item => item.subject === props.subject && item.grade === props.grade)
  .sort((left, right) => right.createdAt - left.createdAt))
// 按章节聚合错题：错得最多的章节就是当前最该补的短板。
const weakness = computed(() => {
  const counter = new Map()
  for (const item of subjectMistakes.value) {
    const key = item.chapterId || item.chapterName
    const current = counter.get(key) || { chapterId: item.chapterId, chapterName: item.chapterName, count: 0 }
    current.count += 1
    counter.set(key, current)
  }
  return [...counter.values()].sort((left, right) => right.count - left.count)
})
const suggestion = computed(() => {
  if (!weakness.value.length) return ''
  const names = weakness.value.slice(0, 2).map(item => `${item.chapterName}（${item.count} 题）`).join('、')
  return `当前错题集中在${names}，建议先补这些章节：回看教材定义，再做 3–5 道同类变式，最后用章节测试验证。`
})

async function reload() {
  mistakes.value = await loadMistakes()
}

watch(() => [props.grade, props.subject], reload, { immediate: true })
onMounted(() => {
  // 空闲时预热识别模型，避免学生点了“识别”才开始下载中文字库。
  const start = () => prewarmOcr().then(ready => { ocrReady.value = ready })
  if ('requestIdleCallback' in window) window.requestIdleCallback(start, { timeout: 4000 })
  else setTimeout(start, 1500)
})
onBeforeUnmount(() => { if (previewUrl.value) URL.revokeObjectURL(previewUrl.value) })

function handleFile(uploadFile) {
  const raw = uploadFile?.raw
  if (!raw) return
  if (!raw.type.startsWith('image/')) return ElMessage.warning('请上传题目照片或截图。')
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = raw
  previewUrl.value = URL.createObjectURL(raw)
  recognizedText.value = ''
}

async function recognize() {
  if (!file.value || ocrLoading.value) return
  ocrLoading.value = true
  const result = await extractQuestion(file.value)
  ocrLoading.value = false
  if (result.success && result.data?.text) {
    recognizedText.value = result.data.text.slice(0, 800)
    ElMessage.success('识别完成，可以手动修改文字。')
  } else {
    ElMessage.warning(result.error || '识别失败，可直接手写题干后保存。')
  }
}

async function save() {
  if (!props.subject || !props.grade) return ElMessage.warning('请先选择年级和科目。')
  const chapter = props.chapters.find(item => item.id === chapterId.value)
  if (!chapter) return ElMessage.warning('请选择这道题对应的章节。')
  const text = recognizedText.value.trim()
  if (!previewUrl.value && !text) return ElMessage.warning('请上传题目照片，或填写题干。')
  saving.value = true
  // 有题干时先让 AI 打知识点标签、推测错因；模型不可用时后端返回本地兜底，不阻塞保存。
  analyzing.value = true
  let analysis = {}
  let analysisSource = 'local'
  if (text) {
    const result = await analyzeMistake({
      grade: props.grade, subject: props.subject, edition: props.edition,
      chapterName: chapter.name, text
    })
    analysis = result.success ? result.data || {} : {}
    analysisSource = result.source || 'local'
  }
  analyzing.value = false
  // 只保存识别出的文字与章节归因，题目照片留在本机内存中，不写库。
  await saveMistake({
    id: makeId('mistake'), grade: props.grade, subject: props.subject, edition: props.edition,
    chapterId: chapter.id, chapterName: chapter.name, text, createdAt: Date.now(),
    knowledgeTags: Array.isArray(analysis.knowledgeTags) && analysis.knowledgeTags.length ? analysis.knowledgeTags : [chapter.name],
    errorCause: analysis.errorCause || `本题属于「${chapter.name}」。仅凭题干无法确定具体出错环节，建议对照答案回看是哪一步出错。`,
    analysisSuggestion: analysis.suggestion || `先回看「${chapter.name}」的定义与例题，再做 3 道同类题。`,
    analysisSource
  })
  saving.value = false
  await reload()
  emit('saved')
  ElMessage.success('已记入错题归因，长短板会按章节重新统计。')
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
  file.value = null
  previewUrl.value = ''
  recognizedText.value = ''
  chapterId.value = ''
}

async function remove(id) {
  await deleteMistake(id)
  await reload()
}

function videoUrl(item) {
  return bilibiliSearchUrl({ edition: props.edition, grade: props.grade, subject: props.subject, chapter: item.chapterName })
}
</script>

<template>
  <div class="mistake-card" :class="{ 'is-embedded': formOnly }">
    <div class="mistake-head">
      <div><span class="eyebrow">错题归因</span><strong>上传错题照片，按章节找出长短板</strong><p class="muted">识别只在本机执行，照片不上传；系统只保存识别文字与章节，用来统计薄弱章节并给出补强建议。</p></div>
      <el-tag effect="plain">{{ subjectMistakes.length }} 道错题</el-tag>
    </div>
    <div class="mistake-form">
      <div class="mistake-upload">
        <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" :on-change="handleFile">
          <el-button plain>{{ previewUrl ? '换一张照片' : '选择题目照片' }}</el-button>
        </el-upload>
        <img v-if="previewUrl" :src="previewUrl" class="mistake-preview" alt="错题照片预览" />
      </div>
      <div class="mistake-fields">
        <div class="mistake-row">
          <el-select v-model="chapterId" placeholder="选择对应章节" filterable :disabled="!chapters.length">
            <el-option v-for="chapter in chapters" :key="chapter.id" :label="chapter.name" :value="chapter.id" />
          </el-select>
          <el-button :loading="ocrLoading" :disabled="!file" @click="recognize">{{ ocrReady ? '识别题目文字' : '识别题目文字（首次需加载模型）' }}</el-button>
        </div>
        <el-input v-model="recognizedText" type="textarea" :rows="3" maxlength="800" placeholder="识别出的题干会出现在这里，识别不准可以直接改；不识别也可以只选章节保存。" />
        <div class="mistake-actions"><el-button type="primary" :loading="saving" @click="save">{{ analyzing ? 'AI 分析中…' : '保存这道错题' }}</el-button><span class="muted">{{ analyzing ? '正在生成知识点标签与错因分析…' : '保存后立即参与下方统计' }}</span></div>
      </div>
    </div>
    <p v-if="!formOnly && suggestion" class="mistake-suggestion">{{ suggestion }}</p>
    <div v-if="!formOnly && subjectMistakes.length" class="mistake-summary">
      <div class="weakness-list">
        <span class="summary-label">薄弱章节</span>
        <div v-for="item in weakness.slice(0, 4)" :key="item.chapterName" class="weakness-item">
          <span>{{ item.chapterName }}<em>{{ item.count }} 题</em></span>
          <a :href="videoUrl(item)" target="_blank" rel="noopener noreferrer">看视频补强</a>
        </div>
      </div>
      <ul class="mistake-list">
        <li v-for="item in subjectMistakes.slice(0, 3)" :key="item.id">
          <div><strong>{{ item.chapterName }}</strong><p class="muted">{{ item.text ? item.text.slice(0, 60) : '仅记录章节，未保存题干文字' }}</p></div>
          <el-button link type="danger" @click="remove(item.id)">删除</el-button>
        </li>
      </ul>
    </div>
    <p v-else-if="!formOnly" class="muted mistake-empty">还没有错题记录。上传第一道错题后，这里会给出按章节统计的薄弱点与补强建议。</p>
  </div>
</template>

<style scoped>
.mistake-card{margin-top:18px;padding:18px 20px;border:1px solid var(--border);border-radius:14px;background:var(--surface-soft)}
/* 嵌进错题库弹窗：去掉外层卡片感，弹窗自己已经有边距和背景。 */
.mistake-card.is-embedded{margin-top:0;padding:0;border:0;border-radius:0;background:transparent}
.mistake-head{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
.mistake-head strong{display:block;margin:4px 0 6px;font-size:calc(15px*var(--fs-scale))}
.mistake-head p{margin:0;font-size:calc(12px*var(--fs-scale));line-height:1.6;max-width:640px}
.mistake-form{display:grid;grid-template-columns:180px 1fr;gap:16px;margin-top:14px}
.mistake-upload{display:grid;gap:8px;justify-items:start}
.mistake-preview{width:160px;height:110px;object-fit:cover;border-radius:10px;border:1px solid var(--border)}
.mistake-fields{display:grid;gap:10px}
.mistake-row{display:flex;gap:8px;flex-wrap:wrap}
.mistake-row .el-select{max-width:260px}
.mistake-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.mistake-actions .muted{font-size:calc(12px*var(--fs-scale))}
.mistake-suggestion{margin:14px 0 0;padding:10px 12px;border-radius:10px;background:var(--primary-soft);color:var(--primary);font-size:calc(13px*var(--fs-scale));line-height:1.6}
.mistake-summary{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-top:14px}
.weakness-list{display:grid;gap:8px;align-content:start}
.summary-label{font-size:calc(12px*var(--fs-scale));color:var(--muted)}
.weakness-item{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:10px;background:var(--surface)}
.weakness-item span{font-size:calc(13px*var(--fs-scale))}
.weakness-item em{margin-left:6px;font-style:normal;font-size:calc(11px*var(--fs-scale));color:var(--muted)}
.weakness-item a{flex:none;font-size:calc(12px*var(--fs-scale));font-weight:600;color:var(--primary);text-decoration:none;padding:3px 10px;border:1px solid var(--primary);border-radius:999px}
.weakness-item a:hover{background:var(--primary-soft)}
.mistake-list{list-style:none;margin:0;padding:0;display:grid;gap:8px;align-content:start}
.mistake-list li{display:flex;align-items:flex-start;justify-content:space-between;gap:10px;padding:8px 10px;border-radius:10px;background:var(--surface)}
.mistake-list strong{font-size:calc(13px*var(--fs-scale))}
.mistake-list p{margin:3px 0 0;font-size:calc(12px*var(--fs-scale));line-height:1.5}
.mistake-empty{font-size:calc(12px*var(--fs-scale));margin:12px 0 0}
@media(max-width:850px){.mistake-form{grid-template-columns:1fr}.mistake-summary{grid-template-columns:1fr}}
</style>
