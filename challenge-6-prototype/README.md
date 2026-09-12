# Challenge 6 — Accessible music prototype

A local browser prototype that adapts to a participant's comfortable four-direction head movement. After one helper click for browser permissions, the participant can shape music, pause, resume, start over, and end the session without using their hands. Music theory and hardware controls stay outside the participant experience.

## Run

```bash
pnpm install
pnpm dev
```

Open the local URL in current Chrome or Edge, choose **Enable camera & begin**, allow camera access, and follow the center/right/left/up/down calibration prompts.

## Participant interaction

- A layered arrangement with drums, bass, harmony, and melody begins after setup.
- Turn right to explore a new harmonic path or left to bring it home.
- Look up briefly to build the arrangement; look down briefly to strip layers back.
- Hold up, then return to center, to open the hands-free control menu.
- In the menu, turn left/right to choose, look down to select, or look up to go back.
- Pause/resume, a fresh arrangement, and ending the session live in the head-controlled menu.

## Facilitator controls

Open the collapsed **Helper setup** panel to tune sensitivity, gesture hold, cooldown, and tempo; select a Web MIDI output and channel; test configured mappings; or simulate every direction. The four arrow keys mirror head movement and Escape stops all sound.

## What is real

- MediaPipe face tracking derives horizontal yaw and vertical pitch locally; frames are neither recorded nor uploaded.
- Personal four-direction calibration, smoothing, dominant-axis selection, gesture hold, return-to-center confirmation, face-loss recovery, and cooldown prevent repeated frame-level triggers.
- A deterministic context-aware harmony layer keeps every action compatible without exposing chords or notes.
- A four-part arrangement engine continuously performs drums, bass, pad harmony, and a melodic motif; vertical movement changes the actual layer density and timbre.
- Accepted actions are quantized to the next beat.
- Web MIDI targets Chordcat when available; Tone.js remains the software-audio fallback.
- A complete starting arrangement plays immediately and horizontal movement rewrites upcoming sections without stopping the flow.

## Boundaries

This is an early feasibility prototype, not a medical device or disability-user validation. Webcam performance varies with lighting, posture, glasses, and movement pattern. The interaction requires future co-design and testing with people who use alternative access methods. Blink remains future work until the four-direction head path is reliable.
