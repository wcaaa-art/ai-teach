// 摸底题目生成：请求参数、预生成调度与正式拉题集中在这里，页面只负责作答与展示。
import { onBeforeUnmount, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { generateDiagnosticQuestions, prefetchDiagnosticQuestions } from '../services/api.js'

export function useDiagnosticQuestions({ page, profile, chapters, selectedChapterIds, questionCount, matchingAssessments, assessmentAttemptCount }) {
  const assessmentLoading = ref(false)
  const prefetchState = ref('')
  let prefetchTimer = null
  let prefetchToken = 0

  // 预生成和正式开始共用同一份请求参数，服务端才能命中同一份题库缓存。
  function buildPayload() {
    const selected = chapters.value.filter(chapter => chapter.selected)
    const selectedIds = new Set(selected.map(chapter => chapter.id))
    const previousQuestions = matchingAssessments.value.flatMap(item => (item.questions || []).filter(question => selectedIds.has(question.chapterId)))
    return {
      grade: profile.grade, subject: profile.subject, edition: profile.edition,
      chapters: selected, questionCount: questionCount.value, attempt: assessmentAttemptCount.value + 1,
      excludeQuestions: previousQuestions.map(question => ({ id: question.id, stem: question.stem, chapterId: question.chapterId, dimension: question.dimension }))
    }
  }

  // 选择范围变化后延迟预生成，避免连续勾选章节时反复请求。
  function schedulePrefetch() {
    clearTimeout(prefetchTimer)
    const token = ++prefetchToken
    prefetchState.value = ''
    if (page.value !== 'select' || !profile.grade || !profile.subject || !selectedChapterIds.value.length) return
    prefetchTimer = setTimeout(async () => {
      prefetchState.value = 'preparing'
      const response = await prefetchDiagnosticQuestions(buildPayload())
      if (token !== prefetchToken) return
      prefetchState.value = response.success && response.data?.ready ? 'ready' : ''
    }, 900)
  }

  watch(
    () => [page.value, profile.grade, profile.subject, profile.edition, questionCount.value, assessmentAttemptCount.value, selectedChapterIds.value.join(',')],
    schedulePrefetch,
    { immediate: true }
  )

  // 正式拉题：成功返回题目与来源；失败给出提示并返回 null，由页面决定是否留在弹窗。
  async function fetchQuestions() {
    if (!profile.grade || !profile.subject) { ElMessage.info('请先选择当前年级和主要科目'); return null }
    if (!selectedChapterIds.value.length) { ElMessage.info('请至少选择一个学习专题'); return null }
    assessmentLoading.value = true
    try {
      // 选范围时可能已经预生成好，这里按同一参数请求即可直接命中缓存。
      const response = await generateDiagnosticQuestions(buildPayload())
      if (!response.success) { ElMessage.warning('摸底题暂时无法生成，仍可选择从零基础规划'); return null }
      const questions = response.data?.questions || []
      if (!questions.length) { ElMessage.warning('暂时没有生成摸底题，请稍后重试或从零基础规划'); return null }
      return { questions, source: response.source || 'agent' }
    } catch (error) {
      // 网络或超时异常时必须解除 loading，否则「开始摸底」按钮会永久禁用。
      console.warn('摸底题生成请求失败。', error)
      ElMessage.warning('摸底题暂时无法生成，仍可选择从零基础规划')
      return null
    } finally {
      assessmentLoading.value = false
    }
  }

  onBeforeUnmount(() => { clearTimeout(prefetchTimer); prefetchToken += 1 })

  return { assessmentLoading, prefetchState, fetchQuestions }
}
