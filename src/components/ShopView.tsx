import { useState } from 'react'
import { useCurrentUser, useAppStore } from '../store/useAppStore'
import { ITEM_CATALOG, RARITY_COLOR, RARITY_LABEL, describeEffects } from '../engine/items'
import { Icon } from './Icon'
import { toast } from './Toast'

export function ShopView() {
  const user = useCurrentUser()
  const buyItem = useAppStore((s) => s.buyItem)
  const [game, setGame] = useState<'all' | 'whack' | 'match' | 'battle' | 'garden' | 'dino'>('all')

  if (!user) return null
  const coins = user.wallet.coins

  return (
    <div>
      <div className="card" style={{ marginTop: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="coin" size={22} color="var(--gold)" />
          <span style={{ fontSize: 18, fontWeight: 600, color: '#633806' }}>{coins}</span>
          <span className="tiny muted">可用金币</span>
        </div>
        <div className="tiny muted" style={{ marginTop: 6 }}>
          背单词赚金币：新学一个词 +2，复习答对 +1，连击有额外奖励
        </div>
      </div>

      <div className="section-title">装备商店</div>
      <div className="shop-tabs">
        {([['all','全部'],['whack','打地鼠'],['match','消消乐'],['battle','单词兵团'],['garden','词语保卫战'],['dino','恐龙 Boss']] as const).map(([id,label]) =>
          <button key={id} className={game === id ? 'active' : ''} onClick={() => setGame(id)}>{label}</button>)}
      </div>
      {ITEM_CATALOG.filter((item) => game === 'all' || item.game === 'all' || item.game === game).map((item) => {
        const owned = user.inventory.find((e) => e.itemId === item.id)?.qty ?? 0
        const afford = coins >= item.price
        return (
          <div key={item.id} className={`item-card rarity-${item.rarity}`}>
            <Icon name={item.icon} size={26} color={RARITY_COLOR[item.rarity]} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="n">
                {item.name}
                <span className="tag" style={{ marginLeft: 6 }}>
                  {RARITY_LABEL[item.rarity]}
                </span>
                <span className="tag game-tag" style={{ marginLeft: 4 }}>
                  {item.game === 'all' || !item.game ? '全游戏' : item.game === 'whack' ? '打地鼠' : item.game === 'match' ? '消消乐' : item.game === 'battle' ? '单词兵团' : item.game === 'garden' ? '词语保卫战' : '恐龙 Boss'}
                </span>
                {owned > 0 && (
                  <span className="tag" style={{ marginLeft: 4 }}>
                    已有 {owned}
                  </span>
                )}
              </div>
              <div className="d">{describeEffects(item)}</div>
            </div>
            <button
              className="buy-btn"
              disabled={!afford}
              onClick={() => {
                if (buyItem(item.id)) toast(`买到了 ${item.name}`)
                else toast('金币不够')
              }}
            >
              {item.price} 金币
            </button>
          </div>
        )
      })}

      <div className="card" style={{ marginTop: 6 }}>
        <div className="tiny muted">
          装备会真实改变游戏数值：加时长、让地鼠停留更久、抵消失误、提升得分和连击加成。装备栏最多同时生效 3
          件，在背包里管理。装备是消耗品，每局开局自动消耗 1 件，用完即清空。
        </div>
      </div>
    </div>
  )
}
