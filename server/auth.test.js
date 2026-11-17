import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { createAuthService } from './auth.js'

// 临时目录放项目内（.gitignore 里已忽略）：沙箱下系统临时目录不可写。
const TEMP_ROOT = path.resolve('.tmp-test')
async function makeDataDir() {
  await mkdir(TEMP_ROOT, { recursive: true })
  return mkdtemp(path.join(TEMP_ROOT, 'auth-'))
}

// 每个用例一个独立数据目录，避免测试之间串账号。
async function withService(run) {
  const dataDir = await makeDataDir()
  try {
    const service = await createAuthService({ dataDir })
    await run(service, dataDir)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
}

test('注册只要用户名，邮箱可以留空', () => withService(async service => {
  const result = await service.register({ username: '小明', password: 'study1234' })
  assert.equal(result.error, undefined)
  assert.equal(result.user.username, '小明')
  assert.equal(result.user.email, '')
  // 没填称呼时用用户名顶上，注册表单少一个必填项。
  assert.equal(result.user.displayName, '小明')
}))

test('用户名重复被拒，且不区分大小写', () => withService(async service => {
  await service.register({ username: 'Tom', password: 'study1234' })
  const again = await service.register({ username: 'tom', password: 'study1234' })
  assert.equal(again.status, 409)
  assert.match(again.error, /用户名/)
}))

test('用户名格式与密码长度不合规时给出具体提示', () => withService(async service => {
  assert.match((await service.register({ username: 'a', password: 'study1234' })).error, /2 到 20 个字符/)
  assert.match((await service.register({ username: '有 空格', password: 'study1234' })).error, /2 到 20 个字符/)
  assert.match((await service.register({ username: 'xiaoming', password: 'short' })).error, /8 到 128/)
}))

test('填了邮箱才校验格式，邮箱重复也会被拒', () => withService(async service => {
  assert.match((await service.register({ username: 'a1', email: 'not-an-email', password: 'study1234' })).error, /邮箱格式/)
  await service.register({ username: 'a2', email: 'kid@example.com', password: 'study1234' })
  const dup = await service.register({ username: 'a3', email: 'KID@example.com', password: 'study1234' })
  assert.equal(dup.status, 409)
}))

test('登录同时接受用户名和邮箱', () => withService(async service => {
  await service.register({ username: 'xiaoming', email: 'kid@example.com', password: 'study1234' })
  assert.equal((await service.login({ account: 'xiaoming', password: 'study1234' })).user.username, 'xiaoming')
  assert.equal((await service.login({ account: 'XiaoMing', password: 'study1234' })).user.username, 'xiaoming')
  assert.equal((await service.login({ account: 'kid@example.com', password: 'study1234' })).user.username, 'xiaoming')
  // 老调用方仍在传 email 字段，也继续认。
  assert.equal((await service.login({ email: 'xiaoming', password: 'study1234' })).user.username, 'xiaoming')
}))

test('密码错误与非空账号的错误提示一致，不泄漏账号是否存在', () => withService(async service => {
  await service.register({ username: 'xiaoming', password: 'study1234' })
  const wrongPassword = await service.login({ account: 'xiaoming', password: 'wrongpass1' })
  const noSuchUser = await service.login({ account: 'nobody', password: 'wrongpass1' })
  assert.equal(wrongPassword.status, 401)
  assert.equal(wrongPassword.error, noSuchUser.error)
}))

test('返回给前端的用户对象不含密码与盐', () => withService(async service => {
  const { user } = await service.register({ username: 'xiaoming', password: 'study1234' })
  assert.deepEqual(Object.keys(user).sort(), ['createdAt', 'displayName', 'email', 'id', 'username'])
}))

test('可以改称呼，但用户名注册后不能改', () => withService(async service => {
  const { user } = await service.register({ username: 'xiaoming', password: 'study1234' })
  const renamed = await service.updateProfile(user.id, { displayName: '小铭' })
  assert.equal(renamed.user.displayName, '小铭')
  assert.match((await service.updateProfile(user.id, { displayName: '   ' })).error, /称呼不能为空/)
  assert.match((await service.updateProfile(user.id, { username: 'other' })).error, /不能修改/)
}))

test('邮箱注册的老账号可以补设一次用户名，之后不可再改', async () => {
  const dataDir = await makeDataDir()
  try {
    // 模拟改造前的账号数据：只有邮箱，没有 username 字段。
    const salt = randomBytes(16).toString('hex')
    const passwordHash = scryptSync('study1234', salt, 64).toString('hex')
    const legacy = { id: 'legacy1', email: 'old@example.com', displayName: 'old', salt, passwordHash, createdAt: Date.now() }
    await writeFile(path.join(dataDir, 'users.json'), JSON.stringify([legacy]), 'utf8')
    const service = await createAuthService({ dataDir })
    assert.equal((await service.login({ account: 'old@example.com', password: 'study1234' })).user.id, 'legacy1')
    const first = await service.updateProfile('legacy1', { username: 'xiaoming' })
    assert.equal(first.user.username, 'xiaoming')
    // 补设用户名后，用户名和邮箱都能登录到同一个账号。
    assert.equal((await service.login({ account: 'xiaoming', password: 'study1234' })).user.id, 'legacy1')
    assert.match((await service.updateProfile('legacy1', { username: 'another' })).error, /不能修改/)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('改密码要验旧密码，改完旧密码失效新密码可用', () => withService(async service => {
  const { user } = await service.register({ username: 'xiaoming', password: 'study1234' })
  assert.equal((await service.changePassword(user.id, { currentPassword: 'nope', newPassword: 'fresh1234' })).status, 401)
  assert.match((await service.changePassword(user.id, { currentPassword: 'study1234', newPassword: 'study1234' })).error, /不能和当前密码相同/)
  const ok = await service.changePassword(user.id, { currentPassword: 'study1234', newPassword: 'fresh1234' })
  assert.equal(ok.error, undefined)
  assert.equal((await service.login({ account: 'xiaoming', password: 'study1234' })).status, 401)
  assert.equal((await service.login({ account: 'xiaoming', password: 'fresh1234' })).user.username, 'xiaoming')
}))

test('会话令牌能还原用户，签名被篡改后失效', () => withService(async service => {
  const { user } = await service.register({ username: 'xiaoming', password: 'study1234' })
  const cookie = service.createSession(user)
  const token = decodeURIComponent(cookie.split(';')[0].split('=')[1])
  assert.equal(service.getUserFromToken(token).id, user.id)
  assert.equal(service.getUserFromToken(`${token}x`), null)
  assert.equal(service.getUserFromToken(''), null)
}))
