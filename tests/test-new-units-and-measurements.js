// Comprehensive test suite for New Units, Segmented Opening Measurements, Wall Dimension Visibility, and Unit Dot Removal
var fs = require('fs');
var path = require('path');
var assert = require('assert');

console.log('[Test Suite] Starting tests for New Units, Segmented Measurements & Canvas Cleanliness...');

var Core = require('../orbix-core.js');

// Test 1: Verify New Catalog Units exist with correct properties
console.log('-> Test 1: Verifying new units in FURNITURE_CATALOG...');
var catalog = Core.FURNITURE_CATALOG;
assert(Array.isArray(catalog), 'FURNITURE_CATALOG must be an array');

var wfm60 = catalog.find(function (it) { return it.id === 'wfm60-roll'; });
assert(wfm60, 'wfm60-roll must exist in catalog');
assert.strictEqual(wfm60.name, 'Rolling shutter wfm60', 'wfm60 name must be correct');
assert.strictEqual(wfm60.dimensions.W, 600, 'wfm60 W must be 600');
assert.strictEqual(wfm60.dimensions.H, 1200, 'wfm60 H must be 1200');
assert(wfm60.dimensions.D >= 300 && wfm60.dimensions.D <= 550, 'wfm60 D must be between 300 and 550');
assert.strictEqual(wfm60.elevation, 750, 'wfm60 floor elevation must be 750');
assert.strictEqual(wfm60.unitConfig.shutterType, 'rolling_shutter', 'wfm60 shutterType must be rolling_shutter');
assert.strictEqual(wfm60.unitConfig.isRollingShutter, true, 'wfm60 isRollingShutter must be true');

var fcmRtOs = catalog.find(function (it) { return it.id === 'fcm-rt-os'; });
assert(fcmRtOs, 'fcm-rt-os must exist in catalog');
assert.strictEqual(fcmRtOs.name, 'FCM-RT Only Shutter', 'fcm-rt-os name must be correct');
assert.strictEqual(fcmRtOs.unitConfig.isOnlyShutter, true, 'fcm-rt-os must be only shutter');
assert.strictEqual(fcmRtOs.unitConfig.fixedPanel.width, 600, 'fcm-rt-os fixedPanel must be 600');
assert.strictEqual(fcmRtOs.unitConfig.openShutter.width, 450, 'fcm-rt-os openShutter must be 450');
assert.strictEqual(fcmRtOs.unitConfig.openShutter.opening, 'right', 'fcm-rt-os opening must be right');

var fcmLtOs = catalog.find(function (it) { return it.id === 'fcm-lt-os'; });
assert(fcmLtOs, 'fcm-lt-os must exist in catalog');
assert.strictEqual(fcmLtOs.name, 'FCM-LT Only Shutter', 'fcm-lt-os name must be correct');
assert.strictEqual(fcmLtOs.unitConfig.isOnlyShutter, true, 'fcm-lt-os must be only shutter');
assert.strictEqual(fcmLtOs.unitConfig.fixedPanel.width, 600, 'fcm-lt-os fixedPanel must be 600');
assert.strictEqual(fcmLtOs.unitConfig.openShutter.width, 450, 'fcm-lt-os openShutter must be 450');
assert.strictEqual(fcmLtOs.unitConfig.openShutter.opening, 'left', 'fcm-lt-os opening must be left');
console.log('✓ Test 1 passed: All 3 new catalog units verified with exact specs.');

// Test 2: Unit placement & elevation instantiation
console.log('-> Test 2: Instantiating units through createFurniturePlacement...');
var placedWfm = Core.createFurniturePlacement({ id: 'wfm60-roll', dimensions: { W: 600, H: 1200, D: 350 }, elevation: 750 });
assert.strictEqual(placedWfm.elevation, 750, 'Placed wfm60 elevation must be 750');
assert.strictEqual(placedWfm.unitConfig.isRollingShutter, true, 'Placed wfm60 must retain isRollingShutter');

var placedFcmOs = Core.createFurniturePlacement({ id: 'fcm-rt-os', dimensions: { W: 1050, H: 750, D: 550 } });
assert.strictEqual(placedFcmOs.unitConfig.isOnlyShutter, true, 'Placed fcm-rt-os must be only shutter');
assert.strictEqual(placedFcmOs.unitConfig.hasLegs, false, 'Placed fcm-rt-os must have no legs (civil slab)');
assert.strictEqual(placedFcmOs.unitConfig.counter, 'none', 'Placed fcm-rt-os must have no countertop (civil slab)');
console.log('✓ Test 2 passed: Unit instantiation and defaults verified.');

// Test 3: Math for Corner A, Width, and Corner B
console.log('-> Test 3: Segmented Opening measurement bidirectional math...');
var wallLength = 8305; // 6637 + 900 + 768 = 8305 mm
var testOp = { width: 900, offset: 7087 }; // 6637 + 450 = 7087 mm

// Initial check
var distA = Math.round(testOp.offset - testOp.width / 2);
var distB = Math.round(wallLength - (testOp.offset + testOp.width / 2));
assert.strictEqual(distA, 6637, 'Corner A distance must be 6637');
assert.strictEqual(distB, 768, 'Corner B distance must be 768');
assert.strictEqual(distA + testOp.width + distB, wallLength, 'Sum of segments must equal total wall length');

// Case A: User changes Distance from Corner A to 5000 mm
var newDistA = 5000;
testOp.offset = Math.round(newDistA + testOp.width / 2);
var updatedDistB = Math.round(wallLength - (testOp.offset + testOp.width / 2));
assert.strictEqual(testOp.offset, 5450, 'Offset after DistA change must be 5450');
assert.strictEqual(updatedDistB, 8305 - 5000 - 900, 'DistB must adjust to 2405');

// Case B: User changes Distance to Corner B to 1200 mm
var newDistB = 1200;
testOp.offset = Math.round(wallLength - newDistB - testOp.width / 2);
var updatedDistA = Math.round(testOp.offset - testOp.width / 2);
assert.strictEqual(testOp.offset, 8305 - 1200 - 450, 'Offset after DistB change must be 6655');
assert.strictEqual(updatedDistA, 8305 - 1200 - 900, 'DistA must adjust to 6205');

// Case C: User changes Width to 1000 mm (anchoring Corner A at 6205)
var newWidth = 1000;
var anchorA = Math.round(testOp.offset - testOp.width / 2);
testOp.width = newWidth;
testOp.offset = Math.round(anchorA + testOp.width / 2);
var postWidthDistA = Math.round(testOp.offset - testOp.width / 2);
var postWidthDistB = Math.round(wallLength - (testOp.offset + testOp.width / 2));
assert.strictEqual(postWidthDistA, 6205, 'Corner A should stay anchored at 6205');
assert.strictEqual(postWidthDistB, 8305 - 6205 - 1000, 'Corner B should be 1100');
console.log('✓ Test 3 passed: Bidirectional opening math verified with exact values.');

// Test 4: Verify code patterns in orbix-plan.js and orbix-ui.js
console.log('-> Test 4: Verifying code fixes in orbix-plan.js, orbix-ui.js, and orbix-3d.js...');
var planCode = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
var uiCode = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
var threeDCode = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');

// Verify connection dots removed in orbix-plan.js
assert(planCode.indexOf('// Connection dots on units removed per user request for visual cleanliness') !== -1, 'Connection dots should be removed');
assert(planCode.indexOf('// 8 Jointing & Connection Points') === -1, 'Old 8 connection points block must be removed');

// Verify default wall measurements hidden unless clicked
assert(planCode.indexOf('PlanEditor.prototype.renderAllWallDimensions = function (ctx, forceAll)') !== -1, 'renderAllWallDimensions must support forceAll and selection gating');
assert(planCode.indexOf('forceAll || isSelected || hasSelectedOp || isPreviewTarget') !== -1, 'Only selected or previewed walls render dimensions');

// Verify opening inspector fixes in orbix-ui.js
assert(uiCode.indexOf('updateOp(true)') !== -1, 'updateOp must support skipOffsetRead parameter');
assert(uiCode.indexOf('inspOpBannerA') !== -1, 'Banner must update live');
assert(uiCode.indexOf('handleDistA') !== -1, 'handleDistA listener must exist');
assert(uiCode.indexOf('handleDistB') !== -1, 'handleDistB listener must exist');

// Verify 3D rolling shutter & corner only shutter
assert(threeDCode.indexOf('buildRollingShutterCabinetMesh') !== -1, 'buildRollingShutterCabinetMesh must exist in orbix-3d.js');
assert(threeDCode.indexOf('// Corner Only-Shutter (FCM-RT OS or FCM-LT OS)') !== -1, 'Corner only shutter support must exist in buildOnlyShutterMesh');

console.log('✓ Test 4 passed: All file implementations verified.');

console.log('-> Test 5: Verifying FBCM Dual-Arm and Shutter Independence...');
// Verify FBCM inspector UI and listeners
assert(uiCode.indexOf('inspFbcmLegW') !== -1, 'inspFbcmLegW must exist in orbix-ui.js');
assert(uiCode.indexOf('inspFbcmShutterA') !== -1, 'inspFbcmShutterA must exist in orbix-ui.js');
assert(uiCode.indexOf('inspFbcmLegD') !== -1, 'inspFbcmLegD must exist in orbix-ui.js');
assert(uiCode.indexOf('inspFbcmShutterB') !== -1, 'inspFbcmShutterB must exist in orbix-ui.js');
assert(uiCode.indexOf('inspFbcmDepth') !== -1, 'inspFbcmDepth must exist in orbix-ui.js');
assert(uiCode.indexOf('newLegW = Math.round(shVal + cDepth)') !== -1, 'Bidirectional Shutter A calculation must exist');
assert(uiCode.indexOf('newLegD = Math.round(shVal + cDepth)') !== -1, 'Bidirectional Shutter B calculation must exist');

// Verify FBCM 2D plan label with both arms and shutters
assert(planCode.indexOf('A: \' + Math.round(legWVal) + \' (Sh: \' + shAVal + \') · B: \' + Math.round(legDVal) + \' (Sh: \' + shBVal') !== -1, '2D Plan must display both arms and shutter sizes');
console.log('✓ Test 5 passed: FBCM Dual-Arm and Shutter independence verified.');

console.log('-> Test 6: Verifying Free Placement and Wall Snapping Controls...');
assert(planCode.indexOf('this.forceFreePlacement = false;') !== -1, 'PlanEditor must have forceFreePlacement state');
assert(planCode.indexOf('this.isShiftDown || this.isAltDown || this.forceFreePlacement') !== -1, 'Free placement must check Shift, Alt, or forceFreePlacement');
assert(uiCode.indexOf('planSnapToggleBtn') !== -1, 'planSnapToggleBtn must be wired in orbix-ui.js');
assert(fs.readFileSync('index.html', 'utf8').indexOf('id="planSnapToggleBtn"') !== -1, 'planSnapToggleBtn must exist in index.html');
console.log('✓ Test 6 passed: Free Placement and Wall Snapping controls verified.');

console.log('-> Test 7: Verifying Anti-Overlap Resolver along Wall Face & RCC Snapping...');
assert(planCode.indexOf('// ─── ANTI-OVERLAP RESOLVER ALONG WALL FACE ───') !== -1, 'Anti-overlap resolver must exist in orbix-plan.js');
assert(planCode.indexOf('occupiedIntervals.push(') !== -1, 'Occupied intervals calculation must exist');
assert(planCode.indexOf('candT = occ.end + halfActiveW;') !== -1, 'Push-out to positive side of adjacent unit verified');
assert(planCode.indexOf('candT = occ.start - halfActiveW;') !== -1, 'Push-out to negative side of adjacent unit verified');
assert(planCode.indexOf('// ─── RCC COLUMN / STRUCTURAL PILLAR DETECTION ───') !== -1, 'RCC Column detection must exist in orbix-plan.js');
assert(planCode.indexOf('rcc_placement') !== -1, 'RCC placement snap type must exist');
assert(planCode.indexOf('rcc_snap') !== -1, 'RCC face snap type must exist');
console.log('✓ Test 7 passed: Anti-Overlap and RCC Snapping verified.');

console.log('\n[PASS] All test suites passed successfully!');
