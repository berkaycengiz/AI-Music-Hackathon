/**
 * English Speech Synthesis Narration Service for Visually Impaired Visitors.
 * Speaks the tactile audio descriptions using Web Speech API with an English voice.
 */
export class SpeechNarration {
  private synth: SpeechSynthesis | null = null;
  private voice: SpeechSynthesisVoice | null = null;
  private enabled = false;
  private isSpeaking = false;

  constructor() {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      this.synth = window.speechSynthesis;
      this.loadVoices();
      if (this.synth.onvoiceschanged !== undefined) {
        this.synth.onvoiceschanged = () => this.loadVoices();
      }
    }
  }

  private loadVoices(): void {
    if (!this.synth) return;
    const voices = this.synth.getVoices();

    // Prefer high-quality English natural voices (en-US or en-GB)
    const preferredEnglish = voices.find(
      (v) =>
        (v.lang.startsWith('en') || v.lang.includes('en_')) &&
        (v.name.includes('Natural') ||
          v.name.includes('Google') ||
          v.name.includes('Samantha') ||
          v.name.includes('Daniel') ||
          v.name.includes('Serena')),
    );

    const genericEnglish = voices.find(
      (v) => v.lang.startsWith('en') || v.lang.includes('en_'),
    );

    this.voice = preferredEnglish || genericEnglish || voices[0] || null;
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  setEnabled(val: boolean): void {
    this.enabled = val;
    if (!val) {
      this.cancel();
    }
  }

  toggle(): boolean {
    this.setEnabled(!this.enabled);
    return this.enabled;
  }

  get isCurrentlySpeaking(): boolean {
    return this.isSpeaking;
  }

  get activeVoiceName(): string {
    return this.voice ? `${this.voice.name} (${this.voice.lang})` : 'Default English Voice';
  }

  /**
   * Speak a tactile audio description in English.
   * Cancels any currently ongoing speech so cues don't lag or pile up.
   */
  speak(text: string, onStart?: () => void, onEnd?: () => void): void {
    if (!this.synth || !this.enabled || !text) return;

    // Immediately cancel prior speech when user moves to a new region
    this.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.voice) {
      utterance.voice = this.voice;
    }
    utterance.lang = 'en-US';
    utterance.rate = 0.94; // Calm, measured museum docent pace
    utterance.pitch = 1.0;
    utterance.volume = 0.85;

    utterance.onstart = () => {
      this.isSpeaking = true;
      onStart?.();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      onEnd?.();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      onEnd?.();
    };

    this.synth.speak(utterance);
  }

  cancel(): void {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
    }
  }
}
