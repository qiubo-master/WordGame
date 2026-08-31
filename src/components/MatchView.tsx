import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentUser, useAppStore, useSettings } from '../store/useAppStore'
import { getBookMeta, loadBookWords } from '../data'
import { generateLevels, parseLevelSelection, wordsForSublevel } from '../engine/levels'
import {
  aggregateEffects,
  describeEffects,
  getItem,
  RARITY_COLOR,
  type AggregatedEffects,
} from '../engine/items'
import { coinsForGame } from '../engine/economy'
import { matchTargetFor } from '../engine/settings'
import { speak } from '../engine/speech'
import { shuffle } from '../engine/random'
import { SFX, unlockAudio } from '../engine/sound'
import type { Word } from '../types'
import { Icon } from './Icon'
import { toast } from './Toast'

interface Props {
  levelId: string
  onExit: () => void
}

interface Card {
  id: string
  wordId: string
  side: 'en' | 'zh'
  text: string
  matched: boolean
}

export function MatchView({ levelId, onExit }: Props) {
  const selection = useMemo(() => parseLevelSelection(levelId), [levelId])
  const user = useCurrentUser()
  const recordGameResult = useAppStore((s) => s.recordGameResult)
  const markWrong = useAppStore((s) => s.markWrong)
  const markRight = useAppStore((s) => s.markRight)
  const consumeEquipped = useAppStore((s) => s.consumeEquipped)
  const settings = useSettings()
  const bookId = user?.activeBookId ?? null
  const meta = bookId ? getBookMeta(bookId) : undefined
  const [bookWords, setBookWords] = useState<Word[]>([])
  useEffect(() => {
    if (!bookId) {
      setBookWords([])
      return
    }
    let alive = true
    loadBookWords(bookId).then((w) => {
      if (alive) setBookWords(w)
    })
    return () => {
      alive = false
    }
  }, [bookId])

  const level = useMemo(
    () => (meta ? generateLevels({ meta, words: bookWords }, settings).find((l) => l.id === selection.baseLevelId) : undefined),
    [meta, selection.baseLevelId, bookWords, settings.unitSize, settings.unlockThreshold, settings.levelBaseScore, settings.levelScoreStep, settings.levelScoreMax],
  )

  const wordIndex = useMemo(() => new Map(bookWords.map((w) => [w.id, w])), [bookWords])
  const words = useMemo<Word[]>(() => {
    if (!meta || !level) return []
    return wordsForSublevel(level.wordIds, selection.sublevel).map((id) => wordIndex.get(id)).filter((w): w is Word => !!w)
  }, [meta, level, selection.sublevel, wordIndex])

  const pairCount = Math.max(1, Math.min(6, words.length))
  const target = matchTargetFor({ ...settings, matchPairs: pairCount })

  const effects = useMemo(
    () => aggregateEffects(user?.equipped ?? [null, null, null]),
    [user?.equipped],
  )
  const [sessionEffects, setSessionEffects] = useState<AggregatedEffects | null>(null)
  const eff = sessionEffects ?? effects

  const totalTime = settings.gameDuration + eff.extraTime

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready')
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [matchedCount, setMatchedCount] = useState(0)
  const [cards, setCards] = useState<Card[]>([])
  const [flipped, setFlipped] = useState<string[]>([])
  const [resolving, setResolving] = useState(false)
  const [lastReward, setLastReward] = useState<number | null>(null)
  const shieldRef = useRef(eff.shield)
  const resolveTimerRef = useRef<number | null>(null)
  const startedAt = useRef(Date.now())

  const start = () => {
    const pool = shuffle(words).slice(0, pairCount)
    const list: Card[] = []
    for (const word of pool) {
      list.push({ id: `${word.id}-en`, wordId: word.id, side: 'en', text: word.word, matched: false })
      list.push({ id: `${word.id}-zh`, wordId: word.id, side: 'zh', text: word.meaning, matched: false })
    }
    setCards(shuffle(list))
    setFlipped([])
    setResolving(false)
    setLastReward(null)
    setScore(0)
    setCombo(0)
    setMaxCombo(0)
    setWrong(0)
    setMatchedCount(0)
    shieldRef.current = eff.shield
    setTimeLeft(totalTime)
    startedAt.current = Date.now()
    setPhase('playing')
  }

  useEffect(() => () => {
    if (resolveTimerRef.current !== null) window.clearTimeout(resolveTimerRef.current)
  }, [])

  const begin = () => {
    unlockAudio()
    consumeEquipped()
    setSessionEffects(effects)
    start()
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const tick = setInterval(() => {
      setTimeLeft((t) => {
        const next = Math.round((t - 0.1) * 10) / 10
        if (next <= 0) {
          setPhase('over')
          return 0
        }
        return next
      })
    }, 100)
    return () => clearInterval(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const flip = (card: Card) => {
    if (phase !== 'playing' || card.matched || flipped.includes(card.id)) return
    if (resolving || flipped.length >= 2) return
    const next = [...flipped, card.id]
    setFlipped(next)
    if (next.length < 2) return
    setResolving(true)
    const a = cards.find((c) => c.id === next[0])!
    const b = cards.find((c) => c.id === next[1])!
    if (a.wordId === b.wordId && a.side !== b.side) {
      setCards((cs) => cs.map((c) => (c.id === a.id || c.id === b.id ? { ...c, matched: true } : c)))
      const comboMult = 1 + Math.min(combo, 12) * 0.1 * (1 + eff.comboBonus / 100)
      const pts = Math.round(settings.matchScore * comboMult * (1 + eff.scoreBonus / 100))
      setScore((s) => s + pts)
      setLastReward(pts)
      setCombo((c) => c + 1)
      setMaxCombo((m) => Math.max(m, combo + 1))
      setMatchedCount((m) => m + 1)
      markRight(a.wordId)
      const matchedWord = words.find((word) => word.id === a.wordId)
      if (matchedWord) speak(matchedWord.word)
      SFX.hit()
      resolveTimerRef.current = window.setTimeout(() => {
        setFlipped([])
        setResolving(false)
        setLastReward(null)
        if (matchedCount + 1 >= pairCount) setPhase('over')
      }, 420)
    } else {
      if (shieldRef.current > 0) {
        shieldRef.current -= 1
        toast('护盾抵消了这次失误')
      } else {
        setWrong((w) => w + 1)
      }
      setCombo(0)
      markWrong(a.wordId, bookId ?? a.wordId.split('-')[0])
      markWrong(b.wordId, bookId ?? b.wordId.split('-')[0])
      if (a.wordId !== b.wordId) speak(b.text)
      SFX.miss()
      resolveTimerRef.current = window.setTimeout(() => {
        setFlipped([])
        setResolving(false)
      }, 650)
    }
  }

  const finish = useCallback(
    () => {
      if (!level || !user || !meta) return
      const passed = score >= target
      const coins = coinsForGame(settings, score, wrong, passed)
      recordGameResult({
        levelId: level.id,
        bookId: meta.id,
        score,
        correct: matchedCount,
        wrong,
        maxCombo,
        durationMs: Date.now() - startedAt.current,
        coinsEarned: coins,
        passed,
        playedAt: Date.now(),
        targetScore: target,
      })
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [level, user, meta, score, matchedCount, wrong, maxCombo],
  )

  useEffect(() => {
    if (phase === 'over') {
      finish()
      if (score >= target) SFX.win()
      else SFX.lose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  if (!meta) {
    return (
      <div className="empty">
        <div>还没有选词库</div>
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={onExit}>
          返回
        </button>
      </div>
    )
  }

  if (bookWords.length === 0) {
    return (
      <div className="empty">
        <div>加载词库中…</div>
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={onExit}>
          返回
        </button>
      </div>
    )
  }

  if (!level || words.length < 2) {
    return (
      <div className="empty">
        <div>这一关还没有足够的词</div>
        <button className="btn ghost" style={{ marginTop: 14 }} onClick={onExit}>
          返回
        </button>
      </div>
    )
  }

  if (phase === 'ready') {
    const equipped = (user?.equipped ?? []).filter(Boolean).map((id) => getItem(id!)).filter(Boolean)
    return (
      <div>
        <div className="section-title" style={{ marginTop: 4 }}>
          {level.name} · 消消乐
        </div>
        <div className="card center">
          <div style={{ fontSize: 15, fontWeight: 500 }}>{meta.name}</div>
          <div className="tiny muted" style={{ marginTop: 8 }}>
            {pairCount} 对词 · 限时 {totalTime} 秒
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, marginTop: 14, color: 'var(--primary)' }}>
            {target} 分
          </div>
          <div className="tiny muted">全部配对成功即可通关</div>
          <div className="effect-chips" style={{ justifyContent: 'center' }}>
            <span className="chip">配对成功 +{settings.matchScore} 分</span>
            <span className="chip">
              配错不扣分
            </span>
          </div>
        </div>

        {equipped.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 500 }}>已装备（开局消耗）</div>
            {equipped.map((it) => (
              <div key={it!.id} style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10, fontSize: 13 }}>
                <Icon name={it!.icon} size={18} color={RARITY_COLOR[it!.rarity]} />
                <span style={{ fontWeight: 500 }}>{it!.name}</span>
                <span className="muted tiny">{describeEffects(it!)}</span>
              </div>
            ))}
          </div>
        )}

        <div className="btn-row">
          <button className="btn ghost" onClick={onExit}>
            返回
          </button>
          <button className="btn" onClick={begin}>
            开始挑战
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'over') {
    const passed = score >= target
    const coins = coinsForGame(settings, score, wrong, passed)
    return (
      <div className="result-panel">
        <div className="tiny muted">{level.name} · 消消乐</div>
        <div className="result-score" style={{ color: passed ? 'var(--success)' : 'var(--danger)' }}>
          {score}
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>
          {passed ? '通关成功' : `还差 ${target - score} 分`}
        </div>
        <div className="stars" style={{ fontSize: 20, marginTop: 6 }}>
          {'★'.repeat(
            score < target ? 0 : score >= Math.round(target * 1.6) ? 3 : score >= Math.round(target * 1.3) ? 2 : 1,
          )}
          {'☆'.repeat(
            3 - (score < target ? 0 : score >= Math.round(target * 1.6) ? 3 : score >= Math.round(target * 1.3) ? 2 : 1),
          )}
        </div>
        <div className="stat-grid" style={{ marginTop: 18 }}>
          <div className="stat">
            <div className="v" style={{ color: 'var(--success)' }}>
              {matchedCount}/{pairCount}
            </div>
            <div className="k">配对</div>
          </div>
          <div className="stat">
            <div className="v" style={{ color: 'var(--danger)' }}>
              {wrong}
            </div>
            <div className="k">配错</div>
          </div>
          <div className="stat">
            <div className="v" style={{ color: 'var(--gold)' }}>
              {maxCombo}
            </div>
            <div className="k">最高连击</div>
          </div>
        </div>
        <div className="card" style={{ marginTop: 14, background: 'var(--gold-soft)', borderColor: 'rgba(186,117,23,.25)' }}>
          <div style={{ fontSize: 20, fontWeight: 600, color: '#633806' }}>+{coins} 金币</div>
        </div>
        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={onExit}>
            返回关卡
          </button>
          <button className="btn" onClick={begin}>
            再来一局
          </button>
        </div>
      </div>
    )
  }

  const pct = Math.max(0, Math.min(100, (timeLeft / totalTime) * 100))

  return (
    <div>
      <div className="game-head">
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 54 }}>{timeLeft.toFixed(1)}s</span>
        <div className="game-timer">
          <div className={`game-timer-fill${timeLeft < 10 ? ' low' : ''}`} style={{ width: `${pct}%` }} />
        </div>
        <span style={{ fontSize: 15, fontWeight: 600, minWidth: 54, textAlign: 'right' }}>
          {score} 分
        </span>
      </div>

      <div className="tiny muted center" style={{ margin: '4px 0 10px' }}>
        连续点两张牌完成配对 · 配错后会自动翻回，可继续挑战
      </div>

      {lastReward !== null && <div className="match-reward">配对成功 +{lastReward} 分</div>}

      <div className="match-grid">
        {cards.map((c) => (
            <button
              key={c.id}
              data-wordid={c.wordId}
              className={`match-card${flipped.includes(c.id) ? ' flipped' : ''}${c.matched ? ' matched' : ''}`}
              onClick={() => flip(c)}
              disabled={c.matched || resolving}
            >
            <span className="face front">?</span>
            <span className="face back">
              <span className="pos">{c.side === 'en' ? 'EN' : '中'}</span>
              {c.text}
            </span>
          </button>
        ))}
      </div>

      <div className="game-stats">
        <span>配对 {matchedCount}/{pairCount}</span>
        <span>连击 {combo}</span>
        <span>错 {wrong}</span>
        {shieldRef.current > 0 && <span style={{ color: 'var(--primary)' }}>护盾 {shieldRef.current}</span>}
      </div>
    </div>
  )
}
