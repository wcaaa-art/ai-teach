// 离线批量生成章节题库，落盘到 server/data/question-bank/：
//   node scripts/build-question-bank.js --grades 初二 --subjects 数学 --count 10
// 直连模型生成，不经过网页或本地 API；题库文件随项目分发，其他电脑无需模型 key 也能直接抽题。
// 生成题库的本机需要在 .env 配置可用的 DEEPSEEK_API_KEY。
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listCurriculumChapters, listCurriculumSubjects } from '../server/curriculum.js'
import { generateDiagnosticQuestionsDirect } from '../server/direct-generation.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BANK_DIR = join(ROOT, 'server', 'data', 'question-bank')

const args = process.argv.slice(2)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}
const flag = name => args.includes(`--${name}`)
const list = value => String(value || '').split(',').map(item => item.trim()).filter(Boolean)

const grades = list(option('grades', '初一,初二,初三'))
const subjectFilter = list(option('subjects', ''))
const editionFilter = list(option('editions', ''))
// 按章节 id 或名称片段重跑单章，失败清单可以直接复制过来用。
const chapterFilter = list(option('chapters', ''))
const questionCount = Math.max(5, Math.min(20, Number(option('count', 10)) || 10))
const concurrency = Math.max(1, Math.min(4, Number(option('concurrency', 2)) || 2))
const force = flag('force')
const dryRun = flag('dry-run')

function safeName(value) {
  return String(value || '').replace(/[\\/:*?"<>|]/g, '_').trim()
}

// 默认只生成每科第一个（默认）教材版本；加 --editions 或 --all-editions 才扩到多版本。
function resolveEditions(subject, editions) {
  if (editionFilter.length) return editions.filter(item => editionFilter.includes(item.edition))
  return editions.slice(0, 1)
}

function buildTargets() {
  const targets = []
  for (const grade of grades) {
    const info = listCurriculumSubjects(grade)
    for (const subject of info.subjects) {
      if (subjectFilter.length && !subjectFilter.includes(subject)) continue
      const editions = editionFilter.length || flag('all-editions')
        ? info.editions[subject] || []
        : resolveEditions(subject, info.editions[subject] || [])
      for (const edition of editions) {
        const chapters = listCurriculumChapters(grade, subject, edition.edition).chapters
          .filter(chapter => !chapterFilter.length || chapterFilter.some(key => chapter.id === key || chapter.name.includes(key)))
        for (const chapter of chapters) {
          targets.push({
            grade, subject, edition: edition.edition, chapter,
            file: join(BANK_DIR, safeName(grade), safeName(subject), safeName(edition.edition), `${safeName(chapter.id)}.json`)
          })
        }
      }
    }
  }
  return targets
}

function readExisting(target) {
  if (!existsSync(target.file)) return null
  try {
    const record = JSON.parse(readFileSync(target.file, 'utf8'))
    return Array.isArray(record.questions) && record.questions.length ? record : null
  } catch {
    return null
  }
}

function writeRecord(target, source, questions) {
  mkdirSync(dirname(target.file), { recursive: true })
  const record = {
    grade: target.grade, subject: target.subject, edition: target.edition,
    chapter: { id: target.chapter.id, name: target.chapter.name },
    generatedAt: new Date().toISOString(), source, count: questions.length, questions
  }
  const temp = `${target.file}.tmp`
  writeFileSync(temp, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  renameSync(temp, target.file)
}

// 比对题干前先把 LaTeX 写法折成 Unicode 符号，否则 \triangle 与 △ 会被当成两道不同的题。
const LATEX_SYMBOLS = {
  '\\triangle': '△', '\\angle': '∠', '\\cong': '≌', '\\sqrt': '√', '\\cdot': '·',
  '\\times': '×', '\\div': '÷', '\\pm': '±', '\\degree': '°', '\\circ': '°'
}
const stemKey = stem => String(stem || '')
  .replace(/\\triangle|\\angle|\\cong|\\sqrt|\\cdot|\\times|\\div|\\pm|\\degree|\\circ/g, symbol => LATEX_SYMBOLS[symbol])
  .replace(/\\[a-zA-Z]+/g, '')
  .replace(/[\s，,。.；;：:、？！!?（）()【】\[\]“”"'‘’{}]/g, '')

// 同章节并发出题时模型容易给出近似题，用字符二元组相似度做一次近似去重。
function bigramSimilarity(left, right) {
  if (left === right) return 1
  const grams = text => {
    const set = new Set()
    for (let index = 0; index + 1 < text.length; index += 1) set.add(text.slice(index, index + 2))
    return set
  }
  const a = grams(left)
  const b = grams(right)
  if (!a.size || !b.size) return 0
  let shared = 0
  for (const gram of a) if (b.has(gram)) shared += 1
  return shared / (a.size + b.size - shared)
}

function appendUnique(target, questions) {
  let added = 0
  for (const question of questions) {
    const key = stemKey(question.stem)
    if (!key) continue
    if (target.some(item => bigramSimilarity(stemKey(item.stem), key) >= 0.8)) continue
    target.push(question)
    added += 1
  }
  return added
}

async function requestChapter(target, { count, attempt, excludeStems }) {
  const generated = await generateDiagnosticQuestionsDirect({
    grade: target.grade, subject: target.subject, edition: target.edition,
    chapter: target.chapter, count, attempt, excludeStems
  })
  const questions = generated.filter(question => {
    const explanation = String(question?.explanation || '').trim()
    return String(question?.stem || '').trim() &&
      Array.isArray(question.options) && question.options.length >= 2 &&
      Number.isInteger(question.correctIndex) &&
      question.correctIndex >= 0 && question.correctIndex < question.options.length &&
      // 解析必须逐项说明，一句话解析和本地模板题不进题库。
      explanation.length >= 30 && /[A-D][.、:：]/.test(explanation)
  })
  if (!questions.length) throw new Error('no-usable-question')
  return { questions, source: 'deepseek' }
}

async function buildOne(target, position, total) {
  const existing = readExisting(target)
  if (existing && !force) {
    console.log(`[${position}/${total}] 跳过 ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name}（已存在 ${existing.questions.length} 题）`)
    return { skipped: true }
  }
  const startedAt = Date.now()
  const collected = []
  // 强制重建时把旧题也列为排除项，避免拿换汤不换药的题覆盖原文件。
  const excludeStems = (existing?.questions || []).map(question => question.stem)
  let source = 'deepseek'
  for (let round = 1; round <= 3; round += 1) {
    const remaining = questionCount - collected.length
    if (remaining <= 0) break
    try {
      // 第二轮把第一轮的题干带回去，让模型换情境、换数字，补足去重后缺的题量。
      const result = await requestChapter(target, {
        count: remaining, attempt: round,
        excludeStems: [...excludeStems, ...collected.map(question => question.stem)]
      })
      // 整轮都是本地模板题时不算有效产出，留给下一轮重试。
      if (result.source === 'local-fallback') throw new Error('model-fallback')
      source = result.source
      appendUnique(collected, result.questions)
    } catch (error) {
      if (round === 3) {
        console.error(`[${position}/${total}] 失败 ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name}: ${error.message}`)
        return { failed: true, target }
      }
    }
  }
  // 兜底模板题不算题库质量，有效题不足 3 道就留给下次重跑。
  if (collected.length < 3) {
    console.error(`[${position}/${total}] 失败 ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name}: 可用题仅 ${collected.length} 道`)
    return { failed: true, target }
  }
  writeRecord(target, source, collected)
  console.log(`[${position}/${total}] 完成 ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name} → ${collected.length} 题（${source}，${Math.round((Date.now() - startedAt) / 1000)}s）`)
  return { generated: true }
}

async function runPool(items, limit, worker) {
  let cursor = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) return
      await worker(items[index], index)
    }
  })
  await Promise.all(runners)
}

const targets = buildTargets()
console.log(`题库目标：${targets.length} 个章节 → ${BANK_DIR}`)
if (dryRun) {
  targets.slice(0, 20).forEach(target => console.log(`- ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name}`))
  if (targets.length > 20) console.log(`... 其余 ${targets.length - 20} 个章节省略`)
  process.exit(0)
}
if (!targets.length) {
  console.error('没有匹配到任何章节，请检查 --grades / --subjects / --editions。')
  process.exit(1)
}

const summary = { generated: 0, skipped: 0, failed: 0 }
const failures = []
await runPool(targets, concurrency, async (target, index) => {
  const result = await buildOne(target, index + 1, targets.length)
  if (result.generated) summary.generated += 1
  else if (result.skipped) summary.skipped += 1
  else {
    summary.failed += 1
    failures.push(`${target.grade}/${target.subject}/${target.edition}/${target.chapter.name}`)
  }
})

console.log(`\n完成：新生成 ${summary.generated}，跳过 ${summary.skipped}，失败 ${summary.failed}`)
if (failures.length) {
  console.log('失败章节：')
  failures.forEach(name => console.log(`- ${name}`))
  process.exit(1)
}
