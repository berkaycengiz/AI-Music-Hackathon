#!/usr/bin/env python3
"""CHORDCAT XY player for the image-sonification prototype.

Setup: python -m pip install mido python-rtmidi
First: python chordcat_xy_player.py --calibrate
Then:  python chordcat_xy_player.py --midi /path/to/musik.mid

One square plays one 4/4 MIDI bar, including melody and accompaniment.
Alternatively: --midi-dir /path/to/motifs (square_0.mid through square_15.mid).
Use Chord Cruiser mode and retain the calibrated chordcat_xy_mapping.json.
"""

from __future__ import annotations

import argparse
from bisect import bisect_right
from collections import Counter
from dataclasses import dataclass
import json
import math
import signal
import sys
import threading
import time
from pathlib import Path
from typing import Iterable, List, Optional

# Keep file inspection and --help usable without a MIDI backend or hardware.
mido = None


def require_mido():
    global mido
    if mido is None:
        try:
            import mido as module
        except ImportError as exc:
            raise RuntimeError("Install MIDI dependencies: python -m pip install mido python-rtmidi") from exc
        mido = module
    return mido


PORT_HINTS = ("chordcat", "alpha theta", "alphatheta")

def get_input_names() -> List[str]:
    try:
        return list(mido.get_input_names())
    except Exception as exc:
        print(f"Could not enumerate MIDI ports: {exc}", file=sys.stderr)
        print(
            "Check that python-rtmidi is installed and that no MIDI driver is failing.",
            file=sys.stderr,
        )
        raise SystemExit(3)


def print_ports(names: Iterable[str], direction: str = "input") -> None:
    names = list(names)
    if not names:
        print(f"No MIDI {direction} ports found.")
        return
    print(f"Available MIDI {direction} ports:")
    for index, name in enumerate(names, start=1):
        marker = "  <-- likely CHORDCAT" if any(h in name.lower() for h in PORT_HINTS) else ""
        print(f"  {index:2d}. {name}{marker}")


def resolve_port(names: List[str], requested: Optional[str], direction: str = "input") -> str:
    if not names:
        raise RuntimeError(
            f"No MIDI {direction} ports were found. Connect CHORDCAT by USB, turn it on, "
            "and verify that the operating system sees its MIDI port."
        )

    if requested:
        exact = [name for name in names if name.casefold() == requested.casefold()]
        if len(exact) == 1:
            return exact[0]
        partial = [name for name in names if requested.casefold() in name.casefold()]
        if len(partial) == 1:
            return partial[0]
        if not partial:
            raise RuntimeError(f"No MIDI {direction} port matches {requested!r}.")
        raise RuntimeError(
            f"Port text {requested!r} matches multiple ports:\n  " + "\n  ".join(partial)
        )

    likely = [name for name in names if any(h in name.lower() for h in PORT_HINTS)]
    if len(likely) == 1:
        return likely[0]

    if len(names) == 1:
        return names[0]

    if not sys.stdin.isatty():
        choices = likely or names
        raise RuntimeError(
            f"Port selection is ambiguous. Run with {'--port' if direction == 'input' else '--output-port'} followed by part of one of: "
            + ", ".join(repr(x) for x in choices)
        )

    candidates = likely or names
    print_ports(names, direction)
    if likely:
        print("\nMultiple likely CHORDCAT ports were found.")
    while True:
        answer = input(f"Select {direction} port [1-{len(names)}]: ").strip()
        try:
            index = int(answer) - 1
            if 0 <= index < len(names):
                return names[index]
        except ValueError:
            pass
        print("Please enter a valid port number.")


def should_show(message: mido.Message, args: argparse.Namespace) -> bool:
    if message.type == "clock" and not args.clock:
        return False
    if message.type == "active_sensing" and not args.active_sensing:
        return False
    # CHORDCAT can continuously emit CC 11 values, which makes the monitor
    # unusable for inspecting other MIDI events. Hide this noise by default.
    # Use --show-cc11 if you explicitly want to inspect CC 11 again.
    if (
        message.type == "control_change"
        and getattr(message, "control", None) == 11
        and not args.show_cc11
    ):
        return False
    return True


@dataclass(frozen=True)
class MidiMotif:
    # Seconds relative to the start of the bar; source MIDI channels retained.
    events: tuple
    duration: float
    source: str


def load_midi_bars(path: Path, bar_count: int = 16) -> list[MidiMotif]:
    """Split only complete, independent 4/4 bars, rejecting notes across boundaries.

    This matches the sonification exporter. Tempo changes are integrated before
    slicing so each triggered bar also works independently of previous playback.
    """
    require_mido()
    path = Path(path)
    midi = mido.MidiFile(path)
    if midi.type == 2 or midi.ticks_per_beat <= 0:
        raise ValueError(f"{path}: expected synchronous, beat-based MIDI (type 0 or 1).")
    bar_ticks = midi.ticks_per_beat * 4
    timeline, tempos, markers = [], [(0, 0.0, 500000)], []
    tick, seconds, tempo = 0, 0.0, 500000
    for msg in mido.merge_tracks(midi.tracks):
        tick += msg.time
        seconds += mido.tick2second(msg.time, midi.ticks_per_beat, tempo)
        if msg.type == 'set_tempo':
            if msg.tempo <= 0:
                raise ValueError(f"{path}: tempo must be positive.")
            tempo = msg.tempo
            tempos.append((tick, seconds, tempo))
        elif msg.type == 'time_signature' and (msg.numerator, msg.denominator) != (4, 4):
            raise ValueError(f"{path}: only 4/4 MIDI is supported.")
        elif msg.type == 'marker' and msg.text.startswith('Square '):
            markers.append((tick, msg.text))
        elif msg.type in ('note_on', 'note_off'):
            timeline.append((tick, seconds, msg.copy(time=0)))
    if tick != bar_ticks * bar_count:
        raise ValueError(f"{path}: expected exactly {bar_count} bars of 4/4; "
                         f"found {tick / bar_ticks:g}. Use --midi-dir for individual bars.")
    if bar_count == 16 and markers and markers != [(i*bar_ticks, f'Square {i}') for i in range(16)]:
        raise ValueError(f"{path}: Square markers must identify squares 0 through 15 in order.")
    tempo_ticks = [t[0] for t in tempos]
    def at_seconds(t):
        start, elapsed, bpm = tempos[bisect_right(tempo_ticks, t)-1]
        return elapsed + mido.tick2second(t-start, midi.ticks_per_beat, bpm)
    boundaries = [at_seconds(i*bar_ticks) for i in range(bar_count+1)]
    events = [[] for _ in range(bar_count)]
    held = [Counter() for _ in range(bar_count)]
    for t, elapsed, msg in timeline:
        is_on = msg.type == 'note_on' and msg.velocity > 0
        # A release exactly at a boundary closes the PREVIOUS bar; an attack
        # belongs to the next. This preserves sustained four-beat accompaniment.
        index = t // bar_ticks if is_on else (t-1) // bar_ticks
        if not 0 <= index < bar_count:
            raise ValueError(f"{path}: note event outside a bar at tick {t}.")
        key = (msg.channel, msg.note)
        held[index][key] += 1 if is_on else -1
        if held[index][key] < 0:
            raise ValueError(f"{path}: unmatched note-off or note crossing bar {index}.")
        if not is_on:
            msg = mido.Message('note_off', channel=msg.channel, note=msg.note, velocity=0)
        events[index].append((elapsed-boundaries[index], msg))
    if any(any(count for count in notes.values()) for notes in held):
        raise ValueError(f"{path}: hanging notes or notes crossing a bar boundary.")
    return [MidiMotif(tuple(e), boundaries[i+1]-boundaries[i], str(path))
            for i, e in enumerate(events)]


def load_motifs(midi_path=None, midi_dir=None):
    if midi_dir is not None:
        return {i: load_midi_bars(Path(midi_dir)/f'square_{i}.mid', 1)[0] for i in range(16)}
    return dict(enumerate(load_midi_bars(midi_path or Path('musik.mid'))))


def note_name(note: int) -> str:
    names = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "Ab", "A", "Bb", "B")
    return f"{names[note % 12]}{note // 12 - 1}"


def print_motif_grid(motifs) -> None:
    print('Image sonification: one MIDI bar per square:')
    for row in range(4):
        print('  '.join(f'{n:2d}: {sum(m.type == "note_on" for _, m in motifs[n].events)} notes, '
                        f'{motifs[n].duration:.2f}s' for n in range(row*4, row*4+4)))


class ChordDetector:
    """Use an inactivity deadline, not a fixed chord length or release event."""

    def __init__(self, silence_seconds: float = .010):
        if not math.isfinite(silence_seconds) or silence_seconds <= 0:
            raise ValueError("Chord silence window must be positive and finite.")
        self.silence_seconds = silence_seconds
        self.notes: set[int] = set()
        self.last_note_time: Optional[float] = None

    def poll(self, now: Optional[float] = None) -> Optional[tuple[int, ...]]:
        now = time.perf_counter() if now is None else now
        if self.last_note_time is None or now - self.last_note_time < self.silence_seconds:
            return None
        signature = tuple(sorted(self.notes))
        self.notes.clear()
        self.last_note_time = None
        return signature

    def feed(self, message, now: Optional[float] = None) -> Optional[tuple[int, ...]]:
        now = time.perf_counter() if now is None else now
        # Finish a previous burst before starting another if the loop was late.
        completed = self.poll(now)
        if message.type == "note_on" and message.velocity > 0:
            self.notes.add(message.note)
            # Even a repeated pitch extends the deadline; set removes duplicates.
            self.last_note_time = now
        return completed


def duplicate_signatures(mapping: dict[int, tuple[int, ...]]) -> dict[tuple[int, ...], list[int]]:
    grouped: dict[tuple[int, ...], list[int]] = {}
    for square, signature in sorted(mapping.items()):
        grouped.setdefault(signature, []).append(square)
    return {signature: squares for signature, squares in grouped.items() if len(squares) > 1}


def warn_duplicates(mapping: dict[int, tuple[int, ...]]) -> None:
    for signature, squares in duplicate_signatures(mapping).items():
        print(f"Warning: squares {squares} share signature {signature}; "
              "they cannot be distinguished and will not trigger playback.", flush=True)


def load_mapping(path: Path) -> dict[int, tuple[int, ...]]:
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except FileNotFoundError:
        raise ValueError(f"No mapping at {path}. Run with --calibrate first.") from None
    if not isinstance(data, dict) or set(data) != {str(n) for n in range(16)}:
        raise ValueError("Mapping must contain exactly the square keys '0' through '15'.")
    mapping = {}
    for square, notes in data.items():
        if (not isinstance(notes, list) or not notes
                or any(type(note) is not int or not 0 <= note <= 127 for note in notes)
                or len(set(notes)) != len(notes)):
            raise ValueError(f"Square {square}: expected a nonempty list of unique MIDI notes 0..127.")
        mapping[int(square)] = tuple(sorted(notes))
    warn_duplicates(mapping)
    return mapping


def save_mapping(mapping: dict[int, tuple[int, ...]], path: Path) -> None:
    # Replace only after a complete file has been written.
    temporary = path.with_name(path.name + ".tmp")
    try:
        temporary.write_text(json.dumps({str(n): list(mapping[n]) for n in range(16)},
                                        indent=2) + "\n", encoding="utf-8")
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def identify_square(signature: tuple[int, ...], mapping: dict[int, tuple[int, ...]]) -> Optional[int]:
    matches = [square for square, chord in mapping.items() if chord == signature]
    return matches[0] if len(matches) == 1 else None


class MelodyPlayer:
    """A single output worker prevents stale bars after rapid pad changes.

    Absolute deadlines avoid accumulating send latency. Cancellation interrupts
    waits and releases all held pitches before the next request starts.
    """

    def __init__(self, output_port, motifs, channel=0, debug=False, preserve_channels=False):
        require_mido()
        self.output_port = output_port
        self.motifs = motifs
        self.channel = channel
        self.debug = debug
        self.preserve_channels = preserve_channels
        self.condition = threading.Condition()
        self.version = 0
        self.pending = None
        self.stopping = False
        self.error = None
        self.thread = threading.Thread(target=self._run, name="midi-bar-player", daemon=True)
        self.thread.start()

    def check_error(self):
        with self.condition:
            if self.error is not None:
                raise RuntimeError(f"MIDI output error: {self.error}") from self.error

    def play(self, square):
        if square not in self.motifs:
            raise ValueError(f"No MIDI motif for square {square}.")
        with self.condition:
            self.check_error()
            if self.stopping:
                raise RuntimeError("MIDI player is closed.")
            self.pending = square
            self.version += 1
            self.condition.notify_all()

    def _send(self, message):
        self.output_port.send(message)
        if self.debug:
            print(f"OUT {message}", flush=True)

    def _release(self, held):
        # Try every release even if one hardware send fails.
        failure = None
        for channel, pitch in list(held):
            try:
                self._send(mido.Message('note_off', channel=channel, note=pitch, velocity=0))
                del held[(channel, pitch)]
            except Exception as exc:
                failure = exc
        if failure is not None:
            raise failure

    def _run(self):
        held = Counter()
        try:
            while True:
                with self.condition:
                    self.condition.wait_for(lambda: self.stopping or self.pending is not None)
                    if self.stopping:
                        return
                    square, version = self.pending, self.version
                    self.pending = None
                motif = self.motifs[square]
                started = time.perf_counter()
                for when, source in motif.events:
                    with self.condition:
                        self.condition.wait_for(
                            lambda: self.stopping or version != self.version,
                            timeout=max(0, started+when-time.perf_counter()))
                        if self.stopping or version != self.version:
                            break
                        channel = source.channel if self.preserve_channels else self.channel
                        msg = source.copy(channel=channel, time=0)
                        key = (channel, msg.note)
                        # On a single synth track, harmony and melody can share
                        # a pitch. Reference counts prevent premature releases.
                        if msg.type == 'note_on' and msg.velocity > 0:
                            held[key] += 1
                            if held[key] == 1:
                                self._send(msg)
                        else:
                            if held[key] == 1:
                                self._send(msg)
                                del held[key]
                            elif held[key] > 1:
                                held[key] -= 1
                self._release(held)
                with self.condition:
                    self.condition.wait_for(
                        lambda: self.stopping or version != self.version,
                        timeout=max(0, started+motif.duration-time.perf_counter()))
        except Exception as exc:
            with self.condition:
                self.error = exc
                self.stopping = True
                self.condition.notify_all()
        finally:
            try:
                self._release(held)
            except Exception as exc:
                with self.condition:
                    self.error = exc

    def close(self):
        with self.condition:
            self.stopping = True
            self.pending = None
            self.condition.notify_all()
        self.thread.join()
        self.check_error()


def accept_input(message, args: argparse.Namespace) -> bool:
    # Optional channel isolation avoids echo without suppressing genuine presses
    # during playback. Never enable it if the pad uses the output channel too.
    channel = getattr(message, "channel", None)
    if args.ignore_output_channel and channel in getattr(args, "playback_channels", {args.output_channel - 1}):
        return False
    if args.input_channel is not None and channel != args.input_channel - 1:
        return False
    return True


def iter_chords(midi_in, args: argparse.Namespace, stop: threading.Event, player=None):
    detector = ChordDetector(args.chord_gap_ms / 1000)
    while not stop.is_set():
        if player is not None:
            player.check_error()
        # Retained from the monitor: drain pending messages, sleep 1 ms on idle.
        pending = list(midi_in.iter_pending())
        for message in pending:
            if args.debug and should_show(message, args):
                print(f"IN {message}", flush=True)
            if accept_input(message, args):
                signature = detector.feed(message)
                if signature is not None:
                    yield signature
        # Essential: check the deadline even when no more MIDI messages arrive.
        signature = detector.poll()
        if signature is not None:
            yield signature
        if not pending:
            time.sleep(.001)


def calibrate(midi_in, args: argparse.Namespace, stop: threading.Event) -> None:
    print("Calibration: use Chord Cruiser mode; press and release each square once.")
    print(" 0   1   2   3\n 4   5   6   7\n 8   9  10  11\n12  13  14  15")
    mapping: dict[int, tuple[int, ...]] = {}
    chords = iter_chords(midi_in, args, stop)
    for square in range(16):
        print(f"Press square {square}", flush=True)
        signature = next(chords, None)
        if signature is None or stop.is_set():
            print("Calibration stopped; existing mapping was not changed.")
            return
        mapping[square] = signature
        print(f"Square {square}: {signature}", flush=True)
        others = [n for n in range(square) if mapping[n] == signature]
        if others:
            print(f"Warning: square {square} has the same chord signature as {others}.", flush=True)
    save_mapping(mapping, args.mapping)
    print(f"Saved {args.mapping.resolve()}")
    warn_duplicates(mapping)


def test_output(args: argparse.Namespace, stop: threading.Event) -> None:
    """Bypass pad recognition to test the synth's MIDI receive path directly."""
    name = resolve_port(list(mido.get_output_names()), args.output_port, "output")
    channel = args.output_channel - 1
    print("Input: disabled (no calibration or pad required)")
    print(f"Output: {name} (channel {args.output_channel})")
    print("Output test: C4 D4 E4 F4 G4. Do not touch the pad. Ctrl+C stops.", flush=True)
    with mido.open_output(name) as output:
        for pitch in (60, 62, 64, 65, 67):
            if stop.is_set():
                break
            try:
                output.send(mido.Message("note_on", channel=channel, note=pitch, velocity=100))
                print(f"OUT sent note_on channel={args.output_channel} "
                      f"note={pitch} ({note_name(pitch)}) velocity=100", flush=True)
                stop.wait(.6)
            finally:
                output.send(mido.Message("note_off", channel=channel, note=pitch, velocity=0))
                print(f"OUT sent note_off channel={args.output_channel} note={pitch}", flush=True)
            stop.wait(.2)
    print("Output test finished. 'Sent' confirms the software send, not audible device playback.")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Use CHORDCAT Chord Cruiser squares to play generated image-sonification MIDI bars.")
    source = parser.add_mutually_exclusive_group()
    source.add_argument("--midi", type=Path, help="Generated 16-bar MIDI file (default: musik.mid)")
    source.add_argument("--midi-dir", type=Path, help="Folder containing square_0.mid through square_15.mid")
    parser.add_argument("--check-midi", action="store_true", help="Validate files and print the grid without MIDI hardware")
    parser.add_argument("--preserve-midi-channels", action="store_true",
                        help="Keep source channels; otherwise merge all notes onto --output-channel")
    parser.add_argument("--calibrate", action="store_true")
    parser.add_argument("--test-output", action="store_true",
                        help="Send C D E F G without input or calibration, then exit")
    parser.add_argument("--mapping", type=Path, default=Path("chordcat_xy_mapping.json"))
    parser.add_argument("--list", action="store_true", help="List MIDI input and output ports and exit")
    parser.add_argument("--port", help="Input port name or unique substring (auto-detect by default)")
    parser.add_argument("--output-port", help="Output port name or unique substring (auto-detect by default)")
    parser.add_argument("--input-channel", type=int, choices=range(1, 17), metavar="1..16",
                        help="Recognize only this channel; default: all channels")
    parser.add_argument("--output-channel", type=int, choices=range(1, 17), default=1, metavar="1..16",
                        help="Playback channel (default: 1); choose the receiving CHORDCAT track")
    parser.add_argument("--ignore-output-channel", action="store_true",
                        help="Ignore input on playback channel; requires pad on a DIFFERENT channel")
    parser.add_argument("--chord-gap-ms", type=float, default=10, help="Silence ending a chord (default: 10 ms)")
    parser.add_argument("--debug", action="store_true", help="Print raw received MIDI messages")
    # Keep the original monitor's should_show() filters and override switches.
    parser.add_argument("--clock", action="store_true", help="With --debug, also display clock")
    parser.add_argument("--active-sensing", action="store_true", help="With --debug, display active sensing")
    parser.add_argument("--show-cc11", action="store_true", help="With --debug, also display CC11")
    args = parser.parse_args()
    if sum((args.test_output, args.calibrate, args.list, args.check_midi)) > 1:
        parser.error("Use --test-output, --calibrate, --list, and --check-midi separately")
    if not math.isfinite(args.chord_gap_ms) or args.chord_gap_ms <= 0:
        parser.error("--chord-gap-ms must be positive and finite")
    if args.ignore_output_channel and not args.preserve_midi_channels and args.input_channel == args.output_channel:
        parser.error("Ignoring the output channel would also ignore the selected input channel")
    return args


def main() -> int:
    args = parse_args()
    stop = threading.Event()

    def request_stop(signum, frame):
        stop.set()

    signal.signal(signal.SIGINT, request_stop)
    if hasattr(signal, "SIGTERM"):
        signal.signal(signal.SIGTERM, request_stop)

    try:
        require_mido()
        print(f"Script: {Path(__file__).resolve()} [image-sonification MIDI bars]", flush=True)
        motifs = None
        if not (args.test_output or args.calibrate or args.list):
            motifs = load_motifs(args.midi, args.midi_dir)
            print_motif_grid(motifs)
            if args.check_midi:
                return 0
            args.playback_channels = ({m.channel for motif in motifs.values() for _, m in motif.events}
                                      if args.preserve_midi_channels else {args.output_channel-1})
            if args.ignore_output_channel and args.input_channel is not None and args.input_channel-1 in args.playback_channels:
                raise ValueError("Ignoring playback channels would also ignore the selected input channel.")
        if args.test_output:
            test_output(args, stop)
            return 0
        # Validate mapping before opening ports in normal mode.
        mapping = None if args.calibrate or args.list else load_mapping(args.mapping)
        if mapping is not None:
            print(f"Mapping: {args.mapping.resolve()}")
        names = get_input_names()
        if args.list:
            print_ports(names)
            print_ports(mido.get_output_names(), "output")
            return 0
        input_name = resolve_port(names, args.port)
        print(f"Input: {input_name}")
        if args.ignore_output_channel:
            print(f"Ignoring playback input channels {[c+1 for c in sorted(getattr(args, "playback_channels", {args.output_channel-1}))]}; the pad must use another channel.")
        with mido.open_input(input_name) as midi_in:
            if args.calibrate:
                print("Output: disabled during calibration")
                calibrate(midi_in, args, stop)
            else:
                output_name = resolve_port(list(mido.get_output_names()), args.output_port, "output")
                channels = 'source MIDI channels' if args.preserve_midi_channels else f'channel {args.output_channel}'
                print(f"Output: {output_name} ({channels})")
                print("Press any square: one MIDI bar. A new press replaces the current bar. Ctrl+C to stop.", flush=True)
                with mido.open_output(output_name) as midi_out:
                    player = MelodyPlayer(midi_out, motifs, args.output_channel - 1, args.debug, args.preserve_midi_channels)
                    try:
                        for signature in iter_chords(midi_in, args, stop, player):
                            if stop.is_set():
                                break
                            print(f"\nDetected chord: {signature}", flush=True)
                            square = identify_square(signature, mapping)
                            if square is None:
                                matches = [n for n, chord in mapping.items() if chord == signature]
                                if matches:
                                    print(f"-> Ambiguous squares {matches}; recalibrate with distinct chords.")
                                else:
                                    print("-> Unknown chord; no melody triggered.")
                                continue
                            print(f"-> Square {square}", flush=True)
                            player.play(square)
                            print(f"-> Requested MIDI bar {square} ({motifs[square].duration:.2f}s)", flush=True)
                    finally:
                        player.close()
        return 0
    except (OSError, RuntimeError, ValueError, EOFError) as exc:
        print(f"Error: {exc}", file=sys.stderr)
        return 1
    except Exception as exc:
        print(f"MIDI error: {exc}\nCheck mido, python-rtmidi, and the MIDI connection.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
