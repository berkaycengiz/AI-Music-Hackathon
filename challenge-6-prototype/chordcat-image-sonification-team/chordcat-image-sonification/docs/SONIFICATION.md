# Image sonification MVP

A deterministic 4×4 image-to-music prototype. Every square yields one independently usable four-beat motif. All squares share a key, diatonic scale, tempo, rhythmic vocabulary and melodic gesture. No trained models, external services or playback device are used.

## Run

Python 3.10 or newer:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py your-image.jpg --json analysis.json --midi composition.mid --debug grid.png
```

The CLI prints a summary of all 16 bars. `--midi` and `--debug` are optional. For a self-contained demo:

```bash
python generate_example.py
python main.py examples/sample.png --json examples/analysis.json --midi examples/composition.mid --debug examples/grid.png
python -m unittest discover -s tests -v
```

MIDI contains quiet sustained chord accompaniment and melody on separate channels. It is data, not rendered audio; listen using a MIDI-capable synthesizer or DAW.

## API and module boundaries

Run from this project directory, or add it to your Python path:

```python
from sonification import analyze_image, play_or_export_motif

analysis = analyze_image('image.jpg')
motif = analysis.squares[7]
play_or_export_motif(motif, 'square_7.mid')
print(analysis.to_dict())

# Change mapping without extracting the image again:
from sonification import extract_image_features, generate_composition
features = extract_image_features('image.jpg')
analysis = generate_composition(features)
```

`image_analysis.py` and `shape_analysis.py` extract features. They import no musical rules. `color_mapping.py` selects global context and relative chords; `music_generation.py` operates only on feature records. `midi_export.py` consumes motifs and imports mido only when exporting. `debug_image.py` draws the inspection image. `models.py` contains the records; `main.py` connects the stages.

The convenience `analyze_image` API returns generated motifs in `analysis.squares`; raw features remain available in `analysis.features.squares`. `analysis.to_dict()` combines them into the requested JSON layout with `global` and string-keyed `squares`. Chord degrees are one-based; square indices are zero-based. All note start times and durations are **quarter-note beats**, not seconds. Convert with `seconds = beats * 60 / motif.tempo`. A bar always spans four beats, including rests. For a future CHORDCAT adapter, schedule a selected motif's notes and chord directly; the core needs no MIDI playback code.

## Mapping rules

- EXIF orientation is applied and transparency is composited on white. Right/bottom edges are replicated by 0–3 pixels to make dimensions divisible by four. Equal rectangles cover the padded image in row-major order; inputs smaller than 4×4 are rejected.
- Colors use floating-point CIELAB K-Means, fixed seed and ten initializations on at most 4,096 evenly sampled pixels. Weights describe this sample. Representatives are Lab centroids converted to RGB. Hue is in degrees; HSV saturation/value and weights are 0–1; Lab lightness is 0–100. Fewer than three real colors produce zero-weight duplicate slots.
- Global tonic: dominant hue rounded to one of twelve 30° sectors, mapped to C through B. Near-gray colors use C because hue is unreliable. Mean Lab lightness ≥50 selects major, otherwise natural minor. Tempo is `round(72 + 32*saturation + 24*complexity)` BPM, shared by every square.
- Local hue bands: red [345°,360°) or [0°,15°) → degree 1; orange [15°,45°) → 2; yellow [45°,75°) → 3; green [75°,165°) → 4; cyan [165°,195°) → 5; blue [195°,255°) → 6; violet [255°,345°) → 7. Saturation below .12 maps to tonic. Triads use scale steps 0,2,4 above that degree, so their quality follows the selected mode. Degree 7 in major and degree 2 in natural minor are diminished, as required by those scales.
- Strong beats and final notes favor the local triad. Secondary hues attract weak-beat notes to scale degrees, weighted by frequency. A shared gesture and restricted register tie the motifs together. The prototype uses triads rather than adding potentially clashing extensions.
- Shape extraction uses a normalized resolution, Canny edges, polygonal contour turns, long-contour length ratio, and length-weighted Hough line orientation. Complexity combines edge density and angularity; flow combines long contours and smoothness. These are interpretable approximations, not semantic shape recognition.
- Increasing complexity/angularity selects 2, 4, 6 or 8 rhythmic events. Flow reduces density and favors full-slot legato; angularity favors short staccato notes and allows larger diatonic steps. Low edge density creates additional silence. All notes stay within their bar.
- Orientations use Cartesian y-up, interpreted left-to-right: positive slope encourages rising music, negative slope falling music, horizontal lines stable pitch. Weak/conflicting orientations and near-vertical lines use the shared gesture. A still line has no intrinsic direction; this is an explicit interaction convention.

## Limitations and experiments

Color-to-music associations are artistic hypotheses and need evaluation with blind and visually impaired users. Diatonic membership provides harmonic consistency but does not guarantee every transition is equally consonant, especially diminished triads. Geometry thresholds are heuristic; tiny crops, weak contrast and busy textures can mislead them. Extremely thin images can be distorted in the debug preview. Features do not recognize objects or image meaning.

Determinism means repeated runs of the same decoded image with the same dependency versions. Numerical library changes can affect clustering near boundaries; `requirements-lock.txt` records the versions used for the included example. Test coverage checks repeatability, padding, scale membership across all transpositions, sparse/dense and slope responses, transparency, and balanced MIDI note events/bar lengths. Physical pad integration, audio synthesis, live cancellation/retrigger policy, and user evaluation are future work.
