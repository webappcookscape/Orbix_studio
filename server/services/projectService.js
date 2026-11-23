// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Project Service (Prisma ORM)
// ═══════════════════════════════════════════════════════════════════════════════

const { prisma } = require('../config/prisma');

function extractPlanNode(dataObj) {
  if (!dataObj || typeof dataObj !== 'object') return null;
  if (dataObj.plan && typeof dataObj.plan === 'object') {
    if (dataObj.plan.plan && typeof dataObj.plan.plan === 'object') {
      return { rootPlan: dataObj.plan, innerPlan: dataObj.plan.plan };
    }
    return { rootPlan: dataObj.plan, innerPlan: dataObj.plan };
  }
  return null;
}

function getPlanIntegrityStats(dataObj) {
  const stats = {
    hasPlan: false,
    walls: 0,
    furniture: 0,
    openings: 0,
    rooms: 0,
    stairs: 0,
    totalElements: 0,
    lastModified: 0,
    saveSeq: 0
  };
  if (!dataObj || typeof dataObj !== 'object') return stats;
  const node = extractPlanNode(dataObj);
  if (node) {
    stats.hasPlan = true;
    const inner = node.innerPlan || {};
    const rootP = node.rootPlan || {};
    stats.walls = Array.isArray(inner.walls) ? inner.walls.length : 0;
    stats.furniture = Array.isArray(inner.furniture) ? inner.furniture.length : 0;
    stats.openings = Array.isArray(inner.openings) ? inner.openings.length : 0;
    stats.rooms = Array.isArray(inner.rooms) ? inner.rooms.length : 0;
    stats.stairs = Array.isArray(inner.stairs) ? inner.stairs.length : 0;

    // Also inspect multi-floor floorsData so elements on non-active floors are counted
    if (inner.floorsData && typeof inner.floorsData === 'object') {
      let floorWalls = 0;
      let floorFurn = 0;
      let floorOpenings = 0;
      let floorStairs = 0;
      for (const fKey of Object.keys(inner.floorsData)) {
        const fd = inner.floorsData[fKey];
        if (!fd || typeof fd !== 'object') continue;
        if (Array.isArray(fd.walls)) floorWalls += fd.walls.length;
        if (Array.isArray(fd.furniture)) floorFurn += fd.furniture.length;
        if (Array.isArray(fd.openings)) floorOpenings += fd.openings.length;
        if (Array.isArray(fd.stairs)) floorStairs += fd.stairs.length;
      }
      if (floorWalls > stats.walls) stats.walls = floorWalls;
      if (floorFurn > stats.furniture) stats.furniture = floorFurn;
      if (floorOpenings > stats.openings) stats.openings = floorOpenings;
      if (floorStairs > stats.stairs) stats.stairs = floorStairs;
    }

    const lm = Number(rootP._lastModified || inner._lastModified || dataObj._lastModified || 0);
    if (Number.isFinite(lm) && lm > 0) stats.lastModified = lm;
    const seq = Number(rootP._saveSeq || dataObj._saveSeq || 0);
    if (Number.isFinite(seq) && seq > 0) stats.saveSeq = seq;
  }
  if (stats.furniture === 0 && Array.isArray(dataObj.units) && dataObj.units.length > 0) {
    stats.furniture = dataObj.units.length;
  }
  stats.totalElements = stats.walls + stats.furniture + stats.openings + stats.stairs;
  return stats;
}

function isExplicitDestructiveUpdate(updates) {
  if (!updates || typeof updates !== 'object') return false;
  if (updates.allowEmptyPlan === true || updates.allowDestructive === true) return true;
  const rawAction = updates.changeAction || updates.action || (updates.data && updates.data._changeAction) || '';
  const act = (typeof rawAction === 'object' && rawAction !== null ? (rawAction.actionName || '') : String(rawAction)).toLowerCase().trim();
  if (!act) return false;
  return (
    act === 'clear_all' ||
    act === 'user_delete_all' ||
    act === 'clear plan' ||
    act === 'delete' ||
    act === 'delete_selected' ||
    act === 'delete_furniture' ||
    act === 'delete furniture' ||
    act === 'undo' ||
    act === 'redo' ||
    act === 'reset_project' ||
    act.indexOf('clear') !== -1 ||
    act.indexOf('delete') !== -1
  );
}

// Helper: Format project with top-level metadata accessors from project.data.details
function formatProject(p) {
  if (!p) return null;
  const d = (p.data && p.data.details) ? p.data.details : {};
  let dateVal = p.date_time || d.dateTime || d.dateCreated || '';
  if (!dateVal && p.createdAt) {
    dateVal = typeof p.createdAt.toISOString === 'function' ? p.createdAt.toISOString() : String(p.createdAt);
  }
  const createdAtStr = p.created_at || (p.createdAt ? (typeof p.createdAt.toISOString === 'function' ? p.createdAt.toISOString() : String(p.createdAt)) : dateVal);
  const updatedAtStr = p.updated_at || (p.updatedAt ? (typeof p.updatedAt.toISOString === 'function' ? p.updatedAt.toISOString() : String(p.updatedAt)) : createdAtStr);

  return {
    ...p,
    title: p.title || p.name || '',
    name: p.name || p.title || '',
    owner_name: p.owner_name || p.ownerName || '',
    owner_email: p.owner_email || p.ownerEmail || '',
    ownerName: p.ownerName || p.owner_name || '',
    ownerEmail: p.ownerEmail || p.owner_email || '',
    created_by: p.created_by || p.createdBy || '',
    createdBy: p.createdBy || p.created_by || '',
    units_count: p.units_count !== undefined ? p.units_count : (p.unitsCount ?? 0),
    boards_est: p.boards_est !== undefined ? p.boards_est : (p.boardsEst ?? 0),
    unitsCount: p.unitsCount !== undefined ? p.unitsCount : (p.units_count ?? 0),
    boardsEst: p.boardsEst !== undefined ? p.boardsEst : (p.boards_est ?? 0),
    is_shared: p.is_shared !== undefined ? p.is_shared : (p.isShared ?? false),
    isShared: p.isShared !== undefined ? p.isShared : (p.is_shared ?? false),
    fork_count: p.fork_count !== undefined ? p.fork_count : (p.forkCount ?? 0),
    forkCount: p.forkCount !== undefined ? p.forkCount : (p.fork_count ?? 0),
    created_at: createdAtStr,
    updated_at: updatedAtStr,
    createdAt: p.createdAt || createdAtStr,
    updatedAt: p.updatedAt || updatedAtStr,
    contact_number: p.contact_number || d.contactNumber || d.phone || '',
    location: p.location || d.location || d.siteAddress || '',
    bh_name: p.bh_name || d.bhName || d.designerName || '',
    date_time: dateVal,
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
    const incomingData = (projectData.data && typeof projectData.data === 'object') ? projectData.data : {};
    const incomingDetails = incomingData.details || (incomingData.plan && incomingData.plan.meta) || {};
    const mergedDetails = {
      clientName: client || incomingDetails.clientName || '',
      contactNumber: projectData.contact_number || incomingDetails.contactNumber || incomingDetails.phone || '',
      phone: projectData.contact_number || incomingDetails.contactNumber || incomingDetails.phone || '',
      location: projectData.location || incomingDetails.location || incomingDetails.siteAddress || '',
      siteAddress: projectData.location || incomingDetails.location || incomingDetails.siteAddress || '',
      bhName: projectData.bh_name || incomingDetails.bhName || incomingDetails.designerName || ownerName,
      designerName: projectData.bh_name || incomingDetails.bhName || incomingDetails.designerName || ownerName,
      cpCode: projectData.cp_code || incomingDetails.cpCode || incomingDetails.quoteId || '',
      quoteId: projectData.cp_code || incomingDetails.cpCode || incomingDetails.quoteId || '',
      dateTime: projectData.date_time || incomingDetails.dateTime || incomingDetails.dateCreated || new Date().toISOString(),
      dateCreated: projectData.date_time || incomingDetails.dateTime || incomingDetails.dateCreated || new Date().toISOString(),
      ...incomingDetails
    };
    const finalData = {
      ...incomingData,
      details: mergedDetails
    };
    if (finalData.plan && typeof finalData.plan === 'object') {
      finalData.plan.meta = Object.assign({}, finalData.plan.meta || {}, {
        clientName: mergedDetails.clientName,
        phone: mergedDetails.phone,
        contactNumber: mergedDetails.contactNumber,
        siteAddress: mergedDetails.siteAddress,
        siteLocation: mergedDetails.location,
        location: mergedDetails.location,
        bhName: mergedDetails.bhName,
        designerName: mergedDetails.designerName,
        cpCode: mergedDetails.cpCode,
        quoteId: mergedDetails.quoteId,
        dateTime: mergedDetails.dateTime,
        dateCreated: mergedDetails.dateCreated
      });
    }

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
        data: finalData,
        isShared: projectData.is_shared ?? projectData.isShared ?? false,
        forkCount: projectData.fork_count ?? projectData.forkCount ?? 0
      }
    });

    return formatProject(created);
  }

  // 4. Update existing project with Zero-Loss Protection & Rolling Revisions
  async updateProject(id, updates, user) {
    if (!id) throw new Error('Project ID is required');

    let existing = await prisma.project.findUnique({ where: { id } });
    if (!existing) {
      // Zero-Loss Upsert: If the project does not exist on the server yet (e.g. created locally
      // while offline or during initial startup), auto-create it rather than failing with 404!
      console.log(`[ProjectService] Project ${id} not found on server during update; auto-upserting...`);
      return await this.createProject({ id, ...updates }, user);
    }

    // Access control
    if (user && user.role !== 'admin' && existing.createdBy !== user.id) {
      throw new Error('Access denied: Only project owners or administrators can edit projects');
    }

    const incomingData = (updates.data && typeof updates.data === 'object') ? updates.data : {};
    const incomingDetails = incomingData.details || (incomingData.plan && incomingData.plan.meta) || {};

    const data = {};
    if (updates.title !== undefined) data.title = updates.title.trim();
    else if (incomingDetails.title) data.title = incomingDetails.title.trim();

    if (updates.client !== undefined) data.client = updates.client.trim();
    else if (incomingDetails.clientName) data.client = incomingDetails.clientName.trim();

    if (updates.type !== undefined) data.type = updates.type;
    if (updates.status !== undefined) data.status = updates.status;

    if (updates.units_count !== undefined || updates.unitsCount !== undefined) {
      data.unitsCount = parseInt(updates.units_count ?? updates.unitsCount, 10);
    }
    if (updates.boards_est !== undefined || updates.boardsEst !== undefined) {
      data.boardsEst = parseInt(updates.boards_est ?? updates.boardsEst, 10);
    }

    let planPreserved = false;
    if (updates.data !== undefined && updates.data && typeof updates.data === 'object') {
      const existingData = (existing.data && typeof existing.data === 'object') ? existing.data : {};
      const existingStats = getPlanIntegrityStats(existingData);
      const incomingStats = getPlanIntegrityStats(incomingData);
      const allowDestructive = isExplicitDestructiveUpdate(updates);

      // Start from a safe merge so metadata-only updates NEVER wipe existing plan/units/details
      const mergedData = Object.assign({}, existingData, incomingData);

      // Merge and protect details metadata against stale overwrites
      const existingDetails = (existingData.details && typeof existingData.details === 'object') ? existingData.details : {};
      const incDet = (incomingData.details && typeof incomingData.details === 'object') ? incomingData.details : incomingDetails;
      const mergedDetails = Object.assign({}, existingDetails, incDet);

      const clientName = updates.client || incDet.clientName || (existingDetails && existingDetails.clientName) || existing.client || '';
      const contactNum = updates.contact_number || incDet.contactNumber || incDet.phone || (existingDetails && (existingDetails.contactNumber || existingDetails.phone)) || existing.contact_number || '';
      const locationStr = updates.location || incDet.location || incDet.siteAddress || (existingDetails && (existingDetails.location || existingDetails.siteAddress)) || existing.location || '';
      const bhNameStr = updates.bh_name || incDet.bhName || incDet.designerName || (existingDetails && (existingDetails.bhName || existingDetails.designerName)) || existing.bh_name || '';
      const cpCodeStr = updates.cp_code || incDet.cpCode || incDet.quoteId || (existingDetails && (existingDetails.cpCode || existingDetails.quoteId)) || existing.cp_code || '';
      const dateTimeStr = updates.date_time || incDet.dateTime || incDet.dateCreated || (existingDetails && (existingDetails.dateTime || existingDetails.dateCreated)) || existing.date_time || '';

      if (clientName) mergedDetails.clientName = clientName;
      if (contactNum) {
        mergedDetails.contactNumber = contactNum;
        mergedDetails.phone = contactNum;
      }
      if (locationStr) {
        mergedDetails.location = locationStr;
        mergedDetails.siteAddress = locationStr;
      }
      if (bhNameStr) {
        mergedDetails.bhName = bhNameStr;
        mergedDetails.designerName = bhNameStr;
      }
      if (cpCodeStr) {
        mergedDetails.cpCode = cpCodeStr;
        mergedDetails.quoteId = cpCodeStr;
      }
      if (dateTimeStr) {
        mergedDetails.dateTime = dateTimeStr;
        mergedDetails.dateCreated = dateTimeStr;
      }
      mergedData.details = mergedDetails;

      if (!incomingStats.hasPlan && existingStats.hasPlan) {
        // Metadata-only update: retain existing floor plan and units untouched
        mergedData.plan = existingData.plan;
        if (existingData.units !== undefined && incomingData.units === undefined) {
          mergedData.units = existingData.units;
        }
        planPreserved = true;
      } else if (incomingStats.hasPlan && existingStats.hasPlan) {
        // Cross-project guard: reject if incoming plan explicitly belongs to a different project ID
        const incomingPlanId = incomingData.plan && (incomingData.plan._projectId || (incomingData.plan.meta && incomingData.plan.meta.id));
        const isCrossProjectLeak = !!(incomingPlanId && String(incomingPlanId) !== String(id) && existingStats.totalElements > 0);

        // Stale out-of-order request guard: reject older snapshot overwriting a newer saved snapshot
        const isStaleTimestamp = !!(
          existingStats.lastModified > 0 &&
          incomingStats.lastModified > 0 &&
          incomingStats.lastModified < existingStats.lastModified
        );

        // Accidental empty-wipe guard: protect both walls AND furniture/units against unhydrated or glitchy empty saves
        const isAccidentalWallWipe = !!(existingStats.walls > 0 && incomingStats.walls === 0 && !allowDestructive);
        const isAccidentalFurnWipe = !!(existingStats.furniture > 0 && incomingStats.furniture === 0 && !allowDestructive);
        const isAccidentalTotalWipe = !!(existingStats.totalElements > 0 && incomingStats.totalElements === 0 && !allowDestructive);

        if (isCrossProjectLeak || isStaleTimestamp || isAccidentalWallWipe || isAccidentalFurnWipe || isAccidentalTotalWipe) {
          if (isStaleTimestamp) {
            // Benign timestamp collision between concurrent REST and WS sync: retain existing fresher DB state cleanly
            console.log(`[ProjectService] Kept fresher database snapshot for ${id} (DB: ${existingStats.lastModified} >= incoming: ${incomingStats.lastModified})`);
          } else {
            const reason = isCrossProjectLeak
              ? `cross-project mismatch (${incomingPlanId} != ${id})`
              : `unintentional empty wipe (existing: ${existingStats.walls} walls, ${existingStats.furniture} units; incoming: ${incomingStats.walls} walls, ${incomingStats.furniture} units)`;
            console.warn(`[ProjectService] Protected project ${id} from destructive plan overwrite: ${reason}`);
          }
          mergedData.plan = existingData.plan;
          if (existingData.units !== undefined) {
            mergedData.units = existingData.units;
          }
          planPreserved = true;
        } else {
          // Valid newer plan update: preserve units array if incoming plan has furniture but incoming units array is empty
          if (incomingStats.furniture > 0 && Array.isArray(incomingData.units) && incomingData.units.length === 0 && Array.isArray(existingData.units) && existingData.units.length > 0 && !allowDestructive) {
            mergedData.units = existingData.units;
          }
          // Ensure _lastModified is stamped monotonically on the stored plan
          if (mergedData.plan && typeof mergedData.plan === 'object') {
            const stampedMod = Math.max(incomingStats.lastModified || 0, existingStats.lastModified || 0, Date.now());
            mergedData.plan = Object.assign({}, mergedData.plan, {
              _projectId: String(id),
              _lastModified: incomingStats.lastModified > 0 ? incomingStats.lastModified : stampedMod,
              _serverSavedAt: Date.now()
            });
          }
        }
      }

      // Synchronize plan.meta with authoritative details metadata
      if (mergedData.plan && typeof mergedData.plan === 'object' && mergedData.details) {
        mergedData.plan.meta = Object.assign({}, mergedData.plan.meta || {}, {
          clientName: mergedData.details.clientName || (mergedData.plan.meta && mergedData.plan.meta.clientName) || '',
          phone: mergedData.details.phone || (mergedData.plan.meta && mergedData.plan.meta.phone) || '',
          contactNumber: mergedData.details.contactNumber || (mergedData.plan.meta && mergedData.plan.meta.contactNumber) || '',
          siteAddress: mergedData.details.siteAddress || (mergedData.plan.meta && mergedData.plan.meta.siteAddress) || '',
          siteLocation: mergedData.details.location || (mergedData.plan.meta && mergedData.plan.meta.siteLocation) || '',
          location: mergedData.details.location || (mergedData.plan.meta && mergedData.plan.meta.location) || '',
          bhName: mergedData.details.bhName || (mergedData.plan.meta && mergedData.plan.meta.bhName) || '',
          designerName: mergedData.details.designerName || (mergedData.plan.meta && mergedData.plan.meta.designerName) || '',
          cpCode: mergedData.details.cpCode || (mergedData.plan.meta && mergedData.plan.meta.cpCode) || '',
          quoteId: mergedData.details.quoteId || (mergedData.plan.meta && mergedData.plan.meta.quoteId) || '',
          dateTime: mergedData.details.dateTime || (mergedData.plan.meta && mergedData.plan.meta.dateTime) || '',
          dateCreated: mergedData.details.dateCreated || (mergedData.plan.meta && mergedData.plan.meta.dateCreated) || ''
        });
      }

      // Automatic Rolling Revision History (keep last 5 snapshots)
      const revisions = Array.isArray(existingData._revisions) ? [...existingData._revisions] : [];
      const snapshot = {
        timestamp: Date.now(),
        savedAt: new Date().toISOString(),
        unitsCount: existingStats.furniture || existing.unitsCount || 0,
        wallsCount: existingStats.walls || 0,
        plan: existingData.plan || null,
        units: existingData.units || null,
        savedBy: user ? (user.name || user.username || user.id) : 'autosave'
      };
      if (existingStats.totalElements > 0 || (existingData.plan && existingData.plan.walls && existingData.plan.walls.length > 0)) {
        const lastRev = revisions[0];
        const isTooRecent = lastRev && (Date.now() - lastRev.timestamp < 30000) && lastRev.unitsCount === snapshot.unitsCount && lastRev.wallsCount === snapshot.wallsCount;
        if (!isTooRecent) {
          revisions.unshift(snapshot);
          if (revisions.length > 5) revisions.length = 5;
        }
      }
      mergedData._revisions = revisions;

      data.data = mergedData;

      // Never allow unitsCount to drop to 0 when the existing plan was preserved
      if (planPreserved) {
        const preservedCount = existingStats.furniture || existing.unitsCount || 0;
        data.unitsCount = preservedCount;
      } else if (data.unitsCount === undefined) {
        data.unitsCount = incomingStats.furniture;
      }
    }
    if (updates.is_shared !== undefined || updates.isShared !== undefined) {
      data.isShared = updates.is_shared ?? updates.isShared;
    }
    if (updates.fork_count !== undefined || updates.forkCount !== undefined) {
      data.forkCount = parseInt(updates.fork_count ?? updates.forkCount, 10);
    }

    const updated = await prisma.project.update({
      where: { id },
      data
    });
    const formatted = formatProject(updated);
    if (planPreserved) {
      formatted._planPreserved = true;
    }
    return formatted;
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

  // 6. Fork / Duplicate Project (Supports self copy or colleague copy-on-share)
  async forkProject(id, targetUser, senderUser) {
    const original = await this.getProjectById(id, senderUser || targetUser);
    if (!original) throw new Error('Original project not found');

    const assignedUser = targetUser || senderUser;
    const newId = 'proj_' + Date.now().toString(36) + Math.random().toString(36).substring(2, 6);
    const isColleagueCopy = senderUser && targetUser && senderUser.id !== targetUser.id;
    const newTitle = isColleagueCopy 
      ? `${original.title} (Copy from ${senderUser.name || 'Colleague'})` 
      : `${original.title} (Copy)`;

    const projectData = JSON.parse(JSON.stringify(original.data || {}));
    if (isColleagueCopy) {
      projectData.shareNotice = {
        noticeId: 'sn_' + newId,
        originalTitle: original.title,
        sharedByName: senderUser.name,
        sharedByDesignation: senderUser.designation || 'Modular Designer',
        sharedAt: new Date().toISOString()
      };
    }

    const forked = await prisma.project.create({
      data: {
        id: newId,
        title: newTitle,
        client: original.client,
        type: original.type,
        status: 'Draft',
        createdBy: assignedUser ? assignedUser.id : null,
        ownerName: assignedUser ? assignedUser.name : 'Cookscape Designer',
        ownerEmail: assignedUser ? assignedUser.email : 'designer@cookscape.com',
        unitsCount: original.unitsCount,
        boardsEst: original.boardsEst,
        data: projectData,
        isShared: false,
        forkCount: 0
      }
    });

    // Record fork relationship
    try {
      await prisma.projectFork.create({
        data: {
          originalProjectId: original.id,
          forkedProjectId: forked.id,
          forkedBy: senderUser ? senderUser.id : null,
          forkedToName: assignedUser ? assignedUser.name : 'Cookscape Designer',
          forkedToEmail: assignedUser ? assignedUser.email : 'designer@cookscape.com'
        }
      });
    } catch (_) {}

    // Increment original fork count
    try {
      await prisma.project.update({
        where: { id: original.id },
        data: { forkCount: { increment: 1 } }
      });
    } catch (_) {}

    return formatProject(forked);
  }
}

module.exports = new ProjectService();

