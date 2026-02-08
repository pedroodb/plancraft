/**
 * Dimension line generation — extension lines, tick marks, and measurement text.
 *
 * Uses architectural convention: 45° tick marks instead of arrowheads.
 */

import type { ResolvedDimChain, ResolvedDimension } from "@plancraft/dsl";
import type { SGLine, SGNode, SGText } from "./scene-graph.js";
import { LINE_WEIGHTS } from "./scene-graph.js";

const TICK_SIZE = 80; // length of 45° tick mark in drawing units
const FONT_SIZE = 120; // text size in drawing units
const EXTENSION_OVERSHOOT = 100; // how far extension lines extend past dimension line

export function dimensionToGeometry(dim: ResolvedDimension): SGNode[] {
  const nodes: SGNode[] = [];

  // Determine offset direction (perpendicular to the wall)
  const dx = dim.to.x - dim.from.x;
  const dy = dim.to.y - dim.from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  const ux = dx / len;
  const uy = dy / len;

  // Normal (perpendicular, offset direction)
  const nx = -uy;
  const ny = ux;

  // Offset points for the dimension line
  const offsetX = nx * dim.offset;
  const offsetY = ny * dim.offset;

  const p1 = { x: dim.from.x + offsetX, y: dim.from.y + offsetY };
  const p2 = { x: dim.to.x + offsetX, y: dim.to.y + offsetY };

  // Main dimension line
  const dimLine: SGLine = {
    type: "line",
    x1: p1.x,
    y1: p1.y,
    x2: p2.x,
    y2: p2.y,
    strokeWidth: LINE_WEIGHTS.dimensions,
    layer: "dimensions",
  };
  nodes.push(dimLine);

  // Extension lines (from wall to dimension line + overshoot)
  for (const [wallPt, dimPt] of [
    [dim.from, p1],
    [dim.to, p2],
  ] as const) {
    const ext: SGLine = {
      type: "line",
      x1: wallPt.x + nx * 50, // small gap from wall
      y1: wallPt.y + ny * 50,
      x2: dimPt.x + nx * EXTENSION_OVERSHOOT,
      y2: dimPt.y + ny * EXTENSION_OVERSHOOT,
      strokeWidth: LINE_WEIGHTS.dimensions,
      layer: "dimensions",
    };
    nodes.push(ext);
  }

  // 45° tick marks at each end
  for (const pt of [p1, p2]) {
    const tickHalf = TICK_SIZE / 2;
    // 45° diagonal aligned with dimension line direction
    const tick: SGLine = {
      type: "line",
      x1: pt.x - (ux + nx) * tickHalf,
      y1: pt.y - (uy + ny) * tickHalf,
      x2: pt.x + (ux + nx) * tickHalf,
      y2: pt.y + (uy + ny) * tickHalf,
      strokeWidth: LINE_WEIGHTS.dimensions,
      layer: "dimensions",
    };
    nodes.push(tick);
  }

  // Measurement text at midpoint
  const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
  // Offset text slightly from the dimension line
  const textOffset = 60;
  const text: SGText = {
    type: "text",
    x: mid.x + nx * textOffset,
    y: mid.y + ny * textOffset,
    content: Math.round(dim.length).toString(),
    fontSize: FONT_SIZE,
    anchor: "middle",
    layer: "dimensions",
  };
  nodes.push(text);

  return nodes;
}

/**
 * Dimension chain: multiple aligned segments sharing a common offset baseline.
 * Extension lines are drawn for each waypoint, tick marks at each point,
 * and measurement text centered on each segment.
 */
export function dimChainToGeometry(chain: ResolvedDimChain): SGNode[] {
  const nodes: SGNode[] = [];
  const nx = chain.normal.x;
  const ny = chain.normal.y;
  const offsetX = nx * chain.offset;
  const offsetY = ny * chain.offset;

  // Collect all unique waypoints (start of each segment + end of last)
  const waypoints: Array<{ x: number; y: number }> = [];
  for (const seg of chain.segments) {
    if (waypoints.length === 0) {
      waypoints.push(seg.from);
    }
    waypoints.push(seg.to);
  }

  // Extension lines from wall to dimension baseline + overshoot
  for (const pt of waypoints) {
    const ext: SGLine = {
      type: "line",
      x1: pt.x + nx * 50,
      y1: pt.y + ny * 50,
      x2: pt.x + offsetX + nx * EXTENSION_OVERSHOOT,
      y2: pt.y + offsetY + ny * EXTENSION_OVERSHOOT,
      strokeWidth: LINE_WEIGHTS.dimensions,
      layer: "dimensions",
    };
    nodes.push(ext);
  }

  // For each segment: dimension line, tick marks, text
  for (const seg of chain.segments) {
    const p1 = { x: seg.from.x + offsetX, y: seg.from.y + offsetY };
    const p2 = { x: seg.to.x + offsetX, y: seg.to.y + offsetY };

    // Wall unit direction for this segment
    const sdx = seg.to.x - seg.from.x;
    const sdy = seg.to.y - seg.from.y;
    const slen = Math.sqrt(sdx * sdx + sdy * sdy);
    const ux = sdx / slen;
    const uy = sdy / slen;

    // Dimension line
    const dimLine: SGLine = {
      type: "line",
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      strokeWidth: LINE_WEIGHTS.dimensions,
      layer: "dimensions",
    };
    nodes.push(dimLine);

    // 45° tick marks at each end
    for (const pt of [p1, p2]) {
      const tickHalf = TICK_SIZE / 2;
      const tick: SGLine = {
        type: "line",
        x1: pt.x - (ux + nx) * tickHalf,
        y1: pt.y - (uy + ny) * tickHalf,
        x2: pt.x + (ux + nx) * tickHalf,
        y2: pt.y + (uy + ny) * tickHalf,
        strokeWidth: LINE_WEIGHTS.dimensions,
        layer: "dimensions",
      };
      nodes.push(tick);
    }

    // Measurement text at midpoint
    const mid = { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 };
    const textOffset = 60;
    const text: SGText = {
      type: "text",
      x: mid.x + nx * textOffset,
      y: mid.y + ny * textOffset,
      content: Math.round(seg.length).toString(),
      fontSize: FONT_SIZE,
      anchor: "middle",
      layer: "dimensions",
    };
    nodes.push(text);
  }

  return nodes;
}
