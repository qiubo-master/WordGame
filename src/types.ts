export type Stage = 'primary' | 'junior' | 'senior' | 'college' | 'exam' | 'intl'

export type BookCategory = 'syllabus' | 'exam' | 'cambridge' | 'textbook' | 'custom' | 'intl'

export interface Word {
  id: string
  word: string
  phonetic: string
  pos: string
  meaning: string
  example?: string
}

export interface WordBookMeta {
  id: string
  name: string
  category: BookCategory
  stage: Stage
  wordCount: number
  unlockThreshold: number
  description: string
  source: 'builtin' | 'imported'
  unitSize: number
}

export interface WordBook {
  meta: WordBookMeta
  words: Word[]
}

export type WordStatus = 'new' | 'learning' | 'review' | 'mastered'

export type Rating = 'forgot' | 'fuzzy' | 'know' | 'mastered'

export interface UserWordState {
  wordId: string
  bookId: string
  status: WordStatus
  ease: number
  interval: number
  dueAt: number
  reviewCount: number
  correctCount: number
  wrongCount: number
  lastReviewedAt?: number
}

export interface Wallet {
  coins: number
}

export interface CoinLogEntry {
  id: string
  at: number
  amount: number
  reason: string
}

export type ItemEffectType = 'extraTime' | 'slowDown' | 'shield' | 'comboBonus' | 'scoreBonus'

export interface ItemEffect {
  type: ItemEffectType
  value: number
}

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'supreme' | 'mythic'

export interface Item {
  id: string
  name: string
  icon: IconName
  rarity: Rarity
  price: number
  effects: ItemEffect[]
  desc: string
  game?: GameType | 'all'
}

export type IconName = 'clock' | 'snail' | 'shield' | 'star' | 'bolt' | 'gem' | 'flag'

export interface InventoryEntry {
  itemId: string
  qty: number
}

export interface GameLevel {
  id: string
  bookId: string
  index: number
  name: string
  wordIds: string[]
  requiredWords: number
  targetScore: number
}

export interface LevelProgress {
  levelId: string
  status: 'locked' | 'unlocked' | 'cleared'
  bestScore: number
  stars: number
  clearedAt?: number
}

export interface WrongEntry {
  wordId: string
  bookId: string
  wrongCount: number
  correctStreak: number
  addedAt: number
  lastWrongAt: number
}

export interface UserProfile {
  id: string
  nickname: string
  color: string
  createdAt: number
}

export interface DailyStat {
  date: string
  newWords: number
  reviewWords: number
  correctCount: number
  wrongCount: number
  studySeconds: number
  gameSeconds: number
  coinsEarned: number
  gamesPlayed: number
}

export interface GameResult {
  levelId: string
  bookId: string
  score: number
  correct: number
  wrong: number
  maxCombo: number
  durationMs: number
  coinsEarned: number
  passed: boolean
  playedAt: number
  targetScore: number
}

export interface UserData {
  profile: UserProfile
  activeBookId: string | null
  wordStates: Record<string, UserWordState>
  wallet: Wallet
  coinLogs: CoinLogEntry[]
  inventory: InventoryEntry[]
  equipped: (string | null)[]
  levelProgress: Record<string, LevelProgress>
  dailyStats: Record<string, DailyStat>
  gameHistory: GameResult[]
  wrongWords: Record<string, WrongEntry>
  streak: number
  lastActiveDate: string
}

export interface AuthInfo {
  token: string
  userId: string
  username: string
  phone: string
}

export interface AppState {
  version: number
  users: Record<string, UserData>
  userOrder: string[]
  currentUserId: string | null
  settings: GameSettings
  auth: AuthInfo | null
}

export type ViewName =
  | 'home'
  | 'books'
  | 'study'
  | 'levels'
  | 'game'
  | 'bag'
  | 'shop'
  | 'admin'
  | 'mistakes'

export interface GameSettings {
  dailyNewLimit: number
  reviewSessionLimit: number

  coinNewWord: number
  coinReviewCorrect: number
  coinComboStep: number
  coinComboBonus: number
  dailyCoinCap: number
  coinMultiplier: number
  coinWrongPenalty: number

  gameDuration: number
  gameMoleVisible: number
  gameWaveGap: number
  gameHoles: number
  scorePerHit: number
  scorePenalty: number

  matchPairs: number
  matchScore: number
  matchPenalty: number

  // 打恐龙 Boss（dino）
  bossHp: number
  bossBaseHp: number
  bossRampInterval: number
  bossRampFactor: number

  // 单词兵团（battle）
  battlePlayerHp: number
  battleEnemyHp: number
  battleEnemyInterval: number
  battlePlayerDmg: number
  battleEnemyDmg: number

  // 词语保卫战（garden）
  gardenBaseHp: number
  gardenWaves: number
  gardenWaveInterval: number
  gardenZombieHp: number

  levelBaseScore: number
  levelScoreStep: number
  levelScoreMax: number

  coinGameBase: number
  coinScoreDivisor: number
  gameCoinCap: number
  perfectBonus: number

  unlockThreshold: number
  unitSize: number
  soundOn: boolean

  adminPasscode: string
}

export type GameType = 'whack' | 'match' | 'battle' | 'garden' | 'dino'
