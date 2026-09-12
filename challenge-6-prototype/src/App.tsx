import { useState, useRef, useCallback, useEffect } from 'react';
import type { Point, AppState, ArtworkDefinition } from './artwork/artworkTypes';
import type { PixelMetrics } from './artwork/pixelAnalysis';
import { findRegion } from './artwork/regionLookup';
import { RegionStateMachine } from './interaction/regionStateMachine';
import { ObjectSoundEngine } from './audio/ObjectSoundEngine';
import { SpeechNarration } from './audio/speechNarration';
import { ArtworkCanvas } from './components/ArtworkCanvas';
import { DebugPanel } from './components/DebugPanel';

// Built-in curated museum artworks with complete ChordCat 8-track scores
import { CURATED_ARTWORKS } from './artwork/fixtures';

export default function App() {
  // ── Artworks state (all 9 curated masterpieces) ────────────────
  const artworks = CURATED_ARTWORKS;
  const [selectedArtworkKey, setSelectedArtworkKey] = useState<string>('creation-of-adam');
  const currentArtwork = artworks[selectedArtworkKey] || CURATED_ARTWORKS['creation-of-adam'];

  // ── Application state ──────────────────────────────────────────
  const [appState, setAppState] = useState<AppState>('idle');
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [currentPixelMetrics, setCurrentPixelMetrics] = useState<PixelMetrics | null>(null);
  const [filterCutoff, setFilterCutoff] = useState<number>(2200);

  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [candidateRegionId, setCandidateRegionId] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<string>('INACTIVE');
  const [dwellMs, setDwellMs] = useState(0);
  const [playingSounds, setPlayingSounds] = useState<string[]>([]);

  // ── Speech Narration & MIDI state ──────────────────────────────
  const [isNarrationEnabled, setIsNarrationEnabled] = useState(true);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [, setMidiVersion] = useState(0);

  // ── Imperative systems refs ────────────────────────────────────
  const soundEngine = useRef(new ObjectSoundEngine());
  const narration = useRef(new SpeechNarration());
  const stateMachine = useRef(new RegionStateMachine());

  // ── Start experience (unlocks AudioContext & SpeechSynthesis) ──
  const startExperience = useCallback(async () => {
    await soundEngine.current.initialize();
    soundEngine.current.onMidiStateChange = () => setMidiVersion((v) => v + 1);
    setAppState('exploring');
  }, []);

  // ── Stop all sound & cancel speech ─────────────────────────────
  const handleStopAll = useCallback(() => {
    soundEngine.current.stopAll();
    narration.current.cancel();
    setIsSpeaking(false);
    stateMachine.current.reset();
    setActiveRegionId(null);
    setCandidateRegionId(null);
    setLifecycle('INACTIVE');
    setDwellMs(0);
    setPlayingSounds([]);
  }, []);

  // ── Switch artwork ─────────────────────────────────────────────
  const handleSwitchArtwork = useCallback(
    (key: string) => {
      handleStopAll();
      setSelectedArtworkKey(key);
    },
    [handleStopAll],
  );

  // ── Main loop: mouse + pixel analysis → filter modulation → region lookup → sound + narration ──
  const processInput = useCallback(
    (pos: Point | null, metrics?: PixelMetrics | null) => {
      setMousePos(pos);
      setCurrentPixelMetrics(metrics || null);

      if (appState !== 'exploring') return;

      // Real-time pixel brightness & warmth modulation of sound timbre
      if (metrics) {
        soundEngine.current.updateModulation(metrics.brightness, metrics.warmth);
        setFilterCutoff(soundEngine.current.cutoffHz);
      }

      const now = performance.now();

      // Find which region the pointer is in
      const hitRegion = pos
        ? findRegion(currentArtwork.regions, pos, stateMachine.current.activeRegionId)
        : null;

      // Update state machine
      const events = stateMachine.current.update(
        hitRegion?.id ?? null,
        now,
      );

      // Process events → trigger / release rich polyphonic chord voicings & English narration
      for (const event of events) {
        const region = currentArtwork.regions.find((r) => r.id === event.regionId);
        if (!region) continue;

        if (event.type === 'enter') {
          soundEngine.current.startRegionSound(region);

          // English Speech Narration for blind visitors
          if (region.spokenLabel) {
            narration.current.speak(
              region.spokenLabel,
              () => setIsSpeaking(true),
              () => setIsSpeaking(false),
            );
          }
        } else if (event.type === 'exit') {
          soundEngine.current.stopRegionSound(region.id, region.releaseMs);
        }
      }

      // Update display state
      setActiveRegionId(stateMachine.current.activeRegionId);
      setCandidateRegionId(stateMachine.current.currentRegionId);
      setLifecycle(stateMachine.current.lifecycle);
      setDwellMs(Math.round(stateMachine.current.dwellTime(now)));

      // Active playing regions list
      const activeIds: string[] = [];
      for (const region of currentArtwork.regions) {
        if (soundEngine.current.isPlaying(region.id)) {
          activeIds.push(region.label);
        }
      }
      setPlayingSounds(activeIds);
    },
    [appState, currentArtwork],
  );

  // ── Manual region trigger ──────────────────────────────────────
  const handleTriggerRegion = useCallback(
    (regionId: string) => {
      if (!soundEngine.current.isInitialized) return;

      const region = currentArtwork.regions.find((r) => r.id === regionId);
      if (!region) return;

      if (soundEngine.current.isPlaying(region.id)) {
        soundEngine.current.stopRegionSound(region.id, region.releaseMs);
        narration.current.cancel();
        setIsSpeaking(false);
      } else {
        soundEngine.current.stopAll();
        soundEngine.current.startRegionSound(region);

        if (region.spokenLabel) {
          narration.current.speak(
            region.spokenLabel,
            () => setIsSpeaking(true),
            () => setIsSpeaking(false),
          );
        }
      }

      setTimeout(() => {
        const activeIds: string[] = [];
        for (const r of currentArtwork.regions) {
          if (soundEngine.current.isPlaying(r.id)) {
            activeIds.push(r.label);
          }
        }
        setPlayingSounds(activeIds);
      }, 50);
    },
    [currentArtwork],
  );

  // ── Keyboard: Escape = stop all ────────────────────────────────
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleStopAll();
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleStopAll]);

  // ── Render ─────────────────────────────────────────────────────
  return (
    <div className="app-shell">
      {/* Header */}
      <header className="app-header">
        <div className="header-left">
          <h1 className="app-title">Museum Sonic Explorer</h1>
          <span className="app-badge">AlphaTheta ChordCat Engine</span>

          <div className="artwork-selector-wrap">
            <label htmlFor="artwork-select" className="selector-label">
              Artwork:
            </label>
            <select
              id="artwork-select"
              className="artwork-select"
              value={selectedArtworkKey}
              onChange={(e) => handleSwitchArtwork(e.target.value)}
            >
              {Object.entries(artworks).map(([key, item]) => (
                <option key={key} value={key}>
                  {item.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="header-right">
          <button
            className={`header-narration-btn ${isNarrationEnabled ? 'active' : 'muted'}`}
            onClick={() => {
              const next = narration.current.toggle();
              setIsNarrationEnabled(next);
            }}
            title="Toggle English voice narration for blind visitors"
          >
            {isNarrationEnabled ? '🔊 English Voice Guide' : '🔇 Voice Muted'}
          </button>

          <span className={`status-pill ${appState}`}>
            {appState === 'idle' && '● Idle'}
            {appState === 'exploring' && '● Exploring'}
          </span>
          {appState === 'exploring' && (
            <button className="header-stop-btn" onClick={handleStopAll}>
              ■ Stop Sound
            </button>
          )}
        </div>
      </header>

      {/* Main content */}
      <main className="app-main">
        {/* Start screen */}
        {appState === 'idle' && (
          <div className="start-overlay">
            <div className="start-card">
              <h2>Tactile Museum Explorer</h2>
              <p>Explore masterworks through touch, harmonious chords, and adaptive musical stems.</p>
              <p className="start-desc">
                {currentArtwork.moodDescription ||
                  'Each region triggers a dedicated track on the musical groovebox. As you move across bright or dark areas, the filter cutoff breathes dynamically.'}
              </p>
              <p className="start-meta">
                <strong>{currentArtwork.title}</strong> · {currentArtwork.regions.length} tracks ·{' '}
                {currentArtwork.keyRoot} {currentArtwork.scale} ({currentArtwork.tempo} BPM)
              </p>
              <button className="start-btn" onClick={startExperience}>
                Start Experience
              </button>
              <p className="start-hint">
                Press <kbd>Esc</kbd> to stop all sound / panic off
              </p>
            </div>
          </div>
        )}

        {/* Artwork canvas */}
        <div className="canvas-area">
          <ArtworkCanvas
            artwork={currentArtwork}
            activeRegionId={activeRegionId}
            candidateRegionId={candidateRegionId}
            mousePos={mousePos}
            onMouseMove={processInput}
            disabled={appState !== 'exploring'}
          />
        </div>

        {/* Debug / Facilitator panel */}
        <aside className="debug-area">
          <DebugPanel
            artwork={currentArtwork}
            mousePos={mousePos}
            activeRegionId={activeRegionId}
            lifecycle={lifecycle as any}
            dwellMs={dwellMs}
            playingSounds={playingSounds}
            pixelMetrics={currentPixelMetrics}
            cutoffHz={filterCutoff}
            midiDeviceName={soundEngine.current.midiDeviceName}
            isMidiConnected={soundEngine.current.isMidiConnected}
            midiPorts={soundEngine.current.getMidiPorts()}
            onSelectMidiPort={(id) => soundEngine.current.selectMidiPortById(id)}
            onTestTrack={(trackNum) => soundEngine.current.testTrack(trackNum)}
            isNarrationEnabled={isNarrationEnabled}
            onToggleNarration={() => {
              const next = narration.current.toggle();
              setIsNarrationEnabled(next);
            }}
            isSpeaking={isSpeaking}
            activeVoiceName={narration.current.activeVoiceName}
            onStopAll={handleStopAll}
            onTriggerRegion={handleTriggerRegion}
          />
        </aside>
      </main>
    </div>
  );
}
