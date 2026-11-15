# ==============================================================================
# DEVNIX Multi-Architecture Deployment Script (Windows PowerShell)
# ==============================================================================

$arch = $env:PROCESSOR_ARCHITECTURE

Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "⚡ DEVNIX CLOUD IDE & MULTI-LANGUAGE ENGINE" -ForegroundColor Yellow
Write-Host "🖥️  Detected Architecture: $arch" -ForegroundColor Cyan
Write-Host "==========================================================" -ForegroundColor Cyan

# The web app authenticates to the runner with a shared secret
if (-not (Test-Path .env) -or -not (Select-String -Path .env -Pattern '^RUNNER_TOKEN=' -Quiet)) {
    Write-Host "🔑 Generating RUNNER_TOKEN in .env..." -ForegroundColor Yellow
    $bytes = New-Object byte[] 32
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
    Add-Content -Path .env -Value ("RUNNER_TOKEN=" + (($bytes | ForEach-Object { $_.ToString("x2") }) -join ""))
}

Write-Host "🚀 Launching Devnix (Web + Sandboxed Runner)..." -ForegroundColor Green
docker compose up -d --build web runner
Write-Host "✅ Devnix is running at http://localhost:3000" -ForegroundColor Green
