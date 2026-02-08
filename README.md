# Plancraft

An open, code-driven standard for architectural floor plans. Write `.pc` files in JSON, compile them to SVG with the CLI, and let AI agents generate plans from natural language.

Plancraft is to floor plans what Markdown is to documents: a simple, human-readable text format that compiles to a visual output. Plans are version-controllable, diffable, and machine-readable -- making them ideal for collaboration between humans and AI.

## Why Plancraft?

Architectural floor plans have traditionally been trapped in proprietary CAD software. Plancraft changes that:

- **Text-based** -- Floor plans are JSON files you can write in any editor, review in pull requests, and version with git.
- **AI-friendly** -- The structured format is straightforward for LLMs to generate, validate, and iterate on. A bundled skill teaches AI agents the conventions.
- **Precise** -- All coordinates are absolute and measurements are in real-world units (mm by default). The output matches AutoCAD-quality architectural conventions.
- **Composable** -- Structure (walls, doors, windows) and furniture are separate concerns. Furniture is organized in packs with reusable SVG elements.
- **Open** -- MIT licensed. Use it however you want.

## Table of Contents

- [Quick Start](#quick-start)
- [The .pc File Format](#the-pc-file-format)
  - [Project Root](#project-root)
  - [Rooms and Walls](#rooms-and-walls)
  - [Doors, Windows, and Openings](#doors-windows-and-openings)
  - [Shared Walls](#shared-walls)
  - [Dimensions and Labels](#dimensions-and-labels)
  - [Non-Rectangular Rooms](#non-rectangular-rooms)
  - [Comments](#comments)
- [The .pcf Furniture Format](#the-pcf-furniture-format)
- [CLI Reference](#cli-reference)
  - [Compile](#compile)
  - [Layer Filtering](#layer-filtering)
- [Furniture Packs](#furniture-packs)
  - [Included Packs](#included-packs)
  - [Creating Your Own Pack](#creating-your-own-pack)
- [AI Skill](#ai-skill)
  - [Two-Phase Workflow](#two-phase-workflow)
  - [Rule Files](#rule-files)
  - [Using the Skill](#using-the-skill)
- [Programmatic API](#programmatic-api)
- [Architecture](#architecture)
- [Coordinate System](#coordinate-system)
- [Examples](#examples)
- [Roadmap](#roadmap)
- [Contributing](#contributing)
- [License](#license)

---

## Quick Start

### Prerequisites

- Node.js 18+
- npm 9+

### Installation

```bash
git clone https://github.com/pedroodb/plancraft.git
cd plancraft
npm install
npm run build
```

### Create Your First Plan

Create a file called `my-room.pc`:

```jsonc
{
  "name": "My Room",
  "scale": 100,
  "unit": "mm",
  "floors": [
    {
      "name": "Ground Floor",
      "rooms": [
        {
          "name": "Living Room",
          "walls": [
            { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 5000, "y": 0}, "thickness": 200 },
            { "direction": "east",  "from": {"x": 5000, "y": 0}, "to": {"x": 5000, "y": 4000}, "thickness": 200 },
            { "direction": "south", "from": {"x": 5000, "y": 4000}, "to": {"x": 0, "y": 4000}, "thickness": 200 },
            { "direction": "west",  "from": {"x": 0, "y": 4000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
          ],
          "doors": [
            { "wall": "south", "offset": 2000, "width": 900, "swing": "left" }
          ],
          "windows": [
            { "wall": "east", "offset": 1000, "width": 1200, "height": 1400, "sill": 900 }
          ]
        }
      ],
      "labels": [
        { "text": "Living Room", "position": "center" }
      ]
    }
  ]
}
```

Compile to SVG:

```bash
npx plancraft compile my-room.pc -o my-room.svg
```

### Running Tests

```bash
npm test
```

---

## The `.pc` File Format

Plancraft uses JSONC (JSON with Comments) to define architectural floor plans. Files use the `.pc` extension. Both `//` line comments and `/* */` block comments are supported.

### Project Root

Every file is a JSON object with a project name, drawing scale, and unit system:

```jsonc
{
  "name": "My Home",
  "scale": 100,
  "unit": "mm",
  "floors": []
}
```

- **`name`** -- Project name (string, required).
- **`scale`** -- Drawing scale ratio. `100` means 1:100 (1 unit on paper = 100 units in reality). Affects stroke widths and dimension rendering. Default: `100`.
- **`unit`** -- Measurement unit for all coordinates and dimensions. Supported: `"mm"` (default), `"cm"`, `"m"`, `"ft"`, `"in"`.
- **`floors`** -- Array of floor objects.

### Rooms and Walls

Rooms are defined inside a floor's `rooms` array. Each room contains a `walls` array that forms a closed polygon:

```jsonc
{
  "name": "Ground Floor",
  "rooms": [
    {
      "name": "Living Room",
      "walls": [
        { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 6000, "y": 0}, "thickness": 200 },
        { "direction": "east",  "from": {"x": 6000, "y": 0}, "to": {"x": 6000, "y": 4000}, "thickness": 200 },
        { "direction": "south", "from": {"x": 6000, "y": 4000}, "to": {"x": 0, "y": 4000}, "thickness": 200 },
        { "direction": "west",  "from": {"x": 0, "y": 4000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
      ]
    }
  ]
}
```

**Wall fields:**

- **`direction`** -- A name for the wall. Can be a cardinal direction (`"north"`, `"south"`, `"east"`, `"west"`) or a custom string (`"east lower"`, `"north left"`).
- **`from` / `to`** -- Absolute coordinates of the wall's start and end points as `{"x": N, "y": N}`.
- **`thickness`** -- Wall thickness in drawing units. Typical values: 150 (interior), 200 (exterior).

Walls must form a closed polygon -- the last wall's `to` point must connect back to the first wall's `from` point.

### Doors, Windows, and Openings

Placed as arrays inside room objects, referencing walls by direction name:

```jsonc
{
  "name": "Living Room",
  "walls": [ /* ... */ ],
  "doors": [
    { "wall": "north", "offset": 1500, "width": 900, "swing": "left" }
  ],
  "windows": [
    { "wall": "east", "offset": 1000, "width": 1200, "height": 1400, "sill": 900 }
  ],
  "openings": [
    { "wall": "south", "offset": 2000, "width": 1200 }
  ]
}
```

**Door fields:**

- **`wall`** -- The wall direction name this door is on.
- **`offset`** -- Distance from the wall's `from` point to the start of the door opening.
- **`width`** -- Width of the door opening.
- **`swing`** -- `"left"` or `"right"` draws a quarter-circle arc. `"sliding"` draws parallel slide panels.
- Common widths: 600-700mm (interior), 800-900mm (exterior), 3000-4000mm (garage sliding).

**Window fields:**

- **`wall`** -- The wall direction name.
- **`offset`** / **`width`** -- Same as doors.
- **`height`** -- Window height (metadata, not rendered in plan view).
- **`sill`** -- Sill height above floor (typically 900mm).

**Opening fields** (wall gap with no door panel):

- **`wall`** / **`offset`** / **`width`** -- Same as doors.

### Shared Walls

When two rooms share a wall, use `sharedWalls` to reference an existing wall instead of defining duplicate geometry:

```jsonc
{
  "name": "Kitchen",
  "walls": [
    { "direction": "north", "from": {"x": 6000, "y": 0}, "to": {"x": 10000, "y": 0}, "thickness": 200 },
    { "direction": "east",  "from": {"x": 10000, "y": 0}, "to": {"x": 10000, "y": 4000}, "thickness": 200 },
    { "direction": "south", "from": {"x": 10000, "y": 4000}, "to": {"x": 6000, "y": 4000}, "thickness": 200 }
  ],
  "sharedWalls": [
    { "direction": "west", "sourceRoom": "Living Room", "sourceWall": "east" }
  ]
}
```

**Shared wall fields:**

- **`direction`** -- The wall direction name in this room.
- **`sourceRoom`** -- The room that originally defines the wall.
- **`sourceWall`** -- The wall direction name in the source room. Defaults to `direction` if omitted.

**Important:** Define rooms in dependency order. A room using `sharedWalls` must come after the room it references.

### Dimensions and Labels

Defined at the **floor level** (outside room objects):

```jsonc
{
  "name": "Ground Floor",
  "rooms": [ /* ... */ ],

  "dimensions": [
    { "wall": "north", "room": "Living Room", "offset": 500 }
  ],
  "dimchains": [
    { "wall": "south", "room": "Living Room", "offset": 800, "waypoints": [0, 1500, 2400, 6000] }
  ],
  "labels": [
    { "text": "Living Room", "position": "center" },
    { "text": "Storage", "position": {"x": 1500, "y": 3000} }
  ]
}
```

**Dimension fields:**
- **`wall`** / **`room`** -- Which wall to dimension.
- **`offset`** -- Distance from the wall to the dimension line.

**Dimension chain fields:**
- **`waypoints`** -- Array of distances from the wall's `from` point. Must start at `0` and end at the wall's total length.

**Label fields:**
- **`text`** -- The label text.
- **`position`** -- Either `"center"` (auto-places at the room's center; text must match a room name) or `{"x": N, "y": N}`.

### Non-Rectangular Rooms

For L-shaped, T-shaped, or complex shapes, use custom wall direction strings:

```jsonc
{
  "name": "L-Shaped Room",
  "walls": [
    { "direction": "south lower", "from": {"x": 0, "y": 0}, "to": {"x": 6000, "y": 0}, "thickness": 200 },
    { "direction": "east lower",  "from": {"x": 6000, "y": 0}, "to": {"x": 6000, "y": 3000}, "thickness": 200 },
    { "direction": "south upper", "from": {"x": 6000, "y": 3000}, "to": {"x": 10000, "y": 3000}, "thickness": 200 },
    { "direction": "east",        "from": {"x": 10000, "y": 3000}, "to": {"x": 10000, "y": 6000}, "thickness": 200 },
    { "direction": "north",       "from": {"x": 10000, "y": 6000}, "to": {"x": 0, "y": 6000}, "thickness": 200 },
    { "direction": "west",        "from": {"x": 0, "y": 6000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
  ]
}
```

### Comments

JSONC supports `//` line comments and `/* */` block comments:

```jsonc
{
  "name": "My Plan",
  // This is a line comment
  "scale": 100,
  /* Block comments work too */
  "unit": "mm",
  "floors": []
}
```

---

## The `.pcf` Furniture Format

Furniture placements are stored in separate `.pcf` files. This keeps the building structure (`.pc`) independent from interior layout (`.pcf`), allowing different furniture arrangements for the same structure.

```jsonc
{
  "placements": [
    {
      "element": "default/sofa",
      "position": {"x": 2500, "y": 2000},
      "room": "Living Room"
    },
    {
      "element": "default/bed",
      "position": {"x": 3000, "y": 5000},
      "width": 1600,
      "depth": 2000,
      "rotation": 90,
      "room": "Bedroom"
    }
  ]
}
```

**Placement fields:**

- **`element`** -- Element reference as `"package/element"` (e.g. `"default/bed"`, `"office/executive_desk"`).
- **`position`** -- Center position as `{"x": N, "y": N}` in absolute coordinates.
- **`room`** -- Room name (for grouping and validation).
- **`width`** / **`depth`** -- Optional size overrides (uses element defaults if omitted).
- **`rotation`** -- Optional rotation in degrees clockwise (default: `0`).

---

## CLI Reference

The `plancraft` CLI compiles `.pc` files to SVG.

### Compile

```bash
# Compile to SVG (output defaults to <input>.svg)
npx plancraft compile plan.pc

# Specify output path
npx plancraft compile plan.pc -o output.svg

# With furniture
npx plancraft compile plan.pc --furniture plan.pcf -o output.svg

# With custom furniture packages directory
npx plancraft compile plan.pc --furniture plan.pcf --furniture-packages ./my-packs -o output.svg
```

If installed globally via `npm install -g`:

```bash
plancraft compile plan.pc -o output.svg
```

### Layer Filtering

The renderer organizes elements into five layers, each with its own line weight:

| Layer | Elements | Line Weight |
|-------|----------|-------------|
| `walls` | Wall polygons with hatched fill | 0.50mm |
| `openings` | Doors (arcs, panels), windows (panes, frames) | 0.25mm |
| `furniture` | All furniture shapes | 0.18mm |
| `dimensions` | Dimension lines, tick marks, measurements | 0.13mm |
| `labels` | Room name text | 0.13mm |

Use layer filters to control what's rendered:

```bash
# Structure only -- walls, doors/windows, and labels (no furniture or dimensions)
npx plancraft compile plan.pc --structure-only -o structure.svg

# Custom layer selection
npx plancraft compile plan.pc --layers walls,openings,labels -o custom.svg
```

This supports a **two-phase workflow**: verify the building structure first (`--structure-only`), then add furniture and render the full plan.

---

## Furniture Packs

Furniture elements are individual SVG files organized into packs. Each pack is a directory with a `manifest.json` and one `.svg` file per element.

### Included Packs

**default** -- 19 standard architectural elements:

| Element | Category | Default Size (w x d) |
|---------|----------|---------------------|
| `bed` | bedroom | 1400 x 2000 |
| `sofa` | living | 2000 x 900 |
| `l_sofa` | living | 2400 x 2000 |
| `table` | living | 1200 x 800 |
| `round_table` | living | 1000 x 1000 |
| `desk` | office | 1200 x 600 |
| `chair` | living | 450 x 450 |
| `counter` | kitchen | 3000 x 600 |
| `toilet` | bathroom | 400 x 700 |
| `sink` | bathroom | 500 x 400 |
| `shower` | bathroom | 900 x 900 |
| `bathtub` | bathroom | 700 x 1700 |
| `wardrobe` | bedroom | 1000 x 500 |
| `fridge` | kitchen | 700 x 700 |
| `stove` | kitchen | 600 x 600 |
| `oven` | kitchen | 600 x 600 |
| `car` | garage | 1800 x 4200 |
| `staircase` | structural | 900 x 2500 |
| `spiral_staircase` | structural | 1500 x 1500 |

**modern-living** -- 5 contemporary living room pieces:

| Element | Default Size |
|---------|-------------|
| `sectional_sofa` | 3000 x 2200 |
| `coffee_table` | 1200 x 600 |
| `tv_console` | 1800 x 450 |
| `bookshelf` | 800 x 350 |
| `floor_lamp` | 300 x 300 |

**office** -- 5 workspace elements:

| Element | Default Size |
|---------|-------------|
| `executive_desk` | 1800 x 900 |
| `office_chair` | 550 x 550 |
| `filing_cabinet` | 400 x 600 |
| `conference_table` | 2400 x 1200 |
| `whiteboard` | 1800 x 100 |

### Creating Your Own Pack

A furniture pack is a directory with this structure:

```
my-pack/
├── manifest.json
├── element-a.svg
├── element-b.svg
└── ...
```

**manifest.json:**

```json
{
  "name": "my-pack",
  "version": "1.0.0",
  "description": "My custom furniture pack",
  "elements": {
    "element-a": {
      "name": "Display Name",
      "category": "living",
      "defaultWidth": 1200,
      "defaultDepth": 800
    },
    "element-b": {
      "name": "Another Element",
      "category": "kitchen",
      "defaultWidth": 600,
      "defaultDepth": 600
    }
  }
}
```

**SVG conventions:**

- The SVG `viewBox` should match the element's default dimensions: `viewBox="0 0 {width} {depth}"`.
- Use black strokes and light gray fills (`#e8e8e8`) for consistency with architectural conventions.
- Keep SVG simple -- plan-view symbols, not 3D renders. Think of how the element looks from directly above.
- Use `stroke-width="1"` -- the renderer scales strokes based on the drawing scale.

Example SVG for a simple element:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 800">
  <rect x="0" y="0" width="1200" height="800" fill="#e8e8e8" stroke="black" stroke-width="1"/>
  <!-- Add internal details as needed -->
</svg>
```

**Using your pack:**

```bash
plancraft compile plan.pc --furniture plan.pcf --furniture-packages ./path/to/packs -o output.svg
```

In the `.pcf` file, reference elements as `"my-pack/element-a"`.

**Contributing packs upstream:** We welcome new furniture packs. Add your pack directory under `packages/furniture/elements/`, ensure all SVGs follow the conventions above, and open a pull request.

---

## AI Skill

The `skill/plancraft/` directory contains a structured skill definition that enables AI coding agents (Cursor, Codex, Claude, etc.) to generate `.pc` files from natural language descriptions or reference images.

### Two-Phase Workflow

The skill organizes floor plan creation into two independent phases:

**Phase 1 -- Structure** (`rules/structure-guide.md`): Define the building skeleton first. All room boundaries, wall positions, door placements, window positions, and staircase locations must be correct before proceeding.

```bash
plancraft compile plan.pc --structure-only -o plan-structure.svg
```

**Phase 2 -- Furniture** (`rules/furniture-guide.md`): Once the structure is verified, add furniture and fixtures to each room.

```bash
plancraft compile plan.pc --furniture plan.pcf -o plan.svg
```

### Rule Files

The skill includes 14 rule files organized by topic:

**Phase 1 -- Structure:**

| File | Content |
|------|---------|
| `structure-guide.md` | Step-by-step structure workflow and self-review checklist |
| `walls.md` | Wall definitions, thickness conventions, polygon closure |
| `openings.md` | Doors, windows, openings, sliding doors, placement rules |
| `rooms.md` | Room blocks, shared walls, custom wall names, dependency order |
| `coordinates.md` | Coordinate system, units, absolute positioning |
| `measurement-extraction.md` | Extracting and verifying dimensions from reference images |
| `dimensions.md` | Dimension annotations and dimension chain syntax |
| `labels.md` | Room name labels and text placement |

**Phase 2 -- Furniture:**

| File | Content |
|------|---------|
| `furniture-guide.md` | Step-by-step furniture workflow and clearance rules |
| `furniture.md` | All furniture types, syntax, sizes, and placement tips |

**General:**

| File | Content |
|------|---------|
| `workflow.md` | End-to-end creation workflow covering both phases |
| `examples.md` | Complete example blueprints |
| `cli-usage.md` | CLI commands and layer filtering options |
| `layers.md` | Layer system, line weights, and visibility control |

### Using the Skill

Install the skill according to your AI agent's skill system -- the `SKILL.md` file is the entry point, and the `rules/` directory contains all referenced rule files.

When prompted to create a floor plan, the agent will:

1. Read the relevant rule files for the current phase.
2. Generate a `.pc` file following the JSON format and conventions.
3. Compile it using the CLI to verify the output.
4. Iterate based on feedback or reference images.

---

## Programmatic API

The packages can be used as libraries in your own TypeScript/JavaScript projects.

### Parsing and Resolving

```typescript
import { parse, resolve } from "@plancraft/dsl";

const source = `{
  "name": "Example",
  "scale": 100,
  "unit": "mm",
  "floors": [{ "name": "F1", "rooms": [] }]
}`;

// Parse JSONC source to raw AST
const ast = parse(source);

// Resolve semantic geometry (wall polygons, room areas, etc.)
const resolved = resolve(ast);

console.log(resolved.floors[0].rooms);
```

### Rendering to SVG

```typescript
import { parse, resolve } from "@plancraft/dsl";
import { buildSceneWithFurniture, emitSVG } from "@plancraft/renderer";

const source = "..."; // .pc file contents
const ast = parse(source);
const resolved = resolve(ast);

// Build scene graph
const scene = buildSceneWithFurniture(resolved);

// Emit SVG string
const svg = emitSVG(scene, {
  scaleRatio: resolved.scale.ratio,
  layers: ["walls", "openings", "labels"] // optional layer filter
});
```

### Loading Furniture

```typescript
import { parseLayout } from "@plancraft/furniture";
import { loadBuiltinPackage, loadPackage } from "@plancraft/furniture/node";
import { buildSceneWithFurniture, emitSVG } from "@plancraft/renderer";

// Parse a .pcf furniture layout
const layout = parseLayout(pcfSource);

// Load furniture packages
const builtinPack = loadBuiltinPackage();
const customPack = loadPackage("/path/to/my-pack");

// Build scene with furniture
const scene = buildSceneWithFurniture(resolved, layout, [builtinPack, customPack]);
const svg = emitSVG(scene, { scaleRatio: resolved.scale.ratio });
```

---

## Architecture

Plancraft is a TypeScript monorepo with four packages:

```
plancraft/
├── packages/
│   ├── dsl/          # JSON parser, validator, and semantic resolver
│   ├── furniture/    # Furniture element system with SVG packs
│   ├── renderer/     # Scene graph builder and SVG emitter
│   └── cli/          # Command-line interface
├── skill/            # AI agent skill (SKILL.md + rules/)
├── examples/         # Example .pc files and rendered SVGs
└── tests/            # Agent test suite
```

**Data flow:**

```
.pc source → [dsl] parse → raw AST → [dsl] resolve → resolved AST
                                                          ↓
.pcf source → [furniture] parseLayout → layout ──→ [renderer] buildScene → scene graph
                                                          ↓
furniture packs → [furniture] loadPackage ────────→ [renderer] emitSVG → SVG string
```

### `@plancraft/dsl`

- **Parser** -- Parses JSONC, validates structure, produces typed raw AST.
- **Resolver** -- Computes wall polygons, resolves shared walls, calculates room areas/centers, resolves opening positions.

### `@plancraft/furniture`

- **Loader** -- Loads furniture packs from disk (manifest.json + SVG files).
- **Layout parser** -- Parses `.pcf` placement files.
- **Element packs** -- Three included packs: default (19 elements), modern-living (5), office (5).

### `@plancraft/renderer`

- **Scene graph** -- Intermediate representation with typed nodes organized by layers.
- **Build scene** -- Transforms resolved AST to scene graph with furniture integration.
- **Geometry modules** -- Specialized generators for walls, doors, windows.
- **SVG emitter** -- Renders scene graph to SVG with architectural conventions (hatched fills, Y-axis flip, scale-aware strokes).

### `@plancraft/cli`

- **Compile command** -- Orchestrates the full pipeline: parse, resolve, build scene, emit SVG.
- **Furniture command** -- Manages furniture packages.
- **Layer filtering** -- `--structure-only`, `--layers` options.

---

## Coordinate System

- Origin `(0, 0)` is the **bottom-left** corner.
- **X-axis** runs left to right.
- **Y-axis** runs bottom to top (architectural convention).
- All measurements default to **millimeters**.
- The SVG renderer flips Y automatically so the output matches screen coordinates.

---

## Examples

The `examples/` directory contains sample floor plans:

| File | Description |
|------|-------------|
| `studio-apartment.pc` | Single room with one door, one window, dimensions, and a label |
| `two-bedroom.pc` | Two-room apartment with shared walls, doors, windows, and dimensions |
| `tolosa.pc` | Complex 11-room house with garage, staircase, multiple door/window types |
| `tolosa.pcf` | Furniture layout for the Tolosa house |

---

## Roadmap

- [x] CLI tool with layer filtering
- [x] AI skill for floor plan generation
- [x] Furniture pack system with SVG elements
- [ ] PNG output format
- [ ] PDF output format
- [ ] More furniture types (washing machine, dishwasher, etc.)
- [ ] Room area display in labels
- [ ] Multi-floor support with stair connections
- [ ] Import/export to common CAD formats
- [ ] Wall segment joint deduplication for cleaner T-junctions
- [ ] npm package publishing

---

## Contributing

Contributions are welcome. Here are some ways to help:

- **New furniture packs** -- Add a pack under `packages/furniture/elements/` with a `manifest.json` and SVG files following the [conventions above](#creating-your-own-pack).
- **Bug fixes** -- If you find an issue with parsing, rendering, or the CLI, open an issue or submit a fix.
- **Format improvements** -- Propose additions to the `.pc` format via issues for discussion.
- **Documentation** -- Improve skill rules, add examples, fix typos.

### Development Setup

```bash
git clone https://github.com/pedroodb/plancraft.git
cd plancraft
npm install
npm run build
npm test
```

---

## License

MIT
