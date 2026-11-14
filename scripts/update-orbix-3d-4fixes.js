const fs = require('fs');

let d3 = fs.readFileSync('orbix-3d.js', 'utf8');
const isCRLF = d3.includes('\r\n');
if (isCRLF) d3 = d3.replace(/\r\n/g, '\n');

// 1. Spotlight intensity in buildHome
const targetDownlight = `    var downlightIntensity = spotPositions.length > 1 ? Math.max(0.38, 1.15 / spotPositions.length) : 0.72;`;
const replaceDownlight = `    var currentSpotMultiplier = (typeof window !== 'undefined' && window.spotlightIntensity !== undefined) ? window.spotlightIntensity : 1.0;
    var downlightIntensity = (spotPositions.length > 1 ? Math.max(0.38, 1.15 / spotPositions.length) : 0.72) * currentSpotMultiplier;`;

if (!d3.includes(targetDownlight)) {
  console.error('targetDownlight not found in orbix-3d.js');
  process.exit(1);
}
d3 = d3.replace(targetDownlight, replaceDownlight);

const targetSpot = `      if (typeof THREE.SpotLight !== 'undefined') {
        var spot = new THREE.SpotLight(0xFFF3DF, downlightIntensity);`;
const replaceSpot = `      if (typeof THREE.SpotLight !== 'undefined') {
        var spot = new THREE.SpotLight(0xFFF3DF, downlightIntensity);
        spot.name = 'roomSpotlight';`;

if (!d3.includes(targetSpot)) {
  console.error('targetSpot not found in orbix-3d.js');
  process.exit(1);
}
d3 = d3.replace(targetSpot, replaceSpot);

// Also tag fillLight
const targetFillLight = `    // Soft Warm Interior Radiosity / Bounce Fill so vertical cabinets & corners have rich architectural depth
    if (typeof THREE.PointLight !== 'undefined') {
      var fillLight = new THREE.PointLight(0xFFF6E8, 0.36, Math.max(5200, Math.max(rWidth, rDepth) * 1.45), 1.0);`;

const replaceFillLight = `    // Soft Warm Interior Radiosity / Bounce Fill so vertical cabinets & corners have rich architectural depth
    if (typeof THREE.PointLight !== 'undefined') {
      var fillLight = new THREE.PointLight(0xFFF6E8, 0.36 * currentSpotMultiplier, Math.max(5200, Math.max(rWidth, rDepth) * 1.45), 1.0);
      fillLight.name = 'roomFillLight';`;

if (d3.includes(targetFillLight)) {
  d3 = d3.replace(targetFillLight, replaceFillLight);
}

// 2. Fix buildWallPanelMesh (Ledges and Wall Panels center at z = 0, matching 2D plan!)
const targetBuildWallPanel = `  ArchitecturalRenderer.prototype.buildWallPanelMesh = function (furn, fg, dims, carcassMat) {
    var W = dims.W;
    var H = dims.H;
    var D = Math.max(12, dims.D || 18);

    var panelGeo = new THREE.BoxGeometry(W, H, D);
    var panelMesh = new THREE.Mesh(panelGeo, carcassMat);
    panelMesh.position.set(0, H / 2, -D / 2);
    panelMesh.castShadow = true; panelMesh.receiveShadow = true;
    panelMesh.userData = { isFurniturePart: true, parentGroup: fg, furnitureId: furn.id };
    fg.add(panelMesh);`;

const replaceBuildWallPanel = `  ArchitecturalRenderer.prototype.buildWallPanelMesh = function (furn, fg, dims, carcassMat) {
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
    fg.add(panelMesh);`;

if (!d3.includes(targetBuildWallPanel)) {
  console.error('targetBuildWallPanel not found in orbix-3d.js');
  process.exit(1);
}
d3 = d3.replace(targetBuildWallPanel, replaceBuildWallPanel);

// 3. Ensure isWallPanel matches all ledge variants
const targetIsWallPanel = `    // 1. Architectural Wall Paneling / Back Panel (zero carcass)
    var isWallPanel = (cat === 'wall_paneling' || furn.id === 'pnl-back' || furn.catalogItemId === 'pnl-back' || (name && (name.indexOf('back panel') !== -1 || name.indexOf('wall panel') !== -1 || name.indexOf('vertical ledge') !== -1)));`;

const replaceIsWallPanel = `    // 1. Architectural Wall Paneling / Back Panel / Ledges (zero carcass box)
    var isWallPanel = (cat === 'wall_paneling' || /pnl[-_]?back|ledge/i.test(furn.id || '') || /pnl[-_]?back|ledge/i.test(furn.catalogItemId || '') || (name && (name.indexOf('back panel') !== -1 || name.indexOf('wall panel') !== -1 || name.indexOf('vertical ledge') !== -1 || name.indexOf('ledge') !== -1)));`;

if (!d3.includes(targetIsWallPanel)) {
  console.error('targetIsWallPanel not found in orbix-3d.js');
  process.exit(1);
}
d3 = d3.replace(targetIsWallPanel, replaceIsWallPanel);

// 4. Wardrobe with internal drawers: Side-by-side drawers & full-height outer shutters
const targetInternalDrawersBlock = `    if (drawersCount > 0) {
      if (isInternalDrawers) {
        // Internal drawers placed inside wardrobe in vertical center:
        drawerH = 175;
        totalDrawersH = drawersCount * (drawerH + 6);
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
      } else if (numShutters === 0) {`;

const replaceInternalDrawersBlock = `    var isInternalSideBySide = isInternalDrawers && (drawersCount >= 2);

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
      } else if (numShutters === 0) {`;

if (!d3.includes(targetInternalDrawersBlock)) {
  console.error('targetInternalDrawersBlock not found in orbix-3d.js');
  process.exit(1);
}
d3 = d3.replace(targetInternalDrawersBlock, replaceInternalDrawersBlock);

// Update drawer loop for side-by-side internal drawers
const targetDrawerLoop = `      for (var d = 0; d < drawersCount; d++) {
        var dY = isSideBySide ? (drawerBaseY + drawerH / 2) : (drawerBaseY + d * (drawerH + 3) + drawerH / 2);
        var drawerW = isSideBySide ? Math.floor((dims.W - 9) / 2) : (dims.W - 6);
        var drawerBoxW = isSideBySide ? (drawerW - 16) : (innerW - 20);
        var drawerCenterX = isSideBySide ? (d === 0 ? (-dims.W / 4) : (dims.W / 4)) : 0;

        var isDOpen = !!(furn.drawerStates && furn.drawerStates[d]);
        var drawerGroup = new THREE.Group();
        drawerGroup.name = 'DrawerSlide_' + d;
        drawerGroup.position.set(drawerCenterX, dY, isDOpen ? 350 : 0);
        drawerGroup.userData = { isDrawerGroup: true, drawerIdx: d, furnitureId: furn.id, isOpen: isDOpen };

        // Drawer Front Facia
        var faciaGeo = new THREE.BoxGeometry(drawerW, drawerH, 18);
        var faciaMat = getShutterMaterial(d % Math.max(1, numShutters));
        var faciaMesh = new THREE.Mesh(faciaGeo, faciaMat);
        faciaMesh.position.set(0, 0, dims.D / 2 - 9);
        faciaMesh.castShadow = true; faciaMesh.receiveShadow = true;
        faciaMesh.userData = { isFurniturePart: true, isDrawer: true, drawerIdx: d, drawerGroup: drawerGroup, parentGroup: fg, furnitureId: furn.id };
        drawerGroup.add(faciaMesh);

        // Drawer Pull Handle (Horizontal)
        var dhGroup = ArchitecturalRenderer.createHandleMesh(handleType, handleMat, false, Math.min(180, (drawerW - 30) * 0.45));
        if (dhGroup) {
          dhGroup.position.set(0, 0, dims.D / 2);`;

const replaceDrawerLoop = `      for (var d = 0; d < drawersCount; d++) {
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
          dhGroup.position.set(0, 0, handleZ);`;

if (!d3.includes(targetDrawerLoop)) {
  console.error('targetDrawerLoop not found in orbix-3d.js');
  process.exit(1);
}
d3 = d3.replace(targetDrawerLoop, replaceDrawerLoop);

// Update outer shutter height so it covers full height for isInternalDrawers
const targetShutterHeight = `        // Standard Hinged Shutters
        var shW = (dims.W - (numShutters + 1) * 3) / numShutters;
        var shH = Math.max(150, bodyH - totalDrawersH - 6);
        var hingeY = shutterBaseY + shH / 2;`;

const replaceShutterHeight = `        // Standard Hinged Shutters (Full-height outer doors when drawers are internal!)
        var shW = (dims.W - (numShutters + 1) * 3) / numShutters;
        var shH = Math.max(150, bodyH - (isInternalDrawers ? 0 : totalDrawersH) - 6);
        var hingeY = shutterBaseY + shH / 2;`;

if (!d3.includes(targetShutterHeight)) {
  console.error('targetShutterHeight not found in orbix-3d.js');
  process.exit(1);
}
d3 = d3.replace(targetShutterHeight, replaceShutterHeight);

if (isCRLF) d3 = d3.replace(/\n/g, '\r\n');
fs.writeFileSync('orbix-3d.js', d3, 'utf8');
console.log('Successfully updated orbix-3d.js!');
