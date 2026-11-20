// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Client Quote, Head Approval & Protected Client Portal Controller
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const clientQuoteService = require('../services/clientQuoteService');

const ROOT_DIR = path.join(__dirname, '../..');
const PPTX_SCRIPT = path.join(ROOT_DIR, 'scripts', 'export_quote_pptx.py');
const PDF_SCRIPT = path.join(ROOT_DIR, 'scripts', 'export_quote_pdf.py');

function runPythonScript(scriptPath, payloadObj, ext) {
  return new Promise((resolve, reject) => {
    const tmpId = crypto.randomBytes(8).toString('hex');
    const jsonPath = path.join(os.tmpdir(), `orbix_q_${tmpId}.json`);
    const outPath = path.join(os.tmpdir(), `orbix_q_${tmpId}.${ext}`);

    fs.writeFileSync(jsonPath, JSON.stringify(payloadObj), 'utf8');
    const pyBin = process.platform === 'win32' ? 'python' : 'python3';

    execFile(pyBin, [scriptPath, jsonPath, outPath], { timeout: 60000 }, (err, stdout, stderr) => {
      const cleanup = () => {
        try { if (fs.existsSync(jsonPath)) fs.unlinkSync(jsonPath); } catch (_) {}
        try { if (fs.existsSync(outPath)) fs.unlinkSync(outPath); } catch (_) {}
      };
      if (err) {
        cleanup();
        return reject(new Error(stderr || err.message || `${ext.toUpperCase()} export failed`));
      }
      try {
        const buffer = fs.readFileSync(outPath);
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

function decorateUrls(req, q) {
  const baseOrigin = `${req.protocol}://${req.get('host')}`;
  const reviewPath = q.reviewToken ? `/quote-review/${q.reviewToken}` : '';
  const sharePath = q.shareToken ? `/quote/${q.shareToken}` : '';
  return {
    ...q,
    reviewPath,
    reviewUrl: reviewPath ? `${baseOrigin}${reviewPath}` : '',
    sharePath,
    shareUrl: sharePath ? `${baseOrigin}${sharePath}` : ''
  };
}

class ClientQuoteController {
  // POST /api/client-quotes/review (Stage 1: Password-free Head Review Link)
  async createReviewQuote(req, res, next) {
    try {
      const created = await clientQuoteService.createReviewQuote(req.user, req.body || {});
      const dec = decorateUrls(req, created);
      res.status(201).json({
        success: true,
        quote: dec,
        reviewPath: dec.reviewPath,
        reviewUrl: dec.reviewUrl
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/client-quotes (Authenticated Designer / Admin)
  async createQuote(req, res, next) {
    try {
      const created = await clientQuoteService.createQuote(req.user, req.body || {});
      const dec = decorateUrls(req, created);
      res.status(201).json({
        success: true,
        quote: dec,
        reviewPath: dec.reviewPath,
        reviewUrl: dec.reviewUrl,
        sharePath: dec.sharePath,
        shareUrl: dec.shareUrl
      });
    } catch (err) {
      next(err);
    }
  }

  // POST /api/client-quotes/:quoteId/activate-client-link (Stage 3: Post-Approval Full Client Link)
  async activateClientLink(req, res, next) {
    try {
      const updated = await clientQuoteService.activateClientLink(req.user, req.params.quoteId, req.body || {});
      const dec = decorateUrls(req, updated);
      res.json({
        success: true,
        quote: dec,
        sharePath: dec.sharePath,
        shareUrl: dec.shareUrl
      });
    } catch (err) {
      next(err);
    }
  }

  // GET /api/client-quotes/project/:projectId
  async listByProject(req, res, next) {
    try {
      const quotes = await clientQuoteService.listQuotesByProject(req.user, req.params.projectId);
      res.json({
        success: true,
        quotes: quotes.map((q) => decorateUrls(req, q))
      });
    } catch (err) {
      next(err);
    }
  }

  // PATCH /api/client-quotes/:quoteId
  async updateQuote(req, res, next) {
    try {
      const updated = await clientQuoteService.updateQuote(req.user, req.params.quoteId, req.body || {});
      res.json({ success: true, quote: decorateUrls(req, updated) });
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

  // POST /api/client-quotes/export-pptx (Direct payload PPTX export)
  async exportPptx(req, res, next) {
    try {
      const body = req.body || {};
      if (!Array.isArray(body.variantQuotes) || !body.variantQuotes.length) {
        return res.status(400).json({ success: false, error: 'At least one variant quote is required for PPTX export.' });
      }
      const buffer = await runPythonScript(PPTX_SCRIPT, body, 'pptx');
      const safeName = String(body.clientName || 'Cookscape_Quote').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'Cookscape_Quote';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Quotation.pptx"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/client-quotes/export-pdf (Direct payload Full PDF export)
  async exportPdf(req, res, next) {
    try {
      const body = req.body || {};
      if (!Array.isArray(body.variantQuotes) || !body.variantQuotes.length) {
        return res.status(400).json({ success: false, error: 'At least one variant quote is required for PDF export.' });
      }
      const buffer = await runPythonScript(PDF_SCRIPT, body, 'pdf');
      const safeName = String(body.clientName || 'Cookscape_Quote').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'Cookscape_Quote';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Quotation.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/client-quotes/:quoteId/export-pptx (Approved Quote Full PPTX)
  async exportQuotePptxById(req, res, next) {
    try {
      const payload = await clientQuoteService.getQuoteExportPayload(req.user, req.params.quoteId);
      const buffer = await runPythonScript(PPTX_SCRIPT, payload, 'pptx');
      const safeName = String(payload.clientName || 'Cookscape_Quote').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'Cookscape_Quote';
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.presentationml.presentation');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Approved_Quotation.pptx"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  // POST /api/client-quotes/:quoteId/export-pdf (Approved Quote Full PDF)
  async exportQuotePdfById(req, res, next) {
    try {
      const payload = await clientQuoteService.getQuoteExportPayload(req.user, req.params.quoteId);
      const buffer = await runPythonScript(PDF_SCRIPT, payload, 'pdf');
      const safeName = String(payload.clientName || 'Cookscape_Quote').replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40) || 'Cookscape_Quote';
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${safeName}_Approved_Quotation.pdf"`);
      res.setHeader('Cache-Control', 'no-store');
      res.send(buffer);
    } catch (err) {
      next(err);
    }
  }

  // ── Public Password-Free Head Review Handlers (/api/quote-review/:reviewToken) ──

  async getReviewByToken(req, res, next) {
    try {
      const review = await clientQuoteService.getReviewPayload(req.params.reviewToken);
      res.setHeader('Cache-Control', 'no-store, private');
      res.json({ success: true, review });
    } catch (err) {
      next(err);
    }
  }

  async approveReviewByToken(req, res, next) {
    try {
      const review = await clientQuoteService.approveReviewQuote(req.params.reviewToken, req.body || {}, req.ip);
      res.json({ success: true, review });
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
        quoteCode: authEntry.quoteCode,
        whatsappAlert: authEntry.whatsappAlert || null
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
