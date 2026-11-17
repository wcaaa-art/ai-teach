// 学习计划点击后的统一分流器：决定一条计划打开哪种学习窗口。
// 三条路互斥，按优先级判断：
//   1. 复习错题 → /mistakes（打开错题复习）
//   2. 背诵/单词/听写 → /recite（背诵窗口，复用 detectReciteMode）
//   3. 练习/做题（含默认）→ /practice（本地题库秒出题）
// 所有计划都不再进专注空间。
import { detectReciteMode } from './reciteMode.js'

// 错题复习：名称里出现「错题 / 错题本 / 重做错题 / 复习错题」等，点开就是过一遍错题。
const MISTAKE_KEYWORDS = /错题|错题本|易错|重做|订正/

/**
 * 判断一条计划应该打开哪种学习窗口。
 * @param {{ subject?: string, name?: string }} plan
 * @returns {{ kind: 'practice'|'recite'|'mistakes', mode?: string, reason: string }}
 */
export function detectPlanTask(plan) {
  const subject = String(plan?.subject || '').trim()
  const name = String(plan?.name || '').trim()
  if (!name) return { kind: 'practice', reason: 'empty' }

  // 1. 错题复习优先：明确要过一遍错题的计划，直接进错题复习。
  if (MISTAKE_KEYWORDS.test(name)) {
    return { kind: 'mistakes', reason: '错题复习' }
  }

  // 2. 背诵 / 单词 / 听写：交给既有的背诵判定。
  const recite = detectReciteMode(plan)
  if (recite.mode) {
    return { kind: 'recite', mode: recite.mode, reason: recite.reason }
  }

  // 3. 其余一律走做题（练习、复习、巩固、知识点、以及任何没命中前面的计划）。
  return { kind: 'practice', reason: '练习做题' }
}

// 计划行上的小标记：让用户悬停前就知道这条会打开什么。
export const PLAN_TASK_BADGES = {
  practice: '做题',
  recite: '背诵',
  mistakes: '复习错题'
}

export function planTaskBadge(plan) {
  const task = detectPlanTask(plan)
  // 背诵类细分：单词/默写给更具体的标记。
  if (task.kind === 'recite') {
    return ({ text: '背诵', words: '背单词', dictation: '打字默写' })[task.mode] || '背诵'
  }
  return PLAN_TASK_BADGES[task.kind] || ''
}
