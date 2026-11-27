/* ═══════════════════════════════════════════════════════════════════════════════
   ORBIX STUDIO — Client Quote Link Generator & Management UI
   Strict Master-Template.pptx Flow: Variants + Unit Snips + Quotation Snip (No 2D/3D)
   ═══════════════════════════════════════════════════════════════════════════════ */
(function (root) {
  'use strict';

  var Core = root.OrbixCore;

  var MASTER_VARIANTS = [
    { key: 'zappo - el pearl', label: 'ZAPPO EL PEARL', slideRange: 'Slides 7–9' },
    { key: 'pot&cafe', label: 'POT & CAFE', slideRange: 'Slides 10–12' },
    { key: 'homespace', label: 'HOME SPACE', slideRange: 'Slides 13–15' },
    { key: 'cafehunt', label: 'CAFÉ HUNT', slideRange: 'Slides 16–18' },
    { key: 'LL elite', label: 'LL ELITE', slideRange: 'Slides 19–21' },
    { key: 'CC MATTE', label: 'CAPRICOAST MATTE', slideRange: 'Slides 22–24' },
    { key: 'CC GLOSSY', label: 'CAPRICOST GLOSSY', slideRange: 'Slides 25–27' },
    { key: 'SURABHI', label: 'ELEGANT SURABHI', slideRange: 'Slides 28–30' },
    { key: 'MR+', label: '4X TUFF GLOSS', slideRange: 'Slides 31–33' }
  ];

  function getVariantLabel(key) {
    if (!key) return 'CAPRICOAST MATTE';
    var norm = (Core && Core.normalizeTierName) ? Core.normalizeTierName(key) : key;
    var found = MASTER_VARIANTS.filter(function (v) { return v.key === norm || v.key === key; })[0];
    if (found) return found.label;
    if (norm === 'custom' || key === 'custom') return 'CUSTOM (ROOM-WISE)';
    return String(key).toUpperCase();
  }

  function getProjectRooms(proj) {
    var rooms = [];
    var seen = {};

    var planRooms = (proj && proj.plan && Array.isArray(proj.plan.rooms)) ? proj.plan.rooms : [];
    planRooms.forEach(function (rm) {
      if (!rm || !rm.id || seen[rm.id]) return;
      seen[rm.id] = true;
      rooms.push({
        id: rm.id,
        name: rm.name || ('Room ' + (rooms.length + 1)),
        unitCount: 0
      });
    });

    var furniture = (proj && proj.plan && Array.isArray(proj.plan.furniture)) ? proj.plan.furniture : [];
    furniture.forEach(function (f) {
      if (!f || f.isDecor) return;
      var rId = f.roomId || '_general';
      var rName = f.roomName || 'General';
      if (!seen[rId]) {
        seen[rId] = true;
        rooms.push({ id: rId, name: rName, unitCount: 1 });
      } else {
        var existing = rooms.filter(function (r) { return r.id === rId; })[0];
        if (existing) existing.unitCount = (existing.unitCount || 0) + 1;
      }
    });

    return rooms;
  }

  function esc(str) {
    return String(str === undefined || str === null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtINR(v) {
    var n = Math.round(Number(v) || 0);
    return '₹ ' + n.toLocaleString('en-IN');
  }

  function apiCall(url, opts) {
    if (root.OrbixProjects && typeof root.OrbixProjects.apiFetch === 'function') {
      return root.OrbixProjects.apiFetch(url, opts);
    }
    return fetch(url, opts);
  }

  function randomPassword() {
    var chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    var out = 'CS-';
    for (var i = 0; i < 6; i++) {
      out += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return out;
  }

  function makeDefaultUsername(clientName, quoteCode) {
    var slug = String(clientName || 'client')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .slice(0, 16) || 'client';
    var suffix = String(quoteCode || '')
      .toLowerCase()
      .replace(/[^a-z0-9]/g, '')
      .slice(-4);
    return suffix ? (slug + '.' + suffix) : (slug + '.quote');
  }

  function getActiveProjectId(app) {
    if (root.OrbixProjects && root.OrbixProjects.activeProjectId) {
      return root.OrbixProjects.activeProjectId;
    }
    return (app && app.project && app.project.id) || 'local_proj_' + ((app && app.project && app.project.meta && app.project.meta.quoteId) || 'default');
  }

  function rasterizeUnitIconToPng(markupOrImg) {
    return new Promise(function (resolve) {
      if (!markupOrImg || typeof document === 'undefined' || typeof Image === 'undefined') {
        resolve(null);
        return;
      }
      var src = markupOrImg;
      if (typeof src === 'string' && src.indexOf('<img') !== -1) {
        var m = src.match(/src=["']([^"']+)["']/);
        if (m) src = m[1];
      }
      if (typeof src === 'string' && src.indexOf('<svg') !== -1 && src.indexOf('data:image') === -1) {
        src = 'data:image/svg+xml;utf8,' + encodeURIComponent(src);
      }
      if (!src || src.indexOf('data:image/') !== 0) {
        resolve(null);
        return;
      }
      try {
        var img = new Image();
        img.onload = function () {
          try {
            var cv = document.createElement('canvas');
            cv.width = 84;
            cv.height = 84;
            var ctx = cv.getContext('2d');
            ctx.clearRect(0, 0, 84, 84);
            var scale = Math.min(78 / (img.width || 84), 78 / (img.height || 84));
            var dw = (img.width || 84) * scale;
            var dh = (img.height || 84) * scale;
            ctx.drawImage(img, (84 - dw) / 2, (84 - dh) / 2, dw, dh);
            resolve(cv.toDataURL('image/png'));
          } catch (_) {
            resolve(null);
          }
        };
        img.onerror = function () { resolve(null); };
        img.src = src;
      } catch (_) {
        resolve(null);
      }
    });
  }

  async function buildUnitIconsMap(app, furnitureItems) {
    var icons = {};
    var keyByItemKey = {};
    var uniqueTasks = [];
    var idx = 0;

    for (var i = 0; i < (furnitureItems || []).length; i++) {
      var it = furnitureItems[i];
      var cacheKey = (it.catalogId || it.code || it.name || it.category || 'unit').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      if (!keyByItemKey[cacheKey]) {
        var iconId = 'u' + (idx++) + '_' + cacheKey.slice(0, 18);
        keyByItemKey[cacheKey] = iconId;
        var svgHtml = (app && typeof app.getUnitSVG === 'function') ? app.getUnitSVG(it) : '';
        uniqueTasks.push({ iconId: iconId, svgHtml: svgHtml });
      }
    }

    await Promise.all(uniqueTasks.map(async function (t) {
      var pngDataUrl = await rasterizeUnitIconToPng(t.svgHtml);
      if (pngDataUrl) icons[t.iconId] = pngDataUrl;
    }));

    return { icons: icons, keyByItemKey: keyByItemKey };
  }

  function buildVariantQuotePayload(app, tierKey, iconLookup, unitRemarks) {
    var proj = app.project || {};
    var origRateCard = proj.rateCard || {};
    var isCustom = (tierKey === 'custom' || tierKey === 'custom variant' || tierKey === 'custom (room-wise)');
    var normalized = isCustom ? 'custom' : ((Core && Core.normalizeTierName) ? Core.normalizeTierName(tierKey) : tierKey);

    var clonedRateCard = JSON.parse(JSON.stringify(origRateCard));
    if (isCustom) {
      clonedRateCard.selectedTier = 'custom';
      clonedRateCard.roomTiers = Object.assign({}, origRateCard.roomTiers || {});
    } else {
      clonedRateCard.selectedTier = normalized;
      if (clonedRateCard.roomTiers && typeof clonedRateCard.roomTiers === 'object') {
        Object.keys(clonedRateCard.roomTiers).forEach(function (rk) {
          clonedRateCard.roomTiers[rk] = normalized;
        });
      }
    }

    var clonedProj = {
      plan: proj.plan,
      rateCard: clonedRateCard,
      commercialCharges: proj.commercialCharges,
      meta: proj.meta
    };

    var quote = Core.generateFullQuotation(clonedProj, app.selectedBOQRooms || ['all']);
    var surabhiWoodwork = (Core && Core.getSurabhiWoodworkSubtotal)
      ? Core.getSurabhiWoodworkSubtotal(proj, app.selectedBOQRooms || ['all'])
      : (app.getSurabhiWoodworkSubtotal ? app.getSurabhiWoodworkSubtotal() : 0);
    if (!surabhiWoodwork) surabhiWoodwork = quote.subtotalWoodwork;

    var commCharges = Object.assign({}, app.getCommercialCharges() || {}, {
      surabhiWoodworkSubtotal: surabhiWoodwork
    });
    var comm = app.computeCommercialSummary(quote.subtotalWoodwork, commCharges);

    var varMeta = MASTER_VARIANTS.filter(function (v) { return v.key === normalized; })[0];
    var tierTitle = isCustom ? 'CUSTOM VARIANT (Room-Wise)' : ((varMeta && varMeta.label) || normalized.toUpperCase());

    var items = (quote.furnitureItems || []).map(function (it, idx) {
      var d = it.dimensions || { W: 0, D: 0, H: 0 };
      var smat = (it.materials && it.materials.shutter) ? it.materials.shutter : {};
      var cmat = (it.materials && it.materials.carcass) ? it.materials.carcass : {};
      var cacheKey = (it.catalogId || it.code || it.name || it.category || 'unit').toLowerCase().replace(/[^a-z0-9_-]/g, '_');
      var iconKey = iconLookup && iconLookup[cacheKey] ? iconLookup[cacheKey] : '';
      return {
        refCode: it.refCode || ('C' + (13 + idx)),
        room: it.roomName || 'General',
        name: it.name || 'Modular Unit',
        dimensions: d.W + ' x ' + d.D + ' x ' + d.H,
        finish: ((smat.material || 'HDHMR') + ' / ' + (smat.finish || 'Standard') + ' (C: ' + (cmat.material || 'BWP') + ')').slice(0, 65),
        qtyText: (it.areaSft != null ? it.areaSft.toFixed(1) : '0.0') + ' sft',
        rate: Math.round(it.baseRate || 0),
        amount: Math.round(it.totalAmount || 0),
        iconKey: iconKey
      };
    });

    (quote.civilItems || []).forEach(function (cv) {
      items.push({
        refCode: 'CIV',
        room: cv.roomName || 'Civil',
        name: cv.name || 'Civil Work',
        dimensions: 'Area Based',
        finish: cv.formulaDescription || 'Included Civil Scope',
        qtyText: (cv.areaSft != null ? cv.areaSft.toFixed(1) : '0') + ' sft',
        rate: Math.round(cv.baseRate || 0),
        amount: Math.round(cv.totalAmount || 0),
        iconKey: ''
      });
    });

    function getRoomSummaryRank(name) {
      var s = String(name || '').toLowerCase().trim();
      if (!s) return 99;
      if (/\bcommon\b/.test(s) && /(vanity|wash|bath|toilet|basin)/.test(s)) return 8;
      if (/\bpowder\b|hand\s*wash|wash\s*basin/.test(s)) return 8;
      if (/(bathroom|bath\s*vanity|washroom|toilet|restroom|vanity|ensuite|\bbath\b)/.test(s)) return 9;
      if (/\bkitchen\b|modular\s*kitchen|wet\s*kitchen|dry\s*kitchen|pantry/.test(s)) return 1;
      if (/\btv\b|tv\s*unit|media\s*wall|entertainment|\bliving\b|\bhall\b|drawing\s*room/.test(s)) return 2;
      if (/pooja|puja|prayer|mandir/.test(s)) return 3;
      if (/crockery|dining|\bbar\b/.test(s)) return 4;
      if (/\bmaster\b|\bmbr\b|primary\s*bed/.test(s)) return 5;
      if (/\bkids?\b|child|children/.test(s)) return 6;
      if (/\bguest\b|parents?\s*bed/.test(s)) return 7;
      if (/bed\s*room|bedroom/.test(s)) return 7.5;
      if (/shoe\s*rack|\bshoe\b|foyer|entrance|entry|mudroom/.test(s)) return 10;
      return 99;
    }

    var roomsSummary = (quote.allRoomsSummary || [])
      .filter(function (r) { return Number(r && r.itemCount || 0) > 0; })
      .map(function (r, idx) {
        var rawTier = (clonedRateCard.roomTiers && (clonedRateCard.roomTiers[r.id] || clonedRateCard.roomTiers[r.name])) || r.variant || clonedRateCard.selectedTier || 'CC MATTE';
        return {
          id: r.id,
          name: r.name,
          variant: rawTier,
          variantLabel: getVariantLabel(rawTier),
          itemCount: Number(r.itemCount || 0),
          roomSubtotal: Math.round(r.roomSubtotal || 0),
          percentShare: r.percentShare || 0,
          _origIdx: idx
        };
      })
      .sort(function (a, b) {
        var ra = getRoomSummaryRank(a.name);
        var rb = getRoomSummaryRank(b.name);
        if (ra !== rb) return ra - rb;
        return a._origIdx - b._origIdx;
      })
      .map(function (r) {
        delete r._origIdx;
        return r;
      });

    var roomScopeLabel = quote.isFiltered
      ? ('Selected: ' + roomsSummary.map(function (r) { return r.name; }).join(', '))
      : 'All Rooms (Entire Home)';

    return {
      tierKey: normalized,
      tierTitle: tierTitle,
      isCustomVariant: isCustom,
      roomTiers: clonedRateCard.roomTiers || {},
      roomScopeLabel: roomScopeLabel,
      currencySymbol: quote.currencySymbol || '₹',
      grandTotal: Math.round(comm.grandTotal || 0),
      roomsSummary: roomsSummary,
      roomBreakdown: roomsSummary,
      commercial: {
        woodworkSubtotal: comm.woodworkSubtotal,
        surabhiWoodworkSubtotal: comm.surabhiWoodworkSubtotal || surabhiWoodwork,
        surabhiDesignSlab: comm.surabhiDesignSlab || 'auto',
        activeSlab: comm.activeSlab,
        accessoriesEnabled: comm.accessoriesEnabled !== false,
        additionalAccessories: comm.additionalAccessories,
        accessoriesSet2Enabled: comm.accessoriesSet2Enabled !== false && Boolean(comm.additionalAccessoriesSet2 || (commCharges.selectedAddonsSet2 && commCharges.selectedAddonsSet2.length) || (comm.selectedAddonsSet2 && comm.selectedAddonsSet2.length)),
        additionalAccessoriesSet2: comm.additionalAccessoriesSet2 || 0,
        appliancesEnabled: comm.appliancesEnabled !== false,
        appliances: comm.appliances,
        selectedAddons: (commCharges.selectedAddons || comm.selectedAddons || []).map(function (it) {
          if (!it || typeof it !== 'object') return it;
          if (it.brand && String(it.brand).trim()) return it;
          var catList = (Core && typeof Core.getCookscapeAddonsCatalog === 'function') ? Core.getCookscapeAddonsCatalog() : [];
          var hit = catList.find(function (c) {
            return (it.id && c.id === it.id) || (it.name && c.name && c.name.trim().toLowerCase() === String(it.name).trim().toLowerCase());
          });
          var resolvedBrand = '';
          if (hit) {
            var r = Number((it.customRate !== undefined && it.customRate !== null && it.customRate !== '') ? it.customRate : (it.rate || 0));
            var defBrand = String(hit.brand || '').trim().toUpperCase();
            if (defBrand && hit.rate && Math.abs(r - hit.rate) < 0.05) resolvedBrand = defBrand;
            else if (hit.hettichRate && Math.abs(r - hit.hettichRate) < 0.05) resolvedBrand = 'HETTICH';
            else if (hit.ebcoRate && Math.abs(r - hit.ebcoRate) < 0.05) resolvedBrand = 'EBCO';
            else if (hit.grassRate && Math.abs(r - hit.grassRate) < 0.05) resolvedBrand = 'GRASS';
            else resolvedBrand = defBrand;
          }
          return Object.assign({}, it, { brand: resolvedBrand });
        }),
        selectedAddonsSet2: (commCharges.selectedAddonsSet2 || comm.selectedAddonsSet2 || []).map(function (it) {
          if (!it || typeof it !== 'object') return it;
          if (it.brand && String(it.brand).trim()) return it;
          var catList = (Core && typeof Core.getCookscapeAddonsCatalog === 'function') ? Core.getCookscapeAddonsCatalog() : [];
          var hit = catList.find(function (c) {
            return (it.id && c.id === it.id) || (it.name && c.name && c.name.trim().toLowerCase() === String(it.name).trim().toLowerCase());
          });
          var resolvedBrand = '';
          if (hit) {
            var r = Number((it.customRate !== undefined && it.customRate !== null && it.customRate !== '') ? it.customRate : (it.rate || 0));
            var defBrand = String(hit.brand || '').trim().toUpperCase();
            if (defBrand && hit.rate && Math.abs(r - hit.rate) < 0.05) resolvedBrand = defBrand;
            else if (hit.hettichRate && Math.abs(r - hit.hettichRate) < 0.05) resolvedBrand = 'HETTICH';
            else if (hit.ebcoRate && Math.abs(r - hit.ebcoRate) < 0.05) resolvedBrand = 'EBCO';
            else if (hit.grassRate && Math.abs(r - hit.grassRate) < 0.05) resolvedBrand = 'GRASS';
            else resolvedBrand = defBrand;
          }
          return Object.assign({}, it, { brand: resolvedBrand });
        }),
        selectedCustomAddons: commCharges.selectedCustomAddons || comm.selectedCustomAddons || [],
        appliancesList: commCharges.appliancesList || comm.appliancesList || [],
        addonsTotal: comm.addonsTotal !== undefined ? comm.addonsTotal : (((comm.accessoriesEnabled !== false ? Number(comm.additionalAccessories || 0) : 0) + ((comm.accessoriesSet2Enabled !== false && Boolean(comm.additionalAccessoriesSet2 || (commCharges.selectedAddonsSet2 && commCharges.selectedAddonsSet2.length))) ? Number(comm.additionalAccessoriesSet2 || 0) : 0)) + (comm.appliancesEnabled !== false ? Number(comm.appliances || 0) : 0)),
        totalInvestmentWithAddons: comm.totalInvestmentWithAddons !== undefined ? comm.totalInvestmentWithAddons : (Number(comm.grandTotal || 0) + (comm.addonsTotal || 0)),
        designPercent: comm.designPercent,
        designAmount: comm.designAmount,
        freightEnabled: comm.freightEnabled !== false,
        freightPercent: comm.freightPercent,
        freightAmount: comm.freightAmount,
        discountPercent: comm.discountPercent,
        discountAmount: comm.discountAmount,
        adpPercent: comm.adpPercent,
        adpAmount: comm.adpAmount,
        totalSavings: comm.totalSavings !== undefined ? comm.totalSavings : ((comm.discountAmount || 0) + (comm.adpAmount || 0)),
        netBeforeTax: comm.netValue,
        gstEnabled: comm.gstEnabled !== false,
        gstPercent: comm.gstPercent,
        gstAmount: comm.gstAmount,
        grandTotal: comm.grandTotal,
        loadingUnloadingStatus: comm.loadingUnloadingStatus,
        floorMatStatus: comm.floorMatStatus,
        civilWorksStatus: comm.civilWorksStatus,
        electricalPlumbingStatus: comm.electricalPlumbingStatus,
        falseCeilingStatus: comm.falseCeilingStatus
      },
      items: items,
      notes: String(unitRemarks || '').trim()
    };
  }

  function ensureModalElement() {
    var existing = document.getElementById('clientQuoteShareModal');
    if (existing) return existing;

    var modal = document.createElement('div');
    modal.id = 'clientQuoteShareModal';
    modal.className = 'orbix-modal';
    modal.style.background = 'rgba(15, 23, 42, 0.58)';
    modal.style.backdropFilter = 'blur(8px)';
    modal.style.webkitBackdropFilter = 'blur(8px)';
    modal.innerHTML =
      '<div class="orbix-modal-box" style="max-width:780px;width:95vw;max-height:92vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.45);border-radius:10px;overflow:hidden;">' +
      '  <div class="orbix-modal-hdr" style="background:linear-gradient(135deg,#08231B,#0F172A);color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-radius:10px 10px 0 0;">' +
      '    <div>' +
      '      <div style="font-size:15px;font-weight:700;">🔐 Cookscape Client Quote Generator (Master Template)</div>' +
      '      <div style="font-size:11.5px;color:#CBD5E1;margin-top:2px;">Cover + Intro (2–6) + Selected Variants (Divider • Specs • Unit Snips • Quotation) + Policy &amp; Terms (34–41)</div>' +
      '    </div>' +
      '    <button type="button" id="cqCloseModalBtn" title="Close" style="background:rgba(255,255,255,0.16);border:1px solid rgba(255,255,255,0.28);color:#fff;width:30px;height:30px;border-radius:6px;cursor:pointer;font-size:16px;font-weight:700;">✕</button>' +
      '  </div>' +
      '  <div id="cqModalBody" style="padding:18px;overflow-y:auto;flex:1;background:#FFFFFF;color:#0F172A;"></div>' +
      '</div>';
    document.body.appendChild(modal);

    // Close ONLY when the cross (✕) button is clicked — do NOT close on outside backdrop click
    modal.querySelector('#cqCloseModalBtn').addEventListener('click', function () {
      modal.classList.remove('is-open');
    });
    return modal;
  }

  async function copyText(text, btnEl, okLabel) {
    try {
      await navigator.clipboard.writeText(text);
    } catch (_) {
      var ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (_2) { }
      document.body.removeChild(ta);
    }
    if (btnEl) {
      var prev = btnEl.textContent;
      btnEl.textContent = okLabel || '✓ Copied';
      setTimeout(function () { btnEl.textContent = prev; }, 1800);
    }
  }

  var OrbixClientQuote = {
    openModal: function (app) {
      if (!app || !app.project) return;
      var self = this;
      var modal = ensureModalElement();
      var body = modal.querySelector('#cqModalBody');
      var proj = app.project;
      var meta = proj.meta || {};
      var currentUser = (root.OrbixProjects && root.OrbixProjects.currentUser) || {};
      var activeTier = (proj.rateCard && Core.normalizeTierName)
        ? Core.normalizeTierName(proj.rateCard.selectedTier || 'CC MATTE')
        : 'CC MATTE';
      var isTemplateTier = MASTER_VARIANTS.some(function (v) { return v.key === activeTier; });
      var defaultCheckedTier = isTemplateTier ? activeTier : 'CC MATTE';

      var clientName = meta.clientName || meta.client || 'Valued Client';
      var clientPhone = meta.phone || meta.contactNumber || '';
      var siteAddress = meta.siteAddress || meta.siteLocation || meta.location || '';
      var quoteCode = meta.cpCode || meta.quoteId || ('ORB-' + new Date().getFullYear());

      // Resolve the project's respective Employee (FA) name, phone & email (distinct from BH)
      var activeProjId = getActiveProjectId(app);
      var allProjects = (root.OrbixProjects && Array.isArray(root.OrbixProjects.projects)) ? root.OrbixProjects.projects : [];
      var activeProj = allProjects.filter(function (p) { return p && String(p.id) === String(activeProjId); })[0] || null;
      var allUsers = (root.OrbixProjects && Array.isArray(root.OrbixProjects.users)) ? root.OrbixProjects.users : [];
      var faUser = null;
      if (activeProj) {
        var ownerId = activeProj.created_by || activeProj.createdBy || '';
        var ownerEmail = String(activeProj.owner_email || activeProj.ownerEmail || '').trim().toLowerCase();
        var ownerName = String(activeProj.owner_name || activeProj.ownerName || '').trim().toLowerCase();
        if (ownerId) faUser = allUsers.filter(function (u) { return u && String(u.id) === String(ownerId); })[0] || null;
        if (!faUser && ownerEmail) faUser = allUsers.filter(function (u) { return u && u.email && String(u.email).trim().toLowerCase() === ownerEmail; })[0] || null;
        if (!faUser && ownerName) faUser = allUsers.filter(function (u) { return u && u.name && String(u.name).trim().toLowerCase() === ownerName; })[0] || null;
      }
      if (!faUser && currentUser && currentUser.id) {
        faUser = allUsers.filter(function (u) { return u && String(u.id) === String(currentUser.id); })[0] || currentUser;
      }
      var bhName = (activeProj && (activeProj.bh_name || activeProj.bhName || (activeProj.data && activeProj.data.details && activeProj.data.details.bhName))) || meta.bhName || '';
      var designerName = (faUser && faUser.name) || (activeProj && (activeProj.owner_name || activeProj.ownerName)) || currentUser.name || 'Cookscape Design Team';
      var designerEmail = (faUser && faUser.email) || (activeProj && (activeProj.owner_email || activeProj.ownerEmail)) || currentUser.email || 'designs.cookscape@gmail.com';
      var designerPhone = (faUser && faUser.phone) || currentUser.phone || '';

      var tierPreviews = {};
      MASTER_VARIANTS.forEach(function (v) {
        try {
          var vp = buildVariantQuotePayload(app, v.key, {}, '');
          tierPreviews[v.key] = { grandTotal: vp.grandTotal, unitCount: vp.items.length };
        } catch (_) {
          tierPreviews[v.key] = { grandTotal: 0, unitCount: 0 };
        }
      });

      var suggestedUser = makeDefaultUsername(clientName, quoteCode);
      var suggestedPass = randomPassword();

      var variantCheckboxesHtml = '<div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;">' + MASTER_VARIANTS.map(function (v) {
        var checked = (v.key === defaultCheckedTier) ? ' checked' : '';
        var info = tierPreviews[v.key] || { grandTotal: 0, unitCount: 0 };
        return '<label style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;border:1px solid #E2E8F0;border-radius:7px;cursor:pointer;background:#FAF6F0;">' +
          '<span style="display:flex;align-items:center;gap:7px;font-size:12px;font-weight:700;color:#08231B;">' +
          '<input type="checkbox" class="cq-tier-chk" value="' + esc(v.key) + '"' + checked + '> ' +
          '<span>' + esc(v.label) + '<span style="display:block;font-weight:500;color:#64748B;font-size:10.5px;">' + info.unitCount + ' units + quote</span></span>' +
          '</span>' +
          '<span style="font-family:monospace;font-size:12px;font-weight:700;color:#C00000;white-space:nowrap;">' + esc(fmtINR(info.grandTotal)) + '</span>' +
          '</label>';
      }).join('') + '</div>';

      body.innerHTML =
        '<div id="cqFormWrap">' +
        '  <div style="background:#FAF6F0;border:1px solid #E2D5C3;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#08231B;line-height:1.45;">' +
        '    <b>2-Step Approval &amp; Share Flow:</b><br>' +
        '    <b>Step 1:</b> Generate password-free <b>Head Review Link</b> (variant quotation pages with editable Discounts) &rarr; Share to Head.<br>' +
        '    <b>Step 2:</b> Once Head clicks <b>Approve</b>, generate the full password-protected <b>Client Link</b> (Username = Client Name) &amp; download full <b>PPTX / PDF</b>.' +
        '  </div>' +

        '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">' +
        '    <div>' +
        '      <label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px;">Patron / Client Name *</label>' +
        '      <input id="cqClientName" type="text" value="' + esc(clientName) + '" style="width:100%;padding:8px 10px;border:1px solid #CBD5E1;border-radius:6px;font-size:13px;">' +
        '    </div>' +
        '    <div>' +
        '      <label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px;">Patron Phone</label>' +
        '      <input id="cqClientPhone" type="text" value="' + esc(clientPhone) + '" style="width:100%;padding:8px 10px;border:1px solid #CBD5E1;border-radius:6px;font-size:13px;">' +
        '    </div>' +
        '    <div>' +
        '      <label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px;">Site Location</label>' +
        '      <input id="cqSiteAddress" type="text" value="' + esc(siteAddress) + '" style="width:100%;padding:8px 10px;border:1px solid #CBD5E1;border-radius:6px;font-size:13px;">' +
        '    </div>' +
        '    <div>' +
        '      <label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px;">Quote Reference Code</label>' +
        '      <input id="cqQuoteCode" type="text" value="' + esc(quoteCode) + '" style="width:100%;padding:8px 10px;border:1px solid #CBD5E1;border-radius:6px;font-size:13px;">' +
        '    </div>' +
        '  </div>' +

        '  <div style="margin-bottom:12px;">' +
        '    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:8px;">' +
        '      <div style="font-size:12px;font-weight:700;color:#0F172A;">Select Master Template Variant(s) for Quotation</div>' +
        '      <button type="button" id="cqOpenCustomVariantBtn" class="btn small" style="background:#0F766E;color:#fff;border-color:#0D9488;font-weight:700;padding:5px 12px;border-radius:6px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;">' +
        '        <span>🎨 Custom Variant</span>' +
        '      </button>' +
        '    </div>' +
        '    <div id="cqCustomVariantCardWrap" style="margin-bottom:8px;"></div>' +
        '    <div id="cqRoomWiseSelectorDrawer" style="display:none;background:#F8FAFC;border:1.5px solid #0D9488;border-radius:8px;padding:12px 14px;margin-bottom:12px;box-shadow:0 3px 10px rgba(13,148,136,0.12);">' +
        '      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">' +
        '        <div>' +
        '          <div style="font-size:12.5px;font-weight:700;color:#0F766E;">🎨 Room-Wise Custom Variant Configuration</div>' +
        '          <div style="font-size:11px;color:#64748B;">Assign specific finishes to individual rooms (e.g. 4X Tuff Gloss for Kitchen, Capricoast Matte for Bed)</div>' +
        '        </div>' +
        '        <div style="display:flex;align-items:center;gap:6px;">' +
        '          <label style="font-size:11px;color:#475569;font-weight:600;">Bulk Set:</label>' +
        '          <select id="cqBulkRoomTierSelect" style="font-size:11px;padding:3px 6px;border-radius:4px;border:1px solid #CBD5E1;background:#fff;">' +
        '            <option value="">-- Apply to all rooms --</option>' +
        MASTER_VARIANTS.map(function (v) { return '<option value="' + esc(v.key) + '">' + esc(v.label) + '</option>'; }).join('') +
        '          </select>' +
        '        </div>' +
        '      </div>' +
        '      <div id="cqRoomRowsList" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;max-height:220px;overflow-y:auto;padding-right:4px;margin-bottom:10px;"></div>' +
        '      <div style="display:flex;justify-content:space-between;align-items:center;background:#F0FDFA;border:1px solid #CCFBF1;border-radius:6px;padding:8px 12px;margin-bottom:10px;">' +
        '        <span style="font-size:11.5px;font-weight:600;color:#0F766E;">Estimated Custom Woodwork Total:</span>' +
        '        <span id="cqCustomLiveTotal" style="font-family:monospace;font-size:13px;font-weight:800;color:#0F766E;">₹ 0</span>' +
        '      </div>' +
        '      <div style="display:flex;gap:8px;justify-content:flex-end;">' +
        '        <button type="button" id="cqCancelCustomBtn" class="btn small" style="padding:5px 12px;font-size:11.5px;">Cancel</button>' +
        '        <button type="button" id="cqApplyCustomBtn" class="btn small" style="background:#0F766E;color:#fff;border-color:#0D9488;font-weight:700;padding:5px 16px;font-size:11.5px;">✅ Apply &amp; Select Custom Variant</button>' +
        '      </div>' +
        '    </div>' +
        variantCheckboxesHtml +
        '  </div>' +

        '  <div style="margin-bottom:12px;">' +
        '    <label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px;">Unit Specification Remarks (Optional — shown below Unit Snips)</label>' +
        '    <input id="cqUnitRemarks" type="text" placeholder="e.g. All kitchen base units include soft-close channels &amp; skirting" style="width:100%;padding:7px 10px;border:1px solid #CBD5E1;border-radius:6px;font-size:12.5px;">' +
        '  </div>' +

        '  <div id="cqErrorBox" style="display:none;background:#FEF2F2;border:1px solid #FCA5A5;color:#B91C1C;padding:8px 12px;border-radius:6px;font-size:12.5px;margin-bottom:10px;"></div>' +

        '  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:16px;">' +
        '    <button type="button" id="cqCreateReviewBtn" class="btn" style="flex:1;background:#C00000;color:#fff;border-color:#900000;font-weight:700;padding:11px 16px;">📋 Step 1: Generate Head Review Link (No Password)</button>' +
        '  </div>' +
        '</div>' +

        '<div id="cqResultCard" style="display:none;background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:14px;margin-bottom:16px;"></div>' +

        '<div style="border-top:1px solid #E2E8F0;padding-top:12px;">' +
        '  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">' +
        '    <div style="font-size:12.5px;font-weight:700;color:#0F172A;">Approval Status, Client Links &amp; Approved Downloads</div>' +
        '    <button type="button" id="cqRefreshListBtn" class="btn small" style="padding:4px 10px;font-size:11.5px;">🔄 Refresh Approval Status</button>' +
        '  </div>' +
        '  <div id="cqExistingList" style="font-size:12.5px;color:#64748B;">Loading saved quote links...</div>' +
        '</div>';

      modal.classList.add('is-open');

      var customCardWrap = body.querySelector('#cqCustomVariantCardWrap');
      var roomDrawer = body.querySelector('#cqRoomWiseSelectorDrawer');
      var projectRooms = getProjectRooms(proj);

      function renderCustomCard(quote) {
        if (!quote) {
          if (customCardWrap) customCardWrap.innerHTML = '';
          return;
        }
        var rmCount = Object.keys(quote.roomTiers || {}).length;
        customCardWrap.innerHTML =
          '<label style="display:flex;align-items:center;justify-content:space-between;padding:9px 12px;border:1.5px solid #0D9488;border-radius:8px;cursor:pointer;background:#F0FDFA;box-shadow:0 1px 3px rgba(13,148,136,0.12);">' +
          '  <span style="display:flex;align-items:center;gap:8px;font-size:12px;font-weight:700;color:#0F766E;">' +
          '    <input type="checkbox" class="cq-tier-chk" value="custom" checked> ' +
          '    <span>' +
          '      🎨 CUSTOM VARIANT (Room-Wise)' +
          '      <span style="display:block;font-weight:500;color:#0D9488;font-size:10.5px;">' +
          '        ' + (quote.items ? quote.items.length : 0) + ' units + quote · ' + rmCount + ' rooms configured' +
          '      </span>' +
          '    </span>' +
          '  </span>' +
          '  <span style="display:flex;align-items:center;gap:10px;">' +
          '    <button type="button" class="btn small" id="cqEditRoomsBtn" style="font-size:11px;padding:3px 8px;background:#CCFBF1;color:#0F766E;border-color:#5EEAD4;font-weight:600;">✏️ Edit Rooms</button>' +
          '    <span style="font-family:monospace;font-size:12.5px;font-weight:800;color:#0F766E;white-space:nowrap;">' +
          '      ' + esc(fmtINR(quote.grandTotal)) +
          '    </span>' +
          '  </span>' +
          '</label>';

        var editBtn = customCardWrap.querySelector('#cqEditRoomsBtn');
        if (editBtn) {
          editBtn.addEventListener('click', function (e) {
            e.preventDefault();
            e.stopPropagation();
            toggleRoomDrawer(true);
          });
        }
      }

      function populateRoomDrawer() {
        var currentTiers = (proj.rateCard && proj.rateCard.roomTiers) ? proj.rateCard.roomTiers : {};
        var listEl = roomDrawer.querySelector('#cqRoomRowsList');
        if (!listEl) return;

        var html = '';
        projectRooms.forEach(function (rm) {
          var selTier = currentTiers[rm.id] || currentTiers[rm.name] || proj.rateCard.selectedTier || 'CC MATTE';
          html += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:6px;padding:8px 10px;display:flex;align-items:center;justify-content:space-between;gap:8px;">' +
            '  <div>' +
            '    <div style="font-size:12px;font-weight:700;color:#0F172A;">' + esc(rm.name) + '</div>' +
            '    <div style="font-size:10.5px;color:#64748B;">' + (rm.unitCount || 0) + ' units</div>' +
            '  </div>' +
            '  <select class="cq-room-tier-select" data-room-id="' + esc(rm.id) + '" style="font-size:11px;padding:4px 6px;border-radius:5px;border:1px solid #CBD5E1;background:#fff;color:#0F172A;font-weight:600;max-width:160px;">' +
            MASTER_VARIANTS.map(function (v) {
              return '<option value="' + esc(v.key) + '"' + (v.key === selTier ? ' selected' : '') + '>' + esc(v.label) + '</option>';
            }).join('') +
            '  </select>' +
            '</div>';
        });

        listEl.innerHTML = html;
        updateDrawerLiveTotal();
      }

      function updateDrawerLiveTotal() {
        var tempRoomTiers = {};
        roomDrawer.querySelectorAll('.cq-room-tier-select').forEach(function (sel) {
          var rId = sel.getAttribute('data-room-id');
          if (rId) tempRoomTiers[rId] = sel.value;
        });

        var tempRateCard = Object.assign({}, proj.rateCard || {}, { roomTiers: tempRoomTiers, selectedTier: 'custom' });
        var tempProj = {
          plan: proj.plan,
          rateCard: tempRateCard,
          commercialCharges: proj.commercialCharges,
          meta: proj.meta
        };
        try {
          var q = Core.generateFullQuotation(tempProj, app.selectedBOQRooms || ['all']);
          var comm = app.computeCommercialSummary(q.subtotalWoodwork, app.getCommercialCharges());
          var liveEl = roomDrawer.querySelector('#cqCustomLiveTotal');
          if (liveEl) liveEl.textContent = fmtINR(comm.grandTotal);
        } catch (_) {}
      }

      function toggleRoomDrawer(show) {
        var isOpen = show !== undefined ? show : (roomDrawer.style.display !== 'none');
        if (!isOpen) {
          populateRoomDrawer();
          roomDrawer.style.display = 'block';
        } else {
          roomDrawer.style.display = 'none';
        }
      }

      var openBtn = body.querySelector('#cqOpenCustomVariantBtn');
      if (openBtn) {
        openBtn.addEventListener('click', function () {
          toggleRoomDrawer();
        });
      }

      var cancelBtn = roomDrawer.querySelector('#cqCancelCustomBtn');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', function () {
          toggleRoomDrawer(false);
        });
      }

      var bulkSelect = roomDrawer.querySelector('#cqBulkRoomTierSelect');
      if (bulkSelect) {
        bulkSelect.addEventListener('change', function () {
          var val = this.value;
          if (!val) return;
          roomDrawer.querySelectorAll('.cq-room-tier-select').forEach(function (s) {
            s.value = val;
          });
          updateDrawerLiveTotal();
        });
      }

      roomDrawer.addEventListener('change', function (e) {
        if (e.target && e.target.classList.contains('cq-room-tier-select')) {
          updateDrawerLiveTotal();
        }
      });

      var applyBtn = roomDrawer.querySelector('#cqApplyCustomBtn');
      if (applyBtn) {
        applyBtn.addEventListener('click', function () {
          var newRoomTiers = {};
          roomDrawer.querySelectorAll('.cq-room-tier-select').forEach(function (sel) {
            var rId = sel.getAttribute('data-room-id');
            if (rId) newRoomTiers[rId] = sel.value;
          });
          proj.rateCard = proj.rateCard || {};
          proj.rateCard.roomTiers = newRoomTiers;
          if (typeof app.saveToLocalStorage === 'function') app.saveToLocalStorage();

          try {
            var cq = buildVariantQuotePayload(app, 'custom', {}, '');
            renderCustomCard(cq);
          } catch (err) {
            console.error('Failed to build custom variant quote:', err);
          }
          toggleRoomDrawer(false);
        });
      }

      // If project already has roomTiers defined, render custom card on load
      if (proj.rateCard && proj.rateCard.roomTiers && Object.keys(proj.rateCard.roomTiers).length > 0) {
        try {
          var initCq = buildVariantQuotePayload(app, 'custom', {}, '');
          renderCustomCard(initCq);
        } catch (_) {}
      }

      async function gatherReviewPayload() {
        var selectedTiers = [];
        body.querySelectorAll('.cq-tier-chk:checked').forEach(function (chk) {
          selectedTiers.push(chk.value);
        });
        if (!selectedTiers.length) throw new Error('Select at least one Master Template variant.');

        var cName = body.querySelector('#cqClientName').value.trim();
        var cPhone = body.querySelector('#cqClientPhone').value.trim();
        var cLoc = body.querySelector('#cqSiteAddress').value.trim();
        var qCode = body.querySelector('#cqQuoteCode').value.trim();
        var remarks = body.querySelector('#cqUnitRemarks').value.trim();

        if (!cName) throw new Error('Patron / Client Name is required.');

        proj.meta = proj.meta || {};
        proj.meta.clientName = cName;
        proj.meta.phone = cPhone;
        proj.meta.siteAddress = cLoc;
        proj.meta.cpCode = qCode;
        if (typeof app.saveToLocalStorage === 'function') app.saveToLocalStorage();

        var baseQuote = Core.generateFullQuotation(proj, app.selectedBOQRooms || ['all']);
        var iconData = await buildUnitIconsMap(app, baseQuote.furnitureItems || []);

        var variantQuotes = selectedTiers.map(function (tk) {
          return buildVariantQuotePayload(app, tk, iconData.keyByItemKey, remarks);
        });

        var allVariantsPricing = MASTER_VARIANTS.map(function (v) {
          var info = tierPreviews[v.key] || { grandTotal: 0, unitCount: 0 };
          var matchedSelected = variantQuotes.filter(function (vq) { return vq.tierKey === v.key; })[0];
          return {
            tierKey: v.key,
            tierTitle: v.label,
            unitCount: matchedSelected ? (matchedSelected.items || []).length : (info.unitCount || 0),
            grandTotal: Math.round(matchedSelected ? (matchedSelected.grandTotal || 0) : (info.grandTotal || 0)),
            selected: selectedTiers.indexOf(v.key) !== -1
          };
        });

        var customMatched = variantQuotes.filter(function (vq) { return vq.tierKey === 'custom'; })[0];
        if (customMatched || (proj.rateCard && proj.rateCard.roomTiers && Object.keys(proj.rateCard.roomTiers).length)) {
          var cInfo = customMatched || buildVariantQuotePayload(app, 'custom', {}, '');
          allVariantsPricing.push({
            tierKey: 'custom',
            tierTitle: 'CUSTOM VARIANT (Room-Wise)',
            isCustomVariant: true,
            unitCount: (cInfo.items || []).length,
            grandTotal: Math.round(cInfo.grandTotal || 0),
            selected: selectedTiers.indexOf('custom') !== -1,
            roomBreakdown: cInfo.roomsSummary || []
          });
        }

        return {
          projectId: getActiveProjectId(app),
          title: (proj.meta.title || 'Modular Interior Proposal') + ' — ' + cName,
          quoteCode: qCode,
          clientName: cName,
          clientPhone: cPhone,
          clientEmail: meta.email || '',
          siteAddress: cLoc,
          quoteSnapshot: {
            meta: {
              title: proj.meta.title || 'Modular Interior Proposal',
              clientName: cName,
              phone: cPhone,
              email: meta.email || '',
              siteAddress: cLoc,
              quoteId: qCode,
              designerName: designerName,
              designerPhone: designerPhone,
              bhName: bhName,
              dateCreated: meta.dateCreated || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
            },
            designer: {
              name: designerName,
              phone: designerPhone,
              email: designerEmail
            },
            variantQuotes: variantQuotes,
            allVariantsPricing: allVariantsPricing,
            unitIcons: iconData.icons
          }
        };
      }

      var errBox = body.querySelector('#cqErrorBox');
      function showErr(msg) {
        errBox.textContent = msg || '';
        errBox.style.display = msg ? 'block' : 'none';
      }

      body.querySelector('#cqRefreshListBtn').addEventListener('click', function () {
        self.loadExistingList(body, getActiveProjectId(app));
      });

      body.querySelector('#cqCreateReviewBtn').addEventListener('click', async function () {
        showErr('');
        var btn = this;
        btn.disabled = true;
        btn.textContent = '⏳ Generating Head Review Link...';
        try {
          var payload = await gatherReviewPayload();
          var res = await apiCall('/api/client-quotes/review', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });
          var data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate review link');

          var headMsg =
            'Cookscape Head Review Request — ' + payload.clientName + '\n' +
            'Project: ' + payload.title + '\n' +
            'Review & Approve Link (No Password): ' + data.reviewUrl + '\n' +
            'Please review variant discounts and click Approve.';

          var resCard = body.querySelector('#cqResultCard');
          resCard.style.display = 'block';
          resCard.style.background = '#FFFBEB';
          resCard.style.borderColor = '#FCD34D';
          resCard.innerHTML =
            '<div style="font-size:13.5px;font-weight:700;color:#92400E;margin-bottom:6px;">📋 Step 1 Complete: Head Review Link Ready (No Password)</div>' +
            '<div style="font-size:12px;background:#fff;border:1px solid #FDE68A;border-radius:6px;padding:8px 10px;margin-bottom:8px;word-break:break-all;">' +
            '  <div><b>Head Review Link:</b> <a href="' + esc(data.reviewPath) + '" target="_blank" style="color:#1D4ED8;">' + esc(data.reviewUrl) + '</a></div>' +
            '  <div style="margin-top:4px;color:#64748B;">Share this link with Head. Once Head edits discounts &amp; approves, click <b>Refresh Approval Status</b> below to generate the Client Link + download PPTX / PDF.</div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '  <button type="button" id="cqCopyRevBtn" class="btn small">📋 Copy Review Link</button>' +
            '  <a href="' + esc(data.reviewPath) + '" target="_blank" class="btn small" style="text-decoration:none;">🔗 Open Review Page</a>' +
            '  <a href="https://wa.me/?text=' + encodeURIComponent(headMsg) + '" target="_blank" class="btn small" style="background:#15803D;color:#fff;border-color:#15803D;text-decoration:none;">💬 Share to Head (WhatsApp)</a>' +
            '</div>';

          resCard.querySelector('#cqCopyRevBtn').addEventListener('click', function () {
            copyText(data.reviewUrl, this, '✓ Copied');
          });

          self.loadExistingList(body, getActiveProjectId(app));
        } catch (err) {
          showErr(err.message || String(err));
        } finally {
          btn.disabled = false;
          btn.textContent = '📋 Step 1: Generate Head Review Link (No Password)';
        }
      });

      this.loadExistingList(body, getActiveProjectId(app));
    },

    downloadApprovedFile: async function (quoteId, format, clientName, btnEl) {
      var prev = btnEl.textContent;
      btnEl.disabled = true;
      btnEl.textContent = format === 'pdf' ? '⏳ Building PDF...' : '⏳ Building PPTX...';
      try {
        var endpoint = '/api/client-quotes/' + encodeURIComponent(quoteId) + (format === 'pdf' ? '/export-pdf' : '/export-pptx');
        var res = await apiCall(endpoint, { method: 'POST', credentials: 'same-origin' });
        if (!res.ok) {
          var errJson = await res.json().catch(function () { return {}; });
          throw new Error(errJson.error || (format.toUpperCase() + ' export failed'));
        }
        var blob = await res.blob();
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url;
        var clean = String(clientName || 'Cookscape').replace(/[^a-zA-Z0-9_-]/g, '_') || 'Cookscape';
        a.download = clean + '_Approved_Quotation.' + format;
        document.body.appendChild(a);
        a.click();
        setTimeout(function () {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
        }, 800);
      } catch (err) {
        alert(err.message || String(err));
      } finally {
        btnEl.disabled = false;
        btnEl.textContent = prev;
      }
    },

    loadExistingList: async function (body, projectId) {
      var listEl = body.querySelector('#cqExistingList');
      if (!listEl) return;
      try {
        var res = await apiCall('/api/client-quotes/project/' + encodeURIComponent(projectId), {
          credentials: 'same-origin',
          cache: 'no-store'
        });
        var data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Could not load links');
        var quotes = data.quotes || [];
        if (!quotes.length) {
          listEl.innerHTML = '<div style="padding:8px 0;color:#64748B;">No quotation review links created for this project yet. Generate a Head Review Link in Step 1 above.</div>';
          return;
        }
        var renderQuoteCard = function (q, idx, totalCount, isHistoryItem) {
          var isApproved = q.approvalStatus === 'approved';
          var isActivated = Boolean(q.clientLinkActivated);
          var isExpired = q.expiresAt && new Date(q.expiresAt).getTime() < Date.now();
          var revNum = totalCount - idx;

          var accentBorder = q.isRevoked
            ? '#DC2626'
            : (isExpired ? '#D97706' : (isActivated ? '#0F766E' : (isApproved ? '#16A34A' : '#F59E0B')));
          var cardBg = isHistoryItem ? '#F1F5F9' : '#FFFFFF';

          var approvalBadge = isApproved
            ? '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;color:#fff;background:#16A34A;">✅ Approved' + (q.approvedBy ? (' by ' + esc(q.approvedBy)) : '') + '</span>'
            : '<span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;color:#92400E;background:#FEF3C7;border:1px solid #F59E0B;">⏳ Pending Head Approval</span>';

          var clientBadge = '';
          if (isActivated) {
            var cBg = q.isRevoked ? '#DC2626' : (isExpired ? '#D97706' : '#0F766E');
            var cLbl = q.isRevoked ? 'Revoked' : (isExpired ? 'Expired' : 'Client Link Active');
            clientBadge = ' <span style="display:inline-block;padding:2px 8px;border-radius:999px;font-size:10.5px;font-weight:700;color:#fff;background:' + cBg + ';">' + cLbl + '</span>';
          }

          var varSummaryHtml = (q.variantSummaries || []).map(function (vs) {
            var discNote = (vs.discountPercent || vs.adpPercent)
              ? (' <span style="color:#B45309;">(WW Disc ' + vs.discountPercent + '%' + (vs.adpPercent ? (' + Design Disc ' + vs.adpPercent + '%') : '') + ')</span>')
              : '';
            return '<span style="display:inline-block;background:#FAF6F0;border:1px solid #E2D5C3;border-radius:5px;padding:2px 7px;margin:2px 4px 2px 0;font-size:11px;"><b>' + esc(vs.tierTitle || vs.tierKey) + '</b>: ' + esc(fmtINR(vs.grandTotal)) + discNote + '</span>';
          }).join('');

          var step2Html = '';
          if (!isApproved) {
            step2Html =
              '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;align-items:center;">' +
              '  <button type="button" class="btn small cq-act-copy" data-url="' + esc(q.reviewUrl) + '" style="background:#FFFBEB;border-color:#F59E0B;color:#92400E;">📋 Copy Head Review Link</button>' +
              '  <a href="' + esc(q.reviewPath) + '" target="_blank" class="btn small" style="text-decoration:none;">🔗 Open Review Page</a>' +
              '  <button type="button" class="btn small cq-act-del" data-id="' + esc(q.id) + '" style="color:#B91C1C;border-color:#FECACA;">🗑 Delete</button>' +
              '</div>';
          } else if (!isActivated) {
            var defaultPw = randomPassword();
            step2Html =
              '<div style="margin-top:9px;background:#F0FDF4;border:1px solid #86EFAC;border-radius:8px;padding:10px;">' +
              '  <div style="font-size:11.5px;font-weight:700;color:#166534;margin-bottom:7px;">Step 2 Unlocked: Generate Full Client Link (Username = Client Name) &amp; Download PPTX / PDF</div>' +
              '  <div style="display:grid;grid-template-columns:1fr 1fr 125px;gap:7px;margin-bottom:8px;">' +
              '    <div><label style="display:block;font-size:10.5px;font-weight:700;color:#475569;margin-bottom:2px;">Client Username</label><input type="text" class="cq-act-user" value="' + esc(q.clientName) + '" style="width:100%;padding:6px 8px;border:1px solid #CBD5E1;border-radius:5px;font-size:12px;"></div>' +
              '    <div><label style="display:block;font-size:10.5px;font-weight:700;color:#475569;margin-bottom:2px;">Client Password</label>' +
              '      <div style="display:flex;gap:4px;">' +
              '        <input type="text" class="cq-act-pass-in" value="' + esc(defaultPw) + '" style="flex:1;min-width:0;padding:6px 8px;border:1px solid #CBD5E1;border-radius:5px;font-size:12px;font-family:monospace;font-weight:700;">' +
              '        <button type="button" class="btn small cq-btn-act-gen-rnd" title="Generate Random Password" style="background:#F3F4F6;padding:6px 8px;flex-shrink:0;">🎲</button>' +
              '      </div>' +
              '    </div>' +
              '    <div><label style="display:block;font-size:10.5px;font-weight:700;color:#475569;margin-bottom:2px;">Validity</label>' +
              '      <select class="cq-act-exp" style="width:100%;padding:6px 6px;border:1px solid #CBD5E1;border-radius:5px;font-size:12px;">' +
              '        <option value="1">1 Day</option><option value="7">7 Days</option><option value="15" selected>15 Days</option><option value="30">30 Days</option><option value="365">1 Year</option><option value="0">No Expiry</option>' +
              '      </select>' +
              '    </div>' +
              '  </div>' +
              '  <div style="display:flex;gap:6px;flex-wrap:wrap;">' +
              '    <button type="button" class="btn small cq-btn-activate" data-id="' + esc(q.id) + '" style="background:#C00000;color:#fff;border-color:#900000;font-weight:700;">🔐 Generate Full Client Link</button>' +
              '    <button type="button" class="btn small cq-btn-pptx" data-id="' + esc(q.id) + '" data-client="' + esc(q.clientName) + '" style="background:#08231B;color:#fff;border-color:#08231B;">📊 Download Full PPTX</button>' +
              '    <button type="button" class="btn small cq-btn-pdf" data-id="' + esc(q.id) + '" data-client="' + esc(q.clientName) + '" style="background:#1E3A8A;color:#fff;border-color:#1E3A8A;">📄 Download Full PDF</button>' +
              '    <button type="button" class="btn small cq-act-del" data-id="' + esc(q.id) + '" style="color:#B91C1C;border-color:#FECACA;">🗑 Delete</button>' +
              '  </div>' +
              '</div>';
          } else {
            step2Html =
              '<div style="font-size:11.5px;color:#475569;margin-top:5px;">Client Login User: <code style="background:#E2E8F0;padding:1px 5px;border-radius:4px;">' + esc(q.clientUsername) + '</code> &bull; Views: <b>' + q.viewCount + '</b>' + (q.expiresAt ? (' &bull; Expires: ' + new Date(q.expiresAt).toLocaleDateString('en-IN')) : ' &bull; No Expiry') + (q.lastViewedAt ? (' &bull; Last Opened: ' + new Date(q.lastViewedAt).toLocaleString('en-IN')) : '') + '</div>' +
              '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
              '  <button type="button" class="btn small cq-act-copy" data-url="' + esc(q.shareUrl) + '" style="background:#166534;color:#fff;border-color:#166534;">📋 Copy Client Link</button>' +
              '  <button type="button" class="btn small cq-btn-pptx" data-id="' + esc(q.id) + '" data-client="' + esc(q.clientName) + '" style="background:#08231B;color:#fff;border-color:#08231B;">📊 Full PPTX</button>' +
              '  <button type="button" class="btn small cq-btn-pdf" data-id="' + esc(q.id) + '" data-client="' + esc(q.clientName) + '" style="background:#1E3A8A;color:#fff;border-color:#1E3A8A;">📄 Full PDF</button>' +
              '  <button type="button" class="btn small cq-act-pass" data-id="' + esc(q.id) + '" data-user="' + esc(q.clientUsername) + '">🔑 Reset Pass</button>' +
              '  <button type="button" class="btn small cq-act-toggle" data-id="' + esc(q.id) + '" data-revoked="' + (q.isRevoked ? '1' : '0') + '">' + (q.isRevoked ? '✅ Reactivate' : '⛔ Revoke') + '</button>' +
              '  <button type="button" class="btn small cq-act-del" data-id="' + esc(q.id) + '" style="color:#B91C1C;border-color:#FECACA;">🗑 Delete</button>' +
              '</div>' +
              '<div class="cq-pass-edit-pane" style="display:none;margin-top:9px;background:#FFFBEB;border:1px solid #FCD34D;border-radius:7px;padding:9px 11px;">' +
              '  <div style="font-size:11.5px;font-weight:700;color:#92400E;margin-bottom:6px;">🔑 Reset Client Password for <code>' + esc(q.clientUsername) + '</code>:</div>' +
              '  <div style="display:flex;gap:6px;align-items:center;flex-wrap:wrap;">' +
              '    <input type="text" class="cq-custom-pass-val" placeholder="Type custom password or click 🎲..." style="flex:1;min-width:160px;padding:6px 8px;border:1px solid #CBD5E1;border-radius:5px;font-size:12px;font-family:monospace;font-weight:700;">' +
              '    <button type="button" class="btn small cq-btn-gen-rnd" title="Generate Random Password" style="background:#F3F4F6;">🎲 Random</button>' +
              '    <button type="button" class="btn small cq-btn-save-custom-pass" data-id="' + esc(q.id) + '" data-user="' + esc(q.clientUsername) + '" style="background:#C00000;color:#fff;border-color:#900000;font-weight:700;">💾 Save Password</button>' +
              '    <button type="button" class="btn small cq-btn-cancel-pass" style="background:#fff;border-color:#CBD5E1;color:#475569;">Cancel</button>' +
              '  </div>' +
              '  <div class="cq-pass-err-msg" style="color:#B91C1C;font-size:11px;margin-top:4px;display:none;"></div>' +
              '</div>';
          }

          return '<div class="cq-quote-card" style="border:1px solid #CBD5E1;border-left:4px solid ' + accentBorder + ';border-radius:9px;padding:11px 13px;margin-bottom:10px;background:' + cardBg + ';box-shadow:0 2px 6px rgba(15,23,42,0.05);">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '  <div><span style="display:inline-block;background:#08231B;color:#fff;font-size:10px;font-weight:700;padding:2px 6px;border-radius:4px;margin-right:5px;">Rev #' + revNum + '</span>' + approvalBadge + clientBadge + ' <b style="margin-left:4px;">' + esc(q.clientName) + '</b> <span style="color:#64748B;font-size:11px;">(' + esc(q.quoteCode || q.id) + ')</span></div>' +
            '  <div style="font-size:11px;color:#475569;font-weight:600;">' + (q.createdAt ? new Date(q.createdAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '') + '</div>' +
            '</div>' +
            '<div style="margin-top:6px;">' + varSummaryHtml + '</div>' +
            (q.approvalRemarks ? ('<div style="font-size:11.5px;color:#166534;margin-top:4px;">Head Remarks: <i>' + esc(q.approvalRemarks) + '</i></div>') : '') +
            step2Html +
            '</div>';
        };

        var latestHtml = '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#08231B;background:#EFE8DD;padding:5px 10px;border-radius:6px;margin-bottom:8px;">📌 Latest / Current Quotation</div>' +
          renderQuoteCard(quotes[0], 0, quotes.length, false);
        var historyHtml = '';
        if (quotes.length > 1) {
          historyHtml = '<div style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.06em;color:#475569;background:#E2E8F0;padding:5px 10px;border-radius:6px;margin:14px 0 8px 0;">🕘 Previous Quotation History (' + (quotes.length - 1) + ')</div>' +
            quotes.slice(1).map(function (q, i) { return renderQuoteCard(q, i + 1, quotes.length, true); }).join('');
        }
        listEl.innerHTML = latestHtml + historyHtml;

        listEl.querySelectorAll('.cq-act-copy').forEach(function (b) {
          b.addEventListener('click', function () { copyText(this.getAttribute('data-url'), this, '✓ Copied'); });
        });
        listEl.querySelectorAll('.cq-btn-activate').forEach(function (b) {
          b.addEventListener('click', async function () {
            var qId = this.getAttribute('data-id');
            var card = this.closest('.cq-quote-card');
            var uVal = card.querySelector('.cq-act-user').value.trim();
            var pVal = card.querySelector('.cq-act-pass-in').value.trim();
            var expVal = Number(card.querySelector('.cq-act-exp').value);
            this.disabled = true;
            this.textContent = '⏳ Activating...';
            try {
              var r = await apiCall('/api/client-quotes/' + encodeURIComponent(qId) + '/activate-client-link', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ clientUsername: uVal, clientPassword: pVal, expiryDays: expVal })
              });
              var d = await r.json();
              if (!r.ok || !d.success) throw new Error(d.error || 'Activation failed');
              var inviteMsg =
                'Cookscape Interior Quotation — ' + d.quote.clientName + '\n' +
                'Quote Link: ' + d.shareUrl + '\n' +
                'Username: ' + d.quote.clientUsername + '\n' +
                'Password: ' + pVal;
              var resCard = body.querySelector('#cqResultCard');
              resCard.style.display = 'block';
              resCard.style.background = '#F0FDF4';
              resCard.style.borderColor = '#86EFAC';
              resCard.innerHTML =
                '<div style="font-size:13.5px;font-weight:700;color:#166534;margin-bottom:6px;">✅ Full Client Quote Link Activated!</div>' +
                '<div style="font-size:12px;background:#fff;border:1px solid #BBF7D0;border-radius:6px;padding:8px 10px;margin-bottom:8px;word-break:break-all;">' +
                '  <div><b>Client Link:</b> <a href="' + esc(d.sharePath) + '" target="_blank" style="color:#1D4ED8;">' + esc(d.shareUrl) + '</a></div>' +
                '  <div style="margin-top:4px;"><b>Username:</b> <code style="background:#F1F5F9;padding:1px 5px;border-radius:4px;">' + esc(d.quote.clientUsername) + '</code> &nbsp; <b>Password:</b> <code style="background:#F1F5F9;padding:1px 5px;border-radius:4px;">' + esc(pVal) + '</code></div>' +
                '  <div style="margin-top:4px;font-size:11px;color:#0F766E;">📲 WhatsApp alert will trigger to the project\'s BH &amp; Employee as soon as the client opens this link.</div>' +
                '</div>' +
                '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
                '  <button type="button" id="cqCopyClientUrlBtn" class="btn small">📋 Copy Client Link</button>' +
                '  <button type="button" id="cqCopyClientInvBtn" class="btn small" style="background:#166534;color:#fff;border-color:#166534;">💬 Copy Client Invite (Link + Login)</button>' +
                '</div>';
              resCard.querySelector('#cqCopyClientUrlBtn').addEventListener('click', function () {
                copyText(d.shareUrl, this, '✓ Copied');
              });
              resCard.querySelector('#cqCopyClientInvBtn').addEventListener('click', function () {
                copyText(inviteMsg, this, '✓ Invite Copied');
              });
              OrbixClientQuote.loadExistingList(body, projectId);
            } catch (err) {
              alert(err.message || String(err));
              this.disabled = false;
              this.textContent = '🔐 Generate Full Client Link';
            }
          });
        });
        listEl.querySelectorAll('.cq-btn-pptx').forEach(function (b) {
          b.addEventListener('click', function () {
            OrbixClientQuote.downloadApprovedFile(this.getAttribute('data-id'), 'pptx', this.getAttribute('data-client'), this);
          });
        });
        listEl.querySelectorAll('.cq-btn-pdf').forEach(function (b) {
          b.addEventListener('click', function () {
            OrbixClientQuote.downloadApprovedFile(this.getAttribute('data-id'), 'pdf', this.getAttribute('data-client'), this);
          });
        });
        listEl.querySelectorAll('.cq-act-toggle').forEach(function (b) {
          b.addEventListener('click', async function () {
            var qId = this.getAttribute('data-id');
            var curRev = this.getAttribute('data-revoked') === '1';
            await apiCall('/api/client-quotes/' + encodeURIComponent(qId), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ isRevoked: !curRev })
            });
            OrbixClientQuote.loadExistingList(body, projectId);
          });
        });
        listEl.querySelectorAll('.cq-btn-act-gen-rnd').forEach(function (b) {
          b.addEventListener('click', function () {
            var box = this.closest('div');
            if (box) {
              var inp = box.querySelector('.cq-act-pass-in');
              if (inp) inp.value = randomPassword();
            }
          });
        });
        listEl.querySelectorAll('.cq-act-pass').forEach(function (b) {
          b.addEventListener('click', function () {
            var card = this.closest('.cq-quote-card');
            if (!card) return;
            var pane = card.querySelector('.cq-pass-edit-pane');
            if (!pane) return;
            var isHidden = (pane.style.display === 'none' || !pane.style.display);
            pane.style.display = isHidden ? 'block' : 'none';
            if (isHidden) {
              var passInput = pane.querySelector('.cq-custom-pass-val');
              if (passInput) {
                if (!passInput.value) passInput.value = randomPassword();
                passInput.focus();
                passInput.select();
              }
            }
          });
        });
        listEl.querySelectorAll('.cq-btn-gen-rnd').forEach(function (b) {
          b.addEventListener('click', function () {
            var pane = this.closest('.cq-pass-edit-pane');
            if (pane) {
              var inp = pane.querySelector('.cq-custom-pass-val');
              if (inp) {
                inp.value = randomPassword();
                inp.focus();
              }
            }
          });
        });
        listEl.querySelectorAll('.cq-btn-cancel-pass').forEach(function (b) {
          b.addEventListener('click', function () {
            var pane = this.closest('.cq-pass-edit-pane');
            if (pane) pane.style.display = 'none';
          });
        });
        listEl.querySelectorAll('.cq-btn-save-custom-pass').forEach(function (b) {
          b.addEventListener('click', async function () {
            var pane = this.closest('.cq-pass-edit-pane');
            var qId = this.getAttribute('data-id');
            var cUser = this.getAttribute('data-user');
            var passInput = pane ? pane.querySelector('.cq-custom-pass-val') : null;
            var errEl = pane ? pane.querySelector('.cq-pass-err-msg') : null;
            var newPw = passInput ? passInput.value.trim() : '';

            if (!newPw || newPw.length < 4) {
              if (errEl) {
                errEl.innerText = 'Password must be at least 4 characters long.';
                errEl.style.display = 'block';
              } else {
                alert('Password must be at least 4 characters long.');
              }
              return;
            }
            if (errEl) errEl.style.display = 'none';

            var btn = this;
            btn.disabled = true;
            var origText = btn.innerText;
            btn.innerText = 'Saving...';
            try {
              var r = await apiCall('/api/client-quotes/' + encodeURIComponent(qId), {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'same-origin',
                body: JSON.stringify({ clientPassword: newPw })
              });
              if (r.ok) {
                if (pane) pane.style.display = 'none';
                var resCard = body.querySelector('#cqResultCard');
                if (resCard) {
                  resCard.style.display = 'block';
                  resCard.innerHTML = '<b>🔑 Password Updated for <code>' + esc(cUser) + '</code>:</b> New Password = <code style="background:#FEF3C7;padding:2px 7px;border-radius:4px;font-size:13px;color:#92400E;font-weight:700;">' + esc(newPw) + '</code>';
                }
                if (typeof showToast === 'function') {
                  showToast('✓ Password updated for ' + cUser, 'success');
                }
              } else {
                var errJson = await r.json().catch(function () { return {}; });
                var msg = errJson.error || ('Failed to update password (' + r.status + ')');
                if (errEl) {
                  errEl.innerText = msg;
                  errEl.style.display = 'block';
                } else {
                  alert(msg);
                }
              }
            } catch (err) {
              if (errEl) {
                errEl.innerText = err.message;
                errEl.style.display = 'block';
              }
            } finally {
              btn.disabled = false;
              btn.innerText = origText;
            }
          });
        });
        listEl.querySelectorAll('.cq-act-del').forEach(function (b) {
          b.addEventListener('click', async function () {
            if (!confirm('Delete this quotation link permanently?')) return;
            var qId = this.getAttribute('data-id');
            await apiCall('/api/client-quotes/' + encodeURIComponent(qId), {
              method: 'DELETE',
              credentials: 'same-origin'
            });
            OrbixClientQuote.loadExistingList(body, projectId);
          });
        });
      } catch (err) {
        listEl.innerHTML = '<div style="color:#B91C1C;">' + esc(err.message) + '</div>';
      }
    }
  };

  root.OrbixClientQuote = OrbixClientQuote;
})(typeof window !== 'undefined' ? window : globalThis);
