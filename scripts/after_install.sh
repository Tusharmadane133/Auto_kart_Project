#!/bin/bash
set -e
set -x


echo "==============================="
echo "AfterInstall: Finalizing deployment"
echo "==============================="

APP_DIR="/var/www/autokart"
DATA_DIR="/var/www/autokart-data"


BACKEND_DIR="$APP_DIR/AutoKart-Backend"
FRONTEND_DIR="$APP_DIR/AutoKart-Frontend"

PERSIST_UPLOAD_DIR="$DATA_DIR/uploads"
FRONTEND_LINK="$FRONTEND_DIR/public/uploads"

# --------------------------------------------------
# Install backend dependencies
# --------------------------------------------------
cd "$BACKEND_DIR"
npm install --production

# --------------------------------------------------
# Ensure persistent uploads directory exists
# --------------------------------------------------
mkdir -p "$PERSIST_UPLOAD_DIR"

# --------------------------------------------------
# Remove uploads folder created by CodeDeploy
# --------------------------------------------------
rm -rf "$FRONTEND_LINK"

# --------------------------------------------------
# Create symlink to persistent storage
# --------------------------------------------------
ln -s "$PERSIST_UPLOAD_DIR" "$FRONTEND_LINK"

# --------------------------------------------------
# Fix permissions
# --------------------------------------------------
chown -R ec2-user:ec2-user "$DATA_DIR"
chmod -R 755 "$DATA_DIR"

echo "Persistent uploads linked successfully"
echo "AfterInstall completed"