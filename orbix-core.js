/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Architectural Model, Project Schema & Geometry Core
   Version: 1.0.0
   All dimensions are stored in absolute millimeters (mm).
   1 sq ft = 92903.04 mm²  |  1 sq m = 1,000,000 mm²
   ═══════════════════════════════════════════════════════════════════════════════ */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OrbixCore = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var SFT_FACTOR = 92903.04; // 304.8 * 304.8 mm²
  var SQM_FACTOR = 1000000.0; // 1000 * 1000 mm²

  // Unique ID generator
  function uid(prefix) {
    return (prefix || 'id') + '_' + Math.random().toString(36).substr(2, 9);
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     2D Vector & Geometry Utilities
     ───────────────────────────────────────────────────────────────────────────── */
  var Vec2 = {
    create: function (x, y) { return { x: x || 0, y: y || 0 }; },
    clone: function (p) { return { x: p.x, y: p.y }; },
    add: function (a, b) { return { x: a.x + b.x, y: a.y + b.y }; },
    sub: function (a, b) { return { x: a.x - b.x, y: a.y - b.y }; },
    scale: function (p, s) { return { x: p.x * s, y: p.y * s }; },
    dist: function (a, b) {
      var dx = b.x - a.x, dy = b.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    },
    distSq: function (a, b) {
      var dx = b.x - a.x, dy = b.y - a.y;
      return dx * dx + dy * dy;
    },
    len: function (p) { return Math.sqrt(p.x * p.x + p.y * p.y); },
    normalize: function (p) {
      var l = Math.sqrt(p.x * p.x + p.y * p.y);
      return l > 1e-9 ? { x: p.x / l, y: p.y / l } : { x: 0, y: 0 };
    },
    dot: function (a, b) { return a.x * b.x + a.y * b.y; },
    cross: function (a, b) { return a.x * b.y - a.y * b.x; },
    angle: function (a, b) {
      return Math.atan2(b.y - a.y, b.x - a.x);
    },
    // Project point P onto line segment AB, returning { pt, t } where t in [0, 1]
    projectOnSegment: function (p, a, b) {
      var ab = { x: b.x - a.x, y: b.y - a.y };
      var lSq = ab.x * ab.x + ab.y * ab.y;
      if (lSq < 1e-9) return { pt: { x: a.x, y: a.y }, t: 0, dist: Vec2.dist(p, a) };
      var ap = { x: p.x - a.x, y: p.y - a.y };
      var t = Math.max(0, Math.min(1, (ap.x * ab.x + ap.y * ab.y) / lSq));
      var proj = { x: a.x + t * ab.x, y: a.y + t * ab.y };
      return { pt: proj, t: t, dist: Vec2.dist(p, proj) };
    },
    // Polygon signed area (positive for CCW, negative for CW)
    polygonArea: function (pts) {
      var n = pts.length;
      if (n < 3) return 0;
      var area = 0;
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n;
        area += pts[i].x * pts[j].y - pts[j].x * pts[i].y;
      }
      return area / 2.0;
    },
    // Polygon centroid
    polygonCentroid: function (pts) {
      var n = pts.length;
      if (n === 0) return { x: 0, y: 0 };
      var cx = 0, cy = 0, area = 0;
      for (var i = 0; i < n; i++) {
        var j = (i + 1) % n;
        var f = pts[i].x * pts[j].y - pts[j].x * pts[i].y;
        cx += (pts[i].x + pts[j].x) * f;
        cy += (pts[i].y + pts[j].y) * f;
        area += f;
      }
      area = area * 0.5;
      if (Math.abs(area) < 1e-6) {
        var sx = 0, sy = 0;
        for (var k = 0; k < n; k++) { sx += pts[k].x; sy += pts[k].y; }
        return { x: sx / n, y: sy / n };
      }
      return { x: cx / (6 * area), y: cy / (6 * area) };
    },
    // Point in polygon test (Ray-casting)
    pointInPolygon: function (pt, poly) {
      var inside = false;
      for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        var xi = poly[i].x, yi = poly[i].y;
        var xj = poly[j].x, yj = poly[j].y;
        var intersect = ((yi > pt.y) !== (yj > pt.y)) &&
          (pt.x < (xj - xi) * (pt.y - yi) / (yj - yi + 1e-12) + xi);
        if (intersect) inside = !inside;
      }
      return inside;
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Model Types & Price Variant Matrix (from Factory Price Card)
     ───────────────────────────────────────────────────────────────────────────── */
  var PRICE_TIERS = [
    'PRICE 1', 'PRICE 2', 'PRICE 3', 'PRICE 4',
    'LIVE LANE', 'CC MATTE', 'CC GLOSSY', 'SURABHI', 'MR+'
  ];

  var MODEL_RATES_MATRIX = {
    kitchen_wm: {
      id: 'kitchen_wm',
      label: 'Kitcehn - WM',
      description: 'Kitchen Wall Mounted / Wall Units',
      category: 'kitchen_wall',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 1545, 'PRICE 2': 1696, 'PRICE 3': 1785, 'PRICE 4': 1950, 'LIVE LANE': 2034, 'CC MATTE': 2228, 'CC GLOSSY': 2422, 'SURABHI': 2616, 'MR+': 2929 }
    },
    kitchen_fm: {
      id: 'kitchen_fm',
      label: 'Kitcehn - FM',
      description: 'Kitchen Floor Mounted / Base Units',
      category: 'kitchen_base',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 1796, 'PRICE 2': 1969, 'PRICE 3': 1975, 'PRICE 4': 2214, 'LIVE LANE': 2500, 'CC MATTE': 2906, 'CC GLOSSY': 3113, 'SURABHI': 3391, 'MR+': 3786 }
    },
    kitchen_d2d3: {
      id: 'kitchen_d2d3',
      label: 'Kitcehn - D2/D3',
      description: 'Kitchen 2-Drawer / 3-Drawer Tandem Units',
      category: 'kitchen_base',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 1972, 'PRICE 2': 2196, 'PRICE 3': 2714, 'PRICE 4': 2527, 'LIVE LANE': 3600, 'CC MATTE': 3945, 'CC GLOSSY': 4172, 'SURABHI': 4469, 'MR+': 5227 }
    },
    kitchen_os: {
      id: 'kitchen_os',
      label: 'Kitcehn o/s',
      description: 'Kitchen Open Shelves / Open Boxes',
      category: 'kitchen_wall',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 895, 'PRICE 2': 984, 'PRICE 3': 1184, 'PRICE 4': 1236, 'LIVE LANE': 1196, 'CC MATTE': 1250, 'CC GLOSSY': 1567, 'SURABHI': 1786, 'MR+': 1984 }
    },
    spice_rack: {
      id: 'spice_rack',
      label: 'Spice Rack (OPEN BOXES)',
      description: 'Spice Rack Open Storage Units',
      category: 'kitchen_wall',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 2272, 'PRICE 2': 2725, 'PRICE 3': 3996, 'PRICE 4': 4579, 'LIVE LANE': 4650, 'CC MATTE': 4969, 'CC GLOSSY': 5679, 'SURABHI': 5786, 'MR+': 6969 }
    },
    wr_shelves: {
      id: 'wr_shelves',
      label: 'Wr - Modular - ONLY SHELVES',
      description: 'Modular Wardrobe with Internal Shelves',
      category: 'wardrobe',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 1545, 'PRICE 2': 1696, 'PRICE 3': 1872, 'PRICE 4': 1996, 'LIVE LANE': 1827, 'CC MATTE': 1984, 'CC GLOSSY': 2072, 'SURABHI': 2227, 'MR+': 2714 }
    },
    wr_drawers: {
      id: 'wr_drawers',
      label: 'Wr - Modular - 2 DRAWERS',
      description: 'Modular Wardrobe with 2 Internal Drawers',
      category: 'wardrobe',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 1740, 'PRICE 2': 1891, 'PRICE 3': 2067, 'PRICE 4': 2191, 'LIVE LANE': 2022, 'CC MATTE': 2179, 'CC GLOSSY': 2267, 'SURABHI': 2600, 'MR+': 3109 }
    },
    wr_sliding: {
      id: 'wr_sliding',
      label: 'Wr - Modular - SLIDING',
      description: 'Modular Sliding Door Wardrobe',
      category: 'wardrobe',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 1795, 'PRICE 2': 1984, 'PRICE 3': 2195, 'PRICE 4': 2295, 'LIVE LANE': 2345, 'CC MATTE': 2575, 'CC GLOSSY': 2725, 'SURABHI': 2929, 'MR+': 3366 }
    },
    loft_os: {
      id: 'loft_os',
      label: 'Loft - O/S',
      description: 'Overhead Loft / Open Shutter Unit',
      category: 'wardrobe',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 895, 'PRICE 2': 996, 'PRICE 3': 1069, 'PRICE 4': 1227, 'LIVE LANE': 996, 'CC MATTE': 1127, 'CC GLOSSY': 1269, 'SURABHI': 1369, 'MR+': 1567 }
    },
    pooja_cnc: {
      id: 'pooja_cnc',
      label: 'POOJA WITH CNC',
      description: 'Mandir / Pooja Unit with CNC Jali',
      category: 'crockery',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 1969, 'PRICE 2': 2196, 'PRICE 3': 2725, 'PRICE 4': 3169, 'LIVE LANE': 2100, 'CC MATTE': 2260, 'CC GLOSSY': 2433, 'SURABHI': 2848, 'MR+': 3129 }
    },
    tv_cabinet: {
      id: 'tv_cabinet',
      label: 'TV Unit Cabinet',
      description: 'TV Media Console & Cabinet Wall',
      category: 'tv_unit',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 1984, 'PRICE 2': 2724, 'PRICE 3': 2929, 'PRICE 4': 3786, 'LIVE LANE': 3600, 'CC MATTE': 4200, 'CC GLOSSY': 4359, 'SURABHI': 4844, 'MR+': 5679 }
    },
    wall_paneling: {
      id: 'wall_paneling',
      label: 'Wall Paneling',
      description: 'Decorative Fluted Wall Paneling',
      category: 'wall_paneling',
      pricingModel: 'front_area',
      rates: { 'PRICE 1': 796, 'PRICE 2': 845, 'PRICE 3': 936, 'PRICE 4': 969, 'LIVE LANE': 960, 'CC MATTE': 1027, 'CC GLOSSY': 1196, 'SURABHI': 1247, 'MR+': 1427 }
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Default Rate Card & Pricing Formulas
     ───────────────────────────────────────────────────────────────────────────── */
  var DEFAULT_RATE_CARD = {
    version: '1.0',
    currency: 'INR',
    currencySymbol: '₹',
    gstPercent: 18,
    marginPercent: 15,
    selectedTier: null, // null for standard rates; or one of PRICE_TIERS
    priceTiers: PRICE_TIERS,
    modelRates: MODEL_RATES_MATRIX,
    categories: {
      wardrobe: {
        name: 'Wardrobe & Storage',
        pricingModel: 'front_area', // SFT based
        baseRatePerSft: 1700, // INR per sq ft
        loftRatePerSft: 1450,
        depthMultiplier: false, // depth doesn't multiply base area
        standardDepth: 600, // mm
        deepCabinetExtraPer100mm: 120 // extra per SFT if depth > standard
      },
      kitchen_base: {
        name: 'Kitchen Base Units',
        pricingModel: 'running_ft', // running feet based
        baseRatePerRft: 2800,
        standardDepth: 600,
        standardHeight: 850
      },
      kitchen_wall: {
        name: 'Kitchen Wall Units',
        pricingModel: 'running_ft',
        baseRatePerRft: 2100,
        standardDepth: 350,
        standardHeight: 700
      },
      kitchen_tall: {
        name: 'Kitchen Tall Unit',
        pricingModel: 'front_area',
        baseRatePerSft: 2200
      },
      tv_unit: {
        name: 'TV & Media Wall',
        pricingModel: 'front_area',
        baseRatePerSft: 1650
      },
      crockery: {
        name: 'Crockery Display',
        pricingModel: 'front_area',
        baseRatePerSft: 1950
      },
      vanity: {
        name: 'Vanity / Dressing Table',
        pricingModel: 'front_area',
        baseRatePerSft: 1600
      },
      shoe_rack: {
        name: 'Shoe Rack',
        pricingModel: 'front_area',
        baseRatePerSft: 1400
      },
      civil_walls: {
        name: 'Brickwork / Drywall',
        pricingModel: 'wall_area',
        baseRatePerSft: 180
      },
      flooring: {
        name: 'Tiling & Flooring',
        pricingModel: 'floor_area',
        baseRatePerSft: 140
      },
      false_ceiling: {
        name: 'Gypsum False Ceiling',
        pricingModel: 'floor_area',
        baseRatePerSft: 130
      },
      painting: {
        name: 'Interior Painting',
        pricingModel: 'surface_area',
        baseRatePerSft: 45
      }
    },
    materials: {
      'MDF 1135': { name: 'White Matte', rateAddPerSft: 0 },
      'MDF 3410': { name: 'Walnut Woodgrain', rateAddPerSft: 60 },
      'MDF 2204': { name: 'Sonoma Oak', rateAddPerSft: 50 },
      'MDF 6601': { name: 'Gloss White Acrylic', rateAddPerSft: 250 },
      'MDF 7701': { name: 'Sage Green Matte', rateAddPerSft: 110 },
      'MDF 7707': { name: 'Navy Blue Matte', rateAddPerSft: 110 },
      'MDF 8801': { name: 'Concrete Look', rateAddPerSft: 150 }
    },
    laborRates: {
      installationPerSft: 85,
      carcassAssemblyPerSft: 65,
      transportLumpSum: 4500
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Architectural Element Factory Functions
     ───────────────────────────────────────────────────────────────────────────── */
  function createWall(opts) {
    opts = opts || {};
    return {
      id: opts.id || uid('wall'),
      start: { x: opts.start ? opts.start.x : 0, y: opts.start ? opts.start.y : 0 },
      end: { x: opts.end ? opts.end.x : 0, y: opts.end ? opts.end.y : 0 },
      thickness: opts.thickness !== undefined ? opts.thickness : 150, // standard 150mm wall (or 230mm brick)
      height: opts.height !== undefined ? opts.height : 2800, // 2.8m ceiling height
      material: opts.material || 'plaster_white',
      openings: opts.openings ? opts.openings.slice() : [],
      pinned: !!opts.pinned,
      startLocked: opts.startLocked !== undefined ? !!opts.startLocked : true,
      endLocked: opts.endLocked !== undefined ? !!opts.endLocked : true
    };
  }

  function createOpening(opts) {
    opts = opts || {};
    var type = opts.type === 'window' ? 'window' : 'door';
    return {
      id: opts.id || uid(type),
      type: type,
      wallId: opts.wallId || null,
      offset: opts.offset !== undefined ? opts.offset : 600, // mm along wall from start
      width: opts.width !== undefined ? opts.width : (type === 'door' ? 900 : 1200),
      height: opts.height !== undefined ? opts.height : (type === 'door' ? 2100 : 1200),
      sillHeight: opts.sillHeight !== undefined ? opts.sillHeight : (type === 'door' ? 0 : 900),
      swing: opts.swing || 'in-left', // 'in-left' | 'in-right' | 'out-left' | 'out-right' | 'sliding'
      frameThick: opts.frameThick !== undefined ? opts.frameThick : 75,
      label: opts.label || (type === 'door' ? 'D1' : 'W1'),
      glazing: opts.glazing || 'clear'
    };
  }

  function createRoom(opts) {
    opts = opts || {};
    return {
      id: opts.id || uid('room'),
      name: opts.name || 'Room',
      type: opts.type || 'bedroom', // 'living' | 'bedroom' | 'kitchen' | 'dining' | 'bathroom' | 'balcony' | 'utility'
      wallIds: opts.wallIds ? opts.wallIds.slice() : [],
      polygon: opts.polygon ? opts.polygon.map(Vec2.clone) : [],
      areaSqMm: opts.areaSqMm || 0,
      areaSqM: opts.areaSqM || 0,
      areaSqFt: opts.areaSqFt || 0,
      floorFinish: opts.floorFinish || 'vitrified_tile',
      ceilingHeight: opts.ceilingHeight || 2800,
      falseCeiling: opts.falseCeiling !== undefined ? opts.falseCeiling : false,
      color: opts.color || '#E8F1F5'
    };
  }

  function isWallUnitCategory(category, name) {
    var cat = (category || '').toLowerCase();
    var nm = (name || '').toLowerCase();
    return cat.indexOf('wall') !== -1 || cat.indexOf('overhead') !== -1 || cat.indexOf('spice') !== -1 ||
           cat.indexOf('loft') !== -1 || cat === 'wm-01' || cat === 'k_wall' || cat === 'kitchen_wall' ||
           cat === 'crockery_wall' || cat === 'spice_rack' || cat === 'loft_os' || cat === 'kitchen_os' ||
           nm.indexOf('wall') !== -1 || nm.indexOf('overhead') !== -1 || nm.indexOf('spice rack') !== -1 ||
           nm.indexOf('spice_rack') !== -1 || nm.indexOf('loft') !== -1;
  }

  function createFurniturePlacement(opts) {
    opts = opts || {};
    var cat = (opts.category || 'wardrobe').toLowerCase();
    var isWallUnit = isWallUnitCategory(opts.category, opts.name);
    var defElev = isWallUnit ? 1500 : 0;
    var elev = (opts.elevation !== undefined && opts.elevation !== null && opts.elevation !== '') ?
      parseFloat(opts.elevation) :
      ((opts.pos && opts.pos.z !== undefined && opts.pos.z !== null && opts.pos.z !== 0) ?
        parseFloat(opts.pos.z) : defElev);

    var numShutters = (opts.unitConfig && opts.unitConfig.shutters !== undefined) ?
      parseInt(opts.unitConfig.shutters) :
      ((opts.dimensions && opts.dimensions.W > 1200) ? 3 : 2);
    var numDrawers = (opts.unitConfig && opts.unitConfig.drawers !== undefined) ?
      parseInt(opts.unitConfig.drawers) : 0;

    var initColors = opts.shutterColors ? opts.shutterColors.slice() : [];
    var initMats = opts.shutterMaterials ? opts.shutterMaterials.slice() : [];
    var initStates = opts.shutterStates ? opts.shutterStates.slice() : [];
    var initDrawerStates = opts.drawerStates ? opts.drawerStates.slice() : [];
    var defColor = (opts.shutter && opts.shutter.finish) || opts.shutterFinish || '#6E4E35';
    var defMat = (opts.shutter && opts.shutter.material) || opts.shutterMaterial || 'laminate';

    while (initColors.length < numShutters) initColors.push(defColor);
    while (initMats.length < numShutters) initMats.push(defMat);
    while (initStates.length < numShutters) initStates.push(false);
    while (initDrawerStates.length < numDrawers) initDrawerStates.push(false);

    return {
      id: opts.id || uid('furn'),
      name: opts.name || 'Modular Unit',
      category: opts.category || 'wardrobe',
      roomId: opts.roomId || null,
      pos: { x: opts.pos ? opts.pos.x : 0, y: opts.pos ? opts.pos.y : 0, z: elev },
      elevation: elev,
      rotY: opts.rotY || 0,
      dimensions: {
        W: opts.dimensions ? opts.dimensions.W : (isWallUnit ? 1200 : 1200),
        H: opts.dimensions ? opts.dimensions.H : (isWallUnit ? 600 : 2100),
        D: opts.dimensions ? opts.dimensions.D : (isWallUnit ? 350 : 600)
      },
      shutterColors: initColors,
      shutterMaterials: initMats,
      shutterStates: initStates,
      drawerStates: initDrawerStates,
      materials: opts.materials || {
        shutter: {
          material: defMat,
          finish: defColor
        },
        carcass: {
          material: (opts.carcass && opts.carcass.material) || opts.carcassMaterial || 'BWP_18MM',
          finish: (opts.carcass && opts.carcass.finish) || opts.carcassFinish || 'Absolute White'
        }
      },
      // Links directly to Cupboard CAD parametric configuration
      unitConfig: opts.unitConfig || null,
      pricingOverrides: opts.pricingOverrides || null,
      notes: opts.notes || ''
    };
  }

  // Calculates corner angle in degrees between two walls meeting at jointPt
  function calculateCornerAngle(w1, w2, jointPt) {
    if (!w1 || !w2 || !jointPt) return 90;
    var d1s = Vec2.dist(w1.start, jointPt);
    var p1 = d1s < 25 ? w1.end : w1.start;
    var v1 = { x: p1.x - jointPt.x, y: p1.y - jointPt.y };
    var l1 = Math.hypot(v1.x, v1.y);
    if (l1 < 1e-6) return 90;
    v1.x /= l1; v1.y /= l1;

    var d2s = Vec2.dist(w2.start, jointPt);
    var p2 = d2s < 25 ? w2.end : w2.start;
    var v2 = { x: p2.x - jointPt.x, y: p2.y - jointPt.y };
    var l2 = Math.hypot(v2.x, v2.y);
    if (l2 < 1e-6) return 90;
    v2.x /= l2; v2.y /= l2;

    var dot = Math.max(-1, Math.min(1, v1.x * v2.x + v1.y * v2.y));
    var rad = Math.acos(dot);
    return Math.round(rad * (180 / Math.PI));
  }

  // Returns 4 2D corner vertices of rotated furniture rectangle (Oriented Bounding Box)
  function getFurniturePolygon(f) {
    var w = (f.dimensions && f.dimensions.W) || 1200;
    var d = (f.dimensions && f.dimensions.D) || 600;
    var ang = f.rotY || 0;
    var cosA = Math.cos(ang), sinA = Math.sin(ang);
    var ux = cosA * (w / 2), uy = sinA * (w / 2);
    var vx = -sinA * (d / 2), vy = cosA * (d / 2);
    var cx = f.pos.x, cy = f.pos.y;
    return [
      { x: cx - ux - vx, y: cy - uy - vy },
      { x: cx + ux - vx, y: cy + uy - vy },
      { x: cx + ux + vx, y: cy + uy + vy },
      { x: cx - ux + vx, y: cy - uy + vy }
    ];
  }

  // SAT (Separating Axis Theorem) collision test between two convex 2D polygons
  function polygonsIntersect(poly1, poly2, tolerance) {
    tolerance = tolerance !== undefined ? tolerance : 5;
    var polys = [poly1, poly2];
    for (var p = 0; p < polys.length; p++) {
      var poly = polys[p];
      for (var i = 0; i < poly.length; i++) {
        var p1 = poly[i];
        var p2 = poly[(i + 1) % poly.length];
        var edge = { x: p2.x - p1.x, y: p2.y - p1.y };
        var normal = { x: -edge.y, y: edge.x };
        var len = Math.hypot(normal.x, normal.y);
        if (len < 1e-6) continue;
        normal.x /= len; normal.y /= len;

        var min1 = Infinity, max1 = -Infinity;
        for (var a = 0; a < poly1.length; a++) {
          var dot1 = poly1[a].x * normal.x + poly1[a].y * normal.y;
          if (dot1 < min1) min1 = dot1;
          if (dot1 > max1) max1 = dot1;
        }

        var min2 = Infinity, max2 = -Infinity;
        for (var b = 0; b < poly2.length; b++) {
          var dot2 = poly2[b].x * normal.x + poly2[b].y * normal.y;
          if (dot2 < min2) min2 = dot2;
          if (dot2 > max2) max2 = dot2;
        }

        if (max1 - tolerance < min2 || max2 - tolerance < min1) {
          return false;
        }
      }
    }
    return true;
  }

  // Checks if furniture unit f collides with any other unit in allFurn
  function checkFurnitureCollision(f, allFurn, ignoreId) {
    if (!f || !allFurn || !allFurn.length) return { collided: false };
    var polyF = getFurniturePolygon(f);
    var elev1 = f.elevation !== undefined ? f.elevation : ((f.pos && f.pos.z) || 0);
    var h1 = (f.dimensions && f.dimensions.H) || 2100;
    var top1 = elev1 + h1;

    for (var i = 0; i < allFurn.length; i++) {
      var other = allFurn[i];
      if (other.id === f.id || (ignoreId && other.id === ignoreId)) continue;
      var elev2 = other.elevation !== undefined ? other.elevation : ((other.pos && other.pos.z) || 0);
      var h2 = (other.dimensions && other.dimensions.H) || 2100;
      var top2 = elev2 + h2;

      // If vertical elevation ranges do not overlap (e.g. wall cabinet above floor base unit), allow
      if (top1 <= elev2 + 5 || top2 <= elev1 + 5) continue;

      var polyOther = getFurniturePolygon(other);
      if (polygonsIntersect(polyF, polyOther, 5)) {
        return { collided: true, other: other };
      }
    }
    return { collided: false };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Project Container & Schema
     ───────────────────────────────────────────────────────────────────────────── */
  function createProject(title) {
    return {
      schemaVersion: '1.0.0',
      id: uid('proj'),
      meta: {
        title: title || 'Residential Project',
        clientName: '',
        siteAddress: '',
        designerName: '',
        dateCreated: new Date().toISOString(),
        dateModified: new Date().toISOString(),
        status: 'draft', // 'draft' | 'reviewed' | 'issued' | 'approved'
        notes: ''
      },
      plan: {
        gridSize: 100, // mm
        majorGridSize: 1000, // 1m
        snapToGrid: true,
        snapToAngle: true,
        snapDistance: 150, // mm tolerance for snapping
        walls: [],
        openings: [],
        rooms: [],
        furniture: []
      },
      rateCard: JSON.parse(JSON.stringify(DEFAULT_RATE_CARD)),
      quotationHistory: []
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Wall Geometry, Splitting & Openings Helpers
     ───────────────────────────────────────────────────────────────────────────── */
  function wallLength(w) {
    return Vec2.dist(w.start, w.end);
  }

  function wallAngle(w) {
    return Vec2.angle(w.start, w.end);
  }

  function wallDirection(w) {
    var l = wallLength(w);
    if (l < 1e-9) return { x: 1, y: 0 };
    return { x: (w.end.x - w.start.x) / l, y: (w.end.y - w.start.y) / l };
  }

  function wallNormal(w) {
    var dir = wallDirection(w);
    return { x: -dir.y, y: dir.x };
  }

  // Gets the 4 corners of the 2D wall rectangle
  function wallPolygon(w) {
    var halfT = (w.thickness || 150) / 2.0;
    var norm = wallNormal(w);
    var p1 = { x: w.start.x + norm.x * halfT, y: w.start.y + norm.y * halfT };
    var p2 = { x: w.end.x + norm.x * halfT, y: w.end.y + norm.y * halfT };
    var p3 = { x: w.end.x - norm.x * halfT, y: w.end.y - norm.y * halfT };
    var p4 = { x: w.start.x - norm.x * halfT, y: w.start.y - norm.y * halfT };
    return [p1, p2, p3, p4];
  }

  // Comprehensive placement overlap detector against adjacent furniture, wall cores, and openings
  function checkPlacementOverlap(f, plan, ignoreId) {
    if (!f || !plan) return { hasOverlap: false };
    var fId = ignoreId || f.id;

    // 1. Check collision with other furniture units (OBB + 3D elevation)
    var furnList = plan.furniture || [];
    var furnCol = checkFurnitureCollision(f, furnList, fId);
    if (furnCol.collided) {
      return { hasOverlap: true, type: "furniture", target: furnCol.other };
    }

    // 2. Check collision / penetration into walls
    var walls = plan.walls || [];
    var polyF = getFurniturePolygon(f);
    var elev1 = (f.elevation !== undefined && f.elevation !== null && f.elevation !== "") ?
      parseFloat(f.elevation) :
      ((f.pos && f.pos.z !== undefined) ? parseFloat(f.pos.z) : 0);
    var h1 = (f.dimensions && f.dimensions.H) || 2100;
    var top1 = elev1 + h1;

    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var wallH = w.height || 2800;
      if (top1 <= 0 || elev1 >= wallH) continue;

      var wallPoly = wallPolygon(w);
      // Tolerance = 25mm: touching the wall surface (intentional contact) does NOT collide;
      // penetration deeper than 25mm into the wall core triggers overlap
      if (polygonsIntersect(polyF, wallPoly, 25)) {
        return { hasOverlap: true, type: "wall", target: w };
      }
    }

    // 3. Check collision with door & window openings
    var openings = plan.openings || [];
    for (var j = 0; j < openings.length; j++) {
      var op = openings[j];
      var opWall = null;
      for (var k = 0; k < walls.length; k++) {
        if (walls[k].id === op.wallId) { opWall = walls[k]; break; }
      }
      if (!opWall) continue;

      var opElev = op.elevation !== undefined ? op.elevation : (op.type === "door" ? 0 : 900);
      var opH = op.height || (op.type === "door" ? 2100 : 1200);
      var opTop = opElev + opH;
      if (top1 <= opElev + 10 || opTop <= elev1 + 10) continue;

      var dir = wallDirection(opWall);
      var norm = wallNormal(opWall);
      var halfT = ((opWall.thickness || 150) / 2.0) + 15;
      var opStart = {
        x: opWall.start.x + dir.x * (op.offset || 0),
        y: opWall.start.y + dir.y * (op.offset || 0)
      };
      var opEnd = {
        x: opStart.x + dir.x * (op.width || 900),
        y: opStart.y + dir.y * (op.width || 900)
      };
      var opPoly = [
        { x: opStart.x + norm.x * halfT, y: opStart.y + norm.y * halfT },
        { x: opEnd.x + norm.x * halfT, y: opEnd.y + norm.y * halfT },
        { x: opEnd.x - norm.x * halfT, y: opEnd.y - norm.y * halfT },
        { x: opStart.x - norm.x * halfT, y: opStart.y - norm.y * halfT }
      ];
      if (polygonsIntersect(polyF, opPoly, 15)) {
        return { hasOverlap: true, type: "opening", target: op };
      }
    }

    return { hasOverlap: false };
  }
  // Splits a wall at a given point, transferring openings to respective new walls
  function splitWall(project, wallId, splitPt) {
    var wIdx = -1;
    for (var i = 0; i < project.plan.walls.length; i++) {
      if (project.plan.walls[i].id === wallId) { wIdx = i; break; }
    }
    if (wIdx === -1) return null;
    var w = project.plan.walls[wIdx];
    var l = wallLength(w);
    var proj = Vec2.projectOnSegment(splitPt, w.start, w.end);
    var splitOffset = proj.t * l;

    if (splitOffset < 200 || splitOffset > l - 200) {
      // Too close to either endpoint, do not split
      return null;
    }

    var w1 = createWall({
      start: Vec2.clone(w.start),
      end: Vec2.clone(proj.pt),
      thickness: w.thickness,
      height: w.height,
      material: w.material
    });

    var w2 = createWall({
      start: Vec2.clone(proj.pt),
      end: Vec2.clone(w.end),
      thickness: w.thickness,
      height: w.height,
      material: w.material
    });

    // Re-assign openings
    for (var j = 0; j < project.plan.openings.length; j++) {
      var op = project.plan.openings[j];
      if (op.wallId === wallId) {
        if (op.offset + op.width / 2 <= splitOffset) {
          op.wallId = w1.id;
        } else {
          op.wallId = w2.id;
          op.offset = Math.max(0, op.offset - splitOffset);
        }
      }
    }

    // Replace old wall with w1 and w2
    project.plan.walls.splice(wIdx, 1, w1, w2);
    return { wall1: w1, wall2: w2 };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Planar Graph Subdivision Helpers for Multi-Room & T-Junctions
     ───────────────────────────────────────────────────────────────────────────── */
  function segmentIntersection(p1, p2, p3, p4, tol) {
    tol = tol || 1e-4;
    var dx1 = p2.x - p1.x, dy1 = p2.y - p1.y;
    var dx2 = p4.x - p3.x, dy2 = p4.y - p3.y;
    var denom = dx1 * dy2 - dy1 * dx2;
    if (Math.abs(denom) < 1e-7) return null; // parallel or colinear

    var t = ((p3.x - p1.x) * dy2 - (p3.y - p1.y) * dx2) / denom;
    var u = ((p3.x - p1.x) * dy1 - (p3.y - p1.y) * dx1) / denom;

    if (t > tol && t < 1.0 - tol && u > tol && u < 1.0 - tol) {
      return {
        pt: { x: p1.x + t * dx1, y: p1.y + dy1 * t },
        t1: t,
        t2: u
      };
    }
    return null;
  }

  function projectPointOnSegment(p, a, b) {
    var dx = b.x - a.x, dy = b.y - a.y;
    var l2 = dx * dx + dy * dy;
    if (l2 < 1e-9) return { pt: { x: a.x, y: a.y }, t: 0, dist: Math.hypot(p.x - a.x, p.y - a.y) };
    var t = ((p.x - a.x) * dx + (p.y - a.y) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    var proj = { x: a.x + t * dx, y: a.y + t * dy };
    return { pt: proj, t: t, dist: Math.hypot(p.x - proj.x, p.y - proj.y) };
  }

  function subdivideWalls(walls, snapTol) {
    snapTol = snapTol || 80;
    var cuts = [];
    for (var i = 0; i < walls.length; i++) {
      cuts.push([0, 1]);
    }

    // 1. Cross segment-segment intersections
    for (var i = 0; i < walls.length; i++) {
      for (var j = i + 1; j < walls.length; j++) {
        var inter = segmentIntersection(walls[i].start, walls[i].end, walls[j].start, walls[j].end);
        if (inter) {
          cuts[i].push(inter.t1);
          cuts[j].push(inter.t2);
        }
      }
    }

    // 2. T-junctions: endpoints of wall i meeting the interior of wall j
    for (var i = 0; i < walls.length; i++) {
      var pts = [walls[i].start, walls[i].end];
      for (var p = 0; p < 2; p++) {
        var pt = pts[p];
        for (var j = 0; j < walls.length; j++) {
          if (i === j) continue;
          var wj = walls[j];
          var proj = projectPointOnSegment(pt, wj.start, wj.end);
          var l = Math.hypot(wj.end.x - wj.start.x, wj.end.y - wj.start.y);
          var distFromEndpoints = Math.min(proj.t * l, (1 - proj.t) * l);
          if (proj.dist <= snapTol && distFromEndpoints > 40) {
            cuts[j].push(proj.t);
          }
        }
      }
    }

    // 3. Build linear subsegments
    var subSegments = [];
    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      // Deduplicate and sort cut parameters
      var rawCuts = cuts[i].map(function (t) { return Math.round(t * 10000) / 10000; });
      var uniqueTs = [];
      for (var u = 0; u < rawCuts.length; u++) {
        if (uniqueTs.indexOf(rawCuts[u]) === -1) uniqueTs.push(rawCuts[u]);
      }
      uniqueTs.sort(function (a, b) { return a - b; });

      for (var k = 0; k < uniqueTs.length - 1; k++) {
        var tA = uniqueTs[k], tB = uniqueTs[k + 1];
        if (tB - tA < 0.001) continue;
        var pA = {
          x: w.start.x + tA * (w.end.x - w.start.x),
          y: w.start.y + tA * (w.end.y - w.start.y)
        };
        var pB = {
          x: w.start.x + tB * (w.end.x - w.start.x),
          y: w.start.y + tB * (w.end.y - w.start.y)
        };
        if (Math.hypot(pB.x - pA.x, pB.y - pA.y) > 40) {
          subSegments.push({
            wallId: w.id,
            thickness: w.thickness,
            height: w.height,
            start: pA,
            end: pB
          });
        }
      }
    }
    return subSegments;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Room Boundary Detection (Planar Face Traversal)
     ───────────────────────────────────────────────────────────────────────────── */
  function detectRooms(project) {
    var walls = project.plan.walls || [];
    if (walls.length < 3) {
      project.plan.rooms = [];
      return [];
    }

    // Step 1: Subdivide walls at all cross-junctions and T-junctions
    var segments = subdivideWalls(walls, 80);
    if (segments.length < 3) {
      project.plan.rooms = [];
      return [];
    }

    // Step 2: Build vertex adjacency map with vertex clustering
    var vertices = [];
    var TOL = 60; // 60 mm snapping tolerance for vertices

    function findOrAddVertex(pt) {
      for (var i = 0; i < vertices.length; i++) {
        if (Vec2.dist(pt, vertices[i].pt) < TOL) {
          return i;
        }
      }
      vertices.push({ id: vertices.length, pt: Vec2.clone(pt), edges: [] });
      return vertices.length - 1;
    }

    var halfEdges = []; // directed edges
    for (var s = 0; s < segments.length; s++) {
      var seg = segments[s];
      var vStart = findOrAddVertex(seg.start);
      var vEnd = findOrAddVertex(seg.end);
      if (vStart === vEnd) continue;

      // Directed edge 0: start -> end
      var e0 = {
        id: halfEdges.length,
        wallId: seg.wallId,
        from: vStart,
        to: vEnd,
        angle: Vec2.angle(vertices[vStart].pt, vertices[vEnd].pt),
        visited: false,
        twin: null
      };
      halfEdges.push(e0);

      // Directed edge 1: end -> start
      var e1 = {
        id: halfEdges.length,
        wallId: seg.wallId,
        from: vEnd,
        to: vStart,
        angle: Vec2.angle(vertices[vEnd].pt, vertices[vStart].pt),
        visited: false,
        twin: e0
      };
      e0.twin = e1;
      halfEdges.push(e1);

      vertices[vStart].edges.push(e0);
      vertices[vEnd].edges.push(e1);
    }

    // Step 3: Sort outgoing edges around each vertex CCW (ascending order of angle)
    for (var v = 0; v < vertices.length; v++) {
      vertices[v].edges.sort(function (a, b) { return a.angle - b.angle; });
    }

    // Step 4: Find cycles using Left-Face traversal (CCW interior loops)
    var cycles = [];
    for (var e = 0; e < halfEdges.length; e++) {
      var edge = halfEdges[e];
      if (edge.visited) continue;

      var cycle = [];
      var curr = edge;
      var guard = 0;
      var closed = false;

      while (!curr.visited && guard++ < 300) {
        curr.visited = true;
        cycle.push(curr);

        // At curr.to vertex, take the leftmost turn (the edge right before curr.twin in CCW order)
        var toVert = vertices[curr.to];
        var twin = curr.twin;
        var twinIdx = toVert.edges.indexOf(twin);
        if (twinIdx === -1) break;

        // In CCW sorted order, the leftmost turn from incoming edge is the previous one in the circular array
        var nextIdx = (twinIdx - 1 + toVert.edges.length) % toVert.edges.length;
        var nextEdge = toVert.edges[nextIdx];

        if (nextEdge === edge) {
          closed = true;
          break;
        }
        curr = nextEdge;
      }

      if (closed && cycle.length >= 3) {
        var poly = cycle.map(function (ce) { return Vec2.clone(vertices[ce.from].pt); });
        var area = Vec2.polygonArea(poly);
        // Positive area loops represent interior faces in CCW orientation
        if (area > 500000) { // minimum 0.5 m² to be a valid room
          var wallIds = [];
          for (var k = 0; k < cycle.length; k++) {
            if (wallIds.indexOf(cycle[k].wallId) === -1) wallIds.push(cycle[k].wallId);
          }
          var perim = 0;
          for (var pIdx = 0; pIdx < poly.length; pIdx++) {
            var pNext = poly[(pIdx + 1) % poly.length];
            perim += Vec2.dist(poly[pIdx], pNext);
          }
          cycles.push({
            polygon: poly,
            areaSqMm: area,
            areaSqM: area / SQM_FACTOR,
            areaSqFt: area / SFT_FACTOR,
            perimeter: perim,
            wallIds: wallIds
          });
        }
      }
    }

    // Step 5: Update existing room entities or create new ones with smart apartment naming
    var updatedRooms = [];
    var existingRooms = project.plan.rooms || [];
    var unassignedCycles = [];

    for (var c = 0; c < cycles.length; c++) {
      var cyc = cycles[c];
      var center = Vec2.polygonCentroid(cyc.polygon);
      var matchedRoom = null;

      // Match with an existing room by centroid containment or center distance
      for (var er = 0; er < existingRooms.length; er++) {
        var exR = existingRooms[er];
        if (exR.polygon && (Vec2.pointInPolygon(center, exR.polygon) || Vec2.dist(center, Vec2.polygonCentroid(exR.polygon)) < 500)) {
          matchedRoom = exR;
          break;
        }
      }

      if (matchedRoom) {
        matchedRoom.polygon = cyc.polygon;
        matchedRoom.areaSqMm = cyc.areaSqMm;
        matchedRoom.areaSqM = cyc.areaSqM;
        matchedRoom.areaSqFt = cyc.areaSqFt;
        matchedRoom.perimeter = cyc.perimeter;
        matchedRoom.wallIds = cyc.wallIds;
        updatedRooms.push(matchedRoom);
      } else {
        unassignedCycles.push(cyc);
      }
    }

    // Contextual naming pool for newly detected residential apartment rooms (e.g. 2BHK/3BHK)
    var apartmentPresets = [
      'Living / Hall',
      'Master Bedroom',
      'Bedroom 2',
      'Modular Kitchen',
      'Dining Room',
      'Guest Bedroom',
      'Foyer / Entry',
      'Bathroom 1'
    ];

    // Sort unassigned cycles by area descending to assign larger rooms to Living/Master Bed
    unassignedCycles.sort(function (a, b) { return b.areaSqM - a.areaSqM; });

    for (var u = 0; u < unassignedCycles.length; u++) {
      var uCyc = unassignedCycles[u];
      var roomIdx = updatedRooms.length;
      var roomName = (roomIdx < apartmentPresets.length) ? apartmentPresets[roomIdx] : ('Room ' + (roomIdx + 1));
      if (cycles.length === 1) {
        roomName = 'Room 1';
      }

      var newRoom = createRoom({
        name: roomName,
        polygon: uCyc.polygon,
        areaSqMm: uCyc.areaSqMm,
        areaSqM: uCyc.areaSqM,
        areaSqFt: uCyc.areaSqFt,
        perimeter: uCyc.perimeter,
        wallIds: uCyc.wallIds
      });
      updatedRooms.push(newRoom);
    }

    // Step 6: Auto-associate placed furniture units with their enclosing room
    var furniture = project.plan.furniture || [];
    for (var f = 0; f < furniture.length; f++) {
      var item = furniture[f];
      if (item.pos) {
        for (var rm = 0; rm < updatedRooms.length; rm++) {
          if (Vec2.pointInPolygon(item.pos, updatedRooms[rm].polygon)) {
            // If item has no roomId or its existing roomId is not in updatedRooms, associate it
            var hasValidRoom = updatedRooms.some(function (r) { return r.id === item.roomId; });
            if (!item.roomId || !hasValidRoom) {
              item.roomId = updatedRooms[rm].id;
            }
            break;
          }
        }
      }
    }

    project.plan.rooms = updatedRooms;
    return updatedRooms;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Automatic Quotation Calculation Engine
     ═════════════════════════════════════════════════════════════════════════════
     Primary Rule (from Prompt Specification):
     Wardrobe Area (SFT) = Width_mm * Height_mm / 92903.04
     Base Price = Unrounded SFT * Configured Rate per SFT.
     Depth does NOT multiply the front-area formula.
     ───────────────────────────────────────────────────────────────────────────── */
  function resolveModelType(item) {
    if (item.modelType && MODEL_RATES_MATRIX[item.modelType]) return item.modelType;
    var id = (item.id || '').toLowerCase();
    var cat = (item.category || '').toLowerCase();
    var name = (item.name || '').toLowerCase();

    if (id.indexOf('slide') !== -1 || name.indexOf('sliding') !== -1) return 'wr_sliding';
    if (name.indexOf('pooja') !== -1 || id.indexOf('pooja') !== -1) return 'pooja_cnc';
    if (name.indexOf('panel') !== -1 || cat === 'wall_paneling') return 'wall_paneling';
    if (name.indexOf('spice') !== -1 || id.indexOf('spice') !== -1) return 'spice_rack';
    if (id.indexOf('loft') !== -1 || name.indexOf('loft') !== -1) return 'loft_os';
    if (name.indexOf('open shel') !== -1 || id === 'kitchen_os') return 'kitchen_os';
    if (id === 'k_wall' || cat === 'kitchen_wall') return 'kitchen_wm';
    if (id === 'k_island' || name.indexOf('drawer') !== -1 || id === 'kitchen_d2d3') {
      if (cat === 'wardrobe') return 'wr_drawers';
      return 'kitchen_d2d3';
    }
    if (id === 'k_base' || id === 'k_tall' || cat === 'kitchen_base' || cat === 'kitchen_tall') return 'kitchen_fm';
    if (id === 'w3d' || id === 'w4d') return 'wr_drawers';
    if (id === 'w2d' || cat === 'wardrobe') return 'wr_shelves';
    if (cat === 'tv_unit' || name.indexOf('tv') !== -1) return 'tv_cabinet';
    if (cat === 'crockery') return 'pooja_cnc';
    if (cat === 'vanity' || cat === 'shoe_rack') return 'wr_shelves';
    return 'wr_shelves';
  }

  function calculateItemCost(item, rateCard, roomTier) {
    rateCard = rateCard || DEFAULT_RATE_CARD;
    var catKey = item.category || 'wardrobe';
    var catConfig = rateCard.categories[catKey] || rateCard.categories.wardrobe;
    var dims = item.dimensions || { W: 1200, H: 2100, D: 600 };

    var frontAreaSft = (dims.W * dims.H) / SFT_FACTOR;
    var runningFt = (dims.W / 304.8);

    var modelType = resolveModelType(item);
    var modelDef = (rateCard.modelRates && rateCard.modelRates[modelType]) || MODEL_RATES_MATRIX[modelType];
    var activeTier = item.tierOverride || roomTier || (rateCard.roomTiers && item.roomId && rateCard.roomTiers[item.roomId]) || rateCard.selectedTier || null;

    var baseRate = (item.pricingOverrides && item.pricingOverrides.baseRate);
    if (!baseRate && activeTier && modelDef && modelDef.rates && modelDef.rates[activeTier]) {
      baseRate = modelDef.rates[activeTier];
    }
    if (!baseRate) {
      baseRate = catConfig.baseRatePerSft || catConfig.baseRatePerRft || 1700;
    }

    var baseAmount = 0;
    var formulaDescription = '';
    var tierBadge = activeTier ? (' [' + activeTier + ' · ' + (modelDef ? modelDef.label : modelType) + ']') : '';

    if (activeTier && modelDef && modelDef.pricingModel === 'front_area') {
      baseAmount = frontAreaSft * baseRate;
      formulaDescription = dims.W + ' mm × ' + dims.H + ' mm ÷ 92903.04 = ' + frontAreaSft.toFixed(2) + ' SFT @ ' + rateCard.currencySymbol + baseRate + '/SFT' + tierBadge;
    } else if (catConfig.pricingModel === 'front_area') {
      baseAmount = frontAreaSft * baseRate;
      formulaDescription = dims.W + ' mm × ' + dims.H + ' mm ÷ 92903.04 = ' + frontAreaSft.toFixed(2) + ' SFT @ ' + rateCard.currencySymbol + baseRate + '/SFT' + tierBadge;
    } else if (catConfig.pricingModel === 'running_ft') {
      baseAmount = runningFt * (catConfig.baseRatePerRft || baseRate);
      formulaDescription = dims.W + ' mm ÷ 304.8 = ' + runningFt.toFixed(2) + ' Rft @ ' + rateCard.currencySymbol + (catConfig.baseRatePerRft || baseRate) + '/Rft' + tierBadge;
    } else if (catConfig.pricingModel === 'per_piece') {
      baseAmount = baseRate;
      formulaDescription = '1 Pc @ ' + rateCard.currencySymbol + baseRate + tierBadge;
    }

    // Depth check: if non-standard deep cabinet, apply surcharge per configured rule
    var extraDepthCharge = 0;
    if (catConfig.deepCabinetExtraPer100mm && dims.D > catConfig.standardDepth) {
      var extraDepth100 = (dims.D - catConfig.standardDepth) / 100.0;
      extraDepthCharge = frontAreaSft * (extraDepth100 * catConfig.deepCabinetExtraPer100mm);
    }

    // Material finish upgrade surcharge (if specified)
    var matCharge = 0;
    var matKey = item.unitConfig && (item.unitConfig.shutterCol || item.unitConfig.carcass);
    if (matKey && rateCard.materials[matKey] && rateCard.materials[matKey].rateAddPerSft) {
      matCharge = frontAreaSft * rateCard.materials[matKey].rateAddPerSft;
    }

    var totalItemAmount = baseAmount + extraDepthCharge + matCharge;

    return {
      id: item.id,
      itemId: item.id,
      name: item.name,
      modelType: modelType,
      modelLabel: modelDef ? modelDef.label : modelType,
      selectedTier: activeTier,
      category: catKey,
      categoryName: catConfig.name,
      dimensions: dims,
      areaSft: frontAreaSft,
      runningFt: runningFt,
      baseRate: baseRate,
      baseAmount: baseAmount,
      extraDepthCharge: extraDepthCharge,
      matCharge: matCharge,
      totalAmount: totalItemAmount,
      formulaDescription: formulaDescription,
      materials: item.materials || {
        shutter: {
          material: 'HDHMR_18MM',
          finish: 'Brazilian Horizontal Walnut'
        },
        carcass: {
          material: 'BWP_18MM',
          finish: 'Absolute White'
        }
      }
    };
  }

  function generateFullQuotation(project, selectedRoomIds) {
    var rateCard = project.rateCard || DEFAULT_RATE_CARD;
    var plan = project;
    while (plan && plan.plan && (plan.plan.walls || plan.plan.furniture || plan.plan.rooms || plan.plan.plan)) {
      plan = plan.plan;
    }
    plan = plan || {};
    var furniture = plan.furniture || [];
    var rooms = plan.rooms || [];

    var roomMap = {};
    for (var r = 0; r < rooms.length; r++) {
      roomMap[rooms[r].id] = rooms[r];
    }

    // Auto-associate unassigned furniture items if inside a room
    for (var fIdx = 0; fIdx < furniture.length; fIdx++) {
      var fu = furniture[fIdx];
      if ((!fu.roomId || !roomMap[fu.roomId]) && fu.pos) {
        for (var rmIdx = 0; rmIdx < rooms.length; rmIdx++) {
          if (rooms[rmIdx].polygon && Vec2.pointInPolygon(fu.pos, rooms[rmIdx].polygon)) {
            fu.roomId = rooms[rmIdx].id;
            break;
          }
        }
      }
    }

    // Normalize room filter
    var isFiltered = false;
    var filterMap = {};
    if (selectedRoomIds && Array.isArray(selectedRoomIds) && selectedRoomIds.length > 0 && selectedRoomIds.indexOf('all') === -1) {
      isFiltered = true;
      for (var s = 0; s < selectedRoomIds.length; s++) {
        filterMap[selectedRoomIds[s]] = true;
      }
    }

    // Initialize room breakdown metrics map for all detected rooms
    var roomSummaries = {};
    for (var rj = 0; rj < rooms.length; rj++) {
      var rObj = rooms[rj];
      var rmTier = (rateCard.roomTiers && rateCard.roomTiers[rObj.id]) || rObj.variant || rateCard.selectedTier || 'PRICE 1';
      roomSummaries[rObj.id] = {
        id: rObj.id,
        name: rObj.name || ('Room ' + (rj + 1)),
        variant: rmTier,
        areaSqFt: rObj.areaSqFt || 0,
        areaSqM: rObj.areaSqM || 0,
        itemCount: 0,
        woodworkSubtotal: 0,
        civilSubtotal: 0,
        roomSubtotal: 0,
        percentShare: 0
      };
    }
    roomSummaries['_general'] = {
      id: '_general',
      name: 'General / Unassigned',
      variant: (rateCard.roomTiers && rateCard.roomTiers['_general']) || rateCard.selectedTier || 'PRICE 1',
      areaSqFt: 0,
      areaSqM: 0,
      itemCount: 0,
      woodworkSubtotal: 0,
      civilSubtotal: 0,
      roomSubtotal: 0,
      percentShare: 0
    };

    var lineItems = [];
    var categoryTotals = {};
    var roomTotals = {};
    var subtotal = 0;
    var allItemsTotalWoodwork = 0;

    // 1. Modular Furniture & Cabinetry Line Items
    for (var i = 0; i < furniture.length; i++) {
      var f = furniture[i];
      var fRoomId = f.roomId || '_general';
      var rTier = (rateCard.roomTiers && rateCard.roomTiers[fRoomId]) || (roomMap[fRoomId] && roomMap[fRoomId].variant) || null;
      var cost = calculateItemCost(f, rateCard, rTier);
      cost.roomId = fRoomId;
      cost.roomName = (f.roomId && roomMap[f.roomId]) ? roomMap[f.roomId].name : 'General';

      allItemsTotalWoodwork += cost.totalAmount;

      var bId = roomMap[cost.roomId] ? cost.roomId : '_general';
      if (roomSummaries[bId]) {
        roomSummaries[bId].itemCount++;
        roomSummaries[bId].woodworkSubtotal += cost.totalAmount;
        roomSummaries[bId].roomSubtotal += cost.totalAmount;
      }

      var matchesFilter = !isFiltered || filterMap[cost.roomId] || filterMap[cost.roomName];
      if (matchesFilter) {
        lineItems.push(cost);
        subtotal += cost.totalAmount;
        categoryTotals[cost.category] = (categoryTotals[cost.category] || 0) + cost.totalAmount;
        roomTotals[cost.roomName] = (roomTotals[cost.roomName] || 0) + cost.totalAmount;
      }
    }

    // 2. Civil / Architectural Line Items (Optional: False Ceiling, Flooring, Painting from detected rooms)
    var civilLineItems = [];
    for (var rm = 0; rm < rooms.length; rm++) {
      var room = rooms[rm];
      if (room.areaSqFt > 0) {
        var civilMatches = !isFiltered || filterMap[room.id] || filterMap[room.name];

        // Flooring (Opt-in only: room.includeFlooring)
        if (room.includeFlooring && rateCard.categories.flooring && rateCard.categories.flooring.baseRatePerSft) {
          var floorCost = room.areaSqFt * rateCard.categories.flooring.baseRatePerSft;
          if (roomSummaries[room.id]) {
            roomSummaries[room.id].civilSubtotal += floorCost;
            roomSummaries[room.id].roomSubtotal += floorCost;
          }
          if (civilMatches) {
            civilLineItems.push({
              name: 'Flooring: ' + room.name,
              category: 'flooring',
              roomName: room.name,
              roomId: room.id,
              areaSft: room.areaSqFt,
              baseRate: rateCard.categories.flooring.baseRatePerSft,
              totalAmount: floorCost,
              formulaDescription: room.areaSqFt.toFixed(1) + ' SFT @ ' + rateCard.currencySymbol + rateCard.categories.flooring.baseRatePerSft + '/SFT'
            });
            subtotal += floorCost;
            categoryTotals.flooring = (categoryTotals.flooring || 0) + floorCost;
            roomTotals[room.name] = (roomTotals[room.name] || 0) + floorCost;
          }
        }

        // False Ceiling (if enabled for the room)
        if (room.falseCeiling && rateCard.categories.false_ceiling) {
          var fcCost = room.areaSqFt * rateCard.categories.false_ceiling.baseRatePerSft;
          if (roomSummaries[room.id]) {
            roomSummaries[room.id].civilSubtotal += fcCost;
            roomSummaries[room.id].roomSubtotal += fcCost;
          }
          if (civilMatches) {
            civilLineItems.push({
              name: 'False Ceiling: ' + room.name,
              category: 'false_ceiling',
              roomName: room.name,
              roomId: room.id,
              areaSft: room.areaSqFt,
              baseRate: rateCard.categories.false_ceiling.baseRatePerSft,
              totalAmount: fcCost,
              formulaDescription: room.areaSqFt.toFixed(1) + ' SFT @ ' + rateCard.currencySymbol + rateCard.categories.false_ceiling.baseRatePerSft + '/SFT'
            });
            subtotal += fcCost;
            categoryTotals.false_ceiling = (categoryTotals.false_ceiling || 0) + fcCost;
            roomTotals[room.name] = (roomTotals[room.name] || 0) + fcCost;
          }
        }
      }
    }

    // 3. Labor, Installation & Transport
    var totalWoodworkSft = 0;
    for (var w = 0; w < lineItems.length; w++) {
      totalWoodworkSft += lineItems[w].areaSft;
    }

    var installCharge = totalWoodworkSft * (rateCard.laborRates.installationPerSft || 85);
    var transportCharge = lineItems.length === 0 ? 0 :
                          (lineItems.length === 1 && totalWoodworkSft < 15) ? 650 :
                          (lineItems.length <= 2 ? 1500 : (rateCard.laborRates.transportLumpSum || 4500));
    var laborTotal = installCharge + transportCharge;

    var grossBeforeTax = subtotal + laborTotal;
    var marginAmount = grossBeforeTax * ((rateCard.marginPercent || 15) / 100.0);
    var netBeforeTax;
    var gstAmount;
    var grandTotal;
    var gstPercent = (rateCard.gstPercent || 18);
    var commCharges = project.commercialCharges;

    if (commCharges && typeof commCharges === 'object' && Object.keys(commCharges).length > 0) {
      var addAccessories = parseFloat(commCharges.additionalAccessories || commCharges.accessories) || 0;
      var appliances = parseFloat(commCharges.appliances) || 0;
      var designPct = (commCharges.designPercent !== undefined && commCharges.designPercent !== null && commCharges.designPercent !== '') ? parseFloat(commCharges.designPercent) : 9;
      if (isNaN(designPct)) designPct = 9;
      var designAmount = Math.round(subtotal * (designPct / 100));
      var freightPct = (commCharges.freightPercent !== undefined && commCharges.freightPercent !== null && commCharges.freightPercent !== '') ? parseFloat(commCharges.freightPercent) : 2.5;
      if (isNaN(freightPct)) freightPct = 2.5;
      var freightAmount = Math.round(subtotal * (freightPct / 100));

      var discPct = parseFloat(commCharges.discountPercent || commCharges.discount) || 0;
      var discAmount = Math.round(subtotal * (discPct / 100));
      var adpPct = parseFloat(commCharges.adpPercent || commCharges.adp) || 0;
      var adpAmount = Math.round(subtotal * (adpPct / 100));
      var totalDeductions = discAmount + adpAmount;

      var additions = addAccessories + appliances + designAmount + freightAmount;
      netBeforeTax = Math.max(0, Math.round(subtotal + additions - totalDeductions));
      if (commCharges.gstPercent !== undefined && commCharges.gstPercent !== null && commCharges.gstPercent !== '') {
        var parsedGst = parseFloat(commCharges.gstPercent);
        if (!isNaN(parsedGst)) gstPercent = parsedGst;
      }
      gstAmount = Math.round(netBeforeTax * (gstPercent / 100));
      grandTotal = netBeforeTax + gstAmount;
    } else {
      netBeforeTax = grossBeforeTax + marginAmount;
      gstAmount = netBeforeTax * (gstPercent / 100.0);
      grandTotal = netBeforeTax + gstAmount;
    }

    // Convert roomSummaries to array and compute % share
    var allRoomsSummary = [];
    var totalProjectSpend = 0;
    for (var skSum in roomSummaries) {
      totalProjectSpend += roomSummaries[skSum].roomSubtotal;
    }
    if (totalProjectSpend <= 0) totalProjectSpend = 1;

    for (var sk in roomSummaries) {
      var sItem = roomSummaries[sk];
      if (sItem.itemCount > 0 || (sItem.id !== '_general' && sItem.areaSqFt > 0)) {
        sItem.percentShare = Math.round((sItem.roomSubtotal / totalProjectSpend) * 100);
        allRoomsSummary.push(sItem);
      }
    }

    return {
      currency: rateCard.currency || 'INR',
      currencySymbol: rateCard.currencySymbol || '₹',
      dateGenerated: new Date().toISOString(),
      selectedTier: rateCard.selectedTier || null,
      priceTiers: rateCard.priceTiers || PRICE_TIERS,
      modelRates: rateCard.modelRates || MODEL_RATES_MATRIX,
      selectedRoomIds: selectedRoomIds || ['all'],
      isFiltered: isFiltered,
      allRoomsSummary: allRoomsSummary,
      furnitureItems: lineItems,
      civilItems: civilLineItems,
      categoryTotals: categoryTotals,
      roomTotals: roomTotals,
      subtotalWoodwork: subtotal,
      installCharge: installCharge,
      transportCharge: transportCharge,
      laborTotal: laborTotal,
      marginPercent: rateCard.marginPercent || 15,
      marginAmount: marginAmount,
      netBeforeTax: netBeforeTax,
      gstPercent: rateCard.gstPercent || 18,
      gstAmount: gstAmount,
      grandTotal: Math.round(grandTotal),
      grandTotalExact: grandTotal,
      commercial: {
        woodworkSubtotal: Math.round(subtotal),
        additionalAccessories: addAccessories,
        appliances: appliances,
        designPercent: designPct,
        designAmount: designAmount,
        freightPercent: freightPct,
        freightAmount: freightAmount,
        loadingUnloadingStatus: (commCharges && commCharges.loadingUnloadingStatus) || 'Additional',
        floorMatStatus: (commCharges && commCharges.floorMatStatus) || 'Not Included in Quote',
        civilWorksStatus: (commCharges && commCharges.civilWorksStatus) || 'As per actuals',
        electricalPlumbingStatus: (commCharges && commCharges.electricalPlumbingStatus) || 'Additional',
        falseCeilingStatus: (commCharges && commCharges.falseCeilingStatus) || 'Not Included',
        wallpaperStatus: (commCharges && commCharges.wallpaperStatus) || 'Complementary',
        discountPercent: discPct,
        discountAmount: discAmount,
        adpPercent: adpPct,
        adpAmount: adpAmount,
        netValue: netBeforeTax,
        gstPercent: gstPercent,
        gstAmount: gstAmount,
        grandTotal: grandTotal
      }
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Project Serialization, Export & Validation
     ───────────────────────────────────────────────────────────────────────────── */
  function serializeProject(project) {
    project.meta.dateModified = new Date().toISOString();
    return JSON.stringify(project, null, 2);
  }

  function deserializeProject(jsonStr) {
    var data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    if (!data.schemaVersion) {
      data.schemaVersion = '1.0.0';
    }
    if (!data.plan) data.plan = { walls: [], openings: [], rooms: [], furniture: [] };
    if (!data.rateCard) data.rateCard = JSON.parse(JSON.stringify(DEFAULT_RATE_CARD));
    if (!data.commercialCharges) data.commercialCharges = {};
    return data;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Standard Modular Furniture Catalog
     ───────────────────────────────────────────────────────────────────────────── */
  var FURNITURE_CATALOG = [
    // ─── Imported Modular Units Catalog (69 Units) ───
    {
      id: "ctvb-1d-1dr",
      code: "ctvb-1d-1dr",
      name: "CROCKERY/TV BASE 1DOOR 1 DRAWER",
      modelType: "tv_unit_cabinet",
      category: "tv_unit",
      costCategory: "TV Unit Cabinet",
      areaSqft: 0.9687523546,
      icon: "📺",
      dimensions: { W: 450, H: 200, D: 450 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 1,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 1922 },
      customRate: 1922
    },
    {
      id: "ctvb-1dr",
      code: "ctvb-1dr",
      name: "CROCKERY/TV BASE 1 DRAWER",
      modelType: "tv_unit_cabinet",
      category: "tv_unit",
      costCategory: "TV Unit Cabinet",
      areaSqft: 1.291669806,
      icon: "📺",
      dimensions: { W: 600, H: 200, D: 350 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 1,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 2562.67 },
      customRate: 2562.67
    },
    {
      id: "ctvb-2d",
      code: "ctvb-2d",
      name: "CROCKERY /TV BASE 2 DOOR",
      modelType: "pooja_with_cnc",
      category: "pooja",
      costCategory: "POOJA WITH CNC",
      areaSqft: 6.054702216,
      icon: "🛕",
      dimensions: { W: 750, H: 750, D: 450 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 11921.71 },
      customRate: 11921.71
    },
    {
      id: "ctvb-2d-2dr",
      code: "ctvb-2d-2dr",
      name: "CROCKERY/TV BASE 2 DOOR 2 DRAWER",
      modelType: "tv_unit_cabinet",
      category: "tv_unit",
      costCategory: "TV Unit Cabinet",
      areaSqft: 7.26564266,
      icon: "📺",
      dimensions: { W: 900, H: 750, D: 450 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 4,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 2,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 14415.04 },
      customRate: 14415.04
    },
    {
      id: "ctvb-2dr",
      code: "ctvb-2dr",
      name: "CROCKERY/TV BASE 2 DRAWER",
      modelType: "tv_unit_cabinet",
      category: "tv_unit",
      costCategory: "TV Unit Cabinet",
      areaSqft: 2.421880887,
      icon: "📺",
      dimensions: { W: 450, H: 500, D: 350 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 2,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 4805.01 },
      customRate: 4805.01
    },
    {
      id: "ctvw-2d",
      code: "ctvw-2d",
      name: "CROCKERY/TV WALL 2 DOOR",
      modelType: "pooja_with_cnc",
      category: "pooja",
      costCategory: "POOJA WITH CNC",
      areaSqft: 5.812514128,
      icon: "🛕",
      dimensions: { W: 900, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 11444.84 },
      customRate: 11444.84
    },
    {
      id: "ctvw-obs-02",
      code: "ctvw-obs-02",
      name: "CROCKERY/TV WALL OPEN BOX STORAGE 2",
      modelType: "spice_rack",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 4.843761773,
      icon: "🧂",
      dimensions: { W: 1500, H: 300, D: 200 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 11005.03 },
      customRate: 11005.03
    },
    {
      id: "fm-rt-01",
      code: "fm-rt-01",
      name: "FCM -RT",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 9.687523546,
      icon: "🍳",
      dimensions: { W: 1200, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 17398.79 },
      customRate: 17398.79
    },
    {
      id: "fm-120",
      code: "fm-120",
      name: "FM 120",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 9.687523546,
      icon: "🍳",
      dimensions: { W: 1200, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 17398.79 },
      customRate: 17398.79
    },
    {
      id: "fm-45",
      code: "fm-45",
      name: "FM 45",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 3.63282133,
      icon: "🍳",
      dimensions: { W: 450, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 6524.55 },
      customRate: 6524.55
    },
    {
      id: "fm-60",
      code: "fm-60",
      name: "FM 60",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 4.843761773,
      icon: "🍳",
      dimensions: { W: 600, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 8699.4 },
      customRate: 8699.4
    },
    {
      id: "fm-75",
      code: "fm-75",
      name: "FM 75",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 6.054702216,
      icon: "🍳",
      dimensions: { W: 750, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 10874.25 },
      customRate: 10874.25
    },
    {
      id: "fm-90",
      code: "fm-90",
      name: "FM 90",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 7.26564266,
      icon: "🍳",
      dimensions: { W: 900, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 13049.09 },
      customRate: 13049.09
    },
    {
      id: "fm-d2-45",
      code: "fm-d2-45",
      name: "FM D2 - 45",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 3.63282133,
      icon: "🍳",
      dimensions: { W: 450, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 2,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 7163.92 },
      customRate: 7163.92
    },
    {
      id: "fm-d2-75",
      code: "fm-d2-75",
      name: "FM D2 - 75",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 6.054702216,
      icon: "🍳",
      dimensions: { W: 750, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 2,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 11939.87 },
      customRate: 11939.87
    },
    {
      id: "fm-d2-90",
      code: "fm-d2-90",
      name: "FM D2 - 90",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 7.26564266,
      icon: "🍳",
      dimensions: { W: 900, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 2,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 14327.85 },
      customRate: 14327.85
    },
    {
      id: "fm-d3-45",
      code: "fm-d3-45",
      name: "FM D3 - 45",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 3.63282133,
      icon: "🍳",
      dimensions: { W: 450, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 3,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 3,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 7163.92 },
      customRate: 7163.92
    },
    {
      id: "fm-d3-75",
      code: "fm-d3-75",
      name: "FM D3 - 75",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 6.054702216,
      icon: "🍳",
      dimensions: { W: 750, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 3,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 3,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 11939.87 },
      customRate: 11939.87
    },
    {
      id: "fm-d3-90",
      code: "fm-d3-90",
      name: "FM D3 - 90",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 7.26564266,
      icon: "🍳",
      dimensions: { W: 900, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 3,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 3,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 14327.85 },
      customRate: 14327.85
    },
    {
      id: "fm-ds-45",
      code: "fm-ds-45",
      name: "FM DS 45",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 3.63282133,
      icon: "🍳",
      dimensions: { W: 450, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 1,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 6524.55 },
      customRate: 6524.55
    },
    {
      id: "fm-ds-60",
      code: "fm-ds-60",
      name: "FM DS 60",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 4.843761773,
      icon: "🍳",
      dimensions: { W: 600, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 1,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 8699.4 },
      customRate: 8699.4
    },
    {
      id: "fm-ds-90",
      code: "fm-ds-90",
      name: "FM DS 90",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 7.26564266,
      icon: "🍳",
      dimensions: { W: 900, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 4,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 2,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 13049.09 },
      customRate: 13049.09
    },
    {
      id: "sr-45",
      code: "sr-45",
      name: "SR 45",
      modelType: "spice_rack_open_box",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 0.726564266,
      icon: "🧂",
      dimensions: { W: 450, H: 150, D: 150 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_19mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_19mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 1650.75 },
      customRate: 1650.75
    },
    {
      id: "sr-75",
      code: "sr-75",
      name: "SR 75",
      modelType: "spice_rack_open_box",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 1.210940443,
      icon: "🧂",
      dimensions: { W: 750, H: 150, D: 150 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_20mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_20mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 2751.26 },
      customRate: 2751.26
    },
    {
      id: "sr-90",
      code: "sr-90",
      name: "SR 90",
      modelType: "spice_rack_open_box",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 1.453128532,
      icon: "🧂",
      dimensions: { W: 900, H: 150, D: 150 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_21mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_21mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 3301.51 },
      customRate: 3301.51
    },
    {
      id: "tbm-60-oven",
      code: "tbm-60-oven",
      name: "TBM 60 OVEN",
      modelType: "wardrobe_modular_drawers",
      category: "wardrobe",
      costCategory: "Wr - Modular - 2 DRAWERS",
      areaSqft: 13.56253296,
      icon: "🚪",
      dimensions: { W: 600, H: 2100, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 4,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 23598.81 },
      customRate: 23598.81
    },
    {
      id: "wcm-lt-01",
      code: "wcm-lt-01",
      name: "WCM LEFT",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 3.875009418,
      icon: "🎛️",
      dimensions: { W: 600, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 5986.89 },
      customRate: 5986.89
    },
    {
      id: "wcm-rt-01",
      code: "wcm-rt-01",
      name: "WCM RIGHT",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 3.875009418,
      icon: "🎛️",
      dimensions: { W: 600, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 5986.89 },
      customRate: 5986.89
    },
    {
      id: "wm-30",
      code: "wm-30",
      name: "WM 30",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 1.937504709,
      icon: "🎛️",
      dimensions: { W: 300, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 2993.44 },
      customRate: 2993.44
    },
    {
      id: "wm-45",
      code: "wm-45",
      name: "WM 45",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 2.906257064,
      icon: "🎛️",
      dimensions: { W: 450, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 4490.17 },
      customRate: 4490.17
    },
    {
      id: "wm-60-gl",
      code: "wm-60-gl",
      name: "WM 60 GL",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 3.875009418,
      icon: "🎛️",
      dimensions: { W: 600, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 5986.89 },
      customRate: 5986.89
    },
    {
      id: "wm-75",
      code: "wm-75",
      name: "WM 75",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 4.843761773,
      icon: "🎛️",
      dimensions: { W: 750, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 7483.61 },
      customRate: 7483.61
    },
    {
      id: "wm-75-gl",
      code: "wm-75-gl",
      name: "WM 75 GL",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 4.843761773,
      icon: "🎛️",
      dimensions: { W: 750, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 7483.61 },
      customRate: 7483.61
    },
    {
      id: "wm-90",
      code: "wm-90",
      name: "WM 90",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 5.812514128,
      icon: "🎛️",
      dimensions: { W: 900, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 8980.33 },
      customRate: 8980.33
    },
    {
      id: "wm-90-gl",
      code: "wm-90-gl",
      name: "WM 90 GL",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 5.812514128,
      icon: "🎛️",
      dimensions: { W: 900, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 8980.33 },
      customRate: 8980.33
    },
    {
      id: "loft-1d-mod",
      code: "loft-1d-mod",
      name: "LOFT 1 DOOR MODULAR",
      modelType: "wardrobe_modular_shelves",
      category: "wardrobe",
      costCategory: "Wr - Modular - ONLY SHELVES",
      areaSqft: 4.359385596,
      icon: "🚪",
      dimensions: { W: 450, H: 900, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 6735.25 },
      customRate: 6735.25
    },
    {
      id: "loft-1d-os",
      code: "loft-1d-os",
      name: "LOFT 1 DOOR O/S",
      modelType: "loft_os",
      category: "loft",
      costCategory: "Loft - O/S",
      areaSqft: 4.359385596,
      icon: "📦",
      dimensions: { W: 450, H: 900, D: 600 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "none", finish: "none" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "none",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 3901.65 },
      customRate: 3901.65
    },
    {
      id: "pnl-wall",
      code: "pnl-wall",
      name: "WALL PANEL",
      modelType: "wall_paneling",
      category: "wall_paneling",
      costCategory: "Wall Paneling",
      areaSqft: 15.50003767,
      icon: "🪵",
      dimensions: { W: 1200, H: 1200, D: 600 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 12338.03 },
      customRate: 12338.03
    },
    {
      id: "ob-std",
      code: "ob-std",
      name: "OPEN BOX",
      modelType: "spice_rack",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 3.875009418,
      icon: "🧂",
      dimensions: { W: 600, H: 600, D: 300 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 8804.02 },
      customRate: 8804.02
    },
    {
      id: "ob-200-300",
      code: "ob-200-300",
      name: "OPEN BOX-200 - 300",
      modelType: "spice_rack",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 0.9687523546,
      icon: "🧂",
      dimensions: { W: 300, H: 300, D: 200 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 2201.01 },
      customRate: 2201.01
    },
    {
      id: "ob-300-600",
      code: "ob-300-600",
      name: "OPEN BOX 300 - 600",
      modelType: "spice_rack",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 3.875009418,
      icon: "🧂",
      dimensions: { W: 600, H: 600, D: 300 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 8804.02 },
      customRate: 8804.02
    },
    {
      id: "ledge-std",
      code: "ledge-std",
      name: "LEDGE",
      modelType: "wall_paneling",
      category: "wall_paneling",
      costCategory: "Wall Paneling",
      areaSqft: 0.2325005651,
      icon: "🪵",
      dimensions: { W: 1200, H: 18, D: 200 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 185.07 },
      customRate: 185.07
    },
    {
      id: "pnl-back",
      code: "pnl-back",
      name: "BACK PANEL",
      modelType: "wall_paneling",
      category: "wall_paneling",
      costCategory: "Wall Paneling",
      areaSqft: 19.37504709,
      icon: "🪵",
      dimensions: { W: 1200, H: 1500, D: 18 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 15422.54 },
      customRate: 15422.54
    },
    {
      id: "ctvb-doors-only",
      code: "ctvb-doors-only",
      name: "CROCKERY / TV BASE ONLY DOORS",
      modelType: "loft_os",
      category: "loft",
      costCategory: "Loft - O/S",
      areaSqft: 6.054702216,
      icon: "📦",
      dimensions: { W: 750, H: 750, D: 600 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "none", finish: "none" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "none",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 5418.96 },
      customRate: 5418.96
    },
    {
      id: "ctvb-open-storage",
      code: "ctvb-open-storage",
      name: "CROCKERY/TV BASE OPEN STORAGE",
      modelType: "spice_rack",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 1.937504709,
      icon: "🧂",
      dimensions: { W: 600, H: 300, D: 300 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 4402.01 },
      customRate: 4402.01
    },
    {
      id: "ctvw-doors-only",
      code: "ctvw-doors-only",
      name: "CROCKERY/TV WALL UNIT ONLY DOOR",
      modelType: "loft_os",
      category: "loft",
      costCategory: "Loft - O/S",
      areaSqft: 1.937504709,
      icon: "📦",
      dimensions: { W: 300, H: 600, D: 600 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "none", finish: "none" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "BLUE",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "none",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 1734.07 },
      customRate: 1734.07
    },
    {
      id: "ctvw-open-box",
      code: "ctvw-open-box",
      name: "CROCKERY/TV WALL OPEN BOX STORAGE",
      modelType: "spice_rack",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 1.291669806,
      icon: "🧂",
      dimensions: { W: 600, H: 200, D: 300 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 2934.67 },
      customRate: 2934.67
    },
    {
      id: "fm-lt-01",
      code: "fm-lt-01",
      name: "FCM -LT",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - FM",
      areaSqft: 9.687523546,
      icon: "🍳",
      dimensions: { W: 1200, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 17398.79 },
      customRate: 17398.79
    },
    {
      id: "fm-30-oil",
      code: "fm-30-oil",
      name: "FM30 -OIL PULLOUT",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 2.421880887,
      icon: "🍳",
      dimensions: { W: 300, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 1,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 4775.95 },
      customRate: 4775.95
    },
    {
      id: "fm-d2-60",
      code: "fm-d2-60",
      name: "FM D2 - 60",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 4.843761773,
      icon: "🍳",
      dimensions: { W: 600, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 2,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 9551.9 },
      customRate: 9551.9
    },
    {
      id: "fm-d3-60",
      code: "fm-d3-60",
      name: "FM D3 - 60",
      modelType: "kitchen_fm",
      category: "kitchen_base",
      costCategory: "Kitchen - D2/D3",
      areaSqft: 4.843761773,
      icon: "🍳",
      dimensions: { W: 600, H: 750, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 3,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 3,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 9551.9 },
      customRate: 9551.9
    },
    {
      id: "ledge-ctop",
      code: "ledge-ctop",
      name: "LEDGE COUNTERTOP",
      modelType: "wall_paneling",
      category: "wall_paneling",
      costCategory: "Wall Paneling",
      areaSqft: 0.1743754238,
      icon: "🪵",
      dimensions: { W: 900, H: 18, D: 550 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 138.8 },
      customRate: 138.8
    },
    {
      id: "sr-60",
      code: "sr-60",
      name: "SR 60",
      modelType: "spice_rack",
      category: "spice_rack",
      costCategory: "Spice Rack (OPEN BOXES)",
      areaSqft: 0.9687523546,
      icon: "🧂",
      dimensions: { W: 600, H: 150, D: 150 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 2201.01 },
      customRate: 2201.01
    },
    {
      id: "wr-sliding",
      code: "wr-sliding",
      name: "SLIDING WARDROBE",
      modelType: "wardrobe_modular_sliding",
      category: "wardrobe",
      costCategory: "Wr - Modular - SLIDING",
      areaSqft: 40.68759889,
      icon: "🚪",
      dimensions: { W: 1800, H: 2100, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "sliding",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 5,
        drawers: 2,
        loft: true,
        loftH: 750,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 73034.24 },
      customRate: 73034.24
    },
    {
      id: "tbm-60",
      code: "tbm-60",
      name: "TBM 60",
      modelType: "wardrobe_modular_shelves",
      category: "wardrobe",
      costCategory: "Wr - Modular - ONLY SHELVES",
      areaSqft: 13.56253296,
      icon: "🚪",
      dimensions: { W: 600, H: 2100, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 5,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 20954.11 },
      customRate: 20954.11
    },
    {
      id: "ledge-vert",
      code: "ledge-vert",
      name: "VERTICAL LEDGE",
      modelType: "wall_paneling",
      category: "wall_paneling",
      costCategory: "Wall Paneling",
      areaSqft: 1.291669806,
      icon: "🪵",
      dimensions: { W: 600, H: 200, D: 200 },
      materials: {
        shutter: { material: "none", finish: "none" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "none",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "none"
      },
      pricingOverrides: { baseRate: 1028.17 },
      customRate: 1028.17
    },
    {
      id: "wm-45-gl",
      code: "wm-45-gl",
      name: "WM 45 GL",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 2.906257064,
      icon: "🎛️",
      dimensions: { W: 450, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 4490.17 },
      customRate: 4490.17
    },
    {
      id: "wm-60-dbl",
      code: "wm-60-dbl",
      name: "WM 60 DOUBLE",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 3.875009418,
      icon: "🎛️",
      dimensions: { W: 600, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "none",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 5986.89 },
      customRate: 5986.89
    },
    {
      id: "wm-open-30",
      code: "wm-open-30",
      name: "WM OPEN 30",
      modelType: "kitchen_wm",
      category: "kitchen_wall",
      costCategory: "Kitchen - WM",
      areaSqft: 1.937504709,
      icon: "🎛️",
      dimensions: { W: 300, H: 600, D: 300 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 0,
        doorType: "none",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 2993.44 },
      customRate: 2993.44
    },
    {
      id: "loft-2d-mod",
      code: "loft-2d-mod",
      name: "LOFT 2 DOOR MODULAR",
      modelType: "wardrobe_modular_shelves",
      category: "wardrobe",
      costCategory: "Wr - Modular - ONLY SHELVES",
      areaSqft: 8.718771191,
      icon: "🚪",
      dimensions: { W: 900, H: 900, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 13470.5 },
      customRate: 13470.5
    },
    {
      id: "loft-2d-os",
      code: "loft-2d-os",
      name: "LOFT 2 DOOR O/S",
      modelType: "loft_os",
      category: "loft",
      costCategory: "Loft - O/S",
      areaSqft: 7.26564266,
      icon: "📦",
      dimensions: { W: 750, H: 900, D: 18 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 6502.75 },
      customRate: 6502.75
    },
    {
      id: "wr-shelves",
      code: "wr-shelves",
      name: "WR 2 DOOR WITH SHELVBES",
      modelType: "wardrobe_modular_shelves",
      category: "wardrobe",
      costCategory: "Wr - Modular - ONLY SHELVES",
      areaSqft: 20.34379945,
      icon: "🚪",
      dimensions: { W: 900, H: 2100, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: true,
        loftH: 750,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 31431.17 },
      customRate: 31431.17
    },
    {
      id: "wr-drawers",
      code: "wr-drawers",
      name: "WR 2 DOOR WITH DRAWERS",
      modelType: "wardrobe_modular_drawers",
      category: "wardrobe",
      costCategory: "Wr - Modular - 2 DRAWERS",
      areaSqft: 20.34379945,
      icon: "🚪",
      dimensions: { W: 900, H: 2100, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 2,
        loft: true,
        loftH: 750,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 35398.21 },
      customRate: 35398.21
    },
    {
      id: "wr-1-shelves",
      code: "wr-1-shelves",
      name: "WR 1 DOOR WITH SHELVBES",
      modelType: "wardrobe_modular_shelves",
      category: "wardrobe",
      costCategory: "Wr - Modular - ONLY SHELVES",
      areaSqft: 13.56253296,
      icon: "🚪",
      dimensions: { W: 600, H: 2100, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 0,
        loft: true,
        loftH: 750,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 20954.11 },
      customRate: 20954.11
    },
    {
      id: "wr-1-drawers",
      code: "wr-1-drawers",
      name: "WR 1 DOOR WITH DRAWERS",
      modelType: "wardrobe_modular_drawers",
      category: "wardrobe",
      costCategory: "Wr - Modular - 2 DRAWERS",
      areaSqft: 13.56253296,
      icon: "🚪",
      dimensions: { W: 600, H: 2100, D: 550 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "BWP_18mm", finish: "Absolute White" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 1,
        drawers: 1,
        loft: true,
        loftH: 750,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "BWP_18mm",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 23598.81 },
      customRate: 23598.81
    },
    {
      id: "fm-120 o/s",
      code: "fm-120 o/s",
      name: "FM 120 O/S",
      modelType: "kitchen_o_s",
      category: "kitchen_base",
      costCategory: "Kitchen O/S",
      areaSqft: 9.687523546,
      icon: "🍳",
      dimensions: { W: 1200, H: 750, D: 600 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "none", finish: "none" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "none",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 8670.33 },
      customRate: 8670.33
    },
    {
      id: "fm-60 o/s",
      code: "fm-60 o/s",
      name: "FM 60 O/S",
      modelType: "kitchen_o_s",
      category: "kitchen_base",
      costCategory: "Kitchen O/S",
      areaSqft: 4.843761773,
      icon: "🍳",
      dimensions: { W: 600, H: 750, D: 600 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "none", finish: "none" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "black",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "none",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 4335.17 },
      customRate: 4335.17
    },
    {
      id: "wm-60 o/s",
      code: "wm-60 o/s",
      name: "WM  60 O/S",
      modelType: "kitchen_o_s",
      category: "kitchen_base",
      costCategory: "Kitchen O/S",
      areaSqft: 3.875009418,
      icon: "🍳",
      dimensions: { W: 600, H: 600, D: 600 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "none", finish: "none" }
      },
      unitConfig: {
        shutters: 2,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "none",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 3468.13 },
      customRate: 3468.13
    },
    {
      id: "wm-30 o/s",
      code: "wm-30 o/s",
      name: "WM 30 O/S",
      modelType: "kitchen_o_s",
      category: "kitchen_base",
      costCategory: "Kitchen O/S",
      areaSqft: 1.937504709,
      icon: "🍳",
      dimensions: { W: 300, H: 600, D: 600 },
      materials: {
        shutter: { material: "HDHMR_18mm", finish: "BLUE" },
        carcass: { material: "none", finish: "none" }
      },
      unitConfig: {
        shutters: 1,
        doorType: "hinged",
        dstyle: "slab",
        glassTint: "none",
        profileColor: "none",
        sections: 0,
        shelves: 0,
        drawers: 0,
        loft: false,
        loftH: 0,
        counter: "none",
        handle: "gprof",
        hfinish: "black",
        led: false,
        carcass: "none",
        shutterCol: "BLUE"
      },
      pricingOverrides: { baseRate: 1734.07 },
      customRate: 1734.07
    },

    // ─── Standard Library ───
    {
      id: 'fm-01',
      name: 'FM 600 (Kitchen Base)',
      modelType: 'kitchen_fm',
      category: 'kitchen_base',
      icon: '🍳',
      dimensions: { W: 600, H: 750, D: 550 },
      materials: {
        shutter: { material: 'HDHMR_18mm', finish: '4x Tuff Gloss' },
        carcass: { material: 'BWP_18mm', finish: 'Absolute White' }
      },
      unitConfig: {
        shutters: 1,
        shelves: 1,
        drawers: 0,
        dstyle: 'slab',
        counter: 'black',
        handle: 'gprof',
        hfinish: 'black',
        carcass: 'BWP_18mm',
        shutterCol: 'HDHMR_18mm'
      },
      customRate: 8699.67
    },
    {
      id: 'w2d',
      name: '2-Door Wardrobe',
      modelType: 'wr_shelves',
      category: 'wardrobe',
      icon: '🚪',
      dimensions: { W: 900, H: 2100, D: 600 },
      unitConfig: { shutters: 2, carcass: 'MDF 1135', shutterCol: 'MDF 3410', loft: false }
    },
    {
      id: 'w3d',
      name: '3-Door Wardrobe',
      modelType: 'wr_drawers',
      category: 'wardrobe',
      icon: '🚪',
      dimensions: { W: 1350, H: 2100, D: 600 },
      unitConfig: { shutters: 3, carcass: 'MDF 1135', shutterCol: 'MDF 3410', loft: false }
    },
    {
      id: 'w4d',
      name: '4-Door Master Wardrobe',
      modelType: 'wr_drawers',
      category: 'wardrobe',
      icon: '🚪',
      dimensions: { W: 1800, H: 2100, D: 600 },
      unitConfig: { shutters: 4, carcass: 'MDF 1135', shutterCol: 'MDF 2204', loft: true, loftH: 600 }
    },
    {
      id: 'w_slide',
      name: '2-Door Sliding Wardrobe',
      modelType: 'wr_sliding',
      category: 'wardrobe',
      icon: '↔️',
      dimensions: { W: 1800, H: 2400, D: 650 },
      unitConfig: { type: 'sliding', shutters: 2, carcass: 'MDF 1135', shutterCol: 'MDF 6601' }
    },
    {
      id: 'loft_unit',
      name: 'Overhead Loft Unit (O/S)',
      modelType: 'loft_os',
      category: 'wardrobe',
      icon: '📦',
      dimensions: { W: 1800, H: 600, D: 600 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 2204' }
    },
    {
      id: 'k_base',
      name: 'Kitchen Base Run (3m)',
      modelType: 'kitchen_fm',
      category: 'kitchen_base',
      icon: '🍳',
      dimensions: { W: 3000, H: 850, D: 600 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 7701' }
    },
    {
      id: 'k_drawers',
      name: 'Kitchen 3-Drawer Base (D2/D3)',
      modelType: 'kitchen_d2d3',
      category: 'kitchen_base',
      icon: '🗄️',
      dimensions: { W: 900, H: 850, D: 600 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 7701' }
    },
    {
      id: 'k_wall',
      name: 'Kitchen Wall Run (3m)',
      modelType: 'kitchen_wm',
      category: 'kitchen_wall',
      icon: '🎛️',
      dimensions: { W: 3000, H: 700, D: 350 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 1135' }
    },
    {
      id: 'k_open_shelves',
      name: 'Kitchen Open Shelves (O/S)',
      modelType: 'kitchen_os',
      category: 'kitchen_wall',
      icon: '🪵',
      dimensions: { W: 1200, H: 700, D: 320 },
      unitConfig: { carcass: 'MDF 2204', shutterCol: 'MDF 2204' }
    },
    {
      id: 'k_spice_rack',
      name: 'Spice Rack (Open Boxes)',
      modelType: 'spice_rack',
      category: 'kitchen_wall',
      icon: '🌶️',
      dimensions: { W: 800, H: 600, D: 200 },
      unitConfig: { carcass: 'MDF 3410', shutterCol: 'MDF 3410' }
    },
    {
      id: 'k_tall',
      name: 'Kitchen Tall Pantry Unit',
      modelType: 'kitchen_fm',
      category: 'kitchen_tall',
      icon: '🥫',
      dimensions: { W: 600, H: 2100, D: 600 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 7701' }
    },
    {
      id: 'k_island',
      name: 'Modular Kitchen Island',
      modelType: 'kitchen_d2d3',
      category: 'kitchen_base',
      icon: '🏝️',
      dimensions: { W: 1500, H: 850, D: 900 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 8801' }
    },
    {
      id: 'pooja_unit',
      name: 'Pooja Mandir with CNC Jali',
      modelType: 'pooja_cnc',
      category: 'crockery',
      icon: '🪔',
      dimensions: { W: 1000, H: 1800, D: 450 },
      unitConfig: { carcass: 'MDF 3410', shutterCol: 'MDF 3410' }
    },
    {
      id: 'tv_media',
      name: 'TV Media Entertainment Wall',
      modelType: 'tv_cabinet',
      category: 'tv_unit',
      icon: '📺',
      dimensions: { W: 2100, H: 1800, D: 400 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 3410' }
    },
    {
      id: 'wall_panelling',
      name: 'Decorative Wall Paneling',
      modelType: 'wall_paneling',
      category: 'wall_paneling',
      icon: '🧱',
      dimensions: { W: 2400, H: 2400, D: 50 },
      unitConfig: { carcass: 'MDF 3410', shutterCol: 'MDF 3410' }
    },
    {
      id: 'crockery',
      name: 'Crockery Display Unit',
      modelType: 'kitchen_wm',
      category: 'crockery',
      icon: '🍷',
      dimensions: { W: 1200, H: 2000, D: 450 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 2204' }
    },
    {
      id: 'vanity',
      name: 'Dressing Table & Vanity',
      modelType: 'wr_shelves',
      category: 'vanity',
      icon: '🪞',
      dimensions: { W: 1000, H: 1800, D: 400 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 1101' }
    },
    {
      id: 'shoe_rack',
      name: 'Entryway Shoe Cabinet',
      modelType: 'wr_shelves',
      category: 'shoe_rack',
      icon: '👟',
      dimensions: { W: 1000, H: 1100, D: 380 },
      unitConfig: { carcass: 'MDF 1135', shutterCol: 'MDF 5501' }
    },
    {
      id: 'bed_queen',
      name: 'Queen Bed with Headboard',
      category: 'furniture',
      icon: '🛏️',
      dimensions: { W: 1600, H: 1000, D: 2050 }
    },
    {
      id: 'bed_king',
      name: 'King Bed with Headboard',
      category: 'furniture',
      icon: '👑',
      dimensions: { W: 1900, H: 1000, D: 2050 }
    }
  ];

  /* ─────────────────────────────────────────────────────────────────────────────
     Quotation Versioning & Snapshot Locking
     ───────────────────────────────────────────────────────────────────────────── */
  function lockQuotationVersion(project, label, notes) {
    if (!project.quotationHistory) project.quotationHistory = [];
    var quote = generateFullQuotation(project);
    var verNum = (project.quotationHistory.length + 1) + '.0';
    var record = {
      version: verNum,
      label: label || ('Quotation v' + verNum),
      dateLocked: new Date().toISOString(),
      notes: notes || '',
      rateCardSnapshot: JSON.parse(JSON.stringify(project.rateCard)),
      quotation: quote
    };
    project.quotationHistory.push(record);
    return record;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     CSV Modular Units Importer
     ───────────────────────────────────────────────────────────────────────────── */
  function parseUnitsCSV(csvText) {
    if (!csvText || typeof csvText !== 'string') return [];
    var lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    var headers = lines[0].split(',').map(function (h) { return h.trim(); });
    var items = [];

    for (var i = 1; i < lines.length; i++) {
      var rowStr = lines[i].trim();
      if (!rowStr) continue;
      var cols = rowStr.split(',').map(function (c) { return c.trim(); });
      var row = {};
      for (var h = 0; h < headers.length; h++) {
        row[headers[h]] = cols[h] !== undefined ? cols[h] : '';
      }

      var code = row['Item_Code'] || uid('unit');
      var name = row['Item_Name'] || code;

      var rawCat = (row['Category'] || '').toLowerCase();
      var cat = 'wardrobe';
      if (rawCat.indexOf('kitchen') !== -1 && (rawCat.indexOf('wm') !== -1 || rawCat.indexOf('wall') !== -1)) {
        cat = 'kitchen_wall';
      } else if (rawCat.indexOf('kitchen') !== -1 || rawCat.indexOf('base') !== -1 || rawCat.indexOf('fm') !== -1) {
        cat = 'kitchen_base';
      } else if (rawCat.indexOf('crockery') !== -1) {
        cat = 'crockery';
      } else if (rawCat.indexOf('tv') !== -1) {
        cat = 'tv_unit';
      } else if (rawCat.indexOf('vanity') !== -1) {
        cat = 'vanity';
      } else if (rawCat.indexOf('shoe') !== -1) {
        cat = 'shoe_rack';
      }

      var rawMType = (row['Model_Type'] || '').toLowerCase();
      var mType = 'wr_shelves';
      if (rawMType.indexOf('wm') !== -1) mType = 'kitchen_wm';
      else if (rawMType.indexOf('fm') !== -1 || rawMType.indexOf('base') !== -1) mType = 'kitchen_fm';
      else if (rawMType.indexOf('sliding') !== -1) mType = 'wr_sliding';
      else if (rawMType.indexOf('drawer') !== -1) mType = 'wr_drawers';
      else if (row['Model_Type']) mType = row['Model_Type'].trim().toLowerCase().replace(/[^a-z0-9_]+/g, '_');

      var w = parseFloat(row['Width_mm']) || 1200;
      var h = parseFloat(row['Height_mm']) || 2100;
      var d = parseFloat(row['Depth_mm']) || 600;
      var rate = parseFloat(row['Unit_Rate_INR']) || 1700;

      var hasLoftVal = String(row['Has_Loft'] || '').trim().toUpperCase();
      var hasLoft = (hasLoftVal === 'TRUE' || hasLoftVal === '1');

      var ledVal = String(row['LED_Light'] || '').trim().toUpperCase();
      var hasLed = (ledVal === 'TRUE' || ledVal === '1');

      var handleType = (row['Handle_Type'] || 'gprof').toLowerCase().replace(/\s+/g, '');

      var iconMap = {
        wardrobe: '🚪',
        kitchen_base: '🍳',
        kitchen_wall: '🎛️',
        kitchen_tall: '🥫',
        crockery: '🍷',
        tv_unit: '📺',
        vanity: '🪞',
        shoe_rack: '👟'
      };

      var item = {
        id: code,
        code: code,
        name: name,
        modelType: mType,
        category: cat,
        icon: iconMap[cat] || '📦',
        dimensions: { W: w, H: h, D: d },
        materials: {
          shutter: {
            material: row['Shutter_Material'] || 'HDHMR_18mm',
            finish: row['Shutter_Finish'] || 'Absolute White'
          },
          carcass: {
            material: row['Carcass_Material'] || 'BWP_18mm',
            finish: row['Carcass_Finish'] || 'Absolute White'
          }
        },
        unitConfig: {
          shutters: parseInt(row['Shutters_Count']) || 0,
          doorType: row['Door_Type'] || 'hinged',
          dstyle: row['Door_Style'] || 'slab',
          glassTint: row['Glass_Tint'] || 'none',
          profileColor: row['Profile_Color'] || 'none',
          sections: parseInt(row['Internal_Sections']) || 0,
          shelves: parseInt(row['Shelves_Count']) || 0,
          drawers: parseInt(row['Drawers_Count']) || 0,
          loft: hasLoft,
          loftH: parseFloat(row['Loft_Height_mm']) || 0,
          counter: row['Countertop'] || 'none',
          handle: handleType,
          hfinish: row['Handle_Finish'] || 'black',
          led: hasLed,
          carcass: row['Carcass_Material'] || 'BWP_18mm',
          shutterCol: row['Shutter_Finish'] || 'Absolute White'
        },
        pricingOverrides: { baseRate: rate },
        customRate: rate
      };

      items.push(item);
    }
    return items;
  }

  function importUnitsFromCSV(csvText) {
    var parsed = parseUnitsCSV(csvText);
    var added = 0;
    for (var i = 0; i < parsed.length; i++) {
      var item = parsed[i];
      var existingIdx = -1;
      for (var j = 0; j < FURNITURE_CATALOG.length; j++) {
        if (FURNITURE_CATALOG[j].id === item.id) {
          existingIdx = j;
          break;
        }
      }
      if (existingIdx >= 0) {
        FURNITURE_CATALOG[existingIdx] = item;
      } else {
        FURNITURE_CATALOG.unshift(item);
      }
      added++;
    }
    return { added: added, total: FURNITURE_CATALOG.length, items: parsed };
  }

  function sanitizeIconId(id) {
    return String(id || '').replace(/[\/\\:\*\?"<>\|\s]+/g, '-').toLowerCase();
  }

  function getUnitIcon(item) {
    if (!item) return 'icon-cookscape-unit.png';
    if (typeof OrbixUnitIcons !== 'undefined' && OrbixUnitIcons.getIcon) {
      return OrbixUnitIcons.getIcon(item);
    }
    try {
      var mod = require('./orbix-unit-icons.js');
      if (mod && mod.getIcon) return mod.getIcon(item);
    } catch (_) {}
    var id = typeof item === 'string' ? item : (item.id || '');
    if (id === 'w2d' || id === 'W-01') return 'icon-furniture.png';
    if (id === 'ctvb-1d-1dr') return 'icon-cookscape-unit.png';
    return 'unit-icons/' + sanitizeIconId(id) + '.svg';
  }

  return {
    SFT_FACTOR: SFT_FACTOR,
    SQM_FACTOR: SQM_FACTOR,
    uid: uid,
    Vec2: Vec2,
    DEFAULT_RATE_CARD: DEFAULT_RATE_CARD,
    FURNITURE_CATALOG: FURNITURE_CATALOG,
    createProject: createProject,
    createWall: createWall,
    createOpening: createOpening,
    createRoom: createRoom,
    createFurniturePlacement: createFurniturePlacement,
    wallLength: wallLength,
    wallAngle: wallAngle,
    wallDirection: wallDirection,
    wallNormal: wallNormal,
    wallPolygon: wallPolygon,
    splitWall: splitWall,
    detectRooms: detectRooms,
    calculateItemCost: calculateItemCost,
    generateFullQuotation: generateFullQuotation,
    lockQuotationVersion: lockQuotationVersion,
    serializeProject: serializeProject,
    deserializeProject: deserializeProject,
    PRICE_TIERS: PRICE_TIERS,
    MODEL_RATES_MATRIX: MODEL_RATES_MATRIX,
    resolveModelType: resolveModelType,
    parseUnitsCSV: parseUnitsCSV,
    importUnitsFromCSV: importUnitsFromCSV,
    calculateCornerAngle: calculateCornerAngle,
    getFurniturePolygon: getFurniturePolygon,
    polygonsIntersect: polygonsIntersect,
    checkFurnitureCollision: checkFurnitureCollision,
    isWallUnit: isWallUnitCategory,
    checkPlacementOverlap: checkPlacementOverlap,
    getUnitIcon: getUnitIcon,
    sanitizeIconId: sanitizeIconId
  };
});
