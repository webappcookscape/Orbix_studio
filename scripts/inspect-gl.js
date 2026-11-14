const core = require('../orbix-core.js');
const catalog = core.FURNITURE_CATALOG || [];
const glUnits = catalog.filter(it => {
  const n = (it.name || '') + ' ' + (it.code || '') + ' ' + (it.id || '');
  return /(^|\b|_|-|\s)gl(\b|_|-|\s|\d+|$)/i.test(n);
});
console.log('Found', glUnits.length, 'GL units:');
glUnits.forEach(u => {
  console.log(`- [${u.id}] ${u.name} (dstyle: ${u.unitConfig && u.unitConfig.dstyle})`);
});
