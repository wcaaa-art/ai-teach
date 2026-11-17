#!/usr/bin/env node
// 重排前后对比：同一批用例、同一份索引，只切换排序策略，输出可核对的差异。
// 用途是把"我们加了 Rerank"这句话，变成"命中率不变、Top-3 里不可读片段减少 N%"。
//
// 用法：
//   node server/rag/rag-rerank-eval.js           # 人读
//   node server/rag/rag-rerank-eval.js --strict  # 有用例退化则以 1 退出
import { searchPassages } from './index.js'
import { rerankPassages } from './rerank.js'
import { RAG_EVAL_CASES, RAG_EVAL_TOP_K } from './rag-eval-cases.js'

const strict = process.argv.includes('--strict')
const POOL = 8

function evaluate(useRerank) {
  let hit = 0
  let lowQualityInTop3 = 0
  let returned = 0
  let top1Low = 0
  let top1SubjectHit = 0
  let top1QualitySum = 0
  let top1Count = 0
  const rows = []
  // 语料缺口用例（corpusGap）断言的是"语料有没有"，不参与重排对比。
  for (const testCase of RAG_EVAL_CASES.filter(item => !item.corpusGap)) {
    const pool = searchPassages({
      query: testCase.query,
      subject: testCase.subject,
      grade: testCase.grade,
      topK: POOL
    })
    const passages = (useRerank ? rerankPassages(pool, { query: testCase.query, subject: testCase.subject, grade: testCase.grade }) : pool)
      .slice(0, RAG_EVAL_TOP_K)
    const subjectHit = passages.some(item => item.subject === testCase.subject)
    const keywordHit = passages.some(item => testCase.expectKeywords.some(word => item.text.includes(word)))
    const top3Low = passages.filter(item => item.lowQuality).length
    const passed = passages.length > 0 && subjectHit && keywordHit
    if (passed) hit += 1
    lowQualityInTop3 += top3Low
    returned += passages.length
    const top = passages[0]
    if (top) {
      if (top.lowQuality) top1Low += 1
      if (top.subject === testCase.subject) top1SubjectHit += 1
      top1QualitySum += Number(top.quality ?? 0)
      top1Count += 1
    }
    rows.push({ id: testCase.id, passed, top3Low, top: passages[0], query: testCase.query })
  }
  return { hit, total: RAG_EVAL_CASES.filter(item => !item.corpusGap).length, lowQualityInTop3, returned, rows, top1Low, top1SubjectHit, top1QualityAvg: top1Count ? top1QualitySum / top1Count : 0 }
}

const baseline = evaluate(false)
const reranked = evaluate(true)

console.log('RAG 重排对比（同一评测集、同一召回池 Top-8 → 取 Top-' + RAG_EVAL_TOP_K + '）')
console.log('')
console.log('  指标                      纯 BM25      加重排      变化')
const passRate = run => ((run.hit / run.total) * 100).toFixed(1) + '%'
const lowRate = run => (run.returned ? (run.lowQualityInTop3 / run.returned) * 100 : 0).toFixed(1) + '%'
console.log(`  用例通过率                ${passRate(baseline).padEnd(11)}  ${passRate(reranked).padEnd(10)}  ${reranked.hit - baseline.hit >= 0 ? '+' : ''}${reranked.hit - baseline.hit} 条`)
console.log(`  Top-3 中不可读片段占比    ${lowRate(baseline).padEnd(11)}  ${lowRate(reranked).padEnd(10)}  ${(Number(lowRate(reranked).replace('%', '')) - Number(lowRate(baseline).replace('%', ''))).toFixed(1)} pp`)
console.log(`  Top-1 学科命中率          ${((baseline.top1SubjectHit / baseline.total) * 100).toFixed(1) + '%'}        ${((reranked.top1SubjectHit / reranked.total) * 100).toFixed(1) + '%'}       ${reranked.top1SubjectHit - baseline.top1SubjectHit >= 0 ? '+' : ''}${reranked.top1SubjectHit - baseline.top1SubjectHit} 条`)
console.log(`  Top-1 平均可读性          ${baseline.top1QualityAvg.toFixed(2).padEnd(11)}  ${reranked.top1QualityAvg.toFixed(2).padEnd(10)}  ${(reranked.top1QualityAvg - baseline.top1QualityAvg >= 0 ? '+' : '') + (reranked.top1QualityAvg - baseline.top1QualityAvg).toFixed(2)}`)
console.log(`  Top-1 不可读片段条数      ${String(baseline.top1Low).padEnd(11)}  ${String(reranked.top1Low).padEnd(10)}  ${reranked.top1Low - baseline.top1Low >= 0 ? '+' : ''}${reranked.top1Low - baseline.top1Low}`)

const regressions = reranked.rows.filter((row, index) => baseline.rows[index].passed && !row.passed)
const gains = reranked.rows.filter((row, index) => !baseline.rows[index].passed && row.passed)
if (gains.length) console.log('\n  重排后新通过的用例：' + gains.map(row => row.id).join('、'))
if (regressions.length) console.log('\n  重排后退化的用例：' + regressions.map(row => row.id).join('、'))

const dropped = baseline.rows.filter((row, index) => reranked.rows[index].top3Low < row.top3Low)
if (dropped.length) {
  console.log('\n  不可读片段被挤出 Top-3 的用例：')
  for (const row of dropped.slice(0, 8)) {
    const after = reranked.rows.find(item => item.id === row.id)
    console.log(`    · ${row.id}：${row.top3Low} → ${after.top3Low} 条（${row.query}）`)
  }
}

console.log('')
console.log(`  结论：${regressions.length === 0 ? '重排未造成召回退化' : '重排存在退化用例，需先修权重'}${reranked.lowQualityInTop3 <= baseline.lowQualityInTop3 ? '，且 Top-3 可读性不劣化' : '，但 Top-3 可读性变差'}`)

if (strict && (regressions.length > 0 || reranked.lowQualityInTop3 > baseline.lowQualityInTop3)) process.exit(1)
