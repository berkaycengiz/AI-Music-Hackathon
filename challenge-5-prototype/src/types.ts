import type { NormalizedLandmark } from '@mediapipe/tasks-vision'
export type AppState = 'IDLE'|'REQUESTING_CAMERA'|'CALIBRATING_REST'|'CALIBRATING_ACTIVE'|'READY'|'PERFORMING'|'TRACKING_LOST'|'ERROR'
export type PoseFrame = { landmarks: NormalizedLandmark[] | null; velocity: number | null; centerX: number; timestamp: number }
export type Calibration = { restBaseline: number; activeReference: number }
