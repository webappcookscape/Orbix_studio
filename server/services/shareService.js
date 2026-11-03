// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project Share Service (Prisma ORM)
// ═══════════════════════════════════════════════════════════════════════════════

const crypto = require('crypto');
const { prisma } = require('../config/prisma');

class ShareService {
  // 1. Create a share link for a project
  async createShare(projectId, user, options = {}) {
    if (!projectId) throw new Error('Project ID is required');

    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project) throw new Error('Project not found');

    if (user && user.role !== 'admin' && project.createdBy !== user.id) {
      throw new Error('Access denied: Only project owners or administrators can share projects');
    }

    // Check if an existing active share token exists
    let share = await prisma.projectShare.findFirst({
      where: { projectId }
    });

    if (!share) {
      const shareToken = 'sh_' + crypto.randomBytes(12).toString('hex');
      const shareId = 'shr_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);

      share = await prisma.projectShare.create({
        data: {
          id: shareId,
          projectId,
          sharedBy: user ? user.id : project.createdBy,
          sharedToEmail: options.sharedToEmail || null,
          permission: options.permission || 'copy',
          shareToken
        }
      });
    }

    // Mark project as shared
    if (!project.isShared) {
      await prisma.project.update({
        where: { id: projectId },
        data: { isShared: true }
      });
    }

    return {
      shareId: share.id,
      shareToken: share.shareToken,
      projectId: project.id,
      permission: share.permission,
      project
    };
  }

  // 2. Resolve shared project by share token
  async getSharedProject(shareToken) {
    if (!shareToken) throw new Error('Share token is required');

    const share = await prisma.projectShare.findUnique({
      where: { shareToken },
      include: {
        project: true
      }
    });

    if (!share || !share.project) {
      throw new Error('Shared project link is invalid or has expired');
    }

    return {
      shareToken: share.shareToken,
      permission: share.permission,
      sharedAt: share.createdAt,
      project: share.project
    };
  }

  // 3. Make an isolated copy from a share token (accept share)
  async copySharedProject(shareToken, user) {
    const shareInfo = await this.getSharedProject(shareToken);
    const sourceProject = shareInfo.project;

    const newId = 'proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const newTitle = `${sourceProject.title} (Fork)`;

    const forked = await prisma.project.create({
      data: {
        id: newId,
        title: newTitle,
        client: sourceProject.client,
        type: sourceProject.type,
        status: 'Draft',
        createdBy: user ? user.id : null,
        ownerName: user ? user.name : 'Cookscape Designer',
        ownerEmail: user ? user.email : 'designer@cookscape.com',
        unitsCount: sourceProject.unitsCount,
        boardsEst: sourceProject.boardsEst,
        data: sourceProject.data,
        isShared: false,
        forkCount: 0
      }
    });

    // Record fork in project_forks
    await prisma.projectFork.create({
      data: {
        id: 'frk_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
        originalProjectId: sourceProject.id,
        forkedProjectId: forked.id,
        forkedBy: user ? user.id : null,
        forkedToName: user ? user.name : 'Cookscape Designer',
        forkedToEmail: user ? user.email : 'designer@cookscape.com'
      }
    });

    // Increment fork count on source project
    await prisma.project.update({
      where: { id: sourceProject.id },
      data: { forkCount: { increment: 1 } }
    });

    return forked;
  }
}

module.exports = new ShareService();

