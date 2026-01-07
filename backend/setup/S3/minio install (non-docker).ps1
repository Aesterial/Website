param(
    [string]$EnvPath = ".\.env",
    [string]$InstallDir = "C:\minio",
    [string]$DataDir = "C:\minio\data",
    [string]$ServiceName = "MinIO",
    [switch]$RecreateService
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Is-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Relaunch-AsAdmin {
    param([string[]]$Args)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "powershell.exe"
    $psi.Arguments = $Args -join " "
    $psi.Verb = "runas"
    [System.Diagnostics.Process]::Start($psi) | Out-Null
}

function Import-DotEnv {
    param([Parameter(Mandatory=$true)][string]$Path)

    if (-not (Test-Path $Path)) { throw "Файл .env не найден: $Path" }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0) { return }
        if ($line.StartsWith("#")) { return }

        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { return }

        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()

        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }

        Set-Item -Path "Env:$key" -Value $val
    }
}

function Download-File {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [Parameter(Mandatory=$true)][string]$OutFile
    )
    Write-Host "Downloading $Url -> $OutFile"
    Invoke-WebRequest -Uri $Url -OutFile $OutFile -UseBasicParsing
}

function Wait-MinIOReady {
    param([string]$Url, [int]$Seconds = 45)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 2 | Out-Null
            return
        } catch {
            Start-Sleep -Milliseconds 500
        }
    }
    throw "MinIO не стал ready за $Seconds секунд: $Url"
}

if (-not (Is-Admin)) {
    Write-Host "Нужно запустить от администратора (для установки сервиса). Перезапускаю..." -ForegroundColor Yellow

    $args = @(
        "-ExecutionPolicy Bypass",
        "-File `"$PSCommandPath`"",
        "-EnvPath `"$EnvPath`"",
        "-InstallDir `"$InstallDir`"",
        "-DataDir `"$DataDir`"",
        "-ServiceName `"$ServiceName`""
    )
    if ($RecreateService) { $args += "-RecreateService" }

    Relaunch-AsAdmin -Args $args
    exit
}

Import-DotEnv -Path $EnvPath

$endpoint = $env:STORAGE_ENDPOINT
$bucket   = $env:STORAGE_BUCKET
$access   = $env:STORAGE_ACCESS_KEY
$secret   = $env:STORAGE_SECRET_KEY
$region   = $env:STORAGE_REGION

if (-not $endpoint) { throw "В .env нет STORAGE_ENDPOINT" }
if (-not $bucket)   { throw "В .env нет STORAGE_BUCKET" }
if (-not $access)   { throw "В .env нет STORAGE_ACCESS_KEY" }
if (-not $secret)   { throw "В .env нет STORAGE_SECRET_KEY" }
if (-not $region)   { $region = "us-east-1" }

$uri = [System.Uri]$endpoint
$apiPort = if ($uri.Port -gt 0) { $uri.Port } else { 9000 }
$consolePort = 9001

New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null

$minioExe = Join-Path $InstallDir "minio.exe"
$mcExe    = Join-Path $InstallDir "mc.exe"

if (-not (Test-Path $minioExe)) {
    Download-File -Url "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile $minioExe
}
if (-not (Test-Path $mcExe)) {
    Download-File -Url "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile $mcExe
}

[Environment]::SetEnvironmentVariable("MINIO_ROOT_USER", $access, "Machine")
[Environment]::SetEnvironmentVariable("MINIO_ROOT_PASSWORD", $secret, "Machine")
[Environment]::SetEnvironmentVariable("MINIO_REGION", $region, "Machine")

$svc = Get-Service -Name $ServiceName -ErrorAction SilentlyContinue

if ($svc -and $RecreateService) {
    if ($svc.Status -ne "Stopped") { Stop-Service -Name $ServiceName -Force }
    sc.exe delete $ServiceName | Out-Null
    Start-Sleep -Seconds 1
    $svc = $null
}

if (-not $svc) {
    # binPath важно: кавычки вокруг пути + аргументы
    $binPath = "`"$minioExe`" server `"$DataDir`" --address `":$apiPort`" --console-address `":$consolePort`""

    sc.exe create $ServiceName binPath= $binPath start= auto | Out-Null
}

Start-Service -Name $ServiceName

Wait-MinIOReady -Url "http://127.0.0.1:$apiPort/minio/health/ready" -Seconds 60

& $mcExe alias set local "http://127.0.0.1:$apiPort" $access $secret | Out-Null
& $mcExe mb --ignore-existing "local/$bucket" | Out-Null

Write-Host "OK: MinIO установлен как Windows Service: $ServiceName" -ForegroundColor Green
Write-Host "API:     http://127.0.0.1:$apiPort" -ForegroundColor Green
Write-Host "Console: http://127.0.0.1:$consolePort" -ForegroundColor Green
Write-Host "Bucket:  $bucket" -ForegroundColor Green
