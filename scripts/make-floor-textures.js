const fs = require('fs');
const path = require('path');

const img1Path = path.join(__dirname, '..', 'textures', 'tile-floor-1.jpeg');
const img2Path = path.join(__dirname, '..', 'textures', 'tile-floor-2.jpeg');

const b1 = fs.readFileSync(img1Path).toString('base64');
const b2 = fs.readFileSync(img2Path).toString('base64');

const outPath = path.join(__dirname, '..', 'orbix-floor-textures.js');

const js = `/* Orbix Studio Floor Tile Textures */
(function () {
  var t1 = "data:image/jpeg;base64,${b1}";
  var t2 = "data:image/jpeg;base64,${b2}";
  if (typeof window !== 'undefined') {
    window.ORBIX_FLOOR_TEXTURES = {
      tile_1: t1,
      tile_2: t2,
      designer_tile_1: t1,
      designer_tile_2: t2,
      custom_tile_1: t1,
      custom_tile_2: t2
    };
  }
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      tile_1: t1,
      tile_2: t2,
      designer_tile_1: t1,
      designer_tile_2: t2,
      custom_tile_1: t1,
      custom_tile_2: t2
    };
  }
})();
`;

fs.writeFileSync(outPath, js, 'utf8');
console.log('Successfully wrote orbix-floor-textures.js. Size:', fs.statSync(outPath).size);
