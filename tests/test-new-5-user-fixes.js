// Comprehensive verification for the 5 User Fixes:
// 1. Crockery tv wall open box storage 2- depth 300
// 2. Crockery tv wall open box storage - remove shelves
// 3. Crockery tv base open storage - height 750mm
// 4. only shuttering units placement & alignment in 2D & 3D
// 5. units placed on / nearby RCC elements without collision

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser environment
global.window = global;
global.document = {
  createElement: () => ({ getContext: () => ({}) })
};

const Core = require('../orbix-core.js');

console.log('Testing 5 User Requirements...');

// --- 1. Crockery tv wall open box storage 2: depth 300 ---
const ctvw2 = Core.FURNITURE_CATALOG.find(item => item.id === 'ctvw-obs-02');
assert(ctvw2, 'ctvw-obs-02 must exist in catalog');
assert.strictEqual(ctvw2.dimensions.D, 300, 'ctvw-obs-02 depth in catalog must be 300');
const placedCtvw2 = Core.createFurniturePlacement({ id: 'ctvw-obs-02', name: 'CROCKERY/TV WALL OPEN BOX STORAGE 2' });
assert.strictEqual(placedCtvw2.dimensions.D, 300, 'placed ctvw-obs-02 depth must be 300');
console.log('✓ 1. Crockery tv wall open box storage 2 has depth 300mm');

// --- 2. Crockery tv wall open box storage: remove shelves ---
const ctvwOpen = Core.FURNITURE_CATALOG.find(item => item.id === 'ctvw-open-box');
assert(ctvwOpen, 'ctvw-open-box must exist in catalog');
assert.strictEqual(ctvwOpen.unitConfig.shelves, 0, 'ctvw-open-box shelves in catalog must be 0');
const placedCtvwOpen = Core.createFurniturePlacement({ id: 'ctvw-open-box', name: 'CROCKERY/TV WALL OPEN BOX STORAGE' });
assert.strictEqual(placedCtvwOpen.unitConfig.shelves, 0, 'placed ctvw-open-box shelves must be 0');
console.log('✓ 2. Crockery tv wall open box storage has 0 shelves');

// --- 3. Crockery tv base open storage: height 750mm ---
const ctvbOpen = Core.FURNITURE_CATALOG.find(item => item.id === 'ctvb-open-storage');
assert(ctvbOpen, 'ctvb-open-storage must exist in catalog');
assert.strictEqual(ctvbOpen.dimensions.H, 750, 'ctvb-open-storage height in catalog must be 750');
const placedCtvbOpen = Core.createFurniturePlacement({ id: 'ctvb-open-storage', name: 'CROCKERY/TV BASE OPEN STORAGE' });
assert.strictEqual(placedCtvbOpen.dimensions.H, 750, 'placed ctvb-open-storage height must be 750');
console.log('✓ 3. Crockery tv base open storage has height 750mm');

// --- 4. Only shuttering units modular depths & alignment ---
const wm60os = Core.FURNITURE_CATALOG.find(item => item.id === 'wm-60 o/s');
const wm30os = Core.FURNITURE_CATALOG.find(item => item.id === 'wm-30 o/s');
const loft1dos = Core.FURNITURE_CATALOG.find(item => item.id === 'loft-1d-os');
const loft2dos = Core.FURNITURE_CATALOG.find(item => item.id === 'loft-2d-os');
const fm120os = Core.FURNITURE_CATALOG.find(item => item.id === 'fm-120 o/s');
const fm60os = Core.FURNITURE_CATALOG.find(item => item.id === 'fm-60 o/s');

assert.strictEqual(wm60os.dimensions.D, 350, 'wm-60 o/s depth must be 350');
assert.strictEqual(wm30os.dimensions.D, 350, 'wm-30 o/s depth must be 350');
assert.strictEqual(loft1dos.dimensions.D, 550, 'loft-1d-os depth must be 550');
assert.strictEqual(loft2dos.dimensions.D, 550, 'loft-2d-os depth must be 550');
assert.strictEqual(fm120os.dimensions.D, 550, 'fm-120 o/s depth must be 550');
assert.strictEqual(fm60os.dimensions.D, 550, 'fm-60 o/s depth must be 550');

const placedWm60os = Core.createFurniturePlacement({ id: 'wm-60 o/s', name: 'WM 60 O/S', category: 'kitchen_wall' });
assert.strictEqual(placedWm60os.dimensions.D, 350, 'placed wm-60 o/s depth must default to 350');
const placedFm60os = Core.createFurniturePlacement({ id: 'fm-60 o/s', name: 'FM 60 O/S', category: 'kitchen_fm' });
assert.strictEqual(placedFm60os.dimensions.D, 550, 'placed fm-60 o/s depth must default to 550');
console.log('✓ 4. Only shuttering units have correct modular depths (350mm Wall, 550mm Base/Loft)');

// --- 5. Placing units on or nearby RCC ledges ---
const rccCounter = Core.FURNITURE_CATALOG.find(item => item.id === 'ledge-ctop');
const rccVert = Core.FURNITURE_CATALOG.find(item => item.id === 'ledge-vert');
assert(rccCounter, 'ledge-ctop must exist');
assert(rccVert, 'ledge-vert must exist');

const baseCab = Core.createFurniturePlacement({
  id: 'f_base_1',
  name: 'FM 60 2 SHELVES',
  category: 'kitchen_base',
  pos: { x: 1000, y: 1000, z: 0 },
  dimensions: { W: 600, H: 850, D: 550 }
});

const ledgePl = Core.createFurniturePlacement({
  id: 'ledge_1',
  name: 'LEDGE COUNTERTOP',
  category: 'wall_paneling',
  costCategory: 'Wall Paneling',
  pos: { x: 1000, y: 1000, z: 850 },
  dimensions: { W: 900, H: 18, D: 550 }
});

const allFurn = [baseCab, ledgePl];

// Collision check between cabinet and RCC ledge
const col1 = Core.checkFurnitureCollision(baseCab, allFurn, baseCab.id);
assert.strictEqual(col1.collided, false, 'Base cabinet placed at RCC ledge position must not collide');

const col2 = Core.checkFurnitureCollision(ledgePl, allFurn, ledgePl.id);
assert.strictEqual(col2.collided, false, 'RCC ledge placed at base cabinet position must not collide');

// Collision check when Only Shutter unit is placed right on RCC structure
const onlyShutterPl = Core.createFurniturePlacement({
  id: 'fm_os_1',
  name: 'FM 60 O/S',
  category: 'kitchen_fm',
  costCategory: 'Kitchen O/S',
  pos: { x: 1000, y: 1000, z: 0 },
  dimensions: { W: 600, H: 750, D: 550 }
});

const col3 = Core.checkFurnitureCollision(onlyShutterPl, [onlyShutterPl, ledgePl], onlyShutterPl.id);
assert.strictEqual(col3.collided, false, 'Only Shutter unit placed under/at RCC ledge must not collide');

// Test checkPlacementOverlap with RCC ledge
const ledgePlWall = Core.createFurniturePlacement({
  id: 'ledge_1',
  name: 'LEDGE COUNTERTOP',
  category: 'wall_paneling',
  costCategory: 'Wall Paneling',
  pos: { x: 1000, y: 925, z: 850 },
  dimensions: { W: 900, H: 18, D: 550 }
});

const onlyShutterPlWall = Core.createFurniturePlacement({
  id: 'fm_os_1',
  name: 'FM 60 O/S',
  category: 'kitchen_fm',
  costCategory: 'Kitchen O/S',
  pos: { x: 1000, y: 925, z: 0 },
  dimensions: { W: 600, H: 750, D: 550 }
});

const planMock = {
  walls: [
    { id: 'w1', start: { x: 0, y: 1275 }, end: { x: 3000, y: 1275 }, thickness: 150, height: 2800 }
  ],
  furniture: [ledgePlWall]
};

const overlapRes = Core.checkPlacementOverlap(onlyShutterPlWall, planMock, onlyShutterPlWall.id);
assert.strictEqual(overlapRes.hasOverlap, false, 'Only Shutter unit near RCC ledge has no overlap collision');

console.log('✓ 5. Units can be placed directly on, under, or nearby RCC ledges with zero collision blocking');
console.log('\nAll 5 User Requirements passed successfully!');
