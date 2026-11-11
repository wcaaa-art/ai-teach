<script setup>
import { computed, onMounted, reactive, ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useRouter } from 'vue-router'
import { deletePlan, loadAssessments, loadExamScores, loadPlans, loadProfile, savePlan } from '../db/index.js'
import { clearTaskReminder, scheduleTaskReminder } from '../services/reminders.js'
import { generatePlanSkeleton, replacePlanTask } from '../services/api.js'
import { formatMathText } from '../utils/formatMath.js'
import { STAGES, stageLabel, stageOf, stageStatesOf } from '../utils/stages.js'
import { useAppStore } from '../stores/app.js'

const store = useAppStore()
const router = useRouter()
const plans = ref([])
const filter = ref('all')
const editVisible = ref(false)
const editing = ref(null)

const filteredPlans = computed(() => plans.value.filter(plan => filter.value === 'all' || plan.status === filter.value))
const groupedPlans = computed(() => {
  const groups = new Map()
  for (const plan of filteredPlans.value) {
    if (!groups.has(plan.subject)) groups.set(plan.subject, [])
    groups.get(plan.subject).push(plan)
  }
  return [...groups.entries()].map(([subject, subjectPlans]) => {
    const sorted = subjectPlans.sort((a, b) => (a.sequenceOrder || 999) - (b.sequenceOrder || 999))
    // 轨道上第一个未归档任务就是「当前」，其余排队等待。
    const currentId = (sorted.find(plan => !plan.isBridge && plan.status === 'active') || {}).id || ''
    return { subject, plans: sorted, currentId }
  })
})

// 轨道节点状态：已归档=点亮，第一个进行中=当前脉冲，其余=待开始。
function nodeState(plan, group) {
  if (plan.status === 'archived') return 'done'
  return plan.id === group.currentId ? 'current' : 'todo'
}
const expandedSubjects = reactive(new Set())

function localDateTime(timestamp) {
  if (!timestamp) return ''
  const date = new Date(timestamp)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}T${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`
}

function formatDate(timestamp) {
  return timestamp ? new Date(timestamp).toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' }) : '待安排'
}

function startFocus(plan) {
  store.setPlans(plans.value)
  router.push({ name: 'focus', query: { planId: plan.id } })
}

function openEdit(plan) {
  editing.value = {
    ...plan,
    reviewAt: localDateTime(plan.reviewTime),
    knowledgeTagsText: (plan.knowledgeTags || []).join('，')
  }
  editVisible.value = true
}

async function submitEdit() {
  if (!editing.value?.name?.trim() || !editing.value?.subject) {
    ElMessage.info('请先填写任务名称和科目。')
    return
  }
  const updatedPlan = {
    ...editing.value,
    name: editing.value.name.trim(),
    estimatedMinutes: Number(editing.value.estimatedMinutes),
    reviewTime: editing.value.reviewAt ? new Date(editing.value.reviewAt).getTime() : null,
    knowledgeTags: editing.value.knowledgeTagsText.split(/[、,，]/).map(tag => tag.trim()).filter(Boolean)
  }
  delete updatedPlan.reviewAt
  delete updatedPlan.knowledgeTagsText
  await savePlan(updatedPlan)
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  editVisible.value = false
  ElMessage.success('计划已更新。')
}

async function setReminder(plan) {
  if (!('Notification' in window)) {
    ElMessage.info('当前浏览器不支持通知提醒。')
    return
  }
  try {
    const { value } = await ElMessageBox.prompt('输入提醒时间（本地时间，24 小时制）', '为任务设置提醒', {
      inputValue: localDateTime(Date.now() + 3600000),
      inputPattern: /^\d{4}-\d\d-\d\dT\d\d:\d\d$/,
      inputErrorMessage: '请选择有效的日期和时间。'
    })
    const reminderAt = new Date(value).getTime()
    if (!Number.isFinite(reminderAt) || reminderAt <= Date.now()) {
      ElMessage.info('提醒时间需要晚于现在。')
      return
    }
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      ElMessage.info('浏览器通知权限未开启。')
      return
    }
    const updatedPlan = { ...plan, remindAt: reminderAt }
    await savePlan(updatedPlan)
    plans.value = await loadPlans()
    store.setPlans(plans.value)
    scheduleTaskReminder(updatedPlan)
    ElMessage.success('提醒已保存；请保持浏览器运行以便按时提醒。')
  } catch {
    // 用户取消提醒时间输入时不修改原计划。
  }
}

async function toggleArchive(plan) {
  const updatedPlan = { ...plan, status: plan.status === 'archived' ? 'active' : 'archived' }
  await savePlan(updatedPlan)
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  scheduleTaskReminder(updatedPlan)
}

async function removePlan(plan) {
  try {
    await ElMessageBox.confirm('删除后无法从本机恢复，确定继续吗？', '删除计划', { type: 'warning' })
    clearTaskReminder(plan.id)
    await deletePlan(plan.id)
    plans.value = await loadPlans()
    store.setPlans(plans.value)
    ElMessage.success('计划已删除。')
  } catch {
    // 用户取消确认时保留计划与提醒。
  }
}

async function clearSubject(group) {
  try {
    await ElMessageBox.confirm(
      `将删除「${group.subject}」的 ${group.plans.length} 条学习任务（含已锁定任务），已完成的测试成绩和专注记录会保留。此操作无法撤销。`,
      '清空该科目计划',
      { type: 'warning', confirmButtonText: '清空', cancelButtonText: '取消' }
    )
  } catch {
    // 用户取消时不改动任何计划。
    return
  }
  for (const plan of group.plans) {
    clearTaskReminder(plan.id)
    await deletePlan(plan.id)
  }
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  expandedSubjects.delete(group.subject)
  ElMessage.success(`已清空「${group.subject}」的学习计划。`)
}

const dragState = reactive({ id: '', subject: '' })
const replacing = ref('')

function onDragStart(group, plan, event) {
  dragState.id = plan.id
  dragState.subject = group.subject
  if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move'
}

function onDragOver(group, plan, event) {
  if (!dragState.id || dragState.subject !== group.subject || dragState.id === plan.id) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

async function onDrop(group, targetPlan) {
  const sourceId = dragState.id
  const sameSubject = dragState.subject === group.subject
  dragState.id = ''
  if (!sourceId || !sameSubject || sourceId === targetPlan.id) return
  const list = [...group.plans]
  const from = list.findIndex(item => item.id === sourceId)
  const to = list.findIndex(item => item.id === targetPlan.id)
  if (from < 0 || to < 0) return
  list.splice(to, 0, list.splice(from, 1)[0])
  // 同科目内重排后写回 sequenceOrder，重新诊断时沿用用户确认的顺序。
  for (const [index, plan] of list.entries()) await savePlan({ ...plan, sequenceOrder: index + 1 })
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  ElMessage.success(`「${group.subject}」顺序已更新。`)
}

async function toggleLock(plan) {
  const next = { ...plan, locked: !plan.locked }
  await savePlan(next)
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  ElMessage.success(next.locked ? '已锁定，重新诊断时保留这个任务。' : '已解锁，下次重新诊断可被新计划替换。')
}

// 点击立即生效的本地变体，AI 文案回来后再覆盖，避免为了换个任务名等半分钟。
const LOCAL_VARIANTS = ['变式练习', '错题重做', '知识梳理']
function localVariant(plan) {
  const tag = String(plan.knowledgeTags?.[0] || plan.name || '知识点').slice(0, 12)
  const pool = LOCAL_VARIANTS.filter(item => !String(plan.name || '').includes(item))
  const variant = (pool.length ? pool : LOCAL_VARIANTS)[0]
  return { ...plan, name: `${tag} · ${variant}`, reason: '换个任务形式，保持练习的新鲜感。', aiPending: true }
}

async function replaceTask(plan) {
  if (replacing.value) return
  replacing.value = plan.id
  // 先落本地变体，点击即生效。
  await savePlan(localVariant(plan))
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  try {
    const response = await replacePlanTask({ plan, profile: store.profile })
    if (response.success && response.data?.plan?.name) {
      await savePlan({ ...response.data.plan, id: plan.id, sequenceOrder: plan.sequenceOrder, locked: plan.locked, aiPending: false })
      plans.value = await loadPlans()
      store.setPlans(plans.value)
      ElMessage.success('已换成新的任务形式，知识点保持不变。')
    }
  } finally {
    replacing.value = ''
  }
}

onMounted(async () => {
  plans.value = await loadPlans()
  store.setPlans(plans.value)
  if ('Notification' in window && Notification.permission === 'granted') {
    plans.value.forEach(scheduleTaskReminder)
  }
})

function toggleSubject(subject) {
  if (expandedSubjects.has(subject)) expandedSubjects.delete(subject)
  else expandedSubjects.add(subject)
}

// 灰点既可能是“没走到”也可能是“有任务没做完”，逐个点补一句提示，避免学生和评委误读。
function stageDotHint(state, index, plans = []) {
  const label = STAGES[index]?.label || ''
  if (state === 'done') return `${label}：已完成`
  if (state === 'current') return `${label}：进行中`
  const hasTasks = plans.some(plan => !plan.isBridge && stageOf(plan) === STAGES[index]?.key)
  return hasTasks ? `${label}：待完成` : `${label}：未安排`
}

// 按最新成绩重算时长：只改写未归档任务，已归档、锁定与用户改过的内容全部保留。
const rebalancing = ref(false)
async function rebalanceByScore() {
  if (rebalancing.value) return
  rebalancing.value = true
  try {
    const [exams, assessments, profile] = await Promise.all([loadExamScores(), loadAssessments(), loadProfile()])
    const groups = new Map()
    for (const plan of plans.value) {
      if (plan.isBridge || !plan.chapterId) continue
      const key = `${plan.grade || ''}|${plan.subject}|${plan.edition || ''}`
      if (!groups.has(key)) groups.set(key, [])
      groups.get(key).push(plan)
    }
    let updated = 0
    let skipped = 0
    for (const groupPlans of groups.values()) {
      const first = groupPlans[0]
      const chapterIds = new Set(groupPlans.map(plan => plan.chapterId))
      // 老数据没有 grade 字段：从同一批章节的摸底记录反推，再退回当前档案的年级。
      const assessment = assessments
        .filter(item => item.subject === first.subject && Object.keys(item.masteryByChapter || {}).some(id => chapterIds.has(id)))
        .sort((left, right) => right.createdAt - left.createdAt)[0]
      const grade = first.grade || assessment?.grade || profile?.grade || ''
      const edition = first.edition || assessment?.edition || ''
      const latestExam = exams
        .filter(item => item.subject === first.subject && (!grade || item.grade === grade))
        .sort((left, right) => right.createdAt - left.createdAt)[0]
      if (!latestExam) { skipped += 1; continue }
      const chapterMap = new Map()
      for (const plan of groupPlans) {
        if (!chapterMap.has(plan.chapterId)) chapterMap.set(plan.chapterId, { id: plan.chapterId, name: plan.chapterName || plan.name, order: plan.sequenceOrder || 0 })
      }
      // 目标分按科目存，取当前计划科目那一份；老档案回退到顶层字段。
      const target = profile?.targets?.[first.subject]
      const result = await generatePlanSkeleton({
        grade, subject: first.subject, edition,
        chapters: [...chapterMap.values()], masteryByChapter: assessment?.masteryByChapter || {},
        dailyMinutes: profile?.dailyMinutes || 60,
        targetScore: target?.score ?? profile?.targetScore, targetFullScore: target?.full ?? profile?.targetFullScore, baselineScore: latestExam.score
      })
      if (!result.success || !Array.isArray(result.data?.plans)) { skipped += 1; continue }
      const fresh = new Map(result.data.plans.map(item => [`${item.chapterId}::${item.stage}`, item]))
      for (const plan of groupPlans) {
        if (plan.status === 'archived') continue
        const match = fresh.get(`${plan.chapterId}::${plan.stage}`)
        if (!match || match.estimatedMinutes === plan.estimatedMinutes) continue
        await savePlan({ ...plan, estimatedMinutes: match.estimatedMinutes })
        updated += 1
      }
    }
    plans.value = await loadPlans()
    if (updated) ElMessage.success(`已按最新成绩重算 ${updated} 个未归档任务的时长。`)
    else ElMessage.warning(skipped ? '暂无可重算的任务：先录入该科目的学校成绩，且要有未归档任务。' : '任务时长已经是最新配比，无需调整。')
  } finally {
    rebalancing.value = false
  }
}
</script>

<template>
  <div class="page">
    <div class="page-header">
      <div><h2 class="page-title">你的学习计划</h2><p class="page-subtitle">每个任务都可以单独开始专注，完成反馈后 Agent 会继续迭代。</p></div>
      <div class="header-actions"><el-button :loading="rebalancing" plain @click="rebalanceByScore">按最新成绩重算时长</el-button><el-button type="primary" @click="$router.push('/diagnosis')">重新诊断</el-button></div>
    </div>
    <div class="actions filter-row">
      <el-radio-group v-model="filter">
        <el-radio-button label="active">进行中</el-radio-button>
        <el-radio-button label="archived">已归档</el-radio-button>
        <el-radio-button label="all">全部</el-radio-button>
      </el-radio-group>
    </div>
    <p class="plan-hint">轨道上脉冲的是当前任务，走过的节点会点亮；拖动 ⠿ 调整顺序，「完成并归档」后自动点亮。</p>
    <div v-if="groupedPlans.length" class="subject-groups">
      <section v-for="group in groupedPlans" :key="group.subject" class="subject-group surface">
        <div class="subject-folder" role="button" tabindex="0" @click="toggleSubject(group.subject)" @keydown.enter="toggleSubject(group.subject)"><span class="folder-icon">{{ expandedSubjects.has(group.subject) ? '📂' : '📁' }}</span><span class="folder-name"><strong>{{ group.subject }}</strong><small>{{ group.plans.length }} 个学习任务 · 按知识顺序整理</small></span><span class="folder-progress"><span class="stage-dots"><el-tooltip v-for="(state, index) in stageStatesOf(group.plans)" :key="index" :content="stageDotHint(state, index, group.plans)" placement="top" :show-after="0" :hide-after="0"><i :class="state"></i></el-tooltip></span>{{ group.plans.filter(plan => plan.status === 'active').length }} 进行中 <b class="folder-toggle" aria-hidden="true">{{ expandedSubjects.has(group.subject) ? '−' : '+' }}</b></span><span class="folder-more" @click.stop><el-dropdown trigger="click"><el-button text title="科目操作">⋯</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item @click="clearSubject(group)">清空该科目计划</el-dropdown-item></el-dropdown-menu></template></el-dropdown></span></div>
        <div v-if="expandedSubjects.has(group.subject)" class="subject-plan-list">
          <div class="learning-track">
            <template v-for="plan in group.plans" :key="plan.id">
              <div v-if="plan.isBridge" class="track-node bridge"><div class="track-rail"><span class="track-dot">↳</span></div><div class="bridge-plan"><div><strong v-html="formatMathText(plan.name)"></strong><small>衔接复习 · {{ plan.reason || '补齐相邻专题的前置知识' }}</small></div><el-tag size="small" type="info">建议先复习</el-tag></div></div>
              <div v-else class="track-node" :class="nodeState(plan, group)"><div class="track-rail"><span class="track-dot">{{ plan.status === 'archived' ? '✓' : '' }}</span></div><article class="plan-row" :class="{ 'is-dragging': dragState.id === plan.id }" draggable="true" @dragstart="onDragStart(group, plan, $event)" @dragover="onDragOver(group, plan, $event)" @drop.prevent="onDrop(group, plan)" @dragend="dragState.id = ''"><span class="drag-handle" title="拖动调整顺序">⠿</span><div class="sequence-badge">{{ plan.sequenceOrder || '•' }}</div><div class="plan-row-main"><div class="plan-row-title"><h3 v-html="formatMathText(plan.name)"></h3><el-tag size="small" effect="plain" class="stage-tag">{{ stageLabel(stageOf(plan)) }}</el-tag><el-tag v-if="plan.aiPending" size="small" effect="plain" type="info">AI 优化中</el-tag><span v-if="plan.id === group.currentId" class="track-current-tag">进行中</span><span v-if="plan.locked" class="lock-badge" title="重新诊断时保留此任务">🔒</span><el-tag :type="plan.priority === '高' ? 'danger' : 'warning'" effect="plain" size="small">{{ plan.priority }}优先</el-tag></div><div class="plan-meta"><span>⏱ {{ plan.estimatedMinutes }} 分钟</span><span>🔁 {{ formatDate(plan.reviewTime) }}复习</span></div><div class="tag-row"><el-tag v-for="tag in plan.knowledgeTags" :key="tag" size="small" effect="plain"><span v-html="formatMathText(tag)"></span></el-tag></div></div><div class="plan-row-actions"><el-button type="primary" @click="startFocus(plan)">开始专注</el-button><el-button plain :loading="replacing === plan.id" @click="replaceTask(plan)">AI 换一个</el-button><el-dropdown><el-button text>更多⌄</el-button><template #dropdown><el-dropdown-menu><el-dropdown-item @click="setReminder(plan)">{{ plan.remindAt ? '改提醒' : '设提醒' }}</el-dropdown-item><el-dropdown-item @click="openEdit(plan)">编辑</el-dropdown-item><el-dropdown-item @click="toggleLock(plan)">{{ plan.locked ? '解锁' : '锁定' }}</el-dropdown-item><el-dropdown-item @click="toggleArchive(plan)">{{ plan.status === 'archived' ? '恢复' : '完成并归档' }}</el-dropdown-item><el-dropdown-item divided @click="removePlan(plan)">删除</el-dropdown-item></el-dropdown-menu></template></el-dropdown></div></article></div>
            </template>
          </div>
        </div>
      </section>
    </div>
    <div v-else class="surface empty">还没有符合条件的计划，先去完成一次学情诊断吧。</div>

    <el-dialog v-model="editVisible" title="编辑学习任务" width="500px">
      <el-form v-if="editing" label-position="top">
        <el-form-item label="任务名称"><el-input v-model="editing.name" maxlength="80" show-word-limit /></el-form-item>
        <el-form-item label="科目"><el-select v-model="editing.subject" style="width:100%"><el-option v-for="subject in ['语文','数学','英语','物理','化学','生物','历史','地理','道德与法治']" :key="subject" :value="subject" :label="subject" /></el-select></el-form-item>
        <div class="grid-2">
          <el-form-item label="预计时长（分钟）"><el-input-number v-model="editing.estimatedMinutes" :min="5" :max="180" /></el-form-item>
          <el-form-item label="优先级"><el-select v-model="editing.priority"><el-option v-for="priority in ['高','中','低']" :key="priority" :value="priority" :label="priority" /></el-select></el-form-item>
        </div>
        <el-form-item label="下次复习时间"><el-date-picker v-model="editing.reviewAt" type="datetime" value-format="YYYY-MM-DDTHH:mm" placeholder="选择日期和时间" style="width:100%" /></el-form-item>
        <el-form-item label="知识点标签"><el-input v-model="editing.knowledgeTagsText" placeholder="多个标签用逗号分隔" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="editVisible = false">取消</el-button><el-button type="primary" @click="submitEdit">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<style scoped>
.header-actions{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.filter-row{margin-bottom:18px}.subject-groups{display:grid;gap:14px}.subject-group{overflow:hidden}.subject-folder{width:100%;display:flex;align-items:center;gap:15px;padding:20px 23px;border:0;background:transparent;color:var(--text);text-align:left;cursor:pointer}.subject-folder:hover{background:var(--surface-soft)}.folder-icon{font-size:28px}.folder-name{display:grid;gap:4px;flex:1}.folder-name strong{font-size:18px}.folder-name small{font-size:12px;color:var(--muted)}.folder-progress{display:flex;align-items:center;gap:14px;color:var(--muted);font-size:12px}.folder-progress b{font-size:18px;color:var(--primary)}.folder-progress .folder-toggle{width:18px;height:18px;display:grid;place-items:center;border:1px solid var(--primary);border-radius:6px;font-size:13px;line-height:1;font-weight:600;color:var(--primary);flex:none}.folder-more{display:flex;align-items:center;margin-left:-4px}.folder-more :deep(.el-button){padding:4px 6px;font-size:16px;color:var(--muted)}.folder-more :deep(.el-button:hover){color:var(--primary)}.subject-plan-list{border-top:1px solid var(--border);padding:9px 18px 15px 24px}.plan-row{display:flex;align-items:center;gap:14px;padding:16px 8px;border-bottom:1px solid var(--border)}.plan-row:last-child{border-bottom:0}.sequence-badge{width:31px;height:31px;display:grid;place-items:center;border-radius:50%;background:var(--primary-soft);color:var(--primary);font-weight:700;flex:none}.plan-row-main{min-width:0;flex:1}.plan-row-title{display:flex;align-items:center;gap:10px}.plan-row-title h3{margin:0;font-size:15px}.plan-meta{display:flex;gap:14px;color:var(--muted);font-size:12px;margin:7px 0}.plan-row-actions{display:flex;align-items:center;gap:6px}.bridge-plan{display:flex;align-items:center;gap:13px;margin:5px 0 8px;padding:13px 15px;border:1px dashed #b6bec1;border-radius:13px;background:#f0f2f3;color:#727b80}.bridge-plan>span{font-size:20px}.bridge-plan div{flex:1;display:grid;gap:4px}.bridge-plan small{font-size:11px;color:#899196}
.plan-hint{margin:-4px 0 16px;font-size:12px;color:var(--muted)}.drag-handle{cursor:grab;color:#c1cbc9;font-size:15px;letter-spacing:-1px;flex:none;user-select:none}.plan-row.is-dragging{opacity:.45}.lock-badge{font-size:13px;line-height:1}
.learning-track{padding:4px 0 2px}.track-node{display:flex;align-items:flex-start;position:relative}.track-rail{position:relative;width:34px;flex:none;align-self:stretch}.track-dot{position:absolute;left:50%;top:24px;transform:translateX(-50%);width:20px;height:20px;display:grid;place-items:center;border-radius:50%;border:2px solid var(--border);background:var(--surface);font-size:11px;line-height:1;color:#fff;z-index:1;transition:transform .18s ease}.track-node:not(:last-child) .track-rail::after{content:'';position:absolute;left:50%;top:44px;bottom:0;width:2px;transform:translateX(-50%);background:var(--border)}.track-node.done .track-dot{border-color:var(--primary);background:var(--primary)}.track-node.done .track-rail::after{background:var(--primary)}.track-node.current .track-dot{border-color:var(--primary);background:var(--primary-soft);animation:trackPulse 2s ease-out infinite}.track-node.todo .track-dot{border-style:dashed}.track-node:hover .track-dot{transform:translateX(-50%) scale(1.12)}.track-node .plan-row{flex:1;min-width:0;border-bottom:0;padding:14px 8px 14px 4px}.track-current-tag{flex:none;font-size:11px;padding:2px 8px;border-radius:999px;background:var(--primary-soft);color:var(--primary);font-weight:600}.track-node.bridge .track-dot{border:0;background:none;color:var(--muted);font-size:16px;top:18px;width:auto;height:auto}.track-node.bridge .track-rail::after{background:repeating-linear-gradient(var(--border) 0 6px,transparent 6px 11px)}.track-node.bridge .bridge-plan{flex:1;margin:0 0 6px}
@keyframes trackPulse{0%{box-shadow:0 0 0 0 rgba(77,141,142,.42)}70%{box-shadow:0 0 0 12px rgba(77,141,142,0)}100%{box-shadow:0 0 0 0 rgba(77,141,142,0)}}@media (prefers-reduced-motion: reduce){.track-node.current .track-dot{animation:none}}
:deep(sub){font-size:.7em;line-height:0;vertical-align:sub}@media(max-width:760px){.plan-row{align-items:flex-start;flex-wrap:wrap}.plan-row-main{width:calc(100% - 50px)}.plan-row-actions{width:100%;padding-left:46px}.folder-progress{font-size:0}.folder-progress b{font-size:13px}}
.stage-tag{margin-left:2px;color:var(--muted)}
.stage-dots{display:inline-flex;gap:4px;margin-right:8px;vertical-align:middle}
.stage-dots i{position:relative;width:6px;height:6px;border-radius:50%;background:var(--border)}
/* 6px 的点太难悬停，用伪元素把命中区扩到 10px；正好等于点间距，不会盖住相邻的点。 */
.stage-dots i::after{content:'';position:absolute;inset:-2px;border-radius:50%}
.stage-dots i.done{background:var(--primary)}
.stage-dots i.current{background:var(--accent);box-shadow:0 0 0 2px rgba(238,167,123,.22)}
</style>
