import { useEffect, useMemo, useState } from 'react'
import { useCurrentUser, useAppStore, useSettings } from '../store/useAppStore'
import { BOOK_METAS, getBookMeta, loadBookWords } from '../data'
import { computeLearnedCount, computeStudiedCountSince } from '../engine/levels'
import { startOfDay } from '../engine/sm2'
import type { ViewName, Word } from '../types'
import { Icon } from './Icon'

interface Props {
  onNavigate: (v: ViewName) => void
}

export function HomeView({ onNavigate }: Props) {
  const user = useCurrentUser()
  const touch = useAppStore((s) => s.touch)
  const settings = useSettings()

  const meta = user?.activeBookId ? getBookMeta(user.activeBookId) : undefined
  const [bookWords, setBookWords] = useState<Word[]>([])
  useEffect(() => {
    if (!user?.activeBookId) {
      setBookWords([])
      return
    }
    let alive = true
    loadBookWords(user.activeBookId).then((w) => {
      if (alive) setBookWords(w)
    })
    return () => {
      alive = false
    }
  }, [user?.activeBookId])

  const learned = useMemo(() => {
    if (!user || !meta || bookWords.length === 0) return 0
    return computeLearnedCount(bookWords, user.wordStates)
  }, [user, meta, bookWords])

  if (!user) return null

  const unlimited = settings.dailyNewLimit === 0
  const dailyGoal = settings.dailyNewLimit
  const todayStart = startOfDay()
  const todayStudied = computeStudiedCountSince(user.wordStates, todayStart)
  const activeBookTodayStudied = user.activeBookId
    ? computeStudiedCountSince(user.wordStates, todayStart, user.activeBookId)
    : 0
  const pct = unlimited ? 100 : Math.min(100, Math.round((todayStudied / dailyGoal) * 100))
  const threshold = settings.unlockThreshold
  const toNextLevel = meta
    ? Math.max(0, (Math.floor(learned / threshold) + 1) * threshold - learned)
    : 0

  return (
    <div>
      <div className="hero">
        <div className="tiny muted">今日进度</div>
        <div className="big" style={{ margin: '4px 0 2px' }}>
          {unlimited ? `${todayStudied} 词 · 不限量` : `${todayStudied} / ${dailyGoal} 词`}
        </div>
        <div className="tiny muted">
          {meta ? `${meta.name} · 今日学习 ${activeBookTodayStudied} 词` : '还没选词库'} · 连续学习 {user.streak} 天
        </div>
        <div className="progress-track" style={{ marginTop: 12 }}>
          <div className="progress-fill" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat">
          <div className="v" style={{ color: 'var(--gold)' }}>
            {user.wallet.coins}
          </div>
          <div className="k">金币</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: 'var(--success)' }}>
            {learned}
          </div>
          <div className="k">已掌握</div>
        </div>
        <div className="stat">
          <div className="v" style={{ color: 'var(--purple)' }}>
            {user.streak}
          </div>
          <div className="k">连续天数</div>
        </div>
      </div>

      <div className="section-title">开始</div>
      <button
        className="btn"
        onClick={() => {
          touch()
          if (!user.activeBookId) onNavigate('books')
          else onNavigate('study')
        }}
      >
        {user.activeBookId ? '继续背单词' : '选择词库'}
      </button>

      <div className="menu-grid" style={{ marginTop: 12 }}>
        <button className="menu-item" onClick={() => onNavigate('levels')}>
          <Icon name="flag" color="var(--purple)" />
          <div className="t">闯关</div>
          <div className="d">5种游戏 · 每10词解锁</div>
        </button>
        <button className="menu-item" onClick={() => onNavigate('bag')}>
          <Icon name="bag" color="var(--success)" />
          <div className="t">背包</div>
          <div className="d">装备与道具</div>
        </button>
        <button className="menu-item" onClick={() => onNavigate('shop')}>
          <Icon name="shop" color="var(--gold)" />
          <div className="t">商城</div>
          <div className="d">用金币换装备</div>
        </button>
        <button className="menu-item" onClick={() => onNavigate('books')}>
          <Icon name="book" color="var(--primary)" />
          <div className="t">词库</div>
          <div className="d">共 {BOOK_METAS.length} 套</div>
        </button>
      </div>

      {meta && (
        <button
          className="card"
          style={{ marginTop: 16, width: '100%', textAlign: 'left' }}
          onClick={() => onNavigate('books')}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 14, fontWeight: 500 }}>{meta.name}</span>
            <span className="tag">{meta.wordCount} 词</span>
            <span className="tag">换词库</span>
          </div>
          <div className="tiny muted" style={{ marginTop: 6 }}>
            已掌握 {learned} 词 · 再背 {toNextLevel} 词解锁下一关 · 共{' '}
            {Math.ceil(meta.wordCount / Math.max(1, settings.unitSize))} 关
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{ width: `${Math.round((learned / meta.wordCount) * 100)}%` }}
            />
          </div>
        </button>
      )}
    </div>
  )
}
