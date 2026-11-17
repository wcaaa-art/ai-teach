# P6 任务清单

## 1. 引用可点击

- [ ] `server/tools.js`：`rag_knowledge_query` 的 `citations` 改为 `{ text, snippet, lowQuality }` 对象数组。
- [ ] `server/agent.js`：`publicCitations` 兼容对象条目，`snippet` 折叠空白截 240 字，按需输出 `lowQuality`。
- [ ] `server/agent.test.js`：新增片段透传与截断用例。
- [ ] `src/components/AnswerCitations.vue`：标签改按钮 + `el-popover` 展示卷名/题型/片段/低质提示，补 hover/focus 与全局弹层样式。
- 验证：`npm test`、`npm run typecheck`。

## 2. QuizView 抽 composable

- [ ] 新建 `src/composables/useAnswerPhotos.js`：搬移手写稿拍照/压缩/OCR 逻辑，`answers` 参数注入。
- [ ] `src/views/QuizView.vue`：删原块、导入并解构，其余引用不动。
- 验证：`npm run typecheck`、`npm run build`，`/quiz` 页面无控制台报错。

## 3. checkJs 扩展

- [ ] 6 个文件加 `// @ts-check`：`src/stores/app.js`、`src/utils/tutorHistory.js`、`src/utils/agentRun.js`、`src/utils/liveFocus.js`、`src/services/speech.js`、`src/router/index.js`。
- [ ] 新建 `src/shims-vue.d.ts`，`tsconfig.json` 的 `include` 追加 `"src/**/*.d.ts"`。
- [ ] 修掉新纳入文件报出的类型错误（预期仅 router 的 `.vue` 声明类，若出现其它错误按最小改动修）。
- 验证：`npm run typecheck` 0 错误。

## 4. 全量验证与收尾

- [ ] `npm test`、`npm run lint`、`npm run typecheck`、`npm run build` 全绿。
- [ ] 重启 dev（后端无热重载），`/api/health` 正常。
- [ ] 浏览器走查 `/tutor` 引用弹层与 `/quiz` 页面。
- [ ] 回写 `MEMORY.md` 的 P6 记录。
- [ ] 按「做了什么 / 验证结果 / 下一步建议」汇报，附 `http://localhost:5173`；未获许可不 commit。
