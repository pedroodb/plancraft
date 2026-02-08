/**
 * Door geometry — generates door swing arcs, sliding door lines, and gap lines.
 */

import type { Point, ResolvedDoor } from "@plancraft/dsl";
import type { SGArc, SGLine, SGNode } from "../scene-graph.js";
import { LINE_WEIGHTS } from "../scene-graph.js";

function wallUnitDir(wall: { from: Point; to: Point }): { dx: number; dy: number } {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return { dx: dx / len, dy: dy / len };
}

function wallNormal(wall: { from: Point; to: Point }): { nx: number; ny: number } {
  const { dx, dy } = wallUnitDir(wall);
  return { nx: dy, ny: -dx };
}

export function doorToGeometry(door: ResolvedDoor): SGNode[] {
  if (door.swing === "sliding") {
    return slidingDoorGeometry(door);
  }
  return swingDoorGeometry(door);
}

function swingDoorGeometry(door: ResolvedDoor): SGNode[] {
  const nodes: SGNode[] = [];
  const { dx, dy } = wallUnitDir(door.wall);

  const hinge: Point = { ...door.position };
  const doorEnd: Point = {
    x: hinge.x + dx * door.width,
    y: hinge.y + dy * door.width,
  };

  const wallAngle = Math.atan2(dy, dx);

  let startAngle: number;
  let endAngle: number;

  if (door.swing === "left") {
    startAngle = wallAngle;
    endAngle = wallAngle + Math.PI / 2;
  } else {
    startAngle = wallAngle - Math.PI / 2;
    endAngle = wallAngle;
  }

  const arc: SGArc = {
    type: "arc",
    cx: hinge.x,
    cy: hinge.y,
    r: door.width,
    startAngle,
    endAngle,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(arc);

  const panelLine: SGLine = {
    type: "line",
    x1: hinge.x,
    y1: hinge.y,
    x2: doorEnd.x,
    y2: doorEnd.y,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(panelLine);

  // The open-position line points to the arc endpoint away from the wall:
  // left swing: open position is at endAngle (wall + 90°)
  // right swing: open position is at startAngle (wall - 90°)
  const openAngle = door.swing === "left" ? endAngle : startAngle;
  const openEnd: Point = {
    x: hinge.x + Math.cos(openAngle) * door.width,
    y: hinge.y + Math.sin(openAngle) * door.width,
  };

  const openLine: SGLine = {
    type: "line",
    x1: hinge.x,
    y1: hinge.y,
    x2: openEnd.x,
    y2: openEnd.y,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(openLine);

  return nodes;
}

/**
 * Sliding door: two parallel lines along the wall representing the door panels,
 * offset slightly from each other to show the sliding overlap.
 */
function slidingDoorGeometry(door: ResolvedDoor): SGNode[] {
  const nodes: SGNode[] = [];
  const { dx, dy } = wallUnitDir(door.wall);
  const { nx, ny } = wallNormal(door.wall);

  const start: Point = { ...door.position };
  const end: Point = {
    x: start.x + dx * door.width,
    y: start.y + dy * door.width,
  };

  // Two panel lines offset slightly from the wall centerline
  const panelOffset = door.wall.thickness * 0.15;

  for (const sign of [-1, 1]) {
    const line: SGLine = {
      type: "line",
      x1: start.x + nx * panelOffset * sign,
      y1: start.y + ny * panelOffset * sign,
      x2: end.x + nx * panelOffset * sign,
      y2: end.y + ny * panelOffset * sign,
      strokeWidth: LINE_WEIGHTS.openings,
      layer: "openings",
    };
    nodes.push(line);
  }

  // Arrow/tick marks at the center to indicate sliding direction
  const mid: Point = {
    x: (start.x + end.x) / 2,
    y: (start.y + end.y) / 2,
  };
  const tickLen = door.width * 0.08;

  // Small triangle indicator at midpoint
  const tick: SGLine = {
    type: "line",
    x1: mid.x - dx * tickLen,
    y1: mid.y - dy * tickLen,
    x2: mid.x + dx * tickLen,
    y2: mid.y + dy * tickLen,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(tick);

  return nodes;
}
