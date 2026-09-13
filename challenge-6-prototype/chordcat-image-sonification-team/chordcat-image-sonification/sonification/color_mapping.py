"""Editable artistic rules. These associations are design choices, not universal
color/emotion relationships. All chords are built relative to the global scale.
"""
from .models import Chord, MusicalContext

KEYS = ('C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B')
MAJOR = (0, 2, 4, 5, 7, 9, 11)
MINOR = (0, 2, 3, 5, 7, 8, 10)  # natural minor: no out-of-scale leading tone


def hue_degree(color):
    if color.saturation < .12:
        return 0  # Hue is unstable near gray; anchor neutral colors to tonic.
    h = color.hue % 360
    if h < 15 or h >= 345:
        return 0
    for end, degree in ((45, 1), (75, 2), (165, 3), (195, 4), (255, 5), (345, 6)):
        if h < end:
            return degree


def choose_context(features):
    primary = features.dominant_colors[0]
    tonic = int((primary.hue+15)//30) % 12 if primary.saturation >= .12 else 0
    mode = 'major' if features.mean_lightness >= 50 else 'minor'
    tempo = round(72+32*features.mean_saturation+24*features.shape.complexity)
    return MusicalContext(KEYS[tonic], tonic, mode, tempo, MAJOR if mode == 'major' else MINOR)


def scale_pitch(context, degree, base=60):
    octave, step = divmod(degree, 7)
    return base+context.tonic_pc+12*octave+context.scale[step]


def make_chord(context, color):
    degree = hue_degree(color)
    pitches = tuple(scale_pitch(context, degree+i, base=48) for i in (0, 2, 4))
    intervals = tuple(p-pitches[0] for p in pitches)
    quality = {(0, 4, 7): 'major', (0, 3, 7): 'minor', (0, 3, 6): 'diminished'}[intervals]
    roman = ('I', 'II', 'III', 'IV', 'V', 'VI', 'VII')[degree]
    if quality != 'major':
        roman = roman.lower()
    if quality == 'diminished':
        roman += '°'
    return Chord(degree+1, roman, pitches)
