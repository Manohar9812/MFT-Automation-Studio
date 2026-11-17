<#
    MFT Automation Studio - local launcher
    Right-click > Run with PowerShell, or run:  .\serve.ps1
    Starts a static web server on http://localhost:8080 and opens the app.
#>
param([int]$Port = 8080)

$here = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $here

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
