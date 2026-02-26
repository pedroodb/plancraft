# Doors, Windows, and Openings

## Doors

Doors are defined inside a room block at indent 4:

```
door <wall> <offset> <width> <swing>
```

- **`wall`** — Must EXACTLY match a wall direction name defined in the same room (e.g., `north`, `east`). Never use room names or translations.
- **`offset`** — Distance from the wall's start point to the door hinge
- **`width`** — Door panel width (standard: 0.9m / `900` for single, 1.6m / `1600` for double)
- **`swing`** — `left`, `right`, `double`, or `sliding`
  - `left` / `right`: single panel swinging in the specified direction
  - `double`: two panels opening from the center outward (french doors)
  - `sliding`: two parallel panels sliding along the wall

### Door Examples

```
door north 1500 900 left
door south 500 1800 sliding
door east 800 1600 double
```

## Windows

Windows are defined inside a room block at indent 4:

```
window <wall> <offset> <width> <height> <sill>
```

- **`wall`** — Must EXACTLY match a wall direction name defined in the same room. Never use room names or translations.
- **`offset`** — Distance from wall's start point to window start
- **`width`** — Window width
- **`height`** — Window height (for elevation reference)
- **`sill`** — Sill height from floor (for elevation reference)

## Open Passages (Openings)

Openings are wall gaps with no door panel:

```
opening <wall> <offset> <width>
```

## Sliding Doors

Use `sliding` as the swing type to render a sliding door (two parallel lines instead of an arc):

```
door east 1000 1800 sliding
```

## Placement Rules (MANDATORY)

### Wall Length Constraint

**Before placing any door or window, you MUST know the wall length.** Call `list_rooms` to see each wall's `lengthMm`. Then ensure:

```
offset + width <= wall length
```

If a wall is 3000mm long, a 900mm door can have offset at most 2100mm (3000 - 900). Violating this places the element outside the wall, which is architecturally invalid.

### Offset Guidelines

- `offset` is measured from the wall's start point
- Keep `offset >= 200` (leave 0.2m from the starting corner)
- Keep `offset + width <= wallLength - 200` (leave 0.2m from the ending corner)
- Centre a single element: `offset = (wallLength - width) / 2`

### Standard Dimensions

- Interior door width: 800-900mm
- Exterior door width: 900-1000mm
- Sliding door width: 1200-1800mm
- Window width: 600-1800mm (common: 1200mm)
- Window sill height: 900mm (rooms), 1200mm (bathrooms)

### Multiple Elements on One Wall

When placing multiple doors/windows on the same wall, ensure their ranges don't overlap:
- Element A occupies `[offsetA, offsetA + widthA]`
- Element B must start after element A ends: `offsetB >= offsetA + widthA + 100` (leave 100mm gap minimum)

### Openings

Use openings for archways, pass-throughs, and open-plan transitions. Same offset + width rules apply.
