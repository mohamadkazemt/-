#!/bin/bash

# ==============================================================================
# Intelligent Personnel Management System - Auto Installer
# This script installs Node.js, Git, PM2, and sets up the application.
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
REPO_URL="https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git"

echo -e "${YELLOW}------------------------------------------------${NC}"
echo -e "${GREEN}   Intelligent Personnel Management System      ${NC}"
echo -e "${YELLOW}------------------------------------------------${NC}"

# 1. Root Check
if [ "$EUID" -ne 0 ]; then
  echo -e "${RED}Please run as root or using sudo.${NC}"
  exit 1
fi

# 2. Update & Basic Tools
echo -e "${YELLOW}[1/6] Updating system and installing base tools...${NC}"
apt update -y && apt install -y curl git build-essential

# 3. Install Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[2/6] Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo -e "${GREEN}✅ Node.js is already installed ($(node -v))${NC}"
fi

# 4. Clone / Update Repository
if [ ! -d "$DEFAULT_INSTALL_DIR" ]; then
    echo -e "${YELLOW}[3/6] Cloning repository to $DEFAULT_INSTALL_DIR...${NC}"
    # If the user is running this from a local copy, we might need a different logic.
    # But for a 'curl | bash' style, we need to clone.
    echo -e "${YELLOW}Please enter your GitHub Repo URL (or press Enter for default):${NC}"
    read -r input_url
    if [ ! -z "$input_url" ]; then REPO_URL=$input_url; fi
    
    git clone "$REPO_URL" "$DEFAULT_INSTALL_DIR"
    cd "$DEFAULT_INSTALL_DIR" || exit
else
    echo -e "${YELLOW}[3/6] Project directory exists. Pulling latest changes...${NC}"
    cd "$DEFAULT_INSTALL_DIR" || exit
    git pull
fi

# 5. Install Dependencies & Build
echo -e "${YELLOW}[4/6] Installing dependencies and building...${NC}"
npm install
npm run build

# 6. Setup PM2
echo -e "${YELLOW}[5/6] Setting up PM2 for process management...${NC}"
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# 7. Start the application
echo -e "${YELLOW}[6/6] Starting application...${NC}"
pm2 stop "$APP_NAME" 2>/dev/null || true
pm2 delete "$APP_NAME" 2>/dev/null || true
# Running our production express server
PORT=3000 pm2 start npm --name "$APP_NAME" -- run start

# Save PM2 state for auto-reboot
pm2 save
# Optional: Setup startup script
pm2 startup | tail -n 1 | bash

echo -e "${YELLOW}------------------------------------------------${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "📍 Your app is running at: ${YELLOW}http://$(curl -s ifconfig.me):3000${NC}"
echo -e "📖 Use 'pm2 logs $APP_NAME' to see real-time logs."
echo -e "${YELLOW}------------------------------------------------${NC}"
