import test from 'node:test'
import assert from 'node:assert/strict'
import { routes } from './routes.js'

// 期望值写死在这里而不是从路由表推导：任何新增页面都必须显式决定是否公开。
// 设置页只改本机偏好（主题、字号），不涉及学习数据，所以对未登录放行。
const PUBLIC_PATHS = ['/home', '/auth', '/focus', '/settings']

test('未登录只开放主页、登录页、专注空间与设置', () => {
  const pageRoutes = routes.filter(route => !route.redirect)
  const publicRoutes = pageRoutes.filter(route => !route.meta?.requiresAuth).map(route => route.path)
  assert.deepEqual(publicRoutes.sort(), [...PUBLIC_PATHS].sort())
})

test('公开页与受限页都配了标题', () => {
  for (const route of routes.filter(item => !item.redirect)) {
    assert.ok(route.meta?.title, `${route.path} 缺少 meta.title`)
  }
})
