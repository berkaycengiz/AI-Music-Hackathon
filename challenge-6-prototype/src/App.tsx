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
    short: 'Experimental visual comparison. It does not send playable MIDI notes and remains silent with browser audio muted.',
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
  const [showFacilitator, setShowFacilitator] = useState(false);
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
    soundEngine.current.onMidiStateChange = () => setMidiVersion((version) => version + 1);
    await soundEngine.current.initialize();
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

  const activeRegion = interactionRegions.find((region) => region.id === activeRegionId) ?? null;
  const activeCellParts = activeRegion && experienceMode === 'region-chords'
    ? activeRegion.label.split(' · ')
    : null;

  return (
    <div className="app-shell">
      <header className="gallery-header">
        <span className="gallery-brand">Museum Sonic Explorer</span>
        <span className="gallery-header-note">A study in sound · No. {String(Object.keys(artworks).indexOf(selectedArtworkKey) + 1).padStart(2, '0')}</span>
        <button
          className="facilitator-toggle"
          aria-controls="facilitator-console"
          aria-expanded={showFacilitator}
          onClick={() => setShowFacilitator((visible) => !visible)}
        >
          {showFacilitator ? 'Close facilitator console' : 'Facilitator setup'}
        </button>
      </header>

      <main className={`app-main ${showFacilitator ? 'facilitator-open' : ''}`}>
        <section className="visitor-area" aria-label="Artwork exploration">
          <div className="visitor-intro">
            <span className="gallery-eyebrow">An accessible image experience</span>
            <h1>A painting <em>you can play.</em></h1>
            <p>Explore {ARTWORK_GRID_CELL_COUNT} areas of an artwork and hear them become variations of one musical piece.</p>
          </div>
          <div className="artwork-heading">
            <div>
              <span className="gallery-eyebrow">Now exploring</span>
              <h2>{currentArtwork.title}</h2>
            </div>
            <span className="artwork-count">
              {String(Object.keys(artworks).indexOf(selectedArtworkKey) + 1).padStart(2, '0')} / {String(Object.keys(artworks).length).padStart(2, '0')}
            </span>
          </div>
          <div className="artwork-frame">
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
          </div>

          <div className="exploration-bar">
            <div>
              <span className="gallery-eyebrow">The performance</span>
              <p className="exploration-state" aria-live="polite">
                {appState === 'exploring' ? 'Explore the painting' : 'Ready when you are'}
              </p>
            </div>
            <button className="start-btn" onClick={appState === 'exploring' ? handleStopAll : startExperience}>
              {appState === 'exploring' ? 'Stop exploration' : 'Begin exploration'}
            </button>
          </div>

          <div className="cell-story" aria-live="polite">
            <span className="cell-story-number">
              {activeCellParts?.[0] || '01 — 16'}
            </span>
            <div>
              <span className="gallery-eyebrow">{activeRegion ? 'Selected area' : 'Sixteen areas · one composition'}</span>
              <h3>{activeCellParts?.slice(1).join(' · ') || activeRegion?.label || 'Explore the artwork'}</h3>
              <p>{activeRegion?.semanticMotif?.visualMeaning || currentArtwork.moodDescription || 'Touch a cell on the instrument or move across the artwork to begin.'}</p>
            </div>
          </div>
          <p className="visitor-note">The mouse previews the same sixteen areas during development. Music is played by the connected instrument.</p>
        </section>

        {showFacilitator && <aside id="facilitator-console" className="debug-area" aria-label="Facilitator console">
          <div className="facilitator-controls">
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
            <span className="selector-label">Experience</span>
            <div className="mode-switch" role="group" aria-label="Musical interpretation">
              {(Object.keys(MODE_COPY) as ExperienceMode[]).map((mode) => (
                <button
                  key={mode}
                  className={`mode-button ${experienceMode === mode ? 'active' : ''}`}
                  aria-pressed={experienceMode === mode}
                  onClick={() => handleModeChange(mode)}
                >
                  {MODE_COPY[mode].label}
                </button>
              ))}
            </div>
            <p className="facilitator-mode-note">{MODE_COPY[experienceMode].short}</p>
            {appState === 'idle' && <p className="facilitator-mode-note">Begin exploration to request MIDI access and connect the instrument.</p>}
          </div>
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
            midiInputPorts={soundEngine.current.getMidiInputPorts()}
            midiInputId={soundEngine.current.midiInputId}
            midiStatusMessage={soundEngine.current.midiStatusMessage}
            chordcatInput={soundEngine.current.chordcatInputState}
            onSelectMidiPort={(id) => soundEngine.current.selectMidiPortById(id)}
            onSelectMidiInput={(id) => soundEngine.current.selectMidiInputById(id)}
            onRetryMidiAccess={() => { void soundEngine.current.retryMidiAccess(); }}
            onFullCalibration={() => soundEngine.current.beginFullChordcatCalibration()}
            onTestMidiNote={() => soundEngine.current.testMidiNote()}
            onTestTrack={(track) => soundEngine.current.testTrack(track)}
            isNarrationEnabled={isNarrationEnabled}
            onToggleNarration={() => setIsNarrationEnabled(narration.current.toggle())}
            isSpeaking={isSpeaking}
            activeVoiceName={narration.current.activeVoiceName}
            onStopAll={handleStopAll}
            onTriggerRegion={handleTriggerRegion}
          />
        </aside>}
      </main>
    </div>
  );
}
