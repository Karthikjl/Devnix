#!/bin/sh
set -e

# Ensure data directory exists
mkdir -p /app/data 2>/dev/null || true

# If running as root, fix permissions and drop privileges to nextjs user
if [ "$(id -u)" = "0" ]; then
  chown -R nextjs:nodejs /app/data 2>/dev/null || true
  chmod 775 /app/data 2>/dev/null || true
  chmod 666 /var/run/docker.sock 2>/dev/null || true
  exec su-exec nextjs "$@"
else
  exec "$@"
fi
