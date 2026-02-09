/**
 * Builds a scene graph from a resolved project.
 */

import type {
  ResolvedDoor,
  ResolvedFloor,
  ResolvedOpening,
  ResolvedProject,
  ResolvedRoom,
  ResolvedWall,
  ResolvedWindow,
} from "@plancraft/dsl";
import { wallToPolygons } from "./geometry/wall-geometry.js";
import type { WallOpening } from "./geometry/wall-geometry.js";
import { doorToGeometry } from "./geometry/door-geometry.js";
import { windowToGeometry } from "./geometry/window-geometry.js";
import { dimensionToGeometry, dimChainToGeometry } from "./dimensions.js";
import type { SGGroup, SGNode, SGSvgEmbed, SGText } from "./scene-graph.js";

import type { FurnitureLayout, FurniturePackage, FurnitureElement } from "@plancraft/furniture";
import { resolveElement, parseSvg } from "@plancraft/furniture";

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

  const furnitureScene = buildFurnitureScene(layout, packages);
  structureScene.children.push(furnitureScene);

  return structureScene;
}

/**
 * Resolve an element for a placement, checking packages first, then custom elements.
 */
function resolveElementForPlacement(
  packages: FurniturePackage[],
  layout: FurnitureLayout,
  elementRef: string,
): FurnitureElement | null {
  // Try resolving from loaded packages first
  const fromPackage = resolveElement(packages, elementRef);
  if (fromPackage) return fromPackage;

  // Check custom elements embedded in the layout
  const slashIdx = elementRef.indexOf("/");
  if (slashIdx < 0) return null;

  const pkgName = elementRef.slice(0, slashIdx);
  const elemId = elementRef.slice(slashIdx + 1);

  if (pkgName !== "custom" || !layout.customElements) return null;

  const customDef = layout.customElements[elemId];
  if (!customDef) return null;

  // Parse the SVG to extract inner content and viewBox
  const { viewBoxWidth, viewBoxHeight, innerSvg } = parseSvg(customDef.svg);

  return {
    id: elemId,
    meta: {
      name: customDef.name,
      category: customDef.category,
      defaultWidth: customDef.defaultWidth,
      defaultDepth: customDef.defaultDepth,
    },
    svg: customDef.svg,
    innerSvg,
    viewBoxWidth,
    viewBoxHeight,
  };
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
 * Collect all openings (doors + windows) that belong to a given wall,
 * returning them as offset+width pairs for wall clipping.
 */
function collectOpenings(
  wall: ResolvedWall,
  room: ResolvedRoom,
): WallOpening[] {
  const openings: WallOpening[] = [];

  for (const door of room.doors) {
    if (door.wall === wall) {
      openings.push({ offset: doorOffset(door, wall), width: door.width });
    }
  }

  for (const win of room.windows) {
    if (win.wall === wall) {
      openings.push({ offset: windowOffset(win, wall), width: win.width });
    }
  }

  for (const op of room.openings) {
    if (op.wall === wall) {
      openings.push({ offset: openingOffset(op, wall), width: op.width });
    }
  }

  return openings;
}

/** Compute the parametric offset of a door along its wall. */
function doorOffset(door: ResolvedDoor, wall: ResolvedWall): number {
  const dx = door.position.x - wall.from.x;
  const dy = door.position.y - wall.from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Compute the parametric offset of a window along its wall. */
function windowOffset(win: ResolvedWindow, wall: ResolvedWall): number {
  const dx = win.position.x - wall.from.x;
  const dy = win.position.y - wall.from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Compute the parametric offset of a plain opening along its wall. */
function openingOffset(op: ResolvedOpening, wall: ResolvedWall): number {
  const dx = op.position.x - wall.from.x;
  const dy = op.position.y - wall.from.y;
  return Math.sqrt(dx * dx + dy * dy);
}

function buildFloorScene(floor: ResolvedFloor): SGGroup {
  const children: SGNode[] = [];

  // Track which walls we've already drawn (to avoid duplicating shared walls)
  const drawnWalls = new Set<string>();

  // First pass: collect all openings keyed by wall geometry key,
  // since a shared wall might have openings from multiple rooms.
  const openingsByWallKey = new Map<string, WallOpening[]>();

  for (const room of floor.rooms) {
    for (const wall of room.walls) {
      const key = wallKey(wall.from.x, wall.from.y, wall.to.x, wall.to.y);
      const existing = openingsByWallKey.get(key) ?? [];
      existing.push(...collectOpenings(wall, room));
      openingsByWallKey.set(key, existing);
    }
  }

  for (const room of floor.rooms) {
    // Walls (with clipping)
    for (const wall of room.walls) {
      const key = wallKey(wall.from.x, wall.from.y, wall.to.x, wall.to.y);
      if (!drawnWalls.has(key)) {
        drawnWalls.add(key);
        const openings = openingsByWallKey.get(key) ?? [];
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

  // Dimensions
  for (const dim of floor.dimensions) {
    children.push(...dimensionToGeometry(dim));
  }

  // Dimension chains
  for (const dc of floor.dimChains) {
    children.push(...dimChainToGeometry(dc));
  }

  // Labels
  for (const label of floor.labels) {
    const text: SGText = {
      type: "text",
      x: label.position.x,
      y: label.position.y,
      content: label.text,
      fontSize: 150,
      anchor: "middle",
      layer: "labels",
    };
    children.push(text);
  }

  return {
    type: "group",
    id: floor.name,
    children,
  };
}

function wallKey(x1: number, y1: number, x2: number, y2: number): string {
  if (x1 < x2 || (x1 === x2 && y1 < y2)) {
    return `${x1},${y1}-${x2},${y2}`;
  }
  return `${x2},${y2}-${x1},${y1}`;
}
