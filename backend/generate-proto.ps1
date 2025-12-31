$protoRoot = (Resolve-Path internal/proto).Path
$googleapis = (Resolve-Path internal/proto/third_party/googleapis).Path

$protos = Get-ChildItem -Path $protoRoot -Filter *.proto -Recurse |
        Where-Object { $_.FullName -notmatch '\\third_party\\' } |
        ForEach-Object { $_.FullName }

protoc `
    -I $protoRoot `
    -I $googleapis `
    --go_out=internal --go_opt=module=ascendant/backend/internal `
    --go-grpc_out=internal --go-grpc_opt=module=ascendant/backend/internal `
    --grpc-gateway_out=internal `
    --grpc-gateway_opt=module=ascendant/backend/internal `
    $protos