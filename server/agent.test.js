import test from 'node:test'
import assert from 'node:assert/strict'
import { callDeepSeek, createStreamAccumulator, guardTutorAnswer, normalizeStage, parseSseLine, publicCitations, safeFilter, fallbackPlan, normalizePlanOutput, normalizeReplacedPlan, streamAgent, summarizeToolResult } from './agent.js'
import { executeTool, toolSchemas, validateToolArguments } from './tools.js'
import { buildAdaptivePlan, buildDiagnosticBlueprint, buildFallbackDiagnosticQuestions, listCurriculumChapters, listCurriculumSubjects, searchCurriculum, stampDiagnosticQuestionIds } from './curriculum.js'
import { tutorSystemPrompt } from './prompts.js'

test('SSE 行解析能识别完成标记并忽略无效行', () => {
  assert.deepEqual(parseSseLine('data: [DONE]'), { done: true })
  assert.deepEqual(parseSseLine('data: {"choices":[]}'), { done: false, payload: { choices: [] } })
  assert.equal(parseSseLine('event: meta'), null)
  assert.equal(parseSseLine('data: not-json'), null)
})

test('流式增量累加能拼接推理、正文与分片工具参数', () => {
  const accumulator = createStreamAccumulator()
  accumulator.push({ choices: [{ delta: { reasoning_content: '先看' } }] })
  accumulator.push({ choices: [{ delta: { reasoning_content: '条件' } }] })
  accumulator.push({ choices: [{ delta: { content: '你' } }] })
  accumulator.push({ choices: [{ delta: { content: '好' } }] })
  accumulator.push({ choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_1', function: { name: 'rag_knowledge_query', arguments: '{"sub' } }] } }] })
  accumulator.push({ choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'ject":"数学"}' } }] } }] })
  assert.equal(accumulator.state.reasoning, '先看条件')
  assert.equal(accumulator.state.content, '你好')
  assert.equal(accumulator.state.toolCalls[0].name, 'rag_knowledge_query')
  assert.equal(accumulator.state.toolCalls[0].arguments, '{"subject":"数学"}')
})

test('工具结果摘要能给出可读的步骤说明', () => {
  assert.equal(summarizeToolResult('rag_knowledge_query', { matches: ['二次函数', '一元二次方程'] }), '命中 2 个知识点：二次函数、一元二次方程')
  assert.equal(summarizeToolResult('calc_review_interval', { intervalDays: 4 }), '建议 4 天后复习')
  assert.equal(summarizeToolResult('rag_knowledge_query', { error: 'bad' }), '参数校验未通过，已跳过')
})

test('检索引用去重并拆出出处与题型', () => {
  const citations = publicCitations({ citations: [
    '《2024年广东省中考数学试卷（解析版）》：数学2024年中考真题',
    '《2024年广东省中考数学试卷（解析版）》：数学2024年中考真题',
    '《2023年广东省中考物理真题》：物理2023年中考真题',
    '《2022年广东省中考化学真题》：化学2022年中考真题',
    '《2021年广东省中考语文真题》：语文2021年中考真题'
  ] })
  assert.equal(citations.length, 4)
  assert.deepEqual(citations[0], {
    text: '《2024年广东省中考数学试卷（解析版）》：数学2024年中考真题',
    title: '2024年广东省中考数学试卷（解析版）',
    detail: '数学2024年中考真题'
  })
  assert.equal(citations[1].detail, '物理2023年中考真题')
  // 非标准格式原样保留，避免丢来源。
  assert.equal(publicCitations({ citations: ['本地题库'] })[0].title, '本地题库')
})

test('检索引用透传片段原文，折叠空白并截断到 240 字', () => {
  const citations = publicCitations({ citations: [{
    text: '《2024年广东省中考数学试卷（解析版）》：数学2024年中考真题',
    snippet: `第一行\n\n第二行 ${'x'.repeat(400)}`,
    lowQuality: true
  }] })
  assert.equal(citations[0].snippet.slice(0, 7), '第一行 第二行')
  assert.equal(citations[0].snippet.length, 240)
  assert.equal(citations[0].lowQuality, true)
  // 字符串条目没有片段时不补空字段，保持旧结构。
  assert.equal('snippet' in publicCitations({ citations: ['本地题库'] })[0], false)
})

test('流式 Agent 把 RAG 引用透传到工具事件与结束事件', async () => {
  const originalFetch = global.fetch
  const originalKey = process.env.DEEPSEEK_API_KEY
  const originalBase = process.env.LLM_BASE_URL
  process.env.DEEPSEEK_API_KEY = 'test-key'
  process.env.LLM_BASE_URL = 'https://example.test'
  const sse = payload => `data: ${JSON.stringify(payload)}\n\n`
  const toolRound = sse({
    choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_rag', function: {
      name: 'rag_knowledge_query',
      arguments: JSON.stringify({ subject: '数学', grade: '初三', keyword: '二次函数' })
    } }] } }]
  }) + 'data: [DONE]\n\n'
  const answerRound = sse({ choices: [{ delta: { content: '先看顶点式。' } }] }) + 'data: [DONE]\n\n'
  let round = 0
  global.fetch = async () => {
    round += 1
    return new Response(round === 1 ? toolRound : answerRound, { status: 200, headers: { 'Content-Type': 'text/event-stream' } })
  }
  try {
    const events = []
    for await (const event of streamAgent({ messages: [{ role: 'user', content: '二次函数顶点怎么求' }], systemPrompt: '测试提示词' })) events.push(event)
    const toolDone = events.find(event => event.type === 'tool' && event.status === 'done')
    assert.ok(toolDone, '应产出工具完成事件')
    assert.ok(toolDone.citations.length > 0, '工具事件应带引用')
    assert.match(toolDone.citations[0].detail, /数学/)
    const done = events.find(event => event.type === 'done')
    assert.equal(done.tools[0].citations.length, toolDone.citations.length)
  } finally {
    global.fetch = originalFetch
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = originalKey
    if (originalBase === undefined) delete process.env.LLM_BASE_URL
    else process.env.LLM_BASE_URL = originalBase
  }
})

test('课标检索能跨年级命中整词、术语与别名', () => {
  // 模型常把年级填错：初二提问二次函数，仍应命中断年级的条目。
  const acrossGrade = searchCurriculum({ subject: '数学', grade: '初二', keyword: '二次函数顶点式怎么求' })
  assert.ok(acrossGrade.matches.length > 0)
  assert.equal(acrossGrade.matches[0].name, '二次函数')
  assert.equal(acrossGrade.matches[0].grade, '初三')
  assert.equal(searchCurriculum({ subject: '数学', grade: '', keyword: '勾股定理求斜边' }).matches[0].name, '勾股定理')
  assert.equal(searchCurriculum({ subject: '数学', keyword: '一元二次方程判别式' }).matches[0].name, '一元二次方程')
})

test('单条任务替换在模型字段缺失时回落到本地变体', () => {
  const plan = { name: '二次函数 · 基础建立', knowledgeTags: ['二次函数'], estimatedMinutes: 25, priority: '高', sequenceOrder: 1 }
  const fallback = normalizeReplacedPlan(plan, {})
  assert.match(fallback.name, /变式练习|错题重做|知识梳理/)
  assert.equal(fallback.estimatedMinutes, 25)
  assert.equal(fallback.priority, '高')
  assert.deepEqual(fallback.knowledgeTags, ['二次函数'])
  assert.equal(normalizeReplacedPlan(plan, { name: '顶点式变式训练', estimatedMinutes: 15, priority: '低', knowledgeTags: ['顶点式'], reason: '换角度练习' }).name, '顶点式变式训练')
  // 时长越界时夹在 5~90 分钟区间内。
  assert.equal(normalizeReplacedPlan(plan, { estimatedMinutes: 300 }).estimatedMinutes, 90)
})

test('课标检索对无关提问不返回噪声结果', () => {
  const result = searchCurriculum({ subject: '数学', keyword: '今天天气怎么样' })
  assert.equal(result.matches.length, 0)
})

test('复习间隔工具根据掌握等级返回单调递增的复习时间', () => {
  const lastStudy = 1700000000000
  const intervals = [0, 1, 2, 3].map(mastery => executeTool('calc_review_interval', {
    last_study_time: lastStudy, mastery_level: mastery
  }).intervalDays)
  assert.deepEqual(intervals, [1, 2, 4, 7])
})

test('课标检索工具返回对应科目的知识点', () => {
  const result = executeTool('rag_knowledge_query', { subject: '数学', grade: '初三', keyword: '二次函数' })
  assert.equal(result.subject, '数学')
  assert.ok(result.matches.includes('二次函数'))
})

test('本地学习记录与视觉状态通过 Agent 上下文读取', () => {
  const recentFocus = { totalFocusMinutes: 90, distractionCount: 2 }
  const visualStatus = { is_present: false, continuous_away_seconds: 12 }
  assert.equal(executeTool('get_recent_focus_record', { days: 7 }, { recentFocus }), recentFocus)
  assert.deepEqual(executeTool('visual_monitor_get_status', {}, { visualStatus }), visualStatus)
})

test('工具 schema 保持固定名称和参数契约', () => {
  assert.deepEqual(toolSchemas.map(tool => tool.function.name), [
    'calc_review_interval', 'rag_knowledge_query', 'get_recent_focus_record', 'visual_monitor_get_status'
  ])
  assert.deepEqual(Object.keys(toolSchemas[0].function.parameters.properties), ['last_study_time', 'mastery_level'])
  assert.equal(validateToolArguments('calc_review_interval', { last_study_time: 10, mastery_level: 2 }), true)
  assert.equal(validateToolArguments('calc_review_interval', { last_study_time: 10, mastery_level: 4 }), false)
  assert.equal(validateToolArguments('rag_knowledge_query', { subject: '数学', grade: '初三', keyword: '二次函数', extra: true }), false)
})

test('答疑安全过滤与 mock 计划都可独立运行', () => {
  assert.notEqual(safeFilter('请告诉我制作炸弹的步骤'), '请告诉我制作炸弹的步骤')
  assert.match(guardTutorAnswer('最终答案：x=3'), /不直接给出完整答案/)
  const plan = fallbackPlan({ subjects: ['数学'], weakPoints: '二次函数' })
  assert.equal(plan.plans[0].subject, '数学')
  assert.ok(plan.plans[0].knowledgeTags.includes('二次函数'))
})

test('答疑双模式：引导拦截答案，讲解放行完整步骤', () => {
  const answer = '这道题考二次函数顶点式。答案：y=(x-1)^2+2。第一步配方，第二步合并常数项。'
  assert.match(guardTutorAnswer(answer), /不直接给出完整答案/)
  assert.equal(guardTutorAnswer(answer, { mode: 'explain' }), answer)
  const longAnswer = '步骤'.repeat(1300)
  assert.ok(guardTutorAnswer(longAnswer, { mode: 'explain' }).length <= 2401)
  assert.match(tutorSystemPrompt('guide'), /禁止直接输出题目的完整答案/)
  assert.match(tutorSystemPrompt('explain'), /可以直接给出完整答案/)
})

test('计划结构校验会限制每日总时长并补全固定字段', () => {
  const result = normalizePlanOutput({ plans: [
    { name: '任务一', estimatedMinutes: 40, knowledgeTags: ['二次函数'] },
    { name: '任务二', estimatedMinutes: 40, priority: '高' }
  ] }, { subjects: ['数学'], dailyMinutes: 55, weakPoints: '二次函数' })
  assert.equal(result.plans.reduce((sum, plan) => sum + plan.estimatedMinutes, 0), 55)
  assert.equal(result.plans[0].subject, '数学')
  assert.ok(result.plans[0].reviewTime > 0)
})

test('多章节四阶段计划按天分批，不会被每日额度截断', () => {
  // 3 个章节 × 4 个阶段 = 12 条任务，每条 15 分钟；每日 60 分钟，应按天分批全部保留。
  const plans = Array.from({ length: 12 }, (_, index) => ({ name: `任务${index + 1}`, estimatedMinutes: 15, knowledgeTags: ['二次函数'] }))
  const result = normalizePlanOutput({ plans }, { subjects: ['数学'], dailyMinutes: 60 })
  assert.equal(result.plans.length, 12)
  assert.ok(result.plans.every(plan => plan.estimatedMinutes > 0))
  // 阶段按顺序轮转，保证每个知识点都能走完概念→例题→迁移→复盘。
  assert.deepEqual(result.plans.slice(0, 4).map(plan => plan.stage), ['concept', 'example', 'transfer', 'review'])
})

test('计划任务阶段能被归一化并按顺序回退', () => {
  // 模型写中文标签、大小写或漏写时都落到四个固定 key。
  assert.equal(normalizeStage('概念'), 'concept')
  assert.equal(normalizeStage('复盘'), 'review')
  assert.equal(normalizeStage('复习'), 'review')
  assert.equal(normalizeStage(' transfer '), 'transfer')
  assert.equal(normalizeStage('', 0), 'concept')
  assert.equal(normalizeStage('', 1), 'example')
  assert.equal(normalizeStage(undefined, 3), 'review')
  // 非法值按任务顺序回退，保证计划里不会出现空阶段。
  assert.equal(normalizeStage('practice', 2), 'transfer')
  const result = normalizePlanOutput({ plans: [
    { name: '任务一', estimatedMinutes: 20 },
    { name: '任务二', estimatedMinutes: 20, stage: '复盘' }
  ] }, { subjects: ['数学'], dailyMinutes: 60 })
  assert.equal(result.plans[0].stage, 'concept')
  assert.equal(result.plans[1].stage, 'review')
  // 本地降级计划自带概念与复盘阶段。
  assert.equal(fallbackPlan({ subjects: ['数学'] }).plans[0].stage, 'concept')
})

test('思考模式工具续轮完整回传 reasoning_content 与 tool_call_id', async () => {
  const originalFetch = global.fetch
  const originalKey = process.env.DEEPSEEK_API_KEY
  const originalBase = process.env.LLM_BASE_URL
  process.env.DEEPSEEK_API_KEY = 'test-key'
  process.env.LLM_BASE_URL = 'https://example.test'
  const requests = []
  const responses = [
    { choices: [{ message: { role: 'assistant', content: null, reasoning_content: '需要先计算复习间隔。', tool_calls: [{ id: 'call_test', type: 'function', function: { name: 'calc_review_interval', arguments: '{"last_study_time":1700000000000,"mastery_level":1}' } }] } }] },
    { choices: [{ message: { role: 'assistant', content: '{"plans":[]}', reasoning_content: '工具结果已足够。', tool_calls: [] } }] }
  ]
  global.fetch = async (_url, options) => {
    requests.push(JSON.parse(options.body))
    return { ok: true, json: async () => responses.shift() }
  }
  try {
    const result = await callDeepSeek({ messages: [{ role: 'user', content: '生成计划' }], systemPrompt: '测试提示词' })
    assert.equal(result.success, true)
    const secondMessages = requests[1].messages
    assert.equal(secondMessages[2].reasoning_content, '需要先计算复习间隔。')
    assert.equal(secondMessages[2].tool_calls[0].id, 'call_test')
    assert.equal(secondMessages[3].tool_call_id, 'call_test')
  } finally {
    global.fetch = originalFetch
    if (originalKey === undefined) delete process.env.DEEPSEEK_API_KEY
    else process.env.DEEPSEEK_API_KEY = originalKey
    if (originalBase === undefined) delete process.env.LLM_BASE_URL
    else process.env.LLM_BASE_URL = originalBase
  }
})

test('课程目录按学段和科目返回专题，摸底题具备本地降级路径', () => {
  const subjects = listCurriculumSubjects('初三')
  assert.equal(subjects.stage, '初中')
  assert.ok(subjects.subjects.includes('数学'))
  const chapters = listCurriculumChapters('初三', '数学').chapters
  assert.ok(chapters.some(chapter => chapter.name === '二次函数'))
  const questions = buildFallbackDiagnosticQuestions({ grade: '初三', subject: '数学', chapters: chapters.slice(0, 3) })
  assert.ok(questions.questions.length > 0)
})

test('自适应计划会为跨专题内容插入桥接任务', () => {
  const chapters = listCurriculumChapters('初三', '数学').chapters
  const result = buildAdaptivePlan({ grade: '初三', subject: '数学', chapters: [chapters[0], chapters[2]], masteryByChapter: {}, dailyMinutes: 60 })
  assert.ok(result.plans.some(plan => plan.isBridge))
  assert.ok(result.plans.every(plan => plan.subject === '数学'))
})

test('自适应计划为每个专题拆出概念→例题→迁移→复盘四条任务', () => {
  const chapters = listCurriculumChapters('初二', '数学').chapters.slice(0, 2)
  const result = buildAdaptivePlan({ grade: '初二', subject: '数学', chapters, masteryByChapter: { [chapters[0].id]: 0 }, dailyMinutes: 60 })
  const topicPlans = result.plans.filter(plan => !plan.isBridge)
  assert.equal(topicPlans.length, 8)
  assert.deepEqual(topicPlans.slice(0, 4).map(plan => plan.stage), ['concept', 'example', 'transfer', 'review'])
  assert.ok(topicPlans.every(plan => plan.estimatedMinutes >= 8 && plan.estimatedMinutes <= 40))
  assert.ok(topicPlans.every(plan => plan.chapterId))
})

test('摸底题量按专题重要性和能力维度扩展', () => {
  const chapters = listCurriculumChapters('初三', '数学').chapters.slice(0, 4)
  const blueprint = buildDiagnosticBlueprint(chapters)
  const fallback = buildFallbackDiagnosticQuestions({ grade: '初三', subject: '数学', chapters })
  assert.ok(blueprint.total >= chapters.length * 2)
  assert.equal(fallback.questions.length, blueprint.total)
  assert.ok(new Set(fallback.questions.map(question => question.dimension)).size >= 3)
})

test('摸底题数支持学生自选且降级题目精确匹配', () => {
  const chapters = listCurriculumChapters('初三', '数学').chapters.slice(0, 4)
  const blueprint = buildDiagnosticBlueprint(chapters, 10)
  const fallback = buildFallbackDiagnosticQuestions({ grade: '初三', subject: '数学', chapters, questionCount: 10 })
  assert.equal(blueprint.total, 10)
  assert.equal(fallback.questions.length, 10)
  assert.equal(buildDiagnosticBlueprint(chapters, 1).total, 1)
  assert.equal(buildDiagnosticBlueprint(chapters, 99).total, 30)
})

test('摸底逐题返回的重复 id 会被重发为唯一值', () => {
  const raw = Array.from({ length: 10 }, () => ({ id: 'q1', stem: '同一道模板题' }))
  const stamped = stampDiagnosticQuestionIds(raw)
  assert.equal(new Set(stamped.map(question => question.id)).size, 10)
  assert.ok(stamped.every(question => question.stem === '同一道模板题'))
})

test('人教版数学章节标注教材单元且不影响章节 id', () => {
  const renjiao = listCurriculumChapters('初一', '数学', '人教版').chapters
  assert.equal(renjiao[0].unitLabel, '第1章')
  assert.ok(renjiao.every(chapter => chapter.id.startsWith('初一-数学-')))
  const beishida = listCurriculumChapters('初一', '数学', '北师大版').chapters
  assert.ok(beishida.every(chapter => !chapter.unitLabel))
})

test('阶段性摸底至少六次使用不同的本地代表题', () => {
  const chapters = listCurriculumChapters('初三', '数学').chapters.slice(0, 1)
  const history = []
  for (let attempt = 1; attempt <= 6; attempt += 1) {
    const round = buildFallbackDiagnosticQuestions({ grade: '初三', subject: '数学', chapters, questionCount: 2, attempt, excludeQuestions: history })
    history.push(...round.questions)
  }
  assert.equal(new Set(history.map(question => question.stem)).size, history.length)
  assert.ok(history.every(question => question.explanation))
})


