import { useCallback, useEffect, useState } from 'react'
import { apiGetLeaderboard } from '../engine/api'
import { refreshCloudSave, useAppStore } from '../store/useAppStore'
import type { LeaderboardEntry } from '../types'
import { Icon } from './Icon'

export function LeaderboardView() {
  const auth = useAppStore((state) => state.auth)
  const [rows, setRows] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState<number | null>(null)

  const load = useCallback(async () => {
    if (!auth) {
      setError('请先登录云端账号，再查看排行榜')
      setLoading(false)
      return
    }
    setLoading(true)
    setError('')
    try {
      // 先用带版本校验的同步流程上传本机最新进度。同步冲突由后台自动合并，
      // 不应阻挡排行榜读取或把“云存档已更新”展示给用户。
      try { await refreshCloudSave() } catch { /* 排行榜仍可独立读取 */ }
      const result = await apiGetLeaderboard()
      setRows(result.rows)
      setUpdatedAt(result.generatedAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : '排行榜加载失败，请稍后再试')
    } finally {
      setLoading(false)
    }
  }, [auth])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="leaderboard-hero">
        <Icon name="trophy" size={34} color="var(--gold)" />
        <div>
          <div className="section-title" style={{ margin: 0 }}>学习排行榜</div>
          <div className="tiny muted">
            先比今日学习词数，再比累计掌握词数
            {updatedAt ? ` · 实时更新于 ${new Date(updatedAt).toLocaleTimeString('zh-CN', { hour12: false })}` : ''}
          </div>
        </div>
        <button className="tag" onClick={load} disabled={loading}>{loading ? '刷新中…' : '刷新'}</button>
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
