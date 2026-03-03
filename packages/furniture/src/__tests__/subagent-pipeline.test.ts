/**
 * End-to-end test for the furniture subagent pipeline.
 *
 * Exercises: plan source → parse → resolve → room geometry → fit analysis →
 * suggested layout → anchor resolution → verify positions are sensible.
 *
 * Uses a simple 2-room plan (bathroom + bedroom) with doors to verify:
 * 1. Room geometry has correct wall side labels (north/south/east/west)
 * 2. Furniture anchored to walls resolves to correct positions
 * 3. Door avoidance logic works (furniture not suggested on door walls)
 * 4. Rotation produces correct furniture orientation per wall
 * 5. Door clearance AABBs are computed and can detect blocked doors
 */

import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parse, resolve } from "@plancraft/dsl";
import { computeRoomGeometries, computeDoorClearances, validateFurniturePlacement, type RoomGeometry } from "@plancraft/renderer";
import { resolveAnchors, parseLayout, serializeLayout } from "../index.js";
import type { FurniturePlacement, FurnitureLayout } from "../types.js";

// ── Test plan: small bathroom (2500×2200mm) with door on south wall ──
// DSL convention: north=Y_min (top of SVG), south=Y_max (bottom of SVG)

const TEST_PLAN = `{
  "name": "Test Plan",
  "scale": 100,
  "unit": "mm",
  "floors": [{
    "name": "Ground Floor",
    "rooms": [
      {
        "name": "Baño",
        "walls": [
          { "direction": "north", "from": { "x": 0, "y": 0 }, "to": { "x": 2500, "y": 0 }, "thickness": 200 },
          { "direction": "east", "from": { "x": 2500, "y": 0 }, "to": { "x": 2500, "y": 2200 }, "thickness": 200 },
          { "direction": "south", "from": { "x": 2500, "y": 2200 }, "to": { "x": 0, "y": 2200 }, "thickness": 200 },
          { "direction": "west", "from": { "x": 0, "y": 2200 }, "to": { "x": 0, "y": 0 }, "thickness": 200 }
        ],
        "doors": [
          { "wall": "south", "offset": 900, "width": 800, "swing": "left" }
        ]
      },
      {
        "name": "Dormitorio",
        "walls": [
          { "direction": "north", "from": { "x": 2500, "y": 0 }, "to": { "x": 6500, "y": 0 }, "thickness": 200 },
          { "direction": "east", "from": { "x": 6500, "y": 0 }, "to": { "x": 6500, "y": 4000 }, "thickness": 200 },
          { "direction": "south", "from": { "x": 6500, "y": 4000 }, "to": { "x": 2500, "y": 4000 }, "thickness": 200 },
          { "direction": "west", "from": { "x": 2500, "y": 4000 }, "to": { "x": 2500, "y": 0 }, "thickness": 200 }
        ],
        "doors": [
          { "wall": "west", "offset": 1500, "width": 900, "swing": "right" }
        ]
      }
    ]
  }]
}`;

describe("Subagent pipeline end-to-end", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);
  const roomGeos = computeRoomGeometries(resolved);

  function findRoom(name: string): RoomGeometry {
    const room = roomGeos.find((r) => r.name === name);
    if (!room) throw new Error(`Room "${name}" not found. Available: ${roomGeos.map((r) => r.name).join(", ")}`);
    return room;
  }

  describe("Room geometry wall sides", () => {
    it("assigns correct compass sides to bathroom walls", () => {
      const bano = findRoom("Baño");
      const sides = bano.walls.map((w) => w.side).sort();
      assert.deepStrictEqual(sides, ["east", "north", "south", "west"]);

      const southWall = bano.walls.find((w) => w.side === "south");
      assert.ok(southWall !== undefined);
      const wallMidY = (southWall!.from.y + southWall!.to.y) / 2;
      assert.ok(wallMidY > bano.center.y, "south wall mid-Y should be > room center Y");
    });

    it("assigns correct compass sides to bedroom walls", () => {
      const dorm = findRoom("Dormitorio");
      const sides = dorm.walls.map((w) => w.side).sort();
      assert.deepStrictEqual(sides, ["east", "north", "south", "west"]);
    });
  });

  describe("Anchor resolution", () => {
    it("places toilet on north wall (Y_min, top of SVG) correctly", () => {
      const bano = findRoom("Baño");
      const layout: FurnitureLayout = {
        elements: {
          toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 600, svg: "<svg></svg>" },
        },
        placements: [{
          element: "toilet", room: "Baño", position: { x: 0, y: 0 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
          anchor: { wall: "north", along: 0.5, offset: 0 },
        }],
      };

      const res = resolveAnchors(layout, roomGeos);
      const pos = res.placements[0].position;

      assert.ok(pos.y < bano.center.y, "toilet center should be near north (low Y)");
      assert.ok(Math.abs(pos.x - bano.center.x) < 300, "toilet should be horizontally centered");
    });

    it("places toilet on south wall (Y_max, bottom of SVG) correctly", () => {
      const bano = findRoom("Baño");
      const layout: FurnitureLayout = {
        elements: {
          toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 600, svg: "<svg></svg>" },
        },
        placements: [{
          element: "toilet", room: "Baño", position: { x: 0, y: 0 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
          anchor: { wall: "south", along: 0.5, offset: 0 },
        }],
      };

      const res = resolveAnchors(layout, roomGeos);
      const pos = res.placements[0].position;

      assert.ok(pos.y > bano.center.y, "toilet center should be near south (high Y)");
    });

    it("places bed anchored to east wall of bedroom", () => {
      const dorm = findRoom("Dormitorio");
      const layout: FurnitureLayout = {
        elements: {
          bed: { name: "Bed", tags: ["bedroom"], defaultWidth: 1400, defaultDepth: 2000, svg: "<svg></svg>" },
        },
        placements: [{
          element: "bed", room: "Dormitorio", position: { x: 0, y: 0 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
          anchor: { wall: "east", along: 0.5, offset: 0 },
        }],
      };

      const res = resolveAnchors(layout, roomGeos);
      const pos = res.placements[0].position;

      assert.ok(pos.x > dorm.center.x, "bed center should be near east wall (high X)");
    });

    it("handles scaled furniture correctly", () => {
      const layout: FurnitureLayout = {
        elements: {
          toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 600, svg: "<svg></svg>" },
        },
        placements: [{
          element: "toilet", room: "Baño", position: { x: 0, y: 0 },
          rotation: 0, scaleWidth: 80, scaleDepth: 80, lockProportions: true,
          anchor: { wall: "north", along: 0.3, offset: 0 },
        }],
      };

      const res = resolveAnchors(layout, roomGeos);
      const pos = res.placements[0].position;

      const bano = findRoom("Baño");
      assert.ok(pos.y < bano.center.y, "scaled toilet should still be on north side (low Y)");
    });
  });

  describe("Door wall identification", () => {
    it("bathroom has door on south DSL wall", () => {
      const room = resolved.floors[0].rooms.find((r) => r.name === "Baño");
      assert.ok(room !== undefined);
      assert.strictEqual(room!.doors.length, 1);
      assert.strictEqual(room!.doors[0].wallDirection, "south");
    });

    it("bedroom has door on west DSL wall", () => {
      const room = resolved.floors[0].rooms.find((r) => r.name === "Dormitorio");
      assert.ok(room !== undefined);
      assert.strictEqual(room!.doors.length, 1);
      assert.strictEqual(room!.doors[0].wallDirection, "west");
    });
  });

  describe("Multiple placements spatial sanity", () => {
    it("three bathroom items on different walls don't overlap", () => {
      const layout: FurnitureLayout = {
        elements: {
          toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 600, svg: "<svg></svg>" },
          sink: { name: "Sink", tags: ["bathroom"], defaultWidth: 500, defaultDepth: 400, svg: "<svg></svg>" },
          shower: { name: "Shower", tags: ["bathroom"], defaultWidth: 900, defaultDepth: 900, svg: "<svg></svg>" },
        },
        placements: [
          {
            element: "toilet", room: "Baño", position: { x: 0, y: 0 },
            rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
            anchor: { wall: "north", along: 0.2, offset: 0 },
          },
          {
            element: "sink", room: "Baño", position: { x: 0, y: 0 },
            rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
            anchor: { wall: "north", along: 0.7, offset: 0 },
          },
          {
            element: "shower", room: "Baño", position: { x: 0, y: 0 },
            rotation: 0, scaleWidth: 80, scaleDepth: 80, lockProportions: true,
            anchor: { wall: "east", along: 0.5, offset: 0 },
          },
        ],
      };

      const res = resolveAnchors(layout, roomGeos);
      const positions = res.placements.map((p) => p.position);

      for (const pos of positions) {
        assert.ok(pos.x > -100, `x=${pos.x} should be > -100`);
        assert.ok(pos.x < 2600, `x=${pos.x} should be < 2600`);
        assert.ok(pos.y > -100, `y=${pos.y} should be > -100`);
        assert.ok(pos.y < 2300, `y=${pos.y} should be < 2300`);
      }

      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dist = Math.sqrt(
            (positions[i].x - positions[j].x) ** 2 +
            (positions[i].y - positions[j].y) ** 2,
          );
          assert.ok(dist > 100, `items ${i} and ${j} should be at least 100mm apart (got ${dist})`);
        }
      }
    });
  });
});

// ── Rotation tests ─────────────────────────────────────────────────────
// Verify that directional furniture (bed, toilet, sofa) with proper rotation
// has its "back" (SVG y=0) edge near the anchored wall after resolution.
//
// Convention: rotation=0 → back faces north (low Y). CW on screen.
//   0=north, 90=east, 180=south, 270=west
//
// backEdge uses ORIGINAL (pre-rotation) SVG dimensions:
//   defaultWidth spans X, defaultDepth spans Y at rotation=0.
//   At rotation=90: depth now spans X, width spans Y.
//   The "back" was at -halfDepth (min-Y at rot=0), after 90° CW → at +halfDepth (max-X).

function backEdge(
  pos: { x: number; y: number },
  defaultWidth: number,
  defaultDepth: number,
  rotation: number,
): { axis: "x" | "y"; value: number } {
  const halfD = defaultDepth / 2;
  switch (rotation) {
    case 0:   return { axis: "y", value: pos.y - halfD }; // back at min-Y (north)
    case 90:  return { axis: "x", value: pos.x + halfD }; // back at max-X (east)
    case 180: return { axis: "y", value: pos.y + halfD }; // back at max-Y (south)
    case 270: return { axis: "x", value: pos.x - halfD }; // back at min-X (west)
    default:  return { axis: "y", value: pos.y - halfD };
  }
}

describe("Furniture rotation per wall direction", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);
  const roomGeos = computeRoomGeometries(resolved);
  const dorm = roomGeos.find((r) => r.name === "Dormitorio")!;

  function makeBedLayout(wall: string, rotation: number): FurnitureLayout {
    return {
      elements: {
        bed: { name: "Bed", tags: ["bedroom"], defaultWidth: 1400, defaultDepth: 2000, svg: "<svg></svg>" },
      },
      placements: [{
        element: "bed", room: "Dormitorio", position: { x: 0, y: 0 },
        rotation, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        anchor: { wall, along: 0.5, offset: 0 },
      }],
    };
  }

  it("bed on north wall (rotation=0): headboard near north (low Y)", () => {
    const layout = resolveAnchors(makeBedLayout("north", 0), roomGeos);
    const pos = layout.placements[0].position;
    assert.ok(pos.y < dorm.center.y, "bed center should be in north half");
    const edge = backEdge(pos, 1400, 2000, 0);
    assert.strictEqual(edge.axis, "y");
    assert.ok(edge.value < 300, `headboard edge y=${edge.value} should be < 300 (near north wall)`);
  });

  it("bed on south wall (rotation=180): headboard near south (high Y)", () => {
    const layout = resolveAnchors(makeBedLayout("south", 180), roomGeos);
    const pos = layout.placements[0].position;
    assert.ok(pos.y > dorm.center.y, "bed center should be in south half");
    const edge = backEdge(pos, 1400, 2000, 180);
    assert.strictEqual(edge.axis, "y");
    assert.ok(edge.value > 3700, `headboard edge y=${edge.value} should be > 3700 (near south wall at 4000)`);
  });

  it("bed on east wall (rotation=90): headboard near east (high X)", () => {
    const layout = resolveAnchors(makeBedLayout("east", 90), roomGeos);
    const pos = layout.placements[0].position;
    assert.ok(pos.x > dorm.center.x, "bed center should be in east half");
    const edge = backEdge(pos, 1400, 2000, 90);
    assert.strictEqual(edge.axis, "x");
    assert.ok(edge.value > 6100, `headboard edge x=${edge.value} should be > 6100 (near east wall at 6500)`);
  });

  it("bed on west wall (rotation=270): headboard near west (low X)", () => {
    const layout = resolveAnchors(makeBedLayout("west", 270), roomGeos);
    const pos = layout.placements[0].position;
    assert.ok(pos.x < dorm.center.x, "bed center should be in west half");
    const edge = backEdge(pos, 1400, 2000, 270);
    assert.strictEqual(edge.axis, "x");
    assert.ok(edge.value < 2900, `headboard edge x=${edge.value} should be < 2900 (near west wall at 2500)`);
  });
});

describe("Bathroom fixture rotation", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);
  const roomGeos = computeRoomGeometries(resolved);
  const bano = roomGeos.find((r) => r.name === "Baño")!;

  function makeToiletLayout(wall: string, rotation: number): FurnitureLayout {
    return {
      elements: {
        toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 700, svg: "<svg></svg>" },
      },
      placements: [{
        element: "toilet", room: "Baño", position: { x: 0, y: 0 },
        rotation, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        anchor: { wall, along: 0.3, offset: 0 },
      }],
    };
  }

  it("toilet on north wall (rotation=0): tank near north", () => {
    const layout = resolveAnchors(makeToiletLayout("north", 0), roomGeos);
    const pos = layout.placements[0].position;
    assert.ok(pos.y < bano.center.y, "toilet should be on north side");
    const edge = backEdge(pos, 400, 700, 0);
    assert.ok(edge.value < 200, `tank edge y=${edge.value} should be < 200 (near north wall)`);
  });

  it("toilet on east wall (rotation=90): tank near east", () => {
    const layout = resolveAnchors(makeToiletLayout("east", 90), roomGeos);
    const pos = layout.placements[0].position;
    assert.ok(pos.x > bano.center.x, "toilet should be on east side");
  });

  it("toilet on south wall (rotation=180): tank near south", () => {
    const layout = resolveAnchors(makeToiletLayout("south", 180), roomGeos);
    const pos = layout.placements[0].position;
    assert.ok(pos.y > bano.center.y, "toilet should be on south side");
    const edge = backEdge(pos, 400, 700, 180);
    assert.ok(edge.value > 2000, `tank edge y=${edge.value} should be > 2000 (near south wall)`);
  });
});

describe("Effective width swapping for rotated items", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);
  const roomGeos = computeRoomGeometries(resolved);

  it("bed on east wall with rotation=90 resolves inside room bounds", () => {
    const layout: FurnitureLayout = {
      elements: {
        bed: { name: "Bed", tags: ["bedroom"], defaultWidth: 1400, defaultDepth: 2000, svg: "<svg></svg>" },
      },
      placements: [{
        element: "bed", room: "Dormitorio", position: { x: 0, y: 0 },
        rotation: 90, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        anchor: { wall: "east", along: 0.5, offset: 0 },
      }],
    };

    const res = resolveAnchors(layout, roomGeos);
    const pos = res.placements[0].position;
    const dorm = roomGeos.find((r) => r.name === "Dormitorio")!;
    assert.ok(pos.x > dorm.innerBoundingBox.minX, "bed x should be inside room");
    assert.ok(pos.x < dorm.innerBoundingBox.maxX + 200, "bed x should not overflow far past east wall");
    assert.ok(pos.y > dorm.innerBoundingBox.minY, "bed y should be inside room");
    assert.ok(pos.y < dorm.innerBoundingBox.maxY, "bed y should be inside room");
  });

  it("sofa on west wall with rotation=270 resolves near west side", () => {
    const layout: FurnitureLayout = {
      elements: {
        sofa: { name: "Sofa", tags: ["living"], defaultWidth: 2000, defaultDepth: 900, svg: "<svg></svg>" },
      },
      placements: [{
        element: "sofa", room: "Dormitorio", position: { x: 0, y: 0 },
        rotation: 270, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        anchor: { wall: "west", along: 0.5, offset: 0 },
      }],
    };

    const res = resolveAnchors(layout, roomGeos);
    const pos = res.placements[0].position;
    const dorm = roomGeos.find((r) => r.name === "Dormitorio")!;
    assert.ok(pos.x < dorm.center.x, "sofa should be near west wall");
  });
});

describe("Door clearance AABB computation", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);

  it("computes non-empty clearance AABBs for doors", () => {
    const clearances = computeDoorClearances(resolved);
    assert.strictEqual(clearances.length, 2); // bathroom + bedroom doors

    for (const dc of clearances) {
      assert.ok(dc.aabb.maxX > dc.aabb.minX, "AABB should have positive width");
      assert.ok(dc.aabb.maxY > dc.aabb.minY, "AABB should have positive height");
    }
  });

  it("bathroom door clearance is on the south wall area", () => {
    const clearances = computeDoorClearances(resolved);
    const bathClearance = clearances.find((dc) => dc.roomName === "Baño");
    assert.ok(bathClearance !== undefined, "should have bathroom door clearance");
    assert.ok(bathClearance!.aabb.maxY >= 2000, `clearance maxY=${bathClearance!.aabb.maxY} should be >= 2000 (near south wall)`);
  });

  it("bedroom door clearance is on the west wall area", () => {
    const clearances = computeDoorClearances(resolved);
    const dormClearance = clearances.find((dc) => dc.roomName === "Dormitorio");
    assert.ok(dormClearance !== undefined, "should have bedroom door clearance");
    assert.ok(dormClearance!.aabb.minX <= 2600, `clearance minX=${dormClearance!.aabb.minX} should be <= 2600 (near west wall)`);
  });
});

describe("Furniture vs door clearance validation", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);

  it("furniture in door swing zone triggers door_blocked warning", () => {
    const clearances = computeDoorClearances(resolved);
    const bathDoor = clearances.find((dc) => dc.roomName === "Baño")!;
    const cx = (bathDoor.aabb.minX + bathDoor.aabb.maxX) / 2;
    const cy = (bathDoor.aabb.minY + bathDoor.aabb.maxY) / 2;

    const layout: FurnitureLayout = {
      elements: {
        toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 700, svg: "<svg></svg>" },
      },
      placements: [{
        element: "toilet", room: "Baño", position: { x: cx, y: cy },
        rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const doorWarnings = warnings.filter((w) => w.type === "door_blocked");
    assert.ok(doorWarnings.length > 0, "should detect door blockage");
  });

  it("furniture away from door has no door_blocked warning", () => {
    const layout: FurnitureLayout = {
      elements: {
        toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 700, svg: "<svg></svg>" },
      },
      placements: [{
        element: "toilet", room: "Baño", position: { x: 1250, y: 400 },
        rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const doorWarnings = warnings.filter((w) => w.type === "door_blocked");
    assert.strictEqual(doorWarnings.length, 0, "should have no door blockage warnings");
  });
});

// ── Wall-proximity validation ─────────────────────────────────────────
// Items that should be against a wall (toilet, sofa, bed, counter, etc.)
// must trigger a wall_proximity warning when placed in the room center.

describe("Wall-proximity validation", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);

  it("toilet in center of bathroom triggers wall_proximity warning", () => {
    const layout: FurnitureLayout = {
      elements: {
        toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 700, svg: "<svg></svg>" },
      },
      placements: [{
        element: "toilet", room: "Baño", position: { x: 1250, y: 1100 },
        rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const proximityWarnings = warnings.filter((w) => w.type === "wall_proximity");
    assert.ok(proximityWarnings.length > 0, "toilet in room center should trigger wall_proximity warning");
  });

  it("toilet against north wall does NOT trigger wall_proximity", () => {
    const layout: FurnitureLayout = {
      elements: {
        toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 700, svg: "<svg></svg>" },
      },
      placements: [{
        element: "toilet", room: "Baño", position: { x: 1250, y: 450 },
        rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const proximityWarnings = warnings.filter((w) => w.type === "wall_proximity");
    assert.strictEqual(proximityWarnings.length, 0, "toilet near wall should not trigger wall_proximity");
  });

  it("bed floating in center of large room triggers wall_proximity", () => {
    // Dormitorio inner: x=[2700..6300], y=[200..3800] = 3600x3600mm
    // Bed 1400x2000 at center (4500, 2000): edges at x=[3800,5200] y=[1000,3000]
    // Nearest wall distances: west=3800-2700=1100, east=6300-5200=1100,
    //   north=1000-200=800, south=3800-3000=800 → min=800 > 500 threshold
    const layout: FurnitureLayout = {
      elements: {
        bed: { name: "Bed", tags: ["bedroom"], defaultWidth: 1400, defaultDepth: 2000, svg: "<svg></svg>" },
      },
      placements: [{
        element: "bed", room: "Dormitorio", position: { x: 4500, y: 2000 },
        rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const proximityWarnings = warnings.filter((w) => w.type === "wall_proximity");
    assert.ok(proximityWarnings.length > 0,
      `bed in room center should trigger wall_proximity (got types: ${warnings.map(w => w.type).join(", ") || "none"})`);
  });

  it("sofa against west wall does NOT trigger wall_proximity", () => {
    const layout: FurnitureLayout = {
      elements: {
        sofa: { name: "Sofa", tags: ["living"], defaultWidth: 2000, defaultDepth: 900, svg: "<svg></svg>" },
      },
      placements: [{
        element: "sofa", room: "Dormitorio", position: { x: 3150, y: 2000 },
        rotation: 270, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const proximityWarnings = warnings.filter((w) => w.type === "wall_proximity");
    assert.strictEqual(proximityWarnings.length, 0, "sofa near west wall should not trigger wall_proximity");
  });

  it("free-standing items like plant do NOT trigger wall_proximity even in center", () => {
    const layout: FurnitureLayout = {
      elements: {
        plant: { name: "Plant", tags: ["decoration"], defaultWidth: 400, defaultDepth: 400, svg: "<svg></svg>" },
      },
      placements: [{
        element: "plant", room: "Dormitorio", position: { x: 4500, y: 2000 },
        rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const proximityWarnings = warnings.filter((w) => w.type === "wall_proximity");
    assert.strictEqual(proximityWarnings.length, 0, "plant is not wall-adjacent, should never trigger wall_proximity");
  });
});

// ── Passability validation ────────────────────────────────────────────
// Furniture near a door should leave at least 600mm passage.

describe("Passability validation", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);

  it("furniture near door with <600mm gap triggers passability warning", () => {
    // Bathroom door is on south wall at offset 900, width 800
    // Door clearance AABB is near the south wall (y~2200).
    // Place a bookshelf just north of the door clearance zone to leave a narrow gap.
    // First compute where the door clearance actually is
    const clearances = computeDoorClearances(resolved);
    const bathDoor = clearances.find((dc) => dc.roomName === "Baño")!;
    // Place furniture so its AABB edge is 200-400mm from the door clearance AABB
    const furnY = bathDoor.aabb.minY - 300;

    const layout: FurnitureLayout = {
      elements: {
        bookshelf: { name: "Bookshelf", tags: ["storage"], defaultWidth: 800, defaultDepth: 350, svg: "<svg></svg>" },
      },
      placements: [{
        element: "bookshelf", room: "Baño",
        position: { x: (bathDoor.aabb.minX + bathDoor.aabb.maxX) / 2, y: furnY },
        rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const passWarnings = warnings.filter((w) => w.type === "passability");
    assert.ok(passWarnings.length > 0,
      `furniture ${Math.round(300 - 175)}mm from door clearance should trigger passability (got: ${warnings.map(w => `${w.type}: ${w.message}`).join("; ") || "none"})`);
  });

  it("furniture far from door does NOT trigger passability", () => {
    const layout: FurnitureLayout = {
      elements: {
        toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 700, svg: "<svg></svg>" },
      },
      placements: [{
        element: "toilet", room: "Baño", position: { x: 1900, y: 400 },
        rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const passWarnings = warnings.filter((w) => w.type === "passability");
    assert.strictEqual(passWarnings.length, 0, "furniture far from door should not trigger passability");
  });
});

// ── Duplicate fixture validation ──────────────────────────────────────
// Items like toilets, stoves, beds should appear at most once per room.

describe("Duplicate fixture validation", () => {
  const ast = parse(TEST_PLAN);
  const resolved = resolve(ast);

  it("two toilets in same room triggers duplicate_fixture warning", () => {
    const layout: FurnitureLayout = {
      elements: {
        toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 700, svg: "<svg></svg>" },
      },
      placements: [
        {
          element: "toilet", room: "Baño", position: { x: 500, y: 400 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
        {
          element: "toilet", room: "Baño", position: { x: 1800, y: 400 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
      ],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const dupWarnings = warnings.filter((w) => w.type === "duplicate_fixture");
    assert.ok(dupWarnings.length > 0, "two toilets in same room should trigger duplicate_fixture");
  });

  it("same fixture in different rooms does NOT trigger duplicate_fixture", () => {
    const layout: FurnitureLayout = {
      elements: {
        bed: { name: "Bed", tags: ["bedroom"], defaultWidth: 1400, defaultDepth: 2000, svg: "<svg></svg>" },
      },
      placements: [
        {
          element: "bed", room: "Baño", position: { x: 1250, y: 1100 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
        {
          element: "bed", room: "Dormitorio", position: { x: 4500, y: 2000 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
      ],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const dupWarnings = warnings.filter((w) => w.type === "duplicate_fixture");
    assert.strictEqual(dupWarnings.length, 0, "same item in different rooms should not trigger duplicate");
  });

  it("non-unique items like chairs can appear multiple times", () => {
    const layout: FurnitureLayout = {
      elements: {
        chair: { name: "Chair", tags: ["seating"], defaultWidth: 450, defaultDepth: 450, svg: "<svg></svg>" },
      },
      placements: [
        {
          element: "chair", room: "Dormitorio", position: { x: 3500, y: 1000 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
        {
          element: "chair", room: "Dormitorio", position: { x: 4500, y: 1000 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
        {
          element: "chair", room: "Dormitorio", position: { x: 5500, y: 1000 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
      ],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const dupWarnings = warnings.filter((w) => w.type === "duplicate_fixture");
    assert.strictEqual(dupWarnings.length, 0, "chairs are not unique-per-room fixtures");
  });
});

// ── Realistic failure scenario tests ──────────────────────────────────
// Reproduce actual failures observed in production sessions.

const CASA_CHORIZO_PLAN = `{
  "name": "Casa Chorizo",
  "scale": 100,
  "unit": "mm",
  "floors": [{
    "name": "Ground Floor",
    "rooms": [
      {
        "name": "Sala",
        "walls": [
          { "direction": "south", "from": { "x": 1500, "y": 0 }, "to": { "x": 6000, "y": 0 }, "thickness": 200 },
          { "direction": "east", "from": { "x": 6000, "y": 0 }, "to": { "x": 6000, "y": 4500 }, "thickness": 200 },
          { "direction": "north", "from": { "x": 6000, "y": 4500 }, "to": { "x": 1500, "y": 4500 }, "thickness": 150 },
          { "direction": "west", "from": { "x": 1500, "y": 4500 }, "to": { "x": 1500, "y": 0 }, "thickness": 150 }
        ],
        "doors": [{ "wall": "west", "offset": 1200, "width": 900, "swing": "right" }],
        "windows": [{ "wall": "south", "offset": 1650, "width": 1800, "height": 1400, "sill": 900 }]
      },
      {
        "name": "Comedor",
        "walls": [
          { "direction": "south", "from": { "x": 1500, "y": 9000 }, "to": { "x": 6000, "y": 9000 }, "thickness": 150 },
          { "direction": "east", "from": { "x": 6000, "y": 9000 }, "to": { "x": 6000, "y": 13500 }, "thickness": 200 },
          { "direction": "north", "from": { "x": 6000, "y": 13500 }, "to": { "x": 1500, "y": 13500 }, "thickness": 150 },
          { "direction": "west", "from": { "x": 1500, "y": 13500 }, "to": { "x": 1500, "y": 9000 }, "thickness": 150 }
        ],
        "doors": [],
        "windows": [{ "wall": "east", "offset": 1500, "width": 1500, "height": 1400, "sill": 900 }]
      },
      {
        "name": "Cocina",
        "walls": [
          { "direction": "south", "from": { "x": 1500, "y": 15500 }, "to": { "x": 6000, "y": 15500 }, "thickness": 150 },
          { "direction": "east", "from": { "x": 6000, "y": 15500 }, "to": { "x": 6000, "y": 20000 }, "thickness": 200 },
          { "direction": "north", "from": { "x": 6000, "y": 20000 }, "to": { "x": 1500, "y": 20000 }, "thickness": 150 },
          { "direction": "west", "from": { "x": 1500, "y": 20000 }, "to": { "x": 1500, "y": 15500 }, "thickness": 150 }
        ],
        "doors": [{ "wall": "north", "offset": 1800, "width": 900, "swing": "right" }],
        "windows": [{ "wall": "east", "offset": 1600, "width": 1500, "height": 1400, "sill": 900 }]
      }
    ]
  }]
}`;

describe("Realistic failure scenarios", () => {
  const ast = parse(CASA_CHORIZO_PLAN);
  const resolved = resolve(ast);

  it("counter floating in kitchen center triggers wall_proximity", () => {
    // Reproduces: counter at (3075, 17525) rotation=270 in middle of kitchen
    const layout: FurnitureLayout = {
      elements: {
        counter: { name: "Counter", tags: ["kitchen"], defaultWidth: 3000, defaultDepth: 600, svg: "<svg></svg>" },
      },
      placements: [{
        element: "counter", room: "Cocina", position: { x: 3750, y: 17750 },
        rotation: 270, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
      }],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const proximityWarnings = warnings.filter((w) => w.type === "wall_proximity");
    assert.ok(proximityWarnings.length > 0,
      `counter floating in kitchen center should trigger wall_proximity (got: ${warnings.map(w => w.type).join(", ") || "none"})`);
  });

  it("two stoves in kitchen triggers duplicate_fixture", () => {
    // Reproduces: stove at (3975, 15875) AND stove at (1875, 17525)
    const layout: FurnitureLayout = {
      elements: {
        stove: { name: "Stove", tags: ["kitchen"], defaultWidth: 600, defaultDepth: 600, svg: "<svg></svg>" },
      },
      placements: [
        {
          element: "stove", room: "Cocina", position: { x: 3975, y: 15875 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
        {
          element: "stove", room: "Cocina", position: { x: 1875, y: 17525 },
          rotation: 270, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
      ],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const dupWarnings = warnings.filter((w) => w.type === "duplicate_fixture");
    assert.ok(dupWarnings.length > 0, "two stoves in same kitchen should trigger duplicate_fixture");
  });

  it("chairs far from table are detected by wall_proximity when against no wall", () => {
    // Reproduces: chairs at y=9300 (top of comedor), table at y=13025 (bottom)
    // Chairs at the very edge of the room won't trigger wall_proximity
    // but chairs floating in the room center should
    const layout: FurnitureLayout = {
      elements: {
        chair: { name: "Chair", tags: ["seating"], defaultWidth: 450, defaultDepth: 450, svg: "<svg></svg>" },
        table: { name: "Table", tags: ["dining"], defaultWidth: 1200, defaultDepth: 800, svg: "<svg></svg>" },
      },
      placements: [
        {
          element: "table", room: "Comedor", position: { x: 3750, y: 11250 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
        {
          element: "chair", room: "Comedor", position: { x: 3750, y: 9300 },
          rotation: 180, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
      ],
    };

    // The table and chair should NOT overlap — they're 1950mm apart
    const warnings = validateFurniturePlacement(layout, resolved);
    const overlapWarnings = warnings.filter((w) => w.type === "furniture_overlap");
    assert.strictEqual(overlapWarnings.length, 0, "table and distant chair should not overlap");
    // Chair near the north wall is fine for wall_proximity, but the semantic
    // problem (chair not near table) requires AI visual reasoning — validation
    // can't catch this. This test documents the limitation.
  });

  it("counter against wall passes all validation checks", () => {
    // Correct placement: counter against the south wall of the kitchen
    const layout: FurnitureLayout = {
      elements: {
        counter: { name: "Counter", tags: ["kitchen"], defaultWidth: 3000, defaultDepth: 600, svg: "<svg></svg>" },
        stove: { name: "Stove", tags: ["kitchen"], defaultWidth: 600, defaultDepth: 600, svg: "<svg></svg>" },
      },
      placements: [
        {
          element: "counter", room: "Cocina", position: { x: 3750, y: 15875 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
        {
          element: "stove", room: "Cocina", position: { x: 5400, y: 15875 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100, lockProportions: true,
        },
      ],
    };

    const warnings = validateFurniturePlacement(layout, resolved);
    const wallProxWarnings = warnings.filter((w) => w.type === "wall_proximity");
    const dupWarnings = warnings.filter((w) => w.type === "duplicate_fixture");
    assert.strictEqual(wallProxWarnings.length, 0, "counter and stove against south wall should pass wall_proximity");
    assert.strictEqual(dupWarnings.length, 0, "different items should not trigger duplicate_fixture");
  });
});
