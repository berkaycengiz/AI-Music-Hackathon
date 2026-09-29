# Museum Sonic Explorer

A painting becomes a sixteen-cell musical surface. This prototype keeps artwork data, CHORDCAT input calibration, and MIDI sequencing in the browser. The visitor sees a simple gallery view inspired by the Synesthesias pitch design; artwork selection, calibration, routing, and diagnostics live in the facilitator console. There is no backend service.

## Run locally

```bash
npm install
npm run dev
```

Open the Vite URL in Chrome or Edge. Select **Facilitator setup** to choose an artwork or inspect hardware controls. **Begin exploration** requests MIDI access. The mouse simulates the same sixteen artwork cells during development.

## CHORDCAT sound check

Use this sequence before evaluating the artwork interaction:

1. Connect CHORDCAT over USB and plug headphones or speakers into CHORDCAT's audio output.
2. Set Track 6 to receive USB MIDI Channel 6 and choose an audible instrument preset on that track.
3. In Chrome or Edge, open the app over HTTPS (or localhost), select **Begin exploration**, and allow MIDI access.
4. Open **Facilitator setup**. Select the CHORDCAT MIDI output (previously seen as `Chordcat 1`).
5. Press **Send C4 to Track 6**. It sends MIDI Note On for middle C on Channel 6, then Note Off one second later.
6. Confirm that the note is heard from CHORDCAT's audio output. Only then test the 4×4 melodies and the sixteen-key calibration.

The browser's synthesized output is muted (`MASTER_LEVEL = 0`), so the app is silent without a working CHORDCAT sound route. Selecting a MIDI output means the port is available; it does **not** prove that CHORDCAT received the note or played audio. This final hardware path has not yet been verified.

## Calibrate the physical grid

CHORDCAT's sixteen inputs correspond to artwork cells in row-major order: 1–4 on the top row, 13–16 on the bottom row. In the facilitator console, run full calibration and press each physical input when prompted. The browser groups incoming Channel 2 chord notes into one signature per press, then saves the sixteen signatures in local storage. Recalibrate after changing the CHORDCAT project, transpose, or chord set. Unknown signatures do not select a cell.

## Experiences

- **4×4 Melodies** is the default. Each cell is a variation within one artwork score. Nine paintings have offline-generated visual measurements for all sixteen cells, combined with curated semantic descriptions.
- **Full Composition** is an experimental comparison mode. Moving toward musical centers changes a browser score, but this mode does not send playable MIDI notes. With browser audio muted, it remains silent and is not part of the CHORDCAT demo.

Narration is optional and off by default. Press Escape or use **Stop all sound** in the facilitator console to stop playback and send MIDI panic messages.

## Deploy for the CHORDCAT test

This is a static Vite app. For Vercel, set the project root to `challenge-6-prototype`, build command to `npm run build`, and output directory to `dist`. Use the resulting HTTPS URL in Chrome or Edge on the computer connected to CHORDCAT. The MIDI permission, port selection, saved calibration, and audio check happen on that computer, not on the deployment server.

## Project structure

- `src/artwork/` — artwork catalogue, 4×4 mapping, semantic regions, and generated measurements
- `src/interaction/` — region lookup and dwell state machine
- `src/audio/` — MIDI output, CHORDCAT input calibration, sound timing, and narration
- `src/components/ArtworkCanvas.tsx` — artwork rendering and mouse simulation
- `src/components/DebugPanel.tsx` — facilitator diagnostics and hardware controls

Music conveys atmosphere, movement, contrast, and relationships; the tactile layout and concise narration provide spatial and semantic meaning. This remains a hackathon prototype. An accessible museum product would need co-design and testing with blind and low-vision visitors.
