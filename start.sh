#!/usr/bin/env bash
# ==============================================================================
# DEVNIX Multi-Architecture Deployment Script (ARM64 + AMD64/x86_64)
# ==============================================================================
set -e

ARCH=$(uname -m)

echo "=========================================================="
echo "⚡ DEVNIX CLOUD IDE & MULTI-LANGUAGE ENGINE"
echo "🖥️  Detected Architecture: $ARCH"
echo "=========================================================="

# The web app authenticates to the runner with a shared secret
if [ ! -f .env ] || ! grep -q '^RUNNER_TOKEN=' .env; then
    echo "🔑 Generating RUNNER_TOKEN in .env..."
    (umask 077 && echo "RUNNER_TOKEN=$(openssl rand -hex 32)" >> .env)
fi

echo "⚡ Launching Devnix (Web + Sandboxed Runner)..."
docker compose up -d --build web runner
echo ""
echo "✅ Devnix is running at http://localhost:3000"
