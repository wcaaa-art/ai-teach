import test from 'node:test'
import assert from 'node:assert/strict'
import { routes } from './routes.js'

// 期望值写死在这里而不是从路由表推导：任何新增页面都必须显式决定是否公开。
const PUBLIC_PATHS = ['/home', '/auth', '/focus']

test('未登录只开放主页、登录页与专注空间', () => {
  const pageRoutes = routes.filter(route => !route.redirect)
  const publicRoutes = pageRoutes.filter(route => !route.meta?.requiresAuth).map(route => route.path)
  assert.deepEqual(publicRoutes.sort(), [...PUBLIC_PATHS].sort())
})

test('公开页与受限页都配了标题', () => {
  for (const route of routes.filter(item => !item.redirect)) {
    assert.ok(route.meta?.title, `${route.path} 缺少 meta.title`)
  }
})
