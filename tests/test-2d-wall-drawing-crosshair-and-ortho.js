/**
 * Automated Verification Suite:
 * 1. 2D Wall Drawing Accuracy & Precision Crosshair (+) Reticle
 * 2. Automatic Room Loop Closure & T-Junction Snapping
 * 3. Strong 16° Orthogonal Magnetism & Shift-Lock
 * 4. Easy Wall Completion (Loop Close, Click Same Spot, Double-Click, Enter, Escape, Right-Click)
 * 5. Canvas Cursor Management ('crosshair' during wall/dimension drawing)
 */

const assert = require('assert');
const fs = require('fs');

// Set up mock DOM and Browser environment
function mockEl(id, tagName) {
  var listeners = {};
  return {
    id: id || '',
    tagName: (tagName || 'div').toUpperCase(),
    style: {},
    classList: {
      classes: new Set(),
      toggle: function (c, val) {
        if (val === undefined) {
          if (this.classes.has(c)) this.classes.delete(c); else this.classes.add(c);
        } else if (val) {
          this.classes.add(c);
        } else {
          this.classes.delete(c);
        }
      },
      add: function (c) { this.classes.add(c); },
      remove: function (c) { this.classes.delete(c); },
      contains: function (c) { return this.classes.has(c); }
    },
    addEventListener: function (evt, cb) {
      if (!listeners[evt]) listeners[evt] = [];
      listeners[evt].push(cb);
    },
    dispatchEvent: function (evt) {
      var cbs = listeners[evt.type || evt] || [];
      cbs.forEach(cb => cb(evt));
    },
    _getListeners: function (evt) {
      return listeners[evt] || [];
    },
    appendChild: function () {},
    setAttribute: function (k, v) { this[k] = v; },
    getAttribute: function (k) { return this[k] || null; },
    querySelectorAll: function () { return []; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 1000, height: 800 }; },
    getContext: function () {
      var calls = [];
      return {
        _calls: calls,
        createPattern: function () {},
        fillRect: function () { calls.push({ op: 'fillRect', args: Array.from(arguments) }); },
        createImageData: function (w, h) { return { data: new Uint8Array((w || 64) * (h || 64) * 4) }; },
        putImageData: function () {},
        createLinearGradient: function () { return { addColorStop: function () {} }; },
        beginPath: function () { calls.push({ op: 'beginPath' }); },
        closePath: function () { calls.push({ op: 'closePath' }); },
        fill: function () { calls.push({ op: 'fill', fillStyle: this.fillStyle }); },
        stroke: function () { calls.push({ op: 'stroke', strokeStyle: this.strokeStyle, lineWidth: this.lineWidth }); },
        arc: function () { calls.push({ op: 'arc', args: Array.from(arguments) }); },
        save: function () { calls.push({ op: 'save' }); },
        restore: function () { calls.push({ op: 'restore' }); },
        translate: function () {},
        rotate: function () {},
        scale: function () {},
        moveTo: function () { calls.push({ op: 'moveTo', args: Array.from(arguments) }); },
        lineTo: function () { calls.push({ op: 'lineTo', args: Array.from(arguments) }); },
        bezierCurveTo: function () {},
        quadraticCurveTo: function () {},
        setLineDash: function () {},
        measureText: function (txt) { return { width: (txt || '').length * 8 }; },
        strokeText: function () { calls.push({ op: 'strokeText', args: Array.from(arguments) }); },
        fillText: function () { calls.push({ op: 'fillText', args: Array.from(arguments) }); },
        roundRect: function () { calls.push({ op: 'roundRect', args: Array.from(arguments) }); },
        clearRect: function () {}
      };
    }
  };
}

global.window = {
  addEventListener: function (evt, cb) {
    if (!global._winListeners) global._winListeners = {};
    if (!global._winListeners[evt]) global._winListeners[evt] = [];
    global._winListeners[evt].push(cb);
  },
  dispatchEvent: function (evt) {
    var cbs = (global._winListeners && global._winListeners[evt.type || evt]) || [];
    cbs.forEach(cb => cb(evt));
  }
};
global._winListeners = {};

global.document = {
  getElementById: function (id) {
    if (id === 'planCanvas') return mockEl('planCanvas', 'canvas');
    return mockEl(id);
  },
  querySelectorAll: function () { return []; },
  createElement: function (tag) { return mockEl('', tag); },
  body: mockEl('body')
};

const Core = require('../orbix-core.js');
const PlanEditor = require('../orbix-plan.js');

console.log('=== TEST SUITE: 2D Wall Drawing Precision Reticle (+) & Ortho Snap ===\n');

function createFreshEditor() {
  var proj = Core.createProject('Test Wall Reticle');
  var container = mockEl('planContainer');
  var ed = new PlanEditor(container, { project: proj });
  return { ed, canvas: ed.canvas, proj };
}

// ─── TEST 1: Snapping Engine - Room Close Loop & T-Junctions ───
console.log('[TEST 1] Verifying Room Loop Close & T-Junction on-wall snapping...');
const { ed: ed1, proj: proj1 } = createFreshEditor();

// Create existing wall from (0, 0) to (3000, 0)
const w1 = Core.createWall({ start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 150 });
proj1.plan.walls.push(w1);

// Test 1a: T-Junction / On-Wall snap
var hoverNearFace = { x: 1500, y: 50 }; // 50mm away from wall segment
var snapFace = ed1.snapPoint(hoverNearFace);
assert.strictEqual(snapFace.type, 'wall_segment', 'Expected on-wall segment snap for T-junction');
assert.strictEqual(snapFace.pt.x, 1500, 'Expected snapped X to be 1500');
assert.strictEqual(snapFace.pt.y, 0, 'Expected snapped Y to be 0 (on wall center line)');
console.log('✓ 1a PASSED: T-Junction magnetic snap attaches accurately to wall face.');

// Test 1b: Close Room Loop priority
ed1.wallChainFirstPoint = { x: 0, y: 0 };
ed1.wallChainStart = { x: 0, y: 3000 };
var hoverNearStart = { x: 40, y: 50 }; // within snap radius of (0, 0)
var snapClose = ed1.snapPoint(hoverNearStart);
assert.strictEqual(snapClose.isChainClose, true, 'Expected isChainClose to be true');
assert.strictEqual(snapClose.label, 'Close Room Loop', 'Expected label Close Room Loop');
assert.strictEqual(snapClose.pt.x, 0, 'Expected snap X to be 0');
assert.strictEqual(snapClose.pt.y, 0, 'Expected snap Y to be 0');
console.log('✓ 1b PASSED: Room Loop Close detected with isChainClose = true.\n');


// ─── TEST 2: Strong 16° Ortho Snap & Shift-Key Lock ───
console.log('[TEST 2] Verifying Strong 16° Ortho Snap & Shift-Lock...');
const { ed: ed2 } = createFreshEditor();
ed2.wallChainStart = { x: 1000, y: 1000 };

// 2a. Angle within 16° of horizontal (e.g. 10° ~= 0.174 rad)
// Length 2000mm at 10°: dx = 2000 * cos(10°) = 1970, dy = 2000 * sin(10°) = 347
var pt10deg = { x: 1000 + 1970, y: 1000 + 347 };
var snap10 = ed2.snapPoint(pt10deg);
assert.strictEqual(snap10.type, 'ortho', 'Expected ortho snap at 10 degrees');
assert.strictEqual(snap10.angleDeg, 0, 'Expected horizontal angle 0°');
assert.strictEqual(snap10.pt.y, 1000, 'Expected snapped Y to remain strictly horizontal (1000)');
assert.strictEqual(snap10.label, '↔ Horizontal', 'Expected Horizontal label');
console.log('✓ 2a PASSED: 16° magnetic pull locks 10° hand tremor strictly to horizontal.');

// 2b. Angle within 16° of vertical (e.g. 82° -> diff 8° from 90°)
// Length 2000mm at 82°: dx = 2000 * cos(82°) = 278, dy = 2000 * sin(82°) = 1980
var pt82deg = { x: 1000 + 278, y: 1000 + 1980 };
var snap82 = ed2.snapPoint(pt82deg);
assert.strictEqual(snap82.type, 'ortho', 'Expected ortho snap at 82 degrees');
assert.strictEqual(snap82.angleDeg, 90, 'Expected vertical angle 90°');
assert.strictEqual(snap82.pt.x, 1000, 'Expected snapped X to remain strictly vertical (1000)');
assert.strictEqual(snap82.label, '↕ Vertical', 'Expected Vertical label');
console.log('✓ 2b PASSED: 16° magnetic pull locks 82° hand tremor strictly to vertical.');

// 2c. Shift-Key strict lock on wide angle (e.g. 35° normally non-ortho)
var pt35deg = { x: 1000 + 1638, y: 1000 + 1147 };
ed2.isShiftDown = false;
var snapNoShift = ed2.snapPoint(pt35deg);
// At 35°, diff from 0° is 35° (0.61 rad) and from 45° is 10° (0.17 rad) -> not ortho
assert.notStrictEqual(snapNoShift.type, 'ortho', 'At 35° without Shift, should not lock to ortho');

ed2.isShiftDown = true;
var snapShift = ed2.snapPoint(pt35deg);
assert.strictEqual(snapShift.type, 'ortho', 'With Shift held, must strictly lock to ortho');
assert.strictEqual(snapShift.angleDeg, 0, 'Closest ortho is 0°');
assert.strictEqual(snapShift.pt.y, 1000, 'Y locked to horizontal');
console.log('✓ 2c PASSED: Shift-Key overrides and strictly locks drawing to orthogonal axes.\n');


// ─── TEST 3: Precision CAD Crosshair Reticle (+) Rendering ───
console.log('[TEST 3] Verifying Precision CAD Crosshair Reticle (+) Rendering...');
const { ed: ed3, canvas: canvas3 } = createFreshEditor();
const ctx3 = canvas3.getContext();

// 3a. Reticle before drawing first wall (hover mode)
ctx3._calls.length = 0;
ed3.renderCrosshairReticle(ctx3, { x: 500, y: 500 }, { type: 'grid', label: 'Grid' }, false);
assert(ctx3._calls.length > 10, 'Expected canvas draw calls for crosshair reticle');
const strokeCallsHover = ctx3._calls.filter(c => c.op === 'stroke');
assert(strokeCallsHover.length >= 2, 'Expected white halo and colored core strokes');
const fillTextHover = ctx3._calls.filter(c => c.op === 'fillText');
assert(fillTextHover.some(c => c.args[0] && c.args[0].includes('+ Click to start wall')), 'Expected tooltip badge text "+ Click to start wall"');
console.log('✓ 3a PASSED: Crosshair reticle rendered with white halo and "+ Click to start wall" badge.');

// 3b. Reticle while chaining walls with ortho horizontal lock
ctx3._calls.length = 0;
ed3.renderCrosshairReticle(ctx3, { x: 2500, y: 500 }, { type: 'ortho', angleDeg: 0, distMm: 2000, label: '↔ Horizontal' }, true);
const fillTextOrtho = ctx3._calls.filter(c => c.op === 'fillText');
assert(fillTextOrtho.some(c => c.args[0] && c.args[0].includes('↔ Horizontal')), 'Expected tooltip badge text to show ↔ Horizontal');
console.log('✓ 3b PASSED: Crosshair reticle rendered at wall tip with ↔ Horizontal badge.');

// 3c. Reticle on loop close
ctx3._calls.length = 0;
ed3.renderCrosshairReticle(ctx3, { x: 500, y: 500 }, { type: 'joint', isChainClose: true, label: 'Close Room Loop' }, true);
const fillTextClose = ctx3._calls.filter(c => c.op === 'fillText');
assert(fillTextClose.some(c => c.args[0] && c.args[0].includes('Close Room Loop')), 'Expected tooltip badge text to show Close Room Loop');
console.log('✓ 3c PASSED: Crosshair reticle rendered with vibrant Close Room Loop badge.\n');


// ─── TEST 4: Easy Wall Completion Mechanisms ───
console.log('[TEST 4] Verifying Easy Wall Completion Mechanisms...');

// 4a. Completing 4-wall room automatically terminates chain and detects room
const { ed: ed4, proj: proj4 } = createFreshEditor();
ed4.setTool('wall');

// Draw 4 walls forming 4m x 3m rectangle
ed4.handleWallMouseDown({ x: 0, y: 0 }); // Pt 1: chain start
assert.deepStrictEqual(ed4.wallChainStart, { x: 0, y: 0 });
assert.deepStrictEqual(ed4.wallChainFirstPoint, { x: 0, y: 0 });

ed4.handleWallMouseDown({ x: 4000, y: 0 }); // Wall 1 -> chain at (4000, 0)
assert.strictEqual(proj4.plan.walls.length, 1);
assert.deepStrictEqual(ed4.wallChainStart, { x: 4000, y: 0 });

ed4.handleWallMouseDown({ x: 4000, y: 3000 }); // Wall 2 -> chain at (4000, 3000)
assert.strictEqual(proj4.plan.walls.length, 2);

ed4.handleWallMouseDown({ x: 0, y: 3000 }); // Wall 3 -> chain at (0, 3000)
assert.strictEqual(proj4.plan.walls.length, 3);

// Click back on start point (0, 0) -> loop closes!
ed4.handleWallMouseDown({ x: 0, y: 0 }); // Wall 4 -> closes loop!
assert.strictEqual(proj4.plan.walls.length, 4, 'Expected 4 walls drawn');
assert.strictEqual(ed4.wallChainStart, null, 'Wall chain must be cleanly terminated upon loop close');
assert.strictEqual(ed4.wallChainFirstPoint, null, 'wallChainFirstPoint must be reset');
assert(proj4.plan.rooms && proj4.plan.rooms.length >= 1, 'Room detection must automatically create the enclosed room');
console.log('✓ 4a PASSED: 4-wall room closed, room automatically detected, chain cleanly finished.');

// 4b. Clicking same point (<40mm) finishes wall chain
const { ed: ed4b } = createFreshEditor();
ed4b.setTool('wall');
ed4b.handleWallMouseDown({ x: 1000, y: 1000 });
assert(ed4b.wallChainStart !== null);
ed4b.handleWallMouseDown({ x: 1010, y: 1010 }); // distance ~14mm < 40mm
assert.strictEqual(ed4b.wallChainStart, null, 'Clicking same spot must cleanly finish wall chain');
console.log('✓ 4b PASSED: Clicking same point finishes wall chain.');

// 4c. Double-click canvas finishes wall chain
const { ed: ed4c, canvas: canvas4c } = createFreshEditor();
ed4c.setTool('wall');
ed4c.wallChainStart = { x: 1000, y: 1000 };
ed4c.wallChainFirstPoint = { x: 500, y: 500 };
var dblclickListeners = canvas4c._getListeners('dblclick');
assert(dblclickListeners.length > 0, 'Expected dblclick listener on canvas');
dblclickListeners[0]({});
assert.strictEqual(ed4c.wallChainStart, null, 'Double-click must cleanly finish wall chain');
assert.strictEqual(ed4c.wallChainFirstPoint, null, 'Double-click must reset wallChainFirstPoint');
console.log('✓ 4c PASSED: Double-click finishes wall chain.');

// 4d. Escape key finishes wall chain
const { ed: ed4d } = createFreshEditor();
ed4d.setTool('wall');
ed4d.wallChainStart = { x: 1000, y: 1000 };
ed4d.wallChainFirstPoint = { x: 500, y: 500 };
var keydownListeners = (global._winListeners && global._winListeners['keydown']) || [];
assert(keydownListeners.length > 0, 'Expected keydown listener');
var escCb = keydownListeners[keydownListeners.length - 1];
escCb({ target: { tagName: 'CANVAS' }, key: 'Escape' });
assert.strictEqual(ed4d.wallChainStart, null, 'Escape must cleanly finish wall chain');
assert.strictEqual(ed4d.wallChainFirstPoint, null, 'Escape must reset wallChainFirstPoint');
console.log('✓ 4d PASSED: Escape finishes wall chain.');

// 4e. Enter key with empty buffer finishes wall chain
const { ed: ed4e } = createFreshEditor();
ed4e.setTool('wall');
ed4e.wallChainStart = { x: 1000, y: 1000 };
ed4e.wallChainFirstPoint = { x: 500, y: 500 };
ed4e.numericInputBuffer = '';
var enterCb = (global._winListeners && global._winListeners['keydown'])[global._winListeners['keydown'].length - 1];
enterCb({ target: { tagName: 'CANVAS' }, key: 'Enter', preventDefault: function () {} });
assert.strictEqual(ed4e.wallChainStart, null, 'Enter key must cleanly finish wall chain');
assert.strictEqual(ed4e.wallChainFirstPoint, null, 'Enter key must reset wallChainFirstPoint');
console.log('✓ 4e PASSED: Enter key finishes wall chain.\n');


// ─── TEST 5: Canvas Cursor Management ───
console.log('[TEST 5] Verifying Canvas Cursor Management...');
const { ed: ed5, canvas: canvas5 } = createFreshEditor();
ed5.setTool('wall');
assert.strictEqual(canvas5.style.cursor, 'crosshair', 'Wall tool must set cursor to "crosshair"');

ed5.setTool('dimension');
assert.strictEqual(canvas5.style.cursor, 'crosshair', 'Dimension tool must set cursor to "crosshair"');

ed5.setTool('select');
assert.strictEqual(canvas5.style.cursor, 'default', 'Select tool must set cursor to "default"');
console.log('✓ TEST 5 PASSED: Canvas cursor changes dynamically to "crosshair" during drawing.\n');

console.log('======================================================================');
console.log('ALL TESTS PASSED: 2D Wall Drawing Accuracy & Crosshair Reticle Ready!');
console.log('======================================================================');
