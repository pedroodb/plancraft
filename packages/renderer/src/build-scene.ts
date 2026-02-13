/**
 * Builds a scene graph from a resolved project.
 */

import type {
  Point,
  ResolvedFloor,
  ResolvedProject,
  ResolvedRoom,
  ResolvedWall,
} from "@plancraft/dsl";
import { wallToPolygons } from "./geometry/wall-geometry.js";
import type { WallOpening } from "./geometry/wall-geometry.js";
import { doorToGeometry } from "./geometry/door-geometry.js";
import { windowToGeometry } from "./geometry/window-geometry.js";
import { dimensionToGeometry, dimChainToGeometry } from "./dimensions.js";
import type { DimensionInput, DimChainInput } from "./dimensions.js";
import type { SGGroup, SGNode, SGSvgEmbed, SGText } from "./scene-graph.js";

import type { FurnitureLayout, FurniturePackage, FurnitureElement } from "@plancraft/furniture";
import { resolveElement, parseSvg, resolveAnchors } from "@plancraft/furniture";
import { computeRoomGeometries } from "./geometry/spatial.js";

export function buildScene(project: ResolvedProject): SGGroup {
  const children: SGNode[] = [];

  for (const floor of project.floors) {
    children.push(buildFloorScene(floor));
  }

  return {
    type: "group",
    id: project.name,
    children,
  };
}

/**
 * Build a scene graph that includes both the structural plan and furniture overlay.
 * Anchored/relative furniture placements are resolved to absolute coordinates first.
 */
export function buildSceneWithFurniture(
  project: ResolvedProject,
  layout?: FurnitureLayout,
  packages?: FurniturePackage[],
): SGGroup {
  const structureScene = buildScene(project);

  if (!layout || !packages || layout.placements.length === 0) {
    return structureScene;
  }

  // Resolve anchored/relative placements to absolute coordinates
  const roomGeometries = computeRoomGeometries(project);
  const resolvedLayout = resolveAnchors(layout, roomGeometries);

  const furnitureScene = buildFurnitureScene(resolvedLayout, packages);
  structureScene.children.push(furnitureScene);

  return structureScene;
}

/**
 * Resolve an element for a placement.
 *
 * Resolution order:
 * 1. Layout's self-contained elements map (by element ID)
 * 2. Loaded packages (fallback for rendering without embedded elements,
 *    e.g. CLI compile with --furniture-packages)
 */
function resolveElementForPlacement(
  packages: FurniturePackage[],
  layout: FurnitureLayout,
  elementRef: string,
): FurnitureElement | null {
  // 1. Try layout's own elements (self-contained .pcf)
  if (layout.elements) {
    const def = layout.elements[elementRef];
    if (def) {
      const { viewBoxWidth, viewBoxHeight, innerSvg } = parseSvg(def.svg);
      return {
        id: elementRef,
        meta: {
          name: def.name,
          tags: def.tags,
          defaultWidth: def.defaultWidth,
          defaultDepth: def.defaultDepth,
        },
        svg: def.svg,
        innerSvg,
        viewBoxWidth,
        viewBoxHeight,
      };
    }
  }

  // 2. Fall back to loaded packages (useful for CLI rendering with external packages)
  //    Try as "package/element" first, then as plain ID across all packages
  const fromPackage = resolveElement(packages, elementRef);
  if (fromPackage) return fromPackage;

  // Try plain ID across all packages
  for (const pkg of packages) {
    const el = pkg.elements.get(elementRef);
    if (el) return el;
  }

  return null;
}

/**
 * Build a scene graph group containing all furniture placements.
 */
export function buildFurnitureScene(
  layout: FurnitureLayout,
  packages: FurniturePackage[],
): SGGroup {
  const children: SGNode[] = [];

  for (const placement of layout.placements) {
    const element = resolveElementForPlacement(packages, layout, placement.element);
    if (!element) continue;

    // Check if this is a legacy placement with absolute width/depth
    const isLegacy = (placement as unknown as Record<string, unknown>)["_legacyAbsolute"] === true;

    let width: number;
    let height: number;

    if (isLegacy) {
      // Legacy: scaleWidth/scaleDepth actually contain absolute mm values
      width = placement.scaleWidth || element.meta.defaultWidth;
      height = placement.scaleDepth || element.meta.defaultDepth;
    } else {
      // New: compute actual dimensions from scale percentage
      width = element.meta.defaultWidth * (placement.scaleWidth / 100);
      height = element.meta.defaultDepth * (placement.scaleDepth / 100);
    }

    const embed: SGSvgEmbed = {
      type: "svg_embed",
      svgContent: element.innerSvg,
      viewBoxWidth: element.viewBoxWidth,
      viewBoxHeight: element.viewBoxHeight,
      x: placement.position.x,
      y: placement.position.y,
      width,
      height,
      rotation: placement.rotation,
      layer: "furniture",
    };

    children.push(embed);
  }

  return {
    type: "group",
    id: "furniture",
    children,
  };
}

/**
 * An opening stored with its absolute start/end positions so that the
 * parametric offset can be recomputed relative to whichever wall object
 * ends up being drawn (two adjacent rooms may define the same wall with
 * reversed from/to, and the drawing order is non-deterministic).
 *
 * `start` is the hinge/origin end of the opening.
 * `end` is the opposite end (hinge + width along the wall direction).
 */
interface CollectedOpening {
  start: Point;
  end: Point;
}

/**
 * Collect all openings (doors + windows + plain openings) that belong to a
 * given wall, returning them with absolute start/end positions.
 *
 * The opening extent is computed along the wall's own from→to direction so
 * that the absolute range is always correct, regardless of which wall object
 * eventually gets drawn.
 */
function collectOpeningsAbsolute(
  wall: ResolvedWall,
  room: ResolvedRoom,
): CollectedOpening[] {
  const openings: CollectedOpening[] = [];

  // Wall unit direction — used to compute the end position of each opening
  const wdx = wall.to.x - wall.from.x;
  const wdy = wall.to.y - wall.from.y;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  if (wlen === 0) return openings;
  const ux = wdx / wlen;
  const uy = wdy / wlen;

  for (const door of room.doors) {
    if (door.wall === wall) {
      const s = door.position;
      openings.push({
        start: s,
        end: { x: s.x + ux * door.width, y: s.y + uy * door.width },
      });
    }
  }

  for (const win of room.windows) {
    if (win.wall === wall) {
      const s = win.position;
      openings.push({
        start: s,
        end: { x: s.x + ux * win.width, y: s.y + uy * win.width },
      });
    }
  }

  for (const op of room.openings) {
    if (op.wall === wall) {
      const s = op.position;
      openings.push({
        start: s,
        end: { x: s.x + ux * op.width, y: s.y + uy * op.width },
      });
    }
  }

  return openings;
}

/**
 * Find all openings that are collinear with a wall and overlap its extent.
 *
 * This handles three cases:
 * 1. Exact wall match (same endpoints, possibly reversed)
 * 2. Partially overlapping walls (different extents on the same line)
 * 3. One wall fully containing another
 *
 * For each matching opening, both endpoints are projected onto the drawn
 * wall's direction and clamped to the wall's extent [0, len]. This ensures
 * the gap is always correct regardless of wall direction.
 */
function findOverlappingOpenings(
  allOpenings: CollectedOpening[],
  wall: ResolvedWall,
): WallOpening[] {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return [];
  const ux = dx / len;
  const uy = dy / len;
  // Normal perpendicular to wall direction
  const nx = -uy;
  const ny = ux;

  const result: WallOpening[] = [];
  // Tolerance for "on the same line" check (1mm accounts for float imprecision)
  const EPSILON = 1;

  for (const op of allOpenings) {
    // Check if the opening lies on this wall's line (perpendicular distance ≈ 0)
    const perpDist = Math.abs(
      (op.start.x - wall.from.x) * nx + (op.start.y - wall.from.y) * ny,
    );
    if (perpDist > EPSILON) continue;

    // Project both endpoints onto the wall direction
    const t0 = (op.start.x - wall.from.x) * ux + (op.start.y - wall.from.y) * uy;
    const t1 = (op.end.x - wall.from.x) * ux + (op.end.y - wall.from.y) * uy;

    const tMin = Math.min(t0, t1);
    const tMax = Math.max(t0, t1);

    // Check if the opening overlaps with this wall's extent [0, len]
    if (tMax <= 0 || tMin >= len) continue;

    // Clamp to wall extent
    const clampedMin = Math.max(0, tMin);
    const clampedMax = Math.min(len, tMax);

    if (clampedMax > clampedMin) {
      result.push({ offset: clampedMin, width: clampedMax - clampedMin });
    }
  }

  return result;
}

function buildFloorScene(floor: ResolvedFloor): SGGroup {
  const children: SGNode[] = [];

  // Track which walls we've already drawn (to avoid duplicating shared walls)
  const drawnWalls = new Set<string>();

  // Collect ALL openings from every room/wall with absolute start/end positions.
  // These are matched against each wall by collinearity and overlap, not just
  // by exact wallKey — so a door on one wall also clips any other wall that
  // shares the same line segment (even partially).
  const allOpenings: CollectedOpening[] = [];

  for (const room of floor.rooms) {
    for (const wall of room.walls) {
      allOpenings.push(...collectOpeningsAbsolute(wall, room));
    }
  }

  for (const room of floor.rooms) {
    // Walls (with clipping)
    for (const wall of room.walls) {
      const key = wallKey(wall.from.x, wall.from.y, wall.to.x, wall.to.y);
      if (!drawnWalls.has(key)) {
        drawnWalls.add(key);
        // Find all openings that lie on this wall's line and overlap its extent
        const openings = findOverlappingOpenings(allOpenings, wall);
        children.push(...wallToPolygons(wall, openings));
      }
    }

    // Doors
    for (const door of room.doors) {
      children.push(...doorToGeometry(door));
    }

    // Windows
    for (const win of room.windows) {
      children.push(...windowToGeometry(win));
    }
  }

  // Auto-generate labels: one per room at its geometric center
  for (const room of floor.rooms) {
    const label: SGText = {
      type: "text",
      x: room.center.x,
      y: room.center.y,
      content: room.name,
      fontSize: 150,
      anchor: "middle",
      layer: "labels",
    };
    children.push(label);
  }

  // Auto-generate dimensions: one per unique wall
  const dimensionedWalls = new Set<string>();
  const DEFAULT_DIM_OFFSET = 500;

  for (const room of floor.rooms) {
    for (const wall of room.walls) {
      const key = wallKey(wall.from.x, wall.from.y, wall.to.x, wall.to.y);
      if (dimensionedWalls.has(key)) continue;
      dimensionedWalls.add(key);

      const wdx = wall.to.x - wall.from.x;
      const wdy = wall.to.y - wall.from.y;
      const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
      if (wlen === 0) continue;

      // Collect openings (doors, windows, openings) on this wall
      const openingRanges = collectWallOpeningRanges(wall, room, wlen);

      if (openingRanges.length > 0) {
        // Build a dimchain with waypoints at each opening boundary
        const waypoints = buildWaypoints(openingRanges, wlen);
        if (waypoints.length >= 2) {
          const chain = buildDimChain(wall, waypoints, DEFAULT_DIM_OFFSET);
          children.push(...dimChainToGeometry(chain));
        }
      } else {
        // Simple full-wall dimension
        const dim = buildDimension(wall, wlen, DEFAULT_DIM_OFFSET);
        children.push(...dimensionToGeometry(dim));
      }
    }
  }

  return {
    type: "group",
    id: floor.name,
    children,
  };
}

// ── Auto-dimension helpers ────────────────────────────────────────────

interface OpeningRange {
  start: number;
  end: number;
}

/**
 * Collect the offset ranges of all openings (doors, windows, openings) on a wall.
 */
function collectWallOpeningRanges(
  wall: ResolvedWall,
  room: ResolvedRoom,
  wallLen: number,
): OpeningRange[] {
  const ranges: OpeningRange[] = [];

  for (const door of room.doors) {
    if (door.wall === wall) {
      // door.position is the start point; offset = projection along wall
      const dx = door.position.x - wall.from.x;
      const dy = door.position.y - wall.from.y;
      const ux = (wall.to.x - wall.from.x) / wallLen;
      const uy = (wall.to.y - wall.from.y) / wallLen;
      const offset = dx * ux + dy * uy;
      ranges.push({ start: offset, end: offset + door.width });
    }
  }

  for (const win of room.windows) {
    if (win.wall === wall) {
      const dx = win.position.x - wall.from.x;
      const dy = win.position.y - wall.from.y;
      const ux = (wall.to.x - wall.from.x) / wallLen;
      const uy = (wall.to.y - wall.from.y) / wallLen;
      const offset = dx * ux + dy * uy;
      ranges.push({ start: offset, end: offset + win.width });
    }
  }

  for (const op of room.openings) {
    if (op.wall === wall) {
      const dx = op.position.x - wall.from.x;
      const dy = op.position.y - wall.from.y;
      const ux = (wall.to.x - wall.from.x) / wallLen;
      const uy = (wall.to.y - wall.from.y) / wallLen;
      const offset = dx * ux + dy * uy;
      ranges.push({ start: offset, end: offset + op.width });
    }
  }

  // Sort by start offset
  ranges.sort((a, b) => a.start - b.start);
  return ranges;
}

/**
 * Build sorted unique waypoints from opening ranges plus wall start/end.
 */
function buildWaypoints(ranges: OpeningRange[], wallLen: number): number[] {
  const set = new Set<number>();
  set.add(0);
  set.add(wallLen);
  for (const r of ranges) {
    set.add(r.start);
    set.add(r.end);
  }
  return Array.from(set).sort((a, b) => a - b);
}

/**
 * Build a DimensionInput for a full wall.
 */
function buildDimension(
  wall: ResolvedWall,
  wallLen: number,
  offset: number,
): DimensionInput {
  return {
    from: wall.from,
    to: wall.to,
    offset,
    length: wallLen,
  };
}

/**
 * Build a DimChainInput from waypoints along a wall.
 */
function buildDimChain(
  wall: ResolvedWall,
  waypoints: number[],
  offset: number,
): DimChainInput {
  const wdx = wall.to.x - wall.from.x;
  const wdy = wall.to.y - wall.from.y;
  const wlen = Math.sqrt(wdx * wdx + wdy * wdy);
  const ux = wdx / wlen;
  const uy = wdy / wlen;
  const nx = -uy;
  const ny = ux;

  const segments = [];
  for (let i = 0; i < waypoints.length - 1; i++) {
    const fromOff = waypoints[i];
    const toOff = waypoints[i + 1];
    segments.push({
      from: { x: wall.from.x + ux * fromOff, y: wall.from.y + uy * fromOff },
      to: { x: wall.from.x + ux * toOff, y: wall.from.y + uy * toOff },
      length: Math.abs(toOff - fromOff),
    });
  }

  return { segments, offset, normal: { x: nx, y: ny } };
}

function wallKey(x1: number, y1: number, x2: number, y2: number): string {
  if (x1 < x2 || (x1 === x2 && y1 < y2)) {
    return `${x1},${y1}-${x2},${y2}`;
  }
  return `${x2},${y2}-${x1},${y1}`;
}
