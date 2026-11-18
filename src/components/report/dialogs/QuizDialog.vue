<script setup>
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { generatePracticeQuestions } from '../../../services/api.js'
import { saveMistake } from '../../../db/index.js'
import { gradeQuestion } from '../../../utils/quiz.js'
import { formatMathText } from '../../../utils/formatMath.js'

// 补强练习弹窗：走本地题库（15 秒超时），当场判分，答错顺手写进错题库。
// 支持单选 / 多选 / 填空 / 解答：解答题不自动判分，只给参考答案对照。
const props = defineProps({
  open: { type: Boolean, default: false },
  chapterId: { type: String, default: '' },
  chapterName: { type: String, default: '' },
  grade: { type: String, default: '' },
  subject: { type: String, default: '' },
  edition: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const LETTERS = 'ABCDEFGH'
const dialog = ref(null)
const loading = ref(false)
const error = ref('')
const questions = ref([])
const index = ref(0)
const chosen = ref(null)
const fillAnswer = ref('')
const feedback = ref(null)
const current = computed(() => questions.value[index.value] || null)
const finished = computed(() => questions.value.length > 0 && index.value >= questions.value.length)

const hasOptions = computed(() => Array.isArray(current.value?.options) && current.value.options.length > 0)
const isMultiple = computed(() => current.value?.type === 'multiple')
const isFill = computed(() => current.value?.type === 'fill')
const isShort = computed(() => !hasOptions.value && !isFill.value)
const correctIndexes = computed(() => {
  const question = current.value || {}
  return Array.isArray(question.correctIndexes) ? question.correctIndexes.map(Number) : [Number(question.correctIndex)]
})
const referenceAnswer = computed(() => current.value?.referenceAnswer || current.value?.answer || (current.value?.acceptableAnswers || [])[0] || '')

watch(() => props.open, open => {
  if (!dialog.value) return
  if (open) {
    if (!dialog.value.open) dialog.value.showModal()
    load()
  } else if (dialog.value.open) {
    dialog.value.close()
  }
})

function closeDialog() { dialog.value?.close() }

async function load() {
  if (!props.chapterName) return
  loading.value = true
  error.value = ''
  questions.value = []
  index.value = 0
  resetAnswer()
  const result = await generatePracticeQuestions({
    grade: props.grade,
    subject: props.subject,
    name: `${props.chapterName} 补强练习`,
    knowledgeTags: [props.chapterName]
  })
  loading.value = false
  if (!result.success) { error.value = result.error || '题目生成暂时不可用'; return }
  questions.value = result.data?.questions || []
  if (!questions.value.length) error.value = '这个专题暂时没有可用的练习题'
}

function resetAnswer() {
  chosen.value = isMultiple.value ? [] : null
  fillAnswer.value = ''
  feedback.value = null
}

function pickOption(optionIndex) {
  if (feedback.value) return
  if (isMultiple.value) {
    const list = Array.isArray(chosen.value) ? [...chosen.value] : []
    const at = list.indexOf(optionIndex)
    if (at >= 0) list.splice(at, 1)
    else list.push(optionIndex)
    chosen.value = list
    return
  }
  chosen.value = optionIndex
}

function optionClass(optionIndex) {
  const picked = isMultiple.value
    ? Array.isArray(chosen.value) && chosen.value.includes(optionIndex)
    : chosen.value === optionIndex
  return {
    picked,
    right: Boolean(feedback.value) && feedback.value.correct !== null && correctIndexes.value.includes(optionIndex),
    wrong: Boolean(feedback.value) && feedback.value.correct === false && picked && !correctIndexes.value.includes(optionIndex)
  }
}

async function submit() {
  const question = current.value
  if (!question) return
  if (hasOptions.value) {
    const empty = isMultiple.value ? !Array.isArray(chosen.value) || !chosen.value.length : chosen.value === null
    if (empty) { ElMessage.info(isMultiple.value ? '至少选一个答案' : '先选一个答案'); return }
  } else if (isFill.value && !fillAnswer.value.trim()) {
    ElMessage.info('先填写答案'); return
  }
  // 解答题没有标准选择题可判，直接给参考答案对照。
  if (isShort.value) {
    feedback.value = { correct: null, reference: referenceAnswer.value, explanation: question.explanation || '' }
    return
  }
  const answer = hasOptions.value ? chosen.value : fillAnswer.value
  const verdict = gradeQuestion(question, answer)
  const correct = verdict.needsSelfGrade ? null : verdict.correct
  const correctText = hasOptions.value
    ? (isMultiple.value
      ? correctIndexes.value.map(item => LETTERS[item]).filter(Boolean).join('、')
      : (Number.isInteger(Number(question.correctIndex)) ? LETTERS[Number(question.correctIndex)] : ''))
    : (question.answer || (question.acceptableAnswers || [])[0] || '')
  feedback.value = {
    correct,
    correctText,
    reference: isFill.value ? correctText : '',
    explanation: question.explanation || ''
  }
  if (correct === false) await recordMistake(question, answer)
}

async function recordMistake(question, answer) {
  if (!props.chapterId) return
  try {
    const userAnswer = hasOptions.value
      ? (Array.isArray(answer) ? answer.map(i => LETTERS[i]).join('、') : (question.options || [])[Number(answer)] || '')
      : String(answer || '')
    const correctAnswer = hasOptions.value
      ? (question.options || [])[Number(question.correctIndex)] || ''
      : (question.answer || (question.acceptableAnswers || [])[0] || '')
    await saveMistake({
      id: `mistake-practice-${question.id}`,
      grade: props.grade,
      subject: props.subject,
      edition: props.edition,
      chapterId: props.chapterId,
      chapterName: props.chapterName,
      knowledgeTags: question.knowledgeTags || [props.chapterName],
      stem: question.stem,
      options: Array.isArray(question.options) ? question.options : [],
      correctIndex: Number.isInteger(Number(question.correctIndex)) ? Number(question.correctIndex) : null,
      userAnswer,
      correctAnswer,
      explanation: question.explanation || '',
      wrongCount: 1,
      redoHistory: [],
      status: 'open',
      createdAt: Date.now()
    })
  } catch { /* 错题入库失败不阻断判分 */ }
}

function next() { index.value += 1; resetAnswer() }
</script>

<template>
  <dialog ref="dialog" class="report-dialog" @close="emit('close')" @cancel.prevent="closeDialog">
    <div class="dlg-head">
      <div>
        <h3>章节测试 · {{ chapterName }}</h3>
        <p>用本地题库出题，做完立刻判分；答错会自动收进错题库</p>
      </div>
      <button class="dlg-x" type="button" aria-label="关闭" @click="closeDialog">×</button>
    </div>
    <div class="dlg-body">
      <p v-if="loading" class="dlg-tip">正在从本地题库取题…</p>
      <p v-else-if="error" class="dlg-tip">{{ error }}</p>
      <p v-else-if="finished" class="dlg-tip">这组题做完了，错题已同步到错题库，可以回到报告继续下一步</p>
      <template v-else-if="current">
        <div class="q-meta">
          <span class="idx">第 {{ index + 1 }} 题 / 共 {{ questions.length }} 题</span>
          <span class="tag">{{ current.chapterName || chapterName }}</span>
          <span class="tag">{{ isShort ? '解答题' : isFill ? '填空题' : isMultiple ? '多选题' : '单选题' }}</span>
        </div>
        <p class="q-stem" v-html="formatMathText(current.stem)"></p>

        <div v-if="hasOptions" class="opt-list">
          <button
            v-for="(option, optionIndex) in current.options"
            :key="optionIndex"
            type="button"
            class="opt"
            :class="optionClass(optionIndex)"
            :disabled="Boolean(feedback)"
            @click="pickOption(optionIndex)"
          >
            <span class="k">{{ LETTERS[optionIndex] }}</span>
            <span v-html="formatMathText(option)"></span>
          </button>
        </div>
        <div v-else-if="isFill" class="fill-row">
          <input v-model="fillAnswer" class="fill-input" type="text" placeholder="在这里填写答案" :disabled="Boolean(feedback)" @keyup.enter="submit" />
        </div>
        <div v-else class="short-row">
          <textarea v-model="fillAnswer" class="short-input" rows="3" placeholder="可以先写下自己的答案，再对照参考答案" :disabled="Boolean(feedback)"></textarea>
        </div>

        <div v-if="feedback" class="fb" :data-tone="feedback.correct === false ? 'no' : feedback.correct === true ? 'ok' : 'self'">
          <template v-if="feedback.correct === true"><b>答对了</b></template>
          <template v-else-if="feedback.correct === false"><b>答错了</b>，正确答案是 {{ feedback.correctText || '见解析' }}</template>
          <template v-else><b>参考答案</b>{{ feedback.reference ? `：${feedback.reference}` : '见下方解析' }}</template>
          <span class="fb-ex" v-html="formatMathText(feedback.explanation)"></span>
        </div>
      </template>
    </div>
    <div class="dlg-foot">
      <span class="hint">本次 {{ questions.length || 0 }} 题</span>
      <span class="spacer"></span>
      <button class="btn" type="button" @click="closeDialog">关闭</button>
      <button v-if="current && !feedback" class="btn btn-primary" type="button" @click="submit">{{ isShort ? '看参考答案' : '提交这题' }}</button>
      <button v-else-if="current && feedback && index < questions.length - 1" class="btn btn-primary" type="button" @click="next">下一题</button>
      <button v-else-if="feedback" class="btn btn-primary" type="button" @click="closeDialog">完成</button>
    </div>
  </dialog>
</template>

<style scoped>
.report-dialog{border:0;padding:0;border-radius:16px;max-width:520px;width:calc(100vw - 40px);box-shadow:0 24px 64px rgba(28,46,42,.2);color:var(--text);background:var(--surface,#fff)}
.report-dialog::backdrop{background:rgba(28,45,41,.44)}
.dlg-head{display:flex;align-items:flex-start;gap:12px;padding:16px 18px 12px;border-bottom:1px solid var(--border-soft,#eef4f1)}
.dlg-head h3{margin:0;font-size:14.5px;font-weight:600;line-height:1.4}
.dlg-head p{margin:2px 0 0;font-size:11.5px;color:var(--faint,#7f938d)}
.dlg-x{margin-left:auto;flex:none;width:26px;height:26px;border-radius:7px;border:1px solid var(--border);background:var(--surface,#fff);color:var(--muted);font-size:14px;line-height:1;display:grid;place-items:center;cursor:pointer}
.dlg-body{padding:14px 18px 16px;max-height:min(64vh,520px);overflow:auto}
.dlg-tip{margin:0;font-size:12.5px;color:var(--muted);line-height:1.7}
.dlg-foot{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--border-soft,#eef4f1);background:var(--surface-soft)}
.dlg-foot .spacer{flex:1 1 auto}
.dlg-foot .hint{font-size:11px;color:#9aaba6}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:9px;font-size:12.5px;font-weight:500;border:1px solid var(--border);background:var(--surface,#fff);color:var(--text);font-family:inherit;cursor:pointer}
.btn-primary{border-color:var(--primary);background:var(--primary);color:#fff;font-weight:600}
.q-meta{display:flex;align-items:center;gap:8px;margin-bottom:10px;flex-wrap:wrap}
.q-meta .tag{padding:1px 7px;border-radius:5px;font-size:10.5px;background:rgba(77,129,122,.1);color:#4a756d}
.q-meta .idx{font-size:11.5px;color:#9aaba6;font-variant-numeric:tabular-nums}
.q-stem{font-size:13.5px;line-height:1.75;margin:0 0 12px;white-space:pre-line}
.opt-list{display:grid;gap:7px}
.opt{display:flex;align-items:flex-start;gap:9px;padding:9px 11px;border-radius:9px;border:1px solid var(--border);background:var(--surface,#fff);font-size:13px;line-height:1.5;text-align:left;font-family:inherit;cursor:pointer;transition:border-color .16s,background .16s}
.opt:hover:not(:disabled){border-color:#bcd2cb;background:#fbfdfc}
.opt .k{width:19px;height:19px;border-radius:5px;flex:none;margin-top:1px;display:grid;place-items:center;background:var(--surface-soft);border:1px solid var(--border-soft);font-size:10.5px;font-weight:600;color:var(--faint)}
.opt.picked{border-color:#9dbfb6;background:#f7fbf9}
.opt.picked .k{background:var(--primary);border-color:var(--primary);color:#fff}
.opt.right{border-color:#8fbfa9;background:#f1f9f5}
.opt.right .k{background:#3d8f74;border-color:#3d8f74;color:#fff}
.opt.wrong{border-color:#d9b39c;background:#fdf4ee}
.opt.wrong .k{background:#b5734a;border-color:#b5734a;color:#fff}
.fill-row,.short-row{margin:0 0 4px}
.fill-input,.short-input{width:100%;padding:9px 11px;border:1px solid var(--border);border-radius:9px;background:var(--surface,#fff);color:var(--text);font-family:inherit;font-size:13px;line-height:1.6;outline:none}
.fill-input:focus,.short-input:focus{border-color:var(--primary);box-shadow:0 0 0 2px rgba(77,129,122,.12)}
.short-input{resize:vertical;min-height:76px}
.fb{margin-top:12px;padding:11px 13px;border-radius:10px;font-size:12.5px;line-height:1.65}
.fb[data-tone="ok"]{background:#f1f9f5;border:1px solid #bfdcd0;color:#2f5f57}
.fb[data-tone="no"]{background:#fdf4ee;border:1px solid #e5cdbb;color:#8a5334}
.fb[data-tone="self"]{background:var(--surface-soft);border:1px solid var(--border)}
.fb b{font-weight:600}
.fb .fb-ex{display:block;margin-top:5px;color:var(--muted);font-size:12px;white-space:pre-line}
</style>
