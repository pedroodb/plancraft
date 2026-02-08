/**
 * Test runner CLI for the Plancraft Agent Test Suite.
 *
 * Usage:
 *   npx tsx tests/runner.ts                     # Run all tests
 *   npx tsx tests/runner.ts T01 T07 T15         # Run specific tests
 *   npx tsx tests/runner.ts --category text     # Run by category
 *   npx tsx tests/runner.ts --no-judge          # Skip LLM judge
 *   npx tsx tests/runner.ts --parallel 3        # Run 3 tests in parallel
 */

import fs from "fs";
import path from "path";
import { TEST_CASES, type TestCase, type TestCategory } from "./definitions.js";
import { runAgent, type CompileResult } from "./agent.js";
import { evaluate, type StructuralScore } from "./evaluator.js";
import { judgeResult, type JudgeResult } from "./judge.js";
import { generateReport, type TestResult } from "./report.js";

// ── Config ───────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const RESULTS_DIR = path.join(REPO_ROOT, "tests/results");

// ── CLI Argument Parsing ─────────────────────────────────────────────────

interface RunnerOptions {
  testIds: string[];
  category?: TestCategory;
  skipJudge: boolean;
  parallel: number;
}

function parseArgs(): RunnerOptions {
  const args = process.argv.slice(2);
  const options: RunnerOptions = {
    testIds: [],
    skipJudge: false,
    parallel: 5, // Default to 5 concurrent tests for speed
  };

  let i = 0;
  while (i < args.length) {
    const arg = args[i];
    if (arg === "--no-judge") {
      options.skipJudge = true;
    } else if (arg === "--category" && i + 1 < args.length) {
      options.category = args[++i] as TestCategory;
    } else if (arg === "--parallel" && i + 1 < args.length) {
      options.parallel = parseInt(args[++i], 10) || 1;
    } else if (arg === "--help" || arg === "-h") {
      console.log(`Plancraft Agent Test Suite Runner

Usage:
  npx tsx tests/runner.ts                     Run all tests
  npx tsx tests/runner.ts T01 T07 T15         Run specific tests
  npx tsx tests/runner.ts --category text     Run by category (text|image|multi-step|modification)
  npx tsx tests/runner.ts --no-judge          Skip LLM judge (structural only)
  npx tsx tests/runner.ts --parallel 3        Run N tests concurrently (default: 1)
`);
      process.exit(0);
    } else if (!arg.startsWith("--")) {
      options.testIds.push(arg.toUpperCase());
    }
    i++;
  }

  return options;
}

// ── Test Execution ──────────────────────────────────────────────────────

async function runSingleTest(
  testCase: TestCase,
  skipJudge: boolean
): Promise<TestResult> {
  const testDir = path.join(RESULTS_DIR, testCase.id);
  fs.mkdirSync(testDir, { recursive: true });

  console.log(`\n${"=".repeat(60)}`);
  console.log(`Running test ${testCase.id}: ${testCase.name} [${testCase.category}]`);
  console.log(`${"=".repeat(60)}`);

  const startTime = Date.now();

  // Load initial plan if specified
  let initialPlanSource: string | undefined;
  if (testCase.initialPlan) {
    const planPath = path.isAbsolute(testCase.initialPlan)
      ? testCase.initialPlan
      : path.join(REPO_ROOT, testCase.initialPlan);
    initialPlanSource = fs.readFileSync(planPath, "utf-8");
  }

  // Run agent
  let agentResult;
  try {
    // Use higher iteration limit for multi-step tests with many messages
    const maxIterations = testCase.messages.length > 3 ? 50 : undefined;

    agentResult = await runAgent({
      messages: testCase.messages,
      initialPlanSource,
      maxIterations,
    });
  } catch (e) {
    const error = e instanceof Error ? e.message : String(e);
    console.error(`  Agent execution failed: ${error}`);
    return {
      testId: testCase.id,
      testName: testCase.name,
      category: testCase.category,
      durationMs: Date.now() - startTime,
      iterations: 0,
      structuralScore: createFailedStructuralScore(error),
      judgeResult: null,
      passed: false,
      error,
    };
  }

  // Save outputs
  fs.writeFileSync(
    path.join(testDir, "plan.pc"),
    agentResult.planSource,
    "utf-8"
  );
  if (agentResult.svgOutput) {
    fs.writeFileSync(
      path.join(testDir, "output.svg"),
      agentResult.svgOutput,
      "utf-8"
    );
  }
  fs.writeFileSync(
    path.join(testDir, "conversation.json"),
    JSON.stringify(
      agentResult.conversationLog.map((m) => ({
        role: m.role,
        content:
          typeof m.content === "string"
            ? m.content.substring(0, 500)
            : "(complex content)",
        ...(("tool_calls" in m && m.tool_calls)
          ? {
              tool_calls: m.tool_calls.map((tc) => ({
                name: tc.function.name,
                args_length: tc.function.arguments.length,
              })),
            }
          : {}),
      })),
      null,
      2
    ),
    "utf-8"
  );

  // Run programmatic evaluation
  const structScore = evaluate(
    agentResult.compilationResult,
    testCase.expectations
  );

  console.log(`\n  Structural Score: ${structScore.structuralScore}/100`);
  console.log(`    Compiles: ${structScore.compilationPass ? "PASS" : "FAIL"}`);
  console.log(
    `    Room count: ${structScore.roomCount} (expected: ${structScore.roomCountExpected}) ${structScore.roomCountPass ? "PASS" : "FAIL"}`
  );
  console.log(
    `    Area: ${structScore.totalAreaM2}m² (expected: ${structScore.areaExpected}) ${structScore.areaPass ? "PASS" : "FAIL"}`
  );
  console.log(
    `    Envelope: ${structScore.envelopeWidthMm}mm x ${structScore.envelopeHeightMm}mm (expected: ${structScore.envelopeExpected}) ${structScore.envelopePass ? "PASS" : "FAIL"}`
  );

  // Run LLM judge
  let judgeScore: JudgeResult | null = null;
  if (!skipJudge) {
    console.log(`  Running LLM judge...`);
    try {
      const compilationSummary = [
        `Compiles: ${structScore.compiles}`,
        `Rooms: ${structScore.roomCount}`,
        `Total area: ${structScore.totalAreaM2}m²`,
        `Envelope: ${structScore.envelopeWidthMm}mm x ${structScore.envelopeHeightMm}mm`,
        `Room details:`,
        ...structScore.roomDetails.map(
          (r) =>
            `  - ${r.name}: ${r.areaM2}m², ${r.wallCount} walls, ${r.doorCount} doors, ${r.windowCount} windows`
        ),
      ].join("\n");

      // Extract conversation log for multi-step tests
      const isMultiStep = testCase.category === "multi-step" || testCase.messages.length > 2;
      let conversationLog: string | undefined;
      if (isMultiStep) {
        // Extract user messages and key agent actions
        conversationLog = agentResult.conversationLog
          .filter(m => {
            if (m.role === "user") return true;
            if (m.role === "assistant" && typeof (m as { content?: string }).content === "string") return true;
            return false;
          })
          .map(m => {
            const content = typeof (m as { content?: string }).content === "string"
              ? ((m as { content: string }).content).substring(0, 500)
              : "[tool calls]";
            return `[${m.role}]: ${content}`;
          })
          .join("\n\n");
      }

      judgeScore = await judgeResult({
        testName: `${testCase.id}: ${testCase.name}`,
        judgePrompt: testCase.judgePrompt,
        svgSource: agentResult.svgOutput,
        planSource: agentResult.planSource,
        compilationSummary,
        referenceImagePath: testCase.referenceImage,
        conversationLog,
        isMultiStep,
      });

      console.log(`  Judge Score: ${judgeScore.overallScore}/100`);
      console.log(`  Judge Summary: ${judgeScore.summary}`);
    } catch (e) {
      console.error(
        `  Judge failed: ${e instanceof Error ? e.message : e}`
      );
    }
  }

  // Determine pass/fail
  const structuralPassed = structScore.structuralScore >= 70;
  const judgePassed = judgeScore ? judgeScore.overallScore >= 60 : true;
  const passed = structuralPassed && judgePassed;

  const durationMs = Date.now() - startTime;

  console.log(
    `\n  Result: ${passed ? "PASS" : "FAIL"} (structural=${structScore.structuralScore}, judge=${judgeScore?.overallScore ?? "skipped"}) in ${(durationMs / 1000).toFixed(1)}s`
  );

  // Save detailed result
  const result: TestResult = {
    testId: testCase.id,
    testName: testCase.name,
    category: testCase.category,
    durationMs,
    iterations: agentResult.iterations,
    structuralScore: structScore,
    judgeResult: judgeScore,
    passed,
  };

  fs.writeFileSync(
    path.join(testDir, "result.json"),
    JSON.stringify(result, null, 2),
    "utf-8"
  );

  return result;
}

function createFailedStructuralScore(error: string): StructuralScore {
  return {
    compiles: false,
    roomCount: 0,
    totalAreaM2: 0,
    envelopeWidthMm: 0,
    envelopeHeightMm: 0,
    roomDetails: [],
    compilationPass: false,
    roomCountPass: false,
    areaPass: false,
    envelopePass: false,
    requiredRoomsPass: false,
    requiredFurniturePass: false,
    roomCountExpected: "N/A",
    areaExpected: "N/A",
    envelopeExpected: "N/A",
    missingRooms: [],
    missingFurniture: [],
    structuralScore: 0,
  };
}

// ── Parallel Execution ──────────────────────────────────────────────────

async function runTestsInBatches(
  tests: TestCase[],
  batchSize: number,
  skipJudge: boolean
): Promise<TestResult[]> {
  const results: TestResult[] = [];

  for (let i = 0; i < tests.length; i += batchSize) {
    const batch = tests.slice(i, i + batchSize);
    const batchResults = await Promise.all(
      batch.map((t) => runSingleTest(t, skipJudge))
    );
    results.push(...batchResults);
  }

  return results;
}

// ── Main ─────────────────────────────────────────────────────────────────

async function main() {
  const options = parseArgs();

  // Filter test cases
  let tests = TEST_CASES;

  if (options.testIds.length > 0) {
    tests = tests.filter((t) => options.testIds.includes(t.id));
    if (tests.length === 0) {
      console.error(
        `No matching tests found for: ${options.testIds.join(", ")}`
      );
      process.exit(1);
    }
  }

  if (options.category) {
    tests = tests.filter((t) => t.category === options.category);
    if (tests.length === 0) {
      console.error(`No tests found in category: ${options.category}`);
      process.exit(1);
    }
  }

  console.log(`\nPlancraft Agent Test Suite`);
  console.log(`========================`);
  console.log(`Tests to run: ${tests.length}`);
  console.log(`LLM Judge: ${options.skipJudge ? "DISABLED" : "ENABLED"}`);
  console.log(`Parallelism: ${options.parallel}`);
  console.log();

  // Ensure results directory
  fs.mkdirSync(RESULTS_DIR, { recursive: true });

  // Run tests
  const startTime = Date.now();
  const results =
    options.parallel > 1
      ? await runTestsInBatches(tests, options.parallel, options.skipJudge)
      : await runTestsInBatches(tests, 1, options.skipJudge);

  const totalDuration = Date.now() - startTime;

  // Generate report
  console.log(`\n${"=".repeat(60)}`);
  console.log(`Generating report...`);
  const reportPath = generateReport(results, RESULTS_DIR);
  console.log(`Report saved to: ${reportPath}`);

  // Print summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n${"=".repeat(60)}`);
  console.log(`RESULTS: ${passed}/${results.length} passed, ${failed} failed`);
  console.log(`Total time: ${(totalDuration / 1000).toFixed(1)}s`);
  console.log(`${"=".repeat(60)}\n`);

  if (failed > 0) {
    console.log("Failed tests:");
    for (const r of results.filter((r) => !r.passed)) {
      console.log(
        `  ${r.testId}: ${r.testName} (structural=${r.structuralScore.structuralScore}, judge=${r.judgeResult?.overallScore ?? "N/A"})`
      );
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(`Fatal error: ${e instanceof Error ? e.message : e}`);
  process.exit(1);
});
