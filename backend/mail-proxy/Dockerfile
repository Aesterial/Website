FROM golang:1.26-alpine AS builder

WORKDIR /src

COPY go.mod go.sum ./
RUN go mod download

COPY . .

RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -trimpath -ldflags="-s -w" -o /out/aesterial_backend_mail ./main.go

FROM alpine:3.22

RUN apk add --no-cache ca-certificates tzdata

WORKDIR /app

COPY --from=builder /out/aesterial_backend_mail /app/aesterial_backend_mail

EXPOSE 50051

ENTRYPOINT ["/app/aesterial_backend_mail"]
