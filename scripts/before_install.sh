#!/bin/bash
set -e
set -x

echo "==============================="
echo "BeforeInstall: Preparing system"
echo "==============================="

APP_DIR="/var/www/autokart"
BACKEND_DIR="$APP_DIR/AutoKart-Backend"
FRONTEND_DIR="$APP_DIR/AutoKart-Frontend"

# --------------------------------------------------
# Ensure base directory exists
# --------------------------------------------------
mkdir -p "$APP_DIR"

# --------------------------------------------------
# Install Node.js if missing
# --------------------------------------------------
if ! command -v node >/dev/null 2>&1; then
  echo "Installing Node.js 20..."
  curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
  yum install -y nodejs
else
  echo "Node already installed: $(node -v)"
fi

# --------------------------------------------------
# Install PM2 if missing
# --------------------------------------------------
if ! command -v pm2 >/dev/null 2>&1; then
  echo "Installing PM2..."
  npm install -g pm2
else
  echo "PM2 already installed"
fi

# --------------------------------------------------
# Ensure deployment directories exist
# --------------------------------------------------
mkdir -p "$BACKEND_DIR"
mkdir -p "$FRONTEND_DIR"

# --------------------------------------------------
# CLEAN OLD BUILD (preserve hidden files like .env)
# --------------------------------------------------
echo "Cleaning Backend (preserving hidden files)..."
rm -rf "$BACKEND_DIR"/* || true

echo "Cleaning Frontend (preserving hidden files)..."
rm -rf "$FRONTEND_DIR"/* || true

# --------------------------------------------------
# Ensure ownership for deployment user
# --------------------------------------------------
chown -R ec2-user:ec2-user "$APP_DIR"

echo "BeforeInstall completed successfully"