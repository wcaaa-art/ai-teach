# P6 前端工程整改 Spec

## 背景

P1–P5 已收口，基线：`npm test` 352 通过、typecheck 通过、build 通过、RAG 评测 26/26。P6 遗留三项：checkJs 扩展、巨型页抽 composable、答疑引用可点击。本 Spec 只做这三项，不改主题、布局、路由与业务口径。

## 范围决策

| 项 | 本次做法 | 说明 |
| --- | --- | --- |
| 引用可点击 | 点「检索依据」标签弹出来源详情（卷名、题型、命中片段原文） | 引用数据里没有章节 id，资料库检索也不覆盖真题卷，无法做真实路由跳转；改为「点开可核对原文」。比跳一个查不到的目标诚实。 |
| 巨型页抽 composable | 先抽 QuizView 的手写稿拍照/OCR 块到 `useAnswerPhotos` | 该块 5 个函数、4 个状态、1 个 Map，边界干净、不碰判分逻辑。DiagnosisView / FocusView 留到下一刀。 |
| checkJs 扩展 | 给 6 个核心模块加 `// @ts-check` + 补 `.vue` 类型声明 | 已用 `npx tsc --noEmit --checkJs` 实测：目标文件除 router（16 条，全部是缺 `.vue` 声明）外均为 0 错误。全局 `checkJs: true` 会带出 server 约 60 条错误，不在本刀范围。 |

### 明确不做

- 不改 UI 主题、布局、交互文案。
- 不引入任何新依赖。
- 不重构 DiagnosisView / FocusView / PlansView 等其它页面。
- 不启用全局 `checkJs`，不动 `server/` 的类型。
- 不改引用去重上限（4 条）、不改 RAG 召回与重排口径。

## A. 引用可点击

### A1. 后端带出片段原文

文件：`server/tools.js`（`rag_knowledge_query` 分支，当前第 77 行）

把 `citations` 从纯字符串改为对象数组，保留原有文案格式，额外带片段与质量标记：

```js
citations: citePassages.map(item => ({
  text: `${item.citation}：${item.subject}${item.year}年${item.exam}真题`,
  snippet: item.text,
  lowQuality: item.lowQuality
}))
```

文件：`server/agent.js`（`publicCitations`，当前第 207–220 行）

- 兼容字符串与对象两种条目，输出仍为 `{ text, title, detail }` 基础上按需追加 `snippet`、`lowQuality`。
- `snippet` 空白折叠后截 240 字；无片段或非字符串条目不追加字段。
- 去重键、4 条上限、`《卷名》：题型` 解析规则不变。

### A2. 前端点击弹层

文件：`src/components/AnswerCitations.vue`

- `normalize()` 保留 `snippet`、`lowQuality`。
- 标签由 `<span>` 改为 `<button type="button">`，外观样式沿用现有 `.citation-chip`，补 `cursor:pointer`、hover/focus 边框反馈。
- 每个标签包一层 `el-popover`（`trigger="click"`、`placement="top-start"`、`:width="340"`、`popper-class="citation-popper"`），内容：
  - 卷名（`item.title`）
  - 题型（`item.detail`）
  - 命中片段（`item.snippet`，无则不显示）
  - `lowQuality` 时提示「该片段公式抽取不完整，仅作出处参考」。
- 弹层内容被 teleport 到 body，样式用 `:global(.citation-popper ...)` 写在 scoped 块内。
- 旧会话里没有 `snippet` 的引用照常渲染，只是弹层只有卷名与题型。

### A3. 测试

文件：`server/agent.test.js`

新增 1 条用例：对象条目透传 `snippet` 并截到 240 字、`lowQuality` 透传；字符串条目输出与现有 `deepEqual` 一致（原有测试不改）。

## B. QuizView 手写稿 OCR 抽 composable

### B1. 新文件

`src/composables/useAnswerPhotos.js`

```js
export function useAnswerPhotos(answers) { ... }
```

职责：`answerImages`、`ocrLoading`、`photoTarget`、`photoInput`、`photoFiles` 五份状态 + `pickPhoto`、`removePhoto`、`readFileAsDataUrl`、`compressImage`、`onPhotoChange`、`recognizePhoto` 六个函数，整体从 QuizView 原样搬移，逻辑不改。`answers` 以参数注入（识别结果追加到作答内容）。返回上述状态与函数。

### B2. QuizView 改动

文件：`src/views/QuizView.vue`

- 删除第 153–235 行手写稿块（从注释「手写作答」到 `recognizePhoto` 结束）。
- 新增 `import { useAnswerPhotos } from '../composables/useAnswerPhotos.js'`。
- 在 `answers` 声明之后调用并解构，模板与草稿存取代码（`answerImages` 的 clear/assign）全部不动。

### B3. 验证

无 DOM 测试环境，靠 typecheck、build 与浏览器实走确认页面正常、按钮与预览渲染不报错。

## C. checkJs 扩展

### C1. 加 `// @ts-check`

- `src/stores/app.js`
- `src/utils/tutorHistory.js`
- `src/utils/agentRun.js`
- `src/utils/liveFocus.js`
- `src/services/speech.js`
- `src/router/index.js`

### C2. 补 `.vue` 类型声明

新文件 `src/shims-vue.d.ts`：

```ts
declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
```

`tsconfig.json` 的 `include` 追加 `"src/**/*.d.ts"`（当前只含 `src/**/*.js`、`server/**/*.js`）。

受检 JS 文件从 8 个增至 14 个。

## 验证清单

1. `npm test` → 352 + 新增用例，全部通过。
2. `npm run typecheck` → 0 错误（含新纳入的 6 个文件）。
3. `npm run lint` → 0 error（warning 数量不增加）。
4. `npm run build` → 通过。
5. 重启后端（node 无热重载）：停掉后台 dev，重新 `npm run dev`，`GET http://localhost:3001/api/health` 正常。
6. 浏览器走查：
   - `http://localhost:5173/tutor` 提一个会触发 RAG 的问题，等流式结束，点「检索依据」标签 → 弹层显示卷名、题型、片段原文；控制台 0 error。
   - `http://localhost:5173/quiz` 正常进入选题页，无控制台报错（手写稿按钮在答题页，组件挂载不报错即可）。
7. 回写 `MEMORY.md`：P6 记录（改动文件、验证结果、剩余两项：DiagnosisView/FocusView 抽离、全局 checkJs）。

## 风险与回滚

- 弹层样式被 scoped 隔离 → 用 `:global` + `popper-class` 兜底。
- 引用对象进 IndexedDB 会话记录，新增字段约 1 KB/轮 → 可忽略；旧记录兼容。
- `shims-vue.d.ts` 把 `.vue` 声明为 `any`，只影响 tsc，不影响运行时与构建。
- 回滚：本次不涉及数据结构与依赖，`git checkout -- <改动文件>` 即可回退；未获许可不 commit。

## 需确认

同意后按 `tasks.md` 顺序执行；执行完按「做了什么 / 验证结果 / 下一步建议」收尾，并附 `http://localhost:5173`。
