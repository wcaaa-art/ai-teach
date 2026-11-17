import assert from 'node:assert/strict'
import { createHmac, randomBytes, scryptSync } from 'node:crypto'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
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

test('邮箱可以绑定、修改和解绑', () => withService(async service => {
  const { user } = await service.register({ username: 'xiaoming', password: 'study1234' })
  assert.equal(user.email, '')
  // 绑定
  assert.equal((await service.updateProfile(user.id, { email: 'Kid@Example.com ' })).user.email, 'kid@example.com')
  // 修改
  assert.equal((await service.updateProfile(user.id, { email: 'new@example.com' })).user.email, 'new@example.com')
  // 解绑：传空字符串
  assert.equal((await service.updateProfile(user.id, { email: '' })).user.email, '')
  // 解绑后不能再用旧邮箱登录
  assert.equal((await service.login({ account: 'new@example.com', password: 'study1234' })).status, 401)
}))

test('邮箱格式错误与被其他账号占用时拒绝修改', () => withService(async service => {
  const { user } = await service.register({ username: 'xiaoming', password: 'study1234' })
  await service.register({ username: 'taken', email: 'taken@example.com', password: 'study1234' })
  assert.match((await service.updateProfile(user.id, { email: 'not-an-email' })).error, /邮箱格式/)
  const dup = await service.updateProfile(user.id, { email: 'TAKEN@example.com' })
  assert.equal(dup.status, 409)
  assert.match(dup.error, /已经绑定到其他账号/)
  // 冲突失败后原值不变
  assert.equal((await service.updateProfile(user.id, { email: 'kid@example.com' })).user.email, 'kid@example.com')
}))

test('改密码后旧会话立即失效，必须用新密码重新登录', async () => {
  const dataDir = await makeDataDir()
  try {
    const service = await createAuthService({ dataDir })
    const { user } = await service.register({ username: 'xiaoming', password: 'study1234' })
    const readToken = cookie => decodeURIComponent(cookie.split(';')[0].split('=')[1])
    const oldSession = readToken(service.createSession(user))
    assert.equal(service.getUserFromToken(oldSession).id, user.id)

    const changed = await service.changePassword(user.id, { currentPassword: 'study1234', newPassword: 'fresh1234' })
    assert.equal(changed.reauthRequired, true)
    // 改密码前签发的令牌（含当前设备）全部作废
    assert.equal(service.getUserFromToken(oldSession), null)

    // 用新密码重新登录拿到的新令牌可用
    const relogin = await service.login({ account: 'xiaoming', password: 'fresh1234' })
    const freshSession = readToken(service.createSession(relogin.user))
    assert.equal(service.getUserFromToken(freshSession).id, user.id)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})

test('升级前的旧令牌（没有会话版本）继续有效，不被误踢下线', async () => {
  const dataDir = await makeDataDir()
  try {
    const service = await createAuthService({ dataDir })
    const { user } = await service.register({ username: 'xiaoming', password: 'study1234' })
    // 按改造前的格式手工签一枚令牌：payload 里只有 sub/iat/exp。
    const secret = (await readFile(path.join(dataDir, 'session-secret'), 'utf8')).trim()
    const now = Math.floor(Date.now() / 1000)
    const payload = Buffer.from(JSON.stringify({ sub: user.id, iat: now, exp: now + 3600 })).toString('base64url')
    const legacyToken = `${payload}.${createHmac('sha256', secret).update(payload).digest('base64url')}`
    assert.equal(service.getUserFromToken(legacyToken).id, user.id)
    // 但一旦改过密码，这枚旧令牌同样失效。
    await service.changePassword(user.id, { currentPassword: 'study1234', newPassword: 'fresh1234' })
    assert.equal(service.getUserFromToken(legacyToken), null)
  } finally {
    await rm(dataDir, { recursive: true, force: true })
  }
})
