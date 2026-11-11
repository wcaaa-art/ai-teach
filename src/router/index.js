import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../stores/app.js'
const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', redirect: '/home' },
    { path: '/home', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: '学习主页' } },
    { path: '/auth', name: 'auth', component: () => import('../views/AuthView.vue'), meta: { title: '登录 / 注册' } },
    { path: '/diagnosis', name: 'diagnosis', component: () => import('../views/DiagnosisView.vue'), meta: { title: '学情诊断' } },
    { path: '/quiz', name: 'quiz', component: () => import('../views/QuizView.vue'), meta: { title: '章节测试' } },
    { path: '/plans', name: 'plans', component: () => import('../views/PlansView.vue'), meta: { title: '学习计划' } },
    { path: '/focus', name: 'focus', component: () => import('../views/FocusView.vue'), meta: { title: '专注空间' } },
    { path: '/tutor', name: 'tutor', component: () => import('../views/TutorView.vue'), meta: { title: 'AI 答疑' } },
    { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '学习看板' } },
    { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '系统设置' } },
    { path: '/account', name: 'account', component: () => import('../views/AccountView.vue'), meta: { title: '账号中心', requiresAuth: true } }
  ],
  scrollBehavior: () => ({ top: 0 })
})

// 依赖登录的页面先确认服务端会话，未登录时带上原路径跳转到登录页。
router.beforeEach(async to => {
  if (!to.meta.requiresAuth) return true
  const store = useAppStore()
  await store.ensureAuth()
  if (!store.user) return { name: 'auth', query: { redirect: to.fullPath } }
  return true
})

export default router
