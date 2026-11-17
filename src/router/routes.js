// @ts-check
// 路由表独立成文件：不依赖 window，方便用 node --test 校验登录门禁的覆盖范围。
// 访问策略：未登录只能进主页、专注空间、设置和登录页，其余页面一律标记 requiresAuth。
/** @type {import('vue-router').RouteRecordRaw[]} */
export const routes = [
  { path: '/', redirect: '/home' },
  // 公开页：未登录也能进入。
  { path: '/home', name: 'home', component: () => import('../views/HomeView.vue'), meta: { title: '学习主页' } },
  { path: '/auth', name: 'auth', component: () => import('../views/AuthView.vue'), meta: { title: '登录 / 注册' } },
  { path: '/focus', name: 'focus', component: () => import('../views/FocusView.vue'), meta: { title: '专注空间' } },
  // 其余页面都要求登录：未登录时由守卫带到登录页，登录后自动回到原路径。
  { path: '/diagnosis', name: 'diagnosis', component: () => import('../views/DiagnosisView.vue'), meta: { title: '学情诊断', requiresAuth: true } },
  { path: '/quiz', name: 'quiz', component: () => import('../views/QuizView.vue'), meta: { title: '章节测试', requiresAuth: true } },
  { path: '/paper-scan', name: 'paper-scan', component: () => import('../views/PaperScanView.vue'), meta: { title: '试卷识别', requiresAuth: true } },
  { path: '/materials', name: 'materials', component: () => import('../views/MaterialsView.vue'), meta: { title: '学习资料', requiresAuth: true } },
  { path: '/mistakes', name: 'mistakes', component: () => import('../views/MistakesView.vue'), meta: { title: '错题库', requiresAuth: true } },
  { path: '/plans', name: 'plans', component: () => import('../views/PlansView.vue'), meta: { title: '学习计划', requiresAuth: true } },
  // 背诵窗口：语文逐句背诵、英语单词与打字默写，从计划行点进来。
  { path: '/recite', name: 'recite', component: () => import('../views/ReciteView.vue'), meta: { title: '背诵练习', requiresAuth: true } },
  // 练习窗口：计划里的「练习/做题」类任务，本地题库秒出题。
  { path: '/practice', name: 'practice', component: () => import('../views/PracticeView.vue'), meta: { title: '练习做题', requiresAuth: true } },
  { path: '/tutor', name: 'tutor', component: () => import('../views/TutorView.vue'), meta: { title: 'AI 答疑', requiresAuth: true } },
  // AI 能力地图：面向评委展示 Agent / RAG / MCP / 多模态与安全兜底，入口在导航和首页。
  { path: '/ai', name: 'ai-lab', component: () => import('../views/AiLabView.vue'), meta: { title: 'AI 能力', requiresAuth: true } },
  { path: '/dashboard', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: '学习看板', requiresAuth: true } },
  // 系统设置只改主题、字号等本机偏好，不涉及学习数据，未登录也放行。
  { path: '/settings', name: 'settings', component: () => import('../views/SettingsView.vue'), meta: { title: '系统设置' } },
  { path: '/account', name: 'account', component: () => import('../views/AccountView.vue'), meta: { title: '账号中心', requiresAuth: true } }
]
