// 本地语音识别：句子在浏览器里跑，音频不出本机。
// 依赖 transformers.js + Whisper（ONNX），模型首次使用时下载并缓存在浏览器缓存里，
// 之后完全离线。推理引擎的 wasm 已随项目放在 public/ort/，不再走 CDN。
//
// 之所以不用浏览器自带的 SpeechRecognition：它把音频发到云端，国内网络基本不可用，
// 而且和「学习数据不出本机」的定位冲突。

// 模型文件随项目放在 public/models 下，启动后从本站加载，识别全程不出本机。
// 之所以不做「首次使用时从网上下载」：镜像对并发请求不稳定，学生家里下载几十 MB
// 也很容易失败，背诵功能会直接不可用。
//
// 用 tiny 而不是 base：同一段 3 秒音频，base 在单线程 wasm 下要 17 秒，tiny 只要 1.5 秒。
// 背诵是「说完立刻要反馈」的场景，等待 17 秒等于不可用，所以宁可牺牲一点准确率，
// 再用比对算法（reciteAlign）容忍个别错字。
const MODEL_ID = import.meta.env.VITE_ASR_MODEL || 'Xenova/whisper-tiny'
const MODEL_ROOT = '/models/'

let pipelinePromise = null
let loadedPipeline = null

/**
 * 下载并加载语音模型。重复调用返回同一个实例，不会重复下载。
 * @param {{ onProgress?: (info: {status: string, progress: number, file?: string}) => void }} options
 */
export async function loadSpeechModel({ onProgress } = {}) {
  if (loadedPipeline) return loadedPipeline
  if (pipelinePromise) return pipelinePromise
  pipelinePromise = (async () => {
    const { pipeline, env } = await import('@huggingface/transformers')
    // 只认本站的模型目录，不联网：识别全程在本机完成，音频和文字都不会离开浏览器。
    env.allowRemoteModels = false
    env.allowLocalModels = true
    env.localModelPath = MODEL_ROOT
    if (env.backends?.onnx?.wasm) {
      env.backends.onnx.wasm.wasmPaths = '/ort/'
      // 没有 COOP/COEP 头时 SharedArrayBuffer 不可用，多线程会直接报错，固定单线程。
      env.backends.onnx.wasm.numThreads = 1
    }
    const pipe = await pipeline('automatic-speech-recognition', MODEL_ID, {
      dtype: 'q8',
      progress_callback: info => {
        if (typeof onProgress !== 'function') return
        // 只把真正影响等待感的阶段透出去：下载模型文件和加载进度。
        if (info?.status === 'progress' || info?.status === 'done' || info?.status === 'initiate') {
          onProgress({
            status: info.status,
            progress: Number(info.progress) || 0,
            file: String(info.file || '')
          })
        }
      }
    })
    loadedPipeline = pipe
    return pipe
  })().catch(error => {
    // 失败后清空句柄，用户重试时可以重新发起下载。
    pipelinePromise = null
    throw error
  })
  return pipelinePromise
}

export function isSpeechModelReady() {
  return Boolean(loadedPipeline)
}

/**
 * 识别一段 16kHz 单声道音频。
 * @param {Float32Array} audio
 * @param {{ language?: string }} options
 * @returns {Promise<string>} 去掉首尾空白的识别文本
 */
export async function transcribeSegment(audio, { language = 'chinese' } = {}) {
  const pipe = await loadSpeechModel()
  const result = await pipe(audio, {
    language,
    task: 'transcribe',
    // 背诵是一句一句说的，关掉时间戳能让输出更快。
    return_timestamps: false,
    chunk_length_s: 30
  })
  const text = Array.isArray(result) ? result.map(item => item?.text || '').join('') : (result?.text || '')
  return String(text).replace(/\s+/g, ' ').trim()
}

// 把任意采样率的单声道数据线性插值到 16kHz。AudioContext 大多数情况已经给到 16k，
// 但部分设备会拒绝指定采样率，这里必须兜住，否则送进模型的音频速度是错的。
export function resampleTo16k(input, sourceRate) {
  const targetRate = 16000
  if (!input?.length || !sourceRate || sourceRate === targetRate) return input
  const ratio = sourceRate / targetRate
  const length = Math.max(1, Math.round(input.length / ratio))
  const output = new Float32Array(length)
  for (let i = 0; i < length; i += 1) {
    const position = i * ratio
    const index = Math.floor(position)
    const next = Math.min(index + 1, input.length - 1)
    const weight = position - index
    output[i] = input[index] * (1 - weight) + input[next] * weight
  }
  return output
}

// 判断一帧是不是「有人在说话」：用 RMS 与浮动噪声底噪比较，比固定阈值更抗风扇声。
export function isVoicedFrame(level, noiseFloor) {
  return level > Math.max(0.008, noiseFloor * 2.6)
}

/**
 * 麦克风录音 + 静音切段。
 * 每说完一句（静音超过 silenceMs）回调一次 onSegment，界面上就能逐句比对。
 */
export function createVoiceRecorder({
  onSegment,
  onLevel,
  onStateChange,
  silenceMs = 900,
  maxSegmentMs = 15000,
  minSegmentMs = 400
} = {}) {
  let ctx = null
  let stream = null
  let source = null
  let processor = null
  let sink = null
  let chunks = []
  let silentMs = 0
  let voicedMs = 0
  let noiseFloor = 0.004
  let active = false

  function flush() {
    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
    if (!total) return
    const merged = new Float32Array(total)
    let offset = 0
    for (const chunk of chunks) {
      merged.set(chunk, offset)
      offset += chunk.length
    }
    chunks = []
    // 太短的段落（咳嗽、翻书声）直接丢掉，避免拿噪声去比对文本。
    if (voicedMs < minSegmentMs) { voicedMs = 0; silentMs = 0; return }
    voicedMs = 0
    silentMs = 0
    const audio = resampleTo16k(merged, ctx?.sampleRate || 16000)
    if (typeof onSegment === 'function') onSegment(audio)
  }

  async function start() {
    if (active) return
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
    })
    ctx = new AudioContext({ sampleRate: 16000 })
    source = ctx.createMediaStreamSource(stream)
    processor = ctx.createScriptProcessor(4096, 1, 1)
    // ScriptProcessor 只有接到 destination 才会持续触发，用一个零增益节点吞掉声音。
    sink = ctx.createGain()
    sink.gain.value = 0
    processor.onaudioprocess = event => {
      if (!active) return
      const data = event.inputBuffer.getChannelData(0)
      const copy = new Float32Array(data.length)
      copy.set(data)
      chunks.push(copy)

      let sum = 0
      for (let i = 0; i < data.length; i += 1) sum += data[i] * data[i]
      const level = Math.sqrt(sum / data.length)
      // 底噪缓慢跟随，只在安静时更新，避免把人声也算进去。
      if (level < noiseFloor * 1.5) noiseFloor = noiseFloor * 0.92 + level * 0.08
      const voiced = isVoicedFrame(level, noiseFloor)
      const frameMs = (data.length / (ctx?.sampleRate || 16000)) * 1000
      if (voiced) { voicedMs += frameMs; silentMs = 0 } else { silentMs += frameMs }
      if (typeof onLevel === 'function') onLevel(level, voiced)

      const collectedMs = (chunks.reduce((sum2, chunk) => sum2 + chunk.length, 0) / (ctx?.sampleRate || 16000)) * 1000
      if (silentMs >= silenceMs && voicedMs >= minSegmentMs) flush()
      else if (collectedMs >= maxSegmentMs) flush()
    }
    source.connect(processor)
    processor.connect(sink)
    sink.connect(ctx.destination)
    active = true
    if (typeof onStateChange === 'function') onStateChange('listening')
  }

  function stop() {
    if (!active) return
    active = false
    flush()
    if (typeof onStateChange === 'function') onStateChange('idle')
    processor?.disconnect()
    source?.disconnect()
    sink?.disconnect()
    stream?.getTracks().forEach(track => track.stop())
    ctx?.close?.()
    processor = null; source = null; sink = null; stream = null; ctx = null
  }

  return { start, stop, get active() { return active } }
}
