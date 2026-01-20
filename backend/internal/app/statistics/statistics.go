package appstatistics

import (
	statscheduler "Aesterial/backend/internal/app/statistics/scheduler"
	"Aesterial/backend/internal/domain/statistics"
	statpb "Aesterial/backend/internal/gen/statistics/v1"
	"Aesterial/backend/internal/infra/logger"
	apperrors "Aesterial/backend/internal/shared/errors"
	"context"
	"time"
)

type StatService struct {
	repo statistics.Repository
}

func New(repo statistics.Repository) *StatService {
	statscheduler.Run(repo, time.Local)
	return &StatService{repo}
}

func (s *StatService) VoteCount(ctx context.Context, since time.Time) (uint32, error) {
	if since.IsZero() {
		return 0, apperrors.InvalidArguments.AddErrDetails("since is null")
	}
	count, err := s.repo.VoteCount(ctx, since)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.vote_count")
		return 0, apperrors.Wrap(err)
	}
	return count, nil
}

func (s *StatService) VoteCategories(ctx context.Context, since time.Time, limit int) ([]*statpb.CategoryRecord, error) {
	if since.IsZero() {
		return nil, apperrors.InvalidArguments.AddErrDetails("since is null")
	}
	if limit <= 0 {
		return nil, apperrors.InvalidArguments.AddErrDetails("limit is null")
	}
	list, err := s.repo.VoteCategories(ctx, since, limit)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.vote_categories")
		return nil, apperrors.Wrap(err)
	}
	return list, nil
}

func (s *StatService) UsersActivity(ctx context.Context, since time.Time) (map[time.Time]*statpb.UsersActivity, error) {
	if since.IsZero() {
		return nil, apperrors.InvalidArguments.AddErrDetails("since is null")
	}
	data, err := s.repo.UsersActivity(ctx, since)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.users_activity")
		return nil, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *StatService) GetActiveUsers(ctx context.Context, since time.Time) (uint32, error) {
	data, err := s.repo.GetOnlineUsers(ctx, since)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.get_active_users")
		return 0, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *StatService) GetOfflineUsers(ctx context.Context, since time.Time) (uint32, error) {
	data, err := s.repo.GetOfflineUsers(ctx, since)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.get_offline_users")
		return 0, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *StatService) NewIdeasCount(ctx context.Context, since time.Time) (uint32, error) {
	data, err := s.repo.NewIdeasCount(ctx, since)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.new_ideas_count")
		return 0, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *StatService) IdeasRecap(ctx context.Context) (*statpb.IdeasApprovalResponse, error) {
	data, err := s.repo.IdeasRecap(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.ideas_recap")
		return nil, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *StatService) QualityRecap(ctx context.Context) (*statpb.EditorsGradeResponse, error) {
	data, err := s.repo.QualityRecap(ctx)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.quality_recap")
		return nil, apperrors.Wrap(err)
	}
	return data, nil
}

func (s *StatService) MediaCoverage(ctx context.Context, limit int) ([]*statpb.MediaCoverageResponseMedia, error) {
	data, err := s.repo.MediaCoverage(ctx, limit)
	if err != nil {
		logger.Debug("error appeared: "+err.Error(), "statistics.media_coverage")
		return nil, apperrors.Wrap(err)
	}
	return data, nil
}
