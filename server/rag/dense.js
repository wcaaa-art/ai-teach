// 稠密向量检索通道：用 hashing trick 把字符级特征压成定长稠密向量，再算余弦相似度。
//
// 为什么不用神经网络 embedding：项目里只有浏览器版的 onnxruntime-web，服务端要跑
// ONNX 还得装 onnxruntime-node，首次加载模型会拖慢接口、增加内存占用，与「不能影响
// 正常使用」冲突。这里改成零依赖的纯 JS 实现——离线构建一次，运行时毫秒级。
//
// 为什么不直接再做一个稀疏 TF-IDF：那和 BM25 是一路，融合没有意义。压成定长稠密
// 向量后，走的是另一套「向量空间 + 余弦」的召回逻辑，能补上 BM25 纯词元匹配的短板。
//
// 特征：中文连续汉字串的 2-gram + 英文/数字整词。2-gram 对中文比单字稳，
// 又不像分词器那样依赖词典，离线可复现、不引入新依赖。

export const DENSE_DIM = 2048

// 提取文本特征 → 特征计数表。
const CJK_RUN = /[\u4e00-\u9fff]+/g
const LATIN_WORD = /[a-z0-9]{3,}/g

/**
 * @param {string} text
 * @returns {Map<string, number>}
 */
export function extractFeatures(text = '') {
  const features = new Map()
  const lower = String(text).toLowerCase()
  const bump = (key) => features.set(key, (features.get(key) || 0) + 1)
  for (const run of lower.match(CJK_RUN) || []) {
    if (run.length === 1) { bump(run); continue }
    for (let index = 0; index + 2 <= run.length; index += 1) bump(run.slice(index, index + 2))
  }
  for (const word of lower.match(LATIN_WORD) || []) bump(word)
  return features
}

// 字符串 → 桶下标。用 FNV-1a，分布比简单求和均匀，避免中文特征扎堆。
function hashBucket(feature, dim = DENSE_DIM) {
  let hash = 2166136261
  for (let index = 0; index < feature.length; index += 1) {
    hash ^= feature.charCodeAt(index)
    hash = Math.imul(hash, 16777619) >>> 0
  }
  return hash % dim
}

/**
 * 构建稠密索引：每个片段一个 L2 归一化的 TF-IDF 向量。
 * @param {Array<{ text: string }>} chunks
 * @param {number} [dim]
 */
export function buildDenseIndex(chunks = [], dim = DENSE_DIM) {
  const featureSets = chunks.map(chunk => extractFeatures(chunk.text || ''))
  // 文档频率 → IDF：哈希桶的 df 近似真实特征的 df，碰撞会被平均掉。
  const df = new Float64Array(dim)
  for (const features of featureSets) {
    const seen = new Set()
    for (const feature of features.keys()) {
      const bucket = hashBucket(feature, dim)
      if (seen.has(bucket)) continue
      seen.add(bucket)
      df[bucket] += 1
    }
  }
  const total = chunks.length || 1
  const idf = new Float64Array(dim)
  for (let bucket = 0; bucket < dim; bucket += 1) idf[bucket] = Math.log(1 + total / (1 + df[bucket]))

  const vectors = featureSets.map(features => {
    const vector = new Float32Array(dim)
    for (const [feature, count] of features) {
      const bucket = hashBucket(feature, dim)
      vector[bucket] += (1 + Math.log(count)) * idf[bucket]
    }
    let norm = 0
    for (let index = 0; index < dim; index += 1) norm += vector[index] * vector[index]
    norm = Math.sqrt(norm)
    if (norm > 0) for (let index = 0; index < dim; index += 1) vector[index] /= norm
    return vector
  })

  return { dim, idf: Array.from(idf), vectors }
}

/**
 * 用同一套 IDF 把查询编码成稠密向量。
 * @param {{ idf: number[] }} index
 * @param {string} query
 */
export function encodeQuery(index, query = '') {
  const dim = index?.dim || DENSE_DIM
  const idf = index?.idf || []
  const vector = new Float32Array(dim)
  const features = extractFeatures(query)
  for (const [feature, count] of features) {
    const bucket = hashBucket(feature, dim)
    const weight = idf[bucket] ?? 1
    vector[bucket] += (1 + Math.log(count)) * weight
  }
  let norm = 0
  for (let index2 = 0; index2 < dim; index2 += 1) norm += vector[index2] * vector[index2]
  norm = Math.sqrt(norm)
  if (norm > 0) for (let index2 = 0; index2 < dim; index2 += 1) vector[index2] /= norm
  return vector
}

/**
 * 稠密召回：按余弦相似度返回 topK 个片段下标。
 * @param {{ dim: number, idf: number[], vectors: Float32Array[] }} index
 * @param {string} query
 * @param {{ topK?: number, allow?: (chunk: any) => boolean }} [options]
 */
export function denseSearch(index, query = '', options = {}) {
  const topK = options.topK || 10
  if (!index?.vectors?.length) return []
  const queryVector = encodeQuery(index, query)
  const scored = []
  for (let position = 0; position < index.vectors.length; position += 1) {
    const vector = index.vectors[position]
    let dot = 0
    for (let index2 = 0; index2 < indexVectorLength(vector); index2 += 1) dot += vector[index2] * queryVector[index2]
    if (dot > 0) scored.push({ position, score: dot })
  }
  scored.sort((left, right) => right.score - left.score)
  return scored.slice(0, topK)
}

function indexVectorLength(vector) {
  return vector.length
}
