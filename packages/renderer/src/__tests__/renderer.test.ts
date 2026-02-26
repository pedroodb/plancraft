import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import { parse, resolve } from "@plancraft/dsl";
import { buildScene, buildSceneWithFurniture, emitSVG } from "../index.js";
import type { FurnitureLayout, FurniturePackage, FurnitureElement } from "@plancraft/furniture";

describe("Renderer", () => {
  const STUDIO = JSON.stringify({
    name: "Studio",
    scale: 100,
    unit: "mm",
    floors: [{
      name: "Ground Floor",
      rooms: [{
        name: "Studio",
        walls: [
          { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200 },
          { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
          { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
          { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
        ],
        doors: [
          { wall: "south", offset: 2000, width: 900, swing: "left" },
        ],
        windows: [
          { wall: "east", offset: 1000, width: 1200, height: 1400, sill: 900 },
        ],
      }],
      dimensions: [
        { wall: "north", room: "Studio", offset: 500 },
      ],
      labels: [
        { text: "Studio", position: "center" },
      ],
    }],
  });

  it("builds a scene graph from resolved AST", () => {
    const resolved = resolve(parse(STUDIO));
    const scene = buildScene(resolved);
    assert.equal(scene.type, "group");
    assert.equal(scene.id, "Studio");
    assert.ok(scene.children.length > 0);
  });

  it("emits valid SVG", () => {
    const resolved = resolve(parse(STUDIO));
    const scene = buildScene(resolved);
    const svg = emitSVG(scene, { scaleRatio: resolved.scale.ratio });

    assert.ok(svg.startsWith("<?xml"));
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("</svg>"));
    assert.ok(svg.includes("polygon")); // walls
    assert.ok(svg.includes("path")); // door arc
    assert.ok(svg.includes("text")); // label
  });

  it("contains wall polygons in SVG", () => {
    const resolved = resolve(parse(STUDIO));
    const scene = buildScene(resolved);
    const svg = emitSVG(scene, { scaleRatio: 100 });
    // 4 walls, but door splits south wall (2) and window splits east wall (2)
    // so total = 2 unsplit + 2 + 2 = 6
    const polygonMatches = svg.match(/<polygon/g);
    assert.ok(polygonMatches);
    assert.equal(polygonMatches.length, 6);
  });

  it("contains dimension text in SVG", () => {
    const resolved = resolve(parse(STUDIO));
    const scene = buildScene(resolved);
    const svg = emitSVG(scene, { scaleRatio: 100 });
    // Should contain the dimension length as text
    assert.ok(svg.includes("5000"));
  });

  it("handles multi-room plans with shared walls", () => {
    const source = JSON.stringify({
      name: "Multi",
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
              { direction: "west", from: { x: 5000, y: 4000 }, to: { x: 5000, y: 0 }, thickness: 200 },
            ],
          },
        ],
      }],
    });

    const resolved = resolve(parse(source));
    const scene = buildScene(resolved);
    const svg = emitSVG(scene, { scaleRatio: 100 });

    // Should have 7 wall polygons (4 for A + 3 for B, shared wall not duplicated)
    const polygonMatches = svg.match(/<polygon/g);
    assert.ok(polygonMatches);
    assert.equal(polygonMatches.length, 7);
  });

  it("renders furniture SVG embeds from .pcf layout", () => {
    const resolved = resolve(parse(STUDIO));

    // Create a mock furniture package with a simple element
    const mockElement: FurnitureElement = {
      id: "bed",
      meta: { name: "Double Bed", tags: ["bedroom", "sleeping"], defaultWidth: 1400, defaultDepth: 2000 },
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1400 2000"><rect x="0" y="0" width="1400" height="2000" fill="#e8e8e8" stroke="black"/></svg>',
      innerSvg: '<rect x="0" y="0" width="1400" height="2000" fill="#e8e8e8" stroke="black"/>',
      viewBoxWidth: 1400,
      viewBoxHeight: 2000,
    };

    const mockPackage: FurniturePackage = {
      name: "default",
      version: "1.0.0",
      description: "Test",
      dir: "/tmp",
      elements: new Map([["bed", mockElement]]),
    };

    const layout: FurnitureLayout = {
      placements: [
        { element: "default/bed", position: { x: 2000, y: 2000 }, scaleWidth: 100, scaleDepth: 100, lockProportions: true, rotation: 0 },
      ],
    };

    const scene = buildSceneWithFurniture(resolved, layout, [mockPackage]);
    const svg = emitSVG(scene, { scaleRatio: 100 });

    assert.ok(svg.includes("<svg"));
    // The embedded SVG content should appear in the output
    assert.ok(svg.includes('fill="#e8e8e8"'), "embedded furniture SVG content should be in output");
  });

  it("buildSceneWithFurniture without furniture matches buildScene", () => {
    const resolved = resolve(parse(STUDIO));
    const sceneA = buildScene(resolved);
    const sceneB = buildSceneWithFurniture(resolved);

    const svgA = emitSVG(sceneA, { scaleRatio: 100 });
    const svgB = emitSVG(sceneB, { scaleRatio: 100 });

    assert.equal(svgA, svgB);
  });

  it("renders curved walls as SVG paths", () => {
    const source = JSON.stringify({
      name: "Curved",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F",
        rooms: [{
          name: "Bay",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200, bulge: 0.3 },
            { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200 },
            { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
      }],
    });

    const resolved = resolve(parse(source));
    const scene = buildScene(resolved);
    const svg = emitSVG(scene, { scaleRatio: 100 });

    // The north wall should be an SVG path with arc commands (not a polygon)
    const pathMatches = svg.match(/<path[^>]*d="M[^"]*A[^"]*"/g);
    assert.ok(pathMatches, "SVG should contain a path element with arc commands");
    assert.ok(pathMatches.length >= 1, "At least one curved wall path expected");

    // Other 3 walls are still polygons
    const polygonMatches = svg.match(/<polygon/g);
    assert.ok(polygonMatches);
    assert.equal(polygonMatches.length, 3);
  });

  it("renders mixed straight and curved walls", () => {
    const source = JSON.stringify({
      name: "Mixed",
      scale: 100,
      unit: "mm",
      floors: [{
        name: "F",
        rooms: [{
          name: "R",
          walls: [
            { direction: "north", from: { x: 0, y: 0 }, to: { x: 5000, y: 0 }, thickness: 200, bulge: 0.2 },
            { direction: "east", from: { x: 5000, y: 0 }, to: { x: 5000, y: 4000 }, thickness: 200, bulge: -0.15 },
            { direction: "south", from: { x: 5000, y: 4000 }, to: { x: 0, y: 4000 }, thickness: 200 },
            { direction: "west", from: { x: 0, y: 4000 }, to: { x: 0, y: 0 }, thickness: 200 },
          ],
        }],
      }],
    });

    const resolved = resolve(parse(source));
    const scene = buildScene(resolved);
    const svg = emitSVG(scene, { scaleRatio: 100 });

    // 2 curved walls = 2 path elements
    const pathMatches = svg.match(/<path[^>]*d="M[^"]*A[^"]*"/g);
    assert.ok(pathMatches);
    assert.equal(pathMatches.length, 2, "Should have 2 curved wall paths");

    // 2 straight walls = 2 polygons
    const polygonMatches = svg.match(/<polygon/g);
    assert.ok(polygonMatches);
    assert.equal(polygonMatches.length, 2);
  });
});
