import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkQuota, getAuditLog, recordAudit } from './safety.js'

test('配额窗口内放行限额、超限拒绝并给出等待秒数', () => {
  const id = `test-${Date.now()}`
  for (let index = 0; index < 5; index += 1) {
    assert.equal(checkQuota(id, { limit: 5, windowMs: 60000 }).allowed, true)
  }
  const blocked = checkQuota(id, { limit: 5, windowMs: 60000 })
  assert.equal(blocked.allowed, false)
  assert.ok(blocked.retryAfter >= 1)
})

test('审计日志只保留最近记录且字段完整', () => {
  recordAudit({ direction: 'input', category: 'self-harm', blocked: true })
  const last = getAuditLog(1)[0]
  assert.equal(last.direction, 'input')
  assert.equal(last.category, 'self-harm')
  assert.equal(last.blocked, true)
  assert.equal(typeof last.at, 'number')
})
