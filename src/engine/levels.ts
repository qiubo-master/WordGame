import type { GameLevel, GameSettings, UserWordState, Word, WordBook } from '../types'
import { targetScoreFor } from './settings'

export function parseLevelSelection(levelId: string): { baseLevelId: string; sublevel: number | null } {
  const [baseLevelId, rawSublevel] = levelId.split('::')
  const parsed = Number(rawSublevel)
  return {
    baseLevelId,
    sublevel: Number.isInteger(parsed) && parsed >= 1 && parsed <= 5 ? parsed : null,
  }
}

export function wordsForSublevel(wordIds: string[], sublevel: number | null): string[] {
  if (sublevel === null) return wordIds
  const start = (sublevel - 1) * 10
  return wordIds.slice(start, start + 10)
}

export function generateLevels(book: WordBook, s: GameSettings): GameLevel[] {
  const { words, meta } = book
  const size = Math.max(1, s.unitSize)
  const levels: GameLevel[] = []
  for (let i = 0, start = 0; start < words.length; i++, start += size) {
    const slice = words.slice(start, start + size)
    levels.push({
      id: `${meta.id}-L${i + 1}`,
      bookId: meta.id,
      index: i,
      name: `第 ${i + 1} 关`,
      wordIds: slice.map((w) => w.id),
      requiredWords: s.unlockThreshold * (i + 1),
      targetScore: targetScoreFor(s, i),
    })
  }
  return levels
}

export function computeLearnedCount(
  words: Word[],
  states: Record<string, UserWordState>,
): number {
  let n = 0
  for (const w of words) {
    const st = states[w.id]
    if (st && st.correctCount >= 1) n++
  }
  return n
}

export function computeBookLearnedCount(
  bookId: string,
  states: Record<string, UserWordState>,
): number {
  return Object.values(states).reduce(
    (total, state) => total + (state.bookId === bookId && state.correctCount >= 1 ? 1 : 0),
    0,
  )
}

export function computeStudiedCountSince(
  states: Record<string, UserWordState>,
  since: number,
  bookId?: string,
): number {
  return Object.values(states).reduce(
    (total, state) =>
      total +
      (typeof state.lastReviewedAt === 'number' &&
      state.lastReviewedAt >= since &&
      (!bookId || state.bookId === bookId)
        ? 1
        : 0),
    0,
  )
}

export function isLevelUnlocked(level: GameLevel, learnedCount: number): boolean {
  return learnedCount >= level.requiredWords
}

export function starsForScore(score: number, targetScore: number): number {
  if (score < targetScore) return 0
  if (score >= Math.round(targetScore * 1.6)) return 3
  if (score >= Math.round(targetScore * 1.3)) return 2
  return 1
}
