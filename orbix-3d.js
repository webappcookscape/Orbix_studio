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

  // Material options sanitizer to guarantee 100% compatibility across Three.js versions (e.g. r128)
  // In Three.js r128, sheen is a THREE.Color (or null), NOT a scalar number.
  // Passing a numeric sheen (e.g. 0.12) causes gl.uniform3fv to fail with:
  // "TypeError: Failed to execute 'uniform3fv' on 'WebGL2RenderingContext': The object must have a callable @@iterator property"
  // Furthermore, sheenRoughness and thickness are not supported in r128 and log console warnings.
  function sanitizeMaterialOptions(opts) {
    if (!opts || typeof opts !== 'object') return opts;
    if ('sheen' in opts) {
      if (typeof opts.sheen === 'number') {
        if (opts.sheen > 0 && typeof THREE !== 'undefined' && THREE.Color) {
          opts.sheen = new THREE.Color().setScalar(opts.sheen);
        } else {
          delete opts.sheen;
        }
      }
    }
    if ('sheenRoughness' in opts) delete opts.sheenRoughness;
    if ('thickness' in opts) delete opts.thickness;
    return opts;
  }

  function hookPhysicalMaterialSafeguards() {
    if (typeof THREE !== 'undefined' && THREE.MeshPhysicalMaterial && THREE.MeshPhysicalMaterial.prototype && !THREE.MeshPhysicalMaterial._sanitizerHooked) {
      THREE.MeshPhysicalMaterial._sanitizerHooked = true;
      var origSetValues = THREE.MeshPhysicalMaterial.prototype.setValues;
      if (origSetValues) {
        THREE.MeshPhysicalMaterial.prototype.setValues = function (values) {
          if (values) sanitizeMaterialOptions(values);
          return origSetValues.call(this, values);
        };
      }
    }
  }
  hookPhysicalMaterialSafeguards();

  function ArchitecturalRenderer(scene, opts) {
    hookPhysicalMaterialSafeguards();
    this.scene = scene;
    this.opts = opts || {};
    this.group = null;
    this.materials = {};
    this.selectedFloorType = 'white_tile';
    this.dadoTileEnabled = (typeof window !== 'undefined' && window.dadoTileEnabled !== undefined) ? window.dadoTileEnabled : true;
    this.ceilingEnabled = (typeof window !== 'undefined' && window.ceilingEnabled !== undefined) ? !!window.ceilingEnabled : false;
    this.isolatedRoomId = null;
    this.initMaterials();
  }

  ArchitecturalRenderer.sanitizeMaterialOptions = sanitizeMaterialOptions;

  ArchitecturalRenderer._floorTextures = ArchitecturalRenderer._floorTextures || {};
  ArchitecturalRenderer._floorMaterials = ArchitecturalRenderer._floorMaterials || {};
  ArchitecturalRenderer._countertopTextures = ArchitecturalRenderer._countertopTextures || {};

  // Realistic Granite & Stone Countertop Material Generator
  ArchitecturalRenderer.getCountertopMaterial = function (counterColorName, dims) {
    dims = dims || { W: 600, D: 600 };
    counterColorName = counterColorName || 'granite_kashmir_white';
    var MatClass = (typeof THREE.MeshPhysicalMaterial === 'function') ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;

    // Check if texture exists in ORBIX_COUNTERTOP_TEXTURES
    var b64 = null;
    if (typeof window !== 'undefined' && window.ORBIX_COUNTERTOP_TEXTURES) {
      b64 = window.ORBIX_COUNTERTOP_TEXTURES[counterColorName];
      if (!b64 && (counterColorName === 'black' || counterColorName === 'galaxy' || counterColorName === 'granite_1' || counterColorName === 'granite_black_galaxy')) {
        b64 = window.ORBIX_COUNTERTOP_TEXTURES.granite_black_galaxy;
      } else if (!b64 && (counterColorName === 'white' || counterColorName === 'kashmir_white' || counterColorName === 'river_white' || counterColorName === 'granite_2' || counterColorName === 'granite_kashmir_white')) {
        b64 = window.ORBIX_COUNTERTOP_TEXTURES.granite_kashmir_white;
      } else if (!b64 && (counterColorName === 'tan_brown' || counterColorName === 'brown' || counterColorName === 'granite_3' || counterColorName === 'granite_tan_brown')) {
        b64 = window.ORBIX_COUNTERTOP_TEXTURES.granite_tan_brown;
      }
    }

    if (b64 && typeof THREE !== 'undefined' && typeof Image !== 'undefined') {
      var texKey = counterColorName + '_' + Math.round(dims.W) + '_' + Math.round(dims.D);
      var tex = ArchitecturalRenderer._countertopTextures[texKey];
      if (!tex) {
        var img = new Image();
        tex = new THREE.Texture(img);
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        var repX = Math.max(1, (dims.W || 600) / 600);
        var repY = Math.max(1, (dims.D || 600) / 600);
        tex.repeat.set(repX, repY);
        if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
        if (tex.anisotropy !== undefined) tex.anisotropy = 8;
        img.onload = function () {
          tex.needsUpdate = true;
          if (typeof window !== 'undefined' && window.__cc && window.__cc.gl && typeof window.__cc.gl.render === 'function') {
            window.__cc.gl.render();
          }
        };
        img.src = b64;
        ArchitecturalRenderer._countertopTextures[texKey] = tex;
      }

      return new MatClass({
        map: tex,
        bumpMap: tex,
        bumpScale: 0.015,
        roughness: 0.65,
        metalness: 0.02,
        clearcoat: 0.0,
        clearcoatRoughness: 0.0,
        reflectivity: 0.20,
        envMapIntensity: 0.45
      });
    }

    // Fallback procedural/color finish
    var counterHex = 0x1A1A1D;
    if (counterColorName === 'white' || counterColorName === 'marble') counterHex = 0xF5F5F7;
    else if (counterColorName === 'quartz') counterHex = 0xF5F5F7;
    else if (counterColorName === 'greyq') counterHex = 0x8E9297;
    else if (counterColorName === 'beige') counterHex = 0xE6DFD5;
    else if (counterColorName === 'green') counterHex = 0x2A3E30;
    else if (counterColorName === 'galaxy' || counterColorName === 'granite_black_galaxy') counterHex = 0x18181A;
    else if (counterColorName === 'granite_kashmir_white') counterHex = 0xEDEAE5;
    else if (counterColorName === 'granite_tan_brown') counterHex = 0x3D2B22;
    else if (counterColorName !== 'none' && counterColorName !== 'black') {
      counterHex = ArchitecturalRenderer.resolveFinishColor(counterColorName, 0x1A1A1D);
    }

    return new MatClass({
      color: counterHex,
      roughness: 0.65,
      metalness: 0.02,
      clearcoat: 0.0,
      clearcoatRoughness: 0.0,
      reflectivity: 0.20,
      envMapIntensity: 0.45
    });
  };

  // Built-in Gas HOB Cooktop Builder for Countertop Integration
  ArchitecturalRenderer.buildBuiltInHob = function (fg, W, D, counterTopY, furnId) {
    if (typeof THREE === 'undefined') return;
    var hobW = Math.min(W - 30, 580);
    var hobD = Math.min(D - 30, 480);
    var hobH = 8;

    var hobGlassMat = (typeof THREE.MeshPhysicalMaterial === 'function') ?
      new THREE.MeshPhysicalMaterial({ color: 0x111315, roughness: 0.05, metalness: 0.9, clearcoat: 1.0, reflectivity: 0.9 }) :
      new THREE.MeshStandardMaterial({ color: 0x111315, roughness: 0.08, metalness: 0.9 });
    var hobBezelMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.88, roughness: 0.22 });
    var trivetMat = new THREE.MeshStandardMaterial({ color: 0x1E2024, roughness: 0.85, metalness: 0.35 });
    var brassMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.85, roughness: 0.2 });
    var knobMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.92, roughness: 0.15 });

    var hobGroup = new THREE.Group();
    hobGroup.name = 'BuiltInHob';
    hobGroup.position.set(0, counterTopY, 0);

    // Bezel Frame
    var bezel = new THREE.Mesh(new THREE.BoxGeometry(hobW + 4, hobH, hobD + 4), hobBezelMat);
    bezel.position.set(0, hobH / 2, 0);
    bezel.castShadow = true; bezel.receiveShadow = true;
    hobGroup.add(bezel);

    // Toughened Glass Top
    var glass = new THREE.Mesh(new THREE.BoxGeometry(hobW, hobH + 2, hobD), hobGlassMat);
    glass.position.set(0, hobH / 2 + 1, 0);
    glass.castShadow = true; glass.receiveShadow = true;
    hobGroup.add(glass);

    // Burners (2 or 3 depending on width)
    var numBurners = (hobW >= 550) ? 3 : 2;
    var burnerOffsets = (numBurners === 3) ? [-hobW * 0.28, 0, hobW * 0.28] : [-hobW * 0.24, hobW * 0.24];

    burnerOffsets.forEach(function (bx, bIdx) {
      var bZ = (numBurners === 3 && bIdx === 1) ? -hobD * 0.12 : 0;
      var tray = new THREE.Mesh(new THREE.CylinderGeometry(55, 60, 4, 28), hobBezelMat);
      tray.position.set(bx, hobH + 3, bZ);
      hobGroup.add(tray);

      var brassRing = new THREE.Mesh(new THREE.CylinderGeometry(36, 40, 6, 24), brassMat);
      brassRing.position.set(bx, hobH + 6, bZ);
      hobGroup.add(brassRing);

      var burnerCap = new THREE.Mesh(new THREE.CylinderGeometry(30, 30, 4, 24), trivetMat);
      burnerCap.position.set(bx, hobH + 9, bZ);
      hobGroup.add(burnerCap);

      var sp1 = new THREE.Mesh(new THREE.BoxGeometry(100, 8, 8), trivetMat);
      var sp2 = new THREE.Mesh(new THREE.BoxGeometry(8, 8, 100), trivetMat);
      sp1.position.set(bx, hobH + 8, bZ);
      sp2.position.set(bx, hobH + 8, bZ);
      sp1.castShadow = true; sp2.castShadow = true;
      hobGroup.add(sp1); hobGroup.add(sp2);
    });

    // Front Control Knobs
    var knobOffsets = [-hobW * 0.2, 0, hobW * 0.2];
    knobOffsets.forEach(function (kx) {
      var knob = new THREE.Mesh(new THREE.CylinderGeometry(9, 10, 8, 18), knobMat);
      knob.position.set(kx, hobH + 5, hobD / 2 - 22);
      knob.rotation.x = Math.PI / 12;
      hobGroup.add(knob);
    });

    fg.add(hobGroup);
  };

  // Built-in Kitchen Sink Builder for Countertop Integration
  ArchitecturalRenderer.buildBuiltInSink = function (fg, W, D, counterTopY, furnId) {
    if (typeof THREE === 'undefined') return;
    var sinkW = Math.min(W - 30, 620);
    var sinkD = Math.min(D - 30, 480);
    var rimH = 6;

    var sSteelMat = new THREE.MeshStandardMaterial({ color: 0xD8DDE2, metalness: 0.92, roughness: 0.18 });
    var darkSinkMat = new THREE.MeshStandardMaterial({ color: 0x4A525D, metalness: 0.85, roughness: 0.35 });
    var chromeFaucetMat = (typeof THREE.MeshPhysicalMaterial === 'function') ?
      new THREE.MeshPhysicalMaterial({ color: 0xF8FAFC, metalness: 0.98, roughness: 0.04, clearcoat: 1.0 }) :
      new THREE.MeshStandardMaterial({ color: 0xF0F2F5, metalness: 0.98, roughness: 0.08 });

    var sinkGroup = new THREE.Group();
    sinkGroup.name = 'BuiltInSink';
    sinkGroup.position.set(0, counterTopY, 0);

    // Rim Frame
    var rimMesh = new THREE.Mesh(new THREE.BoxGeometry(sinkW, rimH, sinkD), sSteelMat);
    rimMesh.position.set(0, rimH / 2, 0);
    rimMesh.castShadow = true; rimMesh.receiveShadow = true;
    sinkGroup.add(rimMesh);

    // Basin Cavity (Offset left)
    var basinW = sinkW * 0.54, basinD = sinkD * 0.8, basinH = 170, basinX = -sinkW * 0.18;
    var basinWallMat = new THREE.MeshStandardMaterial({ color: 0xB8C0C8, metalness: 0.88, roughness: 0.25, side: THREE.DoubleSide });

    var basinFloor = new THREE.Mesh(new THREE.BoxGeometry(basinW - 12, 6, basinD - 12), sSteelMat);
    basinFloor.position.set(basinX, -basinH + 3, 0);
    basinFloor.receiveShadow = true;
    sinkGroup.add(basinFloor);

    var bL = new THREE.Mesh(new THREE.BoxGeometry(6, basinH, basinD), basinWallMat);
    bL.position.set(basinX - basinW / 2 + 3, -basinH / 2, 0);
    var bR = new THREE.Mesh(new THREE.BoxGeometry(6, basinH, basinD), basinWallMat);
    bR.position.set(basinX + basinW / 2 - 3, -basinH / 2, 0);
    var bF = new THREE.Mesh(new THREE.BoxGeometry(basinW, basinH, 6), basinWallMat);
    bF.position.set(basinX, -basinH / 2, basinD / 2 - 3);
    var bB = new THREE.Mesh(new THREE.BoxGeometry(basinW, basinH, 6), basinWallMat);
    bB.position.set(basinX, -basinH / 2, -basinD / 2 + 3);
    sinkGroup.add(bL); sinkGroup.add(bR); sinkGroup.add(bF); sinkGroup.add(bB);

    // Waste Strainer
    var strainer = new THREE.Mesh(new THREE.CylinderGeometry(32, 28, 5, 24), darkSinkMat);
    strainer.position.set(basinX, -basinH + 5, 0);
    sinkGroup.add(strainer);

    // Drainboard Grooves (Right side)
    var dbW = sinkW * 0.34, dbD = sinkD * 0.76, dbX = sinkW * 0.26;
    for (var r = 0; r < 5; r++) {
      var ribZ = -dbD / 2 + 25 + r * ((dbD - 50) / 4);
      var rib = new THREE.Mesh(new THREE.BoxGeometry(dbW - 16, 3, 8), sSteelMat);
      rib.position.set(dbX, rimH + 1, ribZ);
      sinkGroup.add(rib);
    }

    // Chrome Arched Gooseneck Mixer Faucet
    var fZ = -basinD / 2 + 15;
    var faucetBase = new THREE.Mesh(new THREE.CylinderGeometry(16, 20, 22, 20), chromeFaucetMat);
    faucetBase.position.set(basinX, rimH + 11, fZ);
    sinkGroup.add(faucetBase);

    var stem = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 140, 16), chromeFaucetMat);
    stem.position.set(basinX, rimH + 22 + 70, fZ);
    sinkGroup.add(stem);

    var spoutArc = new THREE.Mesh(new THREE.CylinderGeometry(7.5, 7.5, 95, 16), chromeFaucetMat);
    spoutArc.position.set(basinX, rimH + 22 + 150, fZ + 45);
    spoutArc.rotation.x = Math.PI / 2.8;
    sinkGroup.add(spoutArc);

    var nozzle = new THREE.Mesh(new THREE.CylinderGeometry(10, 8, 22, 16), chromeFaucetMat);
    nozzle.position.set(basinX, rimH + 22 + 130, fZ + 85);
    sinkGroup.add(nozzle);

    var handleLever = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 45, 12), chromeFaucetMat);
    handleLever.position.set(basinX + 22, rimH + 35, fZ);
    handleLever.rotation.z = Math.PI / 3;
    sinkGroup.add(handleLever);

    fg.add(sinkGroup);
  };

  // Floor Texture Generator: supports 'tile_1', 'tile_2', 'tile_3' (User uploads via ORBIX_FLOOR_TEXTURES), 'white_tile', 'square_tile', 'grey_tile', 'wooden'
  ArchitecturalRenderer.createFloorTexture = function (type) {
    type = type || 'white_tile';
    if (ArchitecturalRenderer._floorTextures[type]) return ArchitecturalRenderer._floorTextures[type];

    // Check if texture is in ORBIX_FLOOR_TEXTURES (base64 image from user uploads)
    var b64 = null;
    if (typeof window !== 'undefined' && window.ORBIX_FLOOR_TEXTURES) {
      b64 = window.ORBIX_FLOOR_TEXTURES[type];
      if (!b64 && (type === 'tile_1' || type === 'designer_tile_1' || type === 'custom_tile_1' || type === 'floor_tile_1')) {
        b64 = window.ORBIX_FLOOR_TEXTURES.tile_1;
      } else if (!b64 && (type === 'tile_2' || type === 'designer_tile_2' || type === 'custom_tile_2' || type === 'floor_tile_2')) {
        b64 = window.ORBIX_FLOOR_TEXTURES.tile_2;
      } else if (!b64 && (type === 'tile_3' || type === 'designer_tile_3' || type === 'custom_tile_3' || type === 'floor_tile_3')) {
        b64 = window.ORBIX_FLOOR_TEXTURES.tile_3;
      }
    }
    if (b64 && typeof THREE !== 'undefined' && typeof Image !== 'undefined') {
      var img = new Image();
      var tex = new THREE.Texture(img);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
      if (tex.anisotropy !== undefined) tex.anisotropy = 8;
      img.onload = function () {
        tex.needsUpdate = true;
        if (typeof window !== 'undefined' && window.__cc && window.__cc.gl && typeof window.__cc.gl.render === 'function') {
          window.__cc.gl.render();
        }
      };
      img.src = b64;
      ArchitecturalRenderer._floorTextures[type] = tex;
      return tex;
    }

    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    if (type === 'tile_1' || type === 'designer_tile_1' || type === 'custom_tile_1') {
      // Warm Crema Marfil / Ivory Vitrified Tile (2x2 quad, 600x600mm individual tiles)
      ctx.fillStyle = '#C8BFA7'; // Grout line
      ctx.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 2; i++) {
        for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          var slabGrad = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
          slabGrad.addColorStop(0, '#F5EDE2');
          slabGrad.addColorStop(0.5, '#ECE2D3');
          slabGrad.addColorStop(1, '#E4D7C5');
          ctx.fillStyle = slabGrad;
          ctx.fillRect(tx, ty, tw, th);

          // Subtle perimeter bevel highlight
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);

          // Delicate warm amber / gold marble veining
          ctx.strokeStyle = 'rgba(180, 140, 95, 0.28)';
          ctx.lineWidth = 1.8;
          ctx.beginPath();
          ctx.moveTo(tx + 20, ty + 30);
          ctx.bezierCurveTo(tx + 95, ty + 90, tx + 140, ty + 165, tx + 230, ty + 220);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(195, 160, 120, 0.22)';
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(tx + 110, ty + 110);
          ctx.bezierCurveTo(tx + 165, ty + 100, tx + 200, ty + 135, tx + 242, ty + 150);
          ctx.stroke();
        }
      }
    } else if (type === 'tile_2' || type === 'designer_tile_2' || type === 'custom_tile_2') {
      // Warm Mocha Breccia / Onyx Vitrified Tile (2x2 quad, 600x600mm individual tiles)
      ctx.fillStyle = '#4B3F38'; // Dark mocha grout line
      ctx.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 2; i++) {
        for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          var slabGrad = ctx.createLinearGradient(tx, ty, tx + tw, ty + th);
          slabGrad.addColorStop(0, '#C2AF9F');
          slabGrad.addColorStop(0.5, '#B5A08F');
          slabGrad.addColorStop(1, '#A48F7E');
          ctx.fillStyle = slabGrad;
          ctx.fillRect(tx, ty, tw, th);

          // Subtle perimeter bevel highlight
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);

          // Dark slate-brown marble veining & breccia clusters
          ctx.strokeStyle = 'rgba(75, 60, 50, 0.38)';
          ctx.lineWidth = 2.0;
          ctx.beginPath();
          ctx.moveTo(tx + 25, ty + 20);
          ctx.bezierCurveTo(tx + 85, ty + 100, tx + 150, ty + 150, tx + 235, ty + 230);
          ctx.stroke();

          ctx.strokeStyle = 'rgba(165, 125, 90, 0.30)';
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.moveTo(tx + 180, ty + 30);
          ctx.bezierCurveTo(tx + 120, ty + 90, tx + 70, ty + 180, tx + 40, ty + 240);
          ctx.stroke();
        }
      }
    } else if (type === 'white_tile') {
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
    ArchitecturalRenderer._floorTextures[type] = tex;
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

  ArchitecturalRenderer.createWoodGrainBumpTexture = function () {
    if (ArchitecturalRenderer._woodBumpTex) return ArchitecturalRenderer._woodBumpTex;
    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 256;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    // Tactile wood pore micro-relief
    for (var sl = 0; sl < 36; sl++) {
      var y = sl * 7;
      ctx.strokeStyle = (sl % 2 === 0) ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(256, y + (Math.sin(sl * 0.45) * 4.5));
      ctx.stroke();
    }
    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(4, 4);
    ArchitecturalRenderer._woodBumpTex = tex;
    return tex;
  };

  ArchitecturalRenderer._dadoTextures = {};
  ArchitecturalRenderer._dadoMaterials = {};

  // Dado Tile Backsplash Texture: supports 'rhombus_sage' (Sage Diamond Cube), 'chevron_mono' (Mono Split Chevron), and 'subway_white'
  ArchitecturalRenderer.createDadoTileTexture = function (style) {
    style = style || (typeof window !== 'undefined' && window.dadoTileStyle) || 'rhombus_sage';
    if (ArchitecturalRenderer._dadoTextures[style]) return ArchitecturalRenderer._dadoTextures[style];

    // Check if texture is in ORBIX_DADO_TEXTURES (base64 image from user uploads)
    var b64 = (typeof window !== 'undefined' && window.ORBIX_DADO_TEXTURES && window.ORBIX_DADO_TEXTURES[style]);
    if (b64 && typeof THREE !== 'undefined' && typeof Image !== 'undefined') {
      var img = new Image();
      var tex = new THREE.Texture(img);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(1, 1);
      if (THREE.sRGBEncoding !== undefined) tex.encoding = THREE.sRGBEncoding;
      if (tex.anisotropy !== undefined) tex.anisotropy = 8;
      img.onload = function () {
        tex.needsUpdate = true;
      };
      img.src = b64;
      ArchitecturalRenderer._dadoTextures[style] = tex;
      return tex;
    }

    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Base ceramic grout background
    ctx.fillStyle = '#D6D3D1';
    ctx.fillRect(0, 0, 512, 512);

    // Staggered subway / modular dado tiles (8 rows x 4 columns)
    var rowH = 64;
    var colW = 128;
    for (var r = 0; r < 8; r++) {
      var y = r * rowH;
      var xOffset = (r % 2 === 1) ? colW / 2 : 0;
      for (var c = -1; c < 5; c++) {
        var x = c * colW + xOffset;
        var tw = colW - 4;
        var th = rowH - 4;

        // Glazed ceramic gradient
        var grad = ctx.createLinearGradient(x, y + 2, x + tw, y + th);
        grad.addColorStop(0, '#FFFFFF');
        grad.addColorStop(0.5, '#F8F9FA');
        grad.addColorStop(1, '#E9ECEF');
        ctx.fillStyle = grad;
        ctx.fillRect(x + 2, y + 2, tw, th);

        // Top-left bevel highlight
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + 2, y + th + 2);
        ctx.lineTo(x + 2, y + 2);
        ctx.lineTo(x + tw + 2, y + 2);
        ctx.stroke();

        // Bottom-right subtle bevel shadow
        ctx.strokeStyle = 'rgba(160, 160, 160, 0.35)';
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(x + tw + 2, y + 2);
        ctx.lineTo(x + tw + 2, y + th + 2);
        ctx.lineTo(x + 2, y + th + 2);
        ctx.stroke();
      }
    }

    var subwayTex = new THREE.CanvasTexture(canvas);
    subwayTex.wrapS = subwayTex.wrapT = THREE.RepeatWrapping;
    subwayTex.repeat.set(1, 1);
    if (THREE.sRGBEncoding !== undefined) subwayTex.encoding = THREE.sRGBEncoding;
    if (subwayTex.anisotropy !== undefined) subwayTex.anisotropy = 8;
    ArchitecturalRenderer._dadoTextures[style] = subwayTex;
    return subwayTex;
  };

  ArchitecturalRenderer.prototype.createDadoTileMaterial = function (style) {
    if (typeof THREE === 'undefined') return null;
    style = style || (typeof window !== 'undefined' && window.dadoTileStyle) || 'rhombus_sage';
    if (ArchitecturalRenderer._dadoMaterials[style]) return ArchitecturalRenderer._dadoMaterials[style];
    var tex = ArchitecturalRenderer.createDadoTileTexture(style);
    var mat = new THREE.MeshStandardMaterial({
      color: 0xF8F9FA,
      map: tex,
      roughness: 0.24,
      metalness: 0.02,
      envMapIntensity: 0.85
    });
    ArchitecturalRenderer._dadoMaterials[style] = mat;
    return mat;
  };

  ArchitecturalRenderer.createContactShadowTexture = function () {
    if (ArchitecturalRenderer._contactShadowTex) return ArchitecturalRenderer._contactShadowTex;
    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = 128; canvas.height = 128;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;
    var grad = ctx.createRadialGradient(64, 64, 12, 64, 64, 62);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.42)');
    grad.addColorStop(0.45, 'rgba(0, 0, 0, 0.20)');
    grad.addColorStop(0.85, 'rgba(0, 0, 0, 0.05)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);
    var tex = new THREE.CanvasTexture(canvas);
    ArchitecturalRenderer._contactShadowTex = tex;
    return tex;
  };

  ArchitecturalRenderer.createContactShadowPlane = function (w, d) {
    if (typeof THREE === 'undefined' || typeof document === 'undefined') return null;
    var tex = ArchitecturalRenderer.createContactShadowTexture();
    if (!tex) return null;
    var geo = new THREE.PlaneGeometry(Math.max(100, w + 40), Math.max(100, d + 40));
    var mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      opacity: 0.38,
      depthWrite: false
    });
    var m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.userData = { isContactShadow: true };
    return m;
  };

  ArchitecturalRenderer.createUnderCabinetLight = function (w, d) {
    if (typeof THREE === 'undefined') return null;
    var group = new THREE.Group();
    group.name = 'UnderCabinetLED';
    // Emissive slim diffuser strip
    var stripW = Math.max(100, w - 40);
    var stripGeo = new THREE.BoxGeometry(stripW, 4, 12);
    var stripMat = new THREE.MeshStandardMaterial({
      color: 0xFFFBEB,
      emissive: 0xFDE68A,
      emissiveIntensity: 0.9,
      roughness: 0.3
    });
    var stripMesh = new THREE.Mesh(stripGeo, stripMat);
    stripMesh.position.set(0, 2, -10);
    group.add(stripMesh);

    // Downward warm task light
    if (typeof THREE.PointLight !== 'undefined') {
      var pLight = new THREE.PointLight(0xFFE8C4, 0.42, 1200, 2);
      pLight.position.set(0, -10, -10);
      group.add(pLight);
    }
    return group;
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
        color: 0x4E8A42, // Lush natural grass green (warm ecru / sage)
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
    }
    type = type || this.selectedFloorType || 'white_tile';
    var tex = ArchitecturalRenderer.createFloorTexture(type);
    var isWood = (type === 'wooden' || type === 'tile_3' || type === 'designer_tile_3' || type === 'floor_tile_3');
    var isWhite = (type === 'white_tile');
    var isCustomTile = (type === 'tile_1' || type === 'designer_tile_1' || type === 'custom_tile_1' || type === 'floor_tile_1' ||
      type === 'tile_2' || type === 'designer_tile_2' || type === 'custom_tile_2' || type === 'floor_tile_2' ||
      type === 'tile_3' || type === 'designer_tile_3' || type === 'custom_tile_3' || type === 'floor_tile_3');

    // Architectural PBR Physical Floor Tile Finish with calibrated specular sheen & clearcoat
    var MatClass = (typeof THREE.MeshPhysicalMaterial === 'function') ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    return new MatClass({
      map: tex,
      roughness: isWood ? 0.38 : (isCustomTile ? 0.16 : (isWhite ? 0.18 : 0.22)),
      metalness: 0.02,
      clearcoat: isWood ? 0.15 : 0.72,
      clearcoatRoughness: 0.06,
      reflectivity: isWood ? 0.45 : 0.85,
      polygonOffset: true,
      polygonOffsetFactor: -1.0,
      polygonOffsetUnits: -1.0,
      side: THREE.DoubleSide
    });
  };

  // Helper: Retrieve Base Hex Color for any Floor Tile Finish
  ArchitecturalRenderer.getFloorTileColor = function (type) {
    if (type === 'square_tile') return 0xDFD7CA; // Warm travertine ivory
    if (type === 'grey_tile') return 0x3E424B;   // Charcoal basalt slate
    if (type === 'wooden') return 0xB38256;      // Warm oak hardwood
    if (type === 'tile_1' || type === 'designer_tile_1' || type === 'custom_tile_1' || type === 'floor_tile_1') return 0xF1F2F1; // Statuario White Marble Tile
    if (type === 'tile_2' || type === 'designer_tile_2' || type === 'custom_tile_2' || type === 'floor_tile_2') return 0x98999B; // Charcoal Grey Basalt Tile
    if (type === 'tile_3' || type === 'designer_tile_3' || type === 'custom_tile_3' || type === 'floor_tile_3') return 0x99785C; // Warm Teak Plank Flooring Tile
    return 0xEDECEF;                             // White Calacatta marble tile (default)
  };

  ArchitecturalRenderer.prototype.setFloorMaterial = function (type, targetRoomId) {
    this.selectedFloorType = type || 'white_tile';
    this.materials.floorTile = this.createFloorMaterial(this.selectedFloorType);
    this.materials.floorWood = (this.selectedFloorType === 'wooden' ? this.materials.floorTile : this.createFloorMaterial('wooden'));

    // Dynamic Skirting: Inherits exact chosen floor tile texture, color, and PBR clearcoat
    var skirtingTileColor = ArchitecturalRenderer.getFloorTileColor(this.selectedFloorType);
    var floorMat = this.materials.floorTile;
    var MatClass = (typeof THREE.MeshPhysicalMaterial === 'function') ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    var isWood = (this.selectedFloorType === 'wooden' || this.selectedFloorType === 'tile_3' || this.selectedFloorType === 'designer_tile_3' || this.selectedFloorType === 'floor_tile_3');

    this.materials.skirting = new MatClass({
      color: (floorMat && floorMat.color) ? floorMat.color : skirtingTileColor,
      map: (floorMat && floorMat.map) ? floorMat.map : null,
      roughness: isWood ? 0.38 : 0.18,
      metalness: 0.02,
      clearcoat: isWood ? 0.20 : 0.70,
      clearcoatRoughness: 0.06
    });

    if (this.group) {
      var self = this;
      var tileSize = (this.selectedFloorType === 'wooden') ? 1200 : (this.selectedFloorType === 'white_tile' ? 1600 : 1200);
      this.group.traverse(function (o) {
        if (o.userData && o.userData.isSkirting) {
          o.material = self.materials.skirting;
        }
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
            var normAttr = o.geometry.attributes.normal;
            var fDepth = (o.userData && o.userData.floorDepth) || 20;
            for (var v = 0; v < posAttr.count; v++) {
              var vx = posAttr.getX(v);
              var vy = posAttr.getY(v);
              var vz = posAttr.getZ(v);
              var nz = normAttr ? Math.abs(normAttr.getZ(v)) : 1;
              if (nz > 0.5) {
                uvAttr.setXY(v, vx / tileSize, -vy / tileSize);
              } else {
                var horiz = Math.hypot(vx, vy);
                uvAttr.setXY(v, horiz / tileSize, vz / Math.max(1, fDepth));
              }
            }
            uvAttr.needsUpdate = true;
          }
        }
      });
    }
  };

  ArchitecturalRenderer.prototype.initMaterials = function () {
    if (typeof THREE === 'undefined') return;

    var MatClass = (typeof THREE.MeshPhysicalMaterial === 'function') ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    var wallBump = ArchitecturalRenderer.createWallBumpTexture();

    // Wall Plaster: Architectural PBR Plaster with subtle tactile micro-pore relief & velvety sheen
    this.materials.wall = new MatClass({
      color: 0xB89F82, // Elegant authentic Dark Beige plaster
      roughness: 0.88,
      metalness: 0.0,
      clearcoat: 0.05,
      clearcoatRoughness: 0.6,
      reflectivity: 0.25,
      bumpMap: wallBump,
      bumpScale: 0.035
    });

    // Wall Core (Cutaway section interior)
    this.materials.wallCore = new MatClass({
      color: 0x9E836A, // Dark beige plaster core
      roughness: 0.9,
      metalness: 0.0
    });

    // Floor Finishes: Architectural Procedural PBR (Default: White Tile)
    this.selectedFloorType = this.selectedFloorType || 'white_tile';
    this.materials.floorTile = this.createFloorMaterial(this.selectedFloorType);
    this.materials.floorWood = this.createFloorMaterial('wooden');

    // Skirting Board: Dynamically inherits exact chosen floor tile texture, color, and PBR clearcoat
    var skirtingTileColor = ArchitecturalRenderer.getFloorTileColor(this.selectedFloorType);
    var floorMat = this.materials.floorTile;
    var isWood = (this.selectedFloorType === 'wooden' || this.selectedFloorType === 'tile_3' || this.selectedFloorType === 'designer_tile_3' || this.selectedFloorType === 'floor_tile_3');
    this.materials.skirting = new MatClass({
      color: (floorMat && floorMat.color) ? floorMat.color : skirtingTileColor,
      map: (floorMat && floorMat.map) ? floorMat.map : null,
      roughness: isWood ? 0.38 : 0.18,
      metalness: 0.02,
      clearcoat: isWood ? 0.20 : 0.70,
      clearcoatRoughness: 0.06
    });

    // Dado Tile Wall Finish (Backsplash)
    this.materials.dadoTile = this.createDadoTileMaterial();

    // Ceiling & False Ceiling (FrontSide facing downward -Y so bird's-eye camera looks inside cleanly)
    this.materials.ceiling = new MatClass({
      color: 0xF8FAFC,
      roughness: 0.92,
      metalness: 0.0,
      envMapIntensity: 0.45,
      side: THREE.FrontSide
    });

    // Tactile Wood Grain Bump Map
    var woodBump = ArchitecturalRenderer.createWoodGrainBumpTexture();

    // Door Wood & Frame (Rich Teak / Dark Walnut with micro-pore relief)
    this.materials.doorWood = new MatClass({
      color: 0x543B2B, // Dark Walnut / Teak
      roughness: 0.42,
      metalness: 0.06,
      clearcoat: 0.15,
      clearcoatRoughness: 0.3,
      bumpMap: woodBump,
      bumpScale: 0.025
    });

    this.materials.doorFrame = new MatClass({
      color: 0x332218, // Hardwood Frame
      roughness: 0.48,
      metalness: 0.10,
      bumpMap: woodBump,
      bumpScale: 0.02
    });

    this.materials.doorHandle = new THREE.MeshPhysicalMaterial({
      color: 0xD4AF37, // Polished Architectural Brass
      roughness: 0.22,
      metalness: 0.88,
      clearcoat: 0.4
    });

    // Window Aluminum Frame & Glazing
    this.materials.windowFrame = new MatClass({
      color: 0x1E2024, // Charcoal Architectural Aluminum
      roughness: 0.28,
      metalness: 0.85
    });

    this.materials.sillStone = new MatClass({
      color: 0xF5F3EE, // Polished white marble sill ledge
      roughness: 0.25,
      metalness: 0.04,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1
    });

    // Physical Glass: True physical transmission, optical IOR, clearcoat and subtle tint
    this.materials.glass = new THREE.MeshPhysicalMaterial({
      color: 0xD8ECF8,
      transparent: true,
      opacity: 0.28,
      roughness: 0.02,
      metalness: 0.02,
      transmission: 0.94,
      ior: 1.52,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 0.85,
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

    // Remove any existing home groups to eliminate stale meshes and old memos
    var oldHomes = [];
    if (this.scene.children && this.scene.children.length) {
      for (var ci = this.scene.children.length - 1; ci >= 0; ci--) {
        var child = this.scene.children[ci];
        if (child && (child.name === 'OrbixHome3D' || child === this.group)) {
          oldHomes.push(child);
        }
      }
    }
    for (var h = 0; h < oldHomes.length; h++) {
      this.scene.remove(oldHomes[h]);
      if (typeof this.disposeGroup === 'function') {
        this.disposeGroup(oldHomes[h]);
      }
    }
    this.group = null;

    this.group = new THREE.Group();
    this.group.name = 'OrbixHome3D';

    var plan = project;
    while (plan && plan.plan && (plan.plan.walls || plan.plan.furniture || plan.plan.rooms || plan.plan.plan)) {
      plan = plan.plan;
    }
    plan = plan || {};
    this.currentProject = project;
    this.currentPlan = plan;
    var floors = (plan.floors && plan.floors.length) ? plan.floors : [
      { id: 'ground', name: 'Ground Floor', level: 0, elevation: 0, isDefault: true }
    ];
    var activeFloorId = plan.activeFloor || 'ground';
    var floorsData = plan.floorsData || {};
    var viewMode = this.viewFloorMode || (typeof window !== 'undefined' && window.studioFloorMode ? window.studioFloorMode : 'all');

    if (viewMode === 'all' && floors.length > 1) {
      // Build full stacked multi-storey building!
      for (var flIdx = 0; flIdx < floors.length; flIdx++) {
        var fl = floors[flIdx];
        var flElev = fl.elevation !== undefined ? fl.elevation : (fl.level * 2800);
        var flData = (fl.id === activeFloorId) ? plan : (floorsData[fl.id] || { walls: [], openings: [], rooms: [], furniture: [], stairs: [] });
        var floorGrp = this.buildFloorGroup(flData, flElev, fl.id, null);
        if (floorGrp) {
          this.group.add(floorGrp);
        }
      }
    } else {
      // Single floor view (active or selected floor)
      var targetFlId = (viewMode === 'all' || viewMode === 'active') ? activeFloorId : viewMode;
      var targetFl = floors.find(function (f) { return f.id === targetFlId; }) || floors[0];
      var flData = (targetFl.id === activeFloorId) ? plan : (floorsData[targetFl.id] || { walls: [], openings: [], rooms: [], furniture: [], stairs: [] });
      var floorGrp = this.buildFloorGroup(flData, 0, targetFl.id, targetIsoId);
      if (floorGrp) {
        this.group.add(floorGrp);
      }
    }

    this.scene.add(this.group);
    return this.group;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Individual Floor Geometry Group (Extruded Walls, Floors, Ceilings, Units)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildFloorGroup = function (floorData, floorElevation, floorId, targetIsoId) {
    floorData = floorData || {};
    var floorGroup = new THREE.Group();
    floorGroup.name = 'OrbixFloor_' + (floorId || 'ground');
    floorGroup.position.y = floorElevation || 0;
    floorGroup.userData = { floorId: floorId, floorElevation: floorElevation };

    var walls = floorData.walls || [];
    var openings = floorData.openings || [];
    var rooms = floorData.rooms || [];
    var furniture = floorData.furniture || [];

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
        if (!w || !w.start || !w.end) return false;
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
      if (wallMeshGroup) {
        wallMeshGroup.userData.wallIndex = w;
        wallMeshGroup.userData.wallNumber = w + 1; // 1, 2, 3, 4
        floorGroup.add(wallMeshGroup);
      }
    }

    // 2. Build Room Floors & Optional Ceilings (with inner divided room holes to prevent overlap/glitches)
    var showCeiling = (typeof window !== 'undefined' && window.ceilingEnabled !== undefined)
      ? !!window.ceilingEnabled
      : !!this.ceilingEnabled;
    var defaultCeilingH = 2800;

    if (rooms && rooms.length > 0) {
      for (var r = 0; r < rooms.length; r++) {
        var room = rooms[r];
        var floorMesh = this.buildRoomFloor(room, rooms);
        if (floorMesh) floorGroup.add(floorMesh);

        if (showCeiling) {
          var ceilingMesh = this.buildRoomCeiling(room, rooms, defaultCeilingH);
          if (ceilingMesh) floorGroup.add(ceilingMesh);
        }

        // Photorealistic Interior Architectural Room Lighting
        var roomLightGroup = this.buildRoomInteriorLighting(room, defaultCeilingH);
        if (roomLightGroup) floorGroup.add(roomLightGroup);
      }
    } else {
      var fallbackFloor = this.buildBoundingFloor(walls, furniture);
      if (fallbackFloor) floorGroup.add(fallbackFloor);
      if (showCeiling && fallbackFloor && fallbackFloor.userData && fallbackFloor.userData.boundingRoom) {
        var fallbackCeil = this.buildRoomCeiling(fallbackFloor.userData.boundingRoom, null, defaultCeilingH);
        if (fallbackCeil) floorGroup.add(fallbackCeil);
      }
    }

    // 2b. Build Architectural Staircases in 3D
    var stairs = (floorData && floorData.stairs) || [];
    for (var sIdx = 0; sIdx < stairs.length; sIdx++) {
      var stairObj = stairs[sIdx];
      var stairMeshGroup = this.buildStaircaseMesh(stairObj);
      if (stairMeshGroup) {
        floorGroup.add(stairMeshGroup);
      }
    }

    // 3. Build Placed Furniture Units in 3D & associate with closest wall
    for (var f = 0; f < furniture.length; f++) {
      var furn = furniture[f];
      var furnMesh = this.buildFurnitureMesh(furn);
      if (furnMesh) {
        var bestWall = null, bestDist = 999999;
        if (furn.wallId) {
          var matchedWall = walls.find(function (wItem) { return wItem.id === furn.wallId; });
          if (matchedWall) {
            var matchedIdx = walls.indexOf(matchedWall);
            bestWall = { id: matchedWall.id, index: matchedIdx, number: matchedIdx + 1 };
          }
        }
        if (!bestWall && furn.pos && walls.length > 0) {
          for (var wi = 0; wi < walls.length; wi++) {
            var wObj = walls[wi];
            if (!wObj || !wObj.start || !wObj.end) continue;
            var p1 = wObj.start, p2 = wObj.end;
            var dx = p2.x - p1.x, dy = p2.y - p1.y;
            var lenSq = dx * dx + dy * dy;
            if (lenSq < 1) continue;
            var t = Math.max(0, Math.min(1, ((furn.pos.x - p1.x) * dx + (furn.pos.y - p1.y) * dy) / lenSq));
            var projX = p1.x + t * dx, projY = p1.y + t * dy;
            var dist = Math.hypot(furn.pos.x - projX, furn.pos.y - projY);
            if (dist < bestDist) {
              bestDist = dist;
              bestWall = { id: wObj.id, index: wi, number: wi + 1, dist: dist };
            }
          }
        }
        if (bestWall && (furn.wallId || bestDist < 1200)) {
          furnMesh.userData.wallId = bestWall.id;
          furnMesh.userData.wallIndex = bestWall.index;
          furnMesh.userData.wallNumber = bestWall.number;
        }
        floorGroup.add(furnMesh);
      }
    }

    return floorGroup;
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


  ArchitecturalRenderer.prototype.createWallFinishMaterial = function (wall) {
    if (typeof THREE === 'undefined') return this.materials.wall;
    if (!wall) return this.materials.wall;
    var wallpaper = wall.wallpaper || 'none';
    var finishType = wall.wallFinishType || 'paint';
    var paintHex = wall.paintColor || '#B89F82';
    var wLen = Core.wallLength(wall) || 3000;
    var wH = wall.height || 2800;

    function hexToInt(hex) {
      if (!hex) return 0xB89F82;
      var h = String(hex).replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var val = parseInt(h, 16);
      return isNaN(val) ? 0xB89F82 : val;
    }

    if (wallpaper && wallpaper !== 'none') {
      var c = document.createElement ? document.createElement('canvas') : null;
      if (c) {
        c.width = 512; c.height = 512;
        var ctx2 = c.getContext('2d');
        if (ctx2) {
          if (wallpaper === 'floral_blush') {
            ctx2.fillStyle = '#fdf2f8'; ctx2.fillRect(0, 0, 512, 512);
            for (var r = 0; r < 4; r++) {
              for (var col = 0; col < 4; col++) {
                var cx = col * 128 + 64, cy = r * 128 + 64;
                ctx2.fillStyle = '#f472b6'; ctx2.beginPath(); ctx2.arc(cx, cy, 22, 0, Math.PI * 2); ctx2.fill();
                ctx2.fillStyle = '#fb7185'; ctx2.beginPath(); ctx2.arc(cx + 26, cy - 14, 14, 0, Math.PI * 2); ctx2.fill();
                ctx2.fillStyle = '#fef08a'; ctx2.beginPath(); ctx2.arc(cx, cy, 8, 0, Math.PI * 2); ctx2.fill();
              }
            }
          } else if (wallpaper === 'geometric_teal') {
            ctx2.fillStyle = '#f0fdfa'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.strokeStyle = '#0f766e'; ctx2.lineWidth = 3.5;
            for (var i2 = 0; i2 <= 4; i2++) {
              for (var j2 = 0; j2 <= 4; j2++) {
                var gx = i2 * 128, gy = j2 * 128;
                ctx2.strokeRect(gx + 16, gy + 16, 96, 96);
                ctx2.strokeRect(gx + 36, gy + 36, 56, 56);
              }
            }
          } else if (wallpaper === 'stripe_gold') {
            ctx2.fillStyle = '#fefce8'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.fillStyle = '#ca8a04';
            for (var s = 0; s < 8; s++) { ctx2.fillRect(s * 64 + 18, 0, 28, 512); }
          } else if (wallpaper === 'herringbone_grey') {
            ctx2.fillStyle = '#f8fafc'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.strokeStyle = '#64748b'; ctx2.lineWidth = 3;
            for (var h = 0; h < 6; h++) {
              var hx = h * 90;
              ctx2.beginPath(); ctx2.moveTo(hx, 0); ctx2.lineTo(hx + 45, 128); ctx2.lineTo(hx + 90, 0); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(hx, 128); ctx2.lineTo(hx + 45, 256); ctx2.lineTo(hx + 90, 128); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(hx, 256); ctx2.lineTo(hx + 45, 384); ctx2.lineTo(hx + 90, 256); ctx2.stroke();
              ctx2.beginPath(); ctx2.moveTo(hx, 384); ctx2.lineTo(hx + 45, 512); ctx2.lineTo(hx + 90, 384); ctx2.stroke();
            }
          } else if (wallpaper === 'damask_cream') {
            ctx2.fillStyle = '#fffbeb'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.fillStyle = '#d97706'; ctx2.font = 'bold 72px serif';
            ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
            for (var dr = 0; dr < 3; dr++) {
              for (var dc = 0; dc < 3; dc++) {
                ctx2.fillText('✦', dc * 170 + 85, dr * 170 + 85);
              }
            }
          } else if (wallpaper === 'tropical_leaf') {
            ctx2.fillStyle = '#f0fdf4'; ctx2.fillRect(0, 0, 512, 512);
            ctx2.fillStyle = '#059669'; ctx2.font = '110px serif';
            ctx2.textAlign = 'center'; ctx2.textBaseline = 'middle';
            ctx2.fillText('🌿', 128, 128); ctx2.fillText('🍃', 384, 128);
            ctx2.fillText('🍃', 128, 384); ctx2.fillText('🌿', 384, 384);
          }
          var tex = new THREE.CanvasTexture(c);
          tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
          tex.repeat.set(Math.max(1, wLen / 1000), Math.max(1, wH / 1000));
          return new THREE.MeshStandardMaterial({
            map: tex,
            roughness: 0.85,
            metalness: 0.0
          });
        }
      }
    }

    var roughness = 0.88;
    var bump = ArchitecturalRenderer.createWallBumpTexture ? ArchitecturalRenderer.createWallBumpTexture() : null;
    if (finishType === 'concrete') roughness = 0.95;
    else if (finishType === 'brick') roughness = 0.95;
    else if (finishType === 'marble') roughness = 0.22;
    else if (finishType === 'texture') roughness = 0.92;

    var matParams = {
      color: hexToInt(paintHex),
      roughness: roughness,
      metalness: finishType === 'marble' ? 0.08 : 0.0,
      side: THREE.DoubleSide
    };
    if (bump) {
      matParams.bumpMap = bump;
      matParams.bumpScale = finishType === 'texture' ? 0.09 : 0.035;
    }
    return new THREE.MeshStandardMaterial(matParams);
  };

  ArchitecturalRenderer.prototype.buildWallWithCutouts = function (wall, ops) {
    if (!wall || !wall.start || !wall.end) return null;
    if (wall.isDivider) {
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
        if (!ow || !ow.start || !ow.end || ow.id === wall.id) continue;
        if (!startConn && Core.projectPointOnSegment(wall.start, ow.start, ow.end).dist <= 250) startConn = true;
        if (!endConn && Core.projectPointOnSegment(wall.end, ow.start, ow.end).dist <= 250) endConn = true;
      }
      if (!isUsedInRoom && (!startConn || !endConn)) {
        return null; // Suppress dangling / orphan divider in 3D!
      }
      return this.buildDividerThreshold(wall);
    }

    var group = new THREE.Group();
    group.name = 'Wall_' + wall.id;
    var wallMat = this.createWallFinishMaterial ? this.createWallFinishMaterial(wall) : this.materials.wall;

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
      skF.userData = { isSkirting: true };
      group.add(skF);
      var skB = new THREE.Mesh(skGeo, self.materials.skirting);
      skB.position.set(startX + len / 2, skH / 2, -wThick / 2 - skT / 2);
      skB.receiveShadow = true;
      skB.userData = { isSkirting: true };
      group.add(skB);
    }

    var hasWallDado = !!(wall && (wall.dadoTile || (wall.dadoSegments && wall.dadoSegments.length > 0)));

    function addDadoTile(startX, len, maxH) {
      var isEnabled = (typeof window !== 'undefined' && window.dadoTileEnabled !== undefined) ? window.dadoTileEnabled : self.dadoTileEnabled;
      var style = (wall && wall.dadoTileStyle) || (typeof window !== 'undefined' && window.dadoTileStyle) || 'rhombus_sage';
      var tileMat = self.createDadoTileMaterial(style) || self.materials.dadoTile;
      if (!isEnabled || !hasWallDado || !tileMat || len < 40) return;

      var segs = (wall && wall.dadoSegments && wall.dadoSegments.length > 0)
        ? wall.dadoSegments
        : [{ startOffset: 0, endOffset: wLen }];

      for (var si = 0; si < segs.length; si++) {
        var seg = segs[si];
        var sStart = Math.max(startX, seg.startOffset || 0);
        var sEnd = Math.min(startX + len, seg.endOffset !== undefined ? seg.endOffset : wLen);
        var subLen = sEnd - sStart;
        if (subLen < 40) continue;

        var dadoBottom = 850;
        var dadoTop = Math.min(maxH !== undefined ? maxH : 1500, wHeight - 50);
        if (dadoTop <= dadoBottom + 50) return;
        var dadoH = dadoTop - dadoBottom;
        var dadoT = 20; // Exact 20mm authentic ceramic & mortar bed tile depth (no paper-thin look)
        var DADO_TILE_MM = 609.6; // Exact 2ft x 2ft (609.6mm x 609.6mm) ceramic tile scale
        var dadoGeo = new THREE.BoxGeometry(subLen, dadoH, dadoT);
        if (dadoGeo.attributes && dadoGeo.attributes.uv && dadoGeo.attributes.position) {
          var dPos = dadoGeo.attributes.position;
          var dUv = dadoGeo.attributes.uv;
          var dNorm = dadoGeo.attributes.normal;
          for (var ui = 0; ui < dPos.count; ui++) {
            var lx = dPos.getX(ui);
            var ly = dPos.getY(ui);
            var lz = dPos.getZ(ui);
            var nx = dNorm ? Math.abs(dNorm.getX(ui)) : 0;
            var ny = dNorm ? Math.abs(dNorm.getY(ui)) : 0;
            if (nx > 0.5) {
              dUv.setXY(ui, (lz + dadoT / 2) / DADO_TILE_MM, (ly + dadoH / 2) / DADO_TILE_MM);
            } else if (ny > 0.5) {
              dUv.setXY(ui, (sStart + subLen / 2 + lx) / DADO_TILE_MM, (lz + dadoT / 2) / DADO_TILE_MM);
            } else {
              dUv.setXY(ui, (sStart + subLen / 2 + lx) / DADO_TILE_MM, (ly + dadoH / 2) / DADO_TILE_MM);
            }
          }
          dUv.needsUpdate = true;
        }
        // Determine whether dado tile should show on Front (+Z) or Back (-Z) face (strictly ONE side!)
        var dadoSide = wall.dadoSide || 'auto'; // 'front', 'back', or 'auto'
        if (dadoSide === 'auto') {
          var planObj = self.currentPlan || (self.currentProject && self.currentProject.plan);
          var furnList = (planObj && planObj.furniture) || [];
          var pRooms = (planObj && planObj.rooms) || [];
          var sideScorePlus = 0, sideScoreMinus = 0;

          var midSegX = sStart + subLen / 2;
          // In local coordinates, +Z is at +wThick/2, -Z is at -wThick/2
          // Local to global transform:
          // X_world = start.x + cos(angle) * midSegX - sin(angle) * localZ
          // Y_world = start.y + sin(angle) * midSegX + cos(angle) * localZ
          var testPtGlobalPlus = {
            x: start.x + Math.cos(angle) * midSegX - Math.sin(angle) * (wThick / 2 + 300),
            y: start.y + Math.sin(angle) * midSegX + Math.cos(angle) * (wThick / 2 + 300)
          };
          var testPtGlobalMinus = {
            x: start.x + Math.cos(angle) * midSegX + Math.sin(angle) * (wThick / 2 + 300),
            y: start.y + Math.sin(angle) * midSegX - Math.cos(angle) * (wThick / 2 + 300)
          };

          for (var fi = 0; fi < furnList.length; fi++) {
            var fn = furnList[fi];
            if (!fn || !fn.pos) continue;
            var dPlus = Math.hypot(fn.pos.x - testPtGlobalPlus.x, fn.pos.y - testPtGlobalPlus.y);
            var dMinus = Math.hypot(fn.pos.x - testPtGlobalMinus.x, fn.pos.y - testPtGlobalMinus.y);
            if (dPlus < 500) sideScorePlus += (550 - dPlus);
            if (dMinus < 500) sideScoreMinus += (550 - dMinus);
          }

          if (sideScorePlus === 0 && sideScoreMinus === 0 && pRooms.length > 0) {
            for (var rmi = 0; rmi < pRooms.length; rmi++) {
              var rPoly = pRooms[rmi].polygon;
              if (rPoly && Core.Vec2.pointInPolygon(testPtGlobalPlus, rPoly)) sideScorePlus += 100;
              if (rPoly && Core.Vec2.pointInPolygon(testPtGlobalMinus, rPoly)) sideScoreMinus += 100;
            }
          }

          dadoSide = (sideScoreMinus > sideScorePlus) ? 'back' : 'front';
        }

        if (dadoSide === 'front' || dadoSide === 'both') {
          var tileF = new THREE.Mesh(dadoGeo, tileMat);
          tileF.position.set(sStart + subLen / 2, dadoBottom + dadoH / 2, wThick / 2 + dadoT / 2);
          tileF.castShadow = true;
          tileF.receiveShadow = true;
          tileF.userData = { isDadoTile: true, thickness: dadoT, wallId: wall.id, side: 'front' };
          group.add(tileF);
        }
        if (dadoSide === 'back' || dadoSide === 'both') {
          var tileB = new THREE.Mesh(dadoGeo, tileMat);
          tileB.position.set(sStart + subLen / 2, dadoBottom + dadoH / 2, -wThick / 2 - dadoT / 2);
          tileB.castShadow = true;
          tileB.receiveShadow = true;
          tileB.userData = { isDadoTile: true, thickness: dadoT, wallId: wall.id, side: 'back' };
          group.add(tileB);
        }
      }
    }

    if (validOps.length === 0) {
      // Solid Wall: Single extruded box
      var geo = new THREE.BoxGeometry(wLen, wHeight, wThick);
      var mesh = new THREE.Mesh(geo, wallMat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      mesh.position.set(wLen / 2, wHeight / 2, 0);
      group.add(mesh);
      addSkirting(0, wLen);
      addDadoTile(0, wLen);
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
          var segMesh = new THREE.Mesh(segGeo, wallMat);
          segMesh.position.set(currX + segW / 2, wHeight / 2, 0);
          segMesh.castShadow = true;
          segMesh.receiveShadow = true;
          group.add(segMesh);
          addSkirting(currX, segW);
          addDadoTile(currX, segW);
        }

        // 2. Below window sill segment (if window with sillHeight > 0)
        if (sillH > 0) {
          var sillGeo = new THREE.BoxGeometry(opWidth, sillH, wThick);
          var sillMesh = new THREE.Mesh(sillGeo, wallMat);
          sillMesh.position.set(opStart + opWidth / 2, sillH / 2, 0);
          sillMesh.castShadow = true;
          sillMesh.receiveShadow = true;
          group.add(sillMesh);
          addSkirting(opStart, opWidth);
          if (sillH > 850) {
            addDadoTile(opStart, opWidth, sillH);
          }
        }

        // 3. Above opening lintel segment
        var opTop = sillH + opHeight;
        if (wHeight > opTop + 1) {
          var lintelH = wHeight - opTop;
          var lintelGeo = new THREE.BoxGeometry(opWidth, lintelH, wThick);
          var lintelMesh = new THREE.Mesh(lintelGeo, wallMat);
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
        var lastMesh = new THREE.Mesh(lastGeo, wallMat);
        lastMesh.position.set(currX + lastW / 2, wHeight / 2, 0);
        lastMesh.castShadow = true;
        lastMesh.receiveShadow = true;
        group.add(lastMesh);
        addSkirting(currX, lastW);
        addDadoTile(currX, lastW);
      }
    }

    group.position.set(start.x, 0, start.y);
    group.rotation.y = -angle;
    group.userData = {
      isWall: true,
      wallId: wall.id,
      wall: wall,
      start: { x: start.x, y: start.y },
      end: { x: wall.end.x, y: wall.end.y },
      isDivider: !!wall.isDivider,
      mid: { x: (start.x + wall.end.x) / 2, y: (start.y + wall.end.y) / 2 }
    };
    group.traverse(function (child) {
      if (child.isMesh) {
        child.userData = child.userData || {};
        child.userData.isWall = true;
        child.userData.wallId = wall.id;
      }
    });
    return group;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build 3D Door (Frame, Leaves: Single Closed, Double, Sliding, Frame-Only)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildDoor3D = function (op, width, height, wallThick) {
    var dg = new THREE.Group();
    var frameT = 60, frameD = wallThick + 10;
    var dType = (op && op.doorType) || 'single_closed';

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

    // Subtype 1: ONLY DOOR FRAME (cased opening without door leaves)
    if (dType === 'frame_only') {
      return dg;
    }

    var leafW = width - frameT * 2;
    var leafH = height - frameT;
    var leafThick = 40;
    var handleGeo = new THREE.CylinderGeometry(7, 7, 130, 12);
    var handleMat = this.materials.doorHandle || this.materials.doorWood;

    // Subtype 2: DOUBLE DOOR (two meeting leaves closed flush)
    if (dType === 'double') {
      var halfW = (leafW - 4) / 2;
      var dLeafGeo = new THREE.BoxGeometry(halfW, leafH, leafThick);

      var leftLeaf = new THREE.Mesh(dLeafGeo, this.materials.doorWood);
      leftLeaf.position.set(frameT + halfW / 2, leafH / 2, 0);
      leftLeaf.castShadow = true; leftLeaf.receiveShadow = true;
      dg.add(leftLeaf);

      var rightLeaf = new THREE.Mesh(dLeafGeo, this.materials.doorWood);
      rightLeaf.position.set(width - frameT - halfW / 2, leafH / 2, 0);
      rightLeaf.castShadow = true; rightLeaf.receiveShadow = true;
      dg.add(rightLeaf);

      // Left & right meeting brass handles
      [-1, 1].forEach(function (side) {
        var hX = width / 2 + side * 35;
        var hFront = new THREE.Mesh(handleGeo, handleMat);
        hFront.position.set(hX, leafH * 0.48, leafThick / 2 + 12);
        hFront.rotation.x = Math.PI / 2;
        hFront.castShadow = true;
        dg.add(hFront);

        var hBack = new THREE.Mesh(handleGeo, handleMat);
        hBack.position.set(hX, leafH * 0.48, -leafThick / 2 - 12);
        hBack.rotation.x = Math.PI / 2;
        dg.add(hBack);
      });

      return dg;
    }

    // Subtype 3: SLIDING DOOR (bypass sliding panels with top rail)
    if (dType === 'sliding') {
      var slideW = leafW * 0.55;
      var sLeafGeo = new THREE.BoxGeometry(slideW, leafH - 10, leafThick - 4);

      // Top guide track
      var railGeo = new THREE.BoxGeometry(width - frameT * 2, 22, frameD * 0.7);
      var rail = new THREE.Mesh(railGeo, this.materials.doorFrame);
      rail.position.set(width / 2, height - frameT - 11, 0);
      dg.add(rail);

      // Leaf 1 (Front track)
      var sLeaf1 = new THREE.Mesh(sLeafGeo, this.materials.doorWood);
      sLeaf1.position.set(frameT + slideW / 2, (leafH - 10) / 2, 16);
      sLeaf1.castShadow = true; sLeaf1.receiveShadow = true;
      dg.add(sLeaf1);

      // Leaf 2 (Rear track)
      var sLeaf2 = new THREE.Mesh(sLeafGeo, this.materials.doorWood);
      sLeaf2.position.set(width - frameT - slideW / 2, (leafH - 10) / 2, -16);
      sLeaf2.castShadow = true; sLeaf2.receiveShadow = true;
      dg.add(sLeaf2);

      // Recessed sliding pull hardware
      var pullGeo = new THREE.BoxGeometry(16, 120, 8);
      var pull1 = new THREE.Mesh(pullGeo, handleMat);
      pull1.position.set(frameT + slideW - 35, (leafH - 10) * 0.5, 33);
      dg.add(pull1);
      var pull2 = new THREE.Mesh(pullGeo, handleMat);
      pull2.position.set(width - frameT - slideW + 35, (leafH - 10) * 0.5, -33);
      dg.add(pull2);

      return dg;
    }

    // Subtype 4: SINGLE DOOR — ALWAYS CLOSED
    var leafGeo = new THREE.BoxGeometry(leafW, leafH, leafThick);
    var leafMesh = new THREE.Mesh(leafGeo, this.materials.doorWood);
    leafMesh.position.set(width / 2, leafH / 2, 0);
    leafMesh.castShadow = true;
    leafMesh.receiveShadow = true;
    dg.add(leafMesh);

    // Architectural Door Handle Hardware (closed state)
    var swing = (op && op.swing) || 'in-left';
    var isRight = swing.indexOf('right') !== -1;
    var handleX = isRight ? frameT + 45 : width - frameT - 45;

    var handleMesh = new THREE.Mesh(handleGeo, handleMat);
    handleMesh.position.set(handleX, leafH * 0.48, leafThick / 2 + 12);
    handleMesh.rotation.x = Math.PI / 2;
    handleMesh.castShadow = true;
    dg.add(handleMesh);

    var backHandle = new THREE.Mesh(handleGeo, handleMat);
    backHandle.position.set(handleX, leafH * 0.48, -leafThick / 2 - 12);
    backHandle.rotation.x = Math.PI / 2;
    dg.add(backHandle);

    return dg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build 3D Window (Sliding, Flap-Up Awning, or Standard Fixed)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildWindow3D = function (op, width, height, sillH, wallThick) {
    var wg = new THREE.Group();
    var frameT = 50, frameD = wallThick - 10;
    var wType = (op && op.windowType) || 'sliding';

    // Outer Frame Border
    var hGeo = new THREE.BoxGeometry(width, frameT, frameD);
    var topF = new THREE.Mesh(hGeo, this.materials.windowFrame);
    topF.position.set(width / 2, height - frameT / 2, 0);
    topF.castShadow = true; topF.receiveShadow = true;
    wg.add(topF);

    var botF = new THREE.Mesh(hGeo, this.materials.windowFrame);
    botF.position.set(width / 2, frameT / 2, 0);
    botF.castShadow = true; botF.receiveShadow = true;
    wg.add(botF);

    var vGeo = new THREE.BoxGeometry(frameT, height - frameT * 2, frameD);
    var leftF = new THREE.Mesh(vGeo, this.materials.windowFrame);
    leftF.position.set(frameT / 2, height / 2, 0);
    leftF.castShadow = true; leftF.receiveShadow = true;
    wg.add(leftF);

    var rightF = new THREE.Mesh(vGeo, this.materials.windowFrame);
    rightF.position.set(width - frameT / 2, height / 2, 0);
    rightF.castShadow = true; rightF.receiveShadow = true;
    wg.add(rightF);

    // Exterior Stone Sill Ledge
    var sillLedgeGeo = new THREE.BoxGeometry(width + 50, 28, wallThick + 40);
    var sillLedge = new THREE.Mesh(sillLedgeGeo, this.materials.sillStone || this.materials.wall);
    sillLedge.position.set(width / 2, 14, 0);
    sillLedge.castShadow = true; sillLedge.receiveShadow = true;
    wg.add(sillLedge);

    var innerW = width - frameT * 2;
    var innerH = height - frameT * 2;

    if (wType === 'sliding') {
      // 2-Track Bypass Sliding Window Sashes
      var sashW = innerW * 0.54;
      var sashT = 32;

      // Left sash (Front track)
      var s1Group = new THREE.Group();
      var s1Glass = new THREE.Mesh(new THREE.BoxGeometry(sashW - 36, innerH - 36, 6), this.materials.glass);
      s1Glass.position.set(0, 0, 0);
      s1Group.add(s1Glass);
      var s1Frame = new THREE.Mesh(new THREE.BoxGeometry(sashW, innerH, sashT), this.materials.windowFrame);
      s1Frame.position.set(0, 0, 0);
      // Punch hole for glass or render border
      s1Group.position.set(frameT + sashW / 2, height / 2, 14);
      wg.add(s1Group);
      wg.add(s1Glass);

      // Right sash (Rear track)
      var s2Glass = new THREE.Mesh(new THREE.BoxGeometry(sashW - 36, innerH - 36, 6), this.materials.glass);
      s2Glass.position.set(width - frameT - sashW / 2, height / 2, -14);
      wg.add(s2Glass);

      // Center interlock vertical stile
      var stileGeo = new THREE.BoxGeometry(26, innerH, frameD * 0.6);
      var stile = new THREE.Mesh(stileGeo, this.materials.windowFrame);
      stile.position.set(width / 2, height / 2, 0);
      wg.add(stile);

    } else if (wType === 'flapup') {
      // Flap-up Awning Window (top-hung awning sash tilted slightly outward)
      var awningGroup = new THREE.Group();
      awningGroup.position.set(width / 2, height - frameT, 0);
      awningGroup.rotation.x = -Math.PI / 14; // ~13° outward awning angle

      var aFrameGeo = new THREE.BoxGeometry(innerW, innerH, 30);
      var aGlassGeo = new THREE.BoxGeometry(innerW - 36, innerH - 36, 6);
      var aGlass = new THREE.Mesh(aGlassGeo, this.materials.glass);
      aGlass.position.set(0, -innerH / 2, 0);
      awningGroup.add(aGlass);

      // Top hinge hardware
      var hPin = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, innerW, 12), this.materials.doorHandle || this.materials.windowFrame);
      hPin.rotation.z = Math.PI / 2;
      hPin.position.set(0, 0, 0);
      awningGroup.add(hPin);

      wg.add(awningGroup);

    } else {
      // Standard Fixed Window with Mullion Bars
      var glassGeo = new THREE.BoxGeometry(innerW, innerH, 10);
      var glassMesh = new THREE.Mesh(glassGeo, this.materials.glass);
      glassMesh.position.set(width / 2, height / 2, 0);
      wg.add(glassMesh);

      if (width > 750) {
        var mulVGeo = new THREE.BoxGeometry(28, innerH, frameD * 0.7);
        var mulVMesh = new THREE.Mesh(mulVGeo, this.materials.windowFrame);
        mulVMesh.position.set(width / 2, height / 2, 0);
        mulVMesh.castShadow = true;
        wg.add(mulVMesh);
      }
      if (height > 1200) {
        var mulHGeo = new THREE.BoxGeometry(innerW, 24, frameD * 0.7);
        var mulHMesh = new THREE.Mesh(mulHGeo, this.materials.windowFrame);
        mulHMesh.position.set(width / 2, height * 0.65, 0);
        mulHMesh.castShadow = true;
        wg.add(mulHMesh);
      }
    }

    return wg;
  };

  ArchitecturalRenderer.prototype.buildRoomFloor = function (room, allRooms) {
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

    // Check for interior divided rooms (e.g. Pooja room) inside this room to create clean holes and prevent floor overlap/glitch!
    var isInnerRoom = false;
    if (allRooms && allRooms.length > 1) {
      for (var ar = 0; ar < allRooms.length; ar++) {
        var otherR = allRooms[ar];
        if (!otherR || otherR.id === room.id || !otherR.polygon || otherR.polygon.length < 3) continue;

        var otherCenter = (typeof Core !== 'undefined' && Core.Vec2) ? Core.Vec2.polygonCentroid(otherR.polygon) : null;
        if (!otherCenter) continue;

        // If otherR is an inner room inside this room: cut a hole out of this floor mesh!
        if (otherR.areaSqMm < (room.areaSqMm || 999999999) && Core.Vec2.pointInPolygon(otherCenter, poly)) {
          var holePoly = cleaner ? cleaner(otherR.polygon) : otherR.polygon;
          if (holePoly && holePoly.length >= 3) {
            var hArea = 0;
            var hn = holePoly.length;
            for (var hi = 0; hi < hn; hi++) {
              var hj = (hi + 1) % hn;
              hArea += holePoly[hi].x * (-holePoly[hj].y) - holePoly[hj].x * (-holePoly[hi].y);
            }
            hArea = hArea / 2;
            var orderedHole = holePoly.slice();
            // Three.js Earcut requires holes to have CW winding in shape space
            if (hArea > 0) orderedHole.reverse();

            var holePath = new THREE.Path();
            holePath.moveTo(orderedHole[0].x, -orderedHole[0].y);
            for (var hp = 1; hp < orderedHole.length; hp++) {
              holePath.lineTo(orderedHole[hp].x, -orderedHole[hp].y);
            }
            holePath.closePath();
            shape.holes.push(holePath);
          }
        } else if (otherR.areaSqMm > (room.areaSqMm || 0) && Core.Vec2.pointInPolygon(Core.Vec2.polygonCentroid(poly), otherR.polygon)) {
          // This room itself is an inner divided room!
          isInnerRoom = true;
        }
      }
    }

    var geo = null;
    var floorDepth = 100; // 100mm physical architectural concrete slab depth
    try {
      if (typeof THREE.ExtrudeGeometry === 'function') {
        geo = new THREE.ExtrudeGeometry(shape, {
          depth: floorDepth,
          bevelEnabled: false
        });
      } else {
        geo = new THREE.ShapeGeometry(shape);
        floorDepth = 0;
      }
    } catch (e) {
      try {
        geo = new THREE.ShapeGeometry(shape);
        floorDepth = 0;
      } catch (err) {
        console.warn('[Orbix 3D] ExtrudeGeometry and ShapeGeometry failed, skipping degenerate floor:', err);
        return null;
      }
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
      else if (room.floorFinish === 'tile_1' || room.floorFinish === 'designer_tile_1' || room.floorFinish === 'custom_tile_1' || room.floorFinish === 'floor_tile_1') finishType = 'tile_1';
      else if (room.floorFinish === 'tile_2' || room.floorFinish === 'designer_tile_2' || room.floorFinish === 'custom_tile_2' || room.floorFinish === 'floor_tile_2') finishType = 'tile_2';
      else if (room.floorFinish === 'tile_3' || room.floorFinish === 'designer_tile_3' || room.floorFinish === 'custom_tile_3' || room.floorFinish === 'floor_tile_3') finishType = 'tile_3';
      else finishType = room.floorFinish;
    } else if (room.type === 'bedroom' && this.selectedFloorType === 'white_tile') {
      finishType = 'wooden';
    }

    // Physical millimeter UV mapping so tile sizes are authentic and scale-consistent
    var tileSize = (finishType === 'wooden' || finishType === 'tile_3') ? 1200 : (finishType === 'white_tile' ? 1600 : 1200);
    if (typeof geo.computeVertexNormals === 'function') {
      geo.computeVertexNormals();
    }
    if (geo.attributes && geo.attributes.uv && geo.attributes.position && typeof geo.attributes.position.getX === 'function' && typeof geo.attributes.position.getZ === 'function') {
      var uvAttr = geo.attributes.uv;
      var posAttr = geo.attributes.position;
      var normAttr = geo.attributes.normal;
      for (var v = 0; v < posAttr.count; v++) {
        var vx = posAttr.getX(v);
        var vy = posAttr.getY(v);
        var vz = posAttr.getZ(v);
        var nz = normAttr ? Math.abs(normAttr.getZ(v)) : 1;
        if (nz > 0.5) {
          // Top & bottom horizontal surfaces: standard planar tile texture repeat
          uvAttr.setXY(v, vx / tileSize, -vy / tileSize);
        } else {
          // Vertical 20mm slab edge perimeter faces
          var horiz = Math.hypot(vx, vy);
          uvAttr.setXY(v, horiz / tileSize, vz / Math.max(1, floorDepth));
        }
      }
      uvAttr.needsUpdate = true;
    }

    var mat = this.createFloorMaterial(finishType);
    var mesh = new THREE.Mesh(geo, mat);

    // Rotate flat into X-Z floor plane
    mesh.rotation.x = -Math.PI / 2;
    // With 20mm depth, extruding along local +Z produces +Y in world space after Rx(-PI/2).
    // Placing top face flush at Y = 1.0 (or 1.08 for inner rooms) extends the 20mm slab downwards to Y = -19.0.
    // This gives realistic solid 20mm depth without clipping or submerging floor units/cabinets!
    mesh.position.y = isInnerRoom ? (0.3 - floorDepth) : (0.0 - floorDepth);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.name = 'Floor_' + (room.name || 'Room');
    mesh.userData = { isFloorMesh: true, floorFinish: finishType, roomId: room.id, boundingRoom: room, floorDepth: floorDepth };

    return mesh;
  };

  ArchitecturalRenderer.prototype.buildRoomCeiling = function (room, allRooms, ceilingH) {
    if (!room || !room.polygon || room.polygon.length < 3 || typeof THREE === 'undefined') return null;
    ceilingH = ceilingH || 2800;
    var cleaner = (typeof Core !== 'undefined' && Core.cleanPolygon) || ArchitecturalRenderer.cleanPolygon;
    var poly = cleaner ? cleaner(room.polygon) : room.polygon;
    if (!poly || poly.length < 3) poly = room.polygon.filter(function (pt) { return pt && isFinite(pt.x) && isFinite(pt.y); });
    if (!poly || poly.length < 3) return null;

    var area2 = 0;
    for (var i = 0; i < poly.length; i++) {
      var j = (i + 1) % poly.length;
      area2 += poly[i].x * poly[j].y - poly[j].x * poly[i].y;
    }
    if (Math.abs(area2 / 2) < 100000) return null;

    var ordered = poly.slice();
    if (area2 < 0) ordered.reverse(); // CCW in (x, y) shape space -> Rx(+PI/2) faces -Y downward

    var shape = new THREE.Shape();
    shape.moveTo(ordered[0].x, ordered[0].y);
    for (var k = 1; k < ordered.length; k++) {
      shape.lineTo(ordered[k].x, ordered[k].y);
    }
    shape.closePath();

    var isInnerRoom = false;
    if (allRooms && allRooms.length > 1) {
      for (var ar = 0; ar < allRooms.length; ar++) {
        var otherR = allRooms[ar];
        if (!otherR || otherR.id === room.id || !otherR.polygon || otherR.polygon.length < 3) continue;
        var otherCenter = (typeof Core !== 'undefined' && Core.Vec2) ? Core.Vec2.polygonCentroid(otherR.polygon) : null;
        if (!otherCenter) continue;
        if (otherR.areaSqMm < (room.areaSqMm || 999999999) && Core.Vec2.pointInPolygon(otherCenter, poly)) {
          var holePoly = cleaner ? cleaner(otherR.polygon) : otherR.polygon;
          if (holePoly && holePoly.length >= 3) {
            var hA = 0;
            for (var hi = 0; hi < holePoly.length; hi++) {
              var hj = (hi + 1) % holePoly.length;
              hA += holePoly[hi].x * holePoly[hj].y - holePoly[hj].x * holePoly[hi].y;
            }
            var oHole = holePoly.slice();
            if (hA > 0) oHole.reverse();
            var hPath = new THREE.Path();
            hPath.moveTo(oHole[0].x, oHole[0].y);
            for (var hk = 1; hk < oHole.length; hk++) hPath.lineTo(oHole[hk].x, oHole[hk].y);
            hPath.closePath();
            shape.holes.push(hPath);
          }
        } else if (otherR.areaSqMm > (room.areaSqMm || 0) && Core.Vec2.pointInPolygon(Core.Vec2.polygonCentroid(poly), otherR.polygon)) {
          isInnerRoom = true;
        }
      }
    }

    // Extrude ceiling slab with strictly 100mm architectural thickness
    var ceilingThick = 100;
    var geo = (typeof THREE.ExtrudeGeometry === 'function') ?
      new THREE.ExtrudeGeometry(shape, { depth: ceilingThick, bevelEnabled: false }) :
      new THREE.ShapeGeometry(shape);
    if (typeof geo.computeVertexNormals === 'function') geo.computeVertexNormals();
    var cMesh = new THREE.Mesh(geo, this.materials.ceiling);
    cMesh.rotation.x = Math.PI / 2;
    cMesh.position.y = isInnerRoom ? (ceilingH - 2) : ceilingH;
    cMesh.receiveShadow = true;
    cMesh.castShadow = false;
    cMesh.name = 'Ceiling_' + (room.name || 'Room');
    cMesh.userData = { isCeilingMesh: true, roomId: room.id, thickness: ceilingThick };
    return cMesh;
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
     Build Photorealistic Interior Architectural Room Lighting
     (Warm 3000K Spotlights & Ceiling Recessed Downlight Fixtures)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildRoomInteriorLighting = function (room, ceilingH) {
    if (!room || !room.polygon || room.polygon.length < 3 || typeof THREE === 'undefined') return null;
    ceilingH = ceilingH || 2800;
    var pts = room.polygon;
    var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      if (p.x < minX) minX = p.x;
      if (p.x > maxX) maxX = p.x;
      if (p.y < minY) minY = p.y;
      if (p.y > maxY) maxY = p.y;
    }
    var cx = (minX + maxX) / 2;
    var cz = (minY + maxY) / 2;
    var rWidth = maxX - minX;
    var rDepth = maxY - minY;
    if (rWidth < 400 || rDepth < 400) return null;

    var group = new THREE.Group();
    group.name = 'RoomLighting_' + room.id;
    group.userData = { isRoomLighting: true, roomId: room.id };

    // Calculate spotlight layout based on room size:
    var spotPositions = [];
    if (rWidth > 3600 && rDepth > 3600) {
      var dx = rWidth * 0.22, dz = rDepth * 0.22;
      spotPositions.push({ x: cx - dx, z: cz - dz });
      spotPositions.push({ x: cx + dx, z: cz - dz });
      spotPositions.push({ x: cx - dx, z: cz + dz });
      spotPositions.push({ x: cx + dx, z: cz + dz });
    } else if (rWidth > 3600) {
      var dx = rWidth * 0.22;
      spotPositions.push({ x: cx - dx, z: cz });
      spotPositions.push({ x: cx + dx, z: cz });
    } else if (rDepth > 3600) {
      var dz = rDepth * 0.22;
      spotPositions.push({ x: cx, z: cz - dz });
      spotPositions.push({ x: cx, z: cz + dz });
    } else {
      spotPositions.push({ x: cx, z: cz });
    }

    var currentSpotMultiplier = (typeof window !== 'undefined' && window.spotlightIntensity !== undefined) ? window.spotlightIntensity : 1.0;
    var downlightIntensity = (spotPositions.length > 1 ? Math.max(0.38, 1.15 / spotPositions.length) : 0.72) * currentSpotMultiplier;

    for (var s = 0; s < spotPositions.length; s++) {
      var sp = spotPositions[s];
      // 3D Ceiling Spot Trim & Emissive Lens
      if (typeof THREE.CylinderGeometry !== 'undefined') {
        var trimGeo = new THREE.CylinderGeometry(45, 45, 10, 16);
        var trimMat = new THREE.MeshStandardMaterial({ color: 0xF1F5F9, roughness: 0.4 });
        var trim = new THREE.Mesh(trimGeo, trimMat);
        trim.position.set(sp.x, ceilingH - 5, sp.z);
        group.add(trim);

        var lensGeo = new THREE.CylinderGeometry(35, 35, 4, 16);
        var lensMat = new THREE.MeshStandardMaterial({
          color: 0xFFFBEB,
          emissive: 0xFEF08A,
          emissiveIntensity: 0.95,
          roughness: 0.2
        });
        var lens = new THREE.Mesh(lensGeo, lensMat);
        lens.position.set(sp.x, ceilingH - 8, sp.z);
        group.add(lens);
      }

      // Warm 3000K Architectural Downlight (decay=1 for clean millimeter distance falloff)
      if (typeof THREE.SpotLight !== 'undefined') {
        var spot = new THREE.SpotLight(0xFFF3DF, downlightIntensity);
        spot.name = 'roomSpotlight';
        spot.position.set(sp.x, ceilingH - 25, sp.z);
        spot.target.position.set(sp.x, 0, sp.z);
        spot.angle = Math.PI / 2.8;
        spot.penumbra = 0.88;
        spot.decay = 1.0;
        spot.distance = Math.max(6000, ceilingH * 2.4);
        group.add(spot);
        group.add(spot.target);
      }
    }

    // Soft Warm Interior Radiosity / Bounce Fill so vertical cabinets & corners have rich architectural depth
    if (typeof THREE.PointLight !== 'undefined') {
      var fillLight = new THREE.PointLight(0xFFF6E8, 0.36 * currentSpotMultiplier, Math.max(5200, Math.max(rWidth, rDepth) * 1.45), 1.0);
      fillLight.name = 'roomFillLight';
      fillLight.position.set(cx, Math.max(1500, ceilingH * 0.72), cz);
      group.add(fillLight);
    }

    return group;
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

  ArchitecturalRenderer._woodTexCache = {};
  ArchitecturalRenderer.createWoodLaminateTexture = function (hexColor, key) {
    if (typeof document === 'undefined' || typeof THREE === 'undefined') return null;
    key = (key || '') + '_' + hexColor;
    if (ArchitecturalRenderer._woodTexCache[key]) return ArchitecturalRenderer._woodTexCache[key];

    var canvas = document.createElement('canvas');
    canvas.width = 512; canvas.height = 512;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var rgbHex = (typeof hexColor === 'number') ? hexColor : (parseInt(String(hexColor).replace('#', ''), 16) || 0x6E4E35);
    var r = (rgbHex >> 16) & 255, g = (rgbHex >> 8) & 255, b = rgbHex & 255;

    ctx.fillStyle = 'rgb(' + r + ',' + g + ',' + b + ')';
    ctx.fillRect(0, 0, 512, 512);

    // 1. Broad tonal drift
    for (var d = 0; d < 4; d++) {
      var dx = (d * 128 + 30) % 512;
      var grad = ctx.createLinearGradient(dx, 0, dx + 160, 0);
      var darkFactor = 0.85 + (d % 2) * 0.1;
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.5, 'rgba(' + Math.round(r * darkFactor) + ',' + Math.round(g * darkFactor) + ',' + Math.round(b * darkFactor) + ',0.45)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = grad;
      ctx.fillRect(dx, 0, 160, 512);
    }

    // 2. Grain flow lines
    for (var l = 0; l < 48; l++) {
      var lx = (l * 11) % 512;
      ctx.strokeStyle = (l % 2 === 0) ? 'rgba(0,0,0,0.14)' : 'rgba(255,255,255,0.08)';
      ctx.lineWidth = 1.0 + (l % 3) * 0.5;
      ctx.beginPath();
      ctx.moveTo(lx, 0);
      for (var y = 0; y <= 512; y += 16) {
        var wave = Math.sin((y / 512) * Math.PI * 4 + l) * 6;
        ctx.lineTo(lx + wave, y);
      }
      ctx.stroke();
    }

    // 3. Tactile wood pores
    for (var p = 0; p < 800; p++) {
      var px = (p * 37) % 512;
      var py = (p * 59) % 512;
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(px, py, 1, 3 + (p % 4));
    }

    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(2, 2);
    tex.encoding = (typeof THREE !== 'undefined' && THREE.sRGBEncoding) ? THREE.sRGBEncoding : 3001;
    ArchitecturalRenderer._woodTexCache[key] = tex;
    return tex;
  };

  ArchitecturalRenderer.resolveLaminateMaterial = function (matFin, defaultColor, isGlossOverride) {
    if (typeof THREE === 'undefined') return null;
    var str = (matFin && typeof matFin === 'object') ? String(matFin.finish || matFin.name || matFin.code || matFin.woodType || '') : String(matFin || '');
    str = str.toLowerCase();
    var colSource = (matFin && typeof matFin === 'object' && matFin.color) ? matFin.color : (typeof matFin === 'string' ? matFin : (matFin && matFin.finish));
    var threeCol = ArchitecturalRenderer.resolveFinishColor(colSource, defaultColor || 0xEDEBE4);
    var isGloss = !!isGlossOverride || str.indexOf('gloss') !== -1;
    var isWood = str.indexOf('wood') !== -1 ||
      str.indexOf('walnut') !== -1 ||
      str.indexOf('teak') !== -1 ||
      str.indexOf('oak') !== -1 ||
      str.indexOf('wenge') !== -1 ||
      str.indexOf('3410') !== -1 ||
      str.indexOf('3411') !== -1 ||
      str.indexOf('2204') !== -1 ||
      str.indexOf('2210') !== -1 ||
      str.indexOf('4402') !== -1;

    if (typeof window !== 'undefined' && Array.isArray(window.LAMINATES)) {
      var lamItem = window.LAMINATES.find(function (it) {
        return it.code === matFin || it.name === matFin || String(matFin).indexOf(it.code) !== -1;
      });
      if (lamItem && lamItem.kind === 'wood') isWood = true;
      if (lamItem && lamItem.kind === 'gloss') isGloss = true;
    }

    // Fast Drafting Mode (Mode 1: Design Mode)
    var isDesignMode = (typeof window !== 'undefined' && window.orbixRenderMode === 'design');
    if (isDesignMode) {
      return new THREE.MeshStandardMaterial({
        color: threeCol,
        roughness: isGloss ? 0.25 : 0.70,
        metalness: 0.0
      });
    }

    // PBR Photorealistic Physical Material (Mode 2: Realistic & Mode 3: Client Presentation)
    var MatClass = (typeof THREE.MeshPhysicalMaterial === 'function') ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;

    var matOpts = {
      color: threeCol
    };

    if (isGloss) {
      // Luxury High Gloss Acrylic / PU Finish
      matOpts.roughness = 0.04;
      matOpts.metalness = 0.05;
      matOpts.clearcoat = 1.0;
      matOpts.clearcoatRoughness = 0.03;
      matOpts.reflectivity = 0.92;
      matOpts.envMapIntensity = 1.40;
    } else if (isWood) {
      // Natural Timber Grain with Micro Bump Depth
      matOpts.roughness = 0.42;
      matOpts.metalness = 0.02;
      matOpts.clearcoat = 0.15;
      matOpts.clearcoatRoughness = 0.28;
      matOpts.reflectivity = 0.45;
      matOpts.envMapIntensity = 0.95;

      var woodTex = ArchitecturalRenderer.createWoodLaminateTexture(threeCol, str);
      var woodBump = ArchitecturalRenderer.createWoodGrainBumpTexture();
      if (woodTex) matOpts.map = woodTex;
      if (woodBump) {
        matOpts.bumpMap = woodBump;
        matOpts.bumpScale = 0.035;
      }
    } else {
      // Velvety Architectural Matte Laminate (MDF 7707, MDF 6601, Suede/SF)
      matOpts.roughness = 0.68;
      matOpts.metalness = 0.01;
      matOpts.clearcoat = 0.08;
      matOpts.clearcoatRoughness = 0.45;
      matOpts.reflectivity = 0.35;
      matOpts.envMapIntensity = 0.85;
    }

    return new MatClass(matOpts);
  };

  ArchitecturalRenderer.getHandleMaterial = function (hFinish) {
    var fin = String(hFinish || 'black').toLowerCase();
    var MatClass = (typeof THREE !== 'undefined' && typeof THREE.MeshPhysicalMaterial === 'function') ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;

    if (fin.indexOf('chrome') !== -1) {
      return new MatClass({
        color: 0xE2E8F0,
        roughness: 0.08,
        metalness: 0.96,
        clearcoat: 1.0,
        clearcoatRoughness: 0.04,
        reflectivity: 0.95,
        envMapIntensity: 1.5
      });
    }
    if (fin.indexOf('nickel') !== -1 || fin.indexOf('silver') !== -1 || fin.indexOf('steel') !== -1 || fin.indexOf('stainless') !== -1 || fin === 'ss') {
      return new MatClass({
        color: 0xCBD5E1,
        roughness: 0.32,
        metalness: 0.88,
        clearcoat: 0.35,
        clearcoatRoughness: 0.22,
        reflectivity: 0.80,
        envMapIntensity: 1.2
      });
    }
    if (fin.indexOf('brass') !== -1 || fin.indexOf('gold') !== -1 || fin.indexOf('champagne') !== -1) {
      return new MatClass({
        color: 0xD4AF37,
        roughness: 0.22,
        metalness: 0.92,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15,
        reflectivity: 0.90,
        envMapIntensity: 1.3
      });
    }
    if (fin.indexOf('rose') !== -1 || fin.indexOf('copper') !== -1) {
      return new MatClass({
        color: 0xB76E79,
        roughness: 0.22,
        metalness: 0.92,
        clearcoat: 0.65,
        clearcoatRoughness: 0.15,
        reflectivity: 0.90,
        envMapIntensity: 1.3
      });
    }
    // Default: Architectural Matte Black Powder Coat
    return new MatClass({
      color: 0x1A1A1A,
      roughness: 0.65,
      metalness: 0.35,
      clearcoat: 0.05,
      reflectivity: 0.30,
      envMapIntensity: 0.45
    });
  };

  ArchitecturalRenderer.applyMaterialComparison = function (targetGroup, option, comparisonPreset) {
    if (!targetGroup) return;
    option = (option || 'A').toUpperCase();

    if (option === 'A') {
      // Revert to original designer-assigned materials
      targetGroup.traverse(function (mesh) {
        if (mesh.isMesh && mesh.userData && mesh.userData._origMaterial) {
          mesh.material = mesh.userData._origMaterial;
          if (mesh.material && mesh.material.needsUpdate !== undefined) mesh.material.needsUpdate = true;
        }
      });
      return;
    }

    // Option B: Luxury Contrast Presentation Scheme
    var optBShutter = ArchitecturalRenderer.resolveLaminateMaterial(
      (comparisonPreset && comparisonPreset.shutter) || 'High Gloss Ivory',
      0xF6F2E9,
      true
    );
    var optBCarcass = ArchitecturalRenderer.resolveLaminateMaterial(
      (comparisonPreset && comparisonPreset.carcass) || 'American Walnut',
      0x463325,
      false
    );
    var MatClass = (typeof THREE.MeshPhysicalMaterial === 'function') ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
    var optBCounter = new MatClass({
      color: 0xFAFAF7, // Calacatta Polished Quartz
      roughness: 0.10,
      metalness: 0.04,
      clearcoat: 0.95,
      clearcoatRoughness: 0.06,
      reflectivity: 0.85,
      envMapIntensity: 1.35
    });

    targetGroup.traverse(function (mesh) {
      if (!mesh.isMesh) return;
      if (!mesh.userData) mesh.userData = {};
      if (!mesh.userData._origMaterial) {
        mesh.userData._origMaterial = mesh.material;
      }

      var name = (mesh.name || '').toLowerCase();
      var isCounter = name.indexOf('counter') !== -1 || (mesh.parent && mesh.parent.name && mesh.parent.name.toLowerCase().indexOf('counter') !== -1);
      var isShutter = mesh.userData.isShutter || name.indexOf('shutter') !== -1 || name.indexOf('door') !== -1 || name.indexOf('drawer') !== -1;
      var isGlassOrMirror = mesh.material && (mesh.material.transparent || mesh.material.opacity < 0.9 || mesh.material.transmission > 0.5 || name.indexOf('glass') !== -1 || name.indexOf('mirror') !== -1);

      if (isGlassOrMirror) return; // preserve transparent glass & mirror

      if (isCounter) {
        mesh.material = optBCounter;
      } else if (isShutter) {
        mesh.material = optBShutter;
      } else if (mesh.userData.isFurniturePart || name.indexOf('carcass') !== -1 || name.indexOf('panel') !== -1 || name.indexOf('shelf') !== -1) {
        mesh.material = optBCarcass;
      }
      if (mesh.material && mesh.material.needsUpdate !== undefined) mesh.material.needsUpdate = true;
    });
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
     Build Shutter Door Front (Slab, Shaker, Aluminium Profile Glass, Fluted, Louvered, Mirror, Cane)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.createShutterDoorGroup = function (dstyle, shW, shH, shutterMat, carcassMat, opts) {
    opts = opts || {};
    var group = new THREE.Group();
    group.name = "DoorGroup";

    var ds = String(dstyle || 'slab').toLowerCase().replace(/[-_ ]/g, '');
    var isAlu = ds.indexOf('alu') !== -1 || ds.indexOf('profile') !== -1;
    var isGlass = isAlu || ds.indexOf('glass') !== -1;
    var isMirror = ds.indexOf('mirror') !== -1;
    var isShaker = ds.indexOf('shaker') !== -1 || ds.indexOf('frame') !== -1;
    var isFluted = ds.indexOf('fluted') !== -1 || ds.indexOf('reed') !== -1;
    var isLouvered = ds.indexOf('louver') !== -1;
    var isCane = ds.indexOf('cane') !== -1 || ds.indexOf('rattan') !== -1;

    if (isAlu || isGlass) {
      // 4-Piece Architectural Profile Frame with Genuine Hollow Center
      var frameW = isAlu ? 32 : 55; // 32mm sleek aluminium profile or 55mm wood frame
      var frameT = 18;
      var frameMat;
      if (isAlu) {
        var aluHex = 0x1E2024;
        var pCol = String(opts.profileColor || opts.frameFin || 'black').toLowerCase();
        if (pCol.indexOf('champagne') !== -1 || pCol.indexOf('brass') !== -1 || pCol.indexOf('gold') !== -1) aluHex = 0xC5A059;
        else if (pCol.indexOf('nickel') !== -1 || pCol.indexOf('silver') !== -1 || pCol.indexOf('grey') !== -1) aluHex = 0x94A3B8;
        else if (pCol.indexOf('white') !== -1) aluHex = 0xF1F5F9;
        frameMat = new THREE.MeshStandardMaterial({ color: aluHex, metalness: 0.85, roughness: 0.22 });
      } else {
        frameMat = shutterMat || carcassMat;
      }

      // Left Stile
      var leftStile = new THREE.Mesh(new THREE.BoxGeometry(frameW, shH, frameT), frameMat);
      leftStile.position.set(-shW / 2 + frameW / 2, 0, 0);
      leftStile.castShadow = true; leftStile.receiveShadow = true;
      group.add(leftStile);

      // Right Stile
      var rightStile = new THREE.Mesh(new THREE.BoxGeometry(frameW, shH, frameT), frameMat);
      rightStile.position.set(shW / 2 - frameW / 2, 0, 0);
      rightStile.castShadow = true; rightStile.receiveShadow = true;
      group.add(rightStile);

      // Top Rail
      var innerW = Math.max(10, shW - 2 * frameW);
      var topRail = new THREE.Mesh(new THREE.BoxGeometry(innerW, frameW, frameT), frameMat);
      topRail.position.set(0, shH / 2 - frameW / 2, 0);
      topRail.castShadow = true; topRail.receiveShadow = true;
      group.add(topRail);

      // Bottom Rail
      var botRail = new THREE.Mesh(new THREE.BoxGeometry(innerW, frameW, frameT), frameMat);
      botRail.position.set(0, -shH / 2 + frameW / 2, 0);
      botRail.castShadow = true; botRail.receiveShadow = true;
      group.add(botRail);

      // Center Glass Pane: Genuine transparent architectural glass!
      var glassTintHex = 0xCCE7F8;
      var gTint = String(opts.glassTint || 'clear').toLowerCase();
      if (gTint.indexOf('bronze') !== -1) glassTintHex = 0xC79D6B;
      else if (gTint.indexOf('grey') !== -1 || gTint.indexOf('smoke') !== -1) glassTintHex = 0x64748B;
      else if (gTint.indexOf('frost') !== -1) glassTintHex = 0xE2E8F0;

      var glassMat = (typeof THREE.MeshPhysicalMaterial === 'function') ?
        new THREE.MeshPhysicalMaterial({
          color: glassTintHex,
          transparent: true,
          opacity: (gTint.indexOf('frost') !== -1) ? 0.65 : 0.22,
          roughness: (gTint.indexOf('frost') !== -1) ? 0.35 : 0.02,
          metalness: 0.05,
          transmission: (gTint.indexOf('frost') !== -1) ? 0.72 : 0.94,
          ior: 1.52,
          reflectivity: 0.85,
          envMapIntensity: 1.4
        }) :
        new THREE.MeshStandardMaterial({
          color: glassTintHex,
          transparent: true,
          opacity: 0.38,
          roughness: 0.08,
          metalness: 0.1
        });

      var glassPane = new THREE.Mesh(new THREE.BoxGeometry(shW - 2 * frameW + 12, shH - 2 * frameW + 12, 4), glassMat);
      glassPane.position.set(0, 0, 0);
      glassPane.castShadow = false; glassPane.receiveShadow = true;
      group.add(glassPane);
    } else if (isMirror) {
      // Mirror Front: Ultra-high reflectivity mirror with thin border
      var mirrorMat = (typeof THREE.MeshPhysicalMaterial === 'function') ?
        new THREE.MeshPhysicalMaterial({
          color: 0xF8FAFC,
          metalness: 0.98,
          roughness: 0.02,
          clearcoat: 1.0,
          clearcoatRoughness: 0.02,
          reflectivity: 0.98,
          envMapIntensity: 1.6
        }) :
        new THREE.MeshStandardMaterial({
          color: 0xF1F5F9,
          metalness: 0.98,
          roughness: 0.02
        });
      var mMesh = new THREE.Mesh(new THREE.BoxGeometry(shW, shH, 18), mirrorMat);
      mMesh.castShadow = true; mMesh.receiveShadow = true;
      group.add(mMesh);
    } else if (isShaker) {
      // Shaker 5-Piece Construction with recessed panel
      var sStileW = 65;
      var sFrameT = 18;
      var slStile = new THREE.Mesh(new THREE.BoxGeometry(sStileW, shH, sFrameT), shutterMat);
      slStile.position.set(-shW / 2 + sStileW / 2, 0, 0);
      slStile.castShadow = true; group.add(slStile);

      var srStile = new THREE.Mesh(new THREE.BoxGeometry(sStileW, shH, sFrameT), shutterMat);
      srStile.position.set(shW / 2 - sStileW / 2, 0, 0);
      srStile.castShadow = true; group.add(srStile);

      var sInnerW = Math.max(10, shW - 2 * sStileW);
      var sTopRail = new THREE.Mesh(new THREE.BoxGeometry(sInnerW, sStileW, sFrameT), shutterMat);
      sTopRail.position.set(0, shH / 2 - sStileW / 2, 0);
      sTopRail.castShadow = true; group.add(sTopRail);

      var sBotRail = new THREE.Mesh(new THREE.BoxGeometry(sInnerW, sStileW, sFrameT), shutterMat);
      sBotRail.position.set(0, -shH / 2 + sStileW / 2, 0);
      sBotRail.castShadow = true; group.add(sBotRail);

      var sCenter = new THREE.Mesh(new THREE.BoxGeometry(sInnerW, Math.max(10, shH - 2 * sStileW), 8), shutterMat);
      sCenter.position.set(0, 0, -4);
      sCenter.castShadow = true; sCenter.receiveShadow = true;
      group.add(sCenter);
    } else if (isFluted) {
      // Fluted / Reeded Front: Base panel with vertical 3D reeds
      var flBase = new THREE.Mesh(new THREE.BoxGeometry(shW, shH, 14), shutterMat);
      flBase.position.set(0, 0, -2);
      flBase.castShadow = true; flBase.receiveShadow = true;
      group.add(flBase);

      var reedStep = 22;
      var numReeds = Math.max(2, Math.floor((shW - 12) / reedStep));
      var reedStartX = -((numReeds - 1) * reedStep) / 2;
      var reedGeo = new THREE.CylinderGeometry(7, 7, Math.max(10, shH - 8), 12);
      for (var rf = 0; rf < numReeds; rf++) {
        var reedMesh = new THREE.Mesh(reedGeo, shutterMat);
        reedMesh.position.set(reedStartX + rf * reedStep, 0, 7);
        reedMesh.castShadow = true;
        group.add(reedMesh);
      }
    } else if (isLouvered) {
      // Louvered Slats
      var lStileW = 55;
      var lLeft = new THREE.Mesh(new THREE.BoxGeometry(lStileW, shH, 18), shutterMat);
      lLeft.position.set(-shW / 2 + lStileW / 2, 0, 0);
      group.add(lLeft);
      var lRight = new THREE.Mesh(new THREE.BoxGeometry(lStileW, shH, 18), shutterMat);
      lRight.position.set(shW / 2 - lStileW / 2, 0, 0);
      group.add(lRight);
      var lInnerW = Math.max(10, shW - 2 * lStileW);
      var lTop = new THREE.Mesh(new THREE.BoxGeometry(lInnerW, lStileW, 18), shutterMat);
      lTop.position.set(0, shH / 2 - lStileW / 2, 0);
      group.add(lTop);
      var lBot = new THREE.Mesh(new THREE.BoxGeometry(lInnerW, lStileW, 18), shutterMat);
      lBot.position.set(0, -shH / 2 + lStileW / 2, 0);
      group.add(lBot);

      var lH = Math.max(10, shH - 2 * lStileW);
      var slatPitch = 38;
      var numSlats = Math.max(1, Math.floor(lH / slatPitch));
      var slatStartY = -((numSlats - 1) * slatPitch) / 2;
      var slatGeo = new THREE.BoxGeometry(lInnerW - 2, 28, 6);
      for (var ls = 0; ls < numSlats; ls++) {
        var slatMesh = new THREE.Mesh(slatGeo, shutterMat);
        slatMesh.position.set(0, slatStartY + ls * slatPitch, 0);
        slatMesh.rotation.x = -Math.PI / 6;
        group.add(slatMesh);
      }
    } else {
      // Slab / Flat Monolithic Door
      var slbMesh = new THREE.Mesh(new THREE.BoxGeometry(shW, shH, 18), shutterMat);
      slbMesh.castShadow = true; slbMesh.receiveShadow = true;
      group.add(slbMesh);
    }

    return group;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Photorealistic 3D SketchUp GLTF Decor Loader & Asset Cache
     Loads textured .glb models converted from native Trimble SketchUp (.skp)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer._gltfCache = ArchitecturalRenderer._gltfCache || {};
  ArchitecturalRenderer._gltfPending = ArchitecturalRenderer._gltfPending || {};

  ArchitecturalRenderer.prototype.loadAndAttachGLB = function (url, parentGroup, dims, onLoaded, furn) {
    var self = this;
    if (!url || typeof THREE === 'undefined') return;

    function applyModel(sourceScene) {
      if (!parentGroup) return;
      var ph = parentGroup.getObjectByName('__decor_placeholder__');
      if (ph) parentGroup.remove(ph);

      // Deep clone the cached scene
      var model = sourceScene.clone(true);
      model.name = '__decor_model__';
      model.updateMatrixWorld(true);

      // Compute bounding box
      var bbox = new THREE.Box3().setFromObject(model);
      var size = new THREE.Vector3();
      bbox.getSize(size);
      var center = new THREE.Vector3();
      bbox.getCenter(center);

      var wrapper = new THREE.Group();
      wrapper.name = '__decor_wrapper__';

      // Center horizontally, ground bottom to 0
      model.position.set(-center.x, -bbox.min.y, -center.z);

      // Enable realistic shadows and materials (FrontSide enables GPU backface culling for 60fps)
      model.traverse(function (child) {
        if (child.isMesh) {
          child.castShadow = true;
          child.receiveShadow = true;
          child.userData = child.userData || {};
          child.userData.isGltfMesh = true;
          if (child.material) {
            if (!child.material.transparent && child.material.opacity >= 0.99) {
              child.material.side = THREE.FrontSide;
            } else {
              child.material.side = THREE.DoubleSide;
            }
            if (child.material.isMeshStandardMaterial || child.material.isMeshPhysicalMaterial) {
              child.material.roughness = Math.min(Math.max(child.material.roughness, 0.2), 0.95);
              child.material.metalness = Math.min(Math.max(child.material.metalness, 0.0), 0.9);
              child.material.envMapIntensity = 1.0;
              child.material.needsUpdate = true;
            }
          }
        }
      });

      // Scale proportionally: maintain true aspect ratio without squishing
      if (dims && dims.W && dims.H && dims.D && size.x > 0.001 && size.y > 0.001 && size.z > 0.001) {
        var sx = dims.W / size.x;
        var sy = dims.H / size.y;
        var sz = dims.D / size.z;
        var maxRatio = Math.max(sx / sy, sy / sx, sx / sz, sz / sx, sy / sz, sz / sy);
        if (maxRatio > 1.35) {
          var sUniform = Math.min(sx, sy, sz);
          wrapper.scale.set(sUniform, sUniform, sUniform);
        } else if (Math.abs(sx - 1) > 0.05 || Math.abs(sy - 1) > 0.05 || Math.abs(sz - 1) > 0.05) {
          wrapper.scale.set(sx, sy, sz);
        }
      }

      wrapper.add(model);
      parentGroup.add(wrapper);

      // Ground contact shadow under floor decors
      if (typeof ArchitecturalRenderer.createContactShadowPlane === 'function') {
        var shadowW = (dims && dims.W) || size.x;
        var shadowD = (dims && dims.D) || size.z;
        var shadowPlane = ArchitecturalRenderer.createContactShadowPlane(shadowW, shadowD);
        if (shadowPlane) {
          shadowPlane.position.set(0, 1.2, 0);
          parentGroup.add(shadowPlane);
        }
      }

      if (window.__cc && window.__cc.gl) {
        if (window.__cc.gl.apply) window.__cc.gl.apply(true);
        if (window.__cc.gl.settle) window.__cc.gl.settle();
      }
      if (typeof onLoaded === 'function') onLoaded(wrapper);
    }

    var cached = ArchitecturalRenderer._gltfCache[url] || (furn && furn.id && ArchitecturalRenderer._gltfCache[furn.id]) || (furn && furn.blobUrl && ArchitecturalRenderer._gltfCache[furn.blobUrl]) || (furn && furn.modelUrl && ArchitecturalRenderer._gltfCache[furn.modelUrl]);
    if (cached) {
      applyModel(cached);
      return;
    }

    // Check IndexedDB OrbixModelDB for offline/custom uploaded model buffers
    if (window.OrbixModelDB && typeof window.OrbixModelDB.get === 'function') {
      var keysToCheck = [];
      if (furn && furn.id) keysToCheck.push(furn.id);
      if (furn && furn.modelUrl) keysToCheck.push(furn.modelUrl);
      if (url && keysToCheck.indexOf(url) === -1) keysToCheck.push(url);

      var checkIdx = 0;
      function tryNextDbKey() {
        if (checkIdx >= keysToCheck.length) return;
        var k = keysToCheck[checkIdx++];
        window.OrbixModelDB.get(k, function (buf) {
          if (buf && window.THREE && window.THREE.GLTFLoader) {
            try {
              var dbLoader = new THREE.GLTFLoader();
              dbLoader.parse(buf, '', function (gltf) {
                ArchitecturalRenderer._gltfCache[k] = gltf.scene;
                if (furn && furn.id) ArchitecturalRenderer._gltfCache[furn.id] = gltf.scene;
                if (url) ArchitecturalRenderer._gltfCache[url] = gltf.scene;
                applyModel(gltf.scene);
              });
              return;
            } catch (_) { }
          }
          tryNextDbKey();
        });
      }
      tryNextDbKey();
    }

    // Add lightweight wireframe outline placeholder instead of solid/translucent block
    var placeW = (dims && dims.W) || 600;
    var placeH = (dims && dims.H) || 800;
    var placeD = (dims && dims.D) || 600;
    var ph = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.BoxGeometry(placeW, placeH, placeD)),
      new THREE.LineBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.35 })
    );
    ph.name = '__decor_placeholder__';
    ph.position.set(0, placeH / 2, 0);
    parentGroup.add(ph);

    if (ArchitecturalRenderer._gltfPending[url]) {
      ArchitecturalRenderer._gltfPending[url].push(applyModel);
      return;
    }
    ArchitecturalRenderer._gltfPending[url] = [applyModel];

    function doLoad() {
      if (!window.THREE || !window.THREE.GLTFLoader) {
        if (typeof window.ensureGLTFLoader === 'function') {
          window.ensureGLTFLoader(doLoad);
        } else {
          setTimeout(doLoad, 80);
        }
        return;
      }

      function recoverFailedModel() {
        var ph = parentGroup ? parentGroup.getObjectByName('__decor_placeholder__') : null;
        if (ph && parentGroup) parentGroup.remove(ph);
        delete ArchitecturalRenderer._gltfPending[url];
        // Smart recovery: If the item was a chair or has chair in name, load chair_1.glb fallback!
        var furnName = (furn && furn.name ? furn.name : '').toLowerCase();
        var isChair = (furn && furn.decorType === 'chair') || furnName.indexOf('chair') !== -1 || furnName.indexOf('seat') !== -1 || furnName.indexOf('office') !== -1;
        if (isChair && url !== 'assets/decors/chair_1.glb') {
          self.loadAndAttachGLB('assets/decors/chair_1.glb', parentGroup, dims, onLoaded, furn);
          return;
        }
        if (furnName.indexOf('table') !== -1 || furnName.indexOf('desk') !== -1 || furnName.indexOf('dining') !== -1) {
          self.loadAndAttachGLB('assets/decors/dining_table2.glb', parentGroup, dims, onLoaded, furn);
          return;
        }
        if (furnName.indexOf('sofa') !== -1 || furnName.indexOf('couch') !== -1) {
          self.loadAndAttachGLB('assets/decors/ashley_padova_3_seater_sofa.glb', parentGroup, dims, onLoaded, furn);
          return;
        }
        if (furnName.indexOf('bed') !== -1) {
          self.loadAndAttachGLB('assets/decors/cama_3.glb', parentGroup, dims, onLoaded, furn);
          return;
        }
        // Universal Smart Fallback: default to photorealistic office chair model
        self.loadAndAttachGLB('assets/decors/chair_1.glb', parentGroup, dims, onLoaded, furn);
        if (window.__cc && window.__cc.gl) {
          if (window.__cc.gl.apply) window.__cc.gl.apply(true);
          if (window.__cc.gl.settle) window.__cc.gl.settle();
        }
      }

      // Fast-path: Decode Base64 Data URL directly via fetch -> ArrayBuffer for 100% reliable local/offline parsing without atob stack limits
      if (typeof url === 'string' && url.indexOf('data:') === 0) {
        if (typeof fetch === 'function') {
          fetch(url).then(function (res) { return res.arrayBuffer(); }).then(function (buf) {
            var b64Loader = new THREE.GLTFLoader();
            b64Loader.parse(buf, '', function (gltf) {
              ArchitecturalRenderer._gltfCache[url] = gltf.scene;
              if (furn && furn.id) ArchitecturalRenderer._gltfCache[furn.id] = gltf.scene;
              var cbs = ArchitecturalRenderer._gltfPending[url] || [];
              delete ArchitecturalRenderer._gltfPending[url];
              cbs.forEach(function (cb) {
                try { cb(gltf.scene); } catch (e) { console.error(e); }
              });
              if (window.__cc && window.__cc.gl) {
                if (window.__cc.gl.apply) window.__cc.gl.apply(true);
                if (window.__cc.gl.settle) window.__cc.gl.settle();
              }
            }, function (parseErr) {
              console.warn('[Orbix 3D] Base64 GLTF parse error:', parseErr);
              recoverFailedModel();
            });
          }).catch(function (fetchErr) {
            console.warn('[Orbix 3D] Failed fetch of data URL:', fetchErr);
            recoverFailedModel();
          });
          return;
        }
      }

      // If url is a custom model ID rather than an HTTP URL, do not fire a 404 network request
      var isHttpUrl = typeof url === 'string' && (url.indexOf('http://') === 0 || url.indexOf('https://') === 0 || url.indexOf('/') === 0 || url.indexOf('assets/') === 0 || url.indexOf('blob:') === 0);
      if (!isHttpUrl) {
        recoverFailedModel();
        return;
      }

      var loader = new THREE.GLTFLoader();
      loader.load(url, function (gltf) {
        ArchitecturalRenderer._gltfCache[url] = gltf.scene;
        if (furn && furn.id) ArchitecturalRenderer._gltfCache[furn.id] = gltf.scene;
        var cbs = ArchitecturalRenderer._gltfPending[url] || [];
        delete ArchitecturalRenderer._gltfPending[url];
        cbs.forEach(function (cb) {
          try { cb(gltf.scene); } catch (e) { console.error(e); }
        });
        if (window.__cc && window.__cc.gl) {
          if (window.__cc.gl.apply) window.__cc.gl.apply(true);
          if (window.__cc.gl.settle) window.__cc.gl.settle();
        }
      }, undefined, function (err) {
        console.warn('[Orbix 3D] Failed to load decor model:', url, err);
        recoverFailedModel();
      });
    }

    doLoad();
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Decor & Appliance Mesh (Excluded from Pricing)
     Renders Photorealistic Textured 3D SketchUp GLTF Models or Procedural Fallback
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildDecorMesh = function (furn, fg, dims) {
    var cat = (furn.category || 'decor').toLowerCase();
    var name = (furn.name || '').toLowerCase();
    var id = (furn.id || '').toLowerCase();
    var code = (furn.code || furn.catalogItemId || '').toLowerCase();

    // 1. Resolve exact .glb model URL
    var glbUrl = furn.blobUrl || furn.modelUrl || furn.glbPath || null;
    if (glbUrl && typeof glbUrl === 'string' && /\.skp$/i.test(glbUrl)) {
      // Map old .skp path to new .glb model
      var base = glbUrl.replace(/^.*[\\\/]/, '').replace(/\.skp$/i, '');
      var slug = base.replace(/[\+\s\-]+/g, '_').replace(/[^\w\.]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '').toLowerCase();
      if (slug === 'chair_1' || slug === 'chair' || slug.indexOf('chair') !== -1) {
        glbUrl = 'assets/decors/chair_1.glb';
      } else {
        glbUrl = 'assets/decors/' + slug + '.glb';
      }
    }

    // 2. Lookup in window.ORBIX_DECORS_CATALOG (46 models)
    if (!glbUrl && typeof window !== 'undefined' && window.ORBIX_DECORS_CATALOG && Array.isArray(window.ORBIX_DECORS_CATALOG)) {
      var match = window.ORBIX_DECORS_CATALOG.find(function (d) {
        if (furn.slug && d.slug === furn.slug) return true;
        if (d.id === furn.id || d.id === furn.catalogItemId || d.id === furn.code) return true;
        if (d.name && d.name.toLowerCase() === name) return true;
        return false;
      });
      if (match && match.modelUrl) {
        glbUrl = match.modelUrl;
      }
    }

    // 3. Fallback smart mapping from keywords to rich SketchUp models
    if (!glbUrl) {
      if (name.indexOf('windsor') !== -1) glbUrl = 'assets/decors/bed_windsor_1.glb';
      else if (name.indexOf('cama') !== -1) glbUrl = 'assets/decors/cama_3.glb';
      else if (name.indexOf('girls') !== -1 && name.indexOf('bed') !== -1) glbUrl = 'assets/decors/girls_bed.glb';
      else if (name.indexOf('ashley') !== -1) glbUrl = 'assets/decors/ashley_padova_3_seater_sofa.glb';
      else if (name.indexOf('boucle') !== -1 || name.indexOf('ovo') !== -1) glbUrl = 'assets/decors/sofa_ovo_z_pojemnikiem_beżowa_boucle.glb';
      else if (name.indexOf('hob') !== -1 && name.indexOf('3') !== -1) glbUrl = 'assets/decors/hob_1.glb';
      else if (name.indexOf('hob') !== -1) glbUrl = 'assets/decors/hob.glb';
      else if (name.indexOf('dishwasher') !== -1) glbUrl = 'assets/decors/kitchenaid_dishwasher.glb';
      else if (name.indexOf('lamp') !== -1) glbUrl = 'assets/decors/floor_lamp.glb';
      else if (name.indexOf('jaali') !== -1) glbUrl = 'assets/decors/jaali_partition.glb';
      else if (name.indexOf('partition') !== -1) glbUrl = 'assets/decors/partition_wall.glb';
      else if (name.indexOf('vegetables') !== -1) glbUrl = 'assets/decors/vegetables.glb';
      else if (name.indexOf('teapot') !== -1) glbUrl = 'assets/decors/teapot.glb';
      else if (name.indexOf('fig') !== -1 || (name.indexOf('plant') !== -1 && name.indexOf('tall') !== -1)) glbUrl = 'assets/decors/flower_pot_12.glb';
      else if (name.indexOf('succulent') !== -1) glbUrl = 'assets/decors/succulent_decoration.glb';
      else if (name.indexOf('cutlery') !== -1) glbUrl = 'assets/decors/cutlery.glb';
      else if (name.indexOf('dining') !== -1 && name.indexOf('4') !== -1) glbUrl = 'assets/decors/dining_table_4.glb';
      else if (name.indexOf('dining') !== -1) glbUrl = 'assets/decors/dining_table2.glb';
      else if (name.indexOf('tv') !== -1 || name.indexOf('television') !== -1) glbUrl = 'assets/decors/7_mi_tv.glb';
      else if (name.indexOf('refrigerator') !== -1 || name.indexOf('fridge') !== -1) glbUrl = 'assets/decors/r7250_refrigerator_freezer_20_cubic_feet.glb';
      else if (name.indexOf('washing') !== -1 || name.indexOf('sansung') !== -1) glbUrl = 'assets/decors/maquina_de_lavar_roupas_sansung.glb';
      else if (name.indexOf('chimney') !== -1 || name.indexOf('hood') !== -1) glbUrl = 'assets/decors/chimney.glb';
      else if (name.indexOf('chair') !== -1 || furn.decorType === 'chair' || name.indexOf('seat') !== -1 || name.indexOf('office') !== -1 || name.indexOf('armchair') !== -1 || (furn.id && String(furn.id).indexOf('chair') !== -1) || (furn.original_filename && furn.original_filename.toLowerCase().indexOf('chair') !== -1)) glbUrl = 'assets/decors/chair_1.glb';
    }

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
                            (name.indexOf('mariam') !== -1) ? 'mariam_bed' :
                              (name.indexOf('kid') !== -1 && name.indexOf('bed') !== -1) ? 'kid_bed' :
                                (name.indexOf('bed') !== -1) ? 'bed' :
                                  (name.indexOf('collection') !== -1 || name.indexOf('sectional') !== -1) ? 'sofa_collection' :
                                    (name.indexOf('sofa') !== -1 || name.indexOf('couch') !== -1) ? 'sofa' :
                                      (name.indexOf('chair') !== -1 || name.indexOf('armchair') !== -1) ? 'chair' :
                                        (name.indexOf('stool') !== -1) ? 'stool' :
                                          (name.indexOf('mirror') !== -1) ? 'mirror' :
                                            (name.indexOf('tv') !== -1) ? 'tv' : 'general'
    );

    var defDecorElev = (decorType === 'chimney' || decorType === 'hood') ? 1500 :
      (decorType === 'ro_purifier') ? 1200 :
        (decorType === 'microwave') ? 1200 :
          (decorType === 'mirror') ? 800 :
            (decorType === 'sink' || decorType === 'gas_hob') ? 850 : 0;
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '' && parseFloat(furn.elevation) > 0) ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && parseFloat(furn.pos.z) > 0) ?
        parseFloat(furn.pos.z) :
        ((furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ? parseFloat(furn.elevation) : defDecorElev));

    // If still at floor level (0mm) but sitting on a modular unit (counter, table, desk, shelf), snap to unit top elevation
    var isFloorStandingDecor = (decorType === 'bed' || decorType === 'mariam_bed' || decorType === 'kid_bed' ||
      decorType === 'sofa' || decorType === 'sofa_collection' || decorType === 'dining_table' ||
      decorType === 'fridge' || decorType === 'washing_machine' || decorType === 'dishwasher');
    if (elev === 0 && !isFloorStandingDecor && this.currentPlan && Array.isArray(this.currentPlan.furniture)) {
      var Core = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : null;
      var fX = (furn.pos && furn.pos.x) || 0;
      var fY = (furn.pos && furn.pos.y) || 0;
      for (var fIdx = 0; fIdx < this.currentPlan.furniture.length; fIdx++) {
        var oUnit = this.currentPlan.furniture[fIdx];
        if (oUnit.id === furn.id || oUnit.isDecor || oUnit.category === 'decor' || oUnit.category === 'appliance_decor') continue;
        if (Core && Core.Vec2 && Core.getFurniturePolygon) {
          if (Core.Vec2.pointInPolygon({ x: fX, y: fY }, Core.getFurniturePolygon(oUnit))) {
            var unitTop = (oUnit.elevation !== undefined && oUnit.elevation !== null ? parseFloat(oUnit.elevation) : 0) +
              (oUnit.dimensions && oUnit.dimensions.H ? parseFloat(oUnit.dimensions.H) : 850);
            if (unitTop > elev) elev = unitTop;
          }
        }
      }
    }

    // If photorealistic SketchUp GLB model is available, attach it directly!
    if (glbUrl) {
      this.loadAndAttachGLB(glbUrl, fg, dims, undefined, furn);
      var posX = (furn.pos && furn.pos.x) || 0;
      var posY = (furn.pos && furn.pos.y) || 0;
      fg.position.set(posX, elev, posY);
      fg.rotation.y = -(furn.rotY || 0);
      fg.visible = true;
      return fg;
    }

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

    } else if (decorType === 'bed' || decorType === 'master_bed' || decorType === 'mariam_bed' || decorType === 'kid_bed') {
      var isKid = (decorType === 'kid_bed');
      var isMariam = (decorType === 'mariam_bed');
      // Premium photorealistic materials
      var woodBedMat = new THREE.MeshStandardMaterial({ color: 0x3D2C20, roughness: 0.45, metalness: 0.05 });
      var upholsteredHeadboardMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.88, metalness: 0.02 });
      var tuftLineMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, roughness: 0.95 });
      var mattressMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, roughness: 0.7 });
      var mattressPipingMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, roughness: 0.6 });
      var duvetMat = new THREE.MeshStandardMaterial({ color: isKid ? 0x0284C7 : 0x475569, roughness: 0.82 });
      var sheetFoldMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.65 });
      var pillowBackMat = new THREE.MeshStandardMaterial({ color: 0x64748B, roughness: 0.85 });
      var pillowMat = new THREE.MeshStandardMaterial({ color: 0xFFFFFF, roughness: 0.75 });
      var accentPillowMat = new THREE.MeshStandardMaterial({ color: 0xD97706, roughness: 0.8 });
      var brassMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.88, roughness: 0.22 });
      var lampShadeMat = new THREE.MeshStandardMaterial({ color: 0xFEF3C7, emissive: 0xFDE68A, emissiveIntensity: 0.7, roughness: 0.9 });

      // 1. Bed Platform Frame with Leg Support
      var frameH = 260;
      var frameMesh = new THREE.Mesh(new THREE.BoxGeometry(W, frameH, D), woodBedMat);
      frameMesh.position.set(0, frameH / 2, 0);
      frameMesh.castShadow = true; frameMesh.receiveShadow = true;
      frameMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(frameMesh);

      // Angled Tapered Legs (4 corners)
      var legGeo = new THREE.CylinderGeometry(20, 14, 120, 16);
      [
        [-W / 2 + 60, -D / 2 + 80],
        [W / 2 - 60, -D / 2 + 80],
        [-W / 2 + 60, D / 2 - 80],
        [W / 2 - 60, D / 2 - 80]
      ].forEach(function (lp) {
        var leg = new THREE.Mesh(legGeo, brassMat);
        leg.position.set(lp[0], 60, lp[1]);
        leg.castShadow = true;
        fg.add(leg);
      });

      // 2. Photorealistic Channel-Tufted Upholstered Headboard
      var headboardH = Math.max(H, 1100);
      var headboardW = W + (isMariam ? 80 : 40);
      var headboardD = 90;
      var hbBase = new THREE.Mesh(new THREE.BoxGeometry(headboardW, headboardH, headboardD), upholsteredHeadboardMat);
      hbBase.position.set(0, headboardH / 2, -D / 2 + headboardD / 2);
      hbBase.castShadow = true;
      fg.add(hbBase);

      // Vertical fluted channel tufting panels along the headboard
      var numPanels = 8;
      var pWidth = (headboardW - 20) / numPanels;
      for (var pi = 0; pi < numPanels; pi++) {
        var px = -headboardW / 2 + 10 + pWidth * pi + pWidth / 2;
        var panelGeo = new THREE.BoxGeometry(pWidth - 6, headboardH - 30, 22);
        var panelMesh = new THREE.Mesh(panelGeo, upholsteredHeadboardMat);
        panelMesh.position.set(px, headboardH / 2, -D / 2 + headboardD + 6);
        panelMesh.castShadow = true;
        fg.add(panelMesh);

        var groove = new THREE.Mesh(new THREE.BoxGeometry(4, headboardH - 20, 26), tuftLineMat);
        groove.position.set(-headboardW / 2 + 10 + pWidth * (pi + 1), headboardH / 2, -D / 2 + headboardD + 4);
        fg.add(groove);
      }

      var hbTrimTop = new THREE.Mesh(new THREE.BoxGeometry(headboardW + 8, 20, headboardD + 18), brassMat);
      hbTrimTop.position.set(0, headboardH - 10, -D / 2 + headboardD / 2 + 6);
      fg.add(hbTrimTop);

      // 3. Realistic Multi-Layer Comfort Mattress with Edge Piping
      var matH = 260;
      var matW = W - 30;
      var matD = D - 90;
      var matMesh = new THREE.Mesh(new THREE.BoxGeometry(matW, matH, matD), mattressMat);
      matMesh.position.set(0, frameH + matH / 2, 25);
      matMesh.castShadow = true; matMesh.receiveShadow = true;
      fg.add(matMesh);

      var pipeTop = new THREE.Mesh(new THREE.BoxGeometry(matW + 6, 12, matD + 6), mattressPipingMat);
      pipeTop.position.set(0, frameH + matH - 6, 25);
      fg.add(pipeTop);

      // 4. Luxury Draped Duvet / Comforter
      var duvetD = matD * 0.65;
      var duvetH = 45;
      var duvetMesh = new THREE.Mesh(new THREE.BoxGeometry(matW + 24, duvetH, duvetD), duvetMat);
      duvetMesh.position.set(0, frameH + matH + duvetH / 2, 25 + matD / 2 - duvetD / 2);
      duvetMesh.castShadow = true; duvetMesh.receiveShadow = true;
      fg.add(duvetMesh);

      // Side Drapes falling over the bed edges
      var sideDrapeGeo = new THREE.BoxGeometry(14, matH * 0.75, duvetD);
      var leftDrape = new THREE.Mesh(sideDrapeGeo, duvetMat);
      leftDrape.position.set(-matW / 2 - 10, frameH + matH - matH * 0.35, 25 + matD / 2 - duvetD / 2);
      fg.add(leftDrape);
      var rightDrape = new THREE.Mesh(sideDrapeGeo, duvetMat);
      rightDrape.position.set(matW / 2 + 10, frameH + matH - matH * 0.35, 25 + matD / 2 - duvetD / 2);
      fg.add(rightDrape);

      // Turn-down fold showing contrast white inner sheet
      var foldGeo = new THREE.BoxGeometry(matW + 18, 30, 180);
      var foldMesh = new THREE.Mesh(foldGeo, sheetFoldMat);
      foldMesh.position.set(0, frameH + matH + 15, 25 + matD / 2 - duvetD - 60);
      foldMesh.castShadow = true;
      fg.add(foldMesh);

      // 5. Layered Pillows
      if (isKid) {
        var kPillow = new THREE.Mesh(new THREE.BoxGeometry(matW * 0.72, 85, 360), pillowMat);
        kPillow.position.set(0, frameH + matH + 42, -D / 2 + 250);
        kPillow.rotation.x = 0.22;
        kPillow.castShadow = true;
        fg.add(kPillow);
      } else {
        var pW = matW * 0.42;
        [-matW * 0.23, matW * 0.23].forEach(function (px) {
          var euroPil = new THREE.Mesh(new THREE.BoxGeometry(pW, 110, 320), pillowBackMat);
          euroPil.position.set(px, frameH + matH + 65, -D / 2 + 190);
          euroPil.rotation.x = 0.35;
          euroPil.castShadow = true;
          fg.add(euroPil);
        });

        [-matW * 0.23, matW * 0.23].forEach(function (px) {
          var pil = new THREE.Mesh(new THREE.BoxGeometry(pW * 0.95, 80, 360), pillowMat);
          pil.position.set(px, frameH + matH + 40, -D / 2 + 320);
          pil.rotation.x = 0.12;
          pil.castShadow = true;
          fg.add(pil);
        });

        var accentCushion = new THREE.Mesh(new THREE.BoxGeometry(340, 180, 90), accentPillowMat);
        accentCushion.position.set(0, frameH + matH + 65, -D / 2 + 370);
        accentCushion.rotation.x = 0.25;
        accentCushion.castShadow = true;
        fg.add(accentCushion);
      }

      // 6. Nightstands & Designer Ambient Lamps for Master Bed Set
      if (isMariam || decorType === 'master_bed') {
        var nsW = 480, nsH = 460, nsD = 440;
        [-W / 2 - nsW / 2 - 15, W / 2 + nsW / 2 + 15].forEach(function (nsX) {
          var nsMesh = new THREE.Mesh(new THREE.BoxGeometry(nsW, nsH - 120, nsD), woodBedMat);
          nsMesh.position.set(nsX, (nsH - 120) / 2 + 120, -D / 2 + nsD / 2 + 40);
          nsMesh.castShadow = true; nsMesh.receiveShadow = true;
          fg.add(nsMesh);

          [
            [nsX - nsW / 2 + 40, -D / 2 + 70],
            [nsX + nsW / 2 - 40, -D / 2 + 70],
            [nsX - nsW / 2 + 40, -D / 2 + nsD],
            [nsX + nsW / 2 - 40, -D / 2 + nsD]
          ].forEach(function (nsp) {
            var nsLeg = new THREE.Mesh(new THREE.CylinderGeometry(14, 9, 120, 16), brassMat);
            nsLeg.position.set(nsp[0], 60, nsp[1]);
            nsLeg.castShadow = true;
            fg.add(nsLeg);
          });

          var drawerFace = new THREE.Mesh(new THREE.BoxGeometry(nsW - 16, (nsH - 140) / 2, 8), upholsteredHeadboardMat);
          drawerFace.position.set(nsX, 120 + (nsH - 120) * 0.72, -D / 2 + nsD + 40 + 4);
          fg.add(drawerFace);

          var pullHandle = new THREE.Mesh(new THREE.BoxGeometry(100, 12, 14), brassMat);
          pullHandle.position.set(nsX, 120 + (nsH - 120) * 0.72, -D / 2 + nsD + 40 + 12);
          fg.add(pullHandle);

          var lampZ = -D / 2 + nsD / 2 + 40;
          var lampBase = new THREE.Mesh(new THREE.CylinderGeometry(55, 65, 30, 24), brassMat);
          lampBase.position.set(nsX, nsH + 15, lampZ);
          lampBase.castShadow = true;
          fg.add(lampBase);

          var lampStem = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 140, 16), brassMat);
          lampStem.position.set(nsX, nsH + 95, lampZ);
          fg.add(lampStem);

          var shade = new THREE.Mesh(new THREE.CylinderGeometry(75, 115, 150, 24), lampShadeMat);
          shade.position.set(nsX, nsH + 175, lampZ);
          shade.castShadow = true;
          fg.add(shade);
        });
      }

    } else if (decorType === 'sofa_collection') {
      var colFabMat = new THREE.MeshStandardMaterial({ color: 0x1E3A8A, roughness: 0.85 });
      var sH = Math.min(420, H * 0.5);

      var mainW = W - 100;
      var mainSeat = new THREE.Mesh(new THREE.BoxGeometry(mainW, sH * 0.65, D * 0.6), colFabMat);
      mainSeat.position.set(0, sH * 0.65 / 2 + 80, 0);
      mainSeat.castShadow = true;
      fg.add(mainSeat);

      var backH = H - sH;
      var backM = new THREE.Mesh(new THREE.BoxGeometry(mainW, backH, 120), colFabMat);
      backM.position.set(0, sH + backH / 2, -D * 0.3 + 60);
      backM.castShadow = true;
      fg.add(backM);

      var chaiseL = new THREE.Mesh(new THREE.BoxGeometry(W * 0.35, sH * 0.65, D * 0.4), colFabMat);
      chaiseL.position.set(-mainW / 2 + W * 0.175, sH * 0.65 / 2 + 80, D * 0.3);
      chaiseL.castShadow = true;
      fg.add(chaiseL);

      var pilMat = new THREE.MeshStandardMaterial({ color: 0xF59E0B, roughness: 0.9 });
      var pil1 = new THREE.Mesh(new THREE.BoxGeometry(160, 160, 60), pilMat);
      pil1.position.set(-mainW / 2 + 120, sH + 100, -D * 0.3 + 120);
      pil1.rotation.y = 0.35;
      fg.add(pil1);

      var pil2 = new THREE.Mesh(new THREE.BoxGeometry(160, 160, 60), pilMat);
      pil2.position.set(mainW / 2 - 120, sH + 100, -D * 0.3 + 120);
      pil2.rotation.y = -0.35;
      fg.add(pil2);

    } else if (decorType === 'chair') {
      var chairFab = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85 });
      var chairLegMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.8, roughness: 0.3 });
      var cSeatH = 420;
      var cSeatGeo = new THREE.CylinderGeometry(Math.min(W, D) * 0.44, Math.min(W, D) * 0.42, 100, 24);
      var cSeat = new THREE.Mesh(cSeatGeo, chairFab);
      cSeat.position.set(0, cSeatH, 0);
      cSeat.castShadow = true;
      fg.add(cSeat);

      var backGeo = new THREE.CylinderGeometry(Math.min(W, D) * 0.46, Math.min(W, D) * 0.46, H - cSeatH, 24, 1, true, -Math.PI * 0.75, Math.PI * 1.5);
      var backMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.85, side: THREE.DoubleSide });
      var cBack = new THREE.Mesh(backGeo, backMat);
      cBack.position.set(0, cSeatH + (H - cSeatH) / 2, 0);
      cBack.castShadow = true;
      fg.add(cBack);

      var legGeo = new THREE.CylinderGeometry(14, 9, cSeatH - 50, 12);
      [[-W * 0.28, -D * 0.28], [W * 0.28, -D * 0.28], [-W * 0.28, D * 0.28], [W * 0.28, D * 0.28]].forEach(function (lPos) {
        var leg = new THREE.Mesh(legGeo, chairLegMat);
        leg.position.set(lPos[0], (cSeatH - 50) / 2, lPos[1]);
        leg.rotation.z = lPos[0] > 0 ? -0.12 : 0.12;
        leg.rotation.x = lPos[1] > 0 ? 0.12 : -0.12;
        leg.castShadow = true;
        fg.add(leg);
      });

    } else if (decorType === 'stool') {
      var stoolTopMat = new THREE.MeshStandardMaterial({ color: 0x0F172A, roughness: 0.8 });
      var stoolLegMat = new THREE.MeshStandardMaterial({ color: 0xD4AF37, metalness: 0.85, roughness: 0.25 });
      var sR = Math.min(W, D) * 0.44;
      var sTop = new THREE.Mesh(new THREE.CylinderGeometry(sR, sR * 0.95, 60, 24), stoolTopMat);
      sTop.position.set(0, H - 30, 0);
      sTop.castShadow = true;
      fg.add(sTop);

      var legR = 10;
      var sLegGeo = new THREE.CylinderGeometry(legR, legR * 0.75, H - 60, 12);
      for (var sl = 0; sl < 4; sl++) {
        var sAng = (sl / 4) * Math.PI * 2 + Math.PI / 4;
        var sLeg = new THREE.Mesh(sLegGeo, stoolLegMat);
        sLeg.position.set(Math.cos(sAng) * sR * 0.72, (H - 60) / 2, Math.sin(sAng) * sR * 0.72);
        sLeg.castShadow = true;
        fg.add(sLeg);
      }
      var ring = new THREE.Mesh(new THREE.TorusGeometry(sR * 0.68, 6, 8, 24), stoolLegMat);
      ring.position.set(0, H * 0.35, 0);
      ring.rotation.x = Math.PI / 2;
      fg.add(ring);

    } else if (decorType === 'mirror') {
      var mirrorFrameMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.8, roughness: 0.3 });
      var glassReflectMat = new THREE.MeshStandardMaterial({ color: 0xF8FAFC, metalness: 0.98, roughness: 0.04 });
      var mFrame = new THREE.Mesh(new THREE.BoxGeometry(W, H, 24), mirrorFrameMat);
      mFrame.position.set(0, H / 2, 0);
      mFrame.castShadow = true;
      fg.add(mFrame);

      var mGlass = new THREE.Mesh(new THREE.BoxGeometry(W - 24, H - 24, 6), glassReflectMat);
      mGlass.position.set(0, H / 2, 10);
      fg.add(mGlass);

    } else {
      // Smart Recovery: Never leave a generic monolith rectangle box if hints exist
      if (name.indexOf('chair') !== -1 || furn.decorType === 'chair' || name.indexOf('seat') !== -1 || name.indexOf('office') !== -1 || name.indexOf('armchair') !== -1 || (furn.id && String(furn.id).indexOf('chair') !== -1)) {
        this.loadAndAttachGLB('assets/decors/chair_1.glb', fg, dims, undefined, furn);
      } else if (name.indexOf('table') !== -1 || name.indexOf('desk') !== -1 || name.indexOf('dining') !== -1) {
        this.loadAndAttachGLB('assets/decors/dining_table2.glb', fg, dims, undefined, furn);
      } else if (name.indexOf('sofa') !== -1 || name.indexOf('couch') !== -1) {
        this.loadAndAttachGLB('assets/decors/ashley_padova_3_seater_sofa.glb', fg, dims, undefined, furn);
      } else if (name.indexOf('bed') !== -1) {
        this.loadAndAttachGLB('assets/decors/cama_3.glb', fg, dims, undefined, furn);
      } else {
        // Modern styled architectural showcase stand with chamfered top instead of massive solid box
        var standH = Math.min(H, 800);
        var genMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.35, metalness: 0.2 });
        var box = new THREE.Mesh(new THREE.BoxGeometry(W, standH, D), genMat);
        box.position.set(0, standH / 2, 0);
        box.castShadow = true;
        fg.add(box);

        var topBevel = new THREE.Mesh(new THREE.BoxGeometry(W + 8, 12, D + 8), new THREE.MeshStandardMaterial({ color: 0xCBD5E1, roughness: 0.25, metalness: 0.4 }));
        topBevel.position.set(0, standH + 6, 0);
        topBevel.castShadow = true;
        fg.add(topBevel);
      }
    }

    var posX = (furn.pos && furn.pos.x) || 0;
    var posY = (furn.pos && furn.pos.y) || 0;
    fg.position.set(posX, elev, posY);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;
    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build L-Shaped Corner Base Unit (Cookscape) - 900x900 Corner Module
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildLCornerCabinetMesh = function (furn, fg, dims, carcassMat, counterMat, plinthH, bodyH, counterH, getShutterMaterial, handleType, handleMat, isBase, isKitchen) {
    var catL = (furn.category || '').toLowerCase();
    var nameL = (furn.name || '').toLowerCase();
    var isWallCorner = (!isBase && (catL.indexOf('wall') !== -1 || nameL.indexOf('wall') !== -1 || /(^|\b|_|-)(wcm|wbcm)($|\b|_|-|\d+)/i.test(nameL) || /(^|\b|_|-)(wcm|wbcm)($|\b|_|-|\d+)/i.test(furn.code || '') || /(^|\b|_|-)(wcm|wbcm)($|\b|_|-|\d+)/i.test(furn.id || ''))) || (furn.elevation >= 1000) || (furn.unitConfig && furn.unitConfig.ctype === 'kwall');
    if (isWallCorner) {
      plinthH = 0;
      counterH = 0;
      bodyH = (dims && dims.H) ? dims.H : 600;
    }
    var defLeg = isWallCorner ? 600 : 900;
    var defDepth = isWallCorner ? 300 : 550;
    var legW = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.legW) || (dims && dims.W) || defLeg;
    var legD = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.legD) || (dims && dims.D && dims.D >= 500 ? dims.D : (dims && dims.W ? dims.W : defLeg));
    var depth = (furn.unitConfig && furn.unitConfig.corner && furn.unitConfig.corner.depth) || (dims && dims.D && dims.D < legW ? dims.D : defDepth);
    var W = legW;
    var D = legD;
    var openW = W - depth;
    var openD = D - depth;

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

    // 6. Shelves (1 Shelf default, shelves: 1)
    var numShelves = (furn.unitConfig && furn.unitConfig.shelves !== undefined) ? parseInt(furn.unitConfig.shelves) : 1;
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

    // 7. Countertop Stone (20mm Stone, counterH = 20)
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

    // 8. Doors (Two Hinged Doors meeting cleanly at Inside 90° Corner, both openable)
    var shH = bodyH - 6;
    var shutterCenterY = plinthH + 3 + shH / 2;
    var door1W = Math.max(80, openW - 22);
    var door2W = Math.max(80, openD - 22);
    var shutterMat0 = getShutterMaterial(0);
    var shutterMat1 = getShutterMaterial(1);
    var lHandleY = isWallCorner ? -shH * 0.25 : ((isBase || plinthH > 0) ? shH * 0.25 : 0);

    // Door 1 (Front Door on Left Wing Face)
    var d1LeftX = -W / 2 + 4;
    var hinge1Group = new THREE.Group();
    hinge1Group.name = "ShutterHinge_0";
    hinge1Group.position.set(d1LeftX, shutterCenterY, -D / 2 + depth + 9);
    hinge1Group.userData = { isShutterHinge: true, shutterIdx: 0, furnitureId: furn.id };

    var d1Mesh = new THREE.Mesh(new THREE.BoxGeometry(door1W, shH, 18), shutterMat0);
    d1Mesh.position.set(door1W / 2, 0, 0);
    d1Mesh.castShadow = true; d1Mesh.receiveShadow = true;
    d1Mesh.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hinge1Group, parentGroup: fg, furnitureId: furn.id };
    hinge1Group.add(d1Mesh);

    var h1Group = ArchitecturalRenderer.createHandleMesh("pull", handleMat, true, Math.min(180, shH * 0.35));
    if (h1Group) {
      h1Group.position.set(door1W - 28, lHandleY, 14);
      h1Group.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hinge1Group, parentGroup: fg, furnitureId: furn.id };
      h1Group.traverse(function (c) {
        if (c.isMesh) c.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hinge1Group, parentGroup: fg, furnitureId: furn.id };
      });
      hinge1Group.add(h1Group);
    }

    var isD1Open = !!(furn.shutterStates && furn.shutterStates[0]);
    hinge1Group.rotation.y = isD1Open ? -Math.PI * 0.55 : 0;
    fg.add(hinge1Group);

    // Door 2 (Side Door on Right Wing Face)
    var d2RightZ = D / 2 - 18;
    var hinge2Group = new THREE.Group();
    hinge2Group.name = "ShutterHinge_1";
    hinge2Group.position.set(W / 2 - depth - 9, shutterCenterY, d2RightZ);
    hinge2Group.userData = { isShutterHinge: true, shutterIdx: 1, furnitureId: furn.id };

    var d2Mesh = new THREE.Mesh(new THREE.BoxGeometry(18, shH, door2W), shutterMat1);
    d2Mesh.position.set(0, 0, -door2W / 2);
    d2Mesh.castShadow = true; d2Mesh.receiveShadow = true;
    d2Mesh.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 1, hingeGroup: hinge2Group, parentGroup: fg, furnitureId: furn.id };
    hinge2Group.add(d2Mesh);

    var hGroup = ArchitecturalRenderer.createHandleMesh("pull", handleMat, true, Math.min(180, shH * 0.35));
    if (hGroup) {
      hGroup.position.set(-14, lHandleY, -door2W + 28);
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
    var isWallCorner = (!isBase && (catL.indexOf('wall') !== -1 || nameL.indexOf('wall') !== -1 || /(^|\b|_|-)(wcm|wbcm)($|\b|_|-|\d+)/i.test(nameL))) || (furn.elevation >= 1000) || (furn.unitConfig && furn.unitConfig.ctype === 'kwall');
    var defElevCorner = isWallCorner ? 1500 : 0;
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) : defElevCorner);
    var posX = (furn.pos && furn.pos.x) || 0;
    var posY = (furn.pos && furn.pos.y) || 0;
    fg.position.set(posX, elev, posY);
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

    // Use configured laminate finish for decorative wall panels & ledges
    var panelMat = carcassMat;
    var fin = (furn.materials && furn.materials.carcass && furn.materials.carcass.finish) ||
      (furn.materials && furn.materials.shutter && furn.materials.shutter.finish) ||
      (furn.unitConfig && (furn.unitConfig.shutterCol || furn.unitConfig.carcass));
    if (fin && fin !== 'none' && fin !== 'Absolute White') {
      panelMat = ArchitecturalRenderer.resolveLaminateMaterial(fin, 0x6E4E35);
    }

    var panelGeo = new THREE.BoxGeometry(W, H, D);
    var panelMesh = new THREE.Mesh(panelGeo, panelMat);
    // Center at z = 0 to match 2D plan center! In 2D, unit rectangle is centered at furn.pos.
    panelMesh.position.set(0, H / 2, 0);
    panelMesh.castShadow = true; panelMesh.receiveShadow = true;
    panelMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(panelMesh);

    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '') ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && furn.pos.z !== 0) ?
        parseFloat(furn.pos.z) : 0);
    var posX = (furn.pos && furn.pos.x) || 0;
    var posY = (furn.pos && furn.pos.y) || 0;
    fg.position.set(posX, elev, posY);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;
    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build O/S (Only Shutter) Unit (e.g. LOFT 2 DOOR O/S, FM 120 O/S, WM 60 O/S)
     Mounts flush against existing masonry opening / niche frame. Zero carcass panels.
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildOnlyShutterMesh = function (furn, fg, dims, carcassMat, getShutterMaterial, handleType, handleMat, counterMat, plinthH, counterH, isBase) {
    var W = dims.W;
    var H = dims.H;

    var catOS = (furn.category || '').toLowerCase();
    var nameOS = (furn.name || '').toLowerCase();
    var isLoftOS = (catOS.indexOf('loft') !== -1 || nameOS.indexOf('loft') !== -1 || (furn.id && furn.id.indexOf('loft') !== -1));
    var isWallOS = !isLoftOS && (catOS.indexOf('wall') !== -1 || nameOS.indexOf('wall') !== -1 || /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(nameOS) || (furn.id && /(wm|wcm)/i.test(furn.id)) || (furn.code && /(wm|wcm)/i.test(furn.code)));
    var isWrbOS = (catOS === 'wardrobe' || nameOS.indexOf('wrb') !== -1 || (furn.id && /wrb/i.test(furn.id)));
    var isTrueOnlyShutter = !!(furn.unitConfig && furn.unitConfig.isOnlyShutter) || (furn.name && /\bo\/?s\b/i.test(furn.name)) || (furn.costCategory && furn.costCategory.indexOf('O/S') !== -1);
    var isBaseOS = !isWrbOS && (isBase || catOS === 'kitchen_base' || catOS === 'kitchen_fm' || catOS === 'kitchen_os' || catOS.indexOf('base') !== -1 || nameOS.indexOf('fm') !== -1 || (furn.id && /fm/i.test(furn.id)) || catOS === 'crockery' || (furn.costCategory && furn.costCategory.indexOf('Base') !== -1) || (!isWallOS && !isLoftOS));

    var isFcmCornerOS = /fcm[-_ ]*(rt|lt)/i.test(furn.id || furn.catalogItemId || furn.code || furn.name || '') || (furn.unitConfig && /fcm[-_ ]*(rt|lt)/i.test(furn.unitConfig.unitType || ''));
    var baseD = (dims.D && dims.D >= 18) ? dims.D : (isWrbOS ? 18 : (isWallOS ? 350 : (isBaseOS || isLoftOS ? 550 : 350)));
    var actualPlinthH = isBaseOS ? ((furn.unitConfig && furn.unitConfig.hasLegs === false && !isFcmCornerOS) ? 0 : ((plinthH !== undefined && plinthH > 0) ? plinthH : 100)) : 0;
    var actualCounterH = isBaseOS ? ((furn.unitConfig && furn.unitConfig.counter === 'none' && !isFcmCornerOS) ? 0 : ((counterH !== undefined && counterH > 0) ? counterH : 20)) : 0;
    var bodyH;
    if (isBaseOS) {
      // Floor unit: Carcass height is 700mm. Total finished height = 100mm leg + 700mm carcass + 20mm countertop = 820mm
      bodyH = (H >= 800) ? Math.max(100, H - actualPlinthH - actualCounterH) : (H || 700);
      if (bodyH < 100) bodyH = 700;
    } else {
      bodyH = (H <= 350) ? H : Math.max(100, H - actualPlinthH - actualCounterH);
    }

    if (isBaseOS && baseD > 50) {
      // 1. Plinth Kickboard & Adjustable Cabinet Legs
      if (actualPlinthH > 0) {
        var pGeo = new THREE.BoxGeometry(W - 30, actualPlinthH, baseD - 50);
        var pMat = new THREE.MeshStandardMaterial({ color: 0x222222, roughness: 0.8 });
        var pMesh = new THREE.Mesh(pGeo, pMat);
        pMesh.position.set(0, actualPlinthH / 2, -15);
        pMesh.castShadow = true; pMesh.receiveShadow = true;
        pMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
        fg.add(pMesh);

        // Cylindrical Legs with chrome/black feet at 4 corners
        var legMat = new THREE.MeshStandardMaterial({ color: 0x1E293B, metalness: 0.85, roughness: 0.25 });
        var legGeo = new THREE.CylinderGeometry(18, 16, actualPlinthH, 16);
        [
          [-W / 2 + 50, -baseD / 2 + 50],
          [W / 2 - 50, -baseD / 2 + 50],
          [-W / 2 + 50, baseD / 2 - 50],
          [W / 2 - 50, baseD / 2 - 50]
        ].forEach(function (lp) {
          var lm = new THREE.Mesh(legGeo, legMat);
          lm.position.set(lp[0], actualPlinthH / 2, lp[1]);
          lm.castShadow = true;
          lm.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
          fg.add(lm);
        });
      }

      // 2. Countertop Stone Slab
      if (actualCounterH > 0) {
        var slabW = W + 20;
        var slabD = baseD + 25;
        var slabGeo = new THREE.BoxGeometry(slabW, actualCounterH, slabD);
        var MatClass = (typeof THREE.MeshPhysicalMaterial === 'function') ? THREE.MeshPhysicalMaterial : THREE.MeshStandardMaterial;
        var sMat = counterMat || new MatClass({
          color: 0x1A1A1D,
          roughness: 0.14,
          metalness: 0.06,
          clearcoat: 0.85,
          clearcoatRoughness: 0.08,
          reflectivity: 0.75,
          envMapIntensity: 1.15
        });
        var slabMesh = new THREE.Mesh(slabGeo, sMat);
        slabMesh.position.set(0, actualPlinthH + bodyH + actualCounterH / 2, 2.5);
        slabMesh.castShadow = true; slabMesh.receiveShadow = true;
        slabMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
        fg.add(slabMesh);

        var hasHobOS = !!(furn.unitConfig && (furn.unitConfig.appliance === 'hob' || furn.unitConfig.hasHob));
        var hasSinkOS = !!(furn.unitConfig && (furn.unitConfig.appliance === 'sink' || furn.unitConfig.hasSink));
        if (hasHobOS) {
          ArchitecturalRenderer.buildBuiltInHob(fg, slabW, slabD, actualPlinthH + bodyH + actualCounterH, furn.id);
        } else if (hasSinkOS) {
          ArchitecturalRenderer.buildBuiltInSink(fg, slabW, slabD, actualPlinthH + bodyH + actualCounterH, furn.id);
        }
      }
    }

    var numShutters = (furn.unitConfig && furn.unitConfig.shutters !== undefined) ?
      parseInt(furn.unitConfig.shutters) : (W > 1200 ? 3 : W > 600 ? 2 : 1);
    numShutters = Math.max(1, numShutters);

    // Shutter vertical span between plinth and countertop (flush with standard 700mm carcass)
    var shH = Math.max(100, bodyH - 6);
    var hingeY = actualPlinthH + 3 + shH / 2;
    var frontZ = baseD / 2 - 9;
    var frameZ = frontZ - 12.5;

    // Slim perimeter mounting frame (25mm reveal)
    var frameMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.7, metalness: 0.1 });
    var topFrame = new THREE.Mesh(new THREE.BoxGeometry(W, 25, 25), frameMat);
    topFrame.position.set(0, actualPlinthH + bodyH - 12.5, frameZ);
    fg.add(topFrame);
    var botFrame = new THREE.Mesh(new THREE.BoxGeometry(W, 25, 25), frameMat);
    botFrame.position.set(0, actualPlinthH + 12.5, frameZ);
    fg.add(botFrame);
    var frameH = Math.max(10, bodyH - 50);
    var leftFrame = new THREE.Mesh(new THREE.BoxGeometry(25, frameH, 25), frameMat);
    leftFrame.position.set(-W / 2 + 12.5, hingeY, frameZ);
    fg.add(leftFrame);
    var rightFrame = new THREE.Mesh(new THREE.BoxGeometry(25, frameH, 25), frameMat);
    rightFrame.position.set(W / 2 - 12.5, hingeY, frameZ);
    fg.add(rightFrame);

    var hasFixedPanel = !!(furn.unitConfig && furn.unitConfig.fixedPanel && furn.unitConfig.fixedPanel.enabled);
    if (hasFixedPanel) {
      // Corner Only-Shutter (FCM-RT OS or FCM-LT OS): 1 Fixed Blanker Panel & 1 Movable Shutter (Zero Carcass)
      var isLeftOpen = !!(
        (furn.unitConfig.openShutter && furn.unitConfig.openShutter.opening === 'left') ||
        (furn.unitConfig.unitType === 'fcm-lt') ||
        /fcm[-_ ]*lt/i.test(furn.id || furn.name || '')
      );
      var fixW = (furn.unitConfig.fixedPanel && furn.unitConfig.fixedPanel.width) || 600;
      var movW = Math.max(100, W - fixW - 6);

      if (isLeftOpen) {
        // FCM-LT OS: Right 600mm panel is FIXED, Left 450mm panel is movable shutter opening LEFT
        var fixCx = W / 2 - 3 - (fixW - 3) / 2;
        var fixMesh = new THREE.Mesh(new THREE.BoxGeometry(fixW - 3, shH, 18), getShutterMaterial(1));
        fixMesh.position.set(fixCx, hingeY, frontZ);
        fixMesh.castShadow = true; fixMesh.receiveShadow = true;
        fixMesh.userData = { isFurniturePart: true, isFixedPanel: true, parentGroup: fg, furnitureId: furn.id };
        fg.add(fixMesh);

        var hingeX = -W / 2 + 3;
        var hingeGroup = new THREE.Group();
        hingeGroup.name = "ShutterHinge_Left";
        hingeGroup.position.set(hingeX, hingeY, frontZ);
        hingeGroup.userData = { isShutterHinge: true, shutterIdx: 0, furnitureId: furn.id };

        var sGeo = new THREE.BoxGeometry(movW, shH, 18);
        var sMesh = new THREE.Mesh(sGeo, getShutterMaterial(0));
        sMesh.position.set(movW / 2, 0, 0);
        sMesh.castShadow = true; sMesh.receiveShadow = true;
        sMesh.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
        hingeGroup.add(sMesh);

        var hGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, shH * 0.35));
        if (hGroup) {
          hGroup.position.set(movW - 25, 0, 9);
          hGroup.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
          hGroup.traverse(function (c) { if (c.isMesh) c.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id }; });
          hingeGroup.add(hGroup);
        }
        var isOpen = !!(furn.shutterStates && furn.shutterStates[0]);
        hingeGroup.rotation.y = isOpen ? -Math.PI * 0.6 : 0;
        fg.add(hingeGroup);
      } else {
        // FCM-RT OS: Left 600mm panel is FIXED, Right 450mm panel is movable shutter opening RIGHT
        var fixCx = -W / 2 + 3 + (fixW - 3) / 2;
        var fixMesh = new THREE.Mesh(new THREE.BoxGeometry(fixW - 3, shH, 18), getShutterMaterial(0));
        fixMesh.position.set(fixCx, hingeY, frontZ);
        fixMesh.castShadow = true; fixMesh.receiveShadow = true;
        fixMesh.userData = { isFurniturePart: true, isFixedPanel: true, parentGroup: fg, furnitureId: furn.id };
        fg.add(fixMesh);

        var hingeX = W / 2 - 3;
        var hingeGroup = new THREE.Group();
        hingeGroup.name = "ShutterHinge_Right";
        hingeGroup.position.set(hingeX, hingeY, frontZ);
        hingeGroup.userData = { isShutterHinge: true, shutterIdx: 1, furnitureId: furn.id };

        var sGeo = new THREE.BoxGeometry(movW, shH, 18);
        var sMesh = new THREE.Mesh(sGeo, getShutterMaterial(1));
        sMesh.position.set(-movW / 2, 0, 0);
        sMesh.castShadow = true; sMesh.receiveShadow = true;
        sMesh.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 1, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
        hingeGroup.add(sMesh);

        var hGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, true, Math.min(180, shH * 0.35));
        if (hGroup) {
          hGroup.position.set(-movW + 25, 0, 9);
          hGroup.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 1, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
          hGroup.traverse(function (c) { if (c.isMesh) c.userData = { isFurniturePart: true, isShutter: true, shutterIdx: 1, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id }; });
          hingeGroup.add(hGroup);
        }
        var isOpen = !!(furn.shutterStates && furn.shutterStates[1]);
        hingeGroup.rotation.y = isOpen ? Math.PI * 0.6 : 0;
        fg.add(hingeGroup);
      }
    } else {
      var shW = (W - (numShutters + 1) * 3) / numShutters;

      for (var s = 0; s < numShutters; s++) {
        var hingeLeft = (s % 2 === 0);
        var sLeftX = -W / 2 + 3 + s * (shW + 3);
        var hingeX = hingeLeft ? sLeftX : (sLeftX + shW);
        var hingeZ = frontZ;

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
    var posX = (furn.pos && furn.pos.x) || 0;
    var posY = (furn.pos && furn.pos.y) || 0;
    fg.position.set(posX, elev, posY);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;
    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Kitchen Built-in Oven Tall Cabinet (TBM 60 OVEN / oven_tall)
     3-zone structure: Bottom Storage (700mm), Oven Niche (600mm), Top Storage (800mm)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildOvenTallCabinetMesh = function (furn, fg, dims, carcassMat, getShutterMaterial, handleType, handleMat) {
    var cat = (furn.category || 'kitchen_tall').toLowerCase();
    var name = (furn.name || '').toLowerCase();
    var isWall = false;
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
    ovenMeshGroup.traverse(function (c) {
      if (c.isMesh) c.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    });
    fg.add(ovenMeshGroup);

    // 9. Bottom Shutter (Height: bottomH - 4)
    var bShW = W - 6;
    var bShH = Math.max(100, bottomH - 4);
    var bHingeX = -W / 2 + 3;
    var bHingeY = plinthH + bShH / 2 + 2;
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

    // 10. Top Shutter (Height: topH - 4, flush within unit carcass, never above roof)
    var tShW = W - 6;
    var tShH = Math.max(100, topH - 4);
    var tHingeX = -W / 2 + 3;
    var tHingeY = plinthH + bottomH + ovenH + tShH / 2 + 2;
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
    var isLoftCab = (cat.indexOf('loft') !== -1 || name.indexOf('loft') !== -1 || (furn.id && String(furn.id).indexOf('loft') !== -1));
    var isSpiceCab = (cat.indexOf('spice') !== -1 || name.indexOf('spice') !== -1 || (furn.id && String(furn.id).indexOf('spice') !== -1));
    var isWallCab = !isLoftCab && (isWall || cat.indexOf('wall') !== -1 || name.indexOf('wall') !== -1 || /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(name));
    var defElevCab = isLoftCab ? 2100 : (isSpiceCab ? 1350 : (isWallCab ? 1500 : 0));
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '' && (!isWallCab && !isLoftCab && !isSpiceCab || parseFloat(furn.elevation) > 0)) ?
      parseFloat(furn.elevation) :
      ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && (!isWallCab && !isLoftCab && !isSpiceCab || parseFloat(furn.pos.z) > 0)) ?
        parseFloat(furn.pos.z) : defElevCab);
    var posX = (furn.pos && furn.pos.x) || 0;
    var posY = (furn.pos && furn.pos.y) || 0;
    fg.position.set(posX, elev, posY);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;

    return fg;
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Build Placed 3D Furniture Unit
     ───────────────────────────────────────────────────────────────────────────── */
  /* ─────────────────────────────────────────────────────────────────────────────
   Build Photorealistic 3D Staircase (Treads, Riser Steps, Landing Slab & Railing)
   Ascends seamlessly from floor Y=0 to ceiling level Y=2800
   ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.buildStaircaseMesh = function (stair) {
    if (!stair) return null;
    var sg = new THREE.Group();
    sg.name = 'Staircase_' + stair.id;

    var type = stair.type || 'l_shape';
    var turnDir = stair.turnDirection || 'right';
    var sign = turnDir === 'left' ? -1 : 1;
    var W = stair.width || 900;
    var D = stair.treadDepth || 250;
    var totalH = stair.totalHeight || 2800;
    var riserCount = stair.riserCount || 16;
    var riserH = totalH / riserCount; // 175mm
    var f1 = stair.flight1Steps || 8;
    var f2 = stair.flight2Steps || 8;
    var lW = stair.landingWidth || W;
    var lD = stair.landingDepth || W;

    // Materials based on stair.finish
    var finish = stair.finish || 'marble';
    var treadColor = 0xF5F3EE; // Statuario white marble
    var treadRoughness = 0.25;
    if (finish === 'wood') {
      treadColor = 0x8C5E3B; // Warm Teak Wood
      treadRoughness = 0.55;
    } else if (finish === 'concrete') {
      treadColor = 0x94A3B8; // Architectural Grey Basalt Stone
      treadRoughness = 0.8;
    }
    var treadMat = new THREE.MeshStandardMaterial({
      color: treadColor,
      roughness: treadRoughness,
      metalness: 0.05
    });

    // Riser / underbody material
    var riserMat = new THREE.MeshStandardMaterial({
      color: 0xE2E8F0,
      roughness: 0.6,
      metalness: 0.02
    });

    // Stainless steel handrail material
    var railMat = new THREE.MeshStandardMaterial({
      color: 0xCBD5E1,
      metalness: 0.85,
      roughness: 0.2
    });

    // Balustrade tempered glass material
    var glassMat = (typeof THREE.MeshPhysicalMaterial === 'function') ?
      new THREE.MeshPhysicalMaterial({
        color: 0xE0F2FE,
        transparent: true,
        opacity: 0.45,
        roughness: 0.05,
        transmission: 0.85,
        ior: 1.5
      }) :
      new THREE.MeshStandardMaterial({
        color: 0xBAE6FD,
        transparent: true,
        opacity: 0.4
      });

    // Flight 1 Steps (Ascending from Y=0 to landing at Y=f1*riserH)
    var f1L = f1 * D;
    var f2L = f2 * D;
    var bL = (type === 'straight') ? (f1L + (f2 > 0 ? f2L + lD : 0)) : (f1L + lD);
    var startZ = -bL / 2;

    for (var i = 0; i < f1; i++) {
      var curY = i * riserH;
      var curZ = startZ + i * D;

      // Solid step box
      var stepGeo = new THREE.BoxGeometry(W, riserH, D + 20); // 20mm bullnose overhang
      var stepMesh = new THREE.Mesh(stepGeo, treadMat);
      stepMesh.position.set(0, curY + riserH / 2, curZ + D / 2);
      stepMesh.castShadow = true;
      stepMesh.receiveShadow = true;
      sg.add(stepMesh);

      // Solid riser under step
      if (curY > 0) {
        var baseGeo = new THREE.BoxGeometry(W - 10, curY, D);
        var baseMesh = new THREE.Mesh(baseGeo, riserMat);
        baseMesh.position.set(0, curY / 2, curZ + D / 2);
        baseMesh.castShadow = true;
        baseMesh.receiveShadow = true;
        sg.add(baseMesh);
      }
    }

    // Mid Landing Platform (The Turn) at Y = f1 * riserH (1400mm)
    var landY = f1 * riserH;
    var landZ = startZ + f1L;
    var landWidth = (type === 'u_shape' ? (W * 2 + 100) : lW);
    var landX = (type === 'u_shape' ? 50 : 0);

    var landingGeo = new THREE.BoxGeometry(landWidth, riserH, lD);
    var landingMesh = new THREE.Mesh(landingGeo, treadMat);
    landingMesh.position.set(landX, landY - riserH / 2, landZ + lD / 2);
    landingMesh.castShadow = true;
    landingMesh.receiveShadow = true;
    sg.add(landingMesh);

    // Landing solid support base
    var landBaseGeo = new THREE.BoxGeometry(landWidth - 10, landY - riserH, lD - 10);
    var landBaseMesh = new THREE.Mesh(landBaseGeo, riserMat);
    landBaseMesh.position.set(landX, (landY - riserH) / 2, landZ + lD / 2);
    landBaseMesh.castShadow = true;
    landBaseMesh.receiveShadow = true;
    sg.add(landBaseMesh);

    // Flight 2 Steps (Ascending from landing Y=1400 to ceiling Y=2800)
    if (f2 > 0) {
      if (type === 'l_shape') {
        for (var j = 0; j < f2; j++) {
          var step2Y = landY + j * riserH;
          var step2X = (sign === 1) ? (W / 2 + j * D) : (-W / 2 - j * D);
          var step2Z = landZ + lD / 2;

          var f2Geo = new THREE.BoxGeometry(D + 20, riserH, W);
          var f2Mesh = new THREE.Mesh(f2Geo, treadMat);
          f2Mesh.position.set(step2X + (sign === 1 ? D / 2 : -D / 2), step2Y + riserH / 2, step2Z);
          f2Mesh.castShadow = true;
          f2Mesh.receiveShadow = true;
          sg.add(f2Mesh);

          // Support riser under flight 2
          var f2BaseGeo = new THREE.BoxGeometry(D, step2Y, W - 10);
          var f2BaseMesh = new THREE.Mesh(f2BaseGeo, riserMat);
          f2BaseMesh.position.set(step2X + (sign === 1 ? D / 2 : -D / 2), step2Y / 2, step2Z);
          f2BaseMesh.castShadow = true;
          f2BaseMesh.receiveShadow = true;
          sg.add(f2BaseMesh);
        }
      } else if (type === 'u_shape') {
        for (var k = 0; k < f2; k++) {
          var uStepY = landY + k * riserH;
          var uStepZ = landZ - k * D;
          var uStepX = W + 100 / 2;

          var uGeo = new THREE.BoxGeometry(W, riserH, D + 20);
          var uMesh = new THREE.Mesh(uGeo, treadMat);
          uMesh.position.set(uStepX, uStepY + riserH / 2, uStepZ - D / 2);
          uMesh.castShadow = true;
          uMesh.receiveShadow = true;
          sg.add(uMesh);
        }
      } else if (type === 'straight') {
        for (var s = 0; s < f2; s++) {
          var strY = landY + s * riserH;
          var strZ = landZ + lD + s * D;

          var strGeo = new THREE.BoxGeometry(W, riserH, D + 20);
          var strMesh = new THREE.Mesh(strGeo, treadMat);
          strMesh.position.set(0, strY + riserH / 2, strZ + D / 2);
          strMesh.castShadow = true;
          strMesh.receiveShadow = true;
          sg.add(strMesh);
        }
      }
    }

    // Modern Balustrades & Stainless Steel Handrails
    var railH = 900; // mm handrail height above treads
    var railT = 40; // mm handrail diameter / width

    // Flight 1 Handrail (Angled sloping rail)
    var f1Angle = Math.atan2(landY, f1L);
    var f1SlopeLen = Math.hypot(landY, f1L);
    var rail1Geo = new THREE.BoxGeometry(railT, railT, f1SlopeLen);
    var rail1Mesh = new THREE.Mesh(rail1Geo, railMat);
    rail1Mesh.position.set(-W / 2 + railT / 2, landY / 2 + railH, startZ + f1L / 2);
    rail1Mesh.rotation.x = f1Angle;
    rail1Mesh.castShadow = true;
    sg.add(rail1Mesh);

    // Flight 1 Glass Balustrade Panel
    var glass1Geo = new THREE.BoxGeometry(12, railH - 100, f1SlopeLen - 60);
    var glass1Mesh = new THREE.Mesh(glass1Geo, glassMat);
    glass1Mesh.position.set(-W / 2 + railT / 2, landY / 2 + railH / 2, startZ + f1L / 2);
    glass1Mesh.rotation.x = f1Angle;
    sg.add(glass1Mesh);

    // Newel Posts at bottom and landing
    var postGeo = new THREE.CylinderGeometry(20, 20, railH, 16);
    var post1 = new THREE.Mesh(postGeo, railMat);
    post1.position.set(-W / 2 + railT / 2, railH / 2, startZ + D / 2);
    sg.add(post1);

    var post2 = new THREE.Mesh(postGeo, railMat);
    post2.position.set(-W / 2 + railT / 2, landY + railH / 2, landZ);
    sg.add(post2);

    // Set position and rotation in Three.js world
    sg.position.set(stair.pos.x, stair.elevation || 0, stair.pos.y);
    sg.rotation.y = -(stair.rotY || 0);

    sg.userData = {
      isStaircase: true,
      isFurniture: true,
      isFurnitureGroup: true,
      furnitureId: stair.id,
      stairId: stair.id,
      stair: stair
    };

    return sg;
  };

  ArchitecturalRenderer.prototype.buildRollingShutterCabinetMesh = function (furn, fg, dims, carcassMat, counterMat) {
    var W = dims.W || 600;
    var H = dims.H || 1200;
    var D = dims.D || 350;

    // 1. Carcass Housing Box (18mm panels: left, right, top, bottom, back)
    var boxMat = carcassMat || ArchitecturalRenderer.resolveLaminateMaterial('MDF 6601', 0xE2DCD5);

    // Left and right gable sides
    var sideGeo = new THREE.BoxGeometry(18, H, D);
    var leftMesh = new THREE.Mesh(sideGeo, boxMat);
    leftMesh.position.set(-W / 2 + 9, H / 2, 0);
    leftMesh.castShadow = true; leftMesh.receiveShadow = true;
    leftMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(leftMesh);

    var rightMesh = new THREE.Mesh(sideGeo, boxMat);
    rightMesh.position.set(W / 2 - 9, H / 2, 0);
    rightMesh.castShadow = true; rightMesh.receiveShadow = true;
    rightMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(rightMesh);

    // Top and bottom panels
    var topBotGeo = new THREE.BoxGeometry(W - 36, 18, D);
    var topMesh = new THREE.Mesh(topBotGeo, boxMat);
    topMesh.position.set(0, H - 9, 0);
    topMesh.castShadow = true; topMesh.receiveShadow = true;
    topMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(topMesh);

    var botMesh = new THREE.Mesh(topBotGeo, boxMat);
    botMesh.position.set(0, 9, 0);
    botMesh.castShadow = true; botMesh.receiveShadow = true;
    botMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(botMesh);

    // Back panel (8mm)
    var backGeo = new THREE.BoxGeometry(W - 36, H - 36, 8);
    var backMesh = new THREE.Mesh(backGeo, boxMat);
    backMesh.position.set(0, H / 2, -D / 2 + 4);
    backMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(backMesh);

    // 2 Internal Shelves
    var numShelves = 2;
    var shelfGeo = new THREE.BoxGeometry(W - 36, 18, D - 40);
    for (var shi = 1; shi <= numShelves; shi++) {
      var shelfY = shi * (H / (numShelves + 1));
      var sMesh = new THREE.Mesh(shelfGeo, boxMat);
      sMesh.position.set(0, shelfY, -10);
      sMesh.castShadow = true; sMesh.receiveShadow = true;
      sMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
      fg.add(sMesh);
    }

    // 2. Rolling Shutter Mechanism
    // Top roll canister / header fascia (100mm height)
    var fasciaMat = new THREE.MeshStandardMaterial({
      color: 0x94A3B8,
      metalness: 0.65,
      roughness: 0.35
    });
    var fasciaGeo = new THREE.BoxGeometry(W - 36, 100, 22);
    var fasciaMesh = new THREE.Mesh(fasciaGeo, fasciaMat);
    fasciaMesh.position.set(0, H - 18 - 50, D / 2 - 11);
    fasciaMesh.castShadow = true;
    fasciaMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(fasciaMesh);

    // Top internal tambour roll drum mechanism inside canister
    var drumMat = new THREE.MeshStandardMaterial({ color: 0x64748B, metalness: 0.8, roughness: 0.3 });
    var drumGeo = new THREE.CylinderGeometry(35, 35, W - 44, 24);
    var drumMesh = new THREE.Mesh(drumGeo, drumMat);
    drumMesh.rotation.z = Math.PI / 2;
    drumMesh.position.set(0, H - 68, D / 2 - 45);
    fg.add(drumMesh);

    // Vertical guide channels (side tracks)
    var trackMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.7, roughness: 0.3 });
    var trackGeo = new THREE.BoxGeometry(16, H - 136, 20);
    var leftTrack = new THREE.Mesh(trackGeo, trackMat);
    leftTrack.position.set(-W / 2 + 26, (H - 136) / 2 + 18, D / 2 - 10);
    fg.add(leftTrack);

    var rightTrack = new THREE.Mesh(trackGeo, trackMat);
    rightTrack.position.set(W / 2 - 26, (H - 136) / 2 + 18, D / 2 - 10);
    fg.add(rightTrack);

    // Horizontal Tambour Slats (Satin silver / anthracite anodized aluminum)
    var slatMat = new THREE.MeshStandardMaterial({
      color: 0xCBD5E1,
      metalness: 0.75,
      roughness: 0.28
    });
    var slatH = 28;
    var slatGap = 2;
    var slatSpanH = H - 136;
    var numSlats = Math.floor(slatSpanH / (slatH + slatGap));
    var slatW = W - 52;
    var slatGeo = new THREE.BoxGeometry(slatW, slatH, 12);

    // Roll group wrapping slats and grip bar for interactive open/close slide animation
    var rollGroup = new THREE.Group();
    rollGroup.name = 'RollingShutterSlats_' + furn.id;
    var isOpen = !!(furn.shutterStates && furn.shutterStates[0]);
    var rollTravelY = slatSpanH - 60;
    var slatMeshes = [];

    for (var k = 0; k < numSlats; k++) {
      var slatY = 18 + k * (slatH + slatGap) + slatH / 2;
      var slatMesh = new THREE.Mesh(slatGeo, slatMat);
      slatMesh.position.set(0, slatY, D / 2 - 7);
      slatMesh.castShadow = true; slatMesh.receiveShadow = true;
      slatMesh.userData = {
        isFurniturePart: true,
        isShutter: true,
        isRolling: true,
        baseY: slatY,
        shutterIdx: 0,
        rollGroup: rollGroup,
        parentGroup: fg,
        furnitureId: furn.id
      };
      rollGroup.add(slatMesh);
      slatMeshes.push(slatMesh);
    }

    // Bottom Handle Profile Grip Bar
    var gripMat = new THREE.MeshStandardMaterial({
      color: 0x1E293B,
      metalness: 0.85,
      roughness: 0.22
    });
    var gripGeo = new THREE.BoxGeometry(slatW + 6, 36, 18);
    var gripMesh = new THREE.Mesh(gripGeo, gripMat);
    gripMesh.position.set(0, 36, D / 2 - 6);
    gripMesh.castShadow = true;
    gripMesh.userData = {
      isFurniturePart: true,
      isShutter: true,
      isRolling: true,
      shutterIdx: 0,
      rollGroup: rollGroup,
      parentGroup: fg,
      furnitureId: furn.id
    };
    rollGroup.add(gripMesh);

    // Realistic roll mechanism: slats retract into top canister drum without protruding into the ceiling
    var setRollOpen = function (open) {
      gripMesh.position.y = open ? (H - 145) : 36;
      for (var si = 0; si < slatMeshes.length; si++) {
        var sm = slatMeshes[si];
        var effY = sm.userData.baseY + (open ? rollTravelY : 0);
        if (effY > H - 120) {
          sm.visible = false;
        } else {
          sm.position.y = effY;
          sm.visible = true;
        }
      }
    };
    setRollOpen(isOpen);

    rollGroup.userData = {
      isRollingShutter: true,
      shutterIdx: 0,
      furnitureId: furn.id,
      openY: 0,
      closedY: 0,
      setOpen: setRollOpen
    };
    fg.add(rollGroup);

    // Elevation positioning (mount at 750mm floor elevation default)
    var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '' && parseFloat(furn.elevation) >= 0) ?
      parseFloat(furn.elevation) : 750;
    var posX = (furn.pos && furn.pos.x) || 0;
    var posY = (furn.pos && furn.pos.y) || 0;
    fg.position.set(posX, elev, posY);
    fg.rotation.y = -(furn.rotY || 0);
    fg.visible = true;
    return fg;
  };

  ArchitecturalRenderer.prototype.buildFurnitureMesh = function (furn) {
    if (!furn) return new THREE.Group();
    try {
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
      var hasCustomModel = !!(furn.modelUrl || furn.blobUrl || furn.glbPath);
      var isDecor = !!(furn.isDecor || furn.excludeFromPricing || cat === 'decor' || cat === 'appliance_decor' || furn.decorType || hasCustomModel);
      if (isDecor) {
        return this.buildDecorMesh(furn, fg, dims);
      }
      var isBed = (cat === 'bed' || name.indexOf('bed') !== -1);
      var isOpenBox = !isDecor && (
        name.indexOf('open box') !== -1 || name.indexOf('open storage') !== -1 ||
        (furn.id && /^(ob-|open-box|ctvw-open|ctvw-obs)/i.test(furn.id)) ||
        (furn.code && /^(ob-|open-box)/i.test(furn.code)) ||
        (cat.indexOf('open') !== -1 && cat.indexOf('shutter') === -1) ||
        (furn.unitConfig && (furn.unitConfig.doorType === 'open' || furn.unitConfig.type === 'open'))
      );
      var isElevatedUnit = (furn.elevation !== undefined && parseFloat(furn.elevation) >= 1000) ||
        (furn.pos && parseFloat(furn.pos.z) >= 1000) ||
        (furn.unitConfig && (furn.unitConfig.ctype === 'kwall' || furn.unitConfig.ctype === 'wall')) ||
        (furn.catalogItemId && furn.catalogItemId.indexOf('-1500') !== -1) ||
        (furn.id && String(furn.id).indexOf('-1500') !== -1);
      var isWall = isElevatedUnit || ((typeof window !== 'undefined' && window.OrbixCore && window.OrbixCore.isWallUnit) ?
        window.OrbixCore.isWallUnit(cat, name, furn.code || furn.catalogItemId, furn.costCategory) :
        (cat.indexOf('wall') !== -1 || cat === 'wm-01' || cat === 'k_wall' || cat === 'kitchen_wall' ||
          cat === 'crockery_wall' || cat === 'spice_rack' || cat.indexOf('overhead') !== -1 ||
          cat.indexOf('loft') !== -1 || name.indexOf('wall') !== -1 || name.indexOf('overhead') !== -1 ||
          name.indexOf('spice rack') !== -1 || name.indexOf('loft') !== -1 ||
          /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(name)));
      var isKitchenBase = !isWall && (
        cat === 'kitchen_base' || cat === 'kitchen_fm' || cat === 'kitchen_corner' || cat === 'kitchen_drawers' ||
        cat === 'kitchen_os' ||
        /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(name) ||
        (furn.id && /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(furn.id)) ||
        (furn.catalogItemId && /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(furn.catalogItemId)) ||
        (furn.costCategory && (furn.costCategory.indexOf('FM') !== -1 || furn.costCategory.indexOf('Base') !== -1 || furn.costCategory.indexOf('D2/D3') !== -1 || furn.costCategory.indexOf('Kitchen O/S') !== -1))
      );
      var isKitchen = isKitchenBase || (cat.indexOf('kitchen') !== -1 || cat === 'kitchen_base' || cat === 'kitchen_wall' || cat === 'kitchen_fm' || cat === 'kitchen_corner' || cat === 'kitchen_drawers' || cat === 'kitchen_tall');
      var isBase = !isWall && (
        isKitchenBase ||
        cat === 'kitchen_base' || cat === 'kitchen_fm' || cat === 'kitchen_corner' || cat === 'kitchen_drawers' ||
        cat === 'crockery' || cat === 'vanity' || cat.indexOf('base') !== -1 || cat === 'tv_unit' ||
        (name && name.toLowerCase().indexOf('base') !== -1)
      );

      // Carcass Materials (Resolves finish name, laminate code, or hex + rich wood grains)
      var carcassRaw = (furn.unitConfig && furn.unitConfig.carcass) ||
        (furn.materials && furn.materials.carcass && furn.materials.carcass.finish) ||
        furn.carcassColor ||
        'MDF 6601';
      var carcassIsGloss = String(carcassRaw).toLowerCase().indexOf('gloss') !== -1;
      var carcassMat = ArchitecturalRenderer.resolveLaminateMaterial(carcassRaw, 0xEDEBE4, carcassIsGloss);

      // Door style & type
      var isGLUnit = /(^|\b|_|-|\s)gl(\b|_|-|\s|\d+|$)/i.test(String(name || '') + ' ' + String(furn.code || '') + ' ' + String(furn.id || ''));
      var dstyle = (furn.unitConfig && furn.unitConfig.dstyle) || (isGLUnit ? 'glass' : 'slab');
      if (isGLUnit && (!dstyle || dstyle === 'slab')) dstyle = 'glass';
      var doorType = (furn.unitConfig && (furn.unitConfig.doorType || furn.unitConfig.type)) || 'hinged';

      // Handle Configuration & Material
      var handleType = (furn.unitConfig && furn.unitConfig.handle) || furn.handleType || 'bar';
      var handleFinish = (furn.unitConfig && (furn.unitConfig.hfinish || furn.unitConfig.handleFinish)) || furn.handleFinish || 'black';
      var handleMat = ArchitecturalRenderer.getHandleMaterial(handleFinish);

      // Countertop
      var counterColorName = (furn.unitConfig && furn.unitConfig.counter) || (isKitchen ? 'granite_kashmir_white' : (isBase ? 'granite_kashmir_white' : 'none'));
      var counterMat = ArchitecturalRenderer.getCountertopMaterial(counterColorName, dims);

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
      var counterH = (isBase && counterColorName !== 'none') ? 20 : 0;
      var bodyH;
      if (isBase) {
        // Floor unit: Carcass height is 700mm. Total finished height = 100mm leg + 700mm carcass + 20mm countertop = 820mm
        bodyH = (dims.H >= 800) ? Math.max(100, dims.H - plinthH - counterH) : (dims.H || 700);
        if (bodyH < 100) bodyH = 700;
      } else {
        bodyH = (dims.H <= 350) ? dims.H : Math.max(100, dims.H - plinthH - counterH);
      }
      var topOfCarcass = plinthH + bodyH;
      var innerW = dims.W - 36;
      var innerD = dims.D - 20;

      // Helper: Material for individual shutter s (Prioritizes user's edited finish + rich wood grains)
      function getShutterMaterial(sIdx) {
        var matFin = (furn.unitConfig && furn.unitConfig.shutterCol) ||
          (furn.materials && furn.materials.shutter && furn.materials.shutter.finish) ||
          (furn.shutterMaterials && furn.shutterMaterials[sIdx]) ||
          (furn.shutterColors && furn.shutterColors[sIdx]) ||
          'MDF 7707';

        return ArchitecturalRenderer.resolveLaminateMaterial(matFin, 0x2E3F5C);
      }

      // 1. Architectural Wall Paneling / Back Panel / Ledges / Blank Shutters (zero carcass box)
      var isWallPanel = (cat === 'wall_paneling' || /pnl[-_]?back|ledge|bs-60/i.test(furn.id || '') || /pnl[-_]?back|ledge|bs-60/i.test(furn.catalogItemId || '') || (name && (name.indexOf('back panel') !== -1 || name.indexOf('wall panel') !== -1 || name.indexOf('vertical ledge') !== -1 || name.indexOf('ledge') !== -1 || name.indexOf('blank shutter') !== -1 || /\bbs\b/i.test(name))));
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
        return this.buildOnlyShutterMesh(furn, fg, dims, carcassMat, getShutterMaterial, handleType, handleMat, counterMat, plinthH, counterH, isBase);
      }

      var isLCorner = !!(
        (furn.unitConfig && (furn.unitConfig.geometryType === 'l_shaped_corner' || furn.unitConfig.unitType === 'fbcm' || furn.unitConfig.unitType === 'wbcm' || (furn.unitConfig.corner && furn.unitConfig.corner.enabled))) ||
        furn.catalogItemId === 'fbcm' || furn.id === 'fbcm' || furn.id === 'f_fbcm_1' || furn.catalogItemId === 'fbcm-1500' ||
        (furn.id && /fbcm|wbcm/i.test(furn.id)) ||
        (furn.catalogItemId && /fbcm|wbcm/i.test(furn.catalogItemId)) ||
        (furn.code && /fbcm|wbcm/i.test(furn.code)) ||
        (furn.name && /l[-_ ]*shaped.*corner|\bwbcm\b/i.test(furn.name))
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

      var isRollingShutter = !!(
        (furn.unitConfig && (furn.unitConfig.isRollingShutter || furn.unitConfig.shutterType === 'rolling_shutter' || furn.unitConfig.unitType === 'wfm60-roll')) ||
        (furn.id && /wfm60[-_ ]*roll/i.test(furn.id)) ||
        (furn.catalogItemId && /wfm60[-_ ]*roll/i.test(furn.catalogItemId)) ||
        (furn.code && /wfm60[-_ ]*roll/i.test(furn.code)) ||
        (furn.name && /rolling\s*shutter/i.test(furn.name))
      );
      if (isRollingShutter) {
        return this.buildRollingShutterCabinetMesh(furn, fg, dims, carcassMat, counterMat);
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
        var hbMesh = new THREE.Mesh(hbGeo, carcassMat);
        hbMesh.position.set(0, headboardH / 2, -dims.D / 2 + headboardT / 2);
        hbMesh.castShadow = true; hbMesh.receiveShadow = true;
        hbMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
        fg.add(hbMesh);

        // 2. Bed Base Frame
        var frameD = dims.D - headboardT;
        var frameGeo = new THREE.BoxGeometry(dims.W - 10, bedFrameH, frameD);
        var frameMesh = new THREE.Mesh(frameGeo, carcassMat);

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
        (furn.unitConfig && (furn.unitConfig.unitType === 'fcm-rt' || furn.unitConfig.unitType === 'fcm-lt' || furn.unitConfig.unitType === 'wcm-rt' || furn.unitConfig.unitType === 'wcm-lt')) ||
        (furn.id && /fcm[-_ ]*(rt|lt)/i.test(furn.id)) ||
        (furn.catalogItemId && /fcm[-_ ]*(rt|lt)/i.test(furn.catalogItemId)) ||
        (furn.name && /(fcm[-_ ]*(rt|lt)|wcm[-_ ]*(rt|lt)\s*\(cookscape\))/i.test(furn.name)) ||
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
      var catFM = (furn.category || '').toLowerCase();
      var nameFM = (furn.name || '').toLowerCase();
      var isCrockeryOnlyDoors = (catFM.indexOf('crockery') !== -1 || nameFM.indexOf('crockery') !== -1) &&
        (nameFM.indexOf('only door') !== -1 || (furn.id && furn.id.indexOf('doors-only') !== -1) || (furn.unitConfig && furn.unitConfig.isOnlyShutter));
      var isSpiceRackCabinet = (catFM.indexOf('spice') !== -1 || nameFM.indexOf('spice') !== -1 || (furn.id && /^(sr-|spice)/i.test(furn.id)));
      var isCrockeryOpenBox = (furn.id === 'ctvw-open-box') || (/crockery.*open.*box.*storage(?!\s*2)/i.test(nameFM));
      var explicitlyNoShelves = (furn.unitConfig && furn.unitConfig.shelves === 0) || isCrockeryOnlyDoors || isSpiceRackCabinet;
      if (isCrockeryOpenBox) explicitlyNoShelves = true;
      var isKitchenFMorWM = (catFM.indexOf('kitchen') !== -1 || catFM.indexOf('fm') !== -1 || catFM.indexOf('wall') !== -1 || /(^|\b|_|-)(fm|fcm|fbcm|wm|wcm|wbcm)($|\b|_|-|\d+)/i.test(nameFM) || /(^|\b|_|-)(fm|fcm|fbcm|wm|wcm|wbcm)($|\b|_|-|\d+)/i.test(furn.id || ''));
      var isInternalDrawers = (furn.unitConfig && (furn.unitConfig.internalDrawers || furn.unitConfig.drawersInCenter)) ||
        furn.id === 'wr-drawers' || furn.id === 'wr-1-drawers' ||
        (furn.modelType && furn.modelType.indexOf('wardrobe_modular_drawers') !== -1) ||
        (furn.name && furn.name.toLowerCase().indexOf('wardrobe') !== -1 && furn.name.toLowerCase().indexOf('drawer') !== -1);

      if (!explicitlyNoShelves && (bodyH > 650 || (furn.unitConfig && furn.unitConfig.shelves > 0) || isFcmUnit)) {
        var numShelves = (furn.unitConfig && furn.unitConfig.shelves !== undefined) ?
          parseInt(furn.unitConfig.shelves) :
          (isKitchenFMorWM ? 1 : (bodyH > 1400 ? 3 : 1));
        if (isInternalDrawers) {
          // Wardrobe with internal drawers: place top shelf above hanging rod
          numShelves = 1;
          var topShelfY = plinthH + bodyH - 280;
          var topShelfGeo = new THREE.BoxGeometry(innerW, 18, innerD - 20);
          var topShelfMesh = new THREE.Mesh(topShelfGeo, carcassMat);
          topShelfMesh.position.set(0, topShelfY, -10);
          topShelfMesh.castShadow = true; topShelfMesh.receiveShadow = true;
          topShelfMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
          fg.add(topShelfMesh);
        } else {
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
      }

      // Top Metal Hanging Rod for Wardrobe units
      var hasHangingRod = (furn.unitConfig && furn.unitConfig.hasHangingRod) || isInternalDrawers;
      if (hasHangingRod && bodyH >= 1500) {
        var rodGeo = new THREE.CylinderGeometry(12, 12, innerW - 6, 24);
        var rodMat = new THREE.MeshStandardMaterial({ color: 0xE2E8F0, metalness: 0.95, roughness: 0.18 });
        var rodMesh = new THREE.Mesh(rodGeo, rodMat);
        rodMesh.rotation.z = Math.PI / 2;
        rodMesh.position.set(0, plinthH + bodyH - 140, 0);
        rodMesh.castShadow = true;
        rodMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
        fg.add(rodMesh);

        var flangeMat = new THREE.MeshStandardMaterial({ color: 0x94A3B8, metalness: 0.9, roughness: 0.2 });
        [-1, 1].forEach(function (side) {
          var flGeo = new THREE.CylinderGeometry(20, 20, 8, 24);
          var flMesh = new THREE.Mesh(flGeo, flangeMat);
          flMesh.rotation.z = Math.PI / 2;
          flMesh.position.set(side * (innerW / 2 - 4), plinthH + bodyH - 140, 0);
          flMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
          fg.add(flMesh);
        });
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
        cMesh.name = 'Countertop';
        var topOfCarcass = plinthH + bodyH;
        cMesh.position.set(0, topOfCarcass + counterH / 2, 2.5);
        cMesh.castShadow = true;
        cMesh.receiveShadow = true;
        cMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
        fg.add(cMesh);
      }

      // Built-in Appliances mounted onto Countertop (HOB or Sink)
      var hasHob = !!(furn.unitConfig && (furn.unitConfig.appliance === 'hob' || furn.unitConfig.hasHob));
      var hasSink = !!(furn.unitConfig && (furn.unitConfig.appliance === 'sink' || furn.unitConfig.hasSink));
      var applianceMountY = plinthH + bodyH + (counterH > 0 ? counterH : 0);
      if (hasHob) {
        ArchitecturalRenderer.buildBuiltInHob(fg, dims.W, dims.D, applianceMountY, furn.id);
      } else if (hasSink) {
        ArchitecturalRenderer.buildBuiltInSink(fg, dims.W, dims.D, applianceMountY, furn.id);
      }

      // Realistic Drawers & Hinged Shutters with Interactive Open/Close & Individual Finishes
      var drawersCount = (furn.unitConfig && furn.unitConfig.drawers !== undefined) ? parseInt(furn.unitConfig.drawers) : 0;
      var isFmD2 = /(^|\b|_|-)(fm[-_ ]*d2)($|\b|_|-|\d+)/i.test(String(name || '') + ' ' + String(furn.id || '') + ' ' + String(furn.code || ''));
      var isFmD3 = /(^|\b|_|-)(fm[-_ ]*d3)($|\b|_|-|\d+)/i.test(String(name || '') + ' ' + String(furn.id || '') + ' ' + String(furn.code || ''));
      var isD2orD3 = isFmD2 || isFmD3;
      var numShutters = (furn.unitConfig && furn.unitConfig.shutters !== undefined) ?
        parseInt(furn.unitConfig.shutters) :
        (isOpenBox ? 0 : ((drawersCount > 0 && dims.H < 1000 && !isInternalDrawers) ? 0 : (dims.W > 1200 ? 3 : dims.W > 600 ? 2 : 1)));
      if (isD2orD3) {
        numShutters = 0;
        if (isFmD2 && drawersCount === 0) drawersCount = 2;
        if (isFmD3 && drawersCount === 0) drawersCount = 3;
      }

      var totalDrawersH = 0;
      var drawerH = 0;

      // 7. Drawers Geometry & Sliding Groups
      var drawersOnTop = (furn.unitConfig && furn.unitConfig.drawersOnTop !== undefined) ? !!furn.unitConfig.drawersOnTop : (numShutters > 0);
      var isSideBySide = !isFmD2 && (drawersCount === 2 && (furn.unitConfig && furn.unitConfig.drawersSideBySide === true) && !isInternalDrawers);

      var isInternalSideBySide = isInternalDrawers && (drawersCount >= 2);

      if (drawersCount > 0) {
        if (isInternalDrawers) {
          // Internal drawers placed inside wardrobe in vertical center:
          drawerH = 180;
          totalDrawersH = isInternalSideBySide ? (drawerH + 6) : (drawersCount * (drawerH + 6));
          var drawerCenterY = plinthH + bodyH / 2;
          var drawerBaseY = drawerCenterY - (totalDrawersH / 2);

          // Divider shelves above and below internal drawers
          var dShelfTop = new THREE.Mesh(new THREE.BoxGeometry(innerW, 18, innerD - 15), carcassMat);
          dShelfTop.position.set(0, drawerBaseY + totalDrawersH + 9, -10);
          dShelfTop.castShadow = true; dShelfTop.receiveShadow = true;
          dShelfTop.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
          fg.add(dShelfTop);

          var dShelfBot = new THREE.Mesh(new THREE.BoxGeometry(innerW, 18, innerD - 15), carcassMat);
          dShelfBot.position.set(0, drawerBaseY - 9, -10);
          dShelfBot.castShadow = true; dShelfBot.receiveShadow = true;
          dShelfBot.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
          fg.add(dShelfBot);

          // Center vertical partition panel between side-by-side internal drawers
          if (isInternalSideBySide) {
            var dPart = new THREE.Mesh(new THREE.BoxGeometry(18, drawerH + 6, innerD - 15), carcassMat);
            dPart.position.set(0, drawerCenterY, -10);
            dPart.castShadow = true; dPart.receiveShadow = true;
            dPart.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
            fg.add(dPart);
          }
        } else if (numShutters === 0) {
          // Pure drawers unit (e.g. bedside unit, 3-pot drawer kitchen base)
          drawerH = Math.max(120, Math.floor((bodyH - (drawersCount + 1) * 3) / drawersCount));
          totalDrawersH = bodyH;
          var drawerBaseY = plinthH + 3;
        } else if (isSideBySide) {
          // 2 side-by-side drawers on top!
          drawerH = Math.min(220, Math.max(140, Math.floor(bodyH * 0.35)));
          totalDrawersH = drawerH;
          var drawerBaseY = drawersOnTop ? (plinthH + Math.max(150, bodyH - totalDrawersH - 6) + 6) : (plinthH + 3);
        } else {
          // Stacked drawers
          drawerH = Math.min(220, Math.max(140, Math.floor((bodyH * 0.38) / drawersCount)));
          totalDrawersH = drawersCount * (drawerH + 3);
          var shutterH = Math.max(150, bodyH - totalDrawersH - 6);
          var drawerBaseY = drawersOnTop ? (plinthH + (numShutters > 0 ? (shutterH + 6) : 3)) : (plinthH + 3);
        }

        for (var d = 0; d < drawersCount; d++) {
          var isSBS = isSideBySide || isInternalSideBySide;
          var dY = isSBS ? (drawerBaseY + drawerH / 2) : (drawerBaseY + d * (drawerH + 3) + drawerH / 2);
          var drawerW = isInternalSideBySide ? Math.floor((innerW - 36) / 2) : (isSideBySide ? Math.floor((dims.W - 9) / 2) : (dims.W - 6));
          var drawerBoxW = isInternalSideBySide ? (drawerW - 16) : (isSideBySide ? (drawerW - 16) : (innerW - 20));
          var drawerCenterX = isInternalSideBySide ? (d === 0 ? (-innerW / 4 - 3) : (innerW / 4 + 3)) : (isSideBySide ? (d === 0 ? (-dims.W / 4) : (dims.W / 4)) : 0);
          var faciaZ = isInternalDrawers ? (dims.D / 2 - 28) : (dims.D / 2 - 9);
          var handleZ = isInternalDrawers ? (dims.D / 2 - 18) : (dims.D / 2);

          var isDOpen = !!(furn.drawerStates && furn.drawerStates[d]);
          var drawerGroup = new THREE.Group();
          drawerGroup.name = 'DrawerSlide_' + d;
          drawerGroup.position.set(drawerCenterX, dY, isDOpen ? 350 : 0);
          drawerGroup.userData = { isDrawerGroup: true, drawerIdx: d, furnitureId: furn.id, isOpen: isDOpen };

          // Drawer Front Facia
          var faciaGeo = new THREE.BoxGeometry(drawerW, drawerH, 18);
          var faciaMat = getShutterMaterial(d % Math.max(1, numShutters));
          var faciaMesh = new THREE.Mesh(faciaGeo, faciaMat);
          faciaMesh.position.set(0, 0, faciaZ);
          faciaMesh.castShadow = true; faciaMesh.receiveShadow = true;
          faciaMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
          drawerGroup.add(faciaMesh);

          // Drawer Pull Handle (Horizontal)
          var dhGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, false, Math.min(180, (drawerW - 30) * 0.45));
          if (dhGroup) {
            dhGroup.position.set(0, 0, handleZ);
            dhGroup.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
            dhGroup.traverse(function (c) {
              if (c.isMesh) {
                c.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
              }
            });
            drawerGroup.add(dhGroup);
          }

          // Drawer Interior Box
          var dbGeo = new THREE.BoxGeometry(drawerBoxW, 12, innerD - 30);
          var dbMesh = new THREE.Mesh(dbGeo, carcassMat);
          dbMesh.position.set(0, -drawerH / 2 + 6, -15);
          dbMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
          drawerGroup.add(dbMesh);

          var dlGeo = new THREE.BoxGeometry(12, drawerH - 24, innerD - 30);
          var dlMesh = new THREE.Mesh(dlGeo, carcassMat);
          dlMesh.position.set(-drawerBoxW / 2 + 6, 0, -15);
          dlMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
          drawerGroup.add(dlMesh);

          var drGeo = new THREE.BoxGeometry(12, drawerH - 24, innerD - 30);
          var drMesh = new THREE.Mesh(drGeo, carcassMat);
          drMesh.position.set(drawerBoxW / 2 - 6, 0, -15);
          drMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
          drawerGroup.add(drMesh);

          var dbkGeo = new THREE.BoxGeometry(drawerBoxW - 24, drawerH - 24, 12);
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
        (furn.unitConfig && (furn.unitConfig.unitType === 'fcm-rt' || furn.unitConfig.unitType === 'wcm-rt')) ||
        (furn.id && /fcm[-_ ]*rt/i.test(furn.id)) ||
        (furn.catalogItemId && /fcm[-_ ]*rt/i.test(furn.catalogItemId)) ||
        (furn.name && /(fcm[-_ ]*rt|wcm[-_ ]*rt\s*\(cookscape\))/i.test(furn.name)) ||
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

        var shutterBaseY = isInternalDrawers ? (plinthH + 3) : ((drawersOnTop && numShutters > 0) ? (plinthH + 3) : (plinthH + totalDrawersH + 3));

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

            var slideDoor = ArchitecturalRenderer.createShutterDoorGroup(dstyle, slideW, slideH, getShutterMaterial(sl), carcassMat, furn.unitConfig);
            slideDoor.traverse(function (c) {
              c.userData = { isFurniturePart: true, isShutter: true, isSliding: true, shutterIdx: sl, shutterGroup: slideGroup, parentGroup: fg, furnitureId: furn.id };
            });
            slideGroup.add(slideDoor);

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
            (furn.unitConfig && (furn.unitConfig.unitType === 'fcm-lt' || furn.unitConfig.unitType === 'wcm-lt')) ||
            (furn.id && /fcm[-_ ]*lt/i.test(furn.id)) ||
            (furn.catalogItemId && /fcm[-_ ]*lt/i.test(furn.catalogItemId)) ||
            (furn.name && /(fcm[-_ ]*lt|wcm[-_ ]*lt\s*\(cookscape\))/i.test(furn.name)) ||
            furn.id === 'fcm-lt' || furn.catalogItemId === 'fcm-lt' ||
            furn.id === 'fm-lt-01' || furn.catalogItemId === 'fm-lt-01'
          );
          var fixW = (furn.unitConfig && furn.unitConfig.fixedPanel && furn.unitConfig.fixedPanel.width) || (dims.W / 2);
          var movW = dims.W - fixW - 6;
          var shH = Math.max(150, bodyH - (isInternalDrawers ? 0 : totalDrawersH) - 6);
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
            var movDoor = ArchitecturalRenderer.createShutterDoorGroup(dstyle, movW, shH, getShutterMaterial(0), carcassMat, furn.unitConfig);
            movDoor.position.set(localX, 0, 0);
            movDoor.traverse(function (c) {
              c.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            });
            hingeGroup.add(movDoor);

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
            var movDoor = ArchitecturalRenderer.createShutterDoorGroup(dstyle, movW, shH, getShutterMaterial(1), carcassMat, furn.unitConfig);
            movDoor.position.set(localX, 0, 0);
            movDoor.traverse(function (c) {
              c.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: 0, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            });
            hingeGroup.add(movDoor);

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
          // Standard Hinged Shutters (Full-height outer doors when drawers are internal!)
          var shW = (dims.W - (numShutters + 1) * 3) / numShutters;
          var shH = Math.max(150, bodyH - (isInternalDrawers ? 0 : totalDrawersH) - 6);
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
            var hingedDoor = ArchitecturalRenderer.createShutterDoorGroup(dstyle, shW, shH, getShutterMaterial(s), carcassMat, furn.unitConfig);
            hingedDoor.position.set(localX, 0, 0);
            hingedDoor.traverse(function (c) {
              c.userData = { isFurniturePart: true, isShutter: true, isSliding: false, shutterIdx: s, hingeGroup: hingeGroup, parentGroup: fg, furnitureId: furn.id };
            });
            hingeGroup.add(hingedDoor);

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
      var isLoftUnit = (cat.indexOf('loft') !== -1 || name.indexOf('loft') !== -1 || (furn.id && String(furn.id).indexOf('loft') !== -1) || (furn.code && String(furn.code).indexOf('loft') !== -1));
      var isOpenBoxUnit = isOpenBox || (name.indexOf('open box') !== -1 || (furn.id && /^(ob-|open-box|ctvw-open|ctvw-obs)/i.test(furn.id)));
      var isSpiceUnit = !isOpenBoxUnit && (cat.indexOf('spice') !== -1 || name.indexOf('spice') !== -1 || (furn.id && String(furn.id).indexOf('spice') !== -1) || (furn.id && String(furn.id).indexOf('sr-') === 0));
      var defElevUnit = isLoftUnit ? 2100 : (isOpenBoxUnit ? 1500 : (isSpiceUnit ? 1350 : (isWall ? 1500 : 0)));
      var isElevatedTypeUnit = isWall || isLoftUnit || isSpiceUnit || isOpenBoxUnit;
      var elev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== '' && (!isElevatedTypeUnit || parseFloat(furn.elevation) > 0)) ?
        parseFloat(furn.elevation) :
        ((furn.pos && furn.pos.z !== undefined && furn.pos.z !== null && (!isElevatedTypeUnit || parseFloat(furn.pos.z) > 0)) ?
          parseFloat(furn.pos.z) :
          defElevUnit);

      // Photorealistic Contact Shadow Grounding (ambient occlusion under floor units)
      if (elev <= 50) {
        var shadowPlane = ArchitecturalRenderer.createContactShadowPlane(dims.W, dims.D);
        if (shadowPlane) {
          shadowPlane.position.set(0, 1.15 - elev, 0);
          fg.add(shadowPlane);
        }
      }

      // Photorealistic Under-Cabinet LED Task Lighting for kitchen wall units & overhead storage
      if (isWall || isKitchen || name.indexOf('fcm') !== -1 || name.indexOf('fm') !== -1) {
        var ledStrip = ArchitecturalRenderer.createUnderCabinetLight(dims.W, dims.D);
        if (ledStrip) {
          ledStrip.position.set(0, 2, 0);
          fg.add(ledStrip);
        }
      }

      var posX = (furn.pos && furn.pos.x) || 0;
      var posY = (furn.pos && furn.pos.y) || 0;
      fg.position.set(posX, elev, posY);
      fg.rotation.y = -(furn.rotY || 0);

      // Placed modular unit is always visible inside 3D architectural room
      fg.visible = true;

      return fg;
    } catch (err) {
      console.error('[Orbix 3D] Error building furniture mesh for', (furn && (furn.name || furn.id)), err);
      var fallback = new THREE.Group();
      fallback.name = 'Furniture_' + ((furn && furn.id) || 'fallback');
      fallback.userData = { isFurniture: true, isFurnitureGroup: true, furnitureId: furn && furn.id, furniture: furn };
      var dims = (furn && furn.dimensions) || { W: 600, H: 800, D: 600 };
      var fW = parseFloat(dims.W) || 600, fH = parseFloat(dims.H) || 800, fD = parseFloat(dims.D) || 600;
      var boxMesh = new THREE.Mesh(
        new THREE.BoxGeometry(fW, fH, fD),
        new THREE.MeshStandardMaterial({ color: 0x94A3B8, roughness: 0.5 })
      );
      boxMesh.position.set(0, fH / 2, 0);
      boxMesh.castShadow = true;
      boxMesh.receiveShadow = true;
      fallback.add(boxMesh);
      var posX = (furn && furn.pos && furn.pos.x) || 0;
      var posY = (furn && furn.pos && furn.pos.y) || 0;
      var elev = (furn && furn.elevation !== undefined) ? parseFloat(furn.elevation) : 0;
      fallback.position.set(posX, elev, posY);
      fallback.rotation.y = -(furn && furn.rotY || 0);
      fallback.visible = true;
      return fallback;
    }
  };

  ArchitecturalRenderer.prototype.disposeGroup = function (group) {
    if (!group) return;
    group.traverse(function (obj) {
      if (obj.userData && obj.userData.isGltfMesh) return;
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
     Fast Incremental 3D Unit & Decor Placement / Update / Removal
     Eliminates full scene teardowns and rebuilds (< 1ms instant single-frame execution)
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.addOrUpdateFurnitureMesh = function (furn) {
    if (!this.scene || typeof THREE === 'undefined') return null;
    if (!this.group || !this.scene.getObjectByName('OrbixHome3D')) {
      return this.buildHome(this.currentProject || (window.OrbixUI && window.OrbixUI.project));
    }
    if (!furn || !furn.id) return null;

    // 1. Remove existing mesh for this furniture unit if present
    for (var i = this.group.children.length - 1; i >= 0; i--) {
      var c = this.group.children[i];
      if (c && c.userData && c.userData.isFurnitureGroup && c.userData.furnitureId === furn.id) {
        this.group.remove(c);
        if (typeof this.disposeGroup === 'function') {
          this.disposeGroup(c);
        }
        break;
      }
    }

    // 2. Build only this single unit mesh
    var newMesh = this.buildFurnitureMesh(furn);
    if (!newMesh) return null;

    // 3. Fast wall association
    var walls = (this.currentPlan && this.currentPlan.walls) || [];
    var bestWall = null, bestDist = 999999;
    if (furn.wallId) {
      var matchedWall = walls.find(function (wItem) { return wItem.id === furn.wallId; });
      if (matchedWall) {
        var matchedIdx = walls.indexOf(matchedWall);
        bestWall = { id: matchedWall.id, index: matchedIdx, number: matchedIdx + 1 };
      }
    }
    if (!bestWall && furn.pos && walls.length > 0) {
      for (var wi = 0; wi < walls.length; wi++) {
        var wObj = walls[wi];
        if (!wObj || !wObj.start || !wObj.end) continue;
        var p1 = wObj.start, p2 = wObj.end;
        var dx = p2.x - p1.x, dy = p2.y - p1.y;
        var lenSq = dx * dx + dy * dy;
        if (lenSq < 1) continue;
        var t = Math.max(0, Math.min(1, ((furn.pos.x - p1.x) * dx + (furn.pos.y - p1.y) * dy) / lenSq));
        var projX = p1.x + t * dx, projY = p1.y + t * dy;
        var dist = Math.hypot(furn.pos.x - projX, furn.pos.y - projY);
        if (dist < bestDist) {
          bestDist = dist;
          bestWall = { id: wObj.id, index: wi, number: wi + 1, dist: dist };
        }
      }
    }
    if (bestWall && (furn.wallId || bestDist < 1200)) {
      newMesh.userData.wallId = bestWall.id;
      newMesh.userData.wallIndex = bestWall.index;
      newMesh.userData.wallNumber = bestWall.number;
    }

    this.group.add(newMesh);

    // 4. Trigger render update
    if (window.__cc && window.__cc.gl) {
      if (window.__cc.gl.apply) window.__cc.gl.apply();
      if (window.__cc.gl.settle) window.__cc.gl.settle();
    }
    return newMesh;
  };

  ArchitecturalRenderer.prototype.removeFurnitureMesh = function (furnId) {
    if (!this.group || !furnId) return;
    for (var i = this.group.children.length - 1; i >= 0; i--) {
      var c = this.group.children[i];
      if (c && c.userData && c.userData.isFurnitureGroup && c.userData.furnitureId === furnId) {
        this.group.remove(c);
        if (typeof this.disposeGroup === 'function') {
          this.disposeGroup(c);
        }
        break;
      }
    }
    if (window.__cc && window.__cc.gl) {
      if (window.__cc.gl.apply) window.__cc.gl.apply();
      if (window.__cc.gl.settle) window.__cc.gl.settle();
    }
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

  /* ─────────────────────────────────────────────────────────────────────────────
     BLENDER CYCLES PHOTOREALISTIC RAYTRACING SCENE EXPORTER (.CYCLES.JSON)
     Serializes complete room architecture, modular cabinetry, PBR materials,
     window locations, camera, and lighting parameters (Daylight %, Interior Fill W,
     Exposure EV) for raytracing in Blender Cycles.
     ───────────────────────────────────────────────────────────────────────────── */
  ArchitecturalRenderer.prototype.exportToCyclesJson = function (project, scene, opts) {
    opts = opts || {};
    var title = (project && project.meta && project.meta.title) || 'Orbix-Kitchen';
    var safeTitle = title.replace(/[^a-zA-Z0-9_\-]/g, '_');

    var homeObj = null;
    if (scene && typeof scene.getObjectByName === 'function') {
      homeObj = scene.getObjectByName('OrbixHome3D');
    }
    if (!homeObj && project && typeof THREE !== 'undefined') {
      homeObj = this.buildHome(project);
    }

    var meshes = [];
    function harvestMeshes(node) {
      if (!node) return;
      if (typeof node.updateMatrixWorld === 'function') node.updateMatrixWorld(true);
      node.traverse(function (obj) {
        if (obj.isMesh && obj.visible !== false && obj.geometry) {
          var geoParams = obj.geometry.parameters;
          if (geoParams && (geoParams.width > 50000 || geoParams.height > 50000)) return;
          if (obj.name === 'infinite_floor' || obj.name === 'floor_grass') return;
          meshes.push(obj);
        }
      });
    }

    if (homeObj) harvestMeshes(homeObj);

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
      if (!mat) return;

      var matKey = mat.uuid || ('mat_' + matCounter++);
      if (!materials[matKey]) {
        var baseColor = [0.8, 0.8, 0.8];
        if (mat.color && typeof mat.color.r === 'number') {
          baseColor = [
            parseFloat(mat.color.r.toFixed(3)),
            parseFloat(mat.color.g.toFixed(3)),
            parseFloat(mat.color.b.toFixed(3))
          ];
        }

        var roughness = (typeof mat.roughness === 'number') ? parseFloat(mat.roughness.toFixed(3)) : 0.45;
        var metallic = (typeof mat.metalness === 'number') ? parseFloat(mat.metalness.toFixed(3)) : 0.0;
        var transmission = (typeof mat.transmission === 'number') ? parseFloat(mat.transmission.toFixed(3)) : 0.0;
        var ior = (typeof mat.ior === 'number') ? parseFloat(mat.ior.toFixed(3)) : 1.45;
        var clearcoat = (typeof mat.clearcoat === 'number') ? parseFloat(mat.clearcoat.toFixed(3)) : 0.0;

        materials[matKey] = {
          name: mat.name || ('Material_' + Object.keys(materials).length),
          baseColor: baseColor,
          roughness: roughness,
          metallic: metallic,
          transmission: transmission,
          ior: ior,
          clearcoat: clearcoat,
          opacity: (typeof mat.opacity === 'number') ? mat.opacity : 1.0
        };
      }
      mesh.userData.cyclesMatId = matKey;
    });

    // Process Objects & Geometry
    var objects = [];
    var totalTriangles = 0;

    meshes.forEach(function (mesh, mIdx) {
      var geo = mesh.geometry;
      var posAttr = geo.getAttribute ? geo.getAttribute('position') : null;
      if (!posAttr) return;

      var indexAttr = geo.getIndex ? geo.getIndex() : null;
      var vertices = [];
      var faces = [];

      var v = new THREE.Vector3();
      for (var vi = 0; vi < posAttr.count; vi++) {
        v.fromBufferAttribute(posAttr, vi);
        v.applyMatrix4(mesh.matrixWorld);
        vertices.push([
          parseFloat((v.x / 1000).toFixed(4)),
          parseFloat((-v.z / 1000).toFixed(4)),
          parseFloat((v.y / 1000).toFixed(4))
        ]);
      }

      if (indexAttr) {
        for (var fi = 0; fi < indexAttr.count; fi += 3) {
          faces.push([indexAttr.getX(fi), indexAttr.getX(fi + 1), indexAttr.getX(fi + 2)]);
          totalTriangles++;
        }
      } else {
        for (var vi2 = 0; vi2 < posAttr.count; vi2 += 3) {
          faces.push([vi2, vi2 + 1, vi2 + 2]);
          totalTriangles++;
        }
      }

      objects.push({
        name: (mesh.name || ('Object_' + (mIdx + 1))),
        role: mesh.userData.role || '',
        material: mesh.userData.cyclesMatId,
        vertices: vertices,
        faces: faces
      });
    });

    // Calculate scene bounding box across harvested geometry
    var bboxMin = { x: Infinity, y: Infinity, z: Infinity };
    var bboxMax = { x: -Infinity, y: -Infinity, z: -Infinity };
    var hasValidGeo = false;

    meshes.forEach(function (mesh) {
      if (!mesh.geometry) return;
      if (!mesh.geometry.boundingBox) {
        try { mesh.geometry.computeBoundingBox(); } catch (_) {}
      }
      var b = mesh.geometry.boundingBox;
      if (!b) return;
      var vMin = b.min.clone().applyMatrix4(mesh.matrixWorld);
      var vMax = b.max.clone().applyMatrix4(mesh.matrixWorld);
      bboxMin.x = Math.min(bboxMin.x, vMin.x, vMax.x);
      bboxMin.y = Math.min(bboxMin.y, vMin.y, vMax.y);
      bboxMin.z = Math.min(bboxMin.z, vMin.z, vMax.z);
      bboxMax.x = Math.max(bboxMax.x, vMin.x, vMax.x);
      bboxMax.y = Math.max(bboxMax.y, vMin.y, vMax.y);
      bboxMax.z = Math.max(bboxMax.z, vMin.z, vMax.z);
      hasValidGeo = true;
    });

    var geoCenter = hasValidGeo
      ? { x: (bboxMin.x + bboxMax.x) / 2, y: (bboxMin.y + bboxMax.y) / 2, z: (bboxMin.z + bboxMax.z) / 2 }
      : { x: 0, y: 1200, z: 0 };
    var geoSize = hasValidGeo
      ? { x: bboxMax.x - bboxMin.x, y: bboxMax.y - bboxMin.y, z: bboxMax.z - bboxMin.z }
      : { x: 4000, y: 2400, z: 4000 };
    var maxDim = Math.max(geoSize.x, geoSize.y, geoSize.z, 2200);

    // Camera parameters auto-centered on project geometry
    var camData = {
      position: [
        parseFloat(((geoCenter.x + Math.sin(0.6) * maxDim * 1.4) / 1000).toFixed(4)),
        parseFloat(((-geoCenter.z - Math.cos(0.6) * maxDim * 1.4) / 1000).toFixed(4)),
        parseFloat(((geoCenter.y + maxDim * 0.5) / 1000).toFixed(4))
      ],
      target: [
        parseFloat((geoCenter.x / 1000).toFixed(4)),
        parseFloat((-geoCenter.z / 1000).toFixed(4)),
        parseFloat((geoCenter.y / 1000).toFixed(4))
      ],
      fov: 50
    };
    var actualCam = (window.GL && typeof window.GL.getCamera === 'function') ? window.GL.getCamera() : ((window.__cc && window.__cc.gl && typeof window.__cc.gl.getCamera === 'function') ? window.__cc.gl.getCamera() : null);
    var tgt = (window.GL && window.GL.getTarget && window.GL.getTarget()) ? window.GL.getTarget() : geoCenter;

    if (actualCam && actualCam.position) {
      // If user camera target is reasonably near the geometry, use actual user vantage
      var distToCenter = Math.hypot(tgt.x - geoCenter.x, tgt.z - geoCenter.z);
      var effectiveTgt = (distToCenter < maxDim * 1.5) ? tgt : geoCenter;

      camData.position = [
        parseFloat((actualCam.position.x / 1000).toFixed(4)),
        parseFloat((-actualCam.position.z / 1000).toFixed(4)),
        parseFloat((actualCam.position.y / 1000).toFixed(4))
      ];
      camData.target = [
        parseFloat((effectiveTgt.x / 1000).toFixed(4)),
        parseFloat((-effectiveTgt.z / 1000).toFixed(4)),
        parseFloat((effectiveTgt.y / 1000).toFixed(4))
      ];
      camData.fov = actualCam.fov || 50;
    } else if (window.GL && typeof window.GL.getCam === 'function') {
      var gc = window.GL.getCam();
      var dist = (window.GL.getDist ? window.GL.getDist() : 3500) / Math.max(0.18, 1 + (gc.zoom || 0));
      var yawRad = (gc.yaw || 0) * Math.PI / 180;
      var pitchRad = -(gc.pitch || 0) * Math.PI / 180;

      var cx = geoCenter.x + Math.sin(yawRad) * Math.cos(pitchRad) * dist;
      var cy = geoCenter.y + Math.sin(pitchRad) * dist;
      var cz = geoCenter.z + Math.cos(yawRad) * Math.cos(pitchRad) * dist;

      camData.position = [
        parseFloat((cx / 1000).toFixed(4)),
        parseFloat((-cz / 1000).toFixed(4)),
        parseFloat((cy / 1000).toFixed(4))
      ];
      camData.target = [
        parseFloat((geoCenter.x / 1000).toFixed(4)),
        parseFloat((-geoCenter.z / 1000).toFixed(4)),
        parseFloat((geoCenter.y / 1000).toFixed(4))
      ];
      if (opts.camera && opts.camera.fov) camData.fov = opts.camera.fov;
    }

    // Windows
    var windows = [];
    var pOpenings = (project && project.plan && project.plan.openings) || [];
    var pWalls = (project && project.plan && project.plan.walls) || [];

    pOpenings.forEach(function (op) {
      if (op.type === 'window') {
        var w = pWalls.find(function (wObj) { return wObj.id === op.wallId; });
        if (w) {
          var dx = w.end.x - w.start.x, dy = w.end.y - w.start.y;
          var wLen = Math.hypot(dx, dy) || 1;
          var ux = dx / wLen, uy = dy / wLen;
          var nx = -uy, ny = ux;
          var off = (typeof op.offset === 'number') ? op.offset : (wLen / 2);
          var wx = w.start.x + ux * off;
          var wy = w.start.y + uy * off;
          var sillH = (typeof op.sillHeight === 'number') ? op.sillHeight : 900;
          var winH = op.height || 1200;
          var wz = sillH + winH / 2;

          windows.push({
            pos: [
              parseFloat((wx / 1000).toFixed(4)),
              parseFloat((-wy / 1000).toFixed(4)),
              parseFloat((wz / 1000).toFixed(4))
            ],
            width: parseFloat(((op.width || 1200) / 1000).toFixed(3)),
            height: parseFloat((winH / 1000).toFixed(3)),
            normal: [parseFloat(nx.toFixed(3)), parseFloat((-ny).toFixed(3)), 0]
          });
        }
      }
    });

    var cyclesExportData = {
      version: '1.0',
      generator: 'Orbix Studio Blender Cycles Exporter',
      timestamp: new Date().toISOString(),
      project: {
        title: title
      },
      renderSettings: {
        resolution: opts.resolution || [3840, 2160],
        samples: opts.samples || 128,
        denoiser: 'OPENIMAGEDENOISE',
        engine: 'CYCLES'
      },
      lighting: {
        daylightPercent: (opts.daylightPercent !== undefined ? opts.daylightPercent : 20),
        interiorFillWatts: (opts.interiorFillWatts !== undefined ? opts.interiorFillWatts : 10),
        exposureEV: (opts.exposureEV !== undefined ? opts.exposureEV : 0.0)
      },
      camera: camData,
      windows: windows,
      materials: materials,
      objects: objects
    };

    var jsonStr = JSON.stringify(cyclesExportData, null, 2);

    return {
      cyclesJson: jsonStr,
      filename: safeTitle + '.cycles.json',
      stats: {
        title: title,
        walls: pWalls.length,
        openings: pOpenings.length,
        furniture: (project && project.plan && project.plan.furniture ? project.plan.furniture.length : 0),
        meshCount: objects.length,
        triangleCount: totalTriangles,
        daylightPercent: cyclesExportData.lighting.daylightPercent,
        interiorFillWatts: cyclesExportData.lighting.interiorFillWatts,
        exposureEV: cyclesExportData.lighting.exposureEV
      }
    };
  };

  ArchitecturalRenderer.exportCycles = function (project, scene, opts) {
    var renderer = new ArchitecturalRenderer(scene);
    return renderer.exportToCyclesJson(project, scene, opts);
  };

  return ArchitecturalRenderer;
});
