import test from 'node:test'
import assert from 'node:assert/strict'
import { BACKUP_APP, BACKUP_STORES, BACKUP_VERSION, createBackup, validateBackup } from './backup.js'

test('导出包含全部学习数据表，未知表被忽略', () => {
  const backup = createBackup({ owner: 'user_1', stores: { plans: [{ id: 'p1' }], unknown: [{ id: 'x' }] }, exportedAt: 123 })
  assert.equal(backup.app, BACKUP_APP)
  assert.equal(backup.version, BACKUP_VERSION)
  assert.equal(backup.owner, 'user_1')
  assert.equal(backup.exportedAt, 123)
  assert.deepEqual(backup.stores.plans, [{ id: 'p1' }])
  assert.equal(backup.stores.unknown, undefined)
  assert.deepEqual(Object.keys(backup.stores).sort(), [...BACKUP_STORES].sort())
})

test('合法的备份能通过校验并统计条数', () => {
  const result = validateBackup(createBackup({ stores: { plans: [{ id: 'p1' }, { id: 'p2' }], mistakes: [{ id: 'm1' }] } }))
  assert.equal(result.ok, true)
  assert.equal(result.total, 3)
  assert.equal(result.counts.plans, 2)
  assert.equal(result.counts.mistakes, 1)
})

test('拒绝非本应用文件、缺版本与未来版本', () => {
  assert.deepEqual(validateBackup(null).ok, false)
  assert.equal(validateBackup({ app: 'other', version: 5, stores: { plans: [{ id: 'p' }] } }).error.includes('不是本应用'), true)
  assert.equal(validateBackup({ app: BACKUP_APP, stores: { plans: [{ id: 'p' }] } }).ok, false)
  assert.equal(validateBackup({ app: BACKUP_APP, version: 99, stores: { plans: [{ id: 'p' }] } }).error.includes('更新版本'), true)
})

test('拒绝结构错误或空备份', () => {
  assert.equal(validateBackup({ app: BACKUP_APP, version: 5, stores: null }).ok, false)
  assert.equal(validateBackup({ app: BACKUP_APP, version: 5, stores: {} }).error.includes('没有可导入'), true)
  assert.equal(validateBackup({ app: BACKUP_APP, version: 5, stores: { plans: [{ id: 'p' }], mistakes: 'bad' } }).error.includes('mistakes'), true)
})
