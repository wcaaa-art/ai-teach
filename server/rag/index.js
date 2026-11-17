// 试卷真题检索（RAG）：读取离线构建的题块索引，用 BM25 + 学科/学段加权返回可引用的原文片段。
// 索引由 scripts/build-rag-index.py 生成；运行时只读压缩 JSON，不依赖 Python 与外部向量服务。
import { readFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const INDEX_PATH = join(dirname(fileURLToPath(import.meta.url)), 'rag-index.json.gz')
const K1 = 1.2
const B = 0.6

/** @type {any} */
let cache = null

// 全角转半角并去掉标点空白，与构建脚本使用同一套归一化规则，保证查询与索引词元一致。
export function normalizeText(text = '') {
  return String(text).toLowerCase()
    .replace(/[\uff01-\uff5e]/g, char => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/[^0-9a-z\u4e00-\u9fff]/g, '')
}

// 中文按 2~3 字滑窗切分，数字和英文按整段保留；查询侧去重，避免长词重复计分。
// 滑窗会切到 "xx"/"zz" 这类单字符重复词元：它们多来自填空占位符与公式残留，
// 而 BM25 里稀有词元 IDF 更高，无意义查询（"zzzzzzzzxxxx"）反而能靠它们硬凑出高分结果。
// 这里直接丢弃同字符重复的词元，保留真实语言里普遍存在的滑动片段。
export function tokenizeQuery(text = '') {
  const normalized = normalizeText(text)
  const tokens = new Set()
  const cjk = normalized.replace(/[^0-9a-z\u4e00-\u9fff]/g, '')
  for (const size of [2, 3]) {
    for (let index = 0; index + size <= cjk.length; index += 1) {
      const token = cjk.slice(index, index + size)
      if (/^(.)\1+$/.test(token)) continue
      tokens.add(token)
    }
  }
  // 英文与数字按整段保留：语料里的英文单词本身是完整的，切开反而匹配不上。
  // 少于 3 个字符的英文词（is / am / a 之类）区分度太低，不参与检索。
  for (const word of normalized.match(/[0-9a-z]{3,}/g) || []) tokens.add(word)
  return [...tokens]
}

export function loadRagIndex() {
  if (cache) return cache
  const raw = JSON.parse(gunzipSync(readFileSync(INDEX_PATH)).toString('utf8'))
  const documentLengths = raw.docLengths || []
  const total = documentLengths.reduce((sum, length) => sum + length, 0)
  cache = {
    ...raw,
    documentLengths,
    averageLength: documentLengths.length ? total / documentLengths.length : 0
  }
  return cache
}

export function isRagReady() {
  try { loadRagIndex(); return true } catch { return false }
}

export function getRagStats() {
  const index = loadRagIndex()
  return { ...index.stats, builtAt: index.builtAt, indexSizeChunks: index.chunks.length }
}

// 出处只用文件名，评审和学生都能对照原卷，不编造卷名。
export function formatCitation(chunk = /** @type {any} */ ({})) {
  const name = String(chunk.file || '').split('/').pop() || ''
  return `《${name.replace(/\.pdf$/i, '')}》`
}

// 片段可读性评估。
// 真题 PDF 抽取时公式符号会整段丢失，原文变成 "y\nx\nbx\nc" 这类碎行：
// 检索排序可以接受它（关键词确实命中），但把它当"依据"展示给学生会显得系统在胡言乱语。
// 这里只判断"能不能读"，不判断"相关不相关"，所以阈值取宽一点，避免把正常题面也误杀。
export function assessPassageQuality(text = '') {
  const raw = String(text || '')
  if (!raw.trim()) return { score: 0, low: true, reason: 'empty' }
  const compact = raw.replace(/\s+/g, '')
  const cjk = (compact.match(/[\u4e00-\u9fff]/g) || []).length
  const visible = compact.length || 1
  const cjkRatio = cjk / visible
  // 空白切出来的词有多碎：正常中文题面的词都在 3 字以上，
  // 公式整体丢失后就会碎成 "0," "1," "y" 这种单字符片段，这是最灵敏的一个信号。
  const tokens = raw.split(/\s+/).filter(Boolean)
  const shortRatio = tokens.length ? tokens.filter(token => token.length <= 1).length / tokens.length : 1
  const lines = raw.split('\n').map(line => line.trim()).filter(Boolean)
  const fragmentRatio = lines.length ? lines.filter(line => line.length <= 2).length / lines.length : 1

  let score = 1
  if (shortRatio > 0.44) score -= 0.6
  else if (shortRatio > 0.3) score -= 0.25
  if (cjkRatio < 0.3) score -= 0.25
  else if (cjkRatio < 0.42) score -= 0.1
  if (fragmentRatio > 0.45) score -= 0.2
  if (visible < 40) score -= 0.2
  // 有明确解析结构（【答案】/【解析】）说明抽取基本完整，给一点回补，避免误杀带公式的正常题。
  if (/【(答案|解析|分析)】/.test(raw)) score += 0.12

  const finalScore = Math.max(0, Math.min(1, Number(score.toFixed(2))))
  return { score: finalScore, low: finalScore < 0.42, reason: finalScore < 0.42 ? 'garbled-math' : '', metrics: { cjkRatio: Number(cjkRatio.toFixed(2)), shortRatio: Number(shortRatio.toFixed(2)), fragmentRatio: Number(fragmentRatio.toFixed(2)) } }
}

function stageBoost(chunk, grade) {
  const gradeText = String(grade || '')
  // 只服务初中：初中年级对初中课标片段加权，高中年级不应出现（query 里不会有）。
  if (gradeText.startsWith('初') && chunk.stage === '初中') return 1.15
  return 1
}

/**
 * 检索与问题最相关的真题片段。
 * @param {{ query?: string, subject?: string, grade?: string, topK?: number, minScore?: number, maxChars?: number, minQuality?: number }} [options]
 * @returns {Array<{ id: number, score: number, text: string, citation: string, source: string, subject: string, stage: string, exam: string, year: number, variant: string, file: string, quality: number, lowQuality: boolean }>}
 */
export function searchPassages({ query = '', subject = '', grade = '', topK = 4, minScore = 4, maxChars = 900, subjectStrict = false, minQuality = 0 } = {}) {
  const index = loadRagIndex()
  const normalizedQuery = normalizeText(query)
  if (normalizedQuery.length < 2) return []
  const tokens = tokenizeQuery(query)
  if (!tokens.length) return []

  const { chunks, postings, documentLengths, averageLength } = index
  const scores = new Float64Array(chunks.length)
  // 覆盖率只统计 3 字词元：命中“历史”这种高频词不算强相关，命中“辛亥革”才算。
  const coverage = new Float64Array(chunks.length)
  let coverageTotal = 0
  const idfCache = new Map()
  for (const token of tokens) {
    const posting = postings[token]
    if (!posting) continue
    let idf = idfCache.get(token)
    if (idf === undefined) {
      idf = Math.log(1 + (chunks.length - posting.length + 0.5) / (posting.length + 0.5))
      idfCache.set(token, idf)
    }
    const weight = token.length >= 3 ? idf : 0
    // 2 字词元多为“历史”“意义”这类通用词，只给 0.55 权重，让更具体的三字词主导排序。
    const bm25Weight = token.length >= 3 ? 1 : 0.55
    if (weight > 0) coverageTotal += weight
    for (const [id, tf] of posting) {
      const length = documentLengths[id] || 1
      scores[id] += bm25Weight * idf * tf * (K1 + 1) / (tf + K1 * (1 - B + B * length / (averageLength || 1)))
      if (weight > 0) coverage[id] += weight
    }
  }

  const candidates = []
  for (let id = 0; id < scores.length; id += 1) {
    if (scores[id] <= 0) continue
    const chunk = chunks[id]
    // 产品只做初中：索引里仍有高考语料，但检索阶段直接跳过，不能出现在答疑引用里。
    if (chunk.stage === '高中') continue
    // 学习资料的章节检索必须同学科；答疑保留跨学科加权，避免学生跨学科提问时检索为空。
    if (subjectStrict && subject && chunk.subject !== subject) continue
    let score = scores[id]
    // 关键词覆盖率决定排序：只说“历史”不说“辛亥革命”的片段让位给真正讲这道题的解析。
    if (coverageTotal > 0) score *= 0.5 + coverage[id] / coverageTotal
    // 连续四字命中说明整句在讲同一个概念（如“辛亥革命”），额外加权。
    if (phraseHit(chunk.text, normalizedQuery)) score *= 1.45
    // 命中学科与学段只是加权，不做硬过滤，避免学生跨学科提问时检索为空。
    if (subject && chunk.subject === subject) score *= 1.35
    score *= stageBoost(chunk, grade)
    if (normalizeText(chunk.text).includes(normalizedQuery)) score *= 1.2
    if (score < minScore) continue
    candidates.push({ chunk, score })
  }
  candidates.sort((left, right) => right.score - left.score)

  const picked = []
  for (const { chunk, score } of candidates) {
    if (picked.length >= topK) break
    // 同一道题的解析版与原卷版往往高度重叠，保留分高的一条，避免四条结果说的是同一题。
    if (picked.some(item => overlap(item.text, chunk.text) > 0.62)) continue
    const quality = assessPassageQuality(chunk.text)
    if (quality.score < minQuality) continue
    picked.push({
      id: chunk.id,
      score: Number(score.toFixed(2)),
      text: chunk.text.slice(0, maxChars),
      quality: quality.score,
      lowQuality: quality.low,
      citation: formatCitation(chunk),
      source: chunk.file,
      subject: chunk.subject,
      stage: chunk.stage,
      exam: chunk.exam,
      year: chunk.year,
      variant: chunk.variant,
      file: chunk.file
    })
  }
  return picked
}

// 问题里任意连续四字出现在片段里，说明不是靠零散词拼出来的相关，额外加权。
function phraseHit(text = '', normalizedQuery = '') {
  if (normalizedQuery.length < 4) return false
  const normalizedText = normalizeText(text)
  for (let index = 0; index + 4 <= normalizedQuery.length; index += 1) {
    if (normalizedText.includes(normalizedQuery.slice(index, index + 4))) return true
  }
  return false
}

// 用 2 字元组集合的重合率判断两段文本是否在讲同一道题。
function overlap(left = '', right = '') {
  const grams = value => {
    const text = normalizeText(value)
    const set = new Set()
    for (let index = 0; index + 2 <= text.length; index += 1) set.add(text.slice(index, index + 2))
    return set
  }
  const leftSet = grams(left)
  const rightSet = grams(right)
  if (!leftSet.size || !rightSet.size) return 0
  let shared = 0
  for (const gram of leftSet) if (rightSet.has(gram)) shared += 1
  return shared / Math.min(leftSet.size, rightSet.size)
}
