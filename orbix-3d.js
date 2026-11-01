/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Whole-Home 3D Extrusion & Architectural Meshing Engine
   Generates 3D walls with real cutouts, door leaves, windows, floors,
   ceilings, and placed modular furniture units.
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory(require('./orbix-core.js'));
  } else {
    root.Orbix3D = factory(root.OrbixCore);
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function (Core) {
  'use strict';

  var Vec2 = Core.Vec2;

  function ArchitecturalRenderer(scene, opts) {
    this.scene = scene;
    this.opts = opts || {};
    this.group = null;
    this.materials = {};
    this.initMaterials();
  }

  ArchitecturalRenderer.prototype.initMaterials = function () {
    if (typeof THREE === 'undefined') return;

    // Wall Plaster (Warm architectural beige matte)
    this.materials.wall = new THREE.MeshStandardMaterial({
      color: 0xE8DEC8, // Warm interior beige
      roughness: 0.88,
      metalness: 0.02
    });

    // Wall Core (Cutaway section interior)
    this.materials.wallCore = new THREE.MeshStandardMaterial({
      color: 0xD9CEBA, // Harmonious deeper beige core
      roughness: 0.9,
      metalness: 0.0
    });

    // Floor Finishes (Light green grass color) - DoubleSide so visible from all angles
    this.materials.floorTile = new THREE.MeshStandardMaterial({
      color: 0x97C96E,
      roughness: 0.35,
      metalness: 0.1,
      side: THREE.DoubleSide
    });

    this.materials.floorWood = new THREE.MeshStandardMaterial({
      color: 0xB8936A,
      roughness: 0.5,
      metalness: 0.05,
      side: THREE.DoubleSide
    });

    // Ceiling & False Ceiling
    this.materials.ceiling = new THREE.MeshStandardMaterial({
      color: 0xFFFFFF,
      roughness: 0.9,
      metalness: 0.0,
      side: THREE.DoubleSide
    });

    // Door Wood & Frame
    this.materials.doorWood = new THREE.MeshStandardMaterial({
      color: 0x543B2B, // Dark Walnut / Teak
      roughness: 0.45,
      metalness: 0.08
    });

    this.materials.doorFrame = new THREE.MeshStandardMaterial({
      color: 0x332218, // Hardwood Frame
      roughness: 0.5,
      metalness: 0.15
    });

    this.materials.doorHandle = new THREE.MeshStandardMaterial({
      color: 0xD4AF37, // Polished Architectural Brass
      roughness: 0.2,
      metalness: 0.85
    });

    // Window Aluminum Frame & Glazing
    this.materials.windowFrame = new THREE.MeshStandardMaterial({
      color: 0x222224, // Charcoal Architectural Aluminum
      roughness: 0.3,
      metalness: 0.8
    });

    this.materials.sillStone = new THREE.MeshStandardMaterial({
      color: 0xECE9E2, // White marble sill ledge
      roughness: 0.3,
      metalness: 0.05
    });

    this.materials.glass = new THREE.MeshPhysicalMaterial({
      color: 0x90C8E8,
      transparent: true,
      opacity: 0.42,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      side: THREE.DoubleSide
    });
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Complete 3D Home Scene
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildHome = function (project) {
    if (!this.scene || typeof THREE === 'undefined') return null;

    // Remove existing home group if any
    if (this.group) {
      this.scene.remove(this.group);
      this.disposeGroup(this.group);
    }

    this.group = new THREE.Group();
    this.group.name = 'OrbixHome3D';

    var plan = project.plan || {};
    var walls = plan.walls || [];
    var openings = plan.openings || [];
    var rooms = plan.rooms || [];
    var furniture = plan.furniture || [];

    // Map openings by wallId
    var openingsByWall = {};
    for (var o = 0; o < openings.length; o++) {
      var op = openings[o];
      if (!openingsByWall[op.wallId]) openingsByWall[op.wallId] = [];
      openingsByWall[op.wallId].push(op);
    }

    // 1. Build Extruded Walls with Real Cutouts
    for (var w = 0; w < walls.length; w++) {
      var wall = walls[w];
      var wallOps = openingsByWall[wall.id] || [];
      var wallMeshGroup = this.buildWallWithCutouts(wall, wallOps);
      if (wallMeshGroup) this.group.add(wallMeshGroup);
    }

    // 2. Build Room Floors
    for (var r = 0; r < rooms.length; r++) {
      var room = rooms[r];
      var floorMesh = this.buildRoomFloor(room);
      if (floorMesh) this.group.add(floorMesh);
    }

    // 3. Build Placed Furniture Units in 3D
    var activeFurnId = (window.S && window.S.units && window.S.units[window.S.active]) ? window.S.units[window.S.active]._furnId : null;
    for (var f = 0; f < furniture.length; f++) {
      var furn = furniture[f];
      var furnMesh = this.buildFurnitureMesh(furn);
      if (furnMesh) {
        if (activeFurnId && furn.id === activeFurnId) {
          furnMesh.traverse(function (c) { if (c.isMesh) c.visible = false; });
        }
        this.group.add(furnMesh);
      }
    }

    this.scene.add(this.group);
    return this.group;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build 3D Wall with Real Openings (Subdivided Blocks)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildWallWithCutouts = function (wall, ops) {
    var group = new THREE.Group();
    group.name = 'Wall_' + wall.id;

    var wLen = Core.wallLength(wall);
    if (!wLen || wLen < 50) return null;
    var wHeight = wall.height || 2800;
    var wThick = wall.thickness || 150;
    var angle = Core.wallAngle(wall);

    var start = wall.start;

    // Filter and sanitize valid openings
    var validOps = [];
    if (ops && ops.length > 0) {
      for (var o = 0; o < ops.length; o++) {
        var op = ops[o];
        if (!op) continue;
        var opW = op.width || (op.type === 'door' ? 900 : 1200);
        if (opW >= wLen - 20) opW = Math.max(200, wLen - 40);
        var halfW = opW / 2;
        var minOff = halfW + 10;
        var maxOff = Math.max(minOff, wLen - halfW - 10);
        var rawOff = (typeof op.offset === 'number' && !isNaN(op.offset)) ? op.offset : (wLen / 2);
        var safeOff = Math.max(minOff, Math.min(maxOff, rawOff));
        validOps.push({
          raw: op,
          width: opW,
          offset: safeOff,
          height: op.height || (op.type === 'door' ? 2100 : 1200),
          sillHeight: op.sillHeight || (op.type === 'door' ? 0 : 900),
          type: op.type || 'door',
          swing: op.swing || 'in-left'
        });
      }
    }

    if (validOps.length === 0) {
      // Solid Wall: Single extruded box
      var geo = new THREE.BoxGeometry(wLen, wHeight, wThick);
      var mesh = new THREE.Mesh(geo, this.materials.wall);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(wLen / 2, wHeight / 2, 0);
      group.add(mesh);
    } else {
      validOps.sort(function (a, b) { return a.offset - b.offset; });

      var currX = 0;
      for (var i = 0; i < validOps.length; i++) {
        var vOp = validOps[i];
        var halfOpW = vOp.width / 2;
        var opStart = Math.max(currX, vOp.offset - halfOpW);
        var opEnd = Math.min(wLen, opStart + vOp.width);
        var opWidth = Math.max(100, opEnd - opStart);
        var opHeight = Math.min(wHeight - 50, vOp.height);
        var sillH = Math.max(0, vOp.sillHeight);
        if (sillH + opHeight > wHeight) opHeight = wHeight - sillH - 20;

        // 1. Solid segment to the left of opening
        if (opStart > currX + 1) {
          var segW = opStart - currX;
          var segGeo = new THREE.BoxGeometry(segW, wHeight, wThick);
          var segMesh = new THREE.Mesh(segGeo, this.materials.wall);
          segMesh.position.set(currX + segW / 2, wHeight / 2, 0);
          segMesh.castShadow = true;
          segMesh.receiveShadow = true;
          group.add(segMesh);
        }

        // 2. Below window sill segment (if window with sillHeight > 0)
        if (sillH > 0) {
          var sillGeo = new THREE.BoxGeometry(opWidth, sillH, wThick);
          var sillMesh = new THREE.Mesh(sillGeo, this.materials.wall);
          sillMesh.position.set(opStart + opWidth / 2, sillH / 2, 0);
          sillMesh.castShadow = true;
          sillMesh.receiveShadow = true;
          group.add(sillMesh);
        }

        // 3. Above opening lintel segment
        var opTop = sillH + opHeight;
        if (wHeight > opTop + 1) {
          var lintelH = wHeight - opTop;
          var lintelGeo = new THREE.BoxGeometry(opWidth, lintelH, wThick);
          var lintelMesh = new THREE.Mesh(lintelGeo, this.materials.wall);
          lintelMesh.position.set(opStart + opWidth / 2, opTop + lintelH / 2, 0);
          lintelMesh.castShadow = true;
          lintelMesh.receiveShadow = true;
          group.add(lintelMesh);
        }

        // 4. Construct Door / Window Frame and Leaf in the cutout
        if (vOp.type === 'door') {
          var doorGroup = this.buildDoor3D(vOp.raw, opWidth, opHeight, wThick);
          doorGroup.position.set(opStart, 0, 0);
          group.add(doorGroup);
        } else {
          var winGroup = this.buildWindow3D(vOp.raw, opWidth, opHeight, sillH, wThick);
          winGroup.position.set(opStart, sillH, 0);
          group.add(winGroup);
        }

        currX = opEnd;
      }

      // Final segment to the right of last opening
      if (wLen > currX + 1) {
        var lastW = wLen - currX;
        var lastGeo = new THREE.BoxGeometry(lastW, wHeight, wThick);
        var lastMesh = new THREE.Mesh(lastGeo, this.materials.wall);
        lastMesh.position.set(currX + lastW / 2, wHeight / 2, 0);
        lastMesh.castShadow = true;
        lastMesh.receiveShadow = true;
        group.add(lastMesh);
      }
    }

    group.position.set(start.x, 0, start.y);
    group.rotation.y = -angle;
    group.userData = {
      isWall: true,
      wallId: wall.id,
      mid: { x: (start.x + wall.end.x) / 2, y: (start.y + wall.end.y) / 2 }
    };
    return group;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build 3D Door (Frame, Leaf, 4-Way Swing, Hardware Handle)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildDoor3D = function (op, width, height, wallThick) {
    var dg = new THREE.Group();
    var frameT = 60, frameD = wallThick + 10;

    // Left & Right Jambs
    var jambGeo = new THREE.BoxGeometry(frameT, height, frameD);
    var leftJamb = new THREE.Mesh(jambGeo, this.materials.doorFrame);
    leftJamb.position.set(frameT / 2, height / 2, 0);
    leftJamb.castShadow = true;
    leftJamb.receiveShadow = true;
    dg.add(leftJamb);

    var rightJamb = new THREE.Mesh(jambGeo, this.materials.doorFrame);
    rightJamb.position.set(width - frameT / 2, height / 2, 0);
    rightJamb.castShadow = true;
    rightJamb.receiveShadow = true;
    dg.add(rightJamb);

    // Head Frame
    var headGeo = new THREE.BoxGeometry(width, frameT, frameD);
    var head = new THREE.Mesh(headGeo, this.materials.doorFrame);
    head.position.set(width / 2, height - frameT / 2, 0);
    head.castShadow = true;
    head.receiveShadow = true;
    dg.add(head);

    // Door Shutter Leaf (Rotatable on Hinge)
    var leafW = width - frameT * 2;
    var leafH = height - frameT;
    var leafThick = 40;

    var leafGeo = new THREE.BoxGeometry(leafW, leafH, leafThick);
    var leafMesh = new THREE.Mesh(leafGeo, this.materials.doorWood);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;

    // Hinge Pivot Group with Left/Right and Inward/Outward swing
    var hinge = new THREE.Group();
    var swing = (op && op.swing) || 'in-left';
    var isRight = swing.indexOf('right') !== -1;
    var isOut = swing.indexOf('out') !== -1;

    var swingAngle;
    if (isRight) {
      hinge.position.set(width - frameT, 0, 0);
      leafMesh.position.set(-leafW / 2, leafH / 2, 0);
      swingAngle = isOut ? Math.PI / 3.5 : -Math.PI / 3.5;
    } else {
      hinge.position.set(frameT, 0, 0);
      leafMesh.position.set(leafW / 2, leafH / 2, 0);
      swingAngle = isOut ? -Math.PI / 3.5 : Math.PI / 3.5;
    }
    hinge.rotation.y = swingAngle;
    hinge.add(leafMesh);

    // Architectural Door Handle Hardware
    var handleGeo = new THREE.CylinderGeometry(7, 7, 130, 12);
    var handleMat = this.materials.doorHandle || this.materials.doorWood;
    var handleMesh = new THREE.Mesh(handleGeo, handleMat);
    var handleX = isRight ? -leafW + 45 : leafW - 45;
    handleMesh.position.set(handleX, leafH * 0.48, leafThick / 2 + 12);
    handleMesh.rotation.x = Math.PI / 2;
    handleMesh.castShadow = true;
    hinge.add(handleMesh);

    var backHandle = new THREE.Mesh(handleGeo, handleMat);
    backHandle.position.set(handleX, leafH * 0.48, -leafThick / 2 - 12);
    backHandle.rotation.x = Math.PI / 2;
    hinge.add(backHandle);

    dg.add(hinge);
    return dg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build 3D Window (Outer Frame, Mullion Bars, Glass Pane, Stone Sill)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildWindow3D = function (op, width, height, sillH, wallThick) {
    var wg = new THREE.Group();
    var frameT = 50, frameD = wallThick - 10;

    // Outer Frame Border
    var hGeo = new THREE.BoxGeometry(width, frameT, frameD);
    var topF = new THREE.Mesh(hGeo, this.materials.windowFrame);
    topF.position.set(width / 2, height - frameT / 2, 0);
    topF.castShadow = true;
    topF.receiveShadow = true;
    wg.add(topF);

    var botF = new THREE.Mesh(hGeo, this.materials.windowFrame);
    botF.position.set(width / 2, frameT / 2, 0);
    botF.castShadow = true;
    botF.receiveShadow = true;
    wg.add(botF);

    var vGeo = new THREE.BoxGeometry(frameT, height - frameT * 2, frameD);
    var leftF = new THREE.Mesh(vGeo, this.materials.windowFrame);
    leftF.position.set(frameT / 2, height / 2, 0);
    leftF.castShadow = true;
    leftF.receiveShadow = true;
    wg.add(leftF);

    var rightF = new THREE.Mesh(vGeo, this.materials.windowFrame);
    rightF.position.set(width - frameT / 2, height / 2, 0);
    rightF.castShadow = true;
    rightF.receiveShadow = true;
    wg.add(rightF);

    // Glass Pane
    var glassGeo = new THREE.BoxGeometry(width - frameT * 2, height - frameT * 2, 10);
    var glassMesh = new THREE.Mesh(glassGeo, this.materials.glass);
    glassMesh.position.set(width / 2, height / 2, 0);
    wg.add(glassMesh);

    // Center Vertical Mullion Bar
    if (width > 750) {
      var mulVGeo = new THREE.BoxGeometry(28, height - frameT * 2, frameD * 0.7);
      var mulVMesh = new THREE.Mesh(mulVGeo, this.materials.windowFrame);
      mulVMesh.position.set(width / 2, height / 2, 0);
      mulVMesh.castShadow = true;
      wg.add(mulVMesh);
    }

    // Horizontal Transom Bar
    if (height > 1200) {
      var mulHGeo = new THREE.BoxGeometry(width - frameT * 2, 24, frameD * 0.7);
      var mulHMesh = new THREE.Mesh(mulHGeo, this.materials.windowFrame);
      mulHMesh.position.set(width / 2, height * 0.65, 0);
      mulHMesh.castShadow = true;
      wg.add(mulHMesh);
    }

    // Exterior Stone Sill Ledge
    var sillLedgeGeo = new THREE.BoxGeometry(width + 50, 28, wallThick + 40);
    var sillLedge = new THREE.Mesh(sillLedgeGeo, this.materials.sillStone || this.materials.wall);
    sillLedge.position.set(width / 2, 14, 0);
    sillLedge.castShadow = true;
    sillLedge.receiveShadow = true;
    wg.add(sillLedge);

    return wg;
  };

  ArchitecturalRenderer.prototype.buildRoomFloor = function (room) {
    if (!room.polygon || room.polygon.length < 3) return null;

    var shape = new THREE.Shape();
    shape.moveTo(room.polygon[0].x, room.polygon[0].y);
    for (var i = 1; i < room.polygon.length; i++) {
      shape.lineTo(room.polygon[i].x, room.polygon[i].y);
    }
    shape.closePath();

    var geo = new THREE.ShapeGeometry(shape);
    var mat = room.type === 'bedroom' ? this.materials.floorWood : this.materials.floorTile;
    var mesh = new THREE.Mesh(geo, mat);

    // Rotate flat into X-Z floor plane
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = 1; // 1mm above base level to prevent Z-fighting
    mesh.receiveShadow = true;
    mesh.name = 'Floor_' + room.name;

    return mesh;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Placed 3D Furniture Unit
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildFurnitureMesh = function (furn) {
    var fg = new THREE.Group();
    fg.name = 'Furniture_' + furn.id;
    fg.userData = { isFurniture: true, isFurnitureGroup: true, furnitureId: furn.id, furniture: furn };

    var dims = furn.dimensions || { W: 1200, H: 2100, D: 600 };
    var cat = furn.category || 'wardrobe';
    var isKitchen = (cat === 'kitchen_base' || cat === 'kitchen_wall');
    var isBase = (cat === 'kitchen_base' || cat === 'crockery' || cat === 'vanity');

    // Carcass Body
    var carcassColor = 0xFAF8F5; // Absolute white / light interior
    var shutterColor = 0x6E4E35; // Brazilian Walnut
    if (furn.materials && furn.materials.shutter && furn.materials.shutter.finish) {
      var fin = furn.materials.shutter.finish.toLowerCase();
      if (fin.indexOf('gloss') !== -1 || fin.indexOf('white') !== -1) shutterColor = 0xEDEBE4;
      else if (fin.indexOf('walnut') !== -1) shutterColor = 0x5D3E27;
      else if (fin.indexOf('sage') !== -1) shutterColor = 0x7A8875;
    }

    var carcassMat = new THREE.MeshStandardMaterial({ color: carcassColor, roughness: 0.6, metalness: 0.05 });
    var shutterMat = new THREE.MeshStandardMaterial({ color: shutterColor, roughness: 0.45, metalness: 0.05 });
    var counterMat = new THREE.MeshStandardMaterial({ color: 0x1A1A1D, roughness: 0.25, metalness: 0.1 }); // Black galaxy
    var handleMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.3, metalness: 0.8 }); // Black metal

    var plinthH = isBase ? 75 : 0;
    var counterH = isBase ? 30 : 0;
    var bodyH = dims.H - plinthH - counterH;

    // Main Carcass Body
    var bodyGeo = new THREE.BoxGeometry(dims.W, bodyH, dims.D - 20);
    var bodyMesh = new THREE.Mesh(bodyGeo, carcassMat);
    bodyMesh.position.set(0, plinthH + bodyH / 2, -10);
    bodyMesh.castShadow = true;
    bodyMesh.receiveShadow = true;
    bodyMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(bodyMesh);

    // Countertop Stone (if kitchen/crockery/vanity)
    if (counterH > 0) {
      var cGeo = new THREE.BoxGeometry(dims.W + 20, counterH, dims.D + 25);
      var cMesh = new THREE.Mesh(cGeo, counterMat);
      cMesh.position.set(0, dims.H - counterH / 2, 2.5);
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      cMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(cMesh);
    }

    // Front Shutters
    var numShutters = (furn.unitConfig && furn.unitConfig.shutters) || (dims.W > 1200 ? 3 : dims.W > 600 ? 2 : 1);
    var shW = (dims.W - (numShutters + 1) * 3) / numShutters;
    var shH = bodyH - 6;

    for (var s = 0; s < numShutters; s++) {
      var sGeo = new THREE.BoxGeometry(shW, shH, 18);
      var sMesh = new THREE.Mesh(sGeo, shutterMat);
      var sX = -dims.W / 2 + 3 + shW / 2 + s * (shW + 3);
      var sY = plinthH + 3 + shH / 2;
      var sZ = dims.D / 2 - 9;
      sMesh.position.set(sX, sY, sZ);
      sMesh.castShadow = true;
      sMesh.receiveShadow = true;
      sMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(sMesh);

      // Handle pull
      var hGeo = new THREE.BoxGeometry(16, Math.min(180, shH * 0.4), 16);
      var hMesh = new THREE.Mesh(hGeo, handleMat);
      var hX = (s % 2 === 0) ? sX + shW / 2 - 25 : sX - shW / 2 + 25;
      var hY = isBase ? sY + shH * 0.25 : sY;
      hMesh.position.set(hX, hY, sZ + 14);
      hMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(hMesh);
    }

    // Position and rotate unit
    fg.position.set(furn.pos.x, furn.pos.z || 0, furn.pos.y);
    fg.rotation.y = -(furn.rotY || 0);

    return fg;
  };

  ArchitecturalRenderer.prototype.disposeGroup = function (group) {
    if (!group) return;
    group.traverse(function (obj) {
      if (obj.geometry) obj.geometry.dispose();
      if (obj.material) {
        if (Array.isArray(obj.material)) {
          obj.material.forEach(function (m) { m.dispose(); });
        } else {
          obj.material.dispose();
        }
      }
    });
  };

  return ArchitecturalRenderer;
});
