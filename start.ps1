# ==============================================================================
# DEVNIX Multi-Architecture Smart Deployment Script (Windows PowerShell)
# ==============================================================================
param (
    [switch]$Light
)

$arch = $env:PROCESSOR_ARCHITECTURE

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "⚡ DEVNIX CLOUD IDE & MULTI-LANGUAGE ENGINE" -ForegroundColor Yellow
Write-Host "🖥️  Detected Architecture: $arch" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

if ($Light -or ($arch -match "ARM64")) {
    Write-Host "🚀 Launching Universal Native Engine (Web + Runner)..." -ForegroundColor Green
    docker compose up -d --build web runner
    Write-Host "✅ Devnix is running at http://localhost:3000" -ForegroundColor Green
} else {
    Write-Host "🚀 Detected $arch (Intel / AMD64). Launching Full Multi-Arch Engine..." -ForegroundColor Green
    docker compose --profile full up -d --build
    Write-Host "✅ Devnix is running with Full Engine at http://localhost:3000" -ForegroundColor Green
}
