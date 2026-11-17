<script setup>
import { computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useRouter } from 'vue-router'
import { getAiCapabilities, searchRagPassages } from '../services/api.js'

const router = useRouter()

// 后端不可用时也要能演示：保留一份与 server/mcp-capabilities.js 对齐的最小能力清单。
const FALLBACK_AGENT = [
  { name: 'rag_knowledge_query', label: '检索课标知识库', description: '混合检索课标知识点与中考真题解析，返回可引用片段。', parameters: ['subject', 'grade', 'keyword'] },
  { name: 'calc_review_interval', label: '计算复习间隔', description: '按艾宾浩斯遗忘曲线给出下一次复习时间。', parameters: ['last_study_time', 'mastery_level'] },
  { name: 'get_recent_focus_record', label: '读取近期专注记录', description: '读取总时长、任务完成率、分心与离岗记录。', parameters: ['days'] },
  { name: 'visual_monitor_get_status', label: '读取视觉监督状态', description: '读取前端推送的在岗/离岗状态，不接收图像。', parameters: ['is_present', 'continuous_away_seconds'] }
]
const FALLBACK_MCP = {
  command: 'npm run mcp',
  tools: [
    { name: 'search_curriculum', description: '检索初中课程标准知识点，支持跨年级与术语别名。' },
    { name: 'calc_review_interval', description: '按艾宾浩斯曲线计算下一次复习时间。' },
    { name: 'list_curriculum_chapters', description: '列出指定年级与科目的课程专题目录。' }
  ],
  resources: [
    { uri: 'ai-teach://curriculum/subjects', name: '初中课程标准学科目录', description: '按年级列出开设科目与教材版本。' },
    { uri: 'ai-teach://curriculum/chapters/{grade}/{subject}', name: '课标专题目录', description: '指定年级与科目的专题列表。' },
    { uri: 'ai-teach://exam/passages/{subject}', name: '中考真题片段库', description: '按学科读取带出处的真题片段。' }
  ],
  prompts: [
    { name: 'explain_mistake', title: '错题归因与补强', description: '按项目口径分析错题，给出知识点、错因与补强动作。' },
    { name: 'plan_next_week', title: '下一周学习计划编排', description: '按四阶段编排任务，保留未掌握的前置知识。' },
    { name: 'tutor_guide', title: '初中生答疑（只引导）', description: '拆解题意、回顾知识点、给相似例子，不给完整答案。' }
  ]
}

const capabilities = ref({
  llm: { model: 'deepseek-flash', configured: false, streaming: true, toolCalling: true, jsonMode: true },
  agent: FALLBACK_AGENT,
  mcp: FALLBACK_MCP,
  rag: { ready: false, engine: 'BM25 稀疏检索', evalCases: 23, negativeCases: 2 }
})

const workflow = [
  { step: '01', title: '学情诊断', desc: '专题摸底 + 自评，形成掌握度雷达与长短板。' },
  { step: '02', title: '计划编排', desc: '概念→例题→迁移→复盘，自动插入桥接复习。' },
  { step: '03', title: '专注执行', desc: '番茄钟 + 本地视觉状态机，分心才温和提醒。' },
  { step: '04', title: '错题归因', desc: '按知识点回溯错因，生成可执行的补强任务。' },
  { step: '05', title: '周报迭代', desc: '聚合近 7 天数据，下一轮计划自动重排。' }
]

const modalities = [
  { tag: '文本', title: '对话与讲题', desc: 'SSE 流式输出，引导 / 讲解双模式。' },
  { tag: '图像', title: '拍照答疑', desc: 'JPG / PNG 单次请求，不写入本地历史。' },
  { tag: '语音', title: '语音输入与朗读', desc: '浏览器识别 + 本地 TTS，背诵窗用 whisper-tiny。' },
  { tag: '视觉', title: '专注状态检测', desc: 'MediaPipe 本机推理，视频帧不上传。' },
  { tag: '视频', title: 'B 站补强', desc: '按章节检索，风控时回退到搜索入口。' }
]

const safety = [
  { title: '内容安全过滤', desc: '高危关键词统一改写为学习引导，避免模型展开。' },
  { title: '引导模式护栏', desc: '拦截「答案：」「正确选项是」等直接答案。' },
  { title: '结构化输出校验', desc: 'JSON 解析 + 字段归一化，残缺结果不进入本地库。' },
  { title: '全链路本地兜底', desc: '无密钥、超时或风控时，题库与规则继续可用。' },
  { title: '隐私边界', desc: '视频帧与语音都在本机处理，密钥只存本机 .env。' }
]

const quickQueries = ['二次函数顶点式', '欧姆定律电流与电压', '化学方程式配平', '文言文实词']
const ragQuery = ref(quickQueries[0])
const ragLoading = ref(false)
const ragResult = ref(null)
const ragError = ref('')

const mcpGroups = computed(() => ([
  { key: 'tools', title: 'Tools', hint: '可调用的动作', items: capabilities.value.mcp.tools || [] },
  { key: 'resources', title: 'Resources', hint: '可读取的数据', items: capabilities.value.mcp.resources || [] },
  { key: 'prompts', title: 'Prompts', hint: '可复用的工作流', items: capabilities.value.mcp.prompts || [] }
]))

const mcpConfig = computed(() => JSON.stringify({
  mcpServers: {
    'ai-teach': { command: 'node', args: ['<项目路径>/server/mcp.js'] }
  }
}, null, 2))

const ragStatus = computed(() => (capabilities.value.rag.ready ? 'RAG 已就绪' : 'RAG 未就绪'))
const modelStatus = computed(() => (capabilities.value.llm.configured ? '模型已连接' : '本地演示模式'))

async function loadCapabilities() {
  const response = await getAiCapabilities()
  if (!response.success || !response.data) return
  capabilities.value = { ...capabilities.value, ...response.data }
}

async function runRag(query = ragQuery.value) {
  const text = String(query || '').trim()
  if (!text || ragLoading.value) return
  ragQuery.value = text
  ragLoading.value = true
  ragError.value = ''
  const response = await searchRagPassages({ q: text })
  ragLoading.value = false
  if (!response.success) {
    ragError.value = response.error || '检索暂时不可用，请确认后端已启动。'
    return
  }
  ragResult.value = response.data || null
}

async function copyMcpConfig() {
  try {
    await navigator.clipboard.writeText(mcpConfig.value)
    ElMessage.success('MCP 配置已复制')
  } catch {
    ElMessage.info('当前浏览器不允许自动复制，可手动选中配置文本。')
  }
}

onMounted(() => {
  loadCapabilities()
  // 首屏先跑一次检索，评委打开页面就能看到 RAG 结果，不用先操作。
  runRag()
})
</script>

<template>
  <div class="ai-lab-page page">
    <section class="lab-hero">
      <div class="lab-hero-copy">
        <span class="eyebrow">能力地图</span>
        <h2>AI 不是外挂，<br>是学习闭环的一部分。</h2>
        <p>从诊断、计划、专注到反馈，每个环节都有可解释的模型能力、可追溯的真题依据，以及模型不可用时的本地兜底。</p>
        <div class="lab-hero-actions">
          <el-button type="primary" round @click="router.push('/tutor')">去问 AI <span class="arrow">→</span></el-button>
          <el-button round plain @click="router.push('/dashboard')">看学习看板</el-button>
        </div>
      </div>
      <div class="lab-status-card">
        <div class="status-row"><span class="status-dot" :class="{ on: capabilities.llm.configured }"></span><span>{{ modelStatus }}</span><code>{{ capabilities.llm.model }}</code></div>
        <div class="status-row"><span class="status-dot" :class="{ on: capabilities.rag.ready }"></span><span>{{ ragStatus }}</span><code>{{ capabilities.rag.engine }}</code></div>
        <div class="status-row"><span class="status-dot on"></span><span>MCP 服务</span><code>{{ capabilities.mcp.tools.length }} tools · {{ capabilities.mcp.resources.length }} resources</code></div>
        <div class="status-grid">
          <div><strong>{{ capabilities.agent.length }}</strong><small>Agent 工具</small></div>
          <div><strong>{{ capabilities.rag.evalCases }}</strong><small>检索评测用例</small></div>
          <div><strong>{{ modalities.length }}</strong><small>多模态通道</small></div>
        </div>
      </div>
    </section>

    <section class="lab-section">
      <div class="section-head">
        <div><span class="eyebrow">学习闭环</span><h3>一条闭环，而不是一堆功能</h3></div>
      </div>
      <div class="loop-grid">
        <article v-for="(item, index) in workflow" :key="item.step" class="loop-card">
          <span class="loop-step">{{ item.step }}</span>
          <h4>{{ item.title }}</h4>
          <p>{{ item.desc }}</p>
          <span v-if="index < workflow.length - 1" class="loop-arrow" aria-hidden="true">→</span>
        </article>
      </div>
    </section>

    <section class="lab-section rag-section">
      <div class="section-head">
        <div><span class="eyebrow">检索增强生成</span><h3>RAG 真题检索 · 现场可试</h3></div>
        <span class="section-note">只检索本地索引，不调用模型</span>
      </div>
      <div class="rag-layout">
        <div class="rag-search card-surface">
          <label class="rag-label" for="rag-input">输入一个知识点或学生原话</label>
          <div class="rag-input-row">
            <el-input id="rag-input" v-model="ragQuery" placeholder="试试：二次函数顶点式" @keyup.enter="runRag()" />
            <el-button type="primary" :loading="ragLoading" @click="runRag()">检索</el-button>
          </div>
          <div class="rag-quick">
            <button v-for="query in quickQueries" :key="query" type="button" :class="{ active: ragQuery === query }" @click="runRag(query)">{{ query }}</button>
          </div>
          <div class="rag-meta">
            <span v-if="ragResult">命中 {{ ragResult.topics?.length || 0 }} 个知识点 · {{ ragResult.passages?.length || 0 }} 条真题 · {{ ragResult.tookMs }} ms</span>
            <span v-else>输入关键词后，检索结果会出现在右侧。</span>
          </div>
          <p class="rag-privacy">索引是离线构建的本地 JSON，检索过程不把题目发到外网。</p>
        </div>

        <div class="rag-results" aria-live="polite">
          <div v-if="ragError" class="rag-empty">
            <strong>检索暂时不可用</strong>
            <p>{{ ragError }}</p>
          </div>
          <template v-else-if="ragResult">
            <div v-if="ragResult.topics?.length" class="topic-row">
              <span class="topic-label">课标命中</span>
              <span v-for="topic in ragResult.topics" :key="`${topic.grade}-${topic.name}`" class="topic-chip">{{ topic.grade }} · {{ topic.name }}</span>
            </div>
            <article v-for="(passage, index) in ragResult.passages" :key="`${passage.citation}-${index}`" class="passage-card">
              <div class="passage-head">
                <span class="passage-index">{{ index + 1 }}</span>
                <span class="passage-cite">{{ passage.citation }}</span>
                <span class="passage-score">{{ passage.score }} 分</span>
              </div>
              <p v-if="passage.snippet" class="passage-snippet">{{ passage.snippet }}</p>
              <p v-else class="passage-snippet muted">这一题在原卷里用公式或图片排版，文本版暂不展开。</p>
              <div class="passage-meta">
                <span>{{ passage.subject }} · {{ passage.year }} 年 · {{ passage.exam }}</span>
                <span v-if="passage.garbled" class="passage-flag">原卷符号有缺失</span>
              </div>
            </article>
            <div v-if="!ragResult.passages?.length" class="rag-empty">
              <strong>没有命中真题片段</strong>
              <p>换一个更具体的知识点试试，比如「二次函数顶点式」。</p>
            </div>
          </template>
          <div v-else class="rag-empty">
            <strong>准备检索</strong>
            <p>点左侧的示例关键词，看看 RAG 会带出哪些课标知识点和中考真题。</p>
          </div>
        </div>
      </div>
    </section>

    <section class="lab-section">
      <div class="section-head">
        <div><span class="eyebrow">Agent 工具</span><h3>模型可以调用的四件事</h3></div>
        <span class="section-note">参数在服务端按固定 schema 二次校验</span>
      </div>
      <div class="tool-grid">
        <article v-for="tool in capabilities.agent" :key="tool.name" class="tool-card">
          <div class="tool-head"><span class="tool-label">{{ tool.label }}</span><code>{{ tool.name }}</code></div>
          <p>{{ tool.description }}</p>
          <div class="param-row"><span v-for="param in tool.parameters" :key="param">{{ param }}</span></div>
        </article>
      </div>
    </section>

    <section class="lab-section">
      <div class="section-head">
        <div><span class="eyebrow">MCP 协议</span><h3>MCP：同一套能力，外部 Agent 也能用</h3></div>
        <span class="section-note">stdio 标准协议</span>
      </div>
      <div class="mcp-grid">
        <div v-for="group in mcpGroups" :key="group.key" class="mcp-column card-surface">
          <div class="mcp-head"><h4>{{ group.title }}</h4><span>{{ group.items.length }}</span></div>
          <small class="mcp-hint">{{ group.hint }}</small>
          <ul>
            <li v-for="item in group.items" :key="item.name || item.uri">
              <strong>{{ item.name || item.title }}</strong>
              <p>{{ item.description }}</p>
              <code v-if="item.uri">{{ item.uri }}</code>
            </li>
          </ul>
        </div>
      </div>
      <div class="mcp-config">
        <div class="mcp-config-head">
          <div><strong>挂在其它 Agent 上</strong><small>复制到 MCP 客户端配置即可接入</small></div>
          <el-button size="small" round plain @click="copyMcpConfig">复制配置</el-button>
        </div>
        <pre>{{ mcpConfig }}</pre>
      </div>
    </section>

    <section class="lab-section">
      <div class="section-head">
        <div><span class="eyebrow">多模态与安全</span><h3>多模态输入，本地优先处理</h3></div>
      </div>
      <div class="duo-grid">
        <div class="duo-card card-surface">
          <h4>五种输入通道</h4>
          <ul class="modality-list">
            <li v-for="item in modalities" :key="item.tag">
              <span class="modality-tag">{{ item.tag }}</span>
              <div><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></div>
            </li>
          </ul>
        </div>
        <div class="duo-card card-surface">
          <h4>五道可控性护栏</h4>
          <ul class="safety-list">
            <li v-for="item in safety" :key="item.title">
              <span class="safety-check" aria-hidden="true">✓</span>
              <div><strong>{{ item.title }}</strong><small>{{ item.desc }}</small></div>
            </li>
          </ul>
        </div>
      </div>
    </section>

    <section class="lab-footer">
      <div><span class="eyebrow">本地优先</span><h3>能力可以很强，数据不必离开本机。</h3></div>
      <p>学习记录存在浏览器 IndexedDB；摄像头帧、语音识别与检索索引都在本地处理。模型只接收本次请求所需的最小上下文。</p>
    </section>
  </div>
</template>

<style scoped>
.ai-lab-page{max-width:1520px;padding-top:30px;padding-bottom:70px}
.lab-hero{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(320px,.75fr);gap:26px;align-items:stretch;padding:30px;border:1px solid color-mix(in srgb,var(--primary) 16%,var(--border));border-radius:20px;background:linear-gradient(135deg,color-mix(in srgb,var(--primary-soft) 70%,var(--surface)),color-mix(in srgb,var(--surface) 94%,var(--primary-soft)));box-shadow:var(--shadow)}
.lab-hero-copy h2{margin:14px 0 12px;font-size:clamp(28px,3vw,42px);line-height:1.26;letter-spacing:-.02em;font-weight:600;color:var(--text)}
.lab-hero-copy p{max-width:620px;margin:0;color:var(--muted);font-size:calc(14.5px*var(--fs-scale));line-height:1.85}
.lab-hero-actions{display:flex;gap:10px;flex-wrap:wrap;margin-top:22px}
.lab-status-card{align-self:stretch;padding:20px;border:1px solid color-mix(in srgb,var(--border) 80%,transparent);border-radius:20px;background:color-mix(in srgb,var(--surface) 86%,transparent);display:flex;flex-direction:column;gap:11px}
.status-row{display:flex;align-items:center;gap:8px;font-size:calc(12.5px*var(--fs-scale));color:var(--text)}
.status-row code{margin-left:auto;max-width:58%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--muted);font-size:calc(11.5px*var(--fs-scale));/* 模型名不是代码：等宽字体会把 deepseek-flash 拉成散字 */font-family:inherit;letter-spacing:0}
.status-dot{width:8px;height:8px;border-radius:50%;background:var(--border);flex:none}
.status-dot.on{background:var(--success);box-shadow:0 0 0 4px rgba(95,145,121,.12)}
.status-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:auto;padding-top:14px;border-top:1px dashed var(--border)}
.status-grid div{display:grid;gap:2px}
.status-grid strong{font-size:calc(21px*var(--fs-scale));color:var(--primary)}
.status-grid small{font-size:calc(10.5px*var(--fs-scale));color:var(--muted)}
.lab-section{margin-top:34px}
.section-head{display:flex;align-items:end;justify-content:space-between;gap:14px;margin-bottom:16px}
.section-head h3{margin:7px 0 0;font-size:calc(23px*var(--fs-scale));font-weight:600;letter-spacing:-.012em}
.section-note{color:var(--muted);font-size:calc(11.5px*var(--fs-scale))}
.card-surface{border:1px solid var(--border);border-radius:18px;background:var(--surface)}
.loop-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
.loop-card{position:relative;min-height:150px;padding:18px 16px;border:1px solid var(--border);border-radius:17px;background:var(--surface)}
.loop-step{font:700 11px ui-monospace,monospace;letter-spacing:.1em;color:var(--primary)}
.loop-card h4{margin:20px 0 7px;font-size:calc(16px*var(--fs-scale))}
.loop-card p{margin:0;color:var(--muted);font-size:calc(12px*var(--fs-scale));line-height:1.7}
.loop-arrow{position:absolute;right:-10px;top:50%;transform:translateY(-50%);z-index:1;color:var(--primary);font-size:calc(16px*var(--fs-scale));background:var(--bg);padding:2px}
.rag-layout{display:grid;grid-template-columns:minmax(300px,.8fr) minmax(0,1.2fr);gap:16px;align-items:start}
.rag-search{padding:20px}
.rag-label{display:block;margin-bottom:9px;color:var(--muted);font-size:calc(12px*var(--fs-scale))}
.rag-input-row{display:flex;gap:8px}
.rag-input-row :deep(.el-input){flex:1}
.rag-quick{display:flex;flex-wrap:wrap;gap:7px;margin-top:12px}
.rag-quick button{border:1px solid var(--border);background:var(--surface);color:var(--muted);font-family:inherit;font-size:calc(11.5px*var(--fs-scale));padding:6px 11px;border-radius:999px;cursor:pointer;transition:border-color .18s,color .18s,background .18s}
.rag-quick button:hover,.rag-quick button.active{border-color:var(--primary);color:var(--primary);background:var(--primary-soft)}
.rag-meta{margin-top:14px;color:var(--muted);font-size:calc(11.5px*var(--fs-scale));line-height:1.6}
.rag-privacy{margin:8px 0 0;color:var(--muted);font-size:calc(11px*var(--fs-scale));line-height:1.6}
.rag-results{display:grid;gap:10px;min-height:220px}
.topic-row{display:flex;align-items:center;flex-wrap:wrap;gap:6px}
.topic-label{color:var(--muted);font-size:calc(11.5px*var(--fs-scale));margin-right:2px}
.topic-chip{padding:3px 9px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-size:calc(11px*var(--fs-scale))}
.passage-card{padding:15px 16px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
.passage-head{display:flex;align-items:center;gap:8px;min-width:0}
.passage-index{width:20px;height:20px;flex:none;display:grid;place-items:center;border-radius:50%;background:var(--primary-soft);color:var(--primary);font-size:calc(10.5px*var(--fs-scale));font-weight:700}
.passage-cite{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:calc(12.5px*var(--fs-scale));font-weight:600;color:var(--text)}
.passage-score{margin-left:auto;flex:none;color:var(--primary);font-size:calc(11px*var(--fs-scale))}
.passage-snippet{margin:9px 0 7px;color:var(--muted);font-size:calc(12.5px*var(--fs-scale));line-height:1.7;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden}
.passage-meta{display:flex;align-items:center;gap:8px;color:var(--muted);font-size:calc(10.5px*var(--fs-scale))}
.passage-flag{padding:1px 6px;border-radius:5px;background:var(--accent-soft);color:#96703f;font-size:calc(9.5px*var(--fs-scale))}
.rag-empty{padding:26px 20px;border:1px dashed var(--border);border-radius:16px;background:color-mix(in srgb,var(--surface) 70%,transparent);text-align:center;color:var(--muted)}
.rag-empty strong{display:block;margin-bottom:6px;color:var(--text);font-size:calc(14px*var(--fs-scale))}
.rag-empty p{margin:0;font-size:calc(12px*var(--fs-scale));line-height:1.7}
.tool-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px}
.tool-card{padding:17px 16px;border:1px solid var(--border);border-radius:17px;background:var(--surface)}
.tool-head{display:grid;gap:4px}
.tool-label{font-size:calc(14.5px*var(--fs-scale));font-weight:700;color:var(--text)}
.tool-head code{color:var(--primary);font-size:calc(10.5px*var(--fs-scale));overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.tool-card p{margin:9px 0 12px;color:var(--muted);font-size:calc(11.5px*var(--fs-scale));line-height:1.65}
.param-row{display:flex;flex-wrap:wrap;gap:4px}
.param-row span{padding:2px 7px;border-radius:6px;background:var(--surface-soft);color:var(--muted);font:500 10px ui-monospace,monospace}
.mcp-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
.mcp-column{padding:18px}
.mcp-head{display:flex;align-items:center;justify-content:space-between}
.mcp-head h4{margin:0;font-size:calc(15px*var(--fs-scale))}
.mcp-head span{color:var(--primary);font-size:calc(12px*var(--fs-scale));font-weight:700}
.mcp-hint{display:block;margin-top:3px;color:var(--muted);font-size:calc(10.5px*var(--fs-scale))}
.mcp-column ul{list-style:none;margin:12px 0 0;padding:0;display:grid;gap:11px}
.mcp-column li{display:grid;gap:3px}
.mcp-column strong{font-size:calc(12.5px*var(--fs-scale));color:var(--text)}
.mcp-column p{margin:0;color:var(--muted);font-size:calc(11px*var(--fs-scale));line-height:1.6}
.mcp-column code{color:var(--primary);font-size:calc(10px*var(--fs-scale));overflow-wrap:anywhere}
.mcp-config{margin-top:12px;padding:16px 18px;border:1px solid var(--border);border-radius:16px;background:var(--surface)}
.mcp-config-head{display:flex;align-items:center;justify-content:space-between;gap:12px}
.mcp-config-head strong{display:block;font-size:calc(13px*var(--fs-scale))}
.mcp-config-head small{display:block;margin-top:2px;color:var(--muted);font-size:calc(10.5px*var(--fs-scale))}
.mcp-config pre{margin:12px 0 0;padding:12px 14px;border-radius:12px;background:var(--surface-soft);color:var(--text);font-size:calc(11px*var(--fs-scale));line-height:1.6;overflow:auto}
.duo-grid{display:grid;grid-template-columns:1fr 1fr;gap:12px}
.duo-card{padding:20px}
.duo-card h4{margin:0 0 12px;font-size:calc(16px*var(--fs-scale))}
.modality-list,.safety-list{list-style:none;margin:0;padding:0;display:grid;gap:11px}
.modality-list li,.safety-list li{display:flex;gap:10px;align-items:flex-start}
.modality-tag,.safety-check{flex:none;width:30px;height:30px;display:grid;place-items:center;border-radius:9px;background:var(--primary-soft);color:var(--primary);font-size:calc(10.5px*var(--fs-scale));font-weight:700}
.safety-check{background:var(--primary-soft);color:var(--success);font-size:calc(13px*var(--fs-scale))}
.modality-list strong,.safety-list strong{display:block;font-size:calc(12.5px*var(--fs-scale));color:var(--text)}
.modality-list small,.safety-list small{display:block;margin-top:2px;color:var(--muted);font-size:calc(11px*var(--fs-scale));line-height:1.55}
.lab-footer{display:flex;justify-content:space-between;align-items:center;gap:24px;margin-top:34px;padding:26px 30px;border-radius:20px;background:#2b5751;color:#fff}
.lab-footer h3{margin:8px 0 0;font-size:calc(21px*var(--fs-scale));line-height:1.35;font-weight:600}
.lab-footer .eyebrow{color:#a9ccc4}
.lab-footer p{max-width:520px;margin:0;color:#cfe3e3;font-size:calc(12px*var(--fs-scale));line-height:1.75}
@media(max-width:1080px){
  .lab-hero{grid-template-columns:1fr}
  .loop-grid{grid-template-columns:repeat(3,1fr)}
  .loop-arrow{display:none}
  .tool-grid{grid-template-columns:repeat(2,1fr)}
  .mcp-grid{grid-template-columns:1fr}
  .rag-layout{grid-template-columns:1fr}
  .duo-grid{grid-template-columns:1fr}
}
@media(max-width:720px){
  .ai-lab-page{padding:16px 14px 50px}
  .lab-hero{padding:20px 18px}
  .lab-status-card{padding:16px}
  .loop-grid{grid-template-columns:1fr 1fr}
  .tool-grid{grid-template-columns:1fr}
  .section-head{align-items:flex-start;flex-direction:column;gap:4px}
  .rag-input-row{flex-direction:column}
  .lab-footer{flex-direction:column;align-items:flex-start;padding:22px 20px}
}
</style>
