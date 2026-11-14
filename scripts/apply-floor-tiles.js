const fs = require('fs');
const path = require('path');

function replaceExact(filePath, searchStr, replaceStr) {
  let content = fs.readFileSync(filePath, 'utf8');
  const isCRLF = content.includes('\r\n');
  const normContent = content.replace(/\r\n/g, '\n');
  const normSearch = searchStr.replace(/\r\n/g, '\n');
  const normReplace = replaceStr.replace(/\r\n/g, '\n');

  if (normContent.includes(normReplace)) {
    console.log(`- Already updated ${filePath}`);
    return;
  }
  if (!normContent.includes(normSearch)) {
    throw new Error(`Failed to find target string in ${filePath}:\n${normSearch.substring(0, 120)}...`);
  }
  const updatedNorm = normContent.replace(normSearch, normReplace);
  const finalContent = isCRLF ? updatedNorm.replace(/\n/g, '\r\n') : updatedNorm;
  fs.writeFileSync(filePath, finalContent, 'utf8');
  console.log(`✓ Updated ${filePath}`);
}

// 1. orbix-3d.js
console.log('Updating orbix-3d.js...');
const search3d_1 = `  // Procedural Canvas Floor Texture Generator (White Tile, Square Tile, Grey Tile, Wooden)
  ArchitecturalRenderer.createFloorTexture = function (type) {
    if (typeof document === 'undefined') return null;
    var canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    type = type || 'white_tile';

    if (type === 'white_tile') {`;

const replace3d_1 = `  ArchitecturalRenderer._floorTextures = ArchitecturalRenderer._floorTextures || {};
  ArchitecturalRenderer._floorMaterials = ArchitecturalRenderer._floorMaterials || {};

  // Floor Texture Generator: supports 'tile_1', 'tile_2' (User uploads via ORBIX_FLOOR_TEXTURES), 'white_tile', 'square_tile', 'grey_tile', 'wooden'
  ArchitecturalRenderer.createFloorTexture = function (type) {
    type = type || 'white_tile';
    if (ArchitecturalRenderer._floorTextures[type]) return ArchitecturalRenderer._floorTextures[type];

    // Check if texture is in ORBIX_FLOOR_TEXTURES (base64 image from user uploads)
    var b64 = null;
    if (typeof window !== 'undefined' && window.ORBIX_FLOOR_TEXTURES) {
      b64 = window.ORBIX_FLOOR_TEXTURES[type];
      if (!b64 && (type === 'tile_1' || type === 'designer_tile_1' || type === 'custom_tile_1')) {
        b64 = window.ORBIX_FLOOR_TEXTURES.tile_1;
      } else if (!b64 && (type === 'tile_2' || type === 'designer_tile_2' || type === 'custom_tile_2')) {
        b64 = window.ORBIX_FLOOR_TEXTURES.tile_2;
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
    } else if (type === 'white_tile') {`;

replaceExact('orbix-3d.js', search3d_1, replace3d_1);

// orbix-3d.js createFloorTexture end (cache CanvasTexture)
const search3d_1b = `    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.encoding = THREE.sRGBEncoding;
    return tex;`;

const replace3d_1b = `    var tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    tex.encoding = THREE.sRGBEncoding;
    ArchitecturalRenderer._floorTextures[type] = tex;
    return tex;`;

replaceExact('orbix-3d.js', search3d_1b, replace3d_1b);

// orbix-3d.js createFloorMaterial and getFloorTileColor
const search3d_2 = `    type = type || this.selectedFloorType || 'white_tile';
    var tex = ArchitecturalRenderer.createFloorTexture(type);
    var isWood = (type === 'wooden');
    var isWhite = (type === 'white_tile');

    // Natural architectural matte finish — eliminates glossy mirror reflections and glare
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: isWood ? 0.78 : (isWhite ? 0.82 : 0.85),
      metalness: 0.0,
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
    return 0xEDECEF;                             // White Calacatta marble tile (default)
  };`;

const replace3d_2 = `    type = type || this.selectedFloorType || 'white_tile';
    var tex = ArchitecturalRenderer.createFloorTexture(type);
    var isWood = (type === 'wooden');
    var isWhite = (type === 'white_tile');
    var isCustomTile = (type === 'tile_1' || type === 'designer_tile_1' || type === 'custom_tile_1' ||
                        type === 'tile_2' || type === 'designer_tile_2' || type === 'custom_tile_2');

    // Natural architectural matte finish — eliminates glossy mirror reflections and glare
    return new THREE.MeshStandardMaterial({
      map: tex,
      roughness: isWood ? 0.78 : (isCustomTile ? 0.76 : (isWhite ? 0.82 : 0.85)),
      metalness: 0.0,
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
    if (type === 'tile_1' || type === 'designer_tile_1' || type === 'custom_tile_1') return 0xE8DFD5; // Warm Crema Marfil
    if (type === 'tile_2' || type === 'designer_tile_2' || type === 'custom_tile_2') return 0xBFAEA0; // Warm Mocha Breccia
    return 0xEDECEF;                             // White Calacatta marble tile (default)
  };`;

replaceExact('orbix-3d.js', search3d_2, replace3d_2);

// orbix-3d.js buildRoomFloor finishType mapping
const search3d_3 = `    var finishType = this.selectedFloorType || 'white_tile';
    if (room.floorFinish) {
      if (room.floorFinish === 'wood') finishType = 'wooden';
      else if (room.floorFinish === 'marble') finishType = 'white_tile';
      else if (room.floorFinish === 'tile') finishType = 'square_tile';
      else if (room.floorFinish === 'concrete') finishType = 'grey_tile';
      else finishType = room.floorFinish;
    } else if (room.type === 'bedroom' && this.selectedFloorType === 'white_tile') {
      finishType = 'wooden';
    }`;

const replace3d_3 = `    var finishType = this.selectedFloorType || 'white_tile';
    if (room.floorFinish) {
      if (room.floorFinish === 'wood') finishType = 'wooden';
      else if (room.floorFinish === 'marble') finishType = 'white_tile';
      else if (room.floorFinish === 'tile') finishType = 'square_tile';
      else if (room.floorFinish === 'concrete') finishType = 'grey_tile';
      else if (room.floorFinish === 'tile_1' || room.floorFinish === 'designer_tile_1' || room.floorFinish === 'custom_tile_1') finishType = 'tile_1';
      else if (room.floorFinish === 'tile_2' || room.floorFinish === 'designer_tile_2' || room.floorFinish === 'custom_tile_2') finishType = 'tile_2';
      else finishType = room.floorFinish;
    } else if (room.type === 'bedroom' && this.selectedFloorType === 'white_tile') {
      finishType = 'wooden';
    }`;

replaceExact('orbix-3d.js', search3d_3, replace3d_3);

// 2. orbix-ui.js
console.log('Updating orbix-ui.js...');
const searchUi_1 = `          '<div class="insp-row"><label>Floor Finish</label><select id="inspRoomFloor">' +
            '<option value="wood"' + ((rm.floorFinish === 'wood') ? ' selected' : '') + '>Wooden Parquet Flooring</option>' +
            '<option value="marble"' + ((rm.floorFinish === 'marble') ? ' selected' : '') + '>Italian White Marble</option>' +
            '<option value="tile"' + ((rm.floorFinish === 'tile' || !rm.floorFinish) ? ' selected' : '') + '>Vitrified Light Tiles</option>' +
            '<option value="concrete"' + ((rm.floorFinish === 'concrete') ? ' selected' : '') + '>Polished Concrete</option>' +
          '</select></div>' +`;

const replaceUi_1 = `          '<div class="insp-row"><label>Floor Finish</label><select id="inspRoomFloor">' +
            '<option value="wood"' + ((rm.floorFinish === 'wood') ? ' selected' : '') + '>Wooden Parquet Flooring</option>' +
            '<option value="marble"' + ((rm.floorFinish === 'marble') ? ' selected' : '') + '>Italian White Marble</option>' +
            '<option value="tile"' + ((rm.floorFinish === 'tile' || !rm.floorFinish) ? ' selected' : '') + '>Vitrified Light Tiles</option>' +
            '<option value="concrete"' + ((rm.floorFinish === 'concrete') ? ' selected' : '') + '>Polished Concrete</option>' +
            '<option value="tile_1"' + ((rm.floorFinish === 'tile_1' || rm.floorFinish === 'designer_tile_1') ? ' selected' : '') + '>Designer Tile 1 (Crema Marfil)</option>' +
            '<option value="tile_2"' + ((rm.floorFinish === 'tile_2' || rm.floorFinish === 'designer_tile_2') ? ' selected' : '') + '>Designer Tile 2 (Mocha Breccia)</option>' +
          '</select></div>' +`;

replaceExact('orbix-ui.js', searchUi_1, replaceUi_1);

const searchUi_2 = `            var fType = rm.floorFinish;
            if (fType === 'wood') fType = 'wooden';
            else if (fType === 'marble') fType = 'white_tile';
            else if (fType === 'tile') fType = 'square_tile';
            else if (fType === 'concrete') fType = 'grey_tile';
            if (self.archRenderer && typeof self.archRenderer.setFloorMaterial === 'function') {`;

const replaceUi_2 = `            var fType = rm.floorFinish;
            if (fType === 'wood') fType = 'wooden';
            else if (fType === 'marble') fType = 'white_tile';
            else if (fType === 'tile') fType = 'square_tile';
            else if (fType === 'concrete') fType = 'grey_tile';
            else if (fType === 'tile_1' || fType === 'designer_tile_1') fType = 'tile_1';
            else if (fType === 'tile_2' || fType === 'designer_tile_2') fType = 'tile_2';
            if (self.archRenderer && typeof self.archRenderer.setFloorMaterial === 'function') {`;

replaceExact('orbix-ui.js', searchUi_2, replaceUi_2);

// 3. app.js
console.log('Updating app.js...');
const searchApp_1 = `    function makeFloorMat(type) {
      type = type || window.currentFloorType || "white_tile";
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d");

      if (type === "white_tile") {`;

const replaceApp_1 = `    function makeFloorMat(type) {
      type = type || window.currentFloorType || "white_tile";
      var b64 = null;
      if (typeof window !== "undefined" && window.ORBIX_FLOOR_TEXTURES) {
        b64 = window.ORBIX_FLOOR_TEXTURES[type];
        if (!b64 && (type === "tile_1" || type === "designer_tile_1")) b64 = window.ORBIX_FLOOR_TEXTURES.tile_1;
        if (!b64 && (type === "tile_2" || type === "designer_tile_2")) b64 = window.ORBIX_FLOOR_TEXTURES.tile_2;
      }
      if (b64 && typeof Image !== "undefined") {
        var img = new Image();
        var imgTex = new THREE.Texture(img);
        imgTex.wrapS = imgTex.wrapT = THREE.RepeatWrapping;
        imgTex.repeat.set(120, 120);
        imgTex.encoding = THREE.sRGBEncoding;
        if (renderer && renderer.capabilities) imgTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
        img.onload = function () {
          imgTex.needsUpdate = true;
          render();
        };
        img.src = b64;
        return new THREE.MeshStandardMaterial({
          map: imgTex,
          roughness: 0.78,
          metalness: 0.0
        });
      }

      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d");

      if (type === "tile_1" || type === "designer_tile_1") {
        g.fillStyle = "#C8BFA7"; g.fillRect(0, 0, 512, 512);
        for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          var slabGrad = g.createLinearGradient(tx, ty, tx + tw, ty + th);
          slabGrad.addColorStop(0, "#F5EDE2"); slabGrad.addColorStop(0.5, "#ECE2D3"); slabGrad.addColorStop(1, "#E4D7C5");
          g.fillStyle = slabGrad; g.fillRect(tx, ty, tw, th);
          g.strokeStyle = "rgba(255, 255, 255, 0.65)"; g.lineWidth = 1.2; g.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);
          g.strokeStyle = "rgba(180, 140, 95, 0.28)"; g.lineWidth = 1.8;
          g.beginPath(); g.moveTo(tx + 20, ty + 30); g.bezierCurveTo(tx + 95, ty + 90, tx + 140, ty + 165, tx + 230, ty + 220); g.stroke();
        }
      } else if (type === "tile_2" || type === "designer_tile_2") {
        g.fillStyle = "#4B3F38"; g.fillRect(0, 0, 512, 512);
        for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          var slabGrad = g.createLinearGradient(tx, ty, tx + tw, ty + th);
          slabGrad.addColorStop(0, "#C2AF9F"); slabGrad.addColorStop(0.5, "#B5A08F"); slabGrad.addColorStop(1, "#A48F7E");
          g.fillStyle = slabGrad; g.fillRect(tx, ty, tw, th);
          g.strokeStyle = "rgba(255, 255, 255, 0.35)"; g.lineWidth = 1.2; g.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);
          g.strokeStyle = "rgba(75, 60, 50, 0.38)"; g.lineWidth = 2.0;
          g.beginPath(); g.moveTo(tx + 25, ty + 20); g.bezierCurveTo(tx + 85, ty + 100, tx + 150, ty + 150, tx + 235, ty + 230); g.stroke();
        }
      } else if (type === "white_tile") {`;

replaceExact('app.js', searchApp_1, replaceApp_1);

// 4. index.html
console.log('Updating index.html...');
const searchHtml_1 = `              <!-- 3D Floor Finish Switcher -->
              <div class="floor-finish-group" id="floorFinishGroup" title="Choose 3D Floor Finish">
                <button class="minibtn is-on" data-floor="white_tile" title="Italian White Marble Tile">◻ White Tile</button>
                <button class="minibtn" data-floor="square_tile" title="Square Ceramic Tile">▦ Square Tile</button>
                <button class="minibtn" data-floor="grey_tile" title="Charcoal Grey Stone Tile">▩ Grey Tile</button>
                <button class="minibtn" data-floor="wooden" title="Warm Hardwood Parquet">🪵 Wooden</button>
              </div>`;

const replaceHtml_1 = `              <!-- 3D Floor Finish Switcher -->
              <div class="floor-finish-group" id="floorFinishGroup" title="Choose 3D Floor Finish">
                <button class="minibtn is-on" data-floor="white_tile" title="Italian White Marble Tile">◻ White Tile</button>
                <button class="minibtn" data-floor="square_tile" title="Square Ceramic Tile">▦ Square Tile</button>
                <button class="minibtn" data-floor="grey_tile" title="Charcoal Grey Stone Tile">▩ Grey Tile</button>
                <button class="minibtn" data-floor="wooden" title="Warm Hardwood Parquet">🪵 Wooden</button>
                <button class="minibtn" data-floor="tile_1" title="Designer Floor Tile 1 (Crema Marfil)">🏛️ Tile 1</button>
                <button class="minibtn" data-floor="tile_2" title="Designer Floor Tile 2 (Mocha Breccia)">✨ Tile 2</button>
              </div>`;

replaceExact('index.html', searchHtml_1, replaceHtml_1);

const searchHtml_2 = `<script src="orbix-dado-textures.js"></script>
<script src="orbix-3d.js?v=14"></script>`;

const replaceHtml_2 = `<script src="orbix-dado-textures.js"></script>
<script src="orbix-floor-textures.js"></script>
<script src="orbix-3d.js?v=14"></script>`;

replaceExact('index.html', searchHtml_2, replaceHtml_2);

// 5. build.py
console.log('Updating build.py...');
const searchBuild_1 = `dado_tex_path = os.path.join(here, 'orbix-dado-textures.js')
orbix_dado_tex = open(dado_tex_path, encoding='utf-8').read() if os.path.exists(dado_tex_path) else ''
orbix_3d = open(os.path.join(here, 'orbix-3d.js'), encoding='utf-8').read()`;

const replaceBuild_1 = `dado_tex_path = os.path.join(here, 'orbix-dado-textures.js')
orbix_dado_tex = open(dado_tex_path, encoding='utf-8').read() if os.path.exists(dado_tex_path) else ''
floor_tex_path = os.path.join(here, 'orbix-floor-textures.js')
orbix_floor_tex = open(floor_tex_path, encoding='utf-8').read() if os.path.exists(floor_tex_path) else ''
orbix_3d = open(os.path.join(here, 'orbix-3d.js'), encoding='utf-8').read()`;

replaceExact('build.py', searchBuild_1, replaceBuild_1);

const searchBuild_2 = `all_js = '<script>\\n' + orbix_unit_icons + '\\n' + orbix_projects + '\\n' + orbix_core + '\\n' + orbix_plan + '\\n' + orbix_dado_tex + '\\n' + orbix_3d + '\\n' + orbix_ui + '\\n' + js + '\\n' + pwa_js + '\\n</script>'
pattern = r'(?:<script src="orbix-unit-icons\\.js[^"]*"></script>\\s*)?<script src="orbix-projects\\.js[^"]*"></script>\\s*<script src="orbix-core\\.js[^"]*"></script>\\s*<script src="orbix-plan\\.js[^"]*"></script>\\s*(?:<script src="orbix-dado-textures\\.js[^"]*"></script>\\s*)?<script src="orbix-3d\\.js[^"]*"></script>\\s*<script src="orbix-ui\\.js[^"]*"></script>\\s*<script src="app\\.js[^"]*"></script>\\s*<script src="pwa\\.js[^"]*"></script>'`;

const replaceBuild_2 = `all_js = '<script>\\n' + orbix_unit_icons + '\\n' + orbix_projects + '\\n' + orbix_core + '\\n' + orbix_plan + '\\n' + orbix_dado_tex + '\\n' + orbix_floor_tex + '\\n' + orbix_3d + '\\n' + orbix_ui + '\\n' + js + '\\n' + pwa_js + '\\n</script>'
pattern = r'(?:<script src="orbix-unit-icons\\.js[^"]*"></script>\\s*)?<script src="orbix-projects\\.js[^"]*"></script>\\s*<script src="orbix-core\\.js[^"]*"></script>\\s*<script src="orbix-plan\\.js[^"]*"></script>\\s*(?:<script src="orbix-dado-textures\\.js[^"]*"></script>\\s*)?(?:<script src="orbix-floor-textures\\.js[^"]*"></script>\\s*)?<script src="orbix-3d\\.js[^"]*"></script>\\s*<script src="orbix-ui\\.js[^"]*"></script>\\s*<script src="app\\.js[^"]*"></script>\\s*<script src="pwa\\.js[^"]*"></script>'`;

replaceExact('build.py', searchBuild_2, replaceBuild_2);

console.log('All updates applied cleanly!');
