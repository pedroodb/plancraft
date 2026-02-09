/**
 * Furniture package loader — reads packages from disk.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import type {
  FurnitureElement,
  FurnitureElementMeta,
  FurniturePackage,
  PackageManifest,
} from "./types.js";
import { parseSvg } from "./utils.js";

/**
 * Load a single furniture element from disk.
 */
function loadElement(
  dir: string,
  id: string,
  meta: FurnitureElementMeta,
): FurnitureElement {
  const svgPath = path.join(dir, `${id}.svg`);
  const svg = fs.readFileSync(svgPath, "utf-8");
  const { viewBoxWidth, viewBoxHeight, innerSvg } = parseSvg(svg);

  return {
    id,
    meta,
    svg,
    innerSvg,
    viewBoxWidth,
    viewBoxHeight,
  };
}

/**
 * Load a furniture package from a directory containing manifest.json + SVG files.
 */
export function loadPackage(dir: string): FurniturePackage {
  const manifestPath = path.join(dir, "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    throw new Error(`Furniture package manifest not found: ${manifestPath}`);
  }

  const raw = JSON.parse(fs.readFileSync(manifestPath, "utf-8")) as PackageManifest;
  const elements = new Map<string, FurnitureElement>();

  for (const [id, meta] of Object.entries(raw.elements)) {
    const svgPath = path.join(dir, `${id}.svg`);
    if (fs.existsSync(svgPath)) {
      elements.set(id, loadElement(dir, id, meta));
    }
  }

  return {
    name: raw.name,
    version: raw.version,
    description: raw.description,
    dir,
    elements,
  };
}

/**
 * Load all built-in packages that ship with @plancraft/furniture.
 * Scans the `elements/` directory for subdirectories with manifest.json files.
 */
export function loadBuiltinPackages(): FurniturePackage[] {
  const elementsDir = path.resolve(__dirname, "../elements");
  return loadAllPackages(elementsDir);
}

/**
 * Load the built-in default package that ships with @plancraft/furniture.
 */
export function loadBuiltinPackage(): FurniturePackage {
  const builtinDir = path.resolve(__dirname, "../elements/default");
  return loadPackage(builtinDir);
}

/**
 * Discover and load all packages from a directory that contains subdirectories,
 * each with a manifest.json.
 */
export function loadAllPackages(packagesDir: string): FurniturePackage[] {
  const packages: FurniturePackage[] = [];
  if (!fs.existsSync(packagesDir)) return packages;

  for (const entry of fs.readdirSync(packagesDir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      const subDir = path.join(packagesDir, entry.name);
      const manifestPath = path.join(subDir, "manifest.json");
      if (fs.existsSync(manifestPath)) {
        packages.push(loadPackage(subDir));
      }
    }
  }

  return packages;
}


/**
 * Create a new furniture element in a package directory.
 * Writes the SVG file and updates the manifest.
 */
export function createElement(
  packageDir: string,
  id: string,
  meta: FurnitureElementMeta,
  svgContent: string,
): void {
  // Write SVG file
  const svgPath = path.join(packageDir, `${id}.svg`);
  fs.writeFileSync(svgPath, svgContent, "utf-8");

  // Update manifest
  const manifestPath = path.join(packageDir, "manifest.json");
  let manifest: PackageManifest;

  if (fs.existsSync(manifestPath)) {
    manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
  } else {
    manifest = {
      name: path.basename(packageDir),
      version: "1.0.0",
      description: "",
      elements: {},
    };
  }

  manifest.elements[id] = meta;
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
}

/**
 * Initialize a new empty furniture package directory.
 */
export function initPackage(
  dir: string,
  name: string,
  description = "",
): void {
  fs.mkdirSync(dir, { recursive: true });

  const manifest: PackageManifest = {
    name,
    version: "1.0.0",
    description,
    elements: {},
  };

  fs.writeFileSync(
    path.join(dir, "manifest.json"),
    JSON.stringify(manifest, null, 2),
    "utf-8",
  );
}
