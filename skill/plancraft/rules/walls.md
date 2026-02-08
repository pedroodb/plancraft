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

## Tips

- Walls should form a closed polygon (last wall's `to` matches first wall's `from`)
- Keep wall directions consistent with their orientation (north walls run left-to-right along the top, etc.)
- The direction label is semantic — it names which side of the room the wall is on
