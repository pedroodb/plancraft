/**
 * Door geometry — generates door swing arcs, sliding door lines, and gap lines.
 */

import type { Point, ResolvedDoor } from "@plancraft/dsl";
import type { SGArc, SGLine, SGNode } from "../scene-graph.js";
import { LINE_WEIGHTS } from "../scene-graph.js";

/**
 * Compute the unit direction and effective width for a door/window opening.
 * If endPosition is available (curved walls), the direction is from position
 * to endPosition so the opening connects the two wall gap edges exactly.
 * Otherwise, uses the wall chord direction.
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
  return { nx: wdy / wlen, ny: -wdx / wlen };
}

export function doorToGeometry(door: ResolvedDoor): SGNode[] {
  if (door.swing === "sliding") {
    return slidingDoorGeometry(door);
  }
  if (door.swing === "double") {
    return doubleDoorGeometry(door);
  }
  return swingDoorGeometry(door);
}

function swingDoorGeometry(door: ResolvedDoor): SGNode[] {
  const nodes: SGNode[] = [];
  const { dx, dy, effectiveWidth } = openingDir(door.position, door.endPosition, door.wall);
  const panelWidth = effectiveWidth || door.width;

  const hinge: Point = { ...door.position };
  const doorEnd: Point = {
    x: hinge.x + dx * panelWidth,
    y: hinge.y + dy * panelWidth,
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
    r: panelWidth,
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
    x: hinge.x + Math.cos(openAngle) * panelWidth,
    y: hinge.y + Math.sin(openAngle) * panelWidth,
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
 * Double door: two panels opening from the center, each swinging outward.
 * Left panel swings left, right panel swings right.
 */
function doubleDoorGeometry(door: ResolvedDoor): SGNode[] {
  const nodes: SGNode[] = [];
  const { dx, dy, effectiveWidth } = openingDir(door.position, door.endPosition, door.wall);
  const totalWidth = effectiveWidth || door.width;
  const halfWidth = totalWidth / 2;

  const wallAngle = Math.atan2(dy, dx);

  // Left panel: hinge at left edge, opens outward (arc from center toward left-open position)
  const leftHinge: Point = { ...door.position };
  const leftEnd: Point = {
    x: leftHinge.x + dx * halfWidth,
    y: leftHinge.y + dy * halfWidth,
  };

  // Left panel: arc sweeps from wall direction (pointing right toward center) to 90 degrees open
  const leftArc: SGArc = {
    type: "arc",
    cx: leftHinge.x,
    cy: leftHinge.y,
    r: halfWidth,
    startAngle: wallAngle,
    endAngle: wallAngle + Math.PI / 2,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(leftArc);

  // Left panel line (closed position, along wall toward center)
  const leftPanel: SGLine = {
    type: "line",
    x1: leftHinge.x,
    y1: leftHinge.y,
    x2: leftEnd.x,
    y2: leftEnd.y,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(leftPanel);

  // Left panel open position line
  const leftOpenEnd: Point = {
    x: leftHinge.x + Math.cos(wallAngle + Math.PI / 2) * halfWidth,
    y: leftHinge.y + Math.sin(wallAngle + Math.PI / 2) * halfWidth,
  };
  const leftOpenLine: SGLine = {
    type: "line",
    x1: leftHinge.x,
    y1: leftHinge.y,
    x2: leftOpenEnd.x,
    y2: leftOpenEnd.y,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(leftOpenLine);

  // Right panel: hinge at right edge, opens outward
  const rightHinge: Point = {
    x: door.position.x + dx * totalWidth,
    y: door.position.y + dy * totalWidth,
  };
  const rightEnd: Point = {
    x: rightHinge.x - dx * halfWidth,
    y: rightHinge.y - dy * halfWidth,
  };

  // Right panel: arc sweeps from -90 degrees open to wall direction (pointing left toward center)
  const rightArc: SGArc = {
    type: "arc",
    cx: rightHinge.x,
    cy: rightHinge.y,
    r: halfWidth,
    startAngle: wallAngle + Math.PI - Math.PI / 2,
    endAngle: wallAngle + Math.PI,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(rightArc);

  // Right panel line (closed position, along wall toward center)
  const rightPanel: SGLine = {
    type: "line",
    x1: rightHinge.x,
    y1: rightHinge.y,
    x2: rightEnd.x,
    y2: rightEnd.y,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(rightPanel);

  // Right panel open position line
  const rightOpenEnd: Point = {
    x: rightHinge.x + Math.cos(wallAngle + Math.PI - Math.PI / 2) * halfWidth,
    y: rightHinge.y + Math.sin(wallAngle + Math.PI - Math.PI / 2) * halfWidth,
  };
  const rightOpenLine: SGLine = {
    type: "line",
    x1: rightHinge.x,
    y1: rightHinge.y,
    x2: rightOpenEnd.x,
    y2: rightOpenEnd.y,
    strokeWidth: LINE_WEIGHTS.openings,
    layer: "openings",
  };
  nodes.push(rightOpenLine);

  return nodes;
}

/**
 * Sliding door: two parallel lines along the wall representing the door panels,
 * offset slightly from each other to show the sliding overlap.
 */
function slidingDoorGeometry(door: ResolvedDoor): SGNode[] {
  const nodes: SGNode[] = [];
  const { dx, dy, effectiveWidth } = openingDir(door.position, door.endPosition, door.wall);
  const { nx, ny } = wallNormal(door.wall);
  const slideWidth = effectiveWidth || door.width;

  const start: Point = { ...door.position };
  const end: Point = {
    x: start.x + dx * slideWidth,
    y: start.y + dy * slideWidth,
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
