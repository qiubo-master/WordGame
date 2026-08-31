import type { AuthInfo } from '../types'

const AUTH_KEY = 'wq-auth'

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
  const res = await fetch('/api' + path, {
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
    throw new Error(msg || `请求失败（${res.status}）`)
  }
  return body
}

export async function apiHealth(): Promise<boolean> {
  try {
    const r = await fetch('/api/health', { cache: 'no-store' })
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
