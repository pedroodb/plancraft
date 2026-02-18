/**
 * JSON-based parser for the Plancraft format.
 *
 * Parses JSONC (JSON with Comments) source text and transforms it into
 * the internal ProjectNode AST that the resolver consumes.
 */

import {
  DoorNode,
  FloorChild,
  FloorNode,
  OpeningNode,
  Point,
  ProjectNode,
  RoomChild,
  RoomNode,
  Scale,
  SharedWallNode,
  SwingDirection,
  Unit,
  WallNode,
  WindowNode,
} from "./ast/types.js";

// ── Error type ────────────────────────────────────────────────────────

export class ParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ParseError";
  }
}

// ── JSONC comment stripping ──────────────────────────────────────────

/**
 * Strip // and /* ... *​/ comments from JSONC source, respecting string literals.
 */
function stripJsonComments(source: string): string {
  let result = "";
  let i = 0;
  const len = source.length;

  while (i < len) {
    // String literal — copy through without modification
    if (source[i] === '"') {
      result += '"';
      i++;
      while (i < len && source[i] !== '"') {
        if (source[i] === '\\') {
          result += source[i];
          i++;
          if (i < len) {
            result += source[i];
            i++;
          }
        } else {
          result += source[i];
          i++;
        }
      }
      if (i < len) {
        result += '"';
        i++;
      }
      continue;
    }

    // Line comment
    if (source[i] === '/' && i + 1 < len && source[i + 1] === '/') {
      i += 2;
      while (i < len && source[i] !== '\n') i++;
      continue;
    }

    // Block comment
    if (source[i] === '/' && i + 1 < len && source[i + 1] === '*') {
      i += 2;
      while (i < len && !(source[i] === '*' && i + 1 < len && source[i + 1] === '/')) i++;
      if (i < len) i += 2; // skip */
      continue;
    }

    result += source[i];
    i++;
  }

  return result;
}

// ── Validation helpers ───────────────────────────────────────────────

const VALID_UNITS = new Set(["mm", "cm", "m", "ft", "in"]);
const VALID_SWINGS = new Set(["left", "right", "sliding"]);
function requireString(obj: Record<string, unknown>, field: string, context: string): string {
  const val = obj[field];
  if (typeof val !== "string") {
    throw new ParseError(`${context}: "${field}" must be a string`);
  }
  return val;
}

function requireNumber(obj: Record<string, unknown>, field: string, context: string): number {
  const val = obj[field];
  if (typeof val !== "number") {
    throw new ParseError(`${context}: "${field}" must be a number`);
  }
  return val;
}

function optionalNumber(obj: Record<string, unknown>, field: string, defaultValue: number): number {
  const val = obj[field];
  if (val === undefined || val === null) return defaultValue;
  if (typeof val !== "number") {
    throw new ParseError(`"${field}" must be a number when provided`);
  }
  return val;
}

function requireArray(obj: Record<string, unknown>, field: string, context: string): unknown[] {
  const val = obj[field];
  if (!Array.isArray(val)) {
    throw new ParseError(`${context}: "${field}" must be an array`);
  }
  return val;
}

function optionalArray(obj: Record<string, unknown>, field: string): unknown[] {
  const val = obj[field];
  if (val === undefined || val === null) return [];
  if (!Array.isArray(val)) {
    throw new ParseError(`"${field}" must be an array when provided`);
  }
  return val;
}

function requirePoint(obj: unknown, context: string): Point {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new ParseError(`${context}: expected a point object {"x": number, "y": number}`);
  }
  const rec = obj as Record<string, unknown>;
  return {
    x: requireNumber(rec, "x", context),
    y: requireNumber(rec, "y", context),
  };
}

// ── Transform functions ──────────────────────────────────────────────

function transformWall(raw: unknown, roomName: string): WallNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError(`Wall in room "${roomName}" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Wall in room "${roomName}"`;
  const thickness = requireNumber(obj, "thickness", ctx);
  if (thickness <= 0) {
    throw new ParseError(`${ctx}: "thickness" must be greater than 0`);
  }
  const node: WallNode = {
    type: "wall",
    direction: requireString(obj, "direction", ctx),
    from: requirePoint(obj["from"], `${ctx} "from"`),
    to: requirePoint(obj["to"], `${ctx} "to"`),
    thickness,
  };
  // Optional bulge (wall curvature)
  if (obj["bulge"] !== undefined && obj["bulge"] !== null) {
    if (typeof obj["bulge"] !== "number") {
      throw new ParseError(`${ctx}: "bulge" must be a number when provided`);
    }
    node.bulge = obj["bulge"] as number;
  }
  return node;
}

function transformSharedWall(raw: unknown, roomName: string): SharedWallNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError(`Shared wall in room "${roomName}" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Shared wall in room "${roomName}"`;
  const direction = requireString(obj, "direction", ctx);
  const sourceRoom = requireString(obj, "sourceRoom", ctx);
  const sourceWall = typeof obj["sourceWall"] === "string" ? obj["sourceWall"] as string : direction;
  return {
    type: "shared_wall",
    direction,
    sourceWallDirection: sourceWall,
    sourceRoomName: sourceRoom,
  };
}

function transformDoor(raw: unknown, roomName: string): DoorNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError(`Door in room "${roomName}" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Door in room "${roomName}"`;
  const swing = requireString(obj, "swing", ctx);
  if (!VALID_SWINGS.has(swing)) {
    throw new ParseError(`${ctx}: "swing" must be one of: left, right, sliding`);
  }
  const offset = requireNumber(obj, "offset", ctx);
  const width = requireNumber(obj, "width", ctx);
  if (offset < 0) {
    throw new ParseError(`${ctx}: "offset" must be >= 0`);
  }
  if (width <= 0) {
    throw new ParseError(`${ctx}: "width" must be > 0`);
  }
  return {
    type: "door",
    wallDirection: requireString(obj, "wall", ctx),
    offset,
    width,
    swing: swing as SwingDirection,
  };
}

function transformWindow(raw: unknown, roomName: string): WindowNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError(`Window in room "${roomName}" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Window in room "${roomName}"`;
  const offset = requireNumber(obj, "offset", ctx);
  const width = requireNumber(obj, "width", ctx);
  if (offset < 0) {
    throw new ParseError(`${ctx}: "offset" must be >= 0`);
  }
  if (width <= 0) {
    throw new ParseError(`${ctx}: "width" must be > 0`);
  }
  return {
    type: "window",
    wallDirection: requireString(obj, "wall", ctx),
    offset,
    width,
    height: requireNumber(obj, "height", ctx),
    sill: requireNumber(obj, "sill", ctx),
  };
}

function transformOpening(raw: unknown, roomName: string): OpeningNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError(`Opening in room "${roomName}" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Opening in room "${roomName}"`;
  const offset = requireNumber(obj, "offset", ctx);
  const width = requireNumber(obj, "width", ctx);
  if (offset < 0) {
    throw new ParseError(`${ctx}: "offset" must be >= 0`);
  }
  if (width <= 0) {
    throw new ParseError(`${ctx}: "width" must be > 0`);
  }
  return {
    type: "opening",
    wallDirection: requireString(obj, "wall", ctx),
    offset,
    width,
  };
}

function transformRoom(raw: unknown, floorName: string): RoomNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError(`Room in floor "${floorName}" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Room in floor "${floorName}"`;
  const name = requireString(obj, "name", ctx);

  // Merge typed arrays into flat children array
  const children: RoomChild[] = [];

  for (const w of optionalArray(obj, "walls")) {
    children.push(transformWall(w, name));
  }
  for (const sw of optionalArray(obj, "sharedWalls")) {
    children.push(transformSharedWall(sw, name));
  }
  for (const d of optionalArray(obj, "doors")) {
    children.push(transformDoor(d, name));
  }
  for (const w of optionalArray(obj, "windows")) {
    children.push(transformWindow(w, name));
  }
  for (const o of optionalArray(obj, "openings")) {
    children.push(transformOpening(o, name));
  }

  return { type: "room", name, children };
}

function transformFloor(raw: unknown, projectName: string): FloorNode {
  if (typeof raw !== "object" || raw === null) {
    throw new ParseError(`Floor in project "${projectName}" must be an object`);
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Floor in project "${projectName}"`;
  const name = requireString(obj, "name", ctx);

  // Merge typed arrays into flat children array
  const children: FloorChild[] = [];

  for (const r of optionalArray(obj, "rooms")) {
    children.push(transformRoom(r, name));
  }

  return { type: "floor", name, children };
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Parse a Plancraft JSONC source string into a raw AST.
 */
export function parse(source: string): ProjectNode {
  // Strip JSONC comments
  const stripped = stripJsonComments(source);

  // Parse JSON
  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch (err) {
    throw new ParseError(`Invalid JSON: ${(err as Error).message}`);
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new ParseError("Root must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;
  const name = requireString(obj, "name", "Project");

  // Scale: number (the ratio, e.g. 100 for 1:100)
  const scaleValue = optionalNumber(obj, "scale", 100);
  if (scaleValue <= 0) {
    throw new ParseError(`Project: "scale" must be greater than 0`);
  }
  const scale: Scale = { ratio: scaleValue };

  // Unit
  const unitValue = typeof obj["unit"] === "string" ? obj["unit"] : "mm";
  if (!VALID_UNITS.has(unitValue)) {
    throw new ParseError(`Project: "unit" must be one of: mm, cm, m, ft, in`);
  }
  const unit = unitValue as Unit;

  // Floors
  const floors: FloorNode[] = [];
  for (const f of optionalArray(obj, "floors")) {
    floors.push(transformFloor(f, name));
  }

  return { type: "project", name, scale, unit, floors };
}
