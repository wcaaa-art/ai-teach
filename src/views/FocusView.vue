<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox, ElNotification } from 'element-plus'
import CountdownTimer from '../components/CountdownTimer.vue'
import CameraMonitor from '../components/CameraMonitor.vue'
import AiFloatingTutor from '../components/AiFloatingTutor.vue'
import { getRecentFocusContext, loadFocusSessions, loadPlans, loadFocusSuggestion, makeId, saveDistraction, saveFeedback, saveFocusSession, saveVisualLog, savePlan, loadProfile } from '../db/index.js'
import { iteratePlan, pushVisualStatus } from '../services/api.js'
import { formatMathText } from '../utils/formatMath.js'
import { useAppStore } from '../stores/app.js'

const store = useAppStore()
const timer = ref(null)
const selectedPlan = ref(null)
const running = ref(false)
const demoMode = ref(false)
// 自由专注：用户拿番茄钟做计划外的事，不关联计划、不参与四阶段与掌握度。
const freeMode = ref(false)
const freeTaskName = ref('')
const planChoices = ref([])
const remaining = ref(0)
const feedbackVisible = ref(false)
const visualStatus = ref({ isPresent: true, continuousAwaySeconds: 0 })
const camera = ref(null)
const startedAt = ref(0)
const distractionCount = ref(0)
// 已结束但还没写反馈的专注记录；反馈只挂靠这条记录，避免重复落库
const pendingSession = ref(null)
// 结束或自然走完后保留本次分钟数，重置计时后统计区仍能显示刚才的成果
const endedMinutes = ref(0)
// 页面切走或视觉检测离岗时，番茄环变暗并停掉呼吸光晕。
const pageHidden = ref(false)
const finishPulse = ref(false)
const weekFocus = ref([])
const feedback = reactive({ completion: 80, mastery: 2, note: '' })
const presetMinutes = [25, 40, 45, 60]; const durationMode = ref(25); const customMinutes = ref(25)
// 计划名与标签里的 an 交给统一数学排版转成下标，只改显示，不改计划数据与计算。
const planTitle = computed(() => formatMathText(freeMode.value ? (freeTaskName.value.trim() || '自由专注') : (selectedPlan.value?.name || '准备开始')))
const planTags = computed(() => freeMode.value ? '自由专注 · 不关联学习计划' : formatMathText((selectedPlan.value?.knowledgeTags || []).join(' · ')))
// 统一把时长收敛成 5–180 的整数；非法值返回 null，交给上层兜底
const clampMinutes = value => { const number = Number(value); return Number.isFinite(number) && number > 0 ? Math.min(180, Math.max(5, Math.round(number))) : null }
const totalMinutes = computed(() => { const value = durationMode.value === 'custom' ? clampMinutes(customMinutes.value) ?? 25 : Number(durationMode.value); return Math.min(180, Math.max(5, value)) })
const duration = () => totalMinutes.value * 60
// 番茄环进度：剩余时间占总时长的比例，圆周长按半径 92 计算。
const RING_RADIUS = 92
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS
const ringRatio = computed(() => {
  const total = duration()
  const left = Number(remaining.value)
  if (!total) return 1
  return Math.max(0, Math.min(1, (Number.isFinite(left) && left > 0 ? left : total) / total))
})
const ringOffset = computed(() => RING_CIRCUMFERENCE * (1 - ringRatio.value))
const ringAway = computed(() => pageHidden.value || visualStatus.value.isPresent === false)
const weekTotalSeconds = computed(() => weekFocus.value.reduce((sum, day) => sum + day.seconds, 0))
// 不足一分钟也如实显示，避免演示时 15 秒专注被四舍五入成 0。
const weekTotalText = computed(() => weekTotalSeconds.value >= 60 ? `${Math.round(weekTotalSeconds.value / 60)} 分钟` : weekTotalSeconds.value > 0 ? '不足 1 分钟' : '0 分钟')
// 最近一次章节测试给出的专注建议：默认时长取「任务预计时长」和「建议时长」的较小值，用户仍可手动改。
const focusSuggestion = ref(null)
const suggestionMinutes = computed(() => clampMinutes(focusSuggestion.value?.recommendedMinutes))
const suggestionPercent = computed(() => { const accuracy = Number(focusSuggestion.value?.accuracy); return Number.isFinite(accuracy) ? Math.round(accuracy * 100) : null })
// 建议来自日常测试还是周测，结果显示时标清楚来源。
const suggestionSource = computed(() => {
  const source = String(focusSuggestion.value?.source || '')
  if (source === 'weekly-quiz') return '周测'
  if (source === 'daily-quiz') return '日常测试'
  return '章节测试'
})
const planDefaultMinutes = computed(() => freeMode.value ? 25 : clampMinutes(selectedPlan.value?.estimatedMinutes) || 25)
// 有测试建议时倒计时直接用建议时长，计划时长只做没有建议时的兜底。
const isRecommended = minute => suggestionMinutes.value === Number(minute)
const suggestionText = computed(() => {
  const suggested = suggestionMinutes.value
  if (!suggested) return ''
  return `根据最近一次${suggestionSource.value}${suggestionPercent.value !== null ? `（正确率 ${suggestionPercent.value}%）` : ''}，建议本次专注 ${suggested} 分钟，倒计时已按建议设置，想调整可以自己选。`
})
// 优先恢复用户上次选择；没选过则按建议时长启动，没有建议才回落到计划时长。
function initDuration(){ const stored = clampMinutes(store.settings.focusMinutes); const minutes = stored || suggestionMinutes.value || planDefaultMinutes.value; if (presetMinutes.includes(minutes)) { durationMode.value = minutes } else { durationMode.value = 'custom'; customMinutes.value = minutes } }
// 时长变更只允许在未计时时生效，避免倒计时进度与新总长错乱
function applyDuration(){ if (running.value) return; const next = duration(); timer.value?.reset(next); remaining.value = next; if (startedAt.value) { startedAt.value = 0; ElMessage.info('已按新时长重置本次计时') } store.updateSettings({ focusMinutes: totalMinutes.value }) }
// 本次任务：显式 planId → 上次选择的任务或自由专注 → 顺序最靠前的进行中任务（跳过桥接复习）→ 第一条计划 → 自由专注
async function selectPlan(){
  const persistedPlans = await loadPlans()
  const requestedId = new URLSearchParams(location.search).get('planId')
  const bySequence = (left, right) => (left.sequenceOrder || 999) - (right.sequenceOrder || 999)
  const activePlans = persistedPlans.filter(plan => plan.status === 'active' && !plan.isBridge).sort(bySequence)
  const requested = persistedPlans.find(plan => plan.id === requestedId)
  if (requested) {
    freeMode.value = false
    selectedPlan.value = requested
  } else if (store.settings.lastFocusMode === 'free') {
    enterFree()
  } else {
    selectedPlan.value = activePlans.find(plan => plan.id === store.settings.lastFocusPlanId)
      || activePlans[0]
      || [...persistedPlans].sort(bySequence)[0]
      || null
    freeMode.value = !selectedPlan.value
    if (freeMode.value) enterFree()
  }
  // 选择器里只列非桥接的进行中任务；已归档的当前任务也要保留，避免下拉显示空值。
  const picker = [...activePlans]
  if (selectedPlan.value && !picker.some(plan => plan.id === selectedPlan.value.id)) picker.unshift(selectedPlan.value)
  planChoices.value = picker
  initDuration(); remaining.value = duration()
}

// 计时开始后不允许换任务，避免一条专注记录跨两个任务。
const timerLocked = computed(() => running.value || Boolean(startedAt.value))
const taskChoice = computed({
  get: () => freeMode.value ? 'free' : (selectedPlan.value?.id || 'free'),
  set: value => switchTask(value)
})

function enterFree(){
  freeMode.value = true
  selectedPlan.value = null
  freeTaskName.value = store.settings.lastFreeTaskName || ''
}

function switchTask(value){
  if (timerLocked.value) return
  if (value === 'free') {
    enterFree()
    store.updateSettings({ lastFocusMode: 'free' })
  } else {
    const plan = planChoices.value.find(item => item.id === value)
    if (!plan) return
    freeMode.value = false
    selectedPlan.value = plan
    store.updateSettings({ lastFocusMode: 'plan', lastFocusPlanId: plan.id })
  }
  initDuration(); remaining.value = duration(); timer.value?.reset(duration())
}

function saveFreeTaskName(){ store.updateSettings({ lastFreeTaskName: freeTaskName.value.trim() }) }
function start(){ endedMinutes.value = 0; if (freeMode.value) store.updateSettings({ lastFocusMode: 'free', lastFreeTaskName: freeTaskName.value.trim() }); else if (selectedPlan.value?.id) store.updateSettings({ lastFocusMode: 'plan', lastFocusPlanId: selectedPlan.value.id }); if (!startedAt.value) { pendingSession.value = null; startedAt.value = Date.now() } if (store.settings.cameraDefault && !visualStatus.value.supervisionEnabled) camera.value?.requestEnable?.(); if (demoMode.value && visualStatus.value.continuousAwaySeconds) { visualStatus.value = { isPresent: true, continuousAwaySeconds: 0 }; pushVisualStatus({ is_present: true, continuous_away_seconds: 0 }).catch(() => {}) } remaining.value = timer.value?.remaining ?? duration(); running.value = true; ElMessage.success('专注开始，先完成眼前这一小步') }
function pause(reason = 'manual'){ running.value = false; if (reason) ElMessage.info(reason) }
async function toggleFullscreen(){ try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); else await document.exitFullscreen() } catch { ElMessage.info('浏览器未允许全屏，请继续使用当前页面') } }
async function onVisibility(){ pageHidden.value = document.visibilityState === 'hidden'; if (document.visibilityState === 'hidden' && startedAt.value && !feedbackVisible.value) { const wasRunning = running.value; running.value = false; distractionCount.value++; await saveDistraction({ id: makeId('dist'), type: 'tab-hidden', createdAt: Date.now(), wasRunning, planId: selectedPlan.value?.id }); ElMessage.warning('检测到页面切走，计时已暂停。回来后可以继续。') } }
let lastVisualPush = 0
function onVisualStatus(status){ visualStatus.value = status; if (status.supervisionEnabled === false || Date.now() - lastVisualPush >= 5000) { lastVisualPush = Date.now(); pushVisualStatus({ is_present: Boolean(status.isPresent), continuous_away_seconds: Number(status.continuousAwaySeconds) || 0 }).catch(() => {}) } }
function playGentleSound(){ try { const AudioContextClass = window.AudioContext || window.webkitAudioContext; if (!AudioContextClass) return; const audioContext = new AudioContextClass(); const oscillator = audioContext.createOscillator(); const gain = audioContext.createGain(); oscillator.frequency.value = 560; gain.gain.value = .04; oscillator.connect(gain); gain.connect(audioContext.destination); oscillator.start(); oscillator.stop(audioContext.currentTime + .25); oscillator.onended = () => audioContext.close() } catch {} }
// 结束一次专注时让番茄环闪一下，给“完成”一个可见反馈。
function flashRing(){ finishPulse.value = false; window.requestAnimationFrame(() => { finishPulse.value = true; window.setTimeout(() => { finishPulse.value = false }, 720) }) }
function heatLevel(minutes){ if (minutes <= 0) return 'lv0'; if (minutes <= 10) return 'lv1'; if (minutes <= 25) return 'lv2'; if (minutes <= 45) return 'lv3'; return 'lv4' }
// 近 7 天专注分钟数，用本地记录按自然日聚合，离线也能显示。
async function loadWeekFocus(){ const sessions = await loadFocusSessions(); const days = []; for (let offset = 6; offset >= 0; offset -= 1) { const day = new Date(); day.setHours(0, 0, 0, 0); day.setDate(day.getDate() - offset); const start = day.getTime(); const seconds = sessions.filter(session => Number(session.createdAt) >= start && Number(session.createdAt) < start + 86400000).reduce((sum, session) => sum + (Number(session.actualSeconds) || 0), 0); days.push({ label: `${day.getMonth() + 1}/${day.getDate()}`, seconds, minutes: Math.round(seconds / 60) }) } weekFocus.value = days }
async function onVisualAlert(event){ running.value = false; distractionCount.value++; const isDemo = event?.source === 'demo'; await Promise.all([saveDistraction({ id: makeId('dist'), type: isDemo ? 'demo-away' : 'visual-away', createdAt: Date.now(), planId: selectedPlan.value?.id }), saveVisualLog({ id: makeId('visual'), status: 'away', source: isDemo ? 'demo' : 'vision', continuousAwaySeconds: event?.continuousAwaySeconds || 10, createdAt: Date.now(), planId: selectedPlan.value?.id })]); if (store.settings.soundEnabled && !event?.soundPlayed) playGentleSound(); try { await ElMessageBox.alert('我们暂时没有检测到你在屏幕前，计时已经暂停。回来后点击继续即可。', '温和提醒', { confirmButtonText: '我回来了' }) } catch {} }
async function simulateAway(){ if (!demoMode.value) return; visualStatus.value = { isPresent: false, continuousAwaySeconds: 10 }; await pushVisualStatus({ is_present: false, continuous_away_seconds: 10 }); await onVisualAlert({ continuousAwaySeconds: 10, source: 'demo' }) }
function falsePositive(log){ saveVisualLog({ id: makeId('visual'), ...log, status: 'false-positive', planId: selectedPlan.value?.id }); ElMessage.success('已记录误判反馈，感谢帮助我们改进') }
// 本次已专注秒数：没开始过就是 0，避免结束后重置计时把记录清零。
function elapsedSeconds(){ return startedAt.value ? Math.max(0, duration() - (timer.value?.remaining ?? remaining.value)) : 0 }
function buildSession(completed){ const actualSeconds = elapsedSeconds(); const free = freeMode.value; return { id: makeId('focus'), planId: free ? null : selectedPlan.value?.id, taskName: free ? (freeTaskName.value.trim() || '自由专注') : selectedPlan.value?.name, subject: free ? '自由专注' : selectedPlan.value?.subject, mode: free ? 'free' : 'plan', startedAt: startedAt.value || Date.now(), endedAt: Date.now(), actualSeconds, completed: Boolean(completed), distractionCount: distractionCount.value, createdAt: Date.now() } }
function resetClock(){ running.value = false; timer.value?.reset(duration()); remaining.value = duration(); startedAt.value = 0; distractionCount.value = 0 }
// 结束：只结束并记录本次专注，不弹反馈；反馈由「写反馈」单独触发。
async function endFocus(){
  if (!startedAt.value) { ElMessage.info('本次专注还没有开始。'); return }
  const session = buildSession(elapsedSeconds() >= duration() * .8)
  await saveFocusSession(session)
  pendingSession.value = session
  endedMinutes.value = Math.max(0, Math.round(session.actualSeconds / 60))
  resetClock()
  flashRing()
  ElMessage.success(`本次专注已结束，记录了 ${endedMinutes.value} 分钟；可以继续写反馈。`)
}
function openFeedback(){ running.value = false; feedbackVisible.value = true }
// 计时自然走完：只落库与重置，不自动弹反馈，反馈仍由「写反馈」单独触发。
async function onTimerComplete(){
  if (!startedAt.value) { running.value = false; return }
  const session = buildSession(true)
  await saveFocusSession(session)
  pendingSession.value = session
  endedMinutes.value = Math.max(0, Math.round(session.actualSeconds / 60))
  resetClock()
  flashRing()
  ElMessage.success('专注完成，已记录本次专注；可以点击「写反馈」让下一轮计划更贴合你。')
}
async function submitFeedback(){
  // 自由专注只记时间，不参与计划迭代与掌握度，避免把计划外的时间算成学习成果。
  if (freeMode.value) { feedbackVisible.value = false; ElMessage.info('自由专注只记录时长，不参与学习计划迭代。'); return }
  // 结束后再写反馈时复用已落库的记录；计时中直接写反馈则补记一条，两者只记一次。
  const session = pendingSession.value || (startedAt.value ? buildSession(elapsedSeconds() >= duration() * .8) : null)
  if (session) { await saveFocusSession(session); pendingSession.value = session }
  await saveFeedback({ id: makeId('feedback'), sessionId: session?.id || null, planId: selectedPlan.value?.id, completion: feedback.completion, mastery: feedback.mastery, note: feedback.note, createdAt: Date.now() })
  const context = await getRecentFocusContext(7)
  const result = await iteratePlan({ profile: store.profile, plan: selectedPlan.value, feedback: { ...feedback }, context, visualStatus: visualStatus.value })
  if (result.data?.plans) { for (const plan of result.data.plans) await savePlan(plan) }
  else { const lowMastery = feedback.mastery <= 1; await savePlan({ ...selectedPlan.value, priority: lowMastery ? '高' : '中', reviewTime: Date.now() + (lowMastery ? 86400000 : 3 * 86400000), estimatedMinutes: lowMastery ? Math.min(selectedPlan.value.estimatedMinutes || 25, 20) : selectedPlan.value.estimatedMinutes, status: 'active' }) }
  store.setPlans(await loadPlans())
  feedbackVisible.value = false
  pendingSession.value = null
  resetClock()
  if (result.success) ElNotification({ title: '反馈已吸收，学习计划已更新', message: `${result.data?.explanation || '已根据本次反馈调整任务优先级与复习间隔。'} 新的优先级、时长和复习时间可在「学习计划」查看。`, type: 'success', duration: 6000 })
  else ElMessage.success('反馈已保存，已按本地规则更新下一轮计划（可在「学习计划」查看）。')
}
onMounted(async () => { if (!store.profile) store.setProfile(await loadProfile()); focusSuggestion.value = await loadFocusSuggestion(); await selectPlan(); await loadWeekFocus(); document.addEventListener('visibilitychange', onVisibility) })
onBeforeUnmount(() => { document.removeEventListener('visibilitychange', onVisibility); camera.value?.stopMonitoring?.(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}) })
</script>
<template>
  <div class="page focus-page">
    <div class="focus-top">
      <div class="eyebrow">专注空间 · {{ freeMode ? '自由专注' : selectedPlan?.subject }}</div>
      <div class="actions">
        <el-switch v-model="demoMode" active-text="演示模式"/>
        <el-button plain @click="toggleFullscreen">⛶ 全屏</el-button>
        <el-button @click="$router.push('/plans')">退出</el-button>
      </div>
    </div>

    <div class="focus-workbench">
      <aside class="surface focus-task">
        <div class="task-head">
          <div class="eyebrow">本次任务</div>
          <el-select v-model="taskChoice" class="task-switch" size="small" :disabled="timerLocked" placeholder="选择本次任务">
            <el-option v-for="plan in planChoices" :key="plan.id" :label="plan.name" :value="plan.id"/>
            <el-option label="自由专注 · 自定义任务" value="free"/>
          </el-select>
          <el-input v-if="freeMode" v-model="freeTaskName" class="free-task-name" size="small" maxlength="24" show-word-limit :disabled="timerLocked" placeholder="这次专注做什么，例如写作业、背单词" @change="saveFreeTaskName"/>
          <h2 v-html="planTitle"></h2>
          <p class="muted task-tags" v-html="planTags"></p>
        </div>
        <div class="task-duration">
          <span class="focus-duration-label">本次专注时长（分钟）</span>
          <el-radio-group v-model="durationMode" :disabled="running" size="small" @change="applyDuration">
            <el-radio-button v-for="minute in presetMinutes" :key="minute" :value="minute">{{ minute }}<span v-if="isRecommended(minute)" class="focus-rec-tag" title="按最近一次章节测试建议的时长">推荐</span></el-radio-button>
            <el-radio-button value="custom">自定义</el-radio-button>
          </el-radio-group>
          <el-input-number v-if="durationMode === 'custom'" v-model="customMinutes" :min="5" :max="180" :step="1" :precision="0" step-strictly size="small" :disabled="running" @change="applyDuration"/>
          <p v-if="suggestionMinutes" class="focus-suggestion" :title="focusSuggestion.reason">{{ suggestionText }}</p>
          <p v-if="running" class="focus-duration-hint">计时进行中，暂停或重置后才能修改时长。</p>
        </div>
      </aside>

      <main class="focus-center">
        <div class="timer-stage" :class="{ 'is-breathing': running && !ringAway, 'is-away': ringAway, 'is-finish': finishPulse }">
          <svg class="timer-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle class="ring-track" cx="100" cy="100" :r="RING_RADIUS"/>
            <circle class="ring-progress" cx="100" cy="100" :r="RING_RADIUS" :stroke-dasharray="RING_CIRCUMFERENCE" :stroke-dashoffset="ringOffset"/>
          </svg>
          <CountdownTimer ref="timer" :seconds="duration()" :running="running" @tick="remaining = $event" @complete="onTimerComplete"/>
        </div>
        <div class="focus-actions">
          <el-button v-if="!running" type="primary" size="large" @click="start">{{ remaining && remaining < duration() ? '继续专注' : '开始专注' }}</el-button>
          <el-button v-else size="large" @click="pause('先停下来整理一下，再继续。')">暂时暂停</el-button>
          <el-button size="large" plain :disabled="!startedAt" @click="endFocus">结束</el-button>
          <el-button v-if="!freeMode" size="large" plain @click="openFeedback">写反馈</el-button>
          <el-button v-if="demoMode" size="large" type="warning" plain @click="simulateAway">模拟离岗</el-button>
        </div>
      </main>

      <aside class="focus-rail">
        <CameraMonitor class="focus-camera" compact ref="camera" :low-performance="store.settings.lowPerformance" :sound-enabled="store.settings.soundEnabled" @status="onVisualStatus" @alert="onVisualAlert" @false-positive="falsePositive" @model-error="message => ElMessage.warning(message || '视觉模块暂不可用，已保留摄像头预览')"/>
        <div class="surface surface-pad focus-tip">
          <strong>专注小提示</strong>
          <p class="muted">把任务拆成眼前的 5 分钟。卡住时点右下角灯泡，让 AI 只给思路提示。</p>
        </div>
        <div class="surface surface-pad focus-stats">
          <strong>本次状态</strong>
          <div class="focus-stat-row"><span>已专注</span><strong>{{ Math.max(Math.floor((duration() - remaining) / 60), endedMinutes) }} 分钟</strong></div>
          <div class="focus-stat-row"><span>分心记录</span><strong>{{ distractionCount }} 次</strong></div>
          <div class="focus-stat-row"><span>视觉状态</span><strong>{{ visualStatus.supervisionEnabled ? (visualStatus.isPresent ? '在岗' : '离岗') : demoMode && !visualStatus.isPresent ? '演示离岗' : '未启用' }}</strong></div>
          <div class="focus-heat">
            <div class="focus-heat-head"><strong>近 7 天专注</strong><span>{{ weekTotalText }}</span></div>
            <div class="heat-cells"><span v-for="day in weekFocus" :key="day.label" class="heat-cell" :class="heatLevel(day.seconds > 0 ? Math.max(1, day.minutes) : 0)" :title="`${day.label}：${day.seconds >= 60 ? `${day.minutes} 分钟` : day.seconds > 0 ? '不足 1 分钟' : '0 分钟'}`">{{ day.seconds > 0 && day.minutes === 0 ? '<1' : day.minutes }}</span></div>
          </div>
        </div>
      </aside>
    </div>

    <AiFloatingTutor :context="{ task: selectedPlan, visualStatus, remaining }"/>
    <el-dialog v-model="feedbackVisible" title="给这次学习一个小反馈" width="470px" :close-on-click-modal="false" :show-close="false">
      <el-form label-position="top">
        <el-form-item label="任务完成度"><el-slider v-model="feedback.completion" :min="0" :max="100" show-input/></el-form-item>
        <el-form-item label="知识点掌握等级"><el-rate v-model="feedback.mastery" :max="3" clearable :texts="['刚接触', '有点会了', '基本掌握']" show-text/></el-form-item>
        <el-form-item label="给下一轮 Agent 的备注"><el-input v-model="feedback.note" type="textarea" :rows="3" placeholder="哪里顺利？哪里还想再练？"/></el-form-item>
      </el-form>
      <p class="feedback-hint">提交后会更新学习计划里的优先级、预计时长和复习时间，可在「学习计划」页查看。</p>
      <template #footer><el-button @click="feedbackVisible = false">取消</el-button><el-button type="primary" @click="submitFeedback">提交并更新计划</el-button></template>
    </el-dialog>
  </div>
</template>
<style scoped>
.focus-page{
  --bg:#e9f2f0;
  --surface:#fbfdfb;
  --surface-soft:#edf5f1;
  --text:#1f3a44;
  --muted:#5e7b84;
  --primary:#5b8fd6;
  --primary-soft:#deebfb;
  --accent:#8fb8e8;
  --border:#d3e5df;
  --shadow:0 14px 34px rgba(48,91,84,.12);
  /* 蓝绿稳住底色，黄橙只做小面积点缀 */
  --leaf:#6aa78d;
  --leaf-soft:#e7f2ec;
  --warm:#d8894f;
  --sun:#ecc66d;
  --el-color-primary:#5b8fd6;
  --el-color-primary-light-3:#82abe2;
  --el-color-primary-light-5:#a3c2eb;
  --el-color-primary-light-7:#c5d9f3;
  --el-color-primary-light-8:#d6e4f7;
  --el-color-primary-light-9:#ecf3fc;
  --el-color-primary-dark-2:#4a76b8;
  --el-color-success:#63a184;
  --el-color-warning:#d99a5b;
  --el-border-color:#d3e5df;
  --el-border-color-light:#e1ece7;
  --el-fill-color-blank:#fbfdfb;
  --el-text-color-primary:#1f3a44;
  --el-text-color-regular:#4d6a72;
  max-width:none;
  width:100%;
  min-height:100vh;
  background:linear-gradient(160deg,#eaf2f8 0%,#e8f2ef 52%,#e7f2e7 100%);
}
.focus-top{display:flex;justify-content:space-between;align-items:center;gap:16px;margin:0 0 18px}
.focus-top .actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.focus-page :deep(sub){font-size:.62em;line-height:0;vertical-align:sub}
.focus-workbench{display:grid;grid-template-columns:clamp(260px,24vw,380px) minmax(0,1fr) clamp(260px,24vw,380px);gap:20px;align-items:start}
.focus-task{padding:20px;display:flex;flex-direction:column;gap:16px}
.task-head{display:flex;flex-direction:column;gap:6px}
.task-switch{margin-top:2px;align-self:flex-start;width:100%}
.free-task-name{margin-top:2px}
.task-head h2{margin:0;font-size:22px;line-height:1.35}
.task-tags{margin:0;font-size:12px;line-height:1.5}
.task-duration{padding-top:14px;border-top:1px solid var(--border);display:flex;flex-direction:column;gap:10px}
.focus-duration-label{color:var(--muted);font-size:12px}
.focus-task :deep(.el-radio-group){display:flex;flex-wrap:wrap;gap:4px}
.focus-task :deep(.el-radio-button){margin:0}
.focus-task :deep(.el-radio-button__inner){padding:5px 6px;border:1px solid var(--border);border-radius:6px;font-size:12px;box-shadow:none}
.focus-task :deep(.el-radio-button__original-radio:checked+.el-radio-button__inner){background:var(--primary);border-color:var(--primary);color:#fff;box-shadow:none}
.focus-suggestion{margin:0;padding-left:8px;border-left:2px solid var(--warm);color:var(--primary);font-size:12px;line-height:1.5}
.focus-duration-hint{margin:0;color:var(--muted);font-size:12px;line-height:1.5}
.focus-rec-tag{margin-left:4px;padding:0 4px;border-radius:4px;background:rgba(236,198,109,.3);color:#b8733c;font-size:11px;font-weight:700}
.focus-task .eyebrow{color:var(--warm)}
.focus-center :deep(.clock-colon){color:var(--warm)}
.focus-center{min-height:440px;display:flex;flex-direction:column;align-items:center;justify-content:center}
.timer-stage{position:relative;display:flex;align-items:center;justify-content:center;width:min(100%,600px);aspect-ratio:1;margin:0 auto;box-sizing:border-box;padding:13%}
.timer-stage::before{content:'';position:absolute;width:64%;aspect-ratio:1;border-radius:50%;background:radial-gradient(circle,rgba(91,143,214,.2),rgba(91,143,214,0) 68%);opacity:0;transition:opacity .35s ease;pointer-events:none}
.timer-ring{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}
.ring-track{fill:none;stroke:var(--border);stroke-width:5}
.ring-progress{fill:none;stroke:var(--primary);stroke-width:5;stroke-linecap:round;transform:rotate(-90deg);transform-origin:100px 100px;transition:stroke-dashoffset .35s linear,stroke .3s ease}
.focus-center :deep(.clock){transition:opacity .3s ease,filter .3s ease}
.timer-stage.is-breathing::before{animation:breathe 4s ease-in-out infinite}
.timer-stage.is-away .ring-progress{stroke:#a9b9b6}
.timer-stage.is-away .ring-track{stroke:#e0eae7}
.timer-stage.is-away :deep(.clock){opacity:.5;filter:grayscale(.4)}
.timer-stage.is-away::before{opacity:0;animation:none}
.timer-stage.is-finish .ring-progress{animation:ringFlash .7s ease-out}
@keyframes breathe{0%,100%{opacity:.35;transform:scale(.97)}50%{opacity:.85;transform:scale(1.03)}}
@keyframes ringFlash{0%{stroke-width:5;filter:none}38%{stroke-width:9;filter:drop-shadow(0 0 10px rgba(91,143,214,.6))}100%{stroke-width:5;filter:none}}
.focus-actions{display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:24px}
.focus-rail{display:flex;flex-direction:column;gap:14px;min-width:0}
.focus-camera{min-width:0}
.focus-tip{background:linear-gradient(160deg,#f4faf6,#e8f3ec);border-left:3px solid var(--warm)}
.focus-tip strong,.focus-stats>strong{font-size:13px}
.focus-tip p{margin:6px 0 0;font-size:12px;line-height:1.6}
.focus-stats{display:flex;flex-direction:column;gap:4px}
.focus-stat-row{display:flex;justify-content:space-between;gap:10px;margin-top:4px;padding-top:8px;border-top:1px solid var(--border);font-size:12px}
.focus-stat-row:first-of-type{margin-top:6px;padding-top:0;border-top:0}
.focus-stat-row:first-of-type strong{color:var(--leaf)}
.focus-stat-row span{color:var(--muted)}
.focus-stat-row strong{color:var(--primary);font-size:13px}
.focus-heat{margin-top:12px;padding-top:12px;border-top:1px solid var(--border)}
.focus-heat-head{display:flex;justify-content:space-between;align-items:baseline;font-size:12px;color:var(--muted);margin-bottom:8px}
.focus-heat-head strong{font-size:13px;color:var(--text)}
.heat-cells{display:grid;grid-template-columns:repeat(7,minmax(0,1fr));gap:5px}
.heat-cell{aspect-ratio:1;border-radius:6px;display:grid;place-items:center;font-size:10px;color:#587570;background:var(--surface-soft)}
.heat-cell.lv1{background:#dcefe8;color:#3f675d}
.heat-cell.lv2{background:#bfe3d7;color:#30604f}
.heat-cell.lv3{background:#8fcdb9;color:#fff}
.heat-cell.lv4{background:#55a48b;color:#fff}
@media (prefers-reduced-motion: reduce){.timer-stage.is-breathing::before{animation:none;opacity:.4}.timer-stage.is-finish .ring-progress{animation:none}}
.feedback-hint{margin:2px 0 0;color:var(--muted);font-size:12px;line-height:1.6}
@media(max-width:1000px){
  .focus-workbench{grid-template-columns:1fr;gap:16px}
  .focus-center{min-height:0;padding:18px 0}
  .focus-rail{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));align-items:start}
  .focus-camera{grid-column:1/-1}
}
@media(max-width:640px){
  .focus-top{flex-direction:column;align-items:flex-start}
  .focus-task{padding:16px}
  .focus-rail{grid-template-columns:1fr}
}
</style>
