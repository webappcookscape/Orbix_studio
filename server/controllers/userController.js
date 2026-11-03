// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — User Controller (CRUD)
// ═══════════════════════════════════════════════════════════════════════════════

const userService = require('../services/userService');

class UserController {
  // GET /api/users
  async getAll(req, res) {
    try {
      const users = await userService.getAllUsers();
      res.json(users);
    } catch (err) {
      console.error('getUsers error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // GET /api/users/:id
  async getById(req, res) {
    try {
      const { id } = req.params;
      if (req.user.role !== 'admin' && req.user.id !== id) {
        return res.status(403).json({ success: false, error: 'Forbidden: Access denied' });
      }

      const user = await userService.getUserById(id);
      if (!user) {
        return res.status(404).json({ success: false, error: 'User not found' });
      }
      res.json(user);
    } catch (err) {
      console.error('getUser error:', err);
      res.status(500).json({ success: false, error: err.message });
    }
  }

  // POST /api/users (Admin Only)
  async create(req, res) {
    try {
      const user = await userService.createUser(req.body);
      res.status(201).json({ success: true, user });
    } catch (err) {
      console.error('createUser error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // PUT /api/users/:id (Admin Only)
  async update(req, res) {
    try {
      const updated = await userService.updateUser(req.params.id, req.body);
      res.json({ success: true, user: updated });
    } catch (err) {
      console.error('updateUser error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // DELETE /api/users/:id (Admin Only)
  async delete(req, res) {
    try {
      const result = await userService.deleteUser(req.params.id);
      res.json({ success: true, result });
    } catch (err) {
      console.error('deleteUser error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new UserController();
