# OneMotion - Challenge 6 Feasibility Prototype

## Purpose

Build a small browser-based accessible musical instrument that can be controlled without hands. The prototype should prove one reliable interaction loop:

> Webcam -> personalized head movement -> chord selection -> musical output

This is a feasibility prototype, not a medical device and not a claim that one interface works for every disability.

The long-term idea is an adaptive instrument that asks, `What can you move?`, then maps a person's comfortable intentional movement to musical expression.

## Challenge Fit

Challenge 6 asks how AI, interfaces, sensors, voice, or gesture can make music creation and performance more accessible for people with disabilities, beginners, and older adults.

OneMotion uses computer vision and personal calibration to lower the physical and musical barriers to creating a short chord progression.

Jason Becker's eye-movement communication system can be mentioned as inspiration, but do not claim that this prototype was designed for him or validated by him.

## Success Criterion

A user can calibrate the interface, move between four chord choices using small left/right head movements, select a chord using dwell time, hear it, and build a four-chord progression without using their hands after the initial Start button.

The demo must work locally in Chrome without a backend.

## Required Stack

- React
- TypeScript
- Vite
- `@mediapipe/tasks-vision`
- `tone`
- Browser webcam APIs
- Accessible HTML and CSS

## Setup

```bash
npm create vite@latest onemotion -- --template react-ts
cd onemotion
npm install
npm install @mediapipe/tasks-vision tone
npm run dev
```

Use the current APIs exposed by the installed package versions. Do not silently substitute another tracking or audio framework.

## Non-Goals

- No medical diagnosis or therapeutic claims
- No claim of supporting every motor disability
- No full eye-gaze cursor in the MVP
- No facial identity or emotion recognition
- No camera recording or frame upload
- No backend, account, database, or cloud service
- No MIDI export in the MVP
- No generative AI or LLM integration
- No complex DAW or piano-roll interface

## MVP User Flow

1. User opens the page and reads a one-sentence explanation.
2. User grants camera permission.
3. User presses **Start Instrument**. This click also unlocks browser audio.
4. App guides the user through calibration:
   - look forward in a comfortable neutral position
   - turn slightly left
   - turn slightly right
5. App enters instrument mode.
6. Small left/right head movements change the focused chord.
7. Holding a chord in focus for an adjustable dwell period selects and plays it.
8. Selected chords are added to a visible progression.
9. After four selections, the user can play the progression as a loop.
10. User can clear, stop, or recalibrate using accessible controls.

Hands may be used for setup controls during development, but the core musical interaction must work hands-free.

## Instrument Screen

Display four large chord cards:

```text
[ C Major ] [ A Minor ] [ F Major ] [ G Major ]
```

Include:

- mirrored webcam preview
- head-direction indicator: Left, Neutral, Right
- four large chord cards
- a visible dwell progress ring/bar on the focused card
- current progression, for example `C -> Am -> F -> G`
- Play Loop, Stop, Clear, Recalibrate controls
- sensitivity and dwell-time controls
- high-contrast status feedback

Do not make essential state depend on color alone.

## Architecture

```text
Webcam video
  -> MediaPipe Face Landmarker
  -> head orientation estimate
  -> personal calibration thresholds
  -> smoothing and intentional-gesture state machine
  -> focus-left / focus-right / neutral events
  -> dwell selection
  -> Tone.js chord engine
  -> progression state and accessible visual feedback
```

Suggested source structure:

```text
src/
  components/
    CameraPanel.tsx
    CalibrationWizard.tsx
    ChordGrid.tsx
    DwellIndicator.tsx
    Progression.tsx
    AccessibilitySettings.tsx
  hooks/
    useFaceTracking.ts
    useHeadCalibration.ts
    useHeadNavigation.ts
    useChordEngine.ts
  lib/
    mediapipe.ts
    headPose.ts
    chords.ts
  types/
    instrument.ts
  App.tsx
  styles.css
```

## Face and Head Tracking

Configure MediaPipe Face Landmarker for video mode and one face.

Estimate horizontal head orientation using either:

- the facial transformation matrix exposed by Face Landmarker, or
- stable normalized facial landmarks relative to the calibrated neutral pose

Do not use absolute universal angles as the only control. Store personal neutral, left-reference, and right-reference values during calibration.

Process at a moderate rate such as 12-20 inference updates per second. Smooth the orientation signal before classification.

Suggested classification logic:

```text
if smoothedYaw < calibratedLeftThreshold  -> LEFT
if smoothedYaw > calibratedRightThreshold -> RIGHT
otherwise                                 -> NEUTRAL
```

Depending on the coordinate convention returned by the implementation, left/right comparisons may be reversed. Verify behavior with the mirrored preview and keep the conversion in one well-named function.

Add hysteresis so the direction does not oscillate at a threshold. Add a short cooldown before repeated navigation.

## Navigation Design

Use relative navigation, not a continuous head-controlled cursor:

- One intentional left gesture moves focus one card left.
- One intentional right gesture moves focus one card right.
- Returning to neutral re-arms the next gesture.
- Holding focus while neutral completes dwell selection.

This avoids requiring the user to hold their head turned for a long time.

Default dwell time can start around 900-1200 ms but must be adjustable. Do not treat this as a medically validated default.

Provide keyboard equivalents during development and for accessibility fallback:

- Left Arrow: previous chord
- Right Arrow: next chord
- Enter or Space: select chord
- Escape: stop audio

## Music Engine

Use Tone.js and a polyphonic synth to play these chords:

```text
C Major: C4 E4 G4
A Minor: A3 C4 E4
F Major: F3 A3 C4
G Major: G3 B3 D4
```

Requirements:

- Use a pleasant attack/release envelope.
- Fade notes cleanly and avoid audio clicks.
- Keep the harmonic palette intentionally compatible so beginners can create something musical.
- When four chords have been selected, allow playback as a loop using Tone.Transport.
- Make BPM adjustable within a safe musical range.

Optional only after the core works:

- add a simple drum pattern
- choose between two instrument timbres
- add deliberate long-blink confirmation using Face Landmarker blendshapes
- recommend a compatible next chord

Do not make blink detection required for the MVP. Natural blinks and tracking noise can make it unreliable.

## Calibration

Implement a short, guided calibration wizard:

1. **Neutral:** collect orientation samples for approximately 2 seconds.
2. **Comfortable left:** collect samples without asking for maximum movement.
3. **Comfortable right:** collect samples without asking for maximum movement.
4. Calculate robust averages/medians and derive thresholds between neutral and each reference.
5. Preview the detected states and let the user adjust sensitivity.

If the calibrated left/right range is too small for reliable classification, explain that tracking is uncertain and offer:

- higher sensitivity
- dwell-only scanning mode as future/fallback behavior
- keyboard controls for development and demo recovery

Do not instruct the user to force or maximize neck movement.

## State Model

```text
IDLE
REQUESTING_CAMERA
CALIBRATING_NEUTRAL
CALIBRATING_LEFT
CALIBRATING_RIGHT
CALIBRATION_REVIEW
READY
PLAYING
TRACKING_LOST
ERROR
```

Display clear text feedback for every state.

## Accessibility Requirements

- Use semantic buttons and headings.
- Add clear accessible names to all controls.
- Maintain keyboard operation for every action.
- Use large controls and high contrast.
- Do not rely only on color.
- Avoid flashing animation.
- Allow sensitivity and dwell duration to be adjusted.
- Do not require sustained neck rotation.
- Provide a neutral rest position.
- Allow recalibration at any time.
- Display `Video is processed locally and is not recorded.`

## Privacy and Ethical Boundaries

- Do not save or upload camera frames.
- Do not identify users or infer emotions, diagnoses, age, gender, or ethnicity.
- Describe the app as an early prototype requiring co-design and testing with disabled musicians.
- Do not simulate a disability or claim that an able-bodied demo proves usability for disabled users.
- Describe Jason Becker only as inspiration for the broader design question.

## Implementation Order

Verify each step before moving to the next:

1. Camera preview and permission/error states
2. Face landmarks detected reliably
3. Raw head orientation displayed as a debug value
4. Neutral/left/right calibration
5. Stable Left/Neutral/Right classification with hysteresis
6. Head gestures moving focus between four cards
7. Dwell selection working without hands
8. Tone.js unlocked by Start button and playing one chord
9. Four selected chords stored as a progression
10. Progression playback loop
11. Accessibility settings and tracking-loss recovery
12. Final explanatory copy and visual polish

## Acceptance Criteria

- [ ] Runs with `npm install && npm run dev`
- [ ] Works in current desktop Chrome
- [ ] Requests webcam permission only after clear user action
- [ ] Unlocks audio only after clear user action
- [ ] Completes personal neutral/left/right calibration
- [ ] Detects Left/Neutral/Right without rapid threshold flicker
- [ ] Returning to neutral is required before another navigation event
- [ ] Head gestures move focus through four chord cards
- [ ] Adjustable dwell selection plays the focused chord
- [ ] User can create and replay a four-chord progression
- [ ] Keyboard fallback works for the full flow
- [ ] Tracking loss produces a clear status and does not crash
- [ ] No frames leave the browser and no video is recorded
- [ ] UI explains that this is a prototype requiring user co-design

## Manual Test Plan

1. Calibrate with small comfortable head movements.
2. Confirm neutral position does not move focus.
3. Turn left once; focus should move exactly one card.
4. Remain turned; focus should not repeatedly move.
5. Return to neutral and turn again; focus should move once more.
6. Hold the selected card in focus; dwell should play one chord.
7. Build four chords and play the loop.
8. Adjust sensitivity and confirm thresholds change.
9. Step out of frame and return; the app should recover.
10. Complete the same flow with keyboard controls.

## 30-Second Demo Script

> Traditional instruments often assume precise hand and finger control. OneMotion asks a different question: what movement can this person comfortably control? After a short personal calibration, the webcam turns small head movements into musical navigation. The user can select compatible chords and build a progression without using their hands. This is an early prototype designed to become adaptable through co-design with disabled musicians.

## Deliverables

- Working local React prototype
- Short README with run instructions
- One screenshot or short screen recording
- A note separating implemented behavior from future ideas

## Final Instruction to Codex

Implement the smallest reliable vertical slice first. Do not add eye gaze, blink confirmation, MIDI, generative AI, accounts, or backend services before calibrated head navigation, dwell selection, and chord playback satisfy the acceptance criteria. Keep camera processing local and make every threshold easy to tune during the hackathon.

