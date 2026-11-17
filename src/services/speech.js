const friendlyVoiceNames = /xiaoxiao|晓晓|小晓|tingting|婷婷|mei.?jia|美佳|google.*普通话|普通话.*google|yaoyao|瑶瑶|huihui|慧慧/i

export function chooseFriendlyChineseVoice() {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  const chineseVoices = voices.filter(voice => /^zh(?:-|_)?/i.test(voice.lang) || /中文|普通话|mandarin/i.test(voice.name))
  return chineseVoices.find(voice => friendlyVoiceNames.test(`${voice.name} ${voice.lang}`))
    || chineseVoices.find(voice => /female|女|云希|晓|婷婷|美佳/i.test(voice.name))
    || chineseVoices.find(voice => /cn|普通话|mandarin/i.test(`${voice.name} ${voice.lang}`))
    || chineseVoices[0]
    || null
}

export function speakWithFriendlyChineseVoice(text, callbacks = {}) {
  if (!('speechSynthesis' in window)) return false
  const utterance = new SpeechSynthesisUtterance(text)
  utterance.lang = 'zh-CN'
  utterance.rate = 0.96
  utterance.pitch = 1.04
  utterance.volume = 1
  const voice = chooseFriendlyChineseVoice()
  if (voice) utterance.voice = voice
  if (typeof callbacks.onstart === 'function') utterance.onstart = callbacks.onstart
  if (typeof callbacks.onend === 'function') utterance.onend = callbacks.onend
  if (typeof callbacks.onerror === 'function') utterance.onerror = callbacks.onerror
  speakAfterCancel(utterance)
  return true
}

// 英语听写要把单词读标准，中文音色读英文会带口音，所以单独挑一个英文音色。
// 音色缓存起来：每次 speak 都去 getVoices() 遍历，在高配机上也不划算；
// 更重要的是配合 warmUp 提前把 TTS 引擎拉起来，点喇叭到出声基本是即时的。
let cachedEnglishVoice = null
let voiceHookInstalled = false

function pickEnglishVoice() {
  if (!('speechSynthesis' in window)) return null
  const voices = window.speechSynthesis.getVoices()
  return voices.find(voice => /en-US/i.test(voice.lang) && /samantha|zira|aria|jenny|google/i.test(voice.name))
    || voices.find(voice => /^en-US/i.test(voice.lang))
    || voices.find(voice => /^en[-_]/i.test(voice.lang))
    || null
}

// 在进入背诵页时就调一次：缓存音色 + 用一句听不见的话把引擎唤醒，
// 否则第一次点喇叭要等引擎冷启动（Windows 上常见 300ms 以上的空等）。
export function warmUpEnglishVoice() {
  if (!('speechSynthesis' in window)) return false
  cachedEnglishVoice = pickEnglishVoice()
  if (!voiceHookInstalled && typeof window.speechSynthesis.addEventListener === 'function') {
    voiceHookInstalled = true
    window.speechSynthesis.addEventListener('voiceschanged', () => { cachedEnglishVoice = pickEnglishVoice() })
  }
  // 注意不能用空白文本：部分引擎对纯空白的 utterance 既不 start 也不 end，
  // 会把队列挂死，之后点喇叭排在它后面永远没有声音。必须是真实音节。
  const warm = new SpeechSynthesisUtterance('ok')
  warm.volume = 0
  warm.lang = cachedEnglishVoice?.lang || 'en-US'
  if (cachedEnglishVoice) warm.voice = cachedEnglishVoice
  warm.onerror = () => {}
  window.speechSynthesis.speak(warm)
  return true
}

// Chrome 已知竞态：正在朗读时 cancel() 后立刻 speak()，新的一句会被 cancel 波及吞掉，
// 表现就是「点了没反应」。只在确实有朗读在跑/排队时，让 cancel 先落地再补一句；
// 60ms 的人耳不可感知，但换回的是每一句都出声。
function speakAfterCancel(utterance) {
  const synth = window.speechSynthesis
  const busy = synth.speaking || synth.pending
  synth.cancel()
  if (busy) window.setTimeout(() => synth.speak(utterance), 60)
  else synth.speak(utterance)
}

export function speakEnglishWord(word, callbacks = {}) {
  if (!('speechSynthesis' in window)) return false
  const utterance = new SpeechSynthesisUtterance(String(word || ''))
  const english = cachedEnglishVoice || pickEnglishVoice()
  if (!cachedEnglishVoice) cachedEnglishVoice = english
  utterance.lang = english?.lang || 'en-US'
  if (english) utterance.voice = english
  // 0.86 太拖，点完半天才进入正题；0.92 开口快、音节仍听得清。
  utterance.rate = 0.92
  utterance.pitch = 1
  utterance.volume = 1
  if (typeof callbacks.onstart === 'function') utterance.onstart = callbacks.onstart
  if (typeof callbacks.onend === 'function') utterance.onend = callbacks.onend
  utterance.onerror = event => {
    console.warn('英语朗读没出声：', event?.error || event)
    if (typeof callbacks.onerror === 'function') callbacks.onerror(event)
  }
  speakAfterCancel(utterance)
  return true
}

export function pauseSpeech() {
  if (!('speechSynthesis' in window)) return false
  window.speechSynthesis.pause()
  return true
}

export function resumeSpeech() {
  if (!('speechSynthesis' in window)) return false
  window.speechSynthesis.resume()
  return true
}

export function stopSpeech() {
  if (!('speechSynthesis' in window)) return false
  window.speechSynthesis.cancel()
  return true
}
