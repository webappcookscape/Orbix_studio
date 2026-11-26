// ═══════════════════════════════════════════════════════════════════════════════
// ORBIX STUDIO — Cloud Raytracing Render Service
// Background queue manager for headless Blender Cycles rendering (CPU / GPU)
// ═══════════════════════════════════════════════════════════════════════════════

const fs = require('fs');
const path = require('path');
const { spawn, execSync } = require('child_process');
const crypto = require('crypto');

const ROOT_DIR = path.join(__dirname, '..', '..');
const RENDERS_DIR = path.join(ROOT_DIR, 'renders');
const JOBS_DIR = path.join(RENDERS_DIR, 'jobs');
const OUTPUT_DIR = path.join(RENDERS_DIR, 'output');
const JOBS_STORE_FILE = path.join(RENDERS_DIR, 'render_jobs.json');
const BLENDER_SCRIPT_PATH = path.join(ROOT_DIR, 'scripts', 'orbix_blender_cycles.py');

// Ensure storage directories exist
[RENDERS_DIR, JOBS_DIR, OUTPUT_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) {
    try { fs.mkdirSync(dir, { recursive: true }); } catch (_) {}
  }
});

// Preset Configurations
const PRESETS = {
  preview: {
    label: 'Fast Preview (1080p)',
    resolution: [1920, 1080],
    samples: 16,
    timeoutMs: 3 * 60 * 1000 // 3 minutes max
  },
  ultra: {
    label: 'Ultra Presentation (4K)',
    resolution: [3840, 2160],
    samples: 64,
    timeoutMs: 12 * 60 * 1000 // 12 minutes max
  }
};

class RenderService {
  constructor() {
    this.jobs = new Map();
    this.queue = [];
    this.activeJobId = null;
    this.activeProcess = null;
    this.blenderBin = null;
    this.blenderVersion = null;
    this.loadJobsStore();
    this.detectBlender();
  }

  // Detect Blender binary and version
  detectBlender() {
    const candidates = [
      process.env.BLENDER_PATH,
      'blender',
      '/usr/bin/blender',
      '/usr/local/bin/blender',
      '/snap/bin/blender',
      'C:\\Program Files\\Blender Foundation\\Blender 4.2\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.1\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 4.0\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 3.6\\blender.exe',
      'C:\\Program Files\\Blender Foundation\\Blender 3.0\\blender.exe'
    ].filter(Boolean);

    for (const bin of candidates) {
      try {
        const out = execSync(`"${bin}" --version`, { timeout: 4000, encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'] });
        const match = out.match(/Blender\s+([0-9]+\.[0-9]+\.[0-9]+)/i);
        this.blenderBin = bin;
        this.blenderVersion = match ? match[1] : 'Installed';
        console.log(`[RenderService] Detected Blender: ${this.blenderBin} (v${this.blenderVersion})`);
        return true;
      } catch (_) {
        // try next candidate
      }
    }

    console.warn('[RenderService] Blender not found in standard system paths.');
    return false;
  }

  getBlenderInfo() {
    if (!this.blenderBin) this.detectBlender();
    return {
      available: !!this.blenderBin,
      binary: this.blenderBin || null,
      version: this.blenderVersion || null
    };
  }

  // Load persisted job history
  loadJobsStore() {
    try {
      if (fs.existsSync(JOBS_STORE_FILE)) {
        const raw = fs.readFileSync(JOBS_STORE_FILE, 'utf8');
        const list = JSON.parse(raw);
        if (Array.isArray(list)) {
          for (const j of list) {
            // Reset any job stuck in 'rendering' or 'queued' on server boot
            if (j.status === 'rendering' || j.status === 'queued') {
              j.status = 'failed';
              j.error = 'Render job interrupted by server restart';
            }
            this.jobs.set(j.id, j);
          }
        }
      }
    } catch (err) {
      console.warn('[RenderService] Could not load render_jobs.json:', err.message);
    }
  }

  saveJobsStore() {
    try {
      const arr = Array.from(this.jobs.values()).slice(-100); // keep last 100 jobs
      fs.writeFileSync(JOBS_STORE_FILE, JSON.stringify(arr, null, 2), 'utf8');
    } catch (_) {}
  }

  // Create a new render job
  createJob({ userId, projectId, cyclesData, preset, lighting }) {
    preset = (preset && PRESETS[preset]) ? preset : 'preview';
    const cfg = PRESETS[preset];

    // Validate cycles data
    if (!cyclesData || typeof cyclesData !== 'object' || !Array.isArray(cyclesData.objects) || cyclesData.objects.length === 0) {
      throw new Error('Scene has no 3D geometry to render. Please add walls or cabinets first.');
    }

    // Merge lighting parameters if provided
    if (lighting && typeof lighting === 'object') {
      cyclesData.lighting = cyclesData.lighting || {};
      if (lighting.daylightPercent !== undefined) cyclesData.lighting.daylightPercent = Number(lighting.daylightPercent);
      if (lighting.interiorFillWatts !== undefined) cyclesData.lighting.interiorFillWatts = Number(lighting.interiorFillWatts);
      if (lighting.exposureEV !== undefined) cyclesData.lighting.exposureEV = Number(lighting.exposureEV);
    }

    // Auto-cancel and prune older queued jobs for this user/project to prevent queue pileups
    const targetUser = userId || 'anonymous';
    for (let i = this.queue.length - 1; i >= 0; i--) {
      const queuedJob = this.jobs.get(this.queue[i]);
      if (queuedJob && (queuedJob.userId === targetUser || targetUser === 'anonymous' || (projectId && queuedJob.projectId === projectId))) {
        queuedJob.status = 'failed';
        queuedJob.error = 'Superseded by newer render request';
        queuedJob.completedAt = new Date().toISOString();
        this.queue.splice(i, 1);
      }
    }

    // If an active process is already running for this user/project, terminate it so new request starts fresh
    if (this.activeJobId && this.activeProcess) {
      const activeJob = this.jobs.get(this.activeJobId);
      if (activeJob && (activeJob.userId === targetUser || targetUser === 'anonymous' || (projectId && activeJob.projectId === projectId))) {
        console.log(`[RenderService] Superseding previous active job ${this.activeJobId} with new render.`);
        try { this.activeProcess.kill('SIGTERM'); } catch (_) {}
        setTimeout(() => {
          if (this.activeProcess) {
            try { this.activeProcess.kill('SIGKILL'); } catch (_) {}
          }
        }, 1500);
        activeJob.status = 'failed';
        activeJob.error = 'Superseded by newer render request';
        activeJob.completedAt = new Date().toISOString();
      }
    }

    const id = 'rnd_' + Date.now().toString(36) + '_' + crypto.randomBytes(3).toString('hex');
    const inputPath = path.join(JOBS_DIR, `${id}.cycles.json`);
    const outputFilename = `${id}.png`;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);

    // Write scene JSON to disk
    fs.writeFileSync(inputPath, JSON.stringify(cyclesData, null, 2), 'utf8');

    const job = {
      id,
      userId: userId || 'anonymous',
      projectId: projectId || 'current',
      preset,
      presetLabel: cfg.label,
      resolution: cfg.resolution,
      samples: cfg.samples,
      status: 'queued',
      progress: {
        stage: 'Queued in server',
        percent: 0,
        samplesDone: 0,
        samplesTotal: cfg.samples,
        timeRemaining: null
      },
      inputPath,
      outputPath,
      outputFilename,
      outputUrl: `/api/render/output/${outputFilename}`,
      error: null,
      createdAt: new Date().toISOString(),
      startedAt: null,
      completedAt: null,
      durationSeconds: null
    };

    this.jobs.set(id, job);
    this.queue.push(id);
    this.saveJobsStore();

    // Trigger queue processing
    setImmediate(() => this.processNext());

    const position = this.queue.indexOf(id) + 1;
    return {
      success: true,
      job: this.sanitizeJob(job),
      queuePosition: position
    };
  }

  // Process next job in queue (Strict single-concurrency for VPS safety)
  processNext() {
    if (this.activeJobId || this.queue.length === 0) {
      return;
    }

    const nextId = this.queue.shift();
    const job = this.jobs.get(nextId);
    if (!job) {
      return setImmediate(() => this.processNext());
    }

    this.activeJobId = nextId;
    job.status = 'rendering';
    job.startedAt = new Date().toISOString();
    job.progress.stage = 'Initializing Blender Cycles';
    job.progress.percent = 5;
    this.saveJobsStore();

    if (!this.blenderBin) {
      this.detectBlender();
    }

    if (!this.blenderBin) {
      job.status = 'failed';
      job.error = 'Blender is not installed or detected on this server. Please install Blender to enable cloud rendering.';
      job.completedAt = new Date().toISOString();
      this.activeJobId = null;
      this.saveJobsStore();
      return setImmediate(() => this.processNext());
    }

    const cfg = PRESETS[job.preset] || PRESETS.preview;
    const args = [
      '-b', // background (headless)
      '-P', BLENDER_SCRIPT_PATH,
      '--',
      '--input', job.inputPath,
      '--output', job.outputPath,
      '--samples', String(cfg.samples),
      '--resolution', String(cfg.resolution[0]), String(cfg.resolution[1]),
      '--device', 'CPU'
    ];

    console.log(`[RenderService] Starting job ${job.id} (${job.preset}, ${cfg.samples} samples, ${cfg.resolution.join('x')})`);

    // Use nice -n 19 on Linux/Unix to lower CPU priority so web requests never lag
    let cmd = this.blenderBin;
    let spawnArgs = args;
    if (process.platform !== 'win32') {
      try {
        execSync('which nice', { stdio: 'ignore' });
        spawnArgs = ['-n', '19', this.blenderBin, ...args];
        cmd = 'nice';
      } catch (_) {}
    }

    const startTime = Date.now();
    let stdoutBuffer = '';
    let stderrBuffer = '';

    try {
      this.activeProcess = spawn(cmd, spawnArgs, {
        cwd: ROOT_DIR,
        env: {
          ...process.env,
          PYTHONUNBUFFERED: '1'
        }
      });
    } catch (spawnErr) {
      job.status = 'failed';
      job.error = 'Failed to spawn Blender process: ' + spawnErr.message;
      job.completedAt = new Date().toISOString();
      this.activeJobId = null;
      this.saveJobsStore();
      return setImmediate(() => this.processNext());
    }

    // Activity tracker & stall heartbeat
    let lastActivityTime = Date.now();
    const heartbeatTimer = setInterval(() => {
      if (this.activeJobId === job.id && this.activeProcess) {
        if (Date.now() - lastActivityTime > 60000) {
          console.warn(`[RenderService] Job ${job.id} stalled (no output for 60s). Terminating process.`);
          clearInterval(heartbeatTimer);
          try { this.activeProcess.kill('SIGKILL'); } catch (_) {}
        }
      } else {
        clearInterval(heartbeatTimer);
      }
    }, 15000);

    // Safety timeout
    const timeoutTimer = setTimeout(() => {
      if (this.activeProcess && this.activeJobId === job.id) {
        console.warn(`[RenderService] Job ${job.id} exceeded maximum timeout of ${cfg.timeoutMs / 60000}m. Killing process.`);
        try { this.activeProcess.kill('SIGTERM'); } catch (_) {}
        setTimeout(() => {
          if (this.activeProcess) {
            try { this.activeProcess.kill('SIGKILL'); } catch (_) {}
          }
        }, 2000);
      }
    }, cfg.timeoutMs);

    this.activeProcess.stdout.on('data', (chunk) => {
      lastActivityTime = Date.now();
      const text = chunk.toString();
      stdoutBuffer += text;
      this.parseProgress(job, text);
    });

    this.activeProcess.stderr.on('data', (chunk) => {
      lastActivityTime = Date.now();
      stderrBuffer += chunk.toString();
    });

    this.activeProcess.on('close', (code) => {
      clearTimeout(timeoutTimer);
      clearInterval(heartbeatTimer);
      this.activeProcess = null;
      this.activeJobId = null;
      const durationSec = Math.round((Date.now() - startTime) / 1000);
      job.durationSeconds = durationSec;
      job.completedAt = new Date().toISOString();
      job.stdout = stdoutBuffer.slice(-4000);
      job.stderr = stderrBuffer.slice(-4000);

      // Check if output PNG exists
      if (fs.existsSync(job.outputPath) && fs.statSync(job.outputPath).size > 1024) {
        job.status = 'completed';
        job.progress.stage = 'Render completed';
        job.progress.percent = 100;
        job.progress.samplesDone = cfg.samples;
        console.log(`[RenderService] Job ${job.id} successfully completed in ${durationSec}s!`);

        // Clean up input json
        try { fs.unlinkSync(job.inputPath); } catch (_) {}
      } else {
        job.status = 'failed';
        job.error = stderrBuffer.trim() || stdoutBuffer.slice(-500).trim() || `Blender exited with code ${code}`;
        console.error(`[RenderService] Job ${job.id} failed (code ${code}):`, job.error);
      }

      this.saveJobsStore();
      setImmediate(() => this.processNext());
    });

    this.activeProcess.on('error', (err) => {
      clearTimeout(timeoutTimer);
      clearInterval(heartbeatTimer);
      this.activeProcess = null;
      this.activeJobId = null;
      job.status = 'failed';
      job.error = err.message;
      job.completedAt = new Date().toISOString();
      console.error(`[RenderService] Process error on job ${job.id}:`, err);
      this.saveJobsStore();
      setImmediate(() => this.processNext());
    });
  }

  // Parse Blender CLI output for real-time progress
  parseProgress(job, text) {
    // Check for sample count: "Rendered 24/48 Samples" or "Sample 24/48"
    const sampleMatch = text.match(/(?:Rendered|Sample)\s+(\d+)\s*\/\s*(\d+)/i);
    if (sampleMatch) {
      const current = parseInt(sampleMatch[1], 10);
      const total = parseInt(sampleMatch[2], 10) || job.samples;
      job.progress.samplesDone = current;
      job.progress.samplesTotal = total;
      job.progress.percent = Math.min(98, Math.max(10, Math.round((current / total) * 90) + 8));
      job.progress.stage = `Rendering (${current}/${total} samples)`;
    }

    // Check for remaining time: "Remaining:00:15.20"
    const timeMatch = text.match(/Remaining:([0-9:]+(?:\.[0-9]+)?)/i);
    if (timeMatch) {
      job.progress.timeRemaining = timeMatch[1].split('.')[0];
      if (job.progress.samplesDone) {
        job.progress.stage = `Rendering (${job.progress.samplesDone}/${job.progress.samplesTotal} samples, ~${job.progress.timeRemaining} left)`;
      }
    }

    if (text.includes('Rebuilding') && job.progress.percent < 10) {
      job.progress.stage = 'Rebuilding geometry & PBR materials';
      job.progress.percent = 8;
    }
  }

  getJob(id) {
    const job = this.jobs.get(id);
    if (!job) return null;
    return this.sanitizeJob(job);
  }

  listJobs(userId, projectId) {
    const all = Array.from(this.jobs.values());
    const filtered = all.filter((j) => {
      if (userId && j.userId !== userId && j.userId !== 'anonymous') return false;
      if (projectId && j.projectId !== projectId) return false;
      return true;
    });
    return filtered.map((j) => this.sanitizeJob(j)).reverse().slice(0, 20);
  }

  cancelJob(id) {
    const job = this.jobs.get(id);
    if (!job) return false;

    if (this.activeJobId === id && this.activeProcess) {
      console.log(`[RenderService] Cancelling active render job ${id}`);
      try { this.activeProcess.kill('SIGTERM'); } catch (_) {}
      setTimeout(() => {
        if (this.activeProcess) {
          try { this.activeProcess.kill('SIGKILL'); } catch (_) {}
        }
      }, 1000);
      job.status = 'failed';
      job.error = 'Render cancelled by user';
      job.completedAt = new Date().toISOString();
      this.activeJobId = null;
      this.activeProcess = null;
      this.saveJobsStore();
      setImmediate(() => this.processNext());
      return true;
    }

    const idx = this.queue.indexOf(id);
    if (idx !== -1) {
      console.log(`[RenderService] Removing job ${id} from queue`);
      this.queue.splice(idx, 1);
      job.status = 'failed';
      job.error = 'Render cancelled before execution';
      job.completedAt = new Date().toISOString();
      this.saveJobsStore();
      return true;
    }

    return false;
  }

  // Force-reset worker and purge entire queue
  clearQueue() {
    console.log('[RenderService] Explicit queue clear & worker reset requested.');
    let clearedCount = this.queue.length;

    if (this.activeProcess) {
      clearedCount++;
      try { this.activeProcess.kill('SIGTERM'); } catch (_) {}
      setTimeout(() => {
        if (this.activeProcess) {
          try { this.activeProcess.kill('SIGKILL'); } catch (_) {}
        }
      }, 800);
      this.activeProcess = null;
    }

    if (this.activeJobId) {
      const active = this.jobs.get(this.activeJobId);
      if (active) {
        active.status = 'failed';
        active.error = 'Worker reset by user';
        active.completedAt = new Date().toISOString();
      }
      this.activeJobId = null;
    }

    for (const qId of this.queue) {
      const qJob = this.jobs.get(qId);
      if (qJob) {
        qJob.status = 'failed';
        qJob.error = 'Queue reset by user';
        qJob.completedAt = new Date().toISOString();
      }
    }
    this.queue = [];
    this.saveJobsStore();

    return {
      success: true,
      message: `Cleared ${clearedCount} job(s) and reset worker process.`,
      activeJobId: null,
      queueLength: 0
    };
  }

  getOutputFilePath(filename) {
    const safeName = path.basename(filename);
    const fullPath = path.join(OUTPUT_DIR, safeName);
    if (fs.existsSync(fullPath)) return fullPath;
    return null;
  }

  sanitizeJob(job) {
    const queueIndex = this.queue.indexOf(job.id);
    return {
      id: job.id,
      preset: job.preset,
      presetLabel: job.presetLabel,
      resolution: job.resolution,
      samples: job.samples,
      status: job.status,
      progress: job.progress,
      outputUrl: job.status === 'completed' ? job.outputUrl : null,
      error: job.error,
      createdAt: job.createdAt,
      startedAt: job.startedAt,
      completedAt: job.completedAt,
      durationSeconds: job.durationSeconds,
      queuePosition: queueIndex !== -1 ? queueIndex + 1 : (this.activeJobId === job.id ? 0 : null)
    };
  }
}

module.exports = new RenderService();
