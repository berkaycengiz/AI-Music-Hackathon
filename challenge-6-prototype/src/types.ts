import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type InstrumentState =
  | 'IDLE'
  | 'REQUESTING_CAMERA'
  | 'CALIBRATING_NEUTRAL'
  | 'CALIBRATING_LEFT'
  | 'CALIBRATING_RIGHT'
  | 'CALIBRATION_REVIEW'
  | 'READY'
  | 'PLAYING'
  | 'TRACKING_LOST'
  | 'ERROR'

export type HeadDirection = 'LEFT' | 'NEUTRAL' | 'RIGHT' | 'UNKNOWN'

export type FaceFrame = {
  landmarks: NormalizedLandmark[] | null
  rawYaw: number | null
  timestamp: number
}

export type HeadCalibration = {
  neutral: number
  left: number
  right: number
  reliable: boolean
  range: number
}

export type Chord = {
  id: string
  name: string
  shortName: string
  notes: string[]
  numeral: string
}
