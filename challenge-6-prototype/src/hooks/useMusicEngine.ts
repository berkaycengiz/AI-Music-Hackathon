import { useCallback, useEffect, useRef, useState } from 'react'
import * as Tone from 'tone'
import type { Chord } from '../types'

type Engine = {
  pad: Tone.PolySynth
  bass: Tone.PolySynth
  lead: Tone.PolySynth
  kick: Tone.MembraneSynth
  snare: Tone.NoiseSynth
  hat: Tone.MetalSynth
  filter: Tone.Filter
  limiter: Tone.Limiter
  pulseLoop: Tone.Loop | null
  chordLoop: Tone.Sequence<Chord> | null
}

function atOctave(note: string, octave: number) {
  return note.replace(/\d+$/, String(octave))
}

export function useMusicEngine() {
  const engineRef = useRef<Engine | null>(null)
  const [audioReady, setAudioReady] = useState(false)
  const [beatIndex, setBeatIndex] = useState(0)
  const [energyLevel, setEnergyLevel] = useState(1)
  const energyRef = useRef(1)

  const startAudio = useCallback(async () => {
    await Tone.start()
    if (!engineRef.current) {
      const limiter = new Tone.Limiter(-3).toDestination()
      const filter = new Tone.Filter({ type: 'lowpass', frequency: 2600, rolloff: -12 }).connect(limiter)
      const pad = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'fatsine4', spread: 18, count: 2 },
        envelope: { attack: 0.18, decay: 0.45, sustain: 0.46, release: 1.8 },
      }).connect(filter)
      pad.volume.value = -11
      const bass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'square' },
        envelope: { attack: 0.01, decay: 0.25, sustain: 0.28, release: 0.4 },
      }).connect(limiter)
      bass.volume.value = -14
      const lead = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'triangle8' }, envelope: { attack: 0.02, decay: 0.18, sustain: 0.12, release: 0.55 } }).connect(filter)
      lead.volume.value = -17
      const kick = new Tone.MembraneSynth({
        pitchDecay: 0.025,
        octaves: 5,
        envelope: { attack: 0.001, decay: 0.22, sustain: 0, release: 0.12 },
      }).connect(limiter)
      kick.volume.value = -9
      const snare = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: 0.001, decay: 0.12, sustain: 0 } }).connect(limiter)
      snare.volume.value = -18
      const hat = new Tone.MetalSynth({ envelope: { attack: 0.001, decay: 0.045, release: 0.01 }, harmonicity: 5.1, modulationIndex: 22, resonance: 2800, octaves: 1.5 }).connect(limiter)
      hat.frequency.value = 220
      hat.volume.value = -27
      Tone.getTransport().bpm.value = 96
      engineRef.current = { pad, bass, lead, kick, snare, hat, filter, limiter, pulseLoop: null, chordLoop: null }
    }
    setAudioReady(true)
  }, [])

  const startClock = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    if (!engine.pulseLoop) {
      let step = 0
      engine.pulseLoop = new Tone.Loop((time) => {
        const position = step % 8
        const energy = energyRef.current
        if (position === 0 || (energy >= 2 && position === 4) || (energy >= 3 && position === 6)) engine.kick.triggerAttackRelease(position === 0 ? 'C1' : 'G1', '16n', time, position === 0 ? .78 : .48)
        if (energy >= 1 && (position === 2 || position === 6)) engine.snare.triggerAttackRelease('16n', time, energy >= 3 ? .4 : .26)
        if (energy >= 2 && (position % 2 === 1 || energy >= 3)) engine.hat.triggerAttackRelease('32n', time, position % 2 ? .17 : .1)
        if (position % 2 === 0) {
          const visibleBeat = position / 2
          Tone.getDraw().schedule(() => setBeatIndex(visibleBeat), time)
        }
        step += 1
      }, '8n').start(0)
    }
    if (Tone.getTransport().state !== 'started') Tone.getTransport().start('+0.05')
  }, [])

  const queueChord = useCallback((chord: Chord, onPlayed?: () => void, playBrowserAudio = true) => {
    const engine = engineRef.current
    if (!engine) return
    startClock()
    const transport = Tone.getTransport()
    const beatTicks = Tone.Time('4n').toTicks()
    const nextBeat = Math.ceil((transport.ticks + 1) / beatTicks) * beatTicks
    transport.scheduleOnce((time) => {
      if (playBrowserAudio) {
        const energy = energyRef.current
        engine.pad.triggerAttackRelease(chord.notes, '1m', time, .64)
        if (energy >= 1) engine.bass.triggerAttackRelease(atOctave(chord.notes[0], 2), '4n', time, .72)
        if (energy >= 3) engine.lead.triggerAttackRelease(atOctave(chord.notes[1], 5), '8n', time + Tone.Time('8n').toSeconds(), .38)
      }
      if (onPlayed) window.setTimeout(onPlayed, 0)
    }, `${nextBeat}i`)
  }, [startClock])

  const stopLoop = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.chordLoop?.dispose()
    engine.chordLoop = null
    engine.pad.releaseAll()
    engine.bass.releaseAll()
    engine.lead.releaseAll()
  }, [])

  const playLoop = useCallback((progression: Chord[], onStep?: (index: number, chord: Chord) => void, playBrowserAudio = true) => {
    const engine = engineRef.current
    if (!engine || progression.length !== 4) return
    stopLoop()
    startClock()
    let step = 0
    const transport = Tone.getTransport()
    const beatTicks = Tone.Time('4n').toTicks()
    const nextBeat = Math.ceil((transport.ticks + 1) / beatTicks) * beatTicks
    engine.chordLoop = new Tone.Sequence((time, chord) => {
      const index = step % progression.length
      if (playBrowserAudio) {
        const energy = energyRef.current
        const quarter = Tone.Time('4n').toSeconds()
        engine.pad.triggerAttackRelease(chord.notes, '1m', time, energy === 0 ? .34 : .58)
        if (energy >= 1) {
          const root = atOctave(chord.notes[0], 2)
          const fifth = atOctave(chord.notes[2], 2)
          engine.bass.triggerAttackRelease(root, '8n', time, .72)
          engine.bass.triggerAttackRelease(energy >= 2 ? fifth : root, '8n', time + quarter * 2, .55)
          if (energy >= 3) engine.bass.triggerAttackRelease(root, '8n', time + quarter * 3, .48)
        }
        if (energy >= 3) {
          const motif = chord.notes.map((note) => atOctave(note, 5))
          motif.forEach((note, noteIndex) => engine.lead.triggerAttackRelease(note, '16n', time + quarter * (.5 + noteIndex), .3))
        }
      }
      onStep?.(index, chord)
      step += 1
    }, progression, '1m').start(`${nextBeat}i`)
    engine.chordLoop.loop = true
  }, [startClock, stopLoop])

  const stopAll = useCallback(() => {
    const engine = engineRef.current
    if (!engine) return
    engine.chordLoop?.dispose()
    engine.chordLoop = null
    engine.pulseLoop?.dispose()
    engine.pulseLoop = null
    Tone.getTransport().stop()
    Tone.getTransport().cancel()
    Tone.getTransport().position = 0
    engine.pad.releaseAll()
    engine.bass.releaseAll()
    engine.lead.releaseAll()
    setBeatIndex(0)
  }, [])

  const shiftEnergy = useCallback((delta: number) => {
    setEnergyLevel((current) => {
      const next = Math.max(0, Math.min(3, current + delta))
      energyRef.current = next
      const engine = engineRef.current
      if (engine) {
        engine.filter.frequency.rampTo([1100, 1900, 3000, 4600][next], .3)
        engine.pad.volume.rampTo([-17, -12, -9, -7][next], .3)
      }
      return next
    })
  }, [])

  const setBpm = useCallback((bpm: number) => {
    Tone.getTransport().bpm.rampTo(bpm, 0.15)
  }, [])

  useEffect(() => () => {
    const engine = engineRef.current
    if (!engine) return
    Tone.getTransport().stop()
    engine.chordLoop?.dispose()
    engine.pulseLoop?.dispose()
    engine.pad.dispose()
    engine.bass.dispose()
    engine.lead.dispose()
    engine.kick.dispose()
    engine.snare.dispose()
    engine.hat.dispose()
    engine.filter.dispose()
    engine.limiter.dispose()
  }, [])

  return { audioReady, beatIndex, energyLevel, startAudio, startClock, queueChord, playLoop, stopLoop, stopAll, shiftEnergy, setBpm }
}
