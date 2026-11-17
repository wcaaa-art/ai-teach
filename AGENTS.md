# AGENTS.md — AI-Teach-project（知行 AI 学伴）

> 本文件与 `MEMORY.md` 是进入本项目的强制前置阅读。未读完两者前，不做任何改动文件或外部状态的操作。

## 项目定位

面向初中学生的 AI Agent 自适应学习规划 + 多模态专注平台（传智杯参赛作品）。
主闭环：学段/年级/科目/专题选择 → 摸底 → 个性化计划 → 番茄专注 → 视觉/页面状态采集 → 学习反馈 → 下一轮计划迭代。

## 技术栈

- 前端：Vue 3 + Vite 6 + Pinia + Vue Router + Element Plus 2.11
- 图表：ECharts + echarts-gl（三维掌握图）
- 本地存储：IndexedDB（`idb`），默认浏览器本地
- 后端：Express 4（`server/`），DeepSeek API 代理 + 工具调用循环
- 视觉/OCR：MediaPipe tasks-vision、TFJS（webgl backend）、tesseract.js
- 测试：`node --test`（`server/agent.test.js`、`src/utils/formatMath.test.js`）

## 目录约定

```
src/main.js            Vue/Pinia/Element Plus 入口
src/App.vue            全局外壳与主题
src/router/index.js    路由
src/stores/app.js      UI 与设置状态
src/db/index.js        IndexedDB 表结构与存取
src/services/api.js    后端 API + OCR 本地降级
src/views/             业务页面（含 AuthView.vue 登录注册）
server/index.js        Express REST 路由
server/auth.js         认证相关
server/agent.js        DeepSeek 代理、工具循环、降级
server/tools.js        工具 JSON Schema 与执行器
server/prompts.js      提示词
docs/                  交付材料、技术说明、调试与验收清单
```

## 运行

```powershell
npm install
Copy-Item .env.example .env   # 填 DEEPSEEK_API_KEY
npm run dev                   # 同时起 vite(5173) 与 node server/index.js
npm test
```

无密钥时本地降级可用；摄像头仅 `localhost` / HTTPS 安全上下文。

## 约束

- 中文注释、英文标识符；Vue/Element Plus 现有风格优先，不擅自改主题与布局。
- 密钥只记位置（`.env`，字段 `DEEPSEEK_API_KEY`），不记值，不入库、不写进文档。
- 外科手术式改动：只改必须改的，不顺手重构无关代码；发现无关死代码只提不删。
- 源码改动留在仓库内；源码外的报告/截图/日志/构建产物放 `D:\trae-work\tmp\`（可删）或 `D:\trae-work\deliverables\YYYYMMDD-任务名\`（保留）。仓库里不留这类文件。
- 完成标准必须可验证：改完要跑 `npm test` / 构建 / 实际页面走查，不能只"改完就报完成"。

## 协作方式

- 称呼用户为「豪哥」，中文沟通，结论先行，不谄媚。
- 学到新东西主动回写 `MEMORY.md`；会话结束前用一句话回显本次新增内容。

## 待确认（一次问清，答后回填）

- [ ] 交付/评审截止时间与当前要冲的里程碑（省赛/决赛/最终提交）
- [x] 账号体系目标：本地优先——账号只做本机多用户隔离（users.json 存凭据），学习数据留在 IndexedDB；不做服务端学习数据持久化；已补 JSON 导出/导入备份（2026-11-12 定）
- [x] 登录方式：邮箱 + 口令，本机账号服务，不接第三方登录（2026-11-12 定）
