#!/bin/bash
set -e

echo "Stopping AutoKart Backend"

pm2 stop autokart || true
pm2 delete autokart || true
