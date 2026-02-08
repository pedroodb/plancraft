export { buildScene, buildSceneWithFurniture, buildFurnitureScene } from "./build-scene.js";
export { emitSVG } from "./emitters/svg-emitter.js";
export type { SVGEmitterOptions } from "./emitters/svg-emitter.js";
export type {
  SGNode,
  SGLine,
  SGPolygon,
  SGArc,
  SGText,
  SGCircle,
  SGSvgEmbed,
  SGGroup,
} from "./scene-graph.js";
export type { Layer } from "./scene-graph.js";
export { LINE_WEIGHTS } from "./scene-graph.js";
