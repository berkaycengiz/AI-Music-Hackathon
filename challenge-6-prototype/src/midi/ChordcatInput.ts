export type ChordcatCalibrationStatus =
  | 'disconnected'
  | 'needs-calibration'
  | 'full-calibration'
  | 'ready-custom';

export interface ChordcatInputSnapshot {
  status: ChordcatCalibrationStatus;
  inputName: string;
  inputChannel: number | null;
  calibrationStep: number;
  lastSignature: string;
  lastCell: number | null;
  message: string;
}

const CHORD_WINDOW_MS = 24;
const DUPLICATE_WINDOW_MS = 180;
const CALIBRATION_STORAGE_KEY = 'museum-sonic-explorer.chordcat-calibration.v1';

interface StoredCalibration {
  version: 1 | 2;
  channel?: number;
  signatures: number[][];
}

function signatureKey(notes: readonly number[]): string {
  return [...new Set(notes)].sort((a, b) => a - b).join(',');
}

function isValidSignature(value: unknown): value is number[] {
  return Array.isArray(value)
    && value.length >= 3
    && value.length <= 8
    && value.every((note) => Number.isInteger(note) && note >= 0 && note <= 127);
}

function readStoredCalibration(): { signatures: number[][]; channel: number } | null {
  try {
    const raw = window.localStorage.getItem(CALIBRATION_STORAGE_KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Partial<StoredCalibration>;
    if (stored.version !== 1 && stored.version !== 2) return null;
    if (!Array.isArray(stored.signatures)) return null;
    if (stored.signatures.length !== 16 || !stored.signatures.every(isValidSignature)) return null;
    const channel = stored.version === 1 ? 1 : stored.channel;
    if (channel === undefined || !Number.isInteger(channel) || channel < 0 || channel > 15) return null;

    const signatures = stored.signatures.map((notes) => [...new Set(notes)].sort((a, b) => a - b));
    if (new Set(signatures.map(signatureKey)).size !== 16) return null;
    return { signatures, channel };
  } catch {
    return null;
  }
}

function writeStoredCalibration(signatures: readonly number[][], channel: number): boolean {
  try {
    const payload: StoredCalibration = {
      version: 2,
      channel,
      signatures: signatures.map((notes) => [...notes]),
    };
    window.localStorage.setItem(CALIBRATION_STORAGE_KEY, JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

/**
 * Turns CHORDCAT chord bursts into stable 1–16 cell selections.
 *
 * A completed 1–16 calibration is stored locally and restored on later page
 * loads or reconnects. The facilitator can overwrite it whenever the active
 * CHORDCAT project, key, transpose, or chord voicing changes.
 */
export class ChordcatInput {
  private input: any = null;
  private inputChannel: number | null = null;
  private pendingNotes: number[] = [];
  private pendingChannel: number | null = null;
  private chordTimer: number | null = null;
  private signatureMap = new Map<string, number>();
  private customSignatures: number[][] = [];
  private lastGestureKey = '';
  private lastGestureAt = 0;

  private snapshot: ChordcatInputSnapshot = {
    status: 'disconnected',
    inputName: 'No CHORDCAT input',
    inputChannel: null,
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
    this.inputChannel = null;
    this.lastGestureKey = '';
    this.lastGestureAt = 0;

    if (!input) {
      this.signatureMap.clear();
      this.update({
        status: 'disconnected',
        inputName: 'No CHORDCAT input',
        inputChannel: null,
        calibrationStep: 0,
        lastCell: null,
        message: 'Connect CHORDCAT to calibrate its sixteen keys.',
      });
      return;
    }

    input.onmidimessage = (event: any) => this.handleMidiMessage(event);
    const storedCalibration = readStoredCalibration();
    if (storedCalibration) {
      this.customSignatures = storedCalibration.signatures;
      this.inputChannel = storedCalibration.channel;
      this.signatureMap = new Map(
        storedCalibration.signatures.map((notes, index) => [signatureKey(notes), index + 1]),
      );
      this.update({
        status: 'ready-custom',
        inputName: input.name || 'CHORDCAT MIDI input',
        inputChannel: storedCalibration.channel + 1,
        calibrationStep: 16,
        lastSignature: '',
        lastCell: null,
        message: `Saved sixteen-key mapping loaded on MIDI Channel ${storedCalibration.channel + 1}. Recalibrate if the selected track changed.`,
      });
      return;
    }

    this.signatureMap.clear();
    this.update({
      status: 'needs-calibration',
      inputName: input.name || 'CHORDCAT MIDI input',
      inputChannel: null,
      calibrationStep: 0,
      lastSignature: '',
      lastCell: null,
      message: 'Calibrate all sixteen keys before the visitor begins.',
    });
  }

  beginFullCalibration(): void {
    if (!this.input) return;
    this.clearPendingChord();
    this.signatureMap.clear();
    this.customSignatures = [];
    this.inputChannel = null;
    this.lastGestureKey = '';
    this.lastGestureAt = 0;
    this.update({
      status: 'full-calibration',
      inputChannel: null,
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
    this.pendingChannel = null;
  }

  private handleMidiMessage(event: any): void {
    const data = event.data as Uint8Array | undefined;
    if (!data || data.length < 3) return;

    const command = data[0] & 0xf0;
    const channel = data[0] & 0x0f;
    const note = data[1];
    const velocity = data[2];

    // Ignore both Note Off messages and velocity-zero Note On releases.
    if (command !== 0x90 || velocity === 0) return;
    if (this.snapshot.status !== 'full-calibration' && this.snapshot.status !== 'ready-custom') return;
    if (this.inputChannel !== null && channel !== this.inputChannel) return;
    if (this.pendingChannel !== null && channel !== this.pendingChannel) return;
    this.pendingChannel = channel;
    this.pendingNotes.push(note);

    if (this.chordTimer === null) {
      this.chordTimer = window.setTimeout(() => this.flushChord(), CHORD_WINDOW_MS);
    }
  }

  private flushChord(): void {
    const signature = [...new Set(this.pendingNotes)].sort((a, b) => a - b);
    const channel = this.pendingChannel;
    this.chordTimer = null;
    this.pendingNotes = [];
    this.pendingChannel = null;
    if (signature.length < 3 || channel === null) return;

    const key = signatureKey(signature);
    const gestureKey = `${channel}:${key}`;
    const now = performance.now();
    if (gestureKey === this.lastGestureKey && now - this.lastGestureAt < DUPLICATE_WINDOW_MS) return;
    this.lastGestureKey = gestureKey;
    this.lastGestureAt = now;
    this.update({ lastSignature: key });

    if (this.snapshot.status === 'full-calibration') {
      if (this.inputChannel === null) {
        this.inputChannel = channel;
        this.update({ inputChannel: channel + 1 });
      }
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
    if (this.inputChannel === null) return;
    const saved = writeStoredCalibration(this.customSignatures, this.inputChannel);
    this.update({
      status: 'ready-custom',
      calibrationStep: 16,
      lastCell: null,
      message: saved
        ? 'All sixteen keys captured and saved in this browser.'
        : 'Mapping is ready for this session, but browser storage was unavailable.',
    });
  }

  private update(patch: Partial<ChordcatInputSnapshot>): void {
    this.snapshot = { ...this.snapshot, ...patch };
    this.onStateChange?.(this.state);
  }
}
