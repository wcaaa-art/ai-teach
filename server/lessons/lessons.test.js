// 知识点讲解静态包必须覆盖课程目录里的每一个章节，且内容结构完整；目录外章节退回本地基础讲解。
import test from 'node:test'
import assert from 'node:assert/strict'
import { listCurriculumChapters, listCurriculumSubjects } from '../curriculum.js'
import { getLocalLesson } from './index.js'

test('课程目录里的每个章节都有完整的静态讲解', () => {
  const problems = []
  let total = 0
  for (const grade of listCurriculumSubjects().grades) {
    for (const subject of listCurriculumSubjects(grade).subjects) {
      for (const chapter of listCurriculumChapters(grade, subject).chapters) {
        total += 1
        const lesson = getLocalLesson({ grade, subject, chapterName: chapter.name, unitLabel: chapter.unitLabel })
        const label = `${grade}${subject}·${chapter.name}`
        if (lesson.source !== 'pack') { problems.push(`${label} 缺少静态讲解`); continue }
        if (!lesson.intro || lesson.intro.length < 40) problems.push(`${label} intro 过短`)
        if (!Array.isArray(lesson.points) || lesson.points.length < 4) problems.push(`${label} 要点不足 4 条`)
        if (!Array.isArray(lesson.formulas) || !lesson.formulas.length) problems.push(`${label} 缺少卡片`)
      }
    }
  }
  assert.equal(total, 144)
  assert.deepEqual(problems, [])
})

test('目录外章节退回本地基础讲解，不标注为静态包', () => {
  const lesson = getLocalLesson({ grade: '初二', subject: '数学', chapterName: '目录外单元', unitLabel: '测试' })
  assert.equal(lesson.source, 'local')
  assert.equal(lesson.formulas.length, 0)
  assert.ok(lesson.intro.includes('目录外单元'))
  assert.equal(lesson.points.length, 3)
})

test('同一章节多次取用内容一致，不依赖网络', () => {
  const first = getLocalLesson({ grade: '初三', subject: '数学', chapterName: '一元二次方程' })
  const second = getLocalLesson({ grade: '初三', subject: '数学', chapterName: '一元二次方程' })
  assert.deepEqual(first, second)
  assert.equal(first.formulas.length, 3)
  assert.equal(first.formulas[0].name, '求根公式')
})
