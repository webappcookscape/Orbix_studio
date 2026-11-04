const fs = require('fs');
let code = fs.readFileSync('orbix-3d.js', 'utf8');
const eol = code.includes('\r\n') ? '\r\n' : '\n';

// 1. Update dims parsing and isBed & isOpenBox checks
const target1 = `    var dims = furn.dimensions || { W: 1200, H: 2100, D: 600 };
    var cat = (furn.category || 'wardrobe').toLowerCase();
    var name = (furn.name || '').toLowerCase();
    var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
      window.OrbixCore.isWallUnit(cat, name) :
      (cat.indexOf('wall') !== -1 || cat === 'wm-01' || cat === 'k_wall' || cat === 'kitchen_wall' ||
       cat === 'crockery_wall' || cat === 'spice_rack' || cat.indexOf('overhead') !== -1 ||
       cat.indexOf('loft') !== -1 || name.indexOf('wall') !== -1 || name.indexOf('overhead') !== -1 ||
       name.indexOf('spice rack') !== -1 || name.indexOf('loft') !== -1);
    var isKitchen = (cat === 'kitchen_base' || cat === 'kitchen_wall');
    var isBase = !isWall && (cat === 'kitchen_base' || cat === 'crockery' || cat === 'vanity');`;

const replace1 = `    var dims = furn.dimensions || { W: 1200, H: 2100, D: 600 };
    dims = {
      W: parseFloat(dims.W) || 1200,
      H: parseFloat(dims.H) || 2100,
      D: parseFloat(dims.D) || 600
    };
    var cat = (furn.category || 'wardrobe').toLowerCase();
    var name = (furn.name || '').toLowerCase();
    var isBed = (cat === 'bed' || name.indexOf('bed') !== -1);
    var isOpenBox = (cat.indexOf('os') !== -1 || cat.indexOf('open') !== -1 || name.indexOf('open') !== -1 ||
                     cat === 'spice_rack' || cat === 'kitchen_os' || cat === 'loft_os' ||
                     (furn.unitConfig && (furn.unitConfig.doorType === 'open' || furn.unitConfig.type === 'open')));
    var isWall = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
      window.OrbixCore.isWallUnit(cat, name) :
      (cat.indexOf('wall') !== -1 || cat === 'wm-01' || cat === 'k_wall' || cat === 'kitchen_wall' ||
       cat === 'crockery_wall' || cat === 'spice_rack' || cat.indexOf('overhead') !== -1 ||
       cat.indexOf('loft') !== -1 || name.indexOf('wall') !== -1 || name.indexOf('overhead') !== -1 ||
       name.indexOf('spice rack') !== -1 || name.indexOf('loft') !== -1);
    var isKitchen = (cat === 'kitchen_base' || cat === 'kitchen_wall');
    var isBase = !isWall && (cat === 'kitchen_base' || cat === 'crockery' || cat === 'vanity' || cat.indexOf('base') !== -1);`;

// 2. Bed geometry block before carcass construction
const bedBlock = [
  '    if (isBed) {',
  '      // High-Fidelity 3D Bed with Headboard, Frame, and Mattress',
  '      var headboardH = Math.min(1100, Math.max(850, dims.H));',
  '      var headboardT = 70;',
  '      var bedFrameH = 360;',
  '      var mattressH = 200;',
  '      var mattressInset = 30;',
  '',
  '      // 1. Headboard (against back wall)',
  '      var hbGeo = new THREE.BoxGeometry(dims.W, headboardH, headboardT);',
  '      var hbMat = new THREE.MeshStandardMaterial({',
  '        color: carcassColor,',
  '        roughness: 0.5,',
  '        metalness: 0.05',
  '      });',
  '      var hbMesh = new THREE.Mesh(hbGeo, hbMat);',
  '      hbMesh.position.set(0, headboardH / 2, -dims.D / 2 + headboardT / 2);',
  '      hbMesh.castShadow = true; hbMesh.receiveShadow = true;',
  '      hbMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };',
  '      fg.add(hbMesh);',
  '',
  '      // 2. Bed Base Frame',
  '      var frameD = dims.D - headboardT;',
  '      var frameGeo = new THREE.BoxGeometry(dims.W - 10, bedFrameH, frameD);',
  '      var frameMat = new THREE.MeshStandardMaterial({ color: carcassColor, roughness: 0.6 });',
  '      var frameMesh = new THREE.Mesh(frameGeo, frameMat);',
  '      frameMesh.position.set(0, bedFrameH / 2, -dims.D / 2 + headboardT + frameD / 2);',
  '      frameMesh.castShadow = true; frameMesh.receiveShadow = true;',
  '      frameMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };',
  '      fg.add(frameMesh);',
  '',
  '      // 3. Mattress (Soft fabric finish)',
  '      var matW = dims.W - 2 * mattressInset;',
  '      var matD = frameD - mattressInset;',
  '      var matGeo = new THREE.BoxGeometry(matW, mattressH, matD);',
  '      var matMat = new THREE.MeshStandardMaterial({ color: 0xF5F5F7, roughness: 0.9, metalness: 0 });',
  '      var matMesh = new THREE.Mesh(matGeo, matMat);',
  '      matMesh.position.set(0, bedFrameH + mattressH / 2, -dims.D / 2 + headboardT + matD / 2 + 10);',
  '      matMesh.castShadow = true; matMesh.receiveShadow = true;',
  '      matMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };',
  '      fg.add(matMesh);',
  '',
  '      // 4. Pillows (Two plush pillows at headboard)',
  '      var pW = Math.min(550, (matW - 40) / 2);',
  '      var pD = 380;',
  '      var pH = 110;',
  '      var pGeo = new THREE.BoxGeometry(pW, pH, pD);',
  '      var pMat = new THREE.MeshStandardMaterial({ color: 0xEDEBE4, roughness: 0.95 });',
  '      var p1 = new THREE.Mesh(pGeo, pMat);',
  '      p1.position.set(-matW / 4, bedFrameH + mattressH + pH / 2, -dims.D / 2 + headboardT + pD / 2 + 25);',
  '      p1.rotation.x = 0.15;',
  '      p1.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };',
  '      fg.add(p1);',
  '',
  '      var p2 = new THREE.Mesh(pGeo, pMat);',
  '      p2.position.set(matW / 4, bedFrameH + mattressH + pH / 2, -dims.D / 2 + headboardT + pD / 2 + 25);',
  '      p2.rotation.x = 0.15;',
  '      p2.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };',
  '      fg.add(p2);',
  '',
  '      // Position bed group',
  '      var bElev = (furn.elevation !== undefined && furn.elevation !== null && furn.elevation !== "") ? parseFloat(furn.elevation) : 0;',
  '      fg.position.set(furn.pos.x, bElev, furn.pos.y);',
  '      fg.rotation.y = -(furn.rotY || 0);',
  '      fg.visible = true;',
  '      return fg;',
  '    }',
  ''
].join(eol);

// Helper for normalize
function replaceNorm(src, oldText, newText) {
  const normOld = oldText.replace(/\r\n/g, '\n');
  const normSrc = src.replace(/\r\n/g, '\n');
  if (!normSrc.includes(normOld)) {
    throw new Error('Could not find match in source');
  }
  const normNew = newText.replace(/\r\n/g, eol);
  return normSrc.replace(normOld, normNew).replace(/\n/g, eol);
}

code = replaceNorm(code, target1, replace1);

const targetCarcassStart = '    // Realistic Open Carcass with Interior Panels';
code = replaceNorm(code, targetCarcassStart, bedBlock + '    // Realistic Open Carcass with Interior Panels');

// 3. Make sure isOpenBox suppresses shutters
const targetShutters = `    var numShutters = (furn.unitConfig && furn.unitConfig.shutters !== undefined) ?
      parseInt(furn.unitConfig.shutters) :
      ((drawersCount > 0 && dims.H < 1000) ? 0 : (dims.W > 1200 ? 3 : dims.W > 600 ? 2 : 1));`;

const replaceShutters = `    var numShutters = (furn.unitConfig && furn.unitConfig.shutters !== undefined) ?
      parseInt(furn.unitConfig.shutters) :
      (isOpenBox ? 0 : ((drawersCount > 0 && dims.H < 1000) ? 0 : (dims.W > 1200 ? 3 : dims.W > 600 ? 2 : 1)));`;

code = replaceNorm(code, targetShutters, replaceShutters);

// 4. Ensure fg.visible = true so all units in 3D Home are always visible
const targetVis = `    // If this unit is currently the active unit in 3D Studio, keep its static mesh hidden
    // so the live parametric model (root) renders in its place
    if (typeof window !== 'undefined' && window.S && Array.isArray(window.S.units) && typeof window.S.active === 'number') {
      var actU = window.S.units[window.S.active];
      if (actU && actU._furnId === furn.id) {
        fg.visible = (window.Orbix3DViewMode === 'home');
      }
    }`;

const replaceVis = `    // Placed modular unit is always visible inside 3D architectural room
    fg.visible = true;`;

code = replaceNorm(code, targetVis, replaceVis);

fs.writeFileSync('orbix-3d.js', code, 'utf8');
console.log('Successfully updated orbix-3d.js!');
