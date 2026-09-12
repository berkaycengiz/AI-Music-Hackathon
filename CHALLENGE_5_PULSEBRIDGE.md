# PulseBridge - Challenge 5 Feasibility Prototype

## Purpose

Build a small browser prototype proving that a performer's body movement can directly shape music and simple graphics in real time.

This is a technical feasibility spike, not a production application. The goal is one reliable live interaction loop:

> Webcam movement -> movement energy -> musical layers and visual energy

Do not build a song recommendation system. Do not use TouchDesigner, a backend, authentication, a database, Spotify, or external music APIs.

## Challenge Fit

Challenge 5 asks how a live performer's body movement can create sound and graphics in real time. PulseBridge treats a dancer - and eventually a dancefloor - as a musical performer.

The product story comes from a real conversation with a local bar owner in Uttendorf: a poorly timed musical change can break the dancefloor's energy. The prototype explores whether movement can shape a live musical transition instead of relying on a fixed transition.

Important claim boundary:

- The bar owner validated the problem, not this solution.
- For the hackathon demo, track one performer reliably.
- Present multi-person dancefloor tracking as future work.

## Success Criterion

When a person moves slowly, the music and visuals feel calm. When the same person moves more intensely, percussion, bass, brightness, and visual activity increase smoothly and audibly.

The demo must work locally in Chrome without a backend.

## Required Stack

- React
- TypeScript
- Vite
- `@mediapipe/tasks-vision`
- `tone`
- Browser webcam APIs
- CSS or Canvas for simple visuals

## Setup

Create a React TypeScript Vite application and install only the required packages.

```bash
npm create vite@latest pulsebridge -- --template react-ts
cd pulsebridge
npm install
npm install @mediapipe/tasks-vision tone
npm run dev
```

Use the current APIs exposed by the installed package versions. Do not silently substitute a different computer-vision or audio framework.

## Non-Goals

- No song catalog or recommendation algorithm
- No crowd emotion recognition
- No face recognition or identity tracking
- No video recording or frame upload
- No multi-person tracking in the MVP
- No generative AI or LLM integration
- No polished account/settings flow
- No deployment requirement

## User Flow

1. User opens the page and sees a short explanation.
2. User grants camera permission.
3. User presses **Start Experience**. This explicit click must also unlock browser audio.
4. App performs two calibration phases:
   - 2 seconds standing relatively still
   - 4 seconds moving comfortably
5. App enters performance mode.
6. Movement changes the music and visuals continuously.
7. User can stop and recalibrate at any time.

## Screen Layout

Use one responsive screen:

- Header: `PulseBridge`
- Subtitle: `Your movement shapes the transition.`
- Left side: mirrored webcam preview with an optional lightweight skeleton overlay
- Right side:
  - large energy meter from 0 to 100
  - state label: `CALM`, `GROOVING`, or `PEAK`
  - four music-layer indicators: Pad, Bass, Drums, Lead
- Background: simple pulse/gradient/particle effect driven by movement energy
- Controls: Start, Stop, Recalibrate, Camera toggle

Keep controls readable and avoid flashing effects.

## Architecture

```text
Webcam video
  -> MediaPipe Pose Landmarker
  -> landmark velocity calculation
  -> normalization using personal calibration
  -> exponential smoothing
  -> movementEnergy in [0, 1]
  -> Tone.js layer mixer
  -> CSS/Canvas visual parameters
```

Suggested source structure:

```text
src/
  components/
    CameraPanel.tsx
    EnergyMeter.tsx
    LayerStatus.tsx
    ReactiveVisual.tsx
  hooks/
    usePoseTracking.ts
    useCalibration.ts
    useMovementEnergy.ts
    useMusicEngine.ts
  lib/
    mediapipe.ts
    movement.ts
    music.ts
  types/
    performance.ts
  App.tsx
  styles.css
```

## Pose Tracking

Configure MediaPipe Pose Landmarker for:

- video mode
- one pose
- a reasonable confidence threshold
- approximately 12-20 inference updates per second

Do not run inference more frequently than necessary. Keep the UI render loop separate from the inference loop.

Only retain current and previous landmark coordinates in memory. Never save or upload camera frames.

## Movement-Energy Algorithm

Use visible upper- and lower-body landmarks such as shoulders, wrists, hips, knees, and ankles.

For each tracked landmark:

```text
velocity = normalized_distance(currentPosition, previousPosition) / deltaTime
```

Then:

1. Ignore landmarks below the visibility threshold.
2. Calculate a robust aggregate such as the median or trimmed mean of valid velocities.
3. Use calibration values to normalize the result:

```text
rawEnergy = clamp((velocity - restBaseline) / (activeReference - restBaseline), 0, 1)
```

4. Smooth the signal using an exponential moving average:

```text
smoothed = alpha * rawEnergy + (1 - alpha) * previousSmoothed
```

Start with `alpha` around `0.15-0.25`, but keep it as a named constant so it can be tuned during the demo.

5. Add a small dead zone near zero to prevent jitter.

If tracking is lost briefly, hold the last value for a short grace period and then fade energy toward zero. Never stop audio abruptly.

## Music Engine

Generate all music in code with Tone.js so the prototype requires no copyrighted assets.

Use a fixed, musically coherent loop at approximately 110-120 BPM with four layers:

1. **Pad:** always present at low volume
2. **Bass:** fades in after low movement
3. **Drums:** fades in during medium movement
4. **Lead/Arpeggio:** fades in near peak movement

Suggested mapping:

```text
energy 0.00-0.20 -> Pad only
energy 0.20-0.45 -> Add Bass
energy 0.45-0.75 -> Add Drums
energy 0.75-1.00 -> Add Lead and brighter effects
```

Do not hard-switch layer volume. Use short gain ramps/crossfades to avoid clicks and make the result feel musical.

Optional mappings if the core works:

- energy -> low-pass filter cutoff
- horizontal body position -> stereo pan
- both hands raised -> trigger a one-shot musical accent, with a cooldown

Do not implement optional gestures until continuous movement-to-layer mapping is reliable.

## Visual Mapping

Create a simple visualization in React/CSS or Canvas:

- energy -> pulse scale
- energy -> saturation/brightness
- energy -> particle count or movement speed
- detected body horizontal position -> gradient center

The visual output must react smoothly to the same normalized energy used by the music engine.

## State Model

Use explicit application states:

```text
IDLE
REQUESTING_CAMERA
CALIBRATING_REST
CALIBRATING_ACTIVE
READY
PERFORMING
TRACKING_LOST
ERROR
```

Display clear user feedback for each state.

## Privacy and Safety

- Show `Video is processed locally and is not recorded.` near the camera preview.
- Do not perform face identification, emotion recognition, demographic inference, or audience profiling.
- Provide Stop Camera and Recalibrate controls.
- Do not use rapid flashing visuals.

## Implementation Order

Stop after each stage and verify it before continuing:

1. Camera preview and permission/error states
2. Pose landmarks visible in the preview
3. Stable raw movement value printed on screen
4. Rest/active calibration and normalized energy
5. Tone.js audio unlocked by explicit user click
6. Energy controlling the volume of two layers
7. Expand to four layers
8. Add simple reactive visuals
9. Add graceful tracking-loss behavior
10. Polish labels and demo instructions

## Acceptance Criteria

- [ ] Runs with `npm install && npm run dev`
- [ ] Works in current desktop Chrome
- [ ] Requests webcam permission only after a clear user action
- [ ] Starts audio only after a clear user action
- [ ] Tracks one full-body performer
- [ ] Produces a stable `movementEnergy` value from 0 to 1
- [ ] Personal rest/active calibration affects sensitivity
- [ ] At least three musical layers respond clearly to movement
- [ ] Layer changes use smooth gain ramps
- [ ] A simple visual reacts to the same movement value
- [ ] Losing tracking does not crash the app or stop audio abruptly
- [ ] No frames leave the browser and no video is recorded
- [ ] UI contains a one-sentence explanation for judges

## Manual Test Plan

1. Start while standing still; energy should remain low.
2. Move arms slowly; bass should appear gradually.
3. Dance more intensely; drums and lead should become obvious.
4. Stop moving; layers should fade out rather than switch off.
5. Step outside the camera frame; tracking-loss state should appear.
6. Re-enter the frame; performance should recover.
7. Recalibrate with a smaller range of motion; the system should become more sensitive.

## 30-Second Demo Script

> A local bar owner told us that one badly timed musical change can break the energy of the dancefloor. PulseBridge asks a different question: what if the performer and the dancefloor could shape the transition themselves? The webcam converts movement into a normalized energy signal. As movement grows, the music gains rhythm, bass, brightness, and visual intensity in real time.

## Deliverables

- Working local React prototype
- Short README with run instructions
- One screenshot or short screen recording
- A short note listing what is real in the prototype and what is future work

## Final Instruction to Codex

Implement the smallest reliable vertical slice first. Do not expand scope before the acceptance criteria for camera -> movement energy -> at least two audible layers are satisfied. Keep all processing local and keep the code readable enough for a hackathon team to modify quickly.

