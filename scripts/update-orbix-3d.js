const fs = require('fs');
let code = fs.readFileSync('orbix-3d.js', 'utf8');
const hasCRLF = code.includes('\r\n');
if (hasCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

// 1. Dark Beige Wall Plaster & Wall Core
const targetMat = `    // Wall Plaster (Warm architectural alabaster ivory plaster - photorealistic and clean)
    this.materials.wall = new THREE.MeshStandardMaterial({
      color: 0xF2EFE9, // Warm architectural alabaster
      roughness: 0.88,
      metalness: 0.01,
      bumpMap: wallBump,
      bumpScale: 0.04
    });

    // Wall Core (Cutaway section interior)
    this.materials.wallCore = new THREE.MeshStandardMaterial({
      color: 0xDCD7CD, // Clean architectural plaster core
      roughness: 0.9,
      metalness: 0.0
    });`;

const replaceMat = `    // Wall Plaster (Rich Architectural Dark Beige Plaster)
    this.materials.wall = new THREE.MeshStandardMaterial({
      color: 0xB89F82, // Elegant authentic Dark Beige plaster
      roughness: 0.88,
      metalness: 0.01,
      bumpMap: wallBump,
      bumpScale: 0.04
    });

    // Wall Core (Cutaway section interior)
    this.materials.wallCore = new THREE.MeshStandardMaterial({
      color: 0x9E836A, // Dark beige plaster core
      roughness: 0.9,
      metalness: 0.0
    });`;

if (!code.includes(targetMat)) {
  console.error('Target 1 (Materials) not found');
  process.exit(1);
}
code = code.replace(targetMat, replaceMat);

// 2. buildOnlyShutterMesh: depth default 18mm
const targetOS = `    var isBaseOS = isBase || catOS === 'kitchen_base' || catOS === 'kitchen_os' || catOS.indexOf('base') !== -1 || (furn.costCategory && furn.costCategory.indexOf('Base') !== -1) || (!isWallOS && !isLoftOS);

    var actualPlinthH = isBaseOS ? ((plinthH !== undefined && plinthH > 0) ? plinthH : 100) : 0;
    var actualCounterH = isBaseOS ? ((counterH !== undefined && counterH > 0) ? counterH : 35) : 0;
    var baseD = (dims.D && dims.D > 100) ? dims.D : 560;

    if (isBaseOS) {`;

const replaceOS = `    var isTrueOnlyShutter = !!(furn.unitConfig && furn.unitConfig.isOnlyShutter) || (furn.name && /\\bo\\/?s\\b/i.test(furn.name)) || (furn.costCategory && furn.costCategory.indexOf('O/S') !== -1);
    var isBaseOS = !isTrueOnlyShutter && (isBase || catOS === 'kitchen_base' || catOS === 'kitchen_os' || catOS.indexOf('base') !== -1 || (furn.costCategory && furn.costCategory.indexOf('Base') !== -1) || (!isWallOS && !isLoftOS));

    var actualPlinthH = isBaseOS ? ((plinthH !== undefined && plinthH > 0) ? plinthH : 100) : 0;
    var actualCounterH = isBaseOS ? ((counterH !== undefined && counterH > 0) ? counterH : 35) : 0;
    var baseD = isTrueOnlyShutter ? 18 : ((dims.D && dims.D < 100) ? dims.D : (isBaseOS ? 560 : 18));

    if (isBaseOS && !isTrueOnlyShutter && baseD > 50) {`;

if (!code.includes(targetOS)) {
  console.error('Target 2 (OS) not found');
  process.exit(1);
}
code = code.replace(targetOS, replaceOS);

// 3. buildFurnitureMesh: GL unit default door style "glass"
const targetDstyle = `    // Door style & type
    var dstyle = (furn.unitConfig && furn.unitConfig.dstyle) || 'slab';`;

const replaceDstyle = `    // Door style & type
    var isGLUnit = /(^|\\b|_|-|\\s)gl(\\b|_|-|\\s|\\d+|$)/i.test(String(name || '') + ' ' + String(furn.code || '') + ' ' + String(furn.id || ''));
    var dstyle = (furn.unitConfig && furn.unitConfig.dstyle) || (isGLUnit ? 'glass' : 'slab');
    if (isGLUnit && (!dstyle || dstyle === 'slab')) dstyle = 'glass';`;

if (!code.includes(targetDstyle)) {
  console.error('Target 3 (dstyle) not found');
  process.exit(1);
}
code = code.replace(targetDstyle, replaceDstyle);

// 4. Countertop placement and low unit bodyH
const targetBodyH = `    var plinthH = hasLegs ? 100 : 0;
    var counterH = (isBase && counterColorName !== 'none') ? 35 : 0;
    var bodyH = Math.max(100, dims.H - plinthH - counterH);
    var innerW = dims.W - 36;
    var innerD = dims.D - 20;`;

const replaceBodyH = `    var plinthH = hasLegs ? 100 : 0;
    var counterH = (isBase && counterColorName !== 'none') ? 35 : 0;
    var bodyH = (dims.H <= 350) ? dims.H : Math.max(100, dims.H - plinthH - counterH);
    var topOfCarcass = plinthH + bodyH;
    var innerW = dims.W - 36;
    var innerD = dims.D - 20;`;

if (!code.includes(targetBodyH)) {
  console.error('Target 4 (bodyH) not found');
  process.exit(1);
}
code = code.replace(targetBodyH, replaceBodyH);

// 5. Countertop Y position
const targetCounter = `    // Countertop Stone (if kitchen base / vanity / crockery)
    if (counterH > 0) {
      var cGeo = new THREE.BoxGeometry(dims.W + 20, counterH, dims.D + 25);
      var cMesh = new THREE.Mesh(cGeo, counterMat);
      cMesh.position.set(0, dims.H - counterH / 2, 2.5);`;

const replaceCounter = `    // Countertop Stone (if kitchen base / vanity / crockery)
    if (counterH > 0) {
      var cGeo = new THREE.BoxGeometry(dims.W + 20, counterH, dims.D + 25);
      var cMesh = new THREE.Mesh(cGeo, counterMat);
      var topOfCarcass = plinthH + bodyH;
      cMesh.position.set(0, topOfCarcass + counterH / 2, 2.5);`;

if (!code.includes(targetCounter)) {
  console.error('Target 5 (Countertop) not found');
  process.exit(1);
}
code = code.replace(targetCounter, replaceCounter);

if (hasCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync('orbix-3d.js', code, 'utf8');
console.log('Successfully updated orbix-3d.js');
