#!/bin/sh
set -e

# Ensure data directory exists and has write permissions for nextjs user
mkdir -p /app/data
chown -R nextjs:nodejs /app/data
chmod 775 /app/data

# Ensure docker socket is accessible if mounted
chmod 666 /var/run/docker.sock 2>/dev/null || true

# Switch to nextjs user and execute the command
exec su-exec nextjs "$@"
