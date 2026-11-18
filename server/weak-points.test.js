import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'weak-points-'))
process.env.WEAK_POINTS_FILE = join(dir, 'weak-points.json')
const { listWeakPoints, saveWeakPoint } = await import('./weak-points.js')

test.after(() => rmSync(dir, { recursive: true, force: true }))

test('薄弱点写入、去重累计与读取', () => {
  const first = saveWeakPoint({ subject: '数学', grade: '初二', point: '二次函数顶点式', reason: '配方不熟' })
  assert.equal(first.saved, true)
  assert.equal(first.duplicate, false)

  const second = saveWeakPoint({ subject: '数学', grade: '初二', point: '二次函数顶点式' })
  assert.equal(second.duplicate, true)
  assert.equal(second.count, 2)

  const listed = listWeakPoints(10)
  assert.equal(listed.total, 1)
  assert.equal(listed.items[0].point, '二次函数顶点式')
  assert.equal(listed.items[0].count, 2)
})

test('缺少学科或知识点时拒绝写入', () => {
  assert.equal(saveWeakPoint({ subject: '', point: '整式' }).saved, false)
  assert.equal(saveWeakPoint({ subject: '数学', point: '   ' }).saved, false)
})
