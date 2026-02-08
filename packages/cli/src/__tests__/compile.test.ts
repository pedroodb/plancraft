import { describe, it } from "node:test";
import * as assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import { compile } from "../commands/compile.js";

describe("CLI compile", () => {
  const examplesDir = path.resolve(__dirname, "../../../../examples");
  const tmpDir = path.resolve(__dirname, "../../.test-output");

  it("compiles studio-apartment.pc to valid SVG", () => {
    const input = path.join(examplesDir, "studio-apartment.pc");
    const output = path.join(tmpDir, "studio-test.svg");

    fs.mkdirSync(tmpDir, { recursive: true });
    compile(input, { output });

    assert.ok(fs.existsSync(output));
    const svg = fs.readFileSync(output, "utf-8");
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("</svg>"));
    assert.ok(svg.includes("polygon")); // walls
    assert.ok(svg.includes("Studio")); // label

    // Clean up
    fs.rmSync(tmpDir, { recursive: true });
  });

  it("compiles two-bedroom.pc to valid SVG", () => {
    const input = path.join(examplesDir, "two-bedroom.pc");
    const output = path.join(tmpDir, "two-bedroom-test.svg");

    fs.mkdirSync(tmpDir, { recursive: true });
    compile(input, { output });

    assert.ok(fs.existsSync(output));
    const svg = fs.readFileSync(output, "utf-8");
    assert.ok(svg.includes("<svg"));
    assert.ok(svg.includes("Living Room"));
    assert.ok(svg.includes("Kitchen"));

    // Clean up
    fs.rmSync(tmpDir, { recursive: true });
  });
});
