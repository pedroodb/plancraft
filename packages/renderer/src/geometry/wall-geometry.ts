/**
 * Wall geometry generation — converts resolved walls into scene graph primitives.
 *
 * When openings (doors/windows) are present on a wall, the wall polygon is
 * split into segments with gaps at each opening position.
 *
 * Curved walls (with bulge) are rendered as SVG paths with true arc commands.
 */

import type { Point, ResolvedWall } from "@plancraft/dsl";
import { arcFromBulge } from "@plancraft/dsl";
import type { SGPolygon, SGPath } from "../scene-graph.js";
import { LINE_WEIGHTS } from "../scene-graph.js";

/** An opening defined by its offset from wall start and width along the wall. */
export interface WallOpening {
  offset: number;
  width: number;
}

/** Union of wall scene-graph nodes (straight polygons or curved paths). */
export type WallNode = SGPolygon | SGPath;

/**
 * Build a wall polygon segment between two parametric distances along a straight wall.
 * t0 and t1 are distances from wall.from along the centerline.
 */
function wallSegmentPolygon(
  wall: ResolvedWall,
  t0: number,
  t1: number,
): SGPolygon {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;
  // Normal perpendicular (CCW rotation)
  const nx = -uy;
  const ny = ux;
  const half = wall.thickness / 2;

  const p0: Point = { x: wall.from.x + ux * t0, y: wall.from.y + uy * t0 };
  const p1: Point = { x: wall.from.x + ux * t1, y: wall.from.y + uy * t1 };

  const points = [
    { x: p0.x + nx * half, y: p0.y + ny * half },
    { x: p1.x + nx * half, y: p1.y + ny * half },
    { x: p1.x - nx * half, y: p1.y - ny * half },
    { x: p0.x - nx * half, y: p0.y - ny * half },
  ];

  return {
    type: "polygon",
    points,
    fill: "#000000",
    strokeWidth: LINE_WEIGHTS.walls,
    layer: "walls",
  };
}

/**
 * Compute the chord length of a wall.
 */
function wallLength(wall: ResolvedWall): number {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// ── Curved wall helpers ──────────────────────────────────────────────

/**
 * Build an SVG path for a curved wall (thick arc).
 * The path consists of two concentric arcs (outer and inner edges)
 * connected by straight line caps at the endpoints.
 */
export function curvedWallToPath(wall: ResolvedWall): SGPath {
  const bulge = wall.bulge!;
  const half = wall.thickness / 2;
  const { center, radius } = arcFromBulge(wall.from, wall.to, bulge);

  const outerRadius = radius + half;
  const innerRadius = Math.max(radius - half, 0);

  // Compute outer and inner start/end points
  // At 'from': radial direction from center to from
  const rFromX = wall.from.x - center.x;
  const rFromY = wall.from.y - center.y;
  const rFromLen = Math.sqrt(rFromX * rFromX + rFromY * rFromY);
  const rnFromX = rFromX / rFromLen;
  const rnFromY = rFromY / rFromLen;

  // At 'to': radial direction from center to to
  const rToX = wall.to.x - center.x;
  const rToY = wall.to.y - center.y;
  const rToLen = Math.sqrt(rToX * rToX + rToY * rToY);
  const rnToX = rToX / rToLen;
  const rnToY = rToY / rToLen;

  // Outer arc endpoints
  const outerFrom = { x: wall.from.x + rnFromX * half, y: wall.from.y + rnFromY * half };
  const outerTo = { x: wall.to.x + rnToX * half, y: wall.to.y + rnToY * half };

  // Inner arc endpoints
  const innerFrom = { x: wall.from.x - rnFromX * half, y: wall.from.y - rnFromY * half };
  const innerTo = { x: wall.to.x - rnToX * half, y: wall.to.y - rnToY * half };

  // Arc sweep angle determines large-arc-flag
  const arcAngle = 4 * Math.atan(Math.abs(bulge));
  const largeArc = arcAngle > Math.PI ? 1 : 0;

  // SVG sweep-flag: 1 = clockwise in SVG coords (Y-down), 0 = counter-clockwise
  // Positive bulge → CW minor arc in math coords → depends on Y-flip
  // In SVG (Y-down), our arc direction corresponds to sweep-flag:
  // positive bulge: sweep = 1 (CW in SVG = CCW in math → but we need CW in math)
  // Actually, sweep-flag=0 means CCW in SVG (= CW in math Y-up)
  // For positive bulge (CW in math Y-up) → sweep-flag = 0
  // For negative bulge (CCW in math Y-up) → sweep-flag = 1
  const outerSweep = bulge > 0 ? 0 : 1;
  // Inner arc goes in reverse direction
  const innerSweep = outerSweep === 0 ? 1 : 0;

  // Build SVG path: outer arc forward, line to inner, inner arc backward, close
  const d = [
    `M ${outerFrom.x} ${outerFrom.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArc} ${outerSweep} ${outerTo.x} ${outerTo.y}`,
    `L ${innerTo.x} ${innerTo.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArc} ${innerSweep} ${innerFrom.x} ${innerFrom.y}`,
    `Z`,
  ].join(" ");

  return {
    type: "path",
    d,
    fill: "#000000",
    strokeWidth: LINE_WEIGHTS.walls,
    layer: "walls",
    boundingPoints: wall.polygon.map((p) => ({ x: p.x, y: p.y })),
  };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Generate wall scene-graph nodes, splitting straight walls at openings.
 * Curved walls (with bulge) are rendered as a single SGPath (openings not
 * supported on curved walls — they fall back to polygon approximation).
 */
export function wallToPolygons(
  wall: ResolvedWall,
  openings: WallOpening[] = [],
): WallNode[] {
  // Curved wall without openings → SVG path with true arcs
  if (wall.bulge && wall.bulge !== 0 && openings.length === 0) {
    return [curvedWallToPath(wall)];
  }

  // Curved wall with openings → fall back to polygon approximation
  if (wall.bulge && wall.bulge !== 0 && openings.length > 0) {
    return [{
      type: "polygon",
      points: wall.polygon.map((p) => ({ x: p.x, y: p.y })),
      fill: "#000000",
      strokeWidth: LINE_WEIGHTS.walls,
      layer: "walls",
    }];
  }

  // Straight wall without openings
  if (openings.length === 0) {
    return [{
      type: "polygon",
      points: wall.polygon.map((p) => ({ x: p.x, y: p.y })),
      fill: "#000000",
      strokeWidth: LINE_WEIGHTS.walls,
      layer: "walls",
    }];
  }

  // Straight wall with openings → split into segments
  const len = wallLength(wall);
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);

  const nodes: WallNode[] = [];
  let cursor = 0;

  for (const op of sorted) {
    const gapStart = op.offset;
    const gapEnd = op.offset + op.width;
    if (gapStart > cursor) {
      nodes.push(wallSegmentPolygon(wall, cursor, gapStart));
    }
    cursor = gapEnd;
  }

  if (cursor < len) {
    nodes.push(wallSegmentPolygon(wall, cursor, len));
  }

  return nodes;
}

/** Legacy helper — single wall, no openings. */
export function wallsToPolygons(walls: ResolvedWall[]): WallNode[] {
  return walls.flatMap((w) => wallToPolygons(w));
}
