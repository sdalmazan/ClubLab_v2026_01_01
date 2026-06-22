# ClubLab — Environment Variables Cleanup Script
# Run this in a PowerShell window as Administrator to clean up old registry environment variables

Write-Host "Cleaning up NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY..." -ForegroundColor Cyan

# 1. Remove User variables
[Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", $null, "User")
[Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", $null, "User")
Write-Host "✅ User environment variables cleaned up." -ForegroundColor Green

# 2. Remove Machine variables (requires Admin rights)
try {
    [Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_URL", $null, "Machine")
    [Environment]::SetEnvironmentVariable("NEXT_PUBLIC_SUPABASE_ANON_KEY", $null, "Machine")
    Write-Host "✅ System-wide machine environment variables cleaned up." -ForegroundColor Green
} catch {
    Write-Host "⚠️ Could not remove Machine variables (requires running PowerShell as Administrator)." -ForegroundColor Yellow
}

Write-Host "`nCRITICAL: Please close ALL terminal windows (Git Bash, VS Code, cmd) and reopen them for the changes to take effect." -ForegroundColor Magenta
