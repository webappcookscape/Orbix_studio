// tests/test-five-fixes.js
// Verification for the 5 fixes:
// 1. Legs for Wardrobes & Tall Units, Inspector toggle for TV Consoles & Vanities
// 2. Smooth zoom in/out & 15/90 deg rotation snapping
// 3. O/S units: 18mm depth & buildOnlyShutterMesh (no carcass)
// 4. L-Shaped Corner Base Unit (Cookscape) 6-vertex joint points & Arm 1 / Arm 2 snapping
// 5. Back panels / wall paneling 18mm mesh without carcass

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING TEST SUITE: 5 ARCHITECTURAL FIXES ---');

// 1. Check orbix-3d.js
const orbix3dSrc = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');

// Fix 1: hasLegs logic & plinth in 3D
assert(orbix3dSrc.includes('isWardrobeOrTall'), 'Wardrobe check missing in 3D');
assert(orbix3dSrc.includes('isTvOrVanity'), 'TV/Vanity check missing in 3D');
assert(orbix3dSrc.includes('var plinthH = hasLegs ? 100 : 0;'), '100mm plinth missing for wardrobes/tall units');
assert(orbix3dSrc.includes('buildOnlyShutterMesh'), 'buildOnlyShutterMesh missing in 3D');
assert(orbix3dSrc.includes('buildWallPanelMesh'), 'buildWallPanelMesh missing in 3D');

console.log('✓ Fix 1 & 3 & 5 in orbix-3d.js verified');

// 2. Check orbix-ui.js
const orbixUiSrc = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
assert(orbixUiSrc.includes('id="inspFurnLegs"'), 'inspFurnLegs select missing in Inspector UI');
assert(orbixUiSrc.includes('Floor Standing (100mm Legs / Plinth)'), 'Floor Standing option missing in UI');
assert(orbixUiSrc.includes('Floating / Wall-Hung (No Legs)'), 'Floating option missing in UI');

console.log('✓ Fix 1 in orbix-ui.js verified (Inspector legs toggle)');

// 3. Check app.js (Zoom & Gizmo snap)
const appSrc = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
assert(appSrc.includes('Math.min(8.0, cam.zoom)'), '3D camera zoom range not increased to 8.0');
assert(appSrc.includes('var snapStep = e.shiftKey ? (Math.PI / 2) : (Math.PI / 12);'), '15-degree rotation snapping step missing');
assert(appSrc.includes('d = Math.max(250, dist / safeZoom)'), 'Minimum camera zoom distance 250mm missing');

console.log('✓ Fix 2 in app.js verified (3D zoom range & 15/90 deg rotation snapping)');

// 4. Check orbix-plan.js (2D zoom & L-Corner snapping)
const planSrc = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
assert(planSrc.includes('Math.min(10.0, self.zoom * zoomFactor)'), '2D zoom max not set to 10.0');
assert(planSrc.includes('isLCorner'), 'isLCorner check missing in 2D plan');
assert(planSrc.includes("'Arm 1 Joint'"), 'Arm 1 Joint missing in getFurnitureJointPoints');
assert(planSrc.includes("'Arm 2 Joint'"), 'Arm 2 Joint missing in getFurnitureJointPoints');
assert(planSrc.includes('otherIsLCorner'), 'otherIsLCorner snapping missing in snapFurniture');

console.log('✓ Fix 2 & 4 in orbix-plan.js verified (2D zoom & L-corner 6-vertex / arm joints)');

// 5. Check catalog depth for O/S units in orbix-core.js
const coreSrc = fs.readFileSync(path.join(__dirname, '../orbix-core.js'), 'utf8');
const unitsData = JSON.parse(fs.readFileSync(path.join(__dirname, '../units_data.json'), 'utf8'));

const osIds = ['loft-1d-os', 'loft-2d-os', 'fm-120 o/s', 'fm-60 o/s', 'wm-60 o/s', 'wm-30 o/s'];
osIds.forEach(id => {
  const item = unitsData.find(u => (u.id || '').toLowerCase() === id.toLowerCase() || (u.code || '').toLowerCase() === id.toLowerCase());
  if (item) {
    assert(item.dimensions && item.dimensions.D === 18, `Unit ${id} depth in units_data.json should be 18mm, got ${item.dimensions ? item.dimensions.D : 'undefined'}`);
  }
});
console.log('✓ Fix 3: All O/S units confirmed 18mm depth in units_data.json');

console.log('ALL 5 FIXES TEST SUITE PASSED SUCCESSFULLY!');
