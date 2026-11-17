// 离线生成章节测试题库（填空/解答题），落盘到 server/data/quiz-bank/：
//   node scripts/build-quiz-bank.js --grades 初二 --subjects 数学 --count 15
// 单选题由 server/data/question-bank 提供，这里直连模型补主观题，不经过网页或本地 API。
// 生成题库的本机需要在 .env 配置可用的 DEEPSEEK_API_KEY；生成好的题库随项目分发。
import 'dotenv/config'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { listCurriculumChapters, listCurriculumSubjects } from '../server/curriculum.js'
import { generateQuizSubjectivesDirect } from '../server/quiz.js'

const ROOT = fileURLToPath(new URL('..', import.meta.url))
const BANK_DIR = join(ROOT, 'server', 'data', 'quiz-bank')

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
const chapterFilter = list(option('chapters', ''))
const questionCount = Math.max(10, Math.min(15, Number(option('count', 15)) || 15))
const concurrency = Math.max(1, Math.min(4, Number(option('concurrency', 2)) || 2))
const force = flag('force')
const dryRun = flag('dry-run')

function safeName(value) {
  return String(value || '').replace(/[\\/:*?"<>|]/g, '_').trim()
}

function resolveEditions(editions) {
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
        : resolveEditions(info.editions[subject] || [])
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
    const questions = Array.isArray(record.questions) ? record.questions : []
    const fills = questions.filter(question => question.type === 'fill').length
    const shorts = questions.filter(question => question.type === 'short').length
    // 填空、解答各少于 2 道视为不完整，下次重跑自动补齐，避免半成品被当成已完成跳过。
    return fills >= 2 && shorts >= 2 ? record : null
  } catch {
    return null
  }
}

// 直连模型只收主观题，本地模板题和题库复用题都不会出现在这里。
function usableQuestions(questions = []) {
  return questions.filter(question => {
    const type = String(question?.type || '')
    if (type !== 'fill' && type !== 'short') return false
    const answer = type === 'fill' ? question.answer : question.referenceAnswer
    return Boolean(
      String(question.stem || '').trim() &&
      String(question.explanation || '').trim() &&
      String(answer || '').trim()
    )
  })
}

const stemKey = stem => String(stem || '').replace(/\s+/g, '').trim()

function appendUnique(target, questions) {
  let added = 0
  for (const question of questions) {
    const key = stemKey(question.stem)
    if (!key || target.some(item => stemKey(item.stem) === key)) continue
    target.push({
      id: String(question.id || ''),
      type: question.type,
      dimension: String(question.dimension || 'concept'),
      stem: String(question.stem || '').trim(),
      answer: String(question.answer || '').trim(),
      acceptableAnswers: Array.isArray(question.acceptableAnswers) ? question.acceptableAnswers.map(String) : [],
      referenceAnswer: String(question.referenceAnswer || '').trim(),
      explanation: String(question.explanation || '').trim(),
      difficulty: Math.max(1, Math.min(3, Number(question.difficulty) || 1)),
      score: Math.max(1, Math.min(20, Number(question.score) || (question.type === 'fill' ? 3 : 10)))
    })
    added += 1
  }
  return added
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

async function requestChapter(target, attempt) {
  return generateQuizSubjectivesDirect({
    grade: target.grade, subject: target.subject, edition: target.edition,
    chapter: target.chapter, count: questionCount, attempt
  })
}

async function buildOne(target, position, total) {
  const existing = readExisting(target)
  if (existing && !force) {
    console.log(`[${position}/${total}] 跳过 ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name}（已存在 ${existing.questions.length} 题）`)
    return { skipped: true }
  }
  const startedAt = Date.now()
  const collected = []
  let lastError = ''
  for (let round = 1; round <= 3; round += 1) {
    try {
      const questions = usableQuestions(await requestChapter(target, round))
      appendUnique(collected, questions)
      // 填空、解答各凑到 2 道就能覆盖日常测试，整卷按章节轮转也不会断档。
      const fills = collected.filter(question => question.type === 'fill').length
      const shorts = collected.filter(question => question.type === 'short').length
      if (fills >= 2 && shorts >= 2) break
    } catch (error) {
      lastError = error.message
      if (round === 3) {
        console.error(`[${position}/${total}] 失败 ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name}: ${error.message}`)
        return { failed: true, target }
      }
    }
  }
  if (collected.length < 2) {
    // 把最后一次真实错误带出来，避免只在日志里看到「0 道」却不知道是限流、欠费还是解析失败。
    console.error(`[${position}/${total}] 失败 ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name}: 可用主观题仅 ${collected.length} 道${lastError ? `（最后一次错误：${lastError}）` : ''}`)
    return { failed: true, target }
  }
  writeRecord(target, 'deepseek', collected)
  console.log(`[${position}/${total}] 完成 ${target.grade}/${target.subject}/${target.edition}/${target.chapter.name} → 填空 ${collected.filter(item => item.type === 'fill').length} / 解答 ${collected.filter(item => item.type === 'short').length}（${Math.round((Date.now() - startedAt) / 1000)}s）`)
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
console.log(`主观题库目标：${targets.length} 个章节 → ${BANK_DIR}`)
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
