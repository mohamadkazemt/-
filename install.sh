#!/bin/bash

# ==============================================================================
# Intelligent Personnel Management System - Auto Installer (Robust Iranian Edition)
# ==============================================================================

# Exit on error
set -e

# --- Setup Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Configuration ---
APP_NAME="personnel-app"
DEFAULT_INSTALL_DIR="/var/www/personnel-app"
REPO_URL="https://github.com/mohamadkazemt/-.git"
export DEBIAN_FRONTEND=noninteractive

echo -e "${YELLOW}------------------------------------------------${NC}"
echo -e "${GREEN}   Intelligent Personnel Management System      ${NC}"
echo -e "${YELLOW}------------------------------------------------${NC}"

# 1. Root Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Error: Please run as root (sudo).${NC}"
  exit 1
fi

# 2. Update & Basic Tools
echo -e "${YELLOW}[1/7] Updating system (apt update)...${NC}"
apt-get update -y || echo -e "${RED}Warning: apt update had some issues, continuing...${NC}"

echo -e "${YELLOW}[1/7] Installing base tools (Nginx, Git, NodeSource)...${NC}"
apt-get install -y curl git build-essential nginx

# 3. Install Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[2/7] Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

# 4. Setup ArvanCloud NPM Mirror
echo -e "${YELLOW}[3/7] Configuring ArvanCloud NPM Mirror...${NC}"
npm config set registry https://npm.arvancloud.ir
echo -e "${GREEN}✅ NPM Registry set to ArvanCloud${NC}"

# 5. Clone / Update Repository
if [ ! -d "$DEFAULT_INSTALL_DIR" ]; then
    echo -e "${YELLOW}[4/7] Cloning repository...${NC}"
    # Try to read, but use default if not in TTY
    if [ -t 0 ]; then
        read -t 10 -p "Enter GitHub Repo URL [$REPO_URL]: " input_url || input_url=""
        REPO_URL=${input_url:-$REPO_URL}
    fi
    git clone "$REPO_URL" "$DEFAULT_INSTALL_DIR"
    cd "$DEFAULT_INSTALL_DIR" || exit
else
    echo -e "${YELLOW}[4/7] Project directory exists. Updating...${NC}"
    cd "$DEFAULT_INSTALL_DIR" || exit
    if [ -d ".git" ]; then
        git pull || echo "Pull failed, continuing with existing files..."
    fi
fi

# 6. Environment Setup
echo -e "${YELLOW}[5/7] Setting up Environment (.env)...${NC}"
if [ ! -f ".env" ]; then
    admin_email="admin@example.com"
    admin_pass="admin123"
    
    if [ -t 0 ]; then
        echo -e "${CYAN}Configuration Needed (Timeout 15s):${NC}"
        read -t 15 -p "Admin Email [$admin_email]: " in_email || in_email=""
        admin_email=${in_email:-$admin_email}
        read -t 15 -s -p "Admin Password (min 8 chars) [$admin_pass]: " in_pass || in_pass=""
        admin_pass=${in_pass:-$admin_pass}
        echo ""
    fi

    jwt_secret=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32 ; echo '')
    cat <<EOF > .env
JWT_SECRET=$jwt_secret
ADMIN_USER=$admin_email
ADMIN_PASSWORD=$admin_pass
NODE_ENV=production
EOF
    echo -e "${GREEN}✅ .env created.${NC}"
else
    echo -e "${GREEN}✅ .env already exists.${NC}"
fi

# 7. Install & Build
echo -e "${YELLOW}[6/7] Installing dependencies & Building (This may take a few minutes)...${NC}"
npm install --no-audit
npm run build

# 8. PM2 Setup
echo -e "${YELLOW}[7/7] Starting application with PM2...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

pm2 delete "$APP_NAME" 2>/dev/null || true
PORT=3000 pm2 start npm --name "$APP_NAME" -- run start
pm2 save
pm2 startup | tail -n 1 | bash || true

# 9. Nginx Config
echo -e "${YELLOW}Finalizing Nginx...${NC}"
cat <<EOF > /etc/nginx/sites-available/$APP_NAME
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        client_max_body_size 50M;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo -e "${YELLOW}------------------------------------------------${NC}"
echo -e "${GREEN}✅ Done! App is live at: http://$(curl -s ifconfig.me || echo "SERVER_IP")${NC}"
echo -e "Check logs: pm2 logs $APP_NAME"
echo -e "${YELLOW}------------------------------------------------${NC}"
