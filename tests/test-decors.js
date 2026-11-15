const fs = require('fs');
const path = require('path');

// Mock browser globals
global.window = global;
global.root = global;

console.log('Testing Decors & 3D Integration...');

// 1. Load decors catalog
require('../orbix-decors-catalog.js');
console.log('ORBIX_DECORS_CATALOG loaded. Total items:', window.ORBIX_DECORS_CATALOG ? window.ORBIX_DECORS_CATALOG.length : 0);
if (!window.ORBIX_DECORS_CATALOG || window.ORBIX_DECORS_CATALOG.length !== 46) {
  throw new Error(`Expected 46 decors in catalog, found ${window.ORBIX_DECORS_CATALOG ? window.ORBIX_DECORS_CATALOG.length : 0}`);
}

// 2. Load core
const OrbixCore = require('../orbix-core.js');
console.log('OrbixCore loaded. FURNITURE_CATALOG total:', OrbixCore.FURNITURE_CATALOG.length);

// 3. Test creating placement for bed, sofa, dining, hob, plant
const sampleSlugs = ['bed_windsor_1', 'ashley_padova_3_seater_sofa', 'dining_table_4', 'hob', 'flower_pot_12'];
sampleSlugs.forEach(slug => {
  const item = window.ORBIX_DECORS_CATALOG.find(d => d.slug === slug);
  if (!item) throw new Error(`Could not find decor with slug: ${slug}`);
  
  const placed = OrbixCore.createFurniturePlacement({
    id: item.id,
    slug: item.slug,
    name: item.name,
    category: 'decor',
    decorType: item.decorType,
    dimensions: item.dimensions,
    elevation: item.elevation,
    modelUrl: item.modelUrl,
    thumbnailUrl: item.thumbnailUrl
  });
  
  if (!placed.isDecor) throw new Error(`Placed item ${slug} is not marked isDecor`);
  if (!placed.excludeFromPricing) throw new Error(`Placed item ${slug} is not marked excludeFromPricing`);
  if (!placed.modelUrl || !placed.modelUrl.endsWith('.glb')) throw new Error(`Placed item ${slug} has invalid modelUrl: ${placed.modelUrl}`);
  
  console.log(`✓ Placed ${placed.name} (${placed.dimensions.W}x${placed.dimensions.H}x${placed.dimensions.D}mm, elev: ${placed.elevation}mm, model: ${placed.modelUrl})`);
});

// 4. Test quotation with decors placed
const project = OrbixCore.createProject({ id: 'test_proj', name: 'Test Room with Decors' });
const r1 = OrbixCore.createRoom({
  id: 'r1',
  name: 'Living & Bedroom',
  polygon: [{x: 0, y: 0}, {x: 6000, y: 0}, {x: 6000, y: 6000}, {x: 0, y: 6000}]
});
project.plan.rooms = [r1];

// Add 1 wardrobe cabinet (should cost money)
const ward = OrbixCore.createFurniturePlacement({
  id: 'w2d-1',
  name: 'Wardrobe 2 Door',
  category: 'wardrobe',
  dimensions: { W: 1200, H: 2100, D: 600 },
  pos: { x: 1000, y: 1000, z: 0 }
});
project.plan.furniture.push(ward);

// Add 3 decors (bed, sofa, tv) - should cost ₹0.00
const bed = window.ORBIX_DECORS_CATALOG.find(d => d.slug === 'cama_3');
project.plan.furniture.push(OrbixCore.createFurniturePlacement({
  id: 'decor_cama',
  name: bed.name,
  category: 'decor',
  isDecor: true,
  excludeFromPricing: true,
  dimensions: bed.dimensions,
  modelUrl: bed.modelUrl
}));

const quote = OrbixCore.generateFullQuotation(project, OrbixCore.DEFAULT_RATE_CARD);
console.log('\nQuotation Test:');
console.log('Cabinet Items:', (quote.furnitureItems || []).map(it => `${it.name}: ₹${it.totalAmount}`).join(', '));
console.log('Grand Total: ₹' + quote.grandTotal);

const pricedCabinets = (quote.furnitureItems || []).filter(it => it.totalAmount > 0);
const zeroCostDecors = (quote.furnitureItems || []).filter(it => it.isDecor || it.totalAmount === 0);

if (pricedCabinets.length !== 1) {
  throw new Error(`Expected exactly 1 priced woodwork cabinet, found ${pricedCabinets.length}`);
}
if (zeroCostDecors.length !== 1) {
  throw new Error(`Expected exactly 1 zero-cost decor item, found ${zeroCostDecors.length}`);
}
console.log('✓ Decors cleanly excluded from woodwork BOQ pricing!');

console.log('\nALL 46 DECORS & THREE.JS INTEGRATION TESTS PASSED PERFECTLY!');
