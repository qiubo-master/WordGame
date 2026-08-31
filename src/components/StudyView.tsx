import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { WRONG_CLEAR_STREAK, useCurrentUser, useAppStore, useSettings } from '../store/useAppStore'
import { getBookMeta, loadBookWords } from '../data'
import { buildStudyQueue, todayKey } from '../engine/sm2'
import { speak } from '../engine/speech'
import { computeLearnedCount } from '../engine/levels'
import { shuffle } from '../engine/random'
import { SFX, unlockAudio } from '../engine/sound'
import type { Rating, ViewName, Word } from '../types'
import { Icon } from './Icon'
import { toast } from './Toast'

interface Props {
  onNavigate: (v: ViewName) => void
  focusWordIds?: string[] | null
  focusMode?: 'mistakes' | 'level' | null
  onExitDrill?: () => void
}

function buildOptions(answer: Word, pool: Word[]): Word[] {
  const out: Word[] = [answer]
  const seen = new Set<string>([answer.meaning])
  for (const w of shuffle(pool)) {
    if (out.length >= 4) break
    if (w.id === answer.id || seen.has(w.meaning)) continue
    seen.add(w.meaning)
    out.push(w)
  }
  return shuffle(out)
}

export function StudyView({ onNavigate, focusWordIds, focusMode, onExitDrill }: Props) {
  const user = useCurrentUser()
  const rateWord = useAppStore((s) => s.rateWord)
  const markWrong = useAppStore((s) => s.markWrong)
  const markRight = useAppStore((s) => s.markRight)
  const penalizeWrong = useAppStore((s) => s.penalizeWrong)
  const settings = useSettings()
  const bookId = user?.activeBookId
  const meta = bookId ? getBookMeta(bookId) : undefined
  const focused = !!focusWordIds && focusWordIds.length > 0
  const drill = focused && focusMode !== 'level'
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

  const initialQueue = useMemo(() => {
    if (!meta || !user || bookWords.length === 0) return [] as Word[]
    if (focused) {
      const index = new Map(bookWords.map((w) => [w.id, w]))
      return focusWordIds
        .map((id) => index.get(id))
        .filter((w): w is Word => !!w)
    }
    const doneToday = user.dailyStats[todayKey()]?.newWords ?? 0
    const newCap =
      settings.dailyNewLimit > 0
        ? Math.max(0, settings.dailyNewLimit - doneToday)
        : Number.POSITIVE_INFINITY
    const reviewCap =
      settings.reviewSessionLimit > 0 ? settings.reviewSessionLimit : Number.POSITIVE_INFINITY
    const { reviewWords, newWords } = buildStudyQueue(bookWords, user.wordStates, newCap, reviewCap)
    return [...reviewWords, ...newWords]
  }, [
    meta?.id,
    bookWords,
    user?.profile.id,
    settings.dailyNewLimit,
    settings.reviewSessionLimit,
    focused ? focusWordIds.join(',') : '',
  ])

  const [remaining, setRemaining] = useState<Word[]>(initialQueue)
  const [streak, setStreak] = useState(0)
  const [session, setSession] = useState({ done: 0, coins: 0, wrong: 0 })
  const [finished, setFinished] = useState(initialQueue.length === 0)
  const [picked, setPicked] = useState<string | null>(null)
  const [unlockCelebration, setUnlockCelebration] = useState<{ major: number; minor: number; boss: boolean } | null>(null)
  const startedAt = useRef(Date.now())
  const answerRef = useRef<HTMLDivElement>(null)
  const [elapsed, setElapsed] = useState(0)

  const current = remaining[0]

  const options = useMemo(() => {
    if (!current || !meta) return [] as Word[]
    return buildOptions(current, bookWords)
  }, [current?.id, meta?.id, bookWords])

  const goNext = useCallback(
    (putBack: boolean) => {
      const word = remaining[0]
      if (!word) return
      const next = remaining.slice(1)
      setRemaining(putBack ? [...next, word] : next)
      setPicked(null)
      if (next.length === 0 && !putBack) setFinished(true)
    },
    [remaining],
  )

  useEffect(() => {
    if (current) speak(current.word)
  }, [current?.id])

  useEffect(() => {
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000)
    return () => clearInterval(t)
  }, [])

  useEffect(() => {
    setRemaining(initialQueue)
    setFinished(initialQueue.length === 0)
    setPicked(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookWords, meta?.id, focused ? focusWordIds.join(',') : ''])

  const handleChoice = useCallback(
    (choiceId: string) => {
      if (!current || !user || picked !== null) return
      unlockAudio()
      const isRight = choiceId === current.id
      setPicked(choiceId)

      const willMasterWrong = isRight && drill && ((user.wrongWords[current.id]?.correctStreak ?? 0) + 1 >= WRONG_CLEAR_STREAK)
      const rating: Rating = isRight ? (willMasterWrong ? 'mastered' : 'know') : 'forgot'
      const outcome = rateWord(current.id, rating, isRight ? streak + 1 : 0)
      setStreak((s) => (isRight ? s + 1 : 0))
      setSession((s) => ({
        done: s.done + 1,
        coins: s.coins + outcome.coins + outcome.comboBonus,
        wrong: s.wrong + (isRight ? 0 : 1),
      }))

      if (isRight) {
        SFX.correct()
        if (!drill) {
          const wordIndex = bookWords.findIndex((word) => word.id === current.id)
          if (wordIndex >= 0) {
            const groupStart = Math.floor(wordIndex / 50) * 50
            const groupWords = bookWords.slice(groupStart, groupStart + 50)
            const learnedBefore = groupWords.reduce(
              (count, word) => count + ((user.wordStates[word.id]?.correctCount ?? 0) > 0 ? 1 : 0),
              0,
            )
            const wasLearned = (user.wordStates[current.id]?.correctCount ?? 0) > 0
            const learnedAfter = learnedBefore + (wasLearned ? 0 : 1)
            if (!wasLearned && learnedAfter % 10 === 0) {
              const minor = Math.min(5, learnedAfter / 10)
              setUnlockCelebration({ major: Math.floor(wordIndex / 50) + 1, minor, boss: minor === 5 })
            }
          }
        }
        const cleared = markRight(current.id)
        if (cleared) toast(`${current.word} 已移出错词本`)
        else if (outcome.coins + outcome.comboBonus > 0) {
          const extra = outcome.comboBonus > 0 ? ` 连击 +${outcome.comboBonus}` : ''
          toast(`+${outcome.coins} 金币${extra}`)
        }
        if (outcome.dailyCapped) toast('今日背词金币已达上限')
      } else {
        SFX.wrong()
        markWrong(current.id, bookId ?? current.id.split('-')[0])
        penalizeWrong()
        if (settings.coinWrongPenalty > 0) toast(`答错了，-${settings.coinWrongPenalty} 金币`)
        speak(current.word)
      }
    },
    [current, user, picked, streak, bookId, bookWords, drill, rateWord, markRight, markWrong, penalizeWrong],
  )

  const handleSkip = useCallback(() => {
    if (!current || !user || picked !== null) return
    unlockAudio()
    setPicked('__skip__')
    rateWord(current.id, 'forgot', 0)
    setStreak(0)
    setSession((s) => ({ ...s, done: s.done + 1 }))
    SFX.wrong()
    markWrong(current.id, bookId ?? current.id.split('-')[0])
    speak(current.word)
  }, [current, user, picked, bookId, rateWord, markWrong])

  useEffect(() => {
    if (picked === null) return
    window.requestAnimationFrame(() => {
      answerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    })
  }, [picked])

  if (!meta || !user) {
    return (
      <div className="empty">
        <div>还没有选词库</div>
        <button className="btn" style={{ marginTop: 14 }} onClick={() => onNavigate('books')}>
          去选词库
        </button>
      </div>
    )
  }

  if (bookWords.length === 0) {
    return (
      <div className="empty">
        <div>加载词库中…</div>
      </div>
    )
  }

  if (finished) {
        const learned = computeLearnedCount(bookWords, user.wordStates)
    const nothingToDo = session.done === 0
    return (
      <div className="result-panel">
        <Icon name="check" size={44} color="var(--success)" />
        <div className="result-score" style={{ marginTop: 10 }}>
          {nothingToDo ? '完成' : session.done}
        </div>
        <div className="muted" style={{ fontSize: 15 }}>
          {nothingToDo
            ? focused
              ? focusMode === 'level' ? '本关未掌握单词已练完' : '错词都清空了'
              : '今日任务已全部完成'
            : '个单词完成'}
        </div>
        <div className="muted tiny" style={{ marginTop: 8 }}>
          {nothingToDo
            ? focused
              ? focusMode === 'level' ? '返回关卡查看最新解锁进度' : '这个批次的错词练完了'
              : '明天再来复习，记忆会更牢固'
            : `用时 ${Math.floor(elapsed / 60)} 分 ${elapsed % 60} 秒 · 获得 ${session.coins} 金币 · 错 ${session.wrong} 个`}
        </div>

        {!focused && (
          <div className="card" style={{ marginTop: 16, textAlign: 'left' }}>
            <div className="tiny muted">当前词库进度</div>
            <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>
              {learned} / {meta.wordCount} 词
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${Math.round((learned / meta.wordCount) * 100)}%` }}
              />
            </div>
          </div>
        )}

        <div className="btn-row" style={{ marginTop: 14 }}>
          {focused ? (
            <button className="btn ghost" onClick={() => onExitDrill?.()}>
              {focusMode === 'level' ? '返回关卡' : '返回错词本'}
            </button>
          ) : (
            <button className="btn ghost" onClick={() => onNavigate('home')}>
              回首页
            </button>
          )}
          <button className="btn gold" onClick={() => onNavigate('levels')}>
            去闯关
          </button>
        </div>
      </div>
    )
  }

  if (!current) return null

  const total = initialQueue.length
  const doneCount = session.done
  const todayStat = user.dailyStats[todayKey()]
  const state = user.wordStates[current.id]
  const isNew = !state || state.status === 'new'
  const answered = picked !== null

  return (
    <div>
      {unlockCelebration && (
        <div className={`unlock-overlay${unlockCelebration.boss ? ' boss' : ''}`}>
          <div className="unlock-confetti" aria-hidden="true">
            {Array.from({ length: 18 }, (_, index) => <i key={index} />)}
          </div>
          <div className="unlock-modal">
            <div className="unlock-icon">{unlockCelebration.boss ? '🦖🏆' : '🔓✨'}</div>
            <div className="tiny">{unlockCelebration.boss ? '太棒了！大关完成' : '恭喜你，新的挑战已开启'}</div>
            <h2>
              {unlockCelebration.boss
                ? `${unlockCelebration.major}-5 恐龙 Boss 已解锁！`
                : `${unlockCelebration.major}-${unlockCelebration.minor} 小关已解锁！`}
            </h2>
            <p>
              {unlockCelebration.boss
                ? `你已掌握第 ${unlockCelebration.major} 大关全部 50 个单词，准备挑战 Boss！`
                : `本大关已掌握 ${unlockCelebration.minor * 10} 个单词，继续前进吧！`}
            </p>
            <button className="btn" onClick={() => setUnlockCelebration(null)}>太棒了，继续</button>
          </div>
        </div>
      )}
      <div className="study-bar">
        <span>
          {doneCount + 1} / {total}
        </span>
        <div style={{ flex: 1 }} />
        {streak >= 3 && <span className="combo-badge">连击 {streak}</span>}
        {focused ? (
          <span style={{ color: focusMode === 'mistakes' ? 'var(--danger)' : 'var(--primary)' }}>{focusMode === 'mistakes' ? '错词练习' : '关卡补学'}</span>
        ) : (
          <span>今日新学 {todayStat?.newWords ?? 0}</span>
        )}
      </div>
      <div className="progress-track study-progress" style={{ marginBottom: 14 }}>
        <div
          className="progress-fill"
          style={{ width: `${Math.round((doneCount / total) * 100)}%` }}
        />
      </div>

      <div
        key={current.id}
        className={`word-card study-word-enter${answered ? picked === current.id ? ' answer-correct' : ' answer-wrong' : ''}`}
      >
        <span className="study-orb orb-one" />
        <span className="study-orb orb-two" />
        {drill ? (
          <span className="tag" style={{ color: 'var(--danger)' }}>
            错词
          </span>
        ) : (
          isNew && <span className="tag">新词</span>
        )}
        <div className="word-main" style={{ marginTop: isNew || drill ? 10 : 0 }}>
          {current.word}
        </div>
        <div className="word-phonetic">/{current.phonetic}/</div>
        <button
          className="speak-btn"
          onClick={() => {
            unlockAudio()
            speak(current.word)
          }}
          aria-label="朗读"
        >
          <Icon name="speaker" color="var(--primary)" />
        </button>
      </div>

      <div className="choice-grid">
        {options.map((opt) => {
          let cls = 'choice'
          if (answered) {
            if (opt.id === current.id) cls += ' right'
            else if (opt.id === picked) cls += ' wrong-pick'
            else cls += ' dim'
          }
          return (
            <button
              key={`${current.id}-${opt.id}`}
              className={`${cls} choice-enter`}
              style={{ animationDelay: `${options.indexOf(opt) * 55 + 100}ms` }}
              disabled={answered}
              onClick={() => handleChoice(opt.id)}
            >
              <span className="choice-pos">{opt.pos}</span>
              {opt.meaning}
            </button>
          )
        })}
      </div>

      {answered ? (
        <div ref={answerRef} className={`answer-bar answer-rise ${picked === current.id ? 'ok' : 'bad'}`}>
          <div className="answer-particles" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <div style={{ fontSize: 15, fontWeight: 500 }}>
            {picked === current.id ? '答对了' : '正确答案'}
          </div>
          <div style={{ fontSize: 17, marginTop: 2 }}>
            {current.word} · {current.meaning}
          </div>
          <button
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() => (picked === current.id ? goNext(false) : goNext(true))}
          >
            {picked === current.id ? '下一个' : '记住了，继续'}
          </button>
        </div>
      ) : (
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={handleSkip}>
          不认识，直接看答案
        </button>
      )}
    </div>
  )
}
