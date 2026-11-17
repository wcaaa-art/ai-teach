// Prompt 契约测试：把「提示词必须包含哪些条款」变成可回归的硬约束。
// 这样调整提示词时，安全边界、输出格式、阶段定义不会在改写中悄悄丢掉。
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { LEARNING_SYSTEM_PROMPT, TUTOR_SYSTEM_PROMPT, TUTOR_EXPLAIN_PROMPT, TOOL_AGENT_PROMPT, ASSESSMENT_SYSTEM_PROMPT, PLAN_SEQUENCE_PROMPT, PLAN_REPLACE_PROMPT, QUIZ_SYSTEM_PROMPT, WEEKLY_REPORT_PROMPT } from './prompts.js'
import { PAPER_PARSE_SYSTEM_PROMPT } from './paper-scan.js'
import { MISTAKE_ANALYSIS_PROMPT } from './mistake-analysis.js'
import { PROMPT_REGISTRY, SAFETY_REQUIRED_KEYS, SAFETY_TOKENS } from './prompt-registry.js'

const ALL_PROMPTS = {
  LEARNING_SYSTEM_PROMPT,
  TUTOR_SYSTEM_PROMPT,
  TUTOR_EXPLAIN_PROMPT,
  TOOL_AGENT_PROMPT,
  ASSESSMENT_SYSTEM_PROMPT,
  PLAN_SEQUENCE_PROMPT,
  PLAN_REPLACE_PROMPT,
  QUIZ_SYSTEM_PROMPT,
  WEEKLY_REPORT_PROMPT,
  PAPER_PARSE_SYSTEM_PROMPT,
  MISTAKE_ANALYSIS_PROMPT
}

test('每条提示词都登记在契约清单里，版本号格式正确', () => {
  for (const entry of PROMPT_REGISTRY) {
    assert.ok(ALL_PROMPTS[entry.key], `清单里的 ${entry.key} 在代码中不存在`)
    assert.match(entry.version, /^\d+\.\d+\.\d+$/, `${entry.key} 的版本号格式不对：${entry.version}`)
    assert.ok(entry.purpose.length >= 6, `${entry.key} 缺少用途说明`)
    assert.ok(entry.required.length >= 3, `${entry.key} 的必需条款太少`)
  }
})

test('契约清单覆盖了代码里全部的提示词常量', () => {
  const registered = new Set(PROMPT_REGISTRY.map(entry => entry.key))
  for (const key of Object.keys(ALL_PROMPTS)) {
    assert.ok(registered.has(key), `${key} 没有登记进契约清单`)
  }
})

test('每条提示词都保留了约定的关键条款', () => {
  for (const entry of PROMPT_REGISTRY) {
    const prompt = String(ALL_PROMPTS[entry.key])
    for (const token of entry.required) {
      assert.ok(prompt.includes(token), `${entry.key}（v${entry.version}）缺少必需条款「${token}」`)
    }
  }
})

test('面向学生的自由文本提示词都写明了危险内容边界', () => {
  for (const key of SAFETY_REQUIRED_KEYS) {
    const prompt = String(ALL_PROMPTS[key])
    assert.ok(
      SAFETY_TOKENS.some(token => prompt.includes(token)),
      `${key} 缺少危险内容边界说明`
    )
  }
})

test('所有提示词都要求返回合法 JSON（结构化输出）', () => {
  for (const entry of PROMPT_REGISTRY) {
    if (['TUTOR_SYSTEM_PROMPT', 'TUTOR_EXPLAIN_PROMPT'].includes(entry.key)) continue
    const prompt = String(ALL_PROMPTS[entry.key])
    assert.ok(prompt.includes('JSON'), `${entry.key} 没有说明 JSON 输出格式`)
  }
})
