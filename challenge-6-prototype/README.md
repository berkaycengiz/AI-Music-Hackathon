# OneMotion — Challenge 6 feasibility prototype

OneMotion is a browser-based musical instrument that maps a person's comfortable left/right head movement to four compatible chords. Camera frames stay in the browser and are never recorded or uploaded.

## Run

```bash
pnpm install
pnpm dev
```

Open the local URL in current desktop Chrome, choose **Start instrument**, and allow camera access. The same click unlocks browser audio. Follow the short neutral, left, and right calibration prompts.

After calibration:

- turn left or right once to move chord focus;
- return to a neutral resting position;
- hold neutral until the focused chord fills and plays;
- select four chords, then choose **Play loop**.

Keyboard fallback: Left/Right Arrow moves focus, Enter or Space selects, and Escape stops playback.

## Implemented now

- MediaPipe Face Landmarker with local frame processing and no recording
- personal neutral/left/right calibration using robust median samples
- smoothed head-direction classification with hysteresis
- one gesture per neutral-to-turn cycle, preventing rapid repeated navigation
- adjustable sensitivity, dwell time, and tempo
- Tone.js chord preview and looping four-chord progression
- tracking-loss recovery and complete keyboard fallback

## Future work

This is an early feasibility prototype, not a medical device. It still requires co-design and testing with disabled musicians. Dwell-only scanning, more movement inputs, switch access, and adaptable layouts are future directions rather than validated capabilities.
