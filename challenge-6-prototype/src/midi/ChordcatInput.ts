export type ChordcatCalibrationStatus =
  | 'disconnected'
  | 'needs-calibration'
  | 'full-calibration'
  | 'ready-custom';

export interface ChordcatInputSnapshot {
  status: ChordcatCalibrationStatus;
  inputName: string;
  calibrationStep: number;
  lastSignature: string;
  lastCell: number | null;
  message: string;
}

const INPUT_CHANNEL = 1; // Zero-based MIDI channel 2 from the hardware capture.
const CHORD_WINDOW_MS = 24;
const DUPLICATE_WINDOW_MS = 180;

function signatureKey(notes: readonly number[]): string {
  return [...new Set(notes)].sort((a, b) => a - b).join(',');
}

/**
 * Turns CHORDCAT chord bursts into stable 1–16 cell selections.
 *
 * Every connection starts with a guided 1–16 calibration so the mapping does
 * not depend on the active CHORDCAT project, key, transpose, or chord voicing.
 */
export class ChordcatInput {
  private input: any = null;
  private pendingNotes: number[] = [];
  private chordTimer: number | null = null;
  private signatureMap = new Map<string, number>();
  private customSignatures: number[][] = [];
  private lastGestureKey = '';
  private lastGestureAt = 0;

  private snapshot: ChordcatInputSnapshot = {
    status: 'disconnected',
    inputName: 'No CHORDCAT input',
    calibrationStep: 0,
    lastSignature: '',
    lastCell: null,
    message: 'Connect CHORDCAT to calibrate its sixteen keys.',
  };

  onCell: ((cell: number) => void) | null = null;
  onStateChange: ((snapshot: ChordcatInputSnapshot) => void) | null = null;

  get state(): ChordcatInputSnapshot {
    return { ...this.snapshot };
  }

  connect(input: any | null): void {
    if (this.input === input) return;
    this.detachInput();
    this.input = input;
    this.lastGestureKey = '';
    this.lastGestureAt = 0;

    if (!input) {
      this.signatureMap.clear();
      this.update({
        status: 'disconnected',
        inputName: 'No CHORDCAT input',
        calibrationStep: 0,
        lastCell: null,
        message: 'Connect CHORDCAT to calibrate its sixteen keys.',
      });
      return;
    }

    input.onmidimessage = (event: any) => this.handleMidiMessage(event);
    this.signatureMap.clear();
    this.update({
      status: 'needs-calibration',
      inputName: input.name || 'CHORDCAT MIDI input',
      calibrationStep: 0,
      lastSignature: '',
      lastCell: null,
      message: 'Run quick calibration before the visitor begins.',
    });
  }

  beginFullCalibration(): void {
    if (!this.input) return;
    this.clearPendingChord();
    this.signatureMap.clear();
    this.customSignatures = [];
    this.lastGestureKey = '';
    this.lastGestureAt = 0;
    this.update({
      status: 'full-calibration',
      calibrationStep: 1,
      lastCell: null,
      message: 'Press key 1 of 16 (top-left), then follow the grid in reading order.',
    });
  }

  disconnect(): void {
    this.detachInput();
    this.input = null;
  }

  private detachInput(): void {
    this.clearPendingChord();
    if (this.input) this.input.onmidimessage = null;
  }

  private clearPendingChord(): void {
    if (this.chordTimer !== null) window.clearTimeout(this.chordTimer);
    this.chordTimer = null;
    this.pendingNotes = [];
  }

  private handleMidiMessage(event: any): void {
    const data = event.data as Uint8Array | undefined;
    if (!data || data.length < 3) return;

    const command = data[0] & 0xf0;
    const channel = data[0] & 0x0f;
    const note = data[1];
    const velocity = data[2];

    // CHORDCAT sends releases as Note On with velocity zero.
    if (command !== 0x90 || channel !== INPUT_CHANNEL || velocity === 0) return;
    this.pendingNotes.push(note);

    if (this.chordTimer === null) {
      this.chordTimer = window.setTimeout(() => this.flushChord(), CHORD_WINDOW_MS);
    }
  }

  private flushChord(): void {
    const signature = [...new Set(this.pendingNotes)].sort((a, b) => a - b);
    this.chordTimer = null;
    this.pendingNotes = [];
    if (signature.length < 4) return;

    const key = signatureKey(signature);
    const now = performance.now();
    if (key === this.lastGestureKey && now - this.lastGestureAt < DUPLICATE_WINDOW_MS) return;
    this.lastGestureKey = key;
    this.lastGestureAt = now;
    this.update({ lastSignature: key });

    if (this.snapshot.status === 'full-calibration') {
      this.captureCalibrationKey(signature);
      return;
    }

    if (this.snapshot.status !== 'ready-custom') return;
    const cell = this.signatureMap.get(key);
    if (!cell) {
      this.update({
        lastCell: null,
        message: 'Unknown chord ignored. Recalibrate if this repeats.',
      });
      return;
    }

    this.update({ lastCell: cell, message: `Cell ${cell} selected.` });
    this.onCell?.(cell);
  }

  private captureCalibrationKey(signature: number[]): void {
    const key = signatureKey(signature);
    const duplicateAt = this.customSignatures.findIndex((item) => signatureKey(item) === key);
    if (duplicateAt >= 0) {
      this.update({
        message: `That chord already belongs to key ${duplicateAt + 1}. Press key ${this.customSignatures.length + 1} again.`,
      });
      return;
    }

    this.customSignatures.push(signature);
    const captured = this.customSignatures.length;
    if (captured < 16) {
      this.update({
        calibrationStep: captured + 1,
        message: `Key ${captured} captured. Now press key ${captured + 1} of 16.`,
      });
      return;
    }

    this.signatureMap = new Map(
      this.customSignatures.map((notes, index) => [signatureKey(notes), index + 1]),
    );
    this.update({
      status: 'ready-custom',
      calibrationStep: 16,
      lastCell: null,
      message: 'All sixteen keys captured. Custom mapping is ready.',
    });
  }

  private update(patch: Partial<ChordcatInputSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onStateChange?.(this.state);
  }
}
