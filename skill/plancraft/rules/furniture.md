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
- **custom** — AI-created elements embedded in the layout (created via `create_furniture_element`)

### Element Reference Format

Elements are referenced as `"package/element"`, for example:
- `"default/bed"` — Double bed from the default package
- `"default/sofa"` — 3-seat sofa
- `"office/executive_desk"` — Executive desk from the office package
- `"custom/standing_lamp"` — Custom element created by the AI

## .pcf Placement File Format

The `.pcf` file is JSONC (JSON with comments) containing placements and optionally custom element definitions:

```jsonc
{
  "customElements": {
    "standing_lamp": {
      "name": "Standing Lamp",
      "category": "living",
      "defaultWidth": 300,
      "defaultDepth": 300,
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 300\"><circle cx=\"150\" cy=\"150\" r=\"130\" fill=\"#e8e8e8\" stroke=\"black\" stroke-width=\"5\"/><circle cx=\"150\" cy=\"150\" r=\"20\" fill=\"#a0a0a0\" stroke=\"black\" stroke-width=\"3\"/></svg>"
    }
  },
  "placements": [
    {
      "element": "default/bed",
      "position": {"x": 2000, "y": 1750},
      "scaleWidth": 100,
      "scaleDepth": 100,
      "lockProportions": true,
      "rotation": 0,
      "room": "Bedroom"
    },
    {
      "element": "custom/standing_lamp",
      "position": {"x": 500, "y": 3000},
      "scaleWidth": 80,
      "scaleDepth": 80,
      "lockProportions": true,
      "rotation": 0,
      "room": "Living Room"
    }
  ]
}
```

## Placement Fields

- **`element`** — Element reference in `"package/element"` format (required)
- **`position`** — `{"x": N, "y": N}` center point in drawing units (required)
- **`scaleWidth`** — Width as percentage of original size, default `100` (optional)
- **`scaleDepth`** — Depth as percentage of original size, default `100` (optional)
- **`lockProportions`** — When `true`, width and depth scale together, default `true` (optional)
- **`rotation`** — Rotation in degrees, default `0` (optional)
- **`room`** — Optional room name for organization (not validated against the .pc file)

### Scale Examples

- `scaleWidth: 100, scaleDepth: 100` — Default size (100%)
- `scaleWidth: 150, scaleDepth: 150` — 50% larger
- `scaleWidth: 75, scaleDepth: 75` — 25% smaller
- `scaleWidth: 120, scaleDepth: 80, lockProportions: false` — Wider but shallower

## Custom Elements Section

The `"customElements"` key is an optional object at the root of the `.pcf` file. Each key is the element ID, and the value contains:

- **`name`** — Human-readable display name
- **`category`** — Category for UI grouping (bedroom, living, kitchen, bathroom, office, custom)
- **`defaultWidth`** — Default width in mm
- **`defaultDepth`** — Default depth in mm
- **`svg`** — Full SVG content including the `<svg>` root element

Custom elements are referenced with the `"custom/"` prefix: `"custom/my_element"`.

### SVG Creation Guidelines

When creating custom element SVGs:
- Use `viewBox="0 0 {defaultWidth} {defaultDepth}"` matching the dimensions
- Use black strokes (`stroke="black"`) and light gray fills (`fill="#e8e8e8"`)
- Keep it simple — plan-view (top-down) architectural symbols
- Use `stroke-width` proportional to the element size (1-8 range)
- The SVG should be recognizable as the object from a bird's-eye view
- Avoid complex gradients or effects — flat, schematic style

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

## Modern Living Package Elements

| Element ID | Name | Category | Default Size (W x D) |
|-----------|------|----------|----------------------|
| `modern-living/sectional_sofa` | Sectional Sofa | living | 3000 x 2200 |
| `modern-living/coffee_table` | Coffee Table | living | 1200 x 600 |
| `modern-living/tv_console` | TV Console | living | 1800 x 450 |
| `modern-living/bookshelf` | Bookshelf | living | 800 x 350 |
| `modern-living/floor_lamp` | Floor Lamp | living | 300 x 300 |

## Office Package Elements

| Element ID | Name | Category | Default Size (W x D) |
|-----------|------|----------|----------------------|
| `office/executive_desk` | Executive Desk | office | 1800 x 900 |
| `office/office_chair` | Office Chair | office | 550 x 550 |
| `office/filing_cabinet` | Filing Cabinet | office | 400 x 600 |
| `office/conference_table` | Conference Table | office | 2400 x 1200 |
| `office/whiteboard` | Whiteboard | office | 1800 x 100 |

## Placement Tips

- Position furniture using absolute coordinates (center of the piece)
- Use rotation to orient pieces (0 = default, 90 = rotated clockwise)
- Keep at least 600mm clearance between furniture and walls for walkways
- Align furniture against walls: place the center at `wall_position + depth/2`
- Group fixtures by function (kitchen appliances together, bathroom fixtures together)
- Use `scaleWidth`/`scaleDepth` to resize (percentage-based) rather than fixed dimensions
- If an element doesn't exist in the built-in packages, create it with `create_furniture_element`
