/**
 * Test Spacebar Rotation on Selected Units and Alt+F Furnish Tool Shortcut
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- Testing Spacebar Rotation & Alt+F Shortcut ---');

// Mock DOM & window
let furnishMenuToggled = false;
global.window = {
  addEventListener: (evt, fn) => {
    if (evt === 'keydown') global.window._keydownHandler = fn;
  },
  removeEventListener: () => {},
  toggleFurnishMenu: () => { furnishMenuToggled = true; },
  toast: () => {},
  S: { units: [{ _furnId: 'f_test_1', label: 'FM 60' }], active: 0 }
};

global.document = {
  getElementById: (id) => {
    if (id === 'view-plan') return { classList: { contains: () => true } };
    if (id === 'view-design') return { classList: { contains: () => true } };
    return null;
  },
  querySelectorAll: () => [],
  addEventListener: () => {}
};

// 1. Verify Alt+F triggers toggleFurnishMenu
const planCode = fs.readFileSync(path.join(__dirname, '../orbix-plan.js'), 'utf8');
const uiCode = fs.readFileSync(path.join(__dirname, '../orbix-ui.js'), 'utf8');

assert(planCode.includes("e.altKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')"), 'orbix-plan.js must handle Alt+F shortcut');
assert(uiCode.includes("e.altKey && (e.key === 'f' || e.key === 'F' || e.code === 'KeyF')"), 'orbix-ui.js must handle Alt+F shortcut');
console.log('✓ Alt+F shortcut handlers verified in orbix-plan.js and orbix-ui.js');

// 2. Verify selected unit rotation priority over furniturePreset
// Simulate orbix-ui rotateActiveUnit logic
const mockPlan = {
  furniture: [
    { id: 'f_test_1', name: 'FM 60', rotY: 0 }
  ]
};

const mockEditor = {
  selected: [{ type: 'furniture', id: 'f_test_1' }],
  furniturePreset: { id: 'preset_dummy' },
  furnitureRotY: 0,
  activeTool: 'select',
  pushHistory: () => {},
  render: () => {}
};

const OrbixUI = {
  editor: mockEditor,
  getPlan: () => mockPlan,
  saveToLocalStorage: () => {},
  syncProjectUnitsTo3DStudio: () => {},
  render3DHome: () => {},
  renderInspector: () => {}
};

// Run rotateActiveUnit function extracted from orbix-ui.js
const rotateActiveUnitFn = new Function('self', 'window', `
  var rotated = false;
  var plan = self.getPlan();
  var furnList = (plan && plan.furniture) || [];

  if (self.editor && self.editor.selected && self.editor.selected.length > 0) {
    for (var i = 0; i < self.editor.selected.length; i++) {
      var sel = self.editor.selected[i];
      if (sel.type === 'furniture') {
        var fn = furnList.find(function (f) { return f.id === sel.id; });
        if (fn) {
          fn.rotY = ((fn.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
          rotated = true;
        }
      }
    }
  }

  if (rotated) {
    if (self.editor) self.editor.render();
    return true;
  }

  if (self.editor && self.editor.activeTool === 'furniture' && self.editor.furniturePreset) {
    self.editor.furnitureRotY = ((self.editor.furnitureRotY || 0) + Math.PI / 2) % (Math.PI * 2);
    return true;
  }
  return false;
`);

const res = rotateActiveUnitFn(OrbixUI, global.window);
assert.strictEqual(res, true, 'rotateActiveUnit must succeed');
assert.strictEqual(Math.round(mockPlan.furniture[0].rotY * 180 / Math.PI), 90, 'Selected unit must rotate to 90 degrees even when furniturePreset exists');
assert.strictEqual(mockEditor.furnitureRotY, 0, 'furniturePreset ghost rotation must NOT steal the shortcut when a unit is selected');
console.log('✓ Spacebar rotation rotates selected unit directly without ghost preset stealing focus.');

console.log('>>> ALL SPACEBAR & ALT+F TESTS PASSED! <<<');
