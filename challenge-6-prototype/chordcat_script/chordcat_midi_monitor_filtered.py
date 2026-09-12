#!/usr/bin/env python3
"""CHORDCAT MIDI Monitor

Monitors MIDI messages from an AlphaTheta CHORDCAT or another MIDI input.
Messages are printed live and can be recorded as JSON Lines and CSV.

Requirements:
    python -m pip install mido python-rtmidi

Examples:
    python chordcat_midi_monitor.py --list
    python chordcat_midi_monitor.py
    python chordcat_midi_monitor.py --port "CHORDCAT"
    python chordcat_midi_monitor.py --jsonl chordcat_capture.jsonl --csv chordcat_capture.csv
    python chordcat_midi_monitor.py --seconds 30
"""

from __future__ import annotations

import argparse
import csv
import json
import signal
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, TextIO

try:
    import mido
except ImportError:
    print(
        "Missing dependency. Install it with:\n"
        "  python -m pip install mido python-rtmidi",
        file=sys.stderr,
    )
    raise SystemExit(2)


APP_NAME = "CHORDCAT MIDI Monitor"
PORT_HINTS = ("chordcat", "alpha theta", "alphatheta")
CSV_FIELDS = [
    "sequence",
    "utc_time",
    "elapsed_seconds",
    "delta_seconds",
    "port",
    "type",
    "channel_1_based",
    "note",
    "note_name",
    "velocity",
    "control",
    "value",
    "program_1_based",
    "pitch",
    "song",
    "pos",
    "sysex_hex",
    "raw_bytes_hex",
    "message",
]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Monitor and record MIDI data sent by an AlphaTheta CHORDCAT."
    )
    parser.add_argument(
        "--list", action="store_true", help="List available MIDI input ports and exit."
    )
    parser.add_argument(
        "--port",
        help=(
            "Input-port name or a unique part of its name. If omitted, the script "
            "tries to detect CHORDCAT and otherwise offers an interactive selection."
        ),
    )
    parser.add_argument(
        "--jsonl",
        type=Path,
        help="Write one complete MIDI event per line as JSON.",
    )
    parser.add_argument(
        "--csv", type=Path, help="Write a spreadsheet-friendly CSV event log."
    )
    parser.add_argument(
        "--seconds",
        type=float,
        help="Stop automatically after this many seconds. Default: run until Ctrl+C.",
    )
    parser.add_argument(
        "--clock",
        action="store_true",
        help="Display MIDI clock messages. They are hidden by default to reduce noise.",
    )
    parser.add_argument(
        "--active-sensing",
        action="store_true",
        help="Display active-sensing messages. They are hidden by default.",
    )
    parser.add_argument(
        "--show-cc11",
        action="store_true",
        help="Display CC 11 messages. Hidden by default because CHORDCAT can spam them continuously.",
    )
    parser.add_argument(
        "--no-color", action="store_true", help="Disable ANSI terminal colors."
    )
    parser.add_argument(
        "--quiet",
        action="store_true",
        help="Do not print individual events; logging still remains active.",
    )
    return parser.parse_args()


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


def print_ports(names: Iterable[str]) -> None:
    names = list(names)
    if not names:
        print("No MIDI input ports found.")
        return
    print("Available MIDI input ports:")
    for index, name in enumerate(names, start=1):
        marker = "  <-- likely CHORDCAT" if any(h in name.lower() for h in PORT_HINTS) else ""
        print(f"  {index:2d}. {name}{marker}")


def resolve_port(names: List[str], requested: Optional[str]) -> str:
    if not names:
        raise RuntimeError(
            "No MIDI input ports were found. Connect CHORDCAT by USB, turn it on, "
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
            raise RuntimeError(f"No MIDI input port matches {requested!r}.")
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
            "Port selection is ambiguous. Run with --port followed by part of one of: "
            + ", ".join(repr(x) for x in choices)
        )

    candidates = likely or names
    print_ports(names)
    if likely:
        print("\nMultiple likely CHORDCAT ports were found.")
    while True:
        answer = input(f"Select input port [1-{len(names)}]: ").strip()
        try:
            index = int(answer) - 1
            if 0 <= index < len(names):
                return names[index]
        except ValueError:
            pass
        print("Please enter a valid port number.")


def note_name(note: int) -> str:
    names = ("C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B")
    return f"{names[note % 12]}{note // 12 - 1}"


def safe_bytes(message: mido.Message) -> List[int]:
    try:
        return list(message.bytes())
    except Exception:
        return []


def message_to_record(
    message: mido.Message,
    sequence: int,
    port_name: str,
    elapsed: float,
    delta: float,
) -> Dict[str, Any]:
    data = message.dict()
    raw = safe_bytes(message)
    record: Dict[str, Any] = {
        "sequence": sequence,
        "utc_time": datetime.now(timezone.utc).isoformat(timespec="milliseconds"),
        "elapsed_seconds": round(elapsed, 6),
        "delta_seconds": round(delta, 6),
        "port": port_name,
        "type": message.type,
        "channel_1_based": data.get("channel", -1) + 1 if "channel" in data else "",
        "note": data.get("note", ""),
        "note_name": note_name(data["note"]) if "note" in data else "",
        "velocity": data.get("velocity", ""),
        "control": data.get("control", ""),
        "value": data.get("value", ""),
        "program_1_based": data.get("program", -1) + 1 if "program" in data else "",
        "pitch": data.get("pitch", ""),
        "song": data.get("song", ""),
        "pos": data.get("pos", ""),
        "sysex_hex": " ".join(f"{x:02X}" for x in data.get("data", ())),
        "raw_bytes_hex": " ".join(f"{x:02X}" for x in raw),
        "message": str(message),
        "mido": data,
    }
    return record


def color(text: str, code: str, enabled: bool) -> str:
    return f"\033[{code}m{text}\033[0m" if enabled else text


def format_event(record: Dict[str, Any], use_color: bool) -> str:
    msg_type = str(record["type"])
    type_colors = {
        "note_on": "92",
        "note_off": "90",
        "control_change": "96",
        "program_change": "95",
        "pitchwheel": "93",
        "sysex": "91",
        "clock": "90",
        "start": "94",
        "continue": "94",
        "stop": "94",
    }
    label = color(msg_type.upper(), type_colors.get(msg_type, "97"), use_color)
    channel = (
        f" ch={record['channel_1_based']:>2}" if record["channel_1_based"] != "" else "      "
    )
    details: List[str] = []

    if msg_type in ("note_on", "note_off"):
        details.extend(
            [
                f"note={record['note']:>3}",
                f"{record['note_name']:<3}",
                f"velocity={record['velocity']:>3}",
            ]
        )
    elif msg_type == "control_change":
        details.extend([f"CC={record['control']:>3}", f"value={record['value']:>3}"])
    elif msg_type == "program_change":
        details.append(f"program={record['program_1_based']}")
    elif msg_type == "pitchwheel":
        details.append(f"pitch={record['pitch']}")
    elif msg_type == "sysex":
        details.append(f"data={record['sysex_hex'] or '(empty)'}")
    else:
        details.append(record["message"])

    return (
        f"{record['sequence']:06d}  +{record['elapsed_seconds']:10.6f}s  "
        f"dt={record['delta_seconds']:9.6f}s  {label:<20}{channel}  "
        + "  ".join(details)
        + f"  [hex: {record['raw_bytes_hex']}]"
    )


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


def main() -> int:
    args = parse_args()
    names = get_input_names()

    if args.list:
        print_ports(names)
        return 0

    try:
        port_name = resolve_port(names, args.port)
    except RuntimeError as exc:
        print(f"Error: {exc}", file=sys.stderr)
        print_ports(names)
        return 4

    json_file: Optional[TextIO] = None
    csv_file: Optional[TextIO] = None
    csv_writer: Optional[csv.DictWriter] = None

    try:
        if args.jsonl:
            args.jsonl.parent.mkdir(parents=True, exist_ok=True)
            json_file = args.jsonl.open("w", encoding="utf-8", newline="\n")
        if args.csv:
            args.csv.parent.mkdir(parents=True, exist_ok=True)
            csv_file = args.csv.open("w", encoding="utf-8-sig", newline="")
            csv_writer = csv.DictWriter(csv_file, fieldnames=CSV_FIELDS, extrasaction="ignore")
            csv_writer.writeheader()

        stop_requested = False

        def request_stop(signum: int, frame: Any) -> None:
            nonlocal stop_requested
            stop_requested = True

        signal.signal(signal.SIGINT, request_stop)
        if hasattr(signal, "SIGTERM"):
            signal.signal(signal.SIGTERM, request_stop)

        print(f"{APP_NAME}")
        print(f"Input: {port_name}")
        print("Move the XY pad and operate controls. Press Ctrl+C to stop.")
        if not args.clock:
            print("MIDI clock is being recorded but hidden. Add --clock to display it.")
        if not args.show_cc11:
            print("CC 11 spam is hidden. Add --show-cc11 to display it.")
        if args.jsonl:
            print(f"JSONL log: {args.jsonl.resolve()}")
        if args.csv:
            print(f"CSV log:   {args.csv.resolve()}")
        print()

        sequence = 0
        displayed = 0
        counts: Dict[str, int] = {}
        start = time.perf_counter()
        previous = start

        try:
            with mido.open_input(port_name) as midi_in:
                while not stop_requested:
                    now = time.perf_counter()
                    if args.seconds is not None and now - start >= args.seconds:
                        break

                    pending = list(midi_in.iter_pending())
                    if not pending:
                        time.sleep(0.001)
                        continue

                    for message in pending:
                        now = time.perf_counter()
                        sequence += 1
                        elapsed = now - start
                        delta = now - previous
                        previous = now
                        counts[message.type] = counts.get(message.type, 0) + 1
                        record = message_to_record(
                            message, sequence, port_name, elapsed, delta
                        )

                        if json_file:
                            json_file.write(json.dumps(record, ensure_ascii=False) + "\n")
                            json_file.flush()
                        if csv_writer and csv_file:
                            csv_writer.writerow(record)
                            csv_file.flush()

                        if should_show(message, args):
                            displayed += 1
                            if not args.quiet:
                                print(format_event(record, not args.no_color), flush=True)
        except Exception as exc:
            print(f"\nMIDI input error: {exc}", file=sys.stderr)
            return 5

        duration = time.perf_counter() - start
        print("\nCapture finished.")
        print(f"Duration: {duration:.3f} seconds")
        print(f"Events:   {sequence} received, {displayed} displayed")
        if counts:
            print("Types:    " + ", ".join(f"{k}={v}" for k, v in sorted(counts.items())))
        else:
            print("No MIDI messages were received.")
        return 0

    finally:
        if json_file:
            json_file.close()
        if csv_file:
            csv_file.close()


if __name__ == "__main__":
    raise SystemExit(main())
