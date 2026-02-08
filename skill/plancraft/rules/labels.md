# Labels

## Syntax

Labels are placed at the floor level in the `"labels"` array:

```jsonc
{ "text": "Living Room", "position": "center" }
{ "text": "Entry", "position": {"x": 3000, "y": 200} }
```

## Fields

- **`text`** — The label text to display
- **`position`** — Either `"center"` or an explicit `{"x": N, "y": N}` coordinate

## Center Position

When using `"center"`, the label text must match a room name. The label will be automatically placed at the geometric center of that room.

```jsonc
{ "text": "Living Room", "position": "center" }
```

## Explicit Position

Place a label at specific coordinates:

```jsonc
{ "text": "Entry", "position": {"x": 3000, "y": 200} }
```

## Tips

- Use `"center"` for room names — it auto-centers
- Use explicit coordinates for labels that don't correspond to rooms
- Labels render with thin line weight and are always horizontal
