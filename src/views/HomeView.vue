<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAppStore } from '../stores/app.js'
import { getDataOwner, getHomeStats } from '../db/index.js'
import { STAGES } from '../utils/stages.js'
import LimeIcon from '../components/LimeIcon.vue'

const router = useRouter()
const store = useAppStore()
// 主页「从一个好奇开始」可展示的科目全集，用户自由勾选，默认只放语数英。
const allSubjects = [
  { name: '数学', caption: '从概念到迁移', icon: '∑', color: 'mint' },
  { name: '物理', caption: '用模型解释世界', icon: 'ϕ', color: 'violet' },
  { name: '化学', caption: '从微观看见变化', icon: '⚗', color: 'sand' },
  { name: '语文', caption: '读懂，也表达清楚', icon: '文', color: 'coral' },
  { name: '英语', caption: '把语感变成能力', icon: 'Aa', color: 'blue' },
  { name: '生物', caption: '看见生命的结构', icon: '◎', color: 'leaf' },
  { name: '历史', caption: '把时间连成脉络', icon: '史', color: 'rose' },
  { name: '地理', caption: '读懂地图与空间', icon: '地', color: 'sky' },
  { name: '道德与法治', caption: '理解规则与责任', icon: '法', color: 'cream' },
  { name: '政治', caption: '看清社会与制度', icon: '政', color: 'stone' }
]
const selectedSubjects = computed(() => {
  const names = Array.isArray(store.settings.favoriteSubjects) ? store.settings.favoriteSubjects : []
  // 按用户勾选顺序展示，默认就是「语数英」，而不是按科目全集的定义顺序。
  return names.map(name => allSubjects.find(subject => subject.name === name)).filter(Boolean)
})
const subjectDialogVisible = ref(false)
const subjectDraft = ref([])
const allSubjectsSelected = computed(() => allSubjects.length > 0 && subjectDraft.value.length === allSubjects.length)
const someSubjectsSelected = computed(() => subjectDraft.value.length > 0 && subjectDraft.value.length < allSubjects.length)

function openSubjectDialog() {
  subjectDraft.value = selectedSubjects.value.map(subject => subject.name)
  subjectDialogVisible.value = true
}

// 「全选」一次勾上或清空全部科目，和逐个勾选等价。
function toggleAllSubjects(checked) {
  subjectDraft.value = checked ? allSubjects.map(subject => subject.name) : []
}

async function saveFavorites() {
  await store.updateSettings({ favoriteSubjects: [...subjectDraft.value] })
  subjectDialogVisible.value = false
}

// 卡片右上角的移除按钮，移掉后随时可以从右上角重新勾回来。
async function removeFavorite(name) {
  await store.updateSettings({ favoriteSubjects: (store.settings.favoriteSubjects || []).filter(item => item !== name) })
}
const steps = [
  { number: '01', title: '找到起点', text: '用一次轻量摸底，认识自己已经掌握和需要补上的地方。' },
  { number: '02', title: '生成路线', text: 'AI 把知识依赖、学习时间和你的反馈变成今天能完成的任务。' },
  { number: '03', title: '专注前进', text: '每次专注留下可复盘的脚印，下一轮计划会跟着你一起成长。' }
]

function startLearning() { router.push('/diagnosis') }
// 科目卡带上科目参数，进入诊断页时直接预选，少一次选择。
function openSubject(subject) { router.push({ path: '/diagnosis', query: { subject: subject.name } }) }

// 主页所有数字都来自当前数据空间的学习记录，没有记录时显示如实提示。
const stats = ref({ streakDays: 0, totalFocusMinutes: 0, todayFocusMinutes: 0, progressPercent: 0, remainingMinutes: 0, plansCount: 0, totalPlans: 0, knowledgeCount: 0, nextPlanName: '', nextPlanSubject: '', nextPlanTag: '', stageSubject: '' })
// 今日青柠按 25 分钟折算，和专注页同一口径。
const todayLimes = computed(() => Math.floor((stats.value.todayFocusMinutes || 0) / 25))
// 累计青柠罐：按历史总专注分钟折算（和看板同一口径），首页直接露出奖励进度。
const totalLimes = computed(() => Math.floor((stats.value.totalFocusMinutes || 0) / 25))
const limeToNext = computed(() => 25 - ((stats.value.totalFocusMinutes || 0) % 25))
const limeFilled = computed(() => Math.min(totalLimes.value, 6))
const progressHint = computed(() => stats.value.remainingMinutes > 0 ? `还差 ${stats.value.remainingMinutes} 分钟` : '今日目标已完成')
const mapSubtitle = computed(() => stats.value.nextPlanName
  ? `${stats.value.nextPlanSubject} · ${stats.value.nextPlanTag || '知识专题'}`
  : '先做一次摸底，生成第一条路线')
const mapStatus = computed(() => stats.value.todayFocusMinutes > 0 ? '● 进行中' : '● 待开始')
// hero 左下的 AI 学伴提示：有路线就指向今天的一小步，没有就引导先摸底，贴合「点亮地图」的主题。
const aiHint = computed(() => stats.value.nextPlanName
  ? `AI 已把「${stats.value.nextPlanName}」拆成今天能走的一小步`
  : '做一次轻量摸底，AI 就能为你的第一张地图标好起点')

// 悬浮卡上的三个数字：数据读回来后从 0 滚到真实值，避免一上来就是干巴巴的静态数字。
const displayStats = ref({ streak: 0, today: 0, total: 0 })
let statFrame = 0
function rollHeroStats() {
  cancelAnimationFrame(statFrame)
  const from = { ...displayStats.value }
  const target = { streak: stats.value.streakDays, today: stats.value.todayFocusMinutes, total: stats.value.totalFocusMinutes }
  const start = performance.now()
  const step = now => {
    const progress = Math.min(1, (now - start) / 900)
    const eased = 1 - Math.pow(1 - progress, 3)
    displayStats.value = {
      streak: Math.round(from.streak + (target.streak - from.streak) * eased),
      today: Math.round(from.today + (target.today - from.today) * eased),
      total: Math.round(from.total + (target.total - from.total) * eased)
    }
    if (progress < 1) statFrame = requestAnimationFrame(step)
  }
  statFrame = requestAnimationFrame(step)
}

// 首屏以下的分区进入视口再淡入；不支持 IntersectionObserver 时直接全部显示。
const revealReady = ref(false)
function setupReveal() {
  const sections = [...document.querySelectorAll('.home-page .reveal')]
  if (!('IntersectionObserver' in window)) {
    sections.forEach(node => node.classList.add('is-revealed'))
    return
  }
  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return
      entry.target.classList.add('is-revealed')
      observer.unobserve(entry.target)
    })
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 })
  sections.forEach(node => {
    // 已经在视口里的分区先标记，避免开启隐藏样式时闪一下。
    if (node.getBoundingClientRect().top < window.innerHeight * 0.92) node.classList.add('is-revealed')
    observer.observe(node)
  })
  revealReady.value = true
}

const pathStages = STAGES.map(stage => stage.label)
// 节点状态来自当前科目计划任务的真实阶段：全部归档的阶段点亮，当前任务所在阶段脉冲，其余待开始；没有计划时四个点都不假装进行中。
const pathStates = computed(() => Array.isArray(stats.value.stageStates) && stats.value.stageStates.length === 4
  ? stats.value.stageStates
  : ['pending', 'pending', 'pending', 'pending'])

// 阶段刚归档完成时播放一次约 1 秒的点亮动效，播完停在完成态；不做循环动画。
// 上一次看过的状态记在 localStorage（按数据空间分开），只用来判断「这次有没有新的完成」。
const celebratingStages = ref([])
function syncStageCelebration() {
  const states = pathStates.value
  const subject = stats.value.stageSubject || ''
  const key = `stage-seen:${getDataOwner()}`
  let previous = ''
  try { previous = localStorage.getItem(key) || '' } catch { previous = '' }
  if (previous) {
    const [previousSubject, previousStates = ''] = previous.split('|')
    if (previousSubject === subject) {
      const before = previousStates.split(',')
      celebratingStages.value = states.map((state, index) => (state === 'done' && before[index] !== 'done' ? index : -1)).filter(index => index >= 0)
      if (celebratingStages.value.length) setTimeout(() => { celebratingStages.value = [] }, 1200)
    }
  }
  try { localStorage.setItem(key, `${subject}|${states.join(',')}`) } catch { /* 隐私模式下写不进去不影响展示 */ }
}

onMounted(async () => {
  const homeStats = await getHomeStats({ dailyMinutes: store.profile?.dailyMinutes })
  stats.value = homeStats
  rollHeroStats()
  syncStageCelebration()
  setupReveal()
})
onBeforeUnmount(() => cancelAnimationFrame(statFrame))
</script>

<template>
  <div class="home-page page" :class="{ 'reveal-ready': revealReady }">
    <section class="home-hero">
      <div class="hero-copy">
        <span class="home-kicker"><span class="spark-dot"></span> 为每一个问题找到下一步</span>
        <h2>学习不是爬一座山，<br><em>而是点亮自己的<span class="hero-keep">地图。</span></em></h2>
        <div class="hero-actions">
          <el-button type="primary" size="large" round @click="startLearning">开始我的学习路线 <span class="arrow">→</span></el-button>
        </div>
        <div class="hero-insight" role="note">
          <span class="insight-mark">✦</span>
          <span class="insight-body"><strong>AI 学伴建议</strong><span>{{ aiHint }}</span></span>
          <button class="insight-next" @click="router.push('/tutor')" title="问问 AI 学伴">去问问 <span>→</span></button>
        </div>
        <button class="hero-lime-jar" @click="router.push('/dashboard')" title="去学习看板查看青柠罐">
          <span class="jar-mini-limes">
            <LimeIcon v-for="n in limeFilled" :key="n" :size="19" />
            <span v-if="!limeFilled" class="jar-mini-empty">还没有青柠</span>
          </span>
          <span class="jar-mini-copy"><strong>我的青柠罐 · {{ totalLimes }} 个</strong><small>再专注 {{ limeToNext }} 分钟收获下一颗</small></span>
          <span class="jar-mini-go">查看 <span>→</span></span>
        </button>
      </div>
      <div class="hero-visual" aria-label="学习地图预览">
        <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
        <div class="map-card map-card-main"><div class="map-card-top"><span>我的学习地图</span><span class="live-dot">{{ mapStatus }}</span></div><div class="map-title">{{ stats.nextPlanName || '还没有学习计划' }}</div><div class="map-subtitle">{{ mapSubtitle }}</div><div class="map-path"><template v-for="(stage, index) in pathStages" :key="stage"><span v-if="index" class="path-line" :class="{ filled: pathStates[index - 1] === 'done' }"></span><span class="map-node" :class="{ done: pathStates[index] === 'done', current: pathStates[index] === 'current', celebrate: celebratingStages.includes(index) }">{{ pathStates[index] === 'done' ? '✓' : index + 1 }}</span></template></div><div class="map-labels"><span v-for="stage in pathStages" :key="stage">{{ stage }}</span></div><div v-if="!stats.totalPlans" class="map-empty"><button class="map-empty-link" @click="startLearning">还没有计划 · 生成第一份 →</button></div><div class="map-progress"><span><strong>今日进度</strong><small>{{ progressHint }}</small></span><el-progress :percentage="stats.progressPercent" :show-text="false" color="#5e9f8f" :duration="900" /></div></div>
        <div class="float-card streak-card"><span class="streak-icon">✦</span><span><strong>{{ displayStats.streak ? `连续 ${displayStats.streak} 天` : '还没开始' }}</strong><small>{{ displayStats.streak ? '稳定的脚步很重要' : '完成一次专注就有记录' }}</small></span></div>
        <div class="float-card focus-card"><span class="focus-ring">{{ displayStats.today }}</span><span><strong>今日专注 {{ displayStats.today }} 分钟</strong><small class="focus-lime"><LimeIcon :size="14" /> 今日 {{ todayLimes }} 个青柠</small></span></div>
      </div>
    </section>

    <section class="welcome-strip surface reveal"><div><span class="eyebrow">今日一问</span><h3>今天想点亮哪一块？</h3></div><el-button plain round @click="router.push('/tutor')">先问一个问题 <span class="arrow">→</span></el-button></section>

    <section class="home-section reveal"><div class="section-heading"><div><span class="eyebrow">按科目探索</span><h3>从一个好奇开始</h3></div><div class="section-actions"><button class="text-link" @click="openSubjectDialog">＋ 选择科目</button><button class="text-link" @click="startLearning">查看全部 <span>→</span></button></div></div><div class="subject-grid"><div v-for="(subject, index) in selectedSubjects" :key="subject.name" class="subject-card favorite" :class="subject.color" :style="{ animationDelay: `${Math.min(index, 9) * 45}ms` }" role="button" tabindex="0" @click="openSubject(subject)" @keydown.enter="openSubject(subject)" @keydown.space.prevent="openSubject(subject)"><button class="subject-remove" title="从主页移除" @click.stop="removeFavorite(subject.name)">×</button><span class="subject-icon">{{ subject.icon }}</span><span class="subject-name">{{ subject.name }}</span><span class="subject-caption">{{ subject.caption }}</span><span class="subject-arrow">↗</span></div><p v-if="!selectedSubjects.length" class="subject-empty">还没有展示任何科目，点右上角「选择科目」勾上你正在学的。</p></div></section>

    <section class="path-section reveal"><div class="section-heading"><div><span class="eyebrow">学习节奏</span><h3>你的学习，应该有自己的节奏</h3></div></div><div class="steps-grid"><article v-for="step in steps" :key="step.number" class="step-card"><span class="step-number">{{ step.number }}</span><h4>{{ step.title }}</h4><p>{{ step.text }}</p></article></div></section>

    <section class="home-cta reveal"><div><span class="eyebrow">随时开始</span><h3>不必等到准备好，<br>从一个小问题开始。</h3></div><el-button type="primary" size="large" round @click="startLearning">进入学习工作台 <span class="arrow">→</span></el-button></section>

    <el-dialog v-model="subjectDialogVisible" title="选择展示的科目" width="420px" append-to-body>
      <p class="subject-dialog-hint">这栏展示哪些科目由你决定，不选的（比如物理）不会出现；卡片右上角的 × 也能直接移除。</p>
      <div class="subject-dialog-tools">
        <el-checkbox :model-value="allSubjectsSelected" :indeterminate="someSubjectsSelected" @change="toggleAllSubjects">全选</el-checkbox>
        <span class="subject-dialog-count">已选 {{ subjectDraft.length }} / {{ allSubjects.length }}</span>
      </div>
      <el-checkbox-group v-model="subjectDraft" class="subject-dialog-list">
        <el-checkbox v-for="subject in allSubjects" :key="subject.name" :value="subject.name">{{ subject.name }}<span class="subject-dialog-caption">{{ subject.caption }}</span></el-checkbox>
      </el-checkbox-group>
      <template #footer>
        <el-button @click="subjectDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveFavorites">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<style scoped>
/* 首页动效：hero 文案依次浮入、地图卡与悬浮卡随后到位，科目卡错开浮入，下方分区进入视口再淡入。 */
.hero-copy > *{animation:heroFade .5s cubic-bezier(.2,.7,.3,1) both}
.hero-copy > *:nth-child(2){animation-delay:.06s}
.hero-copy > *:nth-child(3){animation-delay:.12s}
.hero-copy > *:nth-child(4){animation-delay:.18s}
.hero-copy > *:nth-child(5){animation-delay:.24s}
.hero-copy > *:nth-child(6){animation-delay:.3s}
.hero-visual{animation:heroVisualIn .55s ease-out .12s backwards}
.map-card-main{animation:heroVisualIn .5s cubic-bezier(.2,.7,.3,1) .2s backwards}
.float-card{animation:floatIn .5s cubic-bezier(.2,.7,.3,1) .5s backwards}
.focus-card{animation-delay:.6s}
.subject-card{animation:subjectIn .45s cubic-bezier(.2,.7,.3,1) backwards}
.reveal{transition:opacity .55s cubic-bezier(.2,.7,.3,1),transform .55s cubic-bezier(.2,.7,.3,1)}
.home-page.reveal-ready .reveal:not(.is-revealed){opacity:0;transform:translateY(16px)}
@keyframes heroFade{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:none}}
@keyframes heroVisualIn{from{opacity:0}to{opacity:1}}
@keyframes floatIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes subjectIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@keyframes nodeGlow{0%{transform:scale(.7);box-shadow:0 0 0 0 rgba(94,159,143,.45)}45%{transform:scale(1.16);box-shadow:0 0 0 12px rgba(94,159,143,0)}to{transform:none;box-shadow:none}}
@media (prefers-reduced-motion: reduce){.hero-copy > *,.hero-visual,.map-card-main,.float-card,.subject-card{animation:none}.home-page.reveal-ready .reveal:not(.is-revealed){opacity:1;transform:none}.reveal{transition:none}}
.home-page{max-width:1520px;padding-top:16px;padding-bottom:60px}.home-hero{display:grid;grid-template-columns:minmax(0,1.03fr) minmax(400px,.97fr);gap:48px;align-items:start;padding:22px 28px 30px}.home-hero>*{min-width:0}.home-kicker{display:inline-flex;align-items:center;gap:8px;color:var(--primary);font-size:calc(12px*var(--fs-scale));font-weight:600;letter-spacing:.16em}.spark-dot{width:6px;height:6px;display:inline-block;background:var(--primary);border-radius:50%;box-shadow:0 0 0 5px rgba(77,129,122,.10)}.hero-copy h2{font-size:clamp(32px,3.4vw,50px);line-height:1.24;letter-spacing:-.025em;margin:20px 0 18px;color:var(--text);font-weight:600}.hero-copy h2 em{font-style:normal;color:var(--primary);background:linear-gradient(96deg,#0e7b6b 8%,#2f8f8a 46%,#3d6ed4 96%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent}.hero-copy h2 .hero-keep{white-space:nowrap}.hero-actions{display:flex;align-items:center;flex-wrap:wrap;gap:12px;margin-top:28px}.arrow{font-size:calc(18px*var(--fs-scale));margin-left:7px}
.hero-insight{display:flex;align-items:center;gap:14px;max-width:520px;margin-top:30px;padding:15px 16px;border:1px solid color-mix(in srgb,var(--primary) 18%,var(--border));border-radius:16px;background:linear-gradient(115deg,color-mix(in srgb,var(--primary) 9%,var(--surface)),color-mix(in srgb,var(--indigo,#4f6bd8) 6%,var(--surface)));animation:heroFade .5s cubic-bezier(.2,.7,.3,1) .24s backwards}
.insight-mark{flex:none;width:34px;height:34px;display:grid;place-items:center;border-radius:11px;background:color-mix(in srgb,var(--primary) 15%,transparent);color:var(--primary);font-size:calc(17px*var(--fs-scale))}
.insight-body{display:flex;flex-direction:column;gap:3px;min-width:0}
.insight-body strong{font-size:calc(12px*var(--fs-scale));color:var(--primary);font-weight:700;letter-spacing:.02em}
.insight-body>span{font-size:calc(13px*var(--fs-scale));line-height:1.5;color:var(--text);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.insight-next{flex:none;margin-left:auto;border:0;background:transparent;color:var(--primary);font-size:calc(12px*var(--fs-scale));font-weight:700;cursor:pointer;white-space:nowrap;padding:6px 2px}
.insight-next span{font-size:calc(16px*var(--fs-scale));margin-left:2px}
.insight-next:hover{text-decoration:underline}
@media(max-width:600px){.hero-insight{margin-top:24px;max-width:none}.insight-next{display:none}}
.hero-lime-jar{display:flex;align-items:center;gap:12px;width:100%;max-width:520px;margin-top:12px;padding:12px 16px;border:1px solid color-mix(in srgb,var(--primary) 18%,var(--border));border-radius:15px;background:color-mix(in srgb,var(--primary) 5%,var(--surface));text-align:left;cursor:pointer;transition:transform .18s,box-shadow .18s,border-color .18s;animation:heroFade .5s cubic-bezier(.2,.7,.3,1) .3s backwards}
.hero-lime-jar:hover{transform:translateY(-2px);box-shadow:var(--shadow-soft);border-color:color-mix(in srgb,var(--primary) 38%,var(--border))}
.jar-mini-limes{display:flex;align-items:center;gap:0;flex:none;min-width:74px}
.jar-mini-empty{font-size:calc(11px*var(--fs-scale));color:var(--muted)}
.jar-mini-copy{display:flex;flex-direction:column;gap:3px;min-width:0;flex:1}
.jar-mini-copy strong{font-size:calc(13px*var(--fs-scale));color:var(--text)}
.jar-mini-copy small{font-size:calc(11px*var(--fs-scale));color:var(--muted)}
.jar-mini-go{flex:none;color:var(--primary);font-size:calc(12px*var(--fs-scale));font-weight:700}
.jar-mini-go span{font-size:calc(16px*var(--fs-scale));margin-left:2px}
@media(max-width:600px){.hero-lime-jar{max-width:none}}.hero-visual{min-height:360px;position:relative;display:grid;place-items:center}.orbit{position:absolute;border:1px dashed rgba(77,129,122,.14);border-radius:50%;transform:rotate(-20deg)}.orbit-one{width:390px;height:270px}.orbit-two{width:310px;height:410px;transform:rotate(58deg)}.map-card{position:relative;z-index:2}.map-card-main{width:min(100%,395px);padding:24px;border:1px solid var(--border);border-radius:22px;background:linear-gradient(150deg,#ffffff,#f4faf7);box-shadow:var(--shadow)}.map-card-top{display:flex;justify-content:space-between;color:var(--muted);font-size:calc(11px*var(--fs-scale))}.live-dot{color:var(--success)}.map-title{font-size:calc(21px*var(--fs-scale));line-height:1.3;font-weight:600;color:var(--text);margin-top:22px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden;word-break:break-word}.map-subtitle{color:var(--muted);font-size:calc(13px*var(--fs-scale));margin-top:5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.map-path{display:flex;align-items:center;margin-top:35px}.map-node{width:32px;height:32px;display:grid;place-items:center;border:2px solid var(--border);border-radius:50%;color:var(--muted);font-size:calc(12px*var(--fs-scale));background:var(--surface)}.map-node.done{background:var(--primary);border-color:var(--primary);color:#fff}.map-node.current{background:var(--surface);border-color:var(--accent);color:#9a6f45;box-shadow:0 0 0 7px rgba(192,154,112,.12)}.path-line{height:2px;flex:1;background:var(--border)}.path-line.filled{background:#8fb8ae}.map-labels{display:flex;justify-content:space-between;color:var(--muted);font-size:calc(10px*var(--fs-scale));margin-top:9px}.map-node.celebrate{animation:nodeGlow 1.05s ease-out}.map-empty{margin-top:14px}.map-empty-link{border:0;background:transparent;padding:0;color:var(--primary);font-size:calc(12px*var(--fs-scale));font-weight:700;cursor:pointer}.map-progress{border-top:1px solid var(--border);margin-top:26px;padding-top:17px;display:grid;gap:10px}.map-progress>span{display:flex;justify-content:space-between;align-items:center}.map-progress strong{font-size:calc(12px*var(--fs-scale));color:var(--text)}.map-progress small{color:var(--muted)}.float-card{position:absolute;z-index:3;display:flex;align-items:center;gap:9px;padding:11px 14px;border:1px solid var(--border);border-radius:15px;background:rgba(255,255,255,.92);box-shadow:var(--shadow-soft);font-size:calc(12px*var(--fs-scale));color:var(--text)}.float-card strong,.float-card small{display:block}.float-card small{font-size:calc(10px*var(--fs-scale));color:var(--muted);margin-top:3px}
.focus-lime{display:flex;align-items:center;gap:5px}.streak-card{top:-22px;right:-14px}.focus-card{bottom:-26px;left:-14px}.streak-icon{display:grid;place-items:center;width:28px;height:28px;border-radius:9px;background:var(--accent-soft);color:#a9784c}.focus-ring{display:grid;place-items:center;width:32px;height:32px;border:3px solid var(--primary-soft);border-top-color:var(--primary);border-radius:50%;font-size:calc(10px*var(--fs-scale));color:var(--primary)}.welcome-strip{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:20px 24px;margin:0 28px 45px;border-radius:17px;background:linear-gradient(100deg,var(--surface),var(--primary-soft));box-shadow:none}.welcome-strip h3{margin:7px 0 0;font-size:calc(18px*var(--fs-scale))}.home-section,.path-section{padding:0 28px;margin-bottom:52px}.section-heading{display:flex;justify-content:space-between;align-items:end;margin-bottom:19px}.section-heading h3{font-size:calc(24px*var(--fs-scale));font-weight:600;letter-spacing:-.012em;margin:7px 0 0}.text-link{border:0;background:transparent;color:var(--primary);cursor:pointer;font-size:calc(13px*var(--fs-scale))}.text-link span{font-size:calc(18px*var(--fs-scale));margin-left:4px}.subject-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:12px}.subject-card{--tone:var(--primary);min-height:175px;position:relative;border:1px solid transparent;border-radius:18px;padding:22px;text-align:left;cursor:pointer;color:var(--text);display:flex;flex-direction:column;transition:transform .2s,box-shadow .2s}.subject-card:hover{transform:translateY(-3px);box-shadow:var(--shadow)}/* 科目卡：每个科目一个自己的色相，只用低饱和底 + 同色边框和图标色。
   之前所有科目都压在同一支青绿上，靠明度差区分，扫一眼分不出是哪科，整页也显得像护眼模式。
   色相只出现在卡底（大面积浅色）和图标/箭头（小面积深色），文字仍是中性墨色，保证可读。 */
.subject-card.mint{--tone:#0e7b6b;background:#e2f3ef;border-color:#cbe7df}.subject-card.violet{--tone:#6a49c9;background:#f0ecfd;border-color:#ded4f8}.subject-card.coral{--tone:#c05043;background:#fdecea;border-color:#f5d4d0}.subject-card.blue{--tone:#2b52a4;background:#e9f0fd;border-color:#cfdffa}.section-actions{display:flex;align-items:center;gap:16px}.subject-card.leaf{--tone:#4c8a2e;background:#edf6df;border-color:#d8e9c4}.subject-card.rose{--tone:#b84a76;background:#fdecf2;border-color:#f6d4e2}.subject-card.sky{--tone:#2b52a4;background:#e9f0fd;border-color:#cfdffa}.subject-card.cream{--tone:#8a6a1f;background:#fbf6e0;border-color:#efe4ba}.subject-card.stone{--tone:#4a5a66;background:#eef1f4;border-color:#dce3e9}.subject-card.sand{--tone:#a9662a;background:#fdf1e3;border-color:#f2dcc3}.subject-card.favorite{cursor:pointer}.subject-remove{position:absolute;top:12px;right:12px;width:22px;height:22px;display:grid;place-items:center;border:0;border-radius:50%;background:rgba(255,255,255,.72);color:#5f7c80;font-size:calc(13px*var(--fs-scale));line-height:1;cursor:pointer;opacity:0;transition:opacity .15s,background .15s}.subject-card.favorite:hover .subject-remove,.subject-remove:focus-visible{opacity:1}.subject-card.favorite:hover .subject-remove:hover{background:#f1d6d3;color:#b06a63}.subject-dialog-hint{font-size:calc(12px*var(--fs-scale));line-height:1.7;color:var(--muted);margin:0 0 14px}.subject-dialog-tools{display:flex;align-items:center;justify-content:space-between;padding-bottom:10px;margin-bottom:6px;border-bottom:1px solid var(--border)}.subject-dialog-count{font-size:calc(12px*var(--fs-scale));color:var(--muted)}.subject-empty{grid-column:1/-1;margin:0;padding:26px 16px;text-align:center;font-size:calc(13px*var(--fs-scale));color:var(--muted);border:1px dashed var(--border);border-radius:18px}.subject-dialog-list{display:grid;gap:10px}.subject-dialog-caption{color:var(--muted);font-size:calc(12px*var(--fs-scale));margin-left:8px}@media(max-width:600px){.subject-remove{opacity:1}.section-actions{gap:10px}}.subject-icon{display:grid;place-items:center;width:45px;height:45px;border-radius:14px;background:rgba(255,255,255,.72);color:var(--tone, var(--primary));font-size:calc(23px*var(--fs-scale));font-weight:700;margin-bottom:auto}.subject-name{font-weight:600;font-size:calc(19px*var(--fs-scale))}.subject-caption{font-size:calc(12px*var(--fs-scale));color:var(--muted);margin-top:5px}.subject-arrow{position:absolute;right:20px;bottom:19px;font-size:calc(18px*var(--fs-scale));color:var(--tone, var(--primary));opacity:.7}.path-section{padding-top:5px}.steps-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}.step-card{position:relative;padding:23px 22px 20px;background:var(--surface);border:1px solid var(--border);border-radius:19px;min-height:160px}.step-number{font:700 11px ui-monospace,monospace;color:var(--primary);letter-spacing:.08em}.step-card h4{font-size:calc(18px*var(--fs-scale));margin:23px 0 8px}.step-card p{font-size:calc(13px*var(--fs-scale));line-height:1.7;color:var(--muted);margin:0;max-width:280px}.home-cta{display:flex;justify-content:space-between;align-items:center;gap:20px;margin:0 28px;padding:30px 34px;border-radius:20px;background:#2b5751;color:#fff;overflow:hidden;position:relative}.home-cta:after{content:'';position:absolute;width:260px;height:260px;border:1px solid rgba(167,212,203,.18);border-radius:50%;right:15%;top:-170px}.home-cta h3{font-size:calc(25px*var(--fs-scale));line-height:1.35;margin:8px 0 0;letter-spacing:-.015em;font-weight:600}.home-cta .eyebrow{color:#a9ccc4}.home-cta :deep(.el-button){position:relative;z-index:1;background:#d9b78f;border-color:#d9b78f;color:#22322f}.home-cta :deep(.el-button:hover){background:#e5c9a6;border-color:#e5c9a6}@media(max-width:950px){.home-hero{grid-template-columns:1fr;gap:10px}.hero-copy{max-width:680px}.hero-visual{min-height:390px}.subject-grid{grid-template-columns:repeat(2,1fr)}}@media(max-width:600px){.home-page{padding:17px 0 35px}.home-hero{padding:15px 14px 28px}.hero-copy h2{font-size:calc(30px*var(--fs-scale))}.hero-visual{min-height:330px;transform:scale(.86);margin:-22px -8px}.orbit{display:none}.map-card-main{width:320px}.streak-card{right:-2px}.focus-card{left:-5px}.float-card{display:none}.welcome-strip,.home-section,.path-section{margin-left:14px;margin-right:14px;padding-left:0;padding-right:0}.welcome-strip{padding:17px;margin-bottom:36px}.welcome-strip h3{font-size:calc(15px*var(--fs-scale))}.subject-grid,.steps-grid{grid-template-columns:1fr 1fr;gap:10px}.subject-card{min-height:145px;padding:16px}.subject-name{font-size:calc(17px*var(--fs-scale))}.subject-caption{font-size:calc(11px*var(--fs-scale))}.section-heading h3{font-size:calc(22px*var(--fs-scale))}.home-cta{margin:0 14px;padding:25px 20px;align-items:flex-start;flex-direction:column}.home-cta h3{font-size:calc(23px*var(--fs-scale))}}
/* 对比度修正：原硬编码浅灰在地图卡、科目卡与悬浮卡上低于 WCAG AA，统一回到 token。 */
.map-subtitle{color:var(--muted)}
.map-labels{color:var(--muted)}
.map-node{color:var(--muted)}
.map-progress small{color:var(--muted)}
.float-card small{color:var(--muted)}
.subject-caption{color:var(--muted)}
.focus-ring{color:var(--primary)}
/* 移动端移除按钮从 22px 放大到 30px，避免误触。 */
@media(max-width:600px){.subject-remove{width:30px;height:30px;top:8px;right:8px;font-size:calc(16px*var(--fs-scale))}}
</style>

