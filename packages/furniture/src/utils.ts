/**
 * Browser-safe utility functions for working with loaded furniture data.
 * These functions operate on in-memory data structures only — no Node.js APIs.
 */

import type {
  FurnitureElement,
  FurnitureElementMeta,
  FurniturePackage,
} from "./types.js";

/**
 * Parse the SVG root element to extract viewBox dimensions and inner content.
 * This is browser-safe (no Node.js APIs).
 */
export function parseSvg(svg: string): {
  viewBoxWidth: number;
  viewBoxHeight: number;
  innerSvg: string;
} {
  // Extract viewBox attribute
  const vbMatch = svg.match(/viewBox\s*=\s*"([^"]+)"/);
  let viewBoxWidth = 100;
  let viewBoxHeight = 100;
  if (vbMatch) {
    const parts = vbMatch[1].trim().split(/\s+/).map(Number);
    if (parts.length >= 4) {
      viewBoxWidth = parts[2];
      viewBoxHeight = parts[3];
    }
  }

  // Extract inner SVG content (everything between <svg ...> and </svg>)
  const openTagEnd = svg.indexOf(">");
  const closeTagStart = svg.lastIndexOf("</svg>");
  let innerSvg = "";
  if (openTagEnd >= 0 && closeTagStart > openTagEnd) {
    innerSvg = svg.slice(openTagEnd + 1, closeTagStart).trim();
  }

  return { viewBoxWidth, viewBoxHeight, innerSvg };
}

/**
 * List element info from a loaded package.
 */
export function listElements(
  pkg: FurniturePackage,
): Array<{ id: string; meta: FurnitureElementMeta }> {
  return Array.from(pkg.elements.entries()).map(([id, el]) => ({
    id,
    meta: el.meta,
  }));
}

/**
 * Get the raw SVG content for an element.
 */
export function getElementSvg(
  pkg: FurniturePackage,
  elementId: string,
): string | null {
  return pkg.elements.get(elementId)?.svg ?? null;
}

/**
 * Resolve an element reference "packageName/elementId" across multiple packages.
 */
export function resolveElement(
  packages: FurniturePackage[],
  elementRef: string,
): FurnitureElement | null {
  const slashIdx = elementRef.indexOf("/");
  if (slashIdx < 0) return null;

  const pkgName = elementRef.slice(0, slashIdx);
  const elemId = elementRef.slice(slashIdx + 1);

  const pkg = packages.find((p) => p.name === pkgName);
  if (!pkg) return null;

  return pkg.elements.get(elemId) ?? null;
}
