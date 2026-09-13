# Challenge 6 — Museum Sonic Explorer

An accessible tactile-music installation prototype for Challenge 6. A visitor explores a relief reproduction of a painting and performs its musical interpretation through position, dwell, and movement. The screen uses the mouse as a temporary fingertip simulator; the installation target is the tactile surface plus CHORDCAT.

## Two experiences to compare

### 4×4 Melodies (default)

The artwork is divided into sixteen numbered cells matching CHORDCAT's sixteen calibrated keys. **The Kiss** is the first fully curator-authored example: every cell has a visual meaning, one of four motif families (atmosphere, geometry, human, nature), and its own quantized melody. Other artworks temporarily fall back to spatial variations of their closest curated theme. Mouse input and CHORDCAT input share the same cell order.

### Full Composition

Each artwork has one continuous, deterministic score. Every semantic region owns a musical center and stem. Proximity continuously blends all stems between their role-specific 10–18% minimum and full focus, while the complete composition keeps playing. Position never becomes a literal object sound effect.

Both modes share the same artwork data, narration, color-driven timbre, dwell protection, and facilitator controls. The default mode uses a fixed 4×4 grid; Full Composition preserves continuous center-distance mixing.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL, choose an artwork and experience, then select **Begin exploration**. In 4×4 Melodies, move across the numbered cells or use the corresponding calibrated CHORDCAT keys. Press Escape or use **Stop all sound** for an immediate audio and MIDI panic.

## Prototype interaction

- 4×4 Melodies displays sixteen numbered cells and clearly highlights the selected cell.
- The Kiss exposes its visual-to-musical reasoning live in the facilitator panel.
- Full Composition displays the original musical centers and smooth stem mixing without grid lines.
- A 140 ms dwell prevents accidental boundary triggers without requiring continued pointer movement.
- Overlap priority and hysteresis keep region changes stable.
- Text-to-speech names and describes the region; narration briefly ducks the score.
- Brightness and warmth sampled from the clean source image continuously shape filter and expression.
- The facilitator console exposes lifecycle, dwell, active region, sampled color, live stem levels, MIDI routing, and test controls.

## CHORDCAT architecture

CHORDCAT is the eventual sound engine **and** physical controller, not the user-facing product. In the installation, its tracks hold the curated artwork arrangement while the web layer maps the sixteen physical keys to artwork cells. The current bridge sends note messages in 4×4 Melodies and a prototype CC11 expression map in Full Composition. Track-level expression must be validated on the physical unit before the demo mapping is frozen.

Browser audio is a deterministic rehearsal fallback so the complete interaction can be developed without hardware. It does not claim to reproduce CHORDCAT's internal sound library.

## Project structure

- `src/artwork/` — artwork catalogue, 4×4 mapping, semantic regions, polygons, score metadata
- `src/interaction/` — region lookup and dwell/hysteresis state machine
- `src/audio/` — continuous score, region voicing, MIDI output, narration
- `src/components/ArtworkCanvas.tsx` — natural-ratio image rendering and clean pixel sampling
- `src/components/DebugPanel.tsx` — facilitator and hardware bridge console

## Product boundary

Music communicates atmosphere, emphasis, contrast, and relationships; it does not replace semantic description. Meaning comes from the tactile relief and concise narration. This is a hackathon prototype, not disability-user validation, and the final interaction should be co-designed and tested with blind and low-vision visitors.
