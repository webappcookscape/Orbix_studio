// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project Share Controller
// ═══════════════════════════════════════════════════════════════════════════════

const shareService = require('../services/shareService');

class ShareController {
  // POST /api/projects/:id/share
  async createShare(req, res) {
    try {
      const share = await shareService.createShare(req.params.id, req.user, req.body);
      res.json({
        success: true,
        shareId: share.shareId,
        shareToken: share.shareToken,
        shareUrl: `/share/${share.shareToken}`,
        permission: share.permission
      });
    } catch (err) {
      console.error('createShare error:', err);
      const isForbidden = err.message && err.message.includes('Access denied');
      res.status(isForbidden ? 403 : 400).json({ success: false, error: err.message });
    }
  }

  // GET /api/share/:token
  async getShare(req, res) {
    try {
      const share = await shareService.getSharedProject(req.params.token);
      res.json(share);
    } catch (err) {
      console.error('getShare error:', err);
      res.status(404).json({ success: false, error: err.message });
    }
  }

  // POST /api/share/:token/copy
  async copyShare(req, res) {
    try {
      const forked = await shareService.copySharedProject(req.params.token, req.user);
      res.status(201).json({ success: true, project: forked });
    } catch (err) {
      console.error('copyShare error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new ShareController();
