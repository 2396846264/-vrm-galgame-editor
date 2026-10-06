param(
    [string]$DotNet = 'dotnet',
    [string]$IdentityDirectory = (Join-Path $env:LOCALAPPDATA 'VRMGalgame\DeveloperIdentity'),
    [switch]$SkipWebBuild
)
$ErrorActionPreference = 'Stop'
$repository = Split-Path $PSScriptRoot -Parent
Push-Location $repository
try {
    function Invoke-Checked([string]$Program, [string[]]$Arguments) {
        & $Program @Arguments
        if ($LASTEXITCODE -ne 0) { throw "$Program failed with exit code $LASTEXITCODE" }
    }
    if (!$SkipWebBuild) {
        Invoke-Checked 'npm.cmd' @('ci')
        Invoke-Checked 'npm.cmd' @('run', 'build')
    }
    $constants = Join-Path $repository 'Desktop\obj\ProtectedBuildConstants.g.cs'
    Invoke-Checked $DotNet @('run','--project','BuildIdentity/BuildIdentity.csproj','--','generate',$IdentityDirectory,$constants,'565407768')
    Invoke-Checked $DotNet @('publish','Desktop/Desktop.csproj','-c','Release','-r','win-x64','--self-contained','true','-p:PublishSingleFile=true','-o','publish/editor')
    Invoke-Checked $DotNet @('publish','AgentHost/AgentHost.csproj','-c','Release','-r','win-x64','--self-contained','true','-p:PublishSingleFile=true','-o','publish/agent')
    $package = Join-Path $repository 'release\VRMGalgame-0.0.26-developer-win-x64'
    if (Test-Path -LiteralPath $package) { throw 'Build output already exists. Choose a clean checkout for another build.' }
    New-Item -ItemType Directory -Path $package -Force | Out-Null
    $loader = 'publish/editor/WebView2Loader.dll'
    if (!(Test-Path -LiteralPath $loader)) { $loader = 'Desktop/bin/Release/net10.0-windows/win-x64/WebView2Loader.dll' }
    Copy-Item -LiteralPath 'publish/editor/VRMGalgame.exe','publish/agent/VRMGalgame.Agent.exe',$loader,'README.md','CHANGELOG.md','RELEASE_NOTES.md' -Destination $package
    Get-ChildItem -LiteralPath . -Filter 'Agent*.json' -File | Copy-Item -Destination $package
    Copy-Item -LiteralPath 'dist' -Destination "$package/web" -Recurse
    Copy-Item -LiteralPath 'docs','preset-motions','licenses' -Destination $package -Recurse
    Invoke-Checked $DotNet @('run','--project','BuildIdentity/BuildIdentity.csproj','--','sign',$IdentityDirectory,"$package/web","$package/web.integrity.json")
    Set-Content -LiteralPath "$package/DEVELOPER-BUILD.txt" -Encoding UTF8 -Value 'This developer build uses its own encryption identity. It cannot open official encrypted projects. Keep your DeveloperIdentity directory safe. Use GitHub Releases for official compatible builds.'
    Invoke-Checked "$package/VRMGalgame.exe" @('--check-package-integrity',$package,"$package/integrity-check.json")
    $check = Get-Content -LiteralPath "$package/integrity-check.json" -Raw | ConvertFrom-Json
    if (!$check.ok) { throw 'Package integrity check failed.' }
    Compress-Archive -LiteralPath $package -DestinationPath "$package.zip" -CompressionLevel Optimal
    Write-Host "Developer package: $package.zip"
} finally { Pop-Location }
