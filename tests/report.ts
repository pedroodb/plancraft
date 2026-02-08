/**
 * Report generator for the Plancraft Agent Test Suite.
 * Aggregates test results into markdown and JSON reports.
 */

import fs from "fs";
import path from "path";
import type { StructuralScore } from "./evaluator.js";
import type { JudgeResult } from "./judge.js";
import type { TestCategory } from "./definitions.js";

// ── Types ────────────────────────────────────────────────────────────────

export interface TestResult {
  testId: string;
  testName: string;
  category: TestCategory;
  durationMs: number;
  iterations: number;
  structuralScore: StructuralScore;
  judgeResult: JudgeResult | null;
  passed: boolean;
  error?: string;
}

// ── Report Generator ─────────────────────────────────────────────────────

export function generateReport(
  results: TestResult[],
  outputDir: string
): string {
  const reportMd = buildMarkdownReport(results);
  const reportPath = path.join(outputDir, "report.md");
  fs.writeFileSync(reportPath, reportMd, "utf-8");

  // Also save as JSON
  const jsonPath = path.join(outputDir, "report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), "utf-8");

  return reportPath;
}

function buildMarkdownReport(results: TestResult[]): string {
  const lines: string[] = [];
  const now = new Date().toISOString();

  // Header
  lines.push("# Plancraft Agent Test Suite Report");
  lines.push("");
  lines.push(`**Generated:** ${now}`);
  lines.push(`**Tests run:** ${results.length}`);
  lines.push(
    `**Passed:** ${results.filter((r) => r.passed).length}/${results.length}`
  );
  lines.push(
    `**Total duration:** ${(results.reduce((s, r) => s + r.durationMs, 0) / 1000).toFixed(1)}s`
  );
  lines.push("");

  // Summary table
  lines.push("## Summary");
  lines.push("");
  lines.push(
    "| ID | Name | Category | Structural | Judge | Result | Duration |"
  );
  lines.push(
    "|:---|:-----|:---------|:-----------|:------|:-------|:---------|"
  );

  for (const r of results) {
    const structural = `${r.structuralScore.structuralScore}/100`;
    const judge =
      r.judgeResult !== null ? `${r.judgeResult.overallScore}/100` : "—";
    const result = r.passed ? "PASS" : "**FAIL**";
    const duration = `${(r.durationMs / 1000).toFixed(1)}s`;
    lines.push(
      `| ${r.testId} | ${r.testName} | ${r.category} | ${structural} | ${judge} | ${result} | ${duration} |`
    );
  }
  lines.push("");

  // Category breakdown
  lines.push("## By Category");
  lines.push("");

  const categories = [...new Set(results.map((r) => r.category))];
  for (const cat of categories) {
    const catResults = results.filter((r) => r.category === cat);
    const catPassed = catResults.filter((r) => r.passed).length;
    const avgStructural =
      catResults.reduce((s, r) => s + r.structuralScore.structuralScore, 0) /
      catResults.length;
    const judged = catResults.filter((r) => r.judgeResult !== null);
    const avgJudge =
      judged.length > 0
        ? judged.reduce((s, r) => s + (r.judgeResult?.overallScore ?? 0), 0) /
          judged.length
        : null;

    lines.push(
      `### ${cat} (${catPassed}/${catResults.length} passed)`
    );
    lines.push(
      `- Average structural score: ${avgStructural.toFixed(1)}/100`
    );
    if (avgJudge !== null) {
      lines.push(`- Average judge score: ${avgJudge.toFixed(1)}/100`);
    }
    lines.push("");
  }

  // Detailed results
  lines.push("## Detailed Results");
  lines.push("");

  for (const r of results) {
    lines.push(`### ${r.testId}: ${r.testName}`);
    lines.push("");
    lines.push(`- **Category:** ${r.category}`);
    lines.push(`- **Result:** ${r.passed ? "PASS" : "FAIL"}`);
    lines.push(`- **Duration:** ${(r.durationMs / 1000).toFixed(1)}s`);
    lines.push(`- **Iterations:** ${r.iterations}`);

    if (r.error) {
      lines.push(`- **Error:** ${r.error}`);
    }

    lines.push("");
    lines.push("**Structural Evaluation:**");
    lines.push("");
    lines.push(`| Check | Status | Details |`);
    lines.push(`|:------|:-------|:--------|`);
    lines.push(
      `| Compilation | ${r.structuralScore.compilationPass ? "PASS" : "FAIL"} | compiles=${r.structuralScore.compiles} |`
    );
    lines.push(
      `| Room count | ${r.structuralScore.roomCountPass ? "PASS" : "FAIL"} | got=${r.structuralScore.roomCount}, expected=${r.structuralScore.roomCountExpected} |`
    );
    lines.push(
      `| Area | ${r.structuralScore.areaPass ? "PASS" : "FAIL"} | got=${r.structuralScore.totalAreaM2}m², expected=${r.structuralScore.areaExpected} |`
    );
    lines.push(
      `| Envelope | ${r.structuralScore.envelopePass ? "PASS" : "FAIL"} | got=${r.structuralScore.envelopeWidthMm}x${r.structuralScore.envelopeHeightMm}mm, expected=${r.structuralScore.envelopeExpected} |`
    );
    lines.push(
      `| Required rooms | ${r.structuralScore.requiredRoomsPass ? "PASS" : "FAIL"} | missing=${r.structuralScore.missingRooms.length > 0 ? r.structuralScore.missingRooms.join(", ") : "none"} |`
    );
    lines.push(
      `| Required furniture | ${r.structuralScore.requiredFurniturePass ? "PASS" : "FAIL"} | missing=${r.structuralScore.missingFurniture.length > 0 ? r.structuralScore.missingFurniture.join(", ") : "none"} |`
    );
    lines.push(
      `| **Total** | **${r.structuralScore.structuralScore}/100** | |`
    );
    lines.push("");

    if (r.structuralScore.roomDetails.length > 0) {
      lines.push("**Rooms:**");
      lines.push("");
      lines.push(
        "| Room | Area | Walls | Doors | Windows |"
      );
      lines.push(
        "|:-----|:-----|:------|:------|:--------|:----------|"
      );
      for (const room of r.structuralScore.roomDetails) {
        lines.push(
          `| ${room.name} | ${room.areaM2}m² | ${room.wallCount} | ${room.doorCount} | ${room.windowCount} |`
        );
      }
      lines.push("");
    }

    if (r.judgeResult) {
      lines.push("**LLM Judge Evaluation:**");
      lines.push("");
      lines.push(
        `| Criterion | Score | Justification |`
      );
      lines.push(`|:----------|:------|:--------------|`);
      lines.push(
        `| Spec adherence | ${r.judgeResult.criteria.specificationAdherence}/5 | ${r.judgeResult.justifications.specificationAdherence} |`
      );
      lines.push(
        `| Spatial layout | ${r.judgeResult.criteria.spatialLayout}/5 | ${r.judgeResult.justifications.spatialLayout} |`
      );
      lines.push(
        `| Proportions | ${r.judgeResult.criteria.proportions}/5 | ${r.judgeResult.justifications.proportions} |`
      );
      lines.push(
        `| Completeness | ${r.judgeResult.criteria.completeness}/5 | ${r.judgeResult.justifications.completeness} |`
      );
      if (r.judgeResult.criteria.visualSimilarity !== undefined) {
        lines.push(
          `| Visual similarity | ${r.judgeResult.criteria.visualSimilarity}/5 | ${r.judgeResult.justifications.visualSimilarity ?? ""} |`
        );
      }
      lines.push(
        `| **Overall** | **${r.judgeResult.overallScore}/100** | |`
      );
      lines.push("");
      lines.push(`> ${r.judgeResult.summary}`);
      lines.push("");
    }

    lines.push("---");
    lines.push("");
  }

  // Failing tests section
  const failures = results.filter((r) => !r.passed);
  if (failures.length > 0) {
    lines.push("## Failing Tests");
    lines.push("");
    for (const r of failures) {
      const reasons: string[] = [];
      if (!r.structuralScore.compilationPass) reasons.push("compilation failed");
      if (!r.structuralScore.roomCountPass)
        reasons.push(
          `room count mismatch (got ${r.structuralScore.roomCount}, expected ${r.structuralScore.roomCountExpected})`
        );
      if (!r.structuralScore.areaPass)
        reasons.push(
          `area out of range (got ${r.structuralScore.totalAreaM2}m², expected ${r.structuralScore.areaExpected})`
        );
      if (!r.structuralScore.envelopePass) reasons.push("envelope mismatch");
      if (r.judgeResult && r.judgeResult.overallScore < 60)
        reasons.push(
          `judge score too low (${r.judgeResult.overallScore}/100)`
        );
      if (r.error) reasons.push(`error: ${r.error}`);

      lines.push(
        `- **${r.testId} ${r.testName}**: ${reasons.join("; ")}`
      );
    }
    lines.push("");
  }

  return lines.join("\n");
}
