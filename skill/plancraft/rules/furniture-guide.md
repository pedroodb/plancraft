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

### 2. Place Furniture Room by Room

Use `add_furniture_placement` or `replace_furniture_layout` to add items:

```jsonc
{
  "placements": [
    {
      "element": "default/bed",
      "position": {"x": 2500, "y": 2000},
      "room": "Bedroom"
    },
    {
      "element": "default/desk",
      "position": {"x": 4000, "y": 500},
      "scaleWidth": 120,
      "scaleDepth": 120,
      "lockProportions": true,
      "rotation": 90,
      "room": "Bedroom"
    }
  ]
}
```

- **position** `{"x": N, "y": N}` is the center point in absolute coordinates
- **scaleWidth** / **scaleDepth** are percentages of the original size (100 = default)
- **lockProportions** — when `true`, width and depth scale together
- **rotation** orients the piece (0 = default, 90 = clockwise)
- **room** is optional but helps organize large layouts

### 3. Common Furniture Sizes (mm)

| Element | Default Size (W x D) |
|---------|---------------------|
| default/bed (single, use scaleWidth: 65) | ~900 x 2000 |
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
- **Use scale for sizing**: Use `scaleWidth`/`scaleDepth` percentages rather than guessing mm sizes
- **Create custom elements**: If a piece doesn't exist in built-in packages, create it with `create_furniture_element`

### 5. Furniture Self-Review Checklist

- [ ] Every room has its expected furniture
- [ ] No furniture extends beyond room boundaries
- [ ] Clearance between furniture pieces is reasonable (>= 600mm for walkways)
- [ ] Furniture positions match the reference image layout
- [ ] Cars fit within garage with door clearance
- [ ] Missing furniture types created as custom elements
- [ ] Unsupported fixtures are documented with comments

## Related Rules

- `furniture.md` — Furniture element reference, .pcf format, and all available elements
- `structure-guide.md` — Phase 1: getting the structure right first
