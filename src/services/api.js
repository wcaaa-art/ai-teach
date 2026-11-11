// @ts-check
const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'
// 后端没起、端口不匹配或请求被代理回落成 HTML 时，直接 response.json() 会抛
// "Unexpected token '<'" 这类原始解析错误，学生看不懂。统一换成可读提示。
const SERVICE_HINT = '账号服务未启动或不可用，请稍后重试。'

/**
 * @typedef {Object} RequestOptions
 * @property {string} [method]
 * @property {'none'|'json'} [bodyType]
 * @property {Record<string, string>} [headers]
 * @property {number} [timeoutMs]
 */

/**
 * @param {string} path
 * @param {unknown} [body]
 * @param {RequestOptions} [options]
 * @returns {Promise<any>}
 */
async function request(path, body, options = {}) {
  try {
    const response = await fetch(`${API_BASE}${path}`, {
      method: options.method || 'POST', headers: options.bodyType === 'none' ? { ...(options.headers || {}) } : { 'Content-Type': 'application/json', ...(options.headers || {}) },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(options.timeoutMs || 35000)
    })
    const contentType = response.headers.get('content-type') || ''
    const text = await response.text()
    let data = null
    if (text) {
      if (!contentType.includes('application/json')) throw new Error(SERVICE_HINT)
      try { data = JSON.parse(text) } catch { throw new Error(SERVICE_HINT) }
    }
    if (!response.ok) throw new Error(data?.message || (response.status >= 500 ? SERVICE_HINT : `账号服务返回异常（${response.status}），请稍后重试。`))
    return data || { success: true }
  } catch (error) {
    const unreachable = error instanceof TypeError || error.name === 'TimeoutError' || error.name === 'AbortError'
    return { success: false, error: unreachable ? '无法连接本机服务，请确认后端已启动后重试。' : error.message, source: 'fallback' }
  }
}

export const registerAccount = (payload) => request('/auth/register', payload)
export const loginAccount = (payload) => request('/auth/login', payload)
export const fetchCurrentUser = () => request('/auth/me', undefined, { method: 'GET', bodyType: 'none', timeoutMs: 10000 })
export const logoutAccount = () => request('/auth/logout', undefined, { method: 'POST', bodyType: 'none', timeoutMs: 10000 })
export const diagnose = (payload) => request('/agent/diagnose', payload, { timeoutMs: 75000 })
export const iteratePlan = (payload) => request('/agent/iterate', payload, { timeoutMs: 75000 })
export const askTutor = (payload) => request('/agent/tutor', payload)
export const pushVisualStatus = (payload) => request('/agent/visual-status', payload, { timeoutMs: 5000 })
export const generateLearningPlan = (payload) => request('/agent/diagnose', payload, { timeoutMs: 75000 })
// 计划骨架只走本地课程规则，毫秒级返回，用于先把计划页撑起来，AI 文案随后合并。
export const generatePlanSkeleton = (payload) => request('/agent/plan/skeleton', payload, { timeoutMs: 10000 })
// 科目按年级开设（物理从初二、化学从初三），必须把年级带上，否则只会返回首个年级的科目。
export const getCurriculumSubjects = (stage, grade) => request(`/curriculum/subjects?stage=${encodeURIComponent(stage)}${grade ? `&grade=${encodeURIComponent(grade)}` : ''}`, undefined, { method: 'GET', bodyType: 'none', timeoutMs: 10000 })
export const getCurriculumChapters = (grade, subject, edition) => request(`/curriculum/chapters?grade=${encodeURIComponent(grade)}&subject=${encodeURIComponent(subject)}${edition ? `&edition=${encodeURIComponent(edition)}` : ''}`, undefined, { method: 'GET', bodyType: 'none', timeoutMs: 10000 })
// 十道摸底题带推理生成约 60 秒，前端超时必须比后端（90 秒）宽，否则会先被浏览器掐断。
export const generateDiagnosticQuestions = (payload) => request('/agent/assessment/generate', payload, { timeoutMs: 95000 })
// 章节测试可能触发两轮命题（撞题重生成），超时放宽到 90 秒。
export const generateQuizQuestions = (payload) => request('/quiz/generate', payload, { timeoutMs: 90000 })
export const orderPlans = (payload) => request('/agent/plan-sequence', payload)
// 单条任务替换：保留知识点，只换任务形式。
export const replacePlanTask = (payload) => request('/agent/plan/replace', payload, { timeoutMs: 60000 })
export async function askTutorWithImage({ question, image, history = [], sessionId }) {
  return request('/agent/tutor', { question, image, history, sessionId })
}
// 流式答疑：逐帧解析后端 SSE，把推理、正文、工具步骤与安全改写交给调用方。
/**
 * @param {string} frame
 * @returns {{ event: string, data: any } | null}
 */
export function parseSseFrame(frame) {
  const lines = String(frame).split('\n')
  let event = 'message'
  const data = []
  for (const line of lines) {
    if (line.startsWith('event:')) event = line.slice(6).trim()
    else if (line.startsWith('data:')) data.push(line.slice(5).trim())
  }
  if (!data.length) return null
  try { return { event, data: JSON.parse(data.join('\n')) } } catch { return null }
}

function readSseFrame(frame, result, handlers = {}) {
  const parsed = parseSseFrame(frame)
  if (!parsed) return
  const { event, data } = parsed
  if (event === 'meta') { result.source = data.source || result.source; handlers.onMeta?.(data) }
  else if (event === 'thinking') handlers.onThinking?.(data.delta || '')
  else if (event === 'token') { result.content += data.delta || ''; handlers.onToken?.(data.delta || '') }
  else if (event === 'tool') handlers.onTool?.(data)
  else if (event === 'replace') { result.content = data.content || ''; handlers.onReplace?.(data.content || '', data.reason || '') }
  else if (event === 'done') {
    result.content = data.content ?? result.content
    result.source = data.source || result.source
    result.tools = data.tools || []
    handlers.onDone?.(result, data)
  }
}

export async function streamTutor(payload, handlers = {}) {
  const controller = new AbortController()
  handlers.onStart?.(controller)
  const timer = setTimeout(() => controller.abort(), 120000)
  const result = { content: '', source: 'deepseek', tools: [], error: '', cancelled: false }
  try {
    const response = await fetch(`${API_BASE}/agent/tutor/stream`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: controller.signal
    })
    const contentType = response.headers.get('content-type') || ''
    if (!response.ok || !response.body || !contentType.includes('text/event-stream')) throw new Error(SERVICE_HINT)
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const frames = buffer.split('\n\n')
      buffer = frames.pop() || ''
      for (const frame of frames) readSseFrame(frame, result, handlers)
    }
    if (buffer.trim()) readSseFrame(buffer, result, handlers)
    return result
  } catch (error) {
    result.cancelled = controller.signal.aborted
    if (!result.cancelled) {
      result.error = (error instanceof TypeError || error.name === 'TimeoutError') ? '无法连接本机服务，请确认后端已启动后重试。' : error.message
      handlers.onError?.(result.error)
    }
    return result
  } finally { clearTimeout(timer) }
}

// OCR worker 只创建一次：字库有十几 MB，反复 create/terminate 会让每次识别都重新加载。
let ocrWorkerPromise = null

function ensureOcrWorker() {
  if (!ocrWorkerPromise) {
    ocrWorkerPromise = import('tesseract.js')
      .then(({ createWorker }) => createWorker('chi_sim+eng', 1, { logger: () => {} }))
      .catch(error => { ocrWorkerPromise = null; throw error })
  }
  return ocrWorkerPromise
}

// 进入上传页后空闲预热，把首次模型下载挪到学生真正点识别之前。
export async function prewarmOcr() {
  try { await ensureOcrWorker(); return true } catch { return false }
}

export async function extractQuestion(file) {
  let timedOut = false
  try {
    // OCR 在浏览器本地执行，题目照片不会发送到后端。
    let createTimer
    const worker = await Promise.race([ensureOcrWorker(), new Promise((_, reject) => {
      createTimer = setTimeout(() => { timedOut = true; reject(new Error('OCR 模型加载超时')) }, 45000)
    })]).finally(() => clearTimeout(createTimer))
    let recognitionTimer
    const result = await Promise.race([worker.recognize(file), new Promise((_, reject) => {
      recognitionTimer = setTimeout(() => reject(new Error('OCR 识别超时')), 45000)
    })]).finally(() => clearTimeout(recognitionTimer))
    return { success: true, data: { text: result.data.text.trim() }, source: 'local-ocr' }
  } catch (error) {
    // worker 自己崩了才丢弃缓存；超时只放弃本次，下次还能复用已下载的模型。
    if (!timedOut) {
      const worker = await ocrWorkerPromise?.catch?.(() => null)
      await worker?.terminate?.().catch?.(() => {})
      ocrWorkerPromise = null
    }
    return { success: false, error: error.message, source: 'fallback' }
  }
}
