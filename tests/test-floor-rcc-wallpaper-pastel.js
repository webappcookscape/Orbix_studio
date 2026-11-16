const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser environment
global.window = global;
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') {
      return {
        width: 512,
        height: 512,
        getContext: () => ({
          fillRect: () => {},
          beginPath: () => {},
          arc: () => {},
          fill: () => {},
          stroke: () => {},
          strokeRect: () => {},
          moveTo: () => {},
          lineTo: () => {},
          closePath: () => {},
          fillText: () => {},
          createRadialGradient: () => ({ addColorStop: () => {} })
        })
      };
    }
    return { getContext: () => ({}), style: {}, appendChild: () => {}, classList: { add: () => {}, remove: () => {} } };
  },
  getElementById: () => null,
  querySelectorAll: () => []
};

const rootDir = path.resolve(__dirname, '..');
const Core = require(path.join(rootDir, 'orbix-core.js'));

console.log('=== RUNNING TESTS: FLOOR GLITCH, PASTEL GROUND, RCC WALL SPLIT, WALLPAPER & COLOR ===\n');

// 1. Test Outer Floor Pastel & Logarithmic Depth Buffer
console.log('1. Testing Outer Floor Pastel Ground & Anti-Glitch Depth Buffer in app.js & orbix-3d.js...');
const appSrc = fs.readFileSync(path.join(rootDir, 'app.js'), 'utf8');
const threeDSrc = fs.readFileSync(path.join(rootDir, 'orbix-3d.js'), 'utf8');

assert(appSrc.includes('logarithmicDepthBuffer: true'), 'app.js must enable logarithmicDepthBuffer to prevent z-fighting');
assert(appSrc.includes('0x4E8A42'), 'app.js makeGrassGroundMat must use pastel 0x4E8A42');
assert(appSrc.includes('floor.position.y = -105'), 'app.js outer ground must be placed at y = -105 (below 100mm slab)');
assert(threeDSrc.includes('0x4E8A42'), 'orbix-3d.js must use pastel 0x4E8A42 for ground/grass material');
console.log('  ✓ Logarithmic depth buffer, pastel 0x4E8A42 ground, and y = -105 slab separation verified');

// 2. Test Wall Color & Wallpaper in 3D & 2D
console.log('\n2. Testing Wall Color & Wallpaper rendering in 3D (orbix-3d.js) & 2D (orbix-plan.js)...');
const planSrc = fs.readFileSync(path.join(rootDir, 'orbix-plan.js'), 'utf8');
const uiSrc = fs.readFileSync(path.join(rootDir, 'orbix-ui.js'), 'utf8');

assert(threeDSrc.includes('var wallMat = this.createWallFinishMaterial'), 'orbix-3d.js buildWallWithCutouts must use wallMat');
assert(threeDSrc.includes('new THREE.Mesh(geo, wallMat)'), 'Solid wall mesh must use wallMat');
assert(threeDSrc.includes('new THREE.Mesh(segGeo, wallMat)'), 'Opening segment meshes must use wallMat');
assert(threeDSrc.includes('floral_blush') && threeDSrc.includes('geometric_teal'), 'createWallFinishMaterial must support floral_blush and geometric_teal wallpapers');

assert(planSrc.includes('w.paintColor || \'#8A735C\''), 'orbix-plan.js must render custom wall paint color in 2D blueprint');
assert(planSrc.includes('w.wallpaper && w.wallpaper !== \'none\''), 'orbix-plan.js must render wallpaper in 2D blueprint');

assert(uiSrc.includes('inspWallColor'), 'orbix-ui.js inspector must include Wall Color picker');
assert(uiSrc.includes('inspWallpaper'), 'orbix-ui.js inspector must include Wallpaper select');
assert(uiSrc.includes('inspWallFinishType'), 'orbix-ui.js inspector must include Wall Finish Type select');
console.log('  ✓ Wall color & wallpaper correctly integrated across 3D meshes, 2D blueprint, and Inspector UI');

// 3. Test Straight Wall Split on RCC Column Joint
console.log('\n3. Testing Straight Wall Split at RCC Column Joint in orbix-core.js...');
const proj = Core.createProject('RCC Test');
// Create a 6000mm straight wall from (0, 0) to (6000, 0)
const wall = Core.createWall({
  start: { x: 0, y: 0 },
  end: { x: 6000, y: 0 },
  thickness: 150,
  height: 2800
});
wall.paintColor = '#457B9D';
wall.wallpaper = 'geometric_teal';
proj.plan.walls.push(wall);

// Place an RCC column at (3000, 0)
proj.plan.furniture.push({
  id: 'rcc_col_1',
  name: 'RCC Column Joint 150x150',
  category: 'structural',
  pos: { x: 3000, y: 0 },
  dimensions: { W: 150, H: 2800, D: 150 }
});

assert.strictEqual(proj.plan.walls.length, 1, 'Initial wall count must be 1');

// Run autoSplitWallAtJunctions
const didSplit = Core.autoSplitWallAtJunctions(proj);
assert(didSplit, 'autoSplitWallAtJunctions must split straight wall at RCC column joint');
assert.strictEqual(proj.plan.walls.length, 2, 'Wall must be split into exactly 2 separate walls');

const w1 = proj.plan.walls[0];
const w2 = proj.plan.walls[1];

assert.strictEqual(w1.start.x, 0);
assert.strictEqual(w1.end.x, 3000);
assert.strictEqual(w2.start.x, 3000);
assert.strictEqual(w2.end.x, 6000);
assert.strictEqual(w1.paintColor, '#457B9D', 'Wall 1 must inherit paint color');
assert.strictEqual(w2.paintColor, '#457B9D', 'Wall 2 must inherit paint color');
assert.strictEqual(w1.wallpaper, 'geometric_teal', 'Wall 1 must inherit wallpaper');
assert.strictEqual(w2.wallpaper, 'geometric_teal', 'Wall 2 must inherit wallpaper');

console.log('  ✓ Straight wall automatically split at RCC column into 2 separate walls: (0->3000) and (3000->6000)');

// 4. Test Wall Inspector "➕ RCC Joint at Midpoint" button
assert(uiSrc.includes('inspWallSplitMid'), 'orbix-ui.js must include inspWallSplitMid button in Inspector');
console.log('  ✓ Wall Inspector has ➕ RCC Joint / Split Wall button');

console.log('\n======================================================');
console.log('ALL TESTS PASSED! FLOOR, PASTEL GROUND, RCC & WALLS VERIFIED! ✓');
console.log('======================================================\n');

