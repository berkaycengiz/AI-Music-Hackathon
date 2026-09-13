"""Serializable records. Image features contain no musical decisions."""
from dataclasses import asdict, dataclass


@dataclass(frozen=True)
class Color:
    rgb: tuple[int, int, int]
    hue: float  # degrees, 0..360
    saturation: float  # HSV saturation, 0..1
    brightness: float  # HSV value, 0..1
    lightness: float  # CIELAB L*, 0..100
    weight: float


@dataclass(frozen=True)
class Shape:
    edge_density: float
    long_contour_ratio: float
    angularity: float
    orientation_degrees: float | None  # Cartesian angle, -90..90
    orientation_strength: float
    smoothness: float
    flow: float
    complexity: float


@dataclass(frozen=True)
class RegionFeatures:
    index: int
    bounds: tuple[int, int, int, int]
    dominant_colors: list[Color]
    shape: Shape


@dataclass(frozen=True)
class ImageFeatures:
    source_size: tuple[int, int]
    grid_size: tuple[int, int]
    dominant_colors: list[Color]
    mean_saturation: float
    mean_lightness: float
    shape: Shape
    squares: dict[int, RegionFeatures]


@dataclass(frozen=True)
class MusicalContext:
    key: str
    tonic_pc: int
    mode: str
    tempo: int
    scale: tuple[int, ...]


@dataclass(frozen=True)
class Note:
    pitch: int
    start: float  # quarter-note beats
    duration: float
    velocity: int
    articulation: str


@dataclass(frozen=True)
class Chord:
    degree: int  # one-based diatonic degree
    symbol: str
    pitches: tuple[int, ...]


@dataclass(frozen=True)
class Motif:
    index: int
    chord: Chord
    notes: list[Note]
    tempo: int
    beats: int = 4


@dataclass(frozen=True)
class Analysis:
    context: MusicalContext
    features: ImageFeatures
    squares: dict[int, Motif]

    def to_dict(self):
        squares = {}
        for i, motif in self.squares.items():
            feature = self.features.squares[i]
            squares[str(i)] = {
                'bounds': feature.bounds,
                'dominant_colors': [asdict(c) for c in feature.dominant_colors],
                **asdict(feature.shape),
                **asdict(motif),
            }
        return {'global': asdict(self.context),
                'image': {'source_size': self.features.source_size,
                          'grid_size': self.features.grid_size}, 'squares': squares}
