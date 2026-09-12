import type { ArtworkRegion } from '../artwork/artworkTypes';

/** Converts MIDI note number to frequency in Hz */
function midiToFreq(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

interface ActiveVoice {
  oscillators: OscillatorNode[];
  gain: GainNode;
  stop: () => void;
}

/**
 * Polyphonic Cinematic Sound & Chord Engine.
 * 
 * Replaces synthetic arcade beeps with rich, multi-voice harmonic chord voicings,
 * gentle ambient texture beds, and real-time filter modulation.
 * Supports sending live MIDI directly to CHORDCAT (Channels 1-8) when plugged in!
 */
export class ObjectSoundEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private masterFilter: BiquadFilterNode | null = null;
  private ambientGain: GainNode | null = null;
  private ambientOscs: OscillatorNode[] = [];

  private activeRegionVoices: Map<string, ActiveVoice> = new Map();
  private arpeggioTimers: Map<string, number> = new Map();

  private initialized = false;
  private currentCutoff = 2200;

  // ── Web MIDI Hardware Output (CHORDCAT) ────────────────────────
  private midiOutput: any = null;
  private midiAccess: any = null;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    this.ctx = new AudioContext();

    // Master lowpass filter (modulated by pixel brightness)
    this.masterFilter = this.ctx.createBiquadFilter();
    this.masterFilter.type = 'lowpass';
    this.masterFilter.frequency.value = this.currentCutoff;
    this.masterFilter.Q.value = 1.2;

    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 0.65;

    // Ambient background bed gain
    this.ambientGain = this.ctx.createGain();
    this.ambientGain.gain.value = 0.08; // Subtle warm background

    this.ambientGain.connect(this.masterFilter);
    this.masterGain.connect(this.masterFilter);
    this.masterFilter.connect(this.ctx.destination);

    if (this.ctx.state === 'suspended') {
      await this.ctx.resume();
    }

    // Start warm background atmospheric drone
    this.startAmbientBed();

    // Attempt to connect to USB MIDI (ChordCat)
    this.initMidi();

    this.initialized = true;
  }

  get isInitialized(): boolean {
    return this.initialized;
  }

  get cutoffHz(): number {
    return this.currentCutoff;
  }

  get isMidiConnected(): boolean {
    return !!this.midiOutput;
  }

  get midiDeviceName(): string {
    return this.midiOutput?.name || 'Browser Synth (No MIDI hardware)';
  }

  // ── MIDI Hardware Discovery ────────────────────────────────────
  onMidiStateChange: (() => void) | null = null;

  getMidiPorts(): { id: string; name: string }[] {
    if (!this.midiAccess) return [];
    return Array.from(this.midiAccess.outputs.values()).map((o: any) => ({
      id: o.id,
      name: o.name || 'Unknown MIDI Output',
    }));
  }

  selectMidiPortById(id: string): void {
    if (!this.midiAccess) return;
    const found = this.midiAccess.outputs.get(id);
    if (found) {
      this.midiOutput = found;
      this.onMidiStateChange?.();
    }
  }

  private async initMidi(): Promise<void> {
    if (typeof navigator !== 'undefined' && 'requestMIDIAccess' in navigator) {
      try {
        const access = await (navigator as any).requestMIDIAccess();
        this.midiAccess = access;
        this.selectMidiPort();
        access.onstatechange = () => {
          this.selectMidiPort();
          this.onMidiStateChange?.();
        };
      } catch {
        console.info('MIDI access unavailable or permission denied — using browser polyphonic engine.');
      }
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
    // Prefer ChordCat / AlphaTheta if found
    const chordcat = outputs.find((o) =>
      (o.name || '').toLowerCase().includes('chordcat') ||
      (o.name || '').toLowerCase().includes('alphatheta'),
    );
    this.midiOutput = chordcat || outputs[0];
    this.onMidiStateChange?.();
  }

  /**
   * Diagnostic sound trigger for a specific ChordCat Track / Channel (1-8).
   * Tests both USB MIDI transmission and internal audio preview.
   */
  testTrack(trackNumber: number): void {
    const channel = Math.max(0, Math.min(7, trackNumber - 1));
    const testNotes = [50 + channel * 2, 57 + channel * 2, 62 + channel * 2];

    if (this.midiOutput) {
      try {
        this.midiOutput.send([0xb0 + channel, 123, 0]);
        testNotes.forEach((n) => this.midiOutput.send([0x90 + channel, n, 100]));
        setTimeout(() => {
          if (this.midiOutput) {
            testNotes.forEach((n) => this.midiOutput.send([0x80 + channel, n, 0]));
          }
        }, 550);
      } catch (err) {
        console.warn('MIDI test error:', err);
      }
    }

    const dummyRegion: ArtworkRegion = {
      id: `test-track-${trackNumber}`,
      label: `Track ${trackNumber} Test`,
      polygon: [],
      priority: 1,
      chordcatTrack: trackNumber,
      chordName: `Track ${trackNumber}`,
      midiNotes: testNotes,
      musicalRole: 'harmony',
      dynamicBehavior: 'sustained-chord',
      attackMs: 100,
      releaseMs: 300,
    };
    this.startRegionSound(dummyRegion);
    setTimeout(() => {
      this.stopRegionSound(dummyRegion.id, 300);
    }, 550);
  }

  // ── Ambient Background Bed (Warm Atmospheric Pad) ──────────────
  private startAmbientBed(): void {
    if (!this.ctx || !this.ambientGain) return;

    // A rich low fifth drone (D2 & A2 / 73.4Hz & 110Hz)
    const baseFreqs = [73.42, 110.0, 146.83];

    baseFreqs.forEach((freq, i) => {
      if (!this.ctx || !this.ambientGain) return;
      const osc = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc.type = i === 0 ? 'triangle' : 'sine';
      osc.frequency.value = freq;
      // Slight detune for warm chorus movement
      if (i > 0) osc.detune.value = (i - 1.5) * 4;

      oscGain.gain.value = 0.3 / (i + 1);

      osc.connect(oscGain);
      oscGain.connect(this.ambientGain);
      osc.start();
      this.ambientOscs.push(osc);
    });
  }

  // ── Trigger Region Chord & Musical Stem ─────────────────────────
  startRegionSound(region: ArtworkRegion): void {
    if (!this.ctx || !this.masterGain) return;

    this.stopRegionSound(region.id, 100);

    const notes = region.midiNotes && region.midiNotes.length > 0
      ? region.midiNotes
      : [60, 64, 67, 71]; // Fallback Cmaj7

    // 1. Play on hardware CHORDCAT via MIDI if connected
    this.sendMidiChord(region.chordcatTrack || 1, notes, 95);

    // 2. Play rich polyphonic sound inside browser
    const voice = this.createPolyphonicChordVoice(region, notes);
    this.activeRegionVoices.set(region.id, voice);
  }

  // ── Release Region Chord ───────────────────────────────────────
  stopRegionSound(regionId: string, releaseMs: number = 300): void {
    // Stop arpeggio timers if any
    const timer = this.arpeggioTimers.get(regionId);
    if (timer) {
      window.clearInterval(timer);
      this.arpeggioTimers.delete(regionId);
    }

    // Stop browser synth voice
    const voice = this.activeRegionVoices.get(regionId);
    if (voice && this.ctx) {
      const now = this.ctx.currentTime;
      voice.gain.gain.cancelScheduledValues(now);
      voice.gain.gain.setValueAtTime(voice.gain.gain.value, now);
      voice.gain.gain.linearRampToValueAtTime(0, now + releaseMs / 1000);

      setTimeout(() => {
        voice.stop();
        voice.gain.disconnect();
      }, releaseMs + 50);

      this.activeRegionVoices.delete(regionId);
    }
  }

  // ── Real-time Pixel Modulation (Brightness -> Filter Cutoff) ───
  updateModulation(brightness: number, warmth: number): void {
    if (!this.ctx || !this.masterFilter) return;

    // Logarithmic cutoff mapping: 350Hz (submerged dark) -> 6800Hz (sparkling bright)
    const minFreq = 350;
    const maxFreq = 6800;
    const targetFreq = minFreq * Math.pow(maxFreq / minFreq, Math.max(0, Math.min(1, brightness)));
    this.currentCutoff = Math.round(targetFreq);

    this.masterFilter.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.04);

    // Warmth slightly adjusts resonance
    const targetQ = 1.0 + (warmth + 1) * 0.7;
    this.masterFilter.Q.setTargetAtTime(targetQ, this.ctx.currentTime, 0.04);

    // Send MIDI CC 74 (Cutoff) to ChordCat hardware
    if (this.midiOutput) {
      const ccVal = Math.round(Math.max(0, Math.min(127, brightness * 127)));
      try {
        // Send to active channels 1-8
        for (let ch = 0; ch < 8; ch++) {
          this.midiOutput.send([0xb0 + ch, 74, ccVal]);
        }
      } catch {
        // ignore
      }
    }
  }

  // ── Stop All ───────────────────────────────────────────────────
  stopAll(): void {
    for (const [id] of this.activeRegionVoices) {
      this.stopRegionSound(id, 80);
    }
    this.activeRegionVoices.clear();

    for (const [, timer] of this.arpeggioTimers) {
      window.clearInterval(timer);
    }
    this.arpeggioTimers.clear();

    // Send MIDI All Notes Off + Panic (CC 120 / 123)
    if (this.midiOutput) {
      try {
        for (let ch = 0; ch < 8; ch++) {
          this.midiOutput.send([0xb0 + ch, 120, 0]); // All Sound Off
          this.midiOutput.send([0xb0 + ch, 123, 0]); // All Notes Off
        }
      } catch {
        // ignore
      }
    }
  }

  isPlaying(regionId: string): boolean {
    return this.activeRegionVoices.has(regionId);
  }

  // ── Browser Synth Polyphonic Voicing ───────────────────────────
  private createPolyphonicChordVoice(
    region: ArtworkRegion,
    midiNotes: number[],
  ): ActiveVoice {
    const ctx = this.ctx!;
    const voiceGain = ctx.createGain();
    const now = ctx.currentTime;
    const attackTime = (region.attackMs || 220) / 1000;

    voiceGain.gain.setValueAtTime(0, now);
    voiceGain.gain.linearRampToValueAtTime(0.55, now + attackTime);
    voiceGain.connect(this.masterGain!);

    const oscillators: OscillatorNode[] = [];

    // Handle arpeggios vs sustained chords
    if (region.dynamicBehavior === 'arpeggio') {
      let step = 0;
      const playStep = () => {
        if (!this.activeRegionVoices.has(region.id)) return;
        const note = midiNotes[step % midiNotes.length];
        step++;

        const osc = ctx.createOscillator();
        const noteGain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.value = midiToFreq(note);

        noteGain.gain.setValueAtTime(0, ctx.currentTime);
        noteGain.gain.linearRampToValueAtTime(0.35, ctx.currentTime + 0.03);
        noteGain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);

        osc.connect(noteGain);
        noteGain.connect(voiceGain);
        osc.start();
        osc.stop(ctx.currentTime + 0.55);
      };

      playStep();
      const timer = window.setInterval(playStep, 240);
      this.arpeggioTimers.set(region.id, timer);
    } else {
      // Sustained lush pad: spawn detuned dual oscillators per chord note
      midiNotes.forEach((note, index) => {
        const freq = midiToFreq(note);

        // Primary oscillator (warm saw / triangle)
        const osc1 = ctx.createOscillator();
        osc1.type = region.musicalRole === 'bass' ? 'sine' : 'triangle';
        osc1.frequency.value = freq;

        // Subtle sub-oscillator for warmth and richness
        const osc2 = ctx.createOscillator();
        osc2.type = 'sine';
        osc2.frequency.value = freq * 0.998; // slight detune chorus

        const noteMixGain = ctx.createGain();
        // Slightly reduce upper note loudness for balanced voicing
        noteMixGain.gain.value = 0.25 / Math.sqrt(index + 1);

        osc1.connect(noteMixGain);
        osc2.connect(noteMixGain);
        noteMixGain.connect(voiceGain);

        osc1.start();
        osc2.start();

        oscillators.push(osc1, osc2);
      });
    }

    return {
      oscillators,
      gain: voiceGain,
      stop: () => {
        oscillators.forEach((o) => {
          try { o.stop(); } catch { /* ignore */ }
        });
      },
    };
  }

  // ── Hardware MIDI Sender ───────────────────────────────────────
  private sendMidiChord(trackNumber: number, notes: number[], velocity: number): void {
    if (!this.midiOutput) return;
    const channel = Math.max(0, Math.min(7, trackNumber - 1)); // 0-7 for tracks 1-8

    try {
      // First silence previous notes on this track
      this.midiOutput.send([0xb0 + channel, 123, 0]);

      // Sound each note in the chord
      notes.forEach((note) => {
        this.midiOutput.send([0x90 + channel, note, velocity]);
      });
    } catch (err) {
      console.warn('MIDI send error:', err);
    }
  }
}
