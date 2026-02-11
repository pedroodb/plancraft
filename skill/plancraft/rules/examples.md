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

## Open-Plan Apartment with Openings

Use `"openings"` on a shared wall to create an archway between rooms (no door panel). This example shows a Living Room connected to a Kitchen with a wide archway and a hallway distributing to bedrooms and bathrooms.

### Structure (family-apartment.pc excerpt — key rooms)

```jsonc
// Living Room with archway opening to Kitchen
{
  "name": "Living Room",
  "walls": [
    { "direction": "south", "from": {"x": 0, "y": 0}, "to": {"x": 7000, "y": 0}, "thickness": 200 },
    { "direction": "east",  "from": {"x": 7000, "y": 0}, "to": {"x": 7000, "y": 4500}, "thickness": 150 },
    { "direction": "north", "from": {"x": 7000, "y": 4500}, "to": {"x": 0, "y": 4500}, "thickness": 150 },
    { "direction": "west",  "from": {"x": 0, "y": 4500}, "to": {"x": 0, "y": 0}, "thickness": 200 }
  ],
  "doors": [
    { "wall": "north", "offset": 2500, "width": 900, "swing": "right" }
  ],
  "windows": [
    { "wall": "south", "offset": 1500, "width": 2000, "height": 2200, "sill": 200 },
    { "wall": "west", "offset": 1500, "width": 1500, "height": 1400, "sill": 900 }
  ],
  "openings": [
    // 2m wide archway connecting to Kitchen — open-plan layout
    { "wall": "east", "offset": 1200, "width": 2000 }
  ]
}
```

```jsonc
// Kitchen shares west wall with Living Room (inherits the archway)
{
  "name": "Kitchen",
  "walls": [
    { "direction": "south", "from": {"x": 7000, "y": 0}, "to": {"x": 13000, "y": 0}, "thickness": 200 },
    { "direction": "east",  "from": {"x": 13000, "y": 0}, "to": {"x": 13000, "y": 4500}, "thickness": 200 },
    { "direction": "north", "from": {"x": 13000, "y": 4500}, "to": {"x": 7000, "y": 4500}, "thickness": 150 }
  ],
  "sharedWalls": [
    { "direction": "west", "sourceRoom": "Living Room", "sourceWall": "east" }
  ],
  "doors": [
    { "wall": "north", "offset": 2500, "width": 900, "swing": "left" }
  ],
  "windows": [
    { "wall": "south", "offset": 2000, "width": 1500, "height": 1400, "sill": 1200 },
    { "wall": "east", "offset": 1500, "width": 1000, "height": 1200, "sill": 1200 }
  ]
}
```

```jsonc
// Hallway with split north wall — each segment matches an upper room
// so bedrooms can use sharedWalls to reference them
{
  "name": "Hallway",
  "sharedWalls": [
    { "direction": "south left",  "sourceRoom": "Living Room", "sourceWall": "north" },
    { "direction": "south right", "sourceRoom": "Kitchen", "sourceWall": "north" }
  ],
  "walls": [
    { "direction": "east",           "from": {"x": 13000, "y": 4500}, "to": {"x": 13000, "y": 5700}, "thickness": 200 },
    { "direction": "north right",    "from": {"x": 13000, "y": 5700}, "to": {"x": 9500, "y": 5700},  "thickness": 150 },
    { "direction": "north mid",      "from": {"x": 9500, "y": 5700},  "to": {"x": 6500, "y": 5700},  "thickness": 150 },
    { "direction": "north mid-left", "from": {"x": 6500, "y": 5700},  "to": {"x": 4500, "y": 5700},  "thickness": 150 },
    { "direction": "north left",     "from": {"x": 4500, "y": 5700},  "to": {"x": 0, "y": 5700},     "thickness": 150 },
    { "direction": "west",           "from": {"x": 0, "y": 5700},     "to": {"x": 0, "y": 4500},     "thickness": 200 }
  ],
  "doors": [
    { "wall": "west", "offset": 150, "width": 900, "swing": "left" },
    { "wall": "north left", "offset": 1500, "width": 800, "swing": "right" },
    { "wall": "north mid", "offset": 1000, "width": 800, "swing": "left" },
    { "wall": "north right", "offset": 1200, "width": 800, "swing": "right" }
  ]
}
```

```jsonc
// Master Bedroom referencing hallway segment as south wall
{
  "name": "Master Bedroom",
  "sharedWalls": [
    { "direction": "south", "sourceRoom": "Hallway", "sourceWall": "north left" }
  ],
  "walls": [
    { "direction": "east",  "from": {"x": 4500, "y": 5700}, "to": {"x": 4500, "y": 9000}, "thickness": 150 },
    { "direction": "north", "from": {"x": 4500, "y": 9000}, "to": {"x": 0, "y": 9000},    "thickness": 200 },
    { "direction": "west",  "from": {"x": 0, "y": 9000},    "to": {"x": 0, "y": 5700},    "thickness": 200 }
  ],
  "doors": [
    // Private door to ensuite bathroom
    { "wall": "east", "offset": 500, "width": 700, "swing": "left" }
  ],
  "windows": [
    { "wall": "north", "offset": 1500, "width": 1500, "height": 1400, "sill": 900 }
  ]
}
```

```jsonc
// Ensuite accessed only from Master Bedroom (no hallway door)
{
  "name": "Ensuite",
  "sharedWalls": [
    { "direction": "south", "sourceRoom": "Hallway", "sourceWall": "north mid-left" },
    { "direction": "west",  "sourceRoom": "Master Bedroom", "sourceWall": "east" }
  ],
  "walls": [
    { "direction": "east",  "from": {"x": 6500, "y": 5700}, "to": {"x": 6500, "y": 9000}, "thickness": 150 },
    { "direction": "north", "from": {"x": 6500, "y": 9000}, "to": {"x": 4500, "y": 9000}, "thickness": 200 }
  ],
  "windows": [
    { "wall": "north", "offset": 500, "width": 800, "height": 1000, "sill": 1200 }
  ]
}
```

## Curved Bay Window Villa

Use the `bulge` property to create architectural curves. Negative bulge curves outward (right/CW), positive curves inward (left/CCW). Doors and windows work on curved walls (renderer falls back to polygon approximation).

### Structure (curved-villa.pc excerpt — key rooms)

```jsonc
// Living Room with curved south facade (bulge: -0.1 ≈ 23° subtle arc)
{
  "name": "Living Room",
  "walls": [
    { "direction": "south", "from": {"x": 0, "y": 0}, "to": {"x": 10000, "y": 0}, "thickness": 200, "bulge": -0.1 },
    { "direction": "east",  "from": {"x": 10000, "y": 0}, "to": {"x": 10000, "y": 4000}, "thickness": 200 },
    { "direction": "north", "from": {"x": 10000, "y": 4000}, "to": {"x": 0, "y": 4000}, "thickness": 150 },
    { "direction": "west",  "from": {"x": 0, "y": 4000}, "to": {"x": 0, "y": 0}, "thickness": 200 }
  ],
  "doors": [
    { "wall": "north", "offset": 4000, "width": 900, "swing": "right" },
    // Sliding glass door on the curved wall
    { "wall": "south", "offset": 3500, "width": 2000, "swing": "sliding" }
  ],
  "windows": [
    // Windows on the curved facade
    { "wall": "south", "offset": 1000, "width": 1500, "height": 1400, "sill": 900 },
    { "wall": "south", "offset": 7000, "width": 1500, "height": 1400, "sill": 900 }
  ]
}
```

```jsonc
// Sunroom with curved east wall (bulge: -0.3 ≈ 67° conservatory bay)
{
  "name": "Sunroom",
  "sharedWalls": [
    { "direction": "south", "sourceRoom": "Hallway", "sourceWall": "north right" },
    { "direction": "west",  "sourceRoom": "Bathroom", "sourceWall": "east" }
  ],
  "walls": [
    { "direction": "east",  "from": {"x": 10000, "y": 5200}, "to": {"x": 10000, "y": 8000}, "thickness": 200, "bulge": -0.3 },
    { "direction": "north", "from": {"x": 10000, "y": 8000}, "to": {"x": 6500, "y": 8000},  "thickness": 200 }
  ],
  "windows": [
    // Tall window on the curved bay wall
    { "wall": "east", "offset": 500, "width": 1500, "height": 1800, "sill": 400 },
    { "wall": "north", "offset": 500, "width": 1200, "height": 1400, "sill": 900 }
  ]
}
```

## Diagonal (Oblique) Walls

Diagonal walls are created by setting non-axis-aligned `from`/`to` coordinates. Use custom direction names for diagonal wall segments:

```jsonc
// Pentagonal study with a 45° diagonal cutting the top-right corner
{
  "name": "Angled Study",
  "walls": [
    { "direction": "south",    "from": {"x": 0, "y": 0},    "to": {"x": 4000, "y": 0},    "thickness": 200 },
    { "direction": "east",     "from": {"x": 4000, "y": 0},  "to": {"x": 4000, "y": 2500}, "thickness": 200 },
    // 45° diagonal — from and to are not aligned on any axis
    { "direction": "diagonal", "from": {"x": 4000, "y": 2500}, "to": {"x": 2500, "y": 4000}, "thickness": 150 },
    { "direction": "north",    "from": {"x": 2500, "y": 4000}, "to": {"x": 0, "y": 4000},   "thickness": 200 },
    { "direction": "west",     "from": {"x": 0, "y": 4000},    "to": {"x": 0, "y": 0},      "thickness": 200 }
  ]
}
```

## Comprehensive Furniture Layout

A fully furnished apartment showing all furniture types, custom elements, scaling, and rotation. See `family-apartment.pcf` for the complete file.

```jsonc
{
  // Custom elements defined inline — used when no built-in element fits
  "elements": {
    "plant": {
      "name": "Potted Plant",
      "tags": ["living", "decoration"],
      "defaultWidth": 400,
      "defaultDepth": 400,
      "svg": "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 400 400\"><circle cx=\"200\" cy=\"200\" r=\"180\" fill=\"#e8e8e8\" stroke=\"black\" stroke-width=\"5\"/><circle cx=\"200\" cy=\"200\" r=\"100\" fill=\"#d0d0d0\" stroke=\"black\" stroke-width=\"3\"/></svg>",
      "source": "generated"
    }
  },

  "placements": [
    // Living Room — L-sofa + coffee table setup, TV console against wall
    { "element": "default/l_sofa",      "position": {"x": 1600, "y": 2800}, "room": "Living Room" },
    { "element": "default/coffee_table", "position": {"x": 3200, "y": 2800}, "room": "Living Room" },
    { "element": "default/tv_console",  "position": {"x": 3500, "y": 400},  "room": "Living Room" },
    { "element": "default/floor_lamp",  "position": {"x": 600, "y": 600},   "room": "Living Room" },
    // Custom element (plain ID, no "default/" prefix)
    { "element": "plant", "position": {"x": 6600, "y": 4000}, "room": "Living Room" },

    // Kitchen — appliances along wall, dining table with chairs
    { "element": "default/counter", "position": {"x": 8500, "y": 300}, "width": 2400, "depth": 600, "room": "Kitchen" },
    { "element": "default/stove",   "position": {"x": 10600, "y": 300}, "room": "Kitchen" },
    { "element": "default/fridge",  "position": {"x": 12600, "y": 400}, "room": "Kitchen" },
    { "element": "default/table",   "position": {"x": 10000, "y": 3000}, "room": "Kitchen" },
    { "element": "default/chair",   "position": {"x": 9300, "y": 3000},  "room": "Kitchen" },
    { "element": "default/chair",   "position": {"x": 10700, "y": 3000}, "room": "Kitchen" },

    // Bedroom — double bed, wardrobe rotated 90°, lamp
    { "element": "default/bed",        "position": {"x": 2000, "y": 8000}, "room": "Master Bedroom" },
    { "element": "default/wardrobe",   "position": {"x": 3800, "y": 8700}, "rotation": 90, "room": "Master Bedroom" },
    { "element": "default/floor_lamp", "position": {"x": 500, "y": 6200},  "room": "Master Bedroom" },

    // Kids Room — single bed (65% width), desk + office chair
    { "element": "default/bed", "position": {"x": 7500, "y": 8000},
      "scaleWidth": 65, "scaleDepth": 100, "lockProportions": false, "room": "Kids Room" },
    { "element": "default/desk",         "position": {"x": 8500, "y": 6400}, "room": "Kids Room" },
    { "element": "default/office_chair", "position": {"x": 8500, "y": 7000}, "room": "Kids Room" },
    { "element": "default/bookshelf",    "position": {"x": 6900, "y": 7200}, "room": "Kids Room" },

    // Ensuite — toilet + sink near entry, shower in corner
    { "element": "default/toilet", "position": {"x": 5000, "y": 6200}, "room": "Ensuite" },
    { "element": "default/sink",   "position": {"x": 5800, "y": 6000}, "room": "Ensuite" },
    { "element": "default/shower", "position": {"x": 5950, "y": 8550}, "room": "Ensuite" },

    // Family Bathroom — full suite: bathtub + shower + toilet + sink
    { "element": "default/bathtub", "position": {"x": 10500, "y": 8150}, "room": "Family Bathroom" },
    { "element": "default/toilet",  "position": {"x": 10000, "y": 6200}, "room": "Family Bathroom" },
    { "element": "default/sink",    "position": {"x": 11000, "y": 6000}, "room": "Family Bathroom" },
    { "element": "default/shower",  "position": {"x": 12550, "y": 8550}, "room": "Family Bathroom" }
  ]
}
```

## Key Patterns Demonstrated

### Structure Patterns

1. **Shared walls via coordinates**: Adjacent rooms share wall coordinates exactly (e.g., x=6000 is the boundary between Living Room and Kitchen)
2. **Shared walls with `sharedWalls`**: Kitchen references Living Room's east wall as its west wall
3. **Split wall segments**: Hallway's north wall is split into labeled segments ("north left", "north mid", etc.) so each upper room can reference its segment via sharedWalls
4. **Openings (archways)**: Use `"openings"` array for wall gaps without door panels — ideal for open-plan layouts
5. **Curved walls**: Add `"bulge"` to any wall — negative values curve outward, positive inward. `0.1` ≈ subtle, `0.3` ≈ noticeable, `1.0` = semicircle
6. **Openings on curved walls**: Doors, windows, and openings work on curved walls (renderer approximates with polygons)
7. **Diagonal walls**: Use non-axis-aligned `from`/`to` coordinates with a custom direction name like `"diagonal"`
8. **Ensuite pattern**: Room accessible only from another room (no hallway door), using sharedWalls for both south and west walls

### Furniture Patterns

1. **Separate furniture file**: All furniture placements in a .pcf file with room tags for organization
2. **Element references**: `"default/sofa"` for built-in package, plain ID `"plant"` for custom elements
3. **Custom elements**: Define inline in the `"elements"` section with SVG, tags, and default dimensions
4. **Single bed**: Use `scaleWidth: 65, scaleDepth: 100, lockProportions: false` on a double bed element
5. **Size override**: `"width": 2400, "depth": 600` on the counter for a custom fit
6. **Rotation**: `"rotation": 90` to orient wardrobe against a wall
7. **Fixture grouping**: Kitchen appliances along one wall, bathroom fixtures grouped together
8. **Room tags**: Every placement has a `"room"` field for organization
