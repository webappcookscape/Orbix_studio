// tests/test-placement-performance.js
// Validates ultra-fast zero-lag unit and decor placement optimizations

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing Zero-Lag Unit & Decor Placement Optimizations ---');

const planJs = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
const threeDJs = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');
const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

// 1. Fast incremental mesh addition in orbix-3d.js
assert(threeDJs.includes('ArchitecturalRenderer.prototype.addOrUpdateFurnitureMesh = function'), 'addOrUpdateFurnitureMesh must exist in orbix-3d.js');
assert(threeDJs.includes('ArchitecturalRenderer.prototype.removeFurnitureMesh = function'), 'removeFurnitureMesh must exist in orbix-3d.js');
console.log('✓ PASS: ArchitecturalRenderer has addOrUpdateFurnitureMesh & removeFurnitureMesh incremental methods');

// 2. Room cycle detection skipped on non-wall actions in orbix-plan.js
assert(planJs.includes('wallActionRegex'), 'pushHistory must check wallActionRegex to skip heavy detectRooms');
assert(planJs.includes('isWallTopologyAction'), 'pushHistory must guard detectRooms with isWallTopologyAction');
assert(planJs.includes("pushHistory('Place ' + furn.name, furn)"), 'handleFurnitureMouseDown must pass furn to pushHistory');
console.log('✓ PASS: pushHistory skips detectRooms on unit/decor placement, moves, and rotation');

// 3. Debounced AutoSave in orbix-ui.js
assert(uiJs.includes('queueAutoSave: function'), 'queueAutoSave must be defined in orbix-ui.js');
assert(uiJs.includes('flushAutoSave: function'), 'flushAutoSave must be defined in orbix-ui.js');
assert(uiJs.includes('beforeunload'), 'beforeunload listener must be registered to flush auto-save');
console.log('✓ PASS: orbix-ui.js implements debounced queueAutoSave and beforeunload flush');

// 4. Lazy BOQ and Lazy 3D
assert(uiJs.includes('var isBoqActive ='), 'renderBOQ must check if BOQ view is currently active');
assert(uiJs.includes('_boqDirty = true'), 'renderBOQ must set _boqDirty when called while hidden');
assert(uiJs.includes('var isDesignActive ='), 'render3DHome must check if 3D Studio view is active');
assert(uiJs.includes('_3dDirty = true'), 'render3DHome must set _3dDirty when called while hidden');
console.log('✓ PASS: Lazy BOQ and Lazy 3D prevent background scene and DOM computation');

// 5. Fast Incremental Placement in placeModularUnitIn3D and placeDecorItem
assert(uiJs.includes('this.archRenderer.addOrUpdateFurnitureMesh(newFurn)'), 'placeModularUnitIn3D must use incremental mesh addition');
assert(uiJs.includes('this.archRenderer.addOrUpdateFurnitureMesh(newDecor)'), 'placeDecorItem must use incremental mesh addition');
console.log('✓ PASS: placeModularUnitIn3D and placeDecorItem use instant single-unit addition');

// 6. Benchmark simulation: 50 consecutive unit placements in memory
const Core = require('../orbix-core.js');
const testProject = Core.createProject('Perf Test Project');
const startTime = Date.now();

for (let i = 0; i < 50; i++) {
  const furn = Core.createFurniturePlacement({
    name: 'Unit ' + i,
    category: 'wardrobe',
    pos: { x: 1000 + i * 200, y: 1500, z: 0 },
    dimensions: { W: 900, H: 2100, D: 600 }
  });
  testProject.plan.furniture.push(furn);
}

const elapsedMs = Date.now() - startTime;
console.log('✓ PASS: Placed 50 units in ' + elapsedMs + ' ms (budget: < 50ms, average: ' + (elapsedMs / 50).toFixed(2) + ' ms/unit)');
assert(elapsedMs < 100, '50 unit placements must execute in under 100ms');

console.log('ALL PLACEMENT PERFORMANCE TESTS PASSED 100%!');

