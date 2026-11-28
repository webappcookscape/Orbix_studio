// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Application Logs Controller (admin@cookscape.com ONLY)
// Supports List & Delete ONLY (NO Edit).
// ═══════════════════════════════════════════════════════════════════════════════

const activityLogService = require('../services/activityLogService');

class LogController {
  // GET /api/logs
  async listLogs(req, res, next) {
    try {
      const q = req.query || {};
      const result = await activityLogService.listLogs({
        date: q.date,
        from: q.from,
        to: q.to,
        category: q.category,
        search: q.search,
        limit: q.limit
      });
      res.setHeader('Cache-Control', 'no-store, private');
      res.json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/logs/:id
  async deleteLog(req, res, next) {
    try {
      const result = await activityLogService.deleteLogById(req.params.id);
      res.json({ success: true, deleted: result.deleted });
    } catch (err) {
      next(err);
    }
  }

  // DELETE /api/logs (by ?date=YYYY-MM-DD or body { ids: [...] })
  async bulkDeleteLogs(req, res, next) {
    try {
      const ids = (req.body && Array.isArray(req.body.ids)) ? req.body.ids : [];
      const date = (req.query && req.query.date) || (req.body && req.body.date) || '';
      if (!ids.length && !date) {
        return res.status(400).json({ success: false, error: 'Provide log ids or date to delete.' });
      }
      const result = await activityLogService.deleteLogs({ ids, date });
      res.json({ success: true, deleted: result.deleted });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new LogController();
