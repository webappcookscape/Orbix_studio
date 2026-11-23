const fs = require('fs');
const path = require('path');

const corePath = path.join(__dirname, '..', 'orbix-core.js');
let coreCode = fs.readFileSync(corePath, 'utf8');

// Parse FURNITURE_CATALOG by evaluating it
const Core = require('../orbix-core.js');
const catalog = Core.FURNITURE_CATALOG;

let updatedCount = 0;
catalog.forEach((item) => {
  const cat = String(item.category || '').toLowerCase();
  const id = String(item.id || '').toLowerCase();
  const name = String(item.name || '').toLowerCase();
  const isBaseFloor = (
    cat === 'kitchen_base' ||
    cat === 'kitchen_fm' ||
    cat === 'kitchen_corner' ||
    cat === 'kitchen_drawers' ||
    (cat === 'crockery' && name.includes('base')) ||
    id.startsWith('fm-') ||
    id.startsWith('fcm-') ||
    id.startsWith('fbcm') ||
    id.startsWith('ctvb-')
  );

  if (isBaseFloor && item.dimensions && (item.dimensions.H === 750 || item.dimensions.H === 720)) {
    const oldH = item.dimensions.H;
    const newH = 700;
    const oldArea = item.areaSqft;
    const newArea = Math.round((item.dimensions.W * newH / 92903.04) * 100000) / 100000;

    // Search and replace within this item's block in coreCode
    const idEscaped = item.id.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
    const itemBlockRegex = new RegExp(`(\"id\":\\s*\"${idEscaped}\"[\\s\\S]*?\"dimensions\":\\s*\\{[\\s\\S]*?\"H\":\\s*)${oldH}`, 'm');
    if (itemBlockRegex.test(coreCode)) {
      coreCode = coreCode.replace(itemBlockRegex, `$1${newH}`);
      updatedCount++;
    }
  }
});

console.log(`Updated ${updatedCount} catalog floor units in orbix-core.js to H: 700`);
fs.writeFileSync(corePath, coreCode, 'utf8');
