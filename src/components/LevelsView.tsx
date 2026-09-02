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
  const [replayConfirm, setReplayConfirm] = useState<{ levelId: string; gameType: GameType; label: string } | null>(null)
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
          每 50 词为一大关 · 每掌握 10 词获得挑战资格 · 通关前一小关才能挑战下一关
        </div>
      </div>

      <div className="section-title">关卡</div>
      {levels.map((lv) => {
        const legacyProg = user.levelProgress[lv.id]
        const levelLearned = lv.wordIds.reduce((count, id) => count + (user.wordStates[id]?.correctCount ? 1 : 0), 0)
        const learnedSlots = Math.min(5, Math.floor(levelLearned / 10))
        // 旧版本只记录大关 ID，保留该成绩并折算为第 1 小关已通关；不修改历史存档。
        const passed = [1, 2, 3, 4, 5].map((n) =>
          user.levelProgress[`${lv.id}::${n}`]?.status === 'cleared' ||
          (n === 1 && legacyProg?.status === 'cleared'),
        )
        const available = passed.map((done, index) =>
          done || (learnedSlots >= index + 1 && (index === 0 || passed[index - 1])),
        )
        const unlocked = available[0]
        const cleared = passed.every(Boolean)
        const status = cleared ? 'cleared' : unlocked ? 'unlocked' : 'locked'
        const allProgress = [legacyProg, ...[1, 2, 3, 4, 5].map((n) => user.levelProgress[`${lv.id}::${n}`])].filter(Boolean)
        const stars = Math.max(0, ...allProgress.map((progress) => progress?.stars ?? 0))
        const bestScore = Math.max(0, ...allProgress.map((progress) => progress?.bestScore ?? 0))
        const unlearnedWordIds = lv.wordIds.filter((id) => !(user.wordStates[id]?.correctCount))
        const names = ['打地鼠', '消消乐', '单词兵团', '词语保卫战', '🦖 打恐龙 Boss']
        const classes = ['', '', 'battle', 'garden', 'dino']
        const buttonLabel = (index: number) => {
          const number = `${lv.index + 1}-${index + 1}`
          if (passed[index]) return `✓ ${number} ${names[index]} · 已通关`
          if (available[index]) return `🔓 ${number} ${names[index]} · 未通关`
          if (learnedSlots < index + 1) {
            const required = Math.min(lv.wordIds.length, (index + 1) * 10)
            return `🔒 ${number} ${names[index]} · 还差 ${Math.max(0, required - levelLearned)} 词`
          }
          return `🔒 ${number} ${names[index]} · 请先通关 ${lv.index + 1}-${index}`
        }
        const startLevel = (index: number) => {
          const gameType = (['whack', 'match', 'battle', 'garden', 'dino'] as GameType[])[index]
          const selectedLevelId = `${lv.id}::${index + 1}`
          if (passed[index]) {
            setReplayConfirm({
              levelId: selectedLevelId,
              gameType,
              label: `${lv.index + 1}-${index + 1} ${names[index]}`,
            })
            return
          }
          onPlay(selectedLevelId, gameType)
        }
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
                {unlocked && !cleared && <span className="tiny" style={{ color: 'var(--primary)' }}> · 未通关</span>}
                {cleared && <span className="tiny" style={{ color: 'var(--success)' }}> · 已通关</span>}
              </div>
              <div className="tiny muted" style={{ marginTop: 2 }}>
                {unlocked
                  ? `本关已掌握 ${levelLearned}/${lv.wordIds.length} 词 · 按顺序挑战 1-1 至 Boss`
                  : `本关再掌握 ${Math.max(0, 10 - levelLearned)} 词解锁第 1 小关`}
              </div>
              {unlearnedWordIds.length > 0 && <div className="tiny" style={{ marginTop: 3, color: 'var(--primary)' }}>点击继续背 {unlearnedWordIds.length} 个未掌握单词</div>}
              <div className="sublevel-track">
                {[1,2,3,4].map((n) => (
                  <span key={n} className={passed[n - 1] ? 'passed' : available[n - 1] ? 'open' : ''}>
                    {passed[n - 1] ? '✓' : available[n - 1] ? n : '🔒'}
                  </span>
                ))}
                <b className={passed[4] ? 'passed' : available[4] ? 'open' : ''}>
                  {passed[4] ? '✓ Boss' : available[4] ? '🦖 Boss' : '🔒 Boss'}
                </b>
              </div>
              {stars > 0 && (
                <div className="stars">
                  {'★'.repeat(stars)}
                  {'☆'.repeat(3 - stars)}
                </div>
              )}
              {(unlocked || learnedSlots > 0) && (
                <div className="level-actions">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      className={`mini-btn ${classes[n - 1]}${passed[n - 1] ? ' passed' : ''}`}
                      disabled={!available[n - 1]}
                      onClick={() => startLevel(n - 1)}
                    >
                      {buttonLabel(n - 1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            {cleared && (
              <div className="tiny" style={{ color: 'var(--success)' }}>
                最佳 {bestScore}
              </div>
            )}
          </div>
        )
      })}

      {replayConfirm && (
        <div className="replay-overlay" onClick={() => setReplayConfirm(null)}>
          <div className="replay-dialog" onClick={(event) => event.stopPropagation()}>
            <div className="replay-icon">🏆</div>
            <h3>这个游戏已经通关</h3>
            <p>
              {replayConfirm.label} 已经通关，继续玩仍会获得金币，但本局最多获得 10 个金币。还要继续吗？
            </p>
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setReplayConfirm(null)}>不玩了</button>
              <button
                className="btn"
                onClick={() => {
                  const next = replayConfirm
                  setReplayConfirm(null)
                  onPlay(next.levelId, next.gameType)
                }}
              >
                继续玩
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
