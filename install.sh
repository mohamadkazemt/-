#!/bin/bash

# ==============================================================================
# Intelligent Personnel Management System - Auto Installer (Iranian Server Edition)
# This script installs Node.js, Nginx, PM2, sets up mirrors, and configures the app.
# ==============================================================================

# --- Setup Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# --- Configuration ---
APP_NAME="personnel-app"
DEFAULT_INSTALL_DIR="/var/www/personnel-app"
# NOTE: User should update this URL after pushing to their GitHub
REPO_URL="https://github.com/mohamadkazemt/-.git"

echo -e "${YELLOW}------------------------------------------------${NC}"
echo -e "${GREEN}   Intelligent Personnel Management System      ${NC}"
echo -e "${YELLOW}------------------------------------------------${NC}"

# 1. Root Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root or using sudo.${NC}"
  exit 1
fi

# 2. Update & Basic Tools
echo -e "${YELLOW}[1/7] Updating system and installing base tools (Nginx, Git, etc.)...${NC}"
apt update -y && apt install -y curl git build-essential nginx

# 3. Setup ArvanCloud Mirrors (NPM)
echo -e "${YELLOW}[2/7] Setting up ArvanCloud NPM Mirror...${NC}"
# We'll set this globally after Node is installed, but let's note it for later.

# 4. Install Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[3/7] Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
    
    # Configure NPM registry right after installation
    npm config set registry https://npm.arvancloud.ir
else
    echo -e "${GREEN}✅ Node.js is already installed ($(node -v))${NC}"
    npm config set registry https://npm.arvancloud.ir
fi

# 5. Clone / Update Repository
if [ ! -d "$DEFAULT_INSTALL_DIR" ]; then
    echo -e "${YELLOW}[4/7] Cloning repository to $DEFAULT_INSTALL_DIR...${NC}"
    echo -e "${YELLOW}Please enter your GitHub Repo URL (or press Enter for default):${NC}"
    read -r input_url
    if [ ! -z "$input_url" ]; then REPO_URL=$input_url; fi
    
    git clone "$REPO_URL" "$DEFAULT_INSTALL_DIR"
    cd "$DEFAULT_INSTALL_DIR" || exit
else
    echo -e "${YELLOW}[4/7] Project directory exists. Pulling latest changes...${NC}"
    cd "$DEFAULT_INSTALL_DIR" || exit
    # Ensure we are in a git repo before pulling
    if [ -d ".git" ]; then
        git pull
    fi
fi

# 6. Environment & Database Setup
echo -e "${YELLOW}[5/7] Setting up Environment...${NC}"

# Get Admin Details
echo -e "${GREEN}--- Admin User Configuration ---${NC}"
read -p "Admin Email [admin@example.com]: " admin_email
admin_email=${admin_email:-admin@example.com}
read -s -p "Admin Password: " admin_pass
echo ""

# Generate random JWT Secret
jwt_secret=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32 ; echo '')

# Create .env file (Note: SQLite is used, so no DB host/user needed)
cat <<EOF > .env
# Authentication
JWT_SECRET=$jwt_secret
ADMIN_USER=$admin_email
ADMIN_PASSWORD=$admin_pass
NODE_ENV=production
EOF

echo -e "${GREEN}✅ .env file created successfully.${NC}"

# 7. Install Dependencies & Build
echo -e "${YELLOW}[6/7] Installing dependencies and building (using Arvan Mirror)...${NC}"
npm install
npm run build

# 8. Setup PM2
echo -e "${YELLOW}[7/7] Setting up PM2 for process management...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 9. Start the application
echo -e "${YELLOW}Starting application...${NC}"
pm2 stop "$APP_NAME" 2>/dev/null || true
pm2 delete "$APP_NAME" 2>/dev/null || true
# Running our production express server
PORT=3000 pm2 start npm --name "$APP_NAME" -- run start

# Save PM2 state for auto-reboot
pm2 save
pm2 startup | tail -n 1 | bash

# 10. Configure Nginx Reverse Proxy
echo -e "${YELLOW}Configuring Nginx Reverse Proxy for Iranian Server...${NC}"
cat <<EOF > /etc/nginx/sites-available/$APP_NAME
server {
    listen 80;
    server_name _;

    # Root directory for static assets if needed, but Express handles it
    # We proxy everything to Express on port 3000

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        
        # Increase body size for excel uploads/etc
        client_max_body_size 50M;
        
        # Timeout settings
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
EOF

ln -sf /etc/nginx/sites-available/$APP_NAME /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

echo -e "${YELLOW}------------------------------------------------${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "📍 Your app is running at: ${YELLOW}http://$(curl -s ifconfig.me)${NC}"
echo -e "📖 Mirrors: NPM registry set to ArvanCloud."
echo -e "📖 Nginx: Reverse proxy configured on port 80."
echo -e "📖 Database: SQLite (personnel.db) managed automatically."
echo -e "📖 Use 'pm2 logs $APP_NAME' to see real-time logs."
echo -e "${YELLOW}------------------------------------------------${NC}"
