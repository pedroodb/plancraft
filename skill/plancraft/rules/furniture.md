# Furniture

## Overview

Furniture is managed separately from the structural plan. While the `.pc` file defines the building structure (walls, doors, windows), furniture placements are stored in a separate `.pcf` file.

The `.pcf` file is **self-contained**: all element definitions (SVG, dimensions, metadata) are embedded in its `"elements"` section alongside the placements. This means the file has everything needed to render, with no external dependencies.

## Furniture Packages

Packages group elements by **visual style** (e.g. "default" = neutral schematic, a future "modern" package might use a different drawing style). Each element has **tags** that describe its use case, so you can filter elements by room type or function.

### Available Packages

- **default** — Standard architectural plan-view furniture symbols in a neutral schematic style. Contains all built-in elements (bedroom, living, kitchen, bathroom, office, structural).

Users can also upload custom packages with their own visual style and elements.

### Tags

Tags are the primary way to find and organize elements. Each element has one or more tags describing its use:

| Tag | Description |
|-----|-------------|
| `bedroom` | Bedroom furniture |
| `sleeping` | Beds and sleeping elements |
| `living` | Living room furniture |
| `seating` | Sofas, chairs, etc. |
| `dining` | Dining tables, chairs |
| `table` | Tables of any kind |
| `media` | TV, entertainment |
| `lighting` | Lamps, light fixtures |
| `storage` | Wardrobes, shelves, cabinets |
| `office` | Office/workspace furniture |
| `workspace` | Desks, work surfaces |
| `kitchen` | Kitchen elements |
| `surface` | Counters, work surfaces |
| `appliance` | Kitchen/household appliances |
| `bathroom` | Bathroom elements |
| `fixture` | Plumbing fixtures |
| `garage` | Garage elements |
| `vehicle` | Cars, vehicles |
| `structural` | Stairs, structural elements |
| `circulation` | Staircases, movement elements |
| `custom` | User-created elements |

### Element Reference Format

Elements are referenced by **plain IDs** (e.g. `"bed"`, `"sofa"`, `"standing_lamp"`). No package prefix is needed. The element's definition lives in the layout's `"elements"` section.

## .pcf Placement File Format

The `.pcf` file is JSONC (JSON with comments) containing element definitions and placements:

```jsonc
{
  "elements": {
    "bed": {
      "name": "Double Bed",
      "tags": ["bedroom", "sleeping"],
      "defaultWidth": 1400,
      "defaultDepth": 2000,
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 1400 2000\">...</svg>",
      "source": "default"
    },
    "standing_lamp": {
      "name": "Standing Lamp",
      "tags": ["living", "lighting"],
      "defaultWidth": 300,
      "defaultDepth": 300,
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 300 300\"><circle cx=\"150\" cy=\"150\" r=\"130\" fill=\"#e8e8e8\" stroke=\"black\" stroke-width=\"5\"/><circle cx=\"150\" cy=\"150\" r=\"20\" fill=\"#a0a0a0\" stroke=\"black\" stroke-width=\"3\"/></svg>",
      "source": "generated"
    }
  },
  "placements": [
    {
      "element": "bed",
      "position": {"x": 2000, "y": 1750},
      "scaleWidth": 100,
      "scaleDepth": 100,
      "lockProportions": true,
      "rotation": 0,
      "room": "Bedroom"
    },
    {
      "element": "standing_lamp",
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

## Element Definitions

The `"elements"` key contains all element definitions used by this layout. Each key is the element ID:

- **`name`** — Human-readable display name
- **`tags`** — Array of tags for grouping and filtering (e.g. `["bedroom", "sleeping"]`)
- **`defaultWidth`** — Default width in mm
- **`defaultDepth`** — Default depth in mm
- **`svg`** — Full SVG content including the `<svg>` root element
- **`source`** — Optional: which package this was imported from (e.g. "default", "generated")

## Placement Fields

- **`element`** — Element ID (key into the `"elements"` map) (required)
- **`position`** — `{"x": N, "y": N}` center point in mm. Required unless using `anchor` or `relativePosition`.
- **`anchor`** — Wall-anchored positioning (optional, use instead of `position`):
  - `wall`: compass side ("north", "south", "east", "west") or wall direction name
  - `along`: 0-1 position along the wall (0 = start, 0.5 = center, 1 = end)
  - `offset`: mm from wall inner face (0 = flush, default 0). System auto-adds wall_thickness/2 + furniture_depth/2.
- **`relativePosition`** — `{"x": N, "y": N}` where 0-1 is percentage within room inner bounding box (optional, use instead of `position`)
- **`scaleWidth`** — Width as percentage of original size, default `100` (optional)
- **`scaleDepth`** — Depth as percentage of original size, default `100` (optional)
- **`lockProportions`** — When `true`, width and depth scale together, default `true` (optional)
- **`rotation`** — Rotation in degrees, default `0` (optional)
- **`room`** — Room name. **Required for `anchor` and `relativePosition`.** Enables spatial validation.

### Scale Examples

- `scaleWidth: 100, scaleDepth: 100` — Default size (100%)
- `scaleWidth: 150, scaleDepth: 150` — 50% larger
- `scaleWidth: 75, scaleDepth: 75` — 25% smaller
- `scaleWidth: 120, scaleDepth: 80, lockProportions: false` — Wider but shallower

### SVG Creation Guidelines

When creating element SVGs:
- Use `viewBox="0 0 {defaultWidth} {defaultDepth}"` matching the dimensions
- Use black strokes (`stroke="black"`) and light gray fills (`fill="#e8e8e8"`)
- Keep it simple — plan-view (top-down) architectural symbols
- Use `stroke-width` proportional to the element size (1-8 range)
- The SVG should be recognizable as the object from a bird's-eye view
- Avoid complex gradients or effects — flat, schematic style

## Default Package Elements

| Element ID | Name | Tags | Default Size (W x D) |
|-----------|------|------|----------------------|
| `bed` | Double Bed | bedroom, sleeping | 1400 x 2000 |
| `wardrobe` | Wardrobe | bedroom, storage | 1000 x 500 |
| `sofa` | 3-Seat Sofa | living, seating | 2000 x 900 |
| `l_sofa` | L-Shaped Sofa | living, seating | 2400 x 2000 |
| `sectional_sofa` | Sectional Sofa | living, seating | 3000 x 2200 |
| `chair` | Chair | seating, dining, living | 450 x 450 |
| `table` | Dining Table | dining, living | 1200 x 800 |
| `round_table` | Round Table | dining, living | 1000 x 1000 |
| `coffee_table` | Coffee Table | living, table | 1200 x 600 |
| `tv_console` | TV Console | living, media | 1800 x 450 |
| `bookshelf` | Bookshelf | living, storage | 800 x 350 |
| `floor_lamp` | Floor Lamp | living, lighting | 300 x 300 |
| `desk` | Desk | office, workspace | 1200 x 600 |
| `executive_desk` | Executive Desk | office, workspace | 1800 x 900 |
| `office_chair` | Office Chair | office, seating | 550 x 550 |
| `filing_cabinet` | Filing Cabinet | office, storage | 400 x 600 |
| `conference_table` | Conference Table | office, table | 2400 x 1200 |
| `whiteboard` | Whiteboard | office | 1800 x 100 |
| `counter` | Kitchen Counter | kitchen, surface | 3000 x 600 |
| `fridge` | Fridge | kitchen, appliance | 700 x 700 |
| `stove` | Stove | kitchen, appliance | 600 x 600 |
| `oven` | Oven | kitchen, appliance | 600 x 600 |
| `toilet` | Toilet | bathroom, fixture | 400 x 700 |
| `sink` | Sink | bathroom, fixture | 500 x 400 |
| `shower` | Shower | bathroom, fixture | 900 x 900 |
| `bathtub` | Bathtub | bathroom, fixture | 700 x 1700 |
| `car` | Car | garage, vehicle | 1800 x 4200 |
| `staircase` | Straight Staircase | structural, circulation | 900 x 2500 |
| `spiral_staircase` | Spiral Staircase | structural, circulation | 1500 x 1500 |

## Positioning Methods

Three ways to position furniture:

1. **Absolute position**: `"position": {"x": 2100, "y": 1100}` — direct mm coordinates
2. **Wall anchor**: `"anchor": {"wall": "south", "along": 0.5, "offset": 0}` — auto-aligned to wall (recommended for wall-adjacent items)
3. **Room-relative**: `"relativePosition": {"x": 0.5, "y": 0.5}` — percentage within room (recommended for center-of-room items)

Anchor and relativePosition require the `"room"` field. The system auto-resolves them to absolute coordinates.

## Placement Tips

- **ALWAYS call `get_room_geometry` first** to get exact room bounds and wall positions
- **Prefer anchor** for wall-aligned items (beds, wardrobes, counters, toilets) — it auto-handles wall thickness offset
- **Prefer relativePosition** for center-of-room items (coffee tables, dining tables)
- Position furniture using absolute coordinates (center of the piece), computed from room geometry
- Use rotation to orient pieces (0 = default, 90 = rotated clockwise). **Rotation swaps effective width/depth.**
- Keep at least 600mm clearance between furniture and walls for walkways
- For wall-aligned furniture: `center = wall_inner_edge + furniture_depth / 2`
- Use `innerBoundingBox` from room geometry to ensure furniture stays inside the room
- **Check the warnings** returned by add_furniture_placement and replace_furniture_layout — fix overlaps immediately
- Always set the `room` field on placements to enable spatial validation
- Group fixtures by function (kitchen appliances together, bathroom fixtures together)
- Use `scaleWidth`/`scaleDepth` to resize (percentage-based) rather than fixed dimensions
- Use list_furniture_packages and browse_package (with tag filter) to discover available elements
- Elements are auto-imported when placed — the layout file stays self-contained
