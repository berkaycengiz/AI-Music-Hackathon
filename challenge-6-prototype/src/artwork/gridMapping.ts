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

const FAMILY_TRACK: Record<MotifFamily, number> = {
  geometry: 5,
  human: 6,
  nature: 7,
  atmosphere: 8,
};

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

const BASE_DEGREES: Record<MotifFamily, Array<number | null>> = {
  atmosphere: [0, null, null, 4, null, null, 2, null],
  geometry: [0, 4, null, 2, 0, null, 3, 1],
  human: [0, null, 1, 2, 4, null, 3, 2],
  nature: [0, 2, 4, 1, 3, 5, 4, 2],
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

function hashSeed(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
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

function makeDegreePattern(analysis: GridCellAnalysis, family: MotifFamily): Array<number | null> {
  const base = [...BASE_DEGREES[family]];
  const contour = MOVEMENT_CONTOURS[analysis.movement];
  const seed = hashSeed(`${analysis.cell}:${analysis.label}`);
  const rotation = seed % base.length;
  const rotated = base.map((_, index) => base[(index + rotation) % base.length]);

  return rotated.map((degree, index) => {
    const density = clamp01((analysis.energy + analysis.visualMetrics.edgeDensity * 3) / 2);
    if (degree === null && density > 0.7 && (seed + index) % 3 === 0) {
      return contour[index] % 5;
    }
    if (degree !== null && density < 0.28 && index % 2 === 1) return null;
    if (degree === null) return null;
    return Math.round((degree + contour[index]) / 2);
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
    geometry: 52,
    human: 64,
    nature: 60,
    atmosphere: 67,
  };
  const brightnessOffset = Math.round((analysis.visualMetrics.brightness - 0.5) * 16);
  const baseIndex = nearestIndex(scaleNotes, familyCenter[family] + brightnessOffset);
  const seedOffset = hashSeed(`${artwork.id}:${analysis.cell}`) % 3;

  return degrees.map((degree) => {
    if (degree === null) return null;
    const index = Math.max(0, Math.min(scaleNotes.length - 1, baseIndex + degree + seedOffset));
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
  const degrees = makeDegreePattern(analysis, family);
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
      chordcatTrack: FAMILY_TRACK[family],
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
