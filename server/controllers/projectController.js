// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project Controller (CRUD)
// ═══════════════════════════════════════════════════════════════════════════════

const projectService = require('../services/projectService');

class ProjectController {
  // GET /api/projects
  async getAll(req, res) {
    try {
      const projects = await projectService.getProjects(req.user);
      res.json(projects);
    } catch (err) {
      console.error('getProjects error:', err);
      res.status(500).json({ success: false, error: err.message });
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
      console.error('deleteProject error:', err);
      const isForbidden = err.message && err.message.includes('Access denied');
      res.status(isForbidden ? 403 : 400).json({ success: false, error: err.message });
    }
  }

  // POST /api/projects/:id/fork
  async fork(req, res) {
    try {
      const forked = await projectService.forkProject(req.params.id, req.user);
      res.status(201).json({ success: true, project: forked });
    } catch (err) {
      console.error('forkProject error:', err);
      res.status(400).json({ success: false, error: err.message });
    }
  }
}

module.exports = new ProjectController();
