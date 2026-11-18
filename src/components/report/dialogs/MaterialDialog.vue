<script setup>
import { ref, watch } from 'vue'
import { getChapterMaterials } from '../../../services/api.js'

// 知识卡弹窗：直接读本机知识库的章节讲解，不联网也能看。
// lesson.formulas 是 [{ name, expr, note }]，必须逐条渲染，不能直接 join。
const props = defineProps({
  open: { type: Boolean, default: false },
  chapterId: { type: String, default: '' },
  chapterName: { type: String, default: '' },
  grade: { type: String, default: '' },
  subject: { type: String, default: '' },
  edition: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const dialog = ref(null)
const loading = ref(false)
const error = ref('')
const sections = ref([])
const formulas = ref([])

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

function normalizeFormula(item) {
  if (typeof item === 'string') return { name: '', expr: item, note: '' }
  return { name: item?.name || '', expr: item?.expr || item?.formula || '', note: item?.note || '' }
}

async function load() {
  if (!props.chapterId) return
  loading.value = true
  error.value = ''
  sections.value = []
  formulas.value = []
  const result = await getChapterMaterials({
    grade: props.grade, subject: props.subject, edition: props.edition, chapterId: props.chapterId
  })
  loading.value = false
  if (!result.success) { error.value = result.error || '知识卡暂时不可用'; return }
  const data = result.data || {}
  const lesson = data.lesson || {}
  sections.value = [
    { title: '这一节在讲什么', body: lesson.intro || '' },
    { title: '要抓住的三点', body: (lesson.points || []).map((point, index) => `${index + 1}. ${point}`).join('\n') }
  ].filter(section => section.body)
  formulas.value = (lesson.formulas || []).map(normalizeFormula).filter(item => item.expr)
  if (sections.value.length || formulas.value.length) return
  // 没有讲解包时退回章节资料里的短文，仍拿不到就明确提示，不编内容。
  const passage = (data.passages || [])[0]
  const body = passage ? (passage.text || passage.content || '') : ''
  if (body) sections.value = [{ title: passage.title || '章节资料', body }]
  if (!sections.value.length) error.value = '这个专题暂时没有知识卡，可以先看视频补强'
}
</script>

<template>
  <dialog ref="dialog" class="report-dialog" @close="emit('close')" @cancel.prevent="closeDialog">
    <div class="dlg-head">
      <div>
        <h3>知识卡 · {{ chapterName }}</h3>
        <p>来自本机知识库，不联网也能看</p>
      </div>
      <button class="dlg-x" type="button" aria-label="关闭" @click="closeDialog">×</button>
    </div>
    <div class="dlg-body">
      <p v-if="loading" class="dlg-tip">正在读取本地知识卡…</p>
      <template v-else-if="sections.length || formulas.length">
        <div v-for="section in sections" :key="section.title" class="doc-sec">
          <h4>{{ section.title }}</h4>
          <p>{{ section.body }}</p>
        </div>
        <div v-if="formulas.length" class="doc-sec">
          <h4>公式与易错</h4>
          <ul class="formula-list">
            <li v-for="(formula, index) in formulas" :key="index">
              <span v-if="formula.name" class="f-name">{{ formula.name }}</span>
              <span class="f-expr">{{ formula.expr }}</span>
              <span v-if="formula.note" class="f-note">{{ formula.note }}</span>
            </li>
          </ul>
        </div>
        <div v-else class="doc-sec">
          <h4>公式与易错</h4>
          <p>这一节没有需要单独记的公式，重点在判断规则和书写规范</p>
        </div>
      </template>
      <div v-else class="doc-empty">
        <p>{{ error }}</p>
        <p>先看「补强视频」里的讲解，再回来做题也可以</p>
      </div>
    </div>
    <div class="dlg-foot">
      <span class="hint">这份卡也收进了「学习资料」</span>
      <span class="spacer"></span>
      <button class="btn btn-primary" type="button" @click="closeDialog">知道了</button>
    </div>
  </dialog>
</template>

<style scoped>
.report-dialog{border:0;padding:0;border-radius:16px;max-width:560px;width:calc(100vw - 40px);box-shadow:0 24px 64px rgba(28,46,42,.2);color:var(--text);background:var(--surface,#fff)}
.report-dialog::backdrop{background:rgba(28,45,41,.44)}
.dlg-head{display:flex;align-items:flex-start;gap:12px;padding:16px 18px 12px;border-bottom:1px solid var(--border-soft,#eef4f1)}
.dlg-head h3{margin:0;font-size:15.5px;font-weight:600;line-height:1.4}
.dlg-head p{margin:2px 0 0;font-size:12px;color:var(--faint,#7f938d)}
.dlg-x{margin-left:auto;flex:none;width:26px;height:26px;border-radius:7px;border:1px solid var(--border);background:var(--surface,#fff);color:var(--muted);font-size:14px;line-height:1;display:grid;place-items:center;cursor:pointer}
.dlg-body{padding:16px 20px 18px;max-height:min(70vh,560px);overflow:auto}
.dlg-tip{margin:0;font-size:13.5px;color:var(--muted);line-height:1.7}
.dlg-foot{display:flex;align-items:center;gap:8px;padding:12px 18px;border-top:1px solid var(--border-soft,#eef4f1);background:var(--surface-soft)}
.dlg-foot .spacer{flex:1 1 auto}
.dlg-foot .hint{font-size:11.5px;color:#9aaba6}
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:9px;font-size:13px;font-weight:500;border:1px solid var(--border);background:var(--surface,#fff);color:var(--text);font-family:inherit;cursor:pointer}
.btn-primary{border-color:var(--primary);background:var(--primary);color:#fff;font-weight:600}
.doc-sec{margin-bottom:16px}
.doc-sec:last-child{margin-bottom:0}
.doc-sec h4{margin:0 0 6px;font-size:13px;font-weight:600;color:var(--faint,#7f938d);letter-spacing:.04em;display:flex;align-items:center;gap:6px}
.doc-sec h4::before{content:'';width:4px;height:4px;border-radius:50%;background:#a8bdb7}
.doc-sec p{margin:0;font-size:14px;line-height:1.85;color:var(--text);white-space:pre-line}
.formula-list{list-style:none;margin:0;padding:0;display:grid;gap:8px}
.formula-list li{display:grid;gap:3px;padding:9px 12px;border-radius:10px;background:var(--surface-soft);border:1px solid var(--border-soft,#eef4f1)}
.f-name{font-size:12px;font-weight:600;color:var(--faint,#7f938d)}
.f-expr{font-size:14.5px;line-height:1.7;color:var(--text);font-family:ui-monospace,SFMono-Regular,Menlo,monospace}
.f-note{font-size:12.5px;line-height:1.6;color:var(--muted)}
.doc-empty{padding:16px;border-radius:10px;background:var(--surface-soft);border:1px dashed #cfe0d9;font-size:13px;color:var(--muted);line-height:1.7;text-align:center}
.doc-empty p{margin:0 0 6px}
.doc-empty p:last-child{margin-bottom:0}
</style>
