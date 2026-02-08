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
  FurniturePlacement,
} from "@plancraft/furniture";
import {
  loadBuiltinPackage,
  loadPackage,
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

// ── Sub-commands ────────────────────────────────────────────────────

export function furnitureList(opts: { package?: string; packagesDir?: string }): void {
  const pkgs = getPackages(opts.packagesDir);

  for (const pkg of pkgs) {
    if (opts.package && pkg.name !== opts.package) continue;

    console.log(`\nPackage: ${pkg.name} (v${pkg.version})`);
    console.log(`  ${pkg.description}`);
    console.log(`  Elements:`);

    const elems = listElements(pkg);
    if (elems.length === 0) {
      console.log("    (none)");
    }
    for (const el of elems) {
      console.log(
        `    ${el.id} — ${el.meta.name} [${el.meta.category}] (${el.meta.defaultWidth}x${el.meta.defaultDepth}mm)`,
      );
    }
  }
}

export function furniturePackages(opts: { packagesDir?: string }): void {
  const pkgs = getPackages(opts.packagesDir);

  console.log(`\nAvailable packages (${pkgs.length}):\n`);
  for (const pkg of pkgs) {
    const count = pkg.elements.size;
    console.log(`  ${pkg.name} v${pkg.version} — ${count} element(s)`);
    console.log(`    ${pkg.description}`);
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
  opts: { width?: string; depth?: string; category?: string; name?: string },
): void {
  const dir = path.resolve(packageDir);
  if (!fs.existsSync(dir)) {
    console.error(`Error: Package directory not found: ${dir}`);
    process.exit(1);
  }

  const width = opts.width ? parseInt(opts.width, 10) : 600;
  const depth = opts.depth ? parseInt(opts.depth, 10) : 600;
  const category = opts.category || "custom";
  const displayName = opts.name || elementName.replace(/_/g, " ");

  const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${depth}">
  <rect x="0" y="0" width="${width}" height="${depth}" fill="#e8e8e8" stroke="black" stroke-width="1"/>
</svg>
`;

  createElement(dir, elementName, {
    name: displayName,
    category,
    defaultWidth: width,
    defaultDepth: depth,
  }, svgContent);

  console.log(`Created element "${elementName}" in ${dir}`);
  console.log(`  SVG: ${path.join(dir, `${elementName}.svg`)}`);
  console.log(`  Edit the SVG file to customize the plan-view symbol.`);
}

export function furnitureAdd(
  elementRef: string,
  opts: {
    to: string;
    pos: string;
    width?: string;
    depth?: string;
    rotation?: string;
    room?: string;
  },
): void {
  if (!elementRef.includes("/")) {
    console.error(
      `Error: Element reference must be in "package/element" format (got "${elementRef}")`,
    );
    process.exit(1);
  }

  const pcfPath = path.resolve(opts.to);

  // Parse position
  const posParts = opts.pos.split(",").map((s) => parseInt(s.trim(), 10));
  if (posParts.length !== 2 || posParts.some(isNaN)) {
    console.error(`Error: --pos must be "x,y" (got "${opts.pos}")`);
    process.exit(1);
  }

  // Load or create layout
  let layout: FurnitureLayout;
  if (fs.existsSync(pcfPath)) {
    const pcfSource = fs.readFileSync(pcfPath, "utf-8");
    layout = parseLayout(pcfSource);
  } else {
    layout = { placements: [] };
  }

  const placement: FurniturePlacement = {
    element: elementRef,
    position: { x: posParts[0], y: posParts[1] },
  };
  if (opts.width) placement.width = parseInt(opts.width, 10);
  if (opts.depth) placement.depth = parseInt(opts.depth, 10);
  if (opts.rotation) placement.rotation = parseInt(opts.rotation, 10);
  if (opts.room) placement.room = opts.room;

  layout.placements.push(placement);

  fs.writeFileSync(pcfPath, serializeLayout(layout), "utf-8");
  console.log(
    `Added ${elementRef} at (${posParts[0]}, ${posParts[1]}) to ${pcfPath}`,
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
