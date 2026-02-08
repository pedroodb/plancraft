# Doors, Windows, and Openings

## Doors

Doors are objects in a room's `"doors"` array:

```jsonc
{ "wall": "north", "offset": 1500, "width": 900, "swing": "left" }
```

- **`wall`** — References a wall direction defined in the same room
- **`offset`** — Distance from the wall's `from` point to the door hinge
- **`width`** — Door panel width (standard: `900` mm for single, `1200` mm for double)
- **`swing`** — `"left"`, `"right"`, or `"sliding"`

### Door Examples

```jsonc
"doors": [
  { "wall": "north", "offset": 1500, "width": 900, "swing": "left" },
  { "wall": "hallway side", "offset": 500, "width": 1200, "swing": "sliding" }
]
```

## Windows

Windows are objects in a room's `"windows"` array:

```jsonc
{ "wall": "east", "offset": 800, "width": 1200, "height": 1400, "sill": 900 }
```

- **`wall`** — References a wall direction
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

## Placement Tips

- Ensure `offset + width` does not exceed the wall length
- Leave at least 200mm from wall corners for structural integrity
- Standard door width: 800-900mm (interior), 900-1000mm (exterior)
- Standard window sill height: 900mm (rooms), 1200mm (bathrooms)
- Use openings for archways, pass-throughs, and open-plan transitions
