// MCP 能力清单：只放可公开的能力描述，供 MCP 服务与「AI 能力」页共用，
// 避免命令行服务与网页展示各维护一份、改一处忘一处。
// MCP 侧只暴露纯函数工具：专注记录和视觉状态由浏览器推送，外部进程拿不到，
// 不在协议层伪装成可用工具，避免调用方拿到永远为空的假数据。
export const mcpTools = [
  {
    name: 'search_curriculum',
    description: '检索初中课程标准知识点，支持跨年级与常用术语别名匹配，返回年级、科目与知识点名称。',
    inputSchema: {
      type: 'object',
      properties: {
        subject: { type: 'string', description: '科目，如 数学、物理、化学' },
        grade: { type: 'string', description: '年级，如 初二；不确定可填 不限' },
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
        grade: { type: 'string', description: '年级，如 初三' },
        subject: { type: 'string', description: '科目，如 数学、物理' }
      },
      required: ['grade', 'subject'],
      additionalProperties: false
    }
  }
]

// ===== Resources：把课程目录与真题语料以只读资源暴露给外部 Agent =====
// Resources 与 Tools 的区别：Tool 是「可调用的动作」，Resource 是「可读取的数据」。
// 外部 Agent 读资源不用猜参数，比自己拼查询更省 token，也更不容易用错口径。
export const mcpResources = [
  {
    uri: 'ai-teach://curriculum/subjects',
    name: '初中课程标准学科目录',
    description: '按年级列出该年级开设的科目与教材版本，是所有规划类任务的入口。',
    mimeType: 'application/json'
  },
  {
    uri: 'ai-teach://curriculum/chapters/{grade}/{subject}',
    name: '课标专题目录',
    description: '指定年级与科目的专题（知识点）列表，含章节 id、名称与建议课时。',
    mimeType: 'application/json'
  },
  {
    uri: 'ai-teach://exam/passages/{subject}',
    name: '中考真题片段库',
    description: '该学科的中考真题解析片段（含出处），可作为讲题与出题的同类例题参考。',
    mimeType: 'application/json'
  }
]

export const mcpResourceTemplates = [
  {
    uriTemplate: 'ai-teach://curriculum/chapters/{grade}/{subject}',
    name: '课标专题目录',
    description: '按年级与科目读取专题目录。',
    mimeType: 'application/json'
  },
  {
    uriTemplate: 'ai-teach://exam/passages/{subject}',
    name: '中考真题片段库',
    description: '按学科读取真题片段。',
    mimeType: 'application/json'
  }
]

// ===== Prompts：把项目里跑得最顺的几个工作流暴露成可复用的提示词模板 =====
// 外部 Agent 可以直接套用，不用自己重新发明「怎么给初中生讲题」这类指令。
export const mcpPrompts = [
  {
    name: 'explain_mistake',
    title: '错题归因与补强',
    description: '按本项目的错题归因口径分析一道错题，给出知识点标签、可能错因与一条可执行补强动作。',
    arguments: [
      { name: 'grade', description: '年级，如 初二', required: true },
      { name: 'subject', description: '科目，如 数学', required: true },
      { name: 'stem', description: '题干原文', required: true }
    ]
  },
  {
    name: 'plan_next_week',
    title: '下一周学习计划编排',
    description: '按课标专题与学生每日可用时长，编排概念→例题→迁移→复盘四阶段任务。',
    arguments: [
      { name: 'grade', description: '年级', required: true },
      { name: 'subject', description: '科目', required: true },
      { name: 'minutes', description: '每天可用分钟数', required: false }
    ]
  },
  {
    name: 'tutor_guide',
    title: '初中生答疑（只引导不给答案）',
    description: '用引导式口径答疑：拆解题意、回顾知识点、给相似例子、提自检问题，不给完整答案。',
    arguments: [
      { name: 'question', description: '学生的问题', required: true }
    ]
  }
]
