-- ═══════════════════════════════════════════════════════════════════════════════
-- ORBIX STUDIO — PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════════════════════════

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  email VARCHAR(128) UNIQUE NOT NULL,
  role VARCHAR(64) DEFAULT 'Designer',
  company VARCHAR(128) DEFAULT 'Orbix Studio',
  avatar VARCHAR(256),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Projects Table
CREATE TABLE IF NOT EXISTS projects (
  id VARCHAR(64) PRIMARY KEY,
  title VARCHAR(256) NOT NULL,
  client VARCHAR(256) DEFAULT '',
  type VARCHAR(64) DEFAULT 'Wardrobe',
  status VARCHAR(32) DEFAULT 'Draft',
  created_by VARCHAR(64) REFERENCES users(id) ON DELETE SET NULL,
  owner_name VARCHAR(128) NOT NULL,
  owner_email VARCHAR(128) NOT NULL,
  units_count INTEGER DEFAULT 0,
  boards_est INTEGER DEFAULT 0,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_shared BOOLEAN DEFAULT FALSE,
  fork_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Shares Table (Records share links and permissions)
CREATE TABLE IF NOT EXISTS project_shares (
  id VARCHAR(64) PRIMARY KEY,
  project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  shared_by VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  shared_to_email VARCHAR(128),
  permission VARCHAR(32) DEFAULT 'copy', -- 'copy' enforces that colleagues work in an isolated copy
  share_token VARCHAR(128) UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Forks Table (Tracks which copy was branched from which master project)
CREATE TABLE IF NOT EXISTS project_forks (
  id VARCHAR(64) PRIMARY KEY,
  original_project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
  forked_project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  forked_by VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  forked_by_name VARCHAR(128) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for lightning fast queries
CREATE INDEX IF NOT EXISTS idx_projects_created_by ON projects(created_by);
CREATE INDEX IF NOT EXISTS idx_projects_updated_at ON projects(updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_project_shares_token ON project_shares(share_token);
