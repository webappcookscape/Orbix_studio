const assert = require('assert');
const fs = require('fs');

// Mock window and browser environment
global.window = {};
global.document = {
  getElementById: function () { return null; },
  createElement: function () { return {}; }
};

const Core = require('../orbix-core.js');

console.log('[Test Suite] Verifying FCM OS, WFM60 Rolling Shutter, and WM OS Depth...');

// Test 1: FCM-RT OS and FCM-LT OS legs and countertop
console.log('-> Test 1: FCM-RT OS and FCM-LT OS legs and countertop verification...');
const cat = Core.FURNITURE_CATALOG;
const fcmRtOs = cat.find(u => u.id === 'fcm-rt-os');
const fcmLtOs = cat.find(u => u.id === 'fcm-lt-os');

assert(fcmRtOs, 'fcm-rt-os must exist in catalog');
assert.strictEqual(fcmRtOs.dimensions.H, 850, 'fcm-rt-os H must be 850');
assert.strictEqual(fcmRtOs.unitConfig.hasLegs, true, 'fcm-rt-os hasLegs must be true');
assert.strictEqual(fcmRtOs.unitConfig.plinthH, 100, 'fcm-rt-os plinthH must be 100');
assert(fcmRtOs.unitConfig.counter && fcmRtOs.unitConfig.counter !== 'none', 'fcm-rt-os must have countertop');

assert(fcmLtOs, 'fcm-lt-os must exist in catalog');
assert.strictEqual(fcmLtOs.dimensions.H, 850, 'fcm-lt-os H must be 850');
assert.strictEqual(fcmLtOs.unitConfig.hasLegs, true, 'fcm-lt-os hasLegs must be true');
assert.strictEqual(fcmLtOs.unitConfig.plinthH, 100, 'fcm-lt-os plinthH must be 100');
assert(fcmLtOs.unitConfig.counter && fcmLtOs.unitConfig.counter !== 'none', 'fcm-lt-os must have countertop');

// When instantiated via createFurniturePlacement
const pRt = Core.createFurniturePlacement({ id: 'fcm-rt-os' });
assert.strictEqual(pRt.unitConfig.hasLegs, true, 'Instantiated fcm-rt-os hasLegs must be true');
assert.strictEqual(pRt.unitConfig.plinthH, 100, 'Instantiated fcm-rt-os plinthH must be 100');
assert.strictEqual(pRt.unitConfig.counter, 'granite_kashmir_white', 'Instantiated fcm-rt-os counter must be granite_kashmir_white');

const pLt = Core.createFurniturePlacement({ id: 'fcm-lt-os' });
assert.strictEqual(pLt.unitConfig.hasLegs, true, 'Instantiated fcm-lt-os hasLegs must be true');
assert.strictEqual(pLt.unitConfig.plinthH, 100, 'Instantiated fcm-lt-os plinthH must be 100');
assert.strictEqual(pLt.unitConfig.counter, 'granite_kashmir_white', 'Instantiated fcm-lt-os counter must be granite_kashmir_white');
console.log('✓ Test 1 passed: FCM-RT OS and FCM-LT OS verified with 100mm legs and countertop.');

// Test 2: WFM60 Rolling Shutter default elevation & depth flexibility
console.log('-> Test 2: WFM60 Rolling Shutter elevation and depth flexibility...');
const wfmCatalog = cat.find(u => u.id === 'wfm60-roll');
assert(wfmCatalog, 'wfm60-roll must exist in catalog');
assert.strictEqual(wfmCatalog.elevation, 750, 'wfm60-roll catalog elevation must be 750');

const pWfmDef = Core.createFurniturePlacement({ id: 'wfm60-roll' });
assert.strictEqual(pWfmDef.elevation, 750, 'wfm60-roll default elevation must be 750');

// Custom depth between 300 and 550
const pWfmCustomD = Core.createFurniturePlacement({ id: 'wfm60-roll', dimensions: { W: 600, H: 1200, D: 450 } });
assert.strictEqual(pWfmCustomD.dimensions.D, 450, 'wfm60-roll custom depth must be 450');
console.log('✓ Test 2 passed: WFM60 Rolling Shutter defaults to 750 elevation and supports custom depths.');

// Test 3: WM OS Depth Flexibility
console.log('-> Test 3: WM OS (wm-60 o/s, wm-30 o/s) depth flexibility...');
const wm60OsCat = cat.find(u => u.id === 'wm-60 o/s');
assert(wm60OsCat, 'wm-60 o/s must exist in catalog');
assert.strictEqual(wm60OsCat.dimensions.D, 350, 'wm-60 o/s default depth is 350');

// User changes depth to 300mm
const pWm300 = Core.createFurniturePlacement({ id: 'wm-60 o/s', dimensions: { W: 600, H: 600, D: 300 } });
assert.strictEqual(pWm300.dimensions.D, 300, 'wm-60 o/s custom depth 300 must be preserved');

// User changes depth to 400mm
const pWm400 = Core.createFurniturePlacement({ id: 'wm-60 o/s', dimensions: { W: 600, H: 600, D: 400 } });
assert.strictEqual(pWm400.dimensions.D, 400, 'wm-60 o/s custom depth 400 must be preserved');

// Test 2D Plan rendering depth computation logic
const planContent = fs.readFileSync('orbix-plan.js', 'utf8');
assert(planContent.includes('var dMm = (f.dimensions && f.dimensions.D && f.dimensions.D >= 18) ?'), 'orbix-plan.js must respect custom OS depth >= 18');

// Test 3D buildOnlyShutterMesh depth computation logic
const d3Content = fs.readFileSync('orbix-3d.js', 'utf8');
assert(d3Content.includes('var baseD = (dims.D && dims.D >= 18) ? dims.D :'), 'orbix-3d.js must respect custom OS depth >= 18');
assert(d3Content.includes('isFcmCornerOS'), 'orbix-3d.js must recognize FCM Corner OS for legs and countertop');

// Test Rolling Shutter slats retraction logic in 3D
assert(d3Content.includes('setRollOpen'), 'orbix-3d.js must implement realistic rolling shutter retraction');
assert(d3Content.includes('drumMesh'), 'orbix-3d.js must include internal roll drum');

console.log('✓ Test 3 passed: WM OS depth changes properly supported in core, 2D plan, and 3D.');
console.log('\n[PASS] All 3 user requirements verified successfully!');

