import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
import type { HeadCalibration, HeadDirection } from '../types'

const NOSE_TIP = 1
const LEFT_CHEEK = 234
const RIGHT_CHEEK = 454

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

export function median(values: number[]) {
  if (!values.length) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2
}

export function buildCalibration(neutral: number, left: number, right: number): HeadCalibration {
  const leftRange = Math.abs(left - neutral)
  const rightRange = Math.abs(right - neutral)
  const directionsAreDistinct = (left - neutral) * (right - neutral) < 0
  const range = Math.min(leftRange, rightRange)
  return {
    neutral,
    left,
    right,
    range,
    reliable: directionsAreDistinct && range >= 0.018,
  }
}

function progressToward(value: number, neutral: number, target: number) {
  const delta = target - neutral
  if (Math.abs(delta) < 0.001) return 0
  return (value - neutral) / delta
}

export function classifyHeadDirection(
  value: number,
  calibration: HeadCalibration,
  sensitivity: number,
  previous: HeadDirection,
): HeadDirection {
  const entry = 0.72 - sensitivity * 0.42
  const exit = entry * 0.42
  const leftProgress = progressToward(value, calibration.neutral, calibration.left)
  const rightProgress = progressToward(value, calibration.neutral, calibration.right)

  if (previous === 'LEFT' && leftProgress >= exit) return 'LEFT'
  if (previous === 'RIGHT' && rightProgress >= exit) return 'RIGHT'
  if (leftProgress >= entry && leftProgress > rightProgress) return 'LEFT'
  if (rightProgress >= entry && rightProgress > leftProgress) return 'RIGHT'
  return 'NEUTRAL'
}
