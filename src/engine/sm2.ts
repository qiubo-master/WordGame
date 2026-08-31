import type { Rating, UserWordState, Word } from '../types'

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE

export const INTERVAL_LADDER = [0, 1, 2, 4, 7, 15, 30, 60, 120]

const MIN_EASE = 1.3
const MAX_EASE = 2.8

export function todayKey(now: number = Date.now()): string {
  const d = new Date(now)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function startOfDay(now: number = Date.now()): number {
  const d = new Date(now)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

export function addDays(ts: number, days: number): number {
  return ts + days * DAY
}

function clampEase(ease: number): number {
  return Math.min(MAX_EASE, Math.max(MIN_EASE, ease))
}

function stepUp(interval: number, steps: number): number {
  let idx = INTERVAL_LADDER.indexOf(interval)
  if (idx < 0) {
    idx = 0
    for (let i = 0; i < INTERVAL_LADDER.length; i++) {
      if (INTERVAL_LADDER[i] <= interval) idx = i
    }
  }
  const next = Math.min(idx + steps, INTERVAL_LADDER.length - 1)
  return INTERVAL_LADDER[next]
}

function stepDown(interval: number): number {
  let idx = INTERVAL_LADDER.indexOf(interval)
  if (idx < 0) idx = 1
  return INTERVAL_LADDER[Math.max(0, idx - 1)]
}

export function createInitialState(wordId: string, bookId: string): UserWordState {
  return {
    wordId,
    bookId,
    status: 'new',
    ease: 2.5,
    interval: 0,
    dueAt: 0,
    reviewCount: 0,
    correctCount: 0,
    wrongCount: 0,
  }
}

export function applyRating(
  prev: UserWordState | undefined,
  wordId: string,
  bookId: string,
  rating: Rating,
  now: number = Date.now(),
): UserWordState {
  const base = prev ?? createInitialState(wordId, bookId)
  const ease = clampEase(base.ease)
  const isCorrect = rating === 'know' || rating === 'mastered'
  const dayStart = startOfDay(now)

  let status: UserWordState['status']
  let interval: number
  let dueAt: number
  let nextEase = ease

  if (rating === 'forgot') {
    status = 'learning'
    interval = 0
    dueAt = now + 5 * MINUTE
    nextEase = clampEase(ease - 0.2)
  } else if (rating === 'fuzzy') {
    status = 'learning'
    interval = stepDown(base.interval)
    dueAt = interval === 0 ? now + 15 * MINUTE : addDays(dayStart, interval)
    nextEase = clampEase(ease - 0.1)
  } else if (rating === 'know') {
    interval = base.interval === 0 ? 1 : stepUp(base.interval, 1)
    status = 'review'
    dueAt = addDays(dayStart, interval)
    nextEase = clampEase(ease + 0.05)
  } else {
    interval = base.interval === 0 ? 7 : stepUp(base.interval, 2)
    status = 'mastered'
    dueAt = addDays(dayStart, interval)
    nextEase = clampEase(ease + 0.1)
  }

  return {
    wordId,
    bookId,
    status,
    ease: nextEase,
    interval,
    dueAt,
    reviewCount: base.reviewCount + 1,
    correctCount: base.correctCount + (isCorrect ? 1 : 0),
    wrongCount: base.wrongCount + (isCorrect ? 0 : 1),
    lastReviewedAt: now,
  }
}

export function isDue(state: UserWordState | undefined, now: number): boolean {
  if (!state) return true
  if (state.status === 'new') return true
  return state.dueAt <= now
}

export interface StudyQueue {
  reviewWords: Word[]
  newWords: Word[]
}

export function buildStudyQueue(
  words: Word[],
  states: Record<string, UserWordState>,
  newLimit: number,
  reviewLimit: number,
  now: number = Date.now(),
): StudyQueue {
  const dueReview: Word[] = []
  const fresh: Word[] = []

  for (const w of words) {
    const st = states[w.id]
    if (!st || st.status === 'new') {
      if (fresh.length < newLimit) fresh.push(w)
    } else if (isDue(st, now)) {
      if (dueReview.length < reviewLimit) dueReview.push(w)
    }
  }

  return { reviewWords: dueReview, newWords: fresh }
}

export function countByStatus(states: Record<string, UserWordState>): {
  newCount: number
  learningCount: number
  reviewCount: number
  masteredCount: number
} {
  let newCount = 0
  let learningCount = 0
  let reviewCount = 0
  let masteredCount = 0
  for (const key in states) {
    const s = states[key]
    if (s.status === 'new') newCount++
    else if (s.status === 'learning') learningCount++
    else if (s.status === 'review') reviewCount++
    else masteredCount++
  }
  return { newCount, learningCount, reviewCount, masteredCount }
}
