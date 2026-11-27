// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project Controller (CRUD)
// ═══════════════════════════════════════════════════════════════════════════════

const projectService = require('../services/projectService');
const userService = require('../services/userService');

class ProjectController {
  // GET /api/projects (supports optional ?limit=&offset= for lazy-loaded first-paint & pagination)
  async getAll(req, res) {
    try {
      const q = req.query || {};
      const hasLimit = q.limit !== undefined && q.limit !== '';
      if (hasLimit) {
        const result = await projectService.getProjects(req.user, {
          limit: q.limit,
          offset: q.offset || 0
        });
        return res.json({
          success: true,
          projects: (result && result.projects) || [],
          total: (result && typeof result.total === 'number') ? result.total : 0,
          limit: result && result.limit,
          offset: result && result.offset,
          hasMore: !!(result && result.hasMore)
        });
      }
      const projects = await projectService.getProjects(req.user);
      const list = Array.isArray(projects) ? projects : [];
      res.json({ success: true, projects: list, total: list.length, hasMore: false });
    } catch (err) {
      console.error('getProjects error:', err);
      res.status(500).json({ success: false, error: err.message, projects: [] });
    }
  }

  // GET /api/projects/:id
  async getById(req, res) {
    try {
      const project = await projectService.getProjectById(req.params.id, req.user);
      if (!project) {
        return res.status(404).json({ success: false, error: 'Project not found' });
      }
      res.json(project);
    } catch (err) {
      console.error('getProject error:', err);
      const isForbidden = err.message && err.message.includes('Access denied');
      res.status(isForbidden ? 403 : 500).json({ success: false, error: err.message });
    }
  }

  // POST /api/projects
  async create(req, res) {
    try {
      if (!req.body || !req.body.title) {
        return res.status(400).json({ success: false, error: 'Project title is required' });
      }
      const project = await projectService.createProject(req.body, req.user);
      res.status(201).json({ success: true, project });
    } catch (err) {
      console.error('createProject error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  }

  // PUT /api/projects/:id
  async update(req, res) {
    try {
      const updated = await projectService.updateProject(req.params.id, req.body, req.user);
      res.json({ success: true, project: updated });
    } catch (err) {
      const isNotFound = err.message && err.message.includes('Project not found');
      if (isNotFound) {
        return res.status(404).json({ success: false, error: err.message });
      }
      console.error('updateProject error:', err);
      const isForbidden = err.message && err.message.includes('Access denied');
      res.status(isForbidden ? 403 : 400).json({ success: false, error: err.message });
    }
  }

  // DELETE /api/projects/:id
  async delete(req, res) {
    try {
      const result = await projectService.deleteProject(req.params.id, req.user);
      res.json(result);
    } catch (err) {
      const isNotFound = err.message && err.message.includes('Project not found');
      if (isNotFound) {
        return res.status(404).json({ success: false, error: err.message });
      }
      console.error('deleteProject error:', err);
      const isForbidden = err.message && err.message.includes('Access denied');
      res.status(isForbidden ? 403 : 400).json({ success: false, error: err.message });
    }
  }

  // POST /api/projects/:id/fork
  async fork(req, res) {
    try {
      let targetUser = req.user;
      const requestedColleagueId = req.body && req.body.colleagueUser && req.body.colleagueUser.id;
      if (requestedColleagueId && requestedColleagueId !== req.user.id) {
        const lookedUp = await userService.getUserById(String(requestedColleagueId));
        if (!lookedUp) {
          return res.status(404).json({ success: false, error: 'Target colleague account not found' });
        }
        targetUser = lookedUp;
      }
      const forked = await projectService.forkProject(req.params.id, targetUser, req.user);
      res.status(201).json({ success: true, project: forked });
    } catch (err) {
      console.error('forkProject error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new ProjectController();

