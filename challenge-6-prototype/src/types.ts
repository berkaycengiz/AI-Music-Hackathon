import type { NormalizedLandmark } from '@mediapipe/tasks-vision'

export type InstrumentState =
  | 'IDLE'
  | 'REQUESTING_CAMERA'
  | 'CALIBRATING_NEUTRAL'
  | 'CALIBRATING_LEFT'
  | 'CALIBRATING_RIGHT'
  | 'CALIBRATING_UP'
  | 'CALIBRATING_DOWN'
  | 'CALIBRATION_REVIEW'
  | 'READY'
  | 'PLAYING'
  | 'TRACKING_LOST'
  | 'ERROR'

export type HeadDirection = 'LEFT' | 'NEUTRAL' | 'RIGHT' | 'UP' | 'DOWN' | 'UNKNOWN'

export type FaceFrame = {
  landmarks: NormalizedLandmark[] | null
  rawYaw: number | null
  rawPitch: number | null
  timestamp: number
}

export type HeadCalibration = {
  neutral: number
  pitchNeutral: number
  left: number
  right: number
  up: number
  down: number
  yawRange: number
  pitchRange: number
  reliable: boolean
  range: number
}

export type Chord = {
  id: string
  name: string
  shortName: string
  notes: string[]
  numeral: string
  degree: Degree
}

export type Degree = 1 | 2 | 3 | 4 | 5 | 6

export type MusicalAction = 'FORWARD' | 'RESOLVE'

export type GesturePhase =
  | 'NO_FACE'
  | 'NEUTRAL_READY'
  | 'LEFT_CANDIDATE'
  | 'RIGHT_CANDIDATE'
  | 'UP_CANDIDATE'
  | 'DOWN_CANDIDATE'
  | 'WAITING_FOR_RETURN'
  | 'COOLDOWN'
  | 'PAUSED'
