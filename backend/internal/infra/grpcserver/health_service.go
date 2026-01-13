package grpcserver

import (
	"context"

	checkerpb "ascendant/backend/internal/gen/checker/v1"
	"google.golang.org/protobuf/types/known/emptypb"
)

type HealthService struct {
	checkerpb.UnimplementedCheckerServiceServer
}

func NewHealthService() *HealthService {
	return &HealthService{}
}

func (s *HealthService) Health(_ context.Context, _ *emptypb.Empty) (*checkerpb.HealthResponse, error) {
	return &checkerpb.HealthResponse{Alive: true}, nil
}
