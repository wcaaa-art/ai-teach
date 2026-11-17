// Prompt 契约清单：登记每条提示词的版本、用途与「必须包含」的条款。
// 目的有两个：
// 1. 提示词有了可追溯的版本号，改动时能说清「改了什么、为什么改」。
// 2. 契约测试会逐条核对 required 里的条款——防止后续调整提示词时，
//    不小心把安全约束、输出格式、阶段定义这类关键条款改丢。
// 这份清单不参与运行时逻辑，只服务于评审与回归。

export const PROMPT_REGISTRY = [
  {
    key: 'LEARNING_SYSTEM_PROMPT',
    file: 'server/prompts.js',
    version: '1.3.0',
    purpose: '学情规划 Agent：按学情生成四阶段学习计划',
    required: ['安全要求', 'JSON', 'concept', 'example', 'transfer', 'review', 'estimatedMinutes']
  },
  {
    key: 'TUTOR_SYSTEM_PROMPT',
    file: 'server/prompts.js',
    version: '1.4.0',
    purpose: '答疑教练（引导模式）：只给思路不给答案',
    required: ['禁止直接输出', '依据', 'rag_knowledge_query', '不输出危险']
  },
  {
    key: 'TUTOR_EXPLAIN_PROMPT',
    file: 'server/prompts.js',
    version: '1.3.0',
    purpose: '学科讲解老师（讲解模式）：给完整推导但要求可复现',
    required: ['分步骤推导', '易错点', '依据', '不输出危险']
  },
  {
    key: 'TOOL_AGENT_PROMPT',
    file: 'server/prompts.js',
    version: '1.2.0',
    purpose: '学习反馈迭代 Agent：结合反馈与专注记录重排计划',
    required: ['JSON', 'concept', 'example', 'transfer', 'review', '调用需要的工具']
  },
  {
    key: 'ASSESSMENT_SYSTEM_PROMPT',
    file: 'server/prompts.js',
    version: '1.4.0',
    purpose: '学情摸底出题：按蓝图精确生成诊断题',
    required: ['blueprint', 'excludeQuestions', '严禁照抄', 'correctIndex', 'explanation']
  },
  {
    key: 'PLAN_SEQUENCE_PROMPT',
    file: 'server/prompts.js',
    version: '1.1.0',
    purpose: '学习路径编排：按知识依赖排任务顺序',
    required: ['前置知识', '桥接复习', 'JSON']
  },
  {
    key: 'PLAN_REPLACE_PROMPT',
    file: 'server/prompts.js',
    version: '1.1.0',
    purpose: '单条任务替换：同知识点换一种练法',
    required: ['同一学科', '同一知识点', 'JSON']
  },
  {
    key: 'QUIZ_SYSTEM_PROMPT',
    file: 'server/prompts.js',
    version: '1.5.0',
    purpose: '章节测试命题：按初中卷型规范出题并写逐项解析',
    required: ['blueprint', '卷型', 'excludeStems', 'explanation', 'correctIndex', 'Markdown']
  },
  {
    key: 'WEEKLY_REPORT_PROMPT',
    file: 'server/prompts.js',
    version: '1.2.0',
    purpose: 'AI 周报复盘：只基于真实聚合数据复盘',
    required: ['禁止编造', '不做医疗', 'strengths', 'risks', 'actions']
  },
  {
    key: 'PAPER_PARSE_SYSTEM_PROMPT',
    file: 'server/paper-scan.js',
    version: '1.1.0',
    purpose: '试卷照片结构化：把 OCR 文字拆成可练习题目',
    required: ['correctIndex', 'answer', 'JSON', '不要编造']
  },
  {
    key: 'MISTAKE_ANALYSIS_PROMPT',
    file: 'server/mistake-analysis.js',
    version: '1.1.0',
    purpose: '错题归因：打知识点标签、推测错因、给补强建议',
    required: ['knowledgeTags', 'errorCause', 'suggestion', '不要断言']
  }
]

// 所有面向学生、可能生成自由文本的提示词，都必须写明内容边界。
// 边界条款不止一种形态：危险内容、隐私与诊断边界、不得冒称商业题库、不得编造数据。
export const SAFETY_REQUIRED_KEYS = [
  'LEARNING_SYSTEM_PROMPT',
  'TUTOR_SYSTEM_PROMPT',
  'TUTOR_EXPLAIN_PROMPT',
  'ASSESSMENT_SYSTEM_PROMPT',
  'QUIZ_SYSTEM_PROMPT',
  'WEEKLY_REPORT_PROMPT'
]

export const SAFETY_TOKENS = ['危险', '不索要隐私', '诊断', '商业题库', '编造']
