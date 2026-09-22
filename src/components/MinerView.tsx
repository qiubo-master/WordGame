import { useEffect, useMemo, useRef, useState } from 'react'
import { getBookMeta, loadBookWords } from '../data'
import { generateLevels, isLevelSelectionCleared, parseLevelSelection } from '../engine/levels'
import { SFX, unlockAudio } from '../engine/sound'
import { useAppStore, useCurrentUser, useSettings } from '../store/useAppStore'
import type { Word } from '../types'
import { ReplayConfirm } from './ReplayConfirm'

interface Props { levelId: string; onExit: () => void }

const ORES = ['🪨', '🟨', '💰', '💎']

export function MinerView({ levelId, onExit }: Props) {
  const selection = useMemo(() => parseLevelSelection(levelId), [levelId])
  const user = useCurrentUser()
  const settings = useSettings()
  const bookId = user?.activeBookId ?? null
  const meta = bookId ? getBookMeta(bookId) : undefined
  const recordGameResult = useAppStore((s) => s.recordGameResult)
  const [bookWords, setBookWords] = useState<Word[]>([])
  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready')
  const [elapsed, setElapsed] = useState(0)
  const [coins, setCoins] = useState(0)
  const [oreHp, setOreHp] = useState(5)
  const [oreIndex, setOreIndex] = useState(0)
  const [hit, setHit] = useState(0)
  const [showReplayConfirm, setShowReplayConfirm] = useState(false)
  const startedAt = useRef(0)
  const recorded = useRef(false)
  const replayRun = useRef(!!user && isLevelSelectionCleared(user.levelProgress, levelId))

  useEffect(() => {
    if (!bookId) return setBookWords([])
    let alive = true
    loadBookWords(bookId).then((words) => alive && setBookWords(words))
    return () => { alive = false }
  }, [bookId])

  const level = useMemo(
    () => meta ? generateLevels({ meta, words: bookWords }, settings).find((item) => item.id === selection.baseLevelId) : undefined,
    [meta, bookWords, settings, selection.baseLevelId],
  )
  const duration = (level?.index ?? 0) + 1
  const durationSeconds = duration * 60
  const remaining = Math.max(0, durationSeconds - elapsed)

  const begin = () => {
    unlockAudio()
    replayRun.current = !!user && isLevelSelectionCleared(user.levelProgress, levelId)
    recorded.current = false
    startedAt.current = Date.now()
    setElapsed(0)
    setCoins(0)
    setOreHp(5)
    setOreIndex(0)
    setHit(0)
    setPhase('playing')
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const timer = window.setInterval(() => {
      const seconds = Math.min(durationSeconds, Math.floor((Date.now() - startedAt.current) / 1000))
      setElapsed((previous) => {
        if (seconds > previous) setCoins((value) => value + seconds - previous)
        return seconds
      })
      if (seconds >= durationSeconds) setPhase('over')
    }, 250)
    return () => clearInterval(timer)
  }, [phase, durationSeconds])

  useEffect(() => {
    if (phase !== 'over' || recorded.current || !level || !meta) return
    recorded.current = true
    const reward = replayRun.current ? Math.min(10, coins) : coins
    recordGameResult({
      levelId,
      bookId: meta.id,
      score: coins,
      correct: 0,
      wrong: 0,
      maxCombo: 0,
      durationMs: Date.now() - startedAt.current,
      coinsEarned: reward,
      passed: true,
      playedAt: Date.now(),
      targetScore: durationSeconds,
    })
    SFX.win()
  }, [phase, level, meta, levelId, coins, durationSeconds, recordGameResult])

  const mine = () => {
    if (phase !== 'playing') return
    setHit((value) => value + 1)
    setOreHp((hp) => {
      if (hp > 1) return hp - 1
      const bonus = 2 + Math.floor(Math.random() * 5)
      setCoins((value) => value + bonus)
      setOreIndex((value) => (value + 1) % ORES.length)
      SFX.pop()
      return 5
    })
  }

  if (!meta || !level) return <div className="empty">金币矿洞加载中…</div>
  if (phase === 'ready') return (
    <div className="miner-ready">
      <div className="miner-title-art">⛏️<span>💰</span></div>
      <h2>{level.name} · 金币矿洞</h2>
      <p>战胜恐龙后的奖励时间！矿工会自动挖金币，点击矿石还能加速开采。</p>
      <div className="miner-time-card">本关挖矿时间 <b>{duration} 分钟</b></div>
      <button className="btn miner-start" onClick={begin}>进入矿洞</button>
      <button className="btn ghost" onClick={onExit}>返回关卡</button>
    </div>
  )
  if (phase === 'over') {
    const reward = replayRun.current ? Math.min(10, coins) : coins
    return (
      <div className="miner-result">
        <div>🏆💰⛏️</div>
        <h2>满载而归！</h2>
        <p>共挖到 {coins} 金币，本次到账 +{reward}{replayRun.current ? '（重玩上限 10）' : ''}</p>
        <div className="btn-row">
          <button className="btn ghost" onClick={onExit}>返回关卡</button>
          <button className="btn" onClick={() => setShowReplayConfirm(true)}>再挖一次</button>
        </div>
        <ReplayConfirm open={showReplayConfirm} onCancel={() => setShowReplayConfirm(false)} onContinue={() => { setShowReplayConfirm(false); begin() }} />
      </div>
    )
  }
  return (
    <div className="miner-game">
      <div className="miner-stats"><span>⏱️ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span><b>💰 {coins}</b></div>
      <div className="mine-scene">
        <div className="mine-lamp">💡</div>
        <div className="mine-cart">🛒<b>{coins}</b></div>
        <div key={hit} className="miner-worker">👷<span>⛏️</span></div>
        <button className="ore-button" onClick={mine} aria-label="点击矿石加速挖金币">
          <span>{ORES[oreIndex]}</span>
          <i><b style={{ width: `${oreHp * 20}%` }} /></i>
          <small>点击开采</small>
        </button>
        <div className="mine-spark spark-one">✦</div><div className="mine-spark spark-two">✧</div>
      </div>
      <div className="miner-tip">矿工每秒自动获得 1 金币 · 击碎矿石额外获得 2–6 金币 · 提前退出不结算</div>
    </div>
  )
}
