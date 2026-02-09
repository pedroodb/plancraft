# Walls

## Syntax

Walls are defined as objects in a room's `"walls"` array:

```jsonc
{ "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 6000, "y": 0}, "thickness": 200 }
```

## Fields

- **`direction`** — A name for the wall. Can be a cardinal direction (`"north"`, `"east"`, `"south"`, `"west"`) or any custom string (`"east lower"`, `"step north"`).
- **`from`** / **`to`** — Absolute `{"x": N, "y": N}` coordinates of the wall's start and end points.
- **`thickness`** — Wall thickness in the project's unit (default mm).

## Thickness Conventions

- Exterior walls: `200`–`300` mm
- Interior walls: `100`–`150` mm
- Partition walls: `80`–`100` mm

## Example

```jsonc
{
  "name": "Living Room",
  "walls": [
    { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 6000, "y": 0}, "thickness": 200 },
    { "direction": "east",  "from": {"x": 6000, "y": 0}, "to": {"x": 6000, "y": 4000}, "thickness": 200 },
    { "direction": "south", "from": {"x": 6000, "y": 4000}, "to": {"x": 0, "y": 4000}, "thickness": 200 },
    { "direction": "west",  "from": {"x": 0, "y": 4000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
  ]
}
```

## Curved Walls

Walls can be curved using the optional `bulge` property:

```jsonc
{ "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 6000, "y": 0}, "thickness": 200, "bulge": 0.3 }
```

### Bulge values

- **`0`** or omitted — straight line (default, backward compatible)
- **Positive** — arc curves to the left (CCW when traveling from `from` to `to`)
- **Negative** — arc curves to the right (CW)
- **`1`** — semicircle (180° arc)
- **`-1`** — semicircle in the opposite direction
- Formula: `bulge = tan(arcAngle / 4)`

### Common bulge values

| Bulge | Arc angle | Description |
|-------|-----------|-------------|
| 0.1   | ~23°      | Subtle curve |
| 0.3   | ~67°      | Noticeable curve |
| 0.5   | ~106°     | Strong curve |
| 1.0   | 180°      | Semicircle |

### Example: Bay window area

```jsonc
{
  "name": "Bay",
  "walls": [
    { "direction": "north", "from": {"x": 2000, "y": 0}, "to": {"x": 5000, "y": 0}, "thickness": 200, "bulge": -0.3 },
    { "direction": "east",  "from": {"x": 5000, "y": 0}, "to": {"x": 5000, "y": 2000}, "thickness": 200 },
    { "direction": "south", "from": {"x": 5000, "y": 2000}, "to": {"x": 2000, "y": 2000}, "thickness": 200 },
    { "direction": "west",  "from": {"x": 2000, "y": 2000}, "to": {"x": 2000, "y": 0}, "thickness": 200 }
  ]
}
```

### Tips for curved walls

- The bulge is relative to the `from`/`to` endpoints, so the curve moves with the wall when the room is dragged
- Curved walls with openings (doors/windows) fall back to polygon approximation rendering
- Keep bulge values small (0.1–0.5) for realistic architectural curves
- Use larger values (0.5–1.0) for dramatic design features like turrets or rounded corners

## Tips

- Walls should form a closed polygon (last wall's `to` matches first wall's `from`)
- Keep wall directions consistent with their orientation (north walls run left-to-right along the top, etc.)
- The direction label is semantic — it names which side of the room the wall is on
- Oblique/diagonal walls are supported by setting `from` and `to` to non-axis-aligned coordinates
