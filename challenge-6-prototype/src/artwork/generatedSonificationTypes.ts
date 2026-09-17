export interface GeneratedColor {
  rgb: number[];
  hue: number;
  saturation: number;
  brightness: number;
  lightness: number;
  weight: number;
}

export interface GeneratedNote {
  pitch: number;
  start: number;
  duration: number;
  velocity: number;
  articulation: string;
}

export interface GeneratedSquareSonification {
  bounds: number[];
  dominant_colors: GeneratedColor[];
  edge_density: number;
  long_contour_ratio: number;
  angularity: number;
  orientation_degrees: number | null;
  orientation_strength: number;
  smoothness: number;
  flow: number;
  complexity: number;
  index: number;
  chord: {
    degree: number;
    symbol: string;
    pitches: number[];
  };
  notes: GeneratedNote[];
  tempo: number;
  beats: number;
}

export interface GeneratedArtworkSonification {
  global: {
    key: string;
    tonic_pc: number;
    mode: string;
    tempo: number;
    scale: number[];
  };
  image: {
    source_size: number[];
    grid_size: number[];
  };
  squares: Record<string, GeneratedSquareSonification>;
}
