import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parse, ParseError } from "../parser.js";

describe("Parser", () => {
  const MINIMAL = JSON.stringify({
    name: "Test",
    scale: 100,
    unit: "mm",
    floors: [
      {
        name: "F1",
        rooms: [
          {
            name: "R1",
            walls: [
              { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200 },
              { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
              { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
              { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
            ],
          },
        ],
      },
    ],
  });

  it("parses a minimal project", () => {
    const ast = parse(MINIMAL);
    assert.equal(ast.type, "project");
    assert.equal(ast.name, "Test");
    assert.equal(ast.scale.ratio, 100);
    assert.equal(ast.unit, "mm");
    assert.equal(ast.floors.length, 1);
    assert.equal(ast.floors[0].name, "F1");
  });

  it("parses rooms with walls", () => {
    const ast = parse(MINIMAL);
    const rooms = ast.floors[0].children.filter((c) => c.type === "room");
    assert.equal(rooms.length, 1);
    const room = rooms[0];
    assert.equal(room.type, "room");
    assert.equal(room.name, "R1");
    const walls = room.children.filter((c) => c.type === "wall");
    assert.equal(walls.length, 4);
  });

  it("parses wall coordinates", () => {
    const ast = parse(MINIMAL);
    const room = ast.floors[0].children[0];
    assert.equal(room.type, "room");
    if (room.type !== "room") return;
    const wall = room.children[0];
    assert.equal(wall.type, "wall");
    if (wall.type !== "wall") return;
    assert.deepEqual(wall.from, { x: 0, y: 0 });
    assert.deepEqual(wall.to, { x: 5000, y: 0 });
    assert.equal(wall.thickness, 200);
    assert.equal(wall.direction, "north");
  });

  it("parses doors", () => {
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
    const ast = parse(source);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const doors = room.children.filter((c) => c.type === "door");
    assert.equal(doors.length, 1);
    const door = doors[0];
    if (door.type !== "door") return;
    assert.equal(door.wallDirection, "north");
    assert.equal(door.offset, 1500);
    assert.equal(door.width, 900);
    assert.equal(door.swing, "left");
  });

  it("parses windows", () => {
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
          windows: [
            { wall: "east", offset: 800, width: 1200, height: 1400, sill: 900 },
          ],
        }],
      }],
    });
    const ast = parse(source);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const windows = room.children.filter((c) => c.type === "window");
    assert.equal(windows.length, 1);
    const win = windows[0];
    if (win.type !== "window") return;
    assert.equal(win.wallDirection, "east");
    assert.equal(win.width, 1200);
    assert.equal(win.height, 1400);
    assert.equal(win.sill, 900);
  });

  it("parses shared walls", () => {
    const source = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
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
    const ast = parse(source);
    const rooms = ast.floors[0].children.filter((c) => c.type === "room");
    assert.equal(rooms.length, 2);
    const roomB = rooms[1];
    if (roomB.type !== "room") return;
    const shared = roomB.children.filter((c) => c.type === "shared_wall");
    assert.equal(shared.length, 1);
    if (shared[0].type !== "shared_wall") return;
    assert.equal(shared[0].sourceRoomName, "A");
    assert.equal(shared[0].sourceWallDirection, "east");
  });

  it("supports JSONC comments", () => {
    const source = `{
      // This is a line comment
      "name": "Test",
      "scale": 100,
      /* block comment */
      "unit": "mm",
      "floors": []
    }`;
    const ast = parse(source);
    assert.equal(ast.name, "Test");
    assert.equal(ast.floors.length, 0);
  });

  it("defaults scale and unit when omitted", () => {
    const source = JSON.stringify({ name: "Bare", floors: [] });
    const ast = parse(source);
    assert.equal(ast.scale.ratio, 100);
    assert.equal(ast.unit, "mm");
  });

  it("throws on invalid JSON", () => {
    assert.throws(() => parse("not json at all"), ParseError);
  });

  it("throws on missing project name", () => {
    assert.throws(() => parse(JSON.stringify({ floors: [] })), ParseError);
  });

  it("parses walls with bulge", () => {
    const source = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200, bulge: 0.3 },
            { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
      }],
    });
    const ast = parse(source);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const wall = room.children[0];
    if (wall.type !== "wall") return;
    assert.equal(wall.bulge, 0.3);
  });

  it("omits bulge when not provided", () => {
    const ast = parse(MINIMAL);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const wall = room.children[0];
    if (wall.type !== "wall") return;
    assert.equal(wall.bulge, undefined);
  });

  it("throws on non-numeric bulge", () => {
    const source = JSON.stringify({
      name: "Test",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F1",
        rooms: [{
          name: "R1",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200, bulge: "bad" },
          ],
        }],
      }],
    });
    assert.throws(() => parse(source), ParseError);
  });
});
