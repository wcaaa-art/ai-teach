import { reactive, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { extractQuestion } from '../services/api.js'

// 手写作答：拍照/上传后只在本机保存，OCR 识别是可选的辅助手段，识别结果可手动改。
// 从 QuizView 抽出：页面只负责渲染，答题文本由调用方注入，识别结果追加回答案。
export function useAnswerPhotos(answers) {
  const answerImages = reactive({})
  const ocrLoading = reactive({})
  // 原始 File 只留在内存里给 OCR 用；草稿只存压缩后的 dataURL。
  const photoFiles = new Map()
  const photoTarget = ref('')
  const photoInput = ref(null)

  function pickPhoto(question) {
    photoTarget.value = question.id
    photoInput.value?.click()
  }

  function removePhoto(question) {
    delete answerImages[question.id]
    photoFiles.delete(question.id)
  }

  function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result || ''))
      reader.onerror = () => reject(new Error('读取图片失败'))
      reader.readAsDataURL(file)
    })
  }

  // 长边压到 1280 再存，避免整张原图把 IndexedDB 撑爆。
  async function compressImage(file) {
    const raw = await readFileAsDataUrl(file)
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = raw
      })
      const scale = Math.min(1, 1280 / Math.max(image.width, image.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(image.width * scale)
      canvas.height = Math.round(image.height * scale)
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height)
      return canvas.toDataURL('image/jpeg', 0.72)
    } catch { return raw }
  }

  async function onPhotoChange(event) {
    const file = event.target.files?.[0]
    event.target.value = ''
    const id = photoTarget.value
    if (!file || !id) return
    if (!file.type.startsWith('image/')) { ElMessage.info('请选择图片文件'); return }
    photoFiles.set(id, file)
    answerImages[id] = { dataUrl: await compressImage(file), name: file.name }
    ElMessage.success('已添加手写稿，可点「识别成文字」自动填入，也可以只保留照片')
  }

  async function recognizePhoto(question) {
    if (ocrLoading[question.id]) return
    let file = photoFiles.get(question.id)
    // 草稿恢复后只剩压缩后的 dataURL，重新包成 File 再走 OCR，避免「照片在但识别不了」。
    if (!file && answerImages[question.id]?.dataUrl) {
      try {
        const blob = await (await fetch(answerImages[question.id].dataUrl)).blob()
        file = new File([blob], answerImages[question.id].name || 'answer.jpg', { type: blob.type || 'image/jpeg' })
        photoFiles.set(question.id, file)
      } catch { /* 转 File 失败时按没有原始照片处理 */ }
    }
    if (!file) { ElMessage.info('这份草稿只有照片预览，无法重新识别；请重新选择照片或手动输入'); return }
    ocrLoading[question.id] = true
    try {
      const response = await extractQuestion(file)
      if (!response.success) {
        ElMessage.warning(`识别失败：${response.error || '未知原因'}，可以手动输入或只保留照片`)
        return
      }
      const text = String(response.data?.text || '').trim()
      if (!text) { ElMessage.info('没有识别到文字，可以手动输入或只保留照片'); return }
      const current = String(answers[question.id] ?? '').trim()
      answers[question.id] = current ? `${current}\n${text}` : text
      ElMessage.success('已识别并填入，手写内容可能有误，请核对后再交卷')
    } finally {
      ocrLoading[question.id] = false
    }
  }

  // 重新出题/恢复草稿时清掉内存里的原始文件，answerImages 由调用方一起清。
  function clearPhotoFiles() { photoFiles.clear() }

  return {
    answerImages, ocrLoading, photoTarget, photoInput,
    pickPhoto, removePhoto, onPhotoChange, recognizePhoto, clearPhotoFiles
  }
}
