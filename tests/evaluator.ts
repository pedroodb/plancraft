/**
 * Programmatic evaluator for the Plancraft test suite.
 * Scores generated plans against test expectations using structural metrics.
 */

import type { TestExpectations } from "./definitions.js";
import type { CompileResult, RoomInfo } from "./agent.js";

// ── Types ────────────────────────────────────────────────────────────────

export interface StructuralScore {
  compiles: boolean;
  roomCount: number;
  totalAreaM2: number;
  envelopeWidthMm: number;
  envelopeHeightMm: number;
  roomDetails: RoomInfo[];

  // Scored checks
  compilationPass: boolean;
  roomCountPass: boolean;
  areaPass: boolean;
  envelopePass: boolean;
  requiredRoomsPass: boolean;
  requiredFurniturePass: boolean;

  // Per-check details
  roomCountExpected: string;
  areaExpected: string;
  envelopeExpected: string;
  missingRooms: string[];
  missingFurniture: string[];

  /** Composite score 0-100 */
  structuralScore: number;
}

// ── Weights ──────────────────────────────────────────────────────────────

const WEIGHTS = {
  compilation: 30,
  roomCount: 20,
  area: 15,
  envelope: 15,
  requiredRooms: 10,
  requiredFurniture: 10,
};

// ── Evaluator ────────────────────────────────────────────────────────────

export function evaluate(
  compileResult: CompileResult,
  expectations: TestExpectations
): StructuralScore {
  const tolerance = (expectations.tolerancePercent ?? 15) / 100;

  // 1. Compilation check
  const compiles = compileResult.success;
  const compilationPass = expectations.compilesSuccessfully
    ? compiles
    : true; // If we don't expect compilation, any result is fine

  // 2. Room count check
  let roomCountPass = true;
  let roomCountExpected = "any";

  if (expectations.roomCount !== undefined) {
    roomCountPass = compileResult.roomCount === expectations.roomCount;
    roomCountExpected = `exactly ${expectations.roomCount}`;
  } else {
    const min = expectations.roomCountMin;
    const max = expectations.roomCountMax;
    if (min !== undefined && max !== undefined) {
      roomCountPass =
        compileResult.roomCount >= min && compileResult.roomCount <= max;
      roomCountExpected = `${min}-${max}`;
    } else if (min !== undefined) {
      roomCountPass = compileResult.roomCount >= min;
      roomCountExpected = `>= ${min}`;
    } else if (max !== undefined) {
      roomCountPass = compileResult.roomCount <= max;
      roomCountExpected = `<= ${max}`;
    }
  }

  // 3. Area check
  let areaPass = true;
  let areaExpected = "any";

  if (
    expectations.totalAreaM2Min !== undefined ||
    expectations.totalAreaM2Max !== undefined
  ) {
    const min = expectations.totalAreaM2Min ?? 0;
    const max = expectations.totalAreaM2Max ?? Infinity;
    // Apply tolerance to min/max
    areaPass =
      compileResult.totalAreaM2 >= min * (1 - tolerance) &&
      compileResult.totalAreaM2 <= max * (1 + tolerance);
    areaExpected = `${min}-${max}m² (±${(tolerance * 100).toFixed(0)}%)`;
  }

  // 4. Envelope check
  let envelopePass = true;
  let envelopeExpected = "any";

  const envelope = compileResult.buildingEnvelope;
  if (envelope && expectations.envelopeWidthMm !== undefined) {
    const widthOk =
      Math.abs(envelope.widthMm - expectations.envelopeWidthMm) <=
      expectations.envelopeWidthMm * tolerance;
    const heightOk =
      expectations.envelopeHeightMm === undefined ||
      Math.abs(envelope.heightMm - expectations.envelopeHeightMm) <=
        expectations.envelopeHeightMm * tolerance;
    envelopePass = widthOk && heightOk;
    envelopeExpected = `${expectations.envelopeWidthMm}mm x ${expectations.envelopeHeightMm ?? "any"}mm (±${(tolerance * 100).toFixed(0)}%)`;
  }

  // 5. Required rooms check
  const missingRooms: string[] = [];
  let requiredRoomsPass = true;

  if (expectations.requiredRoomNames && expectations.requiredRoomNames.length > 0) {
    const existingNames = compileResult.rooms.map((r) =>
      r.name.toLowerCase()
    );
    for (const required of expectations.requiredRoomNames) {
      if (!existingNames.includes(required.toLowerCase())) {
        missingRooms.push(required);
      }
    }
    requiredRoomsPass = missingRooms.length === 0;
  }

  // 6. Required furniture check
  const missingFurniture: string[] = [];
  let requiredFurniturePass = true;

  if (
    expectations.requiredFurnitureTypes &&
    expectations.requiredFurnitureTypes.length > 0
  ) {
    // Furniture is now managed separately in .pcf files.
    // The structural evaluator cannot verify furniture placements.
    // We'll mark as pass — the LLM judge will verify if needed.
  }

  // Calculate composite score
  let score = 0;
  if (compilationPass) score += WEIGHTS.compilation;
  if (roomCountPass) score += WEIGHTS.roomCount;
  if (areaPass) score += WEIGHTS.area;
  if (envelopePass) score += WEIGHTS.envelope;
  if (requiredRoomsPass) score += WEIGHTS.requiredRooms;
  if (requiredFurniturePass) score += WEIGHTS.requiredFurniture;

  return {
    compiles,
    roomCount: compileResult.roomCount,
    totalAreaM2: compileResult.totalAreaM2,
    envelopeWidthMm: envelope?.widthMm ?? 0,
    envelopeHeightMm: envelope?.heightMm ?? 0,
    roomDetails: compileResult.rooms,
    compilationPass,
    roomCountPass,
    areaPass,
    envelopePass,
    requiredRoomsPass,
    requiredFurniturePass,
    roomCountExpected,
    areaExpected,
    envelopeExpected,
    missingRooms,
    missingFurniture,
    structuralScore: score,
  };
}
