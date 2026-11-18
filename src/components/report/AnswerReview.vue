<script setup>
import QuestionOptions from '../QuestionOptions.vue'
import { formatMathText } from '../../utils/formatMath.js'
import { stripBookPrefix } from '../../utils/chapterNames.js'

// 本次作答与解析：保留选项级红绿标记与逐项解析，信息量比「正确答案是 B」更大。
defineProps({ items: { type: Array, default: () => [] } })
const emit = defineEmits(['practice'])

// 解析按行拆开：以选项字母开头的行标注正确/错误，和章节测试保持一致。
function reviewExplanationRows(question) {
  const text = String(question.explanation || '').trim() || '这道题暂未提供解析'
  return text.split(/\n+/).map(line => line.trim()).filter(Boolean).map(line => {
    const match = line.match(/^([A-H])[.、:：)]\s*(.*)$/)
    if (!match) return { label: '', text: line, verdict: '' }
    const index = 'ABCDEFGH'.indexOf(match[1])
    return { label: match[1], text: match[2], verdict: index === Number(question.correctIndex) ? 'right' : 'wrong' }
  })
}
// 选择题把选项铺开，和错题库、测验回顾一致；自评题的选项是掌握程度，仍按文字回显。
function hasReviewOptions(question) {
  return !question.selfAssessment && Array.isArray(question.options) && question.options.length > 0
}
function reviewCorrect(question) {
  const index = Number(question.correctIndex)
  return Number.isInteger(index) && index >= 0 ? [index] : []
}
function reviewChosen(question) {
  const index = Number(question.chosenIndex)
  return question.chosenIndex === null || question.chosenIndex === undefined || !Number.isInteger(index) || index < 0 ? [] : [index]
}
</script>

<template>
  <div class="answer-review">
    <article
      v-for="(question, index) in items"
      :key="`review-${question.id}`"
      class="review-card"
      :class="question.isCorrect === true ? 'correct' : question.isCorrect === false ? 'wrong' : 'self-check'"
    >
      <div class="question-meta">
        <el-tag effect="plain">第 {{ index + 1 }} 题 · {{ stripBookPrefix(question.chapterName) }}</el-tag>
        <el-tag v-if="question.isCorrect === true" type="success">回答正确</el-tag>
        <el-tag v-else-if="question.isCorrect === false" type="danger">回答错误</el-tag>
        <el-tag v-else type="info">自评题 / 未作答</el-tag>
      </div>
      <h4 v-html="formatMathText(question.stem)"></h4>
      <QuestionOptions v-if="hasReviewOptions(question)" :options="question.options" :correct="reviewCorrect(question)" :chosen="reviewChosen(question)" flags />
      <template v-else>
        <p class="review-line"><strong>你的选择：</strong><span v-if="question.chosenIndex === null">未作答</span><span v-else-if="Array.isArray(question.options)" v-html="formatMathText(question.options[question.chosenIndex])"></span><span v-else>{{ question.userAnswer || '—' }}</span></p>
        <p v-if="!question.selfAssessment" class="review-line"><strong>正确答案：</strong><span v-if="Array.isArray(question.options)" v-html="formatMathText(question.options[question.correctIndex])"></span><span v-else>{{ question.answer || (question.acceptableAnswers || [])[0] || '见解析' }}</span></p>
      </template>
      <p class="review-explanation"><strong>解析：</strong></p>
      <ul class="explanation-list">
        <li v-for="(row, rowIndex) in reviewExplanationRows(question)" :key="`row-${rowIndex}`" :class="row.verdict">
          <span v-if="row.label" class="option-badge">{{ row.label }}</span>
          <span v-html="formatMathText(row.text)"></span>
          <em v-if="row.verdict" class="verdict">{{ row.verdict === 'right' ? '正确项 · 成立依据' : '错误项 · 反例' }}</em>
        </li>
      </ul>
      <button v-if="question.isCorrect === false" type="button" class="review-fix" @click="emit('practice', question.chapterId)">补这个专题 →</button>
    </article>
  </div>
</template>
