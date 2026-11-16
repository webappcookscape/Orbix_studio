const fs = require('fs');
let code = fs.readFileSync('orbix-decors-catalog.js', 'utf8');

let window = {
  OrbixDecors: {}
};
eval(code);

let decors = window.OrbixDecors && window.OrbixDecors.catalog || [];
console.log('Total decors:', decors.length);

let matched = decors.filter(f => {
  return f && (f.category === 'structural' || f.category === 'civil' ||
    (f.name && /rcc|column|pillar|post/i.test(f.name)) ||
    (f.id && /rcc|column|pillar|post/i.test(f.id)) ||
    (f.catalogItemId && /rcc|column|pillar|post/i.test(f.catalogItemId)));
});

console.log('Matched decors count:', matched.length);
matched.forEach(m => console.log(' - ID:', m.id, 'Name:', m.name, 'Cat:', m.category));

