# Python Sonification — Ubuntu Analysis Handoff

## Objective

Run the supplied Python image-sonification pipeline on Ubuntu to generate deterministic 4×4 analysis data for all nine museum artworks. Return the generated static artifacts to the webapp team.

Python is an **offline preprocessing tool only**. It must not replace the React webapp, the existing CHORDCAT input calibration, or the browser MIDI output layer.

## Product context

The product is an accessible museum experience in which a visitor explores an artwork through a fixed 4×4 tactile/musical map.

Final runtime flow:

```text
CHORDCAT Track 2 touchpad
  → MIDI chord signature
  → browser calibration and cell recognition (cells 1–16)
  → selected cell's generated motif
  → Web MIDI channel/Track 6
  → CHORDCAT piano/electric-piano sound
  → speaker
```

Mouse input and browser audio remain development fallbacks. CHORDCAT Track 2 is only the controller input. All generated music is routed back to the single proven playback voice on Track 6.

The webapp already contains:

- nine museum artwork images;
- a stable 4×4 UI;
- mouse and CHORDCAT cell selection;
- persistent 16-key browser calibration;
- curated semantic descriptions for every cell;
- an artwork-specific main-theme system;
- browser fallback playback;
- Web MIDI note output to CHORDCAT.

The Python package adds measurable visual evidence: dominant colors, brightness, saturation, edge density, angularity, smoothness, flow, orientation, complexity, chords, and timed notes.

## Important architectural decision

Do **not** use `play.sh` or `chordcat_xy_player.py` as the final application. They implement a second calibration and MIDI runtime that would compete with the webapp.

The final webapp will consume the generated JSON directly. The standalone Python player may only be used as an optional isolated hardware diagnostic when the webapp is closed.

## Source locations

Run from:

```text
challenge-6-prototype/chordcat-image-sonification-team/chordcat-image-sonification
```

The source artwork images are located at:

```text
challenge-6-prototype/public/artworks/*.jpg
```

From the Python package directory, that path is:

```text
../../public/artworks/*.jpg
```

## Ubuntu setup

Execute these as separate commands:

```bash
cd challenge-6-prototype/chordcat-image-sonification-team/chordcat-image-sonification
bash setup.sh
.venv/bin/python -m unittest discover -s tests -v
```

The setup requires Python 3.10+ and internet access. If Ubuntu reports that `venv` is missing:

```bash
sudo apt install python3 python3-venv
bash setup.sh
```

## Generate all nine artwork analyses

The supplied `analyze.sh` always overwrites the same `results` files, so generate named output directories by calling `main.py` directly:

```bash
mkdir -p results/artworks

for image in ../../public/artworks/*.jpg; do
  id="$(basename "$image" .jpg)"
  output="results/artworks/$id"
  mkdir -p "$output"

  .venv/bin/python main.py "$image" \
    --json "$output/analysis.json" \
    --midi "$output/composition.mid" \
    --debug "$output/grid.png"
done
```

Record the exact dependency versions used:

```bash
.venv/bin/python -m pip freeze > results/requirements-lock.txt
```

## Validate generated MIDI without hardware

```bash
for midi in results/artworks/*/composition.mid; do
  .venv/bin/python chordcat_xy_player.py --midi "$midi" --check-midi
done
```

Hardware playback is not required for this handoff.

## Expected output

Return the complete directory:

```text
results/
├── requirements-lock.txt
└── artworks/
    ├── arnolfini-portrait/
    │   ├── analysis.json
    │   ├── composition.mid
    │   └── grid.png
    ├── creation-of-adam/
    ├── landscape-fields/
    ├── pond-landscape/
    ├── raft-of-medusa/
    ├── the-kiss/
    ├── the-scream/
    ├── wanderer-fog/
    └── woman-with-parasol/
```

Each `analysis.json` must contain:

- one shared `global` key, mode, scale, and tempo;
- exactly 16 entries under `squares`;
- square indices `0` through `15`;
- valid MIDI pitches from 0 through 127;
- note start and duration values expressed in quarter-note beats;
- positive durations contained inside a four-beat bar;
- velocity values from 1 through 127;
- dominant-color and shape measurements for every square.

`grid.png` is important for visual QA. It should show that the analyzed crops correspond to the intended 4×4 artwork cells.

## Webapp integration contract

The webapp team will perform this part after receiving the outputs:

1. Copy the generated JSON files into the React source tree.
2. Map Python square `0–15` to webapp cell `1–16` by adding one.
3. Preserve the existing curated semantic label, interpretation, importance, and artwork-specific main theme.
4. Use Python measurements as the factual color/shape layer.
5. Use the Python note timing, duration, velocity, articulation, and chord data to enrich the existing motif.
6. Keep all notes within the artwork's shared tonal context.
7. Send both melody and quiet chord accompaniment to CHORDCAT Track 6.
8. Make the browser fallback perform the same motif so it can be evaluated without hardware.
9. Keep the existing Track 2 browser calibration and input recognition unchanged.

Special ID mapping:

```text
pond-landscape.jpg → webapp artwork ID water-lily-pond
```

All other image filenames match their webapp artwork IDs.

## Do not do the following

- Do not add a Python or Node MIDI bridge to the final runtime.
- Do not replace the browser's existing CHORDCAT calibration.
- Do not run `play.sh` simultaneously with the webapp.
- Do not route different semantic families to Tracks 5–8; the chosen reliable playback track is Track 6.
- Do not remove the curated semantic analyses or artwork-specific themes.
- Do not require internet access during the museum demo.
- Do not include `.venv`, `__pycache__`, or temporary files in the returned archive.

## Success criteria

The handoff is complete when all nine artworks have valid `analysis.json`, `composition.mid`, and `grid.png` outputs, the included tests pass on Ubuntu, and the complete `results` directory is returned to the webapp team.
