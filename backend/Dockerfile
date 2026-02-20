ARG GO_VERSION=1.26

FROM golang:${GO_VERSION}-bookworm AS build
WORKDIR /app/backend

COPY go.work ./
COPY internal/go.mod internal/go.sum ./internal/
COPY mail-proxy/go.mod mail-proxy/go.sum ./mail-proxy/
COPY starter/go.mod starter/go.sum ./starter/

RUN go work sync
RUN cd internal && go mod download
RUN cd starter && go mod download

COPY internal ./internal
COPY starter ./starter

RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -o /out/Aesterial-backend ./starter

FROM debian:bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /out/Aesterial-backend /app/Aesterial-backend

EXPOSE 8080
CMD ["./Aesterial-backend"]
