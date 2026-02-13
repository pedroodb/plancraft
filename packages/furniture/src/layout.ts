/**
 * Furniture layout (.pcf) parser and serializer.
 *
 * The .pcf format is JSONC (JSON with comments) listing furniture placements
 * and optionally custom element definitions.
 */

import type {
  FurnitureElementDef,
  FurnitureLayout,
  FurniturePlacement,
  Point,
  WallAnchor,
  RelativePosition,
} from "./types.js";

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

function optionalBoolean(
  obj: Record<string, unknown>,
  field: string,
): boolean | undefined {
  const val = obj[field];
  if (val === undefined || val === null) return undefined;
  if (typeof val !== "boolean") {
    throw new LayoutParseError(`"${field}" must be a boolean when provided`);
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

// ── Element definition parser ────────────────────────────────────────

function transformElementDef(
  raw: unknown,
  id: string,
): FurnitureElementDef {
  if (typeof raw !== "object" || raw === null) {
    throw new LayoutParseError(
      `Element "${id}" must be an object`,
    );
  }
  const obj = raw as Record<string, unknown>;
  const ctx = `Element["${id}"]`;

  // Parse tags (required, must be a string array)
  const rawTags = obj["tags"];
  if (!Array.isArray(rawTags) || rawTags.some((t) => typeof t !== "string")) {
    throw new LayoutParseError(`${ctx}: "tags" must be an array of strings`);
  }

  const def: FurnitureElementDef = {
    name: requireString(obj, "name", ctx),
    tags: rawTags as string[],
    defaultWidth: requireNumber(obj, "defaultWidth", ctx),
    defaultDepth: requireNumber(obj, "defaultDepth", ctx),
    svg: requireString(obj, "svg", ctx),
  };

  const source = optionalString(obj, "source");
  if (source !== undefined) def.source = source;

  return def;
}

// ── Placement parser ─────────────────────────────────────────────────

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

  // Parse anchor (wall-anchored positioning)
  let anchor: WallAnchor | undefined;
  if (obj["anchor"] !== undefined && obj["anchor"] !== null) {
    if (typeof obj["anchor"] !== "object" || Array.isArray(obj["anchor"])) {
      throw new LayoutParseError(`${ctx}: "anchor" must be an object`);
    }
    const anchorObj = obj["anchor"] as Record<string, unknown>;
    anchor = {
      wall: requireString(anchorObj, "wall", `${ctx} anchor`),
      along: requireNumber(anchorObj, "along", `${ctx} anchor`),
      offset: optionalNumber(anchorObj, "offset") ?? 0,
    };
  }

  // Parse relativePosition (room-relative percentage)
  let relativePosition: RelativePosition | undefined;
  if (obj["relativePosition"] !== undefined && obj["relativePosition"] !== null) {
    if (typeof obj["relativePosition"] !== "object" || Array.isArray(obj["relativePosition"])) {
      throw new LayoutParseError(`${ctx}: "relativePosition" must be an object`);
    }
    const relObj = obj["relativePosition"] as Record<string, unknown>;
    relativePosition = {
      x: requireNumber(relObj, "x", `${ctx} relativePosition`),
      y: requireNumber(relObj, "y", `${ctx} relativePosition`),
    };
  }

  // Position is required for absolute placements, but anchored/relative placements
  // can use a dummy position that gets resolved later
  let position: Point;
  if (obj["position"] !== undefined && obj["position"] !== null) {
    position = requirePoint(obj["position"], `${ctx} "position"`);
  } else if (anchor || relativePosition) {
    // Anchor or relative placements can omit position (it gets resolved)
    position = { x: 0, y: 0 };
  } else {
    throw new LayoutParseError(
      `${ctx}: "position" is required (or use "anchor" or "relativePosition" with a "room")`
    );
  }

  // New scale-based fields with defaults
  const scaleWidth = optionalNumber(obj, "scaleWidth") ?? 100;
  const scaleDepth = optionalNumber(obj, "scaleDepth") ?? 100;
  const lockProportions = optionalBoolean(obj, "lockProportions") ?? true;
  const rotation = optionalNumber(obj, "rotation") ?? 0;
  const room = optionalString(obj, "room");

  // Backward compatibility: if old-style width/depth are present and
  // no scale fields were explicitly set, keep the absolute values
  // by storing them as-is (the renderer will handle the conversion
  // when it has access to element metadata).
  const legacyWidth = optionalNumber(obj, "width");
  const legacyDepth = optionalNumber(obj, "depth");

  const placement: FurniturePlacement = {
    element,
    position,
    scaleWidth: legacyWidth !== undefined && obj["scaleWidth"] === undefined
      ? legacyWidth  // store legacy width temporarily; renderer converts
      : scaleWidth,
    scaleDepth: legacyDepth !== undefined && obj["scaleDepth"] === undefined
      ? legacyDepth  // store legacy depth temporarily; renderer converts
      : scaleDepth,
    lockProportions,
    rotation,
  };

  if (room !== undefined) placement.room = room;
  if (anchor !== undefined) placement.anchor = anchor;
  if (relativePosition !== undefined) placement.relativePosition = relativePosition;

  // Mark legacy placements so the renderer can detect them
  if (
    (legacyWidth !== undefined && obj["scaleWidth"] === undefined) ||
    (legacyDepth !== undefined && obj["scaleDepth"] === undefined)
  ) {
    (placement as unknown as Record<string, unknown>)["_legacyAbsolute"] = true;
  }

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

  // Parse element definitions
  let elements: Record<string, FurnitureElementDef> | undefined;
  const rawElements = obj["elements"];
  if (rawElements !== undefined && rawElements !== null) {
    if (typeof rawElements !== "object" || Array.isArray(rawElements)) {
      throw new LayoutParseError(
        '"elements" must be an object in the .pcf file',
      );
    }
    elements = {};
    for (const [id, value] of Object.entries(
      rawElements as Record<string, unknown>,
    )) {
      elements[id] = transformElementDef(value, id);
    }
  }

  const layout: FurnitureLayout = {
    placements: placements.map((p, i) => transformPlacement(p, i)),
  };

  if (elements && Object.keys(elements).length > 0) {
    layout.elements = elements;
  }

  return layout;
}

/**
 * Serialize a FurnitureLayout to a JSONC string.
 */
export function serializeLayout(layout: FurnitureLayout): string {
  // Build clean placement objects (omit default-valued optional fields)
  const placements = layout.placements.map((p) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj: any = {
      element: p.element,
    };
    // Include position for absolute placements; anchored/relative may omit it
    if (p.anchor || p.relativePosition) {
      // For anchored/relative placements, only include position if it was explicitly set (not 0,0 dummy)
      if (p.position.x !== 0 || p.position.y !== 0) {
        obj.position = p.position;
      }
    } else {
      obj.position = p.position;
    }
    if (p.scaleWidth !== 100) obj.scaleWidth = p.scaleWidth;
    if (p.scaleDepth !== 100) obj.scaleDepth = p.scaleDepth;
    if (!p.lockProportions) obj.lockProportions = false;
    if (p.rotation !== 0) obj.rotation = p.rotation;
    if (p.room !== undefined) obj.room = p.room;
    if (p.anchor !== undefined) obj.anchor = p.anchor;
    if (p.relativePosition !== undefined) obj.relativePosition = p.relativePosition;
    return obj;
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const root: any = {};

  if (layout.elements && Object.keys(layout.elements).length > 0) {
    root.elements = layout.elements;
  }

  root.placements = placements;

  return JSON.stringify(root, null, 2);
}
