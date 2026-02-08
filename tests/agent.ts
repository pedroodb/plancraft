/**
 * Agent executor for the Plancraft test suite.
 * Refactored from test-agent.ts into a reusable module.
 */

import fs from "fs";
import path from "path";
import OpenAI from "openai";
import { parse, resolve } from "@plancraft/dsl";
import { buildScene, emitSVG } from "@plancraft/renderer";

// ── Types ────────────────────────────────────────────────────────────────

export interface AgentConfig {
  messages: Array<{
    role: "user";
    content: string;
    image?: string;
  }>;
  initialPlanSource?: string;
  maxIterations?: number;
}

export interface RoomInfo {
  name: string;
  areaM2: number;
  wallCount: number;
  doorCount: number;
  windowCount: number;
}

export interface CompileResult {
  success: boolean;
  error: string | null;
  roomCount: number;
  totalAreaM2: number;
  rooms: RoomInfo[];
  buildingEnvelope?: {
    widthMm: number;
    heightMm: number;
  };
}

export interface AgentResult {
  planSource: string;
  svgOutput: string | null;
  conversationLog: OpenAI.ChatCompletionMessageParam[];
  iterations: number;
  compilationResult: CompileResult;
}

// ── Config ───────────────────────────────────────────────────────────────

const REPO_ROOT = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  ".."
);

function loadApiKey(): string {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;
  try {
    const envFile = fs.readFileSync(
      path.join(REPO_ROOT, "packages/web/.env.local"),
      "utf-8"
    );
    return envFile.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

const MODEL = "gpt-5.2";
const DEFAULT_MAX_ITERATIONS = 30;

// ── System prompt builder ────────────────────────────────────────────────

const SKILL_DIR = path.join(REPO_ROOT, "skill/plancraft");
const RULES_DIR = path.join(SKILL_DIR, "rules");

function readFileSync(filePath: string): string {
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch {
    return "";
  }
}

const RULE_FILES = [
  "syntax-basics.md",
  "coordinates.md",
  "walls.md",
  "rooms.md",
  "openings.md",
  "furniture.md",
  "measurement-extraction.md",
  "structure-guide.md",
  "furniture-guide.md",
  "dimensions.md",
  "labels.md",
  "workflow.md",
];

function buildSystemPrompt(): string {
  const skill = readFileSync(path.join(SKILL_DIR, "SKILL.md"));
  const rules = RULE_FILES.map((f) => readFileSync(path.join(RULES_DIR, f)))
    .filter(Boolean)
    .join("\n\n---\n\n");

  return `You are Plancraft Assistant, an AI that helps users create and edit architectural floor plans using the Plancraft JSONC format.

## Your Capabilities

You can read the current floor plan, modify it, and replace it entirely. When the user asks you to create or edit a plan, use your tools to make the changes. Always aim for architectural accuracy.

## How You Work

- When the user asks for changes, first use get_plan to read the current plan
- Make changes using replace_plan (for large edits) or the granular tools (for small edits)
- After making changes, use get_compilation_result to verify the plan compiles correctly
- If there are compilation errors, fix them before responding
- Explain what you did in your response

## CRITICAL Rules — Follow These Exactly

### Units: ALWAYS Use Millimeters
- The \`"unit"\` field MUST always be \`"mm"\`
- ALL coordinates and measurements MUST be in millimeters
- Convert meter annotations immediately: 3.8m → 3800, 0.76m → 760
- Wall thickness: exterior 200mm, interior 150mm
- NEVER use meters, centimeters, or fractional values for coordinates

### Wall Thickness
- Exterior walls (building perimeter): thickness = 200
- Interior walls (between rooms): thickness = 150
- Do NOT use 120 or other non-standard values

### Coordinates
- Absolute (x, y) positions in millimeters
- Origin at bottom-left, X increases right, Y increases up
- Walls form closed polygons (last wall's \`to\` matches first wall's \`from\`)

### Room Ordering and Doors
- Define rooms that own shared walls before rooms that reference them
- Doors between two rooms MUST be placed in the FIRST room (the one that defines the shared wall)
- The second room (which uses sharedWalls) does NOT need to declare the door again
- EVERY room must be accessible — if a room has 0 doors in its definition AND is not the first room to define a shared wall with a door, the room is unreachable

### Minimum Room Sizes (realistic architecture — STRICTLY ENFORCED)
- Bathroom: minimum 3m² (e.g. 1500mm x 2000mm). NEVER below 3m².
- Bedroom: minimum 9m² (e.g. 3000mm x 3000mm). NEVER below 8m².
- Kitchen: minimum 7m² (e.g. 2500mm x 2800mm). NEVER below 6m².
- Hallway/Corridor: minimum 1.2m wide, but keep area SMALL relative to total. Hallways should NOT be the largest room.
- Living room: minimum 14m² (e.g. 3500mm x 4000mm). NEVER below 12m².
- Office: minimum 6m² (e.g. 2000mm x 3000mm).

### Area Allocation Principle
- Hallways, corridors, and passages should use at most 15% of total plan area
- The largest functional rooms (living, bedrooms, kitchen) should get the most area
- If total area is 80m², hallways/corridors should be under 12m² combined
- Always prioritize realistic room sizes over corridor generosity

### Windows
- Every habitable room (bedroom, living room, kitchen, office) SHOULD have at least one window
- Bathrooms and hallways may omit windows
- Windows improve livability and are expected in most rooms

### Corridor-Based Layouts (offices, clinics, schools)
When creating rooms along a corridor:
- Place the corridor FIRST, then rooms branch off from it
- Each room along the corridor must have its own door ON the corridor's shared wall
- Rooms on the north side of an east-west corridor: their y-coordinates start at corridor's north edge
- Rooms on the south side: their y-coordinates end at corridor's south edge
- Room depth (perpendicular to corridor) must match the specified size — do NOT compress rooms to fit
- If 3 rooms are "3m x 3.5m each along a corridor", the total corridor length must be at least 9m (3 rooms × 3m)
- The building envelope must accommodate: corridor width + room depth on each side

### L-Shaped and Non-Rectangular Rooms
- Use MORE than 4 walls with custom direction names (e.g. "step east", "step south")
- All wall segments must form a closed polygon
- The compiled bounding box of such rooms will be larger than their actual area

### Multi-Turn Conversations and Incremental Changes
- Users may design a plan across many messages, adding rooms one at a time
- ALWAYS use get_plan to read the current state before making changes
- When the user says "change X to Y" or "replace X with Y", modify the existing plan — do NOT start from scratch
- When adding a room to an existing plan, preserve all existing rooms exactly as they are
- If the user resizes a room, update ONLY that room's walls — keep everything else unchanged
- If the user changes their mind (e.g. "scratch the kitchen"), remove ONLY the specified room and add the replacement
- After each change, verify with get_compilation_result that all previously existing rooms still compile correctly
- Remember ALL prior user requests — the latest instruction refines but does not replace earlier ones unless explicitly stated
- When the user says "add furniture to all rooms", furnish EVERY room in the plan, not just the most recently added one

### When Reproducing a Floor Plan from an Image
Follow this strict workflow:

**STEP 1 — INVENTORY (output as text, before any tool calls):**
1. List ALL rooms visible in the image — EVERY enclosed space, including small hallways, stairwells, transition areas, closets
2. Use room names exactly as shown in the image, in the original language (do NOT translate)
3. Read and list EVERY annotated dimension from the image, converting to mm
4. Determine the total building footprint (width x height) in mm
5. Compute absolute coordinates for each room in mm
6. For non-rectangular rooms (L-shaped, T-shaped), list ALL wall segments
7. Map all doors (wall, offset, width, swing) and windows
8. List furniture visible in each room

**STEP 2 — STRUCTURE (Phase 1):**
- Create the plan with walls, doors, windows, stairs, labels, and dimensions
- Do NOT add furniture yet (except staircases)
- Use sharedWalls for adjacent rooms that share a wall
- After compilation, call get_compilation_result and verify:
  a. Room count matches your inventory
  b. Building envelope width and height match your measured total dimensions
  c. Each room's compiled area makes sense
- If envelope dimensions are wrong, fix room coordinates BEFORE proceeding

**STEP 3 — FURNITURE (Phase 2):**
- Furniture is managed separately in .pcf files (not inside the .pc structure)
- In this test environment, focus on getting the structure right
- Furniture placement is handled via a separate system

## Plancraft Reference

${skill}

## Detailed Rules

${rules}`;
}

// ── Tool definitions ─────────────────────────────────────────────────────

const TOOLS: OpenAI.ChatCompletionTool[] = [
  {
    type: "function",
    function: {
      name: "get_plan",
      description: "Get the current floor plan JSONC source code.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
  {
    type: "function",
    function: {
      name: "replace_plan",
      description:
        "Replace the entire floor plan with new JSONC source. Returns compilation status with room metrics and building envelope.",
      parameters: {
        type: "object",
        properties: {
          source: {
            type: "string",
            description: "The complete new JSONC source for the plan",
          },
        },
        required: ["source"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_compilation_result",
      description:
        "Compile the current plan and return detailed metrics: compilation status, room count, per-room areas, wall/door/window/furniture counts, and building envelope dimensions.",
      parameters: { type: "object", properties: {}, required: [] },
    },
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────

function stripJsonComments(source: string): string {
  let result = "";
  let i = 0;
  const len = source.length;
  while (i < len) {
    if (source[i] === '"') {
      result += '"';
      i++;
      while (i < len && source[i] !== '"') {
        if (source[i] === "\\") {
          result += source[i++];
          if (i < len) result += source[i++];
        } else {
          result += source[i++];
        }
      }
      if (i < len) {
        result += '"';
        i++;
      }
      continue;
    }
    if (source[i] === "/" && i + 1 < len && source[i + 1] === "/") {
      i += 2;
      while (i < len && source[i] !== "\n") i++;
      continue;
    }
    if (source[i] === "/" && i + 1 < len && source[i + 1] === "*") {
      i += 2;
      while (
        i < len &&
        !(source[i] === "*" && i + 1 < len && source[i + 1] === "/")
      )
        i++;
      i += 2;
      continue;
    }
    result += source[i++];
  }
  return result;
}

export function tryCompile(source: string): CompileResult {
  try {
    const ast = parse(source);
    const resolved = resolve(ast);
    buildScene(resolved);
    const rooms: RoomInfo[] = [];
    let gMinX = Infinity,
      gMinY = Infinity,
      gMaxX = -Infinity,
      gMaxY = -Infinity;

    for (const floor of resolved.floors) {
      for (const room of floor.rooms) {
        for (const wall of room.walls) {
          gMinX = Math.min(gMinX, wall.from.x, wall.to.x);
          gMinY = Math.min(gMinY, wall.from.y, wall.to.y);
          gMaxX = Math.max(gMaxX, wall.from.x, wall.to.x);
          gMaxY = Math.max(gMaxY, wall.from.y, wall.to.y);
        }
        rooms.push({
          name: room.name,
          areaM2: Math.round(room.area / 10000) / 100,
          wallCount: room.walls.length,
          doorCount: room.doors.length,
          windowCount: room.windows.length,
        });
      }
    }

    const roomCount = rooms.length;
    const totalArea = rooms.reduce((s, r) => s + r.areaM2, 0);
    return {
      success: true,
      error: null,
      roomCount,
      totalAreaM2: Math.round(totalArea * 100) / 100,
      rooms,
      buildingEnvelope:
        roomCount > 0
          ? {
              widthMm: gMaxX - gMinX,
              heightMm: gMaxY - gMinY,
            }
          : undefined,
    };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : String(e),
      roomCount: 0,
      totalAreaM2: 0,
      rooms: [],
    };
  }
}

export function renderSVG(source: string): string | null {
  try {
    const ast = parse(source);
    const resolved = resolve(ast);
    const scene = buildScene(resolved);
    return emitSVG(scene, { scaleRatio: resolved.scale.ratio });
  } catch {
    return null;
  }
}

// ── Agent executor ──────────────────────────────────────────────────────

export async function runAgent(config: AgentConfig): Promise<AgentResult> {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error("OPENAI_API_KEY not found");

  const openai = new OpenAI({ apiKey });
  const maxIter = config.maxIterations ?? DEFAULT_MAX_ITERATIONS;

  let currentPlanSource =
    config.initialPlanSource ??
    `{
  "name": "New Plan",
  "scale": 100,
  "unit": "mm",
  "floors": []
}`;

  const systemPrompt = buildSystemPrompt();

  // Build initial message array
  const messages: OpenAI.ChatCompletionMessageParam[] = [
    { role: "system", content: systemPrompt },
  ];

  // Track which user message to send next
  let nextMessageIndex = 0;

  function executeTool(
    name: string,
    args: Record<string, unknown>
  ): string {
    switch (name) {
      case "get_plan":
        return JSON.stringify({ source: currentPlanSource });
      case "replace_plan": {
        const source = args.source as string;
        currentPlanSource = source;
        const result = tryCompile(source);
        return JSON.stringify(result);
      }
      case "get_compilation_result":
        return JSON.stringify(tryCompile(currentPlanSource));
      default:
        return JSON.stringify({ error: `Unknown tool: ${name}` });
    }
  }

  function buildUserMessage(
    msg: AgentConfig["messages"][0]
  ): OpenAI.ChatCompletionMessageParam {
    if (msg.image) {
      const imgPath = path.isAbsolute(msg.image)
        ? msg.image
        : path.join(REPO_ROOT, msg.image);
      const imageData = fs.readFileSync(imgPath);
      const base64 = imageData.toString("base64");
      const ext = path.extname(imgPath).slice(1).toLowerCase();
      const mime =
        ext === "jpg" || ext === "jpeg"
          ? "image/jpeg"
          : ext === "png"
            ? "image/png"
            : "image/png";

      return {
        role: "user",
        content: [
          {
            type: "image_url",
            image_url: {
              url: `data:${mime};base64,${base64}`,
              detail: "high",
            },
          },
          { type: "text", text: msg.content },
        ],
      };
    }
    return { role: "user", content: msg.content };
  }

  // Send first user message
  messages.push(buildUserMessage(config.messages[nextMessageIndex]));
  nextMessageIndex++;

  let iterations = 0;
  let qualityFixAttempts = 0;
  const MAX_QUALITY_FIX_ATTEMPTS = 3;

  for (let i = 0; i < maxIter; i++) {
    iterations = i + 1;
    const logPrefix = `  [iter ${iterations}]`;

    const response = await openai.chat.completions.create({
      model: MODEL,
      messages,
      tools: TOOLS,
      tool_choice: "auto",

    });

    const choice = response.choices[0];
    const message = choice.message;
    messages.push(message);

    if (message.content && typeof message.content === "string") {
      console.log(
        `${logPrefix} Assistant text (${message.content.length} chars)`
      );
    }

    // Handle tool calls
    if (message.tool_calls && message.tool_calls.length > 0) {
      for (const tc of message.tool_calls) {
        let args: Record<string, unknown>;
        try {
          args = JSON.parse(tc.function.arguments);
        } catch {
          console.log(
            `${logPrefix} Tool ${tc.function.name}: FAILED TO PARSE ARGS`
          );
          messages.push({
            role: "tool",
            tool_call_id: tc.id,
            content: JSON.stringify({ error: "Failed to parse arguments" }),
          });
          continue;
        }

        const sourceLen = args.source ? String(args.source).length : 0;
        console.log(
          `${logPrefix} Tool: ${tc.function.name}${tc.function.name === "replace_plan" ? ` (${sourceLen} chars)` : ""}`
        );

        const result = executeTool(tc.function.name, args);
        const parsed = JSON.parse(result);

        if (parsed.success !== undefined) {
          console.log(
            `${logPrefix}   -> success=${parsed.success}, rooms=${parsed.roomCount}, area=${parsed.totalAreaM2?.toFixed(1)}m²${parsed.error ? `, error: ${parsed.error}` : ""}`
          );
          if (parsed.buildingEnvelope) {
            console.log(
              `${logPrefix}   -> envelope: ${parsed.buildingEnvelope.widthMm}mm x ${parsed.buildingEnvelope.heightMm}mm`
            );
          }
        }

        messages.push({
          role: "tool",
          tool_call_id: tc.id,
          content: result,
        });
      }
      continue;
    }

    // No tool calls — check state
    const compileCheck = tryCompile(currentPlanSource);

    if (compileCheck.roomCount === 0) {
      // Plan is still empty — prompt the agent to continue
      console.log(`${logPrefix} Plan empty — prompting Phase 1...`);
      messages.push({
        role: "user",
        content:
          "Great inventory! Now proceed to Phase 1: create the complete structure using replace_plan. Include ALL rooms from your inventory with walls, doors, windows, stairs, labels, and dimensions. Use millimeters for all coordinates.",
      });
      continue;
    }

    // Check if there's more user messages to send (multi-step tests)
    if (nextMessageIndex < config.messages.length) {
      // Provide a comprehensive state summary to help the agent maintain context
      const stateCheck = tryCompile(currentPlanSource);
      let stateInfo = "";
      if (stateCheck.roomCount > 0) {
        const roomSummary = stateCheck.rooms
          .map(r => {
            return `  - ${r.name}: ${r.areaM2}m², ${r.wallCount} walls, ${r.doorCount} doors, ${r.windowCount} windows`;
          })
          .join("\n");
        const envInfo = stateCheck.buildingEnvelope
          ? `Envelope: ${stateCheck.buildingEnvelope.widthMm}mm x ${stateCheck.buildingEnvelope.heightMm}mm`
          : "";

        // Build cumulative requirements summary from all previous user messages
        const prevMessages = config.messages.slice(0, nextMessageIndex);
        const reqSummary = prevMessages.map((m, idx) => `  ${idx + 1}. ${m.content.substring(0, 150)}${m.content.length > 150 ? "..." : ""}`).join("\n");

        stateInfo = `\n\n[CURRENT PLAN STATE — ${stateCheck.roomCount} rooms, ${stateCheck.totalAreaM2}m² total. ${envInfo}\n${roomSummary}

PREVIOUS USER REQUESTS (all must be reflected in the plan):
${reqSummary}

CRITICAL: When modifying the plan, use get_plan first, then replace_plan with the FULL updated source. You MUST preserve ALL existing rooms unless the user explicitly asks to remove/change a specific room. Do NOT rebuild from scratch — only add/modify what the user requests.]`;
      }
      console.log(
        `${logPrefix} Sending next user message (${nextMessageIndex + 1}/${config.messages.length})...`
      );
      const nextMsg = config.messages[nextMessageIndex];
      // Append state info to help the model track context
      const augmentedMsg = { ...nextMsg, content: nextMsg.content + stateInfo };
      messages.push(buildUserMessage(augmentedMsg));
      nextMessageIndex++;
      // Reset quality fix counter for new user message
      qualityFixAttempts = 0;
      continue;
    }

    // Check quality issues in the structure
    {
      const envInfo = compileCheck.buildingEnvelope
        ? `Building envelope: ${compileCheck.buildingEnvelope.widthMm}mm wide x ${compileCheck.buildingEnvelope.heightMm}mm tall`
        : "No envelope data";
      const roomList = compileCheck.rooms
        .map(
          (r) =>
            `  - ${r.name}: ${r.areaM2}m² (${r.wallCount} walls, ${r.doorCount} doors, ${r.windowCount} windows)`
        )
        .join("\n");

      const issues: string[] = [];
      const totalArea = compileCheck.rooms.reduce((s, r) => s + r.areaM2, 0);
      const hallwayArea = compileCheck.rooms
        .filter(r => r.name.toLowerCase().includes("hall") || r.name.toLowerCase().includes("corridor") || r.name.toLowerCase().includes("passage"))
        .reduce((s, r) => s + r.areaM2, 0);

      const isTinyPlan = totalArea < 35 || compileCheck.rooms.some(r => r.name.toLowerCase().includes("tiny") || r.name.toLowerCase().includes("studio"));

      for (const room of compileCheck.rooms) {
        const n = room.name.toLowerCase();
        if (room.doorCount === 0) {
          issues.push(`"${room.name}" has 0 doors — it's unreachable. Add a door to this room or to a neighboring room's shared wall.`);
        }
        if (!isTinyPlan) {
          if ((n.includes("bath") || n.includes("wc") || n.includes("restroom") || n.includes("toilet")) && room.areaM2 < 3) {
            issues.push(`"${room.name}" is only ${room.areaM2}m² — bathrooms need at least 3m². Resize it.`);
          } else if ((n.includes("bed") || n.includes("master")) && room.areaM2 < 8) {
            issues.push(`"${room.name}" is only ${room.areaM2}m² — bedrooms need at least 8m². Resize it.`);
          } else if (n.includes("kitchen") && room.areaM2 < 6) {
            issues.push(`"${room.name}" is only ${room.areaM2}m² — kitchens need at least 6m². Resize it.`);
          } else if ((n.includes("living") || n.includes("lounge") || n.includes("salon")) && room.areaM2 < 12) {
            issues.push(`"${room.name}" is only ${room.areaM2}m² — living rooms need at least 12m². Resize it.`);
          } else if (n.includes("office") && room.areaM2 < 5) {
            issues.push(`"${room.name}" is only ${room.areaM2}m² — offices need at least 5m². Resize it.`);
          } else if (n.includes("exam") && room.areaM2 < 9) {
            issues.push(`"${room.name}" is only ${room.areaM2}m² — exam rooms need at least 9m². Resize it.`);
          } else if (!n.includes("hall") && !n.includes("corridor") && !n.includes("passage") && !n.includes("balcony") && room.areaM2 < 2) {
            issues.push(`"${room.name}" is only ${room.areaM2}m² — unrealistically small. Resize to at least 3m².`);
          }
        }
      }

      if (!isTinyPlan && totalArea > 0 && hallwayArea / totalArea > 0.2) {
        issues.push(`Hallways/corridors use ${Math.round(hallwayArea / totalArea * 100)}% of total area. Reduce hallway area.`);
      }

      const habitableRooms = compileCheck.rooms.filter(r => {
        const n = r.name.toLowerCase();
        return !n.includes("hall") && !n.includes("corridor") && !n.includes("passage") &&
               !n.includes("bath") && !n.includes("wc") && !n.includes("restroom") &&
               !n.includes("garage") && !n.includes("stairs") && !n.includes("balcony");
      });
      const noWindows = habitableRooms.filter(r => r.windowCount === 0);
      if (noWindows.length > 0) {
        issues.push(`Rooms without windows: ${noWindows.map(r => `"${r.name}"`).join(", ")}. Add windows to habitable rooms.`);
      }

      const shouldFixIssues = issues.length > 0 && qualityFixAttempts < MAX_QUALITY_FIX_ATTEMPTS;
      if (issues.length > 0) qualityFixAttempts++;

      const prioritizedIssues = issues.slice(0, 3);

      if (shouldFixIssues) {
        const issueText = `\n\n**ISSUES TO FIX (${prioritizedIssues.length} of ${issues.length}):**\n${prioritizedIssues.join("\n")}\n\nFix these issues with replace_plan.`;
        console.log(
          `${logPrefix} Quality issues (${issues.length}, fix attempt ${qualityFixAttempts}/${MAX_QUALITY_FIX_ATTEMPTS})...`
        );
        messages.push({
          role: "user",
          content: `Structure review:\n\n${envInfo}\nTotal area: ${compileCheck.totalAreaM2}m²\nRooms:\n${roomList}${issueText}`,
        });
        continue;
      }
    }

    // Agent is done
    console.log(`${logPrefix} Agent finished.`);
    break;
  }

  // Generate SVG output
  const svgOutput = renderSVG(currentPlanSource);
  const compilationResult = tryCompile(currentPlanSource);

  return {
    planSource: currentPlanSource,
    svgOutput,
    conversationLog: messages,
    iterations,
    compilationResult,
  };
}
