const Core = require('../orbix-core.js');

let catalog = Core.FURNITURE_CATALOG || [];
console.log('Total items in FURNITURE_CATALOG:', catalog.length);

let matched = catalog.filter(f => {
  return f && (f.category === 'structural' || f.category === 'civil' ||
    (f.name && /rcc|column|pillar|post/i.test(f.name)) ||
    (f.id && /rcc|column|pillar|post/i.test(f.id)) ||
    (f.catalogItemId && /rcc|column|pillar|post/i.test(f.catalogItemId)));
});

console.log('Matched items count:', matched.length);
matched.forEach(m => console.log(' - ID:', m.id, 'Name:', m.name, 'Cat:', m.category));
