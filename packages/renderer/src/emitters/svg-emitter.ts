/**
 * SVG Emitter — converts a scene graph into an SVG string.
 *
 * Conventions:
 * - ViewBox is in drawing units (mm at 1:1)
 * - Y-axis is flipped (architectural: Y-up → SVG: Y-down)
 * - Stroke widths are scaled by the project scale ratio
 */

import type { SGArc, SGCircle, SGGroup, SGLine, SGNode, SGPolygon, SGSvgEmbed, SGText } from "../scene-graph.js";
import type { Layer } from "../scene-graph.js";

export interface SVGEmitterOptions {
  /** Scale ratio (e.g. 100 for 1:100). Stroke widths are multiplied by this. */
  scaleRatio: number;
  /** Padding around the drawing in drawing units */
  padding: number;
  /**
   * Filter which layers to include in the output.
   * If undefined or empty, all layers are included.
   * Example: ["walls", "openings", "labels"] for structure-only output.
   */
  layers?: Layer[];
}

const DEFAULT_OPTIONS: SVGEmitterOptions = {
  scaleRatio: 100,
  padding: 500,
};

export function emitSVG(scene: SGGroup, opts: Partial<SVGEmitterOptions> = {}): string {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  // Compute bounding box
  const bbox = computeBBox(scene);
  const pad = options.padding;

  const minX = bbox.minX - pad;
  const minY = bbox.minY - pad;
  const width = bbox.maxX - bbox.minX + pad * 2;
  const height = bbox.maxY - bbox.minY + pad * 2;

  const lines: string[] = [];
  lines.push(`<?xml version="1.0" encoding="UTF-8"?>`);
  lines.push(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${minX} ${minY} ${width} ${height}" width="${width}" height="${height}">`,
  );

  // Background
  lines.push(`  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="white"/>`);

  // Hatch pattern for wall fills
  const hatchSize = 60 * options.scaleRatio / 100;
  lines.push(`  <defs>`);
  lines.push(`    <pattern id="wall-hatch" patternUnits="userSpaceOnUse" width="${hatchSize}" height="${hatchSize}" patternTransform="rotate(45)">`);
  lines.push(`      <line x1="0" y1="0" x2="0" y2="${hatchSize}" stroke="#666" stroke-width="${hatchSize * 0.15}"/>`);
  lines.push(`    </pattern>`);
  lines.push(`  </defs>`);

  // Y-flip group: we flip the Y axis so that positive Y goes up (architectural convention)
  // We transform: scale(1, -1) and translate to compensate
  lines.push(`  <g transform="scale(1,-1) translate(0,${-(minY * 2 + height)})">`);

  emitNode(scene, lines, options, 2);

  lines.push(`  </g>`);
  lines.push(`</svg>`);

  return lines.join("\n");
}

/** Check if a node should be included given the layer filter */
function shouldInclude(node: SGNode, opts: SVGEmitterOptions): boolean {
  if (!opts.layers || opts.layers.length === 0) return true;
  if (node.type === "group") return true; // groups are always traversed
  return opts.layers.includes((node as { layer: Layer }).layer);
}

function emitNode(
  node: SGNode,
  lines: string[],
  opts: SVGEmitterOptions,
  depth: number,
): void {
  if (!shouldInclude(node, opts)) return;

  const indent = "  ".repeat(depth);

  switch (node.type) {
    case "group": {
      // For groups, check if any children pass the filter before emitting
      const filteredChildren = node.children.filter((c) => shouldInclude(c, opts) || c.type === "group");
      if (filteredChildren.length === 0) break;
      lines.push(`${indent}<g id="${escapeXml(node.id)}">`);
      for (const child of node.children) {
        emitNode(child, lines, opts, depth + 1);
      }
      lines.push(`${indent}</g>`);
      break;
    }

    case "polygon":
      emitPolygon(node, lines, opts, indent);
      break;

    case "line":
      emitLine(node, lines, opts, indent);
      break;

    case "arc":
      emitArc(node, lines, opts, indent);
      break;

    case "text":
      emitText(node, lines, opts, indent);
      break;

    case "circle":
      emitCircle(node, lines, opts, indent);
      break;

    case "svg_embed":
      emitSvgEmbed(node, lines, opts, indent);
      break;
  }
}

function emitPolygon(
  poly: SGPolygon,
  lines: string[],
  opts: SVGEmitterOptions,
  indent: string,
): void {
  const points = poly.points.map((p) => `${p.x},${p.y}`).join(" ");
  const sw = poly.strokeWidth * opts.scaleRatio;

  if (poly.layer === "walls") {
    // Architectural wall rendering: hatched fill with black outline
    lines.push(
      `${indent}<polygon points="${points}" fill="url(#wall-hatch)" stroke="black" stroke-width="${sw}" stroke-linejoin="miter"/>`,
    );
  } else {
    // Non-wall polygons: always use black stroke so outlines are visible
    lines.push(
      `${indent}<polygon points="${points}" fill="${poly.fill}" stroke="black" stroke-width="${sw}" stroke-linejoin="miter"/>`,
    );
  }
}

function emitLine(
  line: SGLine,
  lines: string[],
  opts: SVGEmitterOptions,
  indent: string,
): void {
  const sw = line.strokeWidth * opts.scaleRatio;
  lines.push(
    `${indent}<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="black" stroke-width="${sw}"/>`,
  );
}

function emitArc(
  arc: SGArc,
  lines: string[],
  opts: SVGEmitterOptions,
  indent: string,
): void {
  const sw = arc.strokeWidth * opts.scaleRatio;

  // Convert arc to SVG path using the arc command
  const startX = arc.cx + arc.r * Math.cos(arc.startAngle);
  const startY = arc.cy + arc.r * Math.sin(arc.startAngle);
  const endX = arc.cx + arc.r * Math.cos(arc.endAngle);
  const endY = arc.cy + arc.r * Math.sin(arc.endAngle);

  // Determine if the arc is > 180° (large-arc-flag)
  const angleDiff = arc.endAngle - arc.startAngle;
  const largeArc = Math.abs(angleDiff) > Math.PI ? 1 : 0;
  // Sweep flag: 1 for CW in SVG coordinate system
  const sweep = angleDiff > 0 ? 1 : 0;

  const d = `M ${startX} ${startY} A ${arc.r} ${arc.r} 0 ${largeArc} ${sweep} ${endX} ${endY}`;
  lines.push(
    `${indent}<path d="${d}" fill="none" stroke="black" stroke-width="${sw}"/>`,
  );
}

function emitCircle(
  circle: SGCircle,
  lines: string[],
  opts: SVGEmitterOptions,
  indent: string,
): void {
  const sw = circle.strokeWidth * opts.scaleRatio;
  lines.push(
    `${indent}<circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.r}" fill="${circle.fill}" stroke="black" stroke-width="${sw}"/>`,
  );
}

function emitText(
  text: SGText,
  lines: string[],
  opts: SVGEmitterOptions,
  indent: string,
): void {
  // Text needs special handling because of Y-flip: we un-flip the text
  // so it reads correctly (otherwise it would be mirrored)
  const fontSize = text.fontSize;
  lines.push(
    `${indent}<g transform="translate(${text.x},${text.y}) scale(1,-1)">`,
  );
  lines.push(
    `${indent}  <text x="0" y="0" font-family="Arial, sans-serif" font-size="${fontSize}" text-anchor="${text.anchor}" fill="black">${escapeXml(text.content)}</text>`,
  );
  lines.push(`${indent}</g>`);
}

function emitSvgEmbed(
  embed: SGSvgEmbed,
  lines: string[],
  opts: SVGEmitterOptions,
  indent: string,
): void {
  // Scale the SVG content from its viewBox to the target dimensions
  const scaleX = embed.width / embed.viewBoxWidth;
  const scaleY = embed.height / embed.viewBoxHeight;

  // Build transform: translate to center, rotate, then scale and offset to top-left
  // The SVG content origin is at (0,0), so we translate to position it correctly.
  // Center position in plan coords → translate so the element center is at (x, y)
  const halfW = embed.width / 2;
  const halfH = embed.height / 2;

  // We need to account for Y-flip: since the scene is already in a scale(1,-1) group,
  // the SVG embed content (which uses standard SVG Y-down) would be flipped.
  // We un-flip the embedded content so it renders correctly.
  let transform = `translate(${embed.x - halfW},${embed.y - halfH})`;
  transform += ` scale(${scaleX},${scaleY})`;

  if (embed.rotation !== 0) {
    // Rotate around the center of the element in viewBox coordinates
    const cx = embed.viewBoxWidth / 2;
    const cy = embed.viewBoxHeight / 2;
    transform = `translate(${embed.x},${embed.y}) rotate(${embed.rotation}) translate(${-halfW},${-halfH}) scale(${scaleX},${scaleY})`;
  }

  // Wrap in a group that un-flips the Y axis for the embedded SVG content
  lines.push(`${indent}<g transform="${transform}">`);
  // The embedded SVG content uses standard SVG coordinates
  lines.push(`${indent}  ${embed.svgContent}`);
  lines.push(`${indent}</g>`);
}

// ── Bounding box calculation ──────────────────────────────────────

interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

function computeBBox(node: SGNode): BBox {
  const bbox: BBox = {
    minX: Infinity,
    minY: Infinity,
    maxX: -Infinity,
    maxY: -Infinity,
  };
  expandBBox(node, bbox);
  return bbox;
}

function expandBBox(node: SGNode, bbox: BBox): void {
  switch (node.type) {
    case "group":
      for (const child of node.children) expandBBox(child, bbox);
      break;

    case "polygon":
      for (const p of node.points) {
        bbox.minX = Math.min(bbox.minX, p.x);
        bbox.minY = Math.min(bbox.minY, p.y);
        bbox.maxX = Math.max(bbox.maxX, p.x);
        bbox.maxY = Math.max(bbox.maxY, p.y);
      }
      break;

    case "line":
      bbox.minX = Math.min(bbox.minX, node.x1, node.x2);
      bbox.minY = Math.min(bbox.minY, node.y1, node.y2);
      bbox.maxX = Math.max(bbox.maxX, node.x1, node.x2);
      bbox.maxY = Math.max(bbox.maxY, node.y1, node.y2);
      break;

    case "arc":
      bbox.minX = Math.min(bbox.minX, node.cx - node.r);
      bbox.minY = Math.min(bbox.minY, node.cy - node.r);
      bbox.maxX = Math.max(bbox.maxX, node.cx + node.r);
      bbox.maxY = Math.max(bbox.maxY, node.cy + node.r);
      break;

    case "text":
      // Approximate text bounds
      bbox.minX = Math.min(bbox.minX, node.x - 500);
      bbox.minY = Math.min(bbox.minY, node.y - 500);
      bbox.maxX = Math.max(bbox.maxX, node.x + 500);
      bbox.maxY = Math.max(bbox.maxY, node.y + 500);
      break;

    case "circle":
      bbox.minX = Math.min(bbox.minX, node.cx - node.r);
      bbox.minY = Math.min(bbox.minY, node.cy - node.r);
      bbox.maxX = Math.max(bbox.maxX, node.cx + node.r);
      bbox.maxY = Math.max(bbox.maxY, node.cy + node.r);
      break;

    case "svg_embed": {
      const halfW = node.width / 2;
      const halfH = node.height / 2;
      bbox.minX = Math.min(bbox.minX, node.x - halfW);
      bbox.minY = Math.min(bbox.minY, node.y - halfH);
      bbox.maxX = Math.max(bbox.maxX, node.x + halfW);
      bbox.maxY = Math.max(bbox.maxY, node.y + halfH);
      break;
    }
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
