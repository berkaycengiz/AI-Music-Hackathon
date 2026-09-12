import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { HeadCalibration, HeadDirection } from '../types'

const NOSE_TIP = 1
const LEFT_CHEEK = 234
const RIGHT_CHEEK = 454
const FOREHEAD = 10
const CHIN = 152

export const TRACKING_GRACE_MS = 800
export const SMOOTHING_ALPHA = 0.24

export function estimateHorizontalHeadPose(landmarks: NormalizedLandmark[]) {
  const nose = landmarks[NOSE_TIP]
  const leftCheek = landmarks[LEFT_CHEEK]
  const rightCheek = landmarks[RIGHT_CHEEK]
  if (!nose || !leftCheek || !rightCheek) return null

  const faceWidth = Math.abs(rightCheek.x - leftCheek.x)
  if (faceWidth < 0.035) return null
  const midpoint = (leftCheek.x + rightCheek.x) / 2
  return (nose.x - midpoint) / faceWidth
}

export function estimateVerticalHeadPose(landmarks: NormalizedLandmark[]) {
  const nose = landmarks[NOSE_TIP]
  const forehead = landmarks[FOREHEAD]
  const chin = landmarks[CHIN]
  if (!nose || !forehead || !chin) return null

  const faceHeight = Math.abs(chin.y - forehead.y)
  if (faceHeight < 0.05) return null
  const midpoint = (forehead.y + chin.y) / 2
  return (nose.y - midpoint) / faceHeight
}

export function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function buildCalibration(
  neutral: number,
  pitchNeutral: number,
  left: number,
  right: number,
  up: number,
  down: number,
): HeadCalibration {
  const leftRange = Math.abs(left - neutral)
  const rightRange = Math.abs(right - neutral)
  const upRange = Math.abs(up - pitchNeutral)
  const downRange = Math.abs(down - pitchNeutral)
  const horizontalDistinct = (left - neutral) * (right - neutral) < 0
  const verticalDistinct = (up - pitchNeutral) * (down - pitchNeutral) < 0
  const yawRange = Math.min(leftRange, rightRange)
  const pitchRange = Math.min(upRange, downRange)
  const range = Math.min(yawRange, pitchRange)
  return {
    neutral,
    pitchNeutral,
    left,
    right,
    up,
    down,
    yawRange,
    pitchRange,
    range,
    reliable: horizontalDistinct && verticalDistinct && yawRange >= 0.018 && pitchRange >= 0.012,
  }
}

function progressToward(value: number, neutral: number, target: number) {
  const delta = target - neutral
  if (Math.abs(delta) < 0.001) return 0
  return (value - neutral) / delta
}

export function classifyHeadDirection(
  yaw: number,
  pitch: number,
  calibration: HeadCalibration,
  sensitivity: number,
  previous: HeadDirection,
): HeadDirection {
  const entry = 0.72 - sensitivity * 0.42
  const exit = entry * 0.42
  const scores: Record<'LEFT' | 'RIGHT' | 'UP' | 'DOWN', number> = {
    LEFT: progressToward(yaw, calibration.neutral, calibration.left),
    RIGHT: progressToward(yaw, calibration.neutral, calibration.right),
    UP: progressToward(pitch, calibration.pitchNeutral, calibration.up),
    DOWN: progressToward(pitch, calibration.pitchNeutral, calibration.down),
  }

  if (previous !== 'NEUTRAL' && previous !== 'UNKNOWN' && scores[previous] >= exit) return previous

  const ranked = (Object.entries(scores) as Array<[Exclude<HeadDirection, 'NEUTRAL' | 'UNKNOWN'>, number]>)
    .sort(([, a], [, b]) => b - a)
  const [bestDirection, bestScore] = ranked[0]
  const secondScore = ranked[1][1]
  if (bestScore >= entry && bestScore >= secondScore * 1.15) return bestDirection
  return 'NEUTRAL'
}
