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
      // Col 1: Client & Site (0 to 520)
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
    // PAGE GENERATORS MATCHING REFERENCE PDF
    // ─────────────────────────────────────────────────────────────────────────────

    // PAGE 1: 2D Floor Layout Plan (Top View)
    buildPage1_FloorPlan: function (pageNum, totalPages, planData) {
      var canvas = this.createVectorCanvas();
      this.drawA4Template(canvas, pageNum, totalPages, 'KITCHEN');
      this.drawProductionDetails(canvas);

      // Main Drafting Box (Top View Room Layout)
      var originX = 140;
      var originY = 320;
      var scale = 0.55; // Plan mm to SVG px

      // Draw Outer Kitchen Walls
      var wallW = 2760 * scale; // ~1518
      var wallH = 1330 * scale; // ~731
      
      // Walls Outline
      canvas.rect(originX, originY, wallW, wallH, '#000000', 4);
      canvas.rect(originX + 30, originY + 30, wallW - 60, wallH - 60, '#94a3b8', 1.5, '#f8fafc');

      // Top Window (1205mm)
      var winX = originX + (1450 * scale);
      var winW = 1205 * scale;
      canvas.rect(winX, originY - 15, winW, 45, '#0284c7', 2.5, '#e0f2fe');
      canvas.text(winX + winW / 2, originY - 30, 'WINDOW — 1205', 22, 'bold', 'middle', '#0369a1');

      // Sequence of Kitchen Base Units along the back wall
      var units = [
        { tag: 'WFM 60', w: 600, d: 300, type: 'wall' },
        { tag: '50BS', w: 50, d: 600, type: 'filler' },
        { tag: 'FMd2-450', w: 450, d: 600, type: 'drawers', notes: ['1. DRAWER HT-340mm', '2. DRAWER HT-335mm'] },
        { tag: 'FM 410', w: 410, d: 600, type: 'shutter' },
        { tag: '55BS', w: 55, d: 600, type: 'filler' },
        { tag: 'GAS 560 O/S\nFMd3-60', w: 600, d: 600, type: 'hob', notes: ['1. PVC CUTLERY INLET (H-175mm)', '2. WOODEN DRAWER (H-150mm)', '3. PLATE BASKET (H-350mm)'] },
        { tag: '50BS', w: 50, d: 600, type: 'filler' },
        { tag: 'FM 450', w: 450, d: 600, type: 'shutter' },
        { tag: 'SINK 750 O/S', w: 750, d: 600, type: 'sink', notes: ['SINK 750 O/S (NEED CNC CUT FOR VENT)'] },
        { tag: '65BS', w: 65, d: 600, type: 'filler' }
      ];

      var currX = originX + 30;
      var baseDepth = 600 * scale;

      units.forEach(function (u) {
        var uW = u.w * scale;
        var uY = originY + 30;

        if (u.type === 'filler') {
          canvas.rect(currX, uY, uW, baseDepth, '#000000', 1.5, '#e2e8f0');
          canvas.text(currX + uW / 2, uY + baseDepth / 2 + 6, u.tag, 16, 'bold', 'middle', '#000000', -90);
        } else if (u.type === 'sink') {
          canvas.rect(currX, uY, uW, baseDepth, '#000000', 2.5, '#ffffff');
          // Sink bowl & drainboard
          canvas.rect(currX + 15, uY + 15, (uW / 2) - 10, baseDepth - 30, '#0284c7', 2, '#f0f9ff', 6);
          canvas.rect(currX + (uW / 2) + 10, uY + 20, (uW / 2) - 25, baseDepth - 40, '#0f172a', 1.5);
          for (var sl = 0; sl < 5; sl++) {
            canvas.line(currX + (uW / 2) + 20 + sl * 15, uY + 35, currX + (uW / 2) + 20 + sl * 15, uY + baseDepth - 55, '#0f172a', 1.5);
          }
          canvas.text(currX + uW / 2, uY + baseDepth + 35, u.tag, 20, 'bold', 'middle');
        } else if (u.type === 'hob') {
          canvas.rect(currX, uY, uW, baseDepth, '#000000', 2.5, '#ffffff');
          // 4 Burner Gas Hob
          var hCx = currX + uW / 2;
          var hCy = uY + baseDepth / 2;
          canvas.rect(hCx - 65, hCy - 65, 130, 130, '#000000', 1.8, '#f8fafc', 6);
          canvas.circle(hCx - 32, hCy - 32, 18, '#000000', 2);
          canvas.circle(hCx + 32, hCy - 32, 14, '#000000', 2);
          canvas.circle(hCx - 32, hCy + 32, 14, '#000000', 2);
          canvas.circle(hCx + 32, hCy + 32, 20, '#000000', 2);
          canvas.text(currX + uW / 2, uY + baseDepth + 35, 'GAS 560 O/S / FMd3-60', 19, 'bold', 'middle');
        } else {
          canvas.rect(currX, uY, uW, baseDepth, '#000000', 2, '#ffffff');
          canvas.text(currX + uW / 2, uY + baseDepth / 2 + 7, u.tag, 20, 'bold', 'middle');
        }

        // Leader annotations below unit
        if (u.notes && u.notes.length > 0) {
          var noteY = uY + baseDepth + 90;
          for (var ni = 0; ni < u.notes.length; ni++) {
            canvas.text(currX + uW / 2, noteY + (ni * 26), u.notes[ni], 15, 'bold', 'middle', '#334155');
          }
        }

        currX += uW;
      });

      // Side Provisions (Dishwasher & Fridge)
      var sideX = originX + wallW - 200;
      var sideY = originY + (600 * scale) + 120;
      
      // Dishwasher
      canvas.rect(sideX, sideY, 180, 180, '#000000', 2, '#ffffff');
      canvas.text(sideX + 90, sideY + 80, 'DISH WASHER', 17, 'bold', 'middle');
      canvas.text(sideX + 90, sideY + 110, 'PROVISION', 16, 'bold', 'middle');

      // Fridge
      var frX = sideX;
      var frY = sideY + 230;
      canvas.rect(frX, frY, 200, 240, '#000000', 2, '#ffffff');
      canvas.text(frX + 100, frY + 115, 'PROVISION', 18, 'bold', 'middle');
      canvas.text(frX + 100, frY + 145, 'FRIDGE', 18, 'bold', 'middle');

      // Continuous Dimension Strings
      canvas.dimH(originX + 30, originX + (2565 * scale), originY - 50, '2565', 0, true);
      canvas.dimH(originX + (2565 * scale), originX + ((2565 + 1205) * scale), originY - 50, '1205', 0, true);
      canvas.dimH(originX + ((2565 + 1205) * scale), originX + wallW - 30, originY - 50, '250', 0, true);
      canvas.dimV(originY, originY + wallH, originX - 60, '1330', 0, true);
      canvas.dimV(originY, originY + (2760 * scale * 0.7), originX + wallW + 80, '2760', 0, false);

      return canvas.toSVG();
    },

    // PAGE 2: 3D Axonometric Overview & Detailed Single Unit
    buildPage2_3DAndDetail: function (pageNum, totalPages) {
      var canvas = this.createVectorCanvas();
      this.drawA4Template(canvas, pageNum, totalPages, 'KITCHEN ELEVATION');

      // Left Box: 3D Isometric View of Full Kitchen Run
      var axX = 200, axY = 320;
      canvas.text(axX + 450, axY - 60, '3D AXONOMETRIC VIEW — COMPLETE KITCHEN RUN', 24, 'bold', 'middle');

      // Draw 3D Isometric Kitchen Run (Wireframe vector lines at 30 degrees)
      var cos30 = Math.cos(Math.PI / 6), sin30 = Math.sin(Math.PI / 6);
      function iso(x, y, z) {
        return {
          x: axX + 450 + (x - z) * cos30 * 0.28,
          y: axY + 650 - y * 0.28 + (x + z) * sin30 * 0.28
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
          canvas.text(p1.x + (p3.x - p1.x) / 2, p1.y + (p3.y - p1.y) / 2, label, 16, 'bold', 'middle', '#334155');
        }
      }

      // Base Cabinets Run
      isoBox(0, 0, 0, 450, 720, 600, 'FM-450');
      isoBox(450, 0, 0, 600, 720, 600, 'FM-60');
      isoBox(1050, 0, 0, 600, 720, 600, 'HOB-60');
      isoBox(1650, 0, 0, 450, 720, 600, 'FM-450');
      isoBox(2100, 0, 0, 750, 720, 600, 'SINK-750');

      // Wall Units & Chimney
      isoBox(0, 1500, 0, 600, 600, 300, 'WM-60');
      isoBox(1050, 1650, 0, 600, 450, 480, 'CHIMNEY');

      // Fridge Tall Unit
      isoBox(3000, 0, 0, 900, 1950, 650, 'FRIDGE TALL');

      // Right Column: WFM600 DETAILED DRAWING
      var detX = 1950;
      canvas.text(detX + 350, 240, 'WFM600 — DETAILED DRAWING', 26, 'bold', 'middle', '#000000');

      // 1. External View
      canvas.text(detX + 350, 310, 'EXTERNAL VIEW', 22, 'bold', 'middle', '#000000');
      canvas.line(detX + 230, 320, detX + 470, 320, '#000000', 1.5);
      
      canvas.rect(detX + 180, 380, 360, 450, '#000000', 2.5, '#ffffff');
      canvas.rect(detX + 195, 395, 330, 420, '#000000', 1.8, '#f8fafc'); // Shutter
      // Handle
      canvas.line(detX + 480, 560, detX + 480, 660, '#000000', 5);
      canvas.text(detX + 580, 615, 'SHUTTER\nFINISH', 16, 'bold', 'start');

      canvas.dimH(detX + 180, detX + 540, 860, '600', 30);
      canvas.dimV(380, 830, detX + 140, '1190', 0, true);

      // 2. Internal View (with 3-shelf division 303mm)
      canvas.text(detX + 350, 1000, 'INTERNAL VIEW', 22, 'bold', 'middle', '#000000');
      canvas.line(detX + 230, 1010, detX + 470, 1010, '#000000', 1.5);

      canvas.rect(detX + 180, 1080, 360, 480, '#000000', 2.5, '#ffffff');
      canvas.line(detX + 180, 1200, detX + 540, 1200, '#000000', 2); // Shelf 1
      canvas.line(detX + 180, 1320, detX + 540, 1320, '#000000', 2); // Shelf 2
      canvas.line(detX + 180, 1440, detX + 540, 1440, '#000000', 2); // Shelf 3

      // Shelf Heights Callouts
      canvas.text(detX + 215, 1145, '303', 18, 'bold', 'start');
      canvas.text(detX + 215, 1265, '303', 18, 'bold', 'start');
      canvas.text(detX + 215, 1385, '303', 18, 'bold', 'start');
      canvas.text(detX + 215, 1505, '303', 18, 'bold', 'start');

      canvas.dimH(detX + 180, detX + 540, 1590, '600', 30);
      canvas.dimV(1080, 1560, detX + 140, '1250', 0, true);

      return canvas.toSVG();
    },

    // PAGE 3: Side-by-Side EXTERNAL VIEW & INTERNAL VIEW
    buildPage3_DualElevation: function (pageNum, totalPages, unitData) {
      var canvas = this.createVectorCanvas();
      var u = unitData || {
        name: 'KITCHEN CORNER & BASE UNITS',
        w: 1230,
        h: 705,
        d: 840,
        shutters: 2,
        shelfHeight: 326
      };

      this.drawA4Template(canvas, pageNum, totalPages, u.name);
      this.drawProductionDetails(canvas);

      var scale = 0.85;
      var extX = 260;
      var intX = 1180;
      var baseY = 1100;
      var unitW = u.w * scale; // 1230 * 0.85 = ~1045
      var unitH = u.h * scale; // 705 * 0.85 = ~600
      var plinthH = 110 * scale; // 93
      var granH = 20 * scale; // 17

      // ── LEFT: EXTERNAL VIEW ──
      canvas.text(extX + unitW / 2, 280, 'EXTERNAL VIEW', 30, 'bold', 'middle');
      canvas.line(extX + unitW / 2 - 120, 292, extX + unitW / 2 + 120, 292, '#000000', 2);

      // Granite Top
      canvas.rect(extX - 25, baseY - unitH - granH, unitW + 50, granH, '#000000', 2, '#334155');
      canvas.text(extX + unitW / 2, baseY - unitH - granH - 18, 'GRANITE TOP (EXISTING)', 20, 'bold', 'middle');

      // Shutters Front
      canvas.rect(extX, baseY - unitH, unitW, unitH, '#000000', 2.5, '#ffffff');
      // Shutter Divide
      canvas.line(extX + unitW / 2, baseY - unitH, extX + unitW / 2, baseY, '#000000', 2);
      
      // Handles
      canvas.line(extX + unitW / 2 - 25, baseY - unitH + 40, extX + unitW / 2 - 25, baseY - unitH + 160, '#000000', 6);
      canvas.line(extX + unitW / 2 + 25, baseY - unitH + 40, extX + unitW / 2 + 25, baseY - unitH + 160, '#000000', 6);
      
      // Extended Lip & Only Shuttering Note
      canvas.text(extX + unitW / 2, baseY - unitH / 2, 'ONLY SHUTTERING', 26, 'bold', 'middle', '#64748b');
      canvas.text(extX + unitW / 2, baseY - unitH - 60, '20mm EXTENDED SHUTTER', 18, 'bold', 'middle');

      // RCC Plinth
      canvas.rect(extX, baseY, unitW, plinthH, '#000000', 2, '#e2e8f0');
      canvas.text(extX + unitW / 2, baseY + plinthH / 2 + 7, '110 RCC BASE', 18, 'bold', 'middle');

      // Dimensions External
      canvas.dimH(extX, extX + unitW / 2, baseY + plinthH + 40, '545', 0);
      canvas.dimH(extX + unitW / 2, extX + unitW, baseY + plinthH + 40, '545', 0);
      canvas.dimH(extX, extX + unitW, baseY + plinthH + 95, '1230', 0);
      canvas.dimV(baseY - unitH, baseY, extX - 70, '705', 0, true);
      canvas.dimV(baseY, baseY + plinthH, extX - 70, '110RCC', 0, true);


      // ── RIGHT: INTERNAL VIEW ──
      canvas.text(intX + unitW / 2, 280, 'INTERNAL VIEW', 30, 'bold', 'middle');
      canvas.line(intX + unitW / 2 - 120, 292, intX + unitW / 2 + 120, 292, '#000000', 2);

      // Granite Top
      canvas.rect(intX - 25, baseY - unitH - granH, unitW + 50, granH, '#000000', 2, '#334155');
      canvas.text(intX + unitW / 2, baseY - unitH - granH - 18, 'GRANITE TOP (EXISTING)', 20, 'bold', 'middle');

      // Carcass Gables
      canvas.rect(intX, baseY - unitH, unitW, unitH, '#000000', 2.5, '#ffffff');
      // 18mm Side Gables & Center Partition
      var t = 18 * scale;
      canvas.rect(intX, baseY - unitH, t, unitH, '#000000', 1.5, '#94a3b8');
      canvas.rect(intX + unitW - t, baseY - unitH, t, unitH, '#000000', 1.5, '#94a3b8');
      canvas.rect(intX + unitW / 2 - t / 2, baseY - unitH, t, unitH, '#000000', 1.5, '#94a3b8');

      // Internal Horizontal Shelf (326mm height)
      var shelfY = baseY - (u.shelfHeight * scale);
      canvas.rect(intX + t, shelfY, (unitW / 2) - 1.5 * t, t, '#000000', 1.5, '#94a3b8');
      canvas.rect(intX + unitW / 2 + t / 2, shelfY, (unitW / 2) - 1.5 * t, t, '#000000', 1.5, '#94a3b8');

      // Shelf Heights Callouts
      canvas.text(intX + unitW * 0.25, shelfY - 45, '326', 22, 'bold', 'middle');
      canvas.text(intX + unitW * 0.25, shelfY + 70, '326', 22, 'bold', 'middle');
      canvas.text(intX + unitW * 0.75, shelfY - 45, '326', 22, 'bold', 'middle');
      canvas.text(intX + unitW * 0.75, shelfY + 70, '326', 22, 'bold', 'middle');

      // RCC Plinth
      canvas.rect(intX, baseY, unitW, plinthH, '#000000', 2, '#e2e8f0');
      canvas.text(intX + unitW / 2, baseY + plinthH / 2 + 7, '110 RCC BASE', 18, 'bold', 'middle');

      // Dimensions Internal
      canvas.dimH(intX, intX + unitW / 2, baseY + plinthH + 40, '545', 0);
      canvas.dimH(intX + unitW / 2, intX + unitW, baseY + plinthH + 40, '545', 0);
      canvas.dimH(intX, intX + unitW, baseY + plinthH + 95, '1230', 0);
      canvas.dimV(baseY - unitH, baseY, intX - 70, '705', 0, true);

      return canvas.toSVG();
    },

    // PAGE 4: Continuous Loft Shuttering Elevation
    buildPage4_LoftShuttering: function (pageNum, totalPages) {
      var canvas = this.createVectorCanvas();
      this.drawA4Template(canvas, pageNum, totalPages, 'KITCHEN LOFT');
      this.drawProductionDetails(canvas);

      var startX = 220;
      var startY = 820;
      var totalSpan = 4015;
      var loftH = 860;
      var scale = 0.42;

      var spanW = totalSpan * scale; // ~1686
      var spanH = loftH * scale;     // ~361

      canvas.text(startX + spanW / 2, 380, 'LOFT ONLY SHUTTERING', 38, 'bold', 'middle');
      canvas.line(startX + spanW / 2 - 250, 400, startX + spanW / 2 + 250, 400, '#000000', 2.5);

      // Loft Enclosing Box
      canvas.rect(startX, startY - spanH, spanW, spanH, '#000000', 3, '#ffffff');

      // 7 Equal Shutters (555mm each)
      var nShutters = 7;
      var cellW = 555 * scale;

      for (var i = 1; i < nShutters; i++) {
        canvas.line(startX + (i * cellW), startY - spanH, startX + (i * cellW), startY, '#000000', 2);
      }

      // Shutter Handles (Pairs)
      for (var j = 0; j < nShutters; j++) {
        var hX = startX + (j * cellW) + (j % 2 === 0 ? cellW - 25 : 25);
        canvas.line(hX, startY - 70, hX, startY - 20, '#000000', 6);
      }

      // Top Filler (60mm) & Left Filler (65mm)
      canvas.rect(startX, startY - spanH - 25, spanW, 25, '#000000', 1.5, '#e2e8f0');
      canvas.text(startX - 90, startY - spanH - 5, '60TOP BS', 16, 'bold', 'end');

      // Bottom RCC Callout
      canvas.text(startX + spanW / 2, startY + 65, 'RCC', 28, 'bold', 'middle');

      // Running Width Dimensions
      for (var k = 0; k < nShutters; k++) {
        canvas.dimH(startX + (k * cellW), startX + ((k + 1) * cellW), startY - spanH - 60, '555', 0, true);
      }
      canvas.dimH(startX, startX + spanW, startY + 120, '4015', 0);
      canvas.dimV(startY - spanH, startY, startX - 70, '860', 0, true);

      return canvas.toSVG();
    },

    // PAGE 5: Living Room Feature Units (TV Unit with Ledges)
    buildPage5_TVUnit: function (pageNum, totalPages) {
      var canvas = this.createVectorCanvas();
      this.drawA4Template(canvas, pageNum, totalPages, 'LIVING-TV UNIT');
      this.drawProductionDetails(canvas);

      var scale = 0.58;
      var extX = 220;
      var intX = 1180;
      var baseY = 1100;
      var tvW = 2400 * scale; // ~1392
      var tvH = 320 * scale;  // ~185

      // External View
      canvas.text(extX + tvW / 2, 420, 'EXTERNAL VIEW', 28, 'bold', 'middle');
      canvas.rect(extX, baseY - tvH, tvW, tvH, '#000000', 2.5, '#ffffff');

      // Floating Ledges Above
      var ledgW = 2400 * scale;
      canvas.rect(extX, 580, ledgW, 35, '#000000', 2, '#f8fafc');
      canvas.text(extX + ledgW / 2, 560, 'SF LEDGE 2400mm x 200mm', 19, 'bold', 'middle');

      var subLedgW = 900 * scale;
      canvas.rect(extX + 350, 680, subLedgW, 35, '#000000', 2, '#f8fafc');
      canvas.text(extX + 350 + subLedgW / 2, 660, 'SF LEDGE 900mm x 200mm', 18, 'bold', 'middle');

      // 5 Sections: 450, 450, 600, 450, 450 mm
      var secWidths = [450, 450, 600, 450, 450];
      var curX = extX;
      for (var i = 0; i < secWidths.length; i++) {
        var sW = secWidths[i] * scale;
        if (i > 0) canvas.line(curX, baseY - tvH, curX, baseY, '#000000', 2);
        var lbl = (i === 2) ? 'SF OPEN' : 'DRAWER';
        canvas.text(curX + sW / 2, baseY - tvH / 2 + 7, lbl, 16, 'bold', 'middle');
        canvas.dimH(curX, curX + sW, baseY + 40, String(secWidths[i]));
        curX += sW;
      }
      canvas.dimH(extX, extX + tvW, baseY + 95, '2400');
      canvas.dimV(baseY - tvH, baseY, extX - 60, '320', 0, true);

      // Key Plan Box
      var kpX = 260;
      var kpY = 1380;
      canvas.rect(kpX, kpY, 1300, 150, '#000000', 2, '#ffffff');
      canvas.text(kpX + 650, kpY - 15, 'KEY PLAN — LIVING ROOM LAYOUT', 20, 'bold', 'middle');
      canvas.rect(kpX + 350, kpY + 25, 600, 80, '#0284c7', 2, '#f0f9ff');
      canvas.text(kpX + 650, kpY + 70, 'TV UNIT (2400mm)', 18, 'bold', 'middle');

      return canvas.toSVG();
    },

    // PAGE 6: Pooja & Crockery Unit with CNC Om Cutout
    buildPage6_PoojaCrockery: function (pageNum, totalPages) {
      var canvas = this.createVectorCanvas();
      this.drawA4Template(canvas, pageNum, totalPages, 'CROCKERY AND POOJA');
      this.drawProductionDetails(canvas);

      var pX = 280, pY = 1200;
      var pW = 1600 * 0.45; // ~720
      var pH = 1990 * 0.45; // ~895

      // External View
      canvas.text(pX + pW / 2, 260, 'EXTERNAL VIEW', 28, 'bold', 'middle');
      canvas.rect(pX, pY - pH, pW, pH, '#000000', 2.5, '#ffffff');
      
      // Fluted Glass Shutters with Wood Frames
      var shW = pW / 3;
      canvas.rect(pX + 15, pY - pH + 20, shW - 25, pH * 0.7, '#0284c7', 2, '#f0f9ff');
      canvas.rect(pX + shW + 15, pY - pH + 20, shW - 25, pH * 0.7, '#0284c7', 2, '#f0f9ff');
      canvas.rect(pX + 2 * shW + 15, pY - pH + 20, shW - 25, pH * 0.7, '#0284c7', 2, '#f0f9ff');
      canvas.text(pX + shW / 2, pY - pH + 150, 'FLUTED\nGLASS', 16, 'bold', 'middle');
      canvas.text(pX + shW + shW / 2, pY - pH + 150, 'FLUTED\nGLASS', 16, 'bold', 'middle');
      canvas.text(pX + 2 * shW + shW / 2, pY - pH + 150, 'FLUTED\nGLASS', 16, 'bold', 'middle');

      // Internal View with CNC OM Cut
      var inX = 1120;
      canvas.text(inX + pW / 2, 260, 'INTERNAL VIEW', 28, 'bold', 'middle');
      canvas.rect(inX, pY - pH, pW, pH, '#000000', 2.5, '#ffffff');
      // CNC Om Mandala Circle
      canvas.circle(inX + pW / 2, pY - pH + 280, 80, '#d97706', 2.5, '#fef3c7');
      canvas.text(inX + pW / 2, pY - pH + 295, 'ॐ', 54, 'bold', 'middle', '#b45309');
      canvas.text(inX + pW / 2, pY - pH + 410, 'CNC CUT MANDALA BACKPANEL', 17, 'bold', 'middle');

      // Drawers below
      canvas.rect(inX + 15, pY - 180, (pW / 2) - 20, 160, '#000000', 2, '#f8fafc');
      canvas.rect(inX + pW / 2 + 10, pY - 180, (pW / 2) - 20, 160, '#000000', 2, '#f8fafc');
      canvas.text(inX + pW * 0.25, pY - 95, 'DRAWER', 18, 'bold', 'middle');
      canvas.text(inX + pW * 0.75, pY - 95, 'DRAWER', 18, 'bold', 'middle');

      canvas.dimH(inX, inX + pW, pY + 50, '1600');
      canvas.dimV(pY - pH, pY, inX - 60, '1990', 0, true);

      return canvas.toSVG();
    },

    // PAGE 7: Living Shoe Rack with Fluted Panel & Reference Image
    buildPage7_ShoeRack: function (pageNum, totalPages) {
      var canvas = this.createVectorCanvas();
      this.drawA4Template(canvas, pageNum, totalPages, 'LIVING-SHOE RACK');
      this.drawProductionDetails(canvas);

      var scale = 0.65;
      var extX = 260;
      var intX = 1140;
      var baseY = 1180;
      var w = 1140 * scale; // ~741
      var h = 1050 * scale; // ~682
      var flutedH = 917 * scale; // ~596

      // External View
      canvas.text(extX + w / 2, 240, 'EXTERNAL VIEW', 28, 'bold', 'middle');
      // Fluted Back Panel
      canvas.rect(extX, baseY - h - flutedH, w, flutedH, '#000000', 2, '#fef3c7');
      for (var f = 0; f < w; f += 18) {
        canvas.line(extX + f, baseY - h - flutedH, extX + f, baseY - h, '#b45309', 1.2);
      }
      canvas.text(extX + w / 2, baseY - h - flutedH / 2, '18mm FLUTED PANEL (1140 x 917mm)', 19, 'bold', 'middle');

      // Base Shoe Cabinet
      canvas.rect(extX, baseY - h, w, h, '#000000', 2.5, '#ffffff');
      canvas.line(extX + w / 2, baseY - h, extX + w / 2, baseY, '#000000', 2);
      canvas.dimH(extX, extX + w / 2, baseY + 40, '520');
      canvas.dimH(extX + w / 2, extX + w, baseY + 40, '520');
      canvas.dimH(extX, extX + w, baseY + 90, '1140');
      canvas.dimV(baseY - h, baseY, extX - 60, '1050', 0, true);

      // Internal View with 498mm Shelves
      canvas.text(intX + w / 2, 240, 'INTERNAL VIEW', 28, 'bold', 'middle');
      canvas.rect(intX, baseY - h, w, h, '#000000', 2.5, '#ffffff');
      canvas.line(intX, baseY - h / 2, intX + w, baseY - h / 2, '#000000', 2);
      canvas.text(intX + w / 2, baseY - h * 0.75, 'SHELF HEIGHT: 498mm', 20, 'bold', 'middle');
      canvas.text(intX + w / 2, baseY - h * 0.25, 'SHELF HEIGHT: 498mm', 20, 'bold', 'middle');

      // Reference Image Box
      var imgX = 2200;
      var imgY = 1250;
      canvas.rect(imgX, imgY, 320, 240, '#000000', 2, '#f8fafc');
      canvas.text(imgX + 160, imgY + 110, 'REFERENCE FINISH', 18, 'bold', 'middle');
      canvas.text(imgX + 160, imgY + 140, 'IMAGE ATTACHED', 16, 'normal', 'middle');

      return canvas.toSVG();
    },

    // PAGE 8: Master Bedroom Walk-In Wardrobe & Lofts
    buildPage8_WardrobeWalkIn: function (pageNum, totalPages) {
      var canvas = this.createVectorCanvas();
      this.drawA4Template(canvas, pageNum, totalPages, 'BEDROOM 1 WALKIN WARDROBE');
      this.drawProductionDetails(canvas);

      var startX = 320;
      var baseY = 1380;
      var w = 2430 * 0.55; // ~1336
      var h = 1865 * 0.55; // ~1025
      var loftH = 850 * 0.55; // ~467

      canvas.text(startX + w / 2, 260, 'ELEVATION — FULL WARDROBE & LOFT RUN', 32, 'bold', 'middle');

      // Upper Lofts
      canvas.rect(startX, baseY - h - loftH, w, loftH, '#000000', 2.5, '#ffffff');
      canvas.text(startX + w / 2, baseY - h - loftH / 2, 'LOFT ONLY SHUTTERING (H: 850mm)', 22, 'bold', 'middle');

      // Main Wardrobe
      canvas.rect(startX, baseY - h, w, h, '#000000', 2.5, '#ffffff');
      
      // 4 Equal Doors (375mm, 375mm, 395mm, 395mm, 340mm)
      var cell = w / 4;
      for (var i = 1; i < 4; i++) {
        canvas.line(startX + i * cell, baseY - h, startX + i * cell, baseY, '#000000', 2);
      }
      for (var j = 0; j < 4; j++) {
        var hx = startX + j * cell + (j % 2 === 0 ? cell - 30 : 30);
        canvas.line(hx, baseY - h * 0.6, hx, baseY - h * 0.35, '#000000', 6);
      }

      canvas.dimH(startX, startX + w, baseY + 50, '2430');
      canvas.dimV(baseY - h, baseY, startX - 70, '1865', 0, true);
      canvas.dimV(baseY - h - loftH, baseY - h, startX - 70, '850', 0, true);

      return canvas.toSVG();
    },

    // ─────────────────────────────────────────────────────────────────────────────
    // MULTI-PAGE DECK COMPILER
    // ─────────────────────────────────────────────────────────────────────────────

    generateAllPages: function () {
      var pages = [];
      var totalPages = 8; // standard 8 core templates, expandable to 16

      // Sync active project metadata if available
      if (window.OrbixProjects && window.OrbixProjects.currentProject) {
        var p = window.OrbixProjects.currentProject;
        if (p.clientName) this.meta.client = p.clientName;
        if (p.name) this.meta.site = p.name;
        if (p.code) this.meta.prCode = p.code;
      }

      pages.push({ index: 1, title: 'KITCHEN FLOOR PLAN', svg: this.buildPage1_FloorPlan(1, totalPages) });
      pages.push({ index: 2, title: '3D KITCHEN & UNIT DETAIL', svg: this.buildPage2_3DAndDetail(2, totalPages) });
      pages.push({ index: 3, title: 'KITCHEN CORNER BASE UNITS', svg: this.buildPage3_DualElevation(3, totalPages) });
      pages.push({ index: 4, title: 'KITCHEN LOFT SHUTTERING', svg: this.buildPage4_LoftShuttering(4, totalPages) });
      pages.push({ index: 5, title: 'LIVING-TV UNIT & LEDGES', svg: this.buildPage5_TVUnit(5, totalPages) });
      pages.push({ index: 6, title: 'CROCKERY AND POOJA UNIT', svg: this.buildPage6_PoojaCrockery(6, totalPages) });
      pages.push({ index: 7, title: 'LIVING-SHOE RACK & FLUTED PANEL', svg: this.buildPage7_ShoeRack(7, totalPages) });
      pages.push({ index: 8, title: 'BEDROOM 1 WALKIN WARDROBE', svg: this.buildPage8_WardrobeWalkIn(8, totalPages) });

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

      // Trigger download
      var blob = new Blob([dxfContent], { type: 'application/dxf' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'cookscape-2d-drawing-page-' + (pageIndex + 1) + '.dxf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      if (typeof window.toast === 'function') {
        window.toast('📐 Downloaded AutoCAD DXF (Page ' + (pageIndex + 1) + ')');
      }
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
          // Populate modal inputs with current meta
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
