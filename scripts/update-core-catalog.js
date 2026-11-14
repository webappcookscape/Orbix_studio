const fs = require('fs');
let code = fs.readFileSync('orbix-core.js', 'utf8');

// 1. Update GL units in FURNITURE_CATALOG to have dstyle: "glass"
const glIds = ['wm-60-gl', 'wm-75-gl', 'wm-90-gl', 'wm-45-gl'];
glIds.forEach(id => {
  const re = new RegExp(`("id":\\s*"${id}"[\\s\\S]*?"unitConfig":\\s*\\{[\\s\\S]*?"dstyle":\\s*)"slab"`, 'g');
  code = code.replace(re, '$1"glass"');
});

// 2. Update O/S (Only Shutter) units to have D: 18
const osIds = ['loft-1d-os', 'loft-2d-os', 'fm-120 o/s', 'fm-60 o/s', 'wm-60 o/s', 'wm-30 o/s'];
osIds.forEach(id => {
  const escapedId = id.replace('/', '\\/');
  const re = new RegExp(`("id":\\s*"${escapedId}"[\\s\\S]*?"dimensions":\\s*\\{[\\s\\S]*?"D":\\s*)\\d+`, 'g');
  code = code.replace(re, '$118');
});

fs.writeFileSync('orbix-core.js', code, 'utf8');
console.log('Successfully updated orbix-core.js');

