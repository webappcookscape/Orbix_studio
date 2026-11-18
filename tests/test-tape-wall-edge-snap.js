/**
 * Automated Verification Suite:
 * 2D Tape Measurement ('dimension' tool) Wall Black-Border & Corner Snapping
 * Ensures measurements start and end on visible wall black edge lines (never inside brown wall centerlines).
 */

const assert = require('assert');

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
        } else if (val) this.classes.add(c);
        else this.classes.delete(c);
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
      cbs.forEach(function (cb) { cb(evt); });
    },
    appendChild: function () {},
    setAttribute: function (k, v) { this[k] = v; },
    getAttribute: function (k) { return this[k] || null; },
    querySelector: function () { return null; },
    querySelectorAll: function () { return []; },
    getBoundingClientRect: function () { return { left: 0, top: 0, width: 1000, height: 800 }; },
    getContext: function () {
      return {
        createPattern: function () {},
        fillRect: function () {},
        strokeRect: function () {},
        rect: function () {},
        clip: function () {},
        drawImage: function () {},
        createImageData: function (w, h) { return { data: new Uint8Array((w || 64) * (h || 64) * 4) }; },
        putImageData: function () {},
        createLinearGradient: function () { return { addColorStop: function () {} }; },
        beginPath: function () {},
        closePath: function () {},
        fill: function () {},
        stroke: function () {},
        arc: function () {},
        save: function () {},
        restore: function () {},
        translate: function () {},
        rotate: function () {},
        scale: function () {},
        moveTo: function () {},
        lineTo: function () {},
        bezierCurveTo: function () {},
        quadraticCurveTo: function () {},
        setLineDash: function () {},
        measureText: function (txt) { return { width: (txt || '').length * 8 }; },
        strokeText: function () {},
        fillText: function () {},
        roundRect: function () {},
        clearRect: function () {}
      };
    }
  };
}

global.window = {
  addEventListener: function () {},
  dispatchEvent: function () {}
};

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

function createRoomEditor() {
  var proj = Core.createProject('Tape Snap Test');
  // 4000 x 3000 mm centerline closed room, 150 mm thick walls (halfT = 75 mm)
  proj.plan.walls.push(
    Core.createWall({ id: 'wTop', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 150 }),
    Core.createWall({ id: 'wRight', start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, thickness: 150 }),
    Core.createWall({ id: 'wBottom', start: { x: 4000, y: 3000 }, end: { x: 0, y: 3000 }, thickness: 150 }),
    Core.createWall({ id: 'wLeft', start: { x: 0, y: 3000 }, end: { x: 0, y: 0 }, thickness: 150 })
  );
  // Room polygon uses centerline vertices (previously broke tape snap by trapping clicks on centerline)
  proj.plan.rooms.push({
    id: 'room_1',
    name: 'Kitchen',
    polygon: [
      { x: 0, y: 0 },
      { x: 4000, y: 0 },
      { x: 4000, y: 3000 },
      { x: 0, y: 3000 }
    ]
  });
  var container = mockEl('planContainer');
  var ed = new PlanEditor(container, { project: proj });
  ed.activeTool = 'dimension';
  return ed;
}

console.log('=== TEST SUITE: 2D Tape Measurement Black-Border Wall Snapping ===\n');

// Test 1: Snapping near and inside brown wall body snaps to black edge line, never centerline
(function testWallBorderSnapNeverCenterline() {
  var ed = createRoomEditor();

  // Slightly inside room near right wall's inner black border (x = 3925)
  var s1 = ed.snapPoint({ x: 3918, y: 1500 });
  assert.strictEqual(s1.type, 'tape_wall_face');
  assert.strictEqual(Math.round(s1.pt.x), 3925, 'Inner side hover must snap to x=3925 black line');
  assert.strictEqual(Math.round(s1.pt.y), 1500);

  // Inside left half of brown wall body (between inner x=3925 and centerline x=4000)
  var s2 = ed.snapPoint({ x: 3965, y: 1500 });
  assert.strictEqual(Math.round(s2.pt.x), 3925, 'Inside brown wall must snap to nearest black line x=3925, not x=4000');

  // Inside right half of brown wall body (between centerline x=4000 and outer x=4075)
  var s3 = ed.snapPoint({ x: 4040, y: 1500 });
  assert.strictEqual(Math.round(s3.pt.x), 4075, 'Outer half of wall must snap to outer black line x=4075');

  // Directly on wall centerline (x = 4000)
  var sCenter = ed.snapPoint({ x: 4000, y: 1500 });
  assert.notStrictEqual(Math.round(sCenter.pt.x), 4000, 'Exact centerline click must still resolve to a black border line');
  assert.ok(Math.round(sCenter.pt.x) === 3925 || Math.round(sCenter.pt.x) === 4075);

  console.log('✓ Test 1 PASSED: Hover & click inside brown wall snap strictly to black border lines.');
})();

// Test 2: Full two-click measurement measures clear wall-to-wall span (3850mm), starting/ending on black lines
(function testTwoClickDimensionSpan() {
  var ed = createRoomEditor();

  // Click 1 inside left brown wall near left room face (centerline x=0, inner black edge x=75)
  ed.handleDimensionMouseDown({ x: 55, y: 1500 });
  assert.ok(ed.dimensionStart, 'dimensionStart should be set after first click');
  assert.strictEqual(Math.round(ed.dimensionStart.x), 75, 'Tape p1 must start on inner black border line x=75, not x=0');

  // Click 2 near right wall inner black edge (centerline x=4000, inner black edge x=3925)
  ed.handleDimensionMouseDown({ x: 3955, y: 1510 });
  assert.strictEqual(ed.dimensionStart, null, 'dimensionStart should reset after second click');
  assert.ok(ed.lastTapeMeasure, 'lastTapeMeasure should be populated');
  assert.strictEqual(Math.round(ed.lastTapeMeasure.p1.x), 75, 'Final p1 stays on black line x=75');
  assert.strictEqual(Math.round(ed.lastTapeMeasure.p2.x), 3925, 'Final p2 lands on black line x=3925');
  assert.strictEqual(ed.lastTapeMeasure.distMm, 3850, 'Clear wall-to-wall span should be 3850 mm');

  console.log('✓ Test 2 PASSED: Two-click tape measurement starts/ends on black lines and computes 3850mm.');
})();

// Test 3: L-corner inner and outer black corner snapping (never buried centerline endpoints)
(function testLCornerBorders() {
  var ed = createRoomEditor();

  // Near top-right inner corner (x=3925, y=75)
  var sIn = ed.snapPoint({ x: 3915, y: 85 });
  assert.strictEqual(sIn.type, 'tape_wall_corner');
  assert.strictEqual(Math.round(sIn.pt.x), 3925);
  assert.strictEqual(Math.round(sIn.pt.y), 75);

  // Near top-right outer corner (x=4075, y=-75)
  var sOut = ed.snapPoint({ x: 4082, y: -82 });
  assert.strictEqual(sOut.type, 'tape_wall_corner');
  assert.strictEqual(Math.round(sOut.pt.x), 4075);
  assert.strictEqual(Math.round(sOut.pt.y), -75);

  console.log('✓ Test 3 PASSED: Inner (3925,75) and outer (4075,-75) visible L-corners snap cleanly.');
})();

// Test 4: T-junction split does not expose interior stem mouth, and snaps to stem corners
(function testTJunctionBorderSplit() {
  var proj = Core.createProject('T-Junction Tape Test');
  proj.plan.walls.push(
    Core.createWall({ id: 'wLong', start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 150 }),
    Core.createWall({ id: 'wStem', start: { x: 2000, y: 0 }, end: { x: 2000, y: 3000 }, thickness: 150 })
  );
  var ed = new PlanEditor(mockEl('planContainer'), { project: proj });
  ed.activeTool = 'dimension';

  // Hovering inside stem mouth around (2000, 70) must snap to exposed stem corner (1925, 75) or (2075, 75), NOT (2000, 75)
  var sMouth = ed.snapPoint({ x: 1995, y: 70 });
  assert.notStrictEqual(Math.round(sMouth.pt.x), 2000, 'Must not snap across hidden T-junction mouth');
  assert.strictEqual(Math.round(sMouth.pt.x), 1925);
  assert.strictEqual(Math.round(sMouth.pt.y), 75);

  // Hovering on wall outer side (y = -70) still snaps cleanly to continuous outer face (y = -75)
  var sOuter = ed.snapPoint({ x: 2000, y: -70 });
  assert.strictEqual(Math.round(sOuter.pt.x), 2000);
  assert.strictEqual(Math.round(sOuter.pt.y), -75);

  console.log('✓ Test 4 PASSED: T-junction split exposes crisp stem corners and avoids phantom interior seam.');
})();

// Test 5: Free-space >260mm from walls does not fall through to wall centerline snaps
(function testNoFallbackToCenterline() {
  var ed = createRoomEditor();
  ed.project.plan.snapToGrid = false;
  var pt = { x: 2003, y: 1507 }; // > 1000mm away from all walls
  var sFree = ed.snapPoint(pt);
  assert.strictEqual(sFree.type, 'none');
  assert.strictEqual(sFree.pt.x, 2003);
  assert.strictEqual(sFree.pt.y, 1507);

  // Also test isolated wall end cap snap
  var proj2 = Core.createProject('Isolated Wall');
  proj2.plan.walls.push(Core.createWall({ id: 'wSolo', start: { x: 500, y: 500 }, end: { x: 2500, y: 500 }, thickness: 200 }));
  var ed2 = new PlanEditor(mockEl('planContainer'), { project: proj2 });
  ed2.activeTool = 'dimension';
  // End cap at x=500 runs from y=400 to y=600 (never centerline point (500, 500)!)
  var sEndCap = ed2.snapPoint({ x: 492, y: 495 });
  assert.strictEqual(Math.round(sEndCap.pt.x), 500);
  assert.ok(Math.round(sEndCap.pt.y) === 400 || Math.round(sEndCap.pt.y) === 495, 'Free end cap edge at x=500, y=495 is valid black end-cap line');
  assert.strictEqual(sEndCap.type, 'tape_wall_face');

  console.log('✓ Test 5 PASSED: Open-space hover & exposed wall end caps behave accurately.');
})();

// Test 6: Unit edge/corner snapping still works
(function testUnitSnapCoexists() {
  var ed = createRoomEditor();
  ed.project.plan.furniture.push({
    id: 'u1',
    name: 'Base Unit',
    pos: { x: 1500, y: 1500 },
    width: 600,
    depth: 600,
    rotation: 0
  });
  var sUnitEdge = ed.snapPoint({ x: 1500, y: 1808 });
  assert.strictEqual(sUnitEdge.type, 'tape_unit_edge');
  assert.strictEqual(Math.round(sUnitEdge.pt.y), 1800);

  console.log('✓ Test 6 PASSED: Furniture unit edge/corner snapping preserved.');
})();

// Test 7: Regular wall-drawing mode ('wall') still snaps to centerlines/joints/T-junctions normally
(function testWallToolCenterlineSnapPreserved() {
  var ed = createRoomEditor();
  ed.activeTool = 'wall';
  var sWallSeg = ed.snapPoint({ x: 2000, y: 40 });
  assert.strictEqual(sWallSeg.type, 'wall_segment', 'Wall drawing mode must preserve centerline T-junction snap');
  assert.strictEqual(Math.round(sWallSeg.pt.y), 0);

  var sWallJoint = ed.snapPoint({ x: 30, y: 30 });
  assert.strictEqual(sWallJoint.type, 'joint', 'Wall drawing mode must preserve centerline joint snap');
  assert.strictEqual(Math.round(sWallJoint.pt.x), 0);
  assert.strictEqual(Math.round(sWallJoint.pt.y), 0);

  console.log('✓ Test 7 PASSED: Regular wall drawing centerline/joint snapping preserved.');
})();

console.log('\n=== ALL 2D TAPE MEASUREMENT BLACK-BORDER TESTS PASSED SUCCESSFULLY ===');
