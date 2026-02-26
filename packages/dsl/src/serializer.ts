/**
 * Serializer for the Plancraft compact DSL format.
 *
 * Converts a ProjectNode AST back into the indented DSL text format.
 */

import type {
  DoorNode,
  FloorNode,
  OpeningNode,
  ProjectNode,
  RoomChild,
  RoomNode,
  SharedWallNode,
  WallNode,
  WindowNode,
} from "./ast/types.js";

// ── Helpers ──────────────────────────────────────────────────────────

/** Quote a string if it contains spaces, otherwise return as-is. */
function q(s: string): string {
  if (s.includes(" ") || s.includes("\t")) return `"${s}"`;
  return s;
}

/** Format a coordinate as "x,y". */
function coord(x: number, y: number): string {
  return `${x},${y}`;
}

// ── Serializers for each node type ───────────────────────────────────

function serializeWall(wall: WallNode): string {
  let line = `wall ${q(wall.direction)} ${coord(wall.from.x, wall.from.y)} ${coord(wall.to.x, wall.to.y)} ${wall.thickness}`;
  if (wall.bulge !== undefined && wall.bulge !== 0) {
    line += ` bulge=${wall.bulge}`;
  }
  return line;
}

function serializeSharedWall(sw: SharedWallNode): string {
  let line = `shared ${q(sw.direction)} from ${q(sw.sourceRoomName)}`;
  if (sw.sourceWallDirection !== sw.direction) {
    line += ` sourceWall=${q(sw.sourceWallDirection)}`;
  }
  return line;
}

function serializeDoor(door: DoorNode): string {
  return `door ${q(door.wallDirection)} ${door.offset} ${door.width} ${door.swing}`;
}

function serializeWindow(win: WindowNode): string {
  return `window ${q(win.wallDirection)} ${win.offset} ${win.width} ${win.height} ${win.sill}`;
}

function serializeOpening(opening: OpeningNode): string {
  return `opening ${q(opening.wallDirection)} ${opening.offset} ${opening.width}`;
}

function serializeRoomChild(child: RoomChild): string {
  switch (child.type) {
    case "wall":
      return serializeWall(child);
    case "shared_wall":
      return serializeSharedWall(child);
    case "door":
      return serializeDoor(child);
    case "window":
      return serializeWindow(child);
    case "opening":
      return serializeOpening(child);
  }
}

function serializeRoom(room: RoomNode, indent: string): string {
  const lines: string[] = [];
  lines.push(`${indent}room: ${q(room.name)}`);

  const childIndent = indent + "  ";
  for (const child of room.children) {
    lines.push(`${childIndent}${serializeRoomChild(child)}`);
  }

  return lines.join("\n");
}

function serializeFloor(floor: FloorNode): string {
  const lines: string[] = [];
  lines.push(`floor: ${q(floor.name)}`);

  for (const child of floor.children) {
    if (child.type === "room") {
      lines.push(serializeRoom(child, "  "));
    }
  }

  return lines.join("\n");
}

// ── Public API ───────────────────────────────────────────────────────

/**
 * Serialize a ProjectNode AST into the compact Plancraft DSL format.
 */
export function serialize(project: ProjectNode): string {
  const lines: string[] = [];

  lines.push(`plan: ${q(project.name)}`);

  if (project.scale.ratio !== 100) {
    lines.push(`scale: ${project.scale.ratio}`);
  }
  if (project.unit !== "mm") {
    lines.push(`unit: ${project.unit}`);
  }

  for (const floor of project.floors) {
    lines.push(""); // blank line before each floor
    lines.push(serializeFloor(floor));
  }

  return lines.join("\n") + "\n";
}
