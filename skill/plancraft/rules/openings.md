# Doors, Windows, and Openings

## Doors

Doors are objects in a room's `"doors"` array:

```jsonc
{ "wall": "north", "offset": 1500, "width": 900, "swing": "left" }
```

- **`wall`** — Must EXACTLY match a wall `"direction"` string defined in the same room (e.g., `"north"`, `"east"`). Never use room names or translations.
- **`offset`** — Distance from the wall's `from` point to the door hinge
- **`width`** — Door panel width (standard: 0.9m / `900` for single, 1.2m / `1200` for double)
- **`swing`** — `"left"`, `"right"`, or `"sliding"`

### Door Examples

```jsonc
"doors": [
  { "wall": "north", "offset": 1500, "width": 900, "swing": "left" },
  { "wall": "south", "offset": 500, "width": 1200, "swing": "sliding" }
]
```

## Windows

Windows are objects in a room's `"windows"` array:

```jsonc
{ "wall": "east", "offset": 800, "width": 1200, "height": 1400, "sill": 900 }
```

- **`wall`** — Must EXACTLY match a wall `"direction"` string defined in the same room. Never use room names or translations.
- **`offset`** — Distance from wall's `from` point to window start
- **`width`** — Window width
- **`height`** — Window height (for elevation reference)
- **`sill`** — Sill height from floor (for elevation reference)

## Open Passages (Openings)

Openings are objects in a room's `"openings"` array — wall gaps with no door panel:

```jsonc
{ "wall": "south", "offset": 2000, "width": 1500 }
```

## Sliding Doors

Use `"swing": "sliding"` to render a sliding door (two parallel lines instead of an arc):

```jsonc
{ "wall": "east", "offset": 1000, "width": 1800, "swing": "sliding" }
```

## Placement Rules (MANDATORY)

### Wall Length Constraint

**Before placing any door or window, you MUST know the wall length.** Call `list_rooms` to see each wall's `lengthMm`. Then ensure:

```
offset + width ≤ wall length
```

If a wall is 3000mm long, a 900mm door can have offset at most 2100mm (3000 - 900). Violating this places the element outside the wall, which is architecturally invalid.

### Offset Guidelines

- `offset` is measured from the wall's `from` point (start)
- Keep `offset ≥ 200` (leave 0.2m from the starting corner)
- Keep `offset + width ≤ wallLength - 200` (leave 0.2m from the ending corner)
- Centre a single element: `offset = (wallLength - width) / 2`

### Standard Dimensions

- Interior door width: 800–900mm
- Exterior door width: 900–1000mm
- Sliding door width: 1200–1800mm
- Window width: 600–1800mm (common: 1200mm)
- Window sill height: 900mm (rooms), 1200mm (bathrooms)

### Multiple Elements on One Wall

When placing multiple doors/windows on the same wall, ensure their ranges don't overlap:
- Element A occupies `[offsetA, offsetA + widthA]`
- Element B must start after element A ends: `offsetB ≥ offsetA + widthA + 100` (leave 100mm gap minimum)

### Openings

Use openings for archways, pass-throughs, and open-plan transitions. Same offset + width rules apply.
