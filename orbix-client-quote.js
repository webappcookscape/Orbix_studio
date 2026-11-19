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
    var normalized = (Core && Core.normalizeTierName) ? Core.normalizeTierName(tierKey) : tierKey;

    var clonedRateCard = JSON.parse(JSON.stringify(origRateCard));
    clonedRateCard.selectedTier = normalized;
    if (clonedRateCard.roomTiers && typeof clonedRateCard.roomTiers === 'object') {
      Object.keys(clonedRateCard.roomTiers).forEach(function (rk) {
        clonedRateCard.roomTiers[rk] = normalized;
      });
    }

    var clonedProj = {
      plan: proj.plan,
      rateCard: clonedRateCard,
      commercialCharges: proj.commercialCharges,
      meta: proj.meta
    };

    var quote = Core.generateFullQuotation(clonedProj, app.selectedBOQRooms || ['all']);
    var commCharges = app.getCommercialCharges();
    var comm = app.computeCommercialSummary(quote.subtotalWoodwork, commCharges);

    var varMeta = MASTER_VARIANTS.filter(function (v) { return v.key === normalized; })[0];
    var tierTitle = (varMeta && varMeta.label) || normalized.toUpperCase();

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

    var roomsSummary = (quote.allRoomsSummary || []).map(function (r) {
      return {
        name: r.name,
        itemCount: r.itemCount || 0,
        roomSubtotal: Math.round(r.roomSubtotal || 0),
        percentShare: r.percentShare || 0
      };
    });

    var roomScopeLabel = quote.isFiltered
      ? ('Selected: ' + roomsSummary.map(function (r) { return r.name; }).join(', '))
      : 'All Rooms (Entire Home)';

    return {
      tierKey: normalized,
      tierTitle: tierTitle,
      roomScopeLabel: roomScopeLabel,
      currencySymbol: quote.currencySymbol || '₹',
      grandTotal: Math.round(comm.grandTotal || 0),
      roomsSummary: roomsSummary,
      commercial: {
        woodworkSubtotal: comm.woodworkSubtotal,
        additionalAccessories: comm.additionalAccessories,
        appliances: comm.appliances,
        designPercent: comm.designPercent,
        designAmount: comm.designAmount,
        freightPercent: comm.freightPercent,
        freightAmount: comm.freightAmount,
        discountPercent: comm.discountPercent,
        discountAmount: comm.discountAmount,
        adpPercent: comm.adpPercent,
        adpAmount: comm.adpAmount,
        netBeforeTax: comm.netValue,
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
    modal.innerHTML =
      '<div class="orbix-modal-box" style="max-width:780px;width:95vw;max-height:92vh;display:flex;flex-direction:column;">' +
      '  <div class="orbix-modal-hdr" style="background:linear-gradient(135deg,#08231B,#0F172A);color:#fff;padding:14px 18px;display:flex;align-items:center;justify-content:space-between;border-radius:10px 10px 0 0;">' +
      '    <div>' +
      '      <div style="font-size:15px;font-weight:700;">🔐 Cookscape Client Quote Generator (Master Template)</div>' +
      '      <div style="font-size:11.5px;color:#CBD5E1;margin-top:2px;">Cover + Intro (2–6) + Selected Variants (Divider • Specs • Unit Snips • Quotation) + Policy &amp; Terms (22–29)</div>' +
      '    </div>' +
      '    <button type="button" id="cqCloseModalBtn" style="background:rgba(255,255,255,0.12);border:none;color:#fff;width:28px;height:28px;border-radius:6px;cursor:pointer;font-size:16px;">✕</button>' +
      '  </div>' +
      '  <div id="cqModalBody" style="padding:18px;overflow-y:auto;flex:1;background:#FFFFFF;color:#0F172A;"></div>' +
      '</div>';
    document.body.appendChild(modal);

    modal.querySelector('#cqCloseModalBtn').addEventListener('click', function () {
      modal.classList.remove('is-open');
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal) modal.classList.remove('is-open');
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
      try { document.execCommand('copy'); } catch (_2) {}
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
      var designerName = meta.designerName || currentUser.name || 'Cookscape Design Team';
      var designerEmail = currentUser.email || 'designs.cookscape@gmail.com';
      var designerPhone = currentUser.phone || meta.designerPhone || '93611 84787';

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
        '  <div style="background:#FAF6F0;border:1px solid #E2D5C3;border-radius:8px;padding:10px 12px;margin-bottom:12px;font-size:12px;color:#08231B;">' +
        '    <b>Master Template Flow Locked:</b> Cover Page &rarr; Intro (Slides 2&ndash;6) &rarr; Selected Variant(s) [Divider &bull; Specs &bull; <b>Auto Unit Snips</b> &bull; <b>Auto Quotation Snip</b>] &rarr; Timelines, Inclusions, Payment, T&amp;C &amp; FAQs (34&ndash;40) &rarr; Thank You (41).' +
        '  </div>' +

        '  <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:14px;">' +
        '    <div>' +
        '      <label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px;">Patron Name *</label>' +
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
        '    <div style="font-size:12px;font-weight:700;color:#0F172A;margin-bottom:6px;">Select Master Template Variant(s) — Auto-Populates Unit Snips &amp; Quotation Snip</div>' +
        variantCheckboxesHtml +
        '  </div>' +

        '  <div style="margin-bottom:14px;">' +
        '    <label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px;">Unit Specification Remarks (Optional — shown below Unit Snips)</label>' +
        '    <input id="cqUnitRemarks" type="text" placeholder="e.g. All kitchen base units include soft-close channels &amp; skirting" style="width:100%;padding:7px 10px;border:1px solid #CBD5E1;border-radius:6px;font-size:12.5px;">' +
        '  </div>' +

        '  <div style="background:#FFF7ED;border:1px solid #FDBA74;border-radius:8px;padding:12px;margin-bottom:14px;">' +
        '    <div style="font-size:12px;font-weight:700;color:#9A3412;margin-bottom:8px;">Client Portal Login &amp; Anti-Screenshot Protection</div>' +
        '    <div style="display:grid;grid-template-columns:1fr 1fr 145px;gap:10px;margin-bottom:10px;">' +
        '      <div>' +
        '        <label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:3px;">Client Username</label>' +
        '        <input id="cqUsername" type="text" value="' + esc(suggestedUser) + '" style="width:100%;padding:7px 9px;border:1px solid #CBD5E1;border-radius:6px;font-size:12.5px;">' +
        '      </div>' +
        '      <div>' +
        '        <label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:3px;">Client Password</label>' +
        '        <div style="display:flex;gap:4px;">' +
        '          <input id="cqPassword" type="text" value="' + esc(suggestedPass) + '" style="width:100%;padding:7px 9px;border:1px solid #CBD5E1;border-radius:6px;font-size:12.5px;font-family:monospace;font-weight:700;">' +
        '          <button type="button" id="cqRegenPassBtn" class="btn small" title="Generate new password" style="padding:0 9px;">🔄</button>' +
        '        </div>' +
        '      </div>' +
        '      <div>' +
        '        <label style="display:block;font-size:11px;font-weight:700;color:#475569;margin-bottom:3px;">Link Validity</label>' +
        '        <select id="cqExpiryDays" style="width:100%;padding:7px 8px;border:1px solid #CBD5E1;border-radius:6px;font-size:12.5px;">' +
        '          <option value="1">1 Day</option>' +
        '          <option value="7">7 Days</option>' +
        '          <option value="15" selected>15 Days</option>' +
        '          <option value="30">30 Days</option>' +
        '          <option value="365">1 Year</option>' +
        '          <option value="0">No Expiry</option>' +
        '        </select>' +
        '      </div>' +
        '    </div>' +
        '    <div style="display:flex;flex-wrap:wrap;gap:16px;font-size:12px;color:#1E293B;">' +
        '      <label style="display:flex;align-items:center;gap:5px;cursor:pointer;"><input type="checkbox" id="cqSecBlur" checked> Strict Anti-Screenshot Blackout Shield (Phone / Tablet / Laptop / PC)</label>' +
        '    </div>' +
        '  </div>' +

        '  <div id="cqErrorBox" style="display:none;background:#FEF2F2;border:1px solid #FCA5A5;color:#B91C1C;padding:8px 12px;border-radius:6px;font-size:12.5px;margin-bottom:10px;"></div>' +

        '  <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px;">' +
        '    <button type="button" id="cqCreateLinkBtn" class="btn" style="flex:1;background:#C00000;color:#fff;border-color:#900000;font-weight:700;padding:10px 16px;">🔐 Generate Protected Client Quote Link</button>' +
        '    <button type="button" id="cqDownloadPptxBtn" class="btn" style="background:#08231B;color:#fff;border-color:#08231B;font-weight:600;padding:10px 14px;">📊 Download Master PPTX (Team Copy)</button>' +
        '  </div>' +
        '</div>' +

        '<div id="cqResultCard" style="display:none;background:#F0FDF4;border:1px solid #86EFAC;border-radius:10px;padding:14px;margin-bottom:16px;"></div>' +

        '<div style="border-top:1px solid #E2E8F0;padding-top:12px;">' +
        '  <div style="font-size:12.5px;font-weight:700;color:#0F172A;margin-bottom:8px;">Existing Client Quote Links for This Project</div>' +
        '  <div id="cqExistingList" style="font-size:12.5px;color:#64748B;">Loading saved quote links...</div>' +
        '</div>';

      modal.classList.add('is-open');

      body.querySelector('#cqRegenPassBtn').addEventListener('click', function () {
        body.querySelector('#cqPassword').value = randomPassword();
      });

      async function gatherPayload() {
        var selectedTiers = [];
        body.querySelectorAll('.cq-tier-chk:checked').forEach(function (chk) {
          selectedTiers.push(chk.value);
        });
        if (!selectedTiers.length) throw new Error('Select at least one Master Template variant.');

        var cName = body.querySelector('#cqClientName').value.trim();
        var cPhone = body.querySelector('#cqClientPhone').value.trim();
        var cLoc = body.querySelector('#cqSiteAddress').value.trim();
        var qCode = body.querySelector('#cqQuoteCode').value.trim();
        var cUser = body.querySelector('#cqUsername').value.trim();
        var cPass = body.querySelector('#cqPassword').value.trim();
        var remarks = body.querySelector('#cqUnitRemarks').value.trim();

        if (!cName) throw new Error('Patron Name is required.');

        proj.meta = proj.meta || {};
        proj.meta.clientName = cName;
        proj.meta.phone = cPhone;
        proj.meta.siteAddress = cLoc;
        proj.meta.cpCode = qCode;
        if (typeof app.saveToLocalStorage === 'function') app.saveToLocalStorage();

        // Build base quote once to rasterize unique unit preview icons for Unit Snips
        var baseQuote = Core.generateFullQuotation(proj, app.selectedBOQRooms || ['all']);
        var iconData = await buildUnitIconsMap(app, baseQuote.furnitureItems || []);

        var variantQuotes = selectedTiers.map(function (tk) {
          return buildVariantQuotePayload(app, tk, iconData.keyByItemKey, remarks);
        });

        return {
          projectId: getActiveProjectId(app),
          title: (proj.meta.title || 'Modular Interior Proposal') + ' — ' + cName,
          quoteCode: qCode,
          clientName: cName,
          clientPhone: cPhone,
          clientEmail: meta.email || '',
          siteAddress: cLoc,
          clientUsername: cUser,
          clientPassword: cPass,
          expiryDays: Number(body.querySelector('#cqExpiryDays').value),
          securitySettings: {
            watermarkEnabled: false,
            blurShieldEnabled: body.querySelector('#cqSecBlur').checked
          },
          quoteSnapshot: {
            meta: {
              title: proj.meta.title || 'Modular Interior Proposal',
              clientName: cName,
              phone: cPhone,
              email: meta.email || '',
              siteAddress: cLoc,
              quoteId: qCode,
              designerName: designerName,
              dateCreated: meta.dateCreated || new Date().toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
            },
            designer: {
              name: designerName,
              phone: designerPhone,
              email: designerEmail
            },
            variantQuotes: variantQuotes,
            unitIcons: iconData.icons
          }
        };
      }

      var errBox = body.querySelector('#cqErrorBox');
      function showErr(msg) {
        errBox.textContent = msg || '';
        errBox.style.display = msg ? 'block' : 'none';
      }

      body.querySelector('#cqCreateLinkBtn').addEventListener('click', async function () {
        showErr('');
        var btn = this;
        btn.disabled = true;
        btn.textContent = '⏳ Creating Protected Quote...';
        try {
          var payload = await gatherPayload();
          var plainPass = payload.clientPassword;
          var res = await fetch('/api/client-quotes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(payload)
          });
          var data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || 'Failed to generate client quote');

          var resCard = body.querySelector('#cqResultCard');
          var inviteMsg =
            'Cookscape Interior Quotation — ' + payload.clientName + '\n' +
            'Quote Link: ' + data.shareUrl + '\n' +
            'Username: ' + data.quote.clientUsername + '\n' +
            'Password: ' + plainPass + '\n' +
            '(Protected view: login required, watermarked to your account)';

          resCard.style.display = 'block';
          resCard.innerHTML =
            '<div style="font-size:13.5px;font-weight:700;color:#166534;margin-bottom:8px;">✓ Protected Client Quote Link Ready</div>' +
            '<div style="font-size:12px;background:#fff;border:1px solid #BBF7D0;border-radius:6px;padding:8px 10px;margin-bottom:8px;word-break:break-all;">' +
            '  <div><b>Share Link:</b> <a href="' + esc(data.sharePath) + '" target="_blank" style="color:#1D4ED8;">' + esc(data.shareUrl) + '</a></div>' +
            '  <div style="margin-top:4px;"><b>Username:</b> <code style="background:#F1F5F9;padding:1px 5px;border-radius:4px;">' + esc(data.quote.clientUsername) + '</code> &nbsp; <b>Password:</b> <code style="background:#F1F5F9;padding:1px 5px;border-radius:4px;">' + esc(plainPass) + '</code></div>' +
            '</div>' +
            '<div style="display:flex;gap:8px;flex-wrap:wrap;">' +
            '  <button type="button" id="cqCopyUrlBtn" class="btn small">📋 Copy Link</button>' +
            '  <button type="button" id="cqCopyInviteBtn" class="btn small" style="background:#166534;color:#fff;border-color:#166534;">💬 Copy Client Invite (Link + Login)</button>' +
            '</div>';

          resCard.querySelector('#cqCopyUrlBtn').addEventListener('click', function () {
            copyText(data.shareUrl, this, '✓ Link Copied');
          });
          resCard.querySelector('#cqCopyInviteBtn').addEventListener('click', function () {
            copyText(inviteMsg, this, '✓ Invite Copied');
          });

          self.loadExistingList(body, getActiveProjectId(app));
        } catch (err) {
          showErr(err.message || String(err));
        } finally {
          btn.disabled = false;
          btn.textContent = '🔐 Generate Protected Client Quote Link';
        }
      });

      body.querySelector('#cqDownloadPptxBtn').addEventListener('click', async function () {
        showErr('');
        var btn = this;
        btn.disabled = true;
        btn.textContent = '⏳ Building PPTX Deck...';
        try {
          var payload = await gatherPayload();
          var pptxBody = {
            clientName: payload.clientName,
            clientPhone: payload.clientPhone,
            siteAddress: payload.siteAddress,
            quoteCode: payload.quoteCode,
            meta: payload.quoteSnapshot.meta,
            designer: payload.quoteSnapshot.designer,
            variantQuotes: payload.quoteSnapshot.variantQuotes,
            unitIcons: payload.quoteSnapshot.unitIcons
          };
          var res = await fetch('/api/client-quotes/export-pptx', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'same-origin',
            body: JSON.stringify(pptxBody)
          });
          if (!res.ok) {
            var errJson = await res.json().catch(function () { return {}; });
            throw new Error(errJson.error || 'PPTX generation failed');
          }
          var blob = await res.blob();
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = (payload.clientName.replace(/[^a-zA-Z0-9_-]/g, '_') || 'Cookscape') + '_Quotation.pptx';
          document.body.appendChild(a);
          a.click();
          setTimeout(function () {
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
          }, 800);
        } catch (err) {
          showErr(err.message || String(err));
        } finally {
          btn.disabled = false;
          btn.textContent = '📊 Download Master PPTX (Team Copy)';
        }
      });

      this.loadExistingList(body, getActiveProjectId(app));
    },

    loadExistingList: async function (body, projectId) {
      var listEl = body.querySelector('#cqExistingList');
      if (!listEl) return;
      try {
        var res = await fetch('/api/client-quotes/project/' + encodeURIComponent(projectId), {
          credentials: 'same-origin',
          cache: 'no-store'
        });
        var data = await res.json();
        if (!res.ok || !data.success) throw new Error(data.error || 'Could not load links');
        var quotes = data.quotes || [];
        if (!quotes.length) {
          listEl.innerHTML = '<div style="padding:8px 0;color:#64748B;">No client quote links created for this project yet.</div>';
          return;
        }
        listEl.innerHTML = quotes.map(function (q) {
          var isExpired = q.expiresAt && new Date(q.expiresAt).getTime() < Date.now();
          var badgeColor = q.isRevoked ? '#DC2626' : (isExpired ? '#D97706' : '#16A34A');
          var badgeLabel = q.isRevoked ? 'Revoked' : (isExpired ? 'Expired' : 'Active');
          var variantsStr = (q.selectedTiers || []).join(', ');
          var alertsCount = (q.accessLogs || []).filter(function (l) {
            return l.event === 'focus_blur' || l.event === 'screenshot_key_attempt' || l.event === 'print_attempt';
          }).length;

          return '<div style="border:1px solid #E2E8F0;border-radius:8px;padding:10px 12px;margin-bottom:8px;background:#F8FAFC;">' +
            '<div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap;">' +
            '  <div>' +
            '    <span style="display:inline-block;padding:2px 7px;border-radius:999px;font-size:10.5px;font-weight:700;color:#fff;background:' + badgeColor + ';">' + badgeLabel + '</span> ' +
            '    <b>' + esc(q.clientName) + '</b> · User: <code>' + esc(q.clientUsername) + '</code>' +
            '  </div>' +
            '  <div style="font-size:11.5px;color:#475569;">Views: <b>' + q.viewCount + '</b>' + (alertsCount ? (' · <span style="color:#B45309;">Shield Events: ' + alertsCount + '</span>') : '') + '</div>' +
            '</div>' +
            '<div style="font-size:11.5px;color:#64748B;margin-top:4px;">Variants: ' + esc(variantsStr || '-') + (q.expiresAt ? (' · Expires: ' + new Date(q.expiresAt).toLocaleDateString('en-IN')) : ' · No Expiry') + (q.lastViewedAt ? (' · Last opened: ' + new Date(q.lastViewedAt).toLocaleString('en-IN')) : '') + '</div>' +
            '<div style="display:flex;gap:6px;margin-top:8px;flex-wrap:wrap;">' +
            '  <button type="button" class="btn small cq-act-copy" data-url="' + esc(q.shareUrl) + '">📋 Copy Link</button>' +
            '  <button type="button" class="btn small cq-act-pass" data-id="' + esc(q.id) + '" data-user="' + esc(q.clientUsername) + '">🔑 Reset Password</button>' +
            '  <button type="button" class="btn small cq-act-toggle" data-id="' + esc(q.id) + '" data-revoked="' + (q.isRevoked ? '1' : '0') + '">' + (q.isRevoked ? '✅ Reactivate' : '⛔ Revoke') + '</button>' +
            '  <button type="button" class="btn small cq-act-del" data-id="' + esc(q.id) + '" style="color:#B91C1C;border-color:#FECACA;">🗑 Delete</button>' +
            '</div>' +
            '</div>';
        }).join('');

        listEl.querySelectorAll('.cq-act-copy').forEach(function (b) {
          b.addEventListener('click', function () { copyText(this.getAttribute('data-url'), this, '✓ Copied'); });
        });
        listEl.querySelectorAll('.cq-act-toggle').forEach(function (b) {
          b.addEventListener('click', async function () {
            var qId = this.getAttribute('data-id');
            var curRev = this.getAttribute('data-revoked') === '1';
            await fetch('/api/client-quotes/' + encodeURIComponent(qId), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ isRevoked: !curRev })
            });
            OrbixClientQuote.loadExistingList(body, projectId);
          });
        });
        listEl.querySelectorAll('.cq-act-pass').forEach(function (b) {
          b.addEventListener('click', async function () {
            var newPw = randomPassword();
            var qId = this.getAttribute('data-id');
            var cUser = this.getAttribute('data-user');
            var r = await fetch('/api/client-quotes/' + encodeURIComponent(qId), {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'same-origin',
              body: JSON.stringify({ clientPassword: newPw })
            });
            if (r.ok) {
              var resCard = body.querySelector('#cqResultCard');
              if (resCard) {
                resCard.style.display = 'block';
                resCard.innerHTML = '<b>🔑 Password Updated for <code>' + esc(cUser) + '</code>:</b> New Password = <code>' + esc(newPw) + '</code>';
              }
            }
          });
        });
        listEl.querySelectorAll('.cq-act-del').forEach(function (b) {
          b.addEventListener('click', async function () {
            if (!confirm('Delete this client quote link permanently?')) return;
            var qId = this.getAttribute('data-id');
            await fetch('/api/client-quotes/' + encodeURIComponent(qId), {
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
