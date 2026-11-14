// Test suite: 8K Render Auto-Placement and Custom View Options
const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Verifying 8K Render Options (Auto-Placement & Custom View) ---');

// 1. Verify HTML Structure
const htmlCode = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
assert.ok(htmlCode.includes('id="photoRenderContainer"'), 'Must have photoRenderContainer');
assert.ok(htmlCode.includes('id="photoRenderBtn"'), 'Must have photoRenderBtn');
assert.ok(htmlCode.includes('📸 8K Render'), 'Must show 8K Render label');
assert.ok(htmlCode.includes('id="renderAutoPlacementBtn"'), 'Must have renderAutoPlacementBtn');
assert.ok(htmlCode.includes('🎯 Auto-Placement Render'), 'Must have Auto-Placement Render text');
assert.ok(htmlCode.includes('id="renderCustomViewBtn"'), 'Must have renderCustomViewBtn');
assert.ok(htmlCode.includes('📐 Custom View Render'), 'Must have Custom View Render text');
console.log('✔ HTML elements for both Render options verified');

// 2. Verify UI Logic in orbix-ui.js
const uiCode = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
assert.ok(uiCode.includes("renderAutoPlacementBtn.addEventListener('click'"), 'Must handle renderAutoPlacementBtn click');
assert.ok(uiCode.includes("renderCustomViewBtn.addEventListener('click'"), 'Must handle renderCustomViewBtn click');
assert.ok(uiCode.includes("self.capturePhotorealisticRender({ mode: 'auto' })"), 'Auto button must pass mode: auto');
assert.ok(uiCode.includes("self.capturePhotorealisticRender({ mode: 'custom' })"), 'Custom button must pass mode: custom');
assert.ok(uiCode.includes("auto-placement"), 'Download filename must include auto-placement for auto mode');
assert.ok(uiCode.includes("custom-view"), 'Download filename must include custom-view for custom mode');
console.log('✔ UI dropdown handlers & mode passing verified');

// 3. Verify 3D Snapshot Engine in app.js
const appCode = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
assert.ok(appCode.includes("var isAuto = (opts.mode === 'auto' || opts.mode === 'focused')"), 'app.js must detect isAuto');
assert.ok(appCode.includes("renderer.render(scene, camera)"), 'Must render directly via WebGLRenderer to prevent 650MB composer memory overflow');
assert.ok(appCode.includes("url = cv.toDataURL('image/jpeg', 0.98)"), 'Must have fallback to high-quality JPEG if PNG is restricted by canvas size limit');
assert.ok(appCode.includes("scene.background = origBg"), 'Must restore original scene.background in finally');
assert.ok(appCode.includes("keyL.shadow.radius = origKeyRadius"), 'Must restore shadow radius in finally');
console.log('✔ 3D snapshot direct render & safe canvas fallback verified');

console.log('\n🎉 ALL 8K RENDER OPTION VERIFICATION CHECKS PASSED!');
