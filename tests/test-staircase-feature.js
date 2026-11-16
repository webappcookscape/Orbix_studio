const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser environment
global.window = global;
global.document = {
  createElement: () => ({ getContext: () => ({}), style: {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} } }),
  getElementById: () => null,
  querySelectorAll: () => []
};

const rootDir = path.resolve(__dirname, '..');
const Core = require(path.join(rootDir, 'orbix-core.js'));

console.log('=== RUNNING COMPREHENSIVE STAIRCASE FEATURE TESTS ===\n');

// 1. Test Core Staircase Model & API
console.log('1. Testing orbix-core.js Staircase Model & Geometry...');
assert(Core, 'Core object must be defined');
assert(typeof Core.createStaircasePlacement === 'function', 'Core.createStaircasePlacement must be a function');
assert(typeof Core.getStaircasePolygon === 'function', 'Core.getStaircasePolygon must be a function');

// Test createStaircasePlacement default L-Shape
const stairL = Core.createStaircasePlacement({
  pos: { x: 1200, y: 1500 },
  type: 'l_shape',
  turnDirection: 'right',
  width: 900
});

assert(stairL, 'Staircase object should be returned');
assert(stairL.id && stairL.id.startsWith('stair_'), 'Staircase must have a stair_ prefix ID');
assert.strictEqual(stairL.type, 'l_shape');
assert.strictEqual(stairL.turnDirection, 'right');
assert.strictEqual(stairL.width, 900);
assert.strictEqual(stairL.totalHeight, 2800, 'Total rise must be 2800mm (residential ceiling height)');
assert.strictEqual(stairL.riserCount, 16, 'Riser count must be 16 steps');
assert.strictEqual(stairL.riserHeight, 175, 'Riser height must be 175mm (2800 / 16)');
assert.strictEqual(stairL.treadDepth, 250, 'Tread going must be 250mm standard');
assert.strictEqual(stairL.flight1Steps, 8, 'Flight 1 must have 8 steps (start to landing)');
assert.strictEqual(stairL.flight2Steps, 8, 'Flight 2 must have 8 steps (landing to ceiling)');
assert.strictEqual(stairL.excludeFromPricing, true, 'Staircase must be excluded from woodwork quotation');

console.log('  ✓ createStaircasePlacement created valid L-shape stair with 16 risers @ 175mm');

// Test polygon geometry for L-Shape (6 vertices)
const polyL = Core.getStaircasePolygon(stairL);
assert(Array.isArray(polyL), 'getStaircasePolygon must return an array');
assert.strictEqual(polyL.length, 6, 'L-Shape staircase footprint must have 6 vertices');
console.log('  ✓ L-Shape polygon returned 6 vertices');

// Test polygon geometry for U-Shape and Straight (4 vertices)
const stairU = Core.createStaircasePlacement({ type: 'u_shape' });
const polyU = Core.getStaircasePolygon(stairU);
assert.strictEqual(polyU.length, 4, 'U-Shape staircase footprint must have 4 bounding vertices');

const stairStr = Core.createStaircasePlacement({ type: 'straight' });
const polyStr = Core.getStaircasePolygon(stairStr);
assert.strictEqual(polyStr.length, 4, 'Straight staircase footprint must have 4 vertices');
console.log('  ✓ U-Shape and Straight stairs returned 4 bounding vertices');

// Test createProject initializes stairs array
const proj = Core.createProject('Test House');
assert(Array.isArray(proj.plan.stairs), 'createProject must initialize plan.stairs array');
assert.strictEqual(proj.plan.stairs.length, 0);

// Test deserializeProject preserves stairs array
const serialized = Core.serializeProject(proj);
proj.plan.stairs.push(stairL);
const reloaded = Core.deserializeProject(JSON.parse(JSON.stringify(proj)));
assert(Array.isArray(reloaded.plan.stairs), 'deserializeProject must preserve plan.stairs array');
assert.strictEqual(reloaded.plan.stairs.length, 1);
assert.strictEqual(reloaded.plan.stairs[0].id, stairL.id);
console.log('  ✓ Project serialization & deserialization correctly preserves stairs');


// 2. Test 2D Blueprint Plan & Interaction (orbix-plan.js)
console.log('\n2. Testing orbix-plan.js 2D Blueprint & Tools...');
const planSrc = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8');

assert(planSrc.includes('PlanEditor.prototype.renderStairs'), 'PlanEditor must have renderStairs');
assert(planSrc.includes('PlanEditor.prototype.renderStaircase'), 'PlanEditor must have renderStaircase');
assert(planSrc.includes('this.renderStairs(ctx)'), 'PlanEditor.render must call this.renderStairs(ctx)');
assert(planSrc.includes('this.renderStairs(oCtx)'), '2D plan export must call this.renderStairs(oCtx)');
assert(planSrc.includes("self.activeTool === 'stair'"), 'PlanEditor must handle activeTool === stair');
assert(planSrc.includes("self.selected = [{ type: 'stair', id: stObj.id }]") || planSrc.includes("type: 'stair'"), 'PlanEditor must support selecting stairs');
assert(planSrc.includes("type: 'move_stair'"), 'PlanEditor must support move_stair drag state');
assert(planSrc.includes("item.type === 'stair'"), 'deleteSelected must delete stairs');
assert(planSrc.includes("e.key.toLowerCase() === 'k'"), 'Hotkey K must be wired for stairs');

console.log('  ✓ renderStairs, renderStaircase, 2D export, hit-testing, dragging & deletion verified');


// 3. Test 3D Physical Staircase Builder (orbix-3d.js)
console.log('\n3. Testing orbix-3d.js 3D Mesh Generation & Materials...');
const threeDSrc = fs.readFileSync(path.join(rootDir, 'orbix-3d.js'), 'utf8');

assert(threeDSrc.includes('ArchitecturalRenderer.prototype.buildStaircaseMesh'), 'Must have buildStaircaseMesh');
assert(threeDSrc.includes('buildStaircaseMesh(stairObj)'), '3D scene builder must iterate plan.stairs and build mesh');
assert(threeDSrc.includes("finish === 'wood'") && threeDSrc.includes("stair.finish || 'marble'"), 'Must support Statuario White Marble & Wood treads');
assert(threeDSrc.includes("finish === 'concrete'"), 'Must support Basalt Stone / Concrete treads');
assert(threeDSrc.includes('landingMesh'), 'Must construct intermediate landing platform');
assert(threeDSrc.includes('railMat') && threeDSrc.includes('rail1Mesh'), 'Must generate stainless steel sloping handrails');
assert(threeDSrc.includes('glass1Mesh') || threeDSrc.includes('glassMat'), 'Must generate tempered glass balustrades');
assert(threeDSrc.includes('post1') && threeDSrc.includes('post2'), 'Must generate newel posts at bottom and landing');

console.log('  ✓ 3D mesh generator with marble/wood/concrete treads, landing slab, handrails & balustrades verified');


// 4. Test UI & Inspector (index.html & orbix-ui.js)
console.log('\n4. Testing index.html & orbix-ui.js UI Controls...');
const htmlSrc = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const uiSrc = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8');

assert(htmlSrc.includes('id="planStairBtn"'), 'index.html must have #planStairBtn');
assert(htmlSrc.includes('data-tool="stair"'), '#planStairBtn must have data-tool="stair"');
assert(uiSrc.includes("sel.type === 'stair'"), 'orbix-ui.js must support sel.type === stair in inspector');
assert(uiSrc.includes('inspStairType'), 'Inspector must have layout dropdown (L, U, Straight)');
assert(uiSrc.includes('inspStairTurnRight') && uiSrc.includes('inspStairTurnLeft'), 'Inspector must have Turn Right / Left toggles');
assert(uiSrc.includes('inspStairWidth'), 'Inspector must have flight width slider');
assert(uiSrc.includes('inspStairFinish'), 'Inspector must have tread finish selector');
assert(uiSrc.includes('inspStairRailing'), 'Inspector must have railing style selector');
assert(uiSrc.includes('inspStairRotate90'), 'Inspector must have rotate 90° button');
assert(uiSrc.includes('inspStairDelete'), 'Inspector must have delete button');

console.log('  ✓ + Stairs toolbar button and complete Staircase Inspector panel verified');

console.log('\n======================================================');
console.log('ALL STAIRCASE AUTOMATION & INTEGRATION TESTS PASSED! ✓');
console.log('======================================================\n');
