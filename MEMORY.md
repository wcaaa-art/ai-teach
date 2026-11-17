# MEMORY.md — AI-Teach-project

> 只记代码里查不到的东西：决策、踩坑、外部资源位置、用户纠正。凭据只记位置不记值。

## 当前状态（2026-11-05）

- 仓库原为传智杯参赛作品「知行 AI 学伴」，运行界面品牌已改为「Ai学习小伙伴」；根目录有 `传智杯提交包/` 与 `传智杯提交包.zip`（约 30MB，历史快照未同步改名）。
- 已有页面：Home、Diagnosis、Plans、Focus、Tutor、Dashboard、Settings、Auth。
- 学情诊断信息架构（2026-11-15，老大要求）：结果页与「上次报告」统一按「分析 → 计划 → 题目分析 → 视频补强」排：`result` 页原先把「摸底答案与解析」放在最前，现已把 `.result-grid`（掌握度雷达 + Agent 编排顺序）提到 header 之后，答案与解析居中，`长短板与视频补强` 沉底；`report` 页同样把「答案与解析」移到「长短板与视频补强」之前。雷达与计划仍并排，视频补强始终是最后一块。
- 首页收敛（2026-11-15，老大要求）：删掉顶部「TODAY'S ONE THING / 今天先做这一件」行动卡，连带 `starterPlan / starterHint / todayQueue / queueRest / queueRemaining / startStarter / homePlans / isReturning` 与 `.today-focus*`、`.home-page.today-first` 样式一起清掉（主页不再 `loadPlans()`）；welcome 条标题去掉学段前缀，固定为「今天想点亮哪一块？」。首页顺序：hero → welcome-strip → 科目 → 学习节奏 → CTA。
- 界面约定（2026-11-05）：品牌文案为「Ai学习小伙伴」，logo 为 A/i/学/习 2×2 四宫格（文案仍是「Ai学习」）；根路径 `/` 重定向到 `/home` 学习主页；学情诊断路由改为 `/diagnosis`；桌面（≥801px）用顶部横向导航且不再显示页面横条，状态/登录入口并入导航最右侧（2026-11-05 时不再保留设置齿轮、`/settings` 从导航项进入；2026-11-13 导航精简后设置改到右上角账号区）；≤800px 保持左侧竖栏 + 横条（只留页面标题和登录/退出，避免 375px 溢出）。
- 品牌图标（2026-11-05，v4 四宫格 = 方案D「大字优先」）：`public/favicon-v4.svg` + `favicon-v4-32.png` + `apple-touch-icon-v4.png`，`index.html` 三个 link 均指向 v4。四宫格参数：左上 A、右上 i（拉丁 23.5/64，锚点 x=19.1/44.9，基线 y=25.93）、左下 学、右下 习（汉字 20/64，基线 y=52.5）；四格中心从 16/48 内收到 19.1/44.9（内收 19%），`rect rx=16` 与渐变保持不变。网页 logo 与 favicon 共用比例：`styles.css` 的 `.brand-grid` 用 2×2 grid + `place-items:center` + `padding:.0969em`（内收），容器 `font-size` = 徽标边长，字形按 em 缩放（`.mark-latin` .367em / `.mark-cjk` .3125em），因此导航 34px、登录 44px、窄屏 30px 三处比例与字重（800）自动一致；`AppShell .brand-mark` 与 `AuthView .story-mark` 均为正方形徽标 + 右侧品牌文字，徽标类上不要再写 `padding`（会覆盖全局内收）。改图标内容必须换文件名（v2/v3…），Chrome 对同 URL favicon 缓存极顽固；旧文件已删除，旧路径会被 Vite 回落到 HTML。logo 渐变统一走 `--brand-gradient`（#4d8d8e→#327a8e，135deg）。
- 顶部导航自适应：801–1023px 导航项只显示图标（hover title 显示名称），1024–1280px 收紧左右留白（`14px 28px`）与导航项间距并隐藏重复的「已登录」徽标（登录后账号按钮已表明状态），≥1281px 完整文字；所有导航项样式必须限定 `.side-nav nav button`，避免误伤右侧 Element Plus 操作按钮。
- 导航留白（2026-11-06）：桌面导航统一 `--nav-h:74px`（`min-height:var(--nav-h)`，原 62/55/60px），`padding:14px 36px`（原 `10px 24px`），导航项 `gap:6px / padding:9px 12px`（原 `2px / 8px 9px`）；窄屏侧栏上下内边距 `16px → 20px`。`--nav-h` 只写在 `.app-shell`（移动 82px / 桌面 74px），`AuthView` 的 `.auth-page` 改用 `calc(100vh - var(--nav-h, 82px))`，删掉了 54px/82px 两处硬编码，桌面登录页从溢出 1–8px 变为正好 900/900；首页 `.hero-actions` 的重复「登录 / 注册」已删，只留「开始我的学习路线」。
- 认证闭环已完成（2026-11-05）：`AuthView.vue` 可注册/登录并展示失败原因；`server/auth.js` 已挂载到 `/api/auth`；会话用 HttpOnly Cookie 保持 7 天，刷新后有效；新增 `/account` 账号中心（`requiresAuth`），顶栏可查看账号并退出登录。
- 受限页面只有 `/account`，其余页面继续保持「不登录也能用」的本地模式，避免破坏参赛演示的隐私卖点。
- 账号数据写在本机 `server/data/`（users.json + session-secret），已加入 `.gitignore`；学习数据仍只在浏览器 IndexedDB，登录不等于云同步。
- 运行记录：`npm run dev` 同时启动 Vite(5173) 与 Express；依赖已安装（`node_modules` 存在）。本机 Node v18.18.0 / npm 9.8.1，Vite 6.4.5 可正常运行（官方支持 ^18.0.0 || ^20.0.0 || >=22.0.0），但低于 README 推荐的两条 LTS。启动失败最常见原因是 5173 被占，此时 strictPort 会直接输出 `Error: Port 5173 is already in use` 并退出。
- 端口约定（2026-11-06）：Vite `server.strictPort` + `preview.strictPort`（5173 / 4173），端口被占直接报错，不再悄悄漂到 5174；两套服务都配了 `/api` 代理，所以前端永远用相对路径 `/api`。后端 CORS 在非生产环境放行所有回环地址（`localhost` / `127.0.0.1` 任意端口），生产只认 `CLIENT_ORIGINS`。`server/index.js` 末尾有 JSON 兜底错误中间件，任何未捕获异常都返回 JSON 而不是 Express 默认 HTML 错误页。
- 验证记录：`npm test` 28 项通过；`npm run build` 通过；浏览器实测注册→刷新保持→账号中心→退出→守卫重定向全链路通过（测试账号已删除）。图标/渐变/齿轮改动（2026-11-05）：构建通过，CDP 精确模拟 1440/1024/900/801/800/375 六档核查右侧只剩状态徽标 + 登录（登录后为已登录 + 称呼 + 退出），导航「设置」点击落到 `/settings`。favicon 复核（2026-11-05）：旧图标只有单行「Ai」，且文件名未变导致 Chrome 复用缓存；同时旧版「学习」26px/基线54 在 16px 下贴到圆角下边缘。现改为 v2 文件名 + Ai 16/基线17、学习 24/基线49，16px 实际像素中两行均完整落在图形内（放大截图 `D:\trae-work\tmp\ai-teach-ui\sizes-v2-evidence.png`），Chrome 新配置解析到 `favicon-v2.svg`。四宫格改版（v3，2026-11-05）：`npm run build` 通过；CDP 精确视口 1440/1024/900/801/800/375 实测导航高度与改前一致（1440 下边框仍 y=61），801–1440 导航无横向溢出，≤800 侧栏 30px 徽标正常；登录页 44px 徽标四字在位；v3 三文件 dev 返回 200 且 MIME 正确，新配置解析到 `favicon-v3.svg`；16/32/48/180 逐尺寸放大出图确认四象限均有字形像素（证据 `D:\trae-work\tmp\ai-teach-ui\v3-check-evidence.png`）。方案D 落地（v4，2026-11-05）：`npm run build` 通过；CDP 六档复核导航高度仍为 62/55/60/60（801–1440），`navOverflow` client==scroll，徽标 34/30/44 三档内收统一（`markPad` 3.2946px、2.907px，登录 pad 4.2636px），四字笔画互不粘连；v4 三文件 200 且 MIME 正确，v3 路径回落到 HTML（证明已删文件），新配置解析到 `favicon-v4.svg`；16/32/48/180 原生像素出图四象限均有独立字形（证据 `D:\trae-work\tmp\ai-teach-ui\v4-check-evidence.png`），但 16px 下「i」「习」仅剩 3–4 个亮像素，属"能分辨形状、不能读字"的极限。注册失败修复（2026-11-06）：根因是 Vite 漂到 5174 后浏览器 POST 带 `Origin: http://localhost:5174`，Express CORS 白名单只有 5173/4173 → 拒绝后返回 HTML 错误页；已放宽本地回环 Origin、加 strictPort、加 JSON 错误兜底、前端非 JSON 兜底提示。复测：`npm test` 28 通过、`npm run build` 通过、浏览器闭环注册→刷新保持→退出→再登录全程无解析报错，拦截成 HTML 的响应也能显示「账号服务未启动或不可用，请稍后重试。」（证据 `D:\trae-work\tmp\ai-teach-ui\e2e-*.png`）。
- 「`right-hand side of 'in' should be an object, got null`」排查（2026-11-06）：Firefox 159 headless 巡检 6 轮（全部路由加载、全按钮/开关/选择器/输入框逐个点击、带 IndexedDB 数据、计划行四个动作含提醒弹窗与日期选择、退出登录再进 `/account`）+ Chrome CDP 2 轮，**0 次复现**。静态审计：`src` 里 `in` 只有 `'speechSynthesis' in window`（speech.js ×5）与 `'Notification' in window`（reminders.js:13、PlansView:73/128），右操作数恒为 `window`；`server/tools.js:16` 的 `key in args` 上一行已 `!args` 判空；依赖里 Element Plus 31 处 `"[prop]" in obj`、ECharts/zrender 的 `'fill' in style`/`'prototype' in target` 均有守卫。结论：当前代码路径不产生该报错，未改一行源码（`npm test` 28 通过、`npm run build` 通过、dev 已重启在 5173/3001）。
- 学习看板 3D 掌握图（2026-11-06，`DashboardView.vue` 的 `knowledgeOption`）：原来糊是因为 30 个中文知识点名做 category 轴标签挤在投影斜线上 + 默认 visualMap 压在刻度上 + 三维轴名被画布裁。现方案：x 轴只显示 `K1…Kn` 编号（`tickStep = ceil(n/6)`，最多约 6 个），全名进 tooltip（`trigger:'item'`）；`visualMap.show:false`（颜色映射保留），弱→强渐变条挪到卡片标题行右侧（`styles.css` 的 `.section-head/.mastery-legend/.mastery-bar`）；三轴 `name:''`（echarts-gl 默认会画 X/Y/Z，`axisName.show` 无效），轴说明改在图下文案；`grid3D.axisPointer.show:false`（否则悬停/拖拽会多冒一个数值标签，曾被误判成"刻度重复"）；深度轴上限取 interval 整数倍、只留 0/中间/上限 3 个刻度（4–5 个刻度旋转后会挤）；竖轴隐藏 0 刻度（`formatter`），因为 0 和 x 轴首个 K 编号共用同一个角；scatter3D `symbolSize:18`、`opacity:1`；网格布局留 6%/4% 边距、`height:'84%'` 防标签被裁。已知限制：旋转到很深角度时，深度轴 0 刻度会被原点处（K1/顺序1/等级0）的散点盖住，echarts-gl 无 hideOverlap，属投影遮挡。
- 专注页自选时长（2026-11-07）：`FocusView.vue` 顶部新增 25/40/45/60/自定义（5–180 整数）时长选择，选中值驱动 CountdownTimer 总长、「本次分钟」与反馈 `actualSeconds`；选择写入 `store.settings.focusMinutes`（IndexedDB settings），用户没选过时回落到计划 `estimatedMinutes`，计时中禁用修改并显示提示；不写回计划数据。验证：`npm test` 40 通过、`npm run build` 通过，CDP 实测 25→45→自定义 12/5、开始/暂停/继续、刷新恢复，5 分钟跑 65 秒后 `actualSeconds=65`、本次分钟=1。2026-11-07 补：专注页 `onMounted` 读 `loadFocusSuggestion()`，有时长建议时在时长选择区下方显示「根据最近一次测试（正确率 X%），建议本次专注 N 分钟」，并在对应预设档位追加「推荐」小标记；只做提示，不写入 `durationMode`，用户手动选择后 `settings.focusMinutes` 照常更新、建议文案不变；无记录时整条隐藏。`p` 的 `title` 挂完整 `reason` 作悬浮提示。5182 实测：新用户无提示 → 做测试（正确率 60%）进专注页显示 40 分钟 + 40 档位标记、默认仍选 25 → 手动选 45 后提示不变且 settings=45 → 删除 `focusSuggestions.current` 重载后提示与标记消失、选中仍为 45。
- 踩坑（2026-11-07）：Vue 响应式 Proxy 不能 structuredClone，`saveSettings(settings.value)` 会抛 `DataCloneError` 并被 `db/index.js` 的兜底吞掉，只落到内存 Map，刷新即丢；写 IndexedDB 前必须展开成普通对象 `{ ...settings.value }`。章节测试的 `quizResults` 记录里含 `questions`/`answers`/`selfGrades` 响应式代理，同样会静默失败（表现为刷新后周测「本周已完成」不生效），已改为 `JSON.parse(JSON.stringify(record))` 再落库。
- 数学公式渲染（2026-11-07）：`src/utils/formatMath.js` 负责把题目/答疑文本转成安全 HTML；`QuizView` 的题干、选项、作答、参考答案、解析在改前都用 `{{ }}` 纯文本，模型返回的 `a_n`/`a_1`/`a_{n+1}` 不会变下标，已统一改为 `v-html="formatMathText(...)"`。下标规则：花括号 `_{n+1}`、无花括号字母单个 `_n`、数字整体 `_10`，另有独立记号 `a1`→`a<sub>1</sub>`；竖排 `an` 仅当本行出现「数列」或已有 `<sub>` 时才转，`and`/`than`/`答案` 靠前后字符边界保护。分数占位符改为 `\u0000{index}\u0000`，避免被「字母+数字」下标规则误伤。5183 实测 `subCount` 14、`and`/`than` 原样，截图在 `D:\trae-work\tmp\quiz-subscript\`。
- 章节测试（2026-11-07，`/quiz` + `DiagnosisView` 入口）：日常 5–8 题单章节、周测 10–15 题 2–6 章节且每自然周一次（`getWeeklyWindowStart` 本地周一 00:00）。卷型规范写在 `server/prompts.js` 的 `QUIZ_SYSTEM_PROMPT`：初中按佛山中考（单选 3 分/填空 3 分/解答 6–12 分，难度 7:2:1，无多选），高中按广东新高考（单选 5 分/多选 6 分全对满分、少选按比例、错选 0/填空 5 分/解答 10–17 分，难度 5:3:2）。去重：`stemHash`（FNV-1a + 归一化去空白标点全半角）存 IndexedDB `quizFingerprints`，出题时近 7 天题干传 `recentStems`，生成后逐题比对撞题重试，指纹在出题时即写、保留 14 天。`server/quiz.js` 负责蓝图、模型题校验、本地兜底（按学科/章节关键词，含高中多选题），无密钥或调用失败返回 `source: local-fallback`。结果落 `quizResults`，专注建议固定写 `focusSuggestions.current`，专注页用 `loadFocusSuggestion()` 读 `recommendedMinutes`（建议 25/40/45，不改计划）。兜底实测：仓库外 cwd 启动 3002（所在目录无 `.env`）日常 6 题/周测 12 题均 `local-fallback`、结构校验 0 错误、二次出题 0 重叠；`npm test` 40 通过、`npm run build` 通过；5181 实跑日常（交卷 0/15→建议 45 分）与周测（12 题、18/27、建议 40 分、刷新后「本周周测已完成」且按钮禁用）。注意 PowerShell `$env:KEY=''` 等于删除变量，dotenv 会照常读 `.env`，真要测无密钥必须换到无 `.env` 的 cwd 启动。
- 专注页改版（2026-11-07）：`CountdownTimer` 试过 3D 翻牌，豪哥最终要求改回**纵向滚动**（每位 0–9 竖条 `translateY`，450ms 缓动，`prefers-reduced-motion` 关闭动画）；字号用容器查询 `clamp(56px,26cqw,220px)`（降级 `clamp(56px,10vw,190px)`），跟着中间栏宽度走，不再用视口宽度把布局挤爆。`FocusView` 最终采用 B「任务工位」：左任务卡（任务标题/标签/时长档位），中间滚动时钟+操作按钮，右侧竖排栏（摄像头/小提示/本次状态）；三栏宽度 `clamp(260px,24vw,380px) / 1fr / clamp(240px,20vw,340px)`，`≤1000px` 单列堆叠。**关键坑**：`AppShell` 里 `.focus-shell .main-content :deep(.page){max-width:1000px}` 会把专注页硬卡在 1000px，宽屏也留大片空白；已删除，并在 `FocusView` 用 `.focus-page{max-width:none}` 覆盖全局 `.page` 的 1180px 上限。`CameraMonitor` 新增 `compact` 属性（视频 96px、隐藏隐私长文和开关文字），避免右栏过高。按钮拆为「开始/暂停」「结束」「写反馈」：结束只落 `focusSessions` 并重置计时；自然走完也只落库，不自动弹反馈；`pendingSession` 复用已落库记录，计时中直接写反馈才补记一条，避免重复。反馈框加了「取消」。**蓝色主题（2026-11-07）**：专注页的蓝色系通过 `.focus-page` 局部覆盖 CSS 变量实现，不动全局主题：`--bg:#eaf2fb`（浅蓝）、`--surface:#f9fcff`、`--surface-soft:#eef5fe`、`--text:#1f3350`（蓝黑）、`--muted:#6b82a0`（雾霾蓝灰）、`--primary:#5b8fd6`（雾霾蓝，时钟数字/强调色）、`--primary-soft:#deebfb`、`--border:#d3e2f5`、`--shadow` 改蓝色低透明度；同时把 Element Plus 的 `--el-color-primary` 及 light-3/5/7/8/9、dark-2 覆盖为同色系，否则 EP 按钮/开关仍是默认亮蓝。`CameraMonitor` 视频底改深藏蓝 `#0e1c2d`、徽标文字淡蓝 `#dbeaff`；AI 助手按钮阴影改蓝。**范围仅专注页**；其它页面仍是原青绿主题，若豪哥要全站统一蓝，需改 `styles.css` 的 `:root` 变量（含 dark 主题）。2026-11-07 晚定稿：专注页改为「蓝绿大底色 + 黄橙小点缀」——`.focus-page` 背景蓝→绿渐变，新增 `--leaf:#6aa78d`（提示卡淡绿底、已专注数值）、`--warm:#d8894f` / `--sun:#ecc66d` 仅用于时钟冒号、任务小标题、提示卡左侧细条、「推荐」标记与建议条；Element success/warning 在专注页降饱和为 `#63a184 / #d99a5b`，摄像头背板改深青 `#12302f`，不用大红大灰与荧光色。**全站蓝色（2026-11-07 追加，同日已回滚）**：豪哥随后要求「换回来」，以下这段蓝值均已恢复为原青绿值，仅专注页 `.focus-page` 保留蓝色局部覆盖；以下为当时改动记录，勿当作当前状态。豪哥要求整个网站换蓝，已改 `styles.css` 的 `:root`：`--bg:#eaf2fb`、`--surface:#ffffff`、`--surface-soft:#f3f8fe`、`--text:#1f3350`、`--muted:#6b82a0`、`--primary:#5b8fd6`、`--primary-soft:#deebfb`、`--accent:#8fb8e8`、`--border:#d3e2f5`，`--brand-gradient` 改 `#5b8fd6→#3a6fb5`；Element Plus `--el-color-primary` 全系列下沉到 `:root`。dark 主题同步改蓝（`--bg:#12233a`、`--surface:#1b2f4a`、`--primary:#7ba8e4`）。`HomeView` 青绿/暖橙硬编码全部替换为蓝阶（科目卡四色改为四种浅蓝 `#e3edfc/#e9eefb/#e6f0fd/#dcecfa`），`DashboardView`/`DiagnosisView` 图表、掌握度 `visualMap`、`AppShell` 状态点与导航 emoji（改单色符号 `◈▤◷✦◔⚙`）、`TutorView` 渐变阴影、`favicon-v4.svg` 与两张 PNG 图标、`index.html` 的 `theme-color` 全部换蓝；语义色（正确 `#67c23a`、错误 `#f56c6c`、警告 `#e6a23c`、朗读停止 `#b86f61`）保留。
- 反馈更新计划的真实作用（2026-11-07，实测 `/api/agent/iterate`）：DeepSeek 成功时返回 `plans`（index 0 继承原 plan id），前端逐条 `savePlan`；调用失败/无密钥走 `localFallback`，只按 `mastery` 调 `priority`（≤1 → 高）与 `reviewTime`（高 +1 天，否则 +3 天），`estimatedMinutes` 取 `min(原值, dailyMinutes)`；**`completion` 与 `note` 在本地兜底里不参与**，只随请求进入模型路径。落点是 IndexedDB `plans`，用户可在「学习计划」页看到优先级、预计时长、复习日期，下次专注按计划时长兜底。提交后已改为 `ElNotification` 展示服务端 `explanation` 并提示去「学习计划」查看。
- 计划名下标（2026-11-07）：`FocusView` 标题/标签与 `PlansView` 任务名/标签改用 `formatMathText` + `v-html`，只改显示不改数据；`formatMath.js` 的竖排 `an` 语境从「含数列 / 已有 sub」扩到「含 `S n` 记号」，且在数列语境下同时把 `Sn / S n` 排成 S<sub>n</sub>，因此没有“数列”字样、只写「由Sn求an」的计划名也能渲染成 Sₙ 与 aₙ（测试已覆盖）。账号数据隔离（2026-11-08）：学习数据改为按账号分库——未登录用 `ai-teach-local`，登录后用 `ai-teach-user-<服务端 id>`；`db/index.js` 的 `setDataOwner()` 切换连接，`settings` 固定读写本地库（设备偏好不跟账号走）。登录/注册时若当前是本地模式且有学习记录，用 `ElMessageBox` 询问是否同步：确认则 `syncLocalDataToOwner()` 复制 11 张业务表（不含 settings），拒绝则账号从空白库开始；本地数据始终不删。退出登录 `store.clearUser()` 切回本地库；`App.vue` 等 `ensureAuth()` 完成后再渲染，避免刷新时先用本地数据渲染再切号。验证脚本 `D:\trae-work\tmp\verify-account-isolation.mjs`（CDP + ws）10/10：种计划→注册 A 选不同步→计划页空白→退出回本地→注册 B 选同步→计划出现。验证会生成 iso-a/b 两个测试账号，留在 `server/data/users.json` 与服务端内存（无删除接口，要清理需改文件后重启后端）。

- 胶囊导航（2026-11-08）：模仿参考图把桌面导航改成浮动白色胶囊——`margin:16px 24px 0`、`border-radius:18px`、柔和阴影、logo 与导航间竖线；7 个导航项改内联 SVG 线性图标（蓝/橙/绿/青/紫/蓝/灰），选中态用主题青绿胶囊 + 底部 2px 线，设置项 `margin-left:auto` 靠右并带分隔线；桌面 `--nav-h` 改 80px（16 外边距 + 64 高），登录页 `calc(100vh - var(--nav-h))` 仍成立。801–1120px 只留图标，1121–1280px 收紧文字，≤800px 保持原竖栏。品牌四宫格与站点青绿底色不跟随参考图的蓝 logo/蓝选中态，避免与全站主题冲突。（2026-11-13：导航精简为 7 项，设置项移出导航，见「第二期收尾」。）

- Gitee 备份（2026-11-08）：已 `git init -b main` 并完成首次提交 `7ab5d16`，推送到 `git@gitee.com:HTIANH-CN/aiweb-chuanzhi-cup-education.git`（网页地址 `https://gitee.com/HTIANH-CN/aiweb-chuanzhi-cup-education`）。`.gitignore` 追加 `.screenshots/`、`传智杯提交包/`、`传智杯提交包.zip`；受控 60 个文件，已确认不含 `.env` 与 `server/data/`。注意该仓库用未认证 API 查是 404，需人工确认它是否为 Public（比赛要求 Public 或提供评审访问权限）。
- 交接包（2026-11-11）：给队友继续完善的源码包在 `D:\trae-work\deliverables\20261111-交接包\ai-teach-交接-20261111.zip`（11.9MB，74 个受控文件，HEAD 7db5b64）。用 robocopy 白名单复制后排除 `.git`/`node_modules`/`dist`/`.env`/`server/data`/`.screenshots`/`传智杯提交包`/`中考`/`高考`；压缩必须用 `[System.IO.Compression.ZipFile]::CreateFromDirectory(..., [Text.Encoding]::UTF8)`，`tar -a -c` 写出的 zip 中文名是 GBK 乱码。`server/data` 用 robocopy `/XD server\data` 排除不掉，要复制后单独删。验证方式：解压到 tmp → `New-Item -ItemType Junction` 链到原 `node_modules` → `npm test`（61 通过）+ `npm run build`（28.8s 通过），清理 junction 用 `[System.IO.Directory]::Delete($path,$false)` 避免递归删到真实依赖。
- 踩坑（2026-11-08）：本机用户目录 `C:\Users\豪` 含中文，Git 自带 ssh 会把路径转成 `/c/Users/\272\300`，报 `Could not create directory '/c/Users/.../.ssh'` 与 `Host key verification failed`。解法：把 `gitee_ed25519` 和 `known_hosts` 复制到纯 ASCII 路径（现用 `D:\trae-work\tmp\gitee-ssh\`），再用 `GIT_SSH_COMMAND` 显式指定 `-i` 与 `UserKnownHostsFile` 推送；SSH 身份已验证为 `hao(@HTIANH-CN)`。
- 传智杯 AI Web 赛道规则（2026-11-08，来自官方规则截图）：评分权重 AI 技术深度 35%（LLM 集成 8 / Agent 与工作流 8 / RAG 6 / 多模态 5 / AI 安全可控 4 / MCP 或工具集成 4）、创新性 25%（选题 10 / 技术方案 8 / 交互模式 7）、前端工程 10%（代码质量 4，明确考察 TypeScript / 组件与架构 3 / 性能 3）、实用性 10%、用户体验 10%（UI 4 / 前端交互 3 / AI 交互 3）、社会价值与商业潜力 10%。提交物：代码仓库（Public 或提供评审权限、README 含团队信息、保留真实 Git 历史）、5–8 分钟 MP4≥1080p 演示视频、≤30 页 PDF 技术文档（含 AI 选型理由/集成方式/优化策略与创新点）、可选公网在线演示 + 测试账号；API 密钥不得进公开仓库，提交后不得修改。

- 流式答疑与思考可视化（2026-11-08）：新增 `POST /api/agent/tutor/stream`（SSE），`server/agent.js` 的 `streamAgent` 逐 token 产出 `thinking / token / tool / done / fallback`，工具调用轮先累积分片参数、校验后执行再继续生成；前端 `api.js` 的 `streamTutor` 逐帧解析，`AgentTrace.vue` 展示推理摘要与工具步骤（检索课标、复习间隔、专注记录、视觉状态）。图片答疑仍走一次性请求（体积大、模型兼容性更脆）。
- 踩坑（同日本机环境，已解决）：卡巴斯基 21.26 的「加密连接扫描」对 `api.deepseek.com` 做 MITM，系统 curl 正常但 Node 18 的 fetch 报 `SELF_SIGNED_CERT_IN_CHAIN`，表现为 SSE 接口 0.5 秒降级成 mock。2026-11-08 已在卡巴斯基界面关闭该扫描，Node 直连恢复正常（实测返回 401，真实流式 5.8 秒跑完），不再需要 `NODE_EXTRA_CA_CERTS`。CLI 的 `avp.com EXPORT` 因密码保护未启用而不可用，只能界面操作。

- 诊断雷达入场 + 平均掌握度滚动（2026-11-08）：ECharts 5.6 的雷达首次渲染没有过渡（`node_modules/echarts/lib/chart/radar/RadarView.js` 只有 `update` 分支走 `updateProps`，init 直接落点，`setOption(option, true)` 会反复走 init），所以 `ChartPanel` 加可选 `animateIn`：先 `setOption(零值 option, true)`，下一帧再 merge 真实值，配合 `series.animationDurationUpdate:900 / animationEasingUpdate:'cubicOut'` 让多边形和 symbol 从中心展开；零值化只处理 `series[].data[].value`（数组按原长度填 0），不传 `animateIn` 的图表（Dashboard 三维图）行为不变。`DiagnosisView` 的 `radarAverageShown` 用 rAF + cubicOut 在 900ms 内从 0 滚到平均掌握度，卡片入场用 CSS `chartReveal/cardReveal`（scoped 动画名带哈希后缀，断言要 `startsWith('chartReveal')`）。验证脚本 `D:\trae-work\tmp\verify-radar-reveal.mjs`（CDP+ws，15/15）实测数字 3%→6%、雷达 canvas 帧间指纹变化；摸底全蒙错时平均为 0、雷达只剩中心点，属数据而不是动画故障。工具经验两条：Element Plus 的 `el-select` 只 `click()` 不会展开，必须先派发 `mousedown`；browser_use 子代理在 EP 多步表单（下拉/答题/滚到底部提交）上极耗步数（3 次 60 步都没过关），这类走查直接写 CDP 脚本更快。

- 章节测试对错反馈动效（2026-11-08）：`QuizView` 结果页得分/正确率/客观题改由 `displayEarned/displayAccuracy/displayObjective` 显示，`rollStats()` 用 rAF + cubicOut 在 900ms 内插值（首次进结果页先归零再滚，主观题自评改分后从当前值滚到新值），靠 `watch(page)` 与 `watch(resultSummary, {deep:true})` 触发；逐题批改卡片 `.review-card` 用 `:style="{ animationDelay: Math.min(index,8)*60+'ms' }"` 做 stagger，判定标签 `.verdict-tag` 延迟 = 卡片延迟 + 260ms 再 pop。验证脚本 `D:\trae-work\tmp\verify-quiz-reveal.mjs`（CDP，11/11）：得分 1→4→6、正确率 4%→27%→40%，`quizCardIn`/`verdictPop` 动画名与 0s/0.12s 延迟均已生效。经验：轮询 `.result-layout` 间隔要 40ms，用 300ms 会错过 900ms 滚动窗口、误判成"没有动画"。

- 首页动效（2026-11-08）：`HomeView` 的 hero 文案用 `.hero-copy > *` + nth-child 延迟依次 `heroFade`；`.hero-visual/.map-card-main` 只做 opacity（它们自带 `transform:scale(.86)/rotate(-3deg)`，用 transform 动画会覆盖 base）；`.float-card` 用 `floatIn` + 0.5/0.6s 延迟；`.subject-card` 用内联 `animationDelay: min(index,9)*45ms` + `subjectIn`，动画一律 `backwards` 填充，避免覆盖 hover 的 `translateY(-5px)`。三个悬浮数字用 `displayStats` + rAF 900ms cubicOut 滚动，`rollHeroStats()` 在 `getHomeStats` 返回后调用。下方分区用 `.reveal` + IntersectionObserver（`rootMargin '0px 0px -8% 0px'`、threshold .12），隐藏样式挂在根节点 `.home-page.reveal-ready` 下，且先把视口内分区手动标记 `is-revealed` 再开 `revealReady`，避免闪一帧。验证脚本 `D:\trae-work\tmp\verify-home-reveal.mjs`（CDP，13/13）：注入一条 900 秒 focusSession 后今日专注 1→13→15，hero/悬浮卡/科目卡动画名与 0s/0.06s、0.5s/0.6s、0s/0.045s 延迟、滚动后 CTA 进场全部生效。

- 全站路由过渡（2026-11-08）：`App.vue` 的 `<router-view />` 改成 `v-slot` + `<transition name="page" mode="out-in">`，`:key="current.path"`（slot props 里把 `route` 重命名为 `current`，避免和 `useRoute()` 的 `route` 撞名）；过渡类放全局 `styles.css`（不放 App.vue 的 scoped，省得只对子组件根节点生效出意外）：enter 0.22s 淡入 + 上浮 8px、leave 0.14s 淡出，reduced-motion 下关闭。验证脚本 `D:\trae-work\tmp\verify-route-transition.mjs`（CDP，8/8）：`/home→/diagnosis` 采样到 leave 0.14s、enter 0.22s，返回首页同样，结束后无残留过渡类。经验：点击后 70ms 时路由可能还没切换，过渡类断言要看整个采样窗口而不是首帧；AppShell 导航是 `<button @click="router.push">` 不是 `<a>`，CDP 点心导航要选 `.side-nav nav button`。

- 摄像头 v2（2026-11-12）：`CameraMonitor.vue` 从 BlazeFace + TensorFlow.js 偏移量改为单次 `FaceLandmarker`（VIDEO、最多 2 脸、输出 blendshapes + 面部矩阵），新增 `src/vision/{metrics,oneEuro,attentionMachine}.js` 纯函数与 20 项单测。指标：blendshape 眨眼优先、六点 EAR 兜底（`eyeOpen = 1 - max(blinkL, blinkR)`），4x4 列主序矩阵取第三列解 yaw/pitch，One Euro 滤波。状态机 `focused / looking-away / head-down / drowsy / multiple / away`；只有 away 暂停计时，其余只提示并写 `visualLogs`；低头只提示坐直，不做玩手机判定。性能目标 12–15fps，单帧 EMA >150ms 自动回落 BlazeFace，模型加载失败也回落。已移除 `@tensorflow/tfjs`、`@tensorflow/tfjs-backend-webgl`；模型放 `public/models/face_landmarker.task`（3.7MB，本地打包）。验证：`npm test` 104 通过、typecheck/build 通过；headless Chrome + 假摄像头跑通模型加载 → 推理 → 10 秒离岗 → 暂停弹窗。踩坑：Chrome 默认假视频图案会被 BlazeFace 误检成人脸，验证离岗要用纯色 Y4M（`--use-file-for-fake-video-capture`）；headless CPU 推理约 200ms 会自动降级轻量模式，属预期。方向约定（2026-11-12，按真机反馈修正）：「低头为正、仰头为负」，`headPoseFromMatrix` 的 `pitch = asin(fy/|forward|)`（原为 `asin(-fy/…)`，真机上方向相反）；yaw 也取反为 `-atan2(fx,fz)`，因为预览是镜像（`scaleX(-1)`），约定「向右转头为正、向左为负」。`metrics.test.js` 用低头/仰头、左转/右转四组矩阵固化符号；`attentionMachine` 用 `|yaw|`，不受符号影响。
- 离线题库扩容（2026-11-12，`server/curriculum.js`）：`mathItems` 从 5 个专题的单题改为「专题 → 题目数组」，覆盖初一/初二/初三全部 26 个数学专题，新增 22 个专题 × 3 道原创单选题（容易/中等/困难，`difficulty` 1/2/3），共 66 题；初中数学任一专题首次摸底均返回客观题，不再直接落到自评题。选择规则：`step = (attempt−1) + index`，`variant = step % 6`（旧参数化变体保持 6 版），`base = items[step % items.length]`；同一专题题量超过题库条数或题干重复时仍回落自评题。`buildFallbackDiagnosticQuestions` 的题库查找删掉了 `key.includes(chapter.name.slice(0,4))` 模糊分支，避免「三角函数」「概率与统计」等高中专题误命中初中题库，只保留 `chapter.name.includes(key)`。诊断 UI 只渲染单选/自评，因此新题全部是单选题，多选题支持需另改 DiagnosisView。
- 学情诊断只做初中（2026-11-12，`DiagnosisView.vue`）：学段控件删除「高中」，改为「初中 · 年级」的 hover 下拉（初一/初二/初三），原来的「当前年级」下拉一并合并，选择网格改成两列；首次进入年级默认初一，旧档案的 stage 强制回到初中、非初中年级重置为初一；选择通过 `rememberGrade` 写入 IndexedDB profile（只覆盖 stage/grade，保留其他字段），刷新后恢复上次年级。浏览器实测：只显示「初中 · 初一」、hover 出现三个年级、选初二后刷新仍为初二。
- 首页标题防孤字（2026-11-12，`HomeView.vue`）：hero 标题字号由 `clamp(34px,4.5vw,59px)` 改为 `clamp(34px,3.9vw,59px)`，末尾「地图。」包进 `.hero-keep{white-space:nowrap}`，避免窄桌面出现单独一行「图。」；同时删掉 hero 说明里的「高中对齐新高考」，与只做初中的定位一致。`npm run build` 通过。
- 综合整卷（2026-11-13，第三期）：`/quiz?mode=paper` 与诊断页「综合整卷」入口；题量固定 25（选择 10×3 + 填空 6 + 解答 9），建议 90 分钟倒计时、归零自动交卷。满分口径集中在 `src/utils/quiz.js` 的 `PAPER_SPEC`：数学/英语 120，其余 100。服务端蓝图见 `server/quiz.js` 的 `PAPER_SCORE_PLANS`：120 分填空 3 分/解答 4,4,6,6,8,8,10,12,14；100 分填空 2 分/解答 2,2,4,6,6,8,8,10,12。整卷自动覆盖本年级本科目全部专题（服务端章节上限 16），每题分值以蓝图为准强制覆盖模型返回值；逐题请求模型会反复返回 `q1`，出题后必须按题位重发唯一 id。结果页新增选择/填空/解答分段得分率，`FocusView` 增加 `paper-quiz` 来源标签。出题超时放宽到 150 秒、预生成 170 秒。验证：`npm test` 110 通过、typecheck/build 通过；真实接口数学 25 题/120 分、物理 25 题/100 分且 id 唯一；浏览器实测整卷生成 25 题、倒计时 88:54、覆盖 9 个专题。踩坑：PowerShell 5 的 `Invoke-RestMethod` 发送中文 subject 会乱码，导致整卷按 100 分卷生成，接口验证改用 Node fetch + `JSON.stringify`。
- 自动交卷与草稿交互修复（2026-11-13）：`submitQuiz(force)` 加 `submitting / page / questions` 守卫 + `try/catch/finally`，自动交卷与手动交卷不会重复写库；自动失败不恢复计时（避免每秒重试刷提示），手动失败恢复计时。整卷剩余 10 分钟/1 分钟各提醒一次（`warnedTenMinutes / warnedOneMinute`），归零 `autoSubmitted=true` 后自动交卷。`exitQuiz` 确认框期间可能已自动交卷，确认后必须再判 `page==='quiz'` 才切页。草稿恢复时若已用 ≥90 分钟，`resumeDraft` 直接 `submitQuiz(true)` 出结果，不闪答题页；用时按 90 分钟封顶。`startQuiz` 在已有草稿时先确认覆盖；`recognizePhoto` 对只有 dataUrl 的照片重建 `File` 再 OCR。选择页草稿横幅对过时整卷显示「查看并交卷」。
- 试卷拍照识别（2026-11-13，第四期）：`/paper-scan` → `PaperScanView.vue`，nav 入口「试卷识别」。路线是「本地 OCR + 服务端文本拆题」，不用视觉模型：最多 6 页拍照/上传，前端 Tesseract `chi_sim+eng` 逐页 OCR（`extractQuestion(file, { timeoutMs })`，整页用 120 秒），文字可手改；`POST /api/agent/paper/parse`（`server/paper-scan.js`）用 `PAPER_PARSE_SYSTEM_PROMPT` 拆成 single/fill/short，模型不可用时 `fallbackPaperQuestions` 按题号本地拆并带 `notice`。拆题结果可折叠编辑题干/选项/答案/解析、删题，保存到 IndexedDB `scannedPapers`（DB_VERSION 6→7，备份 `BACKUP_VERSION` 5→6）。「开始练习」跳 `/quiz?scan=<id>`：`QuizView` 的 scan 模式直接载入题目、不组题、不写草稿、退出/再练回 `/paper-scan`；扫描题参考答案在 `answer` 字段，载入时给 short 补 `referenceAnswer`。答案不确定的题转自评题（选项拼进题干），判分/错题/专注建议复用现有链路。- 答疑双模式（2026-11-13，第五期）：`server/prompts.js` 拆成 `TUTOR_SYSTEM_PROMPT`（引导，禁止直接给答案）与 `TUTOR_EXPLAIN_PROMPT`（讲解，允许完整答案但必须按「考点 → 步骤 → 结论 → 易错点」），统一用 `tutorSystemPrompt(mode)` 选择；`/api/agent/tutor` 和 `/api/agent/tutor/stream` 都接收 `mode`（未知值按 guide），模型不可用时兜底话术也分模式。`guardTutorAnswer(text, { mode })`：explain 只做安全过滤 + 2400 字截断，guide 维持原拦截并新增「答案：」正则（原来只拦「最终答案：」）。前端 `TutorView` 顶部两个模式 chip，选择存 localStorage `ai-teach-tutor-mode`，流式/图片请求都带 mode，欢迎语、placeholder、快捷问题随模式变化；支持 `/tutor?q=` 预填，资料页可带问题跳转。验证：`npm test` 115 通过（新增双模式守卫测试）；真实接口 explain 返回完整步骤、guide 流式回答不直接给答案；浏览器实测模式 chip 切换与 placeholder 联动。
- 学习资料库（2026-11-13，第五期）：`/materials` → `MaterialsView.vue`，nav「学习资料」。后端 `GET /api/materials/chapter` 按章节聚合三块本地数据：本地题库 3 道典型例题（含答案/解析）、RAG 3 条真题片段（带出处）、课标相关知识点（前置章节 + `searchCurriculum` 匹配）；`GET /api/materials/search` 返回跨年级专题与真题片段。题库 key 为 `年级|科目|版本|章节id`，取不到时按同年级同科目同章节名回落，所以其他教材版本也能看到人教版例题。前端支持年级/科目/教材版本切换、关键词搜索、章节展开、例题答案默认折叠并高亮正确项，复用 `VideoSuggestion` 视频推荐，可跳 `/tutor?q=` 和 `/quiz`。验证：`npm test` 115 通过、typecheck/build 通过；接口实测 3 例题 + 3 真题 + 3 相关知识点、搜索命中跨年级专题；浏览器实测章节展开出现「典型例题 / 真题参考」。
- AI 周报（2026-11-13）：学习看板顶部新增「本周学习周报」卡片。前端固定聚合**近 7 天**（今天 0 点往前 6 天），不受顶部 14/30/90 天范围影响，依次汇总专注（分钟/次数/完成率/活跃天数/连续天数/较上周/主要分心/高效时段）、章节测试（次数/题量/加权正确率/上一周正确率）、错题 TOP3 章节、考试成绩（场次/平均得分率/最近一场），只上传聚合结果，不上传原始记录。`POST /api/agent/weekly-report`（`server/index.js`）用 `WEEKLY_REPORT_PROMPT` 走 `callDeepSeek`（`jsonMode`、`useTools:false`、`thinking:false`、`maxRounds:1`、45 秒），输出固定结构 `{headline,summary,strengths,risks,actions,closing}`。`server/weekly-report.js` 提供 `buildFallbackWeeklyReport`（无密钥/超时/解析失败时按同一结构本地生成，不编造数字）与 `normalizeWeeklyReport`（裁剪长度、条目上限 4、缺字段回落）。周报不自动生成，按钮「生成本周周报 / 重新生成」；结果按自然周缓存到 localStorage `ai-teach-weekly-report:<dataOwner>:<周一日期>`，刷新不重复调用模型，切账号不串数据。验证：`npm test` 132 通过（新增 5 项周报单测）、typecheck/build 通过；真实接口返回 AI 结构化周报；headless Chrome 种入 5 条专注/2 条测试/3 道错题/1 场考试后点击按钮，接口 200、周报正确反映 125 分钟、80% 完成率、75% 正确率、勾股定理错题与期中考试 83%，刷新后缓存命中，0 控制台报错。
- 周报二期：计划完成率 + 错题重做 + 一键转下周计划（2026-11-13）：① 计划记录新增 `completedAt`（手动归档写 `Date.now()`、取消归档写 `null`；`QuizView.applyQuizStageResult` 自动归档时也补写），周报口径 `completionRate = 本周完成 ÷ (本周完成 + 当前 active)`，桥接任务不计。② 错题改为「答对不删、标记消灭」：`QuizView.syncMistakes` 答错写入/更新 `correctIndex`、`redoCount`、`lastRedoAt`、`redoHistory[{at,correct}]`（最多 20 条）并清空 `fixedAt`；答对（`existing.quizId !== resultId` 判为重做）写 `fixedAt` 并保留记录。`MistakesView.vue` 重写：默认只列待消灭，统计条含待消灭/已消灭/近 7 天重做及正确率/近 7 天新增，新增「重做」弹窗（`correctIndex` 优先、老数据从「A. xxx」反推，填空/解答走自评）。`learningStats.wrongChapterRows` 与 `mastery.js` 扣分都跳过 `fixedAt`。③ 服务端 `weekly-report.js` 读 `plans` 与 `mistakes`（`unresolved/fixed/redos/redoCorrect/redoAccuracy`），headline 增加「消灭错题」「完成计划」分支，strengths/risks/actions/closing 都加对应规则；`prompts.js` 补充字段说明并禁止 redos=0 时编造重做数据。④ 新增 `src/utils/weeklyReportPlans.js`：`buildWeeklyPlanTasks` 把周报 actions 转成固定 id `weekly-<周一日期>-<序号>` 的复盘任务（`stage:'review'`、25 分钟、下周一 20:00、`source:'weekly-report'`），最多 3 条，同周重复点击覆盖更新；看板按钮「一键转下周计划 / 更新下周计划」写入后跳 `/plans`。验证：`npm test` 137 通过（新增转计划 4 项 + 服务端低完成率/低重做正确率用例），typecheck/build 通过；CDP 实测周报输出「计划完成率40%」「重做2次答对1次」、`plans:{active:3,completedThisWeek:2,completionRate:40}`、3 条 `weekly-*` 任务生成并跳转、错题重做答对后统计从待消灭 2/已消灭 1 变为 1/2 且近 7 天重做 2→3，0 控制台报错。
- 周报三期体验补强（2026-11-13）：① `weeklyReportPlans.js` 新增 `weekKeyOf`（自然周 key，看板缓存与计划页共用）、`staleWeeklyTasks`（`source:'weekly-report'`、未归档、id 中周 key 不是本周 → 过期）、`shouldPromptWeeklyReport`（周一 + 本周无周报 + 未关掉提示才为 true）。② 计划页：周报任务标题行显示「周报转来」标签；筛选行右侧出现「清空 N 条过期周报任务」，确认后删除过期未完成项，已归档与本周任务保留。③ 错题重做规则由「答对即消灭」改为「连续答对 2 次自动消灭」：新增 `src/utils/mistakes.js` 的 `correctStreak` 与 `AUTO_FIX_STREAK=2`，`MistakesView.persistRedo` 只在连续第 2 次答对时写 `fixedAt`，单次答对只记录进度并提示「再答对 1 次」；卡片显示「连续答对 1/2」标签，已消灭题再次重做不改变状态。④ 看板：周一首次打开、本周无缓存且未关提示时显示周报轻提示条（「现在生成 / 本周不再提示」），关闭状态写 `ai-teach-weekly-report-tip:<dataOwner>:<周一日期>`。验证：`npm test` 142 通过（新增周 key / 过期任务 / 周一提示 / 连续答对用例），typecheck/build 通过；CDP 实测 2 个「周报转来」标签、清理后只剩本周周报任务与普通任务、单次答对不消灭且连续第二次答对自动消灭（IDB `fixed:true`、redoCount 2）、周五看板不出现周一提示，0 控制台报错。
- 周报四期统一体验（2026-11-13）：① 错题消灭逻辑统一：`QuizView.syncMistakes` 答对分支也改为 `correctStreak(redoHistory) >= AUTO_FIX_STREAK` 才写 `fixedAt`，与错题本共用 `src/utils/mistakes.js`；章节测试再次遇到旧错题算一次重做事件，答错则 `fixedAt:null` 复活并中断连续计数。② 计划页自动提示：`PlansView` 挂载时若存在过期周报任务，弹「顺延到本周 / 清空」，顺延走新增的 `shiftWeeklyTasks`（重写为当前周 id、避开已有 id、reviewTime 改到下周一 20:00），关闭弹窗则写 `ai-teach-weekly-cleanup:<dataOwner>:<周key>` 本周不再自动弹；手动清理按钮保留。③ 周报提醒移到 `AppShell` 通知位：导航右侧铃铛（桌面 nav-actions / 移动 top-actions 各一份，同一状态），红点 + popover 通知面板，内容由 `shouldPromptWeeklyReport` 驱动；点击「去生成」跳 `/dashboard`，「本周不再提示」写 `ai-teach-weekly-report-tip:<dataOwner>:<周key>`；看板生成成功后派发 `ai-teach:weekly-report-updated` 事件让铃铛自动收起，Dashboard 内嵌提示已删除。验证：`npm test` 143 通过（新增 `shiftWeeklyTasks` 用例），typecheck/build 通过；CDP 实测自动弹窗文案与顺延结果（旧 id 删除、新 id `weekly-2026-11-9-2` 避开已有 `-1`）、刷新不再重复弹、看板无旧提示且铃铛存在、模拟周一时红点与面板出现且关闭后写 tip key，0 控制台报错。
- 周报五期通知中心（2026-11-13）：① 顺延上限：`weeklyReportPlans.js` 新增 `MAX_CARRY_WEEKS=2`、`carriedWeeksOf`，`shiftWeeklyTasks` 只顺延未达上限的任务并累加 `carriedWeeks`；计划页弹窗提示「其中 N 条已顺延 2 次，建议拆小或放弃」，任务行显示「已顺延 N 次」，达到上限显示「· 建议拆小」并停止自动顺延；处理过顺延/清空/稍后都会写 `ai-teach-weekly-cleanup` 键，本周不再自动弹。② 通知中心扩展：AppShell 铃铛聚合三类提醒——周一学习周报（`ai-teach-weekly-report-tip` 按周关）、今日计划（`src/utils/notices.js` 的 `duePlanCount`，今天已 `startedFocusToday` 则不催）、错题待巩固（`streakOneMistakeCount`，连续答对 1 次未消灭），后两类关闭写 `ai-teach-notice-dismiss:<owner>:<id>:<当天日期>`，只静音当天；「去生成 / 去计划 / 去重做」统一按 `notice.to` 跳转。③ 跨周刷新：AppShell 监听 `visibilitychange`、路由变化、`storage` 和 1 分钟 `weekKeyOf:todayKey` 戳比对，页面跨周/跨天常驻也会自动重算通知。验证：`npm test` 147 通过（新增通知计数 3 项与顺延上限 1 项），typecheck/build 通过；CDP 实测顺延上限弹窗文案、任务 A 顺延后 `carriedWeeks=1`、任务 B 保持原 id 且标签「已顺延 2 次 · 建议拆小」、通知中心同时显示今日计划 3 条与错题 1 条、关闭今日计划后刷新仍静音而错题提醒保留、模拟周一切换后通知自动出现周报提醒，0 控制台报错。
- 周报六期通知精修（2026-11-13）：① 今日计划只点名最靠前的一条：`notices.js` 新增 `nextDuePlan`（今天是截止口径，按 `reviewTime || createdAt` 从早到晚排），AppShell 文案改为「先做「任务名」，今天还有 N 条计划任务待完成」。② 通知固定优先级：`NOTICE_PRIORITY = { plan:10, staleMistake:20, streak:30, weekly:40 }`，`buildNotices` 过滤静音键后按 `priority` 升序排序；通知项新增 `scope:'day'|'week'`，铃铛角标只统计 `scope==='day'`（`dailyNoticeCount`），周报不再计入红点但仍在面板里。③ 长期未复习错题：`notices.js` 新增 `STALE_MISTAKE_DAYS=7` 与 `staleMistakeCount`（未消灭、连续答对 <1、最近重做或创建时间超过 7 天），单独一条「错题该复习了」通知；连续答对 1 次的题只走「待巩固」，避免重复提醒。验证：`npm test` 149 通过（新增 `nextDuePlan` 与 `staleMistakeCount` 两项），`npm run build` 通过（17.68s）；CDP 实测今日计划只点名「勾股定理复盘」并显示共 2 条、面板顺序为今日计划 → 错题该复习了（2 道）→ 错题待巩固（1 道）、角标 3；关闭今日计划后角标降为 2；模拟周一后周报排最后且角标仍为 2（周报不计入红点），0 控制台报错。
- 周报七期通知闭环（2026-11-13）：① 跳转筛选：`notices.js` 抽出 `isStaleMistake`（7 天未重做、未消灭、连续答对 <1），通知与错题页共用；「错题该复习了」的 `to` 改为 `{ path:'/mistakes', query:{ filter:'stale' } }`，`MistakesView` 初始化读 `route.query.filter` 并 watch 后续变化，状态筛选新增「超 7 天未复习」选项，空态有单独文案。② 角标颜色：`AppShell` 按最靠前的当天事项计算 `noticeBadgeTone`，`.is-plan` 红 `#e05a5a`、`.is-stale` 橙 `#f08c3a`、`.is-streak` 黄 `#d9a521`。③ 一键静音：面板底部「今天全部不再提示」批量写所有 `scope:'day'` 通知的当天 dismiss 键并清空角标，周报不受影响。验证：`npm test` 149 通过、`npm run build` 通过（14.70s）；CDP 实测初始角标 `3 + is-plan`，关闭今日计划后变 `2 + is-stale`，点「去复习」跳到 `/mistakes?filter=stale` 且筛选显示「超 7 天未复习」、列表只剩 10 天/8 天两条，点「今天全部不再提示」后面板为空、角标消失、写入 today-plan/mistake-stale/mistake-streak 三个当天静音键，0 控制台报错、0 失败请求。
- 周报八期 / 初中生 UI 接管（2026-11-13）：① 今日计划通知 `to` 带 `focusTask`，`PlansView` 新增 `focusTaskFromQuery`：切到「进行中」、展开对应科目、`scrollIntoView` 并给任务行加 `.is-highlighted`（2.8 秒后淡出，`prefers-reduced-motion` 关闭动画）。② 周报通知 `to` 带 `focus=weekly-report`，`DashboardView` 通过 `weeklySection` ref 滚动并加 `.is-focused` 高亮，`scroll-margin-top:104px` 避开吸顶导航。③ 批量静音后 `hasDismissedToday` + 「恢复今天的提醒」可清掉当天三个固定 dismiss 键并重新拉取通知；面板底部改为 `.notice-footer`。④ 初中生 UI：`styles.css` 换亮蓝→紫蓝品牌色、暖橙强调色、蓝紫光晕背景、20px 圆角、30px 页面标题、15px 副标题、全局 `:focus-visible` 焦点环、页面底部 104px 留白避免反馈小精灵挡内容；深色模式同步并提亮 `--primary:#6b9bff`；AppShell 导航字号 14.5px、通知面板 320px 宽、通知文字加大，移除登录后多余的「已登录」标签只保留「本地模式」提示。验证：`npm test` 149 通过、`npm run build` 通过（17.16s）；CDP 实测通知顺序正确，点「去计划」得到 `?focusTask=seed_early` 且目标行高亮、科目展开，点「去生成」得到 `?focus=weekly-report` 且周报卡片高亮，批量静音后出现恢复入口、恢复后角标回到 3 且当天静音键清零，0 控制台报错、0 失败请求；桌面 1440×900 截图确认导航 14.5px、页面底部留白 104px。
- 周报九期 / 首页今日行动卡 + 深色图表（2026-11-13）：① `PlansView.focusTaskFromQuery` 在 `nextTick` 里对 `[data-plan-start]` 调 `.focus({preventScroll:true})`，通知跳转后键盘/读屏用户一次 Tab 都不用按。② `HomeView` 新增「今天先做这一件」卡：`homePlans` + `starterPlan`（优先 `nextDuePlan`，没有到期任务退回顺序最靠前的 active 非桥接任务）、`starterIsDue` 区分「今天到期 / 提前开始」文案，主按钮 `store.setPlans` 后跳 `/focus?planId=`，次按钮跳 `/plans?focusTask=`。③ 修掉一个真实 bug：卡依赖 plans 才有 DOM，`setupReveal()` 原来在设置 `homePlans` 后同一 tick 执行，观察器扫不到这张卡，卡片会永远停在 `opacity:0`；改为 `await nextTick()` 再注册观察。④ `ChartPanel.vue` 补深色图表对比度：`themedOption` 按 `data-theme` 注入 `textStyle`/轴 `axisLabel`/`axisLine`/`splitLine`/`legend.textStyle` 颜色，`MutationObserver` 监听 `data-theme` 变化重画；浅色模式原样输出。验证：`npm test` 149 通过、`npm run build` 通过（17.54s）；CDP 实测 `/plans?focusTask=seed_early` 高亮且 `document.activeElement` 为「开始专注」按钮，首页卡片浅色/深色均 `opacity:1`、`is-revealed`、深色标题 `rgb(232,238,251)`、左侧主色边 `rgb(107,155,255)`，点主按钮落到 `/focus?planId=seed_early`，深色看板 6 个 canvas、0 个白底卡片、轴文字与图例清晰可读，0 控制台报错、0 失败请求。摄像头预览是原生 `<video>`，深色下不叠加遮罩也不改色，无头环境无法授权摄像头，未做截图实测。
- 周报十期 / 首页剩余任务 + 卡通小精灵（2026-11-13）：① `notices.js` 新增导出 `todayDuePlans`（直接复刻内部 `duePlans` 口径），首页今日行动卡下方加「今天还有 N 条」微列表：最多 3 条任务胶囊（名称走 `formatMathText`，附预计分钟），超出显示 `+N`。② 深色地图卡样式改放到 `styles.css`：写成 `:root[data-theme='dark'] .home-page .map-card-main` 等；原先写在 `<style scoped>` 里的 `:global(:root[data-theme='dark']) ...` 在编译后整段没进 CSSOM（实测查不到规则），改全局 + 加 `.home-page` 提权后稳定生效。③ 手机端横向溢出修复：`@media(max-width:600px)` 隐藏 `.orbit`、`.hero-visual` 负边距 `-25px` → `-8px`、地图卡 `350px` → `320px`、`.home-hero>*{min-width:0}`；390×844 下 `scrollWidth = clientWidth = 390`（修复前 451）。④ 新增 `src/components/SparkMascot.vue`：纯 SVG 卡通角色，待机浮动 + 定时眨眼 + 摆手 + 天线星闪烁，`busy` 时加速，`useId` 生成唯一渐变 id，`prefers-reduced-motion` 关闭动画；悬浮按钮改为 66px 圆形渐变底座（原为 ✦ 胶囊），面板头部复用 36px 版本；收起时轮换 4 条气泡文案，9 秒后自动收起（`is-muted`），悬停/聚焦重新出现。验证：`npm test` 149 通过、`npm run build` 通过（17.68s）；CDP 实测深色 `mapBg = linear-gradient(145deg, rgb(36,50,72), rgb(27,40,54))`、标题 `rgb(232,238,251)`、节点/浮卡均换深色；手机端 390 宽无横向滚动，FAB `right=376 / bottom=830`，与行动卡按钮不重叠；气泡 `opacity 1` → 9 秒后 `0` 且 `pointer-events:none` → 悬停 FAB 恢复 `1`；控制台 0 报错。

- 十一期 / 手机端底部标签栏 + 小精灵场景建议（2026-11-13）：① `AppShell.vue` 新增 `.mobile-tabbar`，≤800px 隐藏左侧 67px 图标栏，改由底部 6 个入口（主页/资料/错题/计划/专注/答疑，`short` 短标签）接管导航；学情诊断不占标签位，由首页大按钮承接；选中态浅色胶囊 + 主色，`env(safe-area-inset-bottom)` 适配刘海屏，`.main-content` 加 64px 底部留白，专注页（`focus-shell`）不渲染标签栏；≤600px 顶部栏收紧按钮内边距，避免通知/设置/登录挤爆。② `SparkAssistant.vue` 的提示文案改为「页面建议 + 时段建议」：`pageMeta` 每页新增 `tips`，`SLOT_TIPS` 按 morning/noon/afternoon/evening/night（5–11/11–14/14–18/18–23/其余），`restartTip()` 在路由切换时重置索引并重新显示 9 秒，7 秒轮换一次并顺带刷新时段；手机端整体上移到标签栏上方（`bottom:76px + safe-area`），面板宽 `100vw-28px`、高度收紧。验证：`npm test` 149 通过、`npm run build` 18.05s；CDP 390×844 实测标签栏 6 项、`scrollWidth=clientWidth=390`、FAB 与标签栏间距 15px、首页提示「今天只定一个 25 分钟的小目标」、点「计划」后变「先做预计 25 分钟能做完的那条」且选中态跟随、面板 362px 不越界，桌面端 `tabbar=none / side-nav=flex`，0 控制台报错。

- 十二期 / 番茄钟专注页 + 三平台联动（2026-11-13）：① `FocusView.vue` 按番茄 Todo 重构：番茄红 `#ef5b52` 主题（同时覆盖 Element Plus 主色）、左上番茄 logo、顶部「今日 N 个番茄 · X 分钟」、大白卡 + 中央 470px 粗圆环（`#fbe3de` 轨道 + 8px 红进度环）、圆环内用 CountdownTimer 翻牌数字、单一 94px 圆形主按钮（开始/暂停切换为描边白底）、胶囊时长预设（25/40/45/60/自定义，选中红底）、右侧「本次状态/近 7 天热力/摄像头/提示」四张卡；≤1000px 单列、≤640px 圆环 330px、底部留白 104px；专注页隐藏全局 FeedbackWidget。② `src/utils/liveFocus.js` 跨页面专注快照（localStorage `ai-teach-focus-live`，`baseRemaining/startedAt/running/sessionStartedAt`，6 小时过期，`liveRemaining` 按时间推算），FocusView 在开始/暂停/每 15 秒/离开页面写入，返回时恢复任务、时长、剩余并继续计时，离开期间走完的自动补记完成记录；AppShell 手机端标签栏上方常驻胶囊显示任务名 + 实时剩余 + 专注中/已暂停，点击回专注页。③ 底部标签栏角标：`/plans` 显示今日待办数、`/mistakes` 显示未消灭错题数（>99 显示 99+）。④ 小精灵接入真实数据：`liveTip` 优先读 plans/mistakes/focusSessions，按「今日计划 → 超 7 天错题 → 今日已专注分钟 → 页面/时段建议」排序，路由切换与 storage/visibility 变化时刷新。验证：153 项单测通过、typecheck 通过、build 17.67s；CDP 390×844 + 1440×950 实测角标 3/2、真实提示「今天还有 3 条计划，先做「数学·一元二次方程复盘」」、开始后离开页面胶囊 24:55→24:52 递减、点回专注页恢复为「暂停」且继续计时、手动暂停后胶囊显示「已暂停 24:49」，0 控制台报错。

- 十三期 / 番茄循环 + 胶囊直控 + 番茄成果进看板（2026-11-13）：① `FocusView.vue` 补完整番茄循环：`onTimerComplete` 落库后 `showCelebration()`（`pomo-celebrate` 浮层，「番茄 +1 / 专注 N 分钟，奖励 5 分钟休息」，2.4s 自动收起、`pointer-events:none`，`celebrateTimer` 在卸载时清理）+ `startBreak()`（独立 `setInterval`，`BREAK_SECONDS=300`，`breakRemaining/breakRunning`，圆环切绿 `#4f9d7f`）；休息态渲染 `.break-face`（☕ + `formatClock` + 提示），操作区换成「下一轮 / 暂停休息 / 跳过休息 / 写反馈」，状态徽章区分「休息中 / 休息暂停」；休息不写 `focusSessions`，只做视觉与节奏。手机端（≤640px）庆祝浮层改到底部，避免盖住顶部整行操作区。② `AppShell.vue` 胶囊拆成 `.live-pill-main`（回专注页）+ `.live-pill-toggle`（❚❚/▶），`toggleLiveFocus` 只改快照的 `running/startedAt/baseRemaining` 并广播 `ai-teach:focus-live-updated`，不跳页就能暂停/继续。③ 番茄成果进两处：`HomeView` 新增 `todayPomodoros = floor(todayFocusMinutes / 25)` 写进悬浮卡「累计 X 分钟 · N 个番茄」；`DashboardView` 在 `focus-kpis` 首位加「今日番茄」卡（`todayPomodoro` 只算当天 `createdAt`，foot 显示今日分钟数），桌面 4 列、手机 2 列且最后一张 span 2 补齐。验证：`npm test` 153 通过、typecheck 通过、build 17.93s；CDP 390×844 实测把倒计时压到 3 秒走真实 complete 路径 → 庆祝浮层 + 05:00→04:58→04:56 递减 + 暂停休息冻结 + 跳过休息回「待开始」且番茄数保留；胶囊 ❚❚→「已暂停 24:55」冻结→▶ 继续后 24:53；首页两处「2 个番茄」、看板首卡「今日番茄 2 个 / 今日专注 50 分钟」，`scrollWidth = clientWidth = 390`，桌面 4 列无溢出，0 控制台报错。

- 十四期 / 电脑端交互补齐（2026-11-13，老大要求「之后只完善电脑端交互」）：① `AppShell.vue` 桌面端（≥801px）把手机胶囊复用为底部居中悬浮计时器（`position:fixed; left:50%; bottom:22px; translateX(-50%)`，避开右下角小精灵与左下意见反馈），主区回专注页、右侧 ❚❚/▶ 直接暂停继续；`.live-pill-dot/.live-pill-text/@keyframes livePillPulse` 提到基础层，手机块只留定位。② 全局快捷键：`onShortcutKey` 数字 1–7 直达主导航（专注页与 `input/textarea/select/contenteditable/.el-overlay/[role=dialog]/.el-select__wrapper` 内不抢键，Ctrl/Meta/Alt 组合放行），导航按钮 `title` 改为「页面 · 快捷键 N」。③ 可发现性：导航右侧新增键盘图标 `el-popover` 快捷键面板（1–7 切页 / 空格 / F / Esc，`kbd` 键帽样式）；专注页底部加 `.pomo-keys` 文案提示，仅 ≥801px 显示。④ `FocusView.vue` 快捷键：空格 开始/暂停、休息态空格 = 下一轮、F 全屏（Esc 交浏览器原生），在 `button/a/[role=button]` 上保留原生行为，挂载/卸载成对增删 `keydown`。验证：153 项单测、typecheck、build 17.67s 全过；CDP 1440×950 实测数字 4/7/6 切到 /mistakes /tutor /focus、textarea 内按 5 只输入不跳页（失焦后 5 → /plans）、空格 25:00→24:58 后暂停冻结、F 进入全屏、离开专注页后胶囊在视口正中（left 564/right 876，center 720）24:55 显示且 ❚❚/▶ 正常、点主区回专注页，0 控制台报错。

- 十五期 / 电脑端列表键盘化 + 面板入口（2026-11-13，延续「只完善电脑端」）：① `PlansView.vue`：`focusedPlanId` + `keyboardPlans`（只含已展开科目的非衔接任务，列表空时按 ↓ 自动展开全部科目），`onPlanKeydown` 支持 ↑↓/J K 选择、Enter `startFocus`、E `toggleArchive`、Esc 取消，输入框/按钮/弹窗/下拉内不抢键且仅 ≥801px 生效；行加 `.plan-row.is-focused` 描边（≤800px 取消，手机端点选不留痕），选中后 `scrollIntoView({block:'nearest'})`，`.plan-hint` 追加蓝色「电脑端：↑↓ 选任务 · Enter 开始专注 · E 完成并归档」。② `MistakesView.vue`：`focusedId` + `moveFocused`（↑↓/J K）、Enter `openRedo`、M 手动消灭（新增 `markFixed` 写 `fixedAt=now` 后 `load()`，卡片加「标记已消灭」文字按钮）、Esc 取消，`.record.is-focused` 描边同样只在桌面端，页面上方加 `.key-hint` 提示。③ `AppShell.vue`：Shift + /（`event.key === '?'`）切换快捷键面板，面板补 `Shift+/`、`↑↓`、`Enter` 三行。④ 原「计划卡 hover 详情」未做：计划行本来就显示 ⏱ 预计时长、知识点标签、🔁 复习时间，再加 hover 面板是重复信息。验证：153 单测、typecheck、build 17.65s 通过；CDP 1440×950 实测 ↓ 自动展开 3 个科目并选中「数学·一元二次方程复盘」、再 ↓ 切到「已归档任务」、Enter 跳 /focus；E 后 `track-node done`、再 E 恢复 `current`；错题页 J 选中、M 后待消灭 2→1、已消灭 0→1 且有 toast（测试后已用 IndexedDB 把 fixedAt 还原）；Shift+/ 开面板、再按一次关闭，0 控制台报错。

- 十六期 / 电脑端一屏化 + 错题搜索筛选 + 全屏光标隐藏（2026-11-13，仍只改桌面端）：
  - ① 计划页右栏（`PlansView.vue`）：原任务列表改为 `grid-template-columns: minmax(0,1fr) 268px`（`.plans-columns`），右栏 `.plans-aside{position:sticky;top:86px}` 放「今天先做这些」——`todayDuePlans(plans).slice(0,4)` 最多 4 条，点击直接 `startFocus(task)` 跳 `/focus?planId=`；底部番茄条读 `loadFocusSessions()` 当天 `actualSeconds` 求和，显示「🍅 N 个番茄 · 今日专注 X 分钟」。`@media(max-width:1100px)` 回退单列并 `display:none` 隐藏右栏，所以 ≤1100px（含手机）看不到，不改动原有布局。数据在 `onMounted` 的 `promptStaleWeeklyTasks()` 之后 `await loadTodayFocus()` 加载。
  - ② 错题页搜索 + 数字筛选（`MistakesView.vue`）：`.filters` 首位新增 `el-input`（`ref="searchInput"`，宽 200px，占位「搜索题干 / 章节 / 知识点」），`matchesKeyword` 匹配 `stem/text/subject/chapterName/correctAnswer/knowledgeTags`，忽略大小写与空串；`/` 聚焦搜索框，`1/2/3` 切「全部/待消灭/已消灭」。`.mistake-search` 在 `@media(max-width:850px)` 下 `display:none`，手机端保持原样。
  - ③ **抢键关键机制**：`AppShell` 的全局 `keydown` 在应用启动时就注册，页面级监听在路由切换后才注册，冒泡阶段永远晚于 AppShell，数字键会先被导航吃掉。修法是页面改**捕获阶段**监听：`window.addEventListener('keydown', onMistakeKeydown, true)`，先 `preventDefault()`，AppShell 的 `onShortcutKey` 开头检查 `event.defaultPrevented` 就会放行。以后任何页面要抢全局数字/符号键，都按这个写法。
  - ④ 专注页全屏光标（`FocusView.vue`）：`cursorIdle` + `wakeCursor()`，仅在 `document.fullscreenElement` 存在时挂 3 秒定时器；`mousemove/mousedown/fullscreenchange` 唤醒；根节点绑 `is-cursor-idle`，样式 `.focus-page.is-cursor-idle, .focus-page.is-cursor-idle *{cursor:none}`；`onBeforeUnmount` 清定时器。
  - 验证：`npm test` 153 通过、`npm run typecheck` 通过、`npm run build` 17.80s 通过；CDP 1440×950 实测右栏宽 268px、left 1014、与列表间距 18px，显示 3 条到期任务与「🍅 2 个番茄 今日专注 50 分钟」，点任务落 `/focus?planId=v-plan-1`；`/` 后 `activeElement` 为 `el-input__inner`，关键词筛选生效、清空回 2 条；`2/3/1` 连续按下 `path` 始终 `/mistakes` 且状态依次 待消灭→已消灭→全部，切到 `/home` 再按 `2` 正常跳 `/diagnosis`（导航未被破坏）；`F` 全屏 3.4 秒后出现 `is-cursor-idle`，`mouseMoved` 后消失，退出全屏不再隐藏；0 控制台报错。

- 十七期 / 电脑端三条建议收尾 + 全站圆角体系（2026-11-13）：
  - ① 计划页右栏中段断点：`PlansView.vue` 新增 `@media(min-width:1101px) and (max-width:1280px)`，右栏 `268px → 220px`、任务按钮内边距收紧、番茄条 `flex-wrap:wrap` 且「今日专注」换行占满一行；>1280px 仍是 268px，≤1100px 仍隐藏。实测 1200 宽下右栏 `width=220` 且可见。
  - ② 快捷键面板上下文键位：`AppShell.vue` 新增 `contextShortcuts`（`/mistakes` → `/` 搜索、`1/2/3` 全部/待消灭/已消灭、`M` 标记已消灭；`/plans` → `Enter` 开始专注、`E` 完成并归档），面板底部加 `.shortcut-context`（虚线分隔 + 「当前页面」标题），避免全局数字跳页与页内数字筛选语义冲突。实测 `/mistakes` 面板出现三行上下文键位。
  - ③ 全屏光标只在计时中隐藏：`FocusView.wakeCursor` 增加 `running || breakRunning` 条件，并加 `watch(() => running || breakRunning, wakeCursor)`，暂停立刻恢复光标。实测全屏待机 3.6 秒 `idle=false`、开始后 `idle=true`、再暂停 `idle=false`。
  - ④ **全站圆角体系**（老大要求「全部棱角改成有弧度」）：`styles.css` 的 `:root` 新增 `--radius-xs/sm/md/lg/pill`（8/12/16/20/999）并把 `--el-border-radius-base` 10→12、`--el-border-radius-small` 10、`--el-border-radius-round` 999、`--el-tag-border-radius` 8、`--el-checkbox-input-border-radius` 6；统一补 Element Plus 默认直角容器的弧度：`.el-dialog`22px+`overflow:hidden`、`.el-message-box`20px、`.el-message`14px、`.el-notification`16px、`.el-alert`12px、`.el-collapse`16px（含首尾 item）、`.el-popover/.el-dropdown-menu/.el-picker-panel/.el-select-dropdown`16px、`.el-tooltip__popper/.el-popper.is-dark`10px、`.el-upload-dragger`16px、`.el-segmented`999、`.el-button--small`10px、`.el-checkbox__inner`6px、`.el-table`16px、`.el-tag`8px（EP 的 `--el-tag-border-radius` 定义在组件自身作用域，根变量覆盖无效，必须写直接选择器）。手写小圆角一并上调：mastery 进度条 4→999、kbd 6→8、folder-toggle 6→8、option-badge/option-key 6→8、解析行 7→10、聊天气泡 5/16→8/18、图片缩略 7→10、流式光标 2→999、番茄小徽标 4→8、番茄叶子 1px 底角→3px。
  - 验证：`npm test` 153 通过、typecheck 通过、build 17.53s 通过；CDP 全站审计（/home /plans /mistakes /diagnosis /materials /quiz /dashboard /tutor /settings /account /paper-scan）遍历所有可见元素，除「只有一条分隔边框、无底色」的 `.brand` / `.nav-actions` / `.map-progress` / `.shortcut-context` 外，已无 `border-radius:0` 且有底色/多边框的直角块；实测 `.el-tag` 4→8px、`.el-dialog` 22px、`.el-button` 999px、input/select 12px、`.surface` 20px、popover 16px；0 控制台报错。

- 十八期 / 阴影配圆角 + 标签胶囊 + 手机安全区（2026-11-13）：
  - ① 阴影：`--shadow` 从单层 `0 14px 34px rgba(46,84,145,.10)` 改为「大扩散 + 低透明」双层 `0 18px 44px rgba(46,84,145,.08), 0 3px 10px rgba(46,84,145,.04)`，与 20px 圆角配套；深色模式单独一档 `0 20px 46px rgba(0,0,0,.34), 0 3px 10px rgba(0,0,0,.22)`（原来是 `.22` 单层）。`AppShell` 桌面 `.side-nav` 与 `FocusView .pomo-side-card` 的硬编码旧阴影改为 `var(--shadow)`。注意 `.home-page .welcome-strip.surface` 是刻意 `box-shadow:none` + 17px 圆角的柔和条，不是漏配。
  - ② 标签胶囊：`--el-tag-border-radius` 与全局 `.el-tag{border-radius:999px}` 都改为 999px（EP 的变量在组件作用域，必须同时写直接选择器才稳妥）。
  - ③ 手机安全区：`index.html` viewport 补 `viewport-fit=cover`（否则 iOS 上 `env(safe-area-inset-*)` 恒为 0，这是原先所有安全区写法实际不生效的根因）；`.mobile-tabbar` 补左右 inset；`.topbar` 手机端补 `safe-area-inset-top` 与左右；`.page` 手机端左右改为 `calc(13px + env(...))`；`.live-focus-pill`、`.spark-assistant` 补左右 inset。
  - ④ 修复被标签栏盖住的两个浮层：`.feedback-entry` 手机端原来 `left:79px;bottom:14px`（在 tabbar 后面，点不到），改为 `left:calc(14px + env(safe-area-inset-left));bottom:calc(132px + env(safe-area-inset-bottom))`，落在专注胶囊上方；`.quiz-float` ≤560px 原来 `bottom:12px`，改为 `calc(146px + env(safe-area-inset-bottom))`，落在小精灵（66px 高、bottom 76px）上方 4px。
  - 验证：153 单测、typecheck、build 通过；CDP 1440×950 读到 `--shadow` 亮/暗两套值、真实卡片（`.today-focus.surface`）计算值为双层新阴影、`.side-nav` 同步；`.el-tag` probe 与真实标签均 999px。CDP 390×844 模拟：tabbar 顶 783、feedback 底 712、spark 底 768，feedback/spark 均在标签栏之上且 feedback 高过专注胶囊 lane；`pagePadding 18px 13px 104px`、`tabbarPadding 6px 8px`（env 在模拟器里为 0，规则文本已确认含 `safe-area-inset-*`）；viewport 已含 `viewport-fit=cover`；0 报错。真机刘海值 CDP 无法模拟，需在 iPhone 上肉眼确认一次。

- 十九期 / 深色描边调淡 + 反馈按钮按状态让位（2026-11-13）：
  - ① 深色描边：`styles.css` 深色变量 `--border` 与 `--el-border-color` 从 `#2f4058` 统一调淡到 `#253246`（与 surface `#1c2839` 的对比降低一档，避免黑底亮框过硬的观感）。Element Plus 全部走变量，改一处即可。
  - ② 反馈按钮悬空：`FeedbackWidget.vue` 新增 `raised` prop，根节点绑 `.is-raised`；手机端默认 `bottom:calc(76px + env(safe-area-inset-bottom))` 贴标签栏，`.is-raised` 才上移到 132px。`AppShell.vue` 传 `:raised="Boolean(liveFocus)"`——有跨页专注胶囊时才让位。
  - 验证：CDP 390×844 空状态 `raised=false`、反馈底 768 / 标签栏顶 783（15px 间距）；写入暂停中的 `ai-teach-focus-live` 快照刷新后 `raised=true`、反馈底 712 / 胶囊顶 728（16px 间距）；深色下 `.surface` 与 `.mobile-tabbar` 的 border 计算值均为 `rgb(37,50,70)`、`--el-border-color` 为 `#253246`；153 单测、typecheck、build 16.11s 通过，0 报错。

- 二十期 / 主题回退青绿（2026-11-13，老大原话「还是改回原来的绿色色调吧，蓝色我看起来不是很顺眼」）：
  - ① **根因**：全站一直没覆盖 `--el-color-primary`，Element Plus 按钮/输入框焦点/开关实际用的还是默认蓝 `#409eff`，「蓝色不顺眼」主要来自这里。本次在 `styles.css` 的 `:root` 与 `:root[data-theme='dark']` 各补一整套 EP 主色：亮色 `--el-color-primary:#4d8d8e` + light-3 `#82afb0` / light-5 `#a6c6c7` / light-7 `#cadedd` / light-8 `#dbe9e9` / light-9 `#edf5f5` / dark-2 `#3e7172`；深色 `#6fb6b3` + light-3 `#65a6a3` / light-5 `#548c8a` / light-7 `#3f6a69` / light-8 `#355955` / light-9 `#2b4747` / dark-2 `#8ac4c1`。
  - ② 色值回到基线（`git show HEAD:src/styles.css`）：亮色 `--bg:#eff6f7`、`--surface:#fff`、`--surface-soft:#f7fbfb`、`--text:#243746`、`--muted:#71828a`、`--primary:#4d8d8e`、`--primary-soft:#dff0ef`、`--accent:#eea77b`、`--border:#d8e7e7`、`--brand-gradient:linear-gradient(135deg,#4d8d8e,#327a8e)`；深色 `--bg:#17272e`、`--surface:#21363e`、`--surface-soft:#1d3037`、`--text:#e6f0ef`、`--muted:#a6babd`、`--border:#37535b`、`--primary:#6fb6b3`、`--primary-soft:#294b4c`。**不整文件回滚**，保留近期的 20px 圆角体系、双层阴影、安全区与 raised 逻辑。
  - ③ 硬编码映射：阴影/描边 `rgba(46,84,145,…)` → `rgba(53,91,102,…)`（AppShell 胶囊、SparkAssistant 浮球/面板、FeedbackWidget）；焦点环与光晕 `rgba(61,123,253,…)` → `rgba(77,141,142,…)`（`styles.css :focus-visible`、`DashboardView .weekly-report.is-focused`、`PlansView @keyframes planGlow`）；精灵 `SparkMascot.vue` 渐变 `#7fc4a8/#5e9f8f/#327a8e`、四肢 `#9bc6b9`、触角 `#b7ddd3`、眼珠/嘴 `#23383a`；`SparkAssistant .spark-fab` 青色球体；`ChartPanel` 深色轴文字 `#a6babd`、轴线 `#37535b`、图例 `#c2d2d4`；深色首页 `.map-card-main` 青绿描边 + `.float-card` `rgba(33,54,62,.92)`。`AppShell` 导航图标 `#2f6fed`/`#8b5cf6` 是基线的彩虹图标配色，**保留不动**。
  - 验证：`npm test` 153 通过、typecheck 通过、build 22.88s 通过；CDP 1440×950 读到亮色 `primary=#4d8d8e`、`bg=#eff6f7`、`border=#d8e7e7`、`elPrimary=#4d8d8e`、`bodyBg=rgb(239,246,247)`、主按钮 `rgb(77,141,142)`、标签 999px；深色 `bg=#17272e`、`surface=#21363e`、`border=#37535b`、`primary/elPrimary=#6fb6b3`；精灵三档 stop 与青绿浮球渐变生效；`/focus` 仍是番茄红 `#ef5b52` 未被覆盖；0 控制台报错。`index.html` 的 `theme-color:#eff6f7` 与 favicon 本来就是绿色系，未改。

- 二十一期 / 专注空间青柠主题（2026-11-13，老大要求「专注空间的色调与网页主色调一致，把番茄换成青柠」）：
  - ① 局部主题变量整块替换（`FocusView.vue` 的 `.focus-page`）：`--pomo/--primary/--el-color-primary` 全部对齐全站 `#4d8d8e`，派生 `--pomo-deep #3e7172`、`--pomo-soft #dff0ef`；`--surface #fff`、`--surface-soft #f6fbfa`、`--text #243746`、`--muted #71828a`、`--border #d8e7e7`、`--shadow` 用全站双层阴影；背景 `radial-gradient(120% 75% at 50% -12%, #dcefec, #f4fbfa 46%, #fbfefd)`，运行中加深到 `#cfeae6`。Element Plus 主色与 light/dark 派生一并覆盖，避免专注页弹窗、输入框回落到全站或默认蓝。
  - ② **休息阶段改用暖橙而不是绿色**：`--rest #e6a05c`、`--rest-deep #b9782f`，圆环/时间/「下一轮」按钮统一暖橙。原来「专注红 / 休息绿」，现在「专注青绿 / 休息暖橙」，与全站 accent 同源，节奏对比仍在但不再刺眼。
  - ③ 新增 `src/components/LimeIcon.vue`：纯 SVG 青柠（黄绿高光 `#dcedb4 → #a2cc86 → #4f8f8a` 果体、`#5e9f8f` 叶子、白色高光与柔和落影），`size` prop，渐变 id 用 `useId()` 保证多实例唯一。替换专注页 logo、庆祝浮层图标、侧栏成果小图标，以及计划页右栏原来的 🍅（emoji 无青柠，且黄色 🍋 与青绿主题冲突）。
  - ④ 番茄 → 青柠全链路文案：`FocusView` 的 `todayPomodoros → todayLimes`、`startNextPomodoro → startNextRound`、`.pomo-tomatoes → .pomo-limes`、`.celebrate-tomato → .celebrate-lime`，「番茄 +1 / 今日番茄 / 还没有番茄」→「青柠 +1 / 今日青柠 / 还没有青柠」；`HomeView` 的 `todayPomodoros → todayLimes`（「N 个青柠」）；`DashboardView` 的 `todayPomodoro → todayLime`（「今日青柠」卡）；`PlansView` 的 `todayFocus.pomodoros → .limes`、`.aside-tomato → .aside-lime`（背景 `--primary-soft`、数字 `--primary`）。
  - ⑤ 同步改掉的红色残留：圆环 track `#dceeeb`、时光格边 `#dceceb`、离岗灰 `#b9cecd`、热力图四档 `#e3f2ef/#c3e3df/#8fc2bd/#4d8d8e`、主按钮与时长选中的阴影全部转 `rgba(77,141,142,…)`、庆祝胶囊描边 `#d3e9e6`。暖橙只保留在 `.pomo-tip`、`.pomo-hint` 左边框与 `--accent`（全站强调色的呼应）。
  - 验证：`npm test` 153 通过、typecheck 通过、build 19.41s 通过；CDP 1440×950 实测 `/focus` 的 `--pomo/--primary/--el-color-primary` 均为 `#4d8d8e`、圆环 `rgb(77,141,142)`、主按钮青绿渐变、logo 内渐变三档 `#dcedb4/#a2cc86/#4f8f8a`、顶部「2 个青柠 · 50 分钟」、侧栏 2 个 16px 青柠图标、旧番茄节点 0；临时给 `.pomo-clock` 加 `is-break` 后圆环变 `rgb(230,160,92)`（首次读数受 `.3s` stroke 过渡影响，需等 700ms 再读）；`/home`「累计 50 分钟 · 2 个青柠」、`/plans` 右栏 `.aside-lime` 存在且 `rgb(223,240,239)` 底、`/dashboard` 出现「今日青柠」卡；0 控制台报错。

- 二十二期 / 学习资料讲解置顶与真题排版（2026-11-13，老大反馈「点知识点先出现题目和乱码，题目应放在讲解下面，括号别分两行，解析和详解合并」）：
  - ① 根因：学习资料「真题参考」直接渲染 RAG 检索到的中考试卷 PDF 流水文本（`text.slice(0, 600)` + `excerpt` 280 字），表格被拍成一列、`（\n）` 被拆成两行、空选项只剩 A/B/C/D、`【解析】` 空标题与 `【详解】` 正文分成两块，且 600 字会把题目切一半。
  - ② 新增 `server/exam-text.js`：`parseExamQuestions(text, { limit })` 按 `^(\d{1,3})[.．、]\s+` 切题（题干里的小数如 `2.5` 不会误判），选项只认 A–D 行、空选项过滤；`【答案】 / 【解析】 / 【详解】` 三态收集，**解析与详解合并成一段**（解析为空时只留详解）；题号前的残句作为 `lead`（截 160 字）；`cleanText` 把 `（\n）` 和 `（  ）` 统一成 `（\u00a0\u00a0）`，并把行首是 `=＋+－×÷·。，、；：）` 的 PDF 软折行并回上一行。**没有答案也没有解析的题直接丢弃**，避免片段截断留下半截选项。
  - ③ 新增 `server/lesson.js` 与 `GET /api/materials/lesson`：按 `grade/subject/chapterName/unitLabel` 让 DeepSeek 输出 `{intro, points[], formulas[{name,expr,note}]}`（`thinking:false`、`jsonMode`、20s 超时），失败退回本地模板（按学科给三条学习动作）；走 `cachedGenerate` 内存缓存（6h / 80 条）。`/api/materials/chapter` 的 passages 改为 1800 字截断 + 每题结构化 `{ number, stem, options, answer, analysis }`。
  - ④ `MaterialsView.vue`：详情区块顺序改为**知识点讲解 → 相关知识点 → 典型例题 → 真题参考**；讲解卡用 `--surface-soft → --surface` 渐变 + 「AI 讲解 / 基础讲解 / 正在整理」徽标 + 三点骨架，公式卡 `auto-fit minmax(180px,1fr)` 自适应；例题选项 `v-show="option"` 过滤空值；真题改成 `.exam-card` 题卡（题干、选项、答案、解析四层，正确项 `correctKeys(answer)` 高亮）。讲解与题目**并行请求**，详情接口先到就先渲染。
  - ⑤ `formatMathText` 增加两条早期规则：`（\s*\n\s*）` → `（\u00a0\u00a0）`、`（[ \t]{1,6}）` → `（\u00a0\u00a0）`，从渲染层兜住所有页面的空括号断行。
  - 验证：`npm test` **159 通过 / 0 失败**（新增 6 条：括号不断行、解析详解合并、空选项过滤、残题丢弃、lead 与 limit），typecheck 通过、build 19.80s 通过。CDP 1440×950 实测 `/materials` 初三物理第一章：区块顺序 `[知识点讲解, 相关知识点, 典型例题, 真题参考]`、徽标「AI 讲解」、5 条要点、3 张公式卡、3 张真题卡且都有解析块、`bracketBroken=false`、0 控制台报错；首次讲解生成 6.4s，缓存命中后秒开。已知限制：表格类真题仍按原文行展示（保留换行，不自动还原成表格），截断片段末尾若题干缺行无法补齐。

- 二十三期 / 真题碎片与方块字符清理（2026-11-13，老大原话「还是有很多错乱的地方，全部学习资料的文字错乱都要完善」，截图里出现一行一个 `22.5 / COF / ∵ / ∴` 和大量 □）：
  - ① **根因一（方块）**：中考试卷 PDF 用 Symbol 字体排公式，转文本后运算符落在 Unicode 私用区 `U+F02B/F02D/F03D/F03C/F03E/F028/F029/F044/F070/F0B4/F0B8/F0D7`，浏览器没有字形只能画 □；题干/答案没走重排时这些字符原样上屏。
  - ② **根因二（碎片）**：`searchPassages` 在 RAG 层就把 `text` 截到 900 字，资料页再 slice(1800) 拿到的仍是截断文本；`readable` 兜底之前直接 `excerpt(item.text)`，PDF 版面折行（一行一个符号、`∵`/`∴` 单独成行）被原样保留。
  - ③ `server/exam-text.js` 重写整理：新增 `cleanSymbols`（删 `□▯`、U+FFFD，私用区按 Symbol 表映射成 `+ − = < > ( ) Δ π × ÷ ·`，其余私用区删除）；`reflowText(text, { maxParagraphs=24 })` 把碎片行合成段落（中文直连、中英/中数之间补空格、`∵∴` 前留空格），`【小问】`、`（1）`、`①②`、`故选/答：`、`A–D.` 选项、编号行一律另起段，纯标点行与只剩「A.」的空选项行剔除，末尾把空括号统一成 `（\u00a0\u00a0）`；`looksLikeTable`（≥4 行连续 ≤10 字且无句末标点判为表格）保留换行，`needsReflow` 只在表格题干时不重排；`finishQuestion` 的题干重排上限 60 段，并新增「答案只剩（1）且无解析」的半题丢弃。
  - ④ `searchPassages` 新增 `maxChars` 参数（默认 900，资料页传 1800，答疑链路不变）；`materialPassages` 的 `readable` 改为 `maxParagraphs:12` + `slice(0,1000)`；前端章节详情与搜索面板两处兜底统一用 `item.readable || excerpt(item.text)`。
  - 验证：`npm test` **166 通过 / 0 失败**（`exam-text.test.js` 11 条，新增：碎片合段与 □ 删除、私用区映射、表格保持逐行、选项独立成段、PDF 折行题干合并、半题丢弃），typecheck、build 通过；CDP 1440×950 实测 `/materials` 初三数学「二次函数」4 张真题卡、「一元二次方程」6 张 + 无答案原卷兜底片段，`□/▯` 计数 0、单字符碎片题干 0、区块顺序不变、控制台 0 报错（截图 `materials-r23b.png`）。仍然无法还原的是公式上下标位置（源 PDF 里是图片/独立文本层），例如只能得到 `x x a − + =`，不可能凭空补成 `x²−2x+a=0`。

- 二十四期 / 真题质量闸门（2026-11-13，老大原话「你怎么这么不细心？重新梳理全部学习资料，注意是全部！！！把全部文字错乱的地方全部完善好」，截图是 2022 广东中考数学：Q2 选项只剩 A/C/D、解析「解：2 2 = x =」、Q16「2023 3 8 | 5 | ( 1)+−+−」整串红框）：
  - ① **确认源 PDF 全部缺失**：RAG 索引里写的 `中考/真题/2024/xxx.pdf` 在 `d:\aaa\ai-teach\中考` 不存在，全盘（d:\aaa、D:\trae-work、Downloads、Documents、Desktop）与 git 历史均搜不到原卷。所以公式不可能重新抽取，上下标/分数/图片选项永远无法还原——这是资料本身的硬限制，不是排版没做好。
  - ② **新增 `looksGarbled(text)`（`server/exam-text.js`）**，识别「公式被拆散」：连续/隔空格的运算符（`=+`、`× =`、`+ <`）；运算符悬空在句尾或标点前（`BCD =，`、`C = ．`、`FC =`）；小写字母被空格拆开再跟运算符且去重后 ≥2 个 token；两个单字母被空格隔开（`x x − > <`）；等号夹孤立操作数（`2 2 = x =`）；空括号后紧跟数字/字母/运算符（`将点（ ）1,1`、`旋转角为（ ）<<`）；算术运算符直接粘中文（`5+元`，`Na+ 离子` 有空格不受影响）；`##` 占位符；≥2 个独立逗号碎片；短句运算符密度 ≥0.6（用 CJK 字数稀释）。第一版（≤2 字 mathish token ≥4）把英语打到 28% 可用、化学 57%，收紧后恢复。
  - ③ **选项完整性闸门 `optionSetBroken(options)`**：选项数只有 1 个 → 坏；必须从 A 连续且每项有内容；选项文本和选项字母完全相同（`A.A`，说明真正选项在表格里）→ 坏；所有选项文本完全相同（分数分子分母被 PDF 丢掉，全是 `1`）→ 坏；任一选项 `looksGarbled` → 坏。缺 B 的选择题整题丢弃。**答案是单个字母却没有任何选项**（选项全被 PDF 丢成图片）也整题丢弃。
  - ④ **答案与解析按题号归位**：片段常从上一题答案中间开始（`5. B` 被当成新题、`【答案】6. C` 排在第 8 题后面）。现在 `parseExamQuestions` 先收集原始题，再用 `(\d)\s*[.．、]\s*([A-D])` 建答案表按题号回填；编号对不上的答案直接摘掉。`【6 题详解】` 这类编号解析按题号挂回对应题，本片段没有该题则整段丢弃。只剩单字母/数字的假题干（`5. B`）、空括号题干、无中文且 ≤3 字符的残词题干（`it`）、纯英文单词题干（`habit`）全部剔除。材料导语里一旦出现 `【答案】【解析】【详解】` 或 `故选`，说明片段从解析中间开始，导语整段不展示。
  - ⑤ **学习资料真题强制同学科**：`searchPassages({ subjectStrict: true })` 只对材料页启用；答疑仍保留跨学科加权。之前物理章节会混进历史题、化学章节混进道法题（BM25 被「物理」二字带偏），现在不会。
  - ⑥ `MaterialsView.vue` 删掉 `excerpt()` 兜底，前端不再回退渲染原始 `text`；`passagesNote` 在两个面板各加一行 muted 文案，空态判断同时看 `passagesNote`。`cleanSymbols` 清掉着重号变成的连续句点（`错误．．的是` → `错误的是`）；PDF 会把着重号拆到下一行，所以 `reflowText` 合并段落后再清一次，否则 `不正确．．．的一项是` 会漏网。
  - 验证：`npm test` **178 通过 / 0 失败**（新增：编号答案归位、孤立答案不当题干、编号解析挂回对应题、`= x =` 判乱码、导语不含答案解析、残词/单词题干丢弃、选项只剩字母整题丢弃、着重号清理），typecheck、build 15.10s 通过；全站接口巡检 **144 章 / 201 个片段 / 199 道题，问题 0 处**（无 □/PUA、无公式乱码、无缺项选项、无孤立答案题干、无学科错配）；覆盖：有片段 105 章 / 仅提示 27 章 / 无真题块 12 章（英语 18 章中 8 章有片段，其余只剩查看原卷提示）；CDP 复验「二次函数」1 张卡、「一元二次方程」1 张卡，`dirty=false`、区块顺序不变、控制台 0 报错。
  - 结论：策略从「尽量显示」改成「无法可靠还原就不显示」。数学 26 章里 17 章有可用真题、9 章只剩「查看原卷」提示——其余内容不是漏修，而是明确撤下。


## 决策

- 默认本地 IndexedDB，摄像头默认关闭，需学生主动同意后才启动检测（隐私要求，不可默认开启）。
- 无 DeepSeek 密钥时必须可降级运行，不允许因缺密钥导致白屏或功能全挂。
- 账号采用「本机 Express + 文件存储」：scrypt 密码哈希、HttpOnly 签名 Cookie、`AUTH_SESSION_SECRET` 可覆盖默认随机密钥；未另起数据库或第三方登录。
- 专注页倒计时默认取测试建议时长（`recommendFocusMinutes`，无建议才回落到计划预计时长、再兜底 25 分钟）；用户手动改过的时长记在 `settings.focusMinutes` 且优先。建议文案必须标出来源（日常测试/周测）与正确率；「推荐」角标挂在建议档位。
- 答疑保留冷却：前端 12 秒软提示（不发请求），后端另按同 IP 10 秒限流；命中时返回固定文案「我们每隔一会儿再问一个问题…」，不调用模型。曾试过取消冷却，已回滚。

## 踩坑

- 摄像头需 `localhost` 或 HTTPS 安全上下文，否则拿不到媒体流。
- 浏览器调试时 Cookie 能工作，是因为走了 Vite 的 `/api` 代理（同源）；若把 `VITE_API_BASE_URL` 改成绝对地址，需要跨域携带 Cookie 且 `SameSite=Lax` 会失效。
- 浏览器发 POST 时即使同源也会带 `Origin` 头，经 Vite 代理转发后 Origin 仍是页面地址（例如 `http://localhost:5174`）；后端 CORS 白名单只认 5173/4173 时，请求会被 CORS 拒绝并返回 HTML 错误页，前端只会看到 `JSON.parse: unexpected character at line 1 column 1`。
- `src/services/api.js` 的请求封装先按文本读取再判断 `content-type`，非 JSON 统一提示「账号服务未启动或不可用，请稍后重试。」，不再把 `JSON.parse` 原始报错抛给学生。
- PowerShell 5 的 `curl.exe -d` 会保留反斜杠导致 JSON 解析失败；单引号包裹的 JSON 还会被吞引号报 `Unexpected token d in JSON at position 1`。验证接口改用 `Invoke-WebRequest` + `ConvertTo-Json`，或把体写进文件后 `--data-binary "@path"`。
- 本机重启 API 不要用 `Start-Process node`：命令结束后子进程会被沙箱回收，端口 3001 立刻没了。要用 Shell 工具的 `run_in_background: true` 起 `node server/index.js`，再请求 `/api/health` 确认。
- `node --test` 会递归扫到 `传智杯提交包/项目源码/`，同一批测试会跑两遍，不是配置重复（2026-11-09 已删除该副本，测试数 62→48；`传智杯提交包/` 整目录在 `.gitignore` 中）。
- CSS 百分比 `padding` 按**父容器宽度**算，不是按自身尺寸；给 em 字号缩放的徽标表达内收必须用 `em`（父容器宽度随品牌文字变化，用 % 会把内收放大成 12.9px）。
- Chrome headless 的 `--window-size` 小于约 500px 时，布局视口仍按约 512px 计算，`--screenshot` 只是裁剪图，不是真实窄屏布局；要按真实宽度截图/测量必须用 CDP `Emulation.setDeviceMetricsOverride`（`Page.captureScreenshot` + `clip`）。
- `.env.example` 曾在首次提交时就写入真实 `DEEPSEEK_API_KEY`（与 `.env` 同值），随 Gitee 仓库历史和 2026-11-11 交接包一起外泄，2026-11-11 已改为占位符 `sk-replace-with-your-own-key` 并重打交接包。模板文件永远只放占位符；密钥一旦进过 Git 历史，改文件无效，必须去平台轮换。
- 密钥文件在项目根 `.env`（字段 `DEEPSEEK_API_KEY`）；README 里旧路径 `D:\aaa\ChatCPT-Codex\AI-Teach\.env` 属历史写法，以本仓库 `.env` 为准。
- Firefox 已移除 CDP（`--remote-debugging-port` 连不上，Marionette 的 `WebDriver:NewSession` 会挂住不返回）。要抓 Firefox 的页面错误，用 headless + profile 里的 `user.js` 打开 `devtools.console.stdout.content`、`browser.dom.window.dump.enabled`：页面 `console.error` 打到 stdout（`console.error: "..."`），未捕获异常打到 stderr（`JavaScript error: <url>, line N: ...`），有文件行号但没有调用栈。要跑交互，可在 `public/` 放一个同源巡检页用 iframe 加载应用并注入事件钩子（跑完必须删，否则会被 `npm run build` 打进 dist）。
- 本机 Firefox 是「中国版」，profile 预装 6 个 MozillaOnline 扩展（coba/cpmanager/tabtweak 等），启动时报 `ExtensionError: No such native application com.mozillaonline.cobahelper`；浏览器控制台（Ctrl+Shift+J）里这类扩展/系统 JS 报错只有一行、没有应用堆栈，别误判成业务代码错误。

## 外部资源位置

- 交付/答辩材料：`docs/大赛交付材料.md`
- 技术说明（IndexedDB、工具 schema、系统提示词）：`docs/技术说明.md`
- 启动调试与 20 项验收清单：`docs/启动调试与测试.md`

- RAG 检索升级（2026-11-08）：`searchCurriculum` 改为跨年级检索 + 2~4 字滑窗分词 + 高频专题别名表 + 同学段加权，返回上限 8 条；无关提问返回空，不再把整册目录带出来。答疑提示词要求命中后在回答末尾写「依据：年级科目·知识点」。实测「二次函数顶点式」命中 8 条、首位为初三「二次函数」，回答附「依据：初三数学·二次函数」。

- AI 计划可编辑（2026-11-08）：计划页支持同科目拖拽重排（写回 `sequenceOrder`）、锁定（重新诊断时保留，未锁定的同科目旧任务被清理）、「AI 换一个」（`POST /api/agent/plan/replace`，模型不可用回落本地变体）；`normalizeReplacedPlan` 负责字段回落与时长夹取。

- MCP 服务（2026-11-08）：`server/mcp.js` 用官方 SDK 1.32.2 暴露 stdio 工具（`search_curriculum` / `calc_review_interval` / `list_curriculum_chapters`），与 Web 端共用 `executeTool` 与课标检索；`npm run mcp` 启动。专注记录与视觉状态依赖浏览器，故意不暴露，避免外部调用拿到空数据。踩坑：tmp 下的验证脚本直接 `import '@modelcontextprotocol/sdk/...'` 会 `ERR_MODULE_NOT_FOUND`，要用 `file:///D:/AI-Teach-project/node_modules/...` 绝对路径导入。

- TypeScript 基础化（2026-11-08）：加 `tsconfig.json`（`allowJs` + `checkJs:false`，靠单文件 `// @ts-check` 渐进检查），已覆盖 `src/services/api.js`、`src/utils/formatMath.js`、`src/db/index.js`、`server/tools.js`，`npm run typecheck` 零错误。踩坑：项目 `"type":"module"` 下 Node 18 无法运行 `npx tsc`（bin 是无扩展名文件，报 ERR_UNKNOWN_FILE_EXTENSION），必须写成 `node node_modules/typescript/lib/tsc.js`。

- 主页真实数据（2026-11-08）：`HomeView` 首屏的 62% / 连续 7 天 / 25 分钟原来是写死的假数据，已换成 `db/index.js` 的 `getHomeStats()`（连续学习天数、今日专注分钟、累计专注分钟、今日进度、下一任务、知识点数），零记录时显示如实空状态；hero 增加「直接问 AI」前置入口，科目卡带 `?subject=` 预选。

- 课程目录按年级开设（2026-11-08）：`server/curriculum.js` 的 catalog 是「年级 → 科目」两级结构：**初一无物理无化学，物理从初二起，化学从初三起**。真正的坑是前端 `getCurriculumSubjects(stage)` 只传学段不传年级，服务端永远回退到首个年级（初一）的科目，导致年级选到初三也看不到物理/化学。现已改为 `getCurriculumSubjects(stage, grade)` 并在 `loadGrades`、年级 watcher 都带上 `profile.grade`。主页科目卡带 `?subject=` 进入时，若当前年级没该科目，会自动切到最早开设它的年级（物理→初二、化学→初三）并弹提示；预选必须在 `await nextTick()` 之后写入，否则会被年级 watcher 的 `profile.subject = ''` 清空。

- 考试区域口径（2026-11-08，已被 2026-11-10 全国口径取代，见本文件后文）：当时初中卷型对齐佛山中考、高中对齐广东新高考（3+1+2），现已统一为「初中全国中考常见结构 / 高中新高考结构」，以全国口径那条为准，不要再对外说佛山/广东命题。

- 符号快捷输入（2026-11-08）：`QuizView` 填空/解答输入框下加了符号面板（数学 √ ∑ π ° ± × ÷ ≤ ≥ ≠ ≈ ∞ / 上下标 / 几何集合 / 理化 Δ ↑ ↓ ⇌ μ Ω ∵ ∴）。插入逻辑用 `:ref` 注册每个 `el-input`，取 `$el.querySelector('input, textarea')` 的 `selectionStart/End` 按光标插入，`nextTick` 后 `focus + setSelectionRange` 还原光标；按钮用 `@mousedown.prevent` 阻止抢焦点。诊断摸底全是单选，不需要面板。

- Git 推送（2026-11-08）：仓库用 SSH `git@gitee.com:HTIANH-CN/...`。Git 自带的 MSYS ssh 会把 `C:\Users\豪` 解析成乱码路径，导致 known_hosts 读不到、报 `Host key verification failed`。已在仓库本地 `core.sshCommand` 指定 Windows OpenSSH + 专用私钥：`C:/Windows/System32/OpenSSH/ssh.exe -o StrictHostKeyChecking=accept-new -i C:/Users/豪/.ssh/gitee_ed25519`。换机器要重新确认私钥路径。

- 主页科目可自由增减（2026-11-08）：`settings.favoriteSubjects`（本地设置项）存**完整展示列表**，默认 `['数学','物理','化学','语文','英语']`；`HomeView` 用「＋ 选择科目」弹窗做 10 科勾选 + 「全选 / 清空」，取消勾选物理就真的不显示，卡片右上角 × 直接移除。空列表要显示 `.subject-empty` 占位，不要回退成默认 5 科（否则用户没法清空）。只存设备本地、不随账号同步。

- 番茄专注环（2026-11-08）：`FocusView` 在 `CountdownTimer` 外套一层 SVG 环（`r=92`，周长 `2πr`），用 `ringOffset` 随剩余时间递减；`ringAway = pageHidden || visualStatus.isPresent === false` 时环变灰、数字降透明度、停呼吸光晕。`visibilitychange` 里同时维护 `pageHidden`，否则只靠「计时暂停」看不出离岗。结束/自然走完调用 `flashRing()` 做 0.7s 扫光。近 7 天热力图用 `loadFocusSessions()` 按自然日聚合，**不足 1 分钟要显示 `<1`**（直接 `Math.round` 会变成 0，演示 15 秒时看不到数据）。动效全部尊重 `prefers-reduced-motion`。

- 学习轨道（2026-11-08）：`PlansView` 任务列表改成竖向轨道，节点状态由 `nodeState(plan, group)` 决定：`status==='archived'` → done（实心 `--primary` + ✓）、每组第一个 active → current（脉冲 + 「进行中」标签）、其余 → todo（虚线）。`groupedPlans` 现在返回 `{ subject, plans, currentId }`。默认筛选改成 `all`，否则归档后节点会立刻从「进行中」列表消失，看不到点亮效果。没有真实「完成」状态：完成 = 归档，菜单文案已改为「完成并归档」。

- 手写作答上传（2026-11-08）：`QuizView` 填空/解答支持「拍照 / 上传手写稿」，隐藏 `input[type=file][accept=image/*]` 在移动端可直接调相机或相册；图片用 canvas 压到长边 1280、JPEG 0.72 再存，随 `quizResult.answerImages` 落 IndexedDB，结果页会显示作答照片。OCR 是可选按钮（tesseract，首次要加载模型、手写识别率有限），识别文本可手改，照片只留本机不上传服务器。

- 向量渲染与逐项解析（2026-11-08）：向量必须显示顶部箭头，`formatMathText` 在 HTML 转义**之后**把 `\vec{a}` / `\overrightarrow{AB}` 换成 `<span class="vec">`，箭头由 `src/styles.css` 的全局 `.vec::before { content:'→' }` 画出；**样式必须放全局**，`scoped` 样式对 `v-html` 内容不生效。模写成 `|\vec{a}|`，靠竖线把向量和数量区分开。解析要求每题逐项：正确项写依据、错误项给反例，`QuizView` 与 `DiagnosisView` 都按行拆成 A/B/C/D + 绿「正确项·成立依据」/ 红「错误项·反例」。本地题库的 `expandSingleExplanation` 只适合**纯数值选项**（按与正确答案的差值解释）；分式、坐标对、集合、文字类选项会给出错误理由（如把 `1/2` 读成 1），这些分支必须手写逐项解析；出题选项还要去重（曾出现向量/数列/整式/二次函数/椭圆选项重复，物理除法出现 `0.06666666666666667`，需 `toFixed`）。`QuizView` 的科目列表也必须带年级，否则初二/初三拿不到物理/化学（与诊断页同一个坑）。改 `server/prompts.js`、`server/quiz.js` 后必须重启 `node server/index.js`（无热重载），否则提示词与题库不生效。

## 传智杯 AI Web 网页开发挑战赛评分规则（2026-11-08 官方截图，豪哥 11:09 发送）

- 主题「智启未来：AI 驱动的 Web 应用创新挑战」；要求 AI Native，AI 功能是核心而非附属；原创、Web 形态、深度集成 AI。
- 六大维度（各百分制，按权重加权总分；≥3 位评委独立打分取平均；决赛另加 30% 现场答辩）：
  - **AI 技术深度 35%**：大模型集成质量 8（Prompt 设计/输出可控）、Agent 工作流 8（规划/工具调用/自主决策）、RAG 6（架构与检索策略）、多模态 5（文/图/音/视频融合）、AI 安全可控 4（内容过滤/可解释/兜底）、MCP 或 Function Calling 4。
  - **创新性 25%**：选题创新 10、技术方案创新 8、交互模式创新 7。
  - **前端工程质量 10%**：代码质量 4（TypeScript 规范/可维护）、组件架构 3、性能优化 3（懒加载/代码分割/缓存）。
  - **实用性 10%**：场景真实性 5、方案有效性 5。
  - **用户体验 10%**：UI 视觉 4、前端交互 3（路由切换/动画过渡/反馈/加载态）、AI 交互 3（流式渲染/思考态可视化/错误边界）。
  - **社会价值与商业潜力 10%**：社会价值 5、商业潜力 5。
- 提交材料硬门槛：代码仓库（Public 或评审权限，README 含项目介绍/技术架构/运行指南/**团队信息**，完整 Git 历史，环境变量模板）；**演示视频 5–8 分钟 MP4 ≥1080p 普通话**；**技术文档 PDF ≤30 页**（项目概述/需求分析/架构/AI 方案/核心实现/测试部署/总结，须写 AI 选型理由与创新点）；**在线演示为可选加分项**（公网地址 + 评审期可用 + 测试账号）。材料不完整会影响评审结果，提交后不可修改。
- 自评 75/100（2026-11-08，见会话记录）：最大失分是 RAG（静态课标映射无向量检索）、创新性（选题在官方推荐方向内）、商业潜力（无商业模式/无 B 端）、以及视频/PDF/公网 demo 三项未交。

## RAG 真题检索层（2026-11-08）

- 离线构建：[scripts/build-rag-index.py](scripts/build-rag-index.py) 用 PyMuPDF 读 `中考/`、`高考/` PDF，按题切块、2~3 字滑窗建倒排表，产出 `server/rag/rag-index.json.gz`（111 份可解析卷 / 1294 题块 / 12 万词元 / 1.88MB）。19 份扫描件无文字层被跳过。重建命令 `npm run rag:build`（需本机 Python + PyMuPDF）。
- 运行时：[server/rag/index.js](server/rag/index.js) 懒加载 gzip 索引，BM25（k1=1.2,b=0.6，2 字词元权重 0.55）+ 三字词覆盖率 + 连续四字命中 ×1.45 + 学科 ×1.35 / 学段 ×1.15，2 字元组重合 >0.62 视为同题去重。
- 集成：`rag_knowledge_query` 返回 `items`（课标知识点）+ `passages`（真题片段，带《试卷名》出处）；`summarizeToolResult` 把「命中 N 个知识点 · 检索到 M 条真题解析」透传到 AgentTrace；TUTOR 提示词允许引 1 条同类例题讲思路、禁止抄题给答案。
- 索引是从考试卷提取的派生文本，公开仓库存在授权灰色地带；若要规避，改为只放人工筛选的少量样例块。
- 验证：`server/rag.test.js` 8 条（含工具集成与摘要）；真实流式答疑实测模型调用两次工具、回答带「依据」。

## 前端体积优化（2026-11-08）

- ChartPanel 从 `import * as echarts from 'echarts'` + 静态 `echarts-gl` 改为 `echarts/core` 按需注册：Line/Bar/Pie/Radar + Grid/Radar/Tooltip/VisualMap + CanvasRenderer。
- echarts-gl 只在遇到 `grid3D` 或 `*3D`/`*GL` 系列时动态加载 `echarts-gl/lib/component/grid3D` 与 `lib/chart/scatter3D`，globe/map3D/surface 等不再进包；用 renderToken 防止异步加载期间的新数据被旧任务覆盖。
- 构建结果：ChartPanel 1600.5 → ~545 KB（−66%），3D 相关拆成 155 KB + 255 KB 异步块；dashboard 实测 5 个 canvas、无 “series not imported” 报错。
- 仍超 500 KB 警告的剩余大块是 element-plus（999 KB）与 TFJS（803/1077 KB），属另一轮优化范围。

## 学习四阶段（2026-11-09）

- 阶段是**任务级标注**，不是知识点级掌握度：`stage` 取 concept / example / transfer / review（概念/例题/迁移/复盘）。
- 来源：[src/utils/stages.js](src/utils/stages.js) 统一 `STAGES`、`stageOf`、`stageLabel`、`stageStatesOf`；老计划无 `stage` 时按 `sequenceOrder % 4` 回退，中文字段也能识别。
- 写入：`server/prompts.js` 规划/迭代提示词要求模型输出 `stage`；`server/agent.js` 的 `normalizeStage` 把中文、大小写、非法值统一成英文 key，`fallbackPlan` 自带 concept + review。
- 展示：`getHomeStats` 返回 `stageStates`，首页节点「该阶段任务全部归档=done / 当前任务所在阶段=current / 其余=pending」；计划页每个任务带阶段标签，科目文件夹前有四阶段圆点；桥接复习任务不计入阶段进度。
- 自适应升降阶（2026-11-09）：`applyQuizStageResult` 在章节测试交卷/自评后回写计划——同科目同章节的测试 ≥80% 归档该章节的「概念」「例题」，当前阶段推进到「迁移」；<60% 重新打开已归档的「例题」（无例题则回到「概念」）；60%~80% 不动，避免抖动。只匹配 `chapterId/chapterIds` 或 `knowledgeTags` 命中的任务，不影响其他章节与桥接任务。
- 验证：`src/utils/stages.test.js` 7 条 + `server/agent.test.js` 阶段归一化 1 条；`npm test` 全绿、typecheck/build 通过，首页、计划页、测试页浏览器实测无报错。
- 首页地图按科目（2026-11-09）：`getHomeStats` 的 `stageStates` 只统计 `stageSubject`（顺序最靠前进行中任务所属科目），归档一个任务即可看到节点推进；无计划时四点为 pending，并显示「还没有计划 · 生成第一份」入口。
- 一次性动效：阶段新变 done 时播 `nodeGlow` 约 1 秒即停，不做循环；上次状态记在 localStorage `stage-seen:<dataOwner>`（不写 IndexedDB，避免每次进首页都触发设置写入）。
- 专注页本次任务顺序：`planId` → `settings.lastFocusMode === 'free'` → `settings.lastFocusPlanId` → 按 `sequenceOrder` 排第一的进行中任务（排除 `isBridge`）→ 第一条计划 → 自由专注；开始专注时写回 `lastFocusMode`（plan/free）与 `lastFocusPlanId`。
- 计划生成真相（2026-11-09）：`/api/agent/diagnose` 只要带了 `chapters` 就**不走** `LEARNING_SYSTEM_PROMPT`，而是 `buildAdaptivePlan`（`server/curriculum.js`）先出基础任务，DeepSeek 只改写名称/理由/时长（`planPrompt` 在 `server/index.js` 190-200 行）。要改任务结构必须改 `buildAdaptivePlan`，改提示词无效。四阶段已落在 `buildAdaptivePlan`：每专题 concept/example/transfer/review 四条，按 `dailyMinutes` 权重分配时长。
- 每日额度语义：`normalizePlanOutput` 按天分批，当天额度用尽就开新的一天（不再把后续任务压成 0 分钟丢弃），上限 24 条；多专题四阶段计划总时长会超过单日 `dailyMinutes`，属跨天计划。

## 自由专注（2026-11-09）

- 场景：用户拿番茄钟做计划外的事（写作业、背单词），不能强行绑定学习计划。专注页任务选择器最底部加「自由专注 · 自定义任务」，选中后出现名称输入（≤24 字，留空显示「自由专注」）；计时开始后选择器与输入框都锁定，避免一条记录跨两个任务。
- 数据口径：`focusSessions` 记录新增 `mode: 'plan' | 'free'`；free 时 `planId: null`、`subject: '自由专注'`、`taskName` 取用户输入。free 模式隐藏「写反馈」，`submitFeedback` 也加了守卫——自由专注**只记时长**，不归档计划、不推四阶段、不写掌握度、不触发 Agent 迭代。
- 迭代隔离：`getRecentFocusContext` 过滤 `mode === 'free'`，避免计划外的专注被误判成某个知识点已练过。
- 设备记忆：`settings.lastFocusMode`（默认 `plan`）、`lastFocusPlanId`、`lastFreeTaskName`（默认空串）写在本地设置库，不随账号同步。
- 验证（2026-11-09）：`D:\trae-work\tmp\e2e-free-focus.mjs`（Playwright + 本机 Chrome headless，持久化 profile）实测：选择器切到自由专注→填「写数学作业」→开始 2.5 秒→结束，落库 `mode:'free'`、`planId:null`、`taskName:'写数学作业'`；计划 8 条、归档 0 条不变；首页地图节点仍为 1 current + 3 pending；自由模式下「写反馈」按钮为 0 个；控制台无错误。截图 `D:\trae-work\tmp\e2e-free-focus.png`。`npm test` 54 通过、`npm run typecheck` 与 `npm run build` 通过。

## DeepSeek 超时修复（2026-11-09）

- 根因：后端 `callDeepSeek` 默认 35 秒超时，而开启 `thinking` 后摸底实测 43–57 秒；前端 `diagnose/generateLearningPlan/iteratePlan` 也是 35 秒、出题 35 秒，双重提前掐断后摸底永远降级成自评题。另外 `DiagnosisView.startAssessment` 没有 `finally`，超时后 `assessmentLoading` 一直为 true，按钮永久禁用。
- 修复：`server/agent.js` 的 `callDeepSeek({timeoutMs=35000})` 改为可传参 + `AbortSignal.timeout`；`server/index.js` 摸底 90000、计划 70000；`src/services/api.js` 计划类 75000、出题 95000；`startAssessment` 改 `let response` + `try/catch/finally` 解除 loading。
- 口径：前端超时必须大于后端超时，否则前端先断、后端结果无处可回。

## 出题提速（2026-11-09）

- 症状：日常 6 题要 27–34 秒，摸底 10 题 43–57 秒，且偶尔等到最后降级成本地模板题。
- 无效尝试：给 `callDeepSeek` 加 `thinking` 参数、出题/摸底传 `thinking:false`。实测该 `deepseek-flash` 网关**忽略 thinking 参数**，关闭后仍产出 `reasoning_tokens` 2400–3600，耗时 22–30 秒无变化。参数仍保留（语义正确，换模型可生效），但当前不是杠杆。
- 有效手段：`generateQuiz` 改为**按题位并发**——把蓝图展开成逐题位（章节 + 题型），每请求只出 1 题，`QUIZ_CONCURRENCY = 6` 限流并发，`mapWithLimit` 保持顺序。缺失/撞题/超时的题位逐题用本地兜底补，id 追加题位序号避免重复。
- 单题超时 20 秒：正常一题 4–9 秒，慢请求直接兜底，避免整卷被个别请求拖住（曾出现 60 秒超时让整卷 28 秒）。
- 实测（本机 3001，初三数学一元二次方程）：日常 6 题 17.1 / 12.2 / 10.9 / 14 秒，周测 12 题 17.2 秒；改前同样请求 27–34 秒。波动来自网关并发排队，`source` 偶为 `deepseek-with-local-fill`。
- 注意：模型直连 raw fetch 会出现 0.1–0.5 秒返回 5000 token 的**缓存假象**（网关按提示词缓存响应），测耗时必须走服务端真实调用或 `callDeepSeek`。

## 计划链路提速（2026-11-09）

- 摸底出题：`/api/agent/assessment/generate` 改为**逐题并发**（`mapWithLimit`，上限 10 路），题位按蓝图 `count` 展开、维度循环复用。实测 10 题 43–57 秒 → 10–15 秒，`source` 偶为 `deepseek-with-local-fill`。
- 计划骨架：新增 `POST /api/agent/plan/skeleton`，直接调本地 `buildAdaptivePlan`，约 0.1 秒返回，`source: local-rules`。前端 `createPlan` 两段式：先落骨架（`aiPending: true`）跳结果页，再请求 `/api/agent/diagnose` 合并 AI 文案。
- AI 文案合并按 `planMergeKey`（章节 + 阶段，桥接任务用 chapterIds）匹配，**不能按数组下标**——`orderCurriculumPlans` 会重排顺序；匹配率 <80% 时放弃合并，保留骨架以免打断进行中的任务。合并只替换 name/reason/estimatedMinutes/priority/knowledgeTags，保留 id、sequenceOrder、status、locked。
- 「AI 换一个」：前端先写本地变体（`LOCAL_VARIANTS`：变式练习/错题重做/知识梳理，`aiPending: true`），实测 0.13 秒生效；AI 结果回来后覆盖并清掉标记。模型慢或失败时本地变体仍可用。
- 加载文案：摸底按钮下显示「正在按所选专题逐题生成，约 15–25 秒」；计划页骨架任务显示「AI 优化中」标签。
- 科目级「清空该科目计划」（2026-11-09）：`PlansView.vue` 科目行从 `<button>` 改成 `<div role="button">`，否则内部放 `el-dropdown` 会出现按钮嵌套；`⋯` 菜单只在科目未折叠时也不能误触，外层 `@click.stop` 阻止展开。删除范围只删 `plans`，保留测试成绩、专注记录与掌握度（用户选 A），删除前逐个 `clearTaskReminder`。
- IndexedDB 写入陷阱（2026-11-09）：把 Vue 响应式代理直接 `db.put` 会抛 `DataCloneError`，旧代码静默降级到内存 Map，表现为「刷新后计划与资料全丢、诊断页按钮全部禁用」。修复是在 `db/index.js` 的 `put` 与 `saveSettings` 写入前 `JSON.parse(JSON.stringify(...))` 转普通数据；项目所有入库字段都是 JSON 兼容（时间一律 `Date.now()` 数字），不要往库里写 Date/函数。
- 诊断页恢复时序（2026-11-09）：`onMounted` 的 `Object.assign(profile, old)` 会触发年级 watcher 清空科目，需在 `nextTick` 后补回科目，并用 `pendingChapterIds` 在章节加载完成时还原勾选；`loadChapters` 增加 `chapterRequestId` 丢弃过期响应，否则快速切换科目时旧列表会覆盖新选择。
- 端到端实测（真实 Chrome）：摸底 10 题 10.6 秒、提交到计划页可见 0.2 秒、8 条任务全部标记优化中、45 秒后标签清零且 8 条全部改名、控制台 0 错误。

## 章节测试中途退出与草稿（2026-11-12）

- 答题页右下角常驻悬浮「退出测试」：收起是胶囊按钮，展开显示「已完成 x/y 题 · 已用时长」与「保存并退出」；点确认后先写草稿再回选择页，选择页顶部横幅可「继续答题 / 放弃」。
- 草稿存 IndexedDB 新表 `quizDrafts`（固定 id `current`，DB_VERSION 5→6），字段含 questions/answers/selfGrades/answerImages/resultId/计时与年级科目章节元数据；`answeredCount` 用于横幅展示。手写照片以 dataUrl 随 answerImages 保存，恢复后能看，但 `photoFiles`（File 对象）不落库，OCR 需重新上传。
- 清理时机：交卷成功、开始新测试、用户放弃；路由离开 `onBeforeRouteLeave` 与 `visibilitychange=hidden` 兜底保存（后者不保证异步写完）。
- 恢复时 `startedAt = Date.now() - elapsedSeconds*1000` 接着计时；`restoring` 标志用于跳过 stage/grade/subject/mode 的联动 watch，否则会清空刚恢复的科目与章节。
- 验证：`npm test` 104 通过、typecheck、build 通过；浏览器实测退出时横幅显示「已完成 2/6 题」，继续后第 1 题答案保留、计时从 00:51 继续累加。

## 只做初中：全链路删除高中（2026-11-12）

- 产品定位收敛为只做初中，章节测试页去掉「初中 / 高中」学段切换，年级固定从初一/初二/初三里选；「新高考」文案、高中卷型分值全部删除。
- 后端：`server/curriculum.js` 只保留初中课程目录与初中离线题库，删掉高中课程方案来源、高一/高二/高三全部章节、高中物理离线题生成器与高中专题别名；`listCurriculumSubjects(grade)` 不再接收学段参数，永远返回 `stage:'初中'`。`server/quiz.js` 只保留初中卷型（单选 3 分 / 填空 3 分 / 解答 6–12 分），删除高中多选兜底题与多选判分分支。`server/prompts.js` 的规划/答疑/诊断/章节测试提示词统一改成初中口径。
- RAG：`server/rag/index.js` 在检索候选循环里直接跳过 `stage==='高中'` 的片段；`scripts/build-rag-index.py` 默认只扫 `中考/`，即使本机有高考语料也不会进入新索引。`server/videos.js` 保留「初中搜索排除高中视频」的反向过滤，这是防串味的初中功能，不是高中功能。
- 本机既没有 `中考/` 也没有 `高考/` PDF 源目录，无法重建索引；现有索引里残留的高考块全部在检索阶段被过滤，不会出现在答疑引用里。
- 验证：`npm test` 102 通过（删掉 2 个高中用例）、typecheck、build 通过；`/api/curriculum/subjects?stage=高中` 返回 `stage:'初中'` 且 grades 只有初一/初二/初三；浏览器实测测试页无「高中」「新高考」「当前学段」。开发服务已用 `npm run dev` 重启。
- 2026-11-12 追加：按要求彻底删除 `server/videos.js` 的高中视频过滤（`STAGE_NOISE`、`stageOf`、`matchesStage` 及对应单测），`pickVideoBatch` 不再接收 `grade`；视频只保留章节相关性与旧/快/版本原因过滤。`npm test` 101 通过。

## 教材版本与长短板视频（2026-11-10）

- 初中面向全国，教材版本目录在 `server/textbooks.js`：数学（人教/北师大/苏科/华师大）、英语（人教/外研/译林/仁爱）、物理（人教/苏科/沪科）、化学（人教/沪教/鲁教）；语文、历史、道德与法治全国统一统编版，生物、地理暂按人教版。
- 版本数据是**单元主题**，不是出版社逐字目录，UI 已注明。人教版与统编版直接复用 `curriculum.js` 原有专题，章节 id 不变，避免已保存的掌握度与计划断裂；其他版本 id 带 slug：`${年级}-${科目}-${slug}-${序号}`。因此换版本会自然清空不匹配的勾选。
- API：`/api/curriculum/subjects` 增加 `editions` 映射；`/api/curriculum/chapters` 接受 `edition`；摸底与章节测试请求都透传 `edition`，服务端用 `resolveTextbookEdition` 兜底默认版本，并在提示词里带 `textbookEdition`。
- 前端：`DiagnosisView` 增加教材版本下拉，`ensureEdition()` 在切科目/年级时回落默认版本；计划与测评记录写入 `edition`；`QuizView` 从 URL 或计划记录取版本，再加载章节、出题、保存成绩。
- 摸底结果页新增「长短板与视频补强」：掌握度 ≥2 为掌握较好，其余为补强；视频按钮由 `src/utils/videos.js` 拼 B 站搜索链接（版本 + 年级 + 科目 + 章节 + 同步课程），不写死 BV 号，避免 UP 主删稿后失效。
- 卷型文案统一改为全国口径：初中「全国中考常见结构」、高中「新高考结构」，不再写佛山/广东命题（`prompts.js`、`quiz.js`、`HomeView.vue`、`QuizView.vue`）。
- 排坑：`node server/index.js` 没有 watch，改后端后必须重启；`Start-Process` 启动的进程随后续命令结束会被回收，验证时要放到后台 Shell 里跑。
- 已删除「偏好方式」控件（learningStyle 只是假个性化，不进入计划逻辑）。目标分数改为「目标分 + 本科满分」，并与 `examScores` 里最近一次成绩组成差距（具体系数见下方连续系数一条）；无成绩基线时不调整。`buildAdaptivePlan` 新增 `edition/targetScore/targetFullScore/baselineScore` 参数。
- IndexedDB 升到 v5，新增 `examScores`、`mistakes` 两个 store，并加入账号同步列表。错题归因组件 `MistakeAttribution.vue`：本地 OCR（tesseract，首次需下载模型）→ 用户可改文字 → 选章节保存 → 按章节聚合薄弱点 + B 站搜索补强链接；只保存文字与章节，不存图片，也不覆盖摸底掌握度。
- 数据来源现在有摸底、章节测试、学校成绩、错题四个；后续若把成绩/错题写进掌握度，必须先定义权重与来源标签，避免结论互相矛盾。
- 掌握度合并已实现：`src/utils/mastery.js`（纯函数 + 单测），摸底权重 1、章节测试 1.2、错题 0.8（每题扣 0.4、上限 1.2），21 天半衰期；主观题未自评不计入；学校成绩不进章节分。结果页来源标签与置信度（低/中/高）直接来自这里。
- OCR 改为 worker 单例 + `prewarmOcr()` 空闲预热，不再每次识别重建（原实现每次 createWorker/terminate，重复下载字库）。
- 计划任务现在会写 `grade` 字段；历史计划没有 grade，`PlansView.rebalanceByScore` 用章节 id 反查摸底记录或退回档案年级。重算只改未归档任务的 `estimatedMinutes`，不重排顺序。
- 成绩差距改为连续系数：概念 0.85+gap×1.2（上限 1.35）、迁移 1.2−gap×1.2（下限 0.9）、复盘 1+gap×1.2（上限 1.35），无成绩基线不调整。
- 目标分改为按科目存 `profile.targets[subject] = { score, full }`（各科满分不同：语数英默认 120，其余 100）。`DiagnosisView` 用可写 computed `targetScore/targetFullScore` 代理，`ensureTarget()` 在切科目时补默认值；旧档案顶层的 `targetScore/targetFullScore` 在 `onMounted` 迁移后删除。`PlansView.rebalanceByScore` 取 `profile.targets[first.subject]`，老数据回退顶层字段。
- 考试录入改为「按场次多科」：`examForm.rows` 按年级科目生成勾选行，未勾选/留空按缺考处理不写 0；同场记录共享 `examId`，`examSessions` 按 `examId || name-createdAt` 聚合总分与日期，删除时整场删除。
- 摸底选项联动根因：摸底按题位逐题请求 DeepSeek，提示词固定 `"id":"q1"`，服务端原样采用模型 id，10 道题共用一个答案键。修复：`stampDiagnosticQuestionIds()` 在合并后按题位重发唯一 id（`diag-<位>-<时间戳>`），`server/agent.test.js` 有回归用例。修复前的历史摸底记录作答无法准确还原，回看时显示警告。
- 摸底报告二次查看：`persistPlans()` 会把当时的专题、计划、解释写回 assessment 记录；诊断页「上次摸底」卡片 → `openReport()` 还原只读报告（雷达、计划编排、长短板、答案解析）。老记录缺计划快照时显示提示，不伪造。
- 教材单元标注：`server/curriculum.js` 的 `renjiaoUnitLabels` 只给人教版数学（章号）和英语（Unit 范围）加 `unitLabel`，不改章节 id；其他版本留空，前端不显示。
- 专题选择与成绩录入对话框都加了「全选」，只改勾选状态，不动已填分数。
- 登录保持：不存明文密码。登录页加「7 天内自动登录」复选框（默认勾选），前端把 `remember` 传给后端，`createSession(user, remember)` 决定 Cookie 是否带 `Max-Age`（不勾选就是会话 Cookie）；邮箱/密码输入框加 `autocomplete` 交给浏览器密码管理器。
- 同步改为「迁移」：同步成功后 `clearLocalLearningData()` 清空本地学习数据（保留设置），避免每次登录重复提示，也防止同一批数据串到别的账号。弹窗确认按钮为「同步并清空本地」。
- 长短板左右两列在任一侧为空时自动折叠为单列（`.strength-grid.single`），空列不再渲染；「掌握较好」= 合并掌握度 ≥2/3（摸底单源约等于加权正确率 60%）。

## 视频推荐（2026-11-11）

- 本机接手环境：工程路径 `D:\aaa\ai-teach`（旧记录里的 `D:\trae-work`、`D:\AI-Teach-project` 属于上一台机器）；已从 `.env.example` 生成 `.env`，`DEEPSEEK_API_KEY` 留空待填（只记位置，不记值）；已 `git init` 并打基线提交 `a3e10b0`。
- 上游接口：B 站 `GET https://api.bilibili.com/x/web-interface/wbi/search/type?search_type=video&order=click&keyword=...&page=N`，带桌面 UA + `Referer: https://www.bilibili.com/` 即可，**无需 WBI 签名**（2026-11-11 实测可用；仍有 412 风控风险，因此必须留兜底）。
- 服务端 `server/videos.js`：两页并发抓取（`Promise.allSettled`，一页成功即用），15 分钟内存缓存（上限 50 个关键词）；过滤 `type=ketang`、广告 `is_union_video`、教资/试讲/课件类噪声；`pickVideoBatch` 是纯函数，负责 exclude、UP 主屏蔽与原因过滤。
- 排序与过滤口径：先按教材版本匹配分组，组内按播放量降序（用户要求「按播放量排序」，但版本不对的视频不能压过匹配项）；`isRelevantVideo` 要求标题/标签含章节名或其拆分片段（否则「二次函数」会混进「一元二次方程」）；「太旧」= 两年内、「讲得太快」= 8 分钟以上（元数据判断不了语速，只能按时长兜底）。
- API：`GET /api/videos/recommend?grade&subject&edition&chapter&exclude=bvid,bvid&authors=UP主&reason=old|fast|edition|author&limit`；上游失败时返回 `success:true` + 空 `items` + `fallbackUrl`（B 站搜索页），前端展示兜底入口而不是报错。
- 前端 `src/components/VideoSuggestion.vue`：在章节行内展开，最多 5 次换一换；「不喜欢这个老师」会把当前 UP 主加入屏蔽名单，其它原因交给后端过滤；5 次用完给文案 + 去 B 站搜链接。`DiagnosisView` 只维护 `activeVideoChapter` 一个状态，摸底结果页与二次查看报告两处复用同一组件。
- 验证：`server/videos.test.js` + `src/utils/videos.test.js`，全套 80 项通过；临时预览页实测 3 条真实结果、点换一换后剩余次数 5→4 且列表变化、控制台 0 报错。改后端后必须重启 dev server（`node server/index.js` 没有 watch）。
- 面板 UI 修复（2026-11-12）：`VideoSuggestion.vue` 由虚线占位框改为实线卡片 + `--surface-soft` 底；视频条目去掉逐条边框、改为分隔线列表（hover 用 `--surface`），补 `focus-visible` 焦点框；元信息 11px→12px 并对齐数字；「去 B 站搜」加下划线。用 Vite 根目录临时预览页复刻诊断页宿主样式，在 1440px 与 500px（Chrome 无头最小窗口宽）及深色主题下截图核对，验证后已删除临时文件；`npm test` 101、`npm run typecheck`、`npm run build` 通过。
- 页内播放（2026-11-12）：点击视频条目改用 B 站官方站外播放器 `https://player.bilibili.com/player.html?isOutside=true&bvid=...&p=1&autoplay=1&high_quality=1`，在 `el-dialog`（宽 `min(980px, 92vw)`、16:9）里弹窗播放，不再跳新标签；`Ctrl/Cmd/Shift` 或中键仍保留浏览器默认新标签行为；`destroy-on-close` 保证关闭即卸载 iframe 停止播放；禁止站外播放的视频在弹窗底部给「在 B 站打开」兜底。浏览器实测自动播放、控件正常、关闭后播放器移除。
- 离线题库（2026-11-13）：题库落盘在 `server/data/question-bank/{年级}/{科目}/{教材版本}/{章节id}.json`，结构为 `{grade,subject,edition,chapter,generatedAt,source,count,questions[]}`。加载器 `server/question-bank.js`（进程内缓存，生成新文件后必须重启 API 才生效）；摸底 `buildAssessmentResult` 先用 `pickBankQuestions` 按题位抽题（同维度优先、同卷不重复、支持按版本回退），缺口才调模型。生成脚本 `node scripts/build-question-bank.js`（`--grades/--subjects/--chapters/--count/--concurrency/--editions/--all-editions/--force/--dry-run/--base-url`），走本地 `/api/agent/assessment/generate` 复用 prompt 校验与 RAG，`bypassBank:true` 防止用旧题覆盖旧题；单章多轮补题 + 题干 LaTeX 归一化后近似去重。默认范围 144 章（每章 10 题约 1440 题），全部版本 358 章。题库是只读静态 JSON，随项目打包分发即可，别人无需模型 key；但必须跑完整 Express 服务，只部署前端 dist 无法抽题。实测：单章生成 25–45 秒，题库命中后 `/generate` 0.11 秒返回 `source=question-bank`；`npm test` 109、typecheck、build 通过。

## 第一期体验修改（2026-11-13）

- 章节测试结果页（`QuizView.vue`）：顶部新增吸顶操作条，`返回学情诊断` 从底部移上来；选择题直接渲染选项列表，正确项绿色、选错项红色并带「你的选择 · 正确/错误」标签；解析默认展开、逐题可收起；错题自动写 `mistakes`，id 固定为 `mistake-quiz-${年级}-${科目}-${questionId}`，同一题重复答错只更新、之后重做答对自动删除。答题页仍是交卷后统一判分，未改成边选边判。
- 结果页底部按钮区 `.quiz-float` 从 `bottom:24px` 抬到 `88px`：原来展开「退出测试」面板会压住「交卷并查看批改」，自动化实测点不到。
- 成绩录入（`DiagnosisView.vue`）：去掉「先选年级和科目」拦截；年级改在弹窗内选，`loadExamSubjects()` 按弹窗年级拉科目并重建勾选行；保存写 `examForm.grade`，成绩列表不再按档案年级过滤，场次显示年级。目标分/试卷总分标签改为「目标分（想考到多少，最高 N 分）」「试卷总分（学校卷面满分）」，并给弹窗科目行加「得分 / 满分（卷面总分）」表头。
- 摄像头预览（`CameraMonitor.vue`）：compact 高度 96px → 300px；头部加「收起/展开预览」，折叠只把 `.video-wrap` 缩到 2px 移出视口，video 继续播放，`requestVideoFrameCallback` 检测循环不受影响（不能用 display:none）。
- 全站意见反馈：新增 `src/components/FeedbackWidget.vue`，挂到 `AppShell.vue`，左下角悬浮；写 `feedbacks`，带 `type:'site'`、`page`、`category`、`contact`，与专注页反馈共用一张表。底部左下位置与答题页右侧退出胶囊、专注页 AI 气泡不冲突。
- 验证：`npm test` 109、typecheck、build 通过；浏览器实测诊断页无前置拦截、弹窗有年级选择、反馈按钮存在。章节测试结果页因自动化点击被悬浮「退出测试」误触，未完成端到端实测，已按代码与构建结果自检。

## 第二期：错题库页（2026-11-13）

- 新增 `src/views/MistakesView.vue`（路由 `/mistakes`，导航入口在「学情诊断」之后）：按年级/科目/来源筛选，统计错题总数、覆盖章节、近 7 天新增；按「年级+科目+章节」聚合错得最多的章节；每条记录展示题干、你的答案、正确答案、可折叠解析，支持确认后移除。
- 数据来源：章节测试错题由 `QuizView.syncMistakes` 写入，手动错题由 `MistakeAttribution` 写入。错题 id 规则 `mistake-quiz-${grade}-${subject}-${questionId}`，重做答对自动删除；手动错题 id 仍为 `makeId('mistake')`。
- 验证：build、typecheck 通过；浏览器实测页面渲染、导航高亮、空状态均 PASS。
- 第二期已全部收尾（导航精简、小精灵完成，见下节）。

## 第二期收尾：导航精简 + 小精灵（2026-11-13）

- 导航精简：`AppShell.vue` 的 `nav` 从 10 项收敛为 7 项「主页 / 学情诊断 / 学习资料 / 错题库 / 学习计划 / 专注空间 / AI 答疑」；`/paper-scan` 入口移到学情诊断页头部「试卷识别」按钮，`/dashboard` 入口移到首页 hero「学习看板」按钮，`/settings` 入口移到桌面导航右侧与移动端顶栏的「设置」按钮。路由与功能全部保留，只改入口；设置项移出后 `nav-divider` 样式一并删除。
- 小精灵：新增 `src/components/SparkAssistant.vue`，挂载在 `AppShell` 根节点并用 `v-if="!isFocus"` 避开专注页。右下角悬浮按钮 + 迷你对话面板（意见反馈在左下角，两者不重叠）。复用 `streamTutor`（`mode:'explain'`、`sessionId:'spark'`），会话只存内存、不写 IndexedDB。页面感知由前端把「当前页面」与「学习档案（年级/科目/版本）」拼进 question 实现——后端 `/api/agent/tutor/stream` 的 `context` 只供工具使用（recentFocus/visualStatus），不会自动进入提示词。快捷问题按路由映射（资料/诊断/错题/计划/答疑/看板/设置/主页），「展开完整答疑」带最近问题跳 `/tutor?q=`。
- 验证：`npm test` 115 通过、typecheck/build 通过；浏览器实测 7 项导航且无旧入口、设置/试卷识别/学习看板入口均可达、小精灵打开→快捷提问→流式回答→展开完整答疑预填全部 PASS。

## 第三期：学习效果看板增强（2026-11-13）

- 范围：按「学习效果优先」增强 `DashboardView.vue`，在原专注与习惯区之上新增学习结果区；时间窗默认近 30 天，新增近 90 天选项。
- 新增指标：测试平均正确率（按题量加权）、新增错题、考试平均得分率、覆盖章节；规则化 NEXT STEP 建议最多 3 条（薄弱科目、集中错题章节、考试进退步、无数据空态）。
- 新增图表：测试正确率趋势、各科测试正确率、错题最多章节 Top6、学校考试成绩趋势（同 `examId` 合并多科总分）。
- 数据源：只读现有 IndexedDB 的 `quizResults` / `mistakes` / `examScores`，不新增表、不改后端。
- 纯函数：`src/utils/learningStats.js`（`quizAccuracyOf`、`subjectAccuracyRows`、`wrongChapterRows`、`examSessionRows`、`examAverageRate`、`learningSuggestions`），并新增 6 个单测。
- 验证：`npm test` 121 通过、typecheck/build 通过；浏览器实测四个 KPI、NEXT STEP、四个新图表、专注区均正常渲染，控制台无报错，DOM 标题与 KPI 卡片各只出现一次。
- 专注习惯增强（同日）：`DashboardView.vue` 专注区改为 6 个 KPI（累计专注、完成率、真实分心、连续学习、平均每次分心、本周较上周）+ HABIT CHECK 习惯洞察；原「分心统计 / 视觉监督离岗记录」两张图替换为「专注时段分布」（24 小时，标出峰值）与「分心与视觉提醒」（页面切走/视觉离岗/犯困/扭头/多人/低头）。统计统一排除 `demo-away`、`source:'demo'` 与 `false-positive`。纯函数在 `src/utils/focusHabits.js`（`hourBuckets`、`focusStreak`、`weekComparison`、`distractionBreakdown`、`habitAdvice`），新增 6 个单测；`npm test` 127 通过，typecheck/build 通过，浏览器实测六卡片、HABIT CHECK、两张新图与控制台无报错。

## AI 链路验证（2026-11-11）

- `.env` 已由老大填入有效 key（只记位置：项目根 `.env`，已被 gitignore）；`LLM_BASE_URL=https://api.deepseek.com`、`LLM_MODEL_NAME=deepseek-flash` 可直连，无须代理或 `NODE_EXTRA_CA_CERTS`。
- 密钥核查（2026-11-12）：本地 `.env` 的 key 与 `D:\aaa\ChatCPT-Codex\AI-Teach\transfer-package-with-key` 等旧包中泄露的 key **完全相同**（35 位）；用该 key 请求 DeepSeek `/models` 返回 200，说明旧 key **仍有效、未作废**。不存在「已换新 key」，必须去控制台新建 key 并吊销旧 key，再替换 `.env` 并重启服务。
- 实测：摸底 `/api/agent/assessment/generate` 3 题 8.6 秒、`source=deepseek`；章节测试 `/api/quiz/generate` 5 题 8.0 秒、`source=deepseek`；流式答疑 `/api/agent/tutor/stream` 事件序列为 meta → thinking(518) → token(440) → tool(4 次 RAG) → done，约 40 秒内完成，答案引用了真题解析。
- 浏览器实测 `/tutor`：发送后约 6 秒开始流式输出，答案完整呈现，控制台 0 error。
- 未覆盖：无（计划生成与迭代已于 2026-11-12 补测，见下）。
- 补测：`/api/agent/diagnose` 15.8 秒返回 4 个阶段任务（source=deepseek，任务名/理由/时长均为模型生成）；`/api/agent/iterate` 10.5 秒返回 4 个调整后任务（source=deepseek，说明里明确引用了「变式题全错、图象平移没吃透」的反馈）。

## 账号体系决策（2026-11-12）

- 定为**本地优先**：账号只解决本机多用户隔离，凭据存 `server/data/users.json`（已有原子写临时文件 + rename，不改成数据库）；学习数据继续存浏览器 IndexedDB（按账号分库），不上云。
- 理由：参加评审的隐私卖点就是「数据不出本机」；上服务端持久化要引入数据库和鉴权同步，收益低、风险高。代价是换设备/清缓存会丢数据，用**手动 JSON 备份**补：`src/utils/backup.js`（结构校验）+ `db/index.js` 的 `exportLearningData` / `importLearningData`；入口放在「系统设置 → 数据备份」（`DataBackupCard.vue`），因为账号中心需要登录，未登录用户也要能备份；账号中心只保留账号信息与退出。
- 导入语义：按记录 id 覆盖（put），不删除现有数据；设置属于设备偏好，不导出；导入成功后整页刷新。
- 登录方式同步定为「邮箱 + 口令，本机账号服务，不接第三方」。

## 静态知识点讲解包（2026-11-13）

- 背景：老大要求章节讲解「点开即见」，不能点击后才调模型（浪费 token 且慢）。样板为上传的「一元二次方程」讲解图：标题「知识点讲解」+ 右侧「AI 讲解」徽章 + 生活化 intro + 绿点要点 + 3 张公式卡。
- 实现：`server/lessons/` 按学科 9 个文件（math 26、physics 14、chemistry 7、english 18、chinese 18、history 16、geography 15、biology 15、politics 15，共 144 章）+ `index.js` 聚合。`getLocalLesson({grade,subject,chapterName,unitLabel})` 命中返回 `source:'pack'`；目录外章节（其他教材版本多出的单元）返回 `source:'local'` 基础讲解。讲解随 `GET /api/materials/chapter` 的 `lesson` 字段一次返回。
- 删除：`server/lesson.js`、`GET /api/materials/lesson`、前端 `getChapterLesson` 与讲解骨架屏；讲解不再进 `cachedGenerate`，运行时零 LLM 调用。
- 前端：`MaterialsView.vue` 直接用 `detail.lesson` 渲染，徽章 `pack → AI 讲解`、`local → 基础讲解`。
- 验证：`server/lessons/lessons.test.js` 3 个用例（144 章覆盖、目录外 fallback、重复取用一致）；`npm test` 181 通过、typecheck/build 通过；API 巡检 144/144 章为 `pack`，旧 lesson 端点 404；CDP 实测初三数学「一元二次方程」点开即显示 5 条要点 + 3 张公式卡，与样板一致，无骨架屏、无报错。
- 维护提醒：新增章节或换教材版本时，目录名不在静态包内会落到 `local` 基础讲解，需要补对应 `server/lessons/<subject>.js` 才有专属内容。

## 标点归一化：全角点句号 + ∵/∴ 间距（2026-11-13）

- 背景：老大上传真题截图，要求句末全角点「．」显示成中文句号「。」，`∵`/`∴` 与后文之间留一个空格，且所有板块统一。
- 落点两处：`server/exam-text.js` 的 `cleanSymbols()` 管入库文本；`src/utils/formatMath.js` 的 `formatMathText()` 链首兜底，覆盖学习资料、真题参考、答疑、错题、章节测试等所有 `v-html` 渲染。
- 规则：`([\u4e00-\u9fa5])．(?=[\u4e00-\u9fa5]|$|\s)` → `$1。`；`．(?=$|\s)` → `。`；`([∵∴])[ \t]*(?=\S)` → `$1 `。
- 保护：小数点（`3．5`）后面跟数字，两条句号规则都不命中；`A．甲` 这类选项标签后接内容也不改；`故选A．` 这种句末仍会转成 `故选A。`。`reflowText` 的空选项行过滤扩成 `^[A-D][.．、。]$`，`A．` 转成 `A。` 后照样剔除。

## 错题库改版：学科栏 + 知识点归纳（2026-11-14）

- 按老大设计稿重写 `MistakesView.vue`：左侧「按学科」栏（全部/各科数量、本周新增、已消灭、本周重做正确率），主区大标题「还有 N 道没消灭」+「今日已消灭 N 道」，学科卡片「科目 · N 道待消灭」+「开始重做 N 道」。
- 保留：右上「上传错题照片」（`MistakeAttribution` 表单）、搜索、年级/来源筛选、状态筛选、行展开详情、标记已消灭、删除、J/K/↑↓/Enter/M 快捷键、通知中心 `filter=stale`。**删除**「去章节测试」入口（旧头部按钮与空态按钮）。
- 口径：`pointName = knowledgeTags[0] || chapterName || '未归因知识点'`；`wrongCount = 1 + redoHistory 中答错次数`，列表按错次降序、同错次按收录时间降序；`subjectRows` 跟随状态/年级/来源；`pointScope` 同样跟随状态/年级/来源（切「已消灭」时面板数量与列表一致），搜索与知识点过滤不影响概览；归纳条只在待消灭/超 7 天显示。
- 交互：知识点浮层锚在卡片头，横向条形图按数量排序，点行或「只看这 N 道」写入 `activePoint` 过滤，再点取消；底部「看归纳」先滚回卡片再开浮层；「开始重做 N 道」用 `redoQueue` 队列，弹窗底部显示「第 x / N 道」并支持「下一道」。行展开与解析展开拆成 `expanded` / `explainOpen` 两套状态。
- 验证：`npm test` 185 通过、typecheck/build 通过；CDP 写入 30 条演示错题实测桌面 1440×960 与移动 390×844：无「去章节测试」、上传弹窗可开、数学 9 道 / 一元二次方程 5 道浮层 / 只看 5 道 / 重做队列第 1/9 道 / 展开详情 / 搜索 / 快捷键 / 已消灭 2 道 + 面板同步均 PASS，移动端无横向溢出、浮层在视口内，控制台 0 报错。截图在 `D:\trae-work\tmp\cdp\mistakes-redesign-*.png`，脚本 `verify-mistakes-redesign.mjs`（跑完自动还原原数据）。
- 知识点分布改饼图（同日）：纯 SVG 圆环描边实现，不引图表库。`pointSlices` 取数量前 5 个知识点，其余并成「其他 N 个知识点」，扇区色板 `#2f6f5e / #4d8d8e / #82b4a8 / #b3cdc1 / #e0b271 / #c9c2b4`；`pointArcs` 用 `stroke-dasharray`（占比 × 周长 − 3 缝隙）与负 `stroke-dashoffset` 拼接，多段间留 3 单位缝，单段不裂缝。图例显示数量与百分比，点击即 `filterPoint`；「其他」禁用不筛选。浮层宽度 360→400，移动端 ≤420px 饼图缩到 96px。
- 重做队列交互（同日）：弹窗顶部加进度条（第 x / N 道 + 本组已答对 y 道），`redoSessionResults` 只记本轮不落库；数字键 1–4 / A–D 直接选项，判分后把焦点交给「下一道」，回车可连做；未答时可「跳过这道」，最后一道显示「这一组 N 道都过完了，答对 y 道」；`@closed` 统一走 `closeRedo()` 清队列与统计。弹窗打开时页面 J/K/1/2/3 快捷键让位，避免背后偷偷切筛选。
- 验证：CDP 实测数学 9 道饼图 4 扇区（56/22/11/11）、点图例筛出 5 道、全部学科 27 道出现「其他 10 个知识点 12 · 44%」；重做队列数字键选对后焦点落到「下一道」、回车进入第 2/9 道、连续跳过到 9/9、收尾统计「答对 2 道」、关闭后进度块清除；移动端 390px 浮层 335px 在视口内、无横向溢出，控制台 0 报错。截图 `mistakes-pie-*.png`、`mistakes-redo-*.png`，脚本 `verify-mistakes-pie-redo.mjs`。
- 验证：`npm test` 183 通过（比上轮多 2 个用例）；typecheck / build 通过；API 巡检 144 章 → 句末全角点 0 条、∵/∴ 无空格 0 条；「初二-数学-8 一次函数」第 11 题（众数）实测输出 `数据2，3，5，5，4 的众数是____。`、`解：∵ 5 是…，∴ 这组数据的众数为5。`。
- 保留原样：选项标签 `A．…`、编号列表 `1．…` 不属于句末，不改写。

## 错题库：知识点分布移到左栏（2026-11-15）

- 知识点分布从卡片头部的 `el-popover` 移到左侧 `.subject-rail` 内的 `.point-rail`，用 `v-if="subject"` 控制：选中单个科目才显示，全部学科时不渲染；卡片头只保留标题。桌面窄栏环形图 104px 居中、图例竖排，≤900px 时图例与环形图并排占满整行。
- 「看归纳」改为滚到 `.point-rail`，且仅在选了科目时渲染；删除 `knowledgePopoverVisible`、`.point-trigger`、`.point-popper` 等原浮层代码与样式。`pointScope` 仍跟随状态/年级/来源，图例点击 `filterPoint` 与列表联动不变。
- 文案统一：用户可见的「重做」全部改「复习」（行内按钮、开始按钮改为「开始复习」、暂无待复习、Enter 复习、本周复习、上次复习、错题复习弹窗等），内部函数名与注释保留 redo。
- 验证：typecheck/build 通过；CDP 1440：全部学科无左栏面板、10 行；选数学后面板在 aside 内且在正文左侧，标题「知识点分布 8 道」，图例「等式加减 5 · 63% / 移项合并 3 · 38%」，点图例后列表 5 行；页面无「重做」文案；375 无横向溢出、面板全宽并排；控制台 0 报错。截图 `mistakes-rail-1440.png`、`mistakes-rail-375.png`，脚本 `cdp-mistakes-rail.py`。

## 学习资料页气泡化改造（2026-11-13）

- 需求：按老大两张手绘稿改版——左侧「筛选卡 + 掌握度卡」，右侧大圆环里放知识点气泡（球的大小=章节重要度，点击先缩一下），点开是近乎全屏的圆角浅青大窗口，整章资料都在里面。
- 实现：`src/views/MaterialsView.vue` 整体重写。筛选仍走 `getCurriculumSubjects/getCurriculumChapters`，版本优先用户 profile；气泡用绝对定位 + rAF 布朗漂移 + 圆环边界反弹，`prefers-reduced-motion` 时静止，大窗口打开时暂停；点击后延迟 130ms 弹窗，保留按压缩放反馈。
- 气泡排布（2026-11-13 三次调整）：所有球从圆心附近出发，靠碰撞分离挤成紧密一团（允许 16px 重叠），不再按轨道散开；尺寸档位 212/190/142/118/102（重要度 5→1）再按容器宽度缩放（≥720px 时不再缩），字号用 `--bubble-size` 跟随球径；边缘用径向渐变到透明 + 柔和投影虚化，大圆用 `::before` 模糊细环 + `::after` 柔光，全部无硬描边。移动端大圆外发光 `inset:-8px`，再大就会带来 3px 横向溢出。
- 气泡拖拽（2026-11-13 三次调整）：pointerdown/pointermove/pointerup/pointercancel + `setPointerCapture`，`.bubble` 加 `touch-action:none` 防止移动端拖球时页面滚动；位移 >5px 判定为拖拽，拖拽球位置由指针接管（`tick` 跳过它、`clampPoint` 限制球心不出圆环），松手把最近一帧速度（clamp ±4）作为甩动初速继续滚；拖拽后 350ms 内的 click 被忽略，避免甩球误弹大窗口，键盘回车仍能正常打开。
- 撞击手感（2026-11-13 三次调整）：拖拽碰撞不再只是位移顶开，而是把拖拽速度投影到撞击法线作为冲量（`impact*1.6`，上限 4）赋给被撞球，位置分离降到 0.9 倍避免瞬移；普通球间速度传递系数 0.35→0.45，被撞球还能继续传给下一个球；`tick` 每帧把 `drag.vx/vy` 乘 0.84，指针停住后不会按旧速度持续施力。
- 空闲回吸（2026-11-13，两次调参）：2 秒无操作后进入松弛态——中心 62% 半径以内不再施力，只有明显偏离的球才获得很小的向心力（0.002px/帧²，越靠外略强），回吸速度实测约 6px/秒；空闲时摩擦改为 0.972，还在飞的球平滑减速，不会在空闲判定那一帧被硬性截停；球与球贴住时加一点缓慢斥力（上限 0.006），把原先 -16px 的重叠慢慢摊开成「挨着但留缝」的松散团。`pointermove/pointerdown/wheel/scroll` 都会重置计时，拖拽中不触发。
- 掌握度卡：`loadAssessments/loadQuizResults/loadMistakes` + `mergeChapterMastery`（与学情诊断同口径），显示平均掌握度环和最弱的 3 个知识点；无记录时显示「去摸底」。气泡三档配色：未测=浅青、<1.5=暖橙、≥2.4=深青。
- 大窗口：Teleport 到 body + 自定义 overlay，`width:min(1060px,94vw)`、`height:min(86vh,920px)`、圆角 34px，左上「知识点」标签；内容复用整章载荷（讲解/相关/例题/真题/视频/行动按钮），ESC、遮罩、× 都能关，打开时锁 body 滚动并暂停气泡动画。
- 顺带补渲染：`formatMathText` 增加 `\triangle \cong \angle \parallel \perp \sim \because \therefore` 和 `^\circ`→`°` 替换，例题里不再露原始 LaTeX。
- 验证：`npm test` 184 通过、typecheck / build 通过；CDP 1440×950：9 个气泡全部定位、0 个溢出圆环、无控制台报错；尺寸实测 186/139（该目录只有重要度 5 和 3），相邻球最小边缘间距 -16px 即按预期重叠；鼠标拖拽 170×95 后球位移 154×93、`.dragging` 高亮生效、松手 520ms 内继续惯性滚动 11×39、未误开大窗口；撞击测试：A 拖 188px 撞最近的 B 后停住松手，B 在 420ms 内继续弹开 48px、其中 88% 沿撞击方向，未误弹窗；空闲松弛/回吸（第二次返工后）：闲置后球团 36 对里 33 对贴住但最小边缘间距 -4px（不再是 -16 的压死状态）、平均球心距 167；边缘球停手后距离 252→231.7→214.4（前 3 秒约 6.9px/秒、后 3 秒 5.7px/秒，属于缓慢漂回）；抛出后每 200ms 位移 22/20/12/10/11/9/5/4/4/1，空闲判定那一帧没有断崖；控制台 0 报错；移动端 390×844 触摸拖球同样生效（拖拽态命中、球跟随移动、`scrollY` 始终为 0、不误弹窗）；普通点击仍弹出 1060×817 大窗口，四个分区齐全；关闭后 body 滚动锁恢复；390×844 单列无横向溢出，大窗口 370×776。
- 证据：`D:\trae-work\tmp\cdp\bubbles-desktop.png`、`bubbles-mobile.png`、`bubble-modal.png`、`bubble-modal-mobile.png`，验证脚本 `D:\trae-work\tmp\cdp\verify-bubbles.mjs`（拖拽/惯性/弹窗）、`verify-touch-drag.mjs`（移动端触摸拖拽）、`verify-impact.mjs`（撞击反弹冲量）、`verify-idle.mjs`（空闲回吸 A/B）、`verify-idle-relax.mjs`（松弛团/慢回吸/抛出衰减），截图 `idle-relaxed.png`、`idle-relaxed-after-pull.png`。

## 学习资料搜索（2026-11-13）

- 需求：用户记不住知识点在哪个年级，搜索要跨年级；输入关键词时下方出现相关知识点联想，点搜索或点联想直接弹出对应章节大窗口（旧版只把结果面板渲染在页面最底部，看起来像「点了没反应」）。
- 实现：`MaterialsView.vue` 搜索框加 220ms 防抖联想（2026-11-13 已扩到全学科：请求不传 grade / subject，结果带「年级 · 科目」标签，关键词用 `<em>` 高亮），联想项 mousedown 防失焦、点击直接打开；「搜索」按钮直接打开同名或第一条匹配。`openChapter(chapter, context)` 记录 `activeContext`，弹窗副标题与视频推荐使用章节实际所属年级/科目；检索索引 id 不带教材版本，打开前先拉目标年级/科目目录（当前版本找不到再回落默认版本）按章节名定位。删掉了旧的底部 `searchResult` 面板、「相关专题/真题片段」结果区和对应 CSS。
- 验证：CDP 输入「一元一次方程」出现 4 条联想（初一/初三/初二 数学，首条高亮全词），点首条弹出标题「一元一次方程」、副标题「七上 第3章 · 重点章节」的整章窗口（当前筛选仍是初二）；输入「勾股」点搜索直接弹出「勾股定理」；全学科：在初二数学页面输入「现在完成时」出现 2 条英语联想（初二/初一 · 英语），点开标题「现在完成时入门」、副标题「八下 Unit 8–10 · 重点章节」；无结果关键词只弹「没找到…」提示且不误开窗口；控制台 0 报错；`npm test` 184 通过、typecheck / build 通过。
- 证据：`D:\trae-work\tmp\cdp\search-suggest.png`、`search-open-by-suggest.png`、`search-open-by-button.png`、`search-all-subjects.png`，脚本 `verify-search.mjs`、`verify-search-all.mjs`。

## 相关知识点可继续跳转（2026-11-14）

- 需求：学习资料的知识点弹窗里，「相关知识点」原来只是纯文字标签，点了没反应；要求点它能继续弹出对应知识点。
- 实现：`MaterialsView.vue` 的 chip 改成按钮，`openRelated(name)` 先走 `/api/materials/search` 拿到该知识点的年级/科目（`related` 只返回名字，且检索跨年级），再复用 `openTopic` 按章节名定位并打开；`openTopic` 增加 `keepKeyword` 参数，相关知识点跳转不覆盖搜索框关键词。切换后把 `knowledge-body` 滚回顶部。
- 验证：浏览器实测从初一数学「三角形与全等」点 chip「相似三角形」，弹窗标题切到「相似三角形 九下 第27章」，讲解、例题、相关知识点全部换新且无报错（跨年级跳转正常）；`npm test` 187 通过、typecheck / build 通过。

## 公式排版不拆行（2026-11-13）

- 需求：公式不要从中间拆成两行；一行放不下时整条移到下一行，全站生效（老大截图里「去括号法则」的 `a−(b−c) = a−b+c` 被拆开）。
- 实现：`src/utils/formatMath.js` 在所有转换完成后，把「不含中文且带运算符」的片段包进 `<span class="math-nowrap">`——先把已生成的 HTML 标签寄存成占位符，避免正则误伤标签属性；超过 60 字符不包，防止撑出容器；英文句子没有运算符不包。`src/styles.css` 加 `.math-nowrap{white-space:nowrap}`，行末放不下时整条换行。
- 公式卡片：`MaterialsView.vue` 新增 `formulaLines/isAtomicFormula`，按 `；/;` 拆成多条各占一行；纯数学行加 `.is-atomic` 不拆行，含中文的说明行保持正常折行。
- 验证：`npm test` 185 通过（新增公式原子化用例，`√(2)` 旧断言同步更新）、typecheck / build 通过；CDP 打开「整式加减」：去括号法则变成 2 条完整公式，每条 `lineBoxes=1`、左右溢出 -1px；`He plays basketball...` 等英文句子不被误包；控制台 0 报错。
- 证据：`D:\trae-work\tmp\cdp\formula-wrap.png`，脚本 `verify-formula-wrap.mjs`、`check-format-math.mjs`。

## AI 答疑页改版（2026-11-13）

- 需求：按老大给的参考图重做 AI 答疑页——顶部主题色标题带、用户右侧浅色气泡、助手整段富文本、输入框始终贴在页面最底部。
- 实现：`TutorView.vue` 外层改为「主题渐变英雄区 + 可滚动对话区 + 贴底 composer」的整高 flex 布局（桌面 `height:calc(100vh - 84px)`，移动端 `calc(100dvh - 146px)`，composer 实测距底 12px）；输入框改成圆角大框 + 下划线工具栏（加图、引导/讲解模式、语音、发送），Enter 发送 / Shift+Enter 换行、兼容中文输入法；新增轻量 Markdown 渲染（标题、有序/无序列表、粗体、分隔线）+ `formatMathText` 公式排版，用户消息显示时间与复制，助手消息显示时间、复制、朗读。
- 背景：按主题色变量（`--bg`/`--primary-soft`）渲染，不再用大白卡片；页面本身就是对话界面，`AppShell.vue` 在 `/tutor` 隐藏 SparkAssistant 与 FeedbackWidget，避免压住底部输入框。
- 话题管理：历史话题下拉项右侧加删除按钮（`db/index.js` 新增 `deleteConversation`），点击弹二次确认；删除当前话题时直接重置 session，不能调 `newConversation`，否则会把刚删的聊天记录又保存回去。输入框工具栏顺序改为「讲解模式、引导模式」，讲解在前。
- 验证：typecheck / build / `npm test` 185 通过；CDP 1440×950：composer 距底 12px、页面不滚动、用户气泡右对齐、助手 h3 17.5px + 3 条有序列表正常、0 报错；话题下拉 2 项各带删除按钮、删除后库里只剩另 1 条、当前会话不受影响、模式按钮顺序为「讲解模式、引导模式」；移动端 390×844：hero 纵向堆叠、composer 在标签栏上方 11px、无遮挡。截图 `tutor-redesign.png`、`tutor-redesign-mobile.png`、`tutor-history-delete.png`，脚本 `verify-tutor-redesign.mjs`、`verify-tutor-history-delete.mjs`。

## 小精灵人形化 + 悬停环绕菜单（2026-11-14）

- 需求：老大给参考图（中心「小精灵」+ 四周浅青圆形气泡 AI答疑 / 学习资料 / 计划 / …），先要求人形替换圆球，随后指出形象太丑、且贴墙，要求改成福娃式卡通形象，并在悬停时离开墙面、让菜单真正环绕在角色身边。
- 形象：`SparkMascot.vue` 为纯 SVG 福娃式大头娃娃（大头小身、金黄头带、头顶嫩芽、圆眼高光、腮红笑脸、短手短脚）；`waving` 默认 false，悬停时右手绕肩关节 `rotate(-72°~-100°)` 挥手；待机保留浮动、眨眼、眼珠左右看，`busy` 加速节奏。
- 交互：`SparkAssistant.vue` 的 `.spark-launcher` 悬停展开菜单，`menuVisible` 时加 `.is-away` 让整个角色平移离开右下墙角（桌面 `-104px,-70px`，移动端 `-88px,-54px`）；指针判定用「原位置 anchorRect + 当前按钮 + 所有气泡」的联合区域（外扩 22px），避免角色移位那一刻误收起；选完入口后 900ms 内屏蔽 mouseenter，防止角色滑回时菜单重开。气泡第一圈 4 个（AI答疑 / 学习资料 / 计划 / …），点「…」第二圈（错题本 / 学情诊断 / 学习看板）；AI答疑开迷你面板，其余 `router.push`。
- 样式：气泡 58px 圆形、浅青径向渐变 + 青边框，围绕角色分布在上 / 左上 / 左 / 右；按钮内角色放大到 60px；提示气泡悬停时淡出，离开后恢复。
- 验证：typecheck / build 通过、`npm test` 185 通过；CDP 1440×950 待机提示可见、人形结构（1 头 / 1 身 / 2 臂 / 2 腿 / 2 眼）、悬停 `is-waving` 为 true 且右臂约 -98°、launcher 位移矩阵 `(-104,-70)`、4 气泡 0 溢出 0 压按钮、点「…」7 项、点 AI答疑面板打开、点学习资料跳 `/materials` 且菜单收起、鼠标移开气泡归 0；390×844 悬停 4 气泡 0 溢出、无横向滚动；控制台 0 报错。
- 证据：`D:\trae-work\tmp\cdp\spark-idle.png`、`spark-hover.png`、`spark-hover-more.png`、`spark-hover-mobile.png`，放大图 `spark-idle-zoom.png`、`spark-hover-zoom.png`、`spark-hover-fab-0.png`、`spark-panel-zoom.png`，脚本 `verify-spark-hover.mjs`、`zoom-spark.mjs`、`zoom-hover-fab.mjs`、`zoom-panel-mascot.mjs`。
- 注意：CDP 截图偶发拍到眨眼瞬间（5.2s 周期，95%~97% 闭眼），别误判为眼睛丢失；换一帧即可确认。
- **已移除（2026-11-14，老大要求「去除小精灵这个功能」）**：`AppShell.vue` 删除 `SparkAssistant` 引入与挂载，`SparkAssistant.vue`、`SparkMascot.vue` 两个文件已删除（回收站可还原）；页面只剩 `FeedbackWidget` 一个悬浮入口。验证：typecheck / build 通过、`npm test` 185 通过；CDP 1440×950 在 `/home`、`/plans`、`/mistakes`、`/dashboard` 四页查询 `.spark-*` 节点均为 0、控制台 0 报错，截图 `spark-removed-home.png`，脚本 `verify-spark-removed.mjs`。以上形象/悬停菜单记录仅作历史，不再对应现存代码。

## 错题上传迁到错题库（2026-11-14）

- 需求：把学情诊断页底部「错题归因 / 上传错题照片」整块搬到错题库，入口改为按钮 + 弹窗；学情诊断页不再保留该功能。
- 实现：`MistakeAttribution.vue` 新增 `formOnly` 属性（弹窗内隐藏薄弱章节统计、错题列表和空态，并去掉外层卡片边框/底色）与 `saved` 事件；`MistakesView.vue` 页头新增「上传错题照片」按钮，点击时 `loadProfile()` 取年级/科目/教材版本、`getCurriculumChapters()` 拉章节，在 `el-dialog`（`width="min(680px, 94vw)"`）里嵌 `formOnly` 表单，保存后关闭弹窗并刷新列表；空态也补同一入口。`DiagnosisView.vue` 删除组件引入与挂载。
- 注意：上传依赖档案里的 grade/subject，缺失时按钮只提示「请先在学情诊断里选好年级和科目」，不打开空弹窗；弹窗表单只保存识别文字与章节（照片不落库），错题来源显示「手动录入」。
- 验证：typecheck / build 通过、`npm test` 185 通过；CDP 1440×950：错题库页头按钮为「上传错题照片 / 去章节测试」，弹窗标题正确、章节可选、填题干保存后弹窗关闭，IndexedDB 新增 `{grade:初二,subject:数学,chapterName:三角形与全等}` 记录并立即以「手动录入」卡片出现在列表，控制台 0 报错；学情诊断页 `.mistake-card` 为 0、无「错题归因」文案。截图 `mistake-upload-saved.png`，脚本 `verify-mistake-upload.mjs`、`verify-mistake-upload-save.mjs`。
- AI 知识点标签与错因分析（2026-11-14 追加）：新增服务端 `server/mistake-analysis.js`（专用 prompt + 关键词兜底）与 `POST /api/agent/mistake/analyze`（入参 grade/subject/edition/chapterName/text，出参 `{knowledgeTags[], errorCause, suggestion}`，`jsonMode` + 30s 超时）；无模型/解析失败/接口异常一律返回本地兜底，不阻塞保存。前端 `api.js` 加 `analyzeMistake()`（40s），`MistakeAttribution.vue` 保存时先分析再落库，错题记录新增 `knowledgeTags`、`errorCause`、`analysisSuggestion`、`analysisSource`；`MistakesView` 卡片展示知识点标签和「错因分析 / 补强建议」，本地兜底时标注「本地规则推测」。错因措辞要求「可能/常见原因」，不允许断言学生实际错因。
- 验证（AI 分析）：直测接口 1.5s 返回 `source: deepseek`，标签「一元二次方程 / 根的判别式 / 实数根个数」；CDP 实测上传弹窗保存后弹窗关闭、IndexedDB 写入 3 个标签 + 错因 + 建议（source deepseek）、列表出现标签徽章与错因卡片、控制台 0 报错，截图 `mistake-ai-analysis.png`、脚本 `verify-mistake-ai.mjs`。typecheck / build 通过、`npm test` 185 通过。注意后端不是 watch 模式，改 `server/` 后必须重启 3001。

## 答疑话题隔离（2026-11-14）

- 需求：从学习资料页知识点点「问 AI」跳转时，不能把新问题混进上一次答疑，要自动新建话题，方便之后在历史会话里查找。
- 实现：`TutorView.vue` 的 `onMounted` 先 `refreshConversations()`，若存在 `route.query.q` 就 `await newConversation()` 再填入问题；无 q 才恢复最近一次会话。仍保持「只填输入框、不自动发送」，避免误耗模型额度；首问发送后 `send()` 会把标题改成问题前 28 字并落库，历史下拉即可检索。
- 验证：CDP 造一条旧会话「旧话题：化学沉淀」→ 打开 `/tutor?q=帮我梳理「轴对称与等腰三角形」…` → 页面为空会话、输入框已填问题、历史下拉仍只有旧话题（未覆盖）→ 点发送后 IndexedDB 出现第二条会话，标题为问题原文、messages=2 → 重新打开 `/tutor` 自动恢复新话题（`.chat-row` 2 条，下拉显示新标题），控制台 0 报错。截图 `tutor-new-topic.png`，脚本 `verify-tutor-new-topic.mjs`、`check-tutor-reopen.mjs`。typecheck / build 通过。

## 学情诊断首屏重设计（2026-11-14）

- 需求：进页就能看清「这个页面能做什么」，操作路径尽量短；保持青绿主题与 Element Plus 风格不变（老大原话「主体风格不变」）。
- 结构：`DiagnosisView.vue` 的 select 页改为「四张功能入口卡 + 左范围 / 右专题 + 章节测试 / 成绩记录两张工具卡」。功能卡：知识摸底（主卡，青绿渐变，就绪时点击直接开始摸底，未就绪滚到专题卡）、上次报告（有记录直接开报告，无记录提示并滚到专题卡）、章节测试（滚到测试卡）、成绩记录（直接打开成绩弹窗）。状态文案跟随年级/科目/已选专题/最近成绩实时变化。
- 主区：学习范围卡（年级 hover 下拉、科目、版本、每天分钟、目标分、卷面满分合并为一张，桌面 sticky `top:96px`）；专题卡（全选 + 已选计数 + 专题 chips + 底部开始条：题数、主按钮「开始第 N 次摸底」、从零基础规划、暂时跳过、历史摸底提示）。原先分散的「安排节奏」「做一组摸底？」「章节测试」「成绩录入」四块被合并，行为与数据口径未改。
- 章节测试卡三种模式改为整行按钮（日常 5–8 题 / 周测 10–15 题 / 整卷 25 题）；成绩卡默认只显示最近一次 + 「历史考试记录（N 场）」原生 `<details>` 折叠，删除整场保留。
- 新增脚本逻辑：`chapterCardRef / quizCardRef / scoreCardRef`、`scrollToCard()`（`scroll-margin-top:96px` 避开桌面吸顶导航，reduced-motion 时用 auto）、`readyToStart`、`startHint`、`startFromFeatureCard()`、`openLatestReport()`。旧的 `canStartAssessment` 保留并复用；删除不再使用的 `assessment-hint` 模板段。
- 响应式：≥1101px 四列功能卡；≤1100 两列；≤960 主区单列且范围卡取消 sticky；≤850 专题/结果两列、成绩场次纵向；≤560 功能卡单列且取消 `min-height`、页头纵向排列、开始条按钮全宽、专题单列。
- 验证：`npm run typecheck` / `npm run build` 通过、`npm test` 185 通过；CDP 1440×950：4 张功能卡、已选 0 时开始按钮 disabled、全选后 9 个专题且 CTA 变「开始第 1 次摸底」、章节测试卡滚动后可见、成绩卡直接弹出录入弹窗；390×844：单列、`scrollWidth=clientWidth=390`、0 控制台报错。截图 `diagnosis-redesign-desktop-empty.png`、`diagnosis-redesign-desktop-selected.png`、`diagnosis-redesign-exam-dialog.png`、`diagnosis-redesign-mobile.png`，脚本 `D:\trae-work\tmp\cdp\verify-diagnosis-redesign.mjs`。
- 二次调整（同日）：按老大要求删除学习范围卡里的「每天可用分钟 / 目标分 / 卷面满分」、科目说明和 LAST CHECK 上次摸底块；功能卡由 4 张减为 3 张。原「上次报告」入口移到页头右上角「查看上次报告」按钮，点击弹出与 AI 答疑会话选择同款的下拉面板：按 `createdAt` 倒序列出全部摸底记录，每行「年级 · 学科 / 知识点 / 日期 · 来源」，点击直接还原报告页；无记录时显示空态。新增 `reportPopoverVisible`、`reportHistory`、`openReportFromHistory()`，删除 `latestAssessment` / `latestAssessmentInfo` / `openLatestReport()`。`profile.dailyMinutes` 与目标分仍保留默认值参与计划生成，只是不再在 UI 暴露。验证：typecheck / build 通过、185 测试通过；CDP 1440 弹层显示 3 条（初二数学 3 专题、初二数学 1 专题、初一英语 1 专题），点击首条进入「初二 · 数学」报告页；390 宽无横向溢出、0 控制台报错。截图 `diagnosis-report-entry-desktop.png`、`diagnosis-report-popover.png`、`diagnosis-report-open.png`、`diagnosis-report-entry-mobile.png`，脚本 `D:\trae-work\tmp\cdp\verify-diagnosis-report-popover.mjs`。

## 学情诊断改为三卡行动中心 + 试卷 AI 分析（2026-11-14）

- 需求：只保留三个入口（知识摸底 / 章节测试 / 上传试卷 AI 分析），点击各卡弹窗操作；担心卡片下方留空不和谐；原「成绩录入」整块改为「上传试卷让 AI 判断学情」。
- 首屏：`DiagnosisView.vue` select 页改为 `.hub` 垂直居中（`min-height:calc(100vh - 338px)` + `justify-content:center`，≤960px 取消 min-height），内容为「当前范围胶囊条（年级·科目·版本·已选专题 + 调整）」+ 三张 `.hub-card`（min-height 300px，首卡品牌渐变）+ 居中说明 + 课程依据。1440×950 实测 `pageScrollable=0`，页面无留空、无滚动；顶部「试卷识别」按钮移除（功能并入试卷分析弹窗，弹窗内保留 `/paper-scan` 链接）。
- 三个弹窗：① 知识摸底（年级 hover 下拉 / 科目 / 版本三列 + 专题双列滚动 + 全选 + 题数 + 开始 / 零基础 / 跳过，按钮状态由 `readyToStart` 与 `startHint` 驱动）；② 章节测试（当前范围说明 + 日常 / 周测 / 整卷三行按钮，范围缺失时显示「去选学习专题」转摸底弹窗）；③ 试卷分析（年级科目 + 1–3 张照片上传预览/删除 + 本机 OCR 进度 + AI 结果：标题、分数、结论、薄弱点 3 格掌握度条、优势标签、错因、建议、OCR 局限提示）。`@closed="resetPaperDialog"` 回收 objectURL。
- 试卷分析链路：照片在浏览器用 `extractQuestion`（tesseract）识别 → 拼文本（<20 字直接提示换照片）→ `POST /api/agent/paper/diagnose`（新增 `server/paper-diagnosis.js`：prompt + `normalizePaperDiagnosis` 裁剪 + `fallbackPaperDiagnosis` 兜底，text 截断 16000、模型超时 100s）→ 前端 `analyzeExamPaper`（120s）。照片不上传，只发文字。成绩录入 UI 与 `examForm/examSessions/saveExam/removeExamSession` 全部删除；`examScores` 仍只读作为计划基线（`baselineScore`）。
- 验证：`npm run typecheck` / `npm run build` 通过、`npm test` 185 通过；接口直测 `text:"short"` 返回 `source:validation`，真实试卷文本返回 `source:deepseek`（初二数学 96/120、薄弱点「分式概念辨析」）；CDP 1440×950：三卡 3 列、弹窗标题/字段/9 个专题双列、全选后 9/9 且开始按钮解禁、取消 1 个变 8、章节测试弹窗 3 模式、试卷弹窗上传区/预览逻辑/去试卷识别链接、右上报告弹层 2 条仍可打开，控制台 0 报错；390×844 单列、`overflowX=0`、试卷弹窗宽 367 居中。截图 `diagnosis-hub-desktop.png`、`diagnosis-hub-assessment-dialog.png`、`diagnosis-hub-assessment-selected.png`、`diagnosis-hub-quiz-dialog.png`、`diagnosis-hub-paper-dialog.png`、`diagnosis-hub-mobile.png`、`diagnosis-hub-mobile-paper-dialog.png`，脚本 `D:\trae-work\tmp\cdp\verify-diagnosis-hub-dialogs.mjs`。
- 注意：`server/` 非 watch，新增接口后必须重启 3001；PowerShell 里用 `curl.exe -d '{"k":"v"}'` 传 JSON 会被转义成非法 JSON（服务端 500），改用 `Invoke-RestMethod -Body` 验证。
- 同日二次调整（老大要求）：删除首屏「当前范围」胶囊条（`.hub-context*` 全部移除，调整范围统一走摸底弹窗）；三张入口卡统一浅绿渐变 `#f1f9f7 → #dbefea`、描边 `rgba(77,141,142,.22)`，删除深色 `.primary` 变体；三个弹窗放大为 920 / 760 / 920（`min(…,94vw)`），专题网格改 3 列（≤900px 回 2 列、≤560 单列），试卷结果区 `max-height:480`。验证：typecheck / build 通过，CDP 1440×950 `pageScrollable=0`、弹窗实测 920 宽、专题 3 列、卡片与弹窗无横向溢出、控制台 0 报错；截图同名覆盖于 `D:\trae-work\tmp\cdp\`。
- 执行三条建议（同日）：① 首卡右上角加 `.hub-card-badge`「建议先做」青色圆角角标（绝对定位 top/right 14px），三卡底色仍完全一致；② 试卷分析弹窗改为 `.paper-layout` 左右分栏（`1.4fr / .6fr`），左上传区 `min-height:190px`，右侧 `.paper-guide` 三步说明 + 识别局限提示，≤800px 回单列并取消 min-height；③ `FeedbackWidget.vue` 手机端（≤800px）改为 42px 圆形图标按钮、`right:14px` + `bottom:76px`（raised 时 132px），桌面仍是「意见反馈」文字胶囊。验证：typecheck / build / 185 测试通过；CDP 1440×950 角标可见且三卡背景一致、试卷弹窗 2 列 920 宽、引导 3 条；390×844 反馈按钮 42×42/圆形/右侧 14px、试卷弹窗 1 列 367 宽、全程 0 控制台报错与 0 横向溢出。截图 `diagnosis-suggest-badge.png`、`diagnosis-suggest-paper-two-column.png`、`diagnosis-suggest-mobile-feedback.png`、`diagnosis-suggest-mobile-paper.png`，脚本 `verify-diagnosis-exec-suggestions.mjs`。

## 试卷结果落库 + OCR 基线 + 设置页反馈（2026-11-14）

- 需求：试卷分析结果要能保存成学情记录（可回看、薄弱点参与掌握度）；用真实试卷跑一次 OCR 识别率；设置页补「意见反馈」入口（手机端浮动按钮已收成 42px 圆形，入口变弱）。
- 落库：`DiagnosisView.vue` 的 `savePaperRecord()` 把 AI 结果转成 assessment：`source:'paper'`、`questionCount/questions/plans` 为空、`explanation` 存「分数 + 结论 + 前 3 条建议」。知识点先用 `normalizePointName` 去空白/标点，再按「精确同名 → 互相包含且较短串 ≥3 字」匹配当前课程章节；匹配不到用伪 id `paper-<名称前12字>`，只出现在报告里，不污染课程雷达。**掌握度换算**：薄弱点必须 `Math.min(1, ...)`（报告判定线是 `>=2` 算掌握较好，AI 的 mastery=2 直接存会显示成「掌握较好」）；优势点按 3 存；同一知识点重复时薄弱取 min、优势取 max。保存后若年级科目与档案一致，重新 `mergeChapterMastery` 让对上的章节立刻参与掌握度与计划排序。报告来源标签新增 `paper: '试卷分析'`；报告页对 paper 记录把 eyebrow 改为「PAPER REPORT · 试卷分析报告」、掌握度标题改为「试卷掌握度」、计划空态改为「不含计划快照」；按钮保存成功后禁用并变「已保存为学情记录」。
- OCR 基线：`D:\trae-work\tmp\ocr\render-exam-sheet.mjs` 用 CDP 渲染 1200×1697（A4@144dpi）印刷体初二数学试卷（满分 120、选择/填空/解答共 11 题、末尾 96/120）为 `exam-sheet.png`，ground truth 同目录。端到端脚本 `verify-paper-record-ocr.mjs` 走真实页面：第三张卡 → `DOM.setFileInputFiles` 塞 `input.paper-file` → 点开始分析 → 捕获 `/api/agent/paper/diagnose` 的 `postData` 取 OCR 文本 → 去空白后算 Levenshtein。结果：OCR 682 字、ground truth 519 字、编辑距离 89、**字符准确率 82.85%**；11 个关键 token（期中质量检测/八年级/数学/分式/科学记数法/分式方程/96-120/x=3/三种题型）全部命中；AI 返回 `source: deepseek`、96/120、3 个薄弱点；保存后 IndexedDB 新增 paper 记录，右上角报告列表出现「试卷分析」，报告页「需要补强」3 条、「掌握较好」1 条，控制台 0 报错。
- OCR 注意：tesseract `chi_sim+eng` 会在汉字间插空格（`2026 学 年 第 一 学 期…`），算准确率必须先去掉全部空白；`A1 B.-1` 这类选项字母与数字会丢分隔符，属于已知失真。本轮素材是**印刷体渲染图**，手写、倾斜、暗光拍照仍未验证，汇报时必须说明。
- 反馈入口：抽出 `src/components/FeedbackDialog.vue`（类型/内容/联系方式，内容必填，500 字计数，写 `feedbacks` 表 `{type:'site', page: route.path, category, content, note, contact, createdAt}`）；`FeedbackWidget.vue` 改为复用它，桌面胶囊 / 手机 42px 圆形行为不变；`SettingsView.vue` 在「数据备份」前新增「帮助与反馈」卡（写反馈按钮）。CDP 验证：卡片可见、弹窗 460 宽、三个字段齐全、提交后弹窗关闭且 IndexedDB 新增 `/settings` 的 site 反馈；390×844 按钮在视口内、`overflowX=0`。
- 验证：`npm run typecheck` / `npm run build` 通过、`npm test` 185 通过。截图 `D:\trae-work\tmp\cdp\paper-ocr-result.png`、`paper-report-view.png`、`settings-feedback-card.png`、`settings-feedback-dialog.png`、`settings-feedback-mobile.png`；脚本 `verify-paper-record-ocr.mjs`、`verify-settings-feedback.mjs`。

## 学习计划时间轴：齿轮滚轮原型（2026-11-15）

- 交付物：`D:\aaa\plan-wheel.html` 单文件原型（内联 CSS + 原生 JS，无库无框架），只做概念与构图基准；定稿版本已移植进 `PlansView.vue`（见下方「已落地」）。
- 形态：左侧手绘机械齿轮（8 个梯形齿 + C 形双弧 + 外圈线条收口箭头）+ 右侧可滚列表；基准线固定在列表容器垂直中点不动，条目从下滚上来、过线后淡成历史。齿轮不接受点击拖拽，只有列表可滚。
- 关键实现：基准线必须是滚动容器的兄弟节点（放 `.list-viewport` 里会跟着滚）；齿单独一层 SVG `.gear-rotor` 用 CSS `rotate()` 绕自身中心转（避开 SVG transform-origin 兼容坑），C 弧/外圈/箭头留静态层；列表 `padding:172px 0 200px`，第 i 行居中 ⇔ `scrollTop = i*56`；`window.renderWheel(items)` 纯函数入口（按 time 排序、`findIndex(!done)` 定位当前项、自动滚到中线）。
- 状态口径：颜色说做没做完（done → 文字 #A9B4AC + 实心勾），透明度说离多远（以基准线 0，每远一行 -0.12，下限 0.42，上方再 ×0.75，当前项恒 1）；禁用 `filter:blur()`/文字阴影；当前项只加 500 字重 + 2px 绿竖线，不放大字号、不加底色。
- 踩坑：① `body{display:grid;place-items:center}` 会让固定 680px 的卡片在 360 下不收缩（auto 轨道被撑开），改 flex 居中；② ≤719px 时「当前时间」放不进 96px 齿轮的 C 开口，必须单独占一列：齿轮 96 + 齿轮列 130px + 标签 `left:calc(100% + 4px)` 两行 11px（首版 `right:-6px` 直接压在齿形上，加宽标签又侵入了时间列）；③ 齿轮齿偏移 22.5°，保证 0° 处是齿谷，给 C 开口与标签让位。
- 验证：CDP 9312 数值 + 截图（`D:\trae-work\tmp\plan-wheel-html\`）与 9314 交互脚本；滚轮 56px 转 45°、拖拽 112px、Tab 聚焦 2px 绿圈、Space 切换且滚动不跳位、`prefers-reduced-motion` 齿轮不转；1440 与 360 均 0 横向溢出；2/6/15 条、全 done、0 条、subject/note 为空全部成立。注意 headless 里 `Input.dispatchKeyEvent` 用 `rawKeyDown` 不会触发 button 的 Space 激活，要 `keyDown` + `text:" "`。
- 齿轮同步修复（2026-11-15）：原实现用 `Math.round(scrollTop/56)*45` 跳档 + 常驻 200ms 过渡，实测一次滚轮跳两行时列表 2ms 停住、齿轮还要 193ms 才转到位，且半行边界会来回跳档。改为角度与滚动位置连续映射（`scrollTop/56*45`），滚动期间给卡片加 `.is-scrolling` 把 `transition` 关掉（停下 140ms 后移除、恢复 200ms ease-out），实测同步延迟 4ms；静止位置仍是 56px 的整数倍 → 每行正好 45° 不变。
- 样式回退（2026-11-15，老大指定）：`plan-wheel.html` 去掉齿轮，改回截图的纯列表样式（时间｜勾选圈｜标题+标签/副标题，外加「现在」分隔条 = 标签 + 6px 绿点 + 发丝线），滑动保留选择器手感但去掉倾斜：列表 `padding:148px 0` 让任意行能停在中线，停手 150ms 后把最近一行吸附到中点（`scrollTo` smooth，reduced-motion 直接跳），离中线越远 opacity 越低（每行 -0.12、下限 0.42、上方 ×0.75），不做 skew/blur/缩放。勾选后若「现在」跨过该行，用 `offsetTop` 差补偿 `scrollTop`，被点的行不跳位；`tag`/`tagTone`（green/warm）为新增可选字段。
- 定稿方向（2026-11-15，老大再次给图「还是做成这样」）：放弃固定中线/吸附/齿轮联动，`plan-wheel.html` 改为静态列表卡：右上角页码 `1/4`（11px、`#A9B4AC`、右对齐）；「现在」分隔条插在第一条未完成之前（全部完成则不显示，勾选后动态下移），左侧留白放 12px 绿字标签，绿点与勾选圈同轴，1px 线从文字列开始；行网格 `40px 18px 1fr`、无列间距，文字列 `padding-left:13px`（勾选圈 x=40、正文 x=71、行高 74–75、卡片 520/内边距 24）；已完成圆为浅绿实心 `#CCDCCE` + 白勾（不是深绿），分隔线 `#F4F7F2`、末尾线 `#E6EBE4`、暖标签底 `#FBF6EE`；无透明度阶梯、无滚动容器，页面自然滚动。验证 `D:\trae-work\tmp\cdp-plan-picker.py`（9332）：翻页徽标 24px 右距、now 为第 2 个子节点、tick 40 / 正文 71 / 线左 71、点选后 nowIndex 2、Space 切换、全完成无 now、空态、360 无横向溢出。
- 已落地（2026-11-15）：静态列表替换 `PlansView.vue` 原齿轮轮盘。`listItems = 已完成(按完成时间正序) + 待做(queue + futurePlans)`，`nowIndex = listDoneCount` 在模板里插 `.now-row`；勾选圈直接 `toggleArchive`（完成=归档，再点恢复）。几何：`.plan-row` 网格 `40px 18px minmax(0,1fr) auto`（移动端首列 32px）、`.plan-main{padding-left:13px}`，实测 tick x=40 / 正文 x=71 / 桌面 nowIndex 与角标 `已完成/总数` 同步。完成圆 `--plan-done:#ccdcce` + 白勾，完成行文字统一 `--plan-faint:#a9b4ac`（去掉 opacity），末尾线距 15px。踩坑：`rowMeta` 早期只判断 `tag==='今天'`，已完成项没有 tag → 渲染出「undefined · 12 分钟」；改为 done 直接走 `planMeta`。移动端标题改两行 line-clamp，避免被「开始」+「⋯」挤成省略号。验证 `D:\trae-work\tmp\cdp-plans-app.py`（9333，seed 4 条）：badge 1/4→2/4→1/4、nowIndex 1→2→1、tick 40 / main 58（文字 71）、tickBg `rgb(204,220,206)`、badSub 0、1440 与 390 均 0 横向溢出；`npm run build` / `npm test` 通过。
- 列表滚动（2026-11-15，老大「加一个可以滑动的吧，不要滑动整个页面了」）：`.plan-list` 自己滚，`max-height:clamp(260px,calc(100vh - 360px),520px)`（≤760px 用 `clamp(220px,calc(100vh - 470px),520px)`）+ `overflow-y:auto` + `overscroll-behavior:contain`；滚动条 6px、thumb 用 `--plan-mint-strong`；`margin-right:-6px;padding-right:6px` 把滚动条收进卡片内边距，tick 仍 40。`<ol>` 加 `tabindex="0"` 支持键盘滚动；`focusPlanRow` 不再 `scrollIntoView`（会带动整页），改为按滚动容器算 `scrollTop` 居中。验证 `D:\trae-work\tmp\cdp-plans-scroll.py`（9334，12 条 seed）：列表 520/1331 可滚、滚轮与 End 键只改 `listScrollTop`、`pageScrollY` 恒 0、1440 与 390 无横向溢出。
- 当前时间与完成预览（2026-11-15）：分隔条标签 `nowClock`（`HH:mm`，复用每 60s 递增的 `now`）。**已完成只渲染最近两条**（`DONE_PREVIEW=2` + `listDonePlans.slice(-2)`），更早的完成记录不进列表；未完成全部保留，超出内容框高度时内滚。`nowIndex` = 渲染的两条完成数；右上角标 = `listDoneTotal/listTotalCount`（如 7/14，与只露 2 条不一致是刻意的）。踩坑记录：曾按「全部渲染 + 初始 scrollTop 对齐到倒数第 2 条」实现，老大要的是只放出两条，已回退，`alignInitialScroll` 已删除。验证 `D:\trae-work\tmp\cdp-plans-align.py`（9338）：9 行 = 2 完成 + 7 待做、默认 scrollTop 0、maxScroll 175、上滚停在 0、下滚停在 175、`pageScrollY` 恒 0。
- 滚动条（同日）：只用 `::-webkit-scrollbar`（9px、thumb `rgba(47,93,80,.38)`、hover .58、`scrollbar-gutter:stable`），**不要**同时写 `scrollbar-width`/`scrollbar-color`——Chrome 会改用原生 thin 滚动条并画出上下箭头按钮（卡片右下角那个小三角就是这么来的）。
- 卡顿处理（同日）：`.plan-more` 去掉 opacity 过渡（滚轮时行穿过光标会连续触发淡入淡出重绘）、`.plan-list` 加 `contain:paint` / `will-change:scroll-position` / `touch-action:pan-y` / `-webkit-overflow-scrolling:touch`。headless 的 rAF 采样不受 vsync 限制（实测 309 帧、max 7.5ms），不能当卡顿证据，真机效果需老大复验。
- 内容框上限（2026-11-15，老大红框标注「最大计划内容框」）：`.plan-list` 桌面 `max-height:clamp(260px,calc(100vh - 340px),720px)`，≤760px 仍 `clamp(220px,calc(100vh - 460px),520px)`。实测 1440×900：卡片 624、底部 894（视口内）；1024×768：底部 757；390×844：底部 778（避开底部导航）。计划少时卡片按内容收缩（4 条约 420），多时封顶内滚。滚动边界交给原生 `overflow`：顶部到首条已完成即 `scrollTop=0`，底部到 `maxScroll` 停住，`overscroll-behavior:contain` 保证滚轮不会带动页面（实测上滚/下滚 `pageScrollY` 恒 0）。验证脚本 `D:\trae-work\tmp\cdp-plans-bounds.py`（9337，14 条 seed：7 完成 + 7 待做，默认视口只露 2 条完成）。
- 滚动条可见性（2026-11-15，老大「在这里单独做一个滑动」→ 选择「保持按数量收缩」）：确认结构不动，只把滚动条做明显：`scrollbar-gutter:stable`（避免出现/消失时内容跳）、thumb 9px、`rgba(47,93,80,.38)`（hover .58）、深色模式 `rgba(163,205,196,.42)`。实测 14 条时列表 560/731 可滚、首尾止停；4 条时卡片收缩到 420、无滚动条；tick 仍 40/32。
- 遗留：AI 给的薄弱点名称通常比课程章节细（如「分式方程（解法与检验）」vs 章节「分式」），当前保守匹配会落到伪 id，报告能看但不会并入课程掌握度；若要让试卷薄弱点真正参与计划排序，下一步应把当前章节名列表传给分析接口，让模型按课程专题命名。

## 离线题库（2026-11-14）

- 背景：摸底每次按题位调模型，10 题要 15–25 秒；老大要求建立本地题库，摸底和其他答题入口直接抽题，且题库随项目打包到其他电脑也能用。
- 题库位置与规模：`server/data/question-bank/<年级>/<科目>/<版本>/<章节id>.json`，默认教材版本共 144 章节 × 10 道单选（1440 题，已完成）；`server/data/quiz-bank/...` 存章节测试的填空/解答题，每章目标 4 填空 + 3 解答。两份题库都在 `.gitignore` 白名单里，随仓库/压缩包分发。
- 生成方式：**直连模型写库，不经过网页或本地 API**。`scripts/build-question-bank.js`（单选）和 `scripts/build-quiz-bank.js`（主观题）调用 `server/direct-generation.js` 与 `server/quiz.js` 的 `generateQuizSubjectivesDirect`；本机需要 `.env` 的 DEEPSEEK_API_KEY，生成完的题库在其他电脑无需 key 也能直接用。命令：`npm run bank:build`、`npm run bank:build:quiz`，支持 `--grades/--subjects/--editions/--chapters/--count/--concurrency/--force/--dry-run`。
- 运行时接入：摸底接口 `/api/agent/assessment/generate` 先走 `pickBankQuestions`，命中时 `source:'question-bank'`（实测 78ms 出 10 题）；章节测试 `generateQuiz` 用 `planQuizBankPicks` 先抽单选池与主观池，未命中的题位才请求模型，兜底仍保留。
- 注意：`server/` 非 watch，新增/重生成题库文件后必须重启 3001 才会加载；PowerShell 直测接口必须用 UTF-8 字节体 + `Content-Type: application/json; charset=utf-8`，否则中文参数被转成问号，题库键匹配不上，会误判成「题库没生效」。
- 验证：`npm test` 187 通过、`npm run typecheck` / `npm run build` 通过；直连生成实测单选 15s/章、主观题 14s/章。
- 2026-11-14 体检测试：`weekly` 15 题（单选 8 + 填空 4 + 解答 3）全部 `origin=bank`、353ms；`paper` 25 题（10/6/9）全部 `origin=bank`、87ms。题库补齐后复测：初二数学 weekly 15 题 387ms、初三物理 paper 25 题 86ms，均全 bank、无重复题干。
- 主观题库已补齐 **144/144 章，共 1015 题（填空 579 + 解答 436）**。DeepSeek 在跑到 61 章后因 **HTTP 402（余额不足）** 中断，剩余 83 章（含 6 个题量不足章节）改由 Trae 直接出题写库，`source:"trae"`，全程未调外部 API；`scripts/build-quiz-bank.js` 的失败日志现在会带出最后一次真实错误，充值后仍可用 `npm run bank:build:quiz -- --concurrency 3` 覆盖或补章。
- 数据清洗：统一题号为 `<章节id>-f1/s1` 并修复 56 个旧文件的重复 `q1`；把旧数据里前端不支持的 `\ge`、`\le`、`\approx`、`\rho`、`\bar{}`、`\begin{cases}` 转成 Unicode/中文分号（`\frac`、`\sqrt`、`\left`、`\right` 由 `formatMathText` 支持，保留）。
- 同一时间发现项目根 `.env` 的 `DEEPSEEK_API_KEY` 被清空（在线 AI 功能会降级）；已从旧工程 `.env` 恢复（两处同值，只记位置不记值）。**402 说明该 key 余额已耗尽，需到 DeepSeek 控制台充值或换新 key**，这与之前「旧 key 曾泄露、建议轮换」是两件事；题库本身不依赖它。

## 题库严谨复核 + 错题本 UI（2026-11-14）

- 全量复核 1440 道单选 + 1015 道主观题。除学科知识问题外，修掉：答案算错（`初一-数学-8-f2` x=3、y=1，x+y=4，原答案 5）、方差算错（`初二-数学-9 diag-7` 甲班偏差平方和 2550、方差 255，原写 2450/245）、解析编辑残留（`初三-数学-3 diag-1` 的「不成立？应改为」、`初一-数学-8-f2` 的 A/B/C/D 自评标签与「？需重新核对」）、重复题（`初一-历史-5-f3` 改为安史之乱；`初三-数学-2` 10 个重复 q1 改 d1…d10）、24 道单选选项自带 `A./B.` 前缀、3 处 `\frac` 被 JSON 当换页符、以及英语/物理/化学/生物/语文/文综 60+ 处知识性或评分点问题。
- `formatMath.js` 补齐 `\xrightarrow{}`、希腊字母、`\sin/\cos/\tan`、`\sqrt[3]{}`、`\begin{cases}`、`\%` 等渲染；同时收紧「公式整条 nowrap」启发式：含 ≥3 个英文单词（或 2 个且核心长度 >32）的片段按自然语言折行。否则英语填空句（下划线+空格被识别成公式）在 375px 会横向裁切。
- 错题本：状态页签加实时计数胶囊；整行可点展开并补 Enter/Space 冲突处理；展开后解除题干 2/3 行限制、显示完整题目；右侧箭头随展开旋转；错次 ≥3 次的徽章转暖色；空状态区分「有筛选」，提供「清除筛选，看全部」；移动端搜索框恢复整行可见；键盘 1/2/3、↑↓/JK、M、Enter 保留。
- 验证：`npm test` 190 通过、`npm run typecheck` / `npm run build` 通过；Chrome CDP 1440/375 实测 `scrollWidth == clientWidth`、徽章在行内、搜索可见、页签切换/展开收起/空状态清除/已消灭筛选均通过；截图 `D:\trae-work\tmp\ui-1440.png`、`ui-375.png`。后端 3001 已重启加载新题库。
- 注意：审计仍会报 936 处 `\frac/\sqrt` 等 LaTeX 文本，这是刻意保留的源格式，由 `formatMathText` 渲染，不是脏数据；判断残留要按渲染器支持集，不能见反斜杠就判错。

## 学习计划页 UI 重做（2026-11-14）

- 按老大给的青绿教育风设计稿重做 `/plans`：hero（周次/剩余天数与目标数/CTA「开始今天第一项」）、「本周完成度」7 天条、左侧「今晚怎么排」时间线（已完成 → 现在分隔线 → 待办带建议时间/标签/开始）、右侧「本周目标」+「时间花在哪」堆叠条 + missingSubjects 提示、奶油色「一句实话」卡、底部折叠「全部任务」。
- 数据口径全部来自本地真实记录，不编造设计稿里的 14/21、62%：周完成数/均值取本周归档 `completedAt`；目标进度 = 本周归档 / (本周归档 + 进行中)，按科目取前 2；专注分布取近 7 天 `focusSessions.actualSeconds`；「一句实话」取本周最低完成日；「物理没排」取 assessments 里有但 active plans 里没有的科目。
- 时间线排序口径：过期/今天到期 `reviewTime` 优先 → 优先级（高/中/低）→ `sequenceOrder`。**不要用 `todayDuePlans()` 给时间线排序**：它返回全部未归档任务且按 `reviewTime || createdAt` 排，生成任务 createdAt 相近，会得出错误顺序。
- 已完成项不用删除线，灰色 + 「已完成」胶囊即可；移动端时间线保持 4 列（38px/18px/1fr/auto），「开始」按钮不再换行，单项高度约 65px。
- 验证：`npm test` 190 通过、`npm run typecheck` / `npm run build` 通过；CDP 实测 1440/375 均 `scrollWidth == clientWidth`，周条 7 格、目标 2 行、图例 4 项，hero 目标数与右栏一致。截图 `D:\trae-work\tmp\plans-1440.png`、`plans-375.png`；脚本 `D:\trae-work\tmp\cdp-plan-check.py`（可复跑）。

## 全站窗口加宽 + 字号倍率（2026-11-14）

- 老大给的最低窗口标准：内容区约 1500px 宽（1920 屏下红框范围）。`.page` 改为 `max-width:1520px; padding:32px 36px 104px`；首页、答题页、答疑页原本各自限制 1240/1180/1160，也统一到 1520；`.diagnosis-page` 同步 1520。内层阅读列（如 `.quiz-layout{max-width:900px}`、答疑消息 880px）保持不变，避免长文行宽失控。
- 字号：`:root` 新增 `--fs-scale: 1.1`，全站 473 处 `font-size:Npx` 由脚本批量改为 `calc(Npx*var(--fs-scale))`（脚本 `D:\trae-work\tmp\scale-fonts.py`，可复跑）。Element Plus 部分组件把字号写死，需在 `styles.css` 额外覆盖 `.el-dialog__body/.el-select__wrapper/.el-input__inner/...` 为 `calc(14px*var(--fs-scale))`；`--el-font-size-*` 变量也已按倍率重定义。以后调大小只改 `--fs-scale` 一个值。
- `.page-title` 增加 `text-wrap: balance`，避免放大后在手机端留下单字孤行（如「什么」的「么」单独一行）。
- 验证：`npm test` 190 通过、typecheck/build 通过；Chrome CDP 巡检 10 个路由 × 1920/1440/375 共 30 次，`scrollWidth == clientWidth` 全部无横向溢出；1920 下 `.page` 实测 1520，诊断弹窗 920 宽、按钮/输入框字号 15.4px。截图 `D:\trae-work\tmp\1920-plans.png`、`1920-diagnosis.png`、`1920-home.png`、`375-plans.png` 等。

## 摸底错题入库（2026-11-14）

- 原问题：错题自动入库只在章节测试 `QuizView.syncMistakes()` 里做，摸底 `DiagnosisView` 只写 `assessments`，从不写 `mistakes`，所以摸底错题永远不进错题库。
- 现在：摸底提交时调用 `buildAssessmentMistakes()`（`src/utils/assessmentMistakes.js`）生成错题，仅收「已作答且答错的客观题」，跳过自评题/未作答；按 `grade|subject|questionId` 与章节测试记录合并，已有记录保留原 id/来源/创建时间，`fixedAt` 重置为 null（摸底又错则重新打开）；新记录 id 为 `mistake-assessment-...`，`source: 'assessment'`。
- 错题库来源筛选增加「摸底测试」，匹配逻辑统一为 `sourceMatches()`；结果页「答案与解析」下方增加自动入库提示。
- 不回溯历史摸底：旧 assessment 不会自动补录，避免把已消灭的错题反复打开；需要时再单独做一次性迁移。
- 验证：新增 `assessmentMistakes.test.js` 4 条用例，`npm test` 194 通过，typecheck/build 通过。

## 错题判定：粗心 / 易错（2026-11-14）

- 口径：只要答错就进错题库（章节测试、摸底都写 `mistakes`）。新字段 `wrongCount`（累计答错次数，首次为 1，重做再错 +1）、`lastWrongAt`、`slip`（`careless` 疑似粗心 / `misclick` 疑似点错 / `''`）、`slipAt`。
- 粗心只在「之前答对过 + 本次是第一次错」时判：单选且错选与正确项索引相邻 → `misclick`；其余客观题（单选/多选/填空）→ `careless`；主观题不判。重复错一律不再标粗心，转为易错。
- 「之前答对过」的取数：错题本 `redoHistory` 答对次数、`fixedAt` 是否已消灭、历史 `quizResults.perQuestion`、历史 `assessments.questions + answers`；判定当前测试时用 `excludeQuizId/excludeAssessmentId` 排除本次结果，避免把自己算成历史正确。
- 易错标注在展示层算，不改历史数据：同题 `wrongCount >= 2` → 「易错题」；同一知识点（`knowledgeTags[0] || chapterName`）下待消灭错题 ≥ 3 道 → 「易错知识点」（阈值在 `hotKnowledgePoints(mistakes, 3)`）。
- 合并规则：章节测试与摸底按 `grade|subject|questionId` 合并为同一条错题，保留原 id/来源/`createdAt`，再错时清空 `fixedAt` 重新打开。
- 验证：`src/utils/mistakeSignals.test.js` + `assessmentMistakes.test.js` 覆盖相邻选项、重复错、排除本次成绩；`npm test` 201 通过，typecheck/build 通过；CDP 实测 1440/375 无横向溢出，标签为「疑似粗心 / 疑似点错 / 易错题 / 易错知识点」，截图 `D:\trae-work\tmp\mistakes-flags-1440.png`，脚本 `D:\trae-work\tmp\cdp-mistake-flags.py`。
- 易错知识点**没有数量上限**：`hotKnowledgePoints()` 遍历全部未消灭错题，凡是同一知识点下 ≥3 道就进集合，不取前 N 个；只有知识点分布饼图为了可读性单列前 5 个，其余合并成「其他 N 个知识点」，判定和行内标签不受影响。

## 历史错题一次性迁移（2026-11-14）

- `src/utils/migrateMistakeSignals.js`：纯规划 `planMistakeSignalsMigration()` + 浏览器执行 `migrateMistakeSignals({ dryRun })`。开发环境入口挂在 `window.__migrateMistakeSignals`（`main.js` 里 `import.meta.env.DEV` 守卫，生产构建不包含）；数据在浏览器 IndexedDB，Node 脚本碰不到，所以必须在页面控制台跑，且要先登录到目标账号。
- 范围：历史摸底（`assessments` 里带 `questions` 的记录）答错的客观题补建错题；已有记录只补 `wrongCount / lastWrongAt / slip / slipAt`，不改题干、来源、创建时间、重做历史。
- 错次口径：`max(历史答错次数, 已落库 wrongCount, 1 + redoHistory 答错次数)`，避免重复计数；重复执行幂等（第二次 created/updated 都是 0）。
- 已消灭的错题默认保持消灭，只有「历史答错时间晚于 `fixedAt`」才重新打开；新补建的历史错题按待消灭处理。
- 验证：7 条单测，`npm test` 208 通过，typecheck/build 通过；CDP 端到端验证 dry-run 不写库、正式跑补建/更新正确、复跑幂等、错题库标签正确，脚本 `D:\trae-work\tmp\cdp-migrate-mistakes.py`。

## 学习计划页：新建计划 + 开始时间（2026-11-14）

- 按老大要求删掉 hero 的「第 X 周 · 日期」「先做最费脑的一项…」副标题和「重新诊断 · 按最新成绩重算时长」链接；同时移除 `rebalanceByScore`、`isoWeekNumber`、`weekNumber`、`weekRangeText`、`heroSubtitle` 及对应 imports/CSS，不再保留死代码。
- 新增 hero「新建计划」按钮 + 「新建学习计划」弹窗：名称、科目、预计时长、优先级、什么时候开始；写入 `plans`，手动任务字段为 `startAt`（时间戳）、`stage:'concept'`、`reason:'手动创建的计划'`、`sequenceOrder` 接同科目末尾、`reviewTime` 留空。
- 开始时间语义：`startAt` 在明天 0 点之后的计划不进「今晚怎么排」，只在「全部任务」展示并标注「🗓 开始」；到当天自动进入时间线。时间线遇到 `startAt` 或 `reviewTime` 落在今天且未到点，按用户选的时间排。
- 编辑弹窗同步新增「开始时间」，留空表示立即可做。
- 验证：typecheck/build 通过；CDP 1440/375 无横向溢出；创建后今天时间线出现，改成明天后消失，全部任务显示「🗓 11/15开始」；截图 `D:\trae-work\tmp\plans-create-1440.png` / `plans-create-375.png`。

## 学习计划页：按新设计稿重做（2026-11-14）

- 替换掉旧的 hero 双按钮 + 本周完成度 7 天条 + 本周目标卡（`goalRows` / `weekAverage` / `todayFocus` / `eveningTitle` / `startFirstTask` / `LimeIcon` 一并删除）。新结构：动态标题「今天有 N 个计划，有 M 个计划是昨天未完成的」+ 固定副标题 + 右上只留「新建计划」；科目筛选胶囊；左宽右窄两栏（约 1.55:1）。**不要再把 CTA 加回 hero**（老大明确只留新建计划）。
- 左卡「今天」：日期头 + `已完成/总数` + 折叠箭头（真折叠，不是装饰）；已完成项（时间删除线、灰标题、浅绿对勾）→「现在」分隔线（预计收工时间 · 剩余分钟）→ 待办项（`科目 · 名称`、`最费脑`/`昨天未完成` 标签、`X 分钟 · 章节 · 原因`、右侧「开始」）→「做完这 N 项就收工」+ 调整顺序 → 前 3 天历史折叠行（可展开当天完成项）。
- 右栏三张独立卡：「本周」（`weekCompleted/weekTotal`、进度条、还差 X 项每天 Y 项）、「时间花在哪」（近 7 天堆叠条 + 竖向科目小时 + 缺科提示）、「一句话实话」浅桃卡。
- 口径：`todayPlans = queueAll + doneToday`（不再截前 4 项）；胶囊计数按今日清单实时算，筛选只切列表与日期头计数，时间仍按全部待办排好后过滤，避免切科目时时间跳动；`isCarriedFromYesterday` = 今天之前创建或已到期的未完成任务；历史行 total = 当天完成 + 当天创建仍未完成；`weekTotal` = 本周完成 + 本周内开始的 active 任务。
- 行内操作（2026-11-14）：底部「全部任务」折叠管理区已删除，管理动作全部收进每条时间线的「⋯」菜单（设提醒/编辑/AI 换一个/锁定/上移/下移/完成并归档/删除；已完成行是恢复/编辑/删除）；排序由上移/下移改 `sequenceOrder`，不再拖拽。删除动作：`showAllTasks`、`scrollToAllTasks`、`clearStaleWeeklyPlans`、`clearSubject`、科目文件夹/轨道/阶段点整套模板与样式；`promptStaleWeeklyTasks` 的自动顺延提示保留。
- 日期滑轮（2026-11-14，改为真滚动）：不是三行静态轮，而是把前后每天的内容竖着连成一条，`.timeline-scroll` 固定高度（`clamp(340px,54vh,560px)`，移动端 60vh）+ 原生细滚动条，默认滚到今天；往上滑看以前的计划，往下滑看以后的计划，顶部大日期用 `elementFromPoint` 反查容器顶部所在 `[data-day]` 实时同步。保留「↑/↓ 相邻日 + 滚轮 + 指针拖动」快速换日（`shiftDay` 现在走 `scrollToDay` 平滑滚动）。每天一个 `.day-block`（`data-day=offset`），块间虚线 + 小日期分隔；过去日期显示当天完成 + 当天创建未完成，未来日期只显示当天开始/复习任务，今天保留「现在 · 预计收工」。范围按最早/最远计划动态扩展，最少前后 30 天、最多 120 天。新建计划/通知深链按 `startAt`/`reviewTime`/`completedAt` 跳到对应日期并高亮。
- 验证：typecheck/build 通过；CDP 1440/375 `scrollWidth == clientWidth`；筛选（数学 4 项 → 1/4）、历史展开、今日折叠、新建弹窗（含「什么时候开始」）均实测通过；截图 `D:\trae-work\tmp\plans-redesign-1440.png`、`plans-redesign-375.png`、`plans-redesign-dialog.png`，脚本 `cdp-plans-redesign.py` / `cdp-plans-actions.py`。滑轮+行内菜单复测（2026-11-14）：滚轮 ↑→昨天、↓↓→明天、指针上滑回今天、点击相邻行、回到今天均通过；菜单项齐全且首/末行上移/下移分别禁用；上移后顺序变化；完成并归档后进入当天完成组；新建「明天 09:00」自动跳到明天并高亮；控制台无报错、无横向溢出；截图 `plans-wheel-1440.png`、`plans-wheel-375.png`、`plans-menu-open.png`，脚本 `cdp-plans-wheel.py`、`cdp-plans-shot.py`。滚动轮复测（2026-11-14）：1440/375 首屏 `scrollTop == todayTop`，容器 560/487px、滚动条占位 10px；直接滚到明天/昨天/三天前时顶部日期同步正确；新建 +5 天计划后 `scrollTop == blockTop` 且高亮 1 行，刷新回到今天；`?focusTask` 深链跳到目标日并高亮；手机端无横向溢出；截图 `plans-scroll-1440.png`、`plans-scroll-375.png`、`plans-scroll-mobile.png`，脚本 `cdp-plans-scroll.py`、`cdp-plans-create-scroll.py`、`cdp-plans-deeplink.py`。

## 学习计划页：吸附滚动 + 悬浮日期头 + 筛选全量计数（2026-11-14）

- 顶部日期头改为悬浮层：`.today-head` 绝对定位 + `z-index:3` + 不透明背景 + 底部 18px 渐隐；高度由 `ResizeObserver` 量到 `--head-h`，`.timeline-scroll` 用 `padding-top/scroll-padding-top:var(--head-h)` 让内容从头部下沿开始并在吸附时避开遮挡；卡片收起时用 `min-height:calc(var(--head-h) + 8px)` 防塌。滚动代码统一按头高避让：`scrollToDay` 与深链定位用 `block.offsetTop - headHeight`，`onTimelineScroll` 采样点改到 `rect.top + headHeight + 10`。
- 一天一格吸附：`.timeline-scroll` 加 `scroll-snap-type:y proximity`，`.day-block` 加 `scroll-snap-align:start`。用 proximity 而不是 mandatory，避免任务多、单天比一屏高时被强行吸回顶部；实测吸附误差 0。
- 科目筛选：`subjectFilters` 改用 `dayDone(dayOffset, true)` / `dayPending(dayOffset, true)` 全量统计，切换科目后「全部」数量和其他科目入口不变化；去掉「当前科目不存在就回全部」的 watch，改为保留该科目 pill（计数 0）并保持选中；切换科目后用 `watch(subjectFilter)` 重新对齐当前日期，防止前面日期块高度变化导致滚动位置漂移。筛选态空状态显示「这天没有 X 的计划，切回全部看看其他科目。」
- 验证：typecheck/build 通过；CDP 1440 默认 `scrollTop = todayTop - headH`（3082=3186-104），吸附误差 0，滚到昨天日期头同步「昨天」，收起卡片高 112（头 104+8），筛选数学后「全部」仍 5 且语文/英语入口仍在、时间线只剩数学，新建 +5 天 `delta=0` 高亮 1 行，深链 `delta=0` 高亮可见；375 头高 93、首屏对今天、无横向溢出；控制台无报错。截图 `plans-snap-1440.png`、`plans-snap-375.png`，脚本 `cdp-plans-snap.py`、`cdp-plans-snap-create.py`、`cdp-plans-snap-deeplink.py`、`cdp-plans-snap-filter.py`。

## P0 体验快修：回访首屏 / 术语 / 对比度 / 无障碍（2026-11-15）

- 回访首屏：`HomeView` 新增 `isReturning = stats.totalPlans || totalFocusMinutes || streakDays`，根节点在 `isReturning && starterPlan` 时加 `today-first`，用 flex order 把 `.today-focus` 排到 hero 之前（不复制 DOM）。实测 CDP：1440×900 today 126–354（原 743–971），375×812 today 99–405（原 1153–1459），首屏完整露出「开始专注」。
- 术语收口：AppShell 通知「超过 7 天没复习」、动作「去复习」、快捷键「开始专注 / 复习错题」，DiagnosisView「复习巩固」。计划任务名里的「错题重做」属于内容数据，未迁移。
- 对比度：`--muted #71828a → #52676e`（白底 5.96、页面底色 5.45、primary-soft 5.06）；`--primary #4d8d8e → #3a7374`（白底 5.41、页面底色 4.94）；Element Plus light-3/5/7/8/9、dark-2 同步 `#759d9e/#9db9ba/#c4d5d5/#d8e3e3/#ebf1f1/#2e5c5d`；FocusView 本地 token 同步；PlansView `--plan-muted #7d8b84 → #5f7168`（白底 5.19）；HomeView 覆盖 `.hero-scope/.map-subtitle/.map-labels/.map-node/.map-progress small/.float-card small/.subject-caption/.focus-ring`。
- 无障碍：导航按钮补 `aria-label` + `aria-current="page"`（801–1120 隐藏文字后仍可读）；brand 由 div 改为 `<RouterLink to="/home">`（键盘可聚焦）；科目卡补 `@keydown.space.prevent`；移动端 `.subject-remove` 22px → 30px。
- 验证：typecheck/build 通过（入口仍 1,049.55 kB）；npm test 208/208；CDP 1440/1024/375 实测 `brandTag=A`、7 条 `aria-label`、1 条 `aria-current`、空格跳 `/diagnosis?subject=数学`、移除按钮 30×30、控制台无报错；截图 `p0-home-1440.png`、`p0-home-375.png`、`p0-plans-1440.png`、`p0-mistakes-1440.png`、`p0-focus-1440.png`，脚本 `cdp-p0-verify.py`、`cdp-p0-pages.py`、`cdp-nav-overflow.py`。
- 遗留：周报「重做」文案未收口；入口 chunk 仍是 Element Plus 全量注册（P1 已改为按需，见下）。

## P1：导航溢出 / Element Plus 按需 / AI 上下文闭环（2026-11-15）

- 导航溢出（已于 P1 修复）：801–1180px 只留图标；1181–1280px 与 1281–1500px 收起 `.shortcut-btn` 与「本地模式」`el-tag`，并压缩 `.side-nav` 留白、按钮 padding 与字号。CDP 实测 1121/1180/1240/1280/1281/1366/1440/1447/1500/1501/1600 全部 `scrollWidth === clientWidth`，截图 `nav-1121/1200/1281/1440/1500/1501.png`，脚本 `cdp-nav-widths.py`、`cdp-nav-shots.py`。
- Element Plus 按需：新增 devDependency `unplugin-vue-components`，`vite.config.js` 用 `ElementPlusResolver` 自动解析模板里的 `el-*` 并带样式；`main.js` 去掉 `app.use(ElementPlus)` 与 `dist/index.css`，只手动注册 `ElLoading` 并引入 loading/message/message-box/notification 四份命令式样式。入口 JS 1,049.40→394.66 kB（gzip 346.64→140.22 kB），CSS 99.74 kB（gzip 16.20）。12 条路由巡检无未解析组件、无 4xx、无异常；下拉菜单/弹窗样式实测正常。
- AI 上下文闭环：`MistakesView` 行详情新增「问 AI 讲这道题」→ `/tutor?mistakeId=`；`PlansView` 任务菜单新增「问 AI 讲这个任务」→ `/tutor?planId=`；`TutorView` 读取 query、从 IndexedDB 取对应错题/计划，生成 `【错题上下文】/【学习任务上下文】` 块，发送时拼进 `question`，聊天气泡只显示用户输入；顶部 `context-draft` 提示条可移除，新话题/切换会话会清空。Fetch 拦截实测请求体含上下文块与「我的问题」，界面无上下文泄漏。
- 验证脚本：`cdp-ai-context.py`、`cdp-p1-verify.py`、`cdp-route-sweep.py`、`cdp-el-style-check.py`。typecheck/build/208 测试全过。

## 专注空间：沉浸舱方向已被否决（2026-11-15）

- 尝试过「沉浸舱 + 计时器精修」：运行态整页入夜、60 格刻度、弧端光点、半透明数字底板、秒数降级、手机端收顶部。老大试用后明确否决，已全部回退到原样，不要重复这个方向。
- 回退只撤本轮改动，此前的 P0/P1（对比度 token、导航、AI 上下文等）原样保留。截图和 CDP 脚本还在 `D:\trae-work\tmp\`，只作历史记录，不作为后续方案依据。
- 唯一保留的技术结论：`.pomo-clock` 的 `padding:12%` 按外层卡片宽度计算，470px 环里的数字实际只有约 248px 宽；以后若要动这个钟的尺寸，先处理这个坑，别再叠加百分比 padding。

## 跨页专注胶囊：长按拖动 + X 收起（2026-11-15）

- 组件在 `AppShell.vue`，跨路由常驻。
- 拖动：长按 **120ms** 生效（老大先嫌 320ms 太长、又嫌 200ms 慢），Pointer Events；位移写独立 CSS `translate`，和桌面端居中用的 `transform:translateX(-50%)` 叠加，**不要改成写 transform**，否则桌面胶囊会跳位。
- 整条胶囊都是拖动区（标题、时间、暂停键都能起拖），只有 X 用 `@pointerdown.stop` 排除。iOS 必须加 `-webkit-touch-callout:none`，否则长按到文字上会弹系统菜单、只有边缘能拖。
- 指针在长按到点后立刻 `setPointerCapture`（保证快速拖动不会因为第一次 move 已在胶囊外而丢事件）。副作用：click 会被改派到根节点，按钮自己的 click 不触发；所以抬手时若 `liveDragMoved` 为 false，要按 `livePressTarget` 手动补动作（X→dismiss、暂停键→toggle、其它→进 `/focus`）。加 8px 死区避免轻点时抖一下。
- 位置记忆：`ai-teach-focus-pill-offset` 存 `{x,y}`，拖动结束才写；启动时读回。出现后 350ms 再 clamp（进场动画 200ms，期间量 rect 会把上浮位移算成越界，曾因此误存 -6px）；偏移为 0 时跳过 clamp。换设备/转屏靠 `resize` 再 clamp。
- 边界：四周 8px；手机额外把底部收到 `视口高 - 74px`，不钻到标签栏下面。拖动结束会补一次 click，用根节点 `@click.capture` 拦掉。
- 踩过的坑：长按计时器触发前指针移出胶囊，计时器仍会到点，导致松手后残留 grabbing/拖动状态。修法是 `@pointerleave` 取消未生效的长按 + `onLivePillMove` 里用 `event.buttons` 兜底。
- X 收起只隐藏 UI，不清 `ai-teach-focus-live` 快照，计时继续；按 `sessionStartedAt` 写 `ai-teach-focus-pill-dismiss:<stamp>`，同一次专注切页/刷新都不再冒出来，新会话（stamp 变化）自动恢复。`FeedbackWidget` 的 `raised` 要一起看 `liveDismissed`，否则胶囊收起后反馈按钮还悬空。
- 验证（CDP 375/1440）：标题处长按 180ms 即可拖动、位置刷新后保持、越界坐标被收回 `top:8/right:367`、快速轻点与长按不移动都能正常进 `/focus`、暂停键长按=点击且拖动不改暂停态；208 单测、typecheck、build 全过。脚本 `D:\trae-work\tmp\cdp-live-pill-offset.py`、`cdp-live-pill-toggle.py`。

## 学习计划：机械轮盘替换时间轴（2026-11-15）

- 老大手绘稿落地：原日期分组时间轴整块换成 `PlansView.vue` 的 `.plan-wheel`。**中线（齿轮 + 「现在 HH:mm」）永远固定，只有计划在动**；齿轮是静态标记，绝不能跟着 `wheelIndex` 旋转（曾加过 `--turn` 旋转，被否）。日期分组取消，改为行内小标签（今天/明天/后天/M月D日）。此齿轮方案已被 2026-11-15 的静态列表取代（见「学习计划时间轴：齿轮滚轮原型」下的「已落地」），保留作历史决策。
- 视觉（2026-11-15 四次返工，辐条+双圈版被老大说「一点都不像」）：齿轮必须是**一条连续齿形轮廓 + 一个大圆孔**，不是「辐条 + 内外双圈」。最终 path：10 齿、R_tip 86 / R_root 68 / 孔 56，`stroke-width:10`、`stroke-linejoin:round`、实色 `--plan-ink`；中心 C 是半径 34 的圆弧（缺口在右侧）+ 两端向内钩（`M103 88.5 Q113 80 121.62 73.12 A34 34 0 1 0 121.62 126.88 Q113 120 103 111.5`），孔里叠「现在 HH:mm」。桌面 360px（axle 188）、手机 160px（axle 38，左侧裁切）。**非中心行整体倾斜**（2.9° 起、每远一行 +0.3°、封顶 4.6°，转到中线回正 0°），中心行水平、加粗、薄荷胶囊；`.wheel-actions` 反向旋转保持按钮竖直；「最费脑/昨天未完成」chip 在 meta 行，避免挤掉中心标题。
- 桌面比例：`--wheel-gutter:382px`、行高 88px、viewport `clamp(360px,50vh,480px)`，齿轮右缘到文字起点约 20px；空状态 viewport 撑到 `clamp(340px,44vh,420px)` 以容纳完整齿轮（手机空状态 260–300px，齿轮才 160px）。
- 列表顺序：已完成升序 → 待做（今天队列 + 未来任务） → **末尾永远一个「新建计划」create 行**。空计划/全部完成/筛选无结果时 create 行自然落在中线，靠它兜底空状态，不需要额外空组件。
- 行透明度由 `index - wheelIndex` 的距离写 inline `--o`：中心 1、相邻 .9/.74、再远 .58/.46/.42，上方越远越虚；已完成行额外 `filter:blur(.4px)` 模拟手绘稿的「虚化」。
- 完成交互：中心行圆环是 `<button class="wheel-ring is-ready">` 环形箭头，点击 `completeWheelPlan()` → `toggleArchive` → `nextTick` → `measureWheel` → `wheelIndex = 已完成数`，feed 用 `.42s` transition 上滚一行，下一条滑到中线。`onPlanCommand('archive')` 待做项也统一走这条路径。键盘：↑↓/J K 转轮盘、Enter 只在中心 active 时开始、E 完成并归档。
- 布局：`wheelViewport` 高 `clamp(360px,50vh,480px)`；`wheelRowHeight` 取首行 `offsetHeight`（桌面 88、手机 84），`centerOffset=(h-rowH)/2`，transform = `centerOffset - wheelIndex*rowH + wheelOffset`。`--wheel-gutter` 桌面 382、手机 92，齿轮右缘不越过文字起点。
- 拖拽踩坑：不要用 `setPointerCapture`（会把后续 click 重定向到 viewport，完不成圆环/开始/⋯）。改为 viewport `@pointerdown` + window `pointermove/pointerup/pointercancel`；释放按 `Math.round(index - offset/rowH)` 吸附，260ms 内用 `wheelSwiped` + `@click.capture` 拦误触 click。滚轮累计 `deltaY` ≥24 换一行、160ms 节流。
- 手机端（≤760px）：`--wheel-row-h:84px; --wheel-gutter:92px; --wheel-gear:160px; --wheel-axle:38px`，行两列 `26px minmax(0,1fr)`，`.wheel-actions` 绝对定位且 **`flex-direction:column-reverse`（⋯ 右上、开始右下）**——用 column 时「开始」会盖住中心标题。空状态 `.is-empty` 把 viewport 压到 `clamp(260px,34vh,300px)`；create 行 `.wheel-meta` 要恢复 `padding-right:28px` 防文案截断。
- 数据口径：`wheelDonePlans` = 今天已完成倒序取反；`wheelPendingPlans` = `[...queue, ...futurePlans]`；未来任务行加 `carried: isCarriedFromYesterday && startAt < 明天`，避免昨天创建的未来计划被误标「昨天未完成」。`planDayTag` 今天队列统一「今天」。
- 验证：npm test 208/208、typecheck、build 通过；CDP 桌面（viewport 480、滚轮→英语、上拖→化学、点圆环 done 2→3 且中心变英语、gearTurn=none、无横向溢出）+ 手机（rowH 84、viewport 471、上滑→化学、空状态 center=「先新建一个计划」viewport 276、中心标题完整）；截图 `D:\trae-work\tmp\plan-wheel\*.png`，脚本 `cdp-plan-wheel.py`。

## 专注空间：三态重做（2026-11-15）

- 整页 `FocusView.vue` 重写为三态：`view = 'idle' | 'focus' | 'summary'`；休息不再是一页，`resting` 只控制回顾页底部固定小条（`REST_SECONDS = 300`，结束/跳过回待机）。已删除青柠奖励、演示模式、空格/F 快捷键、`phase/breakRunning/celebrate/weekFocus`。
- 版式 token：页面底 `#F5F7F3`、卡 `#FFFDFA`、描边 `#EDF1EC`、分隔 `#F1F4EF`、主字 `#17251F`、次字 `#66766D`、弱字 `#93A099`、主色 `#2E5C4B`、浅绿 `#E7F0E9`、强调绿 `#5A8F72`、走神 `#C99A63`、离开 `#D9DED8`、未记录 `#E6EAE3`、米黄 `#FBF6EE`。数字 Georgia；`.focus-inner` 1120px，左主卡 + 右栏 320px，gap 14。
- session 新字段：`focusSeconds / distractedSeconds / awaySeconds / sampled / timeline:[{type:'focus'|'distracted'|'away'|'unknown',seconds}]`。`sampled = 已知分段 ≥ actualSeconds*0.9`；旧记录没有这些字段时只显示总时长，**不编造分段**。`normalizeTimeline` 按 `actualSeconds` 等比缩放。
- 采样只在计时运行时累计（暂停不计）：`unknown` 未开监督 / `away` `isPresent=false` / `distracted` `attentionState!=='focused'` / `focus`。结束统一走 `finishSession(completed)`：落库 → `resetClock()` → `camera.disable()` → `view='summary'`。
- 组件改造：`CountdownTimer` 加 `plain`（只出纯数字钟面，翻牌动画不用于圆环）；`CameraMonitor` 加 `bare`（隐藏头部/隐私徽标/误判/说明，只留画面，空态是 292/164 的「开启学习画面」），**视频容器必须保留 `v-show` 而不是 `v-if`**，否则 `startMonitoring` 拿不到 video ref。
- 右栏 `CameraMonitor` 常驻（`v-show="view==='focus'"`），待机/回顾只切显示，不重挂载，避免进专注时重启视频流。
- AI 悬浮导师改固定右上（`right:25px;top:14px`，面板 `top:62px`），标题区右侧留 200px；快捷键面板只剩 `Esc 退出全屏`。
- 桌面端（≥1021px）：**不要动全局 `--fs-scale`**（基础 1.1），桌面只覆盖具体尺寸：容器 `.focus-inner` 1440px（左右 32px）、标题 42（≈46px）、副标题 14、`focus-layout` grid `minmax(0,46fr) minmax(0,54fr)`（右栏不固定宽）、待机环 340、专注环 330、钟面数字 62 / 58、时长档 13.5、卡片 padding 30/34、回顾侧栏 44%；实测 1440×900 内容高度 idle 899（100%）/ running 865（96%）/ summary 706（78%），均无横向溢出。≤1020 断点仍走原堆叠逻辑（右栏 320、环 164/196、文字 1.1 倍）。
- 踩坑（真 bug）：隐私确认弹窗原来跟着 `CameraMonitor` 渲染在隐藏的专注中卡片里，待机点开关时弹窗 0×0 不可见也点不到。修法是 `el-dialog` 加 `append-to-body`，别把弹窗放回隐藏容器。
- 时间轴标注：只标走神、不标离开（「离开 1 分」在文案里已有），最多 3 条、仅取 ≥30 秒的分段；`nth-of-type(even)` 自动上第二行防重叠，`left<15% / >85%` 时用 `is-start/is-end` 改 `translateX` 防出卡；手机端 `.timeline{margin-top:72px}` 留出两行空间（原来 30px 会压到「比上一次多 X 分钟」）。
- 设计稿对齐（2026-11-15 第二轮）：待机学科 chips 从圆角胶囊改方角描边卡片（选中白底 + 主色描边），时长从独立胶囊改灰色分段条（`.duration-row` 容器 `#F4F6F2`、`.duration-chip` 白底选中 + 轻阴影，**必须 `white-space:nowrap`**，否则窄列里「15 分钟」会折成两行），开始按钮加箭头 `.primary-arrow`（hover 右移 3px）；删掉「本次：计划名」的 `plan-line`，只留学科与自由输入。专注中右栏视频下加「这 N 分钟的状态」+ 三段迷你条 + 圆点图例（`.live-legend` `dot-focus/distracted/away`）+ `.live-note` 文案，卡片外加 `.side-footnote`「不录制、不保存、不上传」。回顾页删掉重复的「摄像头已自动关闭。」（副标题已有）。
- 设计稿二次对齐（2026-11-15 第三轮，老大要求「一模一样」）：**保留**待机右栏两张卡合并成一张 `.idle-side-card`（`.side-divider` 分隔），脚注 `.idle-footnote` 贴卡底；上次专注文案改 `21:00 / 25 分钟在学`（`lastSessionCard.caption`），回顾页仍用 `在学 · 共 25 分钟`（`summaryCaption`），两者别混；专注中图例 `space-between`、脚注 `.live-footnote` 居中带相机图标；回顾页副标题「这一节课」、`quote-card` 不再 flex:1、休息按钮 `.rest-cta` 用 `margin-top:auto` 贴底。**已回滚**：曾按设计图删掉「自由专注」常驻 chip、「自定义」时长和回顾页「写反馈」，并把 `.focus-page` 的 `--fs-scale` 改成 1.65——老大直接发火。三个入口现已恢复（自定义用 `.custom-row` + `el-input-number` + `chooseCustom()`），`--fs-scale` 回到基础 1.1。
- 踩坑（2026-11-15）：拿静态设计图的疏密当比例尺，整体乘 1.65 是错的。设计图里的「大」主要是环和留白（环 340/330），不是字——正文被放大到 21px、标题 56px 后整页像被浏览器 zoom，同时环反而缩到 250，比例全乱。以后对齐设计图只调结构、环径、间距，字号坚持 `--fs-scale` 基准。
- 验证：`npm run build` 通过（17s）；`npm test` 208 项通过；CDP 三态 1440×900 + 390×844 无横向溢出（`scrollWidth === innerWidth`）、控制台 `exceptions []`；摄像头用 canvas 注入正脸照驱动真实 MediaPipe（`faceCount 1 / eyeOpen .94 / mode landmarker`）。截图 `D:\trae-work\deliverables\20261115-focus-three-states\shots\`，脚本同目录 `cdp\shots.mjs`（自带 Chrome 启动并持有进程，需同目录 `student-face.jpg`，退出时 `kill()`；外部 shell 启动的 Chrome 会随 shell 退出导致 `ECONNREFUSED 127.0.0.1:9222`）。

## 专注空间：恢复全局导航（2026-11-15）

- 老大要求「网页现有导航栏不变，其他按三态设计稿」。查下来不是没有导航，是**特意藏了**：`AppShell.vue` 有 `.focus-shell .side-nav{display:none}`（桌面藏顶部横条）和 `<nav v-if="!isFocus" class="mobile-tabbar">`（手机藏底部标签栏）。两处都删掉，专注页回到标准外壳。
- 恢复后多出 80px sticky 导航，1440×900 会把「开始专注」挤出首屏（实测脚注落在 903）。按这个顺序压回来：`.focus-bar` 46→28 且去掉与导航重复的「专注空间」标签、`.focus-inner` 桌面 padding-top 20→4、`.focus-head` margin 16/28→8/18、`.focus-card` padding 30/34/28→24/30/22、待机环 340→300、专注环 330→300。现在 900 内脚注完整。
- `.focus-page` 的 `min-height:100vh` → `calc(100vh - 80px)`，并在 `@media(max-width:800px)` 覆盖回 `100vh`：手机没有顶部导航、底部是固定标签栏，不覆盖会在底部露出全局 `--bg(#eff6f7)` 与页面 `#F5F7F3` 的色差。
- 空态提醒：没有计划数据时 `subjectGroups` 为空，学科 chips 只剩「自由专注」；右栏「上次专注」只有一行占位，因为卡片用 `margin-top:auto` 把脚注贴底而随左卡通高，会显得很空——这是无数据造成的，不是布局坏了，有真实会话后自动填充。
- 已知未修（既有问题）：手机 390 宽下底部标签栏最后一项「专注」被裁到屏幕外，首页同样如此，与本次改动无关。
- 验证：`npm test` 208/208、`npm run build` 17.2s；Chrome headless 1440×900 与 390×844 截图（`D:\aaa\workBuddy\全国职业\output\focus_final_1440.png`、`focus_m_390.png`）。

## 专注空间：AI 助手按钮移到右下角（2026-11-15）

- 老大要求把右上角的「AI 学习助手」放到右下角。该按钮是 `AiFloatingTutor.vue` 的 `.tutor-button`，原来 `position:fixed;right:25px;top:14px`，正好压在桌面导航右侧（遮住「登录/注册」位置），看着像导航的一部分。
- 改动：`.floating-tutor` 改 `right:25px;bottom:24px;top:auto`；面板 `.tutor-panel` 从 `top:62px`（向下展开）改成 `bottom:62px`（向上展开），否则贴底后被视口裁掉。手机断点同步改成 bottom 定位。
- **老大明确「只做网页端，不再做手机端」（2026-11-15）**，后续界面只按桌面 1440 / 1024 走查，不再追手机端布局。之前为手机端恢复的底部标签栏（删 `v-if="!isFocus"`）保留未回退，因为不影响桌面。
- 已知未处理：手机 390 下该按钮不显示（媒体查询内尺寸规则疑似被 Element Plus 覆盖，未深究，按「不做手机端」跳过）。
- 验证：`npm test` 208/208、`npm run build` 16.6s；桌面 1440×900 截图确认按钮在右下、不遮挡右栏文案（`D:\aaa\workBuddy\全国职业\output\focus_tutor_1440.png`）。

## 专注空间待机页：对齐设计图（2026-11-15 晚）

- 老大要求「一模一样」。三处结构差异已补齐：
  1. **学科卡片**：之前只剩「自由专注」，因为 `subjectGroups` 只从 `planChoices` 分组。现在没有计划时先取 `store.profile.subjects`，档案也没有就退回初中常见四科（数学/语文/英语/物理，顺序按设计图）。`chooseSubject` 支持无对应计划的分支：按自由专注开始，把科目名写进 `freeTaskName`。
  2. **标题跟学科**：`idleFocusTarget` 原来在 `freeMode` 下恒为「这一件事」，现在读 `freeTaskName`，点「数学」标题就是「25 分钟，只做数学这一件事」，和设计稿一致。
  3. **右栏拆回两张卡**：`.idle-side-card` 合并版（本文件 687 行那条）改成 `camera-card`（一行开关）+ `last-card`（上次专注 + 脚注贴底），与这版设计图一致。`.side-divider` 因此不再使用，CSS 保留未删。
- **尺寸没有按设计图等比放大**：老大认可的是当前 1440 密度（环 300、卡片 padding 24/30）。按 680 画布等比换算会把环推到 347、正文推到 24px，正是 688 行记过的那次「整页像被浏览器 zoom」的坑。以后要还原设计图，仍然只调结构、环径、间距，字号守 `--fs-scale`。
- 剩余差异都来自「没有数据」：右栏「上次专注」只有占位文案；副标题是「今天还没开始，先做一轮看看」。跑过一轮专注后自动填充，不要为此造假数据。
- 验证：`npm test` 208/208、`npm run build` 16.6s、1440×900 截图 `D:\aaa\workBuddy\全国职业\output\focus_match_1440.png`。

## 专注空间：真跑两轮后修掉的三个 bug（2026-11-15 夜）

- 用 Chrome DevTools Protocol 真跑「选数学 → 25 分钟 → 开始 → 提前结束」两轮（不放数据），发现三个只有真跑才暴露的问题：
  1. **选了学科却记成「自由专注」**：`chooseSubject` 无对应计划时走 `freeMode` 分支，`buildSession.subject` 写死 `'自由专注'`，`runningSubject` 也是。结果记录、专注中标签、专注中标题全丢学科，「自由专注」和该科两个 pill 还同时高亮。修法：新增 `freeSubject` ref，`buildSession` / `liveSnapshot` / `runningSubject` / `runningTarget` 优先取它；pill 高亮改成 `freeMode ? freeSubject === group.subject : ...`，「自由专注」只在 `!freeSubject` 时高亮。
  2. **选学科后冒出自由专注的输入框**：`.free-line` 原来 `v-if="freeMode"`，改成 `freeMode && !freeSubject`。这条同时是「待机页和设计图不一致」的真因。
  3. **两轮等长仍写「一次比一次长」**：`trendText` 用 `value >= prev` 判递增，等长也算。改成必须 `some(v > prev)` 才算「一次比一次长」，否则落到「和上次持平」。
- 附带：`freeSubject` 一起存进 `settings.lastFreeSubject`，刷新后仍记得选的是哪一科，不会退回「自由专注」（`selectPlan` 里恢复）。
- 验证方式可复用：本机 Chrome 走 CDP（Node 22 自带 WebSocket，无需 puppeteer），`_cdp_focus.mjs` 那种脚本用完即删，别进仓库。
- 结果：`npm test` 208/208、`npm run build` 19.7s；三态截图 `output/walk_idle_final_1440.png`、`walk_focus_1440.png`、`walk_summary_1_1440.png`。

- 老大要求去掉左栏的「本周新增 / 已消灭 / 本周复习」三行统计，让知识点分布上移。已删模板里的 `.rail-stats` 整块、相关 CSS（含 ≤900 断点 4 条）以及变成孤儿的 `recentCount` / `fixedCount` / `weekRedoEvents` / `weekRedoCount` / `weekRedoAccuracy` 五个计算属性。**「已消灭」的筛选能力没丢**——顶部状态页签里还有这一项。
- 面板从 y=658 上移到 y=515（-143px），整块在第一屏内可见。
- 验证：`npm test` 208/208、`npm run build` 13.99s、`dist` 搜不到 `demo-mistake-1`；截图 `output/mk_after_1440.png`。

## 全局：意见反馈入口改成左边缘竖排小签（2026-11-16）

- `FeedbackWidget.vue` 桌面端原来是 `left:24px;bottom:24px` 的 110×38 胶囊，会压住左栏内容（错题库知识点分布的图例）。先试过收成 42px 圆图标，仍然压字（左栏从 x=36 起）。
- 最终方案：`@media(min-width:801px)` 下改成贴左边缘的 **30×90 竖排小签**（`writing-mode:vertical-rl`、`border-radius:0 12px 12px 0`、`border-left:0`），落在正文左侧留白里，一行字都不遮。
- **不做悬停展开**：展开会改变自身尺寸，`bottom` 锚定导致顶边下移，指针停在边缘时会「展开→离开→收起→再入手」死循环抖动。签子上已经竖写「意见反馈」，不需要再展开。
- 手机端规则（≤800）保持不变：42px 圆形靠右、避开底部标签栏。
- 验证：`npm test` 208/208、`npm run build` 14.04s；默认与悬停尺寸都是 30×90，`elementFromPoint(15,835)` 命中按钮内的 label。

## 错题库：知识点分布支持「全部学科」（2026-11-16）

- 原来 `.point-rail` 上有 `v-if="subject"`，只有选中单科才显示；老大给的两种设计是「全部 = 全科聚合」「单科 = 这一科」，所以去掉该条件。
- 标题改成 `{{ subject || '全部学科' }} · 知识点` + 右侧 `{{ pointTotal }} 道`，与设计稿一致。数据层不用改：`pointScope` 本来就只按 subject 过滤，`pointSlices` 也已经把第 6 项之后合并成「其他 N 个知识点」。
- 结论句两种形态复用同一套判断：占比 ≥ 50% →「一半的错都在这个点」，否则「最集中的是「X」」；设计稿的两个文案正好对应这两支。
- **设计稿是宽卡片（环形图左、图例右），左栏只有 190px**，所以沿用窄栏形态：环形图上、图例竖排、结论与「只看这 N 道」分两行。信息一项没少，只是排法受栏宽限制。
- 新增 `src/utils/demoMistakes.js`：27 道演示错题，构成和设计稿对齐（一元二次方程 5、化学方程式 3、一般现在时 3、文言实词 2、完形填空 2、其余 12 散在 8 个点）。入口 `MistakesView` 的 `onMounted`，`?demo=mistakes` 灌、`?demo=clear` 清，同样只在 dev 生效。
- 验证：`npm test` 208/208、`npm run build` 14.32s、`dist` 搜不到 `demo-mistake-1`；截图 `output/mk_all_1440.png`（全部 27 道）、`output/mk_math_1440.png`（数学 9 道，56%）。

## 专注空间专注中：按钮行对齐 + 左右卡片等高（2026-11-16）

- 老大框出两处：左卡倒计时下方的文字没对齐/格式不一致；右栏和左卡高度不一致。
- **按钮行**：`.focus-primary` 在桌面断点有 `margin-top:24px`，而 `.focus-primary-inline` 的 `margin-top:0` 写在断点之前、同权重 → 被后声明的 24px 覆盖。`.run-actions{align-items:center}` 下带 margin 的项按「含 margin 居中」，于是「继续」被整体下推 12px；字号也因为同样原因从 14px 被顶成 15.5px。修法：断点里加 `.run-actions .focus-primary-inline{margin-top:0;font-size:14px}` 和 `.run-actions .focus-text{font-size:14px}`（0,2,0 权重，压过 `.focus-primary`）。实测两者中线都在 630，字号都是 15.4px 实际渲染。
- **等高**：`.live-footnote`（隐私声明）原在 `.live-card` 外面，占掉 52px，导致右卡比左卡矮。把它移进卡内底部（待机页的 `.idle-footnote` 本来就是这么放的），右卡从 605 变 641，与左卡齐平。
- 三个视口实测 `左底-右底 = 0`：1440×900 / 1440×760 / 1280×720 / 1366×768。
- 验证：`npm test` 208/208、`npm run build` 14.34s；截图 `output/run_fixed_1440.png`、`output/run_fixed_1280.png`。

## 专注空间待机页：学科只显示有计划、点学科选任务（2026-11-16）

- 老大指出：学科按钮应该**只在有对应学习计划时才出现**，而之前那版用「学情档案科目 / 初中四科」兜底，会列出化学、历史这些没有计划的科目。现在 `subjectGroups` 只从 `planChoices` 分组，没有计划的科目直接不出现（可能只剩「自由专注」）。
- 点学科后出现「做哪一项」下拉框（`el-select`），列出该学科下全部任务，label 是 `任务名 · 预计时长`（同科多阶段任务靠时长区分）。`chooseSubject` 优先选 `settings.lastFocusPlanId` 指向的那一项，否则取该学科第一条。
- 顺带删掉 `freeSubject` 整套逻辑（那是为兜底科目服务的，现在没有设置入口了，留着就是死代码）；`buildSession` / `runningSubject` / `runningTarget` 回到 `freeMode ? '自由专注' : plan.subject`。
- 新增 `applyPlanDuration()`：切到某一项计划时，计时器改成该计划的 `estimatedMinutes`。原来 `initDuration` 优先读 `settings.focusMinutes`（`start()` 会写入上次档位），所以上次手动选了 45 分钟、切到 15 分钟的计划仍显示 45。实测：手动 45 → 切语文（15 分钟计划）→ 变 15:00。
- 演示数据扩到含计划：`demoFocus.js` 增加 `buildDemoPlans()`（数学 3 项 / 英语 2 项 / 语文 1 项）与 `seedDemoPlans` / `clearDemoPlans`，`?demo=seed|summary|clear` 会把计划和记录一起灌/清。
- 踩坑记录：给 `demoFocus.js` 做插入时把注释行和 `export function` 拼成一行，导致 `export` 被注释掉，Vite 直接 500、动态 import 失败、页面只出现「自由专注」。以后改这个文件后先 `curl -o /dev/null -w "%{http_code}" http://localhost:5173/src/utils/demoFocus.js` 确认 200。
- 学科只有 1 个计划时不再给单选项下拉框，改成一行静态文字 `本次要做 · 任务名 · 时长`（`.plan-static`）；≥2 项才用 `el-select`。三种情况实测：语文（1 项）→ 静态行、无下拉、15:00；数学（3 项）→ 下拉、无静态行、25:00；自由专注 → 两者都不出现，只出输入框。
- 「自由专注」不再和学科共用同一套 pill 样式：加 `.focus-pill.is-free`——透明底 + 1px 虚线圈 + 更淡的字；选中时只把虚线和文字换成主绿，**不变成实心**（学科选中才是白底实线+加粗）。桌面断点里 `.focus-pill{flex:1}` 会把唯一的虚线圈拉成整行宽（看着像个空输入框），补了 `.focus-pill.is-free:only-child{flex:0 0 auto}`。
- 验证：`npm test` 208/208、`npm run build` 18.79s（本轮 14.59s）、产物 `dist` 里搜不到 `demo-plan-math-1`；截图 `output/pick_default_1440.png`、`pick_dropdown_1440.png`、`pick_single_1440.png`、`static_single_1440.png`、`static_multi_1440.png`、`free_with_plans_1440.png`、`free_selected_1440.png`、`free_only_1440.png`。

## 专注空间：开发期演示数据（2026-11-16）

- 老大授权「没有数据就加数据，允许开发时加入数据检验」。新增 `src/utils/demoFocus.js`：三条 25/25/22 分钟的 `sampled: true` 记录，最新一条时间轴是 `8分清→2分走神→9分清→1分走神→1分离开→4分清`（在学 21 分、走神 3 分、离开 1 分，两次走神落在第 8 分和第 19 分，和设计稿数值完全对齐）。固定 id `demo-focus-*`，重复执行只覆盖。
- 入口在 `FocusView` 的 `onMounted`，全部包在 `if (import.meta.env.DEV)` 里，靠 URL 参数触发：
  - `/focus?demo=summary` → 灌数据并直接进结束回顾态
  - `/focus?demo=seed` → 只灌三条记录（给待机页的「上次专注 / 最近 3 次」）
  - `/focus?demo=clear` → 删掉这三条
- 为 clear 新增 `db/index.js` 的 `deleteFocusSession`（一行 `remove('focusSessions', id)`，本身也是缺失的通用能力）。
- 验证过生产构建：`dist` 的 JS 里搜不到 `demo-focus-latest`，演示数据没有进产物（只在 `.map` 里，源码本来就该在 sourcemap 里）。
- 顺带修掉一个只有真数据才暴露的问题：`recentSessions` / `trendText` 原来按 `actualSeconds` 算，三条都是 25:00 并排，趋势条完全一样却写着「一次比一次长」。新增 `sessionSeconds()`——有画面数据取 `focusSeconds`，没开画面才退回总时长。改完是 13:00 / 17:00 / 21:00，和设计稿一致。
- 验证：`npm test` 208/208、`npm run build` 15.1s；截图 `output/demo_summary_1440.png`、`output/demo_idle_1440.png`。

## 专注空间回顾页：对齐三态设计稿第 3 态（2026-11-15 夜）

- 老大要求「做成图三那样，除了数据不一样，布局和功能差不多」。把设计稿 03 面板的几何量出来对照：时间轴**全宽一张卡**（不是左栏卡）→ 下面才分两栏（建议 flex:1 / 右栏 320 比例）。现有结构已符合，缺口在卡片内部。
- 三处实测硬伤与修法：
  1. **无画面数据时时间轴只有首尾两个刻度**（`axisLabels` 回退成 `[0, minutes]`）。改成 `buildAxis()`：`step = total>40 ? 10 : 5`，输出 `0/5/10/15/20/25` 六档，和设计稿一致。1 分钟的短会话仍只有两档（分钟粒度所限，不再往下拆秒）。
  2. **大数字与灰条之间空了 82px**：`.timeline{margin-top:82px}` 是给走神浮标预留的，没浮标时就是空洞。加 `is-flat` 类，无 annotation 时 28px。卡片高从 279 → 225。
  3. **右栏便签不拉伸**（105px），按钮被 `margin-top:auto` 推到底，中间一片空。`.quote-card` 加 `flex:1`，便签填满右栏，与设计稿「便签 flex:1 + 按钮贴底」一致。
- 文案去重：副标题已有「这次没有开启学习画面，只记录了总时长」，轴下又重复一遍。轴下改成引导句「没开学习画面，这条轴只有总时长；下次打开会标出走神出现在第几分钟」。
- **未改**：底部空白（内容不足一屏时页面下方留白）——其它页面同样如此，不为了填满硬撑高度；`--fs-scale` 与 1440 密度不动。
- 验证：`npm test` 208/208、`npm run build` 15.7s；改前 `output/walk_summary_1_1440.png`、改后 `output/summary_after_1440.png`。采样态（有走神浮标/六档刻度）需要开摄像头真跑 15 分钟以上才能看到，本轮没造假数据。

## 错题库：知识点图例改为可滚动（2026-11-16 上午）

- 需求：知识点一多，左栏图例被拉成长条；要能在列表内滚动查看全部知识点。
- 做法：新增 `pointLegend`（全部知识点，前 5 个用扇区同色，其余统一 `POINT_COLORS[5]` 灰点，与圆环的「其他」扇区对应）；图例 `max-height:134px` + `overflow-y:auto`，`is-scroll` 时 5px 细滚动条 + 底部 13px 渐隐，滚到底加 `is-end` 撤渐隐。圆环仍保持前 5 + 其他，不让扇区碎。
- 坑：`scrollbar-width:thin` 一旦写上，Chrome 改用系统滚动条并忽略 `::-webkit-scrollbar` 的宽度（实测撑到 10px），自定义样式全部失效。只留 `::-webkit-scrollbar`。
- 验证：`npm test` 208/208、`npm run build` 14.13s；全部视图 13 行 scrollH 363 / clientH 134，滚轮后 scrollTop 229 到底并撤渐隐；数学 4 行无滚动条。

## 学习计划：滚动条改成一列刻度（2026-11-16 上午）

- 需求：计划可能很多、一屏放不下；右侧滚动条换成「一条刻度 = 一个计划」，当前滚到的那条加深（参考 WorkBuddy 会话列表那种刻度条）。
- 做法：`.plan-list` 隐藏原生滚动条（`::-webkit-scrollbar{width:0}`，滚轮/键盘/拖拽都保留），外层套 `.plan-scrollbox`，右缘绝对定位 `.plan-rail`。刻度按 `i/(n-1)*(railH-3)` 等距铺满列表可视高度，常态 9×2px、`color-mix(--plan-deep 30%)`；当前那条 16×3px 深绿。点刻度按比例滚过去。
- 坑：先用「视口顶部那一行」当高亮，滚到底只走到第 5 条（一屏能看 9 行），看着像滚动条停在半路。改成 `scrollTop/max*(n-1)`，跳转也用同一套映射反算，点完高亮正好落在这一条上。
- 开发埋点：`/plans?demo=plans` 灌 14 条演示计划（`src/utils/demoPlanList.js`，固定 id，`import.meta.env.DEV` 才引入，不进产物），`/plans?demo=clear` 清除。
- 验证：`npm test` 208/208、`npm run build` 14.12s、`dist` 搜不到 `demo-plan-list-1`；实测 14 条 → 14 条刻度，滚中 active=7、到底 active=13、点第 3 条 active=2。
- 收尾调整：刻度常态透明度 30% → 40%（hover 55%）；列表头 `0/14` 改成「已完成 0 / 14」，`b` 加粗到 `--plan-ink`，否则那个数字看不出是「已完成」。刻度数量不做裁剪——「一条刻度 = 一个计划」是需求本身，且 30 条以内间距仍有 18px。
- 二轮调整（同日下午）：① 删掉列表里那条「现在 09:23」横线（`now-row` 模板 + 4 条 CSS + `nowClock` 计算，全清）；② `DONE_PREVIEW` 2 → 20，往上滑才真有已完成的记录；③ 打开页面时 `anchorToFirstPending()` 把第一条待做顶到列表顶部（有 `?focusTask` 时跳过，不抢跳转位置）；④ 刻度改紧凑：固定 12px 间距、从列表顶部起排、`min(12, available/(n-1))` 自适应压缩，短横 7×2、当前 12×3，整列不再铺满高度——14 条时只有约 156px 高，下半段是空的（这是「紧凑」的代价，用户已知）。
- 二轮调整（同日下午）：① 删掉列表里那条「现在 09:23」横线（`now-row` 模板 + 4 条 CSS + `nowClock` 计算，全清）；② `DONE_PREVIEW` 2 → 20，往上滑才真有已完成的记录；③ 打开页面时 `anchorToFirstPending()` 把第一条待做顶到列表顶部（有 `?focusTask` 时跳过，不抢跳转位置）；④ 刻度改紧凑：固定 12px 间距、从列表顶部起排、`min(12, available/(n-1))` 自适应压缩，短横 7×2、当前 12×3，整列不再铺满高度——14 条时只有约 156px 高，下半段是空的（这是「紧凑」的代价，用户已知）。

## 答疑引用与来源徽标（2026-11-16，比赛提分）

- 需求：让评委在答疑页直接看到 RAG 检索依据与 AI 来源/安全兜底，而不是只在 AgentTrace 里写「检索到 4 条真题解析」。
- 后端：`server/agent.js` 新增 `publicCitations()`，把 `rag_knowledge_query` 的 `citations` 去重、限 4 条、拆成 `{text,title,detail}`；工具 done 事件与 `done.tools` 都带 `citations`。`server/index.js` 的 `/api/agent/tutor/stream` 原样透传 `citations`。
- 前端：新增 `src/components/AnswerCitations.vue`（「检索依据」蓝色小标签，detail 上屏、title 悬浮看完整出处）；`SourceBadge.vue` 补 `mock / safety-filter / safety-guard / rate-limit / config-error`，`deepseek` 文案改为「AI 生成」；`TutorView` 与 `AiFloatingTutor` 记录 `source/guard/citations`，回答底部显示来源徽标，安全改写时显示「安全改写」。
- 验证：`npm test` 294 通过（新增引用去重与流式 Agent 引用透传 2 条）、typecheck/build 通过；用本地 mock LLM 实测 SSE：tool done 事件带 3 条 citations，`done.tools` 同步带出。
- 下一步：比赛提分第二批候选——AI 能力页（MCP/RAG 实时演示）、一键演示模式、TypeScript 核心模块迁移。

## AI 能力页 /ai（2026-11-16，比赛提分第二批）

- 目的：把评分表里「RAG 6 / Agent 8 / MCP 4 / 多模态 5 / AI 安全 4」从代码里的隐性能力变成评委一屏能看见的可视化证据，且全部读真实后端状态，不做假动画。
- 路由与入口：`/ai`（name `ai-lab`，`meta.title='AI 能力'`，懒加载 `AiLabView.vue`）；`AppShell` 顶部导航新增「AI 能力」（spark 线性图标，放在「AI 答疑」之后）；移动端 `mobileNav` 排除 `/diagnosis` 与 `/ai`，避免竖栏过长；`HomeView` hero 新增「AI 能力」次要按钮。
- 后端新增两个只读接口（`server/index.js`）：`GET /api/ai/capabilities`（模型名、Agent 工具、MCP tools/resources/prompts、RAG 索引状态与评测用例数）；`GET /api/ai/rag-search?q=&grade=&subject=`（BM25 现场检索，返回 topics + 前 3 条 passages，含 `snippet/score/citation/subject/year/exam/tookMs`）。前端 `api.js` 补 `getAiCapabilities()` 与 `searchRagPassages()`。
- MCP 单一数据源：工具/资源/提示词元数据从 `server/mcp.js` 抽到新文件 `server/mcp-capabilities.js`，MCP stdio 服务与 `/api/ai/capabilities` 共用，避免两处文案漂移。
- RAG 摘要清洗（踩坑）：PDF 原文带 PUA 私用区字符与缺失数学符号，`looksGarbled` 曾把所有摘要判为乱码而整段过滤掉。现改为：先剥 `[\uE000-\uF8FF\uFFFD]`、在 `【答案】` 前截断，仍保留摘要并标 `garbled:true`。另加 `ragPreviewMatchesKeyword()` 二段过滤（拉丁词整词命中，或中文任意 2-gram 命中），否则「二次函数顶点式」会带出一条农业题。
- 页面结构（`AiLabView.vue`）：hero（标题 + 实时状态卡：模型/RAG/MCP/4 工具/23 评测用例/5 模态）→ 五步学习闭环 → RAG 现场检索（4 个快捷 query + 话题 chip + 原文片段卡）→ Agent 四工具 → MCP 三栏 + 可复制 `mcpServers` 配置 → 多模态五通道 + 五道可控护栏 → Local First 收尾。后端不可达时用内置兜底常量，页面不白屏。
- 验证：`npm test` 294 通过、`npm run typecheck` 通过、`npm run build` 通过；后端起在 3012、Vite 5174（`VITE_API_BASE_URL` 指向 3012，因 3001 被占）用 CDP 实测 1440×1000 与 390×844：hero/5 闭环卡/4 工具/3 MCP 栏/5 话题/3 条摘要齐全，`overflow=0`、控制台 0 报错；`/api/ai/rag-search?q=二次函数顶点式` 首调用 `tookMs≈390`。
- 注意：新的两个接口需要重启 `npm run dev:server` 才生效，浏览器端旧服务不会自动加载。
- 下一步：比赛提分第三批候选——一键演示模式（评委视角按脚本走完整闭环）、TypeScript 核心模块迁移（`api.js`/`stores/app.js`/`db/index.js`/`utils/mastery.js`）、巨型 view 拆分。

## 全站视觉统一「薄雾青」（2026-11-17，老大要求：安静治愈轻量化、低饱和青绿、全部页面统一）

- 设计方向：安静的学习桌面，不用彩虹/荧光/大标题炫技。全套色只有一支青绿 + 极小面积暖沙：`--bg:#f2f7f5`、`--surface:#fff`、`--surface-soft:#f6faf8`、`--text:#22322f`、`--muted:#5f736e`、`--primary:#4d817a`、`--primary-soft:#e7f1ed`、`--accent:#c09a70`、`--border:#e0eae6`。Element Plus 主色/语义色（success/warning/danger/info）全部同步降饱和，对错仍可分辨但不再荧光。
- 签名元素：全局 `.eyebrow` 统一为「一枚 5px 细点 + 疏排中文」（`letter-spacing:.18em`），各页原本混用的英文大写眉标（LEARNING INSIGHTS / NEXT STEP / CHAPTER QUIZ / AI STUDY COPILOT 等）全部改成中文小标签；这是全站最容易认出的统一记号。
- 排版：标题从 800 降到 600，`page-title 30px`、`page-subtitle 14.5px/1.8`、卡片标题 18–24px；Windows 微软雅黑没有 600 字重会回退到粗体，所以"变轻"主要靠字号回调和字距，不能只看 weight 数值。字号仍走 `--fs-scale`，没有破坏 1.1 倍全站放大。
- 版式：卡片圆角 18px、阴影换成 `--shadow` 低透明大扩散；首页 hero 标题 clamp(32,3.4vw,50)、卡片不再倾斜；首页科目卡从五种彩虹色统一为同一支青绿的明度档（深色模式回退为深纸面，否则浅底 + 浅字看不清）；导航 SVG 图标取消彩色，统一 `currentColor`（激活时主色）。
- 各页本地色板全部对齐：专注页/练习/背诵的深绿系、计划页 `--plan-*`、AI 能力页蓝色 `#3b6ea5`、诊断入口卡、Learning citations 蓝 chip 全部换成同一支青绿；「一句话实话」从米黄改为浅青绿；Dashboard ECharts 调色板改 `#4d817a/#9cbfb7/#a7c8bf/#c09a70/#b96b63`。
- 踩坑（重要）：Vue scoped CSS 里 `:global(:root[data-theme='dark']) .plan-page{...}` 会被编译成只剩 `:root[data-theme='dark']{...}`，后面的 `.plan-page` 被吞掉，深色覆盖静默失效。写法必须把整条选择器包进去：`:global(:root[data-theme='dark'] .plan-page){...}`。已修 `PlansView` 两处。
- 踩坑：全局 `styles.css` 的深色覆盖与 scoped 组件样式同为 0,2,0 时，组件样式后加载会赢；深色科目卡用 `:root[data-theme='dark'] .home-page .subject-grid .subject-card` 提高权重。
- 深色模式逐页补了本地色板覆盖：专注页（纸面/时长 chip）、诊断 hub 卡、计划页、练习/背诵页。材料页的气泡在深色下仍是浅色珍珠，文字可读，暂时保留。
- 验证：`npm test` 294 通过、`npm run typecheck` 通过、`npm run build` 通过；CDP 1440×1000 + 390×844 全 14 条路由截图 `D:\trae-work\tmp\ai-teach-theme\`，`overflow=0`、控制台 0 报错；深色模式 home/diagnosis/focus/plans/dashboard/ai/tutor/auth/quiz/mistakes/materials/practice 逐页核查。

## 整改批次 0 + A1/A2/A3（2026-11-17，按老大要求只做这三项）

- 基线：`2a43fa3` / tag `baseline-20261117`，把导入包后 146 处未提交改动一次性固化，`.env` 与 `server/data` 账号数据未入库（题库保留）。回滚命令：`git reset --hard baseline-20261117`。
- A1 重试（`server/agent.js`）：新增 `fetchWithRetry`，只重试 429/408/425/5xx 与网络错误，退避 300/900/2000ms，最多 2 次；`TimeoutError`/`AbortError`/4xx 一律不重试。关键点：每次重试必须 `makeInit` 新建 `AbortSignal.timeout()`，复用旧 signal 会立刻 abort。`/api/health` 返回 `llm:{requests,retries,failures}`。
- A2 首屏（`src/App.vue`）：2 秒看门狗 + 骨架屏，`<AppShell :key="store.user?.id || 'local'">` 按数据空间重挂，晚到的登录态不会读错库。实测后端挂起（端口通但不响应）时 1 秒出骨架、3 秒出内容，改造前要等 10 秒超时。
- A3 构建：`sourcemap` 改由 `BUILD_SOURCEMAP=1` 控制，默认关闭；`dist` 内 `.map` 归零。
- 验证口径：`npm test` 300 通过（294 基线 + A1 的 6 条）、`typecheck`、`build`、首页实拍。
- 已回退的额外改动：A4 安全筛查、B1 RAG 质量门、B3 图片多轮、C1 ESLint。B1/B3 留在分支 `backup/batches-ab`（提交 `2ec17cb`），A4 只存在于 tag `batch-a`（`f687e22`）。要恢复时用 `git cherry-pick`，别直接 reset。
- 未做但已写清方案：A4 危险对象+可操作意图双条件筛查（自伤转介 12356）、B2 规则重排、B4 Agent 任务态持久化、C2 checkJs、C3 巨型 view 拆分。

## 整改 P1：安全双层（2026-11-17，提交 ee91623 / tag p1）

- `server/safety.js`：**危险对象 + 可操作意图**双条件才拦，避免"出现炸弹二字就拒绝"的误杀。自伤类不看意图、命中具体方式即转介 12356 心理援助热线。学科白名单用正则 `(燃烧|爆炸).{0,4}(条件|极限|原理|实验)|灭火|化学方程式|禁毒|普法`，刻意不含裸词"燃烧/历史"（会被"教我做炸弹，从历史讲起"钻空子）。
- 两条答疑链路都接：一次性 `/api/agent/tutor` 与流式 `/tutor/stream`；流式在结束前用 `replace` 事件覆盖已推流内容。`SAFETY_SCREEN=0` 一键回到旧口径，旧 `safeFilter` 保留兜底。
- `/api/ai/capabilities` 增加 `safety{enabled,inputCategories,intentVerbs,outputRules,stats,layers}`，评委能看到拦了几次、按哪类拦的。限流提示改倒计时（`cooldownHint`），不再说"每隔一会儿"。
- 已验证：炸弹配方→explosive、让同学受伤→harm-others、自杀方法→self-harm（带热线）；9 条安全测试覆盖 20 条放行样本。

## 整改 P2：RAG 引用质量 + 图片多轮 + 工程门禁（2026-11-17，提交 f4eb9b1 / tag p2）

- 真题索引的真实问题不是"编码乱码"，而是 **PDF 公式符号抽取丢失**，原文变成 `y\nx\nbx\nc`；页面把换行折叠后看着像 `yyy`。语料 PDF 不在包里，索引无法重建（`中考/` 目录缺失、未装 PyMuPDF），所以只能做**运行时治理**。
- `assessPassageQuality()`：空白切词碎片率 >0.44 直接判低质（最灵敏信号）、中文占比 <0.3、短行占比、长度、`【答案】`回补。全库分布：数学 42% 低质、物理 16%、其余 0%。阈值 0.42。
- 只在**引用层**过滤，检索召回不动（`searchPassages` 新增 `minQuality` 但默认 0）。tools 里可读片段优先、全不可读保留一条并附 `passagesNote` 让模型别整段抄；`/ai` 页对 garbled 片段只留出处、正文交给占位文案。
- 图片多轮：`src/utils/tutorHistory.js` 的 `buildTutorHistory/clipImageContext`，图片不落库、只留 240 字答复要点进下一轮 history；说明文案同步改。
- 工程门禁：`eslint.config.js` 只开查错规则（`no-dupe-*`/`no-unreachable`/`no-obj-calls` 等），`no-useless-escape`/`no-control-regex` 关闭并注明原因，模板风格规则全关；当前 0 error / 26 warning。`mastery/notices/reciteMode/studySession` 加 `@ts-check`，受检文件 5→9。
- UI 修：`AiLabView` 状态卡取值改 `font-family:inherit`，等宽字体把 `deepseek-flash` 拉成散字的问题消失。
- 验证：318 测试通过、typecheck、lint 0 error、build、rag:eval 23/23。

## 整改 P3：证据可见化 / RAG 重排 / 加载体验（2026-11-17）

- P3-1（`423be70`）：`/api/ai/capabilities` 补 `llm.stats` 与 `rag.quality`（`ragQualitySummary()` 按索引对象缓存，避免每次遍历 1294 chunk）；`/ai` 页护栏清单从写死文案改为读真实配置与拦截计数，RAG 区显示"82/1294 低质，数学 57/136"。
- P3-2（`7eec59a`）：新增 `server/rag/rerank.js`，在 BM25 上叠三字覆盖度、可读性、`【答案】`结构、学科一致、过短残块降权；**先召回 Top-6 再重排取 4/3**，召回范围不变只改顺序。`RAG_RERANK=0` 可退回。新增 `npm run rag:rerank:eval` 做前后对比：通过率与 Top-1 学科命中均不变，Top-1 平均可读性 0.90→0.93，无退化用例——**收益是真实的但很小，别在答辩里夸大成"大幅提升"**。
- P3-3（`46e50f9`）：`routeProgress` + 路由钩子给懒加载页面加顶部 2px 进度条（弱网实测 250ms 出现、完成后消失）；深色主题镜像到 localStorage + `index.html` 内联脚本，慢网 6 倍降频下首帧即 dark，消除 FOUC。
- 踩坑：`printf` 写提交信息时中文全角符号 + `%` 会报 `invalid format character`，改用 `cat > 文件 <<'EOF'` 再 `git commit -F`。
- 现象级小事：Vite 每次 `package.json` / lockfile 变化会尝试 `rm -rf node_modules/.vite/deps`，被沙箱安全删除守卫拦下，表现为 vite 启动失败；处理办法是 `mv node_modules/.vite node_modules/.vite.bak.<时间>` 后重启。
- 验证基线：`npm test` 325、lint 0 error / 26 warning、typecheck、build 全绿。

## 整改 P4 / P5（2026-11-17，24 小时窗口，老大要求三阶段连做）

- P4（`28822a9` / tag `p4`）：Agent 运行态（IDB v9 + `agentRuns` 表，仅记录真调过工具的轮次）、工具护栏（`server/tool-runtime.js`：3s 超时 + 重试 1 次 + 连续 3 次失败熔断 30s）、MCP 结构化错误码（INVALID_ARGS/TOOL_NOT_FOUND/TOOL_TIMEOUT）、PII 脱敏（`server/pii.js`）与 60 条安全评测（30 对抗 + 30 正常，`npm run safety:eval`，当前 100% 拦截 / 0 误杀）。`/ai` 页展示最近运行与安全评测数字。
- P5-1（`2ab48bd`）：`server/rag/synonyms.js` 15 组别名做查询扩展（`RAG_EXPAND=0` 可关）。评测集补 5 条口语化用例；把 2 条"语料根本没有这个考点"的用例标 `corpusGap` 单独列出、不计入通过率（全库仅 3 个片段含欧姆定律）。实测：扩展开启 26/26，关闭 25/26。
- P5-2（`4e36bfc`）：`scripts/rag-add-doc.mjs`（`npm run rag:add`）增量入库 + `loadRagIndex` 按 mtime 2 秒窗口热加载；`tokenizeForIndex` 与 Python 建库同口径。实测新增一条扇形面积题 3 秒内可被接口检索到，恢复索引后自动消失，全程未重启。
- 踩坑：本环境里同一条 bash 命令偶尔会被执行两次，导致 python 批量替换重复插入（`App.vue`、`AiLabView.vue` 各出现过一次重复 import/声明）。写文件后要 `grep -c` 校验唯一性，别假设只改了一遍。
- 当前基线：`npm test` 352、lint 0 error / 26 warning、typecheck、build、`rag:eval` 26/26 + 2 语料缺口、`rag:rerank:eval` 无退化、`safety:eval` 100%/0%。
- 待做：P5-3 句向量（独立分支）、P5-4 图片链路流式、P6 前端工程（checkJs / 巨型页抽 composable / 引用可点击）。

## 协作约定

- 每个任务收尾固定格式：**做了什么 / 验证结果 / 下一步建议**，必须带「下一步」，不等豪哥再问。
- 对话中始终称呼用户「老大」；每次改完代码，回复末尾都要附最新网页入口 `http://localhost:5173`（API 3001），方便直接点开检查。

## 待补充

- 无。认证方案已于 2026-11-12 定案（本地优先 + 邮箱口令），见上。

## 整改基线（2026-11-17）

- 基线提交 `2a43fa3` / tag `baseline-20261117`；本轮只做 A1（LLM 重试）、A2（首屏看门狗+骨架）、A3（默认关 sourcemap），提交 `a2863c0` / tag `scope-a`。
- 测试 294 → 300（新增 `server/retry.test.js` 6 条）。
- 超出范围的 A4/B1/B3/C1 已回退：B1/B3 在分支 `backup/batches-ab`，A4 在 tag `batch-a`。

## GitHub 协作基线（2026-11-17）

- 主仓库 `https://github.com/wcaaa-art/ai-teach`（**Public**），账号 `wcaaa-art`；Gitee 仍作国内备份，两边历史独立。
- CLI：`gh` 2.104.0，路径 `C:\Program Files\GitHub CLI\gh.exe`（winget 装，当前 shell 的 PATH 未刷新，调用时写全路径）。token scope 为 `repo / workflow / gist / read:org`；**推 `.github/workflows/*` 必须带 `workflow` scope**，否则 push 被 OAuth 拒（`refusing to allow an OAuth App to create or update workflow`），补授权用 `gh auth refresh -s workflow`。
- 免费版**私有**仓库调分支保护/规则集一律 403（`Upgrade to GitHub Pro or make this repository public`），所以仓库转为 Public；再次转私有会掉保护。
- main 保护：必须走 PR、至少 1 人 review、CI check 名 `check` 必须绿、禁 force push 与删除；`enforce_admins=false`，管理员保留绕过能力，避免单人时无法合并（GitHub 不允许自审通过）。
- CI：`.github/workflows/ci.yml`，Node 22 + `npm ci` + `lint` + `test` + `typecheck`，首次推送即跑绿；本机是 Node 20.11.1 / npm 10.2.4，两边都过。
- 协作入口：`.github/pull_request_template.md`、`.github/ISSUE_TEMPLATE/{bug_report,feature_request}.yml`、`CONTRIBUTING.md`。
- 顺手修掉 `server/index.js` 能力清单里重复写两遍的 `rerank` 键（当时 lint 唯一 error）。
- 公开前的敏感信息扫描结论：无真实密钥入库，`.env` 与 `server/data/` 均未跟踪；MEMORY.md 里只有本机路径 `C:/Users/豪` 与 Gitee 地址，属公开可见信息，未做脱敏。
