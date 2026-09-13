/** 2D point in normalized artwork coordinates [0,1] × [0,1] */
export type Point = { x: number; y: number };

/** Two musical interpretations exposed by the prototype comparison control. */
export type ExperienceMode = 'region-chords' | 'full-composition';

/** Live, normalized mix state for one artwork region / ChordCat track. */
export interface TrackMixState {
  regionId: string;
  label: string;
  track: number;
  level: number;
  role: MusicalRole;
  state: 'bed' | 'blend' | 'focus';
}

/** Musical roles for regions within the groovebox arrangement */
export type MusicalRole = 'bass' | 'harmony' | 'melody' | 'pad' | 'accent' | 'texture';

/** Playing dynamic style */
export type DynamicBehavior = 'sustained-chord' | 'arpeggio' | 'drone' | 'pulse' | 'sparkle';

/** Curated visual idea that gives a grid cell its melodic identity. */
export type MotifFamily = 'atmosphere' | 'geometry' | 'human' | 'nature';

/** Semantic layer that a vision model can eventually generate. */
export interface SemanticMotif {
  family: MotifFamily;
  visualMeaning: string;
  musicalTranslation: string;
  /** Quantized monophonic phrase; null creates a rest. */
  steps: Array<number | null>;
  /** Length of one phrase step in quarter-note beats. */
  stepBeats: number;
  /** Fraction of a step for which each note is held. Values above 1 create legato. */
  gate: number;
  /** MIDI velocity derived from the cell's visual energy and importance. */
  velocity: number;
  waveform: OscillatorType;
}

/** A single interactive region on the artwork mapped to a ChordCat track */
export interface ArtworkRegion {
  id: string;
  label: string;
  spokenLabel?: string;
  /** Polygon vertices in normalized artwork coordinates */
  polygon: Point[];
  /** Higher priority wins when regions overlap */
  priority: number;

  // ── CHORDCAT Groovebox Mapping ────────────────────────────────
  /** Assigned ChordCat Track / USB MIDI Channel (1 to 8) */
  chordcatTrack: number;
  /** Human-readable chord symbol (e.g. 'Dm9', 'Fmaj7', 'Bbmaj7#11', 'Csus2') */
  chordName: string;
  /** Exact MIDI note numbers for the chord voicing (e.g. [50, 57, 62, 65, 69]) */
  midiNotes: number[];
  /** Musical role in the arrangement */
  musicalRole: MusicalRole;
  /** How this chord expresses dynamically */
  dynamicBehavior: DynamicBehavior;
  /** Sonic description of the acoustic / synth timbre */
  timbreDescription?: string;
  /** Optional semantic melody used by the curated 4×4 experience. */
  semanticMotif?: SemanticMotif;

  // ── Envelope & Expression ─────────────────────────────────────
  attackMs: number;
  releaseMs: number;
  color?: string;
}

/** Complete definition of an artwork and its dynamic musical score */
export interface ArtworkDefinition {
  id: string;
  title: string;
  sourceImage: string;
  /** Musical key root (e.g. 'D', 'C', 'G', 'F#') */
  keyRoot: string;
  /** Musical scale / mode ('minor', 'major', 'dorian', 'lydian', 'phrygian', 'pentatonic') */
  scale: string;
  /** Tempo in BPM (e.g. 74, 88, 102) */
  tempo: number;
  /** High-level mood / artistic direction of the piece */
  moodDescription?: string;
  /** Background ambient bed texture */
  ambientTexture?: string;
  regions: ArtworkRegion[];
}

/** Region lifecycle states */
export type RegionLifecycle =
  | 'INACTIVE'
  | 'ENTER_CANDIDATE'
  | 'ACTIVE'
  | 'EXIT_CANDIDATE';

/** Events emitted by the region state machine */
export interface RegionEvent {
  type: 'enter' | 'exit';
  regionId: string;
}

/** Configurable timing values for the state machine */
export interface RegionTimingConfig {
  entryDwellMs: number;
  exitDwellMs: number;
  retriggerCooldownMs: number;
}

/** Default timing values per spec §7.1 */
export const DEFAULT_TIMING: RegionTimingConfig = {
  entryDwellMs: 140,
  exitDwellMs: 200,
  retriggerCooldownMs: 400,
};

/** Application states */
export type AppState = 'idle' | 'ready' | 'exploring';
