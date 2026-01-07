param(
    [string]$EnvPath = ".\.env",
    [string]$ContainerName = "dev-postgres16",
    [string]$VolumeName = "dev-postgres16-data",
    [ValidateSet("IfMissing","Always","Never")]
    [string]$Pull = "IfMissing",
    [switch]$Recreate
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

function Import-DotEnv {
    param([Parameter(Mandatory=$true)][string]$Path)

    $map = @{}
    if (-not (Test-Path $Path)) { return $map }

    foreach ($raw in Get-Content $Path) {
        $line = $raw.Trim()
        if ($line.Length -eq 0) { continue }
        if ($line.StartsWith("#")) { continue }

        $idx = $line.IndexOf("=")
        if ($idx -lt 1) { continue }

        $key = $line.Substring(0, $idx).Trim()
        $val = $line.Substring($idx + 1).Trim()

        if (($val.StartsWith('"') -and $val.EndsWith('"')) -or ($val.StartsWith("'") -and $val.EndsWith("'"))) {
            $val = $val.Substring(1, $val.Length - 2)
        }

        $map[$key] = $val
        Set-Item -Path "Env:$key" -Value $val
    }
    return $map
}

function Upsert-DotEnvPairs {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][hashtable]$Pairs
    )

    $content = @()
    if (Test-Path $Path) { $content = Get-Content $Path }

    foreach ($k in $Pairs.Keys) {
        $v = $Pairs[$k]
        $pattern = "^\s*{0}\s*=" -f [regex]::Escape($k)
        $found = $false

        for ($i=0; $i -lt $content.Count; $i++) {
            if ($content[$i] -match $pattern) {
                $content[$i] = "$k=$v"
                $found = $true
                break
            }
        }

        if (-not $found) { $content += "$k=$v" }
    }

    Set-Content -Path $Path -Value $content -Encoding UTF8
}

function Ensure-Docker {
    try { docker version | Out-Null }
    catch { throw "Docker не доступен. Убедись, что Docker Desktop запущен и docker в PATH." }
}

function Image-Exists([string]$ImageRef) {
    $out = docker images --format "{{.Repository}}:{{.Tag}}" | Select-String -SimpleMatch $ImageRef
    return [bool]$out
}

function Ensure-Image([string]$ImageRef) {
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
            if (-not (Image-Exists $ImageRef)) { throw "Образ не найден локально и Pull=Never: $ImageRef" }
            Write-Host "Pull skipped (Never), image exists: $ImageRef"
        }
    }
}

function Wait-PostgresReady([string]$Name, [int]$Seconds = 45) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $out = docker exec $Name pg_isready 2>$null
            if ($LASTEXITCODE -eq 0) { return }
        } catch {}
        Start-Sleep -Milliseconds 500
    }
    throw "PostgreSQL не стал ready за $Seconds секунд."
}

function Ensure-RoleAndDb([string]$Name, [string]$User, [string]$Db) {
    $sqlRole = "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$User') THEN CREATE ROLE $User WITH LOGIN; END IF; END $$;"
    $sqlDb   = "DO $$ BEGIN IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$Db') THEN CREATE DATABASE $Db OWNER $User; END IF; END $$;"

    $attempts = @("postgres", $User)
    foreach ($u in $attempts) {
        try {
            docker exec $Name psql -U $u -d postgres -v ON_ERROR_STOP=1 -c $sqlRole | Out-Null
            docker exec $Name psql -U $u -d postgres -v ON_ERROR_STOP=1 -c $sqlDb | Out-Null
            return
        } catch {}
    }
}

Ensure-Docker
Import-DotEnv -Path $EnvPath | Out-Null

$dbHost = if ($env:DATABASE_HOST) { $env:DATABASE_HOST } else { "127.0.0.1" }
$dbPort = if ($env:DATABASE_PORT) { [int]$env:DATABASE_PORT } else { 5432 }
$dbName = if ($env:DATABASE_NAME) { $env:DATABASE_NAME } else { "devdb" }
$dbUser = if ($env:DATABASE_USER) { $env:DATABASE_USER } else { "devuser" }
$dbPass = if ($env:DATABASE_PASS) { $env:DATABASE_PASS } else { "devpass" }

Upsert-DotEnvPairs -Path $EnvPath -Pairs @{
    "DATABASE_HOST" = $dbHost
    "DATABASE_PORT" = "$dbPort"
    "DATABASE_NAME" = $dbName
    "DATABASE_USER" = $dbUser
    "DATABASE_PASS" = $dbPass
}

Import-DotEnv -Path $EnvPath | Out-Null

$image = "postgres:16"
Ensure-Image $image

$exists = docker ps -a --format "{{.Names}}" | Select-String -SimpleMatch $ContainerName
if ($exists -and $Recreate) {
    docker rm -f $ContainerName | Out-Null
    $exists = $null
}

# ensure volume
$volExists = docker volume ls --format "{{.Name}}" | Select-String -SimpleMatch $VolumeName
if (-not $volExists) { docker volume create $VolumeName | Out-Null }

$env:POSTGRES_USER = $dbUser
$env:POSTGRES_PASSWORD = $dbPass
$env:POSTGRES_DB = $dbName

if (-not $exists) {
    docker run -d --name $ContainerName `
    -p "$dbPort`:5432" `
    --restart unless-stopped `
    -v "${VolumeName}:/var/lib/postgresql/data" `
    -e POSTGRES_USER `
    -e POSTGRES_PASSWORD `
    -e POSTGRES_DB `
    $image | Out-Null
} else {
    $running = docker ps --format "{{.Names}}" | Select-String -SimpleMatch $ContainerName
    if (-not $running) { docker start $ContainerName | Out-Null }
}

Wait-PostgresReady -Name $ContainerName -Seconds 60

Ensure-RoleAndDb -Name $ContainerName -User $dbUser -Db $dbName

Write-Host "OK: PostgreSQL 16 (Docker) запущен." -ForegroundColor Green
Write-Host "Host: $dbHost  Port: $dbPort" -ForegroundColor Green
Write-Host "DB:   $dbName  User: $dbUser" -ForegroundColor Green
Write-Host "Container: $ContainerName" -ForegroundColor Green
Write-Host "Volume:    $VolumeName" -ForegroundColor Green
Write-Host ""
Write-Host "Подключение:" -ForegroundColor Yellow
Write-Host "  psql -h $dbHost -p $dbPort -U $dbUser -d $dbName" -ForegroundColor Yellow
