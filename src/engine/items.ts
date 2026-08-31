import type { Item, ItemEffectType, Rarity } from '../types'

export const EQUIP_SLOTS = 3

export const RARITY_LABEL: Record<Rarity, string> = {
  common: '普通',
  rare: '稀有',
  epic: '史诗',
  legendary: '传说',
  supreme: '至尊',
  mythic: '神话',
}

export const RARITY_COLOR: Record<Rarity, string> = {
  common: '#888780',
  rare: '#185FA5',
  epic: '#633806',
  legendary: '#9c3d10',
  supreme: '#8b2bb8',
  mythic: '#d20f73',
}

export const ITEM_CATALOG: Item[] = [
  {
    id: 'hourglass',
    name: '小沙漏',
    icon: 'clock',
    rarity: 'common',
    price: 50,
    effects: [{ type: 'extraTime', value: 8 }],
    desc: '每局开始 +8 秒',
    game: 'all',
  },
  {
    id: 'woodshield',
    name: '木盾牌',
    icon: 'shield',
    rarity: 'common',
    price: 50,
    effects: [{ type: 'shield', value: 1 }],
    desc: '每局抵消 1 次点错',
    game: 'all',
  },
  {
    id: 'snailshell',
    name: '蜗牛壳',
    icon: 'snail',
    rarity: 'rare',
    price: 150,
    effects: [{ type: 'slowDown', value: 25 }],
    desc: '地鼠停留时间 +25%',
    game: 'whack',
  },
  {
    id: 'luckystar',
    name: '幸运星',
    icon: 'star',
    rarity: 'rare',
    price: 150,
    effects: [{ type: 'scoreBonus', value: 15 }],
    desc: '总得分 +15%',
    game: 'all',
  },
  {
    id: 'combobadge',
    name: '连击徽章',
    icon: 'bolt',
    rarity: 'rare',
    price: 150,
    effects: [{ type: 'comboBonus', value: 30 }],
    desc: '连击加成 +30%',
    game: 'match',
  },
  {
    id: 'timegem',
    name: '时光宝石',
    icon: 'gem',
    rarity: 'epic',
    price: 400,
    effects: [{ type: 'extraTime', value: 20 }],
    desc: '每局开始 +20 秒',
    game: 'all',
  },
  {
    id: 'ironshield',
    name: '铁壁护盾',
    icon: 'shield',
    rarity: 'epic',
    price: 400,
    effects: [{ type: 'shield', value: 2 }],
    desc: '每局抵消 2 次点错',
    game: 'all',
  },
  {
    id: 'goldclock',
    name: '黄金沙漏',
    icon: 'clock',
    rarity: 'epic',
    price: 400,
    effects: [
      { type: 'extraTime', value: 12 },
      { type: 'scoreBonus', value: 25 },
    ],
    desc: '+12 秒，总得分 +25%',
    game: 'all',
  },
  { id:'mole-crown', name:'地鼠王冠', icon:'star', rarity:'legendary', price:800, effects:[{type:'slowDown',value:40},{type:'scoreBonus',value:30}], desc:'地鼠更慢，得分 +30%', game:'whack' },
  { id:'mole-supreme', name:'至尊木槌', icon:'bolt', rarity:'supreme', price:1500, effects:[{type:'scoreBonus',value:55},{type:'shield',value:2}], desc:'得分 +55%，护盾 2 次', game:'whack' },
  { id:'mole-mythic', name:'神话雷锤', icon:'gem', rarity:'mythic', price:3000, effects:[{type:'scoreBonus',value:90},{type:'slowDown',value:55}], desc:'得分 +90%，地鼠大幅减速', game:'whack' },
  { id:'match-lens', name:'配对透镜', icon:'star', rarity:'common', price:80, effects:[{type:'extraTime',value:6}], desc:'消消乐 +6 秒', game:'match' },
  { id:'match-chain', name:'连锁水晶', icon:'gem', rarity:'legendary', price:850, effects:[{type:'comboBonus',value:55},{type:'scoreBonus',value:25}], desc:'连击 +55%，得分 +25%', game:'match' },
  { id:'match-supreme', name:'至尊记忆冠', icon:'star', rarity:'supreme', price:1600, effects:[{type:'comboBonus',value:80},{type:'shield',value:3}], desc:'连击 +80%，护盾 3 次', game:'match' },
  { id:'match-mythic', name:'神话全知眼', icon:'gem', rarity:'mythic', price:3200, effects:[{type:'scoreBonus',value:100},{type:'extraTime',value:30}], desc:'得分翻倍，额外 +30 秒', game:'match' },
  { id:'battle-banner', name:'黄金战旗', icon:'flag', rarity:'rare', price:180, effects:[{type:'scoreBonus',value:20}], desc:'兵团攻击力与得分 +20%', game:'battle' },
  { id:'battle-legend', name:'传说军令', icon:'bolt', rarity:'legendary', price:900, effects:[{type:'scoreBonus',value:35},{type:'shield',value:2}], desc:'强化士兵并提升基地防御', game:'battle' },
  { id:'battle-supreme', name:'至尊王印', icon:'star', rarity:'supreme', price:1800, effects:[{type:'scoreBonus',value:65},{type:'shield',value:4}], desc:'军团火力 +65%，基地强化', game:'battle' },
  { id:'battle-mythic', name:'神话圣剑', icon:'gem', rarity:'mythic', price:3600, effects:[{type:'scoreBonus',value:110},{type:'comboBonus',value:60}], desc:'军团火力翻倍，连击强化', game:'battle' },
  { id:'garden-sunbag', name:'阳光小袋', icon:'star', rarity:'common', price:60, effects:[{type:'extraTime',value:10}], desc:'词语保卫战初始 +50 阳光', game:'garden' },
  { id:'garden-fertilizer', name:'稀有肥料', icon:'snail', rarity:'rare', price:200, effects:[{type:'scoreBonus',value:20}], desc:'植物火力 +20%', game:'garden' },
  { id:'garden-fire', name:'烈焰核心', icon:'bolt', rarity:'epic', price:450, effects:[{type:'scoreBonus',value:35},{type:'shield',value:1}], desc:'植物火力 +35%，基地强化', game:'garden' },
  { id:'garden-legend', name:'传说太阳花', icon:'star', rarity:'legendary', price:950, effects:[{type:'extraTime',value:30},{type:'scoreBonus',value:40}], desc:'初始 +150 阳光，火力 +40%', game:'garden' },
  { id:'garden-supreme', name:'至尊生命树', icon:'shield', rarity:'supreme', price:1900, effects:[{type:'shield',value:5},{type:'scoreBonus',value:65}], desc:'基地生命 +100，火力 +65%', game:'garden' },
  { id:'garden-mythic', name:'神话太阳神', icon:'gem', rarity:'mythic', price:3800, effects:[{type:'extraTime',value:80},{type:'scoreBonus',value:100}], desc:'初始 +400 阳光，植物火力翻倍', game:'garden' },
  { id:'dino-helmet', name:'恐龙猎手头盔', icon:'shield', rarity:'common', price:90, effects:[{type:'shield',value:1}], desc:'军营最大生命 +100', game:'dino' },
  { id:'dino-dogecoin', name:'狗币补给袋', icon:'star', rarity:'rare', price:220, effects:[{type:'extraTime',value:20}], desc:'开局额外获得 2 狗币', game:'dino' },
  { id:'dino-crossbow', name:'史诗破甲弩', icon:'bolt', rarity:'epic', price:520, effects:[{type:'scoreBonus',value:30},{type:'shield',value:1}], desc:'小兵火力 +30%，军营生命 +100', game:'dino' },
  { id:'dino-command', name:'传说巨人军令', icon:'flag', rarity:'legendary', price:1100, effects:[{type:'scoreBonus',value:50},{type:'extraTime',value:30}], desc:'小兵火力 +50%，开局 +3 狗币', game:'dino' },
  { id:'dino-armor', name:'至尊龙鳞堡垒', icon:'shield', rarity:'supreme', price:2200, effects:[{type:'shield',value:4},{type:'scoreBonus',value:75}], desc:'军营生命 +400，小兵火力 +75%', game:'dino' },
  { id:'dino-slayer', name:'神话屠龙圣器', icon:'gem', rarity:'mythic', price:4200, effects:[{type:'scoreBonus',value:120},{type:'extraTime',value:50}], desc:'小兵火力 +120%，开局 +5 狗币', game:'dino' },
]

export interface AggregatedEffects {
  extraTime: number
  slowDown: number
  shield: number
  comboBonus: number
  scoreBonus: number
}

export const EMPTY_EFFECTS: AggregatedEffects = {
  extraTime: 0,
  slowDown: 0,
  shield: 0,
  comboBonus: 0,
  scoreBonus: 0,
}

export function getItem(itemId: string): Item | undefined {
  return ITEM_CATALOG.find((i) => i.id === itemId)
}

export function aggregateEffects(equippedIds: (string | null)[]): AggregatedEffects {
  const result: AggregatedEffects = { ...EMPTY_EFFECTS }
  for (const id of equippedIds) {
    if (!id) continue
    const item = getItem(id)
    if (!item) continue
    for (const eff of item.effects) {
      result[eff.type as ItemEffectType] += eff.value
    }
  }
  result.slowDown = Math.min(result.slowDown, 60)
  result.shield = Math.min(result.shield, 5)
  return result
}

export function describeEffects(item: Item): string {
  return item.effects
    .map((e) => {
      switch (e.type) {
        case 'extraTime':
          return `+${e.value} 秒`
        case 'slowDown':
          return `地鼠停留 +${e.value}%`
        case 'shield':
          return `抵消 ${e.value} 次错误`
        case 'comboBonus':
          return `连击加成 +${e.value}%`
        case 'scoreBonus':
          return `得分 +${e.value}%`
        default:
          return ''
      }
    })
    .join('，')
}
