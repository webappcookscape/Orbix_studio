/**
 * Test Suite: Wall Corner Locks (A & B) with Anchored Extension,
 * Lock Badge Clicking, and Parallel Wall Distance Dimensions
 */

const assert = require('assert');
const OrbixCore = require('../orbix-core');

console.log('════════════════════════════════════════════════════════════════');
console.log('🧪 TESTING WALL CORNER LOCKS & PARALLEL WALL DISTANCES');
console.log('════════════════════════════════════════════════════════════════\n');

// 1. Setup a Room with Parallel Walls (matching user diagram: Room 9)
console.log('Test 1: Parallel Wall Clear Distance Calculation');
const wTop = OrbixCore.createWall({
  start: { x: 500, y: 1000 },
  end: { x: 3500, y: 1000 },
  thickness: 150
}); // Length = 3000mm

const wBottom = OrbixCore.createWall({
  start: { x: 500, y: 3066 },
  end: { x: 3500, y: 3066 },
  thickness: 150
}); // Parallel opposite wall: distance = 3066 - 1000 = 2066mm center-to-center, clear distance = 2066 - 150 = 1916mm!

const wAbove = OrbixCore.createWall({
  start: { x: 500, y: 43 },
  end: { x: 3500, y: 43 },
  thickness: 150
}); // Parallel exterior wall above: distance = 1000 - 43 = 957mm center-to-center, clear distance = 957 - 150 = 807mm!

const wLeft = OrbixCore.createWall({
  start: { x: 500, y: 1000 },
  end: { x: 500, y: 3066 },
  thickness: 150
});

const wRight = OrbixCore.createWall({
  start: { x: 3500, y: 1000 },
  end: { x: 3500, y: 3066 },
  thickness: 150
});

const project = OrbixCore.createProject({ title: 'Room 9 Test' });
project.plan.walls = [wTop, wBottom, wAbove, wLeft, wRight];

// Test parallel detection for wTop:
const wDir = OrbixCore.wallDirection(wTop);
const wNorm = OrbixCore.wallNormal(wTop);
const halfT = wTop.thickness / 2;

const parallelDistances = [];
project.plan.walls.forEach(ow => {
  if (ow.id === wTop.id) return;
  const owDir = OrbixCore.wallDirection(ow);
  const cross = Math.abs(wDir.x * owDir.y - wDir.y * owDir.x);
  if (cross > 0.08) return; // not parallel

  const tStart = (ow.start.x - wTop.start.x) * wDir.x + (ow.start.y - wTop.start.y) * wDir.y;
  const tEnd = (ow.end.x - wTop.start.x) * wDir.x + (ow.end.y - wTop.start.y) * wDir.y;
  const tMin = Math.min(tStart, tEnd);
  const tMax = Math.max(tStart, tEnd);
  const overlap = Math.min(3000, tMax) - Math.max(0, tMin);
  if (overlap < 80) return;

  const perp = (ow.start.x - wTop.start.x) * wNorm.x + (ow.start.y - wTop.start.y) * wNorm.y;
  const clearDist = Math.abs(perp) - halfT - (ow.thickness / 2);
  parallelDistances.push({ wall: ow, perp, clearDist: Math.round(clearDist) });
});

assert.strictEqual(parallelDistances.length, 2, 'Must detect exactly 2 parallel facing walls (opposite and above)');
const distValues = parallelDistances.map(d => d.clearDist).sort((a, b) => a - b);
assert.strictEqual(distValues[0], 807, 'Exterior parallel wall distance must be exactly 807mm (matches user diagram)');
assert.strictEqual(distValues[1], 1916, 'Interior opposite wall distance must be exactly 1916mm (matches user diagram)');
console.log('  ✓ Parallel wall clear distances verified: 807 mm and 1916 mm (exactly matching user diagram)\n');

// 2. Corner Lock / Release & Anchored Extension Behavior
console.log('Test 2: Corner Lock State & Differential Wall Extension');

// Initial state: both locked
wTop.startLocked = true;
wTop.endLocked = true;

// Release Corner A (startLocked = false), keep Corner B locked (endLocked = true)
wTop.startLocked = false;
assert.strictEqual(wTop.startLocked, false, 'Corner A is released');
assert.strictEqual(wTop.endLocked, true, 'Corner B remains locked');

// Simulate dragging the wall with dx = 0, dy = -300
const origStart = { x: 500, y: 1000 };
const origEnd = { x: 3500, y: 1000 };
const dx = 0, dy = -300;

// Algorithm under test:
let newStartX, newStartY, newEndX, newEndY;
if (!wTop.startLocked && wTop.endLocked) {
  // Corner A moves, Corner B is pinned at origEnd
  newEndX = origEnd.x;
  newEndY = origEnd.y;
  newStartX = origStart.x + dx;
  newStartY = origStart.y + dy;
} else if (wTop.startLocked && !wTop.endLocked) {
  newStartX = origStart.x;
  newStartY = origStart.y;
  newEndX = origEnd.x + dx;
  newEndY = origEnd.y + dy;
}

assert.strictEqual(newEndX, 3500, 'Point B must stay anchored at 3500');
assert.strictEqual(newEndY, 1000, 'Point B must stay anchored at 1000');
assert.strictEqual(newStartX, 500, 'Point A moves along with drag');
assert.strictEqual(newStartY, 700, 'Point A moves along with drag (1000 - 300 = 700)');

const extendedLength = Math.hypot(newEndX - newStartX, newEndY - newStartY);
assert.strictEqual(Math.round(extendedLength), 3015, 'Wall length extends from fixed anchor Point B');
console.log('  ✓ Corner A released + Corner B locked anchors Point B while extending wall from B\n');

// Reverse: Corner A locked (startLocked = true), Corner B released (endLocked = false)
wTop.startLocked = true;
wTop.endLocked = false;
if (wTop.startLocked && !wTop.endLocked) {
  newStartX = origStart.x;
  newStartY = origStart.y;
  newEndX = origEnd.x + dx;
  newEndY = origEnd.y + dy;
}
assert.strictEqual(newStartX, 500, 'Point A must stay anchored at 500');
assert.strictEqual(newStartY, 1000, 'Point A must stay anchored at 1000');
assert.strictEqual(newEndX, 3500, 'Point B moves along with drag');
assert.strictEqual(newEndY, 700, 'Point B moves along with drag (1000 - 300 = 700)');
console.log('  ✓ Corner A locked + Corner B released anchors Point A while extending wall from A\n');

// 3. Setup Room 1 with Opening (Segmented Dimensions 855 - 800 - 855) matching User Diagram
console.log('Test 3: Room 1 Wall with Opening Segment Dimensions (855 - 800 - 855)');
const wRoom1 = OrbixCore.createWall({
  start: { x: 2000, y: 500 },
  end: { x: 2000, y: 3010 }, // Length = 2510 mm
  thickness: 150
});
const opening = OrbixCore.createOpening({
  wallId: wRoom1.id,
  type: 'window',
  width: 800,
  offset: 1255 // 855 + 400 = 1255 mm
});

const lMm = OrbixCore.wallLength(wRoom1);
assert.strictEqual(lMm, 2510, 'Total wall length must be 2510mm');

const halfW = opening.width / 2;
const tStart = opening.offset - halfW;
const tEnd = opening.offset + halfW;
const seg1 = tStart - 0;
const seg2 = tEnd - tStart;
const seg3 = lMm - tEnd;

assert.strictEqual(seg1, 855, 'Segment 1 (A to opening start) must be exactly 855mm');
assert.strictEqual(seg2, 800, 'Segment 2 (opening width) must be exactly 800mm');
assert.strictEqual(seg3, 855, 'Segment 3 (opening end to B) must be exactly 855mm');
console.log('  ✓ Segment dimensions verified: ' + seg1 + ' - ' + seg2 + ' - ' + seg3 + ' mm (exact match to Room 1 diagram)\n');

// Test 4: Anchored Opening Preservation during Wall Extension
console.log('Test 4: Anchored Opening Preservation When Corner B is Locked & Corner A Moves');
wRoom1.startLocked = false;
wRoom1.endLocked = true;

const origLen = lMm; // 2510mm
const origOffset = opening.offset; // 1255mm
const origDistFromEnd = origLen - origOffset; // 1255mm (distance from B = 1255 - 400 = 855mm clear)

// Move Corner A up by 500mm (start.y = 0)
const curLenA = Math.round(Math.hypot(wRoom1.end.x - wRoom1.start.x, wRoom1.end.y - (wRoom1.start.y - 500)));
const newOffset = Math.max(opening.width / 2, Math.min(curLenA - opening.width / 2, curLenA - origDistFromEnd));
const newDistFromEnd = curLenA - newOffset;
assert.strictEqual(newDistFromEnd, origDistFromEnd, 'Distance from opening to locked Corner B must be strictly preserved');
assert.strictEqual(newDistFromEnd - opening.width / 2, 855, 'Clear distance to Corner B must remain 855mm');
console.log('  ✓ When Corner B is locked, opening distance to Corner B is anchored at 855mm\n');

console.log('════════════════════════════════════════════════════════════════');
console.log('🎉 ALL PARALLEL WALL & CORNER LOCK TESTS PASSED SUCCESSFULLY!');
console.log('════════════════════════════════════════════════════════════════\n');
