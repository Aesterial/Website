param(
  [string]$Repo = "ivanskem/aesterial-jcup"
)

$dateTag = Get-Date -Format "yyyy-MM-dd"

function Get-UniqueTag {
  param(
    [string]$Repo,
    [string]$BaseTag
  )

  $suffix = 0
  while ($true) {
    $candidate = if ($suffix -eq 0) { $BaseTag } else { "$BaseTag-$suffix" }
    docker image inspect "${Repo}:$candidate" 2>$null | Out-Null
    if ($LASTEXITCODE -ne 0) {
      return $candidate
    }
    $suffix++
  }
}

$backendTag = Get-UniqueTag -Repo $Repo -BaseTag "backend-$dateTag"
$frontendTag = Get-UniqueTag -Repo $Repo -BaseTag "frontend-$dateTag"

Write-Host "Building backend image ($($Repo):$backendTag, $($Repo):backend-latest)..."
docker build `
  -f backend/Dockerfile `
  -t "$($Repo):$backendTag" `
  -t "$($Repo):backend-latest" `
  backend

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Building frontend image ($($Repo):$frontendTag, $($Repo):frontend-latest)..."
docker build `
  -f frontend/web/Dockerfile `
  -t "$($Repo):$frontendTag" `
  -t "$($Repo):frontend-latest" `
  frontend/web

if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host "Done."
