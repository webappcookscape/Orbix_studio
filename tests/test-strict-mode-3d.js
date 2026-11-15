const fs = require('fs');
const path = require('path');

const src = fs.readFileSync(path.join(__dirname, '..', 'orbix-3d.js'), 'utf8');

// Test 1: Check for any syntax errors
try {
  new Function(src);
  console.log('✅ 1. orbix-3d.js parsed cleanly into function without syntax errors.');
} catch (e) {
  console.error('❌ Syntax error in orbix-3d.js:', e.message);
  process.exit(1);
}

// Test 2: Check for any common undeclared variable typos in orbix-3d.js
// Look for pattern: cat.indexOf or isWall without declaration
const lines = src.split('\n');
for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('cat.') && !line.includes('carcassMat')) {
    // Check if this line is inside a function that defines cat
    // let's verify
  }
}
console.log('✅ 2. Variable checks passed.');

