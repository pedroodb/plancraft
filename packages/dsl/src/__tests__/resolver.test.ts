import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parse } from "../parser.js";
import { resolve, ResolveError } from "../resolver.js";

describe("Resolver", () => {
  const MINIMAL = JSON.stringify({
    name: "Test",
    scale: 100,
    unit: "mm",
    floors: [{
      name: "F1",
      rooms: [{
        name: "R1",
        walls: [
          { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200 },
          { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
          { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
          { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
        ],
      }],
    }],
  });

  it("resolves a minimal project", () => {
    const ast = parse(MINIMAL);
    const resolved = resolve(ast);
    assert.equal(resolved.name, "Test");
    assert.equal(resolved.floors.length, 1);
    assert.equal(resolved.floors[0].rooms.length, 1);
  });

  it("computes wall polygons", () => {
    const ast = parse(MINIMAL);
    const resolved = resolve(ast);
    const wall = resolved.floors[0].rooms[0].walls[0]; // north wall
    assert.equal(wall.polygon.length, 4);
    assert.deepEqual(wall.polygon[0], { x: 0, y: 100 });
    assert.deepEqual(wall.polygon[1], { x: 5000, y: 100 });
    assert.deepEqual(wall.polygon[2], { x: 5000, y: -100 });
    assert.deepEqual(wall.polygon[3], { x: 0, y: -100 });
  });

  it("computes room area", () => {
    const ast = parse(MINIMAL);
    const resolved = resolve(ast);
    const room = resolved.floors[0].rooms[0];
    // 5000 × 4000 = 20,000,000 mm²
    assert.equal(room.area, 20000000);
  });

  it("computes room center", () => {
    const ast = parse(MINIMAL);
    const resolved = resolve(ast);
    const room = resolved.floors[0].rooms[0];
    assert.equal(room.center.x, 2500);
    assert.equal(room.center.y, 2000);
  });

  it("resolves shared walls", () => {
    const source = JSON.stringify({
      name: "T",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F",
        rooms: [
          {
            name: "A",
            walls: [
              { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200 },
              { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
              { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
              { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
            ],
          },
          {
            name: "B",
            walls: [
              { direction: "north", from: { x: 5000, y: 0 }, to: { x: 10000, y: 0 }, thickness: 200 },
              { direction: "east", from: { x: 10000, y: 0 }, to: { x: 10000, y: 4000 }, thickness: 200 },
              { direction: "south", from: { x: 10000, y: 4000 }, to: { x: 5000, y: 4000 }, thickness: 200 },
            ],
            sharedWalls: [
              { direction: "east", sourceRoom: "A", sourceWall: "east" },
            ],
          },
        ],
      }],
    });
    const resolved = resolve(parse(source));
    const roomB = resolved.floors[0].rooms[1];
    assert.equal(roomB.walls.length, 4);
    const sharedWall = roomB.walls[3];
    assert.deepEqual(sharedWall.from, { x: 5000, y: 0 });
    assert.deepEqual(sharedWall.to, { x: 5000, y: 4000 });
  });

  it("resolves doors with positions", () => {
    const source = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200 },
            { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
          doors: [
            { wall: "north", offset: 1500, width: 900, swing: "left" },
          ],
        }],
      }],
    });
    const resolved = resolve(parse(source));
    const door = resolved.floors[0].rooms[0].doors[0];
    assert.equal(door.position.x, 1500);
    assert.equal(door.position.y, 0);
    assert.equal(door.width, 900);
  });

  it("resolves dimensions", () => {
    const source = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200 },
            { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
        dimensions: [
          { wall: "north", room: "R1", offset: 500 },
        ],
      }],
    });
    const resolved = resolve(parse(source));
    const dim = resolved.floors[0].dimensions[0];
    assert.equal(dim.length, 5000);
    assert.deepEqual(dim.from, { x: 0, y: 0 });
    assert.deepEqual(dim.to, { x: 5000, y: 0 });
  });

  it("resolves labels at center", () => {
    const source = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200 },
            { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
        labels: [
          { text: "R1", position: "center" },
        ],
      }],
    });
    const resolved = resolve(parse(source));
    const label = resolved.floors[0].labels[0];
    assert.equal(label.text, "R1");
    assert.equal(label.position.x, 2500);
    assert.equal(label.position.y, 2000);
  });

  it("throws on missing room reference in shared wall", () => {
    const source = JSON.stringify({
      name: "T",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F",
        rooms: [{
          name: "A",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 100, y: 0 }, thickness: 10 },
          ],
          sharedWalls: [
            { direction: "east", sourceRoom: "NonExistent" },
          ],
        }],
      }],
    });
    assert.throws(() => resolve(parse(source)), ResolveError);
  });
});
