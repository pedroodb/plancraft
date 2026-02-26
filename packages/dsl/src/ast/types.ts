// ── Unit system ──────────────────────────────────────────────────────
export type Unit = "mm" | "cm" | "m" | "ft" | "in";

export interface Point {
  x: number;
  y: number;
}

// ── Scale ────────────────────────────────────────────────────────────
export interface Scale {
  ratio: number; // e.g. 1:100 → 100
}

// ── Swing direction for doors ────────────────────────────────────────
export type SwingDirection = "left" | "right" | "double" | "sliding";

// ── Wall identifier ──────────────────────────────────────────────────
// Cardinal directions are conventional shortcuts; any string name is valid.
export type WallDirection = string;

// ── Raw AST nodes (source-faithful) ─────────────────────────────────

export interface WallNode {
  type: "wall";
  direction: WallDirection;
  from: Point;
  to: Point;
  thickness: number;
  /** Optional wall curvature (bulge factor).
   *  0 or omitted = straight line.
   *  Positive = arc curves left (CCW from `from` to `to`).
   *  Negative = arc curves right (CW).
   *  1 = semicircle (180°).
   *  Formula: bulge = tan(arcAngle / 4). */
  bulge?: number;
}

export interface SharedWallNode {
  type: "shared_wall";
  direction: WallDirection;
  sourceWallDirection: WallDirection;
  sourceRoomName: string;
}

export interface DoorNode {
  type: "door";
  wallDirection: WallDirection;
  offset: number;
  width: number;
  swing: SwingDirection;
}

export interface WindowNode {
  type: "window";
  wallDirection: WallDirection;
  offset: number;
  width: number;
  height: number;
  sill: number;
}

export interface OpeningNode {
  type: "opening";
  wallDirection: WallDirection;
  offset: number;
  width: number;
}

export type RoomChild = WallNode | SharedWallNode | DoorNode | WindowNode | OpeningNode;

export interface RoomNode {
  type: "room";
  name: string;
  children: RoomChild[];
}

export type FloorChild = RoomNode;

export interface FloorNode {
  type: "floor";
  name: string;
  children: FloorChild[];
}

export interface ProjectNode {
  type: "project";
  name: string;
  scale: Scale;
  unit: Unit;
  floors: FloorNode[];
}

// ── Resolved AST (computed geometry) ─────────────────────────────────

export interface ResolvedWall {
  direction: WallDirection;
  from: Point;
  to: Point;
  thickness: number;
  roomName: string;
  /** Wall polygon points. 4 points for straight walls, more for curved walls (arc approximation). */
  polygon: Point[];
  /** Optional bulge factor (preserved from input). 0 or undefined = straight. */
  bulge?: number;
  /** Sampled centerline points along the arc (only present when bulge is set and non-zero). */
  curvePoints?: Point[];
}

export interface ResolvedDoor {
  wallDirection: WallDirection;
  /** Position on the wall centerline where the door starts */
  position: Point;
  width: number;
  swing: SwingDirection;
  /** The wall this door is on */
  wall: ResolvedWall;
  /** End position on the wall centerline (position + width along the wall).
   *  For curved walls this is on the arc; for straight walls it's on the chord.
   *  When set, door/window geometry draws between position and endPosition. */
  endPosition?: Point;
  /** Unit tangent direction along the wall at this opening's position.
   *  For straight walls this equals the wall unit direction.
   *  For curved walls this is the arc tangent at the opening point. */
  tangent?: { dx: number; dy: number };
  /** Arc-length offset from wall start (only set for curved walls). */
  arcOffset?: number;
}

export interface ResolvedWindow {
  wallDirection: WallDirection;
  position: Point;
  width: number;
  height: number;
  sill: number;
  wall: ResolvedWall;
  /** End position on the wall centerline. */
  endPosition?: Point;
  /** Unit tangent direction along the wall at this opening's position. */
  tangent?: { dx: number; dy: number };
  /** Arc-length offset from wall start (only set for curved walls). */
  arcOffset?: number;
}

export interface ResolvedOpening {
  wallDirection: WallDirection;
  position: Point;
  width: number;
  wall: ResolvedWall;
  /** End position on the wall centerline. */
  endPosition?: Point;
  /** Unit tangent direction along the wall at this opening's position. */
  tangent?: { dx: number; dy: number };
  /** Arc-length offset from wall start (only set for curved walls). */
  arcOffset?: number;
}

export interface ResolvedRoom {
  name: string;
  walls: ResolvedWall[];
  doors: ResolvedDoor[];
  windows: ResolvedWindow[];
  openings: ResolvedOpening[];
  area: number; // in unit²
  center: Point;
}

export interface ResolvedFloor {
  name: string;
  rooms: ResolvedRoom[];
}

export interface ResolvedProject {
  name: string;
  scale: Scale;
  unit: Unit;
  floors: ResolvedFloor[];
}
