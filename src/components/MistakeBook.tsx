import { useEffect, useMemo, useState } from 'react'
import { useCurrentUser } from '../store/useAppStore'
import { getBookMeta, loadBookWords } from '../data'
import { speak } from '../engine/speech'
import type { ViewName, Word } from '../types'
import { Icon } from './Icon'

interface Props {
  onNavigate: (v: ViewName) => void
  onDrill: (wordIds: string[], bookId: string) => void
}

interface Row {
  entry: { wordId: string; bookId: string; wrongCount: number; correctStreak: number; lastWrongAt: number }
  word: Word
  bookName: string
}

export function MistakeBook({ onNavigate, onDrill }: Props) {
  const user = useCurrentUser()
  const [showAll, setShowAll] = useState(false)
  const [wordMaps, setWordMaps] = useState<Record<string, Map<string, Word>>>({})

  useEffect(() => {
    if (!user) return
    const ids = new Set<string>()
    for (const key in user.wrongWords) ids.add(user.wrongWords[key].bookId)
    let alive = true
    Promise.all(
      [...ids].map(async (bid) => {
        const words = await loadBookWords(bid)
        return [bid, new Map(words.map((w) => [w.id, w]))] as const
      }),
    ).then((entries) => {
      if (alive) setWordMaps(Object.fromEntries(entries))
    })
    return () => {
      alive = false
    }
  }, [user])

  const rows = useMemo<Row[]>(() => {
    if (!user) return []
    const out: Row[] = []
    for (const key in user.wrongWords) {
      const e = user.wrongWords[key]
      if (!showAll && e.bookId !== user.activeBookId) continue
      const word = wordMaps[e.bookId]?.get(e.wordId)
      if (!word) continue
      out.push({
        entry: e,
        word,
        bookName: getBookMeta(e.bookId)?.name ?? e.bookId,
      })
    }
    return out.sort((a, b) => b.entry.wrongCount - a.entry.wrongCount || b.entry.lastWrongAt - a.entry.lastWrongAt)
  }, [user, showAll, wordMaps])

  if (!user) return null

  const total = Object.keys(user.wrongWords).length
  const loading = total > 0 && Object.keys(wordMaps).length === 0
  if (loading) {
    return (
      <div className="empty">
        <div>加载错词中…</div>
      </div>
    )
  }
  const hidden = total - rows.length

  return (
    <div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ fontSize: 18, fontWeight: 600 }}>{total} 个错词</div>
        <div className="tiny muted" style={{ marginTop: 4 }}>
          背单词选错、游戏点错的词会自动进这里。连续答对 2 次自动移出。
        </div>
        {rows.length > 0 && (
          <button
            className="btn"
            style={{ marginTop: 12 }}
            onClick={() => {
              const bookId = user.activeBookId ?? rows[0].entry.bookId
              const ids = rows.filter((r) => r.entry.bookId === bookId).map((r) => r.entry.wordId)
              onDrill(ids, bookId)
            }}
          >
            只练这 {rows.filter((r) => r.entry.bookId === (user.activeBookId ?? rows[0].entry.bookId)).length} 个当前词库错词
          </button>
        )}
      </div>

      {total === 0 && (
        <div className="empty">
          <Icon name="check" size={34} color="var(--success)" />
          <div style={{ marginTop: 10 }}>错词本是空的</div>
          <div className="tiny" style={{ marginTop: 6 }}>
            答错的单词会自动收集到这里
          </div>
          <button className="btn ghost" style={{ marginTop: 16 }} onClick={() => onNavigate('study')}>
            去背单词
          </button>
        </div>
      )}

      {total > 0 && rows.length === 0 && (
        <div className="empty">
          <div>当前词库没有错词</div>
          <button className="btn ghost" style={{ marginTop: 14 }} onClick={() => setShowAll(true)}>
            查看全部词库的 {hidden} 个错词
          </button>
        </div>
      )}

      {rows.length > 0 && hidden > 0 && !showAll && (
        <button className="btn ghost" style={{ marginBottom: 12 }} onClick={() => setShowAll(true)}>
          还有 {hidden} 个其他词库的错词 · 查看全部
        </button>
      )}

      {rows.map((r) => (
        <div key={r.entry.wordId} className="item-card">
          <button
            className="speak-btn"
            style={{ width: 40, height: 40, margin: 0 }}
            onClick={() => speak(r.word.word)}
            aria-label="朗读"
          >
            <Icon name="speaker" size={18} color="var(--primary)" />
          </button>
          <button
            className="mistake-open"
            onClick={() => onDrill([r.entry.wordId], r.entry.bookId)}
            aria-label={`打开错词 ${r.word.word}`}
          >
            <div className="n">
              {r.word.word}
              <span className="tag" style={{ marginLeft: 6 }}>
                错 {r.entry.wrongCount} 次
              </span>
              {r.entry.correctStreak > 0 && (
                <span className="tag" style={{ marginLeft: 4 }}>
                  已答对 {r.entry.correctStreak} 次
                </span>
              )}
            </div>
            <div className="d">/{r.word.phonetic}/ {r.word.meaning}</div>
            <div className="tiny muted" style={{ marginTop: 2 }}>
              {r.bookName}
            </div>
            <span className="mistake-open-hint">点击练习</span>
          </button>
        </div>
      ))}
    </div>
  )
}
