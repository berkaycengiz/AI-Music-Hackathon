# Museum Sonic Explorer — Project Context and Implementation Handoff

> AI Music Hackathon 2026 — Challenge 6
>
> Status date: 13 September 2026
>
> Prototype directory: `challenge-6-prototype/`
>
> Current input: mouse for development, AlphaTheta CHORDCAT for the installation
>
> Document purpose: authoritative context for continuing product, interaction, music, and hardware work

---

## 1. Executive Summary

Museum Sonic Explorer is an accessible, performative way to experience a painting through touch and music. The final installation should pair a tactile or relief reproduction of an artwork with an AlphaTheta CHORDCAT. The visitor should not feel as if they are operating music-production software. They should feel that they are exploring and performing the painting itself.

The project has moved away from camera, face tracking, head tracking, eye gestures, and free-form XY tracking. Those approaches created unnecessary calibration, accessibility, latency, and reliability risks. CHORDCAT is now intended to serve two roles:

1. **Physical controller:** its sixteen playable chord/step keys select a corresponding cell in a 4×4 representation of the artwork.
2. **Sound engine:** its presets, patterns, synthesis, sequencing, and effects should produce the final musical result.

The latest hardware capture proves that the sixteen physical keys can be distinguished in the current CHORDCAT configuration. Each key emits a unique four- or five-note MIDI chord signature on MIDI channel 2. The web application can collect the notes arriving within a short time window, recognize the signature, debounce accidental duplicate gestures, and map it to one of sixteen image cells.

The intended next version divides each artwork into a stable 4×4 grid. Every cell has:

- a spatial identity,
- a curated color and texture profile,
- a musical motif family,
- a variation of that motif,
- a CHORDCAT input signature,
- and optional semantic narration.

Similar colors in several cells are not treated as an error. They should produce related variations of the same motif family, preserving visual and musical unity without making the cells sound identical.

---

## 2. Product Thesis

### 2.1 The problem

Traditional museum audio guides are passive and linear. They can describe an artwork but do not communicate its spatial composition through direct exploration. Purely musical sonification has the opposite problem: it can communicate mood and relationships but cannot reliably explain what an object is.

Museum Sonic Explorer combines three complementary layers:

1. **Tactile structure** communicates position, shape, boundaries, and spatial relationships.
2. **Music** communicates atmosphere, emphasis, tension, repetition, contrast, and movement.
3. **Concise narration** communicates semantic information that music cannot express reliably.

Music is not claimed to literally translate a painting or replace description. The visitor performs an artistic interpretation of the painting.

### 2.2 Audience

Accessibility is interpreted broadly:

- Blind and low-vision visitors gain a tactile, spatial, and auditory way to explore a painting.
- Visitors with no musical training can shape a coherent composition without learning a groovebox.
- Sighted visitors can experience the artwork through a different sensory model.
- A facilitator can prepare the system, select an artwork, verify MIDI, and stop sound safely.

This is a hackathon prototype and not disability-user validation. A production version should be co-designed and tested with blind and low-vision visitors.

### 2.3 Experience principle

The user-facing object is the artwork, not CHORDCAT. CHORDCAT is an enabling instrument behind the experience. Its internal vocabulary—tracks, CC numbers, pattern banks, MIDI channels—should be visible only in the facilitator interface.

---

## 3. Scope Decisions

### 3.1 Active decisions

- Continue as a local web application.
- Use the mouse only as a development simulator.
- Use CHORDCAT as the physical controller in the final demonstration.
- Use CHORDCAT as the preferred sound engine.
- Divide the artwork into a stable 4×4 grid.
- Map the sixteen CHORDCAT keys to the sixteen artwork cells.
- Keep the entire artwork inside one coherent key, scale, tempo, and arrangement.
- Let color influence melody without making raw RGB values equal literal notes.
- Keep background musical structure continuous while selected cells change melodic material.
- Quantize important motif changes to a beat or bar boundary.
- Keep an immediate emergency stop and MIDI panic control.
- Keep all demo-critical artwork data local and deterministic.

### 3.2 Rejected or superseded directions

- Webcam interaction
- MediaPipe face or hand tracking
- Head direction and blink control
- OpenTrack/Aitrack integration
- Treating CHORDCAT's XY pad as a source of raw X/Y coordinates
- Literal object sound effects for every painted object
- Sixteen unrelated melodies generated directly from sixteen average RGB values
- Making the visitor feel as if they are learning or remotely controlling CHORDCAT

The old camera dependencies remain removed. Tone.js has been reintroduced only as the shared musical transport for quantized motif scheduling; CHORDCAT remains the target sound engine.

---

## 4. Current Working Web Prototype

The code now implements the 4×4 interaction as the default experience while preserving the earlier continuous center-mix prototype as the second comparison mode. It also provides reusable UI, artwork, audio, MIDI input/output, narration, calibration, and safety foundations.

### 4.1 Technology

- React 19
- TypeScript 5.9
- Vite 7
- Canvas API
- Web Audio API
- Web MIDI API
- Web Speech API
- Tone.js Transport

There is no active MediaPipe dependency. Tone.js does not perform image analysis and is not the final hardware timbre source.

### 4.2 Current experience modes

#### 4×4 Melodies (default)

The artwork is visibly divided into four columns and four rows. Mouse movement and the sixteen calibrated CHORDCAT keys address the same cells in reading order. Each cell is an independent interaction target with its own highlight and dwell lifecycle. All nine museum artworks have complete hand-authored sixteen-cell semantic analyses with four motif families: atmosphere, geometry, human, and nature. The facilitator panel exposes the visual observation and its musical translation. The geometric development demo retains the older fallback mapping.

#### Full Composition

A deterministic browser composition runs continuously. Each semantic region currently has a musical center and stem. The mouse position is compared with every center using Gaussian distance falloff:

```text
influence = exp(-(distance²) / (2 × 0.20²))
level = roleMinimum + (1 - roleMinimum) × influence
```

Role-specific minimum levels are:

| Musical role | Minimum level |
|---|---:|
| Texture | 18% |
| Pad | 16% |
| Harmony | 14% |
| Bass | 12% |
| Melody | 10% |
| Accent | 10% |

Audio gains use approximately half-second perceptual smoothing. Multiple nearby stems can blend, but a global headroom calculation reduces clipping risk. Only colored musical center points are drawn; semantic polygons and large labels are hidden.

This center-based mode remains intentionally available as the second A/B comparison experience.

### 4.3 Interaction timing

- The default mode uses exact 4×4 cell boundaries.
- Full Composition retains semantic centers and polygons.
- Entry dwell: 140 ms
- Exit dwell: 200 ms
- Per-region retrigger cooldown: 400 ms
- Highest priority wins at polygon overlaps.
- Hysteresis prevents boundary jitter.
- A stable 30 Hz interaction loop allows dwell to complete even when the pointer is stationary.

### 4.4 Color and timbre

The canvas keeps a clean, invisible source-image copy for pixel sampling. Sampling never reads overlay graphics, labels, or the cursor. Current pixel metrics include color, brightness, and warmth. Brightness drives filter cutoff; a prototype CC74 mapping exists for CHORDCAT output.

### 4.5 Narration

The Web Speech API provides concise English descriptions. Starting narration ducks the musical master level; finishing or cancelling narration restores it. New narration cancels old queued speech so descriptions do not pile up.

### 4.6 Facilitator console

The right-hand console exposes:

- current experience mode,
- active/candidate semantic region,
- lifecycle and dwell time,
- sampled source color and luminance,
- filter cutoff,
- live stem levels,
- MIDI connection and output selection,
- CHORDCAT track test controls,
- narration state,
- and emergency stop/MIDI panic.

### 4.7 Visual behavior already fixed

- Artwork images preserve their natural aspect ratio.
- Portrait artworks are not stretched into landscape canvases.
- Switching artworks immediately redraws the correct image and overlays.
- Polygon fills and boundaries are not shown in the current visual presentation.
- The canvas displays small colored track-center markers and the pointer indicator.
- The layout is responsive and works at the current 1280×720 demo viewport.

---

## 5. New 4×4 Interaction Model

### 5.1 Spatial mapping

The image and the physical controller share the same sixteen-cell index:

```text
Artwork                         CHORDCAT key order

[ 01 ][ 02 ][ 03 ][ 04 ]       [ 01 ][ 02 ][ 03 ][ 04 ]
[ 05 ][ 06 ][ 07 ][ 08 ]  <->  [ 05 ][ 06 ][ 07 ][ 08 ]
[ 09 ][ 10 ][ 11 ][ 12 ]       [ 09 ][ 10 ][ 11 ][ 12 ]
[ 13 ][ 14 ][ 15 ][ 16 ]       [ 13 ][ 14 ][ 15 ][ 16 ]
```

The assumed capture order is left-to-right and top-to-bottom. If the physical key ordering differs, the mapping table must be reordered after a labelled capture.

### 5.2 Intended interaction

1. The facilitator selects an artwork and begins the experience.
2. The artwork's continuous background arrangement starts.
3. The visitor presses one of the sixteen CHORDCAT keys.
4. The browser recognizes the key's chord signature.
5. The corresponding image cell illuminates.
6. Its color-derived motif or variation enters on the next musical boundary.
7. Repeated presses or adjacent cells can develop the phrase without breaking the shared harmony.
8. Optional narration describes the cell after an appropriate dwell or explicit request.

Mouse clicking on a cell must call the same `selectCell(index)` function as MIDI input. Mouse behavior is a development fallback, not a separate product mode.

### 5.3 Why the grid is preferable to fake XY tracking

- It is deterministic.
- It requires no spatial calibration.
- It is physically learnable.
- It maps cleanly to a tactile 4×4 overlay.
- It avoids unstable inferred coordinates.
- It provides sixteen repeatable states for judging and debugging.
- It remains usable in poor lighting and without a camera.

---

## 6. CHORDCAT MIDI Capture Results

### 6.1 Capture files and tool

Diagnostic monitor:

```text
chordcat_script/chordcat_midi_monitor_filtered.py
```

Full sixteen-key capture:

```text
chordcat_script/chordcat_16keys.jsonl
```

The Python monitor uses `mido` and `python-rtmidi`. It can list MIDI inputs, print events, and record JSONL/CSV. It hides CC11 only from terminal output by default; filtered events are still written to capture files.

The Python script is a diagnostic tool, not the production bridge. The final web app should read CHORDCAT input directly through Web MIDI where possible.

### 6.2 Observed validation results

- MIDI channel: 2 in one-based display (`channel: 1` in zero-based Mido data)
- Every intended key press produced one complete four- or five-note chord burst.
- The pre-reconnect capture produced three identical ordered rounds: 48 intended presses and sixteen unique absolute signatures.
- The reconnect capture contained 49 raw presses: one acknowledged accidental extra press in round one, followed by two perfect 16/16 rounds.
- All reconnect signatures were exactly two semitones above the pre-reconnect signatures.
- The ordering and chord voicings were otherwise identical across the two clean reconnect rounds.
- CC11 continues to stream independently and is ignored by the key recognizer.

CHORDCAT reports releases as `note_on` with velocity `0`, which must be interpreted as Note Off behavior.

### 6.3 Accidental gestures

The captures include both rapid duplicate touches and one acknowledged out-of-order press. A 180 ms identical-signature debounce window removes touch bounce while preserving normal deliberate presses. Calibration itself remains order-sensitive, and the facilitator console shows the next expected physical key.

### 6.4 Captured key signatures

Assuming the keys were pressed in 1→16 order, the mapping is:

| Cell | Sorted MIDI note signature |
|---:|---|
| 1 | `33,49,52,56,59` |
| 2 | `34,50,53,57,60` |
| 3 | `35,51,54,58,61` |
| 4 | `36,52,55,59,62` |
| 5 | `37,53,56,60,63` |
| 6 | `39,55,58,62,65` |
| 7 | `40,56,59,63,66` |
| 8 | `41,57,60,64,67` |
| 9 | `42,52,56,59,64` |
| 10 | `42,52,57,59,64` |
| 11 | `42,58,61,65,68` |
| 12 | `43,53,57,59,64` |
| 13 | `43,53,57,60,64` |
| 14 | `43,57,59,62,66` |
| 15 | `43,59,62,66,69` |
| 16 | `47,54,57,63` |

All sixteen signatures are unique in the captured configuration.

### 6.5 Important hardware caveat

These signatures are musical output from the currently loaded CHORDCAT project, key, scale, and chord set—not permanent hardware key IDs. The reconnect test proved that even without intentionally changing the bank, every signature can move by one shared transpose value.

The implemented demo strategy intentionally avoids guessing the active transpose or voicing. The facilitator runs one guided 1→16 calibration in reading order. The completed mapping is saved in browser `localStorage` and restored automatically on later page loads and CHORDCAT reconnects. If the active project, key, transpose, or chord set changes, the facilitator can run **Recalibrate 16 keys** to overwrite the saved profile.

Unknown runtime signatures never trigger the nearest cell. They are rejected with a recalibration message. A dedicated locked CHORDCAT demo project is still desirable, and any additional stable configuration discovered immediately before judging can be hardcoded as another verified profile.

---

## 7. MIDI Recognition Algorithm

Each physical press emits a burst of four or five Note On messages within approximately one millisecond. A single message is not always enough to identify a key because some keys share the same lowest note.

### 7.1 Required logic

```text
Receive positive-velocity Note On
        ↓
Open a 24 ms collection window
        ↓
Collect all positive notes from MIDI channel 2
        ↓
Remove duplicates and sort ascending
        ↓
Build signature, e.g. "33,49,52,56,59"
        ↓
Look up signature in the 16-cell map
        ↓
Reject if same signature fired within 180 ms
        ↓
Call selectCell(cellIndex, source="chordcat")
```

### 7.2 Release handling

Treat either of these as release:

- `note_off`
- `note_on` with velocity `0`

Release messages must never open a new recognition window.

### 7.3 Unknown signatures

Unknown or partial signatures should be logged in the facilitator console without triggering music. Do not guess the closest key during the demo. A false trigger is more damaging than ignoring one malformed gesture.

### 7.4 Web MIDI input responsibilities

The current web application now initializes Web MIDI for both output and input. The input bridge:

- enumerates `MIDIAccess.inputs`,
- prefers a port whose name contains `Chordcat`, `CHORDCAT`, `AlphaTheta`, or `Alpha Theta`,
- subscribes to `onmidimessage`,
- reconnects on MIDI state changes,
- exposes connection, calibration progress, transpose, recognized cell, and last-signature status,
- implements aggregation and debounce,
- provides quick and full calibration controls in the facilitator console,
- and forwards recognized cells to the same normalized artwork-coordinate path used by pointer input.

No Python or Node bridge should be required in the final local Chromium-based demo unless browser MIDI input proves unreliable.

---

## 8. Color-to-Melody Design

### 8.1 The naive mapping problem

Mapping one average RGB value to one melody is fragile. Paintings such as Gustav Klimt's *The Kiss* contain large repeated gold areas. Several grid cells may therefore have similar dominant colors even though their composition, figures, textures, and emotional roles differ.

If equal colors always produce equal melodies, several cells become redundant and the spatial exploration loses meaning.

### 8.2 Recommended musical grammar

Color should determine a **motif family**, not an entire fixed melody. Spatial position and secondary visual features determine the variation.

```text
Melodic function     = grid position / compositional role
Motif family         = curated dominant palette family
Register and octave  = luminance
Density and velocity = saturation / visual energy
Rhythmic complexity  = texture / edge density
Articulation         = warmth and local contrast
```

Repeated colors then become a feature: they create related leitmotifs that make the artwork sound coherent. Two gold cells can share interval DNA while one becomes an ostinato and the other becomes a lyrical answer.

### 8.3 Suggested cell color profile

Do not store only one average hex code. Each cell should contain:

- top three curated or extracted palette colors,
- palette weights,
- average luminance,
- average saturation,
- warmth/coolness,
- local contrast,
- edge or texture density,
- optional semantic tags,
- and a manually approved motif family.

### 8.4 Musical constraints

- All sixteen cell motifs must belong to the artwork's key and scale.
- Motifs should be one or two bars and loop cleanly.
- Important changes should be quantized to the next beat or bar.
- Background bass, harmony, drums, and atmosphere should not restart on every selection.
- Cell changes should alter a coherent arrangement rather than launch sixteen unrelated songs.
- Similar palette cells should use transformations: inversion, octave displacement, rhythmic variation, ornamentation, call/response, or density changes.
- The total mix must retain headroom when multiple layers overlap.

### 8.5 Example: The Kiss

| Grid area | Visual character | Possible musical role |
|---|---|---|
| Upper-left | Gold with black and white geometric blocks | Structured rhythmic ostinato |
| Upper-right | Gold, skin, faces, flowers | Warm primary legato motif |
| Lower-left | Green meadow with purple and blue marks | Light scattered arpeggio |
| Lower-right | Green/gold mixture, figure, floral detail | Counter-melody blending the human and meadow motifs |

The gold cells remain musically related without sounding identical.

---

## 9. Proposed Music Architecture

### 9.1 Separation of responsibilities

```text
CHORDCAT input keys
        ↓
Web MIDI recognition
        ↓
4×4 cell selection
        ↓
Artwork cell + color/motif data
        ↓
Quantized musical transition
        ↓
CHORDCAT sound engine
```

The browser remains responsible for orchestration, state, visuals, accessibility, and emergency control. CHORDCAT should produce the final musical timbres whenever hardware is connected.

### 9.2 Recommended track roles

One workable eight-track arrangement is:

| Track | Role |
|---:|---|
| 1 | Drums / rhythmic foundation |
| 2 | Silent sixteen-key controller; input only |
| 3 | Bass |
| 4 | Harmony / pad |
| 5 | Geometry pluck / ostinato |
| 6 | Human / legato lead |
| 7 | Nature / organic arpeggio |
| 8 | Atmosphere / shimmer |

The sixteen cells should normally select motif/pattern variations inside this shared arrangement, not consume sixteen simultaneous tracks.

### 9.3 Two possible CHORDCAT playback strategies

#### Strategy A — Browser-scheduled notes, CHORDCAT timbres

The browser owns the motif note sequences and sends quantized MIDI notes to the appropriate CHORDCAT channels. This provides predictable switching and makes the 4×4 mapping independent of undocumented pattern-selection messages.

#### Strategy B — Preloaded CHORDCAT patterns

Each cell maps to prepared CHORDCAT pattern material, and the browser requests pattern changes. This better uses the groovebox's native sequencing but requires validation of external live pattern selection and exact MIDI implementation.

Strategy A is the safer hackathon fallback. Strategy B may produce a more authentically hardware-native result if it can be verified quickly.

### 9.4 Browser sound

The Web Audio engine is a rehearsal and interaction fallback. Its oscillator-based arrangement demonstrates timing and mixing behavior but is not the target sound quality. When a MIDI output is present, browser synthesis is suppressed automatically so it cannot double the CHORDCAT audio. Tone.js keeps the motif clock, while timestamped Web MIDI messages perform T5–T8. The saved CHORDCAT project still needs intentionally selected presets, effects, and backing patterns.

---

## 10. Proposed Data Model

The next schema should preserve existing artwork metadata while adding explicit grid cells and input signatures.

```ts
type MidiChordSignature = string; // sorted notes, e.g. "37,54,59,63,68"

interface ColorProfile {
  palette: Array<{ hex: string; weight: number }>;
  luminance: number;      // 0..1
  saturation: number;     // 0..1
  warmth: number;         // -1..1
  contrast: number;       // 0..1
  textureDensity: number; // 0..1
}

interface MotifDefinition {
  family: string;
  variation: number;
  midiNotes: number[];
  rhythmSteps: number[];
  lengthInSteps: number;
  targetTrack: number;
  articulation: 'legato' | 'pulse' | 'staccato' | 'arpeggio' | 'drone';
}

interface ArtworkGridCell {
  index: number;          // 1..16
  row: number;            // 0..3
  column: number;         // 0..3
  midiSignature: MidiChordSignature;
  color: ColorProfile;
  motif: MotifDefinition;
  spokenLabel?: string;
  semanticTags?: string[];
}

interface GridArtworkDefinition {
  id: string;
  title: string;
  sourceImage: string;
  keyRoot: string;
  scale: string;
  tempo: number;
  moodDescription: string;
  cells: ArtworkGridCell[];
}
```

The signature mapping may belong to a separate locked-controller profile rather than being duplicated in every artwork.

---

## 11. Recommended Implementation Plan

### Phase 1 — 4×4 mouse prototype

1. Add a `GridArtworkDefinition` and sixteen generated cell rectangles.
2. Render a subtle 4×4 overlay instead of semantic center points.
3. Add a single `selectCell(index, source)` application action.
4. Make mouse click and keyboard simulation call that action.
5. Show selected cell, palette, motif family, and transition state in the facilitator console.
6. Keep existing artwork selection, start screen, narration, and panic behavior.

### Phase 2 — CHORDCAT MIDI input

1. Add input-port enumeration to the existing MIDI layer.
2. Implement the 10–15 ms chord-note aggregator.
3. Add the sixteen captured signatures as a locked demo controller profile.
4. Implement the 180 ms identical-signature debounce.
5. Handle velocity-zero Note On as release.
6. Show recognized and unknown signatures in the facilitator console.
7. Verify all sixteen keys five times each.

### Phase 3 — color profiles and motif mapping

1. Compute draft per-cell color statistics from the clean source image.
2. Cluster colors into a small artwork-specific palette.
3. Add luminance, saturation, contrast, warmth, and texture measures.
4. Manually curate the motif family and variation for each hero artwork cell.
5. Ensure repeated color families use related but distinct musical phrases.

### Phase 4 — musical content

1. Prepare high-quality CHORDCAT arrangements for three hero artworks.
2. Use distinct genre, sound palette, tempo, and motif vocabulary per artwork.
3. Keep global rhythm/harmony continuous during cell changes.
4. Quantize cell changes and add short crossfades or transitional fills.
5. Retain browser audio for development and emergency fallback.

Suggested hero artworks:

- *The Creation of Adam* — sacred cinematic, choir/pad, low strings, luminous arpeggio
- *The Scream* — dark electronic, unstable pulse, dissonant texture
- *The Kiss* — warm romantic groove, gold shimmer, floral arpeggios

### Phase 5 — demo hardening

1. Lock the CHORDCAT project and document its startup state.
2. Add a one-screen facilitator checklist.
3. Test USB disconnect/reconnect.
4. Test duplicate gestures and malformed signatures.
5. Verify panic stops browser sound and CHORDCAT output.
6. Rehearse the complete judge journey without developer tools.

---

## 12. Acceptance Criteria for the Next Prototype

- The artwork is visibly divided into sixteen correctly ordered cells.
- Mouse input can select all sixteen cells.
- CHORDCAT input can select all sixteen cells using the captured signatures.
- An accidental duplicate within 180 ms triggers only once.
- Unknown signatures do not select a cell.
- Selection feedback appears within perceptually immediate latency.
- Musical changes occur on a defined beat/bar boundary.
- Background music remains continuous.
- Similar-color cells sound related but not identical.
- Every cell stays inside the artwork's musical key and scale.
- The facilitator can see MIDI input, recognized cell, and last signature.
- Escape and Stop All perform a complete browser and MIDI panic.
- The prototype remains usable with CHORDCAT disconnected through mouse and browser audio.

---

## 13. Curated Artwork Catalogue

The repository currently contains nine artwork fixtures plus one abstract demo:

1. The Creation of Adam — Michelangelo
2. The Scream — Edvard Munch
3. The Kiss — Gustav Klimt
4. Wanderer above the Sea of Fog — Caspar David Friedrich
5. Woman with a Parasol — Claude Monet
6. The Raft of the Medusa — Théodore Géricault
7. The Arnolfini Portrait — Jan van Eyck
8. Landscape with Red Trees — Maurice de Vlaminck
9. Pond & Meadow Landscape
10. Geometric Sonic Canvas — development demo

Existing JSON fixtures contain semantic polygons, chord voicings, track numbers, roles, dynamics, narration, key, scale, tempo, and mood. Nine additional files under `src/artwork/grid-analyses/` contain 144 curated cell analyses. `src/artwork/gridMapping.ts` deterministically converts those analyses into scale-constrained mini-loops and routes their dominant families to T5–T8. These files are the reference schema and auditory test set for eventual vision-AI output.

For the hackathon, quality on three hero artworks is more important than shallow musical content across every available image.

---

## 14. Repository Map

```text
challenge-6-prototype/
├─ chordcat_script/
│  ├─ chordcat_midi_monitor_filtered.py
│  ├─ chordcat_capture.jsonl
│  └─ chordcat_16keys.jsonl
├─ public/artworks/                Local artwork images
├─ src/
│  ├─ artwork/
│  │  ├─ artworkTypes.ts         Current artwork/region/mix types
│  │  ├─ gridAnalysisTypes.ts    Curated visual-analysis schema
│  │  ├─ gridMapping.ts          Deterministic mini-loop generator
│  │  ├─ grid-analyses/          Nine artworks × sixteen cells
│  │  ├─ regionLookup.ts          Polygon hit testing and centroids
│  │  ├─ pixelAnalysis.ts         Clean source-image color metrics
│  │  └─ fixtures/                Curated artwork JSON files
│  ├─ audio/
│  │  ├─ ObjectSoundEngine.ts     Browser composition + MIDI output
│  │  └─ speechNarration.ts       Web Speech and narration state
│  ├─ components/
│  │  ├─ ArtworkCanvas.tsx        Artwork rendering and mouse sampling
│  │  └─ DebugPanel.tsx           Facilitator interface
│  ├─ interaction/
│  │  └─ regionStateMachine.ts    Dwell/hysteresis/cooldown lifecycle
│  ├─ App.tsx                     Application state and orchestration
│  └─ styles.css                  Museum UI and responsive layout
├─ README.md
└─ PROJECT_CONTEXT.md             This document
```

---

## 15. Local Development

From `challenge-6-prototype/`:

```bash
npm install
npm run dev
```

Production verification:

```bash
npm run build
```

The latest dual-mode prototype passed TypeScript checks and a Vite production build. It was manually verified in the browser for:

- both experience modes,
- artwork switching,
- natural image aspect ratios,
- stable stationary dwell,
- source-image color sampling,
- continuous stem mixing,
- start/stop behavior,
- and a clean browser console.

The 4×4 controller model is implemented in the UI. Mouse and calibrated CHORDCAT input share the same row-major cell mapping; all nine museum artworks have semantically scored grids.

---

## 16. Open Questions and Risks

### Must validate before the final demo

- Do the sixteen captured chord signatures stay constant after rebooting the locked CHORDCAT project?
- Do key, scale, chord-set, transpose, or project changes alter the signatures?
- Can the browser hold CHORDCAT MIDI input and output simultaneously without driver contention?
- Does CHORDCAT support the desired external live pattern switching, or should the browser schedule notes?
- Does CC11 control useful track expression on the chosen CHORDCAT configuration?
- Does CC74 affect the expected target parameter/channel?
- How should narration be requested without interrupting rapid musical exploration?

### Product risks

- A rigid grid may split meaningful painted subjects; narration and cell curation must compensate.
- Sixteen fully independent melodies will sound fragmented.
- Automatic average-color mapping will overrepresent large background colors.
- Hardware sound quality depends on actual CHORDCAT project preparation, not merely connecting the device.
- Music cannot independently communicate precise semantic content to a blind visitor.
- MIDI gesture bounce can cause duplicates without aggregation and debounce.

---

## 17. Non-Negotiable Design Rules

1. Do not restore camera or head tracking unless the product direction explicitly changes again.
2. Do not describe music as a literal or objective translation of color.
3. Do not use raw average RGB as the only melody decision.
4. Do not make all sixteen cells unrelated compositions.
5. Do not expose CHORDCAT complexity in the visitor-facing UI.
6. Do not assume current chord signatures are universal hardware IDs.
7. Do not let malformed MIDI trigger an arbitrary nearest cell.
8. Do not allow narration or MIDI notes to accumulate without cancellation/release.
9. Keep an always-available panic action.
10. Optimize the final judge experience for musical quality, clarity, and reliability rather than feature count.

---

## 18. Immediate Next Action

Curate real color profiles and motif families for the sixteen cells of the hero artwork, then replace the current nearest-theme voicing variations with intentional CHORDCAT-ready melodic material. Keep the shared mouse/CHORDCAT cell addressing and retain Full Composition as the second comparison mode.
