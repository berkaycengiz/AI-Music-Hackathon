import { useCallback, useEffect, useRef, useState } from 'react'
import type { Degree } from '../types'

type MidiOutputLike = {
  id: string
  name?: string | null
  manufacturer?: string | null
  state?: string
  send(data: number[] | Uint8Array, timestamp?: number): void
}

type MidiAccessLike = {
  outputs: Map<string, MidiOutputLike>
  onstatechange: (() => void) | null
}

type MidiNavigator = Navigator & {
  requestMIDIAccess?: () => Promise<MidiAccessLike>
}

const DEFAULT_CHORDCAT_MAP: Record<Degree, number> = {
  1: 60,
  2: 61,
  3: 62,
  4: 63,
  5: 64,
  6: 65,
}

export function useMidiOutput() {
  const accessRef = useRef<MidiAccessLike | null>(null)
  const noteTimersRef = useRef<number[]>([])
  const [outputs, setOutputs] = useState<MidiOutputLike[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [channel, setChannel] = useState(1)
  const [status, setStatus] = useState<'IDLE' | 'CONNECTED' | 'UNAVAILABLE' | 'NO_DEVICE'>('IDLE')

  const refreshOutputs = useCallback(() => {
    const next = accessRef.current ? [...accessRef.current.outputs.values()] : []
    setOutputs(next)
    setSelectedId((current) => {
      if (next.some((output) => output.id === current)) return current
      return next.find((output) => output.name?.toLowerCase().includes('chordcat'))?.id ?? next[0]?.id ?? ''
    })
    setStatus(next.length ? 'CONNECTED' : 'NO_DEVICE')
  }, [])

  const initializeMidi = useCallback(async () => {
    const request = (navigator as MidiNavigator).requestMIDIAccess
    if (!request) {
      setStatus('UNAVAILABLE')
      return false
    }
    try {
      accessRef.current = await request.call(navigator)
      accessRef.current.onstatechange = refreshOutputs
      refreshOutputs()
      return true
    } catch {
      setStatus('UNAVAILABLE')
      return false
    }
  }, [refreshOutputs])

  const playDegree = useCallback((degree: Degree, durationMs = 720) => {
    const output = accessRef.current?.outputs.get(selectedId)
    if (!output) return false
    const midiChannel = Math.max(0, Math.min(15, channel - 1))
    const note = DEFAULT_CHORDCAT_MAP[degree]
    output.send([0x90 + midiChannel, note, 100])
    const timer = window.setTimeout(() => output.send([0x80 + midiChannel, note, 0]), durationMs)
    noteTimersRef.current.push(timer)
    return true
  }, [channel, selectedId])

  const allNotesOff = useCallback(() => {
    noteTimersRef.current.forEach(window.clearTimeout)
    noteTimersRef.current = []
    const output = accessRef.current?.outputs.get(selectedId)
    if (!output) return
    const midiChannel = Math.max(0, Math.min(15, channel - 1))
    output.send([0xb0 + midiChannel, 123, 0])
    output.send([0xb0 + midiChannel, 120, 0])
  }, [channel, selectedId])

  useEffect(() => () => allNotesOff(), [allNotesOff])

  return {
    outputs,
    selectedId,
    setSelectedId,
    channel,
    setChannel,
    status,
    initializeMidi,
    refreshOutputs,
    playDegree,
    allNotesOff,
  }
}
