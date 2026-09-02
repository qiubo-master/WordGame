import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { getBookMeta, loadBookWords } from '../data'
import { coinsForGame } from '../engine/economy'
import { generateLevels, isLevelSelectionCleared, parseLevelSelection, wordsForSublevel } from '../engine/levels'
import { shuffle } from '../engine/random'
import { SFX, unlockAudio } from '../engine/sound'
import { speak } from '../engine/speech'
import { useAppStore, useCurrentUser, useSettings } from '../store/useAppStore'
import type { Word } from '../types'
import { ReplayConfirm } from './ReplayConfirm'

interface Props { levelId: string; onExit: () => void }
interface Soldier { id: number; side: 'player' | 'enemy'; x: number; hp: number; maxHp: number }

function optionsFor(answer: Word, pool: Word[]): Word[] {
  const out = [answer]
  for (const word of shuffle(pool)) {
    if (out.length >= 4) break
    if (word.id !== answer.id && !out.some((item) => item.meaning === word.meaning)) out.push(word)
  }
  return shuffle(out)
}

export function BattleView({ levelId, onExit }: Props) {
  const selection = useMemo(() => parseLevelSelection(levelId), [levelId])
  const user = useCurrentUser()
  const settings = useSettings()
  const replayRun = useRef(!!user && isLevelSelectionCleared(user.levelProgress, levelId))
  const recordGameResult = useAppStore((s) => s.recordGameResult)
  const markWrong = useAppStore((s) => s.markWrong)
  const markRight = useAppStore((s) => s.markRight)
  const bookId = user?.activeBookId ?? null
  const meta = bookId ? getBookMeta(bookId) : undefined
  const [bookWords, setBookWords] = useState<Word[]>([])
  useEffect(() => {
    if (!bookId) return setBookWords([])
    let alive = true
    loadBookWords(bookId).then((words) => alive && setBookWords(words))
    return () => { alive = false }
  }, [bookId])

  const level = useMemo(() => meta
    ? generateLevels({ meta, words: bookWords }, settings).find((item) => item.id === selection.baseLevelId)
    : undefined, [meta, bookWords, selection.baseLevelId, settings])
  const words = useMemo(() => {
    const index = new Map(bookWords.map((word) => [word.id, word]))
    return level ? wordsForSublevel(level.wordIds, selection.sublevel).map((id) => index.get(id)).filter((word): word is Word => !!word) : []
  }, [bookWords, level, selection.sublevel])

  const [phase, setPhase] = useState<'ready' | 'playing' | 'won' | 'lost'>('ready')
  const [soldiers, setSoldiers] = useState<Soldier[]>([])
  const [playerBaseHp, setPlayerBaseHp] = useState(settings.battlePlayerHp)
  const [enemyBaseHp, setEnemyBaseHp] = useState(settings.battleEnemyHp)
  const [score, setScore] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [wrong, setWrong] = useState(0)
  const [combo, setCombo] = useState(0)
  const [maxCombo, setMaxCombo] = useState(0)
  const [questionIndex, setQuestionIndex] = useState(0)
  const [answered, setAnswered] = useState<string | null>(null)
  const [message, setMessage] = useState('')
  const [showReplayConfirm, setShowReplayConfirm] = useState(false)
  const seq = useRef(0)
  const startedAt = useRef(Date.now())
  const recorded = useRef(false)

  const current = words.length ? words[questionIndex % words.length] : null
  const choices = useMemo(() => current ? optionsFor(current, words) : [], [current, words])
  const spawn = useCallback((side: Soldier['side']) => {
    const hp = side === 'player' ? 34 : 28
    setSoldiers((list) => [...list, { id: ++seq.current, side, x: side === 'player' ? 10 : 90, hp, maxHp: hp }])
  }, [])

  const begin = () => {
    unlockAudio()
    replayRun.current = !!user && isLevelSelectionCleared(user.levelProgress, levelId)
    recorded.current = false
    startedAt.current = Date.now()
    setSoldiers([]); setPlayerBaseHp(settings.battlePlayerHp); setEnemyBaseHp(settings.battleEnemyHp)
    setScore(0); setCorrect(0); setWrong(0); setCombo(0); setMaxCombo(0)
    setQuestionIndex(Math.floor(Math.random() * Math.max(1, words.length)))
    setAnswered(null); setMessage('答对题目，召唤黄金小兵！'); setPhase('playing')
  }

  useEffect(() => {
    if (phase !== 'playing') return
    const enemyTimer = window.setInterval(() => spawn('enemy'), settings.battleEnemyInterval)
    const first = window.setTimeout(() => spawn('enemy'), 900)
    return () => { window.clearInterval(enemyTimer); window.clearTimeout(first) }
  }, [phase, spawn])

  useEffect(() => {
    if (phase !== 'playing') return
    const battle = window.setInterval(() => {
      setSoldiers((previous) => {
        const next = previous.map((unit) => ({ ...unit }))
        const players = next.filter((unit) => unit.side === 'player' && unit.hp > 0)
        const enemies = next.filter((unit) => unit.side === 'enemy' && unit.hp > 0)
        for (const unit of next) {
          if (unit.hp <= 0) continue
          const opponents = unit.side === 'player' ? enemies : players
          const target = opponents.filter((other) => unit.side === 'player' ? other.x >= unit.x : other.x <= unit.x)
            .sort((a, b) => Math.abs(a.x - unit.x) - Math.abs(b.x - unit.x))[0]
          if (target && Math.abs(target.x - unit.x) < 4.5) {
            target.hp -= unit.side === 'player' ? settings.battlePlayerDmg : settings.battleEnemyDmg
          } else {
            unit.x += unit.side === 'player' ? 0.72 : -0.58
          }
          if (unit.side === 'player' && unit.x >= 94) { setEnemyBaseHp((hp) => Math.max(0, hp - settings.battlePlayerDmg)); unit.x = 91 }
          if (unit.side === 'enemy' && unit.x <= 6) { setPlayerBaseHp((hp) => Math.max(0, hp - settings.battleEnemyDmg)); unit.x = 9 }
        }
        return next.filter((unit) => unit.hp > 0)
      })
    }, 120)
    return () => window.clearInterval(battle)
  }, [phase])

  useEffect(() => {
    if (phase !== 'playing') return
    if (enemyBaseHp <= 0) { setPhase('won'); SFX.win() }
    else if (playerBaseHp <= 0) { setPhase('lost'); SFX.lose() }
  }, [enemyBaseHp, playerBaseHp, phase])

  useEffect(() => {
    if ((phase !== 'won' && phase !== 'lost') || recorded.current || !level || !meta) return
    recorded.current = true
    const passed = phase === 'won'
    recordGameResult({ levelId, bookId: meta.id, score, correct, wrong, maxCombo,
      durationMs: Date.now() - startedAt.current, coinsEarned: coinsForGame(settings, score, wrong, passed, replayRun.current),
      passed, playedAt: Date.now(), targetScore: level.targetScore })
  }, [phase, level, levelId, meta, score, correct, wrong, maxCombo, recordGameResult, settings])

  const answer = (choice: Word) => {
    if (!current || answered) return
    unlockAudio(); setAnswered(choice.id)
    if (choice.id === current.id) {
      const nextCombo = combo + 1
      const points = 12 + Math.min(18, nextCombo * 2)
      setScore((value) => value + points); setCorrect((value) => value + 1)
      setCombo(nextCombo); setMaxCombo((value) => Math.max(value, nextCombo)); markRight(current.id); speak(current.word)
      setMessage(`答对！黄金小兵出击 · +${points} 分`); spawn('player'); SFX.hit()
    } else {
      setWrong((value) => value + 1); setCombo(0); markWrong(current.id, bookId ?? '')
      setMessage(`正确答案：${current.meaning} · 敌军增援！`); spawn('enemy'); speak(current.word); SFX.miss()
    }
    window.setTimeout(() => { setQuestionIndex((value) => value + 1); setAnswered(null) }, 650)
  }

  if (!meta || bookWords.length === 0 || !level || words.length < 4) return <div className="empty">加载战场中…</div>
  if (phase === 'ready') return <div className="battle-ready">
    <div className="wing-emblem gold"><i /><i /><b>⚔</b></div>
    <div className="section-title center">{level.name} · 单词兵团</div>
    <h2>守护黄金之翼</h2>
    <p>每答对一道题召唤一个黄金小兵。小兵会自动前进、交战并攻击敌方蓝翼基地。</p>
    <button className="btn battle-start" onClick={begin}>开始出征</button>
    <button className="btn ghost" onClick={onExit}>返回关卡</button>
  </div>

  if (phase === 'won' || phase === 'lost') {
    const won = phase === 'won'; const coins = coinsForGame(settings, score, wrong, won, replayRun.current)
    return <div className={`battle-result ${won ? 'victory' : 'defeat'}`}>
      <div className="result-crown">{won ? '🏆' : '🛡️'}</div><h2>{won ? '攻城胜利！' : '基地失守'}</h2>
      <p>{won ? '黄金军团摧毁了蓝翼基地' : '多答对几题，召唤更多小兵再战'}</p>
      <div className="battle-result-score">{score} 分 · +{coins} 金币</div>
      <div className="btn-row"><button className="btn ghost" onClick={onExit}>返回</button><button className="btn" onClick={() => user && isLevelSelectionCleared(user.levelProgress, levelId) ? setShowReplayConfirm(true) : begin()}>再战一局</button></div>
      <ReplayConfirm open={showReplayConfirm} onCancel={() => setShowReplayConfirm(false)} onContinue={() => { setShowReplayConfirm(false); begin() }} />
    </div>
  }

  return <div className="battle-game">
    <div className="battle-sky"><span className="cloud c1" /><span className="cloud c2" />
      <div className="battle-base player-base"><div className="wing-base gold-wing"><i /><i /><b>★</b></div><div className="base-hp"><span style={{ width: `${playerBaseHp / settings.battlePlayerHp * 100}%` }} /></div><small>黄金基地 {Math.ceil(playerBaseHp)}/{settings.battlePlayerHp}</small></div>
      <div className="battle-base enemy-base"><div className="wing-base blue-wing"><i /><i /><b>◆</b></div><div className="base-hp"><span style={{ width: `${enemyBaseHp / settings.battleEnemyHp * 100}%` }} /></div><small>蓝翼基地 {Math.ceil(enemyBaseHp)}/{settings.battleEnemyHp}</small></div>
      <div className="battle-ground" />
      {soldiers.map((unit) => <div key={unit.id} className={`soldier ${unit.side}`} style={{ left: `${unit.x}%` }}><div className="soldier-hp"><span style={{ width: `${Math.max(0, unit.hp / unit.maxHp * 100)}%` }} /></div><div className="soldier-body"><b>{unit.side === 'player' ? '♞' : '♟'}</b><i /></div></div>)}
    </div>
    <div className="battle-hud"><span>得分 {score}</span><strong>{message}</strong><span>连击 {combo}</span></div>
    {current && <div className="battle-question"><div className="battle-word">{current.word}<button onClick={() => speak(current.word)}>🔊</button></div><div className="battle-phonetic">/{current.phonetic}/</div><div className="battle-choices">{choices.map((choice) => <button key={choice.id} disabled={!!answered} className={answered ? choice.id === current.id ? 'right' : choice.id === answered ? 'wrong' : '' : ''} onClick={() => answer(choice)}>{choice.meaning}</button>)}</div></div>}
  </div>
}
