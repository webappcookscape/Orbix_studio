const assert = require('assert');
const Core = require('../orbix-core.js');
const OrbixUnitIcons = require('../orbix-unit-icons.js');

// Mock self / OrbixUI
const OrbixUI = {
  getUnitSVG: function(itemOrCat) {
    var item = itemOrCat;
    var cat = '';
    if (typeof itemOrCat === 'string') {
      cat = itemOrCat.toLowerCase();
      item = { category: cat, name: cat };
    } else if (itemOrCat && typeof itemOrCat === 'object') {
      cat = (itemOrCat.category || '').toLowerCase();
    } else {
      item = {};
    }

    var catalogItem = null;
    var catalog = Core.FURNITURE_CATALOG;
    var targetId = (item.catalogId || item.id || item.code || '').toLowerCase();
    var targetName = (item.name || '').trim().toLowerCase();

    if (targetId) {
      for (var i = 0; i < catalog.length; i++) {
        var cId = (catalog[i].id || '').toLowerCase();
        var cCode = (catalog[i].code || '').toLowerCase();
        if (cId === targetId || cCode === targetId) {
          catalogItem = catalog[i];
          break;
        }
      }
    }

    if (!catalogItem && targetName) {
      var normTarget = targetName.replace(/[\s\-_]+/g, '');
      for (var k = 0; k < catalog.length; k++) {
        var normCatName = (catalog[k].name || '').toLowerCase().replace(/[\s\-_]+/g, '');
        var normCatId = (catalog[k].id || '').toLowerCase().replace(/[\s\-_]+/g, '');
        if (normCatName === normTarget || normCatId === normTarget ||
            normCatName.indexOf(normTarget) !== -1 || normTarget.indexOf(normCatName) !== -1) {
          catalogItem = catalog[k];
          break;
        }
      }
    }

    var matchedItem = catalogItem || item;
    var iconSrc = Core.getUnitIcon(matchedItem);
    return '<img src="' + iconSrc + '" alt="' + (matchedItem.name || 'Unit') + '" class="quote-iso-thumb">';
  }
};

const itemsToTest = [
  { name: 'FM 120', category: 'kitchen_base' },
  { name: 'FM D3 - 45', category: 'kitchen_base' },
  { name: 'CROCKERY/TV BASE 1DOOR 1 DRAWER', category: 'tv_unit' },
  { name: 'CROCKERY /TV BASE 2 DOOR', category: 'pooja' },
  { name: 'CROCKERY/TV WALL 2 DOOR', category: 'pooja' },
  { name: 'SLIDING WARDROBE', category: 'wardrobe' },
  { name: 'SR 45', category: 'spice_rack' }
];

console.log('--- TESTING QUOTE TABLE PREVIEW RESOLUTION ---');
const previews = itemsToTest.map(it => {
  const previewHtml = OrbixUI.getUnitSVG(it);
  console.log('✓', it.name, '-->', previewHtml.substring(0, 75) + '...');
  return previewHtml;
});

const uniquePreviews = new Set(previews);
console.log('Total items tested:', itemsToTest.length, '| Unique preview illustrations:', uniquePreviews.size);
assert.strictEqual(uniquePreviews.size, itemsToTest.length, 'All tested units must have unique preview SVG illustrations!');
console.log('ALL QUOTE TABLE PREVIEW TESTS PASSED SUCCESSFULLY!');

