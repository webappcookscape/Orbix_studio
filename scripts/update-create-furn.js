const fs = require('fs');
let code = fs.readFileSync('orbix-core.js', 'utf8');
const hasCRLF = code.includes('\r\n');
if (hasCRLF) {
  code = code.replace(/\r\n/g, '\n');
}

const targetStr = `    var isWallUnit = !isDecor && isWallUnitCategory(opts.category, opts.name, opts.code || opts.catalogItemId, opts.costCategory);
    var isLoft = (cat.indexOf('loft') !== -1 || nm.indexOf('loft') !== -1);
    var defElev = isLoft ? 2100 : (isWallUnit ? 1500 : 0);`;

const replaceStr = `    var isWallUnit = !isDecor && isWallUnitCategory(opts.category, opts.name, opts.code || opts.catalogItemId, opts.costCategory);
    var isLoft = (cat.indexOf('loft') !== -1 || nm.indexOf('loft') !== -1);
    var isGL = /(^|\\b|_|-|\\s)gl(\\b|_|-|\\s|\\d+|$)/i.test(String(opts.name || '') + ' ' + String(opts.code || '') + ' ' + String(opts.id || ''));
    var isOS = !!(
      (cat && (cat === 'loft_os' || cat === 'kitchen_o_s' || cat.indexOf('o/s') !== -1 || cat.indexOf('os') !== -1)) ||
      (opts.costCategory && opts.costCategory.indexOf('O/S') !== -1) ||
      (opts.modelType && /o_s|os/i.test(opts.modelType)) ||
      (nm && /\\bo\\/?s\\b/i.test(nm)) ||
      (opts.id && /\\bo_?s\\b/i.test(opts.id)) ||
      (opts.code && /\\bo_?s\\b/i.test(opts.code)) ||
      (opts.unitConfig && opts.unitConfig.isOnlyShutter)
    );
    var defElev = isLoft ? 2100 : (isWallUnit ? 1500 : 0);`;

if (!code.includes(targetStr)) {
  console.error('Target 1 not found');
  process.exit(1);
}
code = code.replace(targetStr, replaceStr);

const targetD = `D: opts.dimensions ? opts.dimensions.D : (isWallUnit ? 350 : 600)`;
const replaceD = `D: isOS ? 18 : (opts.dimensions && opts.dimensions.D !== undefined ? opts.dimensions.D : (isWallUnit ? 350 : 600))`;

if (!code.includes(targetD)) {
  console.error('Target 2 not found');
  process.exit(1);
}
code = code.replace(targetD, replaceD);

const targetCfg = `      // Links directly to Cupboard CAD parametric configuration
      unitConfig: opts.unitConfig || null,`;

const replaceCfg = `      // Links directly to Cupboard CAD parametric configuration
      unitConfig: (function() {
        var cfg = opts.unitConfig ? Object.assign({}, opts.unitConfig) : {};
        if (isGL && (!cfg.dstyle || cfg.dstyle === 'slab')) {
          cfg.dstyle = 'glass';
          cfg.glassTint = cfg.glassTint || 'clear';
        }
        if (isOS) {
          cfg.isOnlyShutter = true;
          cfg.shutterThickness = 18;
        }
        return cfg;
      })(),`;

if (!code.includes(targetCfg)) {
  console.error('Target 3 not found');
  process.exit(1);
}
code = code.replace(targetCfg, replaceCfg);

if (hasCRLF) {
  code = code.replace(/\n/g, '\r\n');
}

fs.writeFileSync('orbix-core.js', code, 'utf8');
console.log('Successfully updated createFurniturePlacement in orbix-core.js');
