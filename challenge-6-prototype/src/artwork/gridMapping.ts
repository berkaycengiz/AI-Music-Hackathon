import type {
  ArtworkDefinition,
  ArtworkRegion,
  DynamicBehavior,
  MotifFamily,
  MusicalRole,
  Point,
  SemanticMotif,
} from './artworkTypes';
import type { GridCellAnalysis, VisualMovement } from './gridAnalysisTypes';
import { dominantFamily } from './gridAnalysisTypes';
import { getGridAnalysis } from './grid-analyses';
import { polygonCenter } from './regionLookup';

export const ARTWORK_GRID_SIZE = 4;
export const ARTWORK_GRID_CELL_COUNT = ARTWORK_GRID_SIZE * ARTWORK_GRID_SIZE;

const ROOT_PITCH_CLASS: Record<string, number> = {
  C: 0, 'C#': 1, Db: 1, D: 2, 'D#': 3, Eb: 3, E: 4,
  F: 5, 'F#': 6, Gb: 6, G: 7, 'G#': 8, Ab: 8, A: 9,
  'A#': 10, Bb: 10, B: 11,
};

const SCALE_INTERVALS: Record<string, number[]> = {
  major: [0, 2, 4, 5, 7, 9, 11],
  minor: [0, 2, 3, 5, 7, 8, 10],
  dorian: [0, 2, 3, 5, 7, 9, 10],
  lydian: [0, 2, 4, 6, 7, 9, 11],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
  phrygian: [0, 1, 3, 5, 7, 8, 10],
  pentatonic: [0, 2, 4, 7, 9],
  'minor-pentatonic': [0, 3, 5, 7, 10],
};

/**
 * Track 2 remains the silent 4x4 controller input. All generated motifs return
 * to one proven hardware voice so the demo needs only a single CHORDCAT sound
 * and MIDI-IN setup.
 */
export const CHORDCAT_MELODY_TRACK = 6;

const FAMILY_WAVEFORM: Record<MotifFamily, OscillatorType> = {
  geometry: 'square',
  human: 'triangle',
  nature: 'triangle',
  atmosphere: 'sine',
};

const FAMILY_ROLE: Record<MotifFamily, MusicalRole> = {
  geometry: 'accent',
  human: 'melody',
  nature: 'harmony',
  atmosphere: 'texture',
};

const FAMILY_BEHAVIOR: Record<MotifFamily, DynamicBehavior> = {
  geometry: 'pulse',
  human: 'sustained-chord',
  nature: 'arpeggio',
  atmosphere: 'sparkle',
};

const FAMILY_TIMBRE: Record<MotifFamily, string> = {
  geometry: 'Dry, precise pluck with a measured edge',
  human: 'Warm, connected lead with a soft expressive attack',
  nature: 'Light organic mallet or pluck with flowing motion',
  atmosphere: 'Restrained bell or airy pad with generous space',
};

/**
 * One recognisable melodic identity per artwork. Values are scale degrees, so
 * the same theme automatically follows the key and mode declared by the score.
 * A grid cell transforms this theme instead of inventing an unrelated phrase.
 */
const ARTWORK_THEME_DEGREES: Record<string, number[]> = {
  'creation-of-adam': [0, 2, 4, 3, 5, 4, 2, 1],
  'the-scream': [0, 5, 1, 6, 2, 4, 1, 0],
  'the-kiss': [0, 2, 4, 5, 4, 2, 3, 1],
  'wanderer-fog': [0, 2, 4, 3, 1, 3, 2, 0],
  'woman-with-parasol': [0, 2, 4, 6, 5, 4, 2, 3],
  'raft-of-medusa': [0, 1, 4, 2, 5, 3, 1, 0],
  'arnolfini-portrait': [0, 2, 4, 3, 2, 4, 2, 0],
  'landscape-fields': [0, 2, 4, 3, 5, 4, 2, 1],
  'water-lily-pond': [0, 2, 4, 3, 1, 2, 0, 1],
  'geometric-demo': [0, 4, 2, 5, 1, 3, 2, 0],
};

const DEFAULT_ARTWORK_THEME = [0, 2, 4, 3, 1, 3, 2, 0];

/** Families retain their own rhythmic articulation while sharing the theme. */
const FAMILY_RHYTHM_MASK: Record<MotifFamily, boolean[]> = {
  atmosphere: [true, false, false, true, false, false, true, false],
  geometry: [true, true, false, true, true, false, true, true],
  human: [true, false, true, true, true, false, true, true],
  nature: [true, true, true, true, true, true, true, true],
};

const MOVEMENT_CONTOURS: Record<VisualMovement, number[]> = {
  still: [0, 0, 1, 0, 0, 1, 0, 0],
  horizontal: [0, 1, 0, 1, 0, 1, 0, 1],
  vertical: [0, 4, 1, 5, 2, 4, 1, 3],
  rising: [0, 1, 2, 3, 4, 5, 6, 7],
  falling: [7, 6, 5, 4, 3, 2, 1, 0],
  diagonal: [0, 2, 1, 3, 2, 4, 3, 5],
  inward: [0, 4, 1, 3, 2, 3, 1, 2],
  outward: [2, 1, 3, 0, 4, 1, 5, 2],
  circular: [0, 2, 4, 2, 0, 3, 5, 3],
  wavelike: [0, 2, 4, 3, 1, 2, 0, 1],
  turbulent: [0, 5, 2, 6, 1, 4, 7, 3],
};

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function buildScaleNotes(artwork: ArtworkDefinition): number[] {
  const root = ROOT_PITCH_CLASS[artwork.keyRoot] ?? 0;
  const intervals = SCALE_INTERVALS[artwork.scale.toLowerCase()] || SCALE_INTERVALS.major;
  return Array.from({ length: 73 }, (_, index) => index + 30).filter((note) => {
    const interval = (note - root + 120) % 12;
    return intervals.includes(interval);
  });
}

function nearestIndex(notes: number[], target: number): number {
  return notes.reduce(
    (best, note, index) => Math.abs(note - target) < Math.abs(notes[best] - target) ? index : best,
    0,
  );
}

function makeDegreePattern(
  artwork: ArtworkDefinition,
  analysis: GridCellAnalysis,
  family: MotifFamily,
): Array<number | null> {
  const theme = ARTWORK_THEME_DEGREES[artwork.id] || DEFAULT_ARTWORK_THEME;
  const rhythmMask = FAMILY_RHYTHM_MASK[family];
  const contour = MOVEMENT_CONTOURS[analysis.movement];
  const column = (analysis.cell - 1) % ARTWORK_GRID_SIZE;
  const row = Math.floor((analysis.cell - 1) / ARTWORK_GRID_SIZE);
  // Neighbours move through at most one phase step at a time, keeping the
  // source melody recognisable while still responding to grid position.
  const phase = Math.floor((row + column) / 3);
  const rotated = theme.map((_, index) => theme[(index + phase) % theme.length]);
  const density = clamp01((analysis.energy + analysis.visualMetrics.edgeDensity * 3) / 2);

  return rotated.map((degree, index) => {
    let shouldPlay = rhythmMask[index];
    // Dense visual areas reveal more of the common melody; sparse areas leave
    // air around it. This changes rhythm without replacing its pitch identity.
    if (!shouldPlay && density > 0.72 && (index + analysis.cell) % 3 === 0) shouldPlay = true;
    if (shouldPlay && density < 0.28 && index % 2 === 1) shouldPlay = false;
    if (!shouldPlay) return null;

    // Movement bends the shared theme by only a couple of scale degrees. Large
    // register changes remain driven by brightness in patternToMidi().
    const contourDelta = Math.max(-2, Math.min(2, Math.round((contour[index] - contour[0]) / 4)));
    return degree + contourDelta;
  });
}

function patternToMidi(
  artwork: ArtworkDefinition,
  analysis: GridCellAnalysis,
  family: MotifFamily,
  degrees: Array<number | null>,
): Array<number | null> {
  const scaleNotes = buildScaleNotes(artwork);
  const familyCenter: Record<MotifFamily, number> = {
    geometry: 57,
    human: 62,
    nature: 60,
    atmosphere: 65,
  };
  const brightnessOffset = Math.round((analysis.visualMetrics.brightness - 0.5) * 16);
  const baseIndex = nearestIndex(scaleNotes, familyCenter[family] + brightnessOffset);
  const column = (analysis.cell - 1) % ARTWORK_GRID_SIZE;
  const row = Math.floor((analysis.cell - 1) / ARTWORK_GRID_SIZE);
  const neighbourOffset = Math.round(((row + column) / 6 - 0.5) * 2);

  return degrees.map((degree) => {
    if (degree === null) return null;
    const index = Math.max(0, Math.min(scaleNotes.length - 1, baseIndex + degree + neighbourOffset));
    return scaleNotes[index];
  });
}

function translationFor(analysis: GridCellAnalysis, family: MotifFamily): string {
  const familyPhrase: Record<MotifFamily, string> = {
    atmosphere: 'A spacious phrase uses sustained tones and rests to preserve the surrounding air.',
    geometry: 'A short measured ostinato translates the repeated structure into rhythm.',
    human: 'A connected lead phrase gives the human gesture a singing contour.',
    nature: 'An organic arpeggio turns natural texture into flowing motion.',
  };
  const movementPhrase: Record<VisualMovement, string> = {
    still: 'Its contour stays centered.', horizontal: 'It alternates laterally.',
    vertical: 'It moves through a wide register.', rising: 'It climbs with the visual movement.',
    falling: 'It descends with the visual movement.', diagonal: 'It advances in angled steps.',
    inward: 'It converges toward a central tone.', outward: 'It opens away from its center.',
    circular: 'It loops back around its starting tone.', wavelike: 'It rises and falls in waves.',
    turbulent: 'It uses controlled irregular leaps.',
  };
  const activity = analysis.energy > 0.72
    ? 'High visual energy increases rhythmic activity.'
    : analysis.energy < 0.3
      ? 'Low visual energy leaves more silence between events.'
      : 'Moderate energy keeps the phrase moving without crowding it.';
  return `${familyPhrase[family]} ${movementPhrase[analysis.movement]} ${activity}`;
}

function createSemanticMotif(artwork: ArtworkDefinition, analysis: GridCellAnalysis): SemanticMotif {
  const family = dominantFamily(analysis.familyWeights);
  const degrees = makeDegreePattern(artwork, analysis, family);
  const steps = patternToMidi(artwork, analysis, family, degrees);
  const stepBeats = analysis.energy > 0.78 ? 0.25 : analysis.energy < 0.28 ? 1 : 0.5;
  const baseGate: Record<MotifFamily, number> = {
    atmosphere: 1.75,
    geometry: 0.58,
    human: 1.35,
    nature: 0.78,
  };

  return {
    family,
    visualMeaning: analysis.interpretation,
    musicalTranslation: translationFor(analysis, family),
    steps,
    stepBeats,
    gate: Math.max(0.42, baseGate[family] - analysis.energy * 0.12),
    waveform: FAMILY_WAVEFORM[family],
  };
}

export function pointToGridCell(point: Point): number {
  const column = Math.min(ARTWORK_GRID_SIZE - 1, Math.floor(point.x * ARTWORK_GRID_SIZE));
  const row = Math.min(ARTWORK_GRID_SIZE - 1, Math.floor(point.y * ARTWORK_GRID_SIZE));
  return row * ARTWORK_GRID_SIZE + column + 1;
}

export function gridCellCenter(cell: number): Point {
  const index = Math.max(0, Math.min(ARTWORK_GRID_CELL_COUNT - 1, cell - 1));
  return {
    x: ((index % ARTWORK_GRID_SIZE) + 0.5) / ARTWORK_GRID_SIZE,
    y: (Math.floor(index / ARTWORK_GRID_SIZE) + 0.5) / ARTWORK_GRID_SIZE,
  };
}

function gridCellPolygon(cell: number): Point[] {
  const index = cell - 1;
  const column = index % ARTWORK_GRID_SIZE;
  const row = Math.floor(index / ARTWORK_GRID_SIZE);
  const left = column / ARTWORK_GRID_SIZE;
  const top = row / ARTWORK_GRID_SIZE;
  const right = (column + 1) / ARTWORK_GRID_SIZE;
  const bottom = (row + 1) / ARTWORK_GRID_SIZE;
  return [
    { x: left, y: top }, { x: right, y: top },
    { x: right, y: bottom }, { x: left, y: bottom },
  ];
}

function closestSourceRegion(artwork: ArtworkDefinition, point: Point): ArtworkRegion {
  return artwork.regions.reduce((closest, region) => {
    const closestCenter = polygonCenter(closest.polygon);
    const regionCenter = polygonCenter(region.polygon);
    const closestDistance = Math.hypot(point.x - closestCenter.x, point.y - closestCenter.y);
    const regionDistance = Math.hypot(point.x - regionCenter.x, point.y - regionCenter.y);
    return regionDistance < closestDistance ? region : closest;
  });
}

function variedNotes(notes: number[], variation: number): number[] {
  if (notes.length === 0) return [60, 64, 67, 71];
  if (variation === 0) return [...notes];
  if (variation === 1) return notes.map((note, index) => index === 0 ? note + 12 : note).sort((a, b) => a - b);
  if (variation === 2) return notes.map((note, index) => index === notes.length - 1 ? note - 12 : note).sort((a, b) => a - b);
  return notes.map((note, index) => index % 2 === 0 ? note : note + 12).sort((a, b) => a - b);
}

const FALLBACK_BEHAVIORS: DynamicBehavior[] = ['sustained-chord', 'arpeggio', 'pulse', 'sparkle'];

export function createGridRegions(artwork: ArtworkDefinition): ArtworkRegion[] {
  if (artwork.regions.length === 0) return [];
  const curatedAnalysis = getGridAnalysis(artwork.id);

  return Array.from({ length: ARTWORK_GRID_CELL_COUNT }, (_, index) => {
    const cell = index + 1;
    const source = closestSourceRegion(artwork, gridCellCenter(cell));
    const analysis = curatedAnalysis?.cells[index] || null;

    if (!analysis) {
      const variation = index % ARTWORK_GRID_SIZE;
      return {
        ...source,
        id: `${artwork.id}-grid-${cell}`,
        label: `Cell ${String(cell).padStart(2, '0')} · ${source.label}`,
        spokenLabel: `Cell ${cell}. ${source.spokenLabel || source.label}`,
        polygon: gridCellPolygon(cell),
        priority: 1,
        chordName: `${source.chordName} · V${variation + 1}`,
        midiNotes: variedNotes(source.midiNotes, variation),
        dynamicBehavior: FALLBACK_BEHAVIORS[variation],
        timbreDescription: `${source.timbreDescription || source.label} — grid variation ${variation + 1}`,
      };
    }

    const semanticMotif = createSemanticMotif(artwork, analysis);
    const family = semanticMotif.family;
    const midiNotes = Array.from(new Set(semanticMotif.steps.filter((note): note is number => note !== null)));

    return {
      ...source,
      id: `${artwork.id}-grid-${cell}`,
      label: `Cell ${String(cell).padStart(2, '0')} · ${analysis.label}`,
      spokenLabel: `Cell ${cell}. ${analysis.interpretation}`,
      polygon: gridCellPolygon(cell),
      priority: 1,
      chordcatTrack: CHORDCAT_MELODY_TRACK,
      chordName: `${artwork.keyRoot} ${family} · ${analysis.movement}`,
      midiNotes: midiNotes.length ? midiNotes : variedNotes(source.midiNotes, index % ARTWORK_GRID_SIZE),
      musicalRole: FAMILY_ROLE[family],
      dynamicBehavior: FAMILY_BEHAVIOR[family],
      timbreDescription: `${FAMILY_TIMBRE[family]} · ${analysis.label}`,
      attackMs: family === 'human' ? 120 : family === 'atmosphere' ? 240 : 35,
      releaseMs: family === 'atmosphere' ? 850 : family === 'human' ? 480 : 260,
      color: analysis.visualMetrics.color,
      semanticMotif,
    };
  });
}
