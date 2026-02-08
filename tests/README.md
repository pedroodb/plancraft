# Plancraft Agent Test Suite

Automated testing framework for the Plancraft AI agent. Tests the agent's ability to generate floor plans from text descriptions, image references, long multi-step conversations, and modifications to existing plans.

## Architecture

```
tests/
  definitions.ts         All 24 test case definitions
  agent.ts               Reusable agent executor (calls OpenAI API, GPT-5.2)
  evaluator.ts           Programmatic scoring (compilation, metrics)
  judge.ts               LLM judge scoring (GPT-5.2 vision + conversation coherence)
  runner.ts              CLI entry point: runs tests and generates reports
  report.ts              Aggregates results into markdown/JSON reports
  generate-images.ts     One-time gpt-image-1 reference image generation
  fixtures/              Reference images (committed to git)
  results/               Test outputs (gitignored)
```

## Prerequisites

1. **OpenAI API Key**: Set in `packages/web/.env.local` or as `OPENAI_API_KEY` environment variable
2. **Dependencies installed**: Run `npm install` from the repo root
3. **Reference images generated**: Run the image generation script (one-time setup)

## Quick Start

```bash
# 1. Generate reference images (one-time)
npx tsx tests/generate-images.ts

# 2. Run all tests (parallel for speed)
npx tsx tests/runner.ts --parallel 5

# 3. View the report
cat tests/results/report.md
```

## Running Tests

### Run all 24 tests

```bash
npx tsx tests/runner.ts
```

### Run specific tests by ID

```bash
npx tsx tests/runner.ts T01 T07 T15
```

### Run by category

```bash
npx tsx tests/runner.ts --category text         # Text-only tests (T01-T14)
npx tsx tests/runner.ts --category image        # Image-based tests (T15-T18)
npx tsx tests/runner.ts --category multi-step   # Multi-step / long conversation tests (T19, T21-T24)
npx tsx tests/runner.ts --category modification # Modification tests (T20)
```

### Skip LLM judge (faster, structural evaluation only)

```bash
npx tsx tests/runner.ts --no-judge
```

### Run tests in parallel (recommended)

```bash
npx tsx tests/runner.ts --parallel 5
```

## Test Cases

### Category A: Text-only, specific requirements (T01-T06)

| ID  | Name                   | Description                                                   |
|:----|:-----------------------|:--------------------------------------------------------------|
| T01 | Simple Studio          | 5m x 4m studio with one door and window                       |
| T02 | Bathroom Layout        | 2.5m x 2.2m bathroom with toilet, sink, shower                |
| T03 | Exact Dimensions       | Room with precise mm dimensions and opening placements         |
| T04 | Sunroom with Windows   | 6m x 4m room with windows on three walls                      |
| T05 | Furnished Bedroom      | 4m x 5m bedroom with bed, wardrobe, desk, chair               |
| T06 | Kitchen with Appliances| 3.5m x 3m kitchen with counter, stove, sink, fridge            |

### Category B: Text-only, multi-room (T07-T11)

| ID  | Name                 | Description                                                     |
|:----|:---------------------|:----------------------------------------------------------------|
| T07 | Two-Bedroom Apartment| 5-6 rooms, ~10m x 8m footprint                                  |
| T08 | House with Garage    | House with double garage and 5-6 rooms                           |
| T09 | Office Space         | 6-room office layout, ~100m²                                     |
| T10 | L-Shaped House       | L-shaped layout with 5 rooms                                     |
| T11 | Open Plan Living     | Open-plan area with kitchen and bathroom                          |

### Category C: Vague / creative requests (T12-T14)

| ID  | Name                  | Description                                              |
|:----|:----------------------|:---------------------------------------------------------|
| T12 | Vague Couple Apartment| "Cozy apartment for a young couple"                      |
| T13 | Cafe Layout           | Neighborhood cafe with seating, kitchen, restroom         |
| T14 | Tiny House            | ~25m² tiny house with all essentials                      |

### Category D: Image-based replication (T15-T18)

| ID  | Name                          | Description                                           |
|:----|:------------------------------|:------------------------------------------------------|
| T15 | Blueprint Replication         | gpt-image-1 generated 2-room blueprint with dimensions |
| T16 | Photo as Loose Reference      | Apartment photo used as inspiration, not exact copy     |
| T17 | Incomplete Sketch + Verbal    | Hand-drawn sketch completed with verbal instructions    |
| T18 | Real Plan (Tolosa)            | Real architectural floor plan from examples/tolosa.png  |

### Category E: Multi-step / modification (T19-T20)

| ID  | Name                | Description                                                |
|:----|:--------------------|:-----------------------------------------------------------|
| T19 | Build Then Regret   | Three-step build with mid-process change of mind            |
| T20 | Modify Existing Plan| Add bathroom to existing studio-apartment.pc                |

### Category F: Long-running conversations (T21-T24)

| ID  | Name                          | Messages | Description                                           |
|:----|:------------------------------|:---------|:------------------------------------------------------|
| T21 | Room-by-Room House Design     | 8        | Family house built room by room with a final resize    |
| T22 | Vague to Specific Refinement  | 8        | From "I need a place to live" to specific apartment    |
| T23 | Iterative Dimension Tweaking  | 8        | Single room tweaked then split into two rooms          |
| T24 | Design a Medical Clinic       | 6        | Medical clinic with 8+ rooms built incrementally       |

## Evaluation

### Programmatic Scoring (0-100)

Weighted structural checks:

| Check              | Weight | Description                          |
|:-------------------|:-------|:-------------------------------------|
| Compilation        | 30     | Plan compiles without errors          |
| Room count         | 20     | Matches expected room count           |
| Area               | 15     | Total area within tolerance           |
| Envelope           | 15     | Building envelope within tolerance    |
| Required rooms     | 10     | Named rooms are present               |
| Required furniture | 10     | Furniture count meets expectations    |

### LLM Judge Scoring (0-100)

GPT-5.2 evaluates on 4-6 criteria (1-5 scale each, averaged × 20):

- **Specification adherence**: Does the FINAL plan match the cumulative specification?
- **Spatial layout**: Are rooms logically arranged?
- **Proportions**: Are room sizes reasonable?
- **Completeness**: Are all requested elements present?
- **Visual similarity** (image tests only): How close to the reference?
- **Conversation coherence** (multi-step tests only): Were all user requests maintained?

### Agent Quality Feedback Loops

The agent executor enforces quality through automated checks:
- **Minimum room sizes**: Bathroom ≥ 3m², Bedroom ≥ 8m², Kitchen ≥ 6m², Living ≥ 12m²
- **Door accessibility**: Every room must have at least one door
- **Windows in habitable rooms**: Bedrooms, living rooms, kitchens, and offices should have windows
- **Hallway proportion**: Hallways should use ≤ 20% of total area
- **Tiny plan detection**: Relaxed constraints for plans under 35m²

### Multi-Turn State Tracking

For long-running conversation tests, the agent receives:
- A **cumulative requirements summary** of all previous user messages
- A **current plan state** with room-by-room metrics
- **Explicit instructions** to preserve existing rooms when making changes

### Pass Criteria

A test passes when:
- Structural score >= 70, AND
- Judge score >= 60 (if judge is enabled)

## Output Structure

Each test produces files in `tests/results/{testId}/`:

```
tests/results/
  T01/
    plan.pc              Generated floor plan source
    output.svg           Rendered SVG
    conversation.json    Conversation log (truncated)
    result.json          Detailed evaluation results
  ...
  report.md              Aggregate markdown report
  report.json            Machine-readable results
```

## Iteration Workflow

1. Run the test suite: `npx tsx tests/runner.ts --parallel 5`
2. Review `tests/results/report.md` for failures
3. Analyze failure patterns (undersized rooms, missing doors, lost state)
4. Improve agent rules in `tests/agent.ts` and `packages/web/src/app/api/chat/system-prompt.ts`
5. Re-run failing tests: `npx tsx tests/runner.ts T01 T03 ...`
6. Repeat until all tests pass

## Known Variance

LLM-based tests are inherently non-deterministic. Some tests (especially long-conversation ones) may pass on one run and fail on another. Expected steady-state pass rate is **~90-95%** (22-23 out of 24 tests).
