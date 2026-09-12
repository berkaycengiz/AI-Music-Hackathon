import type {
  ArtworkDefinition,
  ArtworkRegion,
  ExperienceMode,
  Point,
  TrackMixState,
} from '../artwork/artworkTypes';
import { polygonCenter } from '../artwork/regionLookup';

function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

interface ActiveVoice {
  oscillators: OscillatorNode[];
  gain: GainNode;
  stop: () => void;
}

interface ActiveMidiChord {
  channel: number;
  notes: number[];
}

interface CompositionTrack {
  region: ArtworkRegion;
  gain: GainNode;
  filter: BiquadFilterNode;
  level: number;
  state: TrackMixState['state'];
}

const LOOK_AHEAD_SECONDS = 0.12;
const SCHEDULER_INTERVAL_MS = 25;
const MASTER_LEVEL = 0.58;

function baseLevelForRole(role: ArtworkRegion['musicalRole']): number {
  switch (role) {
    case 'texture': return 0.18;
    case 'pad': return 0.16;
    case 'harmony': return 0.14;
    case 'bass': return 0.12;
    case 'melody':
    case 'accent':
      return 0.1;
  }
}

/**
 * Browser composition emulator and CHORDCAT-ready output layer.
 * Region Chords plays one area voicing. Full Composition keeps a shared song
 * transport running and blends every instrument stem by distance to its center.
 */
export class ObjectSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;

  private activeRegionVoices = new Map<string, ActiveVoice>();
  private activeMidiChords = new Map<string, ActiveMidiChord>();
  private arpeggioTimers = new Map<string, number>();

  private compositionTracks = new Map<string, CompositionTrack>();
  private compositionTimer: number | null = null;
  private compositionArtwork: ArtworkDefinition | null = null;
  private nextStepTime = 0;
  private compositionStep = 0;
  private spatialPosition: Point | null = null;
  private focusRegionId: string | null = null;

  private mode: ExperienceMode = 'region-chords';
  private initialized = false;
  private currentCutoff = 2200;

  private midiOutput: any = null;
  private midiAccess: any = null;
  private lastMidiExpression = new Map<number, number>();

  onMidiStateChange: (() => void) | null = null;

  async initialize(): Promise<void> {
    if (this.initialized) {
      if (this.ctx?.state === 'suspended') await this.ctx.resume();
      return;
    }

    this.ctx = new AudioContext();
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = this.currentCutoff;
    this.masterFilter.Q.value = 1.2;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = MASTER_LEVEL;
    this.masterGain.connect(this.masterFilter);
    this.masterFilter.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') await this.ctx.resume();
    void this.initMidi();
    this.initialized = true;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get cutoffHz(): number {
    return this.currentCutoff;
  }

  get isMidiConnected(): boolean {
    return Boolean(this.midiOutput);
  }

  get midiDeviceName(): string {
    return this.midiOutput?.name || 'Browser Composition Engine';
  }

  get midiDeviceId(): string {
    return this.midiOutput?.id || '';
  }

  getMidiPorts(): { id: string; name: string }[] {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.outputs.values()).map((output: any) => ({
      id: output.id,
      name: output.name || 'Unknown MIDI Output',
    }));
  }

  selectMidiPortById(id: string): void {
    if (!this.midiAccess) return;
    const found = this.midiAccess.outputs.get(id);
    if (!found) return;
    this.midiOutput = found;
    this.lastMidiExpression.clear();
    this.applySpatialMix(true);
    this.onMidiStateChange?.();
  }

  private async initMidi(): Promise<void> {
    if (typeof navigator === 'undefined' || !('requestMIDIAccess' in navigator)) return;
    try {
      const access = await (navigator as any).requestMIDIAccess();
      this.midiAccess = access;
      this.selectMidiPort();
      access.onstatechange = () => {
        this.selectMidiPort();
        this.onMidiStateChange?.();
      };
    } catch {
      console.info('MIDI access unavailable — using the browser composition engine.');
    }
  }

  private selectMidiPort(): void {
    if (!this.midiAccess) return;
    const outputs = Array.from(this.midiAccess.outputs.values()) as any[];
    if (outputs.length === 0) {
      this.midiOutput = null;
      this.onMidiStateChange?.();
      return;
    }
    const chordcat = outputs.find((output) => {
      const name = (output.name || '').toLowerCase();
      return name.includes('chordcat') || name.includes('alphatheta');
    });
    this.midiOutput = chordcat || outputs[0];
    this.lastMidiExpression.clear();
    this.onMidiStateChange?.();
  }

  startMode(mode: ExperienceMode, artwork: ArtworkDefinition): void {
    this.stopAll();
    this.mode = mode;
    if (mode === 'full-composition') this.startComposition(artwork);
  }

  setNarrationDucking(active: boolean): void {
    if (!this.ctx || !this.masterGain) return;
    const target = active ? MASTER_LEVEL * 0.42 : MASTER_LEVEL;
    this.masterGain.gain.setTargetAtTime(target, this.ctx.currentTime, active ? 0.08 : 0.22);
  }

  startRegionSound(region: ArtworkRegion): void {
    if (!this.ctx || !this.masterGain) return;
    this.stopRegionSound(region.id, 80);
    const notes = region.midiNotes.length ? region.midiNotes : [60, 64, 67, 71];
    this.sendMidiChord(region.id, region.chordcatTrack, notes, 95);
    const voice = this.createPolyphonicChordVoice(region, notes);
    this.activeRegionVoices.set(region.id, voice);
  }

  stopRegionSound(regionId: string, releaseMs = 300): void {
    const timer = this.arpeggioTimers.get(regionId);
    if (timer) {
      window.clearInterval(timer);
      this.arpeggioTimers.delete(regionId);
    }

    const midiChord = this.activeMidiChords.get(regionId);
    if (midiChord && this.midiOutput) {
      try {
        midiChord.notes.forEach((note) => this.midiOutput.send([0x80 + midiChord.channel, note, 0]));
      } catch (error) {
        console.warn('MIDI note release failed:', error);
      }
    }
    this.activeMidiChords.delete(regionId);

    const voice = this.activeRegionVoices.get(regionId);
    if (!voice || !this.ctx) return;
    const now = this.ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(now);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
    voice.gain.gain.linearRampToValueAtTime(0, now + releaseMs / 1000);
    window.setTimeout(() => {
      voice.stop();
      voice.gain.disconnect();
    }, releaseMs + 60);
    this.activeRegionVoices.delete(regionId);
  }

  setSpatialMix(position: Point | null, immediate = false): void {
    if (this.mode !== 'full-composition') return;
    this.spatialPosition = position;
    this.applySpatialMix(immediate);
  }

  getTrackMixSnapshot(): TrackMixState[] {
    return Array.from(this.compositionTracks.values())
      .sort((a, b) => a.region.chordcatTrack - b.region.chordcatTrack)
      .map((track) => ({
        regionId: track.region.id,
        label: track.region.label,
        track: track.region.chordcatTrack,
        level: track.level,
        role: track.region.musicalRole,
        state: track.state,
      }));
  }

  private startComposition(artwork: ArtworkDefinition): void {
    if (!this.ctx || !this.masterGain) return;
    this.compositionArtwork = artwork;
    this.compositionStep = 0;
    this.nextStepTime = this.ctx.currentTime + 0.06;

    artwork.regions.forEach((region) => {
      const filter = this.ctx!.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.value = 4200;
      filter.Q.value = 0.9;
      const gain = this.ctx!.createGain();
      gain.gain.value = 0;
      filter.connect(gain);
      gain.connect(this.masterGain!);
      this.compositionTracks.set(region.id, { region, filter, gain, level: 0, state: 'bed' });
    });

    this.applySpatialMix(true);
    this.scheduleComposition();
    this.compositionTimer = window.setInterval(() => this.scheduleComposition(), SCHEDULER_INTERVAL_MS);
    try {
      this.midiOutput?.send([0xfa]);
    } catch {
      // Browser composition continues if the device is unavailable.
    }
  }

  private scheduleComposition(): void {
    if (!this.ctx || !this.compositionArtwork) return;
    const stepDuration = 60 / this.compositionArtwork.tempo / 4;
    while (this.nextStepTime < this.ctx.currentTime + LOOK_AHEAD_SECONDS) {
      this.scheduleCompositionStep(this.compositionStep, this.nextStepTime, stepDuration);
      this.compositionStep += 1;
      this.nextStepTime += stepDuration;
    }
  }

  private scheduleCompositionStep(step: number, time: number, stepDuration: number): void {
    const artwork = this.compositionArtwork;
    if (!artwork || artwork.regions.length === 0) return;
    const chordIndex = Math.floor(step / 16) % artwork.regions.length;
    const chord = artwork.regions[chordIndex].midiNotes;
    const stepInBar = step % 16;

    for (const track of this.compositionTracks.values()) {
      const role = track.region.musicalRole;
      if (role === 'bass' && (stepInBar === 0 || stepInBar === 8)) {
        this.scheduleNote(track, Math.max(28, chord[0] - 12), time, stepDuration * 6.5, 0.72, 'sine');
      } else if ((role === 'pad' || role === 'harmony') && stepInBar === 0) {
        chord.slice(0, 5).forEach((note, index) => {
          this.scheduleNote(
            track,
            note,
            time,
            stepDuration * 15.2,
            0.26 / Math.sqrt(index + 1),
            role === 'pad' ? 'sine' : 'triangle',
          );
        });
      } else if (role === 'melody' && stepInBar % 2 === 0) {
        const note = chord[(step / 2 + track.region.chordcatTrack) % chord.length] + 12;
        this.scheduleNote(track, Math.min(96, note), time, stepDuration * 1.65, 0.34, 'triangle');
      } else if (role === 'accent' && [2, 6, 10, 14].includes(stepInBar)) {
        const note = chord[(stepInBar / 2) % chord.length] + 12;
        this.scheduleNote(track, Math.min(98, note), time, stepDuration * 0.9, 0.28, 'sine');
      } else if (role === 'texture' && stepInBar % 4 === 0) {
        const note = chord[Math.min(2, chord.length - 1)];
        this.scheduleNote(track, note, time, stepDuration * 3.6, 0.2, 'sine');
      }
    }
  }

  private scheduleNote(
    track: CompositionTrack,
    midiNote: number,
    time: number,
    duration: number,
    level: number,
    waveform: OscillatorType,
  ): void {
    if (!this.ctx) return;
    const oscillator = this.ctx.createOscillator();
    const envelope = this.ctx.createGain();
    const end = time + duration;
    oscillator.type = waveform;
    oscillator.frequency.setValueAtTime(midiToFreq(midiNote), time);
    envelope.gain.setValueAtTime(0.0001, time);
    envelope.gain.exponentialRampToValueAtTime(Math.max(0.001, level), time + 0.035);
    envelope.gain.setValueAtTime(Math.max(0.001, level * 0.82), Math.max(time + 0.04, end - 0.12));
    envelope.gain.exponentialRampToValueAtTime(0.0001, end);
    oscillator.connect(envelope);
    envelope.connect(track.filter);
    oscillator.start(time);
    oscillator.stop(end + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      envelope.disconnect();
    };
  }

  private applySpatialMix(immediate = false): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Gaussian falloff keeps nearby stems musical while preserving a clear focus.
    // 0.20 spans roughly one fifth of the artwork in normalized coordinates.
    const sigma = 0.2;
    const targets = Array.from(this.compositionTracks.values()).map((track) => {
      const center = polygonCenter(track.region.polygon);
      const distance = this.spatialPosition
        ? Math.hypot(this.spatialPosition.x - center.x, this.spatialPosition.y - center.y)
        : Number.POSITIVE_INFINITY;
      const influence = this.spatialPosition
        ? Math.exp(-(distance * distance) / (2 * sigma * sigma))
        : 0;
      const bed = baseLevelForRole(track.region.musicalRole);
      return { track, distance, influence, level: bed + (1 - bed) * influence };
    });

    const nearest = this.spatialPosition
      ? targets.reduce<(typeof targets)[number] | null>(
          (best, target) => (!best || target.distance < best.distance ? target : best),
          null,
        )
      : null;
    this.focusRegionId = nearest?.track.region.id ?? null;

    const mixEnergy = Math.sqrt(targets.reduce((sum, target) => sum + target.level ** 2, 0));
    const headroom = Math.min(1, 1.55 / Math.max(1, mixEnergy));

    for (const { track, level, influence } of targets) {
      const isFocus = track.region.id === this.focusRegionId;
      const bed = baseLevelForRole(track.region.musicalRole);
      track.level = level;
      track.state = isFocus ? 'focus' : level > bed + 0.035 ? 'blend' : 'bed';
      const audioLevel = level * 0.36 * headroom;
      track.gain.gain.cancelScheduledValues(now);
      if (immediate) track.gain.gain.setValueAtTime(audioLevel, now);
      else track.gain.gain.setTargetAtTime(audioLevel, now, 0.18 + (1 - influence) * 0.04);
      this.sendTrackExpression(track.region.chordcatTrack, level, immediate);
    }
  }

  updateModulation(brightness: number, warmth: number): void {
    if (!this.ctx || !this.masterFilter) return;
    const minFreq = 350;
    const maxFreq = 6800;
    const normalized = Math.max(0, Math.min(1, brightness));
    const targetFreq = minFreq * Math.pow(maxFreq / minFreq, normalized);
    this.currentCutoff = Math.round(targetFreq);

    const focusTrack = this.focusRegionId
      ? this.compositionTracks.get(this.focusRegionId)
      : null;
    const filter = focusTrack?.filter || this.masterFilter;
    filter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.04);
    filter.Q.setTargetAtTime(1 + (warmth + 1) * 0.7, this.ctx.currentTime, 0.04);

    if (!this.midiOutput) return;
    const channels = focusTrack
      ? [focusTrack.region.chordcatTrack - 1]
      : Array.from(this.activeMidiChords.values()).map((active) => active.channel);
    const ccValue = Math.round(normalized * 127);
    try {
      channels.forEach((channel) => this.midiOutput.send([0xb0 + channel, 74, ccValue]));
    } catch {
      // Modulation is non-critical.
    }
  }

  stopAll(): void {
    if (this.compositionTimer !== null) window.clearInterval(this.compositionTimer);
    this.compositionTimer = null;
    this.compositionArtwork = null;
    this.spatialPosition = null;
    this.focusRegionId = null;

    for (const track of this.compositionTracks.values()) {
      track.gain.disconnect();
      track.filter.disconnect();
    }
    this.compositionTracks.clear();

    for (const id of Array.from(this.activeRegionVoices.keys())) this.stopRegionSound(id, 60);
    for (const timer of this.arpeggioTimers.values()) window.clearInterval(timer);
    this.arpeggioTimers.clear();
    this.activeRegionVoices.clear();
    this.activeMidiChords.clear();
    this.lastMidiExpression.clear();

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.cancelScheduledValues(this.ctx.currentTime);
      this.masterGain.gain.setValueAtTime(MASTER_LEVEL, this.ctx.currentTime);
    }

    if (!this.midiOutput) return;
    try {
      this.midiOutput.send([0xfc]);
      for (let channel = 0; channel < 8; channel += 1) {
        this.midiOutput.send([0xb0 + channel, 120, 0]);
        this.midiOutput.send([0xb0 + channel, 123, 0]);
      }
    } catch {
      // Port may have disappeared during an emergency stop.
    }
  }

  isPlaying(regionId: string): boolean {
    if (this.mode === 'full-composition') {
      return this.compositionTracks.get(regionId)?.state !== 'bed';
    }
    return this.activeRegionVoices.has(regionId);
  }

  testTrack(trackNumber: number): void {
    const sourceRegion = this.compositionArtwork?.regions.find(
      (region) => region.chordcatTrack === trackNumber,
    );
    const testNotes = sourceRegion?.midiNotes || [48, 55, 60];
    const region: ArtworkRegion = sourceRegion || {
      id: `test-track-${trackNumber}`,
      label: `Track ${trackNumber} Test`,
      polygon: [],
      priority: 1,
      chordcatTrack: trackNumber,
      chordName: `Track ${trackNumber}`,
      midiNotes: testNotes,
      musicalRole: 'harmony',
      dynamicBehavior: 'sustained-chord',
      attackMs: 80,
      releaseMs: 220,
    };
    const testId = `test-track-${trackNumber}`;
    this.startRegionSound({ ...region, id: testId });
    window.setTimeout(() => this.stopRegionSound(testId, 220), 650);
  }

  private createPolyphonicChordVoice(region: ArtworkRegion, midiNotes: number[]): ActiveVoice {
    const ctx = this.ctx!;
    const voiceGain = ctx.createGain();
    const now = ctx.currentTime;
    const attackTime = Math.max(0.02, region.attackMs / 1000);
    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(0.48, now + attackTime);
    voiceGain.connect(this.masterGain!);

    const oscillators: OscillatorNode[] = [];
    if (region.dynamicBehavior === 'arpeggio' || region.dynamicBehavior === 'sparkle') {
      let step = 0;
      const playStep = () => {
        const octave = region.dynamicBehavior === 'sparkle' ? 12 : 0;
        const note = midiNotes[step % midiNotes.length] + octave;
        step += 1;
        const oscillator = ctx.createOscillator();
        const envelope = ctx.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.value = midiToFreq(note);
        envelope.gain.setValueAtTime(0.0001, ctx.currentTime);
        envelope.gain.exponentialRampToValueAtTime(0.26, ctx.currentTime + 0.025);
        envelope.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.48);
        oscillator.connect(envelope);
        envelope.connect(voiceGain);
        oscillator.start();
        oscillator.stop(ctx.currentTime + 0.5);
      };
      playStep();
      const timer = window.setInterval(() => {
        if (this.activeRegionVoices.has(region.id)) playStep();
      }, 240);
      this.arpeggioTimers.set(region.id, timer);
    } else {
      midiNotes.forEach((note, index) => {
        const frequency = midiToFreq(note);
        const primary = ctx.createOscillator();
        const body = ctx.createOscillator();
        const noteGain = ctx.createGain();
        primary.type = region.musicalRole === 'bass' ? 'sine' : 'triangle';
        body.type = 'sine';
        primary.frequency.value = frequency;
        body.frequency.value = frequency * 0.998;
        noteGain.gain.value = 0.22 / Math.sqrt(index + 1);
        primary.connect(noteGain);
        body.connect(noteGain);
        noteGain.connect(voiceGain);
        primary.start();
        body.start();
        oscillators.push(primary, body);
      });
    }
    return {
      oscillators,
      gain: voiceGain,
      stop: () => oscillators.forEach((oscillator) => {
        try { oscillator.stop(); } catch { /* Already stopped. */ }
      }),
    };
  }

  private sendMidiChord(regionId: string, trackNumber: number, notes: number[], velocity: number): void {
    if (!this.midiOutput) return;
    const channel = Math.max(0, Math.min(7, trackNumber - 1));
    try {
      this.midiOutput.send([0xb0 + channel, 123, 0]);
      notes.forEach((note) => this.midiOutput.send([0x90 + channel, note, velocity]));
      this.activeMidiChords.set(regionId, { channel, notes: [...notes] });
    } catch (error) {
      console.warn('MIDI chord send failed:', error);
    }
  }

  private sendTrackExpression(trackNumber: number, level: number, force = false): void {
    if (!this.midiOutput) return;
    const channel = Math.max(0, Math.min(7, trackNumber - 1));
    const value = Math.round(Math.max(0, Math.min(1, level)) * 127);
    if (!force && this.lastMidiExpression.get(channel) === value) return;
    try {
      this.midiOutput.send([0xb0 + channel, 11, value]);
      this.lastMidiExpression.set(channel, value);
    } catch {
      // Browser mix remains active if hardware disappears mid-session.
    }
  }
}
