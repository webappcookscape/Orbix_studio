const assert = require('assert');
const Core = require('../orbix-core.js');

console.log('--- TEST: FURNISH PLACEMENT & WALL HEALING FIX ---');

// 1. Verify healCollinearWalls
{
  let p = Core.createProject();
  p.plan.walls = [
    Core.createWall({ start: { x: 0, y: 0 }, end: { x: 0, y: 1916 }, thickness: 150, height: 2800 }),
    Core.createWall({ start: { x: 0, y: 1916 }, end: { x: 0, y: 4000 }, thickness: 150, height: 2800 })
  ];
  assert.strictEqual(p.plan.walls.length, 2);
  let changed = Core.healCollinearWalls(p);
  assert.strictEqual(changed, true);
  assert.strictEqual(p.plan.walls.length, 1, 'Collinear wall segments must be healed back into 1 wall');
  assert.strictEqual(Math.round(Core.wallLength(p.plan.walls[0])), 4000);
  console.log('✓ PASS: healCollinearWalls healed 1916mm cut wall back to 4000mm');
}

// 2. Verify detectRooms does NOT cut straight walls
{
  let p = Core.createProject();
  p.plan.walls = [
    Core.createWall({ start: { x: 0, y: 0 }, end: { x: 4000, y: 0 } }),
    Core.createWall({ start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 } }),
    Core.createWall({ start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 } }),
    Core.createWall({ start: { x: 0, y: 3000 }, end: { x: 0, y: 0 } }),
    Core.createWall({ start: { x: 2000, y: 0 }, end: { x: 2000, y: 3000 } })
  ];
  let wallCountBefore = p.plan.walls.length;
  let rooms = Core.detectRooms(p);
  assert.strictEqual(p.plan.walls.length, wallCountBefore, 'detectRooms must NOT mutate/slice walls');
  assert.strictEqual(rooms.length, 2, 'detectRooms detects 2 rooms via internal subdivide');
  console.log('✓ PASS: detectRooms does NOT slice straight walls');
}

// 3. Verify collision check allows placement near RCC pillars
{
  let p = Core.createProject();
  let rccPillar = {
    id: 'furn_rcc_1',
    name: 'RCC Column Pillar',
    category: 'structural',
    pos: { x: 100, y: 100, z: 0 },
    dimensions: { W: 200, D: 200, H: 2800 }
  };
  let cupboard = {
    id: 'furn_cb_1',
    name: 'Kitchen Base Unit',
    category: 'kitchen_base',
    pos: { x: 150, y: 100, z: 0 }, // touching RCC pillar
    dimensions: { W: 600, D: 600, H: 850 }
  };
  p.plan.furniture = [rccPillar, cupboard];

  let col = Core.checkPlacementOverlap(cupboard, p.plan, cupboard.id);
  assert.strictEqual(col.hasOverlap, false, 'Placing unit touching or near RCC column must NOT be blocked');
  console.log('✓ PASS: checkPlacementOverlap allows placement near/touching RCC column');
}

console.log('--- ALL FURNISH PLACEMENT FIX TESTS PASSED! ---');

