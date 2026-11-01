const assert = require('assert');
const Core = require('../orbix-core.js');
const PlanEditor = require('../orbix-plan.js');

console.log('--- RUNNING ORBIX 2D UNDERLAY & UNIT CONVERSION TESTS ---');

// Mock DOM container for Node testing
const mockCanvas = {
  style: {},
  getContext: () => ({
    scale: () => {},
    clearRect: () => {},
    fillRect: () => {},
    beginPath: () => {},
    moveTo: () => {},
    lineTo: () => {},
    stroke: () => {},
    fill: () => {},
    closePath: () => {},
    save: () => {},
    restore: () => {},
    setLineDash: () => {},
    drawImage: () => {},
    strokeRect: () => {},
    measureText: () => ({ width: 50 }),
    fillText: () => {}
  }),
  addEventListener: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 })
};

const mockContainer = {
  innerHTML: '',
  style: {},
  clientWidth: 800,
  clientHeight: 600,
  appendChild: (el) => el
};

// Override document.createElement for PlanEditor initDOM
global.document = {
  createElement: (tag) => {
    if (tag === 'canvas') return mockCanvas;
    return { style: {}, appendChild: () => {}, addEventListener: () => {} };
  }
};
global.window = {
  devicePixelRatio: 1,
  addEventListener: () => {}
};

const editor = new PlanEditor(mockContainer, {});

// 1. Test unit system toggle and formatting
assert.strictEqual(editor.unitSystem, 'mm', 'Default unit should be mm');
assert.strictEqual(editor.formatDim(3000), '3,000 mm', '3000mm in metric');
assert.strictEqual(editor.formatDim(150), '150 mm', '150mm in metric');

editor.unitSystem = 'imperial';
assert.strictEqual(editor.formatDim(3048), "10'", '3048mm should format to 10\'');
assert.strictEqual(editor.formatDim(3000), "9' 10\"", '3000mm should format to 9\' 10"');
assert.strictEqual(editor.formatDim(914.4), "3'", '914.4mm should format to 3\'');
console.log('✓ 2D Unit formatting (mm ⇄ ft-in) verified successfully');

// 2. Test parseDimInput
editor.unitSystem = 'mm';
assert.strictEqual(editor.parseDimInput('3000'), 3000, 'Parse plain 3000 in mm');
assert.strictEqual(editor.parseDimInput('2500mm'), 2500, 'Parse 2500mm in mm');
assert.strictEqual(editor.parseDimInput("10'"), 3048, "Parse 10' in mm");
assert.strictEqual(editor.parseDimInput("10' 6\""), 3200, "Parse 10' 6\" in mm");
assert.strictEqual(editor.parseDimInput('120"'), 3048, 'Parse 120" in mm');
assert.strictEqual(editor.parseDimInput('10ft'), 3048, 'Parse 10ft in mm');

editor.unitSystem = 'imperial';
assert.strictEqual(editor.parseDimInput("12'"), 3658, "Parse 12' in imperial mode");
assert.strictEqual(editor.parseDimInput("10' 6\""), 3200, "Parse 10' 6\" in imperial mode");
console.log('✓ Imperial & Metric length string parser verified successfully');

// 3. Test Underlay state and Scale Calibration Math
assert(editor.underlay, 'Underlay object should exist');
editor.underlay.scale = 10; // 10 mm per pixel
editor.underlay.img = { naturalWidth: 2000, naturalHeight: 1500 };
editor.underlay.width = 2000;
editor.underlay.height = 1500;

// Simulate user clicking 2 points on a known wall of 500 pixels on image
// At scale 10, world distance between points is 500 * 10 = 5000 mm
const ptA = { x: 0, y: 0 };
const ptB = { x: 5000, y: 0 };
const worldDist = Core.Vec2.dist(ptA, ptB);
assert.strictEqual(worldDist, 5000);

const measuredPixelDist = Math.round(worldDist / editor.underlay.scale);
assert.strictEqual(measuredPixelDist, 500, 'Measured image pixels should be 500 px');

// User inputs real dimension: 4000 mm
const realInputMm = editor.parseDimInput('4000');
const calibratedScale = realInputMm / measuredPixelDist;
assert.strictEqual(calibratedScale, 8, 'Calibrated scale should be 4000 / 500 = 8 mm/px');
editor.underlay.scale = calibratedScale;

// Verify calibrated dimension
assert.strictEqual(measuredPixelDist * editor.underlay.scale, 4000, 'Pixel dist * new scale = 4000 mm');
console.log('✓ Underlay 2-point scale calibration math verified successfully');

console.log('ALL ORBIX 2D UNDERLAY & UNIT CONVERSION TESTS PASSED!');
