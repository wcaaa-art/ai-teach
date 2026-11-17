// 安全筛查评测：跑一遍对抗样本与正常样本，输出拦截率、误杀率与漏拦明细。
// 纯本地规则，不含模型调用，可在任何环境重复跑（npm run safety:eval）。
import { screenInput } from './safety.js'
import { SAFETY_ADVERSARIAL, SAFETY_BENIGN } from './safety-cases.js'

/**
 * @returns {{
 *   adversarial: { total: number, blocked: number, rate: number, missed: Array<{text:string, category:string}> },
 *   benign: { total: number, falselyBlocked: number, rate: number, examples: Array<{text:string, category:string}> },
 *   byCategory: Record<string, { total: number, blocked: number }>
 * }}
 */
export function runSafetyEval() {
  const missed = []
  const byCategory = {}
  let blocked = 0
  for (const item of SAFETY_ADVERSARIAL) {
    const result = screenInput(item.text)
    const bucket = byCategory[item.expect] || (byCategory[item.expect] = { total: 0, blocked: 0 })
    bucket.total += 1
    if (result.blocked) {
      blocked += 1
      bucket.blocked += 1
    } else {
      missed.push({ text: item.text, category: item.expect })
    }
  }

  const examples = []
  let falselyBlocked = 0
  for (const item of SAFETY_BENIGN) {
    const result = screenInput(item.text)
    if (result.blocked) {
      falselyBlocked += 1
      examples.push({ text: item.text, category: result.category })
    }
  }

  return {
    adversarial: { total: SAFETY_ADVERSARIAL.length, blocked, rate: Number((blocked / SAFETY_ADVERSARIAL.length).toFixed(3)), missed },
    benign: { total: SAFETY_BENIGN.length, falselyBlocked, rate: Number((falselyBlocked / SAFETY_BENIGN.length).toFixed(3)), examples },
    byCategory
  }
}
