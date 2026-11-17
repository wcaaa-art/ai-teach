// 仅开发环境使用的演示数据：没有摄像头、也没空真跑 25 分钟时，用来预览专注空间三态的排版。
// 只在 URL 带 ?demo= 时由 FocusView 动态引入，生产构建不会打进产物。
import { deleteFocusSession, deletePlan, saveFocusSession, savePlan } from '../db/index.js'

const MINUTE = 60

// 一节课 25 分钟：8 分在学 → 走神 2 分 → 9 分在学 → 走神 1 分 → 离开 1 分 → 4 分在学。
// 合计在学 21 分、走神 3 分、离开 1 分，两次走神分别出现在第 8 分和第 19 分。
const FULL_TIMELINE = [
  { type: 'focus', seconds: 8 * MINUTE },
  { type: 'distracted', seconds: 2 * MINUTE },
  { type: 'focus', seconds: 9 * MINUTE },
  { type: 'distracted', seconds: 1 * MINUTE },
  { type: 'away', seconds: 1 * MINUTE },
  { type: 'focus', seconds: 4 * MINUTE }
]

function stamp(daysAgo, hour, minute) {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.getTime()
}

function makeSession({ id, start, actual, focus, distracted, away, timeline, subject }) {
  return {
    id,
    planId: null,
    taskName: subject,
    subject,
    // 用 free 模式生成，和「学科按钮直接开跑」的真实记录一致。
    mode: 'free',
    startedAt: start,
    endedAt: start + actual * 1000,
    actualSeconds: actual,
    completed: false,
    distractionCount: Math.max(0, Math.round(distracted / 120)),
    focusSeconds: focus,
    distractedSeconds: distracted,
    awaySeconds: away,
    sampled: true,
    timeline,
    createdAt: start
  }
}

// 三条记录覆盖三态：今天这条给回顾页，三条一起给待机页的「上次专注 / 最近 3 次」。
export function buildDemoFocusSessions() {
  return [
    makeSession({
      id: 'demo-focus-latest',
      start: stamp(0, 20, 41),
      actual: 25 * MINUTE,
      focus: 21 * MINUTE,
      distracted: 3 * MINUTE,
      away: 1 * MINUTE,
      timeline: FULL_TIMELINE,
      subject: '数学'
    }),
    makeSession({
      id: 'demo-focus-yesterday',
      start: stamp(1, 20, 10),
      actual: 25 * MINUTE,
      focus: 17 * MINUTE,
      distracted: 5 * MINUTE,
      away: 3 * MINUTE,
      timeline: [
        { type: 'focus', seconds: 6 * MINUTE },
        { type: 'distracted', seconds: 3 * MINUTE },
        { type: 'focus', seconds: 11 * MINUTE },
        { type: 'away', seconds: 3 * MINUTE },
        { type: 'distracted', seconds: 2 * MINUTE }
      ],
      subject: '数学'
    }),
    makeSession({
      id: 'demo-focus-earlier',
      start: stamp(2, 19, 50),
      actual: 22 * MINUTE,
      focus: 13 * MINUTE,
      distracted: 6 * MINUTE,
      away: 3 * MINUTE,
      timeline: [
        { type: 'focus', seconds: 5 * MINUTE },
        { type: 'distracted', seconds: 4 * MINUTE },
        { type: 'focus', seconds: 8 * MINUTE },
        { type: 'away', seconds: 3 * MINUTE },
        { type: 'distracted', seconds: 2 * MINUTE }
      ],
      subject: '语文'
    })
  ]
}

export function buildDemoFocusSession() {
  return buildDemoFocusSessions()[0]
}

// 计划覆盖两种形态：数学 3 项（要下拉框选）、英语 2 项、语文 1 项（不用选）。
export function buildDemoPlans() {
  const now = Date.now()
  const base = { priority: '中', reviewTime: now + 86400000, knowledgeTags: [], status: 'active' }
  return [
    { ...base, id: 'demo-plan-math-1', name: '数学 · 一元二次方程', subject: '数学', stage: 'concept', estimatedMinutes: 25, sequenceOrder: 1, createdAt: now },
    { ...base, id: 'demo-plan-math-2', name: '数学 · 8 道练习', subject: '数学', stage: 'example', estimatedMinutes: 20, sequenceOrder: 2, createdAt: now + 1 },
    { ...base, id: 'demo-plan-math-3', name: '数学 · 错题复盘 3 道', subject: '数学', stage: 'review', estimatedMinutes: 15, sequenceOrder: 3, createdAt: now + 2 },
    { ...base, id: 'demo-plan-chinese-1', name: '语文 ·《诫子书》背诵', subject: '语文', stage: 'concept', estimatedMinutes: 15, sequenceOrder: 4, createdAt: now + 3 },
    { ...base, id: 'demo-plan-english-1', name: '英语 · Unit 4 单词', subject: '英语', stage: 'concept', estimatedMinutes: 15, sequenceOrder: 5, createdAt: now + 4 },
    { ...base, id: 'demo-plan-english-2', name: '英语 · 错词听写', subject: '英语', stage: 'review', estimatedMinutes: 10, sequenceOrder: 6, createdAt: now + 5 }
  ]
}

export async function seedDemoPlans() {
  const list = buildDemoPlans()
  for (const plan of list) await savePlan(plan)
  return list
}

export async function clearDemoPlans() {
  const list = buildDemoPlans()
  for (const plan of list) await deletePlan(plan.id)
}

// 固定 id，重复执行只覆盖不叠加。
export async function seedDemoFocus() {
  const list = buildDemoFocusSessions()
  for (const session of list) await saveFocusSession(session)
  return list
}

export async function clearDemoFocus() {
  const list = buildDemoFocusSessions()
  for (const session of list) await deleteFocusSession(session.id)
}
