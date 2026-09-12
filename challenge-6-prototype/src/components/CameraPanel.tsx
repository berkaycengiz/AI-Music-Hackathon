import type { RefObject } from 'react'
import type { HeadDirection, InstrumentState } from '../types'

type Props = {
  videoRef: RefObject<HTMLVideoElement | null>
  canvasRef: RefObject<HTMLCanvasElement | null>
  cameraOn: boolean
  faceDetected: boolean
  direction: HeadDirection
  state: InstrumentState
  instruction: string
  calibrationProgress: number
}

const isCalibrationState = (state: InstrumentState) => state.startsWith('CALIBRATING_')

export function CameraPanel({
  videoRef,
  canvasRef,
  cameraOn,
  faceDetected,
  direction,
  state,
  instruction,
  calibrationProgress,
}: Props) {
  return (
    <section className="camera-panel" aria-label="Camera preview">
      <div className="camera-frame">
        <video ref={videoRef} muted playsInline className={cameraOn ? '' : 'hidden'} />
        <canvas ref={canvasRef} className={cameraOn ? '' : 'hidden'} />
        {!cameraOn && (
          <div className="camera-empty">
            <span className="camera-glyph" aria-hidden="true">◉</span>
            <strong>Camera is off</strong>
            <span>It starts only when you choose Start.</span>
          </div>
        )}
        {cameraOn && <div className="local-badge"><span /> Processed on this device</div>}
        {cameraOn && (
          <div className={`face-status ${faceDetected ? 'detected' : ''}`}>
            {faceDetected ? 'Face found' : 'Looking for face'}
          </div>
        )}
        {cameraOn && isCalibrationState(state) && (
          <div className="calibration-card" aria-live="polite">
            <span>PERSONAL CALIBRATION</span>
            <strong>{instruction}</strong>
            <small>Move only within a comfortable range.</small>
            <div className="calibration-track" aria-hidden="true">
              <i style={{ width: `${calibrationProgress * 100}%` }} />
            </div>
          </div>
        )}
        {cameraOn && !isCalibrationState(state) && state !== 'REQUESTING_CAMERA' && (
          <div className={`direction-readout direction-${direction.toLowerCase()}`} aria-live="polite">
            <span>HEAD DIRECTION</span>
            <strong>{direction === 'UNKNOWN' ? '—' : direction}</strong>
          </div>
        )}
      </div>
      <div className="privacy-line">
        <span aria-hidden="true">●</span>
        <span>Video is processed locally and is not recorded.</span>
      </div>
      {state === 'TRACKING_LOST' && <div className="camera-warning" role="status">Tracking paused. Move back into view to continue.</div>}
    </section>
  )
}
