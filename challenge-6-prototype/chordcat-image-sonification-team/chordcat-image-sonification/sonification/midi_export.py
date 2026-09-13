"""Optional MIDI serialization. Beat times in the core API are not MIDI ticks.
Channel 0: melody; channel 1: quiet sustained harmony. No playback dependencies.
"""
from pathlib import Path


def export_midi(motifs, path, tempo=None):
    import mido  # Lazy import: analysis/JSON do not require mido.
    motifs = list(motifs)
    if not motifs:
        raise ValueError('At least one motif is required.')
    tempo = motifs[0].tempo if tempo is None else tempo
    if tempo <= 0 or any(m.tempo != tempo for m in motifs):
        raise ValueError('All motifs must share the export tempo.')
    ticks = 480
    midi = mido.MidiFile(ticks_per_beat=ticks)
    track = mido.MidiTrack()
    midi.tracks.append(track)
    track.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(tempo)))
    track.append(mido.MetaMessage('time_signature', numerator=4, denominator=4))
    for channel in (0, 1):
        track.append(mido.Message('program_change', channel=channel, program=0))
    events = []
    offset = 0
    for motif in motifs:
        events.append((offset, 2, mido.MetaMessage('marker', text=f'Square {motif.index}')))
        for note in motif.notes:
            if not (0 <= note.start < 4 and 0 < note.duration <= 4-note.start+1e-8):
                raise ValueError('Notes must fit inside one four-beat bar.')
            start = offset+round(note.start*ticks)
            end = offset+round((note.start+note.duration)*ticks)
            events.append((start, 1, mido.Message('note_on', channel=0, note=note.pitch, velocity=note.velocity)))
            events.append((end, 0, mido.Message('note_off', channel=0, note=note.pitch, velocity=0)))
        for pitch in motif.chord.pitches:
            events.append((offset, 1, mido.Message('note_on', channel=1, note=pitch, velocity=45)))
            events.append((offset+4*ticks, 0, mido.Message('note_off', channel=1, note=pitch, velocity=0)))
        offset += 4*ticks
    previous = 0
    # Note-offs precede note-ons at shared timestamps, avoiding stuck retriggers.
    for when, _, message in sorted(events, key=lambda item: (item[0], item[1])):
        track.append(message.copy(time=when-previous))
        previous = when
    track.append(mido.MetaMessage('end_of_track', time=offset-previous))
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    midi.save(path)
    return path


def play_or_export_motif(motif, path='motif.mid'):
    """Export one independently triggerable bar; this MVP does not open a MIDI port."""
    return export_midi([motif], path)
