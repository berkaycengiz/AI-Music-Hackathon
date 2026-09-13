import type { MotifFamily } from './artworkTypes';

export type VisualMovement =
  | 'still'
  | 'horizontal'
  | 'vertical'
  | 'rising'
  | 'falling'
  | 'diagonal'
  | 'inward'
  | 'outward'
  | 'circular'
  | 'wavelike'
  | 'turbulent';

export interface FamilyWeights {
  atmosphere: number;
  geometry: number;
  human: number;
  nature: number;
}

export interface CellVisualMetrics {
  color: string;
  brightness: number;
  saturation: number;
  warmth: number;
  contrast: number;
  edgeDensity: number;
}

export interface GridCellAnalysis {
  cell: number;
  label: string;
  subjects: string[];
  familyWeights: FamilyWeights;
  movement: VisualMovement;
  energy: number;
  importance: number;
  interpretation: string;
  visualMetrics: CellVisualMetrics;
}

export interface ArtworkGridAnalysis {
  artworkId: string;
  globalAnalysis: {
    mood: string[];
    visualFlow: string;
    curatorialNote: string;
  };
  cells: GridCellAnalysis[];
}

export function dominantFamily(weights: FamilyWeights): MotifFamily {
  return (Object.entries(weights) as Array<[MotifFamily, number]>).reduce(
    (best, candidate) => candidate[1] > best[1] ? candidate : best,
  )[0];
}
