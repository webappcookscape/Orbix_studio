// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Quote Deck Builder (Strict Master-Template.pptx Flow)
// Slide 1 Cover -> Intro (2-6) -> Per Selected Variant: [Divider, Specs, Unit Snips, Quotation] -> Process/Terms/FAQs (22-28) -> Closing (29)
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'quote-assets');
const TEMPLATE_DATA_PATH = path.join(ASSETS_DIR, 'template-data.json');
const ADDONS_BRANDS_PATH = path.join(ASSETS_DIR, 'addons-brands.json');

let cachedTemplateData = null;
let cachedAddonsBrands = null;

function loadAddonsBrands() {
  if (cachedAddonsBrands) return cachedAddonsBrands;
  try {
    if (fs.existsSync(ADDONS_BRANDS_PATH)) {
      cachedAddonsBrands = JSON.parse(fs.readFileSync(ADDONS_BRANDS_PATH, 'utf8'));
      return cachedAddonsBrands;
    }
  } catch (_) {}
  cachedAddonsBrands = { byId: {}, byName: {} };
  return cachedAddonsBrands;
}

function resolveAddonBrand(item) {
  if (!item || typeof item !== 'object') return '-';
  if (item.brand && String(item.brand).trim()) return String(item.brand).trim();
  const db = loadAddonsBrands();
  const idKey = String(item.id || '').trim().toLowerCase();
  const nameKey = String(item.name || '').trim().toLowerCase();
  const rec = (idKey && db.byId && db.byId[idKey]) || (nameKey && db.byName && db.byName[nameKey]) || null;
  if (!rec) return '-';
  const r = Number((item.customRate !== undefined && item.customRate !== null && item.customRate !== '') ? item.customRate : (item.rate || 0));
  if (rec.brand && rec.rate && Math.abs(r - rec.rate) < 0.05) return rec.brand;
  if (rec.hettichRate && Math.abs(r - rec.hettichRate) < 0.05) return 'HETTICH';
  if (rec.ebcoRate && Math.abs(r - rec.ebcoRate) < 0.05) return 'EBCO';
  if (rec.grassRate && Math.abs(r - rec.grassRate) < 0.05) return 'GRASS';
  return rec.brand || '-';
}

function enrichCommercialAddons(comm) {
  if (!comm || typeof comm !== 'object') return {};
  const out = Object.assign({}, comm);
  if (Array.isArray(out.selectedAddons)) {
    out.selectedAddons = out.selectedAddons.map((it) => {
      if (!it || typeof it !== 'object') return it;
      return Object.assign({}, it, { brand: resolveAddonBrand(it) });
    });
  }
  return out;
}

function loadTemplateData() {
  if (cachedTemplateData) return cachedTemplateData;
  if (!fs.existsSync(TEMPLATE_DATA_PATH)) {
    throw new Error('Quote template assets not extracted yet. Run scripts/extract_quote_template.py');
  }
  cachedTemplateData = JSON.parse(fs.readFileSync(TEMPLATE_DATA_PATH, 'utf8'));
  return cachedTemplateData;
}

function resolveTemplateAssetPath(assetFileName) {
  if (!assetFileName || typeof assetFileName !== 'string') return null;
  const cleanName = path.basename(assetFileName).replace(/[^a-zA-Z0-9._-]/g, '');
  if (!cleanName || cleanName !== assetFileName) return null;
  const fullPath = path.join(ASSETS_DIR, cleanName);
  if (!fullPath.startsWith(ASSETS_DIR) || !fs.existsSync(fullPath)) return null;
  return fullPath;
}

function normalizeTemplateVariantKey(raw) {
  const s = String(raw || '').trim().toLowerCase();
  if (s === 'custom' || s === 'custom variant' || s === 'custom (room-wise)') return 'custom';
  if (s === 'zappo - el pearl' || s === 'zappo-el pearl' || s === 'zappo-el-pearl' || s === 'zappo el pearl' || s === 'zappo' || s === 'p1' || s === 'price 1' || s === 'price1') return 'zappo - el pearl';
  if (s === 'pot&cafe' || s === 'pot & cafe' || s === 'pot and cafe' || s === 'pot cafe' || s === 'p2' || s === 'price 2' || s === 'price2') return 'pot&cafe';
  if (s === 'homespace' || s === 'home space' || s === 'home-space' || s === 'p3' || s === 'price 3' || s === 'price3') return 'homespace';
  if (s === 'cafehunt' || s === 'cafe hunt' || s === 'café hunt' || s === 'cafe-hunt' || s === 'livlame' || s === 'p4' || s === 'price 4' || s === 'price4') return 'cafehunt';
  if (s === 'll elite' || s === 'llelite' || s === 'livelane' || s === 'live lane') return 'LL elite';
  if (s === 'cc matte' || s === 'ccmatte' || s === 'capricoast matte') return 'CC MATTE';
  if (s === 'cc glossy' || s === 'ccglossy' || s === 'capricost glossy' || s === 'capricoast glossy' || s === 'capricost') return 'CC GLOSSY';
  if (s === 'surabhi' || s === 'elegant surabhi') return 'SURABHI';
  if (s === 'mr+' || s === 'mr plus' || s === '4x tuff gloss' || s === '4x tg' || s === '4xtg' || s === 'tuff gloss') return 'MR+';
  return null;
}

function getRoomSummaryRank(name) {
  const s = String(name || '').toLowerCase().trim();
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

function normalizeRoomsSummary(rooms) {
  if (!Array.isArray(rooms)) return [];
  return rooms
    .map((r, idx) => ({ r, idx }))
    .filter(({ r }) => r && Number(r.itemCount || 0) > 0)
    .sort((a, b) => {
      const ra = getRoomSummaryRank(a.r.name);
      const rb = getRoomSummaryRank(b.r.name);
      if (ra !== rb) return ra - rb;
      return a.idx - b.idx;
    })
    .map(({ r }) => r);
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
}

// Dynamically resolve Material / Finish string for each unit from the selected variant's specification tables
function resolveVariantUnitFinish(tplVar, item) {
  if (item && String(item.refCode || '').toUpperCase() === 'CIV') {
    return item.finish || 'Included Civil Scope';
  }
  const tables = (tplVar && Array.isArray(tplVar.specTables)) ? tplVar.specTables : [];
  if (!tables.length) return (item && item.finish) || '-';

  const contextStr = `${(item && item.room) || ''} ${(item && item.name) || ''}`.toLowerCase();
  const isKitchen = /(kitchen|utility|pantry|crockery|hob|sink|tall\s*unit|base\s*unit|wall\s*unit|loft\s*kitchen)/i.test(contextStr);

  // Pick Kitchen table vs Wardrobe table when a variant defines separate spec tables (e.g. LL ELITE)
  let chosenTable = tables[0];
  if (tables.length > 1) {
    const kitchenTbl = tables.find((t) => t && t[0] && /kitchen/i.test(String(t[0][0] || '')));
    const wardTbl = tables.find((t) => t && t[0] && /wardrobe/i.test(String(t[0][0] || '')));
    chosenTable = isKitchen ? (kitchenTbl || tables[0]) : (wardTbl || tables[1] || tables[0]);
  }

  let carcass = '';
  let kitchenCarcass = '';
  let wardCarcass = '';
  let shutterMat = '';
  let shutterFinishes = [];
  let laminateBrand = '';

  for (let r = 1; r < chosenTable.length; r++) {
    const row = chosenTable[r];
    if (!Array.isArray(row) || row.length < 2) continue;
    const k = String(row[0] || '').trim().toLowerCase();
    const v = String(row[1] || '').trim();
    if (!v || v === '-') continue;
    if (k.includes('kitchen') && k.includes('carcass')) kitchenCarcass = kitchenCarcass || v;
    else if (k.includes('wardrobe') && k.includes('carcass')) wardCarcass = wardCarcass || v;
    else if (k === 'carcass material' || k.includes('carcass')) carcass = carcass || v;
    else if (k === 'shutter material') shutterMat = shutterMat || v;
    else if (k === 'shutter finish') shutterFinishes.push(v);
    else if (k.includes('laminate') && k.includes('brand')) laminateBrand = laminateBrand || v;
  }

  const resolvedCarcass = isKitchen
    ? (kitchenCarcass || carcass || wardCarcass)
    : (wardCarcass || carcass || kitchenCarcass);
  const resolvedFinish = shutterFinishes.length > 1
    ? (isKitchen ? shutterFinishes[0] : shutterFinishes[1])
    : (shutterFinishes[0] || '');

  const parts = [];
  if (resolvedCarcass) parts.push('Carcass: ' + resolvedCarcass);
  const shutterBits = [];
  if (shutterMat) shutterBits.push(shutterMat);
  if (resolvedFinish && resolvedFinish.toLowerCase() !== shutterMat.toLowerCase()) shutterBits.push(resolvedFinish);
  if (!shutterBits.length && laminateBrand) shutterBits.push(laminateBrand);
  if (shutterBits.length) parts.push('Shutter: ' + shutterBits.join(' / '));

  const joined = parts.join(' | ').replace(/\s+/g, ' ').trim();
  return joined || (item && item.finish) || '-';
}

function buildClientQuoteDeck(quoteRecord) {
  const tpl = loadTemplateData();
  const snap = quoteRecord.quoteSnapshot || {};
  const meta = snap.meta || {};
  const designer = snap.designer || {};
  const variantQuotes = Array.isArray(snap.variantQuotes) ? snap.variantQuotes : [];

  const clientName = quoteRecord.clientName || meta.clientName || 'Valued Client';
  const clientPhone = quoteRecord.clientPhone || meta.phone || '';
  const siteAddress = quoteRecord.siteAddress || meta.siteAddress || '';
  const footerText = [clientName, siteAddress, clientPhone].filter(Boolean).join(' | ');
  const sec = (quoteRecord && quoteRecord.securitySettings) || {};
  let linkGeneratedAt = sec.clientLinkGeneratedAt || null;
  if (!linkGeneratedAt && Array.isArray(quoteRecord && quoteRecord.accessLogs)) {
    for (let i = quoteRecord.accessLogs.length - 1; i >= 0; i--) {
      const ev = quoteRecord.accessLogs[i];
      if (ev && ev.event === 'client_link_activated' && ev.at) {
        linkGeneratedAt = ev.at;
        break;
      }
    }
  }
  const effectiveLinkTs = linkGeneratedAt || quoteRecord.createdAt || null;
  let issueDate = '';
  if (effectiveLinkTs) {
    const parsedTs = new Date(effectiveLinkTs);
    if (!Number.isNaN(parsedTs.getTime())) {
      try {
        issueDate = parsedTs.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });
      } catch (_) {
        const dd = String(parsedTs.getDate()).padStart(2, '0');
        const mm = String(parsedTs.getMonth() + 1).padStart(2, '0');
        issueDate = `${dd}/${mm}/${parsedTs.getFullYear()}`;
      }
    }
  }
  if (!issueDate) {
    issueDate = meta.dateCreated || new Date().toLocaleDateString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }

  const variantMap = {};
  const templateOrder = [];
  for (const v of (tpl.variants || [])) {
    variantMap[v.key] = v;
    templateOrder.push(v.key);
  }

  // Keep selected variants in exact Master-Template.pptx order
  const selectedByKey = {};
  for (const vq of variantQuotes) {
    const tk = normalizeTemplateVariantKey(vq.tierKey || vq.tierName || vq.tierTitle);
    if (tk && !selectedByKey[tk]) selectedByKey[tk] = vq;
  }

  if (selectedByKey['custom']) {
    const customVq = selectedByKey['custom'];
    const customTpl = {
      key: 'custom',
      title: 'CUSTOM VARIANT (Room-Wise)',
      shortTitle: 'Custom Variant',
      dividerAsset: (tpl.assets && tpl.assets.customDividerAsset) || 'slide_22.jpg',
      specTables: [
        {
          title: 'Room-Wise Custom Finishes',
          rows: (customVq.roomBreakdown || customVq.roomsSummary || []).map((rm) => [
            rm.name || 'Room',
            rm.variantLabel || rm.variant || 'Custom Finish',
            `${rm.itemCount || 0} Units`,
            `₹ ${(rm.roomSubtotal || 0).toLocaleString('en-IN')}`
          ])
        }
      ]
    };
    variantMap['custom'] = customTpl;
    templateOrder.push('custom');
  }

  const orderedVariants = templateOrder.filter((k) => Boolean(selectedByKey[k])).map((k) => ({
    tplVar: variantMap[k],
    vq: selectedByKey[k]
  }));

  const logoAsset = (tpl.assets && tpl.assets.masterLogo) || 'master_logo.jpg';
  const logoRect = (tpl.assets && tpl.assets.masterLogoRect) || { x: 658.6, y: 29.0, w: 368.6, h: 69.1 };
  const slides = [];

  // 1. Exact Master-Template Cover Slide (Slide 1)
  slides.push({
    id: 'cover',
    type: 'cover',
    section: 'Cover',
    title: 'Cover Page',
    coverBgAsset: (tpl.assets && tpl.assets.coverBg) || 'slide_01_bg.jpg',
    coverLayout: (tpl.assets && tpl.assets.coverLayout) || null,
    footer: '',
    coverData: {
      quoteCode: quoteRecord.quoteCode || meta.quoteId || '',
      patron: {
        name: clientName,
        phone: clientPhone || '-',
        location: siteAddress || '-',
        date: issueDate
      },
      designer: {
        name: designer.name || meta.designerName || 'Cookscape Design Team',
        phone: designer.phone || meta.designerPhone || '-',
        email: designer.email || 'designs.cookscape@gmail.com'
      }
    }
  });

  // 2. Exact Master-Template Introduction Pages (Slides 2 - 6, always included unchanged)
  const introSlides = (tpl.assets && tpl.assets.introSlides) || [];
  for (const intro of introSlides) {
    slides.push({
      id: intro.id,
      type: 'image_slide',
      section: 'Introduction',
      title: intro.title,
      asset: intro.asset,
      showFooter: intro.id === 'intro_2',
      footer: footerText
    });
  }

  // 3. Selected Master-Template Variant Sections (Divider -> Specs -> Unit Snips -> Quotation)
  orderedVariants.forEach(({ tplVar, vq }, idx) => {
    const displayTitle = tplVar.title;
    const sectionLabel = orderedVariants.length > 1 ? `Option ${idx + 1}: ${displayTitle}` : displayTitle;

    // 3a. Divider Slide (Slides 7 / 10 / 13 / 16 / 19)
    slides.push({
      id: `var_${idx}_divider`,
      type: 'image_slide',
      section: sectionLabel,
      title: `${displayTitle}`,
      asset: tplVar.dividerAsset,
      showFooter: true,
      footer: footerText
    });

    // 3b. Specification Slide (Slides 8 / 11 / 14 / 17 / 20)
    slides.push({
      id: `var_${idx}_specs`,
      type: 'specs_table',
      section: sectionLabel,
      title: displayTitle,
      variantTitle: displayTitle,
      logoAsset,
      logoRect,
      tables: tplVar.specTables || [],
      footer: footerText
    });

    // 3c. Unit Snips Slide(s) (Inserted right after Specification and before Quotation, matching quotegenerator)
    const rawItems = Array.isArray(vq.items) ? vq.items : [];
    const items = rawItems.map((it) => Object.assign({}, it, {
      finish: resolveVariantUnitFinish(tplVar, it)
    }));
    const unitPages = items.length ? chunkArray(items, 9) : [[]];
    unitPages.forEach((pageItems, pIdx) => {
      slides.push({
        id: `var_${idx}_units_${pIdx}`,
        type: 'unit_snips',
        section: sectionLabel,
        title: unitPages.length > 1 ? `Unit Breakdown (${pIdx + 1}/${unitPages.length})` : 'Unit Breakdown',
        variantTitle: displayTitle,
        pageIndex: pIdx + 1,
        totalPages: unitPages.length,
        logoAsset,
        logoRect,
        startNo: pIdx * 9 + 1,
        items: pageItems,
        woodworkSubtotal: vq.commercial ? vq.commercial.woodworkSubtotal : 0,
        notes: pIdx === unitPages.length - 1 ? (vq.notes || '') : '',
        footer: footerText
      });
    });

    // 3d. Quotation Slide (Slides 9 / 12 / 15 / 18 / 21 — Commercial Summary / Quotation Snip)
    slides.push({
      id: `var_${idx}_quotation`,
      type: 'quotation_summary',
      section: sectionLabel,
      title: `${displayTitle} Quotation`,
      variantTitle: displayTitle,
      logoAsset,
      logoRect,
      quoteCode: quoteRecord.quoteCode || meta.quoteId || '',
      roomScopeLabel: vq.roomScopeLabel || 'All Rooms (Entire Home)',
      currencySymbol: vq.currencySymbol || '₹',
      roomsSummary: normalizeRoomsSummary(vq.roomsSummary),
      commercial: enrichCommercialAddons(vq.commercial || {}),
      footer: footerText
    });
  });

  // 4. Exact Master-Template Process, Policies, Payment Terms, T&C & FAQs (Slides 22 - 28, always included)
  if (tpl.processSlides) {
    const ps = tpl.processSlides;
    if (ps.designProcess) {
      slides.push({
        id: 'process_design',
        type: 'process_slide',
        section: 'Process & Terms',
        title: ps.designProcess.title,
        logoAsset,
        logoRect,
        paragraphs: ps.designProcess.paragraphs || [],
        table: ps.designProcess.table || [],
        footer: footerText
      });
    }
    if (ps.executionProcess) {
      slides.push({
        id: 'process_execution',
        type: 'process_slide',
        section: 'Process & Terms',
        title: ps.executionProcess.title,
        logoAsset,
        logoRect,
        paragraphs: ps.executionProcess.paragraphs || [],
        table: ps.executionProcess.table || [],
        footer: footerText
      });
    }
    if (ps.inclusionsExclusions) {
      slides.push({
        id: 'policy_inclusions',
        type: 'table_slide',
        section: 'Process & Terms',
        title: ps.inclusionsExclusions.title,
        logoAsset,
        logoRect,
        table: ps.inclusionsExclusions.table || [],
        footer: footerText
      });
    }
    if (ps.paymentTerms) {
      slides.push({
        id: 'policy_payment',
        type: 'table_slide',
        section: 'Process & Terms',
        title: ps.paymentTerms.title,
        logoAsset,
        logoRect,
        table: ps.paymentTerms.table || [],
        footer: footerText
      });
    }
    if (ps.termsConditions && ps.termsConditions.paragraphs) {
      slides.push({
        id: 'policy_terms',
        type: 'prose_slide',
        section: 'Process & Terms',
        title: ps.termsConditions.title,
        logoAsset,
        logoRect,
        paragraphs: ps.termsConditions.paragraphs,
        footer: footerText
      });
    }
    if (ps.faqs && ps.faqs.paragraphs) {
      const faqPages = chunkArray(ps.faqs.paragraphs, 16);
      faqPages.forEach((fp, fIdx) => {
        slides.push({
          id: `policy_faq_${fIdx}`,
          type: 'prose_slide',
          section: 'Process & Terms',
          title: faqPages.length > 1 ? `${ps.faqs.title} (Part ${fIdx + 1})` : ps.faqs.title,
          logoAsset,
          logoRect,
          paragraphs: fp,
          footer: footerText
        });
      });
    }
  }

  // 5. Exact Master-Template Closing Slide (Slide 41)
  slides.push({
    id: 'closing',
    type: 'image_slide',
    section: 'Thank You',
    title: 'Thank You',
    asset: (tpl.assets && tpl.assets.closingAsset) || 'slide_41.jpg',
    showFooter: true,
    footer: footerText
  });

  const totalSlides = slides.length;
  slides.forEach((s, i) => {
    s.slideNumber = i + 1;
    s.totalSlides = totalSlides;
  });

  return slides;
}

module.exports = {
  loadTemplateData,
  resolveTemplateAssetPath,
  normalizeTemplateVariantKey,
  normalizeRoomsSummary,
  buildClientQuoteDeck
};
