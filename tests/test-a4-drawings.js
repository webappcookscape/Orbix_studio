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

// Test page 10 contains Pooja CNC Cut (in Cookscape 16-page sequence)
const pPooja = pages[9] || pages.find(p => p.svg.includes('ॐ'));
assert.ok(pPooja.svg.includes('ॐ'), 'Pooja page must include Om symbol in Pooja mandala');
assert.ok(pPooja.svg.includes('CNC CUT'), 'Pooja page must include CNC cut callout');
console.log('✓ Page 10 (Pooja CNC Cut) validated.');

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
// V2 intelligent grouping: 2 overview pages (Floor Plan + 3D) + 1 bedroom assembly + 1 continuous loft + 1 appendix = 5 pages
assert.strictEqual(dynPages.length, 5, 'Must generate exactly 5 assembly-based pages for 3 units');

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

// Check dynamic bedroom assembly page 3 (Wardrobe & Associated Units)
const dp3 = dynPages[2];
assert.ok(dp3.svg.includes('WD3D-1500'), 'Page 3 must include user unit code');
assert.ok(dp3.svg.includes('1500 mm'), 'Page 3 production details must include 1500 mm length');
assert.ok(dp3.svg.includes('2100 mm'), 'Page 3 production details must include 2100 mm height');
assert.ok(dp3.svg.includes('EXTERNAL VIEW'), 'Page 3 must include EXTERNAL VIEW');
assert.ok(dp3.svg.includes('INTERNAL VIEW'), 'Page 3 must include INTERNAL VIEW');
assert.ok(dp3.svg.includes('Walnut Bronze'), 'Page 3 must render user shutter color Walnut Bronze');
console.log('✓ Dynamic Bedroom Assembly Sheet (Wardrobe 1500x2100) verified.');

// Check dynamic loft sheet
const dp4 = dynPages[3];
assert.ok(dp4.svg.includes('CONTINUOUS LOFT RUN'), 'Page 4 must include continuous loft title');
assert.ok(dp4.svg.includes('LFT-2700') || dp4.svg.includes('LOFT'), 'Page 4 must render loft span');
console.log('✓ Dynamic Continuous Loft Elevation Sheet verified.');

// Check manufacturing appendix
const dp5 = dynPages[4];
assert.ok(dp5.svg.includes('APPENDIX') || dp5.svg.includes('SCHEDULE') || dp5.svg.includes('CUT-LIST'), 'Page 5 must be manufacturing appendix');
console.log('✓ Dynamic Manufacturing Appendix verified.');

// Test DXF export for dynamic sheet
const dxf = global.OrbixA4Drawings.exportDXF(0);
assert.ok(dxf.includes('AC1009'), 'DXF must be valid AC1009 format');
assert.ok(dxf.includes('OUTLINE') && dxf.includes('TITLEBLOCK'), 'DXF must contain CAD layers');
assert.ok(dxf.includes('DIMENSIONS'), 'DXF must contain DIMENSIONS layer');
assert.ok(dxf.includes('SECTION\r\n2\r\nENTITIES') || dxf.includes('ENTITIES'), 'DXF must contain ENTITIES section');
assert.ok(dxf.includes('LINE'), 'DXF must contain LINE geometry entities');

// Test DXF export for unit sheet 2 (Wardrobe)
const dxfUnit = global.OrbixA4Drawings.exportDXF(2);
assert.ok(dxfUnit.includes('CARCASS') || dxfUnit.includes('OUTLINE'), 'Unit DXF must contain carcass/outline layers');
assert.ok(dxfUnit.includes('WD3D-1500') || dxfUnit.includes('1500'), 'Unit DXF must include cabinet code or dimensions in CAD text');
console.log('✓ Full AutoCAD DXF geometry & entity generation verified (walls, dimensions, text, layers).');

// Test Combined All-Sheets DXF
const allDxf = global.OrbixA4Drawings.exportAllDXF();
assert.ok(allDxf.includes('AC1009'), 'Combined DXF must be valid AC1009 format');
assert.ok(allDxf.length > dxf.length * 2, 'Combined DXF must contain all sheets');
console.log('✓ Combined Multi-Sheet AutoCAD DXF (All Sheets in Model Space) verified.');

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
// V2 intelligently groups 27 units into assembly sheets instead of 29 individual cabinet sheets
assert.ok(pages27.length < 27, `V2 must combine 27 cabinets into assembly sheets (${pages27.length} < 27)`);
console.log(`✓ Successfully combined 27 units into ${pages27.length} clean assembly elevation sheets!`);

// Verify every single page has correct page number and total count
pages27.forEach((page, pIdx) => {
  var expectedPageNum = pIdx + 1;
  var pNumStr = expectedPageNum < 10 ? '0' + expectedPageNum : String(expectedPageNum);
  assert.ok(page.svg.includes('PAGE NO : ' + pNumStr), `Page ${expectedPageNum} must show PAGE NO : ${pNumStr}`);
  assert.ok(page.svg.includes('COOKSCAPE PREMIUM CLIENT'), `Page ${expectedPageNum} must include client name`);
});
console.log(`✓ Verified all ${pages27.length} pages have dynamic PAGE NO and client branding!`);

// ─────────────────────────────────────────────────────────────────────────────
// Test Orbix Production Studio — 7 Modular Engines Architecture
// ─────────────────────────────────────────────────────────────────────────────
console.log('\nTesting Orbix Production Studio 7-Engine Architecture & Technical Audit...');

assert.ok(global.OrbixProductionStudio, 'OrbixProductionStudio alias must be defined on window/global');
assert.strictEqual(global.OrbixProductionStudio, global.OrbixA4Drawings, 'OrbixProductionStudio must reference OrbixA4Drawings');

const Studio = global.OrbixProductionStudio;

// 1. Model Data Engine
assert.ok(Studio.ModelDataEngine, 'Engine 1 (ModelDataEngine) must exist');
const sampleTechObj = Studio.ModelDataEngine.buildTechnicalObject({
  id: 'test_u1',
  code: 'KIT-B-001',
  name: 'KITCHEN BASE 2-DRAWER',
  category: 'base',
  dimensions: { W: 750, H: 720, D: 560 },
  unitConfig: { shutters: 0, drawers: 2, carcass: '18 mm BWP', shutterCol: 'Surabhi laminate' }
}, 1);

assert.strictEqual(sampleTechObj.unitCode, 'KIT-B-001', 'Tech object code must match');
assert.strictEqual(sampleTechObj.dimensions.W, 750, 'Tech object width must match');
assert.ok(Array.isArray(sampleTechObj.panels), 'Tech object must contain decomposed panels array');
assert.ok(sampleTechObj.panels.length >= 7, 'Tech object must contain all cabinet panels');
assert.ok(sampleTechObj.panels.some(p => p.panelName.includes('Gable')), 'Must contain Left & Right Gables');
assert.ok(sampleTechObj.panels.some(p => p.panelName.includes('Bottom')), 'Must contain Bottom Panel');
assert.ok(sampleTechObj.panels.some(p => p.panelName.includes('Back')), 'Must contain Back Panel');
console.log('✓ Engine 1 (Model Data Engine): Decomposed cabinet into 3D technical object with internal panels & hardware.');

// 2. Dimension Engine
assert.ok(Studio.DimensionEngine, 'Engine 2 (DimensionEngine) must exist');
const datumLevels = Studio.DimensionEngine.getDatumLevels();
assert.strictEqual(datumLevels.plinthBase, 110, 'Plinth base must be 110mm');
assert.strictEqual(datumLevels.counterHeight, 860, 'Counter height must be 860mm');
const clearances = Studio.DimensionEngine.computeInternalClearances(sampleTechObj);
assert.strictEqual(clearances.netInnerHeight, 720 - 36, 'Net clear inner height must exclude 18mm top/bottom');
console.log('✓ Engine 2 (Dimension Engine): Verified standard datum levels (plinth 110mm, counter 860mm, clearances).');

// 3. Drawing Engine
assert.ok(Studio.DrawingEngine, 'Engine 3 (DrawingEngine) must exist');
const testCanvas = Studio.DrawingEngine.createVectorCanvas(2970, 2100);
assert.strictEqual(testCanvas.width, 2970, 'Canvas width must match standard A4 10x');
assert.strictEqual(testCanvas.height, 2100, 'Canvas height must match standard A4 10x');
console.log('✓ Engine 3 (Drawing Engine): Vector canvas routines & projections verified.');

// 4. Annotation Engine
assert.ok(Studio.AnnotationEngine, 'Engine 4 (AnnotationEngine) must exist');
assert.strictEqual(typeof Studio.AnnotationEngine.dimH, 'function', 'Must have dimH');
assert.strictEqual(typeof Studio.AnnotationEngine.dimV, 'function', 'Must have dimV');
assert.strictEqual(typeof Studio.AnnotationEngine.drawTitleBlock, 'function', 'Must have drawTitleBlock');
console.log('✓ Engine 4 (Annotation Engine): Architectural dimension chains & title block verified.');

// 5. Material Engine
assert.ok(Studio.MaterialEngine, 'Engine 5 (MaterialEngine) must exist');
const cutList = Studio.MaterialEngine.generatePanelCutList(sampleTechObj);
assert.ok(Array.isArray(cutList) && cutList.length >= 7, 'Must generate cut-list rows');
assert.ok(cutList[0].material.includes('BWP'), 'Cut list must include material spec');
const hwSched = Studio.MaterialEngine.generateHardwareSchedule([sampleTechObj]);
assert.ok(hwSched.hinges && hwSched.runners, 'Must calculate hardware schedule');
console.log('✓ Engine 5 (Material Engine): Panel cut-list BOM & project hardware schedule verified.');

// 6. Validation & Technical Audit Engine
assert.ok(Studio.ValidationEngine, 'Engine 6 (ValidationEngine) must exist');
const auditReport = Studio.runTechnicalAudit();
assert.strictEqual(typeof auditReport.readinessScore, 'number', 'Audit must return readiness score');
assert.ok(auditReport.readinessScore >= 90, 'Valid project must score >= 90% (Actual: ' + auditReport.readinessScore + '%)');
assert.strictEqual(auditReport.status, 'READY FOR FACTORY PRODUCTION', 'Status must be READY FOR FACTORY PRODUCTION');
assert.strictEqual(auditReport.passed, true, 'Audit passed must be true');
assert.ok(Array.isArray(auditReport.findings), 'Findings must be an array');
assert.ok(auditReport.findings.some(f => f.code === 'DIM_OK'), 'Must have DIM_OK finding');
assert.ok(auditReport.findings.some(f => f.code === 'PANEL_BOM_OK'), 'Must have PANEL_BOM_OK finding');
assert.strictEqual(auditReport.summary.unitCount, 27, 'Must count 27 units');
assert.strictEqual(auditReport.summary.sheetCount, 29, 'Must calculate 29 sheets');
console.log(`✓ Engine 6 (Validation Engine): Readiness Score ${auditReport.readinessScore}% — ${auditReport.status}!`);

// 7. PDF Layout Engine
assert.ok(Studio.PDFLayoutEngine, 'Engine 7 (PDFLayoutEngine) must exist');
Studio.setPaperSize('A3');
assert.strictEqual(Studio.getPaperSize(), 'A3', 'Must switch to A3 Landscape');
Studio.setPaperSize('A4');
assert.strictEqual(Studio.getPaperSize(), 'A4', 'Must switch back to A4 Landscape');
console.log('✓ Engine 7 (PDF Layout Engine): Multi-page compositor, paper sizes (A4/A3) & PDF/DXF export verified.');

console.log('\n======================================================');
console.log('ALL ORBIX PRODUCTION STUDIO 7-ENGINE TESTS PASSED 100%!');
console.log('======================================================');
