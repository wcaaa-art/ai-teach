<script setup>
import { ref, watch } from 'vue'
import { getVideoRecommendations } from '../../../services/api.js'
import { bilibiliSearchUrl, formatDuration, formatPlayCount } from '../../../utils/videos.js'

// 视频弹窗：按「知识点 + 年级 + 版本」检索，只给综合排第一的一条。
const props = defineProps({
  open: { type: Boolean, default: false },
  chapterName: { type: String, default: '' },
  grade: { type: String, default: '' },
  subject: { type: String, default: '' },
  edition: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const dialog = ref(null)
const item = ref(null)
const loading = ref(false)
const error = ref('')
const fallbackUrl = ref('')

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
  item.value = null
  const result = await getVideoRecommendations({
    grade: props.grade, subject: props.subject, edition: props.edition,
    chapter: props.chapterName, limit: 1
  })
  loading.value = false
  if (!result.success) { error.value = result.error || '视频检索暂时不可用'; return }
  const data = result.data || {}
  fallbackUrl.value = data.fallbackUrl || bilibiliSearchUrl({
    grade: props.grade, subject: props.subject, edition: props.edition, chapter: props.chapterName
  })
  item.value = (data.items || [])[0] || null
  if (!item.value) error.value = data.message || '这个专题暂时没有匹配的讲解视频'
}

function embedUrl(bvid) {
  return `https://player.bilibili.com/player.html?isOutside=true&bvid=${encodeURIComponent(String(bvid || ''))}&p=1&autoplay=1&high_quality=1`
}
</script>

<template>
  <dialog ref="dialog" class="report-dialog wide" @close="emit('close')" @cancel.prevent="closeDialog">
    <div class="dlg-head">
      <div>
        <h3>补强视频 · {{ chapterName }}</h3>
        <p>按知识点检索后只给一条，综合播放量与时长排出来的</p>
      </div>
      <button class="dlg-x" type="button" aria-label="关闭" @click="closeDialog">×</button>
    </div>
    <div class="dlg-body">
      <p v-if="loading" class="dlg-tip">正在按播放量检索 B 站讲解视频…</p>
      <template v-else-if="item">
        <div class="player">
          <iframe :src="embedUrl(item.bvid)" title="B 站视频播放器" allow="autoplay; fullscreen" allowfullscreen></iframe>
        </div>
        <p class="v-title">{{ item.title }}</p>
        <p class="v-meta">{{ item.author || '未知 UP 主' }} · {{ formatPlayCount(item.play) }}播放 · {{ formatDuration(item.durationSeconds) }}<template v-if="item.pubdate"> · {{ new Date(item.pubdate * 1000).getFullYear() }}年</template></p>
        <div class="v-why">
          按「{{ chapterName }}」检索后综合排第一：播放 {{ formatPlayCount(item.play) }}、时长 {{ formatDuration(item.durationSeconds) }}，
          {{ item.author || 'UP 主' }}讲解，适合一次看完
        </div>
      </template>
      <div v-else class="doc-empty">
        <p>{{ error }}</p>
        <p>直接去 B 站搜这个关键词也能找到同类讲解</p>
      </div>
    </div>
    <div class="dlg-foot">
      <span class="hint">看完接着做路线里的下一步</span>
      <span class="spacer"></span>
      <button class="btn" type="button" @click="closeDialog">关闭</button>
      <a class="btn btn-primary" :href="item ? item.url : fallbackUrl" target="_blank" rel="noopener noreferrer">去 B 站看</a>
    </div>
  </dialog>
</template>

<style scoped>
.report-dialog{border:0;padding:0;border-radius:16px;max-width:520px;width:calc(100vw - 40px);box-shadow:0 24px 64px rgba(28,46,42,.2);color:var(--text);background:var(--surface,#fff)}
.report-dialog.wide{max-width:580px}
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
.btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:9px;font-size:12.5px;font-weight:500;border:1px solid var(--border);background:var(--surface,#fff);color:var(--text);font-family:inherit;cursor:pointer;text-decoration:none}
.btn-primary{border-color:var(--primary);background:var(--primary);color:#fff;font-weight:600}
.player{position:relative;aspect-ratio:16/9;border-radius:11px;overflow:hidden;background:linear-gradient(145deg,#2c4743,#1b302c);margin-bottom:11px}
.player iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.v-title{font-size:13.5px;font-weight:600;line-height:1.5;margin:0 0 5px}
.v-meta{font-size:11.5px;color:var(--faint,#7f938d);margin:0 0 10px}
.v-why{padding:9px 11px;border-radius:9px;background:var(--surface-soft);border:1px solid var(--border-soft,#eef4f1);font-size:11.5px;color:var(--muted);line-height:1.65}
.doc-empty{padding:16px;border-radius:10px;background:var(--surface-soft);border:1px dashed #cfe0d9;font-size:12px;color:var(--muted);line-height:1.7;text-align:center}
.doc-empty p{margin:0 0 6px}
.doc-empty p:last-child{margin-bottom:0}
</style>
