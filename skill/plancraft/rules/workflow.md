# Workflow Guide

## Step-by-Step Process for Creating Floor Plans

### 0. MANDATORY Inventory (Do This FIRST — Before Any JSON)

Before writing any JSON, you MUST analyze the reference thoroughly and **output the complete inventory as text**. Do NOT call any tools until this inventory is complete.

1. **List ALL rooms** — every enclosed space (including hallways, stairwells, transition areas, small utility rooms). Use room names exactly as shown in the reference image, in the original language. Do NOT merge rooms. Do NOT translate names.
2. **List total building dimensions** (W × H) from annotations, in meters
3. **Read EVERY annotated dimension** from the reference image (see `measurement-extraction.md`)
4. **Compute absolute coordinates** for each room's corners (in meters for your inventory, convert to mm for .pc code)
5. **Map the room adjacency graph** — which rooms share which walls
6. **List all doors and windows** with their wall, offset, width, and swing direction
7. **List furniture** visible in each room (using only supported types)
8. **Note unsupported elements** — add these as `// NOTE:` comments later

Output this inventory as a structured list before proceeding. This prevents downstream coordinate errors. The inventory step is the most important step — skipping it causes cascading errors in coordinates.

### 1. Analyze the Layout (Perimeter-First)

Start from the **outside** and work **inward**:

1. Define the **overall building footprint** — the outermost rectangle (or L-shape, etc.)
2. Identify **major zones**: garage, main house, annex, etc.
3. Subdivide zones into **individual rooms**
4. Identify which walls are **shared** between rooms
5. Note all doors, windows, and openings
6. List furniture in each room

Do NOT start by defining individual rooms — start with the perimeter, then carve it into rooms.

### 2. Set Up Coordinate System

Choose an origin point (usually bottom-left corner of the building footprint):
- X increases to the right
- Y increases upward (architectural convention)
- Communicate in meters to users; .pc coordinates use mm (multiply by 1000)

### 3. Define Rooms in Order

Start with rooms that don't depend on others, then rooms with shared walls. The order of rooms in the `"rooms"` array matters:

```
Room A -> Room B (shares wall with A) -> Room C (shares wall with B)
```

### 4. Add Openings

For each room, add doors, windows, and openings to their respective arrays:
- Calculate offset from wall's `from` point
- Use `"swing": "left"` or `"right"` for hinged doors, `"swing": "sliding"` for sliding doors
- Use openings for archways and pass-throughs

### 5. Place Furniture (in a separate .pcf file)

Create a `.pcf` file with furniture placements:
- Each placement references an element as `"package/element"` (e.g. `"default/bed"`)
- Position at center point `{"x": N, "y": N}` in absolute coordinates
- Optionally set width, depth overrides, and rotation
- Use the `"room"` field for organizational grouping

### 6. Self-Review Checklist

Before considering the plan complete, verify ALL of the following:

1. **Width check**: Room widths along each row sum to total building width
2. **Height check**: Room heights along each column sum to total building height
3. **Closed polygons**: Every room's last wall `to` matches its first wall `from`
4. **Shared wall alignment**: Adjacent rooms share exact coordinates at their shared walls
5. **No overlaps**: No two rooms occupy the same coordinate space
6. **Opening bounds**: Every door/window `offset + width` fits within its wall's length
7. **Unsupported elements**: All features the format can't represent are documented in comments

### 7. Compile and Review

```bash
# Structure only
plancraft compile plan.pc --structure-only -o plan-structure.svg

# With furniture overlay
plancraft compile plan.pc --furniture plan.pcf -o plan.svg
```

Open the SVG and verify:
- All walls connect properly
- Doors and windows are in correct positions
- Furniture is properly placed within room boundaries

## Common Patterns

### Adjacent Rooms (Left to Right)

```jsonc
{
  "rooms": [
    {
      "name": "Room A",
      "walls": [
        { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 4000, "y": 0}, "thickness": 200 },
        { "direction": "east",  "from": {"x": 4000, "y": 0}, "to": {"x": 4000, "y": 3000}, "thickness": 200 },
        { "direction": "south", "from": {"x": 4000, "y": 3000}, "to": {"x": 0, "y": 3000}, "thickness": 200 },
        { "direction": "west",  "from": {"x": 0, "y": 3000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
      ]
    },
    {
      "name": "Room B",
      "walls": [
        { "direction": "north", "from": {"x": 4000, "y": 0}, "to": {"x": 8000, "y": 0}, "thickness": 200 },
        { "direction": "east",  "from": {"x": 8000, "y": 0}, "to": {"x": 8000, "y": 3000}, "thickness": 200 },
        { "direction": "south", "from": {"x": 8000, "y": 3000}, "to": {"x": 4000, "y": 3000}, "thickness": 200 }
      ],
      "sharedWalls": [
        { "direction": "west", "sourceRoom": "Room A", "sourceWall": "east" }
      ]
    }
  ]
}
```

### Garage + House Combo

Garages often don't span the full building width. Define the garage and adjacent rooms as separate zones with shared walls at the boundary:

```jsonc
{
  "rooms": [
    {
      "name": "Garage",
      "walls": [
        { "direction": "south", "from": {"x": 0, "y": 0}, "to": {"x": 4800, "y": 0}, "thickness": 200 },
        { "direction": "east",  "from": {"x": 4800, "y": 0}, "to": {"x": 4800, "y": 5000}, "thickness": 200 },
        { "direction": "north", "from": {"x": 4800, "y": 5000}, "to": {"x": 0, "y": 5000}, "thickness": 200 },
        { "direction": "west",  "from": {"x": 0, "y": 5000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
      ],
      "doors": [
        { "wall": "south", "offset": 500, "width": 3800, "swing": "sliding" }
      ]
    },
    {
      "name": "Study",
      "walls": [
        { "direction": "south", "from": {"x": 4800, "y": 0}, "to": {"x": 7600, "y": 0}, "thickness": 200 },
        { "direction": "east",  "from": {"x": 7600, "y": 0}, "to": {"x": 7600, "y": 3200}, "thickness": 200 },
        { "direction": "north", "from": {"x": 7600, "y": 3200}, "to": {"x": 4800, "y": 3200}, "thickness": 150 }
      ],
      "sharedWalls": [
        { "direction": "west", "sourceRoom": "Garage", "sourceWall": "east" }
      ]
    }
  ]
}
```

### L-Shaped Building

Use custom wall direction names to define the step in the perimeter:

```jsonc
{
  "name": "L-Room",
  "walls": [
    { "direction": "south",      "from": {"x": 0, "y": 0}, "to": {"x": 8000, "y": 0}, "thickness": 200 },
    { "direction": "east",       "from": {"x": 8000, "y": 0}, "to": {"x": 8000, "y": 4000}, "thickness": 200 },
    { "direction": "step north", "from": {"x": 8000, "y": 4000}, "to": {"x": 5000, "y": 4000}, "thickness": 200 },
    { "direction": "step east",  "from": {"x": 5000, "y": 4000}, "to": {"x": 5000, "y": 7000}, "thickness": 200 },
    { "direction": "north",      "from": {"x": 5000, "y": 7000}, "to": {"x": 0, "y": 7000}, "thickness": 200 },
    { "direction": "west",       "from": {"x": 0, "y": 7000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
  ]
}
```

### Bathroom Layout

Structure (in .pc file):
```jsonc
{
  "name": "Bathroom",
  "walls": [
    { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 2500, "y": 0}, "thickness": 200 },
    { "direction": "east",  "from": {"x": 2500, "y": 0}, "to": {"x": 2500, "y": 2000}, "thickness": 200 },
    { "direction": "south", "from": {"x": 2500, "y": 2000}, "to": {"x": 0, "y": 2000}, "thickness": 200 },
    { "direction": "west",  "from": {"x": 0, "y": 2000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
  ],
  "doors": [
    { "wall": "south", "offset": 800, "width": 700, "swing": "left" }
  ]
}
```

Furniture (in .pcf file):
```jsonc
{
  "placements": [
    { "element": "default/toilet", "position": {"x": 400, "y": 400}, "room": "Bathroom" },
    { "element": "default/sink", "position": {"x": 1250, "y": 300}, "room": "Bathroom" },
    { "element": "default/shower", "position": {"x": 2050, "y": 1100}, "room": "Bathroom" }
  ]
}
```
