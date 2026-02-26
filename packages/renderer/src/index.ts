export { buildScene, buildSceneWithFurniture, buildFurnitureScene } from "./build-scene.js";
export { emitSVG } from "./emitters/svg-emitter.js";
export type { SVGEmitterOptions } from "./emitters/svg-emitter.js";
export type {
  SGNode,
  SGLine,
  SGPolygon,
  SGPath,
  SGArc,
  SGText,
  SGCircle,
  SGSvgEmbed,
  SGGroup,
} from "./scene-graph.js";
export type { Layer } from "./scene-graph.js";
export { LINE_WEIGHTS } from "./scene-graph.js";

// Spatial validation utilities
export {
  validateFurniturePlacement,
  computeRoomGeometries,
  computeFurnitureAABBs,
  computeDoorClearances,
  computeSpatialMetrics,
  aabbOverlap,
  pointInPolygon,
  rotatedRectAABB,
  roomBoundingBox,
  roomCenterlinePolygon,
  polygonAABB,
} from "./geometry/spatial.js";
export type {
  AABB,
  RoomGeometry,
  WallInfo,
  FurnitureAABB,
  DoorClearanceInfo,
  SpatialWarning,
  SpatialMetrics,
} from "./geometry/spatial.js";
