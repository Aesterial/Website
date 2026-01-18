package grpcserver

import (
	"Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	appstatistics "Aesterial/backend/internal/app/statistics"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/user"
	statpb "Aesterial/backend/internal/gen/statistics/v1"
	"Aesterial/backend/internal/infra/logger"
	"context"
	"time"

	"google.golang.org/grpc/codes"
	"google.golang.org/grpc/status"
	"google.golang.org/protobuf/types/known/emptypb"
)

type StatService struct {
	statpb.UnimplementedStatisticsServiceServer
	stat *appstatistics.StatService
	auth *Authenticator
}

func oClock() time.Time {
	t := time.Now()
	startOfDay := time.Date(t.Year(), t.Month(), t.Day(), 0, 0, 0, 0, t.Location())
	return startOfDay
}

func NewStatService(stat *appstatistics.StatService, ses *sessions.Service, us *userapp.Service) *StatService {
	return &StatService{stat: stat, auth: NewAuthenticator(ses, us)}
}

func authorize(ctx context.Context, auth *Authenticator, perms ...permsdomain.Permission) (*user.RequestData, error) {
	requestor, err := auth.RequireUser(ctx)
	if err != nil || requestor == nil {
		return nil, err
	}
	perms = append(perms, permsdomain.StatisticsAll)
	if err := auth.RequirePermissions(ctx, requestor.UID, perms...); err != nil {
		return nil, err
	}
	return requestor, nil
}

func (s *StatService) VotesDay(ctx context.Context, _ *emptypb.Empty) (*statpb.VoteCountResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	count, err := s.stat.VoteCount(ctx, time.Now().Add(-24*time.Hour))
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get vote count")
	}
	logger.Info("Got statistics about vote count last day", "statservice.votesday", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.None, TraceIDOrNew(ctx))
	return &statpb.VoteCountResponse{Count: count, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *StatService) TopVoteCategories(ctx context.Context, req *statpb.CategoriesRequest) (*statpb.TopByCategoriesResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request must not be nil")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	cat, err := s.stat.VoteCategories(ctx, time.Now().Add(-24*7*time.Hour), int(req.Limit))
	if err != nil {
		logger.Debug("Failed to get top categories: "+err.Error(), "statService.topVoteCategories")
		return nil, status.Error(codes.Internal, "failed to get top vote categories")
	}
	return &statpb.TopByCategoriesResponse{Record: cat, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *StatService) UsersActivity(ctx context.Context, req *statpb.UsersActivityRequest) (*statpb.UsersActivityResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	if req == nil {
		return nil, status.Error(codes.InvalidArgument, "request must not be nil")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	limit := int(req.Limit)
	if limit <= 0 {
		limit = 7
	}

	activity, err := s.stat.UsersActivity(ctx, time.Now().Add(-time.Duration(limit)*24*time.Hour))
	if err != nil {
		logger.Debug("Error on getting users activity: "+err.Error(), "service.usersActivity")
		return nil, status.Error(codes.Internal, "failed to get users activity")
	}

	data := make(map[int64]*statpb.UsersActivity, len(activity))
	for at, record := range activity {
		data[at.Unix()] = record
	}

	return &statpb.UsersActivityResponse{Data: data, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *StatService) ActiveUsers(ctx context.Context, tag *statpb.WithFromTagRequest) (*statpb.ActiveUsersResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	data, err := s.stat.GetActiveUsers(ctx, tag.Since.AsTime())
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get active users")
	}
	return &statpb.ActiveUsersResponse{Count: data, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *StatService) OfflineUsers(ctx context.Context, tag *statpb.WithFromTagRequest) (*statpb.OfflineUsersResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	data, err := s.stat.GetOfflineUsers(ctx, tag.Since.AsTime())
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get offline users")
	}
	return &statpb.OfflineUsersResponse{Count: data, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *StatService) IdeasDay(ctx context.Context, _ *emptypb.Empty) (*statpb.IdeasCountResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	data, err := s.stat.NewIdeasCount(ctx, oClock())
	if err != nil {
		return nil, status.Error(codes.Internal, "failed to get vote count")
	}
	return &statpb.IdeasCountResponse{Count: data, Tracing: TraceIDOrNew(ctx)}, nil
}

func (s *StatService) IdeasRecap(ctx context.Context, _ *emptypb.Empty) (*statpb.IdeasApprovalResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	requestor, err := authorize(ctx, s.auth, permsdomain.StatisticsActivityAll)
	if err != nil || requestor == nil {
		return nil, err
	}
	return s.stat.IdeasRecap(ctx)
}

func (s *StatService) QualityRecap(ctx context.Context, _ *emptypb.Empty) (*statpb.EditorsGradeResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	requestor, err := authorize(ctx, s.auth, permsdomain.StatisticsMediaQuality)
	if err != nil || requestor == nil {
		return nil, err
	}
	recap, err := s.stat.QualityRecap(ctx)
	if err != nil {
		return nil, err
	}
	recap.Tracing = TraceIDOrNew(ctx)
	return recap, nil
}

func (s *StatService) MediaCoverage(ctx context.Context, req *statpb.MediaCoverageRequest) (*statpb.MediaCoverageResponse, error) {
	if s == nil || s.stat == nil {
		return nil, status.Error(codes.Internal, "service is not configured")
	}
	requestor, err := authorize(ctx, s.auth, permsdomain.StatisticsMediaVolume)
	if err != nil || requestor == nil {
		return nil, err
	}
	coverage, err := s.stat.MediaCoverage(ctx, int(req.GetLimit()))
	if err != nil {
		return nil, err
	}
	return &statpb.MediaCoverageResponse{Medias: coverage, Tracing: TraceIDOrNew(ctx)}, nil
}
