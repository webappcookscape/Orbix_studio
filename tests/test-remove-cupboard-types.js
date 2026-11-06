const assert = require('assert');
const fs = require('fs');

console.log('=== TEST SUITE: Removal of Legacy Cupboard Type Buttons ===\n');

// 1. Verify app.js source code does not contain the "Cupboard type" inspector group
console.log('[TEST 1] Verifying app.js source code...');
const appJsContent = fs.readFileSync('app.js', 'utf8');

// Ensure the group header 'Cupboard type' is removed from renderControls
assert(!appJsContent.includes('grp(r, "Cupboard type")'), 'grp(r, "Cupboard type") must be removed from app.js');
assert(!appJsContent.includes("grp(r, 'Cupboard type')"), "grp(r, 'Cupboard type') must be removed from app.js");

// Verify that the CTYPES button loop inside renderRail controls is removed
const renderRailIdx = appJsContent.indexOf('function renderRail()');
const renderRailEnd = appJsContent.indexOf('function elevDraw(', renderRailIdx);
const renderRailBody = appJsContent.substring(renderRailIdx, renderRailEnd);

assert(!renderRailBody.includes('Cupboard type'), 'Cupboard type must not appear in renderRail');
assert(!renderRailBody.includes('CTYPES.forEach'), 'CTYPES button iteration inside renderRail must be removed');
console.log('✓ TEST 1 PASSED: "Cupboard type" group and buttons completely removed from app.js renderRail.\n');

// 2. Verify single-file bundles (dist-single.html and cupboard-cad.html)
console.log('[TEST 2] Verifying compiled bundles dist-single.html and cupboard-cad.html...');
const distContent = fs.readFileSync('dist-single.html', 'utf8');
const cadContent = fs.readFileSync('cupboard-cad.html', 'utf8');

assert(!distContent.includes('grp(r, "Cupboard type")'), 'dist-single.html must not contain grp(r, "Cupboard type")');
assert(!cadContent.includes('grp(r, "Cupboard type")'), 'cupboard-cad.html must not contain grp(r, "Cupboard type")');
console.log('✓ TEST 2 PASSED: Bundles are clean and do not render "Cupboard type" buttons.\n');

// 3. Verify that the 12 specific removed button labels are not in renderControls:
console.log('[TEST 3] Verifying specific 12 labels are absent from renderControls...');
const removedLabels = [
  "Wardrobe · hinged",
  "Wardrobe · sliding",
  "Overhead / loft",
  "Kitchen base run",
  "Kitchen wall run",
  "Tall / pantry",
  "TV unit",
  "Crockery · glass",
  "Shoe rack",
  "Dresser · mirror",
  "Open shelving",
  "Modular kitchen"
];

removedLabels.forEach(label => {
  assert(!renderRailBody.includes('"' + label + '"') && !renderRailBody.includes("'" + label + "'"), `renderRail must not render "${label}" button`);
});
console.log('✓ TEST 3 PASSED: None of the 12 removed cupboard types appear in renderRail.\n');

// 4. Verify sanitization of legacy u.ctype === "kitchen" in syncProjectUnitsTo3DStudio
console.log('[TEST 4] Verifying sanitization of legacy "kitchen" ctype in orbix-ui.js...');
const uiJsContent = fs.readFileSync('orbix-ui.js', 'utf8');
assert(uiJsContent.includes("if (existing.ctype === 'kitchen') existing.ctype = isWall ? 'kwall' : 'kbase';"), 'orbix-ui.js must sanitize existing.ctype === "kitchen"');
console.log('✓ TEST 4 PASSED: Legacy "kitchen" ctype is automatically sanitized to modular "kwall" or "kbase".\n');

console.log('======================================================================');
console.log('ALL TESTS PASSED: Legacy "Cupboard type" buttons successfully removed!');
console.log('======================================================================');
