import { useMemo } from 'react'
import { useCurrentUser, useAppStore } from '../store/useAppStore'
import { aggregateEffects, describeEffects, EQUIP_SLOTS, getItem, RARITY_COLOR, RARITY_LABEL } from '../engine/items'
import { Icon } from './Icon'
import { toast } from './Toast'

export function BagView() {
  const user = useCurrentUser()
  const equipItem = useAppStore((s) => s.equipItem)
  const unequipSlot = useAppStore((s) => s.unequipSlot)

  const effects = useMemo(() => aggregateEffects(user?.equipped ?? []), [user?.equipped])
  const owned = user?.inventory ?? []

  if (!user) return null

  if (owned.length === 0) {
    return (
      <div className="empty">
        <Icon name="bag" size={34} color="var(--faint)" />
        <div style={{ marginTop: 10 }}>背包还是空的</div>
        <div className="tiny" style={{ marginTop: 6 }}>
          去商城用金币换装备吧
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="section-title" style={{ marginTop: 4 }}>
        装备槽（最多 {EQUIP_SLOTS} 件）
      </div>
      <div className="tiny muted" style={{ marginTop: -6, marginBottom: 8 }}>
        装备为消耗品，每局开局自动消耗所装备的装备（背包数量 −1，用完即清空）
      </div>
      <div className="slot-row">
        {Array.from({ length: EQUIP_SLOTS }, (_, i) => {
          const id = user.equipped[i]
          const item = id ? getItem(id) : undefined
          return (
            <button
              key={i}
              className={`slot${item ? ' filled' : ''}`}
              onClick={() => id && unequipSlot(i)}
            >
              {item ? (
                <>
                  <Icon name={item.icon} size={24} color={RARITY_COLOR[item.rarity]} />
                  <div className="n">{item.name}</div>
                  <div className="tiny muted">点击卸下</div>
                </>
              ) : (
                <div className="tiny muted">空槽 {i + 1}</div>
              )}
            </button>
          )
        })}
      </div>

      <div className="card">
        <div style={{ fontSize: 14, fontWeight: 500 }}>当前生效</div>
        <div className="effect-chips">
          {effects.extraTime > 0 && <span className="chip">每局 +{effects.extraTime} 秒</span>}
          {effects.slowDown > 0 && <span className="chip">地鼠停留 +{effects.slowDown}%</span>}
          {effects.shield > 0 && <span className="chip">护盾 {effects.shield} 次（每局消耗）</span>}
          {effects.comboBonus > 0 && <span className="chip">连击加成 +{effects.comboBonus}%</span>}
          {effects.scoreBonus > 0 && <span className="chip">得分 +{effects.scoreBonus}%</span>}
          {Object.values(effects).every((v) => v === 0) && (
            <span className="tiny muted">还没有装备，效果为空</span>
          )}
        </div>
      </div>

      <div className="section-title">我的装备</div>
      {owned.map((entry) => {
        const item = getItem(entry.itemId)
        if (!item) return null
        const equippedIdx = user.equipped.indexOf(item.id)
        return (
          <div key={item.id} className="item-card">
            <Icon name={item.icon} size={26} color={RARITY_COLOR[item.rarity]} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="n">
                {item.name}
                <span className="tag" style={{ marginLeft: 6 }}>
                  {RARITY_LABEL[item.rarity]}
                </span>
                {entry.qty > 1 && (
                  <span className="tag" style={{ marginLeft: 4 }}>
                    ×{entry.qty}
                  </span>
                )}
              </div>
              <div className="d">{describeEffects(item)}</div>
            </div>
            <button
              className={`buy-btn${equippedIdx >= 0 ? ' owned' : ''}`}
              onClick={() => {
                if (equippedIdx >= 0) {
                  unequipSlot(equippedIdx)
                  return
                }
                const slot = user.equipped.findIndex((s) => s === null)
                if (slot < 0) {
                  toast('装备槽满了，先卸下一件')
                  return
                }
                equipItem(item.id, slot)
                toast(`已装备 ${item.name}`)
              }}
            >
              {equippedIdx >= 0 ? '卸下' : '装备'}
            </button>
          </div>
        )
      })}
    </div>
  )
}
