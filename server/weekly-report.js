// AI 周报的确定性兜底与结果归一化：不依赖模型，方便直接单测。
// 入参由前端聚合近 7 天数据，这里只做防御性取值，不信任字段类型。
import { safeFilter } from './agent.js'

const clampText = (value, limit) => safeFilter(String(value ?? '').replace(/\s+/g, ' ').trim()).slice(0, limit)

function toNumber(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : 0
}

function toCount(value) {
  return Math.max(0, Math.round(toNumber(value)))
}

function toPercent(value) {
  return Math.min(100, Math.max(0, Math.round(toNumber(value))))
}

// 模型不可用或未配置密钥时，按本地数据拼出一份结构相同的周报。
export function buildFallbackWeeklyReport(payload = {}) {
  const focus = payload.focus && typeof payload.focus === 'object' ? payload.focus : {}
  const quiz = payload.quiz && typeof payload.quiz === 'object' ? payload.quiz : {}
  const mistakes = payload.mistakes && typeof payload.mistakes === 'object' ? payload.mistakes : {}
  const exams = payload.exams && typeof payload.exams === 'object' ? payload.exams : {}
  const plans = payload.plans && typeof payload.plans === 'object' ? payload.plans : {}

  const focusMinutes = toCount(focus.minutes)
  const focusSessions = toCount(focus.sessions)
  const completionRate = toPercent(focus.completionRate)
  const activeDays = toCount(focus.activeDays)
  const streakDays = toCount(focus.streakDays)
  const distractionCount = toCount(focus.distractions)
  const distractionRate = focusSessions ? Math.round(distractionCount / focusSessions * 10) / 10 : 0
  const focusDelta = focus.deltaPercent === null || focus.deltaPercent === undefined ? null : Math.round(toNumber(focus.deltaPercent))
  const topDistraction = focus.topDistraction?.label
    ? { label: clampText(focus.topDistraction.label, 12), count: toCount(focus.topDistraction.count) }
    : null
  const peak = Number.isFinite(Number(focus.peakWindow?.start))
    ? {
        start: Math.max(0, Math.min(22, Math.round(Number(focus.peakWindow.start)))),
        end: Math.max(1, Math.min(24, Math.round(Number(focus.peakWindow.end ?? Number(focus.peakWindow.start) + 2))))
      }
    : null

  const tests = toCount(quiz.tests)
  const questions = toCount(quiz.questions)
  const accuracy = toPercent(quiz.accuracy)
  const previousAccuracy = quiz.previousAccuracy === null || quiz.previousAccuracy === undefined ? null : toPercent(quiz.previousAccuracy)
  const accuracyDelta = previousAccuracy === null ? null : accuracy - previousAccuracy
  const weakest = quiz.weakestSubject?.subject
    ? { subject: clampText(quiz.weakestSubject.subject, 8), accuracy: toPercent(quiz.weakestSubject.accuracy) }
    : null

  const mistakeCount = toCount(mistakes.count)
  const unresolvedMistakes = toCount(mistakes.unresolved)
  const fixedMistakes = toCount(mistakes.fixed)
  const redoCount = toCount(mistakes.redos)
  const redoCorrect = Math.min(redoCount, toCount(mistakes.redoCorrect))
  const redoAccuracy = redoCount ? Math.round(redoCorrect / redoCount * 100) : null
  const topWrong = Array.isArray(mistakes.topChapters)
    ? mistakes.topChapters
      .filter(item => item && item.name)
      .slice(0, 3)
      .map(item => ({ name: clampText(item.name, 16), subject: clampText(item.subject || '', 8), count: toCount(item.count) }))
    : []

  const planActive = toCount(plans.active)
  const planCompleted = toCount(plans.completedThisWeek)
  const planTotal = planActive + planCompleted
  const planRate = planTotal ? Math.round(planCompleted / planTotal * 100) : null

  const examCount = toCount(exams.count)
  const examAverage = toPercent(exams.averageRate)
  const latestExam = exams.latest?.name
    ? { name: clampText(exams.latest.name, 16), rate: toPercent(exams.latest.rate) }
    : null

  const hasFocus = focusSessions > 0
  const hasQuiz = tests > 0
  const hasExam = examCount > 0
  const hasAny = hasFocus || hasQuiz || hasExam || mistakeCount > 0 || planCompleted > 0 || fixedMistakes > 0 || redoCount > 0

  let headline = '这一周还没有留下学习记录'
  if (hasFocus) {
    const trend = focusDelta === null ? '' : focusDelta >= 0 ? `，较上周多 ${focusDelta}%` : `，较上周少 ${Math.abs(focusDelta)}%`
    headline = `本周专注 ${focusMinutes} 分钟${trend}`
  } else if (hasQuiz) {
    headline = `本周完成 ${tests} 次测试，平均正确率 ${accuracy}%`
  } else if (hasExam) {
    headline = `本周录入 ${examCount} 场考试，平均得分率 ${examAverage}%`
  } else if (fixedMistakes > 0) {
    headline = `本周消灭 ${fixedMistakes} 道错题`
  } else if (planCompleted > 0) {
    headline = `本周完成 ${planCompleted} 条计划任务`
  } else if (mistakeCount > 0) {
    headline = `本周新增 ${mistakeCount} 道错题，等待复盘`
  }

  const summaryParts = []
  if (hasFocus) summaryParts.push(`近 7 天累计专注 ${focusMinutes} 分钟，完成 ${focusSessions} 次专注，完成率 ${completionRate}%，有 ${activeDays} 天留下学习记录。`)
  if (hasQuiz) {
    const deltaText = accuracyDelta === null ? '' : accuracyDelta >= 0 ? `，比上一周高 ${accuracyDelta} 个百分点` : `，比上一周低 ${Math.abs(accuracyDelta)} 个百分点`
    summaryParts.push(`完成 ${tests} 次章节测试共 ${questions} 题，平均正确率 ${accuracy}%${deltaText}。`)
  }
  if (planTotal > 0) summaryParts.push(`计划任务完成 ${planCompleted} 条，完成率 ${planRate}%${planActive ? `，还有 ${planActive} 条待完成` : ''}。`)
  if (mistakeCount > 0 || fixedMistakes > 0 || redoCount > 0) {
    const pieces = []
    if (mistakeCount > 0) pieces.push(`新增 ${mistakeCount} 道错题${topWrong[0] ? `（集中在「${topWrong[0].name}」）` : ''}`)
    if (fixedMistakes > 0) pieces.push(`消灭 ${fixedMistakes} 道`)
    if (redoCount > 0) pieces.push(`重做 ${redoCount} 次、答对 ${redoCorrect} 次`)
    summaryParts.push(`${pieces.join('，')}。`)
  }
  if (hasExam) summaryParts.push(`录入 ${examCount} 场学校考试，平均得分率 ${examAverage}%${latestExam ? `，最近一次「${latestExam.name}」为 ${latestExam.rate}%` : ''}。`)
  if (!summaryParts.length) summaryParts.push('近 7 天没有专注、测试、错题或考试记录，暂时无法判断学习效果。')

  const strengths = []
  if (planRate !== null && planRate >= 60 && planCompleted > 0) strengths.push(`计划完成率 ${planRate}%，本周完成 ${planCompleted} 条任务。`)
  if (fixedMistakes > 0) strengths.push(`本周消灭 ${fixedMistakes} 道错题，复盘有实际产出。`)
  if (hasQuiz && accuracy >= 80) strengths.push(`测试平均正确率 ${accuracy}%，基础掌握较稳。`)
  if (hasFocus && completionRate >= 80) strengths.push(`专注完成率 ${completionRate}%，开始的任务基本都能走完。`)
  if (redoCount >= 3 && redoAccuracy !== null && redoAccuracy >= 80) strengths.push(`错题重做正确率 ${redoAccuracy}%，同类题已经能独立做对。`)
  if (streakDays >= 3) strengths.push(`连续 ${streakDays} 天有学习记录，节奏比较稳定。`)
  if (activeDays >= 5) strengths.push(`有 ${activeDays} 天在学，学习频率保持得不错。`)
  if (focusDelta !== null && focusDelta >= 10) strengths.push(`专注时长比上一周多 ${focusDelta}%，投入在增加。`)
  if (accuracyDelta !== null && accuracyDelta >= 5) strengths.push(`测试正确率比上一周提升 ${accuracyDelta} 个百分点。`)
  if (hasExam && examAverage >= 85) strengths.push(`考试平均得分率 ${examAverage}%，已接近优秀区间。`)
  if (hasQuiz && mistakeCount === 0) strengths.push('本周没有新增错题，练习质量不错。')
  if (!strengths.length) {
    strengths.push(hasAny ? '已经留下学习记录，坚持每周复盘就能看到趋势。' : '还没有记录，从一次 25 分钟专注开始就能积累数据。')
  }

  const risks = []
  if (accuracy > 0 && accuracy < 60) risks.push(`测试平均正确率只有 ${accuracy}%，概念和基础题需要回补。`)
  else if (accuracy >= 60 && accuracy < 75) risks.push(`测试平均正确率 ${accuracy}%，中档题还不够稳。`)
  if (weakest && weakest.accuracy < 70) risks.push(`${weakest.subject}正确率 ${weakest.accuracy}%，是当前最薄弱的科目。`)
  if (topWrong[0] && topWrong[0].count >= 2) risks.push(`错题集中在「${topWrong[0].name}」（${topWrong[0].count} 道），同类错误在重复。`)
  if (focusDelta !== null && focusDelta <= -20) risks.push(`专注时长比上一周少 ${Math.abs(focusDelta)}%，节奏在回落。`)
  if (hasFocus && completionRate < 60) risks.push(`专注完成率 ${completionRate}%，不少任务中途停下。`)
  if (distractionRate >= 1.5) risks.push(`平均每次专注分心 ${distractionRate} 次，注意力被打断较多。`)
  if (topDistraction && topDistraction.count >= 3) risks.push(`「${topDistraction.label}」出现 ${topDistraction.count} 次，是本周主要干扰。`)
  if (planRate !== null && planRate < 50 && planTotal >= 3) risks.push(`计划完成率 ${planRate}%，还有 ${planActive} 条任务没收尾。`)
  if (redoCount >= 2 && redoAccuracy !== null && redoAccuracy < 50) risks.push(`重做 ${redoCount} 次只对了 ${redoCorrect} 次，解析还没真正吃透。`)
  if (unresolvedMistakes >= 5 && fixedMistakes === 0) risks.push(`还有 ${unresolvedMistakes} 道错题没消灭，错题本在积压。`)
  if (!risks.length) {
    risks.push(hasAny ? '暂未发现明显风险，保持当前节奏，把时间优先给薄弱章节。' : '没有数据就无法判断风险，先恢复学习记录。')
  }

  const actions = []
  if (weakest) actions.push(`先补 ${weakest.subject}：挑一个错题最多的章节，做概念梳理加 10 道基础题。`)
  if (topWrong[0]) actions.push(`安排一次 25 分钟错题复盘，重点看「${topWrong[0].name}」的同类题。`)
  if (accuracy > 0 && accuracy < 80) actions.push('做一次同章测试，正确率到 80% 再进入下一章。')
  if (focusDelta !== null && focusDelta <= -20) actions.push('下周至少安排 3 次 25 分钟专注，先把学习时长补回来。')
  if (distractionRate >= 1) actions.push('专注前把手机放到视线外、关掉无关标签页，把每次专注的分心降到 1 次以内。')
  if (planRate !== null && planRate < 60 && planActive > 0) actions.push('把没完成的计划任务拆成 25 分钟小块，先完成最靠前的两条。')
  if (unresolvedMistakes > 0 && redoCount === 0) actions.push('从待消灭错题里挑 2 道，安排一次 25 分钟重做。')
  if (redoCount >= 2 && redoAccuracy !== null && redoAccuracy < 50) actions.push('错题重做前先遮住答案，做完再对照解析找卡住的步骤。')
  if (peak && peak.end - peak.start >= 2) actions.push(`把最难的科目放在 ${peak.start}:00–${peak.end}:00 的高效时段。`)
  const defaultActions = !hasAny
    ? ['先完成一次 25 分钟专注，让看板开始积累数据。', '选一个正在学的章节做一次日常测试，正确率会进入下周周报。', '如果最近考过试，把成绩录入看板，周报才能对照考试表现。']
    : ['保持每天至少一次 25 分钟专注，优先完成计划里最靠前的任务。', '周末用 15 分钟回看本周错题，把还不会的题单独标记。', '下周开始前定一个具体目标，例如完成一个薄弱章节的测试。']
  for (const item of defaultActions) {
    if (actions.length >= 3) break
    if (!actions.includes(item)) actions.push(item)
  }

  let closing = '保持每周复盘一次，让计划跟着数据调整。'
  if (!hasAny) closing = '从一次 25 分钟专注开始，下周就能看到第一份有数据的周报。'
  else if (planRate !== null && planRate < 50 && planTotal >= 3) closing = '计划完成率偏低，下周先把任务量减到能收尾的程度。'
  else if (focusDelta !== null && focusDelta <= -20) closing = '这周投入偏少，下周先恢复固定时段，再谈加量。'
  else if (focusDelta !== null && focusDelta >= 10) closing = '节奏在往上走，下周优先补最薄弱的一科，不要同时开太多线。'
  else if (accuracy > 0 && accuracy < 60) closing = '先把基础题的正确率拉起来，再挑战综合题。'

  return {
    headline: clampText(headline, 60),
    summary: clampText(summaryParts.join(''), 320),
    strengths: strengths.slice(0, 4).map(item => clampText(item, 60)),
    risks: risks.slice(0, 4).map(item => clampText(item, 60)),
    actions: actions.slice(0, 4).map(item => clampText(item, 60)),
    closing: clampText(closing, 120)
  }
}

// 模型输出可能缺字段、夹带空串或多给条目；统一裁剪成固定结构，缺失部分回落到本地版本。
export function normalizeWeeklyReport(raw, fallback = {}) {  const base = fallback && typeof fallback === 'object' ? fallback : buildFallbackWeeklyReport({})
  const source = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {}
  const pick = (value, alt, limit) => clampText(value, limit) || alt
  const list = (value, alt) => {
    const items = Array.isArray(value)
      ? value.filter(item => typeof item === 'string').map(item => clampText(item, 60)).filter(Boolean).slice(0, 4)
      : []
    return items.length ? items : (Array.isArray(alt) ? alt.slice(0, 4) : [])
  }

  return {
    headline: pick(source.headline, base.headline || '本周学习周报', 60),
    summary: pick(source.summary, base.summary || '', 320),
    strengths: list(source.strengths, base.strengths),
    risks: list(source.risks, base.risks),
    actions: list(source.actions, base.actions),
    closing: pick(source.closing, base.closing || '保持每周复盘一次，让计划跟着数据调整。', 120)
  }
}

// === 周报数字一致性校验 ===
// 模型偶尔会写出输入数据里没有的数字（幻觉）。这里把周报正文里出现的关键指标
// 逐个抠出来，和前端传入的真实聚合数据对齐核对：
// 「禁止编造」不能只写在提示词里，得有可执行的兜底。这里不判断文采，只判断数字对不对。

// 每条规则 = 一个可被机器复核的指标：正文里怎么写、真实值在 payload 的哪个字段。
const WEEKLY_METRICS = [
  { key: 'focusMinutes', label: '专注分钟', path: ['focus', 'minutes'], pattern: /专注[^。；\n]{0,8}?(\d+)\s*分钟/g },
  { key: 'focusSessions', label: '专注次数', path: ['focus', 'sessions'], pattern: /(\d+)\s*次专注/g },
  { key: 'quizTests', label: '测试次数', path: ['quiz', 'tests'], pattern: /完成\s*(\d+)\s*次[^。；\n]{0,4}测试/g },
  { key: 'quizAccuracy', label: '测试正确率', path: ['quiz', 'accuracy'], pattern: /正确率[^。；\n]{0,6}?(\d+)\s*%/g },
  { key: 'fixedMistakes', label: '消灭错题', path: ['mistakes', 'fixed'], pattern: /消灭\s*(\d+)\s*道/g },
  { key: 'newMistakes', label: '新增错题', path: ['mistakes', 'count'], pattern: /新增\s*(\d+)\s*道/g },
  { key: 'redoCount', label: '错题重做次数', path: ['mistakes', 'redos'], pattern: /重做\s*(\d+)\s*次/g },
  { key: 'planCompleted', label: '计划完成条数', path: ['plans', 'completedThisWeek'], pattern: /完成\s*(\d+)\s*条(?:计划)?(?:任务|计划任务)/g }
]

function readPath(source, path) {
  let current = source
  for (const key of path) {
    if (!current || typeof current !== 'object') return null
    current = current[key]
  }
  const number = Number(current)
  return Number.isFinite(number) ? number : null
}

/**
 * 核对周报正文里的关键数字与真实数据是否一致。
 * @param {{ headline?: string, summary?: string, strengths?: string[], risks?: string[], actions?: string[], closing?: string }} report
 * @param {Record<string, any>} payload 前端聚合的真实数据
 */
export function verifyWeeklyReportNumbers(report = {}, payload = {}) {
  const parts = []
  if (report.headline) parts.push(String(report.headline))
  if (report.summary) parts.push(String(report.summary))
  for (const key of ['strengths', 'risks', 'actions']) {
    if (Array.isArray(report[key])) parts.push(...report[key].map(item => String(item)))
  }
  if (report.closing) parts.push(String(report.closing))
  const text = parts.join('\n')

  const mismatches = []
  let checked = 0
  for (const metric of WEEKLY_METRICS) {
    const expected = readPath(payload, metric.path)
    if (expected === null) continue
    const pattern = new RegExp(metric.pattern.source, 'g')
    let match = pattern.exec(text)
    while (match !== null) {
      const reported = Number(match[1])
      if (Number.isFinite(reported)) {
        // 「正确率到 80% 再进入下一章」里的 80 是目标值不是实测值，不能算冲突。
        const numberAt = match.index + match[0].lastIndexOf(match[1])
        const before = text.slice(Math.max(0, numberAt - 4), numberAt)
        const isTarget = /到|至|至少|目标/.test(before)
        if (!isTarget) {
          checked += 1
          // 允许 ±1 的口径误差：模型常把百分比与次数做四舍五入。
          if (Math.abs(reported - expected) > 1) {
            mismatches.push({ metric: metric.key, label: metric.label, reported, expected, snippet: match[0] })
          }
        }
      }
      match = pattern.exec(text)
    }
  }
  return { consistent: mismatches.length === 0, checked, mismatches: mismatches.slice(0, 6) }
}
