# Challenge 6 — Hands-free live arranger

A local browser prototype for performing a complete arrangement without playing individual notes. After one helper click, a participant can move through musical sections and continuously shape the performance with their available head movement.

## Run

```bash
pnpm install
pnpm dev
```

Open the local URL in current Chrome or Edge, choose **Enable camera & begin**, allow camera access, and follow the center/right/left/up/down calibration prompts.

## Participant interaction

- A layered arrangement with drums, bass, harmony, and melody begins after setup.
- Turn right to advance through Intro, Groove, Build, Drop, Break, and Finale; turn left to return.
- Vertical head position continuously shapes energy, filtering, dynamics, and active instrument layers.
- Double blink to open or close the hands-free control menu.
- In the menu, turn left/right to choose, look down to select, or look up to go back.
- Pause/resume, a fresh arrangement, and ending the session live in the head-controlled menu.

## Facilitator controls

Open the collapsed **Helper setup** panel to tune sensitivity, gesture hold, cooldown, and tempo; select a Web MIDI output and channel; test configured mappings; or simulate every direction. The four arrow keys mirror head movement and Escape stops all sound.

## What is real

- MediaPipe face tracking derives horizontal yaw and vertical pitch locally; frames are neither recorded nor uploaded.
- Personal four-direction calibration, smoothing, dominant-axis selection, gesture hold, return-to-center confirmation, face-loss recovery, and cooldown prevent repeated frame-level triggers.
- A section-based arrangement engine performs distinct drum patterns, bass behavior, pad harmony, and melodic motifs for each part of the performance.
- The participant controls musical form and expression without being asked to select chords or notes.
- Accepted actions are quantized to the next beat.
- Web MIDI targets Chordcat when available; Tone.js remains the software-audio fallback.
- Section changes are quantized and keep the music flowing while the performance state changes.

## Boundaries

This is an early feasibility prototype, not a medical device or disability-user validation. Webcam performance varies with lighting, posture, glasses, and movement pattern. The interaction requires future co-design and testing with people who use alternative access methods. Blink remains future work until the four-direction head path is reliable.
