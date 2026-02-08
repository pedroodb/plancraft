/**
 * Furniture layout (.pcf) parser and serializer.
 *
 * The .pcf format is JSONC (JSON with comments) listing furniture placements.
 */

import type { FurnitureLayout, FurniturePlacement, Point } from "./types.js";

// ── Error type ────────────────────────────────────────────────────────

export class LayoutParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LayoutParseError";
  }
}

// ── JSONC comment stripping ──────────────────────────────────────────

function stripJsonComments(source: string): string {
  let result = "";
  let i = 0;
  const len = source.length;

  while (i < len) {
    if (source[i] === '"') {
      result += '"';
      i++;
      while (i < len && source[i] !== '"') {
        if (source[i] === "\\") {
          result += source[i++];
          if (i < len) result += source[i++];
        } else {
          result += source[i++];
        }
      }
      if (i < len) {
        result += '"';
        i++;
      }
      continue;
    }
    if (source[i] === "/" && i + 1 < len && source[i + 1] === "/") {
      i += 2;
      while (i < len && source[i] !== "\n") i++;
      continue;
    }
    if (source[i] === "/" && i + 1 < len && source[i + 1] === "*") {
      i += 2;
      while (
        i < len &&
        !(source[i] === "*" && i + 1 < len && source[i + 1] === "/")
      )
        i++;
      if (i < len) i += 2;
      continue;
    }
    result += source[i++];
  }

  return result;
}

// ── Validation helpers ───────────────────────────────────────────────

function requireString(
  obj: Record<string, unknown>,
  field: string,
  context: string,
): string {
  const val = obj[field];
  if (typeof val !== "string") {
    throw new LayoutParseError(`${context}: "${field}" must be a string`);
  }
  return val;
}

function requireNumber(
  obj: Record<string, unknown>,
  field: string,
  context: string,
): number {
  const val = obj[field];
  if (typeof val !== "number") {
    throw new LayoutParseError(`${context}: "${field}" must be a number`);
  }
  return val;
}

function optionalNumber(
  obj: Record<string, unknown>,
  field: string,
): number | undefined {
  const val = obj[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "number") {
    throw new LayoutParseError(`"${field}" must be a number when provided`);
  }
  return val;
}

function optionalString(
  obj: Record<string, unknown>,
  field: string,
): string | undefined {
  const val = obj[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "string") {
    throw new LayoutParseError(`"${field}" must be a string when provided`);
  }
  return val;
}

function requirePoint(obj: unknown, context: string): Point {
  if (typeof obj !== "object" || obj === null || Array.isArray(obj)) {
    throw new LayoutParseError(
      `${context}: expected a point object {"x": number, "y": number}`,
    );
  }
  const rec = obj as Record<string, unknown>;
  return {
    x: requireNumber(rec, "x", context),
    y: requireNumber(rec, "y", context),
  };
}

// ── Parser ──────────────────────────────────────────────────────────

function transformPlacement(
  raw: unknown,
  index: number,
): FurniturePlacement {
  if (typeof raw !== "object" || raw === null) {
    throw new LayoutParseError(
      `Placement at index ${index} must be an object`,
    );
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Placement[${index}]`;

  const element = requireString(obj, "element", ctx);
  if (!element.includes("/")) {
    throw new LayoutParseError(
      `${ctx}: "element" must be in "package/elementId" format`,
    );
  }

  const position = requirePoint(obj["position"], `${ctx} "position"`);
  const width = optionalNumber(obj, "width");
  const depth = optionalNumber(obj, "depth");
  const rotation = optionalNumber(obj, "rotation");
  const room = optionalString(obj, "room");

  const placement: FurniturePlacement = { element, position };
  if (width !== undefined) placement.width = width;
  if (depth !== undefined) placement.depth = depth;
  if (rotation !== undefined) placement.rotation = rotation;
  if (room !== undefined) placement.room = room;

  return placement;
}

/**
 * Parse a .pcf JSONC source string into a FurnitureLayout.
 */
export function parseLayout(source: string): FurnitureLayout {
  const stripped = stripJsonComments(source);

  let raw: unknown;
  try {
    raw = JSON.parse(stripped);
  } catch (err) {
    throw new LayoutParseError(
      `Invalid JSON in .pcf file: ${(err as Error).message}`,
    );
  }

  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new LayoutParseError("Root of .pcf file must be a JSON object");
  }

  const obj = raw as Record<string, unknown>;
  const placements = obj["placements"];

  if (!Array.isArray(placements)) {
    throw new LayoutParseError(
      '"placements" must be an array in the .pcf file',
    );
  }

  return {
    placements: placements.map((p, i) => transformPlacement(p, i)),
  };
}

/**
 * Serialize a FurnitureLayout to a JSONC string.
 */
export function serializeLayout(layout: FurnitureLayout): string {
  // Build clean placement objects (omit undefined optional fields)
  const placements = layout.placements.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = {
      element: p.element,
      position: p.position,
    };
    if (p.width !== undefined) obj.width = p.width;
    if (p.depth !== undefined) obj.depth = p.depth;
    if (p.rotation !== undefined && p.rotation !== 0) obj.rotation = p.rotation;
    if (p.room !== undefined) obj.room = p.room;
    return obj;
  });

  return JSON.stringify({ placements }, null, 2);
}
