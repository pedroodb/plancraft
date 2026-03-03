/**
 * Spatial validation utilities for furniture placement.
 *
 * Provides AABB overlap detection, point-in-polygon tests, furniture-wall
 * collision detection, and room bounding box computation. These utilities
 * are used to validate furniture placement and produce warnings for the AI.
 */

import type { Point, ResolvedRoom, ResolvedWall, ResolvedDoor, ResolvedProject } from "@plancraft/dsl";
import type { FurnitureLayout, FurnitureElementDef } from "@plancraft/furniture";

// ── Bounding box types ───────────────────────────────────────────────

export interface AABB {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export interface RoomGeometry {
  name: string;
  boundingBox: AABB;
  innerBoundingBox: AABB;
  center: Point;
  walls: WallInfo[];
  /** Centerline polygon points (for point-in-polygon tests) */
  polygon: Point[];
}

export interface WallInfo {
  from: Point;
  to: Point;
  thickness: number;
  direction: string;
  /** Compass label: "north", "south", "east", "west", or "diagonal" */
  side: string;
  /** Length of the wall in mm */
  length: number;
}

export interface FurnitureAABB {
  element: string;
  index: number;
  room?: string;
  center: Point;
  /** Axis-aligned bounding box (accounts for rotation) */
  aabb: AABB;
  /** Actual width after scale */
  width: number;
  /** Actual depth after scale */
  height: number;
  rotation: number;
}

export interface SpatialWarning {
  type: "wall_overlap" | "furniture_overlap" | "out_of_room" | "wall_gap" | "door_blocked" | "wall_proximity" | "passability" | "duplicate_fixture";
  message: string;
  /** Index of the furniture placement */
  placementIndex: number;
  /** Optional second placement index (for furniture-furniture overlaps) */
  otherIndex?: number;
}

export interface DoorClearanceInfo {
  /** Room this door belongs to */
  roomName: string;
  /** The resolved door */
  door: ResolvedDoor;
  /** AABB of the door clearance zone (swing arc or sliding track) */
  aabb: AABB;
  /** Whether this is a swing or sliding door */
  doorType: "swing" | "sliding";
}

// ── Geometry helpers ─────────────────────────────────────────────────

/**
 * Check if two AABBs overlap. Returns true if they intersect.
 * Uses a tolerance to avoid false positives from touching edges and AABB approximation.
 */
const OVERLAP_TOLERANCE = 50; // 50mm tolerance (AABB is axis-aligned approximation)
const OUT_OF_ROOM_TOLERANCE = 50; // 50mm tolerance for out-of-room checks

export function aabbOverlap(a: AABB, b: AABB, tolerance: number = OVERLAP_TOLERANCE): boolean {
  return (
    a.minX < b.maxX - tolerance &&
    a.maxX > b.minX + tolerance &&
    a.minY < b.maxY - tolerance &&
    a.maxY > b.minY + tolerance
  );
}

/**
 * Compute the overlap depth between two AABBs (0 if no overlap).
 */
export function aabbOverlapDepth(a: AABB, b: AABB): number {
  const overlapX = Math.min(a.maxX, b.maxX) - Math.max(a.minX, b.minX);
  const overlapY = Math.min(a.maxY, b.maxY) - Math.max(a.minY, b.minY);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  return Math.min(overlapX, overlapY);
}

/**
 * Point-in-polygon test using ray casting algorithm.
 * Returns true if the point is inside the polygon.
 */
export function pointInPolygon(point: Point, polygon: Point[]): boolean {
  const n = polygon.length;
  if (n < 3) return false;

  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x;
    const yi = polygon[i].y;
    const xj = polygon[j].x;
    const yj = polygon[j].y;

    const intersect =
      yi > point.y !== yj > point.y &&
      point.x < ((xj - xi) * (point.y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

/**
 * Compute the AABB of a rotated rectangle given center, width, height, and rotation.
 */
export function rotatedRectAABB(
  center: Point,
  width: number,
  height: number,
  rotationDeg: number,
): AABB {
  const rad = (rotationDeg * Math.PI) / 180;
  const cos = Math.abs(Math.cos(rad));
  const sin = Math.abs(Math.sin(rad));

  // Rotated bounding box half-extents
  const halfW = (width * cos + height * sin) / 2;
  const halfH = (width * sin + height * cos) / 2;

  return {
    minX: center.x - halfW,
    minY: center.y - halfH,
    maxX: center.x + halfW,
    maxY: center.y + halfH,
  };
}

/**
 * Compute the AABB from a set of polygon points.
 */
export function polygonAABB(points: Point[]): AABB {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }

  return { minX, minY, maxX, maxY };
}

// ── Door clearance computation ───────────────────────────────────────

const DOOR_CLEARANCE_TOLERANCE = 100; // 100mm tolerance for door clearance checks

/**
 * Compute the unit direction along a door/window opening.
 * Uses endPosition if available (curved walls), otherwise wall chord direction.
 */
function doorOpeningDir(door: ResolvedDoor): { dx: number; dy: number; panelWidth: number } {
  if (door.endPosition) {
    const ddx = door.endPosition.x - door.position.x;
    const ddy = door.endPosition.y - door.position.y;
    const len = Math.sqrt(ddx * ddx + ddy * ddy);
    if (len > 0) return { dx: ddx / len, dy: ddy / len, panelWidth: len };
  }
  const wdx = door.wall.to.x - door.wall.from.x;
  const wdy = door.wall.to.y - door.wall.from.y;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  if (wlen < 0.01) return { dx: 1, dy: 0, panelWidth: door.width };
  return { dx: wdx / wlen, dy: wdy / wlen, panelWidth: door.width };
}

/**
 * Compute the AABB of a circular arc sector (center + arc from startAngle to endAngle).
 * Includes the center point and the full arc sweep.
 */
function arcSectorAABB(center: Point, radius: number, startAngle: number, endAngle: number): AABB {
  // Start with the sector vertices: center, arc start, arc end
  let minX = center.x;
  let minY = center.y;
  let maxX = center.x;
  let maxY = center.y;

  const sx = center.x + Math.cos(startAngle) * radius;
  const sy = center.y + Math.sin(startAngle) * radius;
  const ex = center.x + Math.cos(endAngle) * radius;
  const ey = center.y + Math.sin(endAngle) * radius;

  minX = Math.min(minX, sx, ex);
  minY = Math.min(minY, sy, ey);
  maxX = Math.max(maxX, sx, ex);
  maxY = Math.max(maxY, sy, ey);

  // Check if the arc crosses any cardinal direction (0, π/2, π, 3π/2)
  // Normalize angles to [0, 2π)
  const TWO_PI = 2 * Math.PI;
  const norm = (a: number) => ((a % TWO_PI) + TWO_PI) % TWO_PI;
  const s = norm(startAngle);
  const e = norm(endAngle);

  const cardinals = [0, Math.PI / 2, Math.PI, (3 * Math.PI) / 2];
  const offsets: Point[] = [
    { x: radius, y: 0 },     // 0°  → right
    { x: 0, y: radius },     // 90° → down
    { x: -radius, y: 0 },    // 180° → left
    { x: 0, y: -radius },    // 270° → up
  ];

  for (let i = 0; i < 4; i++) {
    const c = cardinals[i];
    // Check if cardinal angle c is within the arc from s to e (counterclockwise)
    const inArc = s <= e ? (c >= s && c <= e) : (c >= s || c <= e);
    if (inArc) {
      const px = center.x + offsets[i].x;
      const py = center.y + offsets[i].y;
      minX = Math.min(minX, px);
      minY = Math.min(minY, py);
      maxX = Math.max(maxX, px);
      maxY = Math.max(maxY, py);
    }
  }

  return { minX, minY, maxX, maxY };
}

/**
 * Compute the door clearance AABB for a swing door.
 * The clearance zone is the quarter-circle arc swept by the door panel.
 */
function swingDoorClearanceAABB(door: ResolvedDoor): AABB {
  const { dx, dy, panelWidth } = doorOpeningDir(door);
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

  return arcSectorAABB(door.position, panelWidth, startAngle, endAngle);
}

/**
 * Compute the door clearance AABB for a sliding door.
 * The clearance zone is a thin rectangle on both sides of the door track (200mm deep).
 */
function slidingDoorClearanceAABB(door: ResolvedDoor): AABB {
  const { dx, dy, panelWidth } = doorOpeningDir(door);
  // Wall normal (perpendicular to wall direction)
  const nx = dy;
  const ny = -dx;
  const clearanceDepth = 200; // 200mm clearance on each side of a sliding door

  const start = door.position;
  const end = {
    x: start.x + dx * panelWidth,
    y: start.y + dy * panelWidth,
  };

  // Four corners of the clearance zone
  const points: Point[] = [
    { x: start.x + nx * clearanceDepth, y: start.y + ny * clearanceDepth },
    { x: start.x - nx * clearanceDepth, y: start.y - ny * clearanceDepth },
    { x: end.x + nx * clearanceDepth, y: end.y + ny * clearanceDepth },
    { x: end.x - nx * clearanceDepth, y: end.y - ny * clearanceDepth },
  ];

  return polygonAABB(points);
}

/**
 * Compute door clearance zones for all doors in a project.
 */
export function computeDoorClearances(project: ResolvedProject): DoorClearanceInfo[] {
  const result: DoorClearanceInfo[] = [];

  for (const floor of project.floors) {
    for (const room of floor.rooms) {
      for (const door of room.doors) {
        const doorType = door.swing === "sliding" ? "sliding" : "swing";
        const aabb =
          doorType === "sliding"
            ? slidingDoorClearanceAABB(door)
            : swingDoorClearanceAABB(door);

        result.push({
          roomName: room.name,
          door,
          aabb,
          doorType,
        });
      }
    }
  }

  return result;
}

/**
 * Compute the inner bounding box of a room (wall centerlines inset by max wall thickness / 2).
 */
function roomInnerBBox(room: ResolvedRoom): AABB {
  const outer = roomBoundingBox(room);
  // Find max wall thickness to inset by
  let maxThickness = 0;
  for (const w of room.walls) {
    if (w.thickness > maxThickness) maxThickness = w.thickness;
  }
  const inset = maxThickness / 2;
  return {
    minX: outer.minX + inset,
    minY: outer.minY + inset,
    maxX: outer.maxX - inset,
    maxY: outer.maxY - inset,
  };
}

// ── Room geometry computation ────────────────────────────────────────

/**
 * Compute the bounding box of a room from its wall centerline points.
 */
export function roomBoundingBox(room: ResolvedRoom): AABB {
  const points: Point[] = [];
  for (const wall of room.walls) {
    points.push(wall.from);
    points.push(wall.to);
    if (wall.curvePoints) {
      points.push(...wall.curvePoints);
    }
  }
  return polygonAABB(points);
}

/**
 * Compute the centerline polygon of a room (the points that define the room boundary).
 */
export function roomCenterlinePolygon(room: ResolvedRoom): Point[] {
  const points: Point[] = [];
  for (const wall of room.walls) {
    if (wall.curvePoints && wall.curvePoints.length > 0) {
      // Add all arc samples except the last (which is wall.to = next wall's from)
      for (let i = 0; i < wall.curvePoints.length - 1; i++) {
        points.push(wall.curvePoints[i]);
      }
    } else {
      points.push(wall.from);
    }
  }
  return points;
}

/**
 * Label a wall with a compass direction based on its orientation.
 */
function wallCompassSide(from: Point, to: Point): string {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  // Tolerance: if one component is much larger than the other, it's axis-aligned
  if (absDy < absDx * 0.1) {
    // Mostly horizontal
    // Wall goes left-right. The "side" of the room this wall is on
    // depends on whether it's at the top or bottom of the room.
    // We'll determine this by context (caller can use bounding box).
    return dx > 0 ? "east-facing" : "west-facing";
  }
  if (absDx < absDy * 0.1) {
    // Mostly vertical
    return dy > 0 ? "north-facing" : "south-facing";
  }
  return "diagonal";
}

/**
 * Assign compass sides (north/south/east/west) to walls based on their
 * position relative to the room center.
 */
function assignWallSide(wall: ResolvedWall, roomCenter: Point): string {
  const wallMidX = (wall.from.x + wall.to.x) / 2;
  const wallMidY = (wall.from.y + wall.to.y) / 2;
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const absDx = Math.abs(dx);
  const absDy = Math.abs(dy);

  if (absDy < absDx * 0.3) {
    // Mostly horizontal wall
    // In SVG coordinates Y increases downward: higher Y = further south
    return wallMidY > roomCenter.y ? "south" : "north";
  }
  if (absDx < absDy * 0.3) {
    // Mostly vertical wall
    return wallMidX > roomCenter.x ? "east" : "west";
  }
  return "diagonal";
}

/**
 * Compute full room geometry for all rooms in a project.
 */
export function computeRoomGeometries(project: ResolvedProject): RoomGeometry[] {
  const result: RoomGeometry[] = [];

  for (const floor of project.floors) {
    for (const room of floor.rooms) {
      const bbox = roomBoundingBox(room);
      const innerBbox = roomInnerBBox(room);
      const polygon = roomCenterlinePolygon(room);

      const walls: WallInfo[] = room.walls.map((w) => {
        const dx = w.to.x - w.from.x;
        const dy = w.to.y - w.from.y;
        const length = Math.sqrt(dx * dx + dy * dy);
        return {
          from: w.from,
          to: w.to,
          thickness: w.thickness,
          direction: w.direction,
          side: assignWallSide(w, room.center),
          length,
        };
      });

      result.push({
        name: room.name,
        boundingBox: bbox,
        innerBoundingBox: innerBbox,
        center: room.center,
        walls,
        polygon,
      });
    }
  }

  return result;
}

// ── Furniture AABB computation ───────────────────────────────────────

/**
 * Compute AABBs for all furniture placements in a layout.
 * Resolves element dimensions from the layout's element definitions.
 */
export function computeFurnitureAABBs(layout: FurnitureLayout): FurnitureAABB[] {
  const result: FurnitureAABB[] = [];

  for (let i = 0; i < layout.placements.length; i++) {
    const p = layout.placements[i];
    const elementDef = layout.elements?.[p.element];

    // Determine actual dimensions
    const isLegacy = (p as unknown as Record<string, unknown>)["_legacyAbsolute"] === true;
    let width: number;
    let height: number;

    if (isLegacy) {
      width = p.scaleWidth || elementDef?.defaultWidth || 500;
      height = p.scaleDepth || elementDef?.defaultDepth || 500;
    } else {
      const baseWidth = elementDef?.defaultWidth || 500;
      const baseDepth = elementDef?.defaultDepth || 500;
      width = baseWidth * (p.scaleWidth / 100);
      height = baseDepth * (p.scaleDepth / 100);
    }

    const aabb = rotatedRectAABB(p.position, width, height, p.rotation);

    result.push({
      element: p.element,
      index: i,
      room: p.room,
      center: p.position,
      aabb,
      width,
      height,
      rotation: p.rotation,
    });
  }

  return result;
}

// ── Wall polygon computation ─────────────────────────────────────────

/**
 * Compute the AABB of a wall from its polygon points.
 */
function wallAABB(wall: ResolvedWall): AABB {
  return polygonAABB(wall.polygon);
}

/**
 * Collect wall AABBs grouped by room name.
 * Returns a map from room name (lowercase) to its wall AABBs.
 */
function collectWallAABBsByRoom(project: ResolvedProject): Map<string, { aabb: AABB; wall: ResolvedWall; roomName: string }[]> {
  const result = new Map<string, { aabb: AABB; wall: ResolvedWall; roomName: string }[]>();

  for (const floor of project.floors) {
    for (const room of floor.rooms) {
      const key = room.name.toLowerCase();
      const walls: { aabb: AABB; wall: ResolvedWall; roomName: string }[] = [];
      for (const wall of room.walls) {
        walls.push({ aabb: wallAABB(wall), wall, roomName: room.name });
      }
      result.set(key, walls);
    }
  }

  return result;
}

// ── Spatial validation ───────────────────────────────────────────────

/**
 * Validate furniture placement against the compiled plan structure.
 * Returns an array of warnings about spatial issues.
 *
 * Key design decisions:
 * - Furniture-furniture overlaps are only checked between items in the SAME room
 *   (walls separate rooms, so cross-room overlap is a false positive)
 * - Furniture-wall overlaps only check walls belonging to the furniture's declared room
 *   (prevents false positives from adjacent/overlapping walls)
 * - Tolerances account for AABB axis-aligned approximation of rotated items
 */
export function validateFurniturePlacement(
  layout: FurnitureLayout,
  project: ResolvedProject,
): SpatialWarning[] {
  const warnings: SpatialWarning[] = [];

  if (layout.placements.length === 0) return warnings;

  const furnitureAABBs = computeFurnitureAABBs(layout);
  const roomGeometries = computeRoomGeometries(project);
  const wallsByRoom = collectWallAABBsByRoom(project);

  // Group furniture by room for scoped checks
  const furnitureByRoom = new Map<string, FurnitureAABB[]>();
  for (const f of furnitureAABBs) {
    const key = (f.room || "__unassigned__").toLowerCase();
    if (!furnitureByRoom.has(key)) furnitureByRoom.set(key, []);
    furnitureByRoom.get(key)!.push(f);
  }

  // 1. Check furniture-furniture overlaps (only within same room)
  for (const [, roomItems] of furnitureByRoom) {
    for (let i = 0; i < roomItems.length; i++) {
      for (let j = i + 1; j < roomItems.length; j++) {
        const a = roomItems[i];
        const b = roomItems[j];
        if (aabbOverlap(a.aabb, b.aabb)) {
          const depth = aabbOverlapDepth(a.aabb, b.aabb);
          // Only warn if overlap is significant (>50mm) — smaller overlaps
          // are often intentional (items touching)
          if (depth > 50) {
            warnings.push({
              type: "furniture_overlap",
              message: `${a.element} (#${a.index}) overlaps with ${b.element} (#${b.index}) by ~${Math.round(depth)}mm`,
              placementIndex: a.index,
              otherIndex: b.index,
            });
          }
        }
      }
    }
  }

  // 2. Check furniture-wall overlaps (only walls from furniture's own room)
  for (const furn of furnitureAABBs) {
    if (!furn.room) continue;

    const roomWalls = wallsByRoom.get(furn.room.toLowerCase());
    if (!roomWalls) continue;

    for (const { aabb: wAabb, wall, roomName } of roomWalls) {
      if (aabbOverlap(furn.aabb, wAabb)) {
        const depth = aabbOverlapDepth(furn.aabb, wAabb);
        // Only warn if the overlap penetrates significantly into the wall
        // (more than half wall thickness — furniture touching/near a wall is fine)
        if (depth > wall.thickness * 0.5) {
          warnings.push({
            type: "wall_overlap",
            message: `${furn.element} (#${furn.index}) overlaps a wall (${roomName} ${wall.direction}) by ~${Math.round(depth)}mm`,
            placementIndex: furn.index,
          });
        }
      }
    }
  }

  // 3. Check furniture outside its declared room
  for (const furn of furnitureAABBs) {
    if (!furn.room) continue;

    const roomGeo = roomGeometries.find(
      (r) => r.name.toLowerCase() === furn.room!.toLowerCase(),
    );
    if (!roomGeo) continue;

    // Check if center is inside room polygon
    if (!pointInPolygon(furn.center, roomGeo.polygon)) {
      warnings.push({
        type: "out_of_room",
        message: `${furn.element} (#${furn.index}) center is outside its declared room "${furn.room}"`,
        placementIndex: furn.index,
      });
    } else {
      // Center is inside, but check if the AABB extends beyond the room's inner bounding box
      const inner = roomGeo.innerBoundingBox;
      const fa = furn.aabb;
      const overflows: string[] = [];
      if (fa.minX < inner.minX - OUT_OF_ROOM_TOLERANCE)
        overflows.push(`${Math.round(inner.minX - fa.minX)}mm past west wall`);
      if (fa.maxX > inner.maxX + OUT_OF_ROOM_TOLERANCE)
        overflows.push(`${Math.round(fa.maxX - inner.maxX)}mm past east wall`);
      if (fa.minY < inner.minY - OUT_OF_ROOM_TOLERANCE)
        overflows.push(`${Math.round(inner.minY - fa.minY)}mm past south wall`);
      if (fa.maxY > inner.maxY + OUT_OF_ROOM_TOLERANCE)
        overflows.push(`${Math.round(fa.maxY - inner.maxY)}mm past north wall`);

      if (overflows.length > 0) {
        warnings.push({
          type: "out_of_room",
          message: `${furn.element} (#${furn.index}) extends beyond "${furn.room}" boundary: ${overflows.join(", ")}`,
          placementIndex: furn.index,
        });
      }
    }
  }

  // 4. Check furniture blocking door clearance zones
  const doorClearances = computeDoorClearances(project);
  for (const furn of furnitureAABBs) {
    if (!furn.room) continue;

    for (const dc of doorClearances) {
      // Only check doors in the same room as the furniture
      if (dc.roomName.toLowerCase() !== furn.room.toLowerCase()) continue;

      if (aabbOverlap(furn.aabb, dc.aabb, DOOR_CLEARANCE_TOLERANCE)) {
        const depth = aabbOverlapDepth(furn.aabb, dc.aabb);
        if (depth > DOOR_CLEARANCE_TOLERANCE) {
          const doorDesc = `${dc.doorType} door on ${dc.door.wallDirection} wall`;
          warnings.push({
            type: "door_blocked",
            message: `${furn.element} (#${furn.index}) blocks ${doorDesc} clearance by ~${Math.round(depth)}mm`,
            placementIndex: furn.index,
          });
        }
      }
    }
  }

  // 5. Check wall-adjacent items are actually near a wall (not floating in the room center)
  const WALL_ADJACENT_ELEMENTS = new Set([
    "toilet", "sink", "shower", "bathtub",
    "counter", "stove", "oven", "fridge",
    "bed", "wardrobe",
    "sofa", "l_sofa", "sectional_sofa", "tv_console", "bookshelf",
    "desk", "executive_desk", "whiteboard",
  ]);
  const WALL_PROXIMITY_THRESHOLD = 500; // mm — max gap between item edge and nearest wall

  for (const furn of furnitureAABBs) {
    if (!furn.room) continue;
    const elName = furn.element.includes("/") ? furn.element.split("/").pop()! : furn.element;
    if (!WALL_ADJACENT_ELEMENTS.has(elName)) continue;

    const roomGeo = roomGeometries.find(
      (r) => r.name.toLowerCase() === furn.room!.toLowerCase(),
    );
    if (!roomGeo) continue;

    const inner = roomGeo.innerBoundingBox;
    const fa = furn.aabb;
    const distToWest = fa.minX - inner.minX;
    const distToEast = inner.maxX - fa.maxX;
    const distToNorth = fa.minY - inner.minY;
    const distToSouth = inner.maxY - fa.maxY;
    const minDist = Math.min(distToWest, distToEast, distToNorth, distToSouth);

    if (minDist > WALL_PROXIMITY_THRESHOLD) {
      warnings.push({
        type: "wall_proximity",
        message: `${furn.element} (#${furn.index}) is ~${Math.round(minDist)}mm from any wall — this item should be placed against a wall, not in the middle of the room`,
        placementIndex: furn.index,
      });
    }
  }

  // 6. Check doorway passability — furniture near doors should leave at least 600mm passage
  const MIN_PASSAGE_WIDTH = 600; // mm
  for (const furn of furnitureAABBs) {
    if (!furn.room) continue;

    for (const dc of doorClearances) {
      if (dc.roomName.toLowerCase() !== furn.room.toLowerCase()) continue;

      const doorCenter = {
        x: (dc.aabb.minX + dc.aabb.maxX) / 2,
        y: (dc.aabb.minY + dc.aabb.maxY) / 2,
      };
      const doorWidth = dc.door.width;
      const checkRadius = doorWidth + MIN_PASSAGE_WIDTH;

      const furnCenterDist = Math.sqrt(
        (furn.center.x - doorCenter.x) ** 2 + (furn.center.y - doorCenter.y) ** 2,
      );
      if (furnCenterDist > checkRadius + Math.max(furn.width, furn.height)) continue;

      const gapX = Math.max(0, furn.aabb.minX - dc.aabb.maxX, dc.aabb.minX - furn.aabb.maxX);
      const gapY = Math.max(0, furn.aabb.minY - dc.aabb.maxY, dc.aabb.minY - furn.aabb.maxY);
      const gap = Math.max(gapX, gapY);

      if (gap > 0 && gap < MIN_PASSAGE_WIDTH) {
        warnings.push({
          type: "passability",
          message: `${furn.element} (#${furn.index}) leaves only ~${Math.round(gap)}mm passage near door on ${dc.door.wallDirection} wall — need at least ${MIN_PASSAGE_WIDTH}mm`,
          placementIndex: furn.index,
        });
      }
    }
  }

  // 7. Check duplicate fixtures/appliances per room — items that should appear at most once
  const UNIQUE_PER_ROOM = new Set([
    "stove", "oven", "fridge", "refrigerator", "dishwasher",
    "toilet", "bathtub", "shower",
    "bed", "double_bed", "single_bed", "king_bed",
    "counter",
  ]);
  for (const [roomKey, roomItems] of furnitureByRoom) {
    const seen = new Map<string, FurnitureAABB>();
    for (const furn of roomItems) {
      const elName = furn.element.includes("/") ? furn.element.split("/").pop()! : furn.element;
      if (!UNIQUE_PER_ROOM.has(elName)) continue;

      const existing = seen.get(elName);
      if (existing) {
        warnings.push({
          type: "duplicate_fixture",
          message: `${furn.element} (#${furn.index}) is a duplicate — "${roomKey}" already has one (#${existing.index})`,
          placementIndex: furn.index,
          otherIndex: existing.index,
        });
      } else {
        seen.set(elName, furn);
      }
    }
  }

  return warnings;
}

// ── Aggregate spatial metrics ────────────────────────────────────────

export interface SpatialMetrics {
  furnitureWallOverlaps: number;
  furnitureMutualOverlaps: number;
  furnitureOutOfRoom: number;
  doorBlocked: number;
  totalWarnings: number;
  warnings: SpatialWarning[];
}

/**
 * Compute aggregate spatial metrics from validation warnings.
 * Counts unique placements with issues (not pairwise combinations).
 */
export function computeSpatialMetrics(warnings: SpatialWarning[]): SpatialMetrics {
  const wallOverlapPlacements = new Set<number>();
  const mutualOverlapPlacements = new Set<number>();
  const outOfRoomPlacements = new Set<number>();
  const doorBlockedPlacements = new Set<number>();

  for (const w of warnings) {
    switch (w.type) {
      case "wall_overlap":
        wallOverlapPlacements.add(w.placementIndex);
        break;
      case "furniture_overlap":
        mutualOverlapPlacements.add(w.placementIndex);
        if (w.otherIndex !== undefined) mutualOverlapPlacements.add(w.otherIndex);
        break;
      case "out_of_room":
        outOfRoomPlacements.add(w.placementIndex);
        break;
      case "door_blocked":
        doorBlockedPlacements.add(w.placementIndex);
        break;
    }
  }

  return {
    furnitureWallOverlaps: wallOverlapPlacements.size,
    furnitureMutualOverlaps: mutualOverlapPlacements.size,
    furnitureOutOfRoom: outOfRoomPlacements.size,
    doorBlocked: doorBlockedPlacements.size,
    totalWarnings: warnings.length,
    warnings,
  };
}
