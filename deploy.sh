#!/usr/bin/env bash
# ==============================================================================
# Orbix Studio - Automated Deployment Script (Full-Stack Node.js + Nginx + SSL)
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

SSL_CERT="/etc/letsencrypt/live/${DOMAIN}/fullchain.pem"
SSL_KEY="/etc/letsencrypt/live/${DOMAIN}/privkey.pem"

# Text formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}    Orbix Studio Node.js Deployment Script    ${NC}"
echo -e "${BLUE}==============================================${NC}"

# 1. Pull latest code from Git
if [ -d "$PROJECT_DIR/.git" ]; then
    echo -e "${YELLOW}[1/6] Pulling latest changes from Git...${NC}"
    cd "$PROJECT_DIR"
    git fetch origin main
    git reset --hard origin/main
else
    echo -e "${YELLOW}[1/6] Git directory not detected at ${PROJECT_DIR}.${NC}"
fi

# 2. Set directory permissions
echo -e "${YELLOW}[2/6] Configuring folder permissions...${NC}"
sudo chmod 755 /home/deploy || true
sudo chmod -R 755 "$PROJECT_DIR"

# 3. Install Node.js dependencies
echo -e "${YELLOW}[3/6] Installing npm packages...${NC}"
cd "$PROJECT_DIR"
if command -v npm &> /dev/null; then
    npm install --omit=dev
else
    echo -e "${RED}npm is not installed! Please install nodejs and npm.${NC}"
    exit 1
fi

# 4. Check / Start Node server with PM2
echo -e "${YELLOW}[4/6] Managing Node process with PM2...${NC}"
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

# 5. Update Nginx configuration (Auto-preserving SSL certificates)
echo -e "${YELLOW}[5/6] Verifying Nginx virtual host...${NC}"

if [ -f "$SSL_CERT" ] && [ -f "$SSL_KEY" ]; then
    echo -e "${GREEN}✓ SSL certificate detected. Configuring HTTPS on Port 443...${NC}"
    sudo bash -c "cat > ${NGINX_AVAIL}" << EOF
server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name ${DOMAIN};

    ssl_certificate ${SSL_CERT};
    ssl_certificate_key ${SSL_KEY};
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root ${PROJECT_DIR};
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Static assets caching
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|pdf|csv|xlsx)$ {
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
else
    echo -e "${YELLOW}Notice: SSL certificate not yet detected at ${SSL_CERT}. Writing HTTP block...${NC}"
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
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot|pdf|csv|xlsx)$ {
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
fi

# Ensure symlink exists
if [ ! -L "$NGINX_ENBLD" ]; then
    sudo ln -s "$NGINX_AVAIL" "$NGINX_ENBLD"
fi

# 6. Test and reload Nginx
echo -e "${YELLOW}[6/6] Testing and reloading Nginx...${NC}"
sudo nginx -t
sudo systemctl reload nginx

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}   Deployment Complete & Active!              ${NC}"
echo -e "${GREEN}   URL: https://${DOMAIN}                    ${NC}"
echo -e "${GREEN}   Backend Port: ${NODE_PORT} (PM2: ${PM2_APP_NAME})${NC}"
echo -e "${GREEN}==============================================${NC}"
