# Walls

## Syntax

Walls are defined inside a room block at indent 4:

```
wall <direction> <x1>,<y1> <x2>,<y2> <thickness> [bulge=<n>]
```

## Fields

- **`direction`** — A positional label for which side of the room the wall is on. **Always use English cardinal directions**: `north`, `east`, `south`, `west`. For rooms with more than 4 walls, use compound names: `"north left"`, `"north right"`, `"step east"`, `"step south"`, `diagonal`. **Never use room names, destination names, or translated words** as direction values (e.g., `pasillo`, `cocina`, `"sala south"` are all wrong).
- **`x1,y1` / `x2,y2`** — Absolute coordinates of the wall's start and end points.
- **`thickness`** — Wall thickness in the project's unit (default mm).

## Thickness Conventions

- Exterior walls: 0.2-0.3m (`200`-`300` in .pc file)
- Interior walls: 0.1-0.15m (`100`-`150` in .pc file)
- Partition walls: 0.08-0.1m (`80`-`100` in .pc file)

## Example

```
room: "Living Room"
  wall north 0,0 6000,0 200
  wall east 6000,0 6000,4000 200
  wall south 6000,4000 0,4000 200
  wall west 0,4000 0,0 200
```

## Curved Walls

Walls can be curved using the optional `bulge` parameter:

```
wall north 0,0 6000,0 200 bulge=0.3
```

### Bulge values

- **`0`** or omitted — straight line (default, backward compatible)
- **Positive** — arc curves to the left (CCW when traveling from start to end)
- **Negative** — arc curves to the right (CW)
- **`1`** — semicircle (180 arc)
- **`-1`** — semicircle in the opposite direction
- Formula: `bulge = tan(arcAngle / 4)`

### Common bulge values

| Bulge | Arc angle | Description |
|-------|-----------|-------------|
| 0.1   | ~23       | Subtle curve |
| 0.3   | ~67       | Noticeable curve |
| 0.5   | ~106      | Strong curve |
| 1.0   | 180       | Semicircle |

### Example: Bay window area

```
room: Bay
  wall north 2000,0 5000,0 200 bulge=-0.3
  wall east 5000,0 5000,2000 200
  wall south 5000,2000 2000,2000 200
  wall west 2000,2000 2000,0 200
```

### Tips for curved walls

- The bulge is relative to the start/end endpoints, so the curve moves with the wall when the room is dragged
- Doors, windows, and openings are fully supported on curved walls — they are positioned along the arc and oriented tangent to the curve
- The `offset` for openings on curved walls is measured along the arc length, not the chord
- Keep bulge values small (0.1-0.5) for realistic architectural curves
- Use larger values (0.5-1.0) for dramatic design features like turrets or rounded corners

## Tips

- Walls should form a closed polygon (last wall's end matches first wall's start)
- Keep wall directions consistent with their orientation (north walls run left-to-right along the top, etc.)
- The direction label is semantic — it names which side of the room the wall is on
- Oblique/diagonal walls are supported by setting start and end to non-axis-aligned coordinates
