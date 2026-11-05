// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project Service (Prisma ORM)
// ═══════════════════════════════════════════════════════════════════════════════

const { prisma } = require('../config/prisma');

// Helper: Format project with top-level metadata accessors from project.data.details
function formatProject(p) {
  if (!p) return null;
  const d = (p.data && p.data.details) ? p.data.details : {};
  return {
    ...p,
    contact_number: p.contact_number || d.contactNumber || d.phone || '',
    location: p.location || d.location || d.siteAddress || '',
    bh_name: p.bh_name || d.bhName || d.designerName || '',
    date_time: p.date_time || d.dateTime || d.dateCreated || (p.createdAt ? p.createdAt.toISOString() : ''),
    cp_code: p.cp_code || d.cpCode || d.quoteId || ''
  };
}

class ProjectService {
  // 1. Get all accessible projects for user
  async getProjects(user) {
    let where = {};
    if (user && user.role !== 'admin') {
      where = {
        OR: [
          { createdBy: user.id },
          { isShared: true }
        ]
      };
    }

    const projects = await prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' }
    });
    return projects.map(formatProject);
  }

  // 2. Get project by ID
  async getProjectById(id, user) {
    if (!id) return null;

    const project = await prisma.project.findUnique({
      where: { id }
    });

    if (!project) return null;

    // Authorization check
    if (user && user.role !== 'admin') {
      const isOwner = project.createdBy === user.id;
      const isShared = project.isShared;
      if (!isOwner && !isShared) {
        throw new Error('Access denied: You do not have permission to view this project');
      }
    }

    return formatProject(project);
  }

  // 3. Create new project
  async createProject(projectData, user) {
    const id = projectData.id || ('proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6));
    const title = (projectData.title || 'Untitled CAD Project').trim();
    const client = (projectData.client || '').trim();
    const type = projectData.type || 'Wardrobe';
    const status = projectData.status || 'Draft';

    const ownerName = user ? user.name : (projectData.owner_name || projectData.ownerName || 'Modular Designer');
    const ownerEmail = user ? user.email : (projectData.owner_email || projectData.ownerEmail || 'designer@orbixstudio.io');
    const rawCreatedBy = user ? user.id : (projectData.created_by || projectData.createdBy || null);

    // Verify rawCreatedBy exists in PostgreSQL users table to prevent FK constraint failure
    let createdBy = null;
    if (rawCreatedBy) {
      try {
        const userExists = await prisma.user.findUnique({
          where: { id: rawCreatedBy },
          select: { id: true }
        });
        if (userExists) createdBy = rawCreatedBy;
      } catch (_) {
        createdBy = null;
      }
    }

    const unitsCount = parseInt(projectData.units_count ?? projectData.unitsCount ?? 0, 10);
    const boardsEst = parseInt(projectData.boards_est ?? projectData.boardsEst ?? 0, 10);
    const data = projectData.data || {};

    const created = await prisma.project.create({
      data: {
        id,
        title,
        client,
        type,
        status,
        createdBy,
        ownerName,
        ownerEmail,
        unitsCount,
        boardsEst,
        data,
        isShared: projectData.is_shared ?? projectData.isShared ?? false,
        forkCount: projectData.fork_count ?? projectData.forkCount ?? 0
      }
    });

    return formatProject(created);
  }

  // 4. Update existing project
  async updateProject(id, updates, user) {
    if (!id) throw new Error('Project ID is required');

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) throw new Error('Project not found');

    // Access control
    if (user && user.role !== 'admin' && existing.createdBy !== user.id) {
      throw new Error('Access denied: Only project owners or administrators can edit projects');
    }

    const data = {};
    if (updates.title !== undefined) data.title = updates.title.trim();
    if (updates.client !== undefined) data.client = updates.client.trim();
    if (updates.type !== undefined) data.type = updates.type;
    if (updates.status !== undefined) data.status = updates.status;
    if (updates.units_count !== undefined || updates.unitsCount !== undefined) {
      data.unitsCount = parseInt(updates.units_count ?? updates.unitsCount, 10);
    }
    if (updates.boards_est !== undefined || updates.boardsEst !== undefined) {
      data.boardsEst = parseInt(updates.boards_est ?? updates.boardsEst, 10);
    }
    if (updates.data !== undefined) {
      data.data = updates.data;
    }
    if (updates.is_shared !== undefined || updates.isShared !== undefined) {
      data.isShared = updates.is_shared ?? updates.isShared;
    }
    if (updates.fork_count !== undefined || updates.forkCount !== undefined) {
      data.forkCount = parseInt(updates.fork_count ?? updates.forkCount, 10);
    }

    return prisma.project.update({
      where: { id },
      data
    });
  }

  // 5. Delete project
  async deleteProject(id, user) {
    if (!id) throw new Error('Project ID is required');

    const existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) throw new Error('Project not found');

    if (user && user.role !== 'admin' && existing.createdBy !== user.id) {
      throw new Error('Access denied: Only project owners or administrators can delete projects');
    }

    await prisma.project.delete({ where: { id } });
    return { success: true, id };
  }

  // 6. Fork / Duplicate Project
  async forkProject(id, user) {
    const original = await this.getProjectById(id, user);
    if (!original) throw new Error('Original project not found');

    const newId = 'proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newTitle = `${original.title} (Copy)`;

    const forked = await prisma.project.create({
      data: {
        id: newId,
        title: newTitle,
        client: original.client,
        type: original.type,
        status: 'Draft',
        createdBy: user ? user.id : null,
        ownerName: user ? user.name : 'Modular Designer',
        ownerEmail: user ? user.email : 'designer@orbixstudio.io',
        unitsCount: original.unitsCount,
        boardsEst: original.boardsEst,
        data: original.data,
        isShared: false,
        forkCount: 0
      }
    });

    // Record fork relationship
    await prisma.projectFork.create({
      data: {
        originalProjectId: original.id,
        forkedProjectId: forked.id,
        forkedBy: user ? user.id : null,
        forkedToName: user ? user.name : 'Modular Designer',
        forkedToEmail: user ? user.email : 'designer@orbixstudio.io'
      }
    });

    // Increment original fork count
    await prisma.project.update({
      where: { id: original.id },
      data: { forkCount: { increment: 1 } }
    });

    return forked;
  }
}

module.exports = new ProjectService();

