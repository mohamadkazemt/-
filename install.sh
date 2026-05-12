#!/bin/bash

# ==============================================================================
# Intelligent Personnel Management System - Auto Installer (MySQL Edition)
# This script installs Node.js, MySQL, Git, PM2, and sets up the application.
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
echo -e "${YELLOW}[1/7] Updating system and installing base tools...${NC}"
apt update -y && apt install -y curl git build-essential

# 3. Install Node.js
if ! command -v node &> /dev/null; then
    echo -e "${YELLOW}[2/7] Installing Node.js 20...${NC}"
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
else
    echo -e "${GREEN}✅ Node.js is already installed ($(node -v))${NC}"
fi

# 4. Install MySQL Server
if ! command -v mysql &> /dev/null; then
    echo -e "${YELLOW}[3/7] Installing MySQL Server...${NC}"
    apt install -y mysql-server
    systemctl start mysql
    systemctl enable mysql
else
    echo -e "${GREEN}✅ MySQL is already installed.${NC}"
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
    git pull
fi

# 6. Environment & Database Setup
echo -e "${YELLOW}[5/7] Setting up Environment and Database...${NC}"

# Get Database Details
echo -e "${GREEN}--- Database Configuration ---${NC}"
read -p "MySQL Host [localhost]: " db_host
db_host=${db_host:-localhost}
read -p "MySQL User [root]: " db_user
db_user=${db_user:-root}
read -s -p "MySQL Password: " db_pass
echo ""
read -p "MySQL Database Name [personnel_db]: " db_name
db_name=${db_name:-personnel_db}

# Get Admin Details
echo -e "${GREEN}--- Admin User Configuration ---${NC}"
read -p "Admin Email [admin@example.com]: " admin_email
admin_email=${admin_email:-admin@example.com}
read -s -p "Admin Password: " admin_pass
echo ""

# Generate random JWT Secret
jwt_secret=$(head /dev/urandom | tr -dc A-Za-z0-9 | head -c 32 ; echo '')

# Create .env file
cat <<EOF > .env
# MySQL Configuration
MYSQL_HOST=$db_host
MYSQL_USER=$db_user
MYSQL_PASSWORD=$db_pass
MYSQL_DATABASE=$db_name
MYSQL_PORT=3306

# Authentication
JWT_SECRET=$jwt_secret
ADMIN_USER=$admin_email
ADMIN_PASSWORD=$admin_pass
EOF

echo -e "${GREEN}✅ .env file created successfully.${NC}"

# Attempt to create database and run db.sql
echo -e "${YELLOW}Attempting to initialize database...${NC}"
mysql -h"$db_host" -u"$db_user" "-p$db_pass" -e "CREATE DATABASE IF NOT EXISTS $db_name;" 2>/dev/null
mysql -h"$db_host" -u"$db_user" "-p$db_pass" "$db_name" < db.sql 2>/dev/null

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Database initialized successfully.${NC}"
else
    echo -e "${RED}⚠️  Could not initialize database automatically. Please check your credentials and run db.sql manually.${NC}"
fi

# 7. Install Dependencies & Build
echo -e "${YELLOW}[6/7] Installing dependencies and building...${NC}"
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
# Optional: Setup startup script
pm2 startup | tail -n 1 | bash

echo -e "${YELLOW}------------------------------------------------${NC}"
echo -e "${GREEN}✅ Installation Complete!${NC}"
echo -e "📍 Your app is running at: ${YELLOW}http://$(curl -s ifconfig.me):3000${NC}"
echo -e "📖 IMPORTANT: Ensure you have configured .env and executed db.sql if not done.${NC}"
echo -e "📖 Use 'pm2 logs $APP_NAME' to see real-time logs."
echo -e "${YELLOW}------------------------------------------------${NC}"
