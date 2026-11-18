// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Quote Deck Builder (Strict Master-Template.pptx Flow)
// Slide 1 Cover -> Intro (2-6) -> Per Selected Variant: [Divider, Specs, Unit Snips, Quotation] -> Process/Terms/FAQs (22-28) -> Closing (29)
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');

const ASSETS_DIR = path.join(__dirname, '..', 'quote-assets');
const TEMPLATE_DATA_PATH = path.join(ASSETS_DIR, 'template-data.json');

let cachedTemplateData = null;

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
  if (s === 'll elite' || s === 'llelite' || s === 'livelane' || s === 'live lane') return 'LL elite';
  if (s === 'cc matte' || s === 'ccmatte' || s === 'capricoast matte') return 'CC MATTE';
  if (s === 'cc glossy' || s === 'ccglossy' || s === 'capricost glossy' || s === 'capricoast glossy' || s === 'capricost') return 'CC GLOSSY';
  if (s === 'surabhi' || s === 'elegant surabhi') return 'SURABHI';
  if (s === 'mr+' || s === 'mr plus' || s === '4x tuff gloss' || s === '4x tg' || s === '4xtg' || s === 'tuff gloss') return 'MR+';
  return null;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) {
    out.push(arr.slice(i, i + size));
  }
  return out;
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
  const issueDate = meta.dateCreated || new Date(quoteRecord.createdAt || Date.now()).toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

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
        phone: designer.phone || '93611 84787',
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
    const items = Array.isArray(vq.items) ? vq.items : [];
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
      roomsSummary: vq.roomsSummary || [],
      commercial: vq.commercial || {},
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

  // 5. Exact Master-Template Closing Slide (Slide 29)
  slides.push({
    id: 'closing',
    type: 'image_slide',
    section: 'Thank You',
    title: 'Thank You',
    asset: (tpl.assets && tpl.assets.closingAsset) || 'slide_29.jpg',
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
  buildClientQuoteDeck
};
