# Mavri quickstart for Windows (PowerShell).
#
# Runs Mavri inside WSL2, Windows' built-in Linux subsystem, using the
# open-source Docker Engine, so Docker Desktop is not needed. The script:
#   1. turns on WSL2 with Ubuntu if it is not there yet,
#   2. installs the Docker command for Windows (winget: Docker.DockerCLI) so
#      "docker" also works in PowerShell,
#   3. runs the Linux quickstart inside WSL2, which installs Docker Engine and
#      git if needed, downloads Mavri and starts it.
#
# Usage (run in PowerShell):
#   irm https://raw.githubusercontent.com/Raktim94/mavri/main/scripts/quickstart.ps1 | iex
#
# Safe to re-run. One thing no script can avoid: the first time WSL2 is
# enabled on a PC, Windows needs one restart. If the script asks for it,
# restart and run the same command again. It carries on where it stopped.

$ErrorActionPreference = "Stop"
Set-Location $HOME

$distroName = "Ubuntu"
$linuxQuickstartUrl = "https://raw.githubusercontent.com/Raktim94/mavri/main/scripts/quickstart.sh"

# winget updates PATH in the registry, but this running PowerShell keeps an old
# copy. Rebuild it from both scopes, as a new terminal would.
function Update-SessionPath {
    $machinePath = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    $env:Path = "$machinePath;$userPath"
}

# "wsl -l -q" prints UTF-16, which PowerShell shows with a null byte after
# every character. Strip them before comparing names.
function Get-FirstWslDistro {
    $raw = (wsl.exe -l -q 2>$null)
    if (-not $raw) { return $null }
    $names = $raw | ForEach-Object { ($_ -replace "`0", "").Trim() } | Where-Object { $_ -ne "" }
    return $names | Select-Object -First 1
}

Write-Host "==> Checking for WSL2 (used instead of Docker Desktop)..."
$wslReady = $false
try { wsl.exe --status *> $null; $wslReady = ($LASTEXITCODE -eq 0) } catch { $wslReady = $false }
$existingDistro = if ($wslReady) { Get-FirstWslDistro } else { $null }

if (-not $existingDistro) {
    Write-Host "==> Installing WSL2 with Ubuntu..."
    wsl.exe --install -d $distroName --no-launch
    Start-Sleep -Seconds 3

    $existingDistro = Get-FirstWslDistro
    if ($existingDistro) {
        try { wsl.exe -d $existingDistro -u root -- true *> $null } catch {}
    }
    if (-not $existingDistro -or $LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "WSL2 was just installed. Windows needs one restart to finish turning it on." -ForegroundColor Yellow
        Write-Host "Restart your PC, then run this same command again. It continues from here." -ForegroundColor Yellow
        exit 0
    }
}

$distroName = $existingDistro
Write-Host "Using WSL distribution: $distroName"

if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Host "==> Installing the Docker command for Windows with winget (not Docker Desktop)..."
        winget install -e --id Docker.DockerCLI --accept-source-agreements --accept-package-agreements
        Update-SessionPath
    } else {
        Write-Host "winget is not available, so the Windows 'docker' command is skipped. Mavri still installs and runs inside WSL2." -ForegroundColor Yellow
    }
}

Write-Host "==> Installing and starting Mavri inside WSL2 (Docker Engine and git are installed there if needed)..."
wsl.exe -d $distroName -u root -- bash -lc "curl -fsSL $linuxQuickstartUrl | bash"

Write-Host ""
Write-Host "Mavri is running." -ForegroundColor Green
Write-Host "Open http://localhost:3001 in your Windows browser. WSL2 forwards the port for you." -ForegroundColor Green
Write-Host "To see the logs later, run: wsl -u root -- bash -lc `"cd ~/mavri && docker compose logs`"" -ForegroundColor Green
