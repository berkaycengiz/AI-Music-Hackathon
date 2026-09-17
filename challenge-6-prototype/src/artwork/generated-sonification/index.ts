import type { GeneratedArtworkSonification } from '../generatedSonificationTypes';

import arnolfiniPortrait from './arnolfini-portrait.json';
import creationOfAdam from './creation-of-adam.json';
import landscapeFields from './landscape-fields.json';
import pondLandscape from './pond-landscape.json';
import raftOfMedusa from './raft-of-medusa.json';
import theKiss from './the-kiss.json';
import theScream from './the-scream.json';
import wandererFog from './wanderer-fog.json';
import womanWithParasol from './woman-with-parasol.json';

const generatedAnalyses: Record<string, GeneratedArtworkSonification> = {
  'arnolfini-portrait': arnolfiniPortrait as GeneratedArtworkSonification,
  'creation-of-adam': creationOfAdam as GeneratedArtworkSonification,
  'landscape-fields': landscapeFields as GeneratedArtworkSonification,
  'water-lily-pond': pondLandscape as GeneratedArtworkSonification,
  'raft-of-medusa': raftOfMedusa as GeneratedArtworkSonification,
  'the-kiss': theKiss as GeneratedArtworkSonification,
  'the-scream': theScream as GeneratedArtworkSonification,
  'wanderer-fog': wandererFog as GeneratedArtworkSonification,
  'woman-with-parasol': womanWithParasol as GeneratedArtworkSonification,
};

export function getGeneratedSonification(artworkId: string): GeneratedArtworkSonification | null {
  return generatedAnalyses[artworkId] || null;
}
