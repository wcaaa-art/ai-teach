// 混合检索：BM25（稀疏路）+ 稠密向量（稠密路）双路召回，用 RRF 融合排序。
//
// 稀疏路擅长「命中明确关键词」，稠密路擅长「说法不同但语义相近」，两路互补。
// RRF（Reciprocal Rank Fusion）只看各路的排名不看分数绝对值，
// 因此 BM25 的分数尺度问题和向量余弦的尺度问题都不会互相干扰。
//
// 安全约束（不能影响正常使用）：
// 1. 稠密索引文件缺失、损坏或加载失败 → 直接退回纯 BM25，接口行为与改造前一致；
// 2. 稠密通道运行时抛错 → 熔断该通道，进程内后续请求都走 BM25；
// 3. 稠密索引只在进程内缓存，读取失败不抛到调用方。
import { readFileSync, existsSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRagIndex, searchPassages } from './index.js'
import { DENSE_DIM } from './dense.js'

const VECTOR_PATH = join(dirname(fileURLToPath(import.meta.url)), 'vector-index.json.gz')
const RRF_K = 60

/** @type {{ dim: number, idf: number[], vectors: Float32Array[] } | null} */
let denseCache = null
let denseDisabled = false

/**
 * 加载稠密索引（进程内缓存）。任何失败都只关掉稠密通道，不抛错。
 */
export function loadDenseIndex() {
  if (denseDisabled) return null
  if (denseCache) return denseCache
  try {
    if (!existsSync(VECTOR_PATH)) {
      denseDisabled = true
      return null
    }
    const raw = JSON.parse(gunzipSync(readFileSync(VECTOR_PATH)).toString('utf8'))
    if (!raw?.vectors?.length || !raw?.idf) {
      denseDisabled = true
      return null
    }
    const vectors = raw.vectors.map(entry => {
      const vector = new Float32Array(raw.dim || DENSE_DIM)
      for (let index = 0; index < entry.ids.length; index += 1) vector[entry.ids[index]] = entry.values[index]
      return vector
    })
    denseCache = { dim: raw.dim || DENSE_DIM, idf: raw.idf, vectors }
    return denseCache
  } catch (error) {
    console.warn('[hybrid] 稠密索引不可用，本次起只走 BM25：', error.message)
    denseDisabled = true
    return null
  }
}

// 稠密通道熔断开关，供测试与运维查看。
export function denseChannelStatus() {
  return { enabled: !denseDisabled, loaded: Boolean(denseCache), path: VECTOR_PATH }
}

/**
 * 稠密召回：返回按余弦相似度排好的片段位置与分数。
 * @param {string} query
 * @param {number} topK
 */
function denseRecall(query, topK) {
  const index = loadDenseIndex()
  if (!index) return []
  const chunks = loadRagIndex().chunks
  const idf = index.idf
  const dim = index.dim
  // 查询编码：与构建时同一套特征与 IDF
  const queryVector = new Float32Array(dim)
  const features = new Map()
  const lower = String(query).toLowerCase()
  for (const run of lower.match(/[\u4e00-\u9fff]+/g) || []) {
    if (run.length === 1) features.set(run, (features.get(run) || 0) + 1)
    else for (let index2 = 0; index2 + 2 <= run.length; index2 += 1) { const key = run.slice(index2, index2 + 2); features.set(key, (features.get(key) || 0) + 1) }
  }
  for (const word of lower.match(/[a-z0-9]{3,}/g) || []) features.set(word, (features.get(word) || 0) + 1)
  for (const [feature, count] of features) {
    const bucket = hashBucket(feature, dim)
    queryVector[bucket] += (1 + Math.log(count)) * (idf[bucket] ?? 1)
  }
  let norm = 0
  for (let index2 = 0; index2 < dim; index2 += 1) norm += queryVector[index2] * queryVector[index2]
  norm = Math.sqrt(norm)
  if (norm > 0) for (let index2 = 0; index2 < dim; index2 += 1) queryVector[index2] /= norm

  const scored = []
  for (let position = 0; position < index.vectors.length; position += 1) {
    const vector = index.vectors[position]
    let dot = 0
    for (let index2 = 0; index2 < dim; index2 += 1) dot += vector[index2] * queryVector[index2]
    if (dot > 0) scored.push({ position, score: dot })
  }
  scored.sort((left, right) => right.score - left.score)
  return scored.slice(0, topK * 4).map(item => ({ ...item, chunk: chunks[item.position] }))
}

function hashBucket(feature, dim) {
  let hash = 2166136261
  for (let index = 0; index < feature.length; index += 1) {
    hash ^= feature.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash % dim
}

function overlap(left = '', right = '') {
  const grams = value => {
    const text = String(value).toLowerCase().replace(/[^0-9a-z\u4e00-\u9fff]/g, '')
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

/**
 * 混合检索主入口。参数与 searchPassages 一致，返回结构也一致。
 * @param {{ query?: string, subject?: string, grade?: string, topK?: number, minScore?: number, maxChars?: number, subjectStrict?: boolean }} [options]
 */
export function hybridSearch(options = {}) {
  const { query = '', subject = '', grade = '', topK = 4, maxChars = 900, subjectStrict = false } = options
  // 第一步永远是 BM25：它同时是降级目标和融合的一路。
  const sparse = searchPassages(options)
  try {
    const recalled = denseRecall(query, topK)
    if (!recalled.length) return sparse
    const chunks = loadRagIndex().chunks

    const sparseRank = new Map()
    sparse.forEach((item, index) => sparseRank.set(item.id, index))
    const denseRank = new Map()
    recalled.forEach((item, index) => {
      if (item.chunk && item.chunk.stage !== '高中') denseRank.set(item.chunk.id, index)
    })

    const merged = new Map()
    for (const item of sparse) {
      merged.set(item.id, { ...item, rrf: 1 / (RRF_K + (sparseRank.get(item.id) ?? 0) + 1) + (denseRank.has(item.id) ? 1 / (RRF_K + denseRank.get(item.id) + 1) : 0) })
    }
    // 稠密路独有的结果也要补齐字段，调用方拿到的结构始终一致。
    for (const item of recalled) {
      const chunk = item.chunk
      if (!chunk || chunk.stage === '高中' || merged.has(chunk.id)) continue
      if (subjectStrict && subject && chunk.subject !== subject) continue
      merged.set(chunk.id, {
        id: chunk.id,
        score: Number(item.score.toFixed(2)),
        text: String(chunk.text || '').slice(0, maxChars),
        citation: `《${String(chunk.file || '').split('/').pop().replace(/\.pdf$/i, '')}》`,
        source: chunk.file,
        subject: chunk.subject,
        stage: chunk.stage,
        exam: chunk.exam,
        year: chunk.year,
        variant: chunk.variant,
        file: chunk.file,
        rrf: 1 / (RRF_K + (denseRank.get(chunk.id) ?? 0) + 1)
      })
    }
    void chunks

    const ranked = [...merged.values()].sort((left, right) => right.rrf - left.rrf)
    const picked = []
    for (const item of ranked) {
      if (picked.length >= topK) break
      // 与稀疏路同一套去重口径：同一道题的解析版与原卷版不重复展示。
      if (picked.some(existing => overlap(existing.text, item.text) > 0.62)) continue
      picked.push(item)
    }
    return picked
  } catch (error) {
    console.warn('[hybrid] 稠密通道异常，本次退回 BM25：', error.message)
    denseDisabled = true
    return sparse
  }
}
