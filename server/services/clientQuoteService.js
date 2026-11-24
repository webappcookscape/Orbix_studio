// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Protected Client Quote & Head Approval Service (PostgreSQL + JSON)
// Flow:
//   Stage 1: Employee generates password-free Head Review Link (/quote-review/:reviewToken)
//            showing each selected variant's Quotation page with editable Discounts/ADP.
//   Stage 2: Head edits discounts & clicks Approve -> syncs approved totals back to app.
//   Stage 3: Employee generates full password-protected Client Link (/quote/:shareToken)
//            (default username = Client Name) + downloads Full Master PPTX & Full PDF.
//   Stage 4: When client logs in to /quote/:shareToken, triggers WhatsApp alert to
//            the project's respective Business Head (BH) and Employee (FA) numbers.
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prismaConfig = require('../config/prisma');
const userService = require('./userService');
const quoteDeckBuilder = require('./quoteDeckBuilder');
const whatsappAlertService = require('./whatsappAlertService');
const Core = require('../../orbix-core');

const ROOT_DIR = path.join(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STORE_PATH = path.join(DATA_DIR, 'client_quotes_store.json');

const MAX_ICON_BYTES = 200 * 1024; // 200 KB per unit elevation icon
const MAX_UNIT_ICONS = 80;
const MAX_AUDIT_LOGS = 80;

let pgTableReady = false;

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode || 400;
  return err;
}

function generateStaffViewKey() {
  return 'stf_' + crypto.randomBytes(12).toString('hex');
}

function ensureStaffViewKey(rec) {
  rec.securitySettings = rec.securitySettings || {};
  if (!rec.securitySettings.staffViewKey) {
    rec.securitySettings.staffViewKey = generateStaffViewKey();
  }
  return rec.securitySettings.staffViewKey;
}

function isValidStaffKey(rec, candidateKey) {
  const expected = rec && rec.securitySettings && rec.securitySettings.staffViewKey;
  if (!expected || !candidateKey || typeof candidateKey !== 'string') return false;
  const a = Buffer.from(String(expected));
  const b = Buffer.from(String(candidateKey).trim());
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(a, b);
  } catch (_) {
    return false;
  }
}

function maskIp(ip) {
  if (!ip) return '';
  const clean = String(ip).replace('::ffff:', '');
  const parts = clean.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  return clean.slice(0, 14);
}

function sanitizeUnitIconDataUrl(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const m = raw.match(/^data:image\/(png|jpeg|jpg|webp);base64,([A-Za-z0-9+/=\r\n]+)$/);
  if (!m) return null;
  const mime = m[1] === 'jpg' ? 'image/jpeg' : `image/${m[1]}`;
  const b64 = m[2].replace(/[\r\n]/g, '');
  const buf = Buffer.from(b64, 'base64');
  if (!buf.length || buf.length > MAX_ICON_BYTES) return null;
  return { mime, data: b64 };
}

function recalculateVariantCommercial(comm, overrides) {
  const c = comm || {};
  const o = (overrides && typeof overrides === 'object') ? overrides : {};
  const woodwork = Math.round(Number(c.woodworkSubtotal) || 0);
  const accessoriesEnabled = o.accessoriesEnabled !== undefined ? Boolean(o.accessoriesEnabled) : (c.accessoriesEnabled !== false);
  const appliancesEnabled = o.appliancesEnabled !== undefined ? Boolean(o.appliancesEnabled) : (c.appliancesEnabled !== false);
  const freightEnabled = o.freightEnabled !== undefined ? Boolean(o.freightEnabled) : (c.freightEnabled !== false);
  const gstEnabled = o.gstEnabled !== undefined ? Boolean(o.gstEnabled) : (c.gstEnabled !== false);

  const rawAcc = (o.additionalAccessories !== undefined && o.additionalAccessories !== null && o.additionalAccessories !== '')
    ? o.additionalAccessories
    : (c.baseAdditionalAccessories !== undefined ? c.baseAdditionalAccessories : c.additionalAccessories);
  const rawApp = (o.appliances !== undefined && o.appliances !== null && o.appliances !== '')
    ? o.appliances
    : (c.baseAppliances !== undefined ? c.baseAppliances : c.appliances);
  const baseAcc = Math.max(0, Math.round(Number(rawAcc) || 0));
  const baseApp = Math.max(0, Math.round(Number(rawApp) || 0));
  const acc = accessoriesEnabled ? baseAcc : 0;
  const appliances = appliancesEnabled ? baseApp : 0;
  const freightPercent = (c.freightPercent !== undefined && c.freightPercent !== null && c.freightPercent !== '') ? Number(c.freightPercent) : 2.5;
  const gstPercent = (c.gstPercent !== undefined && c.gstPercent !== null && c.gstPercent !== '') ? Number(c.gstPercent) : 18;

  // Elegant Surabhi Costing Benchmark & Slab Lookup
  const slabId = o.surabhiDesignSlab !== undefined ? o.surabhiDesignSlab : (c.surabhiDesignSlab || 'auto');
  const surabhiWoodwork = (o.surabhiWoodworkSubtotal !== undefined)
    ? Number(o.surabhiWoodworkSubtotal)
    : (c.surabhiWoodworkSubtotal !== undefined ? Number(c.surabhiWoodworkSubtotal) : woodwork);

  const activeSlab = (Core && Core.getSurabhiDesignFeeSlab)
    ? Core.getSurabhiDesignFeeSlab(surabhiWoodwork, slabId)
    : null;

  let designPercent = 9;
  let designAmount = 0;
  let adpP = 0;
  let adpAmount = 0;

  const adpOverride = o.adpPercent !== undefined ? o.adpPercent : c.adpPercent;
  const designOverride = o.designPercent !== undefined ? o.designPercent : c.designPercent;

  if (activeSlab && slabId !== 'custom' && designOverride === undefined && adpOverride === undefined) {
    designAmount = activeSlab.fullDesignCharges;
    adpP = activeSlab.discountPercent || 60;
    adpAmount = Math.round(designAmount * (adpP / 100));
    designPercent = woodwork > 0 ? (Math.round((designAmount / woodwork) * 1000) / 10) : 9;
  } else {
    const rawDesign = designOverride !== undefined ? designOverride : (activeSlab && slabId !== 'custom' ? (woodwork > 0 ? (Math.round((activeSlab.fullDesignCharges / woodwork) * 1000) / 10) : 9) : 9);
    designPercent = (rawDesign !== undefined && rawDesign !== null && rawDesign !== '') ? Math.max(0, Math.min(100, Number(rawDesign) || 0)) : 9;
    designAmount = (activeSlab && slabId !== 'custom' && designOverride === undefined) ? activeSlab.fullDesignCharges : Math.round(woodwork * (designPercent / 100));
    adpP = Math.max(0, Math.min(100, Number(adpOverride !== undefined ? adpOverride : (activeSlab && slabId !== 'custom' ? (activeSlab.discountPercent || 60) : 0)) || 0));
    adpAmount = Math.round(designAmount * (adpP / 100));
  }

  const freightAmount = freightEnabled ? Math.round(woodwork * (freightPercent / 100)) : 0;
  const originalBillableValue = Math.round(woodwork + designAmount + freightAmount);

  const discP = Math.max(0, Math.min(100, Number(o.discountPercent !== undefined ? o.discountPercent : c.discountPercent) || 0));
  const discountAmount = Math.round(woodwork * (discP / 100));
  const woodworkAfterDiscount = Math.max(0, woodwork - discountAmount);
  const designAfterDiscount = Math.max(0, designAmount - adpAmount);
  const totalSavings = discountAmount + adpAmount;
  const hasDiscount = totalSavings > 0;

  // Core Modular Proposal (Without Add-ons / Accessories & Appliances so they don't distort final discounted value)
  const coreNetBeforeTax = Math.max(0, Math.round(woodworkAfterDiscount + designAfterDiscount + freightAmount));
  const coreGstAmount = gstEnabled ? Math.round(coreNetBeforeTax * (gstPercent / 100)) : 0;
  const coreGrandTotal = coreNetBeforeTax + coreGstAmount;

  // Add-ons, Accessories & Appliances sit cleanly below savings without affecting the core proposal total
  const selectedAddons = Array.isArray(o.selectedAddons) ? o.selectedAddons : (Array.isArray(c.selectedAddons) ? c.selectedAddons : []);
  const appliancesList = Array.isArray(o.appliancesList) ? o.appliancesList : (Array.isArray(c.appliancesList) ? c.appliancesList : []);
  const addonsTotal = acc + appliances;
  const totalInvestmentWithAddons = coreGrandTotal + addonsTotal;

  // Set netBeforeTax and grandTotal to core proposal values (unaffected by add-ons)
  const netBeforeTax = coreNetBeforeTax;
  const gstAmount = coreGstAmount;
  const grandTotal = coreGrandTotal;

  return Object.assign({}, c, {
    surabhiDesignSlab: slabId,
    surabhiWoodworkSubtotal: Math.round(surabhiWoodwork),
    activeSlab,
    woodworkSubtotal: woodwork,
    baseAdditionalAccessories: baseAcc,
    baseAppliances: baseApp,
    accessoriesEnabled,
    additionalAccessories: acc,
    appliancesEnabled,
    appliances,
    selectedAddons,
    appliancesList,
    addonsTotal,
    totalInvestmentWithAddons,
    coreNetBeforeTax,
    coreGrandTotal,
    designPercent,
    designAmount,
    freightEnabled,
    freightPercent,
    freightAmount,
    originalBillableValue,
    discountPercent: discP,
    discountAmount,
    woodworkAfterDiscount,
    adpPercent: adpP,
    adpAmount,
    designAfterDiscount,
    totalSavings,
    hasDiscount,
    netBeforeTax,
    gstEnabled,
    gstPercent,
    gstAmount,
    grandTotal
  });
}

function getWorkflowMeta(rec) {
  const sec = (rec && rec.securitySettings) || {};
  const approvalStatus = sec.approvalStatus || 'approved';
  const clientLinkActivated = sec.clientLinkActivated !== undefined
    ? Boolean(sec.clientLinkActivated)
    : (approvalStatus === 'approved' && Boolean(rec && rec.passwordHash));
  return {
    reviewToken: sec.reviewToken || '',
    approvalStatus,
    approvedAt: sec.approvedAt || null,
    approvedBy: sec.approvedBy || '',
    approvalRemarks: sec.approvalRemarks || '',
    clientLinkActivated,
    lastWhatsappAlert: sec.lastWhatsappAlert || null
  };
}

function sanitizeRecordForManager(rec) {
  if (!rec) return null;
  const snap = rec.quoteSnapshot || {};
  const wf = getWorkflowMeta(rec);
  return {
    id: rec.id,
    projectId: rec.projectId,
    createdBy: rec.createdBy,
    shareToken: rec.shareToken,
    reviewToken: wf.reviewToken,
    approvalStatus: wf.approvalStatus,
    approvedAt: wf.approvedAt,
    approvedBy: wf.approvedBy,
    approvalRemarks: wf.approvalRemarks,
    clientLinkActivated: wf.clientLinkActivated,
    lastWhatsappAlert: wf.lastWhatsappAlert,
    title: rec.title,
    quoteCode: rec.quoteCode,
    clientName: rec.clientName,
    clientPhone: rec.clientPhone,
    clientEmail: rec.clientEmail,
    siteAddress: rec.siteAddress,
    clientUsername: rec.clientUsername,
    selectedTiers: rec.selectedTiers || [],
    securitySettings: rec.securitySettings || {},
    variantSummaries: (snap.variantQuotes || []).map((v) => ({
      tierKey: v.tierKey,
      tierTitle: v.tierTitle,
      discountPercent: Number(v.commercial?.discountPercent || 0),
      adpPercent: Number(v.commercial?.adpPercent || 0),
      grandTotal: Math.round(Number(v.commercial?.grandTotal ?? v.grandTotal ?? 0)),
      currencySymbol: v.currencySymbol || '₹'
    })),
    expiresAt: rec.expiresAt || null,
    isRevoked: !!rec.isRevoked,
    viewCount: Number(rec.viewCount || 0),
    lastViewedAt: rec.lastViewedAt || null,
    accessLogs: Array.isArray(rec.accessLogs) ? rec.accessLogs.slice(-15) : [],
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt
  };
}

function normalizeRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    projectId: row.project_id ?? row.projectId,
    createdBy: row.created_by ?? row.createdBy ?? null,
    shareToken: row.share_token ?? row.shareToken,
    title: row.title || 'Interior Quotation',
    quoteCode: row.quote_code ?? row.quoteCode ?? '',
    clientName: row.client_name ?? row.clientName ?? '',
    clientPhone: row.client_phone ?? row.clientPhone ?? '',
    clientEmail: row.client_email ?? row.clientEmail ?? '',
    siteAddress: row.site_address ?? row.siteAddress ?? '',
    clientUsername: row.client_username ?? row.clientUsername ?? '',
    passwordHash: row.password_hash ?? row.passwordHash ?? '',
    selectedTiers: typeof row.selected_tiers === 'string' ? JSON.parse(row.selected_tiers) : (row.selected_tiers ?? row.selectedTiers ?? []),
    quoteSnapshot: typeof row.quote_snapshot === 'string' ? JSON.parse(row.quote_snapshot) : (row.quote_snapshot ?? row.quoteSnapshot ?? {}),
    securitySettings: typeof row.security_settings === 'string' ? JSON.parse(row.security_settings) : (row.security_settings ?? row.securitySettings ?? {}),
    expiresAt: row.expires_at ?? row.expiresAt ?? null,
    isRevoked: Boolean(row.is_revoked ?? row.isRevoked ?? false),
    viewCount: Number(row.view_count ?? row.viewCount ?? 0),
    lastViewedAt: row.last_viewed_at ?? row.lastViewedAt ?? null,
    accessLogs: typeof row.access_logs === 'string' ? JSON.parse(row.access_logs) : (row.access_logs ?? row.accessLogs ?? []),
    createdAt: row.created_at ?? row.createdAt,
    updatedAt: row.updated_at ?? row.updatedAt
  };
}

function readLocalStore() {
  try {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(STORE_PATH)) return [];
    const parsed = JSON.parse(fs.readFileSync(STORE_PATH, 'utf8'));
    return Array.isArray(parsed) ? parsed.map(normalizeRow) : [];
  } catch (_) {
    return [];
  }
}

function writeLocalStore(records) {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  const eol = process.platform === 'win32' ? '\r\n' : '\n';
  const serialized = JSON.stringify(records, null, 2).replace(/\r\n/g, '\n').replace(/\n/g, eol);
  fs.writeFileSync(STORE_PATH, serialized, 'utf8');
}

async function ensurePgTable() {
  if (!prismaConfig.isConnected || pgTableReady) return prismaConfig.isConnected;
  try {
    await prismaConfig.prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS client_quotes (
        id VARCHAR(64) PRIMARY KEY,
        project_id VARCHAR(64) NOT NULL,
        created_by VARCHAR(64),
        share_token VARCHAR(128) UNIQUE NOT NULL,
        title VARCHAR(256) NOT NULL,
        quote_code VARCHAR(64) DEFAULT '',
        client_name VARCHAR(256) NOT NULL,
        client_phone VARCHAR(64) DEFAULT '',
        client_email VARCHAR(128) DEFAULT '',
        site_address TEXT DEFAULT '',
        client_username VARCHAR(128) NOT NULL,
        password_hash VARCHAR(256) NOT NULL,
        selected_tiers JSONB NOT NULL DEFAULT '[]'::jsonb,
        quote_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
        security_settings JSONB NOT NULL DEFAULT '{}'::jsonb,
        expires_at TIMESTAMP WITH TIME ZONE,
        is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
        view_count INTEGER NOT NULL DEFAULT 0,
        last_viewed_at TIMESTAMP WITH TIME ZONE,
        access_logs JSONB NOT NULL DEFAULT '[]'::jsonb,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      )
    `);
    pgTableReady = true;
    return true;
  } catch (err) {
    console.warn('ClientQuotes PG init notice, using JSON store:', err.message);
    return false;
  }
}

async function assertProjectAccess(user, projectId) {
  if (!projectId) throw makeError('Project ID is required', 400);
  try {
    const project = await prismaConfig.prisma.project.findUnique({ where: { id: projectId } });
    if (project && user && user.role !== 'admin' && project.createdBy && project.createdBy !== user.id) {
      throw makeError('Access denied: You do not own this project', 403);
    }
    return project;
  } catch (err) {
    if (err.statusCode === 403) throw err;
    return null;
  }
}

function findUserByNameOrId(users, opts) {
  if (!Array.isArray(users) || !users.length || !opts) return null;
  if (opts.id) {
    const byId = users.find((u) => u && String(u.id) === String(opts.id));
    if (byId) return byId;
  }
  if (opts.email) {
    const cleanE = String(opts.email).trim().toLowerCase();
    const byEmail = users.find((u) => u && u.email && String(u.email).trim().toLowerCase() === cleanE);
    if (byEmail) return byEmail;
  }
  if (opts.name) {
    const cleanN = String(opts.name).trim().toLowerCase();
    const matches = users.filter((u) => u && (
      (u.name && String(u.name).trim().toLowerCase() === cleanN) ||
      (u.username && String(u.username).trim().toLowerCase() === cleanN)
    ));
    if (matches.length > 1 && opts.preferBH) {
      const bh = matches.find((u) => /business\s*head|\bbh\b/i.test(String(u.designation || '')));
      if (bh) return bh;
    }
    if (matches.length) return matches[0];
  }
  return null;
}

// Resolve a project's respective Employee (FA) designer info AND respective BH + Employee WhatsApp alert phones
async function resolveProjectContacts(projectInput, rec, fallbackUser) {
  let project = projectInput || null;
  const projectId = (project && project.id) || (rec && rec.projectId) || '';
  if (!project && projectId) {
    try {
      project = await prismaConfig.prisma.project.findUnique({ where: { id: projectId } });
    } catch (_) {
      project = null;
    }
  }

  let users = [];
  try {
    users = await userService.getAllUsers();
  } catch (_) {
    users = [];
  }

  const pData = (project && project.data && typeof project.data === 'object') ? project.data : {};
  const pDetails = (pData.details && typeof pData.details === 'object') ? pData.details : {};
  const pPlanMeta = (pData.plan && pData.plan.meta && typeof pData.plan.meta === 'object') ? pData.plan.meta : {};
  const snap = (rec && rec.quoteSnapshot) || {};
  const snapMeta = snap.meta || {};
  const snapDesigner = snap.designer || {};

  // 1. Respective Employee (FA): Project Owner first, then Quote Creator, then fallbackUser
  const ownerUser = project
    ? findUserByNameOrId(users, {
        id: project.createdBy || project.created_by,
        email: project.ownerEmail || project.owner_email,
        name: project.ownerName || project.owner_name
      })
    : null;
  const creatorUser = (rec && rec.createdBy)
    ? findUserByNameOrId(users, { id: rec.createdBy })
    : (fallbackUser ? (findUserByNameOrId(users, { id: fallbackUser.id, email: fallbackUser.email }) || fallbackUser) : null);

  const faUser = ownerUser || creatorUser || fallbackUser || null;
  const faName = (faUser && faUser.name) ||
    (project && (project.ownerName || project.owner_name)) ||
    snapDesigner.name ||
    'Cookscape Design Team';
  const faPhone = String(
    (faUser && faUser.phone) ||
    (creatorUser && creatorUser.phone) ||
    snapDesigner.phone ||
    ''
  ).trim();
  const faEmail = String(
    (faUser && faUser.email) ||
    (project && (project.ownerEmail || project.owner_email)) ||
    snapDesigner.email ||
    'designs.cookscape@gmail.com'
  ).trim();

  // 2. Respective Business Head (BH)
  const bhName = String(
    pDetails.bhName ||
    (project && (project.bh_name || project.bhName)) ||
    pPlanMeta.bhName ||
    snapMeta.bhName ||
    ''
  ).trim();
  const bhUser = bhName ? findUserByNameOrId(users, { name: bhName, preferBH: true }) : null;

  // 3. WhatsApp Alert Recipients: respective BH + respective project Employee(s) (deduplicated)
  const rawPhones = [];
  if (bhUser && bhUser.phone) rawPhones.push(bhUser.phone);
  if (ownerUser && ownerUser.phone) rawPhones.push(ownerUser.phone);
  if (creatorUser && creatorUser.phone) rawPhones.push(creatorUser.phone);
  if (faPhone) rawPhones.push(faPhone);

  const seen = new Set();
  const alertPhones = [];
  for (const ph of rawPhones) {
    const norm = whatsappAlertService.normalizePhoneIndia(ph);
    if (norm && norm.length >= 10 && !seen.has(norm)) {
      seen.add(norm);
      alertPhones.push(norm);
    }
  }

  return {
    faUser,
    bhUser,
    bhName,
    designer: {
      name: faName,
      phone: faPhone,
      email: faEmail
    },
    alertPhones
  };
}

async function findByToken(shareToken) {
  if (!shareToken) return null;
  if (await ensurePgTable()) {
    try {
      const rows = await prismaConfig.prisma.$queryRawUnsafe(
        'SELECT * FROM client_quotes WHERE share_token = $1 LIMIT 1',
        shareToken
      );
      if (rows && rows.length) return normalizeRow(rows[0]);
    } catch (_) {}
  }
  const local = readLocalStore();
  return local.find((r) => r.shareToken === shareToken) || null;
}

async function findByReviewToken(reviewToken) {
  if (!reviewToken) return null;
  if (await ensurePgTable()) {
    try {
      const rows = await prismaConfig.prisma.$queryRawUnsafe(
        "SELECT * FROM client_quotes WHERE security_settings->>'reviewToken' = $1 LIMIT 1",
        reviewToken
      );
      if (rows && rows.length) return normalizeRow(rows[0]);
    } catch (_) {}
  }
  const local = readLocalStore();
  return local.find((r) => r.securitySettings && r.securitySettings.reviewToken === reviewToken) || null;
}

async function findById(id) {
  if (!id) return null;
  if (await ensurePgTable()) {
    try {
      const rows = await prismaConfig.prisma.$queryRawUnsafe(
        'SELECT * FROM client_quotes WHERE id = $1 LIMIT 1',
        id
      );
      if (rows && rows.length) return normalizeRow(rows[0]);
    } catch (_) {}
  }
  const local = readLocalStore();
  return local.find((r) => r.id === id) || null;
}

async function insertRecord(rec) {
  if (await ensurePgTable()) {
    try {
      await prismaConfig.prisma.$executeRawUnsafe(
        `INSERT INTO client_quotes (
          id, project_id, created_by, share_token, title, quote_code,
          client_name, client_phone, client_email, site_address,
          client_username, password_hash, selected_tiers, quote_snapshot,
          security_settings, expires_at, is_revoked, view_count, last_viewed_at,
          access_logs, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10,
          $11, $12, $13::jsonb, $14::jsonb,
          $15::jsonb, $16::timestamptz, $17, $18, $19::timestamptz,
          $20::jsonb, $21::timestamptz, $22::timestamptz
        )`,
        rec.id, rec.projectId, rec.createdBy, rec.shareToken, rec.title, rec.quoteCode,
        rec.clientName, rec.clientPhone, rec.clientEmail, rec.siteAddress,
        rec.clientUsername, rec.passwordHash, JSON.stringify(rec.selectedTiers || []),
        JSON.stringify(rec.quoteSnapshot || {}), JSON.stringify(rec.securitySettings || {}),
        rec.expiresAt ? new Date(rec.expiresAt).toISOString() : null,
        Boolean(rec.isRevoked), Number(rec.viewCount || 0),
        rec.lastViewedAt ? new Date(rec.lastViewedAt).toISOString() : null,
        JSON.stringify(rec.accessLogs || []),
        new Date(rec.createdAt).toISOString(),
        new Date(rec.updatedAt).toISOString()
      );
      return rec;
    } catch (err) {
      console.warn('ClientQuotes PG insert fallback:', err.message);
    }
  }
  const list = readLocalStore();
  list.unshift(rec);
  writeLocalStore(list);
  return rec;
}

async function persistRecordUpdate(rec) {
  rec.updatedAt = new Date().toISOString();
  if (await ensurePgTable()) {
    try {
      await prismaConfig.prisma.$executeRawUnsafe(
        `UPDATE client_quotes SET
          client_username = $2,
          password_hash = $3,
          quote_snapshot = $4::jsonb,
          security_settings = $5::jsonb,
          expires_at = $6::timestamptz,
          is_revoked = $7,
          view_count = $8,
          last_viewed_at = $9::timestamptz,
          access_logs = $10::jsonb,
          updated_at = $11::timestamptz
         WHERE id = $1`,
        rec.id,
        rec.clientUsername,
        rec.passwordHash,
        JSON.stringify(rec.quoteSnapshot || {}),
        JSON.stringify(rec.securitySettings || {}),
        rec.expiresAt ? new Date(rec.expiresAt).toISOString() : null,
        Boolean(rec.isRevoked),
        Number(rec.viewCount || 0),
        rec.lastViewedAt ? new Date(rec.lastViewedAt).toISOString() : null,
        JSON.stringify(rec.accessLogs || []),
        rec.updatedAt
      );
      return rec;
    } catch (err) {
      console.warn('ClientQuotes PG update fallback:', err.message);
    }
  }
  const list = readLocalStore();
  const idx = list.findIndex((r) => r.id === rec.id);
  if (idx !== -1) list[idx] = rec;
  else list.unshift(rec);
  writeLocalStore(list);
  return rec;
}

function checkQuoteActiveStatus(rec) {
  if (!rec) return { active: false, reason: 'Quotation link not found.' };
  if (rec.isRevoked) return { active: false, reason: 'This quotation link has been revoked by the designer.' };
  const wf = getWorkflowMeta(rec);
  if (wf.approvalStatus !== 'approved' || !wf.clientLinkActivated) {
    return { active: false, reason: 'This quotation is awaiting Head approval before client viewing.' };
  }
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() < Date.now()) {
    return { active: false, reason: 'This quotation link has expired. Please contact your Cookscape designer.' };
  }
  return { active: true, reason: null };
}

function extractValidatedVariantsAndIcons(snapInput) {
  const rawVariants = Array.isArray(snapInput.variantQuotes) ? snapInput.variantQuotes : [];
  const variantQuotes = rawVariants.filter((vq) =>
    Boolean(quoteDeckBuilder.normalizeTemplateVariantKey(vq.tierKey || vq.tierName || vq.tierTitle))
  );
  if (!variantQuotes.length) {
    throw makeError('Please select at least one Master Template variant (ZAPPO EL PEARL, POT & CAFE, HOME SPACE, CAFÉ HUNT, LL ELITE, CAPRICOAST MATTE, CAPRICOST GLOSSY, ELEGANT SURABHI, or 4X TUFF GLOSS).', 400);
  }

  const unitIcons = {};
  if (snapInput.unitIcons && typeof snapInput.unitIcons === 'object') {
    let iconCount = 0;
    for (const [k, dataUrl] of Object.entries(snapInput.unitIcons)) {
      if (iconCount >= MAX_UNIT_ICONS) break;
      const cleanKey = String(k || '').replace(/[^a-zA-Z0-9_-]/g, '');
      if (!cleanKey) continue;
      const parsedIcon = sanitizeUnitIconDataUrl(dataUrl);
      if (parsedIcon) {
        unitIcons[cleanKey] = parsedIcon;
        iconCount += 1;
      }
    }
  }
  return { variantQuotes, unitIcons };
}

class ClientQuoteService {
  // Stage 1: Generate password-free Head Review Link (/quote-review/:reviewToken)
  async createReviewQuote(user, payload) {
    if (!user) throw makeError('Authentication required', 401);
    const projectId = String(payload.projectId || '').trim();
    const project = await assertProjectAccess(user, projectId);

    const clientName = String(payload.clientName || '').trim();
    if (!clientName) throw makeError('Client name is required', 400);

    const snapInput = payload.quoteSnapshot || {};
    const { variantQuotes, unitIcons } = extractValidatedVariantsAndIcons(snapInput);
    const contacts = await resolveProjectContacts(project, { projectId, createdBy: user.id, quoteSnapshot: snapInput }, user);
    const enrichedMeta = Object.assign({}, snapInput.meta || {}, {
      designerName: contacts.designer.name,
      designerPhone: contacts.designer.phone,
      bhName: contacts.bhName || (snapInput.meta && snapInput.meta.bhName) || ''
    });

    const now = new Date().toISOString();
    const reviewToken = 'rv_' + crypto.randomBytes(16).toString('hex');
    const rec = {
      id: 'cq_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      projectId,
      createdBy: user.id,
      shareToken: 'qt_' + crypto.randomBytes(16).toString('hex'),
      title: String(payload.title || snapInput.meta?.title || (project && project.title) || `${clientName} — Interior Quotation`).slice(0, 250),
      quoteCode: String(payload.quoteCode || snapInput.meta?.quoteId || '').slice(0, 60),
      clientName: clientName.slice(0, 240),
      clientPhone: String(payload.clientPhone || '').trim().slice(0, 60),
      clientEmail: String(payload.clientEmail || '').trim().slice(0, 120),
      siteAddress: String(payload.siteAddress || '').trim().slice(0, 500),
      clientUsername: clientName.slice(0, 120),
      passwordHash: '',
      selectedTiers: variantQuotes.map((v) => v.tierTitle || v.tierKey),
      quoteSnapshot: {
        meta: enrichedMeta,
        designer: contacts.designer,
        variantQuotes,
        allVariantsPricing: Array.isArray(snapInput.allVariantsPricing) ? snapInput.allVariantsPricing : [],
        unitIcons
      },
      securitySettings: {
        watermarkEnabled: false,
        blurShieldEnabled: true,
        reviewToken,
        staffViewKey: generateStaffViewKey(),
        approvalStatus: 'pending_approval',
        approvedAt: null,
        approvedBy: '',
        approvalRemarks: '',
        clientLinkActivated: false,
        lastWhatsappAlert: null
      },
      expiresAt: null,
      isRevoked: false,
      viewCount: 0,
      lastViewedAt: null,
      accessLogs: [{ event: 'review_link_created', at: now, detail: `Created by ${user.name}` }],
      createdAt: now,
      updatedAt: now
    };

    await insertRecord(rec);
    return sanitizeRecordForManager(rec);
  }

  // Direct createQuote (preserved for backwards compatibility & direct client link creation)
  async createQuote(user, payload) {
    if (!user) throw makeError('Authentication required', 401);
    if (payload.stage === 'head_review' || (!payload.clientPassword && payload.requireApproval !== false)) {
      return this.createReviewQuote(user, payload);
    }

    const projectId = String(payload.projectId || '').trim();
    const project = await assertProjectAccess(user, projectId);

    const clientName = String(payload.clientName || '').trim();
    if (!clientName) throw makeError('Client name is required', 400);

    const clientUsername = String(payload.clientUsername || clientName).trim();
    const clientPassword = String(payload.clientPassword || '').trim();
    if (clientUsername.length < 2) throw makeError('Client username must be at least 2 characters', 400);
    if (clientPassword.length < 4) throw makeError('Client password must be at least 4 characters', 400);

    const snapInput = payload.quoteSnapshot || {};
    const { variantQuotes, unitIcons } = extractValidatedVariantsAndIcons(snapInput);
    const contacts = await resolveProjectContacts(project, { projectId, createdBy: user.id, quoteSnapshot: snapInput }, user);
    const enrichedMeta = Object.assign({}, snapInput.meta || {}, {
      designerName: contacts.designer.name,
      designerPhone: contacts.designer.phone,
      bhName: contacts.bhName || (snapInput.meta && snapInput.meta.bhName) || ''
    });

    const expiryDays = payload.expiryDays !== undefined && payload.expiryDays !== null && payload.expiryDays !== ''
      ? Number(payload.expiryDays)
      : 15;
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const now = new Date().toISOString();
    const reviewToken = 'rv_' + crypto.randomBytes(16).toString('hex');
    const rec = {
      id: 'cq_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      projectId,
      createdBy: user.id,
      shareToken: 'qt_' + crypto.randomBytes(16).toString('hex'),
      title: String(payload.title || snapInput.meta?.title || (project && project.title) || `${clientName} — Interior Quotation`).slice(0, 250),
      quoteCode: String(payload.quoteCode || snapInput.meta?.quoteId || '').slice(0, 60),
      clientName: clientName.slice(0, 240),
      clientPhone: String(payload.clientPhone || '').trim().slice(0, 60),
      clientEmail: String(payload.clientEmail || '').trim().slice(0, 120),
      siteAddress: String(payload.siteAddress || '').trim().slice(0, 500),
      clientUsername,
      passwordHash: await bcrypt.hash(clientPassword, 10),
      selectedTiers: variantQuotes.map((v) => v.tierTitle || v.tierKey),
      quoteSnapshot: {
        meta: enrichedMeta,
        designer: contacts.designer,
        variantQuotes,
        allVariantsPricing: Array.isArray(snapInput.allVariantsPricing) ? snapInput.allVariantsPricing : [],
        unitIcons
      },
      securitySettings: {
        watermarkEnabled: false,
        blurShieldEnabled: payload.securitySettings?.blurShieldEnabled !== false,
        reviewToken,
        staffViewKey: generateStaffViewKey(),
        approvalStatus: 'approved',
        approvedAt: now,
        approvedBy: user.name || 'Designer',
        approvalRemarks: '',
        clientLinkActivated: true,
        lastWhatsappAlert: null
      },
      expiresAt,
      isRevoked: false,
      viewCount: 0,
      lastViewedAt: null,
      accessLogs: [],
      createdAt: now,
      updatedAt: now
    };

    await insertRecord(rec);
    return sanitizeRecordForManager(rec);
  }

  // Stage 2a: Public password-free Head Review payload (ONLY selected variants' quotation summaries)
  async getReviewPayload(reviewToken) {
    const rec = await findByReviewToken(reviewToken);
    if (!rec) throw makeError('Review link not found or invalid.', 404);
    if (rec.isRevoked) throw makeError('This quotation review link has been revoked.', 403);
    const snap = rec.quoteSnapshot || {};
    const wf = getWorkflowMeta(rec);
    const contacts = await resolveProjectContacts(null, rec, null);
    return {
      id: rec.id,
      projectId: rec.projectId,
      reviewToken: wf.reviewToken,
      approvalStatus: wf.approvalStatus,
      approvedAt: wf.approvedAt,
      approvedBy: wf.approvedBy,
      approvalRemarks: wf.approvalRemarks,
      title: rec.title,
      quoteCode: rec.quoteCode,
      clientName: rec.clientName,
      clientPhone: rec.clientPhone,
      siteAddress: rec.siteAddress,
      designer: contacts.designer,
      bhName: contacts.bhName,
      allVariantsPricing: (Array.isArray(snap.allVariantsPricing) && snap.allVariantsPricing.length)
        ? snap.allVariantsPricing
        : (snap.variantQuotes || []).map((v) => ({
            tierKey: v.tierKey,
            tierTitle: v.tierTitle || v.tierKey,
            unitCount: Array.isArray(v.items) ? v.items.length : 0,
            grandTotal: Math.round(Number(v.commercial?.grandTotal ?? v.grandTotal ?? 0)),
            selected: true
          })),
      variants: (snap.variantQuotes || []).map((v) => ({
        tierKey: v.tierKey,
        tierTitle: v.tierTitle || v.tierKey,
        roomScopeLabel: v.roomScopeLabel || 'All Rooms',
        currencySymbol: v.currencySymbol || '₹',
        roomsSummary: quoteDeckBuilder.normalizeRoomsSummary(v.roomsSummary || []),
        commercial: recalculateVariantCommercial(v.commercial || {}),
        grandTotal: Math.round(Number(v.commercial?.grandTotal ?? v.grandTotal ?? 0))
      }))
    };
  }

  // Stage 2b: Head edits variant discounts & approves the review link (NO password required)
  async approveReviewQuote(reviewToken, body, ip) {
    const rec = await findByReviewToken(reviewToken);
    if (!rec) throw makeError('Review link not found or invalid.', 404);
    if (rec.isRevoked) throw makeError('This quotation review link has been revoked.', 403);

    const discountsList = Array.isArray(body.variantDiscounts) ? body.variantDiscounts : [];
    const byKey = {};
    for (const d of discountsList) {
      const nk = quoteDeckBuilder.normalizeTemplateVariantKey(d.tierKey) || String(d.tierKey || '').trim();
      if (nk) byKey[nk] = d;
    }

    rec.quoteSnapshot = rec.quoteSnapshot || {};
    const vqs = Array.isArray(rec.quoteSnapshot.variantQuotes) ? rec.quoteSnapshot.variantQuotes : [];
    rec.quoteSnapshot.variantQuotes = vqs.map((v) => {
      const nk = quoteDeckBuilder.normalizeTemplateVariantKey(v.tierKey || v.tierTitle) || v.tierKey;
      const edit = byKey[nk] || byKey[v.tierKey];
      const nextComm = edit
        ? recalculateVariantCommercial(v.commercial || {}, edit)
        : recalculateVariantCommercial(v.commercial || {});
      return Object.assign({}, v, {
        commercial: nextComm,
        grandTotal: nextComm.grandTotal
      });
    });

    // Keep allVariantsPricing side-reference totals synchronized with approved variant totals
    if (Array.isArray(rec.quoteSnapshot.allVariantsPricing) && rec.quoteSnapshot.allVariantsPricing.length) {
      const updatedTotalsByKey = {};
      rec.quoteSnapshot.variantQuotes.forEach((vq) => {
        const nk = quoteDeckBuilder.normalizeTemplateVariantKey(vq.tierKey || vq.tierTitle) || vq.tierKey;
        if (nk) updatedTotalsByKey[nk] = Math.round(Number(vq.grandTotal || 0));
      });
      rec.quoteSnapshot.allVariantsPricing = rec.quoteSnapshot.allVariantsPricing.map((av) => {
        const nk = quoteDeckBuilder.normalizeTemplateVariantKey(av.tierKey || av.tierTitle) || av.tierKey;
        if (nk && updatedTotalsByKey[nk] !== undefined) {
          return Object.assign({}, av, { grandTotal: updatedTotalsByKey[nk], selected: true });
        }
        return av;
      });
    }

    const nowIso = new Date().toISOString();
    const approvedBy = String(body.approvedBy || 'Business Head').trim().slice(0, 120) || 'Business Head';
    const approvalRemarks = String(body.approvalRemarks || '').trim().slice(0, 400);

    rec.securitySettings = Object.assign({}, rec.securitySettings || {}, {
      watermarkEnabled: false,
      approvalStatus: 'approved',
      approvedAt: nowIso,
      approvedBy,
      approvalRemarks
    });

    rec.accessLogs = Array.isArray(rec.accessLogs) ? rec.accessLogs : [];
    rec.accessLogs.push({
      event: 'head_approved',
      at: nowIso,
      ip: maskIp(ip),
      detail: `Approved by ${approvedBy}${approvalRemarks ? ' — ' + approvalRemarks.slice(0, 60) : ''}`
    });
    if (rec.accessLogs.length > MAX_AUDIT_LOGS) rec.accessLogs = rec.accessLogs.slice(-MAX_AUDIT_LOGS);

    await persistRecordUpdate(rec);
    return this.getReviewPayload(reviewToken);
  }

  // Stage 3: Once Head approves, generate/activate the full client link with username (client name) & password
  async activateClientLink(user, quoteId, payload) {
    if (!user) throw makeError('Authentication required', 401);
    const rec = await findById(quoteId);
    if (!rec) throw makeError('Quotation not found', 404);
    if (user.role !== 'admin' && rec.createdBy !== user.id) {
      throw makeError('Access denied', 403);
    }

    const wf = getWorkflowMeta(rec);
    if (wf.approvalStatus !== 'approved') {
      throw makeError('Head approval is required before generating the full client quotation link.', 400);
    }

    const clientUsername = String(payload.clientUsername || rec.clientName || '').trim();
    const clientPassword = String(payload.clientPassword || '').trim();
    if (clientUsername.length < 2) throw makeError('Client username must be at least 2 characters', 400);
    if (clientPassword.length < 4) throw makeError('Client password must be at least 4 characters', 400);

    const expiryDays = payload.expiryDays !== undefined && payload.expiryDays !== null && payload.expiryDays !== ''
      ? Number(payload.expiryDays)
      : 15;
    rec.expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    rec.clientUsername = clientUsername.slice(0, 120);
    rec.passwordHash = await bcrypt.hash(clientPassword, 10);
    rec.isRevoked = false;
    rec.securitySettings = Object.assign({}, rec.securitySettings || {}, {
      watermarkEnabled: false,
      blurShieldEnabled: payload.blurShieldEnabled !== false,
      clientLinkActivated: true
    });

    const nowIso = new Date().toISOString();
    rec.accessLogs = Array.isArray(rec.accessLogs) ? rec.accessLogs : [];
    rec.accessLogs.push({
      event: 'client_link_activated',
      at: nowIso,
      detail: `Activated for ${rec.clientUsername} by ${user.name}`
    });
    if (rec.accessLogs.length > MAX_AUDIT_LOGS) rec.accessLogs = rec.accessLogs.slice(-MAX_AUDIT_LOGS);

    await persistRecordUpdate(rec);
    return sanitizeRecordForManager(rec);
  }

  // Export payload builder for Approved Quotes (PPTX & PDF with Head-approved discounts)
  async getQuoteExportPayload(user, quoteId) {
    if (!user) throw makeError('Authentication required', 401);
    const rec = await findById(quoteId);
    if (!rec) throw makeError('Quotation not found', 404);
    if (user.role !== 'admin' && rec.createdBy !== user.id) {
      throw makeError('Access denied', 403);
    }
    const wf = getWorkflowMeta(rec);
    if (wf.approvalStatus !== 'approved') {
      throw makeError('Head approval is required before downloading the full PPTX / PDF quotation.', 400);
    }
    const snap = rec.quoteSnapshot || {};
    const contacts = await resolveProjectContacts(null, rec, user);
    const unitIconsDataUrls = {};
    if (snap.unitIcons && typeof snap.unitIcons === 'object') {
      for (const [k, entry] of Object.entries(snap.unitIcons)) {
        if (entry && entry.data) {
          unitIconsDataUrls[k] = `data:${entry.mime || 'image/png'};base64,${entry.data}`;
        }
      }
    }
    return {
      clientName: rec.clientName,
      clientPhone: rec.clientPhone,
      clientEmail: rec.clientEmail,
      siteAddress: rec.siteAddress,
      quoteCode: rec.quoteCode,
      meta: Object.assign({}, snap.meta || {}, { designerName: contacts.designer.name, designerPhone: contacts.designer.phone }),
      designer: contacts.designer,
      variantQuotes: (snap.variantQuotes || []).map((vq) => Object.assign({}, vq, {
        roomsSummary: quoteDeckBuilder.normalizeRoomsSummary(vq.roomsSummary || [])
      })),
      unitIcons: unitIconsDataUrls
    };
  }

  async listQuotesByProject(user, projectId) {
    if (!user) throw makeError('Authentication required', 401);
    await assertProjectAccess(user, projectId);

    if (await ensurePgTable()) {
      try {
        const res = user.role === 'admin'
          ? await prismaConfig.prisma.$queryRawUnsafe(
              'SELECT * FROM client_quotes WHERE project_id = $1 ORDER BY created_at DESC',
              projectId
            )
          : await prismaConfig.prisma.$queryRawUnsafe(
              'SELECT * FROM client_quotes WHERE project_id = $1 AND created_by = $2 ORDER BY created_at DESC',
              projectId, user.id
            );
        return (res || []).map(normalizeRow).map(sanitizeRecordForManager);
      } catch (_) {}
    }
    const local = readLocalStore().filter((r) => {
      if (r.projectId !== projectId) return false;
      if (user.role !== 'admin' && r.createdBy !== user.id) return false;
      return true;
    });
    local.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    return local.map(sanitizeRecordForManager);
  }

  async updateQuote(user, quoteId, updates) {
    if (!user) throw makeError('Authentication required', 401);
    const rec = await findById(quoteId);
    if (!rec) throw makeError('Quotation link not found', 404);
    if (user.role !== 'admin' && rec.createdBy !== user.id) {
      throw makeError('Access denied', 403);
    }

    if (typeof updates.isRevoked === 'boolean') rec.isRevoked = updates.isRevoked;
    if (updates.clientUsername && String(updates.clientUsername).trim().length >= 2) {
      rec.clientUsername = String(updates.clientUsername).trim();
    }
    if (updates.clientPassword !== undefined && updates.clientPassword !== '') {
      const pw = String(updates.clientPassword).trim();
      if (pw.length < 4) throw makeError('Password must be at least 4 characters', 400);
      rec.passwordHash = await bcrypt.hash(pw, 10);
    }
    if (updates.expiryDays !== undefined) {
      const days = Number(updates.expiryDays);
      rec.expiresAt = days > 0 ? new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString() : null;
    }

    await persistRecordUpdate(rec);
    return sanitizeRecordForManager(rec);
  }

  async deleteQuote(user, quoteId) {
    if (!user) throw makeError('Authentication required', 401);
    const rec = await findById(quoteId);
    if (!rec) throw makeError('Quotation link not found', 404);
    if (user.role !== 'admin' && rec.createdBy !== user.id) {
      throw makeError('Access denied', 403);
    }

    if (await ensurePgTable()) {
      try {
        await prismaConfig.prisma.$executeRawUnsafe('DELETE FROM client_quotes WHERE id = $1', quoteId);
        return true;
      } catch (_) {}
    }
    const next = readLocalStore().filter((r) => r.id !== quoteId);
    writeLocalStore(next);
    return true;
  }

  async getPortalPublicInfo(shareToken, sessionAuthEntry) {
    const rec = await findByToken(shareToken);
    if (!rec) {
      return { exists: false, active: false, reason: 'Quotation link is invalid or has been removed.' };
    }
    const status = checkQuoteActiveStatus(rec);
    const isAuthed = Boolean(
      status.active &&
      sessionAuthEntry &&
      sessionAuthEntry.token === shareToken &&
      sessionAuthEntry.username
    );
    return {
      exists: true,
      active: status.active,
      reason: status.reason,
      authenticated: isAuthed,
      quoteCode: rec.quoteCode || '',
      title: rec.title || 'Cookscape Interior Quotation',
      clientHint: isAuthed ? rec.clientName : ''
    };
  }

  // Employee password-free quick access via secret ?staff=<staffViewKey> sent in WhatsApp alert
  async verifyStaffQuickAccess(shareToken, staffKey) {
    if (!shareToken || !staffKey) return null;
    const rec = await findByToken(shareToken);
    if (!rec || rec.isRevoked) return null;
    if (!isValidStaffKey(rec, staffKey)) return null;
    return {
      token: rec.shareToken,
      username: 'Employee Quick View',
      clientName: rec.clientName,
      quoteCode: rec.quoteCode || '',
      isStaffView: true,
      authenticatedAt: new Date().toISOString()
    };
  }

  // Stage 4: Client logs into /quote/:shareToken -> triggers WhatsApp Alert to 8838199428 & 7418414780
  async authenticatePortalClient(shareToken, username, password, ip, userAgent, quoteUrl) {
    const rec = await findByToken(shareToken);
    const status = checkQuoteActiveStatus(rec);
    if (!status.active) {
      throw makeError(status.reason || 'Quotation unavailable', 403);
    }

    const uClean = String(username || '').trim().toLowerCase();
    const pClean = String(password || '');
    if (!uClean || !pClean) {
      throw makeError('Username and password are required', 400);
    }

    const expectedUser = String(rec.clientUsername || '').trim().toLowerCase();
    const passMatches = rec.passwordHash ? await bcrypt.compare(pClean, rec.passwordHash) : false;

    if (uClean !== expectedUser || !passMatches) {
      rec.accessLogs = Array.isArray(rec.accessLogs) ? rec.accessLogs : [];
      rec.accessLogs.push({ event: 'login_failed', at: new Date().toISOString(), ip: maskIp(ip) });
      if (rec.accessLogs.length > MAX_AUDIT_LOGS) rec.accessLogs = rec.accessLogs.slice(-MAX_AUDIT_LOGS);
      await persistRecordUpdate(rec);
      throw makeError('Invalid client username or password', 401);
    }

    const nowIso = new Date().toISOString();
    rec.viewCount = Number(rec.viewCount || 0) + 1;
    rec.lastViewedAt = nowIso;
    rec.accessLogs = Array.isArray(rec.accessLogs) ? rec.accessLogs : [];
    rec.accessLogs.push({
      event: 'login_success',
      at: nowIso,
      ip: maskIp(ip),
      ua: String(userAgent || '').slice(0, 90)
    });

    // Dispatch WhatsApp alert to project's respective BH & Employee(s) with password-free quick-view link
    let waSummary = null;
    try {
      const snapMeta = (rec.quoteSnapshot && rec.quoteSnapshot.meta) || {};
      const projectName = snapMeta.title || rec.title || 'Interior Project';
      const staffKey = ensureStaffViewKey(rec);
      const baseQuoteUrl = quoteUrl || `${String(process.env.PUBLIC_APP_URL || 'https://studio.orbixdesigns.com').replace(/\/+$/, '')}/quote/${rec.shareToken}`;
      const employeeQuoteUrl = `${baseQuoteUrl}${baseQuoteUrl.includes('?') ? '&' : '?'}staff=${encodeURIComponent(staffKey)}`;
      const contacts = await resolveProjectContacts(null, rec, null);
      const alertRes = await whatsappAlertService.sendClientOpenedAlert({
        clientName: rec.clientName,
        projectName,
        projectId: rec.projectId,
        quoteCode: rec.quoteCode || snapMeta.quoteId || rec.id,
        quoteUrl: employeeQuoteUrl,
        recipients: contacts.alertPhones
      });
      waSummary = {
        sentAt: nowIso,
        provider: alertRes.provider,
        recipients: alertRes.recipients,
        deliveredCount: alertRes.results.filter((r) => r.sent).length,
        message: alertRes.message
      };
      rec.securitySettings = Object.assign({}, rec.securitySettings || {}, {
        lastWhatsappAlert: waSummary
      });
      rec.accessLogs.push({
        event: 'whatsapp_alert',
        at: nowIso,
        detail: `Alert (${alertRes.provider}) -> ${alertRes.recipients.join(', ')}`
      });
    } catch (waErr) {
      console.warn('[WhatsAppAlert] Error:', waErr.message);
    }

    if (rec.accessLogs.length > MAX_AUDIT_LOGS) rec.accessLogs = rec.accessLogs.slice(-MAX_AUDIT_LOGS);
    await persistRecordUpdate(rec);

    return {
      token: rec.shareToken,
      username: rec.clientUsername,
      clientName: rec.clientName,
      quoteCode: rec.quoteCode || '',
      authenticatedAt: nowIso,
      whatsappAlert: waSummary
    };
  }

  async getPortalDeckPayload(shareToken, sessionAuthEntry, ip) {
    const rec = await findByToken(shareToken);
    const status = checkQuoteActiveStatus(rec);
    if (!status.active) throw makeError(status.reason || 'Quotation unavailable', 403);
    if (!sessionAuthEntry || sessionAuthEntry.token !== shareToken) {
      throw makeError('Client login required', 401);
    }

    const contacts = await resolveProjectContacts(null, rec, null);
    const hydratedRec = Object.assign({}, rec, {
      quoteSnapshot: Object.assign({}, rec.quoteSnapshot || {}, {
        meta: Object.assign({}, (rec.quoteSnapshot && rec.quoteSnapshot.meta) || {}, {
          designerName: contacts.designer.name,
          designerPhone: contacts.designer.phone
        }),
        designer: contacts.designer
      })
    });
    const slides = quoteDeckBuilder.buildClientQuoteDeck(hydratedRec);
    return {
      title: rec.title,
      quoteCode: rec.quoteCode || '',
      clientName: rec.clientName,
      watermarkText: '',
      securitySettings: {
        watermarkEnabled: false,
        blurShieldEnabled: rec.securitySettings?.blurShieldEnabled !== false
      },
      slides
    };
  }

  async resolvePortalAsset(shareToken, assetKey, sessionAuthEntry) {
    const rec = await findByToken(shareToken);
    const status = checkQuoteActiveStatus(rec);
    if (!status.active) throw makeError(status.reason || 'Quotation unavailable', 403);
    if (!sessionAuthEntry || sessionAuthEntry.token !== shareToken) {
      throw makeError('Client login required', 401);
    }

    if (typeof assetKey === 'string' && assetKey.startsWith('unit_icon_')) {
      const iconId = assetKey.slice('unit_icon_'.length);
      const unitIcons = (rec.quoteSnapshot && rec.quoteSnapshot.unitIcons) || {};
      const entry = unitIcons[iconId];
      if (entry && entry.data) {
        return {
          mime: entry.mime || 'image/png',
          buffer: Buffer.from(entry.data, 'base64')
        };
      }
      // Clean fallback: 1x1 transparent PNG if custom unit icon thumbnail is not in snapshot
      const transparent1x1Png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
      return {
        mime: 'image/png',
        buffer: transparent1x1Png
      };
    }

    const diskPath = quoteDeckBuilder.resolveTemplateAssetPath(assetKey);
    if (!diskPath) throw makeError('Asset not found', 404);
    const ext = path.extname(diskPath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
    return {
      mime,
      buffer: fs.readFileSync(diskPath)
    };
  }

  async logPortalAuditEvent(shareToken, eventName, detail, ip) {
    const rec = await findByToken(shareToken);
    if (!rec) return;
    const allowed = new Set(['focus_blur', 'print_attempt', 'screenshot_key_attempt', 'copy_attempt', 'slide_view', 'mobile_gesture_capture', 'mobile_longpress_block', 'devtools_attempt', 'idle_lock', 'screen_capture_blocked']);
    if (!allowed.has(eventName)) return;
    rec.accessLogs = Array.isArray(rec.accessLogs) ? rec.accessLogs : [];
    rec.accessLogs.push({
      event: eventName,
      detail: String(detail || '').slice(0, 60),
      at: new Date().toISOString(),
      ip: maskIp(ip)
    });
    if (rec.accessLogs.length > MAX_AUDIT_LOGS) rec.accessLogs = rec.accessLogs.slice(-MAX_AUDIT_LOGS);
    await persistRecordUpdate(rec);
  }
}

const serviceInstance = new ClientQuoteService();
serviceInstance.recalculateVariantCommercial = recalculateVariantCommercial;
module.exports = serviceInstance;
