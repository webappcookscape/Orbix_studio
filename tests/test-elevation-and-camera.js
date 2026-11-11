// tests/test-elevation-and-camera.js
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING TEST SUITE: 3D CAMERA, ZOOM, SELECTION & ELEVATION FIXES ---');

// 1. Verify app.js
const appSrc = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');

// A. 3D Zoom limit and min distance
assert(appSrc.includes('Math.min(25.0, cam.zoom)'), '3D camera zoom range not set to 25.0');
assert(appSrc.includes('d = Math.max(50, dist / safeZoom)'), 'Minimum camera zoom distance 50mm missing');

// B. Vertical panning (up/down movement in 3D)
assert(appSrc.includes('tgt.y += dy * Math.cos(pitchRad) * panSpeed'), 'Vertical 3D camera pan missing');
assert(appSrc.includes('tgt.y = Math.max(-500, Math.min(6000, tgt.y))'), 'Target height clamp missing');

// C. Frame active placed unit in OrbixHome3D
assert(appSrc.includes('activeUnitMesh = o;'), 'frame() did not search for active unit in OrbixHome3D');
console.log('✓ app.js camera zoom, vertical pan, and unit framing verified');

// 2. Verify orbix-ui.js
const uiSrc = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');

// A. selectFurnitureIn3DStudio MUST NOT teleport camera
assert(!uiSrc.includes("window.__cc.gl.frame('unit');"), 'Teleporting gl.frame call still present in selectFurnitureIn3DStudio!');

// B. zoomToFurnitureIn3D exists
assert(uiSrc.includes('zoomToFurnitureIn3D: function (furnId)'), 'zoomToFurnitureIn3D function missing');

// C. Inspector Card 2 has Zoom in 3D and Loft preset
assert(uiSrc.includes('id="inspFocusUnitBtn3D"'), 'inspFocusUnitBtn3D missing in Inspector');
assert(uiSrc.includes('id="btnPresetLoft"'), 'btnPresetLoft missing in Inspector');

// D. Elevation input listens to both input and change
assert(uiSrc.includes("elElev.addEventListener('input', onElevInput);"), 'input event listener missing on inspFurnElev');

// E. syncInspectorTo3D preserves eu.elev
assert(uiSrc.includes('eu.elev = (fn.elevation !== undefined && fn.elevation !== null) ? parseFloat(fn.elevation) : 0;'), 'syncInspectorTo3D does not sync eu.elev');

// F. sync3DStudioUnits prioritizes match.elevation
assert(uiSrc.includes('match.elevation !== undefined && match.elevation !== null && match.elevation !== \'\''), 'sync3DStudioUnits does not prioritize match.elevation');

console.log('✓ orbix-ui.js camera stability and elevation sync verified');

// 3. Verify orbix-3d.js
const orbix3dSrc = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');

// Default loft elevation 2100mm
assert(orbix3dSrc.includes('defElevOS = isLoftOS ? 2100 : (isWallOS ? 1500 : 0)'), 'O/S units loft elevation 2100mm missing');
assert(orbix3dSrc.includes('defElevUnit = isLoftUnit ? 2100 : (isWall ? 1500 : 0)'), 'Modular units loft elevation 2100mm missing');
console.log('✓ orbix-3d.js elevation defaults verified');

// 4. Verify orbix-core.js
const coreSrc = fs.readFileSync(path.join(__dirname, '../orbix-core.js'), 'utf8');
assert(coreSrc.includes('defElev = isLoft ? 2100 : (isWallUnit ? 1500 : 0)'), 'Core placement loft elevation 2100mm missing');
console.log('✓ orbix-core.js loft default elevation 2100mm verified');

console.log('ALL ELEVATION & 3D CAMERA TESTS PASSED 100%!');

