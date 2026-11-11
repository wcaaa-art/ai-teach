import { createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import path from 'node:path'
import express from 'express'

const scrypt = promisify(nodeScrypt)
const SESSION_COOKIE = 'ai_teach_session'
const SESSION_SECONDS = 7 * 24 * 60 * 60
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function publicUser(user) {
  return { id: user.id, email: user.email, displayName: user.displayName, createdAt: user.createdAt }
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
    users = Array.isArray(stored) ? stored.filter(user => user?.id && user?.email && user?.passwordHash && user?.salt) : []
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
    async register({ email, password, displayName = '' }) {
      const normalizedEmail = String(email || '').trim().toLowerCase()
      const cleanName = String(displayName || '').trim().slice(0, 40)
      const cleanPassword = String(password || '')
      if (!EMAIL_PATTERN.test(normalizedEmail) || normalizedEmail.length > 254) {
        return { error: '请输入有效的邮箱地址。', status: 400 }
      }
      if (cleanPassword.length < 8 || cleanPassword.length > 128) {
        return { error: '密码长度需要为 8 到 128 个字符。', status: 400 }
      }
      return serializeRegistration(async () => {
        if (users.some(user => user.email === normalizedEmail)) return { error: '这个邮箱已经注册，请直接登录。', status: 409 }
        const salt = randomBytes(16).toString('hex')
        const passwordHash = (await scrypt(cleanPassword, salt, 64)).toString('hex')
        const user = {
          id: randomBytes(16).toString('hex'), email: normalizedEmail,
          displayName: cleanName || normalizedEmail.split('@')[0].slice(0, 40),
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

    async login({ email, password }) {
      const normalizedEmail = String(email || '').trim().toLowerCase()
      const user = users.find(item => item.email === normalizedEmail)
      const salt = user?.salt || dummySalt
      const expected = user ? Buffer.from(user.passwordHash, 'hex') : dummyHash
      const actual = await scrypt(String(password || '').slice(0, 128), salt, 64)
      const valid = expected.length === actual.length && timingSafeEqual(expected, actual)
      return valid && user ? { user: publicUser(user) } : { error: '邮箱或密码不正确。', status: 401 }
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
  return router
}
