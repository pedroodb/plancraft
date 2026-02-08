/**
 * Types for the furniture element/package/placement system.
 */

// ── Points (same convention as @plancraft/dsl) ───────────────────────

export interface Point {
  x: number;
  y: number;
}

// ── Furniture element metadata ───────────────────────────────────────

export interface FurnitureElementMeta {
  /** Human-readable display name (e.g. "Double Bed") */
  name: string;
  /** Category for grouping in the UI (e.g. "bedroom", "kitchen") */
  category: string;
  /** Default width in mm */
  defaultWidth: number;
  /** Default depth in mm */
  defaultDepth: number;
}

/**
 * A loaded furniture element: metadata + raw SVG string.
 */
export interface FurnitureElement {
  /** Element ID (filename without .svg, e.g. "bed") */
  id: string;
  /** Metadata from the package manifest */
  meta: FurnitureElementMeta;
  /** Raw SVG file content */
  svg: string;
  /**
   * Inner SVG content (the children of the root <svg> element),
   * ready for embedding inside another SVG via a <g> wrapper.
   */
  innerSvg: string;
  /** viewBox width extracted from the SVG root (mm) */
  viewBoxWidth: number;
  /** viewBox height extracted from the SVG root (mm) */
  viewBoxHeight: number;
}

// ── Furniture package ────────────────────────────────────────────────

export interface PackageManifest {
  name: string;
  version: string;
  description: string;
  elements: Record<string, FurnitureElementMeta>;
}

export interface FurniturePackage {
  /** Package name (directory name / manifest name) */
  name: string;
  /** Package version */
  version: string;
  /** Package description */
  description: string;
  /** Directory where the package lives on disk */
  dir: string;
  /** Loaded elements keyed by element ID */
  elements: Map<string, FurnitureElement>;
}

// ── Furniture placement (.pcf file) ──────────────────────────────────

export interface FurniturePlacement {
  /** Element reference: "packageName/elementId" */
  element: string;
  /** Center position in plan coordinates (mm) */
  position: Point;
  /** Width override (mm). If omitted, uses element default. */
  width?: number;
  /** Depth override (mm). If omitted, uses element default. */
  depth?: number;
  /** Rotation in degrees (default 0) */
  rotation?: number;
  /** Optional room tag for organizational grouping */
  room?: string;
}

export interface FurnitureLayout {
  placements: FurniturePlacement[];
}
