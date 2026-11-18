// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Client Quote & Protected Client Portal Controller
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const clientQuoteService = require('../services/clientQuoteService');

const ROOT_DIR = path.join(__dirname, '../..');
const PPTX_SCRIPT = path.join(ROOT_DIR, 'scripts', 'export_quote_pptx.py');

function runPythonExport(payloadObj) {
  return new Promise((resolve, reject) => {
    const tmpId = crypto.randomBytes(8).toString('hex');
    const jsonPath = path.join(os.tmpdir(), `orbix_q_${tmpId}.json`);
    const pptxPath = path.join(os.tmpdir(), `orbix_q_${tmpId}.pptx`);

    fs.writeFileSync(jsonPath, JSON.stringify(payloadObj), 'utf8');
    const pyBin = process.platform === 'win32' ? 'python' : 'python3';

    execFile(pyBin, [PPTX_SCRIPT, jsonPath, pptxPath], { timeout: 60000 }, (err, stdout, stderr) => {
      const cleanup = () => {
        try { if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath); } catch (_) {}
        try { if (fs.existsSync(pptxPath)) fs.unlinkSync(pptxPath); } catch (_) {}
      };
      if (err) {
        cleanup();
        return reject(new Error(stderr || err.message || 'PPTX export failed'));
      }
      try {
        const buffer = fs.readFileSync(pptxPath);
        cleanup();
        resolve(buffer);
      } catch (readErr) {
        cleanup();
        reject(readErr);
      }
    });
  });
}

function getClientPortalSessionEntry(req, token) {
  const bag = req.session && req.session.clientQuoteAuth;
  if (!bag || typeof bag !== 'object') return null;
  return bag[token] || null;
}

class ClientQuoteController {
  // POST /api/client-quotes (Authenticated Designer / Admin)
  async createQuote(req, res, next) {
    try {
      const created = await clientQuoteService.createQuote(req.user, req.body || {});
      const baseOrigin = `${req.protocol}://${req.get('host')}`;
      res.status(201).json({
        success: true,
        quote: created,
        sharePath: `/quote/${created.shareToken}`,
        shareUrl: `${baseOrigin}/quote/${created.shareToken}`
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/client-quotes/project/:projectId
  async listByProject(req, res, next) {
    try {
      const quotes = await clientQuoteService.listQuotesByProject(req.user, req.params.projectId);
      const baseOrigin = `${req.protocol}://${req.get('host')}`;
      res.json({
        success: true,
        quotes: quotes.map((q) => ({
          ...q,
          sharePath: `/quote/${q.shareToken}`,
          shareUrl: `${baseOrigin}/quote/${q.shareToken}`
        }))
      });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/client-quotes/:quoteId
  async updateQuote(req, res, next) {
    try {
      const updated = await clientQuoteService.updateQuote(req.user, req.params.quoteId, req.body || {});
      res.json({ success: true, quote: updated });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/client-quotes/:quoteId
  async deleteQuote(req, res, next) {
    try {
      await clientQuoteService.deleteQuote(req.user, req.params.quoteId);
      res.json({ success: true, message: 'Client quote link deleted' });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/client-quotes/export-pptx (Internal sales/designer PPTX export)
  async exportPptx(req, res, next) {
    try {
      const body = req.body || {};
      if (!Array.isArray(body.variantQuotes) || !body.variantQuotes.length) {
        return res.status(400).json({ success: false, error: 'At least one variant quote is required for PPTX export.' });
      }
      const buffer = await runPythonExport(body);
      const safeName = String(body.clientName || 'Cookscape_Quote').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'Cookscape_Quote';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Quotation.pptx"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  // ── Isolated Client Quote Portal Handlers (/api/client-portal/:token) ──

  async getPortalInfo(req, res, next) {
    try {
      const token = req.params.token;
      const entry = getClientPortalSessionEntry(req, token);
      const info = await clientQuoteService.getPortalPublicInfo(token, entry);
      res.setHeader('Cache-Control', 'no-store, private');
      res.json({ success: true, ...info });
    } catch (err) {
      next(err);
    }
  }

  async loginPortal(req, res, next) {
    try {
      const token = req.params.token;
      const { username, password } = req.body || {};
      const authEntry = await clientQuoteService.authenticatePortalClient(
        token,
        username,
        password,
        req.ip,
        req.get('user-agent')
      );
      if (req.session) {
        req.session.clientQuoteAuth = req.session.clientQuoteAuth || {};
        req.session.clientQuoteAuth[token] = authEntry;
      }
      res.json({
        success: true,
        clientName: authEntry.clientName,
        quoteCode: authEntry.quoteCode
      });
    } catch (err) {
      next(err);
    }
  }

  async logoutPortal(req, res) {
    const token = req.params.token;
    if (req.session && req.session.clientQuoteAuth) {
      delete req.session.clientQuoteAuth[token];
    }
    res.json({ success: true });
  }

  async getPortalPayload(req, res, next) {
    try {
      const token = req.params.token;
      const entry = getClientPortalSessionEntry(req, token);
      const payload = await clientQuoteService.getPortalDeckPayload(token, entry, req.ip);
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.json({ success: true, deck: payload });
    } catch (err) {
      next(err);
    }
  }

  async getPortalAsset(req, res, next) {
    try {
      const token = req.params.token;
      const entry = getClientPortalSessionEntry(req, token);
      const asset = await clientQuoteService.resolvePortalAsset(token, req.params.assetKey, entry);
      res.setHeader('Content-Type', asset.mime);
      res.setHeader('Content-Disposition', 'inline');
      res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
      res.send(asset.buffer);
    } catch (err) {
      next(err);
    }
  }

  async postAuditEvent(req, res, next) {
    try {
      const token = req.params.token;
      const entry = getClientPortalSessionEntry(req, token);
      if (!entry || entry.token !== token) {
        return res.status(401).json({ success: false, error: 'Unauthorized' });
      }
      const { event, detail } = req.body || {};
      await clientQuoteService.logPortalAuditEvent(token, event, detail, req.ip);
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ClientQuoteController();
