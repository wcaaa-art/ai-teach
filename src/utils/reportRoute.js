// 补强路线：把「专题 × 四阶段」的几十条计划压成 4 个可执行步骤。
// 排序按掌握度升序而不是教材顺序——报告的价值是告诉你先做什么。

const STAGE_LABEL = { concept: '概念梳理', example: '例题模仿', transfer: '迁移应用', review: '复盘纠错' }
const STAGE_ACTION = {
  concept: '看概念课',
  example: '看例题精讲',
  transfer: '做专项练习',
  review: '复盘错题'
}
// 动作类型只由阶段决定，与文案无关；改文案不会影响跳转。
const STAGE_ACTION_TYPE = { concept: 'video', example: 'doc', transfer: 'quiz', review: 'review' }
// 产出文案描述「做完获得什么」。
const STAGE_OUTCOME = {
  concept: '先有框架，刷题才不瞎猜',
  example: '照着例题完整走一遍',
  transfer: '掌握度表补上第 1 格',
  review: '同样的错不再犯第二次'
}
const STEP_LABEL = ['一', '二', '三', '四']

function stageRank(stage) {
  return { concept: 0, example: 1, transfer: 2, review: 3 }[stage] ?? 9
}

export function buildRoadSteps({ plans = [], rows = [], chapters = [], limit = 4 } = {}) {
  const masteryOf = new Map(rows.map(row => [row.id, row.mastery]))
  const active = plans.filter(plan => plan.status !== 'archived')
  const bridges = active.filter(plan => plan.isBridge)
  const tasks = active.filter(plan => !plan.isBridge && plan.chapterId)

  const sorted = [...tasks].sort((a, b) => {
    const masteryA = masteryOf.get(a.chapterId) ?? 0
    const masteryB = masteryOf.get(b.chapterId) ?? 0
    if (masteryA !== masteryB) return masteryA - masteryB
    if (a.chapterId === b.chapterId) return stageRank(a.stage) - stageRank(b.stage)
    return (a.sequenceOrder || 0) - (b.sequenceOrder || 0)
  })

  // 没有任何任务（从零基础规划 / 跳过摸底）时按教材顺序给 4 步，第一步就是做测试建立起点。
  // 用 chapters 而不是 rows：rows 只含已测专题，零基线时可能为空。
  if (!sorted.length) {
    return chapters.slice(0, limit).map((chapter, index) => ({
      step: index + 1,
      label: `补强第${STEP_LABEL[index] || index + 1}步`,
      planId: `zero-${chapter.id}`,
      chapterId: chapter.id,
      chapterName: chapter.name,
      stage: 'concept',
      stageLabel: '建立起点',
      action: '做章节测试 5-8 题',
      minutes: 10,
      actionType: 'retest',
      outcome: '拿到这个专题的真实起点',
      bridge: null
    }))
  }

  return sorted.slice(0, limit).map((plan, index) => {
    const bridge = bridges.find(item => (item.chapterIds || []).includes(plan.chapterId))
    return {
      step: index + 1,
      label: `补强第${STEP_LABEL[index] || index + 1}步`,
      planId: plan.id,
      chapterId: plan.chapterId,
      chapterName: (plan.name || '').split(' · ')[0],
      stage: plan.stage,
      stageLabel: STAGE_LABEL[plan.stage] || '',
      action: `${STAGE_ACTION[plan.stage] || '完成任务'} ${plan.estimatedMinutes || 20} 分钟`,
      minutes: (plan.estimatedMinutes || 20) + (bridge && index === 0 ? bridge.estimatedMinutes || 10 : 0),
      actionType: STAGE_ACTION_TYPE[plan.stage] || 'progress',
      outcome: STAGE_OUTCOME[plan.stage] || '继续推进这一节',
      bridge: index === 0 && bridge ? bridge : null
    }
  })
}
