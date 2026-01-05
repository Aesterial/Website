param(
    [string]$EnvPath = ".\.env",
    [string]$ScoopRoot = "C:\Scoop",
    [string]$ScoopGlobal = "C:\ProgramData\scoop",
    [string]$PgData = "C:\ProgramData\Postgres16\data",
    [string]$PgLog = "C:\ProgramData\Postgres16\pg.log",
    [int]$PgPort = 5432,
    [switch]$WriteMachineEnv
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Import-DotEnv {
    param([Parameter(Mandatory=$true)][string]$Path)

    if (-not (Test-Path $Path)) {
        throw "Файл .env не найден: $Path"
    }

    $map = @{}
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

function Upsert-DotEnvBlock {
    param(
        [Parameter(Mandatory=$true)][string]$Path,
        [Parameter(Mandatory=$true)][hashtable]$Pairs
    )

    $content = @()
    if (Test-Path $Path) { $content = Get-Content $Path }

    foreach ($k in $Pairs.Keys) {
        $v = $Pairs[$k]

        $needsQuotes = $false
        if ($null -eq $v) { $v = "" }
        if ($v -match '[\s#=]' -or $v -match '[`"]') { $needsQuotes = $true }

        if ($needsQuotes) {
            $escaped = $v -replace '"', '\"'
            $vOut = '"' + $escaped + '"'
        } else {
            $vOut = $v
        }

        $pattern = "^\s*{0}\s*=" -f [regex]::Escape($k)
        $found = $false

        for ($i=0; $i -lt $content.Count; $i++) {
            if ($content[$i] -match $pattern) {
                $content[$i] = "$k=$vOut"
                $found = $true
                break
            }
        }

        if (-not $found) {
            $content += "$k=$vOut"
        }
    }

    Set-Content -Path $Path -Value $content -Encoding UTF8
}

function Ensure-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    if (-not $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)) {
        throw "Нужно запустить PowerShell от администратора."
    }
}

function Ensure-Dir([string]$p) {
    if (-not (Test-Path $p)) { New-Item -ItemType Directory -Force $p | Out-Null }
}

function Ensure-PathEntryMachine([string]$p) {
    if (-not ($env:Path -split ";" | Where-Object { $_ -ieq $p })) {
        $env:Path = ($env:Path.TrimEnd(";") + ";" + $p).TrimStart(";")
    }

    $machinePath = [Environment]::GetEnvironmentVariable("Path", "Machine")
    if ([string]::IsNullOrWhiteSpace($machinePath)) {
        $newPath = $p
    } else {
        if (-not ($machinePath -split ";" | Where-Object { $_ -ieq $p })) {
            $newPath = ($machinePath.TrimEnd(";") + ";" + $p)
        } else {
            $newPath = $machinePath
        }
    }

    [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")
}

function Wait-Port([string]$Host, [int]$Port, [int]$Seconds = 30) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try {
            $client = New-Object Net.Sockets.TcpClient
            $iar = $client.BeginConnect($Host, $Port, $null, $null)
            if ($iar.AsyncWaitHandle.WaitOne(500)) {
                $client.EndConnect($iar)
                $client.Close()
                return
            }
            $client.Close()
        } catch {}
        Start-Sleep -Milliseconds 250
    }
    throw "Порт $Host:$Port не открылся за $Seconds секунд."
}

function Psql-Do {
    param(
        [Parameter(Mandatory=$true)][string]$PsqlExe,
        [Parameter(Mandatory=$true)][string]$Sql,
        [string]$Db = "postgres",
        [string]$User = "postgres",
        [string]$Password
    )

    $old = $env:PGPASSWORD
    try {
        if ($Password) { $env:PGPASSWORD = $Password } else { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
        & $PsqlExe -h 127.0.0.1 -p $PgPort -U $User -d $Db -v ON_ERROR_STOP=1 -X -c $Sql
        if ($LASTEXITCODE -ne 0) { throw "psql failed ($LASTEXITCODE)" }
    } finally {
        if ($null -ne $old) { $env:PGPASSWORD = $old } else { Remove-Item Env:\PGPASSWORD -ErrorAction SilentlyContinue }
    }
}

Ensure-Admin

$envMap = @{}
if (Test-Path $EnvPath) {
    $envMap = Import-DotEnv -Path $EnvPath
}

Set-ExecutionPolicy -Scope LocalMachine RemoteSigned -Force

$SCOOP_ROOT   = $ScoopRoot
$SCOOP_GLOBAL = $ScoopGlobal

Ensure-Dir $SCOOP_ROOT
Ensure-Dir $SCOOP_GLOBAL

[Environment]::SetEnvironmentVariable("SCOOP", $SCOOP_ROOT, "Machine")
[Environment]::SetEnvironmentVariable("SCOOP_GLOBAL", $SCOOP_GLOBAL, "Machine")
$env:SCOOP = $SCOOP_ROOT
$env:SCOOP_GLOBAL = $SCOOP_GLOBAL

if (-not (Get-Command scoop -ErrorAction SilentlyContinue)) {
    iex "& {$(irm get.scoop.sh)} -RunAsAdmin -ScoopDir `"$SCOOP_ROOT`" -ScoopGlobalDir `"$SCOOP_GLOBAL`""
}

Ensure-PathEntryMachine "$SCOOP_ROOT\shims"
Ensure-PathEntryMachine "$SCOOP_GLOBAL\shims"

scoop install -g git 7zip | Out-Null
scoop bucket add versions | Out-Null
scoop install -g postgresql16 | Out-Null

$PGDATA = $PgData
$LOG    = $PgLog
Ensure-Dir $PGDATA
Ensure-Dir (Split-Path $LOG)

& icacls $PGDATA /grant "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /T | Out-Null
& icacls (Split-Path $LOG) /grant "*S-1-5-18:(OI)(CI)F" "*S-1-5-32-544:(OI)(CI)F" /T | Out-Null

$PGPREFIX = (scoop prefix postgresql16 -g)
$initdb = Join-Path $PGPREFIX "bin\initdb.exe"
$pgctl  = Join-Path $PGPREFIX "bin\pg_ctl.exe"
$psql   = Join-Path $PGPREFIX "bin\psql.exe"

$postgresPw = if ($env:POSTGRES_SUPER_PASS) { $env:POSTGRES_SUPER_PASS } elseif ($env:DATABASE_PASS) { $env:DATABASE_PASS } else { "devpass" }

if (-not (Test-Path (Join-Path $PGDATA "PG_VERSION"))) {
    $pwfile = Join-Path $env:TEMP ("pgpw_" + [guid]::NewGuid().ToString("N") + ".txt")
    Set-Content -NoNewline -Encoding ASCII $pwfile $postgresPw
    & $initdb -D $PGDATA -U postgres -A scram-sha-256 -E UTF8 --pwfile $pwfile
    Remove-Item $pwfile -Force
}

$portOpen = $false
try {
    $c = New-Object Net.Sockets.TcpClient
    $iar = $c.BeginConnect("127.0.0.1", $PgPort, $null, $null)
    if ($iar.AsyncWaitHandle.WaitOne(300)) {
        $c.EndConnect($iar)
        $portOpen = $true
    }
    $c.Close()
} catch { $portOpen = $false }

if (-not $portOpen) {
    & $pgctl -D $PGDATA -l $LOG -o "-p $PgPort" start | Out-Null
}
Wait-Port -Host "127.0.0.1" -Port $PgPort -Seconds 30

$dbHost = if ($env:DATABASE_HOST) { $env:DATABASE_HOST } else { "127.0.0.1" }
$dbPort = if ($env:DATABASE_PORT) { $env:DATABASE_PORT } else { "$PgPort" }
$dbName = if ($env:DATABASE_NAME) { $env:DATABASE_NAME } else { "devdb" }
$dbUser = if ($env:DATABASE_USER) { $env:DATABASE_USER } else { "devuser" }
$dbPass = if ($env:DATABASE_PASS) { $env:DATABASE_PASS } else { "devpass" }

$createRoleSql = @"
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = '$dbUser') THEN
    EXECUTE format('CREATE ROLE %I WITH LOGIN PASSWORD %L', '$dbUser', '$dbPass');
  END IF;
END
\$\$;
"@

$createDbSql = @"
DO \$\$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_database WHERE datname = '$dbName') THEN
    EXECUTE format('CREATE DATABASE %I OWNER %I', '$dbName', '$dbUser');
  END IF;
END
\$\$;
"@

Psql-Do -PsqlExe $psql -Sql $createRoleSql -Db "postgres" -User "postgres" -Password $postgresPw
Psql-Do -PsqlExe $psql -Sql $createDbSql   -Db "postgres" -User "postgres" -Password $postgresPw

$TaskName = "PostgreSQL16 (Scoop) Autostart"
$Args     = "-D `"$PGDATA`" -l `"$LOG`" -o ""-p $PgPort"" start"

$action    = New-ScheduledTaskAction -Execute $pgctl -Argument $Args
$trigger   = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest

Register-ScheduledTask -TaskName $TaskName -Action $action -Trigger $trigger -Principal $principal -Force | Out-Null

$pairs = @{
    "DATABASE_HOST" = $dbHost
    "DATABASE_PORT" = $dbPort
    "DATABASE_NAME" = $dbName
    "DATABASE_USER" = $dbUser
    "DATABASE_PASS" = $dbPass
}
Upsert-DotEnvBlock -Path $EnvPath -Pairs $pairs
Import-DotEnv -Path $EnvPath | Out-Null

if ($WriteMachineEnv) {
    foreach ($k in $pairs.Keys) {
        [Environment]::SetEnvironmentVariable($k, $pairs[$k], "Machine")
    }
}

Write-Host "OK: PostgreSQL16 (Scoop) установлен и запущен." -ForegroundColor Green
Write-Host "DB:  $dbHost:$dbPort  name=$dbName user=$dbUser" -ForegroundColor Green
Write-Host "Task: $TaskName" -ForegroundColor Green
Write-Host "Env file updated: $EnvPath" -ForegroundColor Green
