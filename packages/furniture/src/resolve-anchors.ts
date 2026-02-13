/**
 * Resolves room-relative furniture placements (anchored or percentage-based)
 * into absolute coordinates using room geometry data.
 *
 * This is the bridge between the human-friendly "anchor to south wall, centered"
 * format and the absolute mm coordinates the renderer needs.
 */

import type { FurnitureLayout, FurniturePlacement, FurnitureElementDef, Point } from "./types.js";

// ── Room geometry interface (matches what @plancraft/renderer provides) ──

export interface ResolveRoomGeometry {
  name: string;
  boundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  innerBoundingBox: { minX: number; minY: number; maxX: number; maxY: number };
  center: Point;
  walls: Array<{
    from: Point;
    to: Point;
    thickness: number;
    direction: string;
    side: string;
    length: number;
  }>;
}

/**
 * Resolve all anchored and relative placements in a layout to absolute positions.
 * Placements that already have absolute positions (no anchor/relativePosition) are unchanged.
 *
 * @param layout - The furniture layout with potentially unresolved placements
 * @param roomGeometries - Room geometry data from computeRoomGeometries()
 * @returns A new layout with all positions resolved to absolute coordinates
 */
export function resolveAnchors(
  layout: FurnitureLayout,
  roomGeometries: ResolveRoomGeometry[],
): FurnitureLayout {
  const resolvedPlacements = layout.placements.map((p) => {
    if (!p.anchor && !p.relativePosition) {
      return p; // Already absolute
    }

    if (!p.room) {
      // Can't resolve without a room reference — keep as-is
      return p;
    }

    const room = roomGeometries.find(
      (r) => r.name.toLowerCase() === p.room!.toLowerCase(),
    );
    if (!room) {
      // Room not found — keep as-is
      return p;
    }

    // Get element dimensions for depth calculations
    const elementDef = layout.elements?.[p.element];
    const baseWidth = elementDef?.defaultWidth ?? 500;
    const baseDepth = elementDef?.defaultDepth ?? 500;
    const isLegacy = (p as unknown as Record<string, unknown>)["_legacyAbsolute"] === true;
    const width = isLegacy ? (p.scaleWidth || baseWidth) : baseWidth * (p.scaleWidth / 100);
    const depth = isLegacy ? (p.scaleDepth || baseDepth) : baseDepth * (p.scaleDepth / 100);

    // Effective dimensions after rotation
    const rad = (p.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const effectiveWidth = width * cos + depth * sin;
    const effectiveDepth = width * sin + depth * cos;

    let resolvedPosition: Point;

    if (p.anchor) {
      resolvedPosition = resolveWallAnchor(
        p.anchor,
        room,
        effectiveWidth,
        effectiveDepth,
      );
    } else if (p.relativePosition) {
      resolvedPosition = resolveRelativePosition(
        p.relativePosition,
        room,
      );
    } else {
      resolvedPosition = p.position;
    }

    return {
      ...p,
      position: resolvedPosition,
    };
  });

  return {
    ...layout,
    placements: resolvedPlacements,
  };
}

/**
 * Resolve a wall-anchored placement to absolute coordinates.
 */
function resolveWallAnchor(
  anchor: NonNullable<FurniturePlacement["anchor"]>,
  room: ResolveRoomGeometry,
  effectiveWidth: number,
  effectiveDepth: number,
): Point {
  // Find the matching wall (by direction name or compass side)
  const wall = room.walls.find(
    (w) =>
      w.direction.toLowerCase() === anchor.wall.toLowerCase() ||
      w.side.toLowerCase() === anchor.wall.toLowerCase(),
  );

  if (!wall) {
    // Wall not found — fall back to room center
    return room.center;
  }

  // Wall direction vector
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const len = wall.length || Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return room.center;

  const ux = dx / len; // unit vector along wall
  const uy = dy / len;
  const nx = -uy; // normal pointing into room (perpendicular, CCW rotation)
  const ny = ux;

  // Determine which direction the normal should point (into the room)
  // Check if the normal points toward the room center
  const wallMidX = (wall.from.x + wall.to.x) / 2;
  const wallMidY = (wall.from.y + wall.to.y) / 2;
  const toCenter = {
    x: room.center.x - wallMidX,
    y: room.center.y - wallMidY,
  };
  const dot = nx * toCenter.x + ny * toCenter.y;
  const normalSign = dot >= 0 ? 1 : -1;

  // Position along the wall
  const posAlongWall = anchor.along * len;
  const wallPointX = wall.from.x + ux * posAlongWall;
  const wallPointY = wall.from.y + uy * posAlongWall;

  // Offset from wall: wall_thickness/2 (to reach inner face) + furniture_depth/2 + user offset
  const totalOffset = wall.thickness / 2 + effectiveDepth / 2 + anchor.offset;

  return {
    x: wallPointX + normalSign * nx * totalOffset,
    y: wallPointY + normalSign * ny * totalOffset,
  };
}

/**
 * Resolve a relative position (percentage) to absolute coordinates within the room.
 */
function resolveRelativePosition(
  rel: NonNullable<FurniturePlacement["relativePosition"]>,
  room: ResolveRoomGeometry,
): Point {
  const bbox = room.innerBoundingBox;
  return {
    x: bbox.minX + (bbox.maxX - bbox.minX) * rel.x,
    y: bbox.minY + (bbox.maxY - bbox.minY) * rel.y,
  };
}
