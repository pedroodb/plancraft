# CLI Usage

## Compile

Convert a `.pc` file to SVG:

```bash
plancraft compile plan.pc -o plan.svg
```

If `-o` is omitted, the output file name is derived from the input (e.g., `plan.pc` -> `plan.svg`).

## Compile Options

| Flag | Description |
|------|-------------|
| `-o, --output <path>` | Output file path |
| `--structure-only` | Render only structural elements (walls, openings, labels) |
| `--furniture <path>` | Path to a .pcf furniture layout file to overlay |
| `--furniture-packages <dir>` | Directory containing additional furniture packages |
| `--layers <list>` | Comma-separated list of layers to include |

## Layer Filtering

The `--structure-only` flag is a shortcut for rendering without furniture or dimensions. For fine-grained control, use `--layers`:

```bash
# Structure only (walls + door/window openings + room labels)
plancraft compile plan.pc --structure-only -o plan-structure.svg

# Full output with furniture overlay
plancraft compile plan.pc --furniture plan.pcf -o plan.svg

# Custom: walls and labels only (no doors/windows/furniture/dimensions)
plancraft compile plan.pc --layers walls,labels -o plan-walls.svg

# Custom: everything except dimensions
plancraft compile plan.pc --furniture plan.pcf --layers walls,openings,furniture,labels -o plan-nodim.svg
```

### Available Layers

| Layer | Contents |
|-------|----------|
| `walls` | Wall polygons with hatched fill |
| `openings` | Doors (arcs + lines) and windows (double lines + ticks) |
| `furniture` | Furniture SVG elements from .pcf placements |
| `dimensions` | Dimension lines, ticks, and measurement text |
| `labels` | Room name labels |

## Furniture Commands

Manage furniture elements and packages:

```bash
# List all available furniture elements
plancraft furniture list

# List elements from a specific package
plancraft furniture list --package default

# List available packages
plancraft furniture packages

# Initialize a new furniture package
plancraft furniture init my-custom-package

# Create a new element in a package
plancraft furniture create ./my-custom-package bookshelf --width 800 --depth 350 --category living

# Add a placement to a .pcf file
plancraft furniture add default/bed --to plan.pcf --pos 2000,1750 --room Bedroom

# Remove a placement by index
plancraft furniture remove 0 --from plan.pcf
```

## Future Commands

These commands are planned but not yet implemented:

- `plancraft watch plan.pc` — Watch mode with hot reload
- `plancraft serve plan.pc` — Dev server with live preview
- `plancraft compile plan.pc -o plan.pdf` — PDF output
