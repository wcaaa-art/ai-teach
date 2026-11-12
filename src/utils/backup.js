// @ts-check
// 本地优先模式下的学习数据备份：导出 JSON、导入前校验。
// 账号只解决本机多用户隔离，学习数据仍存在浏览器 IndexedDB，所以换设备/清缓存前要由用户手动备份。

export const BACKUP_APP = 'ai-teach'
export const BACKUP_VERSION = 5

// 与 db/index.js 的同步范围保持一致：设置属于设备偏好，不随学习数据导出。
export const BACKUP_STORES = [
  'profile', 'plans', 'focusSessions', 'distractions', 'feedbacks', 'assessments', 'visualLogs',
  'conversations', 'quizFingerprints', 'quizResults', 'focusSuggestions', 'examScores', 'mistakes'
]

export function createBackup({ owner = 'local', stores = {}, exportedAt = Date.now() } = {}) {
  const data = {}
  for (const name of BACKUP_STORES) data[name] = Array.isArray(stores[name]) ? stores[name] : []
  return { app: BACKUP_APP, version: BACKUP_VERSION, owner: String(owner || 'local'), exportedAt, stores: data }
}

// 只校验结构，不校验业务字段：旧版本记录缺字段时由各页面自己的兼容逻辑处理。
export function validateBackup(payload) {
  if (!payload || typeof payload !== 'object') return { ok: false, error: '文件内容不是有效的备份数据。' }
  if (payload.app !== BACKUP_APP) return { ok: false, error: '这不是本应用导出的备份文件。' }
  if (!Number.isFinite(Number(payload.version))) return { ok: false, error: '备份文件缺少版本号。' }
  if (Number(payload.version) > BACKUP_VERSION) return { ok: false, error: '备份来自更新版本的应用，请先升级后再导入。' }
  if (!payload.stores || typeof payload.stores !== 'object') return { ok: false, error: '备份文件里没有学习数据。' }
  const counts = {}
  let total = 0
  for (const name of BACKUP_STORES) {
    const list = payload.stores[name]
    if (list === undefined) continue
    if (!Array.isArray(list)) return { ok: false, error: `备份中的「${name}」数据格式不正确。` }
    counts[name] = list.length
    total += list.length
  }
  if (!total) return { ok: false, error: '备份里没有可导入的学习记录。' }
  return { ok: true, counts, total }
}
