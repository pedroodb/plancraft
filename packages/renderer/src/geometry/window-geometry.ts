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

/**
 * Compute the unit direction and effective width for a window opening.
 * If endPosition is available (curved walls), the direction goes from
 * position to endPosition so the window connects the wall gap edges exactly.
 */
function openingDir(
  position: Point,
  endPosition: Point | undefined,
  wall: { from: Point; to: Point },
): { dx: number; dy: number; effectiveWidth: number } {
  if (endPosition) {
    const ddx = endPosition.x - position.x;
    const ddy = endPosition.y - position.y;
    const len = Math.sqrt(ddx * ddx + ddy * ddy);
    if (len > 0) return { dx: ddx / len, dy: ddy / len, effectiveWidth: len };
  }
  const wdx = wall.to.x - wall.from.x;
  const wdy = wall.to.y - wall.from.y;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  if (wlen < 0.01) return { dx: 1, dy: 0, effectiveWidth: 0 };
  return { dx: wdx / wlen, dy: wdy / wlen, effectiveWidth: 0 };
}

function wallNormal(wall: { from: Point; to: Point }): { nx: number; ny: number } {
  const wdx = wall.to.x - wall.from.x;
  const wdy = wall.to.y - wall.from.y;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  if (wlen < 0.01) return { nx: 0, ny: 1 };
  return { nx: -wdy / wlen, ny: wdx / wlen };
}

export function windowToGeometry(win: ResolvedWindow): SGNode[] {
  const nodes: SGNode[] = [];
  const { dx, dy, effectiveWidth } = openingDir(win.position, win.endPosition, win.wall);
  const { nx, ny } = wallNormal(win.wall);
  const halfThick = win.wall.thickness / 2;
  const winWidth = effectiveWidth || win.width;

  // Window start and end along the wall
  const start: Point = { ...win.position };
  const end: Point = {
    x: start.x + dx * winWidth,
    y: start.y + dy * winWidth,
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
