const fs = require('fs');

// ── 1. Update index.html ──
let html = fs.readFileSync('index.html', 'utf8');
const htmlCRLF = html.includes('\r\n');
if (htmlCRLF) html = html.replace(/\r\n/g, '\n');

// 1a. Add Sunlight & Spotlight controls in 3D Studio toolbar
const targetLightBar = `              <div class="render-dropdown-container" id="photoRenderContainer">`;
const replaceLightBar = `              <div class="lighting-controls-group" style="display:inline-flex;align-items:center;gap:6px;background:rgba(255,255,255,0.92);padding:2px 8px;border-radius:6px;border:1px solid #cbd5e1;font-size:11.5px;font-weight:600;color:#1e293b;">
                <span title="Sunlight Brightness" style="display:inline-flex;align-items:center;gap:3px;">
                  <span>☀️ Sun</span>
                  <input type="range" id="sunlightSlider" min="0" max="3" step="0.1" value="1.4" style="width:60px;cursor:pointer;vertical-align:middle;">
                  <span id="sunlightValLabel" style="font-size:10.5px;color:#475569;min-width:20px;">1.4</span>
                </span>
                <span style="color:#cbd5e1;">|</span>
                <span title="Spotlight Brightness" style="display:inline-flex;align-items:center;gap:3px;">
                  <span>💡 Spot</span>
                  <input type="range" id="spotlightSlider" min="0" max="3" step="0.1" value="1.0" style="width:60px;cursor:pointer;vertical-align:middle;">
                  <span id="spotlightValLabel" style="font-size:10.5px;color:#475569;min-width:20px;">1.0</span>
                </span>
              </div>

              <div class="render-dropdown-container" id="photoRenderContainer">`;

if (html.includes(targetLightBar)) {
  html = html.replace(targetLightBar, replaceLightBar);
} else {
  console.error('Light bar target in index.html not found');
  process.exit(1);
}

// 1b. Update sidebar categories in index.html
const targetSideCats = `          <div class="furn-side-cat-list" id="furnSideCatList">
            <div class="furn-side-cat-item" data-cat="all">All</div>
            <div class="furn-side-cat-item is-active" data-cat="base_unit">Base Units (All)</div>
            <div class="furn-side-cat-item" data-cat="kitchen_fm">🍳 Kitchen FM</div>
            <div class="furn-side-cat-item" data-cat="kitchen_corner">📐 Corner Units</div>
            <div class="furn-side-cat-item" data-cat="kitchen_drawers">🗄️ Kitchen Drawers</div>
            <div class="furn-side-cat-item" data-cat="kitchen_tall">🏛️ Tall Unit</div>
            <div class="furn-side-cat-item" data-cat="kitchen_wall">🎛️ Wall Unit</div>
            <div class="furn-side-cat-item" data-cat="crockery">🍷 Crockery &amp; TV</div>
            <div class="furn-side-cat-item" data-cat="wardrobe">🚪 Wardrobe</div>
            <div class="furn-side-cat-item" data-cat="loft">📦 Loft</div>
          </div>`;

const replaceSideCats = `          <div class="furn-side-cat-list" id="furnSideCatList">
            <div class="furn-side-cat-item is-active" data-cat="kitchen">🍳 KITCHEN</div>
            <div class="furn-side-cat-item" data-cat="tv_crockery">🍷 TV &amp; CROCKERY UNITS</div>
            <div class="furn-side-cat-item" data-cat="wardrobe">🚪 WARDROBE</div>
            <div class="furn-side-cat-item" data-cat="loft">📦 LOFT</div>
            <div class="furn-side-cat-item" data-cat="wall_paneling">🖼️ WALL PANELLING</div>
          </div>`;

if (html.includes(targetSideCats)) {
  html = html.replace(targetSideCats, replaceSideCats);
} else {
  console.error('Sidebar categories in index.html not found');
  process.exit(1);
}

if (htmlCRLF) html = html.replace(/\n/g, '\r\n');
fs.writeFileSync('index.html', html, 'utf8');
console.log('Successfully updated index.html');


// ── 2. Update orbix-ui.js ──
let ui = fs.readFileSync('orbix-ui.js', 'utf8');
const uiCRLF = ui.includes('\r\n');
if (uiCRLF) ui = ui.replace(/\r\n/g, '\n');

// 2a. Remove Download PDF button from Pricing page
const targetPdfBtn = `        '<div class="boq-actions no-print">' +
        '<button class="btn primary" id="boqPrintBtn">📄 Download PDF</button>' +
        '<button class="btn" id="boqXlsxBtn"`;

const replacePdfBtn = `        '<div class="boq-actions no-print">' +
        '<button class="btn" id="boqXlsxBtn"`;

if (ui.includes(targetPdfBtn)) {
  ui = ui.replace(targetPdfBtn, replacePdfBtn);
} else {
  console.error('PDF button target in orbix-ui.js not found');
  process.exit(1);
}

// 2b. GL unit default doorStyle in renderInspector
const targetInspDoor = `        var shuttersCount = (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (fn.dimensions.W > 1200 ? 3 : fn.dimensions.W > 600 ? 2 : 1);
        var drawersCount = (fn.unitConfig && fn.unitConfig.drawers !== undefined) ? fn.unitConfig.drawers : 0;
        var doorStyle = (fn.unitConfig && fn.unitConfig.dstyle) || 'slab';`;

const replaceInspDoor = `        var shuttersCount = (fn.unitConfig && fn.unitConfig.shutters !== undefined) ? fn.unitConfig.shutters : (fn.dimensions.W > 1200 ? 3 : fn.dimensions.W > 600 ? 2 : 1);
        var drawersCount = (fn.unitConfig && fn.unitConfig.drawers !== undefined) ? fn.unitConfig.drawers : 0;
        var isGLUnit = /(^|\\b|_|-|\\s)gl(\\b|_|-|\\s|\\d+|$)/i.test(String(fn.name || '') + ' ' + String(fn.code || '') + ' ' + String(fn.id || ''));
        var doorStyle = (fn.unitConfig && fn.unitConfig.dstyle) || (isGLUnit ? 'glass' : 'slab');
        if (isGLUnit && (!doorStyle || doorStyle === 'slab')) doorStyle = 'glass';`;

if (ui.includes(targetInspDoor)) {
  ui = ui.replace(targetInspDoor, replaceInspDoor);
} else {
  console.error('Inspector door style target in orbix-ui.js not found');
  process.exit(1);
}

// 2c. Update TABS_DATA and getCardsForTab in initFurnishUI
const targetTabsData = `      var currentCat = 'base_unit';
      var currentTab = 'cookscape_fm';
      var isCollapsed = false;
      var isFurnishMenuOpen = false;

      var TABS_DATA = {
        all: [
          { id: 'all_units', label: 'All Units & Cabinets', count: '180+' }
        ],
        base_unit: [
          { id: 'kitchen_fm', label: 'KITCHEN FM', count: '8' },
          { id: 'kitchen_corner', label: 'KITCHEN CORNER UNITS', count: '3' },
          { id: 'kitchen_drawers', label: 'KITCHEN DRAWERS', count: '11' },
          { id: 'kitchen_tall', label: 'KITCHEN TALL UNIT', count: '2' },
          { id: 'cookscape_crockery', label: 'CROCKERY & TV BASE', count: '8' }
        ],
        kitchen_fm: [
          { id: 'kitchen_fm', label: 'All Kitchen FM Units', count: '8' }
        ],
        kitchen_corner: [
          { id: 'kitchen_corner', label: 'Kitchen Corner Units (FCM / FBCM)', count: '3' }
        ],
        kitchen_drawers: [
          { id: 'kitchen_drawers', label: 'Kitchen Drawer Units (D2 / D3 / DS)', count: '11' }
        ],
        kitchen_tall: [
          { id: 'kitchen_tall', label: 'Kitchen Tall Units (TBM 60 / Oven)', count: '2' }
        ],
        crockery: [
          { id: 'crockery_all', label: 'All Crockery Units', count: '15' },
          { id: 'crockery_base', label: 'Crockery Base Units', count: '8' },
          { id: 'crockery_wall', label: 'Crockery Wall Units', count: '7' }
        ],
        tv_unit: [
          { id: 'tv_all', label: 'All TV Units', count: '14' },
          { id: 'tv_base', label: 'TV Base Consoles', count: '8' },
          { id: 'tv_wall', label: 'TV Wall Panels & Units', count: '6' }
        ],
        wardrobe: [
          { id: 'wr_sliding', label: 'Sliding Wardrobes', count: '18' },
          { id: 'wr_hinged', label: 'Hinged 2-Door Wardrobes', count: '26' },
          { id: 'wr_lofts', label: 'Wardrobe Modular Lofts', count: '15' },
          { id: 'wr_panels', label: 'Wall Paneling', count: '10' }
        ],
        wall_unit: [
          { id: 'kitchen_wm', label: 'KITCHEN - WM (Wall Units)', count: '24' },
          { id: 'wall_os', label: 'KITCHEN WALL O/S', count: '8' },
          { id: 'spice_racks', label: 'Spice Racks & Open Box', count: '14' },
          { id: 'pooja_wall', label: 'Pooja & Crockery Wall', count: '12' }
        ]
      };`;

const replaceTabsData = `      var currentCat = 'kitchen';
      var currentTab = 'kitchen_fm';
      var isCollapsed = false;
      var isFurnishMenuOpen = false;

      var TABS_DATA = {
        all: [
          { id: 'all_units', label: 'All Units & Cabinets', count: '180+' }
        ],
        kitchen: [
          { id: 'kitchen_fm', label: 'KITCHEN FM', count: '8' },
          { id: 'kitchen_corner', label: 'KITCHEN CORNER', count: '3' },
          { id: 'kitchen_drawers', label: 'KITCHEN DRAWERS', count: '11' },
          { id: 'kitchen_tall', label: 'KITCHEN TALL UNITS', count: '2' },
          { id: 'kitchen_wall_spice', label: 'KITCHEN WALL UNITS (SPICE RACK)', count: '18' }
        ],
        tv_crockery: [
          { id: 'tv_crockery_base', label: 'BASE', count: '8' },
          { id: 'tv_crockery_wall', label: 'WALL', count: '6' },
          { id: 'tv_crockery_drawers', label: 'DRAWERS', count: '6' },
          { id: 'tv_crockery_openbox', label: 'OPENBOX', count: '4' }
        ],
        wardrobe: [
          { id: 'wardrobe_all', label: 'WARDROBES ALL', count: '34' }
        ],
        loft: [
          { id: 'loft_all', label: 'ALL LOFT', count: '15' }
        ],
        wall_paneling: [
          { id: 'panel_back', label: 'BACK PANEL', count: '6' },
          { id: 'panel_ledges', label: 'LEDGES', count: '4' }
        ]
      };`;

if (ui.includes(targetTabsData)) {
  ui = ui.replace(targetTabsData, replaceTabsData);
} else {
  console.error('TABS_DATA target in orbix-ui.js not found');
  process.exit(1);
}

// 2d. Update getCardsForTab
const targetCardsFn = `      function getCardsForTab(cat, tabId) {
        var curCore = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : Core;
        var catalog = (curCore && curCore.FURNITURE_CATALOG) || [];
        var res = [];

        if (cat === 'all' || tabId === 'all_units') {
          res = catalog.map(mapItemToCard);
        } else if (cat === 'kitchen_fm' || (cat === 'base_unit' && (tabId === 'kitchen_fm' || tabId === 'cookscape_fm'))) {
          res = catalog.filter(function (it) { return it.category === 'kitchen_fm'; }).map(mapItemToCard);
        } else if (cat === 'kitchen_corner' || (cat === 'base_unit' && (tabId === 'kitchen_corner' || tabId === 'cookscape_corner'))) {
          res = catalog.filter(function (it) { return it.category === 'kitchen_corner'; }).map(mapItemToCard);
        } else if (cat === 'kitchen_drawers' || (cat === 'base_unit' && (tabId === 'kitchen_drawers' || tabId === 'cookscape_drawers' || tabId === 'drawer_units'))) {
          res = catalog.filter(function (it) { return it.category === 'kitchen_drawers'; }).map(mapItemToCard);
        } else if (cat === 'kitchen_tall' || (cat === 'base_unit' && tabId === 'kitchen_tall')) {
          res = catalog.filter(function (it) { return it.category === 'kitchen_tall'; }).map(mapItemToCard);
        } else if (cat === 'base_unit') {
          if (tabId === 'cookscape_crockery') {
            res = catalog.filter(function (it) {
              return (it.category === 'crockery' || it.category === 'tv_unit') && (!it.elevation || it.elevation === 0);
            });
          } else {
            res = catalog.filter(function (it) {
              var c = (it.category || '').toLowerCase();
              return c === 'kitchen_fm' || c === 'kitchen_corner' || c === 'kitchen_drawers' || c === 'kitchen_tall' || c === 'kitchen_base';
            });
          }
          res = res.map(mapItemToCard);
        } else if (cat === 'wall_unit') {
          var wallUnits = catalog.filter(function (it) {
            var c = (it.category || '').toLowerCase();
            var n = (it.name || '').toLowerCase();
            var cfg = it.unitConfig || {};
            return c === 'kitchen_wall' || c === 'spice_rack' || c === 'pooja' || cfg.ctype === 'kwall' ||
              n.indexOf('wall') !== -1 || n.indexOf('wm') !== -1 || (it.id && it.id.indexOf('wm') === 0) || (it.id && it.id.indexOf('ctvw') === 0) ||
              n.indexOf('spice') !== -1 || n.indexOf('pooja') !== -1;
          });
          res = wallUnits.map(mapItemToCard);
        } else if (cat === 'wardrobe') {
          var wrUnits = catalog.filter(function (it) {
            var c = (it.category || '').toLowerCase();
            var n = (it.name || '').toLowerCase();
            return c.indexOf('wardrobe') !== -1 || c.indexOf('loft') !== -1 || c.indexOf('panel') !== -1 ||
              n.indexOf('wardrobe') !== -1 || n.indexOf('wr') !== -1 || n.indexOf('loft') !== -1 || n.indexOf('sliding') !== -1;
          });
          res = wrUnits.map(mapItemToCard);
        } else if (cat === 'crockery') {
          var crUnits = catalog.filter(function (it) {
            var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
            return n.indexOf('crockery') !== -1 || (it.id && (it.id.indexOf('ctvb') === 0 || it.id.indexOf('ctvw') === 0));
          });
          res = crUnits.map(mapItemToCard);
        } else if (cat === 'tv_unit') {
          var tvUnits = catalog.filter(function (it) {
            var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
            return n.indexOf('tv') !== -1 || (it.id && (it.id.indexOf('ctvb') === 0 || it.id.indexOf('ctvw') === 0));
          });
          res = tvUnits.map(mapItemToCard);
        } else {
          res = catalog.map(mapItemToCard);
        }

        return res.length ? res : catalog.map(mapItemToCard);
      }`;

const replaceCardsFn = `      function getCardsForTab(cat, tabId) {
        var curCore = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : Core;
        var catalog = (curCore && curCore.FURNITURE_CATALOG) || [];
        var res = [];

        if (cat === 'all' || tabId === 'all_units') {
          res = catalog.map(mapItemToCard);
        } else if (cat === 'kitchen') {
          if (tabId === 'kitchen_fm') {
            res = catalog.filter(function (it) {
              return it.category === 'kitchen_fm' || (it.id && it.id.indexOf('fm') === 0 && it.category !== 'kitchen_corner' && it.category !== 'kitchen_drawers');
            });
          } else if (tabId === 'kitchen_corner') {
            res = catalog.filter(function (it) {
              return it.category === 'kitchen_corner' || (it.id && /(fcm|fbcm)/i.test(it.id)) || (it.name && /(corner|fcm|fbcm)/i.test(it.name));
            });
          } else if (tabId === 'kitchen_drawers') {
            res = catalog.filter(function (it) {
              return it.category === 'kitchen_drawers' || (it.id && /(d2|d3|ds)/i.test(it.id)) || (it.name && /drawer/i.test(it.name) && it.category && it.category.indexOf('kitchen') !== -1);
            });
          } else if (tabId === 'kitchen_tall') {
            res = catalog.filter(function (it) {
              return it.category === 'kitchen_tall' || (it.name && /(tall|tbm|oven)/i.test(it.name));
            });
          } else if (tabId === 'kitchen_wall_spice') {
            res = catalog.filter(function (it) {
              var c = (it.category || '').toLowerCase();
              var n = (it.name || '').toLowerCase();
              return c === 'kitchen_wall' || c === 'spice_rack' || n.indexOf('wm') !== -1 || n.indexOf('spice') !== -1 || n.indexOf('wall') !== -1;
            });
          } else {
            res = catalog.filter(function (it) { return (it.category || '').indexOf('kitchen') !== -1; });
          }
          res = res.map(mapItemToCard);
        } else if (cat === 'tv_crockery') {
          if (tabId === 'tv_crockery_base') {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return (n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1) && (n.indexOf('base') !== -1 || (!it.elevation || it.elevation === 0));
            });
          } else if (tabId === 'tv_crockery_wall') {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return (n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1) && (n.indexOf('wall') !== -1 || (it.elevation && it.elevation >= 1000));
            });
          } else if (tabId === 'tv_crockery_drawers') {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return (n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1) && (n.indexOf('drawer') !== -1 || (it.unitConfig && it.unitConfig.drawers > 0));
            });
          } else if (tabId === 'tv_crockery_openbox') {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return (n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1) && (n.indexOf('open') !== -1 || n.indexOf('box') !== -1 || n.indexOf('niche') !== -1 || (it.unitConfig && it.unitConfig.doorType === 'open'));
            });
          } else {
            res = catalog.filter(function (it) {
              var n = (it.name + ' ' + it.id + ' ' + (it.category || '')).toLowerCase();
              return n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1;
            });
          }
          res = res.map(mapItemToCard);
        } else if (cat === 'wardrobe') {
          res = catalog.filter(function (it) {
            var c = (it.category || '').toLowerCase();
            var n = (it.name || '').toLowerCase();
            return (c === 'wardrobe' || n.indexOf('wardrobe') !== -1 || n.indexOf('wr') !== -1 || n.indexOf('sliding') !== -1) && n.indexOf('loft') === -1 && c.indexOf('loft') === -1;
          }).map(mapItemToCard);
        } else if (cat === 'loft') {
          res = catalog.filter(function (it) {
            var c = (it.category || '').toLowerCase();
            var n = (it.name || '').toLowerCase();
            return c.indexOf('loft') !== -1 || n.indexOf('loft') !== -1;
          }).map(mapItemToCard);
        } else if (cat === 'wall_paneling') {
          if (tabId === 'panel_ledges') {
            res = catalog.filter(function (it) {
              var n = (it.name || '').toLowerCase();
              return n.indexOf('ledge') !== -1 || n.indexOf('shelf') !== -1;
            });
          } else {
            res = catalog.filter(function (it) {
              var c = (it.category || '').toLowerCase();
              var n = (it.name || '').toLowerCase();
              return c === 'wall_paneling' || it.id === 'pnl-back' || n.indexOf('back panel') !== -1 || n.indexOf('wall panel') !== -1;
            });
          }
          res = res.map(mapItemToCard);
        } else {
          res = catalog.map(mapItemToCard);
        }

        return res.length ? res : catalog.map(mapItemToCard);
      }`;

if (ui.includes(targetCardsFn)) {
  ui = ui.replace(targetCardsFn, replaceCardsFn);
} else {
  console.error('getCardsForTab target in orbix-ui.js not found');
  process.exit(1);
}

// 2e. Wire Sunlight and Spotlight listeners
const targetInit3DHook = `      // Double-click on any 3D furniture unit: Focus camera on unit & open in 3D Studio Customizer`;
const replaceInit3DHook = `      // Sunlight & Spotlight intensity sliders
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
      }

      // Double-click on any 3D furniture unit: Focus camera on unit & open in 3D Studio Customizer`;

if (ui.includes(targetInit3DHook)) {
  ui = ui.replace(targetInit3DHook, replaceInit3DHook);
}

if (uiCRLF) ui = ui.replace(/\n/g, '\r\n');
fs.writeFileSync('orbix-ui.js', ui, 'utf8');
console.log('Successfully updated orbix-ui.js');

