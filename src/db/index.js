// @ts-check
import { openDB } from 'idb'
import { stageOf, stageStatesOf } from '../utils/stages.js'
import { createBackup, validateBackup } from '../utils/backup.js'

export const DB_NAME = 'ai-teach-local'
// v8：新增背诵内容缓存与背诵记录。老库打开时会走 upgrade，只补建缺的表，
// 其它表的数据不受影响（其余 store 都在同一个数组里，用 contains 判断过）。
export const DB_VERSION = 8
const USER_DB_PREFIX = 'ai-teach-user-'
const memoryFallback = new Map()
const settingsFallback = new Map()

// 学习数据按账号隔离：未登录用 ai-teach-local，登录后切到该账号的独立库，
// 避免新账号看到本地模式遗留的计划；只有用户确认同步时才复制本地记录。
let dataOwner = 'local'
let dbPromise = openDatabase(DB_NAME)
// 设置属于设备偏好（主题/摄像头等），不跟账号走，始终读写本地模式库。
const settingsDbPromise = openDatabase(DB_NAME)

function databaseNameFor(owner) {
  return !owner || owner === 'local' ? DB_NAME : `${USER_DB_PREFIX}${owner}`
}

function getMemoryStore(name) {
  const key = `${dataOwner}:${name}`
  if (!memoryFallback.has(key)) memoryFallback.set(key, new Map())
  return memoryFallback.get(key)
}

function openDatabase(name) {
  return openDB(name, DB_VERSION, {
    upgrade(db) {
      /** @type {Array<[string, { keyPath: string }]>} */
      const stores = [
        ['profile', { keyPath: 'id' }],
        ['plans', { keyPath: 'id' }],
        ['focusSessions', { keyPath: 'id' }],
        ['distractions', { keyPath: 'id' }],
        ['feedbacks', { keyPath: 'id' }],
        ['assessments', { keyPath: 'id' }],
        ['visualLogs', { keyPath: 'id' }],
        ['conversations', { keyPath: 'id' }],
        ['settings', { keyPath: 'id' }],
        // 章节测试：题干指纹（7 天去重）、测试结果、专注时长建议（专注页读取 current）。
        ['quizFingerprints', { keyPath: 'id' }],
        ['quizResults', { keyPath: 'id' }],
        ['focusSuggestions', { keyPath: 'id' }],
        // 学校考试成绩用于计算与目标分的差距；错题用于按章节归因长短板。
        ['examScores', { keyPath: 'id' }],
        ['mistakes', { keyPath: 'id' }],
        // 未交卷的答题草稿固定写 current，退出/离开页面时保存，下次进入可继续作答。
        ['quizDrafts', { keyPath: 'id' }],
        // 试卷拍照识别后保存的 digital paper，可反复练习或回看识别结果。
        ['scannedPapers', { keyPath: 'id' }],
        // 背诵内容缓存：按「学科 + 计划名」存一份确认过的原文/词表，避免重复请求模型。
        ['reciteContents', { keyPath: 'id' }],
        // 背诵记录：逐句/逐词的结果与耗时，背诵时长也据此写进专注统计。
        ['reciteSessions', { keyPath: 'id' }]
      ]
      stores.forEach(([name, options]) => {
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, options)
      })
    }
  }).then(db => {
    // 其他标签页请求升级时主动关闭本连接，避免旧标签卡住 schema 升级。
    db.onversionchange = () => db.close()
    return db
  }).catch(error => {
    console.warn('IndexedDB 不可用，本次会话改用内存数据。', error)
    return null
  })
}

export function getDataOwner() { return dataOwner }

// 切换数据空间：owner 为 'local' 或账号 id；返回切换后的 owner。
export async function setDataOwner(owner) {
  const next = owner ? String(owner) : 'local'
  if (next === dataOwner) return dataOwner
  const previous = dbPromise
  dataOwner = next
  dbPromise = openDatabase(databaseNameFor(next))
  previous.then(db => { try { if (db) db.close() } catch (error) { console.warn('旧数据连接关闭失败。', error) } })
  return dataOwner
}

// 汇总本地模式库里的学习记录，用于登录/注册时询问是否需要同步。
export async function getLocalDataSummary() {
  const database = await openDatabase(DB_NAME)
  if (!database) return { plans: 0, assessments: 0, focusSessions: 0, feedbacks: 0, conversations: 0, quizResults: 0, total: 0 }
  const counts = {}
  try {
    for (const name of ['plans', 'assessments', 'focusSessions', 'feedbacks', 'conversations', 'quizResults']) {
      counts[name] = await database.count(name)
    }
  } catch (error) {
    console.warn('本地学习数据统计失败。', error)
  } finally {
    database.close()
  }
  const total = Object.values(counts).reduce((sum, value) => sum + (value || 0), 0)
  return { plans: 0, assessments: 0, focusSessions: 0, feedbacks: 0, conversations: 0, quizResults: 0, ...counts, total }
}

// 只复制学习数据，不复制设置；同 id 记录以本地数据为准。
const SYNC_STORES = ['profile', 'plans', 'focusSessions', 'distractions', 'feedbacks', 'assessments', 'visualLogs', 'conversations', 'quizFingerprints', 'quizResults', 'focusSuggestions', 'examScores', 'mistakes', 'scannedPapers', 'reciteContents', 'reciteSessions']

export async function syncLocalDataToOwner(owner) {
  const targetName = databaseNameFor(owner)
  if (!owner || targetName === DB_NAME) return { copied: 0 }
  const source = await openDatabase(DB_NAME)
  const target = await openDatabase(targetName)
  if (!source || !target) return { copied: 0 }
  let copied = 0
  try {
    for (const name of SYNC_STORES) {
      const records = await source.getAll(name)
      for (const record of records) await target.put(name, record)
      copied += records.length
    }
  } finally {
    source.close()
    target.close()
  }
  return { copied }
}

// 同步成功后清空本地模式的学习数据：避免下次登录反复提示，也防止同一批记录被同步到多个账号。
// 设置属于设备偏好，不在这里清空。
export async function clearLocalLearningData() {
  const database = await openDatabase(DB_NAME)
  if (!database) return
  try {
    const transaction = database.transaction(SYNC_STORES, 'readwrite')
    for (const name of SYNC_STORES) transaction.objectStore(name).clear()
    await transaction.done
  } finally {
    database.close()
  }
}

export const makeId = (prefix = 'item') => `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`

// 导出当前数据空间的学习记录：本地优先模式下，换设备或清缓存前由用户自己备份。
export async function exportLearningData() {
  const database = await dbPromise
  const stores = {}
  for (const name of SYNC_STORES) {
    stores[name] = database ? await database.getAll(name) : [...getMemoryStore(name).values()]
  }
  return createBackup({ owner: dataOwner, stores })
}

// 导入备份：按 id 覆盖同一条记录，不删除现有数据，避免一次误操作覆盖掉当天进度。
export async function importLearningData(payload) {
  const checked = validateBackup(payload)
  if (!checked.ok) return { ...checked, imported: 0 }
  let imported = 0
  for (const name of SYNC_STORES) {
    const records = Array.isArray(payload.stores[name]) ? payload.stores[name] : []
    for (const record of records) {
      if (!record || typeof record !== 'object' || !record.id) continue
      await put(name, record)
      imported += 1
    }
  }
  return { ok: true, imported, counts: checked.counts }
}

async function put(store, value) {
  const database = await dbPromise
  // IndexedDB 的结构化克隆不接受 Vue 的响应式代理，写入前先还原成普通 JSON 数据。
  const plain = JSON.parse(JSON.stringify(value))
  if (database) {
    try { return await database.put(store, plain) } catch (error) { console.warn('IndexedDB 写入失败，使用内存数据。', error) }
  }
  getMemoryStore(store).set(plain.id, plain)
  return plain.id
}

async function get(store, key) {
  const database = await dbPromise
  if (database) {
    try { const value = await database.get(store, key); if (value) return value } catch (error) { console.warn('IndexedDB 读取失败，使用内存数据。', error) }
  }
  return getMemoryStore(store).get(key)
}

async function getAll(store) {
  const database = await dbPromise
  let values = []
  if (database) {
    try { values = await database.getAll(store) } catch (error) { console.warn('IndexedDB 列表读取失败，使用内存数据。', error) }
  }
  const merged = new Map(values.map(value => [value.id, value]))
  for (const [key, value] of getMemoryStore(store)) merged.set(key, value)
  return [...merged.values()]
}

async function remove(store, key) {
  const database = await dbPromise
  if (database) {
    try { await database.delete(store, key) } catch (error) { console.warn('IndexedDB 删除失败。', error) }
  }
  getMemoryStore(store).delete(key)
}

export const saveProfile = (profile) => put('profile', { ...profile, id: 'current', updatedAt: Date.now() })
export const loadProfile = () => get('profile', 'current')
export const savePlan = (plan) => put('plans', plan)
export const loadPlans = () => getAll('plans')
export const deletePlan = (id) => remove('plans', id)
export const saveFocusSession = (data) => put('focusSessions', data)
// 背诵内容按「学科 + 计划名」做幂等缓存；同一篇改过之后覆盖同一行。
export const reciteContentId = (subject, name) => `${subject || '综合'}::${name || ''}`
export const loadReciteContent = (subject, name) => get('reciteContents', reciteContentId(subject, name))
export const saveReciteContent = (record) => put('reciteContents', record)
export const saveReciteSession = (record) => put('reciteSessions', record)
export const loadReciteSessions = () => getAll('reciteSessions')
export const loadFocusSessions = () => getAll('focusSessions')
export const deleteFocusSession = (id) => remove('focusSessions', id)
export const saveDistraction = (data) => put('distractions', data)
export const loadDistractions = () => getAll('distractions')
export const saveFeedback = (data) => put('feedbacks', data)
export const loadFeedbacks = () => getAll('feedbacks')
export const saveAssessment = (data) => put('assessments', data)
export const loadAssessments = () => getAll('assessments')
export const saveVisualLog = (data) => put('visualLogs', data)
export const loadVisualLogs = () => getAll('visualLogs')
export const saveConversation = (data) => put('conversations', data)
export const loadConversations = () => getAll('conversations')
export const deleteConversation = (id) => remove('conversations', id)
// 设置是设备级偏好，固定读写本地模式库，不随账号切换。
export async function saveSettings(settings) {
  // 设置对象来自 Pinia 的响应式代理，写入 IndexedDB 前同样要转成普通数据。
  const record = JSON.parse(JSON.stringify({ ...settings, id: 'current' }))
  const database = await settingsDbPromise
  if (database) {
    try { return await database.put('settings', record) } catch (error) { console.warn('设置写入失败，使用内存数据。', error) }
  }
  settingsFallback.set('current', record)
  return record.id
}
export async function getSettings() {
  const database = await settingsDbPromise
  if (database) {
    try { const value = await database.get('settings', 'current'); if (value) return value } catch (error) { console.warn('设置读取失败，使用内存数据。', error) }
  }
  return settingsFallback.get('current')
}

// 题干指纹在出题时即写入，刷新/跨天/重启后仍能参与 7 天去重。
export const saveQuizFingerprints = async (records = []) => {
  for (const record of records) await put('quizFingerprints', record)
  return records.length
}
export const loadQuizFingerprints = () => getAll('quizFingerprints')
// 只保留最近 14 天，避免指纹库无限增长；去重仍只看近 7 天。
export async function pruneQuizFingerprints(days = 14) {
  const cutoff = Date.now() - days * 86400000
  const records = await getAll('quizFingerprints')
  for (const record of records) if (Number(record.createdAt || 0) < cutoff) await remove('quizFingerprints', record.id)
}
export const saveQuizResult = (data) => put('quizResults', data)
export const loadQuizResults = () => getAll('quizResults')
// 未交卷的作答进度：只保留一份 current，交卷或放弃后删除。
export const saveQuizDraft = (data) => put('quizDrafts', { ...data, id: 'current', updatedAt: Date.now() })
export const loadQuizDraft = () => get('quizDrafts', 'current')
export const clearQuizDraft = () => remove('quizDrafts', 'current')
export const saveExamScore = (data) => put('examScores', data)
export const loadExamScores = () => getAll('examScores')
export const deleteExamScore = (id) => remove('examScores', id)
export const saveMistake = (data) => put('mistakes', data)
export const loadMistakes = () => getAll('mistakes')
export const deleteMistake = (id) => remove('mistakes', id)
export const saveScannedPaper = (data) => put('scannedPapers', data)
export const loadScannedPapers = () => getAll('scannedPapers')
export const loadScannedPaper = (id) => get('scannedPapers', id)
export const deleteScannedPaper = (id) => remove('scannedPapers', id)
// 专注建议固定写 current 一条；FocusView 侧可用 loadFocusSuggestion() 读取 recommendedMinutes。
export const saveFocusSuggestion = (data) => put('focusSuggestions', { ...data, id: 'current' })
export const loadFocusSuggestion = () => get('focusSuggestions', 'current')

// 主页统计：只读当前数据空间里的学习记录，没有记录时如实返回零值，不造演示数字。
export async function getHomeStats({ dailyMinutes = 60 } = {}) {
  const [plans, sessions, conversations, quizResults] = await Promise.all([
    loadPlans(), loadFocusSessions(), loadConversations(), loadQuizResults()
  ])
  const dayKey = value => {
    const time = Number(value) || 0
    if (time <= 0) return ''
    const date = new Date(time)
    return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
  }
  const todayKey = dayKey(Date.now())
  const activePlans = plans.filter(plan => plan.status !== 'archived')
    .sort((a, b) => (a.sequenceOrder || 999) - (b.sequenceOrder || 999))
  const nextPlan = activePlans[0]
  // 学习地图只统计当前科目（顺序最靠前的进行中任务所属科目）：归档一个任务就能看到节点推进，不用等全部科目收尾。
  const stageSubject = nextPlan?.subject || ''
  const stageStates = stageStatesOf(stageSubject ? plans.filter(plan => plan.subject === stageSubject) : plans)
  const tags = new Set(activePlans.flatMap(plan => Array.isArray(plan.knowledgeTags) ? plan.knowledgeTags : []))
  const totalSeconds = sessions.reduce((sum, item) => sum + (Number(item.actualSeconds) || 0), 0)
  const todaySeconds = sessions.filter(item => dayKey(item.createdAt || item.startedAt) === todayKey)
    .reduce((sum, item) => sum + (Number(item.actualSeconds) || 0), 0)
  const learningDays = new Set([
    ...sessions.map(item => dayKey(item.createdAt || item.startedAt)),
    ...conversations.map(item => dayKey(item.createdAt || item.updatedAt)),
    ...quizResults.map(item => dayKey(item.createdAt || item.finishedAt))
  ].filter(Boolean))
  // 连续天数从今天往前数；今天还没学习时允许从昨天起算，避免一早打开页面就显示中断。
  let streakDays = 0
  const cursor = new Date()
  if (!learningDays.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
  while (learningDays.has(dayKey(cursor.getTime()))) { streakDays += 1; cursor.setDate(cursor.getDate() - 1) }
  const targetMinutes = Math.max(10, Number(dailyMinutes) || 60)
  const todayMinutes = Math.round(todaySeconds / 60)
  return {
    streakDays,
    totalFocusMinutes: Math.round(totalSeconds / 60),
    todayFocusMinutes: todayMinutes,
    targetMinutes,
    progressPercent: Math.min(100, Math.round(todayMinutes / targetMinutes * 100)),
    remainingMinutes: Math.max(0, targetMinutes - todayMinutes),
    plansCount: activePlans.length,
    knowledgeCount: tags.size,
    nextPlanName: nextPlan?.name || '',
    nextPlanSubject: nextPlan?.subject || '',
    nextPlanTag: nextPlan?.knowledgeTags?.[0] || '',
    nextPlanStage: nextPlan ? stageOf(nextPlan) : '',
    stageStates,
    stageSubject,
    totalPlans: plans.length
  }
}

export async function getRecentFocusContext(days = 7) {
  const since = Date.now() - days * 86400000
  const [sessions, distractions, visuals] = await Promise.all([
    loadFocusSessions(), loadDistractions(), loadVisualLogs()
  ])
  const recent = list => list.filter(item => (item.createdAt || item.startedAt || 0) >= since)
  // 自由专注是计划外时间，不计入计划迭代的近况，避免误判某个知识点已练过。
  const focus = recent(sessions).filter(item => item.mode !== 'free')
  // 自由专注的分心与视觉记录没有关联计划（planId 为空），同样不参与计划迭代。
  const tied = list => recent(list).filter(item => item.planId !== null && item.planId !== undefined)
  const distract = tied(distractions)
  const visual = tied(visuals)
  const totalSeconds = focus.reduce((sum, item) => sum + (item.actualSeconds || 0), 0)
  const completed = focus.filter(item => item.completed).length
  return {
    days, totalFocusMinutes: Math.round(totalSeconds / 60), taskCompletionRate: focus.length ? completed / focus.length : 0,
    distractionCount: distract.length,
    visualAwayRecords: visual.filter(item => item.status === 'away' && item.source !== 'demo').length,
    sessions: focus.slice(-20), distractions: distract.slice(-20), visualLogs: visual.slice(-20)
  }
}
