export interface MinerTreasureHitbox {
  id: string
  x: number
  y: number
  size: number
}

// CSS rotate() uses screen coordinates: rotating a downward vertical line by a
// positive angle moves its tip to the left. This is the single source of truth
// for both rendering a hooked treasure and collision detection.
export function minerHookPoint(angle: number, length: number, aspect: number) {
  const radians = angle * Math.PI / 180
  return {
    x: 50 - Math.sin(radians) * length * aspect,
    y: 13 + Math.cos(radians) * length,
  }
}

export function firstMinerTreasureTouched<T extends MinerTreasureHitbox>(
  items: T[], angle: number, fromLength: number, toLength: number, width: number, height: number,
): T | undefined {
  const radians = angle * Math.PI / 180
  const anchorX = width / 2
  const anchorY = height * .13
  const startDistance = fromLength / 100 * height
  // The emoji hook extends roughly 14 physical pixels beyond the rope end.
  const endDistance = toLength / 100 * height + 14
  const startX = anchorX - Math.sin(radians) * startDistance
  const startY = anchorY + Math.cos(radians) * startDistance
  const endX = anchorX - Math.sin(radians) * endDistance
  const endY = anchorY + Math.cos(radians) * endDistance
  const dx = endX - startX
  const dy = endY - startY
  const segmentLengthSquared = dx * dx + dy * dy || 1

  return items
    .map((item) => {
      const x = item.x / 100 * width
      const y = item.y / 100 * height
      const t = Math.max(0, Math.min(1, ((x - startX) * dx + (y - startY) * dy) / segmentLengthSquared))
      const closestX = startX + t * dx
      const closestY = startY + t * dy
      return {
        item,
        touches: Math.hypot(x - closestX, y - closestY) <= item.size * .45 + 8,
        distance: Math.hypot(x - anchorX, y - anchorY),
      }
    })
    .filter((result) => result.touches)
    .sort((a, b) => a.distance - b.distance)[0]?.item
}
