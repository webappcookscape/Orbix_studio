// ═══════════════════════════════════════════════════════════════════════════════
// TEST: Orbix Studio – Production 2D Drawing Flow V2
// Room-wise, elevation-wise & furniture assembly-based production drawing book
// ═══════════════════════════════════════════════════════════════════════════════
const assert = require('assert');
const path = require('path');

// Mock browser environment
global.window = global;
global.document = {
  getElementById: function (id) { return null; },
  createElement: function (tag) { return { classList: { add: function () {}, remove: function () {} } }; }
};

// Load orbix-a4-drawings.js
require('../orbix-a4-drawings.js');

const Engine = global.OrbixA4Drawings;
assert.ok(Engine, 'OrbixA4Drawings must be loaded');

console.log('=== TEST 1: Default Cookscape Reference Template Sequence (16 Pages) ===');
// When project is empty, generateAllPages() produces the exact 16-page Cookscape PDF template
global.OrbixUI = { project: { plan: { walls: [], furniture: [], rooms: [] } } };
const defaultPages = Engine.generateAllPages();
assert.ok(Array.isArray(defaultPages), 'generateAllPages must return array');
assert.strictEqual(defaultPages.length, 16, `Default template must have 16 pages, found ${defaultPages.length}`);

// Verify titles of the 16 pages
const expectedTitles = [
  'Top view without loft',
  'Complete axonometric',
  'external & internal',
  'Loft only',
  'Breakfast Counter',
  'Shoe Rack',
  'Partition',
  'Seater',
  'TV Unit',
  'Crockery and Pooja',
  'Bedroom 1 Seater',
  'Foldable Ledge',
  'Walk-in',
  'Walk-in',
  'Mirror',
  'Balcony'
];

defaultPages.forEach((p, idx) => {
  assert.ok(p.svg, `Page ${idx + 1} must have SVG`);
  assert.ok(p.svg.includes('<svg'), `Page ${idx + 1} SVG must include <svg tag`);
  assert.ok(p.svg.includes('COOKSCAPE'), `Page ${idx + 1} must include Cookscape branding`);
  var expectedSub = expectedTitles[idx].toLowerCase();
  var actualTitle = (p.title || '').toLowerCase();
  assert.ok(actualTitle.includes(expectedSub) || p.svg.toLowerCase().includes(expectedSub),
    `Page ${idx + 1} title (${actualTitle}) must match expected (${expectedTitles[idx]})`);
});
console.log('✓ Verified all 16 Cookscape reference template pages in exact sequence!');

console.log('\n=== TEST 2: Intelligent Object Classification & Grouping ===');
const mockProjectData = {
  project: { meta: { clientName: 'Mr. Rajesh & Priya', title: 'Skyline Villa' } },
  walls: [
    { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 150 },
    { id: 'w2', start: { x: 3000, y: 0 }, end: { x: 3000, y: 3000 }, thickness: 150 }
  ],
  rooms: [
    { id: 'rm_kitch', name: 'Kitchen', polygon: [{ x: 0, y: 0 }, { x: 3000, y: 0 }, { x: 3000, y: 3000 }, { x: 0, y: 3000 }] },
    { id: 'rm_living', name: 'Living Room', polygon: [{ x: 3000, y: 0 }, { x: 7000, y: 0 }, { x: 7000, y: 4000 }, { x: 3000, y: 4000 }] },
    { id: 'rm_bed1', name: 'Master Bedroom', polygon: [{ x: 0, y: 3000 }, { x: 4000, y: 3000 }, { x: 4000, y: 7000 }, { x: 0, y: 7000 }] }
  ],
  furniture: [
    // Kitchen (12 base + 6 wall + 8 loft = 26 units!)
    { id: 'k_b1', name: 'SINK UNIT 750', code: 'BU01', category: 'base', room: 'Kitchen', dimensions: { W: 750, D: 600, H: 860 }, unitConfig: { hasSink: true } },
    { id: 'k_b2', name: 'CORNER UNIT 1050', code: 'BU02', category: 'base', room: 'Kitchen', dimensions: { W: 1050, D: 600, H: 860 } },
    { id: 'k_b3', name: 'GAS HOB 900', code: 'BU03', category: 'base', room: 'Kitchen', dimensions: { W: 900, D: 600, H: 860 }, unitConfig: { hasHob: true } },
    { id: 'k_w1', name: 'WALL UNIT 600', code: 'WU01', category: 'wall', room: 'Kitchen', dimensions: { W: 600, D: 350, H: 720 }, elevation: 1460 },
    { id: 'k_w2', name: 'WALL GLASS 900', code: 'WU02', category: 'wall', room: 'Kitchen', dimensions: { W: 900, D: 350, H: 720 }, elevation: 1460 },
    { id: 'k_loft1', name: 'LOFT SHUTTER 600', code: 'LU01', category: 'loft', room: 'Kitchen', dimensions: { W: 600, D: 600, H: 600 } },
    { id: 'k_loft2', name: 'LOFT SHUTTER 900', code: 'LU02', category: 'loft', room: 'Kitchen', dimensions: { W: 900, D: 600, H: 600 } },

    // Living Room (TV unit credenza + wall shelf, shoe rack)
    { id: 'liv_shoe', name: 'SHOE RACK 900', code: 'SR01', category: 'shoe_rack', room: 'Living Room', dimensions: { W: 900, D: 380, H: 1000 } },
    { id: 'liv_tv1', name: 'TV BASE UNIT', code: 'TVB01', category: 'tv_unit', room: 'Living Room', dimensions: { W: 1800, D: 450, H: 450 } },
    { id: 'liv_tv2', name: 'TV WALL SHELF', code: 'TVW01', category: 'tv_unit', room: 'Living Room', dimensions: { W: 1200, D: 250, H: 300 }, elevation: 1500 },

    // Bedroom 1 (Wardrobe 3D + Study desk)
    { id: 'bed_wrb', name: '3 DOOR WARDROBE', code: 'WRB01', category: 'wardrobe', room: 'Master Bedroom', dimensions: { W: 1500, D: 600, H: 2100 } },
    { id: 'bed_study', name: 'STUDY DESK WITH LEDGE', code: 'ST01', category: 'study', room: 'Master Bedroom', dimensions: { W: 1200, D: 550, H: 750 } }
  ]
};

assert.ok(typeof Engine.classifyProjectObjects === 'function', 'Engine must have classifyProjectObjects method');
const groups = Engine.classifyProjectObjects(mockProjectData);
assert.ok(groups.kitchen, 'Must classify kitchen group');
assert.strictEqual(groups.kitchen.baseUnits.length, 3, 'Must identify 3 kitchen base units');
assert.strictEqual(groups.kitchen.wallUnits.length, 2, 'Must identify 2 kitchen wall units');
assert.strictEqual(groups.kitchen.loftUnits.length, 2, 'Must identify 2 kitchen loft units');

assert.ok(groups.living, 'Must classify living group');
assert.strictEqual(groups.living.shoeRacks.length, 1, 'Must identify 1 shoe rack');
assert.strictEqual(groups.living.tvUnits.length, 2, 'Must group 2 TV unit components together');

console.log('✓ Intelligent Object Classification verified successfully!');

console.log('\n=== TEST 3: Dynamic Room-Wise & Elevation-Wise Generation ===');
global.OrbixUI = { project: mockProjectData };
const dynamicPages = Engine.generateAllPages();
assert.ok(Array.isArray(dynamicPages), 'Dynamic pages must be an array');

// Notice: In the old system, 11 units + 2 overview = 13 pages.
// In V2:
// Page 1: Kitchen Top View (Without Loft)
// Page 2: Kitchen Complete Axonometric Elevation (Without Loft)
// Page 3: Kitchen Combined Elevation (Base + Wall run side-by-side External & Internal)
// Page 4: Kitchen Loft Only
// Page 5: Living Shoe Rack (External & Internal)
// Page 6: Living TV Unit (Combined Base + Wall Assembly)
// Page 7: Master Bedroom Wardrobe & Study Assembly
// Page 8: Optional Manufacturing Appendix (Cutlist & Hardware)
console.log(`Generated ${dynamicPages.length} clean assembly-based elevation sheets for 11 units.`);
assert.ok(dynamicPages.length < 11, `V2 must combine connected cabinets into elevation sheets (${dynamicPages.length} sheets < 11 individual cabinets)`);

// Page 1: Kitchen Top View Without Loft
const dynP1 = dynamicPages[0];
assert.ok(dynP1.title.includes('TOP VIEW') || dynP1.title.includes('2D FLOOR PLAN'), 'Page 1 must be top view/floor plan');
assert.ok(!dynP1.svg.includes('LU01') && !dynP1.svg.includes('LU02'), 'Page 1 must exclude loft units');
console.log('✓ Page 1 excludes loft geometry as specified.');

// Page 2: Kitchen Axonometric Overview Without Loft
const dynP2 = dynamicPages[1];
assert.ok(dynP2.title.includes('AXONOMETRIC') || dynP2.title.includes('OVERVIEW'), 'Page 2 must be axonometric overview');
assert.ok(!dynP2.svg.includes('LU01'), 'Page 2 must exclude loft geometry');
console.log('✓ Page 2 excludes loft geometry as specified.');

// Page 3: Kitchen Combined Elevation
const dynP3 = dynamicPages[2];
assert.ok(dynP3.svg.includes('EXTERNAL VIEW'), 'Page 3 must include EXTERNAL VIEW');
assert.ok(dynP3.svg.includes('INTERNAL VIEW'), 'Page 3 must include INTERNAL VIEW');
assert.ok(dynP3.svg.includes('BU01') || dynP3.svg.includes('SINK'), 'Page 3 must include connected sink unit');
assert.ok(dynP3.svg.includes('BU03') || dynP3.svg.includes('HOB'), 'Page 3 must include connected hob unit');
assert.ok(dynP3.svg.includes('GRANITE'), 'Page 3 must include continuous countertop');
console.log('✓ Page 3 combines connected base & wall run into coordinated External & Internal elevation.');

// Page 4: Kitchen Loft Only
const dynP4 = dynamicPages[3];
assert.ok(dynP4.title.includes('LOFT'), 'Page 4 must be Loft sheet');
assert.ok(dynP4.svg.includes('CONTINUOUS LOFT RUN'), 'Page 4 must render continuous loft run');
assert.ok(!dynP4.svg.includes('SINK UNIT'), 'Page 4 must exclude base cabinets');
console.log('✓ Page 4 isolates continuous loft shuttering run.');

// Living TV Unit Page
const tvPage = dynamicPages.find(p => p.title.includes('TV UNIT') || p.svg.includes('TV UNIT'));
assert.ok(tvPage, 'Must generate combined Living TV Unit sheet');
assert.ok(tvPage.svg.includes('EXTERNAL VIEW'), 'TV Unit must include external view');
assert.ok(tvPage.svg.includes('INTERNAL VIEW'), 'TV Unit must include internal view');
console.log('✓ Living TV Unit components combined into single assembly sheet.');

// Bedroom Wardrobe & Study Page
const bedPage = dynamicPages.find(p => p.title.includes('BEDROOM') || p.title.includes('WARDROBE'));
assert.ok(bedPage, 'Must generate Bedroom Wardrobe & Study sheet');
console.log('✓ Bedroom furniture combined into complete elevation sheet.');

// Manufacturing Appendix Sheet
const appendixPage = dynamicPages[dynamicPages.length - 1];
assert.ok(appendixPage.title.includes('APPENDIX') || appendixPage.title.includes('CUT-LIST') || appendixPage.svg.includes('CUT-LIST') || appendixPage.svg.includes('SCHEDULE'),
  'Last page must be Manufacturing Appendix');
console.log('✓ Clean Manufacturing Appendix generated at end of book.');

console.log('\n=== ALL PRODUCTION 2D DRAWING FLOW V2 TESTS PASSED! ===');
