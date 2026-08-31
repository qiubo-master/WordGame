import { DatabaseSync } from 'node:sqlite'
import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const dataDir = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(__dirname, 'data')
mkdirSync(dataDir, { recursive: true })

export const db = new DatabaseSync(path.join(dataDir, 'wordquest.db'))

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL COLLATE NOCASE,
  phone TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS saves (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  data TEXT NOT NULL,
  updated_at INTEGER NOT NULL
);
`)

const secretPath = path.join(dataDir, '.secret')
let jwtSecret = process.env.JWT_SECRET
if (!jwtSecret) {
  if (existsSync(secretPath)) {
    jwtSecret = readFileSync(secretPath, 'utf8').trim()
  } else {
    jwtSecret = randomBytes(32).toString('hex')
    writeFileSync(secretPath, jwtSecret)
  }
}
export const JWT_SECRET = jwtSecret

export function uid() {
  return Date.now().toString(36) + randomBytes(4).toString('hex')
}
