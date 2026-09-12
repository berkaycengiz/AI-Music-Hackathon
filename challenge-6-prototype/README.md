# Challenge 6 — Museum Sonic Explorer

An accessible tactile-music installation prototype for Challenge 6. A visitor explores a relief reproduction of a painting and performs its musical interpretation through position, dwell, and movement. The screen uses the mouse as a temporary fingertip simulator; the installation target is the tactile surface plus CHORDCAT.

## Two experiences to compare

### Region Chords

The current region performs its own curated chord or motif. This version makes cause and effect explicit and is useful for testing whether visitors understand the spatial interaction.

### Full Composition

Each artwork has one continuous, deterministic score. Every semantic region owns a musical center and stem. Proximity continuously blends all stems between their role-specific 10–18% minimum and full focus, while the complete composition keeps playing. Position never becomes a literal object sound effect.

Both modes share the same artwork data, region geometry, narration, color-driven timbre, dwell protection, and facilitator controls, so the comparison tests the musical model rather than a different interface.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL, choose an artwork and experience, then select **Begin exploration**. Move the mouse across the painting and pause over a highlighted region. Press Escape or use **Stop all sound** for an immediate audio and MIDI panic.

## Prototype interaction

- Curated polygons remain invisible semantic maps for narration; only their musical center points appear on the artwork.
- A 140 ms dwell prevents accidental boundary triggers without requiring continued pointer movement.
- Overlap priority and hysteresis keep region changes stable.
- Text-to-speech names and describes the region; narration briefly ducks the score.
- Brightness and warmth sampled from the clean source image continuously shape filter and expression.
- The facilitator console exposes lifecycle, dwell, active region, sampled color, live stem levels, MIDI routing, and test controls.

## CHORDCAT architecture

CHORDCAT is the eventual sound engine **and** physical controller, not the user-facing product. In the installation, its tracks hold the curated artwork arrangement while the web layer maps tactile position to musical focus. The current bridge sends note messages in Region Chords mode and a prototype CC11 expression map in Full Composition mode. Track-level expression must be validated on the physical unit before the demo mapping is frozen.

Browser audio is a deterministic rehearsal fallback so the complete interaction can be developed without hardware. It does not claim to reproduce CHORDCAT's internal sound library.

## Project structure

- `src/artwork/` — artwork catalogue, semantic regions, polygons, score metadata
- `src/interaction/` — region lookup and dwell/hysteresis state machine
- `src/audio/` — continuous score, region voicing, MIDI output, narration
- `src/components/ArtworkCanvas.tsx` — natural-ratio image rendering and clean pixel sampling
- `src/components/DebugPanel.tsx` — facilitator and hardware bridge console

## Product boundary

Music communicates atmosphere, emphasis, contrast, and relationships; it does not replace semantic description. Meaning comes from the tactile relief and concise narration. This is a hackathon prototype, not disability-user validation, and the final interaction should be co-designed and tested with blind and low-vision visitors.
