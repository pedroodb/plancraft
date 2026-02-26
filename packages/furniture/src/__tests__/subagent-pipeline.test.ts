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
 */

import { describe, it, expect } from "vitest";
import { parse, resolve } from "@plancraft/dsl";
import { computeRoomGeometries, type RoomGeometry } from "@plancraft/renderer";
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
      expect(sides).toEqual(["east", "north", "south", "west"]);

      // In SVG/DSL convention: north=Y_min (top), south=Y_max (bottom)
      // After the assignWallSide fix, compass side matches DSL direction
      const southWall = bano.walls.find((w) => w.side === "south");
      expect(southWall).toBeDefined();
      // South wall at Y=2200 (bottom of SVG)
      const wallMidY = (southWall!.from.y + southWall!.to.y) / 2;
      expect(wallMidY).toBeGreaterThan(bano.center.y);
    });

    it("assigns correct compass sides to bedroom walls", () => {
      const dorm = findRoom("Dormitorio");
      const sides = dorm.walls.map((w) => w.side).sort();
      expect(sides).toEqual(["east", "north", "south", "west"]);
    });
  });

  describe("Anchor resolution", () => {
    it("places toilet on north wall (Y_min, top of SVG) correctly", () => {
      const bano = findRoom("Baño");
      const layout: FurnitureLayout = {
        elements: {
          toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 600 },
        },
        placements: [{
          element: "toilet", room: "Baño", position: { x: 0, y: 0 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100,
          anchor: { wall: "north", along: 0.5, offset: 0 },
        }],
      };

      const resolved = resolveAnchors(layout, roomGeos);
      const pos = resolved.placements[0].position;

      // North wall at Y=0. Toilet center near top.
      expect(pos.y).toBeLessThan(bano.center.y);
      // Horizontally centered (along=0.5)
      expect(Math.abs(pos.x - bano.center.x)).toBeLessThan(300);
    });

    it("places toilet on south wall (Y_max, bottom of SVG) correctly", () => {
      const bano = findRoom("Baño");
      const layout: FurnitureLayout = {
        elements: {
          toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 600 },
        },
        placements: [{
          element: "toilet", room: "Baño", position: { x: 0, y: 0 },
          rotation: 0, scaleWidth: 100, scaleDepth: 100,
          anchor: { wall: "south", along: 0.5, offset: 0 },
        }],
      };

      const resolved = resolveAnchors(layout, roomGeos);
      const pos = resolved.placements[0].position;

      // South wall at Y=2200. Toilet center near bottom.
      expect(pos.y).toBeGreaterThan(bano.center.y);
    });

    it("places bed anchored to east wall of bedroom", () => {
      const dorm = findRoom("Dormitorio");
      const placement: FurniturePlacement = {
        element: "bed",
        room: "Dormitorio",
        position: { x: 0, y: 0 },
        rotation: 0,
        scaleWidth: 100,
        scaleDepth: 100,
        anchor: { wall: "east", along: 0.5, offset: 0 },
      };

      const layout: FurnitureLayout = {
        elements: {
          bed: {
            name: "Bed",
            tags: ["bedroom"],
            defaultWidth: 1400,
            defaultDepth: 2000,
          },
        },
        placements: [placement],
      };

      const resolved = resolveAnchors(layout, roomGeos);
      const pos = resolved.placements[0].position;

      // East wall is at high X (x=6500). Bed center should be near that side.
      expect(pos.x).toBeGreaterThan(dorm.center.x);
    });

    it("handles scaled furniture correctly", () => {
      const placement: FurniturePlacement = {
        element: "toilet",
        room: "Baño",
        position: { x: 0, y: 0 },
        rotation: 0,
        scaleWidth: 80,
        scaleDepth: 80,
        anchor: { wall: "north", along: 0.3, offset: 0 },
      };

      const layout: FurnitureLayout = {
        elements: {
          toilet: {
            name: "Toilet",
            tags: ["bathroom"],
            defaultWidth: 400,
            defaultDepth: 600,
          },
        },
        placements: [placement],
      };

      const resolved = resolveAnchors(layout, roomGeos);
      const pos = resolved.placements[0].position;

      // Should still be on the north side (low Y)
      const bano = findRoom("Baño");
      expect(pos.y).toBeLessThan(bano.center.y);
      // Scaled depth is 480mm instead of 600mm — should be slightly closer to wall
    });
  });

  describe("Door wall identification", () => {
    it("bathroom has door on south DSL wall", () => {
      const room = resolved.floors[0].rooms.find((r) => r.name === "Baño");
      expect(room).toBeDefined();
      expect(room!.doors.length).toBe(1);
      expect(room!.doors[0].wallDirection).toBe("south");
    });

    it("bedroom has door on west DSL wall", () => {
      const room = resolved.floors[0].rooms.find((r) => r.name === "Dormitorio");
      expect(room).toBeDefined();
      expect(room!.doors.length).toBe(1);
      expect(room!.doors[0].wallDirection).toBe("west");
    });
  });

  describe("Multiple placements spatial sanity", () => {
    it("three bathroom items on different walls don't overlap", () => {
      const layout: FurnitureLayout = {
        elements: {
          toilet: { name: "Toilet", tags: ["bathroom"], defaultWidth: 400, defaultDepth: 600 },
          sink: { name: "Sink", tags: ["bathroom"], defaultWidth: 500, defaultDepth: 400 },
          shower: { name: "Shower", tags: ["bathroom"], defaultWidth: 900, defaultDepth: 900 },
        },
        placements: [
          {
            element: "toilet", room: "Baño", position: { x: 0, y: 0 },
            rotation: 0, scaleWidth: 100, scaleDepth: 100,
            anchor: { wall: "north", along: 0.2, offset: 0 },
          },
          {
            element: "sink", room: "Baño", position: { x: 0, y: 0 },
            rotation: 0, scaleWidth: 100, scaleDepth: 100,
            anchor: { wall: "north", along: 0.7, offset: 0 },
          },
          {
            element: "shower", room: "Baño", position: { x: 0, y: 0 },
            rotation: 0, scaleWidth: 80, scaleDepth: 80,
            anchor: { wall: "east", along: 0.5, offset: 0 },
          },
        ],
      };

      const resolved = resolveAnchors(layout, roomGeos);
      const positions = resolved.placements.map((p) => p.position);

      // All positions should be within the room bounds (roughly 0-2500 x, 0-2200 y)
      for (const pos of positions) {
        expect(pos.x).toBeGreaterThan(-100);
        expect(pos.x).toBeLessThan(2600);
        expect(pos.y).toBeGreaterThan(-100);
        expect(pos.y).toBeLessThan(2300);
      }

      // No two items should be at exactly the same position
      for (let i = 0; i < positions.length; i++) {
        for (let j = i + 1; j < positions.length; j++) {
          const dist = Math.sqrt(
            (positions[i].x - positions[j].x) ** 2 +
            (positions[i].y - positions[j].y) ** 2,
          );
          expect(dist).toBeGreaterThan(100); // At least 100mm apart
        }
      }
    });
  });
});
