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

// ─────────────────────────────────────────────────────────────────────────────
// Test Dynamic Generation from Live User 2D Floor Plan
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTesting 100% Dynamic Generation from live user 2D Floor Plan...');

global.OrbixUI = {
  project: {
    meta: {
      clientName: 'MR. ANAND & SANGEETHA',
      title: 'VILLA 42, WHITEFIELD RESIDENCE',
      designerName: 'Ar. KAVITHA',
      code: 'WF-2026-99'
    },
    plan: {
      walls: [
        { id: 'w1', start: { x: 0, y: 0 }, end: { x: 4500, y: 0 }, thickness: 200 },
        { id: 'w2', start: { x: 4500, y: 0 }, end: { x: 4500, y: 3500 }, thickness: 200 },
        { id: 'w3', start: { x: 4500, y: 3500 }, end: { x: 0, y: 3500 }, thickness: 200 },
        { id: 'w4', start: { x: 0, y: 3500 }, end: { x: 0, y: 0 }, thickness: 200 }
      ],
      openings: [
        { id: 'op1', wallId: 'w1', type: 'window', offset: 2250, width: 1600 }
      ],
      rooms: [
        { id: 'r1', name: 'MASTER BEDROOM', area: 15750000, polygon: [{ x: 0, y: 0 }, { x: 4500, y: 0 }, { x: 4500, y: 3500 }, { x: 0, y: 3500 }] }
      ],
      furniture: [
        {
          id: 'u1',
          name: '3 DOOR WARDROBE WITH DRAWERS',
          code: 'WD3D-1500',
          category: 'wardrobe',
          dimensions: { W: 1500, D: 600, H: 2100 },
          pos: { x: 1000, y: 300, z: 0 },
          unitConfig: { shutters: 3, drawers: 3, carcass: 'Fab White', shutterCol: 'Walnut Bronze', handle: 'G-Profile' }
        },
        {
          id: 'u2',
          name: 'STUDY DESK WITH OVERHEAD BOOKSHELF',
          code: 'SD-1200',
          category: 'study',
          dimensions: { W: 1200, D: 600, H: 1800 },
          pos: { x: 2600, y: 300, z: 0 },
          unitConfig: { shutters: 2, drawers: 1, shelves: 3, carcass: 'Fab White', shutterCol: 'Olive Slate' }
        },
        {
          id: 'u3',
          name: 'BEDROOM OVERHEAD LOFT RUN',
          code: 'LFT-2700',
          category: 'loft',
          dimensions: { W: 2700, D: 600, H: 600 },
          pos: { x: 1000, y: 300, z: 2100 },
          unitConfig: { shutters: 4, loft: true, loftH: 600, carcass: 'Fab White', shutterCol: 'Walnut Bronze' }
        }
      ]
    }
  }
};

const dynPages = global.OrbixA4Drawings.generateAllPages();
assert.ok(Array.isArray(dynPages), 'Dynamic pages must be an array');
// 2 overview pages (Floor Plan + 3D) + 3 units + 1 continuous loft page = 6 pages
assert.strictEqual(dynPages.length, 6, 'Must generate exactly 6 pages for 3 units + loft');

// Check dynamic page 1 has user's client, title, room and custom dimensions
const dp1 = dynPages[0];
assert.ok(dp1.svg.includes('MR. ANAND &amp; SANGEETHA') || dp1.svg.includes('MR. ANAND & SANGEETHA'), 'Title block must have user client');
assert.ok(dp1.svg.includes('VILLA 42, WHITEFIELD RESIDENCE'), 'Title block must have user site');
assert.ok(dp1.svg.includes('4500'), 'Page 1 must render user 4500mm wall length');
assert.ok(dp1.svg.includes('3500'), 'Page 1 must render user 3500mm wall length');
assert.ok(dp1.svg.includes('WINDOW — 1600'), 'Page 1 must render user 1600mm window');
assert.ok(dp1.svg.includes('MASTER BEDROOM'), 'Page 1 must render user MASTER BEDROOM room tag');
assert.ok(dp1.svg.includes('WD3D-1500'), 'Page 1 must render unit code WD3D-1500');
console.log('✓ Dynamic Page 1 (Custom Floor Plan, Walls & Openings) verified.');

// Check dynamic unit page 3 (Wardrobe)
const dp3 = dynPages[2];
assert.ok(dp3.svg.includes('WD3D-1500'), 'Page 3 must include user unit code');
assert.ok(dp3.svg.includes('1500 mm'), 'Page 3 production details must include 1500 mm length');
assert.ok(dp3.svg.includes('2100 mm'), 'Page 3 production details must include 2100 mm height');
assert.ok(dp3.svg.includes('EXTERNAL VIEW'), 'Page 3 must include EXTERNAL VIEW');
assert.ok(dp3.svg.includes('INTERNAL VIEW'), 'Page 3 must include INTERNAL VIEW');
assert.ok(dp3.svg.includes('Walnut Bronze'), 'Page 3 must render user shutter color Walnut Bronze');
console.log('✓ Dynamic Unit Sheet (Wardrobe 1500x2100) verified.');

// Check dynamic unit page 4 (Study Desk)
const dp4 = dynPages[3];
assert.ok(dp4.svg.includes('SD-1200'), 'Page 4 must include study desk code');
assert.ok(dp4.svg.includes('1200 mm'), 'Page 4 production details must include 1200 mm length');
console.log('✓ Dynamic Unit Sheet (Study Desk 1200mm) verified.');

// Check dynamic loft sheet
const dp6 = dynPages[5];
assert.ok(dp6.svg.includes('CONTINUOUS LOFT RUN'), 'Page 6 must include continuous loft title');
assert.ok(dp6.svg.includes('LFT-2700') || dp6.svg.includes('LOFT'), 'Page 6 must render loft span');
console.log('✓ Dynamic Continuous Loft Elevation Sheet verified.');

// Test DXF export for dynamic sheet
const dxf = global.OrbixA4Drawings.exportDXF(0);
assert.ok(dxf.includes('AC1009'), 'DXF must be valid AC1009 format');
assert.ok(dxf.includes('OUTLINE') && dxf.includes('TITLEBLOCK'), 'DXF must contain CAD layers');
console.log('✓ AutoCAD DXF export verified.');

// ─────────────────────────────────────────────────────────────────────────────
// Test Dynamic Generation for Arbitrary Unit Counts (e.g. 27 Units)
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTesting Dynamic Generation with 27 Units (User Production Scale)...');

var units27 = [];
for (var k = 0; k < 27; k++) {
  var uNum = k + 1;
  var tag = 'U' + (uNum < 10 ? '0' : '') + uNum;
  var isSink = (k === 0);
  var isHob = (k === 1);
  var isDrawers = (k % 3 === 0);
  units27.push({
    id: 'unit_27_' + k,
    name: isSink ? 'SINK CABINET' : (isHob ? 'HOB CABINET' : (isDrawers ? '3-DRAWER TANDEM' : 'MODULAR CABINET ' + uNum)),
    code: tag,
    category: (k > 15) ? 'wall' : 'base',
    dimensions: { W: isSink ? 800 : (isHob ? 900 : (k % 2 === 0 ? 600 : 450)), D: (k > 15) ? 350 : 600, H: (k > 15) ? 720 : 860 },
    unitConfig: {
      shutters: isDrawers ? 0 : 2,
      drawers: isDrawers ? 3 : 0,
      hasSink: isSink,
      hasHob: isHob,
      carcass: 'Action TESA BWP Half White',
      shutterCol: 'Merino Surabhi Teak'
    }
  });
}

global.OrbixUI = {
  project: {
    meta: {
      clientName: 'COOKSCAPE PREMIUM CLIENT',
      title: 'CHENNAI VILLA PROJECT (27 UNITS)',
      designerName: 'Ar. SHIVARANJANI',
      code: 'CS-2026-27U'
    },
    plan: {
      walls: [],
      openings: [],
      rooms: [],
      furniture: units27
    }
  }
};

const pages27 = global.OrbixA4Drawings.generateAllPages();
assert.ok(Array.isArray(pages27), 'Must return pages array');
// 2 overview pages (Floor Plan + 3D) + 27 units = 29 pages total
assert.strictEqual(pages27.length, 29, 'Must generate exactly 29 pages dynamically for 27 units');
console.log(`✓ Successfully generated ${pages27.length} dynamic pages for 27 units!`);

// Verify every single page has correct page number and total count
pages27.forEach((page, pIdx) => {
  var expectedPageNum = pIdx + 1;
  var pNumStr = expectedPageNum < 10 ? '0' + expectedPageNum : String(expectedPageNum);
  assert.ok(page.svg.includes('PAGE NO : ' + pNumStr), `Page ${expectedPageNum} must show PAGE NO : ${pNumStr}`);
  assert.ok(page.svg.includes('TOTAL NO OF PAGES : 29'), `Page ${expectedPageNum} must show TOTAL NO OF PAGES : 29`);
  assert.ok(page.svg.includes('COOKSCAPE PREMIUM CLIENT'), `Page ${expectedPageNum} must include client name`);
});
console.log('✓ Verified all 29 pages have dynamic PAGE NO and TOTAL NO OF PAGES : 29!');

// Verify unit sheets 3 through 29
for (var u = 0; u < 27; u++) {
  var sheet = pages27[2 + u];
  var uTag = 'U' + ((u + 1) < 10 ? '0' : '') + (u + 1);
  assert.ok(sheet.svg.includes(uTag), `Sheet for unit ${u + 1} must include tag ${uTag}`);
  assert.ok(sheet.svg.includes('EXTERNAL VIEW'), `Sheet for unit ${u + 1} must include EXTERNAL VIEW`);
  assert.ok(sheet.svg.includes('INTERNAL VIEW'), `Sheet for unit ${u + 1} must include INTERNAL VIEW`);
}
console.log('✓ All 27 individual unit shop drawing sheets verified.');

console.log('\n======================================================');
console.log('ALL ORBIX A4 PRODUCTION DRAWING TESTS PASSED 100%!');
console.log('======================================================');
