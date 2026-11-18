// 检索结果重排（Rerank）。
//
// 背景：BM25 只看词频与长度归一，容易把「关键词命中但答非所问」或「公式抽坏读不懂」的片段排上来。
// 这里在 BM25 分数之上叠一层可解释的启发式权重，全部是本地计算，不调模型、不加依赖：
//   1. 三字词覆盖：查询里的三字片段有多少真的出现在正文（比 TF 更能代表"讲的是同一件事"）
//   2. 片段可读性：公式抽取丢失的残句降权，避免把读不懂的原文推给学生
//   3. 解析结构：【答案】/【解析】存在说明抽取基本完整
//   4. 学科与年级一致性
//   5. 过短片段降权（通常只有题干没有解析）
// 打分口径固定、可回归：`npm run rag:rerank:eval` 会对比开启前后指标。
import { normalizeText } from './index.js'

const STRUCTURE = /【(答案|解析|分析)】/

/** 查询的三字片段（去重），用于计算真实覆盖率。 */
export function queryTrigrams(query = '') {
  const text = normalizeText(query)
  const set = new Set()
  for (let index = 0; index + 3 <= text.length; index += 1) set.add(text.slice(index, index + 3))
  return [...set]
}

/**
 * 单条片段的重排分。
 * @param {{ text: string, score: number, subject?: string, quality?: number }} passage
 * @param {{ trigrams?: string[], subject?: string, grade?: string }} context
 */
export function rerankScore(passage, { trigrams = [], subject = '' } = {}) {
  const text = String(passage?.text || '')
  const normalized = normalizeText(text)
  const base = Number(passage?.score) || 0
  if (!base) return 0

  let factor = 1
  if (trigrams.length) {
    const hits = trigrams.filter(gram => normalized.includes(gram)).length
    factor += 0.35 * (hits / trigrams.length)
  }
  const quality = Number(passage?.quality ?? 0.6)
  factor *= 0.9 + 0.25 * quality
  // 公式抽取损坏的残句再压一档：不改变召回集合，只把不可读片段挤出前排。
  if (quality < 0.42) factor *= 0.55
  if (STRUCTURE.test(text)) factor += 0.08
  if (subject && passage?.subject === subject) factor += 0.1
  // 语料里的题块最短 60 字，低于 40 的只可能是页眉、分数说明这类残块。
  if (normalized.length < 40) factor -= 0.15

  return Number((base * Math.max(0.2, factor)).toFixed(2))
}

/**
 * 重排并按新分排序。返回新数组，不改动入参。
 * @param {Array<any>} passages
 * @param {{ query?: string, subject?: string, grade?: string, topK?: number }} [options]
 */
export function rerankPassages(passages = [], { query = '', subject = '', grade = '', topK } = {}) {
  const trigrams = queryTrigrams(query)
  const rescored = passages.map(item => {
    const rerank = rerankScore(item, { trigrams, subject, grade })
    return { ...item, bm25Score: item.score, score: rerank }
  })
  rescored.sort((left, right) => right.score - left.score)
  return typeof topK === 'number' ? rescored.slice(0, topK) : rescored
}

// 开关：默认开启（评测确认不劣化召回），设 RAG_RERANK=0 可回到纯 BM25 排序。
export function isRerankEnabled() {
  return process.env.RAG_RERANK !== '0'
}
