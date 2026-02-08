import { Command } from "commander";
import { compile } from "./commands/compile.js";
import {
  furnitureList,
  furniturePackages,
  furnitureInit,
  furnitureCreate,
  furnitureAdd,
  furnitureRemove,
} from "./commands/furniture.js";

const program = new Command();

program
  .name("plancraft")
  .description("Code-driven architectural floor plan generator")
  .version("0.1.0");

// ── Compile command ──────────────────────────────────────────────────

program
  .command("compile")
  .description("Compile a .pc file to SVG")
  .argument("<input>", "Input .pc file")
  .option("-o, --output <path>", "Output file path (default: <input>.svg)")
  .option(
    "--layers <list>",
    "Comma-separated layers to include (walls,openings,furniture,dimensions,labels)",
  )
  .option(
    "--structure-only",
    "Show only structural elements (walls, openings, labels)",
  )
  .option(
    "--furniture <path>",
    "Path to a .pcf furniture layout file to overlay",
  )
  .option(
    "--furniture-packages <dir>",
    "Directory containing additional furniture packages",
  )
  .action(
    (
      input: string,
      opts: {
        output?: string;
        layers?: string;
        structureOnly?: boolean;
        furniture?: string;
        furniturePackages?: string;
      },
    ) => {
      compile(input, opts);
    },
  );

// ── Furniture command group ──────────────────────────────────────────

const furnitureCmd = program
  .command("furniture")
  .description("Manage furniture elements and packages");

furnitureCmd
  .command("list")
  .description("List available furniture elements")
  .option("-p, --package <name>", "Filter by package name")
  .option("--packages-dir <dir>", "Directory containing additional packages")
  .action(
    (opts: { package?: string; packagesDir?: string }) => {
      furnitureList(opts);
    },
  );

furnitureCmd
  .command("packages")
  .description("List available furniture packages")
  .option("--packages-dir <dir>", "Directory containing additional packages")
  .action((opts: { packagesDir?: string }) => {
    furniturePackages(opts);
  });

furnitureCmd
  .command("init")
  .description("Initialize a new empty furniture package")
  .argument("<name>", "Package name")
  .option("-d, --dir <path>", "Parent directory for the package")
  .action((name: string, opts: { dir?: string }) => {
    furnitureInit(name, opts);
  });

furnitureCmd
  .command("create")
  .description("Create a new furniture element SVG in a package")
  .argument("<package-dir>", "Path to the package directory")
  .argument("<element-name>", "Element ID (e.g. bookshelf)")
  .option("-w, --width <mm>", "Default width in mm", "600")
  .option("-d, --depth <mm>", "Default depth in mm", "600")
  .option("-c, --category <cat>", "Category (e.g. living, kitchen)", "custom")
  .option("-n, --name <name>", "Display name")
  .action(
    (
      packageDir: string,
      elementName: string,
      opts: { width?: string; depth?: string; category?: string; name?: string },
    ) => {
      furnitureCreate(packageDir, elementName, opts);
    },
  );

furnitureCmd
  .command("add")
  .description("Add a furniture placement to a .pcf file")
  .argument("<element>", 'Element reference (e.g. "default/bed")')
  .requiredOption("--to <file>", "Target .pcf file (created if missing)")
  .requiredOption("--pos <x,y>", "Position as x,y coordinates in mm")
  .option("-w, --width <mm>", "Width override in mm")
  .option("-d, --depth <mm>", "Depth override in mm")
  .option("-r, --rotation <deg>", "Rotation in degrees")
  .option("--room <name>", "Optional room tag")
  .action(
    (
      element: string,
      opts: {
        to: string;
        pos: string;
        width?: string;
        depth?: string;
        rotation?: string;
        room?: string;
      },
    ) => {
      furnitureAdd(element, opts);
    },
  );

furnitureCmd
  .command("remove")
  .description("Remove a furniture placement from a .pcf file by index")
  .argument("<index>", "Zero-based index of the placement to remove")
  .requiredOption("--from <file>", "Source .pcf file")
  .action((index: string, opts: { from: string }) => {
    furnitureRemove(index, opts);
  });

program.parse();
