import re

path = 'orbix-ui.js'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Define the start pattern and end pattern for getCardsForTab
start_marker = "      function getCardsForTab(cat, tabId) {"
end_marker = "      function renderTabs(cat) {"

idx_start = content.find(start_marker)
idx_end = content.find(end_marker)

if idx_start == -1 or idx_end == -1:
    print("Could not find markers:", idx_start, idx_end)
    exit(1)

new_func = """      function mapItemToCard(it) {
        var w = (it.dimensions && it.dimensions.W) || 600;
        var h = (it.dimensions && it.dimensions.H) || 750;
        var d = (it.dimensions && it.dimensions.D) || 560;
        var variants = [w];
        if (w === 600) variants = [450, 500, 600, 800, 900];
        else if (w === 900) variants = [600, 750, 900, 1050, 1200];
        else if (w === 1200) variants = [900, 1050, 1200, 1500];
        else if (w === 450) variants = [300, 400, 450, 500, 600];
        else if (w === 300) variants = [300, 350, 400, 450];
        else if (w === 1000) variants = [700, 750, 800, 900, 1000, 1050, 1100, 1200];
        else if (w === 1800) variants = [1500, 1800, 2100, 2400];
        var code = it.code || (it.id ? it.id.toUpperCase() : 'UNIT');
        var name = it.name || code;
        return {
          id: it.id,
          code: code,
          name: name,
          badge: String(variants.length),
          selectedLabel: code || name,
          dimensions: { W: w, H: h, D: d },
          category: it.category || 'base_unit',
          unitConfig: it.unitConfig || {},
          materials: it.materials || {},
          variants: variants
        };
      }

      function getCardsForTab(cat, tabId) {
        var curCore = (typeof window !== 'undefined' && window.OrbixCore) ? window.OrbixCore : Core;
        var catalog = (curCore && curCore.FURNITURE_CATALOG) || [];
        var res = [];

        if (cat === 'all' || tabId === 'all_units') {
          res = catalog.map(mapItemToCard);
        } else if (cat === 'base_unit') {
          var baseUnits = catalog.filter(function (it) {
            var c = (it.category || '').toLowerCase();
            var n = (it.name || '').toLowerCase();
            var m = (it.modelType || '').toLowerCase();
            var cfg = it.unitConfig || {};
            return c === 'kitchen_base' || cfg.ctype === 'kbase' || n.indexOf('base') !== -1 || m.indexOf('base') !== -1 ||
              n.indexOf('fm') !== -1 || (it.id && it.id.indexOf('fm') === 0) || (it.id && it.id.indexOf('tbm') === 0) || (it.id && it.id.indexOf('ctvb') === 0) ||
              n.indexOf('corner') !== -1 || n.indexOf('fcm') !== -1;
          });

          if (tabId === 'cookscape_corner') {
            res = baseUnits.filter(function (it) {
              var n = (it.name + ' ' + it.id).toLowerCase();
              return n.indexOf('corner') !== -1 || n.indexOf('fcm') !== -1 || n.indexOf('fbcm') !== -1;
            });
          } else if (tabId === 'cookscape_drawers' || tabId === 'kitchen_drawers' || tabId === 'drawer_units') {
            res = baseUnits.filter(function (it) {
              var n = (it.name + ' ' + it.id).toLowerCase();
              var cfg = it.unitConfig || {};
              return (cfg.drawers && cfg.drawers > 0) || n.indexOf('drawer') !== -1;
            });
          } else if (tabId === 'cookscape_crockery') {
            res = baseUnits.filter(function (it) {
              var n = (it.name + ' ' + it.id).toLowerCase();
              return n.indexOf('crockery') !== -1 || n.indexOf('tv') !== -1 || (it.id && it.id.indexOf('ctvb') === 0);
            });
          } else if (tabId === 'shutter_drawer') {
            res = baseUnits.filter(function (it) {
              var cfg = it.unitConfig || {};
              var n = (it.name + ' ' + it.id).toLowerCase();
              return (cfg.drawers > 0 && cfg.shutters > 0) || (n.indexOf('door') !== -1 && n.indexOf('drawer') !== -1);
            });
          } else if (tabId === 'cookscape_fm') {
            res = baseUnits.filter(function (it) {
              var n = (it.name + ' ' + it.id).toLowerCase();
              return n.indexOf('fm') !== -1 || n.indexOf('tbm') !== -1 || (it.id && it.id.indexOf('fm') === 0) || (it.id && it.id.indexOf('tbm') === 0);
            });
          } else {
            res = baseUnits;
          }
          if (!res || !res.length) res = baseUnits;
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
      }

"""

new_content = content[:idx_start] + new_func + content[idx_end:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Successfully updated getCardsForTab in orbix-ui.js")

