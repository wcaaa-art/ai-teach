# Ai学习小伙伴

面向初高中学生的 AI Agent 自适应学习规划与多模态专注平台。项目通过“学段/年级/科目/专题选择 → 可选专题摸底 → 个性化计划 → 番茄专注 → 视觉/页面状态采集 → 学习反馈 → 下一轮计划迭代”形成持续闭环。计划按学科文件夹归类，专题之间自动插入桥接复习；看板提供可旋转的三维掌握图。默认使用浏览器本地 IndexedDB，摄像头默认关闭；只有学生主动点击并同意后才启动本地检测。

## 适用范围与卷型口径

课程目录按“学段 → 年级 → 科目”组织，**科目随年级开设**（人教版/部编版课程方案）：

| 年级 | 开设科目 |
| --- | --- |
| 初一 | 语文、数学、英语、历史、地理、生物、道德与法治 |
| 初二 | 上述科目 + 物理（物理从八年级开始） |
| 初三 | 上述科目 + 化学（化学从九年级开始） |

高中按“语文、数学、英语、物理、化学、生物、政治、历史、地理”组织。

卷型口径：**初中对齐全国中考常见结构，高中对齐新高考（3+1+2）结构**。不绑定具体省市卷；题目分值、题型按上述口径组织，提示词与出题规则保持一致（`server/prompts.js`、`server/quiz.js`）。


## 技术结构

```text
ai-teach/
├─ .gitignore
├─ index.html
├─ package.json
├─ package-lock.json
├─ .env.example
├─ vite.config.js
├─ src/
│  ├─ main.js                 # Vue、Pinia、Element Plus 入口
│  ├─ App.vue                 # 全局外壳与主题初始化
│  ├─ styles.css              # 低饱和校园主题
│  ├─ router/index.js         # 十个页面路由（含登录、账号中心）
│  ├─ stores/app.js           # Pinia 临时 UI 和设置状态
│  ├─ db/index.js             # idb/IndexedDB 表结构、账号分库与备份
│  ├─ services/api.js         # 后端 API 与 OCR 本地降级
│  ├─ utils/                  # 掌握度合并、数学排版、备份校验、视频工具
│  ├─ components/
│  │  ├─ AppShell.vue
│  │  ├─ CountdownTimer.vue
│  │  ├─ CameraMonitor.vue
│  │  ├─ AiFloatingTutor.vue
│  │  ├─ AgentTrace.vue
│  │  ├─ ChartPanel.vue
│  │  ├─ MistakeAttribution.vue
│  │  ├─ VideoSuggestion.vue
│  │  └─ DataBackupCard.vue
│  └─ views/                  # Home / Auth / Diagnosis / Quiz / Plans / Focus / Tutor / Dashboard / Settings / Account
├─ server/
│  ├─ index.js                # Express REST 路由
│  ├─ agent.js                # DeepSeek 代理、工具循环、安全过滤和降级
│  ├─ tools.js                # 固定工具 JSON Schema 与执行器
│  ├─ prompts.js              # 学情、答疑、反馈迭代提示词
│  ├─ curriculum.js           # 学段/年级/科目/专题目录
│  ├─ textbooks.js            # 教材版本目录
│  ├─ quiz.js                 # 出题蓝图与本地题库
│  ├─ videos.js               # B 站视频检索、过滤与换一换
│  ├─ auth.js                 # 本机账号服务（邮箱 + 口令）
│  ├─ mcp.js                  # 标准 MCP stdio 服务
│  ├─ rag/                    # 试卷真题 BM25 索引与检索
│  └─ *.test.js               # 服务端单元测试
└─ docs/
   ├─ 大赛交付材料.md
   ├─ 技术说明.md
   ├─ 启动调试与测试.md
   └─ 交接文档.md
```

## 快速启动

```powershell
npm install
Copy-Item .env.example .env
# 编辑 .env，把 DEEPSEEK_API_KEY 替换成自己的密钥
npm run dev
```

打开 `http://localhost:5173`。Node.js 20 LTS 可运行；若使用较新的依赖环境，建议 Node.js 22 LTS。密钥文件位于项目根目录 `.env`，字段名为 `DEEPSEEK_API_KEY`；如果你把密钥填在 `.env.example`，请先执行 `Copy-Item .env.example .env`。即使不配置密钥，课程专题、自评摸底、专注计时、IndexedDB、演示模式和看板仍可使用本地降级；配置后会启用 DeepSeek 专题摸底题、计划优化和图片答疑。摄像头仅限 `localhost` 或 HTTPS 安全上下文，并需要浏览器授权。类型检查用 `npm run typecheck`，覆盖标注了 `// @ts-check` 的核心模块（`src/services`、`src/utils`、`src/db`、`server/tools.js`）。

### 启动要点（前后端两个服务）

| 服务 | 命令 | 地址 | 说明 |
| --- | --- | --- | --- |
| 前端 Vite | `npm run dev:client` | http://localhost:5173 | 只开这个会出现「后端服务器未连接」 |
| 后端 Express | `npm run dev:server` | http://localhost:3001 | 出题、计划、答疑、账号接口都在这里 |
| 同时启动 | `npm run dev` | 5173 + 3001 | 推荐，一个命令起两个服务 |

- 后端是否存活：浏览器打开 `http://localhost:3001/api/health`，返回 `{"success":true,...}` 即正常。
- 只运行了前端、或后端进程退出，点「生成测试」就会提示「后端服务器未连接」；补启后端即可，刷新页面不用重新 npm install。
- `server/` 下的代码和提示词不热重载，改完要重启后端（`npm run dev` 需要整个重跑，或单独重启 `npm run dev:server`）。
- `.env` 缺失或密钥无效不会阻止启动，出题/计划/答疑会自动降级为本地题库或本地规则；只有需要 AI 能力时才必须配 `DEEPSEEK_API_KEY`。

大赛简介、答辩大纲、演示脚本和评审问答见 [`docs/大赛交付材料.md`](docs/大赛交付材料.md)。IndexedDB、工具 schema 与系统提示词见 [`docs/技术说明.md`](docs/技术说明.md)。启动调试和 20 项验收清单见 [`docs/启动调试与测试.md`](docs/启动调试与测试.md)。**接手开发先读 [`docs/交接文档.md`](docs/交接文档.md)**。

## MCP 服务

项目内置标准 MCP（Model Context Protocol）服务，与 Web 端 Agent 共用同一套工具实现，可被外部 Agent 通过 stdio 接入：

```powershell
npm run mcp
```

暴露三个纯函数工具：`search_curriculum`（课标知识点检索，支持跨年级与术语别名）、`calc_review_interval`（艾宾浩斯复习间隔）、`list_curriculum_chapters`（专题目录）。专注记录与视觉状态由浏览器推送，未纳入 MCP，避免外部调用拿到空数据。

外部 Agent 配置示例：

```json
{
  "mcpServers": {
    "ai-teach": { "command": "node", "args": ["<项目路径>/server/mcp.js"] }
  }
}
```
