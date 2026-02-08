# Rooms and Shared Walls

## Room Object

Each room is an object in a floor's `"rooms"` array:

```jsonc
{
  "name": "Room Name",
  "walls": [ /* wall objects */ ],
  "sharedWalls": [ /* shared wall references */ ],
  "doors": [ /* door objects */ ],
  "windows": [ /* window objects */ ],
  "openings": [ /* opening objects */ ],
  "furniture": [ /* furniture objects */ ]
}
```

Only `"name"` and `"walls"` are required. All other arrays can be omitted if empty.

## Wall Direction Names

Walls can use cardinal directions or custom strings:

```jsonc
{
  "name": "L-Shaped Room",
  "walls": [
    { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 6000, "y": 0}, "thickness": 200 },
    { "direction": "east",  "from": {"x": 6000, "y": 0}, "to": {"x": 6000, "y": 3000}, "thickness": 200 },
    { "direction": "step east", "from": {"x": 6000, "y": 3000}, "to": {"x": 4000, "y": 3000}, "thickness": 200 },
    { "direction": "step south", "from": {"x": 4000, "y": 3000}, "to": {"x": 4000, "y": 5000}, "thickness": 200 },
    { "direction": "south", "from": {"x": 4000, "y": 5000}, "to": {"x": 0, "y": 5000}, "thickness": 200 },
    { "direction": "west",  "from": {"x": 0, "y": 5000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
  ]
}
```

This allows non-rectangular rooms with any number of walls.

## Shared Walls

When two rooms share a wall, use `"sharedWalls"` to avoid duplicate geometry:

```jsonc
// Room A defines the wall
{
  "name": "Living Room",
  "walls": [
    { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 6000, "y": 0}, "thickness": 200 },
    { "direction": "east",  "from": {"x": 6000, "y": 0}, "to": {"x": 6000, "y": 4000}, "thickness": 200 },
    { "direction": "south", "from": {"x": 6000, "y": 4000}, "to": {"x": 0, "y": 4000}, "thickness": 200 },
    { "direction": "west",  "from": {"x": 0, "y": 4000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
  ]
}

// Room B references it
{
  "name": "Kitchen",
  "walls": [
    { "direction": "north", "from": {"x": 6000, "y": 0}, "to": {"x": 10000, "y": 0}, "thickness": 200 },
    { "direction": "east",  "from": {"x": 10000, "y": 0}, "to": {"x": 10000, "y": 4000}, "thickness": 200 },
    { "direction": "south", "from": {"x": 10000, "y": 4000}, "to": {"x": 6000, "y": 4000}, "thickness": 200 }
  ],
  "sharedWalls": [
    { "direction": "west", "sourceRoom": "Living Room", "sourceWall": "east" }
  ]
}
```

### Shared Wall Fields

- **`direction`** — The wall direction name in this room
- **`sourceRoom`** — The name of the room that originally defines the wall
- **`sourceWall`** — The wall direction in the source room (defaults to `direction` if omitted)

## Tips

- Define rooms in order so shared wall references resolve (source room must come first)
- Room names must be unique within a floor
- Rooms can have any number of walls (not limited to 4)
- Use custom wall direction names for L-shaped, T-shaped, or irregular rooms
