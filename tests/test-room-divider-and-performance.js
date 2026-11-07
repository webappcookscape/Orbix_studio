// tests/test-room-divider-and-performance.js
// Verification suite for Room Divider feature and 3D Zero-Lag / Realism optimizations.

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Room Divider & 3D Zero-Lag Performance ---');

// Mock browser globals for node testing
if (typeof window === 'undefined') {
  global.window = {
    innerWidth: 1920,
    innerHeight: 1080,
    devicePixelRatio: 2,
    addEventListener: () => {},
    removeEventListener: () => {}
  };
}
if (typeof document === 'undefined') {
  global.document = {
    createElement: (tag) => {
      if (tag === 'canvas') {
        return {
          getContext: () => ({
            createLinearGradient: () => ({ addColorStop: () => {} }),
            createRadialGradient: () => ({ addColorStop: () => {} }),
            fillRect: () => {},
            strokeRect: () => {},
            beginPath: () => {},
            arc: () => {},
            fill: () => {},
            stroke: () => {}
          }),
          width: 512,
          height: 512
        };
      }
      return { appendChild: () => {}, style: {}, classList: { add: () => {}, remove: () => {} } };
    },
    getElementById: () => null,
    querySelectorAll: () => []
  };
}

const Core = require('../orbix-core.js');

// ── Test 1: Core Geometry Model for Room Divider ──
console.log('\n[Test 1] Core Geometry Model for Room Divider');
const div = Core.createRoomDivider({
  start: { x: 1000, y: 0 },
  end: { x: 1000, y: 3000 }
});
assert.strictEqual(div.isDivider, true, 'isDivider should be true');
assert.strictEqual(div.thickness, 0, 'Divider thickness should be 0');
assert.strictEqual(div.height, 0, 'Divider height should be 0');
assert.ok(div.id.startsWith('divider_') || div.id.startsWith('divider-'), 'Divider ID should start with divider_');

// Wall polygon for divider should be empty array
const divPoly = Core.wallPolygon(div);
assert.deepStrictEqual(divPoly, [], 'wallPolygon for room divider must be empty (no collision)');
console.log('✓ createRoomDivider and wallPolygon verified.');

// ── Test 2: Planar Room Detection Across Room Divider ──
console.log('\n[Test 2] Planar Room Detection Across Room Divider');
const project = Core.createProject();
project.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }),
  Core.createWall({ start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } }),
  Core.createWall({ start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } }),
  Core.createWall({ start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } }),
  // Divider splitting the 4m x 3m space into two 2m x 3m rooms
  Core.createRoomDivider({ start: { x: 2000, y: 0 }, end: { x: 2000, y: 3000 } })
];

const rooms = Core.detectRooms(project);
assert.strictEqual(rooms.length, 2, 'Detecting rooms should find 2 separate rooms divided by the divider');
const totalArea = rooms.reduce((sum, r) => sum + r.areaSqM, 0);
assert.ok(Math.abs(totalArea - 12.0) < 0.2, `Total area should be ~12 sqm, got ${totalArea}`);
console.log(`✓ Room detection divided 4x3m area into 2 independent rooms (${rooms[0].name}: ${rooms[0].areaSqM.toFixed(1)} m², ${rooms[1].name}: ${rooms[1].areaSqM.toFixed(1)} m²).`);

// ── Test 3: SubdivideWalls Preserves Divider Flag ──
console.log('\n[Test 3] subdivideWalls Preserves Divider Flag');
const segments = Core.subdivideWalls(project.plan.walls, 60);
const dividerSegs = segments.filter(s => s.isDivider);
assert.ok(dividerSegs.length > 0, 'Dividers must retain isDivider: true through subdivision');
console.log(`✓ Subdivide walls preserved ${dividerSegs.length} divider segment(s).`);

// ── Test 4: HTML Toolbar & CSS Styling ──
console.log('\n[Test 4] HTML Toolbar & CSS Styling for Room Divider');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(html.includes('id="planDividerBtn"'), 'index.html must include planDividerBtn');
assert.ok(html.includes('data-tool="divider"'), 'index.html must include data-tool="divider"');
assert.ok(html.includes('✂ Room Divider'), 'index.html must have "✂ Room Divider" label');

const css = fs.readFileSync(path.join(__dirname, '../style.css'), 'utf8');
assert.ok(css.includes('.plan-tool-btn[data-tool="divider"].is-active'), 'style.css must have active styles for divider tool');
console.log('✓ HTML button and CSS active styles verified.');

// ── Test 5: 3D Architectural Divider Threshold Strip ──
console.log('\n[Test 5] 3D Architectural Divider Threshold Strip in orbix-3d.js');
const orbix3dSrc = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');
assert.ok(orbix3dSrc.includes('buildDividerThreshold'), 'orbix-3d.js must have buildDividerThreshold method');
assert.ok(orbix3dSrc.includes('isDivider'), 'orbix-3d.js must check isDivider to skip solid wall extrusion');
assert.ok(orbix3dSrc.includes('DividerThreshold_'), 'orbix-3d.js must name threshold group DividerThreshold_');
console.log('✓ 3D floor transition threshold strip verified.');

// ── Test 6: Zero-Lag Performance & 3D Realism in app.js ──
console.log('\n[Test 6] Zero-Lag Performance & 3D Realism in app.js');
const appSrc = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
assert.ok(appSrc.includes('cachedStageRect'), 'app.js must cache stage bounding rect to prevent layout thrashing');
assert.ok(appSrc.includes('requestRender'), 'app.js must use requestRender with requestAnimationFrame');
assert.ok(appSrc.includes('keyL.shadow.mapSize.set(2048, 2048)'), 'app.js must use 2048x2048 shadow map for zero-lag rendering');
assert.ok(appSrc.includes('Math.min(1.5, window.devicePixelRatio'), 'app.js must cap device pixel ratio to 1.5 to protect GPU fill-rate');
console.log('✓ Caching stage rect, rAF debounced rendering, 2048 shadow map, and 1.5 DPR cap verified.');

// ── Test 7: 2D Plan Studio Interaction & Inspector ──
console.log('\n[Test 7] 2D Plan Studio Interaction & Inspector');
const planSrc = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
assert.ok(planSrc.includes('Finish Room Divider'), 'orbix-plan.js must support finishing room divider');
assert.ok(planSrc.includes('Draw Room Divider'), 'orbix-plan.js must push Draw Room Divider history');
assert.ok(planSrc.includes('✂ ROOM DIVIDER'), 'orbix-plan.js must render ✂ ROOM DIVIDER badge');

const uiSrc = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
assert.ok(uiSrc.includes('✂ Room Divider'), 'orbix-ui.js inspector must display ✂ Room Divider');
assert.ok(uiSrc.includes('Delete Room Divider'), 'orbix-ui.js inspector must have Delete Room Divider button');
console.log('✓ 2D Plan Studio divider tool, rendering, and inspector verified.');

console.log('\nALL ROOM DIVIDER & ZERO-LAG PERFORMANCE TESTS PASSED PERFECTLY!');
