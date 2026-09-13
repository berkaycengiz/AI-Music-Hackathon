"""Pure feature-to-music mapping. No image processing, playback, or MIDI imports."""
from .color_mapping import choose_context, hue_degree, make_chord, scale_pitch
from .models import Analysis, Motif, Note

# A shared four-beat rhythmic vocabulary provides family resemblance.
RHYTHMS = {2: (0., 2.), 4: (0., 1., 2., 3.),
           6: (0., .5, 1., 2., 2.5, 3.),
           8: (0., .5, 1., 1.5, 2., 2.5, 3., 3.5)}
GESTURE = (0, 1, 2, 1, 0, -1, 1, 0)


def generate_motif(region, context):
    s = region.shape
    chord = make_chord(context, region.dominant_colors[0])
    root = chord.degree-1
    activity = max(0., min(1., .65*s.complexity+.35*s.angularity-.25*s.flow))
    count = 2 if activity < .22 else 4 if activity < .45 else 6 if activity < .7 else 8
    starts = RHYTHMS[count]
    articulation = 'legato' if s.flow > .55 else 'staccato' if s.angularity > .35 else 'tenuto'
    gate = {'legato': 1.0, 'staccato': .48, 'tenuto': .85}[articulation]
    # Sparse regions leave audible space even when their few contours are smooth.
    if s.edge_density < .015:
        gate = min(gate, .65)
    angle = s.orientation_degrees
    direction = 0
    if angle is not None and s.orientation_strength > .35 and 15 < abs(angle) < 75:
        direction = 1 if angle > 0 else -1
    chord_steps = [i for i in range(-7, 15) if (i-root)%7 in (0, 2, 4)]
    all_steps = list(range(-7, 15))
    secondary = {hue_degree(c): c.weight for c in region.dominant_colors[1:] if c.weight > 0}
    previous = root
    notes = []
    for j, start in enumerate(starts):
        # Same gesture in every region; geometry changes direction and interval size.
        stride = 2 if s.angularity > .45 else 1
        # Aim two scale steps ahead so a sparse two-note bar still expresses
        # direction after snapping its final note to the triad.
        target = root + (direction*min(2*j, 6) if direction else GESTURE[j]*stride)
        if angle is not None and abs(angle) < 15 and s.orientation_strength > .5:
            target = root  # Horizontal lines favor repeated/stable pitches.
        strong = start in (0., 2.) or j == len(starts)-1
        candidates = chord_steps if strong else all_steps
        limit = 4 if s.angularity > .45 else 2
        local = [i for i in candidates if abs(i-previous) <= limit]
        candidates = local or candidates
        def cost(i):
            # Secondary hues gently attract weak-beat notes to relative scale tones.
            attraction = secondary.get(i%7, 0)*2 if not strong else 0
            return (abs(i-target)+.25*abs(i-previous)-attraction, abs(i-root), i)
        degree = min(candidates, key=cost)
        end = starts[j+1] if j+1 < len(starts) else 4.
        velocity = round(62+22*region.dominant_colors[0].saturation+(8 if strong else 0))
        notes.append(Note(scale_pitch(context, degree), start,
                          round((end-start)*gate, 4), velocity, articulation))
        previous = degree
    return Motif(region.index, chord, notes, context.tempo)


def generate_composition(features):
    context = choose_context(features)
    return Analysis(context, features,
                    {i: generate_motif(region, context) for i, region in features.squares.items()})
