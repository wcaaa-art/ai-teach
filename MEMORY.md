# MEMORY.md — AI-Teach-project

> 只记代码里查不到的东西：决策、踩坑、外部资源位置、用户纠正。凭据只记位置不记值。

## 当前状态（2026-11-05）

- 仓库原为传智杯参赛作品「知行 AI 学伴」，运行界面品牌已改为「Ai学习小伙伴」；根目录有 `传智杯提交包/` 与 `传智杯提交包.zip`（约 30MB，历史快照未同步改名）。
- 已有页面：Home、Diagnosis、Plans、Focus、Tutor、Dashboard、Settings、Auth。
- 界面约定（2026-11-05）：品牌文案为「Ai学习小伙伴」，logo 为 A/i/学/习 2×2 四宫格（文案仍是「Ai学习」）；根路径 `/` 重定向到 `/home` 学习主页；学情诊断路由改为 `/diagnosis`；桌面（≥801px）用顶部横向导航且不再显示页面横条，状态/登录入口并入导航最右侧（不再保留设置齿轮，`/settings` 从导航项进入）；≤800px 保持左侧竖栏 + 横条（只留页面标题和登录/退出，避免 375px 溢出）。
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

- 胶囊导航（2026-11-08）：模仿参考图把桌面导航改成浮动白色胶囊——`margin:16px 24px 0`、`border-radius:18px`、柔和阴影、logo 与导航间竖线；7 个导航项改内联 SVG 线性图标（蓝/橙/绿/青/紫/蓝/灰），选中态用主题青绿胶囊 + 底部 2px 线，设置项 `margin-left:auto` 靠右并带分隔线；桌面 `--nav-h` 改 80px（16 外边距 + 64 高），登录页 `calc(100vh - var(--nav-h))` 仍成立。801–1120px 只留图标，1121–1280px 收紧文字，≤800px 保持原竖栏。品牌四宫格与站点青绿底色不跟随参考图的蓝 logo/蓝选中态，避免与全站主题冲突。

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

- 考试区域口径（2026-11-08）：初中卷型对齐**佛山中考**，高中对齐**广东新高考（3+1+2，语数外全国卷、其余广东命题）**，不是纯全国卷。已写进诊断页 `.stage-note` 与首页 hero 说明，演示/文档口径要一致，不要说成「全国统一卷」。

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

## 协作约定

- 每个任务收尾固定格式：**做了什么 / 验证结果 / 下一步建议**，必须带「下一步」，不等豪哥再问。

## 待补充

- 认证方案最终选型（本地 vs 服务端持久化）、登录方式、密码/会话策略。
