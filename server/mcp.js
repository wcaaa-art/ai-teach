#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js'
import { executeTool } from './tools.js'
import { listCurriculumChapters } from './curriculum.js'

// MCP 侧只暴露纯函数工具：专注记录和视觉状态由浏览器推送，外部进程拿不到，
// 不在协议层伪装成可用工具，避免调用方拿到永远为空的假数据。
const mcpTools = [
  {
    name: 'search_curriculum',
    description: '检索初高中课程标准知识点，支持跨年级与常用术语别名匹配，返回年级、科目与知识点名称。',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: '科目，如 数学、物理、化学' },
        grade: { type: 'string', description: '年级，如 初二、高一；不确定可填 不限' },
        keyword: { type: 'string', description: '知识点或学生原话，如 二次函数顶点式' }
      },
      required: ['subject', 'grade', 'keyword'],
      additionalProperties: false
    }
  },
  {
    name: 'calc_review_interval',
    description: '按艾宾浩斯遗忘曲线计算下一次复习时间，返回间隔天数与下次复习时间戳。',
    inputSchema: {
      type: 'object',
      properties: {
        last_study_time: { type: 'number', description: '上次学习时间（毫秒时间戳）' },
        mastery_level: { type: 'integer', enum: [0, 1, 2, 3], description: '0=未掌握，1=初步理解，2=基本掌握，3=熟练' }
      },
      required: ['last_study_time', 'mastery_level'],
      additionalProperties: false
    }
  },
  {
    name: 'list_curriculum_chapters',
    description: '列出指定年级与科目的课程专题目录，用于规划学习顺序。',
    inputSchema: {
      type: 'object',
      properties: {
        grade: { type: 'string', description: '年级，如 初三、高二' },
        subject: { type: 'string', description: '科目，如 数学、物理' }
      },
      required: ['grade', 'subject'],
      additionalProperties: false
    }
  }
]

const ok = payload => ({ content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }] })
const fail = message => ({ content: [{ type: 'text', text: message }], isError: true })

const server = new Server({ name: 'ai-teach-curriculum', version: '1.0.0' }, { capabilities: { tools: {} } })

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: mcpTools }))

server.setRequestHandler(CallToolRequestSchema, async request => {
  const { name, arguments: args = {} } = request.params
  try {
    if (name === 'search_curriculum') {
      const result = executeTool('rag_knowledge_query', {
        subject: args.subject, grade: args.grade || '不限', keyword: args.keyword
      })
      if (result.error) return fail('参数不合法：subject、grade、keyword 都需要是非空字符串。')
      return ok(result)
    }
    if (name === 'calc_review_interval') {
      const result = executeTool('calc_review_interval', args)
      if (result.error) return fail('参数不合法：last_study_time 需为数字，mastery_level 需为 0-3 的整数。')
      return ok(result)
    }
    if (name === 'list_curriculum_chapters') return ok(listCurriculumChapters(args.grade, args.subject))
    return fail(`未知工具：${name}`)
  } catch (error) {
    return fail(`工具执行失败：${error.message}`)
  }
})

// stdout 属于 MCP 协议通道，日志一律写 stderr，避免污染 JSON-RPC 帧。
const transport = new StdioServerTransport()
await server.connect(transport)
console.error('ai-teach MCP server 已启动（stdio）')
