// 背诵练习的错题沉淀：把卡壳的句子、没记住的单词、听写错的词写进错题库，
// 复用错题库的复习 / 消灭机制。同一个错处固定 id，重复卡壳累加错次而不是叠加记录。
// db 顶层就开库（浏览器专属），放到调用时动态引入，方便 Node 单测只 import 纯函数。

// 轻量字符串哈希：只为生成稳定 id，不要求密码学强度。
export function hashText(text) {
  const source = String(text || '')
  let hash = 0
  for (let i = 0; i < source.length; i += 1) hash = (hash * 31 + source.charCodeAt(i)) | 0
  return Math.abs(hash).toString(36)
}

export function reciteMistakeId(planId, key) {
  return `recite-${planId}-${hashText(key)}`
}

// 纯构建：prior 为错题库里同 id 的旧记录（可空）。同 id 重复卡壳累加错次、
// 清掉消灭标记，但保留复习进度（redoHistory / redoCount）。
export function buildReciteMistake({ prior, id, subject, grade, chapterName, knowledgeTags, record, now }) {
  const old = prior || {}
  return {
    ...old,
    id,
    grade: grade || old.grade || '',
    subject: subject || old.subject || '',
    edition: old.edition || '',
    chapterName: chapterName || old.chapterName || '',
    text: record.stem,
    stem: record.stem,
    // type 用非选项题：错题库复习弹窗会走「我做对了 / 还是不会」自评流。
    type: 'recite',
    options: [],
    correctIndex: -1,
    userAnswer: record.userAnswer || '',
    correctAnswer: record.correctAnswer || '',
    explanation: record.explanation || '',
    source: 'recite',
    quizId: '',
    questionId: '',
    knowledgeTags: knowledgeTags?.length ? knowledgeTags : (old.knowledgeTags || []),
    wrongCount: (Number(old.wrongCount) || 0) + 1,
    lastWrongAt: now,
    slip: false,
    slipAt: null,
    redoCount: Number(old.redoCount) || 0,
    lastRedoAt: old.lastRedoAt || null,
    redoHistory: old.redoHistory || [],
    fixedAt: null,
    createdAt: old.createdAt || now
  }
}

// records: [{ key, stem, userAnswer, correctAnswer, explanation? }]
export async function persistReciteMistakes({ planId, subject, grade, chapterName, knowledgeTags, records }) {
  const list = (records || []).filter(item => item && item.key && item.stem)
  if (!planId || !list.length) return 0
  const { loadMistakes, saveMistake } = await import('../db/index.js')
  const existing = await loadMistakes()
  const byId = new Map(existing.map(item => [item.id, item]))
  const now = Date.now()
  let saved = 0
  for (const record of list) {
    const id = reciteMistakeId(planId, record.key)
    await saveMistake(buildReciteMistake({
      prior: byId.get(id),
      id,
      subject,
      grade,
      chapterName,
      knowledgeTags,
      record,
      now
    }))
    saved += 1
  }
  return saved
}
