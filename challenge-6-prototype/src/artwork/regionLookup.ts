import type { Point, ArtworkRegion } from './artworkTypes';

/**
 * Ray-casting point-in-polygon test.
 * Returns true if the point is inside or on the edge of the polygon.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const { x, y } = point;
  const n = polygon.length;
  let inside = false;

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y;
    const xj = polygon[j].x, yj = polygon[j].y;

    if (pointOnSegment(point, polygon[j], polygon[i])) {
      return true;
    }

    const intersect =
      yi > y !== yj > y &&
      x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;

    if (intersect) inside = !inside;
  }

  return inside;
}

/**
 * Compute the area of a polygon using the shoelace formula.
 * Returns the absolute area (always positive).
 */
export function polygonArea(polygon: Point[]): number {
  let area = 0;
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    area += polygon[j].x * polygon[i].y;
    area -= polygon[i].x * polygon[j].y;
  }
  return Math.abs(area) / 2;
}

/** Area-weighted visual center, with a safe fallback for degenerate polygons. */
export function polygonCenter(polygon: Point[]): Point {
  if (polygon.length === 0) return { x: 0.5, y: 0.5 };

  let signedArea = 0;
  let x = 0;
  let y = 0;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const cross = polygon[j].x * polygon[i].y - polygon[i].x * polygon[j].y;
    signedArea += cross;
    x += (polygon[j].x + polygon[i].x) * cross;
    y += (polygon[j].y + polygon[i].y) * cross;
  }

  if (Math.abs(signedArea) < 1e-8) {
    return polygon.reduce(
      (center, point) => ({ x: center.x + point.x / polygon.length, y: center.y + point.y / polygon.length }),
      { x: 0, y: 0 },
    );
  }

  return { x: x / (3 * signedArea), y: y / (3 * signedArea) };
}

/**
 * Find which region (if any) contains the given point.
 *
 * Overlap rules (spec §10.2):
 * 1. Highest priority wins.
 * 2. If priorities are equal, smallest polygon wins.
 *
 * @param regions - All artwork regions
 * @param point - Normalized artwork coordinate
 * @param activeRegionId - Currently active region ID for hysteresis (optional)
 * @param hysteresisMargin - Extra margin to keep the active region sticky (default 0.015)
 * @returns The matching region, or null if outside all regions
 */
export function findRegion(
  regions: ArtworkRegion[],
  point: Point,
  activeRegionId?: string | null,
  hysteresisMargin: number = 0.015,
): ArtworkRegion | null {
  // Collect all regions that contain the point
  const hits: ArtworkRegion[] = [];

  for (const region of regions) {
    if (pointInPolygon(point, region.polygon)) {
      hits.push(region);
    }
  }

  // If exactly one hit, return it
  if (hits.length === 1) return hits[0];

  // If no direct hits, check if we're within hysteresis margin of the active region
  if (hits.length === 0 && activeRegionId) {
    const activeRegion = regions.find((r) => r.id === activeRegionId);
    if (activeRegion && isNearPolygon(point, activeRegion.polygon, hysteresisMargin)) {
      return activeRegion;
    }
    return null;
  }

  if (hits.length === 0) return null;

  // Multiple hits: resolve by priority (desc), then by area (asc)
  hits.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority;
    return polygonArea(a.polygon) - polygonArea(b.polygon);
  });

  return hits[0];
}

function pointOnSegment(point: Point, a: Point, b: Point, epsilon = 1e-7): boolean {
  const cross = (point.y - a.y) * (b.x - a.x) - (point.x - a.x) * (b.y - a.y);
  if (Math.abs(cross) > epsilon) return false;

  return (
    point.x >= Math.min(a.x, b.x) - epsilon &&
    point.x <= Math.max(a.x, b.x) + epsilon &&
    point.y >= Math.min(a.y, b.y) - epsilon &&
    point.y <= Math.max(a.y, b.y) + epsilon
  );
}

/**
 * Check if a point is within `margin` distance of any edge of the polygon.
 * Uses a simple perpendicular-distance-to-segment approximation.
 */
function isNearPolygon(point: Point, polygon: Point[], margin: number): boolean {
  const n = polygon.length;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    if (distToSegment(point, polygon[j], polygon[i]) <= margin) {
      return true;
    }
  }
  return false;
}

/** Minimum distance from point P to line segment AB */
function distToSegment(p: Point, a: Point, b: Point): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;

  if (lenSq === 0) {
    // Degenerate segment (a === b)
    return Math.hypot(p.x - a.x, p.y - a.y);
  }

  let t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));

  const projX = a.x + t * dx;
  const projY = a.y + t * dy;

  return Math.hypot(p.x - projX, p.y - projY);
}
