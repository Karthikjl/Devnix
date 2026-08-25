#!/usr/bin/env bash
# ==============================================================================
# DEVNIX Multi-Architecture Smart Deployment Script (ARM64 + AMD64/x86_64)
# ==============================================================================
set -e

ARCH=$(uname -m)

echo "=========================================================="
echo "⚡ DEVNIX CLOUD IDE & MULTI-LANGUAGE ENGINE"
echo "🖥️  Detected Architecture: $ARCH"
echo "=========================================================="

if [ "$1" = "--light" ] || [ "$1" = "-l" ]; then
    echo "⚡ Launching Lightweight Engine (Web + Native Runner)..."
    docker compose up -d --build web runner
    echo ""
    echo "✅ Devnix is running at http://localhost:3000"
elif [ "$ARCH" = "aarch64" ] || [ "$ARCH" = "arm64" ]; then
    echo "🚀 Detected ARM64 server (Oracle / AWS Graviton / Apple Silicon / Raspberry Pi)"
    echo "⚡ Launching Universal Native ARM64 Engine (Web + Runner)..."
    docker compose up -d --build web runner
    echo ""
    echo "✅ Devnix is running natively on ARM64 with 0 emulation overhead!"
    echo "🌐 Open: http://localhost:3000"
else
    echo "🚀 Detected $ARCH (Intel / AMD64) architecture."
    echo "⚡ Launching Full Multi-Arch Engine..."
    docker compose --profile full up -d --build
    echo ""
    echo "✅ Devnix is running with Full Engine at http://localhost:3000"
fi
