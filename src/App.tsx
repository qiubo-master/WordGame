import { useEffect, useState } from 'react'
import { useAppStore, useCurrentUser } from './store/useAppStore'
import type { ViewName } from './types'
import { Icon } from './components/Icon'
import { ToastHost } from './components/Toast'
import { UserGate } from './components/UserGate'
import { HomeView } from './components/HomeView'
import { BooksView } from './components/BooksView'
import { StudyView } from './components/StudyView'
import { LevelsView } from './components/LevelsView'
import { GameView } from './components/GameView'
import { MatchView } from './components/MatchView'
import { BattleView } from './components/BattleView'
import { GardenView } from './components/GardenView'
import { DinoView } from './components/DinoView'
import { BagView } from './components/BagView'
import { ShopView } from './components/ShopView'
import { AdminView } from './components/AdminView'
import { MistakeBook } from './components/MistakeBook'

const TABS: { key: ViewName; label: string; icon: string }[] = [
  { key: 'home', label: '首页', icon: 'home' },
  { key: 'levels', label: '闯关', icon: 'flag' },
  { key: 'mistakes', label: '错词', icon: 'book' },
  { key: 'bag', label: '背包', icon: 'bag' },
  { key: 'shop', label: '商城', icon: 'shop' },
]

export default function App() {
  const currentUserId = useAppStore((s) => s.currentUserId)
  const user = useCurrentUser()
  const auth = useAppStore((s) => s.auth)
  const touch = useAppStore((s) => s.touch)
  const logout = useAppStore((s) => s.logout)
  const signOut = useAppStore((s) => s.signOut)
  const setActiveBook = useAppStore((s) => s.setActiveBook)

  const [view, setView] = useState<ViewName>('home')
  const [playingLevel, setPlayingLevel] = useState<string | null>(null)
  const [playingGameType, setPlayingGameType] = useState<'whack' | 'match' | 'battle' | 'garden' | 'dino'>('whack')
  const [adminMode, setAdminMode] = useState(false)
  const [studyFocus, setStudyFocus] = useState<string[] | null>(null)
  const [studyFocusMode, setStudyFocusMode] = useState<'mistakes' | 'level' | null>(null)
  const [showLogout, setShowLogout] = useState(false)

  useEffect(() => {
    if (currentUserId) touch()
  }, [currentUserId, touch])

  const navigate = (v: ViewName) => {
    if (v !== 'study') {
      setStudyFocus(null)
      setStudyFocusMode(null)
    }
    setView(v)
  }

  const playLevel = (levelId: string, gameType: 'whack' | 'match' | 'battle' | 'garden' | 'dino') => {
    setPlayingGameType(gameType)
    setPlayingLevel(levelId)
  }

  if (adminMode) {
    return (
      <div className="app">
        <div className="topbar">
          <span style={{ fontSize: 15, fontWeight: 500 }}>管理员</span>
        </div>
        <AdminView onExit={() => setAdminMode(false)} />
        <ToastHost />
      </div>
    )
  }

  if (!currentUserId || !user) {
    return (
      <div className="app">
        <UserGate onEnterAdmin={() => setAdminMode(true)} />
        <ToastHost />
      </div>
    )
  }

  if (playingLevel) {
    const Game = playingGameType === 'match' ? MatchView : playingGameType === 'battle' ? BattleView : playingGameType === 'garden' ? GardenView : playingGameType === 'dino' ? DinoView : GameView
    return (
      <div className="app">
        <div className="topbar">
          <button onClick={() => setPlayingLevel(null)} className="tiny muted">
            返回关卡
          </button>
        </div>
        <Game levelId={playingLevel} onExit={() => setPlayingLevel(null)} />
        <ToastHost />
      </div>
    )
  }

  return (
    <div className="app">
      <div className="topbar">
        <button
          className="avatar"
          style={{ background: user.profile.color }}
          onClick={logout}
          title="切换学习者"
        >
          {user.profile.nickname.slice(0, 1)}
        </button>
        <div>
          <div className="topbar-name">{user.profile.nickname}</div>
          <div className="topbar-meta">连续 {user.streak} 天</div>
        </div>
        <div className="coin-pill">
          <Icon name="coin" size={16} color="#633806" />
          {user.wallet.coins}
        </div>
        {auth && (
          <button
            className="tiny muted"
            style={{ marginLeft: 4, whiteSpace: 'nowrap' }}
            onClick={() => setShowLogout(true)}
            title={`云端账号：${auth.username}`}
          >
            退出
          </button>
        )}
      </div>

      {view === 'home' && <HomeView onNavigate={navigate} />}
      {view === 'books' && <BooksView onNavigate={navigate} />}
      {view === 'study' && (
        <StudyView
          onNavigate={navigate}
          focusWordIds={studyFocus}
          focusMode={studyFocusMode}
          onExitDrill={() => navigate(studyFocusMode === 'level' ? 'levels' : 'mistakes')}
        />
      )}
      {view === 'levels' && (
        <LevelsView
          onNavigate={navigate}
          onPlay={playLevel}
          onStudyWords={(ids) => {
            setStudyFocus(ids)
            setStudyFocusMode('level')
            setView('study')
          }}
        />
      )}
      {view === 'mistakes' && (
        <MistakeBook
          onNavigate={navigate}
          onDrill={(ids, bookId) => {
            if (user.activeBookId !== bookId) setActiveBook(bookId)
            setStudyFocus(ids)
            setStudyFocusMode('mistakes')
            setView('study')
          }}
        />
      )}
      {view === 'bag' && <BagView />}
      {view === 'shop' && <ShopView />}

      <nav className="tabbar">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab${view === t.key ? ' active' : ''}`}
            onClick={() => navigate(t.key)}
          >
            <Icon name={t.icon} size={21} />
            {t.label}
          </button>
        ))}
      </nav>

      {auth && showLogout && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: 24,
          }}
          onClick={() => setShowLogout(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 24,
              maxWidth: 300,
              width: '100%',
              textAlign: 'center',
              boxShadow: '0 8px 30px rgba(0,0,0,0.18)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ fontSize: 16, fontWeight: 600, color: '#222', marginBottom: 8 }}>
              退出账号
            </div>
            <div style={{ fontSize: 14, color: '#666', lineHeight: 1.6, marginBottom: 20 }}>
              确定退出 {auth.username}？本地进度会保留，可随时重新登录找回云端存档。
            </div>
            <div style={{ display: 'flex', gap: 12 }}>
              <button
                className="btn"
                style={{ flex: 1, background: '#eee', color: '#333' }}
                onClick={() => setShowLogout(false)}
              >
                取消
              </button>
              <button
                className="btn"
                style={{ flex: 1, background: '#e5484d', color: '#fff' }}
                onClick={() => {
                  setShowLogout(false)
                  signOut()
                }}
              >
                退出
              </button>
            </div>
          </div>
        </div>
      )}

      <ToastHost />
    </div>
  )
}
