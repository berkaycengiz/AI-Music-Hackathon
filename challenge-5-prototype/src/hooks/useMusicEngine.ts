import { useCallback, useEffect, useRef } from 'react'
import * as Tone from 'tone'

type Engine = {
  pad: Tone.PolySynth; bass: Tone.MonoSynth; kick: Tone.MembraneSynth; hat: Tone.NoiseSynth; lead: Tone.Synth
  gains: Record<'pad'|'bass'|'drums'|'lead', Tone.Gain>; loops: Tone.Loop[]
}
const scaled = (energy: number, start: number, end: number, max: number) => Math.min(max, Math.max(0, (energy - start) / (end - start) * max))

export function useMusicEngine() {
  const engineRef = useRef<Engine | null>(null)

  const startAudio = useCallback(async () => {
    await Tone.start()
    if (engineRef.current) return
    Tone.getTransport().bpm.value = 114
    const limiter = new Tone.Limiter(-2).toDestination(), filter = new Tone.Filter(1700, 'lowpass').connect(limiter)
    const gains = {
      pad: new Tone.Gain(.15).connect(filter), bass: new Tone.Gain(0).connect(filter),
      drums: new Tone.Gain(0).connect(limiter), lead: new Tone.Gain(0).connect(filter),
    }
    const pad = new Tone.PolySynth(Tone.Synth, { oscillator: { type: 'sine' }, envelope: { attack: 1.2, decay: .3, sustain: .65, release: 1.8 } }).connect(gains.pad)
    const bass = new Tone.MonoSynth({ oscillator: { type: 'triangle' }, envelope: { attack: .03, decay: .25, sustain: .25, release: .4 }, filterEnvelope: { attack: .02, decay: .15, sustain: .25, release: .5, baseFrequency: 90, octaves: 2.8 } }).connect(gains.bass)
    const kick = new Tone.MembraneSynth({ pitchDecay: .05, octaves: 7, envelope: { attack: .001, decay: .35, sustain: 0 } }).connect(gains.drums)
    const hat = new Tone.NoiseSynth({ noise: { type: 'white' }, envelope: { attack: .001, decay: .035, sustain: 0 } }).connect(gains.drums)
    const lead = new Tone.Synth({ oscillator: { type: 'sine' }, envelope: { attack: .01, decay: .08, sustain: .12, release: .15 } }).connect(gains.lead)
    const chords = [['D3','A3','C4','E4'],['Bb2','F3','A3','D4'],['F3','A3','C4','E4'],['C3','G3','Bb3','D4']]
    let chord = 0, bassStep = 0, drumStep = 0, leadStep = 0
    const padLoop = new Tone.Loop((time) => { pad.triggerAttackRelease(chords[chord++ % chords.length], '2m', time, .55) }, '2m')
    const bassNotes = ['D2','D2','Bb1','Bb1','F2','F2','C2','C2']
    const bassLoop = new Tone.Loop((time) => { bass.triggerAttackRelease(bassNotes[bassStep++ % bassNotes.length], '8n', time, .7) }, '4n')
    const drumLoop = new Tone.Loop((time) => { if (drumStep % 4 === 0 || drumStep % 8 === 6) kick.triggerAttackRelease('D1', '16n', time, .9); if (drumStep++ % 2 === 1) hat.triggerAttackRelease('32n', time, .25) }, '8n')
    const notes = ['D5','F5','A5','C6','A5','F5','E5','G5']
    const leadLoop = new Tone.Loop((time) => { lead.triggerAttackRelease(notes[leadStep++ % notes.length], '16n', time, .22) }, '8n')
    const loops = [padLoop, bassLoop, drumLoop, leadLoop]; loops.forEach((loop) => loop.start(0)); Tone.getTransport().start()
    engineRef.current = { pad, bass, kick, hat, lead, gains, loops }
  }, [])

  const setEnergy = useCallback((energy: number) => {
    const engine = engineRef.current
    if (!engine) return
    engine.gains.pad.gain.rampTo(.13 + energy * .07, .22)
    engine.gains.bass.gain.rampTo(scaled(energy, .16, .5, .55), .22)
    engine.gains.drums.gain.rampTo(scaled(energy, .38, .76, .58), .2)
    engine.gains.lead.gain.rampTo(scaled(energy, .7, .98, .28), .2)
  }, [])
  const silence = useCallback(() => { if (engineRef.current) Object.values(engineRef.current.gains).forEach((gain) => gain.gain.rampTo(0, .7)) }, [])

  useEffect(() => () => {
    const e = engineRef.current
    if (!e) return
    e.loops.forEach((loop) => loop.dispose()); e.pad.dispose(); e.bass.dispose(); e.kick.dispose(); e.hat.dispose(); e.lead.dispose()
    Object.values(e.gains).forEach((gain) => gain.dispose()); Tone.getTransport().stop()
  }, [])
  return { startAudio, setEnergy, silence }
}
