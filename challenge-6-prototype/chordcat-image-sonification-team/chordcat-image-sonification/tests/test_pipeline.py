import json
import tempfile
import unittest
from dataclasses import replace
from pathlib import Path

import mido
import numpy as np
from PIL import Image, ImageDraw
from sonification import analyze_image, extract_image_features, generate_composition
from sonification.color_mapping import make_chord, MusicalContext, MAJOR, MINOR
from sonification.models import Color, Shape, RegionFeatures
from sonification.music_generation import generate_motif
from sonification.midi_export import export_midi, play_or_export_motif
from sonification.shape_analysis import analyze_shape


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def image(self, data, name='input.png'):
        p = self.root/name
        Image.fromarray(data).save(p)
        return p

    def test_repeatability_grid_scale_and_bar_bounds(self):
        pixels = np.random.default_rng(42).integers(0, 256, (83, 101, 3), dtype=np.uint8)
        path = self.image(pixels)
        first, second = analyze_image(path), analyze_image(path)
        self.assertEqual(json.dumps(first.to_dict()), json.dumps(second.to_dict()))
        self.assertEqual(first.features.grid_size, (104, 84))
        self.assertEqual(list(first.squares), list(range(16)))
        sizes = {(f.bounds[2]-f.bounds[0], f.bounds[3]-f.bounds[1]) for f in first.features.squares.values()}
        self.assertEqual(sizes, {(26, 21)})
        for i, motif in first.squares.items():
            self.assertEqual(motif.tempo, first.context.tempo)
            colors = first.features.squares[i].dominant_colors
            self.assertEqual(len(colors), 3)
            self.assertAlmostEqual(sum(c.weight for c in colors), 1)
            for pitch in list(motif.chord.pitches)+[n.pitch for n in motif.notes]:
                self.assertIn((pitch-first.context.tonic_pc)%12, first.context.scale)
                self.assertTrue(0 <= pitch <= 127)
            for n in motif.notes:
                self.assertTrue(0 <= n.start < 4)
                self.assertTrue(0 < n.duration <= 4-n.start)

    def test_uniform_gray_and_minimum_size(self):
        a = analyze_image(self.image(np.full((4, 4, 3), 90, dtype=np.uint8)))
        self.assertEqual(a.context.mode, 'minor')
        for f in a.features.squares.values():
            self.assertEqual([c.weight for c in f.dominant_colors], [1, 0, 0])
            self.assertEqual(f.shape.edge_density, 0)
        self.assertTrue(all(len(m.notes) == 2 for m in a.squares.values()))
        with self.assertRaises(ValueError):
            analyze_image(self.image(np.zeros((3, 4, 3), dtype=np.uint8)))

    def test_multiple_keys_and_modes(self):
        green = analyze_image(self.image(np.full((16, 16, 3), (30, 220, 60), dtype=np.uint8)))
        blue = analyze_image(self.image(np.full((16, 16, 3), (10, 20, 120), dtype=np.uint8)))
        self.assertNotEqual(green.context.tonic_pc, blue.context.tonic_pc)
        self.assertEqual(green.context.mode, 'major')
        self.assertEqual(blue.context.mode, 'minor')
        for scale in (MAJOR, MINOR):
            for tonic in range(12):
                context = MusicalContext('test', tonic, 'test', 100, scale)
                for hue in (0, 30, 60, 120, 180, 220, 300):
                    chord = make_chord(context, Color((0, 0, 0), hue, 1, 1, 50, 1))
                    self.assertTrue(all((p-tonic)%12 in scale for p in chord.pitches))

    def test_shape_response_and_rhythm(self):
        blank = np.full((128, 128, 3), 255, dtype=np.uint8)
        fragmented = blank.copy()
        fragmented[::8, :, :] = 0
        fragmented[:, ::8, :] = 0
        self.assertGreater(analyze_shape(fragmented).edge_density, analyze_shape(blank).edge_density)
        c = Color((255, 0, 0), 0, 1, 1, 50, 1)
        smooth = Shape(.04, 1, 0, 30, 1, 1, 1, .1)
        angular = Shape(.25, 0, 1, -30, 1, 0, 0, 1)
        context = MusicalContext('C', 0, 'major', 100, MAJOR)
        flowing = generate_motif(RegionFeatures(0, (0, 0, 1, 1), [c], smooth), context)
        jagged = generate_motif(RegionFeatures(1, (0, 0, 1, 1), [c], angular), context)
        self.assertLess(len(flowing.notes), len(jagged.notes))
        self.assertEqual(flowing.notes[0].articulation, 'legato')
        self.assertEqual(jagged.notes[0].articulation, 'staccato')
        self.assertGreater(flowing.notes[-1].pitch, flowing.notes[0].pitch)
        self.assertLess(jagged.notes[-1].pitch, jagged.notes[0].pitch)

    def test_slope_convention(self):
        for ascending in (True, False):
            img = Image.new('RGB', (128, 128), 'white')
            d = ImageDraw.Draw(img)
            d.line((10, 110 if ascending else 10, 110, 10 if ascending else 110), fill='black', width=3)
            shape = analyze_shape(np.array(img))
            self.assertGreater(shape.orientation_strength, .9)
            self.assertEqual(shape.orientation_degrees > 0, ascending)

    def test_midi_roundtrip(self):
        analysis = analyze_image(self.image(np.full((16, 16, 3), 200, dtype=np.uint8)))
        for motifs, name in ((list(analysis.squares.values()), 'all.mid'), ([analysis.squares[7]], 'one.mid')):
            path = export_midi(motifs, self.root/name)
            midi = mido.MidiFile(path)
            active, absolute, onsets = set(), 0, 0
            for msg in midi.tracks[0]:
                absolute += msg.time
                if msg.type == 'note_on':
                    key = (msg.channel, msg.note)
                    self.assertNotIn(key, active)
                    active.add(key)
                    onsets += 1
                elif msg.type == 'note_off':
                    active.remove((msg.channel, msg.note))
            self.assertFalse(active)
            self.assertEqual(absolute, len(motifs)*4*midi.ticks_per_beat)
            self.assertEqual(onsets, sum(len(m.notes)+3 for m in motifs))

    def test_transparency(self):
        p = self.root/'alpha.png'
        Image.new('RGBA', (8, 8), (0, 0, 0, 0)).save(p)
        self.assertEqual(extract_image_features(p).dominant_colors[0].rgb, (255, 255, 255))


if __name__ == '__main__':
    unittest.main()
