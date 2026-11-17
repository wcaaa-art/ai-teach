#!/usr/bin/env node
// 增量入库：把新的题目文本追加到真题索引，不用重跑 Python、不用重新解 PDF。
//
// 用法：
//   node scripts/rag-add-doc.mjs <文件.txt|文件.md|目录> [更多文件…]
//   npm run rag:add -- "D:/新题/2025广东数学.txt"
//
// 口径：切块（每块 ≤640 字、≥60 字）与建库脚本一致；入库前用前 140 个归一化字符去重，
// 避免同一题从解析版和原卷版各进一遍。写回后服务端最多 2 秒自动热加载。
import { writeFileSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { gzipSync, gunzipSync } from 'node:zlib'
import { dirname, join, extname, basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { normalizeText, tokenizeForIndex } from '../server/rag/index.js'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const INDEX_PATH = join(ROOT, 'server', 'rag', 'rag-index.json.gz')
const NOISE = /人人可教|陪娃到十五|微信公众号|扫码|长按|关注公众号|更多真题/g
const CHUNK_LIMIT = 640
const CHUNK_MIN = 60

function collect(target) {
  const files = []
  const walk = path => {
    const stat = statSync(path)
    if (stat.isDirectory()) {
      for (const name of readdirSync(path)) walk(join(path, name))
      return
    }
    if (['.txt', '.md'].includes(extname(path).toLowerCase())) files.push(path)
  }
  walk(target)
  return files
}

function packChunks(text) {
  const lines = String(text).replace(NOISE, '').split('\n').map(line => line.trim()).filter(Boolean)
  const chunks = []
  let buffer = ''
  for (const line of lines) {
    if (buffer.length + line.length + 1 > CHUNK_LIMIT && buffer) {
      chunks.push(buffer)
      buffer = ''
    }
    buffer += (buffer ? '\n' : '') + line
  }
  if (buffer) chunks.push(buffer)
  return chunks.filter(chunk => chunk.length >= CHUNK_MIN)
}

function guessSubject(name) {
  const table = [['数学', '数学'], ['物理', '物理'], ['化学', '化学'], ['历史', '历史'], ['地理', '地理'], ['生物', '生物'], ['语文', '语文'], ['英语', '英语'], ['政治', '道德与法治'], ['道法', '道德与法治']]
  for (const [key, subject] of table) if (name.includes(key)) return subject
  return '综合'
}

const targets = process.argv.slice(2)
if (!targets.length) {
  console.error('用法：node scripts/rag-add-doc.mjs <文件或目录> [更多…]')
  process.exit(1)
}

const index = JSON.parse(gunzipSync(readFileSync(INDEX_PATH)).toString('utf8'))
const seen = new Set(index.chunks.map(chunk => normalizeText(chunk.text).slice(0, 140)))
let nextId = index.chunks.reduce((max, chunk) => Math.max(max, chunk.id), -1) + 1

let added = 0
let skipped = 0
for (const target of targets) {
  for (const file of collect(target)) {
    const text = readFileSync(file, 'utf8')
    const subject = guessSubject(basename(file))
    for (const chunk of packChunks(text)) {
      const key = normalizeText(chunk).slice(0, 140)
      if (seen.has(key)) { skipped += 1; continue }
      seen.add(key)
      index.chunks.push({
        id: nextId,
        text: chunk,
        file: basename(file),
        subject,
        stage: '初中',
        exam: basename(file).replace(/\.[^.]+$/, ''),
        year: Number((basename(file).match(/20\d{2}/) || [])[0]) || new Date().getFullYear(),
        variant: '增量'
      })
      nextId += 1
      added += 1
    }
  }
}

if (!added) {
  console.log(`没有新增片段（重复 ${skipped} 条）。`)
  process.exit(0)
}

// 词元与文档长度全量重算：Python 建库与这里的分词口径一致，重算最不容易出现两张表对不上。
index.postings = {}
index.docLengths = []
for (const chunk of index.chunks) {
  const tokens = tokenizeForIndex(chunk.text)
  index.docLengths[chunk.id] = tokens.length
  const counts = new Map()
  for (const token of tokens) counts.set(token, (counts.get(token) || 0) + 1)
  for (const [token, count] of counts) {
    if (!index.postings[token]) index.postings[token] = []
    index.postings[token].push([chunk.id, count])
  }
}
index.stats = {
  ...index.stats,
  files: new Set(index.chunks.map(chunk => chunk.file)).size,
  chunks: index.chunks.length,
  terms: Object.keys(index.postings).length
}
index.builtAt = new Date().toISOString()

writeFileSync(INDEX_PATH, gzipSync(Buffer.from(JSON.stringify(index), 'utf8')))
console.log(`新增 ${added} 个片段（跳过重复 ${skipped} 条），当前共 ${index.chunks.length} 个片段。`)
console.log('服务端会在 2 秒内自动热加载，无需重启。')
