# 专注空间三态改版 Tasks

> 对应 spec：`specs/focus-space-three-states/spec.md`
> 执行顺序固定，前一项验证通过再进入下一项。

## T1 基础组件能力
1. `CountdownTimer.vue` 增加 `plain` 模式：只输出纯文本倒计时，保留 tick/complete/reset。
2. `CameraMonitor.vue` 增加 `bare` 模式：只渲染视频/占位与开启按钮，保留事件、consent 弹窗与 expose。
3. `AiFloatingTutor.vue` 移到右上角，面板向下展开。
4. `AppShell.vue` 快捷键面板删除空格/F 两行。
- 验证：`npm run build` 通过；其他页面无样式回归（计划页、答题页各看一次）。

## T2 FocusView 状态与数据层
1. 用 `view(idle/focus/summary)` 替换 `phase`，拆出 `resting` 轻量休息。
2. 新增 `sessions/lastSession/attentionLog`；实现 `sessionType/markAttention/closeAttentionSegment/normalizeTimeline/buildSession`。
3. `finishSession` 统一处理自然结束/提前结束：落库 → 关摄像头 → 进入 summary。
4. 新增 `startRest/skipRest/finishRest/startAgain`。
5. 删除青柠、演示模式、快捷键、7 天热度相关代码与导入。
6. `restoreLiveSnapshot` 走完时直接进入 summary；恢复中途计时时开启采样（unknown 起步）。
- 验证：`npm run build`；手工开始→暂停→继续→提前结束，IndexedDB 新记录含 `timeline/focusSeconds/.../sampled`。

## T3 待机态
1. 标题/副标题、学科 pills、自由专注输入、计划名行。
2. 164 圆环 + 34px 时间 + 时长 chips（15/25/45/追加/自定义）+ 开始按钮 + 脚注。
3. 右栏学习画面开关 + 上次专注卡（状态条/图例/最近 3 次/观察句）+ 底部说明。
- 验证：无计划、单计划、同科多计划、建议 20 分钟四种数据下显示正确；开关能拉起隐私弹窗。

## T4 专注中态
1. 标题/副标题、196 圆环 + 38px 倒计时 + 剩余文案。
2. 暂停/继续 + 提前结束；底部三格真实统计。
3. 右栏视频卡：实时点、画面 pill、时间戳、本次状态条、图例、状态句；未开画面时显示开启入口。
- 验证：倒计时与圆环同步；离岗自动暂停并切到 away 段；暂停不累计采样。

## T5 结束回顾态
1. 标题/副标题、大卡（在学 mm:ss、走神/离开、与上次对比）。
2. 时间轴 + 标注（≤3）+ 轴（步长 5/10）。
3. 三条建议、米黄一句话、休息/再来一次/写反馈。
4. 无采样降级：只显示总时长，不出现分段与对比。
5. 轻量休息条底部倒计时，归零/跳过回待机。
- 验证：有采样/无采样/旧记录三种回顾各走一遍；写反馈能提交并更新计划。

## T6 视觉与响应式
1. 按 spec 第 3 节落地颜色、字号、间距、圆角。
2. 1000px 断点单列；640px 断点缩放圆环、字号、内边距。
3. 保留全屏隐藏光标、`prefers-reduced-motion` 降级。
- 验证：1440×900、390×844 无横向滚动；三态截图对照参考稿。

## T7 回归与交付
1. `npm run build`、`npm test`。
2. 实际走查：开始→暂停→继续→提前结束→休息→再来一次；刷新恢复；离岗暂停。
3. 截图归档；汇报附 `computer://` 链接与截图。
4. 回写 `MEMORY.md`：三态结构、session 新字段、CameraMonitor `bare`、CountdownTimer `plain`、AI 导师右上角。
