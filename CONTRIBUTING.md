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
