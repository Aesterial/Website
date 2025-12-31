package grpcserver

import (
	appstatistics "ascendant/backend/internal/app/statistics"
	statpb "ascendant/backend/internal/gen/statistics/v1"
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type StatService struct {
	statpb.UnimplementedStatisticsServiceServer
	stat *appstatistics.StatService
}

func NewStatService(stat *appstatistics.StatService) *StatService {
	return &StatService{stat: stat}
}

func (s *StatService) VotesDay(ctx context.Context, _ *emptypb.Empty) (*statpb.VoteCountResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	count, err := s.stat.VoteCount(ctx, time.Now().Add(-24*time.Hour))
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get vote count")
	}
	return &statpb.VoteCountResponse{Count: count, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *StatService) TopVoteCategories(ctx context.Context, req *statpb.CategoriesRequest) (*statpb.TopByCategoriesResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request must not be nil")
	}
	cat, err := s.stat.VoteCategories(ctx, time.Now().Add(-24*7*time.Hour), int(req.Limit))
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get top vote categories")
	}
	return &statpb.TopByCategoriesResponse{Record: cat, Tracing: TraceIDOrNew(ctx)}, nil
}
