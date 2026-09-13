import { useRef, useEffect, useCallback, useReducer, useState, type MouseEvent } from 'react';
import type {
  Point,
  ArtworkDefinition,
  ExperienceMode,
  TrackMixState,
} from '../artwork/artworkTypes';
import { polygonCenter } from '../artwork/regionLookup';
import { samplePixelMetrics, type PixelMetrics } from '../artwork/pixelAnalysis';
import { ARTWORK_GRID_SIZE } from '../artwork/gridMapping';

interface Props {
  artwork: ArtworkDefinition;
  mode: ExperienceMode;
  trackMix: TrackMixState[];
  activeRegionId: string | null;
  candidateRegionId: string | null;
  mousePos: Point | null;
  selectedGridCell: number | null;
  onMouseMove: (pos: Point | null, metrics?: PixelMetrics | null) => void;
  disabled?: boolean;
}

export function ArtworkCanvas({
  artwork,
  mode,
  trackMix,
  activeRegionId,
  candidateRegionId,
  mousePos,
  selectedGridCell,
  onMouseMove,
  disabled,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [aspectRatio, setAspectRatio] = useState(16 / 9);
  const [renderVersion, redraw] = useReducer((value: number) => value + 1, 0);

  useEffect(() => {
    if (!artwork.sourceImage) {
      imgRef.current = null;
      sourceCanvasRef.current = null;
      setAspectRatio(1);
      redraw();
      return;
    }

    imgRef.current = null;
    sourceCanvasRef.current = null;
    const img = new Image();
    img.src = artwork.sourceImage;
    img.onload = () => {
      imgRef.current = img;
      setAspectRatio(img.naturalWidth / img.naturalHeight);

      const source = document.createElement('canvas');
      source.width = img.naturalWidth;
      source.height = img.naturalHeight;
      source.getContext('2d')?.drawImage(img, 0, 0);
      sourceCanvasRef.current = source;
      redraw();
    };
    img.onerror = () => {
      imgRef.current = null;
      sourceCanvasRef.current = null;
      redraw();
    };
  }, [artwork.sourceImage]);

  const handleMouse = useCallback(
    (event: MouseEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const normPos = {
        x: Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width)),
        y: Math.max(0, Math.min(1, (event.clientY - rect.top) / rect.height)),
      };

      const source = sourceCanvasRef.current;
      const sourceCtx = source?.getContext('2d');
      const metrics = source && sourceCtx
        ? samplePixelMetrics(sourceCtx, normPos, source.width, source.height)
        : null;
      onMouseMove(normPos, metrics);
    },
    [onMouseMove, disabled],
  );

  const handleMouseLeave = useCallback(() => onMouseMove(null, null), [onMouseMove]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#12151c';
    ctx.fillRect(0, 0, w, h);

    if (imgRef.current) {
      ctx.save();
      ctx.globalAlpha = 0.94;
      ctx.drawImage(imgRef.current, 0, 0, w, h);
      ctx.restore();
    }

    if (mode === 'region-chords') {
      drawArtworkGrid(ctx, w, h, selectedGridCell);
    } else {
      const mixByRegion = new Map(trackMix.map((track) => [track.regionId, track]));
      for (const region of artwork.regions) {
        const center = polygonCenter(region.polygon);
        const x = center.x * w;
        const y = center.y * h;
        const mix = mixByRegion.get(region.id);
        const level = mix?.level ?? 0.1;
        const isFocus = mix?.state === 'focus';
        const color = region.color || '#72ead7';
        const glowRadius = 15 + level * 25;
        const pointRadius = 4.5 + level * 3.5;

        const glow = ctx.createRadialGradient(x, y, 0, x, y, glowRadius);
        glow.addColorStop(0, hexToRgba(color, 0.25 + level * 0.2));
        glow.addColorStop(0.28, hexToRgba(color, 0.12 + level * 0.1));
        glow.addColorStop(1, hexToRgba(color, 0));
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(x, y, glowRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.save();
        ctx.shadowColor = color;
        ctx.shadowBlur = isFocus ? 16 : 5;
        ctx.fillStyle = isFocus ? '#f5ffd0' : color;
        ctx.beginPath();
        ctx.arc(x, y, pointRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        ctx.strokeStyle = hexToRgba(color, isFocus ? 0.95 : 0.48 + level * 0.35);
        ctx.lineWidth = isFocus ? 2 : 1;
        ctx.beginPath();
        ctx.arc(x, y, pointRadius + 5 + level * 3, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = isFocus ? '#f5ffd0' : 'rgba(255,255,255,0.7)';
        ctx.font = `${isFocus ? '700' : '600'} 9px "Cascadia Code", monospace`;
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        ctx.fillText(`T${region.chordcatTrack}`, x + pointRadius + 8, y);
      }
    }

    if (mousePos) {
      const x = mousePos.x * w;
      const y = mousePos.y * h;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fill();
    }
  }, [
    artwork,
    mode,
    trackMix,
    activeRegionId,
    candidateRegionId,
    mousePos,
    selectedGridCell,
    renderVersion,
  ]);

  useEffect(() => {
    const observer = new ResizeObserver(redraw);
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="artwork-canvas-container" style={{ aspectRatio }}>
      <canvas
        ref={canvasRef}
        className="artwork-canvas"
        onMouseMove={handleMouse}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: disabled ? 'default' : 'none' }}
        aria-label={mode === 'region-chords'
          ? `${artwork.title} divided into sixteen musical cells`
          : `${artwork.title} with ${artwork.regions.length} musical centers`}
      />
    </div>
  );
}

function drawArtworkGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  selectedCell: number | null,
): void {
  const cellWidth = width / ARTWORK_GRID_SIZE;
  const cellHeight = height / ARTWORK_GRID_SIZE;

  if (selectedCell) {
    const index = selectedCell - 1;
    const column = index % ARTWORK_GRID_SIZE;
    const row = Math.floor(index / ARTWORK_GRID_SIZE);
    const x = column * cellWidth;
    const y = row * cellHeight;

    ctx.save();
    const glow = ctx.createRadialGradient(
      x + cellWidth / 2,
      y + cellHeight / 2,
      0,
      x + cellWidth / 2,
      y + cellHeight / 2,
      Math.max(cellWidth, cellHeight) * 0.8,
    );
    glow.addColorStop(0, 'rgba(236, 255, 122, 0.22)');
    glow.addColorStop(1, 'rgba(111, 229, 205, 0.04)');
    ctx.fillStyle = glow;
    ctx.fillRect(x, y, cellWidth, cellHeight);
    ctx.strokeStyle = '#ecff7a';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, cellWidth - 2, cellHeight - 2);
    ctx.restore();
  }

  ctx.save();
  ctx.strokeStyle = 'rgba(245, 248, 238, 0.42)';
  ctx.lineWidth = 1;
  for (let index = 1; index < ARTWORK_GRID_SIZE; index += 1) {
    const x = Math.round(index * cellWidth) + 0.5;
    const y = Math.round(index * cellHeight) + 0.5;
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }

  ctx.font = '700 9px "Cascadia Code", monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  for (let cell = 1; cell <= ARTWORK_GRID_SIZE * ARTWORK_GRID_SIZE; cell += 1) {
    const index = cell - 1;
    const x = (index % ARTWORK_GRID_SIZE) * cellWidth + 9;
    const y = Math.floor(index / ARTWORK_GRID_SIZE) * cellHeight + 8;
    const label = String(cell).padStart(2, '0');
    ctx.fillStyle = cell === selectedCell ? '#12150a' : 'rgba(10, 13, 16, 0.78)';
    ctx.fillRect(x - 4, y - 3, 24, 16);
    ctx.fillStyle = cell === selectedCell ? '#ecff7a' : 'rgba(255, 255, 255, 0.82)';
    ctx.fillText(label, x, y);
  }
  ctx.restore();
}

function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const expanded = value.length === 3
    ? value.split('').map((character) => character + character).join('')
    : value;
  const numeric = Number.parseInt(expanded, 16);
  const red = (numeric >> 16) & 255;
  const green = (numeric >> 8) & 255;
  const blue = numeric & 255;
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}
