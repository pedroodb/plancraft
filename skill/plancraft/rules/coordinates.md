# Coordinate System and Units

## Coordinate System

- Origin `(0, 0)` is typically the **bottom-left** corner of the plan
- **X-axis** runs left to right
- **Y-axis** runs bottom to top (architectural convention)
- The SVG renderer flips Y automatically so the output renders correctly

## Points

All coordinates use compact `x,y` notation: `5000,4000`

## Units

**Always communicate measurements in meters** when talking to users (e.g. "the bedroom is 3.8m x 4m").

The internal .pc file format uses millimeters. Set the project unit with:

```
plan: "My Plan"
unit: mm
```

Convert meters to mm by multiplying by 1000: 3.8m = 3800, 0.9m = 900, 0.2m = 200.

## Scale

```
plan: "My Plan"
scale: 100
```

The scale is just the ratio number (100 means 1:100). It affects how stroke widths are rendered in the SVG output. At scale 100, a 0.5mm line weight becomes 50 units wide in the drawing.

## Common Dimensions

| Element | Typical Size (meters) | Internal mm |
|---------|----------------------|-------------|
| Exterior wall thickness | **0.2m** (standard) | 200 |
| Interior wall thickness | **0.15m** (standard) | 150 |
| Partition walls | 0.1m | 100 |
| Single door width | 0.8-0.9m | 800-900 |
| Double door width | 1.2-1.5m | 1200-1500 |
| Garage door width | 3-4m | 3000-4000 |
| Standard window width | 1-1.5m | 1000-1500 |
| Room: Bedroom | 3m x 4m to 4m x 5m | 3000x4000 to 4000x5000 |
| Room: Living room | 4m x 5m to 6m x 8m | 4000x5000 to 6000x8000 |
| Room: Kitchen | 2.5m x 3m to 4m x 5m | 2500x3000 to 4000x5000 |
| Room: Bathroom | 1.8m x 2.5m to 3m x 3.5m | 1800x2500 to 3000x3500 |
| Room: Hallway width | 1-1.5m | 1000-1500 |

## Wall Thickness Defaults

When creating a plan, use these standard thicknesses unless the reference image shows different values:
- **Exterior walls** (building perimeter): 0.2m (`200` in .pc file)
- **Interior walls** (between rooms): 0.15m (`150` in .pc file)
- **Partition/lightweight walls**: 0.1m (`100` in .pc file)

Do NOT use values like 120 or other non-standard thicknesses unless specifically indicated.
