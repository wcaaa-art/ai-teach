# 专注空间三态改版 Spec

## 1. 目标

把 `src/views/FocusView.vue` 按用户上传的《专注空间_三态对照模板_对齐优化版》整页重排为三态：

1. **待机**（摄像头未开）：回答「今天值不值得开始」。
2. **专注中**（摄像头开启）：回答「现在有没有在学」。
3. **结束回顾**：回答「这次到底发生了什么」。

保留既有计时、摄像头监督、离岗暂停、跨页快照、落库、反馈与计划迭代逻辑；视觉与信息层级按新稿重写。

## 2. 范围

### 保留
- 计时（CountdownTimer 的 tick/complete）、暂停/继续、提前结束、全屏。
- 摄像头监督（MediaPipe 推理、离岗自动暂停、走神/犯困/多人温和提示、误判反馈）。
- `focusSessions` 落库、`saveDistraction`、`saveVisualLog`、`saveFeedback`、`iteratePlan`。
- 跨页面专注快照 `liveFocus`（写/清、恢复）。
- 自由专注（不关联计划、只记时长、不参与计划迭代）。
- 写反馈弹窗（Element Plus dialog）。
- 测试建议时长（`loadFocusSuggestion`）。
- 全屏计时中 3 秒隐藏光标。

### 不保留（删除相关 UI 与逻辑）
- 青柠奖励（`LimeIcon`、`todayLimes`、庆祝浮层、青柠统计）。
- 演示模式（`demoMode`、模拟离岗、`isDemo` 分支）。
- 空格 / F 键盘快捷键（`onShortcutKey` 及监听；同步删掉 AppShell 快捷键面板里这两行说明）。
- 旧的「咖啡休息」独立界面（改为结束回顾页底部的轻量休息条）。
- 近 7 天热度格子、右侧「专注小提示」。

### 不在本次范围
- 全局导航、主题变量、其他页面。
- 服务端或数据库结构升级（新字段只写在 session 记录里，旧记录降级显示）。

## 3. 设计基准

参考稿宽 680px（内容区），实现时内容区最大宽度 1120px（左卡 flex:1 + 右栏 320px + gap 14）。

### 颜色
| 用途 | 值 |
|---|---|
| 页面底 | `#F5F7F3` |
| 卡片 | `#FFFDFA` |
| 描边 | `#EDF1EC` |
| 分隔 | `#F1F4EF` |
| 主文字 | `#17251F` |
| 次文字 | `#66766D` |
| 弱文字 | `#93A099` |
| 更弱 | `#B4BEB7` |
| 主色 | `#2E5C4B` |
| 浅绿 | `#E7F0E9` |
| 强调绿 | `#5A8F72` |
| 选中描边 | `#A9C7B2` |
| 走神 | `#C99A63` |
| 离开 | `#D9DED8` |
| 米黄 | `#FBF6EE` / 文字 `#6B5A45` / 标签 `#B09A7E` |
| 中性未记录段 | `#E6EAE3` |

### 字体
- 中文：继承全局 `-apple-system, 'PingFang SC', 'Microsoft YaHei', system-ui`。
- 数字：`Georgia, 'Times New Roman', serif`，`font-variant-numeric: tabular-nums`。
- 标题 23px / 500 / `letter-spacing:-.01em`；副标题 12px。
- 圆环数字：待机 34px `#5C6B62`；专注中 38px `#17251F`。
- 卡片小标题 12px / 500；说明 11–11.5px。

### 结构
- 共享顶栏（页面内）：左侧 `专注空间` 极小标签 + `全屏` + `退出` 文本按钮，高 34px；右侧留给 AI 悬浮导师。
- 标题区：23px 一句话 + 8px 间距 + 12px 副标题。
- 主体：左卡 flex:1，右栏 320px，gap 14，卡片圆角 16、描边 1px、内边距 16/18。
- 右栏底部一行：5px 圆点 + 「摄像头只在专注期间开启，计时结束自动关闭。」

## 4. 状态机

```
idle --开始专注--> focus --计时结束/提前结束--> summary
summary --休息 5 分钟--> summary(resting) --倒计时归零/跳过--> idle
summary --再来一次--> focus
focus --暂停--> focus(running=false)，计时与状态采样停止
```

- `view = 'idle' | 'focus' | 'summary'`，替代旧的 `phase`（break 逻辑拆成 `resting`）。
- `resting` 只控制固定底部小条，不属于独立页面。
- 结束回顾进入时摄像头自动 `disable()`。

## 5. 三态内容

### 5.1 待机
- 标题：`${totalMinutes} 分钟，只做${subject}这一件事`；自由专注为 `…只做这一件事`。
- 副标题：今日有专注 → `今天已经专注 X 分钟，再补一轮就更稳了`；无 → `今天还没开始，先做一轮看看。`
- 左卡：
  - `这次做什么` + 学科 pills（进行中非桥接计划按 `sequenceOrder` 去重学科；末尾 `自由专注` pill）。
  - 选中学科后 `本次：{计划名}`（12px 次文字）；同科多计划时直接显示选中计划名。自由专注显示 24 字输入框。
  - 164 圆环（r=80，stroke 5，viewBox 200）+ 34px `25:00` + `还没开始`。
  - 时长 chips：15 / 25 / 45；若当前时长不在其中追加同值 chip；`自定义` chip 展开 `el-input-number`（5–180）。
  - 有测试建议时显示 11px 提示（来源 + 正确率 + 建议分钟），不抢视觉。
  - 实心 `开始专注`；脚注 `摄像头未开启，只会计时。` / `学习画面已开启，走神和离开会自动记录。`
- 右栏：
  - `学习画面` 开关行（摄像头图标 + 标题 + 11px 说明 + el-switch）。
  - `上次专注` 卡：最近一条 session。
    - 有数据：`${相对日} ${HH:mm} · ${subject}`；`21:00` + `在学 · 共 25 分钟`（无采样时 `共 25 分钟`）。
    - 状态条：有采样按 focus/distracted/away 比例；无采样整条中性灰 + `这次没有学习画面数据，只记录了总时长。`
    - 图例 `专注 X 分 / 走神 X 分 / 离开 X 分`（无采样隐藏）。
    - 最近 3 次 mini 条（按最大时长归一，最新深色）+ 趋势短语。
    - 底部一句观察：从最近一次时间轴生成（首次走神分钟等）；无记录时如实空状态。

### 5.2 专注中
- 标题：`这 ${totalMinutes} 分钟，正在做${subject}`；自由专注 `正在做这件事`。
- 副标题：`第 N 次专注 · 离开座位会自动暂停，不用手动记`；摄像头未开 → `…学习画面未开启，只记录总时长`。
- 左卡：
  - `专注中 · ${subject}` 小标题。
  - 196 圆环（进度 = 已过时间占比）+ 38px 倒计时 + `还剩 X 分 Y 秒`。
  - `暂停/继续` 实心胶囊 + `提前结束` 文本。
  - 底部三格：`今天第几次`（今日已保存数 +1）、`今日专注`（今日分钟 + 本次已过分钟）、`连续专注`（连续有专注记录的天数，含今天）。
- 右栏：
  - `学习画面` + 右侧实时点 `实时` / `未开启`。
  - 视频区 292×164 比例，圆角 10；左上 pill `在学习` / 走神类标签 / `离岗`；右下 `HH:mm` 时间戳。
  - 本次状态条（focus/distracted/away/unknown）+ `专注 X 分 / 走神 X 分 / 离开 X 分`。
  - 底部一句：未开画面 / 离岗自动暂停 / 实时正常，按状态生成。

### 5.3 结束回顾
- 标题：有采样 `这 X 分钟，你有 Y 分钟在学`；无采样 `这 X 分钟，已经记下来了`。
- 副标题：`摄像头已自动关闭。下面是这一轮发生了什么。`；无采样 `这次没有开启学习画面，只记录了总时长。`
- 大卡：
  - 左：`21:00` + `在学 · 共 25 分钟`（无采样 `共 25 分钟`）。
  - 右：`走神 3 分 · 离开 1 分` + `比上一次多 4 分钟`（有可比数据才显示）。
  - 时间轴：分段比例条；走神/离开段上方最多 3 个标注 `第 X 分 · 走神 N 分`；下方轴 `0…总分钟`（步长 5，>40 分钟用 10）。
  - 无采样：单条中性灰 + 轴 + 一句 `这次没有学习画面数据`。
- 下方：
  - 左 `下次可以这样`：固定 3 条 01/02/03，全部由真实数据生成（首次走神点、离开时长、与上次对比）。无数据时给出可执行的通用建议，不编造数字。
  - 右 320：米黄 `给你的一句话` + 实心 `休息 5 分钟` + 文本 `再来一次` + 文本 `写反馈`（自由专注隐藏）。
- 轻量休息条：`● 休息 04:32  [跳过]`，固定底部居中；归零/跳过后回待机。

## 6. 数据口径

### 6.1 session 新增字段
```js
{
  focusSeconds, distractedSeconds, awaySeconds,   // Number，来自时间轴
  sampled,                                        // Boolean，画面数据覆盖 ≥90%
  timeline: [{ type: 'focus'|'distracted'|'away'|'unknown', seconds }]
}
```
旧 session 无字段：`sampled=false`，所有界面降级为「只显示总时长」，不补造分段。

### 6.2 采样实现
- `sessionType()`：未启用监督 → `unknown`；`isPresent=false` → `away`；`attentionState` 非 `focused` → `distracted`；否则 `focus`。
- `start()`（新会话）：清空 `attentionLog`，记录起始类型与时间。
- `watch` `isPresent / attentionState / supervisionEnabled`：运行中状态变化即切段。
- `pause()` 关闭当前段；继续时重新开段（暂停时间不计入时间轴）。
- `buildSession()` 关闭当前段，按 `actualSeconds` 等比缩放到整数秒，汇总三个总计，计算 `sampled`。
- 时间轴只覆盖真实计时时间；提前结束也按实际时长出轴。

### 6.3 展示口径
- `formatClock` 用于 `21:00`、倒计时；`shortDuration` 用于「X 分」（<60s → 不足 1 分）。
- 今日次数/分钟：按自然日过滤 `focusSessions.createdAt || startedAt`。
- 连续专注：按有专注记录的自然日从今天（含当前未落库会话）往前数。
- 上次对比：仅当上一条 session 有 `sampled` 且 `focusSeconds` 可读时显示差值。

## 7. 文件改动

### 7.1 `src/views/FocusView.vue`（整页重写）
- script：
  - 新增 `view/resting/restRemaining/sessions/lastSession/attentionLog/summary` 相关状态与计算。
  - 删除 `phase/breakRunning/breakRemaining/celebrate/celebrateTimer/endedMinutes/weekFocus/todayLimes/heatLevel/loadWeekFocus/demoMode/simulateAway/onShortcutKey/shortcutBlocked/pomo-keys` 及 `LimeIcon` 导入。
  - 保留并改写：`selectPlan/enterFree/switchTask/initDuration/applyDuration/choosePreset/chooseCustom/liveSnapshot/persistLive/onTick/start/pause/toggleFullscreen/onVisibility/onVisualStatus/playGentleSound/onVisualAlert/falsePositive/onAttentionNotice/elapsedSeconds/resetClock/openFeedback/submitFeedback/restoreLiveSnapshot`。
  - 新增：`loadSessions`、`finishSession(completed)`、`startRest/skipRest/finishRest/startAgain`、注意力分段函数、`timelineView/summaryTips/quote/lastSessionCard/recentSessions` 等 computed。
  - `onTimerComplete` → `finishSession(true)`；`endFocus` → `finishSession(elapsed ≥ 80%)`。结束后 `camera.disable()`。
- template：三态结构 + 轻量休息条 + 反馈弹窗；`CameraMonitor bare` 常驻右栏（待机时容器 `display:none`，保证开关在待机阶段开启摄像头后进入专注不重启流）。
- style：按第 3 节重写，`--fs-scale` 全部保留；新增 1000px / 640px 断点；保留 `is-cursor-idle`。

### 7.2 `src/components/CountdownTimer.vue`
- 新增 `plain: Boolean` prop。
- plain 时只渲染 `<div class="plain-clock">{{ display }}</div>`，不渲染翻牌数字与 hint；根节点加 `is-plain`。
- 其余逻辑（tick/complete/reset）不变。

### 7.3 `src/components/CameraMonitor.vue`
- 新增 `bare: Boolean` prop。
- bare：不渲染标题/开关/隐私说明/指标行/误判按钮/预览折叠；只渲染视频区；未激活时渲染占位与「开启学习画面」按钮（点击走现有 `requestEnable`）。
- 保留 consent dialog、`status/alert/attention/false-positive/model-error` 事件与 `defineExpose`。
- bare 样式：透明根、视频 `aspect-ratio:292/164`、`object-fit:cover`。

### 7.4 `src/components/AiFloatingTutor.vue`
- 悬浮球改 `position:fixed; right:25px; top:14px`；面板从按钮向下展开（`top:62px`）。
- 手机端 `right:14px; top:12px`。

### 7.5 `src/components/AppShell.vue`
- 快捷键面板删除「空格 专注页 开始 / 暂停」「F 专注页 全屏」两行（功能已删，避免文档漂移）。

## 8. 边界与降级

- 无计划：只有 `自由专注` pill + 输入框；标题 `…只做这一件事`。
- 建议时长 20 分钟：出现 `20 分钟` chip 并选中。
- 摄像头未授权/模型失败：专注照常计时；右栏显示开启入口；回顾页降级为总时长。
- 中途暂停：时间轴只统计运行时段，轴最大值按实际计时分钟。
- 离开期间计时走完（恢复快照）：补记 session（无时间轴），直接进入结束回顾。
- 旧记录：待机「上次专注」与回顾页均不显示分段，不显示与上次的对比差值。
- 窗口切走：沿用暂停 + 分心记录；不在回顾页/待机触发。
- 减少动态偏好：呼吸/过渡/脉冲全部禁用。

## 9. 验收标准

1. `npm run build` 通过；`npm test` 全绿。
2. 1440×900 与 390×844 均无横向滚动；三态截图与参考稿的层级/间距/颜色一致。
3. 待机：学科 pill 切换会更新标题与计划；时长 chips 15/25/45/自定义可用；摄像头开关能拉起隐私弹窗；`开始专注` 进入专注态。
4. 专注中：倒计时与圆环同步递减；暂停/继续正常；提前结束进入回顾且摄像头关闭；三格统计为真实数据。
5. 回顾：有画面数据时显示 「在学 mm:ss + 走神/离开 + 时间轴标注 + 3 条建议」；无画面数据时只显示总时长；`休息 5 分钟` 出现底部倒计时条并归零回待机；`再来一次` 直接开始新一轮；`写反馈` 仍能打开弹窗并提交。
6. 控制台无报错；摄像头未开启时回顾页不得出现任何编造的分段。

## 10. 验证方式

```powershell
cd d:\aaa\ai-teach
npm run build
npm test
npm run dev   # vite 5173 + server
```
- CDP 截图：待机 / 专注中（启用摄像头后）/ 结束回顾（点提前结束或等待完成），各截 1440×900 与 390×844。
- DOM 检查：无横向溢出（`document.documentElement.scrollWidth <= innerWidth`）；回顾页标注数量 ≤3；摄像头关闭态无 `<video>` 流。
- 汇报：`computer://` 链接 + 截图 + 本次 MEMORY.md 回写内容一句话。
