import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parsePcf, serializePcf } from "../pcf-parser.js";
import { parseLayout, parseJsoncLayout, serializeLayout } from "../layout.js";
import type { FurnitureLayout, FurniturePlacement } from "../types.js";

// ── PCF DSL Parser ──────────────────────────────────────────────────

describe("PCF DSL Parser", () => {
  it("parses an empty layout", () => {
    const layout = parsePcf("furniture:\n\nplacements:\n");
    assert.deepStrictEqual(layout.placements, []);
    assert.strictEqual(layout.elements, undefined);
  });

  it("parses a simple absolute placement", () => {
    const source = `furniture:

placements:
  place default/bed at 800,1100 in Studio
`;
    const layout = parsePcf(source);
    assert.strictEqual(layout.placements.length, 1);
    const p = layout.placements[0];
    assert.strictEqual(p.element, "default/bed");
    assert.deepStrictEqual(p.position, { x: 800, y: 1100 });
    assert.strictEqual(p.room, "Studio");
    assert.strictEqual(p.scaleWidth, 100);
    assert.strictEqual(p.scaleDepth, 100);
    assert.strictEqual(p.lockProportions, true);
    assert.strictEqual(p.rotation, 0);
  });

  it("parses placement with scale", () => {
    const source = `furniture:

placements:
  place default/sofa at 4000,3450 in Studio scale=90
`;
    const layout = parsePcf(source);
    const p = layout.placements[0];
    assert.strictEqual(p.scaleWidth, 90);
    assert.strictEqual(p.scaleDepth, 90);
    assert.strictEqual(p.lockProportions, true);
  });

  it("parses placement with non-uniform scale", () => {
    const source = `furniture:

placements:
  place default/table at 100,200 in Kitchen scale=80,120
`;
    const layout = parsePcf(source);
    const p = layout.placements[0];
    assert.strictEqual(p.scaleWidth, 80);
    assert.strictEqual(p.scaleDepth, 120);
    assert.strictEqual(p.lockProportions, false);
  });

  it("parses placement with rotation", () => {
    const source = `furniture:

placements:
  place default/wardrobe at 600,2500 in Studio rotation=90
`;
    const layout = parsePcf(source);
    const p = layout.placements[0];
    assert.strictEqual(p.rotation, 90);
  });

  it("parses anchor positioning", () => {
    const source = `furniture:

placements:
  place default/bed anchor north 0.3 0 in "Master Bedroom"
`;
    const layout = parsePcf(source);
    const p = layout.placements[0];
    assert.strictEqual(p.element, "default/bed");
    assert.deepStrictEqual(p.anchor, { wall: "north", along: 0.3, offset: 0 });
    assert.strictEqual(p.room, "Master Bedroom");
  });

  it("parses relative positioning", () => {
    const source = `furniture:

placements:
  place default/coffee_table rel 0.5,0.5 in "Living Room"
`;
    const layout = parsePcf(source);
    const p = layout.placements[0];
    assert.deepStrictEqual(p.relativePosition, { x: 0.5, y: 0.5 });
    assert.strictEqual(p.room, "Living Room");
  });

  it("parses multiple placements", () => {
    const source = `furniture:

placements:
  place default/bed at 800,1100 in Studio
  place default/desk at 4300,400 in Studio
  place default/sofa at 4000,3450 in Studio scale=90
  place default/wardrobe at 600,2500 in Studio rotation=90
`;
    const layout = parsePcf(source);
    assert.strictEqual(layout.placements.length, 4);
    assert.strictEqual(layout.placements[0].element, "default/bed");
    assert.strictEqual(layout.placements[1].element, "default/desk");
    assert.strictEqual(layout.placements[2].scaleWidth, 90);
    assert.strictEqual(layout.placements[3].rotation, 90);
  });

  it("supports comments and blank lines", () => {
    const source = `furniture:

placements:
  // Living room furniture
  place default/sofa at 1000,2000 in "Living Room"

  // Kitchen furniture
  place default/table at 3000,4000 in Kitchen
`;
    const layout = parsePcf(source);
    assert.strictEqual(layout.placements.length, 2);
  });

  it("parses element definitions", () => {
    const source = `furniture:

elements:
  plant: Potted Plant [living,decoration] 400x400
    svg: <svg width="400" height="400"><circle r="200"/></svg>
    source: generated

placements:
  place plant at 500,500 in Studio
`;
    const layout = parsePcf(source);
    assert.ok(layout.elements);
    assert.ok(layout.elements["plant"]);
    const el = layout.elements["plant"];
    assert.strictEqual(el.name, "Potted Plant");
    assert.deepStrictEqual(el.tags, ["living", "decoration"]);
    assert.strictEqual(el.defaultWidth, 400);
    assert.strictEqual(el.defaultDepth, 400);
    assert.ok(el.svg.includes("<svg"));
    assert.strictEqual(el.source, "generated");
    assert.strictEqual(layout.placements.length, 1);
  });

  it("parses element definitions without source", () => {
    const source = `furniture:

elements:
  lamp: Floor Lamp [living] 300x300
    svg: <svg width="300" height="300"><rect/></svg>

placements:
`;
    const layout = parsePcf(source);
    assert.ok(layout.elements);
    const el = layout.elements["lamp"];
    assert.strictEqual(el.name, "Floor Lamp");
    assert.strictEqual(el.source, undefined);
  });

  it("parses element definitions without tags", () => {
    const source = `furniture:

elements:
  custom: My Item [] 200x300
    svg: <svg></svg>

placements:
`;
    const layout = parsePcf(source);
    assert.ok(layout.elements);
    const el = layout.elements["custom"];
    assert.strictEqual(el.name, "My Item");
    assert.deepStrictEqual(el.tags, []);
  });

  it("parses placement without room", () => {
    const source = `furniture:

placements:
  place default/chair at 500,500
`;
    const layout = parsePcf(source);
    assert.strictEqual(layout.placements[0].room, undefined);
    assert.deepStrictEqual(layout.placements[0].position, { x: 500, y: 500 });
  });

  // Error cases
  it("throws on invalid mode", () => {
    const source = `furniture:

placements:
  place default/bed xyz 100,200 in Studio
`;
    assert.throws(() => parsePcf(source), /expected "at", "anchor", or "rel"/);
  });

  it("throws on anchor with invalid along value", () => {
    const source = `furniture:

placements:
  place default/bed anchor north 1.5 0 in Studio
`;
    assert.throws(() => parsePcf(source), /along.*must be 0-1/);
  });

  it("throws on element missing svg", () => {
    const source = `furniture:

elements:
  plant: Potted Plant [living] 400x400

placements:
`;
    assert.throws(() => parsePcf(source), /missing svg/);
  });
});

// ── PCF Serializer ──────────────────────────────────────────────────

describe("PCF Serializer", () => {
  it("serializes an empty layout", () => {
    const layout: FurnitureLayout = { placements: [] };
    const result = serializePcf(layout);
    assert.ok(result.includes("furniture:"));
    assert.ok(result.includes("placements:"));
  });

  it("serializes absolute placements", () => {
    const layout: FurnitureLayout = {
      placements: [
        {
          element: "default/bed",
          position: { x: 800, y: 1100 },
          scaleWidth: 100,
          scaleDepth: 100,
          lockProportions: true,
          rotation: 0,
          room: "Studio",
        },
      ],
    };
    const result = serializePcf(layout);
    assert.ok(result.includes("place default/bed at 800,1100 in Studio"));
  });

  it("serializes placement with non-default scale", () => {
    const layout: FurnitureLayout = {
      placements: [
        {
          element: "default/sofa",
          position: { x: 100, y: 200 },
          scaleWidth: 90,
          scaleDepth: 90,
          lockProportions: true,
          rotation: 0,
          room: "Room",
        },
      ],
    };
    const result = serializePcf(layout);
    assert.ok(result.includes("scale=90"));
  });

  it("serializes placement with non-uniform scale", () => {
    const layout: FurnitureLayout = {
      placements: [
        {
          element: "default/table",
          position: { x: 100, y: 200 },
          scaleWidth: 80,
          scaleDepth: 120,
          lockProportions: false,
          rotation: 0,
          room: "Room",
        },
      ],
    };
    const result = serializePcf(layout);
    assert.ok(result.includes("scale=80,120"));
  });

  it("serializes anchor placements", () => {
    const layout: FurnitureLayout = {
      placements: [
        {
          element: "default/bed",
          position: { x: 0, y: 0 },
          scaleWidth: 100,
          scaleDepth: 100,
          lockProportions: true,
          rotation: 0,
          room: "Master Bedroom",
          anchor: { wall: "north", along: 0.3, offset: 0 },
        },
      ],
    };
    const result = serializePcf(layout);
    assert.ok(result.includes('anchor north 0.3 0 in "Master Bedroom"'));
  });

  it("serializes relative placements", () => {
    const layout: FurnitureLayout = {
      placements: [
        {
          element: "default/table",
          position: { x: 0, y: 0 },
          scaleWidth: 100,
          scaleDepth: 100,
          lockProportions: true,
          rotation: 0,
          room: "Living Room",
          relativePosition: { x: 0.5, y: 0.5 },
        },
      ],
    };
    const result = serializePcf(layout);
    assert.ok(result.includes('rel 0.5,0.5 in "Living Room"'));
  });

  it("serializes element definitions", () => {
    const layout: FurnitureLayout = {
      elements: {
        plant: {
          name: "Potted Plant",
          tags: ["living", "decoration"],
          defaultWidth: 400,
          defaultDepth: 400,
          svg: '<svg width="400" height="400"><circle r="200"/></svg>',
          source: "generated",
        },
      },
      placements: [],
    };
    const result = serializePcf(layout);
    assert.ok(result.includes("elements:"));
    assert.ok(result.includes("plant: Potted Plant [living,decoration] 400x400"));
    assert.ok(result.includes("svg: <svg"));
    assert.ok(result.includes("source: generated"));
  });

  it("omits default scale, rotation, lockProportions", () => {
    const layout: FurnitureLayout = {
      placements: [
        {
          element: "default/bed",
          position: { x: 100, y: 200 },
          scaleWidth: 100,
          scaleDepth: 100,
          lockProportions: true,
          rotation: 0,
          room: "Room",
        },
      ],
    };
    const result = serializePcf(layout);
    assert.ok(!result.includes("scale="));
    assert.ok(!result.includes("rotation="));
    assert.ok(!result.includes("lockProportions="));
  });

  it("round-trips: parsePcf → serializePcf → parsePcf produces same layout", () => {
    const source = `furniture:

elements:
  plant: Potted Plant [living,decoration] 400x400
    svg: <svg width="400" height="400"><circle r="200"/></svg>
    source: generated

placements:
  place default/bed at 800,1100 in Studio
  place default/sofa at 4000,3450 in Studio scale=90
  place default/wardrobe at 600,2500 in Studio rotation=90
  place default/bed anchor north 0.3 0 in "Master Bedroom"
  place default/table rel 0.5,0.5 in "Living Room"
`;
    const first = parsePcf(source);
    const serialized = serializePcf(first);
    const second = parsePcf(serialized);

    assert.deepStrictEqual(second.placements, first.placements);
    assert.deepStrictEqual(second.elements, first.elements);
  });
});

// ── Auto-detection ──────────────────────────────────────────────────

describe("Layout auto-detection", () => {
  it("auto-detects JSONC format", () => {
    const jsonc = `{
  "placements": [
    { "element": "default/bed", "position": {"x": 800, "y": 1100}, "room": "Studio" }
  ]
}`;
    const layout = parseLayout(jsonc);
    assert.strictEqual(layout.placements.length, 1);
    assert.strictEqual(layout.placements[0].element, "default/bed");
  });

  it("auto-detects DSL format", () => {
    const dsl = `furniture:

placements:
  place default/bed at 800,1100 in Studio
`;
    const layout = parseLayout(dsl);
    assert.strictEqual(layout.placements.length, 1);
    assert.strictEqual(layout.placements[0].element, "default/bed");
  });

  it("produces identical layouts from both formats", () => {
    const jsonc = `{
  "placements": [
    { "element": "default/bed", "position": {"x": 800, "y": 1100}, "room": "Studio" },
    { "element": "default/sofa", "position": {"x": 4000, "y": 3450}, "room": "Studio", "scaleWidth": 90, "scaleDepth": 90 }
  ]
}`;
    const dsl = `furniture:

placements:
  place default/bed at 800,1100 in Studio
  place default/sofa at 4000,3450 in Studio scale=90
`;
    const fromJsonc = parseLayout(jsonc);
    const fromDsl = parseLayout(dsl);

    assert.strictEqual(fromJsonc.placements.length, fromDsl.placements.length);
    assert.strictEqual(fromJsonc.placements[0].element, fromDsl.placements[0].element);
    assert.deepStrictEqual(fromJsonc.placements[0].position, fromDsl.placements[0].position);
    assert.strictEqual(fromJsonc.placements[0].room, fromDsl.placements[0].room);
    assert.strictEqual(fromJsonc.placements[1].scaleWidth, fromDsl.placements[1].scaleWidth);
    assert.strictEqual(fromJsonc.placements[1].scaleDepth, fromDsl.placements[1].scaleDepth);
  });

  it("serializeLayout outputs DSL by default", () => {
    const layout: FurnitureLayout = {
      placements: [
        {
          element: "default/bed",
          position: { x: 800, y: 1100 },
          scaleWidth: 100,
          scaleDepth: 100,
          lockProportions: true,
          rotation: 0,
          room: "Studio",
        },
      ],
    };
    const result = serializeLayout(layout);
    assert.ok(result.includes("furniture:"));
    assert.ok(result.includes("place default/bed at 800,1100"));
  });

  it("serializeLayout with jsonc format outputs JSON", () => {
    const layout: FurnitureLayout = {
      placements: [
        {
          element: "default/bed",
          position: { x: 800, y: 1100 },
          scaleWidth: 100,
          scaleDepth: 100,
          lockProportions: true,
          rotation: 0,
          room: "Studio",
        },
      ],
    };
    const result = serializeLayout(layout, { format: "jsonc" });
    assert.ok(result.includes('"placements"'));
    assert.ok(result.includes('"element"'));
  });
});
