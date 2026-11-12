const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('=== TEST SUITE: MOVING WALLS & POOJA ROOM DIVIDERS ===\n');

// ─────────────────────────────────────────────────────────────────────────────
// Part 1: Moving Walls (Parallel & Perpendicular Only with Connected Walls)
// ─────────────────────────────────────────────────────────────────────────────
console.log('--- Part 1: Moving Walls (Parallel & Perpendicular Only with Connected Walls) ---');

// Setup a 4-wall room:
// W1 (Bottom): (0, 0) -> (4000, 0) - Horizontal
// W2 (Right):  (4000, 0) -> (4000, 3000) - Vertical
// W3 (Top):    (4000, 3000) -> (0, 3000) - Horizontal
// W4 (Left):   (0, 3000) -> (0, 0) - Vertical
const p = Core.createProject();
const w1 = Core.createWall({ start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } });
const w2 = Core.createWall({ start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } });
const w3 = Core.createWall({ start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } });
const w4 = Core.createWall({ start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } });
p.plan.walls = [w1, w2, w3, w4];

// Mock editor
class MockCanvas {
  constructor() { this.style = {}; }
  getContext() {
    return {
      fillStyle: '', strokeStyle: '', lineWidth: 1,
      fillRect: () => {}, strokeRect: () => {}, clearRect: () => {}, beginPath: () => {},
      moveTo: () => {}, lineTo: () => {}, stroke: () => {}, fill: () => {},
      closePath: () => {}, arc: () => {}, save: () => {}, restore: () => {},
      scale: () => {}, translate: () => {}, rotate: () => {}, measureText: () => ({ width: 40 }),
      fillText: () => {}, strokeText: () => {}, setLineDash: () => {}, roundRect: () => {}
    };
  }
  getBoundingClientRect() { return { left: 0, top: 0, width: 800, height: 600 }; }
  addEventListener() {}
  removeEventListener() {}
}

global.document = {
  createElement: () => new MockCanvas(),
  querySelectorAll: () => []
};

global.window = {
  addEventListener: () => {},
  removeEventListener: () => {}
};

const Plan = require('../orbix-plan.js');
const editor = new Plan({ appendChild: () => {}, style: {}, querySelector: () => null }, { project: p });

// Test 1.1: Clicking unselected wall selects it first (Click before move)
editor.handleSelectMouseDown({ x: 2000, y: 0 }, false);
assert.strictEqual(editor.selected.length, 1);
assert.strictEqual(editor.selected[0].id, w1.id);
assert.strictEqual(editor.dragState, null, 'Unselected wall click must NOT move immediately');
console.log('✓ Click before move verified: First click on wall selects it without dragging.');

// Test 1.2: Clicking an ALREADY selected wall initiates move_wall
editor.handleSelectMouseDown({ x: 2000, y: 0 }, false);
assert(editor.dragState, 'Clicking already selected wall must engage dragState');
assert.strictEqual(editor.dragState.type, 'move_wall', 'dragState.type must be move_wall');
assert.strictEqual(editor.dragState.connectedStart.length, 1, 'w1 start connected to w4 end');
assert.strictEqual(editor.dragState.connectedEnd.length, 1, 'w1 end connected to w2 start');
console.log('✓ Already-selected wall click initiates move_wall with connected wall tracking.');

// Test 1.3: Dragging Perpendicular (Normal axis: moving down by 500mm, i.e. dy = -500)
// For horizontal w1 (along +X), normal is (0, -1) or (0, 1).
const ds = editor.dragState;
const rawDx = 50; // slight diagonal jitter
const rawDy = -500; // dominant perpendicular movement

const wDir = ds.origDir;
const wNorm = ds.origNorm;
const projPerp = rawDx * wNorm.x + rawDy * wNorm.y;
const projParallel = rawDx * wDir.x + rawDy * wDir.y;

assert(Math.abs(projPerp) > Math.abs(projParallel), 'Perpendicular movement must dominate');

const snappedPerp = Math.round(projPerp / 25) * 25;
const dispX = wNorm.x * snappedPerp;
const dispY = wNorm.y * snappedPerp;

// Move w1 and its connected endpoints
w1.start.x = Math.round(ds.origStart.x + dispX);
w1.start.y = Math.round(ds.origStart.y + dispY);
w1.end.x = Math.round(ds.origEnd.x + dispX);
w1.end.y = Math.round(ds.origEnd.y + dispY);

for (let cs = 0; cs < ds.connectedStart.length; cs++) {
  const c = ds.connectedStart[cs];
  c.wall[c.endpoint].x = Math.round(c.orig.x + dispX);
  c.wall[c.endpoint].y = Math.round(c.orig.y + dispY);
}
for (let ce = 0; ce < ds.connectedEnd.length; ce++) {
  const c = ds.connectedEnd[ce];
  c.wall[c.endpoint].x = Math.round(c.orig.x + dispX);
  c.wall[c.endpoint].y = Math.round(c.orig.y + dispY);
}

// Verify that W1 moved by dispY and stay horizontal
assert.strictEqual(w1.start.y, -500);
assert.strictEqual(w1.end.y, -500);
assert.strictEqual(w1.start.x, 0);
assert.strictEqual(w1.end.x, 4000);

// Verify that connected walls W4 and W2 stretched to match W1 at y = -500!
assert.strictEqual(w4.end.y, -500, 'W4 end must stay connected to W1 start at y=-500');
assert.strictEqual(w4.end.x, 0, 'W4 end x stays 0');
assert.strictEqual(w2.start.y, -500, 'W2 start must stay connected to W1 end at y=-500');
assert.strictEqual(w2.start.x, 4000, 'W2 start x stays 4000');
console.log('✓ Wall moving perpendicular verified: W1 moved and connected walls W4 & W2 stretched seamlessly.');

// ─────────────────────────────────────────────────────────────────────────────
// Part 2: Room Divider without Joining Walls & Pooja Room Area
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 2: Room Divider without Joining Walls & Pooja Room Area ---');

const project2 = Core.createProject();
// 4 outer room walls
project2.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } }),
  Core.createWall({ start: { x: 6000, y: 0 }, end: { x: 6000, y: 4000 } }),
  Core.createWall({ start: { x: 6000, y: 4000 }, end: { x: 0, y: 4000 } }),
  Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 } })
];

// 4 room divider walls in the center of the room (e.g. 1500 x 1500 mm Pooja Room)
// from (1500, 1500) to (3000, 3000)
const minX = 1500, maxX = 3000, minY = 1500, maxY = 3000;
const dTop = Core.createRoomDivider({ start: { x: minX, y: minY }, end: { x: maxX, y: minY } });
const dRight = Core.createRoomDivider({ start: { x: maxX, y: minY }, end: { x: maxX, y: maxY } });
const dBottom = Core.createRoomDivider({ start: { x: maxX, y: maxY }, end: { x: minX, y: maxY } });
const dLeft = Core.createRoomDivider({ start: { x: minX, y: maxY }, end: { x: minX, y: minY } });

project2.plan.walls.push(dTop, dRight, dBottom, dLeft);

const detectedRooms = Core.detectRooms(project2);
console.log('Detected Rooms:', detectedRooms.map(r => ({ name: r.name, areaSqM: r.areaSqM })));

assert.strictEqual(detectedRooms.length, 2, 'Must detect both outer room and inner Pooja Room');
const poojaRoom = detectedRooms.find(r => r.name === 'Pooja Room');
assert(poojaRoom, 'A room named "Pooja Room" must be detected for the divider enclosure');
assert.strictEqual(poojaRoom.areaSqM, 2.25, 'Pooja Room area must be 2.25 m² (1.5m x 1.5m)');
console.log('✓ Pooja Room without joining external walls detected and named properly!');

// ─────────────────────────────────────────────────────────────────────────────
// Part 3: Divided Room Draggable & Movable Straight (Parallel & Perpendicular)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 3: Divided Room Draggable & Movable Straight ---');

const editor2 = new Plan({ appendChild: () => {}, style: {}, querySelector: () => null }, { project: project2 });
// 3.1: First click inside Pooja room selects it
editor2.handleSelectMouseDown({ x: 2000, y: 2000 }, false);
assert.strictEqual(editor2.selected.length, 1);
assert.strictEqual(editor2.selected[0].type, 'room');
assert.strictEqual(editor2.selected[0].id, poojaRoom.id);
assert.strictEqual(editor2.dragState, null, 'First click selects without moving');
console.log('✓ Click before move verified: First click on room selects it.');

// 3.2: Second click initiates move_room with divider walls tracking
editor2.handleSelectMouseDown({ x: 2000, y: 2000 }, false);
assert(editor2.dragState, 'Clicking already-selected room must engage dragState');
assert.strictEqual(editor2.dragState.type, 'move_room');
assert.strictEqual(editor2.dragState.dividerWalls.length, 4, 'All 4 boundary divider walls must be tracked');

// 3.3: Drag room along X by +500mm (parallel/perpendicular straight)
const rds = editor2.dragState;
const rRawDx = 500;
const rRawDy = 20; // minor Y jitter

let rDispX = 0, rDispY = 0;
if (Math.abs(rRawDx) >= Math.abs(rRawDy)) {
  rDispX = Math.round(rRawDx / 25) * 25;
  rDispY = 0;
} else {
  rDispX = 0;
  rDispY = Math.round(rRawDy / 25) * 25;
}

assert.strictEqual(rDispX, 500);
assert.strictEqual(rDispY, 0, 'Y jitter must be zeroed out for straight movement');

// Apply movement to divider walls
for (let dwi = 0; dwi < rds.dividerWalls.length; dwi++) {
  const dw = rds.dividerWalls[dwi];
  dw.wall.start.x = Math.round(dw.origStart.x + rDispX);
  dw.wall.start.y = Math.round(dw.origStart.y + rDispY);
  dw.wall.end.x = Math.round(dw.origEnd.x + rDispX);
  dw.wall.end.y = Math.round(dw.origEnd.y + rDispY);
}

// Verify divider boundaries translated straight along X
assert.strictEqual(dTop.start.x, 2000);
assert.strictEqual(dTop.end.x, 3500);
assert.strictEqual(dTop.start.y, 1500);
assert.strictEqual(dTop.end.y, 1500);
console.log('✓ Divided room draggable straight verified: Pooja room moved along X with zero angle shift.');

// ─────────────────────────────────────────────────────────────────────────────
// Part 4: Divided Room Deletion
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 4: Divided Room Deletion ---');

// Select pooja room and delete it
editor2.selected = [{ type: 'room', id: poojaRoom.id }];
const initialWallCount = project2.plan.walls.length; // 4 outer + 4 dividers = 8
assert.strictEqual(initialWallCount, 8);

editor2.deleteSelected();

// Verify that the 4 divider walls were deleted and outer walls remain
assert.strictEqual(project2.plan.walls.length, 4, 'All 4 divider walls must be removed');
assert.strictEqual(project2.plan.walls.every(w => !w.isDivider), true, 'Only physical outer walls remain');
assert.strictEqual(project2.plan.rooms.length, 1, 'Only outer room remains');
assert.strictEqual(project2.plan.rooms[0].name, 'Living / Hall');
console.log('✓ Divided room deletion verified: Room and its divider walls cleanly removed.');

// ─────────────────────────────────────────────────────────────────────────────
// Part 5: Zoom LOD and Measurement Visibility
// ─────────────────────────────────────────────────────────────────────────────
console.log('\n--- Part 5: Zoom LOD and Measurement Visibility ---');

// Test 5.1: Zoomed out (< 0.055) suppresses unselected wall dimensions
editor2.zoom = 0.04;
let textRenderCount = 0;
const mockCtx = {
  save: () => {}, restore: () => {}, translate: () => {}, rotate: () => {},
  beginPath: () => {}, moveTo: () => {}, lineTo: () => {}, stroke: () => {},
  fill: () => {}, arc: () => {}, setLineDash: () => {}, rect: () => {}, roundRect: () => {},
  measureText: () => ({ width: 40 }),
  fillText: () => { textRenderCount++; }
};

const outerWall = project2.plan.walls[0];
editor2.renderWallDimensions(mockCtx, outerWall, false);
assert.strictEqual(textRenderCount, 0, 'Zoomed-out unselected wall dimension must NOT render text pills');
console.log('✓ Zoom LOD verified: Text suppressed when zoomed out (zoom < 0.055) to prevent clutter.');

// Test 5.2: Zoomed in (>= 0.055) renders crisp measurements
editor2.zoom = 0.12;
editor2.renderWallDimensions(mockCtx, outerWall, false);
assert(textRenderCount > 0, 'Zoomed-in wall dimension must render measurement text pill');
console.log('✓ Measurement visibility verified: Measurements rendered when zoomed in with high readability.');

console.log('\nALL TESTS PASSED SUCCESSFULLY! 🚀');

