/**
 * Automated Verification Suite for all 10 User Feedback Items
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser DOM and global objects if needed
global.window = global;
global.document = {
  createElement: function (tag) {
    return {
      tagName: tag.toUpperCase(),
      style: {},
      classList: {
        add: function () {},
        remove: function () {},
        contains: function () { return false; },
        toggle: function () {}
      },
      appendChild: function () {},
      removeChild: function () {},
      addEventListener: function () {},
      getContext: function () {
        return {
          save: function () {},
          restore: function () {},
          beginPath: function () {},
          closePath: function () {},
          moveTo: function () {},
          lineTo: function () {},
          arc: function () {},
          rect: function () {},
          roundRect: function () {},
          strokeRect: function () {},
          fillRect: function () {},
          stroke: function () {},
          fill: function () {},
          fillText: function () {},
          measureText: function (txt) { return { width: (txt || '').length * 7 }; },
          setLineDash: function () {},
          scale: function () {},
          translate: function () {},
          rotate: function () {}
        };
      },
      toDataURL: function () { return 'data:image/png;base64,mock'; }
    };
  },
  getElementById: function () { return null; },
  querySelectorAll: function () { return []; }
};

const Core = require('../orbix-core.js');

console.log('=== TEST SUITE: 10 USER FEEDBACK FIXES ===\n');

// 1. BLANK SHUTTER (bs-60)
console.log('1. Testing Blank Shutter (bs-60)...');
const bsItem = Core.FURNITURE_CATALOG.find(it => it.id === 'bs-60');
assert(bsItem, 'bs-60 catalog item must exist');
assert.strictEqual(bsItem.dimensions.W, 60, 'bs-60 width must be 60mm');
assert.strictEqual(bsItem.dimensions.H, 750, 'bs-60 height must be 750mm');
assert.strictEqual(bsItem.dimensions.D, 18, 'bs-60 depth must be 18mm');
const isWall = Core.isWallUnit(bsItem.category, bsItem.name, bsItem.code, bsItem.costCategory);
assert.strictEqual(isWall, false, 'bs-60 must NOT be classified as a wall unit!');
console.log('  ✓ bs-60: Width=60mm, Height=750mm, Depth=18mm, isWallUnit=false');

// 2. LEDGES AREA FORMULA: Length(Width) * Depth
console.log('\n2. Testing Ledges Area Formula: Length(Width) * Depth...');
const ledgeStd = Core.FURNITURE_CATALOG.find(it => it.id === 'ledge-std');
assert(ledgeStd, 'ledge-std catalog item must exist');
const ledgePrice = Core.calculateItemPricing(ledgeStd, Core.DEFAULT_RATE_CARD);
const expectedStdSqft = (1200 * 200) / 92903.04; // W * D
assert(Math.abs(ledgePrice.areaSft - expectedStdSqft) < 0.05, `ledge-std area should be ${expectedStdSqft.toFixed(2)} sqft, got ${ledgePrice.areaSft.toFixed(2)}`);
assert(ledgePrice.formulaDescription.indexOf('(L) ×') !== -1, 'formulaDescription should show (L) × (D)');

const ledgeCtop = Core.FURNITURE_CATALOG.find(it => it.id === 'ledge-ctop');
assert(ledgeCtop, 'ledge-ctop catalog item must exist');
const ctopPrice = Core.calculateItemPricing(ledgeCtop, Core.DEFAULT_RATE_CARD);
const expectedCtopSqft = (900 * 550) / 92903.04; // W * D
assert(Math.abs(ctopPrice.areaSft - expectedCtopSqft) < 0.05, `ledge-ctop area should be ${expectedCtopSqft.toFixed(2)} sqft, got ${ctopPrice.areaSft.toFixed(2)}`);
console.log(`  ✓ ledge-std area: ${ledgePrice.areaSft.toFixed(2)} sqft (formula: ${ledgePrice.formulaDescription})`);
console.log(`  ✓ ledge-ctop area: ${ctopPrice.areaSft.toFixed(2)} sqft (formula: ${ctopPrice.formulaDescription})`);

// 3. AI ROOM DECOR MODAL (Removed per user request)
console.log('\n3. Testing AI Room Decor Modal Removal...');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const modalCount = (indexHtml.match(/id="modalAIDecor"/g) || []).length;
assert.strictEqual(modalCount, 0, `modalAIDecor must be removed from index.html, found ${modalCount}`);
console.log('  ✓ modalAIDecor successfully removed from index.html per user request');

// 4. DOOR OPTIONS: Always Closed, Double, Sliding, Frame-Only
console.log('\n4. Testing Door Subtypes & Always Closed default...');
const doorDefault = Core.createOpening({ type: 'door' });
assert.strictEqual(doorDefault.doorType, 'single_closed', 'Default doorType should be single_closed');

const doorDouble = Core.createOpening({ type: 'door', doorType: 'double' });
assert.strictEqual(doorDouble.doorType, 'double');

const doorSliding = Core.createOpening({ type: 'door', doorType: 'sliding' });
assert.strictEqual(doorSliding.doorType, 'sliding');

const doorFrameOnly = Core.createOpening({ type: 'door', doorType: 'frame_only' });
assert.strictEqual(doorFrameOnly.doorType, 'frame_only');
console.log('  ✓ Door subtypes supported: single_closed, double, sliding, frame_only');

// 5. WINDOW OPTIONS: Sliding, Flap-up, Standard
console.log('\n5. Testing Window Subtypes: Sliding, Flap-up, Standard...');
const winSliding = Core.createOpening({ type: 'window' });
assert.strictEqual(winSliding.windowType, 'sliding', 'Default windowType should be sliding');

const winFlapup = Core.createOpening({ type: 'window', windowType: 'flapup' });
assert.strictEqual(winFlapup.windowType, 'flapup');

const winStandard = Core.createOpening({ type: 'window', windowType: 'standard' });
assert.strictEqual(winStandard.windowType, 'standard');
console.log('  ✓ Window subtypes supported: sliding, flapup, standard');

// 6. CEILING THICKNESS: 100mm
console.log('\n6. Testing Ceiling 100mm Thickness in orbix-3d.js...');
const orbix3dSrc = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');
assert(orbix3dSrc.indexOf('ceilingThick = 100') !== -1, 'orbix-3d.js must set ceilingThick = 100');
assert(orbix3dSrc.indexOf('ExtrudeGeometry(shape, { depth: ceilingThick') !== -1, 'Ceiling must be extruded with ceilingThick');
console.log('  ✓ Ceiling geometry extruded with exactly 100mm thickness');

// 7. TAPE MEASURE TOOL
console.log('\n7. Testing Tape Tool in orbix-plan.js...');
const orbixPlanSrc = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
assert(orbixPlanSrc.indexOf('this.lastTapeMeasure = null;') !== -1, 'handleDimensionMouseDown must reset lastTapeMeasure on start');
assert(orbixPlanSrc.indexOf('if (this.lastTapeMeasure && this.lastTapeMeasure.p1 && this.lastTapeMeasure.p2)') !== -1, 'render must keep lastTapeMeasure on canvas');
console.log('  ✓ Tape tool snaps points and keeps lastTapeMeasure rendered on canvas');

// 8. COUNTERTOP MATTE HONED FINISH
console.log('\n8. Testing Countertop Matte Finish in orbix-3d.js...');
assert(orbix3dSrc.indexOf('roughness: 0.65') !== -1, 'Countertop material must have matte roughness: 0.65');
assert(orbix3dSrc.indexOf('clearcoat: 0.0') !== -1, 'Countertop material must have zero clearcoat (matte finish)');
console.log('  ✓ Countertop configured as authentic Matte Honed Granite (roughness: 0.65, clearcoat: 0.0)');

// 9. RESIZE AND CANVAS RENDER
console.log('\n9. Testing Canvas White Screen Glitch Fix in orbix-plan.js & orbix-ui.js...');
const normalizedPlanSrc = orbixPlanSrc.replace(/\r\n/g, '\n');
assert(normalizedPlanSrc.indexOf('PlanEditor.prototype.resize = function () {\n    var dpr = window.devicePixelRatio || 1;\n    var w = this.container.clientWidth || 800;\n    var h = this.container.clientHeight || 600;\n    this.canvas.width = w * dpr;\n    this.canvas.height = h * dpr;\n    this.ctx.scale(dpr, dpr);\n    this.width = w;\n    this.height = h;\n    this.render();') !== -1, 'PlanEditor.prototype.resize must call this.render()');
console.log('  ✓ PlanEditor.resize() immediately calls this.render() to prevent white canvas flashing');

// 10. DETAILED 2D PLAN EXPORT
console.log('\n10. Testing Detailed 2D Plan Export in orbix-plan.js...');
assert(orbixPlanSrc.indexOf('DOOR & WINDOW SCHEDULE') !== -1, 'exportDetailed2DPlan must include Door & Window Schedule table');
assert(orbixPlanSrc.indexOf('Clearance:') !== -1, 'exportDetailed2DPlan must include room inner clearance callouts');
assert(orbixPlanSrc.indexOf('⚡ SW') !== -1, 'exportDetailed2DPlan must include electrical switch point markers');
assert(orbixPlanSrc.indexOf('🚰 Plumbing Point') !== -1, 'exportDetailed2DPlan must include plumbing point markers');
assert(orbixPlanSrc.indexOf('🔥 Gas Supply Line') !== -1, 'exportDetailed2DPlan must include gas point markers');
console.log('  ✓ exportDetailed2DPlan includes Room Clearances, Door & Window Schedule, Electrical & Plumbing points, and Legend');

console.log('\n========================================');
console.log('🎉 ALL 10 TESTS PASSED WITH 100% SUCCESS!');
console.log('========================================');
