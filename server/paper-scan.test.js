import assert from 'node:assert/strict'
import test from 'node:test'
import { fallbackPaperQuestions, normalizePaperQuestions } from './paper-scan.js'

test('试卷解析：选项去前缀，字母答案映射成 0 基下标', () => {
  const { questions } = normalizePaperQuestions([{
    type: 'single',
    stem: '1. 下列各数中，最小的数是（ ）',
    options: ['A. -3', 'B. 0', 'C. 1', 'D. 2'],
    answer: 'A',
    score: 3
  }], { grade: '初二', subject: '数学' })
  assert.equal(questions.length, 1)
  const question = questions[0]
  assert.equal(question.type, 'single')
  assert.equal(question.stem, '下列各数中，最小的数是（ ）')
  assert.deepEqual(question.options, ['-3', '0', '1', '2'])
  assert.equal(question.correctIndex, 0)
  assert.equal(question.chapterId, 'scan')
  assert.equal(question.answerMissing, false)
})

test('试卷解析：单选缺答案转自评题，选项保留在题干里', () => {
  const { questions } = normalizePaperQuestions([{
    type: 'single',
    stem: '关于力的说法正确的是',
    options: ['力是物体对物体的作用', '力可以脱离物体存在'],
    score: 3
  }], { grade: '初二', subject: '物理' })
  const question = questions[0]
  assert.equal(question.type, 'short')
  assert.equal(question.options.length, 0)
  assert.match(question.stem, /A\. 力是物体对物体的作用/)
  assert.equal(question.answerMissing, true)
  // 模型给了分值就沿用，不会被题型转换清空。
  assert.equal(question.score, 3)
})

test('试卷解析：填空无答案转自评题，重复题干只保留一道', () => {
  const raw = [
    { type: 'fill', stem: '若 x² = 9，则 x = ____。', answer: '±3', score: 3 },
    { type: 'fill', stem: '若 x² = 9，则 x = ____。', answer: '±3', score: 3 },
    { type: 'fill', stem: '水的密度是 ____ kg/m³。', answer: '', score: 3 }
  ]
  const { questions } = normalizePaperQuestions(raw, { grade: '初二', subject: '物理' })
  assert.equal(questions.length, 2)
  assert.equal(questions[0].type, 'fill')
  assert.equal(questions[0].answer, '±3')
  assert.equal(questions[1].type, 'short')
  assert.equal(questions[1].answerMissing, true)
})

test('试卷兜底：按题号切块并识别答案，模型不可用也能拆题', () => {
  const text = `1. 下列各数中，最小的数是（ ）
A. -3  B. 0  C. 1  D. 2
答案：A
2. 若 x² = 9，则 x = ______。
答案：±3
3. 计算：(2a + b)(2a - b)
答案：4a² - b²`
  const { title, questions } = fallbackPaperQuestions(text, { grade: '初二', subject: '数学' })
  assert.match(title, /本地拆分/)
  assert.equal(questions.length, 3)
  assert.equal(questions[0].type, 'single')
  assert.equal(questions[0].correctIndex, 0)
  assert.equal(questions[1].type, 'fill')
  assert.equal(questions[1].answer, '±3')
  assert.equal(questions[2].type, 'short')
  assert.equal(questions[2].answer, '4a² - b²')
})
