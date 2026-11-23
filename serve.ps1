<#
    MFT Automation Studio - local launcher
    Right-click > Run with PowerShell, or run:  .\serve.ps1
    Starts the AI backend (http://127.0.0.1:8100) and the static web app
    (http://localhost:8080), then opens the app.
#>
param([int]$Port = 8080, [int]$ApiPort = 8100)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

$url = "http://localhost:$Port/index.html"

# ---- Start the AI backend if its venv exists -------------------------------
$backend = Join-Path $here "backend"
$venvPy = Join-Path $backend ".venv\Scripts\python.exe"
if (Test-Path $venvPy) {
    Write-Host "Starting AI backend on http://127.0.0.1:$ApiPort" -ForegroundColor Cyan
    Start-Process -WindowStyle Hidden -FilePath $venvPy `
        -ArgumentList "-m", "uvicorn", "app:app", "--host", "127.0.0.1", "--port", "$ApiPort" `
        -WorkingDirectory $backend
    Start-Sleep -Seconds 3
}
else {
    Write-Host "AI backend venv not found - the AI Assistant will be offline." -ForegroundColor Yellow
    Write-Host "  cd backend; python -m venv .venv; .\.venv\Scripts\python.exe -m pip install -r requirements.txt" -ForegroundColor Yellow
}

$url = "http://localhost:$Port/index.html"
Write-Host "Serving MFT Automation Studio at $url" -ForegroundColor Yellow

# Prefer Python; fall back to Node's http-server.
$python = Get-Command python -ErrorAction SilentlyContinue
if ($python) {
    Start-Process $url
    python -m http.server $Port
}
else {
    $npx = Get-Command npx -ErrorAction SilentlyContinue
    if ($npx) {
        Start-Process $url
        npx --yes http-server -p $Port
    }
    else {
        Write-Host "Neither Python nor Node found. Install one, or open index.html directly." -ForegroundColor Red
    }
}
