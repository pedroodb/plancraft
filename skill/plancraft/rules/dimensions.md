# Dimensions

## Single Dimension

Dimensions are placed at the floor level in the `"dimensions"` array:

```jsonc
{ "wall": "north", "room": "Living Room", "offset": 500 }
```

They measure the full length of a wall.

### Fields

- **`wall`** — Which wall direction to dimension
- **`room`** — Which room the wall belongs to
- **`offset`** — Distance from the wall to place the dimension line (in drawing units)

## Dimension Chains

For showing multiple measurements along a single wall (e.g., segment lengths between doors/windows), use the `"dimchains"` array:

```jsonc
{ "wall": "north", "room": "Living Room", "offset": 500, "waypoints": [0, 1500, 2400, 6000] }
```

### Fields

- **`wall`** — Which wall direction the chain follows
- **`room`** — Which room the wall belongs to
- **`offset`** — Distance from the wall for the dimension baseline
- **`waypoints`** — Array of distances from the wall's `from` point

### Example

A wall from (0,0) to (6000,0) with a door at offset 1500 (width 900):

```jsonc
{ "wall": "north", "room": "Living Room", "offset": 500, "waypoints": [0, 1500, 2400, 6000] }
```

This creates 3 aligned segments: 0-1500 (1500mm), 1500-2400 (900mm), 2400-6000 (3600mm).

## Rendering

Dimensions render with:
- Extension lines from the wall to the dimension line
- 45-degree architectural tick marks at each end
- Measurement text at the midpoint of each segment
- Thin line weight (0.13mm)

## Facade Dimensioning Pattern

In professional architectural drawings, every exterior wall face has dimension annotations showing the full breakdown of segments — walls, doors, windows, and openings. Use dimchains to achieve this.

### How to Build a Facade Dimchain

For each exterior wall, list the waypoints at every transition:

1. Start at `0` (wall beginning)
2. Add the offset of each door/window (start of opening)
3. Add `offset + width` of each door/window (end of opening)
4. End at the total wall length

### Example: South Wall with Two Windows

A south wall from `(0, 0)` to `(8000, 0)` with:
- Window 1 at offset 800, width 1200
- Window 2 at offset 4000, width 1200

```jsonc
{ "wall": "south", "room": "Main Room", "offset": 800, "waypoints": [0, 800, 2000, 4000, 5200, 8000] }
```

This produces 5 segments: `800 | 1200 | 2000 | 1200 | 2800`

### Example: Stacked Vertical Dimensions

For the left (west) facade of a building with multiple rooms stacked vertically, add a dimension for each room's west wall:

```jsonc
"dimensions": [
  { "wall": "west", "room": "Garage", "offset": 800 },
  { "wall": "west", "room": "Kitchen", "offset": 800 },
  { "wall": "west", "room": "Living", "offset": 800 }
]
```

### Coverage Goal

Every exterior wall face should have at least one annotation:
- Use `"dimensions"` for simple walls without openings
- Use `"dimchains"` for walls with doors, windows, or openings to show the full segment breakdown
- Place facade dimensions at offset 800-1000mm from the wall
- Place interior/detail dimensions at offset 400-500mm

## Tips

- Place overall dimensions further from the plan (offset 800-1000)
- Place detail dimensions closer (offset 400-500)
- Use dimchains when you need to show subdivision of a wall
- Use single dimensions for overall wall length
- Aim for **complete dimension coverage** — a reader should be able to reconstruct all room sizes from the annotations alone
