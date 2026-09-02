interface Props {
  open: boolean
  onCancel: () => void
  onContinue: () => void
}

export function ReplayConfirm({ open, onCancel, onContinue }: Props) {
  if (!open) return null
  return (
    <div className="replay-overlay" onClick={onCancel}>
      <div className="replay-dialog" onClick={(event) => event.stopPropagation()}>
        <div className="replay-icon">🏆</div>
        <h3>这个游戏已经通关</h3>
        <p>继续玩仍会获得金币，但本局最多获得 10 个金币。还要继续吗？</p>
        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>不玩了</button>
          <button className="btn" onClick={onContinue}>继续玩</button>
        </div>
      </div>
    </div>
  )
}
