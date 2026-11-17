// 仅开发环境使用：给学习计划页灌一批计划，用来预览「刻度滚动条」在长列表下的表现。
// 只在 URL 带 ?demo=plans / ?demo=clear 时由 PlansView 动态引入，生产构建不会打进产物。
import { deletePlan, savePlan } from '../db/index.js'

// 固定 id，重复执行只覆盖不叠加；14 条分布在 5 个日子上，方便看「按天分组」和刻度滚动条。
// 第五项是相对今天的天数：0 = 今天，-1 = 昨天（未完成会顺延到今天），正数是未来。
const SEEDS = [
  ['数学', '一元二次方程 · 8 道练习', 25, '高', 0],
  ['物理', '浮力练习 4 道', 20, '高', 0],
  ['数学', '因式分解 · 12 道', 20, '中', 0],
  ['语文', '《诫子书》背诵', 12, '中', 0],
  ['英语', 'Unit 4 单词', 15, '中', -1],
  ['化学', '化学方程式默写', 10, '中', -1],
  ['语文', '病句修改 5 道', 10, '中', 1],
  ['英语', '错词听写', 10, '中', 1],
  ['物理', '压强复习', 15, '中', 1],
  ['英语', '听力两段对话', 10, '低', 2],
  ['生物', '光合作用流程图', 12, '中', 2],
  ['数学', '二次函数图像', 15, '中', 4],
  ['化学', '溶液配制计算', 15, '中', 4],
  ['语文', '文言实词 10 个', 12, '中', 8]
]

export function buildDemoPlanList() {
  const base = new Date()
  base.setHours(0, 0, 0, 0)
  const day0 = base.getTime()
  return SEEDS.map(([subject, name, minutes, priority, offset], index) => {
    const plan = {
      id: `demo-plan-list-${index + 1}`,
      name,
      subject,
      stage: 'concept',
      estimatedMinutes: minutes,
      sequenceOrder: index + 1,
      createdAt: Date.now() + index,
      priority,
      knowledgeTags: [],
      status: 'active'
    }
    // 今天的任务不设开始时间，一进页面就能做。
    if (offset === 0) return plan
    // 其他日子定在当天 18:00；昨天的会被判成「昨天未完成」，未来的到那天才排进今天。
    const stamp = day0 + offset * 86400000 + 18 * 60 * 60 * 1000
    return { ...plan, startAt: stamp, reviewTime: stamp }
  })
}

export async function seedDemoPlanList() {
  const list = buildDemoPlanList()
  for (const plan of list) await savePlan(plan)
  return list.length
}

export async function clearDemoPlanList() {
  const list = buildDemoPlanList()
  for (const plan of list) await deletePlan(plan.id)
  return list.length
}
