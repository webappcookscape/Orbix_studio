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
    clone: function (p) { return p ? { x: p.x, y: p.y } : { x: 0, y: 0 }; },
    add: function (a, b) {
      if (!a) return b ? { x: b.x, y: b.y } : { x: 0, y: 0 };
      if (!b) return { x: a.x, y: a.y };
      return { x: a.x + b.x, y: a.y + b.y };
    },
    sub: function (a, b) {
      if (!a) return b ? { x: -b.x, y: -b.y } : { x: 0, y: 0 };
      if (!b) return { x: a.x, y: a.y };
      return { x: a.x - b.x, y: a.y - b.y };
    },
    scale: function (p, s) { return p ? { x: p.x * s, y: p.y * s } : { x: 0, y: 0 }; },
    dist: function (a, b) {
      if (!a || !b) return 0;
      var dx = b.x - a.x, dy = b.y - a.y;
      return Math.sqrt(dx * dx + dy * dy);
    },
    distSq: function (a, b) {
      if (!a || !b) return 0;
      var dx = b.x - a.x, dy = b.y - a.y;
      return dx * dx + dy * dy;
    },
    len: function (p) {
      if (!p) return 0;
      return Math.sqrt(p.x * p.x + p.y * p.y);
    },
    normalize: function (p) {
      if (!p) return { x: 0, y: 0 };
      var l = Math.sqrt(p.x * p.x + p.y * p.y);
      return l > 1e-9 ? { x: p.x / l, y: p.y / l } : { x: 0, y: 0 };
    },
    dot: function (a, b) {
      if (!a || !b) return 0;
      return a.x * b.x + a.y * b.y;
    },
    cross: function (a, b) {
      if (!a || !b) return 0;
      return a.x * b.y - a.y * b.x;
    },
    angle: function (a, b) {
      if (!a || !b) return 0;
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
    },
    // Guaranteed Interior Visual Center (Pole of Inaccessibility)
    // Ensures room title/badge point is strictly inside room walls, even for concave (L/T-shaped) polygons
    interiorVisualCenter: function (poly) {
      if (!poly || poly.length < 3) return { x: 0, y: 0 };
      var centroid = Vec2.polygonCentroid(poly);
      // Check if centroid is comfortably inside polygon (at least 150mm from all wall edges)
      if (Vec2.pointInPolygon(centroid, poly)) {
        var minClearance = Infinity;
        for (var i = 0; i < poly.length; i++) {
          var p1 = poly[i], p2 = poly[(i + 1) % poly.length];
          var proj = Vec2.projectOnSegment(centroid, p1, p2);
          if (proj.dist < minClearance) minClearance = proj.dist;
        }
        if (minClearance >= 150) {
          return centroid;
        }
      }

      // If centroid is outside (e.g. concave L-shape) or too close to a wall, find internal pole of inaccessibility
      var minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
      for (var p = 0; p < poly.length; p++) {
        if (poly[p].x < minX) minX = poly[p].x;
        if (poly[p].x > maxX) maxX = poly[p].x;
        if (poly[p].y < minY) minY = poly[p].y;
        if (poly[p].y > maxY) maxY = poly[p].y;
      }

      var bestPt = centroid;
      var bestDist = -1;
      var steps = 16;
      var stepX = (maxX - minX) / steps;
      var stepY = (maxY - minY) / steps;

      for (var ix = 1; ix < steps; ix++) {
        for (var iy = 1; iy < steps; iy++) {
          var cand = { x: minX + ix * stepX, y: minY + iy * stepY };
          if (Vec2.pointInPolygon(cand, poly)) {
            var candMinDist = Infinity;
            for (var e = 0; e < poly.length; e++) {
              var ep1 = poly[e], ep2 = poly[(e + 1) % poly.length];
              var cProj = Vec2.projectOnSegment(cand, ep1, ep2);
              if (cProj.dist < candMinDist) candMinDist = cProj.dist;
            }
            if (candMinDist > bestDist) {
              bestDist = candMinDist;
              bestPt = cand;
            }
          }
        }
      }
      return bestPt;
    },
    // Polygon sanitization: remove consecutive duplicates, dead-end spikes/reversals, and collinear points
    cleanPolygon: function (pts) {
      if (!pts || !Array.isArray(pts) || pts.length < 3) return [];
      var res = [];
      for (var i = 0; i < pts.length; i++) {
        if (pts[i] && typeof pts[i].x === 'number' && typeof pts[i].y === 'number') {
          res.push({ x: Math.round(pts[i].x * 10) / 10, y: Math.round(pts[i].y * 10) / 10 });
        }
      }
      if (res.length < 3) return [];

      var globalChanged = true;
      var passes = 0;
      while (globalChanged && passes++ < 12 && res.length >= 3) {
        globalChanged = false;

        // 1. Remove consecutive duplicates (< 20mm)
        var n1 = res.length;
        var next1 = [];
        for (var i = 0; i < n1; i++) {
          var p = res[i];
          var pNext = res[(i + 1) % n1];
          if (Math.hypot(p.x - pNext.x, p.y - pNext.y) < 20) {
            globalChanged = true;
            continue;
          }
          next1.push(p);
        }
        res = next1;
        if (res.length < 3) break;

        // 2. Remove spikes (A -> B -> A or acute turnarounds where dot product < -0.998)
        // Guard: NEVER remove vertices from a 3-vertex triangle (preserves all triangular & slender rooms)
        if (res.length > 3) {
          var n2 = res.length;
          var spikeFound = false;
          for (var i = 0; i < n2; i++) {
            var prev = res[(i - 1 + n2) % n2];
            var curr = res[i];
            var next = res[(i + 1) % n2];
            var d = Math.hypot(prev.x - next.x, prev.y - next.y);
            if (d < 30) {
              res.splice(i, 1);
              globalChanged = true;
              spikeFound = true;
              break;
            }
            var v1x = curr.x - prev.x, v1y = curr.y - prev.y;
            var v2x = next.x - curr.x, v2y = next.y - curr.y;
            var l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
            if (l1 > 10 && l2 > 10) {
              var dot = (v1x * v2x + v1y * v2y) / (l1 * l2);
              if (dot < -0.998) {
                res.splice(i, 1);
                globalChanged = true;
                spikeFound = true;
                break;
              }
            }
          }
          if (spikeFound) continue;
        }

        // 3. Remove collinear points along straight lines (sin(theta) < 0.02 and dot > 0)
        // Guard: only prune collinear if remaining vertices >= 3
        var n3 = res.length;
        var next3 = [];
        for (var i = 0; i < n3; i++) {
          var prev = res[(i - 1 + n3) % n3];
          var curr = res[i];
          var nextP = res[(i + 1) % n3];
          var v1x = curr.x - prev.x, v1y = curr.y - prev.y;
          var v2x = nextP.x - curr.x, v2y = nextP.y - curr.y;
          var cross = v1x * v2y - v1y * v2x;
          var dot = v1x * v2x + v1y * v2y;
          var l1 = Math.hypot(v1x, v1y), l2 = Math.hypot(v2x, v2y);
          var sinTheta = Math.abs(cross) / (l1 * l2 + 1e-9);
          if (sinTheta < 0.02 && dot > 0 && (n3 - (n3 - next3.length)) > 3) {
            globalChanged = true;
            continue;
          }
          next3.push(curr);
        }
        if (next3.length >= 3) res = next3;
      }
      return res.length >= 3 ? res : [];
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Model Types & Price Variant Matrix (from Factory Price Card)
     ───────────────────────────────────────────────────────────────────────────── */
  var PRICE_TIERS = [
    'zappo - el pearl', 'pot&cafe', 'homespace', 'cafehunt',
    'LL elite', 'CC MATTE', 'CC GLOSSY', 'SURABHI', 'MR+'
  ];

  function normalizeTierName(tier) {
    if (!tier) return 'zappo - el pearl';
    var s = String(tier).trim().toLowerCase();
    if (s === 'p1' || s === 'price 1' || s === 'price1' || s === 'zappo - el pearl' || s === 'zappo-el pearl' || s === 'zappo-el-pearl' || s === 'zappo – el pearl') return 'zappo - el pearl';
    if (s === 'p2' || s === 'price 2' || s === 'price2' || s === 'pot&cafe' || s === 'pot & cafe' || s === 'pot and cafe') return 'pot&cafe';
    if (s === 'p3' || s === 'price 3' || s === 'price3' || s === 'homespace' || s === 'home space') return 'homespace';
    if (s === 'p4' || s === 'price 4' || s === 'price4' || s === 'cafehunt' || s === 'cafe hunt' || s === 'cafe-hunt' || s === 'livlame' || s === 'liv flame' || s === 'liv-lame') return 'cafehunt';
    if (s === 'livelane' || s === 'live lane' || s === 'll elite' || s === 'llelite') return 'LL elite';
    if (s === 'cc matte' || s === 'ccmatte') return 'CC MATTE';
    if (s === 'cc glossy' || s === 'ccglossy' || s === 'capricost glossy' || s === 'capricost') return 'CC GLOSSY';
    if (s === 'surabhi' || s === 'elegant surabhi') return 'SURABHI';
    if (s === 'mr+' || s === 'mr plus' || s === '4x tuff gloss' || s === '4x tg' || s === '4xtg' || s === 'tuff gloss') return 'MR+';
    return tier;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Detailed Factory Specifications & Bill of Materials (BOM) per Tier
     ───────────────────────────────────────────────────────────────────────────── */
  var TIER_SPECIFICATIONS = {
    'LL elite': {
      tierName: 'LL ELITE',
      carcassMaterial: 'BWP Ply, Prelam Aqua Shield MDF-R, PLHMR - BSL - HYH',
      carcassFinish: 'Frosty White',
      shutterFinish: 'Laminate Solid Hi Gloss, Laminate Solid Suede, Prelam Aqua Shield-MDF-Clr-BSL',
      shutterMaterial: 'Hydroguard Plus HDF, Prelam Aqua Shield-MDF-Clr-BSL, Commercial Ply, Aqua Shield-MDF-R, MDF',
      handles: 'Dual Switch EBCO / Tyrox Nickel Brush (CH-15060 160mm, CH-15061 96mm)',
      hardwareBrand: 'Tyrox',
      handleFinish: 'Nickel Brush',
      kitchenAccessories: 'Tyrox Brand',
      productionTimeline: '4 Weeks from Color Drawing Physical Sign Off',
      warrantySummary: 'Standard Factory Warranty'
    },
    'CC MATTE': {
      tierName: 'CC MATTE',
      carcassMaterial: 'Prelam BWP IS 710 Grade / GREENPLY Backer',
      carcassFinish: 'Matching / Frosty White Backer',
      shutterFinish: 'Matte Finish Flex Laminate (Merino Lam Calplus Series SF Finish / New Mica)',
      shutterMaterial: 'BWP IS 710 Grade GURJAN Ply',
      customization: 'Available for Inner Partitions on Additional cost',
      primaryHinges: 'OLIVER / SLEEK',
      hangerRods: 'Multi Profile Hager HD Rods – EBCO',
      wardrobeLocks: 'Dual Switch EBCO',
      legWallBracket: 'ABS / Adjustable',
      slidingTrack: 'CNR Brand with Two Way slide',
      liftUpPiston: 'BLUM Brand / 15 Kgs Load',
      screwsClamps: 'HP Screws / Self threading Type',
      skirting: 'Matching Shutter Finish Skirting',
      mirrorsGlass: '4mm Saint Gobain',
      installationProcess: 'Self-Drilling Screws with Screw caps',
      installationDuration: '4 Weeks (increases if scope includes Civil/Electrical)',
      inclusiveCost: 'Installation and Transportation',
      taxes: 'Prices are Excluding GST',
      laminatePasting: 'Machine Pressed Lamination',
      edgeBanding: 'PVC imported (Machine Edge Banding)',
      adhesives: 'FEVICOL SR / Hot Melt Pidilite SR',
      faciaBrand: 'MERINO LAM Calplus Series SF Finish / New Mica',
      hardwareBrand: 'Sleek / OLIVE / Evershine',
      kitchenAccessories: 'SLEEK BRAND',
      productionTimeline: '4 Weeks from Color Drawing Physical Sign Off'
    },
    'CC GLOSSY': {
      tierName: 'CAPRICOST GLOSSY',
      carcassMaterial: 'Prelam BWP IS 710 Grade / GREENPLY Backer',
      carcassFinish: 'Matching / Frosty White Backer',
      shutterFinish: 'GLOSSY Finish Flex Laminate (HGL / SGL) - MERINO LAM SF, RH Series / New Mica',
      shutterMaterial: 'High Density High Moisture Resistant Boards (HDHMR)',
      customization: 'Available for Inner Partitions on Additional cost',
      primaryHinges: 'EBCO (12 kg)',
      hangerRods: 'Multi Profile Hager HD Rods – EBCO',
      wardrobeLocks: 'Dual Switch EBCO',
      legWallBracket: 'ABS / Adjustable',
      slidingTrack: 'CNR Brand with Two Way slide',
      liftUpPiston: 'BLUM Brand / 15 Kgs Load',
      screwsClamps: 'HP Screws / Self threading Type',
      skirting: 'Matching Shutter Finish Skirting',
      mirrorsGlass: '4mm Saint Gobain',
      installationProcess: 'Self-Drilling Screws with Screw caps',
      installationDuration: '4 Weeks (increases if scope includes Civil/Electrical)',
      inclusiveCost: 'Installation and Transportation',
      taxes: 'Prices are Excluding GST',
      laminatePasting: 'Machine Pressed Lamination',
      edgeBanding: 'E3 Brand / PVC (Hot melt Glue Machine Edge Banding)',
      adhesives: 'FEVICOL SR / Hot Melt Pidilite SR',
      faciaBrand: 'MERINO LAM SF, RH Series / New Mica',
      hardwareBrand: 'EBCO (12 kg) / All Regular Hinges only',
      kitchenAccessories: 'EBCO BRAND',
      productionTimeline: '4 Weeks from Color Drawing Physical Sign Off'
    },
    'SURABHI': {
      tierName: 'ELEGANT SURABHI',
      carcassMaterial: 'Prelam BWP IS 710 Grade / GREENPLY Backer',
      carcassFinish: 'Matching / Frosty White Backer',
      shutterFinish: 'Matte Finish 1 MM CCR Laminates (Merino / CATCH LAMINATES)',
      shutterMaterial: 'BWP IS 710 Grade GURJAN Ply / GREENPLY HDHMR',
      customization: 'Available for Inner Partitions on Additional cost',
      primaryHinges: 'EBCO (12 kg) — 1 Soft closing for kitchen & Auto close for Wardrobes',
      hangerRods: 'Multi Profile Hager HD Rods – EBCO',
      wardrobeLocks: 'Dual Switch EBCO',
      legWallBracket: 'ABS / Adjustable',
      slidingTrack: 'CNR Brand with Two Way slide',
      liftUpPiston: 'BLUM Brand / 15 Kgs Load',
      screwsClamps: 'HP Screws / Self threading Type',
      skirting: 'Matching Shutter Finish Skirting',
      mirrorsGlass: '4mm Saint Gobain',
      installationProcess: 'Self-Drilling Screws with Screw caps',
      installationDuration: '4 Weeks (increases if scope includes Civil/Electrical)',
      inclusiveCost: 'Installation and Transportation',
      taxes: 'Prices are Excluding GST',
      laminatePasting: 'Machine Pressed Lamination',
      edgeBanding: 'E3 Brand / PVC (Hot melt Glue Machine Edge Banding)',
      adhesives: 'SYNTHETIC ADHESIVE Grade : LK453 / HOT MELT ANABOND - SU2710',
      additionalProcess: 'Ext. Grading, Fungal Spray Coating, Multi Boring on Ply',
      faciaBrand: 'MERINO LAM SF, RH Series / New Mica',
      hardwareBrand: 'EBCO (12 kg Soft Close)',
      kitchenAccessories: 'HETTICH Brand',
      productionTimeline: '6 to 8 Weeks from Color Drawing Physical Sign Off'
    },
    'MR+': {
      tierName: '4X TUFF GLOSS (MR+)',
      carcassMaterial: 'Prelam BWP IS 710 Grade / GREENPLY Backer',
      carcassFinish: 'Matching / Frosty White Backer',
      shutterFinish: 'SCRATCH & STAIN FREE FINISH (4X TG / MR+) MERINO / ROYAL TOUCHE GLOSS',
      shutterMaterial: 'BWP IS 710 Grade GURJAN Ply / GREENPLY HDHMR',
      customization: 'Available for Inner Partitions on Additional cost',
      primaryHinges: 'EBCO (12 kg) — 1 Soft closing for kitchen & Auto close for Wardrobes',
      hangerRods: 'Multi Profile Hager HD Rods – EBCO',
      wardrobeLocks: 'Dual Switch EBCO',
      legWallBracket: 'ABS / Adjustable',
      slidingTrack: 'CNR Brand with Two Way slide',
      liftUpPiston: 'BLUM Brand / 15 Kgs Load',
      screwsClamps: 'HP Screws / Self threading Type',
      skirting: 'Matching Shutter Finish Skirting',
      mirrorsGlass: '4mm Saint Gobain',
      installationProcess: 'Self-Drilling Screws with Screw caps',
      installationDuration: '4 Weeks (increases if scope includes Civil/Electrical)',
      inclusiveCost: 'Installation and Transportation',
      taxes: 'Prices are Excluding GST',
      laminatePasting: 'Machine Pressed Lamination',
      edgeBanding: 'E3 Brand / PVC (Hot melt Glue Machine Edge Banding)',
      adhesives: 'SYNTHETIC ADHESIVE Grade : LK453 / HOT MELT ANABOND - SU2710',
      additionalProcess: 'Ext. Grading, Fungal Spray Coating, Multi Boring on Ply',
      faciaBrand: 'Merino MR + / Royal Touche GLOSS',
      hardwareBrand: 'EBCO (12 kg Soft Close)',
      kitchenAccessories: 'HETTICH Brand',
      productionTimeline: '6 to 8 Weeks from Color Drawing Physical Sign Off'
    }
  };
  // Cross-reference aliases
  TIER_SPECIFICATIONS['LL ELITE'] = TIER_SPECIFICATIONS['LL elite'];
  TIER_SPECIFICATIONS['CAPRICOST GLOSSY'] = TIER_SPECIFICATIONS['CC GLOSSY'];
  TIER_SPECIFICATIONS['ELEGANT SURABHI'] = TIER_SPECIFICATIONS['SURABHI'];
  TIER_SPECIFICATIONS['4X TUFF GLOSS'] = TIER_SPECIFICATIONS['MR+'];

  function getTierSpecifications(tier) {
    var norm = normalizeTierName(tier);
    return TIER_SPECIFICATIONS[norm] || TIER_SPECIFICATIONS[tier] || null;
  }

  var MODEL_RATES_MATRIX = {
    kitchen_wm: {
      id: 'kitchen_wm',
      label: 'Kitchen - WM',
      description: 'Kitchen Wall Mounted / Wall Units',
      category: 'kitchen_wall',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 1545, 'pot&cafe': 1696, 'homespace': 1785, 'cafehunt': 1950, 'livlame': 1950, 'LL elite': 2034, 'CC MATTE': 2228, 'CC GLOSSY': 2422, 'SURABHI': 2616, 'MR+': 2929,
        'ZAPPO - EL PEARL': 1545, 'POT&CAFE': 1696, 'HOMESPACE': 1785, 'CAFEHUNT': 1950, 'LIVLAME': 1950, 'LL ELITE': 2034,
        'PRICE 1': 1545, 'PRICE 2': 1696, 'PRICE 3': 1785, 'PRICE 4': 1950, 'LIVE LANE': 2034,
        'p1': 1545, 'p2': 1696, 'p3': 1785, 'p4': 1950, 'livelane': 2034
      }
    },
    kitchen_fm: {
      id: 'kitchen_fm',
      label: 'Kitchen - FM',
      description: 'Kitchen Floor Mounted / Base Units',
      category: 'kitchen_base',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 1796, 'pot&cafe': 1969, 'homespace': 1975, 'cafehunt': 2214, 'livlame': 2214, 'LL elite': 2500, 'CC MATTE': 2906, 'CC GLOSSY': 3113, 'SURABHI': 3391, 'MR+': 3786,
        'ZAPPO - EL PEARL': 1796, 'POT&CAFE': 1969, 'HOMESPACE': 1975, 'CAFEHUNT': 2214, 'LIVLAME': 2214, 'LL ELITE': 2500,
        'PRICE 1': 1796, 'PRICE 2': 1969, 'PRICE 3': 1975, 'PRICE 4': 2214, 'LIVE LANE': 2500,
        'p1': 1796, 'p2': 1969, 'p3': 1975, 'p4': 2214, 'livelane': 2500
      }
    },
    kitchen_d2d3: {
      id: 'kitchen_d2d3',
      label: 'Kitchen - D2/D3',
      description: 'Kitchen 2-Drawer / 3-Drawer Tandem Units',
      category: 'kitchen_base',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 1972, 'pot&cafe': 2196, 'homespace': 2714, 'cafehunt': 2527, 'livlame': 2527, 'LL elite': 3600, 'CC MATTE': 3945, 'CC GLOSSY': 4172, 'SURABHI': 4469, 'MR+': 5227,
        'ZAPPO - EL PEARL': 1972, 'POT&CAFE': 2196, 'HOMESPACE': 2714, 'CAFEHUNT': 2527, 'LIVLAME': 2527, 'LL ELITE': 3600,
        'PRICE 1': 1972, 'PRICE 2': 2196, 'PRICE 3': 2714, 'PRICE 4': 2527, 'LIVE LANE': 3600,
        'p1': 1972, 'p2': 2196, 'p3': 2714, 'p4': 2527, 'livelane': 3600
      }
    },
    kitchen_os: {
      id: 'kitchen_os',
      label: 'Kitchen o/s (Only Shutter)',
      description: 'Kitchen Only Shutter (Without Carcass / Civil Slab Shutters)',
      category: 'kitchen_base',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 895, 'pot&cafe': 984, 'homespace': 1184, 'cafehunt': 1236, 'livlame': 1236, 'LL elite': 1196, 'CC MATTE': 1250, 'CC GLOSSY': 1567, 'SURABHI': 1786, 'MR+': 1984,
        'ZAPPO - EL PEARL': 895, 'POT&CAFE': 984, 'HOMESPACE': 1184, 'CAFEHUNT': 1236, 'LIVLAME': 1236, 'LL ELITE': 1196,
        'PRICE 1': 895, 'PRICE 2': 984, 'PRICE 3': 1184, 'PRICE 4': 1236, 'LIVE LANE': 1196,
        'p1': 895, 'p2': 984, 'p3': 1184, 'p4': 1236, 'livelane': 1196
      }
    },
    spice_rack: {
      id: 'spice_rack',
      label: 'Spice Rack (OPEN BOXES)',
      description: 'Spice Rack Open Storage Units',
      category: 'kitchen_wall',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 2272, 'pot&cafe': 2725, 'homespace': 3996, 'cafehunt': 4579, 'livlame': 4579, 'LL elite': 4650, 'CC MATTE': 4969, 'CC GLOSSY': 5679, 'SURABHI': 5786, 'MR+': 6969,
        'ZAPPO - EL PEARL': 2272, 'POT&CAFE': 2725, 'HOMESPACE': 3996, 'CAFEHUNT': 4579, 'LIVLAME': 4579, 'LL ELITE': 4650,
        'PRICE 1': 2272, 'PRICE 2': 2725, 'PRICE 3': 3996, 'PRICE 4': 4579, 'LIVE LANE': 4650,
        'p1': 2272, 'p2': 2725, 'p3': 3996, 'p4': 4579, 'livelane': 4650
      }
    },
    wr_shelves: {
      id: 'wr_shelves',
      label: 'Wr - Modular - ONLY SHELVES',
      description: 'Modular Wardrobe with Internal Shelves',
      category: 'wardrobe',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 1545, 'pot&cafe': 1696, 'homespace': 1872, 'cafehunt': 1996, 'livlame': 1996, 'LL elite': 1827, 'CC MATTE': 1984, 'CC GLOSSY': 2072, 'SURABHI': 2227, 'MR+': 2714,
        'ZAPPO - EL PEARL': 1545, 'POT&CAFE': 1696, 'HOMESPACE': 1872, 'CAFEHUNT': 1996, 'LIVLAME': 1996, 'LL ELITE': 1827,
        'PRICE 1': 1545, 'PRICE 2': 1696, 'PRICE 3': 1872, 'PRICE 4': 1996, 'LIVE LANE': 1827,
        'p1': 1545, 'p2': 1696, 'p3': 1872, 'p4': 1996, 'livelane': 1827
      }
    },
    wr_drawers: {
      id: 'wr_drawers',
      label: 'Wr - Modular - 2 DRAWERS',
      description: 'Modular Wardrobe with 2 Internal Drawers',
      category: 'wardrobe',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 1740, 'pot&cafe': 1891, 'homespace': 2067, 'cafehunt': 2191, 'livlame': 2191, 'LL elite': 2022, 'CC MATTE': 2179, 'CC GLOSSY': 2267, 'SURABHI': 2600, 'MR+': 3109,
        'ZAPPO - EL PEARL': 1740, 'POT&CAFE': 1891, 'HOMESPACE': 2067, 'CAFEHUNT': 2191, 'LIVLAME': 2191, 'LL ELITE': 2022,
        'PRICE 1': 1740, 'PRICE 2': 1891, 'PRICE 3': 2067, 'PRICE 4': 2191, 'LIVE LANE': 2022,
        'p1': 1740, 'p2': 1891, 'p3': 2067, 'p4': 2191, 'livelane': 2022
      }
    },
    wr_sliding: {
      id: 'wr_sliding',
      label: 'Wr - Modular - SLIDING',
      description: 'Modular Sliding Door Wardrobe',
      category: 'wardrobe',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 1795, 'pot&cafe': 1984, 'homespace': 2195, 'cafehunt': 2295, 'livlame': 2295, 'LL elite': 2345, 'CC MATTE': 2575, 'CC GLOSSY': 2725, 'SURABHI': 2929, 'MR+': 3366,
        'ZAPPO - EL PEARL': 1795, 'POT&CAFE': 1984, 'HOMESPACE': 2195, 'CAFEHUNT': 2295, 'LIVLAME': 2295, 'LL ELITE': 2345,
        'PRICE 1': 1795, 'PRICE 2': 1984, 'PRICE 3': 2195, 'PRICE 4': 2295, 'LIVE LANE': 2345,
        'p1': 1795, 'p2': 1984, 'p3': 2195, 'p4': 2295, 'livelane': 2345
      }
    },
    loft_os: {
      id: 'loft_os',
      label: 'Loft - O/S',
      description: 'Overhead Loft / Open Shutter Unit',
      category: 'wardrobe',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 895, 'pot&cafe': 996, 'homespace': 1069, 'cafehunt': 1227, 'livlame': 1227, 'LL elite': 996, 'CC MATTE': 1127, 'CC GLOSSY': 1269, 'SURABHI': 1369, 'MR+': 1567,
        'ZAPPO - EL PEARL': 895, 'POT&CAFE': 996, 'HOMESPACE': 1069, 'CAFEHUNT': 1227, 'LIVLAME': 1227, 'LL ELITE': 996,
        'PRICE 1': 895, 'PRICE 2': 996, 'PRICE 3': 1069, 'PRICE 4': 1227, 'LIVE LANE': 996,
        'p1': 895, 'p2': 996, 'p3': 1069, 'p4': 1227, 'livelane': 996
      }
    },
    pooja_cnc: {
      id: 'pooja_cnc',
      label: 'POOJA WITH CNC',
      description: 'Mandir / Pooja Unit with CNC Jali',
      category: 'crockery',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 1969, 'pot&cafe': 2196, 'homespace': 2725, 'cafehunt': 3169, 'livlame': 3169, 'LL elite': 2100, 'CC MATTE': 2260, 'CC GLOSSY': 2433, 'SURABHI': 2848, 'MR+': 3129,
        'ZAPPO - EL PEARL': 1969, 'POT&CAFE': 2196, 'HOMESPACE': 2725, 'CAFEHUNT': 3169, 'LIVLAME': 3169, 'LL ELITE': 2100,
        'PRICE 1': 1969, 'PRICE 2': 2196, 'PRICE 3': 2725, 'PRICE 4': 3169, 'LIVE LANE': 2100,
        'p1': 1969, 'p2': 2196, 'p3': 2725, 'p4': 3169, 'livelane': 2100
      }
    },
    tv_cabinet: {
      id: 'tv_cabinet',
      label: 'TV Unit Cabinet',
      description: 'TV Media Console & Cabinet Wall',
      category: 'tv_unit',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 1984, 'pot&cafe': 2724, 'homespace': 2929, 'cafehunt': 3786, 'livlame': 3786, 'LL elite': 3600, 'CC MATTE': 4200, 'CC GLOSSY': 4359, 'SURABHI': 4844, 'MR+': 5679,
        'ZAPPO - EL PEARL': 1984, 'POT&CAFE': 2724, 'HOMESPACE': 2929, 'CAFEHUNT': 3786, 'LIVLAME': 3786, 'LL ELITE': 3600,
        'PRICE 1': 1984, 'PRICE 2': 2724, 'PRICE 3': 2929, 'PRICE 4': 3786, 'LIVE LANE': 3600,
        'p1': 1984, 'p2': 2724, 'p3': 2929, 'p4': 3786, 'livelane': 3600
      }
    },
    wall_paneling: {
      id: 'wall_paneling',
      label: 'Wall Paneling',
      description: 'Decorative Fluted Wall Paneling',
      category: 'wall_paneling',
      pricingModel: 'front_area',
      rates: {
        'zappo - el pearl': 796, 'pot&cafe': 845, 'homespace': 936, 'cafehunt': 969, 'livlame': 969, 'LL elite': 960, 'CC MATTE': 1027, 'CC GLOSSY': 1196, 'SURABHI': 1247, 'MR+': 1427,
        'ZAPPO - EL PEARL': 796, 'POT&CAFE': 845, 'HOMESPACE': 936, 'CAFEHUNT': 969, 'LIVLAME': 969, 'LL ELITE': 960,
        'PRICE 1': 796, 'PRICE 2': 845, 'PRICE 3': 936, 'PRICE 4': 969, 'LIVE LANE': 960,
        'p1': 796, 'p2': 845, 'p3': 936, 'p4': 969, 'livelane': 960
      }
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
        standardHeight: 700
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
      'MDF 3410': { name: 'Walnut Woodgrain', rateAddPerSft: 0 },
      'MDF 2204': { name: 'Sonoma Oak', rateAddPerSft: 0 },
      'MDF 6601': { name: 'Gloss White Acrylic', rateAddPerSft: 0 },
      'MDF 7701': { name: 'Sage Green Matte', rateAddPerSft: 0 },
      'MDF 7707': { name: 'Navy Blue Matte', rateAddPerSft: 0 },
      'MDF 8801': { name: 'Concrete Look', rateAddPerSft: 0 }
    },
    laborRates: {
      installationPerSft: 0,
      carcassAssemblyPerSft: 0,
      transportLumpSum: 0
    }
  };

  /* ─────────────────────────────────────────────────────────────────────────────
     Architectural Element Factory Functions
     ───────────────────────────────────────────────────────────────────────────── */
  function createWall(opts) {
    opts = opts || {};
    var isDiv = !!opts.isDivider;
    return {
      id: opts.id || uid(isDiv ? 'divider' : 'wall'),
      start: { x: opts.start ? opts.start.x : 0, y: opts.start ? opts.start.y : 0 },
      end: { x: opts.end ? opts.end.x : 0, y: opts.end ? opts.end.y : 0 },
      thickness: isDiv ? 0 : (opts.thickness !== undefined ? opts.thickness : 150), // 0 for divider, 150mm for standard wall
      height: isDiv ? 0 : (opts.height !== undefined ? opts.height : 2800), // 0 for divider, 2.8m for wall
      material: opts.material || 'plaster_white',
      openings: opts.openings ? opts.openings.slice() : [],
      pinned: !!opts.pinned,
      startLocked: opts.startLocked !== undefined ? !!opts.startLocked : true,
      endLocked: opts.endLocked !== undefined ? !!opts.endLocked : true,
      isDivider: isDiv
    };
  }

  function createRoomDivider(opts) {
    opts = opts || {};
    opts.isDivider = true;
    opts.thickness = 0;
    opts.height = 0;
    return createWall(opts);
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
      doorType: opts.doorType || (type === 'door' ? 'single_closed' : undefined), // 'single_closed' | 'double' | 'sliding' | 'frame_only'
      windowType: opts.windowType || (type === 'window' ? 'sliding' : undefined), // 'sliding' | 'flapup' | 'standard'
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

  function isWallUnitCategory(category, name, code, costCategory) {
    var cat = (category || '').toLowerCase();
    var nm = (name || '').toLowerCase();
    var cd = (code || '').toLowerCase();
    var cc = (costCategory || '').toLowerCase();

    // Wall Paneling, Back Panels, Ledges, and Blank Shutters (bs-60) are decorative/filler panels, NOT wall cabinets
    if (cat === 'wall_paneling' || cat === 'ledges' || cc === 'wall paneling' || cd === 'bs-60' ||
        /blank[-_ ]*shutter|ledge|pnl[-_]?back/i.test(nm) || /blank[-_ ]*shutter|ledge|pnl[-_]?back/i.test(cd)) {
      return false;
    }

    // WFM (Wall Furniture Module / Rolling shutter wfm60) & overhead units are explicitly wall units
    if (/(^|\b|_|-)(wfm|wm|wcm|wbcm)($|\b|_|-|\d+)/i.test(cd) || /(^|\b|_|-)(wfm|wm|wcm|wbcm)($|\b|_|-|\d+)/i.test(nm) || /rolling\s*shutter/i.test(nm)) {
      return true;
    }

    // Base units (including FM floor mounted kitchen units) are never wall units
    if (nm.indexOf('base') !== -1 || cat.indexOf('base') !== -1 || cc.indexOf('base') !== -1 || cd.indexOf('base') !== -1 ||
        cat === 'kitchen_fm' || nm.indexOf('fm') !== -1 || /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(nm) ||
        /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(cd) || cc.indexOf('fm') !== -1) {
      return false;
    }

    // Check categories and cost categories
    if (cat.indexOf('wall') !== -1 || cat.indexOf('overhead') !== -1 || cat.indexOf('spice') !== -1 ||
        cat.indexOf('loft') !== -1 || cat.indexOf('wm') !== -1 || cat.indexOf('wcm') !== -1 ||
        cat === 'k_wall' || cat === 'kitchen_wall' || cat === 'crockery_wall' || cat === 'spice_rack' ||
        cat === 'loft_os' || cat === 'kitchen_wm') {
      return true;
    }
    if (cc.indexOf('wall') !== -1 || cc.indexOf('overhead') !== -1 || cc.indexOf('spice') !== -1 ||
        cc.indexOf('loft') !== -1 || cc.indexOf('wm') !== -1) {
      return true;
    }
    if (cd.indexOf('wm') !== -1 || cd.indexOf('wcm') !== -1 || cd.indexOf('wall') !== -1) {
      return true;
    }
    if (nm.indexOf('wall') !== -1 || nm.indexOf('overhead') !== -1 || nm.indexOf('spice rack') !== -1 ||
        nm.indexOf('spice_rack') !== -1 || nm.indexOf('loft') !== -1 ||
        /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(nm)) {
      return true;
    }
    return false;
  }

  function createFurniturePlacement(opts) {
    if (typeof opts === 'string') {
      var found = FURNITURE_CATALOG.find(function (c) { return c.id === opts; });
      opts = found ? JSON.parse(JSON.stringify(found)) : { id: opts, name: opts };
      // When instantiated from catalog string, preserve catalog template ID as catalogItemId, and generate unique instance id
      opts.catalogItemId = opts.catalogItemId || opts.id;
      delete opts.id;
    } else if (opts && (opts.id || opts.catalogItemId)) {
      var targetCatId = opts.catalogItemId || opts.id;
      var foundCat = FURNITURE_CATALOG.find(function (c) { return c.id === targetCatId || c.code === targetCatId; });
      if (foundCat) {
        var clone = JSON.parse(JSON.stringify(foundCat));
        opts = Object.assign(clone, opts, {
          unitConfig: Object.assign({}, clone.unitConfig, opts.unitConfig || {}),
          dimensions: Object.assign({}, clone.dimensions, opts.dimensions || {})
        });
      }
    }
    opts = opts || {};
    var isCatalogTemplate = opts.id ? FURNITURE_CATALOG.some(function (c) { return c.id === opts.id; }) : false;
    var catalogItemId = opts.catalogItemId || (isCatalogTemplate ? opts.id : (opts.code || null));
    var instanceId = opts.id;
    if (!instanceId || isCatalogTemplate) {
      instanceId = uid('furn');
    }
    var isDecor = !!(opts.isDecor || opts.excludeFromPricing || opts.category === 'decor' || opts.category === 'appliance_decor');
    var cat = (opts.category || (isDecor ? 'decor' : 'wardrobe')).toLowerCase();
    var nm = (opts.name || '').toLowerCase();
    var isWallUnit = !isDecor && isWallUnitCategory(opts.category, opts.name, opts.code || opts.catalogItemId, opts.costCategory);
    var isOpenBox = !isDecor && (
      nm.indexOf('open box') !== -1 || nm.indexOf('open_box') !== -1 ||
      (opts.id && /^(ob-|open-box|ctvw-open|ctvw-obs)/i.test(opts.id)) ||
      (opts.code && /^(ob-|open-box)/i.test(opts.code))
    );
    var isSpiceRack = !isDecor && !isOpenBox && (
      nm.indexOf('spice') !== -1 ||
      (opts.code && opts.code.toLowerCase().indexOf('spice') !== -1) ||
      (opts.id && opts.id.toLowerCase().indexOf('spice') !== -1) ||
      (opts.id && /^sr-/i.test(opts.id)) ||
      (cat === 'spice_rack' && !isOpenBox)
    );
    var isLoft = (cat.indexOf('loft') !== -1 || nm.indexOf('loft') !== -1 || (opts.id && String(opts.id).indexOf('loft') !== -1) || (opts.code && String(opts.code).indexOf('loft') !== -1));
    var isGL = /(^|\b|_|-|\s)gl(\b|_|-|\s|\d+|$)/i.test(String(opts.name || '') + ' ' + String(opts.code || '') + ' ' + String(opts.id || ''));
    var isOS = !!(
      (cat && (cat === 'loft_os' || cat === 'kitchen_o_s' || cat.indexOf('o/s') !== -1 || cat.indexOf('os') !== -1)) ||
      (opts.costCategory && opts.costCategory.indexOf('O/S') !== -1) ||
      (opts.modelType && /o_s|os/i.test(opts.modelType)) ||
      (nm && /\bo\/?s\b/i.test(nm)) ||
      (opts.id && /\bo_?s\b/i.test(opts.id)) ||
      (opts.code && /\bo_?s\b/i.test(opts.code)) ||
      (opts.unitConfig && opts.unitConfig.isOnlyShutter)
    );
    var isWrbOS = isOS && (cat === 'wardrobe' || /(^|\b|_|-)(wrb|wr)[-_ ]*(o\/?s|only[-_ ]*shutter)/i.test(nm || opts.id || ''));
    var is18mmPanelOrShutter = (opts.dimensions && opts.dimensions.D === 18) || cat === 'wall_paneling' || (nm.indexOf('blank shutter') !== -1) || (opts.id && /^(bs-|blank-shutter)/i.test(opts.id));
    var isBaseOS = isOS && !isLoft && !isWallUnit && !isWrbOS && !is18mmPanelOrShutter;
    var defElev = isLoft ? 2100 : (isOpenBox ? 1500 : (isSpiceRack ? 1350 : (isWallUnit ? 1500 : 0)));
    var checkId = String(opts.id || opts.catalogItemId || opts.code || '').toLowerCase();
    if (checkId === 'wfm60-roll' || /rolling\s*shutter|wfm.*roll/i.test(nm + ' ' + checkId) || (opts.unitConfig && (opts.unitConfig.isRollingShutter || opts.unitConfig.shutterType === 'rolling_shutter'))) {
      defElev = 750;
    } else if (checkId === 'ledge-std' || /^ledge(-std)?$/i.test(checkId) || nm === 'ledge') {
      defElev = 1200;
    } else if (checkId === 'ledge-ctop' || /ledge[-_ ]*c(ounter)?top/i.test(nm + ' ' + checkId)) {
      defElev = 850;
    } else if (checkId === 'ledge-vert' || /vert(ical)?[-_ ]*ledge/i.test(nm + ' ' + checkId)) {
      defElev = 0;
      if (opts.dimensions && opts.dimensions.W > opts.dimensions.D && opts.dimensions.W >= 500 && opts.dimensions.D <= 50) {
        var tempW = opts.dimensions.W;
        opts.dimensions.W = opts.dimensions.D;
        opts.dimensions.D = tempW;
      }
    } else if (checkId === 'pnl-back' || /back[-_ ]*panel/i.test(nm + ' ' + checkId)) {
      defElev = 300;
    } else if (checkId === 'pnl-wall' || /wall[-_ ]*panel/i.test(nm + ' ' + checkId)) {
      defElev = 0;
    } else if (checkId === 'bs-60' || /blank[-_ ]*shutter/i.test(nm + ' ' + checkId)) {
      defElev = 0;
    }

    var elev = (opts.elevation !== undefined && opts.elevation !== null && opts.elevation !== '') ?
      parseFloat(opts.elevation) :
      ((opts.pos && opts.pos.z !== undefined && opts.pos.z !== null && opts.pos.z !== '') ?
        parseFloat(opts.pos.z) : defElev);

    // Kitchen FM & Base defaults: 100mm leg, countertop, 1 shelf
    var isKitchenFM = (cat === 'kitchen_fm' || cat === 'kitchen_base' || cat === 'kitchen_corner' || cat === 'kitchen_drawers' || opts.modelType === 'kitchen_fm' || /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(nm));
    var isKitchenWM = isWallUnit || (cat.indexOf('wall') !== -1) || /(^|\b|_|-)(wm|wbcm)($|\b|_|-|\d+)/i.test(nm);
    var isCrockeryOnlyDoors = (cat.indexOf('crockery') !== -1 || nm.indexOf('crockery') !== -1) && (isOS || nm.indexOf('only door') !== -1 || (opts.id && opts.id.indexOf('doors-only') !== -1));

    opts.unitConfig = opts.unitConfig || {};
    if (isKitchenFM) {
      var isOnlyShutterUnit = isOS || (opts.unitConfig && opts.unitConfig.isOnlyShutter);
      var isFcmOsUnit = isOnlyShutterUnit && (/fcm[-_ ]*(rt|lt)/i.test(checkId + ' ' + nm) || (opts.unitConfig && /fcm[-_ ]*(rt|lt)/i.test(opts.unitConfig.unitType || '')));
      if (isOnlyShutterUnit && !isFcmOsUnit) {
        if (opts.unitConfig.hasLegs === undefined) opts.unitConfig.hasLegs = false;
        if (opts.unitConfig.counter === undefined) opts.unitConfig.counter = 'none';
        if (opts.unitConfig.shelves === undefined) opts.unitConfig.shelves = 0;
      } else {
        if (opts.unitConfig.hasLegs === undefined) opts.unitConfig.hasLegs = true;
        if (opts.unitConfig.legs === undefined) opts.unitConfig.legs = 100;
        if (opts.unitConfig.plinthH === undefined) opts.unitConfig.plinthH = 100;
        if (opts.unitConfig.counter === undefined || opts.unitConfig.counter === 'none') opts.unitConfig.counter = 'granite_kashmir_white';
        if (opts.unitConfig.shelves === undefined) opts.unitConfig.shelves = isFcmOsUnit ? 0 : 1;
      }
      if (opts.dimensions && (opts.dimensions.D === undefined || opts.dimensions.D < 100)) {
        opts.dimensions.D = 550;
      }
    }
    if (isKitchenWM && !isLoft) {
      if (opts.unitConfig.shelves === undefined) opts.unitConfig.shelves = 1;
    }
    if (isCrockeryOnlyDoors) {
      opts.unitConfig.shelves = 0;
    }
    if (isSpiceRack) {
      opts.unitConfig.shelves = 0;
      opts.unitConfig.shutters = 0;
      if (opts.elevation === undefined || opts.elevation === null || opts.elevation === 0) {
        opts.elevation = 1350;
      }
    }
    if (isOpenBox) {
      opts.unitConfig.shutters = 0;
      if (opts.elevation === undefined || opts.elevation === null || opts.elevation === 0) {
        opts.elevation = 1500;
      }
    }
    // Specific Crocker/TV Open Box / Open Storage dimensions & configs
    if (opts.id === 'ctvw-obs-02' || (nm.indexOf('open box storage 2') !== -1)) {
      opts.dimensions = opts.dimensions || {};
      opts.dimensions.D = 300;
    }
    if (opts.id === 'ctvw-open-box' || (nm.indexOf('open box storage') !== -1 && nm.indexOf('storage 2') === -1)) {
      opts.unitConfig.shelves = 0;
    }
    if (opts.id === 'ctvb-open-storage' || (nm.indexOf('crockery') !== -1 && nm.indexOf('base open storage') !== -1)) {
      opts.dimensions = opts.dimensions || {};
      opts.dimensions.H = 750;
    }
    if (isWrbOS) {
      opts.unitConfig.isOnlyShutter = true;
      opts.dimensions = opts.dimensions || {};
      opts.dimensions.H = (opts.dimensions.H !== undefined && opts.dimensions.H !== null) ? opts.dimensions.H : 2100;
      opts.dimensions.D = (opts.dimensions.D !== undefined && opts.dimensions.D !== null) ? opts.dimensions.D : 18;
      if (!opts.dimensions.W) {
        opts.dimensions.W = (opts.id && opts.id.indexOf('120') !== -1 || nm.indexOf('120') !== -1) ? 1200 : 600;
      }
      opts.elevation = 0;
      opts.unitConfig.counter = 'none';
      opts.unitConfig.hasLegs = false;
      opts.unitConfig.legs = 0;
      opts.unitConfig.plinthH = 0;
      opts.unitConfig.shelves = 0;
      opts.unitConfig.drawers = 0;
      opts.unitConfig.shutters = opts.dimensions.W > 600 ? 2 : 1;
    } else if (isOS) {
      opts.unitConfig.isOnlyShutter = true;
      if (opts.dimensions) {
        var is18mmPanelOrShutter = (opts.dimensions.D === 18) || cat === 'wall_paneling' || (nm.indexOf('blank shutter') !== -1) || (opts.id && /^(bs-|blank-shutter)/i.test(opts.id));
        if (!is18mmPanelOrShutter && (opts.dimensions.D === undefined || opts.dimensions.D < 100)) {
          opts.dimensions.D = isWallUnit ? 350 : 550;
        }
      }
    }
    var isFmD2 = /(^|\b|_|-)(fm[-_ ]*d2)($|\b|_|-|\d+)/i.test(nm || opts.id || opts.code || '');
    var isFmD3 = /(^|\b|_|-)(fm[-_ ]*d3)($|\b|_|-|\d+)/i.test(nm || opts.id || opts.code || '');
    if (isFmD2) {
      opts.unitConfig.drawers = 2;
      opts.unitConfig.shutters = 0;
      opts.unitConfig.doorType = 'none';
      opts.unitConfig.drawersSideBySide = false;
    }
    if (isFmD3) {
      opts.unitConfig.drawers = 3;
      opts.unitConfig.shutters = 0;
      opts.unitConfig.doorType = 'none';
    }
    if (isBaseOS) {
      if (opts.unitConfig.hasLegs === undefined) opts.unitConfig.hasLegs = (opts.unitConfig.isOnlyShutter ? false : true);
      if (opts.unitConfig.legs === undefined) opts.unitConfig.legs = (opts.unitConfig.hasLegs ? 100 : 0);
      if (opts.unitConfig.plinthH === undefined) opts.unitConfig.plinthH = (opts.unitConfig.hasLegs ? 100 : 0);
      if (opts.unitConfig.counter === undefined) opts.unitConfig.counter = (opts.unitConfig.isOnlyShutter ? 'none' : 'black');
      if (opts.dimensions && (opts.dimensions.D === undefined || opts.dimensions.D < 100)) {
        opts.dimensions.D = 550;
      }
    }

    var numShutters = (opts.unitConfig && opts.unitConfig.shutters !== undefined) ?
      parseInt(opts.unitConfig.shutters) :
      ((opts.dimensions && opts.dimensions.W > 1200) ? 3 : 2);
    var numDrawers = (opts.unitConfig && opts.unitConfig.drawers !== undefined) ?
      parseInt(opts.unitConfig.drawers) : 0;

    var initColors = opts.shutterColors ? opts.shutterColors.slice() : [];
    var initMats = opts.shutterMaterials ? opts.shutterMaterials.slice() : [];
    var initStates = opts.shutterStates ? opts.shutterStates.slice() : [];
    var initDrawerStates = opts.drawerStates ? opts.drawerStates.slice() : [];
    var defColor = (opts.shutter && opts.shutter.finish) || opts.shutterFinish || (opts.unitConfig && opts.unitConfig.shutterCol) || 'MDF 7707';
    if (defColor === 'BLUE' || defColor === 'MDF 7701' || !defColor) defColor = 'MDF 7707';
    var defCarcassFinish = (opts.carcass && opts.carcass.finish) || opts.carcassFinish || (opts.unitConfig && opts.unitConfig.carcass) || 'MDF 6601';
    if (defCarcassFinish === 'Absolute White' || defCarcassFinish === 'MDF 1135' || !defCarcassFinish) defCarcassFinish = 'MDF 6601';
    var defMat = (opts.shutter && opts.shutter.material) || opts.shutterMaterial || 'laminate';

    while (initColors.length < numShutters) initColors.push(defColor);
    while (initMats.length < numShutters) initMats.push(defMat);
    while (initStates.length < numShutters) initStates.push(false);
    while (initDrawerStates.length < numDrawers) initDrawerStates.push(false);

    return {
      id: instanceId,
      name: opts.name || 'Modular Unit',
      category: opts.category || 'wardrobe',
      catalogItemId: catalogItemId || opts.catalogItemId || opts.code || null,
      modelType: opts.modelType || null,
      costCategory: opts.costCategory || null,
      roomId: opts.roomId || null,
      pos: { x: opts.pos ? opts.pos.x : 0, y: opts.pos ? opts.pos.y : 0, z: elev },
      elevation: elev,
      rotY: opts.rotY || 0,
      dimensions: {
        W: opts.dimensions ? opts.dimensions.W : (isWallUnit ? 1200 : 1200),
        H: opts.dimensions ? opts.dimensions.H : (isWallUnit ? 600 : (cat.indexOf('base') !== -1 || cat.indexOf('fm') !== -1 || cat.indexOf('d2') !== -1 || cat.indexOf('d3') !== -1 || cat.indexOf('tv') !== -1 ? 850 : 2100)),
        D: (opts.dimensions && opts.dimensions.D !== undefined && (opts.dimensions.D >= 18 || isWrbOS || is18mmPanelOrShutter)) ?
          opts.dimensions.D :
          (isOS ? (is18mmPanelOrShutter || isWrbOS ? 18 : (isWallUnit ? 350 : 550)) : (opts.dimensions && opts.dimensions.D !== undefined ? opts.dimensions.D : (isWallUnit ? 350 : 600)))
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
          finish: defCarcassFinish
        }
      },
      // Links directly to Cupboard CAD parametric configuration
      unitConfig: (function() {
        var cfg = opts.unitConfig ? Object.assign({}, opts.unitConfig) : {};
        if (!cfg.shutterCol || cfg.shutterCol === 'BLUE' || cfg.shutterCol === 'MDF 7701') {
          cfg.shutterCol = 'MDF 7707';
        }
        if (!cfg.carcass || cfg.carcass === 'Absolute White' || cfg.carcass === 'MDF 1135' || String(cfg.carcass).startsWith('BWP_')) {
          cfg.carcass = 'MDF 6601';
        }
        if (isGL && (!cfg.dstyle || cfg.dstyle === 'slab')) {
          cfg.dstyle = 'glass';
          cfg.glassTint = cfg.glassTint || 'clear';
        }
        if (isOS) {
          cfg.isOnlyShutter = true;
          cfg.shutterThickness = 18;
        }
        return cfg;
      })(),
      pricingOverrides: opts.pricingOverrides || null,
      isDecor: isDecor,
      excludeFromPricing: isDecor,
      decorType: opts.decorType || null,
      slug: opts.slug || null,
      thumbnailUrl: opts.thumbnailUrl || null,
      modelUrl: opts.modelUrl || null,
      blobUrl: opts.blobUrl || null,
      modelFormat: opts.modelFormat || null,
      notes: opts.notes || ''
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Architectural Staircase Generation & Geometry Helpers
     Auto-calculates Start ➔ Turn (Landing) ➔ End (Ceiling Level) Steps
     ───────────────────────────────────────────────────────────────────────────── */
  function createStaircasePlacement(opts) {
    opts = opts || {};
    var type = opts.type || 'l_shape'; // 'l_shape' | 'u_shape' | 'straight'
    var turnDir = opts.turnDirection || 'right'; // 'right' | 'left'
    var width = opts.width || 900;
    var totalH = opts.totalHeight || 2800; // Ceiling level
    var riserCount = opts.riserCount || 16;
    var riserH = totalH / riserCount; // 175mm
    var treadD = opts.treadDepth || 250;
    var flight1 = opts.flight1Steps || (type === 'straight' ? riserCount : Math.floor(riserCount / 2));
    var flight2 = type === 'straight' ? 0 : (riserCount - flight1);
    var landingW = opts.landingWidth || width;
    var landingD = opts.landingDepth || (type === 'u_shape' ? width * 2 + 100 : width);

    return {
      id: opts.id || uid('stair'),
      type: type,
      turnDirection: turnDir,
      pos: opts.pos ? { x: opts.pos.x, y: opts.pos.y } : { x: 0, y: 0 },
      rotY: opts.rotY || 0,
      width: width,
      totalHeight: totalH,
      riserCount: riserCount,
      riserHeight: Math.round(riserH * 10) / 10,
      treadDepth: treadD,
      flight1Steps: flight1,
      flight2Steps: flight2,
      landingWidth: landingW,
      landingDepth: landingD,
      finish: opts.finish || 'marble', // 'marble' | 'wood' | 'concrete'
      railing: opts.railing || 'glass_steel', // 'glass_steel' | 'black_metal' | 'wood'
      stringer: opts.stringer !== undefined ? opts.stringer : true,
      elevation: opts.elevation || 0,
      roomId: opts.roomId || null,
      excludeFromPricing: true,
      isStaircase: true
    };
  }

  
  /*  autoSplitWallAtJunctions – when endpoint of a wall lands on the interior of
      another wall, split the target wall at the T-junction so the graph is properly
      connected and the room-detection algorithm can find all enclosures correctly.  */
  
  /*  Comprehensive autoSplitWallAtJunctions:
      1. T-Junctions: Wall endpoint touching interior of straight wall -> split wall
      2. X-Junctions: Crossing walls -> split at intersection
      3. RCC Joint Columns: Structural RCC pillars / columns along straight wall -> split wall into separate walls
  */
  function autoSplitWallAtJunctions(project) {
    var walls = project && project.plan && project.plan.walls;
    if (!walls || walls.length === 0) return false;
    var changed = false;

    // ── 1. Split walls at RCC Columns / Structural Pillars on straight walls ──
    var furnList = (project.plan && project.plan.furniture) || [];
    var rccItems = furnList.filter(function (f) {
      return f && (f.category === 'structural' || f.category === 'civil' ||
        (f.name && /rcc|column|pillar|post/i.test(f.name)) ||
        (f.id && /rcc|column|pillar|post/i.test(f.id)) ||
        (f.catalogItemId && /rcc|column|pillar|post/i.test(f.catalogItemId)));
    });

    for (var rccPass = 0; rccPass < 6; rccPass++) {
      var didSplitRcc = false;
      for (var ri = 0; ri < rccItems.length && !didSplitRcc; ri++) {
        var rcc = rccItems[ri];
        if (!rcc.pos) continue;
        for (var wi = 0; wi < project.plan.walls.length; wi++) {
          var wObj = project.plan.walls[wi];
          if (wObj.isDivider) continue;
          var pRcc = Vec2.projectOnSegment(rcc.pos, wObj.start, wObj.end);
          var wL = wallLength(wObj);
          var distEnds = Math.min(pRcc.t * wL, (1 - pRcc.t) * wL);
          // If RCC column is within wall thickness distance and not at the very endpoints:
          if (pRcc.dist <= Math.max(80, (wObj.thickness || 150) / 2 + 60) && distEnds >= 50) {
            var resRcc = splitWall(project, wObj.id, pRcc.pt);
            if (resRcc) {
              didSplitRcc = true;
              changed = true;
              break;
            }
          }
        }
      }
      if (!didSplitRcc) break;
    }

    // ── 2. Split walls at T-Junctions & Crossing X-Junctions ──
    var TOL = 100; // mm
    for (var pass = 0; pass < 8; pass++) {
      var didSplit = false;
      var curWalls = project.plan.walls.slice();
      for (var i = 0; i < curWalls.length && !didSplit; i++) {
        var wi = curWalls[i];
        // Test endpoints of wi against interior of wj (T-joint)
        var testPts = [wi.start, wi.end];
        for (var tp = 0; tp < testPts.length && !didSplit; tp++) {
          var pt = testPts[tp];
          for (var j = 0; j < curWalls.length && !didSplit; j++) {
            if (j === i) continue;
            var wj = curWalls[j];
            var dS = Vec2.dist(pt, wj.start);
            var dE = Vec2.dist(pt, wj.end);
            if (dS < 40 || dE < 40) continue; // Already at vertex
            var proj = Vec2.projectOnSegment(pt, wj.start, wj.end);
            var wjLen = wallLength(wj);
            var distEndWj = Math.min(proj.t * wjLen, (1 - proj.t) * wjLen);
            if (proj.dist < TOL && distEndWj >= 50) {
              var resT = splitWall(project, wj.id, proj.pt);
              if (resT) {
                // Snap touching endpoint of wi directly to proj.pt so they form a perfect joint!
                if (tp === 0) {
                  wi.start.x = proj.pt.x;
                  wi.start.y = proj.pt.y;
                } else {
                  wi.end.x = proj.pt.x;
                  wi.end.y = proj.pt.y;
                }
                didSplit = true;
                changed = true;
              }
            }
          }
        }
        // Test crossing intersection between wi and wj (X-joint)
        for (var j2 = i + 1; j2 < curWalls.length && !didSplit; j2++) {
          var wj2 = curWalls[j2];
          var inter = segmentIntersection(wi.start, wi.end, wj2.start, wj2.end);
          if (inter && inter.t1 > 0.03 && inter.t1 < 0.97 && inter.t2 > 0.03 && inter.t2 < 0.97) {
            var resX = splitWall(project, wi.id, inter.pt);
            if (resX) {
              splitWall(project, wj2.id, inter.pt);
              didSplit = true;
              changed = true;
            }
          }
        }
      }
      if (!didSplit) break;
    }
    return changed;
  }

  function getStaircasePolygon(stair) {
    if (!stair) return [];
    var pos = stair.pos || { x: 0, y: 0 };
    var rot = stair.rotY || 0;
    var W = stair.width || 900;
    var D = stair.treadDepth || 250;
    var f1 = stair.flight1Steps || 8;
    var f2 = stair.flight2Steps || 8;
    var type = stair.type || 'l_shape';
    var turnDir = stair.turnDirection || 'right';
    var sign = turnDir === 'left' ? -1 : 1;
    var lW = stair.landingWidth || W;
    var lD = stair.landingDepth || W;

    var pts = [];
    if (type === 'straight') {
      var totalL = f1 * D + (f2 > 0 ? f2 * D + lD : 0);
      pts = [
        { x: -W / 2, y: -totalL / 2 },
        { x: W / 2, y: -totalL / 2 },
        { x: W / 2, y: totalL / 2 },
        { x: -W / 2, y: totalL / 2 }
      ];
    } else if (type === 'u_shape') {
      var well = 100;
      var totalW = W * 2 + well;
      var totalL = Math.max(f1, f2) * D + lD;
      pts = [
        { x: -totalW / 2, y: -totalL / 2 },
        { x: totalW / 2, y: -totalL / 2 },
        { x: totalW / 2, y: totalL / 2 },
        { x: -totalW / 2, y: totalL / 2 }
      ];
    } else {
      // L-shape
      var f1L = f1 * D;
      var f2L = f2 * D;
      var bW = W + f2L;
      var bL = f1L + lD;
      if (sign === 1) { // right turn
        pts = [
          { x: -W / 2, y: -bL / 2 },
          { x: W / 2, y: -bL / 2 },
          { x: W / 2, y: bL / 2 - lD },
          { x: -W / 2 + bW, y: bL / 2 - lD },
          { x: -W / 2 + bW, y: bL / 2 },
          { x: -W / 2, y: bL / 2 }
        ];
      } else { // left turn
        pts = [
          { x: -W / 2, y: -bL / 2 },
          { x: W / 2, y: -bL / 2 },
          { x: W / 2, y: bL / 2 },
          { x: W / 2 - bW, y: bL / 2 },
          { x: W / 2 - bW, y: bL / 2 - lD },
          { x: -W / 2, y: bL / 2 - lD }
        ];
      }
    }

    var cosA = Math.cos(rot), sinA = Math.sin(rot);
    return pts.map(function (p) {
      return {
        x: pos.x + p.x * cosA - p.y * sinA,
        y: pos.y + p.x * sinA + p.y * cosA
      };
    });
  }

  // Automatically updates unit name and code when its width changes (e.g. FM 60 -> FM 45, WM 60 -> WM 45, Floor Base 600 -> Floor Base 450)
  function updateUnitNameForWidth(fn, oldW, newW) {
    if (!fn || !oldW || !newW || oldW === newW) return fn;
    var oldCm = Math.round(oldW / 10);
    var newCm = Math.round(newW / 10);
    var oldMm = Math.round(oldW);
    var newMm = Math.round(newW);

    function replaceWidthInString(str) {
      if (!str || typeof str !== 'string') return str;
      // 1. Try matching mm first (e.g. 600 -> 450)
      var regMm = new RegExp('(\\b|_|-)' + oldMm + '(\\b|_|-)', 'i');
      if (regMm.test(str)) {
        return str.replace(regMm, function (m, p1, p2) { return p1 + newMm + p2; });
      }
      // 2. Try matching cm (e.g. 60 -> 45) after a code prefix or at word boundary
      var regCm = new RegExp('(\\b|[a-zA-Z]+[-_ ]*)' + oldCm + '(\\b|_|-|\\s|$)', 'i');
      if (regCm.test(str)) {
        return str.replace(regCm, function (m, p1, p2) { return p1 + newCm + p2; });
      }
      return str;
    }

    if (fn.name) fn.name = replaceWidthInString(fn.name);
    if (fn.code) fn.code = replaceWidthInString(fn.code);
    if (fn.catalogItemId) fn.catalogItemId = replaceWidthInString(fn.catalogItemId);
    return fn;
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

  // Returns 2D polygon vertices of rotated furniture (6-vertex L-polygon for corner units, 4 vertices for rectangular OBB)
  function getFurniturePolygon(f) {
    var ang = f.rotY || 0;
    var cosA = Math.cos(ang), sinA = Math.sin(ang);
    var cx = (f.pos && f.pos.x) || 0, cy = (f.pos && f.pos.y) || 0;

    var isLCorner = !!(
      (f.unitConfig && (f.unitConfig.geometryType === 'l_shaped_corner' || f.unitConfig.unitType === 'fbcm' || f.unitConfig.unitType === 'wbcm' || (f.unitConfig.corner && f.unitConfig.corner.enabled))) ||
      f.catalogItemId === 'fbcm' || f.id === 'fbcm' || f.id === 'f_fbcm_1' || f.catalogItemId === 'fbcm-1500' || f.catalogItemId === 'wbcm' ||
      (f.id && /fbcm|wbcm/i.test(f.id)) ||
      (f.catalogItemId && /fbcm|wbcm/i.test(f.catalogItemId)) ||
      (f.code && /fbcm|wbcm/i.test(f.code)) ||
      (f.name && /l[-_ ]*shaped.*corner|\bwbcm\b|\bfbcm\b/i.test(f.name))
    );

    if (isLCorner) {
      var isWallL = isWallUnitCategory(f.category, f.name, f.code || f.catalogItemId, f.costCategory) || (f.elevation >= 1000) || (f.unitConfig && f.unitConfig.ctype === 'kwall');
      var defLeg = isWallL ? 600 : 900;
      var defDepth = isWallL ? 300 : 550;
      var cW = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.legW) || (f.dimensions && f.dimensions.W) || defLeg;
      var cD = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.legD) || (f.dimensions && f.dimensions.D && f.dimensions.D >= 500 ? f.dimensions.D : (f.dimensions && f.dimensions.W ? f.dimensions.W : defLeg));
      var cDepth = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.depth) || (f.dimensions && f.dimensions.D && f.dimensions.D < cW ? f.dimensions.D : defDepth);
      var ux = cosA, uy = sinA;
      var vx = -sinA, vy = cosA;
      function toPt(lx, ly) {
        return {
          x: cx + lx * ux + ly * vx,
          y: cy + lx * uy + ly * vy
        };
      }
      return [
        toPt(-cW / 2, -cD / 2),
        toPt(cW / 2, -cD / 2),
        toPt(cW / 2, cD / 2),
        toPt(cW / 2 - cDepth, cD / 2),
        toPt(cW / 2 - cDepth, -cD / 2 + cDepth),
        toPt(-cW / 2, -cD / 2 + cDepth)
      ];
    }

    var w = (f.dimensions && f.dimensions.W) || 1200;
    var d = (f.dimensions && f.dimensions.D) || 600;
    var ux = cosA * (w / 2), uy = sinA * (w / 2);
    var vx = -sinA * (d / 2), vy = cosA * (d / 2);
    return [
      { x: cx - ux - vx, y: cy - uy - vy },
      { x: cx + ux - vx, y: cy + uy - vy },
      { x: cx + ux + vx, y: cy + uy + vy },
      { x: cx - ux + vx, y: cy - uy + vy }
    ];
  }

  // Decomposes concave units (like L-corner cabinets) into convex sub-polygons for exact SAT collision detection
  function getFurnitureSubPolygons(f) {
    var ang = f.rotY || 0;
    var cosA = Math.cos(ang), sinA = Math.sin(ang);
    var cx = (f.pos && f.pos.x) || 0, cy = (f.pos && f.pos.y) || 0;

    var isLCorner = !!(
      (f.unitConfig && (f.unitConfig.geometryType === 'l_shaped_corner' || f.unitConfig.unitType === 'fbcm' || f.unitConfig.unitType === 'wbcm' || (f.unitConfig.corner && f.unitConfig.corner.enabled))) ||
      f.catalogItemId === 'fbcm' || f.id === 'fbcm' || f.id === 'f_fbcm_1' || f.catalogItemId === 'fbcm-1500' || f.catalogItemId === 'wbcm' ||
      (f.id && /fbcm|wbcm/i.test(f.id)) ||
      (f.catalogItemId && /fbcm|wbcm/i.test(f.catalogItemId)) ||
      (f.code && /fbcm|wbcm/i.test(f.code)) ||
      (f.name && /l[-_ ]*shaped.*corner|\bwbcm\b|\bfbcm\b/i.test(f.name))
    );

    if (isLCorner) {
      var isWallL = isWallUnitCategory(f.category, f.name, f.code || f.catalogItemId, f.costCategory) || (f.elevation >= 1000) || (f.unitConfig && f.unitConfig.ctype === 'kwall');
      var defLeg = isWallL ? 600 : 900;
      var defDepth = isWallL ? 300 : 550;
      var cW = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.legW) || (f.dimensions && f.dimensions.W) || defLeg;
      var cD = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.legD) || (f.dimensions && f.dimensions.D && f.dimensions.D >= 500 ? f.dimensions.D : (f.dimensions && f.dimensions.W ? f.dimensions.W : defLeg));
      var cDepth = (f.unitConfig && f.unitConfig.corner && f.unitConfig.corner.depth) || (f.dimensions && f.dimensions.D && f.dimensions.D < cW ? f.dimensions.D : defDepth);
      var ux = cosA, uy = sinA;
      var vx = -sinA, vy = cosA;
      function toPt(lx, ly) {
        return {
          x: cx + lx * ux + ly * vx,
          y: cy + lx * uy + ly * vy
        };
      }
      // Box 1: Arm 1 (width cW, depth cDepth)
      var box1 = [
        toPt(-cW / 2, -cD / 2),
        toPt(cW / 2, -cD / 2),
        toPt(cW / 2, -cD / 2 + cDepth),
        toPt(-cW / 2, -cD / 2 + cDepth)
      ];
      // Box 2: Arm 2 (width cDepth, length cD - cDepth)
      var box2 = [
        toPt(cW / 2 - cDepth, -cD / 2 + cDepth),
        toPt(cW / 2, -cD / 2 + cDepth),
        toPt(cW / 2, cD / 2),
        toPt(cW / 2 - cDepth, cD / 2)
      ];
      return [box1, box2];
    }

    return [getFurniturePolygon(f)];
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
    var isWall1 = isWallUnitCategory(f.category, f.name, f.code || f.catalogItemId, f.costCategory);
    var elev1 = (f.elevation !== undefined && f.elevation !== null && f.elevation !== '') ?
      parseFloat(f.elevation) :
      ((f.pos && f.pos.z !== undefined && f.pos.z !== null && f.pos.z !== 0) ?
        parseFloat(f.pos.z) : (isWall1 ? 1500 : 0));
    var h1 = (f.dimensions && f.dimensions.H) ? parseFloat(f.dimensions.H) : (isWall1 ? 600 : 850);
    var top1 = elev1 + h1;
    var isDecor1 = !!(f.isDecor || f.decorType || f.excludeFromPricing || f.category === 'decor' || f.category === 'appliance_decor' || (f.name && /sink|hob|stove|cooktop|burner|tap|basin|bed|sofa|chair|stool|mirror|tv|plant/i.test(f.name)));
    var isCivilOrLedge1 = (f.category === 'wall_paneling' || f.category === 'structural' || f.category === 'civil' || (f.name && /ledge|rcc|civil|panel|column|pillar|post|structural/i.test(f.name)) || (f.id && /ledge|rcc|civil|column|pillar|post|structural/i.test(f.id)));
    var isBase1 = !isWall1 && (f.category === 'kitchen_base' || (f.name && /base/i.test(f.name)));

    for (var i = 0; i < allFurn.length; i++) {
      var other = allFurn[i];
      if (other.id === f.id || (ignoreId && other.id === ignoreId)) continue;
      var isWall2 = isWallUnitCategory(other.category, other.name, other.code || other.catalogItemId, other.costCategory);
      var isDecor2 = !!(other.isDecor || other.decorType || other.excludeFromPricing || other.category === 'decor' || other.category === 'appliance_decor' || (other.name && /sink|hob|stove|cooktop|burner|tap|basin|bed|sofa|chair|stool|mirror|tv|plant/i.test(other.name)));
      var isCivilOrLedge2 = (other.category === 'wall_paneling' || other.category === 'structural' || other.category === 'civil' || (other.name && /ledge|rcc|civil|panel|column|pillar|post|structural/i.test(other.name)) || (other.id && /ledge|rcc|civil|column|pillar|post|structural/i.test(other.id)));
      var isBase2 = !isWall2 && (other.category === 'kitchen_base' || (other.name && /base/i.test(other.name)));

      // Decor items and civil RCC elements (ledges, countertops, vertical slabs) do not block or get blocked by other units
      if (isDecor1 || isDecor2 || isCivilOrLedge1 || isCivilOrLedge2) continue;

      var elev2 = (other.elevation !== undefined && other.elevation !== null && other.elevation !== '') ?
        parseFloat(other.elevation) :
        ((other.pos && other.pos.z !== undefined && other.pos.z !== null && other.pos.z !== 0) ?
          parseFloat(other.pos.z) : (isWall2 ? 1500 : 0));
      var h2 = (other.dimensions && other.dimensions.H) ? parseFloat(other.dimensions.H) : (isWall2 ? 600 : 850);
      var top2 = elev2 + h2;

      // If vertical elevation ranges do not overlap (e.g. wall cabinet above floor base unit), allow
      if (top1 <= elev2 + 5 || top2 <= elev1 + 5) continue;

      var subPolysF = getFurnitureSubPolygons(f);
      var subPolysO = getFurnitureSubPolygons(other);
      var hasOverlap = false;
      for (var sf = 0; sf < subPolysF.length; sf++) {
        for (var so = 0; so < subPolysO.length; so++) {
          if (polygonsIntersect(subPolysF[sf], subPolysO[so], 5)) {
            hasOverlap = true;
            break;
          }
        }
        if (hasOverlap) break;
      }
      if (hasOverlap) {
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
        activeFloor: 'ground',
        floors: [
          { id: 'ground', name: 'Ground Floor', level: 0, isDefault: true }
        ],
        walls: [],
        openings: [],
        rooms: [],
        furniture: [],
        stairs: []
      },
      rateCard: JSON.parse(JSON.stringify(DEFAULT_RATE_CARD)),
      quotationHistory: []
    };
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Wall Geometry, Splitting & Openings Helpers
     ───────────────────────────────────────────────────────────────────────────── */
  function wallLength(w) {
    if (!w || !w.start || !w.end) return 0;
    return Vec2.dist(w.start, w.end);
  }

  function wallAngle(w) {
    if (!w || !w.start || !w.end) return 0;
    return Vec2.angle(w.start, w.end);
  }

  function wallDirection(w) {
    if (!w || !w.start || !w.end) return { x: 1, y: 0 };
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
    if (!w || !w.start || !w.end || w.isDivider || w.thickness === 0) return [];
    var halfT = (w.thickness || 150) / 2.0;
    var norm = wallNormal(w);
    var p1 = { x: w.start.x + norm.x * halfT, y: w.start.y + norm.y * halfT };
    var p2 = { x: w.end.x + norm.x * halfT, y: w.end.y + norm.y * halfT };
    var p3 = { x: w.end.x - norm.x * halfT, y: w.end.y - norm.y * halfT };
    var p4 = { x: w.start.x - norm.x * halfT, y: w.start.y - norm.y * halfT };
    return [p1, p2, p3, p4];
  }

  // Computes the clear inner length between interior faces of adjoining walls (in mm)
  function getWallInnerLength(w, plan) {
    if (!w || !w.start || !w.end) return 0;
    var totalL = wallLength(w);
    if (!plan || !plan.walls || plan.walls.length <= 1) return totalL;

    var startDeduction = 0;
    var endDeduction = 0;
    var walls = plan.walls;
    var wDir = wallDirection(w);

    for (var i = 0; i < walls.length; i++) {
      var other = walls[i];
      if (!other || !other.start || !other.end || other.id === w.id) continue;
      var oThickness = other.thickness || 150;
      var oHalfT = oThickness / 2.0;

      // Check start connection
      if (Vec2.dist(w.start, other.start) < 60 || Vec2.dist(w.start, other.end) < 60) {
        var oDir = wallDirection(other);
        var dot = Math.abs(wDir.x * oDir.x + wDir.y * oDir.y);
        var sinAngle = Math.sqrt(Math.max(0.1, 1 - dot * dot));
        var dedStart = oHalfT / sinAngle;
        if (dedStart > startDeduction) startDeduction = dedStart;
      }

      // Check end connection
      if (Vec2.dist(w.end, other.start) < 60 || Vec2.dist(w.end, other.end) < 60) {
        var oDir2 = wallDirection(other);
        var dot2 = Math.abs(wDir.x * oDir2.x + wDir.y * oDir2.y);
        var sinAngle2 = Math.sqrt(Math.max(0.1, 1 - dot2 * dot2));
        var dedEnd = oHalfT / sinAngle2;
        if (dedEnd > endDeduction) endDeduction = dedEnd;
      }
    }

    var innerL = Math.max(0, totalL - (startDeduction + endDeduction));
    return innerL;
  }

  // Returns { start, end, innerLength, startDeduction, endDeduction } for witness lines and dimensions
  function getWallInnerSegment(w, plan) {
    if (!w || !w.start || !w.end) return null;
    var totalL = wallLength(w);
    var wDir = wallDirection(w);
    var startDeduction = 0;
    var endDeduction = 0;

    if (plan && plan.walls && plan.walls.length > 1) {
      var walls = plan.walls;
      for (var i = 0; i < walls.length; i++) {
        var other = walls[i];
        if (!other || !other.start || !other.end || other.id === w.id) continue;
        var oThickness = other.thickness || 150;
        var oHalfT = oThickness / 2.0;

        if (Vec2.dist(w.start, other.start) < 60 || Vec2.dist(w.start, other.end) < 60) {
          var oDir = wallDirection(other);
          var dot = Math.abs(wDir.x * oDir.x + wDir.y * oDir.y);
          var sinAngle = Math.sqrt(Math.max(0.1, 1 - dot * dot));
          var ded = oHalfT / sinAngle;
          if (ded > startDeduction) startDeduction = ded;
        }

        if (Vec2.dist(w.end, other.start) < 60 || Vec2.dist(w.end, other.end) < 60) {
          var oDir2 = wallDirection(other);
          var dot2 = Math.abs(wDir.x * oDir2.x + wDir.y * oDir2.y);
          var sinAngle2 = Math.sqrt(Math.max(0.1, 1 - dot2 * dot2));
          var ded2 = oHalfT / sinAngle2;
          if (ded2 > endDeduction) endDeduction = ded2;
        }
      }
    }

    var innerStart = {
      x: w.start.x + wDir.x * startDeduction,
      y: w.start.y + wDir.y * startDeduction
    };
    var innerEnd = {
      x: w.end.x - wDir.x * endDeduction,
      y: w.end.y - wDir.y * endDeduction
    };
    var innerL = Math.max(0, totalL - (startDeduction + endDeduction));

    return {
      start: innerStart,
      end: innerEnd,
      innerLength: innerL,
      startDeduction: startDeduction,
      endDeduction: endDeduction
    };
  }

  // Adjusts wall length so its clear inner length equals targetInnerLen (mm)
  function setWallInnerLength(w, targetInnerLen, plan, anchorEnd) {
    if (!w || !w.start || !w.end || targetInnerLen <= 50) return w;
    var seg = getWallInnerSegment(w, plan);
    var deductions = (seg ? seg.startDeduction + seg.endDeduction : 0);
    var targetCenterlineL = targetInnerLen + deductions;
    var dir = wallDirection(w);

    var oldPt = (anchorEnd === 'end') ? { x: w.start.x, y: w.start.y } : { x: w.end.x, y: w.end.y };
    var newPt;
    if (anchorEnd === 'end') {
      w.start.x = w.end.x - dir.x * targetCenterlineL;
      w.start.y = w.end.y - dir.y * targetCenterlineL;
      newPt = w.start;
    } else {
      w.end.x = w.start.x + dir.x * targetCenterlineL;
      w.end.y = w.start.y + dir.y * targetCenterlineL;
      newPt = w.end;
    }
    // Also move connected adjoining walls that meet at this corner junction (tolerance up to 60mm)
    if (plan && plan.walls) {
      plan.walls.forEach(function (other) {
        if (!other || !other.start || !other.end || other.id === w.id) return;
        if (Vec2.dist(other.start, oldPt) < 60) {
          other.start.x = newPt.x;
          other.start.y = newPt.y;
        } else if (Vec2.dist(other.end, oldPt) < 60) {
          other.end.x = newPt.x;
          other.end.y = newPt.y;
        }
      });
    }
    return w;
  }

  // Comprehensive placement overlap detector against adjacent furniture, wall cores, and openings
  function checkPlacementOverlap(f, plan, ignoreId) {
    if (!f || !plan) return { hasOverlap: false };
    if (f.isDecor || f.excludeFromPricing || f.category === 'decor' || f.category === 'appliance_decor' ||
        f.category === 'wall_paneling' || (f.name && /ledge|rcc|civil/i.test(f.name)) || (f.id && /ledge|rcc|civil/i.test(f.id))) {
      return { hasOverlap: false };
    }
    var fId = ignoreId || f.id;

    // 1. Check collision with other furniture units (OBB + 3D elevation)
    var furnList = plan.furniture || [];
    var furnCol = checkFurnitureCollision(f, furnList, fId);
    var isOtherCivil = furnCol.other && (
      furnCol.other.category === 'structural' || furnCol.other.category === 'civil' ||
      furnCol.other.category === 'wall_paneling' ||
      /ledge|rcc|civil|panel|column|pillar|post|structural/i.test(furnCol.other.name || '') ||
      /ledge|rcc|civil|panel|column|pillar|post|structural/i.test(furnCol.other.id || '')
    );
    if (furnCol.collided && !isOtherCivil) {
      return { hasOverlap: true, type: "furniture", target: furnCol.other };
    }

    // 2. Check collision / penetration into walls
    var walls = plan.walls || [];
    var polyF = getFurniturePolygon(f);
    var isWallU = isWallUnitCategory(f.category, f.name, f.code || f.catalogItemId, f.costCategory);
    var isOS_f = !!((f.unitConfig && f.unitConfig.isOnlyShutter) || (f.name && /\bo\/?s\b/i.test(f.name)) || (f.costCategory && f.costCategory.indexOf('O/S') !== -1));
    var elev1 = (f.elevation !== undefined && f.elevation !== null && f.elevation !== "") ?
      parseFloat(f.elevation) :
      ((f.pos && f.pos.z !== undefined && f.pos.z !== null && f.pos.z !== 0) ?
        parseFloat(f.pos.z) : (isWallU ? 1500 : 0));
    var h1 = (f.dimensions && f.dimensions.H) ? parseFloat(f.dimensions.H) : (isWallU ? 600 : 850);
    var top1 = elev1 + h1;

    for (var i = 0; i < walls.length; i++) {
      var w = walls[i];
      var wallH = w.height || 2800;
      if (top1 <= 0 || elev1 >= wallH) continue;

      var wallPoly = wallPolygon(w);
      // Tolerance = 25mm (or 60mm for only-shutter): touching the wall surface (intentional contact) does NOT collide;
      // When a unit is placed near wall corners/endpoints, increase tolerance so corner placement does not falsely collide with meeting walls!
      var dToEnds = Math.min(
        Math.hypot(f.pos.x - w.start.x, f.pos.y - w.start.y),
        Math.hypot(f.pos.x - w.end.x, f.pos.y - w.end.y)
      );
      var unitW = (f.dimensions && f.dimensions.W) ? f.dimensions.W : 600;
      var tol = isOS_f ? 60 : (dToEnds < Math.max(unitW, 800) ? 140 : 25);
      if (polygonsIntersect(polyF, wallPoly, tol)) {
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

      var isWindow = (op.type === "window");
      var sillH = (op.sillHeight !== undefined && op.sillHeight !== null) ? parseFloat(op.sillHeight) : 900;
      var opElev = op.elevation !== undefined ? parseFloat(op.elevation) : (isWindow ? sillH : 0);
      var opH = op.height || (isWindow ? 1200 : 2100);
      var opTop = opElev + opH;

      // In modular architectural design, kitchen base units and sinks sit directly under windows!
      // Sinks and base units are only blocked if the window is a floor-to-ceiling opening (sill < 400).
      var isSinkOrCounterFixture = !!(f.isDecor || f.decorType === 'sink' || (f.name && /sink|basin|hob|cooktop/i.test(f.name)));
      var isBaseUnit = !isWallU && (
        f.category === 'kitchen_base' || f.category === 'kitchen_fm' || f.category === 'kitchen_corner' ||
        f.category === 'kitchen_drawers' || f.category === 'vanity' ||
        /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(f.code || '') ||
        /(^|\b|_|-)(fm|fcm|fbcm)($|\b|_|-|\d+)/i.test(f.id || '') ||
        (f.name && /base|drawer|sink/i.test(f.name)) ||
        (top1 <= 1050 && elev1 < 300)
      );

      if (isWindow && (isSinkOrCounterFixture || isBaseUnit) && opElev >= 700) {
        // Base units & sinks are allowed under windows with standard sill height
        continue;
      }

      if (top1 <= opElev + 10 || opTop <= elev1 + 10) continue;

      var dir = wallDirection(opWall);
      var norm = wallNormal(opWall);
      var halfT = ((opWall.thickness || 150) / 2.0) + 35;
      var opW = op.width || (isWindow ? 1200 : 900);
      var halfW = opW / 2.0;
      // op.offset is the center of the opening along the wall
      var opCenterT = op.offset !== undefined ? op.offset : halfW;
      var opStart = {
        x: opWall.start.x + dir.x * (opCenterT - halfW),
        y: opWall.start.y + dir.y * (opCenterT - halfW)
      };
      var opEnd = {
        x: opWall.start.x + dir.x * (opCenterT + halfW),
        y: opWall.start.y + dir.y * (opCenterT + halfW)
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

    if (splitOffset < 40 || splitOffset > l - 40) {
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

    // Inherit wall paint color, finish type, and wallpaper
    w1.paintColor = w.paintColor;
    w1.wallpaper = w.wallpaper;
    w1.wallFinishType = w.wallFinishType;
    w2.paintColor = w.paintColor;
    w2.wallpaper = w.wallpaper;
    w2.wallFinishType = w.wallFinishType;

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
          if (proj.dist <= snapTol && distFromEndpoints > 5) {
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

        // Snap free endpoints flush to meeting walls or corners within snapTol (for both walls and dividers)
        if (tA === 0) {
          for (var ja = 0; ja < walls.length; ja++) {
            if (walls[ja].id === w.id) continue;
            var prA = projectPointOnSegment(pA, walls[ja].start, walls[ja].end);
            if (prA.dist <= snapTol) { pA = { x: prA.pt.x, y: prA.pt.y }; break; }
          }
        }
        if (tB === 1) {
          for (var jb = 0; jb < walls.length; jb++) {
            if (walls[jb].id === w.id) continue;
            var prB = projectPointOnSegment(pB, walls[jb].start, walls[jb].end);
            if (prB.dist <= snapTol) { pB = { x: prB.pt.x, y: prB.pt.y }; break; }
          }
        }

        if (Math.hypot(pB.x - pA.x, pB.y - pA.y) > 40) {
          subSegments.push({
            wallId: w.id,
            thickness: w.thickness,
            height: w.height,
            start: pA,
            end: pB,
            isDivider: !!w.isDivider
          });
        }
      }
    }
    return subSegments;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Prune Dangling / Orphan Room Dividers (Unattached Stubs)
     ───────────────────────────────────────────────────────────────────────────── */
  function pruneOrphanDividers(project) {
    if (!project || !project.plan || !project.plan.walls) return 0;
    var snapTol = 250;
    var totalPruned = 0;
    var changed = true;
    var passes = 0;

    while (changed && passes++ < 10) {
      changed = false;
      var walls = project.plan.walls;
      var toRemove = [];

      for (var i = 0; i < walls.length; i++) {
        var w = walls[i];
        if (!w.isDivider) continue;

        var startConnected = false;
        var endConnected = false;

        for (var j = 0; j < walls.length; j++) {
          if (i === j) continue;
          var other = walls[j];

          if (!startConnected) {
            var prS = projectPointOnSegment(w.start, other.start, other.end);
            if (prS.dist <= snapTol && prS.t >= -0.05 && prS.t <= 1.05) startConnected = true;
          }
          if (!endConnected) {
            var prE = projectPointOnSegment(w.end, other.start, other.end);
            if (prE.dist <= snapTol && prE.t >= -0.05 && prE.t <= 1.05) endConnected = true;
          }
          if (startConnected && endConnected) break;
        }

        if (!startConnected || !endConnected) {
          toRemove.push(w.id);
        }
      }

      if (toRemove.length > 0) {
        project.plan.walls = project.plan.walls.filter(function (w) {
          return toRemove.indexOf(w.id) === -1;
        });
        totalPruned += toRemove.length;
        changed = true;
      }
    }
    return totalPruned;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Room Boundary Detection (Planar Face Traversal)
     ───────────────────────────────────────────────────────────────────────────── */
  function detectRooms(project) {
    if (!project || !project.plan) return [];
    var walls = project.plan.walls || [];
    if (walls.length < 3) {
      project.plan.rooms = [];
      return [];
    }

    // Auto-clamp room divider endpoints to nearest walls within 250mm so dividers connect flush to boundary walls
    for (var di = 0; di < walls.length; di++) {
      var dw = walls[di];
      if (!dw || !dw.isDivider || !dw.start || !dw.end) continue;

      var startAlreadyJoined = false;
      var endAlreadyJoined = false;
      for (var k = 0; k < walls.length; k++) {
        if (di === k) continue;
        var kw = walls[k];
        if (!kw || !kw.start || !kw.end) continue;
        if (!startAlreadyJoined) {
          var dS = projectPointOnSegment(dw.start, kw.start, kw.end);
          if (dS.dist <= 15 && dS.t >= -0.05 && dS.t <= 1.05) startAlreadyJoined = true;
        }
        if (!endAlreadyJoined) {
          var dE = projectPointOnSegment(dw.end, kw.start, kw.end);
          if (dE.dist <= 15 && dE.t >= -0.05 && dE.t <= 1.05) endAlreadyJoined = true;
        }
        if (startAlreadyJoined && endAlreadyJoined) break;
      }

      var bestPrS = null, bestDistS = Infinity;
      var bestPrE = null, bestDistE = Infinity;
      for (var dj = 0; dj < walls.length; dj++) {
        if (di === dj) continue;
        var ow = walls[dj];
        if (!ow || !ow.start || !ow.end) continue;
        if (!startAlreadyJoined) {
          var prS = projectPointOnSegment(dw.start, ow.start, ow.end);
          if (prS.dist <= 250 && prS.t >= -0.05 && prS.t <= 1.05 && prS.dist < bestDistS) {
            bestDistS = prS.dist;
            bestPrS = prS;
          }
        }
        if (!endAlreadyJoined) {
          var prE = projectPointOnSegment(dw.end, ow.start, ow.end);
          if (prE.dist <= 250 && prE.t >= -0.05 && prE.t <= 1.05 && prE.dist < bestDistE) {
            bestDistE = prE.dist;
            bestPrE = prE;
          }
        }
      }
      if (bestPrS) {
        dw.start.x = Math.round(bestPrS.pt.x);
        dw.start.y = Math.round(bestPrS.pt.y);
      }
      if (bestPrE) {
        dw.end.x = Math.round(bestPrE.pt.x);
        dw.end.y = Math.round(bestPrE.pt.y);
      }
    }

    // Step 1: Subdivide walls at all cross-junctions and T-junctions
    var snapTol = 200;
    var segments = subdivideWalls(walls, snapTol);
    if (segments.length < 3) {
      project.plan.rooms = [];
      return [];
    }

    // Step 2: Build vertex adjacency map with vertex clustering
    var vertices = [];
    var TOL = Math.max(120, snapTol); // snapping tolerance matching subdivideWalls

    function findOrAddVertex(pt) {
      for (var i = 0; i < vertices.length; i++) {
        if (Vec2.dist(pt, vertices[i].pt) < TOL) {
          return i;
        }
      }
      vertices.push({ id: vertices.length, pt: Vec2.clone(pt), edges: [], removed: false });
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
        removed: false,
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
        removed: false,
        twin: e0
      };
      e0.twin = e1;
      halfEdges.push(e1);

      vertices[vStart].edges.push(e0);
      vertices[vEnd].edges.push(e1);
    }

    // Step 2.5: Iterative dead-end pruning (peel off leaves/antennae/spurs)
    // A vertex with degree < 2 cannot be part of any 2-connected cycle.
    var changed = true;
    var prunePass = 0;
    while (changed && prunePass++ < 50) {
      changed = false;
      for (var vi = 0; vi < vertices.length; vi++) {
        var vtx = vertices[vi];
        if (vtx.removed) continue;
        var activeEdges = [];
        for (var ei = 0; ei < vtx.edges.length; ei++) {
          if (!vtx.edges[ei].removed) activeEdges.push(vtx.edges[ei]);
        }
        if (activeEdges.length < 2) {
          vtx.removed = true;
          for (var ai = 0; ai < activeEdges.length; ai++) {
            var aEdge = activeEdges[ai];
            aEdge.removed = true;
            if (aEdge.twin) aEdge.twin.removed = true;
          }
          changed = true;
        }
      }
    }

    // Step 3: Filter active edges and sort CCW around each vertex
    for (var v = 0; v < vertices.length; v++) {
      if (vertices[v].removed) {
        vertices[v].edges = [];
        continue;
      }
      vertices[v].edges = vertices[v].edges.filter(function (e) { return !e.removed; });
      vertices[v].edges.sort(function (a, b) { return a.angle - b.angle; });
    }

    // Step 4: Find cycles using Left-Face traversal (CCW interior loops)
    var cycles = [];
    for (var e = 0; e < halfEdges.length; e++) {
      var edge = halfEdges[e];
      if (edge.visited || edge.removed) continue;

      var cycle = [];
      var curr = edge;
      var guard = 0;
      var closed = false;

      while (!curr.visited && !curr.removed && guard++ < 300) {
        curr.visited = true;
        cycle.push(curr);

        // At curr.to vertex, take the leftmost turn (the edge right before curr.twin in CCW order)
        var toVert = vertices[curr.to];
        if (!toVert || toVert.removed || toVert.edges.length === 0) break;
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
        var rawPoly = cycle.map(function (ce) { return Vec2.clone(vertices[ce.from].pt); });
        // Clean polygon: remove duplicates, acute turnarounds/spikes, and collinear points
        var poly = Vec2.cleanPolygon(rawPoly);
        if (!poly || poly.length < 3) {
          poly = rawPoly.filter(function (pt) { return pt && isFinite(pt.x) && isFinite(pt.y); });
        }
        if (poly && poly.length >= 3) {
          var area = Vec2.polygonArea(poly);
          // Positive area loops represent interior faces in CCW orientation
          if (area > 500000) { // minimum 0.5 m² to be a valid room
            var wallIds = [];
            for (var k = 0; k < cycle.length; k++) {
              if (wallIds.indexOf(cycle[k].wallId) === -1) wallIds.push(cycle[k].wallId);
            }

            // Guard: A valid architectural room must be bounded by at least one physical wall OR be an enclosed room divider zone (e.g. Pooja room)
            var hasPhysicalWall = false;
            for (var wi = 0; wi < wallIds.length; wi++) {
              for (var aw = 0; aw < walls.length; aw++) {
                if (walls[aw].id === wallIds[wi] && !walls[aw].isDivider) {
                  hasPhysicalWall = true;
                  break;
                }
              }
              if (hasPhysicalWall) break;
            }
            // Allow enclosed divider zones (area >= 200,000 mm² = 0.2 m²) even if 100% dividers (e.g. Pooja Room)
            var isEnclosedDividerZone = (!hasPhysicalWall && cycle.length >= 3 && area >= 200000);
            if (!hasPhysicalWall && !isEnclosedDividerZone) continue;

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
    }

    // Step 5: Update existing room entities or create new ones with smart apartment naming
    var updatedRooms = [];
    var existingRooms = project.plan.rooms || [];
    var usedExisting = {};
    var unassignedCycles = [];

    for (var c = 0; c < cycles.length; c++) {
      var cyc = cycles[c];
      var center = Vec2.polygonCentroid(cyc.polygon);
      var matchedRoom = null;
      var bestScore = Infinity;

      // Match with an existing room by wall overlap or centroid & area similarity
      for (var er = 0; er < existingRooms.length; er++) {
        var exR = existingRooms[er];
        if (!exR || usedExisting[exR.id]) continue;
        if (!exR.polygon || exR.polygon.length < 3) continue;

        var exCenter = Vec2.polygonCentroid(exR.polygon);
        var dist = Vec2.dist(center, exCenter);
        var areaRatio = (exR.areaSqMm && cyc.areaSqMm)
          ? Math.min(cyc.areaSqMm, exR.areaSqMm) / Math.max(cyc.areaSqMm, exR.areaSqMm)
          : 0;

        var wallOverlap = 0;
        if (exR.wallIds && cyc.wallIds) {
          for (var wi = 0; wi < cyc.wallIds.length; wi++) {
            if (exR.wallIds.indexOf(cyc.wallIds[wi]) !== -1) wallOverlap++;
          }
        }
        var wallOverlapRatio = cyc.wallIds ? (wallOverlap / Math.max(1, cyc.wallIds.length)) : 0;

        var isMatch = false;
        if (wallOverlapRatio >= 0.5) {
          isMatch = true;
        } else if (dist < 600 && areaRatio > 0.45) {
          isMatch = true;
        } else if (dist < 300 && areaRatio > 0.3) {
          isMatch = true;
        }

        if (isMatch) {
          var score = dist - (wallOverlapRatio * 500);
          if (score < bestScore) {
            bestScore = score;
            matchedRoom = exR;
          }
        }
      }

      if (matchedRoom) {
        usedExisting[matchedRoom.id] = true;
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

      // If cycle is bounded 100% by dividers, it is an enclosed divider zone: name it Pooja Room!
      var allDividers = (uCyc.wallIds && uCyc.wallIds.length >= 3);
      if (allDividers) {
        for (var dwi = 0; dwi < uCyc.wallIds.length; dwi++) {
          var wItem = walls.find(function (w) { return w.id === uCyc.wallIds[dwi]; });
          if (wItem && !wItem.isDivider) {
            allDividers = false;
            break;
          }
        }
      }
      if (allDividers) {
        roomName = 'Pooja Room';
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
    if (!item) return 'wr_shelves';
    var COST_CAT_MAP = {
      'Kitchen - WM': 'kitchen_wm',
      'Kitchen - FM': 'kitchen_fm',
      'Kitchen - D2/D3': 'kitchen_d2d3',
      'Kitchen O/S': 'kitchen_os',
      'Kitchen o/s': 'kitchen_os',
      'Spice Rack (OPEN BOXES)': 'spice_rack',
      'Wr - Modular - ONLY SHELVES': 'wr_shelves',
      'Wr - Modular - 2 DRAWERS': 'wr_drawers',
      'Wr - Modular - SLIDING': 'wr_sliding',
      'Loft - O/S': 'loft_os',
      'Wardrobe - O/S': 'loft_os',
      'Wardrobe O/S': 'loft_os',
      'Wardrobe o/s': 'loft_os',
      'Wr - O/S': 'loft_os',
      'POOJA WITH CNC': 'pooja_cnc',
      'TV Unit Cabinet': 'tv_cabinet',
      'Wall Paneling': 'wall_paneling'
    };
    if (item.costCategory && COST_CAT_MAP[item.costCategory]) {
      return COST_CAT_MAP[item.costCategory];
    }
    var LEGACY_MODEL_MAP = {
      'tv_unit_cabinet': 'tv_cabinet',
      'pooja_with_cnc': 'pooja_cnc',
      'spice_rack_open_box': 'spice_rack',
      'kitchen_o_s': 'kitchen_os',
      'wardrobe_modular_shelves': 'wr_shelves',
      'wardrobe_modular_drawers': 'wr_drawers',
      'wardrobe_modular_sliding': 'wr_sliding'
    };
    if (item.modelType && LEGACY_MODEL_MAP[item.modelType]) {
      return LEGACY_MODEL_MAP[item.modelType];
    }
    if (item.modelType && MODEL_RATES_MATRIX[item.modelType]) return item.modelType;

    // Check catalog lookup if catalogItemId, code, or id matches a catalog item
    var cId = item.catalogItemId || item.code || item.id;
    if (cId && Array.isArray(FURNITURE_CATALOG)) {
      var found = FURNITURE_CATALOG.find(function(c) { return c.id === cId || c.code === cId; });
      if (found) {
        if (found.costCategory && COST_CAT_MAP[found.costCategory]) {
          return COST_CAT_MAP[found.costCategory];
        }
        if (found.modelType && MODEL_RATES_MATRIX[found.modelType]) {
          return found.modelType;
        }
        if (found.modelType && LEGACY_MODEL_MAP[found.modelType]) {
          return LEGACY_MODEL_MAP[found.modelType];
        }
      }
    }

    var id = (item.id || '').toLowerCase();
    var cat = (item.category || '').toLowerCase();
    var name = (item.name || '').toLowerCase();

    if (id.indexOf('slide') !== -1 || name.indexOf('sliding') !== -1) return 'wr_sliding';
    if (cat === 'wall_paneling' || id.indexOf('pnl-') === 0 || name.indexOf('panel') !== -1 || id.indexOf('ledge') === 0 || name.indexOf('ledge') !== -1) return 'wall_paneling';
    if (id.indexOf('fm-d2') !== -1 || id.indexOf('fm-d3') !== -1 || id.indexOf('kitchen_d2d3') !== -1 || (cat === 'kitchen_base' && (name.indexOf('d2') !== -1 || name.indexOf('d3') !== -1))) return 'kitchen_d2d3';
    if ((name.indexOf('o/s') !== -1 || id.indexOf('o/s') !== -1 || name.indexOf('only shutter') !== -1 || id.indexOf('only-shutter') !== -1 || id === 'kitchen_os') && id.indexOf('loft') === -1 && name.indexOf('loft') === -1) {
      if (cat === 'wardrobe' || id.indexOf('wrb') !== -1 || name.indexOf('wrb') !== -1 || id.indexOf('wr-') === 0 || name.indexOf('wardrobe') !== -1) {
        return 'loft_os';
      }
      return 'kitchen_os';
    }
    if (name.indexOf('open shel') !== -1 || id.indexOf('open-shel') !== -1 || id.indexOf('sr-') === 0 || cat === 'spice_rack' || name.indexOf('spice') !== -1 || id.indexOf('ob-') === 0 || id.indexOf('open-box') !== -1 || id.indexOf('open-storage') !== -1 || name.indexOf('open box') !== -1 || name.indexOf('open storage') !== -1) return 'spice_rack';
    if (name.indexOf('pooja') !== -1 || id.indexOf('pooja') !== -1 || cat === 'pooja' || cat === 'mandir') return 'pooja_cnc';
    if (id.indexOf('ctvb') !== -1 || id.indexOf('ctvw') !== -1 || cat === 'tv_unit' || name.indexOf('tv') !== -1 || name.indexOf('crockery') !== -1 || cat === 'crockery') return 'tv_cabinet';
    if (id.indexOf('loft') !== -1 || name.indexOf('loft') !== -1 || cat === 'loft') return 'loft_os';
    if (id.indexOf('tbm-') === 0 || id.indexOf('fm-') === 0 || id.indexOf('fcm-') === 0 || cat === 'kitchen_base' || cat === 'kitchen_tall' || id === 'k_base' || id === 'k_tall') return 'kitchen_fm';
    if (id.indexOf('wm-') === 0 || id.indexOf('wcm-') === 0 || cat === 'kitchen_wall' || id === 'k_wall') return 'kitchen_wm';
    if ((cat === 'wardrobe' || id.indexOf('wr-') === 0) && (name.indexOf('drawer') !== -1 || id.indexOf('drawers') !== -1 || id === 'w3d' || id === 'w4d')) return 'wr_drawers';
    if (cat === 'wardrobe' || id.indexOf('wr-') === 0 || id === 'w2d' || cat === 'vanity' || cat === 'shoe_rack') return 'wr_shelves';
    return 'wr_shelves';
  }

  function calculateItemCost(item, rateCard, roomTier) {
    if (!item) return { totalCost: 0, baseAmount: 0, subtotal: 0, gstAmount: 0, frontAreaSft: 0, areaSft: 0, baseRate: 0, totalAmount: 0, dimensions: { W: 0, H: 0, D: 0 } };
    if (item.isDecor || item.excludeFromPricing || item.category === 'decor' || item.category === 'appliance_decor') {
      var dDims = item.dimensions || { W: 0, H: 0, D: 0 };
      return {
        id: item.id || '',
        itemId: item.id || '',
        item: item,
        name: item.name || 'Decor Item',
        itemName: item.name || 'Decor Item',
        dimensions: dDims,
        category: item.category || 'decor',
        categoryName: 'Decor / Styling',
        modelType: item.decorType || 'decor',
        modelLabel: 'Decor (Excluded)',
        areaSft: 0,
        frontAreaSft: 0,
        runningFt: 0,
        baseRate: 0,
        baseAmount: 0,
        totalAmount: 0,
        extraDepthCharge: 0,
        matCharge: 0,
        shutterMultiplier: 1,
        carcassMultiplier: 1,
        carcassFinishMultiplier: 1,
        handleCost: 0,
        hardwareCost: 0,
        drawerCost: 0,
        accessoriesCost: 0,
        subtotal: 0,
        gstRate: 0,
        gstAmount: 0,
        totalCost: 0,
        formulaDescription: 'Decor / Styling (Excluded from Woodwork BOQ — ₹0.00)',
        materials: item.materials || {
          shutter: { material: 'None', finish: 'None' },
          carcass: { material: 'None', finish: 'None' }
        },
        isDecor: true,
        excludeFromPricing: true
      };
    }
    rateCard = rateCard || DEFAULT_RATE_CARD;
    var catKey = item.category || 'wardrobe';
    var catConfig = rateCard.categories[catKey] || rateCard.categories.wardrobe;
    var dims = item.dimensions || { W: 1200, H: 2100, D: 600 };

    var isLedge = (
      catKey === 'ledges' ||
      item.category === 'ledges' ||
      /ledge|shelf/i.test(item.name || '') ||
      /ledge|shelf/i.test(item.id || '') ||
      /ledge|shelf/i.test(item.catalogItemId || '') ||
      /ledge|shelf/i.test(item.code || '')
    );
    var isLedgeFace = isLedge && (dims.H <= 50 || /ledge-std|ledge-ctop/i.test(item.id || '') || (item.name && item.name.indexOf('VERTICAL') === -1));
    var isBaseFloorUnit = (catKey === 'base' || catKey === 'kitchen' || catKey === 'floor' || catKey === 'kitchen_base' || /base|floor|sink|hob|kbase/i.test(catKey) || /base|floor|sink|hob|kbase|bu\d+/i.test(item.name || '') || /base|floor|sink|hob|kbase|bu\d+/i.test(item.code || '') || /base|floor|sink|hob|kbase|bu\d+/i.test(item.id || '')) && !(/wall|overhead|loft/i.test(catKey) || /wall|overhead|loft/i.test(item.name || ''));
    var pricingH = dims.H;
    if (isBaseFloorUnit) {
      // Pricing calculates strictly on the carcass box height (700mm), excluding 100mm legs and 20mm countertop stone
      pricingH = (dims.H >= 800) ? Math.max(100, dims.H - 120) : (dims.H || 700);
      if (pricingH < 100) pricingH = 700;
    }
    var frontAreaSft = isLedgeFace ? ((dims.W * dims.D) / SFT_FACTOR) : ((dims.W * pricingH) / SFT_FACTOR);
    var runningFt = (dims.W / 304.8);

    var modelType = resolveModelType(item);
    var modelDef = (rateCard.modelRates && rateCard.modelRates[modelType]) || MODEL_RATES_MATRIX[modelType];
    var activeTier = item.tierOverride || roomTier || (rateCard.roomTiers && item.roomId && rateCard.roomTiers[item.roomId]) || rateCard.selectedTier || null;

    var baseRate = null;
    if (activeTier && modelDef && modelDef.rates) {
      baseRate = modelDef.rates[activeTier] ||
                 modelDef.rates[normalizeTierName(activeTier)] ||
                 modelDef.rates[String(activeTier).toUpperCase()] ||
                 modelDef.rates[String(activeTier).toLowerCase()];
    } else if (item.pricingOverrides && item.pricingOverrides.baseRate) {
      baseRate = item.pricingOverrides.baseRate;
    }
    if (!baseRate) {
      baseRate = catConfig.baseRatePerSft || catConfig.baseRatePerRft || 1700;
    }

    var baseAmount = 0;
    var formulaDescription = '';
    var tierBadge = activeTier ? (' [' + activeTier + ' · ' + (modelDef ? modelDef.label : modelType) + ']') : '';

    var fixedCfg = item.fixedPanel || (item.unitConfig && item.unitConfig.fixedPanel);
    var openCfg = item.openShutter || (item.unitConfig && item.unitConfig.openShutter);
    var hasSplitShutter = !!(fixedCfg && fixedCfg.enabled);
    var cornerCfg = item.unitConfig && item.unitConfig.corner;
    var isLShapeUnit = !!(cornerCfg && cornerCfg.enabled);
    var dimPrefix = '';
    if (hasSplitShutter) {
      var fixW = parseFloat(fixedCfg.width) || Math.round(dims.W / 2);
      var openW = (openCfg && parseFloat(openCfg.width)) || Math.max(0, dims.W - fixW);
      dimPrefix = fixW + 'mm Fixed + ' + openW + 'mm Open = ';
    } else if (isLShapeUnit) {
      var legW = parseFloat(cornerCfg.legW) || dims.W || 600;
      var legD = parseFloat(cornerCfg.legD) || dims.W || 600;
      var cDepth = parseFloat(cornerCfg.depth) || dims.D || 300;
      dimPrefix = 'L-Shape (' + Math.max(0, legW - cDepth) + 'mm + ' + Math.max(0, legD - cDepth) + 'mm Shutters, ' + cDepth + 'mm D): ';
    }

    var dimFormula = isLedgeFace ?
      (dims.W + ' mm (L) × ' + dims.D + ' mm (D) ÷ 92903.04') :
      (dims.W + ' mm × ' + Math.round(pricingH) + ' mm ÷ 92903.04');

    if (activeTier && modelDef && modelDef.pricingModel === 'front_area') {
      baseAmount = frontAreaSft * baseRate;
      formulaDescription = dimPrefix + dimFormula + ' = ' + frontAreaSft.toFixed(2) + ' SFT @ ' + rateCard.currencySymbol + baseRate + '/SFT' + tierBadge;
    } else if (catConfig.pricingModel === 'front_area') {
      baseAmount = frontAreaSft * baseRate;
      formulaDescription = dimPrefix + dimFormula + ' = ' + frontAreaSft.toFixed(2) + ' SFT @ ' + rateCard.currencySymbol + baseRate + '/SFT' + tierBadge;
    } else if (catConfig.pricingModel === 'running_ft') {
      baseAmount = runningFt * (catConfig.baseRatePerRft || baseRate);
      formulaDescription = dimPrefix + dims.W + ' mm ÷ 304.8 = ' + runningFt.toFixed(2) + ' Rft @ ' + rateCard.currencySymbol + (catConfig.baseRatePerRft || baseRate) + '/Rft' + tierBadge;
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

    // Laminates and finish colors do not affect unit pricing (all laminate selections standard rate)
    var matCharge = 0;

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

  function generateFullQuotation(project, selectedRoomIds, selectedFloorId) {
    project = project || {};
    var rateCard = project.rateCard || DEFAULT_RATE_CARD;
    var plan = project;
    while (plan && plan.plan && (plan.plan.walls || plan.plan.furniture || plan.plan.rooms || plan.plan.plan)) {
      plan = plan.plan;
    }
    plan = plan || {};

    // ── Multi-Floor Resolution & Synchronization ──
    var floors = (plan.floors && plan.floors.length > 0)
      ? plan.floors
      : [{ id: 'ground', name: 'Ground Floor', level: 0, elevation: 0, isDefault: true }];
    var activeFloorId = plan.activeFloorId || plan.activeFloor || 'ground';
    plan.floorsData = plan.floorsData || {};

    var rootFurn = plan.furniture || plan.furnitureUnits || [];
    // Keep active floor synchronized in floorsData
    if (!plan.floorsData[activeFloorId] || (rootFurn.length > (plan.floorsData[activeFloorId].furniture || plan.floorsData[activeFloorId].furnitureUnits || []).length)) {
      plan.floorsData[activeFloorId] = plan.floorsData[activeFloorId] || {};
      plan.floorsData[activeFloorId].furniture = rootFurn;
      plan.floorsData[activeFloorId].rooms = plan.rooms || [];
      plan.floorsData[activeFloorId].walls = plan.walls || [];
    }

    // Collect all modular furniture and rooms across all floors
    var allFurniture = [];
    var allRooms = [];
    var floorMap = {};
    floors.forEach(function (fl) {
      floorMap[fl.id] = fl;
      var fData = (fl.id === activeFloorId && rootFurn.length)
        ? plan
        : (plan.floorsData[fl.id] || { furniture: [], rooms: [] });
      var fFurn = fData.furniture || fData.furnitureUnits || [];
      var fRooms = fData.rooms || [];

      fFurn.forEach(function (fu) {
        var itemCopy = JSON.parse(JSON.stringify(fu));
        itemCopy.floorId = fl.id;
        itemCopy.floorName = fl.name || fl.id;
        itemCopy.floorLevel = fl.level !== undefined ? fl.level : 0;
        allFurniture.push(itemCopy);
      });

      fRooms.forEach(function (rm) {
        var rmCopy = JSON.parse(JSON.stringify(rm));
        rmCopy.floorId = fl.id;
        rmCopy.floorName = fl.name || fl.id;
        allRooms.push(rmCopy);
      });
    });

    if (allFurniture.length === 0 && rootFurn.length) {
      rootFurn.forEach(function (fu) {
        var itemCopy = JSON.parse(JSON.stringify(fu));
        itemCopy.floorId = activeFloorId;
        itemCopy.floorName = (floorMap[activeFloorId] && floorMap[activeFloorId].name) || 'Ground Floor';
        itemCopy.floorLevel = (floorMap[activeFloorId] && floorMap[activeFloorId].level) || 0;
        allFurniture.push(itemCopy);
      });
      allRooms = plan.rooms || [];
    }

    var furniture = allFurniture;
    var rooms = allRooms;

    var roomMap = {};
    for (var r = 0; r < rooms.length; r++) {
      roomMap[rooms[r].id] = rooms[r];
    }

    // Associate furniture items with their enclosing room on the SAME floor
    for (var fIdx = 0; fIdx < furniture.length; fIdx++) {
      var fu = furniture[fIdx];
      if (fu.pos) {
        var matchingRooms = [];
        for (var rmIdx = 0; rmIdx < rooms.length; rmIdx++) {
          var candRm = rooms[rmIdx];
          if (candRm.floorId === fu.floorId && candRm.polygon && Vec2.pointInPolygon(fu.pos, candRm.polygon)) {
            matchingRooms.push(candRm);
          }
        }
        if (matchingRooms.length > 0) {
          // Sort ascending by area so inner/divided room (e.g. Pooja room) takes priority
          matchingRooms.sort(function (a, b) { return (a.areaSqMm || 0) - (b.areaSqMm || 0); });
          fu.roomId = matchingRooms[0].id;
          fu.roomName = matchingRooms[0].name;
        } else if (!fu.roomId || !roomMap[fu.roomId]) {
          fu.roomId = '_general';
          fu.roomName = 'General';
        }
      }
    }

    // Normalize floor and room filters
    var isFloorFiltered = (selectedFloorId && selectedFloorId !== 'all');
    var targetFloorId = isFloorFiltered ? selectedFloorId : null;

    var isFiltered = false;
    var filterMap = {};
    if (selectedRoomIds && Array.isArray(selectedRoomIds) && selectedRoomIds.length > 0 && selectedRoomIds.indexOf('all') === -1) {
      isFiltered = true;
      for (var s = 0; s < selectedRoomIds.length; s++) {
        filterMap[selectedRoomIds[s]] = true;
      }
    }

    // Initialize floor breakdown metrics map
    var floorSummaries = {};
    floors.forEach(function (fl) {
      floorSummaries[fl.id] = {
        id: fl.id,
        name: fl.name || fl.id,
        level: fl.level !== undefined ? fl.level : 0,
        itemCount: 0,
        woodworkSubtotal: 0,
        percentShare: 0
      };
    });

    // Initialize room breakdown metrics map for all detected rooms
    var roomSummaries = {};
    for (var rj = 0; rj < rooms.length; rj++) {
      var rObj = rooms[rj];
      var rmTier = (rateCard.roomTiers && rateCard.roomTiers[rObj.id]) || rObj.variant || rateCard.selectedTier || 'zappo - el pearl';
      roomSummaries[rObj.id] = {
        id: rObj.id,
        name: rObj.name || ('Room ' + (rj + 1)),
        floorId: rObj.floorId || activeFloorId,
        floorName: rObj.floorName || 'Ground Floor',
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
      floorId: activeFloorId,
      floorName: 'Ground Floor',
      variant: (rateCard.roomTiers && rateCard.roomTiers['_general']) || rateCard.selectedTier || 'zappo - el pearl',
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

    // 1. Modular Furniture & Cabinetry Line Items (strictly exclude all Decor items & their values from Pricing & Quotation)
    for (var i = 0; i < furniture.length; i++) {
      var f = furniture[i];
      if (!f) continue;
      var fCat = String(f.category || '').toLowerCase();
      var fCatId = String(f.catalogId || f.code || '').toLowerCase();
      if (
        f.isDecor ||
        f.excludeFromPricing ||
        f.decorType ||
        fCat === 'decor' ||
        fCat === 'appliance_decor' ||
        fCat === 'styling' ||
        fCatId.indexOf('dec_') === 0 ||
        fCatId.indexOf('decor_') === 0
      ) {
        continue;
      }
      var fRoomId = f.roomId || '_general';
      var rTier = (rateCard.roomTiers && rateCard.roomTiers[fRoomId]) || (roomMap[fRoomId] && roomMap[fRoomId].variant) || null;
      var cost = calculateItemCost(f, rateCard, rTier);
      if (!cost || cost.isDecor) continue;
      cost.roomId = fRoomId;
      cost.roomName = (f.roomId && roomMap[f.roomId]) ? roomMap[f.roomId].name : 'General';
      cost.floorId = f.floorId || activeFloorId;
      cost.floorName = f.floorName || (floorMap[cost.floorId] && floorMap[cost.floorId].name) || 'Ground Floor';
      cost.floorLevel = f.floorLevel !== undefined ? f.floorLevel : ((floorMap[cost.floorId] && floorMap[cost.floorId].level) || 0);

      allItemsTotalWoodwork += cost.totalAmount;

      // Update floor metrics
      if (!floorSummaries[cost.floorId]) {
        floorSummaries[cost.floorId] = {
          id: cost.floorId,
          name: cost.floorName,
          level: cost.floorLevel,
          itemCount: 0,
          woodworkSubtotal: 0,
          percentShare: 0
        };
      }
      floorSummaries[cost.floorId].itemCount++;
      floorSummaries[cost.floorId].woodworkSubtotal += cost.totalAmount;

      var bId = roomMap[cost.roomId] ? cost.roomId : '_general';
      if (roomSummaries[bId]) {
        roomSummaries[bId].itemCount++;
        roomSummaries[bId].woodworkSubtotal += cost.totalAmount;
        roomSummaries[bId].roomSubtotal += cost.totalAmount;
      }

      var matchesFloor = !isFloorFiltered || (cost.floorId === targetFloorId);
      var matchesRoom = !isFiltered || filterMap[cost.roomId] || filterMap[cost.roomName];
      if (matchesFloor && matchesRoom) {
        lineItems.push(cost);
        subtotal += cost.totalAmount;
        categoryTotals[cost.category] = (categoryTotals[cost.category] || 0) + cost.totalAmount;
        roomTotals[cost.roomName] = (roomTotals[cost.roomName] || 0) + cost.totalAmount;
      }
    }

    // 2. Civil / Architectural Line Items (Excluded from Quotation Total - zero impact on pricing)
    var civilLineItems = [];
    for (var rm = 0; rm < rooms.length; rm++) {
      var room = rooms[rm];
      if (room.areaSqFt > 0) {
        var civilFloorMatch = !isFloorFiltered || (room.floorId === targetFloorId);
        var civilMatches = civilFloorMatch && (!isFiltered || filterMap[room.id] || filterMap[room.name]);

        // Flooring (Recorded for architectural information only, zero pricing addition)
        if (room.includeFlooring && rateCard.categories.flooring && rateCard.categories.flooring.baseRatePerSft) {
          var floorCost = room.areaSqFt * rateCard.categories.flooring.baseRatePerSft;
          if (civilMatches) {
            civilLineItems.push({
              name: 'Flooring: ' + room.name,
              category: 'flooring',
              roomName: room.name,
              roomId: room.id,
              floorId: room.floorId || activeFloorId,
              floorName: room.floorName || 'Ground Floor',
              areaSft: room.areaSqFt,
              baseRate: rateCard.categories.flooring.baseRatePerSft,
              totalAmount: 0, // Zero price impact
              formulaDescription: room.areaSqFt.toFixed(1) + ' SFT (Civil Work Excluded From Woodwork Quote)'
            });
          }
        }

        // False Ceiling (Recorded for architectural information only, zero pricing addition)
        if (room.falseCeiling && rateCard.categories.false_ceiling) {
          var fcCost = room.areaSqFt * rateCard.categories.false_ceiling.baseRatePerSft;
          if (civilMatches) {
            civilLineItems.push({
              name: 'False Ceiling: ' + room.name,
              category: 'false_ceiling',
              roomName: room.name,
              roomId: room.id,
              floorId: room.floorId || activeFloorId,
              floorName: room.floorName || 'Ground Floor',
              areaSft: room.areaSqFt,
              baseRate: rateCard.categories.false_ceiling.baseRatePerSft,
              totalAmount: 0, // Zero price impact
              formulaDescription: room.areaSqFt.toFixed(1) + ' SFT (Civil Work Excluded From Woodwork Quote)'
            });
          }
        }
      }
    }

    // Compute Floor Summaries array & % Share of Total Project Woodwork
    var allFloorsSummary = [];
    var totalWoodworkAllFloors = 0;
    for (var fKey in floorSummaries) {
      totalWoodworkAllFloors += floorSummaries[fKey].woodworkSubtotal;
    }
    if (totalWoodworkAllFloors <= 0) totalWoodworkAllFloors = 1;

    for (var fKey in floorSummaries) {
      var flItem = floorSummaries[fKey];
      flItem.percentShare = Math.round((flItem.woodworkSubtotal / totalWoodworkAllFloors) * 100);
      allFloorsSummary.push(flItem);
    }
    allFloorsSummary.sort(function (a, b) { return a.level - b.level; });

    // 3. Labor, Installation & Transport (Zero impact on total)
    var totalWoodworkSft = 0;
    for (var w = 0; w < lineItems.length; w++) {
      totalWoodworkSft += (lineItems[w].areaSft || 0);
    }

    var installCharge = 0;
    var transportCharge = 0;
    var laborTotal = 0;

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
      selectedFloorId: selectedFloorId || 'all',
      isFiltered: isFiltered,
      isFloorFiltered: isFloorFiltered,
      allFloorsSummary: allFloorsSummary,
      floorSummaries: allFloorsSummary,
      floorTotals: floorSummaries,
      allRoomsSummary: allRoomsSummary,
      furnitureItems: lineItems,
      items: lineItems,
      civilItems: civilLineItems,
      categoryTotals: categoryTotals,
      roomTotals: roomTotals,
      subtotalWoodwork: subtotal,
      subtotal: subtotal,
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
    if (!project) return '{}';
    project.meta = project.meta || {};
    project.meta.dateModified = new Date().toISOString();
    return JSON.stringify(project, null, 2);
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Heal & Merge Collinear Walls (reunites straight wall segments that share orientation)
     ───────────────────────────────────────────────────────────────────────────── */
  function healCollinearWalls(project) {
    if (!project || !project.plan || !project.plan.walls || project.plan.walls.length < 2) return false;
    var walls = project.plan.walls;
    var furnList = project.plan.furniture || [];
    var changed = false;
    for (var pass = 0; pass < 6; pass++) {
      var didMerge = false;
      for (var i = 0; i < walls.length && !didMerge; i++) {
        var w1 = walls[i];
        if (!w1 || w1.isDivider) continue;
        var dir1 = wallDirection(w1);
        for (var j = 0; j < walls.length && !didMerge; j++) {
          if (i === j) continue;
          var w2 = walls[j];
          if (!w2 || w2.isDivider) continue;
          if (w1.thickness !== w2.thickness || w1.height !== w2.height) continue;
          if (w1.paintColor !== w2.paintColor || w1.wallpaper !== w2.wallpaper) continue;

          // Check if w1.end connects to w2.start
          var distEndStart = Math.hypot(w1.end.x - w2.start.x, w1.end.y - w2.start.y);
          if (distEndStart < 15) {
            var dir2 = wallDirection(w2);
            var dot = dir1.x * dir2.x + dir1.y * dir2.y;
            if (dot > 0.99) { // Collinear straight line
              // Do not merge if there is an intentional structural RCC column at the joint
              var hasRccPillar = furnList.some(function (f) {
                if (!f || !f.pos) return false;
                var isRcc = (f.category === 'structural' || f.category === 'civil' ||
                  /rcc|column|pillar|post/i.test(f.name || '') ||
                  /rcc|column|pillar|post/i.test(f.id || ''));
                return isRcc && Math.hypot(f.pos.x - w1.end.x, f.pos.y - w1.end.y) < 120;
              });
              if (!hasRccPillar) {
                var w1Len = wallLength(w1);
                w1.end.x = w2.end.x;
                w1.end.y = w2.end.y;
                if (project.plan.openings) {
                  project.plan.openings.forEach(function (op) {
                    if (op.wallId === w2.id) {
                      op.wallId = w1.id;
                      op.offset = (op.offset || 0) + w1Len;
                    }
                  });
                }
                walls.splice(j, 1);
                didMerge = true;
                changed = true;
              }
            }
          }
        }
      }
      if (!didMerge) break;
    }
    return changed;
  }

  function deserializeProject(jsonStr) {
    var data = typeof jsonStr === 'string' ? JSON.parse(jsonStr) : jsonStr;
    if (!data.schemaVersion) {
      data.schemaVersion = '1.0.0';
    }
    if (!data.plan) data.plan = { walls: [], openings: [], rooms: [], furniture: [], stairs: [] };
    if (!data.plan.stairs) data.plan.stairs = [];
    if (!data.plan.floors || !Array.isArray(data.plan.floors) || data.plan.floors.length === 0) {
      data.plan.floors = [
        { id: 'ground', name: 'Ground Floor', level: 0, elevation: 0, isDefault: true }
      ];
    }
    if (!data.plan.activeFloor) {
      data.plan.activeFloor = data.plan.floors[0].id || 'ground';
    }
    if (!data.plan.floorsData) {
      data.plan.floorsData = {};
    }
    if (!data.rateCard) data.rateCard = JSON.parse(JSON.stringify(DEFAULT_RATE_CARD));
    if (!data.commercialCharges) data.commercialCharges = {};
    // Ensure all furniture items have guaranteed unique instance IDs & auto-migrate floor unit heights
    function migrateFloorUnit(fn) {
      if (!fn) return;
      var catL = String(fn.category || '').toLowerCase();
      var isFloorU = (catL === 'kitchen_base' || catL === 'kitchen_fm' || catL === 'kitchen_corner' || catL === 'kitchen_drawers' || catL === 'crockery' || catL === 'base' || catL === 'floor' || (fn.name && /base/i.test(fn.name)) || (fn.id && /^(fm|fcm|fbcm|ctvb)/i.test(fn.id))) && !(/wall|overhead|loft/i.test(catL) || /wall|overhead|loft/i.test(fn.name || ''));
      if (isFloorU && fn.dimensions) {
        if (fn.dimensions.H === 750 || fn.dimensions.H === 720 || fn.dimensions.H === 850 || fn.dimensions.H === 860) {
          fn.dimensions.H = 700;
        }
      }
    }

    if (data.plan && Array.isArray(data.plan.furniture)) {
      var seenFurnIds = {};
      for (var fi = 0; fi < data.plan.furniture.length; fi++) {
        var fn = data.plan.furniture[fi];
        if (!fn) continue;
        if (!fn.id || seenFurnIds[fn.id]) {
          if (!fn.catalogItemId) fn.catalogItemId = fn.id || fn.code;
          fn.id = uid('furn');
        }
        seenFurnIds[fn.id] = true;
        migrateFloorUnit(fn);
      }
    }

    if (data.plan && data.plan.floorsData && typeof data.plan.floorsData === 'object') {
      for (var fk in data.plan.floorsData) {
        var fd = data.plan.floorsData[fk];
        if (fd && Array.isArray(fd.furniture)) {
          for (var fdi = 0; fdi < fd.furniture.length; fdi++) {
            migrateFloorUnit(fd.furniture[fdi]);
          }
        }
      }
    }
    try {
      healCollinearWalls(data);
    } catch (e) {
      console.warn('healCollinearWalls error:', e);
    }
    return data;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     Standard Modular Furniture Catalog
     ───────────────────────────────────────────────────────────────────────────── */
  var FURNITURE_CATALOG = [
  {
    "id": "ctvb-60",
    "code": "ctvb-60",
    "name": "CROCKERY/TV BASE 600",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 4.84376,
    "icon": "📺",
    "dimensions": {
      "W": 600,
      "H": 700,
      "D": 450
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "plinthH": 100
    },
    "pricingOverrides": {
      "baseRate": 4666.0
    },
    "customRate": 4666.0,
    "elevation": 0
  },
  {
    "id": "ctvb-1d",
    "code": "ctvb-1d",
    "name": "CROCKERY/TV BASE 1DOOR",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 3.63,
    "icon": "📺",
    "dimensions": {
      "W": 450,
      "H": 700,
      "D": 450
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "plinthH": 100
    },
    "pricingOverrides": {
      "baseRate": 3500
    },
    "customRate": 3500,
    "elevation": 0
  },
  {
    "id": "ctvb-1d-1dr",
    "code": "ctvb-1d-1dr",
    "name": "CROCKERY/TV BASE 1DOOR 1 DRAWER",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 3.63,
    "icon": "📺",
    "dimensions": {
      "W": 450,
      "H": 700,
      "D": 450
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 1,
      "drawersOnTop": true,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "plinthH": 100
    },
    "pricingOverrides": {
      "baseRate": 4800
    },
    "customRate": 4800,
    "elevation": 0
  },
  {
    "id": "ctvb-1dr",
    "code": "ctvb-1dr",
    "name": "CROCKERY/TV BASE 1 DRAWER",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 0.96875,
    "icon": "📺",
    "dimensions": {
      "W": 450,
      "H": 200,
      "D": 450
    },
    "elevation": 350,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 1,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": false,
      "mountType": "floating",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "legs": 100,
      "plinthH": 100
    },
    "pricingOverrides": {
      "baseRate": 2562.67
    },
    "customRate": 2562.67
  },
  {
    "id": "ctvb-2d",
    "code": "ctvb-2d",
    "name": "CROCKERY /TV BASE 2 DOOR",
    "modelType": "pooja_with_cnc",
    "category": "crockery",
    "costCategory": "POOJA WITH CNC",
    "areaSqft": 6.054702216,
    "icon": "🛕",
    "dimensions": {
      "W": 750,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "plinthH": 100
    },
    "pricingOverrides": {
      "baseRate": 11921.71
    },
    "customRate": 11921.71,
    "elevation": 0
  },
  {
    "id": "ctvb-2d-2dr",
    "code": "ctvb-2d-2dr",
    "name": "CROCKERY/TV BASE 2 DOOR 2 DRAWER",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 7.26564266,
    "icon": "📺",
    "dimensions": {
      "W": 900,
      "H": 700,
      "D": 450
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 2,
      "drawersOnTop": true,
      "drawersSideBySide": true,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "plinthH": 100
    },
    "pricingOverrides": {
      "baseRate": 14415.04
    },
    "customRate": 14415.04,
    "elevation": 0
  },
  {
    "id": "ctvb-2dr",
    "code": "ctvb-2dr",
    "name": "CROCKERY/TV BASE 2 DRAWER",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 2.421880887,
    "icon": "📺",
    "dimensions": {
      "W": 450,
      "H": 500,
      "D": 450
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 2,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "plinthH": 100
    },
    "pricingOverrides": {
      "baseRate": 4805.01
    },
    "customRate": 4805.01,
    "elevation": 0
  },
  {
    "id": "ctvw-2d",
    "code": "ctvw-2d",
    "name": "CROCKERY/TV WALL 2 DOOR",
    "modelType": "pooja_with_cnc",
    "category": "crockery",
    "costCategory": "POOJA WITH CNC",
    "areaSqft": 5.812514128,
    "icon": "🛕",
    "dimensions": {
      "W": 900,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 11444.84
    },
    "customRate": 11444.84,
    "elevation": 1500
  },
  {
    "id": "ctvw-wm-gl-75",
    "code": "WM-GL-75",
    "name": "CROCKERY/TV WM-GL-75",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 4.84376,
    "icon": "🎛️",
    "dimensions": {
      "W": 750,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "glass",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "mountType": "wall",
      "ctype": "kwall",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7483.61
    },
    "customRate": 7483.61,
    "elevation": 1500
  },
  {
    "id": "wm-gl-75",
    "code": "wm-gl-75",
    "name": "CROCKERY/TV WM-GL-75",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 4.84376,
    "icon": "🎛️",
    "dimensions": {
      "W": 750,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "glass",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "mountType": "wall",
      "ctype": "kwall",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7483.61
    },
    "customRate": 7483.61,
    "elevation": 1500
  },
  {
    "id": "ctvw-wm-gl-45",
    "code": "WM-GL-45",
    "name": "CROCKERY/TV WM-GL-45",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 2.90626,
    "icon": "🎛️",
    "dimensions": {
      "W": 450,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "glass",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "mountType": "wall",
      "ctype": "kwall",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 4490.17
    },
    "customRate": 4490.17,
    "elevation": 1500
  },
  {
    "id": "wm-gl-45",
    "code": "wm-gl-45",
    "name": "CROCKERY/TV WM-GL-45",
    "modelType": "tv_unit_cabinet",
    "category": "crockery",
    "costCategory": "TV Unit Cabinet",
    "areaSqft": 2.90626,
    "icon": "🎛️",
    "dimensions": {
      "W": 450,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "glass",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "mountType": "wall",
      "ctype": "kwall",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 4490.17
    },
    "customRate": 4490.17,
    "elevation": 1500
  },
  {
    "id": "ctvw-obs-02",
    "code": "ctvw-obs-02",
    "name": "CROCKERY/TV WALL OPEN BOX STORAGE 2",
    "modelType": "spice_rack",
    "category": "crockery",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 2.9,
    "icon": "🧂",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 1,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 3200
    },
    "customRate": 3200,
    "elevation": 1500
  },
  {
    "id": "fcm-rt",
    "code": "FCM-RT",
    "name": "FCM-RT (Cookscape)",
    "modelType": "kitchen_fm",
    "category": "kitchen_corner",
    "costCategory": "Kitchen - FM",
    "areaSqft": 8.5,
    "icon": "🍳",
    "dimensions": {
      "W": 1050,
      "H": 700,
      "D": 550
    },
    "elevation": 0,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "ctype": "kbase",
      "unitType": "fcm-rt",
      "fixedPanel": {
        "enabled": true,
        "width": 600,
        "type": "fixed"
      },
      "openShutter": {
        "enabled": true,
        "width": 450,
        "type": "shutter",
        "count": 1,
        "opening": "right"
      },
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 2,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "pull",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 17398.79
    },
    "customRate": 17398.79
  },
  {
    "id": "fcm-lt",
    "code": "FCM-LT",
    "name": "FCM-LT (Cookscape)",
    "modelType": "kitchen_fm",
    "category": "kitchen_corner",
    "costCategory": "Kitchen - FM",
    "areaSqft": 8.5,
    "icon": "🍳",
    "dimensions": {
      "W": 1050,
      "H": 700,
      "D": 550
    },
    "elevation": 0,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "ctype": "kbase",
      "unitType": "fcm-lt",
      "fixedPanel": {
        "enabled": true,
        "width": 600,
        "type": "fixed"
      },
      "openShutter": {
        "enabled": true,
        "width": 450,
        "type": "shutter",
        "count": 1,
        "opening": "left"
      },
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 2,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "pull",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 17398.79
    },
    "customRate": 17398.79
  },
  {
    "id": "wfm60-roll",
    "code": "WFM60-ROLL",
    "name": "Rolling shutter wfm60",
    "modelType": "kitchen_wall",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - Wall",
    "areaSqft": 7.75,
    "icon": "🚪",
    "dimensions": {
      "W": 600,
      "H": 1200,
      "D": 350
    },
    "elevation": 750,
    "materials": {
      "shutter": {
        "material": "ALUMINUM_SLATS",
        "finish": "Anodized Silver / Anthracite"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "ctype": "kwall",
      "unitType": "wfm60-roll",
      "isRollingShutter": true,
      "shutterType": "rolling_shutter",
      "doorType": "rolling",
      "shutters": 1,
      "minDepth": 300,
      "maxDepth": 550,
      "counter": "none",
      "hasLegs": false,
      "legs": 0,
      "plinthH": 0,
      "sections": 1,
      "shelves": 2,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "handle": "grip_bar",
      "hfinish": "aluminum",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "Silver Slats"
    },
    "pricingOverrides": {
      "baseRate": 14500
    },
    "customRate": 14500
  },
  {
    "id": "fcm-rt-os",
    "code": "FCM-RT-OS",
    "name": "FCM-RT Only Shutter",
    "modelType": "kitchen_os",
    "category": "kitchen_corner",
    "costCategory": "Kitchen - O/S",
    "areaSqft": 8.5,
    "icon": "🍳",
    "dimensions": {
      "W": 1050,
      "H": 700,
      "D": 550
    },
    "elevation": 0,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "NONE",
        "finish": "None"
      }
    },
    "unitConfig": {
      "ctype": "kbase",
      "unitType": "fcm-rt",
      "isOnlyShutter": true,
      "fixedPanel": {
        "enabled": true,
        "width": 600,
        "type": "fixed"
      },
      "openShutter": {
        "enabled": true,
        "width": 450,
        "type": "shutter",
        "count": 1,
        "opening": "right"
      },
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 2,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "granite_kashmir_white",
      "handle": "pull",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "carcass": "NONE",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 9800
    },
    "customRate": 9800
  },
  {
    "id": "fcm-lt-os",
    "code": "FCM-LT-OS",
    "name": "FCM-LT Only Shutter",
    "modelType": "kitchen_os",
    "category": "kitchen_corner",
    "costCategory": "Kitchen - O/S",
    "areaSqft": 8.5,
    "icon": "🍳",
    "dimensions": {
      "W": 1050,
      "H": 700,
      "D": 550
    },
    "elevation": 0,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "NONE",
        "finish": "None"
      }
    },
    "unitConfig": {
      "ctype": "kbase",
      "unitType": "fcm-lt",
      "isOnlyShutter": true,
      "fixedPanel": {
        "enabled": true,
        "width": 600,
        "type": "fixed"
      },
      "openShutter": {
        "enabled": true,
        "width": 450,
        "type": "shutter",
        "count": 1,
        "opening": "left"
      },
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 2,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "granite_kashmir_white",
      "handle": "pull",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "carcass": "NONE",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 9800
    },
    "customRate": 9800
  },
  {
    "id": "fbcm",
    "code": "FBCM",
    "name": "L-SHAPED CORNER BASE UNIT (Cookscape)",
    "catalogItemId": "fbcm",
    "modelType": "kitchen_fm",
    "category": "kitchen_corner",
    "costCategory": "Kitchen - FM",
    "areaSqft": 8.7,
    "icon": "🍳",
    "dimensions": {
      "W": 900,
      "H": 700,
      "D": 550
    },
    "elevation": 0,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "ctype": "kbase",
      "unitType": "fbcm",
      "geometryType": "l_shaped_corner",
      "corner": {
        "enabled": true,
        "type": "L",
        "legW": 900,
        "legD": 900,
        "depth": 550,
        "orientation": "right"
      },
      "shutters": 2,
      "doors": [
        {
          "id": "door_1",
          "position": "front",
          "type": "hinged",
          "opening": "left"
        },
        {
          "id": "door_2",
          "position": "side",
          "type": "hinged",
          "opening": "right"
        }
      ],
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 1,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "handle": "standard",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 16500
    },
    "customRate": 16500
  },
  {
    "id": "fcm-rt-1500",
    "code": "WCM-RT",
    "name": "WCM-RT (Cookscape)",
    "catalogItemId": "fcm-rt-1500",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 3.88,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 300
    },
    "elevation": 1500,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "ctype": "kwall",
      "unitType": "fcm-rt",
      "fixedPanel": {
        "enabled": true,
        "width": 300,
        "type": "fixed"
      },
      "openShutter": {
        "enabled": true,
        "width": 300,
        "type": "shutter",
        "count": 1,
        "opening": "right"
      },
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 2,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "pull",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7259.28
    },
    "customRate": 7259.28
  },
  {
    "id": "fcm-lt-1500",
    "code": "WCM-LT",
    "name": "WCM-LT (Cookscape)",
    "catalogItemId": "fcm-lt-1500",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 3.88,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 300
    },
    "elevation": 1500,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "ctype": "kwall",
      "unitType": "fcm-lt",
      "fixedPanel": {
        "enabled": true,
        "width": 300,
        "type": "fixed"
      },
      "openShutter": {
        "enabled": true,
        "width": 300,
        "type": "shutter",
        "count": 1,
        "opening": "left"
      },
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 2,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "pull",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7259.28
    },
    "customRate": 7259.28
  },
  {
    "id": "fbcm-1500",
    "code": "WBCM",
    "name": "WBCM (Cookscape)",
    "catalogItemId": "fbcm-1500",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 3.88,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 300
    },
    "elevation": 1500,
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "ctype": "kwall",
      "unitType": "wbcm",
      "geometryType": "l_shaped_corner",
      "corner": {
        "enabled": true,
        "type": "L",
        "legW": 600,
        "legD": 600,
        "depth": 300,
        "orientation": "right"
      },
      "shutters": 2,
      "doors": [
        {
          "id": "door_1",
          "position": "front",
          "type": "hinged",
          "opening": "left"
        },
        {
          "id": "door_2",
          "position": "side",
          "type": "hinged",
          "opening": "right"
        }
      ],
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 1,
      "shelves": 2,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "standard",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7360
    },
    "customRate": 7360
  },
  {
    "id": "fm-120",
    "code": "fm-120",
    "name": "FM 120",
    "modelType": "kitchen_fm",
    "category": "kitchen_fm",
    "costCategory": "Kitchen - FM",
    "areaSqft": 9.687523546,
    "icon": "🍳",
    "dimensions": {
      "W": 1200,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 17398.79
    },
    "customRate": 17398.79,
    "elevation": 0
  },
  {
    "id": "fm-45",
    "code": "fm-45",
    "name": "FM 45",
    "modelType": "kitchen_fm",
    "category": "kitchen_fm",
    "costCategory": "Kitchen - FM",
    "areaSqft": 3.63282133,
    "icon": "🍳",
    "dimensions": {
      "W": 450,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 6524.55
    },
    "customRate": 6524.55,
    "elevation": 0
  },
  {
    "id": "fm-60",
    "code": "fm-60",
    "name": "FM 60",
    "modelType": "kitchen_fm",
    "category": "kitchen_fm",
    "costCategory": "Kitchen - FM",
    "areaSqft": 4.843761773,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 8699.4
    },
    "customRate": 8699.4,
    "elevation": 0
  },
  {
    "id": "fm-75",
    "code": "fm-75",
    "name": "FM 75",
    "modelType": "kitchen_fm",
    "category": "kitchen_fm",
    "costCategory": "Kitchen - FM",
    "areaSqft": 6.054702216,
    "icon": "🍳",
    "dimensions": {
      "W": 750,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 10874.25
    },
    "customRate": 10874.25,
    "elevation": 0
  },
  {
    "id": "fm-90",
    "code": "fm-90",
    "name": "FM 90",
    "modelType": "kitchen_fm",
    "category": "kitchen_fm",
    "costCategory": "Kitchen - FM",
    "areaSqft": 7.26564266,
    "icon": "🍳",
    "dimensions": {
      "W": 900,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 13049.09
    },
    "customRate": 13049.09,
    "elevation": 0
  },
  {
    "id": "fm-d2-45",
    "code": "fm-d2-45",
    "name": "FM D2 - 45",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 3.63282133,
    "icon": "🍳",
    "dimensions": {
      "W": 450,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 2,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7163.92
    },
    "customRate": 7163.92,
    "elevation": 0
  },
  {
    "id": "fm-d2-75",
    "code": "fm-d2-75",
    "name": "FM D2 - 75",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 6.054702216,
    "icon": "🍳",
    "dimensions": {
      "W": 750,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 2,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 11939.87
    },
    "customRate": 11939.87,
    "elevation": 0
  },
  {
    "id": "fm-d2-90",
    "code": "fm-d2-90",
    "name": "FM D2 - 90",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 7.26564266,
    "icon": "🍳",
    "dimensions": {
      "W": 900,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 2,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 14327.85
    },
    "customRate": 14327.85,
    "elevation": 0
  },
  {
    "id": "fm-d3-45",
    "code": "fm-d3-45",
    "name": "FM D3 - 45",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 3.63282133,
    "icon": "🍳",
    "dimensions": {
      "W": 450,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 3,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7163.92
    },
    "customRate": 7163.92,
    "elevation": 0
  },
  {
    "id": "fm-d3-75",
    "code": "fm-d3-75",
    "name": "FM D3 - 75",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 6.054702216,
    "icon": "🍳",
    "dimensions": {
      "W": 750,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 3,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 11939.87
    },
    "customRate": 11939.87,
    "elevation": 0
  },
  {
    "id": "fm-d3-90",
    "code": "fm-d3-90",
    "name": "FM D3 - 90",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 7.26564266,
    "icon": "🍳",
    "dimensions": {
      "W": 900,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 3,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 14327.85
    },
    "customRate": 14327.85,
    "elevation": 0
  },
  {
    "id": "fm-ds-45",
    "code": "fm-ds-45",
    "name": "FM DS 45",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - FM",
    "areaSqft": 3.63282133,
    "icon": "🍳",
    "dimensions": {
      "W": 450,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 1,
      "drawersOnTop": true,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 6524.55
    },
    "customRate": 6524.55,
    "elevation": 0
  },
  {
    "id": "fm-ds-60",
    "code": "fm-ds-60",
    "name": "FM DS 60",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - FM",
    "areaSqft": 4.843761773,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 1,
      "drawersOnTop": true,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 8699.4
    },
    "customRate": 8699.4,
    "elevation": 0
  },
  {
    "id": "fm-ds-90",
    "code": "fm-ds-90",
    "name": "FM DS 90",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - FM",
    "areaSqft": 7.26564266,
    "icon": "🍳",
    "dimensions": {
      "W": 900,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 2,
      "drawersOnTop": true,
      "drawersSideBySide": true,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 13049.09
    },
    "customRate": 13049.09,
    "elevation": 0
  },
  {
    "id": "sr-45",
    "code": "sr-45",
    "name": "SR 45",
    "modelType": "spice_rack_open_box",
    "category": "spice_rack",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 0.726564266,
    "icon": "🧂",
    "dimensions": {
      "W": 450,
      "H": 150,
      "D": 150
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_19mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 1650.75
    },
    "customRate": 1650.75,
    "elevation": 1350
  },
  {
    "id": "sr-75",
    "code": "sr-75",
    "name": "SR 75",
    "modelType": "spice_rack_open_box",
    "category": "spice_rack",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 1.210940443,
    "icon": "🧂",
    "dimensions": {
      "W": 750,
      "H": 150,
      "D": 150
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_20mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 2751.26
    },
    "customRate": 2751.26,
    "elevation": 1350
  },
  {
    "id": "sr-90",
    "code": "sr-90",
    "name": "SR 90",
    "modelType": "spice_rack_open_box",
    "category": "spice_rack",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 1.453128532,
    "icon": "🧂",
    "dimensions": {
      "W": 900,
      "H": 150,
      "D": 150
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_21mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 3301.51
    },
    "customRate": 3301.51,
    "elevation": 1350
  },
  {
    "id": "tbm-60-oven",
    "code": "tbm-60-oven",
    "name": "TBM 60 OVEN",
    "modelType": "oven_tall_unit",
    "category": "kitchen_tall",
    "costCategory": "Kitchen - Tall Unit",
    "areaSqft": 13.56253296,
    "icon": "🎛️",
    "dimensions": {
      "W": 600,
      "H": 2100,
      "D": 600
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      },
      "back": {
        "material": "BACK_9mm",
        "finish": "MDF 1135"
      }
    },
    "unitConfig": {
      "ctype": "kitchen",
      "unitType": "tbm-60-oven",
      "geometryType": "oven_tall",
      "construction": {
        "carcassThickness": 18,
        "shutterThickness": 18,
        "backThickness": 9,
        "edgeBand": 1
      },
      "oven": {
        "enabled": true,
        "bottomElevation": 700,
        "openingW": 564,
        "openingH": 600,
        "openingD": 600,
        "backPanel": false,
        "supportBottom": true,
        "supportTop": true,
        "ventilation": true
      },
      "shutters": 2,
      "doorType": "hinged",
      "drawers": 0,
      "shelves": 0,
      "sections": 3,
      "shutterConfig": {
        "bottom": {
          "enabled": true,
          "height": 700,
          "hingeSide": "left",
          "openingAngle": 105,
          "type": "hinged"
        },
        "top": {
          "enabled": true,
          "height": 700,
          "hingeSide": "left",
          "openingAngle": 105,
          "type": "hinged"
        }
      },
      "dstyle": "slab",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "counter": "none",
      "loft": false,
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100
    },
    "pricingOverrides": {
      "baseRate": 23598.81
    },
    "customRate": 23598.81,
    "elevation": 0
  },
  {
    "id": "wm-30",
    "code": "wm-30",
    "name": "WM 30",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 1.937504709,
    "icon": "🎛️",
    "dimensions": {
      "W": 300,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 2993.44
    },
    "customRate": 2993.44,
    "elevation": 1500
  },
  {
    "id": "wm-45",
    "code": "wm-45",
    "name": "WM 45",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 2.906257064,
    "icon": "🎛️",
    "dimensions": {
      "W": 450,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 4490.17
    },
    "customRate": 4490.17,
    "elevation": 1500
  },
  {
    "id": "wm-60-gl",
    "code": "wm-60-gl",
    "name": "WM 60 GL",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 3.875009418,
    "icon": "🎛️",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "glass",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 5986.89
    },
    "customRate": 5986.89,
    "elevation": 1500
  },
  {
    "id": "wm-75",
    "code": "wm-75",
    "name": "WM 75",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 4.843761773,
    "icon": "🎛️",
    "dimensions": {
      "W": 750,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7483.61
    },
    "customRate": 7483.61,
    "elevation": 1500
  },
  {
    "id": "wm-75-gl",
    "code": "wm-75-gl",
    "name": "WM 75 GL",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 4.843761773,
    "icon": "🎛️",
    "dimensions": {
      "W": 750,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "glass",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 7483.61
    },
    "customRate": 7483.61,
    "elevation": 1500
  },
  {
    "id": "wm-90",
    "code": "wm-90",
    "name": "WM 90",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 5.812514128,
    "icon": "🎛️",
    "dimensions": {
      "W": 900,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 8980.33
    },
    "customRate": 8980.33,
    "elevation": 1500
  },
  {
    "id": "wm-90-gl",
    "code": "wm-90-gl",
    "name": "WM 90 GL",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 5.812514128,
    "icon": "🎛️",
    "dimensions": {
      "W": 900,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "glass",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 8980.33
    },
    "customRate": 8980.33,
    "elevation": 1500
  },
  {
    "id": "loft-1d-mod",
    "code": "loft-1d-mod",
    "name": "LOFT 1 DOOR MODULAR",
    "modelType": "wardrobe_modular_shelves",
    "category": "loft",
    "costCategory": "Wr - Modular - ONLY SHELVES",
    "areaSqft": 4.359385596,
    "icon": "🚪",
    "dimensions": {
      "W": 450,
      "H": 750,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 6735.25
    },
    "customRate": 6735.25,
    "elevation": 2100
  },
  {
    "id": "loft-1d-os",
    "code": "loft-1d-os",
    "name": "LOFT 1 DOOR O/S",
    "modelType": "loft_os",
    "category": "loft",
    "costCategory": "Loft - O/S",
    "areaSqft": 4.359385596,
    "icon": "📦",
    "dimensions": {
      "W": 450,
      "H": 750,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "isOnlyShutter": true,
      "shutterThickness": 18,
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 3901.65
    },
    "customRate": 3901.65,
    "elevation": 2100
  },
  {
    "id": "pnl-wall",
    "code": "pnl-wall",
    "name": "WALL PANEL",
    "modelType": "wall_paneling",
    "category": "wall_paneling",
    "costCategory": "Wall Paneling",
    "areaSqft": 15.50003767,
    "icon": "🪵",
    "dimensions": {
      "W": 1200,
      "H": 1200,
      "D": 18
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 12338.03
    },
    "customRate": 12338.03,
    "elevation": 0
  },
  {
    "id": "ob-std",
    "code": "ob-std",
    "name": "OPEN BOX",
    "modelType": "spice_rack",
    "category": "spice_rack",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 3.875009418,
    "icon": "🧂",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 8804.02
    },
    "customRate": 8804.02,
    "elevation": 1500
  },
  {
    "id": "ob-200-300",
    "code": "ob-200-300",
    "name": "OPEN BOX-200 - 300",
    "modelType": "spice_rack",
    "category": "spice_rack",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 0.9687523546,
    "icon": "🧂",
    "dimensions": {
      "W": 300,
      "H": 300,
      "D": 200
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 2201.01
    },
    "customRate": 2201.01,
    "elevation": 1500
  },
  {
    "id": "ob-300-600",
    "code": "ob-300-600",
    "name": "OPEN BOX 300 - 600",
    "modelType": "spice_rack",
    "category": "spice_rack",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 3.875009418,
    "icon": "🧂",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 8804.02
    },
    "customRate": 8804.02,
    "elevation": 1500
  },
  {
    "id": "ledge-std",
    "code": "ledge-std",
    "name": "LEDGE",
    "modelType": "wall_paneling",
    "category": "wall_paneling",
    "costCategory": "Wall Paneling",
    "areaSqft": 2.583344,
    "icon": "🪵",
    "dimensions": {
      "W": 1200,
      "H": 18,
      "D": 200
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 185.07
    },
    "customRate": 185.07,
    "elevation": 1200
  },
  {
    "id": "pnl-back",
    "code": "pnl-back",
    "name": "BACK PANEL",
    "modelType": "wall_paneling",
    "category": "wall_paneling",
    "costCategory": "Wall Paneling",
    "areaSqft": 19.37504709,
    "icon": "🪵",
    "dimensions": {
      "W": 1200,
      "H": 1500,
      "D": 18
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 15422.54
    },
    "customRate": 15422.54,
    "elevation": 300
  },
  {
    "id": "ctvb-doors-only",
    "code": "ctvb-doors-only",
    "name": "CROCKERY / TV BASE ONLY DOORS",
    "modelType": "loft_os",
    "category": "crockery",
    "costCategory": "Loft - O/S",
    "areaSqft": 6.054702216,
    "icon": "📦",
    "dimensions": {
      "W": 750,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707",
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "mountType": "floor",
      "isOnlyShutter": true
    },
    "pricingOverrides": {
      "baseRate": 5418.96
    },
    "customRate": 5418.96,
    "elevation": 0
  },
  {
    "id": "ctvb-open-storage",
    "code": "ctvb-open-storage",
    "name": "CROCKERY/TV BASE OPEN STORAGE",
    "modelType": "spice_rack",
    "category": "crockery",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 4.843761773,
    "icon": "🧂",
    "dimensions": {
      "W": 600,
      "H": 700,
      "D": 450
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none",
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "mountType": "floor"
    },
    "pricingOverrides": {
      "baseRate": 4402.01
    },
    "customRate": 4402.01,
    "elevation": 0
  },
  {
    "id": "ctvw-doors-only",
    "code": "ctvw-doors-only",
    "name": "CROCKERY/TV WALL UNIT ONLY DOOR",
    "modelType": "loft_os",
    "category": "crockery",
    "costCategory": "Loft - O/S",
    "areaSqft": 1.937504709,
    "icon": "📦",
    "dimensions": {
      "W": 300,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "BLUE",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707",
      "ctype": "kwall",
      "mountType": "wall",
      "isOnlyShutter": true
    },
    "pricingOverrides": {
      "baseRate": 1734.07
    },
    "customRate": 1734.07,
    "elevation": 1500
  },
  {
    "id": "ctvw-open-box",
    "code": "ctvw-open-box",
    "name": "CROCKERY/TV WALL OPEN BOX STORAGE",
    "modelType": "spice_rack",
    "category": "crockery",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 1.291669806,
    "icon": "🧂",
    "dimensions": {
      "W": 600,
      "H": 200,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 2934.67
    },
    "customRate": 2934.67,
    "elevation": 1500
  },
  {
    "id": "ctvw-1d",
    "code": "ctvw-1d",
    "name": "CROCKERY/TV WALL 1 DOOR",
    "modelType": "pooja_with_cnc",
    "category": "crockery",
    "costCategory": "POOJA WITH CNC",
    "areaSqft": 1.937504709,
    "icon": "🚪",
    "dimensions": {
      "W": 300,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 1,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "bar",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "ctype": "kwall",
      "mountType": "wall"
    },
    "pricingOverrides": {
      "baseRate": 2450
    },
    "customRate": 2450,
    "elevation": 1500
  },
  {
    "id": "fm-30-oil",
    "code": "fm-30-oil",
    "name": "FM30 -OIL PULLOUT",
    "modelType": "kitchen_fm",
    "category": "kitchen_fm",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 2.421880887,
    "icon": "🍳",
    "dimensions": {
      "W": 300,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 1,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 4775.95
    },
    "customRate": 4775.95,
    "elevation": 0
  },
  {
    "id": "fm-d2-60",
    "code": "fm-d2-60",
    "name": "FM D2 - 60",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 4.843761773,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 2,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 9551.9
    },
    "customRate": 9551.9,
    "elevation": 0
  },
  {
    "id": "fm-d3-60",
    "code": "fm-d3-60",
    "name": "FM D3 - 60",
    "modelType": "kitchen_fm",
    "category": "kitchen_drawers",
    "costCategory": "Kitchen - D2/D3",
    "areaSqft": 4.843761773,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 3,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 9551.9
    },
    "customRate": 9551.9,
    "elevation": 0
  },
  {
    "id": "ledge-ctop",
    "code": "ledge-ctop",
    "name": "LEDGE COUNTERTOP",
    "modelType": "wall_paneling",
    "category": "wall_paneling",
    "costCategory": "Wall Paneling",
    "areaSqft": 5.328136,
    "icon": "🪵",
    "dimensions": {
      "W": 900,
      "H": 18,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 138.8
    },
    "customRate": 138.8,
    "elevation": 850
  },
  {
    "id": "sr-60",
    "code": "sr-60",
    "name": "SR 60",
    "modelType": "spice_rack",
    "category": "spice_rack",
    "costCategory": "Spice Rack (OPEN BOXES)",
    "areaSqft": 0.9687523546,
    "icon": "🧂",
    "dimensions": {
      "W": 600,
      "H": 150,
      "D": 150
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 2201.01
    },
    "customRate": 2201.01,
    "elevation": 1350
  },
  {
    "id": "wr-sliding",
    "code": "wr-sliding",
    "name": "SLIDING WARDROBE",
    "modelType": "wardrobe_modular_sliding",
    "category": "wardrobe",
    "costCategory": "Wr - Modular - SLIDING",
    "areaSqft": 40.68759889,
    "icon": "🚪",
    "dimensions": {
      "W": 1800,
      "H": 2100,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "sliding",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 5,
      "drawers": 0,
      "loft": true,
      "loftH": 750,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 73034.24
    },
    "customRate": 73034.24
  },
  {
    "id": "tbm-60",
    "code": "tbm-60",
    "name": "TBM 60",
    "modelType": "wardrobe_modular_shelves",
    "category": "kitchen_tall",
    "costCategory": "Wr - Modular - ONLY SHELVES",
    "areaSqft": 13.56253296,
    "icon": "🚪",
    "dimensions": {
      "W": 600,
      "H": 2100,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 5,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 20954.11
    },
    "customRate": 20954.11,
    "elevation": 0
  },
  {
    "id": "tbm-90",
    "code": "tbm-90",
    "name": "TBM 90",
    "modelType": "wardrobe_modular_shelves",
    "category": "kitchen_tall",
    "costCategory": "Kitchen - Tall",
    "areaSqft": 20.3438,
    "icon": "🚪",
    "dimensions": {
      "W": 900,
      "H": 2100,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 5,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "none",
      "led": false,
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "mountType": "floor",
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 31431.17
    },
    "customRate": 31431.17,
    "elevation": 0
  },
  {
    "id": "ledge-vert",
    "code": "ledge-vert",
    "name": "VERTICAL LEDGE",
    "modelType": "wall_paneling",
    "category": "wall_paneling",
    "costCategory": "Wall Paneling",
    "areaSqft": 1.20556,
    "icon": "🪵",
    "dimensions": {
      "W": 18,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "none",
        "finish": "none"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "none"
    },
    "pricingOverrides": {
      "baseRate": 1028.17
    },
    "customRate": 1028.17,
    "elevation": 0
  },
  {
    "id": "bs-60",
    "code": "bs-60",
    "name": "BS (BLANK SHUTTER)",
    "modelType": "wall_paneling",
    "category": "wall_paneling",
    "costCategory": "Wall Paneling",
    "areaSqft": 0.452085,
    "icon": "🪵",
    "dimensions": {
      "W": 60,
      "H": 700,
      "D": 18
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "slab",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "none",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "isOnlyShutter": true
    },
    "pricingOverrides": {
      "baseRate": 1650.0
    },
    "customRate": 1650.0,
    "elevation": 0
  },
  {
    "id": "wm-45-gl",
    "code": "wm-45-gl",
    "name": "WM 45 GL",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 2.906257064,
    "icon": "🎛️",
    "dimensions": {
      "W": 450,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "glass",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 4490.17
    },
    "customRate": 4490.17,
    "elevation": 1500
  },
  {
    "id": "wm-60-dbl",
    "code": "wm-60-dbl",
    "name": "WM 60 DOUBLE",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 3.875009418,
    "icon": "🎛️",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "none",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 5986.89
    },
    "customRate": 5986.89,
    "elevation": 1500
  },
  {
    "id": "wm-open-30",
    "code": "wm-open-30",
    "name": "WM OPEN 30",
    "modelType": "kitchen_wm",
    "category": "kitchen_wall",
    "costCategory": "Kitchen - WM",
    "areaSqft": 1.937504709,
    "icon": "🎛️",
    "dimensions": {
      "W": 300,
      "H": 600,
      "D": 300
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 0,
      "doorType": "none",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 2993.44
    },
    "customRate": 2993.44,
    "elevation": 1500
  },
  {
    "id": "loft-2d-mod",
    "code": "loft-2d-mod",
    "name": "LOFT 2 DOOR MODULAR",
    "modelType": "wardrobe_modular_shelves",
    "category": "loft",
    "costCategory": "Wr - Modular - ONLY SHELVES",
    "areaSqft": 8.718771191,
    "icon": "🚪",
    "dimensions": {
      "W": 900,
      "H": 750,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 13470.5
    },
    "customRate": 13470.5,
    "elevation": 2100
  },
  {
    "id": "loft-2d-os",
    "code": "loft-2d-os",
    "name": "LOFT 2 DOOR O/S",
    "modelType": "loft_os",
    "category": "loft",
    "costCategory": "Loft - O/S",
    "areaSqft": 7.26564266,
    "icon": "📦",
    "dimensions": {
      "W": 750,
      "H": 750,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "isOnlyShutter": true,
      "shutterThickness": 18,
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 6502.75
    },
    "customRate": 6502.75,
    "elevation": 2100
  },
  {
    "id": "wr-shelves",
    "code": "wr-shelves",
    "name": "WR 2 DOOR WITH SHELVBES",
    "modelType": "wardrobe_modular_shelves",
    "category": "wardrobe",
    "costCategory": "Wr - Modular - ONLY SHELVES",
    "areaSqft": 20.34379945,
    "icon": "🚪",
    "dimensions": {
      "W": 900,
      "H": 2100,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 5,
      "drawers": 0,
      "loft": true,
      "loftH": 750,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 31431.17
    },
    "customRate": 31431.17
  },
  {
    "id": "wr-drawers",
    "code": "wr-drawers",
    "name": "WR 2 DOOR WITH DRAWERS",
    "modelType": "wardrobe_modular_drawers",
    "category": "wardrobe",
    "costCategory": "Wr - Modular - 2 DRAWERS",
    "areaSqft": 20.34379945,
    "icon": "🚪",
    "dimensions": {
      "W": 900,
      "H": 2100,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 2,
      "loft": true,
      "loftH": 750,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "internalDrawers": true,
      "drawersInCenter": true,
      "hasHangingRod": true,
      "hangingRodTop": true
    },
    "pricingOverrides": {
      "baseRate": 35398.21
    },
    "customRate": 35398.21
  },
  {
    "id": "wr-1-shelves",
    "code": "wr-1-shelves",
    "name": "WR 1 DOOR WITH SHELVBES",
    "modelType": "wardrobe_modular_shelves",
    "category": "wardrobe",
    "costCategory": "Wr - Modular - ONLY SHELVES",
    "areaSqft": 13.56253296,
    "icon": "🚪",
    "dimensions": {
      "W": 600,
      "H": 2100,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 5,
      "drawers": 0,
      "loft": true,
      "loftH": 750,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 20954.11
    },
    "customRate": 20954.11
  },
  {
    "id": "wr-1-drawers",
    "code": "wr-1-drawers",
    "name": "WR 1 DOOR WITH DRAWERS",
    "modelType": "wardrobe_modular_drawers",
    "category": "wardrobe",
    "costCategory": "Wr - Modular - 2 DRAWERS",
    "areaSqft": 13.56253296,
    "icon": "🚪",
    "dimensions": {
      "W": 600,
      "H": 2100,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "BWP_18mm",
        "finish": "MDF 6601"
      }
    },
    "unitConfig": {
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 1,
      "drawers": 1,
      "loft": true,
      "loftH": 750,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "MDF 6601",
      "shutterCol": "MDF 7707",
      "internalDrawers": true,
      "drawersInCenter": true,
      "hasHangingRod": true,
      "hangingRodTop": true
    },
    "pricingOverrides": {
      "baseRate": 23598.81
    },
    "customRate": 23598.81
  },
  {
    "id": "wrb-60 o/s",
    "code": "wrb-60 o/s",
    "name": "WRB 60 O/S",
    "description": "WRB ONLY SHUTTER 60",
    "modelType": "loft_os",
    "category": "wardrobe",
    "costCategory": "Wardrobe - O/S",
    "areaSqft": 13.56253296,
    "icon": "🚪",
    "dimensions": {
      "W": 600,
      "H": 2100,
      "D": 18
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "isOnlyShutter": true,
      "shutterThickness": 18,
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "hasLegs": false,
      "legs": 0,
      "plinthH": 0,
      "mountType": "floor",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 13508.28
    },
    "customRate": 13508.28,
    "elevation": 0
  },
  {
    "id": "wrb-120 o/s",
    "code": "wrb-120 o/s",
    "name": "WRB 120 O/S",
    "description": "WRB ONLY SHUTTER 120",
    "modelType": "loft_os",
    "category": "wardrobe",
    "costCategory": "Wardrobe - O/S",
    "areaSqft": 27.12506593,
    "icon": "🚪",
    "dimensions": {
      "W": 1200,
      "H": 2100,
      "D": 18
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "isOnlyShutter": true,
      "shutterThickness": 18,
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "hasLegs": false,
      "legs": 0,
      "plinthH": 0,
      "mountType": "floor",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 27016.57
    },
    "customRate": 27016.57,
    "elevation": 0
  },
  {
    "id": "fm-120 o/s",
    "code": "fm-120 o/s",
    "name": "FM 120 O/S",
    "modelType": "kitchen_o_s",
    "category": "kitchen_fm",
    "costCategory": "Kitchen O/S",
    "areaSqft": 9.687523546,
    "icon": "🍳",
    "dimensions": {
      "W": 1200,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "isOnlyShutter": true,
      "shutterThickness": 18,
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "mountType": "floor",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 8670.33
    },
    "customRate": 8670.33,
    "elevation": 0
  },
  {
    "id": "fm-60 o/s",
    "code": "fm-60 o/s",
    "name": "FM 60 O/S",
    "modelType": "kitchen_o_s",
    "category": "kitchen_fm",
    "costCategory": "Kitchen O/S",
    "areaSqft": 4.843761773,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 700,
      "D": 550
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "isOnlyShutter": true,
      "shutterThickness": 18,
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "black",
      "hasLegs": true,
      "legs": 100,
      "plinthH": 100,
      "mountType": "floor",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 4335.17
    },
    "customRate": 4335.17,
    "elevation": 0
  },
  {
    "id": "wm-60 o/s",
    "code": "wm-60 o/s",
    "name": "WM  60 O/S",
    "modelType": "kitchen_o_s",
    "category": "kitchen_wall",
    "costCategory": "Kitchen O/S",
    "areaSqft": 3.875009418,
    "icon": "🍳",
    "dimensions": {
      "W": 600,
      "H": 600,
      "D": 350
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "isOnlyShutter": true,
      "shutterThickness": 18,
      "shutters": 2,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 3468.13
    },
    "customRate": 3468.13,
    "elevation": 1500
  },
  {
    "id": "wm-30 o/s",
    "code": "wm-30 o/s",
    "name": "WM 30 O/S",
    "modelType": "kitchen_o_s",
    "category": "kitchen_wall",
    "costCategory": "Kitchen O/S",
    "areaSqft": 1.937504709,
    "icon": "🍳",
    "dimensions": {
      "W": 300,
      "H": 600,
      "D": 350
    },
    "materials": {
      "shutter": {
        "material": "HDHMR_18mm",
        "finish": "MDF 7707"
      },
      "carcass": {
        "material": "none",
        "finish": "none"
      }
    },
    "unitConfig": {
      "isOnlyShutter": true,
      "shutterThickness": 18,
      "shutters": 1,
      "doorType": "hinged",
      "dstyle": "slab",
      "glassTint": "none",
      "profileColor": "none",
      "sections": 0,
      "shelves": 0,
      "drawers": 0,
      "loft": false,
      "loftH": 0,
      "counter": "none",
      "handle": "gprof",
      "hfinish": "black",
      "led": false,
      "carcass": "none",
      "shutterCol": "MDF 7707"
    },
    "pricingOverrides": {
      "baseRate": 1734.07
    },
    "customRate": 1734.07,
    "elevation": 1500
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

  function registerDecorsCatalog(catalog) {
    if (!Array.isArray(catalog)) return;
    for (var i = 0; i < catalog.length; i++) {
      var d = catalog[i];
      var existingIdx = -1;
      for (var j = 0; j < FURNITURE_CATALOG.length; j++) {
        if (FURNITURE_CATALOG[j].id === d.id || (d.slug && FURNITURE_CATALOG[j].slug === d.slug)) {
          existingIdx = j;
          break;
        }
      }
      var entry = Object.assign({}, d, {
        category: 'decor',
        isDecor: true,
        excludeFromPricing: true,
        areaSqft: 0
      });
      if (existingIdx >= 0) {
        FURNITURE_CATALOG[existingIdx] = entry;
      } else {
        FURNITURE_CATALOG.push(entry);
      }
    }
  }

  if (typeof window !== 'undefined' && window.ORBIX_DECORS_CATALOG && Array.isArray(window.ORBIX_DECORS_CATALOG)) {
    registerDecorsCatalog(window.ORBIX_DECORS_CATALOG);
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
    var id = typeof item === 'string' ? item : (item.id || item.code || '');
    if (typeof item === 'object' && (item.thumbnailUrl || item.thumbnail)) return item.thumbnailUrl || item.thumbnail;
    var clean = sanitizeIconId(id);
    if (id === 'w2d' || id === 'W-01' || clean === 'w2d' || clean === 'w-01') return 'icon-furniture.png';
    if (id === 'ctvb-1d-1dr' || clean === 'ctvb-1d-1dr') return 'icon-cookscape-unit.png';
    if (clean.indexOf('decor_') === 0 || (typeof item === 'object' && (item.category === 'decor' || item.type === 'decor'))) {
      if (typeof item === 'object' && item.thumbnailUrl) return item.thumbnailUrl;
      return 'icon-furniture.png';
    }
    return 'unit-icons/' + clean + '.svg';
  }

  function formatFeetInches(mm) {
    if (typeof mm !== 'number' || isNaN(mm)) return '0"';
    var totalInches = mm / 25.4;
    var feet = Math.floor(totalInches / 12);
    var remInches = Math.round(totalInches % 12);
    if (remInches === 12) { feet += 1; remInches = 0; }
    if (feet === 0) return remInches + '"';
    if (remInches === 0) return feet + '\'';
    return feet + '\' ' + remInches + '"';
  }

  function toValidHexColor(val, fallback) {
    var fb = (typeof fallback === 'string' && /^#[0-9a-fA-F]{6}$/.test(fallback)) ? fallback : '#edebe4';
    if (!val || typeof val !== 'string') return fb;
    var str = val.trim();
    if (/^#[0-9a-fA-F]{6}$/.test(str)) return str;
    if (/^#[0-9a-fA-F]{3}$/.test(str)) {
      return '#' + str[1] + str[1] + str[2] + str[2] + str[3] + str[3];
    }
    if (/^[0-9a-fA-F]{6}$/.test(str)) return '#' + str;

    var lower = str.toLowerCase();
    if (lower.indexOf('6601') !== -1 || lower.indexOf('gloss white') !== -1) return '#f4f3ef';
    if (lower.indexOf('1135') !== -1 || lower.indexOf('white') !== -1 || lower.indexOf('frost') !== -1) return '#edebe4';
    if (lower.indexOf('3410') !== -1 || lower.indexOf('walnut') !== -1) return '#6e4e35';
    if (lower.indexOf('3411') !== -1 || lower.indexOf('wenge') !== -1) return '#4a3a2e';
    if (lower.indexOf('1101') !== -1 || lower.indexOf('ivory') !== -1 || lower.indexOf('cream') !== -1) return '#e4dcc8';
    if (lower.indexOf('2204') !== -1 || lower.indexOf('oak') !== -1) return '#c4a173';
    if (lower.indexOf('2210') !== -1 || lower.indexOf('teak') !== -1) return '#a9743f';
    if (lower.indexOf('4402') !== -1 || lower.indexOf('grey oak') !== -1) return '#9c9891';
    if (lower.indexOf('5501') !== -1 || lower.indexOf('graphite') !== -1) return '#585b5e';
    if (lower.indexOf('6601') !== -1 || lower.indexOf('gloss white') !== -1) return '#f4f3ef';
    if (lower.indexOf('6620') !== -1 || lower.indexOf('gloss grey') !== -1) return '#8d9296';
    if (lower.indexOf('6630') !== -1 || lower.indexOf('gloss red') !== -1 || lower.indexOf('red') !== -1) return '#b2231f';
    if (lower.indexOf('6640') !== -1 || lower.indexOf('gloss black') !== -1 || lower === 'black') return '#1c1c1e';
    if (lower.indexOf('7701') !== -1 || lower.indexOf('sage') !== -1) return '#8e9c86';
    if (lower.indexOf('7702') !== -1 || lower.indexOf('charcoal') !== -1) return '#3b3d40';
    if (lower.indexOf('7703') !== -1 || lower.indexOf('sand') !== -1 || lower.indexOf('beige') !== -1) return '#d3c4a9';
    if (lower.indexOf('7704') !== -1 || lower.indexOf('taupe') !== -1) return '#9a9188';
    if (lower.indexOf('7706') !== -1 || lower.indexOf('coffee') !== -1 || lower.indexOf('brown') !== -1) return '#5a4232';
    if (lower.indexOf('7707') !== -1 || lower.indexOf('navy') !== -1 || lower.indexOf('blue') !== -1) return '#2e3f5c';
    if (lower.indexOf('7708') !== -1 || lower.indexOf('terracotta') !== -1) return '#b5654a';
    if (lower.indexOf('7709') !== -1 || lower.indexOf('olive') !== -1) return '#6b6e45';
    if (lower.indexOf('8801') !== -1 || lower.indexOf('concrete') !== -1) return '#a8a5a0';
    if (lower.indexOf('7710') !== -1 || lower.indexOf('powder') !== -1) return '#a9bed2';
    if (lower.indexOf('7711') !== -1 || lower.indexOf('blush') !== -1) return '#d9b4a6';
    if (lower.indexOf('grey') !== -1 || lower.indexOf('gray') !== -1) return '#8d9296';
    if (lower.indexOf('green') !== -1) return '#7a8875';

    return fb;
  }

  /* ─────────────────────────────────────────────────────────────────────────────
     ELEGANT SURABHI Costing Slabs — Design Fee & 60% Discount Schedule
  ───────────────────────────────────────────────────────────────────────────── */
  var SURABHI_DESIGN_FEE_SLABS = [
    { id: '2_to_3', label: '2 to 3 Lakhs', min: 200000, max: 300000, fullDesignCharges: 24465, discountedCharges: 9786, discountPercent: 60 },
    { id: '4_to_5', label: '4 to 5 Lakhs', min: 400000, max: 500000, fullDesignCharges: 35280, discountedCharges: 14112, discountPercent: 60 },
    { id: '5_to_7_entry', label: '5 to 7 Lakhs (Entry)', min: 500000, max: 566666, fullDesignCharges: 42780, discountedCharges: 17112, discountPercent: 60 },
    { id: '5_to_7_mid', label: '5 to 7 Lakhs (Mid)', min: 566667, max: 633333, fullDesignCharges: 47780, discountedCharges: 19112, discountPercent: 60 },
    { id: '5_to_7_upper', label: '5 to 7 Lakhs (Upper)', min: 633334, max: 700000, fullDesignCharges: 60280, discountedCharges: 24112, discountPercent: 60 },
    { id: '7_to_8', label: '7 to 8 Lakhs', min: 700001, max: 800000, fullDesignCharges: 72780, discountedCharges: 29112, discountPercent: 60 },
    { id: '9_to_10', label: '9 to 10 Lakhs', min: 900000, max: 1000000, fullDesignCharges: 85280, discountedCharges: 34112, discountPercent: 60 },
    { id: '10_to_11', label: '10 to 11 Lakhs', min: 1000001, max: 1100000, fullDesignCharges: 97780, discountedCharges: 39112, discountPercent: 60 },
    { id: '12_to_15', label: '12 to 15 Lakhs', min: 1200000, max: 1500000, fullDesignCharges: 112780, discountedCharges: 45112, discountPercent: 60 },
    { id: '15_to_20', label: '15 to 20 Lakhs', min: 1500001, max: 2000000, fullDesignCharges: 147780, discountedCharges: 59112, discountPercent: 60 },
    { id: '20_to_25', label: '20 to 25 Lakhs', min: 2000001, max: 2500000, fullDesignCharges: 195280, discountedCharges: 78112, discountPercent: 60 },
    { id: '25_to_30', label: '25 to 30 Lakhs', min: 2500001, max: 3000000, fullDesignCharges: 222780, discountedCharges: 89112, discountPercent: 60 }
  ];

  function getSurabhiDesignFeeSlab(surabhiWoodworkAmount, selectedSlabId) {
    if (selectedSlabId && selectedSlabId !== 'auto' && selectedSlabId !== 'custom') {
      for (var i = 0; i < SURABHI_DESIGN_FEE_SLABS.length; i++) {
        if (SURABHI_DESIGN_FEE_SLABS[i].id === selectedSlabId) {
          return SURABHI_DESIGN_FEE_SLABS[i];
        }
      }
    }
    if (selectedSlabId === 'custom') {
      return null;
    }
    // Auto-detect based on Elegant Surabhi costing
    var val = Number(surabhiWoodworkAmount) || 0;
    if (val <= 350000) return SURABHI_DESIGN_FEE_SLABS[0]; // 2 to 3L
    if (val <= 500000) return SURABHI_DESIGN_FEE_SLABS[1]; // 4 to 5L
    if (val <= 566666) return SURABHI_DESIGN_FEE_SLABS[2]; // 5 to 7L (Entry)
    if (val <= 633333) return SURABHI_DESIGN_FEE_SLABS[3]; // 5 to 7L (Mid)
    if (val <= 700000) return SURABHI_DESIGN_FEE_SLABS[4]; // 5 to 7L (Upper)
    if (val <= 850000) return SURABHI_DESIGN_FEE_SLABS[5]; // 7 to 8L
    if (val <= 1000000) return SURABHI_DESIGN_FEE_SLABS[6]; // 9 to 10L
    if (val <= 1150000) return SURABHI_DESIGN_FEE_SLABS[7]; // 10 to 11L
    if (val <= 1500000) return SURABHI_DESIGN_FEE_SLABS[8]; // 12 to 15L
    if (val <= 2000000) return SURABHI_DESIGN_FEE_SLABS[9]; // 15 to 20L
    if (val <= 2500000) return SURABHI_DESIGN_FEE_SLABS[10]; // 20 to 25L
    return SURABHI_DESIGN_FEE_SLABS[11]; // 25 to 30L+
  }

  // Cookscape Master Add-Ons & Accessories Catalog with Multi-Brand Rates (Ebco, Hettich, Grass, Livsmart)
  var COOKSCAPE_ADDONS_CATALOG = [
    { id: 'pvc_cutlery_inlet_450', name: 'PVC CUTLERY INLET - 450', category: 'Kitchen Inlets', brand: 'HETTICH', rate: 1385.00, ebcoRate: 1271.70, hettichRate: 1385.00 },
    { id: 'pvc_cutlery_inlet_600', name: 'PVC CUTLERY INLET - 600', category: 'Kitchen Inlets', brand: 'HETTICH', rate: 1775.00, ebcoRate: 1649.70, hettichRate: 1775.00 },
    { id: 'pvc_cutlery_inlet_900', name: 'PVC CUTLERY INLET - 900', category: 'Kitchen Inlets', brand: 'HETTICH', rate: 4520.00, ebcoRate: 3555.90, hettichRate: 4520.00 },
    { id: 'ss_cutlery_450', name: 'SS CUTLERY - 450', category: 'Kitchen Inlets', brand: 'HETTICH', rate: 7150.00, ebcoRate: 6332.30, hettichRate: 7150.00 },
    { id: 'ss_cutlery_600', name: 'SS CUTLERY - 600', category: 'Kitchen Inlets', brand: 'HETTICH', rate: 7855.00, ebcoRate: 7627.50, hettichRate: 7855.00 },
    { id: 'plain_basket_450', name: 'PLAIN BASKET - 450', category: 'Kitchen Baskets', brand: 'HETTICH', rate: 4483.20, ebcoRate: 4062.90, hettichRate: 4483.20 },
    { id: 'plain_basket_600', name: 'PLAIN BASKET - 600', category: 'Kitchen Baskets', brand: 'HETTICH', rate: 5428.80, ebcoRate: 4919.85, hettichRate: 5428.80 },
    { id: 'ss_plate_basket_450', name: 'SS PLATE BASKET - 450', category: 'Kitchen Baskets', brand: 'HETTICH', rate: 6951.00, ebcoRate: 6454.50, hettichRate: 6951.00 },
    { id: 'ss_plate_basket_600', name: 'SS PLATE BASKET - 600', category: 'Kitchen Baskets', brand: 'HETTICH', rate: 7847.07, ebcoRate: 7299.60, hettichRate: 7847.07 },
    { id: 'ss_plate_basket_900', name: 'SS PLATE BASKET - 900', category: 'Kitchen Baskets', brand: 'HETTICH', rate: 8105.07, ebcoRate: 7853.75, hettichRate: 8105.07 },
    { id: 'ss_plate_inlet', name: 'SS PLATE INLET', category: 'Kitchen Inlets', brand: 'HETTICH', rate: 2611.45, ebcoRate: 2496.00, hettichRate: 2611.45 },
    { id: 'tandem_drawer_30kg', name: 'TANDEM DRAWER - 30Kg', category: 'Kitchen Baskets', brand: 'HETTICH', rate: 7936.50, ebcoRate: 7187.50, hettichRate: 7936.50 },
    { id: 'tandem_50kg_rice', name: 'TANDEM - 50KG (RICE TANDEM)', category: 'Kitchen Baskets', brand: 'HETTICH', rate: 14902.80, ebcoRate: 12321.25, hettichRate: 14902.80, grassRate: 11977.00 },
    { id: 'wicker_basket_450', name: 'WICKER BASKET - 450', category: 'Kitchen Baskets', brand: 'EBCO', rate: 11463.60, ebcoRate: 11463.60, hettichRate: 5599.00 },
    { id: 'wicker_basket_600', name: 'WICKER BASKET - 600', category: 'Kitchen Baskets', brand: 'EBCO', rate: 9553.00, ebcoRate: 9553.00, hettichRate: 6875.00 },
    { id: 'magic_corner', name: 'MAGIC CORNER', category: 'Corner Solutions', brand: 'HETTICH', rate: 41932.00, ebcoRate: 41401.92, hettichRate: 41932.00 },
    { id: 'magic_corner_ss', name: 'MAGIC CORNER - SS', category: 'Corner Solutions', brand: 'HETTICH', rate: 45744.00, hettichRate: 45744.00 },
    { id: 'magic_corner_dbl', name: 'MAGIC CORNER DOUBLE PULLOUT', category: 'Corner Solutions', brand: 'HETTICH', rate: 34200.00, ebcoRate: 36699.60, hettichRate: 34200.00 },
    { id: 'magic_corner_dbl_glass', name: 'MAGIC CORNER DOUBLE PULLOUT - GLASS', category: 'Corner Solutions', brand: 'EBCO', rate: 41606.40, ebcoRate: 41606.40 },
    { id: 'double_corner_pullout', name: 'D0UBLE CORNER PULLOUT', category: 'Corner Solutions', brand: 'HETTICH', rate: 38592.00, ebcoRate: 26730.00, hettichRate: 38592.00 },
    { id: 'corner_carousel', name: 'CORNER CAROUSEL', category: 'Corner Solutions', brand: 'EBCO', rate: 13640.40, ebcoRate: 13640.40, hettichRate: 30876.00 },
    { id: 'kitchen_d_carousel', name: 'KITCHEN D CARROUSEL', category: 'Corner Solutions', brand: 'EBCO', rate: 13784.85, ebcoRate: 13784.85, hettichRate: 60306.00 },
    { id: 'pantry_ss_450', name: 'PANTRY SS - 450', category: 'Pantries', brand: 'EBCO', rate: 20269.20, ebcoRate: 20269.20 },
    { id: 'pantry_ss_600', name: 'PANTRY SS - 600', category: 'Pantries', brand: 'EBCO', rate: 22664.40, ebcoRate: 22664.40 },
    { id: 'pantry_flat_450', name: 'PANTRY FLATE BASE - 450', category: 'Pantries', brand: 'LIVSMART', rate: 35352.00, ebcoRate: 35352.00, hettichRate: 24600.00 },
    { id: 'pantry_flat_600', name: 'PANTRY FLATE BASE - 600', category: 'Pantries', brand: 'LIVSMART', rate: 43588.80, ebcoRate: 43588.80, hettichRate: 26040.00 },
    { id: 'pantry_glass_450', name: 'PANTRY GLASS - 450', category: 'Pantries', brand: 'LIVSMART', rate: 52796.40, ebcoRate: 52796.40 },
    { id: 'pantry_glass_600', name: 'PANTRY GLASS - 600', category: 'Pantries', brand: 'LIVSMART', rate: 59235.60, ebcoRate: 59235.60 },
    { id: 'pullout_pantry_450', name: 'PULLOUT PANTRY - 450', category: 'Pantries', brand: 'HETTICH', rate: 22920.00, ebcoRate: 43022.40, hettichRate: 22920.00 },
    { id: 'pullout_pantry_600', name: 'PULLOUT PANTRY - 600', category: 'Pantries', brand: 'HETTICH', rate: 20760.00, ebcoRate: 48650.40, hettichRate: 20760.00 },
    { id: 'wardrobe_pullout', name: 'WARDROBE PULLOUT', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 8025.85, ebcoRate: 8025.85 },
    { id: 'rolling_shutter_glass_600', name: 'ROLLING SHUTTER GLASS - 600', category: 'Kitchen Fittings', brand: 'GJ', rate: 31545.60, ebcoRate: 31545.60 },
    { id: 'rolling_shutter_pvc_600', name: 'ROLLING SHUTTER PVC- 600', category: 'Kitchen Fittings', brand: 'EBCO', rate: 23808.00, ebcoRate: 23808.00 },
    { id: 'oil_pullout_tandem', name: 'OILPULLOUT TANDEM', category: 'Pullouts', brand: 'HETTICH', rate: 12275.00, ebcoRate: 12275.00 },
    { id: 'oil_pullout_glass', name: 'OILPULLOUT - GLASS', category: 'Pullouts', brand: 'EBCO', rate: 18512.50, ebcoRate: 18512.50 },
    { id: 'oil_pullout_ss', name: 'OILPULLOUT SS', category: 'Pullouts', brand: 'HETTICH', rate: 7812.50, ebcoRate: 8132.50, hettichRate: 7812.50 },
    { id: 'bottle_pullout_tandem', name: 'BOTTLE PULLOUT TANDEM', category: 'Pullouts', brand: 'HETTICH', rate: 10523.75, ebcoRate: 10523.75 },
    { id: 'bottle_pullout_glass', name: 'BOTTLE PULLOUT - GLASS', category: 'Pullouts', brand: 'HETTICH', rate: 12093.75, ebcoRate: 12093.75 },
    { id: 'bottle_pullout_ss', name: 'BOTTLE PULLOUT SS', category: 'Pullouts', brand: 'HETTICH', rate: 6737.50, ebcoRate: 7457.50, hettichRate: 6737.50 },
    { id: 'pan_hanger_rack', name: 'PAN HANGER RACK', category: 'Kitchen Fittings', brand: 'HETTICH', rate: 4478.50, ebcoRate: 4478.50 },
    { id: 'lid_holder_pan_hanger', name: 'LID HOLDER PAN HANGER', category: 'Kitchen Fittings', brand: 'HETTICH', rate: 1547.50, ebcoRate: 1547.50 },
    { id: 'detergent_caddie', name: 'DETERGENT CADDIE', category: 'Cleaning & Waste', brand: 'HETTICH', rate: 8252.50, ebcoRate: 8252.50 },
    { id: 'detergent_holder_ss', name: 'DETERGETN HOLDER - SS', category: 'Cleaning & Waste', brand: 'HETTICH', rate: 2433.75, ebcoRate: 1970.00, hettichRate: 2433.75 },
    { id: 'mixer_lift_stand', name: 'MIXER LIFT UP STAND', category: 'Kitchen Fittings', brand: 'HETTICH', rate: 13792.50, ebcoRate: 13792.50 },
    { id: 'gtpt_600', name: 'GTPT 600', category: 'Kitchen Fittings', brand: 'HETTICH', rate: 6632.50, ebcoRate: 6112.50, hettichRate: 6632.50 },
    { id: 'gtpt_900', name: 'GTPT 900', category: 'Kitchen Fittings', brand: 'HETTICH', rate: 8919.60, ebcoRate: 8316.00, hettichRate: 8919.60 },
    { id: 'swing_waste_bin', name: 'SWING OUT WASTE BIN', category: 'Cleaning & Waste', brand: 'HETTICH', rate: 4612.50, ebcoRate: 4612.50 },
    { id: 'waste_bin_holder', name: 'WASTE BIN HOLDER', category: 'Cleaning & Waste', brand: 'HETTICH', rate: 2052.00, ebcoRate: 1323.00, hettichRate: 2052.00 },
    { id: 'laundry_basket_ss', name: 'LAUNDRY BASKET - SS', category: 'Cleaning & Waste', brand: 'HETTICH', rate: 9130.00, hettichRate: 9130.00 },
    { id: 'laundry_basket_wh', name: 'LAUNDRY BASKET - WH', category: 'Cleaning & Waste', brand: 'EBCO', rate: 12788.75, ebcoRate: 12788.75 },
    { id: 'sliding_fittings_cnr', name: 'SLIDING FITTINGS', category: 'Wardrobe Hardware', brand: 'CNR', rate: 20450.00, ebcoRate: 20450.00 },
    { id: 'shoe_rack_side_fitting', name: 'SHOE RACK SIDE FITTING', category: 'Wardrobe Accessories', brand: 'HETTICH', rate: 1604.40, hettichRate: 1604.40 },
    { id: 'wardrobe_lift_side_mount', name: 'WADREOBE LIFT SIDE MOUNT PULLOUT', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 11258.40, ebcoRate: 11258.40, hettichRate: 6588.00 },
    { id: 'wardrobe_mounted_cloth_rack', name: 'WARDROBE MOUNTED CLOTH RACK', category: 'Wardrobe Accessories', brand: 'HETTICH', rate: 6840.00, hettichRate: 6840.00 },
    { id: 'wardrobe_hanger_single', name: 'WARDROBE PULLOUT HANGER - SINGLE', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 12972.00, ebcoRate: 12972.00, hettichRate: 7476.00 },
    { id: 'wardrobe_hanger_double', name: 'WARDROBE PULLOUT HANGER - DOUBLE', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 14976.00, ebcoRate: 14976.00, hettichRate: 9516.00 },
    { id: 'wardrobe_trouser_600', name: 'WARDROBE TROUSER PULLOUT - 600', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 12108.00, ebcoRate: 7248.00, hettichRate: 12108.00 },
    { id: 'wardrobe_trouser_900', name: 'WARDROBE TROUSER PULLOUT - 900', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 15337.50, ebcoRate: 9782.40, hettichRate: 15337.50 },
    { id: 'wardrobe_basket_450', name: 'WARDROBE PULLOUT BASKET - 450', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 13425.60, ebcoRate: 13425.60 },
    { id: 'wardrobe_basket_600', name: 'WARDROBE PULLOUT BASKET - 600', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 16100.00, ebcoRate: 15408.00, hettichRate: 16100.00 },
    { id: 'wardrobe_basket_900', name: 'WARDROBE PULLOUT BASKET - 900', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 20186.40, ebcoRate: 20186.40, hettichRate: 18780.00 },
    { id: 'wardrobe_drawer_450', name: 'WARDROBE PULLOUT DRAWER - 450', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 13194.00, ebcoRate: 13194.00 },
    { id: 'wardrobe_drawer_org_600', name: 'WARDROBE PULLOUT DRAWER ORGANISER - 600', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 20340.00, ebcoRate: 15438.00, hettichRate: 20340.00 },
    { id: 'wardrobe_drawer_org_900', name: 'WARDROBE PULLOUT DRAWER ORGANISER - 900', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 23340.00, ebcoRate: 20328.00, hettichRate: 23340.00 },
    { id: 'wardrobe_utility_rack', name: 'WARDROBE PULLOUT UTILITY RACK', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 3954.00, ebcoRate: 3954.00, hettichRate: 2616.00 },
    { id: 'cloths_holder', name: 'CLOTHS HOLDER', category: 'Wardrobe Accessories', brand: 'HETTICH', rate: 5272.20, hettichRate: 5272.20 },
    { id: 'wardrobe_ironing_board', name: 'WARDROBE PULLOUT IROING BOARD', category: 'Wardrobe Accessories', brand: 'LIVSMART', rate: 23948.58, ebcoRate: 12027.75, hettichRate: 23948.58 },
    { id: 'g_profile_handle_1m', name: 'G PROFILE HANDLE 1 meter', category: 'Profiles & Handles', brand: 'CUSTOM', rate: 1250.00, ebcoRate: 1250.00, hettichRate: 1250.00, minRate: 950, maxRate: 1850, unit: 'meter', unitLabel: 'meter(s)', step: 0.5, isCustom: true },
    { id: 'golden_strip', name: 'GOLDEN STRIP', category: 'Profiles & Handles', brand: 'CUSTOM', rate: 850.00, ebcoRate: 850.00, hettichRate: 850.00, minRate: 450, maxRate: 1500, unit: 'meter', unitLabel: 'meter(s)', step: 0.5, isCustom: true }
  ];

  function getCookscapeAddonsCatalog() {
    return COOKSCAPE_ADDONS_CATALOG.slice();
  }

  function calculateAddonsSummary(selectedAddons, appliancesList) {
    var items = Array.isArray(selectedAddons) ? selectedAddons : [];
    var appliances = Array.isArray(appliancesList) ? appliancesList : [];
    var addonsTotal = 0;
    items.forEach(function (it) {
      var qty = Math.max(0, Number(it.qty || 1));
      var rate = (it.customRate !== undefined && it.customRate !== null && it.customRate !== '')
        ? Number(it.customRate)
        : Math.max(0, Number(it.rate || 0));
      var amt = it.amount !== undefined ? Number(it.amount) : Math.round(qty * rate);
      addonsTotal += amt;
    });
    var appliancesTotal = 0;
    appliances.forEach(function (ap) {
      var qty = Math.max(1, Number(ap.qty || 1));
      var amt = ap.amount !== undefined ? Number(ap.amount) : (Math.max(0, Number(ap.rate || 0)) * qty);
      appliancesTotal += amt;
    });
    return {
      selectedAddons: items,
      appliancesList: appliances,
      addonsSubtotal: addonsTotal,
      appliancesSubtotal: appliancesTotal,
      grandAddonsTotal: addonsTotal + appliancesTotal
    };
  }

  return {
    SFT_FACTOR: SFT_FACTOR,
    SQM_FACTOR: SQM_FACTOR,
    SURABHI_DESIGN_FEE_SLABS: SURABHI_DESIGN_FEE_SLABS,
    getSurabhiDesignFeeSlab: getSurabhiDesignFeeSlab,
    COOKSCAPE_ADDONS_CATALOG: COOKSCAPE_ADDONS_CATALOG,
    getCookscapeAddonsCatalog: getCookscapeAddonsCatalog,
    calculateAddonsSummary: calculateAddonsSummary,
    uid: uid,
    Vec2: Vec2,
    DEFAULT_RATE_CARD: DEFAULT_RATE_CARD,
    FURNITURE_CATALOG: FURNITURE_CATALOG,
    createProject: createProject,
    createWall: createWall,
    createRoomDivider: createRoomDivider,
    createOpening: createOpening,
    createRoom: createRoom,
    createFurniturePlacement: createFurniturePlacement,
    updateUnitNameForWidth: updateUnitNameForWidth,
    autoSplitWallAtJunctions: autoSplitWallAtJunctions,
    createStaircasePlacement: createStaircasePlacement,
    getStaircasePolygon: getStaircasePolygon,
    wallLength: wallLength,
    wallAngle: wallAngle,
    wallDirection: wallDirection,
    wallNormal: wallNormal,
    wallPolygon: wallPolygon,
    projectPointToSegment: Vec2.projectOnSegment,
    projectPointOnSegment: projectPointOnSegment,
    getWallInnerLength: getWallInnerLength,
    getWallInnerSegment: getWallInnerSegment,
    setWallInnerLength: setWallInnerLength,
    splitWall: splitWall,
    subdivideWalls: subdivideWalls,
    detectRooms: detectRooms,
    pruneOrphanDividers: pruneOrphanDividers,
    cleanPolygon: Vec2.cleanPolygon,
    interiorVisualCenter: Vec2.interiorVisualCenter,
    calculateItemCost: calculateItemCost,
    calculateItemPricing: calculateItemCost,
    generateFullQuotation: generateFullQuotation,
    lockQuotationVersion: lockQuotationVersion,
    serializeProject: serializeProject,
    deserializeProject: deserializeProject,
    PRICE_TIERS: PRICE_TIERS,
    normalizeTierName: normalizeTierName,
    TIER_SPECIFICATIONS: TIER_SPECIFICATIONS,
    getTierSpecifications: getTierSpecifications,
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
    sanitizeIconId: sanitizeIconId,
    registerDecorsCatalog: registerDecorsCatalog,
    healCollinearWalls: healCollinearWalls,
    formatFeetInches: formatFeetInches,
    toValidHexColor: toValidHexColor
  };
});
