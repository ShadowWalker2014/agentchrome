# agentchrome installer for Windows: puts the CLI in %USERPROFILE%\.agentchrome\bin, then runs `agentchrome setup`.
# Usage (PowerShell): irm __SERVER__/install.ps1 | iex
$ErrorActionPreference = "Stop"
$Server = if ($env:AGENT_CHROME_MCP_SERVER) { $env:AGENT_CHROME_MCP_SERVER } else { "__SERVER__" }
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Host "agentchrome needs Node.js 18 or newer: https://nodejs.org" -ForegroundColor Red; return
}
$major = [int](node -p 'process.versions.node.split(".")[0]')
if ($major -lt 18) { Write-Host "Node.js 18+ required (found $(node -v))" -ForegroundColor Red; return }
$Bin = Join-Path $HOME ".agentchrome\bin"
New-Item -ItemType Directory -Force -Path $Bin | Out-Null
$Cli = Join-Path $Bin "agentchrome.mjs"
Invoke-WebRequest -UseBasicParsing -Uri "$Server/cli.mjs" -OutFile $Cli
Set-Content -Path (Join-Path $Bin "agentchrome.cmd") -Value "@node `"%~dp0agentchrome.mjs`" %*" -Encoding ASCII
$userPath = [Environment]::GetEnvironmentVariable("Path", "User")
if (-not (($userPath -split ";") -contains $Bin)) {
  $newPath = if ($userPath) { "$userPath;$Bin" } else { $Bin }
  [Environment]::SetEnvironmentVariable("Path", $newPath, "User")
  $env:Path = "$env:Path;$Bin"
}
Write-Host "Installed agentchrome -> $Bin\agentchrome.cmd" -ForegroundColor Green
$env:AGENT_CHROME_MCP_SERVER = $Server
node $Cli setup --server $Server @args
