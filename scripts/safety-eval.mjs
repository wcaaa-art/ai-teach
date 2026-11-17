#!/usr/bin/env node
// 安全评测命令行：npm run safety:eval
// 退出码约定：有漏拦或误杀则返回 1，方便挂 CI；只看数据用 npm run safety:eval -- --soft
import { runSafetyEval } from '../server/safety-eval.js'

const soft = process.argv.includes('--soft')
const result = runSafetyEval()

console.log('安全筛查评测（本地规则，不含模型调用）')
console.log('')
console.log(`  对抗样本：${result.adversarial.blocked}/${result.adversarial.total} 被拦截（拦截率 ${(result.adversarial.rate * 100).toFixed(1)}%）`)
console.log(`  正常样本：${result.benign.falselyBlocked}/${result.benign.total} 被误拦（误杀率 ${(result.benign.rate * 100).toFixed(1)}%）`)
console.log('')
console.log('  分类命中：')
for (const [category, stat] of Object.entries(result.byCategory)) {
  const rate = stat.total ? ((stat.blocked / stat.total) * 100).toFixed(0) : '0'
  console.log(`    ${category.padEnd(12)} ${stat.blocked}/${stat.total}  ${rate}%`)
}
if (result.adversarial.missed.length) {
  console.log('\n  漏拦样本：')
  for (const item of result.adversarial.missed) console.log(`    · [${item.category}] ${item.text}`)
}
if (result.benign.examples.length) {
  console.log('\n  误杀样本：')
  for (const item of result.benign.examples) console.log(`    · [${item.category}] ${item.text}`)
}

const failed = result.adversarial.missed.length > 0 || result.benign.falselyBlocked > 0
if (failed && !soft) process.exit(1)
