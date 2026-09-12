import type { Point, ArtworkRegion, RegionLifecycle, ArtworkDefinition } from '../artwork/artworkTypes';
import type { PixelMetrics } from '../artwork/pixelAnalysis';

interface Props {
  artwork: ArtworkDefinition;
  mousePos: Point | null;
  activeRegionId: string | null;
  lifecycle: RegionLifecycle;
  dwellMs: number;
  playingSounds: string[];
  pixelMetrics?: PixelMetrics | null;
  cutoffHz?: number;

  // ── MIDI Hardware ─────────────────────────────────────────────
  midiDeviceName?: string;
  isMidiConnected?: boolean;
  midiPorts?: { id: string; name: string }[];
  onSelectMidiPort?: (id: string) => void;
  onTestTrack?: (trackNum: number) => void;

  // ── English Narration (TTS) ───────────────────────────────────
  isNarrationEnabled: boolean;
  onToggleNarration: () => void;
  isSpeaking: boolean;
  activeVoiceName?: string;

  // ── Controls ──────────────────────────────────────────────────
  onStopAll: () => void;
  onTriggerRegion: (regionId: string) => void;
}

export function DebugPanel({
  artwork,
  mousePos,
  activeRegionId,
  lifecycle,
  dwellMs,
  pixelMetrics,
  cutoffHz,
  midiDeviceName,
  isMidiConnected,
  midiPorts = [],
  onSelectMidiPort,
  onTestTrack,
  isNarrationEnabled,
  onToggleNarration,
  isSpeaking,
  activeVoiceName,
  onStopAll,
  onTriggerRegion,
}: Props) {
  const activeRegion = activeRegionId
    ? artwork.regions.find((r) => r.id === activeRegionId) ?? null
    : null;

  return (
    <div className="debug-panel">
      {/* Stop All - always visible and prominent */}
      <button className="stop-all-btn" onClick={onStopAll}>
        ■ Stop All Sound / All Notes Off
      </button>

      {/* English Speech Narration (TTS) Control */}
      <section className="debug-section narration-control-card">
        <div className="narration-header">
          <h3>Voice Guide (English)</h3>
          <button
            className={`narration-toggle-btn ${isNarrationEnabled ? 'active' : 'muted'}`}
            onClick={onToggleNarration}
            title="Toggle English spoken audio descriptions for blind visitors"
          >
            {isNarrationEnabled ? '🔊 Active' : '🔇 Muted'}
          </button>
        </div>
        <div className="debug-grid" style={{ marginTop: '6px' }}>
          <span className="debug-label">Status</span>
          <span
            className="debug-value"
            style={{ color: isSpeaking ? '#72ead7' : '#a0a8be' }}
          >
            {isSpeaking ? '● Speaking now...' : isNarrationEnabled ? 'Ready (en-US)' : 'Narration muted'}
          </span>
          <span className="debug-label">Voice</span>
          <span className="debug-value" style={{ fontSize: '11px', color: '#a0a8be' }}>
            {activeVoiceName || 'Default System English'}
          </span>
        </div>
      </section>

      {/* MIDI Hardware & ChordCat Channels */}
      <section className="debug-section midi-manager-card">
        <h3>MIDI Hardware</h3>
        <div className="debug-grid">
          <span className="debug-label">Status</span>
          <span
            className="debug-value"
            style={{
              color: isMidiConnected ? '#72ead7' : '#f39c12',
              fontWeight: 700,
            }}
          >
            {isMidiConnected ? '● Connected' : '○ Emulated (No USB device)'}
          </span>
          <span className="debug-label">Port</span>
          <span className="debug-value" style={{ fontSize: '11px' }}>
            {midiPorts.length > 1 ? (
              <select
                className="midi-port-select"
                value={midiDeviceName}
                onChange={(e) => onSelectMidiPort?.(e.target.value)}
              >
                {midiPorts.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            ) : (
              midiDeviceName || 'Browser PolySynth'
            )}
          </span>
        </div>

        {/* 8-Track Diagnostic Quick-Test Pads */}
        <div className="track-pads-title">Test ChordCat Tracks (1-8):</div>
        <div className="track-pads-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((trackNum) => {
            const assignedRegion = artwork.regions.find((r) => r.chordcatTrack === trackNum);
            return (
              <button
                key={trackNum}
                className={`track-pad-btn ${assignedRegion ? 'has-region' : ''} ${
                  activeRegion?.chordcatTrack === trackNum ? 'playing' : ''
                }`}
                style={{
                  borderColor: assignedRegion?.color,
                }}
                onClick={() => onTestTrack?.(trackNum)}
                title={
                  assignedRegion
                    ? `Track ${trackNum}: ${assignedRegion.label} (${assignedRegion.chordName})`
                    : `Track ${trackNum} (Unassigned)`
                }
              >
                <span className="pad-track-num">T{trackNum}</span>
                <span className="pad-chord-name">{assignedRegion ? assignedRegion.chordName : '—'}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Active Region ChordCat Score */}
      <section className="debug-section">
        <h3>ChordCat Score</h3>
        <div className="debug-grid">
          <span className="debug-label">Track</span>
          <span className="debug-value" style={{ color: '#efff78', fontWeight: 700 }}>
            {activeRegion ? `Track ${activeRegion.chordcatTrack} (Ch ${activeRegion.chordcatTrack})` : '—'}
          </span>
          <span className="debug-label">Chord</span>
          <span className="debug-value" style={{ color: '#72ead7', fontWeight: 700, fontSize: '13px' }}>
            {activeRegion?.chordName ?? '—'}
          </span>
          <span className="debug-label">Role</span>
          <span className="debug-value" style={{ textTransform: 'capitalize' }}>
            {activeRegion?.musicalRole ?? '—'}
          </span>
          <span className="debug-label">Dynamic</span>
          <span className="debug-value" style={{ textTransform: 'capitalize' }}>
            {activeRegion?.dynamicBehavior ?? '—'}
          </span>
          <span className="debug-label">Timbre</span>
          <span className="debug-value" style={{ fontSize: '11px', color: '#a0a8be' }}>
            {activeRegion?.timbreDescription ?? '—'}
          </span>
        </div>
      </section>

      {/* Real-time Pixel & Timbre Modulation */}
      <section className="debug-section">
        <h3>Pixel & Timbre</h3>
        <div className="debug-grid">
          <span className="debug-label">Color</span>
          <span className="debug-value" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {pixelMetrics ? (
              <>
                <span
                  style={{
                    display: 'inline-block',
                    width: '12px',
                    height: '12px',
                    borderRadius: '3px',
                    backgroundColor: pixelMetrics.hex,
                    border: '1px solid rgba(255,255,255,0.2)',
                  }}
                />
                {pixelMetrics.hex}
              </>
            ) : (
              '—'
            )}
          </span>

          <span className="debug-label">Brightness</span>
          <span className="debug-value">
            {pixelMetrics ? `${Math.round(pixelMetrics.brightness * 100)}%` : '—'}
          </span>

          <span className="debug-label">Cutoff (CC74)</span>
          <span className="debug-value" style={{ color: '#72ead7', fontWeight: 600 }}>
            {cutoffHz ? `${cutoffHz} Hz` : '—'}
          </span>
        </div>

        {pixelMetrics && (
          <div className="brightness-meter">
            <div
              className="brightness-meter-fill"
              style={{ width: `${Math.round(pixelMetrics.brightness * 100)}%` }}
            />
          </div>
        )}
      </section>

      {/* Region State & Tactile Audio Description */}
      <section className="debug-section">
        <h3>Region & Description</h3>
        <div className="debug-grid">
          <span className="debug-label">Active</span>
          <span className="debug-value" style={{ color: activeRegion?.color, fontWeight: 600 }}>
            {activeRegion?.label ?? '—'}
          </span>
          <span className="debug-label">State</span>
          <span className={`debug-value lifecycle-${lifecycle.toLowerCase()}`}>
            {lifecycle}
          </span>
          <span className="debug-label">Dwell</span>
          <span className="debug-value">
            {lifecycle !== 'INACTIVE' ? `${dwellMs}ms` : '—'}
          </span>
        </div>
        {activeRegion?.spokenLabel && (
          <div className="spoken-cue-box">
            <span className="spoken-cue-tag">Audio Description</span>
            <p className="spoken-cue-text">"{activeRegion.spokenLabel}"</p>
          </div>
        )}
      </section>

      {/* Artwork Info */}
      <section className="debug-section">
        <h3>Artwork Score</h3>
        <div className="debug-grid">
          <span className="debug-label">Title</span>
          <span className="debug-value">{artwork.title}</span>
          <span className="debug-label">Key/Scale</span>
          <span className="debug-value">{artwork.keyRoot} {artwork.scale}</span>
          <span className="debug-label">Tempo</span>
          <span className="debug-value">{artwork.tempo} BPM</span>
        </div>
      </section>
    </div>
  );
}
