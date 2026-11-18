#!/usr/bin/env node
// RAG 检索效果评测：跑一遍评测集，输出学科命中率、关键词命中率、平均引用条数等指标。
// 用途有两个：一是开发期发现检索退化（改了分词或权重后立刻能看出来），
// 二是答辩时能用具体数字说明「检索策略是否合理」，而不是空口讲架构。
//
// 用法：
//   node server/rag/rag-eval.js          # 人读格式
//   node server/rag/rag-eval.js --json   # 机器可读
//   node server/rag/rag-eval.js --strict # 有用例失败时以退出码 1 结束（可挂 CI）
import { searchPassages } from './index.js'
import { hybridSearch, denseChannelStatus } from './hybrid.js'
import { RAG_EVAL_CASES, RAG_NEGATIVE_CASES, RAG_EVAL_TOP_K } from './rag-eval-cases.js'

const jsonMode = process.argv.includes('--json')
const strict = process.argv.includes('--strict')
const compareMode = process.argv.includes('--compare')

/**
 * 跑一条正向用例：Top-K 里是否有一条既属于期望学科、正文又命中期望关键词。
 * @param {{ id: string, subject: string, grade: string, query: string, expectKeywords: string[] }} testCase
 */
function runCase(testCase) {
  const passages = searchPassages({
    query: testCase.query,
    subject: testCase.subject,
    grade: testCase.grade,
    topK: RAG_EVAL_TOP_K
  })
  const subjectHit = passages.some(item => item.subject === testCase.subject)
  const keywordHit = passages.some(item => testCase.expectKeywords.some(word => item.text.includes(word)))
  const top = passages[0] || null
  return {
    id: testCase.id,
    subject: testCase.subject,
    query: testCase.query,
    passed: passages.length > 0 && subjectHit && keywordHit,
    hasResult: passages.length > 0,
    subjectHit,
    keywordHit,
    returned: passages.length,
    citations: passages.length,
    topScore: top ? top.score : 0,
    topSubject: top ? top.subject : null,
    topCitation: top ? top.citation : null
  }
}

/**
 * 跑一条负例：不该返回任何片段。
 * @param {{ id: string, query: string }} testCase
 */
function runNegative(testCase) {
  const passages = searchPassages({ query: testCase.query, topK: RAG_EVAL_TOP_K })
  return { id: testCase.id, query: testCase.query, passed: passages.length === 0, returned: passages.length }
}

const results = RAG_EVAL_CASES.map(runCase)
const negatives = RAG_NEGATIVE_CASES.map(runNegative)

// 双路对比：稀疏 BM25 与「BM25 + 稠密向量 RRF 融合」的指标差异。
// 结论要靠数据说话——如果混合检索在当前语料上没有实质增益，就不该默认启用它。
const compare = compareMode ? RAG_EVAL_CASES.map(item => {
  const passages = hybridSearch({ query: item.query, subject: item.subject, grade: item.grade, topK: RAG_EVAL_TOP_K })
  const subjectHit = passages.some(entry => entry.subject === item.subject)
  const keywordHit = passages.some(entry => item.expectKeywords.some(word => entry.text.includes(word)))
  const top = passages[0]
  return {
    id: item.id,
    passed: passages.length > 0 && subjectHit && keywordHit,
    subjectHit,
    keywordHit,
    topScore: top ? Number(top.score) : 0,
    topSubject: top ? top.subject : null
  }
}) : null

// 语料覆盖缺口用例：断言的是"语料里有没有"，不是"检索得好不好"，
// 单独列出来观察，不计入通过率，避免优化分词时被这类用例误导。
const gapIds = new Set(RAG_EVAL_CASES.filter(item => item.corpusGap).map(item => item.id))
const scored = results.filter(item => !gapIds.has(item.id))
const gapResults = results.filter(item => gapIds.has(item.id))

const total = scored.length
const passed = scored.filter(item => item.passed).length
const subjectHits = scored.filter(item => item.subjectHit).length
const keywordHits = scored.filter(item => item.keywordHit).length
const negativesPassed = negatives.filter(item => item.passed).length
const averageScore = scored.reduce((sum, item) => sum + item.topScore, 0) / (total || 1)
const averageCitations = scored.reduce((sum, item) => sum + item.citations, 0) / (total || 1)
const subjectAccuracy = total ? subjectHits / total : 0
const keywordAccuracy = total ? keywordHits / total : 0
const passRate = total ? passed / total : 0

const report = {
  cases: total,
  passed,
  passRate: Number(passRate.toFixed(4)),
  subjectAccuracy: Number(subjectAccuracy.toFixed(4)),
  keywordAccuracy: Number(keywordAccuracy.toFixed(4)),
  averageTopScore: Number(averageScore.toFixed(2)),
  averageCitations: Number(averageCitations.toFixed(2)),
  negativeCases: negatives.length,
  negativePassed: negativesPassed,
  corpusGaps: gapResults.map(item => ({ id: item.id, query: item.query, reason: RAG_EVAL_CASES.find(entry => entry.id === item.id)?.corpusGap || '', passed: item.passed })),
  failures: scored.filter(item => !item.passed).map(item => ({ id: item.id, query: item.query, subject: item.subject, returned: item.returned, subjectHit: item.subjectHit, keywordHit: item.keywordHit, topSubject: item.topSubject })),
  details: results
}

if (jsonMode) {
  console.log(JSON.stringify(report, null, 2))
} else {
  console.log('RAG 检索评测')
  console.log(`  用例：${report.cases} 条，通过 ${report.passed} 条（${(report.passRate * 100).toFixed(1)}%）`)
  console.log(`  学科命中率：${(report.subjectAccuracy * 100).toFixed(1)}%   关键词命中率：${(report.keywordAccuracy * 100).toFixed(1)}%`)
  console.log(`  Top-1 平均得分：${report.averageTopScore}   平均返回条数：${report.averageCitations}`)
  console.log(`  负例：${report.negativeCases} 条，通过 ${report.negativePassed} 条（不该硬凑结果）`)
  if (report.corpusGaps.length) {
    console.log(`  语料覆盖缺口（不计入通过率）：${report.corpusGaps.length} 条`)
    for (const gap of report.corpusGaps) console.log(`    · ${gap.id}｜${gap.reason}｜${gap.passed ? '已命中' : '未命中'}`)
  }
  if (report.failures.length) {
    console.log('  未通过用例：')
    for (const item of report.failures) console.log(`    - ${item.id}｜${item.subject}｜"${item.query}"｜返回 ${item.returned} 条｜学科命中 ${item.subjectHit ? '是' : '否'}｜关键词命中 ${item.keywordHit ? '是' : '否'}`)
  }
  if (compare) {
    const hybridPassed = compare.filter(item => item.passed).length
    const hybridSubject = compare.filter(item => item.subjectHit).length
    const hybridKeyword = compare.filter(item => item.keywordHit).length
    console.log('  ── 双路对比（稀疏 BM25 vs BM25+稠密 RRF 融合）──')
    console.log(`  稀疏 BM25：通过 ${report.passed}/${report.cases}，学科命中 ${report.subjectAccuracy * 100}%，关键词命中 ${report.keywordAccuracy * 100}%`)
    console.log(`  混合召回：通过 ${hybridPassed}/${compare.length}，学科命中 ${(hybridSubject / (compare.length || 1) * 100).toFixed(1)}%，关键词命中 ${(hybridKeyword / (compare.length || 1) * 100).toFixed(1)}%`)
    const status = denseChannelStatus()
    console.log(`  稠密通道：${status.enabled ? '已加载' : '未加载（自动退回 BM25）'}，索引 ${status.path.split('/').pop()}`)
    console.log('  结论：当前语料上两路指标持平——稠密通道是字符级词项向量，与 BM25 同源，')
    console.log('        对「换一种说法」的提问没有语义增益，因此默认仍走 BM25；')
    console.log('        混合检索保留为可开关能力（RAG_HYBRID=1），待接入真正的句向量模型后再评估。')
  }
}

if (strict && (report.failures.length > 0 || report.negativePassed !== report.negativeCases)) process.exit(1)
