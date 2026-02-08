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

## How Furniture Works

Furniture is stored in a **separate `.pcf` file**, not inside the `.pc` structure file. This keeps the structural plan clean and allows furniture to be managed independently.

### AI Tool Workflow

When working in the web app, use the furniture tools:

1. **`list_furniture_elements`** — See all available elements from packages
2. **`get_furniture_layout`** — Read the current furniture placements
3. **`add_furniture_placement`** — Add a furniture item to the layout
4. **`remove_furniture_placement`** — Remove a placement by index
5. **`replace_furniture_layout`** — Replace the entire furniture layout

### CLI Workflow

```bash
# Compile structure only (no furniture)
plancraft compile plan.pc --structure-only -o plan-structure.svg

# Compile with furniture overlay
plancraft compile plan.pc --furniture plan.pcf -o plan.svg

# Add furniture via CLI
plancraft furniture add default/bed --to plan.pcf --pos 2000,1750 --room Bedroom
plancraft furniture add default/sofa --to plan.pcf --pos 3000,2000 --width 2200 --room "Living Room"
```

## Step-by-Step Furniture Workflow

### 1. Inventory Furniture Per Room

For each room, list what furniture should be placed:
- Reference the source image/plan for furniture types and approximate positions
- Note any furniture that the format cannot represent

### 2. Place Furniture Room by Room

Use `add_furniture_placement` or `replace_furniture_layout` to add items:

```jsonc
{
  "placements": [
    { "element": "default/bed", "position": {"x": 2500, "y": 2000}, "width": 1400, "depth": 2000, "room": "Bedroom" },
    { "element": "default/desk", "position": {"x": 4000, "y": 500}, "width": 1200, "depth": 600, "rotation": 90, "room": "Bedroom" }
  ]
}
```

- **position** `{"x": N, "y": N}` is the center point in absolute coordinates
- **width** is along the primary axis, **depth** perpendicular
- **rotation** orients the piece (0 = default, 90 = clockwise)
- **room** is optional but helps organize large layouts

### 3. Common Furniture Sizes (mm)

| Element | Typical Size (W x D) |
|---------|---------------------|
| default/bed (single) | 900 x 2000 |
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

### 4. Placement Tips

- **Keep clearance**: Leave at least 600mm between furniture and walls for walkways
- **Align to walls**: Furniture against walls looks natural — place the center at `wall_position + depth/2`
- **Group by function**: Kitchen appliances along the counter wall, bathroom fixtures along the plumbing wall
- **Use rotation**: Orient beds with headboard against wall (rotation 0 = head at top)
- **Scale check**: Ensure furniture fits within the room boundaries

### 5. Furniture Self-Review Checklist

- [ ] Every room has its expected furniture
- [ ] No furniture extends beyond room boundaries
- [ ] Clearance between furniture pieces is reasonable (>= 600mm for walkways)
- [ ] Furniture positions match the reference image layout
- [ ] Cars fit within garage with door clearance
- [ ] Unsupported fixtures are documented with comments

## Related Rules

- `furniture.md` — Furniture element reference, .pcf format, and all available elements
- `structure-guide.md` — Phase 1: getting the structure right first
