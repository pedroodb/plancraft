# Structure Guide — Walls, Doors, Windows, Stairs

This guide covers **Phase 1** of floor plan creation: getting the building structure right before adding any furniture.

## Goal

Produce a structurally accurate floor plan with:
- Correct room boundaries (walls)
- Accurate door placements and swing directions
- Correct window positions and sizes
- Staircase positions (structural furniture only)

**Do NOT add furniture (other than stairs) in Phase 1.** Furniture comes in Phase 2 after structure is verified.

## Compile for Structure Only

Use the `--structure-only` flag to render only structural elements (walls, openings, labels):

```bash
plancraft compile plan.pc --structure-only -o plan-structure.svg
```

This excludes furniture so you can focus purely on wall geometry, door/window placements, and room layout.

## Step-by-Step Structure Workflow

### 0. MANDATORY: Complete Inventory First

**You MUST complete the full inventory from `measurement-extraction.md` before writing any JSON code.** Output the inventory as text in your response. This means:

1. List ALL rooms (every enclosed space) with names in original language
2. Read ALL annotated dimensions from the reference
3. Compute the coordinate grid for all rooms
4. Map all doors, windows, and openings

**Do not skip this step.** The most common error is starting to write JSON too early with incomplete information.

### 1. Inventory the Building

Before writing any JSON:

1. **Measure the overall footprint** (width x height)
2. **List ALL rooms** — every separate enclosed space, including hallways, stairwells, transition areas, and small utility rooms
3. **Use original room names** from the image — do NOT translate them
4. **Draw a room adjacency graph** — which rooms share which walls
5. **Mark all doors** — position, width, swing direction
6. **Mark all windows** — position, width
7. **Mark all stairs** — type (straight/spiral), position
8. **Extract every annotated dimension** from the reference (see `measurement-extraction.md`)

### 2. Define the Perimeter First

Start from the outside and work inward:

1. Define the **outermost walls** (exterior boundary)
2. Identify **major zones** (garage, main house, upper floors, etc.)
3. Subdivide into **individual rooms**

### 3. Define Rooms in Dependency Order

Rooms that define shared walls must come first in the `"rooms"` array:

```
Room A (exterior walls) -> Room B (shares wall with A) -> Room C (shares wall with B)
```

**CRITICAL — Shared wall door rule**: When two rooms share a wall, define all doors on that wall in the **first room** that defines it (based on array order). This avoids a renderer bug where wall gaps and door arcs are placed at different positions.

### 4. Add Doors and Windows

For each room:
- Calculate `offset` from the wall's `from` point to the door/window start
- Verify `offset + width` does not exceed wall length
- Use `"swing": "left"` or `"right"` for hinged doors, `"swing": "sliding"` for sliding doors
- Standard door widths: 0.6–0.7m (interior), 0.8–0.9m (exterior), 3–4m (garage)
- Standard window sill height: 0.9m

### 5. Add Stairs (Structural Only)

Staircases and spiral staircases are considered structural:

```jsonc
"furniture": [
  { "type": "staircase", "position": {"x": 4800, "y": 6200}, "width": 900, "depth": 2500 },
  { "type": "spiral_staircase", "position": {"x": 5500, "y": 7800}, "width": 1500, "depth": 1500 }
]
```

### 6. Structure Self-Review Checklist

Before considering the structure complete:

- [ ] **Perimeter closes**: Every room's last wall `to` matches its first wall `from`
- [ ] **Width sums**: Room widths along each row sum to total building width
- [ ] **Height sums**: Room heights along each column sum to total building height
- [ ] **Shared wall alignment**: Adjacent rooms share exact coordinates
- [ ] **Door positions**: Every door is on the correct wall with correct offset
- [ ] **Window positions**: Every window is on the correct wall with correct offset
- [ ] **Opening bounds**: `offset + width` fits within wall length for every opening
- [ ] **No duplicate doors on shared walls**: Doors only defined on the first room
- [ ] **Curved walls**: If the design has curved walls, `bulge` values are set correctly (positive = left/CCW, negative = right/CW, 1 = semicircle). Avoid placing doors/windows on curved walls when possible.
- [ ] **Compile test**: `plancraft compile plan.pc --structure-only` succeeds

### 7. Compile and Verify

```bash
plancraft compile plan.pc --structure-only -o plan-structure.svg
```

After compilation, check the results:

1. **Building envelope check**: Compare the compiled width and height against your inventory
   - If the height is too short, you likely missed rooms or compressed vertical zones
   - If the width is wrong, check horizontal room tiling
2. **Per-room area check**: Each room's compiled area should match `width × height` from your inventory
3. **Room count check**: The number of compiled rooms must match your inventory

**If ANY of these checks fail, fix the coordinates BEFORE adding furniture.** Common fixes:
- If the building is too short vertically: re-examine vertical dimension annotations on the left and right edges of the image. Sum ALL vertical segments to get the true building height. Then adjust room Y coordinates.
- If a room's area is wrong: verify its corner coordinates match the annotated dimensions
- If rooms are missing: add them to fill any gaps in the building footprint

Open the SVG and verify:
- All walls connect properly (no gaps)
- Doors are in correct positions with correct swing direction
- Windows are in correct positions

## Related Rules

- `walls.md` — Wall syntax and thickness
- `openings.md` — Door, window, and opening syntax
- `rooms.md` — Room objects and shared walls
- `coordinates.md` — Coordinate system and units
- `measurement-extraction.md` — Extracting dimensions from reference images
