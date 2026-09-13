import type { ArtworkGridAnalysis } from '../gridAnalysisTypes';

import arnolfiniPortrait from './arnolfini-portrait.json';
import creationOfAdam from './creation-of-adam.json';
import landscapeFields from './landscape-fields.json';
import pondLandscape from './pond-landscape.json';
import raftOfMedusa from './raft-of-medusa.json';
import theKiss from './the-kiss.json';
import theScream from './the-scream.json';
import wandererFog from './wanderer-fog.json';
import womanWithParasol from './woman-with-parasol.json';

const analyses = [
  arnolfiniPortrait,
  creationOfAdam,
  landscapeFields,
  pondLandscape,
  raftOfMedusa,
  theKiss,
  theScream,
  wandererFog,
  womanWithParasol,
] as ArtworkGridAnalysis[];

export const CURATED_GRID_ANALYSES: Record<string, ArtworkGridAnalysis> = Object.fromEntries(
  analyses.map((analysis) => [analysis.artworkId, analysis]),
);

export function getGridAnalysis(artworkId: string): ArtworkGridAnalysis | null {
  return CURATED_GRID_ANALYSES[artworkId] || null;
}
