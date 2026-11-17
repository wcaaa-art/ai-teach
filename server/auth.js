import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import express from 'express'

const scrypt = promisify(nodeScrypt)
const SESSION_COOKIE = 'ai_teach_session'
const SESSION_SECONDS = 7 * 24 * 60 * 60
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// 用户名是登录标识：2-20 个字符，允许中英文、数字、下划线和连字符，不允许空格与 @
// （避免和邮箱写法混淆，也让归一化只用 toLowerCase 就够）。
const USERNAME_PATTERN = /^[\p{L}\p{N}_-]{2,20}$/u

function publicUser(user) {
  return {
    id: user.id,
    username: user.username || '',
    email: user.email || '',
    displayName: user.displayName,
    createdAt: user.createdAt
  }
}

function sign(value, secret) {
  return createHmac('sha256', secret).update(value).digest('base64url')
}

function cookieOptions(secure, remember = true) {
  // 不勾选「7 天内自动登录」时不写 Max-Age，Cookie 随浏览器关闭失效。
  const maxAge = remember ? `; Max-Age=${SESSION_SECONDS}` : ''
  return `Path=/api/auth; HttpOnly; SameSite=Lax${maxAge}${secure ? '; Secure' : ''}`
}

function readCookie(req, name) {
  const cookieHeader = req.headers.cookie || ''
  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=')
    if (separator < 0) continue
    if (part.slice(0, separator).trim() === name) return decodeURIComponent(part.slice(separator + 1).trim())
  }
  return ''
}

export async function createAuthService({ dataDir = path.resolve('server/data'), secret: configuredSecret } = {}) {
  await mkdir(dataDir, { recursive: true })
  const usersPath = path.join(dataDir, 'users.json')
  const secretPath = path.join(dataDir, 'session-secret')
  let users = []
  try {
    const stored = JSON.parse(await readFile(usersPath, 'utf8'))
    // 邮箱改为选填后，老账号（只有 email）和新账号（有 username，可能没 email）都要能读出来。
    users = Array.isArray(stored) ? stored.filter(user => user?.id && (user?.username || user?.email) && user?.passwordHash && user?.salt) : []
  } catch (error) {
    if (error.code !== 'ENOENT') throw new Error('账号数据文件无法读取。')
  }

  let secret = configuredSecret
  if (!secret) {
    try { secret = (await readFile(secretPath, 'utf8')).trim() } catch (error) {
      if (error.code !== 'ENOENT') throw new Error('登录会话密钥无法读取。')
      secret = randomBytes(48).toString('base64url')
      try { await writeFile(secretPath, secret, { flag: 'wx', mode: 0o600 }) } catch (writeError) {
        if (writeError.code !== 'EEXIST') throw writeError
        secret = (await readFile(secretPath, 'utf8')).trim()
      }
    }
  }
  if (!secret || secret.length < 32) throw new Error('AUTH_SESSION_SECRET 至少需要 32 个字符。')

  let writeQueue = Promise.resolve()
  let registerQueue = Promise.resolve()
  const persist = () => {
    writeQueue = writeQueue.then(async () => {
      const temporaryPath = `${usersPath}.${process.pid}.tmp`
      await writeFile(temporaryPath, JSON.stringify(users, null, 2), { mode: 0o600 })
      await rename(temporaryPath, usersPath)
    })
    return writeQueue
  }
  const serializeRegistration = task => {
    const current = registerQueue.then(task, task)
    registerQueue = current.then(() => undefined, () => undefined)
    return current
  }

  // 不存在的邮箱也执行一次 scrypt，避免登录响应时间明显泄漏账号是否注册。
  const dummySalt = randomBytes(16).toString('hex')
  const dummyHash = await scrypt(randomBytes(32), dummySalt, 64)

  return {
    async register({ username, email = '', password, displayName = '' }) {
      const cleanUsername = String(username || '').trim()
      const normalizedEmail = String(email || '').trim().toLowerCase()
      const cleanPassword = String(password || '')
      const cleanName = String(displayName || '').trim().slice(0, 40)
      if (!USERNAME_PATTERN.test(cleanUsername)) {
        return { error: '用户名需要 2 到 20 个字符，可用中文、字母、数字、下划线和连字符。', status: 400 }
      }
      // 邮箱选填；填了才校验格式，留空表示不绑定邮箱。
      if (normalizedEmail && (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254)) {
        return { error: '邮箱格式不正确；不需要邮箱可以留空。', status: 400 }
      }
      if (cleanPassword.length < 8 || cleanPassword.length > 128) {
        return { error: '密码长度需要为 8 到 128 个字符。', status: 400 }
      }
      return serializeRegistration(async () => {
        const lowerUsername = cleanUsername.toLowerCase()
        if (users.some(user => String(user.username || '').toLowerCase() === lowerUsername)) {
          return { error: '这个用户名已经被用了，换一个试试。', status: 409 }
        }
        if (normalizedEmail && users.some(user => user.email === normalizedEmail)) {
          return { error: '这个邮箱已经注册，请直接登录。', status: 409 }
        }
        const salt = randomBytes(16).toString('hex')
        const passwordHash = (await scrypt(cleanPassword, salt, 64)).toString('hex')
        const user = {
          id: randomBytes(16).toString('hex'), username: cleanUsername, email: normalizedEmail,
          // 不给称呼就用用户名顶上，少一个必填项。
          displayName: cleanName || cleanUsername,
          salt, passwordHash, createdAt: Date.now()
        }
        users.push(user)
        try { await persist() } catch {
          users = users.filter(item => item.id !== user.id)
          return { error: '账号暂时无法保存，请检查本机服务目录权限。', status: 500 }
        }
        return { user: publicUser(user) }
      })
    },

    // 登录标识同时接受用户名和邮箱：老账号是邮箱注册的，新账号可能没绑邮箱。
    async login({ account, email, password }) {
      const normalizedAccount = String(account ?? email ?? '').trim().toLowerCase()
      const user = users.find(item =>
        (item.username && String(item.username).toLowerCase() === normalizedAccount) ||
        (item.email && item.email === normalizedAccount)
      )
      const salt = user?.salt || dummySalt
      const expected = user ? Buffer.from(user.passwordHash, 'hex') : dummyHash
      const actual = await scrypt(String(password || '').slice(0, 128), salt, 64)
      const valid = expected.length === actual.length && timingSafeEqual(expected, actual)
      return valid && user ? { user: publicUser(user) } : { error: '用户名或密码不正确。', status: 401 }
    },

    // 改称呼；老账号（邮箱注册、没有用户名）还可以补设一次用户名，设过之后不允许再改，
    // 免得换用户名后别人找不到这个账号。
    async updateProfile(userId, { displayName, username } = {}) {
      const user = users.find(item => item.id === userId)
      if (!user) return { error: '登录状态已失效，请重新登录。', status: 401 }
      const next = {}
      if (displayName !== undefined) {
        const cleanName = String(displayName).trim().slice(0, 40)
        if (!cleanName) return { error: '称呼不能为空。', status: 400 }
        next.displayName = cleanName
      }
      if (username !== undefined && String(username).trim()) {
        const cleanUsername = String(username).trim()
        if (user.username) return { error: '用户名注册后不能修改，可以改称呼。', status: 400 }
        if (!USERNAME_PATTERN.test(cleanUsername)) {
          return { error: '用户名需要 2 到 20 个字符，可用中文、字母、数字、下划线和连字符。', status: 400 }
        }
        const lowerUsername = cleanUsername.toLowerCase()
        if (users.some(item => item.id !== userId && String(item.username || '').toLowerCase() === lowerUsername)) {
          return { error: '这个用户名已经被用了，换一个试试。', status: 409 }
        }
        next.username = cleanUsername
      }
      if (!Object.keys(next).length) return { error: '没有需要保存的改动。', status: 400 }
      const previous = { displayName: user.displayName, username: user.username || '' }
      Object.assign(user, next)
      try { await persist() } catch {
        Object.assign(user, previous)
        return { error: '账号暂时无法保存，请检查本机服务目录权限。', status: 500 }
      }
      return { user: publicUser(user) }
    },

    // 改密码必须验旧密码，避免会话被劫持后直接改掉密码锁死账号。
    async changePassword(userId, { currentPassword, newPassword } = {}) {
      const user = users.find(item => item.id === userId)
      if (!user) return { error: '登录状态已失效，请重新登录。', status: 401 }
      const current = String(currentPassword || '')
      const nextPassword = String(newPassword || '')
      if (nextPassword.length < 8 || nextPassword.length > 128) {
        return { error: '新密码长度需要为 8 到 128 个字符。', status: 400 }
      }
      const expected = Buffer.from(user.passwordHash, 'hex')
      const actual = await scrypt(current.slice(0, 128), user.salt, 64)
      const valid = expected.length === actual.length && timingSafeEqual(expected, actual)
      if (!valid) return { error: '当前密码不正确。', status: 401 }
      if (current === nextPassword) return { error: '新密码不能和当前密码相同。', status: 400 }
      const previous = { salt: user.salt, passwordHash: user.passwordHash }
      user.salt = randomBytes(16).toString('hex')
      user.passwordHash = (await scrypt(nextPassword, user.salt, 64)).toString('hex')
      try { await persist() } catch {
        Object.assign(user, previous)
        return { error: '密码暂时无法保存，请检查本机服务目录权限。', status: 500 }
      }
      return { user: publicUser(user) }
    },

    createSession(user, remember = true) {
      const now = Math.floor(Date.now() / 1000)
      const payload = Buffer.from(JSON.stringify({ sub: user.id, iat: now, exp: now + SESSION_SECONDS })).toString('base64url')
      const value = `${payload}.${sign(payload, secret)}`
      return `${SESSION_COOKIE}=${encodeURIComponent(value)}; ${cookieOptions(process.env.NODE_ENV === 'production', remember)}`
    },

    clearSessionCookie() {
      return `${SESSION_COOKIE}=; Path=/api/auth; HttpOnly; SameSite=Lax; Max-Age=0${process.env.NODE_ENV === 'production' ? '; Secure' : ''}`
    },

    getUserFromToken(token) {
      if (!token || typeof token !== 'string') return null
      const separator = token.lastIndexOf('.')
      if (separator < 1) return null
      const payload = token.slice(0, separator)
      const providedSignature = Buffer.from(token.slice(separator + 1))
      const expectedSignature = Buffer.from(sign(payload, secret))
      if (providedSignature.length !== expectedSignature.length || !timingSafeEqual(providedSignature, expectedSignature)) return null
      try {
        const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
        if (!claims.sub || !Number.isFinite(claims.exp) || claims.exp <= Math.floor(Date.now() / 1000)) return null
        const user = users.find(item => item.id === claims.sub)
        return user ? publicUser(user) : null
      } catch { return null }
    }
  }
}

export function createAuthRouter(authService) {
  const router = express.Router()
  const attempts = new Map()
  const secureResponse = (_req, res, next) => { res.set('Cache-Control', 'no-store'); next() }
  const rateLimit = (req, res, next) => {
    const key = String(req.ip || req.socket.remoteAddress || 'local')
    const now = Date.now()
    let record = attempts.get(key)
    if (!record || now - record.startedAt > 15 * 60 * 1000) record = { startedAt: now, count: 0 }
    record.count += 1
    attempts.set(key, record)
    if (record.count > 20) return res.status(429).json({ success: false, message: '尝试次数过多，请 15 分钟后再试。' })
    if (attempts.size > 2000) {
      for (const [address, item] of attempts) if (now - item.startedAt > 15 * 60 * 1000) attempts.delete(address)
    }
    next()
  }
  const setSession = (res, user, remember = true) => res.set('Set-Cookie', authService.createSession(user, remember))

  router.use(secureResponse)
  router.post('/register', rateLimit, async (req, res) => {
    const result = await authService.register(req.body || {})
    if (result.error) return res.status(result.status || 400).json({ success: false, message: result.error })
    setSession(res, result.user, req.body?.remember !== false)
    return res.status(201).json({ success: true, data: { user: result.user } })
  })
  router.post('/login', rateLimit, async (req, res) => {
    const result = await authService.login(req.body || {})
    if (result.error) return res.status(result.status || 401).json({ success: false, message: result.error })
    setSession(res, result.user, req.body?.remember !== false)
    return res.json({ success: true, data: { user: result.user } })
  })
  router.get('/me', (req, res) => {
    const user = authService.getUserFromToken(readCookie(req, SESSION_COOKIE))
    return res.json({ success: true, data: { authenticated: Boolean(user), user } })
  })
  router.post('/logout', (_req, res) => {
    res.set('Set-Cookie', authService.clearSessionCookie())
    return res.json({ success: true, data: { loggedOut: true } })
  })
  // 改资料与改密码都要求已登录：从 HttpOnly Cookie 里还原当前账号，不信任请求体里的 id。
  const requireUser = (req, res, next) => {
    const user = authService.getUserFromToken(readCookie(req, SESSION_COOKIE))
    if (!user) return res.status(401).json({ success: false, message: '登录状态已失效，请重新登录。' })
    req.currentUser = user
    return next()
  }
  router.patch('/profile', requireUser, async (req, res) => {
    const result = await authService.updateProfile(req.currentUser.id, req.body || {})
    if (result.error) return res.status(result.status || 400).json({ success: false, message: result.error })
    return res.json({ success: true, data: { user: result.user } })
  })
  router.post('/password', requireUser, async (req, res) => {
    const result = await authService.changePassword(req.currentUser.id, req.body || {})
    if (result.error) return res.status(result.status || 400).json({ success: false, message: result.error })
    return res.json({ success: true, data: { user: result.user } })
  })
  return router
}
