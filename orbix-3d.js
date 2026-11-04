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

    var plan = project;
    while (plan && plan.plan && (plan.plan.walls || plan.plan.furniture || plan.plan.rooms || plan.plan.plan)) {
      plan = plan.plan;
    }
    plan = plan || {};
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
    for (var f = 0; f < furniture.length; f++) {
      var furn = furniture[f];
      var furnMesh = this.buildFurnitureMesh(furn);
      if (furnMesh) {
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
    var cat = (furn.category || 'wardrobe').toLowerCase();
    var name = (furn.name || '').toLowerCase();
    var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
      window.OrbixCore.isWallUnit(cat, name) :
      (cat.indexOf('wall') !== -1 || cat === 'wm-01' || cat === 'k_wall' || cat === 'kitchen_wall' ||
       cat === 'crockery_wall' || cat === 'spice_rack' || cat.indexOf('overhead') !== -1 ||
       cat.indexOf('loft') !== -1 || name.indexOf('wall') !== -1 || name.indexOf('overhead') !== -1 ||
       name.indexOf('spice rack') !== -1 || name.indexOf('loft') !== -1);
    var isKitchen = (cat === 'kitchen_base' || cat === 'kitchen_wall');
    var isBase = !isWall && (cat === 'kitchen_base' || cat === 'crockery' || cat === 'vanity');

    // Resolve Carcass & Shutter finishes using lam() if available
    var shutterFinish = (furn.unitConfig && furn.unitConfig.shutterCol) ||
                        (furn.materials && furn.materials.shutter && furn.materials.shutter.finish) ||
                        'MDF 1135';
    var carcassFinish = (furn.unitConfig && furn.unitConfig.carcass) ||
                        (furn.materials && furn.materials.carcass && furn.materials.carcass.finish) ||
                        'MDF 1135';

    function hexStringToNum(hexStr, defaultNum) {
      if (!hexStr) return defaultNum;
      var clean = String(hexStr).replace('#', '').trim();
      var num = parseInt(clean, 16);
      return isNaN(num) ? defaultNum : num;
    }

    var shutterHex = 0x6E4E35; // Default walnut
    var carcassHex = 0xFAF8F5; // Default white

    if (typeof window !== 'undefined' && typeof window.lam === 'function') {
      var sLam = window.lam(shutterFinish);
      if (sLam && sLam.hex) shutterHex = hexStringToNum(sLam.hex, 0x6E4E35);
      var cLam = window.lam(carcassFinish);
      if (cLam && cLam.hex) carcassHex = hexStringToNum(cLam.hex, 0xFAF8F5);
    } else {
      var sLower = String(shutterFinish).toLowerCase();
      if (sLower.indexOf('white') !== -1 || sLower.indexOf('gloss') !== -1) shutterHex = 0xEDEBE4;
      else if (sLower.indexOf('walnut') !== -1) shutterHex = 0x5D3E27;
      else if (sLower.indexOf('sage') !== -1) shutterHex = 0x7A8875;
      else if (sLower.indexOf('oak') !== -1) shutterHex = 0xC4A173;
      else if (sLower.indexOf('wenge') !== -1) shutterHex = 0x38281F;
      else if (sLower.indexOf('concrete') !== -1) shutterHex = 0x8A8E91;
    }

    var carcassMat = new THREE.MeshStandardMaterial({ color: carcassHex, roughness: 0.55, metalness: 0.05 });
    var shutterMat = new THREE.MeshStandardMaterial({ color: shutterHex, roughness: 0.45, metalness: 0.05 });

    // Door style
    var dstyle = (furn.unitConfig && furn.unitConfig.dstyle) || 'slab';
    var doorType = (furn.unitConfig && (furn.unitConfig.doorType || furn.unitConfig.type)) || 'hinged';

    // Handle Finish
    var hfin = (furn.unitConfig && furn.unitConfig.hfinish) || 'black';
    var handleHex = (hfin === 'brass' || hfin === 'gold') ? 0xD4AF37 : (hfin === 'chrome' || hfin === 'nickel') ? 0xCCCCCC : 0x1A1A1A;
    var handleMat = new THREE.MeshStandardMaterial({ color: handleHex, roughness: 0.25, metalness: 0.85 });

    // Countertop
    var counterColorName = (furn.unitConfig && furn.unitConfig.counter) || (isKitchen ? 'black' : 'none');
    var counterHex = 0x1A1A1D;
    if (counterColorName === 'white' || counterColorName === 'marble') counterHex = 0xF5F5F7;
    else if (counterColorName === 'quartz' || counterColorName === 'greyq') counterHex = 0x8E9297;
    var counterMat = new THREE.MeshStandardMaterial({ color: counterHex, roughness: 0.2, metalness: 0.1 });

    var plinthH = isBase ? 75 : 0;
    var counterH = (isBase && counterColorName !== 'none') ? 35 : 0;
    var bodyH = Math.max(100, dims.H - plinthH - counterH);
    var innerW = dims.W - 36;
    var innerD = dims.D - 20;

    // Helper: Material for individual shutter s
    function getShutterMaterial(sIdx) {
      var col = (furn.shutterColors && furn.shutterColors[sIdx]) || null;
      var matFin = (furn.shutterMaterials && furn.shutterMaterials[sIdx]) ||
                   (furn.materials && furn.materials.shutter && furn.materials.shutter.finish) || 'Brazilian Walnut';
      var threeCol = 0x6E4E35;
      var roughness = 0.45;
      var metalness = 0.05;

      if (col) {
        if (typeof col === 'string') {
          var cleanHex = col.replace('#', '');
          threeCol = parseInt(cleanHex, 16);
        } else if (typeof col === 'number') {
          threeCol = col;
        }
      } else {
        var fin = matFin.toLowerCase();
        if (fin.indexOf('gloss') !== -1 || fin.indexOf('white') !== -1) { threeCol = 0xEDEBE4; roughness = 0.15; }
        else if (fin.indexOf('walnut') !== -1) { threeCol = 0x5D3E27; roughness = 0.5; }
        else if (fin.indexOf('sage') !== -1) { threeCol = 0x7A8875; roughness = 0.6; }
        else if (fin.indexOf('oak') !== -1) { threeCol = 0xC8B293; roughness = 0.55; }
        else if (fin.indexOf('concrete') !== -1) { threeCol = 0x8C8885; roughness = 0.8; }
      }
      return new THREE.MeshStandardMaterial({ color: threeCol, roughness: roughness, metalness: metalness });
    }

    // Realistic Open Carcass with Interior Panels
    // 1. Left side panel
    var leftGeo = new THREE.BoxGeometry(18, bodyH, innerD);
    var leftMesh = new THREE.Mesh(leftGeo, carcassMat);
    leftMesh.position.set(-dims.W / 2 + 9, plinthH + bodyH / 2, -10);
    leftMesh.castShadow = true; leftMesh.receiveShadow = true;
    leftMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(leftMesh);

    // 2. Right side panel
    var rightGeo = new THREE.BoxGeometry(18, bodyH, innerD);
    var rightMesh = new THREE.Mesh(rightGeo, carcassMat);
    rightMesh.position.set(dims.W / 2 - 9, plinthH + bodyH / 2, -10);
    rightMesh.castShadow = true; rightMesh.receiveShadow = true;
    rightMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(rightMesh);

    // 3. Bottom panel
    var botGeo = new THREE.BoxGeometry(innerW, 18, innerD);
    var botMesh = new THREE.Mesh(botGeo, carcassMat);
    botMesh.position.set(0, plinthH + 9, -10);
    botMesh.castShadow = true; botMesh.receiveShadow = true;
    botMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(botMesh);

    // 4. Top panel
    var topGeo = new THREE.BoxGeometry(innerW, 18, innerD);
    var topMesh = new THREE.Mesh(topGeo, carcassMat);
    topMesh.position.set(0, plinthH + bodyH - 9, -10);
    topMesh.castShadow = true; topMesh.receiveShadow = true;
    topMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(topMesh);

    // 5. Back panel
    var backGeo = new THREE.BoxGeometry(innerW, bodyH - 36, 12);
    var backMesh = new THREE.Mesh(backGeo, carcassMat);
    backMesh.position.set(0, plinthH + bodyH / 2, -dims.D / 2 + 6);
    backMesh.castShadow = true; backMesh.receiveShadow = true;
    backMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(backMesh);

    // 6. Internal Shelves
    if (bodyH > 700) {
      var numShelves = bodyH > 1400 ? 3 : 1;
      for (var sh = 1; sh <= numShelves; sh++) {
        var shelfY = plinthH + (sh * bodyH) / (numShelves + 1);
        var shelfGeo = new THREE.BoxGeometry(innerW, 18, innerD - 20);
        var shelfMesh = new THREE.Mesh(shelfGeo, carcassMat);
        shelfMesh.position.set(0, shelfY, -10);
        shelfMesh.castShadow = true; shelfMesh.receiveShadow = true;
        shelfMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
        fg.add(shelfMesh);
      }
    }

    // Plinth Base (for base units)
    if (plinthH > 0) {
      var pGeo = new THREE.BoxGeometry(dims.W - 30, plinthH, dims.D - 50);
      var pMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
      var pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(0, plinthH / 2, -15);
      pMesh.castShadow = true; pMesh.receiveShadow = true;
      pMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(pMesh);
    }

    // Countertop Stone (if kitchen base / vanity / crockery)
    if (counterH > 0) {
      var cGeo = new THREE.BoxGeometry(dims.W + 20, counterH, dims.D + 25);
      var cMesh = new THREE.Mesh(cGeo, counterMat);
      cMesh.position.set(0, dims.H - counterH / 2, 2.5);
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      cMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(cMesh);
    }

// Realistic Drawers & Hinged Shutters with Interactive Open/Close & Individual Finishes
    var drawersCount = (furn.unitConfig && furn.unitConfig.drawers !== undefined) ? parseInt(furn.unitConfig.drawers) : 0;
    var numShutters = (furn.unitConfig && furn.unitConfig.shutters !== undefined) ?
      parseInt(furn.unitConfig.shutters) :
      ((drawersCount > 0 && dims.H < 1000) ? 0 : (dims.W > 1200 ? 3 : dims.W > 600 ? 2 : 1));

    var totalDrawersH = 0;
    var drawerH = 0;

    // 7. Drawers Geometry & Sliding Groups
    if (drawersCount > 0) {
      if (numShutters === 0) {
        // Pure drawers unit (e.g. bedside unit, 3-pot drawer kitchen base)
        drawerH = Math.max(120, Math.floor((bodyH - (drawersCount + 1) * 3) / drawersCount));
        totalDrawersH = bodyH;
      } else {
        // Mixed unit: drawers at bottom, shutters above
        drawerH = Math.min(220, Math.max(140, Math.floor((bodyH * 0.42) / drawersCount)));
        totalDrawersH = drawersCount * (drawerH + 3);
      }

      for (var d = 0; d < drawersCount; d++) {
        var dY = plinthH + 3 + d * (drawerH + 3) + drawerH / 2;
        var isDOpen = !!(furn.drawerStates && furn.drawerStates[d]);
        var drawerGroup = new THREE.Group();
        drawerGroup.name = 'DrawerSlide_' + d;
        drawerGroup.position.set(0, dY, isDOpen ? 350 : 0);
        drawerGroup.userData = { isDrawerGroup: true, drawerIdx: d, furnitureId: furn.id, isOpen: isDOpen };

        // Drawer Front Facia
        var faciaGeo = new THREE.BoxGeometry(dims.W - 6, drawerH, 18);
        var faciaMat = getShutterMaterial(d % Math.max(1, numShutters));
        var faciaMesh = new THREE.Mesh(faciaGeo, faciaMat);
        faciaMesh.position.set(0, 0, dims.D / 2 - 9);
        faciaMesh.castShadow = true; faciaMesh.receiveShadow = true;
        faciaMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
        drawerGroup.add(faciaMesh);

        // Drawer Pull Handle (Horizontal)
        var dhGeo = new THREE.BoxGeometry(Math.min(180, (dims.W - 30) * 0.4), 14, 16);
        var dhMesh = new THREE.Mesh(dhGeo, handleMat);
        dhMesh.position.set(0, 0, dims.D / 2 + 5);
        dhMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
        drawerGroup.add(dhMesh);

        // Drawer Interior Box
        var dbGeo = new THREE.BoxGeometry(innerW - 20, 12, innerD - 30);
        var dbMesh = new THREE.Mesh(dbGeo, carcassMat);
        dbMesh.position.set(0, -drawerH / 2 + 6, -15);
        dbMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
        drawerGroup.add(dbMesh);

        var dlGeo = new THREE.BoxGeometry(12, drawerH - 24, innerD - 30);
        var dlMesh = new THREE.Mesh(dlGeo, carcassMat);
        dlMesh.position.set(-(innerW - 20) / 2 + 6, 0, -15);
        dlMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
        drawerGroup.add(dlMesh);

        var drGeo = new THREE.BoxGeometry(12, drawerH - 24, innerD - 30);
        var drMesh = new THREE.Mesh(drGeo, carcassMat);
        drMesh.position.set((innerW - 20) / 2 - 6, 0, -15);
        drMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
        drawerGroup.add(drMesh);

        var dbkGeo = new THREE.BoxGeometry(innerW - 44, drawerH - 24, 12);
        var dbkMesh = new THREE.Mesh(dbkGeo, carcassMat);
        dbkMesh.position.set(0, 0, -(innerD - 30) / 2 - 15 + 6);
        dbkMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
        drawerGroup.add(dbkMesh);

        fg.add(drawerGroup);
      }
    }

    // 8. Front Hinged Shutters with Opening Pivots
    if (numShutters > 0) {
      var shW = (dims.W - (numShutters + 1) * 3) / numShutters;
      var shH = Math.max(150, bodyH - totalDrawersH - 6);
      var shutterBaseY = plinthH + totalDrawersH + 3;
      var hingeY = shutterBaseY + shH / 2;

      for (var s = 0; s < numShutters; s++) {
        var hingeLeft = (s % 2 === 0);
        var sLeftX = -dims.W / 2 + 3 + s * (shW + 3);
        var hingeX = hingeLeft ? sLeftX : (sLeftX + shW);
        var hingeZ = dims.D / 2 - 9;

        var hingeGroup = new THREE.Group();
        hingeGroup.name = 'ShutterHinge_' + s;
        hingeGroup.position.set(hingeX, hingeY, hingeZ);
        hingeGroup.userData = { isShutterHinge: true, shutterIdx: s, furnitureId: furn.id };

        var sGeo = new THREE.BoxGeometry(shW, shH, 18);
        var sMesh = new THREE.Mesh(sGeo, getShutterMaterial(s));
        var localX = hingeLeft ? (shW / 2) : (-shW / 2);
        sMesh.position.set(localX, 0, 0);
        sMesh.castShadow = true;
        sMesh.receiveShadow = true;
        sMesh.userData = { isFurniturePart: true, isShutter: true, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
        hingeGroup.add(sMesh);

        // Handle pull
        var hGeo = new THREE.BoxGeometry(16, Math.min(180, shH * 0.4), 16);
        var hMesh = new THREE.Mesh(hGeo, handleMat);
        var handleX = hingeLeft ? (shW - 25) : (-shW + 25);
        var handleY = (isBase || drawersCount > 0) ? shH * 0.25 : 0;
        hMesh.position.set(handleX, handleY, 14);
        hMesh.userData = { isFurniturePart: true, isShutter: true, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
        hingeGroup.add(hMesh);

        // Shutter Open / Close rotation (~108 degrees)
        var isOpen = !!(furn.shutterStates && furn.shutterStates[s]);
        if (isOpen) {
          hingeGroup.rotation.y = hingeLeft ? -Math.PI * 0.6 : Math.PI * 0.6;
        } else {
          hingeGroup.rotation.y = 0;
        }

        fg.add(hingeGroup);
      }
    }

    // Position and rotate unit (with elevation from finished floor level!)
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) :
        (isWall ? 1500 : 0));
    fg.position.set(furn.pos.x, elev, furn.pos.y);
    fg.rotation.y = -(furn.rotY || 0);

    // If this unit is currently the active unit in 3D Studio, keep its static mesh hidden
    // so the live parametric model (root) renders in its place
    if (typeof window !== 'undefined' && window.S && Array.isArray(window.S.units) && typeof window.S.active === 'number') {
      var actU = window.S.units[window.S.active];
      if (actU && actU._furnId === furn.id) {
        fg.visible = (window.Orbix3DViewMode === 'home');
      }
    }

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

  /* ─────────────────────────────────────────────────────────────────────────────
     TRIMBLE SKETCHUP (.SKP / COLLADA .DAE) EXPORT ENGINE
     Serializes entire 3D project geometry (walls, cutouts, doors, windows,
     room floors, and placed modular cabinetry units) into native SketchUp
     compatible COLLADA XML schema with real-world millimeter scale.
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.exportToSketchUpCollada = function (project, scene, opts) {
    opts = opts || {};
    var title = (project && project.meta && project.meta.title) || 'Orbix-Project';
    var safeTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_');

    var homeObj = null;
    var tempHomeBuilt = false;

    if (scene && typeof scene.getObjectByName === 'function') {
      homeObj = scene.getObjectByName('OrbixHome3D');
    }

    // If 3D home is not in the scene, build it now
    if (!homeObj && project && typeof THREE !== 'undefined') {
      homeObj = this.buildHome(project);
      tempHomeBuilt = true;
    }

    var meshes = [];
    function harvestMeshes(node) {
      if (!node) return;
      if (typeof node.updateMatrixWorld === 'function') node.updateMatrixWorld(true);
      node.traverse(function (obj) {
        if (obj.isMesh && obj.visible !== false && obj.geometry) {
          // Skip infinite ground background planes
          var geoParams = obj.geometry.parameters;
          if (geoParams && (geoParams.width > 50000 || geoParams.height > 50000)) return;
          if (obj.name === 'infinite_floor' || obj.name === 'floor_grass') return;
          meshes.push(obj);
        }
      });
    }

    if (homeObj) harvestMeshes(homeObj);

    // Also include customizer units in 3D studio root if present
    if (scene && scene.children) {
      for (var c = 0; c < scene.children.length; c++) {
        var child = scene.children[c];
        if (child !== homeObj && child.type === 'Group') {
          var hasCabinetParts = false;
          child.traverse(function (o) {
            if (o.isMesh && o.userData && (o.userData.role || o.userData.isFurniturePart || o.userData.role === 'box')) {
              hasCabinetParts = true;
            }
          });
          if (hasCabinetParts) harvestMeshes(child);
        }
      }
    }

    // Process Materials
    var materials = {};
    var matCounter = 1;

    meshes.forEach(function (mesh) {
      var mat = mesh.material;
      if (Array.isArray(mat)) mat = mat[0];
      var colorHex = 'CCCCCC';
      var opacity = 1.0;
      var isGlass = false;

      if (mat && mat.color && typeof mat.color.getHexString === 'function') {
        colorHex = mat.color.getHexString().toUpperCase();
      }
      if (mat && typeof mat.opacity === 'number') {
        opacity = mat.opacity;
      }
      if (mat && (mat.transparent || opacity < 0.9 || (mesh.name && mesh.name.toLowerCase().indexOf('glass') !== -1))) {
        isGlass = true;
      }

      var key = colorHex + '_' + (isGlass ? 'glass' : 'solid');
      if (!materials[key]) {
        var r = mat && mat.color ? (mat.color.r !== undefined ? mat.color.r : 0.8) : 0.8;
        var g = mat && mat.color ? (mat.color.g !== undefined ? mat.color.g : 0.8) : 0.8;
        var b = mat && mat.color ? (mat.color.b !== undefined ? mat.color.b : 0.8) : 0.8;
        materials[key] = {
          id: 'mat_' + matCounter++,
          name: (mat && mat.name ? mat.name : 'Mat') + '_' + colorHex,
          hex: colorHex,
          r: Number(r).toFixed(4),
          g: Number(g).toFixed(4),
          b: Number(b).toFixed(4),
          opacity: Number(opacity).toFixed(2),
          isGlass: isGlass
        };
      }
      mesh.userData._skpMat = materials[key];
    });

    // Build Effects and Materials XML
    var effectsXml = [];
    var matsXml = [];
    Object.keys(materials).forEach(function (k) {
      var m = materials[k];
      effectsXml.push([
        '    <effect id="' + m.id + '-effect">',
        '      <profile_COMMON>',
        '        <technique sid="common">',
        '          <phong>',
        '            <emission><color>0 0 0 1</color></emission>',
        '            <ambient><color>0.08 0.08 0.08 1</color></ambient>',
        '            <diffuse><color>' + m.r + ' ' + m.g + ' ' + m.b + ' 1</color></diffuse>',
        '            <specular><color>0.25 0.25 0.25 1</color></specular>',
        '            <shininess><float>20</float></shininess>',
        '            <transparent opaque="A_ONE"><color>1 1 1 ' + m.opacity + '</color></transparent>',
        '            <transparency><float>' + m.opacity + '</float></transparency>',
        '          </phong>',
        '        </technique>',
        '      </profile_COMMON>',
        '    </effect>'
      ].join('\n'));

      matsXml.push([
        '    <material id="' + m.id + '" name="' + m.name + '">',
        '      <instance_effect url="#' + m.id + '-effect"/>',
        '    </material>'
      ].join('\n'));
    });

    // Build Geometries & Nodes XML
    var geomsXml = [];
    var nodesXml = [];
    var geomCounter = 1;
    var totalTriangles = 0;

    var Vec3 = (typeof THREE !== 'undefined' && THREE.Vector3) ? THREE.Vector3 : null;

    meshes.forEach(function (mesh) {
      var geom = mesh.geometry;
      if (!geom || !geom.attributes || !geom.attributes.position) return;
      var posAttr = geom.attributes.position;
      if (posAttr.count < 3) return;

      var geomId = 'geom_' + geomCounter++;
      var meshName = mesh.name || (mesh.parent && mesh.parent.name) || ('Mesh_' + geomCounter);
      meshName = meshName.replace(/[^a-zA-Z0-9_\-]/g, '_');

      var mWorld = mesh.matrixWorld;
      var coords = [];
      var v = Vec3 ? new Vec3() : { x: 0, y: 0, z: 0 };

      for (var i = 0; i < posAttr.count; i++) {
        if (Vec3) {
          v.fromBufferAttribute(posAttr, i);
          if (mWorld) v.applyMatrix4(mWorld);
        } else {
          v.x = posAttr.getX ? posAttr.getX(i) : posAttr.array[i * 3];
          v.y = posAttr.getY ? posAttr.getY(i) : posAttr.array[i * 3 + 1];
          v.z = posAttr.getZ ? posAttr.getZ(i) : posAttr.array[i * 3 + 2];
        }
        coords.push(v.x.toFixed(2) + ' ' + v.y.toFixed(2) + ' ' + v.z.toFixed(2));
      }

      var indexAttr = geom.index;
      var indexList = [];
      var triCount = 0;

      if (indexAttr) {
        triCount = Math.floor(indexAttr.count / 3);
        for (var j = 0; j < indexAttr.count; j++) {
          indexList.push(indexAttr.getX ? indexAttr.getX(j) : indexAttr.array[j]);
        }
      } else {
        triCount = Math.floor(posAttr.count / 3);
        for (var k = 0; k < posAttr.count; k++) {
          indexList.push(k);
        }
      }
      totalTriangles += triCount;

      var matObj = mesh.userData._skpMat || { id: 'mat_default' };

      geomsXml.push([
        '    <geometry id="' + geomId + '" name="' + meshName + '">',
        '      <mesh>',
        '        <source id="' + geomId + '-positions">',
        '          <float_array id="' + geomId + '-positions-array" count="' + (posAttr.count * 3) + '">' + coords.join(' ') + '</float_array>',
        '          <technique_common>',
        '            <accessor source="#' + geomId + '-positions-array" count="' + posAttr.count + '" stride="3">',
        '              <param name="X" type="float"/>',
        '              <param name="Y" type="float"/>',
        '              <param name="Z" type="float"/>',
        '            </accessor>',
        '          </technique_common>',
        '        </source>',
        '        <vertices id="' + geomId + '-vertices">',
        '          <input semantic="POSITION" source="#' + geomId + '-positions"/>',
        '        </vertices>',
        '        <triangles count="' + triCount + '" material="' + matObj.id + '">',
        '          <input semantic="VERTEX" source="#' + geomId + '-vertices" offset="0"/>',
        '          <p>' + indexList.join(' ') + '</p>',
        '        </triangles>',
        '      </mesh>',
        '    </geometry>'
      ].join('\n'));

      nodesXml.push([
        '      <node id="node_' + geomId + '" name="' + meshName + '">',
        '        <instance_geometry url="#' + geomId + '">',
        '          <bind_material>',
        '            <technique_common>',
        '              <instance_material symbol="' + matObj.id + '" target="#' + matObj.id + '"/>',
        '            </technique_common>',
        '          </bind_material>',
        '        </instance_geometry>',
        '      </node>'
      ].join('\n'));
    });

    var now = new Date().toISOString();
    var xml = [
      '<?xml version="1.0" encoding="utf-8"?>',
      '<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">',
      '  <asset>',
      '    <contributor>',
      '      <author>Orbix Studio</author>',
      '      <authoring_tool>Orbix Studio 3D CAD to Trimble SketchUp Exporter</authoring_tool>',
      '    </contributor>',
      '    <created>' + now + '</created>',
      '    <modified>' + now + '</modified>',
      '    <unit name="millimeter" meter="0.001"/>',
      '    <up_axis>Y_UP</up_axis>',
      '  </asset>',
      '  <library_effects>',
      effectsXml.join('\n'),
      '  </library_effects>',
      '  <library_materials>',
      matsXml.join('\n'),
      '  </library_materials>',
      '  <library_geometries>',
      geomsXml.join('\n'),
      '  </library_geometries>',
      '  <library_visual_scenes>',
      '    <visual_scene id="Scene" name="' + safeTitle + '">',
      nodesXml.join('\n'),
      '    </visual_scene>',
      '  </library_visual_scenes>',
      '  <scene>',
      '    <instance_visual_scene url="#Scene"/>',
      '  </scene>',
      '</COLLADA>'
    ].join('\n');

    return {
      colladaXml: xml,
      filename: safeTitle + '-sketchup.dae',
      skpFilename: safeTitle + '.skp',
      stats: {
        title: title,
        walls: (project && project.plan && project.plan.walls ? project.plan.walls.length : 0),
        openings: (project && project.plan && project.plan.openings ? project.plan.openings.length : 0),
        furniture: (project && project.plan && project.plan.furniture ? project.plan.furniture.length : 0),
        rooms: (project && project.plan && project.plan.rooms ? project.plan.rooms.length : 0),
        meshCount: meshes.length,
        triangleCount: totalTriangles
      }
    };
  };

  // Static helper method
  ArchitecturalRenderer.exportSketchUp = function (project, scene, opts) {
    var renderer = new ArchitecturalRenderer(scene);
    return renderer.exportToSketchUpCollada(project, scene, opts);
  };

  return ArchitecturalRenderer;
});
