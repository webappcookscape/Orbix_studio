// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Protected Client Quote Service (PostgreSQL + JSON Fallback)
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const prismaConfig = require('../config/prisma');
const quoteDeckBuilder = require('./quoteDeckBuilder');

const ROOT_DIR = path.join(__dirname, '../..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const STORE_PATH = path.join(DATA_DIR, 'client_quotes_store.json');

const MAX_ICON_BYTES = 200 * 1024; // 200 KB per unit elevation icon
const MAX_UNIT_ICONS = 80;
const MAX_AUDIT_LOGS = 60;

let pgTableReady = false;

function makeError(message, statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode || 400;
  return err;
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

function sanitizeRecordForManager(rec) {
  if (!rec) return null;
  const snap = rec.quoteSnapshot || {};
  return {
    id: rec.id,
    projectId: rec.projectId,
    createdBy: rec.createdBy,
    shareToken: rec.shareToken,
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
      grandTotal: v.grandTotal,
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
          expires_at = $4::timestamptz,
          is_revoked = $5,
          view_count = $6,
          last_viewed_at = $7::timestamptz,
          access_logs = $8::jsonb,
          updated_at = $9::timestamptz
         WHERE id = $1`,
        rec.id,
        rec.clientUsername,
        rec.passwordHash,
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
  if (rec.expiresAt && new Date(rec.expiresAt).getTime() < Date.now()) {
    return { active: false, reason: 'This quotation link has expired. Please contact your Cookscape designer.' };
  }
  return { active: true, reason: null };
}

class ClientQuoteService {
  async createQuote(user, payload) {
    if (!user) throw makeError('Authentication required', 401);
    const projectId = String(payload.projectId || '').trim();
    await assertProjectAccess(user, projectId);

    const clientName = String(payload.clientName || '').trim();
    if (!clientName) throw makeError('Client name is required', 400);

    const clientUsername = String(payload.clientUsername || '').trim();
    const clientPassword = String(payload.clientPassword || '').trim();
    if (clientUsername.length < 3) throw makeError('Client username must be at least 3 characters', 400);
    if (clientPassword.length < 4) throw makeError('Client password must be at least 4 characters', 400);

    const snapInput = payload.quoteSnapshot || {};
    const rawVariants = Array.isArray(snapInput.variantQuotes) ? snapInput.variantQuotes : [];
    const variantQuotes = rawVariants.filter((vq) =>
      Boolean(quoteDeckBuilder.normalizeTemplateVariantKey(vq.tierKey || vq.tierName || vq.tierTitle))
    );
    if (!variantQuotes.length) {
      throw makeError('Please select at least one Master Template variant (ZAPPO EL PEARL, POT & CAFE, HOME SPACE, CAFÉ HUNT, LL ELITE, CAPRICOAST MATTE, CAPRICOST GLOSSY, ELEGANT SURABHI, or 4X TUFF GLOSS).', 400);
    }

    // Sanitize compact unit thumbnail icons mapped inside Unit Snips
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

    const expiryDays = payload.expiryDays !== undefined && payload.expiryDays !== null && payload.expiryDays !== ''
      ? Number(payload.expiryDays)
      : 15;
    const expiresAt = expiryDays > 0
      ? new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const now = new Date().toISOString();
    const rec = {
      id: 'cq_' + Date.now().toString(36) + crypto.randomBytes(3).toString('hex'),
      projectId,
      createdBy: user.id,
      shareToken: 'qt_' + crypto.randomBytes(16).toString('hex'),
      title: String(payload.title || snapInput.meta?.title || `${clientName} — Interior Quotation`).slice(0, 250),
      quoteCode: String(payload.quoteCode || snapInput.meta?.quoteId || '').slice(0, 60),
      clientName: clientName.slice(0, 240),
      clientPhone: String(payload.clientPhone || '').trim().slice(0, 60),
      clientEmail: String(payload.clientEmail || '').trim().slice(0, 120),
      siteAddress: String(payload.siteAddress || '').trim().slice(0, 500),
      clientUsername,
      passwordHash: await bcrypt.hash(clientPassword, 10),
      selectedTiers: variantQuotes.map((v) => v.tierTitle || v.tierKey),
      quoteSnapshot: {
        meta: snapInput.meta || {},
        designer: snapInput.designer || {
          name: user.name,
          email: user.email,
          phone: ''
        },
        variantQuotes,
        unitIcons
      },
      securitySettings: {
        watermarkEnabled: false,
        blurShieldEnabled: payload.securitySettings?.blurShieldEnabled !== false
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
    if (updates.clientUsername && String(updates.clientUsername).trim().length >= 3) {
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

  async authenticatePortalClient(shareToken, username, password, ip, userAgent) {
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
    const passMatches = await bcrypt.compare(pClean, rec.passwordHash);

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
    if (rec.accessLogs.length > MAX_AUDIT_LOGS) rec.accessLogs = rec.accessLogs.slice(-MAX_AUDIT_LOGS);
    await persistRecordUpdate(rec);

    return {
      token: rec.shareToken,
      username: rec.clientUsername,
      clientName: rec.clientName,
      quoteCode: rec.quoteCode || '',
      authenticatedAt: nowIso
    };
  }

  async getPortalDeckPayload(shareToken, sessionAuthEntry, ip) {
    const rec = await findByToken(shareToken);
    const status = checkQuoteActiveStatus(rec);
    if (!status.active) throw makeError(status.reason || 'Quotation unavailable', 403);
    if (!sessionAuthEntry || sessionAuthEntry.token !== shareToken) {
      throw makeError('Client login required', 401);
    }

    const slides = quoteDeckBuilder.buildClientQuoteDeck(rec);
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
      throw makeError('Unit icon not found', 404);
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
    const allowed = new Set(['focus_blur', 'print_attempt', 'screenshot_key_attempt', 'copy_attempt', 'slide_view']);
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

module.exports = new ClientQuoteService();
