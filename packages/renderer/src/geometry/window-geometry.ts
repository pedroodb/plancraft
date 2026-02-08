/**
 * Window geometry — generates window representation lines.
 *
 * In architectural floor plans, windows are typically shown as:
 * - A gap in the wall
 * - Two parallel lines across the opening (representing the glass panes)
 * - Short perpendicular lines at each end (the frame)
 */

import type { Point, ResolvedWindow } from "@plancraft/dsl";
import type { SGLine, SGNode } from "../scene-graph.js";
import { LINE_WEIGHTS } from "../scene-graph.js";

function wallUnitDir(wall: { from: Point; to: Point }): { dx: number; dy: number } {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { dx: dx / len, dy: dy / len };
}

function wallNormal(wall: { from: Point; to: Point }): { nx: number; ny: number } {
  const { dx, dy } = wallUnitDir(wall);
  return { nx: -dy, ny: dx };
}

export function windowToGeometry(win: ResolvedWindow): SGNode[] {
  const nodes: SGNode[] = [];
  const { dx, dy } = wallUnitDir(win.wall);
  const { nx, ny } = wallNormal(win.wall);
  const halfThick = win.wall.thickness / 2;

  // Window start and end along the wall
  const start: Point = { ...win.position };
  const end: Point = {
    x: start.x + dx * win.width,
    y: start.y + dy * win.width,
  };

  // Two parallel glass lines (offset from centerline by ±1/4 of wall thickness)
  const glassOffset = halfThick * 0.5;

  for (const sign of [-1, 1]) {
    const line: SGLine = {
      type: "line",
      x1: start.x + nx * glassOffset * sign,
      y1: start.y + ny * glassOffset * sign,
      x2: end.x + nx * glassOffset * sign,
      y2: end.y + ny * glassOffset * sign,
      strokeWidth: LINE_WEIGHTS.openings,
      layer: "openings",
    };
    nodes.push(line);
  }

  // Frame lines at each end (short perpendicular lines)
  for (const pt of [start, end]) {
    const frame: SGLine = {
      type: "line",
      x1: pt.x + nx * halfThick,
      y1: pt.y + ny * halfThick,
      x2: pt.x - nx * halfThick,
      y2: pt.y - ny * halfThick,
      strokeWidth: LINE_WEIGHTS.openings,
      layer: "openings",
    };
    nodes.push(frame);
  }

  return nodes;
}
