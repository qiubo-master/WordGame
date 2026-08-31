import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { db, JWT_SECRET, uid } from './db.js'

const app = express()
app.use(express.json({ limit: '2mb' }))

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS')
  if (req.method === 'OPTIONS') return res.sendStatus(204)
  next()
})

const MAX_SAVE_BYTES = 2_000_000

function signToken(user) {
  return jwt.sign({ uid: user.id, username: user.username }, JWT_SECRET, { expiresIn: '180d' })
}

function authRequired(req, res, next) {
  const h = req.headers.authorization || ''
  const token = h.startsWith('Bearer ') ? h.slice(7) : null
  if (!token) return res.status(401).json({ error: '未登录' })
  try {
    req.auth = jwt.verify(token, JWT_SECRET)
    next()
  } catch {
    return res.status(401).json({ error: '登录已过期，请重新登录' })
  }
}

app.get('/api/health', (_req, res) => res.json({ ok: true }))

app.get('/api/check', (req, res) => {
  const { username, phone } = req.query
  const out = { usernameTaken: false, phoneTaken: false }
  if (username) {
    out.usernameTaken = !!db
      .prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE')
      .get(String(username))
  }
  if (phone) {
    out.phoneTaken = !!db.prepare('SELECT 1 FROM users WHERE phone = ?').get(String(phone))
  }
  res.json(out)
})

app.post('/api/register', (req, res) => {
  const username = String(req.body?.username ?? '').trim()
  const phone = String(req.body?.phone ?? '').trim()
  const password = String(req.body?.password ?? '')

  if (!username || username.length < 2 || username.length > 20) {
    return res.status(400).json({ error: '用户名需 2-20 个字符' })
  }
  if (!/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ error: '手机号格式不对（需 11 位、1 开头）' })
  }
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少 6 位' })
  }
  if (db.prepare('SELECT 1 FROM users WHERE username = ? COLLATE NOCASE').get(username)) {
    return res.status(409).json({ error: '用户名已被占用' })
  }
  if (db.prepare('SELECT 1 FROM users WHERE phone = ?').get(phone)) {
    return res.status(409).json({ error: '手机号已注册' })
  }

  const user = {
    id: uid(),
    username,
    phone,
    password_hash: bcrypt.hashSync(password, 10),
    created_at: Date.now(),
  }
  db.prepare(
    'INSERT INTO users (id, username, phone, password_hash, created_at) VALUES (?,?,?,?,?)',
  ).run(user.id, user.username, user.phone, user.password_hash, user.created_at)

  res.json({ token: signToken(user), userId: user.id, username: user.username, phone: user.phone })
})

app.post('/api/login', (req, res) => {
  const account = String(req.body?.account ?? '').trim()
  const password = String(req.body?.password ?? '')
  const row = db
    .prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE OR phone = ?')
    .get(account, account)
  if (!row || !bcrypt.compareSync(password, row.password_hash)) {
    return res.status(401).json({ error: '账号或密码不对' })
  }
  res.json({ token: signToken(row), userId: row.id, username: row.username, phone: row.phone })
})

app.get('/api/save', authRequired, (req, res) => {
  const row = db.prepare('SELECT data, updated_at FROM saves WHERE user_id = ?').get(req.auth.uid)
  if (!row) return res.json({ data: null, updatedAt: null })
  let data = null
  try {
    data = JSON.parse(row.data)
  } catch {
    data = null
  }
  res.json({ data, updatedAt: row.updated_at })
})

app.put('/api/save', authRequired, (req, res) => {
  const data = req.body?.data
  if (!data || typeof data !== 'object') {
    return res.status(400).json({ error: '存档数据缺失' })
  }
  const json = JSON.stringify(data)
  if (json.length > MAX_SAVE_BYTES) {
    return res.status(413).json({ error: '存档过大' })
  }
  const now = Date.now()
  db.prepare(
    `INSERT INTO saves (user_id, data, updated_at) VALUES (?,?,?)
     ON CONFLICT(user_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`,
  ).run(req.auth.uid, json, now)
  res.json({ ok: true, updatedAt: now })
})

const PORT = process.env.PORT || 8787
app.listen(PORT, () => {
  console.log(`[wordquest-server] listening on http://localhost:${PORT}`)
})
