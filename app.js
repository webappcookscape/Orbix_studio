/* ═══════════════════════════════════════════════════════════════
   CUPBOARD CAD — configure cupboards, output a factory process sheet
   All dimensions in mm.  SFT = H × W × Qty / 92903.
   Board sheets = ceil(area / 32)  — no wastage allowance.
   ═══════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  /* ───────────────────────────────────────────────────────────────
     LAMINATE LIBRARY — demo data. Replace with the real codes and
     colours, or add them live from the "Add a laminate" panel.
     kind: "wood" | "solid" | "gloss"
     ─────────────────────────────────────────────────────────────── */
  var LAMINATES = [
    { code: "MDF 1135", name: "White", hex: "#EDEBE4", kind: "solid", rate: 52 },
    { code: "MDF 3410", name: "Walnut", hex: "#6E4E35", kind: "wood", rate: 58 },
    { code: "MDF 3411", name: "Wenge", hex: "#4A3A2E", kind: "wood", rate: 58 },
    { code: "MDF 1101", name: "Ivory", hex: "#E4DCC8", kind: "solid", rate: 52 },
    { code: "MDF 2204", name: "Sonoma Oak", hex: "#C4A173", kind: "wood", rate: 56 },
    { code: "MDF 2210", name: "Teak", hex: "#A9743F", kind: "wood", rate: 56 },
    { code: "MDF 4402", name: "Grey Oak", hex: "#9C9891", kind: "wood", rate: 56 },
    { code: "MDF 5501", name: "Graphite", hex: "#585B5E", kind: "solid", rate: 54 },
    { code: "MDF 6601", name: "Gloss White", hex: "#F4F3EF", kind: "gloss", rate: 95 },
    { code: "MDF 6620", name: "Gloss Grey", hex: "#8D9296", kind: "gloss", rate: 95 },
    { code: "MDF 6630", name: "Gloss Red", hex: "#B2231F", kind: "gloss", rate: 98 },
    { code: "MDF 6640", name: "Gloss Black", hex: "#1C1C1E", kind: "gloss", rate: 98 },
    { code: "MDF 6650", name: "Gloss Cream", hex: "#EFE6D2", kind: "gloss", rate: 95 },
    { code: "MDF 7701", name: "Sage Green matte", hex: "#8E9C86", kind: "solid", rate: 64 },
    { code: "MDF 7702", name: "Charcoal matte", hex: "#3B3D40", kind: "solid", rate: 64 },
    { code: "MDF 7703", name: "Sand Beige matte", hex: "#D3C4A9", kind: "solid", rate: 64 },
    { code: "MDF 7704", name: "Taupe Grey", hex: "#9A9188", kind: "solid", rate: 64 },
    { code: "MDF 7705", name: "Macchiato", hex: "#B79C7C", kind: "solid", rate: 64 },
    { code: "MDF 7706", name: "Coffee Brown", hex: "#5A4232", kind: "solid", rate: 64 },
    { code: "MDF 7707", name: "Navy Blue matte", hex: "#2E3F5C", kind: "solid", rate: 64 },
    { code: "MDF 7708", name: "Terracotta", hex: "#B5654A", kind: "solid", rate: 64 },
    { code: "MDF 7709", name: "Olive", hex: "#6B6E45", kind: "solid", rate: 64 },
    { code: "MDF 2220", name: "Light Oak", hex: "#D9BE97", kind: "wood", rate: 56 },
    { code: "MDF 2230", name: "Ash Grey wood", hex: "#B4AA9C", kind: "wood", rate: 56 },
    { code: "MDF 2240", name: "Natural Teak veneer", hex: "#B8834E", kind: "wood", rate: 72 },
    { code: "MDF 3420", name: "Dark Walnut", hex: "#54382A", kind: "wood", rate: 58 },
    { code: "MDF 8801", name: "Concrete look", hex: "#A8A5A0", kind: "solid", rate: 70 },
    { code: "MDF 8802", name: "Stone Beige look", hex: "#CFC3B0", kind: "solid", rate: 70 },
    { code: "MDF 7710", name: "Powder Blue matte", hex: "#A9BED2", kind: "solid", rate: 64 },
    { code: "MDF 7711", name: "Blush matte", hex: "#D9B4A6", kind: "solid", rate: 64 },
    { code: "MDF 6660", name: "Gloss Sage", hex: "#9FB29A", kind: "gloss", rate: 95 }
  ];
  window.LAMINATES = LAMINATES;
  /* grain-locked materials cannot be rotated when nesting */
  function hasGrain(l) { return l.kind === "wood"; }

  /* Hardware price list — seeded from published Indian trade rates,
     editable on the Quote tab. */
  var HARDWARE = {
    hinge: { label: "Soft-close hinge", rate: 240, unit: "nos" },
    runner: { label: "Telescopic channel (pair)", rate: 700, unit: "set" },
    rod: { label: "Wardrobe rail + supports", rate: 1007, unit: "nos" },
    pin: { label: "Shelf pin", rate: 4, unit: "nos" },
    lock: { label: "Wardrobe lock", rate: 180, unit: "nos" }
  };

  /* ───────────────────────────────────────────────────────────────
     HANDLE LIBRARY
     unit "pc"  → charged per piece
     unit "rft" → continuous profile, charged per running foot
     ─────────────────────────────────────────────────────────────── */
  var HANDLES = [
    { id: 'pull', label: 'Pull Handle', kind: 'bar', len: 200, unit: 'pc', rate: 180 },
    { id: 'ibh10', label: 'IBH 10"', kind: 'ibh', len: 254, unit: 'pc', rate: 320 },
    { id: 'ibh8', label: 'IBH 8"', kind: 'ibh', len: 203, unit: 'pc', rate: 295 },
    { id: 'bar224', label: 'Bar 224', kind: 'bar', len: 224, unit: 'pc', rate: 180 },
    { id: 'bar128', label: 'Bar 128', kind: 'bar', len: 128, unit: 'pc', rate: 140 },
    { id: 'bar320', label: 'Bar 320', kind: 'bar', len: 320, unit: 'pc', rate: 220 },
    { id: 'bar96', label: 'Bar 96', kind: 'bar', len: 96, unit: 'pc', rate: 120 },
    { id: 'tbar', label: 'T-bar', kind: 'tbar', len: 40, unit: 'pc', rate: 90 },
    { id: 'knob', label: 'Round Knob', kind: 'knob', len: 32, unit: 'pc', rate: 60 },
    { id: 'ring', label: 'Ring Pull', kind: 'ring', len: 40, unit: 'pc', rate: 95 },
    { id: 'cup', label: 'Cup Pull', kind: 'cup', len: 96, unit: 'pc', rate: 110 },
    { id: 'edge', label: 'Edge Pull', kind: 'edge', len: 160, unit: 'pc', rate: 150 },
    { id: 'recess', label: 'Recessed Grip', kind: 'recess', len: 120, unit: 'pc', rate: 80 },
    { id: 'gprof', label: 'G Profile', kind: 'g', unit: 'rft', rate: 210 },
    { id: 'jprof', label: 'J Profile', kind: 'j', unit: 'rft', rate: 190 },
    { id: 'gola', label: 'Gola Profile', kind: 'gola', unit: 'rft', rate: 260 },
    { id: 'none', label: 'Handleless', kind: 'none', unit: 'pc', rate: 0 }
  ];
  function H(id) { for (var i = 0; i < HANDLES.length; i++) if (HANDLES[i].id === id) return HANDLES[i]; return HANDLES[0]; }
  var HFINISH = [{ id: "chrome", label: "Chrome" }, { id: "nickel", label: "Satin nickel" }, { id: "brass", label: "Brass" }, { id: "black", label: "Matte black" }];

  var RATES = {
    cut: 3.50, eb: 20.00, frame: 275, ebSize: "2mm", ebMode: "all",
    sheetW: 2440, sheetH: 1220, kerf: 4, trim: 0, margin: 18
  };

  /* ══════════ HELPERS ══════════ */
  function $(s, r) { return (r || document).querySelector(s); }
  function $all(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function el(cls, parent, tag) {
    var d = document.createElement(tag || "div");
    if (cls) d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }
  function num(v, f) { v = parseFloat(v); return isFinite(v) ? v : f; }
  function c8(v) { return v < 0 ? 0 : v > 255 ? 255 : v; }
  function hex2rgb(h) {
    h = String(h).replace("#", "");
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    return [parseInt(h.slice(0, 2), 16) || 0, parseInt(h.slice(2, 4), 16) || 0, parseInt(h.slice(4, 6), 16) || 0];
  }
  function shadeRGB(rgb, d) { return "rgb(" + c8(rgb[0] + 255 * d) + "," + c8(rgb[1] + 255 * d) + "," + c8(rgb[2] + 255 * d) + ")"; }
  function hashStr(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; var t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  function sft(h, w, q) { return h * w * (q || 1) / 92903; }
  function f2(n) { return (Math.round(n * 100) / 100).toFixed(2); }
  function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function toast(m) {
    var t = $("#toast"); if (!t) return;
    t.textContent = m; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(function () { t.classList.remove("show"); }, 2400);
  }
  function lam(code) {
    if (!code) return LAMINATES[0];
    var c = String(code).trim();
    var cLower = c.toLowerCase();
    // 1. Exact match on code
    for (var i = 0; i < LAMINATES.length; i++) {
      if (LAMINATES[i].code === c || LAMINATES[i].code.toLowerCase() === cLower) return LAMINATES[i];
    }
    // 2. Exact match on name
    for (var i = 0; i < LAMINATES.length; i++) {
      if (LAMINATES[i].name.toLowerCase() === cLower) return LAMINATES[i];
    }
    // 2b. Match on hex color code
    for (var i = 0; i < LAMINATES.length; i++) {
      if (LAMINATES[i].hex && (LAMINATES[i].hex === c || LAMINATES[i].hex.toLowerCase() === cLower)) return LAMINATES[i];
    }
    // 3. Keyword / alias mapping for imported & catalog finish names
    if (cLower.indexOf('walnut') !== -1) {
      for (var i = 0; i < LAMINATES.length; i++) if (LAMINATES[i].code === 'MDF 3410' || LAMINATES[i].name.toLowerCase().indexOf('walnut') !== -1) return LAMINATES[i];
    }
    if (cLower.indexOf('white') !== -1 || cLower.indexOf('bw_') !== -1 || cLower.indexOf('hdhmr') !== -1 || cLower.indexOf('bwp') !== -1) {
      for (var i = 0; i < LAMINATES.length; i++) if (LAMINATES[i].code === 'MDF 1135') return LAMINATES[i];
    }
    if (cLower.indexOf('gloss') !== -1) {
      for (var i = 0; i < LAMINATES.length; i++) if (LAMINATES[i].code === 'MDF 6601' || LAMINATES[i].kind === 'gloss') return LAMINATES[i];
    }
    if (cLower.indexOf('sage') !== -1) {
      for (var i = 0; i < LAMINATES.length; i++) if (LAMINATES[i].code === 'MDF 7701') return LAMINATES[i];
    }
    if (cLower.indexOf('oak') !== -1) {
      for (var i = 0; i < LAMINATES.length; i++) if (LAMINATES[i].code === 'MDF 2204') return LAMINATES[i];
    }
    if (cLower.indexOf('wenge') !== -1 || cLower.indexOf('dark') !== -1) {
      for (var i = 0; i < LAMINATES.length; i++) if (LAMINATES[i].code === 'MDF 3411') return LAMINATES[i];
    }
    if (cLower.indexOf('concrete') !== -1) {
      for (var i = 0; i < LAMINATES.length; i++) if (LAMINATES[i].code === 'MDF 5501' || LAMINATES[i].code === 'MDF 8801') return LAMINATES[i];
    }
    if (cLower.indexOf('teak') !== -1) {
      for (var i = 0; i < LAMINATES.length; i++) if (LAMINATES[i].code === 'MDF 2210') return LAMINATES[i];
    }
    return LAMINATES[0];
  }

  /* ══════════ TEXTURES ══════════
     One shared noise tile is built once and stamped as a pattern, so a
     laminate texture costs a few milliseconds instead of a per-pixel
     loop per colour — the page paints immediately.                    */
  var noiseTile = null;
  function getNoise() {
    if (noiseTile) return noiseTile;
    var N = 64, c = document.createElement("canvas");
    c.width = N; c.height = N;
    var g = c.getContext("2d"), img = g.createImageData(N, N), d = img.data, rnd = mulberry(12345);
    for (var i = 0; i < d.length; i += 4) {
      var v = 128 + (rnd() - 0.5) * 54;
      d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 26;
    }
    g.putImageData(img, 0, 0);
    noiseTile = c;
    return c;
  }
  var texCache = {}, texHex = {}, texCanvas = {};
  function tex(l, size) {
    size = size || 288;
    var key = l.code + "|" + l.hex + "|" + l.kind + "|" + size;
    if (texCache[key]) return texCache[key];
    var S = size, c = document.createElement("canvas");
    c.width = S; c.height = S;
    var g = c.getContext("2d"), rgb = hex2rgb(l.hex), rnd = mulberry(hashStr(l.code + l.hex));
    g.fillStyle = l.hex; g.fillRect(0, 0, S, S);

    if (l.kind === "wood") {
      var F = Math.PI * 2 * 3 / S;                       /* periodic in y → seamless */
      var bands = 9, lines = Math.round(Math.min(S, 640) * 0.62);
      /* broad tonal drift — a real leaf is never one flat colour */
      for (var d = 0; d < 3; d++) {
        var dx = rnd() * S, dw = S * 0.35 + rnd() * S * 0.4, dt = shadeRGB(rgb, (rnd() - 0.5) * 0.06);
        for (var dp = -1; dp <= 1; dp++) {
          var gd = g.createLinearGradient(dx + dp * S, 0, dx + dw + dp * S, 0);
          gd.addColorStop(0, "rgba(0,0,0,0)"); gd.addColorStop(.5, dt); gd.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gd; g.fillRect(dx + dp * S, 0, dw, S);
        }
      }
      /* tonal bands: soft-edged, and they wander slightly as they run — straight
         bands are what makes a render look printed. Fade at both edges so the
         tile never shows a hard seam when it repeats */
      for (var b = 0; b < bands; b++) {
        var bx = rnd() * S, bw = S * 0.06 + rnd() * S * 0.2, bamp = S * (0.0015 + rnd() * 0.0035), bph = rnd() * 7;
        var tone = shadeRGB(rgb, (rnd() - 0.5) * 0.11);
        for (var wp = -1; wp <= 1; wp++) {
          var gx = g.createLinearGradient(bx + wp * S, 0, bx + bw + wp * S, 0);
          gx.addColorStop(0, "rgba(0,0,0,0)"); gx.addColorStop(.5, tone); gx.addColorStop(1, "rgba(0,0,0,0)");
          g.fillStyle = gx;
          for (var sy = 0; sy < S; sy += 6) {
            g.save(); g.translate(Math.sin(sy * F + bph) * bamp, 0); g.fillRect(bx + wp * S, sy, bw, 7); g.restore();
          }
        }
      }
      for (var i = 0; i < lines; i++) {
        var px = rnd() * S, amp = 1.2 + rnd() * 3.5, ph = rnd() * 7, dark = rnd() < 0.6;
        g.strokeStyle = dark
          ? "rgba(0,0,0," + (0.02 + rnd() * 0.06).toFixed(3) + ")"
          : "rgba(255,255,255," + (0.015 + rnd() * 0.045).toFixed(3) + ")";
        g.lineWidth = 0.5 + rnd() * 2.4;
        for (var pass = 0; pass < 2; pass++) {
          var ox = pass ? (px > S / 2 ? -S : S) : 0;
          if (pass && px > amp + 2 && px < S - amp - 2) continue;
          g.beginPath(); g.moveTo(px + ox, 0);
          for (var y = 0; y <= S; y += 8) g.lineTo(px + ox + Math.sin(y * F + ph) * amp, y);
          g.stroke();
        }
      }
      /* fine pore speckle — the thing that separates print from laminate */
      var pores = Math.round(Math.min(S * S, 640 * 640) * 0.006);
      for (var q = 0; q < pores; q++) {
        var qx = rnd() * S, qy = rnd() * S, ql = 1 + rnd() * 5;
        g.strokeStyle = "rgba(0,0,0," + (0.05 + rnd() * 0.09).toFixed(3) + ")";
        g.lineWidth = 0.7;
        g.beginPath(); g.moveTo(qx, qy); g.lineTo(qx + (rnd() - 0.5) * 0.8, qy + ql); g.stroke();
      }
    } else if (l.kind === "gloss") {
      for (var s = 0; s < 4; s++) {
        var sy = rnd() * S, gr = g.createLinearGradient(0, sy - S * 0.15, 0, sy + S * 0.15);
        gr.addColorStop(0, "rgba(255,255,255,0)");
        gr.addColorStop(.5, "rgba(255,255,255,.10)");
        gr.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = gr; g.fillRect(0, sy - S * 0.15, S, S * 0.3);
      }
    }
    var pat = g.createPattern(getNoise(), "repeat");
    if (pat) {
      g.globalAlpha = l.kind === "gloss" ? 0.35 : l.kind === "wood" ? 0.9 : 0.55;
      g.fillStyle = pat; g.fillRect(0, 0, S, S);
      g.globalAlpha = 1;
    }
    texCanvas[key] = c;
    var url = c.toDataURL("image/jpeg", 0.86);
    texCache[key] = url; texHex[url] = l.hex;
    return url;
  }

  /* ══════════ STATE ══════════ */
  function newUnit(label) {
    return {
      label: label || "MBR",
      ctype: "wardrobe", elev: 0, drawEvery: false, counter: "black", hfinish: "chrome", dstyle: "slab", paint: "#5B6E7A",
      shape: "straight", W2: 1200,
      H: 2100, W: 1800, D: 600, T: 18,
      type: "hinged", shutters: 3, sections: 2, shelves: 4,
      drawers: 2, drawerH: 180,
      loft: true, loftH: 600, loftShutters: 3,
      back: 18, handle: "ibh10",
      carcass: "MDF 1135", shutterCol: "MDF 3410"
    };
  }
  var S = {
    units: [],
    active: 0,
    head: { dealer: "", place: "", dorder: "", cust: "", proc: "", order: "", date: "", sticker: "", supply: "MDF Boards Provided by Party" },
    frames: { h: 2400, w: 65, q: 10, col: "White", rate: 275 }
  };
  window.S = S;
  function U() { return (S.units && S.units.length && S.active < S.units.length && S.active >= 0) ? S.units[S.active] : null; }
  window.U = U;
  function save() {
    try { localStorage.setItem("cupboard-cad", JSON.stringify({ units: S.units, head: S.head, frames: S.frames, rates: RATES, lam: LAMINATES, imported: S.imported || null })); } catch (e) { }
  }
  function load() {
    try {
      var raw = localStorage.getItem("cupboard-cad"); if (!raw) return;
      var d = JSON.parse(raw);
      if (d.units && Array.isArray(d.units)) {
        var planObj = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
        while (planObj && planObj.plan && (planObj.plan.furniture || planObj.plan.walls || planObj.plan.rooms)) planObj = planObj.plan;
        if (planObj && planObj.furniture && planObj.furniture.length > 0) {
          var validIds = planObj.furniture.map(function (f) { return f.id; });
          S.units = d.units.filter(function (u) { return u._furnId && validIds.indexOf(u._furnId) !== -1; });
        } else {
          S.units = [];
        }
      }
      if (d.head) S.head = d.head;
      if (d.frames) S.frames = d.frames;
      if (d.rates) for (var k in d.rates) if (k in RATES) RATES[k] = d.rates[k];
      if (d.lam && d.lam.length) {
        var merged = LAMINATES.slice();
        d.lam.forEach(function (l) {
          var b = merged.filter(function (m) { return m.code === l.code; })[0];
          if (!b) merged.push(l); else if (l.rate) b.rate = l.rate;
        });
        LAMINATES = merged;
        window.LAMINATES = LAMINATES;
      }
      if (d.imported) S.imported = d.imported;
      S.units.forEach(function (u) { if (!H(u.handle)) u.handle = "ibh10"; });
    } catch (e) { }
  }

  /* ══════════ EDGE BANDING RULES ══════════
     long = number of long (Height-column) edges banded
     short = number of short (Width-column) edges banded          */
  function ebRule(remark) {
    if (/Glass|Mirror|Counter|Cane|Reeded|Steel|Tile|Appliance/i.test(remark)) return { code: "—", long: 0, short: 0 };
    if (RATES.ebMode === "all") return { code: "4S", long: 2, short: 2 };
    if (/Back Panel/.test(remark)) return { code: "—", long: 0, short: 0 };
    if (/Shutter|Facia/.test(remark)) return { code: "4S", long: 2, short: 2 };
    if (/Shelf/.test(remark)) return { code: "1L", long: 1, short: 0 };
    if (/VP/.test(remark)) return { code: "1L", long: 1, short: 0 };
    if (/Dummy/.test(remark)) return { code: "1L", long: 1, short: 0 };
    return { code: "1L", long: 1, short: 0 };        /* carcass panels: front edge */
  }
  function ebFt(r) {
    var e = ebRule(r.r);
    return (e.long * r.h + e.short * r.w) * r.q / 304.8;
  }

  /* ══════════ PANEL GENERATION ══════════ */
  /* An L-corner unit is two straight runs meeting at a corner post.
     Everything downstream (sheet, nesting, drilling, quote) just sees
     the runs, so a corner costs exactly what its panels cost. */
  function runsOf(u) {
    if (u.ctype === "kitchen") { var us = []; kitchenRuns(u).forEach(function (run) { kitchenPieces(u, run).pieces.forEach(function (p) { us.push(p.unit); }); }); return us; }
    if (u.ctype === "tv") return tvPieces(u).map(function (p) { return p.unit; });
    if (u.ctype === "crockery") return crPieces(u).map(function (p) { return p.unit; });
    if (u.ctype === "dresser") return drPieces(u).map(function (p) { return p.unit; });
    if (u.kind === "imported" || u.shape !== "lcorner") return [u];
    var b = JSON.parse(JSON.stringify(u));
    b.shape = "straight"; b.W = Math.max(400, u.W2 || 1200); b.label = (u.label || "UNIT") + " B"; b._runB = true;
    return [u, b];
  }
  function panelsFor(u) {
    if (u.ctype === "kitchen") return kitchenPanels(u);
    if (u.ctype === "tv") return tvPanels(u);
    if (u.ctype === "crockery") return crockeryPanels(u);
    if (u.ctype === "dresser") return dresserPanels(u);
    if (u.kind === "imported") return u.rows.map(function (r) { return { h: r.h, w: r.w, q: r.q, r: r.r, d: r.d || "", col: r.col, nb: !!r.nb }; });
    if (u.shape === "lcorner") {
      var runs = runsOf(u), rows = panelsForRun(runs[0]);
      panelsForRun(runs[1]).forEach(function (r) { r.r = "B · " + r.r; rows.push(r); });
      rows.push({ h: u.H + (u.loft ? u.loftH + 2 : 0), w: 100, q: 1, r: "Corner Post", d: "", col: u.carcass });
      return rows;
    }
    return panelsForRun(u);
  }
  function panelsForRun(u) {
    var T = u.T, rows = [], CC = u.carcass, SC = u.shutterCol, hd = H(u.handle);
    var dcode = hd.kind === "none" ? "" : hd.label;
    function add(h, w, q, r, d, col) {
      h = Math.round(h); w = Math.round(w);
      if (q <= 0 || h <= 0 || w <= 0) return;
      rows.push({ h: h, w: w, q: q, r: r, d: d || "", col: col });
    }
    var iw = u.W - 2 * T, ih = u.H - 2 * T;
    var vp = Math.max(0, u.sections - 1);
    var secW = (iw - vp * T) / u.sections;
    var shD = Math.max(180, u.D - 103);

    add(u.H, u.D, 1, "Left Panel", "", CC);
    add(u.H, u.D, 1, "Right Panel", "", CC);
    add(iw, u.D, 1, "Top panel", "", CC);
    add(iw, u.D, 1, "Bottom Panel", "", CC);
    if (vp) add(ih, shD, vp, "VP", "", CC);
    add(ih, iw, 1, (u.back === 18 ? "18mm" : "6mm") + " Back Panel", "", CC);
    if (u.shelves > 0) add(secW, shD, u.shelves * u.sections, "ADJ Shelf", "", CC);
    var open = isOpen(u), ct = u.ctype || "wardrobe";
    var drSecs = u.drawEvery ? u.sections : 1;
    if (u.drawers > 0) add(u.drawerH, secW, u.drawers * drSecs, "Draw Facia", open ? "" : dcode, SC);

    var SC2 = u.shutterCol2 || null, dcodeS = u.hgrain ? dcode + " · H grain" : dcode, dsA = u.dstyle || "slab";
    function aluRows(h, w, q, label) {
      rows.push({ h: Math.round(h), w: Math.round(w), q: q, r: label + " — aluminium profile frame", d: "", col: (u.frameFin || "black") + " anodised", nb: true });
      rows.push({ h: Math.round(h - 40), w: Math.round(w - 40), q: q, r: label + " — glass 5mm " + (u.glassTint || "fluted"), d: "", col: "Glass", nb: true });
    }
    if (!open && !u.noDoors) {
      if (u.type === "sliding") {
        if (dsA === "aluglass") aluRows(u.H - 55, u.W / 2 + 25, 2, "Sliding shutter");
        else if (SC2) { add(u.H - 55, u.W / 2 + 25, 1, "Sliding Shutter", dcodeS, SC); add(u.H - 55, u.W / 2 + 25, 1, "Sliding Shutter", dcodeS, SC2); }
        else add(u.H - 55, u.W / 2 + 25, 2, "Sliding Shutter", dcodeS, SC);
      } else {
        var ds0 = u.dstyle || "slab", gw0 = (u.W - (u.shutters + 1) * 3) / u.shutters, nS = u.shutters;
        if (ds0 === "aluglass") aluRows(u.H - 6, gw0, nS, "Shutter");
        else if (/shaker|raised|glass|cane|louvered|leather/.test(ds0)) {
          add(u.H - 6, 70, nS * 2, "Door Stile", dcode, SC);
          add(gw0 - 140, 70, nS * 2, "Door Rail", "", SC);
          if (ds0 === "shaker") add(u.H - 6 - 120, gw0 - 120, nS, "Door Panel", "", SC);
          if (ds0 === "raised") add(u.H - 6 - 156, gw0 - 156, nS, "Raised Panel", "", SC);
          if (ds0 === "glass") rows.push({ h: Math.round(u.H - 6 - 140), w: Math.round(gw0 - 140), q: nS, r: "Glass Pane 5mm", d: "", col: "Glass", nb: true });
          if (ds0 === "cane") rows.push({ h: Math.round(u.H - 6 - 120), w: Math.round(gw0 - 120), q: nS, r: "Cane Panel", d: "", col: "Cane", nb: true });
          if (ds0 === "louvered") add(gw0 - 144, 38, nS * Math.floor((u.H - 6 - 156) / 44), "Louver Slat", "", SC);
          if (ds0 === "leather") rows.push({ h: Math.round(u.H - 6 - 120), w: Math.round(gw0 - 120), q: nS, r: "Leather Panel (upholstered)", d: "", col: "Leather " + (u.leatherHex || "#4A3626"), nb: true });
        } else if (ds0 === "steel") {
          rows.push({ h: u.H - 6, w: Math.round(gw0), q: nS, r: "Steel Shutter 0.8mm", d: dcode, col: "CRCA Steel", nb: true });
        } else {
          if (SC2) { add(u.H - 6, gw0, Math.ceil(nS / 2), "Shutter", dcodeS, SC); if (Math.floor(nS / 2)) add(u.H - 6, gw0, Math.floor(nS / 2), "Shutter", dcodeS, SC2); }
          else add(u.H - 6, gw0, nS, "Shutter", dcodeS, SC);
          if (ds0 === "mirror") rows.push({ h: u.H - 46, w: Math.round(gw0 - 40), q: nS, r: "Mirror 5mm", d: "", col: "Mirror", nb: true });
          if (ds0 === "fluted") rows.push({ h: u.H - 42, w: Math.round(gw0 - 30), q: nS, r: "Reeded Overlay", d: "", col: "Fluted MDF", nb: true });
        }
      }
    }

    add(u.W, 100, 1, "Dummy", "", CC);
    add(u.W, 75, 2, "Dummy", "", CC);
    add(u.H, 65, 2, "Dummy", "", CC);

    if (u.loft) {
      var lih = u.loftH - 2 * T, ln = Math.max(1, u.loftShutters);
      add(u.loftH, u.D, 2, "Loft Side Panel", "", CC);
      add(iw, u.D, 2, "Loft Top / Bottom", "", CC);
      if (vp) add(lih, shD, vp, "Loft VP", "", CC);
      add(lih, iw, 1, "Loft Back Panel", "", CC);
      if (!open) {
        var lwS = (u.W - (ln + 1) * 3) / ln;
        if (dsA === "aluglass") aluRows(u.loftH - 6, lwS, ln, "Loft shutter");
        else if (SC2) { add(u.loftH - 6, lwS, Math.ceil(ln / 2), "Loft Shutter", dcodeS, SC); if (Math.floor(ln / 2)) add(u.loftH - 6, lwS, Math.floor(ln / 2), "Loft Shutter", dcodeS, SC2); }
        else add(u.loftH - 6, lwS, ln, "Loft Shutter", dcodeS, SC);
      }
    }
    if (ct === "kbase") {
      add(u.W - 2 * T, Math.max(60, u.elev || 100), 1, "Kick Board", "", CC);
      rows.push({ h: u.W + 30, w: u.D + 30, q: 1, r: "Counter — stone vendor", d: "", col: (COUNTERS.filter(function (c) { return c.id === (u.counter || "black"); })[0] || COUNTERS[0]).label, nb: true });
    }
    if (ct === "dresser") rows.push({ h: 640, w: Math.round(u.W * 0.5), q: 1, r: "Mirror 5mm", d: "", col: "Mirror", nb: true });
    return rows;
  }
  /* handle quantity: pieces, or running feet for continuous profiles */
  function handleQty(u) {
    var hd = H(u.handle);
    if (/^(kitchen|tv|crockery|dresser)$/.test(u.ctype || "")) { var sq = 0; runsOf(u).forEach(function (r) { sq += handleQty(r); }); return sq; }
    if (u.kind === "imported" || hd.kind === "none" || u.shape === "walkin") return 0;
    if (u.shape === "lcorner") { var rs = runsOf(u); return handleQty(rs[0].shape === "lcorner" ? Object.assign({}, rs[0], { shape: "straight" }) : rs[0]) + handleQty(rs[1]); }
    var shutters = u.type === "sliding" ? 2 : u.shutters;
    var loftS = u.loft ? Math.max(1, u.loftShutters) : 0;
    var pieces = shutters + loftS + u.drawers;
    if (hd.unit === "rft") {
      var w = u.type === "sliding" ? (u.W / 2 + 25) : (u.W - (u.shutters + 1) * 3) / u.shutters;
      var lw = u.loft ? (u.W - (loftS + 1) * 3) / loftS : 0;
      return (w * shutters + lw * loftS + ((u.W - 2 * u.T) / u.sections) * u.drawers) / 304.8;
    }
    return pieces;
  }
  function allTotals() {
    var t = { sft: 0, qty: 0, cutRft: 0, ebRft: 0, byCol: {}, handles: {} };
    S.units.forEach(function (u) {
      panelsFor(u).forEach(function (r) {
        t.sft += sft(r.h, r.w, r.q);
        t.qty += r.q;
        if (r.nb) return;
        t.cutRft += 2 * (r.h + r.w) * r.q / 304.8;
        t.ebRft += ebFt(r);
        t.byCol[r.col] = (t.byCol[r.col] || 0) + sft(r.h, r.w, r.q);
      });
      var hd = H(u.handle);
      if (u.kind === "imported") {
        u.rows.forEach(function (r) {
          var hh = handleFromDesign(r.d); if (!hh) return;
          if (!t.handles[hh.id]) t.handles[hh.id] = { h: hh, q: 0 };
          t.handles[hh.id].q += r.q;
        });
      } else if (hd.kind !== "none") {
        var q = handleQty(u);
        if (!t.handles[hd.id]) t.handles[hd.id] = { h: hd, q: 0 };
        t.handles[hd.id].q += q;
      }
    });
    return t;
  }
  function handleFromDesign(d) {
    if (!d) return null;
    var m = String(d).match(/(\d+)\s*"?\s*IBH|IBH\s*(\d+)/i);
    if (m) { var n = m[1] || m[2]; return H(n === "8" ? "ibh8" : "ibh10"); }
    if (/gola/i.test(d)) return H("gola");
    if (/g\s*profile/i.test(d)) return H("gprof");
    if (/j\s*profile/i.test(d)) return H("jprof");
    if (/knob/i.test(d)) return H("knob");
    if (/cup/i.test(d)) return H("cup");
    if (/t-?bar/i.test(d)) return H("tbar");
    if (/ring/i.test(d)) return H("ring");
    if (/edge/i.test(d)) return H("edge");
    if (/recess|finger/i.test(d)) return H("recess");
    if (/bar\s*320/i.test(d)) return H("bar320");
    if (/bar\s*224/i.test(d)) return H("bar224");
    if (/bar\s*96/i.test(d)) return H("bar96");
    if (/bar/i.test(d)) return H("bar128");
    return null;
  }

  /* ══════════ 3D ══════════
     One geometric description of a run (layoutRun / layoutImported) and
     two renderers: WebGL via three.js (primary — physically based
     laminate, real edge banding, shadows, reflections) and the CSS-3D
     fallback used only where WebGL is unavailable.                    */
  var world = $("#world"), stage = $("#stage");
  var cam = { yaw: -26, pitch: -7, zoom: 0 }, scale = 0.28, MID = 0;
  /* embed / cinematic flags — set from the URL before the renderer starts (see the boot block) */
  var EMBED = false, NEO = false, FX = false;   /* FX = post-processing (ambient occlusion + SMAA) */
  var GRAIN_W = 760, GRAIN_H = 1150;

  /* ── cupboard types ── */
  var CTYPES = [
    { id: "wardrobe", label: "Wardrobe · hinged", set: { type: "hinged", H: 2100, W: 1800, D: 600, shutters: 3, sections: 2, shelves: 4, drawers: 2, loft: true, loftH: 600, loftShutters: 3, elev: 0, drawEvery: false } },
    { id: "sliding", label: "Wardrobe · sliding", set: { type: "sliding", H: 2100, W: 2400, D: 650, shutters: 2, sections: 3, shelves: 4, drawers: 2, loft: true, loftH: 600, loftShutters: 4, elev: 0, drawEvery: false } },
    { id: "overhead", label: "Overhead / loft", set: { type: "hinged", H: 600, W: 1800, D: 450, shutters: 3, sections: 1, shelves: 0, drawers: 0, loft: false, elev: 1500, drawEvery: false } },
    { id: "kbase", label: "Kitchen base run", set: { type: "hinged", H: 720, W: 2400, D: 580, shutters: 4, sections: 4, shelves: 1, drawers: 3, loft: false, elev: 100, drawerH: 170, drawEvery: false } },
    { id: "kwall", label: "Kitchen wall run", set: { type: "hinged", H: 720, W: 2400, D: 350, shutters: 4, sections: 4, shelves: 1, drawers: 0, loft: false, elev: 1450, drawEvery: false } },
    { id: "tall", label: "Tall / pantry", set: { type: "hinged", H: 2100, W: 600, D: 600, shutters: 1, sections: 1, shelves: 5, drawers: 0, loft: false, elev: 0, drawEvery: false } },
    {
      id: "tv", label: "TV unit", set: {
        type: "hinged", H: 450, W: 1800, D: 450, shutters: 0, sections: 3, shelves: 0, drawers: 2, loft: false, elev: 0, drawerH: 200, drawEvery: false,
        tvConsole: "drawers", tvFloat: true, tvBack: "panel", tvBackH: 2400, tvSize: 55, tvShow: true, tvShelves: 0, tvTowers: "none", tvWall: false, tvLed: true, tvStone: "marble", tvBackCol: null
      }
    },
    {
      id: "crockery", label: "Crockery · glass", set: {
        type: "hinged", H: 2100, W: 1200, D: 450, shutters: 2, sections: 2, shelves: 3, drawers: 0, loft: false, elev: 0, drawEvery: false,
        crConfig: "hutch", crBase: "doors", crUpper: "aluglass", crUpperCol: null, crBack: "mirror", crTop: "stone", crLed: true, crGap: 300, crShelves: 2
      }
    },
    { id: "shoe", label: "Shoe rack", set: { type: "hinged", H: 1000, W: 900, D: 350, shutters: 2, sections: 1, shelves: 3, drawers: 0, loft: false, elev: 0, drawEvery: false } },
    {
      id: "dresser", label: "Dresser · mirror", set: {
        type: "hinged", H: 750, W: 1200, D: 450, shutters: 0, sections: 2, shelves: 0, drawers: 3, loft: false, elev: 0, drawerH: 210, drawEvery: true,
        drConfig: "floor", drBase: "drawers", drMirror: "arch", drMirrorW: 600, drLed: true, drBack: "none", drBackCol: null, drTop: "laminate", drTower: "none", drShelves: 0
      }
    },
    { id: "bookshelf", label: "Open shelving", set: { type: "hinged", H: 1800, W: 900, D: 300, shutters: 0, sections: 1, shelves: 5, drawers: 0, loft: false, elev: 0, drawEvery: false } },
    {
      id: "kitchen", label: "Modular kitchen", set: {
        type: "hinged", H: 720, W: 3000, D: 580, shutters: 5, sections: 5, shelves: 1, drawers: 3, loft: false, elev: 100, drawEvery: false,
        klayout: "straight", kA: 3000, kB: 2400, kC: 2400, kWall: true, kTall: true, kHob: true, kSink: true, kFridge: true
      }
    }
  ];
  /* ── door styles: how a front is built ── */
  var DSTYLES = [
    { id: "slab", label: "Slab · flat" },
    { id: "shaker", label: "Shaker · frame" },
    { id: "raised", label: "Raised panel" },
    { id: "grooved", label: "Grooved lines" },
    { id: "fluted", label: "Fluted / reeded" },
    { id: "louvered", label: "Louvered slats" },
    { id: "cane", label: "Cane / rattan" },
    { id: "glass", label: "Glass frame" },
    { id: "mirror", label: "Mirror front" },
    { id: "aluglass", label: "Aluminium profile · glass" },
    { id: "leather", label: "Leather panel" },
    { id: "steel", label: "Steel almirah" }
  ];
  var PAINTS = [{ id: "#5B6E7A", label: "Almirah grey" }, { id: "#2F5F86", label: "Godrej blue" }, { id: "#4E6B4B", label: "Bottle green" }, { id: "#D9CDB4", label: "Cream" }, { id: "#7A2E2E", label: "Maroon" }, { id: "#2B2B2B", label: "Black" }];
  function DS(id) { for (var i = 0; i < DSTYLES.length; i++) if (DSTYLES[i].id === id) return DSTYLES[i]; return DSTYLES[0]; }
  /* parts for one front of the given style; every part shares the door pivot */
  function frontParts(u, ds, cx, y, w, h, z, col, T, ctx) {
    var st = 70, P = [];
    var big = ctx !== "drawer" && w > 260 && h > 260;
    if (ds === "steel") {
      P.push({ x: cx, y: y, z: z, w: w, h: h, d: T, mat: "paint", paint: u.paint });
      if (big) P.push({ x: cx, y: y + 110, z: z + T / 2 + 2, w: w - 110, h: h - 220, d: 5, mat: "paint", paint: u.paint, emboss: true });
      return P;
    }
    if (!big || ds === "slab" || ds === "grooved" || (ctx === "slide" && /^(shaker|raised|louvered|cane|glass|mirror)$/.test(ds)) || (ctx === "drawer" && /^(fluted|louvered|cane|glass|mirror|aluglass|leather)$/.test(ds))) {
      var o = { x: cx, y: y, z: z, w: w, h: h, d: T, col: col, role: "front" };
      if (ds === "mirror") o.mirror = true;
      if (ds === "grooved") o.grooved = true;
      P.push(o);
      if (ds === "fluted" && big) {
        var n = Math.floor((w - 30) / 24), x0 = cx - (n - 1) * 12;
        for (var i = 0; i < n; i++) P.push({ shape: "cyl", r: 9, len: h - 36, x: x0 + i * 24, y: y + 18, z: z + T / 2 + 1, col: col, role: "front" });
      }
      return P;
    }
    if (ds === "aluglass") {
      /* the 2026 wardrobe: a slim anodised aluminium profile around fluted / smoked / frosted glass */
      var fw = 28, fin = (u.frameFin || "black") === "black" ? "alublack" : u.frameFin, tint = u.glassTint || "fluted";
      P.push({ x: cx - w / 2 + fw / 2, y: y, z: z, w: fw, h: h, d: T, mat: fin });
      P.push({ x: cx + w / 2 - fw / 2, y: y, z: z, w: fw, h: h, d: T, mat: fin });
      P.push({ x: cx, y: y + h - fw, z: z, w: w - 2 * fw, h: fw, d: T, mat: fin });
      P.push({ x: cx, y: y, z: z, w: w - 2 * fw, h: fw, d: T, mat: fin });
      P.push({ x: cx, y: y + fw - 3, z: z, w: w - 2 * fw + 6, h: h - 2 * fw + 6, d: 6, mat: "glass:" + tint });
      return P;
    }
    /* framed constructions */
    P.push({ x: cx - w / 2 + st / 2, y: y, z: z, w: st, h: h, d: T, col: col, role: "front" });
    P.push({ x: cx + w / 2 - st / 2, y: y, z: z, w: st, h: h, d: T, col: col, role: "front" });
    P.push({ x: cx, y: y + h - st, z: z, w: w - 2 * st, h: st, d: T, col: col, role: "flat" });
    P.push({ x: cx, y: y, z: z, w: w - 2 * st, h: st, d: T, col: col, role: "flat" });
    var iw = w - 2 * st, ih = h - 2 * st;
    if (ds === "shaker") P.push({ x: cx, y: y + st - 10, z: z - 5, w: iw + 20, h: ih + 20, d: T - 8, col: col, role: "back" });
    if (ds === "raised") P.push({ x: cx, y: y + st + 8, z: z + 2, w: iw - 16, h: ih - 16, d: T + 3, col: col, role: "front" });
    if (ds === "glass") P.push({ x: cx, y: y + st, z: z, w: iw, h: ih, d: 5, mat: "glass" });
    if (ds === "mirror") P.push({ x: cx, y: y + st - 10, z: z - 2, w: iw + 20, h: ih + 20, d: T - 4, col: col, role: "front", mirror: true });
    if (ds === "leather") P.push({ x: cx, y: y + st - 10, z: z + 2, w: iw + 20, h: ih + 20, d: T - 2, mat: "leather:" + (u.leatherHex || "#4A3626") });
    if (ds === "cane") P.push({ x: cx, y: y + st - 10, z: z - 4, w: iw + 20, h: ih + 20, d: 6, mat: "cane" });
    if (ds === "fluted") {
      P.push({ x: cx, y: y + st - 10, z: z - 5, w: iw + 20, h: ih + 20, d: T - 8, col: col, role: "back" });
      var nf = Math.floor((iw - 12) / 24), fx0 = cx - (nf - 1) * 12;
      for (var f = 0; f < nf; f++) P.push({ shape: "cyl", r: 9, len: ih - 8, x: fx0 + f * 24, y: y + st + 4, z: z - 1, col: col, role: "front" });
    }
    if (ds === "louvered") {
      var pitch = 44, n2 = Math.floor((ih - 16) / pitch);
      for (var s = 0; s < n2; s++) P.push({ x: cx, y: y + st + 8 + s * pitch, z: z - 2, w: iw - 4, h: 38, d: 8, rx: -38, col: col, role: "flat" });
    }
    return P;
  }

  function CT(id) { for (var i = 0; i < CTYPES.length; i++) if (CTYPES[i].id === id) return CTYPES[i]; return CTYPES[0]; }
  function applyType(u, id) {
    var t = CT(id); u.ctype = t.id;
    for (var k in t.set) u[k] = t.set[k];
    if (u.shutters < 1) u.shutters = 1;
    if (t.id !== "crockery" && u.dstyle === "glass") u.dstyle = "slab";
  }
  function isOpen(u) {
    var ct = u.ctype || "wardrobe";
    return u.shape === "walkin" || ct === "tv" || ct === "bookshelf" || ct === "dresser";
  }

  /* which thin faces of a panel carry PVC edge band (else raw core) */
  function ebEdges(role) {
    var all = RATES.ebMode === "all";
    var Z = { px: 0, nx: 0, py: 0, ny: 0, pz: 0, nz: 0 };
    if (role === "back") return Z;
    if (role === "front") return { px: 1, nx: 1, py: 1, ny: 1, pz: 0, nz: 0 };
    if (role === "side" || role === "vp") return all ? { px: 0, nx: 0, py: 1, ny: 1, pz: 1, nz: 1 } : { px: 0, nx: 0, py: 0, ny: 0, pz: 1, nz: 0 };
    if (role === "flat") return all ? { px: 1, nx: 1, py: 0, ny: 0, pz: 1, nz: 1 } : { px: 0, nx: 0, py: 0, ny: 0, pz: 1, nz: 0 };
    return Z;
  }

  var _uid = 0; function uid() { return "d" + (++_uid); }
  /* ── layout of one straight run ── */
  function layoutRun(u) {
    var T = u.T, ct = u.ctype || "wardrobe", open = isOpen(u), elev = u.elev || 0;
    var B = [], Hn = [], R = [], CC = u.carcass, SC = u.shutterCol, hd = H(u.handle), fin = u.hfinish || "chrome";
    var iw = u.W - 2 * T, ih = u.H - 2 * T, vp = Math.max(0, u.sections - 1), secW = (iw - vp * T) / u.sections, shD = Math.max(180, u.D - 103);
    var zF = u.D / 2 + T, ds = u.dstyle || "slab", fronts = [], drawers = [];
    function bx(o) {
      o.y = (o.y || 0) + elev;
      if (ds === "steel" && o.col && !o.mat) { o.mat = "paint"; o.paint = u.paint || "#5B6E7A"; delete o.col; }
      if (u.hgrain && o.role === "front" && o.col) o.hgrain = true;
      B.push(o); return o;
    }
    function hinged(cx, y, w, h, z, hl, parts) {
      /* one door: a pivot on the hinge edge shared by every part and its handle */
      var id = uid(), px = hl ? cx - w / 2 : cx + w / 2;
      var piv = { id: id, kind: "hinge", px: px, py: y + elev + h / 2, pz: z, sign: hl ? -1 : 1, angle: 1.75, covers: [cx - w / 2, cx + w / 2], yr: [y + elev, y + elev + h] };
      fronts.push(piv);
      (parts || [{ x: cx, y: y, z: z, w: w, h: h, d: T, col: SC, role: "front" }]).forEach(function (p) { p.door = piv; bx(p); });
      /* cup hinges: the arm swings with the door, the plate stays on the carcass */
      hingePositions(h).forEach(function (hp) {
        var hx = hl ? px + 34 : px - 34;
        bx({ x: hx, y: y + hp - 8, z: z - T / 2 - 24, w: 52, h: 16, d: 44, mat: "nickel", door: piv });
        bx({ x: hl ? px + 16 : px - 16, y: y + hp - 5, z: z - T / 2 - 52, w: 30, h: 10, d: 40, mat: "nickel" });
      });
      Hn.push({ cx: cx, y: y + elev, w: w, h: h, hl: hl, z: z + T / 2, hd: hd, fin: fin, door: piv });
      return piv;
    }
    if (!open) bx({ x: 0, y: 0, z: u.D / 2 - 2.6, w: u.W, h: u.H, d: 2, mat: "reveal" });
    bx({ x: -u.W / 2 + T / 2, y: 0, z: 0, w: T, h: u.H, d: u.D, col: CC, role: "side" });
    bx({ x: u.W / 2 - T / 2, y: 0, z: 0, w: T, h: u.H, d: u.D, col: CC, role: "side" });
    bx({ x: 0, y: u.H - T, z: 0, w: iw, h: T, d: u.D, col: CC, role: "flat" });
    bx({ x: 0, y: 0, z: 0, w: iw, h: T, d: u.D, col: CC, role: "flat" });
    bx({ x: 0, y: T, z: -u.D / 2 + T / 2, w: iw, h: ih, d: T, col: CC, role: "back", inner: true });
    for (var v = 1; v <= vp; v++) bx({ x: -iw / 2 + v * secW + (v - 0.5) * T, y: T, z: (u.D - shD) / 2, w: T, h: ih, d: shD, col: CC, role: "vp", inner: true });
    for (var s = 0; s < u.sections; s++) {
      var sx = -iw / 2 + s * (secW + T) + secW / 2, zOff = (u.D - shD) / 2;
      var hasDr = u.drawers > 0 && (u.drawEvery || s === u.sections - 1);
      var drStack = hasDr ? u.drawers * (u.drawerH + 4) : 0;
      for (var sh = 1; sh <= u.shelves; sh++) {
        var sy = T + drStack + (ih - drStack) * sh / (u.shelves + 1);
        bx({ x: sx, y: sy, z: zOff, w: secW, h: T, d: shD, col: CC, role: "flat", rx: ct === "shoe" ? -16 : 0, inner: true });
      }
      if (hasDr) for (var d = 0; d < u.drawers; d++) {
        var dy = T + d * (u.drawerH + 4);
        var sl = { id: uid(), kind: "slide", px: sx, py: dy + elev + u.drawerH / 2, pz: u.D / 2 - T / 2, dz: Math.min(u.D * 0.62, 420), drawer: true, cx: sx, cy: dy + elev + u.drawerH / 2 };
        drawers.push(sl);
        frontParts(u, ds, sx, dy, secW - 4, u.drawerH, u.D / 2 - T / 2, SC, T, "drawer").forEach(function (p) { p.door = sl; bx(p); });
        /* drawer box behind the facia so an open drawer has sides and a bottom */
        bx({ x: sx, y: dy + 8, z: u.D / 2 - T / 2 - shD * 0.45, w: secW - 40, h: Math.max(60, u.drawerH - 30), d: shD * 0.85, col: CC, role: "drawerbox", door: sl, faces: "box" });
        Hn.push({ cx: sx, y: dy + elev, w: secW - 4, h: u.drawerH, hl: true, z: u.D / 2, hd: hd, fin: fin, door: sl });
      }
      if (u.shape === "walkin" || (ct === "wardrobe" && s === 0 && u.shelves < 3))
        R.push({ x: sx, y: ih * 0.84 + T + elev, z: zOff, len: secW, fin: fin });
    }
    if (!open && !u.noDoors) {
      if (u.type === "sliding") {
        var sw = u.W / 2 + 25, shh = u.H - 55;
        var sA = { id: uid(), kind: "slide", px: -u.W / 4 - 12, py: 30 + elev + shh / 2, pz: zF + T, dx: sw * 0.86, covers: [-u.W / 2, 0], primary: true };
        var sB = { id: uid(), kind: "slide", px: u.W / 4 + 12, py: 30 + elev + shh / 2, pz: zF - 6, dx: -sw * 0.86, covers: [0, u.W / 2] };
        frontParts(u, ds, -u.W / 4 - 12, 30, sw, shh, zF + T, SC, T, "slide").forEach(function (p) { p.door = sA; bx(p); });
        frontParts(u, ds, u.W / 4 + 12, 30, sw, shh, zF - 6, u.shutterCol2 || SC, T, "slide").forEach(function (p) { p.door = sB; bx(p); });
        Hn.push({ cx: -u.W / 4 - 12, y: 30 + elev, w: sw, h: shh, hl: true, z: zF + T + T / 2, hd: hd, fin: fin, door: sA });
        Hn.push({ cx: u.W / 4 + 12, y: 30 + elev, w: sw, h: shh, hl: false, z: zF - 6 + T / 2, hd: hd, fin: fin, door: sB });
        fronts.push(sA, sB);
      } else if (u.unitType === "fcm-lt" ||
                 (u.unitConfig && u.unitConfig.unitType === "fcm-lt") ||
                 (u.openShutter && u.openShutter.opening === "left") ||
                 (u.unitConfig && u.unitConfig.openShutter && u.unitConfig.openShutter.opening === "left") ||
                 u.catalogItemId === "fcm-lt" || u.catalogItemId === "fm-lt-01" ||
                 u.id === "fcm-lt" || u.id === "fm-lt-01" ||
                 (u.id && /fcm[-_ ]*lt/i.test(u.id)) ||
                 (u.label && /fcm[-_ ]*lt/i.test(u.label)) ||
                 (u.name && /fcm[-_ ]*lt/i.test(u.name))) {
        // FCM-LT (Cookscape): Left 600mm shutter is HINGED on the left (opening: "left") and opens outwards to the left.
        // Right 600mm panel is 100% FIXED (no door, no hinge, no handle).
        var fixW = (u.fixedPanel && u.fixedPanel.width) ||
                   (u.unitConfig && u.unitConfig.fixedPanel && u.unitConfig.fixedPanel.width) ||
                   (u.W / 2);
        var movW = u.W - fixW - 6;
        var movCx = -u.W / 2 + movW / 2 + 3;
        var fixCx = u.W / 2 - fixW / 2;
        // 1. Left Movable Shutter (Hinged on the left edge, opens outward to the left)
        hinged(movCx, 3, movW, u.H - 6, zF, true, frontParts(u, ds, movCx, 3, movW, u.H - 6, zF, SC, T, "door"));
        // 2. Static Right Fixed Panel (attached directly to carcass, never opens, NO handle)
        frontParts(u, ds, fixCx, 3, fixW - 3, u.H - 6, zF, SC, T, "front").forEach(function (p) { bx(p); });
      } else if (u.unitType === "fcm-rt" || (u.fixedPanel && u.fixedPanel.enabled) ||
                 (u.unitConfig && u.unitConfig.fixedPanel && u.unitConfig.fixedPanel.enabled) ||
                 (u.unitConfig && u.unitConfig.unitType === "fcm-rt") ||
                 u.catalogItemId === "fcm-rt" || u.catalogItemId === "fm-rt-01" ||
                 u.id === "fcm-rt" || u.id === "fm-rt-01" ||
                 (u.id && /fcm[-_ ]*rt/i.test(u.id)) ||
                 (u.label && /fcm[-_ ]*rt/i.test(u.label)) ||
                 (u.name && /fcm[-_ ]*rt/i.test(u.name))) {
        // FCM-RT (Cookscape): Left 600mm panel is 100% FIXED (no door, no hinge, no handle).
        // Right 600mm shutter is HINGED on the right (opening: "right") and opens outwards to the right.
        var fixW = (u.fixedPanel && u.fixedPanel.width) ||
                   (u.unitConfig && u.unitConfig.fixedPanel && u.unitConfig.fixedPanel.width) ||
                   (u.W / 2);
        var movW = u.W - fixW - 6;
        var fixCx = -u.W / 2 + fixW / 2;
        var movCx = u.W / 2 - movW / 2;
        // 1. Static Left Fixed Panel (attached directly to carcass, never opens, NO handle)
        frontParts(u, ds, fixCx, 3, fixW - 3, u.H - 6, zF, SC, T, "front").forEach(function (p) { bx(p); });
        // 2. Right Movable Shutter (Hinged on the right edge, opens outward to the right)
        var isHl = !!(
          (u.openShutter && u.openShutter.opening === "left") ||
          (u.unitConfig && u.unitConfig.openShutter && u.unitConfig.openShutter.opening === "left")
        );
        hinged(movCx, 3, movW, u.H - 6, zF, isHl, frontParts(u, ds, movCx, 3, movW, u.H - 6, zF, SC, T, "door"));
      } else {
        var n = Math.max(1, u.shutters), w1 = (u.W - (n + 1) * 3) / n;
        for (var i = 0; i < n; i++) {
          var cx = -u.W / 2 + 3 + w1 / 2 + i * (w1 + 3), hl = i < n / 2, ci = (u.shutterCol2 && i % 2 === 1) ? u.shutterCol2 : SC;
          hinged(cx, 3, w1, u.H - 6, zF, hl, frontParts(u, ds, cx, 3, w1, u.H - 6, zF, ci, T, "door"));
        }
      }
    }
    if (u.loft) {
      var ly = u.H + 2, lih = u.loftH - 2 * T, ln = Math.max(1, u.loftShutters);
      bx({ x: -u.W / 2 + T / 2, y: ly, z: 0, w: T, h: u.loftH, d: u.D, col: CC, role: "side" });
      bx({ x: u.W / 2 - T / 2, y: ly, z: 0, w: T, h: u.loftH, d: u.D, col: CC, role: "side" });
      bx({ x: 0, y: ly + u.loftH - T, z: 0, w: iw, h: T, d: u.D, col: CC, role: "flat" });
      bx({ x: 0, y: ly, z: 0, w: iw, h: T, d: u.D, col: CC, role: "flat" });
      bx({ x: 0, y: ly + T, z: -u.D / 2 + T / 2, w: iw, h: lih, d: T, col: CC, role: "back", inner: true });
      if (!open) {
        var lw = (u.W - (ln + 1) * 3) / ln;
        for (var L = 0; L < ln; L++) { var lcx = -u.W / 2 + 3 + lw / 2 + L * (lw + 3), cL = (u.shutterCol2 && L % 2 === 1) ? u.shutterCol2 : SC; hinged(lcx, ly + 3, lw, u.loftH - 6, zF, L < ln / 2, frontParts(u, ds, lcx, ly + 3, lw, u.loftH - 6, zF, cL, T, "door")); }
      }
    }
    /* a drawer is "behind" the front whose span contains it — it can only open once that front has moved */
    drawers.forEach(function (dr) {
      for (var f = 0; f < fronts.length; f++) {
        var fr = fronts[f];
        if (dr.cx >= fr.covers[0] && dr.cx <= fr.covers[1] && (!fr.yr || (dr.cy >= fr.yr[0] && dr.cy <= fr.yr[1]))) { dr.behind = fr; break; }
      }
    });
    var hasCounter = (u.counter && u.counter !== "none") || (ct === "kbase" && u.counter !== "none");
    if (hasCounter) {
      B.push({ x: 0, y: u.H + elev, z: 12, w: u.W + 30, h: 38, d: u.D + 30, mat: "stone:" + counterKind(u), tile: 1200 });
    }
    if (ct === "kbase") {
      var isFcm = (u.unitType === "fcm-rt" || u.unitType === "fcm-lt" || (u.fixedPanel && u.fixedPanel.enabled) ||
                   (u.unitConfig && u.unitConfig.fixedPanel && u.unitConfig.fixedPanel.enabled) ||
                   (u.unitConfig && (u.unitConfig.unitType === "fcm-rt" || u.unitConfig.unitType === "fcm-lt")) ||
                   u.catalogItemId === "fcm-rt" || u.catalogItemId === "fm-rt-01" ||
                   u.catalogItemId === "fcm-lt" || u.catalogItemId === "fm-lt-01" ||
                   u.id === "fcm-rt" || u.id === "fm-rt-01" ||
                   u.id === "fcm-lt" || u.id === "fm-lt-01" ||
                   (u.id && /fcm[-_ ]*(rt|lt)/i.test(u.id)) ||
                   (u.label && /fcm[-_ ]*(rt|lt)/i.test(u.label)) ||
                   (u.name && /fcm[-_ ]*(rt|lt)/i.test(u.name)));
      var plinthH = elev > 0 ? elev : (isFcm ? 100 : 0);
      if (plinthH > 0) {
        var pY = elev > 0 ? elev : 0;
        B.push({ x: 0, y: pY, z: u.D / 2 - 70, w: u.W - 2 * T, h: plinthH, d: 18, mat: "kick" });
        B.push({ x: -u.W / 2 + T, y: pY, z: 0, w: 18, h: plinthH, d: u.D - 90, mat: "kick" });
        B.push({ x: u.W / 2 - T, y: pY, z: 0, w: 18, h: plinthH, d: u.D - 90, mat: "kick" });
      }
    }
    if (ct === "dresser") {
      B.push({ x: 0, y: u.H + 60, z: -u.D / 2 + T + 18, w: u.W * 0.5 + 50, h: 680, d: 14, col: CC, role: "back" });
      B.push({ x: 0, y: u.H + 80, z: -u.D / 2 + T + 27, w: u.W * 0.5, h: 640, d: 6, mat: "mirror" });
    }
    return { boxes: B, handles: Hn, rods: R };
  }
  /* imported unit: carcass plus every front laid out at its real size, each one openable */
  function layoutImported(u) {
    var T = u.T, B = [], iw = u.W - 2 * T, CC = u.carcass, SC = u.shutterCol, fin = u.hfinish || "chrome";
    B.push({ x: -u.W / 2 + T / 2, y: 0, z: 0, w: T, h: u.H, d: u.D, col: CC, role: "side" });
    B.push({ x: u.W / 2 - T / 2, y: 0, z: 0, w: T, h: u.H, d: u.D, col: CC, role: "side" });
    B.push({ x: 0, y: u.H - T, z: 0, w: iw, h: T, d: u.D, col: CC, role: "flat" });
    B.push({ x: 0, y: 0, z: 0, w: iw, h: T, d: u.D, col: CC, role: "flat" });
    B.push({ x: 0, y: T, z: -u.D / 2 + T / 2, w: iw, h: u.H - 2 * T, d: T, col: CC, role: "back" });
    B.push({ x: 0, y: 0, z: u.D / 2 - 2.6, w: u.W, h: u.H, d: 2, mat: "reveal" });
    var zF = u.D / 2 + T / 2, x = -u.W / 2 + 3, yTop = u.H - 3, rowH = 0, k = 0, Hn = [];
    u.rows.forEach(function (r) {
      if (!/Shutter|Facia/i.test(r.r)) return;
      for (var i = 0; i < r.q; i++) {
        if (x + r.w > u.W / 2 && x > -u.W / 2 + 3) { x = -u.W / 2 + 3; yTop -= rowH + 3; rowH = 0; }
        if (yTop - r.h < -60) return;
        var cx = x + r.w / 2, y = yTop - r.h, door;
        if (/Sliding/i.test(r.r)) door = { id: uid(), kind: "slide", px: cx, py: y + r.h / 2, pz: zF, dx: r.w * 0.6 };
        else if (/Facia/i.test(r.r)) door = { id: uid(), kind: "slide", px: cx, py: y + r.h / 2, pz: zF, dz: Math.min(u.D * 0.55, 380) };
        else { var hl = (k % 2 === 0); door = { id: uid(), kind: "hinge", px: hl ? x : x + r.w, py: y + r.h / 2, pz: zF, sign: hl ? -1 : 1, angle: 1.75 }; }
        B.push({ x: cx, y: y, z: zF, w: r.w, h: r.h, d: T, col: r.col || SC, role: "front", door: door });
        var hh = handleFromDesign(r.d);
        if (hh) Hn.push({ cx: cx, y: y, w: r.w, h: r.h, hl: door.kind === "hinge" ? door.sign < 0 : true, z: zF + T / 2, hd: hh, fin: fin, door: door });
        x += r.w + 3; if (r.h > rowH) rowH = r.h; k++;
      }
    });
    return { boxes: B, handles: Hn, rods: [] };
  }
  /* ═══════════════════════════════════════════════════════════════
     KITCHENS — a kitchen is runs of cabinets on walls: base units under
     a counter, wall units above a backsplash, a tall unit at the start,
     a fridge bay at the end, hob + chimney and a sink placed on the main
     run. Every run is built from the same base / wall / tall units, so
     the process sheet, nesting, drilling and quote all just work.
     ═══════════════════════════════════════════════════════════════ */
  var KLAYOUTS = [{ id: "straight", label: "Straight" }, { id: "lshape", label: "L-shape" }, { id: "ushape", label: "U-shape" }, { id: "parallel", label: "Parallel" }, { id: "island", label: "Island" }, { id: "lisland", label: "L + island" }, { id: "peninsula", label: "Peninsula" }, { id: "gshape", label: "G-shape" }];
  /* counters: id → stone kind rendered by stoneMat */
  var COUNTERS = [{ id: "black", label: "Granite black", kind: "granite" }, { id: "galaxy", label: "Black galaxy", kind: "galaxy" }, { id: "green", label: "Granite green", kind: "green" }, { id: "white", label: "Marble white", kind: "marble" }, { id: "beige", label: "Marble beige", kind: "beige" }, { id: "quartz", label: "Quartz white", kind: "quartz" }, { id: "greyq", label: "Quartz grey", kind: "greyq" }];
  function counterKind(u) {
    var cVal = (u && u.counter) || "black";
    for (var i = 0; i < COUNTERS.length; i++) {
      if (COUNTERS[i].id === cVal || COUNTERS[i].kind === cVal) return COUNTERS[i].kind;
    }
    if (cVal === "marble") return "marble";
    if (cVal === "granite") return "granite";
    return "granite";
  }
  var SPLASHES = [{ id: "subway", label: "Subway tile" }, { id: "largeformat", label: "Large tile" }, { id: "chevron", label: "Chevron" }, { id: "hex", label: "Hexagon" }, { id: "slab", label: "Stone slab" }, { id: "glass", label: "Lacquered glass" }, { id: "terrazzo", label: "Terrazzo" }];
  function splashMatId(u) {
    var k = u.kSplash || "subway";
    if (k === "subway") return "tile";
    if (k === "slab") return "stone:" + counterKind(u);
    if (k === "glass") return "splash:glass:" + (u.kSplashHex || "#E4E9EC");
    return "splash:" + k;
  }
  function kUnit(u, ct, W, label, extra) {
    var b = newUnit(label); applyType(b, ct);
    b.W = W; b.T = u.T; b.carcass = u.carcass; b.shutterCol = u.shutterCol;
    b.dstyle = (u.dstyle === "steel" || u.dstyle === "mirror") ? "slab" : (u.dstyle || "slab");
    b.handle = u.handle; b.hfinish = u.hfinish; b.counter = u.counter;
    if (ct === "kwall") { if (u.kWallCol) b.shutterCol = u.kWallCol; if (u.kWallDs) b.dstyle = u.kWallDs; }   /* two-tone / glass wall units */
    if (extra) for (var k in extra) b[k] = extra[k];
    if (ct !== "tall") { b.sections = Math.max(1, Math.round(b.W / 600)); b.shutters = b.sections; }
    return b;
  }
  function kitchenRuns(u) {
    var A = u.kA || 3000, B = u.kB || 2400, C = u.kC || 2400, D = 580, T = u.T, L = u.klayout || "straight";
    var runs = [{ key: "A", len: A, tx: 0, tz: 0, ry: 0, hob: u.kHob !== false, sink: u.kSink !== false, fridge: u.kFridge !== false, tall: u.kTall !== false }];
    var bar = u.kBar === true;
    if (/lshape|ushape|peninsula|gshape|lisland/.test(L)) runs.push({ key: "B", len: B, tx: A / 2 + D / 2 + T, tz: B / 2 - D / 2, ry: -90 });
    if (L === "ushape" || L === "gshape") runs.push({ key: "C", len: C, tx: -A / 2 - D / 2 - T, tz: C / 2 - D / 2, ry: 90 });
    if (L === "parallel") runs.push({ key: "B", len: B, tx: 0, tz: 1500 + D, ry: 180, sink: true });
    /* islands and peninsulas face the kitchen; the seating side (bar overhang, waterfall ends) faces the room */
    if (L === "island") runs.push({ key: "I", len: Math.min(B, 2400), tx: 0, tz: 1300 + D, ry: 180, island: true, bar: bar });
    if (L === "lisland") runs.push({ key: "I", len: Math.min(u.kI || 1800, 2400), tx: -200, tz: 1400 + D, ry: 180, island: true, bar: bar });
    if (L === "peninsula" || L === "gshape") { var P = Math.min(u.kP || 1800, B - D); runs.push({ key: "P", len: P, tx: A / 2 + T - P / 2, tz: B - D, ry: 180, island: true, bar: bar }); }
    return runs;
  }
  function kitchenPieces(u, run) {
    var P = [], D = run.island ? 900 : 580, x0 = -run.len / 2;
    var tallW = run.tall ? 600 : 0, fridgeW = run.fridge ? 900 : 0, extra = [], oven = run.tall && u.kOven === true;
    var baseW = Math.max(600, run.len - tallW - fridgeW);
    /* tall units top out at 2170 — level with the wall units — like every fitted kitchen */
    if (run.tall && !oven) P.push({ unit: kUnit(u, "tall", 600, run.key + " tall", { D: D, H: 2170, shelves: 5 }), dx: x0 + 300 });
    if (run.tall && u.kLoft === true) P.push({ unit: kUnit(u, "kwall", 600, run.key + " tall loft", { D: D, elev: 2170, H: 780, dstyle: "slab" }), dx: x0 + 300 });
    if (oven) {
      /* oven tower: a 600 base with a door, then an open carcass whose two openings hold the oven and the microwave */
      P.push({ unit: kUnit(u, "kbase", 600, run.key + " oven base", { D: D, elev: 100, drawers: 0, shutters: 1, sections: 1, shelves: 1 }), dx: x0 + 300 });
      P.push({ unit: kUnit(u, "bookshelf", 600, run.key + " oven tower", { D: D, H: 1350, elev: 820, shelves: 1, sections: 1 }), dx: x0 + 300, tower: true });
    }
    var bx0 = x0 + tallW, base = kUnit(u, "kbase", baseW, run.key + " base", { D: D, elev: 100, drawers: 3 });
    P.push({ unit: base, dx: bx0 + baseW / 2 });
    var hobX = run.hob ? bx0 + baseW * 0.42 : null, sinkX = run.sink ? bx0 + baseW * 0.82 : null;
    var wallCol = u.kWallCol || u.shutterCol;
    function wall(w, label, dx) {
      P.push({ unit: kUnit(u, "kwall", w, label, { D: 350, elev: 1450 }), dx: dx });
      if (u.kLoft === true) P.push({ unit: kUnit(u, "kwall", w, label + " loft", { D: 350, elev: 2170, H: 780, dstyle: "slab" }), dx: dx });
    }
    if (u.kWall !== false && !run.island) {
      if (hobX !== null && baseW > 1500) {
        var lw = Math.max(0, (hobX - 450) - bx0), rw = Math.max(0, (bx0 + baseW) - (hobX + 450));
        if (u.kShelves === true && rw >= 1000) {
          rw -= 700;                                                /* open shelves take the end of the wall run */
          [1560, 1900].forEach(function (sy) { extra.push({ x: bx0 + baseW - 400, y: sy, z: -D / 2 + 150, w: 760, h: u.T, d: 280, col: wallCol, role: "flat" }); });
        }
        if (lw >= 400) wall(lw, run.key + " wall L", bx0 + lw / 2);
        if (rw >= 400) wall(rw, run.key + " wall R", bx0 + baseW - rw / 2);
      } else wall(baseW, run.key + " wall", bx0 + baseW / 2);
    }
    var dishX = null;
    if (u.kDish === true && !run.island && baseW >= 1800) { dishX = (sinkX !== null) ? sinkX - 900 : bx0 + 300; if (dishX - 300 < bx0) dishX = bx0 + 300; }
    return { pieces: P, extra: extra, D: D, bx0: bx0, baseW: baseW, hobX: hobX, sinkX: sinkX, dishX: dishX, fridgeX: run.fridge ? bx0 + baseW + 450 : null };
  }
  function shiftLayout(lay, dx) {
    var seen = [];
    function sh(s) { if (!s || seen.indexOf(s) >= 0) return; seen.push(s); s.px += dx; if (s.covers) { s.covers[0] += dx; s.covers[1] += dx; } if (s.cx != null) s.cx += dx; }
    lay.boxes.forEach(function (b) { b.x += dx; sh(b.door); });
    lay.handles.forEach(function (h) { h.cx += dx; sh(h.door); });
    lay.rods.forEach(function (r) { r.x += dx; });
    return lay;
  }
  function layoutKitchen(u) {
    var out = [], ctop = 100 + 720 + 38, first = true;
    kitchenRuns(u).forEach(function (run) {
      var kp = kitchenPieces(u, run), L = { boxes: [], handles: [], rods: [] }, D = kp.D;
      kp.pieces.forEach(function (p) {
        var lay = shiftLayout(layoutRun(p.unit), p.dx);
        L.boxes = L.boxes.concat(lay.boxes); L.handles = L.handles.concat(lay.handles); L.rods = L.rods.concat(lay.rods);
      });
      var sm = splashMatId(u), stone = "stone:" + counterKind(u);
      if (!run.island) {
        var sb = { x: kp.bx0 + kp.baseW / 2, y: ctop, z: -D / 2 + 5, w: kp.baseW + 30, h: 592, d: 8, mat: sm };
        if (sm.indexOf("stone:") === 0) sb.tile = 1200; else if (sm === "splash:hex") { sb.tile = 600; sb.tileH = 650; } else if (sm !== "tile") sb.tile = 600;
        L.boxes.push(sb);
      }
      kp.extra.forEach(function (b) { L.boxes.push(b); });
      kp.pieces.forEach(function (p) {
        if (!p.tower) return;
        var tx = p.dx, zf = D / 2;                                       /* appliances sit inside the tower openings */
        L.boxes.push({ x: tx, y: 846, z: zf - 290, w: 560, h: 596, d: 540, mat: "steel" });
        L.boxes.push({ x: tx, y: 880, z: zf - 17, w: 500, h: 330, d: 6, mat: "hob" });
        L.boxes.push({ x: tx, y: 1360, z: zf - 8, w: 500, h: 16, d: 18, mat: "metal" });
        L.boxes.push({ x: tx, y: 1512, z: zf - 215, w: 560, h: 390, d: 400, mat: "steel" });
        L.boxes.push({ x: tx - 60, y: 1535, z: zf - 14, w: 380, h: 300, d: 6, mat: "hob" });
        L.boxes.push({ x: tx + 210, y: 1535, z: zf - 14, w: 110, h: 300, d: 4, mat: "reveal" });
      });
      if (kp.dishX !== null) {
        var dz = D / 2 + 27;                                             /* flush with the base doors, a little proud */
        L.boxes.push({ x: kp.dishX, y: 110, z: dz + 12, w: 596, h: 700, d: 20, mat: "steel" });
        L.boxes.push({ x: kp.dishX, y: 770, z: dz + 24, w: 560, h: 26, d: 4, mat: "reveal" });
        L.boxes.push({ x: kp.dishX, y: 735, z: dz + 32, w: 520, h: 14, d: 16, mat: "metal" });
      }
      if (run.bar) {
        L.boxes.push({ x: 0, y: 820, z: -D / 2 - 140, w: run.len + 40, h: 38, d: 320, mat: stone, tile: 1200 });
        [-1, 1].forEach(function (s) { L.boxes.push({ x: s * (run.len / 2 + 30), y: 0, z: -136, w: 38, h: 858, d: D + 327, mat: stone, tile: 1200 }); });
      }
      if (kp.hobX !== null) {
        L.boxes.push({ x: kp.hobX, y: ctop, z: -D / 2 + D * 0.5, w: 580, h: 10, d: 480, mat: "hob" });
        if (u.kWall !== false && !run.island) {
          L.boxes.push({ x: kp.hobX, y: 1450, z: -D / 2 + 250, w: 600, h: 380, d: 460, mat: "steel" });
          L.boxes.push({ x: kp.hobX, y: 1830, z: -D / 2 + 180, w: 220, h: 380, d: 220, mat: "steel" });
        }
      }
      if (kp.sinkX !== null) {
        L.boxes.push({ x: kp.sinkX, y: ctop - 2, z: -D / 2 + D * 0.55, w: 760, h: 20, d: 430, mat: "steel" });
        L.boxes.push({ shape: "cyl", r: 12, len: 260, x: kp.sinkX, y: ctop, z: -D / 2 + 90, mat: "metal" });
      }
      if (kp.fridgeX !== null) {
        var fx = kp.fridgeX, fz = -D / 2 + 360;
        L.boxes.push({ x: fx, y: 0, z: fz, w: 840, h: 1760, d: 720, mat: "steel", noFrame: false });
        L.boxes.push({ x: fx, y: 1120, z: fz + 361, w: 820, h: 6, d: 4, mat: "reveal" });                 /* freezer / fridge split */
        L.boxes.push({ x: fx - 395, y: 80, z: fz + 361, w: 6, h: 1600, d: 4, mat: "reveal" });               /* door edge line */
        L.boxes.push({ shape: "cyl", r: 9, len: 700, x: fx - 330, y: 330, z: fz + 380, mat: "metal" });      /* long door handle */
        L.boxes.push({ shape: "cyl", r: 9, len: 260, x: fx - 330, y: 1200, z: fz + 380, mat: "metal" });
      }
      var hasArch = (window.OrbixUI && (window.OrbixUI.project || window.OrbixUI.editor)) || (u && u._furnId);
      if (!run.island && run.ry !== 180 && !hasArch) { var ww = (run.ry || 0) ? run.len + 900 : 16000; L.boxes.push({ x: 0, y: 0, z: -D / 2 - 14, w: ww, h: 3000, d: 14, mat: "wall", noFrame: true }); L.boxes.push({ x: 0, y: 0, z: -D / 2 - 6, w: ww, h: 110, d: 2, mat: "ao", tile: 110, noFrame: true }); }
      L.transform = (run.ry || run.tx || run.tz) ? { tx: run.tx, tz: run.tz, ry: run.ry } : null;
      if (first && !hasArch) { L.boxes.push({ x: 0, y: -13, z: 1400, w: 20000, h: 12, d: 14000, mat: "floor", tile: 1200, noFrame: true }); first = false; }
      out.push(L);
    });
    return out;
  }
  function kitchenPanels(u) {
    var rows = [];
    kitchenRuns(u).forEach(function (run) {
      var kp = kitchenPieces(u, run);
      kp.pieces.forEach(function (p) { panelsForRun(p.unit).forEach(function (r) { r.r = p.unit.label + " · " + r.r; rows.push(r); }); });
      if (!run.island) rows.push({ h: 592, w: Math.round(kp.baseW + 30), q: 1, r: run.key + " · Backsplash tiles", d: "", col: "Tile", nb: true });
      if (kp.hobX !== null) rows.push({ h: 600, w: 520, q: 1, r: run.key + " · Hob + chimney 600", d: "", col: "Appliance", nb: true });
      if (kp.sinkX !== null) rows.push({ h: 760, w: 430, q: 1, r: run.key + " · Sink SS 760×430", d: "", col: "Appliance", nb: true });
      if (kp.dishX !== null) rows.push({ h: 820, w: 600, q: 1, r: run.key + " · Dishwasher 600", d: "", col: "Appliance", nb: true });
      kp.pieces.forEach(function (p) { if (p.tower) { rows.push({ h: 600, w: 600, q: 1, r: run.key + " · Built-in oven 600", d: "", col: "Appliance", nb: true }); rows.push({ h: 400, w: 600, q: 1, r: run.key + " · Microwave 600", d: "", col: "Appliance", nb: true }); } });
      if (run.bar) { rows.push({ h: run.len + 40, w: 320, q: 1, r: run.key + " · Breakfast bar overhang", d: "", col: "Stone", nb: true }); rows.push({ h: 858, w: kp.D + 327, q: 2, r: run.key + " · Waterfall end panel", d: "", col: "Stone", nb: true }); }
      if (kp.extra.length) rows.push({ h: 280, w: 760, q: kp.extra.length, r: run.key + " · Open shelf", d: "", col: u.kWallCol || u.shutterCol });
    });
    return rows;
  }
  function kitchenElev(u) {
    var d = new Draw(), run = kitchenRuns(u)[0], kp = kitchenPieces(u, run), T = u.T, x0 = -run.len / 2 + run.len / 2; /* draw run A from x=0 */
    var off = run.len / 2, bx = kp.bx0 + off, bw = kp.baseW;
    d.line(-300, 0, run.len + 300, 0, "OUT");
    if (run.tall) { d.rect(0, 0, 600, 2170, "OUT"); d.line(300, 10, 300, 2160, "THIN"); }
    d.rect(bx, 100, bw, 720, "OUT"); d.rect(bx - 15, 820, bw + 30, 38, "OUT");
    var secs = Math.max(1, Math.round(bw / 600)), cw = bw / secs;
    for (var i = 1; i < secs; i++) d.line(bx + i * cw, 110, bx + i * cw, 810, "THIN");
    d.rect(bx, 858, bw, 592, "HID");
    kp.pieces.forEach(function (p) { if (p.unit.ctype === "kwall") { var w = p.unit.W, cx = p.dx + off, ey = p.unit.elev || 1450, eh = p.unit.H || 720; d.rect(cx - w / 2, ey, w, eh, "OUT"); var n = Math.max(1, Math.round(w / 600)); for (var j = 1; j < n; j++) d.line(cx - w / 2 + j * w / n, ey + 10, cx - w / 2 + j * w / n, ey + eh - 10, "THIN"); } });
    if (kp.hobX !== null) { var hx = kp.hobX + off; d.rect(hx - 290, 858, 580, 10, "THIN"); d.rect(hx - 300, 1450, 600, 380, "OUT"); d.rect(hx - 110, 1830, 220, 380, "OUT"); d.text(hx, 1250, "CHIMNEY 600", 44); }
    if (kp.sinkX !== null) { var sx = kp.sinkX + off; d.rect(sx - 380, 858, 760, 14, "THIN"); d.text(sx, 900, "SINK", 44); }
    if (kp.fridgeX !== null) { var fx = kp.fridgeX + off; d.rect(fx - 420, 0, 840, 1760, "HID"); d.text(fx, 880, "FRIDGE", 44); }
    d.dimH(0, run.len, 0, -230, run.len + " mm  RUN A");
    d.dimV(0, 858, run.len, run.len + 230, "858");
    d.dimV(1450, 2170, run.len, run.len + 230, "720");
    d.text(run.len / 2, 2400, "KITCHEN ELEVATION — RUN A · " + (KLAYOUTS.filter(function (k) { return k.id === (u.klayout || "straight"); })[0] || {}).label, 56);
    var tx = run.len + 600, ty = -620;
    d.rect(tx, ty, 1650, 430, "OUT"); d.line(tx, ty + 290, tx + 1650, ty + 290, "THIN"); d.line(tx, ty + 150, tx + 1650, ty + 150, "THIN");
    d.text(tx + 825, ty + 330, (S.head.cust || "CUSTOMER") + "   |   " + (S.head.order || "ORDER No"), 54);
    d.text(tx + 825, ty + 190, (u.label || "KITCHEN") + "  " + (u.klayout || "straight").toUpperCase() + "  A" + (u.kA || 3000) + (u.kB && u.klayout !== "straight" ? " B" + u.kB : "") + (u.klayout === "ushape" ? " C" + (u.kC || 2400) : ""), 58);
    d.text(tx + 825, ty + 50, "CARCASS " + u.carcass + "   SHUTTER " + u.shutterCol + "   " + DS(u.dstyle || "slab").label.toUpperCase(), 46);
    return d;
  }

  /* ══════════ TV WALL ══════════
     A TV unit is a composition: console (drawers / doors / open niches / mixed, floating or on a
     plinth), a feature panel behind the TV (laminate, fluted, grooved or stone), the TV itself,
     floating shelves, tall towers either side, wall cabinets above, and LED profile light. */
  var TV_SIZES = { 43: 960, 50: 1120, 55: 1230, 65: 1450, 75: 1680 };
  function tvSpec(u) {
    var s = { W: u.W, H: u.H || 450, D: u.D || 450, T: u.T };
    var isBaseConsole = (u.H <= 900) || (u.label && /BASE/i.test(u.label)) || (u.name && /BASE/i.test(u.name)) || !!u._furnId;
    s.float = u.tvFloat !== false && !isBaseConsole;
    s.elev = s.float ? 300 : (u.elev || (isBaseConsole ? 0 : 80));
    s.back = u.tvBack || (isBaseConsole ? "none" : "panel");
    s.backH = s.back === "none" ? 0 : (u.tvBackH || 2400);
    s.towers = u.tvTowers || "none"; s.tw = 450; s.tH = Math.min(u.tvBackH || 2400, 2400);
    s.tvW = TV_SIZES[u.tvSize || 55] || 1230; s.tvH = Math.round(s.tvW * 9 / 16);
    s.show = (s.back !== "none") && (u.tvShow !== false) && !isBaseConsole;
    s.tvY = s.elev + s.H + 250;
    s.col = u.tvBackCol || u.shutterCol;
    s.shelves = [];
    var n = u.tvShelves || 0, top = (s.back === "none" ? 2400 : s.backH) - 120;
    if (n > 0) {
      var side = s.show ? (s.W - s.tvW) / 2 - 120 : 0;
      if (s.show && side >= 600) {
        var w = Math.min(900, side - 60);
        for (var i = 0; i < n; i++) { var y = s.tvY + 120 + i * 450; if (y + s.T < top) { s.shelves.push({ x: -s.W / 2 + 60 + w / 2, y: y, w: w }); s.shelves.push({ x: s.W / 2 - 60 - w / 2, y: y, w: w }); } }
      } else {
        var w2 = s.show ? s.tvW : Math.min(1200, s.W - 200), y0 = s.show ? s.tvY + s.tvH + 200 : s.elev + s.H + 400;
        for (var j = 0; j < n; j++) { var yy = y0 + j * 380; if (yy + s.T < top) s.shelves.push({ x: 0, y: yy, w: w2 }); }
      }
    }
    return s;
  }
  function tvPieces(u) {
    var s = tvSpec(u), P = [], console = u.tvConsole || "drawers", n = Math.max(2, Math.round(u.W / 600));
    function unit(ct, W, label, extra, dx) { P.push({ unit: kUnit(u, ct, W, label, extra), dx: dx }); }
    var base = { H: s.H, D: s.D, elev: s.elev, shelves: 0, drawers: 0, loft: false };
    if (console === "open") unit("tv", u.W, "TV console", Object.assign({}, base, { sections: n }), 0);
    else if (console === "doors") unit("overhead", u.W, "TV console", Object.assign({}, base, { sections: n }), 0);
    else if (console === "drawers") unit("overhead", u.W, "TV console", Object.assign({}, base, { sections: n, noDoors: true, drawers: 1, drawEvery: true, drawerH: s.H - 2 * u.T - 8 }), 0);
    else {
      var side = Math.round(u.W * 0.3), mid = u.W - 2 * side;
      unit("overhead", side, "TV console L", Object.assign({}, base, { sections: 1 }), -u.W / 2 + side / 2);
      unit("tv", mid, "TV console niche", Object.assign({}, base, { sections: Math.max(1, Math.round(mid / 600)) }), 0);
      unit("overhead", side, "TV console R", Object.assign({}, base, { sections: 1 }), u.W / 2 - side / 2);
    }
    if (s.towers !== "none") {
      var tx = u.W / 2 + s.tw / 2 + 2, tExtra = { H: s.tH, D: s.D, elev: 0, shelves: 4, shutters: 1, sections: 1, loft: false };
      if (s.towers !== "right") unit("tall", s.tw, "TV tower L", tExtra, -tx);
      if (s.towers !== "left") unit("tall", s.tw, "TV tower R", tExtra, tx);
    }
    if (u.tvWall === true) unit("overhead", u.W, "TV wall cabinet", { H: 450, D: 300, elev: (u.tvBackH || 2400) - 450, sections: n, shelves: 0, drawers: 0, loft: false }, 0);
    return P;
  }
  function layoutTv(u) {
    var s = tvSpec(u), L = { boxes: [], handles: [], rods: [] }, D = s.D, T = u.T;
    tvPieces(u).forEach(function (p) {
      var lay = shiftLayout(layoutRun(p.unit), p.dx);
      L.boxes = L.boxes.concat(lay.boxes); L.handles = L.handles.concat(lay.handles); L.rods = L.rods.concat(lay.rods);
    });
    var zFront = -D / 2;                                   /* console back = panel front */
    if (s.back !== "none") {
      var pb = { x: 0, y: 0, z: -D / 2 - 9, w: u.W, h: s.backH, d: 18, col: s.col, role: "back" };
      if (s.back === "stone") { pb.mat = "stone:" + (u.tvStone || "marble"); pb.tile = 1200; delete pb.col; delete pb.role; }
      if (s.back === "grooved") pb.grooved = true;
      if (u.hgrain) pb.hgrain = true;
      L.boxes.push(pb);
      if (s.back === "fluted") {
        var nr = Math.floor((u.W - 30) / 24), x0 = -(nr - 1) * 12;
        for (var i = 0; i < nr; i++) L.boxes.push({ shape: "cyl", r: 9, len: s.backH - 20, x: x0 + i * 24, y: 10, z: -D / 2 + 1, col: s.col, role: "front" });
        zFront = -D / 2 + 10;
      }
    }
    if (s.show) {
      L.boxes.push({ x: 0, y: s.tvY - 16, z: zFront + 8, w: s.tvW + 12, h: s.tvH + 32, d: 14, mat: "alublack" });     /* bracket / bezel */
      L.boxes.push({ x: 0, y: s.tvY, z: zFront + 22, w: s.tvW, h: s.tvH, d: 16, mat: "hob" });                    /* screen */
    }
    s.shelves.forEach(function (sh) { L.boxes.push({ x: sh.x, y: sh.y, z: zFront + 130, w: sh.w, h: T, d: 250, col: s.col, role: "flat" }); });
    if (u.tvLed !== false) {
      L.boxes.push({ x: 0, y: s.elev - 7, z: D / 2 - 30, w: u.W - 40, h: 6, d: 8, mat: "led" });
      if (s.back !== "none") L.boxes.push({ x: 0, y: s.backH - 14, z: zFront + 4, w: u.W - 30, h: 6, d: 8, mat: "led" });
    }
    if (!s.float) L.boxes.push({ x: 0, y: 0, z: D / 2 - 60, w: u.W - 40, h: s.elev, d: 18, mat: "kick" });
    var zw = -D / 2 - 18;
    roomBoxes(zw, D).forEach(function (b) { L.boxes.push(b); });
    return [L];
  }
  function tvPanels(u) {
    var s = tvSpec(u), rows = [];
    tvPieces(u).forEach(function (p) { panelsForRun(p.unit).forEach(function (r) { r.r = p.unit.label + " · " + r.r; rows.push(r); }); });
    if (s.back !== "none") {
      if (s.back === "stone") rows.push({ h: s.backH, w: u.W, q: 1, r: "Feature wall — stone slab (vendor)", d: "", col: (STONE_LABEL(u.tvStone || "marble")), nb: true });
      else {
        rows.push({ h: s.backH, w: u.W, q: 1, r: "Feature wall panel", d: s.back === "grooved" ? "Grooved" : (u.hgrain ? "H grain" : ""), col: s.col });
        if (s.back === "fluted") rows.push({ h: s.backH - 20, w: u.W, q: 1, r: "Reeded overlay (feature wall)", d: "", col: "Fluted MDF", nb: true });
      }
    }
    if (s.shelves.length) rows.push({ h: Math.round(s.shelves[0].w), w: 250, q: s.shelves.length, r: "Floating Shelf", d: "", col: s.col });
    if (u.tvLed !== false) rows.push({ h: Math.round((u.W - 40) * (s.back !== "none" ? 2 : 1)), w: 12, q: 1, r: "LED profile light (running mm)", d: "", col: "Aluminium profile", nb: true });
    if (s.show) rows.push({ h: s.tvH, w: s.tvW, q: 1, r: "Customer's TV " + (u.tvSize || 55) + '" (not supplied)', d: "", col: "—", nb: true });
    return rows;
  }
  function STONE_LABEL(kind) { for (var i = 0; i < COUNTERS.length; i++) if (COUNTERS[i].kind === kind) return COUNTERS[i].label; return kind; }
  function tvElev(u) {
    var d = new Draw(), s = tvSpec(u), W = u.W, xL = (s.towers === "both" || s.towers === "left") ? 452 : 0, total = W + xL + ((s.towers === "both" || s.towers === "right") ? 452 : 0);
    d.line(-300, 0, total + 300, 0, "OUT");
    if (s.back !== "none") { d.rect(xL, 0, W, s.backH, "HID"); if (s.back === "fluted") for (var f = xL + 24; f < xL + W - 12; f += 48) d.line(f, 20, f, s.backH - 20, "THIN"); }
    d.rect(xL, s.elev, W, s.H, "OUT");
    var n = Math.max(2, Math.round(W / 600)); for (var i = 1; i < n; i++) d.line(xL + i * W / n, s.elev + 8, xL + i * W / n, s.elev + s.H - 8, "THIN");
    if (!s.float) d.rect(xL + 20, 0, W - 40, s.elev, "THIN");
    if (s.show) { var tx = xL + W / 2; d.rect(tx - s.tvW / 2, s.tvY, s.tvW, s.tvH, "OUT"); d.text(tx, s.tvY + s.tvH / 2, 'TV ' + (u.tvSize || 55) + '"', 56); }
    s.shelves.forEach(function (sh) { d.rect(xL + W / 2 + sh.x - sh.w / 2, sh.y, sh.w, u.T, "OUT"); });
    if (xL) { d.rect(0, 0, 450, s.tH, "OUT"); d.line(225, 10, 225, s.tH - 10, "THIN"); }
    if (s.towers === "both" || s.towers === "right") { d.rect(xL + W + 2, 0, 450, s.tH, "OUT"); d.line(xL + W + 227, 10, xL + W + 227, s.tH - 10, "THIN"); }
    if (u.tvWall === true) d.rect(xL, (u.tvBackH || 2400) - 450, W, 450, "OUT");
    d.dimH(0, total, 0, -230, total + " mm");
    d.dimV(0, Math.max(s.backH, s.tH, s.elev + s.H), total, total + 230, String(Math.max(s.backH, s.tH, s.elev + s.H)));
    d.text(total / 2, Math.max(s.backH, 2400) + 260, "TV WALL ELEVATION — " + (u.label || "TV"), 56);
    var tx2 = total + 600, ty = -620;
    d.rect(tx2, ty, 1650, 430, "OUT"); d.line(tx2, ty + 290, tx2 + 1650, ty + 290, "THIN"); d.line(tx2, ty + 150, tx2 + 1650, ty + 150, "THIN");
    d.text(tx2 + 825, ty + 330, (S.head.cust || "CUSTOMER") + "   |   " + (S.head.order || "ORDER No"), 54);
    d.text(tx2 + 825, ty + 190, (u.label || "TV") + "  W" + W + "  console " + (u.tvConsole || "drawers") + (s.float ? " floating" : " plinth") + "  panel " + s.back, 58);
    d.text(tx2 + 825, ty + 50, "CARCASS " + u.carcass + "   SHUTTER " + u.shutterCol + "   " + DS(u.dstyle || "slab").label.toUpperCase(), 46);
    return d;
  }

  function shiftLayoutZ(lay, dz) {
    var seen = [];
    function sh(s) { if (!s || seen.indexOf(s) >= 0) return; seen.push(s); s.pz += dz; }
    lay.boxes.forEach(function (b) { b.z += dz; sh(b.door); });
    lay.handles.forEach(function (h) { h.z += dz; sh(h.door); });
    lay.rods.forEach(function (r) { r.z += dz; });
    return lay;
  }
  function roomBoxes(zWall, D) {
    var hasArch = (typeof window !== 'undefined' && window.OrbixUI && (window.OrbixUI.project || window.OrbixUI.editor));
    var plan = (typeof window !== 'undefined' && window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (typeof window !== 'undefined' && window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
    var activeU = typeof U === 'function' ? U() : null;
    if (hasArch || plan || (activeU && activeU._furnId)) return [];
    return [{ x: 0, y: 0, z: zWall - 7, w: 16000, h: 3000, d: 14, mat: "wall", noFrame: true },
    { x: 0, y: 0, z: zWall + 1, w: 16000, h: 110, d: 2, mat: "ao", tile: 110, noFrame: true },
    { x: 0, y: -13, z: 5000 - D / 2, w: 16000, h: 12, d: 10000, mat: "floor", tile: 1200, noFrame: true }];
  }
  function mergeLay(L, lay) { L.boxes = L.boxes.concat(lay.boxes); L.handles = L.handles.concat(lay.handles); L.rods = L.rods.concat(lay.rods); }

  /* ══════════ CROCKERY / DINING DISPLAY ══════════
     base (doors or drawers, on a plinth or floating) + serving top (stone or laminate) + an open
     gap with a mirror or laminate back + a display hutch (aluminium-profile glass, laminate glass
     frame, or open) with glass shelves and LED; or one tall display; or a sideboard alone. */
  function crSpec(u) {
    var s = { W: u.W, D: u.D || 450, T: u.T, cfg: u.crConfig || "hutch" };
    s.float = s.cfg === "floating"; s.elev = s.float ? 300 : 100; s.baseH = 820; s.topT = (u.crTop || "stone") === "stone" ? 25 : u.T;
    s.baseTop = s.elev + s.baseH + s.topT;
    s.gap = s.cfg === "tall" ? 0 : (s.cfg === "sideboard" ? 0 : (u.crGap || 300));
    s.hutchElev = s.baseTop + s.gap; s.hutchD = s.cfg === "tall" ? s.D : 350;
    s.hutchH = s.cfg === "sideboard" ? 0 : Math.max(0, u.H - s.hutchElev);
    s.upper = u.crUpper || "aluglass"; s.upperCol = u.crUpperCol || u.shutterCol;
    s.n = Math.max(1, Math.round(u.W / 500));
    return s;
  }
  function crPieces(u) {
    var s = crSpec(u), P = [];
    function unit(ct, W, label, extra, dx, tag) { var o = { unit: kUnit(u, ct, W, label, extra), dx: dx }; if (tag) o[tag] = true; P.push(o); }
    var base = { H: s.baseH, D: s.D, elev: s.elev, shelves: 1, drawers: 0, loft: false, sections: s.n };
    if ((u.crBase || "doors") === "drawers") base = Object.assign({}, base, { noDoors: true, shelves: 0, drawers: 2, drawEvery: true, drawerH: Math.floor((s.baseH - 2 * u.T - 12) / 2) });
    unit("overhead", u.W, "Base", base, 0, "base");
    if (s.hutchH >= 300) {
      var hx = { H: s.hutchH, D: s.hutchD, elev: s.hutchElev, shelves: u.crShelves == null ? 2 : u.crShelves, drawers: 0, loft: false, sections: s.n, shutterCol: s.upperCol };
      if (s.upper === "open") unit("bookshelf", u.W, "Display hutch", hx, 0, "hutch");
      else unit("overhead", u.W, "Display hutch", Object.assign({}, hx, { dstyle: s.upper }), 0, "hutch");
    }
    return P;
  }
  function layoutCrockery(u) {
    var s = crSpec(u), L = { boxes: [], handles: [], rods: [] }, D = s.D, T = u.T;
    crPieces(u).forEach(function (p) {
      var lay = shiftLayout(layoutRun(p.unit), p.dx);
      if (p.hutch) {
        shiftLayoutZ(lay, -(D - s.hutchD) / 2);                       /* hutch sits back against the wall */
        lay.boxes.forEach(function (b) {
          if (b.role === "flat" && b.inner) { b.mat = "glass:clear"; b.h = 8; delete b.col; delete b.role; delete b.inner; }   /* glass shelves */
          if (b.role === "back" && (u.crBack || "mirror") === "mirror") { b.mat = "mirror"; delete b.col; delete b.role; delete b.inner; }
        });
      }
      mergeLay(L, lay);
    });
    var topY = s.elev + s.baseH;
    if ((u.crTop || "stone") === "stone") L.boxes.push({ x: 0, y: topY, z: 12, w: u.W + 30, h: 25, d: D + 30, mat: "stone:" + counterKind(u), tile: 1200 });
    else L.boxes.push({ x: 0, y: topY, z: 12, w: u.W + 30, h: T, d: D + 30, col: u.shutterCol, role: "flat" });
    if (s.gap > 0 && s.hutchH >= 300) {
      var back = u.crBack || "mirror";
      if (back === "mirror") L.boxes.push({ x: 0, y: s.baseTop, z: -D / 2 + 9, w: u.W, h: s.gap, d: 6, mat: "mirror" });
      else if (back === "panel") L.boxes.push({ x: 0, y: s.baseTop, z: -D / 2 + 9, w: u.W, h: s.gap, d: 18, col: s.upperCol, role: "back" });
    }
    if (u.crLed !== false) {
      if (s.hutchH >= 300) L.boxes.push({ x: 0, y: s.hutchElev + T + 2, z: -D / 2 + s.hutchD - 40, w: u.W - 40, h: 6, d: 8, mat: "led" });   /* under the hutch front */
      if (s.float) L.boxes.push({ x: 0, y: s.elev - 7, z: D / 2 - 30, w: u.W - 40, h: 6, d: 8, mat: "led" });
    }
    if (!s.float) L.boxes.push({ x: 0, y: 0, z: D / 2 - 60, w: u.W - 40, h: s.elev, d: 18, mat: "kick" });
    roomBoxes(-D / 2 - 7, D).forEach(function (b) { L.boxes.push(b); });
    return [L];
  }
  function crockeryPanels(u) {
    var s = crSpec(u), rows = [];
    crPieces(u).forEach(function (p) {
      panelsForRun(p.unit).forEach(function (r) {
        if (p.hutch && /ADJ Shelf/i.test(r.r)) { rows.push({ h: r.h, w: r.w, q: r.q, r: "Display hutch · Glass shelf 8mm", d: "", col: "Glass", nb: true }); return; }
        if (p.hutch && /Back Panel/i.test(r.r) && (u.crBack || "mirror") === "mirror") { rows.push({ h: r.h, w: r.w, q: r.q, r: "Display hutch · Mirror back 5mm", d: "", col: "Mirror", nb: true }); return; }
        r.r = p.unit.label + " · " + r.r; rows.push(r);
      });
    });
    if ((u.crTop || "stone") === "stone") rows.push({ h: u.W + 30, w: s.D + 30, q: 1, r: "Serving top — stone vendor", d: "", col: STONE_LABEL(counterKind(u)), nb: true });
    else rows.push({ h: u.W + 30, w: s.D + 30, q: 1, r: "Serving top", d: "", col: u.shutterCol });
    if (s.gap > 0 && s.hutchH >= 300) {
      if ((u.crBack || "mirror") === "mirror") rows.push({ h: s.gap, w: u.W, q: 1, r: "Niche mirror 5mm", d: "", col: "Mirror", nb: true });
      else if ((u.crBack || "mirror") === "panel") rows.push({ h: s.gap, w: u.W, q: 1, r: "Niche back panel", d: "", col: s.upperCol });
    }
    if (u.crLed !== false) rows.push({ h: u.W - 40, w: 12, q: (s.float ? 2 : 1), r: "LED profile light (running mm)", d: "", col: "Aluminium profile", nb: true });
    return rows;
  }
  function crockeryElev(u) {
    var d = new Draw(), s = crSpec(u), W = u.W;
    d.line(-300, 0, W + 300, 0, "OUT");
    if (!s.float) d.rect(20, 0, W - 40, s.elev, "THIN");
    d.rect(0, s.elev, W, s.baseH, "OUT"); for (var i = 1; i < s.n; i++) d.line(i * W / s.n, s.elev + 8, i * W / s.n, s.elev + s.baseH - 8, "THIN");
    if ((u.crBase || "doors") === "drawers") d.line(0, s.elev + s.baseH / 2, W, s.elev + s.baseH / 2, "THIN");
    d.rect(-15, s.elev + s.baseH, W + 30, s.topT, "OUT");
    if (s.hutchH >= 300) {
      if (s.gap > 0) d.rect(0, s.baseTop, W, s.gap, "HID");
      d.rect(0, s.hutchElev, W, s.hutchH, "OUT"); for (var j = 1; j < s.n; j++) d.line(j * W / s.n, s.hutchElev + 8, j * W / s.n, s.hutchElev + s.hutchH - 8, "THIN");
      var ns = (u.crShelves == null ? 2 : u.crShelves); for (var k = 1; k <= ns; k++) d.line(20, s.hutchElev + k * s.hutchH / (ns + 1), W - 20, s.hutchElev + k * s.hutchH / (ns + 1), "HID");
      if (s.upper !== "open") for (var g = 0; g < s.n; g++) { var gx = g * W / s.n; d.line(gx + 30, s.hutchElev + 30, gx + W / s.n - 30, s.hutchElev + s.hutchH - 30, "HID"); }
    }
    d.dimH(0, W, 0, -230, W + " mm");
    d.dimV(0, u.H, W, W + 230, String(u.H));
    d.text(W / 2, u.H + 260, "CROCKERY UNIT ELEVATION — " + (u.label || "CROCKERY"), 56);
    var tx = W + 600, ty = -620;
    d.rect(tx, ty, 1650, 430, "OUT"); d.line(tx, ty + 290, tx + 1650, ty + 290, "THIN"); d.line(tx, ty + 150, tx + 1650, ty + 150, "THIN");
    d.text(tx + 825, ty + 330, (S.head.cust || "CUSTOMER") + "   |   " + (S.head.order || "ORDER No"), 54);
    d.text(tx + 825, ty + 190, (u.label || "CROCKERY") + "  W" + W + " H" + u.H + "  " + s.cfg + "  hutch " + s.upper, 58);
    d.text(tx + 825, ty + 50, "CARCASS " + u.carcass + "   SHUTTER " + u.shutterCol + "   " + DS(u.dstyle || "slab").label.toUpperCase(), 46);
    return d;
  }

  /* ══════════ DRESSING TABLE / VANITY ══════════
     console (drawers or doors; floor-standing on a plinth or floating with LED) + top + mirror
     (arched, round, rectangular or full-length, LED-backlit) + optional feature panel, floating
     shelves and a tall storage tower. */
  function drSpec(u) {
    var s = { W: u.W, D: u.D || 450, T: u.T, cfg: u.drConfig || "floor" };
    s.float = s.cfg === "floating"; s.elev = s.float ? 400 : 100; s.consoleH = s.float ? 350 : 650;
    s.topT = (u.drTop || "laminate") === "stone" ? 25 : u.T; s.top = s.elev + s.consoleH + s.topT;
    s.mirror = u.drMirror || "arch"; s.mW = Math.min(u.drMirrorW || 600, u.W - 100); s.mY = s.top + 120;
    s.mH = s.mirror === "round" ? s.mW : s.mirror === "full" ? 1800 : s.mirror === "arch" ? 900 + s.mW / 2 : 900;
    s.n = Math.max(1, Math.round(u.W / 500)); s.tower = u.drTower || "none"; s.tw = 450;
    s.back = u.drBack || "none"; s.backH = 2100; s.backCol = u.drBackCol || u.shutterCol;
    s.shelves = []; var ns = u.drShelves || 0, side = (u.W - s.mW) / 2 - 100;
    if (ns > 0 && s.mirror !== "full" && side >= 350) { var sw = Math.min(700, side - 40); for (var i = 0; i < ns; i++) { var y = s.mY + 150 + i * 400; s.shelves.push({ x: -u.W / 2 + 40 + sw / 2, y: y, w: sw }); s.shelves.push({ x: u.W / 2 - 40 - sw / 2, y: y, w: sw }); } }
    return s;
  }
  function drPieces(u) {
    var s = drSpec(u), P = [];
    function unit(ct, W, label, extra, dx, tag) { var o = { unit: kUnit(u, ct, W, label, extra), dx: dx }; if (tag) o[tag] = true; P.push(o); }
    var base = { H: s.consoleH, D: s.D, elev: s.elev, shelves: 0, drawers: 0, loft: false, sections: s.n };
    if ((u.drBase || "drawers") === "drawers") { var rowsN = s.float ? 1 : 2; base = Object.assign({}, base, { noDoors: true, drawers: rowsN, drawEvery: true, drawerH: Math.floor((s.consoleH - 2 * u.T - 6 * rowsN) / rowsN) }); }
    unit("overhead", u.W, "Console", base, 0, "console");
    var mirrorSide = (s.mirror === "full") ? (s.tower === "left" ? 1 : -1) : 0;
    if (s.tower !== "none") {
      var tExtra = { H: 2100, D: s.D, elev: 0, shelves: 4, shutters: 1, sections: 1, loft: false }, tx = u.W / 2 + s.tw / 2 + 2;
      if (s.tower !== "right") unit("tall", s.tw, "Tower L", tExtra, -tx);
      if (s.tower !== "left") unit("tall", s.tw, "Tower R", tExtra, tx);
    }
    return P;
  }
  function layoutDresser(u) {
    var s = drSpec(u), L = { boxes: [], handles: [], rods: [] }, D = s.D, T = u.T;
    drPieces(u).forEach(function (p) { mergeLay(L, shiftLayout(layoutRun(p.unit), p.dx)); });
    var topY = s.elev + s.consoleH;
    if ((u.drTop || "laminate") === "stone") L.boxes.push({ x: 0, y: topY, z: 12, w: u.W + 30, h: 25, d: D + 30, mat: "stone:" + counterKind(u), tile: 1200 });
    else L.boxes.push({ x: 0, y: topY, z: 12, w: u.W + 30, h: T, d: D + 30, col: u.shutterCol, role: "flat" });
    var zF = -D / 2;
    if (s.back !== "none") {
      L.boxes.push({ x: 0, y: 0, z: -D / 2 - 9, w: u.W, h: s.backH, d: 18, col: s.backCol, role: "back" });
      if (s.back === "fluted") { var nr = Math.floor((u.W - 30) / 24), x0 = -(nr - 1) * 12; for (var i = 0; i < nr; i++) L.boxes.push({ shape: "cyl", r: 9, len: s.backH - 20, x: x0 + i * 24, y: 10, z: -D / 2 + 1, col: s.backCol, role: "front" }); zF = -D / 2 + 10; }
    }
    var mx = 0, mz = zF + 12;
    if (s.mirror === "full") { mx = (s.tower === "left" ? 1 : -1) * (u.W / 2 + 280); }
    function mirrorShape(mat, grow, z) {
      var g = grow || 0;
      if (s.mirror === "rect" || s.mirror === "full") { L.boxes.push({ x: mx, y: (s.mirror === "full" ? 100 : s.mY) - g, z: z, w: (s.mirror === "full" ? 500 : s.mW) + 2 * g, h: (s.mirror === "full" ? 1800 : 900) + 2 * g, d: 6, mat: mat }); }
      else if (s.mirror === "round") { L.boxes.push({ shape: "cyl", r: s.mW / 2 + g, len: 6, x: mx, y: s.mY + s.mW / 2 - 3, z: z, rx: 90, mat: mat }); }
      else if (s.mirror === "arch") { L.boxes.push({ x: mx, y: s.mY - g, z: z, w: s.mW + 2 * g, h: 900 + g, d: 6, mat: mat }); L.boxes.push({ shape: "cyl", r: s.mW / 2 + g, len: 6, x: mx, y: s.mY + 900 - 3, z: z, rx: 90, mat: mat }); }
    }
    if (s.mirror !== "none") {
      if (u.drLed !== false) mirrorShape("led", 28, mz - 4);
      mirrorShape("mirror", 0, mz);
    }
    s.shelves.forEach(function (sh) { L.boxes.push({ x: sh.x, y: sh.y, z: zF + 130, w: sh.w, h: T, d: 220, col: u.shutterCol, role: "flat" }); });
    if (s.float && u.drLed !== false) L.boxes.push({ x: 0, y: s.elev - 7, z: D / 2 - 30, w: u.W - 40, h: 6, d: 8, mat: "led" });
    if (!s.float) L.boxes.push({ x: 0, y: 0, z: D / 2 - 60, w: u.W - 40, h: s.elev, d: 18, mat: "kick" });
    roomBoxes(s.back !== "none" ? -D / 2 - 25 : -D / 2 - 7, D).forEach(function (b) { L.boxes.push(b); });
    return [L];
  }
  function dresserPanels(u) {
    var s = drSpec(u), rows = [];
    drPieces(u).forEach(function (p) { panelsForRun(p.unit).forEach(function (r) { r.r = p.unit.label + " · " + r.r; rows.push(r); }); });
    if ((u.drTop || "laminate") === "stone") rows.push({ h: u.W + 30, w: s.D + 30, q: 1, r: "Dresser top — stone vendor", d: "", col: STONE_LABEL(counterKind(u)), nb: true });
    else rows.push({ h: u.W + 30, w: s.D + 30, q: 1, r: "Dresser top", d: "", col: u.shutterCol });
    if (s.mirror !== "none") {
      var mh = s.mirror === "full" ? 1800 : s.mirror === "round" ? s.mW : s.mirror === "arch" ? 900 + s.mW / 2 : 900, mw = s.mirror === "full" ? 500 : s.mW;
      rows.push({ h: Math.round(mh), w: Math.round(mw), q: 1, r: "Mirror 5mm · " + s.mirror, d: "", col: "Mirror", nb: true });
      if (u.drLed !== false) rows.push({ h: Math.round(2 * (mh + mw)), w: 12, q: 1, r: "LED backlight strip (running mm)", d: "", col: "LED", nb: true });
    }
    if (s.back !== "none") { rows.push({ h: s.backH, w: u.W, q: 1, r: "Feature panel", d: "", col: s.backCol }); if (s.back === "fluted") rows.push({ h: s.backH - 20, w: u.W, q: 1, r: "Reeded overlay (feature panel)", d: "", col: "Fluted MDF", nb: true }); }
    if (s.shelves.length) rows.push({ h: Math.round(s.shelves[0].w), w: 220, q: s.shelves.length, r: "Floating Shelf", d: "", col: u.shutterCol });
    return rows;
  }
  function dresserElev(u) {
    var d = new Draw(), s = drSpec(u), W = u.W, xL = (s.tower === "both" || s.tower === "left") ? 452 : 0, total = W + xL + ((s.tower === "both" || s.tower === "right") ? 452 : 0);
    if (s.mirror === "full") { if (s.tower === "left") total += 560; else { xL += 560; total += 560; } }
    d.line(-300, 0, total + 300, 0, "OUT");
    if (s.back !== "none") d.rect(xL, 0, W, s.backH, "HID");
    if (!s.float) d.rect(xL + 20, 0, W - 40, s.elev, "THIN");
    d.rect(xL, s.elev, W, s.consoleH, "OUT"); for (var i = 1; i < s.n; i++) d.line(xL + i * W / s.n, s.elev + 8, xL + i * W / s.n, s.elev + s.consoleH - 8, "THIN");
    if ((u.drBase || "drawers") === "drawers" && !s.float) d.line(xL, s.elev + s.consoleH / 2, xL + W, s.elev + s.consoleH / 2, "THIN");
    d.rect(xL - 15, s.elev + s.consoleH, W + 30, s.topT, "OUT");
    var cx = xL + W / 2;
    if (s.mirror === "rect") d.rect(cx - s.mW / 2, s.mY, s.mW, 900, "OUT");
    else if (s.mirror === "arch") { d.rect(cx - s.mW / 2, s.mY, s.mW, 900, "OUT"); var R = s.mW / 2, py = s.mY + 900; for (var k = 0; k < 12; k++) { var a1 = Math.PI * k / 12, a2 = Math.PI * (k + 1) / 12; d.line(cx - R * Math.cos(a1), py + R * Math.sin(a1), cx - R * Math.cos(a2), py + R * Math.sin(a2), "OUT"); } }
    else if (s.mirror === "round") { var R2 = s.mW / 2, cy = s.mY + R2; for (var q = 0; q < 24; q++) { var b1 = 2 * Math.PI * q / 24, b2 = 2 * Math.PI * (q + 1) / 24; d.line(cx + R2 * Math.cos(b1), cy + R2 * Math.sin(b1), cx + R2 * Math.cos(b2), cy + R2 * Math.sin(b2), "OUT"); } }
    else if (s.mirror === "full") { var fx = (s.tower === "left") ? xL + W + 30 : xL - 530; d.rect(fx, 100, 500, 1800, "OUT"); }
    s.shelves.forEach(function (sh) { d.rect(cx + sh.x - sh.w / 2, sh.y, sh.w, u.T, "OUT"); });
    if (s.tower === "both" || s.tower === "left") { var tlx = (s.mirror === "full" && s.tower !== "left") ? xL - 452 - 560 : xL - 452; if (s.mirror === "full" && s.tower === "left") tlx = xL - 452; d.rect(tlx, 0, 450, 2100, "OUT"); }
    if (s.tower === "both" || s.tower === "right") d.rect(xL + W + 2 + (s.mirror === "full" && s.tower === "left" ? 560 : 0), 0, 450, 2100, "OUT");
    d.dimH(0, total, 0, -230, total + " mm");
    d.dimV(0, Math.max(s.mY + s.mH, s.tower !== "none" ? 2100 : 0, s.backH * (s.back !== "none" ? 1 : 0)), total, total + 230, String(Math.round(Math.max(s.mY + s.mH, s.tower !== "none" ? 2100 : 0))));
    d.text(total / 2, 2400, "DRESSING UNIT ELEVATION — " + (u.label || "DRESSER"), 56);
    var tx = total + 600, ty = -620;
    d.rect(tx, ty, 1650, 430, "OUT"); d.line(tx, ty + 290, tx + 1650, ty + 290, "THIN"); d.line(tx, ty + 150, tx + 1650, ty + 150, "THIN");
    d.text(tx + 825, ty + 330, (S.head.cust || "CUSTOMER") + "   |   " + (S.head.order || "ORDER No"), 54);
    d.text(tx + 825, ty + 190, (u.label || "DRESSER") + "  W" + W + "  " + s.cfg + "  mirror " + s.mirror, 58);
    d.text(tx + 825, ty + 50, "CARCASS " + u.carcass + "   SHUTTER " + u.shutterCol + "   " + DS(u.dstyle || "slab").label.toUpperCase(), 46);
    return d;
  }

  /* ══════════ VIRTUAL ROOMS (embed / Neo) ══════════
     A room = a floor, three single-sided walls, a window, and a set of catalogue presets
     placed against the walls. Each unit keeps its own composition (kitchen runs, TV walls…);
     its layouts are re-based into the room by composing transforms. */
  var NEO_ROOMS = [
    {
      id: "master", name: "Master Bedroom", W: 4200, D: 4000, blurb: "Sliding glass wardrobe, floating dresser, TV wall.", units: [
        { type: "sliding", style: /^Smoked Glass · Black Profile$/, fmt: /^3000 · slide \+ loft$/, wall: "back", off: 0, label: "Wardrobe" },
        { type: "dresser", style: /^White Handleless · Round LED$/, fmt: /^1200 · floating · round mirror$/, wall: "right", off: 700, label: "Dressing unit" },
        { type: "tv", style: /^Fluted Walnut · Floating$/, fmt: /^1800 · floating · panel 2400$/, wall: "left", off: 700, label: "TV unit" }]
    },
    {
      id: "guest", name: "Guest Bedroom", W: 3600, D: 3600, blurb: "Four-door walnut wardrobe with loft and a floating vanity.", units: [
        { type: "wardrobe", style: /^Walnut Classic$/, fmt: /^2400 · 4 door \+ loft$/, wall: "back", off: 0, label: "Wardrobe" },
        { type: "dresser", style: /^Sage Matte · Arch$/, fmt: /^900 · floating · arch mirror$/, wall: "right", off: 600, label: "Dressing unit" }]
    },
    {
      id: "kids", name: "Kids' Bedroom", W: 3600, D: 3600, blurb: "Pastel wardrobe, open shelving, a compact vanity.", units: [
        { type: "wardrobe", style: /^Powder Blue Pastel$/, fmt: /^1800 · 3 door$/, wall: "back", off: -800, label: "Wardrobe" },
        { type: "bookshelf", style: /^Ivory Slab$/, fmt: /^900 × 2100$/, wall: "back", off: 800, label: "Open shelving" },
        { type: "dresser", style: /^Blush & Brass$/, fmt: /^900 · compact floating · rect$/, wall: "right", off: 600, label: "Study vanity" }]
    },
    {
      id: "walkin", name: "Walk-in Wardrobe", W: 3600, D: 3200, blurb: "Open oak wardrobe wall, shelving and a lit vanity.", units: [
        { type: "wardrobe", style: /^Light Oak Scandi$/, fmt: /^Walk-in 3000 · open$/, wall: "back", off: 0, label: "Wardrobe wall" },
        { type: "bookshelf", style: /^Nordic Oak$/, fmt: /^1200 × 2100$/, wall: "left", off: 700, label: "Shelving" },
        { type: "dresser", style: /^Walnut Floating · Rect LED$/, fmt: /^1200 · floating · round mirror$/, wall: "right", off: 700, label: "Dressing unit" }]
    },
    {
      id: "kitchenL", extend: false, name: "L-shape Kitchen", W: 4900, D: 3600, blurb: "Sage base, oak wall units, oven tower and dishwasher.", units: [
        { type: "kitchen", style: /^Sage & Oak$/, fmt: /^L-shape 3600 \+ 3000 · oven tower$/, wall: "back", off: 0, label: "Kitchen" }]
    },
    {
      id: "island", extend: false, name: "Island Kitchen", W: 4900, D: 4400, blurb: "Handleless white L with a waterfall island.", units: [
        { type: "kitchen", style: /^Handleless White Matte$/, fmt: /^L \+ island 3600 \+ 2400 · 1800$/, wall: "back", off: 0, label: "Kitchen" }]
    },
    {
      id: "galley", extend: false, name: "Parallel Kitchen", W: 3800, D: 3600, blurb: "Charcoal and walnut galley with loft units.", units: [
        { type: "kitchen", style: /^Charcoal & Walnut$/, fmt: /^Parallel 3600 \+ 3600 · loft$/, wall: "back", off: 0, label: "Kitchen" }]
    },
    {
      id: "ukitchen", extend: false, name: "U-shape Kitchen", W: 4900, D: 3600, blurb: "Macchiato and coffee U with oven tower and lofts.", units: [
        { type: "kitchen", style: /^Macchiato & Coffee$/, fmt: /^U-shape 3600 \+ 3000 \+ 3000 · oven tower$/, wall: "back", off: 0, label: "Kitchen" }]
    },
    {
      id: "mediawall", name: "Living Room · Media Wall", W: 4800, D: 4000, blurb: "Fluted walnut wall, smoked-glass towers, 75-inch screen.", units: [
        { type: "tv", style: /^Smoked Glass Towers · Walnut$/, fmt: /^3000 · media wall · 75in$/, wall: "back", off: 0, label: "Media wall" }]
    },
    {
      id: "lounge", name: "Living Room · Lounge", W: 4200, D: 4000, blurb: "Floating console under a fluted panel, walnut shelving.", units: [
        { type: "tv", style: /^Fluted Walnut · Floating$/, fmt: /^2400 · floating · panel 2700$/, wall: "back", off: 0, label: "TV unit" },
        { type: "bookshelf", style: /^Walnut Classic$/, fmt: /^900 × 2100$/, wall: "left", off: 800, label: "Shelving" }]
    },
    {
      id: "dining", name: "Dining Room", W: 4200, D: 3600, blurb: "Buffet with fluted-glass hutch and a sideboard.", units: [
        { type: "crockery", style: /^Fluted Glass Hutch · Walnut$/, fmt: /^2100 · buffet \+ hutch 2400$/, wall: "back", off: 0, label: "Crockery unit" },
        { type: "crockery", style: /^Sage & Oak Sideboard$/, fmt: /^1500 · sideboard \+ open shelves$/, wall: "right", off: 700, label: "Sideboard" }]
    },
    {
      id: "dressing", name: "Dressing Room", W: 3600, D: 3400, blurb: "Dressing wall with towers and a smoked-glass wardrobe.", units: [
        { type: "dresser", style: /^Charcoal & Walnut Tower$/, fmt: /^2100 · dressing wall · towers both$/, wall: "back", off: 0, label: "Dressing wall" },
        { type: "wardrobe", style: /^Smoked Glass · Black Profile$/, fmt: /^2400 · 4 door$/, wall: "left", off: 600, label: "Wardrobe" }]
    },
    {
      id: "study", name: "Home Office", W: 3600, D: 3400, blurb: "Floating desk with shelves, tall cabinet, open shelving.", units: [
        { type: "tv", style: /^Handleless White Float$/, fmt: /^1800 · console only, no TV$/, wall: "back", off: 0, label: "Desk & shelves" },
        { type: "bookshelf", style: /^Nordic Oak$/, fmt: /^1200 × 2100$/, wall: "right", off: 600, label: "Shelving" },
        { type: "tall", style: /^Light Oak Scandi$/, fmt: /^600 × 2100$/, wall: "left", off: 400, label: "Tall cabinet" }]
    },
    {
      id: "foyer", name: "Foyer", W: 3000, D: 2600, blurb: "Shoe cabinet, loft above and a tall walnut cupboard.", units: [
        { type: "shoe", style: /^Walnut Classic$/, fmt: /^1200 × 900$/, wall: "back", off: -600, label: "Shoe cabinet" },
        { type: "overhead", style: /^Walnut Classic$/, fmt: /^1200 · 2 door$/, wall: "back", off: -600, label: "Loft" },
        { type: "tall", style: /^Walnut Classic$/, fmt: /^600 × 2100$/, wall: "back", off: 800, label: "Tall cupboard" }]
    },
    {
      id: "bar", name: "Home Bar & Lounge", W: 4200, D: 3600, blurb: "Gloss bar wall with glass display and a marble TV wall.", units: [
        { type: "crockery", style: /^Gloss White Bar Unit$/, fmt: /^2400 · bar & crockery wall$/, wall: "back", off: 0, label: "Bar unit" },
        { type: "tv", style: /^Marble Wall · Gloss Black$/, fmt: /^1800 · floating · panel 2400$/, wall: "left", off: 700, label: "TV unit" }]
    }
  ];
  /* the curated finishes a Neo client can pick from — six, deliberately */
  var NEO_FINISHES = [
    { id: "walnut", name: "Walnut", shutter: "MDF 3410", carcass: "MDF 1135", dstyle: "slab", handle: "gprof", fin: "black" },
    { id: "oak", name: "Light Oak", shutter: "MDF 2220", carcass: "MDF 1135", dstyle: "slab", handle: "tbar", fin: "nickel" },
    { id: "sage", name: "Sage Matte", shutter: "MDF 7701", carcass: "MDF 1135", dstyle: "slab", handle: "jprof", fin: "nickel" },
    { id: "charcoal", name: "Charcoal Matte", shutter: "MDF 7702", carcass: "MDF 5501", dstyle: "slab", handle: "gola", fin: "black" },
    { id: "gloss", name: "Gloss White", shutter: "MDF 6601", carcass: "MDF 1135", dstyle: "slab", handle: "gprof", fin: "nickel" },
    { id: "white", name: "White Matte · handleless", shutter: "MDF 1135", carcass: "MDF 1135", dstyle: "slab", handle: "none", fin: "nickel" },
    { id: "glass", name: "Fluted Glass · Black", shutter: "MDF 1135", carcass: "MDF 1135", dstyle: "aluglass", tint: "fluted", frame: "black", handle: "none", fin: "black" }
  ];
  var ROOM = { id: null, def: null, units: [], walls: false, extW: 0, extD: 0, handles: true };
  function roomExtendable() { return !!(ROOM.def && ROOM.def.extend !== false); }
  /* the floor plate: anchored at the back-left corner so the furniture never moves when the room grows */
  function roomPlateSpec() {
    var def = ROOM.def, W = def.W, D = def.D, eW = ROOM.extW || W, eD = ROOM.extD || D;
    return { x: -W / 2 + eW / 2, y: -12, z: -D / 2 + eD / 2, w: eW, h: 10, d: eD, mat: "floor", tile: 1200, plate: true, noFrame: (eW === W && eD === D) };
  }
  function roomHandles() {
    var def = ROOM.def, W = def.W, D = def.D, eW = ROOM.extW || W, eD = ROOM.extD || D;
    return [{ id: "w", x: -W / 2 + eW, y: 60, z: -D / 2 + eD / 2, label: eW + " mm" }, { id: "d", x: -W / 2 + eW / 2, y: 60, z: -D / 2 + eD, label: eD + " mm" }];
  }
  var BEDS = { single: { w: 900, l: 1900, name: "SINGLE BED" }, double: { w: 1500, l: 1900, name: "DOUBLE BED" }, queen: { w: 1600, l: 2000, name: "QUEEN BED" }, king: { w: 1800, l: 2000, name: "KING BED" } };
  function roomBrief(b) {
    b = b || {}; if (!ROOM.def) return;
    var def = ROOM.def;
    if (b.exclude && b.exclude.length) { ROOM.units.forEach(function (r) { r.on = !b.exclude.some(function (x) { return r.label.toLowerCase().indexOf(String(x).toLowerCase()) >= 0; }); }); }
    if (b.include && b.include.length) { ROOM.units.forEach(function (r) { if (b.include.some(function (x) { return r.label.toLowerCase().indexOf(String(x).toLowerCase()) >= 0; })) r.on = true; }); }
    if (b.minimal) { roomFinish("white"); ROOM.finish = "white"; } else if (b.finish) { roomFinish(b.finish); ROOM.finish = b.finish; }
    ROOM.bed = null;
    if (b.bed && BEDS[b.bed] && roomExtendable()) {
      var bd = BEDS[b.bed];
      /* the bed sits centred, its head against the furniture line at the back, with 600 walkways */
      var backD = 0; ROOM.units.forEach(function (r) { if (r.on && r.spec.wall === "back") backD = Math.max(backD, (r.u.ctype === "kitchen") ? 580 : (r.u.D || 450)); });
      var sideW = 0; ROOM.units.forEach(function (r) { if (r.on && r.spec.wall !== "back") sideW = Math.max(sideW, (r.u.D || 450)); });
      var needD = backD + 80 + bd.l + 700, needW = bd.w + 2 * (sideW + 700);
      ROOM.extW = Math.max(ROOM.extW || def.W, Math.round(needW / 50) * 50); ROOM.extD = Math.max(ROOM.extD || def.D, Math.round(needD / 50) * 50);
      ROOM.bed = { w: bd.w, l: bd.l, name: bd.name, x: -def.W / 2 + (ROOM.extW) / 2, z: -def.D / 2 + backD + 80 + bd.l / 2 };
    }
    ROOM.brief = b;
  }
  function roomResize(id, val) {
    var def = ROOM.def; if (!def) return;
    if (id === "w") ROOM.extW = Math.max(def.W, Math.min(12000, Math.round(val / 50) * 50));
    else ROOM.extD = Math.max(def.D, Math.min(12000, Math.round(val / 50) * 50));
    if (GL.ok) { GL.plateSet(roomPlateSpec()); GL.handlesSet(roomHandles(), ROOM.bed); }
  }
  function findPreset(type, styleRe, fmtRe) {
    var list = presetsFor(type);
    return list.filter(function (p) { return styleRe.test(p.style.name) && fmtRe.test(p.fmt.label); })[0] || null;
  }
  function asRe(v) { if (v instanceof RegExp) return v; if (typeof v === "string") { if (v.length > 2 && v[0] === "/" && v[v.length - 1] === "/") return new RegExp(v.slice(1, -1)); return new RegExp("^" + v.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$"); } return /./; }
  function roomBuild(id) {
    var def = (id && typeof id === "object")
      ? Object.assign({ id: id.id || "custom", name: id.name || "Custom room", W: id.W || 4000, D: id.D || 3600, extend: id.extend !== false }, id, { units: (id.units || []).map(function (u) { return Object.assign({}, u, { style: asRe(u.style), fmt: asRe(u.fmt) }); }) })
      : (NEO_ROOMS.filter(function (r) { return r.id === id; })[0] || NEO_ROOMS[0]);
    ROOM.id = def.id; ROOM.def = def; ROOM.units = []; ROOM.missing = []; ROOM.extW = def.W; ROOM.extD = def.D; ROOM.bed = null; ROOM.brief = null;
    def.units.forEach(function (spec) {
      var p = findPreset(spec.type, spec.style, spec.fmt);
      if (!p) { ROOM.missing.push(spec.label + " (" + spec.type + ")"); p = presetsFor(spec.type)[0]; }
      var u = presetUnit(p); u.label = spec.label;
      ROOM.units.push({ u: u, spec: spec, on: true, label: spec.label, preset: p.name });
    });
    return def;
  }
  function roomFinish(fid) {
    var f = NEO_FINISHES.filter(function (x) { return x.id === fid; })[0]; if (!f) return;
    ROOM.units.forEach(function (r) {
      var u = r.u, t = u.ctype;
      u.shutterCol = f.shutter; u.carcass = f.carcass; u.handle = f.handle; u.hfinish = f.fin;
      u.shutterCol2 = null; u.hgrain = false;
      if (/^(wardrobe|sliding|overhead|tall)$/.test(t)) u.dstyle = f.dstyle;
      else if (u.dstyle === "aluglass" || u.dstyle === "leather") u.dstyle = "slab";
      if (f.tint) { u.glassTint = f.tint; u.frameFin = f.frame; }
      if (t === "kitchen") { u.kWallCol = null; if (f.dstyle === "aluglass") u.kWallDs = "glass"; }
      if (t === "tv") { u.tvBackCol = null; if (u.tvBack === "stone") u.tvBack = "fluted"; }
      if (t === "crockery") { u.crUpperCol = null; if (f.dstyle === "aluglass") { u.crUpper = "aluglass"; u.glassTint = "fluted"; u.frameFin = "black"; } }
      if (t === "dresser") { u.drBackCol = null; }
    });
    ROOM.finish = fid;
  }
  function roomRestyle(i, styleName) {
    var r = ROOM.units[i]; if (!r) return false;
    var type = r.u.ctype, fmtLabel = r.preset.split(" · ").slice(-1)[0];
    var p = presetsFor(type).filter(function (x) { return x.style.name === styleName && x.name.indexOf(" · " + fmtLabel) > 0; })[0]
      || presetsFor(type).filter(function (x) { return x.style.name === styleName; })[0];
    if (!p) return false;
    var u = presetUnit(p); u.label = r.label; r.u = u; r.preset = p.name; r.style = styleName;
    return true;
  }
  function composeT(place, t) {
    t = t || { tx: 0, tz: 0, ry: 0 };
    var a = place.ry * Math.PI / 180, c = Math.cos(a), s = Math.sin(a);
    return { tx: place.tx + t.tx * c + t.tz * s, tz: place.tz - t.tx * s + t.tz * c, ry: place.ry + t.ry };
  }
  function layoutRoom() {
    var def = ROOM.def, W = def.W, D = def.D, out = [];
    ROOM.units.forEach(function (r) {
      if (!r.on) return;
      var u = r.u, Du = (u.ctype === "kitchen") ? 580 : (u.D || 450), clear = 30 + (/^(tv|dresser|crockery)$/.test(u.ctype) ? 30 : 0);
      var place;
      if (r.spec.wall === "left") place = { tx: -W / 2 + Du / 2 + clear, tz: r.spec.off || 0, ry: 90 };
      else if (r.spec.wall === "right") place = { tx: W / 2 - Du / 2 - clear, tz: r.spec.off || 0, ry: -90 };
      else place = { tx: r.spec.off || 0, tz: -D / 2 + Du / 2 + clear, ry: 0 };
      sceneLayouts(u).forEach(function (lay) {
        lay.boxes = lay.boxes.filter(function (b) { return !b.noFrame; });      /* the unit's own room is dropped */
        lay.boxes.forEach(function (b) { b.unit = r.label; });
        lay.transform = composeT(place, lay.transform);
        out.push(lay);
      });
    });
    if (!ROOM.walls) {                                                         /* open stage */
      if (roomExtendable()) {
        var P = { boxes: [roomPlateSpec()], handles: [], rods: [], transform: null };
        if (ROOM.bed) {
          P.boxes.push({ x: ROOM.bed.x, y: -2, z: ROOM.bed.z, w: ROOM.bed.w, h: 14, d: ROOM.bed.l, mat: "bedmark", bed: true, noFrame: false });
          P.boxes.push({ x: ROOM.bed.x, y: 12, z: ROOM.bed.z - ROOM.bed.l / 2 + 140, w: ROOM.bed.w - 80, h: 12, d: 220, mat: "bedhead", noFrame: true });
        }
        out.push(P);
      }
      return out;
    }
    var R = { boxes: [], handles: [], rods: [], transform: null };
    R.boxes.push({ x: 0, y: -13, z: 0, w: W + 600, h: 12, d: D + 600, mat: "floor", tile: 1200, noFrame: true });
    R.boxes.push({ plane: true, x: 0, y: 0, z: -D / 2, w: W, h: 3000, ry: 0, mat: "wall", noFrame: true });
    R.boxes.push({ plane: true, x: -W / 2, y: 0, z: 0, w: D, h: 3000, ry: 90, mat: "wall", noFrame: true });
    R.boxes.push({ plane: true, x: W / 2, y: 0, z: 0, w: D, h: 3000, ry: -90, mat: "wall", noFrame: true });
    R.boxes.push({ plane: true, x: 0, y: 0, z: -D / 2 + 2, w: W, h: 110, ry: 0, mat: "ao", tile: 110, noFrame: true });
    R.boxes.push({ plane: true, x: -W / 2 + 2, y: 0, z: 0, w: D, h: 110, ry: 90, mat: "ao", tile: 110, noFrame: true });
    R.boxes.push({ plane: true, x: W / 2 - 2, y: 0, z: 0, w: D, h: 110, ry: -90, mat: "ao", tile: 110, noFrame: true });
    /* a high strip window along the left wall: the light source the eye expects, above any furniture */
    R.boxes.push({ plane: true, x: -W / 2 + 3, y: 2080, z: 0, w: D - 800, h: 720, ry: 90, mat: "window", noFrame: true });
    for (var mx = -(D - 800) / 2 + (D - 800) / 4; mx < (D - 800) / 2; mx += (D - 800) / 4) R.boxes.push({ plane: true, x: -W / 2 + 4, y: 2080, z: mx, w: 36, h: 720, ry: 90, mat: "alublack", noFrame: true });
    out.push(R);
    return out;
  }
  function roomStats() {
    var st = { room: ROOM.id, units: 0, panels: 0, sft: 0, boards: 0, pieces: [] };
    ROOM.units.forEach(function (r) {
      var s = 0, q = 0;
      panelsFor(r.u).forEach(function (row) { q += row.q; if (!row.nb) s += sft(row.h, row.w, row.q); });
      st.pieces.push({
        label: r.label, on: r.on, preset: r.preset, type: r.u.ctype, panels: q, sft: Math.round(s * 10) / 10,
        style: (r.style || r.preset.split(" · ").slice(0, -1).join(" · ")), styles: stylesFor(r.u.ctype).map(function (s2) { return s2.name; })
      });
      if (!r.on) return;
      st.units++; st.panels += q; st.sft += s; st.boards += Math.ceil(s / 32);
    });
    st.sft = Math.round(st.sft * 10) / 10;
    if (ROOM.def) { st.roomW = ROOM.extW || ROOM.def.W; st.roomD = ROOM.extD || ROOM.def.D; st.baseW = ROOM.def.W; st.baseD = ROOM.def.D; st.extendable = roomExtendable(); st.bed = ROOM.bed ? ROOM.bed.name + " " + ROOM.bed.w + " × " + ROOM.bed.l : null; st.finish = ROOM.finish || null; }
    return st;
  }

  function sceneLayouts(uOpt) {
    if (!uOpt && ROOM.id) return layoutRoom();
    var u0 = uOpt || U();
    if (!u0) return [];
    if (u0.ctype === "kitchen") return layoutKitchen(u0);
    if (u0.ctype === "tv") return layoutTv(u0);
    if (u0.ctype === "crockery") return layoutCrockery(u0);
    if (u0.ctype === "dresser") return layoutDresser(u0);
    var runs = runsOf(u0), L = [];
    runs.forEach(function (u, i) {
      var lay = u.kind === "imported" ? layoutImported(u) : layoutRun(u);
      lay.transform = i === 1 ? { tx: u0.W / 2 + u0.D / 2 + u0.T, tz: runs[1].W / 2 - u0.D / 2, ry: -90 } : null;
      L.push(lay);
    });
    if (runs[1]) L[0].boxes.push({ x: u0.W / 2 + u0.T / 2, y: 0, z: 0, w: u0.T, h: u0.H + (u0.loft ? u0.loftH + 2 : 0), d: u0.D, col: u0.carcass, role: "side" });
    /* only generate synthetic backdrop wall if NOT working inside architectural CAD project */
    var hasArchProject = (window.OrbixUI && (window.OrbixUI.project || window.OrbixUI.editor)) || (u0 && u0._furnId);
    if (!hasArchProject && runs.length) {
      L.forEach(function (lay, i) {
        var u = runs[i], ww = i ? u.W + 1600 : 16000;
        lay.boxes.push({ x: 0, y: 0, z: -u.D / 2 - 14, w: ww, h: 3000, d: 14, mat: "wall", noFrame: true });
        lay.boxes.push({ x: 0, y: 0, z: -u.D / 2 - 6, w: ww, h: 110, d: 2, mat: "ao", tile: 110, noFrame: true });
      });
      L[0].boxes.push({ x: 0, y: -13, z: 5000 - runs[0].D / 2, w: 16000, h: 12, d: 10000, mat: "floor", tile: 1200, noFrame: true });
    }
    return L;
  }
  function buildScene() {
    var u0 = U();
    var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);

    if (plan) {
      var furnList = plan.furniture || [];
      if (furnList.length === 0 || !u0) {
        MID = 1200;
        if (GL.ok) GL.show([]);
      } else {
        MID = (u0.H + (u0.loft ? u0.loftH + 2 : 0) + (u0.elev || 0)) / 2;
        var L = sceneLayouts();
        if (GL.ok) GL.show(L); else cssRender(L, u0);
      }
      camApply();
      return;
    }

    if (!u0) {
      MID = 1200;
      if (GL.ok) GL.show([]);
      camApply();
      return;
    }
    MID = (u0.H + (u0.loft ? u0.loftH + 2 : 0) + (u0.elev || 0)) / 2;
    var L = sceneLayouts();
    if (GL.ok) GL.show(L); else cssRender(L, u0);
    if (GL.ok && ROOM.id) GL.handlesSet((ROOM.handles && roomExtendable() && !ROOM.walls) ? roomHandles() : [], ROOM.bed);
    camApply();
  }

  /* ══════════ WEBGL RENDERER ══════════ */
  var GL = (function () {
    var ok = false, renderer, scene, camera, root, floor, pmrem, matCache = {}, texCache3 = {}, target, dist = 3000, keyL = null;
    var composer = null, ssao = null, smaa = null;
    function render() { if (composer) composer.render(); else renderer.render(scene, camera); }
    /* ── post-processing: screen-space ambient occlusion (contact shadows in every joint) + SMAA ── */
    function fxInit() {
      if (!ok || composer || !(window.THREE && THREE.EffectComposer && THREE.SSAOPass)) return false;
      var size = renderer.getDrawingBufferSize(new THREE.Vector2());
      composer = new THREE.EffectComposer(renderer);
      composer.renderTarget1.texture.encoding = THREE.sRGBEncoding; composer.renderTarget2.texture.encoding = THREE.sRGBEncoding;
      composer.addPass(new THREE.RenderPass(scene, camera));
      ssao = new THREE.SSAOPass(scene, camera, size.x, size.y);
      ssao.kernelRadius = 70; ssao.minDistance = 0.00025; ssao.maxDistance = 0.009;
      /* the shadow-catcher floor is not a surface to occlude against: keep it out of the normal/depth passes */
      var ro = ssao.renderOverride.bind(ssao);
      ssao.renderOverride = function () { var fv = floor.visible; floor.visible = false; try { ro.apply(null, arguments); } finally { floor.visible = fv; } };
      ssao.enabled = (typeof PARAMS !== "undefined" && PARAMS.get("ssao") === "1");   /* off by default: it blackens slim glass profiles; SMAA + the light-room environment carry the realism */
      composer.addPass(ssao);
      if (THREE.SMAAPass) { smaa = new THREE.SMAAPass(size.x, size.y); composer.addPass(smaa); }
      return true;
    }
    function fxToggle(o) { if (ssao && o.ssao != null) ssao.enabled = !!o.ssao; if (smaa && o.smaa != null) smaa.enabled = !!o.smaa; if (ssao && o.radius) ssao.kernelRadius = o.radius; render(); }
    function fxResize() { if (!composer) return; var s = renderer.getDrawingBufferSize(new THREE.Vector2()); composer.setSize(s.x, s.y); if (ssao) ssao.setSize(s.x, s.y); if (smaa) smaa.setSize(s.x, s.y); }
    /* ── the light room every product photo is shot in: a box with softboxes and a warm window,
       baked to a PMREM so every laminate and glass reflects it ── */
    function makeRoomScene() {
      var s = new THREE.Scene(), geo = new THREE.BoxGeometry(1, 1, 1);
      var room = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ side: THREE.BackSide, color: 0xffffff, roughness: 0.92, metalness: 0 }));
      room.scale.set(9000, 9000, 9000); s.add(room);
      var pl = new THREE.PointLight(0xffffff, 1.1, 30000, 2); pl.position.set(0, 4000, 0); s.add(pl);
      function box(x, y, z, sx, sy, sz, k, col) { var m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: col || 0xffffff })); m.material.color.multiplyScalar(k); m.position.set(x, y, z); m.scale.set(sx, sy, sz); s.add(m); }
      box(-2600, 4400, 1900, 1500, 80, 1500, 6.5);
      box(2300, 4400, -1300, 1200, 80, 1200, 4);
      box(-4490, 1900, 300, 80, 2400, 3000, 5, 0xfff1dd);
      box(4490, 1600, -900, 80, 1500, 1800, 2.5, 0xdce6f7);
      box(0, 4490, -3200, 2800, 80, 900, 3);
      box(0, -4490, 0, 6000, 80, 6000, 0.7, 0xe9e3d8);
      return s;
    }
    function makeFloorMat(type) {
      type = type || window.currentFloorType || "white_tile";
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d");

      if (type === "white_tile") {
        // 800x800 Italian Carrara / Calacatta Polished Marble Slabs
        g.fillStyle = "#D6D6DE"; g.fillRect(0, 0, 512, 512);
        for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          var slabGrad = g.createLinearGradient(tx, ty, tx + tw, ty + th);
          slabGrad.addColorStop(0, "#FAF9FC"); slabGrad.addColorStop(0.5, "#F4F4F8"); slabGrad.addColorStop(1, "#EDECEF");
          g.fillStyle = slabGrad; g.fillRect(tx, ty, tw, th);
          g.strokeStyle = "rgba(255, 255, 255, 0.7)"; g.lineWidth = 1.5; g.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);
          g.strokeStyle = "rgba(140, 148, 160, 0.28)"; g.lineWidth = 2.0;
          g.beginPath(); g.moveTo(tx + 18, ty + 24); g.bezierCurveTo(tx + 90, ty + 85, tx + 130, ty + 160, tx + 235, ty + 225); g.stroke();
          g.strokeStyle = "rgba(155, 162, 175, 0.20)"; g.lineWidth = 1.2;
          g.beginPath(); g.moveTo(tx + 105, ty + 105); g.bezierCurveTo(tx + 160, ty + 95, tx + 195, ty + 130, tx + 240, ty + 145); g.stroke();
          g.strokeStyle = "rgba(185, 155, 115, 0.16)"; g.lineWidth = 1.0;
          g.beginPath(); g.moveTo(tx + 190, ty + 35); g.bezierCurveTo(tx + 125, ty + 95, tx + 75, ty + 175, tx + 45, ty + 238); g.stroke();
        }
      } else if (type === "square_tile") {
        // 600x600 Premium Vitrified Travertine / Ivory Ceramic Tile
        g.fillStyle = "#C8BFB2"; g.fillRect(0, 0, 512, 512);
        for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          var tileGrad = g.createRadialGradient(tx + 126, ty + 126, 40, tx + 126, ty + 126, 130);
          tileGrad.addColorStop(0, "#FAF7F2"); tileGrad.addColorStop(0.85, "#EFEAE0"); tileGrad.addColorStop(1, "#E4DDCF");
          g.fillStyle = tileGrad; g.fillRect(tx, ty, tw, th);
          g.strokeStyle = "rgba(255, 255, 255, 0.55)"; g.lineWidth = 1.2; g.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);
          for (var s = 0; s < 120; s++) {
            var rx = (Math.sin(s * 19.1 + i * 7) * 0.5 + 0.5) * (tw - 8);
            var ry = (Math.cos(s * 29.3 + j * 11) * 0.5 + 0.5) * (th - 8);
            g.fillStyle = (s % 2 === 0) ? "rgba(0,0,0,0.025)" : "rgba(255,255,255,0.06)";
            g.fillRect(tx + 4 + rx, ty + 4 + ry, 2, 2);
          }
        }
      } else if (type === "grey_tile") {
        // 600x1200 Contemporary Basalt / Charcoal Slate Slabs
        g.fillStyle = "#222428"; g.fillRect(0, 0, 512, 512);
        for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
          var tx = i * 256 + 2, ty = j * 256 + 2, tw = 252, th = 252;
          var slateGrad = g.createLinearGradient(tx, ty, tx + tw, ty + th);
          slateGrad.addColorStop(0, (i + j) % 2 ? "#484C55" : "#3E424B"); slateGrad.addColorStop(1, (i + j) % 2 ? "#3A3E47" : "#343841");
          g.fillStyle = slateGrad; g.fillRect(tx, ty, tw, th);
          for (var sl = 0; sl < 16; sl++) {
            var yS = ty + 12 + sl * 15;
            g.strokeStyle = "rgba(255, 255, 255, 0.04)"; g.lineWidth = 1.5;
            g.beginPath(); g.moveTo(tx + 4, yS); g.lineTo(tx + tw - 4, yS + (Math.sin(sl + i) * 3)); g.stroke();
          }
          g.strokeStyle = "rgba(255, 255, 255, 0.08)"; g.lineWidth = 1; g.strokeRect(tx + 1, ty + 1, tw - 2, th - 2);
        }
      } else if (type === "wooden") {
        // Warm Natural European Oak Parquet Planks
        g.fillStyle = "#442D19"; g.fillRect(0, 0, 512, 512);
        var plankH = 64;
        var oakTones = ["#C29F74", "#B69165", "#CBAB82", "#AA855A", "#BE9B70", "#B18B5F", "#C6A57B", "#A58055"];
        for (var p = 0; p < 8; p++) {
          var py = p * plankH + 1, pHeight = plankH - 2, baseWood = oakTones[p % oakTones.length];
          var pGrad = g.createLinearGradient(0, py, 512, py + pHeight);
          pGrad.addColorStop(0, baseWood); pGrad.addColorStop(0.5, oakTones[(p + 2) % oakTones.length]); pGrad.addColorStop(1, baseWood);
          g.fillStyle = pGrad; g.fillRect(2, py, 508, pHeight);
          for (var wLine = 0; wLine < 15; wLine++) {
            var yG = py + 3 + wLine * 4;
            g.strokeStyle = (wLine % 2 === 0) ? "rgba(65, 38, 14, 0.16)" : "rgba(160, 115, 65, 0.18)";
            g.lineWidth = (wLine % 3 === 0) ? 1.6 : 0.9;
            g.beginPath(); g.moveTo(2, yG);
            g.bezierCurveTo(140, yG + Math.sin(p * 1.5 + wLine) * 3.5, 340, yG - Math.cos(p + wLine * 1.2) * 3.5, 510, yG);
            g.stroke();
          }
          g.strokeStyle = "rgba(255, 255, 255, 0.15)"; g.lineWidth = 0.8;
          g.beginPath(); g.moveTo(2, py + 1); g.lineTo(510, py + 1); g.stroke();
        }
      }

      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(120, 120);
      tex.encoding = THREE.sRGBEncoding;
      if (renderer && renderer.capabilities) tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      var isWhite = (type === "white_tile");
      var isWood = (type === "wooden");
      var m = new THREE.MeshStandardMaterial({
        map: tex,
        roughness: isWhite ? 0.12 : (isWood ? 0.34 : 0.28),
        metalness: isWhite ? 0.04 : (isWood ? 0.01 : 0.02)
      });
      return m;
    }
    function makeGrassGroundMat() {
      if (matCache["sp|grassGround"]) return matCache["sp|grassGround"];
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d");
      if (g) {
        // Rich natural lawn grass green base
        g.fillStyle = "#46813A";
        g.fillRect(0, 0, 512, 512);

        // Organic grass sod tone variations
        var lawnTones = ["#3D7333", "#4A883E", "#559947", "#3E7834", "#4F9042", "#5C9F4E"];
        for (var i = 0; i < 400; i++) {
          var x = Math.random() * 512, y = Math.random() * 512, rad = 8 + Math.random() * 24;
          var grad = g.createRadialGradient(x, y, 0, x, y, rad);
          var col = lawnTones[Math.floor(Math.random() * lawnTones.length)];
          grad.addColorStop(0, col);
          grad.addColorStop(1, "rgba(70, 129, 58, 0)");
          g.fillStyle = grad;
          g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
        }

        // Fine lawn grass blades
        for (var b = 0; b < 2500; b++) {
          var bx = Math.random() * 512, by = Math.random() * 512, blen = 3 + Math.random() * 7;
          var bcol = (b % 3 === 0) ? "#65AD55" : ((b % 3 === 1) ? "#3B6E32" : "#4B893F");
          g.strokeStyle = bcol; g.lineWidth = 1.0;
          g.beginPath(); g.moveTo(bx, by); g.lineTo(bx + (Math.random() - 0.5) * 3, by - blen); g.stroke();
        }
      }

      var tex = new THREE.CanvasTexture(c);
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(160, 160);
      tex.encoding = THREE.sRGBEncoding;

      var m = new THREE.MeshStandardMaterial({
        map: tex,
        color: 0x4E8A42,
        roughness: 0.92,
        metalness: 0.0,
        side: THREE.DoubleSide
      });
      matCache["sp|grassGround"] = m;
      return m;
    }
    function makeNeutralGroundMat() {
      return makeGrassGroundMat();
    }
    function init() {
      if (!window.THREE) return false;
      try { renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" }); }
      catch (e) { return false; }
      renderer.setPixelRatio(Math.min(1.5, window.devicePixelRatio || 1));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = (NEO || FX) ? 1.04 : 1.08;
      renderer.shadowMap.enabled = true;
      renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.domElement.id = "gl";
      stage.appendChild(renderer.domElement);
      stage.classList.add("gl");
      scene = new THREE.Scene();
      scene.background = new THREE.Color(0x82C3EC); // Crisp radiant daytime sky blue
      camera = new THREE.PerspectiveCamera(24, 1, 50, 1000000);
      target = new THREE.Vector3();
      pmrem = new THREE.PMREMGenerator(renderer);
      /* fromScene defaults to near/far 0.1–100: the light room is 9 m across, so pass real planes or it bakes black */
      scene.environment = (NEO || FX) ? pmrem.fromScene(makeRoomScene(), 0.04, 10, 30000).texture : pmrem.fromEquirectangular(makeEnv()).texture;
      if (EMBED) camera.far = 80000;
      keyL = new THREE.DirectionalLight(0xfffaec, NEO ? 1.45 : 1.35);
      keyL.position.set(-1700, 3400, 2700); keyL.castShadow = true;
      keyL.shadow.mapSize.set(2048, 2048);
      var sc = keyL.shadow.camera; sc.left = -3400; sc.right = 3400; sc.top = 3400; sc.bottom = -3400; sc.near = 200; sc.far = 14000;
      keyL.shadow.bias = -0.0005; keyL.shadow.normalBias = 3; keyL.shadow.radius = 2.0;
      scene.add(keyL); scene.add(keyL.target);
      /* fill: what a photographer's reflector does — lifts interiors and shaded faces, casts nothing */
      var fill = new THREE.DirectionalLight(0xdde9f8, 0.55); fill.position.set(2600, 1900, 4800); scene.add(fill);
      var rim = new THREE.DirectionalLight(0xecf0f8, 0.35); rim.position.set(2400, 1600, -2600); scene.add(rim);
      var bounceL = new THREE.DirectionalLight(0xf4ece0, 0.32); bounceL.position.set(0, -1800, 1200); scene.add(bounceL);
      scene.add(new THREE.HemisphereLight(0x82C3EC, 0x4E8A42, 0.45)); // Sky blue overhead + grass green ground bounce
      var hasArchHome = (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan && window.OrbixUI.project.plan.walls && window.OrbixUI.project.plan.walls.length > 0);
      floor = new THREE.Mesh(new THREE.PlaneGeometry(300000, 300000), hasArchHome ? makeGrassGroundMat() : makeFloorMat());
      floor.rotation.x = -Math.PI / 2; floor.position.y = -1; floor.receiveShadow = true; scene.add(floor);
      root = new THREE.Group(); scene.add(root);
      ok = true; return true;
    }
    function makeEnv() {
      var c = document.createElement("canvas"); c.width = 1024; c.height = 512;
      var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 512);
      { gr.addColorStop(0, "#f4f5f7"); gr.addColorStop(.38, "#dedcd7"); gr.addColorStop(.5, "#c3c0b8"); gr.addColorStop(.62, "#8f8a80"); gr.addColorStop(1, "#5a5650"); }
      g.fillStyle = gr; g.fillRect(0, 0, 1024, 512);
      /* warm side / cool side */
      var lr = g.createLinearGradient(0, 0, 1024, 0); lr.addColorStop(0, "rgba(255,236,210,.22)"); lr.addColorStop(.5, "rgba(255,255,255,0)"); lr.addColorStop(1, "rgba(205,220,240,.22)");
      g.fillStyle = lr; g.fillRect(0, 0, 1024, 512);
      function soft(x, y, w, h, col, edge) {
        var rg = g.createRadialGradient(x + w / 2, y + h / 2, Math.min(w, h) * 0.25, x + w / 2, y + h / 2, Math.max(w, h) * 0.72);
        rg.addColorStop(0, col); rg.addColorStop(1, "rgba(255,255,255,0)");
        g.fillStyle = rg; g.fillRect(x - edge, y - edge, w + 2 * edge, h + 2 * edge);
      }
      soft(120, 40, 330, 170, "rgba(255,255,255,.55)", 90);     /* glow around the window */
      g.save(); g.shadowColor = "rgba(255,255,255,.9)"; g.shadowBlur = 14; g.fillStyle = "#ffffff";
      g.fillRect(150, 60, 130, 140); g.fillRect(296, 60, 130, 140);   /* two panes, a mullion between */
      g.restore();
      soft(650, 90, 200, 110, "rgba(255,250,240,.9)", 60);      /* softbox right */
      soft(430, 30, 120, 70, "rgba(255,244,225,.85)", 40);      /* warm top light */
      soft(0, 380, 1024, 120, "rgba(235,228,215,.28)", 0);      /* floor bounce */
      var t = new THREE.CanvasTexture(c); t.mapping = THREE.EquirectangularReflectionMapping; t.encoding = THREE.sRGBEncoding; return t;
    }
    function lamTex(l) {
      var k = l.code + "|" + l.hex + "|" + l.kind;
      if (texCache3[k]) return texCache3[k];
      tex(l, 1024);
      var cv = texCanvas[l.code + "|" + l.hex + "|" + l.kind + "|1024"];
      var t = new THREE.CanvasTexture(cv);
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = true;
      texCache3[k] = t; return t;
    }
    var coreT = null;
    function coreTex() {
      if (coreT) return coreT;
      var c = document.createElement("canvas"); c.width = c.height = 128;
      var g = c.getContext("2d"), rnd = mulberry(777);
      g.fillStyle = "#B98F60"; g.fillRect(0, 0, 128, 128);
      for (var i = 0; i < 2600; i++) { g.fillStyle = "rgba(" + (rnd() < .5 ? "60,40,20" : "230,205,170") + "," + (0.08 + rnd() * 0.22).toFixed(2) + ")"; g.fillRect(rnd() * 128, rnd() * 128, 1 + rnd() * 2, 1); }
      coreT = new THREE.CanvasTexture(c); coreT.wrapS = coreT.wrapT = THREE.RepeatWrapping; coreT.repeat.set(3, 3); coreT.encoding = THREE.sRGBEncoding; return coreT;
    }
    function lamMat(l, role) {
      var k = role + "|" + l.code + "|" + l.hex + "|" + l.kind;
      if (matCache[k]) return matCache[k];
      var m;
      if (role === "inner") {
        /* interiors read darker than exteriors — no direct light gets in */
        var ti = lamTex(l);
        m = new THREE.MeshPhysicalMaterial({ map: ti, color: new THREE.Color(0xffffff).multiplyScalar(0.96), emissive: new THREE.Color(l.hex).multiplyScalar(0.16), roughness: 0.58, metalness: 0, clearcoat: 0.08, clearcoatRoughness: 0.5, envMapIntensity: 0.85 });
        if (l.kind !== "gloss") { m.bumpMap = ti; m.bumpScale = 0.3; }
        m.userData.kind = "face";
      } else if (role === "pvc") {
        m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(l.hex).multiplyScalar(0.93), roughness: 0.3, metalness: 0, clearcoat: 0.75, clearcoatRoughness: 0.22, envMapIntensity: 0.9 });
        m.userData.kind = "pvc";
      } else if (role === "core") {
        m = new THREE.MeshStandardMaterial({ color: 0xC49A68, roughness: 0.98, metalness: 0, map: coreTex() });
        m.userData.kind = "core";
      } else {
        var t = lamTex(l), gloss = l.kind === "gloss";
        m = new THREE.MeshPhysicalMaterial({
          map: t, roughnessMap: (l.kind === "wood" ? t : null), roughness: gloss ? 0.05 : (l.kind === "wood" ? 0.8 : 0.48), metalness: 0,
          clearcoat: gloss ? 1 : 0.16, clearcoatRoughness: gloss ? 0.04 : 0.42, envMapIntensity: gloss ? 1.25 : 0.72
        });
        if (!gloss) { m.bumpMap = t; m.bumpScale = l.kind === "wood" ? 0.45 : 0.12; }
        m.userData.kind = "face";
      }
      matCache[k] = m; return m;
    }
    function special(kind) {
      if (matCache["sp|" + kind]) return matCache["sp|" + kind];
      var m;
      switch (kind) {
        case "reveal": m = new THREE.MeshStandardMaterial({ color: 0x1a1613, roughness: 1 }); break;
        case "kick": m = new THREE.MeshStandardMaterial({ color: 0x2b2723, roughness: 0.85 }); break;
        case "granite": m = stoneMat("granite"); break;
        case "marble": m = stoneMat("marble"); break;
        default:
          if (kind.indexOf("stone:") === 0) { m = stoneMat(kind.slice(6)); break; }
          if (kind.indexOf("splash:") === 0) { m = splashMat(kind.slice(7)); break; }
          if (kind.indexOf("glass:") === 0) { m = glassMat(kind.slice(6)); break; }
          if (kind.indexOf("leather:") === 0) { m = leatherMat(kind.slice(8)); break; }
          m = null; break;
        case "ao": m = aoMat(); break;
        case "glass": m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.92, roughness: 0.04, metalness: 0, ior: 1.5, transparent: true, opacity: 1, envMapIntensity: 1.2 }); break;
        case "mirror": m = new THREE.MeshStandardMaterial({ color: 0xf4f4f6, metalness: 1, roughness: 0.06, envMapIntensity: 1.3 }); break;
        case "metal": m = new THREE.MeshStandardMaterial({ color: 0xd7dadd, metalness: 1, roughness: 0.27, envMapIntensity: 1.3 }); break;
        case "metaldark": m = new THREE.MeshStandardMaterial({ color: 0x5c6064, metalness: 1, roughness: 0.35, envMapIntensity: 1.2 }); break;
        case "alublack": m = new THREE.MeshStandardMaterial({ color: 0x202225, metalness: 0.8, roughness: 0.42, envMapIntensity: 0.9 }); break;
        case "led": m = new THREE.MeshBasicMaterial({ color: 0xFFE6B8 }); break;
        case "bedmark": m = new THREE.MeshBasicMaterial({ color: 0x2f5cff, transparent: true, opacity: 0.16 }); break;
        case "bedhead": m = new THREE.MeshBasicMaterial({ color: 0x2f5cff, transparent: true, opacity: 0.32 }); break;
        case "steel": m = new THREE.MeshStandardMaterial({ color: 0xC9CCCF, metalness: 1, roughness: 0.38, envMapIntensity: 1.1 }); break;
        case "hob": m = new THREE.MeshPhysicalMaterial({ color: 0x0b0b0e, roughness: 0.06, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.3 }); break;
        case "tile": m = tileMat(); break;
        case "wall": m = new THREE.MeshStandardMaterial({ color: 0x9E836A, roughness: 0.90, metalness: 0 }); break;
        case "window": m = new THREE.MeshBasicMaterial({ color: NEO ? 0xFFF1DA : 0xFFFDF7 }); break;
        case "floor": m = floorMat(); break;
      }
      if (!m) m = new THREE.MeshStandardMaterial({ color: 0x999999 });
      matCache["sp|" + kind] = m; return m;
    }
    var tileT = null;
    function tileMat() {
      if (matCache["sp|tile"]) return matCache["sp|tile"];
      /* one tile of texture = GRAIN_W × GRAIN_H mm on the wall: 3 × 10 subway tiles with grout */
      var c = document.createElement("canvas"); c.width = 512; c.height = 775;
      var g = c.getContext("2d"); g.fillStyle = "#789E5A"; g.fillRect(0, 0, 512, 775);
      var cols = 3, rows = 10, tw = 512 / cols, th = 775 / rows;
      for (var r = 0; r < rows; r++) {
        var off = (r % 2) ? tw / 2 : 0;
        for (var cI = -1; cI <= cols; cI++) { g.fillStyle = (r + cI) % 3 ? "#BBE696" : "#A8D980"; g.fillRect(cI * tw + off + 3, r * th + 3, tw - 6, th - 6); }
      }
      tileT = new THREE.CanvasTexture(c); tileT.wrapS = tileT.wrapT = THREE.RepeatWrapping; tileT.encoding = THREE.sRGBEncoding;
      var m = new THREE.MeshPhysicalMaterial({ map: tileT, roughness: 0.18, metalness: 0, clearcoat: 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.9 });
      matCache["sp|tile"] = m; return m;
    }
    var floorT = null;
    function floorMat() {
      if (matCache["sp|floor"]) return matCache["sp|floor"];
      var m = makeFloorMat(window.currentFloorType || "white_tile");
      matCache["sp|floor"] = m;
      return m;
    }
    /* ── stone counters: granite speckle / marble veins ── */
    var STONES = {
      granite: { base: "#232427", sp: [["120,122,128", .35], ["200,196,188", .30], ["0,0,0", .5]], n: 26000, veins: 0 },
      galaxy: { base: "#141416", sp: [["214,170,90", .55], ["170,120,70", .35], ["200,200,205", .25]], n: 9000, veins: 0 },
      green: { base: "#1F3A2C", sp: [["0,0,0", .5], ["150,180,150", .30], ["90,110,95", .35]], n: 22000, veins: 0 },
      quartz: { base: "#EEEDE8", sp: [["200,200,195", .25], ["160,160,158", .18]], n: 7000, veins: 0 },
      greyq: { base: "#9A9A97", sp: [["120,120,118", .25], ["215,215,212", .22]], n: 9000, veins: 0 },
      marble: { base: "#EBE7DF", vein: "120,112,100", veins: 7, n: 9000, sp: [["150,140,125", .06]] },
      beige: { base: "#E6DAC5", vein: "150,130,100", veins: 6, n: 9000, sp: [["170,150,120", .07]] }
    };
    function stoneMat(kind) {
      var k = "sp|stone|" + kind; if (matCache[k]) return matCache[k];
      var st = STONES[kind] || STONES.granite;
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d"), rnd = mulberry(911 + kind.length * 37);
      g.fillStyle = st.base; g.fillRect(0, 0, 512, 512);
      for (var i = 0; i < st.n; i++) {
        var p = st.sp[Math.floor(rnd() * st.sp.length)];
        g.fillStyle = "rgba(" + p[0] + "," + (p[1] * (0.4 + rnd() * 0.9)).toFixed(3) + ")";
        var s = st.veins ? 1 : (0.6 + rnd() * 2.2); g.fillRect(rnd() * 512, rnd() * 512, s, s);
      }
      for (var v2 = 0; v2 < (st.veins || 0); v2++) {
        var x = rnd() * 512, y = rnd() * 512, w = 0.6 + rnd() * 2.4;
        for (var pass = 0; pass < 3; pass++) {
          g.strokeStyle = "rgba(" + st.vein + "," + (0.04 + rnd() * 0.08).toFixed(3) + ")"; g.lineWidth = w * (3 - pass);
          g.beginPath(); g.moveTo(x, y);
          var px = x, py = y;
          for (var s2 = 0; s2 < 9; s2++) { px += (rnd() - 0.3) * 120; py += (rnd() - 0.5) * 90; g.quadraticCurveTo(px + (rnd() - 0.5) * 40, py + (rnd() - 0.5) * 40, px, py); }
          g.stroke();
        }
      }
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      var polished = !/quartz|greyq/.test(kind);
      var m = new THREE.MeshPhysicalMaterial({ map: t, roughness: polished ? 0.22 : 0.3, metalness: 0, clearcoat: polished ? 0.7 : 0.35, clearcoatRoughness: 0.12, envMapIntensity: 0.7 });
      matCache[k] = m; return m;
    }
    /* wardrobe glass: clear / frosted / smoked / bronze / fluted (vertical ribs, ~20 mm pitch) */
    function glassMat(tint) {
      var k = "sp|glass|" + tint; if (matCache[k]) return matCache[k];
      var m;
      if (tint === "fluted") {
        var c = document.createElement("canvas"); c.width = 512; c.height = 64;
        var g = c.getContext("2d"), pitch = 512 / 38;
        for (var x = 0; x < 512; x += pitch) {
          var gr = g.createLinearGradient(x, 0, x + pitch, 0);
          gr.addColorStop(0, "#606060"); gr.addColorStop(.5, "#ffffff"); gr.addColorStop(1, "#606060");
          g.fillStyle = gr; g.fillRect(x, 0, pitch + 1, 64);
        }
        var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
        m = new THREE.MeshPhysicalMaterial({ color: 0xEEF1F2, transmission: 0.55, roughness: 0.28, metalness: 0, ior: 1.5, transparent: true, bumpMap: t, bumpScale: 2.2, envMapIntensity: 1.1 });
      } else if (tint === "frost") m = new THREE.MeshPhysicalMaterial({ color: 0xF2F4F5, transmission: 0.5, roughness: 0.5, metalness: 0, ior: 1.5, transparent: true, envMapIntensity: 0.9 });
      else if (tint === "smoke") m = new THREE.MeshPhysicalMaterial({ color: 0x4E5155, transmission: 0.62, roughness: 0.04, metalness: 0, ior: 1.5, transparent: true, envMapIntensity: 1.3 });
      else if (tint === "bronze") m = new THREE.MeshPhysicalMaterial({ color: 0x8A6A48, transmission: 0.6, roughness: 0.04, metalness: 0, ior: 1.5, transparent: true, envMapIntensity: 1.3 });
      else m = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transmission: 0.92, roughness: 0.04, metalness: 0, ior: 1.5, transparent: true, envMapIntensity: 1.2 });
      matCache[k] = m; return m;
    }
    /* upholstered leather panel: pebble grain as colour + bump */
    function leatherMat(hex) {
      var k = "sp|leather|" + hex; if (matCache[k]) return matCache[k];
      var c = document.createElement("canvas"); c.width = c.height = 512;
      var g = c.getContext("2d"), rnd = mulberry(hashStr(hex)); g.fillStyle = hex; g.fillRect(0, 0, 512, 512);
      for (var i = 0; i < 9000; i++) {
        g.fillStyle = rnd() < 0.5 ? "rgba(0,0,0," + (0.015 + rnd() * 0.03).toFixed(3) + ")" : "rgba(255,255,255," + (0.01 + rnd() * 0.025).toFixed(3) + ")";
        var ex = rnd() * 512, ey = rnd() * 512, r = 1.5 + rnd() * 4;
        g.beginPath(); g.ellipse(ex, ey, r, r * (0.6 + rnd() * 0.6), rnd() * Math.PI, 0, Math.PI * 2); g.fill();
      }
      var sh = g.createRadialGradient(256, 256, 120, 256, 256, 380); sh.addColorStop(0, "rgba(255,255,255,0.05)"); sh.addColorStop(1, "rgba(0,0,0,0.06)");
      g.fillStyle = sh; g.fillRect(0, 0, 512, 512);
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      var m = new THREE.MeshPhysicalMaterial({ map: t, bumpMap: t, bumpScale: 0.35, roughness: 0.42, metalness: 0, clearcoat: 0.3, clearcoatRoughness: 0.45, envMapIntensity: 0.8 });
      matCache[k] = m; return m;
    }
    /* backsplash finishes (one texture repeat = 600 mm unless the box says otherwise) */
    function splashMat(spec) {
      var k = "sp|splash|" + spec; if (matCache[k]) return matCache[k];
      var kind = spec.split(":")[0], param = spec.split(":")[1], m;
      if (kind === "glass") {
        m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(param || "#E4E9EC"), roughness: 0.04, metalness: 0, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 1.2 });
        matCache[k] = m; return m;
      }
      var c = document.createElement("canvas"); c.width = 512; c.height = kind === "hex" ? 554 : 512;
      var g = c.getContext("2d"), rnd = mulberry(kind.length * 131);
      if (kind === "largeformat") {
        g.fillStyle = "#BDB9B1"; g.fillRect(0, 0, 512, 512);
        g.fillStyle = "#E9E6E0"; g.fillRect(3, 3, 506, 506);
        for (var i = 0; i < 900; i++) { g.fillStyle = "rgba(120,115,105," + (0.03 + rnd() * 0.05).toFixed(3) + ")"; g.fillRect(rnd() * 512, rnd() * 512, 1 + rnd() * 3, 1); }
      } else if (kind === "chevron") {
        g.fillStyle = "#C9C5BD"; g.fillRect(0, 0, 512, 512);
        g.lineWidth = 56; g.lineCap = "butt"; g.lineJoin = "miter";
        for (var r = -1; r < 9; r++) {
          g.strokeStyle = (r % 2) ? "#F1EFEA" : "#E7E4DD";
          g.beginPath(); for (var x = -128; x <= 640; x += 128) { g.lineTo(x, r * 64 + ((x / 128) % 2 ? 32 : 0)); g.lineTo(x + 64, r * 64 + ((x / 128) % 2 ? 0 : 32)); }
          g.stroke();
        }
      } else if (kind === "hex") {
        g.fillStyle = "#C4C0B8"; g.fillRect(0, 0, 512, 554);
        var R = 36.95, hw = 64, rows = 10;
        for (var rr = -1; rr <= rows; rr++) for (var cc = -1; cc <= 8; cc++) {
          var cx = cc * hw + ((rr % 2) ? hw / 2 : 0), cy = rr * 1.5 * R;
          g.fillStyle = ((rr * 3 + cc) % 5) ? "#F0EEE9" : "#E4E1DA";
          g.beginPath(); for (var q = 0; q < 6; q++) { var an = Math.PI / 6 + q * Math.PI / 3; g.lineTo(cx + (R - 2.2) * Math.cos(an), cy + (R - 2.2) * Math.sin(an)); } g.closePath(); g.fill();
        }
      } else if (kind === "terrazzo") {
        g.fillStyle = "#EDE8DF"; g.fillRect(0, 0, 512, 512);
        var cols = ["#3A3A3C", "#8C8C8A", "#B86A4E", "#D9D3C6", "#6F7C6E", "#C2B49A"];
        for (var t2 = 0; t2 < 420; t2++) {
          var ex = rnd() * 512, ey = rnd() * 512, rw = 3 + rnd() * 11, rh = 3 + rnd() * 9, rot = rnd() * Math.PI;
          g.fillStyle = cols[Math.floor(rnd() * cols.length)];
          [[0, 0], [512, 0], [-512, 0], [0, 512], [0, -512]].forEach(function (o) { g.save(); g.translate(ex + o[0], ey + o[1]); g.rotate(rot); g.beginPath(); g.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2); g.fill(); g.restore(); });
        }
      }
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      m = new THREE.MeshPhysicalMaterial({ map: t, roughness: kind === "terrazzo" ? 0.3 : 0.18, metalness: 0, clearcoat: kind === "terrazzo" ? 0.5 : 0.8, clearcoatRoughness: 0.15, envMapIntensity: 0.9 });
      matCache[k] = m; return m;
    }
    /* ── contact darkening where wall meets floor ── */
    function aoMat() {
      if (matCache["sp|ao"]) return matCache["sp|ao"];
      var c = document.createElement("canvas"); c.width = 4; c.height = 64;
      var g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 64);
      gr.addColorStop(0, "#000000"); gr.addColorStop(.55, "#303030"); gr.addColorStop(1, "#ffffff");
      g.fillStyle = gr; g.fillRect(0, 0, 4, 64);
      var t = new THREE.CanvasTexture(c);
      var m = new THREE.MeshBasicMaterial({ color: 0x000000, alphaMap: t, transparent: true, opacity: 0.34, depthWrite: false });
      matCache["sp|ao"] = m; return m;
    }

    var edgeLM = null;
    function edgeLineMat() { if (!edgeLM) edgeLM = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false }); return edgeLM; }
    function paintMat(hex) {
      var k = "paint|" + hex; if (matCache[k]) return matCache[k];
      var m = new THREE.MeshPhysicalMaterial({ color: new THREE.Color(hex || "#5B6E7A"), metalness: 0.35, roughness: 0.42, clearcoat: 0.5, clearcoatRoughness: 0.3, envMapIntensity: 0.9 });
      m.userData.kind = "paint"; matCache[k] = m; return m;
    }
    var caneT = null;
    function caneMat() {
      if (matCache["sp|cane"]) return matCache["sp|cane"];
      var c = document.createElement("canvas"); c.width = c.height = 256;
      var g = c.getContext("2d");
      g.fillStyle = "#4A3A28"; g.fillRect(0, 0, 256, 256);            /* dark backing shows through the weave */
      g.strokeStyle = "#D2B27A"; g.lineWidth = 11; g.lineCap = "butt";
      for (var i = -256; i < 512; i += 32) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 256, 256); g.stroke(); }
      g.strokeStyle = "#C4A268";
      for (var j = -256; j < 512; j += 32) { g.beginPath(); g.moveTo(j + 256, 0); g.lineTo(j, 256); g.stroke(); }
      g.strokeStyle = "rgba(0,0,0,.18)"; g.lineWidth = 2;
      for (var k2 = -256; k2 < 512; k2 += 32) { g.beginPath(); g.moveTo(k2 + 5, 0); g.lineTo(k2 + 261, 256); g.stroke(); }
      caneT = new THREE.CanvasTexture(c); caneT.wrapS = caneT.wrapT = THREE.RepeatWrapping; caneT.encoding = THREE.sRGBEncoding; caneT.repeat.set(1, 1);
      var m = new THREE.MeshStandardMaterial({ map: caneT, bumpMap: caneT, bumpScale: 1.2, roughness: 0.85, metalness: 0 });
      matCache["sp|cane"] = m; return m;
    }
    function groovedMat(l) {
      var k = "grooved|" + l.code + "|" + l.hex + "|" + l.kind; if (matCache[k]) return matCache[k];
      tex(l, 1024);
      var src = texCanvas[l.code + "|" + l.hex + "|" + l.kind + "|1024"];
      var c = document.createElement("canvas"); c.width = c.height = src.width;
      var g = c.getContext("2d"); g.drawImage(src, 0, 0);
      var pitch = Math.round(src.width / 8);                        /* a groove every ~95 mm */
      for (var x = pitch / 2; x < src.width; x += pitch) {
        g.fillStyle = "rgba(0,0,0,.55)"; g.fillRect(x - 3, 0, 6, src.height);
        g.fillStyle = "rgba(255,255,255,.18)"; g.fillRect(x + 3, 0, 2, src.height);
      }
      var t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.encoding = THREE.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      var m = new THREE.MeshPhysicalMaterial({ map: t, bumpMap: t, bumpScale: 0.9, roughness: l.kind === "gloss" ? 0.08 : 0.5, metalness: 0, clearcoat: l.kind === "gloss" ? 1 : 0.16, clearcoatRoughness: 0.4, envMapIntensity: 0.75 });
      m.userData.kind = "face"; matCache[k] = m; return m;
    }

    function boxMesh(o) {
      if (o.plane) {
        /* a single-sided wall: seen from inside the room, invisible from behind — the camera may orbit freely */
        var pgeo = new THREE.PlaneGeometry(o.w, o.h), pmat = special(o.mat);
        if (o.tile) { var puv = pgeo.attributes.uv; for (var pi = 0; pi < puv.count; pi++) puv.setXY(pi, puv.getX(pi) * o.w / o.tile, puv.getY(pi) * o.h / (o.tileH || o.tile)); puv.needsUpdate = true; }
        var pm = new THREE.Mesh(pgeo, pmat); pm.position.set(o.x, o.y + o.h / 2, o.z); pm.rotation.y = (o.ry || 0) * Math.PI / 180;
        pm.receiveShadow = true; pm.userData.noFrame = true; pm.userData.role = "wall"; return pm;
      }
      if (o.shape === "cyl") {
        var cg = new THREE.CylinderGeometry(o.r, o.r, o.len, 18);
        var cm = o.mat === "paint" ? paintMat(o.paint) : o.mat === "metal" ? metalMat("chrome") : o.mat ? special(o.mat) : lamMat(lam(o.col), "face");
        var cmesh = new THREE.Mesh(cg, cm); cmesh.position.set(o.x, o.y + o.len / 2, o.z);
        if (o.rx) cmesh.rotation.x = o.rx * Math.PI / 180;
        cmesh.castShadow = true; cmesh.receiveShadow = true; cmesh.userData.role = "front"; return cmesh;
      }
      var geo = new THREE.BoxGeometry(o.w, o.h, o.d);
      var uv = geo.attributes.uv, dims = [[o.d, o.h], [o.d, o.h], [o.w, o.d], [o.w, o.d], [o.w, o.h], [o.w, o.h]];
      var RW = o.tile || GRAIN_W, RH = o.tileH || o.tile || GRAIN_H;
      for (var f = 0; f < 6; f++) {
        for (var v = 0; v < 4; v++) {
          var i = f * 4 + v, x = uv.getX(i), y = uv.getY(i);
          if (f === 2 || f === 3) uv.setXY(i, y * dims[f][0] / RH, x * dims[f][1] / RW);   /* grain along the width on flats */
          else if ((f === 4 || f === 5) && o.hgrain) uv.setXY(i, y * dims[f][1] / RW, x * dims[f][0] / RH);   /* horizontal grain fronts */
          else uv.setXY(i, x * dims[f][0] / RW, y * dims[f][1] / RH);
        }
      }
      uv.needsUpdate = true;
      var mats;
      if (o.mat === "paint") mats = paintMat(o.paint);
      else if (o.mat === "cane") mats = caneMat();
      else if (/^(metal|nickel|chrome|brass|black)$/.test(o.mat || "")) mats = metalMat(o.mat === "metal" ? "chrome" : o.mat);
      else if (o.mat) mats = special(o.mat);
      else if (o.role === "drawerbox") { mats = lamMat(lam(o.col), "inner"); }
      else {
        var l = lam(o.col), face = o.grooved ? groovedMat(l) : (o.inner ? lamMat(l, "inner") : lamMat(l, "face")), pvc = lamMat(l, "pvc"), core = lamMat(l, "core");
        var thin = (o.w <= o.h && o.w <= o.d) ? "x" : (o.h <= o.w && o.h <= o.d) ? "y" : "z";
        var e = ebEdges(o.role), keys = ["px", "nx", "py", "ny", "pz", "nz"], axes = ["x", "x", "y", "y", "z", "z"];
        mats = keys.map(function (k, i) { return axes[i] === thin ? face : (e[k] ? pvc : core); });
        if (o.mirror) mats[4] = special("mirror");
      }
      var m = new THREE.Mesh(geo, mats);
      m.userData.box = o;
      if (o.role === "front" && !o.mat && o.d <= 30) {
        var edges = new THREE.LineSegments(new THREE.EdgesGeometry(geo, 20), edgeLineMat());
        edges.scale.set(1.0015, 1.0015, 1.0015); m.add(edges);
      }
      m.userData.role = o.role || o.mat; if (o.noFrame) m.userData.noFrame = true;
      m.castShadow = o.mat !== "reveal" && !/^glass/.test(o.mat || "") && !o.noFrame; m.receiveShadow = true;
      m.position.set(o.x, o.y + o.h / 2, o.z);
      if (o.rx) m.rotation.x = o.rx * Math.PI / 180;
      return m;
    }
    function metalMat(fin) {
      var k = "metal|" + (fin || "chrome"); if (matCache[k]) return matCache[k];
      var m;
      if (fin === "brass") m = new THREE.MeshStandardMaterial({ color: 0xC9A65C, metalness: 1, roughness: 0.3, envMapIntensity: 1.3 });
      else if (fin === "black") m = new THREE.MeshStandardMaterial({ color: 0x242424, metalness: 0.6, roughness: 0.5, envMapIntensity: 0.9 });
      else if (fin === "nickel") m = new THREE.MeshStandardMaterial({ color: 0xC7C4BC, metalness: 1, roughness: 0.44, envMapIntensity: 1.1 });
      else m = new THREE.MeshStandardMaterial({ color: 0xD7DADD, metalness: 1, roughness: 0.27, envMapIntensity: 1.3 });
      matCache[k] = m; return m;
    }
    function handleMesh(h) {
      var hd = h.hd; if (!hd || hd.kind === "none") return null;
      var g = new THREE.Group(), metal = metalMat(h.fin), z = h.z, hy = h.y + h.h / 2, hx, k = hd.kind;
      function add(mesh) { mesh.castShadow = true; g.add(mesh); }
      function cyl(r, len, segs) { return new THREE.CylinderGeometry(r, r, len, segs || 24); }
      if (k === "ibh") { hx = h.cx + (h.hl ? h.w * 0.40 : -h.w * 0.40); var b = new THREE.Mesh(new THREE.BoxGeometry(16, hd.len, 10), metal); b.position.set(hx, hy, z + 5); add(b); }
      else if (k === "bar") {
        hx = h.cx + (h.hl ? h.w * 0.38 : -h.w * 0.38); var vert = h.h > h.w * 1.1;
        var bar = new THREE.Mesh(cyl(6, hd.len), metal); if (!vert) bar.rotation.z = Math.PI / 2; bar.position.set(vert ? hx : h.cx, vert ? hy : hy, z + 26); add(bar);
        [-1, 1].forEach(function (s) { var p = new THREE.Mesh(cyl(5, 26, 16), metal); p.rotation.x = Math.PI / 2; if (vert) p.position.set(hx, hy + s * hd.len / 2.6, z + 13); else p.position.set(h.cx + s * hd.len / 2.6, hy, z + 13); add(p); });
      }
      else if (k === "tbar") {
        hx = h.cx + (h.hl ? h.w * 0.38 : -h.w * 0.38);
        var stem = new THREE.Mesh(cyl(5, 24, 16), metal); stem.rotation.x = Math.PI / 2; stem.position.set(hx, hy, z + 12); add(stem);
        var top = new THREE.Mesh(cyl(6, hd.len), metal); top.rotation.z = Math.PI / 2; top.position.set(hx, hy, z + 26); add(top);
      }
      else if (k === "knob") {
        hx = h.cx + (h.hl ? h.w * 0.36 : -h.w * 0.36);
        var kn = new THREE.Mesh(new THREE.SphereGeometry(16, 28, 20), metal); kn.position.set(hx, hy, z + 19); add(kn);
        var st = new THREE.Mesh(cyl(5, 14, 14), metal); st.rotation.x = Math.PI / 2; st.position.set(hx, hy, z + 7); add(st);
      }
      else if (k === "ring") {
        hx = h.cx + (h.hl ? h.w * 0.36 : -h.w * 0.36);
        var base = new THREE.Mesh(cyl(9, 6, 20), metal); base.rotation.x = Math.PI / 2; base.position.set(hx, hy + 14, z + 3); add(base);
        var ring = new THREE.Mesh(new THREE.TorusGeometry(hd.len / 2, 4, 14, 40), metal); ring.position.set(hx, hy - 6, z + 10); add(ring);
      }
      else if (k === "cup") { hx = h.cx + (h.hl ? h.w * 0.34 : -h.w * 0.34); var c = new THREE.Mesh(new THREE.BoxGeometry(34, hd.len, 14), metal); c.position.set(hx, hy, z + 7); add(c); }
      else if (k === "edge") {
        /* lip that hooks over the top edge of the front */
        var lip = new THREE.Mesh(new THREE.BoxGeometry(hd.len, 12, 24), metal); lip.position.set(h.cx, h.y + h.h - 6, z + 6); add(lip);
        var drop = new THREE.Mesh(new THREE.BoxGeometry(hd.len, 28, 4), metal); drop.position.set(h.cx, h.y + h.h - 24, z + 16); add(drop);
      }
      else if (k === "recess") {
        hx = h.cx + (h.hl ? h.w * 0.36 : -h.w * 0.36);
        var slot = new THREE.Mesh(new THREE.BoxGeometry(hd.len, 26, 10), special("reveal")); slot.position.set(hx, hy, z - 4); g.add(slot);
      }
      else { var pr = new THREE.Mesh(new THREE.BoxGeometry(h.w - 8, 30, 12), metalMat(h.fin === "chrome" ? "nickel" : h.fin)); pr.position.set(h.cx, h.y + h.h - 20, z + 4); add(pr); }
      return g;
    }
    function clear() {
      root.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      while (root.children.length) root.remove(root.children[0]);
      doors = {}; anim = false; xItems = null; xT = 0; selected = null; selectedMats = null;
    }
    /* ── exploded view & assembly: every panel, door and drawer flies out along its own
       direction from the unit's centre — and flies back in one by one ── */
    var xItems = null, xT = 0, xRaf = null;
    function explodeSetup() {
      xItems = []; root.updateMatrixWorld(true);
      root.children.forEach(function (g) {
        var box = new THREE.Box3(); g.traverse(function (o) { if (o.isMesh && !o.userData.noFrame) box.expandByObject(o); });
        if (box.isEmpty()) return;
        var c = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3()), cl = g.worldToLocal(c.clone());
        g.children.forEach(function (o) {
          if (o.userData.noFrame || (o.userData.box && o.userData.box.plate)) return;
          var ob = new THREE.Box3().setFromObject(o); if (ob.isEmpty()) return;
          var oc = g.worldToLocal(ob.getCenter(new THREE.Vector3()));
          var dir = new THREE.Vector3((oc.x - cl.x) / Math.max(1, size.x) * 1100, (oc.y - cl.y) / Math.max(1, size.y) * 600, (oc.z - cl.z) / Math.max(1, size.z) * 900 + 320);
          xItems.push({ o: o, base: o.position.clone(), dir: dir, delay: Math.random() * 0.55 });
        });
      });
    }
    function ease(k) { return k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; }
    function xSet(t) { xItems.forEach(function (it) { it.o.position.copy(it.base).addScaledVector(it.dir, ease(Math.max(0, Math.min(1, t)))); }); render(); }
    function explode(on) {
      if (!ok) return; if (!xItems) explodeSetup();
      if (!on) clearSelect();
      for (var id in doors) { doors[id].req = 0; } resolve(); settle();
      var from = xT, to = on ? 1 : 0, t0 = performance.now(), dur = 950;
      if (xRaf) cancelAnimationFrame(xRaf);
      if (document.hidden) { xT = to; xSet(xT); return; }
      (function step() { var p = Math.min(1, (performance.now() - t0) / dur); xT = from + (to - from) * ease(p); xSet(xT); if (p < 1) xRaf = requestAnimationFrame(step); else xRaf = null; })();
    }
    function assemble() {
      if (!ok) return; if (!xItems) explodeSetup();
      for (var id in doors) { doors[id].req = 0; } resolve(); settle();
      var t0 = performance.now(), dur = 2600;
      if (xRaf) cancelAnimationFrame(xRaf);
      if (document.hidden) { xT = 0; xSet(0); return; }
      (function step() {
        var p = Math.min(1, (performance.now() - t0) / dur);
        xItems.forEach(function (it) { var k = Math.max(0, Math.min(1, (p - it.delay * 0.6) / 0.55)); it.o.position.copy(it.base).addScaledVector(it.dir, (1 - ease(k)) * 1.7); });
        render();
        if (p < 1) xRaf = requestAnimationFrame(step); else { xRaf = null; xT = 0; }
      })();
    }
    /* ── doors: one pivot group per door id; parts and handle are re-parented into it ── */
    var doors = {}, anim = false, allOpen = false;
    function doorGroup(run, spec) {
      var d = doors[spec.id]; if (d) return d.g;
      var g = new THREE.Group(); g.position.set(spec.px, spec.py, spec.pz); g.userData.door = spec.id;
      run.add(g);
      doors[spec.id] = { g: g, spec: spec, t: 0, target: 0, req: 0, base: { x: spec.px, z: spec.pz } };
      return g;
    }
    function show(L) {
      clear();
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;
      var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);

      // Position root to match active furniture unit's floor plan coordinates
      var furnPos = null, furnRot = 0, activeFurnId = null;
      var activeU = U();
      if (activeU && activeU._furnId) {
        activeFurnId = activeU._furnId;
        if (plan && plan.furniture) {
          var match = plan.furniture.find(function (f) { return f.id === activeU._furnId; });
          if (match && match.pos) {
            furnPos = match.pos;
            furnRot = match.rotY || 0;
          }
        }
      }

      // In architectural CAD view, OrbixHome3D renders all placed furniture complete
      // with plinth base legs, carcass, countertop, shutters and shelves.
      if (homeObj && homeObj.children && homeObj.children.length > 0) {
        homeObj.traverse(function (obj) {
          if (obj.userData && obj.userData.isFurnitureGroup) {
            obj.visible = true;
          }
        });
        frame();
        return;
      }
      L.forEach(function (lay) {
        var g = new THREE.Group();
        if (lay.transform) { g.position.set(lay.transform.tx, 0, lay.transform.tz); g.rotation.y = lay.transform.ry * Math.PI / 180; }
        root.add(g);
        lay.boxes.forEach(function (b) {
          var m = boxMesh(b);
          if (b.door) { var dg = doorGroup(g, b.door); g.add(m); dg.attach(m); } else g.add(m);
        });
        lay.handles.forEach(function (h) {
          var m = handleMesh(h); if (!m) return;
          if (h.door) { var dg2 = doorGroup(g, h.door); g.add(m); dg2.attach(m); } else g.add(m);
        });
        lay.rods.forEach(function (r) { var rod = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, r.len, 20), metalMat(r.fin)); rod.rotation.z = Math.PI / 2; rod.position.set(r.x, r.y, r.z); rod.castShadow = true; g.add(rod); });
      });
      frame();
    }
    function applyDoor(d) {
      var s = d.spec, e = d.t < 0.5 ? 2 * d.t * d.t : 1 - Math.pow(-2 * d.t + 2, 2) / 2;   /* ease in-out */
      if (s.kind === "hinge") d.g.rotation.y = s.sign * s.angle * e;
      else { if (s.dx) d.g.position.x = d.base.x + s.dx * e; if (s.dz) d.g.position.z = d.base.z + s.dz * e; }
    }
    function tick() {
      var busy = false;
      for (var id in doors) {
        var d = doors[id];
        if (Math.abs(d.t - d.target) > 0.001) { d.t += (d.target - d.t) * 0.16; if (Math.abs(d.t - d.target) < 0.004) d.t = d.target; applyDoor(d); busy = true; }
      }
      render();
      if (busy) requestAnimationFrame(tick); else anim = false;
    }
    function kick() { if (!anim) { anim = true; requestAnimationFrame(tick); } }
    /* jump every door to its resolved end state (hidden tabs get no animation frames) */
    function settle() { for (var id in doors) { var d = doors[id]; d.t = d.target; applyDoor(d); } if (ok) render(); }
    /* req = what was asked; target = what the cabinet physically allows */
    function resolve() {
      for (var id in doors) {
        var d = doors[id], s = d.spec;
        if (s.drawer && s.behind) {
          var cover = doors[s.behind.id];
          d.target = (d.req && cover && cover.req) ? 1 : 0;
        } else d.target = d.req ? 1 : 0;
      }
    }
    function toggleDoor(id) {
      var d = doors[id]; if (!d) return;
      var s = d.spec;
      if (s.drawer && s.behind) {
        var cover = doors[s.behind.id];
        if (cover && !cover.req) { cover.req = 1; d.req = 1; resolve(); kick(); return; }   /* open the door first */
      }
      d.req = d.req ? 0 : 1; resolve(); kick();
    }
    function toggleAll() {
      allOpen = !allOpen;
      for (var id in doors) {
        var s = doors[id].spec;
        /* sliding pair: move only the primary panel, the other would just swap back */
        if (s.kind === "slide" && !s.drawer && !s.primary) { doors[id].req = 0; continue; }
        doors[id].req = allOpen ? 1 : 0;
      }

      // Also toggle all shutters and drawers in placed 3D furniture (OrbixHome3D)
      var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
      if (plan && plan.furniture && plan.furniture.length > 0) {
        plan.furniture.forEach(function (fn) {
          var isFcm = !!(
            (fn.unitConfig && fn.unitConfig.fixedPanel && fn.unitConfig.fixedPanel.enabled) ||
            (fn.unitConfig && fn.unitConfig.unitType === 'fcm-rt') ||
            (fn.id && /fcm[-_ ]*rt/i.test(fn.id)) ||
            (fn.catalogItemId && /fcm[-_ ]*rt/i.test(fn.catalogItemId)) ||
            (fn.name && /fcm[-_ ]*rt/i.test(fn.name)) ||
            fn.id === 'fcm-rt' || fn.catalogItemId === 'fcm-rt' ||
            fn.id === 'fm-rt-01' || fn.catalogItemId === 'fm-rt-01'
          );
          var numShutters = isFcm ? 1 : ((fn.unitConfig && fn.unitConfig.shutters !== undefined) ? parseInt(fn.unitConfig.shutters) : ((fn.dimensions && fn.dimensions.W > 1200) ? 3 : 2));
          var numDrawers = (fn.unitConfig && fn.unitConfig.drawers !== undefined) ? parseInt(fn.unitConfig.drawers) : 0;
          fn.shutterStates = fn.shutterStates || [];
          for (var s = 0; s < numShutters; s++) fn.shutterStates[s] = allOpen;
          fn.drawerStates = fn.drawerStates || [];
          for (var d = 0; d < numDrawers; d++) fn.drawerStates[d] = allOpen;
        });
        if (window.OrbixUI && typeof window.OrbixUI.render3DHome === 'function') {
          window.OrbixUI.render3DHome(true);
        }
        if (window.OrbixUI && window.OrbixUI.editor && window.OrbixUI.editor.selected && typeof window.OrbixUI.renderInspector === 'function') {
          window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
        }
        if (window.OrbixUI && typeof window.OrbixUI.saveToLocalStorage === 'function') {
          window.OrbixUI.saveToLocalStorage();
        }
      }

      resolve(); kick(); return allOpen;
    }
    var ray = null, ndc = null, selected = null, selectedMats = null;
    /* ── room extension handles: blue dots on the plate edges with live dimensions ── */
    var hGroup = null, hMeshes = {}, hSprites = {};
    function labelSprite(text) {
      /* the pill grows with the text so long labels ("DOUBLE BED 1500×1900") are never clipped */
      var m = document.createElement("canvas").getContext("2d"); m.font = "600 34px IBM Plex Mono, Menlo, monospace";
      var tw = Math.ceil(m.measureText(text).width), cw = Math.max(256, tw + 64);
      var c = document.createElement("canvas"); c.width = cw; c.height = 80; var g = c.getContext("2d");
      g.fillStyle = "rgba(10,10,11,0.82)"; g.beginPath(); g.roundRect ? g.roundRect(4, 8, cw - 8, 64, 32) : g.rect(4, 8, cw - 8, 64); g.fill();
      g.fillStyle = "#ffffff"; g.font = "600 34px IBM Plex Mono, Menlo, monospace"; g.textAlign = "center"; g.textBaseline = "middle"; g.fillText(text, cw / 2, 42);
      var t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding;
      var s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false })); s.scale.set(760 * cw / 256, 238, 1); s.renderOrder = 999; return s;
    }
    function handlesSet(list, bed) {
      if (!ok) return;
      if (!hGroup) { hGroup = new THREE.Group(); scene.add(hGroup); }
      while (hGroup.children.length) hGroup.remove(hGroup.children[0]);
      hMeshes = {}; hSprites = {};
      if (bed) { var bs = labelSprite(bed.name + " " + bed.w + "×" + bed.l); bs.position.set(bed.x, 320, bed.z); bs.scale.multiplyScalar(1.15); hGroup.add(bs); }
      (list || []).forEach(function (h) {
        var dot = new THREE.Mesh(new THREE.SphereGeometry(75, 24, 18), new THREE.MeshBasicMaterial({ color: 0x2f5cff }));
        var core = new THREE.Mesh(new THREE.SphereGeometry(32, 16, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        dot.add(core); dot.position.set(h.x, h.y, h.z); dot.userData.handle = h.id; dot.renderOrder = 998; dot.material.depthTest = false; core.material.depthTest = false; core.renderOrder = 999;
        hGroup.add(dot); hMeshes[h.id] = dot;
        var sp = labelSprite(h.label); sp.position.set(h.x, h.y + 330, h.z); hGroup.add(sp); hSprites[h.id] = sp;
      });
      render();
    }
    function plateSet(spec) {
      if (!ok) return;
      var old = null; root.traverse(function (o) { if (o.isMesh && o.userData.box && o.userData.box.plate) old = o; });
      var m = boxMesh(spec);
      if (old) { old.parent.add(m); old.parent.remove(old); old.geometry.dispose(); } else root.add(m);
      render();
    }
    function handleAt(clientX, clientY) {
      if (!ok || !hGroup || !hGroup.children.length) return null;
      if (!ray) { ray = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
      var r = stage.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(Object.keys(hMeshes).map(function (k) { return hMeshes[k]; }), true);
      for (var i = 0; i < hits.length; i++) { var o = hits[i].object; while (o && !o.userData.handle) o = o.parent; if (o) return o.userData.handle; }
      return null;
    }
    var floorPlane = null, hitV = null;
    function floorPoint(clientX, clientY) {
      if (!ray) { ray = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
      if (!floorPlane) { floorPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); hitV = new THREE.Vector3(); }
      var r = stage.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      return ray.ray.intersectPlane(floorPlane, hitV) ? { x: hitV.x, z: hitV.z } : null;
    }
    var PART_NAMES = { side: "Side panel", flat: "Shelf / top / bottom", back: "Back panel", vp: "Vertical partition", front: "Shutter / front", drawerbox: "Drawer box", wall: "Wall" };
    var MAT_NAMES = { kick: "Plinth / kick", hob: "Glass screen", steel: "Appliance body", metal: "Metal fitting", nickel: "Hinge", alublack: "Aluminium profile", black: "Black profile", brass: "Brass profile", mirror: "Mirror", led: "LED profile light", tile: "Tile backsplash", reveal: "Reveal", cane: "Cane panel", paint: "Painted steel" };
    function describe(m) {
      var o = m.userData.box || {}, out = { part: "Panel", unit: o.unit || null, w: Math.round(o.w || 0), h: Math.round(o.h || 0), d: Math.round(o.d || 0) };
      if (o.shape === "cyl") { out.part = o.mat === "metal" ? "Metal rod / handle" : "Reed"; out.w = Math.round(o.r * 2); out.h = Math.round(o.len); out.d = Math.round(o.r * 2); }
      else if (o.mat) {
        var k = String(o.mat); out.part = MAT_NAMES[k] || (k.indexOf("glass:") === 0 ? (k.slice(6) + " glass pane") : k.indexOf("stone:") === 0 ? (STONE_LABEL(k.slice(6)) + " stone") : k.indexOf("splash:") === 0 ? "Backsplash" : k.indexOf("leather:") === 0 ? "Leather panel" : k);
        out.part = out.part.charAt(0).toUpperCase() + out.part.slice(1);
      } else {
        out.part = PART_NAMES[o.role] || "Panel";
        if (o.col) { var l = lam(o.col); out.laminate = { code: l.code, name: l.name, hex: l.hex }; }
        var e = ebEdges(o.role || ""), n = 0; for (var kk in e) if (e[kk]) n++; out.edges = n; out.thickness = Math.min(o.w, o.h, o.d);
        if (o.hgrain) out.grain = "horizontal";
      }
      return out;
    }
    function clearSelect() { if (selected && selectedMats) { selected.material = selectedMats; } selected = null; selectedMats = null; }
    function highlight(m) {
      clearSelect(); selected = m; selectedMats = m.material;
      var mats = Array.isArray(m.material) ? m.material : [m.material];
      var hl = mats.map(function (mat) { var c = mat.clone(); if (c.emissive) { c.emissive = new THREE.Color(0x2f5cff); c.emissiveIntensity = 0.55; } else if (c.color) { c.color = c.color.clone().lerp(new THREE.Color(0x2f5cff), 0.5); } return c; });
      m.material = Array.isArray(m.material) ? hl : hl[0];
    }
    function pickPanel(clientX, clientY) {
      if (!ok) return null;
      if (!ray) { ray = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
      var r = stage.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(root.children, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        if (!o.isMesh || o.userData.noFrame || !o.userData.box) continue;
        if (o.userData.box.mat === "reveal" || o.userData.box.plate || o.userData.box.bed || o.userData.box.mat === "bedhead") continue;
        if (selected === o) { clearSelect(); render(); return null; }
        highlight(o); render(); return describe(o);
      }
      clearSelect(); render(); return null;
    }
    function pick(clientX, clientY) {
      if (!ok) return false;
      if (xT > 0.5) { var item = pickPanel(clientX, clientY); if (EMBED) postUp({ event: "select", item: item }); return !!item; }
      if (!ray) { ray = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
      var r = stage.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);

      // 1. Check single unit preview in root (if active)
      if (root && root.children.length > 0) {
        var hits = ray.intersectObjects(root.children, true);
        for (var i = 0; i < hits.length; i++) {
          var o = hits[i].object;
          while (o && !o.userData.door) o = o.parent;
          if (o) { toggleDoor(o.userData.door); return true; }
          if (hits[i].object.userData.role && hits[i].object.userData.role !== "reveal") return false;
        }
      }

      // 2. Check placed modular units in 3D Home (OrbixHome3D)
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;
      if (homeObj && homeObj.children && homeObj.children.length > 0) {
        var homeHits = ray.intersectObjects(homeObj.children, true);
        for (var j = 0; j < homeHits.length; j++) {
          var ho = homeHits[j].object;
          var part = ho;
          while (part && part !== homeObj) {
            if (part.userData && (part.userData.isShutter || part.userData.isDrawer)) {
              break;
            }
            part = part.parent;
          }

          if (part && part.userData && part.userData.furnitureId) {
            var fId = part.userData.furnitureId;
            var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
            var fn = plan && plan.furniture && plan.furniture.find(function (it) { return it.id === fId; });

            if (fn) {
              if (part.userData.isShutter) {
                var sIdx = part.userData.shutterIdx !== undefined ? part.userData.shutterIdx : 0;
                fn.shutterStates = fn.shutterStates || [];
                fn.shutterStates[sIdx] = !fn.shutterStates[sIdx];
                var isOpen = fn.shutterStates[sIdx];
                if (part.userData.isSliding) {
                  var sGroup = part.userData.shutterGroup || (part.parent && part.parent.userData && part.parent.userData.isSliding ? part.parent : null);
                  if (sGroup && sGroup.userData && sGroup.userData.openX !== undefined) {
                    sGroup.position.x = isOpen ? sGroup.userData.openX : sGroup.userData.closedX;
                    render();
                  } else if (window.OrbixUI && window.OrbixUI.render3DHome) {
                    window.OrbixUI.render3DHome(true);
                  }
                } else {
                  var hingeGroup = part.userData.hingeGroup || (part.parent && part.parent.userData && part.parent.userData.isShutterHinge ? part.parent : null);
                  if (hingeGroup) {
                    var hingeLeft = (hingeGroup.name === "ShutterHinge_Right" || hingeGroup.name === "ShutterHinge_1") ? false : (hingeGroup.name === "ShutterHinge_Left" || hingeGroup.name === "ShutterHinge_0" ? true : (sIdx % 2 === 0));
                    hingeGroup.rotation.y = isOpen ? (hingeLeft ? -Math.PI * 0.6 : Math.PI * 0.55) : 0;
                    render();
                  } else if (window.OrbixUI && window.OrbixUI.render3DHome) {
                    window.OrbixUI.render3DHome(true);
                  }
                }
                if (window.OrbixUI && window.OrbixUI.editor) {
                  window.OrbixUI.editor.selected = [{ type: 'furniture', id: fId }];
                  if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
                }
                if (window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
                if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
                return true;
              } else if (part.userData.isDrawer) {
                var dIdx = part.userData.drawerIdx !== undefined ? part.userData.drawerIdx : 0;
                fn.drawerStates = fn.drawerStates || [];
                fn.drawerStates[dIdx] = !fn.drawerStates[dIdx];
                var isDOpen = fn.drawerStates[dIdx];
                var drawerGroup = part.userData.drawerGroup || (part.parent && part.parent.userData && part.parent.userData.isDrawerGroup ? part.parent : null);
                if (drawerGroup) {
                  drawerGroup.position.z = isDOpen ? 350 : 0;
                  render();
                } else if (window.OrbixUI && window.OrbixUI.render3DHome) {
                  window.OrbixUI.render3DHome(true);
                }
                if (window.OrbixUI && window.OrbixUI.editor) {
                  window.OrbixUI.editor.selected = [{ type: 'furniture', id: fId }];
                  if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
                }
                if (window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
                if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
                return true;
              }
            }
          }
        }
      }

      return false;
    }
    function pickFurniture(clientX, clientY) {
      if (!ok || !scene) return null;
      if (!ray) { ray = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
      var r = stage.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);

      var activeU = U();
      if (activeU && activeU._furnId && root && root.children.length > 0) {
        var rootHits = ray.intersectObjects(root.children, true);
        if (rootHits.length > 0) {
          return { object: root, id: activeU._furnId, hitPoint: rootHits[0].point };
        }
      }

      var homeObj = scene.getObjectByName('OrbixHome3D');
      if (!homeObj) return null;
      var hits = ray.intersectObjects(homeObj.children, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        if (o && o.userData && o.userData.furnitureId) {
          return { object: (o.userData.parentGroup || o), id: o.userData.furnitureId, hitPoint: hits[i].point };
        }
        while (o && o.parent && o.parent !== homeObj && (!o.userData || !o.userData.isFurnitureGroup)) {
          o = o.parent;
        }
        if (o && o.userData && (o.userData.isFurniture || o.userData.isFurnitureGroup)) {
          return { object: o, id: o.userData.furnitureId, hitPoint: hits[i].point };
        }
      }
      return null;
    }
    function frame(forceMode) {
      if (!ok) return;
      var mode = forceMode || window.Orbix3DViewMode || 'unit';
      var box = new THREE.Box3();
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;

      // 1. In 'unit' mode, frame the active unit's parametric model in root
      if (mode === 'unit' && root && root.children.length > 0) {
        root.updateMatrixWorld(true);
        root.traverse(function (o) { if (o.isMesh && !o.userData.noFrame) box.expandByObject(o); });
      }

      // 2. In 'home' mode, or if root was empty, frame the full architectural house
      if (box.isEmpty() && homeObj && homeObj.children.length > 0) {
        homeObj.updateMatrixWorld(true);
        homeObj.traverse(function (o) { if (o.isMesh && o.visible) box.expandByObject(o); });
        if (box.isEmpty()) {
          homeObj.traverse(function (o) { if (o.isMesh) box.expandByObject(o); });
        }
      }

      // 3. Fallback to root
      if (box.isEmpty() && root && root.children.length > 0) {
        root.updateMatrixWorld(true);
        root.traverse(function (o) { if (o.isMesh && !o.userData.noFrame) box.expandByObject(o); });
      }

      if (box.isEmpty()) return;
      if (box.max.y - box.min.y < 100) box.max.y = box.min.y + 1500;
      var size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      target.copy(c);
      if (keyL) {
        var half = Math.max(size.x, size.z, size.y) * 0.72 + 400, scm = keyL.shadow.camera;
        keyL.target.position.copy(c); keyL.position.set(c.x - 1700, c.y + 3400, c.z + 2700);
        scm.left = -half; scm.right = half; scm.top = half; scm.bottom = -half; scm.near = 200; scm.far = half * 2 + 6000;
        scm.updateProjectionMatrix(); keyL.target.updateMatrixWorld();
      }
      cachedStageRect = stage.getBoundingClientRect();
      var r = cachedStageRect, aspect = (r.width && r.height) ? r.width / r.height : 1.6;
      var t = Math.tan(camera.fov * Math.PI / 360);
      var dH = (size.y * 1.06) / (2 * t), dW = (Math.hypot(size.x, size.z) * 0.78) / (2 * t * aspect);
      var k = (mode === 'home' && homeObj) ? 1.25 : (ROOM.id ? 1.16 : 1.22);
      dist = Math.max(dH, dW) * k + size.z * 0.5;
    }
    function updateWallCutaway() {
      var homeObj = scene ? scene.getObjectByName('OrbixHome3D') : null;
      if (!homeObj) return;

      var mode = window.OrbixWallMode || 'cutaway';
      homeObj.children.forEach(function (child) {
        if (child.userData && child.userData.isWall) {
          if (mode === 'all') {
            child.visible = true;
            return;
          }
          if (mode === 'hidden') {
            child.visible = false;
            return;
          }
          // Auto-cutaway mode
          var wMid = child.userData.mid;
          if (!wMid) return;

          var camToTargX = target.x - camera.position.x;
          var camToTargZ = target.z - camera.position.z;
          var camToTargDist = Math.hypot(camToTargX, camToTargZ) || 1;

          var camToWallX = wMid.x - camera.position.x;
          var camToWallZ = wMid.y - camera.position.z;
          var camToWallDist = Math.hypot(camToWallX, camToWallZ) || 1;

          var dot = (camToTargX * camToWallX + camToTargZ * camToWallZ) / (camToTargDist * camToWallDist);

          // Obstructing if between camera and interior
          var isObstructing = (camToWallDist < camToTargDist * 0.95 && dot > 0.35);
          child.visible = !isObstructing;
        }
      });
    }

    var cachedStageRect = null;
    var rafPending = false;
    function requestRender() {
      if (rafPending) return;
      rafPending = true;
      requestAnimationFrame(function () {
        rafPending = false;
        render();
      });
    }

    if (typeof window !== 'undefined') {
      window.addEventListener('resize', function () {
        cachedStageRect = null;
      });
    }

    function apply(forceSync) {
      if (!ok) return;
      if (!cachedStageRect) {
        cachedStageRect = stage.getBoundingClientRect();
      }
      var r = cachedStageRect;
      if (r && r.width && r.height) {
        var cw0 = renderer.domElement.width;
        renderer.setSize(r.width, r.height, false);
        if (renderer.domElement.width !== cw0) fxResize();
        camera.aspect = r.width / r.height;
        camera.updateProjectionMatrix();
      }
      var yaw = cam.yaw * Math.PI / 180, el = (-cam.pitch) * Math.PI / 180;
      var safeZoom = Math.max(0.15, 1 + cam.zoom);
      var d = dist / safeZoom;
      if (camera.far < d * 4) {
        camera.far = Math.max(1000000, d * 5);
        camera.updateProjectionMatrix();
      }
      camera.position.set(target.x + d * Math.sin(yaw) * Math.cos(el), target.y + d * Math.sin(el), target.z + d * Math.cos(yaw) * Math.cos(el));
      camera.lookAt(target);
      updateWallCutaway();
      if (forceSync) {
        render();
      } else {
        requestRender();
      }
    }
    /* ── offscreen thumbnail renderer (own context, own environment) ── */
    var tR = null, tScene, tCam, tRoot;
    function thumbInit() {
      if (tR) return true;
      try { tR = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); } catch (e) { return false; }
      tR.setPixelRatio(1); tR.setSize(640, 480, false); tR.setClearColor(0xDCDAD4, 1);
      tR.outputEncoding = THREE.sRGBEncoding; tR.toneMapping = THREE.ACESFilmicToneMapping; tR.toneMappingExposure = 1.02;
      tR.shadowMap.enabled = true; tR.shadowMap.type = THREE.PCFSoftShadowMap;
      tScene = new THREE.Scene();
      tScene.environment = new THREE.PMREMGenerator(tR).fromEquirectangular(makeEnv()).texture;
      var key = new THREE.DirectionalLight(0xfff3e4, 1.45); key.position.set(-1700, 3400, 2700); key.castShadow = true;
      key.shadow.mapSize.set(1024, 1024); var sc = key.shadow.camera; sc.left = -3400; sc.right = 3400; sc.top = 3400; sc.bottom = -3400; sc.near = 200; sc.far = 14000; key.shadow.bias = -0.0004;
      tScene.add(key);
      tScene.add(new THREE.HemisphereLight(0xeef1f5, 0x8c8478, 0.32));
      var fl = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), new THREE.ShadowMaterial({ opacity: 0.35 })); fl.rotation.x = -Math.PI / 2; fl.receiveShadow = true; tScene.add(fl);
      tCam = new THREE.PerspectiveCamera(25, 640 / 480, 120, 80000);
      tRoot = new THREE.Group(); tScene.add(tRoot);
      return true;
    }
    function snapshot(w, h) {
      if (!ok) return null;
      var cv = renderer.domElement, pr = renderer.getPixelRatio(), cw = cv.width / pr, ch = cv.height / pr;
      renderer.setPixelRatio(1); renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix();
      renderer.setClearColor(0xE6E4DF, 1); fxResize(); render();
      var url = null; try { url = cv.toDataURL("image/jpeg", 0.88); } catch (err) { }
      renderer.setClearColor(0x000000, 0);
      renderer.setPixelRatio(pr); renderer.setSize(cw, ch, false); fxResize(); camera.aspect = cw / ch; camera.updateProjectionMatrix();
      return url;
    }
    function thumb(u) {
      if (!ok || !thumbInit()) return null;
      tRoot.traverse(function (o) { if (o.geometry) o.geometry.dispose(); });
      while (tRoot.children.length) tRoot.remove(tRoot.children[0]);
      var lays = /^(kitchen|tv|crockery|dresser)$/.test(u.ctype || "") ? sceneLayouts(u) : [(u.kind === "imported") ? layoutImported(u) : layoutRun(u)];
      var g = new THREE.Group();
      lays.forEach(function (lay) {
        var rg = new THREE.Group();
        if (lay.transform) { rg.position.set(lay.transform.tx, 0, lay.transform.tz); rg.rotation.y = lay.transform.ry * Math.PI / 180; }
        lay.boxes.forEach(function (b) { if (b.noFrame) return; rg.add(boxMesh(b)); });
        lay.handles.forEach(function (h) { var m = handleMesh(h); if (m) rg.add(m); });
        g.add(rg);
      });
      var lay = lays[0];
      lay.boxes = []; lay.handles = [];   /* already drawn per run above */
      lay.handles.forEach(function (h) { var m = handleMesh(h); if (m) g.add(m); });
      lay.rods.forEach(function (r) { var rod = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, r.len, 14), metalMat(r.fin)); rod.rotation.z = Math.PI / 2; rod.position.set(r.x, r.y, r.z); g.add(rod); });
      tRoot.add(g);
      var box = new THREE.Box3().setFromObject(tRoot), size = box.getSize(new THREE.Vector3()), c = box.getCenter(new THREE.Vector3());
      var t = Math.tan(tCam.fov * Math.PI / 360), dH = (size.y * 1.08) / (2 * t), dW = (Math.hypot(size.x, size.z) * 0.8) / (2 * t * (640 / 480));
      var dist = Math.max(dH, dW) * 1.12 + size.z * 0.5, yaw = -0.42, el = 0.14;
      tCam.position.set(c.x + dist * Math.sin(yaw) * Math.cos(el), c.y + dist * Math.sin(el), c.z + dist * Math.cos(yaw) * Math.cos(el));
      tCam.lookAt(c);
      tR.render(tScene, tCam);
      try { return tR.domElement.toDataURL("image/jpeg", 0.82); } catch (e) { return null; }
    }

    /* ── 3D Translation & Rotation CAD Gizmo (Exact match to reference diagram) ── */
    var gizmoGroup = null, gizmoMeshes = [];

    function makeFlatArrowMesh(color, shaftW, shaftL, headW, headL) {
      var shape = new THREE.Shape();
      shape.moveTo(-shaftW / 2, 0);
      shape.lineTo(shaftW / 2, 0);
      shape.lineTo(shaftW / 2, shaftL);
      shape.lineTo(headW / 2, shaftL);
      shape.lineTo(0, shaftL + headL);
      shape.lineTo(-headW / 2, shaftL);
      shape.lineTo(-shaftW / 2, shaftL);
      shape.closePath();
      var geo = new THREE.ShapeGeometry(shape);
      var mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.95 });
      var m = new THREE.Mesh(geo, mat);
      m.renderOrder = 9999;
      return m;
    }

    function makeCurvedArrowMesh(color, radius, arcAngle, width) {
      var shape = new THREE.Shape();
      var segs = 18;
      var rIn = radius - width / 2;
      var rOut = radius + width / 2;
      for (var i = 0; i <= segs; i++) {
        var a = (i / segs) * arcAngle;
        var x = Math.cos(a) * rOut, y = Math.sin(a) * rOut;
        if (i === 0) shape.moveTo(x, y); else shape.lineTo(x, y);
      }
      // Arrowhead tip at end
      shape.lineTo(Math.cos(arcAngle) * (rOut + 16), Math.sin(arcAngle) * (rOut + 16));
      shape.lineTo(Math.cos(arcAngle + 0.28) * radius, Math.sin(arcAngle + 0.28) * radius);
      shape.lineTo(Math.cos(arcAngle) * (rIn - 16), Math.sin(arcAngle) * (rIn - 16));
      for (var j = segs; j >= 0; j--) {
        var a2 = (j / segs) * arcAngle;
        shape.lineTo(Math.cos(a2) * rIn, Math.sin(a2) * rIn);
      }
      // Arrowhead tip at start
      shape.lineTo(Math.cos(0) * (rIn - 16), Math.sin(0) * (rIn - 16));
      shape.lineTo(Math.cos(-0.28) * radius, Math.sin(-0.28) * radius);
      shape.lineTo(Math.cos(0) * (rOut + 16), Math.sin(0) * (rOut + 16));
      shape.closePath();

      var geo = new THREE.ShapeGeometry(shape);
      var mat = new THREE.MeshBasicMaterial({ color: color, side: THREE.DoubleSide, depthTest: false, transparent: true, opacity: 0.95 });
      var m = new THREE.Mesh(geo, mat);
      m.renderOrder = 9999;
      return m;
    }

    /* ── 3D Unit Overlap & Collision Visual Feedback ── */

    function setUnitOverlapVisual(furnGroup, isOverlapped) {

      if (!furnGroup) return;

      if (isOverlapped) {

        if (furnGroup.userData.isOverlapped) return;

        furnGroup.userData.isOverlapped = true;

        var redMat = new THREE.MeshStandardMaterial({

          color: 0xEF4444,

          emissive: 0xDC2626,

          emissiveIntensity: 0.35,

          roughness: 0.35,

          metalness: 0.05,

          transparent: true,

          opacity: 0.55,

          side: THREE.DoubleSide

        });

        furnGroup.traverse(function (c) {

          if (c.isMesh && c.material && !c.userData.isGizmo) {

            if (!c.userData.origMat) c.userData.origMat = c.material;

            c.material = redMat;

          }

        });

        if (gizmoGroup && gizmoGroup.userData && gizmoGroup.userData.boxLines) {

          gizmoGroup.userData.boxLines.material.color.setHex(0xEF4444);

        }

        if (gizmoGroup && gizmoGroup.userData && gizmoGroup.userData.topLines) {

          gizmoGroup.userData.topLines.material.color.setHex(0xEF4444);

        }

      } else {

        if (!furnGroup.userData.isOverlapped) return;

        furnGroup.userData.isOverlapped = false;

        furnGroup.traverse(function (c) {

          if (c.isMesh && c.userData.origMat) {

            c.material = c.userData.origMat;

            delete c.userData.origMat;

          }

        });

        if (gizmoGroup && gizmoGroup.userData && gizmoGroup.userData.boxLines) {

          gizmoGroup.userData.boxLines.material.color.setHex(0xF59E0B);

        }

        if (gizmoGroup && gizmoGroup.userData && gizmoGroup.userData.topLines) {

          gizmoGroup.userData.topLines.material.color.setHex(0x38BDF8);

        }

      }

      render();

    }

    function gizmoSet(furnObj, furnId) {
      if (!scene) return;
      if (!gizmoGroup) {
        gizmoGroup = new THREE.Group();
        gizmoGroup.name = "OrbixGizmo3D";
        scene.add(gizmoGroup);
      }

      // Clear old elements
      while (gizmoGroup.children.length) {
        var ch = gizmoGroup.children[0];
        gizmoGroup.remove(ch);
        if (ch.geometry) ch.geometry.dispose();
      }
      gizmoMeshes = [];

      if (!furnObj || !furnId) {
        gizmoGroup.visible = false;
        gizmoGroup.userData.furnId = null;
        gizmoGroup.userData.targetObj = null;
        render();
        return;
      }

      var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
      var furn = plan && plan.furniture && plan.furniture.find(function (it) { return it.id === furnId; });
      var dims = (furn && furn.dimensions) ? furn.dimensions : { W: 900, H: 850, D: 600 };
      var hw = dims.W / 2;
      var hh = dims.H;
      var hd = dims.D / 2;

      gizmoGroup.position.set(furnObj.position.x, furnObj.position.y || 0, furnObj.position.z);
      gizmoGroup.rotation.y = furnObj.rotation.y || 0;
      gizmoGroup.userData.furnId = furnId;
      gizmoGroup.userData.targetObj = furnObj;
      gizmoGroup.userData.dims = dims;
      gizmoGroup.visible = true;

      // 1. Orange 3D Bounding Box Lines (#F59E0B)
      var boxPts = [
        new THREE.Vector3(-hw, 1, -hd), new THREE.Vector3(hw, 1, -hd),
        new THREE.Vector3(hw, 1, -hd), new THREE.Vector3(hw, 1, hd),
        new THREE.Vector3(hw, 1, hd), new THREE.Vector3(-hw, 1, hd),
        new THREE.Vector3(-hw, 1, hd), new THREE.Vector3(-hw, 1, -hd),
        new THREE.Vector3(-hw, 1, -hd), new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, 1, -hd), new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, 1, hd), new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, 1, hd), new THREE.Vector3(-hw, hh, hd)
      ];
      var boxGeo = new THREE.BufferGeometry().setFromPoints(boxPts);
      var boxLines = new THREE.LineSegments(boxGeo, new THREE.LineBasicMaterial({ color: 0xF59E0B, linewidth: 2, depthTest: false }));
      boxLines.renderOrder = 9998;
      gizmoGroup.add(boxLines);
      gizmoGroup.userData.boxLines = boxLines;

      // 2. Cyan / Blue Top Face Border (#38BDF8)
      var topPts = [
        new THREE.Vector3(-hw, hh + 2, -hd), new THREE.Vector3(hw, hh + 2, -hd),
        new THREE.Vector3(hw, hh + 2, -hd), new THREE.Vector3(hw, hh + 2, hd),
        new THREE.Vector3(hw, hh + 2, hd), new THREE.Vector3(-hw, hh + 2, hd),
        new THREE.Vector3(-hw, hh + 2, hd), new THREE.Vector3(-hw, hh + 2, -hd)
      ];
      var topGeo = new THREE.BufferGeometry().setFromPoints(topPts);
      var topLines = new THREE.LineSegments(topGeo, new THREE.LineBasicMaterial({ color: 0x38BDF8, linewidth: 3, depthTest: false }));
      topLines.renderOrder = 9998;
      gizmoGroup.add(topLines);
      gizmoGroup.userData.topLines = topLines;

      // 3. Flat Red Arrow (Right) - Translates unit along +X (width / along wall)
      var redArrow = makeFlatArrowMesh(0xF87171, 35, 110, 80, 80);
      redArrow.rotation.x = -Math.PI / 2;
      redArrow.rotation.z = -Math.PI / 2; // Points right along +X
      redArrow.position.set(hw + 25, 4, 0);
      redArrow.userData = { isGizmo: true, axis: 'x', dir: 1, name: 'arrowRight' };
      gizmoGroup.add(redArrow);
      gizmoMeshes.push(redArrow);

      // 4. Flat Red Arrow (Left) - Translates unit along -X
      var redArrowLeft = makeFlatArrowMesh(0xF87171, 35, 110, 80, 80);
      redArrowLeft.rotation.x = -Math.PI / 2;
      redArrowLeft.rotation.z = Math.PI / 2; // Points left along -X
      redArrowLeft.position.set(-hw - 25, 4, 0);
      redArrowLeft.userData = { isGizmo: true, axis: 'x', dir: -1, name: 'arrowLeft' };
      gizmoGroup.add(redArrowLeft);
      gizmoMeshes.push(redArrowLeft);

      // 5. Flat Blue Arrow (Front) - Pulls unit forward along +Z (depth / into room)
      var blueArrow = makeFlatArrowMesh(0x60A5FA, 35, 110, 80, 80);
      blueArrow.rotation.x = -Math.PI / 2; // Points forward along +Z
      blueArrow.position.set(0, 4, hd + 25);
      blueArrow.userData = { isGizmo: true, axis: 'z', dir: 1, name: 'arrowFront' };
      gizmoGroup.add(blueArrow);
      gizmoMeshes.push(blueArrow);

      // 6. Flat Green Arrow (Back) - On countertop, points backward along -Z (towards wall)
      var greenArrow = makeFlatArrowMesh(0x10B981, 35, 100, 75, 75);
      greenArrow.rotation.x = -Math.PI / 2;
      greenArrow.rotation.z = Math.PI; // Points backward along -Z
      greenArrow.position.set(0, hh + 4, -hd * 0.1);
      greenArrow.userData = { isGizmo: true, axis: 'z', dir: -1, name: 'arrowBack' };
      gizmoGroup.add(greenArrow);
      gizmoMeshes.push(greenArrow);

      // 7. Upward 3D Arrow (Elevation along +Y - Mounting Height AFFL)
      var yArrowGroup = new THREE.Group();
      var yShaftGeo = new THREE.CylinderGeometry(8, 8, 70, 16);
      var yHeadGeo = new THREE.ConeGeometry(22, 40, 16);
      var yMat = new THREE.MeshStandardMaterial({
        color: 0xEAB308,
        emissive: 0xCA8A04,
        emissiveIntensity: 0.35,
        roughness: 0.3,
        metalness: 0.2,
        depthTest: false,
        transparent: true,
        opacity: 0.95
      });
      var yShaftMesh = new THREE.Mesh(yShaftGeo, yMat);
      yShaftMesh.position.y = 35;
      yShaftMesh.renderOrder = 9999;
      var yHeadMesh = new THREE.Mesh(yHeadGeo, yMat);
      yHeadMesh.position.y = 70 + 20;
      yHeadMesh.renderOrder = 9999;
      yArrowGroup.add(yShaftMesh);
      yArrowGroup.add(yHeadMesh);
      yArrowGroup.position.set(0, hh + 2, 0);
      yArrowGroup.userData = { isGizmo: true, axis: 'y', dir: 1, name: 'arrowUp' };
      yShaftMesh.userData = { isGizmo: true, axis: 'y', dir: 1, name: 'arrowUp' };
      yHeadMesh.userData = { isGizmo: true, axis: 'y', dir: 1, name: 'arrowUp' };
      gizmoGroup.add(yArrowGroup);
      gizmoMeshes.push(yShaftMesh);
      gizmoMeshes.push(yHeadMesh);

      // 8. Curved Green Rotation Arc Arrow - At front-right corner
      var rotArc = makeCurvedArrowMesh(0x34D399, 90, Math.PI / 2, 22);
      rotArc.rotation.x = -Math.PI / 2;
      rotArc.rotation.z = -Math.PI / 4;
      rotArc.position.set(hw + 25, 4, hd + 25);
      rotArc.userData = { isGizmo: true, axis: 'rot', name: 'arrowRotate' };
      gizmoGroup.add(rotArc);
      gizmoMeshes.push(rotArc);

      // Initial check: if unit is already placed in collision, visually indicate it immediately
      if (window.OrbixCore && window.OrbixCore.checkPlacementOverlap && furn && plan) {
        var initChk = window.OrbixCore.checkPlacementOverlap(furn, plan, furnId);
        setUnitOverlapVisual(furnObj, initChk.hasOverlap);
      } else {
        setUnitOverlapVisual(furnObj, false);
      }

      render();
    }

    function gizmoPick(clientX, clientY) {
      if (!gizmoGroup || !gizmoGroup.visible) return null;
      if (!ray) { ray = new THREE.Raycaster(); ndc = new THREE.Vector2(); }
      var r = stage.getBoundingClientRect();
      ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(ndc, camera);
      var hits = ray.intersectObjects(gizmoMeshes, true);
      for (var i = 0; i < hits.length; i++) {
        var o = hits[i].object;
        while (o && !o.userData.axis && o !== gizmoGroup) o = o.parent;
        if (o && o.userData && o.userData.axis) {
          return { axis: o.userData.axis, dir: o.userData.dir || 1, name: o.userData.name, point: hits[i].point, mesh: o };
        }
      }
      return null;
    }

    /* test hook: which material kind sits on each thin face, per role */
    function debug() {
      var out = {};
      root.traverse(function (m) {
        if (!m.isMesh || !Array.isArray(m.material)) return;
        var r = m.userData.role || "?", faces = ["px", "nx", "py", "ny", "pz", "nz"];
        out[r] = out[r] || {};
        m.material.forEach(function (mat, i) { var k = faces[i] + ":" + (mat.userData.kind || "?"); out[r][k] = (out[r][k] || 0) + 1; });
      });
      return out;
    }
    return { init: init, show: show, frame: frame, apply: apply, updateWallCutaway: updateWallCutaway, debug: debug, toggleAll: toggleAll, settle: settle, pick: pick, pickFurniture: pickFurniture, pickPanel: pickPanel, clearSelect: function () { clearSelect(); render(); }, fxInit: fxInit, fxToggle: fxToggle, setDoors: function (t) { for (var id in doors) { var d = doors[id]; d.t = Math.max(0, Math.min(1, t)) * (d.target || 1); if (!d.target) { d.req = 1; resolve(); d.t = Math.max(0, Math.min(1, t)) * d.target; } applyDoor(d); } render(); }, setExplode: function (t) { if (!xItems) explodeSetup(); xT = t; xSet(t); }, handlesSet: handlesSet, plateSet: plateSet, handleAt: handleAt, floorPoint: floorPoint, thumb: thumb, snapshot: snapshot, explode: explode, assemble: assemble, get exploded() { return xT > 0.5; }, get fx() { return !!composer; }, lights: function () { var n = []; if (scene) scene.traverse(function (o) { if (o.isLight) n.push(o.type + ":" + o.intensity); }); return n; }, get ok() { return ok; }, getScene: function () { return scene; }, getTarget: function () { return target; }, setTarget: function (x, y, z) { if (target) target.set(x, y, z); }, gizmoSet: gizmoSet, gizmoPick: gizmoPick, setUnitOverlapVisual: setUnitOverlapVisual, getGizmoTarget: function () { return gizmoGroup ? gizmoGroup.userData.targetObj : null; }, getGizmoFurnId: function () { return gizmoGroup ? gizmoGroup.userData.furnId : null; }, makeGrassGroundMat: makeGrassGroundMat, makeNeutralGroundMat: makeGrassGroundMat, setFloorMaterial: function (type) { window.currentFloorType = type; delete matCache["sp|floor"]; var hasArchHome = scene && (scene.getObjectByName('OrbixHome3D') || (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan && window.OrbixUI.project.plan.walls && window.OrbixUI.project.plan.walls.length > 0)); if (floor) floor.material = hasArchHome ? makeGrassGroundMat() : makeFloorMat(type); render(); } };
  })();

  /* ═══════════════════════════════════════════════════════════════
     DESIGN CATALOGUE — styles × formats, per cupboard type.
     Styles are curated looks with an era tag (old → new, popular → rare);
     formats are the size / door / loft variants each type is sold in.
     Together they give 100+ presets per model, rendered live as thumbnails.
     ═══════════════════════════════════════════════════════════════ */
  var STYLES = [
    { id: "nordic", name: "Nordic Oak", era: "modern", carcass: "MDF 1135", shutter: "MDF 2204", dstyle: "slab", handle: "bar224", fin: "nickel" },
    { id: "walnut", name: "Walnut Classic", era: "popular", carcass: "MDF 1135", shutter: "MDF 3410", dstyle: "slab", handle: "ibh10", fin: "chrome" },
    { id: "glossmin", name: "Gloss Minimal", era: "modern", carcass: "MDF 1135", shutter: "MDF 6601", dstyle: "slab", handle: "gprof", fin: "black" },
    { id: "twotone", name: "Two-tone Graphite", era: "modern", carcass: "MDF 1135", shutter: "MDF 5501", dstyle: "slab", handle: "bar320", fin: "black" },
    { id: "urban", name: "Urban Gloss Grey", era: "modern", carcass: "MDF 6601", shutter: "MDF 6620", dstyle: "slab", handle: "gola", fin: "nickel" },
    { id: "ebony", name: "Ebony Luxe", era: "popular", carcass: "MDF 1101", shutter: "MDF 3411", dstyle: "slab", handle: "bar128", fin: "brass" },
    { id: "shaker", name: "Shaker Heritage", era: "classic", carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "shaker", handle: "knob", fin: "brass" },
    { id: "teakpanel", name: "Teak Panelled", era: "classic", carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "shaker", handle: "knob", fin: "brass" },
    { id: "colonial", name: "Colonial Raised", era: "traditional", carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "raised", handle: "ring", fin: "brass" },
    { id: "reeded", name: "Reeded Oak", era: "rare", carcass: "MDF 1135", shutter: "MDF 2204", dstyle: "fluted", handle: "edge", fin: "nickel" },
    { id: "louver", name: "Plantation Louvre", era: "old", carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "louvered", handle: "knob", fin: "black" },
    { id: "cane", name: "Cane & Oak", era: "rare", carcass: "MDF 2204", shutter: "MDF 2204", dstyle: "cane", handle: "tbar", fin: "brass" },
    { id: "mirror", name: "Mirror Front", era: "popular", carcass: "MDF 4402", shutter: "MDF 4402", dstyle: "mirror", handle: "jprof", fin: "nickel" },
    { id: "display", name: "Glass Display", era: "classic", carcass: "MDF 3410", shutter: "MDF 3410", dstyle: "glass", handle: "cup", fin: "nickel" },
    { id: "grooved", name: "Grooved Wenge", era: "rare", carcass: "MDF 1101", shutter: "MDF 3411", dstyle: "grooved", handle: "recess", fin: "black" },
    { id: "almirah", name: "Steel Almirah", era: "old", carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "steel", handle: "ibh8", fin: "black", paint: "#5B6E7A" },
    { id: "almblue", name: "Godrej Blue", era: "old", carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "steel", handle: "ibh8", fin: "chrome", paint: "#2F5F86" },
    { id: "ivoryslab", name: "Ivory Slab", era: "popular", carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "slab", handle: "bar96", fin: "chrome" }
  ];
  /* Kitchen catalogue — what premium studios sell in 2026: matte textured colours
     (sage, charcoal, sand, taupe, macchiato, coffee), handleless J/G/gola profiles,
     two-tone base/wall, gloss acrylic, wood veneers, stone & concrete looks, plus
     the classics (shaker, raised panel, louvre) and a few rare finishes. */
  var KSTYLES = [
    { id: "k-whitehl", name: "Handleless White Matte", tags: ["popular", "handleless", "matte"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "slab", handle: "gprof", fin: "black", counter: "quartz", splash: "slab" },
    { id: "k-sageoak", name: "Sage & Oak", tags: ["popular", "twotone", "matte"], carcass: "MDF 1135", shutter: "MDF 7701", wallCol: "MDF 2220", dstyle: "slab", handle: "jprof", fin: "nickel", counter: "quartz", splash: "chevron" },
    { id: "k-charwal", name: "Charcoal & Walnut", tags: ["popular", "twotone", "wood", "handleless"], carcass: "MDF 1135", shutter: "MDF 7702", wallCol: "MDF 3410", dstyle: "slab", handle: "gola", fin: "black", counter: "galaxy", splash: "slab" },
    { id: "k-nordic", name: "Nordic Light Oak", tags: ["popular", "wood"], carcass: "MDF 1135", shutter: "MDF 2220", dstyle: "slab", handle: "bar224", fin: "nickel", counter: "quartz", splash: "subway" },
    { id: "k-glosswh", name: "Gloss White Acrylic", tags: ["popular", "gloss"], carcass: "MDF 1135", shutter: "MDF 6601", dstyle: "slab", handle: "gprof", fin: "nickel", counter: "black", splash: "glass", splashHex: "#F2F4F5" },
    { id: "k-redwh", name: "Gloss Red & White", tags: ["popular", "gloss", "twotone"], carcass: "MDF 1135", shutter: "MDF 6630", wallCol: "MDF 6601", dstyle: "slab", handle: "bar128", fin: "chrome", counter: "black", splash: "glass", splashHex: "#F2F4F5" },
    { id: "k-blkgold", name: "Gloss Black & Gold", tags: ["luxury", "gloss"], carcass: "MDF 1135", shutter: "MDF 6640", dstyle: "slab", handle: "bar320", fin: "brass", counter: "galaxy", splash: "slab" },
    { id: "k-sand", name: "Sand Beige Matte", tags: ["popular", "matte", "handleless"], carcass: "MDF 1101", shutter: "MDF 7703", dstyle: "slab", handle: "jprof", fin: "nickel", counter: "quartz", splash: "hex" },
    { id: "k-macch", name: "Macchiato & Coffee", tags: ["twotone", "matte", "luxury"], carcass: "MDF 1101", shutter: "MDF 7706", wallCol: "MDF 7705", dstyle: "slab", handle: "gprof", fin: "brass", counter: "beige", splash: "slab" },
    { id: "k-taupe", name: "Taupe Grey Ceramic", tags: ["matte", "handleless"], carcass: "MDF 1135", shutter: "MDF 7704", dstyle: "slab", handle: "gola", fin: "black", counter: "greyq", splash: "largeformat" },
    { id: "k-navy", name: "Navy & White Shaker", tags: ["classic", "twotone"], carcass: "MDF 1135", shutter: "MDF 7707", wallCol: "MDF 1135", dstyle: "shaker", handle: "knob", fin: "brass", counter: "white", splash: "subway" },
    { id: "k-ivoryshk", name: "Ivory Shaker Classic", tags: ["classic", "popular"], carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "shaker", handle: "cup", fin: "nickel", counter: "black", splash: "subway" },
    { id: "k-fluted", name: "Fluted Oak", tags: ["luxury", "wood", "rare"], carcass: "MDF 1135", shutter: "MDF 2204", dstyle: "fluted", handle: "edge", fin: "nickel", counter: "quartz", splash: "slab" },
    { id: "k-reeded", name: "Reeded Sage", tags: ["rare", "matte"], carcass: "MDF 1135", shutter: "MDF 7701", dstyle: "fluted", handle: "edge", fin: "brass", counter: "white", splash: "slab" },
    { id: "k-teak", name: "Teak Veneer Modern", tags: ["wood", "luxury"], carcass: "MDF 1101", shutter: "MDF 2240", dstyle: "slab", handle: "recess", fin: "black", counter: "galaxy", splash: "subway" },
    { id: "k-walnut", name: "Walnut Classic", tags: ["popular", "wood"], carcass: "MDF 1135", shutter: "MDF 3410", dstyle: "slab", handle: "ibh10", fin: "chrome", counter: "black", splash: "subway" },
    { id: "k-dkwalst", name: "Dark Walnut & Stone", tags: ["luxury", "wood", "twotone"], carcass: "MDF 1135", shutter: "MDF 3420", wallCol: "MDF 8802", dstyle: "slab", handle: "gola", fin: "black", counter: "greyq", splash: "slab" },
    { id: "k-concrete", name: "Concrete Industrial", tags: ["rare", "matte"], carcass: "MDF 5501", shutter: "MDF 8801", dstyle: "slab", handle: "bar320", fin: "black", counter: "black", splash: "largeformat" },
    { id: "k-terra", name: "Terracotta & Cream", tags: ["rare", "twotone", "matte"], carcass: "MDF 1101", shutter: "MDF 7708", wallCol: "MDF 6650", dstyle: "slab", handle: "knob", fin: "brass", counter: "white", splash: "terrazzo" },
    { id: "k-olive", name: "Olive & Brass", tags: ["matte", "classic"], carcass: "MDF 1101", shutter: "MDF 7709", dstyle: "shaker", handle: "knob", fin: "brass", counter: "white", splash: "hex" },
    { id: "k-greyoak", name: "Grey Oak Scandinavian", tags: ["wood", "popular"], carcass: "MDF 1135", shutter: "MDF 4402", dstyle: "slab", handle: "tbar", fin: "nickel", counter: "quartz", splash: "subway" },
    { id: "k-graphwh", name: "Graphite & White", tags: ["popular", "twotone", "handleless"], carcass: "MDF 1135", shutter: "MDF 5501", wallCol: "MDF 1135", dstyle: "slab", handle: "gprof", fin: "black", counter: "quartz", splash: "glass", splashHex: "#D9DEE2" },
    { id: "k-glasswall", name: "Glass Wall Units", tags: ["luxury", "wood"], carcass: "MDF 1135", shutter: "MDF 1135", wallCol: "MDF 3410", wallDs: "glass", dstyle: "slab", handle: "bar128", fin: "chrome", counter: "black", splash: "subway" },
    { id: "k-louvre", name: "Louvered Coastal", tags: ["classic", "rare"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "louvered", handle: "knob", fin: "nickel", counter: "white", splash: "subway" },
    { id: "k-cane", name: "Cane & Oak Boho", tags: ["rare", "wood"], carcass: "MDF 2204", shutter: "MDF 2204", wallDs: "cane", dstyle: "slab", handle: "tbar", fin: "brass", counter: "white", splash: "terrazzo" },
    { id: "k-raised", name: "Raised Panel Traditional", tags: ["classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "raised", handle: "ring", fin: "brass", counter: "black", splash: "subway" },
    { id: "k-glossgrey", name: "Gloss Grey Urban", tags: ["gloss", "handleless"], carcass: "MDF 1135", shutter: "MDF 6620", dstyle: "slab", handle: "jprof", fin: "black", counter: "greyq", splash: "largeformat" },
    { id: "k-whitewood", name: "White & Wood Handleless", tags: ["popular", "twotone", "handleless", "wood"], carcass: "MDF 1135", shutter: "MDF 2204", wallCol: "MDF 1135", dstyle: "slab", handle: "gola", fin: "nickel", counter: "quartz", splash: "slab" },
    { id: "k-ebony", name: "Ebony Luxe", tags: ["luxury", "wood"], carcass: "MDF 1101", shutter: "MDF 3411", dstyle: "slab", handle: "bar224", fin: "brass", counter: "galaxy", splash: "glass", splashHex: "#2A2A2E" },
    { id: "k-oldteak", name: "Old India Teak", tags: ["classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "slab", handle: "ibh8", fin: "chrome", counter: "black", splash: "subway" }
  ];
  /* Wardrobe catalogue — 2026: fluted / smoked / frosted glass in slim black or
     champagne aluminium profiles (hinged and sliding), matte & gloss laminates,
     handleless push-open, dual-tone alternating doors, horizontal wood grain,
     mirror sliders, leather-panelled luxury fronts, plus the classics. */
  var WSTYLES = [
    { id: "w-flutedblk", name: "Fluted Glass · Black Profile", tags: ["popular", "glass", "luxury"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "aluglass", tint: "fluted", frame: "black", handle: "none", fin: "black" },
    { id: "w-smokeblk", name: "Smoked Glass · Black Profile", tags: ["glass", "luxury"], carcass: "MDF 5501", shutter: "MDF 5501", dstyle: "aluglass", tint: "smoke", frame: "black", handle: "none", fin: "black" },
    { id: "w-frostgold", name: "Frosted Glass · Champagne", tags: ["glass", "luxury"], carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "aluglass", tint: "frost", frame: "brass", handle: "none", fin: "brass" },
    { id: "w-bronzewal", name: "Bronze Glass · Walnut", tags: ["glass", "wood", "luxury"], carcass: "MDF 3410", shutter: "MDF 3410", dstyle: "aluglass", tint: "bronze", frame: "black", handle: "none", fin: "black" },
    { id: "w-clearblk", name: "Clear Glass Display · Black", tags: ["glass", "rare"], carcass: "MDF 7702", shutter: "MDF 7702", dstyle: "aluglass", tint: "clear", frame: "black", handle: "none", fin: "black" },
    { id: "w-flutedsl", name: "Fluted Glass · Nickel Profile", tags: ["glass", "popular"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "aluglass", tint: "fluted", frame: "nickel", handle: "none", fin: "nickel" },
    { id: "w-whitehl", name: "Handleless White Matte", tags: ["popular", "handleless", "matte"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "slab", handle: "none", fin: "nickel" },
    { id: "w-sagehl", name: "Sage Matte Handleless", tags: ["handleless", "matte"], carcass: "MDF 1135", shutter: "MDF 7701", dstyle: "slab", handle: "gprof", fin: "black" },
    { id: "w-sand", name: "Sand Beige Matte", tags: ["matte", "popular"], carcass: "MDF 1101", shutter: "MDF 7703", dstyle: "slab", handle: "jprof", fin: "nickel" },
    { id: "w-taupeoak", name: "Taupe & Oak Alternating", tags: ["twotone", "matte", "wood"], carcass: "MDF 1135", shutter: "MDF 7704", shutter2: "MDF 2220", dstyle: "slab", handle: "edge", fin: "nickel" },
    { id: "w-whiteoak", name: "White & Oak Alternating", tags: ["twotone", "popular"], carcass: "MDF 1135", shutter: "MDF 1135", shutter2: "MDF 2204", dstyle: "slab", handle: "bar224", fin: "nickel" },
    { id: "w-charwal", name: "Charcoal & Walnut", tags: ["twotone", "wood", "handleless"], carcass: "MDF 1135", shutter: "MDF 7702", shutter2: "MDF 3410", dstyle: "slab", handle: "gola", fin: "black" },
    { id: "w-navyshk", name: "Navy Shaker", tags: ["classic", "matte"], carcass: "MDF 1135", shutter: "MDF 7707", dstyle: "shaker", handle: "knob", fin: "brass" },
    { id: "w-ivoryshk", name: "Ivory Shaker", tags: ["classic", "popular"], carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "shaker", handle: "knob", fin: "brass" },
    { id: "w-teakpanel", name: "Teak Panelled", tags: ["classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "shaker", handle: "knob", fin: "brass" },
    { id: "w-colonial", name: "Colonial Raised", tags: ["classic", "wood", "old"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "raised", handle: "ring", fin: "brass" },
    { id: "w-walnut", name: "Walnut Classic", tags: ["popular", "wood"], carcass: "MDF 1135", shutter: "MDF 3410", dstyle: "slab", handle: "ibh10", fin: "chrome" },
    { id: "w-walnuth", name: "Walnut Horizontal Grain", tags: ["wood", "luxury"], carcass: "MDF 1135", shutter: "MDF 3410", dstyle: "slab", hgrain: true, handle: "bar320", fin: "black" },
    { id: "w-dkwalgola", name: "Dark Walnut Gola · H grain", tags: ["wood", "handleless", "luxury"], carcass: "MDF 1101", shutter: "MDF 3420", dstyle: "slab", hgrain: true, handle: "gola", fin: "black" },
    { id: "w-lightoak", name: "Light Oak Scandi", tags: ["wood", "popular"], carcass: "MDF 1135", shutter: "MDF 2220", dstyle: "slab", handle: "tbar", fin: "nickel" },
    { id: "w-greyoak", name: "Grey Oak", tags: ["wood"], carcass: "MDF 4402", shutter: "MDF 4402", dstyle: "slab", handle: "bar128", fin: "black" },
    { id: "w-teakven", name: "Teak Veneer · Recess Grip", tags: ["wood", "luxury"], carcass: "MDF 1101", shutter: "MDF 2240", dstyle: "slab", handle: "recess", fin: "black" },
    { id: "w-glosswh", name: "Gloss White Acrylic", tags: ["gloss", "popular"], carcass: "MDF 1135", shutter: "MDF 6601", dstyle: "slab", handle: "gprof", fin: "nickel" },
    { id: "w-glosscrm", name: "Gloss Cream & Gold", tags: ["gloss", "luxury"], carcass: "MDF 1101", shutter: "MDF 6650", dstyle: "slab", handle: "bar224", fin: "brass" },
    { id: "w-glossblk", name: "Gloss Black", tags: ["gloss", "luxury"], carcass: "MDF 5501", shutter: "MDF 6640", dstyle: "slab", handle: "jprof", fin: "black" },
    { id: "w-glossgrey", name: "Gloss Grey Urban", tags: ["gloss"], carcass: "MDF 6601", shutter: "MDF 6620", dstyle: "slab", handle: "gola", fin: "nickel" },
    { id: "w-glosssage", name: "Gloss Sage", tags: ["gloss", "rare"], carcass: "MDF 1135", shutter: "MDF 6660", dstyle: "slab", handle: "edge", fin: "nickel" },
    { id: "w-glossred", name: "Gloss Red Retro", tags: ["gloss", "rare"], carcass: "MDF 1135", shutter: "MDF 6630", dstyle: "slab", handle: "bar128", fin: "chrome" },
    { id: "w-mirror", name: "Mirror Front", tags: ["popular"], carcass: "MDF 4402", shutter: "MDF 4402", dstyle: "mirror", handle: "jprof", fin: "nickel" },
    { id: "w-mirrorwen", name: "Mirror & Wenge", tags: ["twotone", "popular"], carcass: "MDF 1101", shutter: "MDF 3411", dstyle: "mirror", handle: "none", fin: "black" },
    { id: "w-reeded", name: "Reeded Oak", tags: ["rare", "luxury", "wood"], carcass: "MDF 1135", shutter: "MDF 2204", dstyle: "fluted", handle: "edge", fin: "nickel" },
    { id: "w-flutedsage", name: "Fluted Sage", tags: ["rare", "matte"], carcass: "MDF 1135", shutter: "MDF 7701", dstyle: "fluted", handle: "edge", fin: "brass" },
    { id: "w-cane", name: "Cane & Oak", tags: ["rare", "wood"], carcass: "MDF 2204", shutter: "MDF 2204", dstyle: "cane", handle: "tbar", fin: "brass" },
    { id: "w-louvre", name: "Plantation Louvre", tags: ["old", "classic"], carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "louvered", handle: "knob", fin: "black" },
    { id: "w-leatheresp", name: "Leather Panel · Espresso", tags: ["luxury", "rare"], carcass: "MDF 3410", shutter: "MDF 3410", dstyle: "leather", leather: "#4A3626", handle: "bar128", fin: "brass" },
    { id: "w-leathercam", name: "Leather Panel · Camel & Cream", tags: ["luxury", "rare"], carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "leather", leather: "#B07A4A", handle: "knob", fin: "brass" },
    { id: "w-grooved", name: "Grooved Wenge", tags: ["rare", "wood"], carcass: "MDF 1101", shutter: "MDF 3411", dstyle: "grooved", handle: "recess", fin: "black" },
    { id: "w-concrete", name: "Concrete Loft", tags: ["matte", "rare"], carcass: "MDF 5501", shutter: "MDF 8801", dstyle: "slab", handle: "bar320", fin: "black" },
    { id: "w-terra", name: "Terracotta Matte", tags: ["matte", "rare"], carcass: "MDF 1101", shutter: "MDF 7708", dstyle: "slab", handle: "knob", fin: "brass" },
    { id: "w-powder", name: "Powder Blue Pastel", tags: ["matte", "rare"], carcass: "MDF 1135", shutter: "MDF 7710", dstyle: "slab", handle: "tbar", fin: "nickel" },
    { id: "w-blush", name: "Blush & Brass", tags: ["matte", "rare"], carcass: "MDF 1101", shutter: "MDF 7711", dstyle: "shaker", handle: "knob", fin: "brass" },
    { id: "w-olive", name: "Olive Shaker", tags: ["matte", "classic"], carcass: "MDF 1101", shutter: "MDF 7709", dstyle: "shaker", handle: "knob", fin: "brass" },
    { id: "w-almirah", name: "Steel Almirah", tags: ["old"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "steel", handle: "ibh8", fin: "black", paint: "#5B6E7A" },
    { id: "w-almblue", name: "Godrej Blue", tags: ["old"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "steel", handle: "ibh8", fin: "chrome", paint: "#2F5F86" }
  ];
  var WERAS = [{ id: "all", label: "All" }, { id: "popular", label: "Popular" }, { id: "glass", label: "Glass & profile" }, { id: "handleless", label: "Handleless" }, { id: "twotone", label: "Two-tone" }, { id: "wood", label: "Wood & veneer" }, { id: "gloss", label: "Gloss" }, { id: "matte", label: "Matte colour" }, { id: "classic", label: "Classic" }, { id: "luxury", label: "Luxury" }, { id: "old", label: "Old India" }, { id: "rare", label: "Rare" }];
  function stylesFor(t) { return t === "kitchen" ? KSTYLES : t === "tv" ? TSTYLES : t === "crockery" ? CSTYLES : t === "dresser" ? VSTYLES : /^(wardrobe|sliding|overhead|tall)$/.test(t) ? WSTYLES : STYLES; }
  /* TV wall catalogue — 2026: floating consoles with LED under-lighting, fluted or slat feature
     walls, marble / stone backdrops with profile light, mix-and-match charcoal + warm wood,
     full media walls with towers, open niches, and the classics on a plinth. */
  var TSTYLES = [
    { id: "t-flutedwal", name: "Fluted Walnut · Floating", tags: ["popular", "feature", "floating", "wood", "luxury"], carcass: "MDF 1135", shutter: "MDF 3410", dstyle: "slab", handle: "gprof", fin: "black", back: "fluted", led: true },
    { id: "t-marbleblk", name: "Marble Wall · Gloss Black", tags: ["luxury", "feature", "floating", "gloss"], carcass: "MDF 5501", shutter: "MDF 6640", dstyle: "slab", handle: "gprof", fin: "brass", back: "stone", stone: "marble", led: true },
    { id: "t-whitehl", name: "Handleless White Float", tags: ["popular", "handleless", "floating", "matte"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "slab", handle: "none", fin: "nickel", back: "panel", backCol: "MDF 1135", led: true },
    { id: "t-sageoak", name: "Sage Console · Oak Wall", tags: ["popular", "matte", "wood", "floating"], carcass: "MDF 1135", shutter: "MDF 7701", dstyle: "slab", handle: "jprof", fin: "nickel", back: "panel", backCol: "MDF 2220", led: true },
    { id: "t-charcoalgr", name: "Charcoal Grooved Wall", tags: ["feature", "matte", "handleless"], carcass: "MDF 5501", shutter: "MDF 7702", dstyle: "slab", handle: "gola", fin: "black", back: "grooved", led: true },
    { id: "t-nordicopen", name: "Nordic Oak Open Niches", tags: ["popular", "wood", "floating"], carcass: "MDF 2220", shutter: "MDF 2220", dstyle: "slab", handle: "none", fin: "nickel", back: "none", console: "open", led: true },
    { id: "t-ivorywall", name: "Full Wall Ivory", tags: ["fullwall", "classic"], carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "slab", handle: "knob", fin: "nickel", back: "panel", console: "doors", led: false },
    { id: "t-smokedtow", name: "Smoked Glass Towers · Walnut", tags: ["luxury", "glass", "fullwall", "wood"], carcass: "MDF 3410", shutter: "MDF 3410", dstyle: "aluglass", tint: "smoke", frame: "black", handle: "none", fin: "black", back: "fluted", led: true },
    { id: "t-frostwh", name: "Frosted Glass Towers · White", tags: ["glass", "luxury", "fullwall"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "aluglass", tint: "frost", frame: "nickel", handle: "none", fin: "nickel", back: "panel", led: true },
    { id: "t-terra", name: "Terracotta Retro", tags: ["rare", "matte"], carcass: "MDF 1101", shutter: "MDF 7708", dstyle: "slab", handle: "knob", fin: "brass", back: "panel", backCol: "MDF 6650", console: "doors", led: false },
    { id: "t-teakshk", name: "Teak Classic · Shaker", tags: ["classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "shaker", handle: "knob", fin: "brass", back: "panel", console: "doors", float: false, led: false },
    { id: "t-cane", name: "Cane Console · Oak", tags: ["rare", "wood"], carcass: "MDF 2204", shutter: "MDF 2204", dstyle: "cane", handle: "tbar", fin: "brass", back: "none", console: "doors", led: false },
    { id: "t-glosswg", name: "Gloss White & Grey", tags: ["gloss", "popular", "floating"], carcass: "MDF 1135", shutter: "MDF 6601", dstyle: "slab", handle: "gprof", fin: "nickel", back: "panel", backCol: "MDF 6620", led: true },
    { id: "t-concrete", name: "Concrete & Charcoal", tags: ["rare", "matte", "feature"], carcass: "MDF 5501", shutter: "MDF 7702", dstyle: "slab", handle: "bar320", fin: "black", back: "panel", backCol: "MDF 8801", led: true },
    { id: "t-navyshk", name: "Navy Shaker & Brass", tags: ["classic", "matte"], carcass: "MDF 1135", shutter: "MDF 7707", dstyle: "shaker", handle: "knob", fin: "brass", back: "panel", backCol: "MDF 1135", console: "doors", float: false, led: false },
    { id: "t-dkwalh", name: "Dark Walnut Horizontal", tags: ["luxury", "wood", "floating"], carcass: "MDF 1101", shutter: "MDF 3420", dstyle: "slab", hgrain: true, handle: "gola", fin: "black", back: "panel", led: true },
    { id: "t-sand", name: "Sand Beige Matte Float", tags: ["matte", "handleless", "floating"], carcass: "MDF 1101", shutter: "MDF 7703", dstyle: "slab", handle: "jprof", fin: "nickel", back: "panel", led: true },
    { id: "t-graphwh", name: "Graphite & White", tags: ["popular", "handleless", "floating"], carcass: "MDF 1135", shutter: "MDF 5501", dstyle: "slab", handle: "gprof", fin: "black", back: "panel", backCol: "MDF 1135", led: true },
    { id: "t-galaxywen", name: "Black Galaxy & Wenge", tags: ["luxury", "feature"], carcass: "MDF 1101", shutter: "MDF 3411", dstyle: "slab", handle: "bar224", fin: "brass", back: "stone", stone: "galaxy", led: true },
    { id: "t-louvre", name: "Louvered Coastal", tags: ["classic", "rare"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "louvered", handle: "knob", fin: "nickel", back: "none", console: "doors", float: false, led: false },
    { id: "t-powder", name: "Powder Blue Pastel", tags: ["rare", "matte"], carcass: "MDF 1135", shutter: "MDF 7710", dstyle: "slab", handle: "tbar", fin: "nickel", back: "panel", backCol: "MDF 1135", console: "doors", led: false },
    { id: "t-reededsage", name: "Reeded Sage Wall", tags: ["feature", "rare", "matte"], carcass: "MDF 1135", shutter: "MDF 7701", dstyle: "fluted", handle: "edge", fin: "brass", back: "fluted", console: "doors", led: true },
    { id: "t-greyoakmw", name: "Grey Oak Media Wall", tags: ["fullwall", "wood"], carcass: "MDF 4402", shutter: "MDF 4402", dstyle: "slab", handle: "bar128", fin: "black", back: "panel", console: "doors", led: true },
    { id: "t-marblefl", name: "Marble Wall · Fluted Oak", tags: ["luxury", "feature", "wood"], carcass: "MDF 1135", shutter: "MDF 2204", dstyle: "fluted", handle: "edge", fin: "brass", back: "stone", stone: "marble", console: "doors", led: true },
    { id: "t-beigemarb", name: "Beige Marble & Macchiato", tags: ["luxury", "feature", "matte"], carcass: "MDF 1101", shutter: "MDF 7705", dstyle: "slab", handle: "gprof", fin: "brass", back: "stone", stone: "beige", led: true },
    { id: "t-oldteak", name: "Old India Teak", tags: ["old", "classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "slab", handle: "ibh8", fin: "chrome", back: "none", console: "doors", float: false, led: false }
  ];
  var TERAS = [{ id: "all", label: "All" }, { id: "popular", label: "Popular" }, { id: "feature", label: "Feature wall" }, { id: "floating", label: "Floating" }, { id: "fullwall", label: "Full media wall" }, { id: "handleless", label: "Handleless" }, { id: "glass", label: "Glass towers" }, { id: "wood", label: "Wood & veneer" }, { id: "gloss", label: "Gloss" }, { id: "matte", label: "Matte colour" }, { id: "classic", label: "Classic" }, { id: "luxury", label: "Luxury" }, { id: "rare", label: "Rare" }, { id: "old", label: "Old India" }];
  /* Crockery / dining display — 2026: fluted or smoked glass shutters in slim profiles, walnut and
     oak veneers, matte handleless bases, LED-lit glass shelves, mirror-backed niches, stone serving
     tops, buffet + hutch and multi-zone bar units. */
  var CSTYLES = [
    { id: "c-flutedwal", name: "Fluted Glass Hutch · Walnut", tags: ["popular", "glass", "luxury", "wood"], carcass: "MDF 1135", shutter: "MDF 3410", dstyle: "slab", handle: "gprof", fin: "black", upper: "aluglass", tint: "fluted", frame: "black", back: "mirror", top: "stone", counter: "galaxy", led: true },
    { id: "c-smokechar", name: "Smoked Glass · Charcoal", tags: ["glass", "luxury", "matte"], carcass: "MDF 5501", shutter: "MDF 7702", dstyle: "slab", handle: "gola", fin: "black", upper: "aluglass", tint: "smoke", frame: "black", back: "mirror", top: "stone", counter: "greyq", led: true },
    { id: "c-clearwh", name: "Clear Glass · White Handleless", tags: ["popular", "handleless", "glass"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "slab", handle: "none", fin: "nickel", upper: "aluglass", tint: "clear", frame: "nickel", back: "panel", top: "stone", counter: "quartz", led: true },
    { id: "c-oakfrost", name: "Oak & Frosted Glass", tags: ["wood", "glass"], carcass: "MDF 1135", shutter: "MDF 2220", dstyle: "slab", handle: "tbar", fin: "nickel", upper: "aluglass", tint: "frost", frame: "nickel", back: "panel", top: "stone", counter: "quartz", led: true },
    { id: "c-teakframe", name: "Classic Teak Glass Frame", tags: ["classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "shaker", handle: "knob", fin: "brass", upper: "glass", back: "panel", top: "laminate", led: false },
    { id: "c-ivoryshk", name: "Ivory Shaker Hutch", tags: ["classic", "popular"], carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "shaker", handle: "knob", fin: "brass", upper: "glass", back: "panel", top: "stone", counter: "white", led: true },
    { id: "c-sageoak", name: "Sage & Oak Sideboard", tags: ["matte", "twotone", "popular"], carcass: "MDF 1135", shutter: "MDF 7701", dstyle: "slab", handle: "jprof", fin: "nickel", upper: "open", upperCol: "MDF 2220", back: "panel", top: "stone", counter: "quartz", led: true },
    { id: "c-glossbar", name: "Gloss White Bar Unit", tags: ["gloss", "luxury"], carcass: "MDF 1135", shutter: "MDF 6601", dstyle: "slab", handle: "gprof", fin: "nickel", upper: "aluglass", tint: "clear", frame: "black", back: "mirror", top: "stone", counter: "galaxy", led: true },
    { id: "c-navybrass", name: "Navy & Brass Display", tags: ["classic", "matte"], carcass: "MDF 1135", shutter: "MDF 7707", dstyle: "shaker", handle: "knob", fin: "brass", upper: "glass", back: "mirror", top: "stone", counter: "white", led: true },
    { id: "c-dkwalfloat", name: "Dark Walnut Floating Buffet", tags: ["luxury", "floating", "wood"], carcass: "MDF 1101", shutter: "MDF 3420", dstyle: "slab", handle: "gola", fin: "black", upper: "aluglass", tint: "smoke", frame: "black", back: "mirror", top: "stone", counter: "greyq", led: true },
    { id: "c-caneopen", name: "Cane Sideboard · Open Shelves", tags: ["rare", "wood"], carcass: "MDF 2204", shutter: "MDF 2204", dstyle: "cane", handle: "tbar", fin: "brass", upper: "open", back: "panel", top: "laminate", led: false },
    { id: "c-terra", name: "Terracotta & Cream", tags: ["rare", "matte", "twotone"], carcass: "MDF 1101", shutter: "MDF 7708", dstyle: "slab", handle: "knob", fin: "brass", upper: "glass", upperCol: "MDF 6650", back: "panel", top: "stone", counter: "white", led: false },
    { id: "c-greyoak", name: "Grey Oak Tall Display", tags: ["wood", "glass"], carcass: "MDF 4402", shutter: "MDF 4402", dstyle: "slab", handle: "bar128", fin: "black", upper: "aluglass", tint: "clear", frame: "black", back: "mirror", top: "laminate", led: true },
    { id: "c-concrete", name: "Concrete & Black Glass", tags: ["rare", "matte"], carcass: "MDF 5501", shutter: "MDF 8801", dstyle: "slab", handle: "bar320", fin: "black", upper: "aluglass", tint: "smoke", frame: "black", back: "panel", top: "stone", counter: "black", led: true },
    { id: "c-graphwh", name: "Graphite & White", tags: ["twotone", "popular", "handleless"], carcass: "MDF 1135", shutter: "MDF 5501", dstyle: "slab", handle: "gprof", fin: "black", upper: "glass", upperCol: "MDF 1135", back: "panel", top: "stone", counter: "quartz", led: true },
    { id: "c-marblegold", name: "Marble & Gold", tags: ["luxury", "gloss"], carcass: "MDF 1101", shutter: "MDF 6650", dstyle: "slab", handle: "bar224", fin: "brass", upper: "aluglass", tint: "clear", frame: "brass", back: "mirror", top: "stone", counter: "white", led: true },
    { id: "c-reededoak", name: "Reeded Oak Buffet", tags: ["rare", "wood", "luxury"], carcass: "MDF 1135", shutter: "MDF 2204", dstyle: "fluted", handle: "edge", fin: "nickel", upper: "aluglass", tint: "clear", frame: "nickel", back: "panel", top: "stone", counter: "quartz", led: true },
    { id: "c-oldteak", name: "Old India Teak", tags: ["old", "classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "slab", handle: "ibh8", fin: "chrome", upper: "glass", back: "panel", top: "laminate", led: false },
    { id: "c-louvre", name: "Louvered Coastal", tags: ["classic", "rare"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "louvered", handle: "knob", fin: "nickel", upper: "open", back: "panel", top: "laminate", led: false },
    { id: "c-powder", name: "Powder Blue Pastel", tags: ["rare", "matte"], carcass: "MDF 1135", shutter: "MDF 7710", dstyle: "slab", handle: "tbar", fin: "nickel", upper: "glass", upperCol: "MDF 1135", back: "panel", top: "stone", counter: "white", led: false },
    { id: "c-ebonybrz", name: "Ebony & Bronze Glass", tags: ["luxury", "glass", "wood"], carcass: "MDF 1101", shutter: "MDF 3411", dstyle: "slab", handle: "bar224", fin: "brass", upper: "aluglass", tint: "bronze", frame: "black", back: "mirror", top: "stone", counter: "galaxy", led: true },
    { id: "c-sandhl", name: "Sand Beige Handleless", tags: ["matte", "handleless"], carcass: "MDF 1101", shutter: "MDF 7703", dstyle: "slab", handle: "jprof", fin: "nickel", upper: "aluglass", tint: "frost", frame: "nickel", back: "panel", top: "stone", counter: "quartz", led: true }
  ];
  var CERAS = [{ id: "all", label: "All" }, { id: "popular", label: "Popular" }, { id: "glass", label: "Glass display" }, { id: "handleless", label: "Handleless" }, { id: "floating", label: "Floating" }, { id: "twotone", label: "Two-tone" }, { id: "wood", label: "Wood & veneer" }, { id: "gloss", label: "Gloss" }, { id: "matte", label: "Matte colour" }, { id: "classic", label: "Classic" }, { id: "luxury", label: "Luxury" }, { id: "old", label: "Old India" }, { id: "rare", label: "Rare" }];
  /* Dressing tables — 2026: floating drawer consoles, LED-backlit arched and round mirrors,
     fluted or slatted panels, marble-and-gold vintage vanities, tall storage towers, pastels. */
  var VSTYLES = [
    { id: "v-flutedoak", name: "Fluted Oak · Arched LED", tags: ["popular", "floating", "feature", "wood"], carcass: "MDF 1135", shutter: "MDF 2220", dstyle: "slab", handle: "edge", fin: "nickel", mirror: "arch", led: true, back: "fluted", top: "laminate", cfg: "floating" },
    { id: "v-whiteround", name: "White Handleless · Round LED", tags: ["popular", "handleless", "floating"], carcass: "MDF 1135", shutter: "MDF 1135", dstyle: "slab", handle: "gprof", fin: "nickel", mirror: "round", led: true, top: "stone", counter: "quartz", cfg: "floating" },
    { id: "v-marblegold", name: "Marble & Gold Vintage", tags: ["luxury", "classic", "gloss"], carcass: "MDF 1101", shutter: "MDF 6650", dstyle: "slab", handle: "knob", fin: "brass", mirror: "arch", led: true, top: "stone", counter: "white", cfg: "floor" },
    { id: "v-walnutrect", name: "Walnut Floating · Rect LED", tags: ["wood", "floating"], carcass: "MDF 1135", shutter: "MDF 3410", dstyle: "slab", handle: "bar128", fin: "black", mirror: "rect", led: true, top: "laminate", cfg: "floating" },
    { id: "v-sagearch", name: "Sage Matte · Arch", tags: ["matte", "popular"], carcass: "MDF 1135", shutter: "MDF 7701", dstyle: "slab", handle: "jprof", fin: "nickel", mirror: "arch", led: true, back: "panel", backCol: "MDF 1135", top: "laminate", cfg: "floor" },
    { id: "v-blushbrass", name: "Blush & Brass", tags: ["rare", "matte"], carcass: "MDF 1101", shutter: "MDF 7711", dstyle: "slab", handle: "knob", fin: "brass", mirror: "round", led: true, top: "stone", counter: "white", cfg: "floor" },
    { id: "v-charwal", name: "Charcoal & Walnut Tower", tags: ["handleless", "matte", "luxury"], carcass: "MDF 1135", shutter: "MDF 7702", dstyle: "slab", handle: "gola", fin: "black", mirror: "rect", led: true, back: "panel", backCol: "MDF 3410", top: "stone", counter: "greyq", cfg: "floating" },
    { id: "v-teak", name: "Teak Classic", tags: ["classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "shaker", handle: "knob", fin: "brass", mirror: "rect", led: false, top: "laminate", cfg: "floor" },
    { id: "v-navyshk", name: "Navy Shaker & Brass", tags: ["classic", "matte"], carcass: "MDF 1135", shutter: "MDF 7707", dstyle: "shaker", handle: "knob", fin: "brass", mirror: "arch", led: false, top: "stone", counter: "white", cfg: "floor" },
    { id: "v-cane", name: "Cane Console · Round", tags: ["rare", "wood"], carcass: "MDF 2204", shutter: "MDF 2204", dstyle: "cane", handle: "tbar", fin: "brass", mirror: "round", led: false, top: "laminate", cfg: "floor", base: "doors" },
    { id: "v-glosswg", name: "Gloss White & Grey", tags: ["gloss", "floating"], carcass: "MDF 1135", shutter: "MDF 6601", dstyle: "slab", handle: "gprof", fin: "nickel", mirror: "round", led: true, top: "stone", counter: "greyq", cfg: "floating" },
    { id: "v-dkwalfull", name: "Dark Walnut · Full Mirror", tags: ["luxury", "wood", "floating"], carcass: "MDF 1101", shutter: "MDF 3420", dstyle: "slab", hgrain: true, handle: "gola", fin: "black", mirror: "full", led: true, top: "stone", counter: "galaxy", cfg: "floating" },
    { id: "v-terra", name: "Terracotta Retro", tags: ["rare", "matte"], carcass: "MDF 1101", shutter: "MDF 7708", dstyle: "slab", handle: "knob", fin: "brass", mirror: "round", led: false, top: "laminate", cfg: "floor" },
    { id: "v-powder", name: "Powder Blue Pastel", tags: ["rare", "matte"], carcass: "MDF 1135", shutter: "MDF 7710", dstyle: "slab", handle: "tbar", fin: "nickel", mirror: "arch", led: true, back: "panel", backCol: "MDF 1135", top: "laminate", cfg: "floating" },
    { id: "v-greyoak", name: "Grey Oak Scandi", tags: ["wood", "popular"], carcass: "MDF 1135", shutter: "MDF 4402", dstyle: "slab", handle: "tbar", fin: "nickel", mirror: "rect", led: false, top: "laminate", cfg: "floating" },
    { id: "v-concrete", name: "Concrete & Black", tags: ["rare", "matte"], carcass: "MDF 5501", shutter: "MDF 8801", dstyle: "slab", handle: "bar320", fin: "black", mirror: "rect", led: true, top: "stone", counter: "black", cfg: "floating" },
    { id: "v-ivory", name: "Ivory Classic Vanity", tags: ["classic", "popular"], carcass: "MDF 1101", shutter: "MDF 1101", dstyle: "shaker", handle: "knob", fin: "brass", mirror: "arch", led: false, top: "stone", counter: "beige", cfg: "floor" },
    { id: "v-ebony", name: "Ebony Luxe", tags: ["luxury", "wood"], carcass: "MDF 1101", shutter: "MDF 3411", dstyle: "slab", handle: "bar224", fin: "brass", mirror: "arch", led: true, top: "stone", counter: "galaxy", cfg: "floating" },
    { id: "v-oldteak", name: "Old India Teak", tags: ["old", "classic", "wood"], carcass: "MDF 2210", shutter: "MDF 2210", dstyle: "slab", handle: "ibh8", fin: "chrome", mirror: "rect", led: false, top: "laminate", cfg: "floor" },
    { id: "v-taupeoak", name: "Taupe & Oak Two-tone", tags: ["twotone", "matte"], carcass: "MDF 1135", shutter: "MDF 7704", dstyle: "slab", handle: "edge", fin: "nickel", mirror: "arch", led: true, back: "panel", backCol: "MDF 2220", top: "laminate", cfg: "floor" }
  ];
  var VERAS = [{ id: "all", label: "All" }, { id: "popular", label: "Popular" }, { id: "floating", label: "Floating" }, { id: "feature", label: "Feature panel" }, { id: "handleless", label: "Handleless" }, { id: "twotone", label: "Two-tone" }, { id: "wood", label: "Wood & veneer" }, { id: "gloss", label: "Gloss" }, { id: "matte", label: "Matte colour" }, { id: "classic", label: "Classic" }, { id: "luxury", label: "Luxury" }, { id: "old", label: "Old India" }, { id: "rare", label: "Rare" }];
  var KERAS = [{ id: "all", label: "All" }, { id: "popular", label: "Popular" }, { id: "handleless", label: "Handleless" }, { id: "twotone", label: "Two-tone" }, { id: "wood", label: "Wood & veneer" }, { id: "gloss", label: "Gloss" }, { id: "matte", label: "Matte colour" }, { id: "classic", label: "Classic" }, { id: "luxury", label: "Luxury" }, { id: "rare", label: "Rare" }];
  function erasFor(t) { return t === "kitchen" ? KERAS : t === "tv" ? TERAS : t === "crockery" ? CERAS : t === "dresser" ? VERAS : /^(wardrobe|sliding|overhead|tall)$/.test(t) ? WERAS : ERAS; }
  function styleHas(s, era) { return era === "all" || (s.tags ? s.tags.indexOf(era) >= 0 : s.era === era); }
  var ERAS = [{ id: "all", label: "All" }, { id: "popular", label: "Popular" }, { id: "modern", label: "Modern" }, { id: "classic", label: "Classic" }, { id: "traditional", label: "Traditional" }, { id: "old", label: "Old India" }, { id: "rare", label: "Rare" }];
  function formatsFor(t) {
    var F = [];
    function f(label, set) { F.push({ label: label, set: set }); }
    switch (t) {
      case "wardrobe":
        [[1200, 2, 1], [1500, 2, 2], [1800, 3, 2], [2100, 3, 3], [2400, 4, 3], [2700, 4, 4]].forEach(function (p) {
          f(p[0] + " · " + p[1] + " door", { W: p[0], shutters: p[1], sections: p[2], loft: false });
          f(p[0] + " · " + p[1] + " door + loft", { W: p[0], shutters: p[1], sections: p[2], loft: true, loftShutters: p[1] });
        });
        f("1800 · 3 door · 2400 tall", { W: 1800, H: 2400, shutters: 3, sections: 2, loft: false, shelves: 5 });
        f("2400 · 4 door · 2400 tall + loft", { W: 2400, H: 2400, shutters: 4, sections: 3, loft: true, loftH: 500, loftShutters: 4, shelves: 5 });
        f("2400 · 4 door · drawers in every bay", { W: 2400, shutters: 4, sections: 3, loft: false, drawEvery: true, drawers: 2 });
        f("L-corner 2400 + 1200", { W: 2400, shutters: 4, sections: 3, loft: false, shape: "lcorner", W2: 1200 });
        f("Walk-in 3000 · open", { W: 3000, sections: 4, loft: false, shape: "walkin", shelves: 4 });
        break;
      case "sliding":
        [1800, 2100, 2400, 2700, 3000].forEach(function (w) { f(w + " · 2 slide", { W: w, sections: Math.max(2, Math.round(w / 800)), loft: false }); f(w + " · slide + loft", { W: w, sections: Math.max(2, Math.round(w / 800)), loft: true, loftShutters: Math.max(2, Math.round(w / 700)) }); });
        f("2400 · 2 slide · 2400 tall", { W: 2400, H: 2400, sections: 3, loft: false, shelves: 5 });
        f("3000 · 2 slide · drawers in every bay", { W: 3000, sections: 4, loft: false, drawEvery: true, drawers: 2 });
        break;
      case "overhead":
        [900, 1200, 1500, 1800, 2400, 3000].forEach(function (w) { f(w + " · " + Math.max(2, Math.round(w / 600)) + " door", { W: w, shutters: Math.max(2, Math.round(w / 600)) }); f(w + " tall 750", { W: w, H: 750, shutters: Math.max(2, Math.round(w / 600)) }); }); break;
      case "kbase":
        f("900 · L-SHAPED CORNER (Cookscape)", {
          W: 900, H: 720, D: 560,
          unitType: "fbcm",
          geometryType: "l_shaped_corner",
          corner: { enabled: true, type: "L", legW: 900, legD: 900, depth: 560, orientation: "right" },
          shutters: 2, sections: 1, shelves: 2, drawers: 0,
          handle: "standard", hfinish: "black",
          carcass: "MDF 1135", shutterCol: "MDF 7701",
          counter: "black", loft: false
        });
        f("1200 · FCM-LT (Cookscape)", {
          W: 1200, H: 720, D: 560,
          unitType: "fcm-lt",
          fixedPanel: { enabled: true, width: 600, type: "fixed" },
          openShutter: { enabled: true, width: 600, type: "shutter", count: 1, opening: "left" },
          shutters: 1, sections: 2, shelves: 1, drawers: 0,
          handle: "pull", hfinish: "black",
          carcass: "MDF 1135", shutterCol: "MDF 7701",
          counter: "black", loft: false
        });
        f("1200 · FCM-RT (Cookscape)", {
          W: 1200, H: 720, D: 560,
          unitType: "fcm-rt",
          fixedPanel: { enabled: true, width: 600, type: "fixed" },
          openShutter: { enabled: true, width: 600, type: "shutter", count: 1, opening: "right" },
          shutters: 1, sections: 2, shelves: 1, drawers: 0,
          handle: "pull", hfinish: "black",
          carcass: "MDF 1135", shutterCol: "MDF 7701",
          counter: "black", loft: false
        });
        [1200, 1800, 2400, 3000, 3600].forEach(function (w) { f(w + " · granite", { W: w, shutters: Math.max(2, Math.round(w / 600)), sections: Math.max(2, Math.round(w / 600)), counter: "black" }); f(w + " · marble", { W: w, shutters: Math.max(2, Math.round(w / 600)), sections: Math.max(2, Math.round(w / 600)), counter: "white" }); }); break;
      case "kwall":
        [900, 1200, 1800, 2400, 3000].forEach(function (w) { f(w + " · 720 high", { W: w, shutters: Math.max(2, Math.round(w / 600)), sections: Math.max(2, Math.round(w / 600)) }); f(w + " · 900 high", { W: w, H: 900, shutters: Math.max(2, Math.round(w / 600)), sections: Math.max(2, Math.round(w / 600)) }); }); break;
      case "tall":
        [450, 600, 900].forEach(function (w) { [2100, 2400].forEach(function (h) { f(w + " × " + h, { W: w, H: h, shutters: w > 600 ? 2 : 1 }); }); }); f("600 × 2100 · 7 shelves", { W: 600, H: 2100, shelves: 7 }); f("900 × 2400 · 2 door", { W: 900, H: 2400, shutters: 2, shelves: 6 }); break;
      case "tv":
        f("1500 · floating console", { W: 1500, tvSize: 50 });
        f("1800 · floating · panel 2400", { W: 1800, tvBackH: 2400, tvSize: 55 });
        f("2100 · floating · 65in", { W: 2100, tvSize: 65 });
        f("2400 · floating · panel 2700", { W: 2400, tvBackH: 2700, tvSize: 65 });
        f("2400 · on plinth", { W: 2400, tvFloat: false, tvSize: 65 });
        f("1800 · with towers", { W: 1800, tvTowers: "both", tvSize: 55 });
        f("2400 · towers + wall cabinets", { W: 2400, tvTowers: "both", tvWall: true, tvSize: 65 });
        f("3000 · media wall · 75in", { W: 3000, tvSize: 75, tvTowers: "both", tvWall: true, tvBackH: 2700 });
        f("1800 · open niches", { W: 1800, tvConsole: "open", tvSize: 55 });
        f("2100 · mixed console", { W: 2100, tvConsole: "mixed", tvSize: 55 });
        f("1200 · compact 43in", { W: 1200, tvSize: 43, tvShelves: 1 });
        f("2700 · drawers · shelves", { W: 2700, tvShelves: 2, tvSize: 65 });
        f("1800 · console only, no TV", { W: 1800, tvShow: false, tvShelves: 2 });
        break;
      case "crockery":
        f("900 · tall display", { W: 900, H: 2100, crConfig: "tall" });
        f("1200 · base + hutch", { W: 1200, H: 2100 });
        f("1500 · base + hutch · drawers", { W: 1500, H: 2100, crBase: "drawers" });
        f("1800 · buffet + hutch", { W: 1800, H: 2100 });
        f("2100 · buffet + hutch 2400", { W: 2100, H: 2400 });
        f("1200 · floating buffet", { W: 1200, H: 2100, crConfig: "floating" });
        f("1800 · floating buffet · drawers", { W: 1800, H: 2100, crConfig: "floating", crBase: "drawers" });
        f("1500 · sideboard + open shelves", { W: 1500, H: 2100, crUpper: "open" });
        f("1800 · sideboard only", { W: 1800, H: 945, crConfig: "sideboard" });
        f("2400 · bar & crockery wall", { W: 2400, H: 2400, crBase: "drawers" });
        f("1200 · tall 2400", { W: 1200, H: 2400, crConfig: "tall" });
        f("900 · compact floating", { W: 900, H: 1900, crConfig: "floating" });
        break;
      case "shoe":
        [600, 900, 1200].forEach(function (w) { [900, 1200].forEach(function (h) { f(w + " × " + h, { W: w, H: h, shutters: w > 800 ? 2 : 1, shelves: Math.round(h / 280) }); }); }); f("900 × 1500 · 5 tier", { W: 900, H: 1500, shutters: 2, shelves: 5 }); f("1200 × 900 · bench", { W: 1200, H: 900, shutters: 3, shelves: 2 }); break;
      case "dresser":
        f("900 · floating · arch mirror", { W: 900, drConfig: "floating", drMirror: "arch" });
        f("1200 · floating · round mirror", { W: 1200, drConfig: "floating", drMirror: "round" });
        f("1200 · floor · 2 drawer rows", { W: 1200, drConfig: "floor", drMirror: "rect" });
        f("1500 · floor · arch + shelves", { W: 1500, drConfig: "floor", drMirror: "arch", drShelves: 2 });
        f("1500 · floating + tower", { W: 1500, drConfig: "floating", drTower: "right", drMirror: "rect" });
        f("1800 · floor + tower · full mirror", { W: 1800, drConfig: "floor", drTower: "left", drMirror: "full" });
        f("900 · compact floating · rect", { W: 900, drConfig: "floating", drMirror: "rect" });
        f("1200 · feature panel · arch LED", { W: 1200, drBack: "fluted", drMirror: "arch", drLed: true });
        f("1500 · doors console · round", { W: 1500, drBase: "doors", drMirror: "round" });
        f("2100 · dressing wall · towers both", { W: 2100, drTower: "both", drMirror: "rect", drShelves: 2 });
        break;
      case "kitchen":
        f("Straight 2400", { klayout: "straight", kA: 2400, kTall: false });
        f("Straight 3000", { klayout: "straight", kA: 3000 });
        f("Straight 3600 · oven tower", { klayout: "straight", kA: 3600, kOven: true });
        f("Straight 4200 · loft + dishwasher", { klayout: "straight", kA: 4200, kLoft: true, kDish: true });
        f("L-shape 3000 + 2400", { klayout: "lshape", kA: 3000, kB: 2400 });
        f("L-shape 3600 + 3000 · oven tower", { klayout: "lshape", kA: 3600, kB: 3000, kOven: true, kDish: true });
        f("L-shape 4200 + 2400 · loft + shelves", { klayout: "lshape", kA: 4200, kB: 2400, kLoft: true, kShelves: true });
        f("L + island 3600 + 2400 · 1800", { klayout: "lisland", kA: 3600, kB: 2400, kI: 1800, kBar: true });
        f("U-shape 3000 + 2400 + 2400", { klayout: "ushape", kA: 3000, kB: 2400, kC: 2400 });
        f("U-shape 3600 + 3000 + 3000 · oven tower", { klayout: "ushape", kA: 3600, kB: 3000, kC: 3000, kOven: true, kDish: true, kLoft: true });
        f("Parallel 3000 + 3000", { klayout: "parallel", kA: 3000, kB: 3000 });
        f("Parallel 3600 + 3600 · loft", { klayout: "parallel", kA: 3600, kB: 3600, kLoft: true, kDish: true });
        f("Island 3600 + 1800 · breakfast bar", { klayout: "island", kA: 3600, kB: 1800, kBar: true });
        f("Island 4200 + 2400 · oven tower", { klayout: "island", kA: 4200, kB: 2400, kBar: true, kOven: true, kDish: true });
        f("Peninsula 3600 + 2400 + 1800", { klayout: "peninsula", kA: 3600, kB: 2400, kP: 1800, kBar: true });
        f("G-shape 3600 + 2400 + 2400 + 1800", { klayout: "gshape", kA: 3600, kB: 2400, kC: 2400, kP: 1800, kBar: true, kOven: true });
        f("Straight 3000 · open shelves, no tall", { klayout: "straight", kA: 3000, kTall: false, kShelves: true });
        break;
      default:
        [600, 900, 1200].forEach(function (w) { [1800, 2100].forEach(function (h) { f(w + " × " + h, { W: w, H: h, shelves: Math.round(h / 360) }); }); }); f("900 × 2400 · 6 shelf", { W: 900, H: 2400, shelves: 6 }); f("1200 × 1500 · 4 shelf", { W: 1200, H: 1500, shelves: 4 });
    }
    return F;
  }
  function presetsFor(t) {
    var out = [];
    formatsFor(t).forEach(function (fm) {
      stylesFor(t).forEach(function (s) {
        out.push({ type: t, fmt: fm, style: s, name: s.name + " · " + fm.label });
      });
    });
    return out;
  }
  function presetUnit(p) {
    var u = newUnit(p.type === "kitchen" ? "KITCHEN" : CT(p.type).label.split(" ")[0].toUpperCase());
    applyType(u, p.type);
    for (var k in p.fmt.set) u[k] = p.fmt.set[k];
    if (u.ctype === "kitchen") u.W = u.kA;
    applyStyle(u, p.style, p.fmt.set);
    return u;
  }
  function applyStyle(u, s, locked) {
    function setIf(k, v) { if (!locked || !(k in locked)) u[k] = v; }
    if (u.ctype === "tv") {
      setIf("tvBack", s.back || "panel"); setIf("tvBackCol", s.backCol || null); setIf("tvStone", s.stone || "marble");
      setIf("tvConsole", s.console || "drawers"); setIf("tvFloat", s.float !== false); setIf("tvLed", s.led !== false);
    }
    if (u.ctype === "crockery") {
      setIf("crUpper", s.upper || "aluglass"); setIf("crUpperCol", s.upperCol || null); setIf("crBack", s.back || "mirror");
      setIf("crTop", s.top || "stone"); setIf("crLed", s.led !== false); if (s.counter) setIf("counter", s.counter);
    }
    if (u.ctype === "dresser") {
      setIf("drMirror", s.mirror || "arch"); setIf("drLed", s.led !== false); setIf("drBack", s.back || "none"); setIf("drBackCol", s.backCol || null);
      setIf("drTop", s.top || "laminate"); setIf("drConfig", s.cfg || "floor"); setIf("drBase", s.base || "drawers"); if (s.counter) setIf("counter", s.counter);
    }
    u.carcass = s.carcass; u.shutterCol = s.shutter; u.dstyle = s.dstyle; u.handle = s.handle; u.hfinish = s.fin;
    if (s.paint) u.paint = s.paint;
    u.kWallCol = s.wallCol || null; u.kWallDs = s.wallDs || null;
    u.shutterCol2 = s.shutter2 || null; u.hgrain = !!s.hgrain; u.glassTint = s.tint || "fluted"; u.frameFin = s.frame || "black"; u.leatherHex = s.leather || "#4A3626";
    if (s.counter) u.counter = s.counter;
    u.kSplash = s.splash || "subway"; u.kSplashHex = s.splashHex || null;
  }
  function applyPreset(p) {
    var u = presetUnit(p);
    S.units[S.active] = u;
    if (u.ctype === "kitchen") { var kl = u.klayout || "straight"; if (/ushape|gshape/.test(kl)) { cam.yaw = -9; cam.pitch = -19; cam.zoom = -0.22; } else if (kl === "parallel") { cam.yaw = -84; cam.pitch = -9; cam.zoom = 0.5; }   /* standing at the galley's open end, eye level */ else { cam.yaw = -34; cam.pitch = -17; cam.zoom = -0.12; } }
    else if (u.ctype === "tv") { cam.yaw = -20; cam.pitch = -6; cam.zoom = -0.04; }
    else if (u.ctype === "crockery" || u.ctype === "dresser") { cam.yaw = -24; cam.pitch = -6; cam.zoom = 0; }
    else { cam.yaw = -26; cam.pitch = -7; cam.zoom = 0; }
    renderRail(); renderAll(); setView("design");
    toast(p.name);
  }

  /* ── catalogue audit: every door in every preset must be a solid front (no frame-around-a-hole),
     every box must have finite dimensions. Rasterises each door's parts on a 20 mm grid. ── */
  function auditPresets(types) {
    var out = { checked: 0, doors: 0, flagged: [] };
    (types || CTYPES.map(function (t) { return t.id; })).forEach(function (t) {
      presetsFor(t).forEach(function (p) {
        var u = presetUnit(p), L = sceneLayouts(u); out.checked++;
        L.forEach(function (lay) {
          var byDoor = {};
          lay.boxes.forEach(function (b) {
            var w = b.shape === "cyl" ? b.r * 2 : b.w, h = b.shape === "cyl" ? b.len : b.h, d = b.shape === "cyl" ? b.r * 2 : b.d;
            if (![b.x, b.y, b.z, w, h, d].every(isFinite)) out.flagged.push({ preset: p.name, why: "non-finite box", box: b });
            if (!b.door) return;
            var id = b.door.id; (byDoor[id] = byDoor[id] || []).push({ x: b.x - w / 2, y: b.y, w: w, h: h, drawerbox: b.role === "drawerbox" });
          });
          for (var id in byDoor) {
            var parts = byDoor[id].filter(function (q) { return !q.drawerbox; }); if (!parts.length) continue;
            out.doors++;
            var x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
            parts.forEach(function (q) { x0 = Math.min(x0, q.x); y0 = Math.min(y0, q.y); x1 = Math.max(x1, q.x + q.w); y1 = Math.max(y1, q.y + q.h); });
            var cw = Math.max(1, Math.round((x1 - x0) / 20)), ch = Math.max(1, Math.round((y1 - y0) / 20)), grid = new Uint8Array(cw * ch), hit = 0;
            parts.forEach(function (q) {
              var a0 = Math.max(0, Math.floor((q.x - x0) / 20)), a1 = Math.min(cw, Math.ceil((q.x + q.w - x0) / 20));
              var b0 = Math.max(0, Math.floor((q.y - y0) / 20)), b1 = Math.min(ch, Math.ceil((q.y + q.h - y0) / 20));
              for (var yy = b0; yy < b1; yy++) for (var xx = a0; xx < a1; xx++) { var k = yy * cw + xx; if (!grid[k]) { grid[k] = 1; hit++; } }
            });
            var ratio = hit / (cw * ch);
            if (ratio < 0.85) out.flagged.push({ preset: p.name, why: "door has a hole", coverage: Math.round(ratio * 100) + "%", door: id });
          }
        });
      });
    });
    return out;
  }

  /* ── gallery view ── */
  var galState = { type: "wardrobe", era: "all" };
  function renderGallery() {
    var w = $("#galGrid"); if (!w) return;
    var tabs = $("#galTypes"); tabs.innerHTML = "";
    CTYPES.forEach(function (t) {
      var b = el("uchip" + (galState.type === t.id ? " is-on" : ""), tabs, "button"); b.textContent = t.label;
      b.addEventListener("click", function () { galState.type = t.id; renderGallery(); });
    });
    var er = $("#galEras"); er.innerHTML = "";
    var eras = erasFor(galState.type);
    if (!eras.some(function (e) { return e.id === galState.era; })) galState.era = "all";
    eras.forEach(function (e) {
      var b = el("chip" + (galState.era === e.id ? " is-on" : ""), er, "button"); b.textContent = e.label;
      b.addEventListener("click", function () { galState.era = e.id; renderGallery(); });
    });
    var list = presetsFor(galState.type).filter(function (p) { return styleHas(p.style, galState.era); });
    $("#galCount").textContent = list.length + " designs · " + CT(galState.type).label;
    w.innerHTML = "";
    list.forEach(function (p) {
      var c = el("gcard", w, "button");
      var im = el("gthumb", c); im.dataset.key = p.type + "|" + p.fmt.label + "|" + p.style.id;
      el("gname", c).textContent = p.style.name;
      var cl = p.style.counter ? (COUNTERS.filter(function (x) { return x.id === p.style.counter; })[0] || {}).label : null;
      el("gspec", c).textContent = p.fmt.label + " · " + DS(p.style.dstyle).label.split(" ·")[0] + " · " + H(p.style.handle).label + " " + p.style.fin + (cl ? " · " + cl : "");
      var era = el("gera", c); era.textContent = p.style.era || (p.style.tags || []).slice(0, 2).join(" · ");
      c.addEventListener("click", function () { applyPreset(p); });
      c._preset = p;
    });
    /* the first screenful renders straight away (an observer will not fire
       in a hidden/background document); the rest render as they scroll in */
    var cards = $all(".gcard", w);
    thumbQ.length = 0;                                   /* drop work for cards that no longer exist */
    cards.slice(0, 30).forEach(function (c) { thumbQ.push(c); });
    cards.slice(30).forEach(function (c) { thumbObserver.observe(c); });
    pumpThumbs();
  }
  /* lazy thumbnails: one render per frame, only for cards on screen */
  var thumbQ = [], thumbBusy = false, thumbCache = {}, thumbErrors = [], thumbLog = [];
  var thumbObserver = ("IntersectionObserver" in window) ? new IntersectionObserver(function (entries) {
    entries.forEach(function (en) {
      if (!en.isIntersecting) return;
      thumbObserver.unobserve(en.target);
      thumbQ.push(en.target); pumpThumbs();
    });
  }, { rootMargin: "200px" }) : { observe: function (c) { thumbQ.push(c); pumpThumbs(); }, unobserve: function () { } };
  function pumpThumbs() {
    if (thumbBusy || !thumbQ.length) return;
    thumbBusy = true;
    /* a timer, not requestAnimationFrame: rAF pauses in background or
       hidden tabs and the catalogue would stop filling in */
    setTimeout(function () {
      for (var n = 0; n < 2 && thumbQ.length; n++) {
        var c = thumbQ.shift(), im = c && c.querySelector(".gthumb");
        if (!c || !c.isConnected) continue;
        try {
          if (im) {
            var key = im.dataset.key;
            if (thumbCache[key]) im.style.backgroundImage = "url(" + thumbCache[key] + ")";
            else if (GL.ok) {
              var t0 = performance.now(), url = GL.thumb(presetUnit(c._preset));
              thumbLog.push({ k: key, ms: Math.round(performance.now() - t0), ok: !!url, len: url ? url.length : 0, q: thumbQ.length });
              if (url) { thumbCache[key] = url; im.style.backgroundImage = "url(" + url + ")"; }
            }
          }
        } catch (e) { thumbErrors.push((c && c._preset ? c._preset.name : "?") + ": " + (e && e.message || e)); }
      }
      thumbBusy = false; pumpThumbs();
    });
  }

  /* ══════════ CSS-3D FALLBACK ══════════ */
  var SH = { F: { k: .02 }, B: { k: .36 }, L: { k: .13 }, R: { k: .24 }, T: { w: .13 }, Bo: { k: .46 } };
  function face(parent, w, h, tf, key, texUrl, opts) {
    var f = el("face", parent);
    f.style.width = w + "px"; f.style.height = h + "px";
    f.style.transform = "translate(-50%,-50%) " + tf;
    if (texUrl) { f.style.backgroundColor = texHex[texUrl] || "#B9B4AA"; f.style.backgroundImage = "url(" + texUrl + ")"; f.style.backgroundSize = GRAIN_W + "px " + GRAIN_H + "px"; }
    var s = SH[key] || {}, bg = [], sh = [];
    if (s.k) bg.push("linear-gradient(rgba(10,8,6," + s.k + "),rgba(10,8,6," + s.k + "))");
    if (s.w) bg.push("linear-gradient(rgba(255,253,246," + s.w + "),rgba(255,253,246," + s.w + "))");
    if (opts && opts.eb) sh.push("inset 0 0 0 1.5px rgba(255,255,255,.16)", "inset 0 0 0 3px rgba(0,0,0,.10)");
    if (bg.length || sh.length) { var ov = el("ov", f); if (bg.length) ov.style.background = bg.join(","); if (sh.length) ov.style.boxShadow = sh.join(","); }
    return f;
  }
  function box(parent, o) {
    var c = el("b3", parent);
    c.style.transform = "translate3d(" + o.x + "px," + (MID - o.y - o.h / 2) + "px," + o.z + "px)";
    var list = o.faces || ["F", "L", "R", "T"];
    var defs = {
      F: [o.w, o.h, "translateZ(" + (o.d / 2) + "px)"], B: [o.w, o.h, "rotateY(180deg) translateZ(" + (o.d / 2) + "px)"],
      L: [o.d, o.h, "rotateY(-90deg) translateZ(" + (o.w / 2) + "px)"], R: [o.d, o.h, "rotateY(90deg) translateZ(" + (o.w / 2) + "px)"],
      T: [o.w, o.d, "rotateX(90deg) translateZ(" + (o.h / 2) + "px)"], Bo: [o.w, o.d, "rotateX(-90deg) translateZ(" + (o.h / 2) + "px)"]
    };
    for (var i = 0; i < list.length; i++) { var d = defs[list[i]]; if (d) face(c, d[0], d[1], d[2], list[i], o.tex, { eb: o.eb }); }
    return c;
  }
  function cssRender(L, u0) {
    world.innerHTML = "";
    L.forEach(function (lay) {
      var g = world;
      if (lay.transform) { g = el("b3", world); g.style.transform = "translate3d(" + lay.transform.tx + "px,0px," + lay.transform.tz + "px) rotateY(" + lay.transform.ry + "deg)"; }
      lay.boxes.forEach(function (b) {
        if (b.mat === "glass" || b.mat === "mirror") return;
        var t = b.col ? tex(lam(b.col)) : null;
        var n = box(g, { x: b.x, y: b.y, z: b.z, w: b.w, h: b.h, d: b.d, tex: t, eb: b.role === "front", faces: b.role === "front" ? ["F", "L", "R", "T", "Bo"] : ["F", "L", "R", "T"] });
        if (b.mat === "reveal" && n && n.firstChild && n.firstChild.style) n.firstChild.style.background = "#241E18";
        else if (b.mat) $all(".face", n).forEach(function (f) { f.style.background = /granite|galaxy|green/.test(b.mat) ? "#27272b" : /marble|quartz|beige|splash|tile|glass/.test(b.mat) ? "#e8e4dc" : b.mat === "floor" || /tile/.test(b.mat) ? "#97C96E" : b.mat === "steel" ? "#C9CCCF" : /^leather/.test(b.mat) ? b.mat.slice(8) : /^(black|nickel|brass|chrome)$/.test(b.mat) ? "#3a3a3c" : b.mat === "led" ? "#FFE6B8" : "#2b2723"; });
      });
    });
  }

  /* ══════════ CAMERA ══════════ */
  function fit() {
    if (GL.ok) { GL.frame(); return; }
    var r = stage.getBoundingClientRect();
    if (!r.height) return;
    var u = U();
    if (!u) return;
    var totalH = u.H + (u.loft ? u.loftH + 2 : 0);
    var span = u.shape === "lcorner" ? u.W + u.D + Math.max(u.D, (u.W2 || 1200) * 0.55) : Math.max(u.W, u.D * 1.6);
    scale = Math.max(0.05, Math.min((r.height * 0.72) / totalH, (r.width * 0.64) / span));
  }
  function camApply() {
    cam.pitch = Math.max(-85, Math.min(85, cam.pitch));
    cam.zoom = Math.max(-0.80, Math.min(3.5, cam.zoom));
    if (GL.ok) { GL.apply(); return; }
    var s = scale * (1 + cam.zoom);
    world.style.transform = "rotateX(" + (-cam.pitch) + "deg) rotateY(" + cam.yaw + "deg) scale3d(" + s + "," + s + "," + s + ")";
  }
  (function () {
    var pts = {}, lastD = 0;
    var downAt = null, hDrag = null, furnDrag = null;
    var studioCamMode = 'rotate'; // 'rotate' (orbit) | 'pan' (move centre) | 'interact' (move furniture)

    stage.addEventListener("contextmenu", function (e) { e.preventDefault(); });

    // Hover feedback: show 'pointer' cursor over 3D furniture units when in interact mode
    stage.addEventListener("pointermove", function (e) {
      if (furnDrag || hDrag || Object.keys(pts).length > 0) return;
      if (studioCamMode === 'interact' && GL.ok && GL.pickFurniture) {
        var fHit = GL.pickFurniture(e.clientX, e.clientY);
        stage.style.cursor = fHit ? "pointer" : "";
      } else if (studioCamMode === 'pan') {
        stage.style.cursor = "move";
      } else {
        stage.style.cursor = "";
      }
    });

    var gizmoDrag = null;
    // Capture phase: Handle 3D Gizmo arrows and furniture selection
    stage.addEventListener("pointerdown", function (e) {
      downAt = { x: e.clientX, y: e.clientY, t: Date.now() };

      // 0. Check 3D Gizmo translation arrows FIRST!
      // "on clicking unit it should show arrow like this then only it should be movable"
      if (GL.ok && GL.gizmoPick && e.button === 0) {
        var gHit = GL.gizmoPick(e.clientX, e.clientY);
        if (gHit) {
          var gObj = GL.getGizmoTarget();
          var gId = GL.getGizmoFurnId();
          if (gObj && gId) {
            var fp = GL.floorPoint(e.clientX, e.clientY) || { x: gObj.position.x, z: gObj.position.z };
            gizmoDrag = {
              axis: gHit.axis,
              id: gId,
              obj: gObj,
              dims: (gObj.userData && gObj.userData.dims) || { W: 1200, H: 850, D: 600 },
              startX: e.clientX,
              startY: e.clientY,
              startPos: { x: gObj.position.x, z: gObj.position.z },
              startPosY: gObj.position.y || 0,
              startRot: gObj.rotation.y || 0,
              startFloor: fp,
              moved: false
            };
            stage.setPointerCapture(e.pointerId);
            stage.classList.add("grab");
            e.stopImmediatePropagation();
            e.preventDefault();
            return;
          }
        }
      }

      // 1. Click unit: Show translation arrow gizmo, DO NOT drag unit
      if (GL.ok && GL.pickFurniture && e.button === 0) {
        var fHit = GL.pickFurniture(e.clientX, e.clientY);
        if (fHit) {
          var homeObj = (GL.getScene && GL.getScene()) ? GL.getScene().getObjectByName('OrbixHome3D') : null;
          var groupObj = fHit.object;
          while (groupObj && groupObj.parent && groupObj.parent !== homeObj && (!groupObj.userData || !groupObj.userData.isFurnitureGroup)) {
            groupObj = groupObj.parent;
          }
          if (!groupObj) groupObj = fHit.object;

          // Show Gizmo Arrows for this unit!
          GL.gizmoSet(groupObj, fHit.id);

          if (window.OrbixUI && window.OrbixUI.editor) {
            window.OrbixUI.editor.selected = [{ type: 'furniture', id: fHit.id }];
            if (window.OrbixUI.editor.render) window.OrbixUI.editor.render();
            if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
          }
          if (window.OrbixUI && typeof window.OrbixUI.selectFurnitureIn3DStudio === 'function') {
            window.OrbixUI.selectFurnitureIn3DStudio(fHit.id);
          }
        } else {
          // Clicked background: hide gizmo
          if (!hDrag && GL.gizmoSet) GL.gizmoSet(null);
        }
      }

      // 2. Check room resize handle
      if (ROOM.id && GL.ok) {
        var h = GL.handleAt(e.clientX, e.clientY);
        if (h) {
          hDrag = h;
          e.stopImmediatePropagation();
          e.preventDefault();
          stage.setPointerCapture(e.pointerId);
          stage.classList.add("grab");
        }
      }
    }, true);

    stage.addEventListener("pointermove", function (e) {
      // 3D Gizmo Arrow Drag: move unit strictly along selected axis
      if (gizmoDrag) {
        e.stopImmediatePropagation();
        e.preventDefault();
        if (gizmoDrag.axis === 'y') {
          // Vertical Y-axis drag (adjust mounting height / elevation AFFL)
          var screenDy = gizmoDrag.startY - e.clientY;
          if (Math.abs(screenDy) > 3) {
            gizmoDrag.moved = true;
            stage.style.cursor = "ns-resize";
          }
          var newElev = Math.max(0, Math.min(3000, Math.round((gizmoDrag.startPosY + screenDy * 3.5) / 50) * 50));
          gizmoDrag.obj.position.y = newElev;
        } else {
          var curF = GL.floorPoint(e.clientX, e.clientY);
          if (curF) {
            var dx = curF.x - gizmoDrag.startFloor.x;
            var dz = curF.z - gizmoDrag.startFloor.z;
            if (Math.hypot(e.clientX - gizmoDrag.startX, e.clientY - gizmoDrag.startY) > 3) {
              gizmoDrag.moved = true;
              stage.style.cursor = "grabbing";
            }
            var theta = (gizmoDrag.obj.rotation ? gizmoDrag.obj.rotation.y : 0);
            if (gizmoDrag.axis === 'x') {
              // Movement along local X (length / wall direction)
              var deltaLocalX = dx * Math.cos(theta) - dz * Math.sin(theta);
              gizmoDrag.obj.position.x = gizmoDrag.startPos.x + deltaLocalX * Math.cos(theta);
              gizmoDrag.obj.position.z = gizmoDrag.startPos.z - deltaLocalX * Math.sin(theta);
            } else if (gizmoDrag.axis === 'z') {
              // Movement along local Z (depth / perpendicular to wall)
              var deltaLocalZ = dx * Math.sin(theta) + dz * Math.cos(theta);
              gizmoDrag.obj.position.x = gizmoDrag.startPos.x + deltaLocalZ * Math.sin(theta);
              gizmoDrag.obj.position.z = gizmoDrag.startPos.z + deltaLocalZ * Math.cos(theta);
            } else if (gizmoDrag.axis === 'rot') {
              // Free rotation around vertical axis
              var cx = gizmoDrag.startPos.x, cz = gizmoDrag.startPos.z;
              var angle = Math.atan2(curF.x - cx, curF.z - cz);
              gizmoDrag.obj.rotation.y = angle;
            } else {
              gizmoDrag.obj.position.x = gizmoDrag.startPos.x + dx;
              gizmoDrag.obj.position.z = gizmoDrag.startPos.z + dz;
            }
          }
        }

        // Live collision/overlap check against walls, corner intersections, and adjacent units
        var planM = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
        if (window.OrbixCore && window.OrbixCore.checkPlacementOverlap && planM) {
          var testFurn = {
            id: gizmoDrag.id,
            pos: { x: gizmoDrag.obj.position.x, y: gizmoDrag.obj.position.z },
            elevation: gizmoDrag.obj.position.y || 0,
            rotY: -(gizmoDrag.obj.rotation.y || 0),
            dimensions: gizmoDrag.dims || { W: 1200, H: 850, D: 600 }
          };
          var chk = window.OrbixCore.checkPlacementOverlap(testFurn, planM, gizmoDrag.id);
          setUnitOverlapVisual(gizmoDrag.obj, chk.hasOverlap);
        }

        GL.gizmoSet(gizmoDrag.obj, gizmoDrag.id);
        GL.settle();
        return;
      }

      // Interactive cursor feedback on hovering Gizmo arrows
      if (!hDrag && !furnDrag && GL.ok && GL.gizmoPick) {
        var hoverHit = GL.gizmoPick(e.clientX, e.clientY);
        if (hoverHit) {
          if (hoverHit.axis === 'y') stage.style.cursor = "ns-resize";
          else if (hoverHit.axis === 'x') stage.style.cursor = "ew-resize";
          else if (hoverHit.axis === 'rot') stage.style.cursor = "crosshair";
          else stage.style.cursor = "pointer";
        } else {
          if (stage.style.cursor === "ns-resize" || stage.style.cursor === "ew-resize" || stage.style.cursor === "crosshair" || stage.style.cursor === "pointer") {
            stage.style.cursor = "";
          }
        }
      }

      // Furniture drag in 3D (legacy fallback)
      if (furnDrag) {
        e.stopImmediatePropagation();
        e.preventDefault();
        var p = GL.floorPoint(e.clientX, e.clientY);
        if (p) {
          if (Math.hypot(e.clientX - furnDrag.startX, e.clientY - furnDrag.startY) > 3) {
            furnDrag.moved = true;
            stage.style.cursor = "grabbing";
          }
          furnDrag.obj.position.x = p.x + furnDrag.offset.x;
          furnDrag.obj.position.z = p.z + furnDrag.offset.z;
          GL.settle();
        }
        return;
      }

      // Room boundary handle drag
      if (hDrag) {
        e.stopImmediatePropagation();
        var p = GL.floorPoint(e.clientX, e.clientY);
        if (!p) return;
        var def = ROOM.def;
        if (hDrag === "w") roomResize("w", p.x + def.W / 2);
        else roomResize("d", p.z + def.D / 2);
        return;
      }
    }, true);

    stage.addEventListener("pointerup", function (e) {
      if (gizmoDrag) {
        var gd = gizmoDrag;
        gizmoDrag = null;
        e.stopImmediatePropagation();
        stage.classList.remove("grab");
        stage.style.cursor = "";
        try { stage.releasePointerCapture(e.pointerId); } catch (err) { }

        var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);

        if (gd.axis === 'rot' && !gd.moved) {
          // Clicking rotation arc directly turns 90 degrees
          var candRotY = ((gd.obj.rotation.y || 0) - Math.PI / 2) % (Math.PI * 2);
          var candFurnR = {
            id: gd.id,
            pos: { x: gd.obj.position.x, y: gd.obj.position.z },
            elevation: gd.obj.position.y || 0,
            rotY: -candRotY,
            dimensions: gd.dims
          };
          var chkR = (window.OrbixCore && window.OrbixCore.checkPlacementOverlap && plan) ?
            window.OrbixCore.checkPlacementOverlap(candFurnR, plan, gd.id) : { hasOverlap: false };

          if (chkR.hasOverlap) {
            setUnitOverlapVisual(gd.obj, false);
            if (typeof toast === 'function') toast("⚠️ Cannot rotate: Unit collides with wall or adjacent unit!");
          } else {
            gd.obj.rotation.y = candRotY;
            GL.gizmoSet(gd.obj, gd.id);
            GL.settle();
            if (plan && plan.furniture) {
              var fR = plan.furniture.find(function (it) { return it.id === gd.id; });
              if (fR) {
                fR.rotY = -candRotY;
                if (window.OrbixUI.editor) window.OrbixUI.editor.pushHistory('Rotate Furniture (Gizmo)');
                if (window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
                if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
                if (typeof toast === 'function') toast("Rotated 90°");
              }
            }
          }
        } else if (gd.moved) {
          // Check collision on drop: if invalid placement, revert to previous position!
          if (gd.obj.userData.isOverlapped) {
            gd.obj.position.x = gd.startPos.x;
            gd.obj.position.z = gd.startPos.z;
            gd.obj.position.y = gd.startPosY;
            gd.obj.rotation.y = gd.startRot || 0;
            setUnitOverlapVisual(gd.obj, false);
            GL.gizmoSet(gd.obj, gd.id);
            GL.settle();
            if (typeof toast === 'function') toast("⚠️ Invalid placement: Unit penetrates wall or overlaps adjacent unit! Placement reverted.");
            return;
          }

          var finalX = Math.round(gd.obj.position.x / 50) * 50;
          var finalZ = Math.round(gd.obj.position.z / 50) * 50;
          var finalY = Math.max(0, Math.min(3000, Math.round(gd.obj.position.y / 50) * 50));
          gd.obj.position.x = finalX;
          gd.obj.position.z = finalZ;
          gd.obj.position.y = finalY;
          GL.gizmoSet(gd.obj, gd.id);
          GL.settle();

          if (plan) {
            var list = plan.furniture || [];
            for (var i = 0; i < list.length; i++) {
              if (list[i].id === gd.id) {
                list[i].pos.x = finalX;
                list[i].pos.y = finalZ;
                list[i].pos.z = finalY;
                list[i].elevation = finalY;
                list[i].rotY = -(gd.obj.rotation.y || 0);
                var rms = plan.rooms || [];
                for (var r = 0; r < rms.length; r++) {
                  if (window.OrbixCore && window.OrbixCore.Vec2 && window.OrbixCore.Vec2.pointInPolygon(list[i].pos, rms[r].polygon)) {
                    list[i].roomId = rms[r].id;
                    break;
                  }
                }
                break;
              }
            }
            if (window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
            if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
            if (window.OrbixUI && window.OrbixUI.editor) {
              window.OrbixUI.editor.pushHistory('Move Furniture (3D Gizmo)');
              window.OrbixUI.editor.render();
            }
            if (window.OrbixUI && window.OrbixUI.renderBOQ) window.OrbixUI.renderBOQ();
            if (window.OrbixUI && window.OrbixUI.renderInspector) window.OrbixUI.renderInspector([{ type: 'furniture', id: gd.id }]);
            if (gd.axis === 'y' && typeof toast === 'function') {
              toast("Unit elevation set to " + finalY + " mm AFFL");
            }
          }
        }
        return;
      }

      if (furnDrag) {
        var fd = furnDrag;
        furnDrag = null;
        e.stopImmediatePropagation();
        stage.classList.remove("grab");
        stage.style.cursor = "";
        try { stage.releasePointerCapture(e.pointerId); } catch (err) { }

        if (fd.moved) {
          // Snap to 50mm grid
          var finalX2 = Math.round(fd.obj.position.x / 50) * 50;
          var finalZ2 = Math.round(fd.obj.position.z / 50) * 50;
          fd.obj.position.x = finalX2;
          fd.obj.position.z = finalZ2;
          GL.settle();

          // Sync with project data
          var plan2 = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
          if (plan2) {
            var list2 = plan2.furniture || [];
            for (var i2 = 0; i2 < list2.length; i2++) {
              if (list2[i2].id === fd.id) {
                list2[i2].pos.x = finalX2;
                list2[i2].pos.y = finalZ2;
                var rms2 = plan2.rooms || [];
                for (var r2 = 0; r2 < rms2.length; r2++) {
                  if (window.OrbixCore && window.OrbixCore.Vec2 && window.OrbixCore.Vec2.pointInPolygon(list2[i2].pos, rms2[r2].polygon)) {
                    list2[i2].roomId = rms2[r2].id;
                    break;
                  }
                }
                break;
              }
            }
            if (window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
            if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
            if (window.OrbixUI && window.OrbixUI.editor) {
              window.OrbixUI.editor.pushHistory('Move Furniture (3D)');
              window.OrbixUI.editor.selected = [{ type: 'furniture', id: fd.id }];
              window.OrbixUI.editor.render();
            }
            if (window.OrbixUI && window.OrbixUI.renderBOQ) window.OrbixUI.renderBOQ();
            if (window.OrbixUI && window.OrbixUI.renderInspector) window.OrbixUI.renderInspector([{ type: 'furniture', id: fd.id }]);
            if (window.OrbixUI && typeof window.OrbixUI.selectFurnitureIn3DStudio === 'function') {
              window.OrbixUI.selectFurnitureIn3DStudio(fd.id);
            }
            if (window.OrbixUI && window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
          }
        } else {
          // Just clicked: select the furniture unit and show customize inspector
          if (window.OrbixUI && window.OrbixUI.editor) {
            window.OrbixUI.editor.selected = [{ type: 'furniture', id: fd.id }];
            if (window.OrbixUI.editor.render) window.OrbixUI.editor.render();
            if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
          }
          if (window.OrbixUI && typeof window.OrbixUI.selectFurnitureIn3DStudio === 'function') {
            window.OrbixUI.selectFurnitureIn3DStudio(fd.id);
          }
        }
        return;
      }

      if (hDrag) {
        hDrag = null;
        e.stopImmediatePropagation();
        stage.classList.remove("grab");
        downAt = null;
        try { stage.releasePointerCapture(e.pointerId); } catch (err) { }
        if (EMBED) roomReport();
        return;
      }
    }, true);

    // Double-click on any 3D furniture unit: Open in 3D Studio Customizer
    stage.addEventListener("dblclick", function (e) {
      if (GL.ok && GL.pickFurniture) {
        var fHit = GL.pickFurniture(e.clientX, e.clientY);
        if (fHit && fHit.id) {
          if (window.OrbixUI && window.OrbixUI.editor) {
            window.OrbixUI.editor.selected = [{ type: 'furniture', id: fHit.id }];
            if (window.OrbixUI.renderInspector) window.OrbixUI.renderInspector(window.OrbixUI.editor.selected);
          }
          var btn = document.getElementById('inspOpen3DStudio');
          if (btn) btn.click();
        }
      }
    });

    // Main camera orbit & pan listeners
    stage.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0 && e.button !== 2 && e.button !== 1) return;
      pts[e.pointerId] = { clientX: e.clientX, clientY: e.clientY, button: e.button, shiftKey: e.shiftKey };
      stage.setPointerCapture(e.pointerId);
      stage.classList.add("grab");
    });

    stage.addEventListener("pointermove", function (e) {
      if (!pts[e.pointerId]) return;
      var prev = pts[e.pointerId];
      pts[e.pointerId] = { clientX: e.clientX, clientY: e.clientY, button: prev.button, shiftKey: e.shiftKey };
      var ids = Object.keys(pts);
      if (ids.length === 2) {
        var a = pts[ids[0]], b = pts[ids[1]];
        var d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
        if (lastD) cam.zoom = Math.max(-0.80, Math.min(3.5, cam.zoom + (d - lastD) * 0.004));
        lastD = d;
      } else {
        var dx = e.clientX - prev.clientX;
        var dy = e.clientY - prev.clientY;
        if (prev.button === 2 || prev.button === 1 || e.shiftKey || studioCamMode === 'pan') {
          // Pan camera target across floor plane
          var yawRad = cam.yaw * Math.PI / 180;
          var cosY = Math.cos(yawRad), sinY = Math.sin(yawRad);
          var panSpeed = 7.0 * Math.max(0.2, 1 - cam.zoom * 0.4);
          var tgt = GL.getTarget ? GL.getTarget() : null;
          if (tgt) {
            tgt.x -= (dx * cosY + dy * sinY * 0.5) * panSpeed;
            tgt.z -= (-dx * sinY + dy * cosY * 0.5) * panSpeed;
          }
        } else {
          // Orbit camera 360 degrees
          cam.yaw -= dx * 0.35;
          cam.pitch += dy * 0.25;
        }
      }
      camApply();
    });

    function up(e) {
      delete pts[e.pointerId];
      lastD = 0;
      if (!Object.keys(pts).length) stage.classList.remove("grab");
      if (downAt && Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y) < 5 && Date.now() - downAt.t < 500) {
        GL.pick(e.clientX, e.clientY);
      }
      downAt = null;
    }
    stage.addEventListener("pointerup", up);
    stage.addEventListener("pointercancel", up);
    stage.addEventListener("wheel", function (e) {
      e.preventDefault();
      cam.zoom = Math.max(-0.80, Math.min(3.5, cam.zoom - e.deltaY * 0.0016));
      camApply();
    }, { passive: false });

    // Wire 3D Camera Controls: Rotate View, Move Centre, Move Unit, Re-Centre
    var btnCamRot = document.getElementById('camRotateModeBtn');
    var btnCamPan = document.getElementById('camPanModeBtn');
    var btnCamInt = document.getElementById('camInteractModeBtn');
    var btnCamReset = document.getElementById('camResetCentreBtn');

    function setStudioCamMode(mode) {
      studioCamMode = mode;
      if (btnCamRot) btnCamRot.classList.toggle('is-on', mode === 'rotate');
      if (btnCamPan) btnCamPan.classList.toggle('is-on', mode === 'pan');
      if (btnCamInt) btnCamInt.classList.toggle('is-on', mode === 'interact');
      stage.style.cursor = mode === 'pan' ? 'move' : '';
    }

    if (btnCamRot) btnCamRot.addEventListener('click', function () { setStudioCamMode('rotate'); });
    if (btnCamPan) btnCamPan.addEventListener('click', function () { setStudioCamMode('pan'); });
    if (btnCamInt) btnCamInt.addEventListener('click', function () { setStudioCamMode('interact'); });
    if (btnCamReset) btnCamReset.addEventListener('click', function () {
      cam.yaw = 35;
      cam.pitch = 28;
      cam.zoom = 0;
      var tgt = GL.getTarget ? GL.getTarget() : null;
      if (tgt) { tgt.x = 0; tgt.z = 0; }
      camApply();
      if (GL.ok) GL.settle();
    });
  })();

  /* ══════════ RAIL ══════════ */
  function grp(parent, title) {
    var g = el("grp", parent);
    el("grp-h", g).textContent = title;
    return g;
  }
  function fld(parent, label, value, onChange, type) {
    var f = el("fld", parent);
    el(null, f, "label").textContent = label;
    var i = el(null, f, "input");
    i.type = type || "number"; i.value = value;
    i.addEventListener("input", function () { onChange(i.value); });
    return i;
  }
  function seg(parent, items, cur, onPick) {
    var s = el("seg", parent);
    items.forEach(function (it) {
      var b = el(it.v === cur ? "is-on" : "", s, "button");
      b.textContent = it.l;
      b.setAttribute("aria-pressed", String(it.v === cur));
      b.addEventListener("click", function () { onPick(it.v); });
    });
    return s;
  }
  function swatchGrid(parent, cur, onPick) {
    var g = el("swgrid", parent);
    LAMINATES.forEach(function (l) {
      var b = el("swb" + (l.code === cur ? " is-on" : ""), g, "button");
      b.style.backgroundImage = "url(" + tex(l, 144) + ")";
      b.title = l.code + " — " + l.name;
      b.setAttribute("aria-label", l.code + " " + l.name);
      b.setAttribute("aria-pressed", String(l.code === cur));
      el(null, b, "i").textContent = l.code.replace(/^MDF\s*/, "");
      b.addEventListener("click", function () { onPick(l.code); });
    });
    return g;
  }
  function renderRail() {
    var uw = $("#units"); uw.innerHTML = "";
    S.units.forEach(function (u, i) {
      var c = el("uchip" + (i === S.active ? " is-on" : ""), uw, "button");
      c.textContent = u.label || ("Unit " + (i + 1));
      c.addEventListener("click", function () {
        if (window.OrbixUI && typeof window.OrbixUI.sync3DStudioUnits === 'function') {
          window.OrbixUI.sync3DStudioUnits();
        }
        S.active = i;
        renderRail();
        renderAll();
        if (window.OrbixUI && typeof window.OrbixUI.render3DHome === 'function') {
          window.OrbixUI.render3DHome(true);
        }
        var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
        var rot = 0;
        if (u && u._furnId && plan && plan.furniture) {
          var f = plan.furniture.find(function (it) { return it.id === u._furnId; });
          if (f) rot = f.rotY || 0;
        }
        cam.yaw = -(rot * 180 / Math.PI) - 24;
        cam.pitch = -10;
        if (GL.ok) { GL.frame('unit'); camApply(); }
        if (u._furnId && window.OrbixUI && window.OrbixUI.highlight3DFurniture) {
          window.OrbixUI.highlight3DFurniture(u._furnId);
        }
      });
    });
    var add = el("uchip add", uw, "button");
    add.textContent = "+ Unit";
    add.title = "Add Cookscape Modular Unit to 3D";
    add.addEventListener("click", function () {
      if (window.OrbixUI && typeof window.OrbixUI.openPlaceUnitModal3D === 'function') {
        window.OrbixUI.openPlaceUnitModal3D();
      } else {
        var m = document.getElementById('modalFurnitureCatalog');
        if (m) m.classList.add('is-open');
      }
    });

    var addDecor = el("uchip decor", uw, "button");
    addDecor.textContent = "🌿 + Decor";
    addDecor.title = "Import Decor or Appliance (.skp, Fridge, Ice Box, Plant — Excluded from BOQ Pricing)";
    addDecor.style.borderColor = "#10b981";
    addDecor.style.color = "#047857";
    addDecor.style.background = "#f0fdf4";
    addDecor.addEventListener("click", function () {
      if (window.OrbixUI && typeof window.OrbixUI.openDecorModal === 'function') {
        window.OrbixUI.openDecorModal();
      }
    });

    var r = $("#railScroll"); r.innerHTML = "";
    var u = U();
    if (!u) {
      var gEmpty = grp(r, "3D Studio Units");
      var pEmpty = el(null, gEmpty, "p");
      pEmpty.style.cssText = "font-size:12px;color:var(--ink-2);line-height:1.5;margin-bottom:12px";
      pEmpty.textContent = "No cupboards in this project yet. Draw walls and place furniture in 2D Floor Plan, or click '+ Unit' above.";
      return;
    }
    var g1 = grp(r, "Unit");
    fld(el("row", g1), "Label", u.label, function (v) {
      u.label = v;
      var c = $all(".uchip")[S.active]; if (c) c.textContent = v || ("Unit " + (S.active + 1));
      softAll();
    }, "text");
    var rB = el("row", g1);
    fld(rB, "Height", u.H, function (v) { u.H = num(v, u.H); softAll(true); });
    fld(rB, "Width", u.W, function (v) { u.W = num(v, u.W); softAll(true); });
    var rC = el("row", g1);
    fld(rC, "Depth", u.D, function (v) { u.D = num(v, u.D); softAll(true); });
    fld(rC, "Board mm", u.T, function (v) { u.T = num(v, u.T); softAll(true); });

    if (u.kind === "imported") {
      var gI = grp(r, "Imported job");
      var pI = el(null, gI, "p"); pI.style.cssText = "font-size:12px;color:var(--ink-2);line-height:1.5";
      pI.innerHTML = u.rows.length + " rows from the sheet. Sizes below only place the 3D preview; the cutting list is the sheet\u2019s own rows.";
      var g5i = grp(r, "Carcass colour"); swatchGrid(g5i, u.carcass, function (c) { u.carcass = c; renderRail(); renderAll(); });
      var g6i = grp(r, "Shutter colour"); swatchGrid(g6i, u.shutterCol, function (c) { u.shutterCol = c; renderRail(); renderAll(); });
      var g9i = grp(r, "Edge banding");
      seg(g9i, [{ l: "Exposed edges", v: "exposed" }, { l: "All 4 edges", v: "all" }], RATES.ebMode, function (v) { RATES.ebMode = v; renderRail(); renderAll(); });
      var g8i = grp(r, "Unit actions");
      var nb = el("btn", g8i, "button"); nb.textContent = "Add a designed unit"; nb.style.marginRight = "6px";
      nb.addEventListener("click", function () { S.units.push(newUnit("UNIT " + (S.units.length + 1))); S.active = S.units.length - 1; renderRail(); renderAll(); });
      if (S.units.length > 1) {
        var rbi = el("btn danger", g8i, "button"); rbi.textContent = "Remove";
        rbi.addEventListener("click", function () { S.units.splice(S.active, 1); S.active = Math.max(0, S.active - 1); renderRail(); renderAll(); });
      }
      return;
    }
    if (u.ctype === "kitchen") u.ctype = (u.elev && u.elev >= 1000) ? "kwall" : "kbase";
    var gD = grp(r, "Door style");
    var dg = el("tgrid", gD);
    DSTYLES.forEach(function (s) {
      var b = el("tbtn" + ((u.dstyle || "slab") === s.id ? " is-on" : ""), dg, "button");
      b.textContent = s.label; b.setAttribute("aria-pressed", String((u.dstyle || "slab") === s.id));
      b.addEventListener("click", function () { u.dstyle = s.id; renderRail(); renderAll(); });
    });
    if ((u.dstyle || "") === "steel") {
      var pr = el("swgrid", gD); pr.style.marginTop = "8px";
      PAINTS.forEach(function (p) {
        var b = el("swb" + ((u.paint || "#5B6E7A") === p.id ? " is-on" : ""), pr, "button");
        b.style.background = p.id; b.title = p.label; b.setAttribute("aria-label", p.label);
        el(null, b, "i").textContent = p.label;
        b.addEventListener("click", function () { u.paint = p.id; renderRail(); renderAll(); });
      });
    }
    if (u.ctype === "kitchen") {
      var gK = grp(r, "Kitchen layout");
      seg(gK, KLAYOUTS.map(function (k) { return { l: k.label, v: k.id }; }), u.klayout || "straight", function (v) { u.klayout = v; renderRail(); renderAll(); });
      var rL = el("row", gK); rL.style.marginTop = "8px";
      fld(rL, "Run A mm", u.kA || 3000, function (v) { u.kA = Math.max(1200, num(v, u.kA)); u.W = u.kA; softAll(true); });
      if ((u.klayout || "straight") !== "straight") fld(rL, (u.klayout === "island" ? "Island mm" : "Run B mm"), u.kB || 2400, function (v) { u.kB = Math.max(900, num(v, u.kB)); softAll(true); });
      if (u.klayout === "ushape" || u.klayout === "gshape") { var rC = el("row", gK); fld(rC, "Run C mm", u.kC || 2400, function (v) { u.kC = Math.max(900, num(v, u.kC)); softAll(true); }); }
      if (u.klayout === "lisland") { var rI = el("row", gK); fld(rI, "Island mm", u.kI || 1800, function (v) { u.kI = Math.max(900, num(v, u.kI)); softAll(true); }); }
      if (u.klayout === "peninsula" || u.klayout === "gshape") { var rP = el("row", gK); fld(rP, "Peninsula mm", u.kP || 1800, function (v) { u.kP = Math.max(900, num(v, u.kP)); softAll(true); }); }
      var gA = grp(r, "Fittings");
      function tog(label, key, offByDefault) {
        var s = el("row", gA); s.style.marginBottom = "6px";
        var l = el("fld", s); el(null, l, "label").textContent = label;
        var cur = offByDefault ? u[key] === true : u[key] !== false;
        seg(l, [{ l: "On", v: true }, { l: "Off", v: false }], cur, function (v) { u[key] = v; renderRail(); renderAll(); });
      }
      tog("Wall units", "kWall"); tog("Tall unit", "kTall"); tog("Hob + chimney", "kHob"); tog("Sink", "kSink"); tog("Fridge bay", "kFridge");
      tog("Oven tower (in tall)", "kOven", true); tog("Dishwasher", "kDish", true); tog("Open shelves", "kShelves", true); tog("Loft units to ceiling", "kLoft", true);
      if (/island|peninsula|gshape/.test(u.klayout || "")) tog("Breakfast bar + waterfall", "kBar", true);
      var gCt = grp(r, "Counter stone");
      seg(gCt, COUNTERS.map(function (c) { return { l: c.label, v: c.id }; }), u.counter || "black", function (v) { u.counter = v; renderAll(); });
      var gSp = grp(r, "Backsplash");
      seg(gSp, SPLASHES.map(function (s) { return { l: s.label, v: s.id }; }), u.kSplash || "subway", function (v) { u.kSplash = v; renderAll(); });
      if ((u.kSplash || "") === "glass") {
        var rG = el("row", gSp); rG.style.marginTop = "8px";
        seg(rG, [{ l: "Frost", v: "#E4E9EC" }, { l: "White", v: "#F2F4F5" }, { l: "Grey", v: "#B9BEC3" }, { l: "Black", v: "#2A2A2E" }, { l: "Sage", v: "#A9B8A5" }, { l: "Wine", v: "#6E2E3A" }], u.kSplashHex || "#E4E9EC", function (v) { u.kSplashHex = v; renderAll(); });
      }
      var gW = grp(r, "Wall unit colour");
      seg(gW, [{ l: "Same as base", v: "same" }, { l: "Two-tone", v: "diff" }], u.kWallCol ? "diff" : "same", function (v) { u.kWallCol = v === "diff" ? (u.kWallCol || "MDF 1135") : null; renderRail(); renderAll(); });
      if (u.kWallCol) { var rW = el("row", gW); rW.style.marginTop = "8px"; swatchGrid(rW, u.kWallCol, function (c) { u.kWallCol = c; renderRail(); renderAll(); }); }
      var rWd = el("row", gW); rWd.style.marginTop = "8px";
      seg(rWd, [{ l: "Wall doors: same", v: "same" }, { l: "Glass frame", v: "glass" }, { l: "Cane", v: "cane" }], u.kWallDs || "same", function (v) { u.kWallDs = v === "same" ? null : v; renderAll(); });
    }
    if (u.ctype === "tv") {
      var gTV = grp(r, "TV wall");
      seg(gTV, [{ l: "Drawers", v: "drawers" }, { l: "Doors", v: "doors" }, { l: "Open niches", v: "open" }, { l: "Mixed", v: "mixed" }], u.tvConsole || "drawers", function (v) { u.tvConsole = v; renderAll(); });
      var rF = el("row", gTV); rF.style.marginTop = "8px";
      seg(rF, [{ l: "Floating", v: true }, { l: "On plinth", v: false }], u.tvFloat !== false, function (v) { u.tvFloat = v; renderAll(); });
      var gB = grp(r, "Feature wall behind the TV");
      seg(gB, [{ l: "None", v: "none" }, { l: "Laminate panel", v: "panel" }, { l: "Fluted", v: "fluted" }, { l: "Grooved", v: "grooved" }, { l: "Stone slab", v: "stone" }], u.tvBack || "panel", function (v) { u.tvBack = v; renderRail(); renderAll(); });
      if ((u.tvBack || "panel") === "stone") { var rS = el("row", gB); rS.style.marginTop = "8px"; seg(rS, COUNTERS.map(function (c) { return { l: c.label, v: c.kind }; }), u.tvStone || "marble", function (v) { u.tvStone = v; renderAll(); }); }
      else if ((u.tvBack || "panel") !== "none") {
        var rC = el("row", gB); rC.style.marginTop = "8px";
        seg(rC, [{ l: "Same as shutters", v: "same" }, { l: "Different colour", v: "diff" }], u.tvBackCol ? "diff" : "same", function (v) { u.tvBackCol = v === "diff" ? (u.tvBackCol || "MDF 1135") : null; renderRail(); renderAll(); });
        if (u.tvBackCol) { var rC2 = el("row", gB); rC2.style.marginTop = "8px"; swatchGrid(rC2, u.tvBackCol, function (c) { u.tvBackCol = c; renderRail(); renderAll(); }); }
      }
      if ((u.tvBack || "panel") !== "none") { var rHt = el("row", gB); rHt.style.marginTop = "8px"; seg(rHt, [{ l: "Panel 2100", v: 2100 }, { l: "2400", v: 2400 }, { l: "2700", v: 2700 }], u.tvBackH || 2400, function (v) { u.tvBackH = v; renderAll(); }); }
      var gX = grp(r, "TV & extras");
      seg(gX, [{ l: "No TV", v: 0 }, { l: '43"', v: 43 }, { l: '50"', v: 50 }, { l: '55"', v: 55 }, { l: '65"', v: 65 }, { l: '75"', v: 75 }], u.tvShow === false ? 0 : (u.tvSize || 55), function (v) { if (v === 0) u.tvShow = false; else { u.tvShow = true; u.tvSize = v; } renderAll(); });
      var rSh = el("row", gX); rSh.style.marginTop = "8px";
      seg(rSh, [{ l: "No shelves", v: 0 }, { l: "1 shelf", v: 1 }, { l: "2 shelves", v: 2 }], u.tvShelves || 0, function (v) { u.tvShelves = v; renderAll(); });
      var rT = el("row", gX); rT.style.marginTop = "8px";
      seg(rT, [{ l: "No towers", v: "none" }, { l: "Left", v: "left" }, { l: "Right", v: "right" }, { l: "Both", v: "both" }], u.tvTowers || "none", function (v) { u.tvTowers = v; renderAll(); });
      var rW = el("row", gX); rW.style.marginTop = "8px";
      seg(rW, [{ l: "Wall cabinets off", v: false }, { l: "Wall cabinets on", v: true }], u.tvWall === true, function (v) { u.tvWall = v; renderAll(); });
      var rL = el("row", gX); rL.style.marginTop = "8px";
      seg(rL, [{ l: "LED light on", v: true }, { l: "LED off", v: false }], u.tvLed !== false, function (v) { u.tvLed = v; renderAll(); });
    }
    if (u.ctype === "crockery") {
      var gC = grp(r, "Crockery unit");
      seg(gC, [{ l: "Base + hutch", v: "hutch" }, { l: "Floating buffet", v: "floating" }, { l: "Tall display", v: "tall" }, { l: "Sideboard only", v: "sideboard" }], u.crConfig || "hutch", function (v) { u.crConfig = v; renderRail(); renderAll(); });
      var rB = el("row", gC); rB.style.marginTop = "8px";
      seg(rB, [{ l: "Base: doors", v: "doors" }, { l: "Base: drawers", v: "drawers" }], u.crBase || "doors", function (v) { u.crBase = v; renderAll(); });
      if ((u.crConfig || "hutch") !== "sideboard") {
        var gU = grp(r, "Display hutch");
        seg(gU, [{ l: "Profile glass", v: "aluglass" }, { l: "Laminate glass frame", v: "glass" }, { l: "Open shelves", v: "open" }], u.crUpper || "aluglass", function (v) { u.crUpper = v; renderRail(); renderAll(); });
        if ((u.crUpper || "aluglass") === "aluglass") {
          var rG = el("row", gU); rG.style.marginTop = "8px";
          seg(rG, [{ l: "Clear", v: "clear" }, { l: "Fluted", v: "fluted" }, { l: "Frosted", v: "frost" }, { l: "Smoked", v: "smoke" }, { l: "Bronze", v: "bronze" }], u.glassTint || "fluted", function (v) { u.glassTint = v; renderAll(); });
          var rP = el("row", gU); rP.style.marginTop = "8px";
          seg(rP, [{ l: "Black profile", v: "black" }, { l: "Nickel", v: "nickel" }, { l: "Champagne", v: "brass" }], u.frameFin || "black", function (v) { u.frameFin = v; renderAll(); });
        }
        var rUc = el("row", gU); rUc.style.marginTop = "8px";
        seg(rUc, [{ l: "Hutch colour: same", v: "same" }, { l: "Different", v: "diff" }], u.crUpperCol ? "diff" : "same", function (v) { u.crUpperCol = v === "diff" ? (u.crUpperCol || "MDF 1135") : null; renderRail(); renderAll(); });
        if (u.crUpperCol) { var rUs = el("row", gU); rUs.style.marginTop = "8px"; swatchGrid(rUs, u.crUpperCol, function (c) { u.crUpperCol = c; renderRail(); renderAll(); }); }
        var rSh = el("row", gU); rSh.style.marginTop = "8px";
        seg(rSh, [{ l: "1 glass shelf", v: 1 }, { l: "2", v: 2 }, { l: "3", v: 3 }, { l: "4", v: 4 }], u.crShelves == null ? 2 : u.crShelves, function (v) { u.crShelves = v; renderAll(); });
        if ((u.crConfig || "hutch") !== "tall") { var rBk = el("row", gU); rBk.style.marginTop = "8px"; seg(rBk, [{ l: "Niche: mirror", v: "mirror" }, { l: "Laminate back", v: "panel" }, { l: "Open", v: "none" }], u.crBack || "mirror", function (v) { u.crBack = v; renderAll(); }); }
      }
      var gTp = grp(r, "Serving top & light");
      seg(gTp, [{ l: "Stone top", v: "stone" }, { l: "Laminate top", v: "laminate" }], u.crTop || "stone", function (v) { u.crTop = v; renderRail(); renderAll(); });
      if ((u.crTop || "stone") === "stone") { var rSt = el("row", gTp); rSt.style.marginTop = "8px"; seg(rSt, COUNTERS.map(function (c) { return { l: c.label, v: c.id }; }), u.counter || "black", function (v) { u.counter = v; renderAll(); }); }
      var rLd = el("row", gTp); rLd.style.marginTop = "8px";
      seg(rLd, [{ l: "LED on", v: true }, { l: "LED off", v: false }], u.crLed !== false, function (v) { u.crLed = v; renderAll(); });
    }
    if (u.ctype === "dresser") {
      var gD = grp(r, "Dressing unit");
      seg(gD, [{ l: "Floor · plinth", v: "floor" }, { l: "Floating", v: "floating" }], u.drConfig || "floor", function (v) { u.drConfig = v; renderAll(); });
      var rDb = el("row", gD); rDb.style.marginTop = "8px";
      seg(rDb, [{ l: "Drawers", v: "drawers" }, { l: "Doors", v: "doors" }], u.drBase || "drawers", function (v) { u.drBase = v; renderAll(); });
      var rDt = el("row", gD); rDt.style.marginTop = "8px";
      seg(rDt, [{ l: "Laminate top", v: "laminate" }, { l: "Stone top", v: "stone" }], u.drTop || "laminate", function (v) { u.drTop = v; renderRail(); renderAll(); });
      if ((u.drTop || "laminate") === "stone") { var rDs = el("row", gD); rDs.style.marginTop = "8px"; seg(rDs, COUNTERS.map(function (c) { return { l: c.label, v: c.id }; }), u.counter || "black", function (v) { u.counter = v; renderAll(); }); }
      var gM = grp(r, "Mirror");
      seg(gM, [{ l: "Arched", v: "arch" }, { l: "Round", v: "round" }, { l: "Rectangle", v: "rect" }, { l: "Full length", v: "full" }, { l: "None", v: "none" }], u.drMirror || "arch", function (v) { u.drMirror = v; renderRail(); renderAll(); });
      if ((u.drMirror || "arch") !== "none" && (u.drMirror || "arch") !== "full") { var rMw = el("row", gM); rMw.style.marginTop = "8px"; seg(rMw, [{ l: "500 wide", v: 500 }, { l: "600", v: 600 }, { l: "750", v: 750 }, { l: "900", v: 900 }], u.drMirrorW || 600, function (v) { u.drMirrorW = v; renderAll(); }); }
      var rMl = el("row", gM); rMl.style.marginTop = "8px";
      seg(rMl, [{ l: "LED backlight", v: true }, { l: "No light", v: false }], u.drLed !== false, function (v) { u.drLed = v; renderAll(); });
      var gE = grp(r, "Panel, shelves & tower");
      seg(gE, [{ l: "No panel", v: "none" }, { l: "Laminate panel", v: "panel" }, { l: "Fluted panel", v: "fluted" }], u.drBack || "none", function (v) { u.drBack = v; renderRail(); renderAll(); });
      if ((u.drBack || "none") !== "none") {
        var rBc = el("row", gE); rBc.style.marginTop = "8px";
        seg(rBc, [{ l: "Panel: same colour", v: "same" }, { l: "Different", v: "diff" }], u.drBackCol ? "diff" : "same", function (v) { u.drBackCol = v === "diff" ? (u.drBackCol || "MDF 1135") : null; renderRail(); renderAll(); });
        if (u.drBackCol) { var rBs = el("row", gE); rBs.style.marginTop = "8px"; swatchGrid(rBs, u.drBackCol, function (c) { u.drBackCol = c; renderRail(); renderAll(); }); }
      }
      var rSv = el("row", gE); rSv.style.marginTop = "8px";
      seg(rSv, [{ l: "No shelves", v: 0 }, { l: "1 pair", v: 1 }, { l: "2 pairs", v: 2 }], u.drShelves || 0, function (v) { u.drShelves = v; renderAll(); });
      var rTw = el("row", gE); rTw.style.marginTop = "8px";
      seg(rTw, [{ l: "No tower", v: "none" }, { l: "Left", v: "left" }, { l: "Right", v: "right" }, { l: "Both", v: "both" }], u.drTower || "none", function (v) { u.drTower = v; renderAll(); });
    }
    if (!/^(kitchen|tv|crockery|dresser)$/.test(u.ctype || "")) {
      var gS = grp(r, "Shape");
      seg(gS, [{ l: "Straight", v: "straight" }, { l: "L-corner", v: "lcorner" }, { l: "Walk-in", v: "walkin" }], u.shape || "straight",
        function (v) { u.shape = v; renderRail(); renderAll(); });
      if (u.shape === "lcorner") {
        var rS = el("row", gS); rS.style.marginTop = "8px";
        fld(rS, "Run B width", u.W2 || 1200, function (v) { u.W2 = Math.max(400, num(v, u.W2)); softAll(true); });
      }

      var g2 = grp(r, "Shutters");
      seg(g2, [{ l: "Hinged", v: "hinged" }, { l: "Sliding", v: "sliding" }], u.type, function (v) { u.type = v; renderRail(); renderAll(); });
      var rD = el("row", g2); rD.style.marginTop = "8px";
      if (u.type === "hinged") fld(rD, "Shutters", u.shutters, function (v) { u.shutters = Math.max(1, num(v, u.shutters) | 0); softAll(true); });
      fld(rD, "Sections", u.sections, function (v) { u.sections = Math.max(1, num(v, u.sections) | 0); softAll(true); });

    }
    var g2c = grp(r, "Handle design");
    var hg = el("hgrid", g2c);
    HANDLES.forEach(function (hd) {
      var b = el("hbtn" + (hd.id === u.handle ? " is-on" : ""), hg, "button");
      b.setAttribute("aria-pressed", String(hd.id === u.handle));
      var ic = el("hico", b);
      el("hi hi-" + hd.kind, ic);
      el("hlb", b).textContent = hd.label;
      b.addEventListener("click", function () { u.handle = hd.id; renderRail(); renderAll(); });
    });

    var gF = grp(r, "Handle finish");
    seg(gF, HFINISH.map(function (f) { return { l: f.label, v: f.id }; }), u.hfinish || "chrome", function (v) { u.hfinish = v; renderRail(); renderAll(); });

    if (u.ctype !== "kitchen") {
      var g3 = grp(r, "Internals");
      var rE = el("row", g3);
      fld(rE, "Shelves / sec", u.shelves, function (v) { u.shelves = Math.max(0, num(v, u.shelves) | 0); softAll(true); });
      fld(rE, "Drawers", u.drawers, function (v) { u.drawers = Math.max(0, num(v, u.drawers) | 0); softAll(true); });
      var rF = el("row", g3);
      fld(rF, "Facia ht", u.drawerH, function (v) { u.drawerH = Math.max(60, num(v, u.drawerH)); softAll(true); });
      var bf = el("fld", rF);
      el(null, bf, "label").textContent = "Back panel";
      var bs = el(null, bf, "select");
      [18, 6].forEach(function (t) { var o = el(null, bs, "option"); o.value = t; o.textContent = t + " mm"; if (u.back === t) o.selected = true; });
      bs.addEventListener("change", function () { u.back = parseInt(bs.value, 10); softAll(true); });

      var g4 = grp(r, "Loft");
      seg(g4, [{ l: "With loft", v: true }, { l: "No loft", v: false }], u.loft, function (v) { u.loft = v; renderRail(); renderAll(); });
      if (u.loft) {
        var rG = el("row", g4); rG.style.marginTop = "8px";
        fld(rG, "Loft ht", u.loftH, function (v) { u.loftH = Math.max(150, num(v, u.loftH)); softAll(true); });
        fld(rG, "Loft shutters", u.loftShutters, function (v) { u.loftShutters = Math.max(1, num(v, u.loftShutters) | 0); softAll(true); });
      }

      var isBaseU = (u.ctype === "kbase" || (u.counter && u.counter !== "none") || (u.label && /base/i.test(u.label)) || (u.name && /base/i.test(u.name)) || (u.H <= 900 && (!u.elev || u.elev < 1000) && u.ctype !== "kwall"));
      if (isBaseU) {
        var gCt = grp(r, "Countertop");
        var cOpts = [
          { l: "None", v: "none" },
          { l: "Granite black", v: "black" },
          { l: "Black galaxy", v: "galaxy" },
          { l: "Marble white", v: "white" },
          { l: "Quartz white", v: "quartz" },
          { l: "Quartz grey", v: "greyq" },
          { l: "Marble beige", v: "beige" },
          { l: "Granite green", v: "green" }
        ];
        var curCt = u.counter || "black";
        if (!cOpts.some(function (o) { return o.v === curCt; })) curCt = "black";
        seg(gCt, cOpts, curCt, function (v) {
          u.counter = v;
          if (u._furnId && window.OrbixUI) {
            var plan = (typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI.project && window.OrbixUI.project.plan);
            if (plan && plan.furniture) {
              var match = plan.furniture.find(function (f) { return f.id === u._furnId; });
              if (match) {
                match.unitConfig = match.unitConfig || {};
                match.unitConfig.counter = v;
              }
            }
          }
          renderRail();
          renderAll();
        });
      }

    }
    var g5 = grp(r, "Carcass colour");
    swatchGrid(g5, u.carcass, function (c) { u.carcass = c; renderRail(); renderAll(); });
    var g6 = grp(r, "Shutter colour");
    swatchGrid(g6, u.shutterCol, function (c) { u.shutterCol = c; renderRail(); renderAll(); });
    if (u.ctype !== "kitchen") {
      var r2 = el("row", g6); r2.style.marginTop = "8px";
      seg(r2, [{ l: "One colour", v: "one" }, { l: "Alternate doors", v: "alt" }], u.shutterCol2 ? "alt" : "one", function (v) { u.shutterCol2 = v === "alt" ? (u.shutterCol2 || "MDF 2204") : null; renderRail(); renderAll(); });
      if (u.shutterCol2) { var r3 = el("row", g6); r3.style.marginTop = "8px"; swatchGrid(r3, u.shutterCol2, function (c) { u.shutterCol2 = c; renderRail(); renderAll(); }); }
      if (lam(u.shutterCol).kind === "wood") {
        var r4 = el("row", g6); r4.style.marginTop = "8px";
        seg(r4, [{ l: "Grain: vertical", v: false }, { l: "Grain: horizontal", v: true }], !!u.hgrain, function (v) { u.hgrain = v; renderAll(); });
      }
      if ((u.dstyle || "") === "aluglass") {
        var gG = grp(r, "Glass & profile");
        seg(gG, [{ l: "Fluted", v: "fluted" }, { l: "Frosted", v: "frost" }, { l: "Smoked", v: "smoke" }, { l: "Bronze", v: "bronze" }, { l: "Clear", v: "clear" }], u.glassTint || "fluted", function (v) { u.glassTint = v; renderAll(); });
        var rP = el("row", gG); rP.style.marginTop = "8px";
        seg(rP, [{ l: "Black profile", v: "black" }, { l: "Nickel", v: "nickel" }, { l: "Champagne", v: "brass" }], u.frameFin || "black", function (v) { u.frameFin = v; renderAll(); });
      }
      if ((u.dstyle || "") === "leather") {
        var gL = grp(r, "Leather panel");
        seg(gL, [{ l: "Espresso", v: "#4A3626" }, { l: "Camel", v: "#B07A4A" }, { l: "Tan", v: "#C9A57C" }, { l: "Black", v: "#1E1C1A" }, { l: "Cream", v: "#E8DCC8" }, { l: "Olive", v: "#5C5A3E" }], u.leatherHex || "#4A3626", function (v) { u.leatherHex = v; renderAll(); });
      }
    }

    var g9 = grp(r, "Edge banding");
    seg(g9, [{ l: "Exposed edges", v: "exposed" }, { l: "All 4 edges", v: "all" }], RATES.ebMode, function (v) { RATES.ebMode = v; renderRail(); renderAll(); });
    var rH = el("row", g9); rH.style.marginTop = "8px";
    fld(rH, "Tape size", RATES.ebSize, function (v) { RATES.ebSize = v; softAll(); }, "text");

    var g7 = grp(r, "Add a laminate");
    var ac = el("addc", g7);
    var f1 = el("fld", ac); el(null, f1, "label").textContent = "Code";
    var i1 = el(null, f1, "input"); i1.placeholder = "MDF 0000";
    var f2 = el("fld", ac); el(null, f2, "label").textContent = "Name";
    var i2 = el(null, f2, "input"); i2.placeholder = "Name";
    var i3 = el(null, ac, "input"); i3.type = "color"; i3.value = "#8A6A46";
    var ac2 = el("addc", g7); ac2.style.borderTop = "0"; ac2.style.paddingTop = "0";
    var f4 = el("fld", ac2); el(null, f4, "label").textContent = "Finish";
    var s4 = el(null, f4, "select");
    [["wood", "Woodgrain"], ["solid", "Solid / matte"], ["gloss", "High gloss"]].forEach(function (p) {
      var o = el(null, s4, "option"); o.value = p[0]; o.textContent = p[1];
    });
    var ab = el("btn", ac2, "button"); ab.textContent = "Add";
    ab.addEventListener("click", function () {
      var code = (i1.value || "").trim();
      if (!code) { toast("Enter a laminate code"); return; }
      LAMINATES.push({ code: code, name: (i2.value || "").trim() || code, hex: i3.value, kind: s4.value });
      window.LAMINATES = LAMINATES;
      i1.value = ""; i2.value = "";
      renderRail(); renderAll(); toast("Added " + code);
    });

    var g8 = grp(r, "Unit actions");
    var rotB = el("btn", g8, "button"); rotB.textContent = "↻ Rotate 90° (R)"; rotB.style.marginRight = "6px";
    rotB.title = "Rotate unit 90 degrees in floor plan & 3D (shortcut: R)";
    rotB.addEventListener("click", function () {
      var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
      if (u._furnId && plan) {
        var f = plan.furniture && plan.furniture.find(function (it) { return it.id === u._furnId; });
        if (f) {
          f.rotY = ((f.rotY || 0) + Math.PI / 2) % (Math.PI * 2);
          if (window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
          if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
          if (window.OrbixUI && window.OrbixUI.editor) window.OrbixUI.editor.render();
          if (window.OrbixUI && window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
          toast("Rotated to " + Math.round(f.rotY * 180 / Math.PI) + "°");
          return;
        }
      }
      toast("Unit rotated");
    });

    var db = el("btn", g8, "button"); db.textContent = "Duplicate"; db.style.marginRight = "6px";
    db.addEventListener("click", function () {
      var c = JSON.parse(JSON.stringify(u)); c.label = (u.label || "UNIT") + " (Copy)";
      var newId = 'f_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 4);
      c._furnId = newId;
      var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
      if (plan) {
        plan.furniture = plan.furniture || [];
        var isW = (window.OrbixCore && window.OrbixCore.isWallUnit) ?
          window.OrbixCore.isWallUnit(c.ctype, c.label, c.code, c.costCategory) :
          (c.ctype === 'kwall' || (c.label && c.label.toLowerCase().indexOf('wall') !== -1) || /(^|\b|_|-)(wm|wcm)($|\b|_|-|\d+)/i.test(c.label));
        var uElev = orig ? ((orig.elevation !== undefined && orig.elevation !== null) ? orig.elevation : (orig.pos ? orig.pos.z : 0)) : (c.elev !== undefined ? c.elev : (isW ? 1500 : 0));
        c.elev = uElev;
        var nPos = orig ? { x: orig.pos.x + (c.W || 600) + 100, y: orig.pos.y, z: uElev } : { x: 2000, y: 2000, z: uElev };
        if (window.OrbixCore && window.OrbixCore.createFurniturePlacement) {
          plan.furniture.push(window.OrbixCore.createFurniturePlacement({
            id: newId,
            name: c.label,
            category: c.ctype || 'wardrobe',
            elevation: uElev,
            pos: nPos,
            rotY: orig ? orig.rotY : 0,
            dimensions: { W: c.W || 1200, H: c.H || 2100, D: c.D || 600 },
            unitConfig: { shutters: c.shutters || 2, handle: c.handle || 'bar', drawers: c.drawers || 0 }
          }));
        } else {
          plan.furniture.push({
            id: newId,
            name: c.label,
            category: c.ctype || 'wardrobe',
            elevation: uElev,
            pos: nPos,
            rotY: orig ? orig.rotY : 0,
            dimensions: { W: c.W || 1200, H: c.H || 2100, D: c.D || 600 },
            unitConfig: { shutters: c.shutters || 2, handle: c.handle || 'bar', drawers: c.drawers || 0 }
          });
        }
        if (window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
        if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
        if (window.OrbixUI && window.OrbixUI.editor) window.OrbixUI.editor.render();
        if (window.OrbixUI && window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
      }
      S.units.push(c); S.active = S.units.length - 1; renderRail(); renderAll();
    });
    if (S.units.length >= 1) {
      var rb = el("btn danger", g8, "button"); rb.textContent = "🗑 Remove Unit";
      rb.title = "Remove this unit from 3D Studio & 2D Floor Plan";
      rb.addEventListener("click", function () {
        var remU = S.units[S.active];
        var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
        if (remU && remU._furnId && plan && plan.furniture) {
          plan.furniture = plan.furniture.filter(function (it) { return it.id !== remU._furnId; });
          if (window.OrbixUI && window.OrbixUI.saveToLocalStorage) window.OrbixUI.saveToLocalStorage();
          if (window.OrbixProjects && window.OrbixProjects.saveActiveProject) window.OrbixProjects.saveActiveProject();
          if (window.OrbixUI && window.OrbixUI.editor) window.OrbixUI.editor.render();
        }
        S.units.splice(S.active, 1); S.active = Math.max(0, S.active - 1);
        if (window.OrbixUI && window.OrbixUI.render3DHome) window.OrbixUI.render3DHome(true);
        renderRail(); renderAll();
        toast("Unit removed");
      });
    }
  }
  var softT = null;
  function softAll(geometry) {
    clearTimeout(softT);
    softT = setTimeout(function () {
      nestBust();
      if (window.OrbixUI && typeof window.OrbixUI.sync3DStudioUnits === 'function') {
        window.OrbixUI.sync3DStudioUnits();
      }
      if (geometry) { fit(); buildScene(); }
      renderLegend(); renderFoot(); renderSheet(); renderElev();
      refreshHeavy(false);
      save();
    }, geometry ? 70 : 0);
  }
  function renderAll() {
    nestBust();
    if (window.OrbixUI && typeof window.OrbixUI.sync3DStudioUnits === 'function') {
      window.OrbixUI.sync3DStudioUnits();
    }
    fit(); buildScene(); renderLegend(); renderFoot(); renderSheet(); renderElev();
    refreshHeavy(true);
    save();
  }
  /* Panels / nesting / quote are only computed for the view you are
     actually looking at — nesting is the expensive one. */
  function refreshHeavy(invalidate) {
    if (invalidate) nestBust();
    var v = ($(".view.is-on") || {}).id;
    if (v === "view-panels") renderPanels();
    else if (v === "view-nest") renderNest();
    else if (v === "view-quote") renderQuote();
    else if (v === "view-report") renderReport();
  }

  /* ══════════ LEGEND + FOOT ══════════ */
  function renderLegend() {
    var w = $("#legend"); if (!w) return;
    w.innerHTML = "";
    var u = U();
    if (!u) return;
    [["Carcass", u.carcass], ["Shutter", u.shutterCol]].forEach(function (p) {
      var l = lam(p[1]), b = el("lg", w);
      el("lg-sw", b).style.backgroundImage = "url(" + tex(l, 144) + ")";
      var t = el("lg-t", b);
      el("lg-role", t).textContent = p[0];
      el("lg-code", t).textContent = l.code + " · " + l.name;
    });
    var d = el("lg", w), t2 = el("lg-t", d);
    el("lg-role", t2).textContent = "Size · Handle";
    el("lg-code", t2).textContent = "H" + u.H + " × W" + u.W + (u.shape === "lcorner" ? " + " + (u.W2 || 1200) : "") + " × D" + u.D +
      "  ·  " + (u.shape === "walkin" ? "walk-in" : H(u.handle).label);
  }
  function renderFoot() {
    var t = allTotals(), sheets = 0;
    for (var c in t.byCol) sheets += Math.ceil(t.byCol[c] / 32);   /* naive floor */
    $("#rfPanels").textContent = t.qty;
    $("#rfSft").textContent = f2(t.sft) + " sft";
    $("#rfSheets").textContent = sheets;
    var e = $("#rfEb"); if (e) e.textContent = Math.round(t.ebRft) + " ft";
  }

  /* ══════════ PROCESS SHEET ══════════ */
  function renderSheet() {
    var h = '<thead><tr>' +
      '<th>S.No</th><th>Height</th><th>Width</th><th>Qty</th><th>Remarks</th>' +
      '<th>Design</th><th>Colour</th><th>SFT</th><th>E/B</th><th>E/B Ft</th>' +
      '<th>Rate</th><th>Amount</th></tr></thead><tbody>';
    var n = 0, gSft = 0, gEb = 0;
    S.units.forEach(function (u) {
      h += '<tr class="groupline"><td></td><td class="grp" colspan="11">' + esc(u.label || "UNIT") + '</td></tr>';
      h += '<tr><td></td><td class="dimlabel" colspan="11">H' + u.H + ' X W' + u.W + ' X D' + u.D + '</td></tr>';
      panelsFor(u).forEach(function (r) {
        n++;
        var a = sft(r.h, r.w, r.q), e = ebRule(r.r), ef = ebFt(r);
        gSft += a; gEb += ef;
        h += '<tr><td class="n">' + n + '</td><td class="n">' + r.h + '</td><td class="n">' + r.w + '</td>' +
          '<td class="n">' + r.q + '</td><td>' + esc(r.r) + '</td><td class="c">' + esc(r.d) + '</td>' +
          '<td class="c">' + esc(r.col) + '</td><td class="n">' + f2(a) + '</td>' +
          '<td class="c">' + e.code + '</td><td class="n">' + f2(ef) + '</td>' +
          '<td class="n">0.00</td><td class="n">0.00</td></tr>';
      });
    });
    h += '<tr class="total"><td colspan="7">Total</td><td class="n">' + f2(gSft) + '</td>' +
      '<td></td><td class="n">' + f2(gEb) + '</td><td></td><td class="n">0.00</td></tr></tbody>';
    $("#psTable").innerHTML = h;

    /* frames */
    var F = S.frames, fa = sft(F.h, F.w, F.q), famt = F.q * F.rate;   /* per piece */
    $("#frTable").innerHTML =
      '<tbody><tr><td class="n">' + (n + 1) + '</td><td class="n">' + F.h + '</td><td class="n">' + F.w + '</td>' +
      '<td class="n"><input id="fr_q" value="' + F.q + '"></td><td>Frames</td><td class="c"></td>' +
      '<td class="c">' + esc(F.col) + '</td><td class="n">' + f2(fa) + '</td><td class="c">—</td><td class="n">0.00</td>' +
      '<td class="n"><input id="fr_r" value="' + f2(F.rate) + '"></td><td class="n">' + f2(famt) + '</td></tr></tbody>';
    bindNum("#fr_q", function (v) { S.frames.q = Math.max(0, v | 0); renderSheet(); save(); });
    bindNum("#fr_r", function (v) { S.frames.rate = v; renderSheet(); save(); });

    /* charges */
    var t = allTotals();
    var cutFt = Math.round(t.cutRft), ebF = Math.round(t.ebRft);
    var rows = '', tot = famt;
    rows += chRow("Cutting", cutFt, "ft", "rate_cut", RATES.cut); tot += cutFt * RATES.cut;
    rows += chRow(RATES.ebSize + " E/b", ebF, "ft", "rate_eb", RATES.eb); tot += ebF * RATES.eb;
    var hIds = [];
    for (var k in t.handles) {
      var hh = t.handles[k], q = hh.h.unit === "rft" ? Math.round(hh.q) : hh.q;
      rows += chRow(hh.h.label, q, hh.h.unit === "rft" ? "ft" : "nos", "hrate_" + k, hh.h.rate);
      tot += q * hh.h.rate; hIds.push(k);
    }
    $("#chTable").innerHTML = '<tbody><tr><td class="head" colspan="12">JOB WORK CHARGES</td></tr>' + rows +
      '<tr class="total"><td colspan="10">Total</td><td></td><td class="n">' + f2(tot) + '</td></tr></tbody>';
    bindNum("#rate_cut", function (v) { RATES.cut = v; renderSheet(); save(); });
    bindNum("#rate_eb", function (v) { RATES.eb = v; renderSheet(); save(); });
    hIds.forEach(function (k) {
      bindNum("#hrate_" + k, function (v) { H(k).rate = v; renderSheet(); save(); });
    });
    $("#f_ebLabel").textContent = RATES.ebSize;

    /* board requirement — no wastage */
    var bd = '<tbody><tr><td class="head" colspan="12">JOB WORK Details — board requirement</td></tr>';
    var order = [];
    for (var c in t.byCol) order.push([c, t.byCol[c]]);
    order.sort(function (a, b) { return b[1] - a[1]; });
    var totSheets = 0, totReq = 0;
    order.forEach(function (p) {
      var sheets = Math.ceil(p[1] / 32);
      totSheets += sheets; totReq += p[1];
      bd += '<tr><td class="n">2440</td><td class="n">1220</td><td class="n">' + sheets + '</td>' +
        '<td>Colour Board</td><td class="c">' + esc(S.head.supply ? "Provided Party" : "") + '</td>' +
        '<td class="c">' + esc(p[0]) + '</td><td class="n">' + f2(p[1]) + '</td>' +
        '<td class="c">req</td><td class="n">' + f2(sheets * 32) + '</td>' +
        '<td class="n">0.00</td><td class="n">0.00</td></tr>';
    });
    bd += '<tr class="total"><td colspan="2">Sheets 8×4</td><td class="n">' + totSheets + '</td>' +
      '<td colspan="3">Area required / supplied</td><td class="n">' + f2(totReq) + '</td><td></td>' +
      '<td class="n">' + f2(totSheets * 32) + '</td><td></td><td class="n">0.00</td></tr></tbody>';
    $("#bdTable").innerHTML = bd;
  }
  function chRow(label, qty, unit, id, rate) {
    return '<tr><td colspan="3">' + esc(label) + '</td><td class="n">' + qty + '</td>' +
      '<td class="c">' + unit + '</td><td colspan="5"></td>' +
      '<td class="n"><input id="' + id + '" value="' + f2(rate) + '"></td>' +
      '<td class="n">' + f2(qty * rate) + '</td></tr>';
  }
  function bindNum(sel, cb) {
    var i = $(sel); if (!i) return;
    i.addEventListener("change", function () { cb(num(i.value, 0)); });
  }

  /* ══════════ ELEVATION + DXF ══════════ */
  var LS = { OUT: { c: "#1B1A17", w: 2.6 }, THIN: { c: "#4A4740", w: 1.2 }, DIM: { c: "#1B4F72", w: 1 }, HID: { c: "#8A867E", w: 1, dash: "22 14" } };
  function Draw() { this.L = []; this.T = []; this.C = []; this.minX = 1e9; this.minY = 1e9; this.maxX = -1e9; this.maxY = -1e9; }
  Draw.prototype.ext = function (x, y) { if (x < this.minX) this.minX = x; if (x > this.maxX) this.maxX = x; if (y < this.minY) this.minY = y; if (y > this.maxY) this.maxY = y; };
  Draw.prototype.line = function (a, b, c, d, ly) { this.L.push({ x1: a, y1: b, x2: c, y2: d, ly: ly || "THIN" }); this.ext(a, b); this.ext(c, d); };
  Draw.prototype.rect = function (x, y, w, h, ly) { this.line(x, y, x + w, y, ly); this.line(x + w, y, x + w, y + h, ly); this.line(x + w, y + h, x, y + h, ly); this.line(x, y + h, x, y, ly); };
  Draw.prototype.circle = function (x, y, r, ly) { this.C.push({ cx: x, cy: y, r: r, ly: ly || "THIN" }); this.ext(x - r, y - r); this.ext(x + r, y + r); };
  Draw.prototype.text = function (x, y, s, sz, ly, an) { this.T.push({ x: x, y: y, s: String(s), size: sz || 58, ly: ly || "DIM", anchor: an || "middle" }); this.ext(x - 150, y - 30); this.ext(x + 150, y + 70); };
  Draw.prototype.dimH = function (x1, x2, ye, yd, lb) {
    this.line(x1, ye, x1, yd, "DIM"); this.line(x2, ye, x2, yd, "DIM"); this.line(x1, yd, x2, yd, "DIM");
    this.line(x1 - 20, yd - 20, x1 + 20, yd + 20, "DIM"); this.line(x2 - 20, yd - 20, x2 + 20, yd + 20, "DIM");
    this.text((x1 + x2) / 2, yd + 30, lb, 56, "DIM");
  };
  Draw.prototype.dimV = function (y1, y2, xe, xd, lb) {
    this.line(xe, y1, xd, y1, "DIM"); this.line(xe, y2, xd, y2, "DIM"); this.line(xd, y1, xd, y2, "DIM");
    this.line(xd - 20, y1 - 20, xd + 20, y1 + 20, "DIM"); this.line(xd - 20, y2 - 20, xd + 20, y2 + 20, "DIM");
    this.text(xd + 38, (y1 + y2) / 2 - 18, lb, 56, "DIM", "start");
  };
  function drawSVG(d) {
    var pad = 150, W = d.maxX - d.minX + 2 * pad, Ht = d.maxY - d.minY + 2 * pad;
    function fx(x) { return Math.round(x - d.minX + pad); }
    function fy(y) { return Math.round(d.maxY - y + pad); }
    var o = ['<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + Math.round(W) + ' ' + Math.round(Ht) + '" font-family="IBM Plex Mono, monospace">'];
    o.push('<rect width="' + Math.round(W) + '" height="' + Math.round(Ht) + '" fill="#FCFBF7"/>');
    d.L.forEach(function (l) {
      var s = LS[l.ly] || LS.THIN;
      o.push('<line x1="' + fx(l.x1) + '" y1="' + fy(l.y1) + '" x2="' + fx(l.x2) + '" y2="' + fy(l.y2) + '" stroke="' + s.c + '" stroke-width="' + s.w + '"' + (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + ' vector-effect="non-scaling-stroke"/>');
    });
    d.C.forEach(function (c) {
      var s = LS[c.ly] || LS.THIN;
      o.push('<circle cx="' + fx(c.cx) + '" cy="' + fy(c.cy) + '" r="' + Math.round(c.r) + '" fill="none" stroke="' + s.c + '" stroke-width="' + s.w + '" vector-effect="non-scaling-stroke"/>');
    });
    d.T.forEach(function (t) {
      var s = LS[t.ly] || LS.DIM;
      o.push('<text x="' + fx(t.x) + '" y="' + fy(t.y) + '" font-size="' + t.size + '" fill="' + s.c + '" text-anchor="' + t.anchor + '">' + esc(t.s) + '</text>');
    });
    o.push('</svg>');
    return o.join("");
  }
  function drawDXF(d) {
    var o = ["0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC", "0", "SECTION", "2", "ENTITIES"];
    d.L.forEach(function (l) { o.push("0", "LINE", "8", l.ly, "10", l.x1.toFixed(1), "20", l.y1.toFixed(1), "11", l.x2.toFixed(1), "21", l.y2.toFixed(1)); });
    d.C.forEach(function (c) { o.push("0", "CIRCLE", "8", c.ly, "10", c.cx.toFixed(1), "20", c.cy.toFixed(1), "40", c.r.toFixed(1)); });
    d.T.forEach(function (t) {
      var s = t.s.replace(/[·—–]/g, "-").replace(/×/g, "x").replace(/[^\x20-\x7E]/g, "");
      var x = t.anchor === "middle" ? t.x - s.length * t.size * 0.31 : t.x;
      o.push("0", "TEXT", "8", t.ly, "10", x.toFixed(1), "20", t.y.toFixed(1), "40", String(t.size), "1", s);
    });
    o.push("0", "ENDSEC", "0", "EOF");
    return o.join("\r\n");
  }
  function elevHandle(d, u, cx, cellW, yTop, yBot) {
    var hd = H(u.handle), mid = (yTop + yBot) / 2;
    if (hd.kind === "none") return;
    if (hd.kind === "ibh" || hd.kind === "bar") {
      d.line(cx, mid - hd.len / 2, cx, mid + hd.len / 2, "OUT");
      if (hd.kind === "bar") {
        d.line(cx - 18, mid - hd.len / 2, cx + 18, mid - hd.len / 2, "THIN");
        d.line(cx - 18, mid + hd.len / 2, cx + 18, mid + hd.len / 2, "THIN");
      }
    } else if (hd.kind === "knob" || hd.kind === "tbar") {
      d.circle(cx, mid, 18, "OUT");
      if (hd.kind === "tbar") d.line(cx - 24, mid, cx + 24, mid, "OUT");
    } else if (hd.kind === "ring") {
      d.circle(cx, mid - 6, hd.len / 2, "OUT");
    } else if (hd.kind === "edge") {
      d.line(cx - hd.len / 2, yBot - 14, cx + hd.len / 2, yBot - 14, "OUT");
    } else if (hd.kind === "recess") {
      d.rect(cx - hd.len / 2, mid - 13, hd.len, 26, "HID");
    } else if (hd.kind === "cup") {
      d.rect(cx - 16, mid - hd.len / 2, 32, hd.len, "THIN");
    } else {
      d.line(cx - cellW * 0.44, yBot - 34, cx + cellW * 0.44, yBot - 34, "OUT");
    }
  }
  function elevStyle(d, ds, x, y, w, h) {
    var st = 70;
    if (/shaker|raised|glass|cane|louvered/.test(ds)) d.rect(x + st, y + st, w - 2 * st, h - 2 * st, "THIN");
    if (ds === "raised") d.rect(x + st + 14, y + st + 14, w - 2 * st - 28, h - 2 * st - 28, "THIN");
    if (ds === "glass") { d.line(x + st, y + st, x + w - st, y + h - st, "HID"); }
    if (ds === "mirror") { d.line(x + 20, y + 20, x + w - 20, y + h - 20, "HID"); d.line(x + w - 20, y + 20, x + 20, y + h - 20, "HID"); }
    if (ds === "cane") { for (var c = x + st; c < x + w - st; c += 60) d.line(c, y + st, c, y + h - st, "HID"); for (var r = y + st; r < y + h - st; r += 60) d.line(x + st, r, x + w - st, r, "HID"); }
    if (ds === "fluted" || ds === "grooved") { var p = ds === "fluted" ? 24 : 95; for (var f = x + p; f < x + w - 6; f += p) d.line(f, y + 16, f, y + h - 16, "THIN"); }
    if (ds === "louvered") { for (var s = y + st + 8; s < y + h - st - 20; s += 44) d.line(x + st + 4, s, x + w - st - 4, s, "THIN"); }
    if (ds === "steel") { d.rect(x + 55, y + 110, w - 110, h - 220, "THIN"); }
  }
  function elevDraw(u) {
    if (u.ctype === "kitchen") return kitchenElev(u);
    if (u.ctype === "tv") return tvElev(u);
    if (u.ctype === "crockery") return crockeryElev(u);
    if (u.ctype === "dresser") return dresserElev(u);
    var d = new Draw(), T = u.T;
    if (u.kind === "imported") {
      d.line(-300, 0, u.W + 300, 0, "OUT");
      d.rect(0, 0, u.W, u.H, "OUT");
      var x = 3, yTop = u.H - 3, rowH = 0;
      u.rows.forEach(function (r) {
        if (!/Shutter|Facia/i.test(r.r)) return;
        for (var i = 0; i < r.q; i++) {
          if (x + r.w > u.W && x > 3) { x = 3; yTop -= rowH + 3; rowH = 0; }
          if (yTop - r.h < -60) return;
          d.rect(x, yTop - r.h, r.w, r.h, "THIN");
          if (r.w > 220 && r.h > 120) d.text(x + r.w / 2, yTop - r.h / 2 - 20, r.h + "×" + r.w, 40);
          x += r.w + 3; if (r.h > rowH) rowH = r.h;
        }
      });
      d.dimH(0, u.W, 0, -230, u.W + " mm"); d.dimV(0, u.H, u.W, u.W + 230, u.H + " mm");
      d.text(u.W / 2, u.H + 180, "FRONT LAYOUT — " + (u.label || "UNIT") + " (as imported)", 56);
      var tx = u.W + 500, ty = -620;
      d.rect(tx, ty, 1650, 430, "OUT"); d.line(tx, ty + 290, tx + 1650, ty + 290, "THIN"); d.line(tx, ty + 150, tx + 1650, ty + 150, "THIN");
      d.text(tx + 825, ty + 330, (S.head.cust || "CUSTOMER") + "   |   " + (S.head.order || "ORDER No"), 54);
      d.text(tx + 825, ty + 190, (u.label || "UNIT") + "  H" + u.H + " X W" + u.W + " X D" + u.D, 58);
      d.text(tx + 825, ty + 50, "CARCASS " + u.carcass + "   SHUTTER " + u.shutterCol, 46);
      return d;
    }
    var totalH = u.H + (u.loft ? u.loftH + 2 : 0);
    d.line(-300, 0, u.W + 900 + u.D + 300, 0, "OUT");
    d.rect(0, 0, u.W, u.H, "OUT");
    if (u.type === "sliding") {
      d.line(u.W / 2 - 25, 20, u.W / 2 - 25, u.H - 20, "THIN");
      d.line(u.W / 2 + 25, 20, u.W / 2 + 25, u.H - 20, "THIN");
      d.line(10, 50, u.W - 10, 50, "THIN"); d.line(10, u.H - 50, u.W - 10, u.H - 50, "THIN");
      elevHandle(d, u, u.W * 0.28, u.W / 2, 50, u.H - 50);
      elevHandle(d, u, u.W * 0.72, u.W / 2, 50, u.H - 50);
      d.text(u.W / 2, u.H / 2, "2 SLIDING SHUTTERS", 54);
    } else {
      var n = u.shutters, cell = u.W / n;
      for (var i = 1; i < n; i++) d.line(i * cell, 8, i * cell, u.H - 8, "THIN");
      for (var j = 0; j < n; j++) {
        var cx = cell * (j + 0.5), hl = j < n / 2;
        elevStyle(d, u.dstyle || "slab", cx - cell / 2 + 3, 8, cell - 6, u.H - 16);
        elevHandle(d, u, cx + (hl ? cell * 0.34 : -cell * 0.34), cell, 8, u.H - 8);
      }
    }
    var iw = u.W - 2 * T, vp = Math.max(0, u.sections - 1), secW = (iw - vp * T) / u.sections;
    for (var v = 1; v <= vp; v++) d.line(T + v * secW + (v - 1) * T, T, T + v * secW + (v - 1) * T, u.H - T, "HID");
    for (var s2 = 0; s2 < u.sections; s2++)
      for (var sh = 1; sh <= u.shelves; sh++) {
        var y = T + (u.H - 2 * T) * sh / (u.shelves + 1), x0 = T + s2 * (secW + T);
        d.line(x0, y, x0 + secW, y, "HID");
      }
    if (u.loft) {
      d.rect(0, u.H + 2, u.W, u.loftH, "OUT");
      var ln = Math.max(1, u.loftShutters), lc = u.W / ln;
      for (var L = 1; L < ln; L++) d.line(L * lc, u.H + 10, L * lc, u.H + u.loftH - 8, "THIN");
      for (var L2 = 0; L2 < ln; L2++) {
        var lhl = L2 < ln / 2;
        elevHandle(d, u, lc * (L2 + 0.5) + (lhl ? lc * 0.34 : -lc * 0.34), lc, u.H + 10, u.H + u.loftH - 8);
      }
      d.dimV(u.H + 2, u.H + 2 + u.loftH, u.W, u.W + 230, u.loftH);
    }
    d.dimH(0, u.W, 0, -230, u.W + " mm");
    d.dimV(0, u.H, u.W, u.W + 230, u.H + " mm");
    d.text(u.W / 2, totalH + 180, "FRONT ELEVATION — " + (u.label || "UNIT"), 56);

    var sx = u.W + 700;
    d.rect(sx, 0, u.D, totalH, "OUT");
    d.line(sx, u.H, sx + u.D, u.H, "THIN");
    var shD = Math.max(180, u.D - 103);
    for (var k = 1; k <= u.shelves; k++) {
      var yy = T + (u.H - 2 * T) * k / (u.shelves + 1);
      d.line(sx + (u.D - shD), yy, sx + u.D, yy, "HID");
    }
    d.dimH(sx, sx + u.D, 0, -230, u.D + " mm");
    d.text(sx + u.D / 2, totalH + 180, "SECTION", 54);

    var tx = sx + u.D + 300, ty = -620;
    d.rect(tx, ty, 1650, 430, "OUT");
    d.line(tx, ty + 290, tx + 1650, ty + 290, "THIN");
    d.line(tx, ty + 150, tx + 1650, ty + 150, "THIN");
    d.text(tx + 825, ty + 330, (S.head.cust || "CUSTOMER") + "   |   " + (S.head.order || "ORDER No"), 54);
    d.text(tx + 825, ty + 190, (u.label || "UNIT") + "  H" + u.H + " X W" + u.W + " X D" + u.D, 58);
    d.text(tx + 825, ty + 50, "CARCASS " + u.carcass + "   SHUTTER " + u.shutterCol + "   HANDLE " + H(u.handle).label, 46);
    return d;
  }
  function renderElev() {
    var draft = $("#draft"); if (!draft) return;
    var u = U();
    if (!u) { draft.innerHTML = '<div style="padding:40px;text-align:center;color:#94a3b8;font-size:13px">No units in this project yet. Add furniture or draw walls in 2D Floor Plan.</div>'; return; }
    draft.innerHTML = drawSVG(elevDraw(u));
  }

  /* ══════════ EXPORT ══════════ */
  var dlNS = null, dlReady = false;
  function withDL(cb) {
    if (dlReady) { cb(); return; }
    if (window.claude && typeof window.claude.use === "function") {
      window.claude.use("downloads").then(function (ns) { dlNS = ns; dlReady = true; cb(); },
        function () { dlReady = true; cb(); });
    } else { dlReady = true; cb(); }
  }
  function blobSave(fn, data) {
    try {
      var a = document.createElement("a");
      a.href = URL.createObjectURL(new Blob([data], { type: "application/octet-stream" }));
      a.download = fn; document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
      toast("Downloading " + fn);
    } catch (e) { toast("Download blocked here"); }
  }
  function deliver(fn, data) {
    withDL(function () {
      if (dlNS) {
        var name = /\.dxf$/i.test(fn) ? fn.replace(/\.dxf$/i, ".dxf.txt") : fn;
        dlNS.save({ filename: name, data: data }).then(function () {
          toast(name !== fn ? "Saved — rename .txt to .dxf" : "Saved " + name);
        }, function (err) {
          if (err && err.code === "declined") return;
          blobSave(fn, data);
        });
      } else blobSave(fn, data);
    });
  }
  function sheetCSV() {
    function q(s) { return '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"'; }
    var o = ['S.No,Unit,Height,Width,Qty,Remarks,Design,Colour,SFT,E/B,E/B Ft'], n = 0;
    S.units.forEach(function (u) {
      panelsFor(u).forEach(function (r) {
        n++;
        o.push([n, q(u.label), r.h, r.w, r.q, q(r.r), q(r.d), q(r.col), f2(sft(r.h, r.w, r.q)), q(ebRule(r.r).code), f2(ebFt(r))].join(","));
      });
    });
    var t = allTotals();
    o.push("");
    o.push("Total panels," + t.qty + ",Total SFT," + f2(t.sft) + ",Cutting ft," + Math.round(t.cutRft) + ",E/B ft," + Math.round(t.ebRft));
    for (var c in t.byCol) o.push("Board " + q(c) + ",sheets 8x4," + Math.ceil(t.byCol[c] / 32) + ",area sft," + f2(t.byCol[c]));
    for (var k in t.handles) o.push("Handle " + q(t.handles[k].h.label) + "," + (t.handles[k].h.unit === "rft" ? Math.round(t.handles[k].q) + ",ft" : t.handles[k].q + ",nos"));
    return o.join("\r\n");
  }
  var _csvBtn = $("#csvBtn");
  if (_csvBtn) {
    _csvBtn.addEventListener("click", function () {
      var activeView = document.querySelector(".view.is-on");
      if (activeView && activeView.id === "view-boq" && window.OrbixUI && window.OrbixUI.exportXLSX) {
        window.OrbixUI.exportXLSX();
        return;
      }
      deliver("process-sheet.csv", sheetCSV());
    });
  }
  var _dxfBtn = $("#dxfBtn");
  if (_dxfBtn) {
    _dxfBtn.addEventListener("click", function () {
      var u = U();
      deliver("elevation-" + (u.label || "unit").toLowerCase().replace(/\s+/g, "-") + ".dxf", drawDXF(elevDraw(u)));
    });
  }
  var _printBtn = $("#printBtn");
  if (_printBtn) {
    _printBtn.addEventListener("click", function () {
      var activeView = document.querySelector(".view.is-on");
      if (activeView && activeView.id === "view-boq" && window.OrbixUI && window.OrbixUI.downloadPDF) {
        window.OrbixUI.downloadPDF();
        return;
      }
      setView("sheet");
      setTimeout(function () { window.print(); }, 140);
    });
  }

  /* ══════════ VIEWS ══════════ */
  function setView(v) {
    // Check employee role restrictions
    if (window.OrbixProjects && window.OrbixProjects.currentUser && !window.OrbixProjects.isAdmin()) {
      var allowed = ['home', 'plan', 'design', 'boq'];
      if (allowed.indexOf(v) === -1) {
        if (typeof showToast === 'function') {
          showToast('Access restricted: Employees can only access Home, Floor Plan, 3D Studio, and Pricing.');
        }
        v = 'home';
      }
    }

    // Update browser URL via router safely
    try {
      if (window.OrbixRouter && typeof window.OrbixRouter.updateUrl === 'function') {
        window.OrbixRouter.updateUrl(v, false);
      }
    } catch (e) {
      console.warn('Router updateUrl failed:', e);
    }

    $all(".vtab").forEach(function (b) {
      var on = b.dataset.view === v;
      b.classList.toggle("is-on", on);
      b.setAttribute("aria-pressed", String(on));
    });
    $all(".view").forEach(function (s) { s.classList.toggle("is-on", s.id === "view-" + v); });
    if (v === "design") {
      if (window.OrbixUI && typeof window.OrbixUI.update3DStudioRoomOptions === 'function') {
        window.OrbixUI.update3DStudioRoomOptions();
      }
      if (window.OrbixUI && typeof window.OrbixUI.syncProjectUnitsTo3DStudio === 'function') {
        window.OrbixUI.syncProjectUnitsTo3DStudio();
      }
      if (typeof buildScene === 'function') buildScene();
      if (window.OrbixUI && typeof window.OrbixUI.render3DHome === 'function') window.OrbixUI.render3DHome(true);

      // Frame camera on the active unit
      var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
      var actU = U(), rot = 0;
      if (actU && actU._furnId && plan && plan.furniture) {
        var f = plan.furniture.find(function (it) { return it.id === actU._furnId; });
        if (f) rot = f.rotY || 0;
      }
      cam.yaw = -(rot * 180 / Math.PI) - 24;
      cam.pitch = -10;
      fit(); camApply();
    }
    if (v === "panels") renderPanels();
    if (v === "nest") { renderNestOpts(); renderNest(); }
    if (v === "quote") renderQuote();
    if (v === "report") renderReport();
    if (v === "gallery") renderGallery();
    if (v === "plan" && window.OrbixUI && window.OrbixUI.editor) { window.OrbixUI.editor.resize(); window.OrbixUI.editor.render(); }
    if (v === "boq" && window.OrbixUI) { window.OrbixUI.renderBOQ(); }
  }
  window.setView = setView;
  $all(".vtab").forEach(function (b) {
    b.addEventListener("click", function (e) {
      e.preventDefault();
      var target = b.dataset.view;
      if (target === "kitchen") { galState.type = "kitchen"; target = "gallery"; }
      if (window.OrbixRouter && typeof window.OrbixRouter.navigateTo === 'function') {
        window.OrbixRouter.navigateTo(target, false);
      } else {
        setView(target);
      }
    });
  });

  function getActiveUnitRotation() {
    var plan = (window.OrbixUI && typeof window.OrbixUI.getPlan === 'function') ? window.OrbixUI.getPlan() : (window.OrbixUI && window.OrbixUI.project && window.OrbixUI.project.plan);
    var actU = U();
    if (actU && actU._furnId && plan && plan.furniture) {
      var f = plan.furniture.find(function (it) { return it.id === actU._furnId; });
      if (f) return f.rotY || 0;
    }
    return 0;
  }

  $("#frontBtn").addEventListener("click", function () {
    var rot = getActiveUnitRotation();
    cam.yaw = -(rot * 180 / Math.PI);
    cam.pitch = -2;
    camApply();
  });

  (function () {
    var b = $("#viewFocusUnitBtn"); if (!b) return;
    window.Orbix3DViewMode = 'unit';
    b.addEventListener("click", function () {
      if (window.Orbix3DViewMode === 'unit') {
        window.Orbix3DViewMode = 'home';
        b.textContent = '🏠 Full House';
        b.classList.remove('is-on');
        b.style.background = '#2563eb';
        b.style.borderColor = '#1d4ed8';
        toast("3D View: Framing full architectural home");
      } else {
        window.Orbix3DViewMode = 'unit';
        b.textContent = '🎯 Focus Unit';
        b.classList.add('is-on');
        b.style.background = '#059669';
        b.style.borderColor = '#047857';
        toast("3D View: Framing active unit for customization");
      }
      if (GL.ok) { GL.frame(); camApply(); }
    });
  })();

  (function () {
    var b = $("#openBtn"); if (!b) return;
    b.addEventListener("click", function () {
      if (!GL.ok) { toast("Door animation needs WebGL"); return; }
      var open = GL.toggleAll();
      b.textContent = open ? "🚪 Close all" : "🚪 Open all"; b.setAttribute("aria-pressed", String(open));
      var hudB = $("#hudOpenBtn");
      if (hudB) {
        hudB.textContent = open ? "🚪 Close all" : "🚪 Open all";
        hudB.setAttribute("aria-pressed", String(open));
        hudB.classList.toggle("is-active", open);
      }
    });
  })();
  (function () {
    var b = $("#toggleWallCutawayBtn"); if (!b) return;
    window.OrbixWallMode = 'cutaway';
    b.addEventListener("click", function () {
      if (window.OrbixWallMode === 'cutaway') {
        window.OrbixWallMode = 'all';
        b.textContent = '🏛 Walls: All Visible';
        b.classList.remove('is-on');
        toast("Showing all walls");
      } else if (window.OrbixWallMode === 'all') {
        window.OrbixWallMode = 'hidden';
        b.textContent = '🚫 Walls: Hidden';
        b.classList.remove('is-on');
        toast("Hiding all walls");
      } else {
        window.OrbixWallMode = 'cutaway';
        b.textContent = '👁 Walls: Auto-Cutaway';
        b.classList.add('is-on');
        toast("Auto-cutaway: front obstructing walls hidden");
      }
      if (GL.ok && GL.updateWallCutaway) {
        GL.updateWallCutaway();
        GL.settle();
      }
    });
  })();
  $("#isoBtn").addEventListener("click", function () {
    var rot = getActiveUnitRotation();
    cam.yaw = -(rot * 180 / Math.PI) - 28;
    cam.pitch = -12;
    camApply();
  });
  $("#sideBtn").addEventListener("click", function () {
    var rot = getActiveUnitRotation();
    cam.yaw = -(rot * 180 / Math.PI) - 90;
    cam.pitch = -2;
    camApply();
  });

  // Floating 3D Camera & Presentation HUD Wiring
  (function () {
    var hudFront = $("#hudFrontBtn");
    var hudIso = $("#hudIsoBtn");
    var hudSide = $("#hudSideBtn");
    var hudOpen = $("#hudOpenBtn");
    var hudPresent = $("#hudPresentBtn");

    function setActiveHudCam(btn) {
      if (hudFront) hudFront.classList.remove("is-active");
      if (hudIso) hudIso.classList.remove("is-active");
      if (hudSide) hudSide.classList.remove("is-active");
      if (btn) btn.classList.add("is-active");
    }

    if (hudFront) {
      hudFront.addEventListener("click", function () {
        setActiveHudCam(hudFront);
        var b = $("#frontBtn"); if (b) b.click();
      });
    }
    if (hudIso) {
      hudIso.addEventListener("click", function () {
        setActiveHudCam(hudIso);
        var b = $("#isoBtn"); if (b) b.click();
      });
    }
    if (hudSide) {
      hudSide.addEventListener("click", function () {
        setActiveHudCam(hudSide);
        var b = $("#sideBtn"); if (b) b.click();
      });
    }
    if (hudOpen) {
      hudOpen.addEventListener("click", function () {
        var b = $("#openBtn"); if (b) b.click();
      });
    }
    if (hudPresent) {
      hudPresent.addEventListener("click", function () {
        var b = $("#presentBtn"); if (b) b.click();
      });
    }

    var fBtn = $("#frontBtn"); if (fBtn) fBtn.addEventListener("click", function () { setActiveHudCam(hudFront); });
    var iBtn = $("#isoBtn"); if (iBtn) iBtn.addEventListener("click", function () { setActiveHudCam(hudIso); });
    var sBtn = $("#sideBtn"); if (sBtn) sBtn.addEventListener("click", function () { setActiveHudCam(hudSide); });
  })();

  /* ═══════════════════════════════════════════════════════════════
     DRILLING — System 32 boring positions
     Panel coordinates: x across the Width column, y up the Height
     column, origin bottom-left. Everything here lands on the DXF
     DRILL layer, so a CNC can bore straight from the file.
     ═══════════════════════════════════════════════════════════════ */
  var BORE = { cup: 35, cupInset: 22.5, pin: 5, pinPitch: 32, sysInset: 37, screw: 5 };

  function hingeCount(h) {
    if (h <= 900) return 2;
    if (h <= 1600) return 3;
    if (h <= 2000) return 4;
    if (h <= 2400) return 5;
    return 6;
  }
  function hingePositions(h) {
    var n = hingeCount(h), first = 100, last = h - 100, out = [];
    if (h < 300) return [h / 2];
    if (n === 2) return [first, last];
    var step = (last - first) / (n - 1);
    for (var i = 0; i < n; i++) out.push(Math.round(first + i * step));
    return out;
  }
  /* rows of System-32 shelf-pin holes down a side panel or partition */
  function pinRows(h, startY, endY) {
    var out = [], y = Math.ceil(startY / BORE.pinPitch) * BORE.pinPitch;
    for (; y <= endY; y += BORE.pinPitch) out.push(y);
    return out;
  }
  function drillsFor(r, u) {
    var holes = [], notes = [], h = r.h, w = r.w, rm = r.r;
    var hd = H(u.handle);
    function hole(x, y, d, t) { holes.push({ x: x, y: y, d: d, t: t }); }

    if (/^Shutter|^Sliding Shutter|^Loft Shutter|^Door Stile|^Steel Shutter/.test(rm)) {
      if (!/^Sliding/i.test(rm) && (u.type !== "sliding" || /^Loft/.test(rm))) {
        hingePositions(h).forEach(function (y) { hole(BORE.cupInset, y, BORE.cup, "cup"); });
        notes.push(hingeCount(h) + " × cup Ø35 @ " + BORE.cupInset + " from hinge edge");
      } else {
        notes.push("sliding — no cup boring");
      }
      if (/^(bar|knob|cup|tbar|ring|edge)$/.test(hd.kind)) {
        var cc = (hd.kind === "knob" || hd.kind === "tbar" || hd.kind === "ring") ? 0 : hd.len;
        var hx = w - 40;
        if (cc) {
          hole(hx, h / 2 - cc / 2, BORE.screw, "handle"); hole(hx, h / 2 + cc / 2, BORE.screw, "handle");
          notes.push("handle 2 × Ø5 @ " + cc + " c/c");
        }
        else { hole(hx, h / 2, BORE.screw, "handle"); notes.push("knob 1 × Ø5"); }
      }
    }
    else if (/Draw Facia/.test(rm)) {
      if (/^(bar|knob|cup|tbar|ring|edge)$/.test(hd.kind)) {
        var cc2 = (hd.kind === "knob" || hd.kind === "tbar" || hd.kind === "ring") ? 0 : hd.len;
        if (cc2) {
          hole(w / 2 - cc2 / 2, h / 2, BORE.screw, "handle"); hole(w / 2 + cc2 / 2, h / 2, BORE.screw, "handle");
          notes.push("handle 2 × Ø5 @ " + cc2 + " c/c");
        }
        else { hole(w / 2, h / 2, BORE.screw, "handle"); notes.push("knob 1 × Ø5"); }
      }
      hole(30, h / 2, BORE.screw, "runner"); hole(w - 30, h / 2, BORE.screw, "runner");
      notes.push("2 × Ø5 drawer-box fixing");
    }
    else if (/^Left Panel|^Right Panel|^Loft Side Panel/.test(rm)) {
      /* w here is the carcass depth */
      var front = BORE.sysInset, back = Math.max(front + 64, w - BORE.sysInset);
      var rows = pinRows(h, 150, h - 150);
      rows.forEach(function (y) { hole(front, y, BORE.pin, "pin"); hole(back, y, BORE.pin, "pin"); });
      if (rows.length) notes.push(rows.length * 2 + " × pin Ø5 @ 32 pitch, 2 rows");
      if (u.type !== "sliding" && !/Loft/.test(rm)) {
        hingePositions(u.kind === "imported" ? h : u.H - 6).forEach(function (y) {
          hole(front, y - 16, BORE.screw, "hplate"); hole(front, y + 16, BORE.screw, "hplate");
        });
        notes.push(hingeCount(u.kind === "imported" ? h : u.H - 6) * 2 + " × Ø5 hinge-plate");
      }
      if (u.drawers > 0 && /^Right Panel/.test(rm)) {
        for (var d = 0; d < u.drawers; d++) {
          var dy = u.T + d * (u.drawerH + 4) + u.drawerH / 2;
          hole(front, dy, BORE.screw, "runner"); hole(front + 224, dy, BORE.screw, "runner");
          hole(Math.min(back, front + 448), dy, BORE.screw, "runner");
        }
        notes.push(u.drawers * 3 + " × Ø5 runner fixing @ 37 from front");
      }
    }
    else if (/^VP|^Loft VP/.test(rm)) {
      var f2p = BORE.sysInset, b2 = Math.max(f2p + 64, w - BORE.sysInset);
      var r2 = pinRows(h, 150, h - 150);
      r2.forEach(function (y) { hole(f2p, y, BORE.pin, "pin"); hole(b2, y, BORE.pin, "pin"); });
      if (r2.length) notes.push(r2.length * 2 + " × pin Ø5 both faces");
    }
    else if (/Back Panel/.test(rm)) notes.push("no boring");
    else if (/ADJ Shelf/.test(rm)) notes.push("no boring — rests on pins");
    else notes.push("no boring");
    return { holes: holes, notes: notes };
  }

  /* unique panel types across every unit, with the unit they belong to */
  function uniquePanels() {
    var map = {}, out = [];
    S.units.forEach(function (u) {
      panelsFor(u).forEach(function (r) {
        var k = u.label + "|" + r.h + "|" + r.w + "|" + r.r + "|" + r.col;
        if (map[k]) { map[k].q += r.q; return; }
        var rec = { h: r.h, w: r.w, q: r.q, r: r.r, col: r.col, d: r.d, unit: u.label, u: u };
        map[k] = rec; out.push(rec);
      });
    });
    return out;
  }

  /* ══════════ PANEL + DRILLING VIEW ══════════ */
  var HOLECOL = { cup: "#C0261B", pin: "#1B4F72", hplate: "#1E7A4C", runner: "#A8560F", handle: "#7A3B9E" };
  function panelSVG(p, dr) {
    var W = p.w, Hh = p.h, pad = 34;
    var vw = W + pad * 2, vh = Hh + pad * 2;
    var o = ['<svg viewBox="0 0 ' + vw + ' ' + vh + '" preserveAspectRatio="xMidYMid meet">'];
    o.push('<rect x="' + pad + '" y="' + pad + '" width="' + W + '" height="' + Hh + '" fill="#fff" stroke="#23211E" stroke-width="' + Math.max(2, vw / 260) + '"/>');
    var sw = Math.max(1.2, vw / 620);
    dr.holes.forEach(function (hl) {
      var cx = pad + hl.x, cy = pad + (Hh - hl.y);
      o.push('<circle cx="' + f2(cx) + '" cy="' + f2(cy) + '" r="' + (hl.d / 2) + '" fill="none" stroke="' + (HOLECOL[hl.t] || "#666") + '" stroke-width="' + sw * 2 + '"/>');
      if (hl.d >= 20) {
        o.push('<line x1="' + f2(cx - hl.d / 2 - 6) + '" y1="' + f2(cy) + '" x2="' + f2(cx + hl.d / 2 + 6) + '" y2="' + f2(cy) + '" stroke="' + HOLECOL[hl.t] + '" stroke-width="' + sw + '"/>');
        o.push('<line x1="' + f2(cx) + '" y1="' + f2(cy - hl.d / 2 - 6) + '" x2="' + f2(cx) + '" y2="' + f2(cy + hl.d / 2 + 6) + '" stroke="' + HOLECOL[hl.t] + '" stroke-width="' + sw + '"/>');
      }
    });
    var fs = Math.max(30, vw / 17);
    o.push('<text x="' + (pad + W / 2) + '" y="' + (vh - 4) + '" font-family="monospace" font-size="' + fs + '" text-anchor="middle" fill="#6C6862">' + W + '</text>');
    o.push('<text x="' + (pad - 6) + '" y="' + (pad + Hh / 2) + '" font-family="monospace" font-size="' + fs + '" text-anchor="middle" fill="#6C6862" transform="rotate(-90 ' + (pad - 6) + ' ' + (pad + Hh / 2) + ')">' + Hh + '</text>');
    o.push('</svg>');
    return o.join("");
  }
  function renderPanels() {
    var g = $("#panelGrid"); if (!g) return;
    g.innerHTML = "";
    uniquePanels().forEach(function (p) {
      var dr = drillsFor(p, p.u);
      var c = el("pcard" + (dr.holes.length ? "" : " nodrill"), g);
      var t = el(null, c, "h4"); t.textContent = p.r + "  ×" + p.q;
      var dm = el("pdim", c);
      dm.innerHTML = p.unit + " · <b>" + p.h + " × " + p.w + "</b> · " + esc(p.col) + " · E/B " + ebRule(p.r).code;
      var sv = el(null, c); sv.innerHTML = panelSVG(p, dr);
      var dd = el("pdrill", c);
      dd.innerHTML = dr.holes.length
        ? dr.notes.map(function (n) { return '<span><i>•</i> ' + esc(n) + '</span>'; }).join("")
        : '<span>' + esc(dr.notes[0] || "no boring") + '</span>';
    });
  }

  /* ═══════════════════════════════════════════════════════════════
     NESTING — guillotine packing on 2440 × 1220 boards
     Free rectangles, best-area-fit, split right + below after each
     placement so every cut is a full edge-to-edge saw pass.
     ═══════════════════════════════════════════════════════════════ */
  /* One packing pass. fitMode 0 = best-area-fit, 1 = best-short-side-fit.
     After each placement the free rectangle is split along its shorter
     leftover axis, which keeps the bigger offcut in one usable piece. */
  function packOnce(pieces, SW, SH, kerf, allowRot, sortFn, fitMode) {
    var sheets = [], left = pieces.slice().sort(sortFn), guard = 0;
    while (left.length && guard++ < 4000) {
      var sh = { free: [{ x: 0, y: 0, w: SW, h: SH }], parts: [], used: 0 }, placed = true;
      while (placed) {
        placed = false;
        var best = null;
        for (var i = 0; i < left.length; i++) {
          var p = left[i];
          for (var f = 0; f < sh.free.length; f++) {
            var fr = sh.free[f], or = [[p.w, p.h, 0]];
            if (allowRot(p)) or.push([p.h, p.w, 1]);
            for (var o = 0; o < or.length; o++) {
              var pw = or[o][0], ph = or[o][1];
              if (pw > fr.w + 0.01 || ph > fr.h + 0.01) continue;
              var lw = fr.w - pw, lh = fr.h - ph;
              var score = fitMode ? Math.min(lw, lh) * 1e6 + Math.max(lw, lh) : fr.w * fr.h - pw * ph;
              if (!best || score < best.score) best = { i: i, f: f, pw: pw, ph: ph, rot: or[o][2], score: score };
            }
          }
        }
        if (!best) break;
        var F = sh.free[best.f], pc = left[best.i];
        sh.parts.push({ x: F.x, y: F.y, w: best.pw, h: best.ph, rot: best.rot, label: pc.label, col: pc.col, unit: pc.unit });
        sh.used += best.pw * best.ph;
        sh.free.splice(best.f, 1);
        var rw = F.w - best.pw - kerf, rh = F.h - best.ph - kerf;
        if (rw < rh) {
          /* shorter leftover is horizontal → bottom strip keeps the full width */
          if (rw > 1) sh.free.push({ x: F.x + best.pw + kerf, y: F.y, w: rw, h: best.ph });
          if (rh > 1) sh.free.push({ x: F.x, y: F.y + best.ph + kerf, w: F.w, h: rh });
        } else {
          /* shorter leftover is vertical → right strip keeps the full height */
          if (rw > 1) sh.free.push({ x: F.x + best.pw + kerf, y: F.y, w: rw, h: F.h });
          if (rh > 1) sh.free.push({ x: F.x, y: F.y + best.ph + kerf, w: best.pw, h: rh });
        }
        left.splice(best.i, 1);
        placed = true;
      }
      if (!sh.parts.length) { left.shift(); continue; }
      sheets.push(sh);
    }
    return sheets;
  }
  /* Try several orderings and both fit rules; keep the layout that uses
     the fewest boards, then the most board area. */
  function packSheets(pieces, SW, SH, kerf, allowRot) {
    var n = pieces.length;
    var orders = [
      function (a, b) { return (b.w * b.h) - (a.w * a.h) || b.h - a.h; },
      function (a, b) { return Math.max(b.w, b.h) - Math.max(a.w, a.h) || (b.w * b.h) - (a.w * a.h); },
      function (a, b) { return b.h - a.h || b.w - a.w; },
      function (a, b) { return b.w - a.w || b.h - a.h; },
      function (a, b) { return (b.w + b.h) - (a.w + a.h) || (b.w * b.h) - (a.w * a.h); }
    ];
    var best = null;
    if (n > 420) orders = orders.slice(0, 1); else if (n > 160) orders = orders.slice(0, 2);
    orders.forEach(function (o) {
      for (var mode = 0; mode < (n > 160 ? 1 : 2); mode++) {
        var r = packOnce(pieces, SW, SH, kerf, allowRot, o, mode);
        var used = 0; r.forEach(function (x) { used += x.used; });
        if (!best || r.length < best.sheets.length || (r.length === best.sheets.length && used > best.used)) best = { sheets: r, used: used };
      }
    });
    return best.sheets;
  }
  /* A panel larger than one board has to be made in joined pieces —
     standard practice for wide backs. Split on the long axis until each
     piece fits, and label the parts so the floor can match them up. */
  function splitToFit(p, SW, SH) {
    function fits(w, h) { return (w <= SW && h <= SH) || (h <= SW && w <= SH); }
    if (fits(p.w, p.h)) return [p];
    var nw = 1, nh = 1, w = p.w, h = p.h, guard = 0;
    while (!fits(w, h) && guard++ < 8) {
      if (h >= w) { nh *= 2; h = p.h / nh; } else { nw *= 2; w = p.w / nw; }
    }
    var out = [], total = nw * nh, k = 0;
    for (var i = 0; i < nw; i++) for (var j = 0; j < nh; j++) {
      k++;
      out.push({
        w: Math.round(p.w / nw), h: Math.round(p.h / nh),
        label: p.label + " (" + k + "/" + total + ")", col: p.col, unit: p.unit, split: true
      });
    }
    return out;
  }
  function nestAll() {
    var byCol = {}, splitCount = 0;
    var SWc = RATES.sheetW, SHc = RATES.sheetH;
    S.units.forEach(function (u) {
      panelsFor(u).forEach(function (r) {
        if (r.nb) return;
        if (!byCol[r.col]) byCol[r.col] = [];
        for (var i = 0; i < r.q; i++) {
          var parts = splitToFit({ w: r.w, h: r.h, label: r.r, col: r.col, unit: u.label }, SWc, SHc);
          if (parts.length > 1) splitCount++;
          byCol[r.col] = byCol[r.col].concat(parts);
        }
      });
    });
    var SW = RATES.sheetW, SH = RATES.sheetH, kerf = RATES.kerf;
    var out = [], totArea = 0, totSheets = 0, totUsed = 0;
    Object.keys(byCol).forEach(function (col) {
      var grain = hasGrain(lam(col));
      var sheets = packSheets(byCol[col], SW, SH, kerf, function () { return !grain; });
      var area = 0; byCol[col].forEach(function (p) { area += p.w * p.h; });
      var used = 0; sheets.forEach(function (s) { used += s.used; });
      out.push({ col: col, sheets: sheets, area: area, grain: grain });
      totArea += area; totSheets += sheets.length; totUsed += used;
    });
    var cap = totSheets * SW * SH;
    var sheetSft = SW * SH / 92903;
    return {
      groups: out, sheets: totSheets, areaMM: totArea,
      util: cap ? totUsed / cap : 0,
      sft: totArea / 92903,
      sheetSft: sheetSft,
      splits: splitCount,
      theoretical: Math.ceil((totArea / 92903) / sheetSft)
    };
  }
  var nestCache = null;
  function nest() { if (!nestCache) nestCache = nestAll(); return nestCache; }
  function nestBust() { nestCache = null; }

  function renderNest() {
    var w = $("#nestSheets"); if (!w) return;
    if (!nestCache) { w.innerHTML = '<div class="nsheet"><h4>Optimising sheets…</h4></div>'; setTimeout(function () { nest(); renderNest(); }, 30); return; }
    var n = nest();
    var st = $("#nestStats");
    function stat(parent, label, val, sub, cls) {
      var d = el("nstat" + (cls ? " " + cls : ""), parent);
      el(null, d, "span").textContent = label;
      el(null, d, "b").textContent = val;
      if (sub) el(null, d, "em").textContent = sub;
    }
    st.innerHTML = "";
    stat(st, "Sheets needed", n.sheets, RATES.sheetW + " × " + RATES.sheetH);
    stat(st, "Yield", Math.round(n.util * 100) + "%", "of board area used", n.util >= 0.8 ? "good" : n.util >= 0.7 ? "" : "warn");
    stat(st, "Panel area", f2(n.sft) + " sft", "across all units");
    stat(st, "Perfect-fit floor", n.theoretical, "100% yield — not achievable");
    var over = n.sheets - n.theoretical;
    stat(st, "Cutting loss", (over > 0 ? "+" : "") + over + " sheet" + (Math.abs(over) === 1 ? "" : "s"), "above the floor", over <= 1 ? "good" : "warn");
    stat(st, "Offcut", f2(n.sheets * n.sheetSft - n.sft) + " sft", "recoverable drop");
    if (n.splits) stat(st, "Joined panels", n.splits, "too wide for one board", "warn");

    w.innerHTML = "";
    var idx = 0;
    n.groups.forEach(function (gr) {
      gr.sheets.forEach(function (sh) {
        idx++;
        var box = el("nsheet", w);
        var hd = el(null, box, "h4");
        hd.innerHTML = 'Sheet ' + idx + ' <i>' + esc(gr.col) + '</i> <em>' +
          (gr.grain ? "grain locked" : "free rotation") + '</em> <em>' +
          Math.round(sh.used / (RATES.sheetW * RATES.sheetH) * 100) + '% used</em>';
        var sv = el(null, box);
        sv.innerHTML = sheetSVG(sh, gr.col);
      });
    });
  }
  function sheetSVG(sh, col) {
    var SW = RATES.sheetW, SH = RATES.sheetH;
    var o = ['<svg viewBox="-8 -8 ' + (SW + 16) + ' ' + (SH + 16) + '">'];
    o.push('<rect x="0" y="0" width="' + SW + '" height="' + SH + '" fill="#EFEDE7" stroke="#23211E" stroke-width="6"/>');
    var base = hex2rgb(lam(col).hex);
    sh.parts.forEach(function (p) {
      var fill = shadeRGB(base, 0.06);
      o.push('<rect x="' + p.x + '" y="' + p.y + '" width="' + p.w + '" height="' + p.h + '" fill="' + fill + '" stroke="#23211E" stroke-width="4"/>');
      var fs = Math.min(46, Math.max(20, Math.min(p.w, p.h) / 4.2));
      if (p.w > 150 && p.h > 90) {
        o.push('<text x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2 - 4) + '" font-family="monospace" font-size="' + fs + '" text-anchor="middle" fill="#23211E">' + esc(p.label) + (p.rot ? " ⟳" : "") + '</text>');
        o.push('<text x="' + (p.x + p.w / 2) + '" y="' + (p.y + p.h / 2 + fs + 2) + '" font-family="monospace" font-size="' + (fs * 0.86) + '" text-anchor="middle" fill="#6C6862">' + (p.rot ? Math.round(p.w) + '×' + Math.round(p.h) : Math.round(p.h) + '×' + Math.round(p.w)) + '</text>');
      }
    });
    o.push('</svg>');
    return o.join("");
  }

  /* nested DXF — panels + drill holes, CNC ready */
  function nestDXF() {
    var n = nest(), d = new Draw(), SW = RATES.sheetW, SH = RATES.sheetH, gap = 260, oy = 0;
    n.groups.forEach(function (gr) {
      gr.sheets.forEach(function (sh) {
        d.rect(0, oy, SW, SH, "SHEET");
        d.text(0, oy + SH + 70, gr.col, 60, "DIM", "start");
        sh.parts.forEach(function (p) {
          d.rect(p.x, oy + p.y, p.w, p.h, "PANEL");
          d.text(p.x + p.w / 2, oy + p.y + p.h / 2, p.label, 44, "DIM");
          var src = null;
          S.units.forEach(function (u) {
            if (src) return;
            panelsFor(u).forEach(function (r) {
              if (!src && r.r === p.label && ((r.h === Math.round(p.h) && r.w === Math.round(p.w)) || (r.h === Math.round(p.w) && r.w === Math.round(p.h))))
                src = { r: r, u: u };
            });
          });
          if (src) {
            drillsFor(src.r, src.u).holes.forEach(function (hl) {
              var hx, hy;
              if (p.rot) { hx = p.x + hl.y; hy = oy + p.y + hl.x; }
              else { hx = p.x + hl.x; hy = oy + p.y + hl.y; }
              d.circle(hx, hy, hl.d / 2, "DRILL");
            });
          }
        });
        oy -= (SH + gap);
      });
    });
    return drawDXF(d);
  }

  /* nesting controls */
  function renderNestOpts() {
    var w = $("#nestOpts"); if (!w || w._built) return;
    w._built = true;
    function f(label, val, cb) {
      var d = el("fld", w);
      el(null, d, "label").textContent = label;
      var i = el(null, d, "input"); i.type = "number"; i.value = val;
      i.addEventListener("change", function () { cb(num(i.value, val)); nestBust(); renderNest(); save(); });
    }
    f("Sheet length", RATES.sheetW, function (v) { RATES.sheetW = v; });
    f("Sheet width", RATES.sheetH, function (v) { RATES.sheetH = v; });
    f("Saw kerf", RATES.kerf, function (v) { RATES.kerf = v; });
    var b = el("btn primary", w, "button");
    b.textContent = "DXF — nested + drilling";
    b.style.marginLeft = "auto";
    b.addEventListener("click", function () { deliver("nested-cnc.dxf", nestDXF()); });
    var b2 = el("btn", w, "button");
    b2.textContent = "Cutting CSV";
    b2.addEventListener("click", function () { deliver("nesting.csv", nestCSV()); });
  }
  function nestCSV() {
    function q(s) { return '"' + String(s == null ? "" : s).replace(/"/g, '""') + '"'; }
    var n = nest(), o = ["Sheet,Colour,Part,Unit,X mm,Y mm,Length mm,Width mm,Rotated"], i = 0;
    n.groups.forEach(function (gr) {
      gr.sheets.forEach(function (sh) {
        i++;
        sh.parts.forEach(function (p) {
          o.push([i, q(gr.col), q(p.label), q(p.unit), Math.round(p.x), Math.round(p.y),
            Math.round(p.h), Math.round(p.w), p.rot ? "yes" : "no"].join(","));
        });
      });
    });
    o.push("");
    o.push("Sheets," + n.sheets + ",Yield %," + Math.round(n.util * 100) + ",Panel sft," + f2(n.sft) + ",Perfect-fit floor," + n.theoretical);
    return o.join("\r\n");
  }

  /* ══════════ HARDWARE + QUOTE ══════════ */
  function hardwareCounts() {
    var c = { hinge: 0, runner: 0, rod: 0, pin: 0, handles: {} };
    var runs = []; S.units.forEach(function (u) { runsOf(u).forEach(function (r) { runs.push(r); }); });
    runs.forEach(function (u) {
      if (u.kind === "imported") {
        u.rows.forEach(function (r) {
          if (/^Shutter$/i.test(r.r)) c.hinge += r.q * hingeCount(r.h);
          if (/Facia/i.test(r.r)) c.runner += r.q;
          var hh = handleFromDesign(r.d);
          if (hh) { if (!c.handles[hh.id]) c.handles[hh.id] = { h: hh, q: 0 }; c.handles[hh.id].q += r.q; }
        });
        return;
      }
      if (u.shape === "walkin") { c.runner += u.drawers; c.rod += u.sections; c.pin += u.shelves * u.sections * 4; return; }
      var loftS = u.loft ? Math.max(1, u.loftShutters) : 0;
      if (u.type !== "sliding") c.hinge += u.shutters * hingeCount(u.H - 6);
      c.hinge += loftS * hingeCount(u.loftH - 6);
      c.runner += u.drawers;
      c.rod += u.sections > 0 ? 1 : 0;
      c.pin += u.shelves * u.sections * 4;
      var hd = H(u.handle);
      if (hd.kind !== "none") {
        var q = handleQty(Object.assign({}, u, { shape: "straight" }));
        if (!c.handles[hd.id]) c.handles[hd.id] = { h: hd, q: 0 };
        c.handles[hd.id].q += q;
      }
    });
    return c;
  }
  function quoteData() {
    var n = nest(), t = allTotals(), hw = hardwareCounts();
    var mat = [], matTot = 0;
    n.groups.forEach(function (gr) {
      var l = lam(gr.col), sheets = gr.sheets.length, cost = sheets * n.sheetSft * (l.rate || 0);
      matTot += cost;
      mat.push({ code: gr.col, name: l.name, sheets: sheets, rate: l.rate || 0, amt: cost });
    });
    var hwRows = [], hwTot = 0;
    [["hinge", hw.hinge], ["runner", hw.runner], ["rod", hw.rod], ["pin", hw.pin]].forEach(function (p) {
      if (!p[1]) return;
      var H0 = HARDWARE[p[0]], amt = p[1] * H0.rate;
      hwTot += amt;
      hwRows.push({ key: p[0], label: H0.label, q: p[1], unit: H0.unit, rate: H0.rate, amt: amt });
    });
    for (var k in hw.handles) {
      var hh = hw.handles[k], q = hh.h.unit === "rft" ? Math.round(hh.q) : hh.q, amt = q * hh.h.rate;
      hwTot += amt;
      hwRows.push({ key: "h_" + k, label: hh.h.label, q: q, unit: hh.h.unit === "rft" ? "ft" : "nos", rate: hh.h.rate, amt: amt });
    }
    var cutFt = Math.round(t.cutRft), ebF = Math.round(t.ebRft);
    var jobRows = [
      { key: "cut", label: "Cutting", q: cutFt, unit: "ft", rate: RATES.cut, amt: cutFt * RATES.cut },
      { key: "eb", label: RATES.ebSize + " edge banding", q: ebF, unit: "ft", rate: RATES.eb, amt: ebF * RATES.eb }
    ];
    var jobTot = jobRows.reduce(function (s, r) { return s + r.amt; }, 0);
    var sub = matTot + hwTot + jobTot;
    var marg = sub * RATES.margin / 100;
    return {
      mat: mat, matTot: matTot, hw: hwRows, hwTot: hwTot, job: jobRows, jobTot: jobTot,
      sub: sub, marg: marg, total: sub + marg, sft: n.sft
    };
  }
  function renderQuote() {
    var p = $("#quotePaper"); if (!p) return;
    if (!nestCache) { p.innerHTML = '<div class="q-h"><h2>Quotation</h2><span>optimising sheets…</span></div>'; setTimeout(function () { nest(); renderQuote(); }, 30); return; }
    var q = quoteData();
    function tbl(title, rows, unitCol, totLabel, tot, rateId) {
      var h = '<h3>' + title + '</h3><table class="qtable"><thead><tr><th>Item</th><th class="n">Qty</th><th>Unit</th><th class="n">Rate ₹</th><th class="n">Amount ₹</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        h += '<tr><td>' + esc(r.label) + '</td><td class="n">' + r.q + '</td><td>' + esc(r.unit) + '</td>' +
          '<td class="n"><input data-' + rateId + '="' + esc(r.key) + '" value="' + f2(r.rate) + '"></td>' +
          '<td class="n">' + f2(r.amt) + '</td></tr>';
      });
      h += '<tr class="sub"><td colspan="4">' + totLabel + '</td><td class="n">' + f2(tot) + '</td></tr></tbody></table>';
      return h;
    }
    var matRows = q.mat.map(function (m) {
      return {
        key: m.code, label: m.code + " — " + m.name + "  (" + m.sheets + " sheets)",
        q: Math.round(m.sheets * nest().sheetSft), unit: "sft", rate: m.rate, amt: m.amt
      };
    });
    var head = '<div class="q-h"><h2>Quotation</h2><span>' + esc(S.head.cust || "Customer") +
      '  ·  ' + esc(S.head.date || "") + '  ·  ' + f2(q.sft) + ' sft panel area</span></div>';
    p.innerHTML = head
      + tbl("Material — boards", matRows, "", "Material total", q.matTot, "mrate")
      + tbl("Hardware", q.hw, "", "Hardware total", q.hwTot, "hrate")
      + tbl("Jobwork", q.job, "", "Jobwork total", q.jobTot, "jrate")
      + '<h3>Summary</h3><table class="qtable"><tbody>'
      + '<tr><td>Subtotal</td><td class="n" colspan="3"></td><td class="n">' + f2(q.sub) + '</td></tr>'
      + '<tr><td>Margin / overhead</td><td class="n"><input id="q_margin" value="' + f2(RATES.margin) + '"></td><td>%</td><td class="n"></td><td class="n">' + f2(q.marg) + '</td></tr>'
      + '</tbody></table>'
      + '<div class="qgrand"><span>Total</span><b>₹ ' + Math.round(q.total).toLocaleString("en-IN") + '</b></div>'
      + '<p class="qnote">Board cost is billed on whole sheets actually nested, not on panel area — offcut stays with the job. Hardware rates seeded from published Indian trade prices; edit any rate above and the total updates. Excludes GST, transport and installation.</p>';

    if (window.OrbixCore && window.OrbixCore.MODEL_RATES_MATRIX) {
      var uType = (S.u && S.u.type) || "wardrobe";
      var mKey = "wr_shelves";
      if (uType.indexOf("slide") !== -1) mKey = "wr_sliding";
      else if (uType.indexOf("kitchen_wall") !== -1) mKey = "kitchen_wm";
      else if (uType.indexOf("kitchen") !== -1) mKey = "kitchen_fm";
      else if (uType.indexOf("loft") !== -1) mKey = "loft_os";
      else if (uType.indexOf("tv") !== -1) mKey = "tv_cabinet";

      var mDef = window.OrbixCore.MODEL_RATES_MATRIX[mKey];
      var tiers = window.OrbixCore.PRICE_TIERS || [];
      var areaSft = q.sft;

      var tierCard = '<h3>Finish & Price Variant Comparison (' + esc(mDef.label) + ' — ' + f2(areaSft) + ' sft)</h3>'
        + '<table class="qtable"><thead><tr><th>Variant Tier</th><th class="n">Rate ₹/sft</th><th class="n">Estimated Total ₹</th><th>Model Description</th></tr></thead><tbody>';

      tiers.forEach(function (tr) {
        var r = mDef.rates[tr] || 0;
        var est = Math.round(areaSft * r);
        tierCard += '<tr><td><b>' + esc(tr) + '</b></td><td class="n">₹ ' + r + '</td><td class="n"><b>₹ ' + est.toLocaleString("en-IN") + '</b></td><td><span class="model-badge" style="margin-left:0">' + esc(mDef.description) + '</span></td></tr>';
      });
      tierCard += '</tbody></table>';
      p.innerHTML += tierCard;
    }

    $all("[data-mrate]", p).forEach(function (i) {
      i.addEventListener("change", function () { lam(i.dataset.mrate).rate = num(i.value, 0); renderQuote(); save(); });
    });
    $all("[data-hrate]", p).forEach(function (i) {
      i.addEventListener("change", function () {
        var k = i.dataset.hrate;
        if (k.indexOf("h_") === 0) H(k.slice(2)).rate = num(i.value, 0);
        else if (HARDWARE[k]) HARDWARE[k].rate = num(i.value, 0);
        renderQuote(); save();
      });
    });
    $all("[data-jrate]", p).forEach(function (i) {
      i.addEventListener("change", function () { RATES[i.dataset.jrate] = num(i.value, 0); renderQuote(); renderSheet(); save(); });
    });
    var m = $("#q_margin");
    if (m) m.addEventListener("change", function () { RATES.margin = num(m.value, 0); renderQuote(); save(); });
  }

  /* ═══════════════════════════════════════════════════════════════
     IMPORT — read a factory process sheet (PDF / CSV / pasted rows)
     and rebuild the job from it. Imported units carry their own
     explicit rows and flow through nesting, drilling, quote and the
     savings report exactly like designed ones.
     ═══════════════════════════════════════════════════════════════ */
  var COLRE = /((?:MDF|HDHMR|HDF|PLY|BWP|WPC|PLB|LAM|MR)\s*[\w\-\.]+(?:\/[\w\-\.]+)*)/i;
  var PANELRE = new RegExp('^(?:(\\d{1,3})\\s+)?(\\d{2,4})\\s+(\\d{2,4})\\s+(\\d{1,3})\\s+(.+?)\\s+' + COLRE.source + '(?:\\s+(\\d+\\.\\d{2}))?(?:\\s+[\\d.]+)*$', 'i');
  var PANELNOCOL = /^(\d{2,4})\s+(\d{2,4})\s+(\d{1,3})\s+([A-Za-z][^\d]*?)\s*$/;
  var DESIGNRE = /\b(\d+"\s*IBH|IBH\s*\d+"|G\s*Profile|J\s*Profile|Gola(?:\s*Profile)?|Bar\s*\d+|Knob|Cup\s*Pull)\b/i;
  var DIMRE = /^H\s*(\d{3,4})\s*X\s*W\s*(\d{3,4})\s*X\s*D\s*(\d{3,4})$/i;
  var STOP = /^(process sheet|jobwork|no packing|total|frames|cutting|colour board|dealer|place|customer|proc by|order no|date|sticker|white|sft|rate|amount|remarks|design|height|width|qty|s\.?no|colour|e\/b|e\/b ft|provided party|req|sheets)/i;

  function importLines(lines, src) {
    var units = [], cur = null, boards = [], charges = {}, frames = null, head = {}, warn = [], count = 0, lastCol = null;
    function unit(label) { cur = { label: label, dims: null, rows: [] }; units.push(cur); return cur; }
    lines.forEach(function (raw) {
      var L = String(raw).replace(/\s+/g, " ").trim();
      if (!L) return;
      var m;
      /* header fields (pdf.js often merges left and right boxes on one line) */
      if ((m = L.match(/Dealer Name:\s*(.+?)(?=\s+Proc By:|$)/i))) head.dealer = m[1].trim();
      if ((m = L.match(/Proc By:\s*(.+?)$/i))) head.proc = m[1].trim();
      if ((m = L.match(/Place\s*:\s*(.+?)(?=\s+Order No:|$)/i))) head.place = m[1].trim();
      if ((m = L.match(/Order No:\s*(\S+)/i))) head.order = m[1];
      if ((m = L.match(/Dealer Order No:\s*(.*?)(?=\s+Date|$)/i))) head.dorder = m[1].trim();
      if ((m = L.match(/Date\s*:\s*(\S+)/i))) head.date = m[1];
      if ((m = L.match(/Customer Name\s*:\s*(.+?)$/i))) head.cust = m[1].trim();
      if ((m = L.match(/Sticker Name\s*:\s*"?\s*(.+?)\s*"?$/i))) head.sticker = m[1].trim();
      if (/Dealer Name:|Customer Name|Proc By:|Order No:|Sticker Name/i.test(L)) return;

      if ((m = L.match(/^2440\s+1220\s+(\d+)\s+Colour Board.*?((?:MDF|HDHMR)\s*[\w\/]+)\s+([\d.]+)/i))) {
        boards.push({ sheets: +m[1], col: normCol(m[2]), sft: +m[3] }); return;
      }
      if ((m = L.match(/^Cutting\s+(\d+)\s+(\d+\.\d{2})\s+(\d+\.\d{2})/i))) { charges.cut = { qty: +m[1], rate: +m[2], amt: +m[3] }; return; }
      if ((m = L.match(/^[\d.]*\s*mm\s*E\/?b\s+(\d+)\s+(\d+\.\d{2})\s+(\d+\.\d{2})/i))) { charges.eb = { qty: +m[1], rate: +m[2], amt: +m[3] }; return; }
      if ((m = L.match(/^(\d+)"\s*IBH\s+(\d+)\s+(\d+\.\d{2})\s+(\d+\.\d{2})/i))) { charges["ibh" + m[1]] = { qty: +m[2], rate: +m[3], amt: +m[4] }; return; }
      if ((m = L.match(/^(?:\d+\s+)?(\d{3,4})\s+(\d{2,3})\s+(\d+)\s+Frames\s+(\w+)\s+([\d.]+)\s+([\d.]+)\s+([\d.]+)/i))) {
        frames = { h: +m[1], w: +m[2], q: +m[3], col: m[4], sft: +m[5], rate: +m[6], amt: +m[7] }; return;
      }
      if ((m = L.match(DIMRE))) {
        var dims = { H: +m[1], W: +m[2], D: +m[3] };
        if (!cur || (cur.rows.length && cur.dims)) unit("H" + dims.H + " W" + dims.W);
        cur.dims = dims; return;
      }
      var pr = parsePanelLine(L, lastCol);
      if (pr) {
        if (!cur) unit("UNIT");
        cur.rows.push(pr); lastCol = pr.col; count++;
        if (pr.guessed) warn.push("no colour on: " + L + " — used previous row's colour");
        return;
      }
      var hm = L.match(/^(?:unit|room|area)\s*[:\-]\s*(.+)$/i);
      if (hm) { unit(hm[1].trim()); return; }
      if (/^[A-Za-z][A-Za-z0-9 &\-\.\/]{0,30}$/.test(L) && L.split(" ").length <= 4 && !STOP.test(L) && !/job work|charges|details|laminate|plywood|packing|sheet/i.test(L)) {
        unit(L); return;
      }
    });
    return { units: units, boards: boards, charges: charges, frames: frames, head: head, warn: warn, count: count, src: src || "upload" };
  }
  function normCol(s) { return String(s).replace(/\s+/g, " ").replace(/^(mdf|hdhmr|hdf)\s*/i, function (x) { return x.trim().toUpperCase() + " "; }).trim(); }

  /* make sure every colour code on the sheet exists in the library —
     "MDF 3410/3411" borrows the look of MDF 3410 if we know it */
  function ensureLaminate(code) {
    if (LAMINATES.some(function (l) { return l.code === code; })) return;
    var parts = code.split("/"), base = null, prefix = (code.match(/^[A-Z]+/) || [""])[0];
    parts.forEach(function (p) {
      if (base) return;
      var cand = /^[A-Z]/.test(p) ? p : (prefix + " " + p).trim();
      base = LAMINATES.filter(function (l) { return l.code === cand; })[0] || null;
    });
    if (base) LAMINATES.push({ code: code, name: base.name + " (as sheet)", hex: base.hex, kind: base.kind, rate: base.rate, imported: true });
    else {
      var pal = ["#D9D3C4", "#8E6A4A", "#5E4A3A", "#B3A48E", "#6E7275", "#C9B48D"];
      LAMINATES.push({ code: code, name: code, hex: pal[hashStr(code) % pal.length], kind: "solid", rate: 52, imported: true });
    }
  }
  function mode(arr) { var c = {}, best = null; arr.forEach(function (v) { c[v] = (c[v] || 0) + 1; if (best === null || c[v] > c[best]) best = v; }); return best; }
  function makeImportedUnit(g) {
    g.rows.forEach(function (r) { ensureLaminate(r.col); });
    var fronts = g.rows.filter(function (r) { return /Shutter|Facia/i.test(r.r); });
    var others = g.rows.filter(function (r) { return !/Shutter|Facia/i.test(r.r); });
    var sumW = 0, maxH = 300;
    fronts.forEach(function (r) { sumW += r.w * r.q; if (r.h > maxH) maxH = r.h; });
    var side = g.rows.filter(function (r) { return /^(Left|Right) Panel/i.test(r.r); })[0];
    var u = newUnit(g.label);
    u.kind = "imported"; u.rows = g.rows; u.shape = "straight"; u.loft = false; u.handle = "none";
    u.H = g.dims ? g.dims.H : maxH;
    u.W = g.dims ? g.dims.W : Math.min(3000, Math.max(600, sumW));
    u.D = g.dims ? g.dims.D : (side ? side.w : 550);
    u.shutterCol = fronts.length ? mode(fronts.map(function (r) { return r.col; })) : mode(g.rows.map(function (r) { return r.col; }));
    u.carcass = others.length ? mode(others.map(function (r) { return r.col; })) : u.shutterCol;
    var hasHinged = fronts.some(function (r) { return /^Shutter$/i.test(r.r); });
    var hasSliding = fronts.some(function (r) { return /Sliding/i.test(r.r); });
    u.type = hasSliding && !hasHinged ? "sliding" : "hinged";
    var facia = g.rows.filter(function (r) { return /Facia/i.test(r.r); });
    u.drawers = facia.reduce(function (s, r) { return s + r.q; }, 0);
    u.drawerH = facia.length ? facia[0].h : 180;
    u.shutters = fronts.reduce(function (s, r) { return s + (/^Shutter$/i.test(r.r) ? r.q : 0); }, 0) || 1;
    u.sections = 1;
    return u;
  }
  function applyImport(res) {
    var units = res.units.filter(function (g) { return g.rows.length; }).map(makeImportedUnit);
    if (!units.length) return false;
    S.units = units; S.active = 0;
    S.imported = { boards: res.boards, charges: res.charges, frames: res.frames, src: res.src, count: res.count, at: Date.now() };
    Object.keys(res.head || {}).forEach(function (k) { if (res.head[k]) S.head[k] = res.head[k]; });
    if (res.charges.cut) RATES.cut = res.charges.cut.rate;
    if (res.charges.eb) RATES.eb = res.charges.eb.rate;
    if (res.frames) S.frames = { h: res.frames.h, w: res.frames.w, q: res.frames.q, col: res.frames.col, rate: res.frames.rate };
    ["dealer", "place", "dorder", "cust", "proc", "order", "date", "sticker"].forEach(function (k) {
      var i = $("#f_" + k); if (i) { i.value = S.head[k] || ""; autosize(i); }
    });
    return true;
  }

  /* Tolerant panel-row reader. Handles the clean reference format and
     messy ones: "Shutter 1000 x 520 x 2", "910X500 qty 2 MDF 3410",
     tab/comma separated, mm suffixes, missing serial numbers, missing
     colour (borrows the previous row's). Anything it guessed is flagged
     so the review step can show it. */
  function parsePanelLine(L, prevCol) {
    var N = String(L).replace(/\b(\d+)\s*mm\b/gi, "$1").replace(/(\d)\s*[x×X\*]\s*(\d)/g, "$1 $2")
      .replace(/[,;|\t]+/g, " ").replace(/\s+/g, " ").trim();
    if (!N || /total|\brate\b|amount|cutting|e\/b|charges|details|frames|colour board/i.test(N)) return null;
    var m = N.match(PANELRE);
    if (m) return build(m[2], m[3], m[4], m[5], normCol(m[6]), false);
    var cm = N.match(COLRE), col = cm ? normCol(cm[1]) : null;
    var rest = cm ? N.replace(cm[0], " ") : N;
    var dsg = "", dm0 = rest.match(DESIGNRE);
    if (dm0) { dsg = dm0[1].replace(/\s+/g, " "); rest = rest.replace(dm0[0], " "); }
    var nums = [], words = [];
    rest.split(" ").forEach(function (t) { if (!t) return; if (/^\d+(\.\d+)?$/.test(t)) nums.push(parseFloat(t)); else words.push(t); });
    var dims = nums.filter(function (v) { return v >= 20 && v <= 4000 && v === Math.floor(v); });
    if (dims.length < 2) return null;
    var q = 1, i2 = nums.indexOf(dims[1]);
    var after = nums.slice(i2 + 1).filter(function (v) { return v >= 1 && v <= 99 && v === Math.floor(v); });
    if (after.length) q = after[0];
    var rem = words.join(" ").replace(/\b(qty|nos|pcs|no\.?)\b/gi, " ").replace(/\s+/g, " ").trim();
    if (!rem && !col) return null;
    var out = build(dims[0], dims[1], q, rem || "Panel", col || prevCol || "MDF 1135", !col);
    if (dsg && !out.d) out.d = dsg;
    return out;
    function build(h, w, q, remD, col, guessed) {
      var rem = String(remD).replace(/\bLetf\b/i, "Left").replace(/^\d{1,3}\s+/, "").trim(), des = "", dm = rem.match(DESIGNRE);
      if (dm) { des = dm[1].replace(/\s+/g, " "); rem = rem.replace(dm[0], "").replace(/\s+/g, " ").trim(); }
      return { h: +h, w: +w, q: +q, r: rem || "Panel", d: des, col: col, guessed: guessed };
    }
  }

  /* ── review table: every parsed row is editable before it becomes the job ── */
  var pendingImport = null;
  function showReview(res, name) {
    pendingImport = { res: res, name: name };
    var w = $("#upReview"); if (!w) return;
    var h = '<div class="rv-h"><b>' + esc(name) + '</b> — ' + res.count + ' panel rows in ' + res.units.length + ' unit' + (res.units.length === 1 ? "" : "s") + '. Check anything highlighted, edit inline, then apply.</div>';
    res.units.forEach(function (g, ui) {
      if (!g.rows.length) return;
      h += '<div class="rv-unit"><input class="rv-label" data-u="' + ui + '" value="' + esc(g.label) + '">' +
        (g.dims ? '<span class="rv-dims">H' + g.dims.H + ' × W' + g.dims.W + ' × D' + g.dims.D + '</span>' : '<span class="rv-dims">size inferred from panels</span>') + '</div>';
      h += '<table class="rv-table"><thead><tr><th>Height</th><th>Width</th><th>Qty</th><th>Remarks</th><th>Design</th><th>Colour</th><th></th></tr></thead><tbody>';
      g.rows.forEach(function (r, ri) {
        var flag = r.guessed ? ' class="rv-guess"' : '';
        h += '<tr data-u="' + ui + '" data-r="' + ri + '"' + flag + '>' +
          '<td><input type="number" value="' + r.h + '" data-k="h"></td><td><input type="number" value="' + r.w + '" data-k="w"></td>' +
          '<td><input type="number" value="' + r.q + '" data-k="q"></td><td><input value="' + esc(r.r) + '" data-k="r"></td>' +
          '<td><input value="' + esc(r.d || "") + '" data-k="d"></td><td><input value="' + esc(r.col) + '" data-k="col"' + (r.guessed ? ' title="colour borrowed from the row above"' : '') + '></td>' +
          '<td><button class="rv-del" title="remove row">×</button></td></tr>';
      });
      h += '</tbody></table>';
    });
    if (res.warn.length) h += '<div class="rv-warn">' + res.warn.slice(0, 12).map(function (x) { return "! " + esc(x); }).join("<br>") + (res.warn.length > 12 ? "<br>… " + (res.warn.length - 12) + " more" : "") + '</div>';
    h += '<div class="uprow"><button class="btn primary" id="rvApply">Apply this job</button><button class="btn" id="rvDiscard">Discard</button></div>';
    w.innerHTML = h; w.hidden = false;
    $all(".rv-del", w).forEach(function (b) { b.addEventListener("click", function () { var tr = b.closest("tr"); tr.remove(); }); });
    $("#rvApply").addEventListener("click", function () {
      var r2 = { units: [], boards: res.boards, charges: res.charges, frames: res.frames, head: res.head, warn: [], count: 0, src: res.src };
      res.units.forEach(function (g, ui) {
        var lab = $('.rv-label[data-u="' + ui + '"]', w), rows = [];
        $all('tr[data-u="' + ui + '"]', w).forEach(function (tr) {
          var o = {}; $all("input", tr).forEach(function (i) { o[i.dataset.k] = i.dataset.k === "r" || i.dataset.k === "d" || i.dataset.k === "col" ? i.value.trim() : num(i.value, 0); });
          if (o.h > 0 && o.w > 0 && o.q > 0) { o.col = normCol(o.col || "MDF 1135"); rows.push(o); r2.count += o.q; }
        });
        r2.units.push({ label: lab ? lab.value.trim() || g.label : g.label, dims: g.dims, rows: rows });
      });
      w.hidden = true; pendingImport = null;
      finishImport(r2, name);
    });
    $("#rvDiscard").addEventListener("click", function () { w.hidden = true; pendingImport = null; upStatus("Discarded."); });
    w.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  /* ══════════ PDF / FILE READING ══════════ */
  function loadPdfJs(cb) {
    if (window.pdfjsLib) { cb(); return; }
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js";
    s.onload = function () {
      try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js"; } catch (e) { }
      cb();
    };
    s.onerror = function () { upStatus("Could not load the PDF reader here — paste the rows or use CSV."); };
    document.head.appendChild(s);
  }
  function pdfToLines(buf, done) {
    window.pdfjsLib.getDocument({ data: buf }).promise.then(function (pdf) {
      var lines = [], p = 1;
      function next() {
        if (p > pdf.numPages) { done(lines); return; }
        pdf.getPage(p).then(function (page) { return page.getTextContent(); }).then(function (tc) {
          var rows = {};
          tc.items.forEach(function (it) {
            if (!it.str || !it.str.trim()) return;
            var y = Math.round(it.transform[5] / 4) * 4;
            (rows[y] = rows[y] || []).push({ x: it.transform[4], s: it.str });
          });
          Object.keys(rows).map(Number).sort(function (a, b) { return b - a; }).forEach(function (y) {
            lines.push(rows[y].sort(function (a, b) { return a.x - b.x; }).map(function (i) { return i.s; }).join(" "));
          });
          p++; next();
        }).catch(function (e) { done(lines, e); });
      }
      next();
    }).catch(function (e) { done([], e); });
  }
  function upStatus(m) { var s = $("#upStatus"); if (s) s.textContent = m; }
  function upLog(res, name) {
    var l = $("#upLog"); if (!l) return;
    var o = ["<b>" + esc(name) + "</b> — " + res.count + " panel rows in " + res.units.length + " unit" + (res.units.length === 1 ? "" : "s")];
    res.units.forEach(function (g) { o.push("  " + esc(g.label) + (g.dims ? "  H" + g.dims.H + " W" + g.dims.W + " D" + g.dims.D : "") + "  ·  " + g.rows.length + " rows"); });
    if (res.boards.length) o.push("boards ordered: " + res.boards.map(function (b) { return b.sheets + " × " + b.col; }).join(", "));
    if (res.charges.cut) o.push("cutting " + res.charges.cut.qty + " ft @ " + res.charges.cut.rate + "   E/b " + (res.charges.eb ? res.charges.eb.qty + " ft @ " + res.charges.eb.rate : "—"));
    res.warn.forEach(function (w) { o.push("<i>! " + esc(w) + "</i>"); });
    l.innerHTML = o.join("\n");
  }
  function finishImport(res, name) {
    if (!applyImport(res)) { upStatus("No panel rows recognised — check the format."); upLog(res, name); return; }
    upLog(res, name);
    upStatus("Imported " + res.count + " rows.");
    renderRail(); renderAll();
    toast("Job replaced from " + name);
    setView("report");
  }
  function handleFile(f) {
    if (!f) return;
    upStatus("Reading " + f.name + " …");
    if (/\.pdf$/i.test(f.name)) {
      loadPdfJs(function () {
        f.arrayBuffer().then(function (buf) {
          pdfToLines(buf, function (lines, err) {
            if (err && !lines.length) { upStatus("Could not read that PDF — paste the rows instead."); return; }
            var res = importLines(lines, f.name);
            upLog(res, f.name); upStatus(res.count ? "Read " + res.count + " rows — review below." : "No panel rows recognised — check the format.");
            if (res.count) showReview(res, f.name);
          });
        });
      });
    } else {
      f.text().then(function (t) {
        var res = importLines(csvToLines(t), f.name);
        upLog(res, f.name); upStatus(res.count ? "Read " + res.count + " rows — review below." : "No panel rows recognised — check the format.");
        if (res.count) showReview(res, f.name);
      });
    }
  }
  function csvToLines(t) {
    return t.split(/\r?\n/).map(function (l) {
      var c = l.split(/,|\t|;/).map(function (x) { return x.replace(/^"|"$/g, "").trim(); });
      if (c.length >= 5 && /^\d+$/.test(c[0]) && /^\d+$/.test(c[1]) && /^\d+$/.test(c[2])) return c.slice(0, 3).join(" ") + " " + c[3] + " " + c.slice(4).join(" ");
      return c.join(" ");
    });
  }

  /* sample job — the dimensions of a real three-unit process sheet,
     names removed, in the exact text the PDF reader produces */
  var SAMPLE_LINES = ("Process Sheet|Dealer Name: Sample Dealer Proc By: —|Place : — Order No: SAMPLE-01|Customer Name : Sample customer|Kitchen|" +
    "1 1000 520 1 Shutter MDF 1135 5.60|2 1000 520 1 Shutter MDF 1135 5.60|3 1000 400 1 Shutter MDF 1135 4.30|4 1000 400 1 Shutter MDF 1135 4.30|5 1000 390 1 Shutter MDF 1135 4.20|6 1000 485 1 Shutter MDF 1135 5.22|7 1000 486 1 Shutter MDF 1135 5.23|8 1000 507 1 Shutter MDF 1135 5.46|9 1000 506 1 Shutter MDF 1135 5.44|10 2400 100 2 Dummy MDF 1135 5.16|11 625 463 1 Shutter MDF 1135 3.11|12 625 463 1 Shutter MDF 1135 3.11|13 625 438 1 Shutter MDF 1135 2.95|14 625 438 1 Shutter MDF 1135 2.95|15 825 592 1 Shutter MDF 1135 5.26|16 825 440 1 Shutter MDF 1135 3.91|17 825 440 1 Shutter MDF 1135 3.91|18 590 85 1 Dummy MDF 1135 0.54|19 390 20 1 Dummy MDF 1135 0.08|20 1990 425 1 Dummy MDF 1135 9.10|21 710 316 1 Shutter MDF 1135 2.41|22 710 315 1 Shutter MDF 1135 2.41|23 710 403 1 Shutter MDF 1135 3.08|24 710 403 1 Shutter MDF 1135 3.08|25 176 625 1 Draw Facia MDF 1135 1.18|26 176 625 1 Draw Facia MDF 1135 1.18|27 352 625 1 Draw Facia MDF 1135 2.37|28 820 538 1 Dummy MDF 1135 4.75|29 725 330 1 Shutter MDF 1135 2.57|30 725 330 1 Shutter MDF 1135 2.57|31 690 580 1 Shutter MDF 1135 4.31|32 690 388 1 Shutter MDF 1135 2.88|33 690 388 1 Shutter MDF 1135 2.88|34 710 100 1 Dummy MDF 1135 0.76|MBR|" +
    "35 775 535 1 Shutter MDF 3410/3411 4.46|36 775 551 1 Shutter MDF 3410/3411 4.59|37 775 551 1 Shutter MDF 3410/3411 4.59|38 775 568 1 Shutter MDF 3410/3411 4.74|39 775 568 1 Shutter MDF 3410/3411 4.74|40 775 514 1 Shutter MDF 3410/3411 4.29|41 775 514 1 Shutter MDF 3410/3411 4.29|42 775 525 1 Shutter MDF 3410/3411 4.38|43 775 525 1 Shutter MDF 3410/3411 4.38|44 775 95 1 Dummy MDF 3410/3411 0.79|45 775 95 1 Dummy MDF 3410/3411 0.79|46 1795 800 1 Sliding Shutter 10\" IBH MDF 3410/3411 15.45|47 1795 800 1 Sliding Shutter 10\" IBH MDF 3410/3411 15.45|48 1900 65 2 Dummy MDF 3410/3411 2.66|49 1600 65 2 Dummy MDF 3410/3411 2.24|50 1900 100 2 Dummy MDF 3410/3411 4.09|51 1600 100 2 Dummy MDF 3410/3411 3.44|52 1830 310 1 Dummy MDF 3410/3411 6.10|53 1600 120 2 Dummy MDF 3410/3411 4.13|CBR|H910XW2400XD500|" +
    "910 500 1 Letf Panel MDF 3410/3411 4.90|910 500 1 Right Panel MDF 3410/3411 4.90|2366 500 1 Top panel MDF 3410/3411 12.73|2366 500 1 Bottom Panel MDF 3410/3411 12.73|876 2366 1 18mm Back Panel MDF 3410/3411 22.30|1166 397 2 ADJ Shelf MDF 3410/3411 9.96|876 397 2 VP MDF 3410/3411 7.48|846 1200 2 Sliding Shutter 8\" IBH MDF 3410/3411 21.85|830 564 4 Shutter MDF 3410/3411 20.15|830 500 1 Shutter MDF 3410/3411 4.47|830 120 1 Dummy MDF 3410/3411 1.07|2400 75 2 Dummy MDF 3410/3411 3.87|910 75 2 Dummy MDF 3410/3411 1.47|" +
    "55 2400 65 10 Frames White 16.79 275.00 2750.00|JOB WORK CHARGES|Cutting 802 3.50 2807.00|2mm E/b 802 20.00 16040.00|8\" IBH 2 295.00 590.00|10\" IBH 2 320.00 640.00|JOB WORK Details|2440 1220 9 Colour Board Provided Party MDF 3410/3411 288.00 0.00 0.00|2440 1220 5 Colour Board Provided Party MDF 1135 160.00 0.00 0.00").split("|");
  function loadSample() { finishImport(importLines(SAMPLE_LINES, "sample job"), "sample job"); }

  /* ══════════ SAVINGS REPORT ══════════ */
  function savingsData() {
    var n = nest(), imp = S.imported, t = allTotals();
    var perCol = {};
    n.groups.forEach(function (g) { perCol[g.col] = { need: g.sheets.length, ordered: null, rate: lam(g.col).rate || 0 }; });
    var orderedTotal = 0, basis = "";
    if (imp && imp.boards && imp.boards.length) {
      imp.boards.forEach(function (b) {
        var k = perCol[b.col] ? b.col : Object.keys(perCol).filter(function (c) { return c.indexOf(b.col) === 0 || b.col.indexOf(c) === 0; })[0];
        if (k) { perCol[k].ordered = (perCol[k].ordered || 0) + b.sheets; orderedTotal += b.sheets; }
        else { orderedTotal += b.sheets; }
      });
      basis = "the board list on your sheet";
    } else {
      Object.keys(perCol).forEach(function (c) {
        var a = 0; n.groups.forEach(function (g) { if (g.col === c) a = g.area / 92903; });
        perCol[c].ordered = Math.ceil(a * 1.3 / n.sheetSft); orderedTotal += perCol[c].ordered;
      });
      basis = "a typical 30% cutting allowance";
    }
    var boardSave = 0, boardOrderedCost = 0, boardNeedCost = 0;
    Object.keys(perCol).forEach(function (c) {
      var p = perCol[c], sheetCost = n.sheetSft * p.rate;
      if (p.ordered != null) { boardOrderedCost += p.ordered * sheetCost; boardSave += Math.max(0, p.ordered - p.need) * sheetCost; }
      boardNeedCost += p.need * sheetCost;
    });
    var ebYour = imp && imp.charges && imp.charges.eb ? imp.charges.eb.qty : null;
    var ebOurs = Math.round(t.ebRft), cutOurs = Math.round(t.cutRft);
    var ebSave = ebYour != null ? Math.max(0, (ebYour - ebOurs)) * RATES.eb : 0;
    var offcutSft = n.sheets * n.sheetSft - n.sft;
    var offcutVal = 0; n.groups.forEach(function (g) { offcutVal += (g.sheets.length * n.sheetSft - g.area / 92903) * (lam(g.col).rate || 0); });
    var base = boardOrderedCost + (imp && imp.charges && imp.charges.eb ? imp.charges.eb.amt : ebOurs * RATES.eb) + (imp && imp.charges && imp.charges.cut ? imp.charges.cut.amt : cutOurs * RATES.cut);
    var save = boardSave + ebSave;
    return {
      n: n, t: t, perCol: perCol, orderedTotal: orderedTotal, basis: basis, boardSave: boardSave, ebYour: ebYour, ebOurs: ebOurs, cutOurs: cutOurs,
      ebSave: ebSave, offcutSft: offcutSft, offcutVal: offcutVal, save: save, pct: base ? save / base * 100 : 0, base: base
    };
  }
  function renderReport() {
    var p = $("#reportPaper"); if (!p) return;
    if (!nestCache) { p.innerHTML = '<div class="r-h"><h2>Savings report</h2><span>optimising sheets…</span></div>'; setTimeout(function () { nest(); renderReport(); }, 30); return; }
    var d = savingsData(), n = d.n, hw = hardwareCounts();
    var inr = function (v) { return "₹ " + Math.round(v).toLocaleString("en-IN"); };
    var h = '<div class="r-h"><h2>Savings report</h2><span>' + esc(S.head.cust || "Customer") + ' · ' + esc(S.head.order || "") + ' · ' + esc(S.head.date || "") + ' · ' + S.units.length + ' unit' + (S.units.length === 1 ? "" : "s") + ' · ' + d.t.qty + ' panels · ' + f2(n.sft) + ' sft</span></div>';
    h += '<div class="r-big">';
    h += '<div><b class="save">' + inr(d.save) + '</b><span>cost reduced' + (d.pct ? ' — ' + d.pct.toFixed(1) + '% of boards + jobwork' : '') + '</span></div>';
    h += '<div><b>' + d.orderedTotal + ' → ' + n.sheets + '</b><span>boards: ' + esc(d.basis) + ' → nested</span></div>';
    h += '<div><b>' + Math.round(n.util * 100) + '%</b><span>board yield after nesting</span></div>';
    h += '<div><b>' + f2(d.offcutSft) + ' sft</b><span>offcut left on your racks — worth ' + inr(d.offcutVal) + '</span></div>';
    h += '</div>';

    h += '<h3>Boards — what to order</h3><table class="qtable"><thead><tr><th>Colour</th><th class="n">Ordered</th><th class="n">Needed</th><th class="n">Saved</th><th class="n">Sheet ₹</th><th class="n">Saving ₹</th></tr></thead><tbody>';
    Object.keys(d.perCol).forEach(function (c) {
      var pc = d.perCol[c], sc = n.sheetSft * pc.rate, sv = pc.ordered != null ? Math.max(0, pc.ordered - pc.need) : 0;
      h += '<tr><td>' + esc(c) + '</td><td class="n">' + (pc.ordered != null ? pc.ordered : "—") + '</td><td class="n">' + pc.need + '</td><td class="n">' + sv + '</td><td class="n">' + f2(sc) + '</td><td class="n">' + f2(sv * sc) + '</td></tr>';
    });
    h += '<tr class="sub"><td>Total</td><td class="n">' + d.orderedTotal + '</td><td class="n">' + n.sheets + '</td><td class="n">' + Math.max(0, d.orderedTotal - n.sheets) + '</td><td></td><td class="n">' + f2(d.boardSave) + '</td></tr></tbody></table>';
    if (d.orderedTotal && d.orderedTotal < n.sheets) h += '<p class="r-note"><b>Note:</b> your sheet ordered fewer boards than this job can be cut from at ' + Math.round(n.util * 100) + '% yield. Either some panels were cut from stock offcuts, or the job would have run short — the nested figure is the safe order.</p>';

    h += '<h3>Edge banding &amp; cutting</h3><table class="qtable"><thead><tr><th>Item</th><th class="n">Your sheet</th><th class="n">Measured</th><th class="n">Rate ₹</th><th class="n">Saving ₹</th></tr></thead><tbody>';
    h += '<tr><td>' + esc(RATES.ebSize) + ' edge banding (ft)</td><td class="n">' + (d.ebYour != null ? d.ebYour : "—") + '</td><td class="n">' + d.ebOurs + '</td><td class="n">' + f2(RATES.eb) + '</td><td class="n">' + f2(d.ebSave) + '</td></tr>';
    h += '<tr><td>Cutting (ft)</td><td class="n">' + (S.imported && S.imported.charges.cut ? S.imported.charges.cut.qty : "—") + '</td><td class="n">' + d.cutOurs + '</td><td class="n">' + f2(RATES.cut) + '</td><td class="n">—</td></tr>';
    h += '</tbody></table>';

    /* the plan */
    h += '<h3>The plan — in order</h3><ol class="r-steps">';
    var orderLines = Object.keys(d.perCol).map(function (c) { return d.perCol[c].need + " × " + c; }).join(", ");
    h += '<li><b>Order boards.</b> ' + esc(orderLines) + ' — all 2440 × 1220 × 18 mm. Nothing else; the offcut of ' + f2(d.offcutSft) + ' sft stays with the job.</li>';
    var si = 0;
    n.groups.forEach(function (g) {
      g.sheets.forEach(function (sh) {
        si++;
        var parts = {}; sh.parts.forEach(function (pt) { var k = pt.label + " " + Math.round(pt.rot ? pt.w : pt.h) + "×" + Math.round(pt.rot ? pt.h : pt.w); parts[k] = (parts[k] || 0) + 1; });
        var keys = Object.keys(parts), show = keys.slice(0, 6).map(function (k) { return (parts[k] > 1 ? parts[k] + "× " : "") + k; }).join("; ");
        h += '<li><b>Cut sheet ' + si + ' (' + esc(g.col) + ', ' + (g.grain ? "grain along the length" : "either way") + '):</b> <span class="mono">' + esc(show) + (keys.length > 6 ? "; +" + (keys.length - 6) + " more" : "") + '</span> — the Nesting tab shows the exact positions; every cut is a full edge-to-edge pass.</li>';
      });
    });
    h += '<li><b>Edge band ' + d.ebOurs + ' ft</b> of ' + esc(RATES.ebSize) + ' tape. ' + (RATES.ebMode === "all" ? "All four edges on every panel, as on your sheet." : "Shutters and facias on all four edges; carcass panels, shelves and partitions on the front edge only.") + '</li>';
    var cupPanels = 0; S.units.forEach(function (u) { panelsFor(u).forEach(function (r) { if (/^Shutter$|^Loft Shutter/.test(r.r)) cupPanels += r.q; }); });
    h += '<li><b>Bore.</b> ' + hw.hinge + ' hinge cups Ø35 on ' + cupPanels + ' shutters (22.5 mm from the hinge edge); System 32 pin rows Ø5 on every side panel and partition; runner fixings for ' + hw.runner + ' drawer' + (hw.runner === 1 ? "" : "s") + '. Each panel’s pattern is on the Panels &amp; drilling tab and on the DRILL layer of the DXF.</li>';
    S.units.forEach(function (u) {
      var rows = panelsFor(u), c = function (re) { return rows.filter(function (r) { return re.test(r.r); }).reduce(function (s, r) { return s + r.q; }, 0); };
      h += '<li><b>Assemble ' + esc(u.label || "unit") + '</b> (H' + u.H + ' × W' + u.W + ' × D' + u.D + '): sides, top and bottom first (' + c(/Panel$|Top panel/i) + ' panels), then ' + c(/VP/) + ' partition' + (c(/VP/) === 1 ? "" : "s") + ' and ' + c(/Shelf/) + ' shel' + (c(/Shelf/) === 1 ? "f" : "ves") + ', back panel last; hang ' + c(/Shutter/) + ' front' + (c(/Shutter/) === 1 ? "" : "s") + ' and fit ' + c(/Facia/) + ' drawer facia' + (c(/Facia/) === 1 ? "" : "s") + '.</li>';
    });
    var hwl = []; if (hw.hinge) hwl.push(hw.hinge + " soft-close hinges"); if (hw.runner) hwl.push(hw.runner + " telescopic channel sets"); if (hw.rod) hwl.push(hw.rod + " hanging rails"); Object.keys(hw.handles).forEach(function (k) { var x = hw.handles[k]; hwl.push((x.h.unit === "rft" ? Math.round(x.q) + " ft" : x.q) + " × " + x.h.label); });
    if (hwl.length) h += '<li><b>Hardware to have on the bench:</b> ' + esc(hwl.join(", ")) + '. Priced on the Quote tab.</li>';
    h += '</ol>';
    h += '<div class="r-acts"><button class="btn primary" id="rpPrint">Print report</button><button class="btn" id="rpDxf">DXF — nested + drilling</button><button class="btn" id="rpNest">Open nesting</button></div>';
    h += '<p class="r-note">Sheet area = height × width ÷ 92903. Boards are 2440 × 1220 (32 sft) with a 4 mm saw kerf and no wastage allowance — the nested count already includes real cutting loss. Savings are against ' + esc(d.basis) + '. Rates are those on your sheet where present, otherwise the editable defaults on the Quote tab.</p>';
    p.innerHTML = h;
    $("#rpPrint").addEventListener("click", function () { setTimeout(function () { window.print(); }, 120); });
    $("#rpDxf").addEventListener("click", function () { deliver("nested-cnc.dxf", nestDXF()); });
    $("#rpNest").addEventListener("click", function () { setView("nest"); });
  }
  /* proof numbers on the front door, computed from the sample in isolation */
  function homeProof() {
    try {
      var keepL = LAMINATES.slice();
      var res = importLines(SAMPLE_LINES, "sample"), units = res.units.map(makeImportedUnit);
      var byCol = {}, total = 0, area = 0, used = 0, cnt = 0;
      units.forEach(function (u) { u.rows.forEach(function (r) { (byCol[r.col] = byCol[r.col] || []); for (var i = 0; i < r.q; i++) { splitToFit({ w: r.w, h: r.h, label: r.r, col: r.col, unit: u.label }, RATES.sheetW, RATES.sheetH).forEach(function (p) { byCol[r.col].push(p); }); } area += r.h * r.w * r.q; cnt += r.q; }); });
      Object.keys(byCol).forEach(function (c) {
        var sh = packSheets(byCol[c], RATES.sheetW, RATES.sheetH, RATES.kerf, function () { return !hasGrain(lam(c)); });
        total += sh.length; sh.forEach(function (s) { used += s.used; });
      });
      $("#pf1").textContent = total; $("#pf2").textContent = Math.round(used / (total * RATES.sheetW * RATES.sheetH) * 100) + "%"; $("#pf3").textContent = cnt;
      LAMINATES.length = 0; keepL.forEach(function (l) { LAMINATES.push(l); });
    } catch (e) { }
  }

  /* ══════════ BOOT ══════════ */
  (function () {
    var t = el(null, $("#app")); t.id = "toast";
    t.setAttribute("role", "status"); t.setAttribute("aria-live", "polite");
  })();
  load();
  if (!S.head.date) {
    var dt = new Date();
    S.head.date = ("0" + dt.getDate()).slice(-2) + "-" + ("0" + (dt.getMonth() + 1)).slice(-2) + "-" + String(dt.getFullYear()).slice(-2);
  }
  function autosize(i) {
    if (!i.classList.contains("inl")) return;
    i.size = Math.max(12, (i.value || i.placeholder || "").length + 2);
  }
  ["dealer", "place", "dorder", "cust", "proc", "order", "date", "sticker", "supply"].forEach(function (k) {
    var i = $("#f_" + k); if (!i) return;
    i.value = S.head[k] || "";
    autosize(i);
    i.addEventListener("input", function () {
      S.head[k] = i.value; autosize(i); save();
      if (k === "cust" || k === "order") renderElev();
    });
  });
  window.__cc = { cam: cam, camApply: camApply, setView: setView, gl: GL, rooms: NEO_ROOMS, roomBuild: roomBuild, roomFinish: roomFinish, roomBrief: roomBrief, roomResize: roomResize, roomStats: roomStats, room: ROOM, finishes: NEO_FINISHES, tour: tour, spin: spin, handleFile: handleFile, applyPreset: applyPreset, presetsFor: presetsFor, layouts: sceneLayouts, unit: U, presetUnit: presetUnit, audit: auditPresets, pdfToLines: pdfToLines, importLines: importLines, thumbErrors: thumbErrors, thumbLog: thumbLog };
  /* present mode: rail hidden, slow turntable — for showing a customer */
  var presenting = false;
  (function () {
    var b = $("#presentBtn"); if (!b) return;
    function spin() { if (!presenting) return; cam.yaw += 0.18; camApply(); requestAnimationFrame(spin); }
    function syncHudPresent(on) {
      var hudP = $("#hudPresentBtn");
      if (hudP) {
        hudP.textContent = on ? "⛶ Exit present" : "⛶ Present";
        hudP.setAttribute("aria-pressed", String(on));
        hudP.classList.toggle("is-active", on);
      }
    }
    b.addEventListener("click", function () {
      presenting = !presenting;
      $("#view-design").classList.toggle("present", presenting);
      b.textContent = presenting ? "Exit present" : "Present";
      b.setAttribute("aria-pressed", String(presenting));
      syncHudPresent(presenting);
      setTimeout(function () { fit(); camApply(); if (presenting) spin(); }, 60);
    });
    stage.addEventListener("pointerdown", function () {
      if (presenting) {
        presenting = false;
        $("#view-design").classList.remove("present");
        b.textContent = "Present";
        b.setAttribute("aria-pressed", "false");
        syncHudPresent(false);
        setTimeout(function () { fit(); camApply(); }, 60);
      }
    }, true);
  })();
  /* three.js is fetched in the background: the page paints at once on the
     CSS fallback and upgrades to WebGL the moment the library lands */
  function loadThree(cb) {
    if (window.THREE) { cb(); return; }
    var s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js";
    s.async = true; s.onload = cb; s.onerror = function () { toast("3D library blocked — showing the basic preview"); };
    document.head.appendChild(s);
  }
  /* ══════════ EMBED MODE (Neo and other hosts) ══════════
     ?embed=1&room=<id>&theme=neo&tour=1  — only the 3D stage is shown, the page is driven
     through window.postMessage and reports back with {event:"ready"|"stats"}. */
  var PARAMS = new URLSearchParams(location.search);
  FX = PARAMS.get("fx") === "1" || PARAMS.get("theme") === "neo";
  /* post-processing lives in three's examples (UMD builds on jsdelivr); loaded in order, failures tolerated */
  function loadFX(cb) {
    var base = "https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/";
    var files = ["shaders/CopyShader.js", "postprocessing/Pass.js", "postprocessing/ShaderPass.js", "postprocessing/EffectComposer.js", "postprocessing/RenderPass.js", "math/SimplexNoise.js", "shaders/SSAOShader.js", "postprocessing/SSAOPass.js", "shaders/SMAAShader.js", "postprocessing/SMAAPass.js"];
    (function next(i) { if (i >= files.length) { cb(); return; } var s = document.createElement("script"); s.src = base + files[i]; s.onload = function () { next(i + 1); }; s.onerror = function () { next(i + 1); }; document.head.appendChild(s); })(0);
  }
  var tourOn = false, spinOn = false;
  function tour(on) {
    tourOn = on; if (!on) return;
    var keys = (ROOM.id && ROOM.walls)
      ? [{ yaw: -15, pitch: -8, zoom: 0.05 }, { yaw: -4, pitch: -3, zoom: 0.42 }, { yaw: 13, pitch: -11, zoom: 0.08 }, { yaw: 2, pitch: -1, zoom: 0.6 }, { yaw: -11, pitch: -15, zoom: -0.02 }]
      : ROOM.id
        ? [{ yaw: -40, pitch: -8, zoom: 0.05 }, { yaw: 25, pitch: -4, zoom: 0.3 }, { yaw: 150, pitch: -14, zoom: -0.05 }, { yaw: 225, pitch: -6, zoom: 0.2 }, { yaw: 320, pitch: -16, zoom: -0.1 }]
        : [{ yaw: -38, pitch: -9, zoom: -0.12 }, { yaw: -12, pitch: -4, zoom: 0.26 }, { yaw: 24, pitch: -13, zoom: -0.02 }, { yaw: 2, pitch: -3, zoom: 0.42 }, { yaw: -30, pitch: -16, zoom: -0.2 }];
    var i = 0, t0 = performance.now(), dur = 5200;
    (function step() {
      if (!tourOn) return;
      var p = Math.min(1, (performance.now() - t0) / dur), e = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2, a = keys[i], b = keys[(i + 1) % keys.length];
      cam.yaw = a.yaw + (b.yaw - a.yaw) * e; cam.pitch = a.pitch + (b.pitch - a.pitch) * e; cam.zoom = a.zoom + (b.zoom - a.zoom) * e; camApply();
      if (p >= 1) { i = (i + 1) % keys.length; t0 = performance.now(); }
      requestAnimationFrame(step);
    })();
  }
  function spin(on) { spinOn = on; if (!on) return; var t0 = performance.now(); (function step() { if (!spinOn) return; if (ROOM.id && ROOM.walls) { cam.yaw = 14 * Math.sin((performance.now() - t0) / 9000 * Math.PI * 2); } else cam.yaw += 0.12; camApply(); requestAnimationFrame(step); })(); }
  function postUp(msg) { try { (window.parent !== window ? window.parent : window).postMessage(Object.assign({ src: "cupboard-cad" }, msg), "*"); } catch (e) { } }
  function roomReport() { postUp({ event: "stats", stats: roomStats(), room: ROOM.id, finish: ROOM.finish || null, missing: ROOM.missing }); }
  if (PARAMS.get("embed") === "1") {
    EMBED = true; NEO = PARAMS.get("theme") === "neo"; ROOM.walls = PARAMS.get("walls") === "1"; ROOM.handles = PARAMS.get("handles") !== "0";
    document.body.classList.add("embed"); if (NEO) document.body.classList.add("neo");
    roomBuild(PARAMS.get("room") || "master");
    var stEl = $("#stage");
    Array.prototype.forEach.call(document.body.children, function (c) { c.style.display = "none"; });
    document.body.appendChild(stEl);
    stEl.style.cssText = "position:fixed;inset:0;display:block;" + (NEO ? "background:radial-gradient(120% 95% at 50% 14%, #F4F2ED 0%, #DDDAD3 52%, #C6C2BA 100%);" : "");
    window.addEventListener("message", function (ev) {
      var m = ev.data || {}; if (!m || typeof m !== "object" || !m.cmd) return;
      switch (m.cmd) {
        case "room": roomBuild(m.def || m.id); if (m.finish) roomFinish(m.finish); ROOM.finish = m.finish || null; buildScene(); fit(); camApply(); roomReport(); break;
        case "catalogue": postUp({ event: "catalogue", types: CTYPES.map(function (t) { return { id: t.id, label: t.label, styles: stylesFor(t.id).map(function (s) { return s.name; }), formats: formatsFor(t.id).map(function (f) { return f.label; }) }; }) }); break;
        case "extend": if (m.w) roomResize("w", m.w); if (m.d) roomResize("d", m.d); fit(); camApply(); roomReport(); break;
        case "brief": roomBrief(m.brief || m); buildScene(); cam.yaw = -32; cam.pitch = -16; cam.zoom = -0.04; fit(); camApply(); roomReport(); break;
        case "finish": roomFinish(m.id); buildScene(); fit(); camApply(); roomReport(); break;
        case "restyle": if (roomRestyle(m.index, m.style)) { if (ROOM.finish) roomFinish(ROOM.finish); buildScene(); fit(); camApply(); } roomReport(); break;
        case "units": (m.on || []).forEach(function (v, i) { if (ROOM.units[i]) ROOM.units[i].on = !!v; }); buildScene(); fit(); camApply(); roomReport(); break;
        case "doors": if (GL.ok) { var cur = GL.toggleAll(); if (typeof m.open === "boolean" && cur !== m.open) GL.toggleAll(); } break;
        case "explode": if (GL.ok) GL.explode(m.on !== false); break;
        case "assemble": if (GL.ok) GL.assemble(); break;
        case "tour": spin(false); tour(m.on !== false); break;
        case "spin": tour(false); spin(m.on !== false); break;
        case "camera": tour(false); spin(false); if (m.yaw != null) cam.yaw = m.yaw; if (m.pitch != null) cam.pitch = m.pitch; if (m.zoom != null) cam.zoom = m.zoom; camApply(); break;
        case "reset": tour(false); spin(false); if (GL.ok && GL.exploded) GL.explode(false); GL.clearSelect(); cam.yaw = ROOM.walls ? -12 : -30; cam.pitch = ROOM.walls ? -8 : -9; cam.zoom = 0.06; fit(); camApply(); break;
        case "deselect": if (GL.ok) GL.clearSelect(); break;
        case "stats": roomReport(); break;
      }
    });
    stEl.addEventListener("pointerdown", function () { tourOn = false; spinOn = false; }, true);
  }
  window.renderRail = renderRail;
  window.renderAll = renderAll;
  window.softAll = softAll;
  window.buildScene = buildScene;
  window.renderLegend = renderLegend;
  window.renderFoot = renderFoot;
  window.renderSheet = renderSheet;
  window.renderElev = renderElev;

  renderRail();
  renderAll();
  loadThree(function () {
    if (GL.init()) { fit(); buildScene(); }
    if (FX && GL.ok) loadFX(function () { if (GL.fxInit()) camApply(); });
    if (EMBED) {
      cam.yaw = ROOM.walls ? -12 : -30; cam.pitch = ROOM.walls ? -8 : -9; cam.zoom = 0.06; fit(); camApply();
      postUp({ event: "ready", rooms: NEO_ROOMS.map(function (r) { return { id: r.id, name: r.name, blurb: r.blurb, units: r.units.map(function (x) { return x.label; }) }; }), finishes: NEO_FINISHES.map(function (f) { return { id: f.id, name: f.name }; }) });
      roomReport();
      if (PARAMS.get("tour") === "1") tour(true); else if (PARAMS.get("spin") === "1") spin(true);
    }
  });
  $all("[data-go]").forEach(function (b) {
    b.addEventListener("click", function () {
      if (b.dataset.go === "kitchen") { galState.type = "kitchen"; setView("gallery"); return; }
      setView(b.dataset.go);
    });
  });
  ["trySample", "trySample2"].forEach(function (id) { var b = $("#" + id); if (b) b.addEventListener("click", loadSample); });
  (function () {
    var dz = $("#dropzone"), fi = $("#fileIn");
    if (!dz) return;
    $("#pickFile").addEventListener("click", function () { fi.click(); });
    fi.addEventListener("change", function () { handleFile(fi.files[0]); fi.value = ""; });
    ["dragenter", "dragover"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("over"); }); });
    ["dragleave", "drop"].forEach(function (ev) { dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("over"); }); });
    dz.addEventListener("drop", function (e) { if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]); });
    $("#importPaste").addEventListener("click", function () {
      var t = $("#pasteIn").value; if (!t.trim()) { upStatus("Paste some rows first."); return; }
      var res = importLines(t.split(/\r?\n/), "pasted rows");
      upLog(res, "pasted rows"); upStatus(res.count ? "Read " + res.count + " rows — review below." : "No panel rows recognised.");
      if (res.count) showReview(res, "pasted rows");
    });
  })();
  setTimeout(homeProof, 500);
  var initialView = (window.OrbixRouter && window.OrbixRouter.initialTargetView)
    ? window.OrbixRouter.initialTargetView
    : (S.units.some(function (u) { return u.kind === "imported"; }) ? "design" : "home");
  setView(initialView);
  window.addEventListener("resize", function () {
    clearTimeout(window.__rz);
    window.__rz = setTimeout(function () { fit(); camApply(); }, 140);
  });
})();
