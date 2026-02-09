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
  /** Tags for grouping and filtering (e.g. ["bedroom", "sleeping"]) */
  tags: string[];
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

// ── Furniture element definition (embedded in .pcf) ──────────────────

/**
 * A self-contained furniture element definition embedded in the .pcf file.
 * Elements are imported from packages or generated on the fly by the AI.
 * The .pcf file is fully self-contained: it carries all element definitions
 * it needs, so no package loading is required at render time.
 */
export interface FurnitureElementDef {
  /** Human-readable display name */
  name: string;
  /** Tags for grouping and filtering (e.g. ["bedroom", "sleeping"]) */
  tags: string[];
  /** Default width in mm */
  defaultWidth: number;
  /** Default depth in mm */
  defaultDepth: number;
  /** Full SVG content (including <svg> root element) */
  svg: string;
  /** Optional: which package this element was imported from */
  source?: string;
}

// ── Furniture placement (.pcf file) ──────────────────────────────────

export interface FurniturePlacement {
  /** Element ID (key into the layout's elements map, e.g. "bed", "sofa") */
  element: string;
  /** Center position in plan coordinates (mm) */
  position: Point;
  /** Width scale as percentage of original size (default 100) */
  scaleWidth: number;
  /** Depth scale as percentage of original size (default 100) */
  scaleDepth: number;
  /** Whether width and depth scale together (default true) */
  lockProportions: boolean;
  /** Rotation in degrees (default 0) */
  rotation: number;
  /** Optional room tag for organizational grouping */
  room?: string;
}

// ── Furniture layout (.pcf root) ─────────────────────────────────────

export interface FurnitureLayout {
  /**
   * Self-contained element definitions used by this layout, keyed by ID.
   * Elements are imported from packages or generated on the fly.
   * Placements reference these by their key.
   */
  elements?: Record<string, FurnitureElementDef>;

  /** Furniture placements */
  placements: FurniturePlacement[];
}
