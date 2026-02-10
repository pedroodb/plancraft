# Coordinate System and Units

## Coordinate System

- Origin `(0, 0)` is typically the **bottom-left** corner of the plan
- **X-axis** runs left to right
- **Y-axis** runs bottom to top (architectural convention)
- The SVG renderer flips Y automatically so the output renders correctly

## Points

All coordinates use object notation: `{"x": N, "y": N}`

## Units

**Always communicate measurements in meters** when talking to users (e.g. "the bedroom is 3.8m × 4m").

The internal .pc file format uses millimeters. Set the project unit with:

```jsonc
{
  "name": "My Plan",
  "unit": "mm"
}
```

Convert meters to mm by multiplying by 1000: 3.8m → 3800, 0.9m → 900, 0.2m → 200.

## Scale

```jsonc
{
  "name": "My Plan",
  "scale": 100
}
```

The scale is just the ratio number (100 means 1:100). It affects how stroke widths are rendered in the SVG output. At scale 100, a 0.5mm line weight becomes 50 units wide in the drawing.

## Common Dimensions

| Element | Typical Size (meters) | Internal mm |
|---------|----------------------|-------------|
| Exterior wall thickness | **0.2m** (standard) | 200 |
| Interior wall thickness | **0.15m** (standard) | 150 |
| Partition walls | 0.1m | 100 |
| Single door width | 0.8–0.9m | 800–900 |
| Double door width | 1.2–1.5m | 1200–1500 |
| Garage door width | 3–4m | 3000–4000 |
| Standard window width | 1–1.5m | 1000–1500 |
| Room: Bedroom | 3m×4m to 4m×5m | 3000×4000 to 4000×5000 |
| Room: Living room | 4m×5m to 6m×8m | 4000×5000 to 6000×8000 |
| Room: Kitchen | 2.5m×3m to 4m×5m | 2500×3000 to 4000×5000 |
| Room: Bathroom | 1.8m×2.5m to 3m×3.5m | 1800×2500 to 3000×3500 |
| Room: Hallway width | 1–1.5m | 1000–1500 |

## Wall Thickness Defaults

When creating a plan, use these standard thicknesses unless the reference image shows different values:
- **Exterior walls** (building perimeter): 0.2m (`200` in .pc file)
- **Interior walls** (between rooms): 0.15m (`150` in .pc file)
- **Partition/lightweight walls**: 0.1m (`100` in .pc file)

Do NOT use values like 120 or other non-standard thicknesses unless specifically indicated.
