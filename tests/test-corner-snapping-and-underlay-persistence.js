const fs = require('fs');
const path = require('path');

// Mock browser globals
global.window = global;
global.window.addEventListener = function() {};
global.window.removeEventListener = function() {};
global.root = global;
const createMockElement = () => ({
  style: {},
  classList: { contains: () => false, add: () => {}, remove: () => {}, toggle: () => {} },
  addEventListener: () => {},
  removeEventListener: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  appendChild: () => {},
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  clientWidth: 800,
  clientHeight: 600,
  options: [],
  dataset: {},
  value: ''
});

global.document = {
  createElement: function(tag) {
    if (tag === 'canvas') {
      const mockCtx = new Proxy({
        measureText: () => ({ width: 50 })
      }, {
        get: (target, prop) => {
          if (prop in target) return target[prop];
          return () => {};
        },
        set: () => true
      });
      return {
        getContext: () => mockCtx,
        style: {},
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
        width: 800,
        height: 600
      };
    }
    return createMockElement();
  },
  getElementById: function(id) {
    return createMockElement();
  },
  querySelectorAll: function() { return []; },
  querySelector: function() { return null; },
  addEventListener: function() {},
  removeEventListener: function() {}
};
global.localStorage = (function() {
  let store = {};
  return {
    getItem: (k) => store[k] || null,
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
    clear: () => { store = {}; },
    get length() { return Object.keys(store).length; },
    key: (i) => Object.keys(store)[i] || null
  };
})();
global.Image = function() {
  this.naturalWidth = 2000;
  this.naturalHeight = 1500;
  var self = this;
  setTimeout(function() {
    if (typeof self.onload === 'function') self.onload();
  }, 10);
};

console.log('Testing Corner Snapping & Underlay Persistence...');

// 1. Load modules
const Core = require('../orbix-core.js');
global.OrbixCore = Core;
const PlanEditor = require('../orbix-plan.js');
global.OrbixPlan = PlanEditor;
require('../orbix-ui.js');

// 2. Test 1: L-Corner Units (FBCM 900x900 & WBCM 600x600) Snapping to Room Corners
const project = Core.createProject('Test Room Corner Snapping');
// Create a 5000 x 4000 room
const r1 = Core.createRoom({
  id: 'room_kitchen',
  name: 'Kitchen',
  polygon: [
    { x: 0, y: 0 },
    { x: 5000, y: 0 },
    { x: 5000, y: 4000 },
    { x: 0, y: 4000 }
  ]
});
project.plan.rooms = [r1];
project.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 5000, y: 0 }, thickness: 150 }),
  Core.createWall({ start: { x: 5000, y: 0 }, end: { x: 5000, y: 4000 }, thickness: 150 }),
  Core.createWall({ start: { x: 5000, y: 4000 }, end: { x: 0, y: 4000 }, thickness: 150 }),
  Core.createWall({ start: { x: 0, y: 4000 }, end: { x: 0, y: 0 }, thickness: 150 })
];

const mockContainer = {
  style: {},
  appendChild: () => {},
  querySelector: () => null,
  querySelectorAll: () => [],
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600 }),
  clientWidth: 800,
  clientHeight: 600
};
global.document.getElementById = function(id) {
  return {
    style: {},
    classList: { contains: () => false, add: () => {}, remove: () => {} },
    addEventListener: () => {},
    querySelector: () => null,
    querySelectorAll: () => [],
    appendChild: () => {}
  };
};
const editor = new PlanEditor(mockContainer, { project: project });

// Test FBCM (Cookscape 900x900 L-shaped corner base unit)
const fbcmPreset = Core.FURNITURE_CATALOG.find(f => f.id === 'fbcm' || (f.code && f.code.toUpperCase() === 'FBCM'));
if (!fbcmPreset) throw new Error('FBCM preset not found in catalog!');

// Test Top-Left Corner (0, 0)
// Drag candidate at (150, 150)
const snapTL = editor.snapFurniture(fbcmPreset, { x: 150, y: 150 }, 0);
console.log('Top-Left Corner snap result:', snapTL.badgeLabel, 'Pos:', snapTL.pos, 'RotY:', snapTL.rotY);
if (!snapTL.badgeLabel || !snapTL.badgeLabel.includes('Room Corner')) {
  throw new Error('FBCM failed to snap into Top-Left Room Corner!');
}
// Check that center position is inside the room (> 0)
if (snapTL.pos.x <= 0 || snapTL.pos.y <= 0) {
  throw new Error(`FBCM center position outside room: x=${snapTL.pos.x}, y=${snapTL.pos.y}`);
}
console.log('✓ FBCM snapped perfectly into Top-Left Corner');

// Test Top-Right Corner (5000, 0)
// Drag candidate at (4850, 150)
const snapTR = editor.snapFurniture(fbcmPreset, { x: 4850, y: 150 }, 0);
console.log('Top-Right Corner snap result:', snapTR.badgeLabel, 'Pos:', snapTR.pos, 'RotY:', snapTR.rotY);
if (!snapTR.badgeLabel || !snapTR.badgeLabel.includes('Room Corner')) {
  throw new Error('FBCM failed to snap into Top-Right Room Corner!');
}
if (snapTR.pos.x >= 5000 || snapTR.pos.y <= 0) {
  throw new Error(`FBCM center position outside room: x=${snapTR.pos.x}, y=${snapTR.pos.y}`);
}
console.log('✓ FBCM snapped perfectly into Top-Right Corner');

// Test Bottom-Left Corner (0, 4000)
const snapBL = editor.snapFurniture(fbcmPreset, { x: 150, y: 3850 }, 0);
console.log('Bottom-Left Corner snap result:', snapBL.badgeLabel, 'Pos:', snapBL.pos, 'RotY:', snapBL.rotY);
if (!snapBL.badgeLabel || !snapBL.badgeLabel.includes('Room Corner')) {
  throw new Error('FBCM failed to snap into Bottom-Left Room Corner!');
}
console.log('✓ FBCM snapped perfectly into Bottom-Left Corner');

// Test Bottom-Right Corner (5000, 4000)
const snapBR = editor.snapFurniture(fbcmPreset, { x: 4850, y: 3850 }, 0);
console.log('Bottom-Right Corner snap result:', snapBR.badgeLabel, 'Pos:', snapBR.pos, 'RotY:', snapBR.rotY);
if (!snapBR.badgeLabel || !snapBR.badgeLabel.includes('Room Corner')) {
  throw new Error('FBCM failed to snap into Bottom-Right Room Corner!');
}
console.log('✓ FBCM snapped perfectly into Bottom-Right Corner');

// Test WBCM (Cookscape 600x600 L-shaped corner wall unit)
const wbcmPreset = Core.FURNITURE_CATALOG.find(f => f.code === 'WBCM' || (f.id && f.id.includes('fbcm-1500')));
if (wbcmPreset) {
  const snapWBCM = editor.snapFurniture(wbcmPreset, { x: 120, y: 120 }, 0);
  console.log('WBCM Corner snap result:', snapWBCM.badgeLabel, 'Pos:', snapWBCM.pos);
  if (!snapWBCM.badgeLabel || !snapWBCM.badgeLabel.includes('Room Corner')) {
    throw new Error('WBCM failed to snap into Room Corner!');
  }
  console.log('✓ WBCM snapped perfectly into Room Corner');
}

// Test Adjacent Unit Jointing to Corner Arm
const placedCorner = Core.createFurniturePlacement({
  id: 'test_fbcm_1',
  name: 'FBCM Corner',
  category: 'kitchen_corner',
  pos: snapTL.pos,
  rotY: snapTL.rotY,
  dimensions: { W: 900, H: 850, D: 900 },
  unitConfig: { geometryType: 'l_shaped_corner', unitType: 'fbcm', corner: { enabled: true, legW: 900, legD: 900, depth: 560 } }
});
project.plan.furniture.push(placedCorner);

const baseUnit = Core.FURNITURE_CATALOG.find(f => f.category === 'kitchen_base' || f.category === 'kitchen_fm');
if (baseUnit) {
  // Drag base unit near arm 1 or arm 2
  const snapJoint = editor.snapFurniture(baseUnit, { x: snapTL.pos.x + 800, y: snapTL.pos.y }, 0);
  console.log('Base unit near corner arm snap:', snapJoint.badgeLabel, 'Type:', snapJoint.type);
  if (snapJoint.type === 'unit_joint') {
    console.log('✓ Adjacent base cabinet joints cleanly to FBCM corner unit arm!');
  }
}

// 3. Test 2: Underlay Persistence across Hard Refresh
console.log('\nTesting Floor Plan Underlay Persistence...');
const UI = global.OrbixUI;
UI.project = project;
UI.editor = editor;

// Simulate importing blueprint
editor.underlay = {
  img: new Image(),
  dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  width: 1920,
  height: 1080,
  scale: 8.5,
  x: 250,
  y: 350,
  visible: true,
  opacity: 0.65,
  calibPoints: []
};

// Persist underlay
UI.persistUnderlay();

if (!project.plan.underlay) {
  throw new Error('persistUnderlay did not write to project.plan.underlay!');
}
if (project.plan.underlay.scale !== 8.5 || project.plan.underlay.opacity !== 0.65) {
  throw new Error('project.plan.underlay scale or opacity mismatch!');
}
console.log('✓ persistUnderlay saved to project.plan.underlay and storage');

// Simulate Hard Refresh: Wipe out in-memory editor underlay
editor.underlay = { img: null, calibPoints: [] };
if (editor.underlay.img !== null) throw new Error('Failed to wipe editor in-memory state');

// Restore underlay from persisted project
UI.restoreUnderlay(project);

setTimeout(() => {
  if (!editor.underlay.img) {
    throw new Error('restoreUnderlay failed to reload image on hard refresh simulation!');
  }
  if (editor.underlay.scale !== 8.5) {
    throw new Error(`Scale not restored: expected 8.5, got ${editor.underlay.scale}`);
  }
  if (editor.underlay.x !== 250 || editor.underlay.y !== 350) {
    throw new Error(`Position not restored: expected (250, 350), got (${editor.underlay.x}, ${editor.underlay.y})`);
  }
  if (editor.underlay.opacity !== 0.65) {
    throw new Error(`Opacity not restored: expected 0.65, got ${editor.underlay.opacity}`);
  }
  console.log('✓ Underlay image and full calibration/position restored successfully across simulated hard refresh!');
  console.log('\nALL TESTS PASSED PERFECTLY!');
}, 50);
