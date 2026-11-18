<script setup>
import { computed, onBeforeUnmount, ref } from 'vue'
import { OneEuroFilter, resetAll } from '../vision/oneEuro.js'
import { computeEyeOpen, faceBoxOf, headPoseFromMatrix, pickPrimaryFace } from '../vision/metrics.js'
import { ATTENTION_LABELS, AttentionMachine } from '../vision/attentionMachine.js'

const props = defineProps({ lowPerformance: Boolean, soundEnabled: { type: Boolean, default: true }, defaultEnabled: Boolean, compact: Boolean, bare: Boolean })
const emit = defineEmits(['status', 'alert', 'attention', 'false-positive', 'model-error'])
const enabled = ref(false); const consentVisible = ref(false); const active = ref(false); const video = ref(null)
// 只折叠预览画面，不停止摄像头与推理；画面缩到 2px 继续供 MediaPipe 取帧。
const previewCollapsed = ref(false)
const state = ref({
  isPresent: true, continuousAwaySeconds: 0, modelReady: false, cameraReady: false, supervisionEnabled: false,
  attentionState: 'focused', attentionLabel: ATTENTION_LABELS.focused, eyeOpen: 1, yaw: 0, pitch: 0, faceCount: 0,
  mode: 'off', message: '摄像头监督已关闭'
})
const eyePercent = computed(() => Math.round((Number(state.value.eyeOpen) || 0) * 100))

let stream; let visionFileset; let FaceLandmarker; let FaceDetector; let FilesetResolver
let landmarker = null; let faceDetector = null; let mode = 'off'
let audioContext; let initializationId = 0; let cancelInitialization
let running = false; let loopToken = 0; let lastProcessed = 0; let lastVideoTimestamp = 0; let lastSampleAt = 0
let emaFrameMs = 0; let noFaceSince = 0; let lastStatusAt = 0; let downgrading = false; let downgradeFailed = false; let processedFrames = 0
// 12~15fps 足够判断注意力；推理耗时升高时主动降频，超过 150ms 换轻量人脸检测。
let targetFps = 15
const machine = new AttentionMachine()
const filters = {
  yaw: new OneEuroFilter({ minCutoff: 1, beta: 0.007 }),
  pitch: new OneEuroFilter({ minCutoff: 1, beta: 0.007 }),
  eyeOpen: new OneEuroFilter({ minCutoff: 1.5, beta: 0.01 }),
  faceRatio: new OneEuroFilter({ minCutoff: 0.8, beta: 0.005 })
}

function requestEnable(){ consentVisible.value = true }
async function acceptConsent(){
  consentVisible.value = false
  enabled.value = true
  if (props.soundEnabled) {
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (AudioContextClass) { audioContext = new AudioContextClass(); await audioContext.resume() }
    } catch {}
  }
  await startMonitoring()
}
function disable(){
  const shouldNotify = enabled.value || active.value
  enabled.value = false
  initializationId += 1
  cancelInitialization?.()
  cancelInitialization = undefined
  stopMonitoring(shouldNotify)
}

function guardLoad(promise, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('视觉模型加载超时')), timeoutMs)
    cancelInitialization = () => { clearTimeout(timer); reject(new Error('摄像头初始化已取消')) }
    promise.then(
      value => { clearTimeout(timer); resolve(value) },
      error => { clearTimeout(timer); reject(error) }
    )
  }).finally(() => { cancelInitialization = undefined })
}

async function createFaceLandmarker(){
  const options = delegate => ({
    baseOptions: { modelAssetPath: '/models/face_landmarker.task', delegate },
    runningMode: 'VIDEO', numFaces: 2,
    outputFaceBlendshapes: true, outputFacialTransformationMatrixes: true,
    minFaceDetectionConfidence: .5, minFacePresenceConfidence: .5, minTrackingConfidence: .5
  })
  try { return await FaceLandmarker.createFromOptions(visionFileset, options('GPU')) }
  catch { return await FaceLandmarker.createFromOptions(visionFileset, options('CPU')) }
}
async function createFaceDetector(){
  const options = delegate => ({
    baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate },
    runningMode: 'VIDEO', minDetectionConfidence: .55
  })
  try { return await FaceDetector.createFromOptions(visionFileset, options('GPU')) }
  catch { return await FaceDetector.createFromOptions(visionFileset, options('CPU')) }
}
// Face Landmarker 的模型或 GPU 不可用时，回落到本地 BlazeFace，只保留在岗与多人检测。
async function createEngine(){
  try {
    return { mode: 'landmarker', instance: await createFaceLandmarker(), landmarkerFailed: false }
  } catch (error) {
    return { mode: 'lightweight', instance: await createFaceDetector(), landmarkerFailed: true, error }
  }
}

async function startMonitoring(){
  const requestId = ++initializationId
  if (props.lowPerformance) {
    enabled.value = false
    state.value.message = '设置中的低配模式已关闭视觉推理，仅保留页面切标签检测，请到“设置 → 性能与连接”关闭低配模式后再试'
    emit('model-error', state.value.message)
    return
  }
  const startupWatchdog = setTimeout(() => {
    if (requestId === initializationId && stream) {
      active.value = true
      state.value = { ...state.value, cameraReady: true, modelReady: false, supervisionEnabled: false, message: '摄像头已连接，但视觉模型加载超时；已保留本地预览并降级为页面检测' }
      emit('model-error', '视觉模型加载超时')
    }
  }, 45000)
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器环境不支持摄像头：请使用 localhost 或 HTTPS，并确认浏览器支持 MediaDevices')
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
    if (requestId !== initializationId || !enabled.value) { stream.getTracks().forEach(track => track.stop()); stream = null; return }
    if (!video.value) { stream.getTracks().forEach(track => track.stop()); stream = null; return }
    video.value.srcObject = stream
    await video.value.play()
    active.value = true
    state.value = { ...state.value, cameraReady: true, message: '摄像头已连接，正在加载本地视觉模型…' }

    const visionModule = await import('@mediapipe/tasks-vision')
    if (requestId !== initializationId || !enabled.value) return
    ;({ FaceLandmarker, FaceDetector, FilesetResolver } = visionModule)
    visionFileset = await FilesetResolver.forVisionTasks('/mediapipe')
    if (requestId !== initializationId || !enabled.value) return

    const enginePromise = createEngine()
    const closeLate = engine => {
      if (requestId !== initializationId || !enabled.value) engine?.instance?.close?.()
    }
    enginePromise.then(closeLate).catch(() => {})
    const engine = await guardLoad(enginePromise, 30000)
    if (requestId !== initializationId || !enabled.value) { engine.instance.close?.(); return }

    if (engine.mode === 'landmarker') landmarker = engine.instance
    else faceDetector = engine.instance
    mode = engine.mode
    if (engine.landmarkerFailed) emit('model-error', '高性能人脸模型不可用，已回落到轻量人脸检测（仅看在岗与多人）')
    machine.reset(performance.now())
    state.value = {
      ...state.value, modelReady: true, supervisionEnabled: true, mode,
      message: mode === 'landmarker' ? '端侧推理运行中 · 专注中' : '轻量检测运行中 · 专注中'
    }
    startLoop()
  } catch (error) {
    if (requestId === initializationId) {
      const permissionMessage = error.name === 'NotAllowedError' ? '浏览器拒绝了摄像头权限，可在地址栏重新允许'
        : error.name === 'NotFoundError' ? '没有找到可用摄像头，请检查设备连接'
        : error.message || '摄像头或模型暂时不可用'
      if (stream) {
        active.value = true
        state.value = { ...state.value, cameraReady: true, modelReady: false, supervisionEnabled: false, message: `摄像头已连接，但视觉模型不可用：${permissionMessage}` }
        emit('model-error', permissionMessage)
      } else {
        enabled.value = false
        stopMonitoring(true)
        emit('model-error', permissionMessage)
        state.value.message = permissionMessage
      }
    }
  } finally {
    clearTimeout(startupWatchdog)
  }
}

function frameInterval(){ return 1000 / targetFps }
function scheduleFrame(token){
  if (!running || token !== loopToken) return
  const videoEl = video.value
  if (!videoEl) return
  if (typeof videoEl.requestVideoFrameCallback === 'function') {
    videoEl.requestVideoFrameCallback(() => {
      if (!running || token !== loopToken) return
      const now = performance.now()
      if (now - lastProcessed >= frameInterval()) processFrame(now)
      scheduleFrame(token)
    })
  } else {
    requestAnimationFrame(() => {
      if (!running || token !== loopToken) return
      const now = performance.now()
      if (now - lastProcessed >= frameInterval()) processFrame(now)
      scheduleFrame(token)
    })
  }
}
function startLoop(){
  running = true
  loopToken += 1
  lastProcessed = 0
  lastVideoTimestamp = 0
  lastSampleAt = 0
  processedFrames = 0
  downgradeFailed = false
  scheduleFrame(loopToken)
}
function stopLoop(){
  running = false
  loopToken += 1
}

function readLandmarker(videoEl, timestamp){
  const result = landmarker.detectForVideo(videoEl, timestamp)
  const faces = result.faceLandmarks || []
  const boxes = faces.map(faceBoxOf)
  const visibleCount = boxes.filter(box => box && box.ratio >= .05).length
  const primary = pickPrimaryFace(boxes)
  const box = primary >= 0 ? boxes[primary] : null
  const aspect = videoEl.videoWidth / videoEl.videoHeight
  return {
    faceCount: visibleCount,
    faceRatio: box?.ratio || 0,
    eyeOpen: computeEyeOpen({ blendshapes: result.faceBlendshapes?.[primary], landmarks: faces[primary], aspect }),
    ...headPoseFromMatrix(result.facialTransformationMatrixes?.[primary]?.data)
  }
}
function readFaceDetector(videoEl, timestamp){
  const result = faceDetector.detectForVideo(videoEl, timestamp)
  const boxes = (result.detections || []).map(({ boundingBox }) => {
    if (!boundingBox) return null
    const width = boundingBox.width / videoEl.videoWidth
    const height = boundingBox.height / videoEl.videoHeight
    return {
      centerX: (boundingBox.originX + boundingBox.width / 2) / videoEl.videoWidth,
      centerY: (boundingBox.originY + boundingBox.height / 2) / videoEl.videoHeight,
      width, height, ratio: Math.max(width, height)
    }
  }).filter(Boolean)
  const primary = pickPrimaryFace(boxes)
  const box = primary >= 0 ? boxes[primary] : null
  return {
    faceCount: boxes.filter(item => item.ratio >= .05).length,
    faceRatio: box?.ratio || 0,
    eyeOpen: 1, yaw: 0, pitch: 0
  }
}

function filterSample(sample, dt){
  if (sample.faceCount === 0) return { ...sample, eyeOpen: 1, faceRatio: 0 }
  return {
    ...sample,
    eyeOpen: filters.eyeOpen.filter(sample.eyeOpen, dt),
    yaw: filters.yaw.filter(sample.yaw, dt),
    pitch: filters.pitch.filter(sample.pitch, dt),
    faceRatio: filters.faceRatio.filter(sample.faceRatio, dt)
  }
}

function processFrame(timestamp){
  const videoEl = video.value
  if (!running || !videoEl) return
  if (!videoEl.videoWidth || !videoEl.videoHeight) return
  lastProcessed = performance.now()
  if (!landmarker && !faceDetector) return
  const started = lastProcessed
  const detectTimestamp = Math.max(timestamp, lastVideoTimestamp + 1)
  lastVideoTimestamp = detectTimestamp
  try {
    const sample = landmarker ? readLandmarker(videoEl, detectTimestamp) : readFaceDetector(videoEl, detectTimestamp)
    const dt = lastSampleAt ? Math.min(.2, Math.max(1 / 60, (started - lastSampleAt) / 1000)) : 1 / 30
    lastSampleAt = started
    if (sample.faceCount === 0) {
      if (!noFaceSince) noFaceSince = started
      else if (started - noFaceSince > 2000) resetAll([filters.yaw, filters.pitch, filters.eyeOpen, filters.faceRatio])
    } else {
      noFaceSince = 0
    }
    const result = machine.update({ now: started, ...filterSample(sample, dt) })
    const now = Date.now()
    if (result.changed || now - lastStatusAt >= 1000) {
      lastStatusAt = now
      const next = {
        isPresent: result.present,
        continuousAwaySeconds: result.awaySeconds,
        modelReady: true, cameraReady: true, supervisionEnabled: true,
        attentionState: result.state, attentionLabel: result.label,
        eyeOpen: Math.round(result.eyeOpen * 100) / 100,
        yaw: Math.round(result.yaw * 10) / 10,
        pitch: Math.round(result.pitch * 10) / 10,
        faceCount: result.faceCount,
        mode,
        message: result.state === 'away'
          ? `暂未检测到你在屏幕前 · 已离岗 ${result.awaySeconds} 秒`
          : `${mode === 'landmarker' ? '端侧推理' : '轻量检测'} · ${result.label}`
      }
      state.value = next
      emit('status', { ...next })
    }
    if (result.prompt) {
      if (result.prompt.type === 'away') {
        if (props.soundEnabled) speakAlert()
        emit('alert', { continuousAwaySeconds: result.awaySeconds, soundPlayed: props.soundEnabled })
      } else {
        emit('attention', result.prompt)
      }
    }
  } catch (error) {
    handleRuntimeError(error)
    return
  }
  const cost = performance.now() - started
  processedFrames += 1
  emaFrameMs = emaFrameMs ? emaFrameMs * .7 + cost * .3 : cost
  // 前 10 帧包含模型预热与着色器编译，不参与降级判断，避免真机一上来就被误判为慢。
  if (processedFrames > 3) targetFps = emaFrameMs > 80 ? 6 : emaFrameMs > 40 ? 10 : 15
  if (mode === 'landmarker' && processedFrames > 10 && emaFrameMs > 150 && !downgrading && !downgradeFailed) downgradeToLightweight()
}

async function downgradeToLightweight(){
  if (downgrading || !landmarker) return
  downgrading = true
  try {
    const detector = await createFaceDetector()
    if (!running) { detector.close?.(); return }
    landmarker.close?.()
    landmarker = null
    faceDetector = detector
    mode = 'lightweight'
    resetAll([filters.yaw, filters.pitch, filters.eyeOpen, filters.faceRatio])
    emaFrameMs = 0
    targetFps = 10
    state.value = { ...state.value, mode, message: '设备推理较慢，已切换轻量检测（仅看在岗与多人）' }
    emit('model-error', '设备推理较慢，已自动切换到轻量人脸检测')
  } catch {
    // 轻量模型也加载失败时停止重试，保持原模型继续降频运行。
    downgradeFailed = true
  } finally {
    downgrading = false
  }
}

function handleRuntimeError(error){
  stopLoop()
  landmarker?.close?.(); landmarker = null
  faceDetector?.close?.(); faceDetector = null
  mode = 'off'
  state.value = { ...state.value, modelReady: false, supervisionEnabled: false, message: `视觉检测暂时不可用，已保留摄像头预览：${error.message}` }
  emit('model-error', error.message)
}

function speakAlert(){
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext
    audioContext ||= new Ctx()
    const oscillator = audioContext.createOscillator()
    const gain = audioContext.createGain()
    oscillator.frequency.value = 660
    gain.gain.value = .05
    oscillator.connect(gain); gain.connect(audioContext.destination)
    audioContext.resume?.()
    oscillator.start(); oscillator.stop(audioContext.currentTime + .3)
  } catch {}
}

function stopMonitoring(notifyStatus = enabled.value || active.value){
  stopLoop()
  initializationId += 1
  cancelInitialization?.()
  cancelInitialization = undefined
  landmarker?.close?.(); landmarker = null
  faceDetector?.close?.(); faceDetector = null
  mode = 'off'
  if (stream) { stream.getTracks().forEach(track => track.stop()); stream = null }
  if (video.value) video.value.srcObject = null
  machine.reset(0)
  resetAll([filters.yaw, filters.pitch, filters.eyeOpen, filters.faceRatio])
  emaFrameMs = 0; targetFps = 15; noFaceSince = 0; lastProcessed = 0; lastVideoTimestamp = 0; lastSampleAt = 0; processedFrames = 0; downgradeFailed = false
  state.value = {
    ...state.value, isPresent: true, continuousAwaySeconds: 0, cameraReady: false, modelReady: false,
    supervisionEnabled: false, attentionState: 'focused', attentionLabel: ATTENTION_LABELS.focused,
    eyeOpen: 1, yaw: 0, pitch: 0, faceCount: 0, mode: 'off', message: '摄像头监督已关闭'
  }
  if (notifyStatus) emit('status', { ...state.value })
  if (audioContext && audioContext.state !== 'closed') { try { audioContext.close() } catch {} audioContext = null }
}
function markFalsePositive(){ emit('false-positive', { ...state.value, createdAt: Date.now(), reason: 'user-marked' }) }
function onVisibility(){ if (document.visibilityState === 'hidden' && enabled.value) disable() }
window.addEventListener('visibilitychange', onVisibility)
onBeforeUnmount(() => { stopMonitoring(); window.removeEventListener('visibilitychange', onVisibility) })
defineExpose({ requestEnable, disable, stopMonitoring, state })
</script>
<template>
  <div class="camera-monitor surface surface-pad" :class="{ compact, bare }">
    <div v-if="!bare" class="camera-head"><div><strong>端侧摄像头监督</strong><p class="muted">{{ state.message }}</p></div><div class="camera-head-actions"><button v-if="active" type="button" class="preview-toggle" @click="previewCollapsed = !previewCollapsed">{{ previewCollapsed ? '展开预览' : '收起预览' }}</button><el-switch :model-value="enabled" active-text="开启" inactive-text="关闭" @change="value => value ? requestEnable() : disable()" /></div></div>
    <div v-show="active" class="video-wrap" :class="{ 'is-collapsed': !bare && previewCollapsed }">
      <video ref="video" muted playsinline></video>
      <span v-if="!bare" class="privacy-badge">● 端侧 MediaPipe · 不联网</span>
      <span v-if="!bare" class="attention-pill" :class="state.attentionState">{{ state.attentionLabel }}</span>
      <el-button v-if="!bare" size="small" plain @click="markFalsePositive">误判？告诉我们</el-button>
    </div>
    <div v-if="bare && !active" class="bare-empty">
      <button type="button" @click="requestEnable">开启学习画面</button>
      <small>只在本机识别走神和离开</small>
    </div>
    <p v-if="!bare && active && previewCollapsed" class="preview-collapsed-note">预览已收起，检测仍在运行</p>
    <p v-if="!bare && state.supervisionEnabled" class="vision-line">睁眼 {{ eyePercent }}% · 左右 {{ state.yaw }}° · 俯仰 {{ state.pitch }}° · 人脸 {{ state.faceCount }}</p>
    <p v-if="!bare" class="privacy-note">图像帧只在浏览器本地处理，不上传云端、不写入磁盘、不截图保存、不识别身份，本地检测在岗、头部朝向、闭眼和多人；分心、犯困、多人只做温和提示，不会暂停计时</p>
    <el-dialog v-model="consentVisible" title="开启前请阅读隐私说明" width="460px" append-to-body>
      <div class="camera-consent">开启后，浏览器会请求摄像头权限，所有图像帧仅在本机推理（MediaPipe Face Landmarker，Apache 2.0），检测是否在岗、头部朝向、闭眼和多人，不上传云端、不识别身份、不写入磁盘或截图保存，离开专注页、关闭开关或页面卸载时，摄像头会立即停止</div>
      <template #footer><el-button @click="consentVisible=false">暂不开启</el-button><el-button type="primary" @click="acceptConsent">我已阅读并同意</el-button></template>
    </el-dialog>
  </div>
</template>
<style scoped>.camera-head{display:flex;justify-content:space-between;align-items:center}.camera-head p{margin:6px 0 0;font-size:calc(13px*var(--fs-scale))}.privacy-note{color:var(--muted);font-size:calc(12px*var(--fs-scale));line-height:1.6;margin:15px 0 0}.vision-line{color:var(--muted);font-size:calc(12px*var(--fs-scale));margin:8px 0 0}.video-wrap{margin-top:15px;position:relative;overflow:hidden;border-radius:13px;background:#12302f;min-height:170px}.video-wrap video{display:block;width:100%;max-height:250px;object-fit:cover;transform:scaleX(-1)}.privacy-badge{position:absolute;left:12px;top:12px;padding:5px 8px;border-radius:9px;background:rgba(18,48,47,.76);color:#d9efe6;font-size:calc(11px*var(--fs-scale))}.attention-pill{position:absolute;right:12px;top:12px;padding:5px 9px;border-radius:9px;background:rgba(18,48,47,.76);color:#d9efe6;font-size:calc(11px*var(--fs-scale))}.attention-pill.away{background:rgba(160,52,52,.82);color:#ffe9e6}.attention-pill.drowsy,.attention-pill.multiple{background:rgba(158,112,42,.85);color:#fff4de}.attention-pill.looking-away,.attention-pill.head-down{background:rgba(52,92,128,.85);color:#e6f1ff}.video-wrap .el-button{position:absolute;right:10px;bottom:10px;background:rgba(255,255,255,.92)}
.camera-monitor.compact{padding:14px}
.camera-monitor.compact .camera-head{gap:8px}
.camera-monitor.compact .camera-head>div{min-width:0}
.camera-monitor.compact :deep(.el-switch__label){display:none}
.camera-monitor.compact .camera-head strong{font-size:calc(13px*var(--fs-scale));white-space:nowrap}
.camera-monitor.compact .camera-head p{margin-top:4px;font-size:calc(12px*var(--fs-scale));line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.camera-monitor.compact .video-wrap{margin-top:10px;min-height:0;height:300px;border-radius:12px}
.camera-monitor.compact .video-wrap video{height:300px;max-height:none}
.camera-monitor.compact .privacy-note{display:none}
.camera-monitor.compact .vision-line{display:none}
.camera-monitor.compact .privacy-badge{left:8px;top:8px;padding:3px 6px;font-size:calc(10px*var(--fs-scale))}
.camera-monitor.compact .attention-pill{right:8px;top:8px;padding:3px 6px;font-size:calc(10px*var(--fs-scale))}
.camera-monitor.compact .video-wrap .el-button{right:8px;bottom:8px}
.camera-head-actions{display:flex;align-items:center;gap:10px;flex:none}
.preview-toggle{padding:4px 9px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--muted);font-size:calc(11px*var(--fs-scale));line-height:1.4;cursor:pointer;white-space:nowrap}
.preview-toggle:hover{border-color:var(--primary);color:var(--primary)}
.preview-collapsed-note{margin:8px 0 0;font-size:calc(11px*var(--fs-scale));color:var(--muted)}
/* 折叠只把画面缩到 2px 并移出视口，video 仍在播放，检测循环不受影响。 */
.camera-monitor.compact .video-wrap.is-collapsed{position:fixed;left:0;top:0;width:2px;height:2px;min-height:0;margin:0;padding:0;opacity:.02;overflow:hidden;border-radius:0;pointer-events:none}
.video-wrap.is-collapsed video{width:2px;height:2px;max-height:none}
.video-wrap.is-collapsed>*:not(video){display:none}
/* bare：只保留画面，供专注页自定义视频卡使用 */
.camera-monitor.bare{padding:0;border:0;border-radius:0;background:transparent;box-shadow:none}
.camera-monitor.bare .video-wrap{margin:0;border-radius:10px;background:#2b352f;min-height:0;height:auto;aspect-ratio:292/164}
.camera-monitor.bare .video-wrap video{width:100%;height:100%;max-height:none;object-fit:cover}
.bare-empty{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;aspect-ratio:292/164;border-radius:10px;background:var(--surface-soft);text-align:center}
.bare-empty button{padding:7px 16px;border:1px solid var(--border);border-radius:999px;background:var(--surface);color:var(--primary);font-family:inherit;font-size:calc(12px*var(--fs-scale));line-height:1.4;cursor:pointer}
.bare-empty button:hover{background:var(--primary-soft)}
.bare-empty small{font-size:calc(11px*var(--fs-scale));color:var(--muted);line-height:1.5}</style>
