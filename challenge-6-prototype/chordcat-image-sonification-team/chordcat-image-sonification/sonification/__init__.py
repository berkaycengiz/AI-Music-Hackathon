from .image_analysis import extract_image_features
from .music_generation import generate_composition
from .midi_export import play_or_export_motif


def analyze_image(path):
    """Convenience pipeline. Use the two stages separately to experiment with mapping."""
    return generate_composition(extract_image_features(path))


__all__ = ['analyze_image', 'extract_image_features', 'generate_composition', 'play_or_export_motif']
