import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useMusicEngine } from './hooks/useMusicEngine'
import { usePoseTracking } from './hooks/usePoseTracking'
import { normalizeEnergy, SMOOTHING_ALPHA, TRACKING_GRACE_MS } from './lib/movement'
import type { AppState, Calibration } from './types'

const REST_MS = 2000, ACTIVE_MS = 4000
const LAYERS = [{ name: 'Pad', start: 0, icon: '≋' }, { name: 'Bass', start: .2, icon: '◒' }, { name: 'Drums', start: .45, icon: '◉' }, { name: 'Lead', start: .75, icon: '✦' }]
const STATUS: Record<AppState, string> = {
  IDLE: 'Start when your full body is visible.', REQUESTING_CAMERA: 'Preparing camera and movement model…',
  CALIBRATING_REST: 'Stand relatively still', CALIBRATING_ACTIVE: 'Move comfortably', READY: 'Calibration complete',
  PERFORMING: 'Movement is shaping the mix', TRACKING_LOST: 'Tracking lost — step back into view', ERROR: 'Something needs attention',
}

export default function App() {
  const { videoRef, canvasRef, frame, cameraOn, startCamera, stopCamera } = usePoseTracking()
  const { startAudio, setEnergy: setMusicEnergy, silence } = useMusicEngine()
  const [state, setState] = useState<AppState>('IDLE')
  const [energy, setEnergy] = useState(0)
  const [calibration, setCalibration] = useState<Calibration>({ restBaseline: .02, activeReference: .7 })
  const [phaseStartedAt, setPhaseStartedAt] = useState(0)
  const [phaseProgress, setPhaseProgress] = useState(0)
  const [error, setError] = useState('')
  const samples = useRef<number[]>([]), lastTrackedAt = useRef(0), smoothed = useRef(0)
  const calibrating = state === 'CALIBRATING_REST' || state === 'CALIBRATING_ACTIVE'

  useEffect(() => {
    if (!frame.timestamp) return
    if (frame.landmarks) lastTrackedAt.current = frame.timestamp
    if (calibrating && frame.velocity != null) samples.current.push(frame.velocity)
    if (state === 'PERFORMING' || state === 'TRACKING_LOST') {
      const tracked = frame.timestamp - lastTrackedAt.current <= TRACKING_GRACE_MS
      if (!tracked) { if (state !== 'TRACKING_LOST') setState('TRACKING_LOST'); smoothed.current *= .92 }
      else {
        if (state === 'TRACKING_LOST') setState('PERFORMING')
        if (frame.velocity != null) {
          const next = normalizeEnergy(frame.velocity, calibration.restBaseline, calibration.activeReference)
          smoothed.current = SMOOTHING_ALPHA * next + (1 - SMOOTHING_ALPHA) * smoothed.current
        }
      }
      setEnergy(smoothed.current); setMusicEnergy(smoothed.current)
    }
  }, [frame, state, calibrating, calibration, setMusicEnergy])

  useEffect(() => {
    if (!calibrating) return
    const duration = state === 'CALIBRATING_REST' ? REST_MS : ACTIVE_MS
    const timer = window.setInterval(() => {
      const elapsed = performance.now() - phaseStartedAt
      setPhaseProgress(Math.min(1, elapsed / duration))
      if (elapsed < duration) return
      const sorted = [...samples.current].sort((a, b) => a - b)
      const percentile = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))] ?? 0
      if (state === 'CALIBRATING_REST') {
        setCalibration((value) => ({ ...value, restBaseline: Math.max(.01, percentile(.65)) }))
        samples.current = []; setPhaseStartedAt(performance.now()); setPhaseProgress(0); setState('CALIBRATING_ACTIVE')
      } else {
        setCalibration((value) => ({ ...value, activeReference: Math.max(value.restBaseline + .1, percentile(.8)) }))
        samples.current = []; setPhaseProgress(1); setState('READY'); window.setTimeout(() => setState('PERFORMING'), 550)
      }
    }, 50)
    return () => window.clearInterval(timer)
  }, [calibrating, phaseStartedAt, state])

  const begin = async () => {
    setError(''); setState('REQUESTING_CAMERA')
    try {
      await Promise.all([startAudio(), cameraOn ? Promise.resolve() : startCamera()])
      samples.current = []; smoothed.current = 0; setEnergy(0); setPhaseProgress(0); setPhaseStartedAt(performance.now()); setState('CALIBRATING_REST')
    } catch (caught) {
      silence(); stopCamera(); setError(caught instanceof Error ? caught.message : 'Camera or audio could not be started.'); setState('ERROR')
    }
  }
  const stop = () => { silence(); stopCamera(); smoothed.current = 0; setEnergy(0); setPhaseProgress(0); setState('IDLE') }
  const percent = Math.round(energy * 100), mood = energy < .32 ? 'CALM' : energy < .72 ? 'GROOVING' : 'PEAK'
  const detail = useMemo(() => state === 'CALIBRATING_REST' ? '2 seconds · keep your natural posture' : state === 'CALIBRATING_ACTIVE' ? '4 seconds · use a comfortable range' : state === 'ERROR' ? error : '', [state, error])
  const visualStyle = { '--energy': energy, '--center-x': `${(1 - frame.centerX) * 100}%` } as CSSProperties

  return <main>
    <div className="reactive" style={visualStyle} aria-hidden="true"><div className="aurora"/><div className="pulse one"/><div className="pulse two"/>{Array.from({ length: 18 }, (_, i) => <i key={i} style={{ '--i': i } as CSSProperties}/>)}</div>
    <header>
      <div className="mark" aria-hidden="true"><span/><span/><span/></div>
      <div><h1>Your movement shapes the transition.</h1><p>Move slowly for calm textures. Add energy to bring in rhythm, bass and brightness.</p></div>
      <div className={`system-status ${cameraOn ? 'online' : ''}`}><span/> {cameraOn ? 'CAMERA ACTIVE' : 'READY LOCALLY'}</div>
    </header>
    <section className="control-dock" aria-label="Experience controls">
      <div className="current-state"><span className="state-orb"/><div><span>STATUS</span><strong>{STATUS[state]}</strong>{detail && <small>{detail}</small>}</div></div>
      {calibrating && <div className="phase-progress"><span style={{ width: `${phaseProgress * 100}%` }}/></div>}
      <div className="actions">{(state === 'IDLE' || state === 'ERROR') && <button className="primary" onClick={begin}>▶ <span>Start experience</span></button>}{(state === 'READY' || state === 'PERFORMING' || state === 'TRACKING_LOST' || calibrating) && <><button onClick={begin}>↻ <span>Recalibrate</span></button><button className="danger" onClick={stop}>■ <span>Stop camera</span></button></>}</div>
    </section>
    <div className="workspace">
      <section className="camera-panel" aria-label="Camera preview">
        <div className="camera-frame">
          <video ref={videoRef} muted playsInline className={cameraOn ? '' : 'hidden'}/><canvas ref={canvasRef} className={cameraOn ? '' : 'hidden'}/>
          {!cameraOn && <div className="camera-empty"><span className="camera-glyph" aria-hidden="true">◎</span><strong>Camera is off</strong><span>Your video stays on this device.</span></div>}
          {cameraOn && <div className="local-badge"><span/> Local processing</div>}
        </div>
        <div className="privacy-line"><span aria-hidden="true">▣</span><span>Video is processed locally and is not recorded.</span></div>
        {state === 'TRACKING_LOST' && <div className="warning">Step back into view — audio will fade gently.</div>}
      </section>
      <section className="energy-panel" aria-label="Movement energy">
        <div className="meter-heading"><div><span className="eyebrow">MOVEMENT ENERGY</span><div className="energy-number" aria-live="polite">{percent}<small>/100</small></div></div><span className={`mood ${mood.toLowerCase()}`}>{mood}</span></div>
        <div className="meter-track" aria-hidden="true"><span style={{ width: `${percent}%` }}/></div>
        <div className="layers"><div className="layers-heading"><span>MUSICAL LAYERS</span><span>LIVE MIX</span></div>
          {LAYERS.map((layer) => { const strength = layer.start === 0 ? .35 + energy * .65 : Math.min(1, Math.max(0, (energy - layer.start) / .28)); const active = strength > .08; return <div className={`layer ${active ? 'active' : ''}`} key={layer.name}><span className="layer-icon" aria-hidden="true">{layer.icon}</span><span>{layer.name}</span><span className="layer-bars" aria-label={`${layer.name} ${active ? 'active' : 'inactive'}`}>{[.18,.38,.58,.78].map((level) => <i key={level} className={strength >= level ? 'on' : ''}/>)}</span></div> })}
        </div>
      </section>
    </div>
    <footer><span>ONE PERFORMER</span><i/><span>NO RECORDING</span><i/><span>GENERATED AUDIO</span></footer>
  </main>
}
