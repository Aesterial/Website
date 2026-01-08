param(
    [string]$EnvPath = ".\.env",
    [string]$InstallDir = "C:\minio",
    [string]$DataDir = "C:\minio\data",
    [string]$ServiceId = "MinIO",
    [int]$ApiPort = 9000,
    [int]$ConsolePort = 9001,
    [string]$WinSWVersion = "2.12.0",
    [switch]$RecreateService
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

function Is-Admin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p  = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

function Relaunch-AsAdmin {
    param([string[]]$Args)
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName  = "powershell.exe"
    $psi.Arguments = $Args -join " "
    $psi.Verb      = "runas"
    [System.Diagnostics.Process]::Start($psi) | Out-Null
}

function Import-DotEnv {
    param([Parameter(Mandatory=$true)][string]$Path)
    if (-not (Test-Path $Path)) { throw "Файл .env не найден: $Path" }

    Get-Content $Path | ForEach-Object {
        $line = $_.Trim()
        if ($line.Length -eq 0) { return }
        if ($line.StartsWith("#")) { return }
        if ($line.StartsWith("export ")) { $line = $line.Substring(7).Trim() }

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

function Test-ExeFile {
    param([Parameter(Mandatory=$true)][string]$Path)
    if (-not (Test-Path $Path)) { return $false }
    try {
        $fs = [System.IO.File]::Open($Path, 'Open', 'Read', 'ReadWrite')
        try {
            if ($fs.Length -lt 1024) { return $false }
            $b1 = $fs.ReadByte(); $b2 = $fs.ReadByte()
            return ($b1 -eq 0x4D -and $b2 -eq 0x5A) # MZ
        } finally { $fs.Dispose() }
    } catch { return $false }
}

function Download-File {
    param(
        [Parameter(Mandatory=$true)][string]$Url,
        [Parameter(Mandatory=$true)][string]$OutFile,
        [int]$Retries = 4
    )

    $tmp = "$OutFile.tmp"
    if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }

    for ($i = 1; $i -le $Retries; $i++) {
        try {
            Write-Host "Downloading ($i/$Retries) $Url -> $OutFile"
            Invoke-WebRequest -Uri $Url -OutFile $tmp -TimeoutSec 120 -MaximumRedirection 5 -Headers @{ "User-Agent" = "Mozilla/5.0" } | Out-Null
            Move-Item -Force $tmp $OutFile

            # Проверка на EXE + защита от HTML (обычно мелкий файл)
            if (-not (Test-ExeFile -Path $OutFile)) {
                $len = (Get-Item $OutFile).Length
                throw "Скачанный файл не похож на .exe (len=$len). Часто это HTML/redirect."
            }
            return
        } catch {
            Write-Host "Download failed: $($_.Exception.Message)" -ForegroundColor Yellow
            if (Test-Path $tmp) { Remove-Item $tmp -Force -ErrorAction SilentlyContinue }
            if (Test-Path $OutFile) { Remove-Item $OutFile -Force -ErrorAction SilentlyContinue }
            if ($i -lt $Retries) { Start-Sleep -Seconds (2 * $i) } else { throw }
        }
    }
}

function Escape-Xml([string]$s) {
    if ($null -eq $s) { return "" }
    return ($s.Replace("&","&amp;").Replace("<","&lt;").Replace(">","&gt;").Replace('"',"&quot;").Replace("'","&apos;"))
}

function Wait-MinIOReady {
    param([string]$Url, [int]$Seconds = 60)
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        try { Invoke-RestMethod -Method Get -Uri $Url -TimeoutSec 2 | Out-Null; return }
        catch { Start-Sleep -Milliseconds 500 }
    }
    throw "MinIO не стал ready за $Seconds секунд: $Url"
}

# --- Elevation ---
if (-not (Is-Admin)) {
    Write-Host "Нужно запустить от администратора. Перезапускаю..." -ForegroundColor Yellow
    $args = @(
        "-ExecutionPolicy Bypass",
        "-File `"$PSCommandPath`"",
        "-EnvPath `"$EnvPath`"",
        "-InstallDir `"$InstallDir`"",
        "-DataDir `"$DataDir`"",
        "-ServiceId `"$ServiceId`"",
        "-ApiPort $ApiPort",
        "-ConsolePort $ConsolePort",
        "-WinSWVersion `"$WinSWVersion`""
    )
    if ($RecreateService) { $args += "-RecreateService" }
    Relaunch-AsAdmin -Args $args
    exit
}

# --- Load env ---
Import-DotEnv -Path $EnvPath

$bucket = $env:STORAGE_BUCKET
$access = $env:STORAGE_ACCESS_KEY
$secret = $env:STORAGE_SECRET_KEY
$region = $env:STORAGE_REGION

if (-not $bucket) { throw "В .env нет STORAGE_BUCKET" }
if (-not $access) { throw "В .env нет STORAGE_ACCESS_KEY" }
if (-not $secret) { throw "В .env нет STORAGE_SECRET_KEY" }
if (-not $region) { $region = "us-east-1" }

# --- Prepare dirs ---
New-Item -ItemType Directory -Force -Path $InstallDir | Out-Null
New-Item -ItemType Directory -Force -Path $DataDir | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $InstallDir "logs") | Out-Null

$minioExe = Join-Path $InstallDir "minio.exe"
$mcExe    = Join-Path $InstallDir "mc.exe"

# WinSW naming: exe + xml with same base name удобно
$winswExe = Join-Path $InstallDir "minio-service.exe"
$winswXml = Join-Path $InstallDir "minio-service.xml"
$logDir   = Join-Path $InstallDir "logs"

# --- Download MinIO + mc ---
if (-not (Test-ExeFile -Path $minioExe)) {
    Download-File -Url "https://dl.min.io/server/minio/release/windows-amd64/minio.exe" -OutFile $minioExe
}
if (-not (Test-ExeFile -Path $mcExe)) {
    Download-File -Url "https://dl.min.io/client/mc/release/windows-amd64/mc.exe" -OutFile $mcExe
}

# --- Download WinSW (GitHub direct asset link) ---
if (-not (Test-ExeFile -Path $winswExe)) {
    if (Test-Path $winswExe) { Remove-Item $winswExe -Force -ErrorAction SilentlyContinue }
    $winswUrl = "https://github.com/winsw/winsw/releases/download/v$WinSWVersion/WinSW-x64.exe"
    Download-File -Url $winswUrl -OutFile $winswExe

    # sanity: WinSW должен быть мегабайты, а не килобайты
    $len = (Get-Item $winswExe).Length
    if ($len -lt 1000000) { throw "WinSW скачался слишком маленьким (len=$len). Это почти наверняка не бинарник." }
}

# --- Rights for LocalSystem ---
& icacls $DataDir /grant "NT AUTHORITY\SYSTEM:(OI)(CI)F" /T | Out-Null

# --- Set Machine env (чтобы НЕ хранить секреты в XML) ---
[Environment]::SetEnvironmentVariable("MINIO_ROOT_USER", $access, "Machine")
[Environment]::SetEnvironmentVariable("MINIO_ROOT_PASSWORD", $secret, "Machine")
[Environment]::SetEnvironmentVariable("MINIO_REGION", $region, "Machine")

# --- Remove old broken service if exists (sc/New-Service) ---
$svc = Get-Service -Name $ServiceId -ErrorAction SilentlyContinue
if ($svc) {
    if ($RecreateService) {
        try { Stop-Service -Name $ServiceId -Force -ErrorAction SilentlyContinue } catch {}
        sc.exe delete $ServiceId | Out-Null
        Start-Sleep -Seconds 1
    }
}

# --- Write WinSW XML config ---
$minioExeXml = Escape-Xml $minioExe
$dataDirXml  = Escape-Xml $DataDir
$logDirXml   = Escape-Xml $logDir

@"
<service>
  <id>$ServiceId</id>
  <name>$ServiceId</name>
  <description>MinIO Object Storage</description>

  <executable>$minioExeXml</executable>
  <arguments>server $dataDirXml --address :$ApiPort --console-address :$ConsolePort</arguments>

  <logpath>$logDirXml</logpath>
  <log mode="roll-by-size">
    <sizeThreshold>10240</sizeThreshold>
    <keepFiles>5</keepFiles>
  </log>

  <startmode>Automatic</startmode>
  <stoptimeout>15sec</stoptimeout>
</service>
"@ | Set-Content -Path $winswXml -Encoding UTF8

# --- Install/Start via WinSW ---
# На всякий: если сервис уже установлен WinSW-ом раньше
try { & $winswExe stop $winswXml | Out-Null } catch {}
try { & $winswExe uninstall $winswXml | Out-Null } catch {}

& $winswExe install $winswXml | Out-Null
& $winswExe start   $winswXml | Out-Null

# --- Wait ready & init bucket ---
Wait-MinIOReady -Url "http://127.0.0.1:$ApiPort/minio/health/ready" -Seconds 60

& $mcExe alias set local "http://127.0.0.1:$ApiPort" $access $secret | Out-Null
& $mcExe mb --ignore-existing "local/$bucket" | Out-Null

Write-Host "OK: MinIO поднят как Windows Service через WinSW" -ForegroundColor Green
Write-Host "API:     http://127.0.0.1:$ApiPort" -ForegroundColor Green
Write-Host "Console: http://127.0.0.1:$ConsolePort" -ForegroundColor Green
Write-Host "Logs:    $logDir" -ForegroundColor Green
Write-Host "Bucket:  $bucket" -ForegroundColor Green
