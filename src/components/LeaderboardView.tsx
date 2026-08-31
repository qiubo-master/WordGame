import { useCallback, useEffect, useState } from 'react'
import { apiGetLeaderboard, apiPutSave } from '../engine/api'
import { useAppStore, useCurrentUser } from '../store/useAppStore'
import type { LeaderboardEntry } from '../types'
import { Icon } from './Icon'

export function LeaderboardView() {
  const auth = useAppStore((state) => state.auth)
  const user = useCurrentUser()
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!auth) {
      setError('请先登录云端账号，再查看排行榜')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      if (user) await apiPutSave(user)
      const result = await apiGetLeaderboard()
      setRows(result.rows)
    } catch (e) {
      setError(e instanceof Error ? e.message : '排行榜加载失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }, [auth, user])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="leaderboard-hero">
        <Icon name="trophy" size={34} color="var(--gold)" />
        <div>
          <div className="section-title" style={{ margin: 0 }}>学习排行榜</div>
          <div className="tiny muted">先比今日学习词数，再比累计掌握词数</div>
        </div>
        <button className="tag" onClick={load} disabled={loading}>刷新</button>
      </div>

      <div className="leaderboard-head">
        <span>排名 / 用户</span>
        <span>今日</span>
        <span>总学习</span>
      </div>

      {loading && <div className="empty">排行榜加载中…</div>}
      {!loading && error && (
        <div className="empty">
          <div>{error}</div>
          {auth && <button className="btn" onClick={load}>重新加载</button>}
        </div>
      )}
      {!loading && !error && rows.length === 0 && <div className="empty">还没有排行数据</div>}
      {!loading && !error && rows.map((row) => (
        <div key={row.userId} className={`leaderboard-row${row.isMe ? ' me' : ''}`}>
          <div className="leaderboard-user">
            <span className={`rank rank-${row.rank}`}>{row.rank <= 3 ? ['🥇', '🥈', '🥉'][row.rank - 1] : row.rank}</span>
            <span className="leaderboard-name">{row.username}{row.isMe ? '（我）' : ''}</span>
          </div>
          <strong>{row.todayCount}<small> 词</small></strong>
          <strong>{row.totalCount}<small> 词</small></strong>
        </div>
      ))}
    </div>
  )
}
