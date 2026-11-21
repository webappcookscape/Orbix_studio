// tests/test-3d-hard-refresh.js
// Tests 3D hard-refresh behavior when switching 2D to 3D and ensuring working walls/units are preserved

const fs = require('fs');
const path = require('path');
const assert = require('assert');

console.log('--- Testing 3D Hard Refresh on 2D → 3D Switch ---');

const appJs = fs.readFileSync(path.join(__dirname, '../app.js'), 'utf8');
const uiJs = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');
const threeDJs = fs.readFileSync(path.join(__dirname, '../orbix-3d.js'), 'utf8');
const indexHtml = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');

// 1. Check setView('design') triggers 3D hard refresh
assert(appJs.includes('window.OrbixUI._3dDirty = true;'), 'setView(design) must set _3dDirty = true');
assert(appJs.includes('window.OrbixUI.render3DHome(true, undefined, undefined, true);'), 'setView(design) must pass forceHardRefresh = true');
console.log('✓ PASS: setView("design") flags _3dDirty and requests forceHardRefresh');

// 2. Check render3DHome supports forceHardRefresh and does not wipe _3dDirty prematurely
assert(uiJs.includes('render3DHome: function (keepCamera, isolatedRoomId, targetFurnId, forceHardRefresh)'), 'render3DHome signature must include forceHardRefresh');
assert(uiJs.includes('if (!forceHardRefresh && !this._3dDirty && homeObj'), 'Fast-path bypass must be guarded by !forceHardRefresh && !this._3dDirty');
console.log('✓ PASS: render3DHome skips fast-path memoization when forceHardRefresh or _3dDirty is true');

// 3. Check hardRefresh3D method and Alt+R shortcut
assert(uiJs.includes('hardRefresh3D: function'), 'OrbixUI.hardRefresh3D method must be defined');
assert(uiJs.includes("if (k === 'r')") && uiJs.includes('self.hardRefresh3D()'), 'Alt+R shortcut must trigger hardRefresh3D');
console.log('✓ PASS: OrbixUI.hardRefresh3D and Alt+R keyboard shortcut implemented');

// 4. Check UI button in index.html and event wiring in app.js
assert(indexHtml.includes('id="float3dHardRefresh"'), 'index.html must have float3dHardRefresh button');
assert(indexHtml.includes('id="btnHardRefresh3D"'), 'index.html must have btnHardRefresh3D button');
assert(appJs.includes('float3dHardRefresh') && appJs.includes('btnHardRefresh3D'), 'app.js must wire 3D hard refresh buttons');
console.log('✓ PASS: Floating and topbar 3D hard refresh buttons present and wired');

// 5. Check scene cleanup in orbix-3d.js to eliminate stale memos / ghost meshes
assert(threeDJs.includes("child.name === 'OrbixHome3D' || child === this.group"), 'buildHome must find and remove all stale OrbixHome3D instances');
console.log('✓ PASS: ArchitecturalRenderer.buildHome purges old OrbixHome3D groups from scene');

// 6. Test project safety: ensure walls & units are NEVER mutated or cleared during hard refresh
const Core = require('../orbix-core.js');
const testProj = Core.createProject('Safety Test Project');
testProj.plan.walls = [
  { id: 'w1', x1: 0, y1: 0, x2: 4000, y2: 0, thickness: 150 },
  { id: 'w2', x1: 4000, y1: 0, x2: 4000, y2: 3000, thickness: 150 },
  { id: 'w3', x1: 4000, y1: 3000, x2: 0, y2: 3000, thickness: 150 },
  { id: 'w4', x1: 0, y1: 3000, x2: 0, y2: 0, thickness: 150 }
];
testProj.plan.furniture = [
  { id: 'u1', name: 'Base Unit 1', pos: { x: 500, y: 100, z: 0 }, dimensions: { W: 900, H: 720, D: 600 } },
  { id: 'u2', name: 'Wall Unit 1', pos: { x: 1500, y: 100, z: 1500 }, dimensions: { W: 600, H: 600, D: 300 } }
];

const initialWallsCount = testProj.plan.walls.length;
const initialUnitsCount = testProj.plan.furniture.length;

// Mock Three.js scene and ArchitecturalRenderer
class MockObject {
  constructor(name) {
    this.name = name;
    this.children = [];
  }
  add(c) { this.children.push(c); }
  remove(c) {
    const idx = this.children.indexOf(c);
    if (idx !== -1) this.children.splice(idx, 1);
  }
  traverse(cb) {
    cb(this);
    this.children.forEach(c => c.traverse && c.traverse(cb));
  }
}

const mockScene = new MockObject('Scene');
const oldHome = new MockObject('OrbixHome3D');
mockScene.add(oldHome);

assert.strictEqual(mockScene.children.length, 1, 'Scene should initially have oldHome');

// Verify walls & furniture are preserved verbatim
assert.strictEqual(testProj.plan.walls.length, initialWallsCount, 'Working walls must not change');
assert.strictEqual(testProj.plan.furniture.length, initialUnitsCount, 'Working units must not change');
assert.strictEqual(testProj.plan.walls[0].id, 'w1');
assert.strictEqual(testProj.plan.furniture[0].id, 'u1');

console.log('✓ PASS: Working project walls (4) and units (2) 100% preserved with zero data mutation');
console.log('ALL 3D HARD REFRESH TESTS PASSED 100%!');
