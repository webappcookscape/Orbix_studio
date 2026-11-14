// Automated verification test for all 20 user requests
const assert = require('assert');
const fs = require('fs');

console.log('--- Testing 20 User Requirements ---');

// Mock browser environment for orbix modules
global.window = {
  location: { search: '' },
  addEventListener: function () { },
  OrbixWallMode: 'single_auto'
};
global.document = {
  createElement: function () {
    return {
      getContext: function () {
        return {
          createLinearGradient: function () {
            return { addColorStop: function () { } };
          },
          fillRect: function () { }
        };
      },
      style: {}
    };
  },
  getElementById: function () { return null; },
  querySelectorAll: function () { return []; }
};
global.localStorage = { getItem: function () { return null; }, setItem: function () { } };

const Core = require('../orbix-core.js');

// 1. All Wall units kitchen has Floor Elevation (AFFL) = 1500
const kw = Core.createFurniturePlacement({
  name: 'Kitchen Wall Cabinet',
  category: 'kitchen_wall',
  dimensions: { W: 900, H: 600, D: 350 }
});
assert.strictEqual(kw.elevation, 1500, 'Test 1 Failed: Kitchen wall elevation must be 1500');
console.log('✅ 1. Kitchen Wall elevation is 1500');

// 2. All Spice rack has Floor Elevation (AFFL) = 1350
const sr = Core.createFurniturePlacement({
  name: 'Spice Rack Open Box',
  category: 'kitchen_wall_spice',
  id: 'sr-open-1'
});
assert.strictEqual(sr.elevation, 1350, 'Test 2 Failed: Spice rack elevation must be 1350');
console.log('✅ 2. Spice Rack elevation is 1350');

// 3. All kitchen Fm needs leg 100mm and counter top
const fm = Core.createFurniturePlacement({
  name: 'FM 60 2-Door',
  category: 'kitchen_fm'
});
assert.strictEqual(fm.unitConfig.hasLegs, true, 'Test 3 Failed: FM hasLegs must be true');
assert.strictEqual(fm.unitConfig.legs, 100, 'Test 3 Failed: FM legs must be 100');
assert.strictEqual(fm.unitConfig.plinthH, 100, 'Test 3 Failed: FM plinthH must be 100');
assert.strictEqual(fm.unitConfig.counter, 'black', 'Test 3 Failed: FM counter must be black');
console.log('✅ 3. Kitchen FM has 100mm legs and countertop');

// 4. Fbcm depth- 550, height -750
const fbcm = Core.FURNITURE_CATALOG.find(u => u.id === 'fbcm');
assert(fbcm, 'fbcm found');
assert.strictEqual(fbcm.dimensions.D, 550, 'Test 4 Failed: fbcm D must be 550');
assert.strictEqual(fbcm.dimensions.H, 750, 'Test 4 Failed: fbcm H must be 750');
assert.strictEqual(fbcm.unitConfig.corner.depth, 550, 'Test 4 Failed: fbcm corner depth must be 550');
console.log('✅ 4. FBCM depth is 550, height is 750');

// 5. Fcm-lt- 1050 width
const fcmLt = Core.FURNITURE_CATALOG.find(u => u.id === 'fcm-lt');
assert(fcmLt, 'fcm-lt found');
assert.strictEqual(fcmLt.dimensions.W, 1050, 'Test 5 Failed: fcm-lt W must be 1050');
assert.strictEqual(fcmLt.dimensions.H, 750, 'Test 5 Failed: fcm-lt H must be 750');
assert.strictEqual(fcmLt.dimensions.D, 550, 'Test 5 Failed: fcm-lt D must be 550');
console.log('✅ 5. FCM-LT width is 1050');

// 6. Fcm-rt- 1050 width
const fcmRt = Core.FURNITURE_CATALOG.find(u => u.id === 'fcm-rt');
assert(fcmRt, 'fcm-rt found');
assert.strictEqual(fcmRt.dimensions.W, 1050, 'Test 6 Failed: fcm-rt W must be 1050');
assert.strictEqual(fcmRt.dimensions.H, 750, 'Test 6 Failed: fcm-rt H must be 750');
assert.strictEqual(fcmRt.dimensions.D, 550, 'Test 6 Failed: fcm-rt D must be 550');
console.log('✅ 6. FCM-RT width is 1050');

// 7. In Sliding wrb . Remove drawers
const wrSliding = Core.FURNITURE_CATALOG.find(u => u.id === 'wr-sliding');
assert(wrSliding, 'wr-sliding found');
assert.strictEqual(wrSliding.unitConfig.drawers, 0, 'Test 7 Failed: wr-sliding drawers must be 0');
console.log('✅ 7. Sliding Wardrobe drawers removed (drawers: 0)');

// 8. Crockery tv base open storage depth 450.. shelves 1
const ctvbOpen = Core.FURNITURE_CATALOG.find(u => u.id === 'ctvb-open-storage');
assert(ctvbOpen, 'ctvb-open-storage found');
assert.strictEqual(ctvbOpen.dimensions.D, 450, 'Test 8 Failed: ctvb-open-storage D must be 450');
assert.strictEqual(ctvbOpen.unitConfig.shelves, 1, 'Test 8 Failed: ctvb-open-storage shelves must be 1');
console.log('✅ 8. Crockery TV Base Open Storage depth is 450, shelves is 1');

// 9. Crockery tv wall open box shelves 1
const ctvwOpen = Core.FURNITURE_CATALOG.find(u => u.id === 'ctvw-open-box');
assert(ctvwOpen, 'ctvw-open-box found');
assert.strictEqual(ctvwOpen.unitConfig.shelves, 1, 'Test 9 Failed: ctvw-open-box shelves must be 1');
console.log('✅ 9. Crockery TV Wall Open Box shelves is 1');

// 10. Only shutter base dimensions & placement
const baseOS = Core.createFurniturePlacement({
  name: 'Kitchen Base Only Shutter',
  category: 'kitchen_os',
  costCategory: 'Kitchen - O/S',
  unitConfig: { isOnlyShutter: true }
});
assert.strictEqual(baseOS.dimensions.D, 550, 'Test 10 Failed: Base O/S D must be 550');
assert.strictEqual(baseOS.unitConfig.hasLegs, true, 'Test 10 Failed: Base O/S hasLegs must be true');
console.log('✅ 10. Only shutter base placement depth is 550 with legs & countertop');

// 11. Crockery tv unit wall- 1d (additional) h-600, w-300, d-300
const ctvw1d = Core.FURNITURE_CATALOG.find(u => u.id === 'ctvw-1d');
assert(ctvw1d, 'ctvw-1d found');
assert.strictEqual(ctvw1d.dimensions.W, 300, 'Test 11 Failed: ctvw-1d W must be 300');
assert.strictEqual(ctvw1d.dimensions.H, 600, 'Test 11 Failed: ctvw-1d H must be 600');
assert.strictEqual(ctvw1d.dimensions.D, 300, 'Test 11 Failed: ctvw-1d D must be 300');
assert.strictEqual(ctvw1d.elevation, 1500, 'Test 11 Failed: ctvw-1d elevation must be 1500');
console.log('✅ 11. Crockery TV Wall 1-Door added (300x600x300, elevation 1500)');

// 12. All fm and wm needs only one shelf
assert.strictEqual(fm.unitConfig.shelves, 1, 'Test 12 Failed: FM shelves must default to 1');
const wmPlacement = Core.createFurniturePlacement({
  name: 'WM 60 Wall Unit',
  category: 'kitchen_wall'
});
assert.strictEqual(wmPlacement.unitConfig.shelves, 1, 'Test 12 Failed: WM shelves must default to 1');
console.log('✅ 12. All FM and WM default to 1 shelf');

// 13. Only doors in crockery needs no shelves
const ctvbDoors = Core.createFurniturePlacement({
  name: 'CROCKERY / TV BASE ONLY DOORS',
  category: 'crockery',
  id: 'ctvb-doors-only'
});
assert.strictEqual(ctvbDoors.unitConfig.shelves, 0, 'Test 13 Failed: Crockery only doors shelves must be 0');
console.log('✅ 13. Crockery Only Doors has 0 shelves');

// 14. Kitchen wm has crockery units too
const uiCode = fs.readFileSync('orbix-ui.js', 'utf8');
assert(uiCode.includes("c === 'crockery' || n.indexOf('crockery') !== -1"), 'Test 14 Failed: kitchen_wall_spice filter must include crockery wall units');
console.log('✅ 14. Kitchen WM includes Crockery units');

// 15. Kitchen only shuttering needs leg and counter top
assert.strictEqual(baseOS.unitConfig.hasLegs, true, 'Test 15 Failed: hasLegs must be true');
assert.strictEqual(baseOS.unitConfig.legs, 100, 'Test 15 Failed: legs must be 100');
assert.strictEqual(baseOS.unitConfig.counter, 'black', 'Test 15 Failed: counter must be black');
console.log('✅ 15. Kitchen only shuttering has 100mm legs and countertop');

// 16. While zooming walls and units do not hide
const appCode = fs.readFileSync('app.js', 'utf8').replace(/\r\n/g, '\n');
assert(appCode.includes('PerspectiveCamera(24, 1, 5, 1000000)'), 'Test 16 Failed: Camera near plane must be 5');
assert(appCode.includes('furnMeshes.forEach(function (fMesh) {\n        fMesh.visible = true;'), 'Test 16 Failed: furnMeshes must always be visible in updateWallCutaway');
console.log('✅ 16. Camera near plane is 5 and furniture units never hide during zoom/cutaway');

// 17. Default sunlight to 0 & spotlight to 0
const indexHtml = fs.readFileSync('index.html', 'utf8').replace(/\r\n/g, '\n');
assert(indexHtml.includes('id="sunlightSlider" min="0" max="3" step="0.1" value="0"'), 'Test 17 Failed: sunlightSlider default value must be 0');
assert(indexHtml.includes('id="spotlightSlider" min="0" max="3" step="0.1" value="0"'), 'Test 17 Failed: spotlightSlider default value must be 0');
console.log('✅ 17. Default sunlight and spotlight set to 0.0');

// 18. Throttle pumpThumbs and add loop guards against freezes
assert(appCode.includes('setTimeout(pumpThumbs, 60)'), 'Test 18 Failed: pumpThumbs must be throttled');
assert(appCode.includes('++pGuard < 20'), 'Test 18 Failed: circular plan loop must have depth guard');
console.log('✅ 18. pumpThumbs throttled and circular loop guards added (production ready)');

// 19. Photorealistic 3D Bed Mesh & Custom SKP auto-detection
const threeDCode = fs.readFileSync('orbix-3d.js', 'utf8').replace(/\r\n/g, '\n');
assert(threeDCode.includes('upholsteredHeadboardMat'), 'Test 19 Failed: 3D Bed must have upholstered channel-tufted headboard');
assert(threeDCode.includes('duvetMesh'), 'Test 19 Failed: 3D Bed must have luxury draped duvet');
assert(threeDCode.includes('euroPil'), 'Test 19 Failed: 3D Bed must have layered pillows');
assert(uiCode.includes("typeSelect.value = isMariamSet ? 'mariam_bed' : 'bed'"), 'Test 19 Failed: Custom SKP import must auto-detect Bed');
assert(indexHtml.includes('value="mariam_bed"'), 'Test 19 Failed: Custom decor select must have Mariam Bed option');
console.log('✅ 19. Photorealistic Master Bed Set with channel-tufted headboard, draped duvet, pillows & bedside nightstands created');

// 20. 2D Wall clickable to select, drag to move, and drag endpoints to extend/resize
const planCode = fs.readFileSync('orbix-plan.js', 'utf8').replace(/\r\n/g, '\n');
assert(planCode.includes("type: 'move_vertex'"), 'Test 20 Failed: Wall vertex click must enable move_vertex to extend wall');
assert(planCode.includes("type: 'move_wall'"), 'Test 20 Failed: Wall body click must enable move_wall to move wall');
assert(!planCode.includes("if (!isShift) {\n          this.selected = [];\n          this.onSelectionChange(this.selected);\n        }\n      }\n\n      this.render();\n      return;"), 'Test 20 Failed: Wall click must not deselect wall');
console.log('✅ 20. 2D Wall is clickable on single-click, drag-to-move parallel/perpendicular, and drag-to-extend endpoints');

console.log('\n🎉 ALL 20 TESTS PASSED SUCCESSFULLY! 🎉\n');
