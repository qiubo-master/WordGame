import type { AuthInfo, LeaderboardEntry } from '../types'

// 生产环境（CloudBase）通过 VITE_API_BASE 指向云函数 HTTP 域名；
// 本地留空，则请求落到 /api，由 vite.config.ts 的 proxy 转发到本地 8787 后端。
// 非 Vite 环境（如 smoke 测试的 esbuild bundle）import.meta.env 不存在，安全降级为 ''。
const API_BASE: string =
  ((import.meta as { env?: Record<string, string | undefined> }).env?.VITE_API_BASE) || ''

export function apiSpeechUrl(text: string): string {
  return `${API_BASE}/api/speech?word=${encodeURIComponent(text.trim())}`
}

const AUTH_KEY = 'wq-auth'

function friendlyApiError(message: unknown, status: number): string {
  if (typeof message === 'string' && /[\u4e00-\u9fff]/.test(message)) return message
  if (status === 401) return '账号或密码不对'
  if (status === 409) return '账号信息已被使用，请更换后重试'
  if (status >= 500) return '服务器暂时开小差，请稍后再试'
  return `请求失败，请稍后重试（${status}）`
}

export function getAuth(): AuthInfo | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthInfo
    return parsed && parsed.token && parsed.userId ? parsed : null
  } catch {
    return null
  }
}

export function saveAuth(auth: AuthInfo | null) {
  try {
    if (auth) localStorage.setItem(AUTH_KEY, JSON.stringify(auth))
    else localStorage.removeItem(AUTH_KEY)
  } catch {
    /* 存储不可用时静默降级为游客模式 */
  }
}

async function req(path: string, init?: RequestInit): Promise<unknown> {
  const auth = getAuth()
  const res = await fetch(API_BASE + '/api' + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(auth ? { Authorization: `Bearer ${auth.token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  let body: unknown = null
  try {
    body = await res.json()
  } catch {
    body = null
  }
  if (!res.ok) {
    const msg = (body as { error?: string } | null)?.error
    throw new Error(friendlyApiError(msg, res.status))
  }
  return body
}

export async function apiHealth(): Promise<boolean> {
  try {
    const r = await fetch(API_BASE + '/api/health', { cache: 'no-store' })
    return r.ok
  } catch {
    return false
  }
}

export async function apiCheck(
  username: string,
  phone: string,
): Promise<{ usernameTaken: boolean; phoneTaken: boolean }> {
  const q = `username=${encodeURIComponent(username)}&phone=${encodeURIComponent(phone)}`
  return req(`/check?${q}`) as Promise<{ usernameTaken: boolean; phoneTaken: boolean }>
}

export async function apiRegister(
  username: string,
  phone: string,
  password: string,
): Promise<AuthInfo> {
  return req('/register', {
    method: 'POST',
    body: JSON.stringify({ username, phone, password }),
  }) as Promise<AuthInfo>
}

export async function apiLogin(account: string, password: string): Promise<AuthInfo> {
  return req('/login', {
    method: 'POST',
    body: JSON.stringify({ account, password }),
  }) as Promise<AuthInfo>
}

export async function apiGetSave(): Promise<{ data: unknown; updatedAt: number | null }> {
  return req('/save') as Promise<{ data: unknown; updatedAt: number | null }>
}

export async function apiPutSave(data: unknown): Promise<{ ok: boolean; updatedAt: number }> {
  return req('/save', {
    method: 'PUT',
    body: JSON.stringify({ data }),
  }) as Promise<{ ok: boolean; updatedAt: number }>
}

export async function apiGetLeaderboard(): Promise<{
  rows: LeaderboardEntry[]
  generatedAt: number
}> {
  return req('/leaderboard') as Promise<{ rows: LeaderboardEntry[]; generatedAt: number }>
}
