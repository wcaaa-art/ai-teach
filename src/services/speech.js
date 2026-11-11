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
  window.speechSynthesis.cancel()
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
  window.speechSynthesis.speak(utterance)
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
