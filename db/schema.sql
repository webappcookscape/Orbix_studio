-- ═══════════════════════════════════════════════════════════════════════════════
-- ORBIX STUDIO — PostgreSQL Schema
-- ═══════════════════════════════════════════════════════════════════════════════

-- Users Table
CREATE TABLE IF NOT EXISTS users (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(128) NOT NULL,
  username VARCHAR(64) UNIQUE,
  email VARCHAR(128) UNIQUE NOT NULL,
  password VARCHAR(128) DEFAULT '123456',
  role VARCHAR(64) DEFAULT 'employee',
  designation VARCHAR(128) DEFAULT 'Modular Designer',
  company VARCHAR(128) DEFAULT 'Orbix Studio',
  avatar VARCHAR(256),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Ensure columns exist if table was created in an earlier migration
ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS password VARCHAR(128) DEFAULT '123456';
ALTER TABLE users ADD COLUMN IF NOT EXISTS designation VARCHAR(128) DEFAULT 'Modular Designer';
ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;

-- Upsert Cookscape Team Accounts (3 Admins + 15 Users = 18 Members)
INSERT INTO users (id, name, username, email, password, role, designation, company, avatar)
VALUES 
  ('usr_admin', 'Cookscape Admin', 'admin', 'admin@cookscape.com', 'password123', 'admin', 'System Administrator', 'Cookscape', 'CA'),
  ('usr_sangathamizh', 'Sangathamizh', 'sangathamizh', 'designteam.cookscape@gmail.com', 'password123', 'admin', 'Business Head', 'Cookscape', 'S'),
  ('usr_dinesh', 'Dinesh Kumar', 'dinesh', 'dinesh@cookscape.com', 'password123', 'admin', 'Managing Director', 'Cookscape', 'DK'),
  ('usr_elakkiya', 'Elakkiya', 'elakkiya', 'elakkiya.sakthivelu3089@gmail.com', 'password123', 'employee', 'Floor Architect / FA', 'Cookscape', 'E'),
  ('usr_aravind', 'Aravind', 'aravind', 'webapp.cookscape@gmail.com', 'password123', 'employee', 'Floor Architect / FA', 'Cookscape', 'A'),
  ('usr_dev', 'Dev Kancheti', 'dev', 'dev@cookscape.com', 'password123', 'employee', 'Design Lead', 'Cookscape', 'DK'),
  ('usr_priya', 'Priya Sharma', 'priya', 'priya@cookscape.com', 'password123', 'employee', 'Senior Modular Designer', 'Cookscape', 'PS'),
  ('usr_rahul', 'Rahul Verma', 'rahul', 'rahul@cookscape.com', 'password123', 'employee', 'Kitchen Specialist', 'Cookscape', 'RV'),
  ('usr_karthik', 'Karthik Raman', 'karthik', 'karthik@cookscape.com', 'password123', 'employee', 'Wardrobe CAD Engineer', 'Cookscape', 'KR'),
  ('usr_sneha', 'Sneha Patel', 'sneha', 'sneha@cookscape.com', 'password123', 'employee', 'Interior Architect', 'Cookscape', 'SP'),
  ('usr_vikram', 'Vikram Singhania', 'vikram', 'vikram@cookscape.com', 'password123', 'employee', 'Floor Architect / FA', 'Cookscape', 'VS'),
  ('usr_ananya', 'Ananya Iyer', 'ananya', 'ananya@cookscape.com', 'password123', 'employee', 'Space Planner', 'Cookscape', 'AI'),
  ('usr_rajesh', 'Rajesh Nair', 'rajesh', 'rajesh@cookscape.com', 'password123', 'employee', 'Modular Kitchen Designer', 'Cookscape', 'RN'),
  ('usr_deepa', 'Deepa Menon', 'deepa', 'deepa@cookscape.com', 'password123', 'employee', 'Floor Architect / FA', 'Cookscape', 'DM'),
  ('usr_suresh', 'Suresh Babu', 'suresh', 'suresh@cookscape.com', 'password123', 'employee', 'Cabinetry Drafter', 'Cookscape', 'SB'),
  ('usr_meera', 'Meera Krishnan', 'meera', 'meera@cookscape.com', 'password123', 'employee', '3D Visualizer & Designer', 'Cookscape', 'MK'),
  ('usr_pooja', 'Pooja Hegde', 'pooja', 'pooja@cookscape.com', 'password123', 'employee', 'Floor Architect / FA', 'Cookscape', 'PH'),
  ('usr_naveen', 'Naveen Prasad', 'naveen', 'naveen@cookscape.com', 'password123', 'employee', 'Modular CAD Specialist', 'Cookscape', 'NP')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  username = EXCLUDED.username,
  email = EXCLUDED.email,
  password = EXCLUDED.password,
  role = EXCLUDED.role,
  designation = EXCLUDED.designation,
  company = EXCLUDED.company,
  avatar = EXCLUDED.avatar;

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
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Project Forks Table (Tracks which copy was branched from which master project)
CREATE TABLE IF NOT EXISTS project_forks (
  id VARCHAR(64) PRIMARY KEY,
  original_project_id VARCHAR(64) REFERENCES projects(id) ON DELETE SET NULL,
  forked_project_id VARCHAR(64) NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  forked_by VARCHAR(64) REFERENCES users(id) ON DELETE CASCADE,
  forked_to_name VARCHAR(128),
  forked_to_email VARCHAR(128),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
