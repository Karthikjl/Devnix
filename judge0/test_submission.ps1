$body = @{
    language_id = 71
    source_code = "print('Hello from Judge0! Calculation: 5 * 10 =', 5 * 10)"
} | ConvertTo-Json

$response = Invoke-RestMethod -Uri "http://localhost:2358/submissions?base64_encoded=false&wait=true" `
    -Method POST `
    -Headers @{ "Content-Type" = "application/json" } `
    -Body $body

Write-Host "=== Submission Status ===" -ForegroundColor Cyan
Write-Host "Status: $($response.status.description)" -ForegroundColor Green
Write-Host "Stdout: $($response.stdout)" -ForegroundColor Yellow
Write-Host "Time: $($response.time)s | Memory: $($response.memory) KB" -ForegroundColor Gray
