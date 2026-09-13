"""CLI: python main.py image.jpg --json result.json --midi result.mid --debug grid.png"""
import argparse
import json
from pathlib import Path
from sonification import analyze_image
from sonification.debug_image import save_debug_image
from sonification.midi_export import export_midi


def main():
    parser = argparse.ArgumentParser(description='Deterministic 4x4 image sonification')
    parser.add_argument('image', type=Path)
    parser.add_argument('--json', type=Path, default=Path('analysis.json'))
    parser.add_argument('--midi', type=Path)
    parser.add_argument('--debug', type=Path)
    args = parser.parse_args()
    result = analyze_image(args.image)
    args.json.parent.mkdir(parents=True, exist_ok=True)
    args.json.write_text(json.dumps(result.to_dict(), indent=2, allow_nan=False)+'\n')
    c = result.context
    print(f'{c.key} {c.mode}, {c.tempo} BPM | pitches=MIDI, times=quarter-note beats')
    for i, m in result.squares.items():
        f = result.features.squares[i]
        print(f'{i:2d}: RGB {f.dominant_colors[0].rgb!s:16} '
              f'edge={f.shape.edge_density:.3f} angular={f.shape.angularity:.2f} '
              f'flow={f.shape.flow:.2f} | {m.chord.symbol:4} '
              f'{len(m.notes)} notes ({m.notes[0].articulation}): '
              + ', '.join(f'{n.pitch}@{n.start:g}/{n.duration:g}' for n in m.notes))
    if args.midi:
        export_midi(result.squares.values(), args.midi)
    if args.debug:
        save_debug_image(args.image, result.features, args.debug)


if __name__ == '__main__':
    main()
