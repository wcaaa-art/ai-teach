// @ts-check
import { createRouter, createWebHistory } from 'vue-router'
import { useAppStore } from '../stores/app.js'
import { markRouteDone, markRouteStart } from '../utils/routeProgress.js'
import { routes } from './routes.js'

const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior: () => ({ top: 0 })
})

// 懒加载页面在点击后到渲染前会有空档，这里点亮顶部进度条给即时反馈。
router.beforeEach(to => { markRouteStart(to) })
router.afterEach(() => { markRouteDone() })
router.onError(() => { markRouteDone() })

// 访问策略：只有主页、专注空间和登录页对未登录开放，其余页面先确认服务端会话，
// 未登录时带上原路径跳转到登录页，登录成功后由 AuthView 送回这里。
router.beforeEach(async to => {
  if (!to.meta.requiresAuth) return true
  const store = useAppStore()
  await store.ensureAuth()
  if (!store.user) return { name: 'auth', query: { redirect: to.fullPath } }
  return true
})

export default router
