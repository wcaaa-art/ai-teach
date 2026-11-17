import { executeTool, toolSchemas, validateToolArguments } from './tools.js'

export function safeFilter(text='') {
  const blocked=[/自杀/i,/色情/i,/毒品/i,/炸弹/i,/赌博/i]
  return blocked.some(pattern=>pattern.test(text)) ? '这个问题不适合在学习助手中展开。我们可以回到课程知识点或学习方法上。' : text
}

export function guardTutorAnswer(text='', { mode = 'guide' } = {}) {
  const safe = safeFilter(String(text))
  // 讲解模式允许完整答案，只保留安全过滤和长度上限；引导模式维持原有拦截。
  if (mode === 'explain') return safe.length > 2400 ? `${safe.slice(0, 2400)}…` : safe
  const directAnswerPatterns = [/最终答案\s*[:：]/, /答案\s*[:：]/, /正确答案\s*是/, /答案\s*是\s*[^，。\n]+/, /正确选项\s*是/, /综上(?:所述)?[，,。 ]{0,4}(?:答案|结果)/, /证明如下/]
  return safe.length > 700 || directAnswerPatterns.some(pattern => pattern.test(safe))
    ? '我先不直接给出完整答案。我们可以先圈出已知条件，再判断应该用哪个知识点；你想从哪一步开始？'
    : safe
}

// 学习四阶段：概念 → 例题 → 迁移 → 复盘。模型漏写或写中文标签时统一成英文 key。
const PLAN_STAGES = ['concept', 'example', 'transfer', 'review']
const STAGE_ALIASES = { concept: 'concept', '概念': 'concept', example: 'example', '例题': 'example', transfer: 'transfer', '迁移': 'transfer', review: 'review', '复盘': 'review', '复习': 'review' }

export function normalizeStage(value, index = 0) {
  const key = STAGE_ALIASES[String(value || '').trim()]
  return key || PLAN_STAGES[index % PLAN_STAGES.length]
}

export function fallbackPlan(payload={}) {
  const now=Date.now(); const subject=payload.subjects?.[0]||'数学'; const tags=String(payload.weakPoints||'基础概念').split(/[、,，]/).map(item=>item.trim()).filter(Boolean);const available=Math.max(5,Number(payload.dailyMinutes)||60);const firstMinutes=Math.min(25,available);const secondMinutes=Math.min(20,Math.max(0,available-firstMinutes))
  const plans=[{id:`plan_${now}`,name:`${subject}·${tags[0]||'专项练习'}`,subject,stage:'concept',estimatedMinutes:firstMinutes,priority:'高',reviewTime:now+86400000,knowledgeTags:tags,status:'active',createdAt:now}]
  if(secondMinutes>=5)plans.push({id:`plan_${now+1}`,name:`${subject}·错题复盘`,subject,stage:'review',estimatedMinutes:secondMinutes,priority:'中',reviewTime:now+3*86400000,knowledgeTags:['错题归因','间隔复习'],status:'active',createdAt:now+1})
  return {radar:[{name:'知识基础',value:58},{name:'应用能力',value:47},{name:'表达能力',value:62},{name:'解题速度',value:51},{name:'复习稳定度',value:49}],plans,explanation:`结合你的可用时间，先用一个短任务建立方法，再在间隔后回看关键步骤，避免一次学太久导致记忆下降。`,source:'mock'}
}

// 校验模型结构化结果，避免不完整字段进入本地计划库。
export function normalizePlanOutput(result, input = {}) {
  if (!Array.isArray(result?.plans) || result.plans.length === 0) throw new Error('LLM plan JSON is incomplete')
  const fallback = fallbackPlan(input)
  // 一个章节四个阶段，多章节计划会跨天：当天额度用尽后开新的一天，而不是把任务压成 0 分钟丢弃。
  let dayMinutes = Math.max(5, Number(input.dailyMinutes) || 60)
  const plans = result.plans.slice(0, 24).map((item, index) => {
    const requestedMinutes = Math.max(5, Number(item.estimatedMinutes) || 25)
    const estimatedMinutes = Math.min(40, requestedMinutes, dayMinutes)
    dayMinutes = dayMinutes - estimatedMinutes > 0 ? dayMinutes - estimatedMinutes : Math.max(5, Number(input.dailyMinutes) || 60)
    return {
      ...item,
      id: String(item.id || `plan_${Date.now()}_${index}`), name: safeFilter(String(item.name || '知识点专项练习')),
      subject: safeFilter(String(item.subject || input.subjects?.[0] || '综合')), estimatedMinutes,
      stage: normalizeStage(item.stage, index),
      priority: ['高', '中', '低'].includes(item.priority) ? item.priority : (index === 0 ? '高' : '中'),
      reviewTime: Number(item.reviewTime) || Date.now() + 86400000,
      knowledgeTags: Array.isArray(item.knowledgeTags) ? item.knowledgeTags.map(value => safeFilter(String(value))) : [safeFilter(String(input.weakPoints || '基础概念'))],
      status: item.status === 'archived' ? 'archived' : 'active', createdAt: Number(item.createdAt) || Date.now()
    }
  }).filter(plan => plan.estimatedMinutes > 0)
  return {
    radar: Array.isArray(result.radar) ? result.radar.map(item => ({ name: safeFilter(String(item.name || '学习能力')), value: Math.max(0, Math.min(100, Number(item.value) || 0)) })) : fallback.radar,
    plans, explanation: safeFilter(String(result.explanation || fallback.explanation))
  }
}

// 单条任务替换：模型字段缺失时回落到原任务，再缺才用本地变体，保证不会生成空任务。
export function normalizeReplacedPlan(original = {}, parsed = {}) {
  const variants = ['变式练习', '错题重做', '知识梳理']
  const tag = String(original.knowledgeTags?.[0] || original.name || '知识点').slice(0, 12)
  const fallbackName = `${tag} · ${variants[Math.max(0, Number(original.sequenceOrder) || 0) % variants.length]}`
  const priority = ['高', '中', '低'].includes(parsed.priority) ? parsed.priority : (original.priority || '中')
  return {
    ...original,
    name: String(parsed.name || fallbackName).trim().slice(0, 40) || fallbackName,
    estimatedMinutes: Math.min(90, Math.max(5, Math.round(Number(parsed.estimatedMinutes) || Number(original.estimatedMinutes) || 20))),
    priority,
    knowledgeTags: Array.isArray(parsed.knowledgeTags) && parsed.knowledgeTags.length
      ? parsed.knowledgeTags.slice(0, 4).map(item => String(item))
      : (original.knowledgeTags || []),
    reason: String(parsed.reason || '换个任务形式，保持练习的新鲜感。').slice(0, 60)
  }
}

export function normalizeIterationOutput(result, body = {}) {
  if (!Array.isArray(result?.plans) || result.plans.length === 0) throw new Error('LLM iteration JSON is incomplete')
  const normalizedPlans = result.plans.map((plan, index) => ({
    ...plan,
    id: plan.id || (index === 0 ? body.plan?.id : undefined),
    createdAt: plan.createdAt || (index === 0 ? body.plan?.createdAt : undefined)
  }))
  return normalizePlanOutput({ ...result, plans: normalizedPlans, radar: result.radar || [] }, {
    ...body.profile, subjects: body.profile?.subjects || [body.plan?.subject || '综合'],
    weakPoints: body.plan?.knowledgeTags?.join('、') || body.profile?.weakPoints,
    dailyMinutes: body.profile?.dailyMinutes || 60
  })
}

export function extractJson(content='') { try { return JSON.parse(content) } catch { const match=content.match(/\{[\s\S]*\}/); if(match) { try{return JSON.parse(match[0])}catch{} } return null } }

export async function callDeepSeek({messages, systemPrompt, context={}, maxRounds=5, jsonMode=false, useTools=true, timeoutMs=35000, thinking=true}) {
  const apiKey=process.env.DEEPSEEK_API_KEY; const baseUrl=process.env.LLM_BASE_URL||'https://api.deepseek.com'; const model=process.env.LLM_MODEL_NAME||'deepseek-flash'
  if(!apiKey || apiKey.includes('TODO')) return {success:false,source:'mock',reason:'missing-api-key'}
  let conversation=[{role:'system',content:systemPrompt},...messages]
  for(let round=0;round<maxRounds;round++) {
    // 深度推理只在需要逐步解题的答疑里划算；出题、摸底这类结构化 JSON 任务关掉可省约七成耗时。
    const requestBody={model,messages:conversation}
    if(thinking){requestBody.thinking={type:'enabled'};requestBody.reasoning_effort='high'}
    if(useTools){requestBody.tools=toolSchemas;requestBody.tool_choice='auto'}
    if(jsonMode) requestBody.response_format={type:'json_object'}
    const response=await fetch(`${baseUrl.replace(/\/$/,'')}/chat/completions`,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${apiKey}`},signal:AbortSignal.timeout(timeoutMs),body:JSON.stringify(requestBody)})
    if(!response.ok) throw new Error(`LLM ${response.status}`)
    const payload=await response.json(); const assistant=payload.choices?.[0]?.message
    if(!assistant) throw new Error('LLM response missing message')
    // DeepSeek 多轮工具调用必须原样回传 assistant 的 reasoning_content 与 tool_calls。
    const assistantMessage={role:'assistant',content:assistant.content??null,reasoning_content:assistant.reasoning_content??null}; if(assistant.tool_calls?.length) assistantMessage.tool_calls=assistant.tool_calls; conversation.push(assistantMessage)
    if(!assistant.tool_calls?.length) return {success:true,content:assistant.content||'',source:'deepseek'}
    for(const call of assistant.tool_calls){let args;try{args=JSON.parse(call.function.arguments||'{}')}catch{throw new Error('Tool arguments are not valid JSON')};if(!validateToolArguments(call.function.name,args))throw new Error(`Tool arguments do not match schema: ${call.function.name}`);const result=executeTool(call.function.name,args,context);conversation.push({role:'tool',tool_call_id:call.id,content:JSON.stringify(result)})}
  }
  throw new Error('tool rounds exceeded')
}

export function buildPlanPrompt(payload) { return [{role:'user',content:JSON.stringify(payload)}] }

// 工具名称的中文标签与结果摘要，用于前端「思考过程」里的步骤展示。
export const TOOL_LABELS = {
  calc_review_interval: '计算复习间隔',
  rag_knowledge_query: '检索课标知识库',
  get_recent_focus_record: '读取近期专注记录',
  visual_monitor_get_status: '读取视觉监督状态'
}

export function summarizeToolResult(name, result = {}) {
  if (!result || typeof result !== 'object') return ''
  if (result.error) return '参数校验未通过，已跳过'
  if (name === 'rag_knowledge_query') {
    const matches = Array.isArray(result.matches) ? result.matches : []
    const passages = Array.isArray(result.passages) ? result.passages.length : 0
    const parts = []
    if (matches.length) parts.push(`命中 ${matches.length} 个知识点：${matches.slice(0, 3).join('、')}`)
    if (passages) parts.push(`检索到 ${passages} 条真题解析`)
    return parts.join(' · ') || '未命中课标条目'
  }
  if (name === 'calc_review_interval') return `建议 ${result.intervalDays} 天后复习`
  if (name === 'get_recent_focus_record') return `近 ${result.days || 7} 天专注 ${result.totalFocusMinutes || 0} 分钟`
  if (name === 'visual_monitor_get_status') {
    return result.is_present ? '当前在岗' : `连续离开 ${result.continuous_away_seconds || 0} 秒`
  }
  return ''
}

// 引用来源只回传展示字段：去重、限 4 条，并拆出「出处 / 题型」两段。
// 完整真题正文留在工具结果里给模型引用，不重复推给浏览器。
export function publicCitations(result = {}, limit = 4) {
  const raw = Array.isArray(result?.citations) ? result.citations : []
  const seen = new Set()
  const citations = []
  for (const item of raw) {
    const text = String(item || '').trim()
    if (!text || seen.has(text)) continue
    seen.add(text)
    const matched = text.match(/^《(.+?)》\s*[：:]\s*(.+)$/)
    citations.push({ text, title: matched ? matched[1] : text, detail: matched ? matched[2] : text })
    if (citations.length >= limit) break
  }
  return citations
}

// 解析单行 SSE：返回 { done } 或 { payload }；非 data 行与坏 JSON 一律忽略。
export function parseSseLine(line = '') {
  const text = String(line).trim()
  if (!text.startsWith('data:')) return null
  const raw = text.slice(5).trim()
  if (!raw) return null
  if (raw === '[DONE]') return { done: true }
  try { return { done: false, payload: JSON.parse(raw) } } catch { return null }
}

// 累积流式 delta：正文、推理内容和按 index 分片的工具调用参数。
export function createStreamAccumulator() {
  const state = { content: '', reasoning: '', toolCalls: [], finishReason: null }
  return {
    state,
    push(payload) {
      const choice = payload?.choices?.[0]
      if (!choice) return state
      const delta = choice.delta || {}
      if (delta.content) state.content += delta.content
      if (delta.reasoning_content) state.reasoning += delta.reasoning_content
      if (Array.isArray(delta.tool_calls)) {
        for (const call of delta.tool_calls) {
          const index = Number(call.index) || 0
          if (!state.toolCalls[index]) state.toolCalls[index] = { id: '', name: '', arguments: '' }
          const target = state.toolCalls[index]
          if (call.id) target.id = call.id
          if (call.function?.name) target.name += call.function.name
          if (call.function?.arguments) target.arguments += call.function.arguments
        }
      }
      if (choice.finish_reason) state.finishReason = choice.finish_reason
      return state
    }
  }
}

// 逐 token 产出事件：thinking / token / tool / done / fallback。
// 工具调用轮先累积分片参数，校验后执行，再把 assistant 与 tool 消息放回同一轮对话继续生成。
export async function* streamAgent({ messages = [], systemPrompt = '', context = {}, maxRounds = 4, useTools = true, signal } = {}) {
  const apiKey = process.env.DEEPSEEK_API_KEY
  if (!apiKey || apiKey.includes('TODO')) { yield { type: 'fallback', reason: 'missing-api-key' }; return }
  const baseUrl = (process.env.LLM_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const model = process.env.LLM_MODEL_NAME || 'deepseek-flash'
  const conversation = [{ role: 'system', content: systemPrompt }, ...messages]
  const trace = []
  let answer = ''

  for (let round = 0; round < maxRounds; round += 1) {
    const requestBody = { model, messages: conversation, stream: true, thinking: { type: 'enabled' }, reasoning_effort: 'high' }
    if (useTools) { requestBody.tools = toolSchemas; requestBody.tool_choice = 'auto' }
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify(requestBody), signal
    })
    if (!response.ok) throw new Error(`LLM ${response.status}`)
    if (!response.body) throw new Error('LLM stream missing body')

    const accumulator = createStreamAccumulator()
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let emittedReasoning = 0
    let emittedContent = 0

    const consume = function* (payload) {
      accumulator.push(payload)
      const state = accumulator.state
      if (state.reasoning.length > emittedReasoning) {
        const delta = state.reasoning.slice(emittedReasoning)
        emittedReasoning = state.reasoning.length
        yield { type: 'thinking', delta }
      }
      if (state.content.length > emittedContent) {
        const delta = state.content.slice(emittedContent)
        emittedContent = state.content.length
        answer += delta
        yield { type: 'token', delta }
      }
    }

    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() || ''
      for (const line of lines) {
        const parsed = parseSseLine(line)
        if (!parsed || parsed.done) continue
        yield* consume(parsed.payload)
      }
    }
    const tail = parseSseLine(buffer)
    if (tail && !tail.done) yield* consume(tail.payload)

    const state = accumulator.state
    if (!state.toolCalls.length) {
      yield { type: 'done', content: answer, reasoning: state.reasoning, tools: trace }
      return
    }

    conversation.push({
      role: 'assistant',
      content: state.content || null,
      reasoning_content: state.reasoning || null,
      tool_calls: state.toolCalls.map((call, index) => ({
        id: call.id || `call_${round}_${index}`,
        type: 'function',
        function: { name: call.name, arguments: call.arguments || '{}' }
      }))
    })

    for (const call of conversation[conversation.length - 1].tool_calls) {
      const label = TOOL_LABELS[call.function.name] || call.function.name
      yield { type: 'tool', status: 'start', name: call.function.name, label }
      let args
      let problem = ''
      try { args = JSON.parse(call.function.arguments || '{}') } catch { problem = '工具参数不是合法 JSON' }
      if (!problem && !validateToolArguments(call.function.name, args)) problem = '工具参数不符合 schema'
      const result = problem ? { error: problem } : executeTool(call.function.name, args, context)
      const summary = problem ? problem : summarizeToolResult(call.function.name, result)
      // 检索结果带出处，前端在回答下方展示「检索依据」，让 RAG 可追溯而不是黑盒。
      const citations = call.function.name === 'rag_knowledge_query' ? publicCitations(result) : []
      yield { type: 'tool', status: 'done', name: call.function.name, label, summary, citations }
      trace.push({ name: call.function.name, label, summary, status: 'done', citations })
      conversation.push({ role: 'tool', tool_call_id: call.id, content: JSON.stringify(result) })
    }
  }
  throw new Error('tool rounds exceeded')
}
