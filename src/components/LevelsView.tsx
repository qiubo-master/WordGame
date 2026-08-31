import { useEffect, useMemo, useState } from 'react'
import { useCurrentUser, useSettings } from '../store/useAppStore'
import { getBookMeta, loadBookWords } from '../data'
import { computeLearnedCount, generateLevels } from '../engine/levels'
import type { GameType, ViewName, Word } from '../types'

interface Props {
  onNavigate: (v: ViewName) => void
  onPlay: (levelId: string, gameType: GameType) => void
  onStudyWords: (wordIds: string[]) => void
}

export function LevelsView({ onNavigate, onPlay, onStudyWords }: Props) {
  const user = useCurrentUser()
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

  const levels = useMemo(
    () => (meta ? generateLevels({ meta, words: bookWords }, settings) : []),
    [meta, bookWords, settings.unitSize, settings.unlockThreshold, settings.levelBaseScore, settings.levelScoreStep, settings.levelScoreMax],
  )

  if (!user || !meta) {
    return (
      <div className="empty">
        <div>先选一个词库</div>
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

  const learned = computeLearnedCount(bookWords, user.wordStates)

  return (
    <div>
      <div className="card" style={{ marginTop: 12 }}>
        <div className="tiny muted">{meta.name}</div>
        <div style={{ fontSize: 18, fontWeight: 500, marginTop: 4 }}>
          已掌握 {learned} 词
        </div>
        <div className="progress-track">
          <div
            className="progress-fill"
            style={{ width: `${Math.round((learned / meta.wordCount) * 100)}%` }}
          />
        </div>
        <div className="tiny muted" style={{ marginTop: 6 }}>
          每 50 词为一大关 · 每掌握 10 词解锁一个小关 · 50 词解锁恐龙 Boss
        </div>
      </div>

      <div className="section-title">关卡</div>
      {levels.map((lv) => {
        const prog = user.levelProgress[lv.id]
        const levelLearned = lv.wordIds.reduce((count, id) => count + (user.wordStates[id]?.correctCount ? 1 : 0), 0)
        const subUnlocked = Math.min(5, Math.floor(levelLearned / 10))
        const unlocked = subUnlocked >= 1
        const bossUnlocked = levelLearned >= lv.wordIds.length
        const cleared = prog?.status === 'cleared'
        const status = cleared ? 'cleared' : unlocked ? 'unlocked' : 'locked'
        const stars = prog?.stars ?? 0
        const unlearnedWordIds = lv.wordIds.filter((id) => !(user.wordStates[id]?.correctCount))
        return (
          <div
            key={lv.id}
            className={`level-item ${status}${unlearnedWordIds.length ? ' level-reviewable' : ''}`}
            role={unlearnedWordIds.length ? 'button' : undefined}
            tabIndex={unlearnedWordIds.length ? 0 : undefined}
            onClick={(event) => {
              if (!unlearnedWordIds.length || (event.target as HTMLElement).closest('button')) return
              onStudyWords(unlearnedWordIds)
            }}
            onKeyDown={(event) => {
              if (unlearnedWordIds.length && (event.key === 'Enter' || event.key === ' ')) onStudyWords(unlearnedWordIds)
            }}
          >
            <div className={`level-badge ${cleared ? 'done' : unlocked ? 'open' : ''}`}>
              {lv.index + 1}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 15, fontWeight: 500 }}>
                {lv.name}
                {!unlocked && <span className="tiny muted"> · 未解锁</span>}
              </div>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {unlocked
                  ? `本关已掌握 ${levelLearned}/${lv.wordIds.length} 词`
                  : `本关再掌握 ${Math.max(0, 10 - levelLearned)} 词解锁第 1 小关`}
              </div>
              {unlearnedWordIds.length > 0 && <div className="tiny" style={{ marginTop: 3, color: 'var(--primary)' }}>点击继续背 {unlearnedWordIds.length} 个未掌握单词</div>}
              <div className="sublevel-track">
                {[1,2,3,4,5].map((n) => <span key={n} className={subUnlocked >= n ? 'open' : ''}>{n}</span>)}
                <b className={bossUnlocked ? 'open' : ''}>🦖 Boss</b>
              </div>
              {stars > 0 && (
                <div className="stars">
                  {'★'.repeat(stars)}
                  {'☆'.repeat(3 - stars)}
                </div>
              )}
              {unlocked && (
                <div className="level-actions">
                  <button className="mini-btn" disabled={subUnlocked < 1} onClick={() => onPlay(`${lv.id}::1`, 'whack')}>
                    {lv.index + 1}-1 打地鼠
                  </button>
                  <button className="mini-btn" disabled={subUnlocked < 2} onClick={() => onPlay(`${lv.id}::2`, 'match')}>
                    {lv.index + 1}-2 消消乐
                  </button>
                  <button className="mini-btn battle" disabled={subUnlocked < 3} onClick={() => onPlay(`${lv.id}::3`, 'battle')}>
                    {lv.index + 1}-3 单词兵团
                  </button>
                  <button className="mini-btn garden" disabled={subUnlocked < 4} onClick={() => onPlay(`${lv.id}::4`, 'garden')}>
                    {lv.index + 1}-4 词语保卫战
                  </button>
                  <button className="mini-btn dino" disabled={subUnlocked < 5 || !bossUnlocked} onClick={() => onPlay(lv.id, 'dino')}>
                    {bossUnlocked ? `${lv.index + 1}-5 🦖 打恐龙 Boss` : `${lv.index + 1}-5 🦖 Boss（还差 ${lv.wordIds.length - levelLearned} 词）`}
                  </button>
                </div>
              )}
            </div>
            {cleared && (
              <div className="tiny" style={{ color: 'var(--success)' }}>
                最佳 {prog?.bestScore ?? 0}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
