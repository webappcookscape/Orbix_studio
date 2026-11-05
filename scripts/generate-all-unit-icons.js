/**
 * Comprehensive Parametric 2.5D Isometric SVG Generator for Cookscape Modular Units
 * Generates custom, accurate architectural axonometric illustrations for all 90 units
 * matching the user's uploaded design language (teal panels, white carcass, 3D shading, drop shadows).
 */

const fs = require('fs');
const path = require('path');
const Core = require('../orbix-core.js');

const OUT_DIR = path.join(__dirname, '..', 'unit-icons');
if (!fs.existsSync(OUT_DIR)) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
}

function escapeXml(unsafe) {
  return String(unsafe).replace(/[<>&'"]/g, c => {
    switch (c) {
      case '<': return '&lt;';
      case '>': return '&gt;';
      case '&': return '&amp;';
      case '\'': return '&apos;';
      case '"': return '&quot;';
    }
  });
}

function generateUnitSvg(unit) {
  const id = unit.id || 'unit';
  const name = unit.name || 'Unit';
  const cat = unit.category || 'kitchen_base';
  const modelType = unit.modelType || '';
  const dims = unit.dimensions || { W: 600, H: 750, D: 550 };
  const W = dims.W || 600;
  const H = dims.H || 750;
  const D = dims.D || 550;
  const cfg = unit.unitConfig || {};

  const vbW = 120;
  const vbH = 120;

  // Determine structural archetype
  const isWardrobe = cat === 'wardrobe' || cat === 'kitchen_tall' || modelType.indexOf('wr') !== -1 || H >= 1800;
  const isPooja = cat === 'pooja' || modelType.indexOf('pooja') !== -1 || name.toLowerCase().indexOf('pooja') !== -1;
  const isTvWall = cat === 'tv_unit' && (W >= 1500 || name.toLowerCase().indexOf('media') !== -1);
  const isBed = cat === 'furniture' && name.toLowerCase().indexOf('bed') !== -1;
  const isWallUnit = cat === 'kitchen_wall' || cat === 'loft' || (name.toLowerCase().indexOf('wall') !== -1 && !isTvWall);
  const isOpenBox = cat === 'spice_rack' || name.toLowerCase().indexOf('open') !== -1 || name.toLowerCase().indexOf('obs') !== -1 || name.toLowerCase().indexOf('o/s') !== -1 || (cfg.shutters === 0 && cfg.drawers === 0);
  const isPaneling = cat === 'wall_paneling' || name.toLowerCase().indexOf('panel') !== -1 || name.toLowerCase().indexOf('ledge') !== -1;
  const isGlass = name.toLowerCase().indexOf('gl') !== -1 || name.toLowerCase().indexOf('glass') !== -1 || cfg.dstyle === 'glass';
  const isIsland = id === 'k_island' || name.toLowerCase().indexOf('island') !== -1;
  const isVanity = id === 'vanity' || name.toLowerCase().indexOf('vanity') !== -1;
  const isShoeRack = id === 'shoe_rack' || name.toLowerCase().indexOf('shoe') !== -1;

  // Calculate proportional 2.5D box dimensions
  let boxW, boxH, boxD;
  if (isBed) {
    boxW = 72;
    boxH = 34;
    boxD = 44;
  } else if (isTvWall) {
    boxW = 82;
    boxH = 68;
    boxD = 16;
  } else if (isWardrobe) {
    boxW = Math.min(64, Math.max(38, Math.round((W / 1800) * 58 + 22)));
    boxH = 78;
    boxD = 20;
  } else if (isWallUnit) {
    boxW = Math.min(74, Math.max(34, Math.round((W / 1200) * 56 + 18)));
    boxH = Math.min(54, Math.max(32, Math.round((H / 900) * 44 + 14)));
    boxD = 18;
  } else if (W >= 1200) {
    // Wide base run or horizontal base unit
    boxW = 78;
    boxH = Math.min(56, Math.max(32, Math.round((H / 850) * 46 + 12)));
    boxD = 22;
  } else {
    // Standard base cabinet / storage
    boxW = Math.min(64, Math.max(32, Math.round((W / 900) * 48 + 16)));
    boxH = Math.min(62, Math.max(36, Math.round((H / 850) * 48 + 14)));
    boxD = 22;
  }

  // Anchor position in viewbox
  const totalW = boxW + boxD * 0.82;
  const totalH = boxH + boxD * 0.45;
  const originX = Math.round((vbW - totalW) / 2 + 2);
  const originY = Math.round((vbH - totalH) / 2 + boxD * 0.45 + (isWardrobe ? 4 : (isWallUnit ? -2 : 2)));

  // Coordinate math for axonometric cabinet
  const frontSlope = boxW * 0.06; // slight modern 3D perspective slant
  const pFrontTL = { x: originX, y: originY };
  const pFrontTR = { x: originX + boxW, y: originY - frontSlope };
  const pFrontBR = { x: pFrontTR.x, y: pFrontTR.y + boxH };
  const pFrontBL = { x: pFrontTL.x, y: pFrontTL.y + boxH };

  const depthX = boxD * 0.82;
  const depthY = -boxD * 0.44;

  const pBackTR = { x: pFrontTR.x + depthX, y: pFrontTR.y + depthY };
  const pBackTL = { x: pFrontTL.x + depthX, y: pFrontTL.y + depthY };
  const pBackBR = { x: pFrontBR.x + depthX, y: pFrontBR.y + depthY };

  // Palettes (Matching user uploaded images)
  const TEAL_PANEL = '#00B894';
  const TEAL_PANEL_GRAD_LIGHT = '#1DD1A1';
  const TEAL_PANEL_BORDER = '#0F766E';
  const CARCASS_TOP = isWallUnit || isWardrobe ? '#FFFFFF' : '#1E293B'; // Kitchen base units have sleek black granite/quartz countertop
  const CARCASS_TOP_EDGE = isWallUnit || isWardrobe ? '#E2E8F0' : '#334155';
  const CARCASS_RIGHT = '#D8E2EC';
  const CARCASS_BORDER = '#1E293B';
  const HANDLE_FILL = '#F1F5F9';
  const HANDLE_BORDER = '#475569';

  let svgElements = [];

  // 1. Drop Shadow
  const shadowPts = `${pFrontBL.x + 4},${pFrontBL.y + 4} ${pFrontBR.x + 4},${pFrontBR.y + 4} ${pBackBR.x + 6},${pBackBR.y + 6} ${pBackBR.x - 10},${pBackBR.y + 8} ${pFrontBL.x - 2},${pFrontBL.y + 6}`;
  svgElements.push(`<polygon points="${shadowPts}" fill="rgba(15, 23, 42, 0.16)" filter="url(#dropBlur)" />`);

  // 2. Legs / Base Pedestal
  if (isWardrobe || isVanity || isShoeRack) {
    // 4 square pedestal feet like user's icon-furniture.png
    const legW = 5.5;
    const legH = 6;
    const l1 = { x: pFrontBL.x + 2, y: pFrontBL.y };
    const l2 = { x: pFrontBR.x - legW - 2, y: pFrontBR.y };
    const l3 = { x: pBackBR.x - legW - 2, y: pBackBR.y };

    svgElements.push(`<rect x="${l1.x}" y="${l1.y - 1}" width="${legW}" height="${legH}" rx="1" fill="#0D9488" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
    svgElements.push(`<rect x="${l2.x}" y="${l2.y - 1}" width="${legW}" height="${legH}" rx="1" fill="#0D9488" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
    svgElements.push(`<polygon points="${l3.x},${l3.y - 1} ${l3.x + legW},${l3.y - 1} ${l3.x + legW},${l3.y + legH - 2} ${l3.x},${l3.y + legH - 2}" fill="#0F766E" stroke="${CARCASS_BORDER}" stroke-width="1.1" />`);
  } else if (!isWallUnit && !isOpenBox && !isBed && !isPaneling) {
    // Recessed kickboard plinth for kitchen base & TV units
    const plinthH = 5;
    const plY1 = pFrontBL.y - plinthH;
    const plY2 = pFrontBR.y - plinthH;
    svgElements.push(`<polygon points="${pFrontBL.x + 3},${plY1} ${pFrontBR.x - 3},${plY2} ${pFrontBR.x - 3},${pFrontBR.y} ${pFrontBL.x + 3},${pFrontBL.y}" fill="#334155" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
  }

  // 3. Right Side Face
  const rightFacePts = `${pFrontTR.x},${pFrontTR.y} ${pBackTR.x},${pBackTR.y} ${pBackBR.x},${pBackBR.y} ${pFrontBR.x},${pFrontBR.y}`;
  svgElements.push(`<polygon points="${rightFacePts}" fill="${CARCASS_RIGHT}" stroke="${CARCASS_BORDER}" stroke-width="1.5" stroke-linejoin="round" />`);

  // 4. Top Face (Countertop or Cabinet Top)
  const topFacePts = `${pFrontTL.x},${pFrontTL.y} ${pBackTL.x},${pBackTL.y} ${pBackTR.x},${pBackTR.y} ${pFrontTR.x},${pFrontTR.y}`;
  const topFill = (isWallUnit || isWardrobe || isOpenBox) ? '#FFFFFF' : 'url(#topGraniteGrad)';
  svgElements.push(`<polygon points="${topFacePts}" fill="${topFill}" stroke="${CARCASS_BORDER}" stroke-width="1.5" stroke-linejoin="round" />`);
  if (!isWallUnit && !isWardrobe && !isOpenBox && !isBed) {
    // Countertop overhang highlight lip
    svgElements.push(`<line x1="${pFrontTL.x}" y1="${pFrontTL.y}" x2="${pFrontTR.x}" y2="${pFrontTR.y}" stroke="#64748B" stroke-width="1.8" />`);
  }

  // 5. Front Face (Carcass Outer Frame)
  const frontFacePts = `${pFrontTL.x},${pFrontTL.y} ${pFrontTR.x},${pFrontTR.y} ${pFrontBR.x},${pFrontBR.y} ${pFrontBL.x},${pFrontBL.y}`;
  svgElements.push(`<polygon points="${frontFacePts}" fill="#FFFFFF" stroke="${CARCASS_BORDER}" stroke-width="1.5" stroke-linejoin="round" />`);

  // 6. Parametric Interior / Shutters / Drawers rendering
  const inset = 3; // carcass border margin
  const fInnerTL = { x: pFrontTL.x + inset, y: pFrontTL.y + inset };
  const fInnerTR = { x: pFrontTR.x - inset, y: pFrontTR.y + inset };
  const fInnerBR = { x: pFrontBR.x - inset, y: pFrontBR.y - inset };
  const fInnerBL = { x: pFrontBL.x + inset, y: pFrontBL.y - inset };
  const innerW = fInnerTR.x - fInnerTL.x;
  const innerH = fInnerBL.y - fInnerTL.y;

  if (isOpenBox) {
    // OPEN STORAGE / SPICE RACK / OPEN CUBES
    // Draw hollow interior with 3D inner walls
    const depthInnerX = 6;
    const depthInnerY = -3.5;
    const innerCeilPts = `${fInnerTL.x},${fInnerTL.y} ${fInnerTL.x + depthInnerX},${fInnerTL.y + depthInnerY} ${fInnerTR.x + depthInnerX},${fInnerTR.y + depthInnerY} ${fInnerTR.x},${fInnerTR.y}`;
    const innerLeftPts = `${fInnerTL.x},${fInnerTL.y} ${fInnerTL.x + depthInnerX},${fInnerTL.y + depthInnerY} ${fInnerBL.x + depthInnerX},${fInnerBL.y + depthInnerY} ${fInnerBL.x},${fInnerBL.y}`;
    const innerBackPts = `${fInnerTL.x + depthInnerX},${fInnerTL.y + depthInnerY} ${fInnerTR.x + depthInnerX},${fInnerTR.y + depthInnerY} ${fInnerBR.x + depthInnerX},${fInnerBR.y + depthInnerY} ${fInnerBL.x + depthInnerX},${fInnerBL.y + depthInnerY}`;

    svgElements.push(`<polygon points="${innerBackPts}" fill="#E2E8F0" stroke="#CBD5E1" stroke-width="0.8" />`);
    svgElements.push(`<polygon points="${innerCeilPts}" fill="#94A3B8" />`);
    svgElements.push(`<polygon points="${innerLeftPts}" fill="#CBD5E1" />`);

    // Horizontal shelves
    const numShelves = W >= 900 ? 2 : 1;
    for (let sh = 1; sh <= numShelves; sh++) {
      const shY = fInnerTL.y + (innerH / (numShelves + 1)) * sh;
      svgElements.push(`<polygon points="${fInnerTL.x},${shY} ${fInnerTR.x},${shY - frontSlope} ${fInnerTR.x + depthInnerX},${shY - frontSlope + depthInnerY} ${fInnerTL.x + depthInnerX},${shY + depthInnerY}" fill="#F8FAFC" stroke="${CARCASS_BORDER}" stroke-width="1" />`);
      if (cat === 'spice_rack') {
        // Chrome retaining safety bar
        svgElements.push(`<line x1="${fInnerTL.x + 2}" y1="${shY - 4}" x2="${fInnerTR.x - 2}" y2="${shY - frontSlope - 4}" stroke="#94A3B8" stroke-width="1.8" stroke-linecap="round" />`);
      }
    }
  } else if (isPooja) {
    // POOJA MANDIR / CNC JALI SHRINE
    // Top ornate temple arch canopy
    const archApexX = (pFrontTL.x + pFrontTR.x) / 2;
    const archApexY = pFrontTL.y - 12;
    svgElements.push(`<path d="M ${pFrontTL.x} ${pFrontTL.y} Q ${archApexX} ${archApexY - 4} ${pFrontTR.x} ${pFrontTR.y} Z" fill="#F59E0B" stroke="${CARCASS_BORDER}" stroke-width="1.3" />`);
    // Kalash peak
    svgElements.push(`<circle cx="${archApexX}" cy="${archApexY - 3}" r="3" fill="#D97706" stroke="${CARCASS_BORDER}" stroke-width="1" />`);

    // 2 Doors with CNC jali laser lattice pattern
    const midX = (fInnerTL.x + fInnerTR.x) / 2;
    const d1Pts = `${fInnerTL.x},${fInnerTL.y} ${midX - 1},${fInnerTL.y - frontSlope / 2} ${midX - 1},${fInnerBL.y - frontSlope / 2} ${fInnerBL.x},${fInnerBL.y}`;
    const d2Pts = `${midX + 1},${fInnerTL.y - frontSlope / 2} ${fInnerTR.x},${fInnerTR.y} ${fInnerBR.x},${fInnerBR.y} ${midX + 1},${fInnerBL.y - frontSlope / 2}`;
    svgElements.push(`<polygon points="${d1Pts}" fill="#FEF3C7" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
    svgElements.push(`<polygon points="${d2Pts}" fill="#FEF3C7" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);

    // CNC Lattice Grid Lines
    for (let j = 1; j <= 4; j++) {
      const jy = fInnerTL.y + (innerH / 5) * j;
      svgElements.push(`<line x1="${fInnerTL.x + 2}" y1="${jy}" x2="${midX - 3}" y2="${jy - frontSlope / 2}" stroke="#D97706" stroke-dasharray="2,2" stroke-width="1" />`);
      svgElements.push(`<line x1="${midX + 3}" y1="${jy - frontSlope / 2}" x2="${fInnerTR.x - 2}" y2="${jy - frontSlope}" stroke="#D97706" stroke-dasharray="2,2" stroke-width="1" />`);
    }
    // Brass Handles
    svgElements.push(`<circle cx="${midX - 4}" cy="${fInnerTL.y + innerH * 0.5}" r="2" fill="#B45309" stroke="#78350F" stroke-width="0.8" />`);
    svgElements.push(`<circle cx="${midX + 4}" cy="${fInnerTL.y + innerH * 0.5}" r="2" fill="#B45309" stroke="#78350F" stroke-width="0.8" />`);
  } else if (isTvWall) {
    // TV MEDIA ENTERTAINMENT WALL
    // Back wooden acoustic panel
    svgElements.push(`<polygon points="${fInnerTL.x},${fInnerTL.y} ${fInnerTR.x},${fInnerTR.y} ${fInnerTR.x},${fInnerTL.y + innerH * 0.65} ${fInnerTL.x},${fInnerTL.y + innerH * 0.65}" fill="#E2E8F0" stroke="${CARCASS_BORDER}" stroke-width="1.1" />`);
    // Mounted Flat TV Screen
    const tvInsetW = innerW * 0.72;
    const tvInsetH = innerH * 0.42;
    const tvX = fInnerTL.x + (innerW - tvInsetW) / 2;
    const tvY = fInnerTL.y + 6;
    svgElements.push(`<rect x="${tvX}" y="${tvY}" width="${tvInsetW}" height="${tvInsetH}" rx="2" fill="#0F172A" stroke="#334155" stroke-width="1.2" />`);
    svgElements.push(`<rect x="${tvX + 3}" y="${tvY + 3}" width="${tvInsetW - 6}" height="${tvInsetH - 6}" rx="1" fill="#1E293B" />`);
    // Floating bottom console with teal drawers
    const conY = fInnerTL.y + innerH * 0.68;
    const conH = innerH * 0.32;
    const conPts = `${fInnerTL.x},${conY} ${fInnerTR.x},${conY - frontSlope} ${fInnerBR.x},${fInnerBR.y} ${fInnerBL.x},${fInnerBL.y}`;
    svgElements.push(`<polygon points="${conPts}" fill="${TEAL_PANEL}" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
    // 2 console drawers
    const midConX = (fInnerTL.x + fInnerTR.x) / 2;
    svgElements.push(`<line x1="${midConX}" y1="${conY}" x2="${midConX}" y2="${fInnerBL.y}" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
    svgElements.push(`<line x1="${fInnerTL.x + 8}" y1="${conY + conH * 0.5}" x2="${midConX - 8}" y2="${conY + conH * 0.5}" stroke="${HANDLE_FILL}" stroke-width="1.6" stroke-linecap="round" />`);
    svgElements.push(`<line x1="${midConX + 8}" y1="${conY + conH * 0.5}" x2="${fInnerTR.x - 8}" y2="${conY + conH * 0.5}" stroke="${HANDLE_FILL}" stroke-width="1.6" stroke-linecap="round" />`);
  } else if (isBed) {
    // MODERN UPHOLSTERED BED WITH HEADBOARD
    // Tall padded headboard
    const hbH = 38;
    const hbTL = { x: pFrontTL.x, y: pFrontTL.y - 12 };
    const hbTR = { x: pFrontTR.x, y: pFrontTR.y - 12 };
    svgElements.push(`<polygon points="${hbTL.x},${hbTL.y} ${hbTR.x},${hbTR.y} ${hbTR.x},${hbTR.y + hbH} ${hbTL.x},${hbTL.y + hbH}" fill="#0F766E" stroke="${CARCASS_BORDER}" stroke-width="1.4" rx="2" />`);
    // Vertical tufting
    for (let t = 1; t <= 3; t++) {
      const tx = hbTL.x + (boxW / 4) * t;
      svgElements.push(`<line x1="${tx}" y1="${hbTL.y + 2}" x2="${tx}" y2="${hbTL.y + hbH - 2}" stroke="#115E59" stroke-width="1.2" />`);
    }
    // Mattress & duvet
    svgElements.push(`<polygon points="${pFrontTL.x + 4},${pFrontTL.y + 12} ${pFrontTR.x - 4},${pFrontTR.y + 12} ${pFrontBR.x - 4},${pFrontBR.y} ${pFrontBL.x + 4},${pFrontBL.y}" fill="#F8FAFC" stroke="${CARCASS_BORDER}" stroke-width="1.3" />`);
    svgElements.push(`<polygon points="${pFrontTL.x + 4},${pFrontTL.y + 20} ${pFrontTR.x - 4},${pFrontTR.y + 20} ${pFrontBR.x - 4},${pFrontBR.y} ${pFrontBL.x + 4},${pFrontBL.y}" fill="${TEAL_PANEL}" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
    // Pillows
    svgElements.push(`<rect x="${pFrontTL.x + 8}" y="${pFrontTL.y + 6}" width="16" height="9" rx="2" fill="#FFFFFF" stroke="${CARCASS_BORDER}" stroke-width="1" />`);
    svgElements.push(`<rect x="${pFrontTR.x - 24}" y="${pFrontTR.y + 6}" width="16" height="9" rx="2" fill="#FFFFFF" stroke="${CARCASS_BORDER}" stroke-width="1" />`);
  } else if (isPaneling) {
    // WALL PANELING / SLATS / LEDGES
    const numSlats = 8;
    const slatW = innerW / numSlats;
    for (let s = 0; s < numSlats; s++) {
      const sx = fInnerTL.x + s * slatW;
      const col = (s % 2 === 0) ? '#D97706' : '#B45309'; // warm architectural wood slat tones
      svgElements.push(`<rect x="${sx + 1}" y="${fInnerTL.y + 1}" width="${slatW - 1.5}" height="${innerH - 2}" fill="${col}" stroke="${CARCASS_BORDER}" stroke-width="0.8" />`);
    }
    // Floating display shelf ledge across
    if (name.toLowerCase().indexOf('ledge') !== -1 || isPaneling) {
      const ledgeY = fInnerTL.y + innerH * 0.55;
      svgElements.push(`<polygon points="${fInnerTL.x - 4},${ledgeY} ${fInnerTR.x + 4},${ledgeY - frontSlope} ${fInnerTR.x + depthX * 0.6},${ledgeY - frontSlope + depthY * 0.6} ${fInnerTL.x + depthX * 0.6},${ledgeY + depthY * 0.6}" fill="#F8FAFC" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
    }
  } else {
    // ══════ CABINET DOORS & DRAWERS (Hinged, Sliding, Glass, Tandem Drawers) ══════
    const numDrawers = cfg.drawers || (modelType.indexOf('d3') !== -1 || id.indexOf('d3') !== -1 ? 3 : (modelType.indexOf('d2') !== -1 || id.indexOf('d2') !== -1 ? 2 : (id.indexOf('1dr') !== -1 || id.indexOf('ds') !== -1 ? 1 : 0)));
    const hasDoorAndDrawer = (id.indexOf('1d-1dr') !== -1 || id.indexOf('ds') !== -1 || id.indexOf('2d-2dr') !== -1);
    const isSliding = cfg.doorType === 'sliding' || modelType.indexOf('sliding') !== -1 || name.toLowerCase().indexOf('sliding') !== -1;
    let numShutters = cfg.shutters !== undefined ? cfg.shutters : (W >= 1500 ? 3 : (W >= 600 ? 2 : 1));
    if (numShutters === 0 && numDrawers === 0) numShutters = (W >= 600 ? 2 : 1);

    if (numDrawers > 0 && !hasDoorAndDrawer) {
      // PURE DRAWER STACK (2 Drawers or 3 Drawers or 1 Drawer)
      const drCount = numDrawers;
      const drH = innerH / drCount;
      for (let d = 0; d < drCount; d++) {
        const dY = fInnerTL.y + d * drH;
        const dPts = `${fInnerTL.x},${dY + 1} ${fInnerTR.x},${dY + 1 - frontSlope} ${fInnerTR.x},${dY + drH - 1 - frontSlope} ${fInnerTL.x},${dY + drH - 1}`;
        svgElements.push(`<polygon points="${dPts}" fill="${TEAL_PANEL}" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
        // Sleek horizontal drawer pull handle
        const hMidY = dY + drH * 0.5 - (frontSlope * 0.5);
        const hW = Math.min(24, innerW * 0.45);
        const hStartX = (fInnerTL.x + fInnerTR.x - hW) / 2;
        svgElements.push(`<line x1="${hStartX}" y1="${hMidY}" x2="${hStartX + hW}" y2="${hMidY - frontSlope * 0.3}" stroke="${HANDLE_FILL}" stroke-width="2.2" stroke-linecap="round" />`);
        svgElements.push(`<line x1="${hStartX}" y1="${hMidY}" x2="${hStartX + hW}" y2="${hMidY - frontSlope * 0.3}" stroke="${HANDLE_BORDER}" stroke-width="0.8" stroke-linecap="round" />`);
      }
    } else if (hasDoorAndDrawer) {
      // COMBINATION: TOP DRAWER(S) + BOTTOM SHUTTER(S)
      // e.g. CROCKERY/TV BASE 1DOOR 1 DRAWER or FM DS 60 or 2 DOOR 2 DRAWER
      const topDrH = Math.round(innerH * 0.35);
      const botDoorH = innerH - topDrH;

      // Top Drawer
      const drPts = `${fInnerTL.x},${fInnerTL.y} ${fInnerTR.x},${fInnerTR.y} ${fInnerTR.x},${fInnerTR.y + topDrH - 1} ${fInnerTL.x},${fInnerTL.y + topDrH - 1}`;
      svgElements.push(`<polygon points="${drPts}" fill="${TEAL_PANEL}" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
      const hDrMidY = fInnerTL.y + topDrH * 0.5 - (frontSlope * 0.5);
      const hDrW = Math.min(22, innerW * 0.4);
      const hDrX = (fInnerTL.x + fInnerTR.x - hDrW) / 2;
      svgElements.push(`<line x1="${hDrX}" y1="${hDrMidY}" x2="${hDrX + hDrW}" y2="${hDrMidY}" stroke="${HANDLE_FILL}" stroke-width="2.2" stroke-linecap="round" />`);

      // Bottom Doors
      const botY = fInnerTL.y + topDrH + 1;
      const bDoorCount = (W >= 750 || id.indexOf('2d') !== -1) ? 2 : 1;
      const bDoorW = innerW / bDoorCount;
      for (let bd = 0; bd < bDoorCount; bd++) {
        const bdx1 = fInnerTL.x + bd * bDoorW;
        const bdx2 = bdx1 + bDoorW - (bDoorCount > 1 && bd < bDoorCount - 1 ? 1 : 0);
        const bPts = `${bdx1},${botY} ${bdx2},${botY - frontSlope * (bd / bDoorCount)} ${bdx2},${fInnerBL.y} ${bdx1},${fInnerBL.y}`;
        svgElements.push(`<polygon points="${bPts}" fill="${TEAL_PANEL}" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);

        // Vertical C-Handle on door
        const handX = (bDoorCount === 1) ? (bdx2 - 5) : (bd === 0 ? bdx2 - 4 : bdx1 + 4);
        const handY = botY + botDoorH * 0.35;
        svgElements.push(`<line x1="${handX}" y1="${handY}" x2="${handX}" y2="${handY + 9}" stroke="${HANDLE_FILL}" stroke-width="2" stroke-linecap="round" />`);
        svgElements.push(`<line x1="${handX}" y1="${handY}" x2="${handX}" y2="${handY + 9}" stroke="${HANDLE_BORDER}" stroke-width="0.8" stroke-linecap="round" />`);
      }
    } else if (isSliding) {
      // 2-DOOR SLIDING PROFILE WARDROBE
      const midSlideX = (fInnerTL.x + fInnerTR.x) / 2;
      // Door 1 (Back track)
      const d1Pts = `${fInnerTL.x},${fInnerTL.y} ${midSlideX + 2},${fInnerTL.y - frontSlope * 0.5} ${midSlideX + 2},${fInnerBL.y - frontSlope * 0.5} ${fInnerTL.x},${fInnerBL.y}`;
      svgElements.push(`<polygon points="${d1Pts}" fill="#00A884" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);
      // Door 2 (Front track overlap)
      const d2Pts = `${midSlideX - 2},${fInnerTL.y - frontSlope * 0.5} ${fInnerTR.x},${fInnerTR.y} ${fInnerBR.x},${fInnerBR.y} ${midSlideX - 2},${fInnerBL.y - frontSlope * 0.5}`;
      svgElements.push(`<polygon points="${d2Pts}" fill="${TEAL_PANEL}" stroke="${CARCASS_BORDER}" stroke-width="1.3" />`);

      // Horizontal divide decorative groove rails
      for (let g = 1; g <= 3; g++) {
        const gy = fInnerTL.y + (innerH / 4) * g;
        svgElements.push(`<line x1="${fInnerTL.x + 2}" y1="${gy}" x2="${midSlideX}" y2="${gy - frontSlope * 0.5}" stroke="#0F766E" stroke-width="1" />`);
        svgElements.push(`<line x1="${midSlideX}" y1="${gy - frontSlope * 0.5}" x2="${fInnerTR.x - 2}" y2="${gy - frontSlope}" stroke="#0F766E" stroke-width="1" />`);
      }
      // Vertical aluminum edge profile grips
      svgElements.push(`<line x1="${midSlideX - 1}" y1="${fInnerTL.y + 4}" x2="${midSlideX - 1}" y2="${fInnerBL.y - 4}" stroke="#1E293B" stroke-width="1.6" />`);
      svgElements.push(`<line x1="${fInnerTR.x - 2}" y1="${fInnerTR.y + 4}" x2="${fInnerBR.x - 2}" y2="${fInnerBR.y - 4}" stroke="#1E293B" stroke-width="1.6" />`);
    } else {
      // STANDARD HINGED SHUTTERS (1 Door, 2 Doors, 3 Doors, 4 Doors)
      const doorCount = Math.min(4, Math.max(1, numShutters));
      const doorW = innerW / doorCount;

      for (let i = 0; i < doorCount; i++) {
        const dx1 = fInnerTL.x + i * doorW;
        const dx2 = dx1 + doorW - (doorCount > 1 && i < doorCount - 1 ? 1 : 0);
        const dyTop1 = fInnerTL.y - frontSlope * (i / doorCount);
        const dyTop2 = fInnerTL.y - frontSlope * ((i + 1) / doorCount);
        const dyBot1 = fInnerBL.y - frontSlope * (i / doorCount);
        const dyBot2 = fInnerBL.y - frontSlope * ((i + 1) / doorCount);

        const dPts = `${dx1},${dyTop1} ${dx2},${dyTop2} ${dx2},${dyBot2} ${dx1},${dyBot1}`;
        const doorFill = isGlass ? '#BAE6FD' : TEAL_PANEL;
        svgElements.push(`<polygon points="${dPts}" fill="${doorFill}" stroke="${CARCASS_BORDER}" stroke-width="1.2" />`);

        if (isGlass) {
          // Glass reflection diagonal glare strokes
          const glMidX = (dx1 + dx2) / 2;
          const glMidY = (dyTop1 + dyBot1) / 2;
          svgElements.push(`<line x1="${glMidX - 4}" y1="${glMidY - 10}" x2="${glMidX + 4}" y2="${glMidY + 2}" stroke="rgba(255,255,255,0.7)" stroke-width="1.4" stroke-linecap="round" />`);
          svgElements.push(`<line x1="${glMidX - 2}" y1="${glMidY + 6}" x2="${glMidX + 2}" y2="${glMidY + 12}" stroke="rgba(255,255,255,0.7)" stroke-width="1.4" stroke-linecap="round" />`);
        }

        // Vertical C-Handles
        let hX;
        if (doorCount === 1) {
          hX = dx2 - 4.5;
        } else if (doorCount === 2) {
          hX = (i === 0) ? dx2 - 4 : dx1 + 4;
        } else if (doorCount === 3) {
          hX = (i === 0) ? dx2 - 4 : (i === 1 ? dx2 - 4 : dx1 + 4);
        } else {
          // 4 doors: pairs (0 & 1 meet at 1st gap, 2 & 3 meet at 3rd gap)
          hX = (i % 2 === 0) ? dx2 - 3.5 : dx1 + 3.5;
        }

        const hY = dyTop1 + innerH * (isWardrobe ? 0.46 : 0.42);
        const hLen = isWardrobe ? 12 : 9;
        svgElements.push(`<line x1="${hX}" y1="${hY}" x2="${hX}" y2="${hY + hLen}" stroke="${HANDLE_FILL}" stroke-width="2" stroke-linecap="round" />`);
        svgElements.push(`<line x1="${hX}" y1="${hY}" x2="${hX}" y2="${hY + hLen}" stroke="${HANDLE_BORDER}" stroke-width="0.8" stroke-linecap="round" />`);
      }

      // Overhead Loft division line for units with loft
      if (cfg.loft || isWardrobe && name.toLowerCase().indexOf('loft') !== -1) {
        const loftDivY = fInnerTL.y + innerH * 0.22;
        svgElements.push(`<line x1="${fInnerTL.x}" y1="${loftDivY}" x2="${fInnerTR.x}" y2="${loftDivY - frontSlope}" stroke="${CARCASS_BORDER}" stroke-width="1.4" />`);
      }
    }
  }

  // Defs & Gradients
  const defs = `
  <defs>
    <filter id="dropBlur" x="-20%" y="-20%" width="150%" height="150%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="2.5" />
    </filter>
    <linearGradient id="topGraniteGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E293B" />
      <stop offset="100%" stop-color="#0F172A" />
    </linearGradient>
  </defs>`;

  const svgContent = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${vbW} ${vbH}" width="${vbW}" height="${vbH}">
  ${defs}
  ${svgElements.join('\n  ')}
</svg>`;

  return svgContent;
}

function sanitizeIconId(id) {
  return String(id).replace(/[\/\\:\*\?"<>\|\s]+/g, '-').toLowerCase();
}

// Generate all unit icons
console.log('Generating unique isometric SVG icons for all ' + Core.FURNITURE_CATALOG.length + ' units...');
let count = 0;
const iconMap = {};

Core.FURNITURE_CATALOG.forEach(unit => {
  const svg = generateUnitSvg(unit);
  const cleanId = sanitizeIconId(unit.id);
  const outPath = path.join(OUT_DIR, `${cleanId}.svg`);
  fs.writeFileSync(outPath, svg, 'utf8');
  iconMap[cleanId] = svg;
  count++;
});

console.log(`✓ Successfully generated ${count} unique SVG icons in unit-icons/ directory!`);

// Generate orbix-unit-icons.js bundle
const bundlePath = path.join(__dirname, '..', 'orbix-unit-icons.js');
const bundleContent = `/**
 * Orbix Unit Icons: High-Resolution 2.5D Isometric SVG Thumbnails for Cookscape Modular Units
 * Auto-generated by scripts/generate-all-unit-icons.js
 * Contains parametric illustrations for all ${count} catalog units.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.OrbixUnitIcons = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function sanitizeIconId(id) {
    return String(id || '').replace(/[\\/\\\\:*?"<>|\\s]+/g, '-').toLowerCase();
  }

  var ICONS = ${JSON.stringify(iconMap, null, 2)};

  return {
    ICONS: ICONS,
    sanitizeIconId: sanitizeIconId,
    getIcon: function (item) {
      if (!item) return 'icon-cookscape-unit.png';
      if (typeof item === 'string') {
        var cleanKey = sanitizeIconId(item);
        if (cleanKey === 'w2d' || cleanKey === 'w-01') return 'icon-furniture.png';
        if (cleanKey === 'ctvb-1d-1dr') return 'icon-cookscape-unit.png';
        if (ICONS[cleanKey]) {
          return 'data:image/svg+xml;utf8,' + encodeURIComponent(ICONS[cleanKey]);
        }
        return 'unit-icons/' + cleanKey + '.svg';
      }
      var id = item.id || '';
      var clean = sanitizeIconId(id);
      if (id === 'w2d' || id === 'W-01') return 'icon-furniture.png';
      if (id === 'ctvb-1d-1dr') return 'icon-cookscape-unit.png';
      if (ICONS[clean]) {
        return 'data:image/svg+xml;utf8,' + encodeURIComponent(ICONS[clean]);
      }
      return 'unit-icons/' + clean + '.svg';
    }
  };
}));
`;

fs.writeFileSync(bundlePath, bundleContent, 'utf8');
console.log(`✓ Successfully created ${bundlePath} (${Math.round(bundleContent.length / 1024)} KB)!`);

