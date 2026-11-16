const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('--- TEST SUITE: SEPARATE WALLS & RCC JOINTS ---');

// 1. Test T-Joint auto-split on straight wall
{
  const p = Core.createProject();
  p.plan.walls = [
    Core.createWall({ start: { x: 0, y: 0 }, end: { x: 5000, y: 0 } }),
    Core.createWall({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 3000 } }),
    Core.createWall({ start: { x: 5000, y: 3000 }, end: { x: 0, y: 3000 } }),
    Core.createWall({ start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } }),
    // Partition wall meeting straight wall at (2500, 0)
    Core.createWall({ start: { x: 2500, y: 0 }, end: { x: 2500, y: 3000 } })
  ];

  assert.strictEqual(p.plan.walls.length, 5);
  const rooms = Core.detectRooms(p);
  // detectRooms must have split top and bottom walls into separate segments!
  assert.strictEqual(p.plan.walls.length, 7, 'Straight walls at T-junctions must be split into separate walls');
  assert.strictEqual(rooms.length, 2, 'Must detect 2 rooms');

  const seg1 = p.plan.walls.find(w => w.start.x === 0 && w.end.x === 2500 && w.start.y === 0 && w.end.y === 0);
  const seg2 = p.plan.walls.find(w => w.start.x === 2500 && w.end.x === 5000 && w.start.y === 0 && w.end.y === 0);
  assert.ok(seg1, 'Segment 1 (0 to 2500) must exist');
  assert.ok(seg2, 'Segment 2 (2500 to 5000) must exist');
  assert.notStrictEqual(seg1.id, seg2.id, 'Separated walls must have distinct IDs');

  // Verify independent customization
  seg1.paintColor = '#ff0000';
  seg1.wallpaper = 'floral_blush';
  seg2.paintColor = '#0000ff';
  seg2.wallpaper = 'geometric_teal';
  assert.strictEqual(seg1.paintColor, '#ff0000');
  assert.strictEqual(seg2.paintColor, '#0000ff');
  assert.strictEqual(seg1.wallpaper, 'floral_blush');
  assert.strictEqual(seg2.wallpaper, 'geometric_teal');
  console.log('✓ PASS: T-Joint auto-split & independent wall finish verified');
}

// 2. Test RCC Column joint splitting straight wall
{
  const p = Core.createProject();
  const straightWall = Core.createWall({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } });
  p.plan.walls = [straightWall];
  p.plan.furniture = [
    {
      id: 'furn_rcc_pillar_mid',
      name: 'RCC Column Joint',
      category: 'structural',
      pos: { x: 2000, y: 0 }
    },
    {
      id: 'furn_rcc_pillar_mid2',
      name: 'RCC Column Joint 2',
      category: 'structural',
      pos: { x: 4000, y: 0 }
    }
  ];

  Core.autoSplitWallAtJunctions(p);
  assert.strictEqual(p.plan.walls.length, 3, 'Wall with 2 RCC columns must be split into 3 separate walls');
  assert.strictEqual(Math.round(Core.wallLength(p.plan.walls[0])), 2000);
  assert.strictEqual(Math.round(Core.wallLength(p.plan.walls[1])), 2000);
  assert.strictEqual(Math.round(Core.wallLength(p.plan.walls[2])), 2000);
  console.log('✓ PASS: RCC Column joint splits straight wall into separate walls');
}

// 3. Test splitWall at custom point
{
  const p = Core.createProject();
  const w = Core.createWall({ start: { x: 100, y: 200 }, end: { x: 3100, y: 200 } });
  p.plan.walls = [w];
  const splitPt = { x: 1100, y: 200 };
  const res = Core.splitWall(p, w.id, splitPt);
  assert.ok(res, 'splitWall must succeed');
  assert.ok(res.wall1 && res.wall2, 'splitWall must return wall1 and wall2');
  assert.strictEqual(Math.round(Core.wallLength(res.wall1)), 1000);
  assert.strictEqual(Math.round(Core.wallLength(res.wall2)), 2000);
  assert.strictEqual(p.plan.walls.length, 2);
  console.log('✓ PASS: Manual / Inspector splitWall at custom offset verified');
}

console.log('--- ALL SEPARATE WALL TESTS PASSED! ---');

