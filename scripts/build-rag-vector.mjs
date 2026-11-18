#!/usr/bin/env node
// 离线构建稠密向量索引：把真题片段压成定长稠密向量，产物随项目分发。
// 运行时只读文件、只算点积，不做分词与编码，因此接口延迟不受影响。
// 产物缺失或损坏时，混合检索会自动退化为纯 BM25，功能不中断。
import { writeFileSync } from 'node:fs'
import { gzipSync } from 'node:zlib'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadRagIndex } from '../server/rag/index.js'
import { buildDenseIndex, DENSE_DIM } from '../server/rag/dense.js'

const OUTPUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'server', 'rag', 'vector-index.json.gz')

const chunks = loadRagIndex().chunks
console.log(`开始构建稠密索引：${chunks.length} 个片段，维度 ${DENSE_DIM}`)
const startedAt = Date.now()
const index = buildDenseIndex(chunks, DENSE_DIM)

// 稠密向量按稀疏格式存（非零维度才有值），体积能压掉一大半。
const sparseVectors = index.vectors.map(vector => {
  const ids = []
  const values = []
  for (let position = 0; position < vector.length; position += 1) {
    const value = vector[position]
    if (value > 0) { ids.push(position); values.push(Number(value.toFixed(6))) }
  }
  return { ids, values }
})

const payload = JSON.stringify({ dim: index.dim, idf: index.idf.map(value => Number(value.toFixed(6))), vectors: sparseVectors })
const gzipped = gzipSync(Buffer.from(payload, 'utf8'), { level: 9 })
writeFileSync(OUTPUT, gzipped)
console.log(`完成：${(gzipped.length / 1024 / 1024).toFixed(2)}MB，耗时 ${Date.now() - startedAt}ms`)
console.log(`输出：${OUTPUT}`)
