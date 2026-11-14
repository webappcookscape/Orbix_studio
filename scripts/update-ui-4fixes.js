const fs = require('fs');

let ui = fs.readFileSync('orbix-ui.js', 'utf8');
const isCRLF = ui.includes('\r\n');
if (isCRLF) ui = ui.replace(/\r\n/g, '\n');

// 1. Update scene.background in render3DHome
const targetBg = `      // Ensure sky is clean architectural studio backdrop and outer ground is natural studio plane
      if (!scene.background || !(scene.background instanceof THREE.Color) || scene.background.getHex() !== 0xF1F5F9) {
        scene.background = new THREE.Color(0xF1F5F9);
      }`;

const replaceBg = `      // Ensure sky is daytime radiant sky blue and outer ground is lush lawn grass
      if (!scene.background || !(scene.background instanceof THREE.Color) || scene.background.getHex() !== 0x82C3EC) {
        scene.background = new THREE.Color(0x82C3EC);
      }`;

if (!ui.includes(targetBg)) {
  console.error('targetBg not found in orbix-ui.js');
  process.exit(1);
}
ui = ui.replace(targetBg, replaceBg);

// 2. Enhance sunlight and spotlight slider listeners
const targetSliders = `      // Sunlight & Spotlight intensity sliders
      var sunSlider = document.getElementById('sunlightSlider');
      var sunLabel = document.getElementById('sunlightValLabel');
      if (sunSlider) {
        sunSlider.addEventListener('input', function () {
          var v = parseFloat(sunSlider.value);
          if (sunLabel) sunLabel.textContent = v.toFixed(1);
          if (window.GL && window.GL.setSunlightIntensity) window.GL.setSunlightIntensity(v);
        });
      }
      var spotSlider = document.getElementById('spotlightSlider');
      var spotLabel = document.getElementById('spotlightValLabel');
      if (spotSlider) {
        spotSlider.addEventListener('input', function () {
          var v = parseFloat(spotSlider.value);
          if (spotLabel) spotLabel.textContent = v.toFixed(1);
          if (window.GL && window.GL.setSpotlightIntensity) window.GL.setSpotlightIntensity(v);
        });
      }`;

const replaceSliders = `      // Sunlight & Spotlight intensity sliders
      var sunSlider = document.getElementById('sunlightSlider');
      var sunLabel = document.getElementById('sunlightValLabel');
      if (sunSlider) {
        sunSlider.addEventListener('input', function () {
          var v = parseFloat(sunSlider.value);
          if (sunLabel) sunLabel.textContent = v.toFixed(1);
          window.sunlightIntensity = v;
          var gl = window.GL || (window.__cc && window.__cc.gl);
          if (gl && gl.setSunlightIntensity) gl.setSunlightIntensity(v);
          else if (typeof window.setSunlightIntensity === 'function') window.setSunlightIntensity(v);
        });
      }
      var spotSlider = document.getElementById('spotlightSlider');
      var spotLabel = document.getElementById('spotlightValLabel');
      if (spotSlider) {
        spotSlider.addEventListener('input', function () {
          var v = parseFloat(spotSlider.value);
          if (spotLabel) spotLabel.textContent = v.toFixed(1);
          window.spotlightIntensity = v;
          var gl = window.GL || (window.__cc && window.__cc.gl);
          if (gl && gl.setSpotlightIntensity) gl.setSpotlightIntensity(v);
          else if (typeof window.setSpotlightIntensity === 'function') window.setSpotlightIntensity(v);
        });
      }`;

if (!ui.includes(targetSliders)) {
  console.error('targetSliders not found in orbix-ui.js');
  process.exit(1);
}
ui = ui.replace(targetSliders, replaceSliders);

if (isCRLF) ui = ui.replace(/\n/g, '\r\n');
fs.writeFileSync('orbix-ui.js', ui, 'utf8');
console.log('Successfully updated orbix-ui.js!');
