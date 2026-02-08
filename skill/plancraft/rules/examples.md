# Complete Examples

## Studio Apartment

### Structure (studio.pc)

```jsonc
{
  "name": "Studio Apartment",
  "scale": 100,
  "unit": "mm",
  "floors": [
    {
      "name": "Ground Floor",
      "rooms": [
        {
          "name": "Studio",
          "walls": [
            { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 5000, "y": 0}, "thickness": 200 },
            { "direction": "east",  "from": {"x": 5000, "y": 0}, "to": {"x": 5000, "y": 4000}, "thickness": 200 },
            { "direction": "south", "from": {"x": 5000, "y": 4000}, "to": {"x": 0, "y": 4000}, "thickness": 200 },
            { "direction": "west",  "from": {"x": 0, "y": 4000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
          ],
          "doors": [
            { "wall": "south", "offset": 2000, "width": 900, "swing": "left" }
          ],
          "windows": [
            { "wall": "east", "offset": 1000, "width": 1200, "height": 1400, "sill": 900 }
          ]
        }
      ],
      "dimensions": [
        { "wall": "north", "room": "Studio", "offset": 500 },
        { "wall": "east", "room": "Studio", "offset": 500 }
      ],
      "labels": [
        { "text": "Studio", "position": "center" }
      ]
    }
  ]
}
```

### Furniture (studio.pcf)

```jsonc
{
  "placements": [
    { "element": "default/bed", "position": {"x": 1000, "y": 1000}, "width": 1400, "depth": 2000, "room": "Studio" },
    { "element": "default/desk", "position": {"x": 4000, "y": 3200}, "room": "Studio" }
  ]
}
```

## Two-Bedroom Apartment

### Structure (two-bedroom.pc)

```jsonc
{
  "name": "Two Bedroom",
  "scale": 100,
  "unit": "mm",
  "floors": [
    {
      "name": "Ground Floor",
      "rooms": [
        {
          "name": "Living Room",
          "walls": [
            { "direction": "north", "from": {"x": 0, "y": 0}, "to": {"x": 6000, "y": 0}, "thickness": 200 },
            { "direction": "east",  "from": {"x": 6000, "y": 0}, "to": {"x": 6000, "y": 4000}, "thickness": 200 },
            { "direction": "south", "from": {"x": 6000, "y": 4000}, "to": {"x": 0, "y": 4000}, "thickness": 200 },
            { "direction": "west",  "from": {"x": 0, "y": 4000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
          ],
          "doors": [
            { "wall": "north", "offset": 1500, "width": 900, "swing": "left" }
          ],
          "windows": [
            { "wall": "south", "offset": 2000, "width": 1500, "height": 1400, "sill": 900 }
          ]
        },
        {
          "name": "Kitchen",
          "walls": [
            { "direction": "north", "from": {"x": 6000, "y": 0}, "to": {"x": 10000, "y": 0}, "thickness": 200 },
            { "direction": "east",  "from": {"x": 10000, "y": 0}, "to": {"x": 10000, "y": 4000}, "thickness": 200 },
            { "direction": "south", "from": {"x": 10000, "y": 4000}, "to": {"x": 6000, "y": 4000}, "thickness": 200 }
          ],
          "sharedWalls": [
            { "direction": "west", "sourceRoom": "Living Room", "sourceWall": "east" }
          ],
          "doors": [
            { "wall": "south", "offset": 1500, "width": 900, "swing": "right" }
          ],
          "windows": [
            { "wall": "north", "offset": 1000, "width": 1200, "height": 1400, "sill": 900 }
          ]
        }
      ],
      "dimchains": [
        { "wall": "north", "room": "Living Room", "offset": 500, "waypoints": [0, 1500, 2400, 6000] }
      ],
      "dimensions": [
        { "wall": "north", "room": "Kitchen", "offset": 500 },
        { "wall": "east", "room": "Living Room", "offset": 500 }
      ],
      "labels": [
        { "text": "Living Room", "position": "center" },
        { "text": "Kitchen", "position": "center" }
      ]
    }
  ]
}
```

### Furniture (two-bedroom.pcf)

```jsonc
{
  "placements": [
    // Living Room
    { "element": "default/sofa", "position": {"x": 3000, "y": 1500}, "room": "Living Room" },
    { "element": "default/table", "position": {"x": 3000, "y": 3000}, "room": "Living Room" },
    // Kitchen
    { "element": "default/counter", "position": {"x": 8000, "y": 500}, "room": "Kitchen" },
    { "element": "default/fridge", "position": {"x": 9500, "y": 500}, "room": "Kitchen" },
    { "element": "default/stove", "position": {"x": 7000, "y": 500}, "room": "Kitchen" },
    { "element": "default/table", "position": {"x": 8000, "y": 2500}, "width": 1000, "depth": 800, "room": "Kitchen" }
  ]
}
```

### Key Patterns Demonstrated

1. **Shared walls via coordinates**: Adjacent rooms share wall coordinates exactly (e.g., x=6000 is the boundary between Living Room and Kitchen)
2. **Shared walls with `sharedWalls`**: Kitchen references Living Room's east wall as its west wall
3. **Dimension chains on facades**: Shows segment breakdowns along walls with openings
4. **Separate furniture file**: All furniture placements in a .pcf file with room tags for organization
5. **Element references**: Using `"default/sofa"` format instead of inline furniture types
