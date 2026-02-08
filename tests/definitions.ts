/**
 * Test case definitions for the Plancraft Agent Test Suite.
 * 24 test cases covering text-only, image-based, multi-step, long-conversation, and modification scenarios.
 */

// ── Types ────────────────────────────────────────────────────────────────

export interface TestMessage {
  role: "user";
  content: string;
  /** Path to an image file to include with this message */
  image?: string;
}

export interface TestExpectations {
  compilesSuccessfully: boolean;
  roomCount?: number;
  roomCountMin?: number;
  roomCountMax?: number;
  totalAreaM2Min?: number;
  totalAreaM2Max?: number;
  requiredRoomNames?: string[];
  requiredFurnitureTypes?: string[];
  envelopeWidthMm?: number;
  envelopeHeightMm?: number;
  tolerancePercent?: number; // Default 15% for area/envelope checks
}

export type TestCategory = "text" | "image" | "multi-step" | "modification";

export interface TestCase {
  id: string;
  name: string;
  category: TestCategory;
  messages: TestMessage[];
  expectations: TestExpectations;
  referenceImage?: string;
  /** Path to an existing .pc file to load as the starting plan */
  initialPlan?: string;
  judgePrompt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────

const FIXTURES = "tests/fixtures";

// ── Test Case Definitions ────────────────────────────────────────────────

export const TEST_CASES: TestCase[] = [
  // ===================================================================
  // Category A: Text-only, specific requirements (6 tests)
  // ===================================================================

  {
    id: "T01",
    name: "Simple Studio",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Create a studio apartment, 5m x 4m, one door on the south wall, one window on the east wall.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCount: 1,
      totalAreaM2Min: 18,
      totalAreaM2Max: 22,
      envelopeWidthMm: 5000,
      envelopeHeightMm: 4000,
      tolerancePercent: 15,
    },
    judgePrompt:
      "The user asked for a simple studio apartment 5m x 4m with one door on the south wall and one window on the east wall. Evaluate whether the generated floor plan matches these requirements.",
  },

  {
    id: "T02",
    name: "Bathroom Layout",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design a bathroom 2.5m x 2.2m with a toilet, sink, and shower. Door on the south wall.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCount: 1,
      totalAreaM2Min: 4.5,
      totalAreaM2Max: 6.5,
      requiredFurnitureTypes: ["toilet", "sink", "shower"],
    },
    judgePrompt:
      "The user asked for a bathroom 2.5m x 2.2m with a toilet, sink, and shower, and a door on the south wall. Evaluate if all three fixtures are present and logically arranged.",
  },

  {
    id: "T03",
    name: "Exact Dimensions",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          'Create a room exactly 3800mm x 2600mm with a door on the north wall at offset 1500mm, width 900mm, left swing, and a window on the east wall at offset 500mm, width 1200mm.',
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCount: 1,
      envelopeWidthMm: 3800,
      envelopeHeightMm: 2600,
      tolerancePercent: 5,
    },
    judgePrompt:
      "The user specified exact dimensions: 3800mm x 2600mm room with a door at offset 1500mm on north wall and a window at offset 500mm on east wall. Evaluate precision of dimensions and opening placements.",
  },

  {
    id: "T04",
    name: "Sunroom with Windows",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design a sunroom 6m x 4m with windows on three walls (east, south, west). One door on the north wall.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCount: 1,
      totalAreaM2Min: 22,
      totalAreaM2Max: 26,
    },
    judgePrompt:
      "The user requested a sunroom 6m x 4m with windows on three walls (east, south, west) and a door on the north wall. Evaluate if windows are on the correct three walls.",
  },

  {
    id: "T05",
    name: "Furnished Bedroom",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Create a master bedroom 4m x 5m with a double bed, wardrobe, desk, and chair. Door on the west wall.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCount: 1,
      totalAreaM2Min: 18,
      totalAreaM2Max: 22,
      requiredFurnitureTypes: ["bed", "wardrobe", "desk", "chair"],
    },
    judgePrompt:
      "The user requested a master bedroom 4m x 5m with bed, wardrobe, desk, chair, and door on west wall. Evaluate if all furniture is present and logically placed.",
  },

  {
    id: "T06",
    name: "Kitchen with Appliances",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design a kitchen 3.5m x 3m with counter along the north wall, stove, sink, fridge, and a door on the south wall.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCount: 1,
      totalAreaM2Min: 9,
      totalAreaM2Max: 12,
      requiredFurnitureTypes: ["counter", "stove", "sink", "fridge"],
    },
    judgePrompt:
      "The user asked for a kitchen 3.5m x 3m with counter, stove, sink, fridge, and door on south wall. Evaluate if all appliances are present and counter is along the north wall.",
  },

  // ===================================================================
  // Category B: Text-only, multi-room (5 tests)
  // ===================================================================

  {
    id: "T07",
    name: "Two-Bedroom Apartment",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design a two-bedroom apartment with living room, kitchen, bathroom, and a hallway connecting them. Total footprint approximately 10m x 8m.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 5,
      roomCountMax: 7,
      totalAreaM2Min: 60,
      totalAreaM2Max: 100,
    },
    judgePrompt:
      "The user requested a two-bedroom apartment with living room, kitchen, bathroom, and hallway, ~10m x 8m footprint. Evaluate if all rooms are present and logically connected.",
  },

  {
    id: "T08",
    name: "House with Garage",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design a house with a double garage, 2 bedrooms, kitchen, living room, and bathroom. The garage should have a large opening for cars.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 5,
      roomCountMax: 8,
    },
    judgePrompt:
      "The user asked for a house with double garage, 2 bedrooms, kitchen, living room, and bathroom with large garage opening. Evaluate if all rooms are present and garage is appropriately sized.",
  },

  {
    id: "T09",
    name: "Office Space",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design a small office: reception area, 2 private offices, a meeting room, kitchenette, and a bathroom. Approximately 100m² total.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 5,
      roomCountMax: 8,
      totalAreaM2Min: 80,
      totalAreaM2Max: 130,
    },
    judgePrompt:
      "The user requested an office space with reception, 2 offices, meeting room, kitchenette, and bathroom, ~100m². Evaluate if all rooms are present with logical office layout.",
  },

  {
    id: "T10",
    name: "L-Shaped House",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design an L-shaped house with living room, kitchen, 2 bedrooms, and bathroom. The L-shape should be clearly visible in the layout.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 4,
      roomCountMax: 7,
    },
    judgePrompt:
      "The user asked for an L-shaped house with living room, kitchen, 2 bedrooms, and bathroom. The L-shape must be clearly visible. Evaluate layout shape and room presence.",
  },

  {
    id: "T11",
    name: "Open Plan Living",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Create an open-plan living+dining area 8m x 5m connected to a separate kitchen 4m x 3m and a bathroom 2m x 2.5m, with a hallway.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 3,
      roomCountMax: 5,
      totalAreaM2Min: 45,
      totalAreaM2Max: 65,
    },
    judgePrompt:
      "The user requested an open-plan living+dining 8mx5m, kitchen 4mx3m, bathroom 2mx2.5m, and hallway. Evaluate if rooms are correctly sized and connected.",
  },

  // ===================================================================
  // Category C: Vague / creative requests (3 tests)
  // ===================================================================

  {
    id: "T12",
    name: "Vague Couple Apartment",
    category: "text",
    messages: [
      {
        role: "user",
        content: "I need a cozy apartment for a young couple.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 2,
      totalAreaM2Min: 25,
    },
    judgePrompt:
      "The user vaguely asked for 'a cozy apartment for a young couple'. Evaluate if the plan is a reasonable interpretation with at least bedroom, bathroom/kitchen, and furniture.",
  },

  {
    id: "T13",
    name: "Cafe Layout",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design a small neighborhood cafe with seating, a service counter, kitchen, and a restroom.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 3,
      roomCountMax: 6,
    },
    judgePrompt:
      "The user asked for a small cafe with seating, counter, kitchen, and restroom. Evaluate if all spaces are present with logical cafe flow.",
  },

  {
    id: "T14",
    name: "Tiny House",
    category: "text",
    messages: [
      {
        role: "user",
        content:
          "Design a tiny house, approximately 25 square meters, with everything a person needs to live comfortably.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 1,
      roomCountMax: 4,
      totalAreaM2Min: 20,
      totalAreaM2Max: 35,
    },
    judgePrompt:
      "The user requested a tiny house ~25m² with everything for comfortable living. Evaluate if sleeping, cooking, bathing areas and furniture are present within the area constraint.",
  },

  // ===================================================================
  // Category D: Image-based (4 tests)
  // ===================================================================

  {
    id: "T15",
    name: "Blueprint Replication",
    category: "image",
    messages: [
      {
        role: "user",
        content:
          "Replicate this floor plan as accurately as possible. Follow all annotated dimensions. Use millimeters for all coordinates.",
        image: `${FIXTURES}/T15-simple-blueprint.png`,
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 2,
      roomCountMax: 3,
    },
    referenceImage: `${FIXTURES}/T15-simple-blueprint.png`,
    judgePrompt:
      "The user provided a simple 2-room blueprint with dimension annotations and asked for exact replication. Evaluate how accurately the generated plan matches in room count, proportions, and layout.",
  },

  {
    id: "T16",
    name: "Photo as Loose Reference",
    category: "image",
    messages: [
      {
        role: "user",
        content:
          "I like the general layout in this image, but I only need 2 bedrooms instead of 3, and make the kitchen bigger. Use it as inspiration, not an exact copy.",
        image: `${FIXTURES}/T16-apartment-photo.png`,
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 4,
      roomCountMax: 7,
    },
    referenceImage: `${FIXTURES}/T16-apartment-photo.png`,
    judgePrompt:
      "The user provided an apartment photo as LOOSE REFERENCE and asked for modifications: only 2 bedrooms instead of 3, and a bigger kitchen. Evaluate if the agent adapted the reference rather than copying it exactly, kept the general layout spirit, and applied the requested changes (2 bedrooms, larger kitchen).",
  },

  {
    id: "T17",
    name: "Incomplete Sketch + Verbal Details",
    category: "image",
    messages: [
      {
        role: "user",
        content:
          "Here's a rough sketch I drew. The main room should be about 6m x 4m. Where I wrote 'kitchen here?' at the bottom, make that a 3m x 3m kitchen. The room marked 'bed?' should be a 3m x 4m bedroom. Add a small bathroom (2m x 2m) that I forgot to draw — put it next to the bedroom.",
        image: `${FIXTURES}/T17-hand-drawn.png`,
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 3,
      roomCountMax: 5,
      totalAreaM2Min: 35,
      totalAreaM2Max: 55,
    },
    referenceImage: `${FIXTURES}/T17-hand-drawn.png`,
    judgePrompt:
      "The user provided an INCOMPLETE hand-drawn sketch and filled in details verbally: main room 6mx4m, kitchen 3mx3m at bottom, bedroom 3mx4m, plus a bathroom 2mx2m (not in sketch). Evaluate if the agent correctly interpreted the partial sketch AND incorporated the verbal specifications for missing parts.",
  },

  {
    id: "T18",
    name: "Real Plan (Tolosa)",
    category: "image",
    messages: [
      {
        role: "user",
        content: `Replicate this floor plan as accurately as possible.

IMPORTANT — follow the mandatory workflow:
1. FIRST, output a complete inventory BEFORE calling any tools
2. THEN create the structure (Phase 1) — walls, doors, windows, stairs
3. THEN add furniture (Phase 2)

ALL coordinates must be in millimeters. Unit must be "mm".`,
        image: "examples/tolosa.png",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 8,
      totalAreaM2Min: 70,
    },
    referenceImage: "examples/tolosa.png",
    judgePrompt:
      "The user provided a real architectural floor plan (Tolosa) with many rooms and detailed dimensions. Evaluate how accurately the generated plan replicates the reference in room count, proportions, and arrangement.",
  },

  // ===================================================================
  // Category E: Multi-step / modification (2 tests)
  // ===================================================================

  {
    id: "T19",
    name: "Build Then Regret",
    category: "multi-step",
    messages: [
      {
        role: "user",
        content:
          "Create a rectangular building 10m x 7m with 3 rooms: a living room, bedroom, and kitchen.",
      },
      {
        role: "user",
        content:
          "Actually, scratch the kitchen. I changed my mind — replace it with a home office instead, same size. And add a bathroom (2m x 2m) that I forgot.",
      },
      {
        role: "user",
        content: "Now add furniture to all rooms.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 3,
      roomCountMax: 5,
      totalAreaM2Min: 55,
      totalAreaM2Max: 80,
    },
    judgePrompt:
      "The user built incrementally with a REGRET: first created 3 rooms (living, bedroom, kitchen), then changed kitchen to home office and added a bathroom, then furnished everything. Evaluate if the final plan has NO kitchen, HAS a home office, HAS a bathroom, and all rooms have furniture.",
  },

  {
    id: "T20",
    name: "Modify Existing Plan",
    category: "modification",
    messages: [
      {
        role: "user",
        content:
          "Add a bathroom (2.5m x 2m) to the east side of the studio, with a door connecting them. Add a toilet, sink, and shower to the bathroom.",
      },
    ],
    initialPlan: "examples/studio-apartment.pc",
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 2,
      requiredFurnitureTypes: ["toilet", "sink", "shower"],
    },
    judgePrompt:
      "The user started with a studio apartment and asked to add a bathroom on the east side with connecting door and toilet, sink, shower. Evaluate if the bathroom was correctly added adjacent to the studio.",
  },

  // ===================================================================
  // Category F: Long-running conversations (4 tests)
  // ===================================================================

  {
    id: "T21",
    name: "Room-by-Room House Design",
    category: "multi-step",
    messages: [
      {
        role: "user",
        content: "I want to design a family house. Let's start with a big living room, about 6m x 5m. Just the living room for now.",
      },
      {
        role: "user",
        content: "Nice! Now add a kitchen next to it on the east side, about 4m x 3.5m. Put a door between them.",
      },
      {
        role: "user",
        content: "Add a hallway along the north side of both rooms, 1.5m wide, running the full width of the house.",
      },
      {
        role: "user",
        content: "Now add two bedrooms off the hallway on the north side. The master bedroom should be 4m x 4m and the second bedroom 3.5m x 3.5m.",
      },
      {
        role: "user",
        content: "Add a bathroom between the two bedrooms, about 2.5m x 2.5m, with doors from the hallway.",
      },
      {
        role: "user",
        content: "The master bedroom needs a window on the north wall, and actually, can you add an en-suite bathroom (2m x 2m) to the master bedroom on its east side?",
      },
      {
        role: "user",
        content: "Now furnish everything. The living room should have a sofa, table, and chairs. Kitchen should have a counter, stove, fridge, and sink. Bedrooms need beds and wardrobes. Bathrooms need toilet, sink, and shower.",
      },
      {
        role: "user",
        content: "Wait, the second bedroom is too small. Make it 4m x 4m instead. And add a window on its north wall too.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 7,
      roomCountMax: 9,
      totalAreaM2Min: 70,
    },
    judgePrompt:
      "This was built INCREMENTALLY across 8 messages. PRIMARY FOCUS: did the agent maintain ALL rooms across the conversation? Expected rooms: living room, kitchen, hallway, master bedroom with en-suite bathroom, second bedroom, and a shared bathroom (7+ rooms total). All rooms should have furniture. The second bedroom was resized in the last message. Score HIGH if all rooms are present with furniture. Dimension accuracy is secondary — focus on completeness and coherence.",
  },

  {
    id: "T22",
    name: "Vague to Specific Refinement",
    category: "multi-step",
    messages: [
      {
        role: "user",
        content: "I need a place to live.",
      },
      {
        role: "user",
        content: "It should be an apartment, something around 60 square meters.",
      },
      {
        role: "user",
        content: "I'd like two bedrooms and a bathroom.",
      },
      {
        role: "user",
        content: "Actually, make one of the bedrooms an office instead. I work from home.",
      },
      {
        role: "user",
        content: "The living area should be open plan with the kitchen. Like one big combined space.",
      },
      {
        role: "user",
        content: "For the office, I need a desk, chair, and a bookshelf (use a wardrobe for the bookshelf).",
      },
      {
        role: "user",
        content: "Can you make sure there are windows in every room except the bathroom? And the main entrance should be on the south wall of the living area.",
      },
      {
        role: "user",
        content: "One more thing — add a small balcony area (2m x 1m, just a room with no roof essentially) accessible from the living room through a sliding door on the west wall.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 4,
      roomCountMax: 7,
      totalAreaM2Min: 50,
      totalAreaM2Max: 75,
    },
    judgePrompt:
      "This was a gradual refinement from vague to specific across 8 messages. PRIMARY FOCUS: did the agent track evolving requirements? Key checks: (1) ONE bedroom, not two — the second was changed to an office in message 4. (2) An office room exists with desk/chair/wardrobe. (3) A bathroom exists. (4) Windows in habitable rooms. (5) A main entrance door. A balcony is a bonus. Score HIGH if the bedroom-to-office change was correctly applied and all core rooms are present. Exact dimensions are secondary.",
  },

  {
    id: "T23",
    name: "Iterative Dimension Tweaking",
    category: "multi-step",
    messages: [
      {
        role: "user",
        content: "Create a rectangular room, 5m x 4m. Put a door on the south wall.",
      },
      {
        role: "user",
        content: "Make it wider — 6m x 4m instead.",
      },
      {
        role: "user",
        content: "Actually, let's go with 7m x 4.5m. I need more space.",
      },
      {
        role: "user",
        content: "Add a window on the east wall, and another on the north wall.",
      },
      {
        role: "user",
        content: "The door should be 1m wide, not the standard size. Move it to be centered on the south wall.",
      },
      {
        role: "user",
        content: "Now split this into two rooms with an interior wall at x=4000. The left room is the living room, the right room is the dining room. Put a door in the dividing wall.",
      },
      {
        role: "user",
        content: "Hmm, move the dividing wall to x=3500 instead. Living room should be a bit smaller.",
      },
      {
        role: "user",
        content: "Perfect. Add a sofa and table to the living room, and a table with 4 chairs to the dining room.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCount: 2,
      envelopeWidthMm: 7000,
      envelopeHeightMm: 4500,
      tolerancePercent: 10,
    },
    judgePrompt:
      "The user iteratively tweaked dimensions across 8 messages. Final state should be: 7m x 4.5m total, split into living room (3.5m wide) and dining room (3.5m wide) by a wall at x=3500. The south door should be 1m wide and centered. Living room: sofa + table. Dining room: table + 4 chairs. Evaluate if the FINAL dimensions are correct (not earlier values) and furniture matches the last instruction.",
  },

  {
    id: "T24",
    name: "Design a Medical Clinic",
    category: "multi-step",
    messages: [
      {
        role: "user",
        content: "I'm designing a small medical clinic. Start with a waiting room, about 5m x 6m, with the main entrance on the south wall. Put a reception counter at the north side of the waiting room.",
      },
      {
        role: "user",
        content: "Now add a corridor running east from the waiting room, about 8m long and 1.5m wide.",
      },
      {
        role: "user",
        content: "Along the north side of the corridor, add 3 examination rooms, each 3m x 3.5m. Number them Exam 1, Exam 2, Exam 3. Each needs a desk, a chair, and a bed (for the patient examination table).",
      },
      {
        role: "user",
        content: "At the end of the corridor, add a staff room (3m x 3m) with a table, chairs, and a counter with sink.",
      },
      {
        role: "user",
        content: "Add TWO bathrooms: one for patients accessible from the waiting room, and one for staff accessible from the corridor near the staff room. Each bathroom should be about 2.5m x 2m with a toilet and sink.",
      },
      {
        role: "user",
        content: "Add at least 6 chairs to the waiting room for seating. The waiting room also needs a window on the west wall. Now furnish any rooms that don't have furniture yet.",
      },
    ],
    expectations: {
      compilesSuccessfully: true,
      roomCountMin: 8,
      roomCountMax: 11,
      totalAreaM2Min: 50,
    },
    judgePrompt:
      "This was a medical clinic designed INCREMENTALLY across 6 messages. PRIMARY EVALUATION CRITERIA: conversation coherence and completeness. Score HIGH if: (1) ALL 8 room types are present: waiting room, corridor, Exam 1, Exam 2, Exam 3, staff room, patient bathroom, staff bathroom. (2) The waiting room has chairs and a reception counter. (3) Exam rooms have desk/chair/bed. (4) Staff room has furniture. (5) Both bathrooms exist with fixtures. Proportional/dimension differences are acceptable for this multi-step test — focus on whether the agent maintained ALL rooms and elements across messages.",
  },
];
