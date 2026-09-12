import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { Chord } from '../types'

type Engine = {
  synth: Tone.PolySynth
  filter: Tone.Filter
  limiter: Tone.Limiter
  loop: Tone.Sequence<Chord> | null
}

export function useMusicEngine() {
  const engineRef = useRef<Engine | null>(null)
  const [audioReady, setAudioReady] = useState(false)

  const startAudio = useCallback(async () => {
    await Tone.start()
    if (!engineRef.current) {
      const limiter = new Tone.Limiter(-3).toDestination()
      const filter = new Tone.Filter({ type: 'lowpass', frequency: 2600, rolloff: -12 }).connect(limiter)
      const synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.08, decay: 0.35, sustain: 0.38, release: 1.6 },
      }).connect(filter)
      synth.volume.value = -8
      Tone.getTransport().bpm.value = 92
      engineRef.current = { synth, filter, limiter, loop: null }
    }
    setAudioReady(true)
  }, [])

  const playChord = useCallback((chord: Chord) => {
    engineRef.current?.synth.triggerAttackRelease(chord.notes, '2n', Tone.now(), 0.82)
  }, [])

  const stopLoop = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    Tone.getTransport().stop()
    Tone.getTransport().position = 0
    engine.loop?.dispose()
    engine.loop = null
    engine.synth.releaseAll()
  }, [])

  const playLoop = useCallback((progression: Chord[]) => {
    const engine = engineRef.current
    if (!engine || progression.length !== 4) return
    stopLoop()
    engine.loop = new Tone.Sequence((time, chord) => {
      engine.synth.triggerAttackRelease(chord.notes, '2n', time, 0.75)
    }, progression, '1m').start(0)
    engine.loop.loop = true
    Tone.getTransport().position = 0
    Tone.getTransport().start('+0.05')
  }, [stopLoop])

  const setBpm = useCallback((bpm: number) => {
    Tone.getTransport().bpm.rampTo(bpm, 0.15)
  }, [])

  useEffect(() => () => {
    const engine = engineRef.current
    if (!engine) return
    Tone.getTransport().stop()
    engine.loop?.dispose()
    engine.synth.dispose()
    engine.filter.dispose()
    engine.limiter.dispose()
  }, [])

  return { audioReady, startAudio, playChord, playLoop, stopLoop, setBpm }
}
