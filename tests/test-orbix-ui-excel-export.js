const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const Core = require('../orbix-core.js');
const OrbixUnitIcons = require('../orbix-unit-icons.js');

// Mock browser globals for OrbixUI
global.document = {
  readyState: 'complete',
  addEventListener: function () {},
  querySelector: function () { return null; },
  getElementById: function () { return null; }
};
global.window = global;
global.Blob = function (parts, opts) {
  this.parts = parts;
  this.type = opts ? opts.type : '';
  // Convert parts to Buffer
  const bufs = [];
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    if (Buffer.isBuffer(p)) bufs.push(p);
    else if (p instanceof Uint8Array) bufs.push(Buffer.from(p.buffer, p.byteOffset, p.byteLength));
    else bufs.push(Buffer.from(String(p), 'utf8'));
  }
  this.buffer = Buffer.concat(bufs);
};

const OrbixUI = require('../orbix-ui.js');

console.log('--- TESTING EXECUTIVE PRICING EXCEL EXPORT ---');

// 1. Prepare realistic project with multiple rooms and diverse units
const project = Core.createProject('Aravind Villa', 'Aravind K.');
project.meta = {
  quoteId: 'ORB-2026-089',
  clientName: 'Aravind K.',
  phone: '+91 98450 12345',
  email: 'aravind@example.com',
  siteAddress: 'Flat 402, Skyline Residency, Bangalore',
  designerName: 'Orbix Studio Design Team',
  dateCreated: '05/11/2026'
};

project.plan.furniture = [
  Core.createFurniturePlacement('fm-120', 100, 100, 0, 'r_kitchen'),
  Core.createFurniturePlacement('fm-60', 200, 100, 0, 'r_kitchen'),
  Core.createFurniturePlacement('ctvb-1d-1dr', 100, 200, 0, 'r_living'),
  Core.createFurniturePlacement('wr-shelves', 200, 200, 0, 'r_bed')
];

project.plan.rooms = [
  { id: 'r_kitchen', name: 'Kitchen', variant: 'PRICE 1', areaSqFt: 120, areaSqM: 11.1 },
  { id: 'r_living', name: 'Living Room', variant: 'PRICE 1', areaSqFt: 250, areaSqM: 23.2 },
  { id: 'r_bed', name: 'Master Bedroom', variant: 'PRICE 2', areaSqFt: 180, areaSqM: 16.7 }
];

project.commercialCharges = {
  designPercent: 9,
  freightPercent: 2.5,
  loadingUnloadingStatus: 'Additional',
  floorMatStatus: 'Not Included in Quote',
  civilWorksStatus: 'As per actuals',
  electricalPlumbingStatus: 'Additional',
  falseCeilingStatus: 'Not Included',
  wallpaperStatus: 'Complementary',
  discountPercent: 0,
  adpPercent: 0,
  gstPercent: 18
};

// 2. Generate quotation
const quote = Core.generateFullQuotation(project, null);
const currentTier = 'PRICE 1';
const roomScopeText = 'All Rooms (Entire Home)';
const comm = OrbixUI.computeCommercialSummary(quote.subtotalWoodwork, project.commercialCharges);
const commCharges = project.commercialCharges;

// 3. Logo bytes from OrbixUnitIcons.LOGO_BASE64
const logoB64 = OrbixUnitIcons.LOGO_BASE64 || fs.readFileSync(path.join(__dirname, '..', 'logo.jpeg')).toString('base64');
const binLogo = Buffer.from(logoB64, 'base64');
const logoBytes = new Uint8Array(binLogo);

// 4. Sample unit preview PNG bytes
const dummyPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);
const thumbResults = [
  new Uint8Array(dummyPng),
  new Uint8Array(dummyPng),
  new Uint8Array(dummyPng),
  new Uint8Array(dummyPng)
];

// 5. Build Executive Pricing XLSX Blob
const blob = OrbixUI.buildExecutivePricingXLSX({
  project: project,
  quote: quote,
  currentTier: currentTier,
  roomScopeText: roomScopeText,
  meta: project.meta,
  comm: comm,
  commCharges: commCharges,
  logoBytes: logoBytes,
  thumbResults: thumbResults
});

const outTestFile = path.join(__dirname, 'test_executive_pricing_export.xlsx');
try { fs.unlinkSync(outTestFile); } catch (_) {}
fs.writeFileSync(outTestFile, blob.buffer);
console.log('✓ Successfully generated Excel file at', outTestFile, 'size:', blob.buffer.length, 'bytes');

// 6. Verify with Python zipfile and ElementTree
const verifyCode = `
import zipfile
import xml.etree.ElementTree as ET
import sys

z = zipfile.ZipFile(r"${outTestFile.replace(/\\/g, '\\\\')}")
names = z.namelist()
print(f"Zip entries ({len(names)}):")
for n in names:
    print(f"  - {n} ({z.getinfo(n).file_size} bytes)")

required_files = [
    '[Content_Types].xml',
    '_rels/.rels',
    'xl/workbook.xml',
    'xl/_rels/workbook.xml.rels',
    'xl/styles.xml',
    'xl/worksheets/sheet1.xml',
    'xl/worksheets/_rels/sheet1.xml.rels',
    'xl/drawings/drawing1.xml',
    'xl/drawings/_rels/drawing1.xml.rels',
    'xl/media/logo.jpeg'
]
for rf in required_files:
    if rf not in names:
        print(f"FAILED: Missing required entry {rf}")
        sys.exit(1)
print("✓ All required OpenXML parts present!")

# Verify XML valid
for n in names:
    if n.endswith('.xml') or n.endswith('.rels'):
        try:
            content = z.read(n)
            ET.fromstring(content)
        except Exception as e:
            print(f"FAILED: XML parse error in {n}: {e}")
            sys.exit(1)
print("✓ All XML parts well-formed and valid!")

# Verify Sheet content
ws_xml = z.read('xl/worksheets/sheet1.xml').decode('utf-8')
assert 'COOKSCAPE' in ws_xml, "Missing Brand title"
assert 'Products &amp; Modular Woodwork' in ws_xml, "Missing Table 1 title"
assert 'Hardware &amp; Functional Fittings' in ws_xml, "Missing Table 2 title"
assert 'Commercial Estimate Summary' in ws_xml, "Missing Table 3 title"
assert 'GRAND TOTAL' in ws_xml, "Missing Grand Total"
print("✓ All 3 Tables and Grand Total verified in sheet1.xml!")

# Verify Drawings
dr_xml = z.read('xl/drawings/drawing1.xml').decode('utf-8')
assert 'twoCellAnchor' in dr_xml, "Missing twoCellAnchor in drawing1.xml"
print("✓ Drawing anchors verified in drawing1.xml!")
`;

const pyOut = execSync(`python -c "${verifyCode.replace(/"/g, '\\"')}"`).toString();
console.log(pyOut);

console.log('ALL EXECUTIVE PRICING EXCEL EXPORT TESTS PASSED 100%!');

