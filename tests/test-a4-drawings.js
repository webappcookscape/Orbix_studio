// Test OrbixA4Drawings Engine
const assert = require('assert');
const fs = require('fs');
const path = require('path');

// Mock browser window/document
global.window = global;
global.document = {
  getElementById: function(id) { return null; },
  createElement: function(tag) { return { classList: { add: function(){}, remove: function(){} } }; }
};

// Load orbix-a4-drawings.js
require('../orbix-a4-drawings.js');

console.log('Testing OrbixA4Drawings initialization...');
assert.ok(global.OrbixA4Drawings, 'OrbixA4Drawings must be defined on window');

console.log('Testing generateAllPages...');
const pages = global.OrbixA4Drawings.generateAllPages();
assert.ok(Array.isArray(pages), 'generateAllPages must return an array');
assert.ok(pages.length >= 8, 'Must generate at least 8 core pages matching reference PDF');

pages.forEach((p, idx) => {
  assert.ok(p.svg, `Page ${idx + 1} must have svg output`);
  assert.ok(p.svg.includes('<svg'), `Page ${idx + 1} SVG must include <svg tag`);
  assert.ok(p.svg.includes('COOKSCAPE'), `Page ${idx + 1} must include Cookscape company branding`);
  assert.ok(p.svg.includes('PAGE NO'), `Page ${idx + 1} must include PAGE NO`);
  assert.ok(p.svg.includes('DWG') || p.svg.includes('PRODUCTION DETAILS'), `Page ${idx + 1} must include DWG title or production details`);
});
console.log(`✓ Generated ${pages.length} pages matching reference PDF templates!`);

// Test page 1 contains floor plan elements
const p1 = pages[0];
assert.ok(p1.svg.includes('WINDOW — 1205'), 'Page 1 must include window dimension');
assert.ok(p1.svg.includes('GAS 560'), 'Page 1 must include gas hob');
assert.ok(p1.svg.includes('SINK 750'), 'Page 1 must include sink unit');
console.log('✓ Page 1 (2D Floor Plan) validated.');

// Test page 2 contains 3D Axonometric & Detail
const p2 = pages[1];
assert.ok(p2.svg.includes('3D AXONOMETRIC VIEW'), 'Page 2 must include 3D axonometric header');
assert.ok(p2.svg.includes('WFM600 — DETAILED DRAWING'), 'Page 2 must include WFM600 detail');
console.log('✓ Page 2 (3D Overview & WFM600) validated.');

// Test page 3 contains External and Internal View
const p3 = pages[2];
assert.ok(p3.svg.includes('EXTERNAL VIEW'), 'Page 3 must include EXTERNAL VIEW');
assert.ok(p3.svg.includes('INTERNAL VIEW'), 'Page 3 must include INTERNAL VIEW');
assert.ok(p3.svg.includes('110 RCC BASE'), 'Page 3 must include RCC plinth base');
console.log('✓ Page 3 (Dual Elevation External/Internal) validated.');

// Test page 6 contains Pooja CNC Cut
const p6 = pages[5];
assert.ok(p6.svg.includes('ॐ'), 'Page 6 must include Om symbol in Pooja mandala');
assert.ok(p6.svg.includes('CNC CUT'), 'Page 6 must include CNC cut callout');
console.log('✓ Page 6 (Pooja CNC Cut) validated.');

console.log('All OrbixA4Drawings tests passed 100% successfully!');
