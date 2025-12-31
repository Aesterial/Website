package main

import (
	"fmt"
	"net"
	"net/http"
	"strings"
	"time"

	"ascendant/backend/internal/infra/grpcserver"
	"ascendant/backend/internal/infra/logger"

	"github.com/grpc-ecosystem/grpc-gateway/v2/runtime"
	"github.com/improbable-eng/grpc-web/go/grpcweb"
	"golang.org/x/net/http2"
	"golang.org/x/net/http2/h2c"
	"google.golang.org/grpc"
)

type corsConfig struct {
	allowAll bool
	allowed  map[string]struct{}
}

func newCORS(allowedOrigins []string) corsConfig {
	allowed := make(map[string]struct{})
	allowAll := false
	for _, origin := range allowedOrigins {
		val := strings.TrimSpace(origin)
		if val == "" {
			continue
		}
		if val == "*" {
			allowAll = true
			continue
		}
		allowed[val] = struct{}{}
	}
	if len(allowed) == 0 && !allowAll {
		allowAll = true
	}
	return corsConfig{allowAll: allowAll, allowed: allowed}
}

func (c corsConfig) originAllowed(origin string) bool {
	if c.allowAll {
		return true
	}
	_, ok := c.allowed[origin]
	return ok
}

func (c corsConfig) apply(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "" {
		return
	}
	if !c.originAllowed(origin) {
		return
	}

	if c.allowAll {
		w.Header().Set("Access-Control-Allow-Origin", "*")
	} else {
		w.Header().Set("Access-Control-Allow-Origin", origin)
		w.Header().Set("Vary", "Origin")
		w.Header().Set("Access-Control-Allow-Credentials", "true")
	}

	w.Header().Set("Access-Control-Expose-Headers", strings.Join(grpcExposeHeaders(), ", "))
}

func (c corsConfig) handlePreflight(w http.ResponseWriter, r *http.Request) bool {
	if r.Method != http.MethodOptions {
		return false
	}
	c.apply(w, r)
	w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PATCH, PUT, DELETE, OPTIONS")
	w.Header().Set("Access-Control-Allow-Headers", strings.Join(grpcAllowedHeaders(), ", "))
	w.Header().Set("Access-Control-Max-Age", "86400")
	w.WriteHeader(http.StatusNoContent)
	return true
}

func grpcAllowedHeaders() []string {
	return []string{
		"content-type",
		"x-grpc-web",
		"x-user-agent",
		"authorization",
		"x-session-token",
		"x-trace-id",
		"grpc-timeout",
	}
}

func grpcExposeHeaders() []string {
	return []string{
		"grpc-status",
		"grpc-message",
		"grpc-status-details-bin",
		"x-trace-id",
	}
}

func gatewayHeaderMatcher(key string) (string, bool) {
	switch strings.ToLower(key) {
	case "authorization", "cookie", "x-session-token", "user-agent":
		return strings.ToLower(key), true
	default:
		return runtime.DefaultHeaderMatcher(key)
	}
}

func gatewayOutgoingHeaderMatcher(key string) (string, bool) {
	switch strings.ToLower(key) {
	case "set-cookie", grpcserver.TraceHeader:
		return strings.ToLower(key), true
	default:
		return runtime.DefaultHeaderMatcher(key)
	}
}

func buildHTTPHandler(grpcServer *grpc.Server, gateway *runtime.ServeMux, cors corsConfig) http.Handler {
	grpcWebServer := grpcweb.WrapServer(
		grpcServer,
		grpcweb.WithOriginFunc(cors.originAllowed),
		grpcweb.WithAllowedRequestHeaders(grpcAllowedHeaders()),
		grpcweb.WithWebsockets(true),
		grpcweb.WithWebsocketOriginFunc(func(req *http.Request) bool {
			origin := req.Header.Get("Origin")
			if origin == "" {
				return true
			}
			return cors.originAllowed(origin)
		}),
	)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if cors.handlePreflight(w, r) {
			return
		}
		if grpcWebServer.IsGrpcWebRequest(r) || grpcWebServer.IsGrpcWebSocketRequest(r) || grpcWebServer.IsAcceptableGrpcCorsRequest(r) {
			cors.apply(w, r)
			grpcWebServer.ServeHTTP(w, r)
			return
		}
		if isGrpcRequest(r) {
			grpcServer.ServeHTTP(w, r)
			return
		}
		if gateway != nil {
			traceID := grpcserver.NewTraceID()
			ctx := grpcserver.WithTraceID(r.Context(), traceID)
			w.Header().Set(grpcserver.TraceHeader, traceID)
			rec := &statusWriter{ResponseWriter: w, status: http.StatusOK, startedAt: time.Now()}

			cors.apply(rec, r)
			logGatewayStart(r, traceID)
			gateway.ServeHTTP(rec, r.WithContext(ctx))
			logGatewayFinish(r, traceID, rec.status, time.Since(rec.startedAt))
			return
		}
		cors.apply(w, r)
		http.NotFound(w, r)
	})
}

func isGrpcRequest(r *http.Request) bool {
	return r.ProtoMajor == 2 && strings.Contains(r.Header.Get("Content-Type"), "application/grpc")
}

func withH2C(handler http.Handler) http.Handler {
	return h2c.NewHandler(handler, &http2.Server{})
}

type statusWriter struct {
	http.ResponseWriter
	status    int
	startedAt time.Time
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *statusWriter) Write(data []byte) (int, error) {
	return w.ResponseWriter.Write(data)
}

func logGatewayStart(r *http.Request, traceID string) {
	logger.Info(
		"Received request: "+clientAddr(r)+" -> "+r.URL.Path,
		"middleware.tracing",
		logger.EventActor{Type: logger.System, ID: 0},
		logger.None,
		traceID,
	)
}

func logGatewayFinish(r *http.Request, traceID string, status int, duration time.Duration) {
	result := logger.None
	switch {
	case status >= 200 && status < 300:
		result = logger.Success
	case status >= 400:
		result = logger.Failure
	}
	logger.Info(
		fmt.Sprintf("Response to %s from %s: code %d, method %s, elapsed %s", clientAddr(r), r.URL.Path, status, r.Method, duration),
		"middleware.tracing",
		logger.EventActor{Type: logger.System, ID: 0},
		result,
		traceID,
	)
}

func clientAddr(r *http.Request) string {
	if r == nil {
		return "unknown"
	}
	if host, _, err := net.SplitHostPort(r.RemoteAddr); err == nil && host != "" {
		return host
	}
	if r.RemoteAddr != "" {
		return r.RemoteAddr
	}
	return "unknown"
}
