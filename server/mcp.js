#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListResourceTemplatesRequestSchema,
  ReadResourceRequestSchema,
  ListPromptsRequestSchema,
  GetPromptRequestSchema
} from '@modelcontextprotocol/sdk/types.js'
import { executeTool } from './tools.js'
import { mcpPrompts, mcpResourceTemplates, mcpResources, mcpTools } from './mcp-capabilities.js'
import { listCurriculumChapters, listCurriculumSubjects } from './curriculum.js'
import { searchPassages } from './rag/index.js'
import { withToolTimeout } from './tool-runtime.js'

// MCP 侧的护栏：单个工具 3 秒超时，错误统一带 code，外部 Agent 能按 code 决定是否重试。
const MCP_TOOL_TIMEOUT_MS = 3000

const ok = payload => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] })
const fail = (message, code = 'TOOL_ERROR') => ({ content: [{ type: 'text', text: JSON.stringify({ code, message }) }], isError: true })

function readResource(uri) {
  if (uri === 'ai-teach://curriculum/subjects') {
    const grades = ['初一', '初二', '初三']
    const data = Object.fromEntries(grades.map(grade => [grade, listCurriculumSubjects(grade)]))
    return { uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }
  }
  const chapters = uri.match(/^ai-teach:\/\/curriculum\/chapters\/([^/]+)\/(.+)$/)
  if (chapters) {
    const data = listCurriculumChapters(decodeURIComponent(chapters[1]), decodeURIComponent(chapters[2]))
    return { uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }
  }
  const passages = uri.match(/^ai-teach:\/\/exam\/passages\/(.+)$/)
  if (passages) {
    const subject = decodeURIComponent(passages[1])
    const data = searchPassages({ query: subject, subject, topK: 8, maxChars: 600 })
    return { uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }
  }
  return null
}

function buildPrompt(name, args = {}) {
  if (name === 'explain_mistake') {
    const grade = args.grade || '初二'
    const subject = args.subject || '数学'
    const stem = args.stem || ''
    return {
      description: '错题归因与补强',
      messages: [
        { role: 'user', content: { type: 'text', text: `你是初中错题归因助手。年级：${grade}；科目：${subject}；题干：${stem}\n只返回合法 JSON：{"knowledgeTags":["知识点1","知识点2"],"errorCause":"可能的原因","suggestion":"补强建议"}。knowledgeTags 优先用教材名词；errorCause 用「可能」措辞，不编造学生作答过程；不要 Markdown。` } }
      ]
    }
  }
  if (name === 'plan_next_week') {
    const minutes = Number(args.minutes) || 60
    const grade = args.grade || '初二'
    const subject = args.subject || '数学'
    return {
      description: '下一周学习计划编排',
      messages: [
        { role: 'user', content: { type: 'text', text: `你是初中学习路径编排 Agent。年级：${grade}；科目：${subject}；每日可用时长：${minutes} 分钟。\n每个专题拆成 concept（概念）→example（例题）→transfer（迁移）→review（复盘）四条任务，时长不超过每日可用时长，保留未掌握前置知识，不合并阶段。\n只返回合法 JSON：{"plans":[{"name":"任务名","stage":"concept|example|transfer|review","estimatedMinutes":25,"knowledgeTags":["知识点"]}],"explanation":"安排原因"}。` } }
      ]
    }
  }
  if (name === 'tutor_guide') {
    const question = args.question || ''
    return {
      description: '初中生答疑（引导式）',
      messages: [
        { role: 'user', content: { type: 'text', text: `你是面向初中学生的温和答疑教练。问题：${question}\n固定规则：禁止直接输出题目的完整答案、最终选项或可直接抄写的完整证明；要通过拆解题意、回顾知识点、给出相似例子、提出自检问题来引导学生自己完成。回答简洁、适合青少年阅读；不输出危险、违法、歧视或不适宜内容。` } }
      ]
    }
  }
  return null
}

const server = new Server(
  { name: 'ai-teach-curriculum', version: '1.1.0' },
  { capabilities: { tools: {}, resources: {}, prompts: {} } }
)

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }))

server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: mcpResources }))

server.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({ resourceTemplates: mcpResourceTemplates }))

server.setRequestHandler(ReadResourceRequestSchema, async request => {
  const { uri } = request.params
  try {
    const resource = await withToolTimeout(() => readResource(String(uri || '')), MCP_TOOL_TIMEOUT_MS, 'resource')
    if (!resource) return fail(`未知资源：${uri}`, 'RESOURCE_NOT_FOUND')
    return { contents: [resource] }
  } catch (error) {
    return fail(`资源读取失败：${error.message}`, /timeout/i.test(error?.message || '') ? 'RESOURCE_TIMEOUT' : 'RESOURCE_ERROR')
  }
})

server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: mcpPrompts }))

server.setRequestHandler(GetPromptRequestSchema, async request => {
  const { name, arguments: args = {} } = request.params
  try {
    const prompt = buildPrompt(String(name || ''), args || {})
    if (!prompt) return fail(`未知提示词：${name}`)
    return prompt
  } catch (error) {
    return fail(`提示词生成失败：${error.message}`)
  }
})

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args = {} } = request.params
  try {
    if (name === 'search_curriculum') {
      const result = await withToolTimeout(() => executeTool('rag_knowledge_query', {
        subject: args.subject, grade: args.grade || '不限', keyword: args.keyword
      }), MCP_TOOL_TIMEOUT_MS, name)
      if (result.error) return fail('参数不合法：subject、grade、keyword 都需要是非空字符串。', 'INVALID_ARGS')
      return ok(result)
    }
    if (name === 'calc_review_interval') {
      const result = await withToolTimeout(() => executeTool('calc_review_interval', args), MCP_TOOL_TIMEOUT_MS, name)
      if (result.error) return fail('参数不合法：last_study_time 需为数字，mastery_level 需为 0-3 的整数。', 'INVALID_ARGS')
      return ok(result)
    }
    if (name === 'list_curriculum_chapters') {
      const result = await withToolTimeout(() => listCurriculumChapters(args.grade, args.subject), MCP_TOOL_TIMEOUT_MS, name)
      return ok(result)
    }
    return fail(`未知工具：${name}`, 'TOOL_NOT_FOUND')
  } catch (error) {
    const code = /timeout/i.test(error?.message || '') ? 'TOOL_TIMEOUT' : 'TOOL_ERROR'
    return fail(`工具执行失败：${error.message}`, code)
  }
})

// stdout 属于 MCP 协议通道，日志一律写 stderr，避免污染 JSON-RPC 帧。
const transport = new StdioServerTransport()
await server.connect(transport)
console.error('ai-teach MCP server 已启动（stdio）')
