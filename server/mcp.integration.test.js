// MCP 服务集成测试：用真实客户端连一次 stdio 服务，确认 tools / resources / prompts
// 三类能力都能被外部 Agent 发现并调用，且与原有工具保持兼容。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'

async function connect() {
  const transport = new StdioClientTransport({ command: 'node', args: ['server/mcp.js'] })
  const client = new Client({ name: 'ai-teach-test', version: '1.0.0' }, { capabilities: {} })
  await client.connect(transport)
  return client
}

test('MCP 服务暴露工具、资源与提示词三类能力', async () => {
  const client = await connect()
  try {
    const tools = await client.listTools()
    const names = tools.tools.map(tool => tool.name)
    for (const expected of ['search_curriculum', 'calc_review_interval', 'list_curriculum_chapters']) {
      assert.ok(names.includes(expected), `缺少工具 ${expected}`)
    }

    const resources = await client.listResources()
    const uris = resources.resources.map(item => item.uri)
    assert.ok(uris.includes('ai-teach://curriculum/subjects'), '缺少学科目录资源')

    const templates = await client.listResourceTemplates()
    assert.ok(templates.resourceTemplates.some(item => item.uriTemplate.includes('curriculum/chapters')))

    const prompts = await client.listPrompts()
    const promptNames = prompts.prompts.map(item => item.name)
    for (const expected of ['explain_mistake', 'plan_next_week', 'tutor_guide']) {
      assert.ok(promptNames.includes(expected), `缺少提示词 ${expected}`)
    }
  } finally {
    await client.close()
  }
})

test('资源可以被读取且内容可解析', async () => {
  const client = await connect()
  try {
    const read = await client.readResource({ uri: 'ai-teach://curriculum/subjects' })
    assert.ok(read.contents.length > 0)
    const payload = JSON.parse(read.contents[0].text)
    assert.ok(payload['初一'] || payload['初二'], '学科目录内容为空')
  } finally {
    await client.close()
  }
})

test('提示词可以按参数生成', async () => {
  const client = await connect()
  try {
    const prompt = await client.getPrompt({ name: 'explain_mistake', arguments: { grade: '初二', subject: '数学', stem: 'x²-5x+6=0' } })
    const text = prompt.messages[0].content.text
    assert.ok(text.includes('初二'), '提示词没有带上年级参数')
    assert.ok(text.includes('JSON'), '提示词缺少输出格式要求')
  } finally {
    await client.close()
  }
})

test('工具错误返回结构化错误码，外部 Agent 可按 code 处理', async () => {
  const client = await connect()
  try {
    const invalid = await client.callTool({ name: 'calc_review_interval', arguments: { last_study_time: 'x', mastery_level: 9 } })
    assert.equal(invalid.isError, true)
    const payload = JSON.parse(invalid.content[0].text)
    assert.equal(payload.code, 'INVALID_ARGS')

    const unknown = await client.callTool({ name: 'not_exists', arguments: {} })
    assert.equal(unknown.isError, true)
    assert.equal(JSON.parse(unknown.content[0].text).code, 'TOOL_NOT_FOUND')
  } finally {
    await client.close()
  }
})
