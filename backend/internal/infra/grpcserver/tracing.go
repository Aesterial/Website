package grpcserver

import (
	"context"
	"fmt"
	"strings"
	"time"

	"Aesterial/backend/internal/infra/logger"

	"github.com/google/uuid"
	"google.golang.org/grpc"
	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/metadata"
	"google.golang.org/grpc/peer"
	"google.golang.org/grpc/status"
)

const TraceHeader = "x-trace-id"

type traceIDKey struct{}

func NewTraceID() string {
	return uuid.New().String()
}

func WithTraceID(ctx context.Context, traceID string) context.Context {
	if traceID == "" {
		traceID = NewTraceID()
	}
	return context.WithValue(ctx, traceIDKey{}, traceID)
}

func TraceIDFromContext(ctx context.Context) string {
	if ctx == nil {
		return ""
	}
	if v, ok := ctx.Value(traceIDKey{}).(string); ok {
		return v
	}
	return ""
}

func TraceIDOrNew(ctx context.Context) string {
	traceID := TraceIDFromContext(ctx)
	if traceID == "" {
		traceID = NewTraceID()
	}
	return traceID
}

func TraceUnaryInterceptor() grpc.UnaryServerInterceptor {
	return func(ctx context.Context, req any, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (any, error) {
		traceID := NewTraceID()
		ctx = WithTraceID(ctx, traceID)
		_ = grpc.SetHeader(ctx, metadata.Pairs(TraceHeader, traceID))

		start := time.Now()
		peerAddr := clientIP(ctx)
		logger.Info(
			"Received request: "+peerAddr+" -> "+info.FullMethod,
			"middleware.tracing",
			logger.EventActor{Type: logger.System, ID: 0},
			logger.None,
			traceID,
		)

		resp, err := handler(ctx, req)

		code := status.Code(err)
		result := traceResult(code)
		logger.Info(
			fmt.Sprintf("Response to %s from %s: code %s, elapsed %s", peerAddr, info.FullMethod, code.String(), time.Since(start)),
			"middleware.tracing",
			logger.EventActor{Type: logger.System, ID: 0},
			result,
			traceID,
		)

		return resp, err
	}
}

func grpcPeerAddr(ctx context.Context) string {
	if p, ok := peer.FromContext(ctx); ok && p.Addr != nil {
		addr := p.Addr.String()
		if addr != "" {
			return addr
		}
	}
	return "unknown"
}

func traceResult(code codes.Code) logger.EventResult {
	switch code {
	case codes.OK:
		return logger.Success
	case codes.Canceled, codes.DeadlineExceeded:
		return logger.None
	default:
		return logger.Failure
	}
}

func TraceIDFromMetadata(md metadata.MD) string {
	for _, v := range md.Get(TraceHeader) {
		if strings.TrimSpace(v) != "" {
			return strings.TrimSpace(v)
		}
	}
	return ""
}
