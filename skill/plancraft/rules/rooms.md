# Rooms

## Room Block

Each room is a block inside a floor, at indent 2:

```
room: "Room Name"
  wall north 0,0 5000,0 200
  wall east 5000,0 5000,4000 200
  wall south 5000,4000 0,4000 200
  wall west 0,4000 0,0 200
  door south 2000 900 left
  window east 1000 1200 1400 900
  opening east 1200 2000
```

Only the room name and walls are required. Doors, windows, and openings can be omitted if not present.

## Wall Direction Names

Walls **must** use English cardinal directions (`north`, `south`, `east`, `west`) or positional compound names for rooms with more than 4 walls:

```
room: "L-Shaped Room"
  wall north 0,0 6000,0 200
  wall east 6000,0 6000,3000 200
  wall "step east" 6000,3000 4000,3000 200
  wall "step south" 4000,3000 4000,5000 200
  wall south 4000,5000 0,5000 200
  wall west 0,5000 0,0 200
```

This allows non-rectangular rooms with any number of walls.

## Adjacent Rooms — Grid Tiling (NO OVERLAPS)

Rooms tile together like a grid to fill the building footprint. **Room coordinate spaces must NEVER overlap.** Adjacent rooms meet at boundary walls with matching coordinates.

**Approach: perimeter first, then subdivide.**
1. Define the building footprint (total width × height)
2. Divide into rows/columns of rooms
3. Each room's coordinates fill exactly its portion — no gaps, no overlaps
4. Verify: room widths per row sum to building width; room heights per column sum to building height

```
// 10m × 4m building: Living Room (6m) + Kitchen (4m) side by side
room: "Living Room"
  wall south 0,0 6000,0 200
  wall east 6000,0 6000,4000 200
  wall north 6000,4000 0,4000 200
  wall west 0,4000 0,0 200

// Kitchen starts where Living Room ends (x=6000). NO OVERLAP.
room: Kitchen
  wall south 6000,0 10000,0 200
  wall east 10000,0 10000,4000 200
  wall north 10000,4000 6000,4000 200
  wall west 6000,4000 6000,0 200
```

The renderer automatically deduplicates overlapping boundary walls.

## Rooms with Curved Walls

Rooms can have curved walls using the optional `bulge` parameter on individual walls. See [walls.md](walls.md) for full documentation.

### Semicircular room (turret/bay)

```
room: Turret
  wall north 0,0 4000,0 200 bulge=-1.0
  wall south 4000,0 0,0 200
```

### Room with one curved wall (bay window area)

```
room: "Living Room"
  wall north 0,0 6000,0 200 bulge=-0.2
  wall east 6000,0 6000,4000 200
  wall south 6000,4000 0,4000 200
  wall west 0,4000 0,0 200
```

Note: oblique/diagonal walls are already supported by setting start and end to non-axis-aligned coordinates. The `bulge` parameter adds true curves (arcs) on top of this.

## Tips

- Room names must be unique within a floor
- Rooms can be defined in any order within a floor
- Rooms can have any number of walls (not limited to 4)
- Adjacent rooms share exact coordinates at boundary walls -- the renderer deduplicates overlapping walls automatically
- Use custom wall direction names for L-shaped, T-shaped, or irregular rooms
- Oblique/diagonal walls work with any start/end coordinates
- Curved walls use the optional `bulge` parameter (see [walls.md](walls.md))
