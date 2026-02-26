# Syntax Basics

## File Format

Every `.pc` file uses a compact, indentation-based DSL. The hierarchy is: project metadata at the top level, then floors (indent 0), rooms (indent 2), and elements like walls/doors/windows (indent 4):

```
plan: "Project Name"
scale: 100
unit: mm

floor: "Floor Name"
  room: "Room Name"
    wall north 0,0 5000,0 200
    door north 1500 900 left
    window east 1000 1200 1400 900
```

## Structure

- **`plan:`** — Project name (required)
- **`scale:`** — Scale ratio number (optional, default `100`)
- **`unit:`** — Unit of measurement (optional, default `mm`). **Must always be `mm`** — internal coordinates use millimeters (communicate in meters to users: 3.8m = 3800 in the file)
- **`floor:`** — Floor section (indent 0), contains rooms
- **`room:`** — Room section (indent 2), contains walls, doors, windows, and openings

## Comments

The DSL supports `//` line comments:

```
plan: "My Plan"
// This is a line comment
scale: 100
```

## Coordinates

All coordinate points use compact `x,y` notation: `5000,4000`

## Names

- Simple names (no spaces, no special characters) can be unquoted: `Studio`, `Kitchen`, `Hallway`
- Names with spaces or special characters use double quotes: `"Living Room"`, `"Ground Floor"`, `"north left"`
- Wall direction names follow the same rule: `north` (unquoted), `"step east"` (quoted)

## Numbers

Numbers are plain integers or decimals: `6000`, `1.5`, `200`.

## Indentation

Indentation is significant and defines the hierarchy:
- **Indent 0** — `floor:` declarations
- **Indent 2** (2 spaces) — `room:` declarations within a floor
- **Indent 4** (4 spaces) — `wall`, `door`, `window`, `opening` within a room

## Walls

```
wall <direction> <x1>,<y1> <x2>,<y2> <thickness> [bulge=<n>]
```

Example:
```
wall north 0,0 5000,0 200
wall east 5000,0 5000,4000 200 bulge=-0.3
```

## Doors

```
door <wall> <offset> <width> <swing>
```

Where `swing` is `left`, `right`, or `sliding`. Example:
```
door north 1500 900 left
door south 500 1200 sliding
```

## Windows

```
window <wall> <offset> <width> <height> <sill>
```

Example:
```
window east 1000 1200 1400 900
```

## Openings

```
opening <wall> <offset> <width>
```

Example:
```
opening east 1200 2000
```

## Optional Elements

Rooms with no doors, windows, or openings simply omit those lines. Only walls are required for a room.

## Blank Lines

Blank lines are ignored and can be used freely for readability.
