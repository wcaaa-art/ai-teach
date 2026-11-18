// 薄弱点记录：Agent 在答疑/诊断中确认的薄弱知识点落到服务端文件，供后续复习与导出。
// 只存结构化字段，不存对话原文；同一「学科 + 知识点」去重并累计次数。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

const FILE = process.env.WEAK_POINTS_FILE || join(process.cwd(), 'server', 'data', 'weak-points.json')
const MAX_ITEMS = 200

function readAll() {
  try {
    if (!existsSync(FILE)) return []
    const parsed = JSON.parse(readFileSync(FILE, 'utf8'))
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(items) {
  mkdirSync(dirname(FILE), { recursive: true })
  const tmp = `${FILE}.tmp`
  writeFileSync(tmp, JSON.stringify(items, null, 2), 'utf8')
  renameSync(tmp, FILE)
}

export function saveWeakPoint({ subject = '', grade = '', point = '', reason = '' } = {}) {
  const cleanSubject = String(subject).trim().slice(0, 16)
  const cleanPoint = String(point).trim().slice(0, 60)
  if (!cleanSubject || !cleanPoint) return { saved: false, error: 'invalid_arguments' }
  const items = readAll()
  const now = Date.now()
  const existing = items.find(item => item.subject === cleanSubject && item.point === cleanPoint)
  if (existing) {
    existing.count = Number(existing.count || 1) + 1
    existing.updatedAt = now
    if (reason) existing.reason = String(reason).trim().slice(0, 120)
    writeAll(items)
    return { saved: true, duplicate: true, count: existing.count, total: items.length, point: cleanPoint }
  }
  const record = {
    id: `weak-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    subject: cleanSubject,
    grade: String(grade).trim().slice(0, 8),
    point: cleanPoint,
    reason: String(reason).trim().slice(0, 120),
    count: 1,
    createdAt: now,
    updatedAt: now
  }
  items.unshift(record)
  writeAll(items.slice(0, MAX_ITEMS))
  return { saved: true, duplicate: false, count: 1, total: Math.min(items.length, MAX_ITEMS), point: cleanPoint }
}

export function listWeakPoints(limit = 20) {
  const size = Math.max(1, Math.min(MAX_ITEMS, Number(limit) || 20))
  const items = readAll()
  return { total: items.length, items: items.slice(0, size) }
}
