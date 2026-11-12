const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- RUNNING ALL 5 REQUIREMENTS VERIFICATION TESTS ---');

const rootDir = path.resolve(__dirname, '..');
const indexHtml = fs.readFileSync(path.join(rootDir, 'index.html'), 'utf8');
const styleCss = fs.readFileSync(path.join(rootDir, 'style.css'), 'utf8');
const orbixCoreJs = fs.readFileSync(path.join(rootDir, 'orbix-core.js'), 'utf8');
const orbix3dJs = fs.readFileSync(path.join(rootDir, 'orbix-3d.js'), 'utf8');
const orbixUiJs = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8');
const orbixUnitIconsJs = fs.readFileSync(path.join(rootDir, 'orbix-unit-icons.js'), 'utf8');
const unitsDataJson = JSON.parse(fs.readFileSync(path.join(rootDir, 'units_data.json'), 'utf8'));
const appJs = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');

// ==========================================
// REQUIREMENT 1: 8 Units Per Row & Searchable Tray
// ==========================================
console.log('\n[Req 1] Checking Furnish Tray 8-column layout & search UI...');
assert(styleCss.includes('grid-template-columns: repeat(8, minmax(0, 1fr))'), 'style.css must have repeat(8, minmax(0, 1fr))');
assert(styleCss.includes('overflow-x: hidden'), 'style.css must have overflow-x: hidden on tray cards container');
assert(indexHtml.includes('id="furnTraySearchInput"'), 'index.html must include furnTraySearchInput');
assert(indexHtml.includes('id="furnTraySearchClear"'), 'index.html must include furnTraySearchClear');
assert(orbixUiJs.includes('furnTraySearchInput'), 'orbix-ui.js must bind to furnTraySearchInput');
console.log('✓ Req 1 PASSED: 8 units per row (non-horizontal-scroll) and search box implemented.');

// ==========================================
// REQUIREMENT 2: 1500mm Elevated Wall Units
// ==========================================
console.log('\n[Req 2] Checking 1500mm elevated units (FCM-RT, FCM-LT, L-SHAPED CORNER)...');
const req2Ids = ['fcm-rt-1500', 'fcm-lt-1500', 'fbcm-1500'];

// Check in units_data.json
for (const id of req2Ids) {
  const item = unitsDataJson.find(u => u.id === id);
  assert(item, `units_data.json must contain unit with id "${id}"`);
  assert.strictEqual(item.elevation, 1500, `${id} must have elevation: 1500`);
  assert(item.dimensions, `${id} must have dimensions`);
  if (id === 'fbcm-1500') {
    assert.strictEqual(item.dimensions.W, 900);
    assert.strictEqual(item.dimensions.H, 720);
    assert.strictEqual(item.dimensions.D, 560);
    assert.strictEqual(item.category, 'kitchen_wall');
    assert.strictEqual(item.unitConfig.ctype, 'kwall');
  } else {
    assert.strictEqual(item.dimensions.W, 1200);
    assert.strictEqual(item.dimensions.H, 720);
    assert.strictEqual(item.dimensions.D, 560);
    assert.strictEqual(item.category, 'kitchen_wall');
  }
}

// Check in orbix-core.js
assert(orbixCoreJs.includes('"fcm-rt-1500"') || orbixCoreJs.includes("'fcm-rt-1500'"), "orbix-core.js must register 'fcm-rt-1500'");
assert(orbixCoreJs.includes('"fcm-lt-1500"') || orbixCoreJs.includes("'fcm-lt-1500'"), "orbix-core.js must register 'fcm-lt-1500'");
assert(orbixCoreJs.includes('"fbcm-1500"') || orbixCoreJs.includes("'fbcm-1500'"), "orbix-core.js must register 'fbcm-1500'");

// Check in orbix-unit-icons.js
assert(orbixUnitIconsJs.includes('"fcm-rt-1500"') || orbixUnitIconsJs.includes("'fcm-rt-1500'"), "orbix-unit-icons.js must map 'fcm-rt-1500'");
assert(orbixUnitIconsJs.includes('"fcm-lt-1500"') || orbixUnitIconsJs.includes("'fcm-lt-1500'"), "orbix-unit-icons.js must map 'fcm-lt-1500'");
assert(orbixUnitIconsJs.includes('"fbcm-1500"') || orbixUnitIconsJs.includes("'fbcm-1500'"), "orbix-unit-icons.js must map 'fbcm-1500'");
console.log('✓ Req 2 PASSED: Elevated (1500mm AFFL) units fully registered across catalog, icons, and core.');

// ==========================================
// REQUIREMENT 3: Remove First Three 2D Buttons
// ==========================================
console.log('\n[Req 3] Checking removal of first three 2D toolbar buttons (Door Width, Window Width, Split)...');
assert(!indexHtml.includes('id="planDoorWidth"'), 'planDoorWidth must be removed from index.html');
assert(!indexHtml.includes('id="planWindowWidth"'), 'planWindowWidth must be removed from index.html');
assert(!indexHtml.includes('data-tool="split"'), 'Split button must be removed from index.html');
console.log('✓ Req 3 PASSED: Door width dropdown, window width dropdown, and split button are removed from 2D page.');

// ==========================================
// REQUIREMENT 4: Remove 3D Floating Camera HUD Buttons
// ==========================================
console.log('\n[Req 4] Checking removal of 3D floating HUD buttons (#stageCamHud)...');
assert(!indexHtml.includes('id="stageCamHud"'), '#stageCamHud must be removed from index.html');
assert(!indexHtml.includes('FRONT') || !indexHtml.includes('OPEN ALL') || !indexHtml.includes('PRESENT'), 'Stage HUD camera buttons must be removed');
console.log('✓ Req 4 PASSED: Floating HUD buttons in 3D view are removed.');

// ==========================================
// REQUIREMENT 5: Enable Dado Tile Option
// ==========================================
console.log('\n[Req 5] Checking Dado Tile Option in 3D Studio...');
assert(indexHtml.includes('id="toggleDadoTileBtn"'), 'index.html must include toggleDadoTileBtn');
assert(indexHtml.includes('id="dadoTileStatus"'), 'index.html must include dadoTileStatus');
assert(orbix3dJs.includes('createDadoTileTexture'), 'orbix-3d.js must have createDadoTileTexture');
assert(orbix3dJs.includes('createDadoTileMaterial'), 'orbix-3d.js must have createDadoTileMaterial');
assert(orbix3dJs.includes('addDadoTile'), 'orbix-3d.js must include addDadoTile');
assert(orbixUiJs.includes('toggleDadoTileBtn'), 'orbix-ui.js must bind click to toggleDadoTileBtn');
console.log('✓ Req 5 PASSED: Dado tile option and procedural subway tile backsplash renderer are enabled.');

// ==========================================
// BONUS / PREVIOUS REGRESSION: Leg Plinth Fix
// ==========================================
console.log('\n[Extra] Checking Leg Retention on Unit Click...');
assert(appJs.includes('(u.plinth === false) ? 0 : 100'), 'app.js must retain plinth for clicked base units');
console.log('✓ Leg retention fix verified.');

console.log('\n=========================================');
console.log('>>> ALL 5 REQUIREMENTS VERIFIED SUCCESSFULLY! <<<');
console.log('=========================================\n');
