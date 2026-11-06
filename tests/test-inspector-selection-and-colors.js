/**
 * Test: 2D Unit Inspector Selection & Hex Color Sanitization
 *
 * Verifies:
 * 1. toValidHexColor converts laminate codes (MDF 7709, MDF 1135, etc.) and color names (BLUE, etc.)
 *    to valid 7-character #rrggbb hex codes.
 * 2. renderInspector safely handles units with raw laminate codes in shutterColors or shutterCol.
 * 3. <input type="color"> values are ALWAYS valid 7-character hex colors matching /^#[0-9a-fA-F]{6}$/.
 * 4. Missing DOM elements in renderInspector do not throw null pointer exceptions.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser environment
class MockElement {
  constructor(tag, id = '', className = '') {
    this.tagName = tag.toUpperCase();
    this.id = id;
    this.className = className;
    this.innerHTML = '';
    this.value = '';
    this.checked = false;
    this.style = {};
    this.attributes = {};
    this.children = [];
    this.options = [];
    this._listeners = {};
    this.dataset = {};
  }
  setAttribute(k, v) {
    this.attributes[k] = String(v);
    if (k === 'id') this.id = v;
    if (k === 'class') this.className = v;
    if (k === 'value') this.value = v;
  }
  appendChild(child) {
    this.children.push(child);
  }
  removeChild(child) {
    this.children = this.children.filter(c => c !== child);
  }
  getContext() {
    return {
      save: () => {}, restore: () => {}, beginPath: () => {}, closePath: () => {},
      stroke: () => {}, fill: () => {}, clearRect: () => {}, fillRect: () => {},
      strokeRect: () => {}, moveTo: () => {}, lineTo: () => {}, arc: () => {},
      scale: () => {}, translate: () => {}, rotate: () => {}, setLineDash: () => {},
      fillText: () => {}, measureText: () => ({ width: 10 })
    };
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 800, height: 600 };
  }
  getAttribute(k) {
    return this.attributes[k] !== undefined ? this.attributes[k] : (k === 'value' ? this.value : null);
  }
  addEventListener(evt, fn) {
    if (!this._listeners[evt]) this._listeners[evt] = [];
    this._listeners[evt].push(fn);
  }
  dispatchEvent(evt) {
    var list = this._listeners[evt.type] || [];
    for (var i = 0; i < list.length; i++) list[i](evt);
  }
  querySelector(sel) {
    var res = this.querySelectorAll(sel);
    return res.length > 0 ? res[0] : null;
  }
  querySelectorAll(sel) {
    var matches = [];
    function search(html) {
      var tagRegex = /<([a-zA-Z0-9]+)([^>]*)>/g;
      var m;
      while ((m = tagRegex.exec(html)) !== null) {
        var tag = m[1];
        var attrs = m[2];
        var el = new MockElement(tag);
        var attrRegex = /([a-zA-Z0-9_-]+)(?:=["']([^"']*)["'])?/g;
        var am;
        while ((am = attrRegex.exec(attrs)) !== null) {
          if (am[1]) el.setAttribute(am[1], am[2] || '');
        }
        var match = false;
        if (sel.startsWith('.')) {
          var cls = sel.slice(1);
          if (el.className && el.className.split(/\s+/).includes(cls)) match = true;
        } else if (sel.startsWith('#')) {
          var id = sel.slice(1);
          if (el.id === id) match = true;
        } else if (sel.toLowerCase() === tag.toLowerCase()) {
          match = true;
        }
        if (match) matches.push(el);
      }
    }
    search(this.innerHTML);
    return matches;
  }
}

const mockElements = {};
global.window = global;
global.window.addEventListener = function () {};
global.document = {
  getElementById: function (id) {
    if (!mockElements[id]) {
      mockElements[id] = new MockElement('div', id);
    }
    return mockElements[id];
  },
  createElement: function (tag) {
    return new MockElement(tag);
  },
  querySelectorAll: function (sel) {
    return [];
  },
  querySelector: function (sel) {
    return null;
  },
  addEventListener: function () {}
};
global.localStorage = {
  getItem: () => null,
  setItem: () => {},
  removeItem: () => {}
};

// Load OrbixCore and OrbixPlan
const Core = require('../orbix-core.js');
global.Core = Core;
global.OrbixCore = Core;

const PlanModule = require('../orbix-plan.js');
const PlanEditor = PlanModule.PlanEditor || PlanModule;
global.PlanEditor = PlanEditor;
global.OrbixPlan = PlanEditor;

const uiCode = fs.readFileSync(path.join(__dirname, '..', 'orbix-ui.js'), 'utf8');
eval(uiCode);
const OrbixUI = global.window.OrbixUI;

console.log('--- Testing toValidHexColor ---');

const hexRegex = /^#[0-9a-fA-F]{6}$/;

const testCases = [
  { input: '#1e3a8a', expected: '#1e3a8a' },
  { input: '#2563EB', expected: '#2563EB' },
  { input: '#fff', expected: '#ffffff' },
  { input: '1e3a8a', expected: '#1e3a8a' },
  { input: 'MDF 7709', expected: '#6b6e45' },
  { input: 'BLUE', expected: '#2e3f5c' },
  { input: 'Navy Blue Matte', expected: '#2e3f5c' },
  { input: 'MDF 1135', expected: '#edebe4' },
  { input: 'MDF 3410', expected: '#6e4e35' },
  { input: 'MDF 2204', expected: '#c4a173' },
  { input: 'Sage Green Matte', expected: '#8e9c86' },
  { input: 'Concrete Look', expected: '#a8a5a0' },
  { input: 'Unknown Finish 9999', expected: '#edebe4' }
];

testCases.forEach(({ input, expected }) => {
  const result = OrbixCore.toValidHexColor(input);
  assert(hexRegex.test(result), `Output for "${input}" must be valid 6-char hex, got: "${result}"`);
  assert.strictEqual(result.toLowerCase(), expected.toLowerCase(), `Output for "${input}" expected "${expected}", got: "${result}"`);
  console.log(`✓ toValidHexColor("${input}") -> "${result}"`);
});

console.log('\n--- Testing renderInspector with non-conforming shutter finishes ---');

// Set up UI mock
const panel = new MockElement('div', 'planInspectorContent');
mockElements['planInspectorContent'] = panel;

OrbixUI.project = {
  plan: {
    furniture: [
      {
        id: 'furn-test-1',
        name: 'FM75 Base Unit',
        category: 'kitchen_base',
        dimensions: { W: 750, H: 850, D: 600 },
        unitConfig: { shutters: 2, drawers: 0, shutterCol: 'BLUE' },
        materials: {
          shutter: { material: 'HDHMR_18MM', finish: 'MDF 7709' },
          carcass: { material: 'BWP_18MM', finish: 'MDF 1135' }
        },
        shutterColors: ['MDF 7709', 'BLUE']
      }
    ],
    walls: [],
    openings: [],
    rooms: []
  }
};

OrbixUI.editor = {
  selected: { type: 'furniture', id: 'furn-test-1' },
  pushHistory: () => {},
  render: () => {},
  deleteSelected: () => {}
};

// Render the inspector
assert.doesNotThrow(() => {
  OrbixUI.renderInspector({ type: 'furniture', id: 'furn-test-1' });
}, 'renderInspector should not throw even with non-hex shutter colors or missing DOM elements');

console.log('✓ renderInspector completed without throwing any errors');

// Inspect generated HTML for <input type="color"
const html = panel.innerHTML;
assert(html.length > 0, 'Inspector HTML should not be empty');

const colorInputRegex = /<input[^>]+type=["']color["'][^>]*>/gi;
const colorInputs = html.match(colorInputRegex) || [];
assert(colorInputs.length > 0, 'Should contain color inputs');

console.log(`Found ${colorInputs.length} color inputs in rendered inspector:`);
colorInputs.forEach((inpStr, idx) => {
  console.log(`  [${idx + 1}] ${inpStr}`);
  const valMatch = inpStr.match(/value=["']([^"']+)["']/i);
  assert(valMatch, `Color input must have value attribute: ${inpStr}`);
  const val = valMatch[1];
  assert(hexRegex.test(val), `Color input value "${val}" MUST match /^#[0-9a-fA-F]{6}$/ to prevent browser console warnings!`);
  assert(!val.includes('MDF 7709'), 'Color input must not contain raw laminate name "MDF 7709"');
  assert(!val.includes('BLUE'), 'Color input must not contain raw string "BLUE"');
});

console.log('✓ All <input type="color"> values are strictly conforming #rrggbb hex values');

console.log('\n--- ALL UNIT INSPECTOR & COLOR WARNING TESTS PASSED! ---');
