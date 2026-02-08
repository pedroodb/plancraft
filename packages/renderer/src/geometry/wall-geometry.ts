/**
 * Wall geometry generation — converts resolved walls into scene graph polygons.
 *
 * When openings (doors/windows) are present on a wall, the wall polygon is
 * split into segments with gaps at each opening position.
 */

import type { Point, ResolvedDoor, ResolvedWall, ResolvedWindow } from "@plancraft/dsl";
import type { SGPolygon } from "../scene-graph.js";
import { LINE_WEIGHTS } from "../scene-graph.js";

/** An opening defined by its offset from wall start and width along the wall. */
export interface WallOpening {
  offset: number;
  width: number;
}

/**
 * Build a wall polygon segment between two parametric distances along the wall.
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
 * Compute the wall length.
 */
function wallLength(wall: ResolvedWall): number {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Generate wall polygons, splitting at each opening to leave visible gaps.
 */
export function wallToPolygons(
  wall: ResolvedWall,
  openings: WallOpening[] = [],
): SGPolygon[] {
  if (openings.length === 0) {
    // No openings — emit one solid polygon
    return [{
      type: "polygon",
      points: wall.polygon.map((p) => ({ x: p.x, y: p.y })),
      fill: "#000000",
      strokeWidth: LINE_WEIGHTS.walls,
      layer: "walls",
    }];
  }

  const len = wallLength(wall);

  // Sort openings by offset
  const sorted = [...openings].sort((a, b) => a.offset - b.offset);

  const polygons: SGPolygon[] = [];
  let cursor = 0;

  for (const op of sorted) {
    const gapStart = op.offset;
    const gapEnd = op.offset + op.width;

    // Segment before this opening
    if (gapStart > cursor) {
      polygons.push(wallSegmentPolygon(wall, cursor, gapStart));
    }
    cursor = gapEnd;
  }

  // Segment after last opening
  if (cursor < len) {
    polygons.push(wallSegmentPolygon(wall, cursor, len));
  }

  return polygons;
}

/** Legacy helper — single wall, no openings. */
export function wallsToPolygons(walls: ResolvedWall[]): SGPolygon[] {
  return walls.flatMap((w) => wallToPolygons(w));
}
