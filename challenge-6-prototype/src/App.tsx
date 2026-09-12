import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CameraPanel } from './components/CameraPanel'
import { useFaceTracking } from './hooks/useFaceTracking'
import { useMusicEngine } from './hooks/useMusicEngine'
import {
  buildCalibration,
  classifyHeadDirection,
  median,
  SMOOTHING_ALPHA,
  TRACKING_GRACE_MS,
} from './lib/headPose'
import type { Chord, HeadCalibration, HeadDirection, InstrumentState } from './types'

const CALIBRATION_DURATION_MS = 1900

const CHORDS: Chord[] = [
  { id: 'c', name: 'C Major', shortName: 'C', notes: ['C4', 'E4', 'G4'], numeral: 'I' },
  { id: 'am', name: 'A Minor', shortName: 'Am', notes: ['A3', 'C4', 'E4'], numeral: 'vi' },
  { id: 'f', name: 'F Major', shortName: 'F', notes: ['F3', 'A3', 'C4'], numeral: 'IV' },
  { id: 'g', name: 'G Major', shortName: 'G', notes: ['G3', 'B3', 'D4'], numeral: 'V' },
]

const EMPTY_CALIBRATION: HeadCalibration = {
  neutral: 0,
  left: -0.08,
  right: 0.08,
  reliable: true,
  range: 0.08,
}

const CALIBRATION_COPY: Partial<Record<InstrumentState, string>> = {
  CALIBRATING_NEUTRAL: 'Look forward and rest',
  CALIBRATING_LEFT: 'Turn slightly to your left',
  CALIBRATING_RIGHT: 'Turn slightly to your right',
}

function isCalibrationState(state: InstrumentState) {
  return state === 'CALIBRATING_NEUTRAL' || state === 'CALIBRATING_LEFT' || state === 'CALIBRATING_RIGHT'
}

export default function App() {
  const { videoRef, canvasRef, frame, cameraOn, startCamera, stopCamera } = useFaceTracking()
  const { audioReady, startAudio, playChord, playLoop, stopLoop, setBpm: updateEngineBpm } = useMusicEngine()
  const [state, setState] = useState<InstrumentState>('IDLE')
  const [direction, setDirection] = useState<HeadDirection>('UNKNOWN')
  const [calibration, setCalibration] = useState<HeadCalibration>(EMPTY_CALIBRATION)
  const [calibrationProgress, setCalibrationProgress] = useState(0)
  const [focusIndex, setFocusIndex] = useState(0)
  const [dwellProgress, setDwellProgress] = useState(0)
  const [progression, setProgression] = useState<Chord[]>([])
  const [dwellMs, setDwellMs] = useState(1100)
  const [sensitivity, setSensitivity] = useState(0.58)
  const [bpm, setBpm] = useState(92)
  const [isLooping, setIsLooping] = useState(false)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('Instrument is ready to start.')

  const samplesRef = useRef<number[]>([])
  const calibrationPartsRef = useRef({ neutral: 0, left: 0 })
  const phaseStartedAtRef = useRef(0)
  const lastTrackedAtRef = useRef(0)
  const smoothedYawRef = useRef<number | null>(null)
  const previousDirectionRef = useRef<HeadDirection>('UNKNOWN')
  const gestureArmedRef = useRef(true)
  const dwellUnlockedRef = useRef(true)
  const dwellStartedAtRef = useRef(0)
  const focusIndexRef = useRef(0)
  const progressionLengthRef = useRef(0)

  useEffect(() => { focusIndexRef.current = focusIndex }, [focusIndex])
  useEffect(() => { progressionLengthRef.current = progression.length }, [progression.length])

  const selectChordAt = useCallback((index: number) => {
    const chord = CHORDS[index]
    if (!chord) return
    setProgression((current) => {
      if (current.length >= 4) {
        setAnnouncement('Progression is full. Clear it to create another.')
        return current
      }
      playChord(chord)
      const next = [...current, chord]
      setAnnouncement(`${chord.name} selected. ${next.length} of 4 chords.`)
      return next
    })
    dwellUnlockedRef.current = false
    dwellStartedAtRef.current = 0
    setDwellProgress(0)
  }, [playChord])

  const moveFocus = useCallback((delta: number) => {
    setFocusIndex((current) => {
      const next = (current + delta + CHORDS.length) % CHORDS.length
      focusIndexRef.current = next
      setAnnouncement(`${CHORDS[next].name} focused. Return to neutral to select.`)
      return next
    })
    dwellUnlockedRef.current = true
    dwellStartedAtRef.current = 0
    setDwellProgress(0)
  }, [])

  useEffect(() => {
    if (!frame.timestamp || !cameraOn) return

    if (isCalibrationState(state)) {
      if (frame.rawYaw == null) {
        phaseStartedAtRef.current = 0
        samplesRef.current = []
        setCalibrationProgress(0)
        return
      }
      lastTrackedAtRef.current = frame.timestamp
      if (!phaseStartedAtRef.current) phaseStartedAtRef.current = frame.timestamp
      samplesRef.current.push(frame.rawYaw)
      const elapsed = frame.timestamp - phaseStartedAtRef.current
      setCalibrationProgress(Math.min(1, elapsed / CALIBRATION_DURATION_MS))
      if (elapsed < CALIBRATION_DURATION_MS || samplesRef.current.length < 12) return

      const measured = median(samplesRef.current)
      samplesRef.current = []
      phaseStartedAtRef.current = 0
      setCalibrationProgress(0)

      if (state === 'CALIBRATING_NEUTRAL') {
        calibrationPartsRef.current.neutral = measured
        setAnnouncement('Neutral position saved. Now turn slightly left.')
        setState('CALIBRATING_LEFT')
      } else if (state === 'CALIBRATING_LEFT') {
        calibrationPartsRef.current.left = measured
        setAnnouncement('Left position saved. Now turn slightly right.')
        setState('CALIBRATING_RIGHT')
      } else {
        const next = buildCalibration(calibrationPartsRef.current.neutral, calibrationPartsRef.current.left, measured)
        setCalibration(next)
        setCalibrationProgress(1)
        setAnnouncement(next.reliable ? 'Calibration complete.' : 'Calibration range was small. Higher sensitivity may help.')
        setState('CALIBRATION_REVIEW')
      }
      return
    }

    const canNavigate = state === 'READY' || state === 'PLAYING' || state === 'TRACKING_LOST'
    if (!canNavigate) return
    if (frame.rawYaw == null) {
      if (frame.timestamp - lastTrackedAtRef.current > TRACKING_GRACE_MS) {
        setDirection('UNKNOWN')
        setDwellProgress(0)
        dwellStartedAtRef.current = 0
        if (state !== 'TRACKING_LOST') {
          setState('TRACKING_LOST')
          setAnnouncement('Face tracking paused. Move back into view.')
        }
      }
      return
    }

    lastTrackedAtRef.current = frame.timestamp
    if (state === 'TRACKING_LOST') {
      setState(isLooping ? 'PLAYING' : 'READY')
      setAnnouncement('Face tracking restored.')
    }
    smoothedYawRef.current = smoothedYawRef.current == null
      ? frame.rawYaw
      : SMOOTHING_ALPHA * frame.rawYaw + (1 - SMOOTHING_ALPHA) * smoothedYawRef.current

    const nextDirection = classifyHeadDirection(
      smoothedYawRef.current,
      calibration,
      sensitivity,
      previousDirectionRef.current,
    )
    previousDirectionRef.current = nextDirection
    setDirection(nextDirection)

    if (nextDirection === 'LEFT' || nextDirection === 'RIGHT') {
      dwellStartedAtRef.current = 0
      setDwellProgress(0)
      if (gestureArmedRef.current) {
        moveFocus(nextDirection === 'LEFT' ? -1 : 1)
        gestureArmedRef.current = false
      }
      return
    }

    gestureArmedRef.current = true
    if (!dwellUnlockedRef.current || progressionLengthRef.current >= 4) {
      setDwellProgress(0)
      return
    }
    if (!dwellStartedAtRef.current) dwellStartedAtRef.current = frame.timestamp
    const heldFor = frame.timestamp - dwellStartedAtRef.current
    const progress = Math.min(1, heldFor / dwellMs)
    setDwellProgress(progress)
    if (progress >= 1) selectChordAt(focusIndexRef.current)
  }, [cameraOn, calibration, dwellMs, frame, isLooping, moveFocus, selectChordAt, sensitivity, state])

  useEffect(() => {
    if (state !== 'CALIBRATION_REVIEW') return
    const timer = window.setTimeout(() => {
      smoothedYawRef.current = null
      previousDirectionRef.current = 'UNKNOWN'
      gestureArmedRef.current = true
      dwellUnlockedRef.current = true
      dwellStartedAtRef.current = 0
      setDirection('NEUTRAL')
      setCalibrationProgress(0)
      setState('READY')
      setAnnouncement('Instrument ready. Turn left or right, then return to neutral to dwell-select.')
    }, 1100)
    return () => window.clearTimeout(timer)
  }, [state])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLButtonElement) return
      const instrumentActive = state === 'READY' || state === 'PLAYING' || state === 'TRACKING_LOST'
      if (!instrumentActive) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        moveFocus(event.key === 'ArrowLeft' ? -1 : 1)
      } else if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        selectChordAt(focusIndexRef.current)
      } else if (event.key === 'Escape') {
        stopLoop()
        setIsLooping(false)
        setState('READY')
        setAnnouncement('Loop stopped.')
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [moveFocus, selectChordAt, state, stopLoop])

  const begin = async () => {
    setError('')
    setState('REQUESTING_CAMERA')
    setAnnouncement('Preparing camera and audio.')
    try {
      await Promise.all([startAudio(), cameraOn ? Promise.resolve() : startCamera()])
      stopLoop()
      setIsLooping(false)
      samplesRef.current = []
      phaseStartedAtRef.current = 0
      smoothedYawRef.current = null
      previousDirectionRef.current = 'UNKNOWN'
      gestureArmedRef.current = true
      dwellUnlockedRef.current = true
      setDirection('UNKNOWN')
      setCalibrationProgress(0)
      setAnnouncement('Look forward in a comfortable resting position.')
      setState('CALIBRATING_NEUTRAL')
    } catch (caught) {
      stopCamera()
      const message = caught instanceof Error ? caught.message : 'Camera or audio could not be started.'
      setError(message)
      setAnnouncement(message)
      setState('ERROR')
    }
  }

  const handlePlayLoop = () => {
    if (progression.length !== 4) return
    playLoop(progression)
    setIsLooping(true)
    setState('PLAYING')
    setAnnouncement('Playing your four-chord loop.')
  }

  const handleStopLoop = () => {
    stopLoop()
    setIsLooping(false)
    if (state !== 'TRACKING_LOST') setState('READY')
    setAnnouncement('Loop stopped.')
  }

  const clearProgression = () => {
    stopLoop()
    setIsLooping(false)
    setProgression([])
    progressionLengthRef.current = 0
    dwellUnlockedRef.current = true
    if (state === 'PLAYING') setState('READY')
    setAnnouncement('Progression cleared.')
  }

  const stopInstrument = () => {
    stopLoop()
    stopCamera()
    setIsLooping(false)
    setDirection('UNKNOWN')
    setDwellProgress(0)
    setState('IDLE')
    setAnnouncement('Instrument stopped.')
  }

  const status = useMemo(() => {
    if (state === 'IDLE') return 'Ready when you are'
    if (state === 'REQUESTING_CAMERA') return 'Preparing locally…'
    if (isCalibrationState(state)) return CALIBRATION_COPY[state] ?? 'Calibrating'
    if (state === 'CALIBRATION_REVIEW') return calibration.reliable ? 'Calibration complete' : 'Small movement range detected'
    if (state === 'TRACKING_LOST') return 'Tracking paused'
    if (state === 'PLAYING') return 'Loop playing'
    if (state === 'ERROR') return error
    return 'Instrument ready'
  }, [calibration.reliable, error, state])

  const operational = state === 'READY' || state === 'PLAYING' || state === 'TRACKING_LOST'

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="#instrument" aria-label="OneMotion home">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>OneMotion</span>
        </a>
        <p>Make harmony with the movement that feels comfortable to you.</p>
        <div className={`privacy-pill ${cameraOn ? 'active' : ''}`}>
          <span aria-hidden="true" /> {cameraOn ? 'Camera active · local only' : 'Camera off'}
        </div>
      </header>

      <section className="instrument-shell" id="instrument" aria-label="OneMotion instrument">
        <div className="workspace-heading">
          <div>
            <span className="kicker">HANDS-FREE CHORD INSTRUMENT</span>
            <h1>Move. Rest. Make music.</h1>
          </div>
          <div className="status-block">
            <div className="status-copy" role="status">
              <span>STATUS</span>
              <strong>{status}</strong>
            </div>
            {(state === 'IDLE' || state === 'ERROR') && (
              <button className="quick-start" type="button" onClick={begin}>Start instrument</button>
            )}
          </div>
        </div>

        <div className="instrument-grid">
          <CameraPanel
            videoRef={videoRef}
            canvasRef={canvasRef}
            cameraOn={cameraOn}
            faceDetected={frame.rawYaw != null}
            direction={direction}
            state={state}
            instruction={CALIBRATION_COPY[state] ?? ''}
            calibrationProgress={calibrationProgress}
          />

          <section className="music-panel" aria-labelledby="chord-heading">
            <div className="panel-heading">
              <div>
                <span className="step-label">02 · CHOOSE</span>
                <h2 id="chord-heading">Your chord palette</h2>
              </div>
              <div className="gesture-hint" aria-label="Head navigation instructions">
                <kbd>←</kbd><span>turn</span><kbd>●</kbd><span>rest</span><kbd>→</kbd><span>turn</span>
              </div>
            </div>

            <div className="chord-grid" role="group" aria-label="Available chords">
              {CHORDS.map((chord, index) => {
                const focused = index === focusIndex
                return (
                  <button
                    className={`chord-card ${focused ? 'focused' : ''}`}
                    key={chord.id}
                    type="button"
                    disabled={!audioReady}
                    aria-pressed={focused}
                    aria-label={`${chord.name}${focused ? ', focused' : ''}`}
                    onFocus={() => setFocusIndex(index)}
                    onClick={() => selectChordAt(index)}
                  >
                    <span className="chord-numeral">{chord.numeral}</span>
                    <strong>{chord.shortName}</strong>
                    <span>{chord.name}</span>
                    {focused && <i className="dwell-fill" style={{ '--dwell': dwellProgress } as React.CSSProperties} aria-hidden="true" />}
                    {focused && <span className="focus-label">{dwellProgress > 0 ? `HOLD ${Math.round(dwellProgress * 100)}%` : 'IN FOCUS'}</span>}
                  </button>
                )
              })}
            </div>

            <div className="progression-row">
              <div className="progression-title">
                <span className="step-label">03 · BUILD</span>
                <strong>Your progression</strong>
              </div>
              <ol className="progression-slots" aria-label="Selected chord progression">
                {[0, 1, 2, 3].map((slot) => (
                  <li className={progression[slot] ? 'filled' : ''} key={slot}>
                    <small>{String(slot + 1).padStart(2, '0')}</small>
                    <span>{progression[slot]?.shortName ?? '—'}</span>
                  </li>
                ))}
              </ol>
            </div>

            <div className="transport" aria-label="Playback controls">
              <button className="play-button" type="button" onClick={handlePlayLoop} disabled={progression.length !== 4 || isLooping}>
                <span aria-hidden="true">▶</span> Play loop
              </button>
              <button type="button" onClick={handleStopLoop} disabled={!isLooping}>Stop</button>
              <button type="button" onClick={clearProgression} disabled={!progression.length}>Clear</button>
              <span className="progression-count">{progression.length} / 4 chords</span>
            </div>
          </section>
        </div>

        <section className="control-deck" aria-label="Instrument controls">
          <div className="start-zone">
            {(state !== 'IDLE' && state !== 'ERROR') && (
              <>
                <button className="recalibrate-button" type="button" onClick={begin}>Recalibrate</button>
                <button className="stop-camera-button" type="button" onClick={stopInstrument}>Stop camera</button>
              </>
            )}
            <span className="start-note">One click enables camera and sound. Hands are optional after calibration.</span>
          </div>
          <div className="settings-grid">
            <label>
              <span><b>Sensitivity</b><output>{Math.round(sensitivity * 100)}%</output></span>
              <input type="range" min="0" max="1" step="0.02" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} />
            </label>
            <label>
              <span><b>Dwell time</b><output>{(dwellMs / 1000).toFixed(1)}s</output></span>
              <input type="range" min="700" max="2000" step="100" value={dwellMs} onChange={(event) => setDwellMs(Number(event.target.value))} />
            </label>
            <label>
              <span><b>Tempo</b><output>{bpm} BPM</output></span>
              <input type="range" min="60" max="130" step="1" value={bpm} onChange={(event) => {
                const next = Number(event.target.value)
                setBpm(next)
                updateEngineBpm(next)
              }} />
            </label>
          </div>
        </section>
      </section>

      <div className="keyboard-note">
        Keyboard fallback: <kbd>←</kbd> <kbd>→</kbd> move · <kbd>Enter</kbd> select · <kbd>Esc</kbd> stop
      </div>

      <footer className="ethics-note">
        <p><strong>Early feasibility prototype.</strong> OneMotion is not a medical device and does not claim one interface works for every disability.</p>
        <p>Its next step is co-design and testing with disabled musicians.</p>
      </footer>

      <p className="sr-only" aria-live="assertive">{announcement}</p>
      {!audioReady && operational && <p className="sr-only">Audio is not ready.</p>}
    </main>
  )
}
