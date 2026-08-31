import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  AppState,
  AuthInfo,
  CoinLogEntry,
  DailyStat,
  GameResult,
  GameSettings,
  Rating,
  UserData,
  UserProfile,
  UserWordState,
  WrongEntry,
} from '../types'
import { applyRating, startOfDay, todayKey } from '../engine/sm2'
import { coinsForCombo, coinsForStudy } from '../engine/economy'
import { getItem } from '../engine/items'
import { starsForScore } from '../engine/levels'
import { DEFAULT_SETTINGS } from '../engine/settings'
import { apiPutSave, getAuth, saveAuth } from '../engine/api'

export const AVATAR_COLORS = ['#185FA5', '#0F6E56', '#993C1D', '#534AB7', '#A32D2D', '#3B6D11']

const STORAGE_KEY = 'wordquest-v1'
const HISTORY_CAP = 50
const LOG_CAP = 200

function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function emptyDaily(date: string): DailyStat {
  return {
    date,
    newWords: 0,
    reviewWords: 0,
    correctCount: 0,
    wrongCount: 0,
    studySeconds: 0,
    gameSeconds: 0,
    coinsEarned: 0,
    gamesPlayed: 0,
  }
}

function makeUser(nickname: string, color: string): UserData {
  const profile: UserProfile = {
    id: uid(),
    nickname,
    color,
    createdAt: Date.now(),
  }
  return {
    profile,
    activeBookId: null,
    wordStates: {},
    wallet: { coins: 0 },
    coinLogs: [],
    inventory: [],
    equipped: [null, null, null],
    levelProgress: {},
    dailyStats: {},
    gameHistory: [],
    wrongWords: {},
    streak: 1,
    lastActiveDate: todayKey(),
  }
}

export const WRONG_CLEAR_STREAK = 2

function previousKey(key: string): string {
  const [y, m, d] = key.split('-').map(Number)
  const dt = new Date(y, m - 1, d)
  dt.setDate(dt.getDate() - 1)
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(
    dt.getDate(),
  ).padStart(2, '0')}`
}

function ensureToday(user: UserData): UserData {
  const key = todayKey()
  if (user.lastActiveDate === key && user.dailyStats[key]) return user

  const streak = user.lastActiveDate === previousKey(key) ? user.streak + 1 : 1
  const stats = { ...user.dailyStats }
  if (!stats[key]) stats[key] = emptyDaily(key)

  return { ...user, lastActiveDate: key, streak, dailyStats: stats }
}

export interface RateOutcome {
  coins: number
  comboBonus: number
  dailyCapped: boolean
}

interface AppActions {
  createUser: (nickname: string, colorIndex: number) => void
  switchUser: (userId: string) => void
  logout: () => void
  removeUser: (userId: string) => void
  applyLogin: (auth: AuthInfo, remoteUser: UserData | null) => void
  signOut: () => void
  setActiveBook: (bookId: string) => void
  rateWord: (wordId: string, rating: Rating, sessionStreak: number) => RateOutcome
  addCoins: (amount: number, reason: string) => void
  spendCoins: (amount: number, reason: string) => boolean
  buyItem: (itemId: string) => boolean
  equipItem: (itemId: string, slot: number) => void
  unequipSlot: (slot: number) => void
  recordGameResult: (result: GameResult) => void
  touch: () => void
  markWrong: (wordId: string, bookId: string) => void
  markRight: (wordId: string) => boolean
  clearWrongWord: (wordId: string) => void
  updateSettings: (patch: Partial<GameSettings>) => void
  resetSettings: () => void
  verifyPasscode: (code: string) => boolean
  consumeEquipped: () => void
  penalizeWrong: () => void
}

export type AppStore = AppState & AppActions & { currentUser: () => UserData | null }

export const useAppStore = create<AppStore>()(
  persist(
    (set, get) => ({
      version: 1,
      users: {},
      userOrder: [],
      currentUserId: null,
      settings: { ...DEFAULT_SETTINGS },
      auth: getAuth(),

      currentUser: () => {
        const s = get()
        if (!s.currentUserId) return null
        return s.users[s.currentUserId] ?? null
      },

      touch: () =>
        set((s) => {
          if (!s.currentUserId) return s
          const u = s.users[s.currentUserId]
          if (!u) return s
          return { users: { ...s.users, [u.profile.id]: ensureToday(u) } }
        }),

      createUser: (nickname, colorIndex) =>
        set((s) => {
          const color = AVATAR_COLORS[colorIndex % AVATAR_COLORS.length]
          const user = makeUser(nickname.trim() || '小勇士', color)
          return {
            users: { ...s.users, [user.profile.id]: user },
            userOrder: [...s.userOrder, user.profile.id],
            currentUserId: user.profile.id,
          }
        }),

      switchUser: (userId) => set({ currentUserId: userId }),

      logout: () => set({ currentUserId: null }),

      applyLogin: (auth, remoteUser) =>
        set((s) => {
          saveAuth(auth)
          if (
            remoteUser &&
            remoteUser.profile &&
            typeof remoteUser.profile.id === 'string' &&
            remoteUser.wallet &&
            typeof remoteUser.wallet.coins === 'number' &&
            remoteUser.wordStates &&
            typeof remoteUser.wordStates === 'object' &&
            remoteUser.levelProgress &&
            typeof remoteUser.levelProgress === 'object' &&
            remoteUser.dailyStats &&
            typeof remoteUser.dailyStats === 'object'
          ) {
            const id = remoteUser.profile.id
            const userOrder = s.userOrder.includes(id) ? s.userOrder : [...s.userOrder, id]
            return { auth, users: { ...s.users, [id]: remoteUser }, userOrder, currentUserId: id }
          }
          // 云端无存档或数据不完整：本地游客进度并入账号；本地也空则按用户名建新学习者
          if (s.currentUserId && s.users[s.currentUserId]) return { auth }
          const user = makeUser(auth.username, AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)])
          return {
            auth,
            users: { ...s.users, [user.profile.id]: user },
            userOrder: [...s.userOrder, user.profile.id],
            currentUserId: user.profile.id,
          }
        }),

      signOut: () => {
        saveAuth(null)
        set({ auth: null, currentUserId: null })
      },

      removeUser: (userId) =>
        set((s) => {
          const users = { ...s.users }
          delete users[userId]
          const order = s.userOrder.filter((id) => id !== userId)
          return {
            users,
            userOrder: order,
            currentUserId: s.currentUserId === userId ? order[0] ?? null : s.currentUserId,
          }
        }),

      setActiveBook: (bookId) =>
        set((s) => {
          if (!s.currentUserId) return s
          const u = ensureToday(s.users[s.currentUserId])
          return { users: { ...s.users, [u.profile.id]: { ...u, activeBookId: bookId } } }
        }),

      rateWord: (wordId, rating, sessionStreak) => {
        const s = get()
        if (!s.currentUserId) return { coins: 0, comboBonus: 0, dailyCapped: false }
        let user = ensureToday(s.users[s.currentUserId])
        const bookId = user.activeBookId
        if (!bookId) return { coins: 0, comboBonus: 0, dailyCapped: false }

        const prev: UserWordState | undefined = user.wordStates[wordId]
        const isNew = !prev || prev.status === 'new'
        const next = applyRating(prev, wordId, bookId, rating, Date.now())
        const correct = rating === 'know' || rating === 'mastered'

        const cfg = s.settings
        const raw = coinsForStudy(cfg, rating, isNew)
        const key = todayKey()
        const earnedToday = user.dailyStats[key]?.coinsEarned ?? 0
        const room = cfg.dailyCoinCap > 0 ? Math.max(0, cfg.dailyCoinCap - earnedToday) : Infinity
        const coins = Math.min(raw, room)
        const dailyCapped = raw > room

        const comboBonus = correct ? Math.min(coinsForCombo(cfg, sessionStreak), room - coins) : 0

        const stats = user.dailyStats[key] ?? emptyDaily(key)
        const logs: CoinLogEntry[] = [...user.coinLogs]
        if (coins > 0) {
          logs.unshift({ id: uid(), at: Date.now(), amount: coins, reason: isNew ? '新学单词' : '复习答对' })
        }
        if (comboBonus > 0) {
          logs.unshift({ id: uid(), at: Date.now(), amount: comboBonus, reason: '连击奖励' })
        }

        user = {
          ...user,
          wordStates: { ...user.wordStates, [wordId]: next },
          wallet: { coins: user.wallet.coins + coins + comboBonus },
          coinLogs: logs.slice(0, LOG_CAP),
          dailyStats: {
            ...user.dailyStats,
            [key]: {
              ...stats,
              newWords: stats.newWords + (isNew && correct ? 1 : 0),
              reviewWords: stats.reviewWords + (!isNew ? 1 : 0),
              correctCount: stats.correctCount + (correct ? 1 : 0),
              wrongCount: stats.wrongCount + (correct ? 0 : 1),
              coinsEarned: stats.coinsEarned + coins + comboBonus,
            },
          },
        }

        set({ users: { ...s.users, [user.profile.id]: user } })
        return { coins, comboBonus, dailyCapped }
      },

      addCoins: (amount, reason) =>
        set((s) => {
          if (!s.currentUserId) return s
          const u = ensureToday(s.users[s.currentUserId])
          const key = todayKey()
          const stats = u.dailyStats[key] ?? emptyDaily(key)
          const logs: CoinLogEntry[] = [
            { id: uid(), at: Date.now(), amount, reason },
            ...u.coinLogs,
          ].slice(0, LOG_CAP)
          return {
            users: {
              ...s.users,
              [u.profile.id]: {
                ...u,
                wallet: { coins: u.wallet.coins + amount },
                coinLogs: logs,
                dailyStats: {
                  ...u.dailyStats,
                  [key]: { ...stats, coinsEarned: stats.coinsEarned + amount },
                },
              },
            },
          }
        }),

      spendCoins: (amount, reason) => {
        const s = get()
        if (!s.currentUserId) return false
        const u = s.users[s.currentUserId]
        if (!u || u.wallet.coins < amount) return false
        const logs: CoinLogEntry[] = [
          { id: uid(), at: Date.now(), amount: -amount, reason },
          ...u.coinLogs,
        ].slice(0, LOG_CAP)
        set({
          users: {
            ...s.users,
            [u.profile.id]: {
              ...u,
              wallet: { coins: u.wallet.coins - amount },
              coinLogs: logs,
            },
          },
        })
        return true
      },

      buyItem: (itemId) => {
        const item = getItem(itemId)
        if (!item) return false
        const s = get()
        if (!s.currentUserId) return false
        const u = s.users[s.currentUserId]
        if (!u || u.wallet.coins < item.price) return false

        const inv = [...u.inventory]
        const hit = inv.find((e) => e.itemId === itemId)
        if (hit) hit.qty += 1
        else inv.push({ itemId, qty: 1 })

        const logs: CoinLogEntry[] = [
          { id: uid(), at: Date.now(), amount: -item.price, reason: `购买 ${item.name}` },
          ...u.coinLogs,
        ].slice(0, LOG_CAP)

        set({
          users: {
            ...s.users,
            [u.profile.id]: {
              ...u,
              inventory: inv,
              wallet: { coins: u.wallet.coins - item.price },
              coinLogs: logs,
            },
          },
        })
        return true
      },

      equipItem: (itemId, slot) =>
        set((s) => {
          if (!s.currentUserId) return s
          const u = s.users[s.currentUserId]
          if (!u) return s
          const owned = u.inventory.some((e) => e.itemId === itemId)
          if (!owned) return s
          const equipped = [...u.equipped]
          equipped[slot] = itemId
          return { users: { ...s.users, [u.profile.id]: { ...u, equipped } } }
        }),

      unequipSlot: (slot) =>
        set((s) => {
          if (!s.currentUserId) return s
          const u = s.users[s.currentUserId]
          if (!u) return s
          const equipped = [...u.equipped]
          equipped[slot] = null
          return { users: { ...s.users, [u.profile.id]: { ...u, equipped } } }
        }),

      recordGameResult: (result) =>
        set((s) => {
          if (!s.currentUserId) return s
          const u = ensureToday(s.users[s.currentUserId])
          const key = todayKey()
          const stats = u.dailyStats[key] ?? emptyDaily(key)
          const prev = u.levelProgress[result.levelId]
          const stars = starsForScore(result.score, result.targetScore)
          const best = Math.max(prev?.bestScore ?? 0, result.score)
          const cleared = result.passed || prev?.status === 'cleared'

          const logs: CoinLogEntry[] = [
            {
              id: uid(),
              at: Date.now(),
              amount: result.coinsEarned,
              reason: result.passed ? '通关奖励' : '参与奖励',
            },
            ...u.coinLogs,
          ].slice(0, LOG_CAP)

          return {
            users: {
              ...s.users,
              [u.profile.id]: {
                ...u,
                wallet: { coins: u.wallet.coins + result.coinsEarned },
                coinLogs: logs,
                levelProgress: {
                  ...u.levelProgress,
                  [result.levelId]: {
                    levelId: result.levelId,
                    bookId: result.bookId,
                    status: cleared ? 'cleared' : 'unlocked',
                    bestScore: best,
                    stars: Math.max(prev?.stars ?? 0, stars),
                    clearedAt: result.passed ? Date.now() : prev?.clearedAt,
                  },
                },
                gameHistory: [result, ...u.gameHistory].slice(0, HISTORY_CAP),
                dailyStats: {
                  ...u.dailyStats,
                  [key]: {
                    ...stats,
                    gameSeconds: stats.gameSeconds + Math.round(result.durationMs / 1000),
                    gamesPlayed: stats.gamesPlayed + 1,
                    coinsEarned: stats.coinsEarned + result.coinsEarned,
                  },
                },
              },
            },
          }
        }),

      markWrong: (wordId, bookId) =>
        set((s) => {
          if (!s.currentUserId) return s
          const u = ensureToday(s.users[s.currentUserId])
          const prev = u.wrongWords[wordId]
          const next: WrongEntry = {
            wordId,
            bookId,
            wrongCount: (prev?.wrongCount ?? 0) + 1,
            correctStreak: 0,
            addedAt: prev?.addedAt ?? Date.now(),
            lastWrongAt: Date.now(),
          }
          return {
            users: { ...s.users, [u.profile.id]: { ...u, wrongWords: { ...u.wrongWords, [wordId]: next } } },
          }
        }),

      markRight: (wordId) => {
        const s = get()
        if (!s.currentUserId) return false
        const u = s.users[s.currentUserId]
        const entry = u?.wrongWords[wordId]
        if (!entry) return false
        const streak = entry.correctStreak + 1
        const wrongWords = { ...u.wrongWords }
        const mastered = streak >= WRONG_CLEAR_STREAK
        if (mastered) delete wrongWords[wordId]
        else wrongWords[wordId] = { ...entry, correctStreak: streak }
        const previousState = u.wordStates[wordId]
        const wordStates = mastered && previousState
          ? { ...u.wordStates, [wordId]: { ...previousState, status: 'mastered' as const } }
          : u.wordStates
        set({ users: { ...s.users, [u.profile.id]: { ...u, wrongWords, wordStates } } })
        return mastered
      },

      clearWrongWord: (wordId) =>
        set((s) => {
          if (!s.currentUserId) return s
          const u = s.users[s.currentUserId]
          if (!u?.wrongWords[wordId]) return s
          const wrongWords = { ...u.wrongWords }
          delete wrongWords[wordId]
          return { users: { ...s.users, [u.profile.id]: { ...u, wrongWords } } }
        }),

      updateSettings: (patch) =>
        set((s) => ({ settings: { ...s.settings, ...patch } })),

      resetSettings: () => set({ settings: { ...DEFAULT_SETTINGS } }),

      verifyPasscode: (code) => get().settings.adminPasscode === code,

      consumeEquipped: () => {
        const s = get()
        if (!s.currentUserId) return
        const u = s.users[s.currentUserId]
        if (!u) return
        let inv = [...u.inventory]
        const equipped = [...u.equipped]
        for (let i = 0; i < equipped.length; i++) {
          const id = equipped[i]
          if (!id) continue
          const hit = inv.find((e) => e.itemId === id)
          if (!hit) {
            equipped[i] = null
            continue
          }
          if (hit.qty <= 1) inv = inv.filter((e) => e.itemId !== id)
          else inv = inv.map((e) => (e.itemId === id ? { ...e, qty: e.qty - 1 } : e))
          equipped[i] = null
        }
        set({ users: { ...s.users, [u.profile.id]: { ...u, inventory: inv, equipped } } })
      },

      penalizeWrong: () => {
        const s = get()
        if (!s.currentUserId) return
        const u = s.users[s.currentUserId]
        if (!u) return
        const amount = s.settings.coinWrongPenalty
        if (amount <= 0) return
        const after = Math.max(0, u.wallet.coins - amount)
        const real = u.wallet.coins - after
        if (real <= 0) return
        const logs: CoinLogEntry[] = [
          { id: uid(), at: Date.now(), amount: -real, reason: '答错扣分' },
          ...u.coinLogs,
        ].slice(0, LOG_CAP)
        set({
          users: {
            ...s.users,
            [u.profile.id]: { ...u, wallet: { coins: after }, coinLogs: logs },
          },
        })
      },
    }),
    {
      name: STORAGE_KEY,
      version: 1,
      partialize: (s) => ({
        version: s.version,
        users: s.users,
        userOrder: s.userOrder,
        currentUserId: s.currentUserId,
        settings: s.settings,
        auth: s.auth,
      }),
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<AppState>
        return {
          ...current,
          ...p,
          settings: { ...DEFAULT_SETTINGS, ...(p.settings ?? {}) },
        }
      },
    },
  ),
)

export function useCurrentUser(): UserData | null {
  return useAppStore((s) => (s.currentUserId ? s.users[s.currentUserId] ?? null : null))
}

let syncTimer: number | null = null

useAppStore.subscribe((s) => {
  if (!s.auth || !s.currentUserId || !s.users[s.currentUserId]) return
  if (syncTimer) window.clearTimeout(syncTimer)
  syncTimer = window.setTimeout(async () => {
    syncTimer = null
    const st = useAppStore.getState()
    if (!st.auth || !st.currentUserId) return
    const u = st.users[st.currentUserId]
    if (!u) return
    try {
      await apiPutSave(u)
    } catch {
      /* 离线或后端未启动：静默降级，下次状态变化自动重试 */
    }
  }, 3000)
})

export function useSettings(): GameSettings {
  return useAppStore((s) => s.settings)
}

export function dayStart(): number {
  return startOfDay()
}
