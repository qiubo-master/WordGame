import type { GameSettings, Rating } from '../types'

function applyMult(s: GameSettings, n: number): number {
  return Math.max(0, Math.round(n * s.coinMultiplier))
}

export function coinsForStudy(s: GameSettings, rating: Rating, isNew: boolean): number {
  const correct = rating === 'know' || rating === 'mastered'
  if (!correct) return 0
  return applyMult(s, isNew ? s.coinNewWord : s.coinReviewCorrect)
}

export function coinsForCombo(s: GameSettings, streak: number): number {
  if (streak <= 0 || s.coinComboStep <= 0) return 0
  if (streak % s.coinComboStep !== 0) return 0
  return applyMult(s, s.coinComboBonus)
}

export function coinsForGame(
  s: GameSettings,
  score: number,
  wrong: number,
  passed: boolean,
): number {
  if (s.coinScoreDivisor <= 0) return 0
  if (!passed) return applyMult(s, Math.floor(score / s.coinScoreDivisor / 2))

  const byScore = Math.floor(score / s.coinScoreDivisor)
  const perfect = wrong === 0 ? s.perfectBonus : 0
  const total = s.coinGameBase + byScore + perfect
  const capped = s.gameCoinCap > 0 ? Math.min(total, s.gameCoinCap + perfect) : total
  return applyMult(s, capped)
}
