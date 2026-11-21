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

      // Draw Room Walls
      walls.forEach(function (w) {
        if (!w.start || !w.end) return;
        var p1 = toScreen(w.start);
        var p2 = toScreen(w.end);
        var thick = Math.max(4, (w.thickness || 150) * scale);
        
        // Solid Wall Line
        canvas.line(p1.x, p1.y, p2.x, p2.y, '#000000', thick);

        // Wall Dimension string
        var lenMm = Math.round(Math.hypot(w.end.x - w.start.x, w.end.y - w.start.y));
        var midX = (p1.x + p2.x) / 2;
        var midY = (p1.y + p2.y) / 2;
        var dx = p2.x - p1.x, dy = p2.y - p1.y;
        var len = Math.hypot(dx, dy) || 1;
        var nx = -dy / len, ny = dx / len;
        canvas.text(midX + nx * 24, midY + ny * 24, String(lenMm), 18, 'bold', 'middle', '#0f172a');
      });

      // Draw Doors & Windows (Openings)
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
          canvas.rect(scPt.x - opW / 2, scPt.y - 14, opW, 28, '#0284c7', 2, '#e0f2fe');
          canvas.text(scPt.x, scPt.y - 24, 'WINDOW — ' + Math.round(op.width || 1200), 16, 'bold', 'middle', '#0284c7');
        } else {
          canvas.rect(scPt.x - opW / 2, scPt.y - 12, opW, 24, '#d97706', 2, '#fef3c7');
          canvas.text(scPt.x, scPt.y - 20, 'DOOR — ' + Math.round(op.width || 900), 16, 'bold', 'middle', '#d97706');
        }
      });

      // Draw Placed Modular Furniture Units
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

        // Unit Body
        canvas.rect(scPt.x - fW / 2, scPt.y - fD / 2, fW, fD, '#000000', 2, '#ffffff');

        if (isSink) {
          canvas.rect(scPt.x - fW / 2 + 8, scPt.y - fD / 2 + 8, fW / 2 - 12, fD - 16, '#0284c7', 1.8, '#f0f9ff', 4);
          canvas.text(scPt.x, scPt.y + fD / 2 + 25, 'SINK ' + Math.round(parseFloat(wDims.W) || 750) + ' (' + uTag + ')', 16, 'bold', 'middle', '#0284c7');
        } else if (isHob) {
          canvas.circle(scPt.x - fW * 0.2, scPt.y, fW * 0.14, '#b45309', 1.8);
          canvas.circle(scPt.x + fW * 0.2, scPt.y, fW * 0.14, '#b45309', 1.8);
          canvas.text(scPt.x, scPt.y + fD / 2 + 25, 'GAS 560 (' + uTag + ')', 16, 'bold', 'middle', '#b45309');
        } else {
          canvas.text(scPt.x, scPt.y + 6, uTag, 17, 'bold', 'middle', '#0f172a');
        }

        // Leader note showing unit name below
        var shortName = (fn.name || 'Unit').replace(/\(Cookscape\)/i, '').trim();
        canvas.text(scPt.x, scPt.y + fD / 2 + 45, shortName, 13, 'bold', 'middle', '#64748b');
      });

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
      var axX = 220, axY = 320;
      canvas.text(axX + 480, axY - 60, '3D AXONOMETRIC VIEW', 28, 'bold', 'middle');

      var cos30 = Math.cos(Math.PI / 6), sin30 = Math.sin(Math.PI / 6);
      var totalIsoSpan = 0;
      furniture.forEach(function (f) {
        var fw = parseFloat((f.dimensions && (f.dimensions.W || f.dimensions.width)) || 600);
        totalIsoSpan += fw + 80;
      });
      totalIsoSpan = Math.max(1200, totalIsoSpan);
      var isoScale = Math.min(0.22, 1350 / (totalIsoSpan * cos30));

      function iso(x, y, z) {
        return {
          x: axX + 220 + (x - z) * cos30 * isoScale,
          y: axY + 680 - y * isoScale + (x + z) * sin30 * isoScale
        };
      }

      function isoBox(x, y, z, w, h, d, label) {
        var p1 = iso(x, y, z);
        var p2 = iso(x + w, y, z);
        var p3 = iso(x + w, y + h, z);
        var p4 = iso(x, y + h, z);
        var p5 = iso(x, y, z + d);
        var p6 = iso(x + w, y, z + d);
        var p7 = iso(x + w, y + h, z + d);
        var p8 = iso(x, y + h, z + d);

        // Front Face
        canvas.line(p1.x, p1.y, p2.x, p2.y, '#000000', 2);
        canvas.line(p2.x, p2.y, p3.x, p3.y, '#000000', 2);
        canvas.line(p3.x, p3.y, p4.x, p4.y, '#000000', 2);
        canvas.line(p4.x, p4.y, p1.x, p1.y, '#000000', 2);

        // Top Face
        canvas.line(p4.x, p4.y, p8.x, p8.y, '#000000', 1.8);
        canvas.line(p8.x, p8.y, p7.x, p7.y, '#000000', 1.8);
        canvas.line(p7.x, p7.y, p3.x, p3.y, '#000000', 1.8);

        // Side Face
        canvas.line(p2.x, p2.y, p6.x, p6.y, '#000000', 1.8);
        canvas.line(p6.x, p6.y, p7.x, p7.y, '#000000', 1.8);

        if (label) {
          canvas.text(p1.x + (p3.x - p1.x) / 2, p1.y + (p3.y - p1.y) / 2, label, 15, 'bold', 'middle', '#334155');
        }
      }

      // Draw Placed Units in 3D Isometric Space
      var curIsoX = 0;
      furniture.forEach(function (f, idx) {
        var dims = f.dimensions || {};
        var fw = parseFloat(dims.W) || 600;
        var fd = parseFloat(dims.D) || 600;
        var fh = parseFloat(dims.H) || 720;
        var felev = parseFloat(f.elevation || 0);
        var fTag = f.code || ('U' + (idx + 1));
        isoBox(curIsoX, felev, 0, fw, fh, fd, fTag);
        curIsoX += fw + 80;
      });

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

      var detX = 1950;
      var keyUnitTitle = (keyUnit.code && keyUnit.code.indexOf('WFM600') !== -1)
        ? 'WFM600 — DETAILED DRAWING'
        : (keyUnit.code ? keyUnit.code + ' — DETAILED DRAWING' : (keyUnit.name || 'UNIT DETAIL').toUpperCase());
      canvas.text(detX + 350, 240, keyUnitTitle, 24, 'bold', 'middle', '#000000');

      // External View
      canvas.text(detX + 350, 310, 'EXTERNAL VIEW', 22, 'bold', 'middle', '#000000');
      canvas.line(detX + 230, 320, detX + 470, 320, '#000000', 1.5);
      
      canvas.rect(detX + 180, 380, 360, 450, '#000000', 2.5, '#ffffff');
      canvas.rect(detX + 195, 395, 330, 420, '#000000', 1.8, '#f8fafc');
      canvas.line(detX + 480, 560, detX + 480, 660, '#000000', 5);
      canvas.text(detX + 580, 615, 'SHUTTER\nFINISH', 16, 'bold', 'start');

      canvas.dimH(detX + 180, detX + 540, 860, String(Math.round(parseFloat(keyUnit.dimensions.W) || 600)), 30);
      canvas.dimV(380, 830, detX + 140, String(Math.round(parseFloat(keyUnit.dimensions.H) || 720)), 0, true);

      // Internal View
      canvas.text(detX + 350, 1000, 'INTERNAL VIEW', 22, 'bold', 'middle', '#000000');
      canvas.line(detX + 230, 1010, detX + 470, 1010, '#000000', 1.5);

      canvas.rect(detX + 180, 1080, 360, 480, '#000000', 2.5, '#ffffff');
      canvas.line(detX + 180, 1240, detX + 540, 1240, '#000000', 2);
      canvas.line(detX + 180, 1400, detX + 540, 1400, '#000000', 2);

      canvas.dimH(detX + 180, detX + 540, 1590, String(Math.round(parseFloat(keyUnit.dimensions.W) || 600)), 30);
      canvas.dimV(1080, 1560, detX + 140, String(Math.round(parseFloat(keyUnit.dimensions.H) || 720)), 0, true);

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
        { label: 'SHUTTER SPEC', val: shutters + ' NO(S) (' + shutterFin + ')' },
        { label: 'HANDLE TYPE', val: uConfig.handle || 'EXTENDED SHUTTER 20mm' },
        { label: 'HINGES', val: 'EBCO SOFT CLOSING (110°)' },
        { label: 'RUNNERS', val: drawers > 0 ? 'EBCO SOFT CLOSING TANDEM' : 'N/A' },
        { label: 'PLINTH / BASE', val: isBaseUnit ? '110mm RCC / 100mm LEGS' : 'WALL MOUNTED' },
        { label: 'EDGE BANDING', val: '2mm PVC MATCH SHUTTER' }
      ];
      this.drawProductionDetails(canvas, unitSpecs);

      // Drafting Scale & Coordinates
      var scale = Math.min(840 / W, 800 / H, 0.85);
      var unitW = W * scale;
      var unitH = H * scale;
      var extX = 260;
      var intX = 1180;
      var baseY = 1160;
      var plinthH = isBaseUnit ? (100 * scale) : 0;
      var granH = isBaseUnit ? (20 * scale) : 0;

      // ── LEFT: EXTERNAL VIEW ──
      canvas.text(extX + unitW / 2, 280, 'EXTERNAL VIEW', 30, 'bold', 'middle');
      canvas.line(extX + unitW / 2 - 120, 292, extX + unitW / 2 + 120, 292, '#000000', 2);

      // Granite Top if Base
      if (isBaseUnit) {
        canvas.rect(extX - 20, baseY - unitH - granH, unitW + 40, granH, '#000000', 2, '#334155');
        canvas.text(extX + unitW / 2, baseY - unitH - granH - 16, 'GRANITE TOP (EXISTING)', 19, 'bold', 'middle');
      }

      // Main Outer Box
      canvas.rect(extX, baseY - unitH, unitW, unitH, '#000000', 2.5, '#ffffff');

      // Shutter Divisions or Drawers
      if (drawers > 0) {
        var drwH = unitH / drawers;
        for (var d = 1; d < drawers; d++) {
          canvas.line(extX, baseY - unitH + d * drwH, extX + unitW, baseY - unitH + d * drwH, '#000000', 2);
        }
        for (var dr = 0; dr < drawers; dr++) {
          canvas.text(extX + unitW / 2, baseY - unitH + (dr + 0.5) * drwH + 6, 'DRAWER (' + Math.round(H / drawers) + 'mm)', 16, 'bold', 'middle');
        }
      } else {
        var shCellW = unitW / shutters;
        for (var s = 1; s < shutters; s++) {
          canvas.line(extX + s * shCellW, baseY - unitH, extX + s * shCellW, baseY, '#000000', 2);
        }
        for (var sh = 0; sh < shutters; sh++) {
          var hX = extX + sh * shCellW + (sh % 2 === 0 ? shCellW - 25 : 25);
          canvas.line(hX, baseY - unitH + 40, hX, baseY - unitH + 160, '#000000', 6);
        }
        var isPooja = (uName.toLowerCase().indexOf('pooja') !== -1) || (uConfig && uConfig.isPooja);
        if (isPooja) {
          canvas.circle(extX + unitW / 2, baseY - unitH / 2, Math.min(unitW, unitH) * 0.22, '#b45309', 2, '#fffbeb');
          canvas.circle(extX + unitW / 2, baseY - unitH / 2, Math.min(unitW, unitH) * 0.16, '#b45309', 1.5);
          canvas.text(extX + unitW / 2, baseY - unitH / 2 + 14, 'ॐ', 40, 'bold', 'middle', '#b45309');
          canvas.text(extX + unitW / 2, baseY - unitH / 2 + 70, 'CNC CUT JALI MANDALA', 16, 'bold', 'middle', '#b45309');
        } else {
          canvas.text(extX + unitW / 2, baseY - unitH / 2, shutters + ' SHUTTER(S) — ' + shutterFin, 20, 'bold', 'middle', '#64748b');
        }
      }

      // Plinth Base
      if (isBaseUnit) {
        canvas.rect(extX, baseY, unitW, plinthH, '#000000', 2, '#e2e8f0');
        canvas.text(extX + unitW / 2, baseY + plinthH / 2 + 7, '110 RCC BASE / 100mm PLINTH LEGS', 17, 'bold', 'middle');
      }

      // Dimensions External
      canvas.dimH(extX, extX + unitW, baseY + plinthH + 45, String(Math.round(W)));
      canvas.dimV(baseY - unitH, baseY, extX - 65, String(Math.round(H)), 0, true);


      // ── RIGHT: INTERNAL VIEW ──
      canvas.text(intX + unitW / 2, 280, 'INTERNAL VIEW', 30, 'bold', 'middle');
      canvas.line(intX + unitW / 2 - 120, 292, intX + unitW / 2 + 120, 292, '#000000', 2);

      if (isBaseUnit) {
        canvas.rect(intX - 20, baseY - unitH - granH, unitW + 40, granH, '#000000', 2, '#334155');
        canvas.text(intX + unitW / 2, baseY - unitH - granH - 16, 'GRANITE TOP (EXISTING)', 19, 'bold', 'middle');
      }

      // Carcass Gables
      canvas.rect(intX, baseY - unitH, unitW, unitH, '#000000', 2.5, '#ffffff');
      var t = Math.max(8, 18 * scale);
      canvas.rect(intX, baseY - unitH, t, unitH, '#000000', 1.5, '#94a3b8');
      canvas.rect(intX + unitW - t, baseY - unitH, t, unitH, '#000000', 1.5, '#94a3b8');

      // Center Divider if wide
      if (shutters > 1 && W >= 900) {
        canvas.rect(intX + unitW / 2 - t / 2, baseY - unitH, t, unitH, '#000000', 1.5, '#94a3b8');
      }

      // Internal Horizontal Shelves
      var shelfSpan = (H - 2 * 18) / (shelves + 1);
      for (var k = 1; k <= shelves; k++) {
        var shY = baseY - (k * shelfSpan * scale);
        canvas.rect(intX + t, shY, unitW - 2 * t, t, '#000000', 1.5, '#94a3b8');
        canvas.text(intX + unitW / 2, shY - 20, Math.round(shelfSpan) + ' mm CLEAR', 18, 'bold', 'middle', '#0f172a');
      }

      if (isBaseUnit) {
        canvas.rect(intX, baseY, unitW, plinthH, '#000000', 2, '#e2e8f0');
        canvas.text(intX + unitW / 2, baseY + plinthH / 2 + 7, '100mm PLINTH / LEGS', 17, 'bold', 'middle');
      }

      // Dimensions Internal
      canvas.dimH(intX, intX + unitW, baseY + plinthH + 45, String(Math.round(W)));
      canvas.dimV(baseY - unitH, baseY, intX - 65, String(Math.round(H)), 0, true);

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
