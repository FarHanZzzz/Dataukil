[CmdletBinding(PositionalBinding=$false)]
param(
    [ValidateRange(1024,65535)][int]$Port = 8000,
    [switch]$Restart,
    [switch]$Reload,
    [switch]$Check,
    [Parameter(ValueFromRemainingArguments=$true)][string[]]$LaunchArguments
)
if ($LaunchArguments.Count -gt 0) {
    $tracefixExtra = ($LaunchArguments -join ' ').Trim()
    if ($tracefixExtra -match '^\-\s+Restart$') {
        $Restart = $true
    } else {
        throw 'Unknown launcher arguments. Use: .\run.ps1 -Restart (no space between - and Restart). For a different port, use: .\run.ps1 -Port 8001'
    }
}
& (Join-Path $PSScriptRoot 'scripts\start.ps1') -Port $Port -Restart:$Restart -Reload:$Reload -Check:$Check
exit $LASTEXITCODE
