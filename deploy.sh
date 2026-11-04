#!/usr/bin/env bash
# ==============================================================================
# Orbix Studio - Continuous Deployment Script
# Target Server Path: /home/deploy/orbix_studio
# Domain: studio.orbixdesigns.com
# Port: 4180
# ==============================================================================

set -e

# Configuration
DOMAIN="studio.orbixdesigns.com"
PROJECT_DIR="/home/deploy/orbix_studio"
NODE_PORT="4180"
PM2_APP_NAME="orbix-studio"
NGINX_AVAIL="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENBLD="/etc/nginx/sites-enabled/${DOMAIN}"

# Text formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}     Orbix Studio Deployment Script           ${NC}"
echo -e "${BLUE}==============================================${NC}"

# 1. Pull latest code from Git
if [ -d "$PROJECT_DIR/.git" ]; then
    echo -e "${YELLOW}[1/5] Pulling latest changes from Git...${NC}"
    cd "$PROJECT_DIR"
    # Preserve runtime database and .env so created employees & projects are never lost on deploy
    if [ -f ".env" ]; then
        cp .env /tmp/orbix_env_backup 2>/dev/null || true
    fi
    if [ -f "db/local_store.json" ]; then
        cp db/local_store.json /tmp/orbix_local_store_backup.json 2>/dev/null || true
    fi
    git fetch origin main
    git reset --hard origin/main
    # Restore .env and runtime data
    if [ -f "/tmp/orbix_env_backup" ]; then
        cp /tmp/orbix_env_backup .env 2>/dev/null || true
    fi
    if [ ! -f ".env" ]; then
        cat > .env << 'ENVEOF'
# PostgreSQL Database Connection
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/cupboard_cad
PGHOST=localhost
PGPORT=5432
PGUSER=postgres
PGPASSWORD=postgres
PGDATABASE=cupboard_cad
PORT=4180
ENVEOF
        chmod 600 .env 2>/dev/null || true
    fi
    if [ -f "/tmp/orbix_local_store_backup.json" ]; then
        cp /tmp/orbix_local_store_backup.json db/local_store.json 2>/dev/null || true
    fi
else
    echo -e "${YELLOW}[1/5] Git directory not detected at ${PROJECT_DIR}.${NC}"
fi

# 2. Set directory permissions
echo -e "${YELLOW}[2/5] Configuring folder permissions...${NC}"
sudo chmod 755 /home/deploy || true
sudo chmod -R 755 "$PROJECT_DIR"

# 3. Install Node.js dependencies
echo -e "${YELLOW}[3/5] Installing npm packages...${NC}"
cd "$PROJECT_DIR"
if command -v npm &> /dev/null; then
    npm install --omit=dev
else
    echo -e "${RED}npm is not installed! Please install nodejs and npm.${NC}"
    exit 1
fi

# 4. Configure PostgreSQL user & database
echo -e "${YELLOW}[4/5] Configuring PostgreSQL credentials & database...${NC}"
if command -v psql &> /dev/null; then
    # Set password for postgres user so password authentication succeeds
    sudo -u postgres psql -c "ALTER USER postgres WITH PASSWORD 'postgres';" 2>/dev/null || true
    # Create cupboard_cad database if it doesn't exist
    sudo -u postgres psql -tc "SELECT 1 FROM pg_database WHERE datname = 'cupboard_cad'" 2>/dev/null | grep -q 1 || sudo -u postgres psql -c "CREATE DATABASE cupboard_cad OWNER postgres;" 2>/dev/null || true
    # Ensure all required schema columns exist in PostgreSQL
    sudo -u postgres psql -d cupboard_cad -c "ALTER TABLE users ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;" 2>/dev/null || true
    sudo -u postgres psql -d cupboard_cad -c "ALTER TABLE project_shares ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;" 2>/dev/null || true
    sudo -u postgres psql -d cupboard_cad -c "ALTER TABLE project_forks ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP;" 2>/dev/null || true
    # Purge legacy demo accounts from PostgreSQL
    sudo -u postgres psql -d cupboard_cad -c "DELETE FROM users WHERE id IN ('usr_dev', 'usr_alex', 'usr_priya') OR email IN ('dev@orbixstudio.io', 'alex@orbixstudio.io', 'priya@orbixstudio.io', 'alex@modularedge.com', 'priya@archform.in');" 2>/dev/null || true
fi

# 5. Check / Restart Node server with PM2
echo -e "${YELLOW}[5/5] Managing Node process with PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "Installing PM2 globally..."
    sudo npm install -g pm2
fi

if pm2 list | grep -q "$PM2_APP_NAME"; then
    echo -e "Restarting PM2 process ${PM2_APP_NAME}..."
    pm2 restart "$PM2_APP_NAME"
else
    echo -e "Starting PM2 process ${PM2_APP_NAME} on port ${NODE_PORT}..."
    pm2 start server.js --name "$PM2_APP_NAME"
fi
pm2 save



# 5. Check Nginx virtual host (NEVER overwrite existing SSL configs!)
echo -e "${YELLOW}[5/5] Checking Nginx virtual host...${NC}"
if [ ! -f "$NGINX_AVAIL" ]; then
    echo -e "Initial Nginx config not found. Creating virtual host..."
    sudo bash -c "cat > ${NGINX_AVAIL}" << EOF
server {
    listen 80;
    listen [::]:80;

    server_name ${DOMAIN};

    root ${PROJECT_DIR};
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|pdf|csv|xlsx|json|webmanifest)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
        try_files \$uri @node;
    }

    # PWA Service Worker (Never cache sw.js)
    location = /sw.js {
        proxy_pass http://127.0.0.1:${NODE_PORT};
        proxy_set_header Host \$host;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # API Proxy to Node.js backend
    location /api/ {
        proxy_pass http://127.0.0.1:${NODE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # SPA Routing fallback
    location / {
        try_files \$uri \$uri/ @node;
    }

    location @node {
        proxy_pass http://127.0.0.1:${NODE_PORT};
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Logs
    access_log /var/log/nginx/orbix_studio_access.log;
    error_log /var/log/nginx/orbix_studio_error.log;
}
EOF
    if [ ! -L "$NGINX_ENBLD" ]; then
        sudo ln -s "$NGINX_AVAIL" "$NGINX_ENBLD"
    fi
    echo -e "Initial Nginx config created. Running Certbot for HTTPS..."
    sudo certbot --nginx -d "${DOMAIN}" --non-interactive --agree-tos || true
else
    echo -e "${GREEN}✓ Existing Nginx configuration preserved (SSL & routes intact).${NC}"
fi

# Ensure symlink exists
if [ ! -L "$NGINX_ENBLD" ]; then
    sudo ln -s "$NGINX_AVAIL" "$NGINX_ENBLD"
fi

# Reload Nginx safely
sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}   Deployment Complete & Active!              ${NC}"
echo -e "${GREEN}   URL: https://${DOMAIN}                    ${NC}"
echo -e "${GREEN}   Backend Port: ${NODE_PORT} (PM2: ${PM2_APP_NAME})${NC}"
echo -e "${GREEN}==============================================${NC}"
