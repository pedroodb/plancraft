/**
 * Compact DSL parser and serializer for the Plancraft .pcf (furniture) format.
 *
 * Format example:
 *
 *   furniture:
 *
 *   placements:
 *     place default/bed at 800,1100 in Studio
 *     place default/sofa at 4000,3450 in Studio scale=90
 *     place default/bed anchor north 0.3 0 in "Master Bedroom"
 *     place default/table rel 0.5,0.5 in "Living Room"
 *
 *   elements:
 *     plant: Potted Plant [living,decoration] 400x400
 *       svg: <svg ...>...</svg>
 *       source: generated
 */

import type {
  FurnitureElementDef,
  FurnitureLayout,
  FurniturePlacement,
  Point,
  WallAnchor,
  RelativePosition,
} from "./types.js";
import { LayoutParseError } from "./layout.js";

// ── Tokenizer ────────────────────────────────────────────────────────

/**
 * Split a line into tokens, respecting "quoted strings" as single tokens.
 */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    while (i < len && (line[i] === " " || line[i] === "\t")) i++;
    if (i >= len) break;

    if (line[i] === '"') {
      i++;
      let token = "";
      while (i < len && line[i] !== '"') {
        if (line[i] === "\\" && i + 1 < len) {
          token += line[i + 1];
          i += 2;
        } else {
          token += line[i];
          i++;
        }
      }
      if (i < len) i++;
      tokens.push(token);
    } else {
      let token = "";
      while (i < len && line[i] !== " " && line[i] !== "\t") {
        token += line[i];
        i++;
      }
      tokens.push(token);
    }
  }

  return tokens;
}

/**
 * Parse a coordinate pair "x,y" into a Point.
 */
function parseCoord(token: string, context: string): Point {
  const parts = token.split(",");
  if (parts.length !== 2) {
    throw new LayoutParseError(`${context}: expected "x,y" but got "${token}"`);
  }
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (isNaN(x) || isNaN(y)) {
    throw new LayoutParseError(`${context}: invalid coordinate in "${token}"`);
  }
  return { x, y };
}

/**
 * Parse key=value pairs from tokens.
 */
function parseKvPairs(tokens: string[], startIdx: number): Map<string, string> {
  const pairs = new Map<string, string>();
  for (let i = startIdx; i < tokens.length; i++) {
    const token = tokens[i];
    const eq = token.indexOf("=");
    if (eq === -1) continue; // skip non-kv tokens
    pairs.set(token.substring(0, eq), token.substring(eq + 1));
  }
  return pairs;
}

/** Quote a string if it contains spaces. */
function q(s: string): string {
  if (s.includes(" ") || s.includes("\t")) return `"${s}"`;
  return s;
}

// ── Placement parser ─────────────────────────────────────────────────

function parsePlacementLine(
  tokens: string[],
  lineNum: number,
): FurniturePlacement {
  // place <element> at <x>,<y> [in <room>] [scale=W[,D]] [rotation=N] [lockProportions=false]
  // place <element> anchor <wall> <along> <offset> in <room> [...]
  // place <element> rel <x>,<y> in <room> [...]
  const ctx = `Line ${lineNum}`;

  if (tokens.length < 3) {
    throw new LayoutParseError(`${ctx}: placement requires at least "place <element> at|anchor|rel ..."`);
  }

  const element = tokens[1];
  const mode = tokens[2]; // at | anchor | rel

  let position: Point = { x: 0, y: 0 };
  let anchor: WallAnchor | undefined;
  let relativePosition: RelativePosition | undefined;
  let room: string | undefined;
  let kvStartIdx: number;

  if (mode === "at") {
    // place <element> at <x>,<y> [in <room>] [kv...]
    if (tokens.length < 4) {
      throw new LayoutParseError(`${ctx}: "at" requires coordinates`);
    }
    position = parseCoord(tokens[3], ctx);
    kvStartIdx = 4;

    // Check for "in <room>"
    if (kvStartIdx < tokens.length && tokens[kvStartIdx] === "in") {
      kvStartIdx++;
      if (kvStartIdx >= tokens.length) {
        throw new LayoutParseError(`${ctx}: "in" requires a room name`);
      }
      room = tokens[kvStartIdx];
      kvStartIdx++;
    }
  } else if (mode === "anchor") {
    // place <element> anchor <wall> <along> <offset> in <room> [kv...]
    if (tokens.length < 7) {
      throw new LayoutParseError(`${ctx}: anchor requires "anchor <wall> <along> <offset> in <room>"`);
    }
    const wall = tokens[3];
    const along = Number(tokens[4]);
    const offset = Number(tokens[5]);

    if (isNaN(along) || along < 0 || along > 1) {
      throw new LayoutParseError(`${ctx}: anchor "along" must be 0-1, got "${tokens[4]}"`);
    }
    if (isNaN(offset)) {
      throw new LayoutParseError(`${ctx}: anchor "offset" must be a number, got "${tokens[5]}"`);
    }

    if (tokens[6] !== "in") {
      throw new LayoutParseError(`${ctx}: expected "in" after anchor offset, got "${tokens[6]}"`);
    }
    if (tokens.length < 8) {
      throw new LayoutParseError(`${ctx}: "in" requires a room name`);
    }
    room = tokens[7];
    anchor = { wall, along, offset };
    kvStartIdx = 8;
  } else if (mode === "rel") {
    // place <element> rel <x>,<y> in <room> [kv...]
    if (tokens.length < 5) {
      throw new LayoutParseError(`${ctx}: "rel" requires coordinates and room`);
    }
    const relCoord = parseCoord(tokens[3], ctx);
    relativePosition = { x: relCoord.x, y: relCoord.y };

    if (tokens[4] !== "in") {
      throw new LayoutParseError(`${ctx}: expected "in" after relative position, got "${tokens[4]}"`);
    }
    if (tokens.length < 6) {
      throw new LayoutParseError(`${ctx}: "in" requires a room name`);
    }
    room = tokens[5];
    kvStartIdx = 6;
  } else {
    throw new LayoutParseError(`${ctx}: expected "at", "anchor", or "rel" after element, got "${mode}"`);
  }

  // Parse optional key=value pairs
  const kv = parseKvPairs(tokens, kvStartIdx);

  let scaleWidth = 100;
  let scaleDepth = 100;
  let lockProportions = true;
  let rotation = 0;

  if (kv.has("scale")) {
    const scaleStr = kv.get("scale")!;
    const scaleParts = scaleStr.split(",");
    scaleWidth = Number(scaleParts[0]);
    if (isNaN(scaleWidth) || scaleWidth <= 0) {
      throw new LayoutParseError(`${ctx}: scale width must be > 0`);
    }
    if (scaleParts.length > 1) {
      scaleDepth = Number(scaleParts[1]);
      if (isNaN(scaleDepth) || scaleDepth <= 0) {
        throw new LayoutParseError(`${ctx}: scale depth must be > 0`);
      }
      lockProportions = false;
    } else {
      scaleDepth = scaleWidth;
    }
  }

  if (kv.has("rotation")) {
    rotation = Number(kv.get("rotation"));
    if (isNaN(rotation)) {
      throw new LayoutParseError(`${ctx}: rotation must be a number`);
    }
    rotation = ((rotation % 360) + 360) % 360;
  }

  if (kv.has("lockProportions")) {
    lockProportions = kv.get("lockProportions") === "true";
  }

  const placement: FurniturePlacement = {
    element,
    position,
    scaleWidth,
    scaleDepth,
    lockProportions,
    rotation,
  };

  if (room !== undefined) placement.room = room;
  if (anchor !== undefined) placement.anchor = anchor;
  if (relativePosition !== undefined) placement.relativePosition = relativePosition;

  return placement;
}

// ── Element definition parser ────────────────────────────────────────

interface ElementDefParseState {
  id: string;
  name: string;
  tags: string[];
  defaultWidth: number;
  defaultDepth: number;
  svg?: string;
  source?: string;
}

function parseElementHeaderLine(tokens: string[], lineNum: number): ElementDefParseState {
  // <id>: <name> [tag1,tag2,...] <width>x<depth>
  // The id has a trailing colon
  const ctx = `Line ${lineNum}`;
  if (tokens.length < 4) {
    throw new LayoutParseError(`${ctx}: element definition requires "<id>: <name> [tags] <width>x<depth>"`);
  }

  let id = tokens[0];
  if (id.endsWith(":")) {
    id = id.slice(0, -1);
  } else {
    throw new LayoutParseError(`${ctx}: element ID must end with ":"`);
  }

  // Name is everything between ID and the [tags] or WxD token
  // Find the tags token (starts with [) and the dimensions token (contains x)
  let nameTokens: string[] = [];
  let tagsStr = "";
  let dimsStr = "";

  for (let i = 1; i < tokens.length; i++) {
    if (tokens[i].startsWith("[") && tokens[i].endsWith("]")) {
      tagsStr = tokens[i].slice(1, -1);
    } else if (/^\d+x\d+$/.test(tokens[i])) {
      dimsStr = tokens[i];
    } else {
      nameTokens.push(tokens[i]);
    }
  }

  const name = nameTokens.join(" ");
  if (!name) throw new LayoutParseError(`${ctx}: element name is required`);

  const tags = tagsStr ? tagsStr.split(",") : [];

  if (!dimsStr) throw new LayoutParseError(`${ctx}: dimensions (WxD) required`);
  const dimParts = dimsStr.split("x");
  const defaultWidth = Number(dimParts[0]);
  const defaultDepth = Number(dimParts[1]);

  return { id, name, tags, defaultWidth, defaultDepth };
}

// ── Main parser ──────────────────────────────────────────────────────

/**
 * Parse a .pcf DSL source string into a FurnitureLayout.
 */
export function parsePcf(source: string): FurnitureLayout {
  const lines = source.split("\n");
  const placements: FurniturePlacement[] = [];
  const elements: Record<string, FurnitureElementDef> = {};

  let state: "root" | "placements" | "elements" | "element-body" = "root";
  let currentElement: ElementDefParseState | null = null;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const lineNum = lineIdx + 1;
    const line = rawLine.trimEnd();
    const trimmed = line.trim();

    // Skip blank lines and comments
    if (trimmed === "" || trimmed.startsWith("//")) continue;

    // Section headers
    if (trimmed === "furniture:" || trimmed === "furniture") {
      // Root header, optional
      continue;
    }

    if (trimmed === "placements:" || trimmed === "placements") {
      // Finalize current element if any
      if (currentElement && state === "element-body") {
        if (!currentElement.svg) {
          throw new LayoutParseError(`Line ${lineNum}: element "${currentElement.id}" missing svg`);
        }
        elements[currentElement.id] = {
          name: currentElement.name,
          tags: currentElement.tags,
          defaultWidth: currentElement.defaultWidth,
          defaultDepth: currentElement.defaultDepth,
          svg: currentElement.svg,
          ...(currentElement.source ? { source: currentElement.source } : {}),
        };
        currentElement = null;
      }
      state = "placements";
      continue;
    }

    if (trimmed === "elements:" || trimmed === "elements") {
      state = "elements";
      continue;
    }

    // Handle placements state
    if (state === "placements" || state === "root") {
      const tokens = tokenize(trimmed);
      if (tokens[0] === "place") {
        placements.push(parsePlacementLine(tokens, lineNum));
        continue;
      }
      // If we see a place in root mode, treat as placements
      if (state === "root") {
        throw new LayoutParseError(`Line ${lineNum}: unexpected line in root: "${trimmed}"`);
      }
    }

    // Handle elements state
    if (state === "elements" || state === "element-body") {
      const indent = line.length - line.trimStart().length;

      // Element body lines (svg:, source:) have higher indent
      if (state === "element-body" && currentElement) {
        if (trimmed.startsWith("svg:")) {
          currentElement.svg = trimmed.substring(4).trim();
          continue;
        }
        if (trimmed.startsWith("source:")) {
          currentElement.source = trimmed.substring(7).trim();
          continue;
        }
        // Handle multiline SVG continuation: if we have an svg that doesn't end
        // with </svg> yet, and this line looks like SVG content, accumulate it.
        if (currentElement.svg && !currentElement.svg.endsWith("</svg>")) {
          currentElement.svg += " " + trimmed;
          continue;
        }
      }

      // Finalize previous element if starting a new one
      if (currentElement) {
        if (!currentElement.svg) {
          throw new LayoutParseError(`Element "${currentElement.id}" missing svg definition`);
        }
        elements[currentElement.id] = {
          name: currentElement.name,
          tags: currentElement.tags,
          defaultWidth: currentElement.defaultWidth,
          defaultDepth: currentElement.defaultDepth,
          svg: currentElement.svg,
          ...(currentElement.source ? { source: currentElement.source } : {}),
        };
        currentElement = null;
      }

      // Check if this line is a section switch
      if (trimmed === "placements:" || trimmed === "placements") {
        state = "placements";
        continue;
      }

      // Start new element definition
      const tokens = tokenize(trimmed);
      currentElement = parseElementHeaderLine(tokens, lineNum);
      state = "element-body";
      continue;
    }
  }

  // Finalize last element
  if (currentElement) {
    if (!currentElement.svg) {
      throw new LayoutParseError(`Element "${currentElement.id}" missing svg definition`);
    }
    elements[currentElement.id] = {
      name: currentElement.name,
      tags: currentElement.tags,
      defaultWidth: currentElement.defaultWidth,
      defaultDepth: currentElement.defaultDepth,
      svg: currentElement.svg,
      ...(currentElement.source ? { source: currentElement.source } : {}),
    };
  }

  const layout: FurnitureLayout = { placements };
  if (Object.keys(elements).length > 0) {
    layout.elements = elements;
  }

  return layout;
}

// ── Serializer ───────────────────────────────────────────────────────

/**
 * Serialize a FurnitureLayout to the compact DSL format.
 */
export function serializePcf(layout: FurnitureLayout): string {
  const lines: string[] = [];
  lines.push("furniture:");

  // Elements section
  if (layout.elements && Object.keys(layout.elements).length > 0) {
    lines.push("");
    lines.push("elements:");
    for (const [id, def] of Object.entries(layout.elements)) {
      const tagsStr = def.tags.length > 0 ? ` [${def.tags.join(",")}]` : "";
      lines.push(`  ${id}: ${def.name}${tagsStr} ${def.defaultWidth}x${def.defaultDepth}`);
      // SVG must be a single line — flatten any multiline SVG content
      const flatSvg = def.svg.replace(/\n/g, "").replace(/\s{2,}/g, " ").trim();
      lines.push(`    svg: ${flatSvg}`);
      if (def.source) {
        lines.push(`    source: ${def.source}`);
      }
    }
  }

  // Placements section
  lines.push("");
  lines.push("placements:");
  for (const p of layout.placements) {
    let line = `  place ${p.element}`;

    if (p.anchor) {
      // Anchor positioning
      line += ` anchor ${q(p.anchor.wall)} ${p.anchor.along} ${p.anchor.offset}`;
      if (p.room) line += ` in ${q(p.room)}`;
    } else if (p.relativePosition) {
      // Relative positioning
      line += ` rel ${p.relativePosition.x},${p.relativePosition.y}`;
      if (p.room) line += ` in ${q(p.room)}`;
    } else {
      // Absolute positioning
      line += ` at ${p.position.x},${p.position.y}`;
      if (p.room) line += ` in ${q(p.room)}`;
    }

    // Optional key=value pairs (only non-defaults)
    const kvParts: string[] = [];
    if (p.scaleWidth !== 100 || p.scaleDepth !== 100) {
      if (p.scaleWidth === p.scaleDepth) {
        kvParts.push(`scale=${p.scaleWidth}`);
      } else {
        kvParts.push(`scale=${p.scaleWidth},${p.scaleDepth}`);
      }
    }
    if (p.rotation !== 0) {
      kvParts.push(`rotation=${p.rotation}`);
    }
    if (!p.lockProportions) {
      kvParts.push("lockProportions=false");
    }

    if (kvParts.length > 0) {
      line += " " + kvParts.join(" ");
    }

    lines.push(line);
  }

  return lines.join("\n") + "\n";
}
