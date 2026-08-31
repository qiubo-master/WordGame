import { useEffect, useRef, useState } from 'react'
import { AVATAR_COLORS, useAppStore } from '../store/useAppStore'
import { Icon } from './Icon'
import { toast } from './Toast'
import { apiCheck, apiGetSave, apiHealth, apiLogin, apiRegister, saveAuth } from '../engine/api'
import type { AuthInfo, UserData } from '../types'

interface Props {
  onEnterAdmin: () => void
}

const TAP_TARGET = 5
const TAP_WINDOW = 2500

type Mode = 'pick' | 'new' | 'login' | 'register'

export function UserGate({ onEnterAdmin }: Props) {
  const users = useAppStore((s) => s.users)
  const userOrder = useAppStore((s) => s.userOrder)
  const createUser = useAppStore((s) => s.createUser)
  const switchUser = useAppStore((s) => s.switchUser)
  const removeUser = useAppStore((s) => s.removeUser)
  const verifyPasscode = useAppStore((s) => s.verifyPasscode)
  const applyLogin = useAppStore((s) => s.applyLogin)

  const [name, setName] = useState('')
  const [colorIdx, setColorIdx] = useState(0)
  const [mode, setMode] = useState<Mode>(userOrder.length ? 'pick' : 'login')
  const [askPass, setAskPass] = useState(false)
  const [code, setCode] = useState('')

  const [account, setAccount] = useState('')
  const [password, setPassword] = useState('')
  const [regUsername, setRegUsername] = useState('')
  const [regPhone, setRegPhone] = useState('')
  const [regPassword, setRegPassword] = useState('')
  const [formError, setFormError] = useState('')
  const [usernameTaken, setUsernameTaken] = useState(false)
  const [phoneTaken, setPhoneTaken] = useState(false)
  const [busy, setBusy] = useState(false)
  const [online, setOnline] = useState<boolean | null>(null)

  const taps = useRef(0)
  const tapTimer = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash === '#admin') setAskPass(true)
  }, [])

  useEffect(() => {
    let alive = true
    apiHealth().then((ok) => alive && setOnline(ok))
    return () => {
      alive = false
    }
  }, [])

  useEffect(() => {
    if (mode !== 'register') return
    const u = regUsername.trim()
    const p = regPhone.trim()
    if (!u && !p) {
      setUsernameTaken(false)
      setPhoneTaken(false)
      return
    }
    const t = window.setTimeout(async () => {
      try {
        const r = await apiCheck(u, p)
        setUsernameTaken(!!u && r.usernameTaken)
        setPhoneTaken(!!p && r.phoneTaken)
      } catch {
        /* 离线时不查重，提交时后端兜底校验 */
      }
    }, 500)
    return () => window.clearTimeout(t)
  }, [regUsername, regPhone, mode])

  const handleLogoTap = () => {
    taps.current += 1
    if (tapTimer.current) window.clearTimeout(tapTimer.current)
    tapTimer.current = window.setTimeout(() => {
      taps.current = 0
    }, TAP_WINDOW)
    if (taps.current >= TAP_TARGET) {
      taps.current = 0
      setAskPass(true)
    }
  }

  const submitPass = () => {
    if (verifyPasscode(code.trim())) {
      setAskPass(false)
      setCode('')
      onEnterAdmin()
    } else {
      toast('口令不对')
      setCode('')
    }
  }

  const handleCreate = () => {
    if (!name.trim()) {
      toast('先起个名字吧')
      return
    }
    createUser(name, colorIdx)
  }

  const finishLogin = async (auth: AuthInfo) => {
    saveAuth(auth)
    let remoteUser: UserData | null = null
    try {
      const remote = await apiGetSave()
      remoteUser = (remote?.data as UserData | null) ?? null
    } catch {
      /* 拉取失败先用本地数据，之后自动同步 */
    }
    applyLogin(auth, remoteUser)
    toast('登录成功')
  }

  const handleLogin = async () => {
    if (busy) return
    if (!account.trim() || !password) {
      setFormError('请输入账号和密码')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const auth = await apiLogin(account.trim(), password)
      await finishLogin(auth)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '登录失败')
    } finally {
      setBusy(false)
    }
  }

  const handleRegister = async () => {
    if (busy) return
    const u = regUsername.trim()
    const p = regPhone.trim()
    if (!u || u.length < 2) {
      setFormError('用户名至少 2 个字符')
      return
    }
    if (!/^1\d{10}$/.test(p)) {
      setFormError('手机号需 11 位、1 开头')
      return
    }
    if (regPassword.length < 6) {
      setFormError('密码至少 6 位')
      return
    }
    setBusy(true)
    setFormError('')
    try {
      const auth = await apiRegister(u, p, regPassword)
      await finishLogin(auth)
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '注册失败')
    } finally {
      setBusy(false)
    }
  }

  if (askPass) {
    return (
      <div className="gate">
        <div className="section-title" style={{ marginTop: 40 }}>
          管理员验证
        </div>
        <div className="pass-box">
          <input
            className="input"
            type="password"
            placeholder="输入管理员口令"
            value={code}
            autoFocus
            onChange={(e) => setCode(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submitPass()}
          />
          <div className="btn-row">
            <button
              className="btn ghost"
              onClick={() => {
                setAskPass(false)
                setCode('')
                if (window.location.hash === '#admin') window.location.hash = ''
              }}
            >
              取消
            </button>
            <button className="btn" onClick={submitPass}>
              进入
            </button>
          </div>
        </div>
      </div>
    )
  }

  const errStyle = { color: 'var(--danger)', fontSize: 13, marginTop: 8 } as const

  return (
    <div className="gate">
      <div className="center" style={{ marginBottom: 24 }}>
        <div className="gate-logo" onClick={handleLogoTap}>
          <Icon name="book" size={30} />
        </div>
        <h1>单词闯关</h1>
        <div className="muted" style={{ fontSize: 14 }}>
          背单词赚金币，解锁关卡打 Boss
        </div>
        {online !== null && (
          <div className="tiny muted" style={{ marginTop: 6 }}>
            {online ? '☁️ 已连接云端，进度自动同步' : '📴 云端未连接，进度仅存本机'}
          </div>
        )}
      </div>

      {mode === 'login' && (
        <>
          <div className="section-title">账号登录</div>
          <div className="card">
            <input
              className="input"
              placeholder="用户名或手机号"
              value={account}
              maxLength={30}
              onChange={(e) => setAccount(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            <input
              className="input"
              type="password"
              placeholder="密码"
              value={password}
              style={{ marginTop: 10 }}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
            {formError && <div style={errStyle}>{formError}</div>}
            <button className="btn" disabled={busy} onClick={handleLogin} style={{ marginTop: 14 }}>
              {busy ? '登录中…' : '登录'}
            </button>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={() => { setFormError(''); setMode('register') }}>
                没有账号？注册一个
              </button>
            </div>
          </div>
          <div className="center" style={{ marginTop: 20 }}>
            <button className="tiny muted" onClick={() => setMode(userOrder.length ? 'pick' : 'new')}>
              先不登录，直接玩 →（进度仅存本机）
            </button>
          </div>
        </>
      )}

      {mode === 'register' && (
        <>
          <div className="section-title">注册新账号</div>
          <div className="card">
            <input
              className="input"
              placeholder="用户名（2-20 字符）"
              value={regUsername}
              maxLength={20}
              onChange={(e) => setRegUsername(e.target.value)}
            />
            {usernameTaken && <div style={errStyle}>该用户名已被占用</div>}
            <input
              className="input"
              placeholder="手机号（11 位）"
              value={regPhone}
              maxLength={11}
              inputMode="numeric"
              style={{ marginTop: 10 }}
              onChange={(e) => setRegPhone(e.target.value.replace(/\D/g, ''))}
            />
            {phoneTaken && <div style={errStyle}>该手机号已注册</div>}
            <input
              className="input"
              type="password"
              placeholder="密码（至少 6 位）"
              value={regPassword}
              style={{ marginTop: 10 }}
              onChange={(e) => setRegPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleRegister()}
            />
            {formError && <div style={errStyle}>{formError}</div>}
            <button
              className="btn"
              disabled={busy || usernameTaken || phoneTaken}
              onClick={handleRegister}
              style={{ marginTop: 14 }}
            >
              {busy ? '注册中…' : '注册并登录'}
            </button>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={() => { setFormError(''); setMode('login') }}>
                已有账号？去登录
              </button>
            </div>
          </div>
        </>
      )}

      {mode === 'pick' && userOrder.length > 0 && (
        <>
          <div className="section-title">选择学习者</div>
          {userOrder.map((id) => {
            const u = users[id]
            if (!u) return null
            return (
              <button key={id} className="user-chip" onClick={() => switchUser(id)}>
                <div className="avatar" style={{ background: u.profile.color }}>
                  {u.profile.nickname.slice(0, 1)}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 15, fontWeight: 500 }}>{u.profile.nickname}</div>
                  <div className="tiny muted">
                    {u.wallet.coins} 金币 · 连续 {u.streak} 天
                  </div>
                </div>
                <div className="tiny muted">进入</div>
              </button>
            )
          })}
          <div className="btn-row" style={{ marginTop: 14 }}>
            <button className="btn ghost" onClick={() => setMode('new')}>
              + 添加新的学习者
            </button>
            <button className="btn ghost" onClick={() => setMode('login')}>
              ☁️ 账号登录
            </button>
          </div>
        </>
      )}

      {mode === 'new' && (
        <>
          <div className="section-title">新的学习者（游客模式）</div>
          <div className="card">
            <input
              className="input"
              placeholder="输入名字，比如 小明"
              value={name}
              maxLength={12}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <div className="tiny muted" style={{ margin: '14px 0 4px' }}>
              选个颜色
            </div>
            <div className="color-row">
              {AVATAR_COLORS.map((c, i) => (
                <button
                  key={c}
                  className={`color-dot${i === colorIdx ? ' on' : ''}`}
                  style={{ background: c }}
                  onClick={() => setColorIdx(i)}
                  aria-label={`颜色 ${i + 1}`}
                />
              ))}
            </div>
            <button className="btn" onClick={handleCreate}>
              开始学习
            </button>
            <div className="btn-row" style={{ marginTop: 10 }}>
              <button className="btn ghost" onClick={() => setMode(userOrder.length ? 'pick' : 'login')}>
                {userOrder.length > 0 ? '返回选择' : '返回登录'}
              </button>
            </div>
          </div>

          {userOrder.length > 0 && (
            <div className="center" style={{ marginTop: 20 }}>
              <button
                className="tiny"
                style={{ color: 'var(--danger)' }}
                onClick={() => {
                  const last = userOrder[userOrder.length - 1]
                  if (confirm('删除最后一位学习者？进度会一起清除。')) removeUser(last)
                }}
              >
                删除最后一位学习者
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
