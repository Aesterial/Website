package grpcserver

import (
	"Aesterial/backend/internal/app/info/sessions"
	userapp "Aesterial/backend/internal/app/info/user"
	appstatistics "Aesterial/backend/internal/app/statistics"
	permsdomain "Aesterial/backend/internal/domain/permissions"
	"Aesterial/backend/internal/domain/user"
	statpb "Aesterial/backend/internal/gen/statistics/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"time"

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
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	count, err := s.stat.VoteCount(ctx, time.Now().Add(-24*time.Hour))
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to get vote count")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got statistics about vote count last day", "statservice.votesday", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &statpb.VoteCountResponse{Count: count, Tracing: traceID}, nil
}

func (s *StatService) TopVoteCategories(ctx context.Context, req *statpb.CategoriesRequest) (*statpb.TopByCategoriesResponse, error) {
	if s == nil || s.stat == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request must not be nil")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	cat, err := s.stat.VoteCategories(ctx, time.Now().Add(-24*7*time.Hour), int(req.Limit))
	if err != nil {
		logger.Debug("Failed to get top categories: "+err.Error(), "statService.topVoteCategories")
		return nil, apperrors.ServerError.AddErrDetails("failed to get top vote categories")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got top vote categories", "statservice.top_vote_categories.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &statpb.TopByCategoriesResponse{Record: cat, Tracing: traceID}, nil
}

func (s *StatService) UsersActivity(ctx context.Context, req *statpb.UsersActivityRequest) (*statpb.UsersActivityResponse, error) {
	if s == nil || s.stat == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	if req == nil {
		return nil, apperrors.RequiredDataMissing.AddErrDetails("request must not be nil")
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
		return nil, apperrors.ServerError.AddErrDetails("failed to get users activity")
	}

	data := make(map[int64]*statpb.UsersActivity, len(activity))
	for at, record := range activity {
		data[at.Unix()] = record
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got users activity statistics", "statservice.users_activity.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &statpb.UsersActivityResponse{Data: data, Tracing: traceID}, nil
}

func (s *StatService) ActiveUsers(ctx context.Context, tag *statpb.WithFromTagRequest) (*statpb.ActiveUsersResponse, error) {
	if s == nil || s.stat == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	data, err := s.stat.GetActiveUsers(ctx, tag.Since.AsTime())
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to get active users")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got active users statistics", "statservice.active_users.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &statpb.ActiveUsersResponse{Count: data, Tracing: traceID}, nil
}

func (s *StatService) OfflineUsers(ctx context.Context, tag *statpb.WithFromTagRequest) (*statpb.OfflineUsersResponse, error) {
	if s == nil || s.stat == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	data, err := s.stat.GetOfflineUsers(ctx, tag.Since.AsTime())
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to get offline users")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got offline users statistics", "statservice.offline_users.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &statpb.OfflineUsersResponse{Count: data, Tracing: traceID}, nil
}

func (s *StatService) IdeasDay(ctx context.Context, _ *emptypb.Empty) (*statpb.IdeasCountResponse, error) {
	if s == nil || s.stat == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	requestor, err := authorize(ctx, s.auth)
	if err != nil || requestor == nil {
		return nil, err
	}
	data, err := s.stat.NewIdeasCount(ctx, oClock())
	if err != nil {
		return nil, apperrors.ServerError.AddErrDetails("failed to get vote count")
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got ideas count for day", "statservice.ideas_day.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &statpb.IdeasCountResponse{Count: data, Tracing: traceID}, nil
}

func (s *StatService) IdeasRecap(ctx context.Context, _ *emptypb.Empty) (*statpb.IdeasApprovalResponse, error) {
	if s == nil || s.stat == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	requestor, err := authorize(ctx, s.auth, permsdomain.StatisticsActivityAll)
	if err != nil || requestor == nil {
		return nil, err
	}
	recap, err := s.stat.IdeasRecap(ctx)
	if err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got ideas recap", "statservice.ideas_recap.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	recap.Tracing = traceID
	return recap, nil
}

func (s *StatService) QualityRecap(ctx context.Context, _ *emptypb.Empty) (*statpb.EditorsGradeResponse, error) {
	if s == nil || s.stat == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	requestor, err := authorize(ctx, s.auth, permsdomain.StatisticsMediaQuality)
	if err != nil || requestor == nil {
		return nil, err
	}
	recap, err := s.stat.QualityRecap(ctx)
	if err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got quality recap", "statservice.quality_recap.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	recap.Tracing = traceID
	return recap, nil
}

func (s *StatService) MediaCoverage(ctx context.Context, req *statpb.MediaCoverageRequest) (*statpb.MediaCoverageResponse, error) {
	if s == nil || s.stat == nil {
		return nil, apperrors.NotConfigured.AddErrDetails("service is not configured")
	}
	requestor, err := authorize(ctx, s.auth, permsdomain.StatisticsMediaVolume)
	if err != nil || requestor == nil {
		return nil, err
	}
	coverage, err := s.stat.MediaCoverage(ctx, int(req.GetLimit()))
	if err != nil {
		return nil, err
	}
	traceID := TraceIDOrNew(ctx)
	logger.Info("Got media coverage statistics", "statservice.media_coverage.success", logger.EventActor{Type: logger.User, ID: requestor.UID}, logger.Success, traceID)
	return &statpb.MediaCoverageResponse{Medias: coverage, Tracing: traceID}, nil
}
