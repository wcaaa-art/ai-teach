<script setup>
import { computed, ref } from 'vue'
import { useAppStore } from '../stores/app.js'
import DataBackupCard from '../components/DataBackupCard.vue'
import FeedbackDialog from '../components/FeedbackDialog.vue'

const store = useAppStore()
const baseUrl = import.meta.env.VITE_LLM_BASE_URL || 'https://api.deepseek.com'
const model = import.meta.env.VITE_LLM_MODEL_NAME || 'deepseek-flash'
const feedbackOpen = ref(false)

async function update(key, value) {
  await store.updateSettings({ [key]: value })
}

// 护眼模式：开关与强度都直接落在 store，写库和滤镜应用由 store 统一处理。
const eyeEnabled = computed({
  get: () => Boolean(store.settings.eyeCareEnabled),
  set: value => update('eyeCareEnabled', value)
})
const eyeStrength = computed({
  get: () => Number(store.settings.eyeCareStrength) || 0,
  set: value => update('eyeCareStrength', value)
})
const eyePresets = [
  { label: '轻柔', value: 25, note: '微微发暖' },
  { label: '标准', value: 45, note: '久读推荐' },
  { label: '加强', value: 70, note: '夜间更柔' }
]
// 预览色块按滤镜层的实际系数（strength × 0.62）混色，所见即所得。
const eyeSwatch = computed(() => `color-mix(in srgb, #ffffff, #ffd08a ${Math.round(eyeStrength.value / 100 * 62)}%)`)
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div>
        <h2 class="page-title">系统设置</h2>
        <p class="page-subtitle">按你的设备和习惯，调整专注体验。</p>
      </div>
    </div>

    <div class="grid-2">
      <section class="surface surface-pad">
        <h3 class="section-title">体验开关</h3>
        <div class="setting-row">
          <div><strong>摄像头监督默认状态</strong><p class="muted">专注页仍会再次展示隐私说明</p></div>
          <el-switch :model-value="store.settings.cameraDefault" @change="value => update('cameraDefault', value)" />
        </div>
        <div class="setting-row">
          <div><strong>提醒音效</strong><p class="muted">视觉离岗时播放轻提示音</p></div>
          <el-switch :model-value="store.settings.soundEnabled" @change="value => update('soundEnabled', value)" />
        </div>
        <div class="setting-row">
          <div><strong>AI 语音朗读</strong><p class="muted">答疑朗读、背单词自动发音</p></div>
          <el-switch :model-value="store.settings.ttsEnabled" @change="value => update('ttsEnabled', value)" />
        </div>
        <div class="setting-row">
          <div><strong>深色主题</strong><p class="muted">降低夜间学习时的屏幕刺激</p></div>
          <el-switch :model-value="store.settings.darkMode" @change="value => update('darkMode', value)" />
        </div>
      </section>

      <section class="surface surface-pad eye-card">
        <div class="eye-head">
          <span class="eye-head-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.8" /></svg>
          </span>
          <div class="eye-head-copy">
            <h3 class="section-title">护眼模式</h3>
            <p class="muted">在现有配色上叠一层暖色滤镜，减少长时间阅读的屏幕刺激。关掉即刻恢复原色。</p>
          </div>
          <el-switch v-model="eyeEnabled" aria-label="护眼模式开关" />
        </div>

        <div class="eye-body" :class="{ 'is-off': !eyeEnabled }">
          <div class="eye-strength-top">
            <span>滤镜强度</span>
            <strong>{{ eyeStrength }}%</strong>
          </div>
          <el-slider v-model="eyeStrength" :min="0" :max="100" :step="5" :disabled="!eyeEnabled" :show-tooltip="false" aria-label="护眼滤镜强度" />
          <div class="eye-presets">
            <button v-for="preset in eyePresets" :key="preset.value" type="button" :class="{ active: eyeStrength === preset.value }" :disabled="!eyeEnabled" @click="eyeStrength = preset.value">
              {{ preset.label }}<small>{{ preset.note }}</small>
            </button>
          </div>
          <div class="eye-preview">
            <span class="eye-chip eye-chip-plain">原色</span>
            <span class="eye-arrow" aria-hidden="true">→</span>
            <span class="eye-chip eye-chip-warm" :style="{ background: eyeSwatch }">护眼</span>
            <small>数值越大越暖，随时可关</small>
          </div>
        </div>
      </section>

      <section class="surface surface-pad">
        <h3 class="section-title">性能与连接</h3>
        <div class="setting-row">
          <div><strong>低配模式</strong><p class="muted">关闭 MediaPipe 视觉推理，仅保留页面切标签检测</p></div>
          <el-switch :model-value="store.settings.lowPerformance" @change="value => update('lowPerformance', value)" />
        </div>
        <el-divider />
        <p class="muted">LLM 接口（只读展示）</p>
        <div class="readonly-item"><span>Base URL</span><code>{{ baseUrl }}</code></div>
        <div class="readonly-item"><span>模型名称</span><code>{{ model }}</code></div>
        <el-alert type="info" :closable="false" style="margin-top:16px">API 密钥仅存放在后端 .env，前端不会接触密钥。</el-alert>
      </section>

      <section class="surface surface-pad">
        <h3 class="section-title">帮助与反馈</h3>
        <div class="setting-row">
          <div><strong>意见反馈</strong><p class="muted">哪里不好用、哪里写错了、想要什么功能</p></div>
          <el-button plain size="small" @click="feedbackOpen = true">写反馈</el-button>
        </div>
      </section>

      <DataBackupCard />
      <FeedbackDialog v-model="feedbackOpen" />
    </div>
  </div>
</template>

<style scoped>
.setting-row { display: flex; justify-content: space-between; align-items: center; gap: 15px; padding: 16px 0; border-bottom: 1px solid var(--border); }
.setting-row:last-child { border-bottom: 0; }
.setting-row strong { font-size: calc(14px * var(--fs-scale)); }
.setting-row p { margin: 5px 0 0; font-size: calc(12px * var(--fs-scale)); }
.readonly-item { display: flex; justify-content: space-between; gap: 10px; align-items: center; padding: 12px; background: var(--surface-soft); margin: 8px 0; border-radius: 10px; font-size: calc(13px * var(--fs-scale)); }
.readonly-item code { color: var(--primary); word-break: break-all; }

/* 护眼卡：图标用暖色语义色，和「蓝光/暖色」的直觉对上，不占大面积。 */
.eye-card { display: flex; flex-direction: column; }
.eye-head { display: flex; align-items: flex-start; gap: 11px; }
.eye-head-icon { width: 38px; height: 38px; flex: none; display: grid; place-items: center; border-radius: 12px; background: var(--accent-soft); color: var(--accent-deep); }
.eye-head-icon svg { width: 21px; height: 21px; fill: none; stroke: currentColor; stroke-width: 1.7; stroke-linecap: round; stroke-linejoin: round; }
.eye-head-copy { flex: 1; min-width: 0; }
.eye-head-copy .section-title { margin: 1px 0 4px; }
.eye-head-copy p { margin: 0; font-size: calc(11.5px * var(--fs-scale)); line-height: 1.65; }
.eye-head :deep(.el-switch) { flex: none; margin-top: 7px; }

.eye-body { margin-top: 16px; padding-top: 13px; border-top: 1px solid var(--border); transition: opacity .2s ease; }
.eye-body.is-off { opacity: .42; }
.eye-strength-top { display: flex; align-items: baseline; justify-content: space-between; font-size: calc(12.5px * var(--fs-scale)); color: var(--muted); }
.eye-strength-top strong { font-size: calc(19px * var(--fs-scale)); font-weight: 700; color: var(--accent-deep); font-variant-numeric: tabular-nums; }
.eye-body :deep(.el-slider) { margin: 4px 6px 12px; }
.eye-presets { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.eye-presets button { border: 1px solid var(--border); border-radius: 10px; padding: 7px 4px; background: var(--surface); color: var(--text); font-family: inherit; font-size: calc(12px * var(--fs-scale)); cursor: pointer; transition: border-color .18s, background .18s, color .18s; }
.eye-presets button small { display: block; margin-top: 2px; font-size: calc(10px * var(--fs-scale)); color: var(--muted); }
.eye-presets button:hover:not(:disabled) { border-color: var(--accent); }
.eye-presets button.active { border-color: var(--accent); background: var(--accent-soft); color: var(--accent-deep); font-weight: 600; }
.eye-presets button:disabled { cursor: not-allowed; }
.eye-preview { display: flex; align-items: center; gap: 7px; margin-top: 13px; font-size: calc(11px * var(--fs-scale)); color: var(--muted); }
.eye-chip { padding: 3px 10px; border-radius: 999px; border: 1px solid var(--border); color: var(--text); font-size: calc(11px * var(--fs-scale)); }
.eye-chip-warm { border-color: transparent; color: #6b4a1f; }
.eye-arrow { color: var(--muted); }
.eye-preview small { margin-left: auto; font-size: calc(10.5px * var(--fs-scale)); }

@media (min-width: 1180px) {
  /* 宽屏排三列：四张卡从三行压成两行，设置页一屏就能看完 */
  .grid-2 { grid-template-columns: repeat(3, minmax(0, 1fr)); }
}
</style>
