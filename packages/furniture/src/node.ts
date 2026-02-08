/**
 * Node.js-only entry point for @plancraft/furniture.
 *
 * Re-exports loader functions that depend on `node:fs` and `node:path`.
 * Import from "@plancraft/furniture/node" when you need these.
 *
 * Browser-safe exports (types, parseLayout, resolveElement, etc.)
 * are available from the main "@plancraft/furniture" entry point.
 */

export {
  loadPackage,
  loadBuiltinPackage,
  loadAllPackages,
  createElement,
  initPackage,
} from "./loader.js";
