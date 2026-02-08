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
