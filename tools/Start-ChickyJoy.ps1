param(
    [string]$DotnetPath = '',
    [switch]$NoBrowser,
    [switch]$CheckOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$root = Split-Path -Parent $PSScriptRoot
$project = Join-Path $root 'GaGionEcommerce'
$assembly = Join-Path $root 'Run/ChickyJoy.dll'
$minimum = [Version]'8.0.25'
$server = $null
$oldRoot = $env:DOTNET_ROOT
$oldEnvironment = $env:ASPNETCORE_ENVIRONMENT
$oldDotnetEnvironment = $env:DOTNET_ENVIRONMENT
$oldMultilevel = $env:DOTNET_MULTILEVEL_LOOKUP

function Test-ChickyJoyRuntime([string]$executable) {
    if (-not (Test-Path -LiteralPath $executable -PathType Leaf)) { return $false }
    try {
        $lines = @(& $executable --list-runtimes 2>$null)
        if ($LASTEXITCODE -ne 0) { return $false }
        foreach ($name in @('Microsoft.NETCore.App', 'Microsoft.AspNetCore.App')) {
            $found = $false
            foreach ($line in $lines) {
                if ($line -match ('^' + [Regex]::Escape($name) + ' (8\.0\.\d+) ')) {
                    if ([Version]$Matches[1] -ge $minimum) { $found = $true }
                }
            }
            if (-not $found) { return $false }
        }
        return $true
    } catch { return $false }
}

function Get-ChickyJoyRuntime {
    if ($DotnetPath) {
        if (Test-ChickyJoyRuntime $DotnetPath) { return (Resolve-Path -LiteralPath $DotnetPath).Path }
        throw 'The supplied dotnet path needs both .NET and ASP.NET Core 8.0.25 or later.'
    }
    $installed = Get-Command dotnet -ErrorAction SilentlyContinue
    if ($installed -and (Test-ChickyJoyRuntime $installed.Source)) { return $installed.Source }
    if ($env:OS -ne 'Windows_NT') { throw 'Install .NET/ASP.NET Core 8, then supply -DotnetPath to this launcher.' }

    $architecture = if ($env:PROCESSOR_ARCHITEW6432) { $env:PROCESSOR_ARCHITEW6432 } else { $env:PROCESSOR_ARCHITECTURE }
    $rid = switch ($architecture.ToUpperInvariant()) { 'ARM64' { 'win-arm64' } 'AMD64' { 'win-x64' } 'X86' { 'win-x86' } default { throw 'Unsupported Windows CPU architecture.' } }
    $manifest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime-downloads.json') -Raw | ConvertFrom-Json
    $entry = $manifest.platforms.$rid
    if (-not $entry) { throw 'Missing runtime download configuration.' }
    $cache = Join-Path $env:LOCALAPPDATA ('ChickyJoy/runtime/' + $manifest.version + '/' + $rid)
    $cachedDotnet = Join-Path $cache 'dotnet.exe'
    if (Test-ChickyJoyRuntime $cachedDotnet) { return $cachedDotnet }

    Write-Host 'May chua co du .NET 8. Dang tai runtime tu Microsoft (khong can quyen Admin)...'
    [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
    $staging = Join-Path ([IO.Path]::GetTempPath()) ('ChickyJoy-runtime-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $staging -Force | Out-Null
    try {
        $unpacked = Join-Path $staging 'unpacked'
        New-Item -ItemType Directory -Path $unpacked -Force | Out-Null
        foreach ($package in @($entry.runtime, $entry.aspnetcore)) {
            $uri = [Uri]$package.url
            if ($uri.Scheme -ne 'https' -or $uri.Host -ne 'builds.dotnet.microsoft.com') { throw 'Invalid Microsoft runtime URL.' }
            $download = Join-Path $staging ([IO.Path]::GetFileName($uri.AbsolutePath))
            Invoke-WebRequest -UseBasicParsing -Uri $uri.AbsoluteUri -OutFile $download -TimeoutSec 180
            $actual = (Get-FileHash -LiteralPath $download -Algorithm SHA512).Hash
            if ($actual -ne $package.sha512) { throw 'Runtime download failed checksum verification. Try again.' }
            Expand-Archive -LiteralPath $download -DestinationPath $unpacked -Force
        }
        New-Item -ItemType Directory -Path $cache -Force | Out-Null
        Copy-Item -Path (Join-Path $unpacked '*') -Destination $cache -Recurse -Force
        if (-not (Test-ChickyJoyRuntime $cachedDotnet)) { throw 'Runtime was downloaded but could not start on this computer.' }
        return $cachedDotnet
    } finally {
        if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
    }
}

function Get-ChickyJoyPort {
    foreach ($candidate in 5157..5176) {
        $listener = $null
        try {
            $listener = [Net.Sockets.TcpListener]::new([Net.IPAddress]::Loopback, $candidate)
            $listener.Start()
            return $candidate
        } catch { } finally { if ($listener) { $listener.Stop() } }
    }
    throw 'Ports 5157-5176 are busy. Close older ChickyJoy windows and try again.'
}

try {
    foreach ($file in @($assembly, (Join-Path $root 'Run/ChickyJoy.runtimeconfig.json'), (Join-Path $project 'wwwroot/index.html'), (Join-Path $project 'Services/AssistantInstructions.md'))) {
        if (-not (Test-Path -LiteralPath $file -PathType Leaf)) { throw 'Missing application files. Extract the entire ZIP into a new folder first.' }
    }
    $dotnet = Get-ChickyJoyRuntime
    if ($CheckOnly) {
        Write-Host 'Bundle and .NET/ASP.NET Core runtime: OK'
        Write-Host ('Local server AI configuration exists: ' + (Test-Path -LiteralPath (Join-Path $root 'Secrets/openai.local.json')))
        exit 0
    }
    $port = Get-ChickyJoyPort
    $base = 'http://localhost:' + $port
    $env:DOTNET_ROOT = Split-Path -Parent $dotnet
    $env:DOTNET_MULTILEVEL_LOOKUP = '0'
    $env:ASPNETCORE_ENVIRONMENT = 'Production'
    $env:DOTNET_ENVIRONMENT = 'Production'
    $logDirectory = Join-Path $root 'Logs'
    New-Item -ItemType Directory -Path $logDirectory -Force | Out-Null
    $runId = Get-Date -Format 'yyyyMMdd-HHmmss-fff'
    $logOut = Join-Path $logDirectory ($runId + '-server.log')
    $logError = Join-Path $logDirectory ($runId + '-errors.log')
    $arguments = '"' + $assembly + '" --urls "http://0.0.0.0:' + $port + '" --contentroot "' + $project + '"'
    $server = Start-Process -FilePath $dotnet -ArgumentList $arguments -WorkingDirectory $project -PassThru -NoNewWindow -RedirectStandardOutput $logOut -RedirectStandardError $logError
    $started = $false
    for ($attempt = 0; $attempt -lt 100; $attempt++) {
        $server.Refresh()
        if ($server.HasExited) { throw ('Server could not start. See Logs/' + [IO.Path]::GetFileName($logOut) + ' and Logs/' + [IO.Path]::GetFileName($logError)) }
        try {
            $status = Invoke-RestMethod -Uri ($base + '/api/chat/status') -TimeoutSec 1
            if ($null -ne $status.available) { $started = $true; break }
        } catch { }
        Start-Sleep -Milliseconds 150
    }
    if (-not $started) { throw 'Server startup timed out. Check the Logs folder.' }
    Write-Host ('ChickyJoy da san sang: ' + $base) -ForegroundColor Green
    if ($status.available) {
        Write-Host 'Da nap cau hinh khoa AI tren may chu. Chat se bao ro neu tai khoan het so du/han muc.'
    } else {
        Write-Host 'Hoi thoai AI chua cau hinh. Tra cuu mon, gia va dia chi van hoat dong.'
    }
    Write-Host 'Giu cua so nay mo. Ctrl+C de dung. Website van mo khi AI gap loi.'
    if (-not $NoBrowser) { Start-Process $base | Out-Null }
    $server.WaitForExit()
    if ($server.ExitCode -ne 0) { throw 'Server stopped with an error. Check the Logs folder.' }
} catch {
    Write-Host ('Khong the mo ChickyJoy: ' + $_.Exception.Message) -ForegroundColor Red
    exit 1
} finally {
    if ($server) { $server.Refresh(); if (-not $server.HasExited) { Stop-Process -Id $server.Id -ErrorAction SilentlyContinue } }
    $env:DOTNET_ROOT = $oldRoot
    $env:ASPNETCORE_ENVIRONMENT = $oldEnvironment
    $env:DOTNET_ENVIRONMENT = $oldDotnetEnvironment
    $env:DOTNET_MULTILEVEL_LOOKUP = $oldMultilevel
}
