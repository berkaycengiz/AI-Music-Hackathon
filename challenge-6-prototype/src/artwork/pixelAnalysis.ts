import type { Point } from './artworkTypes';

export interface PixelMetrics {
  r: number;
  g: number;
  b: number;
  /** Normalized luminance [0.0 (pitch black) to 1.0 (pure bright)] */
  brightness: number;
  /** Normalized warmth [-1.0 (cool blue) to +1.0 (warm red/orange)] */
  warmth: number;
  /** Hex color string for UI display */
  hex: string;
}

/**
 * Samples pixel color and calculates brightness & warmth from a 2D canvas context.
 * Averages a 3x3 sample box around the point to smooth micro-pixel noise.
 */
export function samplePixelMetrics(
  ctx: CanvasRenderingContext2D,
  pos: Point,
  canvasWidth: number,
  canvasHeight: number,
): PixelMetrics | null {
  const px = Math.floor(Math.max(0, Math.min(canvasWidth - 1, pos.x * canvasWidth)));
  const py = Math.floor(Math.max(0, Math.min(canvasHeight - 1, pos.y * canvasHeight)));

  try {
    // Sample 3x3 window around cursor for smooth modulation
    const sampleSize = 3;
    const startX = Math.max(0, px - 1);
    const startY = Math.max(0, py - 1);
    const actualW = Math.min(sampleSize, canvasWidth - startX);
    const actualH = Math.min(sampleSize, canvasHeight - startY);

    const imgData = ctx.getImageData(startX, startY, actualW, actualH).data;

    let rSum = 0;
    let gSum = 0;
    let bSum = 0;
    const count = imgData.length / 4;

    for (let i = 0; i < imgData.length; i += 4) {
      rSum += imgData[i];
      gSum += imgData[i + 1];
      bSum += imgData[i + 2];
    }

    const r = Math.round(rSum / count);
    const g = Math.round(gSum / count);
    const b = Math.round(bSum / count);

    // Standard ITU-R BT.601 perceptual luminance
    const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    // Warmth: positive for red/orange, negative for blue/cool tones
    const warmth = (r - b) / 255;

    const hex = `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;

    return {
      r,
      g,
      b,
      brightness: Math.max(0, Math.min(1, brightness)),
      warmth: Math.max(-1, Math.min(1, warmth)),
      hex,
    };
  } catch (err) {
    // Handle cross-origin or canvas security boundary if any
    return null;
  }
}
