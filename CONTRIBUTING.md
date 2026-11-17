# 协作开发指南

## 环境准备

```powershell
npm install
Copy-Item .env.example .env    # 填 DEEPSEEK_API_KEY，不配也能本地降级跑通
npm run dev                    # 前端 5173 + 后端 3001
```

Node.js 20 LTS 起步，建议 22 LTS。接手开发前先读 [`AGENTS.md`](AGENTS.md) 和 [`MEMORY.md`](MEMORY.md)，再看 [`docs/交接文档.md`](docs/交接文档.md)。

## 分支与合并

`main` 受保护，任何人不能直接 push，所有改动走 Pull Request。

| 分支前缀 | 用途 |
| --- | --- |
| `feat/` | 新功能，如 `feat/plan-bridge-review` |
| `fix/` | 缺陷修复，如 `fix/focus-timer-drift` |
| `docs/` | 文档与交付材料 |
| `chore/` | 构建、依赖、脚本 |

流程：

```powershell
git switch main
git pull
git switch -c feat/your-topic
# 改代码 + 本地自检
git add <具体文件>
git commit -m "feat: 一句话说明为什么改"
git push -u origin feat/your-topic
gh pr create --base main --fill
```

PR 要求：CI 全绿（lint / test / typecheck）、至少 1 人 review 通过、描述里写清验证方式。小步提交，单个 PR 尽量只做一件事，方便回滚和评审。

## 提交信息

沿用仓库现有风格，Conventional Commits 前缀 + 中文描述，写「为什么」而不是「改了哪些文件」：

```
feat: 计划生成时自动插入桥接复习专题
fix: 修复专注计时切页后漂移 2 秒
docs: 回写 P5 检索评测结论
```

## 代码约定

- 中文注释、英文标识符；Vue 3 组合式 API + Element Plus 现有风格优先，不擅自改主题与布局。
- 外科手术式改动：只改必须改的，不顺手重构无关代码；发现无关死代码只提不删。
- 完成标准必须可验证：改完跑 `npm test` / `npm run lint` / `npm run typecheck`，涉及页面的要实际走查。
- 报告的截图、日志、构建产物放仓库外；仓库里不留临时文件。

## 密钥与数据

- `.env` 只放在本地，字段 `DEEPSEEK_API_KEY`；`.gitignore` 已屏蔽，任何时候不要 `git add -f`。
- `server/data/` 下的账号数据与密钥不入库，题库除外。
- 本地学习数据存在浏览器 IndexedDB，不落服务端；改动数据结构要考虑旧数据兼容与导出备份。

## 本地质量门禁（与 CI 一致）

```powershell
npm run lint       # 0 error 才算过（现有 warning 不阻塞）
npm test           # node --test
npm run typecheck  # 覆盖 // @ts-check 标注的核心模块
```

## 新手日常流程（照抄命令即可）

### 每天开工

```powershell
git switch main
git pull --rebase
npm install          # 只有 package.json 变了才需要
```

### 做一个改动

```powershell
git switch -c feat/my-topic          # 分支名英文小写，用连字符
# ...改代码...
npm test; npm run lint; npm run typecheck
git status                           # 先看清改了哪些文件
git add src/views/PracticeView.vue   # 按文件加，不要 git add .
git commit -m "feat: 说明为什么改"
git push -u origin feat/my-topic
gh pr create --base main --fill
```

### 走完一个 PR

1. 对方 review 并点 Approve —— **不能自己批自己的 PR**
2. CI 的 `check` 必须是绿的
3. 点 Squash and merge，勾上删除分支
4. 回本地 `git switch main` 后 `git pull --rebase`

## 五个高频卡点

| 现象 | 原因 | 处理 |
| --- | --- | --- |
| `GH006 Protected branch update failed` | 直接在 main 上提交了 | 建分支重推，main 不接受直推 |
| `This branch is out-of-date` | main 有了新提交，保护规则要求先同步 | 本地 `git pull --rebase origin main` 后重推 |
| PR 显示 `CONFLICTING` | 两人改了同一段代码 | 见下方「解冲突」 |
| CI 红灯 | lint / test / typecheck 没过 | 看 Actions 日志，本地复现后再推 |
| 之前的 Approve 不见了 | 分支推了新提交，旧批准自动作废 | 让对方重新 review 一次 |

### 解冲突

```powershell
git switch feat/my-topic
git pull --rebase origin main
# 打开冲突文件，会看到 <<<<<<<  =======  >>>>>>>
# 只保留最终想要的内容，三行标记全部删掉
git add 冲突文件
git rebase --continue
git push --force-with-lease
```

本地解完先跑一遍 `npm test`，别把半成品推上去让别人替你发现。

## 两人分工规则

- **按文件划分，不按功能划分**。同一文件两人同一天改，必冲突。
- 动 `PracticeView.vue`、`QuizView.vue` 这类大页面前，先在群里说一声。
- 单个 PR 只做一件事，超过 300 行就该拆。
- 不确定能不能改的，先开 Issue 讨论，别先写代码。
