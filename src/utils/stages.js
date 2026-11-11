// 学习四阶段：概念理解 → 例题模仿 → 迁移应用 → 复盘纠错。
// 计划任务生成时会写入 stage；老计划没有该字段时按 sequenceOrder 推断，保证页面不会出现空白阶段。
export const STAGES = [
  { key: 'concept', label: '概念' },
  { key: 'example', label: '例题' },
  { key: 'transfer', label: '迁移' },
  { key: 'review', label: '复盘' }
]

export function stageOf(plan = {}) {
  const direct = STAGES.find(stage => stage.key === plan.stage || stage.label === plan.stage)
  if (direct) return direct.key
  const index = Math.max(0, Math.floor(Number(plan.sequenceOrder) || 0))
  return STAGES[index % STAGES.length].key
}

export function stageLabel(key) {
  return STAGES.find(stage => stage.key === key)?.label || ''
}

// 章节测试介入四阶段的阈值：≥80% 视为该章节的概念与例题已通过，<60% 视为没学稳、需要回退。
export const QUIZ_PASS_ACCURACY = 0.8
export const QUIZ_FALLBACK_ACCURACY = 0.6

// 每个阶段的真实状态：该阶段任务全部归档=done；当前进行中的任务所属阶段=current；其余=pending。
// 没有任何任务或计划全归档时，不会凭空点亮，避免展示未发生的进度。
export function stageStatesOf(plans = []) {
  const real = plans.filter(plan => !plan.isBridge)
  const current = real
    .filter(plan => plan.status !== 'archived')
    .sort((left, right) => (left.sequenceOrder || 999) - (right.sequenceOrder || 999))[0]
  const currentKey = current ? stageOf(current) : ''
  return STAGES.map(({ key }) => {
    const items = real.filter(plan => stageOf(plan) === key)
    if (!items.length) return 'pending'
    if (items.every(plan => plan.status === 'archived')) return 'done'
    return key === currentKey ? 'current' : 'pending'
  })
}

// 章节测试结果回写任务阶段：只匹配同科目且属于测试章节的任务，不影响其他章节和桥接复习。
// ≥80%：把该章节还在进行的「概念」「例题」归档，当前任务自然推进到「迁移」。
// <60%：重新打开已归档的「例题」任务；没有例题则回到「概念」，避免带着漏洞继续迁移。
export function applyQuizStageResult({ plans = [], result = {} } = {}) {
  const accuracy = Number(result?.accuracy)
  const chapterIds = new Set((result?.chapterIds || []).filter(Boolean))
  const chapterNames = new Set((result?.chapterNames || []).filter(Boolean))
  const subject = String(result?.subject || '')
  const orderOf = plan => Number(plan.sequenceOrder) || 999
  if (!plans.length || !Number.isFinite(accuracy) || (!chapterIds.size && !chapterNames.size)) {
    return { plans, changed: [], message: '' }
  }
  // 老计划可能没有 chapterId，用知识点标签里的章节名兜底匹配。
  const matched = plans.filter(plan => {
    if (plan.isBridge) return false
    if (subject && plan.subject !== subject) return false
    const ids = [plan.chapterId, ...(plan.chapterIds || [])].filter(Boolean)
    if (ids.some(id => chapterIds.has(id))) return true
    return (plan.knowledgeTags || []).some(tag => chapterNames.has(tag))
  })
  const updated = new Map()
  let message = ''
  const percent = Math.round(accuracy * 100)
  if (accuracy >= QUIZ_PASS_ACCURACY) {
    for (const plan of matched) {
      if (plan.status === 'archived') continue
      if (!['concept', 'example'].includes(stageOf(plan))) continue
      updated.set(plan.id, { ...plan, status: 'archived' })
    }
    if (updated.size) message = `正确率 ${percent}%，已自动归档「概念」「例题」，直接进入「迁移」。`
  } else if (accuracy < QUIZ_FALLBACK_ACCURACY) {
    const archived = matched.filter(plan => plan.status === 'archived').sort((left, right) => orderOf(left) - orderOf(right))
    const target = archived.find(plan => stageOf(plan) === 'example') || archived.find(plan => stageOf(plan) === 'concept')
    if (target) {
      updated.set(target.id, { ...target, status: 'active' })
      message = stageOf(target) === 'example'
        ? `正确率 ${percent}%，已重新打开「例题」任务，练稳再进迁移。`
        : `正确率 ${percent}%，没有可重练的例题，已回到「概念」重建基础。`
    }
  }
  return {
    plans: plans.map(plan => updated.get(plan.id) || plan),
    changed: [...updated.values()],
    message
  }
}
