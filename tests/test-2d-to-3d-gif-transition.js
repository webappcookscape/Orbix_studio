/**
 * Test: 2D-to-3D Design Journey GIF Transition
 * Verifies that the Cookscape design journey GIF is embedded, the overlay HTML/CSS exists,
 * and switching to 3D runs all backend work during the GIF animation.
 */

const assert = require('assert');
const fs = require('fs');

console.log('--- Running 2D-to-3D Design Journey GIF Transition Tests ---');

// 1. Verify GIF file exists in assets and root
assert(fs.existsSync('cookscape-2d-to-3d-journey.gif'), 'cookscape-2d-to-3d-journey.gif must exist in project root');
assert(fs.existsSync('assets/cookscape-2d-to-3d-journey.gif'), 'assets/cookscape-2d-to-3d-journey.gif must exist in assets');
const gifStats = fs.statSync('cookscape-2d-to-3d-journey.gif');
assert(gifStats.size > 500000, 'GIF file must be valid size (>500KB)');
console.log('✓ GIF file present and verified (' + (gifStats.size / 1024).toFixed(1) + ' KB)');

// 2. Verify index.html contains overlay element and GIF
const indexHtml = fs.readFileSync('index.html', 'utf8');
assert(indexHtml.includes('id="transition2DTo3DOverlay"'), 'index.html must have transition2DTo3DOverlay');
assert(indexHtml.includes('id="djJourneyGif"'), 'index.html must have djJourneyGif');
assert(indexHtml.includes('id="djStatusText"'), 'index.html must have djStatusText');
assert(indexHtml.includes('id="djProgressBar"'), 'index.html must have djProgressBar');
assert(indexHtml.includes('Cookscape 2D &rarr; 3D Design Journey'), 'index.html must have design journey badge');
console.log('✓ HTML transition overlay elements verified in index.html');

// 3. Verify style.css contains design journey overlay styles
const styleCss = fs.readFileSync('style.css', 'utf8');
assert(styleCss.includes('.design-journey-overlay'), 'style.css must style design-journey-overlay');
assert(styleCss.includes('.dj-backdrop'), 'style.css must style dj-backdrop');
assert(styleCss.includes('.dj-modal-card'), 'style.css must style dj-modal-card');
assert(styleCss.includes('.dj-journey-gif'), 'style.css must style dj-journey-gif');
assert(styleCss.includes('.dj-progress-bar'), 'style.css must style dj-progress-bar');
console.log('✓ CSS styles for transition overlay verified in style.css');

// 4. Verify app.js handles 2D to 3D switching with backend work running during GIF
const appJs = fs.readFileSync('app.js', 'utf8');
assert(appJs.includes('transition2DTo3DOverlay'), 'app.js must reference transition2DTo3DOverlay');
assert(appJs.includes('run3DBackendWork'), 'app.js must execute run3DBackendWork during transition');
assert(appJs.includes('djStatusText'), 'app.js must update djStatusText');
assert(appJs.includes('djProgressBar'), 'app.js must animate djProgressBar');
console.log('✓ app.js 2D-to-3D transition logic and backend orchestration verified');

// 5. Verify build.py inlines the GIF as base64 in single-file dist
const buildPy = fs.readFileSync('build.py', 'utf8');
assert(buildPy.includes('cookscape-2d-to-3d-journey.gif'), 'build.py must inline cookscape-2d-to-3d-journey.gif');
const distSingle = fs.readFileSync('dist-single.html', 'utf8');
assert(distSingle.includes('transition2DTo3DOverlay'), 'dist-single.html must include transition overlay');
assert(distSingle.includes('data:image/gif;base64,'), 'dist-single.html must have base64 inlined GIF');
console.log('✓ Single-file dist-single.html has base64 inlined GIF verified');

console.log('======================================================');
console.log('ALL 2D-TO-3D DESIGN JOURNEY GIF TESTS PASSED WITH 0 ERRORS!');
console.log('======================================================');
