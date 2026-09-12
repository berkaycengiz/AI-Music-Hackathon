# Challenge 5 feasibility prototype

This local browser prototype turns one performer's movement into a normalized energy signal, generated music layers, and responsive graphics. The interface intentionally has no product name.

## Run

```bash
pnpm install
pnpm dev
```

Open the local URL in current desktop Chrome. Press **Start experience**, allow camera access, stand still for two seconds, then move comfortably for four seconds.

## Real in the prototype

- MediaPipe tracks one pose locally; video is never recorded or uploaded.
- Landmark velocity and personal calibration produce a smoothed energy signal.
- Tone.js generates pad, bass, drums, and lead; their gains ramp smoothly.
- The same energy signal drives the meter, layer indicators, and background motion.
- Tracking loss holds briefly and then fades gracefully.

## Future work

Multi-person tracking, venue testing, and richer performer gestures are intentionally outside this feasibility prototype.
