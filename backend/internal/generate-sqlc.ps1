$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Push-Location $scriptDir

try {
    if (Get-Command sqlc -ErrorAction SilentlyContinue) {
        sqlc generate -f sqlc.yaml
    }
    else {
        $env:CGO_ENABLED = "0"
        go run github.com/sqlc-dev/sqlc/cmd/sqlc@v1.28.0 generate -f sqlc.yaml
    }
}
finally {
    Pop-Location
}
