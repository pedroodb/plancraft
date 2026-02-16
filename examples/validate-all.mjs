#!/usr/bin/env node
/**
 * Comprehensive validation of example .pcf files.
 * Checks spatial issues AND reports each placement's position relative to room.
 */
import { parse, resolve } from "../packages/dsl/dist/index.js";
import { parseLayout, resolveAnchors } from "../packages/furniture/dist/index.js";
import { computeRoomGeometries, validateFurniturePlacement, computeSpatialMetrics } from "../packages/renderer/dist/index.js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load default manifest for element dimensions
const manifest = JSON.parse(fs.readFileSync(
  path.join(__dirname, "../packages/furniture/elements/default/manifest.json"), "utf-8"
));
const defaultElements = manifest.elements;

const pcFiles = fs.readdirSync(__dirname).filter(f => f.endsWith('.pc'));

for (const pcFile of pcFiles) {
  const planName = pcFile.replace('.pc', '');
  const pcPath = path.join(__dirname, pcFile);
  const pcfPath = path.join(__dirname, `${planName}.pcf`);
  
  if (!fs.existsSync(pcfPath)) continue;
  
  console.log(`\n${"=".repeat(70)}`);
  console.log(`  ${planName}`);
  console.log(`${"=".repeat(70)}`);
  
  const planSource = fs.readFileSync(pcPath, 'utf-8');
  const furnSource = fs.readFileSync(pcfPath, 'utf-8');
  
  const ast = parse(planSource);
  const resolved = resolve(ast);
  const geometries = computeRoomGeometries(resolved);
  const layout = parseLayout(furnSource);
  const resolvedLayout = resolveAnchors(layout, geometries);
  
  // Build room lookup
  const roomMap = new Map();
  for (const geo of geometries) {
    roomMap.set(geo.name, geo);
  }
  
  // Check each placement in detail
  for (let i = 0; i < resolvedLayout.placements.length; i++) {
    const p = resolvedLayout.placements[i];
    const elementId = p.element.replace("default/", "");
    const elemDef = layout.elements?.[p.element] || layout.elements?.[elementId];
    const defaultDef = defaultElements[elementId];
    
    const baseW = elemDef?.defaultWidth || defaultDef?.defaultWidth || 500;
    const baseD = elemDef?.defaultDepth || defaultDef?.defaultDepth || 500;
    const w = baseW * (p.scaleWidth / 100);
    const d = baseD * (p.scaleDepth / 100);
    
    // Compute AABB considering rotation
    const rad = (p.rotation * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    const effW = w * cos + d * sin;
    const effD = w * sin + d * cos;
    
    const minX = Math.round(p.position.x - effW/2);
    const maxX = Math.round(p.position.x + effW/2);
    const minY = Math.round(p.position.y - effD/2);
    const maxY = Math.round(p.position.y + effD/2);
    
    const room = p.room ? roomMap.get(p.room) : null;
    let issues = [];
    
    if (room) {
      const ib = room.innerBoundingBox;
      // Check if outside room
      if (minX < ib.minX - 50) issues.push(`LEFT edge ${minX} past wall at ${Math.round(ib.minX)}`);
      if (maxX > ib.maxX + 50) issues.push(`RIGHT edge ${maxX} past wall at ${Math.round(ib.maxX)}`);
      if (minY < ib.minY - 50) issues.push(`BOTTOM edge ${minY} past wall at ${Math.round(ib.minY)}`);
      if (maxY > ib.maxY + 50) issues.push(`TOP edge ${maxY} past wall at ${Math.round(ib.maxY)}`);
      
      // Check door clearance (furniture in door swing area)
      // Parse doors from the plan source for this room
      for (const floor of resolved.floors) {
        for (const rm of floor.rooms) {
          if (rm.name === p.room) {
            for (const door of (rm.doors || [])) {
              // Door sweep is roughly a quarter circle from the hinge point
              // We check if furniture overlaps the door opening area
              const wall = rm.walls.find(w => w.direction === door.wall);
              if (!wall) continue;
              
              const wdx = wall.to.x - wall.from.x;
              const wdy = wall.to.y - wall.from.y;
              const wlen = Math.sqrt(wdx*wdx + wdy*wdy);
              if (wlen === 0) continue;
              
              const ux = wdx / wlen;
              const uy = wdy / wlen;
              
              // Door hinge position along wall
              const hingeX = wall.from.x + ux * door.offset;
              const hingeY = wall.from.y + uy * door.offset;
              
              // Door end position
              const endX = hingeX + ux * door.width;
              const endY = hingeY + uy * door.width;
              
              // Door opening area (roughly rectangular extending inward)
              const nx = -uy; // normal into room
              const ny = ux;
              const toCenter = {
                x: room.center.x - (hingeX + endX)/2,
                y: room.center.y - (hingeY + endY)/2,
              };
              const dot = nx * toCenter.x + ny * toCenter.y;
              const sign = dot >= 0 ? 1 : -1;
              
              // Door swing area extends door.width into the room from the opening
              const doorMinX = Math.min(hingeX, endX) + (sign > 0 ? 0 : -door.width) * Math.abs(nx);
              const doorMaxX = Math.max(hingeX, endX) + (sign > 0 ? door.width : 0) * Math.abs(nx);
              const doorMinY = Math.min(hingeY, endY) + (sign > 0 ? 0 : -door.width) * Math.abs(ny);
              const doorMaxY = Math.max(hingeY, endY) + (sign > 0 ? door.width : 0) * Math.abs(ny);
              
              // Simple overlap check with furniture AABB
              if (minX < doorMaxX && maxX > doorMinX && minY < doorMaxY && maxY > doorMinY) {
                if (door.swing !== "sliding") {
                  issues.push(`NEAR door swing (${door.wall} wall, ${door.swing} swing)`);
                }
              }
            }
          }
        }
      }
    }
    
    const status = issues.length > 0 ? `⚠ ${issues.join("; ")}` : "✓";
    const dimStr = `${Math.round(w)}×${Math.round(d)}mm`;
    const rotStr = p.rotation ? ` rot=${p.rotation}°` : "";
    console.log(`  [${i}] ${p.element} (${dimStr}${rotStr}) in ${p.room || "?"}`);
    console.log(`      center=(${p.position.x}, ${p.position.y})  bbox=[${minX},${minY}]-[${maxX},${maxY}]  ${status}`);
  }
  
  // Run standard spatial validation
  const warnings = validateFurniturePlacement(resolvedLayout, resolved);
  const metrics = computeSpatialMetrics(warnings);
  console.log(`\n  Summary: ${resolvedLayout.placements.length} items | wall=${metrics.furnitureWallOverlaps} mutual=${metrics.furnitureMutualOverlaps} out=${metrics.furnitureOutOfRoom}`);
  if (warnings.length > 0) {
    for (const w of warnings) {
      console.log(`    ⚠ ${w.message}`);
    }
  }
}
