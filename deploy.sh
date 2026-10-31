#!/usr/bin/env bash
# ==============================================================================
# Orbix Studio - Automated Deployment Script
# Target Server Path: /home/deploy/orbix_studio
# Domain: studio.orbixdesigns.com
# ==============================================================================

set -e

# Configuration
DOMAIN="studio.orbixdesigns.com"
PROJECT_DIR="/home/deploy/orbix_studio"
NGINX_AVAIL="/etc/nginx/sites-available/${DOMAIN}"
NGINX_ENBLD="/etc/nginx/sites-enabled/${DOMAIN}"

# Text formatting
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${BLUE}==============================================${NC}"
echo -e "${BLUE}       Orbix Studio Deployment Script         ${NC}"
echo -e "${BLUE}==============================================${NC}"

# 1. Check if git repo exists in project directory and pull latest code
if [ -d "$PROJECT_DIR/.git" ]; then
    echo -e "${YELLOW}[1/5] Pulling latest changes from Git...${NC}"
    cd "$PROJECT_DIR"
    git fetch origin main
    git reset --hard origin/main
else
    echo -e "${YELLOW}[1/5] Git directory not detected at ${PROJECT_DIR}.${NC}"
    echo -e "If you are running this from a cloned directory, moving files or continuing..."
fi

# 2. Set directory permissions for Nginx
echo -e "${YELLOW}[2/5] Configuring folder permissions...${NC}"
sudo chmod 755 /home/deploy || true
sudo chmod -R 755 "$PROJECT_DIR"

# 3. Create Nginx configuration if it doesn't exist
echo -e "${YELLOW}[3/5] Verifying Nginx virtual host...${NC}"
if [ ! -f "$NGINX_AVAIL" ]; then
    echo -e "Creating Nginx configuration at ${NGINX_AVAIL}..."
    sudo bash -c "cat > ${NGINX_AVAIL}" << 'EOF'
server {
    listen 80;
    listen [::]:80;

    server_name studio.orbixdesigns.com;

    root /home/deploy/orbix_studio;
    index index.html;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_proxied any;
    gzip_comp_level 6;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript image/svg+xml;

    # Cache static assets (3D models, textures, JS, CSS)
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot|pdf|csv|xlsx)$ {
        expires 30d;
        add_header Cache-Control "public, no-transform";
    }

    # SPA Fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Logs
    access_log /var/log/nginx/orbix_studio_access.log;
    error_log /var/log/nginx/orbix_studio_error.log;
}
EOF
    echo -e "${GREEN}✓ Nginx config created successfully.${NC}"
else
    echo -e "${GREEN}✓ Existing Nginx configuration found.${NC}"
fi

# 4. Enable Nginx site
if [ ! -L "$NGINX_ENBLD" ]; then
    echo -e "Enabling site in Nginx..."
    sudo ln -s "$NGINX_AVAIL" "$NGINX_ENBLD"
fi

# 5. Test and reload Nginx
echo -e "${YELLOW}[4/5] Testing Nginx configuration...${NC}"
sudo nginx -t

echo -e "${YELLOW}[5/5] Reloading Nginx...${NC}"
sudo systemctl reload nginx

echo -e "${GREEN}==============================================${NC}"
echo -e "${GREEN}   Deployment completed successfully!         ${NC}"
echo -e "${GREEN}   URL: http://${DOMAIN}                     ${NC}"
echo -e "${GREEN}==============================================${NC}"

# Check for SSL
if ! sudo certbot certificates 2>/dev/null | grep -q "$DOMAIN"; then
    echo -e "\n${YELLOW}Notice: SSL certificate not yet detected for ${DOMAIN}.${NC}"
    echo -e "To configure HTTPS, ensure your DNS is pointed and run:"
    echo -e "${BLUE}sudo certbot --nginx -d ${DOMAIN}${NC}\n"
else
    echo -e "${GREEN}SSL is active: https://${DOMAIN}${NC}"
fi

