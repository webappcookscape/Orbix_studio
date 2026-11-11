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
    this.selectedFloorType = 'white_tile';
    this.isolatedRoomId = null;
    this.initMaterials();
  }

  // Procedural Canvas Floor Texture Generator (White Tile, Square Tile, Grey Tile, Wooden)
  ArchitecturalRenderer.createFloorTexture = function (type) {
    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    type = type || 'white_tile';

    if (type === 'white_tile') {
      // 800x800 Italian Carrara / Calacatta Polished Marble Slabs
      ctx.fillStyle = '#D6D6DE'; // Micro grout line
      ctx.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 2; i++) {
        for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          // Soft alabaster marble base
          var slabGrad = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
          slabGrad.addColorStop(0, '#FAF9FC');
          slabGrad.addColorStop(0.5, '#F4F4F8');
          slabGrad.addColorStop(1, '#EDECEF');
          ctx.fillStyle = slabGrad;
          ctx.fillRect(tx, ty, tw, th);

          // Subtle perimeter bevel highlight
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
          ctx.lineWidth = 1.5;
          ctx.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);

          // Primary soft slate-taupe marble veins
          ctx.strokeStyle = 'rgba(140, 148, 160, 0.28)';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(tx + 18, ty + 24);
          ctx.bezierCurveTo(tx + 90, ty + 85, tx + 130, ty + 160, tx + 235, ty + 225);
          ctx.stroke();

          // Vein branch
          ctx.strokeStyle = 'rgba(155, 162, 175, 0.20)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tx + 105, ty + 105);
          ctx.bezierCurveTo(tx + 160, ty + 95, tx + 195, ty + 130, tx + 240, ty + 145);
          ctx.stroke();

          // Secondary delicate gold/amber feathering
          ctx.strokeStyle = 'rgba(185, 155, 115, 0.16)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(tx + 190, ty + 35);
          ctx.bezierCurveTo(tx + 125, ty + 95, tx + 75, ty + 175, tx + 45, ty + 238);
          ctx.stroke();
        }
      }
    } else if (type === 'square_tile') {
      // 600x600 Premium Vitrified Travertine / Ivory Ceramic Tile
      ctx.fillStyle = '#C8BFB2'; // Warm sandstone grout
      ctx.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 2; i++) {
        for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          // Tile face with soft chamfered edge shading
          if (ctx.createRadialGradient) {
            var tileGrad = ctx.createRadialGradient(tx + 126, ty + 126, 40, tx + 126, ty + 126, 130);
            tileGrad.addColorStop(0, '#FAF7F2');
            tileGrad.addColorStop(0.85, '#EFEAE0');
            tileGrad.addColorStop(1, '#E4DDCF');
            ctx.fillStyle = tileGrad;
          } else {
            ctx.fillStyle = '#EFEAE0';
          }
          ctx.fillRect(tx, ty, tw, th);

          // Subtle top/left bevel highlight
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);

          // Micro travertine specks
          for (var s = 0; s < 120; s++) {
            var rx = (Math.sin(s * 19.1 + i * 7) * 0.5 + 0.5) * (tw - 8);
            var ry = (Math.cos(s * 29.3 + j * 11) * 0.5 + 0.5) * (th - 8);
            ctx.fillStyle = (s % 2 === 0) ? 'rgba(0,0,0,0.025)' : 'rgba(255,255,255,0.06)';
            ctx.fillRect(tx + 4 + rx, ty + 4 + ry, 2, 2);
          }
        }
      }
    } else if (type === 'grey_tile') {
      // 600x1200 Contemporary Basalt / Charcoal Slate Slabs
      ctx.fillStyle = '#222428'; // Deep precision grout
      ctx.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 2; i++) {
        for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          var slateGrad = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
          slateGrad.addColorStop(0, (i + j) % 2 ? '#484C55' : '#3E424B');
          slateGrad.addColorStop(1, (i + j) % 2 ? '#3A3E47' : '#343841');
          ctx.fillStyle = slateGrad;
          ctx.fillRect(tx, ty, tw, th);

          // Fine slate cleft grain
          for (var sl = 0; sl < 16; sl++) {
            var yS = ty + 12 + sl * 15;
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.moveTo(tx + 4, yS);
            ctx.lineTo(tx + tw - 4, yS + (Math.sin(sl + i) * 3));
            ctx.stroke();
          }

          // Subtle edge bevel
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);
        }
      }
    } else if (type === 'wooden') {
      // Warm Natural European Oak Parquet Planks
      ctx.fillStyle = '#442D19'; // Deep V-groove micro-bevel between planks
      ctx.fillRect(0, 0, 512, 512);
      var plankH = 64;
      var oakTones = ['#C29F74', '#B69165', '#CBAB82', '#AA855A', '#BE9B70', '#B18B5F', '#C6A57B', '#A58055'];
      for (var p = 0; p < 8; p++) {
        var py = p * plankH + 1;
        var pHeight = plankH - 2;
        var baseWood = oakTones[p % oakTones.length];
        var pGrad = ctx.createLinearGradient(0, py, 512, py + pHeight);
        pGrad.addColorStop(0, baseWood);
        pGrad.addColorStop(0.5, oakTones[(p + 2) % oakTones.length]);
        pGrad.addColorStop(1, baseWood);
        ctx.fillStyle = pGrad;
        ctx.fillRect(2, py, 508, pHeight);

        // Natural flowing wood grain & growth pores
        for (var g = 0; g < 15; g++) {
          var yG = py + 3 + g * 4;
          ctx.strokeStyle = (g % 2 === 0) ? 'rgba(65, 38, 14, 0.16)' : 'rgba(160, 115, 65, 0.18)';
          ctx.lineWidth = (g % 3 === 0) ? 1.6 : 0.9;
          ctx.beginPath();
          ctx.moveTo(2, yG);
          ctx.bezierCurveTo(140, yG + Math.sin(p * 1.5 + g) * 3.5, 340, yG - Math.cos(p + g * 1.2) * 3.5, 510, yG);
          ctx.stroke();
        }

        // Top edge bevel highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 0.8;
        ctx.beginPath();
        ctx.moveTo(2, py + 1);
        ctx.lineTo(510, py + 1);
        ctx.stroke();
      }
    }

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.encoding = THREE.sRGBEncoding;
    return tex;
  };

  ArchitecturalRenderer.createWallBumpTexture = function () {
    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    // Micro stipple eggshell plaster bump
    for (var i = 0; i < 4000; i++) {
      var rx = Math.random() * 256;
      var ry = Math.random() * 256;
      var bright = Math.random() < 0.5;
      ctx.fillStyle = bright ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)';
      ctx.fillRect(rx, ry, 1.5, 1.5);
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(12, 12);
    return tex;
  };

  ArchitecturalRenderer.cleanPolygon = function (pts) {
    if (!pts || !Array.isArray(pts) || pts.length < 3) return [];
    var res = [];
    for (var i = 0; i < pts.length; i++) {
      if (pts[i] && typeof pts[i].x === 'number' && typeof pts[i].y === 'number') {
        res.push({ x: Math.round(pts[i].x * 10) / 10, y: Math.round(pts[i].y * 10) / 10 });
      }
    }
    if (res.length < 3) return [];

    var globalChanged = true;
    var passes = 0;
    while (globalChanged && passes++ < 12 && res.length >= 3) {
      globalChanged = false;

      // 1. Remove consecutive duplicates (< 20mm)
      var n1 = res.length;
      var next1 = [];
      for (var i = 0; i < n1; i++) {
        var p = res[i];
        var pNext = res[(i + 1) % n1];
        if (Math.hypot(p.x - pNext.x, p.y - pNext.y) < 20) {
          globalChanged = true;
          continue;
        }
        next1.push(p);
      }
      res = next1;
      if (res.length < 3) break;

      // 2. Remove spikes (A -> B -> A or acute turnarounds where dot product < -0.998)
      // Guard: NEVER remove vertices from a 3-vertex triangle (preserves all triangular & slender rooms)
      if (res.length > 3) {
        var n2 = res.length;
        var spikeFound = false;
        for (var i = 0; i < n2; i++) {
          var prev = res[(i - 1 + n2) % n2];
          var curr = res[i];
          var next = res[(i + 1) % n2];
          var d = Math.hypot(prev.x - next.x, prev.y - next.y);
          if (d < 30) {
            res.splice(i, 1);
            globalChanged = true;
            spikeFound = true;
            break;
          }
          var v1x = curr.x - prev.x, v1y = curr.y - prev.y;
          var v2x = next.x - curr.x, v2y = next.y - curr.y;
          var l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
          if (l1 > 10 && l2 > 10) {
            var dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
            if (dot < -0.998) {
              res.splice(i, 1);
              globalChanged = true;
              spikeFound = true;
              break;
            }
          }
        }
        if (spikeFound) continue;
      }

      // 3. Remove collinear points along straight lines (sin(theta) < 0.02 and dot > 0)
      // Guard: only prune collinear if remaining vertices >= 3
      var n3 = res.length;
      var next3 = [];
      for (var i = 0; i < n3; i++) {
        var prev = res[(i - 1 + n3) % n3];
        var curr = res[i];
        var nextP = res[(i + 1) % n3];
        var v1x = curr.x - prev.x, v1y = curr.y - prev.y;
        var v2x = nextP.x - curr.x, v2y = nextP.y - curr.y;
        var cross = v1x * v2y - v1y * v2x;
        var dot = v1x * v2x + v1y * v2y;
        var l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
        var sinTheta = Math.abs(cross) / (l1 * l2 + 1e-9);
        if (sinTheta < 0.02 && dot > 0 && (n3 - (n3 - next3.length)) > 3) {
          globalChanged = true;
          continue;
        }
        next3.push(curr);
      }
      if (next3.length >= 3) res = next3;
    }
    return res.length >= 3 ? res : [];
  };

  ArchitecturalRenderer.prototype.createFloorMaterial = function (type) {
    if (typeof THREE === 'undefined') return null;
    if (type === 'neutral_ground' || type === 'grass') {
      return new THREE.MeshStandardMaterial({
        color: 0x4E8A42, // Lush grass green
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
    }
    type = type || this.selectedFloorType || 'white_tile';
    var tex = ArchitecturalRenderer.createFloorTexture(type);
    var isWood = (type === 'wooden');
    var isWhite = (type === 'white_tile');

    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: isWhite ? 0.12 : (isWood ? 0.34 : 0.28),
      metalness: isWhite ? 0.04 : (isWood ? 0.01 : 0.02),
      side: THREE.DoubleSide
    });
  };

  // Helper: Retrieve Base Hex Color for any Floor Tile Finish
  ArchitecturalRenderer.getFloorTileColor = function (type) {
    if (type === 'square_tile') return 0xDFD7CA; // Warm travertine ivory
    if (type === 'grey_tile') return 0x3E424B;   // Charcoal basalt slate
    if (type === 'wooden') return 0xB38256;      // Warm oak hardwood
    return 0xEDECEF;                             // White Calacatta marble tile (default)
  };

  ArchitecturalRenderer.prototype.setFloorMaterial = function (type, targetRoomId) {
    this.selectedFloorType = type || 'white_tile';
    this.materials.floorTile = this.createFloorMaterial(this.selectedFloorType);
    this.materials.floorWood = (this.selectedFloorType === 'wooden' ? this.materials.floorTile : this.createFloorMaterial('wooden'));

    // Dynamic Skirting color update to match current floor tile
    var skirtingTileColor = ArchitecturalRenderer.getFloorTileColor(this.selectedFloorType);
    if (this.materials.skirting && this.materials.skirting.color && typeof this.materials.skirting.color.setHex === 'function') {
      this.materials.skirting.color.setHex(skirtingTileColor);
      this.materials.skirting.needsUpdate = true;
    }

    if (this.group) {
      var self = this;
      var tileSize = (this.selectedFloorType === 'wooden') ? 1200 : (this.selectedFloorType === 'white_tile' ? 1600 : 1200);
      this.group.traverse(function (o) {
        if (o.userData && o.userData.isFloorMesh) {
          // If targetRoomId is specified, update ONLY that specific room's floor mesh within its walls!
          if (targetRoomId && o.userData.roomId !== targetRoomId) {
            return;
          }
          // Never apply interior floor tile texture outside walls (bounding_floor remains neutral)
          if (o.userData.roomId === 'bounding_floor') {
            return;
          }
          o.userData.floorFinish = self.selectedFloorType;
          o.material = self.createFloorMaterial(self.selectedFloorType);
          if (o.geometry && o.geometry.attributes && o.geometry.attributes.position && o.geometry.attributes.uv) {
            var posAttr = o.geometry.attributes.position;
            var uvAttr = o.geometry.attributes.uv;
            for (var v = 0; v < posAttr.count; v++) {
              var vx = posAttr.getX(v);
              var vy = posAttr.getY(v);
              uvAttr.setXY(v, vx / tileSize, -vy / tileSize);
            }
            uvAttr.needsUpdate = true;
          }
        }
      });
    }
  };

  ArchitecturalRenderer.prototype.initMaterials = function () {
    if (typeof THREE === 'undefined') return;

    var wallBump = ArchitecturalRenderer.createWallBumpTexture();
    // Wall Plaster (Natural warm earthy mud plaster - deeper and richer than light beige)
    this.materials.wall = new THREE.MeshStandardMaterial({
      color: 0x9E836A, // Natural warm mud plaster
      roughness: 0.92,
      metalness: 0.01,
      bumpMap: wallBump,
      bumpScale: 0.08
    });

    // Wall Core (Cutaway section interior)
    this.materials.wallCore = new THREE.MeshStandardMaterial({
      color: 0x886F58, // Rich earthy mud core
      roughness: 0.9,
      metalness: 0.0
    });

    // Skirting Board (Architectural Baseboards matching Floor Tile Color)
    this.selectedFloorType = this.selectedFloorType || 'white_tile';
    var skirtingTileColor = ArchitecturalRenderer.getFloorTileColor(this.selectedFloorType);
    this.materials.skirting = new THREE.MeshStandardMaterial({
      color: skirtingTileColor,
      roughness: 0.25,
      metalness: 0.02
    });

    // Floor Finishes: Architectural Procedural PBR (Default: White Tile)
    this.selectedFloorType = this.selectedFloorType || 'white_tile';
    this.materials.floorTile = this.createFloorMaterial(this.selectedFloorType);
    this.materials.floorWood = this.createFloorMaterial('wooden');

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
  ArchitecturalRenderer.prototype.buildHome = function (project, isolatedRoomId) {
    if (!this.scene || typeof THREE === 'undefined') return null;

    if (isolatedRoomId !== undefined) {
      this.isolatedRoomId = (isolatedRoomId === 'all' || !isolatedRoomId) ? null : isolatedRoomId;
    }
    var targetIsoId = this.isolatedRoomId;

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
    this.currentProject = project;
    this.currentPlan = plan;
    var walls = plan.walls || [];
    var openings = plan.openings || [];
    var rooms = plan.rooms || [];
    var furniture = plan.furniture || [];

    // Room Isolation Mode: select a particular room and view that room only!
    var targetRoom = null;
    if (targetIsoId) {
      targetRoom = rooms.find(function (r) { return r.id === targetIsoId; });
    }

    if (targetRoom && targetRoom.polygon && targetRoom.polygon.length >= 3) {
      // 1. Isolate room floor
      rooms = [targetRoom];

      // 2. Isolate perimeter walls of that room
      var roomPoly = targetRoom.polygon;
      walls = walls.filter(function (w) {
        var midW = { x: (w.start.x + w.end.x) / 2, y: (w.start.y + w.end.y) / 2 };
        for (var pi = 0; pi < roomPoly.length; pi++) {
          var pA = roomPoly[pi];
          var pB = roomPoly[(pi + 1) % roomPoly.length];
          var segDx = pB.x - pA.x, segDy = pB.y - pA.y;
          var segLen = Math.hypot(segDx, segDy);
          if (segLen < 1) continue;
          var t = Math.max(0, Math.min(1, ((midW.x - pA.x) * segDx + (midW.y - pA.y) * segDy) / (segLen * segLen)));
          var projX = pA.x + t * segDx, projY = pA.y + t * segDy;
          if (Math.hypot(midW.x - projX, midW.y - projY) < 120) return true;
        }
        return false;
      });

      // 3. Isolate furniture inside target room
      furniture = furniture.filter(function (f) {
        if (f.roomId === targetRoom.id) return true;
        if (f.pos && Core.Vec2.pointInPolygon(f.pos, roomPoly)) return true;
        return false;
      });
    }

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
    if (rooms && rooms.length > 0) {
      for (var r = 0; r < rooms.length; r++) {
        var room = rooms[r];
        var floorMesh = this.buildRoomFloor(room);
        if (floorMesh) this.group.add(floorMesh);
      }
    } else {
      var fallbackFloor = this.buildBoundingFloor(walls, furniture);
      if (fallbackFloor) this.group.add(fallbackFloor);
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
     Build Architectural Room Divider Threshold (Floor Transition Strip)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildDividerThreshold = function (wall) {
    if (!wall || !wall.start || !wall.end || typeof THREE === 'undefined') return null;
    var wLen = Core.wallLength(wall);
    if (!wLen || wLen < 50 || wLen > 15000) return null; // Clamped to valid architectural span
    var angle = Core.wallAngle(wall);
    var start = wall.start;

    var group = new THREE.Group();
    group.name = 'DividerThreshold_' + wall.id;

    // Brass / Architectural Champagne Metal transition strip
    var stripW = 30; // 30mm width
    var stripH = 4;  // 4mm height flush above floor
    var geo = new THREE.BoxGeometry(wLen, stripH, stripW);
    var mat = new THREE.MeshStandardMaterial({
      color: 0xD4AF37, // Polished architectural warm brass
      metalness: 0.85,
      roughness: 0.3
    });
    var stripMesh = new THREE.Mesh(geo, mat);
    stripMesh.position.set(wLen / 2, stripH / 2 + 1, 0);
    stripMesh.receiveShadow = true;
    group.add(stripMesh);

    group.position.set(start.x, 0, start.y);
    group.rotation.y = -angle;
    group.userData = {
      isDivider: true,
      wallId: wall.id
    };
    return group;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build 3D Wall with Real Openings (Subdivided Blocks)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildWallWithCutouts = function (wall, ops) {
    if (wall && wall.isDivider) {
      // Guard: Only render 3D threshold strip if divider is a valid room boundary or connected at both ends
      var planObj = this.currentPlan || (this.currentProject && this.currentProject.plan);
      var pRooms = (planObj && planObj.rooms) || [];
      var isUsedInRoom = false;
      for (var ri = 0; ri < pRooms.length; ri++) {
        if (pRooms[ri].wallIds && pRooms[ri].wallIds.indexOf(wall.id) !== -1) {
          isUsedInRoom = true;
          break;
        }
      }
      var allW = (planObj && planObj.walls) || [];
      var startConn = false, endConn = false;
      for (var wi = 0; wi < allW.length; wi++) {
        var ow = allW[wi];
        if (ow.id === wall.id) continue;
        if (!startConn && Core.projectPointOnSegment(wall.start, ow.start, ow.end).dist <= 150) startConn = true;
        if (!endConn && Core.projectPointOnSegment(wall.end, ow.start, ow.end).dist <= 150) endConn = true;
      }
      if (!isUsedInRoom && (!startConn || !endConn)) {
        return null; // Suppress dangling / orphan divider in 3D!
      }
      return this.buildDividerThreshold(wall);
    }

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

    var self = this;
    function addSkirting(startX, len) {
      if (!self.materials.skirting || len < 40) return;
      var skH = 75, skT = 12;
      var skGeo = new THREE.BoxGeometry(len, skH, skT);
      var skF = new THREE.Mesh(skGeo, self.materials.skirting);
      skF.position.set(startX + len / 2, skH / 2, wThick / 2 + skT / 2);
      skF.receiveShadow = true;
      group.add(skF);
      var skB = new THREE.Mesh(skGeo, self.materials.skirting);
      skB.position.set(startX + len / 2, skH / 2, -wThick / 2 - skT / 2);
      skB.receiveShadow = true;
      group.add(skB);
    }

    if (validOps.length === 0) {
      // Solid Wall: Single extruded box
      var geo = new THREE.BoxGeometry(wLen, wHeight, wThick);
      var mesh = new THREE.Mesh(geo, this.materials.wall);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(wLen / 2, wHeight / 2, 0);
      group.add(mesh);
      addSkirting(0, wLen);
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
          addSkirting(currX, segW);
        }

        // 2. Below window sill segment (if window with sillHeight > 0)
        if (sillH > 0) {
          var sillGeo = new THREE.BoxGeometry(opWidth, sillH, wThick);
          var sillMesh = new THREE.Mesh(sillGeo, this.materials.wall);
          sillMesh.position.set(opStart + opWidth / 2, sillH / 2, 0);
          sillMesh.castShadow = true;
          sillMesh.receiveShadow = true;
          group.add(sillMesh);
          addSkirting(opStart, opWidth);
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
        addSkirting(currX, lastW);
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
    if (!room || !room.polygon || room.polygon.length < 3) return null;

    var cleaner = (typeof Core !== 'undefined' && Core.cleanPolygon) || ArchitecturalRenderer.cleanPolygon;
    var poly = cleaner ? cleaner(room.polygon) : room.polygon;
    if (!poly || poly.length < 3) {
      if (room.polygon && room.polygon.length >= 3) {
        poly = room.polygon.filter(function (pt) { return pt && isFinite(pt.x) && isFinite(pt.y); });
      }
    }
    if (!poly || poly.length < 3) return null;
    for (var p = 0; p < poly.length; p++) {
      if (!poly[p] || !isFinite(poly[p].x) || !isFinite(poly[p].y)) return null;
    }

    // Check signed area in shape coordinates (x, -y).
    // In Three.js, ShapeGeometry triangulates using Earcut.
    // Shape coordinates (x, -y) rotated by -Math.PI/2 around X
    // yield 3D (x, 0, y) with normal facing UP (+Y) when shape is CCW in shape space.
    var shapeArea = 0;
    var n = poly.length;
    for (var i = 0; i < n; i++) {
      var j = (i + 1) % n;
      shapeArea += poly[i].x * (-poly[j].y) - poly[j].x * (-poly[i].y);
    }
    shapeArea = shapeArea / 2;
    if (Math.abs(shapeArea) < 100000) return null; // Ignore degenerate/tiny loops (< 0.1 m²)

    // If clockwise in shape space, reverse points so Earcut gets standard CCW
    var orderedPts = poly.slice();
    if (shapeArea < 0) {
      orderedPts.reverse();
    }

    var shape = new THREE.Shape();
    shape.moveTo(orderedPts[0].x, -orderedPts[0].y);
    for (var i = 1; i < orderedPts.length; i++) {
      shape.lineTo(orderedPts[i].x, -orderedPts[i].y);
    }
    shape.closePath();

    var geo = null;
    try {
      geo = new THREE.ShapeGeometry(shape);
    } catch (e) {
      console.warn('[Orbix 3D] ShapeGeometry failed, skipping degenerate floor:', e);
      return null;
    }

    if (!geo || !geo.attributes || !geo.attributes.position || geo.attributes.position.count < 3) {
      return null;
    }

    // Validate vertex bounding box against polygon bounding box:
    // If any vertex was thrown thousands of millimeters outside the polygon due to triangulation failure, reject
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var p = 0; p < orderedPts.length; p++) {
      var pt = orderedPts[p];
      if (pt.x < minX) minX = pt.x;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.y > maxY) maxY = pt.y;
    }
    var posAttr = geo.attributes.position;
    var maxSpan = Math.max(maxX - minX, maxY - minY) * 2 + 1000; // mm safe envelope
    var hasWildVertex = false;
    for (var v = 0; v < posAttr.count; v++) {
      var vx = posAttr.getX(v);
      var vy = posAttr.getY(v);
      if (!isFinite(vx) || !isFinite(vy) ||
          vx < minX - maxSpan || vx > maxX + maxSpan ||
          -vy < minY - maxSpan || -vy > maxY + maxSpan) {
        hasWildVertex = true;
        break;
      }
    }
    if (hasWildVertex) {
      console.warn('[Orbix 3D] Degenerate floor triangulation detected outside room bounds; skipping floor mesh');
      return null;
    }

    var finishType = this.selectedFloorType || 'white_tile';
    if (room.floorFinish) {
      if (room.floorFinish === 'wood') finishType = 'wooden';
      else if (room.floorFinish === 'marble') finishType = 'white_tile';
      else if (room.floorFinish === 'tile') finishType = 'square_tile';
      else if (room.floorFinish === 'concrete') finishType = 'grey_tile';
      else finishType = room.floorFinish;
    } else if (room.type === 'bedroom' && this.selectedFloorType === 'white_tile') {
      finishType = 'wooden';
    }

    // Physical millimeter UV mapping so tile sizes are authentic and scale-consistent
    var tileSize = (finishType === 'wooden') ? 1200 : (finishType === 'white_tile' ? 1600 : 1200);
    if (geo.attributes && geo.attributes.uv) {
      var uvAttr = geo.attributes.uv;
      for (var v = 0; v < posAttr.count; v++) {
        var vx = posAttr.getX(v);
        var vy = posAttr.getY(v);
        uvAttr.setXY(v, vx / tileSize, -vy / tileSize);
      }
      uvAttr.needsUpdate = true;
    }
    if (typeof geo.computeVertexNormals === 'function') {
      geo.computeVertexNormals();
    }

    var mat = this.createFloorMaterial(finishType);
    var mesh = new THREE.Mesh(geo, mat);

    // Rotate flat into X-Z floor plane with normal facing straight UP (+Y)
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.y = 1; // 1mm above base level to prevent Z-fighting
    mesh.receiveShadow = true;
    mesh.name = 'Floor_' + (room.name || 'Room');
    mesh.userData = { isFloorMesh: true, floorFinish: finishType, roomId: room.id };

    return mesh;
  };

  ArchitecturalRenderer.prototype.buildBoundingFloor = function (walls, furniture) {
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    if (walls && walls.length > 0) {
      for (var w = 0; w < walls.length; w++) {
        var wl = walls[w];
        if (wl.start) { minX = Math.min(minX, wl.start.x); maxX = Math.max(maxX, wl.start.x); minY = Math.min(minY, wl.start.y); maxY = Math.max(maxY, wl.start.y); }
        if (wl.end) { minX = Math.min(minX, wl.end.x); maxX = Math.max(maxX, wl.end.x); minY = Math.min(minY, wl.end.y); maxY = Math.max(maxY, wl.end.y); }
      }
    }
    if (furniture && furniture.length > 0) {
      for (var f = 0; f < furniture.length; f++) {
        var fn = furniture[f];
        if (fn.pos) { minX = Math.min(minX, fn.pos.x - 600); maxX = Math.max(maxX, fn.pos.x + 600); minY = Math.min(minY, fn.pos.y - 600); maxY = Math.max(maxY, fn.pos.y + 600); }
      }
    }
    if (!isFinite(minX) || !isFinite(maxX)) return null;
    // Bounded strictly to walls (no padding outside walls) with neutral ground finish
    var dummyRoom = {
      id: 'bounding_floor',
      name: 'General Floor',
      floorFinish: 'grass',
      polygon: [
        { x: minX, y: minY },
        { x: maxX, y: minY },
        { x: maxX, y: maxY },
        { x: minX, y: maxY }
      ]
    };
    return this.buildRoomFloor(dummyRoom);
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Color & Finish Resolvers & Handle Generators
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.resolveFinishColor = function (codeOrName, defaultColor) {
    if (codeOrName === undefined || codeOrName === null || codeOrName === '') return defaultColor || 0xEDEBE4;
    if (typeof codeOrName === 'number') return codeOrName;

    var str = String(codeOrName).trim();
    if (str.startsWith('#')) {
      return parseInt(str.slice(1), 16) || defaultColor || 0xEDEBE4;
    }
    if (str.startsWith('0x')) {
      return parseInt(str.slice(2), 16) || defaultColor || 0xEDEBE4;
    }

    if (typeof window !== 'undefined' && Array.isArray(window.LAMINATES)) {
      var l = window.LAMINATES.find(function (item) {
        return item.code === str || (item.name && item.name.toLowerCase() === str.toLowerCase());
      });
      if (l && l.hex) {
        return parseInt(l.hex.replace('#', ''), 16);
      }
    }

    var lower = str.toLowerCase();
    if (lower.indexOf('1135') !== -1 || lower.indexOf('white') !== -1 || lower.indexOf('bwp') !== -1 || lower.indexOf('frost') !== -1) return 0xEDEBE4;
    if (lower.indexOf('3410') !== -1 || lower.indexOf('walnut') !== -1) return 0x6E4E35;
    if (lower.indexOf('3411') !== -1 || lower.indexOf('wenge') !== -1) return 0x4A3A2E;
    if (lower.indexOf('1101') !== -1 || lower.indexOf('ivory') !== -1 || lower.indexOf('cream') !== -1) return 0xE4DCC8;
    if (lower.indexOf('2204') !== -1 || lower.indexOf('oak') !== -1) return 0xC4A173;
    if (lower.indexOf('2210') !== -1 || lower.indexOf('teak') !== -1) return 0xA9743F;
    if (lower.indexOf('4402') !== -1 || lower.indexOf('grey oak') !== -1) return 0x9C9891;
    if (lower.indexOf('5501') !== -1 || lower.indexOf('graphite') !== -1) return 0x585B5E;
    if (lower.indexOf('6601') !== -1 || lower.indexOf('gloss white') !== -1) return 0xF4F3EF;
    if (lower.indexOf('6620') !== -1 || lower.indexOf('gloss grey') !== -1) return 0x8D9296;
    if (lower.indexOf('6630') !== -1 || lower.indexOf('gloss red') !== -1) return 0xB2231F;
    if (lower.indexOf('6640') !== -1 || lower.indexOf('gloss black') !== -1) return 0x1C1C1E;
    if (lower.indexOf('7701') !== -1 || lower.indexOf('sage') !== -1) return 0x8E9C86;
    if (lower.indexOf('7702') !== -1 || lower.indexOf('charcoal') !== -1) return 0x3B3D40;
    if (lower.indexOf('7703') !== -1 || lower.indexOf('sand') !== -1 || lower.indexOf('beige') !== -1) return 0xD3C4A9;
    if (lower.indexOf('7704') !== -1 || lower.indexOf('taupe') !== -1) return 0x9A9188;
    if (lower.indexOf('7706') !== -1 || lower.indexOf('coffee') !== -1 || lower.indexOf('brown') !== -1) return 0x5A4232;
    if (lower.indexOf('7707') !== -1 || lower.indexOf('navy') !== -1 || lower.indexOf('blue') !== -1) return 0x2E3F5C;
    if (lower.indexOf('7708') !== -1 || lower.indexOf('terracotta') !== -1) return 0xB5654A;
    if (lower.indexOf('7709') !== -1 || lower.indexOf('olive') !== -1) return 0x6B6E45;
    if (lower.indexOf('8801') !== -1 || lower.indexOf('concrete') !== -1) return 0xA8A5A0;
    if (lower.indexOf('7710') !== -1 || lower.indexOf('powder blue') !== -1) return 0xA9BED2;
    if (lower.indexOf('7711') !== -1 || lower.indexOf('blush') !== -1) return 0xD9B4A6;
    if (lower.indexOf('grey') !== -1 || lower.indexOf('gray') !== -1) return 0x8D9296;
    if (lower.indexOf('black') !== -1) return 0x1A1A1A;

    return defaultColor || 0xEDEBE4;
  };

  ArchitecturalRenderer.getHandleMaterial = function (hFinish) {
    var fin = String(hFinish || 'black').toLowerCase();
    if (fin.indexOf('chrome') !== -1) {
      return new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.1, metalness: 0.95 });
    }
    if (fin.indexOf('nickel') !== -1 || fin.indexOf('silver') !== -1 || fin.indexOf('steel') !== -1 || fin.indexOf('stainless') !== -1 || fin === 'ss') {
      return new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.35, metalness: 0.85 });
    }
    if (fin.indexOf('brass') !== -1 || fin.indexOf('gold') !== -1 || fin.indexOf('champagne') !== -1) {
      return new THREE.MeshStandardMaterial({ color: 0xD4AF37, roughness: 0.25, metalness: 0.9 });
    }
    if (fin.indexOf('rose') !== -1 || fin.indexOf('copper') !== -1) {
      return new THREE.MeshStandardMaterial({ color: 0xB76E79, roughness: 0.25, metalness: 0.9 });
    }
    // Default: Matte Black
    return new THREE.MeshStandardMaterial({ color: 0x1A1A1A, roughness: 0.4, metalness: 0.7 });
  };

  ArchitecturalRenderer.createHandleMesh = function (handleType, handleMat, isVertical, maxLen) {
    var ht = String(handleType || 'bar').toLowerCase();
    if (ht === 'none' || ht === 'handleless' || ht === 'push' || ht === 'touch') {
      return null;
    }

    var hGroup = new THREE.Group();
    var len = Math.min(maxLen || 160, 220);

    if (ht === 'knob') {
      var knobGeo = new THREE.CylinderGeometry(12, 10, 16, 16);
      var knobMesh = new THREE.Mesh(knobGeo, handleMat);
      knobMesh.rotation.x = Math.PI / 2;
      knobMesh.position.z = 8;
      knobMesh.castShadow = true;
      hGroup.add(knobMesh);

      var stemGeo = new THREE.CylinderGeometry(4.5, 4.5, 8, 12);
      var stemMesh = new THREE.Mesh(stemGeo, handleMat);
      stemMesh.rotation.x = Math.PI / 2;
      stemMesh.position.z = 2;
      hGroup.add(stemMesh);
    } else if (ht === 'tbar') {
      var barGeo = new THREE.CylinderGeometry(5.5, 5.5, 50, 12);
      var barMesh = new THREE.Mesh(barGeo, handleMat);
      if (!isVertical) barMesh.rotation.z = Math.PI / 2;
      barMesh.position.z = 15;
      barMesh.castShadow = true;
      hGroup.add(barMesh);

      var stemGeo2 = new THREE.CylinderGeometry(4.5, 4.5, 14, 12);
      var stemMesh2 = new THREE.Mesh(stemGeo2, handleMat);
      stemMesh2.rotation.x = Math.PI / 2;
      stemMesh2.position.z = 7;
      hGroup.add(stemMesh2);
    } else if (ht === 'edge') {
      var ew = isVertical ? 10 : len;
      var eh = isVertical ? len : 8;
      var edgeGeo = new THREE.BoxGeometry(ew, eh, 22);
      var edgeMesh = new THREE.Mesh(edgeGeo, handleMat);
      edgeMesh.position.z = 4;
      edgeMesh.castShadow = true;
      hGroup.add(edgeMesh);
    } else if (ht === 'gprof' || ht === 'jprof' || ht === 'gola' || ht === 'profile') {
      var pw = isVertical ? 8 : (len * 1.5);
      var ph = isVertical ? (len * 1.5) : 8;
      var profGeo = new THREE.BoxGeometry(pw, ph, 14);
      var profMesh = new THREE.Mesh(profGeo, handleMat);
      profMesh.position.z = 2;
      hGroup.add(profMesh);
    } else if (ht === 'cup') {
      var cupGeo = new THREE.CylinderGeometry(18, 18, 12, 16, 1, false, 0, Math.PI);
      var cupMesh = new THREE.Mesh(cupGeo, handleMat);
      cupMesh.rotation.x = Math.PI / 2;
      cupMesh.position.z = 8;
      cupMesh.castShadow = true;
      hGroup.add(cupMesh);
    } else {
      // Standard Bar Pull / IBH
      var bw = isVertical ? 12 : len;
      var bh = isVertical ? len : 12;
      var mainBarGeo = new THREE.BoxGeometry(bw, bh, 12);
      var mainBarMesh = new THREE.Mesh(mainBarGeo, handleMat);
      mainBarMesh.position.z = 14;
      mainBarMesh.castShadow = true;
      hGroup.add(mainBarMesh);

      var footGeo = new THREE.CylinderGeometry(4, 4, 12, 10);
      var foot1 = new THREE.Mesh(footGeo, handleMat);
      foot1.rotation.x = Math.PI / 2;
      var foot2 = new THREE.Mesh(footGeo, handleMat);
      foot2.rotation.x = Math.PI / 2;

      if (isVertical) {
        foot1.position.set(0, len * 0.38, 6);
        foot2.position.set(0, -len * 0.38, 6);
      } else {
        foot1.position.set(len * 0.38, 0, 6);
        foot2.position.set(-len * 0.38, 0, 6);
      }
      hGroup.add(foot1);
      hGroup.add(foot2);
    }

    return hGroup;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Decor & Appliance Mesh (Excluded from Pricing)
     Supports Fridge, Ice Box / Chiller, Plants, Microwave, Chimney, TV, Sofa, etc.
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildDecorMesh = function (furn, fg, dims) {
    var cat = (furn.category || 'decor').toLowerCase();
    var name = (furn.name || '').toLowerCase();
    var decorType = furn.decorType || (
      (name.indexOf('sink') !== -1) ? 'sink' :
      (name.indexOf('hob') !== -1 || name.indexOf('stove') !== -1 || name.indexOf('burner') !== -1 || name.indexOf('cooktop') !== -1 || name.indexOf('component_2') !== -1) ? 'gas_hob' :
      (name.indexOf('dish') !== -1) ? 'dishwasher' :
      (name.indexOf('washing') !== -1 || name.indexOf('aeg') !== -1 || name.indexOf('laundry') !== -1) ? 'washing_machine' :
      (name.indexOf('kent') !== -1 || name.indexOf('ro') !== -1 || name.indexOf('purifier') !== -1 || name.indexOf('water') !== -1) ? 'ro_purifier' :
      (name.indexOf('dining') !== -1 || name.indexOf('1ewt') !== -1 || (name.indexOf('table') !== -1 && name.indexOf('top') === -1)) ? 'dining_table' :
      (name.indexOf('fridge') !== -1 || name.indexOf('refrigerator') !== -1) ? 'fridge' :
      (name.indexOf('ice') !== -1 || name.indexOf('chiller') !== -1 || name.indexOf('side box') !== -1 || name.indexOf('wine') !== -1) ? 'ice_box' :
      (name.indexOf('plant') !== -1 || name.indexOf('pot') !== -1 || name.indexOf('tree') !== -1) ? 'plant' :
      (name.indexOf('microwave') !== -1 || name.indexOf('oven') !== -1) ? 'microwave' :
      (name.indexOf('chimney') !== -1 || name.indexOf('hood') !== -1) ? 'chimney' :
      (name.indexOf('tv') !== -1) ? 'tv' :
      (name.indexOf('sofa') !== -1 || name.indexOf('couch') !== -1) ? 'sofa' : 'general'
    );

    var defDecorElev = (decorType === 'chimney' || decorType === 'hood') ? 1500 :
      (decorType === 'ro_purifier') ? 1200 :
      (decorType === 'microwave') ? 1200 :
      (decorType === 'sink' || decorType === 'gas_hob') ? 850 : 0;
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) : defDecorElev);

    var W = dims.W, H = dims.H, D = dims.D;

    if (decorType === 'fridge') {
      var steelMat = new THREE.MeshStandardMaterial({ color: 0xD4D8DD, metalness: 0.85, roughness: 0.25 });
      var darkSteelMat = new THREE.MeshStandardMaterial({ color: 0x24272C, metalness: 0.8, roughness: 0.35 });
      var ledMat = new THREE.MeshStandardMaterial({ color: 0x00E5FF, emissive: 0x00B0FF, emissiveIntensity: 0.8 });

      var bodyGeo = new THREE.BoxGeometry(W, H - 40, D - 30);
      var bodyMesh = new THREE.Mesh(bodyGeo, steelMat);
      bodyMesh.position.set(0, (H - 40) / 2 + 30, -15);
      bodyMesh.castShadow = true; bodyMesh.receiveShadow = true;
      fg.add(bodyMesh);

      var plinthGeo = new THREE.BoxGeometry(W - 20, 30, D - 40);
      var plinthMesh = new THREE.Mesh(plinthGeo, darkSteelMat);
      plinthMesh.position.set(0, 15, -15);
      fg.add(plinthMesh);

      if (W >= 750) {
        var doorW = (W - 6) / 2;
        var doorH = H - 50;
        var lDoorGeo = new THREE.BoxGeometry(doorW, doorH, 28);
        var rDoorGeo = new THREE.BoxGeometry(doorW, doorH, 28);
        var lDoorMesh = new THREE.Mesh(lDoorGeo, steelMat);
        var rDoorMesh = new THREE.Mesh(rDoorGeo, steelMat);
        lDoorMesh.position.set(-doorW / 2 - 1.5, doorH / 2 + 35, D / 2 - 14);
        rDoorMesh.position.set(doorW / 2 + 1.5, doorH / 2 + 35, D / 2 - 14);
        lDoorMesh.castShadow = true; rDoorMesh.castShadow = true;
        fg.add(lDoorMesh); fg.add(rDoorMesh);

        var hStripGeo = new THREE.BoxGeometry(8, doorH * 0.45, 12);
        var hStripL = new THREE.Mesh(hStripGeo, darkSteelMat);
        var hStripR = new THREE.Mesh(hStripGeo, darkSteelMat);
        hStripL.position.set(-8, doorH * 0.55 + 35, D / 2 + 2);
        hStripR.position.set(8, doorH * 0.55 + 35, D / 2 + 2);
        fg.add(hStripL); fg.add(hStripR);

        var scrGeo = new THREE.BoxGeometry(45, 75, 4);
        var scrMesh = new THREE.Mesh(scrGeo, ledMat);
        scrMesh.position.set(doorW * 0.5, doorH * 0.7 + 35, D / 2 + 1);
        fg.add(scrMesh);
      } else {
        var singleDoorGeo = new THREE.BoxGeometry(W - 4, H - 50, 28);
        var singleDoorMesh = new THREE.Mesh(singleDoorGeo, steelMat);
        singleDoorMesh.position.set(0, (H - 50) / 2 + 35, D / 2 - 14);
        singleDoorMesh.castShadow = true;
        fg.add(singleDoorMesh);

        var sHGeo = new THREE.BoxGeometry(10, (H - 50) * 0.4, 14);
        var sHMesh = new THREE.Mesh(sHGeo, darkSteelMat);
        sHMesh.position.set(W / 2 - 40, (H - 50) * 0.55 + 35, D / 2 + 2);
        fg.add(sHMesh);
      }
    } else if (decorType === 'ice_box') {
      var caseMat = new THREE.MeshStandardMaterial({ color: 0x1E2024, metalness: 0.7, roughness: 0.3 });
      var chromeMat = new THREE.MeshStandardMaterial({ color: 0xE0E0E0, metalness: 0.95, roughness: 0.1 });
      var glassMat = new THREE.MeshStandardMaterial({ color: 0x88CCEE, transparent: true, opacity: 0.38, roughness: 0.1, metalness: 0.1 });
      var blueGlowMat = new THREE.MeshStandardMaterial({ color: 0x00E5FF, emissive: 0x0077B6, emissiveIntensity: 0.6 });

      var caseGeo = new THREE.BoxGeometry(W, H, D - 15);
      var caseMesh = new THREE.Mesh(caseGeo, caseMat);
      caseMesh.position.set(0, H / 2, -7.5);
      caseMesh.castShadow = true; caseMesh.receiveShadow = true;
      fg.add(caseMesh);

      var glassGeo = new THREE.BoxGeometry(W - 40, H - 40, 10);
      var glassMesh = new THREE.Mesh(glassGeo, glassMat);
      glassMesh.position.set(0, H / 2, D / 2 - 5);
      fg.add(glassMesh);

      var frameBorderGeo = new THREE.BoxGeometry(W, H, 14);
      var frameBorderMesh = new THREE.Mesh(frameBorderGeo, caseMat);
      frameBorderMesh.position.set(0, H / 2, D / 2 - 7);
      fg.add(frameBorderMesh);

      var numShelves = Math.max(2, Math.floor(H / 220));
      for (var sh = 1; sh < numShelves; sh++) {
        var shY = (H / numShelves) * sh;
        var rackGeo = new THREE.BoxGeometry(W - 60, 6, D - 60);
        var rackMesh = new THREE.Mesh(rackGeo, chromeMat);
        rackMesh.position.set(0, shY, 0);
        fg.add(rackMesh);
      }

      var ledStripGeo = new THREE.BoxGeometry(W - 80, 8, 8);
      var ledStripMesh = new THREE.Mesh(ledStripGeo, blueGlowMat);
      ledStripMesh.position.set(0, H - 25, 0);
      fg.add(ledStripMesh);

      var hCyl = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, Math.min(260, H * 0.5), 16), chromeMat);
      hCyl.position.set(W / 2 - 25, H / 2, D / 2 + 12);
      fg.add(hCyl);
    } else if (decorType === 'plant') {
      var potR = Math.min(W, D) * 0.38;
      var potH = Math.min(H * 0.45, 450);
      var potMat = new THREE.MeshStandardMaterial({ color: 0xF3EFEA, roughness: 0.4 });
      var soilMat = new THREE.MeshStandardMaterial({ color: 0x3D2817, roughness: 0.9 });
      var leafMat1 = new THREE.MeshStandardMaterial({ color: 0x2D6A28, roughness: 0.5, side: THREE.DoubleSide });
      var leafMat2 = new THREE.MeshStandardMaterial({ color: 0x3F8A38, roughness: 0.45, side: THREE.DoubleSide });

      var potGeo = new THREE.CylinderGeometry(potR, potR * 0.78, potH, 24);
      var potMesh = new THREE.Mesh(potGeo, potMat);
      potMesh.position.set(0, potH / 2, 0);
      potMesh.castShadow = true; potMesh.receiveShadow = true;
      fg.add(potMesh);

      var soilGeo = new THREE.CylinderGeometry(potR * 0.94, potR * 0.94, 15, 24);
      var soilMesh = new THREE.Mesh(soilGeo, soilMat);
      soilMesh.position.set(0, potH - 5, 0);
      fg.add(soilMesh);

      var stemMat = new THREE.MeshStandardMaterial({ color: 0x255220, roughness: 0.7 });
      var plantH = H - potH;
      var numLeaves = 10;
      for (var lf = 0; lf < numLeaves; lf++) {
        var angle = (lf / numLeaves) * Math.PI * 2 + (lf % 2 * 0.3);
        var distFromCenter = potR * (0.35 + (lf % 3) * 0.2);
        var leafH = potH + (plantH * 0.4) + (lf / numLeaves) * (plantH * 0.55);

        var stemGeo = new THREE.CylinderGeometry(3, 4, leafH - potH, 8);
        var stemMesh = new THREE.Mesh(stemGeo, stemMat);
        stemMesh.position.set(Math.cos(angle) * distFromCenter * 0.5, potH + (leafH - potH) / 2, Math.sin(angle) * distFromCenter * 0.5);
        stemMesh.rotation.z = Math.cos(angle) * 0.15;
        stemMesh.rotation.x = Math.sin(angle) * 0.15;
        fg.add(stemMesh);

        var leafSize = Math.min(W * 0.38, 260);
        var leafGeo = new THREE.BoxGeometry(leafSize, 4, leafSize * 0.65);
        var leafMesh = new THREE.Mesh(leafGeo, (lf % 2 === 0 ? leafMat1 : leafMat2));
        leafMesh.position.set(Math.cos(angle) * (distFromCenter + leafSize * 0.4), leafH, Math.sin(angle) * (distFromCenter + leafSize * 0.4));
        leafMesh.rotation.y = angle + Math.PI / 2;
        leafMesh.rotation.x = 0.3 + (lf % 3) * 0.15;
        leafMesh.castShadow = true;
        fg.add(leafMesh);
      }
    } else if (decorType === 'microwave') {
      var ovBodyMat = new THREE.MeshStandardMaterial({ color: 0x22252A, metalness: 0.7, roughness: 0.3 });
      var ovGlassMat = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.1, metalness: 0.4 });
      var ovHandleMat = new THREE.MeshStandardMaterial({ color: 0xD0D4D9, metalness: 0.9, roughness: 0.15 });

      var ovBody = new THREE.Mesh(new THREE.BoxGeometry(W, H, D - 15), ovBodyMat);
      ovBody.position.set(0, H / 2, -7.5);
      ovBody.castShadow = true;
      fg.add(ovBody);

      var ovGlass = new THREE.Mesh(new THREE.BoxGeometry(W * 0.7, H * 0.75, 8), ovGlassMat);
      ovGlass.position.set(-W * 0.1, H / 2, D / 2 - 4);
      fg.add(ovGlass);

      var ovBar = new THREE.Mesh(new THREE.CylinderGeometry(6, 6, W * 0.6, 16), ovHandleMat);
      ovBar.rotation.z = Math.PI / 2;
      ovBar.position.set(-W * 0.1, H * 0.82, D / 2 + 10);
      fg.add(ovBar);
    } else if (decorType === 'chimney') {
      var chSteelMat = new THREE.MeshStandardMaterial({ color: 0xD4D8DD, metalness: 0.85, roughness: 0.25 });
      var filterMat = new THREE.MeshStandardMaterial({ color: 0x60656E, metalness: 0.7, roughness: 0.5 });
      var warmLedMat = new THREE.MeshStandardMaterial({ color: 0xFFE082, emissive: 0xFFD54F, emissiveIntensity: 0.8 });

      var canopyH = Math.min(180, H * 0.3);
      var canopyGeo = new THREE.CylinderGeometry(W * 0.35, W * 0.5, canopyH, 4);
      var canopyMesh = new THREE.Mesh(canopyGeo, chSteelMat);
      canopyMesh.position.set(0, canopyH / 2, 0);
      canopyMesh.rotation.y = Math.PI / 4;
      canopyMesh.castShadow = true;
      fg.add(canopyMesh);

      var ductH = H - canopyH;
      var ductGeo = new THREE.BoxGeometry(W * 0.35, ductH, D * 0.5);
      var ductMesh = new THREE.Mesh(ductGeo, chSteelMat);
      ductMesh.position.set(0, canopyH + ductH / 2, 0);
      ductMesh.castShadow = true;
      fg.add(ductMesh);

      var filMesh = new THREE.Mesh(new THREE.BoxGeometry(W * 0.75, 4, D * 0.7), filterMat);
      filMesh.position.set(0, 2, 0);
      fg.add(filMesh);

      var spot1 = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 4, 16), warmLedMat);
      var spot2 = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 4, 16), warmLedMat);
      spot1.position.set(-W * 0.25, 1, 0);
      spot2.position.set(W * 0.25, 1, 0);
      fg.add(spot1); fg.add(spot2);
    } else if (decorType === 'tv') {
      var tvBezelMat = new THREE.MeshStandardMaterial({ color: 0x1A1C20, metalness: 0.8, roughness: 0.2 });
      var tvScreenMat = new THREE.MeshStandardMaterial({ color: 0x08090B, roughness: 0.1, metalness: 0.7 });

      var tvBezel = new THREE.Mesh(new THREE.BoxGeometry(W, H, 20), tvBezelMat);
      tvBezel.position.set(0, H / 2, 0);
      tvBezel.castShadow = true;
      fg.add(tvBezel);

      var tvScreen = new THREE.Mesh(new THREE.BoxGeometry(W - 16, H - 16, 4), tvScreenMat);
      tvScreen.position.set(0, H / 2, 10);
      fg.add(tvScreen);
    } else if (decorType === 'sofa') {
      var fabricMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.85 });
      var woodMat = new THREE.MeshStandardMaterial({ color: 0x6E4E35, roughness: 0.5 });

      var seatH = Math.min(420, H * 0.5);
      var seatGeo = new THREE.BoxGeometry(W - 80, seatH * 0.65, D - 60);
      var seatMesh = new THREE.Mesh(seatGeo, fabricMat);
      seatMesh.position.set(0, seatH * 0.65 / 2 + 100, 10);
      seatMesh.castShadow = true;
      fg.add(seatMesh);

      var backH = H - seatH;
      var backGeo = new THREE.BoxGeometry(W - 80, backH, 120);
      var backMesh = new THREE.Mesh(backGeo, fabricMat);
      backMesh.position.set(0, seatH + backH / 2, -D / 2 + 80);
      backMesh.castShadow = true;
      fg.add(backMesh);

      var armW = 40, armH = seatH + 120;
      var armL = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, D), fabricMat);
      var armR = new THREE.Mesh(new THREE.BoxGeometry(armW, armH, D), fabricMat);
      armL.position.set(-W / 2 + armW / 2, armH / 2, 0);
      armR.position.set(W / 2 - armW / 2, armH / 2, 0);
      armL.castShadow = true; armR.castShadow = true;
      fg.add(armL); fg.add(armR);

      var legGeo = new THREE.CylinderGeometry(18, 12, 100, 12);
      var legOffsets = [[-W / 2 + 60, -D / 2 + 60], [W / 2 - 60, -D / 2 + 60], [-W / 2 + 60, D / 2 - 60], [W / 2 - 60, D / 2 - 60]];
      legOffsets.forEach(function (off) {
        var leg = new THREE.Mesh(legGeo, woodMat);
        leg.position.set(off[0], 50, off[1]);
        fg.add(leg);
      });
    } else if (decorType === 'sink') {
      // Kitchen Sink with Faucet & Drainboard
      var sSteelMat = new THREE.MeshStandardMaterial({ color: 0xD8DDE2, metalness: 0.9, roughness: 0.2 });
      var darkSinkMat = new THREE.MeshStandardMaterial({ color: 0x4A525D, metalness: 0.85, roughness: 0.35 });
      var chromeFaucetMat = new THREE.MeshStandardMaterial({ color: 0xF0F2F5, metalness: 0.98, roughness: 0.08 });

      var rimH = 8;
      var rimMesh = new THREE.Mesh(new THREE.BoxGeometry(W, rimH, D), sSteelMat);
      rimMesh.position.set(0, rimH / 2, 0);
      rimMesh.castShadow = true; rimMesh.receiveShadow = true;
      fg.add(rimMesh);

      var basinW = W * 0.52, basinD = D * 0.78, basinH = 190, basinX = -W * 0.2;
      var basinWallMat = new THREE.MeshStandardMaterial({ color: 0xB8C0C8, metalness: 0.88, roughness: 0.25, side: THREE.DoubleSide });

      var basinFloor = new THREE.Mesh(new THREE.BoxGeometry(basinW - 16, 6, basinD - 16), sSteelMat);
      basinFloor.position.set(basinX, -basinH + 3, 0);
      basinFloor.receiveShadow = true;
      fg.add(basinFloor);

      var bL = new THREE.Mesh(new THREE.BoxGeometry(8, basinH, basinD), basinWallMat);
      bL.position.set(basinX - basinW / 2 + 4, -basinH / 2, 0);
      var bR = new THREE.Mesh(new THREE.BoxGeometry(8, basinH, basinD), basinWallMat);
      bR.position.set(basinX + basinW / 2 - 4, -basinH / 2, 0);
      var bF = new THREE.Mesh(new THREE.BoxGeometry(basinW, basinH, 8), basinWallMat);
      bF.position.set(basinX, -basinH / 2, basinD / 2 - 4);
      var bB = new THREE.Mesh(new THREE.BoxGeometry(basinW, basinH, 8), basinWallMat);
      bB.position.set(basinX, -basinH / 2, -basinD / 2 + 4);
      fg.add(bL); fg.add(bR); fg.add(bF); fg.add(bB);

      var strainer = new THREE.Mesh(new THREE.CylinderGeometry(38, 34, 6, 24), darkSinkMat);
      strainer.position.set(basinX, -basinH + 5, 0);
      fg.add(strainer);

      var dbW = W * 0.38, dbD = D * 0.74, dbX = W * 0.26;
      for (var r = 0; r < 5; r++) {
        var ribZ = -dbD / 2 + 30 + r * ((dbD - 60) / 4);
        var rib = new THREE.Mesh(new THREE.BoxGeometry(dbW - 20, 4, 10), sSteelMat);
        rib.position.set(dbX, rimH + 1, ribZ);
        fg.add(rib);
      }

      var faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(18, 22, 28, 20), chromeFaucetMat);
      faucetBase.position.set(basinX, rimH + 14, -basinD / 2 + 20);
      fg.add(faucetBase);

      var stem = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 160, 16), chromeFaucetMat);
      stem.position.set(basinX, rimH + 28 + 80, -basinD / 2 + 20);
      fg.add(stem);

      var spoutArc = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 110, 16), chromeFaucetMat);
      spoutArc.position.set(basinX, rimH + 28 + 175, -basinD / 2 + 70);
      spoutArc.rotation.x = Math.PI / 2.8;
      fg.add(spoutArc);

      var nozzle = new THREE.Mesh(new THREE.CylinderGeometry(12, 10, 26, 16), chromeFaucetMat);
      nozzle.position.set(basinX, rimH + 28 + 150, -basinD / 2 + 120);
      fg.add(nozzle);

      var handleLever = new THREE.Mesh(new THREE.CylinderGeometry(5, 5, 55, 12), chromeFaucetMat);
      handleLever.position.set(basinX + 26, rimH + 45, -basinD / 2 + 20);
      handleLever.rotation.z = Math.PI / 3;
      fg.add(handleLever);

    } else if (decorType === 'gas_hob') {
      // 2-Burner Toughened Glass Gas Hob / Stove
      var hobGlassMat = new THREE.MeshStandardMaterial({ color: 0x121417, metalness: 0.9, roughness: 0.08 });
      var hobBezelMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.85, roughness: 0.25 });
      var trivetMat = new THREE.MeshStandardMaterial({ color: 0x1E2024, roughness: 0.85, metalness: 0.3 });
      var brassMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.85, roughness: 0.2 });
      var knobMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.92, roughness: 0.15 });

      var chassis = new THREE.Mesh(new THREE.BoxGeometry(W - 20, 35, D - 20), hobBezelMat);
      chassis.position.set(0, -15, 0);
      fg.add(chassis);

      var glassTop = new THREE.Mesh(new THREE.BoxGeometry(W, 10, D), hobGlassMat);
      glassTop.position.set(0, 5, 0);
      glassTop.castShadow = true; glassTop.receiveShadow = true;
      fg.add(glassTop);

      [-W * 0.24, W * 0.24].forEach(function (bx) {
        var tray = new THREE.Mesh(new THREE.CylinderGeometry(72, 76, 5, 28), hobBezelMat);
        tray.position.set(bx, 11, -D * 0.04);
        fg.add(tray);

        var brassRing = new THREE.Mesh(new THREE.CylinderGeometry(46, 50, 8, 24), brassMat);
        brassRing.position.set(bx, 15, -D * 0.04);
        fg.add(brassRing);

        var burnerCap = new THREE.Mesh(new THREE.CylinderGeometry(38, 38, 6, 24), trivetMat);
        burnerCap.position.set(bx, 19, -D * 0.04);
        fg.add(burnerCap);

        var sp1 = new THREE.Mesh(new THREE.BoxGeometry(130, 12, 12), trivetMat);
        var sp2 = new THREE.Mesh(new THREE.BoxGeometry(12, 12, 130), trivetMat);
        sp1.position.set(bx, 17, -D * 0.04);
        sp2.position.set(bx, 17, -D * 0.04);
        sp1.castShadow = true; sp2.castShadow = true;
        fg.add(sp1); fg.add(sp2);
      });

      [-W * 0.14, W * 0.14].forEach(function (kx) {
        var baseRing = new THREE.Mesh(new THREE.CylinderGeometry(18, 20, 4, 20), trivetMat);
        baseRing.position.set(kx, 11, D * 0.36);
        fg.add(baseRing);

        var knob = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 14, 20), knobMat);
        knob.position.set(kx, 17, D * 0.36);
        knob.castShadow = true;
        fg.add(knob);
      });

    } else if (decorType === 'dishwasher') {
      // Under-counter Siemens Built-in Dishwasher
      var dwSteelMat = new THREE.MeshStandardMaterial({ color: 0xD0D5DB, metalness: 0.85, roughness: 0.25 });
      var dwDarkMat = new THREE.MeshStandardMaterial({ color: 0x1E2228, metalness: 0.75, roughness: 0.35 });
      var dwLedMat = new THREE.MeshStandardMaterial({ color: 0x00E5FF, emissive: 0x00B0FF, emissiveIntensity: 0.85 });

      var dwBody = new THREE.Mesh(new THREE.BoxGeometry(W, H - 90, D - 30), dwSteelMat);
      dwBody.position.set(0, (H - 90) / 2 + 90, -15);
      dwBody.castShadow = true; dwBody.receiveShadow = true;
      fg.add(dwBody);

      var dwPlinth = new THREE.Mesh(new THREE.BoxGeometry(W - 10, 90, D - 40), dwDarkMat);
      dwPlinth.position.set(0, 45, -20);
      fg.add(dwPlinth);

      var doorH = H - 190;
      var dwDoor = new THREE.Mesh(new THREE.BoxGeometry(W - 4, doorH, 24), dwSteelMat);
      dwDoor.position.set(0, 90 + doorH / 2, D / 2 - 12);
      dwDoor.castShadow = true;
      fg.add(dwDoor);

      var fasciaH = 95;
      var dwFascia = new THREE.Mesh(new THREE.BoxGeometry(W - 4, fasciaH, 26), dwDarkMat);
      dwFascia.position.set(0, H - fasciaH / 2, D / 2 - 13);
      fg.add(dwFascia);

      var dwHandle = new THREE.Mesh(new THREE.BoxGeometry(W * 0.55, 18, 14), dwSteelMat);
      dwHandle.position.set(0, H - fasciaH - 12, D / 2 - 1);
      fg.add(dwHandle);

      var dwScreen = new THREE.Mesh(new THREE.BoxGeometry(60, 24, 3), dwLedMat);
      dwScreen.position.set(0, H - fasciaH / 2, D / 2 + 1);
      fg.add(dwScreen);

    } else if (decorType === 'washing_machine') {
      // AEG Front-Loading Washing Machine
      var wmBodyMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, metalness: 0.3, roughness: 0.2 });
      var wmSteelMat = new THREE.MeshStandardMaterial({ color: 0xC4CAD2, metalness: 0.92, roughness: 0.15 });
      var wmGlassMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.1, metalness: 0.5, transparent: true, opacity: 0.75 });
      var wmLedMat = new THREE.MeshStandardMaterial({ color: 0x38BDF8, emissive: 0x0284C7, emissiveIntensity: 0.7 });

      var wmBody = new THREE.Mesh(new THREE.BoxGeometry(W, H - 40, D - 20), wmBodyMat);
      wmBody.position.set(0, (H - 40) / 2 + 40, -10);
      wmBody.castShadow = true; wmBody.receiveShadow = true;
      fg.add(wmBody);

      var wmPlinth = new THREE.Mesh(new THREE.BoxGeometry(W - 4, 40, D - 15), new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7 }));
      wmPlinth.position.set(0, 20, -5);
      fg.add(wmPlinth);

      var wmFascia = new THREE.Mesh(new THREE.BoxGeometry(W - 4, 110, 24), wmBodyMat);
      wmFascia.position.set(0, H - 55, D / 2 - 12);
      fg.add(wmFascia);

      var drawer = new THREE.Mesh(new THREE.BoxGeometry(W * 0.28, 70, 8), wmSteelMat);
      drawer.position.set(-W * 0.3, H - 55, D / 2 + 1);
      fg.add(drawer);

      var progKnob = new THREE.Mesh(new THREE.CylinderGeometry(26, 26, 16, 28), wmSteelMat);
      progKnob.rotation.x = Math.PI / 2;
      progKnob.position.set(0, H - 55, D / 2 + 5);
      progKnob.castShadow = true;
      fg.add(progKnob);

      var wmDisplay = new THREE.Mesh(new THREE.BoxGeometry(W * 0.28, 55, 4), wmLedMat);
      wmDisplay.position.set(W * 0.3, H - 55, D / 2 + 1);
      fg.add(wmDisplay);

      var doorCenterY = (H - 120) * 0.52 + 20;
      var doorRadius = Math.min(W * 0.34, (H - 120) * 0.44);

      var doorBezel = new THREE.Mesh(new THREE.TorusGeometry(doorRadius, 20, 16, 36), wmSteelMat);
      doorBezel.position.set(0, doorCenterY, D / 2 - 2);
      doorBezel.castShadow = true;
      fg.add(doorBezel);

      var doorGlass = new THREE.Mesh(new THREE.CylinderGeometry(doorRadius - 10, doorRadius - 10, 10, 32), wmGlassMat);
      doorGlass.rotation.x = Math.PI / 2;
      doorGlass.position.set(0, doorCenterY, D / 2 - 2);
      fg.add(doorGlass);

      var drumInterior = new THREE.Mesh(new THREE.CylinderGeometry(doorRadius * 0.72, doorRadius * 0.65, 50, 24), wmSteelMat);
      drumInterior.rotation.x = Math.PI / 2;
      drumInterior.position.set(0, doorCenterY, D / 2 - 35);
      fg.add(drumInterior);

      var latch = new THREE.Mesh(new THREE.BoxGeometry(14, 45, 12), wmSteelMat);
      latch.position.set(doorRadius - 6, doorCenterY, D / 2 + 6);
      fg.add(latch);

    } else if (decorType === 'ro_purifier') {
      // Kent Mineral RO Wall-Mounted Water Purifier
      var roWhiteMat = new THREE.MeshStandardMaterial({ color: 0xFDFDFD, roughness: 0.25, metalness: 0.1 });
      var roTankMat = new THREE.MeshStandardMaterial({ color: 0x60A5FA, transparent: true, opacity: 0.48, roughness: 0.15, metalness: 0.2 });
      var roChromeMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.1 });
      var roFilterMat = new THREE.MeshStandardMaterial({ color: 0x3B82F6, roughness: 0.4 });

      var baseH = H * 0.42;
      var roBase = new THREE.Mesh(new THREE.BoxGeometry(W, baseH, D), roWhiteMat);
      roBase.position.set(0, baseH / 2, 0);
      roBase.castShadow = true; roBase.receiveShadow = true;
      fg.add(roBase);

      var tankH = H - baseH;
      var roTank = new THREE.Mesh(new THREE.BoxGeometry(W - 8, tankH, D - 8), roTankMat);
      roTank.position.set(0, baseH + tankH / 2, 0);
      roTank.castShadow = true;
      fg.add(roTank);

      [-W * 0.22, W * 0.22].forEach(function (fx) {
        var cyl = new THREE.Mesh(new THREE.CylinderGeometry(28, 28, tankH * 0.7, 20), roFilterMat);
        cyl.position.set(fx, baseH + tankH * 0.45, -10);
        fg.add(cyl);
      });

      var roBadge = new THREE.Mesh(new THREE.BoxGeometry(W * 0.45, 26, 4), new THREE.MeshStandardMaterial({ color: 0x1D4ED8 }));
      roBadge.position.set(0, baseH + 18, D / 2 + 1);
      fg.add(roBadge);

      var tapStem = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 30, 16), roChromeMat);
      tapStem.position.set(0, 35, D / 2 + 12);
      tapStem.rotation.x = Math.PI / 2.5;
      fg.add(tapStem);

      var tapLever = new THREE.Mesh(new THREE.BoxGeometry(10, 36, 6), roChromeMat);
      tapLever.position.set(0, 52, D / 2 + 8);
      fg.add(tapLever);

    } else if (decorType === 'dining_table') {
      // 4-Seater Dining Table Set with Chairs
      var marbleTopMat = new THREE.MeshStandardMaterial({ color: 0xF5F6F8, roughness: 0.18, metalness: 0.15 });
      var chairWoodMat = new THREE.MeshStandardMaterial({ color: 0x1E2228, roughness: 0.65, metalness: 0.2 });
      var cushionMat = new THREE.MeshStandardMaterial({ color: 0x475569, roughness: 0.88 });
      var steelLegMat = new THREE.MeshStandardMaterial({ color: 0x2D3748, metalness: 0.85, roughness: 0.3 });

      var tableTopH = 35;
      var tableH = Math.min(H, 760);
      var tableW = W * 0.82;
      var tableD = D * 0.68;

      var slab = new THREE.Mesh(new THREE.BoxGeometry(tableW, tableTopH, tableD), marbleTopMat);
      slab.position.set(0, tableH - tableTopH / 2, 0);
      slab.castShadow = true; slab.receiveShadow = true;
      fg.add(slab);

      var tLegGeo = new THREE.CylinderGeometry(20, 16, tableH - tableTopH, 16);
      [
        [-tableW / 2 + 50, -tableD / 2 + 50],
        [tableW / 2 - 50, -tableD / 2 + 50],
        [-tableW / 2 + 50, tableD / 2 - 50],
        [tableW / 2 - 50, tableD / 2 - 50]
      ].forEach(function (pos) {
        var tl = new THREE.Mesh(tLegGeo, steelLegMat);
        tl.position.set(pos[0], (tableH - tableTopH) / 2, pos[1]);
        tl.castShadow = true;
        fg.add(tl);
      });

      var vase = new THREE.Mesh(new THREE.CylinderGeometry(20, 14, 65, 18), new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.3 }));
      vase.position.set(0, tableH + 32, 0);
      fg.add(vase);

      function addChair(cx, cz, rotY) {
        var chGroup = new THREE.Group();
        var chSeatH = 440;
        var chW = 420;
        var chD = 400;

        var seat = new THREE.Mesh(new THREE.BoxGeometry(chW, 45, chD), cushionMat);
        seat.position.set(0, chSeatH, 0);
        seat.castShadow = true;
        chGroup.add(seat);

        var backrestH = 380;
        var backrest = new THREE.Mesh(new THREE.BoxGeometry(chW - 20, backrestH, 30), cushionMat);
        backrest.position.set(0, chSeatH + backrestH / 2, -chD / 2 + 15);
        backrest.castShadow = true;
        chGroup.add(backrest);

        var legGeo = new THREE.CylinderGeometry(12, 9, chSeatH, 12);
        [[-chW / 2 + 30, -chD / 2 + 30], [chW / 2 - 30, -chD / 2 + 30], [-chW / 2 + 30, chD / 2 - 30], [chW / 2 - 30, chD / 2 - 30]].forEach(function (lp) {
          var leg = new THREE.Mesh(legGeo, chairWoodMat);
          leg.position.set(lp[0], chSeatH / 2, lp[1]);
          leg.castShadow = true;
          chGroup.add(leg);
        });

        chGroup.position.set(cx, 0, cz);
        chGroup.rotation.y = rotY;
        fg.add(chGroup);
      }

      var chairXSpacing = tableW * 0.28;
      addChair(-chairXSpacing, tableD / 2 + 190, Math.PI);
      addChair(chairXSpacing, tableD / 2 + 190, Math.PI);
      addChair(-chairXSpacing, -tableD / 2 - 190, 0);
      addChair(chairXSpacing, -tableD / 2 - 190, 0);

    } else {
      var genMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.4, metalness: 0.2 });
      var box = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), genMat);
      box.position.set(0, H / 2, 0);
      box.castShadow = true;
      fg.add(box);
    }

    fg.position.set(furn.pos.x, elev, furn.pos.y);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;
    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build L-Shaped Corner Base Unit (Cookscape) - 900x900 Corner Module
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildLCornerCabinetMesh = function (furn, fg, dims, carcassMat, counterMat, plinthH, bodyH, counterH, getShutterMaterial, handleType, handleMat, isBase, isKitchen) {
    var legW = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.legW) || 900;
    var legD = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.legD) || 900;
    var depth = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.depth) || 560;
    var W = legW;
    var D = legD;
    var openW = W - depth; // 340 mm
    var openD = D - depth; // 340 mm

    var plinthMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.85, metalness: 0.1 });

    // 1. Plinth Base (100mm high, set back by 40mm from front faces)
    if (plinthH > 0) {
      var p1W = W - 20;
      var p1D = depth - 40;
      var p1Mesh = new THREE.Mesh(new THREE.BoxGeometry(p1W, plinthH, p1D), plinthMat);
      p1Mesh.position.set(0, plinthH / 2, -D / 2 + p1D / 2 + 10);
      p1Mesh.castShadow = true; p1Mesh.receiveShadow = true;
      p1Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(p1Mesh);

      var p2W = depth - 40;
      var p2D = openD - 10;
      var p2Mesh = new THREE.Mesh(new THREE.BoxGeometry(p2W, plinthH, p2D), plinthMat);
      p2Mesh.position.set(W / 2 - p2W / 2 - 10, plinthH / 2, -D / 2 + depth + p2D / 2);
      p2Mesh.castShadow = true; p2Mesh.receiveShadow = true;
      p2Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(p2Mesh);
    }

    // 2. Bottom Floors (18mm Carcass)
    var botY = plinthH + 9;
    var b1Mesh = new THREE.Mesh(new THREE.BoxGeometry(W, 18, depth), carcassMat);
    b1Mesh.position.set(0, botY, -D / 2 + depth / 2);
    b1Mesh.castShadow = true; b1Mesh.receiveShadow = true;
    b1Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(b1Mesh);

    var b2Mesh = new THREE.Mesh(new THREE.BoxGeometry(depth, 18, openD), carcassMat);
    b2Mesh.position.set(W / 2 - depth / 2, botY, -D / 2 + depth + openD / 2);
    b2Mesh.castShadow = true; b2Mesh.receiveShadow = true;
    b2Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(b2Mesh);

    // 3. Back Panels (18mm Carcass)
    var bk1Mesh = new THREE.Mesh(new THREE.BoxGeometry(W - 18, bodyH, 18), carcassMat);
    bk1Mesh.position.set(-9, plinthH + bodyH / 2, -D / 2 + 9);
    bk1Mesh.castShadow = true; bk1Mesh.receiveShadow = true;
    bk1Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(bk1Mesh);

    var bk2Mesh = new THREE.Mesh(new THREE.BoxGeometry(18, bodyH, D), carcassMat);
    bk2Mesh.position.set(W / 2 - 9, plinthH + bodyH / 2, 0);
    bk2Mesh.castShadow = true; bk2Mesh.receiveShadow = true;
    bk2Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(bk2Mesh);

    // 4. Outer End Panels (18mm Carcass)
    var end1Mesh = new THREE.Mesh(new THREE.BoxGeometry(18, bodyH, depth - 18), carcassMat);
    end1Mesh.position.set(-W / 2 + 9, plinthH + bodyH / 2, -D / 2 + 18 + (depth - 18) / 2);
    end1Mesh.castShadow = true; end1Mesh.receiveShadow = true;
    end1Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(end1Mesh);

    var end2Mesh = new THREE.Mesh(new THREE.BoxGeometry(depth - 18, bodyH, 18), carcassMat);
    end2Mesh.position.set(W / 2 - 18 - (depth - 18) / 2, plinthH + bodyH / 2, D / 2 - 9);
    end2Mesh.castShadow = true; end2Mesh.receiveShadow = true;
    end2Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(end2Mesh);

    // 5. Top Support Rails (18mm Carcass)
    var topY = plinthH + bodyH - 9;
    var t1Mesh = new THREE.Mesh(new THREE.BoxGeometry(W, 18, depth), carcassMat);
    t1Mesh.position.set(0, topY, -D / 2 + depth / 2);
    t1Mesh.castShadow = true; t1Mesh.receiveShadow = true;
    t1Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(t1Mesh);

    var t2Mesh = new THREE.Mesh(new THREE.BoxGeometry(depth, 18, openD), carcassMat);
    t2Mesh.position.set(W / 2 - depth / 2, topY, -D / 2 + depth + openD / 2);
    t2Mesh.castShadow = true; t2Mesh.receiveShadow = true;
    t2Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(t2Mesh);

    // 6. Shelves (2 Shelves, shelves: 2)
    var numShelves = (furn.unitConfig && furn.unitConfig.shelves !== undefined) ? parseInt(furn.unitConfig.shelves) : 2;
    for (var sh = 1; sh <= numShelves; sh++) {
      var shY = plinthH + (sh * bodyH) / (numShelves + 1);
      var s1Mesh = new THREE.Mesh(new THREE.BoxGeometry(W - 36, 18, depth - 40), carcassMat);
      s1Mesh.position.set(0, shY, -D / 2 + (depth - 40) / 2 + 18);
      s1Mesh.castShadow = true; s1Mesh.receiveShadow = true;
      s1Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(s1Mesh);

      var s2Mesh = new THREE.Mesh(new THREE.BoxGeometry(depth - 40, 18, openD - 15), carcassMat);
      s2Mesh.position.set(W / 2 - (depth - 40) / 2 - 18, shY, -D / 2 + depth + (openD - 15) / 2);
      s2Mesh.castShadow = true; s2Mesh.receiveShadow = true;
      s2Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(s2Mesh);
    }

    // 7. Countertop Stone (35mm Black Stone, counterH = 35)
    if (counterH > 0) {
      var cY = plinthH + bodyH + counterH / 2;
      var c1Mesh = new THREE.Mesh(new THREE.BoxGeometry(W + 20, counterH, depth + 20), counterMat);
      c1Mesh.position.set(-10, cY, -D / 2 + (depth + 20) / 2);
      c1Mesh.castShadow = true; c1Mesh.receiveShadow = true;
      c1Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(c1Mesh);

      var c2Mesh = new THREE.Mesh(new THREE.BoxGeometry(depth + 20, counterH, openD + 20), counterMat);
      c2Mesh.position.set(W / 2 - (depth + 20) / 2, cY, -D / 2 + depth + (openD + 20) / 2);
      c2Mesh.castShadow = true; c2Mesh.receiveShadow = true;
      c2Mesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(c2Mesh);
    }

    // 8. Doors (Two Hinged Doors meeting at Inside 90° Corner)
    var shH = bodyH - 6;
    var shutterCenterY = plinthH + 3 + shH / 2;
    var doorW = openW - 6;
    var shutterMat0 = getShutterMaterial(0);
    var shutterMat1 = getShutterMaterial(1);

    // Door 1 (Front Door on Left Wing Face)
    var d1LeftX = -W / 2 + 18;
    var hinge1Group = new THREE.Group();
    hinge1Group.name = "ShutterHinge_0";
    hinge1Group.position.set(d1LeftX, shutterCenterY, -D / 2 + depth + 9);
    hinge1Group.userData = { isShutterHinge: true, shutterIdx: 0, furnitureId: furn.id };

    var d1Mesh = new THREE.Mesh(new THREE.BoxGeometry(doorW, shH, 18), shutterMat0);
    d1Mesh.position.set(doorW / 2, 0, 0);
    d1Mesh.castShadow = true; d1Mesh.receiveShadow = true;
    d1Mesh.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hinge1Group, parentGroup: fg, furnitureId: furn.id };
    hinge1Group.add(d1Mesh);

    var isD1Open = !!(furn.shutterStates && furn.shutterStates[0]);
    hinge1Group.rotation.y = isD1Open ? -Math.PI * 0.55 : 0;
    fg.add(hinge1Group);

    // Door 2 (Side Door on Right Wing Face)
    var d2RightZ = D / 2 - 18;
    var hinge2Group = new THREE.Group();
    hinge2Group.name = "ShutterHinge_1";
    hinge2Group.position.set(W / 2 - depth - 9, shutterCenterY, d2RightZ);
    hinge2Group.userData = { isShutterHinge: true, shutterIdx: 1, furnitureId: furn.id };

    var d2Mesh = new THREE.Mesh(new THREE.BoxGeometry(18, shH, doorW), shutterMat1);
    d2Mesh.position.set(0, 0, -doorW / 2);
    d2Mesh.castShadow = true; d2Mesh.receiveShadow = true;
    d2Mesh.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 1, hingeGroup: hinge2Group, parentGroup: fg, furnitureId: furn.id };
    hinge2Group.add(d2Mesh);

    // Vertical Black Pull Handle on Door 2 near inside corner junction
    var hGroup = ArchitecturalRenderer.createHandleMesh("pull", handleMat, true, Math.min(180, shH * 0.35));
    if (hGroup) {
      hGroup.position.set(-14, shH * 0.25, -doorW + 35);
      hGroup.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 1, hingeGroup: hinge2Group, parentGroup: fg, furnitureId: furn.id };
      hGroup.traverse(function (c) {
        if (c.isMesh) c.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 1, hingeGroup: hinge2Group, parentGroup: fg, furnitureId: furn.id };
      });
      hinge2Group.add(hGroup);
    }

    var isD2Open = !!(furn.shutterStates && furn.shutterStates[1]);
    hinge2Group.rotation.y = isD2Open ? Math.PI * 0.55 : 0;
    fg.add(hinge2Group);

    // Position and rotate unit
    var catL = (furn.category || '').toLowerCase();
    var nameL = (furn.name || '').toLowerCase();
    var isWallCorner = (!isBase && (catL.indexOf('wall') !== -1 || nameL.indexOf('wall') !== -1 || /(^|\b|_|-)(wcm)($|\b|_|-|\d+)/i.test(nameL)));
    var defElevCorner = isWallCorner ? 1500 : 0;
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) : defElevCorner);
    fg.position.set(furn.pos.x, elev, furn.pos.y);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;

    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Architectural Wall Panel / Back Panel (pnl-back / wall_paneling)
     Mounts flush against the wall with exact beveling, NO internal carcass box
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildWallPanelMesh = function (furn, fg, dims, carcassMat) {
    var W = dims.W;
    var H = dims.H;
    var D = Math.max(12, dims.D || 18);

    var panelGeo = new THREE.BoxGeometry(W, H, D);
    var panelMesh = new THREE.Mesh(panelGeo, carcassMat);
    panelMesh.position.set(0, H / 2, -D / 2);
    panelMesh.castShadow = true; panelMesh.receiveShadow = true;
    panelMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(panelMesh);

    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) : 0);
    fg.position.set(furn.pos.x, elev, furn.pos.y);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;
    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build O/S (Only Shutter) Unit (e.g. LOFT 2 DOOR O/S, FM 120 O/S, WM 60 O/S)
     Mounts flush against existing masonry opening / niche frame. Zero carcass panels.
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildOnlyShutterMesh = function (furn, fg, dims, carcassMat, getShutterMaterial, handleType, handleMat) {
    var W = dims.W;
    var H = dims.H;
    var D = 18;

    var numShutters = (furn.unitConfig && furn.unitConfig.shutters !== undefined) ?
      parseInt(furn.unitConfig.shutters) : (W > 1200 ? 3 : W > 600 ? 2 : 1);
    numShutters = Math.max(1, numShutters);

    // Slim perimeter mounting frame (25mm reveal)
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.1 });
    var topFrame = new THREE.Mesh(new THREE.BoxGeometry(W, 25, 25), frameMat);
    topFrame.position.set(0, H - 12.5, -12.5);
    fg.add(topFrame);
    var botFrame = new THREE.Mesh(new THREE.BoxGeometry(W, 25, 25), frameMat);
    botFrame.position.set(0, 12.5, -12.5);
    fg.add(botFrame);
    var leftFrame = new THREE.Mesh(new THREE.BoxGeometry(25, Math.max(10, H - 50), 25), frameMat);
    leftFrame.position.set(-W / 2 + 12.5, H / 2, -12.5);
    fg.add(leftFrame);
    var rightFrame = new THREE.Mesh(new THREE.BoxGeometry(25, Math.max(10, H - 50), 25), frameMat);
    rightFrame.position.set(W / 2 - 12.5, H / 2, -12.5);
    fg.add(rightFrame);

    var shW = (W - (numShutters + 1) * 3) / numShutters;
    var shH = Math.max(100, H - 6);
    var hingeY = H / 2;

    for (var s = 0; s < numShutters; s++) {
      var hingeLeft = (s % 2 === 0);
      var sLeftX = -W / 2 + 3 + s * (shW + 3);
      var hingeX = hingeLeft ? sLeftX : (sLeftX + shW);
      var hingeZ = 0;

      var hingeGroup = new THREE.Group();
      hingeGroup.name = "ShutterHinge_" + s;
      hingeGroup.position.set(hingeX, hingeY, hingeZ);
      hingeGroup.userData = { isShutterHinge: true, shutterIdx: s, furnitureId: furn.id };

      var localX = hingeLeft ? (shW / 2) : (-shW / 2);
      var sGeo = new THREE.BoxGeometry(shW, shH, 18);
      var sMesh = new THREE.Mesh(sGeo, getShutterMaterial(s));
      sMesh.position.set(localX, 0, 0);
      sMesh.castShadow = true; sMesh.receiveShadow = true;
      sMesh.userData = { isFurniturePart: true, isShutter: true, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
      hingeGroup.add(sMesh);

      var hGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, shH * 0.35));
      if (hGroup) {
        var handleX = hingeLeft ? (shW - 25) : (-shW + 25);
        hGroup.position.set(handleX, 0, 9);
        hGroup.userData = { isFurniturePart: true, isShutter: true, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
        hGroup.traverse(function (c) {
          if (c.isMesh) c.userData = { isFurniturePart: true, isShutter: true, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
        });
        hingeGroup.add(hGroup);
      }

      var isOpen = !!(furn.shutterStates && furn.shutterStates[s]);
      hingeGroup.rotation.y = isOpen ? (hingeLeft ? -Math.PI * 0.6 : Math.PI * 0.6) : 0;
      fg.add(hingeGroup);
    }

    var catOS = (furn.category || '').toLowerCase();
    var nameOS = (furn.name || '').toLowerCase();
    var isLoftOS = (catOS.indexOf('loft') !== -1 || nameOS.indexOf('loft') !== -1 || (furn.id && furn.id.indexOf('loft') !== -1));
    var isWallOS = (catOS.indexOf('wall') !== -1 || nameOS.indexOf('wall') !== -1 || /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(nameOS) || (furn.id && /(wm|wcm)/i.test(furn.id)));
    var defElevOS = isLoftOS ? 2100 : (isWallOS ? 1500 : 0);
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) : defElevOS);
    fg.position.set(furn.pos.x, elev, furn.pos.y);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;
    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Kitchen Built-in Oven Tall Cabinet (TBM 60 OVEN / oven_tall)
     3-zone structure: Bottom Storage (700mm), Oven Niche (600mm), Top Storage (800mm)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildOvenTallCabinetMesh = function (furn, fg, dims, carcassMat, getShutterMaterial, handleType, handleMat) {
    var W = dims.W;
    var H = dims.H;
    var D = dims.D;

    var uCfg = furn.unitConfig || {};
    var ovenCfg = uCfg.oven || {};
    var shCfg = uCfg.shutterConfig || {};

    var hasLegs = (uCfg.hasLegs !== undefined) ? !!uCfg.hasLegs : (uCfg.mountType === 'floating' ? false : true);
    var plinthH = hasLegs ? 100 : 0;
    var bodyH = Math.max(100, H - plinthH);

    var bottomH = (shCfg.bottom && shCfg.bottom.height) || (ovenCfg.bottomElevation) || 700;
    var ovenH = (ovenCfg.openingH) || 600;
    var topH = (shCfg.top && shCfg.top.height) || Math.max(100, bodyH - bottomH - ovenH);

    var innerW = W - 36;
    var innerD = D - 20;

    // Plinth Base (if legs enabled)
    if (plinthH > 0) {
      var pGeo = new THREE.BoxGeometry(W - 30, plinthH, D - 50);
      var pMat = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.8 });
      var pMesh = new THREE.Mesh(pGeo, pMat);
      pMesh.position.set(0, plinthH / 2, -15);
      pMesh.castShadow = true; pMesh.receiveShadow = true;
      pMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(pMesh);
    }

    // 1. Left side carcass panel
    var leftMesh = new THREE.Mesh(new THREE.BoxGeometry(18, bodyH, D), carcassMat);
    leftMesh.position.set(-W / 2 + 9, plinthH + bodyH / 2, 0);
    leftMesh.castShadow = true; leftMesh.receiveShadow = true;
    leftMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(leftMesh);

    // 2. Right side carcass panel
    var rightMesh = new THREE.Mesh(new THREE.BoxGeometry(18, bodyH, D), carcassMat);
    rightMesh.position.set(W / 2 - 9, plinthH + bodyH / 2, 0);
    rightMesh.castShadow = true; rightMesh.receiveShadow = true;
    rightMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(rightMesh);

    // 3. Bottom floor panel
    var botMesh = new THREE.Mesh(new THREE.BoxGeometry(innerW, 18, innerD), carcassMat);
    botMesh.position.set(0, plinthH + 9, -10);
    botMesh.castShadow = true; botMesh.receiveShadow = true;
    botMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(botMesh);

    // 4. Top ceiling panel
    var topMesh = new THREE.Mesh(new THREE.BoxGeometry(innerW, 18, innerD), carcassMat);
    topMesh.position.set(0, plinthH + bodyH - 9, -10);
    topMesh.castShadow = true; topMesh.receiveShadow = true;
    topMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(topMesh);

    // 5. Oven Support Shelf (Bottom support at Y = plinthH + bottomH)
    var ovenBotShelf = new THREE.Mesh(new THREE.BoxGeometry(innerW, 18, innerD), carcassMat);
    ovenBotShelf.position.set(0, plinthH + bottomH - 9, -10);
    ovenBotShelf.castShadow = true; ovenBotShelf.receiveShadow = true;
    ovenBotShelf.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(ovenBotShelf);

    // 6. Oven Top Shelf (Top divider at Y = plinthH + bottomH + ovenH)
    var ovenTopShelf = new THREE.Mesh(new THREE.BoxGeometry(innerW, 18, innerD), carcassMat);
    ovenTopShelf.position.set(0, plinthH + bottomH + ovenH - 9, -10);
    ovenTopShelf.castShadow = true; ovenTopShelf.receiveShadow = true;
    ovenTopShelf.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(ovenTopShelf);

    // 7. Back panels:
    // a) Bottom back panel (behind bottom storage, 0 to bottomH)
    var bkBotGeo = new THREE.BoxGeometry(innerW, Math.max(10, bottomH - 36), 12);
    var bkBotMesh = new THREE.Mesh(bkBotGeo, carcassMat);
    bkBotMesh.position.set(0, plinthH + bottomH / 2, -D / 2 + 6);
    bkBotMesh.castShadow = true; bkBotMesh.receiveShadow = true;
    bkBotMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(bkBotMesh);

    // b) Middle oven niche: NO back panel (heat ventilation as specified in oven.backPanel: false)!

    // c) Top back panel (behind top storage, bottomH + ovenH to bodyH)
    var bkTopH = Math.max(10, bodyH - (bottomH + ovenH) - 18);
    var bkTopGeo = new THREE.BoxGeometry(innerW, bkTopH, 12);
    var bkTopMesh = new THREE.Mesh(bkTopGeo, carcassMat);
    bkTopMesh.position.set(0, plinthH + bottomH + ovenH + bkTopH / 2, -D / 2 + 6);
    bkTopMesh.castShadow = true; bkTopMesh.receiveShadow = true;
    bkTopMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(bkTopMesh);

    // 8. Built-in Oven Model in the Cavity (Y = plinthH + bottomH to plinthH + bottomH + ovenH)
    var ovenMeshGroup = new THREE.Group();
    ovenMeshGroup.name = "BuiltInOvenAppliance";

    var ovenBodyMat = new THREE.MeshStandardMaterial({ color: 0x1A1C20, metalness: 0.8, roughness: 0.3 });
    var ovenSteelMat = new THREE.MeshStandardMaterial({ color: 0xD8DCE2, metalness: 0.9, roughness: 0.2 });
    var ovenGlassMat = new THREE.MeshStandardMaterial({ color: 0x050709, roughness: 0.08, metalness: 0.9 });
    var ovenDisplayMat = new THREE.MeshStandardMaterial({ color: 0x00E5FF, emissive: 0x00B0FF, emissiveIntensity: 0.9 });

    var oW = innerW - 4;
    var oH = ovenH - 12;
    var oD = D - 40;

    var oBody = new THREE.Mesh(new THREE.BoxGeometry(oW, oH, oD), ovenBodyMat);
    oBody.position.set(0, plinthH + bottomH + ovenH / 2, -15);
    oBody.castShadow = true;
    ovenMeshGroup.add(oBody);

    var oGlass = new THREE.Mesh(new THREE.BoxGeometry(W - 8, oH * 0.72, 14), ovenGlassMat);
    oGlass.position.set(0, plinthH + bottomH + (oH * 0.72) / 2 + 6, D / 2 - 7);
    ovenMeshGroup.add(oGlass);

    var fasciaH = oH * 0.24;
    var oFascia = new THREE.Mesh(new THREE.BoxGeometry(W - 8, fasciaH, 16), ovenSteelMat);
    oFascia.position.set(0, plinthH + bottomH + ovenH - fasciaH / 2 - 8, D / 2 - 8);
    ovenMeshGroup.add(oFascia);

    var oDisp = new THREE.Mesh(new THREE.BoxGeometry(100, 24, 2), ovenDisplayMat);
    oDisp.position.set(0, plinthH + bottomH + ovenH - fasciaH / 2 - 8, D / 2);
    ovenMeshGroup.add(oDisp);

    var oHandle = new THREE.Mesh(new THREE.CylinderGeometry(7, 7, W * 0.7, 16), ovenSteelMat);
    oHandle.rotation.z = Math.PI / 2;
    oHandle.position.set(0, plinthH + bottomH + oH * 0.7 - 12, D / 2 + 14);
    ovenMeshGroup.add(oHandle);

    ovenMeshGroup.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    ovenMeshGroup.traverse(function(c) {
      if (c.isMesh) c.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    });
    fg.add(ovenMeshGroup);

    // 9. Bottom Shutter (Height: bottomH - 6)
    var bShW = W - 6;
    var bShH = Math.max(100, bottomH - 6);
    var bHingeX = -W / 2 + 3;
    var bHingeY = plinthH + bShH / 2 + 3;
    var bHingeZ = D / 2 - 9;

    var bHingeGroup = new THREE.Group();
    bHingeGroup.name = "ShutterHinge_Bottom";
    bHingeGroup.position.set(bHingeX, bHingeY, bHingeZ);
    bHingeGroup.userData = { isShutterHinge: true, shutterIdx: 0, furnitureId: furn.id };

    var bShMat = getShutterMaterial(0);
    var bShMesh = new THREE.Mesh(new THREE.BoxGeometry(bShW, bShH, 18), bShMat);
    bShMesh.position.set(bShW / 2, 0, 0);
    bShMesh.castShadow = true; bShMesh.receiveShadow = true;
    bShMesh.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 0, hingeGroup: bHingeGroup, parentGroup: fg, furnitureId: furn.id };
    bHingeGroup.add(bShMesh);

    var bHandle = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, bShH * 0.35));
    if (bHandle) {
      bHandle.position.set(bShW - 25, bShH * 0.3, 9);
      bHandle.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 0, hingeGroup: bHingeGroup, parentGroup: fg, furnitureId: furn.id };
      bHandle.traverse(function (c) {
        if (c.isMesh) c.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 0, hingeGroup: bHingeGroup, parentGroup: fg, furnitureId: furn.id };
      });
      bHingeGroup.add(bHandle);
    }

    var isBOpen = !!(furn.shutterStates && furn.shutterStates[0]);
    bHingeGroup.rotation.y = isBOpen ? -Math.PI * 0.6 : 0;
    fg.add(bHingeGroup);

    // 10. Top Shutter (Height: topH - 6)
    var tShW = W - 6;
    var tShH = Math.max(100, topH - 6);
    var tHingeX = -W / 2 + 3;
    var tHingeY = plinthH + bottomH + ovenH + tShH / 2 + 3;
    var tHingeZ = D / 2 - 9;

    var tHingeGroup = new THREE.Group();
    tHingeGroup.name = "ShutterHinge_Top";
    tHingeGroup.position.set(tHingeX, tHingeY, tHingeZ);
    tHingeGroup.userData = { isShutterHinge: true, shutterIdx: 1, furnitureId: furn.id };

    var tShMat = getShutterMaterial(1);
    var tShMesh = new THREE.Mesh(new THREE.BoxGeometry(tShW, tShH, 18), tShMat);
    tShMesh.position.set(tShW / 2, 0, 0);
    tShMesh.castShadow = true; tShMesh.receiveShadow = true;
    tShMesh.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 1, hingeGroup: tHingeGroup, parentGroup: fg, furnitureId: furn.id };
    tHingeGroup.add(tShMesh);

    var tHandle = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, tShH * 0.35));
    if (tHandle) {
      tHandle.position.set(tShW - 25, -tShH * 0.3, 9);
      tHandle.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 1, hingeGroup: tHingeGroup, parentGroup: fg, furnitureId: furn.id };
      tHandle.traverse(function (c) {
        if (c.isMesh) c.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 1, hingeGroup: tHingeGroup, parentGroup: fg, furnitureId: furn.id };
      });
      tHingeGroup.add(tHandle);
    }

    var isTOpen = !!(furn.shutterStates && furn.shutterStates[1]);
    tHingeGroup.rotation.y = isTOpen ? -Math.PI * 0.6 : 0;
    fg.add(tHingeGroup);

    // Position and rotate unit
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) : 0);
    fg.position.set(furn.pos.x, elev, furn.pos.y);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;

    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Placed 3D Furniture Unit
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildFurnitureMesh = function (furn) {
    var fg = new THREE.Group();
    fg.name = 'Furniture_' + furn.id;
    fg.userData = { isFurniture: true, isFurnitureGroup: true, furnitureId: furn.id, furniture: furn };

    var dims = furn.dimensions || { W: 1200, H: 2100, D: 600 };
    dims = {
      W: parseFloat(dims.W) || 1200,
      H: parseFloat(dims.H) || 2100,
      D: parseFloat(dims.D) || 600
    };
    var cat = (furn.category || 'wardrobe').toLowerCase();
    var name = (furn.name || '').toLowerCase();
    var isDecor = !!(furn.isDecor || furn.excludeFromPricing || cat === 'decor' || cat === 'appliance_decor' || furn.decorType);
    if (isDecor) {
      return this.buildDecorMesh(furn, fg, dims);
    }
    var isBed = (cat === 'bed' || name.indexOf('bed') !== -1);
    var isOpenBox = (cat === 'spice_rack' ||
                     (cat.indexOf('open') !== -1 && cat.indexOf('shutter') === -1) ||
                     (name.indexOf('open box') !== -1 || name.indexOf('open storage') !== -1) ||
                     (furn.unitConfig && (furn.unitConfig.doorType === 'open' || furn.unitConfig.type === 'open')));
    var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
      window.OrbixCore.isWallUnit(cat, name, furn.code || furn.catalogItemId, furn.costCategory) :
      (cat.indexOf('wall') !== -1 || cat === 'wm-01' || cat === 'k_wall' || cat === 'kitchen_wall' ||
       cat === 'crockery_wall' || cat === 'spice_rack' || cat.indexOf('overhead') !== -1 ||
       cat.indexOf('loft') !== -1 || name.indexOf('wall') !== -1 || name.indexOf('overhead') !== -1 ||
       name.indexOf('spice rack') !== -1 || name.indexOf('loft') !== -1 ||
       /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(name));
    var isKitchen = (cat === 'kitchen_base' || cat === 'kitchen_wall');
    var isBase = !isWall && (cat === 'kitchen_base' || cat === 'crockery' || cat === 'vanity' || cat.indexOf('base') !== -1 || cat === 'tv_unit' || (name && name.toLowerCase().indexOf('base') !== -1));

    // Carcass Materials (Resolves finish name, laminate code, or hex)
    var carcassRaw = (furn.unitConfig && furn.unitConfig.carcass) ||
                     (furn.materials && furn.materials.carcass && furn.materials.carcass.finish) ||
                     furn.carcassColor ||
                     'MDF 1135';
    var carcassColor = ArchitecturalRenderer.resolveFinishColor(carcassRaw, 0xEDEBE4);
    var carcassIsGloss = String(carcassRaw).toLowerCase().indexOf('gloss') !== -1;
    var carcassMat = new THREE.MeshStandardMaterial({
      color: carcassColor,
      roughness: carcassIsGloss ? 0.2 : 0.6,
      metalness: 0.05
    });

    // Door style & type
    var dstyle = (furn.unitConfig && furn.unitConfig.dstyle) || 'slab';
    var doorType = (furn.unitConfig && (furn.unitConfig.doorType || furn.unitConfig.type)) || 'hinged';

    // Handle Configuration & Material
    var handleType = (furn.unitConfig && furn.unitConfig.handle) || furn.handleType || 'bar';
    var handleFinish = (furn.unitConfig && (furn.unitConfig.hfinish || furn.unitConfig.handleFinish)) || furn.handleFinish || 'black';
    var handleMat = ArchitecturalRenderer.getHandleMaterial(handleFinish);

    // Countertop
    var counterColorName = (furn.unitConfig && furn.unitConfig.counter) || (isKitchen ? 'black' : (isBase ? 'black' : 'none'));
    var counterHex = 0x1A1A1D;
    if (counterColorName === 'white' || counterColorName === 'marble') counterHex = 0xF5F5F7;
    else if (counterColorName === 'quartz') counterHex = 0xF5F5F7;
    else if (counterColorName === 'greyq') counterHex = 0x8E9297;
    else if (counterColorName === 'beige') counterHex = 0xE6DFD5;
    else if (counterColorName === 'green') counterHex = 0x2A3E30;
    else if (counterColorName === 'galaxy') counterHex = 0x18181A;
    else if (counterColorName !== 'none' && counterColorName !== 'black') {
      counterHex = ArchitecturalRenderer.resolveFinishColor(counterColorName, 0x1A1A1D);
    }
    var counterMat = new THREE.MeshStandardMaterial({
      color: counterHex,
      roughness: (counterColorName === 'white' || counterColorName === 'marble' || counterColorName === 'quartz') ? 0.12 : 0.22,
      metalness: 0.08
    });

    var isTvOrVanity = (cat === 'tv_unit' || cat === 'vanity' || (name && (name.indexOf('tv') !== -1 || name.indexOf('vanity') !== -1)));
    var isWardrobeOrTall = (cat === 'wardrobe' || cat === 'kitchen_tall' || (name && (name.indexOf('wardrobe') !== -1 || name.indexOf('tall') !== -1 || name.indexOf('tbm') !== -1)));

    // Legs / Plinth determination (Wardrobes/Tall units get legs; TV/Vanity configurable)
    var hasLegs = false;
    if (!isWall) {
      if (furn.unitConfig && furn.unitConfig.hasLegs !== undefined) {
        hasLegs = !!furn.unitConfig.hasLegs;
      } else if (furn.unitConfig && furn.unitConfig.mountType !== undefined) {
        hasLegs = (furn.unitConfig.mountType !== 'floating');
      } else if (isTvOrVanity) {
        var elevVal = parseFloat(furn.elevation || (furn.pos && furn.pos.z) || 0);
        hasLegs = (elevVal <= 50);
      } else if (isWardrobeOrTall || isBase) {
        hasLegs = true;
      }
    }
    var plinthH = hasLegs ? 100 : 0;
    var counterH = (isBase && counterColorName !== 'none') ? 35 : 0;
    var bodyH = Math.max(100, dims.H - plinthH - counterH);
    var innerW = dims.W - 36;
    var innerD = dims.D - 20;

    // Helper: Material for individual shutter s (Prioritizes user's edited finish!)
    function getShutterMaterial(sIdx) {
      var matFin = (furn.unitConfig && furn.unitConfig.shutterCol) ||
                   (furn.materials && furn.materials.shutter && furn.materials.shutter.finish) ||
                   (furn.shutterMaterials && furn.shutterMaterials[sIdx]) ||
                   (furn.shutterColors && furn.shutterColors[sIdx]) ||
                   'MDF 3410';

      var threeCol = ArchitecturalRenderer.resolveFinishColor(matFin, 0x6E4E35);
      var isGloss = String(matFin).toLowerCase().indexOf('gloss') !== -1;
      var isWood = String(matFin).toLowerCase().indexOf('wood') !== -1 ||
                   String(matFin).toLowerCase().indexOf('oak') !== -1 ||
                   String(matFin).toLowerCase().indexOf('walnut') !== -1 ||
                   String(matFin).toLowerCase().indexOf('teak') !== -1;

      return new THREE.MeshStandardMaterial({
        color: threeCol,
        roughness: isGloss ? 0.15 : (isWood ? 0.45 : 0.6),
        metalness: 0.04
      });
    }

    // 1. Architectural Wall Paneling / Back Panel (zero carcass)
    var isWallPanel = (cat === 'wall_paneling' || furn.id === 'pnl-back' || furn.catalogItemId === 'pnl-back' || (name && (name.indexOf('back panel') !== -1 || name.indexOf('wall panel') !== -1 || name.indexOf('vertical ledge') !== -1)));
    if (isWallPanel) {
      return this.buildWallPanelMesh(furn, fg, dims, carcassMat);
    }

    // 2. O/S (Only Shutter) Unit (zero carcass box)
    var isOnlyShutter = !!(
      (cat && (cat === 'loft_os' || cat === 'kitchen_o_s' || cat.indexOf('o/s') !== -1 || cat.indexOf('os') !== -1)) ||
      (furn.costCategory && furn.costCategory.indexOf('O/S') !== -1) ||
      (furn.modelType && /o_s|os/i.test(furn.modelType)) ||
      (name && /\bo\/?s\b/i.test(name)) ||
      (furn.id && /\bo_?s\b/i.test(furn.id)) ||
      (furn.code && /\bo_?s\b/i.test(furn.code))
    );
    if (isOnlyShutter) {
      return this.buildOnlyShutterMesh(furn, fg, dims, carcassMat, getShutterMaterial, handleType, handleMat);
    }

    var isLCorner = !!(
      (furn.unitConfig && (furn.unitConfig.geometryType === 'l_shaped_corner' || furn.unitConfig.unitType === 'fbcm' || (furn.unitConfig.corner && furn.unitConfig.corner.enabled))) ||
      furn.catalogItemId === 'fbcm' || furn.id === 'fbcm' || furn.id === 'f_fbcm_1' ||
      (furn.id && /fbcm/i.test(furn.id)) ||
      (furn.catalogItemId && /fbcm/i.test(furn.catalogItemId)) ||
      (furn.name && /l[-_ ]*shaped.*corner/i.test(furn.name))
    );
    if (isLCorner) {
      return this.buildLCornerCabinetMesh(furn, fg, dims, carcassMat, counterMat, plinthH, bodyH, counterH, getShutterMaterial, handleType, handleMat, isBase, isKitchen);
    }

    var isOvenTall = !!(
      (furn.unitConfig && (furn.unitConfig.geometryType === 'oven_tall' || furn.unitConfig.unitType === 'oven_tall_unit' || furn.unitConfig.unitType === 'tbm-60-oven' || (furn.unitConfig.oven && furn.unitConfig.oven.enabled))) ||
      furn.catalogItemId === 'tbm-60-oven' || furn.id === 'tbm-60-oven' ||
      (furn.id && /tbm[-_ ]*60[-_ ]*oven/i.test(furn.id)) ||
      (furn.catalogItemId && /tbm[-_ ]*60[-_ ]*oven/i.test(furn.catalogItemId)) ||
      (furn.name && /tbm[-_ ]*60[-_ ]*oven/i.test(furn.name)) ||
      (furn.name && /oven.*tall/i.test(furn.name))
    );
    if (isOvenTall) {
      return this.buildOvenTallCabinetMesh(furn, fg, dims, carcassMat, getShutterMaterial, handleType, handleMat);
    }

    if (isBed) {

      // High-Fidelity 3D Bed with Headboard, Frame, and Mattress

      var headboardH = Math.min(1100, Math.max(850, dims.H));

      var headboardT = 70;

      var bedFrameH = 360;

      var mattressH = 200;

      var mattressInset = 30;



      // 1. Headboard (against back wall)

      var hbGeo = new THREE.BoxGeometry(dims.W, headboardH, headboardT);

      var hbMat = new THREE.MeshStandardMaterial({

        color: carcassColor,

        roughness: 0.5,

        metalness: 0.05

      });

      var hbMesh = new THREE.Mesh(hbGeo, hbMat);

      hbMesh.position.set(0, headboardH / 2, -dims.D / 2 + headboardT / 2);

      hbMesh.castShadow = true; hbMesh.receiveShadow = true;

      hbMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };

      fg.add(hbMesh);



      // 2. Bed Base Frame

      var frameD = dims.D - headboardT;

      var frameGeo = new THREE.BoxGeometry(dims.W - 10, bedFrameH, frameD);

      var frameMat = new THREE.MeshStandardMaterial({ color: carcassColor, roughness: 0.6 });

      var frameMesh = new THREE.Mesh(frameGeo, frameMat);

      frameMesh.position.set(0, bedFrameH / 2, -dims.D / 2 + headboardT + frameD / 2);

      frameMesh.castShadow = true; frameMesh.receiveShadow = true;

      frameMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };

      fg.add(frameMesh);



      // 3. Mattress (Soft fabric finish)

      var matW = dims.W - 2 * mattressInset;

      var matD = frameD - mattressInset;

      var matGeo = new THREE.BoxGeometry(matW, mattressH, matD);

      var matMat = new THREE.MeshStandardMaterial({ color: 0xF5F5F7, roughness: 0.9, metalness: 0 });

      var matMesh = new THREE.Mesh(matGeo, matMat);

      matMesh.position.set(0, bedFrameH + mattressH / 2, -dims.D / 2 + headboardT + matD / 2 + 10);

      matMesh.castShadow = true; matMesh.receiveShadow = true;

      matMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };

      fg.add(matMesh);



      // 4. Pillows (Two plush pillows at headboard)

      var pW = Math.min(550, (matW - 40) / 2);

      var pD = 380;

      var pH = 110;

      var pGeo = new THREE.BoxGeometry(pW, pH, pD);

      var pMat = new THREE.MeshStandardMaterial({ color: 0xEDEBE4, roughness: 0.95 });

      var p1 = new THREE.Mesh(pGeo, pMat);

      p1.position.set(-matW / 4, bedFrameH + mattressH + pH / 2, -dims.D / 2 + headboardT + pD / 2 + 25);

      p1.rotation.x = 0.15;

      p1.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };

      fg.add(p1);



      var p2 = new THREE.Mesh(pGeo, pMat);

      p2.position.set(matW / 4, bedFrameH + mattressH + pH / 2, -dims.D / 2 + headboardT + pD / 2 + 25);

      p2.rotation.x = 0.15;

      p2.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };

      fg.add(p2);



      // Position bed group

      var bElev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== "") ? parseFloat(furn.elevation) : 0;

      fg.position.set(furn.pos.x, bElev, furn.pos.y);

      fg.rotation.y = -(furn.rotY || 0);

      fg.visible = true;

      return fg;

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

    // 5b. Vertical Partition (for units with multiple sections or FCM-RT/FCM-LT)
    var isFcmUnit = !!(
      (furn.unitConfig && furn.unitConfig.fixedPanel && furn.unitConfig.fixedPanel.enabled) ||
      (furn.unitConfig && (furn.unitConfig.unitType === 'fcm-rt' || furn.unitConfig.unitType === 'fcm-lt')) ||
      (furn.id && /fcm[-_ ]*(rt|lt)/i.test(furn.id)) ||
      (furn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(furn.catalogItemId)) ||
      (furn.name && /fcm[-_ ]*(rt|lt)/i.test(furn.name)) ||
      furn.id === 'fcm-rt' || furn.catalogItemId === 'fcm-rt' ||
      furn.id === 'fm-rt-01' || furn.catalogItemId === 'fm-rt-01' ||
      furn.id === 'fcm-lt' || furn.catalogItemId === 'fcm-lt' ||
      furn.id === 'fm-lt-01' || furn.catalogItemId === 'fm-lt-01'
    );
    var numSections = (furn.unitConfig && furn.unitConfig.sections) ? parseInt(furn.unitConfig.sections) : (isFcmUnit ? 2 : (dims.W > 1200 ? 2 : 1));
    if (numSections > 1 || isFcmUnit) {
      var dividerX = isFcmUnit ? (-dims.W / 2 + 18 + (dims.W - 36) / 2) : 0;
      var divGeo = new THREE.BoxGeometry(18, bodyH - 36, innerD - 10);
      var divMesh = new THREE.Mesh(divGeo, carcassMat);
      divMesh.position.set(dividerX, plinthH + bodyH / 2, -10);
      divMesh.castShadow = true; divMesh.receiveShadow = true;
      divMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(divMesh);
    }

    // 6. Internal Shelves
    if (bodyH > 650 || (furn.unitConfig && furn.unitConfig.shelves > 0) || isFcmUnit) {
      var numShelves = (furn.unitConfig && furn.unitConfig.shelves !== undefined) ? parseInt(furn.unitConfig.shelves) : (bodyH > 1400 ? 3 : 1);
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
      (isOpenBox ? 0 : ((drawersCount > 0 && dims.H < 1000) ? 0 : (dims.W > 1200 ? 3 : dims.W > 600 ? 2 : 1)));

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
        var dhGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, false, Math.min(180, (dims.W - 30) * 0.45));
        if (dhGroup) {
          dhGroup.position.set(0, 0, dims.D / 2);
          dhGroup.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
          dhGroup.traverse(function (c) {
            if (c.isMesh) {
              c.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
            }
          });
          drawerGroup.add(dhGroup);
        }

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

    // 8. Front Shutters (Hinged or Sliding Mechanisms)
    var hasFixedPanel = isFcmUnit || !!(
      (furn.unitConfig && furn.unitConfig.fixedPanel && furn.unitConfig.fixedPanel.enabled) ||
      (furn.unitConfig && furn.unitConfig.unitType === 'fcm-rt') ||
      (furn.id && /fcm[-_ ]*rt/i.test(furn.id)) ||
      (furn.catalogItemId && /fcm[-_ ]*rt/i.test(furn.catalogItemId)) ||
      (furn.name && /fcm[-_ ]*rt/i.test(furn.name)) ||
      furn.id === 'fcm-rt' || furn.catalogItemId === 'fcm-rt' ||
      furn.id === 'fm-rt-01' || furn.catalogItemId === 'fm-rt-01'
    );
    if (numShutters > 0 || hasFixedPanel) {
      var isSliding = (furn.unitConfig && (furn.unitConfig.doorType === "sliding" || furn.unitConfig.type === "sliding")) ||
                      furn.doorType === "sliding" ||
                      furn.type === "sliding" ||
                      (furn.modelType && /sliding/i.test(furn.modelType)) ||
                      (furn.id && /sliding/i.test(furn.id)) ||
                      (furn.name && /sliding/i.test(furn.name));

      var shutterBaseY = plinthH + totalDrawersH + 3;

      if (isSliding) {
        // Sliding Doors on Dual Tracks
        var slideCount = Math.max(2, numShutters);
        var slideW = (dims.W / slideCount) + 30; // Overlapping center margin
        var slideH = Math.max(150, bodyH - totalDrawersH - 8);
        var slideCenterY = shutterBaseY + slideH / 2;

        for (var sl = 0; sl < slideCount; sl++) {
          var isFrontTrack = (sl % 2 === 0);
          var trackZ = dims.D / 2 - (isFrontTrack ? 4 : 22);
          var closedX = -dims.W / 2 + slideW / 2 + sl * ((dims.W - slideW) / Math.max(1, slideCount - 1));
          var slideDir = isFrontTrack ? 1 : -1;
          var openOffset = slideDir * (slideW * 0.85);
          var openX = closedX + openOffset;

          var slideGroup = new THREE.Group();
          slideGroup.name = "ShutterSlide_" + sl;
          slideGroup.userData = {
            isShutterGroup: true,
            isSliding: true,
            shutterIdx: sl,
            furnitureId: furn.id,
            closedX: closedX,
            openX: openX,
            slideDir: slideDir
          };

          var isOpenSlide = !!(furn.shutterStates && furn.shutterStates[sl]);
          slideGroup.position.set(isOpenSlide ? openX : closedX, slideCenterY, trackZ);

          if (dstyle === 'glass' || dstyle === 'aluglass') {
            var frameMat = (dstyle === 'aluglass') ? new THREE.MeshStandardMaterial({ color: 0x1A1A1A, metalness: 0.8, roughness: 0.2 }) : carcassMat;
            var glassMat = new THREE.MeshStandardMaterial({ color: 0x88CCEE, transparent: true, opacity: 0.42, roughness: 0.1, metalness: 0.1 });
            var slBorder = new THREE.Mesh(new THREE.BoxGeometry(slideW, slideH, 18), frameMat);
            slBorder.castShadow = true;
            slBorder.userData = { isFurniturePart: true, isShutter: true, isSliding: true, shutterIdx: sl, shutterGroup: slideGroup, parentGroup: fg, furnitureId: furn.id };
            slideGroup.add(slBorder);
            var slGlass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(10, slideW - 60), Math.max(10, slideH - 60), 6), glassMat);
            slGlass.position.set(0, 0, 1);
            slGlass.userData = { isFurniturePart: true, isShutter: true, isSliding: true, shutterIdx: sl, shutterGroup: slideGroup, parentGroup: fg, furnitureId: furn.id };
            slideGroup.add(slGlass);
          } else if (dstyle === 'shaker') {
            var slMat = getShutterMaterial(sl);
            var slBorder = new THREE.Mesh(new THREE.BoxGeometry(slideW, slideH, 18), slMat);
            slBorder.castShadow = true;
            slBorder.userData = { isFurniturePart: true, isShutter: true, isSliding: true, shutterIdx: sl, shutterGroup: slideGroup, parentGroup: fg, furnitureId: furn.id };
            slideGroup.add(slBorder);
            var slCenter = new THREE.Mesh(new THREE.BoxGeometry(Math.max(10, slideW - 70), Math.max(10, slideH - 70), 10), slMat);
            slCenter.position.set(0, 0, -3);
            slCenter.userData = { isFurniturePart: true, isShutter: true, isSliding: true, shutterIdx: sl, shutterGroup: slideGroup, parentGroup: fg, furnitureId: furn.id };
            slideGroup.add(slCenter);
          } else {
            var slGeo = new THREE.BoxGeometry(slideW, slideH, 18);
            var slMesh = new THREE.Mesh(slGeo, getShutterMaterial(sl));
            slMesh.castShadow = true;
            slMesh.receiveShadow = true;
            slMesh.userData = {
              isFurniturePart: true,
              isShutter: true,
              isSliding: true,
              shutterIdx: sl,
              shutterGroup: slideGroup,
              parentGroup: fg,
              furnitureId: furn.id
            };
            slideGroup.add(slMesh);
          }

          // Handle for sliding door (placed near outer edge)
          var slHGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, slideH * 0.35));
          if (slHGroup) {
            var handleOffset = isFrontTrack ? (-slideW / 2 + 25) : (slideW / 2 - 25);
            slHGroup.position.set(handleOffset, (isBase || drawersCount > 0) ? slideH * 0.25 : 0, 9);
            slHGroup.userData = { isFurniturePart: true, isShutter: true, isSliding: true, shutterIdx: sl, shutterGroup: slideGroup, parentGroup: fg, furnitureId: furn.id };
            slHGroup.traverse(function (c) {
              if (c.isMesh) {
                c.userData = { isFurniturePart: true, isShutter: true, isSliding: true, shutterIdx: sl, shutterGroup: slideGroup, parentGroup: fg, furnitureId: furn.id };
              }
            });
            slideGroup.add(slHGroup);
          }

          fg.add(slideGroup);
        }
      } else if (hasFixedPanel) {
        // FCM Modular Unit with 1 Fixed Panel & 1 Movable Shutter (FCM-RT or FCM-LT)
        var isLeftOpen = !!(
          (furn.unitConfig && furn.unitConfig.openShutter && furn.unitConfig.openShutter.opening === 'left') ||
          (furn.unitConfig && furn.unitConfig.unitType === 'fcm-lt') ||
          (furn.id && /fcm[-_ ]*lt/i.test(furn.id)) ||
          (furn.catalogItemId && /fcm[-_ ]*lt/i.test(furn.catalogItemId)) ||
          (furn.name && /fcm[-_ ]*lt/i.test(furn.name)) ||
          furn.id === 'fcm-lt' || furn.catalogItemId === 'fcm-lt' ||
          furn.id === 'fm-lt-01' || furn.catalogItemId === 'fm-lt-01'
        );
        var fixW = (furn.unitConfig && furn.unitConfig.fixedPanel && furn.unitConfig.fixedPanel.width) || (dims.W / 2);
        var movW = dims.W - fixW - 6;
        var shH = Math.max(150, bodyH - totalDrawersH - 6);
        var shutterCenterY = shutterBaseY + shH / 2;

        if (isLeftOpen) {
          // ── FCM-LT (Cookscape): Left 600mm OPENS TO LEFT, Right 600mm is 100% FIXED ──
          // 1. Right Fixed Panel (Static, NEVER opens, flush, NO handle)
          var fixCx = dims.W / 2 - 3 - (fixW - 3) / 2;
          var fixMesh = new THREE.Mesh(new THREE.BoxGeometry(fixW - 3, shH, 18), getShutterMaterial(1));
          fixMesh.position.set(fixCx, shutterCenterY, dims.D / 2 - 9);
          fixMesh.castShadow = true;
          fixMesh.receiveShadow = true;
          fixMesh.userData = { isFurniturePart: true, isFixedPanel: true, parentGroup: fg, furnitureId: furn.id };
          fg.add(fixMesh);

          // 2. Left Movable Shutter (Hinged on the LEFT outer edge, opens outwards to the left)
          var hingeX = -dims.W / 2 + 3;
          var hingeZ = dims.D / 2 - 9;

          var hingeGroup = new THREE.Group();
          hingeGroup.name = "ShutterHinge_Left";
          hingeGroup.position.set(hingeX, shutterCenterY, hingeZ);
          hingeGroup.userData = { isShutterHinge: true, shutterIdx: 0, furnitureId: furn.id };

          var localX = movW / 2;
          var movMesh = new THREE.Mesh(new THREE.BoxGeometry(movW, shH, 18), getShutterMaterial(0));
          movMesh.position.set(localX, 0, 0);
          movMesh.castShadow = true;
          movMesh.receiveShadow = true;
          movMesh.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
          hingeGroup.add(movMesh);

          // Shutter Pull Handle (Vertical, placed near the inner right opening edge of left door)
          var hGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, shH * 0.35));
          if (hGroup) {
            var handleX = movW - 35; // Near opening edge on the right of the door
            var handleY = (isBase || drawersCount > 0) ? shH * 0.25 : 0;
            hGroup.position.set(handleX, handleY, 9);
            hGroup.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            hGroup.traverse(function (c) {
              if (c.isMesh) {
                c.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
              }
            });
            hingeGroup.add(hGroup);
          }

          // Shutter Open / Close rotation: swings outwards to the left
          var isOpen = !!(furn.shutterStates && furn.shutterStates[0]);
          hingeGroup.rotation.y = isOpen ? -Math.PI * 0.55 : 0;
          fg.add(hingeGroup);
        } else {
          // ── FCM-RT (Cookscape): Left 600mm is 100% FIXED, Right 600mm OPENS TO RIGHT ──
          // 1. Left Fixed Panel (Static, NEVER opens, flush, NO handle)
          var fixCx = -dims.W / 2 + 3 + (fixW - 3) / 2;
          var fixMesh = new THREE.Mesh(new THREE.BoxGeometry(fixW - 3, shH, 18), getShutterMaterial(0));
          fixMesh.position.set(fixCx, shutterCenterY, dims.D / 2 - 9);
          fixMesh.castShadow = true;
          fixMesh.receiveShadow = true;
          fixMesh.userData = { isFurniturePart: true, isFixedPanel: true, parentGroup: fg, furnitureId: furn.id };
          fg.add(fixMesh);

          // 2. Right Movable Shutter (Hinged on the RIGHT edge, opens outwards to the right)
          var movLeftX = -dims.W / 2 + 3 + fixW + 3;
          var hingeX = movLeftX + movW; // Hinge is at the far right edge!
          var hingeZ = dims.D / 2 - 9;

          var hingeGroup = new THREE.Group();
          hingeGroup.name = "ShutterHinge_Right";
          hingeGroup.position.set(hingeX, shutterCenterY, hingeZ);
          hingeGroup.userData = { isShutterHinge: true, shutterIdx: 0, furnitureId: furn.id };

          var localX = -movW / 2;
          var movMesh = new THREE.Mesh(new THREE.BoxGeometry(movW, shH, 18), getShutterMaterial(1));
          movMesh.position.set(localX, 0, 0);
          movMesh.castShadow = true;
          movMesh.receiveShadow = true;
          movMesh.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
          hingeGroup.add(movMesh);

          // Shutter Pull Handle (Vertical, placed near the left/opening edge of the right door)
          var hGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, shH * 0.35));
          if (hGroup) {
            var handleX = -movW + 35; // Near opening edge!
            var handleY = (isBase || drawersCount > 0) ? shH * 0.25 : 0;
            hGroup.position.set(handleX, handleY, 9);
            hGroup.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            hGroup.traverse(function (c) {
              if (c.isMesh) {
                c.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
              }
            });
            hingeGroup.add(hGroup);
          }

          // Shutter Open / Close rotation: swings outwards to the right
          var isOpen = !!(furn.shutterStates && furn.shutterStates[0]);
          hingeGroup.rotation.y = isOpen ? Math.PI * 0.55 : 0;
          fg.add(hingeGroup);
        }
      } else {
        // Standard Hinged Shutters
        var shW = (dims.W - (numShutters + 1) * 3) / numShutters;
        var shH = Math.max(150, bodyH - totalDrawersH - 6);
        var hingeY = shutterBaseY + shH / 2;

        for (var s = 0; s < numShutters; s++) {
          var hingeLeft = (s % 2 === 0);
          var sLeftX = -dims.W / 2 + 3 + s * (shW + 3);
          var hingeX = hingeLeft ? sLeftX : (sLeftX + shW);
          var hingeZ = dims.D / 2 - 9;

          var hingeGroup = new THREE.Group();
          hingeGroup.name = "ShutterHinge_" + s;
          hingeGroup.position.set(hingeX, hingeY, hingeZ);
          hingeGroup.userData = { isShutterHinge: true, shutterIdx: s, furnitureId: furn.id };

          var localX = hingeLeft ? (shW / 2) : (-shW / 2);
          if (dstyle === 'glass' || dstyle === 'aluglass') {
            var hFrameMat = (dstyle === 'aluglass') ? new THREE.MeshStandardMaterial({ color: 0x1A1A1A, metalness: 0.8, roughness: 0.2 }) : carcassMat;
            var hGlassMat = new THREE.MeshStandardMaterial({ color: 0x88CCEE, transparent: true, opacity: 0.42, roughness: 0.1, metalness: 0.1 });
            var hBorder = new THREE.Mesh(new THREE.BoxGeometry(shW, shH, 18), hFrameMat);
            hBorder.position.set(localX, 0, 0);
            hBorder.castShadow = true;
            hBorder.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            hingeGroup.add(hBorder);

            var hGlass = new THREE.Mesh(new THREE.BoxGeometry(Math.max(10, shW - 60), Math.max(10, shH - 60), 6), hGlassMat);
            hGlass.position.set(localX, 0, 1);
            hGlass.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            hingeGroup.add(hGlass);
          } else if (dstyle === 'shaker') {
            var hMat = getShutterMaterial(s);
            var hBorderS = new THREE.Mesh(new THREE.BoxGeometry(shW, shH, 18), hMat);
            hBorderS.position.set(localX, 0, 0);
            hBorderS.castShadow = true;
            hBorderS.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            hingeGroup.add(hBorderS);

            var hCenterS = new THREE.Mesh(new THREE.BoxGeometry(Math.max(10, shW - 70), Math.max(10, shH - 70), 10), hMat);
            hCenterS.position.set(localX, 0, -3);
            hCenterS.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            hingeGroup.add(hCenterS);
          } else {
            var sGeo = new THREE.BoxGeometry(shW, shH, 18);
            var sMesh = new THREE.Mesh(sGeo, getShutterMaterial(s));
            sMesh.position.set(localX, 0, 0);
            sMesh.castShadow = true;
            sMesh.receiveShadow = true;
            sMesh.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            hingeGroup.add(sMesh);
          }

          // Shutter Pull Handle (Vertical)
          var hGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, shH * 0.35));
          if (hGroup) {
            var handleX = hingeLeft ? (shW - 25) : (-shW + 25);
            var handleY = (isBase || drawersCount > 0) ? shH * 0.25 : 0;
            hGroup.position.set(handleX, handleY, 9);
            hGroup.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            hGroup.traverse(function (c) {
              if (c.isMesh) {
                c.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
              }
            });
            hingeGroup.add(hGroup);
          }

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
    }

    // Position and rotate unit (with elevation from finished floor level!)
    var isLoftUnit = (cat.indexOf('loft') !== -1 || name.indexOf('loft') !== -1 || (furn.id && furn.id.indexOf('loft') !== -1));
    var defElevUnit = isLoftUnit ? 2100 : (isWall ? 1500 : 0);
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) :
        defElevUnit);
    fg.position.set(furn.pos.x, elev, furn.pos.y);
    fg.rotation.y = -(furn.rotY || 0);

    // Placed modular unit is always visible inside 3D architectural room
    fg.visible = true;

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
