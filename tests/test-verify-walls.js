const Core = require('../orbix-core.js');

let project = Core.createProject();
project.plan.walls = [
  Core.createWall({ start: { x: 0, y: 0 }, end: { x: 6000, y: 0 } })
];
project.plan.furniture = [
  { id: 'rcc_1', name: 'RCC Column 1', category: 'structural', pos: { x: 2000, y: 0 } },
  { id: 'rcc_2', name: 'RCC Column 2', category: 'structural', pos: { x: 4000, y: 0 } }
];

console.log('BEFORE autoSplit: walls =', project.plan.walls.length);
Core.autoSplitWallAtJunctions(project);
console.log('AFTER autoSplit: walls =', project.plan.walls.length);
project.plan.walls.forEach((w, i) => {
  console.log('Wall ' + i + ' [' + w.id + ']: (' + w.start.x + ',' + w.start.y + ') -> (' + w.end.x + ',' + w.end.y + ') len=' + Core.wallLength(w));
});
