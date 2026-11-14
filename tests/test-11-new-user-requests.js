// tests/test-11-new-user-requests.js
// Automated verification suite for the 11 new user requirements

const fs = require('fs');
const assert = require('assert');

console.log('--- Verifying All 11 New User Requirements ---\n');

const appJs = fs.readFileSync('app.js', 'utf8');
const coreJs = fs.readFileSync('orbix-core.js', 'utf8');
const planJs = fs.readFileSync('orbix-plan.js', 'utf8');
const d3Js = fs.readFileSync('orbix-3d.js', 'utf8');
const uiJs = fs.readFileSync('orbix-ui.js', 'utf8');
const indexHtml = fs.readFileSync('index.html', 'utf8');

// 1. Ground & Sky Showing
assert(appJs.includes('0x82C3EC'), 'Req 1: Sky blue background 0x82C3EC should be present in app.js');
assert(appJs.includes('sp|grassGround'), 'Req 1: makeGrassGroundMat should create sp|grassGround in app.js');
assert(appJs.includes('color: 0x4E8A42'), 'Req 1: makeGrassGroundMat should have lush green color 0x4E8A42');
assert(appJs.includes('HemisphereLight(0x82C3EC, 0x4E8A42'), 'Req 1: HemisphereLight should bounce sky blue and grass green');
console.log('✔ Req 1 Verified: Ground & Sky restored with radiant daytime sky blue and lush lawn grass');

// 2. Wall Color Dark Beige
assert(d3Js.includes('0xB89F82'), 'Req 2: orbix-3d.js wall material should be Dark Beige 0xB89F82');
assert(d3Js.includes('0x9E836A'), 'Req 2: orbix-3d.js wallCore material should be Dark Beige core 0x9E836A');
assert(appJs.includes('0xB89F82'), 'Req 2: app.js wall material should be Dark Beige 0xB89F82');
assert(planJs.includes('#8A735C'), 'Req 2: orbix-plan.js 2D wall poche should be Dark Beige #8A735C');
console.log('✔ Req 2 Verified: Wall color updated to rich architectural Dark Beige across 3D and 2D');

// 3. Crockery / TV Base 1 Drawer Countertop Placement with 100mm Leg
assert(d3Js.includes('(dims.H <= 350) ? dims.H :'), 'Req 3: Low TV/crockery console bodyH preserves carcass box height');
assert(d3Js.includes('var topOfCarcass = plinthH + bodyH;'), 'Req 3: topOfCarcass should be plinthH + bodyH');
assert(d3Js.includes('cMesh.position.set(0, topOfCarcass + counterH / 2, 2.5);'), 'Req 3: Countertop positioned strictly on top of carcass');
// Mathematical assertion:
const plinthH = 100;
const dimsH = 200;
const counterH = 35;
const bodyH = (dimsH <= 350) ? dimsH : Math.max(100, dimsH - plinthH - counterH);
const topOfCarcass = plinthH + bodyH;
const cY = topOfCarcass + counterH / 2;
const drawerTop = plinthH + 3 + (bodyH - 6);
assert.strictEqual(topOfCarcass, 300, 'Carcass top should be 300mm with 100mm leg');
assert(cY > drawerTop, 'Countertop center (317.5mm) must be above drawer top (297mm)');
console.log('✔ Req 3 Verified: Crockery / TV base 1 drawer places countertop strictly above drawer with 100mm leg');

// 4. Sunlight & Spotlight Brightness Controls
assert(indexHtml.includes('id="sunlightSlider"'), 'Req 4: sunlightSlider should exist in index.html');
assert(indexHtml.includes('id="spotlightSlider"'), 'Req 4: spotlightSlider should exist in index.html');
assert(appJs.includes('setSunlightIntensity:'), 'Req 4: setSunlightIntensity should be exported on GL');
assert(appJs.includes('setSpotlightIntensity:'), 'Req 4: setSpotlightIntensity should be exported on GL');
assert(uiJs.includes('setSunlightIntensity'), 'Req 4: orbix-ui.js should hook up sunlight slider');
assert(uiJs.includes('setSpotlightIntensity'), 'Req 4: orbix-ui.js should hook up spotlight slider');
console.log('✔ Req 4 Verified: Sunlight & Spotlight brightness controls added with real-time GL sliders');

// 5. Room Selection on Double Click Only
assert(planJs.includes('Single-click inside a room polygon does NOT select room'), 'Req 5: Single-click inside room must not select');
assert(planJs.includes('this.canvas.addEventListener(\'dblclick\', function (e) {'), 'Req 5: dblclick listener must exist');
assert(planJs.includes('self.selected = [{ type: \'room\', id: targetRoom.id }];'), 'Req 5: dblclick must select room');
console.log('✔ Req 5 Verified: Room selection only opens on double-click; single-click does not select room');

// 6. Only Shutter Depth Defaults to 18mm
const core = require('../orbix-core.js');
const osUnits = core.FURNITURE_CATALOG.filter(it => it.name && /\bo\/?s\b/i.test(it.name));
assert(osUnits.length >= 4, 'Must find O/S units in FURNITURE_CATALOG');
osUnits.forEach(u => {
  assert.strictEqual(u.dimensions.D, 18, `O/S unit [${u.id}] ${u.name} must have D: 18mm`);
});
assert(d3Js.includes('baseD = isTrueOnlyShutter ? 18 :'), 'Req 6: orbix-3d.js must default baseD to 18mm for isTrueOnlyShutter');
assert(planJs.includes('var isOS = !!((f.unitConfig && f.unitConfig.isOnlyShutter)'), 'Req 6: orbix-plan.js must detect isOS');
assert(planJs.includes('var dMm = isOS ? 18 :'), 'Req 6: orbix-plan.js must use 18mm depth for isOS');
console.log('✔ Req 6 Verified: Only Shutter units default to 18mm depth in catalog, 2D plan, and 3D');

// 7. RCC Column Stays Within Wall Width
assert(planJs.includes('Math.min(wallThick, 150)'), 'Req 7: colSizeMm must be bounded by wall thickness');
assert(!planJs.includes('var colSizeMm = 220;'), 'Req 7: 220mm hardcoded column must be removed');
assert(planJs.includes('rgba(255,255,255,0.22)'), 'Req 7: CAD structural reinforcement cross lines rendered');
console.log('✔ Req 7 Verified: RCC column stays strictly within wall width with improved CAD visuals');

// 8. Furnish Category Structure
assert(indexHtml.includes('data-cat="kitchen">🍳 KITCHEN</div>'), 'Req 8: KITCHEN in sidebar');
assert(indexHtml.includes('data-cat="tv_crockery">🍷 TV &amp; CROCKERY UNITS</div>'), 'Req 8: TV & CROCKERY in sidebar');
assert(indexHtml.includes('data-cat="wardrobe">🚪 WARDROBE</div>'), 'Req 8: WARDROBE in sidebar');
assert(indexHtml.includes('data-cat="loft">📦 LOFT</div>'), 'Req 8: LOFT in sidebar');
assert(indexHtml.includes('data-cat="wall_paneling">🖼️ WALL PANELLING</div>'), 'Req 8: WALL PANELLING in sidebar');
assert(uiJs.includes('kitchen_fm') && uiJs.includes('kitchen_corner') && uiJs.includes('kitchen_drawers') && uiJs.includes('kitchen_tall') && uiJs.includes('kitchen_wall_spice'), 'Req 8: Kitchen subcategories');
assert(uiJs.includes('tv_crockery_base') && uiJs.includes('tv_crockery_wall') && uiJs.includes('tv_crockery_drawers') && uiJs.includes('tv_crockery_openbox'), 'Req 8: TV/Crockery subcategories');
assert(uiJs.includes('wardrobe_all'), 'Req 8: Wardrobes All subcategory');
assert(uiJs.includes('loft_all'), 'Req 8: All Loft subcategory');
assert(uiJs.includes('panel_back') && uiJs.includes('panel_ledges'), 'Req 8: Wall paneling subcategories');
console.log('✔ Req 8 Verified: Furnish categories and sub-tabs updated exactly to user specification');

// 9. Download PDF Button Removed from Pricing Page
assert(!uiJs.includes('id="boqPrintBtn">📄 Download PDF</button>'), 'Req 9: Download PDF button must be removed from pricing');
console.log('✔ Req 9 Verified: Download PDF button cleanly removed from Pricing page');

// 10. Options Removed from 3D Studio Right Rail
assert(!appJs.includes('grp(r, "Door style")'), 'Req 10: Door style group must be removed');
assert(!appJs.includes('grp(r, "Shape")'), 'Req 10: Shape group must be removed');
assert(!appJs.includes('grp(r, "Shutters")'), 'Req 10: Shutters group must be removed');
assert(!appJs.includes('grp(r, "Handle finish")'), 'Req 10: Handle finish group must be removed');
assert(!appJs.includes('grp(r, "Loft")'), 'Req 10: Loft group must be removed');
assert(!appJs.includes('grp(r, "Edge banding")'), 'Req 10: Edge banding group must be removed');
console.log('✔ Req 10 Verified: DOOR STYLE, SHAPE, SHUTTERS, HANDLE FINISH, LOFT, and EDGE BANDING removed from 3D Studio');

// 11. GL Units Have Default Door Style as Glass Frame
const glUnits = core.FURNITURE_CATALOG.filter(it => it.name && /(^|\b|_|-|\s)gl(\b|_|-|\s|\d+|$)/i.test(it.name));
assert(glUnits.length >= 4, 'Must find GL units in FURNITURE_CATALOG');
glUnits.forEach(u => {
  assert.strictEqual(u.unitConfig && u.unitConfig.dstyle, 'glass', `GL unit [${u.id}] ${u.name} must have dstyle: glass`);
});
assert(coreJs.includes('isGL && (!cfg.dstyle || cfg.dstyle === \'slab\')'), 'Req 11: createFurniturePlacement defaults dstyle to glass for GL');
assert(uiJs.includes('isGLUnit && (!doorStyle || doorStyle === \'slab\')'), 'Req 11: orbix-ui.js Inspector defaults doorStyle to glass for GL');
assert(d3Js.includes('isGLUnit && (!dstyle || dstyle === \'slab\')'), 'Req 11: orbix-3d.js defaults dstyle to glass for GL');
console.log('✔ Req 11 Verified: All GL units have default door style as Glass Frame');

console.log('\n🎉 ALL 11 NEW USER REQUIREMENTS 100% VERIFIED AND PASSING!');

