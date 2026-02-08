/**
 * One-time script to generate reference images for image-based test cases.
 * Uses gpt-image-1 via the OpenAI API for higher quality architectural images.
 *
 * Generates images for T15-T17. T18 reuses existing examples/tolosa.png.
 *
 * Usage: npx tsx tests/generate-images.ts
 */

import fs from "fs";
import path from "path";
import OpenAI from "openai";

const REPO_ROOT = path.resolve(
  import.meta.dirname ?? path.dirname(new URL(import.meta.url).pathname),
  ".."
);
const FIXTURES_DIR = path.join(REPO_ROOT, "tests/fixtures");

function loadApiKey(): string {
  const envKey = process.env.OPENAI_API_KEY;
  if (envKey) return envKey;
  // Try loading from .env file in repo root
  try {
    const envFile = fs.readFileSync(
      path.join(REPO_ROOT, ".env"),
      "utf-8"
    );
    return envFile.match(/OPENAI_API_KEY=(.+)/)?.[1]?.trim() ?? "";
  } catch {
    return "";
  }
}

interface ImageSpec {
  filename: string;
  prompt: string;
}

const IMAGE_SPECS: ImageSpec[] = [
  {
    filename: "T15-simple-blueprint.png",
    prompt: `Create a clean, minimal architectural floor plan blueprint on a white background.
Show exactly 2 rooms side by side:
- Left room labeled "Living Room" approximately 5.0m wide × 4.0m tall
- Right room labeled "Bedroom" approximately 3.5m wide × 4.0m tall
Include dimension annotations showing measurements on all exterior sides.
Use black lines for walls, standard architectural door swing arcs.
One door between the rooms (in the shared wall), one entrance door on the left exterior wall.
One window on the bottom wall of each room.
Professional architectural blueprint style with thin dimension lines and arrows.
No furniture — only walls, doors, windows, and dimension annotations.`,
  },
  {
    filename: "T16-apartment-photo.png",
    prompt: `Create a realistic top-down photograph of a real estate apartment floor plan printed on paper,
as if photographed from above on a desk. The plan shows a 3-bedroom apartment with:
- Living room (large, open area)
- Kitchen (adjacent to living room)
- 3 bedrooms of varying sizes
- 1 bathroom
- Hallway connecting rooms
The plan has room labels printed inside each room and some dimension markings.
The photo shows slight perspective distortion and shadows from being photographed
rather than scanned. Some areas are slightly cut off at the edges as if the photo
didn't capture the full sheet. Realistic photographic quality, not a computer render.`,
  },
  {
    filename: "T17-hand-drawn.png",
    prompt: `Create a hand-drawn floor plan sketch on white lined notebook paper, drawn with blue ballpoint pen.
The sketch shows a rough 3-room layout but is clearly incomplete:
- A large rectangular main room is drawn with dimensions "6m x 4m" written beside it
- A smaller room to the right has walls drawn but the label just says "bed?" with a question mark
- There's an arrow pointing to the bottom with "kitchen here?" written
- The bottom portion of the plan is left unfinished — just a few dashed lines suggesting where walls would go
- Some crossing-out and corrections are visible where the person changed their mind
- A few rough door arcs are sketched
- The overall impression is someone brainstorming a layout, not a finished plan
Realistic hand-drawn quality with slightly messy pen strokes on actual notebook paper.`,
  },
];

async function main() {
  const apiKey = loadApiKey();
  if (!apiKey) {
    console.error("Error: OPENAI_API_KEY not found");
    process.exit(1);
  }

  const openai = new OpenAI({ apiKey });

  // Ensure fixtures directory exists
  fs.mkdirSync(FIXTURES_DIR, { recursive: true });

  for (const spec of IMAGE_SPECS) {
    const outputPath = path.join(FIXTURES_DIR, spec.filename);

    if (fs.existsSync(outputPath)) {
      console.log(`Skipping ${spec.filename} (already exists)`);
      continue;
    }

    console.log(`Generating ${spec.filename} with gpt-image-1...`);

    try {
      const response = await openai.images.generate({
        model: "gpt-image-1",
        prompt: spec.prompt,
        n: 1,
        size: "1024x1024",
        quality: "high",
      });

      const imageData = response.data[0]?.b64_json;
      if (!imageData) {
        console.error(`  Failed: No image data returned for ${spec.filename}`);
        continue;
      }

      const buffer = Buffer.from(imageData, "base64");
      fs.writeFileSync(outputPath, buffer);
      console.log(
        `  Saved to ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`
      );
    } catch (e) {
      console.error(
        `  Failed to generate ${spec.filename}: ${e instanceof Error ? e.message : e}`
      );
      // Fallback to dall-e-3 if gpt-image-1 fails (e.g. org not verified)
      console.log(`  Retrying with dall-e-3...`);
      try {
        const response = await openai.images.generate({
          model: "dall-e-3",
          prompt: spec.prompt,
          n: 1,
          size: "1024x1024",
          quality: "standard",
          response_format: "b64_json",
        });
        const imageData = response.data[0]?.b64_json;
        if (imageData) {
          const buffer = Buffer.from(imageData, "base64");
          fs.writeFileSync(outputPath, buffer);
          console.log(
            `  Saved (dall-e-3 fallback) to ${outputPath} (${(buffer.length / 1024).toFixed(0)}KB)`
          );
        }
      } catch (e2) {
        console.error(
          `  Fallback also failed: ${e2 instanceof Error ? e2.message : e2}`
        );
      }
    }
  }

  console.log("\nDone! Reference images are in tests/fixtures/");
}

main().catch(console.error);
