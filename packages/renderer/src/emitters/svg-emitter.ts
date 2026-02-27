/**
 * SVG Emitter — converts a scene graph into an SVG string.
 *
 * Conventions:
 * - ViewBox is in drawing units (mm at 1:1)
 * - Y-axis is flipped (architectural: Y-up → SVG: Y-down)
 * - Stroke widths are scaled by the project scale ratio
 */

import type { SGArc, SGCircle, SGGroup, SGLine, SGNode, SGPath, SGPolygon, SGSvgEmbed, SGText } from "../scene-graph.js";
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
  /**
   * Optional viewport override. When set, the SVG viewBox is constrained to
   * this bounding box (plus padding) instead of auto-computing from the scene.
   * Useful for rendering a single room or a cropped region.
   */
  viewport?: { minX: number; minY: number; maxX: number; maxY: number };
}

const DEFAULT_OPTIONS: SVGEmitterOptions = {
  scaleRatio: 100,
  padding: 500,
};

export function emitSVG(scene: SGGroup, opts: Partial<SVGEmitterOptions> = {}): string {
  const options = { ...DEFAULT_OPTIONS, ...opts };

  // Compute bounding box (or use the caller-supplied viewport)
  const bbox = options.viewport ?? computeBBox(scene);
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
  lines.push(`  <rect x="${minX}" y="${minY}" width="${width}" height="${height}" fill="#FAF9F5"/>`);

  // Hatch pattern for wall fills
  const hatchSize = 60 * options.scaleRatio / 100;
  lines.push(`  <defs>`);
  lines.push(`    <pattern id="wall-hatch" patternUnits="userSpaceOnUse" width="${hatchSize}" height="${hatchSize}" patternTransform="rotate(45)">`);
  lines.push(`      <line x1="0" y1="0" x2="0" y2="${hatchSize}" stroke="#8B8578" stroke-width="${hatchSize * 0.15}"/>`);
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

    case "path":
      emitPath(node, lines, opts, indent);
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
    // Architectural wall rendering: hatched fill with warm dark outline
    lines.push(
      `${indent}<polygon points="${points}" fill="url(#wall-hatch)" stroke="#2C2A26" stroke-width="${sw}" stroke-linejoin="miter"/>`,
    );
  } else {
    // Non-wall polygons: warm dark stroke for visible outlines
    lines.push(
      `${indent}<polygon points="${points}" fill="${poly.fill}" stroke="#2C2A26" stroke-width="${sw}" stroke-linejoin="miter"/>`,
    );
  }
}

function emitPath(
  pathNode: SGPath,
  lines: string[],
  opts: SVGEmitterOptions,
  indent: string,
): void {
  const sw = pathNode.strokeWidth * opts.scaleRatio;

  if (pathNode.layer === "walls") {
    lines.push(
      `${indent}<path d="${pathNode.d}" fill="url(#wall-hatch)" stroke="#2C2A26" stroke-width="${sw}" stroke-linejoin="miter"/>`,
    );
  } else {
    lines.push(
      `${indent}<path d="${pathNode.d}" fill="${pathNode.fill}" stroke="#2C2A26" stroke-width="${sw}" stroke-linejoin="miter"/>`,
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
    `${indent}<line x1="${line.x1}" y1="${line.y1}" x2="${line.x2}" y2="${line.y2}" stroke="#2C2A26" stroke-width="${sw}"/>`,
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
    `${indent}<path d="${d}" fill="none" stroke="#2C2A26" stroke-width="${sw}"/>`,
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
    `${indent}<circle cx="${circle.cx}" cy="${circle.cy}" r="${circle.r}" fill="${circle.fill}" stroke="#2C2A26" stroke-width="${sw}"/>`,
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
    `${indent}  <text x="0" y="0" font-family="'DM Sans', 'Helvetica Neue', Arial, sans-serif" font-size="${fontSize}" text-anchor="${text.anchor}" dominant-baseline="central" fill="#3D3929">${escapeXml(text.content)}</text>`,
  );
  lines.push(`${indent}</g>`);
}

function emitSvgEmbed(
  embed: SGSvgEmbed,
  lines: string[],
  opts: SVGEmitterOptions,
  indent: string,
): void {
  if (!embed.svgContent) return;

  const scaleX = embed.width / embed.viewBoxWidth;
  const scaleY = embed.height / embed.viewBoxHeight;
  const halfW = embed.width / 2;
  const halfH = embed.height / 2;

  // The scene is inside a scale(1,-1) Y-flip group (architectural Y-up → SVG Y-down).
  // Embedded SVG content uses standard SVG Y-down, so we un-flip it with negative scaleY
  // and adjust the Y translate from -halfH to +halfH to keep the same bounding box.
  let transform: string;
  if (embed.rotation !== 0) {
    transform = `translate(${embed.x},${embed.y}) rotate(${embed.rotation}) translate(${-halfW},${halfH}) scale(${scaleX},${-scaleY})`;
  } else {
    transform = `translate(${embed.x - halfW},${embed.y + halfH}) scale(${scaleX},${-scaleY})`;
  }

  lines.push(`${indent}<g transform="${transform}">`);
  const sanitized = embed.svgContent
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<script[\s\S]*?\/>/gi, "")
    .replace(/\bon\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/\bon\w+\s*=\s*'[^']*'/gi, "")
    .replace(/<foreignObject[\s\S]*?<\/foreignObject>/gi, "")
    // Warm and darken furniture fills for contrast on cream background
    .replace(/fill="#e8e8e8"/gi, 'fill="#D5D3CB"')
    .replace(/fill="#f0f0f0"/gi, 'fill="#E2E0D8"')
    .replace(/fill="#d0d0d0"/gi, 'fill="#C5C3BB"')
    .replace(/fill="#c0c0c0"/gi, 'fill="#B5B3AB"')
    .replace(/fill="#b0b0b0"/gi, 'fill="#A5A39B"')
    .replace(/fill="#a0a0a0"/gi, 'fill="#908E86"')
    // Soften pure black strokes to warm dark
    .replace(/stroke="black"/gi, 'stroke="#2C2A26"')
    .replace(/stroke="#000000"/gi, 'stroke="#2C2A26"');
  lines.push(`${indent}  ${sanitized}`);
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

    case "path": {
      // Use bounding points if available, otherwise skip (path is complex to parse)
      if (node.boundingPoints) {
        for (const p of node.boundingPoints) {
          bbox.minX = Math.min(bbox.minX, p.x);
          bbox.minY = Math.min(bbox.minY, p.y);
          bbox.maxX = Math.max(bbox.maxX, p.x);
          bbox.maxY = Math.max(bbox.maxY, p.y);
        }
      }
      break;
    }
  }
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
