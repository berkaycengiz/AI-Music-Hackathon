import type {
  ArtworkDefinition,
  ExperienceMode,
  Point,
  RegionLifecycle,
  TrackMixState,
} from '../artwork/artworkTypes';
import type { PixelMetrics } from '../artwork/pixelAnalysis';

interface Props {
  artwork: ArtworkDefinition;
  mode: ExperienceMode;
  trackMix: TrackMixState[];
  mousePos: Point | null;
  activeRegionId: string | null;
  lifecycle: RegionLifecycle;
  dwellMs: number;
  playingSounds: string[];
  pixelMetrics?: PixelMetrics | null;
  cutoffHz?: number;
  midiDeviceId?: string;
  midiDeviceName?: string;
  isMidiConnected?: boolean;
  midiPorts?: { id: string; name: string }[];
  onSelectMidiPort?: (id: string) => void;
  onTestTrack?: (trackNum: number) => void;
  isNarrationEnabled: boolean;
  onToggleNarration: () => void;
  isSpeaking: boolean;
  activeVoiceName?: string;
  onStopAll: () => void;
  onTriggerRegion: (regionId: string) => void;
}

export function DebugPanel({
  artwork,
  mode,
  trackMix,
  mousePos,
  activeRegionId,
  lifecycle,
  dwellMs,
  playingSounds,
  pixelMetrics,
  cutoffHz,
  midiDeviceId,
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
    ? artwork.regions.find((region) => region.id === activeRegionId) ?? null
    : null;

  return (
    <div className="debug-panel">
      <div className="panel-heading">
        <div>
          <span className="eyebrow">Facilitator console</span>
          <h2>Live system</h2>
        </div>
        <span className="panel-live">● LIVE</span>
      </div>

      <button className="stop-all-btn" onClick={onStopAll}>
        ■ Stop all sound
        <span>ESC · MIDI panic</span>
      </button>

      <section className="debug-section mix-section">
        <div className="section-title-row">
          <h3>{mode === 'full-composition' ? 'Live stem mix' : 'Region performance'}</h3>
          <span className="micro-badge">{mode === 'full-composition' ? 'CC11 PROTOTYPE' : 'NOTE MODE'}</span>
        </div>

        {mode === 'full-composition' ? (
          <div className="mix-list">
            {trackMix.map((track) => (
              <button
                key={track.regionId}
                className={`mix-track ${track.state}`}
                onClick={() => onTriggerRegion(track.regionId)}
                title={`Preview ${track.label}`}
              >
                <div className="mix-track-copy">
                  <span className="mix-track-number">T{track.track}</span>
                  <span className="mix-track-name">{track.label}</span>
                  <span className="mix-track-level">{Math.round(track.level * 100)}%</span>
                </div>
                <div className="mix-meter">
                  <span style={{ width: `${track.level * 100}%` }} />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="region-performance-card">
            <strong>{activeRegion?.chordName || 'Waiting for a region'}</strong>
            <span>{activeRegion?.timbreDescription || 'Move across the artwork to perform its harmonic regions.'}</span>
            <div className="debug-sound-list">
              {playingSounds.length === 0 && <span className="sound-pill">No active voice</span>}
              {playingSounds.map((label) => <span className="sound-pill active" key={label}>{label}</span>)}
            </div>
          </div>
        )}
      </section>

      <section className="debug-section">
        <h3>Exploration signal</h3>
        <div className="debug-grid">
          <span className="debug-label">Pointer</span>
          <span className="debug-value">
            {mousePos ? `${mousePos.x.toFixed(3)}, ${mousePos.y.toFixed(3)}` : '—'}
          </span>
          <span className="debug-label">{mode === 'full-composition' ? 'Narration' : 'Region'}</span>
          <span className="debug-value" style={{ color: activeRegion?.color }}>
            {activeRegion?.label || '—'}
          </span>
          <span className="debug-label">State</span>
          <span className={`debug-value lifecycle-${lifecycle.toLowerCase()}`}>{lifecycle}</span>
          <span className="debug-label">Dwell</span>
          <span className="debug-value">{lifecycle === 'INACTIVE' ? '—' : `${dwellMs} ms`}</span>
        </div>
      </section>

      <section className="debug-section">
        <h3>Color → timbre</h3>
        <div className="debug-grid">
          <span className="debug-label">Sample</span>
          <span className="debug-value color-readout">
            {pixelMetrics && <span className="color-swatch" style={{ background: pixelMetrics.hex }} />}
            {pixelMetrics?.hex || '—'}
          </span>
          <span className="debug-label">Luminance</span>
          <span className="debug-value">{pixelMetrics ? `${Math.round(pixelMetrics.brightness * 100)}%` : '—'}</span>
          <span className="debug-label">Filter</span>
          <span className="debug-value accent-value">{cutoffHz ? `${cutoffHz} Hz` : '—'}</span>
        </div>
        <div className="brightness-meter">
          <span style={{ width: `${(pixelMetrics?.brightness || 0) * 100}%` }} />
        </div>
      </section>

      <section className="debug-section">
        <div className="section-title-row">
          <h3>Semantic narration</h3>
          <button
            className={`narration-toggle-btn ${isNarrationEnabled ? 'active' : ''}`}
            onClick={onToggleNarration}
          >
            {isNarrationEnabled ? 'Voice on' : 'Voice off'}
          </button>
        </div>
        <div className="voice-status">
          <span className={isSpeaking ? 'speaking-dot active' : 'speaking-dot'} />
          <div>
            <strong>{isSpeaking ? 'Speaking now' : isNarrationEnabled ? 'Ready' : 'Muted'}</strong>
            <span>{activeVoiceName || 'Default system English voice'}</span>
          </div>
        </div>
        {activeRegion?.spokenLabel && (
          <p className="spoken-cue-text">“{activeRegion.spokenLabel}”</p>
        )}
      </section>

      <section className="debug-section midi-manager-card">
        <div className="section-title-row">
          <h3>CHORDCAT bridge</h3>
          <span className={`micro-badge ${isMidiConnected ? 'connected' : ''}`}>
            {isMidiConnected ? 'CONNECTED' : 'EMULATED'}
          </span>
        </div>
        <div className="debug-grid">
          <span className="debug-label">Output</span>
          <span className="debug-value">
            {midiPorts.length > 1 ? (
              <select
                className="midi-port-select"
                value={midiDeviceId}
                onChange={(event) => onSelectMidiPort?.(event.target.value)}
              >
                {midiPorts.map((port) => <option key={port.id} value={port.id}>{port.name}</option>)}
              </select>
            ) : midiDeviceName}
          </span>
          <span className="debug-label">Protocol</span>
          <span className="debug-value">8ch · Note · CC11 · CC74</span>
        </div>
        <div className="track-pads-grid">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((trackNumber) => {
            const region = artwork.regions.find((item) => item.chordcatTrack === trackNumber);
            return (
              <button
                key={trackNumber}
                className={`track-pad-btn ${region ? 'has-region' : ''}`}
                style={{ borderColor: region?.color }}
                onClick={() => onTestTrack?.(trackNumber)}
                title={region ? `${region.label}: ${region.chordName}` : `Unassigned track ${trackNumber}`}
              >
                <span className="pad-track-num">T{trackNumber}</span>
                <span className="pad-chord-name">{region?.chordName || '—'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="artwork-score-card">
        <span className="eyebrow">Current score</span>
        <strong>{artwork.title}</strong>
        <span>{artwork.keyRoot} {artwork.scale} · {artwork.tempo} BPM · {artwork.regions.length} stems</span>
      </section>
    </div>
  );
}
