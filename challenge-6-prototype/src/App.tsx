import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { CameraPanel } from './components/CameraPanel'
import { useFaceTracking } from './hooks/useFaceTracking'
import { useMidiOutput } from './hooks/useMidiOutput'
import { useMusicEngine } from './hooks/useMusicEngine'
import { chooseNextChord, HARMONY } from './lib/harmony'
import {
  buildCalibration,
  classifyHeadDirection,
  median,
  SMOOTHING_ALPHA,
  TRACKING_GRACE_MS,
} from './lib/headPose'
import type {
  Chord,
  Degree,
  GesturePhase,
  HeadCalibration,
  HeadDirection,
  InstrumentState,
  MusicalAction,
} from './types'

const CALIBRATION_DURATION_MS = 1400
const REACQUIRE_NEUTRAL_MS = 500
const RETURN_CONFIRM_MS = 150
const MENU_HOLD_MS = 1100
const HEAD_DIRECTIONS: Array<Exclude<HeadDirection, 'NEUTRAL' | 'UNKNOWN'>> = ['LEFT', 'RIGHT', 'UP', 'DOWN']
type HeadCommand = Exclude<HeadDirection, 'NEUTRAL' | 'UNKNOWN'> | 'MENU'

const STARTING_ARRANGEMENTS: Degree[][] = [
  [1, 6, 4, 5],
  [6, 4, 1, 5],
  [1, 4, 2, 5],
  [4, 1, 6, 5],
]

const EMPTY_CALIBRATION: HeadCalibration = {
  neutral: 0,
  pitchNeutral: 0,
  left: -0.08,
  right: 0.08,
  up: -0.06,
  down: 0.06,
  yawRange: 0.08,
  pitchRange: 0.06,
  reliable: true,
  range: 0.06,
}

const CALIBRATION_COPY: Partial<Record<InstrumentState, string>> = {
  CALIBRATING_NEUTRAL: 'Rest in your comfortable center',
  CALIBRATING_RIGHT: 'Turn comfortably to your right',
  CALIBRATING_LEFT: 'Turn comfortably to your left',
  CALIBRATING_UP: 'Lift your gaze comfortably',
  CALIBRATING_DOWN: 'Lower your gaze comfortably',
}

function isCalibrationState(state: InstrumentState) {
  return state.startsWith('CALIBRATING_')
}

export default function App() {
  const { videoRef, canvasRef, frame, cameraOn, startCamera, stopCamera } = useFaceTracking()
  const {
    audioReady,
    beatIndex,
    energyLevel,
    startAudio,
    startClock,
    queueChord,
    playLoop,
    stopLoop,
    stopAll,
    shiftEnergy,
    setBpm: updateEngineBpm,
  } = useMusicEngine()
  const midi = useMidiOutput()

  const [state, setState] = useState<InstrumentState>('IDLE')
  const [direction, setDirection] = useState<HeadDirection>('UNKNOWN')
  const [gesturePhase, setGesturePhase] = useState<GesturePhase>('NO_FACE')
  const [calibration, setCalibration] = useState<HeadCalibration>(EMPTY_CALIBRATION)
  const [calibrationProgress, setCalibrationProgress] = useState(0)
  const [phrase, setPhrase] = useState<Chord[]>([])
  const [pendingAction, setPendingAction] = useState<MusicalAction | null>(null)
  const [lastAccepted, setLastAccepted] = useState<MusicalAction | null>(null)
  const [loopState, setLoopState] = useState<'WAITING' | 'RECORDING' | 'LOOPING' | 'PAUSED'>('WAITING')
  const [activeStep, setActiveStep] = useState(-1)
  const [cameraVisible, setCameraVisible] = useState(false)
  const [headMenuOpen, setHeadMenuOpen] = useState(false)
  const [headMenuIndex, setHeadMenuIndex] = useState(0)
  const [softwareFallback, setSoftwareFallback] = useState(true)
  const [sensitivity, setSensitivity] = useState(0.58)
  const [gestureHoldMs, setGestureHoldMs] = useState(220)
  const [cooldownMs, setCooldownMs] = useState(520)
  const [bpm, setBpm] = useState(96)
  const [error, setError] = useState('')
  const [announcement, setAnnouncement] = useState('Ready to begin.')

  const yawSamplesRef = useRef<number[]>([])
  const pitchSamplesRef = useRef<number[]>([])
  const calibrationPartsRef = useRef({ neutral: 0, pitchNeutral: 0, right: 0, left: 0, up: 0 })
  const phaseStartedAtRef = useRef(0)
  const lastTrackedAtRef = useRef(0)
  const smoothedYawRef = useRef<number | null>(null)
  const smoothedPitchRef = useRef<number | null>(null)
  const previousDirectionRef = useRef<HeadDirection>('UNKNOWN')
  const gesturePhaseRef = useRef<GesturePhase>('NO_FACE')
  const candidateStartedAtRef = useRef(0)
  const armedDirectionRef = useRef<HeadDirection | null>(null)
  const neutralStartedAtRef = useRef(0)
  const cooldownUntilRef = useRef(0)
  const phraseRef = useRef<Chord[]>([])
  const currentDegreeRef = useRef<Degree>(1)
  const activeStepRef = useRef(-1)
  const pendingRef = useRef(false)
  const pausedRef = useRef(false)
  const headMenuOpenRef = useRef(false)
  const headMenuIndexRef = useRef(0)
  const longUpRef = useRef(false)
  const arrangementIndexRef = useRef(0)

  useEffect(() => { phraseRef.current = phrase }, [phrase])
  useEffect(() => { activeStepRef.current = activeStep }, [activeStep])
  useEffect(() => { headMenuOpenRef.current = headMenuOpen }, [headMenuOpen])
  useEffect(() => { headMenuIndexRef.current = headMenuIndex }, [headMenuIndex])

  const setPhase = useCallback((phase: GesturePhase) => {
    gesturePhaseRef.current = phase
    setGesturePhase(phase)
  }, [])

  const browserAudioEnabled = softwareFallback || midi.status !== 'CONNECTED'

  const startPhraseLoop = useCallback((nextPhrase: Chord[]) => {
    playLoop(nextPhrase, (index, chord) => {
      activeStepRef.current = index
      setActiveStep(index)
      midi.playDegree(chord.degree)
    }, browserAudioEnabled)
    setLoopState('LOOPING')
    setState('PLAYING')
    setAnnouncement('Your arrangement is playing with rhythm, bass, harmony, and melody layers.')
  }, [browserAudioEnabled, midi, playLoop])

  const loadArrangement = useCallback((advance = false) => {
    if (advance) arrangementIndexRef.current = (arrangementIndexRef.current + 1) % STARTING_ARRANGEMENTS.length
    const nextPhrase = STARTING_ARRANGEMENTS[arrangementIndexRef.current].map((degree) => HARMONY[degree])
    phraseRef.current = nextPhrase
    currentDegreeRef.current = nextPhrase.at(-1)?.degree ?? 1
    activeStepRef.current = -1
    pendingRef.current = false
    setPhrase(nextPhrase)
    setActiveStep(-1)
    setPendingAction(null)
    startPhraseLoop(nextPhrase)
  }, [startPhraseLoop])

  const acceptAction = useCallback((action: MusicalAction) => {
    if (pendingRef.current || pausedRef.current) return
    pendingRef.current = true
    setPendingAction(action)
    setAnnouncement(`${action === 'FORWARD' ? 'Forward' : 'Return'} movement accepted. Sound queued for the next beat.`)

    const currentPhrase = phraseRef.current
    const replaceIndex = currentPhrase.length < 4 ? currentPhrase.length : (activeStepRef.current + 1 + 4) % 4
    const nextChord = chooseNextChord(
      currentDegreeRef.current,
      currentPhrase.map((chord) => chord.degree),
      action,
      replaceIndex,
    )

    queueChord(nextChord, () => {
      midi.playDegree(nextChord.degree)
      currentDegreeRef.current = nextChord.degree
      setPendingAction(null)
      pendingRef.current = false
      setLastAccepted(action)
      window.setTimeout(() => setLastAccepted(null), 480)

      if (currentPhrase.length < 4) {
        const nextPhrase = [...currentPhrase, nextChord]
        phraseRef.current = nextPhrase
        setPhrase(nextPhrase)
        if (nextPhrase.length === 4) {
          startPhraseLoop(nextPhrase)
        } else {
          setLoopState('RECORDING')
          setAnnouncement(`Sound added. ${nextPhrase.length} of 4 steps recorded.`)
        }
      } else {
        const nextPhrase = [...currentPhrase]
        nextPhrase[replaceIndex] = nextChord
        phraseRef.current = nextPhrase
        setPhrase(nextPhrase)
        startPhraseLoop(nextPhrase)
        setAnnouncement(`Upcoming step changed by your ${action === 'FORWARD' ? 'forward' : 'return'} movement.`)
      }
    }, browserAudioEnabled)
  }, [browserAudioEnabled, midi, queueChord, startPhraseLoop])

  const pausePerformance = useCallback(() => {
    if (pausedRef.current) {
      pausedRef.current = false
      setPhase('NEUTRAL_READY')
      startClock()
      if (phraseRef.current.length === 4) startPhraseLoop(phraseRef.current)
      else {
        setLoopState('RECORDING')
        setState('READY')
      }
      setAnnouncement('Music resumed. Rest at center before your next movement.')
      return
    }
    pausedRef.current = true
    stopAll()
    midi.allNotesOff()
    setPhase('NEUTRAL_READY')
    setLoopState('PAUSED')
    setAnnouncement('Music paused. Hold up for controls, then choose Resume music.')
  }, [midi, setPhase, startClock, startPhraseLoop, stopAll])

  const clearLoop = useCallback(() => {
    stopLoop()
    midi.allNotesOff()
    pausedRef.current = false
    loadArrangement(true)
    setAnnouncement('A new arrangement is playing.')
  }, [loadArrangement, midi, stopLoop])

  const stopSound = useCallback(() => {
    stopAll()
    midi.allNotesOff()
    pausedRef.current = true
    setPhase('NEUTRAL_READY')
    setLoopState('PAUSED')
    setAnnouncement('All sound stopped. Hold up for controls to resume.')
  }, [midi, setPhase, stopAll])

  const endSession = useCallback(() => {
    stopAll()
    midi.allNotesOff()
    stopCamera()
    pausedRef.current = false
    headMenuOpenRef.current = false
    setHeadMenuOpen(false)
    setState('IDLE')
    setDirection('UNKNOWN')
    setPhase('NO_FACE')
    setLoopState('WAITING')
    setAnnouncement('Session ended.')
  }, [midi, setPhase, stopAll, stopCamera])

  const runHeadCommand = useCallback((command: HeadCommand) => {
    if (headMenuOpenRef.current) {
      if (command === 'LEFT' || command === 'RIGHT') {
        const movement = command === 'RIGHT' ? 1 : -1
        const next = (headMenuIndexRef.current + movement + 4) % 4
        headMenuIndexRef.current = next
        setHeadMenuIndex(next)
        setAnnouncement(`Menu option ${next + 1} of 4.`)
        return
      }
      if (command === 'UP' || command === 'MENU') {
        headMenuOpenRef.current = false
        setHeadMenuOpen(false)
        setAnnouncement('Menu closed. Return to center.')
        return
      }

      const selected = headMenuIndexRef.current
      if (selected === 0) {
        headMenuOpenRef.current = false
        setHeadMenuOpen(false)
        setAnnouncement('Back to the music.')
      } else if (selected === 1) {
        pausePerformance()
        headMenuOpenRef.current = false
        setHeadMenuOpen(false)
      } else if (selected === 2) {
        clearLoop()
        headMenuOpenRef.current = false
        setHeadMenuOpen(false)
      } else {
        endSession()
      }
      return
    }

    if (command === 'MENU') {
      headMenuOpenRef.current = true
      headMenuIndexRef.current = 0
      setHeadMenuIndex(0)
      setHeadMenuOpen(true)
      setAnnouncement('Control menu open. Turn left or right to choose. Look down to select.')
    } else if (command === 'LEFT' || command === 'RIGHT') {
      acceptAction(command === 'RIGHT' ? 'FORWARD' : 'RESOLVE')
    } else if (command === 'UP') {
      shiftEnergy(1)
      setAnnouncement(`The arrangement is building to energy ${Math.min(4, energyLevel + 2)} of 4.`)
    } else {
      shiftEnergy(-1)
      setAnnouncement(`The arrangement is stripping back to energy ${Math.max(1, energyLevel)} of 4.`)
    }
  }, [acceptAction, clearLoop, endSession, energyLevel, pausePerformance, shiftEnergy])

  useEffect(() => {
    if (!frame.timestamp || !cameraOn) return

    if (isCalibrationState(state)) {
      if (frame.rawYaw == null || frame.rawPitch == null) {
        phaseStartedAtRef.current = 0
        yawSamplesRef.current = []
        pitchSamplesRef.current = []
        setCalibrationProgress(0)
        return
      }
      lastTrackedAtRef.current = frame.timestamp
      if (!phaseStartedAtRef.current) phaseStartedAtRef.current = frame.timestamp
      yawSamplesRef.current.push(frame.rawYaw)
      pitchSamplesRef.current.push(frame.rawPitch)
      const elapsed = frame.timestamp - phaseStartedAtRef.current
      setCalibrationProgress(Math.min(1, elapsed / CALIBRATION_DURATION_MS))
      if (elapsed < CALIBRATION_DURATION_MS || yawSamplesRef.current.length < 12) return

      const measuredYaw = median(yawSamplesRef.current)
      const measuredPitch = median(pitchSamplesRef.current)
      yawSamplesRef.current = []
      pitchSamplesRef.current = []
      phaseStartedAtRef.current = 0
      setCalibrationProgress(0)

      if (state === 'CALIBRATING_NEUTRAL') {
        calibrationPartsRef.current.neutral = measuredYaw
        calibrationPartsRef.current.pitchNeutral = measuredPitch
        setState('CALIBRATING_RIGHT')
        setAnnouncement('Center saved. Now turn comfortably to your right.')
      } else if (state === 'CALIBRATING_RIGHT') {
        calibrationPartsRef.current.right = measuredYaw
        setState('CALIBRATING_LEFT')
        setAnnouncement('Right movement saved. Now turn comfortably to your left.')
      } else if (state === 'CALIBRATING_LEFT') {
        calibrationPartsRef.current.left = measuredYaw
        setState('CALIBRATING_UP')
        setAnnouncement('Left movement saved. Now lift your gaze comfortably.')
      } else if (state === 'CALIBRATING_UP') {
        calibrationPartsRef.current.up = measuredPitch
        setState('CALIBRATING_DOWN')
        setAnnouncement('Upward movement saved. Now lower your gaze comfortably.')
      } else {
        const parts = calibrationPartsRef.current
        const next = buildCalibration(parts.neutral, parts.pitchNeutral, parts.left, parts.right, parts.up, measuredPitch)
        setCalibration(next)
        setCalibrationProgress(1)
        setState('CALIBRATION_REVIEW')
        setAnnouncement(next.reliable ? 'Calibration complete.' : 'Movement range is small. The facilitator can increase sensitivity.')
      }
      return
    }

    const operational = state === 'READY' || state === 'PLAYING' || state === 'TRACKING_LOST'
    if (!operational) return

    if (frame.rawYaw == null || frame.rawPitch == null) {
      neutralStartedAtRef.current = 0
      if (frame.timestamp - lastTrackedAtRef.current > TRACKING_GRACE_MS) {
        setDirection('UNKNOWN')
        setPhase('NO_FACE')
        if (state !== 'TRACKING_LOST') {
          setState('TRACKING_LOST')
          setAnnouncement('Tracking paused. Move back into view and rest at center.')
        }
      }
      return
    }

    lastTrackedAtRef.current = frame.timestamp
    smoothedYawRef.current = smoothedYawRef.current == null
      ? frame.rawYaw
      : SMOOTHING_ALPHA * frame.rawYaw + (1 - SMOOTHING_ALPHA) * smoothedYawRef.current
    smoothedPitchRef.current = smoothedPitchRef.current == null
      ? frame.rawPitch
      : SMOOTHING_ALPHA * frame.rawPitch + (1 - SMOOTHING_ALPHA) * smoothedPitchRef.current
    const nextDirection = classifyHeadDirection(
      smoothedYawRef.current,
      smoothedPitchRef.current,
      calibration,
      sensitivity,
      previousDirectionRef.current,
    )
    previousDirectionRef.current = nextDirection
    setDirection(nextDirection)

    const phase = gesturePhaseRef.current
    if (phase === 'NO_FACE' || state === 'TRACKING_LOST') {
      if (nextDirection !== 'NEUTRAL') {
        neutralStartedAtRef.current = 0
        return
      }
      if (!neutralStartedAtRef.current) neutralStartedAtRef.current = frame.timestamp
      if (frame.timestamp - neutralStartedAtRef.current >= REACQUIRE_NEUTRAL_MS) {
        setPhase('NEUTRAL_READY')
        setState(phraseRef.current.length === 4 ? 'PLAYING' : 'READY')
        setAnnouncement('Tracking ready. Choose a direction when comfortable.')
      }
      return
    }

    if (phase === 'COOLDOWN') {
      if (frame.timestamp >= cooldownUntilRef.current && nextDirection === 'NEUTRAL') {
        setPhase('NEUTRAL_READY')
        setAnnouncement('Ready for another movement.')
      }
      return
    }

    if (phase === 'NEUTRAL_READY') {
      if (HEAD_DIRECTIONS.includes(nextDirection as Exclude<HeadDirection, 'NEUTRAL' | 'UNKNOWN'>)) {
        candidateStartedAtRef.current = frame.timestamp
        armedDirectionRef.current = nextDirection
        longUpRef.current = false
        setPhase(`${nextDirection}_CANDIDATE` as GesturePhase)
      }
      return
    }

    if (phase.endsWith('_CANDIDATE')) {
      const expected = phase.replace('_CANDIDATE', '') as HeadDirection
      if (nextDirection === expected) {
        if (frame.timestamp - candidateStartedAtRef.current >= gestureHoldMs) {
          setPhase('WAITING_FOR_RETURN')
          neutralStartedAtRef.current = 0
          setAnnouncement('Movement recognized. Return to your comfortable center.')
        }
      } else if (nextDirection === 'NEUTRAL') {
        setPhase('NEUTRAL_READY')
      }
      return
    }

    if (phase === 'WAITING_FOR_RETURN') {
      if (nextDirection !== 'NEUTRAL') {
        neutralStartedAtRef.current = 0
        if (armedDirectionRef.current === 'UP' && nextDirection === 'UP' && !longUpRef.current && frame.timestamp - candidateStartedAtRef.current >= MENU_HOLD_MS) {
          longUpRef.current = true
          setAnnouncement('Control menu ready. Return to center to open it.')
        }
        return
      }
      if (!neutralStartedAtRef.current) neutralStartedAtRef.current = frame.timestamp
      if (frame.timestamp - neutralStartedAtRef.current >= RETURN_CONFIRM_MS && armedDirectionRef.current) {
        runHeadCommand(longUpRef.current ? 'MENU' : armedDirectionRef.current as Exclude<HeadDirection, 'NEUTRAL' | 'UNKNOWN'>)
        armedDirectionRef.current = null
        longUpRef.current = false
        cooldownUntilRef.current = frame.timestamp + cooldownMs
        setPhase('COOLDOWN')
      }
    }
  }, [calibration, cameraOn, cooldownMs, frame, gestureHoldMs, runHeadCommand, sensitivity, setPhase, state])

  useEffect(() => {
    if (state !== 'CALIBRATION_REVIEW') return
    const timer = window.setTimeout(() => {
      smoothedYawRef.current = null
      smoothedPitchRef.current = null
      previousDirectionRef.current = 'UNKNOWN'
      neutralStartedAtRef.current = 0
      pausedRef.current = false
      setDirection('NEUTRAL')
      setCalibrationProgress(0)
      setPhase('NEUTRAL_READY')
      setLoopState('RECORDING')
      setState('READY')
      startClock()
      setCameraVisible(false)
      loadArrangement()
      setAnnouncement('Your arrangement is playing. Left or right changes its path; up or down changes its energy.')
    }, 900)
    return () => window.clearTimeout(timer)
  }, [loadArrangement, setPhase, startClock, state])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return
      const operational = state === 'READY' || state === 'PLAYING' || state === 'TRACKING_LOST'
      if (!operational) return
      if (event.key.startsWith('Arrow')) {
        event.preventDefault()
        const command = event.key.replace('Arrow', '').toUpperCase() as Exclude<HeadDirection, 'NEUTRAL' | 'UNKNOWN'>
        runHeadCommand(command)
      } else if (event.key === ' ' || event.key.toLowerCase() === 'm') {
        event.preventDefault()
        runHeadCommand('MENU')
      } else if (event.key === 'Escape') {
        event.preventDefault()
        stopSound()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [runHeadCommand, state, stopSound])

  const begin = async () => {
    setError('')
    setState('REQUESTING_CAMERA')
    setAnnouncement('Preparing camera, sound, and optional MIDI output.')
    try {
      await Promise.all([
        startAudio(),
        midi.initializeMidi(),
        cameraOn ? Promise.resolve() : startCamera(),
      ])
      stopAll()
      midi.allNotesOff()
      yawSamplesRef.current = []
      pitchSamplesRef.current = []
      phaseStartedAtRef.current = 0
      smoothedYawRef.current = null
      smoothedPitchRef.current = null
      previousDirectionRef.current = 'UNKNOWN'
      headMenuOpenRef.current = false
      headMenuIndexRef.current = 0
      phraseRef.current = []
      currentDegreeRef.current = 1
      pausedRef.current = false
      pendingRef.current = false
      setPhrase([])
      setActiveStep(-1)
      setPendingAction(null)
      setHeadMenuOpen(false)
      setHeadMenuIndex(0)
      setCameraVisible(true)
      setDirection('UNKNOWN')
      setLoopState('WAITING')
      setPhase('NO_FACE')
      setCalibrationProgress(0)
      setState('CALIBRATING_NEUTRAL')
      setAnnouncement('Rest comfortably in your center position.')
    } catch (caught) {
      stopCamera()
      setCameraVisible(false)
      const message = caught instanceof Error ? caught.message : 'Camera or audio could not be started.'
      setError(message)
      setAnnouncement(`${message} Keyboard simulation remains available after camera access is restored.`)
      setState('ERROR')
    }
  }

  const beginKeyboardMode = async () => {
    setError('')
    setAnnouncement('Preparing keyboard simulation and sound.')
    try {
      await startAudio()
      stopCamera()
      stopAll()
      midi.allNotesOff()
      phraseRef.current = []
      currentDegreeRef.current = 1
      activeStepRef.current = -1
      pendingRef.current = false
      pausedRef.current = false
      setPhrase([])
      setActiveStep(-1)
      setPendingAction(null)
      setLastAccepted(null)
      setDirection('NEUTRAL')
      setCalibration(EMPTY_CALIBRATION)
      setCalibrationProgress(0)
      setLoopState('RECORDING')
      setPhase('NEUTRAL_READY')
      setState('READY')
      setCameraVisible(false)
      startClock()
      loadArrangement()
      setAnnouncement('A full arrangement is playing. Arrow keys now shape it like head movement.')
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : 'Audio could not be started.'
      setError(message)
      setState('ERROR')
      setAnnouncement(message)
    }
  }

  const status = useMemo(() => {
    if (state === 'IDLE') return 'Ready when you are'
    if (state === 'REQUESTING_CAMERA') return 'Preparing locally…'
    if (isCalibrationState(state)) return CALIBRATION_COPY[state] ?? 'Calibrating'
    if (state === 'CALIBRATION_REVIEW') return calibration.reliable ? 'Calibration complete' : 'Small movement range detected'
    if (state === 'TRACKING_LOST') return 'Tracking paused · return to center'
    if (gesturePhase === 'WAITING_FOR_RETURN') return 'Movement held · return to center'
    if (gesturePhase === 'COOLDOWN') return 'Sound accepted · resting'
    if (headMenuOpen) return 'Control menu · choose with your head'
    if (loopState === 'PAUSED') return 'Music paused · hold up for controls'
    if (pendingAction) return 'Change queued for next beat'
    if (loopState === 'LOOPING') return `Arrangement playing · energy ${energyLevel + 1} of 4`
    if (state === 'ERROR') return error
    return 'Choose a comfortable direction'
  }, [calibration.reliable, energyLevel, error, gesturePhase, headMenuOpen, loopState, pendingAction, state])

  const operational = state === 'READY' || state === 'PLAYING' || state === 'TRACKING_LOST'
  const leftActive = direction === 'LEFT' || gesturePhase === 'LEFT_CANDIDATE' || lastAccepted === 'RESOLVE'
  const rightActive = direction === 'RIGHT' || gesturePhase === 'RIGHT_CANDIDATE' || lastAccepted === 'FORWARD'
  const upActive = direction === 'UP' || gesturePhase === 'UP_CANDIDATE'
  const downActive = direction === 'DOWN' || gesturePhase === 'DOWN_CANDIDATE'
  const menuItems = ['Back to music', loopState === 'PAUSED' ? 'Resume music' : 'Pause music', 'Start new music', 'End session']
  const calibrationSymbol = state === 'CALIBRATING_LEFT' ? '←' : state === 'CALIBRATING_RIGHT' ? '→' : state === 'CALIBRATING_UP' ? '↑' : state === 'CALIBRATING_DOWN' ? '↓' : '●'

  return (
    <main className={`accessible-shell ${operational ? 'is-live' : 'is-setup'}`}>
      <header className="minimal-topbar">
        <a className="prototype-mark" href="#performance" aria-label="Accessible music home"><span aria-hidden="true"><i /><i /><i /></span>MOVE TO MUSIC</a>
        <div className={`face-pill ${frame.rawYaw != null ? 'active' : ''}`}><span aria-hidden="true" />{cameraOn ? frame.rawYaw != null ? 'I can see you' : 'Move into view' : 'Camera off'}</div>
      </header>

      <section className="head-experience" id="performance" aria-label="Head-controlled music experience">
        <div className="experience-status" role="status">
          <span>{state === 'IDLE' ? 'HEAD-CONTROLLED MUSIC' : isCalibrationState(state) ? 'LEARNING YOUR MOVEMENT' : headMenuOpen ? 'CONTROL MENU' : 'LISTEN · MOVE · REST'}</span>
          <strong>{status}</strong>
        </div>

        <div className={`adaptive-layout ${cameraVisible ? '' : 'camera-hidden'}`}>
          <div className={`camera-column ${cameraVisible ? '' : 'camera-offscreen'}`} aria-hidden={!cameraVisible}>
            <CameraPanel videoRef={videoRef} canvasRef={canvasRef} cameraOn={cameraOn} faceDetected={frame.rawYaw != null} direction={direction} state={state} instruction={CALIBRATION_COPY[state] ?? ''} calibrationProgress={calibrationProgress} />
          </div>

          <section className="participant-space" aria-labelledby="main-heading">
            {(state === 'IDLE' || state === 'ERROR') && (
              <div className="welcome-stage">
                <span className="quiet-label">ONE COMFORTABLE MOVEMENT IS ENOUGH</span>
                <h1 id="main-heading">Make music<br />with your head.</h1>
                <p>The camera adapts to the movements available to you. After setup, no hands are needed.</p>
                <div className="welcome-actions">
                  <button type="button" className="primary-start" onClick={begin}>Enable camera &amp; begin</button>
                  {state === 'ERROR' && <button type="button" onClick={beginKeyboardMode}>Try with arrow keys</button>}
                </div>
                <small>A helper may make this first click to allow camera and sound.</small>
              </div>
            )}

            {(state === 'REQUESTING_CAMERA' || isCalibrationState(state) || state === 'CALIBRATION_REVIEW') && (
              <div className="calibration-stage">
                <div className="calibration-symbol" aria-hidden="true">{calibrationSymbol}</div>
                <span className="quiet-label">STEP {state === 'CALIBRATING_NEUTRAL' ? 1 : state === 'CALIBRATING_RIGHT' ? 2 : state === 'CALIBRATING_LEFT' ? 3 : state === 'CALIBRATING_UP' ? 4 : 5} OF 5</span>
                <h1 id="main-heading">{state === 'REQUESTING_CAMERA' ? 'Getting ready…' : state === 'CALIBRATION_REVIEW' ? 'All set.' : CALIBRATION_COPY[state]}</h1>
                <p>{state === 'CALIBRATION_REVIEW' ? 'Your comfortable movement range is saved.' : 'Hold gently. Never move farther than feels comfortable.'}</p>
                <div className="large-progress" aria-hidden="true"><i style={{ width: `${calibrationProgress * 100}%` }} /></div>
              </div>
            )}

            {operational && headMenuOpen && (
              <div className="head-menu" aria-labelledby="main-heading">
                <span className="quiet-label">TURN LEFT OR RIGHT · LOOK DOWN TO SELECT</span>
                <h1 id="main-heading">What would you like?</h1>
                <div className="menu-options">
                  {menuItems.map((item, index) => <button type="button" className={index === headMenuIndex ? 'selected' : ''} onClick={() => { headMenuIndexRef.current = index; setHeadMenuIndex(index) }} key={item}><small>{index + 1}</small><strong>{item}</strong></button>)}
                </div>
                <div className="menu-directions"><span>← → choose</span><span>↓ select</span><span>↑ back</span></div>
              </div>
            )}

            {operational && !headMenuOpen && (
              <div className="performance-stage">
                <h1 id="main-heading" className="sr-only">Head movement controls</h1>
                <div className="head-cross">
                  <button type="button" className={`head-action head-up ${upActive ? 'active' : ''}`} onClick={() => runHeadCommand('UP')} aria-disabled={energyLevel === 3}><b aria-hidden="true">↑</b><span>Build</span><small>hold for controls</small></button>
                  <button type="button" className={`head-action head-left ${leftActive ? 'active' : ''}`} onClick={() => runHeadCommand('LEFT')} aria-disabled={pausedRef.current}><b aria-hidden="true">←</b><span>Come home</span></button>
                  <div className={`head-center direction-${direction.toLowerCase()}`}>
                    <div className={`center-pulse beat-${beatIndex}`} aria-hidden="true"><i /><span /></div>
                    <small>REST HERE</small>
                    <strong>{gesturePhase === 'WAITING_FOR_RETURN' ? 'Come back' : direction === 'NEUTRAL' ? 'Ready' : direction === 'UNKNOWN' ? 'Find camera' : 'Hold'}</strong>
                  </div>
                  <button type="button" className={`head-action head-right ${rightActive ? 'active' : ''}`} onClick={() => runHeadCommand('RIGHT')} aria-disabled={pausedRef.current}><b aria-hidden="true">→</b><span>Explore</span></button>
                  <button type="button" className={`head-action head-down ${downActive ? 'active' : ''}`} onClick={() => runHeadCommand('DOWN')} aria-disabled={energyLevel === 0}><b aria-hidden="true">↓</b><span>Strip back</span></button>
                </div>

                <div className="music-trace" aria-label={`Four-part arrangement, energy ${energyLevel + 1} of 4`}>
                  <span>Your arrangement</span>
                  <div className="phrase-steps">{[0, 1, 2, 3].map((slot) => <i className={`${phrase[slot] ? 'filled' : ''} ${slot === activeStep ? 'playing' : ''}`} key={slot} />)}</div>
                  <div className="energy-meter" aria-label={`Energy ${energyLevel + 1} of 4`}><small>ENERGY</small><span>{[0, 1, 2, 3].map((level) => <i className={level <= energyLevel ? 'on' : ''} key={level} />)}</span></div>
                </div>
              </div>
            )}
          </section>
        </div>

        <details className="facilitator-panel">
          <summary><span>Helper setup</span><small>Not part of the participant experience</small></summary>
          <div className="facilitator-content">
            <section>
              <h2>Session</h2>
              <div className="button-row">
                <button type="button" onClick={begin} disabled={state === 'REQUESTING_CAMERA'}>Recalibrate</button>
                <button type="button" onClick={beginKeyboardMode}>Keyboard preview</button>
                <button type="button" onClick={endSession}>End session</button>
                 <button type="button" onClick={() => setCameraVisible((visible) => !visible)}>{cameraVisible ? 'Hide camera' : 'Show camera'}</button>
                 {HEAD_DIRECTIONS.map((command) => <button type="button" key={command} onClick={() => runHeadCommand(command)} disabled={!operational}>Test {command.toLowerCase()}</button>)}
                 <button type="button" onClick={() => runHeadCommand('MENU')} disabled={!operational}>Test menu</button>
              </div>
              <dl className="debug-values">
                <div><dt>Tracking</dt><dd>{frame.rawYaw == null ? 'No face' : 'Face found'}</dd></div>
                <div><dt>Yaw / pitch</dt><dd>{frame.rawYaw?.toFixed(3) ?? '—'} / {frame.rawPitch?.toFixed(3) ?? '—'}</dd></div>
                <div><dt>Gesture</dt><dd>{gesturePhase}</dd></div>
              </dl>
            </section>

            <section>
              <h2>Movement</h2>
              <label><span>Sensitivity <output>{Math.round(sensitivity * 100)}%</output></span><input type="range" min="0" max="1" step="0.02" value={sensitivity} onChange={(event) => setSensitivity(Number(event.target.value))} /></label>
              <label><span>Hold <output>{gestureHoldMs} ms</output></span><input type="range" min="150" max="500" step="10" value={gestureHoldMs} onChange={(event) => setGestureHoldMs(Number(event.target.value))} /></label>
              <label><span>Rest time <output>{cooldownMs} ms</output></span><input type="range" min="400" max="900" step="20" value={cooldownMs} onChange={(event) => setCooldownMs(Number(event.target.value))} /></label>
              <label><span>Tempo <output>{bpm} BPM</output></span><input type="range" min="70" max="120" value={bpm} onChange={(event) => { const next = Number(event.target.value); setBpm(next); updateEngineBpm(next) }} /></label>
            </section>

            <section>
              <h2>Sound output</h2>
              <label><span>MIDI output</span><select value={midi.selectedId} onChange={(event) => midi.setSelectedId(event.target.value)}><option value="">Browser fallback</option>{midi.outputs.map((output) => <option value={output.id} key={output.id}>{output.name || output.manufacturer || 'MIDI output'}</option>)}</select></label>
              <label><span>MIDI channel</span><input type="number" min="1" max="16" value={midi.channel} onChange={(event) => midi.setChannel(Number(event.target.value))} /></label>
              <label className="check-row"><input type="checkbox" checked={softwareFallback} onChange={(event) => setSoftwareFallback(event.target.checked)} /><span>Browser fallback</span></label>
              <div className="midi-status"><span className={midi.status === 'CONNECTED' ? 'connected' : ''} />{midi.status === 'CONNECTED' ? 'Hardware sound connected' : 'Browser sound active'}</div>
              <div className="button-row"><button type="button" onClick={midi.refreshOutputs}>Refresh</button><button type="button" onClick={midi.allNotesOff}>All notes off</button>{([1, 2, 3, 4, 5, 6] as Degree[]).map((degree) => <button type="button" key={degree} onClick={() => midi.playDegree(degree)}>Test {degree}</button>)}</div>
            </section>
          </div>
          <div className="keyboard-strip"><kbd>←</kbd><kbd>→</kbd> change the path · <kbd>↑</kbd><kbd>↓</kbd> build / strip · <kbd>M</kbd> controls · <kbd>Esc</kbd> stop sound</div>
        </details>
      </section>

      <p className="privacy-note">Camera processing stays on this device. The experience should be co-designed and tested with people who use alternative access methods.</p>
      <p className="sr-only" aria-live="assertive">{announcement}</p>
    </main>
  )
}
