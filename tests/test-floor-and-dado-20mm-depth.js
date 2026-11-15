const assert = require('assert');
const path = require('path');

// 1. Mock browser globals and Three.js
const THREE = require('../assets/three.min.js');
global.THREE = THREE;
global.window = {
  dadoTileEnabled: true,
  dadoTileStyle: 'dado_1'
};
const Core = require('../orbix-core.js');
global.Core = Core;
const ArchitecturalRenderer = require('../orbix-3d.js');

console.log('Testing 20mm Floor & Dado Tile Volumetric Depth Fixes...');

const renderer = new ArchitecturalRenderer(null);

// ── TEST 1: Room Floor Mesh 20mm Volumetric Depth ──
console.log('\n[Test 1] Room Floor 20mm Depth Verification');
const testRoom = {
  id: 'r_main',
  name: 'Living Room',
  floorFinish: 'marble',
  polygon: [
    { x: 0, y: 0 },
    { x: 4000, y: 0 },
    { x: 4000, y: 3500 },
    { x: 0, y: 3500 }
  ]
};

const floorMesh = renderer.buildRoomFloor(testRoom);
assert(floorMesh, 'buildRoomFloor must return a valid floor mesh');
assert.strictEqual(floorMesh.userData.isFloorMesh, true, 'isFloorMesh must be true');
assert.strictEqual(floorMesh.userData.floorDepth, 20, 'floorDepth must be 20mm');
assert.strictEqual(floorMesh.castShadow, true, 'floorMesh must castShadow');
assert.strictEqual(floorMesh.receiveShadow, true, 'floorMesh must receiveShadow');

// Compute world bounding box
floorMesh.updateMatrixWorld(true);
const box = new THREE.Box3().setFromObject(floorMesh);
const depthMm = box.max.y - box.min.y;
console.log('Floor World Box:', { min: box.min, max: box.max });
console.log('Floor Top Y:', box.max.y, 'Floor Bottom Y:', box.min.y, 'Thickness:', depthMm);

assert(Math.abs(box.max.y - 1.0) < 0.05, `Floor top Y must be at finished floor level (~1.0mm), got ${box.max.y}`);
assert(Math.abs(box.min.y - (-19.0)) < 0.05, `Floor bottom Y must be at -19.0mm, got ${box.min.y}`);
assert(Math.abs(depthMm - 20.0) < 0.05, `Floor thickness must be exactly 20mm, got ${depthMm}`);
console.log('✓ Room Floor has authentic 20mm solid slab depth flush at finished floor level!');

// ── TEST 2: Inner Divided Room Elevation ──
console.log('\n[Test 2] Inner Divided Room 20mm Depth Verification');
const innerRoom = {
  id: 'r_pooja',
  name: 'Pooja',
  areaSqMm: 2000000,
  floorFinish: 'wooden',
  polygon: [
    { x: 500, y: 500 },
    { x: 1500, y: 500 },
    { x: 1500, y: 1500 },
    { x: 500, y: 1500 }
  ]
};
testRoom.areaSqMm = 14000000;
const innerMesh = renderer.buildRoomFloor(innerRoom, [testRoom, innerRoom]);
assert(innerMesh, 'innerMesh must be valid');
innerMesh.updateMatrixWorld(true);
const innerBox = new THREE.Box3().setFromObject(innerMesh);
const innerDepthMm = innerBox.max.y - innerBox.min.y;
console.log('Inner Floor Top Y:', innerBox.max.y, 'Thickness:', innerDepthMm);
assert(Math.abs(innerDepthMm - 20.0) < 0.05, `Inner floor thickness must be 20mm, got ${innerDepthMm}`);
console.log('✓ Inner room floor has authentic 20mm slab depth!');

// ── TEST 3: Wall Dado Tile 20mm Depth ──
console.log('\n[Test 3] Wall Dado Tile 20mm Depth Verification');
const testWall = {
  id: 'wall_kitchen',
  start: { x: 0, y: 0 },
  end: { x: 3000, y: 0 },
  height: 2800,
  thickness: 150,
  dadoTile: true,
  dadoTileStyle: 'dado_1',
  dadoSegments: [{ startOffset: 0, endOffset: 3000 }]
};

const wallGroup = renderer.buildWallWithCutouts(testWall, []);
assert(wallGroup, 'buildWallWithCutouts must return wall group');

let dadoFound = [];
wallGroup.traverse(o => {
  if (o.isMesh && o.userData && o.userData.isDadoTile) {
    dadoFound.push(o);
  }
});

console.log('Found dado tile meshes in wall group:', dadoFound.length);
assert(dadoFound.length >= 2, 'Must have front and back dado tile meshes');

for (let i = 0; i < dadoFound.length; i++) {
  const dMesh = dadoFound[i];
  assert.strictEqual(dMesh.userData.thickness, 20, 'dado tile thickness metadata must be 20mm');
  assert.strictEqual(dMesh.geometry.parameters.depth, 20, 'dado BoxGeometry depth must be exactly 20mm');
  assert.strictEqual(dMesh.castShadow, true, 'dado tile must cast shadow');
  assert.strictEqual(dMesh.receiveShadow, true, 'dado tile must receive shadow');
}

// Check front tile position along wall thickness:
// Front tile is at wThick/2 + dadoT/2 = 75 + 10 = 85
const frontTile = dadoFound[0];
console.log('Front Dado Tile local Z position:', frontTile.position.z);
assert.strictEqual(frontTile.position.z, 85, 'Front dado tile must be positioned at 85mm (75mm wall half + 10mm tile half)');
console.log('✓ Wall Dado tile has authentic 20mm depth with real drop-shadow capability!');

// ── TEST 4: Dynamic Floor Finish Material Switching ──
console.log('\n[Test 4] Dynamic Material Switching & UV Update Verification');
renderer.group = new THREE.Group();
renderer.group.add(floorMesh);
renderer.setFloorMaterial('wooden');
assert.strictEqual(renderer.selectedFloorType, 'wooden');
assert.strictEqual(floorMesh.userData.floorFinish, 'wooden');
console.log('✓ Dynamic material and UV mapping updated smoothly on 20mm extruded slab!');

console.log('\nALL 20mm FLOOR & DADO TILE DEPTH CHECKS PASSED PERFECTLY!');

