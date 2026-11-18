// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Auth Controller
// ═══════════════════════════════════════════════════════════════════════════════

const userService = require('../services/userService');
const { getDatabaseStatus } = require('../config/prisma');

const SESSION_DURATION_MS = 3 * 24 * 60 * 60 * 1000; // 3 days

class AuthController {
  // GET /api/status
  getStatus(req, res) {
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      db: getDatabaseStatus()
    });
  }

  // GET /api/me
  getCurrentUser(req, res) {
    if (!req.user || !req.session || !req.session.userId) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    if (req.session.loginExpiresAt && Date.now() > Number(req.session.loginExpiresAt)) {
      if (typeof req.session.destroy === 'function') {
        req.session.destroy(() => {});
      }
      res.clearCookie('orbix.sid', { path: '/' });
      return res.status(401).json({ success: false, error: 'Session expired. Please sign in again.' });
    }
    res.json({
      success: true,
      user: req.user,
      sessionExpiresAt: req.session.loginExpiresAt || (Date.now() + SESSION_DURATION_MS)
    });
  }

  // POST /api/login
  async login(req, res) {
    try {
      const { identifier, password } = req.body;
      if (!identifier || !password) {
        return res.status(400).json({
          success: false,
          error: 'Username/Email and Password are required.'
        });
      }

      const user = await userService.authenticateUser(identifier, password);
      if (!user) {
        return res.status(401).json({
          success: false,
          error: 'Invalid username/email or password.'
        });
      }

      req.session.regenerate((err) => {
        if (err) {
          console.error('Session regeneration error:', err);
          return res.status(500).json({ success: false, error: 'Session initialization error' });
        }

        const now = Date.now();
        const expiresAt = now + SESSION_DURATION_MS;
        req.session.userId = user.id;
        req.session.loginAt = now;
        req.session.loginExpiresAt = expiresAt;
        if (req.session.cookie) {
          req.session.cookie.maxAge = SESSION_DURATION_MS;
          req.session.cookie.expires = new Date(expiresAt);
        }
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return res.status(500).json({ success: false, error: 'Session persistence error' });
          }
          res.json({
            success: true,
            user,
            sessionExpiresAt: expiresAt,
            sessionDays: 3,
            message: 'Signed in successfully (session active for 3 days)'
          });
        });
      });
    } catch (err) {
      console.error('Login error:', err);
      res.status(500).json({ success: false, error: err.message || 'Internal server error' });
    }
  }

  // POST /api/logout
  logout(req, res) {
    if (!req.session || typeof req.session.destroy !== 'function') {
      res.clearCookie('orbix.sid', { path: '/' });
      return res.json({ success: true, message: 'Logged out successfully' });
    }
    req.session.destroy((err) => {
      if (err) {
        console.error('Logout error:', err);
        return res.status(500).json({ success: false, error: 'Logout failed' });
      }
      res.clearCookie('orbix.sid', { path: '/' });
      res.json({ success: true, message: 'Logged out successfully' });
    });
  }
}

module.exports = new AuthController();

