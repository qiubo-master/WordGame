'use strict'

/**
 * WordQuest 云函数后端（CloudBase 免费环境）
 *
 * 与本地 server/index.js 完全对齐的 6 个接口：
 *   GET  /api/health
 *   GET  /api/check      ?username=&phone=
 *   POST /api/register   { username, phone, password }
 *   POST /api/login      { account, password }
 *   GET  /api/save       (需 Authorization: Bearer <token>)
 *   PUT  /api/save       { data }       (需 Authorization: Bearer <token>)
 *
 * 存储由 node:sqlite 改为 CloudBase 云数据库（文档型集合 users / saves）。
 * 通过 HTTP 触发对外暴露，前端用 VITE_API_BASE 指向本函数域名，同源/跨域均可用。
 */

const cloudbase = require('@cloudbase/node-sdk')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { randomBytes } = require('node:crypto')

// v3：云函数内不传 env 会自动使用当前环境
const app = cloudbase.init({})
const db = app.database()
const _ = db.command

// ⚠️ 必须在函数环境变量中设置 JWT_SECRET，否则冷启动后老 token 全部失效
const JWT_SECRET = process.env.JWT_SECRET || 'DEV_ONLY_INSECURE_SECRET_CHANGE_ME'
if (!process.env.JWT_SECRET) {
  console.warn('[wqapi] JWT_SECRET 未设置，使用临时密钥，token 将在冷启动后失效！请在函数环境变量中设置 JWT_SECRET')
}

const MAX_SAVE_BYTES = 2_000_000

function json(status, obj, extraHeaders) {
  return {
    statusCode: status,
    headers: Object.assign(
      {
        'Content-Type': 'application/json; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      },
      extraHeaders || {},
    ),
    body: typeof obj === 'string' ? obj : JSON.stringify(obj),
  }
}

function signToken(user) {
  return jwt.sign({ uid: user._id, username: user.username }, JWT_SECRET, { expiresIn: '180d' })
}

function authFrom(headers) {
  const h = headers.authorization || headers.Authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return null
  try {
    return jwt.verify(token, JWT_SECRET)
  } catch {
    return null
  }
}

function uid() {
  return Date.now().toString(36) + randomBytes(4).toString('hex')
}

// 路由按后缀匹配，容错 API_BASE 是否带 /api 前缀、函数名是否出现在 path 中
function routeKey(path) {
  if (path.endsWith('/register')) return 'register'
  if (path.endsWith('/login')) return 'login'
  if (path.endsWith('/check')) return 'check'
  if (path.endsWith('/save')) return 'save'
  if (path.endsWith('/health')) return 'health'
  return null
}

async function handleCheck(query) {
  const username = query.username ? String(query.username) : ''
  const phone = query.phone ? String(query.phone) : ''
  const out = { usernameTaken: false, phoneTaken: false }
  if (username) {
    const r = await db.collection('users').where({ usernameLower: username.toLowerCase() }).get()
    out.usernameTaken = !!(r.data && r.data.length)
  }
  if (phone) {
    const r = await db.collection('users').where({ phone }).get()
    out.phoneTaken = !!(r.data && r.data.length)
  }
  return json(200, out)
}

async function handleRegister(body) {
  const username = String(body.username ?? '').trim()
  const phone = String(body.phone ?? '').trim()
  const password = String(body.password ?? '')

  if (!username || username.length < 2 || username.length > 20) {
    return json(400, { error: '用户名需 2-20 个字符' })
  }
  if (!/^1\d{10}$/.test(phone)) {
    return json(400, { error: '手机号格式不对（需 11 位、1 开头）' })
  }
  if (password.length < 6) {
    return json(400, { error: '密码至少 6 位' })
  }

  const existing = await db
    .collection('users')
    .where(_.or([_.eq('usernameLower', username.toLowerCase()), _.eq('phone', phone)]))
    .get()

  if (existing.data && existing.data.length) {
    const dupPhone = existing.data.find((u) => u.phone === phone)
    if (dupPhone) return json(409, { error: '手机号已注册' })
    const dupUser = existing.data.find((u) => u.usernameLower === username.toLowerCase())
    if (dupUser) return json(409, { error: '用户名已被占用' })
  }

  const user = {
    _id: uid(),
    username,
    usernameLower: username.toLowerCase(),
    phone,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: Date.now(),
  }
  await db.collection('users').add(user)
  return json(200, {
    token: signToken(user),
    userId: user._id,
    username: user.username,
    phone: user.phone,
  })
}

async function handleLogin(body) {
  const account = String(body.account ?? '').trim()
  const password = String(body.password ?? '')
  const r = await db
    .collection('users')
    .where(_.or([_.eq('usernameLower', account.toLowerCase()), _.eq('phone', account)]))
    .get()
  const row = r.data && r.data[0]
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return json(401, { error: '账号或密码不对' })
  }
  return json(200, {
    token: signToken(row),
    userId: row._id,
    username: row.username,
    phone: row.phone,
  })
}

async function handleGetSave(auth) {
  if (!auth) return json(401, { error: '未登录' })
  const r = await db.collection('saves').where({ userId: auth.uid }).get()
  const row = r.data && r.data[0]
  if (!row) return json(200, { data: null, updatedAt: null })
  let data = null
  try {
    data = JSON.parse(row.data)
  } catch {
    data = null
  }
  return json(200, { data, updatedAt: row.updatedAt })
}

async function handlePutSave(body, auth) {
  if (!auth) return json(401, { error: '未登录' })
  const data = body.data
  if (!data || typeof data !== 'object') {
    return json(400, { error: '存档数据缺失' })
  }
  const jsonStr = JSON.stringify(data)
  if (jsonStr.length > MAX_SAVE_BYTES) {
    return json(413, { error: '存档过大' })
  }
  const now = Date.now()
  const r = await db.collection('saves').where({ userId: auth.uid }).get()
  if (r.data && r.data.length) {
    await db.collection('saves').doc(r.data[0]._id).update({ data: jsonStr, updatedAt: now })
  } else {
    await db.collection('saves').add({ userId: auth.uid, data: jsonStr, updatedAt: now })
  }
  return json(200, { ok: true, updatedAt: now })
}

exports.main = async (event) => {
  const method = (event.httpMethod || 'GET').toUpperCase()
  const path = (event.path || '/').split('?')[0]
  const headers = event.headers || {}
  const query = event.queryString || event.queryStringParameters || {}
  let body = {}
  if (event.body) {
    try {
      body = JSON.parse(event.body)
    } catch {
      body = {}
    }
  }

  if (method === 'OPTIONS') return json(204, '')
  const route = routeKey(path)

  if (route === 'health') return json(200, { ok: true })
  if (route === 'check') return handleCheck(query)
  if (route === 'register') {
    if (method !== 'POST') return json(405, { error: 'method not allowed' })
    return handleRegister(body)
  }
  if (route === 'login') {
    if (method !== 'POST') return json(405, { error: 'method not allowed' })
    return handleLogin(body)
  }
  if (route === 'save') {
    const auth = authFrom(headers)
    if (method === 'GET') return handleGetSave(auth)
    if (method === 'PUT') return handlePutSave(body, auth)
    return json(405, { error: 'method not allowed' })
  }
  return json(404, { error: 'not found' })
}
