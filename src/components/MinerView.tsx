import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { getBookMeta, loadBookWords } from '../data'
import { generateLevels, isLevelSelectionCleared, parseLevelSelection } from '../engine/levels'
import { SFX, unlockAudio } from '../engine/sound'
import { useAppStore, useCurrentUser, useSettings } from '../store/useAppStore'
import type { Word } from '../types'
import { ReplayConfirm } from './ReplayConfirm'

interface Props { levelId: string; onExit: () => void }
type HookMode = 'swinging' | 'dropping' | 'retracting'
type TreasureKind = 'stone' | 'smallGold' | 'largeGold' | 'diamond' | 'ring'
interface Treasure { id: string; kind: TreasureKind; icon: string; label: string; value: number; x: number; y: number; size: number }

const TREASURE: Record<TreasureKind, Omit<Treasure, 'id' | 'x' | 'y'>> = {
  stone: { kind: 'stone', icon: '🪨', label: '石头', value: 1, size: 38 },
  smallGold: { kind: 'smallGold', icon: '🟨', label: '小黄金', value: 10, size: 35 },
  largeGold: { kind: 'largeGold', icon: '🟨', label: '大黄金', value: 20, size: 55 },
  diamond: { kind: 'diamond', icon: '💎', label: '钻石', value: 50, size: 39 },
  ring: { kind: 'ring', icon: '💍', label: '钻戒', value: 100, size: 42 },
}
const KINDS: TreasureKind[] = ['stone', 'smallGold', 'largeGold', 'diamond', 'ring']
const START_POSITIONS = [[12, 44], [34, 39], [62, 43], [85, 38], [22, 65], [49, 61], [76, 66], [10, 84], [38, 83], [67, 86], [90, 81]]

function makeTreasure(index: number, forcedKind?: TreasureKind): Treasure {
  const kind = forcedKind ?? KINDS[Math.floor(Math.random() * KINDS.length)]
  const [baseX, baseY] = START_POSITIONS[index % START_POSITIONS.length]
  return { ...TREASURE[kind], id: `${Date.now()}-${index}-${Math.random()}`, x: Math.max(7, Math.min(93, baseX + Math.random() * 8 - 4)), y: Math.max(35, Math.min(90, baseY + Math.random() * 7 - 3.5)) }
}
function initialTreasures() { return START_POSITIONS.slice(0, 10).map((_, index) => makeTreasure(index, index < KINDS.length ? KINDS[index] : undefined)) }
function hookPoint(angle: number, length: number) { const radians = angle * Math.PI / 180; return { x: 50 + Math.sin(radians) * length * .72, y: 14 + Math.cos(radians) * length } }

export function MinerView({ levelId, onExit }: Props) {
  const selection = useMemo(() => parseLevelSelection(levelId), [levelId])
  const user = useCurrentUser(); const settings = useSettings(); const bookId = user?.activeBookId ?? null; const meta = bookId ? getBookMeta(bookId) : undefined
  const recordGameResult = useAppStore((state) => state.recordGameResult)
  const [bookWords, setBookWords] = useState<Word[]>([]); const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready')
  const [elapsed, setElapsed] = useState(0); const [coins, setCoins] = useState(0); const [angle, setAngle] = useState(-50); const [hookLength, setHookLength] = useState(11)
  const [hookMode, setHookMode] = useState<HookMode>('swinging'); const [treasures, setTreasures] = useState<Treasure[]>(initialTreasures); const [hookedId, setHookedId] = useState<string | null>(null)
  const [rewardPop, setRewardPop] = useState<{ id: number; text: string } | null>(null); const [showReplayConfirm, setShowReplayConfirm] = useState(false)
  const startedAt = useRef(0); const recorded = useRef(false); const swingDirection = useRef(1); const angleRef = useRef(angle); const treasuresRef = useRef(treasures); const hookedIdRef = useRef<string | null>(null)
  const replayRun = useRef(!!user && isLevelSelectionCleared(user.levelProgress, levelId))

  useEffect(() => { angleRef.current = angle }, [angle]); useEffect(() => { treasuresRef.current = treasures }, [treasures]); useEffect(() => { hookedIdRef.current = hookedId }, [hookedId])
  useEffect(() => { if (!bookId) return setBookWords([]); let alive = true; loadBookWords(bookId).then((words) => alive && setBookWords(words)); return () => { alive = false } }, [bookId])
  const level = useMemo(() => meta ? generateLevels({ meta, words: bookWords }, settings).find((item) => item.id === selection.baseLevelId) : undefined, [meta, bookWords, settings, selection.baseLevelId])
  const duration = (level?.index ?? 0) + 1; const durationSeconds = duration * 60; const remaining = Math.max(0, durationSeconds - elapsed); const point = hookPoint(angle, hookLength)

  const begin = () => {
    unlockAudio(); replayRun.current = !!user && isLevelSelectionCleared(user.levelProgress, levelId); recorded.current = false; startedAt.current = Date.now(); swingDirection.current = 1
    setElapsed(0); setCoins(0); setAngle(-50); setHookLength(11); setHookMode('swinging'); setTreasures(initialTreasures()); setHookedId(null); setRewardPop(null); setPhase('playing')
  }
  useEffect(() => { if (phase !== 'playing') return; const timer = window.setInterval(() => { const seconds = Math.min(durationSeconds, Math.floor((Date.now() - startedAt.current) / 1000)); setElapsed(seconds); if (seconds >= durationSeconds) setPhase('over') }, 250); return () => clearInterval(timer) }, [phase, durationSeconds])
  useEffect(() => {
    if (phase !== 'playing') return
    const motion = window.setInterval(() => {
      if (hookMode === 'swinging') { setAngle((current) => { let next = current + swingDirection.current * 1.8; if (next >= 62) { next = 62; swingDirection.current = -1 } if (next <= -62) { next = -62; swingDirection.current = 1 } return next }); return }
      if (hookMode === 'dropping') {
        setHookLength((current) => { const next = Math.min(96, current + 2.8); const hook = hookPoint(angleRef.current, next); const caught = treasuresRef.current.find((item) => Math.hypot(item.x - hook.x, item.y - hook.y) < Math.max(5, item.size / 8)); if (caught) { setHookedId(caught.id); hookedIdRef.current = caught.id; setHookMode('retracting'); SFX.hit() } else if (next >= 96 || hook.x <= 2 || hook.x >= 98 || hook.y >= 98) setHookMode('retracting'); return next })
        return
      }
      setHookLength((current) => { const caught = treasuresRef.current.find((item) => item.id === hookedIdRef.current); const speed = caught?.kind === 'stone' || caught?.kind === 'largeGold' ? 1.35 : 2.5; const next = Math.max(11, current - speed); if (next <= 11) { if (caught) { setCoins((value) => value + caught.value); setRewardPop({ id: Date.now(), text: `${caught.label} +${caught.value}` }); setTreasures((items) => [...items.filter((item) => item.id !== caught.id), makeTreasure(Math.floor(Math.random() * START_POSITIONS.length))]); SFX.pop() } setHookedId(null); hookedIdRef.current = null; setHookMode('swinging') } return next })
    }, 30)
    return () => clearInterval(motion)
  }, [phase, hookMode])
  useEffect(() => { if (phase !== 'over' || recorded.current || !level || !meta) return; recorded.current = true; const reward = replayRun.current ? Math.min(10, coins) : coins; recordGameResult({ levelId, bookId: meta.id, score: coins, correct: 0, wrong: 0, maxCombo: 0, durationMs: Date.now() - startedAt.current, coinsEarned: reward, passed: true, playedAt: Date.now(), targetScore: durationSeconds }); SFX.win() }, [phase, level, meta, levelId, coins, durationSeconds, recordGameResult])

  if (!meta || !level) return <div className="empty">金币矿洞加载中…</div>
  if (phase === 'ready') return <div className="miner-ready"><div className="miner-title-art">👷<span>🪝</span></div><h2>{level.name} · 黄金矿工</h2><p>看准钩子方向，点击屏幕放钩。钩中宝物后会自动拉回，越珍贵的宝物金币越多！</p><div className="miner-prize-list"><span>🪨 1</span><span>小🟨 10</span><span>大🟨 20</span><span>💎 50</span><span>💍 100</span></div><div className="miner-time-card">本关挖矿时间 <b>{duration} 分钟</b></div><button className="btn miner-start" onClick={begin}>开始挖金币</button><button className="btn ghost" onClick={onExit}>返回关卡</button></div>
  if (phase === 'over') { const reward = replayRun.current ? Math.min(10, coins) : coins; return <div className="miner-result"><div>🏆💰🪝</div><h2>满载而归！</h2><p>共钩到价值 {coins} 的宝物，本次到账 +{reward}{replayRun.current ? '（重玩上限 10）' : ''}</p><div className="btn-row"><button className="btn ghost" onClick={onExit}>返回关卡</button><button className="btn" onClick={() => setShowReplayConfirm(true)}>再挖一次</button></div><ReplayConfirm open={showReplayConfirm} onCancel={() => setShowReplayConfirm(false)} onContinue={() => { setShowReplayConfirm(false); begin() }} /></div> }
  return <div className="miner-game"><div className="miner-stats"><span>⏱️ {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}</span><b>💰 {coins}</b></div><button className="mine-scene hook-mine" onClick={() => hookMode === 'swinging' && setHookMode('dropping')} aria-label="点击放下钩子"><div className="miner-platform"><span>👷</span><small>{hookMode === 'swinging' ? '点击放钩' : hookMode === 'dropping' ? '放钩中…' : '拉回中…'}</small></div><div className="hook-rope" style={{ height: `${hookLength}%`, transform: `translateX(-50%) rotate(${angle}deg)` }}><i>🪝</i></div>{treasures.map((item) => { const hooked = item.id === hookedId; const style = { left: `${hooked ? point.x : item.x}%`, top: `${hooked ? point.y : item.y}%`, fontSize: item.size } as CSSProperties; return <span key={item.id} className={`mine-treasure ${item.kind}${hooked ? ' hooked' : ''}`} style={style}><b>{item.icon}</b><small>{item.value}</small></span> })}{rewardPop && <span key={rewardPop.id} className="mine-reward-pop">{rewardPop.text}</span>}<span className="mine-glint g1">✦</span><span className="mine-glint g2">✧</span></button><div className="miner-tip">点击矿洞放钩 · 💍 100 · 💎 50 · 大黄金 20 · 小黄金 10 · 石头 1 · 提前退出不结算</div></div>
}
