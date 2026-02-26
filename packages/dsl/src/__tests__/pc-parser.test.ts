import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parsePc } from "../pc-parser.js";
import { parse, ParseError } from "../parser.js";
import { serialize } from "../serializer.js";

// ── Helpers ──────────────────────────────────────────────────────────

const MINIMAL_DSL = `plan: Test

floor: F1
  room: R1
    wall north 0,0 5000,0 200
    wall east 5000,0 5000,4000 200
    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200
`;

const MINIMAL_JSON = JSON.stringify({
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

// ── Tests ────────────────────────────────────────────────────────────

describe("PC DSL Parser", () => {
  it("parses a minimal plan", () => {
    const ast = parsePc(MINIMAL_DSL);
    assert.equal(ast.type, "project");
    assert.equal(ast.name, "Test");
    assert.equal(ast.scale.ratio, 100);
    assert.equal(ast.unit, "mm");
    assert.equal(ast.floors.length, 1);
    assert.equal(ast.floors[0].name, "F1");
  });

  it("parses rooms with walls", () => {
    const ast = parsePc(MINIMAL_DSL);
    const rooms = ast.floors[0].children.filter((c) => c.type === "room");
    assert.equal(rooms.length, 1);
    const room = rooms[0];
    assert.equal(room.name, "R1");
    const walls = room.children.filter((c) => c.type === "wall");
    assert.equal(walls.length, 4);
  });

  it("parses wall coordinates correctly", () => {
    const ast = parsePc(MINIMAL_DSL);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const wall = room.children[0];
    if (wall.type !== "wall") return;
    assert.deepEqual(wall.from, { x: 0, y: 0 });
    assert.deepEqual(wall.to, { x: 5000, y: 0 });
    assert.equal(wall.thickness, 200);
    assert.equal(wall.direction, "north");
  });

  it("parses doors", () => {
    const source = `plan: Test

floor: F1
  room: R1
    wall north 0,0 5000,0 200
    wall east 5000,0 5000,4000 200
    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200
    door north 1500 900 left
`;
    const ast = parsePc(source);
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
    const source = `plan: Test

floor: F1
  room: R1
    wall north 0,0 5000,0 200
    wall east 5000,0 5000,4000 200
    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200
    window east 800 1200 1400 900
`;
    const ast = parsePc(source);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const windows = room.children.filter((c) => c.type === "window");
    assert.equal(windows.length, 1);
    const win = windows[0];
    if (win.type !== "window") return;
    assert.equal(win.wallDirection, "east");
    assert.equal(win.offset, 800);
    assert.equal(win.width, 1200);
    assert.equal(win.height, 1400);
    assert.equal(win.sill, 900);
  });

  it("parses openings", () => {
    const source = `plan: Test

floor: F1
  room: R1
    wall north 0,0 5000,0 200
    wall east 5000,0 5000,4000 200
    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200
    opening east 1200 2000
`;
    const ast = parsePc(source);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const openings = room.children.filter((c) => c.type === "opening");
    assert.equal(openings.length, 1);
    const op = openings[0];
    if (op.type !== "opening") return;
    assert.equal(op.wallDirection, "east");
    assert.equal(op.offset, 1200);
    assert.equal(op.width, 2000);
  });

  it("parses walls with bulge", () => {
    const source = `plan: Test

floor: F1
  room: R1
    wall north 0,0 5000,0 200 bulge=0.3
    wall east 5000,0 5000,4000 200
    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200
`;
    const ast = parsePc(source);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const wall = room.children[0];
    if (wall.type !== "wall") return;
    assert.equal(wall.bulge, 0.3);
  });

  it("supports comments and blank lines", () => {
    const source = `// Project header comment
plan: Test

// Floor comment

floor: F1
  room: R1
    // Wall comments
    wall north 0,0 5000,0 200
    wall east 5000,0 5000,4000 200

    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200
`;
    const ast = parsePc(source);
    assert.equal(ast.name, "Test");
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const walls = room.children.filter((c) => c.type === "wall");
    assert.equal(walls.length, 4);
  });

  it("parses quoted names with spaces", () => {
    const source = `plan: "Family Apartment"

floor: "Main Floor"
  room: "Living Room"
    wall north 0,0 5000,0 200
    wall east 5000,0 5000,4000 200
    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200

  room: Kitchen
    wall north 5000,0 10000,0 200
    wall east 10000,0 10000,4000 200
    wall south 10000,4000 5000,4000 200
    wall west 5000,4000 5000,0 200
`;
    const ast = parsePc(source);
    assert.equal(ast.name, "Family Apartment");
    assert.equal(ast.floors[0].name, "Main Floor");
    const rooms = ast.floors[0].children.filter((c) => c.type === "room");
    assert.equal(rooms[0].name, "Living Room");
    assert.equal(rooms[1].name, "Kitchen");
  });

  it("parses quoted wall directions", () => {
    const source = `plan: Test

floor: F1
  room: Hallway
    wall "north left" 4500,5700 0,5700 150
    wall "north right" 13000,5700 9500,5700 150
    wall east 13000,4500 13000,5700 200
    wall west 0,5700 0,4500 200
    door "north left" 1500 800 right
`;
    const ast = parsePc(source);
    const room = ast.floors[0].children[0];
    if (room.type !== "room") return;
    const walls = room.children.filter((c) => c.type === "wall");
    assert.equal(walls[0].type === "wall" && walls[0].direction, "north left");
    assert.equal(walls[1].type === "wall" && walls[1].direction, "north right");
    const doors = room.children.filter((c) => c.type === "door");
    if (doors[0].type !== "door") return;
    assert.equal(doors[0].wallDirection, "north left");
  });

  it("handles custom scale and unit", () => {
    const source = `plan: Test
scale: 50
unit: m

floor: F1
  room: R1
    wall north 0,0 5,0 0.2
    wall east 5,0 5,4 0.2
    wall south 5,4 0,4 0.2
    wall west 0,4 0,0 0.2
`;
    const ast = parsePc(source);
    assert.equal(ast.scale.ratio, 50);
    assert.equal(ast.unit, "m");
  });

  it("throws on missing plan header", () => {
    assert.throws(
      () => parsePc("floor: F1\n  room: R1\n    wall north 0,0 5000,0 200\n"),
      ParseError,
    );
  });

  it("throws on invalid wall thickness", () => {
    assert.throws(
      () => parsePc("plan: T\nfloor: F\n  room: R\n    wall north 0,0 5000,0 -10\n"),
      ParseError,
    );
  });

  it("throws on invalid door swing", () => {
    assert.throws(
      () => parsePc("plan: T\nfloor: F\n  room: R\n    wall n 0,0 5000,0 200\n    door n 100 900 up\n"),
      ParseError,
    );
  });
});

describe("Auto-detection: parse() handles both formats", () => {
  it("auto-detects JSONC format", () => {
    const ast = parse(MINIMAL_JSON);
    assert.equal(ast.name, "Test");
    assert.equal(ast.floors.length, 1);
  });

  it("auto-detects DSL format", () => {
    const ast = parse(MINIMAL_DSL);
    assert.equal(ast.name, "Test");
    assert.equal(ast.floors.length, 1);
  });

  it("produces identical AST from both formats", () => {
    const jsonAst = parse(MINIMAL_JSON);
    const dslAst = parse(MINIMAL_DSL);

    // Compare structurally
    assert.equal(jsonAst.name, dslAst.name);
    assert.equal(jsonAst.scale.ratio, dslAst.scale.ratio);
    assert.equal(jsonAst.unit, dslAst.unit);
    assert.equal(jsonAst.floors.length, dslAst.floors.length);
    assert.equal(jsonAst.floors[0].name, dslAst.floors[0].name);

    const jsonRoom = jsonAst.floors[0].children[0];
    const dslRoom = dslAst.floors[0].children[0];
    if (jsonRoom.type !== "room" || dslRoom.type !== "room") return;

    assert.equal(jsonRoom.name, dslRoom.name);
    assert.equal(jsonRoom.children.length, dslRoom.children.length);

    // Compare walls
    for (let i = 0; i < jsonRoom.children.length; i++) {
      const jsonChild = jsonRoom.children[i];
      const dslChild = dslRoom.children[i];
      assert.equal(jsonChild.type, dslChild.type);
      if (jsonChild.type === "wall" && dslChild.type === "wall") {
        assert.equal(jsonChild.direction, dslChild.direction);
        assert.deepEqual(jsonChild.from, dslChild.from);
        assert.deepEqual(jsonChild.to, dslChild.to);
        assert.equal(jsonChild.thickness, dslChild.thickness);
      }
    }
  });
});

describe("Serializer", () => {
  it("serializes a minimal project", () => {
    const ast = parse(MINIMAL_JSON);
    const serialized = serialize(ast);
    assert.ok(serialized.includes("plan: Test"));
    assert.ok(serialized.includes("floor: F1"));
    assert.ok(serialized.includes("room: R1"));
    assert.ok(serialized.includes("wall north 0,0 5000,0 200"));
  });

  it("round-trips: parse → serialize → parse produces same AST", () => {
    const ast1 = parse(MINIMAL_JSON);
    const serialized = serialize(ast1);
    const ast2 = parse(serialized);

    assert.equal(ast1.name, ast2.name);
    assert.equal(ast1.scale.ratio, ast2.scale.ratio);
    assert.equal(ast1.floors.length, ast2.floors.length);

    const room1 = ast1.floors[0].children[0];
    const room2 = ast2.floors[0].children[0];
    if (room1.type !== "room" || room2.type !== "room") return;
    assert.equal(room1.children.length, room2.children.length);
  });

  it("omits default scale and unit", () => {
    const ast = parse(MINIMAL_JSON);
    const serialized = serialize(ast);
    assert.ok(!serialized.includes("scale:"));
    assert.ok(!serialized.includes("unit:"));
  });

  it("includes non-default scale and unit", () => {
    const source = `plan: Test
scale: 50
unit: m

floor: F1
  room: R1
    wall north 0,0 5,0 0.2
    wall east 5,0 5,4 0.2
    wall south 5,4 0,4 0.2
    wall west 0,4 0,0 0.2
`;
    const ast = parse(source);
    const serialized = serialize(ast);
    assert.ok(serialized.includes("scale: 50"));
    assert.ok(serialized.includes("unit: m"));
  });

  it("serializes walls with bulge", () => {
    const source = `plan: Test

floor: F1
  room: R1
    wall south 0,0 10000,0 200 bulge=-0.1
    wall east 10000,0 10000,4000 200
    wall north 10000,4000 0,4000 200
    wall west 0,4000 0,0 200
`;
    const ast = parse(source);
    const serialized = serialize(ast);
    assert.ok(serialized.includes("bulge=-0.1"));
  });

  it("quotes names with spaces", () => {
    const source = `plan: "Family Apartment"

floor: "Main Floor"
  room: "Living Room"
    wall north 0,0 5000,0 200
    wall east 5000,0 5000,4000 200
    wall south 5000,4000 0,4000 200
    wall west 0,4000 0,0 200
`;
    const ast = parse(source);
    const serialized = serialize(ast);
    assert.ok(serialized.includes('"Family Apartment"'));
    assert.ok(serialized.includes('"Main Floor"'));
    assert.ok(serialized.includes('"Living Room"'));
  });
});
