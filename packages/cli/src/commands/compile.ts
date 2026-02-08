import * as fs from "node:fs";
import * as path from "node:path";
import { parse, resolve } from "@plancraft/dsl";
import { buildSceneWithFurniture, emitSVG } from "@plancraft/renderer";
import type { Layer } from "@plancraft/renderer";
import { parseLayout } from "@plancraft/furniture";
import type { FurnitureLayout, FurniturePackage } from "@plancraft/furniture";
import {
  loadBuiltinPackage,
  loadPackage,
  loadAllPackages,
} from "@plancraft/furniture/node";

/** Predefined layer sets for common use cases */
const STRUCTURE_LAYERS: Layer[] = ["walls", "openings", "labels"];

export interface CompileOptions {
  output?: string;
  /** Comma-separated list of layers to include */
  layers?: string;
  /** Shorthand: only structural elements */
  structureOnly?: boolean;
  /** Path to a .pcf furniture layout file */
  furniture?: string;
  /** Path to a directory containing furniture packages */
  furniturePackages?: string;
}

export function compile(inputPath: string, options: CompileOptions): void {
  const absoluteInput = path.resolve(inputPath);

  if (!fs.existsSync(absoluteInput)) {
    console.error(`Error: File not found: ${absoluteInput}`);
    process.exit(1);
  }

  const source = fs.readFileSync(absoluteInput, "utf-8");

  // Parse
  let ast;
  try {
    ast = parse(source);
  } catch (err) {
    console.error(`Parse error: ${(err as Error).message}`);
    process.exit(1);
  }

  // Resolve
  let resolved;
  try {
    resolved = resolve(ast);
  } catch (err) {
    console.error(`Resolve error: ${(err as Error).message}`);
    process.exit(1);
  }

  // Load furniture if specified
  let layout: FurnitureLayout | undefined;
  let packages: FurniturePackage[] | undefined;

  if (options.furniture) {
    const pcfPath = path.resolve(options.furniture);
    if (!fs.existsSync(pcfPath)) {
      console.error(`Error: Furniture layout file not found: ${pcfPath}`);
      process.exit(1);
    }
    const pcfSource = fs.readFileSync(pcfPath, "utf-8");
    try {
      layout = parseLayout(pcfSource);
    } catch (err) {
      console.error(`Furniture layout parse error: ${(err as Error).message}`);
      process.exit(1);
    }

    // Load packages: built-in + any from --furniture-packages dir
    packages = [loadBuiltinPackage()];
    if (options.furniturePackages) {
      const pkgDir = path.resolve(options.furniturePackages);
      packages.push(...loadAllPackages(pkgDir));
    }
  }

  // Build scene graph (with or without furniture)
  const scene = buildSceneWithFurniture(resolved, layout, packages);

  // Resolve layer filter
  let layers: Layer[] | undefined;
  if (options.structureOnly) {
    layers = STRUCTURE_LAYERS;
  } else if (options.layers) {
    layers = options.layers.split(",").map((l) => l.trim()) as Layer[];
  }

  // Determine output path
  const outputPath = options.output
    ? path.resolve(options.output)
    : absoluteInput.replace(/\.pc$/, ".svg");

  const ext = path.extname(outputPath).toLowerCase();

  if (ext === ".svg") {
    const svg = emitSVG(scene, { scaleRatio: resolved.scale.ratio, layers });
    fs.writeFileSync(outputPath, svg, "utf-8");
    const layerInfo = layers ? ` (layers: ${layers.join(", ")})` : "";
    const furnitureInfo = layout
      ? ` (${layout.placements.length} furniture placements)`
      : "";
    console.log(`Written: ${outputPath}${layerInfo}${furnitureInfo}`);
  } else if (ext === ".pdf") {
    console.error("PDF output is not yet supported. Use .svg for now.");
    process.exit(1);
  } else {
    console.error(`Unknown output format: ${ext}. Supported: .svg`);
    process.exit(1);
  }
}
