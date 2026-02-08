# Furniture

## Overview

Furniture is managed separately from the structural plan. While the `.pc` file defines the building structure (walls, doors, windows), furniture placements are stored in a separate `.pcf` file.

## Furniture Elements

Furniture elements are SVG files organized into **packages**. Each package contains:
- A `manifest.json` with element metadata (name, category, default size)
- Individual `.svg` files for each element's plan-view symbol

### Available Packages

- **default** — Standard architectural furniture (bed, sofa, table, toilet, sink, etc.)
- **modern-living** — Contemporary living room pieces (sectional sofa, coffee table, TV console)
- **office** — Workspace furniture (executive desk, office chair, filing cabinet, conference table)

### Element Reference Format

Elements are referenced as `"package/element"`, for example:
- `"default/bed"` — Double bed from the default package
- `"default/sofa"` — 3-seat sofa
- `"office/executive_desk"` — Executive desk from the office package

## .pcf Placement File Format

The `.pcf` file is JSONC (JSON with comments) containing a `"placements"` array:

```jsonc
{
  "placements": [
    {
      "element": "default/bed",
      "position": {"x": 2000, "y": 1750},
      "width": 1400,
      "depth": 2000,
      "room": "Bedroom"
    },
    {
      "element": "default/desk",
      "position": {"x": 500, "y": 3000},
      "width": 1200,
      "depth": 600,
      "rotation": 90
    }
  ]
}
```

## Placement Fields

- **`element`** — Element reference in `"package/element"` format (required)
- **`position`** — `{"x": N, "y": N}` center point in drawing units (required)
- **`width`** — Width override in mm (optional, uses element default if omitted)
- **`depth`** — Depth override in mm (optional, uses element default if omitted)
- **`rotation`** — Rotation in degrees, default `0` (optional)
- **`room`** — Optional room name for organization (not validated against the .pc file)

## Default Package Elements

| Element ID | Name | Category | Default Size (W x D) |
|-----------|------|----------|----------------------|
| `default/bed` | Double Bed | bedroom | 1400 x 2000 |
| `default/sofa` | 3-Seat Sofa | living | 2000 x 900 |
| `default/l_sofa` | L-Shaped Sofa | living | 2400 x 2000 |
| `default/table` | Dining Table | living | 1200 x 800 |
| `default/round_table` | Round Table | living | 1000 x 1000 |
| `default/desk` | Desk | office | 1200 x 600 |
| `default/chair` | Chair | living | 450 x 450 |
| `default/counter` | Kitchen Counter | kitchen | 3000 x 600 |
| `default/toilet` | Toilet | bathroom | 400 x 700 |
| `default/sink` | Sink | bathroom | 500 x 400 |
| `default/shower` | Shower | bathroom | 900 x 900 |
| `default/bathtub` | Bathtub | bathroom | 700 x 1700 |
| `default/wardrobe` | Wardrobe | bedroom | 1000 x 500 |
| `default/fridge` | Fridge | kitchen | 700 x 700 |
| `default/stove` | Stove | kitchen | 600 x 600 |
| `default/oven` | Oven | kitchen | 600 x 600 |
| `default/car` | Car | garage | 1800 x 4200 |
| `default/staircase` | Straight Staircase | structural | 900 x 2500 |
| `default/spiral_staircase` | Spiral Staircase | structural | 1500 x 1500 |

## Placement Tips

- Position furniture using absolute coordinates (center of the piece)
- Use rotation to orient pieces (0 = default, 90 = rotated clockwise)
- Keep at least 600mm clearance between furniture and walls for walkways
- Align furniture against walls: place the center at `wall_position + depth/2`
- Group fixtures by function (kitchen appliances together, bathroom fixtures together)

## CLI Commands

```bash
# List available elements
plancraft furniture list

# Add a placement to a .pcf file
plancraft furniture add default/bed --to plan.pcf --pos 2000,1750

# Compile with furniture overlay
plancraft compile plan.pc --furniture plan.pcf -o plan.svg
```
