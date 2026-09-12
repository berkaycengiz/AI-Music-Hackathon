import type { ArtworkDefinition } from '../artworkTypes';

import creationOfAdamJson from './the-creation-of-adam.json';
import theScreamJson from './the-scream.json';
import theKissJson from './the-kiss.json';
import wandererFogJson from './wanderer-fog.json';
import womanWithParasolJson from './woman-with-parasol.json';
import raftOfMedusaJson from './raft-of-medusa.json';
import arnolfiniPortraitJson from './arnolfini-portrait.json';
import landscapeFieldsJson from './landscape-fields.json';
import pondLandscapeJson from './pond-landscape.json';
import demoArtworkJson from './demo-artwork.json';

/** All 9 curated museum masterpieces with complete ChordCat 8-track groovebox scores */
export const CURATED_ARTWORKS: Record<string, ArtworkDefinition> = {
  'creation-of-adam': creationOfAdamJson as ArtworkDefinition,
  'the-scream': theScreamJson as ArtworkDefinition,
  'the-kiss': theKissJson as ArtworkDefinition,
  'wanderer-fog': wandererFogJson as ArtworkDefinition,
  'woman-with-parasol': womanWithParasolJson as ArtworkDefinition,
  'raft-of-medusa': raftOfMedusaJson as ArtworkDefinition,
  'arnolfini-portrait': arnolfiniPortraitJson as ArtworkDefinition,
  'landscape-fields': landscapeFieldsJson as ArtworkDefinition,
  'pond-landscape': pondLandscapeJson as ArtworkDefinition,
  'geometric-demo': demoArtworkJson as ArtworkDefinition,
};
