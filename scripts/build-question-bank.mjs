// 题库构建脚本：把 scripts/bank/*.mjs 里的确定性生成器合并进 server/data/question-bank。
// 规则：保留已有题目 → 追加生成题 → 按题干去重 → 每章补齐到 40 题 → 校验后写回同一路径。
// 全部答案来自生成器里的算式与事实表，不调用任何模型。
import { readFile, readdir, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { listCurriculumChapters } from '../server/curriculum.js'
import { isValidBankQuestion } from '../server/question-bank.js'
import { stemKey } from './bank/helpers.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const BANK_DIR = path.resolve(HERE, '../server/data/question-bank')
const TARGET_PER_CHAPTER = 40

async function loadGroups() {
  const files = (await readdir(path.join(HERE, 'bank'))).filter(name => name.endsWith('.mjs') && name !== 'helpers.mjs')
  const groups = []
  for (const name of files) {
    const module = await import(pathToFileURL(path.join(HERE, 'bank', name)).href)
    if (module.bankGroup) groups.push({ file: name, ...module.bankGroup })
    // 一个文件里可以按年级拆成多个组（英语 18 章分属三个年级）。
    if (Array.isArray(module.bankGroups)) {
      module.bankGroups.forEach(group => groups.push({ file: name, ...group }))
    }
  }
  return groups
}

async function readBankFile(file) {
  if (!existsSync(file)) return null
  try {
    return JSON.parse(await readFile(file, 'utf8'))
  } catch {
    return null
  }
}

function normalizeExisting(question, chapter) {
  return {
    ...question,
    chapterId: question.chapterId || chapter.id,
    chapterName: question.chapterName || chapter.name,
    type: question.type || 'single'
  }
}

// 生成题的解析由 makeQuestion 写成「正确答案：X。」，这里反查选项，确保 correctIndex 指向的正是 X。
function assertGeneratedQuestion(question) {
  if (!isValidBankQuestion(question)) return false
  const match = /^正确答案：(.+?)。/.exec(String(question.explanation || ''))
  if (!match) return false
  return question.options[Number(question.correctIndex)] === match[1]
}

async function buildChapter({ group, chapter, generator }) {
  const file = path.join(BANK_DIR, group.grade, group.subject, group.edition, `${chapter.id}.json`)
  const existing = await readBankFile(file)
  const questions = []
  const seen = new Set()
  for (const question of existing?.questions || []) {
    const normalized = normalizeExisting(question, chapter)
    const key = stemKey(normalized.stem)
    if (!key || seen.has(key) || !isValidBankQuestion(normalized)) continue
    seen.add(key)
    questions.push(normalized)
  }
  const before = questions.length
  const drafts = generator()
  // 不论章节是否已满，生成器产出的每道题都要过结构与答案一致性校验。
  for (const draft of drafts) {
    if (!assertGeneratedQuestion(draft)) {
      throw new Error(`${group.grade}${group.subject}「${chapter.name}」生成题校验失败：${draft.stem}`)
    }
  }
  let nextId = 1
  let added = 0
  for (const draft of drafts) {
    if (questions.length >= TARGET_PER_CHAPTER) break
    const key = stemKey(draft.stem)
    if (!key || seen.has(key)) continue
    const question = {
      id: `g${String(nextId).padStart(2, '0')}`,
      chapterId: chapter.id,
      chapterName: chapter.name,
      ...draft
    }
    nextId += 1
    if (!isValidBankQuestion(question)) {
      throw new Error(`${group.grade}${group.subject}「${chapter.name}」生成题校验失败：${question.stem}`)
    }
    seen.add(key)
    questions.push(question)
    added += 1
  }
  const record = {
    grade: group.grade,
    subject: group.subject,
    edition: group.edition,
    chapter: { id: chapter.id, name: chapter.name },
    generatedAt: new Date().toISOString(),
    source: added ? 'local-generator' : (existing?.source || 'local-generator'),
    count: questions.length,
    questions
  }
  await mkdir(path.dirname(file), { recursive: true })
  await writeFile(file, `${JSON.stringify(record, null, 2)}\n`, 'utf8')
  return { chapter: chapter.name, before, after: questions.length, added, target: TARGET_PER_CHAPTER }
}

async function main() {
  const groups = await loadGroups()
  let totalAdded = 0
  const shortfalls = []
  const missing = []
  for (const group of groups) {
    const { chapters } = listCurriculumChapters(group.grade, group.subject, group.edition)
    console.log(`\n== ${group.grade} ${group.subject} ${group.edition}（${group.file}）==`)
    for (const chapter of chapters) {
      const generator = group.generators[chapter.name]
      // 还没有生成器的章节只提示，不算失败：题库要分批扩，已完成的章节不能被未开工的拖住。
      if (!generator) {
        missing.push(`${group.grade}-${group.subject}-${chapter.name}`)
        continue
      }
      const result = await buildChapter({ group, chapter, generator })
      totalAdded += result.added
      const mark = result.after >= result.target ? '✓' : '!'
      console.log(`${mark} ${result.chapter}: ${result.before} → ${result.after}（新增 ${result.added}）`)
      if (result.after < result.target) shortfalls.push(`${group.grade}-${group.subject}-${result.chapter}：仅 ${result.after}/${result.target}`)
    }
  }
  console.log(`\n本次新增 ${totalAdded} 题`)
  if (missing.length) {
    console.log(`\n暂无生成器（${missing.length} 章，已保留现有题量）：`)
    missing.forEach(item => console.log(`- ${item}`))
  }
  if (shortfalls.length) {
    console.log('\n未达标章节：')
    shortfalls.forEach(item => console.log(`- ${item}`))
    process.exitCode = 1
  }
}

main().catch(error => {
  console.error(error)
  process.exit(1)
})
