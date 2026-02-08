---
name: plancraft
description: Create architectural floor plans and blueprints using the Plancraft JSON format. Use when users ask about floor plans, blueprints, room layouts, or architectural drawings.
metadata:
  tags: plancraft, floor plan, architecture, CAD, drawing, rooms, walls
---

# Plancraft — Architectural Floor Plan Generator

Plancraft is a code-driven tool for generating precise, AutoCAD-like architectural floor plans. You write `.pc` files using JSON (with comment support), then compile them to SVG. Furniture is managed separately in `.pcf` files.

## Two-Phase Workflow

Floor plan creation is split into two independent phases:

### Phase 1: Structure (walls, doors, windows, stairs)

Get the building skeleton right first. This is the critical phase — all room boundaries, door placements, window positions, and staircase locations must be accurate before proceeding.

**Guide**: `rules/structure-guide.md`

```bash
plancraft compile plan.pc --structure-only -o plan-structure.svg
```

### Phase 2: Furniture (interior layout)

Once the structure is verified, add furniture and fixtures to each room using the furniture placement system. Furniture placements are stored in a separate `.pcf` file.

**Guide**: `rules/furniture-guide.md`

```bash
plancraft compile plan.pc --furniture plan.pcf -o plan.svg
```

## Key Concepts

- **File format is JSONC** (JSON with `//` and `/* */` comments)
- **All measurements are in millimeters** by default (configurable with `"unit"`)
- **Coordinates are absolute** `{"x": N, "y": N}` positions
- **Walls are defined by start/end points** with explicit thickness
- **Wall direction names** can be cardinal directions (`"north"`, `"east"`, `"south"`, `"west"`) or custom strings (`"east lower"`)
- **Doors and windows reference walls** by direction name via `"wall"` field
- **Openings** create wall gaps without door panels
- **Sliding doors** use `"swing": "sliding"`
- **Furniture** is stored in a separate `.pcf` file, referencing SVG elements from packages
- **Shared walls** avoid duplicate geometry between adjacent rooms
- **Dimension chains** show segmented measurements along a wall
- **Structure**: project > floors[] > rooms[] > walls/doors/windows/openings

## Furniture System

Furniture elements are individual SVG files organized into packages:
- **default** — Standard furniture (bed, sofa, table, toilet, etc.)
- **modern-living** — Contemporary living room pieces
- **office** — Workspace furniture

Elements are referenced as `"package/element"` (e.g. `"default/bed"`). Placements specify position, optional size overrides, and rotation.

See `rules/furniture.md` for the complete element reference and `.pcf` format.

## Rules Reference

### Phase 1 — Structure

- `structure-guide.md` — **Start here**: step-by-step structure workflow and checklist
- `walls.md` — Wall definitions and thickness
- `openings.md` — Doors, windows, openings, and sliding doors
- `rooms.md` — Room objects, shared walls, and custom wall names
- `coordinates.md` — Coordinate system and units
- `measurement-extraction.md` — How to extract and verify dimensions from a reference image
- `dimensions.md` — Dimension annotations and dimension chains
- `labels.md` — Labels and text

### Phase 2 — Furniture

- `furniture-guide.md` — **Start here**: step-by-step furniture workflow and checklist
- `furniture.md` — Furniture elements, packages, .pcf format, and placement reference

### General

- `syntax-basics.md` — Overall file structure
- `workflow.md` — Combined step-by-step creation workflow (covers both phases)
- `examples.md` — Complete example blueprints
- `cli-usage.md` — CLI commands and layer filtering
- `layers.md` — Layer system, line weights, and visibility control

## Minimal Example

Structure (.pc file):
```jsonc
{
  "name": "Studio",
  "scale": 100,
  "unit": "mm",
  "floors": [
    {
      "name": "Ground Floor",
      "rooms": [
        {
          "name": "Main Room",
          "walls": [
            { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 5000, "y": 0}, "thickness": 200 },
            { "direction": "east",  "from": {"x": 5000, "y": 0}, "to": {"x": 5000, "y": 4000}, "thickness": 200 },
            { "direction": "south", "from": {"x": 5000, "y": 4000}, "to": {"x": 0, "y": 4000}, "thickness": 200 },
            { "direction": "west",  "from": {"x": 0, "y": 4000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
          ],
          "doors": [
            { "wall": "north", "offset": 1500, "width": 900, "swing": "left" }
          ],
          "windows": [
            { "wall": "east", "offset": 1000, "width": 1200, "height": 1400, "sill": 900 }
          ]
        }
      ],
      "dimensions": [
        { "wall": "north", "room": "Main Room", "offset": 500 }
      ],
      "labels": [
        { "text": "Main Room", "position": "center" }
      ]
    }
  ]
}
```

Furniture (.pcf file):
```jsonc
{
  "placements": [
    { "element": "default/sofa", "position": {"x": 2500, "y": 2000}, "room": "Main Room" }
  ]
}
```

## Limitations and Workarounds

Some architectural elements cannot be directly represented. When you encounter these, use the closest available approximation and add a comment in the JSON documenting what's missing.

| Element | Workaround |
|---------|-----------|
| Curved walls | Approximate with short straight wall segments using custom direction names (e.g., `"curve 1"`, `"curve 2"`) |
| Round columns / pillars | Not supported; add a `// NOTE: column at (x, y) diameter Nmm` comment |
| Fixtures not in element list | Use the closest element or create a custom SVG; add a `// NOTE:` comment describing the actual fixture |
| Multi-floor stair connections | Use `default/staircase` or `default/spiral_staircase` on each floor; floors are not linked |
| Room area labels | Labels show text only; to show area, compute it manually and include it in the label text at an explicit position |
| Balconies / outdoor spaces | Define as a room with thinner walls; add a `// NOTE: outdoor/balcony` comment |

**Always** document unsupported elements rather than silently omitting them. This lets users know what needs manual adjustment.
