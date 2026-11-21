// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — A4 LANDSCAPE 2D PRODUCTION DRAWINGS ENGINE
// Generates standardized A4 factory shop drawings matching Cookscape specifications:
// - Title Block, Production Details Column, Signatures, Revision codes
// - Page 1: 2D Room Floor Plan & Appliance Layout with Running Dimensions
// - Page 2: 3D Axonometric Overview & Detailed Single Unit
// - Pages 3+: Side-by-Side EXTERNAL VIEW & INTERNAL VIEW with mm dimensions & fillers
// - Loft Elevations, TV Consoles, Pooja Units with CNC jali, Shoe Racks, Wardrobes
// - Multi-Page Vector SVG Viewer, AutoCAD DXF AC1009 Export, and Direct A4 PDF Print
// ═══════════════════════════════════════════════════════════════════════════════

(function (root) {
  'use strict';

  var A4Engine = {
    // Default Metadata matching the reference Cookscape production standard
    meta: {
      client: 'PRIYANKA',
      site: 'THAZHAMPUR',
      dwgTitle: 'KITCHEN',
      prCode: 'CP26-090004',
      branch: 'NANDHANAM',
      dwgRef: 'PRODUCTION',
      dwgDate: '16.11.2026',
      surveyor: 'Ar. RENUKHA',
      designer: 'Ar. SHIVARANJANI',
      estimator: 'Mr. LEO JENISON',
      engineer: 'Mr. VENKAT',
      carcassType: 'BWP',
      carcassColor: 'HALF WHITE',
      shutterType: 'SURABHI',
      shutterLam: 'MATCH WITH SHUTTER LAM',
      skirtingLam: 'MATCH WITH SHUTTER LAM',
      handleType: 'EXTENDED SHUTTER - 20mm',
      hingesBrand: 'ONE NORMAL & ONE SOFT CLOSING (EBCO)',
      runnersBrand: 'ONE SOFT CLOSING (EBCO)',
      graniteType: 'KASHMIR WHITE (20mm)',
      hobType: '4-BURNER BUILT-IN',
      chimneySize: '600mm / 900mm',
      cylinders: '2 NO\'S',
      rccPlinth: '110mm RCC',
      companyName: 'COOKSCAPE',
      companySub: 'INTERIORS AND BEYOND',
      companyFull: 'ORCHID DESIGNS PRIVATE LIMITED',
      companyAddress: '# 557/338 FANEPET, NANDANAM, CH-35',
      companyEmail: 'designs.cookscape@gmail.com'
    },

    activePageIndex: 0,
    zoomLevel: 1.0,

    // ── Helper: Format dimension to whole number string ──
    fDim: function (num) {
      if (!num || isNaN(num)) return '0';
      return String(Math.round(parseFloat(num)));
    },

    // ── Vector Math for SVG & DXF ──
    createVectorCanvas: function (w, h) {
      w = w || 2970; // 297mm @ 10x scale
      h = h || 2100; // 210mm @ 10x scale
      var elements = [];

      return {
        width: w,
        height: h,
        add: function (svgSnippet) { elements.push(svgSnippet); },
        line: function (x1, y1, x2, y2, stroke, strokeWidth, dashArray) {
          stroke = stroke || '#111827';
          strokeWidth = strokeWidth || 2;
          var dash = dashArray ? ' stroke-dasharray="' + dashArray + '"' : '';
          elements.push('<line x1="' + x1.toFixed(1) + '" y1="' + y1.toFixed(1) + '" x2="' + x2.toFixed(1) + '" y2="' + y2.toFixed(1) + '" stroke="' + stroke + '" stroke-width="' + strokeWidth + '"' + dash + ' stroke-linecap="round"/>');
        },
        rect: function (x, y, rw, rh, stroke, strokeWidth, fill, rx) {
          stroke = stroke || '#111827';
          strokeWidth = strokeWidth || 2;
          fill = fill || 'none';
          var rAttr = rx ? ' rx="' + rx + '" ry="' + rx + '"' : '';
          elements.push('<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + rw.toFixed(1) + '" height="' + rh.toFixed(1) + '" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" fill="' + fill + '"' + rAttr + '/>');
        },
        circle: function (cx, cy, r, stroke, strokeWidth, fill) {
          stroke = stroke || '#111827';
          strokeWidth = strokeWidth || 2;
          fill = fill || 'none';
          elements.push('<circle cx="' + cx.toFixed(1) + '" cy="' + cy.toFixed(1) + '" r="' + r.toFixed(1) + '" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" fill="' + fill + '"/>');
        },
        text: function (x, y, str, size, weight, align, fill, rot) {
          size = size || 24;
          weight = weight || 'normal';
          align = align || 'middle';
          fill = fill || '#0f172a';
          var rotAttr = rot ? ' transform="rotate(' + rot + ' ' + x.toFixed(1) + ' ' + y.toFixed(1) + ')"' : '';
          var textAnchor = (align === 'center' || align === 'middle') ? 'middle' : (align === 'right' || align === 'end' ? 'end' : 'start');
          elements.push('<text x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" font-size="' + size + '" font-weight="' + weight + '" text-anchor="' + textAnchor + '" fill="' + fill + '" font-family="Arial, Helvetica, sans-serif"' + rotAttr + '>' + str + '</text>');
        },
        // Dimension Line (Horizontal) with arrowheads and text
        dimH: function (x1, x2, y, label, offset, isAbove) {
          offset = offset || 0;
          var dimY = y + offset;
          var textY = isAbove ? dimY - 10 : dimY + 22;
          this.line(x1, y - 8, x1, dimY + 8, '#0f172a', 1.5);
          this.line(x2, y - 8, x2, dimY + 8, '#0f172a', 1.5);
          this.line(x1, dimY, x2, dimY, '#0f172a', 1.8);
          // Architectural cross ticks
          this.line(x1 - 6, dimY - 6, x1 + 6, dimY + 6, '#0f172a', 2);
          this.line(x2 - 6, dimY - 6, x2 + 6, dimY + 6, '#0f172a', 2);
          this.text((x1 + x2) / 2, textY, label, 20, 'bold', 'middle', '#0f172a');
        },
        // Dimension Line (Vertical) with arrowheads and text
        dimV: function (y1, y2, x, label, offset, isLeft) {
          offset = offset || 0;
          var dimX = x + offset;
          var textX = isLeft ? dimX - 12 : dimX + 14;
          this.line(x - 8, y1, dimX + 8, y1, '#0f172a', 1.5);
          this.line(x - 8, y2, dimX + 8, y2, '#0f172a', 1.5);
          this.line(dimX, y1, dimX, y2, '#0f172a', 1.8);
          // Architectural cross ticks
          this.line(dimX - 6, y1 - 6, dimX + 6, y1 + 6, '#0f172a', 2);
          this.line(dimX - 6, y2 - 6, dimX + 6, y2 + 6, '#0f172a', 2);
          this.text(textX, (y1 + y2) / 2 + 7, label, 20, 'bold', isLeft ? 'end' : 'start', '#0f172a');
        },
        polygon: function (pts, stroke, strokeWidth, fill) {
          stroke = stroke || '#111827';
          strokeWidth = strokeWidth || 2;
          fill = fill || 'none';
          var ptsStr = pts.map(function (p) { return p.x.toFixed(1) + ',' + p.y.toFixed(1); }).join(' ');
          elements.push('<polygon points="' + ptsStr + '" stroke="' + stroke + '" stroke-width="' + strokeWidth + '" fill="' + fill + '"/>');
        },
        dimAligned: function (x1, y1, x2, y2, label, offset) {
          offset = offset || 0;
          var dx = x2 - x1, dy = y2 - y1;
          var len = Math.hypot(dx, dy) || 1;
          var nx = -dy / len, ny = dx / len;
          var ax1 = x1 + nx * offset, ay1 = y1 + ny * offset;
          var ax2 = x2 + nx * offset, ay2 = y2 + ny * offset;
          this.line(x1, y1, ax1 + nx * 5, ay1 + ny * 5, '#0f172a', 1.2);
          this.line(x2, y2, ax2 + nx * 5, ay2 + ny * 5, '#0f172a', 1.2);
          this.line(ax1, ay1, ax2, ay2, '#0f172a', 1.8);
          // Architectural ticks
          this.line(ax1 - 6 * nx - 6 * ny, ay1 - 6 * ny + 6 * nx, ax1 + 6 * nx + 6 * ny, ay1 + 6 * ny - 6 * nx, '#0f172a', 2);
          this.line(ax2 - 6 * nx - 6 * ny, ay2 - 6 * ny + 6 * nx, ax2 + 6 * nx + 6 * ny, ay2 + 6 * ny - 6 * nx, '#0f172a', 2);
          var midX = (ax1 + ax2) / 2 + nx * 14;
          var midY = (ay1 + ay2) / 2 + ny * 14;
          var deg = Math.atan2(dy, dx) * 180 / Math.PI;
          if (deg > 90 || deg < -90) deg += 180;
          this.text(midX, midY, label, 18, 'bold', 'middle', '#0f172a', deg);
        },
        swatch: function (x, y, w, h, finishLabel) {
          // Framed woodgrain texture swatch box matching Cookscape sample card
          this.rect(x, y, w, h, '#000000', 2, '#ffffff');
          this.rect(x + 8, y + 8, w - 16, h - 38, '#92400e', 1.5, '#78350f');
          // Wood grain streaks
          for (var g = 0; g < 6; g++) {
            var gx1 = x + 14 + g * ((w - 28) / 5);
            var gx2 = gx1 + (g % 2 === 0 ? 12 : -12);
            this.line(gx1, y + 10, gx2, y + h - 32, '#9a3412', 1.8);
          }
          this.text(x + w / 2, y + h - 14, finishLabel || 'SURABHI TEAK', 14, 'bold', 'middle', '#0f172a');
          this.text(x + w / 2, y - 10, 'REFERENCE IMAGE ATTACHED', 14, 'bold', 'middle', '#000000');
        },
        hatchRect: function (x, y, w, h, spacing, stroke) {
          spacing = spacing || 14;
          stroke = stroke || '#94a3b8';
          this.rect(x, y, w, h, '#000000', 1.5, 'none');
          for (var hx = x - h; hx < x + w; hx += spacing) {
            var x1 = Math.max(x, hx);
            var y1 = y + (x1 - hx);
            var x2 = Math.min(x + w, hx + h);
            var y2 = y + (x2 - hx);
            if (x1 < x + w && y1 >= y && y2 <= y + h) {
              this.line(x1, y1, x2, y2, stroke, 1);
            }
          }
        },
        dimInternalV: function (x, y1, y2, label) {
          var topY = Math.min(y1, y2);
          var botY = Math.max(y1, y2);
          var h = botY - topY;
          if (h < 18) return;
          this.line(x, topY, x, botY, '#0f172a', 1.4);
          this.line(x - 6, topY + 9, x, topY, '#0f172a', 1.8);
          this.line(x + 6, topY + 9, x, topY, '#0f172a', 1.8);
          this.line(x - 6, botY - 9, x, botY, '#0f172a', 1.8);
          this.line(x + 6, botY - 9, x, botY, '#0f172a', 1.8);
          this.rect(x - 48, (topY + botY) / 2 - 12, 96, 24, '#000000', 0.8, '#ffffff', 2);
          this.text(x, (topY + botY) / 2 + 6, label, 15, 'bold', 'middle', '#0f172a');
        },
        toSVG: function () {
          return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + w + ' ' + h + '" width="100%" height="100%" style="background:#ffffff;display:block;">' + elements.join('\n') + '</svg>';
        }
      };
    },

    // ── Render Standard A4 Landscape Border & Title Block (Common to All Pages) ──
    drawA4Template: function (canvas, pageNum, totalPages, pageTitle) {
      var m = this.meta;
      var w = canvas.width;  // 2970
      var h = canvas.height; // 2100

      // Outer Margins & Double Engineering Border
      canvas.rect(40, 40, w - 80, h - 80, '#000000', 3.5, '#ffffff');
      canvas.rect(52, 52, w - 104, h - 104, '#000000', 1.5, 'none');

      // Top Header Info
      canvas.text(80, 95, 'TOTAL NO OF PAGES : ' + (totalPages < 10 ? '0' + totalPages : totalPages), 28, 'bold', 'start', '#000000');
      
      // Page Number Badge (Top Right Box)
      var pStr = pageNum < 10 ? '0' + pageNum : String(pageNum);
      canvas.rect(w - 380, 68, 300, 56, '#000000', 2, '#ffffff', 4);
      canvas.text(w - 230, 107, 'PAGE NO : ' + pStr, 28, 'bold', 'middle', '#000000');

      // ── RIGHT VERTICAL DISCLAIMER ──
      var disclaimer = 'This Design & Proposal drawing Belongs to ' + m.companyFull + '., All drawings are handed over to Clients after the confirmation of the order.';
      canvas.text(w - 62, h / 2, disclaimer, 15, 'bold', 'middle', '#000000', -90);

      // ── BOTTOM TITLE BLOCK ──
      var tbY = h - 310;
      var tbH = 240;
      var tbW = w - 124; // 2970 - 124 = 2846
      var tbX = 62;

      // Outer Title Block Box
      canvas.rect(tbX, tbY, tbW, tbH, '#000000', 2.5, '#ffffff');

      // Vertical Columns in Title Block
      // Col 1: Client & Site (0 to 540)
      canvas.line(tbX + 540, tbY, tbX + 540, tbY + tbH, '#000000', 1.5);
      // Col 2: Codes & Dates (540 to 980)
      canvas.line(tbX + 980, tbY, tbX + 980, tbY + tbH, '#000000', 1.5);
      // Col 3: Design Team (980 to 1540)
      canvas.line(tbX + 1540, tbY, tbX + 1540, tbY + tbH, '#000000', 1.5);
      // Col 4: Approval Signatures (1540 to 1860)
      canvas.line(tbX + 1860, tbY, tbX + 1860, tbY + tbH, '#000000', 1.5);
      // Col 5: Scale Note (1860 to 2160)
      canvas.line(tbX + 2160, tbY, tbX + 2160, tbY + tbH, '#000000', 1.5);
      // Col 6: Company Branding Logo & Address (2160 to tbW)

      // Col 1 Data: Client Info
      canvas.text(tbX + 20, tbY + 50, 'CLIENT : ' + (m.client || 'PRIYANKA').toUpperCase(), 24, 'bold', 'start');
      canvas.text(tbX + 20, tbY + 115, 'SITE    : ' + (m.site || 'THAZHAMPUR').toUpperCase(), 24, 'bold', 'start');
      canvas.text(tbX + 20, tbY + 180, 'DWG    : ' + (pageTitle || m.dwgTitle || 'KITCHEN').toUpperCase(), 24, 'bold', 'start');

      // Col 2 Data: P.R. Code & Dates
      canvas.text(tbX + 560, tbY + 45, 'P.R. Code : ' + (m.prCode || 'CP26-090004'), 21, 'normal', 'start');
      canvas.text(tbX + 560, tbY + 95, 'BRANCH   : ' + (m.branch || 'NANDHANAM'), 21, 'normal', 'start');
      canvas.text(tbX + 560, tbY + 145, 'DWG REF  : ' + (m.dwgRef || 'PRODUCTION'), 21, 'normal', 'start');
      canvas.text(tbX + 560, tbY + 195, 'DWG DATE : ' + (m.dwgDate || '16.11.2026'), 21, 'normal', 'start');

      // Col 3 Data: Team
      canvas.text(tbX + 1000, tbY + 45, 'SURVEYOR : ' + (m.surveyor || 'Ar. RENUKHA'), 21, 'normal', 'start');
      canvas.text(tbX + 1000, tbY + 95, 'DESIGNER : ' + (m.designer || 'Ar. SHIVARANJANI'), 21, 'normal', 'start');
      canvas.text(tbX + 1000, tbY + 145, 'ESTIMATOR : ' + (m.estimator || 'Mr. LEO JENISON'), 21, 'normal', 'start');
      canvas.text(tbX + 1000, tbY + 195, 'ENGINEER  : ' + (m.engineer || 'Mr. VENKAT'), 21, 'normal', 'start');

      // Col 4 Data: Approval Signatures
      canvas.line(tbX + 1540, tbY + 140, tbX + 1860, tbY + 140, '#000000', 1.5);
      canvas.text(tbX + 1700, tbY + 100, 'A.E.', 22, 'normal', 'middle');
      canvas.text(tbX + 1700, tbY + 195, 'DESIGNER', 22, 'normal', 'middle');

      // Col 5 Data: Scale / Dimension Note & Client Signature
      canvas.line(tbX + 1860, tbY + 140, tbX + 2160, tbY + 140, '#000000', 1.5);
      canvas.text(tbX + 2010, tbY + 195, 'CLIENT SIGNATURE', 20, 'bold', 'middle');
      canvas.text(tbX + 2010, tbY + 65, 'All dimensions', 20, 'normal', 'middle');
      canvas.text(tbX + 2010, tbY + 100, 'are in mm', 20, 'bold', 'middle');

      // Col 6 Data: Company Identity / Cookscape Logo
      canvas.rect(tbX + 2190, tbY + 30, tbW - 2220, 75, '#000000', 1, '#ffffff');
      canvas.text(tbX + 2530, tbY + 65, m.companyName, 32, 'bold', 'middle', '#000000');
      canvas.text(tbX + 2530, tbY + 95, m.companySub, 15, 'bold', 'middle', '#64748b');

      canvas.text(tbX + 2530, tbY + 145, m.companyFull, 17, 'bold', 'middle', '#000000');
      canvas.text(tbX + 2530, tbY + 175, m.companyAddress, 14, 'normal', 'middle', '#334155');
      canvas.text(tbX + 2530, tbY + 205, m.companyEmail, 14, 'normal', 'middle', '#334155');
    },

    // ── Render Right Specification Column ("PRODUCTION DETAILS") ──
    drawProductionDetails: function (canvas, customSpecs) {
      var m = this.meta;
      var startX = 2120;
      var startY = 160;
      var specs = customSpecs || [
        { label: 'FM CARCASS HEIGHT', val: '670mm + 110mm RCC' },
        { label: 'FM CARCASS DEPTH', val: '600mm' },
        { label: 'FM SHUTTER HEIGHT', val: '675mm' },
        { label: 'WM CARCASS HEIGHT', val: '600mm' },
        { label: 'WM CARCASS DEPTH', val: '300mm' },
        { label: 'WM SHUTTER HEIGHT', val: '620mm' },
        { label: 'FM & WM CARCASS COLOR', val: m.carcassColor },
        { label: 'FM & WM CARCASS TYPE', val: m.carcassType },
        { label: 'FM & WM SHUTTER TYPE', val: m.shutterType },
        { label: 'FM SHUTTER LAM', val: m.shutterLam },
        { label: 'WM SHUTTER LAM', val: m.shutterLam },
        { label: 'SKIRTING LAM', val: m.skirtingLam },
        { label: 'FM HANDLE TYPE', val: 'G-PROFILE / EXTENDED' },
        { label: 'WM HANDLE TYPE', val: m.handleType },
        { label: 'GRANITE', val: m.graniteType },
        { label: 'HOB TYPE', val: m.hobType },
        { label: 'CHIMNEY SIZE', val: m.chimneySize },
        { label: 'HINGES BRAND & TYPE', val: m.hingesBrand },
        { label: 'RUNNERS BRAND & TYPE', val: m.runnersBrand },
        { label: 'NO. OF CYLINDERS', val: m.cylinders }
      ];

      canvas.text(startX, startY, 'PRODUCTION DETAILS', 28, 'bold', 'start', '#000000');
      canvas.line(startX, startY + 8, startX + 320, startY + 8, '#000000', 2);

      var currY = startY + 52;
      for (var i = 0; i < specs.length; i++) {
        var sp = specs[i];
        if (currY > 1700) break;
        canvas.text(startX, currY, sp.label + ' : ' + sp.val, 17, 'bold', 'start', '#0f172a');
        currY += 46;
      }
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // LIVE PROJECT DATA EXTRACTOR
    // ─────────────────────────────────────────────────────────────────────────────

    getProjectData: function () {
      var ui = (typeof window !== 'undefined' && window.OrbixUI) || null;
      var plan = null;
      var proj = (ui && ui.project) || (ui && ui.editor && ui.editor.project) || null;

      // 1. Inspect window.OrbixProjects for active project record
      var activeRecord = null;
      if (typeof window !== 'undefined' && window.OrbixProjects) {
        var op = window.OrbixProjects;
        var actId = op.activeProjectId || (typeof localStorage !== 'undefined' && localStorage.getItem('orbix_active_project_id'));
        if (actId && Array.isArray(op.projects)) {
          activeRecord = op.projects.find(function (p) {
            return String(p.id) === String(actId);
          });
        }
      }

      if (activeRecord) {
        proj = proj || activeRecord;
        var pDet = (activeRecord.data && activeRecord.data.details) || activeRecord.details || {};
        if (activeRecord.client || pDet.clientName) this.meta.client = activeRecord.client || pDet.clientName;
        if (activeRecord.name || activeRecord.title || pDet.siteAddress || activeRecord.location) {
          this.meta.site = activeRecord.name || activeRecord.title || pDet.siteAddress || activeRecord.location;
        }
        if (activeRecord.code || activeRecord.cp_code || pDet.cpCode) this.meta.prCode = activeRecord.code || activeRecord.cp_code || pDet.cpCode;
        if (activeRecord.bh_name || pDet.bhName || pDet.designerName) this.meta.designer = activeRecord.bh_name || pDet.bhName || pDet.designerName;
      }

      if (ui && typeof ui.getPlan === 'function') {
        try { plan = ui.getPlan(); } catch (_) {}
      }

      if (!plan && proj) {
        plan = (proj.data && proj.data.plan) || proj.plan || proj;
        while (plan && plan.plan && (plan.plan.walls || plan.plan.furniture || plan.plan.rooms || plan.plan.plan)) {
          plan = plan.plan;
        }
      }

      if (!plan && activeRecord && activeRecord.data && activeRecord.data.plan) {
        plan = activeRecord.data.plan;
        while (plan && plan.plan && (plan.plan.walls || plan.plan.furniture || plan.plan.rooms || plan.plan.plan)) {
          plan = plan.plan;
        }
      }

      if (typeof localStorage !== 'undefined') {
        try {
          var raw = localStorage.getItem('orbix_working_project_draft');
          if (raw) {
            var draftObj = JSON.parse(raw);
            if (!plan || (!plan.walls && !plan.furniture)) {
              plan = (draftObj && draftObj.plan) || draftObj;
              if (plan && plan.plan) plan = plan.plan;
            }
          }
        } catch (_) {}
      }

      plan = plan || {};
      var walls = plan.walls || [];
      var openings = plan.openings || [];
      var rooms = plan.rooms || [];
      var furniture = plan.furniture || [];

      // Check editor project if plan had no walls or furniture
      if ((!walls.length || !furniture.length) && ui && ui.editor && ui.editor.project && ui.editor.project.plan) {
        var ep = ui.editor.project.plan;
        if (!walls.length && ep.walls && ep.walls.length) walls = ep.walls;
        if (!openings.length && ep.openings && ep.openings.length) openings = ep.openings;
        if (!rooms.length && ep.rooms && ep.rooms.length) rooms = ep.rooms;
        if (!furniture.length && ep.furniture && ep.furniture.length) furniture = ep.furniture;
      }

      // Check activeRecord data.units or activeRecord.units
      var rawUnits = null;
      if (activeRecord && activeRecord.data && Array.isArray(activeRecord.data.units) && activeRecord.data.units.length > 0) {
        rawUnits = activeRecord.data.units;
      } else if (activeRecord && Array.isArray(activeRecord.units) && activeRecord.units.length > 0) {
        rawUnits = activeRecord.units;
      }

      // Check localStorage draft units
      if (typeof localStorage !== 'undefined') {
        try {
          var draftRaw = localStorage.getItem('orbix_working_project_draft');
          if (draftRaw) {
            var draftParsed = JSON.parse(draftRaw);
            if (draftParsed && Array.isArray(draftParsed.units) && draftParsed.units.length > 0) {
              if (!rawUnits || draftParsed.units.length > rawUnits.length) {
                rawUnits = draftParsed.units;
              }
            }
          }
        } catch (_) {}
      }

      // Check window.S.units
      if (typeof window !== 'undefined' && window.S && Array.isArray(window.S.units) && window.S.units.length > 0) {
        if (!rawUnits || window.S.units.length >= rawUnits.length) {
          rawUnits = window.S.units;
        }
      }

      // If rawUnits has more items than furniture, map them into furniture array
      if (rawUnits && rawUnits.length > furniture.length) {
        furniture = rawUnits.map(function (u, uIdx) {
          var wVal = parseFloat(u.W || u.width || 600);
          var dVal = parseFloat(u.D || u.depth || 600);
          var hVal = parseFloat(u.H || u.height || 720);
          var uCode = u.code || ('U' + (uIdx < 9 ? '0' : '') + (uIdx + 1));
          var uCat = u.ctype || u.category || ((u.label && u.label.toLowerCase().indexOf('wall') !== -1) ? 'wall' : 'base');
          var hasSink = (u.label && u.label.toLowerCase().indexOf('sink') !== -1) || !!u.hasSink;
          var hasHob = (u.label && (u.label.toLowerCase().indexOf('hob') !== -1 || u.label.toLowerCase().indexOf('gas') !== -1)) || !!u.hasHob;
          var isPooja = (u.label && u.label.toLowerCase().indexOf('pooja') !== -1) || !!u.isPooja;

          return {
            id: u.id || ('u_' + uIdx),
            name: u.label || u.name || ('Modular Unit ' + (uIdx + 1)),
            code: uCode,
            category: uCat,
            dimensions: { W: wVal, D: dVal, H: hVal },
            pos: u.pos || { x: (uIdx % 6) * 1000 + 400, y: Math.floor(uIdx / 6) * 1000 + 400, z: u.elev || 0 },
            rotY: u.rotY || 0,
            unitConfig: {
              shutters: u.shutters !== undefined ? u.shutters : (wVal > 1200 ? 3 : wVal > 600 ? 2 : 1),
              drawers: u.drawers || 0,
              dstyle: u.dstyle || 'slab',
              handle: (u.handle && u.handle.kind) || (typeof u.handle === 'string' ? u.handle : 'gprof'),
              carcass: u.carcass || 'Half White',
              shutterCol: u.shutterCol || 'Surabhi',
              loft: !!u.loft,
              loftH: u.loftH || 600,
              shelves: u.shelves || (hVal > 1500 ? 4 : hVal > 900 ? 2 : 1),
              hasSink: hasSink,
              hasHob: hasHob,
              isPooja: isPooja,
              appliance: hasSink ? 'sink' : (hasHob ? 'hob' : null)
            }
          };
        });
      }

      return {
        project: proj,
        plan: plan,
        walls: walls,
        openings: openings,
        rooms: rooms,
        furniture: furniture
      };
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // DYNAMIC PAGE 1: REAL 2D ROOM FLOOR PLAN & APPLIANCE LAYOUT
    // ─────────────────────────────────────────────────────────────────────────────

    buildDynamicPage1_FloorPlan: function (pageNum, totalPages, pData) {
      var canvas = this.createVectorCanvas();
      var m = this.meta;
      this.drawA4Template(canvas, pageNum, totalPages, (m.dwgTitle || 'ROOM') + ' 2D PLAN');
      this.drawProductionDetails(canvas);

      var walls = pData.walls || [];
      var openings = pData.openings || [];
      var rooms = pData.rooms || [];
      var furniture = pData.furniture || [];

      // Check if units have distinct layout positions or need automatic layout
      var needsAutoLayout = (walls.length === 0);
      if (!needsAutoLayout && furniture.length > 1) {
        var fx0 = furniture[0].pos ? (furniture[0].pos.x || 0) : 0;
        var fy0 = furniture[0].pos ? (furniture[0].pos.y || 0) : 0;
        var identicalCount = 0;
        for (var k = 1; k < furniture.length; k++) {
          var fkx = furniture[k].pos ? (furniture[k].pos.x || 0) : 0;
          var fky = furniture[k].pos ? (furniture[k].pos.y || 0) : 0;
          if (Math.abs(fkx - fx0) < 5 && Math.abs(fky - fy0) < 5) identicalCount++;
        }
        if (identicalCount > furniture.length / 2) needsAutoLayout = true;
      }

      if (needsAutoLayout) {
        var unitsPerRow = furniture.length > 18 ? 6 : (furniture.length > 8 ? 5 : 4);
        var curRowX = 400;
        var curRowY = 400;
        var maxRowH = 700;

        furniture.forEach(function (fn, idx) {
          var w = parseFloat((fn.dimensions && (fn.dimensions.W || fn.dimensions.width)) || 600);
          var d = parseFloat((fn.dimensions && (fn.dimensions.D || fn.dimensions.depth)) || 600);
          if (idx > 0 && idx % unitsPerRow === 0) {
            curRowX = 400;
            curRowY += maxRowH + 350;
          }
          fn._renderPos = { x: curRowX + w / 2, y: curRowY + d / 2 };
          curRowX += w + 200;
          maxRowH = Math.max(maxRowH, d);
        });
      }

      // Calculate Bounding Box of all walls and furniture in mm
      var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      walls.forEach(function (w) {
        if (w.start) {
          minX = Math.min(minX, w.start.x);
          minY = Math.min(minY, w.start.y);
          maxX = Math.max(maxX, w.start.x);
          maxY = Math.max(maxY, w.start.y);
        }
        if (w.end) {
          minX = Math.min(minX, w.end.x);
          minY = Math.min(minY, w.end.y);
          maxX = Math.max(maxX, w.end.x);
          maxY = Math.max(maxY, w.end.y);
        }
      });

      furniture.forEach(function (f) {
        var pos = f._renderPos || f.pos || { x: 0, y: 0 };
        var px = pos.x || 0;
        var py = pos.y || 0;
        var w = (f.dimensions && (f.dimensions.W || f.dimensions.width)) ? parseFloat(f.dimensions.W || f.dimensions.width) : 600;
        var d = (f.dimensions && (f.dimensions.D || f.dimensions.depth)) ? parseFloat(f.dimensions.D || f.dimensions.depth) : 600;
        minX = Math.min(minX, px - w / 2);
        minY = Math.min(minY, py - d / 2);
        maxX = Math.max(maxX, px + w / 2);
        maxY = Math.max(maxY, py + d / 2);
      });

      if (!isFinite(minX) || !isFinite(maxX)) {
        minX = 0; minY = 0; maxX = 4000; maxY = 3000;
      }

      var spanX = Math.max(1200, maxX - minX);
      var spanY = Math.max(1200, maxY - minY);
      var availW = 1850;
      var availH = 1420;
      var pad = 400;
      var scale = Math.min(availW / (spanX + pad * 2), availH / (spanY + pad * 2));
      scale = Math.max(0.12, Math.min(0.65, scale));

      var centerX = (minX + maxX) / 2;
      var centerY = (minY + maxY) / 2;
      var targetX = 140 + availW / 2;
      var targetY = 220 + availH / 2;

      function toScreen(pt) {
        return {
          x: targetX + (pt.x - centerX) * scale,
          y: targetY + (pt.y - centerY) * scale
        };
      }

      // Draw Room Walls (Double-line architectural walls with cavity hatch)
      walls.forEach(function (w) {
        if (!w.start || !w.end) return;
        var p1 = toScreen(w.start);
        var p2 = toScreen(w.end);
        var thick = Math.max(8, (w.thickness || 150) * scale);
        var dx = p2.x - p1.x, dy = p2.y - p1.y;
        var len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;

        // Outer & Inner Wall Face Lines
        var o1x = p1.x + nx * thick / 2, o1y = p1.y + ny * thick / 2;
        var o2x = p2.x + nx * thick / 2, o2y = p2.y + ny * thick / 2;
        var i1x = p1.x - nx * thick / 2, i1y = p1.y - ny * thick / 2;
        var i2x = p2.x - nx * thick / 2, i2y = p2.y - ny * thick / 2;

        canvas.line(o1x, o1y, o2x, o2y, '#000000', 2.5);
        canvas.line(i1x, i1y, i2x, i2y, '#000000', 2.5);

        // Wall Cavity Diagonal Hatching
        var segs = Math.max(3, Math.floor(len / 18));
        for (var s = 0; s <= segs; s++) {
          var t = s / segs;
          var h1x = o1x + (o2x - o1x) * t;
          var h1y = o1y + (o2y - o1y) * t;
          var h2x = i1x + (i2x - i1x) * Math.min(1, t + 0.08);
          var h2y = i1y + (i2y - i1y) * Math.min(1, t + 0.08);
          canvas.line(h1x, h1y, h2x, h2y, '#94a3b8', 1.2);
        }

        // Wall Dimension string & thickness callout
        var lenMm = Math.round(Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y));
        var midX = (p1.x + p2.x) / 2;
        var midY = (p1.y + p2.y) / 2;
        canvas.text(midX + nx * (thick / 2 + 22), midY + ny * (thick / 2 + 22), String(lenMm), 18, 'bold', 'middle', '#0f172a');
        if (lenMm > 1500) {
          canvas.text(midX - nx * (thick / 2 + 16), midY - ny * (thick / 2 + 16), (w.thickness || 150) + ' THK WALL', 13, 'bold', 'middle', '#64748b');
        }
      });

      // Draw Doors & Windows (Openings with true architectural swing arcs & glass lines)
      openings.forEach(function (op) {
        var hostWall = walls.find(function (w) { return w.id === op.wallId; });
        if (!hostWall) return;
        var wLen = Math.hypot(hostWall.end.x - hostWall.start.x, hostWall.end.y - hostWall.start.y);
        if (wLen < 1) return;
        var t = (op.offset || (wLen / 2)) / wLen;
        var opX = hostWall.start.x + t * (hostWall.end.x - hostWall.start.x);
        var opY = hostWall.start.y + t * (hostWall.end.y - hostWall.start.y);
        var scPt = toScreen({ x: opX, y: opY });
        var opW = (op.width || 900) * scale;

        if (op.type === 'window') {
          // Double Frame Window with Glazing Lines
          canvas.rect(scPt.x - opW / 2, scPt.y - 15, opW, 30, '#0284c7', 2, '#ffffff');
          canvas.line(scPt.x - opW / 2, scPt.y - 5, scPt.x + opW / 2, scPt.y - 5, '#0284c7', 1.5);
          canvas.line(scPt.x - opW / 2, scPt.y + 5, scPt.x + opW / 2, scPt.y + 5, '#0284c7', 1.5);
          canvas.text(scPt.x, scPt.y - 24, 'WINDOW — ' + Math.round(op.width || 1200), 16, 'bold', 'middle', '#0284c7');
        } else {
          // Architectural Door with Frame and 90-degree Swing Arc
          canvas.rect(scPt.x - opW / 2, scPt.y - 12, opW, 24, '#d97706', 2, '#ffffff');
          // Door leaf open at 90 deg
          canvas.line(scPt.x - opW / 2, scPt.y - 12, scPt.x - opW / 2, scPt.y - 12 - opW, '#d97706', 2.5);
          // Dashed Swing Arc
          var arcPts = 8;
          for (var a = 0; a < arcPts; a++) {
            var ang1 = (a / arcPts) * (Math.PI / 2);
            var ang2 = ((a + 0.6) / arcPts) * (Math.PI / 2);
            var ax1 = (scPt.x - opW / 2) + Math.sin(ang1) * opW;
            var ay1 = (scPt.y - 12) - Math.cos(ang1) * opW;
            var ax2 = (scPt.x - opW / 2) + Math.sin(ang2) * opW;
            var ay2 = (scPt.y - 12) - Math.cos(ang2) * opW;
            canvas.line(ax1, ay1, ax2, ay2, '#d97706', 1.5);
          }
          canvas.text(scPt.x, scPt.y - 20, 'DOOR — ' + Math.round(op.width || 900), 16, 'bold', 'middle', '#d97706');
        }
      });

      // Draw Placed Modular Furniture Units with Cookscape CAD Symbols
      furniture.forEach(function (fn, idx) {
        var pos = fn._renderPos || fn.pos || { x: 0, y: 0 };
        var px = pos.x || 0;
        var py = pos.y || 0;
        var scPt = toScreen({ x: px, y: py });
        var wDims = fn.dimensions || {};
        var fW = (parseFloat(wDims.W || wDims.width) || 600) * scale;
        var fD = (parseFloat(wDims.D || wDims.depth) || 600) * scale;
        var uTag = fn.code || ('U' + (idx < 9 ? '0' : '') + (idx + 1));
        var isSink = fn.unitConfig && (fn.unitConfig.appliance === 'sink' || fn.unitConfig.hasSink);
        var isHob = fn.unitConfig && (fn.unitConfig.appliance === 'hob' || fn.unitConfig.hasHob);

        // Unit Outer Body
        canvas.rect(scPt.x - fW / 2, scPt.y - fD / 2, fW, fD, '#000000', 2, '#ffffff');

        // Side Fillers indicator on modular runs
        if (idx === 0 || idx === furniture.length - 1) {
          canvas.rect(scPt.x - fW / 2, scPt.y - fD / 2, Math.max(6, 40 * scale), fD, '#000000', 1, '#f1f5f9');
          canvas.text(scPt.x - fW / 2 + Math.max(3, 20 * scale), scPt.y, '50BS', 11, 'bold', 'middle', '#0f172a', -90);
        }

        if (isSink) {
          // Cookscape Double/Single Sink with Drainboard & Faucet Symbol
          var bowlW = fW * 0.48;
          var bowlH = fD * 0.72;
          canvas.rect(scPt.x - fW / 2 + 10, scPt.y - bowlH / 2, bowlW, bowlH, '#0284c7', 2, '#f0f9ff', 4);
          // Center Stainless Steel Drain Strainer
          canvas.circle(scPt.x - fW / 2 + 10 + bowlW / 2, scPt.y, 8, '#0284c7', 1.8, '#e0f2fe');
          canvas.circle(scPt.x - fW / 2 + 10 + bowlW / 2, scPt.y, 3, '#0284c7', 1.2, '#0284c7');
          // Drainboard Ribbed Grooves
          var dbX = scPt.x - fW / 2 + 18 + bowlW;
          var dbW = fW - bowlW - 28;
          for (var r = 0; r < 5; r++) {
            var ry = scPt.y - bowlH / 2 + 10 + r * (bowlH - 20) / 4;
            canvas.line(dbX, ry, dbX + dbW, ry, '#0284c7', 1.2);
          }
          // Swivel Mixer Faucet Symbol & Plumbing Points
          canvas.circle(scPt.x - fW / 2 + 10 + bowlW / 2, scPt.y - fD / 2 + 12, 6, '#0369a1', 2, '#ffffff');
          canvas.line(scPt.x - fW / 2 + 10 + bowlW / 2, scPt.y - fD / 2 + 12, scPt.x - fW / 2 + 10 + bowlW / 2, scPt.y - fD / 2 + 24, '#0369a1', 2);
          // Plumbing Callouts
          canvas.text(scPt.x, scPt.y + fD / 2 + 22, 'SINK ' + Math.round(parseFloat(wDims.W) || 750) + ' (' + uTag + ')', 16, 'bold', 'middle', '#0284c7');
          canvas.text(scPt.x, scPt.y + fD / 2 + 42, 'NEED CNC CUT FOR VENT | 1/2" CW + 40mm DRAIN', 12, 'bold', 'middle', '#0369a1');

        } else if (isHob) {
          // Cookscape 4-Burner Gas Hob with Brass Heads & Trivet Crosses
          var hobW = fW * 0.78;
          var hobD = fD * 0.74;
          canvas.rect(scPt.x - hobW / 2, scPt.y - hobD / 2, hobW, hobD, '#b45309', 2, '#fffbeb', 6);
          // 4 Burner Heads
          var bOffX = hobW * 0.26, bOffY = hobD * 0.26;
          var bCoords = [
            { x: scPt.x - bOffX, y: scPt.y - bOffY, r: 16 },
            { x: scPt.x + bOffX, y: scPt.y - bOffY, r: 14 },
            { x: scPt.x - bOffX, y: scPt.y + bOffY, r: 14 },
            { x: scPt.x + bOffX, y: scPt.y + bOffY, r: 18 }
          ];
          bCoords.forEach(function (bc) {
            canvas.circle(bc.x, bc.y, bc.r, '#b45309', 1.8, '#fde68a');
            canvas.circle(bc.x, bc.y, bc.r * 0.45, '#b45309', 1.5, '#b45309');
            // Trivet Cross lines
            canvas.line(bc.x - bc.r - 3, bc.y, bc.x + bc.r + 3, bc.y, '#78350f', 1.2);
            canvas.line(bc.x, bc.y - bc.r - 3, bc.x, bc.y + bc.r + 3, '#78350f', 1.2);
          });
          // Control Knobs along front edge
          for (var k = 0; k < 4; k++) {
            canvas.circle(scPt.x - hobW * 0.3 + k * (hobW * 0.6 / 3), scPt.y + hobD / 2 - 6, 3, '#b45309', 1.2, '#ffffff');
          }
          canvas.text(scPt.x, scPt.y + fD / 2 + 22, 'GAS 560 (' + uTag + ')', 16, 'bold', 'middle', '#b45309');
          canvas.text(scPt.x, scPt.y + fD / 2 + 42, '16A POWER POINT + GAS VALVE PROVISION', 12, 'bold', 'middle', '#b45309');

        } else {
          // Standard Modular Cabinet with Door Swing Direction & Tag
          var cUName = (fn.name || '').toLowerCase();
          if (cUName.indexOf('drawer') !== -1 || (fn.unitConfig && fn.unitConfig.drawers > 0)) {
            // Drawer tandem horizontal division lines
            var dCount = (fn.unitConfig && fn.unitConfig.drawers) || 3;
            for (var dr = 1; dr < dCount; dr++) {
              canvas.line(scPt.x - fW / 2, scPt.y - fD / 2 + dr * (fD / dCount), scPt.x + fW / 2, scPt.y - fD / 2 + dr * (fD / dCount), '#94a3b8', 1.2);
            }
          }
          canvas.text(scPt.x, scPt.y - 4, uTag, 17, 'bold', 'middle', '#0f172a');
          var shortName = (fn.name || 'Unit').replace(/\(Cookscape\)/i, '').trim();
          canvas.text(scPt.x, scPt.y + 18, shortName, 13, 'bold', 'middle', '#64748b');
        }

        // Unit Dimensions Annotation
        canvas.text(scPt.x, scPt.y + fD / 2 + 60, Math.round(parseFloat(wDims.W) || 600) + 'x' + Math.round(parseFloat(wDims.D) || 600), 12, 'normal', 'middle', '#0f172a');
      });

      // Appliance / Special Equipment Floating Callouts (Dishwasher, Fridge, Floating Ledges)
      var hasDishwasher = furniture.some(function (f) { return (f.name || '').toLowerCase().indexOf('dishwasher') !== -1; });
      if (!hasDishwasher && furniture.length >= 3) {
        // Place Dishwasher Provision Note on Floor Plan
        canvas.rect(140 + 80, 220 + availH - 120, 180, 70, '#0284c7', 1.5, '#f0f9ff', 4);
        canvas.text(140 + 170, 220 + availH - 85, 'DISH WASHER PROVISION', 14, 'bold', 'middle', '#0284c7');
        canvas.text(140 + 170, 220 + availH - 65, '600mm SERVICE VOID', 12, 'normal', 'middle', '#0369a1');
      }

      // Floating Ledge Callout
      canvas.rect(targetX + availW / 2 - 380, 220 + 40, 240, 50, '#94a3b8', 1.2, '#f8fafc', 2);
      canvas.text(targetX + availW / 2 - 260, 220 + 70, 'SF LEDGE 750mmx150mm (2NO\'S)', 13, 'bold', 'middle', '#334155');

      // Draw Room Labels & Square Footage
      rooms.forEach(function (r) {
        if (!r.polygon || r.polygon.length < 3) return;
        var cx = 0, cy = 0;
        r.polygon.forEach(function (pt) { cx += pt.x; cy += pt.y; });
        cx /= r.polygon.length;
        cy /= r.polygon.length;
        var sc = toScreen({ x: cx, y: cy });
        var sqft = r.area ? Math.round(r.area / 92903.04) : 0;
        canvas.text(sc.x, sc.y - 12, (r.name || 'ROOM').toUpperCase(), 22, 'bold', 'middle', '#0369a1');
        if (sqft > 0) {
          canvas.text(sc.x, sc.y + 16, sqft + ' SQ FT', 16, 'bold', 'middle', '#0284c7');
        }
      });

      return canvas.toSVG();
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // DYNAMIC PAGE 2: REAL 3D AXONOMETRIC OVERVIEW OF ROOM & KEY UNIT
    // ─────────────────────────────────────────────────────────────────────────────

    buildDynamicPage2_3DOverview: function (pageNum, totalPages, pData) {
      var canvas = this.createVectorCanvas();
      var m = this.meta;
      this.drawA4Template(canvas, pageNum, totalPages, (m.dwgTitle || 'ROOM') + ' 3D OVERVIEW');

      var furniture = pData.furniture || [];

      // Left Box: 3D Axonometric View of Room
      var axX = 140, axY = 320;
      canvas.text(axX + 680, axY - 60, '3D AXONOMETRIC VIEW & MODULAR ASSEMBLY', 28, 'bold', 'middle', '#000000');
      canvas.line(axX + 280, axY - 48, axX + 1080, axY - 48, '#000000', 2);

      var cos30 = Math.cos(Math.PI / 6), sin30 = Math.sin(Math.PI / 6);
      var totalIsoSpan = 0;
      furniture.forEach(function (f) {
        var fw = parseFloat((f.dimensions && (f.dimensions.W || f.dimensions.width)) || 600);
        totalIsoSpan += fw + 80;
      });
      totalIsoSpan = Math.max(1400, totalIsoSpan);
      var isoScale = Math.min(0.24, 1420 / (totalIsoSpan * cos30));

      function iso(x, y, z) {
        return {
          x: axX + 260 + (x - z) * cos30 * isoScale,
          y: axY + 820 - y * isoScale + (x + z) * sin30 * isoScale
        };
      }

      function isoBox(x, y, z, w, h, d, label, isBase) {
        var p1 = iso(x, y, z);
        var p2 = iso(x + w, y, z);
        var p3 = iso(x + w, y + h, z);
        var p4 = iso(x, y + h, z);
        var p5 = iso(x, y, z + d);
        var p6 = iso(x + w, y, z + d);
        var p7 = iso(x + w, y + h, z + d);
        var p8 = iso(x, y + h, z + d);

        // Front Face (Clean White / Soft Off-white)
        var frontPts = [p1, p2, p3, p4];
        canvas.polygon(frontPts, '#000000', 2, '#ffffff');

        // Top Face (Granite if base unit, or wood tone if wall/tall)
        var topPts = [p4, p3, p7, p8];
        canvas.polygon(topPts, '#000000', 1.8, isBase ? '#334155' : '#f1f5f9');

        // Side Face (Shaded Gray depth)
        var sidePts = [p2, p6, p7, p3];
        canvas.polygon(sidePts, '#000000', 1.8, '#e2e8f0');

        // Shutter Division line
        if (w >= 750) {
          var pMidBot = iso(x + w / 2, y, z);
          var pMidTop = iso(x + w / 2, y + h, z);
          canvas.line(pMidBot.x, pMidBot.y, pMidTop.x, pMidTop.y, '#000000', 1.5);
        }

        // Granite nosing overhang line if base unit
        if (isBase) {
          var gn1 = iso(x - 20, y + h, z - 20);
          var gn2 = iso(x + w + 20, y + h, z - 20);
          canvas.line(gn1.x, gn1.y, gn2.x, gn2.y, '#0f172a', 2.5);
        }

        if (label) {
          canvas.text(p1.x + (p3.x - p1.x) / 2, p1.y + (p3.y - p1.y) / 2 + 5, label, 15, 'bold', 'middle', '#1e293b');
        }
      }

      // Draw Placed Units in 3D Isometric Space with Granite & Assembly Details
      var curIsoX = 0;
      furniture.forEach(function (f, idx) {
        var dims = f.dimensions || {};
        var fw = parseFloat(dims.W) || 600;
        var fd = parseFloat(dims.D) || 600;
        var fh = parseFloat(dims.H) || 720;
        var felev = parseFloat(f.elevation || 0);
        var fTag = f.code || ('U' + (idx + 1));
        var isBase = (f.category && f.category.indexOf('base') !== -1) || fh <= 900;
        isoBox(curIsoX, felev, 0, fw, fh, fd, fTag, isBase);
        curIsoX += fw + 80;
      });

      // Assembly Notes on Left Perspective
      canvas.rect(axX + 40, axY + 980, 560, 120, '#000000', 1.5, '#f8fafc', 4);
      canvas.text(axX + 60, axY + 1012, '3D ASSEMBLY & ROOM MOUNTING SPECIFICATIONS:', 16, 'bold', 'start', '#0f172a');
      canvas.text(axX + 60, axY + 1042, '• BASE MODULES SET ON 110mm RCC / 100mm WATERPROOF PVC LEGS', 13, 'bold', 'start', '#334155');
      canvas.text(axX + 60, axY + 1068, '• WALL CABINETS MOUNTED WITH HEAVY-DUTY CONCEALED CAM-HANGERS', 13, 'bold', 'start', '#334155');
      canvas.text(axX + 60, axY + 1092, '• GRANITE COUNTERTOP 20mm WITH BULLNOSE NOSING OVERHANG', 13, 'bold', 'start', '#334155');

      // Right Column: Detail of Primary Unit (WFM600 in reference template, or first placed unit)
      var keyUnit = furniture.find(function (f) {
        var c = (f.code || '').toUpperCase();
        var n = (f.name || '').toUpperCase();
        return c.indexOf('WFM600') !== -1 || n.indexOf('WFM600') !== -1;
      }) || furniture[0] || {
        name: 'WFM600',
        code: 'WFM600',
        dimensions: { W: 600, H: 720, D: 350 }
      };

      var detX = 1920;
      var keyUnitTitle = (keyUnit.code && keyUnit.code.indexOf('WFM600') !== -1)
        ? 'WFM600 — DETAILED DRAWING'
        : (keyUnit.code ? keyUnit.code + ' — DETAILED DRAWING' : (keyUnit.name || 'UNIT DETAIL').toUpperCase());
      canvas.text(detX + 400, 240, keyUnitTitle, 24, 'bold', 'middle', '#000000');
      canvas.line(detX + 160, 252, detX + 640, 252, '#000000', 1.8);

      var kW = parseFloat(keyUnit.dimensions.W) || 600;
      var kH = parseFloat(keyUnit.dimensions.H) || 720;
      var kD = parseFloat(keyUnit.dimensions.D) || 350;

      // ── Key Unit: External View with 3D Depth ──
      canvas.text(detX + 400, 310, 'EXTERNAL VIEW', 22, 'bold', 'middle', '#000000');
      canvas.line(detX + 280, 320, detX + 520, 320, '#000000', 1.5);

      var kBoxX = detX + 200, kBoxY = 370;
      var kBoxW = 380, kBoxH = 430;
      var kdX = 55, kdY = 32;

      // Top Face 3D Depth
      var kTopPoly = [
        { x: kBoxX, y: kBoxY },
        { x: kBoxX + kBoxW, y: kBoxY },
        { x: kBoxX + kBoxW + kdX, y: kBoxY - kdY },
        { x: kBoxX + kdX, y: kBoxY - kdY }
      ];
      canvas.polygon(kTopPoly, '#000000', 1.8, '#f1f5f9');
      // Side Face 3D Depth
      var kSidePoly = [
        { x: kBoxX + kBoxW, y: kBoxY },
        { x: kBoxX + kBoxW + kdX, y: kBoxY - kdY },
        { x: kBoxX + kBoxW + kdX, y: kBoxY - kdY + kBoxH },
        { x: kBoxX + kBoxW, y: kBoxY + kBoxH }
      ];
      canvas.polygon(kSidePoly, '#000000', 1.8, '#e2e8f0');

      // Front Face
      canvas.rect(kBoxX, kBoxY, kBoxW, kBoxH, '#000000', 2.5, '#ffffff');
      // Shutter Split & Swing Lines
      canvas.line(kBoxX + kBoxW / 2, kBoxY, kBoxX + kBoxW / 2, kBoxY + kBoxH, '#000000', 2);
      canvas.line(kBoxX + 6, kBoxY + 8, kBoxX + kBoxW / 2 - 6, kBoxY + kBoxH / 2, '#94a3b8', 1.2, '4,4');
      canvas.line(kBoxX + 6, kBoxY + kBoxH - 8, kBoxX + kBoxW / 2 - 6, kBoxY + kBoxH / 2, '#94a3b8', 1.2, '4,4');
      canvas.line(kBoxX + kBoxW - 6, kBoxY + 8, kBoxX + kBoxW / 2 + 6, kBoxY + kBoxH / 2, '#94a3b8', 1.2, '4,4');
      canvas.line(kBoxX + kBoxW - 6, kBoxY + kBoxH - 8, kBoxX + kBoxW / 2 + 6, kBoxY + kBoxH / 2, '#94a3b8', 1.2, '4,4');

      // Handles
      canvas.line(kBoxX + kBoxW / 2 - 14, kBoxY + kBoxH / 2 - 40, kBoxX + kBoxW / 2 - 14, kBoxY + kBoxH / 2 + 40, '#000000', 4.5);
      canvas.line(kBoxX + kBoxW / 2 + 14, kBoxY + kBoxH / 2 - 40, kBoxX + kBoxW / 2 + 14, kBoxY + kBoxH / 2 + 40, '#000000', 4.5);

      canvas.line(kBoxX + kBoxW / 2 + 18, kBoxY + kBoxH / 2 + 40, kBoxX + kBoxW + 70, kBoxY + kBoxH / 2 + 70, '#000000', 1.2);
      canvas.text(kBoxX + kBoxW + 75, kBoxY + kBoxH / 2 + 70, 'SHUTTER\nFINISH', 16, 'bold', 'start');

      canvas.dimH(kBoxX, kBoxX + kBoxW, kBoxY + kBoxH + 35, String(Math.round(kW)));
      canvas.dimV(kBoxY, kBoxY + kBoxH, kBoxX - 60, String(Math.round(kH)), 0, true);
      canvas.dimAligned(kBoxX + kBoxW, kBoxY, kBoxX + kBoxW + kdX, kBoxY - kdY, String(Math.round(kD)), 24);

      // ── Key Unit: Internal View with Compartment Clearances ──
      var kIntY = 960;
      canvas.text(detX + 400, kIntY - 20, 'INTERNAL VIEW', 22, 'bold', 'middle', '#000000');
      canvas.line(detX + 280, kIntY - 10, detX + 520, kIntY - 10, '#000000', 1.5);

      var kiBoxY = kIntY + 40;
      var kiBoxH = 460;
      // Carcass Gables
      canvas.rect(kBoxX, kiBoxY, kBoxW, kiBoxH, '#000000', 2.5, '#ffffff');
      canvas.rect(kBoxX, kiBoxY, 14, kiBoxH, '#000000', 1.5, '#94a3b8');
      canvas.rect(kBoxX + kBoxW - 14, kiBoxY, 14, kiBoxH, '#000000', 1.5, '#94a3b8');
      canvas.rect(kBoxX + 14, kiBoxY, kBoxW - 28, 14, '#000000', 1.5, '#94a3b8');
      canvas.rect(kBoxX + 14, kiBoxY + kiBoxH - 14, kBoxW - 28, 14, '#000000', 1.5, '#94a3b8');

      // 2 Adjustable Shelves (3 Compartments)
      var compH = (kiBoxH - 28 - 28) / 3;
      var sh1Y = kiBoxY + 14 + compH;
      var sh2Y = sh1Y + 14 + compH;
      canvas.rect(kBoxX + 14, sh1Y, kBoxW - 28, 14, '#000000', 1.5, '#94a3b8');
      canvas.rect(kBoxX + 14, sh2Y, kBoxW - 28, 14, '#000000', 1.5, '#94a3b8');

      // System 32 pin holes
      for (var ph = 1; ph <= 8; ph++) {
        var phy = kiBoxY + 20 + ph * ((kiBoxH - 40) / 9);
        canvas.circle(kBoxX + 20, phy, 2, '#64748b', 1, '#64748b');
        canvas.circle(kBoxX + kBoxW - 20, phy, 2, '#64748b', 1, '#64748b');
      }

      // Vertical Clearance Height Arrows inside compartments
      var clrVal = Math.round((kH - 72) / 3);
      canvas.dimInternalV(kBoxX + kBoxW / 2, kiBoxY + 14, sh1Y, clrVal + ' CLEAR');
      canvas.dimInternalV(kBoxX + kBoxW / 2, sh1Y + 14, sh2Y, clrVal + ' CLEAR');
      canvas.dimInternalV(kBoxX + kBoxW / 2, sh2Y + 14, kiBoxY + kiBoxH - 14, clrVal + ' CLEAR');

      canvas.dimH(kBoxX, kBoxX + kBoxW, kiBoxY + kiBoxH + 35, String(Math.round(kW)));
      canvas.dimV(kiBoxY, kiBoxY + kiBoxH, kBoxX - 60, String(Math.round(kH)), 0, true);

      return canvas.toSVG();
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // DYNAMIC PAGE 3+: DETAILED DUAL VIEW (EXTERNAL & INTERNAL) PER PLACED UNIT
    // ─────────────────────────────────────────────────────────────────────────────

    buildDynamicUnitPage: function (pageNum, totalPages, fn, index, pData) {
      var canvas = this.createVectorCanvas();
      var uName = (fn.name || 'MODULAR CABINET UNIT').replace(/\(Cookscape\)/i, '').trim();
      var uCode = fn.code || ('U0' + (index + 1));
      var pageTitle = uName + ' (' + uCode + ')';

      this.drawA4Template(canvas, pageNum, totalPages, pageTitle);

      var dims = fn.dimensions || {};
      var W = parseFloat(dims.W) || 600;
      var H = parseFloat(dims.H) || 720;
      var D = parseFloat(dims.D) || 600;
      var uConfig = fn.unitConfig || {};
      var shutters = uConfig.shutters !== undefined ? uConfig.shutters : (W > 1200 ? 3 : W > 600 ? 2 : 1);
      var drawers = uConfig.drawers || 0;
      var shelves = uConfig.shelves || (H > 1500 ? 4 : H > 900 ? 2 : 1);
      var isBaseUnit = (fn.category && fn.category.indexOf('base') !== -1) || H <= 900;
      var isSink = (uName.toLowerCase().indexOf('sink') !== -1) || !!uConfig.hasSink;
      var isHob = (uName.toLowerCase().indexOf('hob') !== -1 || uName.toLowerCase().indexOf('gas') !== -1) || !!uConfig.hasHob;
      var isPooja = (uName.toLowerCase().indexOf('pooja') !== -1) || !!uConfig.isPooja;
      var isWardrobe = (uName.toLowerCase().indexOf('wardrobe') !== -1) || (fn.category && fn.category.indexOf('wardrobe') !== -1) || H >= 1800;

      // Unit-specific production specs
      var carcassFin = (fn.materials && fn.materials.carcass && fn.materials.carcass.finish) || uConfig.carcass || this.meta.carcassColor;
      var shutterFin = (fn.materials && fn.materials.shutter && fn.materials.shutter.finish) || uConfig.shutterCol || this.meta.shutterType;

      var unitSpecs = [
        { label: 'UNIT TAG & CODE', val: uCode },
        { label: 'UNIT NAME', val: uName },
        { label: 'LENGTH / WIDTH', val: W + ' mm' },
        { label: 'DEPTH', val: D + ' mm' },
        { label: 'HEIGHT', val: H + ' mm' },
        { label: 'CARCASS SPEC', val: '18mm BWP (' + carcassFin + ')' },
        { label: 'SHUTTER SPEC', val: (drawers > 0 ? drawers + ' DRAWERS' : shutters + ' NO(S)') + ' (' + shutterFin + ')' },
        { label: 'HANDLE TYPE', val: uConfig.handle || 'EXTENDED SHUTTER 20mm' },
        { label: 'HINGES', val: 'EBCO SOFT CLOSING (110°)' },
        { label: 'RUNNERS', val: drawers > 0 ? 'EBCO SOFT CLOSING TANDEM' : 'N/A' },
        { label: 'PLINTH / BASE', val: isBaseUnit ? '110mm RCC / 100mm LEGS' : 'WALL MOUNTED' },
        { label: 'EDGE BANDING', val: '2mm PVC MATCH SHUTTER' }
      ];
      this.drawProductionDetails(canvas, unitSpecs);

      // Drafting Scale & Coordinates (allowing room for Cut-List Table & Swatch below)
      var scale = Math.min(680 / W, 580 / H, 0.70);
      var unitW = W * scale;
      var unitH = H * scale;
      var extX = 220;
      var intX = 1140;
      var baseY = 1040;
      var plinthH = isBaseUnit ? Math.max(26, 100 * scale) : 0;
      var granH = isBaseUnit ? Math.max(14, 20 * scale) : 0;

      // 3D Axonometric Depth Offsets (30-degree projection)
      var dScale = Math.min(90, Math.max(35, D * scale * 0.35));
      var cos30 = 0.866, sin30 = 0.5;
      var dX = dScale * cos30;
      var dY = dScale * sin30;

      // ═════════════════════════════════════════════════════════════════════════
      // ── LEFT: EXTERNAL VIEW (3D AXONOMETRIC CABINET PROJECTION) ──
      // ═════════════════════════════════════════════════════════════════════════
      canvas.text(extX + unitW / 2, 240, 'EXTERNAL VIEW', 30, 'bold', 'middle');
      canvas.line(extX + unitW / 2 - 120, 252, extX + unitW / 2 + 120, 252, '#000000', 2);

      var fx0 = extX, fy0 = baseY - unitH;

      // 1. Top Face Projection (Granite Slab or Top Panel)
      if (isBaseUnit) {
        // Granite Top with 15mm nosing overhang
        var grExt = 15 * scale;
        var grPoly = [
          { x: fx0 - grExt, y: fy0 - granH },
          { x: fx0 + unitW + grExt, y: fy0 - granH },
          { x: fx0 + unitW + grExt + dX, y: fy0 - granH - dY },
          { x: fx0 - grExt + dX, y: fy0 - granH - dY }
        ];
        canvas.polygon(grPoly, '#000000', 2, '#334155');
        // Front Edge of Granite
        canvas.rect(fx0 - grExt, fy0 - granH, unitW + 2 * grExt, granH, '#000000', 2, '#1e293b');
        // Right Side Edge of Granite
        var grSide = [
          { x: fx0 + unitW + grExt, y: fy0 - granH },
          { x: fx0 + unitW + grExt + dX, y: fy0 - granH - dY },
          { x: fx0 + unitW + grExt + dX, y: fy0 - dY },
          { x: fx0 + unitW + grExt, y: fy0 }
        ];
        canvas.polygon(grSide, '#000000', 1.8, '#1e293b');
        canvas.text(fx0 + unitW / 2 + dX / 2, fy0 - granH - dY - 14, 'GRANITE TOP (EXISTING)', 18, 'bold', 'middle', '#0f172a');

        // Granite callout pointer
        canvas.line(fx0 + unitW + grExt + dX * 0.5, fy0 - granH - dY * 0.5, fx0 + unitW + 110, fy0 - granH - dY * 0.5 - 25, '#000000', 1.4);
        canvas.text(fx0 + unitW + 115, fy0 - granH - dY * 0.5 - 25, 'GRANITE VISIBLE', 15, 'bold', 'start', '#0f172a');
      } else {
        // Top Panel Axonometric Face
        var topPoly = [
          { x: fx0, y: fy0 },
          { x: fx0 + unitW, y: fy0 },
          { x: fx0 + unitW + dX, y: fy0 - dY },
          { x: fx0 + dX, y: fy0 - dY }
        ];
        canvas.polygon(topPoly, '#000000', 2, '#f1f5f9');
      }

      // 2. Right Side Face Projection (Shows Cabinet Depth & Gable)
      var sidePoly = [
        { x: fx0 + unitW, y: fy0 },
        { x: fx0 + unitW + dX, y: fy0 - dY },
        { x: fx0 + unitW + dX, y: fy0 - dY + unitH },
        { x: fx0 + unitW, y: fy0 + unitH }
      ];
      canvas.polygon(sidePoly, '#000000', 2, '#e2e8f0');

      // Cabinet Depth Dimension along 30-deg receding edge
      canvas.dimAligned(fx0 + unitW, fy0, fx0 + unitW + dX, fy0 - dY, String(Math.round(D)), 28);

      // 3. Side Filler on Left (50BS / 55BS Blind Spacer)
      var fillerW = Math.max(12, 50 * scale);
      canvas.rect(fx0 - fillerW, fy0, fillerW, unitH, '#000000', 1.8, '#f8fafc');
      canvas.text(fx0 - fillerW / 2, fy0 + unitH / 2, '50BS', 15, 'bold', 'middle', '#0f172a', -90);
      canvas.dimH(fx0 - fillerW, fx0, baseY + plinthH + 35, '50BS');

      // 4. Main Front Cabinet Box
      canvas.rect(fx0, fy0, unitW, unitH, '#000000', 2.5, '#ffffff');

      // 5. Front Shutters or Drawers with Cookscape Hardware Details
      if (drawers > 0) {
        var drwH = unitH / drawers;
        var drwLabels = ['CUTLERY (140mm)', 'CUP & SAUCER (210mm)', 'THALI / POTS (280mm)', 'DEEP POT (350mm)'];
        for (var dr = 0; dr < drawers; dr++) {
          var dyPos = fy0 + dr * drwH;
          canvas.rect(fx0 + 2, dyPos + 2, unitW - 4, drwH - 4, '#000000', 1.5, '#f8fafc');
          // Drawer Tandem Horizontal Runner line
          canvas.line(fx0 + 8, dyPos + drwH / 2, fx0 + unitW - 8, dyPos + drwH / 2, '#cbd5e1', 1, '4,4');
          // G-Profile Handle line at top of drawer
          canvas.line(fx0 + 16, dyPos + 8, fx0 + unitW - 16, dyPos + 8, '#0f172a', 3.5);
          var drwLbl = dr < drwLabels.length ? drwLabels[dr] : ('DRAWER ' + (dr + 1));
          canvas.text(fx0 + unitW / 2, dyPos + drwH / 2 + 6, drwLbl, 15, 'bold', 'middle', '#334155');
        }
        // Handle callout pointer
        canvas.line(fx0 + unitW - 20, fy0 + 8, fx0 + unitW + 80, fy0 - 20, '#000000', 1.2);
        canvas.text(fx0 + unitW + 85, fy0 - 20, 'G-PROFILE HANDLE', 14, 'bold', 'start', '#0f172a');

      } else if (isPooja) {
        // Pooja Cabinet with CNC Cut Jali Mandala & Sacred Om
        var shCellW = unitW / shutters;
        for (var s = 1; s < shutters; s++) {
          canvas.line(fx0 + s * shCellW, fy0, fx0 + s * shCellW, fy0 + unitH, '#000000', 2);
        }
        // Jali Mandala Frame
        var mRad = Math.min(unitW, unitH) * 0.24;
        canvas.circle(fx0 + unitW / 2, fy0 + unitH / 2, mRad, '#b45309', 2.5, '#fffbeb');
        canvas.circle(fx0 + unitW / 2, fy0 + unitH / 2, mRad * 0.75, '#b45309', 1.8);
        canvas.circle(fx0 + unitW / 2, fy0 + unitH / 2, mRad * 0.50, '#b45309', 1.5);
        // Mandala Radial Spokes
        for (var spk = 0; spk < 8; spk++) {
          var ang = spk * (Math.PI / 4);
          canvas.line(
            fx0 + unitW / 2 + Math.cos(ang) * mRad * 0.5,
            fy0 + unitH / 2 + Math.sin(ang) * mRad * 0.5,
            fx0 + unitW / 2 + Math.cos(ang) * mRad,
            fy0 + unitH / 2 + Math.sin(ang) * mRad,
            '#b45309', 1.4
          );
        }
        canvas.text(fx0 + unitW / 2, fy0 + unitH / 2 + 15, 'ॐ', 42, 'bold', 'middle', '#b45309');
        canvas.text(fx0 + unitW / 2, fy0 + unitH / 2 + 78, 'CNC CUT JALI MANDALA', 16, 'bold', 'middle', '#b45309');
        canvas.text(fx0 + unitW / 2, fy0 + unitH - 24, shutters + ' SHUTTER(S) — ' + shutterFin, 16, 'bold', 'middle', '#64748b');

      } else {
        // Standard Shutters with 2mm Reveal & Architectural Swing Triangles
        var shCellW = unitW / shutters;
        for (var s = 1; s < shutters; s++) {
          canvas.line(fx0 + s * shCellW, fy0, fx0 + s * shCellW, fy0 + unitH, '#000000', 2);
        }
        for (var sh = 0; sh < shutters; sh++) {
          var scx1 = fx0 + sh * shCellW + 4;
          var scx2 = fx0 + (sh + 1) * shCellW - 4;
          var isLeftHinge = (sh % 2 === 0);
          // Architectural Door Swing Dashed Triangles
          var hx = isLeftHinge ? scx2 : scx1;
          var hxOpp = isLeftHinge ? scx1 : scx2;
          canvas.line(hxOpp, fy0 + 8, hx, fy0 + unitH / 2, '#94a3b8', 1.2, '4,4');
          canvas.line(hxOpp, fy0 + unitH - 8, hx, fy0 + unitH / 2, '#94a3b8', 1.2, '4,4');

          // Extended Shutter / Handle callout
          var handleBarX = isLeftHinge ? scx2 - 14 : scx1 + 14;
          canvas.line(handleBarX, fy0 + unitH / 2 - 50, handleBarX, fy0 + unitH / 2 + 50, '#000000', 5);
        }

        // 20mm Extended Shutter Callout
        canvas.line(fx0 + unitW - 14, fy0 + unitH / 2 + 50, fx0 + unitW + 70, fy0 + unitH / 2 + 70, '#000000', 1.2);
        canvas.text(fx0 + unitW + 75, fy0 + unitH / 2 + 70, '20mm EXTENDED SHUTTER', 14, 'bold', 'start', '#0f172a');
        canvas.text(fx0 + unitW / 2, fy0 + unitH - 24, shutters + ' SHUTTER(S) — ' + shutterFin, 16, 'bold', 'middle', '#64748b');
      }

      // 6. Plinth Base with RCC / Legs Details
      if (isBaseUnit) {
        canvas.rect(fx0, baseY, unitW, plinthH, '#000000', 2, '#e2e8f0');
        // Toe-kick 20mm setback lines
        canvas.line(fx0 + 15, baseY, fx0 + 15, baseY + plinthH, '#000000', 1.5);
        canvas.line(fx0 + unitW - 15, baseY, fx0 + unitW - 15, baseY + plinthH, '#000000', 1.5);
        canvas.text(fx0 + unitW / 2, baseY + plinthH / 2 + 6, '110 RCC BASE / 100mm PLINTH LEGS', 16, 'bold', 'middle', '#0f172a');
      }

      // 7. Multi-Tier External Dimension Chains
      canvas.dimH(fx0, fx0 + unitW, baseY + plinthH + 35, String(Math.round(W)));
      canvas.dimH(fx0 - fillerW, fx0 + unitW, baseY + plinthH + 75, String(Math.round(W + 50)) + ' (OVERALL)');
      canvas.dimV(baseY - unitH, baseY, fx0 - 65, String(Math.round(H)), 0, true);
      if (isBaseUnit) {
        canvas.dimV(baseY - unitH - granH, baseY + plinthH, fx0 - 110, String(Math.round(H + 110 + 20)), 0, true);
      }

      // ═════════════════════════════════════════════════════════════════════════
      // ── RIGHT: INTERNAL VIEW (3D AXONOMETRIC OPEN CARCASS PROJECTION) ──
      // ═════════════════════════════════════════════════════════════════════════
      canvas.text(intX + unitW / 2, 240, 'INTERNAL VIEW', 30, 'bold', 'middle');
      canvas.line(intX + unitW / 2 - 120, 252, intX + unitW / 2 + 120, 252, '#000000', 2);

      var ix0 = intX, iy0 = baseY - unitH;

      // 1. Granite Top on Internal View
      if (isBaseUnit) {
        var grExt = 15 * scale;
        var grPolyInt = [
          { x: ix0 - grExt, y: iy0 - granH },
          { x: ix0 + unitW + grExt, y: iy0 - granH },
          { x: ix0 + unitW + grExt + dX, y: iy0 - granH - dY },
          { x: ix0 - grExt + dX, y: iy0 - granH - dY }
        ];
        canvas.polygon(grPolyInt, '#000000', 2, '#334155');
        canvas.rect(ix0 - grExt, iy0 - granH, unitW + 2 * grExt, granH, '#000000', 2, '#1e293b');
        var grSideInt = [
          { x: ix0 + unitW + grExt, y: iy0 - granH },
          { x: ix0 + unitW + grExt + dX, y: iy0 - granH - dY },
          { x: ix0 + unitW + grExt + dX, y: iy0 - dY },
          { x: ix0 + unitW + grExt, y: iy0 }
        ];
        canvas.polygon(grSideInt, '#000000', 1.8, '#1e293b');
        canvas.text(ix0 + unitW / 2 + dX / 2, iy0 - granH - dY - 14, 'GRANITE TOP (EXISTING)', 18, 'bold', 'middle', '#0f172a');
      }

      // 2. Right Side Carcass Gable Axonometric Depth Face
      var intSidePoly = [
        { x: ix0 + unitW, y: iy0 },
        { x: ix0 + unitW + dX, y: iy0 - dY },
        { x: ix0 + unitW + dX, y: iy0 - dY + unitH },
        { x: ix0 + unitW, y: iy0 + unitH }
      ];
      canvas.polygon(intSidePoly, '#000000', 2, '#cbd5e1');

      // 3. Open Carcass Outer Outline
      canvas.rect(ix0, iy0, unitW, unitH, '#000000', 2.5, '#ffffff');

      // 4. 18mm Structural Panels (Gables, Bottom, Top Stretchers)
      var t = Math.max(8, 18 * scale);
      // Left Gable (18mm)
      canvas.rect(ix0, iy0, t, unitH, '#000000', 1.5, '#94a3b8');
      // Right Gable (18mm)
      canvas.rect(ix0 + unitW - t, iy0, t, unitH, '#000000', 1.5, '#94a3b8');
      // Bottom Panel (18mm)
      canvas.rect(ix0 + t, baseY - t, unitW - 2 * t, t, '#000000', 1.5, '#94a3b8');
      // Top Rails / Stretchers (18mm)
      canvas.rect(ix0 + t, iy0, unitW - 2 * t, t, '#000000', 1.5, '#94a3b8');

      // 5. Center Divider (18mm) for Multi-Door / Wide Units
      var hasCenterDivider = (shutters > 1 && W >= 900) || isWardrobe;
      var divX = ix0 + unitW / 2 - t / 2;
      if (hasCenterDivider) {
        canvas.rect(divX, iy0 + t, t, unitH - 2 * t, '#000000', 1.5, '#94a3b8');
      }

      // 6. System 32 Shelf Pin Holes Along Gables
      var pinCount = Math.max(6, Math.floor((unitH - 2 * t) / 32));
      for (var p = 1; p <= pinCount; p++) {
        var pyHole = iy0 + t + p * ((unitH - 2 * t) / (pinCount + 1));
        canvas.circle(ix0 + t + 6, pyHole, 2.5, '#64748b', 1, '#64748b');
        canvas.circle(ix0 + unitW - t - 6, pyHole, 2.5, '#64748b', 1, '#64748b');
        if (hasCenterDivider) {
          canvas.circle(divX - 6, pyHole, 2.5, '#64748b', 1, '#64748b');
          canvas.circle(divX + t + 6, pyHole, 2.5, '#64748b', 1, '#64748b');
        }
      }
      canvas.text(ix0 + unitW - t - 14, iy0 + 26, 'AJDUSTABLE', 12, 'bold', 'end', '#64748b');

      // 7. Internal Details & Exact Clearance Dimension Arrows (Clear Cavity Heights)
      var netInnerH = H - 36; // minus top & bottom 18mm
      if (isSink) {
        // Sink Internal: CNC Cut Vent, Plumbing P-Trap, Hot/Cold Water Stubs
        canvas.text(ix0 + unitW / 2, iy0 + unitH * 0.28, 'SINK 750 O/S (NEED CNC CUT FOR VENT)', 17, 'bold', 'middle', '#0284c7');
        // P-Trap Plumbing Waste Schematic
        var trX = ix0 + unitW / 2;
        var trY = iy0 + unitH * 0.52;
        canvas.line(trX, iy0 + 30, trX, trY, '#0284c7', 3);
        canvas.circle(trX, trY + 14, 16, '#0284c7', 2.5, 'none');
        canvas.line(trX + 16, trY + 14, trX + 45, trY + 35, '#0284c7', 3);
        // Floor Plumbing Void Note
        canvas.text(trX, baseY - t - 16, 'PLUMBING SERVICE CAVITY (1/2" INLET & 40mm DRAIN)', 13, 'bold', 'middle', '#0369a1');
        // Vertical Clearance Arrow inside sink cabinet
        canvas.dimInternalV(ix0 + t + 50, iy0 + t, baseY - t, Math.round(netInnerH) + ' CLEAR');

      } else if (isHob) {
        // Hob Internal: Gas 560 O/S, 2 Cylinders Provision & Vent Cut-outs
        canvas.text(ix0 + unitW / 2, iy0 + 36, 'GAS 560 O/S (2 CYLINDERS PROVISION)', 17, 'bold', 'middle', '#b45309');
        // Twin Cylinder Outlines on Bottom
        var cylW = (unitW - 2 * t) / 2;
        canvas.rect(ix0 + t + 10, baseY - t - 80, cylW - 20, 75, '#b45309', 1.8, '#fffbeb', 6);
        canvas.text(ix0 + t + cylW / 2, baseY - t - 40, 'CYLINDER 1\n(320mm Ø)', 13, 'bold', 'middle', '#b45309');
        canvas.rect(ix0 + t + cylW + 10, baseY - t - 80, cylW - 20, 75, '#b45309', 1.8, '#fffbeb', 6);
        canvas.text(ix0 + t + cylW * 1.5, baseY - t - 40, 'CYLINDER 2\n(320mm Ø)', 13, 'bold', 'middle', '#b45309');
        // Safety Air Vent Note
        canvas.text(ix0 + unitW / 2, iy0 + unitH * 0.42, 'SAFETY AIR VENTILATION PROVISION', 13, 'bold', 'middle', '#78350f');
        canvas.dimInternalV(ix0 + t + 50, iy0 + t, baseY - t - 85, Math.round(netInnerH - 220) + ' CLEAR');

      } else if (isWardrobe) {
        // Wardrobe Internal: Chrome Oval Hanging Rod + Internal Drawers + Top Shelf
        // Top Shelf (350mm down)
        var topShelfY = iy0 + t + (350 / H) * (unitH - 2 * t);
        canvas.rect(ix0 + t, topShelfY, unitW - 2 * t, t, '#000000', 1.5, '#94a3b8');
        canvas.dimInternalV(ix0 + t + 60, iy0 + t, topShelfY, '350 CLEAR');

        // Chrome Hanging Rod on Left Side
        var rodY = topShelfY + 45;
        canvas.rect(ix0 + t + 8, rodY - 6, (hasCenterDivider ? divX - ix0 - t - 16 : unitW - 2 * t - 16), 12, '#000000', 1.8, '#e2e8f0', 4);
        canvas.text(ix0 + t + (hasCenterDivider ? (divX - ix0 - t) / 2 : unitW / 2), rodY + 28, 'CHROME OVAL HANGING ROD', 13, 'bold', 'middle', '#0f172a');
        canvas.dimInternalV(ix0 + t + 60, topShelfY + t, baseY - t, Math.round(netInnerH - 400) + ' CLEAR');

        // Internal Drawer Chest on Right Side
        if (hasCenterDivider) {
          var rSecW = ix0 + unitW - t - (divX + t);
          var drwTop = baseY - t - 3 * (60 * scale);
          for (var dr = 0; dr < 3; dr++) {
            var dry = drwTop + dr * (60 * scale);
            canvas.rect(divX + t + 4, dry, rSecW - 8, 55 * scale, '#000000', 1.4, '#f8fafc');
            canvas.text(divX + t + rSecW / 2, dry + 25 * scale, 'INT. DRAWER ' + (dr + 1), 13, 'bold', 'middle', '#334155');
          }
          canvas.dimInternalV(divX + t + rSecW / 2, topShelfY + t, drwTop, Math.round(netInnerH - 350 - 550) + ' CLEAR');
        }

      } else if (isPooja) {
        // Pooja Internal: Backpanel with Spotlight + Diya Pull-out Tray
        canvas.text(ix0 + unitW / 2, iy0 + 36, '75mm THICKNESS BACKPANEL WITH SPOTLIGHT', 16, 'bold', 'middle', '#b45309');
        canvas.circle(ix0 + unitW / 2, iy0 + 65, 14, '#b45309', 2, '#fde68a');
        canvas.text(ix0 + unitW / 2, iy0 + 95, 'LED WARM WHITE SPOTLIGHT', 12, 'bold', 'middle', '#b45309');
        // Brass Diya Pull-out Tray on Telescopic Runners
        var trayY = baseY - t - 110 * scale;
        canvas.rect(ix0 + t + 6, trayY, unitW - 2 * t - 12, 22 * scale, '#b45309', 1.8, '#fef3c7');
        canvas.text(ix0 + unitW / 2, trayY + 15 * scale, 'SLIDING PRASADAM / DIYA TRAY (TELESCOPIC RUNNER)', 13, 'bold', 'middle', '#b45309');
        // Clear Height arrows
        canvas.dimInternalV(ix0 + t + 60, iy0 + t, trayY, Math.round(netInnerH - 180) + ' CLEAR');
        canvas.dimInternalV(ix0 + t + 60, trayY + 22 * scale, baseY - t, '160 CLEAR');

      } else {
        // Standard Shelving with Exact Vertical Clearance Height Arrows inside every compartment
        var compCount = shelves + 1;
        var clearH = (netInnerH - (shelves * 18)) / compCount;
        var compH = (unitH - 2 * t - (shelves * t)) / compCount;

        for (var k = 1; k <= shelves; k++) {
          var shY = baseY - t - k * (compH + t);
          canvas.rect(ix0 + t, shY, unitW - 2 * t, t, '#000000', 1.5, '#94a3b8');
        }

        // Draw Clearance Height Arrow inside each compartment
        for (var c = 0; c < compCount; c++) {
          var cTop = iy0 + t + c * (compH + t);
          var cBot = cTop + compH;
          var arrX = hasCenterDivider ? (ix0 + t + (divX - ix0 - t) / 2) : (ix0 + unitW / 2);
          canvas.dimInternalV(arrX, cTop, cBot, Math.round(clearH) + ' CLEAR');
          if (hasCenterDivider) {
            canvas.dimInternalV(divX + t + (ix0 + unitW - t - divX - t) / 2, cTop, cBot, Math.round(clearH) + ' CLEAR');
          }
        }
      }

      // 8. Plinth on Internal View
      if (isBaseUnit) {
        canvas.rect(ix0, baseY, unitW, plinthH, '#000000', 2, '#e2e8f0');
        canvas.text(ix0 + unitW / 2, baseY + plinthH / 2 + 6, '100mm PLINTH / LEGS', 16, 'bold', 'middle', '#0f172a');
      }

      // 9. Multi-Tier Internal Dimensions
      canvas.dimH(ix0, ix0 + unitW, baseY + plinthH + 35, String(Math.round(W)));
      canvas.dimV(baseY - unitH, baseY, ix0 - 65, String(Math.round(H)), 0, true);

      // ═════════════════════════════════════════════════════════════════════════
      // ── BOTTOM LEFT: 6-COLUMN PANEL SCHEDULE & BOM CUT-LIST TABLE ──
      // ═════════════════════════════════════════════════════════════════════════
      var tblX = 100, tblY = 1250;
      var tblW = 1340, tblH = 490;
      var rowH = 46;

      // Outer Table Box & Header
      canvas.rect(tblX, tblY, tblW, tblH, '#000000', 2.5, '#ffffff');
      canvas.rect(tblX, tblY, tblW, 52, '#000000', 1.8, '#f1f5f9');
      canvas.text(tblX + 20, tblY + 34, 'CABINET COMPONENT SCHEDULE & PANEL CUT-LIST (18mm BWP PLYWOOD / 8mm BACK)', 20, 'bold', 'start', '#0f172a');

      // Column Header Row
      var colY = tblY + 52;
      canvas.rect(tblX, colY, tblW, 42, '#000000', 1.5, '#e2e8f0');
      var cols = [
        { label: 'SL', w: 60 },
        { label: 'PART NAME', w: 310 },
        { label: 'QTY', w: 80 },
        { label: 'CUT LENGTH', w: 170 },
        { label: 'CUT WIDTH', w: 170 },
        { label: 'THK', w: 100 },
        { label: 'MATERIAL SPECIFICATION', w: 450 }
      ];

      var cX = tblX;
      cols.forEach(function (col, ci) {
        if (ci > 0) canvas.line(cX, colY, cX, tblY + tblH, '#000000', 1.2);
        canvas.text(cX + col.w / 2, colY + 27, col.label, 15, 'bold', 'middle', '#0f172a');
        cX += col.w;
      });

      // Calculate Real Cut-List Dimensions
      var gableL = isBaseUnit ? Math.round(H - 20) : Math.round(H);
      var bottomL = Math.round(W - 36);
      var shelfL = hasCenterDivider ? Math.round((W - 36 - 18) / 2) : Math.round(W - 36);
      var backL = Math.round(H - 36), backW = Math.round(W - 18);
      var shutterL = drawers > 0 ? Math.round((H - (drawers * 3)) / drawers) : Math.round(H - 4);
      var shutterW = drawers > 0 ? Math.round(W - 4) : Math.round((W - (shutters * 3)) / shutters);

      var bomRows = [
        { sl: '01', name: 'LEFT GABLE (SIDE PANEL)', qty: '1', l: gableL + ' mm', w: Math.round(D) + ' mm', thk: '18 mm', mat: 'BWP Marine Ply (' + carcassFin + ')' },
        { sl: '02', name: 'RIGHT GABLE (SIDE PANEL)', qty: '1', l: gableL + ' mm', w: Math.round(D) + ' mm', thk: '18 mm', mat: 'BWP Marine Ply (' + carcassFin + ')' },
        { sl: '03', name: 'BOTTOM PANEL', qty: '1', l: bottomL + ' mm', w: Math.round(D) + ' mm', thk: '18 mm', mat: 'BWP Marine Ply (' + carcassFin + ')' },
        { sl: '04', name: 'TOP STRETCHERS / RAILS', qty: '2', l: bottomL + ' mm', w: '100 mm', thk: '18 mm', mat: 'BWP Marine Ply (' + carcassFin + ')' },
        { sl: '05', name: hasCenterDivider ? 'CENTER PARTITION' : 'INTERNAL SHELVES', qty: hasCenterDivider ? '1' : String(shelves), l: (hasCenterDivider ? Math.round(H - 56) : shelfL) + ' mm', w: Math.round(D - 20) + ' mm', thk: '18 mm', mat: 'BWP Marine Ply (' + carcassFin + ')' },
        { sl: '06', name: hasCenterDivider ? 'INTERNAL SHELVES' : 'BACK PANEL (REBATE)', qty: hasCenterDivider ? String(shelves * 2) : '1', l: (hasCenterDivider ? shelfL : backL) + ' mm', w: (hasCenterDivider ? Math.round(D - 20) : backW) + ' mm', thk: hasCenterDivider ? '18 mm' : '8 mm', mat: 'BWP Marine Ply (' + carcassFin + ')' },
        { sl: '07', name: hasCenterDivider ? 'BACK PANEL (REBATE)' : 'FRONT SHUTTER / DRAWERS', qty: hasCenterDivider ? '1' : String(drawers > 0 ? drawers : shutters), l: (hasCenterDivider ? backL : shutterL) + ' mm', w: (hasCenterDivider ? backW : shutterW) + ' mm', thk: hasCenterDivider ? '8 mm' : '18 mm', mat: hasCenterDivider ? 'BWP Marine Ply (Backer)' : ('BWP MDF (' + shutterFin + ')') },
        { sl: '08', name: hasCenterDivider ? 'FRONT SHUTTER / DRAWERS' : 'SKIRTING / PLINTH FASCIA', qty: hasCenterDivider ? String(drawers > 0 ? drawers : shutters) : '1', l: (hasCenterDivider ? shutterL : Math.round(W)) + ' mm', w: (hasCenterDivider ? shutterW : 100) + ' mm', thk: '18 mm', mat: hasCenterDivider ? ('BWP MDF (' + shutterFin + ')') : 'PVC WATERPROOF MATCHING' }
      ];

      var rY = colY + 42;
      bomRows.forEach(function (row, ri) {
        if (rY + rowH > tblY + tblH + 5) return;
        canvas.line(tblX, rY, tblX + tblW, rY, '#000000', 1);
        var currColX = tblX;
        var vals = [row.sl, row.name, row.qty, row.l, row.w, row.thk, row.mat];
        vals.forEach(function (v, vi) {
          var align = (vi === 1 || vi === 6) ? 'start' : 'middle';
          var tx = (vi === 1 || vi === 6) ? currColX + 16 : currColX + cols[vi].w / 2;
          canvas.text(tx, rY + 28, v, 14, vi === 1 ? 'bold' : 'normal', align, '#0f172a');
          currColX += cols[vi].w;
        });
        rY += rowH;
      });

      // ═════════════════════════════════════════════════════════════════════════
      // ── BOTTOM RIGHT: INSET WOODGRAIN SWATCH & HARDWARE SPECIFICATIONS ──
      // ═════════════════════════════════════════════════════════════════════════
      var swX = 1480, swY = 1250;
      var swW = 560, swH = 260;

      // Realistic Woodgrain Inset Texture Swatch Card
      canvas.swatch(swX, swY + 20, swW, swH - 20, shutterFin);

      // Hardware & Fitting Callout Box below Swatch
      var hwY = swY + swH + 18;
      var hwH = 190;
      canvas.rect(swX, hwY, swW, hwH, '#000000', 2, '#f8fafc', 4);
      canvas.text(swX + 20, hwY + 32, 'HARDWARE & FITTINGS SPECIFICATIONS', 17, 'bold', 'start', '#0f172a');
      canvas.line(swX + 20, hwY + 40, swX + 380, hwY + 40, '#000000', 1.5);

      var hwNotes = [
        '• HINGES: EBCO / HETTICH 110° SOFT-CLOSE CLIP-ON',
        '• RUNNERS: EBCO PROMOTION SOFT-CLOSE 450mm TANDEM',
        '• HANDLE: ' + (uConfig.handle || 'G-PROFILE / 20mm EXTENDED SHUTTER'),
        '• EDGE BAND: 2mm PVC ON EXPOSED / 0.8mm ON INNER GABLES',
        '• FILLER: 50BS / 65BS (SCRIBE TO SITE WALL INCLUDED)'
      ];
      var nY = hwY + 68;
      hwNotes.forEach(function (hn) {
        canvas.text(swX + 20, nY, hn, 14, 'bold', 'start', '#334155');
        nY += 24;
      });

      return canvas.toSVG();
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // DYNAMIC LOFT RUN PAGE
    // ─────────────────────────────────────────────────────────────────────────────

    buildDynamicLoftPage: function (pageNum, totalPages, loftUnits, pData) {
      var canvas = this.createVectorCanvas();
      this.drawA4Template(canvas, pageNum, totalPages, 'CONTINUOUS LOFT RUN (ONLY SHUTTERING)');
      this.drawProductionDetails(canvas);

      var startX = 220;
      var startY = 820;
      var totalSpan = 0;
      loftUnits.forEach(function (lu) {
        var w = (lu.dimensions && lu.dimensions.W) ? parseFloat(lu.dimensions.W) : 600;
        totalSpan += w;
      });
      totalSpan = Math.max(1200, totalSpan);
      var loftH = (loftUnits[0] && loftUnits[0].dimensions && parseFloat(loftUnits[0].dimensions.H)) || 600;
      var scale = Math.min(1700 / totalSpan, 380 / loftH, 0.45);

      var spanW = totalSpan * scale;
      var spanH = loftH * scale;

      canvas.text(startX + spanW / 2, 380, 'CONTINUOUS LOFT RUN (ONLY SHUTTERING)', 34, 'bold', 'middle');
      canvas.line(startX + spanW / 2 - 250, 400, startX + spanW / 2 + 250, 400, '#000000', 2.5);

      canvas.rect(startX, startY - spanH, spanW, spanH, '#000000', 3, '#ffffff');

      var curX = startX;
      loftUnits.forEach(function (lu) {
        var w = ((lu.dimensions && parseFloat(lu.dimensions.W)) || 600) * scale;
        canvas.line(curX + w, startY - spanH, curX + w, startY, '#000000', 2);
        canvas.text(curX + w / 2, startY - spanH / 2, lu.code || 'LOFT', 18, 'bold', 'middle');
        curX += w;
      });

      canvas.dimH(startX, startX + spanW, startY + 80, String(Math.round(totalSpan)));
      canvas.dimV(startY - spanH, startY, startX - 70, String(Math.round(loftH)), 0, true);

      return canvas.toSVG();
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // MULTI-PAGE DECK COMPILER (AUTOMATIC SWITCHING BETWEEN DYNAMIC & TEMPLATE)
    // ─────────────────────────────────────────────────────────────────────────────

    generateAllPages: function () {
      var pData = this.getProjectData();
      var walls = pData.walls || [];
      var openings = pData.openings || [];
      var rooms = pData.rooms || [];
      var furniture = pData.furniture || [];
      var proj = pData.project || {};
      var meta = proj.meta || {};

      // Sync active metadata
      if (meta.clientName || proj.clientName) this.meta.client = meta.clientName || proj.clientName;
      if (meta.title || proj.name) this.meta.site = meta.title || proj.name;
      if (proj.code) this.meta.prCode = proj.code;
      if (meta.designerName) this.meta.designer = meta.designerName;

      var pages = [];

      // Check if project has user-drawn walls or placed modular units:
      var isDynamicProject = (walls.length > 0 || furniture.length > 0);

      if (isDynamicProject) {
        var loftUnits = furniture.filter(function (f) {
          var c = (f.category || '').toLowerCase(), n = (f.name || '').toLowerCase();
          return c.indexOf('loft') !== -1 || n.indexOf('loft') !== -1 || (f.unitConfig && f.unitConfig.loft);
        });

        var totalPages = 2 + furniture.length + (loftUnits.length > 0 ? 1 : 0);

        // Page 1: Real 2D Floor Plan
        pages.push({
          index: 1,
          title: (this.meta.dwgTitle || 'ROOM') + ' 2D FLOOR PLAN & UNIT LAYOUT',
          svg: this.buildDynamicPage1_FloorPlan(1, totalPages, pData)
        });

        // Page 2: Real 3D Axonometric Overview
        pages.push({
          index: 2,
          title: (this.meta.dwgTitle || 'ROOM') + ' 3D AXONOMETRIC & KEY UNIT',
          svg: this.buildDynamicPage2_3DOverview(2, totalPages, pData)
        });

        // Pages 3+: Individual Unit Detailed Shop Drawings (External & Internal)
        for (var i = 0; i < furniture.length; i++) {
          var uIdx = i + 1;
          var curPageNum = 3 + i;
          var fn = furniture[i];
          var uTitle = (fn.name || 'MODULAR UNIT') + ' (' + (fn.code || ('U0' + uIdx)) + ')';
          pages.push({
            index: curPageNum,
            title: uTitle,
            svg: this.buildDynamicUnitPage(curPageNum, totalPages, fn, i, pData)
          });
        }

        // Optional Loft Sheet
        if (loftUnits.length > 0) {
          var loftPageNum = totalPages;
          pages.push({
            index: loftPageNum,
            title: 'CONTINUOUS LOFT RUN (ONLY SHUTTERING)',
            svg: this.buildDynamicLoftPage(loftPageNum, totalPages, loftUnits, pData)
          });
        }

      } else {
        // Fallback to reference Cookscape standard demo deck (Pages 1-8) matching Mrs. Priyanka mam 2d.pdf
        var demoWalls = [
          { id: 'w1', start: { x: 0, y: 0 }, end: { x: 3080, y: 0 }, thickness: 150 },
          { id: 'w2', start: { x: 3080, y: 0 }, end: { x: 3080, y: 2930 }, thickness: 150 },
          { id: 'w3', start: { x: 3080, y: 2930 }, end: { x: 0, y: 2930 }, thickness: 150 },
          { id: 'w4', start: { x: 0, y: 2930 }, end: { x: 0, y: 0 }, thickness: 150 }
        ];
        var demoOpenings = [
          { id: 'op1', wallId: 'w1', type: 'window', offset: 1540, width: 1205 },
          { id: 'op2', wallId: 'w3', type: 'door', offset: 1200, width: 900 }
        ];
        var demoFurniture = [
          { id: 'df1', name: 'SINK UNIT 750', code: 'BU01', category: 'base', dimensions: { W: 750, D: 600, H: 860 }, pos: { x: 600, y: 350, z: 0 }, unitConfig: { shutters: 2, drawers: 0, hasSink: true, carcass: 'Half White', shutterCol: 'Surabhi' } },
          { id: 'df2', name: 'CORNER UNIT 1050', code: 'BU02', category: 'base', dimensions: { W: 1050, D: 600, H: 860 }, pos: { x: 1550, y: 350, z: 0 }, unitConfig: { shutters: 1, drawers: 0, carcass: 'Half White', shutterCol: 'Surabhi' } },
          { id: 'df3', name: 'GAS HOB UNIT 900', code: 'BU03', category: 'base', dimensions: { W: 900, D: 600, H: 860 }, pos: { x: 2400, y: 350, z: 0 }, unitConfig: { shutters: 2, drawers: 0, hasHob: true, carcass: 'Half White', shutterCol: 'Surabhi' } },
          { id: 'df4', name: 'POOJA UNIT WITH CNC CUT JALI', code: 'PU01', category: 'tall', dimensions: { W: 900, D: 450, H: 1800 }, pos: { x: 2800, y: 1200, z: 0 }, unitConfig: { shutters: 2, drawers: 0, isPooja: true, carcass: 'Half White', shutterCol: 'Surabhi' } },
          { id: 'df5', name: 'WALL UNIT 600 (WFM600)', code: 'WFM600', category: 'wall', dimensions: { W: 600, D: 350, H: 720 }, pos: { x: 600, y: 350, z: 1400 }, unitConfig: { shutters: 2, drawers: 0, shelves: 2, carcass: 'Half White', shutterCol: 'Surabhi' } },
          { id: 'df6', name: 'WALL GLASS UNIT 900', code: 'WU02', category: 'wall', dimensions: { W: 900, D: 350, H: 720 }, pos: { x: 1550, y: 350, z: 1400 }, unitConfig: { shutters: 2, drawers: 0, shelves: 2, carcass: 'Half White', shutterCol: 'Frosty White' } }
        ];
        var demoRooms = [
          { id: 'rm1', name: 'KITCHEN', area: 9024400, polygon: [{ x: 0, y: 0 }, { x: 3080, y: 0 }, { x: 3080, y: 2930 }, { x: 0, y: 2930 }] }
        ];
        var demoPData = {
          project: proj,
          plan: { walls: demoWalls, openings: demoOpenings, furniture: demoFurniture, rooms: demoRooms },
          walls: demoWalls,
          openings: demoOpenings,
          rooms: demoRooms,
          furniture: demoFurniture
        };

        var totalPages = 8;
        pages.push({ index: 1, title: 'KITCHEN FLOOR PLAN & APPLIANCE LAYOUT (REFERENCE DEMO)', svg: this.buildDynamicPage1_FloorPlan(1, totalPages, demoPData) });
        pages.push({ index: 2, title: '3D AXONOMETRIC & WFM600 DETAIL (REFERENCE DEMO)', svg: this.buildDynamicPage2_3DOverview(2, totalPages, demoPData) });

        for (var d = 0; d < demoFurniture.length; d++) {
          var dNum = 3 + d;
          var dfn = demoFurniture[d];
          pages.push({
            index: dNum,
            title: dfn.name + ' (' + dfn.code + ') [REFERENCE DEMO]',
            svg: this.buildDynamicUnitPage(dNum, totalPages, dfn, d, demoPData)
          });
        }
      }

      return pages;
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // AUTOCAD DXF R12 EXPORT (AC1009)
    // ─────────────────────────────────────────────────────────────────────────────

    exportDXF: function (pageIndex) {
      var m = this.meta;
      var out = [
        "0", "SECTION", "2", "HEADER", "9", "$ACADVER", "1", "AC1009", "0", "ENDSEC",
        "0", "SECTION", "2", "TABLES",
        "0", "TABLE", "2", "LAYER", "70", "6",
        "0", "LAYER", "2", "OUTLINE", "70", "0", "62", "7", "6", "CONTINUOUS", "0",
        "0", "LAYER", "2", "CARCASS", "70", "0", "62", "4", "6", "CONTINUOUS", "0",
        "0", "LAYER", "2", "SHUTTER", "70", "0", "62", "1", "6", "CONTINUOUS", "0",
        "0", "LAYER", "2", "DIMENSIONS", "70", "0", "62", "3", "6", "CONTINUOUS", "0",
        "0", "LAYER", "2", "TITLEBLOCK", "70", "0", "62", "2", "6", "CONTINUOUS", "0",
        "0", "LAYER", "2", "TEXT", "70", "0", "62", "7", "6", "CONTINUOUS", "0",
        "0", "ENDTAB", "0", "ENDSEC",
        "0", "SECTION", "2", "ENTITIES"
      ];

      function line(x1, y1, x2, y2, layer) {
        out.push("0", "LINE", "8", layer || "OUTLINE", "10", x1.toFixed(1), "20", y1.toFixed(1), "11", x2.toFixed(1), "21", y2.toFixed(1));
      }

      function text(x, y, str, size, layer) {
        var clean = String(str).replace(/[^\x20-\x7E]/g, " ");
        out.push("0", "TEXT", "8", layer || "TEXT", "10", x.toFixed(1), "20", y.toFixed(1), "40", String(size || 35), "1", clean);
      }

      // Outer A4 Border (2970 x 2100 mm in CAD space)
      line(40, 40, 2930, 40, "TITLEBLOCK");
      line(2930, 40, 2930, 2060, "TITLEBLOCK");
      line(2930, 2060, 40, 2060, "TITLEBLOCK");
      line(40, 2060, 40, 40, "TITLEBLOCK");

      // Title Block
      line(60, 310, 2910, 310, "TITLEBLOCK");
      text(100, 220, "CLIENT : " + m.client, 40, "TEXT");
      text(100, 140, "SITE   : " + m.site, 40, "TEXT");
      text(100, 60, "DWG    : 2D PRODUCTION DRAWINGS", 40, "TEXT");
      text(1200, 220, m.companyName + " — " + m.companyFull, 45, "TITLEBLOCK");
      text(1200, 140, "PAGE " + (pageIndex + 1) + " | P.R. CODE: " + m.prCode, 35, "TEXT");

      out.push("0", "ENDSEC", "0", "EOF");
      var dxfContent = out.join("\r\n");

      // Trigger browser download if DOM environment
      if (typeof document !== 'undefined' && document.body && typeof Blob !== 'undefined' && typeof URL !== 'undefined' && URL.createObjectURL) {
        try {
          var blob = new Blob([dxfContent], { type: 'application/dxf' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob);
          a.download = 'cookscape-2d-drawing-page-' + (pageIndex + 1) + '.dxf';
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
        } catch (_) {}
      }

      if (typeof window !== 'undefined' && typeof window.toast === 'function') {
        window.toast('📐 Downloaded AutoCAD DXF (Page ' + (pageIndex + 1) + ')');
      }

      return dxfContent;
    },

    // ── Print Multi-Page Vector PDF (A4 Landscape) ──
    printAllPages: function () {
      var pages = this.generateAllPages();
      var printContainer = document.getElementById('a4PrintContainer');
      if (!printContainer) {
        printContainer = document.createElement('div');
        printContainer.id = 'a4PrintContainer';
        document.body.appendChild(printContainer);
      }

      printContainer.innerHTML = '';
      for (var i = 0; i < pages.length; i++) {
        var pageDiv = document.createElement('div');
        pageDiv.className = 'a4-print-page';
        pageDiv.innerHTML = pages[i].svg;
        printContainer.appendChild(pageDiv);
      }

      setTimeout(function () {
        window.print();
      }, 200);
    },

    // ── Interactive UI Controller & Event Binding ──
    initUI: function () {
      var self = this;
      var prevBtn = document.getElementById('a4PrevBtn');
      var nextBtn = document.getElementById('a4NextBtn');
      var pageSel = document.getElementById('a4PageSelect');
      var dxfBtn = document.getElementById('a4DxfBtn');
      var pdfBtn = document.getElementById('a4PdfBtn');
      var printBtn = document.getElementById('a4PrintBtn');
      var metaBtn = document.getElementById('a4MetaBtn');
      var metaModal = document.getElementById('a4MetaModal');
      var metaClose = document.getElementById('a4MetaCloseBtn');
      var metaCancel = document.getElementById('a4MetaCancelBtn');
      var metaSave = document.getElementById('a4MetaSaveBtn');

      if (prevBtn) {
        prevBtn.onclick = function () {
          var pages = self.generateAllPages();
          self.activePageIndex = (self.activePageIndex - 1 + pages.length) % pages.length;
          self.renderActivePage();
        };
      }

      if (nextBtn) {
        nextBtn.onclick = function () {
          var pages = self.generateAllPages();
          self.activePageIndex = (self.activePageIndex + 1) % pages.length;
          self.renderActivePage();
        };
      }

      if (pageSel) {
        pageSel.onchange = function () {
          self.activePageIndex = parseInt(pageSel.value, 10) || 0;
          self.renderActivePage();
        };
      }

      if (dxfBtn) {
        dxfBtn.onclick = function () {
          self.exportDXF(self.activePageIndex);
        };
      }

      if (pdfBtn) {
        pdfBtn.onclick = function () {
          if (typeof window.toast === 'function') {
            window.toast('🖨 Opening print dialogue — select "Save as PDF" (A4 Landscape)');
          }
          self.printAllPages();
        };
      }

      if (printBtn) {
        printBtn.onclick = function () {
          self.printAllPages();
        };
      }

      if (metaBtn && metaModal) {
        metaBtn.onclick = function () {
          var cIn = document.getElementById('a4MetaClient'); if (cIn) cIn.value = self.meta.client;
          var sIn = document.getElementById('a4MetaSite'); if (sIn) sIn.value = self.meta.site;
          var prIn = document.getElementById('a4MetaPrCode'); if (prIn) prIn.value = self.meta.prCode;
          var bIn = document.getElementById('a4MetaBranch'); if (bIn) bIn.value = self.meta.branch;
          var surIn = document.getElementById('a4MetaSurveyor'); if (surIn) surIn.value = self.meta.surveyor;
          var desIn = document.getElementById('a4MetaDesigner'); if (desIn) desIn.value = self.meta.designer;
          var estIn = document.getElementById('a4MetaEstimator'); if (estIn) estIn.value = self.meta.estimator;
          var engIn = document.getElementById('a4MetaEngineer'); if (engIn) engIn.value = self.meta.engineer;
          var ctIn = document.getElementById('a4MetaCarcassType'); if (ctIn) ctIn.value = self.meta.carcassType;
          var ccIn = document.getElementById('a4MetaCarcassColor'); if (ccIn) ccIn.value = self.meta.carcassColor;
          var stIn = document.getElementById('a4MetaShutterType'); if (stIn) stIn.value = self.meta.shutterType;
          var hwIn = document.getElementById('a4MetaHardware'); if (hwIn) hwIn.value = self.meta.hingesBrand;
          metaModal.style.display = 'flex';
        };
      }

      function closeModal() {
        if (metaModal) metaModal.style.display = 'none';
      }

      if (metaClose) metaClose.onclick = closeModal;
      if (metaCancel) metaCancel.onclick = closeModal;

      if (metaSave) {
        metaSave.onclick = function () {
          var cIn = document.getElementById('a4MetaClient'); if (cIn && cIn.value) self.meta.client = cIn.value.trim();
          var sIn = document.getElementById('a4MetaSite'); if (sIn && sIn.value) self.meta.site = sIn.value.trim();
          var prIn = document.getElementById('a4MetaPrCode'); if (prIn && prIn.value) self.meta.prCode = prIn.value.trim();
          var bIn = document.getElementById('a4MetaBranch'); if (bIn && bIn.value) self.meta.branch = bIn.value.trim();
          var surIn = document.getElementById('a4MetaSurveyor'); if (surIn && surIn.value) self.meta.surveyor = surIn.value.trim();
          var desIn = document.getElementById('a4MetaDesigner'); if (desIn && desIn.value) self.meta.designer = desIn.value.trim();
          var estIn = document.getElementById('a4MetaEstimator'); if (estIn && estIn.value) self.meta.estimator = estIn.value.trim();
          var engIn = document.getElementById('a4MetaEngineer'); if (engIn && engIn.value) self.meta.engineer = engIn.value.trim();
          var ctIn = document.getElementById('a4MetaCarcassType'); if (ctIn && ctIn.value) self.meta.carcassType = ctIn.value.trim();
          var ccIn = document.getElementById('a4MetaCarcassColor'); if (ccIn && ccIn.value) self.meta.carcassColor = ccIn.value.trim();
          var stIn = document.getElementById('a4MetaShutterType'); if (stIn && stIn.value) self.meta.shutterType = stIn.value.trim();
          var hwIn = document.getElementById('a4MetaHardware'); if (hwIn && hwIn.value) self.meta.hingesBrand = hwIn.value.trim();
          closeModal();
          self.renderActivePage();
          if (typeof window.toast === 'function') {
            window.toast('✓ Title block & production specifications updated');
          }
        };
      }
    },

    renderActivePage: function () {
      var self = this;
      var draft = document.getElementById('draft');
      if (!draft) return;

      var pages = this.generateAllPages();
      if (!pages || !pages.length) return;

      if (this.activePageIndex >= pages.length) this.activePageIndex = 0;
      if (this.activePageIndex < 0) this.activePageIndex = 0;

      var curPage = pages[this.activePageIndex];
      draft.innerHTML = curPage.svg;

      // Update Page Dropdown
      var pageSel = document.getElementById('a4PageSelect');
      if (pageSel) {
        pageSel.innerHTML = '';
        for (var p = 0; p < pages.length; p++) {
          var opt = document.createElement('option');
          opt.value = p;
          opt.textContent = 'Page ' + (p + 1) + ': ' + pages[p].title;
          if (p === this.activePageIndex) opt.selected = true;
          pageSel.appendChild(opt);
        }
      }

      // Update Thumbnail Strip
      var thumbStrip = document.getElementById('a4ThumbStrip');
      if (thumbStrip) {
        thumbStrip.innerHTML = '';
        var _loop_thumb = function (t) {
          var chip = document.createElement('div');
          chip.className = 'a4-thumb-chip' + (t === self.activePageIndex ? ' is-active' : '');
          chip.innerHTML = '<span>📄 P' + (t + 1) + '</span> ' + pages[t].title;
          chip.onclick = function () {
            self.activePageIndex = t;
            self.renderActivePage();
          };
          thumbStrip.appendChild(chip);
        };
        for (var t = 0; t < pages.length; t++) {
          _loop_thumb(t);
        }
      }

      // Ensure event listeners are attached
      this.initUI();
    }
  };

  root.OrbixA4Drawings = A4Engine;

  // Auto-init on DOM ready
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () { A4Engine.initUI(); });
    } else {
      A4Engine.initUI();
    }
  }

})(typeof window !== 'undefined' ? window : this);
