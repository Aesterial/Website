param(
    [string]$EnvPath = ".\.env",
    [string]$ContainerName = "minio",
    [string]$NetworkName = "minio-net",
    [string]$DataDir = ".\minio-data",
    [ValidateSet("IfMissing","Always","Never")]
    [string]$Pull = "IfMissing",
    [switch]$Recreate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Import-DotEnv {
    param([Parameter(Mandatory=$true)][string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Файл .env не найден: $Path"
    }

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

function Ensure-Docker {
    try { docker version | Out-Null }
    catch { throw "Docker не доступен. Убедись, что Docker Desktop запущен и docker в PATH." }
}

function Image-Exists {
    param([Parameter(Mandatory=$true)][string]$ImageRef)
    $out = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String -SimpleMatch $ImageRef
    return [bool]$out
}

function Ensure-Image {
    param([Parameter(Mandatory=$true)][string]$ImageRef)

    switch ($Pull) {
        "Always" {
            Write-Host "Pulling image (Always): $ImageRef"
            docker pull $ImageRef | Out-Null
        }
        "IfMissing" {
            if (-not (Image-Exists $ImageRef)) {
                Write-Host "Pulling image (IfMissing): $ImageRef"
                docker pull $ImageRef | Out-Null
            } else {
                Write-Host "Image already exists: $ImageRef"
            }
        }
        "Never" {
            if (-not (Image-Exists $ImageRef)) {
                throw "Образ не найден локально и Pull=Never: $ImageRef"
            }
            Write-Host "Pull skipped (Never), image exists: $ImageRef"
        }
    }
}

function Ensure-Network {
    param([string]$Name)
    $exists = docker network ls --format "{{.Name}}" | Select-String -SimpleMatch $Name
    if (-not $exists) {
        docker network create $Name | Out-Null
    }
}

function Ensure-Container {
    param(
        [string]$Name,
        [string]$Network,
        [string]$DataDirHost,
        [int]$ApiHostPort,
        [int]$ConsoleHostPort,
        [string]$RootUser,
        [string]$RootPassword,
        [string]$Region,
        [string]$ImageRef
    )

    if (-not (Test-Path $DataDirHost)) {
        New-Item -ItemType Directory -Path $DataDirHost | Out-Null
    }

    $existing = docker ps -a --format "{{.Names}}" | Select-String -SimpleMatch $Name

    if ($existing -and $Recreate) {
        docker rm -f $Name | Out-Null
        $existing = $null
    }

    if (-not $existing) {
        docker run -d --name $Name `
      --network $Network `
      -p "$ApiHostPort`:9000" `
      -p "$ConsoleHostPort`:9001" `
      --env "MINIO_ROOT_USER=$RootUser" `
      --env "MINIO_ROOT_PASSWORD=$RootPassword" `
      --env "MINIO_REGION=$Region" `
      -v "${DataDirHost}:/data" `
      $ImageRef server /data --console-address ":9001" | Out-Null
    } else {
        $running = docker ps --format "{{.Names}}" | Select-String -SimpleMatch $Name
        if (-not $running) {
            docker start $Name | Out-Null
        }
    }
}

function Wait-MinIOReady {
    param([string]$Url, [int]$Seconds = 30)
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

function UrlEncode([string]$s) {
    return [System.Uri]::EscapeDataString($s)
}

Ensure-Docker
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

$minioImage = "quay.io/minio/minio:latest"
$mcImage    = "minio/mc:latest"

Ensure-Image -ImageRef $minioImage
Ensure-Image -ImageRef $mcImage

$uri = [System.Uri]$endpoint
$apiHostPort = if ($uri.Port -gt 0) { $uri.Port } else { 9000 }
$consoleHostPort = 9001

Ensure-Network -Name $NetworkName

Ensure-Container `
  -Name $ContainerName `
  -Network $NetworkName `
  -DataDirHost (Resolve-Path $DataDir).Path `
  -ApiHostPort $apiHostPort `
  -ConsoleHostPort $consoleHostPort `
  -RootUser $access `
  -RootPassword $secret `
  -Region $region `
  -ImageRef $minioImage

Wait-MinIOReady -Url "http://127.0.0.1:$apiHostPort/minio/health/ready" -Seconds 45

$userEnc = UrlEncode $access
$passEnc = UrlEncode $secret
$mcHost  = "http://$userEnc`:$passEnc@$ContainerName`:9000"

docker run --rm --network $NetworkName `
  --env "MC_HOST_local=$mcHost" `
  $mcImage mb --ignore-existing "local/$bucket" | Out-Null

Write-Host "OK: MinIO запущен." -ForegroundColor Green
Write-Host "API:     http://127.0.0.1:$apiHostPort" -ForegroundColor Green
Write-Host "Console: http://127.0.0.1:$consoleHostPort" -ForegroundColor Green
Write-Host "Bucket:  $bucket" -ForegroundColor Green
Write-Host ""
Write-Host "Чтобы переменные из .env остались в текущей сессии, запускай так:" -ForegroundColor Yellow
Write-Host "  . .\start-minio-docker.ps1" -ForegroundColor Yellow
Write-Host ""
Write-Host "Pull modes: -Pull IfMissing | Always | Never" -ForegroundColor DarkGray
