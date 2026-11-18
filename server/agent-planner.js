// Agent 规划层：先让模型给出任务分解与工具调用计划，再顺序执行，最后把结果交给回答模型。
// 设计原则：
//   1. 规划失败、超时、参数不合法一律返回 null，调用方回退到原工具循环，主流程不受影响。
//   2. 计划最多 3 步，参数必须通过 tools.js 的同一份 schema 校验，防止模型编造工具或参数。
//   3. 执行结果带状态与耗时，供前端展示与运行记录落盘。
import { callDeepSeek, extractJson } from './agent.js'
import { executeTool, toolSchemas, validateToolArguments } from './tools.js'
import { runToolGuarded } from './tool-runtime.js'

const MAX_STEPS = 3

export function plannerEnabled() {
  return process.env.AGENT_PLANNER !== '0'
}

function toolCatalog() {
  return toolSchemas.map(item => ({
    name: item.function.name,
    description: item.function.description,
    parameters: item.function.parameters
  }))
}

const PLANNER_PROMPT = `你是初中学习助手的任务规划器。只输出 JSON，不要解释，不要代码围栏。
输出格式：{"goal":"一句话目标","steps":[{"tool":"工具名","args":{...},"reason":"为什么需要"}]}
规则：
1. 步骤 0 到 3 个。能直接回答的问题不要调用工具，steps 返回空数组。
2. 只能使用给定工具；args 必须符合对应 parameters，不得添加未声明字段。
3. 需要教材或真题依据时用 rag_knowledge_query；需要安排复习时间用 calc_review_interval；需要结合专注或视觉状态时用对应工具；确认薄弱点时可 save_weak_point。
4. 同一工具同一参数不要重复。
5. 无法确定参数时，宁可少规划一步，也不要编造。`

/**
 * 校验并收敛模型返回的计划。
 * @param {any} raw
 * @returns {{goal:string, steps:Array<{tool:string,args:Record<string,any>,reason:string}>}|null}
 */
export function normalizePlan(raw) {
  if (!raw || typeof raw !== 'object') return null
  const goal = String(raw.goal || '').trim().slice(0, 80)
  const steps = Array.isArray(raw.steps) ? raw.steps : []
  const names = new Set(toolSchemas.map(item => item.function.name))
  const seen = new Set()
  const valid = []
  for (const step of steps) {
    if (valid.length >= MAX_STEPS) break
    const tool = String(step?.tool || '').trim()
    if (!names.has(tool)) continue
    const args = step?.args && typeof step.args === 'object' && !Array.isArray(step.args) ? step.args : {}
    if (!validateToolArguments(tool, args)) continue
    const key = `${tool}:${JSON.stringify(args)}`
    if (seen.has(key)) continue
    seen.add(key)
    valid.push({ tool, args, reason: String(step?.reason || '').trim().slice(0, 80) })
  }
  if (!goal && !valid.length) return null
  return { goal: goal || '完成本轮学习答疑', steps: valid }
}

/**
 * 让模型生成计划；任何失败都返回 null，由调用方回退。
 */
export async function planTask({ question = '', history = [], context = {}, mode = 'guide' } = {}) {
  if (!plannerEnabled()) return null
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey || apiKey.includes('TODO')) return null
  const profile = context?.profile || {}
  const payload = {
    question: String(question || '').slice(0, 1200),
    mode,
    grade: profile.grade || '',
    subject: profile.subject || '',
    weakPoints: Array.isArray(profile.weakPoints) ? profile.weakPoints.slice(0, 6) : [],
    recentHistory: history.slice(-4).map(item => ({ role: item.role, content: String(item.content || '').slice(0, 300) })),
    tools: toolCatalog()
  }
  try {
    const result = await callDeepSeek({
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      systemPrompt: PLANNER_PROMPT,
      jsonMode: true,
      useTools: false,
      thinking: false,
      maxRounds: 1,
      timeoutMs: Number(process.env.AGENT_PLAN_TIMEOUT_MS || 12000)
    })
    if (!result?.success) return null
    return normalizePlan(extractJson(result.content))
  } catch {
    return null
  }
}

/**
 * 顺序执行计划。单步失败记录后继续，不中断整轮。
 * @param {{steps:Array<{tool:string,args:object,reason:string}>}} plan
 * @param {Record<string, any>} context
 * @param {{ onStep?: (step:any)=>void }} [options]
 */
export async function executePlan(plan, context = {}, { onStep } = {}) {
  const results = []
  for (const step of plan?.steps || []) {
    const startedAt = Date.now()
    onStep?.({ phase: 'start', tool: step.tool, reason: step.reason })
    let status = 'done'
    let result
    try {
      const guarded = await runToolGuarded(step.tool, executeTool, step.args, context)
      result = guarded.result
      if (!guarded.ok) status = 'failed'
    } catch (error) {
      status = 'failed'
      result = { error: String(error?.message || error) }
    }
    const record = { tool: step.tool, args: step.args, reason: step.reason, status, ms: Date.now() - startedAt, result }
    results.push(record)
    onStep?.({ phase: 'done', ...record })
  }
  return results
}

/**
 * 把计划与执行结果压成一段可注入系统提示词的事实块。
 */
export function buildPlanContext(plan, results = [], maxChars = 2200) {
  if (!plan) return ''
  const lines = [`【本轮任务规划】目标：${plan.goal}`]
  if (!results.length) lines.push('本轮无需调用工具，直接依据已有上下文回答。')
  results.forEach((item, index) => {
    const body = JSON.stringify(item.result ?? {})
    lines.push(`${index + 1}. ${item.tool}（${item.status === 'done' ? '成功' : '失败'}）：${body.slice(0, 700)}`)
  })
  lines.push('回答要求：只使用上述结果与对话上下文；引用真题时说明出处；工具失败时要明确说明依据不足，不得编造。')
  return lines.join('\n').slice(0, maxChars)
}
