import type { GameSettings } from '../types'

export const DEFAULT_SETTINGS: GameSettings = {
  dailyNewLimit: 0,
  reviewSessionLimit: 0,

  coinNewWord: 2,
  coinReviewCorrect: 1,
  coinComboStep: 10,
  coinComboBonus: 5,
  dailyCoinCap: 0,
  coinMultiplier: 1,
  coinWrongPenalty: 1,

  gameDuration: 60,
  gameMoleVisible: 1700,
  gameWaveGap: 350,
  gameHoles: 9,
  scorePerHit: 10,
  scorePenalty: 5,

  matchPairs: 6,
  matchScore: 10,
  matchPenalty: 2,

  // 打恐龙 Boss（dino）
  bossHp: 1800,
  bossBaseHp: 1000,
  bossRampInterval: 10,
  bossRampFactor: 2,

  // 单词兵团（battle）
  battlePlayerHp: 100,
  battleEnemyHp: 100,
  battleEnemyInterval: 3600,
  battlePlayerDmg: 2.4,
  battleEnemyDmg: 1.8,

  // 词语保卫战（garden）
  gardenBaseHp: 100,
  gardenWaves: 20,
  gardenWaveInterval: 2800,
  gardenZombieHp: 42,

  levelBaseScore: 120,
  levelScoreStep: 10,
  levelScoreMax: 300,

  coinGameBase: 20,
  coinScoreDivisor: 10,
  gameCoinCap: 80,
  perfectBonus: 15,

  unlockThreshold: 50,
  unitSize: 50,

  soundOn: true,

  adminPasscode: 'admin888',
}

export interface FieldMeta {
  key: keyof GameSettings
  label: string
  group: string
  hint: string
  min: number
  max: number
  step: number
  unlimited?: boolean
  options?: number[]
  unit?: string
}

export const SETTING_FIELDS: FieldMeta[] = [
  {
    key: 'dailyNewLimit',
    label: '每日新学上限',
    group: '学习',
    hint: '每天最多学多少个新词',
    min: 0,
    max: 500,
    step: 5,
    unlimited: true,
    unit: '词',
  },
  {
    key: 'reviewSessionLimit',
    label: '每次复习上限',
    group: '学习',
    hint: '一轮最多复习多少个到期词',
    min: 0,
    max: 500,
    step: 10,
    unlimited: true,
    unit: '词',
  },

  {
    key: 'coinNewWord',
    label: '新学一词',
    group: '金币',
    hint: '学会一个新词奖励多少金币',
    min: 0,
    max: 50,
    step: 1,
    unit: '金币',
  },
  {
    key: 'coinReviewCorrect',
    label: '复习答对',
    group: '金币',
    hint: '复习答对奖励多少金币',
    min: 0,
    max: 50,
    step: 1,
    unit: '金币',
  },
  {
    key: 'coinComboStep',
    label: '连击步长',
    group: '金币',
    hint: '连续答对多少个词触发一次奖励',
    min: 0,
    max: 100,
    step: 5,
    unit: '词',
  },
  {
    key: 'coinComboBonus',
    label: '连击奖励',
    group: '金币',
    hint: '每次触发连击给多少金币',
    min: 0,
    max: 100,
    step: 1,
    unit: '金币',
  },
  {
    key: 'dailyCoinCap',
    label: '每日背词金币上限',
    group: '金币',
    hint: '背单词每天最多能赚多少金币',
    min: 0,
    max: 2000,
    step: 20,
    unlimited: true,
    unit: '金币',
  },
  {
    key: 'coinMultiplier',
    label: '全局金币倍率',
    group: '金币',
    hint: '所有金币收益乘以这个数，想鼓励孩子时调到 2 或 3',
    min: 0,
    max: 10,
    step: 0.5,
    unit: '倍',
  },
  {
    key: 'coinWrongPenalty',
    label: '答错扣币',
    group: '金币',
    hint: '背单词选错选项扣多少金币，设 0 则不扣',
    min: 0,
    max: 50,
    step: 1,
    unit: '金币',
  },

  {
    key: 'gameDuration',
    label: '每局时长',
    group: '游戏',
    hint: '打地鼠一局多少秒',
    min: 15,
    max: 300,
    step: 5,
    unit: '秒',
  },
  {
    key: 'gameMoleVisible',
    label: '地鼠停留时长',
    group: '游戏',
    hint: '地鼠冒出来后停留多久再缩回，越小越难',
    min: 400,
    max: 6000,
    step: 100,
    unit: '毫秒',
  },
  {
    key: 'gameWaveGap',
    label: '波次间隔',
    group: '游戏',
    hint: '上一波缩回后隔多久出下一波',
    min: 0,
    max: 2000,
    step: 50,
    unit: '毫秒',
  },
  {
    key: 'gameHoles',
    label: '地洞数量',
    group: '游戏',
    hint: '地洞越少越简单',
    min: 3,
    max: 9,
    step: 3,
    options: [3, 6, 9],
    unit: '个',
  },
  {
    key: 'scorePerHit',
    label: '答对得分',
    group: '游戏',
    hint: '基础分，连击会在此基础上加成',
    min: 1,
    max: 100,
    step: 1,
    unit: '分',
  },
  {
    key: 'scorePenalty',
    label: '答错扣分',
    group: '游戏',
    hint: '点错扣多少分，设 0 则不扣分',
    min: 0,
    max: 50,
    step: 1,
    unit: '分',
  },

  {
    key: 'unlockThreshold',
    label: '解锁门槛',
    group: '关卡',
    hint: '掌握多少个词解锁下一关',
    min: 5,
    max: 500,
    step: 5,
    unit: '词',
  },
  {
    key: 'unitSize',
    label: '每关词数',
    group: '关卡',
    hint: '一关覆盖多少个词',
    min: 10,
    max: 300,
    step: 10,
    unit: '词',
  },
  {
    key: 'levelBaseScore',
    label: '通关分数线',
    group: '关卡',
    hint: '第 1 关需要多少分通关',
    min: 10,
    max: 1000,
    step: 10,
    unit: '分',
  },
  {
    key: 'levelScoreStep',
    label: '每关递增',
    group: '关卡',
    hint: '每往后一关，分数线增加多少',
    min: 0,
    max: 200,
    step: 5,
    unit: '分',
  },
  {
    key: 'levelScoreMax',
    label: '分数线上限',
    group: '关卡',
    hint: '分数线涨到这个数就不再涨',
    min: 10,
    max: 2000,
    step: 20,
    unit: '分',
  },

  {
    key: 'coinGameBase',
    label: '通关基础金币',
    group: '通关奖励',
    hint: '通关固定奖励',
    min: 0,
    max: 500,
    step: 5,
    unit: '金币',
  },
  {
    key: 'coinScoreDivisor',
    label: '分数换金币',
    group: '通关奖励',
    hint: '每多少分折算 1 金币，越小给得越多',
    min: 1,
    max: 100,
    step: 1,
    unit: '分/币',
  },
  {
    key: 'gameCoinCap',
    label: '单局金币上限',
    group: '通关奖励',
    hint: '一局游戏最多能拿多少金币',
    min: 0,
    max: 1000,
    step: 10,
    unlimited: true,
    unit: '金币',
  },
  {
    key: 'perfectBonus',
    label: '全对奖励',
    group: '通关奖励',
    hint: '通关且零失误额外奖励',
    min: 0,
    max: 500,
    step: 5,
    unit: '金币',
  },
  {
    key: 'matchPairs',
    label: '配对数量',
    group: '消消乐',
    hint: '一局有多少对词需要配对',
    min: 4,
    max: 16,
    step: 2,
    unit: '对',
  },
  {
    key: 'matchScore',
    label: '配对得分',
    group: '消消乐',
    hint: '每配对成功一对得多少分',
    min: 1,
    max: 50,
    step: 1,
    unit: '分',
  },
  {
    key: 'matchPenalty',
    label: '配错扣分',
    group: '消消乐',
    hint: '配对错误扣多少分，设 0 不扣',
    min: 0,
    max: 30,
    step: 1,
    unit: '分',
  },

  // 打恐龙 Boss（dino）
  {
    key: 'bossHp',
    label: 'Boss 血量',
    group: '打恐龙Boss',
    hint: '恐龙总血量，越大越难打',
    min: 200,
    max: 8000,
    step: 100,
    unit: '血',
  },
  {
    key: 'bossBaseHp',
    label: '我方军营血量',
    group: '打恐龙Boss',
    hint: '军营被恐龙打光就失败，越大越耐打',
    min: 100,
    max: 5000,
    step: 50,
    unit: '血',
  },
  {
    key: 'bossRampInterval',
    label: 'Boss 攻击递增间隔',
    group: '打恐龙Boss',
    hint: '每多少秒，Boss 的攻击力提升一次',
    min: 3,
    max: 60,
    step: 1,
    unit: '秒',
  },
  {
    key: 'bossRampFactor',
    label: 'Boss 攻击递增倍数',
    group: '打恐龙Boss',
    hint: '每次提升的倍数：2=翻倍，1.5=温和，3=凶残',
    min: 1.1,
    max: 5,
    step: 0.1,
    unit: '倍',
  },

  // 单词兵团（battle）
  {
    key: 'battlePlayerHp',
    label: '我方基地血量',
    group: '单词兵团',
    hint: '黄金基地血量，归零则失败',
    min: 50,
    max: 1000,
    step: 10,
    unit: '血',
  },
  {
    key: 'battleEnemyHp',
    label: '敌方基地血量',
    group: '单词兵团',
    hint: '蓝翼基地血量，归零则获胜',
    min: 50,
    max: 1000,
    step: 10,
    unit: '血',
  },
  {
    key: 'battleEnemyInterval',
    label: '敌军增援间隔',
    group: '单词兵团',
    hint: '每隔多少毫秒派一只敌军，越长越松',
    min: 1000,
    max: 8000,
    step: 200,
    unit: '毫秒',
  },
  {
    key: 'battlePlayerDmg',
    label: '小兵攻击力',
    group: '单词兵团',
    hint: '我方小兵每帧对敌伤害',
    min: 0.1,
    max: 20,
    step: 0.1,
    unit: '点',
  },
  {
    key: 'battleEnemyDmg',
    label: '敌军攻击力',
    group: '单词兵团',
    hint: '敌军每帧对我方伤害',
    min: 0.1,
    max: 20,
    step: 0.1,
    unit: '点',
  },

  // 词语保卫战（garden）
  {
    key: 'gardenBaseHp',
    label: '家园血量',
    group: '词语保卫战',
    hint: '僵尸突破到此值就失败',
    min: 50,
    max: 1000,
    step: 10,
    unit: '血',
  },
  {
    key: 'gardenWaves',
    label: '总波数',
    group: '词语保卫战',
    hint: '守住多少波僵尸即获胜',
    min: 5,
    max: 50,
    step: 1,
    unit: '波',
  },
  {
    key: 'gardenWaveInterval',
    label: '出波间隔',
    group: '词语保卫战',
    hint: '每隔多少毫秒来一波僵尸，越长越松',
    min: 1000,
    max: 6000,
    step: 200,
    unit: '毫秒',
  },
  {
    key: 'gardenZombieHp',
    label: '僵尸基础血量',
    group: '词语保卫战',
    hint: '第 1 波僵尸血量，之后每波 +5',
    min: 10,
    max: 200,
    step: 2,
    unit: '血',
  },
]

export const SETTING_GROUPS = ['学习', '金币', '游戏', '消消乐', '打恐龙Boss', '单词兵团', '词语保卫战', '关卡', '通关奖励'] as const

export function clampSetting(meta: FieldMeta, raw: number): number {
  if (!Number.isFinite(raw)) return DEFAULT_SETTINGS[meta.key] as number
  if (meta.unlimited && raw <= 0) return 0
  const v = Math.min(meta.max, Math.max(meta.min, raw))
  return meta.step >= 1 ? Math.round(v) : Math.round(v * 10) / 10
}

export function targetScoreFor(settings: GameSettings, levelIndex: number): number {
  return Math.min(settings.levelBaseScore + levelIndex * settings.levelScoreStep, settings.levelScoreMax)
}

export function matchTargetFor(settings: GameSettings): number {
  return settings.matchPairs * settings.matchScore
}
