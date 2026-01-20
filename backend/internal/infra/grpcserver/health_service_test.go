package grpcserver_test

import (
	"context"
	"testing"

	grpcserver "Aesterial/backend/internal/infra/grpcserver"
	"google.golang.org/protobuf/types/known/emptypb"
)

func TestHealthServiceHealth(t *testing.T) {
	svc := grpcserver.NewHealthService()
	resp, err := svc.Health(context.Background(), &emptypb.Empty{})
	if err != nil {
		t.Fatalf("Health() error: %v", err)
	}
	if resp == nil || !resp.Alive {
		t.Fatalf("expected alive response, got %+v", resp)
	}
}
