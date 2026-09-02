import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useCurrentUser, useAppStore, useSettings } from '../store/useAppStore'
import { getBookMeta, loadBookWords } from '../data'
import { generateLevels, isLevelSelectionCleared, parseLevelSelection, wordsForSublevel } from '../engine/levels'
import { aggregateEffects, describeEffects, getItem, RARITY_COLOR } from '../engine/items'
import { coinsForGame } from '../engine/economy'
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

interface ActiveSlot {
  hole: number
  word: Word
}

export function GameView({ levelId, onExit }: Props) {
  const selection = useMemo(() => parseLevelSelection(levelId), [levelId])
  const user = useCurrentUser()
  const recordGameResult = useAppStore((s) => s.recordGameResult)
  const markWrong = useAppStore((s) => s.markWrong)
  const markRight = useAppStore((s) => s.markRight)
  const settings = useSettings()
  const replayRun = useRef(!!user && isLevelSelectionCleared(user.levelProgress, levelId))
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

  const effects = useMemo(
    () => aggregateEffects(user?.equipped ?? [null, null, null]),
    [user?.equipped],
  )

  const holeCount = Math.max(3, Math.min(9, settings.gameHoles))
  const totalTime = settings.gameDuration + effects.extraTime
  const visibleMs = Math.max(
    400,
    Math.round(settings.gameMoleVisible * (1 + effects.slowDown / 100)),
  )
  const gapMs = Math.max(0, settings.gameWaveGap)

  const [phase, setPhase] = useState<'ready' | 'playing' | 'over'>('ready')
  const [timeLeft, setTimeLeft] = useState(totalTime)
  const [score, setScore] = useState(0)
  const [combo, setCombo] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [shield, setShield] = useState(effects.shield)
  const [target, setTarget] = useState<Word | null>(null)
  const [active, setActive] = useState<ActiveSlot[]>([])
  const [flash, setFlash] = useState<{ hole: number; kind: 'hit' | 'miss' } | null>(null)
  const [floaters, setFloaters] = useState<{ id: number; hole: number; text: string }[]>([])
  const [pulse, setPulse] = useState(0)

  const targetRef = useRef<Word | null>(null)
  const startedAt = useRef(Date.now())
  const [wave, setWave] = useState(0)
  const floaterSeq = useRef(0)
  const advanceTimer = useRef<number | null>(null)

  const addFloater = useCallback((hole: number, text: string) => {
    const id = ++floaterSeq.current
    setFloaters((f) => [...f, { id, hole, text }])
    window.setTimeout(() => setFloaters((f) => f.filter((x) => x.id !== id)), 700)
  }, [])

  useEffect(() => {
    return () => {
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
    }
  }, [])

  const pickDistractor = useCallback(
    (excludeId: string): Word => {
      const pool = words.filter((w) => w.id !== excludeId)
      return (pool.length ? pool : words)[Math.floor(Math.random() * (pool.length || words.length))]
    },
    [words],
  )

  useEffect(() => {
    if (phase !== 'playing') return
    const t = pickTargetWord()
    targetRef.current = t
    setTarget(t)

    const slotsPerWave = Math.min(3, holeCount)
    const holes = shuffle(Array.from({ length: holeCount }, (_, i) => i)).slice(0, slotsPerWave)
    const targetHole = holes[Math.floor(Math.random() * holes.length)]
    setActive(
      holes.map((hole) => ({
        hole,
        word: hole === targetHole ? t : pickDistractor(t.id),
      })),
    )
    setFlash(null)
    SFX.pop()

    const hideTimer = setTimeout(() => setActive([]), visibleMs)
    const nextTimer = setTimeout(() => setWave((w) => w + 1), visibleMs + gapMs)
    return () => {
      clearTimeout(hideTimer)
      clearTimeout(nextTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wave, phase])

  function pickTargetWord(): Word {
    const idx = Math.floor(Math.random() * words.length)
    return words[idx]
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
  }, [phase])

  const finish = useCallback(() => {
    if (!level || !user || !meta) return
    const passed = score >= level.targetScore
    const coins = coinsForGame(settings, score, wrong, passed, replayRun.current)
    recordGameResult({
      levelId,
      bookId: meta.id,
      score,
      correct,
      wrong,
      maxCombo,
      durationMs: Date.now() - startedAt.current,
      coinsEarned: coins,
      passed,
      playedAt: Date.now(),
      targetScore: level.targetScore,
    })
  }, [level, levelId, user, meta, score, correct, wrong, maxCombo, recordGameResult])

  useEffect(() => {
    if (phase === 'over') {
      finish()
      if (score >= (level?.targetScore ?? 0)) SFX.win()
      else SFX.lose()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])

  const handleHit = (slot: ActiveSlot) => {
    if (phase !== 'playing') return
    const isRight = targetRef.current?.id === slot.word.id
    speak(slot.word.word)

    if (isRight) {
      const comboMult = 1 + Math.min(combo, 12) * 0.1 * (1 + effects.comboBonus / 100)
      const pts = Math.round(settings.scorePerHit * comboMult * (1 + effects.scoreBonus / 100))
      setScore((s) => s + pts)
      setCombo((c) => c + 1)
      setMaxCombo((m) => Math.max(m, combo + 1))
      setCorrect((c) => c + 1)
      setFlash({ hole: slot.hole, kind: 'hit' })
      setPulse((p) => p + 1)
      SFX.hit()
      addFloater(slot.hole, `+${pts}`)
      markRight(slot.word.id)
      if (advanceTimer.current) window.clearTimeout(advanceTimer.current)
      advanceTimer.current = window.setTimeout(() => setWave((w) => w + 1), 260)
    } else {
      if (shield > 0) {
        setShield((s) => s - 1)
        toast('护盾抵消了这次失误')
      } else {
        setWrong((w) => w + 1)
        setScore((s) => Math.max(0, s - settings.scorePenalty))
      }
      setCombo(0)
      setFlash({ hole: slot.hole, kind: 'miss' })
      SFX.miss()
      addFloater(slot.hole, slot.word.word)
      markWrong(slot.word.id, bookId ?? slot.word.id.split('-')[0])
      window.setTimeout(() => setFlash(null), 340)
    }
  }

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
          {level.name}
        </div>
        <div className="card center">
          <div style={{ fontSize: 15, fontWeight: 500 }}>{meta.name}</div>
          <div className="tiny muted" style={{ marginTop: 8 }}>
            本关 {level.wordIds.length} 个词 · 限时 {totalTime} 秒
          </div>
          <div style={{ fontSize: 32, fontWeight: 600, marginTop: 14, color: 'var(--primary)' }}>
            {level.targetScore} 分
          </div>
          <div className="tiny muted">达到这个分数即可通关</div>

          <div className="effect-chips" style={{ justifyContent: 'center' }}>
            <span className="chip">答对 +{settings.scorePerHit} 分起</span>
            <span className="chip">连击越高分越多</span>
            <span className="chip">
              {settings.scorePenalty > 0 ? `答错 -${settings.scorePenalty} 分` : '答错不扣分'}
            </span>
          </div>
        </div>

        {equipped.length > 0 && (
          <div className="card">
            <div style={{ fontSize: 14, fontWeight: 500 }}>已装备</div>
            {equipped.map((it) => (
              <div
                key={it!.id}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  marginTop: 10,
                  fontSize: 13,
                }}
              >
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
          <button
            className="btn"
            onClick={() => {
              unlockAudio()
              replayRun.current = !!user && isLevelSelectionCleared(user.levelProgress, levelId)
              startedAt.current = Date.now()
              setPhase('playing')
              setWave((w) => w + 1)
            }}
          >
            开始挑战
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'over') {
    const passed = score >= level.targetScore
    const coins = coinsForGame(settings, score, wrong, passed, replayRun.current)
    return (
      <div className="result-panel">
        <div className="tiny muted">{level.name}</div>
        <div className="result-score" style={{ color: passed ? 'var(--success)' : 'var(--danger)' }}>
          {score}
        </div>
        <div style={{ fontSize: 16, fontWeight: 500, marginTop: 4 }}>
          {passed ? '通关成功' : `还差 ${level.targetScore - score} 分`}
        </div>
        <div className="stars" style={{ fontSize: 20, marginTop: 6 }}>
          {'★'.repeat(
            score < level.targetScore
              ? 0
              : score >= Math.round(level.targetScore * 1.6)
                ? 3
                : score >= Math.round(level.targetScore * 1.3)
                  ? 2
                  : 1,
          )}
          {'☆'.repeat(
            3 -
              (score < level.targetScore
                ? 0
                : score >= Math.round(level.targetScore * 1.6)
                  ? 3
                  : score >= Math.round(level.targetScore * 1.3)
                    ? 2
                    : 1),
          )}
        </div>

        <div className="stat-grid" style={{ marginTop: 18 }}>
          <div className="stat">
            <div className="v" style={{ color: 'var(--success)' }}>
              {correct}
            </div>
            <div className="k">答对</div>
          </div>
          <div className="stat">
            <div className="v" style={{ color: 'var(--danger)' }}>
              {wrong}
            </div>
            <div className="k">答错</div>
          </div>
          <div className="stat">
            <div className="v" style={{ color: 'var(--gold)' }}>
              {maxCombo}
            </div>
            <div className="k">最高连击</div>
          </div>
        </div>

        <div
          className="card"
          style={{ marginTop: 14, background: 'var(--gold-soft)', borderColor: 'rgba(186,117,23,.25)' }}
        >
          <div style={{ fontSize: 20, fontWeight: 600, color: '#633806' }}>+{coins} 金币</div>
          {wrong === 0 && passed && (
            <div className="tiny" style={{ color: '#633806' }}>
              全对奖励已计入
            </div>
          )}
        </div>

        <div className="btn-row" style={{ marginTop: 14 }}>
          <button className="btn ghost" onClick={onExit}>
            返回关卡
          </button>
          <button
            className="btn"
            onClick={() => {
              replayRun.current = !!user && isLevelSelectionCleared(user.levelProgress, levelId)
              setScore(0)
              setCombo(0)
              setCorrect(0)
              setWrong(0)
              setMaxCombo(0)
              setShield(effects.shield)
              setTimeLeft(totalTime)
              setActive([])
              startedAt.current = Date.now()
              setPhase('playing')
              setWave((w) => w + 1)
            }}
          >
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

      <div className="target-word" key={pulse}>
        <div className="label">找出这个意思对应的单词</div>
        <div className="val">{target?.meaning ?? '准备中'}</div>
      </div>

      <div className="hole-grid">
        {Array.from({ length: holeCount }, (_, i) => {
          const slot = active.find((a) => a.hole === i)
          const up = !!slot
          const flashKind = flash?.hole === i ? flash.kind : null
          const floater = floaters.find((f) => f.hole === i)
          return (
            <button
              key={i}
              className="hole"
              onClick={() => slot && handleHit(slot)}
              disabled={!up}
              aria-label={up ? slot.word.word : '空洞'}
            >
              {up && (
                <span className={`mole up${flashKind ? ` ${flashKind}` : ''}`}>{slot.word.word}</span>
              )}
              {floater && <span className="floater">{floater.text}</span>}
            </button>
          )
        })}
      </div>

      <div className="game-stats">
        <span>
          连击 {combo}
          {effects.comboBonus > 0 && <span style={{ color: 'var(--gold)' }}> +{effects.comboBonus}%</span>}
        </span>
        <span>对 {correct}</span>
        <span>错 {wrong}</span>
        {shield > 0 && (
          <span style={{ color: 'var(--primary)' }}>
            护盾 {shield}
          </span>
        )}
      </div>
    </div>
  )
}
