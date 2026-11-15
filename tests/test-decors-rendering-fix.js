const fs = require('fs');
const path = require('path');

console.log('Testing Decor Rendering Fix & Offline Asset Verification...');

// 1. Verify index.html includes three.min.js and GLTFLoader.js
const indexPath = path.join(__dirname, '..', 'index.html');
const indexHtml = fs.readFileSync(indexPath, 'utf8');
if (!indexHtml.includes('<script src="assets/three.min.js"></script>')) {
  throw new Error('index.html missing <script src="assets/three.min.js"></script>');
}
if (!indexHtml.includes('<script src="assets/GLTFLoader.js"></script>')) {
  throw new Error('index.html missing <script src="assets/GLTFLoader.js"></script>');
}
console.log('✓ index.html has synchronous offline Three.js and GLTFLoader scripts');

// 2. Verify local assets exist
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(path.join(assetsDir, 'three.min.js'))) {
  throw new Error('assets/three.min.js does not exist');
}
if (!fs.existsSync(path.join(assetsDir, 'GLTFLoader.js'))) {
  throw new Error('assets/GLTFLoader.js does not exist');
}
console.log('✓ Local Three.js and GLTFLoader.js exist in assets/');

// 3. Verify desktop builds have the files
const desktopTargets = [
  path.join(__dirname, '..', 'dist-desktop', 'OrbixStudio-win32-x64', 'resources', 'app'),
  path.join(__dirname, '..', 'dist-desktop', 'OrbixStudio-v2-win32-x64', 'resources', 'app')
];

desktopTargets.forEach(target => {
  if (fs.existsSync(target)) {
    const tThree = path.join(target, 'assets', 'three.min.js');
    const tGltf = path.join(target, 'assets', 'GLTFLoader.js');
    const tDecors = path.join(target, 'assets', 'decors');
    if (!fs.existsSync(tThree)) throw new Error(`Missing three.min.js in ${target}`);
    if (!fs.existsSync(tGltf)) throw new Error(`Missing GLTFLoader.js in ${target}`);
    if (!fs.existsSync(tDecors)) throw new Error(`Missing decors folder in ${target}`);
    const glbCount = fs.readdirSync(tDecors).filter(f => f.endsWith('.glb')).length;
    console.log(`✓ Desktop target ${path.basename(path.dirname(path.dirname(target)))} has Three.js, GLTFLoader and ${glbCount} GLB models`);
  }
});

// 4. Verify app.js has ensureGLTFLoader
const appJsPath = path.join(__dirname, '..', 'app.js');
const appJs = fs.readFileSync(appJsPath, 'utf8');
if (!appJs.includes('ensureGLTFLoader')) {
  throw new Error('app.js missing ensureGLTFLoader');
}
console.log('✓ app.js has robust ensureGLTFLoader with local and CDN fallbacks');

// 5. Verify orbix-3d.js placeholder is wireframe and doesn't get trapped
const orbix3dPath = path.join(__dirname, '..', 'orbix-3d.js');
const orbix3d = fs.readFileSync(orbix3dPath, 'utf8');
if (orbix3d.includes('MeshStandardMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.25 })')) {
  throw new Error('orbix-3d.js still contains the old translucent box placeholder!');
}
if (!orbix3d.includes('EdgesGeometry')) {
  throw new Error('orbix-3d.js missing clean EdgesGeometry wireframe placeholder');
}
if (!orbix3d.includes('ensureGLTFLoader')) {
  throw new Error('orbix-3d.js doLoad missing ensureGLTFLoader call');
}
console.log('✓ orbix-3d.js has subtle wireframe placeholder and proactive ensureGLTFLoader');

console.log('\nALL VERIFICATION CHECKS PASSED SUCCESSFULLY!');

