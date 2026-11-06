const assert = require('assert');
const fs = require('fs');

// Setup mock browser environment
function mockElement() {
  return {
    innerHTML: '',
    style: {},
    options: [],
    querySelector: function() { return null; },
    addEventListener: function() {},
    querySelectorAll: function() { return []; },
    appendChild: function() {},
    removeChild: function() {},
    getBoundingClientRect: function() { return { left: 0, top: 0, width: 800, height: 600 }; },
    getContext: function() {
      return {
        save: function() {},
        restore: function() {},
        beginPath: function() {},
        closePath: function() {},
        moveTo: function() {},
        lineTo: function() {},
        stroke: function() {},
        fill: function() {},
        fillRect: function() {},
        strokeRect: function() {},
        clearRect: function() {},
        scale: function() {},
        translate: function() {},
        rotate: function() {},
        arc: function() {},
        setLineDash: function() {},
        fillText: function() {},
        measureText: function() { return { width: 40 }; }
      };
    }
  };
}

global.window = global;
global.window.addEventListener = function() {};
global.document = {
  getElementById: function(id) { return mockElement(); },
  createElement: function() { return mockElement(); },
  querySelectorAll: function() { return []; },
  querySelector: function() { return null; },
  addEventListener: function() {}
};
global.localStorage = {
  getItem: function() { return null; },
  setItem: function() {},
  removeItem: function() {}
};

const Core = require('../orbix-core.js');
global.Core = Core;
global.OrbixCore = Core;

const PlanModule = require('../orbix-plan.js');
const PlanEditor = PlanModule.PlanEditor || PlanModule;
global.PlanEditor = PlanEditor;
global.OrbixPlan = PlanEditor;

const uiCode = fs.readFileSync('orbix-ui.js', 'utf8');
eval(uiCode);
const OrbixUI = global.window.OrbixUI;

console.log('--- Testing BOQ Rendering with 7 Placed Units Including Decors & Custom Units ---');

const project = Core.createProject('7 Unit Client Project', 'Aravind');
// Add 7 units: base units, wall units, and decor items (e.g. fridge, plant, etc.)
project.plan.furniture = [
  Core.createFurniturePlacement({ id: 'u1', name: 'Base FM75', category: 'kitchen_base', dimensions: { W: 750, H: 850, D: 560 } }),
  Core.createFurniturePlacement({ id: 'u2', name: 'Wall WM30', category: 'kitchen_wall', dimensions: { W: 300, H: 720, D: 320 } }),
  Core.createFurniturePlacement({ id: 'u3', name: 'Double Door Fridge', category: 'decor', isDecor: true, excludeFromPricing: true, dimensions: { W: 900, H: 1800, D: 700 } }),
  Core.createFurniturePlacement({ id: 'u4', name: 'Indoor Plant', category: 'decor', isDecor: true, excludeFromPricing: true, dimensions: { W: 400, H: 1200, D: 400 } }),
  Core.createFurniturePlacement({ id: 'u5', name: 'Wardrobe 3 Door', category: 'wardrobe', dimensions: { W: 1500, H: 2100, D: 600 } }),
  Core.createFurniturePlacement({ id: 'u6', name: 'Beverage Chiller', category: 'appliance_decor', isDecor: true, excludeFromPricing: true }),
  Core.createFurniturePlacement({ id: 'u7', name: 'TV Console 1200', category: 'tv_unit', dimensions: { W: 1200, H: 450, D: 400 } })
];

OrbixUI.project = project;

// Calling renderBOQ should complete smoothly without any toFixed error
assert.doesNotThrow(() => {
  OrbixUI.renderBOQ();
}, 'renderBOQ must execute without throwing Cannot read properties of undefined (reading toFixed)');

console.log('✓ renderBOQ successfully rendered with 7 units (including decor & custom units) with 0 errors!');
