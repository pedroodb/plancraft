/**
 * Compact DSL parser for the Plancraft .pc format.
 *
 * Parses the indented, line-oriented DSL into the same ProjectNode AST
 * that the JSONC parser produces. Format example:
 *
 *   plan: Studio Apartment
 *   scale: 100
 *   unit: mm
 *
 *   floor: Ground Floor
 *     room: Studio
 *       wall north 0,0 5000,0 200
 *       door south 2000 900 left
 *       window east 1000 1200 1400 900
 */

import {
  DoorNode,
  FloorNode,
  OpeningNode,
  Point,
  ProjectNode,
  RoomChild,
  RoomNode,
  Scale,
  SwingDirection,
  Unit,
  WallNode,
  WindowNode,
} from "./ast/types.js";
import { ParseError } from "./parser.js";

// ── Constants ────────────────────────────────────────────────────────

const VALID_UNITS = new Set<string>(["mm", "cm", "m", "ft", "in"]);
const VALID_SWINGS = new Set<string>(["left", "right", "double", "sliding"]);

// ── Tokenizer ────────────────────────────────────────────────────────

/**
 * Split a line into tokens, respecting "quoted strings" as single tokens.
 */
function tokenize(line: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = line.length;

  while (i < len) {
    // Skip whitespace
    while (i < len && (line[i] === " " || line[i] === "\t")) i++;
    if (i >= len) break;

    if (line[i] === '"') {
      // Quoted token
      i++; // skip opening quote
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
      if (i < len) i++; // skip closing quote
      tokens.push(token);
    } else {
      // Unquoted token — read until whitespace
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
    throw new ParseError(`${context}: expected coordinate "x,y" but got "${token}"`);
  }
  const x = Number(parts[0]);
  const y = Number(parts[1]);
  if (isNaN(x) || isNaN(y)) {
    throw new ParseError(`${context}: invalid coordinate numbers in "${token}"`);
  }
  return { x, y };
}

/**
 * Parse optional key=value pairs from tokens starting at a given index.
 * Handles both `key=value` and `key="value with spaces"` (which the tokenizer
 * may split across two tokens: `key="value` + `with spaces"`).
 */
function parseKvPairs(tokens: string[], startIdx: number): Map<string, string> {
  const pairs = new Map<string, string>();
  let i = startIdx;
  while (i < tokens.length) {
    const eq = tokens[i].indexOf("=");
    if (eq === -1) {
      throw new ParseError(`Expected key=value but got "${tokens[i]}"`);
    }
    const key = tokens[i].substring(0, eq);
    let value = tokens[i].substring(eq + 1);

    // If value starts with a quote but doesn't end with one,
    // consume subsequent tokens until we find the closing quote.
    if (value.startsWith('"') && !value.endsWith('"')) {
      value = value.slice(1); // remove opening quote
      i++;
      while (i < tokens.length) {
        if (tokens[i].endsWith('"')) {
          value += " " + tokens[i].slice(0, -1);
          break;
        }
        value += " " + tokens[i];
        i++;
      }
    } else if (value.startsWith('"') && value.endsWith('"') && value.length >= 2) {
      // key="value" all in one token
      value = value.slice(1, -1);
    }

    pairs.set(key, value);
    i++;
  }
  return pairs;
}

/**
 * Get the value after a "key: value" line (everything after the first colon + space).
 * Strips surrounding quotes if present.
 */
function parseHeaderValue(line: string): string {
  const colonIdx = line.indexOf(":");
  if (colonIdx === -1) return "";
  let val = line.substring(colonIdx + 1).trim();
  // Strip surrounding quotes
  if (val.length >= 2 && val[0] === '"' && val[val.length - 1] === '"') {
    val = val.slice(1, -1);
  }
  return val;
}

// ── Line parsers ─────────────────────────────────────────────────────

function parseWallLine(tokens: string[], lineNum: number, roomName: string): WallNode {
  // wall <direction> <from_x,from_y> <to_x,to_y> <thickness> [bulge=<n>]
  const ctx = `Line ${lineNum} (wall in "${roomName}")`;
  if (tokens.length < 5) {
    throw new ParseError(`${ctx}: expected "wall <direction> <from> <to> <thickness>"`);
  }
  const direction = tokens[1];
  const from = parseCoord(tokens[2], ctx);
  const to = parseCoord(tokens[3], ctx);
  const thickness = Number(tokens[4]);
  if (isNaN(thickness) || thickness <= 0) {
    throw new ParseError(`${ctx}: thickness must be a number > 0, got "${tokens[4]}"`);
  }

  const node: WallNode = { type: "wall", direction, from, to, thickness };

  // Optional key=value pairs
  const kv = parseKvPairs(tokens, 5);
  if (kv.has("bulge")) {
    const bulge = Number(kv.get("bulge"));
    if (isNaN(bulge)) {
      throw new ParseError(`${ctx}: bulge must be a number, got "${kv.get("bulge")}"`);
    }
    node.bulge = bulge;
  }

  return node;
}

function parseDoorLine(tokens: string[], lineNum: number, roomName: string): DoorNode {
  // door <wall> <offset> <width> <swing>
  const ctx = `Line ${lineNum} (door in "${roomName}")`;
  if (tokens.length < 5) {
    throw new ParseError(`${ctx}: expected "door <wall> <offset> <width> <swing>"`);
  }
  const wallDirection = tokens[1];
  const offset = Number(tokens[2]);
  const width = Number(tokens[3]);
  const swing = tokens[4];

  if (isNaN(offset) || offset < 0) {
    throw new ParseError(`${ctx}: offset must be a number >= 0, got "${tokens[2]}"`);
  }
  if (isNaN(width) || width <= 0) {
    throw new ParseError(`${ctx}: width must be a number > 0, got "${tokens[3]}"`);
  }
  if (!VALID_SWINGS.has(swing)) {
    throw new ParseError(`${ctx}: swing must be one of: left, right, double, sliding`);
  }

  return { type: "door", wallDirection, offset, width, swing: swing as SwingDirection };
}

function parseWindowLine(tokens: string[], lineNum: number, roomName: string): WindowNode {
  // window <wall> <offset> <width> <height> <sill>
  const ctx = `Line ${lineNum} (window in "${roomName}")`;
  if (tokens.length < 6) {
    throw new ParseError(`${ctx}: expected "window <wall> <offset> <width> <height> <sill>"`);
  }
  const wallDirection = tokens[1];
  const offset = Number(tokens[2]);
  const width = Number(tokens[3]);
  const height = Number(tokens[4]);
  const sill = Number(tokens[5]);

  if (isNaN(offset) || offset < 0) {
    throw new ParseError(`${ctx}: offset must be >= 0`);
  }
  if (isNaN(width) || width <= 0) {
    throw new ParseError(`${ctx}: width must be > 0`);
  }
  if (isNaN(height)) {
    throw new ParseError(`${ctx}: height must be a number`);
  }
  if (isNaN(sill)) {
    throw new ParseError(`${ctx}: sill must be a number`);
  }

  return { type: "window", wallDirection, offset, width, height, sill };
}

function parseOpeningLine(tokens: string[], lineNum: number, roomName: string): OpeningNode {
  // opening <wall> <offset> <width>
  const ctx = `Line ${lineNum} (opening in "${roomName}")`;
  if (tokens.length < 4) {
    throw new ParseError(`${ctx}: expected "opening <wall> <offset> <width>"`);
  }
  const wallDirection = tokens[1];
  const offset = Number(tokens[2]);
  const width = Number(tokens[3]);

  if (isNaN(offset) || offset < 0) {
    throw new ParseError(`${ctx}: offset must be >= 0`);
  }
  if (isNaN(width) || width <= 0) {
    throw new ParseError(`${ctx}: width must be > 0`);
  }

  return { type: "opening", wallDirection, offset, width };
}

// ── Main parser ──────────────────────────────────────────────────────

/**
 * Compute the indentation level of a line (number of leading spaces).
 */
function indentLevel(line: string): number {
  let i = 0;
  while (i < line.length && line[i] === " ") i++;
  return i;
}

/**
 * Parse a Plancraft DSL source string into a ProjectNode AST.
 */
export function parsePc(source: string): ProjectNode {
  const lines = source.split("\n");
  let name: string | undefined;
  let scaleRatio = 100;
  let unit: Unit = "mm";
  const floors: FloorNode[] = [];

  let currentFloor: FloorNode | null = null;
  let currentRoom: { name: string; children: RoomChild[] } | null = null;

  for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
    const rawLine = lines[lineIdx];
    const lineNum = lineIdx + 1;

    // Strip trailing whitespace
    const line = rawLine.trimEnd();

    // Skip blank lines
    if (line.trim() === "") continue;

    // Skip comment lines
    const trimmed = line.trim();
    if (trimmed.startsWith("//")) continue;

    // Determine indent level
    const indent = indentLevel(line);

    // Root-level lines (indent 0)
    if (indent === 0) {
      if (trimmed.startsWith("plan:")) {
        name = parseHeaderValue(trimmed);
        if (!name) throw new ParseError(`Line ${lineNum}: plan name cannot be empty`);
      } else if (trimmed.startsWith("scale:")) {
        const val = Number(parseHeaderValue(trimmed));
        if (isNaN(val) || val <= 0) {
          throw new ParseError(`Line ${lineNum}: scale must be a number > 0`);
        }
        scaleRatio = val;
      } else if (trimmed.startsWith("unit:")) {
        const val = parseHeaderValue(trimmed);
        if (!VALID_UNITS.has(val)) {
          throw new ParseError(`Line ${lineNum}: unit must be one of: mm, cm, m, ft, in`);
        }
        unit = val as Unit;
      } else if (trimmed.startsWith("floor:")) {
        // Finalize previous room/floor
        if (currentRoom && currentFloor) {
          currentFloor.children.push({ type: "room", ...currentRoom });
        }
        currentRoom = null;

        const floorName = parseHeaderValue(trimmed);
        if (!floorName) throw new ParseError(`Line ${lineNum}: floor name cannot be empty`);
        currentFloor = { type: "floor", name: floorName, children: [] };
        floors.push(currentFloor);
      } else {
        throw new ParseError(`Line ${lineNum}: unexpected line "${trimmed}"`);
      }
      continue;
    }

    // Floor-level lines (indent ~2)
    if (indent >= 1 && indent <= 3) {
      if (trimmed.startsWith("room:")) {
        if (!currentFloor) {
          throw new ParseError(`Line ${lineNum}: room found outside of a floor`);
        }
        // Finalize previous room
        if (currentRoom) {
          currentFloor.children.push({ type: "room", ...currentRoom });
        }
        const roomName = parseHeaderValue(trimmed);
        if (!roomName) throw new ParseError(`Line ${lineNum}: room name cannot be empty`);
        currentRoom = { name: roomName, children: [] };
        continue;
      }
    }

    // Room-level lines (indent ~4)
    if (indent >= 2) {
      if (!currentRoom) {
        throw new ParseError(`Line ${lineNum}: element found outside of a room`);
      }

      const tokens = tokenize(trimmed);
      if (tokens.length === 0) continue;

      const keyword = tokens[0];
      switch (keyword) {
        case "wall":
          currentRoom.children.push(parseWallLine(tokens, lineNum, currentRoom.name));
          break;
        case "door":
          currentRoom.children.push(parseDoorLine(tokens, lineNum, currentRoom.name));
          break;
        case "window":
          currentRoom.children.push(parseWindowLine(tokens, lineNum, currentRoom.name));
          break;
        case "opening":
          currentRoom.children.push(parseOpeningLine(tokens, lineNum, currentRoom.name));
          break;
        default:
          throw new ParseError(`Line ${lineNum}: unknown keyword "${keyword}"`);
      }
      continue;
    }
  }

  // Finalize last room and floor
  if (currentRoom && currentFloor) {
    currentFloor.children.push({ type: "room", ...currentRoom });
  }

  if (!name) {
    throw new ParseError('Missing "plan:" header');
  }

  const scale: Scale = { ratio: scaleRatio };

  return { type: "project", name, scale, unit, floors };
}
