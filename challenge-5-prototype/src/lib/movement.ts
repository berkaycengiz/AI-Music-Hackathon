import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

const TRACKED = [11, 12, 15, 16, 23, 24, 25, 26, 27, 28]
export const SMOOTHING_ALPHA = 0.2
export const TRACKING_GRACE_MS = 650

export function poseVelocity(current: NormalizedLandmark[], previous: NormalizedLandmark[] | null, deltaMs: number) {
  if (!previous || deltaMs <= 0 || deltaMs > 500) return null
  const values = TRACKED.flatMap((index) => {
    const a = current[index], b = previous[index]
    if (!a || !b || (a.visibility ?? 0) < .55 || (b.visibility ?? 0) < .55) return []
    return [Math.hypot(a.x - b.x, a.y - b.y, (a.z - b.z) * .35) / (deltaMs / 1000)]
  }).sort((a, b) => a - b)
  if (values.length < 4) return null
  const robust = values.length >= 8 ? values.slice(1, -1) : values
  return robust.reduce((sum, value) => sum + value, 0) / robust.length
}

export function normalizeEnergy(velocity: number, rest: number, active: number) {
  const raw = Math.min(1, Math.max(0, (velocity - rest) / Math.max(active - rest, .08)))
  return raw < .04 ? 0 : raw
}

export function poseCenterX(landmarks: NormalizedLandmark[]) {
  const left = landmarks[23], right = landmarks[24]
  return left && right ? (left.x + right.x) / 2 : .5
}
