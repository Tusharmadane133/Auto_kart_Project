#!/bin/bash
set -e

echo "Starting AutoKart Backend as ec2-user"

cd /var/www/autokart/AutoKart-Backend

sudo -u ec2-user pm2 stop autokart || true
sudo -u ec2-user pm2 delete autokart || true

sudo -u ec2-user pm2 start index.js --name autokart
sudo -u ec2-user pm2 save