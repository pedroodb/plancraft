/**
 * Semantic analysis pass: computes wall polygons
 * and calculates room areas + centers.
 */

import {
  DoorNode,
  FloorNode,
  OpeningNode,
  Point,
  ProjectNode,
  ResolvedDoor,
  ResolvedFloor,
  ResolvedOpening,
  ResolvedProject,
  ResolvedRoom,
  ResolvedWall,
  ResolvedWindow,
  RoomNode,
  StructuralWarning,
  WallNode,
  WindowNode,
} from "./ast/types.js";

export class ResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResolveError";
  }
}

// ── Geometry helpers ─────────────────────────────────────────────────

/** Number of line segments used to approximate a curved wall arc. */
const ARC_SEGMENTS = 32;

/**
 * Build a straight wall polygon (4 corners).
 */
function straightWallPolygon(
  from: Point,
  to: Point,
  thickness: number,
): Point[] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) throw new ResolveError("Wall has zero length");

  // Normal perpendicular to wall direction (rotated 90° CCW)
  const nx = -dy / len;
  const ny = dx / len;
  const half = thickness / 2;

  return [
    { x: from.x + nx * half, y: from.y + ny * half },
    { x: to.x + nx * half, y: to.y + ny * half },
    { x: to.x - nx * half, y: to.y - ny * half },
    { x: from.x - nx * half, y: from.y - ny * half },
  ];
}

/**
 * Compute arc geometry from two endpoints and a bulge factor.
 *
 * bulge = tan(includedAngle / 4)
 * Positive bulge → arc curves to the left (CCW from `from` to `to`).
 * Negative bulge → arc curves to the right (CW).
 */
export function arcFromBulge(
  from: Point,
  to: Point,
  bulge: number,
): { center: Point; radius: number; startAngle: number; endAngle: number; ccw: boolean } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const chord = Math.sqrt(dx * dx + dy * dy);
  if (chord === 0) throw new ResolveError("Wall has zero length");

  const halfChord = chord / 2;
  const sagitta = Math.abs(bulge) * halfChord;
  const radius = (halfChord * halfChord + sagitta * sagitta) / (2 * sagitta);

  // Midpoint of the chord
  const mx = (from.x + to.x) / 2;
  const my = (from.y + to.y) / 2;

  // Unit normal to chord (perpendicular, 90° CCW)
  const nx = -dy / chord;
  const ny = dx / chord;

  // Distance from chord midpoint to arc center
  const d = radius - sagitta;

  // Center is on the opposite side of the bulge direction.
  // Positive bulge → sagitta on the left of travel → center on the right → sign = -1.
  // Negative bulge → sagitta on the right of travel → center on the left → sign = +1.
  const sign = bulge > 0 ? -1 : 1;
  const center: Point = {
    x: mx + sign * nx * d,
    y: my + sign * ny * d,
  };

  // Start and end angles (from center to from/to)
  const startAngle = Math.atan2(from.y - center.y, from.x - center.x);
  const endAngle = Math.atan2(to.y - center.y, to.x - center.x);

  // The minor arc direction:
  // Positive bulge → center below chord → CW traversal gives the upward-curving minor arc → ccw = false
  // Negative bulge → center above chord → CCW traversal gives the downward-curving minor arc → ccw = true
  const ccw = bulge < 0;

  return { center, radius, startAngle, endAngle, ccw };
}

/**
 * Sample points along an arc from startAngle to endAngle.
 */
export function sampleArc(
  center: Point,
  radius: number,
  startAngle: number,
  endAngle: number,
  ccw: boolean,
  segments: number,
): Point[] {
  let sweep = endAngle - startAngle;
  if (ccw) {
    // Ensure positive sweep for CCW
    if (sweep <= 0) sweep += 2 * Math.PI;
  } else {
    // Ensure negative sweep for CW
    if (sweep >= 0) sweep -= 2 * Math.PI;
  }

  const points: Point[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const angle = startAngle + sweep * t;
    points.push({
      x: center.x + radius * Math.cos(angle),
      y: center.y + radius * Math.sin(angle),
    });
  }
  return points;
}

/**
 * Build a curved wall polygon by sampling the arc and offsetting by thickness.
 * Returns the polygon points (outer arc + reversed inner arc) and the
 * centerline sample points.
 */
function curvedWallPolygon(
  from: Point,
  to: Point,
  thickness: number,
  bulge: number,
): { polygon: Point[]; curvePoints: Point[] } {
  const { center, radius, startAngle, endAngle, ccw } = arcFromBulge(from, to, bulge);
  const half = thickness / 2;

  // Sample centerline points along the arc
  const curvePoints = sampleArc(center, radius, startAngle, endAngle, ccw, ARC_SEGMENTS);

  // Outer and inner arcs: offset perpendicular to the arc (radially)
  // For each centerline point, the outward normal points away from center.
  // "outer" = away from center, "inner" = toward center.
  // Which side is the architectural "outside" depends on convention;
  // we simply create both edges and let the polygon enclose them.
  const outerPoints: Point[] = [];
  const innerPoints: Point[] = [];

  for (const p of curvePoints) {
    // Radial direction from center to point (outward)
    const rdx = p.x - center.x;
    const rdy = p.y - center.y;
    const rlen = Math.sqrt(rdx * rdx + rdy * rdy);
    const rnx = rdx / rlen;
    const rny = rdy / rlen;

    outerPoints.push({ x: p.x + rnx * half, y: p.y + rny * half });
    innerPoints.push({ x: p.x - rnx * half, y: p.y - rny * half });
  }

  // Polygon: outer edge forward, then inner edge reversed (forms a closed ring)
  const polygon = [...outerPoints, ...innerPoints.reverse()];

  return { polygon, curvePoints };
}

/**
 * Build a wall polygon, handling both straight and curved walls.
 */
function wallPolygon(
  from: Point,
  to: Point,
  thickness: number,
  bulge?: number,
): { polygon: Point[]; curvePoints?: Point[] } {
  if (bulge !== undefined && bulge !== 0) {
    return curvedWallPolygon(from, to, thickness, bulge);
  }
  return { polygon: straightWallPolygon(from, to, thickness) };
}

/**
 * Compute the position along a wall centerline at a given offset from `from`.
 * For straight walls only — uses linear interpolation along the chord.
 */
function pointAlongWall(from: Point, to: Point, offset: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 0.01) return { x: from.x, y: from.y };
  return {
    x: from.x + (dx / len) * offset,
    y: from.y + (dy / len) * offset,
  };
}

/**
 * Compute the total arc length of a curved wall.
 */
export function getArcLength(from: Point, to: Point, bulge: number): number {
  const { radius, startAngle, endAngle, ccw } = arcFromBulge(from, to, bulge);
  let sweep = endAngle - startAngle;
  if (ccw) {
    if (sweep <= 0) sweep += 2 * Math.PI;
  } else {
    if (sweep >= 0) sweep -= 2 * Math.PI;
  }
  return radius * Math.abs(sweep);
}

function computeWallLen(wall: ResolvedWall): number {
  if (wall.bulge && wall.bulge !== 0) {
    return getArcLength(wall.from, wall.to, wall.bulge);
  }
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute a point and tangent direction along a curved wall at a given
 * arc-length offset from the wall start.
 *
 * Returns:
 * - `point`: the 2D position on the arc centerline
 * - `tangent`: the unit tangent vector in the direction of travel
 */
export function pointAlongArc(
  from: Point,
  to: Point,
  bulge: number,
  offset: number,
): { point: Point; tangent: { dx: number; dy: number } } {
  const { center, radius, startAngle, endAngle, ccw } = arcFromBulge(from, to, bulge);

  // Compute sweep angle (same logic as sampleArc)
  let sweep = endAngle - startAngle;
  if (ccw) {
    if (sweep <= 0) sweep += 2 * Math.PI;
  } else {
    if (sweep >= 0) sweep -= 2 * Math.PI;
  }

  const totalArcLen = radius * Math.abs(sweep);
  const t = totalArcLen > 0 ? offset / totalArcLen : 0;
  const angle = startAngle + sweep * t;

  const point: Point = {
    x: center.x + radius * Math.cos(angle),
    y: center.y + radius * Math.sin(angle),
  };

  // Tangent is perpendicular to the radius vector, in the direction of travel.
  // sweep > 0 (CCW): tangent = (-sin θ, cos θ)
  // sweep < 0 (CW):  tangent = (sin θ, -cos θ)
  const tangent =
    sweep > 0
      ? { dx: -Math.sin(angle), dy: Math.cos(angle) }
      : { dx: Math.sin(angle), dy: -Math.cos(angle) };

  return { point, tangent };
}

/**
 * Compute the area of a polygon using the shoelace formula.
 * The polygon is defined by the center-points of the room walls in order.
 */
function polygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

/**
 * Compute the centroid of a polygon using the shoelace-based formula.
 * Unlike a simple vertex average, this correctly handles polygons with
 * unevenly distributed vertices (e.g. curved walls with many sample points)
 * and non-convex shapes.
 *
 * Formula: Cx = 1/(6A) * Σ(xi+xi+1)(xi·yi+1 − xi+1·yi)
 *          Cy = 1/(6A) * Σ(yi+yi+1)(xi·yi+1 − xi+1·yi)
 * where A is the signed area from the shoelace formula.
 */
function polygonCenter(points: Point[]): Point {
  const n = points.length;
  if (n === 0) return { x: 0, y: 0 };
  if (n === 1) return { x: points[0].x, y: points[0].y };
  if (n === 2)
    return {
      x: (points[0].x + points[1].x) / 2,
      y: (points[0].y + points[1].y) / 2,
    };

  let signedArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const cross = points[i].x * points[j].y - points[j].x * points[i].y;
    signedArea += cross;
    cx += (points[i].x + points[j].x) * cross;
    cy += (points[i].y + points[j].y) * cross;
  }
  signedArea /= 2;

  // Guard against degenerate (zero-area) polygons – fall back to vertex average
  if (Math.abs(signedArea) < 1e-6) {
    let fx = 0;
    let fy = 0;
    for (const p of points) {
      fx += p.x;
      fy += p.y;
    }
    return { x: fx / n, y: fy / n };
  }

  const factor = 1 / (6 * signedArea);
  return { x: cx * factor, y: cy * factor };
}

// ── Wall chain normalization ─────────────────────────────────────────

/**
 * Check if two points are approximately equal.
 * Uses a 1mm tolerance to account for minor coordinate rounding
 * in AI-generated plans while preserving architectural precision.
 */
const POINT_EQ_TOLERANCE = 1; // 1mm
function pointsEqual(a: Point, b: Point): boolean {
  return (
    Math.abs(a.x - b.x) <= POINT_EQ_TOLERANCE &&
    Math.abs(a.y - b.y) <= POINT_EQ_TOLERANCE
  );
}

/**
 * Return a copy of the wall with from/to swapped, curvePoints reversed,
 * and bulge negated.  The physical polygon stays the same (it describes
 * the wall shape regardless of traversal direction).
 */
function reverseWall(wall: ResolvedWall): ResolvedWall {
  const reversed: ResolvedWall = {
    ...wall,
    from: wall.to,
    to: wall.from,
  };
  if (wall.bulge !== undefined) {
    reversed.bulge = -wall.bulge;
  }
  if (wall.curvePoints && wall.curvePoints.length > 0) {
    reversed.curvePoints = [...wall.curvePoints].reverse();
  }
  return reversed;
}

/**
 * Reorder and orient walls so they form a proper closed chain where
 * wall[i].to === wall[i+1].from for every consecutive pair, and the
 * last wall's `to` equals the first wall's `from`.
 *
 * Walls may be defined out of perimeter order or with reversed from/to.
 * The algorithm greedily builds a chain by matching endpoints, reversing
 * walls as needed.
 *
 * If the first wall's initial orientation doesn't produce a valid chain
 * it retries with the first wall reversed.  On failure it returns the
 * original array unchanged (best-effort).
 */
function normalizeWallChain(walls: ResolvedWall[]): ResolvedWall[] {
  if (walls.length <= 1) return walls;

  for (const startReversed of [false, true]) {
    const result: ResolvedWall[] = [];
    const used = new Set<number>();

    result.push(startReversed ? reverseWall(walls[0]) : walls[0]);
    used.add(0);

    let success = true;
    for (let step = 1; step < walls.length; step++) {
      const prevEnd = result[result.length - 1].to;
      const firstStart = result[0].from;
      const isLastStep = step === walls.length - 1;

      let found = false;

      // 1. Try exact endpoint match
      for (let j = 0; j < walls.length; j++) {
        if (used.has(j)) continue;

        if (pointsEqual(walls[j].from, prevEnd)) {
          result.push(walls[j]);
          used.add(j);
          found = true;
          break;
        }
        if (pointsEqual(walls[j].to, prevEnd)) {
          result.push(reverseWall(walls[j]));
          used.add(j);
          found = true;
          break;
        }
      }

      if (!found) {
        success = false;
        break;
      }
    }

    if (!success) continue;

    // Verify the chain closes
    const lastEnd = result[result.length - 1].to;
    const firstStart = result[0].from;

    if (pointsEqual(lastEnd, firstStart)) {
      return result;
    }
  }

  // Fallback: return a COPY of walls in their original order.
  // IMPORTANT: must return a new array, NOT the input reference,
  // because the caller does `walls.length = 0; walls.push(...result)`.
  // Returning the same reference would alias `walls` and `result`,
  // causing `walls.length = 0` to empty both — losing all walls.
  return [...walls];
}

// ── Resolver ─────────────────────────────────────────────────────────

export function resolve(project: ProjectNode): ResolvedProject {
  return {
    name: project.name,
    scale: project.scale,
    unit: project.unit,
    floors: project.floors.map((f) => resolveFloor(f)),
  };
}

function resolveFloor(floor: FloorNode): ResolvedFloor {
  const rooms: ResolvedRoom[] = [];

  for (const child of floor.children) {
    if (child.type === "room") {
      rooms.push(resolveRoom(child));
    }
  }

  return { name: floor.name, rooms };
}

function resolveRoom(room: RoomNode): ResolvedRoom {
  const walls: ResolvedWall[] = [];
  const doors: ResolvedDoor[] = [];
  const windows: ResolvedWindow[] = [];
  const openings: ResolvedOpening[] = [];

  // First pass: walls
  for (const child of room.children) {
    if (child.type === "wall") {
      walls.push(resolveWall(child, room.name));
    }
  }

  // Normalize wall chain so walls form a proper closed perimeter.
  const chainedWalls = normalizeWallChain(walls);
  // Replace the walls array contents with the normalized chain
  walls.length = 0;
  walls.push(...chainedWalls);

  // Build a wall lookup for openings
  const wallByDir = new Map<string, ResolvedWall>();
  for (const w of walls) wallByDir.set(w.direction, w);

  // Second pass: openings
  for (const child of room.children) {
    if (child.type === "door") {
      const wall = wallByDir.get(child.wallDirection);
      if (!wall) {
        const availDirs = [...wallByDir.keys()].join(', ');
        throw new ResolveError(
          `Door references wall.${child.wallDirection} in room "${room.name}", but no such wall exists. Valid walls: [${availDirs}]`,
        );
      }
      const wallLen = computeWallLen(wall);
      if (child.offset + child.width > wallLen + 1) {
        throw new ResolveError(
          `Door on wall "${child.wallDirection}" in room "${room.name}" exceeds wall length: offset (${child.offset}) + width (${child.width}) = ${child.offset + child.width}mm, but wall is only ${Math.round(wallLen)}mm long`,
        );
      }
      doors.push(resolveDoor(child, wall));
    } else if (child.type === "window") {
      const wall = wallByDir.get(child.wallDirection);
      if (!wall) {
        const availDirs = [...wallByDir.keys()].join(', ');
        throw new ResolveError(
          `Window references wall.${child.wallDirection} in room "${room.name}", but no such wall exists. Valid walls: [${availDirs}]`,
        );
      }
      const wallLen = computeWallLen(wall);
      if (child.offset + child.width > wallLen + 1) {
        throw new ResolveError(
          `Window on wall "${child.wallDirection}" in room "${room.name}" exceeds wall length: offset (${child.offset}) + width (${child.width}) = ${child.offset + child.width}mm, but wall is only ${Math.round(wallLen)}mm long`,
        );
      }
      windows.push(resolveWindow(child, wall));
    } else if (child.type === "opening") {
      const wall = wallByDir.get(child.wallDirection);
      if (!wall)
        throw new ResolveError(
          `Opening references wall.${child.wallDirection} in room "${room.name}", but no such wall exists`,
        );
      const wallLen = computeWallLen(wall);
      if (child.offset + child.width > wallLen + 1) {
        throw new ResolveError(
          `Opening on wall "${child.wallDirection}" in room "${room.name}" exceeds wall length: offset (${child.offset}) + width (${child.width}) = ${child.offset + child.width}mm, but wall is only ${Math.round(wallLen)}mm long`,
        );
      }
      openings.push(resolveOpening(child, wall));
    }
  }

  // Compute area and center from wall centerline points.
  // For each wall, determine the correct traversal start point by checking
  // endpoint connectivity with the previous wall.
  const areaPoints: Point[] = [];
  for (let i = 0; i < walls.length; i++) {
    const prev = walls[(i - 1 + walls.length) % walls.length];
    const curr = walls[i];

    // Determine the correct start point for this wall segment
    let start: Point;
    if (pointsEqual(prev.to, curr.from)) {
      start = curr.from;
    } else if (pointsEqual(prev.to, curr.to)) {
      start = curr.to;
    } else if (pointsEqual(prev.from, curr.from)) {
      start = curr.from;
    } else if (pointsEqual(prev.from, curr.to)) {
      start = curr.to;
    } else {
      start = curr.from; // fallback
    }

    const isReversed = pointsEqual(start, curr.to);

    if (curr.curvePoints && curr.curvePoints.length > 0) {
      // Curved wall: add sampled arc points in the correct traversal order
      const pts = isReversed ? [...curr.curvePoints].reverse() : curr.curvePoints;
      // Exclude the last point (which is the next wall's start)
      for (let j = 0; j < pts.length - 1; j++) {
        areaPoints.push(pts[j]);
      }
    } else {
      areaPoints.push(start);
    }
  }
  const area = polygonArea(areaPoints);
  const center = polygonCenter(areaPoints);

  return { name: room.name, walls, doors, windows, openings, area, center };
}

function resolveWall(wall: WallNode, roomName: string): ResolvedWall {
  const { polygon, curvePoints } = wallPolygon(wall.from, wall.to, wall.thickness, wall.bulge);
  const resolved: ResolvedWall = {
    direction: wall.direction,
    from: wall.from,
    to: wall.to,
    thickness: wall.thickness,
    roomName,
    polygon,
  };
  if (wall.bulge !== undefined && wall.bulge !== 0) {
    resolved.bulge = wall.bulge;
    resolved.curvePoints = curvePoints;
  }
  return resolved;
}

function resolveDoor(door: DoorNode, wall: ResolvedWall): ResolvedDoor {
  if (wall.bulge && wall.bulge !== 0) {
    const { point: startPt, tangent } = pointAlongArc(wall.from, wall.to, wall.bulge, door.offset);
    const { point: endPt } = pointAlongArc(wall.from, wall.to, wall.bulge, door.offset + door.width);
    return {
      wallDirection: door.wallDirection,
      position: startPt,
      endPosition: endPt,
      width: door.width,
      swing: door.swing,
      wall,
      tangent,
      arcOffset: door.offset,
    };
  }
  const position = pointAlongWall(wall.from, wall.to, door.offset);
  return {
    wallDirection: door.wallDirection,
    position,
    width: door.width,
    swing: door.swing,
    wall,
  };
}

function resolveWindow(
  window: WindowNode,
  wall: ResolvedWall,
): ResolvedWindow {
  if (wall.bulge && wall.bulge !== 0) {
    const { point: startPt, tangent } = pointAlongArc(wall.from, wall.to, wall.bulge, window.offset);
    const { point: endPt } = pointAlongArc(wall.from, wall.to, wall.bulge, window.offset + window.width);
    return {
      wallDirection: window.wallDirection,
      position: startPt,
      endPosition: endPt,
      width: window.width,
      height: window.height,
      sill: window.sill,
      wall,
      tangent,
      arcOffset: window.offset,
    };
  }
  const position = pointAlongWall(wall.from, wall.to, window.offset);
  return {
    wallDirection: window.wallDirection,
    position,
    width: window.width,
    height: window.height,
    sill: window.sill,
    wall,
  };
}

function resolveOpening(
  opening: OpeningNode,
  wall: ResolvedWall,
): ResolvedOpening {
  if (wall.bulge && wall.bulge !== 0) {
    const { point: startPt, tangent } = pointAlongArc(wall.from, wall.to, wall.bulge, opening.offset);
    const { point: endPt } = pointAlongArc(wall.from, wall.to, wall.bulge, opening.offset + opening.width);
    return {
      wallDirection: opening.wallDirection,
      position: startPt,
      endPosition: endPt,
      width: opening.width,
      wall,
      tangent,
      arcOffset: opening.offset,
    };
  }
  const position = pointAlongWall(wall.from, wall.to, opening.offset);
  return {
    wallDirection: opening.wallDirection,
    position,
    width: opening.width,
    wall,
  };
}

// ── Structural validation ────────────────────────────────────────────

/**
 * Normalize a wall key so that A→B and B→A produce the same string.
 * Sorts endpoints by x first, then y.
 */
function normalizedWallKey(from: Point, to: Point): string {
  const a = from;
  const b = to;
  if (a.x < b.x || (a.x === b.x && a.y < b.y)) {
    return `${a.x},${a.y}-${b.x},${b.y}`;
  }
  return `${b.x},${b.y}-${a.x},${a.y}`;
}

/**
 * Compute the offset range [start, end] of a door along the wall's from→to
 * direction. For a reversed wall (B→A vs A→B), the offset is inverted.
 */
function doorOffsetRange(
  door: ResolvedDoor,
  wall: ResolvedWall,
  isReversed: boolean,
): [number, number] {
  // Find original DoorNode offset from the wall's from→to direction.
  // ResolvedDoor.position is the absolute point at door.offset along the wall.
  // We project it back to get the offset along the wall.
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const wallLen = Math.sqrt(dx * dx + dy * dy);
  if (wallLen === 0) return [0, 0];

  // Project door position onto wall line to get offset
  const pdx = door.position.x - wall.from.x;
  const pdy = door.position.y - wall.from.y;
  const offset = (pdx * dx + pdy * dy) / wallLen;

  let start = offset;
  let end = offset + door.width;

  if (isReversed) {
    // The other wall goes in the opposite direction, so flip the range
    start = wallLen - end;
    end = start + door.width;
  }

  return [start, end];
}

/**
 * Check if two numeric ranges overlap with a tolerance.
 */
function rangesOverlap(
  a: [number, number],
  b: [number, number],
  tolerance: number,
): boolean {
  return a[0] < b[1] - tolerance && b[0] < a[1] - tolerance;
}

/**
 * Check if two walls have the same geometry but are defined in opposite
 * directions (A→B vs B→A).
 */
function isReversedWall(w1: ResolvedWall, w2: ResolvedWall): boolean {
  const eps = 1;
  return (
    Math.abs(w1.from.x - w2.to.x) < eps &&
    Math.abs(w1.from.y - w2.to.y) < eps &&
    Math.abs(w1.to.x - w2.from.x) < eps &&
    Math.abs(w1.to.y - w2.from.y) < eps
  );
}

/**
 * Validate the resolved project for structural issues.
 * Currently detects duplicate doors on overlapping wall segments between
 * adjacent rooms.
 */
export function validateStructure(
  project: ResolvedProject,
): StructuralWarning[] {
  const warnings: StructuralWarning[] = [];

  for (const floor of project.floors) {
    // Map walls by normalized geometry key
    const wallMap = new Map<
      string,
      { roomName: string; wall: ResolvedWall; doors: ResolvedDoor[] }[]
    >();

    for (const room of floor.rooms) {
      for (const wall of room.walls) {
        const key = normalizedWallKey(wall.from, wall.to);
        if (!wallMap.has(key)) wallMap.set(key, []);
        // Collect doors that belong to this specific wall
        const wallDoors = room.doors.filter((d) => d.wall === wall);
        wallMap.get(key)!.push({
          roomName: room.name,
          wall,
          doors: wallDoors,
        });
      }
    }

    // Check wall pairs with shared geometry for overlapping doors
    for (const entries of wallMap.values()) {
      if (entries.length < 2) continue;

      for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
          const e1 = entries[i];
          const e2 = entries[j];
          if (e1.doors.length === 0 || e2.doors.length === 0) continue;

          const reversed = isReversedWall(e1.wall, e2.wall);

          for (const d1 of e1.doors) {
            const range1 = doorOffsetRange(d1, e1.wall, false);
            for (const d2 of e2.doors) {
              const range2 = doorOffsetRange(d2, e2.wall, reversed);
              if (rangesOverlap(range1, range2, 50)) {
                warnings.push({
                  type: "duplicate_door",
                  message: `Duplicate door: "${e1.roomName}" ${d1.wallDirection} wall and "${e2.roomName}" ${d2.wallDirection} wall have overlapping doors on the same boundary. Define the door in one room only.`,
                  room1: e1.roomName,
                  room2: e2.roomName,
                });
              }
            }
          }
        }
      }
    }
  }

  return warnings;
}

