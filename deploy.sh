#!/bin/bash

# --- Configuration ---
APP_NAME="personnel-management-app"
PORT=3000

echo "------------------------------------------------"
echo "🚀 Starting Deployment of $APP_NAME"
echo "------------------------------------------------"

# 1. Update System
echo "🔄 Updating system packages..."
sudo apt update -y

# 2. Check for Node.js
if ! command -v node &> /dev/null
then
    echo "📦 Node.js not found. Installing Node.js 20..."
    curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
    sudo apt install -y nodejs
else
    echo "✅ Node.js is already installed ($(node -v))"
fi

# 3. Install Dependencies
echo "📥 Installing project dependencies..."
npm install

# 4. Build Project
echo "🏗️ Building the application..."
npm run build

# 5. Install PM2 Globally
if ! command -v pm2 &> /dev/null
then
    echo "🔨 Installing PM2..."
    sudo npm install -g pm2
fi

# 6. Start / Restart App with PM2
echo "🚀 Starting application with PM2 on port $PORT..."
pm2 stop $APP_NAME 2>/dev/null || true
pm2 delete $APP_NAME 2>/dev/null || true

# Using the production server
PORT=$PORT pm2 start npm --name "$APP_NAME" -- run start

# 7. Save PM2 list
pm2 save

echo "------------------------------------------------"
echo "✅ Deployment Successful!"
echo "📍 Application is running on http://$(curl -s ifconfig.me):$PORT"
echo "------------------------------------------------"
echo "To monitor logs, use: pm2 logs $APP_NAME"
