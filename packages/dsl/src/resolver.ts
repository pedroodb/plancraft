/**
 * Semantic analysis pass: resolves references, computes wall polygons,
 * merges shared walls, and calculates room areas + centers.
 */

import {
  DimChainNode,
  DimensionNode,
  DoorNode,
  FloorNode,
  LabelNode,
  OpeningNode,
  Point,
  ProjectNode,
  ResolvedDimChain,
  ResolvedDimension,
  ResolvedDoor,
  ResolvedFloor,
  ResolvedLabel,
  ResolvedOpening,
  ResolvedProject,
  ResolvedRoom,
  ResolvedWall,
  ResolvedWindow,
  RoomNode,
  SharedWallNode,
  WallNode,
  WindowNode,
} from "./ast/types.js";

export class ResolveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ResolveError";
  }
}

// ── Geometry helpers ─────────────────────────────────────────────────

function wallPolygon(
  from: Point,
  to: Point,
  thickness: number,
): [Point, Point, Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) throw new ResolveError("Wall has zero length");

  // Normal perpendicular to wall direction (rotated 90° CCW)
  const nx = -dy / len;
  const ny = dx / len;
  const half = thickness / 2;

  return [
    { x: from.x + nx * half, y: from.y + ny * half },
    { x: to.x + nx * half, y: to.y + ny * half },
    { x: to.x - nx * half, y: to.y - ny * half },
    { x: from.x - nx * half, y: from.y - ny * half },
  ];
}

function wallLength(from: Point, to: Point): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Compute the position along a wall centerline at a given offset from `from`.
 */
function pointAlongWall(from: Point, to: Point, offset: number): Point {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  return {
    x: from.x + (dx / len) * offset,
    y: from.y + (dy / len) * offset,
  };
}

/**
 * Compute the area of a polygon using the shoelace formula.
 * The polygon is defined by the center-points of the room walls in order.
 */
function polygonArea(points: Point[]): number {
  let area = 0;
  const n = points.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += points[i].x * points[j].y;
    area -= points[j].x * points[i].y;
  }
  return Math.abs(area) / 2;
}

function polygonCenter(points: Point[]): Point {
  let cx = 0;
  let cy = 0;
  for (const p of points) {
    cx += p.x;
    cy += p.y;
  }
  return { x: cx / points.length, y: cy / points.length };
}

// ── Resolver ─────────────────────────────────────────────────────────

export function resolve(project: ProjectNode): ResolvedProject {
  return {
    name: project.name,
    scale: project.scale,
    unit: project.unit,
    floors: project.floors.map((f) => resolveFloor(f)),
  };
}

function resolveFloor(floor: FloorNode): ResolvedFloor {
  // First pass: resolve all rooms (needed for shared wall lookups)
  const roomMap = new Map<string, ResolvedRoom>();
  const rooms: RoomNode[] = [];
  const dimensions: DimensionNode[] = [];
  const dimChains: DimChainNode[] = [];
  const labels: LabelNode[] = [];

  for (const child of floor.children) {
    switch (child.type) {
      case "room":
        rooms.push(child);
        break;
      case "dimension":
        dimensions.push(child);
        break;
      case "dimchain":
        dimChains.push(child);
        break;
      case "label":
        labels.push(child);
        break;
    }
  }

  // Resolve rooms in order (shared walls reference earlier rooms)
  for (const room of rooms) {
    const resolved = resolveRoom(room, roomMap);
    roomMap.set(room.name, resolved);
  }

  // Resolve dimensions
  const resolvedDimensions = dimensions.map((d) =>
    resolveDimension(d, roomMap),
  );

  // Resolve dim chains
  const resolvedDimChains = dimChains.map((dc) =>
    resolveDimChain(dc, roomMap),
  );

  // Resolve labels
  const resolvedLabels = labels.map((l) => resolveLabel(l, roomMap));

  return {
    name: floor.name,
    rooms: Array.from(roomMap.values()),
    dimensions: resolvedDimensions,
    dimChains: resolvedDimChains,
    labels: resolvedLabels,
  };
}

function resolveRoom(
  room: RoomNode,
  roomMap: Map<string, ResolvedRoom>,
): ResolvedRoom {
  const walls: ResolvedWall[] = [];
  const doors: ResolvedDoor[] = [];
  const windows: ResolvedWindow[] = [];
  const openings: ResolvedOpening[] = [];

  // First pass: walls
  for (const child of room.children) {
    if (child.type === "wall") {
      walls.push(resolveWall(child, room.name));
    } else if (child.type === "shared_wall") {
      walls.push(resolveSharedWall(child, room.name, roomMap));
    }
  }

  // Build a wall lookup for openings
  const wallByDir = new Map<string, ResolvedWall>();
  for (const w of walls) wallByDir.set(w.direction, w);

  // Second pass: openings
  for (const child of room.children) {
    if (child.type === "door") {
      const wall = wallByDir.get(child.wallDirection);
      if (!wall)
        throw new ResolveError(
          `Door references wall.${child.wallDirection} in room "${room.name}", but no such wall exists`,
        );
      doors.push(resolveDoor(child, wall));
    } else if (child.type === "window") {
      const wall = wallByDir.get(child.wallDirection);
      if (!wall)
        throw new ResolveError(
          `Window references wall.${child.wallDirection} in room "${room.name}", but no such wall exists`,
        );
      windows.push(resolveWindow(child, wall));
    } else if (child.type === "opening") {
      const wall = wallByDir.get(child.wallDirection);
      if (!wall)
        throw new ResolveError(
          `Opening references wall.${child.wallDirection} in room "${room.name}", but no such wall exists`,
        );
      openings.push(resolveOpening(child, wall));
    }
  }

  // Compute area from wall midpoints (assuming walls form a closed polygon)
  const midpoints = walls.map((w) => ({
    x: (w.from.x + w.to.x) / 2,
    y: (w.from.y + w.to.y) / 2,
  }));
  // Use wall endpoints in order for area calculation
  const cornerPoints = walls.map((w) => w.from);
  const area = polygonArea(cornerPoints);
  const center = polygonCenter(cornerPoints);

  return { name: room.name, walls, doors, windows, openings, area, center };
}

function resolveWall(wall: WallNode, roomName: string): ResolvedWall {
  return {
    direction: wall.direction,
    from: wall.from,
    to: wall.to,
    thickness: wall.thickness,
    roomName,
    polygon: wallPolygon(wall.from, wall.to, wall.thickness),
  };
}

function resolveSharedWall(
  shared: SharedWallNode,
  roomName: string,
  roomMap: Map<string, ResolvedRoom>,
): ResolvedWall {
  const sourceRoom = roomMap.get(shared.sourceRoomName);
  if (!sourceRoom)
    throw new ResolveError(
      `Shared wall references room "${shared.sourceRoomName}", which has not been defined yet`,
    );

  const sourceWall = sourceRoom.walls.find(
    (w) => w.direction === shared.sourceWallDirection,
  );
  if (!sourceWall)
    throw new ResolveError(
      `Shared wall references wall.${shared.sourceWallDirection} from room "${shared.sourceRoomName}", but no such wall exists`,
    );

  // The shared wall uses the same geometry but belongs to this room
  return {
    ...sourceWall,
    direction: shared.direction,
    roomName,
  };
}

function resolveDoor(door: DoorNode, wall: ResolvedWall): ResolvedDoor {
  const position = pointAlongWall(wall.from, wall.to, door.offset);
  return {
    wallDirection: door.wallDirection,
    position,
    width: door.width,
    swing: door.swing,
    wall,
  };
}

function resolveWindow(
  window: WindowNode,
  wall: ResolvedWall,
): ResolvedWindow {
  const position = pointAlongWall(wall.from, wall.to, window.offset);
  return {
    wallDirection: window.wallDirection,
    position,
    width: window.width,
    height: window.height,
    sill: window.sill,
    wall,
  };
}

function resolveOpening(
  opening: OpeningNode,
  wall: ResolvedWall,
): ResolvedOpening {
  const position = pointAlongWall(wall.from, wall.to, opening.offset);
  return {
    wallDirection: opening.wallDirection,
    position,
    width: opening.width,
    wall,
  };
}

function resolveDimension(
  dim: DimensionNode,
  roomMap: Map<string, ResolvedRoom>,
): ResolvedDimension {
  const room = roomMap.get(dim.roomName);
  if (!room)
    throw new ResolveError(
      `Dimension references room "${dim.roomName}", which does not exist`,
    );

  const wall = room.walls.find((w) => w.direction === dim.wallDirection);
  if (!wall)
    throw new ResolveError(
      `Dimension references wall.${dim.wallDirection} from room "${dim.roomName}", which does not exist`,
    );

  return {
    from: wall.from,
    to: wall.to,
    offset: dim.offset,
    direction: dim.wallDirection,
    length: wallLength(wall.from, wall.to),
  };
}

function resolveDimChain(
  dc: DimChainNode,
  roomMap: Map<string, ResolvedRoom>,
): ResolvedDimChain {
  const room = roomMap.get(dc.roomName);
  if (!room)
    throw new ResolveError(
      `Dimchain references room "${dc.roomName}", which does not exist`,
    );

  const wall = room.walls.find((w) => w.direction === dc.wallDirection);
  if (!wall)
    throw new ResolveError(
      `Dimchain references wall.${dc.wallDirection} from room "${dc.roomName}", which does not exist`,
    );

  if (dc.waypoints.length < 2)
    throw new ResolveError(
      `Dimchain needs at least 2 waypoints, got ${dc.waypoints.length}`,
    );

  // Compute wall unit direction and normal
  const wdx = wall.to.x - wall.from.x;
  const wdy = wall.to.y - wall.from.y;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  const ux = wdx / wlen;
  const uy = wdy / wlen;
  const nx = -uy;
  const ny = ux;

  const segments = [];
  for (let i = 0; i < dc.waypoints.length - 1; i++) {
    const fromOffset = dc.waypoints[i];
    const toOffset = dc.waypoints[i + 1];
    segments.push({
      from: {
        x: wall.from.x + ux * fromOffset,
        y: wall.from.y + uy * fromOffset,
      },
      to: {
        x: wall.from.x + ux * toOffset,
        y: wall.from.y + uy * toOffset,
      },
      length: Math.abs(toOffset - fromOffset),
    });
  }

  return {
    segments,
    offset: dc.offset,
    direction: dc.wallDirection,
    normal: { x: nx, y: ny },
  };
}

function resolveLabel(
  label: LabelNode,
  roomMap: Map<string, ResolvedRoom>,
): ResolvedLabel {
  if (label.position === "center") {
    // Find the room by label text
    const room = roomMap.get(label.text);
    if (!room)
      throw new ResolveError(
        `Label "${label.text}" uses 'center area' but no room named "${label.text}" exists`,
      );
    return { text: label.text, position: room.center };
  }
  return { text: label.text, position: label.position };
}
