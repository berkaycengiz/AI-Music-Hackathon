# Challenge 6 Museum Prototype - Implementation Specification

## 1. Goal

Build an interactive museum prototype in which a blind or visually impaired visitor explores a tactile representation of an artwork with one finger. An overhead camera tracks the fingertip, the application identifies the corresponding region of the artwork, and that region becomes part of a live musical performance.

The visitor should not listen to a fixed linear description or a pre-rendered song. Their path across the artwork determines which sonic layers appear, when they appear, and how the musical interpretation develops.

This document intentionally does not assign a product or prototype name.

## 2. Core Experience

```text
Tactile artwork
    -> overhead webcam
    -> fingertip position
    -> calibrated artwork coordinates
    -> artwork region/object
    -> object sound + musical action
    -> browser audio + Chordcat MIDI
```

Example:

| Explored region | Immediate sound | Musical contribution |
| --- | --- | --- |
| River | Flowing-water texture | Repeating arpeggio |
| Trees | Leaves/wind texture | Low sustained notes or bass |
| Birds | Bird calls | Short high-register motif |
| Sun | Warm shimmer | Open, bright chord |
| Human figure | Optional short spoken identification | Main musical motif |

The visitor does not need to know notes, chords, scales, MIDI, or Chordcat controls.

## 3. Product Principle

> The visitor does not receive a song about the artwork. The visitor performs a sonic interpretation by exploring the artwork.

The system provides musical constraints so that every region remains compatible with the others, but the visitor controls:

- The order in which regions are explored.
- How long each region remains active.
- Which regions are revisited.
- The movement speed and path.
- The overall density of the resulting performance.

## 4. Challenge Fit

The prototype addresses Challenge 6 by combining:

- An accessible tactile interface.
- AI-based hand/fingertip tracking.
- Optional AI analysis of newly added artworks.
- A low-learning-curve musical interaction.
- Chordcat as the physical harmony and instrument engine.
- A museum use case with a clear potential user and deployment context.

Avoid claiming that this replaces professional audio description. It is an additional artistic and exploratory access mode.

## 5. MVP Scope

### 5.1 Required MVP

The first complete prototype must support:

1. One physical tactile artwork.
2. One fixed overhead webcam.
3. One tracked hand and index fingertip.
4. Manual four-corner artwork calibration.
5. Four to six large artwork regions.
6. Region enter, stay, and exit events.
7. One object/environment sound per region.
8. One harmonically compatible musical action per region.
9. Browser audio output.
10. Chordcat MIDI output with a browser-audio fallback.
11. A facilitator setup/debug view.
12. A screen-free visitor interaction after setup.

### 5.2 Optional After the MVP

- Automatic corner detection with ArUco markers.
- Automatic analysis of a newly uploaded artwork.
- AI-generated object masks or bounding boxes.
- Multiple artworks.
- Finger-speed-driven musical variation.
- Multiple active fingers or hands.
- A spoken-description layer.
- Curator review and editing tools.
- Saving or replaying the visitor's performance.
- Directional or spatial museum speakers.

### 5.3 Non-Goals

- Detecting physical pressure with a normal RGB camera.
- Proving that the finger is physically touching rather than hovering.
- Recognizing tiny visual details.
- Producing a perfect full song from any image.
- Training a custom hand-tracking model.
- Building a museum content-management system.
- Clinical or therapeutic claims.
- Claiming suitability for every blind or visually impaired person without co-design and testing.

## 6. Physical Setup

### 6.1 Required Hardware

- Laptop running Chrome or Edge.
- USB webcam or another camera exposed to the browser as a webcam.
- Stable overhead camera mount.
- Printed artwork or simplified reproduction.
- Raised tactile borders and textures.
- Chordcat connected by USB-C for MIDI.
- Headphones, active speakers, mixer, or audio interface as required by the output setup.

### 6.2 Camera Placement

- Mount the camera approximately 40-60 cm above the artwork.
- Point it as perpendicular to the artwork as possible.
- Keep the full artwork visible with a margin around all edges.
- Prevent the mount and artwork from moving after calibration.
- Use diffuse front lighting to reduce hard hand shadows.
- Do not mirror the overhead camera feed unless the coordinate transform compensates for it.

### 6.3 Tactile Artwork

A flat print alone is not independently explorable by a blind visitor. Add tactile structure:

- Raised outlines using cord, silicone, glue, foam, or thin 3D-printed pieces.
- Different textures for major regions.
- Clear separation between interactive regions.
- A raised outer border to communicate the artwork boundary.
- Optional tactile orientation mark at the top-left corner.

For the MVP, optimize the tactile representation for four to six large regions rather than trying to reproduce every visual detail.

### 6.4 Audio Routing

Chordcat does not send its internal audio to the computer through the USB-MIDI connection.

Possible demo configurations:

1. Chordcat output and laptop output both connect to a mixer/PA.
2. Chordcat audio enters an audio interface and is monitored with laptop audio.
3. Headphones connect to Chordcat while laptop sounds use a separate speaker; acceptable only for development.
4. Use browser synthesis for all sound if audio routing cannot be solved before the demo.

Do not allow audio routing to block the complete interaction demo.

## 7. Visitor Interaction

### 7.1 Region Lifecycle

Each artwork region has a simple state:

```text
INACTIVE
  -> ENTER_CANDIDATE
  -> ACTIVE
  -> EXIT_CANDIDATE
  -> INACTIVE
```

- `ENTER_CANDIDATE`: fingertip is inside the region but has not remained long enough.
- `ACTIVE`: region has passed the entry dwell and its sound is playing.
- `EXIT_CANDIDATE`: fingertip appears outside briefly; wait before stopping to prevent boundary jitter.

Initial timing values:

- Entry dwell: 120-220 ms.
- Exit dwell: 180-300 ms.
- Same-region retrigger cooldown: 400-700 ms.
- Hand-loss fade-out: 250-500 ms.

Keep all values configurable.

### 7.2 Default Musical Behavior

- Entering a region starts its object sound immediately after the entry dwell.
- Its Chordcat chord or motif is quantized to the next beat.
- Remaining in a region sustains or gently loops its layer.
- Leaving the region fades the object sound rather than cutting it abruptly.
- Re-entering the region selects the next compatible variation.
- Moving between regions creates the sequence and arrangement.

For the MVP, do not require an explicit click, blink, or confirmation gesture.

### 7.3 Optional Continuous Controls

Only after region triggering works reliably:

- Finger speed -> rhythmic density or motif frequency.
- Horizontal movement -> stereo pan.
- Time spent in a region -> layer volume or complexity.
- Direction of travel -> ascending or descending motif variant.

Do not send raw movement directly to pitch without musical constraints; small tracking noise will sound unstable.

## 8. Artwork Coordinate Calibration

### 8.1 MVP Calibration

Use a manual facilitator step:

1. Show the live camera feed.
2. Ask the facilitator to click the artwork corners in this exact order:
   - top-left
   - top-right
   - bottom-right
   - bottom-left
3. Compute a projective transform from the camera quadrilateral to normalized artwork coordinates.
4. Draw the transformed fingertip point on a normalized preview.
5. Save calibration in local storage for the current camera/artwork arrangement.

Use normalized artwork coordinates:

```text
top-left     = (0, 0)
top-right    = (1, 0)
bottom-right = (1, 1)
bottom-left  = (0, 1)
```

### 8.2 Homography

Create a module that transforms a camera point `(cameraX, cameraY)` into artwork coordinates `(artX, artY)` using four point correspondences.

Possible implementations:

- OpenCV.js `getPerspectiveTransform` and `perspectiveTransform`.
- A small projective-transform library.
- A locally implemented 3x3 homography solver with unit tests.

Do not use a simple rectangular crop if the camera has a visible angle; it will misclassify regions near the edges.

### 8.3 Calibration Validation

After calibration, display four test targets. The facilitator points to each physical corner and confirms that the transformed point appears near the matching normalized corner.

Calibration is invalid if:

- Any corner is outside the camera frame.
- The selected points form a self-crossing quadrilateral.
- The artwork area is too small in the camera frame.
- The transform produces coordinates far outside `[0, 1]` for a fingertip visibly on the artwork.

## 9. Finger Tracking

### 9.1 Recommended Technology

Use MediaPipe Tasks Vision Hand Landmarker in video mode.

Primary runtime data:

- Hand presence/confidence.
- Index fingertip landmark.
- Optional remaining landmarks for stability checks.
- Frame timestamp.

The index fingertip is the only required control point for the MVP.

### 9.2 Processing Loop

```text
requestAnimationFrame
  -> read current video frame
  -> detect hand landmarks
  -> select the highest-confidence hand
  -> extract index fingertip
  -> convert normalized video position to video pixels
  -> apply artwork homography
  -> smooth transformed position
  -> perform point-in-region lookup
  -> update region state machine
```

Process at a stable target rate such as 20-30 FPS. Do not queue frames if inference becomes slower than the camera frame rate.

### 9.3 Smoothing

Use a light exponential moving average:

```ts
smoothedX = alpha * currentX + (1 - alpha) * previousX;
smoothedY = alpha * currentY + (1 - alpha) * previousY;
```

Start with `alpha = 0.35-0.5`.

Too much smoothing adds noticeable lag. Rely on entry/exit dwell and region hysteresis instead of aggressive smoothing.

### 9.4 Loss Handling

- If no hand is detected, do not generate a new region event.
- Fade active layers after a short hand-loss grace period.
- Require two or more stable frames after hand reacquisition.
- Do not infer a path across missing frames.

### 9.5 Robustness Fallback

If MediaPipe is unreliable under venue lighting, place a small high-contrast colored marker, ring, or tape near the fingertip and offer a simple color-tracking mode.

The artwork-analysis AI still provides the challenge's semantic layer; using a robust fallback for fingertip tracking is acceptable.

## 10. Artwork Representation

### 10.1 Data Model

Store each artwork as a normalized JSON document:

```ts
type Point = { x: number; y: number };

type ArtworkRegion = {
  id: string;
  label: string;
  spokenLabel?: string;
  polygon: Point[];
  priority: number;
  objectSoundId: string;
  musicalRole: "harmony" | "bass" | "motif" | "texture" | "rhythm";
  midiNote?: number;
  browserNotes?: string[];
  attackMs: number;
  releaseMs: number;
};

type ArtworkDefinition = {
  id: string;
  title: string;
  sourceImage: string;
  keyRoot: string;
  scale: string;
  tempo: number;
  baseLayer?: string;
  regions: ArtworkRegion[];
};
```

Example:

```json
{
  "id": "demo-artwork-1",
  "title": "Demo artwork",
  "sourceImage": "/artworks/demo-artwork.jpg",
  "keyRoot": "D",
  "scale": "minor-pentatonic",
  "tempo": 92,
  "baseLayer": "soft-wind",
  "regions": [
    {
      "id": "river",
      "label": "river",
      "polygon": [
        { "x": 0.05, "y": 0.62 },
        { "x": 0.92, "y": 0.55 },
        { "x": 0.98, "y": 0.92 },
        { "x": 0.1, "y": 0.95 }
      ],
      "priority": 3,
      "objectSoundId": "river-loop",
      "musicalRole": "harmony",
      "midiNote": 60,
      "browserNotes": ["D3", "A3", "D4"],
      "attackMs": 200,
      "releaseMs": 500
    }
  ]
}
```

The example values must be replaced with values matching the selected artwork and Chordcat configuration.

### 10.2 Region Lookup

Use point-in-polygon testing for the transformed fingertip coordinate.

If regions overlap:

1. Prefer the region with the highest priority.
2. If priorities match, prefer the smallest containing polygon.
3. Log overlap decisions in facilitator/debug mode.

Add a small hysteresis margin so the active region does not flicker when the fingertip moves along its border.

## 11. Artwork Analysis

### 11.1 Hackathon Strategy

Use a hybrid approach:

- Prepare one or two polished artwork definitions before the demo.
- Keep the runtime capable of accepting a new artwork definition.
- Add live AI analysis of a new artwork only after the complete touch-to-sound path works.

The demo must never depend solely on a slow or unreliable online model call.

### 11.2 Optional AI Analysis Pipeline

For a newly uploaded image:

1. Extract objective pixel features locally:
   - average brightness
   - saturation
   - dominant palette
   - contrast
   - edge density
2. Send the image to a vision model for:
   - scene summary
   - important objects
   - approximate object locations or masks
   - spatial relationships
   - suggested sound concepts
3. Validate the response against a strict JSON schema.
4. Show a curator/facilitator review step.
5. Convert approved regions into an `ArtworkDefinition`.

Do not send AI output directly to visitors without review in the museum product concept.

### 11.3 AI Output Schema

```json
{
  "sceneSummary": "A river crossing a forest landscape",
  "regions": [
    {
      "label": "river",
      "importance": 0.95,
      "bounds": { "x": 0.08, "y": 0.55, "width": 0.84, "height": 0.38 },
      "soundConcepts": ["flowing water", "smooth arpeggio"]
    }
  ],
  "visualFeatures": {
    "energy": 0.35,
    "tension": 0.2,
    "movement": "flowing"
  }
}
```

The terms `energy`, `tension`, and `movement` are interpretations, not objective truths. Present the final result as one possible sonic interpretation.

### 11.4 Manual Region Editor

Implement a basic authoring fallback before live AI analysis:

- Load an artwork image.
- Click points to draw a polygon.
- Assign a label.
- Assign an object sound.
- Assign a musical role and MIDI note.
- Preview the region.
- Export the artwork JSON.

This guarantees that a museum curator can correct or replace AI output.

## 12. Sound Design

### 12.1 Two Audio Layers

Use two synchronized but conceptually separate layers:

1. **Object/environment layer:** browser-played samples such as river, wind, birds, crowd, machinery, or fabric.
2. **Musical layer:** chords, bass, rhythm, arpeggios, and motifs played by Chordcat or the browser fallback.

Object sounds identify or evoke a region. Musical actions connect the regions into a coherent performance.

### 12.2 Musical Constraints

For each artwork:

- Choose one internal key and scale.
- Prepare four to six compatible chords/motifs.
- Keep all region mappings within the same musical system.
- Quantize chord changes to the next beat.
- Allow environmental sounds to respond immediately.
- Use short attack/release fades.
- Limit simultaneous layers to prevent a noisy result.

If multiple regions are desired simultaneously, retain the last two or three recently visited layers and fade older ones. For the first MVP, only one active region plus a base atmosphere is safer.

### 12.3 Chordcat Role

Chordcat should provide:

- Harmonic chords.
- Bass or synth motifs if time permits.
- A tangible physical-instrument element in the museum demonstration.

The browser should provide:

- Environmental samples.
- Spoken cues if used.
- Emergency fallback synthesis.

### 12.4 Chordcat MIDI Setup

One-time facilitator setup:

1. Connect Chordcat to the laptop with USB-C.
2. Connect its audio output to headphones, mixer, or audio interface.
3. Use firmware supporting external MIDI chord triggering.
4. Configure `MIDI Chord Trigger` as `Custom` or `Fixed`.
5. Map verified MIDI note numbers to compatible chord-performance keys.
6. Store those note numbers in the artwork definition.
7. Confirm MIDI channel and output selection.
8. Test every region from manual buttons before enabling camera input.

Do not attempt to use Chordcat's XY pad as a generic coordinate input. Its documented MIDI output does not expose a raw X/Y coordinate pair.

### 12.5 Browser Fallback

Create one output interface shared by MIDI and Tone.js/Web Audio:

```ts
type MusicalEvent = {
  regionId: string;
  midiNote?: number;
  browserNotes?: string[];
  velocity: number;
  startTime: number;
  durationMs?: number;
};

interface MusicOutput {
  initialize(): Promise<void>;
  startRegion(event: MusicalEvent): void;
  stopRegion(regionId: string): void;
  stopAll(): void;
}
```

Implement:

- `ChordcatMidiOutput`
- `BrowserSynthOutput`
- Optional `CompositeOutput` to use both

## 13. Technical Stack

- React
- TypeScript
- Vite
- MediaPipe Tasks Vision Hand Landmarker
- Canvas API for camera/debug overlays
- OpenCV.js or a small homography implementation
- Web MIDI API
- Tone.js or Web Audio API
- Zod or equivalent for artwork JSON validation
- Vitest for unit tests
- Local static audio assets

No backend is required for the core prototype.

Add a backend or serverless route only if live vision-model analysis is implemented.

## 14. Suggested Project Structure

```text
src/
  app/
    App.tsx
    appState.ts
  camera/
    camera.ts
    handLandmarker.ts
    fingertipTracker.ts
    smoothing.ts
  calibration/
    CalibrationView.tsx
    homography.ts
    calibrationStorage.ts
  artwork/
    artworkTypes.ts
    artworkSchema.ts
    regionLookup.ts
    artworkLoader.ts
    fixtures/
      demo-artwork.json
  interaction/
    regionStateMachine.ts
    interactionController.ts
  audio/
    ObjectSoundEngine.ts
    MusicOutput.ts
    BrowserSynthOutput.ts
    ChordcatMidiOutput.ts
    CompositeOutput.ts
    transport.ts
  components/
    SetupView.tsx
    CameraCalibration.tsx
    DebugOverlay.tsx
    FacilitatorPanel.tsx
    PerformanceStatus.tsx
  authoring/
    RegionEditor.tsx
  tests/
    homography.test.ts
    regionLookup.test.ts
    regionStateMachine.test.ts
    midiOutput.test.ts
public/
  artworks/
  sounds/
```

Keep camera tracking, coordinate conversion, region lookup, interaction state, sound decisions, and output routing separate.

## 15. Application States

```text
START
CAMERA_PERMISSION
CAMERA_SETUP
ARTWORK_CALIBRATION
OUTPUT_SETUP
READY
EXPLORING
PAUSED
ERROR
```

Required behavior:

- Do not start sound before an explicit facilitator action because browsers block unsolicited audio.
- Do not process region events before calibration is valid.
- Do not emit notes while paused or when no hand is detected.
- Always expose a visible `Stop all sound` action.

## 16. Facilitator Interface

The facilitator view may display:

- Camera preview.
- Hand landmarks.
- Raw and transformed fingertip point.
- Current artwork coordinates.
- Current region.
- Entry/exit dwell state.
- MediaPipe confidence.
- Selected MIDI output and channel.
- Manual region trigger buttons.
- Browser-audio fallback toggle.
- Recalibrate and stop-all buttons.

The visitor should not need to use this interface after setup.

## 17. Privacy and Museum Considerations

- Process the camera feed locally in the browser.
- Do not record or upload visitor video.
- Keep the camera aimed at the artwork and hand, not the visitor's face.
- Display a clear notice that hand movement is being processed.
- Discard frames immediately after landmark inference.
- Store only artwork definitions and configuration.
- In a real museum deployment, curator approval is required before publishing AI-generated interpretations.
- Provide headphones or directional sound to avoid disturbing nearby visitors.
- Provide cleaning and durability considerations for the tactile surface.

## 18. Implementation Order

### Phase 1 - Complete the Interaction Without AI or Chordcat

1. Scaffold React, TypeScript, and Vite.
2. Load one prepared artwork JSON.
3. Display a normalized artwork preview.
4. Implement point-in-polygon region lookup.
5. Simulate the fingertip with the mouse.
6. Implement region enter/stay/exit state handling.
7. Play browser sounds for each region.

Exit condition: moving the mouse across the image reliably plays the correct region sounds.

### Phase 2 - Add Camera and Finger Tracking

1. Request webcam access.
2. Initialize MediaPipe Hand Landmarker.
3. Extract the index fingertip.
4. Draw landmark/debug feedback.
5. Add manual four-corner calibration.
6. Transform the fingertip into artwork coordinates.
7. Feed the point into the existing region lookup.

Exit condition: pointing at every tactile region triggers the correct browser sound.

### Phase 3 - Add Musical Coherence

1. Choose one key/scale for the artwork.
2. Assign compatible browser chords/motifs.
3. Add a transport clock.
4. Trigger environmental sounds immediately.
5. Quantize musical actions to the next beat.
6. Add smooth attack/release transitions.

Exit condition: arbitrary movement across regions still sounds intentional and coherent.

### Phase 4 - Add Chordcat

1. Enumerate Web MIDI outputs.
2. Add a MIDI test panel.
3. Configure Chordcat external chord triggering.
4. Verify MIDI channel and note mapping.
5. Connect region events to Chordcat.
6. Add note-off and all-notes-off safety handling.

Exit condition: every prepared region reliably triggers its expected Chordcat chord or motif.

### Phase 5 - Add Artwork Analysis if Time Remains

1. Build the manual region editor first.
2. Define a strict AI response schema.
3. Add a vision-model adapter only when credentials and network access are available.
4. Require curator/facilitator review.
5. Save the approved artwork definition.

Exit condition: a new image can produce an editable draft mapping without affecting the reliable prepared demo.

## 19. Acceptance Criteria

The MVP is complete when:

- The camera sees the complete artwork and the exploring hand.
- Four-corner calibration maps the physical surface correctly.
- The index fingertip is tracked in real time.
- Four large physical regions can be identified.
- A region triggers only after a short stable entry.
- Border jitter does not cause rapid switching.
- Losing the hand cannot trigger random regions.
- Every region has an immediate identifying sound.
- Every region has a harmonically compatible musical contribution.
- The order of exploration changes the resulting performance.
- Chordcat can be replaced by browser synthesis without changing the interaction logic.
- The facilitator can stop all sound immediately.
- The visitor does not need to see or operate the computer or Chordcat.

Suggested demo targets, not scientific performance claims:

- At least 9 correct triggers in 10 deliberate region visits.
- No false trigger during 10 seconds with no hand visible.
- Object-sound response begins within approximately 300 ms of a stable region entry.
- No repeated trigger while the finger remains in one region.
- Setup and calibration complete within two minutes.

## 20. Test Checklist

### Unit Tests

- Homography maps all four calibration corners correctly.
- Invalid/self-crossing calibration is rejected.
- Point-in-polygon handles edges consistently.
- Overlap priority produces deterministic results.
- Entry shorter than dwell does not activate a region.
- A held finger activates only once.
- Short boundary exits do not stop the active region.
- Sustained exit fades and stops the region.
- Hand loss does not select another region.
- Every MIDI note-on receives a note-off.
- Stop-all clears browser and MIDI sound.

### Manual Tests

- Camera directly above and slightly angled.
- Bright and dim venue lighting.
- Hand approaching from each side.
- Slow exploration.
- Fast exploration.
- Finger directly on a border.
- Fingertip temporarily hidden by the hand.
- Camera or artwork moved after calibration.
- Chordcat disconnected during use.
- Web MIDI unavailable.
- Browser audio only.
- Emergency stop while a region is active.

## 21. Two-Minute Presentation

### 0:00-0:20 - Problem

Museum access for blind and visually impaired visitors often relies on a fixed spoken description. Spoken description communicates facts but does not always provide an interactive or creative relationship with the artwork.

### 0:20-0:35 - Concept

Show the tactile artwork and overhead camera. Explain that the artwork becomes a musical surface, and that the visitor's own exploration determines the performance.

### 0:35-1:20 - Live Demonstration

- Touch the river; water and an arpeggio appear.
- Move to the trees; a bass layer enters.
- Explore birds; a high motif responds.
- Revisit the river in a different order to demonstrate that the result is not a fixed recording.

### 1:20-1:40 - Technology

Explain in one sentence per layer:

- AI tracks the fingertip.
- The artwork is mapped into meaningful regions.
- The musical system keeps every choice compatible.
- Chordcat performs the harmonic layer.

### 1:40-2:00 - Impact and Future

Explain that a museum curator could prepare or review mappings for additional artworks, creating an optional interactive sonic access layer alongside professional audio description.

## 22. Suggested Short Description

> A blind or visually impaired visitor explores a tactile artwork with their finger while an overhead camera maps the movement to object sounds and harmonically compatible musical layers. The visitor's path becomes the performance, played through browser audio and Chordcat.

## 23. Responsible Presentation Language

Use:

- "One possible sonic interpretation of the artwork."
- "An additional access layer alongside audio description."
- "An early prototype that should be co-designed with blind and visually impaired users."

Avoid:

- "This lets blind people see."
- "The AI understands the true emotion of the artwork."
- "This works for all blind visitors."
- "This replaces museum audio description."

## 24. Research and Technical References

- *Music & AI Hackathon - Challenges*, Challenge 6: Accessibility & Music (provided hackathon brief).
- [MediaPipe Hand Landmarker for Web](https://ai.google.dev/edge/mediapipe/solutions/vision/hand_landmarker/web_js)
- [OpenCV perspective transform functions](https://docs.opencv.org/4.11.0/d2/d75/namespacecv.html)
- [Chordcat product features and MIDI connectivity](https://alphatheta.com/en/product/production/chordcat/gray/)
- [Chordcat manuals and MIDI implementation guide](https://support.alphatheta.com/en-us/articles/47401717479833)

## 25. Final Build Decision

Implement this complete vertical slice first:

```text
prepared tactile artwork
-> overhead webcam
-> MediaPipe index fingertip
-> manual four-corner homography
-> four predefined object polygons
-> region state machine
-> environmental sample
-> compatible musical event
-> Chordcat MIDI with browser fallback
```

Do not begin automatic analysis of new artworks until this complete path works reliably.
