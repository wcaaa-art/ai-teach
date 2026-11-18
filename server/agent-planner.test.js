import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildPlanContext, executePlan, normalizePlan, planTask } from './agent-planner.js'

test('计划校验：丢弃未知工具、非法参数与重复步骤', () => {
  const plan = normalizePlan({
    goal: '查真题并记录薄弱点',
    steps: [
      { tool: 'rag_knowledge_query', args: { subject: '数学', grade: '初二', keyword: '二次函数' }, reason: '找依据' },
      { tool: 'rag_knowledge_query', args: { subject: '数学', grade: '初二', keyword: '二次函数' }, reason: '重复' },
      { tool: 'unknown_tool', args: {}, reason: '不存在' },
      { tool: 'calc_review_interval', args: { last_study_time: 1, mastery_level: 9 }, reason: '越界' },
      { tool: 'save_weak_point', args: { subject: '数学', point: '顶点式' }, reason: '记录' }
    ]
  })
  assert.equal(plan.goal, '查真题并记录薄弱点')
  assert.deepEqual(plan.steps.map(step => step.tool), ['rag_knowledge_query', 'save_weak_point'])
})

test('计划校验：最多保留 3 步，空计划也合法', () => {
  const plan = normalizePlan({
    goal: '多步',
    steps: [
      { tool: 'calc_review_interval', args: { last_study_time: 1, mastery_level: 1 } },
      { tool: 'list_weak_points', args: { limit: 5 } },
      { tool: 'get_recent_focus_record', args: { days: 7 } },
      { tool: 'visual_monitor_get_status', args: { is_present: true, continuous_away_seconds: 0 } }
    ]
  })
  assert.equal(plan.steps.length, 3)
  assert.ok(normalizePlan({ goal: '直接回答', steps: [] }))
})

test('无密钥时规划返回 null，调用方可回退', async () => {
  const original = process.env.DEEPSEEK_API_KEY
  delete process.env.DEEPSEEK_API_KEY
  const plan = await planTask({ question: '二次函数怎么配方' })
  assert.equal(plan, null)
  if (original === undefined) delete process.env.DEEPSEEK_API_KEY
  else process.env.DEEPSEEK_API_KEY = original
})

test('顺序执行真实工具并注入上下文', async () => {
  const plan = { goal: '安排复习', steps: [{ tool: 'calc_review_interval', args: { last_study_time: 1000, mastery_level: 2 }, reason: '定复习时间' }] }
  const results = await executePlan(plan)
  assert.equal(results.length, 1)
  assert.equal(results[0].status, 'done')
  assert.equal(results[0].result.intervalDays, 4)
  const context = buildPlanContext(plan, results)
  assert.match(context, /安排复习/)
  assert.match(context, /calc_review_interval/)
})
