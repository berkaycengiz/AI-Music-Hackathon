import { useRef, useEffect, useCallback, type MouseEvent } from 'react';
import type { Point, ArtworkDefinition, ArtworkRegion } from '../artwork/artworkTypes';
import { samplePixelMetrics, type PixelMetrics } from '../artwork/pixelAnalysis';

interface Props {
  artwork: ArtworkDefinition;
  activeRegionId: string | null;
  candidateRegionId: string | null;
  mousePos: Point | null;
  onMouseMove: (pos: Point | null, metrics?: PixelMetrics | null) => void;
  disabled?: boolean;
}

/** Region fill colors (with alpha) */
const REGION_ALPHA_IDLE = 0.18;
const REGION_ALPHA_CANDIDATE = 0.30;
const REGION_ALPHA_ACTIVE = 0.45;
const BORDER_WIDTH_IDLE = 1.5;
const BORDER_WIDTH_ACTIVE = 3;

export function ArtworkCanvas({
  artwork,
  activeRegionId,
  candidateRegionId,
  mousePos,
  onMouseMove,
  disabled,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // Load artwork image whenever artwork source changes
  useEffect(() => {
    if (!artwork.sourceImage) {
      imgRef.current = null;
      return;
    }
    const img = new Image();
    img.src = artwork.sourceImage;
    img.onload = () => {
      imgRef.current = img;
      // Trigger redraw
      if (canvasRef.current) {
        canvasRef.current.dispatchEvent(new Event('resize'));
      }
    };
    img.onerror = () => {
      imgRef.current = null;
    };
  }, [artwork.sourceImage]);

  // Convert mouse event to normalized artwork coordinates
  const handleMouse = useCallback(
    (e: MouseEvent<HTMLCanvasElement>) => {
      if (disabled) return;
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;

      const normPos = {
        x: Math.max(0, Math.min(1, x)),
        y: Math.max(0, Math.min(1, y)),
      };

      const ctx = canvas.getContext('2d');
      const metrics = ctx ? samplePixelMetrics(ctx, normPos, canvas.width, canvas.height) : null;

      onMouseMove(normPos, metrics);
    },
    [onMouseMove, disabled],
  );

  const handleMouseLeave = useCallback(() => {
    onMouseMove(null, null);
  }, [onMouseMove]);

  // Draw artwork regions and fingertip indicator
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);
    const w = rect.width;
    const h = rect.height;

    // Clear
    ctx.clearRect(0, 0, w, h);

    // Background: dark surface or real artwork image
    ctx.fillStyle = '#12151c';
    ctx.fillRect(0, 0, w, h);

    if (imgRef.current) {
      ctx.save();
      ctx.globalAlpha = 0.88;
      ctx.drawImage(imgRef.current, 0, 0, w, h);
      ctx.restore();
    }

    // Draw subtle grid for orientation
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 10; i++) {
      const gx = (i / 10) * w;
      const gy = (i / 10) * h;
      ctx.beginPath();
      ctx.moveTo(gx, 0);
      ctx.lineTo(gx, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, gy);
      ctx.lineTo(w, gy);
      ctx.stroke();
    }

    // Draw regions
    for (const region of artwork.regions) {
      const isActive = region.id === activeRegionId;
      const isCandidate = region.id === candidateRegionId && !isActive;
      const color = region.color || '#72ead7';

      // Fill
      const alpha = isActive
        ? REGION_ALPHA_ACTIVE
        : isCandidate
          ? REGION_ALPHA_CANDIDATE
          : REGION_ALPHA_IDLE;
      ctx.fillStyle = hexToRgba(color, alpha);
      ctx.beginPath();
      drawPolygon(ctx, region.polygon, w, h);
      ctx.fill();

      // Border
      ctx.strokeStyle = isActive
        ? color
        : hexToRgba(color, 0.5);
      ctx.lineWidth = isActive ? BORDER_WIDTH_ACTIVE : BORDER_WIDTH_IDLE;
      ctx.beginPath();
      drawPolygon(ctx, region.polygon, w, h);
      ctx.stroke();

      // Label
      const center = polygonCenter(region.polygon);
      ctx.fillStyle = isActive ? '#ffffff' : 'rgba(255,255,255,0.6)';
      ctx.font = `${isActive ? 'bold ' : ''}${Math.max(12, w * 0.028)}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(region.label, center.x * w, center.y * h);

      // Active glow effect
      if (isActive) {
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        drawPolygon(ctx, region.polygon, w, h);
        ctx.stroke();
        ctx.shadowBlur = 0;
      }
    }

    // Draw fingertip indicator
    if (mousePos) {
      const px = mousePos.x * w;
      const py = mousePos.y * h;

      // Outer ring
      ctx.beginPath();
      ctx.arc(px, py, 12, 0, Math.PI * 2);
      ctx.strokeStyle = activeRegionId
        ? '#72ead7'
        : 'rgba(255, 255, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Inner dot
      ctx.beginPath();
      ctx.arc(px, py, 4, 0, Math.PI * 2);
      ctx.fillStyle = activeRegionId ? '#72ead7' : '#ffffff';
      ctx.fill();

      // Crosshair lines
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(px, 0);
      ctx.lineTo(px, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, py);
      ctx.lineTo(w, py);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }, [artwork, activeRegionId, candidateRegionId, mousePos]);

  // Handle resize
  useEffect(() => {
    const observer = new ResizeObserver(() => {
      // Trigger re-render by updating canvas dimensions
      const canvas = canvasRef.current;
      if (canvas) {
        canvas.dispatchEvent(new Event('resize'));
      }
    });
    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="artwork-canvas-container">
      <canvas
        ref={canvasRef}
        className="artwork-canvas"
        onMouseMove={handleMouse}
        onMouseLeave={handleMouseLeave}
        style={{ cursor: disabled ? 'default' : 'none' }}
      />
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function drawPolygon(
  ctx: CanvasRenderingContext2D,
  polygon: Point[],
  w: number,
  h: number,
) {
  if (polygon.length === 0) return;
  ctx.moveTo(polygon[0].x * w, polygon[0].y * h);
  for (let i = 1; i < polygon.length; i++) {
    ctx.lineTo(polygon[i].x * w, polygon[i].y * h);
  }
  ctx.closePath();
}

function polygonCenter(polygon: Point[]): Point {
  let cx = 0, cy = 0;
  for (const p of polygon) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / polygon.length, y: cy / polygon.length };
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
