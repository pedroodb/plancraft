export type {
  Point,
  FurnitureElementMeta,
  FurnitureElement,
  PackageManifest,
  FurniturePackage,
  FurniturePlacement,
  FurnitureLayout,
  FurnitureElementDef,
  WallAnchor,
  RelativePosition,
} from "./types.js";

export {
  listElements,
  getElementSvg,
  resolveElement,
  parseSvg,
} from "./utils.js";

export {
  parseLayout,
  serializeLayout,
  LayoutParseError,
} from "./layout.js";

export {
  resolveAnchors,
} from "./resolve-anchors.js";
export type { ResolveRoomGeometry } from "./resolve-anchors.js";
