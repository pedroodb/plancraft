/**
 * Scene Graph — intermediate representation between resolved AST and SVG output.
 *
 * The scene graph is a flat list of drawable primitives with styling metadata,
 * ready for direct emission as SVG elements.
 */

export interface SGLine {
  type: "line";
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeWidth: number;
  layer: Layer;
}

export interface SGPolygon {
  type: "polygon";
  points: Array<{ x: number; y: number }>;
  fill: string;
  strokeWidth: number;
  layer: Layer;
}

export interface SGArc {
  type: "arc";
  cx: number;
  cy: number;
  r: number;
  startAngle: number; // radians
  endAngle: number; // radians
  strokeWidth: number;
  layer: Layer;
}

export interface SGText {
  type: "text";
  x: number;
  y: number;
  content: string;
  fontSize: number;
  anchor: "start" | "middle" | "end";
  layer: Layer;
}

export interface SGCircle {
  type: "circle";
  cx: number;
  cy: number;
  r: number;
  fill: string;
  strokeWidth: number;
  layer: Layer;
}

/**
 * Embeds external SVG content (e.g. a furniture element) into the scene graph.
 * The SVG content is positioned, scaled, and rotated at render time.
 */
export interface SGSvgEmbed {
  type: "svg_embed";
  /** Raw inner SVG markup (children of the <svg> root, without the <svg> wrapper) */
  svgContent: string;
  /** Original element viewBox width (mm) */
  viewBoxWidth: number;
  /** Original element viewBox height (mm) */
  viewBoxHeight: number;
  /** Center X position in plan coordinates (mm) */
  x: number;
  /** Center Y position in plan coordinates (mm) */
  y: number;
  /** Target width in plan coordinates (mm) */
  width: number;
  /** Target height / depth in plan coordinates (mm) */
  height: number;
  /** Rotation in degrees */
  rotation: number;
  layer: Layer;
}

export interface SGGroup {
  type: "group";
  id: string;
  children: SGNode[];
}

export type SGNode = SGLine | SGPolygon | SGArc | SGText | SGCircle | SGSvgEmbed | SGGroup;

export type Layer = "walls" | "openings" | "dimensions" | "labels" | "furniture";

/** Line weight conventions (in mm at 1:1) */
export const LINE_WEIGHTS: Record<Layer, number> = {
  walls: 0.5,
  openings: 0.25,
  dimensions: 0.13,
  labels: 0.13,
  furniture: 0.18,
};
