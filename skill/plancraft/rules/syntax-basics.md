# Syntax Basics

## File Format

Every `.pc` file is a JSONC (JSON with Comments) document. The root is a project object containing floors, which contain rooms:

```jsonc
{
  "name": "Project Name",
  "scale": 100,
  "unit": "mm",
  "floors": [
    {
      "name": "Floor Name",
      "rooms": [
        {
          "name": "Room Name",
          "walls": [ /* ... */ ],
          "doors": [ /* ... */ ],
          "windows": [ /* ... */ ]
        }
      ]
    }
  ]
}
```

## Structure

- The root object has `"name"`, `"scale"`, `"unit"`, and `"floors"` fields
- **`"unit"` MUST always be `"mm"`** — all coordinates and measurements are in millimeters
- Each floor has `"name"` and `"rooms"`
- Each room has `"name"`, `"walls"`, and optionally `"sharedWalls"`, `"doors"`, `"windows"`, and `"openings"`

## Comments

JSONC supports `//` line comments and `/* */` block comments:

```jsonc
{
  "name": "My Plan",
  // This is a line comment
  "scale": 100,
  /* Block comments also work */
  "unit": "mm"
}
```

## Points

All coordinate points use object notation: `{"x": 6000, "y": 4000}`

## String Literals

All names are standard JSON strings: `"Living Room"`, `"Ground Floor"`.

## Numbers

Numbers are standard JSON numbers: `6000`, `1.5`, `200`.

## Optional Fields

Arrays that are empty can be omitted entirely. For example, a room with no doors simply omits the `"doors"` field.
