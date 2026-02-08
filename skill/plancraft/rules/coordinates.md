# Coordinate System and Units

## Coordinate System

- Origin `(0, 0)` is typically the **bottom-left** corner of the plan
- **X-axis** runs left to right
- **Y-axis** runs bottom to top (architectural convention)
- The SVG renderer flips Y automatically so the output renders correctly

## Points

All coordinates use object notation: `{"x": N, "y": N}`

## Units

Set the project unit with:

```jsonc
{
  "name": "My Plan",
  "unit": "mm"
}
```

Supported units: `"mm"` (default), `"cm"`, `"m"`, `"ft"`, `"in"`.

All coordinates and measurements use the chosen unit. Millimeters are recommended for precision.

## Scale

```jsonc
{
  "name": "My Plan",
  "scale": 100
}
```

The scale is just the ratio number (100 means 1:100). It affects how stroke widths are rendered in the SVG output. At scale 100, a 0.5mm line weight becomes 50 units wide in the drawing.

## Common Dimensions (in mm)

| Element | Typical Size |
|---------|-------------|
| Exterior wall thickness | **200** (standard, use this unless the reference shows otherwise) |
| Interior wall thickness | **150** (standard, use this unless the reference shows otherwise) |
| Partition walls | 100 |
| Single door width | 800-900 |
| Double door width | 1200-1500 |
| Garage door width | 3000-4000 |
| Standard window width | 1000-1500 |
| Room: Bedroom | 3000x4000 to 4000x5000 |
| Room: Living room | 4000x5000 to 6000x8000 |
| Room: Kitchen | 2500x3000 to 4000x5000 |
| Room: Bathroom | 1800x2500 to 3000x3500 |
| Room: Hallway width | 1000-1500 |

## Wall Thickness Defaults

When creating a plan, use these standard thicknesses unless the reference image shows different values:
- **Exterior walls** (building perimeter): `200` mm
- **Interior walls** (between rooms): `150` mm
- **Partition/lightweight walls**: `100` mm

Do NOT use values like 120 or other non-standard thicknesses unless specifically indicated.
