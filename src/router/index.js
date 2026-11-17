// @ts-check
import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../stores/app.js'
import { markRouteDone, markRouteStart } from '../utils/routeProgress.js'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: '学习主页' } },
    { path: '/auth', name: 'auth', component: () => import('../views/AuthView.vue'), meta: { title: '登录 / 注册' } },
    { path: '/diagnosis', name: 'diagnosis', component: () => import('../views/DiagnosisView.vue'), meta: { title: '学情诊断' } },
    { path: '/quiz', name: 'quiz', component: () => import('../views/QuizView.vue'), meta: { title: '章节测试' } },
    { path: '/paper-scan', name: 'paper-scan', component: () => import('../views/PaperScanView.vue'), meta: { title: '试卷识别' } },
    { path: '/materials', name: 'materials', component: () => import('../views/MaterialsView.vue'), meta: { title: '学习资料' } },
    { path: '/mistakes', name: 'mistakes', component: () => import('../views/MistakesView.vue'), meta: { title: '错题库' } },
    { path: '/plans', name: 'plans', component: () => import('../views/PlansView.vue'), meta: { title: '学习计划' } },
    { path: '/focus', name: 'focus', component: () => import('../views/FocusView.vue'), meta: { title: '专注空间' } },
    // 背诵窗口：语文逐句背诵、英语单词与打字默写，从计划行点进来。
    { path: '/recite', name: 'recite', component: () => import('../views/ReciteView.vue'), meta: { title: '背诵练习' } },
    // 练习窗口：计划里的「练习/做题」类任务，本地题库秒出题。
    { path: '/practice', name: 'practice', component: () => import('../views/PracticeView.vue'), meta: { title: '练习做题' } },
    { path: '/tutor', name: 'tutor', component: () => import('../views/TutorView.vue'), meta: { title: 'AI 答疑' } },
    // AI 能力地图：面向评委展示 Agent / RAG / MCP / 多模态与安全兜底，入口在导航和首页。
    { path: '/ai', name: 'ai-lab', component: () => import('../views/AiLabView.vue'), meta: { title: 'AI 能力' } },
    { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '学习看板' } },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '系统设置' } },
    { path: '/account', name: 'account', component: () => import('../views/AccountView.vue'), meta: { title: '账号中心', requiresAuth: true } }
  ],
  scrollBehavior: () => ({ top: 0 })
})

// 懒加载页面在点击后到渲染前会有空档，这里点亮顶部进度条给即时反馈。
router.beforeEach(to => { markRouteStart(to) })
router.afterEach(() => { markRouteDone() })
router.onError(() => { markRouteDone() })

// 依赖登录的页面先确认服务端会话，未登录时带上原路径跳转到登录页。
router.beforeEach(async to => {
  if (!to.meta.requiresAuth) return true
  const store = useAppStore()
  await store.ensureAuth()
  if (!store.user) return { name: 'auth', query: { redirect: to.fullPath } }
  return true
})

export default router
