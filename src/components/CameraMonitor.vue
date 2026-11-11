<script setup>
import { onBeforeUnmount, ref } from 'vue'

const props = defineProps({ lowPerformance: Boolean, soundEnabled: { type: Boolean, default: true }, defaultEnabled: Boolean, compact: Boolean })
const emit = defineEmits(['status', 'alert', 'false-positive', 'model-error'])
const enabled = ref(false); const consentVisible = ref(false); const active = ref(false); const video = ref(null)
const state = ref({ isPresent: true, continuousAwaySeconds: 0, modelReady: false, cameraReady: false, supervisionEnabled: false, message: '摄像头监督已关闭' })
let stream; let detector; let tf; let FaceDetector; let FilesetResolver; let audioContext; let animationId; let absentSince = 0; let warned = false; let lastEmit = 0; let initializationId=0;let cancelInitialization
// 单帧误检会让“在岗/离岗”频繁闪烁：连续 3 帧不在岗才判定离岗，检测到人脸则立即恢复。
let stablePresent = true; let absentFrames = 0; let lastPresent = true

function requestEnable(){ consentVisible.value = true }
async function acceptConsent(){ consentVisible.value=false; enabled.value=true;if(props.soundEnabled){try{const AudioContextClass=window.AudioContext||window.webkitAudioContext;if(AudioContextClass){audioContext=new AudioContextClass();await audioContext.resume()}}catch{}}await startMonitoring() }
function disable(){ const shouldNotify=enabled.value||active.value;enabled.value=false;initializationId++;cancelInitialization?.();cancelInitialization=undefined;stopMonitoring(shouldNotify) }
async function startMonitoring(){
  const requestId=++initializationId
  if (props.lowPerformance) { enabled.value=false;state.value.message='设置中的低配模式已关闭视觉推理，仅保留页面切标签检测。请到“设置 → 性能与连接”关闭低配模式后再试。';emit('model-error',state.value.message);return }
  const startupWatchdog=setTimeout(()=>{if(requestId===initializationId&&stream){active.value=true;state.value={...state.value,cameraReady:true,modelReady:false,supervisionEnabled:false,message:'摄像头已连接，但视觉模型加载超时；已保留本地预览并降级为页面检测'};emit('model-error','视觉模型加载超时');}},45000)
  try {
    if (!window.isSecureContext || !navigator.mediaDevices?.getUserMedia) throw new Error('当前浏览器环境不支持摄像头：请使用 localhost 或 HTTPS，并确认浏览器支持 MediaDevices。')
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }, audio: false })
    if(requestId!==initializationId||!enabled.value){stream.getTracks().forEach(track=>track.stop());stream=null;return}
    if (!video.value) {stream.getTracks().forEach(track=>track.stop());stream=null;return}
    video.value.srcObject = stream; await video.value.play();active.value=true;state.value={...state.value,cameraReady:true,message:'摄像头已连接，正在加载本地视觉模型…'}
    // 重型视觉依赖只在学生同意后按需加载，摄像头关闭时不初始化 GPU 模型。
    const [tfModule, visionModule] = await Promise.all([import('@tensorflow/tfjs'), import('@mediapipe/tasks-vision')])
    if(requestId!==initializationId||!enabled.value)return
    tf=tfModule; FaceDetector=visionModule.FaceDetector; FilesetResolver=visionModule.FilesetResolver
    await import('@tensorflow/tfjs-backend-webgl')
    await tf.setBackend('webgl').catch(() => tf.setBackend('cpu')); await tf.ready()
    if(requestId!==initializationId||!enabled.value){await releaseTensorBackend();return}
    const resolver = await FilesetResolver.forVisionTasks('/mediapipe')
    if(requestId!==initializationId||!enabled.value)return
    const detectorPromise=FaceDetector.createFromOptions(resolver, { baseOptions: { modelAssetPath: '/models/blaze_face_short_range.tflite', delegate: 'GPU' }, runningMode: 'VIDEO', minDetectionConfidence: .55 })
    detectorPromise.then(lateDetector=>{if(requestId!==initializationId||!enabled.value)lateDetector.close()}).catch(()=>{})
    let initializationTimer;const cancellation=new Promise((_,reject)=>{cancelInitialization=()=>reject(new Error('摄像头初始化已取消'))});detector=await Promise.race([detectorPromise,cancellation,new Promise((_,reject)=>{initializationTimer=setTimeout(()=>reject(new Error('视觉模型加载超时')),25000)})]).finally(()=>{clearTimeout(initializationTimer);cancelInitialization=undefined})
    if(requestId!==initializationId||!enabled.value){detector.close();detector=null;return}
    active.value=true;state.value.modelReady=true;state.value.supervisionEnabled=true;state.value.message='视觉推理运行中（仅本地）';loop()
  } catch (error) {
    if(requestId===initializationId){
      const permissionMessage=error.name==='NotAllowedError'?'浏览器拒绝了摄像头权限，可在地址栏重新允许。':error.name==='NotFoundError'?'没有找到可用摄像头，请检查设备连接。':error.message||'摄像头或模型暂时不可用。'
      if(stream){active.value=true;state.value={...state.value,cameraReady:true,modelReady:false,supervisionEnabled:false,message:`摄像头已连接，但视觉模型不可用：${permissionMessage}`};emit('model-error',permissionMessage)}
      else {enabled.value=false;stopMonitoring(true);emit('model-error',permissionMessage);state.value.message=permissionMessage}
    }
  } finally { clearTimeout(startupWatchdog) }
}
function loop(){
  if (!active.value || !detector || !video.value) return
  try {
  if (!video.value.videoWidth || !video.value.videoHeight) { animationId=requestAnimationFrame(loop); return }
  const result = detector.detectForVideo(video.value, performance.now()); const detections = result.detections || []
  const box = detections[0]?.boundingBox
  // MediaPipe 负责粗检测人脸，TensorFlow.js 在本地 GPU 上计算中心偏移，不识别身份。
  const centered = box && tf.tidy(() => {
    const bounds = tf.tensor1d([box.originX, box.width, box.originY, box.height])
    const centerX = tf.add(bounds.slice([0], [1]), tf.div(bounds.slice([1], [1]), 2))
    const centerY = tf.add(bounds.slice([2], [1]), tf.div(bounds.slice([3], [1]), 2))
    const offsetX = tf.sub(tf.div(centerX, video.value.videoWidth), .5)
    const offsetY = tf.sub(tf.div(centerY, video.value.videoHeight), .5)
    const offsets = tf.concat([offsetX, offsetY]).dataSync()
    return Math.abs(offsets[0]) < .35 && Math.abs(offsets[1]) < .38 && box.width / video.value.videoWidth > .08
  })
  const present = Boolean(box && centered)
  if (present) { stablePresent = true; absentFrames = 0 } else { absentFrames += 1; if (absentFrames >= 3) stablePresent = false }
  const now=Date.now();
  if (!stablePresent) { if(!absentSince) absentSince=now } else { absentSince=0; warned=false }
  const away = absentSince ? Math.floor((now-absentSince)/1000) : 0
  state.value={...state.value,isPresent:stablePresent,continuousAwaySeconds:away,message:stablePresent?'在岗中':'暂未检测到正面人脸'}
  if (stablePresent !== lastPresent || now-lastEmit>1000){ emit('status',{...state.value}); lastEmit=now; lastPresent=stablePresent }
  if (away >= 10 && !warned){ warned=true; if(props.soundEnabled) speakAlert(); emit('alert',{continuousAwaySeconds:away,soundPlayed:props.soundEnabled}) }
  animationId=requestAnimationFrame(loop)
  } catch(error) { detector?.close?.();detector=null;cancelAnimationFrame(animationId);animationId=undefined;releaseTensorBackend().catch(()=>{});state.value={...state.value,modelReady:false,supervisionEnabled:false,message:`视觉检测暂时不可用，已保留摄像头预览：${error.message}`};emit('model-error',error.message) }
}
function speakAlert(){ try { const Ctx=window.AudioContext||window.webkitAudioContext; audioContext ||= new Ctx(); const oscillator=audioContext.createOscillator(); const gain=audioContext.createGain(); oscillator.frequency.value=660; gain.gain.value=.05; oscillator.connect(gain);gain.connect(audioContext.destination);audioContext.resume?.();oscillator.start();oscillator.stop(audioContext.currentTime+.3) } catch {} }
async function releaseTensorBackend(){try{if(tf?.getBackend()==='webgl'){tf.backend().dispose();await tf.setBackend('cpu')}}catch{}}
async function stopMonitoring(notifyStatus=enabled.value||active.value){initializationId++;cancelInitialization?.();cancelInitialization=undefined;active.value=false;if(animationId)cancelAnimationFrame(animationId);animationId=undefined;detector?.close?.();detector=null;if(stream){stream.getTracks().forEach(track=>track.stop());stream=null};if(video.value)video.value.srcObject=null;absentSince=0;warned=false;stablePresent=true;absentFrames=0;lastPresent=true;state.value={...state.value,isPresent:true,continuousAwaySeconds:0,cameraReady:false,modelReady:false,supervisionEnabled:false,message:'摄像头监督已关闭'};if(notifyStatus)emit('status',{...state.value});await releaseTensorBackend();if(audioContext&&audioContext.state!=='closed'){try{await audioContext.close()}catch{}audioContext=null} }
function markFalsePositive(){ emit('false-positive',{...state.value,createdAt:Date.now(),reason:'user-marked'}) }
function onVisibility(){ if(document.visibilityState==='hidden' && enabled.value) disable() }
window.addEventListener('visibilitychange', onVisibility)
onBeforeUnmount(()=>{ stopMonitoring(); window.removeEventListener('visibilitychange',onVisibility) })
defineExpose({ requestEnable, disable, stopMonitoring, state })
</script>
<template>
  <div class="camera-monitor surface surface-pad" :class="{ compact }">
    <div class="camera-head"><div><strong>端侧摄像头监督</strong><p class="muted">{{ state.message }}</p></div><el-switch :model-value="enabled" active-text="开启" inactive-text="关闭" @change="value => value ? requestEnable() : disable()" /></div>
    <div v-show="active" class="video-wrap"><video ref="video" muted playsinline></video><span class="privacy-badge">● 本地 GPU 推理</span><el-button size="small" plain @click="markFalsePositive">误判？告诉我们</el-button></div>
    <p class="privacy-note">图像帧只在浏览器本地处理，不上传云端、不写入磁盘、不截图保存。仅检测“是否在岗”和头部大幅偏移。</p>
    <el-dialog v-model="consentVisible" title="开启前请阅读隐私说明" width="460px">
      <div class="camera-consent">开启后，浏览器会请求摄像头权限。所有图像帧仅在本地 GPU 推理，视频流不会上传云端，也不会写入磁盘或截图保存。离开专注页、关闭开关或页面卸载时，摄像头会立即停止。</div>
      <template #footer><el-button @click="consentVisible=false">暂不开启</el-button><el-button type="primary" @click="acceptConsent">我已阅读并同意</el-button></template>
    </el-dialog>
  </div>
</template>
<style scoped>.camera-head{display:flex;justify-content:space-between;align-items:center}.camera-head p{margin:6px 0 0;font-size:13px}.privacy-note{color:var(--muted);font-size:12px;line-height:1.6;margin:15px 0 0}.video-wrap{margin-top:15px;position:relative;overflow:hidden;border-radius:13px;background:#12302f;min-height:170px}.video-wrap video{display:block;width:100%;max-height:250px;object-fit:cover;transform:scaleX(-1)}.privacy-badge{position:absolute;left:12px;top:12px;padding:5px 8px;border-radius:9px;background:rgba(18,48,47,.76);color:#d9efe6;font-size:11px}.video-wrap .el-button{position:absolute;right:10px;bottom:10px;background:rgba(255,255,255,.92)}
.camera-monitor.compact{padding:14px}
.camera-monitor.compact .camera-head{gap:8px}
.camera-monitor.compact .camera-head>div{min-width:0}
.camera-monitor.compact :deep(.el-switch__label){display:none}
.camera-monitor.compact .camera-head strong{font-size:13px;white-space:nowrap}
.camera-monitor.compact .camera-head p{margin-top:4px;font-size:12px;line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.camera-monitor.compact .video-wrap{margin-top:10px;min-height:0;height:96px;border-radius:9px}
.camera-monitor.compact .video-wrap video{height:96px;max-height:none}
.camera-monitor.compact .privacy-note{display:none}
.camera-monitor.compact .privacy-badge{left:8px;top:8px;padding:3px 6px;font-size:10px}
.camera-monitor.compact .video-wrap .el-button{right:8px;bottom:8px}</style>
