import type { Chord, Degree, MusicalAction } from '../types'

export const HARMONY: Record<Degree, Chord> = {
  1: { id: 'one', degree: 1, name: 'C Major', shortName: 'C', numeral: 'I', notes: ['C4', 'E4', 'G4'] },
  2: { id: 'two', degree: 2, name: 'D Minor', shortName: 'Dm', numeral: 'ii', notes: ['D4', 'F4', 'A4'] },
  3: { id: 'three', degree: 3, name: 'E Minor', shortName: 'Em', numeral: 'iii', notes: ['E4', 'G4', 'B4'] },
  4: { id: 'four', degree: 4, name: 'F Major', shortName: 'F', numeral: 'IV', notes: ['F3', 'A3', 'C4'] },
  5: { id: 'five', degree: 5, name: 'G Major', shortName: 'G', numeral: 'V', notes: ['G3', 'B3', 'D4'] },
  6: { id: 'six', degree: 6, name: 'A Minor', shortName: 'Am', numeral: 'vi', notes: ['A3', 'C4', 'E4'] },
}

const TRANSITIONS: Record<Degree, Record<MusicalAction, Degree[]>> = {
  1: { FORWARD: [4, 5, 6, 2], RESOLVE: [6, 3, 1] },
  2: { FORWARD: [5, 4], RESOLVE: [1, 6] },
  3: { FORWARD: [6, 4], RESOLVE: [1, 6] },
  4: { FORWARD: [5, 2, 6], RESOLVE: [1, 6] },
  5: { FORWARD: [6, 4, 2], RESOLVE: [1, 6] },
  6: { FORWARD: [2, 4, 5], RESOLVE: [1, 3] },
}

export const STEP_SYMBOLS: Record<Degree, string> = {
  1: '●',
  2: '◒',
  3: '◆',
  4: '▲',
  5: '■',
  6: '✦',
}

export function chooseNextChord(current: Degree, history: Degree[], action: MusicalAction, phraseStep: number) {
  if (phraseStep === 3 && action === 'RESOLVE') return HARMONY[1]
  const candidates = TRANSITIONS[current][action].filter((degree) => degree !== current)
  const previous = history.at(-2) ?? 0
  const seed = current * 7 + history.length * 3 + previous + (action === 'FORWARD' ? 2 : 0)
  return HARMONY[candidates[seed % candidates.length]]
}
