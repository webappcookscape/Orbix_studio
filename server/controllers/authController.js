// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Auth Controller
// ═══════════════════════════════════════════════════════════════════════════════

const userService = require('../services/userService');
const { getDatabaseStatus } = require('../config/prisma');

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
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'Not authenticated' });
    }
    res.json({ success: true, user: req.user });
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

        req.session.userId = user.id;
        req.session.save((saveErr) => {
          if (saveErr) {
            console.error('Session save error:', saveErr);
            return res.status(500).json({ success: false, error: 'Session persistence error' });
          }
          res.json({
            success: true,
            user,
            message: 'Signed in successfully'
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
