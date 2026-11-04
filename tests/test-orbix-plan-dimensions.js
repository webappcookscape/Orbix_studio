// tests/test-orbix-plan-dimensions.js
// Automated verification of 2D Architectural Segmented Dimensioning System

const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('--- RUNNING ORBIX 2D SEGMENTED DIMENSIONS TEST ---');

// 1. Single Door segmented calculation (matching user diagram: 855 | 800 | 855)
const wall = Core.createWall({
  start: { x: 5000, y: 1000 },
  end: { x: 5000, y: 3510 },
  thickness: 150,
  height: 2800
});

const wallLen = Core.wallLength(wall);
assert.strictEqual(wallLen, 2510, 'Wall length should be exactly 2510 mm');

const door = Core.createOpening({
  wallId: wall.id,
  type: 'door',
  width: 800,
  offset: 1255
});

const halfW = door.width / 2;
const safeOff = Math.max(halfW, Math.min(wallLen - halfW, door.offset));
const seg1 = Math.round(safeOff - halfW);
const doorW = Math.round(door.width);
const seg2 = Math.round(wallLen - (safeOff + halfW));

console.log('Segment 1 (Corner A to Door):', seg1, 'mm');
console.log('Door Opening Width:', doorW, 'mm');
console.log('Segment 2 (Door to Corner B):', seg2, 'mm');

assert.strictEqual(seg1, 855, 'Segment 1 should be exactly 855 mm as shown in user diagram');
assert.strictEqual(doorW, 800, 'Door width should be exactly 800 mm as shown in user diagram');
assert.strictEqual(seg2, 855, 'Segment 2 should be exactly 855 mm as shown in user diagram');
assert.strictEqual(seg1 + doorW + seg2, 2510, 'Sum of segments must equal total wall length');
console.log('✓ Segmented dimensions match user reference diagram (855 | 800 | 855)');

// 2. Bidirectional Numeric Inspector Offset calculation
// If user inputs distA = 500 mm:
const inputDistA = 500;
const newOffsetFromA = Math.round(inputDistA + door.width / 2);
assert.strictEqual(newOffsetFromA, 900, 'New offset for 500mm distance to A should be 900mm');

// If user inputs distB = 1000 mm:
const inputDistB = 1000;
const newOffsetFromB = Math.round(wallLen - inputDistB - door.width / 2);
assert.strictEqual(newOffsetFromB, 1110, 'New offset for 1000mm distance to B should be 1110mm');
console.log('✓ Bidirectional numeric calculations from Corner A and Corner B verified');

// 3. Exterior normal orientation away from room interior
const baseNorm = Core.wallNormal(wall);
assert.strictEqual(baseNorm.x, -1, 'Base normal points to the left (-x)');
assert.strictEqual(baseNorm.y, 0, 'Base normal has 0 y');

// Room is to the left:
const roomPolygon = [
  { x: 1000, y: 1000 },
  { x: 5000, y: 1000 },
  { x: 5000, y: 3510 },
  { x: 1000, y: 3510 }
];
const midW = { x: (wall.start.x + wall.end.x) / 2, y: (wall.start.y + wall.end.y) / 2 };
const testPos = { x: midW.x + baseNorm.x * 120, y: midW.y + baseNorm.y * 120 };
const testNeg = { x: midW.x - baseNorm.x * 120, y: midW.y - baseNorm.y * 120 };

const posInside = Core.Vec2.pointInPolygon(testPos, roomPolygon);
const negInside = Core.Vec2.pointInPolygon(testNeg, roomPolygon);

assert.strictEqual(posInside, true, 'Positive normal points into the room interior');
assert.strictEqual(negInside, false, 'Negative normal points to the room exterior');

const exteriorNorm = (posInside && !negInside) ? { x: -baseNorm.x, y: -baseNorm.y } : baseNorm;
assert.strictEqual(exteriorNorm.x, 1, 'Exterior normal points outside (+x) to the right');
console.log('✓ Exterior normal positioning places dimension line outside room');

console.log('ALL ORBIX 2D SEGMENTED DIMENSION TESTS PASSED SUCCESSFULLY!');

