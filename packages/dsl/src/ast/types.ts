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
export type SwingDirection = "left" | "right" | "sliding";

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

export interface DimensionNode {
  type: "dimension";
  wallDirection: WallDirection;
  roomName: string;
  offset: number;
}

export interface DimChainNode {
  type: "dimchain";
  wallDirection: WallDirection;
  roomName: string;
  offset: number;
  /** Waypoints along the wall (distances from wall.from) */
  waypoints: number[];
}

export interface LabelNode {
  type: "label";
  text: string;
  position: "center" | Point;
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

export type FloorChild = RoomNode | DimensionNode | DimChainNode | LabelNode;

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
}

export interface ResolvedWindow {
  wallDirection: WallDirection;
  position: Point;
  width: number;
  height: number;
  sill: number;
  wall: ResolvedWall;
}

export interface ResolvedDimension {
  from: Point;
  to: Point;
  offset: number;
  direction: WallDirection;
  length: number;
}

export interface ResolvedDimChainSegment {
  from: Point;
  to: Point;
  length: number;
}

export interface ResolvedDimChain {
  segments: ResolvedDimChainSegment[];
  offset: number;
  direction: WallDirection;
  /** The wall's unit direction for offset calculation */
  normal: Point;
}

export interface ResolvedLabel {
  text: string;
  position: Point;
}

export interface ResolvedOpening {
  wallDirection: WallDirection;
  position: Point;
  width: number;
  wall: ResolvedWall;
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
  dimensions: ResolvedDimension[];
  dimChains: ResolvedDimChain[];
  labels: ResolvedLabel[];
}

export interface ResolvedProject {
  name: string;
  scale: Scale;
  unit: Unit;
  floors: ResolvedFloor[];
}
