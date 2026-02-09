import * as fs from "node:fs";
import * as path from "node:path";
import {
  listElements,
  parseLayout,
  serializeLayout,
} from "@plancraft/furniture";
import type {
  FurniturePackage,
  FurnitureLayout,
  FurnitureElementDef,
  FurniturePlacement,
  FurnitureElement,
} from "@plancraft/furniture";
import {
  loadBuiltinPackage,
  loadAllPackages,
  createElement,
  initPackage,
} from "@plancraft/furniture/node";

// ── Helpers ──────────────────────────────────────────────────────────

function getPackages(packagesDir?: string): FurniturePackage[] {
  const pkgs: FurniturePackage[] = [loadBuiltinPackage()];
  if (packagesDir) {
    pkgs.push(...loadAllPackages(path.resolve(packagesDir)));
  }
  return pkgs;
}

/**
 * Find an element across all loaded packages.
 * Accepts plain ID ("bed") or "package/element" ("default/bed").
 */
function findElement(
  pkgs: FurniturePackage[],
  ref: string,
): { pkg: FurniturePackage; el: FurnitureElement } | null {
  // Try "package/element" format
  if (ref.includes("/")) {
    const [pkgName, elId] = ref.split("/", 2);
    const pkg = pkgs.find((p) => p.name === pkgName);
    if (pkg) {
      const el = pkg.elements.get(elId);
      if (el) return { pkg, el };
    }
    return null;
  }

  // Plain ID — search across all packages
  for (const pkg of pkgs) {
    const el = pkg.elements.get(ref);
    if (el) return { pkg, el };
  }
  return null;
}

/** Convert a FurnitureElement to a FurnitureElementDef for embedding in .pcf */
function toElementDef(el: FurnitureElement, sourcePkg: string): FurnitureElementDef {
  return {
    name: el.meta.name,
    tags: el.meta.tags,
    defaultWidth: el.meta.defaultWidth,
    defaultDepth: el.meta.defaultDepth,
    svg: el.svg,
    source: sourcePkg,
  };
}

/** Load or create an empty layout from a .pcf file path */
function loadOrCreateLayout(pcfPath: string): FurnitureLayout {
  if (fs.existsSync(pcfPath)) {
    return parseLayout(fs.readFileSync(pcfPath, "utf-8"));
  }
  return { elements: {}, placements: [] };
}

// ── Sub-commands ────────────────────────────────────────────────────

export function furnitureList(opts: { package?: string; tag?: string; packagesDir?: string }): void {
  const pkgs = getPackages(opts.packagesDir);

  for (const pkg of pkgs) {
    if (opts.package && pkg.name !== opts.package) continue;

    const elems = listElements(pkg).filter(
      (el) => !opts.tag || el.meta.tags.includes(opts.tag),
    );

    console.log(`\nPackage: ${pkg.name} (v${pkg.version})`);
    console.log(`  ${pkg.description}`);
    console.log(`  Elements${opts.tag ? ` (tag: ${opts.tag})` : ""}:`);

    if (elems.length === 0) {
      console.log("    (none)");
    }
    for (const el of elems) {
      const tags = el.meta.tags.join(", ");
      console.log(
        `    ${el.id} — ${el.meta.name} [${tags}] (${el.meta.defaultWidth}x${el.meta.defaultDepth}mm)`,
      );
    }
  }
}

export function furniturePackages(opts: { packagesDir?: string }): void {
  const pkgs = getPackages(opts.packagesDir);

  console.log(`\nAvailable packages (${pkgs.length}):\n`);
  for (const pkg of pkgs) {
    const count = pkg.elements.size;
    const allTags = new Set<string>();
    for (const [, el] of pkg.elements) {
      for (const t of el.meta.tags) allTags.add(t);
    }
    console.log(`  ${pkg.name} v${pkg.version} — ${count} element(s)`);
    console.log(`    ${pkg.description}`);
    console.log(`    Tags: ${[...allTags].sort().join(", ")}`);
  }
}

export function furnitureInit(
  packageName: string,
  opts: { dir?: string },
): void {
  const dir = opts.dir
    ? path.resolve(opts.dir, packageName)
    : path.resolve(packageName);

  if (fs.existsSync(dir)) {
    console.error(`Error: Directory already exists: ${dir}`);
    process.exit(1);
  }

  initPackage(dir, packageName, `Custom furniture package: ${packageName}`);
  console.log(`Initialized new furniture package at: ${dir}`);
  console.log(
    `  Add SVG elements with: plancraft furniture create ${packageName} <element-name>`,
  );
}

export function furnitureCreate(
  packageDir: string,
  elementName: string,
  opts: { width?: string; depth?: string; tags?: string; name?: string },
): void {
  const dir = path.resolve(packageDir);
  if (!fs.existsSync(dir)) {
    console.error(`Error: Package directory not found: ${dir}`);
    process.exit(1);
  }

  const width = opts.width ? parseInt(opts.width, 10) : 600;
  const depth = opts.depth ? parseInt(opts.depth, 10) : 600;
  const tags = opts.tags ? opts.tags.split(",").map((t) => t.trim()) : ["custom"];
  const displayName = opts.name || elementName.replace(/_/g, " ");

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${depth}">
  <rect x="0" y="0" width="${width}" height="${depth}" fill="#e8e8e8" stroke="black" stroke-width="1"/>
</svg>
`;

  createElement(dir, elementName, {
    name: displayName,
    tags,
    defaultWidth: width,
    defaultDepth: depth,
  }, svgContent);

  console.log(`Created element "${elementName}" in ${dir}`);
  console.log(`  SVG: ${path.join(dir, `${elementName}.svg`)}`);
  console.log(`  Edit the SVG file to customize the plan-view symbol.`);
}

/**
 * Import element definitions from packages into a .pcf file.
 * This embeds the full element definition (SVG, dimensions, metadata) so
 * the .pcf file becomes self-contained and portable.
 */
export function furnitureImport(
  elementRefs: string[],
  opts: {
    to: string;
    packagesDir?: string;
  },
): void {
  const pkgs = getPackages(opts.packagesDir);
  const pcfPath = path.resolve(opts.to);
  const layout = loadOrCreateLayout(pcfPath);

  if (!layout.elements) layout.elements = {};

  let imported = 0;
  for (const ref of elementRefs) {
    const found = findElement(pkgs, ref);
    if (!found) {
      console.error(`Warning: Element "${ref}" not found in any package, skipping.`);
      continue;
    }

    const id = found.el.id;
    if (layout.elements[id]) {
      console.log(`  Skipping "${id}" (already in layout)`);
      continue;
    }

    layout.elements[id] = toElementDef(found.el, found.pkg.name);
    console.log(`  Imported "${id}" from package "${found.pkg.name}"`);
    imported++;
  }

  fs.writeFileSync(pcfPath, serializeLayout(layout), "utf-8");
  console.log(`\nImported ${imported} element(s) into ${pcfPath}`);
  console.log(`  Total elements in layout: ${Object.keys(layout.elements).length}`);
}

/**
 * Add a furniture placement to a .pcf file.
 * Auto-imports the element definition from packages if not already present.
 */
export function furnitureAdd(
  elementRef: string,
  opts: {
    to: string;
    pos: string;
    width?: string;
    depth?: string;
    rotation?: string;
    room?: string;
    packagesDir?: string;
  },
): void {
  const pkgs = getPackages(opts.packagesDir);
  const pcfPath = path.resolve(opts.to);

  // Parse position
  const posParts = opts.pos.split(",").map((s) => parseInt(s.trim(), 10));
  if (posParts.length !== 2 || posParts.some(isNaN)) {
    console.error(`Error: --pos must be "x,y" (got "${opts.pos}")`);
    process.exit(1);
  }

  // Load or create layout
  const layout = loadOrCreateLayout(pcfPath);
  if (!layout.elements) layout.elements = {};

  // Resolve the element ID (strip package prefix if present)
  let elementId = elementRef;
  if (elementRef.includes("/")) {
    elementId = elementRef.split("/", 2)[1];
  }

  // Auto-import: if element not in layout, find it in packages and embed
  if (!layout.elements[elementId]) {
    const found = findElement(pkgs, elementRef);
    if (!found) {
      console.error(
        `Error: Element "${elementRef}" not found in any loaded package.\n` +
        `  Use --packages-dir to specify additional package directories, or\n` +
        `  use "plancraft furniture import" to manually import elements first.`,
      );
      process.exit(1);
    }
    layout.elements[elementId] = toElementDef(found.el, found.pkg.name);
    console.log(`  Auto-imported "${elementId}" from package "${found.pkg.name}"`);
  }

  const placement: FurniturePlacement = {
    element: elementId,
    position: { x: posParts[0], y: posParts[1] },
    scaleWidth: opts.width ? parseInt(opts.width, 10) : 100,
    scaleDepth: opts.depth ? parseInt(opts.depth, 10) : 100,
    lockProportions: true,
    rotation: opts.rotation ? parseInt(opts.rotation, 10) : 0,
  };
  if (opts.room) placement.room = opts.room;

  layout.placements.push(placement);

  fs.writeFileSync(pcfPath, serializeLayout(layout), "utf-8");
  console.log(
    `Added "${elementId}" at (${posParts[0]}, ${posParts[1]}) to ${pcfPath}`,
  );
  console.log(`  Total placements: ${layout.placements.length}`);
}

export function furnitureRemove(
  index: string,
  opts: { from: string },
): void {
  const pcfPath = path.resolve(opts.from);
  if (!fs.existsSync(pcfPath)) {
    console.error(`Error: File not found: ${pcfPath}`);
    process.exit(1);
  }

  const pcfSource = fs.readFileSync(pcfPath, "utf-8");
  const layout = parseLayout(pcfSource);
  const idx = parseInt(index, 10);

  if (isNaN(idx) || idx < 0 || idx >= layout.placements.length) {
    console.error(
      `Error: Index ${index} out of range (0-${layout.placements.length - 1})`,
    );
    process.exit(1);
  }

  const removed = layout.placements.splice(idx, 1)[0];
  fs.writeFileSync(pcfPath, serializeLayout(layout), "utf-8");
  console.log(
    `Removed placement #${idx} (${removed.element}) from ${pcfPath}`,
  );
  console.log(`  Remaining placements: ${layout.placements.length}`);
}
