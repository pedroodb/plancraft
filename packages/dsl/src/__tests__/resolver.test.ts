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

  it("resolves a wall with bulge (curved wall)", () => {
    const source = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200, bulge: 0.5 },
            { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
      }],
    });
    const resolved = resolve(parse(source));
    const wall = resolved.floors[0].rooms[0].walls[0]; // north wall with bulge
    assert.equal(wall.bulge, 0.5);
    // Curved wall polygon has more than 4 points
    assert.ok(wall.polygon.length > 4, `Expected polygon with > 4 points, got ${wall.polygon.length}`);
    // curvePoints should be populated
    assert.ok(wall.curvePoints !== undefined, "curvePoints should be defined");
    assert.ok(wall.curvePoints!.length > 2, "curvePoints should have multiple samples");
    // First curve point should be near 'from', last near 'to'
    assert.ok(Math.abs(wall.curvePoints![0].x - 0) < 1, "First curve point x should be near from.x");
    assert.ok(Math.abs(wall.curvePoints![0].y - 0) < 1, "First curve point y should be near from.y");
    const lastPt = wall.curvePoints![wall.curvePoints!.length - 1];
    assert.ok(Math.abs(lastPt.x - 5000) < 1, "Last curve point x should be near to.x");
    assert.ok(Math.abs(lastPt.y - 0) < 1, "Last curve point y should be near to.y");
  });

  it("straight walls have no bulge or curvePoints", () => {
    const ast = parse(MINIMAL);
    const resolved = resolve(ast);
    const wall = resolved.floors[0].rooms[0].walls[0];
    assert.equal(wall.bulge, undefined);
    assert.equal(wall.curvePoints, undefined);
    assert.equal(wall.polygon.length, 4);
  });

  it("negative bulge curves the other way", () => {
    const source = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200, bulge: -0.3 },
            { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
      }],
    });
    const resolved = resolve(parse(source));
    const wall = resolved.floors[0].rooms[0].walls[0];
    assert.equal(wall.bulge, -0.3);
    assert.ok(wall.polygon.length > 4);
    // With negative bulge on north wall (from left to right), arc curves downward (negative Y)
    // The midpoint of curvePoints should have y < 0
    const midIdx = Math.floor(wall.curvePoints!.length / 2);
    assert.ok(wall.curvePoints![midIdx].y < 0, "Negative bulge should curve in opposite direction");
  });

  it("area accounts for curved walls", () => {
    // Negative bulge on the north wall curves outward (away from room interior),
    // increasing the room area compared to a straight-walled room.
    const straightSource = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 4000, y: 0 }, thickness: 200 },
            { direction: "east", from: { x: 4000, y: 0 }, to: { x: 4000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 4000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
      }],
    });
    const curvedSource = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 4000, y: 0 }, thickness: 200, bulge: -0.5 },
            { direction: "east", from: { x: 4000, y: 0 }, to: { x: 4000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 4000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
      }],
    });
    const straightRoom = resolve(parse(straightSource)).floors[0].rooms[0];
    const curvedRoom = resolve(parse(curvedSource)).floors[0].rooms[0];
    assert.ok(curvedRoom.area > straightRoom.area,
      `Curved room area (${curvedRoom.area}) should be larger than straight (${straightRoom.area})`);
  });
});
