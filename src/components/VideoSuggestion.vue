<script setup>
import { onMounted, ref } from 'vue'
import { getVideoRecommendations } from '../services/api.js'
import { bilibiliSearchUrl, formatDuration, formatPlayCount, remainingVideoSwaps, VIDEO_SWAP_LIMIT_TEXT, VIDEO_SWAP_REASONS } from '../utils/videos.js'

// 章节视频补强：按播放量列出 B 站讲解视频，支持按原因「换一换」，最多 5 次。
const props = defineProps({
  chapterName: { type: String, default: '' },
  grade: { type: String, default: '' },
  subject: { type: String, default: '' },
  edition: { type: String, default: '' }
})
const emit = defineEmits(['close'])

const items = ref([])
const loading = ref(true)
const error = ref('')
const swaps = ref(0)
const reason = ref('')
const excludeBvids = ref([])
const excludeAuthors = ref([])
const fallbackUrl = ref(bilibiliSearchUrl({ grade: props.grade, subject: props.subject, edition: props.edition, chapter: props.chapterName }))
const playerVisible = ref(false)
const playingVideo = ref(null)

// 用 B 站官方站外播放器在页内弹窗播放，不再跳转新标签页。
function embedUrl(bvid) {
  return `https://player.bilibili.com/player.html?isOutside=true&bvid=${encodeURIComponent(String(bvid || ''))}&p=1&autoplay=1&high_quality=1`
}

function openPlayer(event, video) {
  // 按住修饰键或使用中键时保留浏览器默认行为（新标签页打开 B 站原视频）。
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return
  event.preventDefault()
  playingVideo.value = video
  playerVisible.value = true
}

async function loadBatch() {
  loading.value = true
  error.value = ''
  const result = await getVideoRecommendations({
    grade: props.grade, subject: props.subject, edition: props.edition, chapter: props.chapterName,
    exclude: excludeBvids.value.join(','), authors: excludeAuthors.value.join(','), reason: reason.value, limit: 3
  })
  loading.value = false
  if (!result.success) { error.value = result.error || '视频检索暂时不可用'; return }
  const data = result.data || {}
  if (data.fallbackUrl) fallbackUrl.value = data.fallbackUrl
  const fresh = (data.items || []).filter(item => !excludeBvids.value.includes(item.bvid))
  items.value = fresh
  excludeBvids.value = [...excludeBvids.value, ...fresh.map(item => item.bvid)]
  if (!fresh.length) error.value = data.message || '没有更多匹配的视频了'
}

async function swap() {
  if (loading.value || remainingVideoSwaps(swaps.value) <= 0) return
  // 「不喜欢这个老师」要记住这道题当前视频的 UP 主，其它原因交给后端按元数据过滤。
  const current = items.value[0]
  if (reason.value === 'author' && current) excludeAuthors.value = [...new Set([...excludeAuthors.value, current.author])]
  swaps.value += 1
  await loadBatch()
  reason.value = ''
}

onMounted(loadBatch)
</script>

<template>
  <div class="video-panel">
    <div v-if="loading" class="video-tip">正在按播放量检索 B 站讲解视频…</div>
    <template v-else>
      <div v-if="items.length" class="video-items">
        <a v-for="video in items" :key="video.bvid" class="video-item" :href="video.url" target="_blank" rel="noopener noreferrer" title="点击在本页播放，按住 Ctrl 在新标签页打开 B 站" @click="openPlayer($event, video)">
          <span class="video-title">{{ video.title }}</span>
          <span class="video-meta">{{ video.author || '未知 UP 主' }} · {{ formatPlayCount(video.play) }}播放 · {{ formatDuration(video.durationSeconds) }}<template v-if="video.pubdate"> · {{ new Date(video.pubdate * 1000).getFullYear() }}年</template></span>
        </a>
      </div>
      <p v-else class="video-tip">{{ error || '没有找到匹配的视频' }}，<a :href="fallbackUrl" target="_blank" rel="noopener noreferrer">去 B 站搜「{{ chapterName }}」</a></p>
      <div class="video-actions">
        <el-select v-model="reason" size="small" placeholder="换的原因（可选）" :disabled="!remainingVideoSwaps(swaps)">
          <el-option v-for="item in VIDEO_SWAP_REASONS" :key="item.value" :label="item.label" :value="item.value" />
        </el-select>
        <button type="button" class="video-swap" :disabled="loading || !remainingVideoSwaps(swaps)" @click="swap">换一换（还剩 {{ remainingVideoSwaps(swaps) }} 次）</button>
        <button type="button" class="video-close" @click="emit('close')">收起</button>
        <a class="video-search" :href="fallbackUrl" target="_blank" rel="noopener noreferrer">去 B 站搜</a>
      </div>
      <p v-if="!remainingVideoSwaps(swaps)" class="video-tip">{{ VIDEO_SWAP_LIMIT_TEXT }}</p>
      <p v-if="error && items.length" class="video-tip">{{ error }}</p>
    </template>
    <el-dialog v-model="playerVisible" :title="playingVideo?.title || '视频播放'" width="min(980px, 92vw)" class="video-dialog" append-to-body destroy-on-close @closed="playingVideo = null">
      <div class="video-frame">
        <iframe v-if="playingVideo" :src="embedUrl(playingVideo.bvid)" title="B 站视频播放" allow="autoplay; fullscreen; picture-in-picture" allowfullscreen frameborder="0" scrolling="no"></iframe>
      </div>
      <p class="video-player-note">少数视频不允许站外播放；打不开时可<a v-if="playingVideo" :href="playingVideo.url" target="_blank" rel="noopener noreferrer">在 B 站打开</a></p>
    </el-dialog>
  </div>
</template>

<style scoped>
.video-panel{display:grid;gap:10px;padding:12px;border:1px solid var(--border);border-radius:12px;background:var(--surface-soft)}
.video-items{display:grid}
.video-item{display:grid;gap:3px;padding:8px 10px;border-radius:8px;color:var(--text);text-decoration:none}
.video-item+.video-item{border-top:1px solid var(--border)}
.video-item:hover{background:var(--surface)}
.video-item:focus-visible,.video-swap:focus-visible,.video-close:focus-visible,.video-search:focus-visible{outline:2px solid var(--primary);outline-offset:2px}
.video-title{font-size:calc(12px*var(--fs-scale));font-weight:600;line-height:1.5}
.video-meta{font-size:calc(12px*var(--fs-scale));line-height:1.5;color:var(--muted);font-variant-numeric:tabular-nums}
.video-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.video-actions :deep(.el-select){width:150px}
.video-swap,.video-close{font-size:calc(12px*var(--fs-scale));font-weight:600;padding:5px 10px;border-radius:999px;border:1px solid var(--primary);background:transparent;color:var(--primary);cursor:pointer;transition:background .18s,border-color .18s}
.video-close{border-color:var(--border);color:var(--muted)}
.video-swap:disabled{opacity:.5;cursor:not-allowed}
.video-search{font-size:calc(12px*var(--fs-scale));color:var(--muted);text-decoration:underline;text-underline-offset:2px}
.video-tip{margin:0;font-size:calc(12px*var(--fs-scale));line-height:1.6;color:var(--muted)}
.video-tip a{font-weight:600;color:var(--primary);text-decoration:none}
.video-tip a:hover{text-decoration:underline;text-underline-offset:2px}
:global(.video-dialog){border-radius:14px}
:global(.video-dialog .el-dialog__body){padding-top:10px}
:global(.video-dialog .el-dialog__title){font-size:calc(14px*var(--fs-scale));line-height:1.5}
.video-frame{position:relative;width:100%;aspect-ratio:16/9;background:#000;border-radius:10px;overflow:hidden}
.video-frame iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.video-player-note{margin:10px 0 0;font-size:calc(12px*var(--fs-scale));line-height:1.6;color:var(--muted)}
.video-player-note a{font-weight:600;color:var(--primary);text-decoration:none}
.video-player-note a:hover{text-decoration:underline;text-underline-offset:2px}
</style>
