# Creates a proper Windows desktop shortcut that points to the .exe file,
# not the folder. Run this from the project root in PowerShell:
#
#   .\scripts\create-shortcut.ps1
#
# The shortcut is placed on the current user's Desktop.

$exePath = Join-Path $PSScriptRoot "..\dist-electron\win-unpacked\Barmo Bookkeeping.exe"
$exePath = [System.IO.Path]::GetFullPath($exePath)

if (-not (Test-Path $exePath)) {
    Write-Error "Executable not found at: $exePath"
    Write-Error "Run 'npm run electron:build' first."
    exit 1
}

$iconPath  = Join-Path $PSScriptRoot "..\public\icon.ico"
$iconPath  = [System.IO.Path]::GetFullPath($iconPath)

$desktop   = [Environment]::GetFolderPath("Desktop")
$lnkPath   = Join-Path $desktop "Barmo Bookkeeping.lnk"

$shell     = New-Object -ComObject WScript.Shell
$shortcut  = $shell.CreateShortcut($lnkPath)

$shortcut.TargetPath       = $exePath            # <-- the actual .exe
$shortcut.WorkingDirectory = Split-Path $exePath  # must be the folder containing the exe
$shortcut.Description      = "Barmo Bookkeeping"

if (Test-Path $iconPath) {
    $shortcut.IconLocation = "$iconPath,0"
}

$shortcut.Save()

Write-Host ""
Write-Host "Desktop shortcut created:" -ForegroundColor Green
Write-Host "  $lnkPath"
Write-Host ""
Write-Host "Target: $exePath"
