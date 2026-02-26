# Workflow Guide

## Step-by-Step Process for Creating Floor Plans

### 0. MANDATORY Inventory (Do This FIRST — Before Any DSL Code)

Before writing any DSL, you MUST analyze the reference thoroughly and **output the complete inventory as text**. Do NOT call any tools until this inventory is complete.

1. **List ALL rooms** — every enclosed space (including hallways, stairwells, transition areas, small utility rooms). Use room names exactly as shown in the reference image, in the original language. Do NOT merge rooms. Do NOT translate names.
2. **List total building dimensions** (W x H) from annotations, in meters
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

Start with rooms that don't depend on others, then rooms with shared walls. The order of rooms matters:

```
Room A -> Room B (shares wall with A) -> Room C (shares wall with B)
```

### 4. Add Openings

For each room, add doors, windows, and openings:
- Calculate offset from wall's start point
- Use `left` or `right` for hinged doors, `sliding` for sliding doors
- Use openings for archways and pass-throughs

### 5. Place Furniture (in a separate .pcf file)

**Call `get_room_geometry` first** to get room bounds and wall positions. Then create a `.pcf` file with furniture placements:
- Each placement references an element as `package/element` (e.g. `default/bed`)
- Position using: **`at x,y`** (absolute mm), **`anchor <wall> <along> <offset>`** (wall-aligned — use for beds, wardrobes, toilets), or **`rel x,y`** (percentage within room — use for tables)
- Optionally set `scale` and `rotation`
- **Always set the room name** — required for anchor/rel and enables spatial validation
- Check warnings from add_furniture_placement and replace_furniture_layout for overlaps

### 6. Self-Review Checklist

Before considering the plan complete, verify ALL of the following:

1. **Width check**: Room widths along each row sum to total building width
2. **Height check**: Room heights along each column sum to total building height
3. **Closed polygons**: Every room's last wall end matches its first wall start
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

```
floor: "Ground Floor"
  room: "Room A"
    wall north 0,0 4000,0 200
    wall east 4000,0 4000,3000 200
    wall south 4000,3000 0,3000 200
    wall west 0,3000 0,0 200
  room: "Room B"
    wall north 4000,0 8000,0 200
    wall east 8000,0 8000,3000 200
    wall south 8000,3000 4000,3000 200
    shared west from "Room A" sourceWall=east
```

### Garage + House Combo

Garages often don't span the full building width. Define the garage and adjacent rooms as separate zones with shared walls at the boundary:

```
floor: "Ground Floor"
  room: Garage
    wall south 0,0 4800,0 200
    wall east 4800,0 4800,5000 200
    wall north 4800,5000 0,5000 200
    wall west 0,5000 0,0 200
    door south 500 3800 sliding
  room: Study
    wall south 4800,0 7600,0 200
    wall east 7600,0 7600,3200 200
    wall north 7600,3200 4800,3200 150
    shared west from Garage sourceWall=east
```

### L-Shaped Building

Use custom wall direction names to define the step in the perimeter:

```
room: "L-Room"
  wall south 0,0 8000,0 200
  wall east 8000,0 8000,4000 200
  wall "step north" 8000,4000 5000,4000 200
  wall "step east" 5000,4000 5000,7000 200
  wall north 5000,7000 0,7000 200
  wall west 0,7000 0,0 200
```

### Bathroom Layout

Structure (in .pc file):
```
room: Bathroom
  wall north 0,0 2500,0 200
  wall east 2500,0 2500,2000 200
  wall south 2500,2000 0,2000 200
  wall west 0,2000 0,0 200
  door south 800 700 left
```

Furniture (in .pcf file):
```
furniture:

placements:
  place default/toilet at 400,400 in Bathroom
  place default/sink at 1250,300 in Bathroom
  place default/shower at 2050,1100 in Bathroom
```
