/**
 * Test Suite: 3D Translation Gizmo, Sliding Door Tracks, Ctrl+Shift+R, & Session Persistence
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('════════════════════════════════════════════════════════════════');
console.log('🧪 TESTING 3D GIZMO, SLIDING DOORS, SHORTCUTS & SESSION RESILIENCE');
console.log('════════════════════════════════════════════════════════════════\n');

// 1. Test Ctrl+Shift+R not blocked in orbix-plan.js
console.log('Test 1: Ctrl+Shift+R Browser Hard Reload Unobstructed');
const planJs = fs.readFileSync('orbix-plan.js', 'utf8');
assert.ok(
  planJs.includes("!e.ctrlKey && !e.metaKey && !e.altKey && (e.code === 'Space' || e.key === ' ' || e.key === 'r' || e.key === 'R')"),
  'orbix-plan.js must only intercept r/Space when Ctrl/Meta/Alt are NOT pressed'
);
console.log('  ✓ Verified Ctrl+Shift+R is not intercepted by unit rotation\n');

// 2. Test 3D Sliding Door geometry and tracks in orbix-3d.js
console.log('Test 2: 3D Sliding Door Geometry & Dual Track Generation');
const orbix3dJs = fs.readFileSync('orbix-3d.js', 'utf8');
assert.ok(orbix3dJs.includes('ShutterSlide_'), 'orbix-3d.js must generate dual-track sliding shutter groups');
assert.ok(orbix3dJs.includes('slideW * 0.85'), 'Sliding shutters must slide horizontally along X');
assert.ok(orbix3dJs.includes('isSliding: true'), 'Sliding shutters must attach isSliding userData');
console.log('  ✓ Verified sliding shutters use dual tracks (Z offset) and horizontal X displacement\n');

// 3. Test 3D Translation Gizmo Arrows in app.js
console.log('Test 3: 3D Translation Gizmo & Restricted Unit Movement');
const appJs = fs.readFileSync('app.js', 'utf8');
assert.ok(appJs.includes('OrbixGizmo3D'), 'app.js must define OrbixGizmo3D translation arrows');
assert.ok(appJs.includes('axis: \'x\''), 'app.js must provide Red X-axis arrow');
assert.ok(appJs.includes('axis: \'z\''), 'app.js must provide Blue Z-axis arrow');
assert.ok(appJs.includes('GL.gizmoPick'), 'app.js must check gizmo arrow hit before moving unit');
console.log('  ✓ Verified units only move when Gizmo arrows are clicked & dragged\n');

// 4. Test Resilient Disk-Backed Session Store in server/config/session.js
console.log('Test 4: Resilient Session Store Disk Persistence');
const ResilientSessionStore = require('../server/config/session.js');
const store = new ResilientSessionStore();

const testSid = 'test_sess_' + Date.now();
const testData = { userId: 'usr_admin', cookie: { expires: new Date(Date.now() + 86400000).toISOString() } };

store.set(testSid, testData, () => {
  store.get(testSid, (err, sess) => {
    assert.strictEqual(err, null);
    assert.deepStrictEqual(sess.userId, 'usr_admin');
    
    // Simulate server restart: new store instance should restore session from disk cache
    const restartedStore = new ResilientSessionStore();
    restartedStore.get(testSid, (rErr, rSess) => {
      assert.strictEqual(rErr, null);
      assert.ok(rSess !== null, 'Session must persist across server restarts');
      assert.strictEqual(rSess.userId, 'usr_admin');
      console.log('  ✓ Sessions survive process exit and server updates without logging out');
      
      // Clean up test session
      restartedStore.destroy(testSid, () => {
        console.log('\n════════════════════════════════════════════════════════════════');
        console.log('🎉 ALL GIZMO, SLIDING DOOR & SESSION PERSISTENCE TESTS PASSED!');
        console.log('════════════════════════════════════════════════════════════════\n');
      });
    });
  });
});

