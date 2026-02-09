import { Command } from "commander";
import { compile } from "./commands/compile.js";
import {
  furnitureList,
  furniturePackages,
  furnitureInit,
  furnitureCreate,
  furnitureImport,
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
    "Directory containing additional furniture packages (for element resolution fallback)",
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
  .option("-t, --tag <tag>", "Filter by tag (e.g. bedroom, kitchen)")
  .option("--packages-dir <dir>", "Directory containing additional packages")
  .action(
    (opts: { package?: string; tag?: string; packagesDir?: string }) => {
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
  .option("-t, --tags <list>", "Comma-separated tags (e.g. living,seating)", "custom")
  .option("-n, --name <name>", "Display name")
  .action(
    (
      packageDir: string,
      elementName: string,
      opts: { width?: string; depth?: string; tags?: string; name?: string },
    ) => {
      furnitureCreate(packageDir, elementName, opts);
    },
  );

furnitureCmd
  .command("import")
  .description("Import element definitions from packages into a .pcf file")
  .argument("<elements...>", 'Element references (e.g. "bed" or "default/bed")')
  .requiredOption("--to <file>", "Target .pcf file (created if missing)")
  .option("--packages-dir <dir>", "Directory containing additional packages")
  .action(
    (
      elements: string[],
      opts: { to: string; packagesDir?: string },
    ) => {
      furnitureImport(elements, opts);
    },
  );

furnitureCmd
  .command("add")
  .description("Add a furniture placement to a .pcf file (auto-imports element)")
  .argument("<element>", 'Element ID (e.g. "bed") or "package/element"')
  .requiredOption("--to <file>", "Target .pcf file (created if missing)")
  .requiredOption("--pos <x,y>", "Position as x,y coordinates in mm")
  .option("-w, --width <mm>", "Width scale percentage (default 100)")
  .option("-d, --depth <mm>", "Depth scale percentage (default 100)")
  .option("-r, --rotation <deg>", "Rotation in degrees")
  .option("--room <name>", "Optional room tag")
  .option("--packages-dir <dir>", "Directory containing additional packages")
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
        packagesDir?: string;
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
