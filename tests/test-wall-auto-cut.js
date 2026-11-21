// Test Wall Auto-Cutaway and Scene Graph Traversal in 3D
const assert = require('assert');

// 1. Scene graph simulation
function createMockGroup(name, userData) {
  return {
    name: name || '',
    userData: userData || {},
    children: [],
    visible: true,
    position: { x: 0, y: 0, z: 0 },
    add: function(child) { this.children.push(child); }
  };
}

function getHomeWallsAndFurniture(homeObj) {
  var wallMeshes = [];
  var furnMeshes = [];
  if (!homeObj) return { walls: wallMeshes, furniture: furnMeshes };

  function collect(obj) {
    if (!obj || !obj.children) return;
    for (var i = 0; i < obj.children.length; i++) {
      var child = obj.children[i];
      if (!child) continue;
      var ud = child.userData || {};
      if (ud.isWall && (ud.start || ud.wall || ud.wallId)) {
        wallMeshes.push(child);
      } else if (ud.isFurniture || ud.isFurnitureGroup || (child.name && child.name.indexOf('Furniture_') === 0)) {
        furnMeshes.push(child);
      } else {
        collect(child);
      }
    }
  }

  collect(homeObj);
  return { walls: wallMeshes, furniture: furnMeshes };
}

function testRayWallIntersection(p1, p2, p3, p4) {
  var x1 = p1.x, y1 = p1.y, x2 = p2.x, y2 = p2.y;
  var x3 = p3.x, y3 = p3.y, x4 = p4.x, y4 = p4.y;
  var denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);
  if (Math.abs(denom) < 1e-6) return null;
  var ua = ((x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3)) / denom;
  var ub = ((x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3)) / denom;
  if (ua >= 0 && ua <= 1 && ub >= 0 && ub <= 1) {
    return {
      t: ua,
      pt: { x: x1 + ua * (x2 - x1), y: y1 + ua * (y2 - y1) }
    };
  }
  return null;
}

// Build 4000x3000 mm room scene graph
const homeObj = createMockGroup('OrbixHome3D');
const floorGroup = createMockGroup('OrbixFloor_ground', { floorId: 'ground' });
homeObj.add(floorGroup);

// Wall 1: Bottom wall (0, 0) -> (4000, 0)
const wall1 = createMockGroup('Wall_w1', {
  isWall: true,
  wallId: 'w1',
  wallNumber: 1,
  start: { x: 0, y: 0 },
  end: { x: 4000, y: 0 },
  mid: { x: 2000, y: 0 }
});
// Add submeshes inside wall to verify scanner doesn't count them
wall1.add(createMockGroup('Mesh_box', { isWallSubMesh: true }));
wall1.add(createMockGroup('Mesh_skirting', { isSkirting: true }));
floorGroup.add(wall1);

// Wall 2: Right wall (4000, 0) -> (4000, 3000)
const wall2 = createMockGroup('Wall_w2', {
  isWall: true,
  wallId: 'w2',
  wallNumber: 2,
  start: { x: 4000, y: 0 },
  end: { x: 4000, y: 3000 },
  mid: { x: 4000, y: 1500 }
});
floorGroup.add(wall2);

// Wall 3: Top wall (4000, 3000) -> (0, 3000)
const wall3 = createMockGroup('Wall_w3', {
  isWall: true,
  wallId: 'w3',
  wallNumber: 3,
  start: { x: 4000, y: 3000 },
  end: { x: 0, y: 3000 },
  mid: { x: 2000, y: 3000 }
});
floorGroup.add(wall3);

// Wall 4: Left wall (0, 3000) -> (0, 0)
const wall4 = createMockGroup('Wall_w4', {
  isWall: true,
  wallId: 'w4',
  wallNumber: 4,
  start: { x: 0, y: 3000 },
  end: { x: 0, y: 0 },
  mid: { x: 0, y: 1500 }
});
floorGroup.add(wall4);

// Furniture mounted on Wall 1
const furn1 = createMockGroup('Furniture_f1', {
  isFurnitureGroup: true,
  furnitureId: 'f1',
  wallId: 'w1',
  furniture: { dimensions: { W: 900, H: 850, D: 600 } }
});
furn1.position = { x: 1500, y: 0, z: 300 };
floorGroup.add(furn1);

// Furniture mounted on Wall 3 (top)
const furn3 = createMockGroup('Furniture_f3', {
  isFurnitureGroup: true,
  furnitureId: 'f3',
  wallId: 'w3',
  furniture: { dimensions: { W: 900, H: 850, D: 600 } }
});
furn3.position = { x: 1500, y: 0, z: 2700 };
floorGroup.add(furn3);

console.log('Testing getHomeWallsAndFurniture...');
const items = getHomeWallsAndFurniture(homeObj);
assert.strictEqual(items.walls.length, 4, 'Should collect exactly 4 walls from floorGroup');
assert.strictEqual(items.furniture.length, 2, 'Should collect exactly 2 furniture units from floorGroup');
console.log('✓ Scene graph hierarchy collection passed: found 4 walls and 2 furniture groups.');

// Test Auto-Cut logic when camera is viewing from South (Y < 0, e.g. z = -3500) looking at room center (2000, 1500)
function simulateCut(camPos, targetPos, mode) {
  const wallMeshes = items.walls;
  const furnMeshes = items.furniture;

  var camPt = { x: camPos.x, y: camPos.z };
  var targPt = { x: targetPos.x, y: targetPos.z };
  var viewDx = targPt.x - camPt.x;
  var viewDy = targPt.y - camPt.y;
  var viewDist = Math.hypot(viewDx, viewDy) || 1;
  var perpX = -viewDy / viewDist;
  var perpY = viewDx / viewDist;

  var candidates = [];

  wallMeshes.forEach(function (wMesh) {
    var uData = wMesh.userData || {};
    var wStart = uData.start;
    var wEnd = uData.end;
    var wMid = uData.mid || { x: (wStart.x + wEnd.x) / 2, y: (wStart.y + wEnd.y) / 2 };

    var hit = testRayWallIntersection(camPt, targPt, wStart, wEnd);
    if (!hit) {
      var offset = 250;
      var camL = { x: camPt.x + perpX * offset, y: camPt.y + perpY * offset };
      var targL = { x: targPt.x + perpX * offset, y: targPt.y + perpY * offset };
      hit = testRayWallIntersection(camL, targL, wStart, wEnd);
      if (!hit) {
        var camR = { x: camPt.x - perpX * offset, y: camPt.y - perpY * offset };
        var targR = { x: targPt.x - perpX * offset, y: targPt.y - perpY * offset };
        hit = testRayWallIntersection(camR, targR, wStart, wEnd);
      }
    }

    var distToCam = hit ? Math.hypot(hit.pt.x - camPt.x, hit.pt.y - camPt.y) : Math.hypot(wMid.x - camPt.x, wMid.y - camPt.y);
    var score = hit ? (1000000 - distToCam) : 0;

    candidates.push({
      mesh: wMesh,
      wallId: uData.wallId,
      score: score,
      hit: !!hit,
      distToCam: distToCam
    });
  });

  var singleCutWall = null;
  if (candidates.length > 0) {
    candidates.sort(function (a, b) { return b.score - a.score; });
    var topCand = candidates[0];
    if (topCand && topCand.hit && topCand.score > 0) {
      singleCutWall = topCand.mesh;
    }
  }

  if (mode === 'all_obstructing') {
    wallMeshes.forEach(function (wMesh) {
      var cand = candidates.find(function (c) { return c.mesh === wMesh; });
      wMesh.visible = !(cand && cand.hit && cand.score > 0);
    });
  } else {
    // single_auto
    wallMeshes.forEach(function (wMesh) {
      wMesh.visible = !(singleCutWall && wMesh === singleCutWall);
    });
  }

  // Furniture visibility
  furnMeshes.forEach(function (fMesh) {
    var fPos = fMesh.position;
    var hideThisFurn = false;

    for (var wi = 0; wi < wallMeshes.length; wi++) {
      var wm = wallMeshes[wi];
      if (wm.visible) continue;

      var uData = wm.userData || {};
      if (uData.wallId && fMesh.userData && fMesh.userData.wallId === uData.wallId) {
        hideThisFurn = true;
        break;
      }
    }
    fMesh.visible = !hideThisFurn;
  });

  return { candidates, singleCutWall };
}

console.log('Testing South-facing view (Wall 1 obstruction)...');
simulateCut({ x: 2000, y: 1500, z: -4000 }, { x: 2000, y: 800, z: 1500 }, 'single_auto');
assert.strictEqual(wall1.visible, false, 'Wall 1 (front obstructing wall) must be cut/hidden');
assert.strictEqual(furn1.visible, false, 'Furniture 1 mounted on Wall 1 must be hidden');
assert.strictEqual(wall2.visible, true, 'Wall 2 must remain visible');
assert.strictEqual(wall3.visible, true, 'Wall 3 must remain visible');
assert.strictEqual(furn3.visible, true, 'Furniture 3 on Wall 3 must remain visible');
assert.strictEqual(wall4.visible, true, 'Wall 4 must remain visible');
console.log('✓ South view cutaway verified: Wall 1 & Furniture 1 cut, Walls 2,3,4 & Furniture 3 visible.');

console.log('Testing North-facing view (Wall 3 obstruction)...');
simulateCut({ x: 2000, y: 1500, z: 7000 }, { x: 2000, y: 800, z: 1500 }, 'single_auto');
assert.strictEqual(wall3.visible, false, 'Wall 3 (front obstructing wall) must be cut/hidden');
assert.strictEqual(furn3.visible, false, 'Furniture 3 on Wall 3 must be hidden');
assert.strictEqual(wall1.visible, true, 'Wall 1 must remain visible');
assert.strictEqual(furn1.visible, true, 'Furniture 1 on Wall 1 must remain visible');
assert.strictEqual(wall2.visible, true, 'Wall 2 must remain visible');
assert.strictEqual(wall4.visible, true, 'Wall 4 must remain visible');
console.log('✓ North view cutaway verified: Wall 3 & Furniture 3 cut, Walls 1,2,4 & Furniture 1 visible.');

console.log('Testing East-facing view (Wall 2 obstruction)...');
simulateCut({ x: 8000, y: 1500, z: 1500 }, { x: 2000, y: 800, z: 1500 }, 'single_auto');
assert.strictEqual(wall2.visible, false, 'Wall 2 must be cut/hidden');
assert.strictEqual(wall1.visible, true, 'Wall 1 must remain visible');
assert.strictEqual(wall3.visible, true, 'Wall 3 must remain visible');
assert.strictEqual(wall4.visible, true, 'Wall 4 must remain visible');
console.log('✓ East view cutaway verified: Wall 2 cut, Walls 1,3,4 visible.');

console.log('Testing West-facing view (Wall 4 obstruction)...');
simulateCut({ x: -4000, y: 1500, z: 1500 }, { x: 2000, y: 800, z: 1500 }, 'single_auto');
assert.strictEqual(wall4.visible, false, 'Wall 4 must be cut/hidden');
assert.strictEqual(wall1.visible, true, 'Wall 1 must remain visible');
assert.strictEqual(wall2.visible, true, 'Wall 2 must remain visible');
assert.strictEqual(wall3.visible, true, 'Wall 3 must remain visible');
console.log('✓ West view cutaway verified: Wall 4 cut, Walls 1,2,3 visible.');

console.log('All Wall Auto-Cut tests passed 100% successfully!');
