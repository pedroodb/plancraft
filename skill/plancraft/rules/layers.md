# Layers

The renderer uses an implicit layer system for controlling line weights and visibility.

## Layer Definitions

| Layer | Line Weight | Contents |
|-------|------------|----------|
| `walls` | 0.5mm | Wall polygons (cut lines) with hatched fill |
| `openings` | 0.25mm | Doors (arcs + panel lines) and windows (double lines + ticks) |
| `furniture` | 0.18mm | Furniture SVG elements from .pcf placements |
| `dimensions` | 0.13mm | Dimension lines, ticks, measurement text |
| `labels` | 0.13mm | Room labels and annotations |

Layers are automatically assigned based on the element type.

## Layer Filtering

You can control which layers appear in the output using CLI flags:

```bash
# Structure only: walls + openings + labels (no furniture, no dimensions)
plancraft compile plan.pc --structure-only -o plan-structure.svg

# Full output with furniture overlay
plancraft compile plan.pc --furniture plan.pcf -o plan.svg

# Custom layer selection
plancraft compile plan.pc --furniture plan.pcf --layers walls,openings,furniture,labels -o plan.svg
```

## Two-Phase Workflow

The layer system supports a two-phase workflow:

1. **Phase 1 — Structure**: Use `--structure-only` to focus on wall geometry, door/window placements, and room layout. Iterate until the structure matches the reference perfectly.

2. **Phase 2 — Furniture**: Once the structure is verified, create a `.pcf` furniture layout file and compile with `--furniture plan.pcf` to see the full plan with furniture overlay.

This separation helps catch structural errors early without the visual noise of furniture elements. The furniture is stored in a completely separate file, making it easy to iterate on each phase independently.
