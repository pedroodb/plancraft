# Furniture Guide — Interior Layout and Fixtures

This guide covers **Phase 2** of floor plan creation: adding furniture and fixtures after the building structure is verified.

## Prerequisites

Before adding furniture, you should have a **verified structure** (see `structure-guide.md`). The structure should compile cleanly with `--structure-only` and match the reference layout.

## Goal

Add interior furnishings to each room using the furniture placement system:
- Sofas, tables, chairs, desks
- Kitchen fixtures (counter, stove, fridge, sink)
- Bathroom fixtures (toilet, sink, shower, bathtub)
- Bedroom fixtures (bed, wardrobe)
- Cars in garages
- Staircases
- Custom elements for anything not in the built-in packages

## How Furniture Works

Furniture is stored in a **separate `.pcf` file**, not inside the `.pc` structure file. This keeps the structural plan clean and allows furniture to be managed independently.

### AI Tool Workflow

When working in the web app, use the furniture tools:

1. **`list_furniture_elements`** — See all available elements from packages (including custom)
2. **`get_furniture_layout`** — Read the current furniture placements
3. **`create_furniture_element`** — Create a custom SVG element on the fly
4. **`add_furniture_placement`** — Add a furniture item to the layout
5. **`remove_furniture_placement`** — Remove a placement by index
6. **`replace_furniture_layout`** — Replace the entire furniture layout

### Creating Custom Elements

If the furniture you need doesn't exist in the built-in packages, create it:

```
create_furniture_element({
  id: "plant_pot",
  name: "Plant Pot",
  category: "living",
  defaultWidth: 400,
  defaultDepth: 400,
  svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><circle cx="200" cy="200" r="180" fill="#e8e8e8" stroke="black" stroke-width="5"/><circle cx="200" cy="200" r="120" fill="#d0d0d0" stroke="black" stroke-width="3"/></svg>'
})
```

Then place it with: `add_furniture_placement({ element: "custom/plant_pot", position: {x: 1000, y: 2000} })`

**SVG guidelines:**
- `viewBox` must match `"0 0 {defaultWidth} {defaultDepth}"`
- Use plan-view (top-down, bird's-eye) perspective
- Use black strokes and `#e8e8e8` fills
- Keep SVG simple and schematic (no gradients, shadows, or complex effects)
- Use `stroke-width` proportional to element size (1-8)

## Step-by-Step Furniture Workflow

### 1. Inventory Furniture Per Room

For each room, list what furniture should be placed:
- Reference the source image/plan for furniture types and approximate positions
- Note any furniture not in built-in packages — create custom elements for these

### 2. Get Room Geometry (CRITICAL — DO THIS FIRST)

**ALWAYS call `get_room_geometry` before placing any furniture.** This tool returns per-room spatial data including bounding boxes, wall positions, and compass labels. Use this data to compute exact furniture positions instead of guessing.

The tool returns:
- **`boundingBox`** — The room's overall bounding box (wall centerlines)
- **`innerBoundingBox`** — The usable interior space (inset by wall thickness). **Use this for furniture placement.**
- **`center`** — Room geometric center
- **`walls`** — Each wall with `from`, `to`, `thickness`, `direction`, `side` (compass label: "north"/"south"/"east"/"west"), and `length`

### 3. Place Furniture Room by Room

Use `add_furniture_placement` or `replace_furniture_layout` to add items.

**Position is the CENTER of the furniture piece in absolute mm coordinates.** Always compute positions from the room geometry data.

#### How to compute wall-aligned positions

To place furniture flush against a wall, use:

```
position = wall_inner_edge + furniture_depth / 2
```

**Worked example — bed against the south wall of a Bedroom:**
- Room `innerBoundingBox`: `{minX: 100, minY: 100, maxX: 4100, maxY: 3600}`
- Bed default size: 1400mm wide x 2000mm deep
- South wall inner edge is at `minY = 100`
- Bed center Y = `100 + 2000/2 = 1100`
- Center X at room center = `(100 + 4100) / 2 = 2100`
- Result: `at 2100,1100`

**Worked example — wardrobe against the east wall:**
- East wall inner edge is at `maxX = 4100`
- Wardrobe: 1000mm wide x 500mm deep, rotated 90 degrees
- After rotation: effective width = 500mm, effective depth = 1000mm
- Wardrobe center X = `4100 - 500/2 = 3850`
- Result: `at 3850,1850` with `rotation=90`

**Worked example — toilet against the north wall:**
- North wall inner edge is at `maxY = 3600`
- Toilet: 400mm wide x 700mm deep
- Toilet center Y = `3600 - 700/2 = 3250`
- Place near the left side: center X = `100 + 400/2 + 200 = 500` (200mm from left wall)
- Result: `at 500,3250`

#### Positioning Methods

You have **three ways** to position furniture:

**Method 1: Absolute position (traditional)** — Compute exact mm coordinates from room geometry:
```
place default/bed at 2100,1100 in Bedroom
```

**Method 2: Wall anchor (recommended for wall-aligned items)** — Automatically computes position from wall geometry. The system adds wall_thickness/2 + furniture_depth/2 for you:
```
place default/bed anchor south 0.5 0 in Bedroom
// wall=south, along=0.5 (centered), offset=0 (flush)
```

**Method 3: Room-relative percentage (good for center-of-room items):**
```
place default/coffee_table rel 0.5,0.5 in "Living Room"
// centered in room
```

**When to use each:**
- **Anchor**: Beds, wardrobes, counters, toilets, sinks — anything that goes against a wall
- **Rel**: Coffee tables, dining tables, rugs — items in the middle of a room
- **Absolute position**: Items outside rooms, or when you need precise control

#### Placement format

```
furniture:

placements:
  place default/bed anchor south 0.5 0 in Bedroom
  place default/wardrobe anchor east 0.3 0 in Bedroom rotation=90
  place default/coffee_table rel 0.5,0.5 in "Living Room"
  place default/desk at 3850,500 in Bedroom scale=120 rotation=90
```

- **`at x,y`** — **center point** in absolute mm. Required unless using anchor or rel.
- **`anchor <wall> <along> <offset>`** — Wall-anchored positioning. System auto-calculates absolute position.
- **`rel x,y`** — 0-1 percentage within room inner bounding box.
- **`scale=N`** — percentage of original size (100 = default). Use `scale=W,D` for independent width/depth.
- **`rotation=N`** — degrees (0 = default, 90 = clockwise). **Rotation swaps effective width/depth.**
- **`in <room>`** — Room name. **Required for anchor/rel.** Enables spatial validation.

### 3. Common Furniture Sizes (mm)

| Element | Default Size (W x D) |
|---------|---------------------|
| default/bed (single, use scale=65) | ~900 x 2000 |
| default/bed (double) | 1400 x 2000 |
| default/sofa | 2000 x 900 |
| default/l_sofa | 2400 x 2000 |
| default/table | 1200 x 800 |
| default/round_table | 1000 x 1000 |
| default/desk | 1200 x 600 |
| default/chair | 450 x 450 |
| default/toilet | 400 x 700 |
| default/sink | 500 x 400 |
| default/bathtub | 700 x 1700 |
| default/shower | 900 x 900 |
| default/counter | 3000 x 600 |
| default/fridge | 700 x 700 |
| default/stove / oven | 600 x 600 |
| default/wardrobe | 1000 x 500 |
| default/car | 1800 x 4200 |
| default/staircase | 900 x 2500 |
| default/spiral_staircase | 1500 x 1500 |

### 5. Placement Tips

- **ALWAYS use `get_room_geometry` first**: Never guess positions. Read the room bounds and compute from them.
- **Check warnings**: `add_furniture_placement` and `replace_furniture_layout` return spatial warnings. If you see overlap or out-of-room warnings, fix positions immediately.
- **Keep clearance**: Leave at least 300mm between any two furniture items. Leave 600mm for walkways.
- **Door clearance**: Keep 800mm+ clearance from door swing arcs. Never place furniture in front of a door.
- **Align to walls**: Furniture against walls looks natural — place the center at `wall_inner_edge + depth/2`
- **Check wall length**: Before anchoring an item to a wall, verify the item's width fits within the wall's length. A 2000mm sofa does NOT fit on a 1500mm wall.
- **Remember rotation swaps dimensions**: A 1000x500 wardrobe at rotation=90 has effective dimensions 500x1000
- **Group by function**: Kitchen appliances along the counter wall, bathroom fixtures along the plumbing wall
- **Use rotation**: Orient beds with headboard against wall (rotation 0 = head at top)
- **Scale check**: Ensure furniture fits within the room boundaries using `innerBoundingBox`
- **Use scale for sizing**: Use `scale` percentages rather than guessing mm sizes
- **Create custom elements**: If a piece doesn't exist in built-in packages, create it with `create_furniture_element`
- **Set the room field**: Always set the room name when placing furniture — this enables spatial validation

### Common Mistakes to Avoid

- **Coffee table at room center**: Do NOT place the coffee table at `rel 0.5,0.5` — it will likely overlap the sofa. Place it 600-800mm in front of the sofa instead.
- **Bathroom fixtures near doors**: Do NOT place toilet or sink on walls with doors or within the door swing arc. Check door positions first.
- **Oversized items on short walls**: Do NOT anchor a 3000mm counter to a 2500mm wall — it will extend past the wall. Scale down or pick a longer wall.
- **Too many items in small rooms**: Rooms under 4m² should have at most 2 items. A clean layout with fewer items is ALWAYS better than a cluttered layout with overlaps.
- **Ignoring spatial warnings**: ALWAYS fix spatial alerts before adding more items. Overlapping furniture is never acceptable.

### 6. Furniture Self-Review Checklist

- [ ] Called `get_room_geometry` before placing furniture
- [ ] Every room has its expected furniture
- [ ] No furniture extends beyond room boundaries (check tool warnings)
- [ ] No furniture overlaps with walls (check tool warnings)
- [ ] No furniture overlaps with other furniture (check tool warnings)
- [ ] Clearance between furniture pieces is reasonable (>= 600mm for walkways)
- [ ] Furniture positions match the reference image layout
- [ ] Cars fit within garage with door clearance
- [ ] Missing furniture types created as custom elements
- [ ] Unsupported fixtures are documented with comments

## Related Rules

- `furniture.md` — Furniture element reference, .pcf format, and all available elements
- `structure-guide.md` — Phase 1: getting the structure right first
