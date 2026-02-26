# Complete Examples

## Studio Apartment

### Structure (studio.pc)

```
plan: "Studio Apartment"

floor: "Ground Floor"
  room: Studio
    wall north 0,0 5000,0 200
    wall east 5000,0 5000,4000 200
    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200
    door south 2000 900 left
    window east 1000 1200 1400 900
```

### Furniture (studio.pcf)

Positions computed from room geometry — bed against north wall (y=0), desk near east window, sofa centered in the south area:
```
furniture:

placements:
  // Bed against north wall, headboard flush (center.y = wall_inner + depth/2)
  place default/bed at 1500,1100 in Studio
  // Wardrobe against west wall (rotated 90 so depth faces into room)
  place default/wardrobe at 350,3000 in Studio rotation=90
  // Desk near east window for natural light
  place default/desk at 4200,1500 in Studio
  place default/office_chair at 4200,2100 in Studio
  // Living area — sofa centered, clear of door swing
  place default/sofa at 2500,3200 in Studio
  place default/coffee_table at 2500,2600 in Studio
  place default/floor_lamp at 400,3700 in Studio
```

Same bed using anchor positioning (auto-computes absolute position from wall geometry):
```
// Bed anchored to north wall, 30% along the wall, flush against it
place default/bed anchor north 0.3 0 in Studio
// Desk at 80% along X, 40% along Y within room bounding box
place default/desk rel 0.8,0.4 in Studio
```

## Two-Bedroom Apartment

### Structure (two-bedroom.pc)

```
plan: "Two Bedroom Apartment"

floor: "Ground Floor"
  room: "Living Room"
    wall north 0,0 6000,0 200
    wall east 6000,0 6000,4000 200
    wall south 6000,4000 0,4000 200
    wall west 0,4000 0,0 200
    door north 1500 900 left
    window south 2000 1500 1400 900
  room: Kitchen
    wall north 6000,0 10000,0 200
    wall east 10000,0 10000,4000 200
    wall south 10000,4000 6000,4000 200
    shared west from "Living Room" sourceWall=east
    door south 1500 900 right
    window north 1000 1200 1400 900
```

### Furniture (two-bedroom.pcf)

All positions within room inner bounding boxes, clear of door swings:
```
furniture:

placements:
  // Living Room — sofa arrangement against north wall (right of door)
  place default/sofa at 4200,600 in "Living Room"
  place default/coffee_table at 4200,1300 in "Living Room"
  place default/tv_console at 4200,3675 in "Living Room"
  place default/bookshelf at 400,2000 in "Living Room" rotation=90
  // Kitchen — L-shaped counter layout with dining area
  place default/counter at 8000,500 in Kitchen
  place default/fridge at 9550,500 in Kitchen
  place default/stove at 9550,1400 in Kitchen
  place default/table at 7800,2800 in Kitchen
  place default/chair at 7100,2800 in Kitchen
  place default/chair at 8500,2800 in Kitchen
```

## Open-Plan Apartment with Openings

Use `opening` on a shared wall to create an archway between rooms (no door panel). This example shows a Living Room connected to a Kitchen with a wide archway and a hallway distributing to bedrooms and bathrooms.

### Structure (family-apartment.pc excerpt — key rooms)

```
// Living Room with archway opening to Kitchen
room: "Living Room"
  wall south 0,0 7000,0 200
  wall east 7000,0 7000,4500 150
  wall north 7000,4500 0,4500 150
  wall west 0,4500 0,0 200
  door north 2500 900 right
  window south 1500 2000 2200 200
  window west 1500 1500 1400 900
  // 2m wide archway connecting to Kitchen — open-plan layout
  opening east 1200 2000
```

```
// Kitchen shares west wall with Living Room (inherits the archway)
room: Kitchen
  wall south 7000,0 13000,0 200
  wall east 13000,0 13000,4500 200
  wall north 13000,4500 7000,4500 150
  shared west from "Living Room" sourceWall=east
  door north 2500 900 left
  window south 2000 1500 1400 1200
  window east 1500 1000 1200 1200
```

```
// Hallway with split north wall — each segment matches an upper room
// so bedrooms can use shared to reference them
room: Hallway
  shared "south left" from "Living Room" sourceWall=north
  shared "south right" from Kitchen sourceWall=north
  wall east 13000,4500 13000,5700 200
  wall "north right" 13000,5700 9500,5700 150
  wall "north mid" 9500,5700 6500,5700 150
  wall "north mid-left" 6500,5700 4500,5700 150
  wall "north left" 4500,5700 0,5700 150
  wall west 0,5700 0,4500 200
  door west 150 900 left
  door "north left" 1500 800 right
  door "north mid" 1000 800 left
  door "north right" 1200 800 right
```

```
// Master Bedroom referencing hallway segment as south wall
room: "Master Bedroom"
  shared south from Hallway sourceWall="north left"
  wall east 4500,5700 4500,9000 150
  wall north 4500,9000 0,9000 200
  wall west 0,9000 0,5700 200
  door east 500 700 left
  window north 1500 1500 1400 900
```

```
// Ensuite accessed only from Master Bedroom (no hallway door)
room: Ensuite
  shared south from Hallway sourceWall="north mid-left"
  shared west from "Master Bedroom" sourceWall=east
  wall east 6500,5700 6500,9000 150
  wall north 6500,9000 4500,9000 200
  window north 500 800 1000 1200
```

## Curved Bay Window Villa

Use the `bulge` parameter to create architectural curves. Negative bulge curves outward (right/CW), positive curves inward (left/CCW). Doors, windows, and openings are fully supported on curved walls — they are positioned along the arc and oriented tangent to the curve.

### Structure (curved-villa.pc excerpt — key rooms)

```
// Living Room with curved south facade (bulge=-0.1, ~23 degree subtle arc)
room: "Living Room"
  wall south 0,0 10000,0 200 bulge=-0.1
  wall east 10000,0 10000,4000 200
  wall north 10000,4000 0,4000 150
  wall west 0,4000 0,0 200
  door north 4000 900 right
  // Sliding glass door on the curved wall
  door south 3500 2000 sliding
  // Windows on the curved facade
  window south 1000 1500 1400 900
  window south 7000 1500 1400 900
```

```
// Sunroom with curved east wall (bulge=-0.3, ~67 degree conservatory bay)
room: Sunroom
  shared south from Hallway sourceWall="north right"
  shared west from Bathroom sourceWall=east
  wall east 10000,5200 10000,8000 200 bulge=-0.3
  wall north 10000,8000 6500,8000 200
  // Tall window on the curved bay wall
  window east 500 1500 1800 400
  window north 500 1200 1400 900
```

## Artist Studio — Diagonal Walls, Semicircular Bay, Opening on Curved Wall

This example combines three advanced features in a single plan: oblique walls, a full semicircle (bulge=-1.0), and an archway on a curved wall.

### Structure (artist-studio.pc excerpt — key rooms)

```
// Pentagonal Studio — the SW corner is cut at 45 degrees by an oblique wall.
// A window is placed on the diagonal wall.
room: Studio
  wall south 2000,0 8000,0 200
  wall east 8000,0 8000,5000 200
  wall "north right" 8000,5000 2500,5000 150
  wall "north left" 2500,5000 0,5000 150
  wall west 0,5000 0,2000 200
  // Oblique wall — from and to are NOT axis-aligned (45 degree diagonal)
  wall diagonal 0,2000 2000,0 200
  door south 1500 900 left
  door "north right" 2000 900 right
  door "north left" 800 700 left
  window east 1500 2000 2200 200
  // Window on the oblique wall — elements work on diagonal walls
  window diagonal 500 1200 1400 900
```

```
// Gallery with a perfect semicircular east bay (bulge=-1.0).
// Both a window AND an opening are placed on the curved wall.
room: Gallery
  shared south from Studio sourceWall="north right"
  // bulge=-1.0 = perfect semicircle (curve protrudes by half the chord length)
  wall east 8000,5000 8000,8000 200 bulge=-1.0
  wall north 8000,8000 2500,8000 200
  wall west 2500,8000 2500,5000 150
  // Window on the semicircular wall
  window east 200 1000 2200 200
  window north 1500 1500 1400 900
  // Archway on the curved wall — terrace access through the semicircle
  opening east 1800 1000
```

### Furniture (artist-studio.pcf excerpt)

Uses previously-unseen default elements (`executive_desk`, `filing_cabinet`, `whiteboard`, `round_table`) plus a custom `easel`:

```
furniture:

elements:
  element easel "Artist Easel" tags=studio,furniture,custom width=600 depth=500 source=generated
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 500">...</svg>

placements:
  // Studio — work area
  place default/executive_desk at 6500,1500 in Studio
  place default/office_chair at 5800,1500 in Studio
  place default/filing_cabinet at 7500,1500 in Studio
  place default/whiteboard at 5000,4700 in Studio
  // Gallery — display area in the semicircular bay
  place default/round_table at 7000,6500 in Gallery
  place easel at 4000,6200 in Gallery
```

## Comprehensive Furniture Layout

A fully furnished apartment showing all furniture types, custom elements, scaling, and rotation. See `family-apartment.pcf` for the complete file.

```
furniture:

// Custom elements defined inline — used when no built-in element fits
elements:
  element plant "Potted Plant" tags=living,decoration width=400 depth=400 source=generated
    svg: <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400"><circle cx="200" cy="200" r="180" fill="#e8e8e8" stroke="black" stroke-width="5"/><circle cx="200" cy="200" r="100" fill="#d0d0d0" stroke="black" stroke-width="3"/></svg>

placements:
  // Living Room — L-sofa + coffee table setup, TV console against wall
  place default/l_sofa at 1600,2800 in "Living Room"
  place default/coffee_table at 3200,2800 in "Living Room"
  place default/tv_console at 3500,400 in "Living Room"
  place default/floor_lamp at 600,600 in "Living Room"
  // Custom element (plain ID, no "default/" prefix)
  place plant at 6600,4000 in "Living Room"

  // Kitchen — appliances along wall, dining table with chairs
  place default/counter at 8500,300 in Kitchen
  place default/stove at 10600,300 in Kitchen
  place default/fridge at 12600,400 in Kitchen
  place default/table at 10000,3000 in Kitchen
  place default/chair at 9300,3000 in Kitchen
  place default/chair at 10700,3000 in Kitchen

  // Bedroom — double bed, wardrobe rotated 90 degrees, lamp
  place default/bed at 2000,8000 in "Master Bedroom"
  place default/wardrobe at 3800,8700 in "Master Bedroom" rotation=90
  place default/floor_lamp at 500,6200 in "Master Bedroom"

  // Kids Room — single bed (65% width), desk + office chair
  place default/bed at 7500,8000 in "Kids Room" scale=65,100
  place default/desk at 8500,6400 in "Kids Room"
  place default/office_chair at 8500,7000 in "Kids Room"
  place default/bookshelf at 6900,7200 in "Kids Room"

  // Ensuite — toilet + sink near entry, shower in corner
  place default/toilet at 5000,6200 in Ensuite
  place default/sink at 5800,6000 in Ensuite
  place default/shower at 5950,8550 in Ensuite

  // Family Bathroom — full suite: bathtub + shower + toilet + sink
  place default/bathtub at 10500,8150 in "Family Bathroom"
  place default/toilet at 10000,6200 in "Family Bathroom"
  place default/sink at 11000,6000 in "Family Bathroom"
  place default/shower at 12550,8550 in "Family Bathroom"
```

## Key Patterns Demonstrated

### Structure Patterns

1. **Shared walls via coordinates**: Adjacent rooms share wall coordinates exactly (e.g., x=6000 is the boundary between Living Room and Kitchen)
2. **Shared walls with `shared`**: Kitchen references Living Room's east wall as its west wall
3. **Split wall segments**: Hallway's north wall is split into labeled segments (`"north left"`, `"north mid"`, etc.) so each upper room can reference its segment via shared
4. **Openings (archways)**: Use `opening` for wall gaps without door panels — ideal for open-plan layouts
5. **Curved walls**: Add `bulge=N` to any wall — negative values curve outward, positive inward. `0.1` = subtle, `0.3` = noticeable, `1.0` = semicircle
6. **Elements on curved walls**: Doors, windows, and openings all work on curved walls (see Artist Studio gallery archway and Curved Villa sliding door)
7. **Diagonal walls**: Use non-axis-aligned start/end coordinates with a custom direction name like `diagonal`. Windows/doors work on diagonal walls too (see Artist Studio pentagonal room)
8. **Ensuite pattern**: Room accessible only from another room (no hallway door), using shared for both south and west walls
9. **Semicircular bay**: `bulge=-1.0` creates a perfect semicircle — the curve protrudes by half the chord length (see Artist Studio gallery)

### Furniture Patterns

1. **Separate furniture file**: All furniture placements in a .pcf file with room names for organization
2. **Element references**: `default/sofa` for built-in package, plain ID `plant` for custom elements
3. **Custom elements**: Define inline in the `elements:` section with SVG, tags, and default dimensions
4. **Single bed**: Use `scale=65,100` on a double bed element
5. **Rotation**: `rotation=90` to orient wardrobe against a wall
6. **Fixture grouping**: Kitchen appliances along one wall, bathroom fixtures grouped together
7. **Room names**: Every placement has a room name for organization and validation
