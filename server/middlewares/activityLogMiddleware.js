// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Global Application Activity Logger Middleware
// Fire-and-forget audit capture of all meaningful API actions (zero request lag).
// ═══════════════════════════════════════════════════════════════════════════════

const activityLogService = require('../services/activityLogService');

// Throttle identical auto-save PUT /api/projects/:id entries within 45s
const recentAutosaveMap = new Map();
const AUTOSAVE_THROTTLE_MS = 45 * 1000;

setInterval(() => {
  const cutoff = Date.now() - AUTOSAVE_THROTTLE_MS * 2;
  for (const [k, ts] of recentAutosaveMap.entries()) {
    if (ts < cutoff) recentAutosaveMap.delete(k);
  }
}, 5 * 60 * 1000).unref();

function getClientIp(req) {
  const xf = req.headers['x-forwarded-for'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0].trim();
  }
  return req.ip || (req.connection && req.connection.remoteAddress) || '';
}

function shouldSkipLogging(method, cleanPath) {
  if (!cleanPath) return true;
  if (cleanPath.startsWith('/logs')) return true;
  if (cleanPath === '/health' || cleanPath === '/status' || cleanPath === '/me') return true;
  if (cleanPath === '/client-quotes/whatsapp-status') return true;
  if (cleanPath.includes('/client-portal/') && cleanPath.includes('/asset/')) return true;
  if (method === 'GET') {
    // Log key opens (project open, head review open); skip high-frequency list/info polls
    if (/^\/projects\/[^/]+$/.test(cleanPath)) return false;
    if (/^\/quote-review\/[^/]+$/.test(cleanPath)) return false;
    return true;
  }
  return false;
}

function classifyRequest(method, cleanPath, reqBody, resBody, statusCode, actorName) {
  const actor = actorName || 'Anonymous';
  const rb = (reqBody && typeof reqBody === 'object') ? reqBody : {};
  const out = (resBody && typeof resBody === 'object') ? resBody : {};

  // 1. Authentication
  if (cleanPath === '/login' && method === 'POST') {
    const idf = String(rb.identifier || rb.email || rb.username || '').trim();
    if (statusCode < 400 && out.user) {
      return {
        category: 'Auth',
        action: 'USER_LOGIN',
        targetType: 'user',
        targetId: out.user.id || '',
        targetLabel: out.user.email || out.user.name || idf,
        summary: `${out.user.name || idf} signed in (${out.user.role || 'user'})`
      };
    }
    return {
      category: 'Auth',
      action: 'LOGIN_FAILED',
      targetType: 'user',
      targetId: '',
      targetLabel: idf || 'Unknown',
      summary: `Failed login attempt for "${idf || 'unknown'}" (HTTP ${statusCode})`
    };
  }
  if (cleanPath === '/logout' && method === 'POST') {
    return {
      category: 'Auth',
      action: 'USER_LOGOUT',
      targetType: 'user',
      targetId: '',
      targetLabel: actor,
      summary: `${actor} signed out`
    };
  }

  // 2. Users Management
  if (cleanPath === '/users' && method === 'POST') {
    const nm = (out.user && out.user.name) || rb.name || rb.email || 'New User';
    return {
      category: 'Users',
      action: 'USER_CREATED',
      targetType: 'user',
      targetId: (out.user && out.user.id) || '',
      targetLabel: nm,
      summary: `${actor} created user "${nm}" (${rb.role || 'employee'})`
    };
  }
  if (/^\/users\/[^/]+$/.test(cleanPath) && (method === 'PUT' || method === 'PATCH')) {
    const uid = cleanPath.split('/')[2];
    const nm = (out.user && out.user.name) || rb.name || uid;
    return {
      category: 'Users',
      action: 'USER_UPDATED',
      targetType: 'user',
      targetId: uid,
      targetLabel: nm,
      summary: `${actor} updated user "${nm}"`
    };
  }
  if (/^\/users\/[^/]+$/.test(cleanPath) && method === 'DELETE') {
    const uid = cleanPath.split('/')[2];
    return {
      category: 'Users',
      action: 'USER_DELETED',
      targetType: 'user',
      targetId: uid,
      targetLabel: uid,
      summary: `${actor} deleted user account (${uid})`
    };
  }

  // 3. Projects
  if (cleanPath === '/projects' && method === 'POST') {
    const p = out.project || {};
    const title = p.title || rb.title || rb.client || 'Untitled Project';
    return {
      category: 'Projects',
      action: 'PROJECT_CREATED',
      targetType: 'project',
      targetId: p.id || '',
      targetLabel: title,
      summary: `${actor} created project "${title}"`
    };
  }
  if (/^\/projects\/[^/]+\/fork$/.test(cleanPath) && method === 'POST') {
    const pid = cleanPath.split('/')[2];
    const p = out.project || {};
    const toColleague = rb.colleagueUser && rb.colleagueUser.name;
    return {
      category: 'Projects',
      action: toColleague ? 'PROJECT_SHARED_COPY' : 'PROJECT_DUPLICATED',
      targetType: 'project',
      targetId: p.id || pid,
      targetLabel: p.title || pid,
      summary: toColleague
        ? `${actor} shared a project copy of "${p.title || pid}" to ${toColleague}`
        : `${actor} duplicated project "${p.title || pid}"`
    };
  }
  if (/^\/projects\/[^/]+\/share$/.test(cleanPath) && method === 'POST') {
    const pid = cleanPath.split('/')[2];
    return {
      category: 'Projects',
      action: 'PROJECT_SHARE_LINK',
      targetType: 'project',
      targetId: pid,
      targetLabel: pid,
      summary: `${actor} created a share link for project (${pid})`
    };
  }
  if (/^\/projects\/[^/]+$/.test(cleanPath)) {
    const pid = cleanPath.split('/')[2];
    const p = out.project || out || {};
    const title = p.title || rb.title || pid;
    if (method === 'GET') {
      return {
        category: 'Projects',
        action: 'PROJECT_OPENED',
        targetType: 'project',
        targetId: pid,
        targetLabel: title,
        summary: `${actor} opened project "${title}"`
      };
    }
    if (method === 'PUT' || method === 'PATCH') {
      const act = rb.changeAction || rb.action || '';
      return {
        category: 'Projects',
        action: 'PROJECT_SAVED',
        targetType: 'project',
        targetId: pid,
        targetLabel: title,
        summary: `${actor} saved project "${title}"${act ? ' (' + act + ')' : ''}`
      };
    }
    if (method === 'DELETE') {
      return {
        category: 'Projects',
        action: 'PROJECT_DELETED',
        targetType: 'project',
        targetId: pid,
        targetLabel: pid,
        summary: `${actor} deleted project (${pid})`
      };
    }
  }

  // 4. Exports (PDF / PPTX)
  if (cleanPath.includes('/export-pdf') && method === 'POST') {
    const qid = cleanPath.split('/')[2] || '';
    const client = rb.clientName || qid || 'Quotation';
    return {
      category: 'Exports',
      action: 'PDF_EXPORTED',
      targetType: 'quote',
      targetId: qid,
      targetLabel: client,
      summary: `${actor} exported PDF quotation (${client})`
    };
  }
  if (cleanPath.includes('/export-pptx') && method === 'POST') {
    const qid = cleanPath.split('/')[2] || '';
    const client = rb.clientName || qid || 'Quotation';
    return {
      category: 'Exports',
      action: 'PPTX_EXPORTED',
      targetType: 'quote',
      targetId: qid,
      targetLabel: client,
      summary: `${actor} exported PPTX quotation (${client})`
    };
  }

  // 5. Client Quotations & Head Approval
  if (cleanPath === '/client-quotes/review' && method === 'POST') {
    const q = out.quote || {};
    const cname = q.clientName || rb.clientName || 'Client';
    return {
      category: 'Quotations',
      action: 'REVIEW_LINK_CREATED',
      targetType: 'quote',
      targetId: q.id || '',
      targetLabel: `${cname}${q.quoteCode ? ' (' + q.quoteCode + ')' : ''}`,
      summary: `${actor} generated Head Review link for "${cname}"`
    };
  }
  if (cleanPath === '/client-quotes' && method === 'POST') {
    const q = out.quote || {};
    const cname = q.clientName || rb.clientName || 'Client';
    return {
      category: 'Quotations',
      action: 'CLIENT_QUOTE_CREATED',
      targetType: 'quote',
      targetId: q.id || '',
      targetLabel: `${cname}${q.quoteCode ? ' (' + q.quoteCode + ')' : ''}`,
      summary: `${actor} created client quote link for "${cname}"`
    };
  }
  if (/^\/client-quotes\/[^/]+\/activate-client-link$/.test(cleanPath) && method === 'POST') {
    const qid = cleanPath.split('/')[2];
    const q = out.quote || {};
    const cname = q.clientName || rb.clientUsername || qid;
    return {
      category: 'Quotations',
      action: 'CLIENT_LINK_ACTIVATED',
      targetType: 'quote',
      targetId: qid,
      targetLabel: cname,
      summary: `${actor} generated/activated client quotation link for "${cname}"`
    };
  }
  if (/^\/client-quotes\/[^/]+$/.test(cleanPath) && method === 'PATCH') {
    const qid = cleanPath.split('/')[2];
    const q = out.quote || {};
    const cname = q.clientName || qid;
    const detail = typeof rb.isRevoked === 'boolean' ? (rb.isRevoked ? 'revoked link' : 'restored link') : 'updated settings';
    return {
      category: 'Quotations',
      action: rb.isRevoked ? 'QUOTE_REVOKED' : 'QUOTE_UPDATED',
      targetType: 'quote',
      targetId: qid,
      targetLabel: cname,
      summary: `${actor} ${detail} for "${cname}"`
    };
  }
  if (/^\/client-quotes\/[^/]+$/.test(cleanPath) && method === 'DELETE') {
    const qid = cleanPath.split('/')[2];
    return {
      category: 'Quotations',
      action: 'QUOTE_DELETED',
      targetType: 'quote',
      targetId: qid,
      targetLabel: qid,
      summary: `${actor} deleted quotation link (${qid})`
    };
  }
  if (/^\/quote-review\/[^/]+\/approve$/.test(cleanPath) && method === 'POST') {
    const rev = out.review || {};
    const approver = rb.approvedBy || rev.approvedBy || 'Business Head';
    const cname = rev.clientName || 'Client';
    return {
      category: 'Quotations',
      action: 'QUOTE_HEAD_APPROVED',
      targetType: 'quote',
      targetId: rev.id || '',
      targetLabel: cname,
      summary: `${approver} approved quotation for "${cname}"`
    };
  }
  if (/^\/quote-review\/[^/]+$/.test(cleanPath) && method === 'GET') {
    const rev = out.review || {};
    const cname = rev.clientName || 'Quotation';
    return {
      category: 'Quotations',
      action: 'REVIEW_LINK_OPENED',
      targetType: 'quote',
      targetId: rev.id || '',
      targetLabel: cname,
      summary: `Head Review link opened for "${cname}"`
    };
  }

  // 6. Client Portal
  if (/^\/client-portal\/[^/]+\/login$/.test(cleanPath) && method === 'POST') {
    const uname = String(rb.username || '').trim();
    if (statusCode < 400) {
      return {
        category: 'Client Portal',
        action: 'CLIENT_PORTAL_OPENED',
        targetType: 'portal',
        targetId: cleanPath.split('/')[2] || '',
        targetLabel: uname || 'Client',
        summary: `Client "${uname || 'Patron'}" logged into and opened quotation portal`
      };
    }
    return {
      category: 'Client Portal',
      action: 'CLIENT_LOGIN_FAILED',
      targetType: 'portal',
      targetId: cleanPath.split('/')[2] || '',
      targetLabel: uname || 'Client',
      summary: `Client portal login failed for "${uname || 'unknown'}" (HTTP ${statusCode})`
    };
  }
  if (/^\/client-portal\/[^/]+\/audit$/.test(cleanPath) && method === 'POST') {
    const ev = String(rb.event || 'activity').trim();
    return {
      category: 'Client Portal',
      action: 'CLIENT_PORTAL_AUDIT',
      targetType: 'portal',
      targetId: cleanPath.split('/')[2] || '',
      targetLabel: ev,
      summary: `Client portal event "${ev}"${rb.detail ? ': ' + String(rb.detail).slice(0, 120) : ''}`
    };
  }

  // 7. Cloud Render & AI
  if (cleanPath.startsWith('/render')) {
    return {
      category: 'Render',
      action: 'CLOUD_RENDER_' + method,
      targetType: 'render',
      targetId: '',
      targetLabel: cleanPath,
      summary: `${actor} triggered cloud render action (${method} ${cleanPath})`
    };
  }
  if (cleanPath.startsWith('/ai')) {
    return {
      category: 'System',
      action: 'AI_ACTION',
      targetType: 'ai',
      targetId: '',
      targetLabel: cleanPath,
      summary: `${actor} ran AI request (${method} ${cleanPath})`
    };
  }

  return {
    category: 'System',
    action: `${method}_${cleanPath.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '').toUpperCase() || 'API'}`.slice(0, 80),
    targetType: 'api',
    targetId: '',
    targetLabel: cleanPath,
    summary: `${actor} called ${method} /api${cleanPath} (HTTP ${statusCode})`
  };
}

function activityLogMiddleware(req, res, next) {
  const method = String(req.method || 'GET').toUpperCase();
  const cleanPath = String(req.path || '').split('?')[0];
  if (shouldSkipLogging(method, cleanPath)) {
    return next();
  }

  const startedAt = Date.now();
  // Capture pre-route session user (important for /logout which clears session)
  const preUser = (req.session && req.session.user) || req.user || null;
  let capturedResBody = null;

  const origJson = res.json;
  res.json = function (body) {
    capturedResBody = body;
    return origJson.call(this, body);
  };

  res.on('finish', () => {
    try {
      const statusCode = res.statusCode || 200;
      const durationMs = Date.now() - startedAt;
      const postUser = (req.user) || (req.session && req.session.user) || (capturedResBody && capturedResBody.user) || preUser;

      const actorId = (postUser && postUser.id) || '';
      const actorName = (postUser && postUser.name) || (preUser && preUser.name) || (req.body && (req.body.approvedBy || req.body.username || req.body.identifier)) || '';
      const actorEmail = (postUser && postUser.email) || (preUser && preUser.email) || '';
      const actorRole = (postUser && postUser.role) || (preUser && preUser.role) || '';

      // Throttle rapid 15s auto-save PUT /api/projects/:id unless explicit user action or error
      if (method === 'PUT' && /^\/projects\/[^/]+$/.test(cleanPath) && statusCode < 400) {
        const hasExplicitAct = Boolean(req.body && (req.body.changeAction || req.body.action));
        if (!hasExplicitAct) {
          const throttleKey = `${actorId || actorEmail || 'anon'}::${cleanPath}`;
          const lastTs = recentAutosaveMap.get(throttleKey) || 0;
          const now = Date.now();
          if (now - lastTs < AUTOSAVE_THROTTLE_MS) {
            return;
          }
          recentAutosaveMap.set(throttleKey, now);
        }
      }

      const info = classifyRequest(method, cleanPath, req.body, capturedResBody, statusCode, actorName);
      activityLogService.recordLog({
        category: info.category,
        action: info.action,
        summary: info.summary,
        method,
        path: '/api' + cleanPath,
        statusCode,
        durationMs,
        actorId,
        actorName: actorName || 'Guest / Client',
        actorEmail,
        actorRole,
        targetType: info.targetType,
        targetId: info.targetId,
        targetLabel: info.targetLabel,
        ip: getClientIp(req),
        userAgent: String(req.headers['user-agent'] || '').slice(0, 240),
        meta: statusCode >= 400 && capturedResBody && capturedResBody.error
          ? { error: String(capturedResBody.error).slice(0, 220) }
          : {}
      });
    } catch (_) {}
  });

  next();
}

module.exports = activityLogMiddleware;
