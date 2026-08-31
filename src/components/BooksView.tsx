import { useEffect, useState } from 'react'
import { useCurrentUser, useAppStore } from '../store/useAppStore'
import { BOOK_METAS, loadBookWords } from '../data'
import { computeLearnedCount } from '../engine/levels'
import type { ViewName, Word } from '../types'
import { Icon } from './Icon'
import { toast } from './Toast'

interface Props {
  onNavigate: (v: ViewName) => void
}

const CATEGORY_LABEL: Record<string, string> = {
  syllabus: '课标',
  exam: '考试',
  cambridge: '剑桥',
  textbook: '教材',
  custom: '自定义',
  intl: '出国',
}

export function BooksView({ onNavigate }: Props) {
  const user = useCurrentUser()
  const setActiveBook = useAppStore((s) => s.setActiveBook)
  const activeBookId = user?.activeBookId
  const [activeWords, setActiveWords] = useState<Word[]>([])
  useEffect(() => {
    if (!activeBookId) {
      setActiveWords([])
      return
    }
    let alive = true
    loadBookWords(activeBookId).then((w) => {
      if (alive) setActiveWords(w)
    })
    return () => {
      alive = false
    }
  }, [activeBookId])

  return (
    <div>
      <div className="section-title" style={{ marginTop: 4 }}>
        选择词库
      </div>
      {BOOK_METAS.map((meta) => {
        const active = user?.activeBookId === meta.id
        const learned = active && activeWords.length ? computeLearnedCount(activeWords, user.wordStates) : 0
        const pct = meta.wordCount ? Math.round((learned / meta.wordCount) * 100) : 0
        return (
          <button
            key={meta.id}
            className={`book-item${active ? ' on' : ''}`}
            onClick={() => {
              setActiveBook(meta.id)
              toast(`已切换到 ${meta.name}`)
              onNavigate('study')
            }}
          >
            <div
              style={{
                width: 42,
                height: 42,
                borderRadius: 12,
                background: 'var(--primary-soft)',
                display: 'grid',
                placeItems: 'center',
                color: 'var(--primary)',
                flex: '0 0 auto',
              }}
            >
              <Icon name="book" />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="n">{meta.name}</span>
                <span className="tag">{CATEGORY_LABEL[meta.category]}</span>
                {active && <span className="tag">当前</span>}
              </div>
              <div className="d">{meta.description}</div>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <div className="tiny muted" style={{ marginTop: 4 }}>
                {meta.wordCount} 词 · 已掌握 {learned}（{pct}%）
              </div>
            </div>
          </button>
        )
      })}
      <div className="card" style={{ marginTop: 6 }}>
        <div style={{ fontSize: 14, fontWeight: 500 }}>教材版本词库呢？</div>
        <div className="tiny muted" style={{ marginTop: 6 }}>
          人教 PEP、外研版、译林版等教材词表涉及出版社版权，应用内不内置。词表导入功能将在下一个版本提供，届时可上传 CSV
          自行添加。
        </div>
      </div>
    </div>
  )
}
