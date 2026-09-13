import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  AppState,
  ExperienceMode,
  Point,
  RegionLifecycle,
  TrackMixState,
} from './artwork/artworkTypes';
import type { PixelMetrics } from './artwork/pixelAnalysis';
import { findRegion, polygonCenter } from './artwork/regionLookup';
import { RegionStateMachine } from './interaction/regionStateMachine';
import { ObjectSoundEngine } from './audio/ObjectSoundEngine';
import { SpeechNarration } from './audio/speechNarration';
import { ArtworkCanvas } from './components/ArtworkCanvas';
import { DebugPanel } from './components/DebugPanel';
import { CURATED_ARTWORKS } from './artwork/fixtures';
import {
  ARTWORK_GRID_CELL_COUNT,
  createGridRegions,
  gridCellCenter,
  pointToGridCell,
} from './artwork/gridMapping';

const MODE_COPY: Record<ExperienceMode, { label: string; short: string }> = {
  'region-chords': {
    label: '4×4 Melodies',
    short: 'Sixteen artwork cells perform spatial variations of its musical themes.',
  },
  'full-composition': {
    label: 'Full Composition',
    short: 'Distance from each musical center continuously blends every stem.',
  },
};

export default function App() {
  const artworks = CURATED_ARTWORKS;
  const [selectedArtworkKey, setSelectedArtworkKey] = useState('the-kiss');
  const currentArtwork = artworks[selectedArtworkKey] || CURATED_ARTWORKS['the-kiss'];
  const gridRegions = useMemo(() => createGridRegions(currentArtwork), [currentArtwork]);

  const [appState, setAppState] = useState<AppState>('idle');
  const [experienceMode, setExperienceMode] = useState<ExperienceMode>('region-chords');
  const [mousePos, setMousePos] = useState<Point | null>(null);
  const [currentPixelMetrics, setCurrentPixelMetrics] = useState<PixelMetrics | null>(null);
  const [filterCutoff, setFilterCutoff] = useState(2200);
  const [activeRegionId, setActiveRegionId] = useState<string | null>(null);
  const [candidateRegionId, setCandidateRegionId] = useState<string | null>(null);
  const [lifecycle, setLifecycle] = useState<RegionLifecycle>('INACTIVE');
  const [dwellMs, setDwellMs] = useState(0);
  const [playingSounds, setPlayingSounds] = useState<string[]>([]);
  const [trackMix, setTrackMix] = useState<TrackMixState[]>([]);
  const selectedGridCell = experienceMode === 'region-chords' && mousePos
    ? pointToGridCell(mousePos)
    : null;
  const interactionRegions = experienceMode === 'region-chords'
    ? gridRegions
    : currentArtwork.regions;
  const interactionArtwork = useMemo(
    () => ({ ...currentArtwork, regions: experienceMode === 'region-chords' ? gridRegions : currentArtwork.regions }),
    [currentArtwork, experienceMode, gridRegions],
  );

  const [isNarrationEnabled, setIsNarrationEnabled] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [, setMidiVersion] = useState(0);

  const soundEngine = useRef(new ObjectSoundEngine());
  const narration = useRef(new SpeechNarration());
  const stateMachine = useRef(new RegionStateMachine());
  const latestInput = useRef<{ pos: Point | null; metrics: PixelMetrics | null }>({
    pos: null,
    metrics: null,
  });

  const resetInteraction = useCallback(() => {
    stateMachine.current.reset();
    latestInput.current = { pos: null, metrics: null };
    setMousePos(null);
    setCurrentPixelMetrics(null);
    setActiveRegionId(null);
    setCandidateRegionId(null);
    setLifecycle('INACTIVE');
    setDwellMs(0);
    setPlayingSounds([]);
    setTrackMix([]);
  }, []);

  const cancelNarration = useCallback(() => {
    narration.current.cancel();
    soundEngine.current.setNarrationDucking(false);
    setIsSpeaking(false);
  }, []);

  const speakRegion = useCallback((text: string) => {
    narration.current.speak(
      text,
      () => {
        setIsSpeaking(true);
        soundEngine.current.setNarrationDucking(true);
      },
      () => {
        setIsSpeaking(false);
        soundEngine.current.setNarrationDucking(false);
      },
    );
  }, []);

  const startExperience = useCallback(async () => {
    await soundEngine.current.initialize();
    soundEngine.current.onMidiStateChange = () => setMidiVersion((version) => version + 1);
    setAppState('exploring');
  }, []);

  const handleStopAll = useCallback(() => {
    soundEngine.current.stopAll();
    cancelNarration();
    resetInteraction();
    setAppState('idle');
  }, [cancelNarration, resetInteraction]);

  const handleSwitchArtwork = useCallback((key: string) => {
    soundEngine.current.stopAll();
    cancelNarration();
    resetInteraction();
    setSelectedArtworkKey(key);
  }, [cancelNarration, resetInteraction]);

  const handleModeChange = useCallback((mode: ExperienceMode) => {
    if (mode === experienceMode) return;
    soundEngine.current.stopAll();
    cancelNarration();
    resetInteraction();
    setExperienceMode(mode);
  }, [cancelNarration, experienceMode, resetInteraction]);

  // Mode/artwork changes restart the sound architecture without leaving exploration.
  useEffect(() => {
    if (appState !== 'exploring' || !soundEngine.current.isInitialized) return;
    soundEngine.current.startMode(experienceMode, currentArtwork);
    setTrackMix(soundEngine.current.getTrackMixSnapshot());
    return () => soundEngine.current.stopAll();
  }, [appState, currentArtwork, experienceMode]);

  const handlePointerInput = useCallback((pos: Point | null, metrics?: PixelMetrics | null) => {
    const nextMetrics = metrics || null;
    latestInput.current = { pos, metrics: nextMetrics };
    setMousePos(pos);
    setCurrentPixelMetrics(nextMetrics);

    if (appState === 'exploring') {
      if (experienceMode === 'full-composition') soundEngine.current.setSpatialMix(pos);
      if (nextMetrics) {
        soundEngine.current.updateModulation(nextMetrics.brightness, nextMetrics.warmth);
        setFilterCutoff(soundEngine.current.cutoffHz);
      }
    }
  }, [appState, experienceMode]);

  const handleChordcatCell = useCallback((cell: number) => {
    if (appState !== 'exploring') return;
    handlePointerInput(gridCellCenter(cell), null);
  }, [appState, handlePointerInput]);

  useEffect(() => {
    soundEngine.current.onChordcatCell = handleChordcatCell;
    return () => {
      soundEngine.current.onChordcatCell = null;
    };
  }, [handleChordcatCell]);

  // A stable 30 Hz interaction clock lets dwell finish even when the mouse is still.
  useEffect(() => {
    if (appState !== 'exploring') return;

    const timer = window.setInterval(() => {
      const now = performance.now();
      const { pos } = latestInput.current;
      const hitRegion = pos
        ? experienceMode === 'region-chords'
          ? gridRegions[pointToGridCell(pos) - 1] ?? null
          : findRegion(currentArtwork.regions, pos, stateMachine.current.activeRegionId)
        : null;
      const events = stateMachine.current.update(hitRegion?.id ?? null, now);

      for (const event of events) {
        const region = interactionRegions.find((item) => item.id === event.regionId);
        if (!region) continue;

        if (event.type === 'enter') {
          if (experienceMode === 'region-chords') soundEngine.current.startRegionSound(region);
          if (region.spokenLabel) speakRegion(region.spokenLabel);
        } else if (experienceMode === 'region-chords') {
          soundEngine.current.stopRegionSound(region.id, region.releaseMs);
        }
      }

      const mix = soundEngine.current.getTrackMixSnapshot();
      setTrackMix(mix);
      setActiveRegionId(stateMachine.current.activeRegionId);
      setCandidateRegionId(stateMachine.current.currentRegionId);
      setLifecycle(stateMachine.current.lifecycle);
      setDwellMs(Math.round(stateMachine.current.dwellTime(now)));
      setPlayingSounds(
        experienceMode === 'full-composition'
          ? mix.filter((track) => track.state === 'focus').map((track) => track.label)
          : interactionRegions
              .filter((region) => soundEngine.current.isPlaying(region.id))
              .map((region) => region.label),
      );
    }, 33);

    return () => window.clearInterval(timer);
  }, [appState, currentArtwork, experienceMode, gridRegions, interactionRegions, speakRegion]);

  const handleTriggerRegion = useCallback((regionId: string) => {
    if (!soundEngine.current.isInitialized) return;
    const region = interactionRegions.find((item) => item.id === regionId);
    if (!region) return;

    if (experienceMode === 'full-composition') {
      const isFocused = soundEngine.current
        .getTrackMixSnapshot()
        .some((track) => track.regionId === region.id && track.state === 'focus');
      soundEngine.current.setSpatialMix(isFocused ? null : polygonCenter(region.polygon));
      const metrics = latestInput.current.metrics;
      if (!isFocused && metrics) {
        soundEngine.current.updateModulation(metrics.brightness, metrics.warmth);
      }
    } else if (soundEngine.current.isPlaying(region.id)) {
      soundEngine.current.stopRegionSound(region.id, region.releaseMs);
    } else {
      soundEngine.current.startRegionSound(region);
    }
    setTrackMix(soundEngine.current.getTrackMixSnapshot());
  }, [experienceMode, interactionRegions]);

  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleStopAll();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [handleStopAll]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="brand-block">
          <h1 className="app-title">Museum Sonic Explorer</h1>
          <span className="app-badge">CHORDCAT-ready</span>
        </div>

        <div className="header-center">
          <div className="artwork-selector-wrap">
            <label htmlFor="artwork-select" className="selector-label">Artwork</label>
            <select
              id="artwork-select"
              className="artwork-select"
              value={selectedArtworkKey}
              onChange={(event) => handleSwitchArtwork(event.target.value)}
            >
              {Object.entries(artworks).map(([key, artwork]) => (
                <option key={key} value={key}>{artwork.title}</option>
              ))}
            </select>
          </div>

          <div className="mode-switch" role="group" aria-label="Musical interpretation">
            {(Object.keys(MODE_COPY) as ExperienceMode[]).map((mode) => (
              <button
                key={mode}
                className={`mode-button ${experienceMode === mode ? 'active' : ''}`}
                aria-pressed={experienceMode === mode}
                onClick={() => handleModeChange(mode)}
              >
                <span className="mode-dot" />
                {MODE_COPY[mode].label}
              </button>
            ))}
          </div>
        </div>

        <div className="header-right">
          <button
            className={`header-narration-btn ${isNarrationEnabled ? 'active' : 'muted'}`}
            onClick={() => setIsNarrationEnabled(narration.current.toggle())}
            title="Toggle English voice narration"
          >
            {isNarrationEnabled ? 'Voice on' : 'Voice off'}
          </button>
          <span className={`status-pill ${appState}`}>
            {appState === 'idle' ? '● Ready' : '● Exploring'}
          </span>
          {appState === 'exploring' && (
            <button className="header-stop-btn" onClick={handleStopAll}>■ Stop</button>
          )}
        </div>
      </header>

      <div className="mode-story" aria-live="polite">
        <span className="mode-story-label">{MODE_COPY[experienceMode].label}</span>
        <span>{MODE_COPY[experienceMode].short}</span>
        {experienceMode === 'full-composition' && (
          <span className="transport-status">● {currentArtwork.tempo} BPM · continuous transport</span>
        )}
      </div>

      <main className="app-main">
        {appState === 'idle' && (
          <div className="start-overlay">
            <div className="start-card">
              <span className="eyebrow">Performative tactile exploration</span>
              <h2>Play the painting.</h2>
              <p>
                Move across the artwork to reveal its spatial story through narration,
                harmony and an adaptive instrumental mix.
              </p>
              <p className="start-desc">{currentArtwork.moodDescription}</p>
              <div className="start-meta-grid">
                <span>
                  <strong>{experienceMode === 'region-chords' ? ARTWORK_GRID_CELL_COUNT : currentArtwork.regions.length}</strong>
                  {experienceMode === 'region-chords' ? ' cells' : ' regions'}
                </span>
                <span><strong>{currentArtwork.keyRoot} {currentArtwork.scale}</strong> score</span>
                <span><strong>{currentArtwork.tempo}</strong> BPM</span>
              </div>
              <button className="start-btn" onClick={startExperience}>Begin exploration</button>
              <p className="start-hint">Mouse input currently simulates a fingertip on the tactile relief.</p>
            </div>
          </div>
        )}

        <div className="canvas-area">
          <ArtworkCanvas
            artwork={currentArtwork}
            mode={experienceMode}
            trackMix={trackMix}
            activeRegionId={activeRegionId}
            candidateRegionId={candidateRegionId}
            mousePos={mousePos}
            selectedGridCell={selectedGridCell}
            onMouseMove={handlePointerInput}
            disabled={appState !== 'exploring'}
          />
        </div>

        <aside className="debug-area">
          <DebugPanel
            artwork={interactionArtwork}
            mode={experienceMode}
            trackMix={trackMix}
            mousePos={mousePos}
            selectedGridCell={selectedGridCell}
            activeRegionId={activeRegionId}
            lifecycle={lifecycle}
            dwellMs={dwellMs}
            playingSounds={playingSounds}
            pixelMetrics={currentPixelMetrics}
            cutoffHz={filterCutoff}
            midiDeviceId={soundEngine.current.midiDeviceId}
            midiDeviceName={soundEngine.current.midiDeviceName}
            isMidiConnected={soundEngine.current.isMidiConnected}
            midiPorts={soundEngine.current.getMidiPorts()}
            chordcatInput={soundEngine.current.chordcatInputState}
            onSelectMidiPort={(id) => soundEngine.current.selectMidiPortById(id)}
            onFullCalibration={() => soundEngine.current.beginFullChordcatCalibration()}
            onTestTrack={(track) => soundEngine.current.testTrack(track)}
            isNarrationEnabled={isNarrationEnabled}
            onToggleNarration={() => setIsNarrationEnabled(narration.current.toggle())}
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
