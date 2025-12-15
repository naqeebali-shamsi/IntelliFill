# PowerShell script to create .wslconfig for Docker Desktop WSL2
# Run this script as Administrator or with appropriate permissions

$wslConfigPath = "$env:USERPROFILE\.wslconfig"
$wslConfigContent = @"
[wsl2]
memory=8GB
processors=4
swap=4GB
localhostForwarding=true
"@

try {
    Write-Host "Creating .wslconfig at: $wslConfigPath" -ForegroundColor Cyan

    # Backup existing file if it exists
    if (Test-Path $wslConfigPath) {
        $backupPath = "$wslConfigPath.backup.$(Get-Date -Format 'yyyyMMdd-HHmmss')"
        Write-Host "Backing up existing .wslconfig to: $backupPath" -ForegroundColor Yellow
        Copy-Item -Path $wslConfigPath -Destination $backupPath
    }

    # Write new configuration
    Set-Content -Path $wslConfigPath -Value $wslConfigContent -Encoding UTF8

    Write-Host "Successfully created .wslconfig" -ForegroundColor Green
    Write-Host "`nConfiguration written:" -ForegroundColor Cyan
    Get-Content $wslConfigPath

    Write-Host "`nIMPORTANT: You must restart WSL2 for changes to take effect:" -ForegroundColor Yellow
    Write-Host "  1. Close Docker Desktop" -ForegroundColor White
    Write-Host "  2. Run: wsl --shutdown" -ForegroundColor White
    Write-Host "  3. Start Docker Desktop again" -ForegroundColor White

} catch {
    Write-Host "Error creating .wslconfig: $_" -ForegroundColor Red
    Write-Host "`nManual creation steps:" -ForegroundColor Yellow
    Write-Host "  1. Open Notepad as Administrator" -ForegroundColor White
    Write-Host "  2. Copy the configuration shown below" -ForegroundColor White
    Write-Host "  3. Save to: $wslConfigPath" -ForegroundColor White
    Write-Host "`nConfiguration to copy:" -ForegroundColor Cyan
    Write-Host $wslConfigContent
}
