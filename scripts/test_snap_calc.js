const assert = require('assert');

// Simulate the snap calculation
function testSnap(cursorPos, walls, flushDist) {
  var minWallDist = 300;
  var bestSnap = null;

  for (var wIdx = 0; wIdx < walls.length; wIdx++) {
    var w = walls[wIdx];
    var dx = w.end.x - w.start.x;
    var dy = w.end.y - w.start.y;
    var wLen = Math.hypot(dx, dy);
    var wDir = { x: dx / wLen, y: dy / wLen };
    var wNorm = { x: -wDir.y, y: wDir.x };

    var toCur = { x: cursorPos.x - w.start.x, y: cursorPos.y - w.start.y };
    var t = (toCur.x * wDir.x + toCur.y * wDir.y) / wLen;
    var tClamped = Math.max(0, Math.min(1, t));
    var proj = { x: w.start.x + tClamped * dx, y: w.start.y + tClamped * dy };

    var toCurProj = { x: cursorPos.x - proj.x, y: cursorPos.y - proj.y };
    var sDist = toCurProj.x * wNorm.x + toCurProj.y * wNorm.y;
    var perpDist = Math.abs(sDist);

    var longDist = 0;
    if (t < 0) longDist = -t * wLen;
    else if (t > 1) longDist = (t - 1) * wLen;

    var snapDist = Math.hypot(Math.abs(perpDist - flushDist), longDist);
    if (snapDist < minWallDist) {
      minWallDist = snapDist;
      bestSnap = {
        wallIndex: wIdx,
        pos: { x: proj.x + wNorm.x * flushDist, y: proj.y + wNorm.y * flushDist },
        proj: proj
      };
    }
  }
  return bestSnap;
}

var walls = [
  { start: { x: 0, y: 0 }, end: { x: 0, y: 1916 } },
  { start: { x: 0, y: 1916 }, end: { x: 0, y: 4000 } }
];
var flushDist = 350; // unit half-depth + wall half-thickness

// 1. Test placing near RCC point at start (y = 50)
var snap1 = testSnap({ x: 350, y: 50 }, walls, flushDist);
console.log('Cursor at (350, 50): snapped to wall', snap1.wallIndex, 'proj.y =', snap1.proj.y);
assert.strictEqual(snap1.wallIndex, 0);
assert.strictEqual(snap1.proj.y, 50, 'Must allow placing near RCC point at start (50mm)');

// 2. Test placing past the cut point (y = 2500)
var snap2 = testSnap({ x: 350, y: 2500 }, walls, flushDist);
console.log('Cursor at (350, 2500): snapped to wall', snap2.wallIndex, 'proj.y =', snap2.proj.y);
assert.strictEqual(snap2.wallIndex, 1);
assert.strictEqual(snap2.proj.y, 2500, 'Must allow placing past the 1916mm cut point (2500mm)');

// 3. Test placing right at the 1916mm joint
var snap3 = testSnap({ x: 350, y: 1916 }, walls, flushDist);
console.log('Cursor at (350, 1916): proj.y =', snap3.proj.y);
assert.strictEqual(snap3.proj.y, 1916, 'Must allow placing right at the joint');

console.log('All snap test assertions passed!');

